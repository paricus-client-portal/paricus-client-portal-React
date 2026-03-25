import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth-prisma.js';
import {
  getCallRecordings,
  getCallRecordingById,
  getAgentNames,
  getCallTypes,
  getTags,
  getCompanyNameFromTags,
  testConnection
} from '../services/mssql.js';
import { generateAudioDownloadUrl, isS3Configured } from '../services/s3.js';
import { prisma } from '../database/prisma.js';
import NodeCache from 'node-cache';
import log from '../utils/console-logger.js';

const router = express.Router();

// Cache for audio URLs (TTL: 50 minutes, slightly less than S3 URL expiration)
const audioUrlCache = new NodeCache({ stdTTL: 3000, checkperiod: 600 });

/**
 * Middleware to check if user has permission to access audio recordings
 * Allows both admin_audio_recordings and view_interactions permissions
 */
const checkAudioRecordingsPermission = (req, res, next) => {
  const hasAdminAccess = req.user.permissions?.includes('admin_audio_recordings');
  const hasViewAccess = req.user.permissions?.includes('view_interactions');

  if (!hasAdminAccess && !hasViewAccess) {
    return res.status(403).json({
      error: 'Permission denied. You need admin_audio_recordings or view_interactions permission.'
    });
  }
  next();
};

/**
 * Map clientId to company name for filtering audio recordings
 * This matches the client names in the database with the company tags in MSSQL
 */
async function getCompanyNameByClientId(clientId) {
  // BPO Admin has clientId = null, return null to see all companies
  if (clientId === null || clientId === undefined) {
    return null;
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true }
  });

  if (!client) return null;

  // Map client names to company filter names
  const clientNameMap = {
    'Flex Mobile': 'Flex Mobile',
    'IM Telecom': 'IM Telecom',
    'North American Local': 'Tempo Wireless',
    'BPO Administration': null // BPO Admin sees all
  };

  return clientNameMap[client.name] || null;
}

/**
 * Test SQL Server connection
 * GET /api/audio-recordings/test
 */
router.get('/test', authenticateToken, requirePermission('admin_audio_recordings'), async (req, res) => {
  try {
    // Debug: Log environment variables
    log.info('MSSQL Environment Variables:');
    log.info('MSSQL_SERVER:', process.env.MSSQL_SERVER);
    log.info('MSSQL_USER:', process.env.MSSQL_USER);
    log.info('MSSQL_PASSWORD:', process.env.MSSQL_PASSWORD ? '***SET***' : 'NOT SET');
    log.info('MSSQL_DATABASE:', process.env.MSSQL_DATABASE);
    log.info('MSSQL_PORT:', process.env.MSSQL_PORT);

    const result = await testConnection();
    res.json(result);
  } catch (error) {
    log.error('Error testing SQL Server connection:', error);
    res.status(500).json({
      error: 'Failed to test database connection',
      message: 'An internal error occurred'
    });
  }
});

/**
 * Get all call recordings with optional filters
 * GET /api/audio-recordings
 * Query params: page, limit, startDate, endDate, agentName, callType, customerPhone, interactionId
 */
router.get('/', authenticateToken, async (req, res) => {
  // Check if user has either admin_audio_recordings OR view_interactions permission
  const hasAdminAccess = req.user.permissions?.includes('admin_audio_recordings');
  const hasViewAccess = req.user.permissions?.includes('view_interactions');

  if (!hasAdminAccess && !hasViewAccess) {
    return res.status(403).json({ error: 'Permission denied. You need admin_audio_recordings or view_interactions permission.' });
  }
  const startTime = Date.now();
  log.info('[AUDIO-RECORDINGS] Request received');

  try {
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      agentName,
      callType,
      customerPhone,
      interactionId,
      company,
      hasAudio
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    log.info(`[AUDIO-RECORDINGS] Params: page=${pageNum}, limit=${limitNum}, offset=${offset}`);

    // Build filters object
    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (agentName) filters.agentName = agentName;
    if (callType) filters.callType = callType;
    if (customerPhone) filters.customerPhone = customerPhone;
    if (interactionId) filters.interactionId = interactionId;
    if (hasAudio !== undefined) filters.hasAudio = hasAudio;

    // SECURITY: If user is NOT BPO Admin, automatically filter by their company
    // BPO Admin has clientId = null and full access to see all companies
    const isBPOAdmin = req.user.clientId === null || req.user.clientId === undefined;

    if (!isBPOAdmin) {
      // Client Admin: automatically filter by their company
      const userCompany = await getCompanyNameByClientId(req.user.clientId);
      if (userCompany) {
        filters.company = userCompany;
        log.info(`[AUDIO-RECORDINGS] Auto-filtering by client company: ${userCompany} (clientId: ${req.user.clientId})`);
      } else {
        log.warn(`[AUDIO-RECORDINGS] No company mapping found for clientId: ${req.user.clientId}`);
      }
    } else if (company) {
      // BPO Admin can manually filter by company
      filters.company = company;
      log.info(`[AUDIO-RECORDINGS] BPO Admin manually filtering by company: ${company}`);
    }

    log.info('[AUDIO-RECORDINGS] Filters:', JSON.stringify(filters));
    log.info('[AUDIO-RECORDINGS] Querying SQL Server...');

    const queryStartTime = Date.now();
    const result = await getCallRecordings(filters, limitNum, offset);
    const queryDuration = Date.now() - queryStartTime;

    log.info(`[AUDIO-RECORDINGS] Query completed in ${queryDuration}ms, found ${result.recordings.length} recordings`);

    // Don't generate URLs upfront - send recordings without URLs for faster loading
    const recordings = result.recordings.map(recording => ({
      ...recording,
      customer_phone: recording.customer_phone_number, // Map to expected frontend field name
      company_name: getCompanyNameFromTags(recording.tags), // Add company name
      audioUrl: null, // Will be generated on-demand
      start_time: recording.start_time,
      end_time: recording.end_time
    }));

    const totalDuration = Date.now() - startTime;
    log.info(`[AUDIO-RECORDINGS] Total request time: ${totalDuration}ms`);

    res.json({
      recordings: recordings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount: result.totalCount,
        totalPages: Math.ceil(result.totalCount / limitNum)
      }
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    log.error(`[AUDIO-RECORDINGS] Error after ${totalDuration}ms:`, error);

    // Check if it's a configuration error
    if (error.message.includes('not configured')) {
      return res.status(503).json({
        error: 'Database not configured',
        message: 'SQL Server credentials are not set. Please configure MSSQL settings in .env'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch audio recordings',
      message: 'An internal error occurred'
    });
  }
});

/**
 * Get audio URL for a specific recording (on-demand with caching)
 * GET /api/audio-recordings/:interactionId/audio-url
 */
router.get('/:interactionId/audio-url', authenticateToken, checkAudioRecordingsPermission, async (req, res) => {
  try {
    const { interactionId } = req.params;

    // Check cache first
    const cacheKey = `audio_url_${interactionId}`;
    const cachedUrl = audioUrlCache.get(cacheKey);

    if (cachedUrl) {
      log.info(`[AUDIO-URL] Cache hit for ${interactionId}`);

      // Log audio playback access with IP address
      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

      log.info(`[AUDIO-PLAYBACK-LOG] Creating log entry for interactionId: ${interactionId}, userId: ${req.user.id}, IP: ${ipAddress}`);

      try {
        const logEntry = await prisma.log.create({
          data: {
            userId: req.user.id.toString(),
            eventType: 'AUDIO_PLAYBACK',
            entity: 'AudioRecording',
            description: `User accessed audio recording: ${interactionId}`,
            status: 'SUCCESS',
            ipAddress: ipAddress
          }
        });
        log.info(`[AUDIO-PLAYBACK-LOG] Log created successfully:`, logEntry.id);
      } catch (logError) {
        log.error('[AUDIO-PLAYBACK-LOG] Error creating log entry:', logError);
        // Don't fail the request if logging fails
      }

      return res.json({ audioUrl: cachedUrl });
    }

    log.info(`[AUDIO-URL] Cache miss for ${interactionId}, fetching from database...`);

    const recording = await getCallRecordingById(interactionId);

    if (!recording) {
      return res.status(404).json({
        error: 'Recording not found',
        message: `No recording found with interaction ID: ${interactionId}`
      });
    }

    if (!recording.audiofilename) {
      return res.status(404).json({
        error: 'Audio file not found',
        message: 'No audio file associated with this recording'
      });
    }

    // Generate pre-signed URL on-demand
    try {
      if (!isS3Configured()) {
        return res.status(503).json({
          error: 'Audio service unavailable',
          message: 'S3 storage is not configured. Audio playback requires AWS S3 credentials.'
        });
      }
      const audioUrl = await generateAudioDownloadUrl(recording.audiofilename);

      // Cache the URL for 50 minutes (slightly less than 1 hour expiration)
      audioUrlCache.set(cacheKey, audioUrl);

      // Log audio playback access with IP address
      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

      log.info(`[AUDIO-PLAYBACK-LOG] Creating log entry for interactionId: ${interactionId}, userId: ${req.user.id}, IP: ${ipAddress}`);

      try {
        const logEntry = await prisma.log.create({
          data: {
            userId: req.user.id.toString(),
            eventType: 'AUDIO_PLAYBACK',
            entity: 'AudioRecording',
            description: `User accessed audio recording: ${interactionId}`,
            status: 'SUCCESS',
            ipAddress: ipAddress
          }
        });
        log.info(`[AUDIO-PLAYBACK-LOG] Log created successfully:`, logEntry.id);
      } catch (logError) {
        log.error('[AUDIO-PLAYBACK-LOG] Error creating log entry:', logError);
        // Don't fail the request if logging fails
      }

      res.json({ audioUrl });
    } catch (error) {
      log.error(`Error generating URL for ${recording.audiofilename}:`, error);

      // Log failed attempt with IP address
      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

      try {
        await prisma.log.create({
          data: {
            userId: req.user.id.toString(),
            eventType: 'AUDIO_PLAYBACK',
            entity: 'AudioRecording',
            description: `Failed to access audio recording: ${interactionId} - ${error.message}`,
            status: 'FAILURE',
            ipAddress: ipAddress
          }
        });
      } catch (logError) {
        log.error('Error creating log entry:', logError);
      }

      res.status(500).json({
        error: 'Failed to generate audio URL',
        message: 'An internal error occurred'
      });
    }
  } catch (error) {
    log.error('Error generating audio URL:', error);
    res.status(500).json({
      error: 'Failed to generate audio URL',
      message: 'An internal error occurred'
    });
  }
});

/**
 * Get a single call recording by interaction ID
 * GET /api/audio-recordings/:interactionId
 */
router.get('/:interactionId', authenticateToken, checkAudioRecordingsPermission, async (req, res) => {
  try {
    const { interactionId } = req.params;

    const recording = await getCallRecordingById(interactionId);

    if (!recording) {
      return res.status(404).json({
        error: 'Recording not found',
        message: `No recording found with interaction ID: ${interactionId}`
      });
    }

    // Map field names for frontend
    recording.customer_phone = recording.customer_phone_number;
    recording.company_name = getCompanyNameFromTags(recording.tags);

    res.json({ data: recording });
  } catch (error) {
    log.error('Error fetching audio recording:', error);
    res.status(500).json({
      error: 'Failed to fetch audio recording',
      message: 'An internal error occurred'
    });
  }
});

/**
 * Get list of unique agent names
 * GET /api/audio-recordings/filters/agents
 */
router.get('/filters/agents', authenticateToken, checkAudioRecordingsPermission, async (req, res) => {
  try {
    const agents = await getAgentNames();
    res.json({ agents: agents });
  } catch (error) {
    log.error('Error fetching agent names:', error);
    res.status(500).json({
      error: 'Failed to fetch agent names',
      message: 'An internal error occurred'
    });
  }
});

/**
 * Get list of unique call types
 * GET /api/audio-recordings/filters/call-types
 */
router.get('/filters/call-types', authenticateToken, checkAudioRecordingsPermission, async (req, res) => {
  try {
    const callTypes = await getCallTypes();
    res.json({ callTypes: callTypes });
  } catch (error) {
    log.error('Error fetching call types:', error);
    res.status(500).json({
      error: 'Failed to fetch call types',
      message: 'An internal error occurred'
    });
  }
});

/**
 * Get list of unique tags
 * GET /api/audio-recordings/filters/tags
 */
router.get('/filters/tags', authenticateToken, checkAudioRecordingsPermission, async (req, res) => {
  try {
    const tags = await getTags();
    // Map to include company names
    const tagsWithCompanies = tags.map(tag => ({
      tag: tag,
      company_name: getCompanyNameFromTags(tag)
    }));
    res.json({ tags: tagsWithCompanies });
  } catch (error) {
    log.error('Error fetching tags:', error);
    res.status(500).json({
      error: 'Failed to fetch tags',
      message: 'An internal error occurred'
    });
  }
});

export default router;
