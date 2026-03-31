import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth-prisma.js';
import { prisma } from '../database/prisma.js';
import { body, param, validationResult } from 'express-validator';
import {
  listClientFolders,
  listClientReports,
  generateClientReportKey,
  generateUploadUrl,
  generateDownloadUrl,
  getBucketName,
  deleteS3Object,
  isS3Configured
} from '../services/s3.js';
import { localFileExists, readLocalFile } from '../services/local-storage.js';
import config from '../config/environment.js';
import log from '../utils/console-logger.js';

const router = express.Router();

// Configure multer for file uploads (memory storage for S3)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/reports/client-folders
 * List all client folders in S3 (Admin only)
 */
router.get('/client-folders', async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.permissions?.includes('admin_clients')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const folders = await listClientFolders();

    res.json({
      success: true,
      folders: folders,
      bucket: getBucketName()
    });
  } catch (error) {
    log.error('Error listing client folders:', error);
    res.status(500).json({
      error: 'Failed to list client folders',
    });
  }
});

/**
 * GET /api/reports/client/:clientFolder
 * List reports for a specific client folder
 */
router.get('/client/:clientFolder', [
  param('clientFolder').matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Client folder must contain only letters, numbers, hyphens, and underscores')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clientFolder } = req.params;

    // Check permissions: Admin can see all, clients need view_reporting permission and can only see their assigned folders
    if (!req.user.permissions?.includes('admin_clients')) {
      // Check if user has permission to view reports
      if (!req.user.permissions?.includes('view_reporting')) {
        return res.status(403).json({ error: 'Permission denied. You need view_reporting permission to access reports.' });
      }
      // For client users, check if they have access to this specific folder
      const folderAccess = await prisma.clientFolderAccess.findFirst({
        where: {
          clientId: req.user.clientId,
          folderName: clientFolder
        }
      });

      if (!folderAccess) {
        return res.status(403).json({ error: 'Access denied to this client folder' });
      }
    }

    const reports = await listClientReports(clientFolder);
    
    // Generate download URLs for each report
    const reportsWithUrls = await Promise.all(
      reports.map(async (report) => {
        try {
          const downloadUrl = await generateDownloadUrl(report.key);
          return { ...report, downloadUrl };
        } catch (error) {
          log.error(`Error generating URL for ${report.key}:`, error);
          return { ...report, downloadUrl: null };
        }
      })
    );

    res.json({
      success: true,
      clientFolder,
      reports: reportsWithUrls
    });
  } catch (error) {
    log.error('Error listing client reports:', error);
    res.status(500).json({
      error: 'Failed to list client reports',
    });
  }
});

/**
 * POST /api/reports/upload/:clientFolder
 * Upload a PDF report for a specific client (Admin only)
 */
router.post('/upload/:clientFolder', [
  param('clientFolder').matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Client folder must contain only letters, numbers, hyphens, and underscores'),
  body('reportName').optional().isString().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 })
], upload.single('file'), async (req, res) => {
  try {
    // Check admin permission (upload requires admin_reports)
    if (!req.user.permissions?.includes('admin_reports')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { clientFolder } = req.params;
    const { reportName, description } = req.body;

    // Generate S3 key
    const originalName = req.file.originalname;
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fileName = reportName ? `${reportName}_${timestamp}.pdf` : originalName;
    const s3Key = generateClientReportKey(clientFolder, fileName);

    // Generate upload URL
    const uploadUrl = await generateUploadUrl(s3Key, 'application/pdf');

    // Upload file to S3 using the presigned URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: req.file.buffer,
      headers: {
        'Content-Type': 'application/pdf',
      },
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file to S3');
    }

    // Find client by folder access mapping
    const folderAccess = await prisma.clientFolderAccess.findFirst({
      where: {
        folderName: clientFolder
      },
      include: {
        client: true
      }
    });

    if (!folderAccess) {
      return res.status(400).json({
        error: 'No client assigned to this folder. Please assign a client to this folder first.'
      });
    }

    // Save report metadata to database
    const report = await prisma.report.create({
      data: {
        clientId: folderAccess.client.id,
        name: reportName || originalName.replace('.pdf', ''),
        description: description || null,
        type: 'client-report',
        s3Key: s3Key,
        s3Bucket: getBucketName(),
        fileSize: req.file.size,
        mimeType: 'application/pdf',
        generatedAt: new Date(),
      }
    });

    res.json({
      success: true,
      message: 'Report uploaded successfully',
      report: {
        id: report.id,
        name: report.name,
        s3Key: s3Key,
        clientFolder: clientFolder,
        fileSize: req.file.size,
        uploadedAt: report.createdAt
      }
    });

  } catch (error) {
    log.error('Error uploading report:', error);
    res.status(500).json({
      error: 'Failed to upload report',
    });
  }
});

/**
 * GET /api/reports/download/:clientFolder/:fileName
 * Generate download URL for a specific report
 */
router.get('/download/:clientFolder/:fileName', [
  param('clientFolder').matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Client folder must contain only letters, numbers, hyphens, and underscores'),
  param('fileName').isString().withMessage('File name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clientFolder, fileName } = req.params;

    // Check permissions (same logic as listing reports)
    if (!req.user.permissions?.includes('admin_clients')) {
      // Check if user has permission to view reports
      if (!req.user.permissions?.includes('view_reporting')) {
        return res.status(403).json({ error: 'Permission denied. You need view_reporting permission to download reports.' });
      }
      const folderAccess = await prisma.clientFolderAccess.findFirst({
        where: {
          clientId: req.user.clientId,
          folderName: clientFolder
        }
      });

      if (!folderAccess) {
        return res.status(403).json({ error: 'Access denied to this client folder' });
      }
    }

    // Get the actual reports to find the correct key
    const reports = await listClientReports(clientFolder);
    const report = reports.find(r => r.name === fileName || r.key.endsWith(fileName));

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // If S3 is configured, generate presigned URL; otherwise serve from local storage
    if (isS3Configured()) {
      const downloadUrl = await generateDownloadUrl(report.key);
      res.json({
        success: true,
        downloadUrl: downloadUrl,
        expiresIn: 3600
      });
    } else {
      const exists = await localFileExists(report.key);
      if (!exists) {
        return res.status(404).json({ error: 'Report file not found on disk' });
      }
      const fileBuffer = await readLocalFile(report.key);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.send(fileBuffer);
    }

  } catch (error) {
    log.error('Error generating download URL:', error);
    res.status(500).json({
      error: 'Failed to generate download URL',
    });
  }
});

/**
 * DELETE /api/reports/:clientFolder/:fileName
 * Delete a report (Admin only)
 */
router.delete('/:clientFolder/:fileName', [
  param('clientFolder').matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Client folder must contain only letters, numbers, hyphens, and underscores'),
  param('fileName').isString().withMessage('File name is required')
], async (req, res) => {
  try {
    // Check admin permission (delete requires admin_reports)
    if (!req.user.permissions?.includes('admin_reports')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clientFolder, fileName } = req.params;

    // Get the actual reports to find the correct S3 key
    const reports = await listClientReports(clientFolder);
    const report = reports.find(r => r.name === fileName || r.key.endsWith(fileName));

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Delete from S3
    await deleteS3Object(report.key);

    // Also remove from database if it exists
    await prisma.report.deleteMany({
      where: {
        s3Key: report.key
      }
    });

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });

  } catch (error) {
    log.error('Error deleting report:', error);
    res.status(500).json({
      error: 'Failed to delete report',
    });
  }
});

/**
 * GET /api/reports/client-folder-access
 * Get client folder access mappings (Admin only)
 */
router.get('/client-folder-access', async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.permissions?.includes('admin_reports')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const clientFolderAccess = await prisma.clientFolderAccess.findMany({
      include: {
        client: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      success: true,
      data: clientFolderAccess
    });
  } catch (error) {
    log.error('Error fetching client folder access:', error);
    res.status(500).json({
      error: 'Failed to fetch client folder access',
    });
  }
});

/**
 * POST /api/reports/client-folder-access
 * Assign folder access to a client (Admin only)
 */
router.post('/client-folder-access', [
  body('clientId').isInt().withMessage('Client ID must be an integer'),
  body('folderName').matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Folder name must contain only letters, numbers, hyphens, and underscores')
], async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.permissions?.includes('admin_reports')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clientId, folderName } = req.body;

    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Create folder access (ignore if already exists)
    const folderAccess = await prisma.clientFolderAccess.upsert({
      where: {
        clientId_folderName: {
          clientId: clientId,
          folderName: folderName
        }
      },
      update: {},
      create: {
        clientId: clientId,
        folderName: folderName
      }
    });

    res.json({
      success: true,
      message: 'Folder access granted successfully',
      data: folderAccess
    });

  } catch (error) {
    log.error('Error granting folder access:', error);
    res.status(500).json({
      error: 'Failed to grant folder access',
    });
  }
});

/**
 * DELETE /api/reports/client-folder-access/:clientId/:folderName
 * Remove folder access from a client (Admin only)
 */
router.delete('/client-folder-access/:clientId/:folderName', [
  param('clientId').isInt().withMessage('Client ID must be an integer'),
  param('folderName').matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Folder name must contain only letters, numbers, hyphens, and underscores')
], async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.permissions?.includes('admin_reports')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clientId, folderName } = req.params;

    await prisma.clientFolderAccess.delete({
      where: {
        clientId_folderName: {
          clientId: parseInt(clientId),
          folderName: folderName
        }
      }
    });

    res.json({
      success: true,
      message: 'Folder access removed successfully'
    });

  } catch (error) {
    log.error('Error removing folder access:', error);
    res.status(500).json({
      error: 'Failed to remove folder access',
    });
  }
});

/**
 * GET /api/reports/client-folders-accessible
 * Get folders accessible to the current client user
 */
router.get('/client-folders-accessible', async (req, res) => {
  try {
    // Check if user has permission to view reports
    if (!req.user.permissions?.includes('view_reporting') && !req.user.permissions?.includes('admin_reports')) {
      return res.status(403).json({ error: 'Permission denied. You need view_reporting permission to access reports.' });
    }

    // Get accessible folders for this client
    const clientFolderAccess = await prisma.clientFolderAccess.findMany({
      where: {
        clientId: req.user.clientId
      },
      select: {
        folderName: true
      }
    });

    const accessibleFolders = clientFolderAccess.map(access => access.folderName);

    res.json({
      success: true,
      folders: accessibleFolders
    });
  } catch (error) {
    log.error('Error fetching accessible folders:', error);
    res.status(500).json({
      error: 'Failed to fetch accessible folders',
    });
  }
});

export default router;