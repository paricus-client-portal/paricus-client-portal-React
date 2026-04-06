import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth-prisma.js';
import { prisma } from '../database/prisma.js';
import log from '../utils/console-logger.js';

const router = express.Router();

const PBI_CLIENT_ID = process.env.PBI_CLIENT_ID;
const PBI_CLIENT_SECRET = process.env.PBI_CLIENT_SECRET;
const PBI_TENANT_ID = process.env.PBI_TENANT_ID;
const PBI_USERNAME = process.env.PBI_USERNAME;
const PBI_PASSWORD = process.env.PBI_PASSWORD;

// Cache for Azure AD token
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get Azure AD access token using ROPC (master user) flow
 */
async function getAzureADToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${PBI_TENANT_ID}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: PBI_CLIENT_ID,
    client_secret: PBI_CLIENT_SECRET,
    username: PBI_USERNAME,
    password: PBI_PASSWORD,
    scope: 'https://analysis.windows.net/powerbi/api/.default',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    log.error('Azure AD token error:', error);
    throw new Error(`Azure AD auth failed: ${error.error_description || error.error}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;

  return cachedToken;
}

/**
 * GET /api/powerbi/embed-token
 * Generate embed token for a Power BI report
 * Query params: groupId (workspace ID), reportId
 */
router.get('/embed-token', authenticateToken, async (req, res) => {
  try {
    const { groupId, reportId } = req.query;

    if (!groupId || !reportId) {
      return res.status(400).json({ error: 'groupId and reportId are required' });
    }

    if (!PBI_CLIENT_ID || !PBI_TENANT_ID || !PBI_USERNAME || !PBI_PASSWORD) {
      return res.status(500).json({ error: 'Power BI credentials not configured' });
    }

    // 1. Get Azure AD token
    const accessToken = await getAzureADToken();

    // 2. Get report details
    const reportUrl = `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/reports/${reportId}`;
    const reportResponse = await fetch(reportUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!reportResponse.ok) {
      const err = await reportResponse.json();
      log.error('Power BI report fetch error:', err);
      return res.status(reportResponse.status).json({ error: err.error?.message || 'Failed to get report' });
    }

    const report = await reportResponse.json();

    // 3. Generate embed token
    const embedUrl = `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/reports/${reportId}/GenerateToken`;
    const embedResponse = await fetch(embedUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessLevel: 'View', allowSaveAs: false }),
    });

    if (!embedResponse.ok) {
      const err = await embedResponse.json();
      log.error('Power BI embed token error:', err);
      return res.status(embedResponse.status).json({ error: err.error?.message || 'Failed to generate embed token' });
    }

    const embedData = await embedResponse.json();

    res.json({
      success: true,
      embedToken: embedData.token,
      embedUrl: report.embedUrl,
      reportId: report.id,
      expiration: embedData.expiration,
    });
  } catch (error) {
    log.error('Power BI embed error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/powerbi/reports
 * List available reports in a workspace
 * Query params: groupId (workspace ID)
 */
router.get('/reports', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.query;

    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }

    const accessToken = await getAzureADToken();

    const reportsUrl = `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/reports`;
    const response = await fetch(reportsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Failed to list reports' });
    }

    const data = await response.json();

    res.json({
      success: true,
      reports: data.value.map((r) => ({
        id: r.id,
        name: r.name,
        embedUrl: r.embedUrl,
        datasetId: r.datasetId,
      })),
    });
  } catch (error) {
    log.error('Power BI list reports error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Dashboard Assignment CRUD (BPO Admin only)
// ============================================

/**
 * GET /api/powerbi/dashboards
 * List all dashboard assignments (admin) or only client's dashboards (client user)
 * Query params: clientId (optional, admin filter)
 */
router.get('/dashboards', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.query;
    const isAdmin = req.user.permissions.includes('admin_reports');

    const where = { isActive: true };

    if (isAdmin && clientId) {
      where.clientId = parseInt(clientId);
    } else if (!isAdmin) {
      where.clientId = req.user.clientId;
    }

    const dashboards = await prisma.powerBIDashboard.findMany({
      where,
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ clientId: 'asc' }, { name: 'asc' }],
    });

    res.json({ success: true, dashboards });
  } catch (error) {
    log.error('Error fetching Power BI dashboards:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/powerbi/dashboards
 * Assign a dashboard to a client (BPO Admin only)
 */
router.post('/dashboards', authenticateToken, requirePermission('admin_reports'), async (req, res) => {
  try {
    const { clientId, name, groupId, reportId } = req.body;

    if (!clientId || !name || !groupId || !reportId) {
      return res.status(400).json({ error: 'clientId, name, groupId, and reportId are required' });
    }

    const dashboard = await prisma.powerBIDashboard.create({
      data: {
        clientId: parseInt(clientId),
        name,
        groupId,
        reportId,
      },
      include: { client: { select: { id: true, name: true } } },
    });

    res.status(201).json({ success: true, dashboard });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'This report is already assigned to this client' });
    }
    log.error('Error creating Power BI dashboard assignment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/powerbi/dashboards/:id
 * Update a dashboard assignment (BPO Admin only)
 */
router.put('/dashboards/:id', authenticateToken, requirePermission('admin_reports'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, groupId, reportId, isActive } = req.body;

    const dashboard = await prisma.powerBIDashboard.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(groupId !== undefined && { groupId }),
        ...(reportId !== undefined && { reportId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { client: { select: { id: true, name: true } } },
    });

    res.json({ success: true, dashboard });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    log.error('Error updating Power BI dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/powerbi/dashboards/:id
 * Remove a dashboard assignment (BPO Admin only)
 */
router.delete('/dashboards/:id', authenticateToken, requirePermission('admin_reports'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.powerBIDashboard.delete({
      where: { id: parseInt(id) },
    });

    res.json({ success: true, message: 'Dashboard removed' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    log.error('Error deleting Power BI dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
