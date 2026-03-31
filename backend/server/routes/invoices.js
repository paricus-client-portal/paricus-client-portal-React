import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth-prisma.js';
import { prisma } from '../database/prisma.js';
import { body, param, validationResult } from 'express-validator';
import {
  listClientFolders,
  listClientInvoices,
  generateClientInvoiceKey,
  generateUploadUrl,
  generateDownloadUrl,
  getBucketName,
  deleteS3Object,
  getS3ObjectMetadata,
  setS3ObjectMetadata
} from '../services/s3.js';
import {
  logInvoiceCreate,
  logInvoiceUpdate,
  logInvoiceDelete
} from '../services/logger.js';
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
 * GET /api/invoices/client-folders
 * List all client folders (Admin only)
 */
router.get('/client-folders', async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.permissions?.includes('admin_invoices')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get folders from ClientFolderAccess table (database)
    const clientFolderAccess = await prisma.clientFolderAccess.findMany({
      select: {
        folderName: true,
        client: {
          select: {
            name: true,
            isActive: true
          }
        }
      },
      where: {
        client: {
          isActive: true
        }
      }
    });

    const folders = clientFolderAccess.map(access => access.folderName);

    res.json({
      success: true,
      folders: folders,
      bucket: getBucketName()
    });
  } catch (error) {
    log.error('Error listing client folders:', error);
    res.status(500).json({
      error: 'Failed to list client folders',
      message: 'An internal error occurred'
    });
  }
});

/**
 * GET /api/invoices/client/:clientFolder
 * List invoices for a specific client folder
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

    // Get client by folder access
    const folderAccess = await prisma.clientFolderAccess.findFirst({
      where: { folderName: clientFolder }
    });

    if (!folderAccess) {
      return res.status(404).json({ error: 'Client folder not found' });
    }

    // SECURITY: Check permissions - Admin can see all, clients need view_invoices permission and can ONLY see their assigned folders
    if (!req.user.permissions?.includes('admin_invoices')) {
      // Check if user has permission to view invoices
      if (!req.user.permissions?.includes('view_invoices')) {
        return res.status(403).json({ error: 'Permission denied. You need view_invoices permission to access invoices.' });
      }
      // CRITICAL: Clients can ONLY access their own client's folder
      if (folderAccess.clientId !== req.user.clientId) {
        log.warn(`SECURITY: User ${req.user.id} (clientId: ${req.user.clientId}) attempted to access folder for clientId: ${folderAccess.clientId}`);
        return res.status(403).json({ error: 'Access denied to this client folder' });
      }
    }

    // Get invoices from database
    const invoices = await prisma.invoice.findMany({
      where: { clientId: folderAccess.clientId },
      orderBy: { createdAt: 'desc' }
    });

    // Generate download URLs for each invoice
    const invoicesWithUrls = await Promise.all(
      invoices.map(async (invoice) => {
        try {
          const downloadUrl = await generateDownloadUrl(invoice.s3Key);
          return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            title: invoice.title,
            description: invoice.description,
            amount: invoice.amount,
            currency: invoice.currency,
            status: invoice.status,
            dueDate: invoice.dueDate,
            issuedDate: invoice.issuedDate,
            paidDate: invoice.paidDate,
            fileName: invoice.s3Key.split('/').pop(),
            size: invoice.fileSize,
            lastModified: invoice.updatedAt,
            folder: clientFolder,
            key: invoice.s3Key,
            paymentLink: invoice.paymentLink,
            downloadUrl
          };
        } catch (error) {
          log.error(`Error generating URL for ${invoice.s3Key}:`, error);
          return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            title: invoice.title,
            description: invoice.description,
            amount: invoice.amount,
            currency: invoice.currency,
            status: invoice.status,
            dueDate: invoice.dueDate,
            issuedDate: invoice.issuedDate,
            paidDate: invoice.paidDate,
            fileName: invoice.s3Key.split('/').pop(),
            size: invoice.fileSize,
            lastModified: invoice.updatedAt,
            folder: clientFolder,
            key: invoice.s3Key,
            paymentLink: invoice.paymentLink,
            downloadUrl: null
          };
        }
      })
    );

    res.json({
      success: true,
      clientFolder,
      invoices: invoicesWithUrls
    });
  } catch (error) {
    log.error('Error listing client invoices:', error);
    res.status(500).json({
      error: 'Failed to list client invoices',
      message: 'An internal error occurred'
    });
  }
});

/**
 * POST /api/invoices/upload/:clientFolder
 * Upload a PDF invoice for a specific client (Admin only)
 */
router.post('/upload/:clientFolder',
  upload.single('file'),
  [
    param('clientFolder').matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Client folder must contain only letters, numbers, hyphens, and underscores'),
    body('invoiceName').isString().isLength({ min: 1, max: 100 }).withMessage('Invoice name is required (1-100 characters)'),
    body('description').optional().isString().isLength({ max: 500 }),
    body('amount').isString().notEmpty().withMessage('Amount is required'),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3-letter code'),
    body('status').optional().isIn(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled']).withMessage('Invalid status'),
    body('dueDate').isString().notEmpty().withMessage('Due date is required'),
    body('issuedDate').isString().notEmpty().withMessage('Issued date is required'),
    body('paymentMethod').optional().isString().isLength({ max: 50 }).withMessage('Payment method must be max 50 characters')
  ],
  async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.permissions?.includes('admin_invoices')) {
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
    const {
      invoiceName,
      description,
      amount,
      currency,
      status,
      dueDate,
      issuedDate,
      paymentMethod
    } = req.body;

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Get client by folder access
    const folderAccess = await prisma.clientFolderAccess.findFirst({
      where: { folderName: clientFolder }
    });

    if (!folderAccess) {
      return res.status(404).json({ error: 'Client folder not found' });
    }

    // Validate dates
    const parsedDueDate = new Date(dueDate);
    const parsedIssuedDate = new Date(issuedDate);

    if (isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ error: 'Invalid due date' });
    }

    if (isNaN(parsedIssuedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid issued date' });
    }

    if (parsedDueDate < parsedIssuedDate) {
      return res.status(400).json({ error: 'Due date cannot be before issued date' });
    }

    // Generate S3 key
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fileName = `${invoiceName}_${timestamp}.pdf`;
    const s3Key = generateClientInvoiceKey(clientFolder, fileName);

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

    // Create database record
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const invoice = await prisma.invoice.create({
      data: {
        clientId: folderAccess.clientId,
        invoiceNumber: invoiceNumber,
        title: invoiceName,
        description: description || null,
        amount: parsedAmount,
        currency: currency || 'USD',
        status: status || 'sent',
        dueDate: parsedDueDate,
        issuedDate: parsedIssuedDate,
        paymentMethod: paymentMethod || null,
        s3Key: s3Key,
        s3Bucket: getBucketName(),
        fileSize: req.file.size,
        mimeType: 'application/pdf'
      },
      include: {
        client: {
          select: { name: true }
        }
      }
    });

    // Log invoice creation with IP address
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    await logInvoiceCreate(req.user.id, invoiceNumber, invoice.client.name, ipAddress);

    res.json({
      success: true,
      message: 'Invoice uploaded successfully',
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        fileName: fileName,
        s3Key: s3Key,
        bucket: getBucketName(),
        size: req.file.size,
        clientFolder: clientFolder
      }
    });
  } catch (error) {
    log.error('Error uploading invoice:', error);
    res.status(500).json({
      error: 'Failed to upload invoice',
      message: 'An internal error occurred'
    });
  }
});

/**
 * GET /api/invoices/download/:clientFolder/:fileName
 * Generate download URL for invoice PDF
 */
router.get('/download/:clientFolder/:fileName', [
  param('clientFolder').matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Invalid client folder'),
  param('fileName').matches(/^[a-zA-Z0-9\-_\.]+\.pdf$/).withMessage('Invalid file name')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clientFolder, fileName } = req.params;

    // Check permissions: Admin can download all, clients need view_invoices permission and access to folder
    if (!req.user.permissions?.includes('admin_invoices')) {
      // Check if user has permission to view invoices
      if (!req.user.permissions?.includes('view_invoices')) {
        return res.status(403).json({ error: 'Permission denied. You need view_invoices permission.' });
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

    // Generate S3 key for the file
    const currentYear = new Date().getFullYear();
    const s3Key = `client-access-reports/${clientFolder}/invoices/${currentYear}/${fileName}`;

    const downloadUrl = await generateDownloadUrl(s3Key);

    res.json({
      success: true,
      downloadUrl: downloadUrl,
      expiresIn: 3600 // 1 hour
    });
  } catch (error) {
    log.error('Error generating download URL:', error);
    res.status(500).json({
      error: 'Failed to generate download URL',
      message: 'An internal error occurred'
    });
  }
});

/**
 * DELETE /api/invoices/delete/:invoiceId
 * Delete invoice file (Admin only)
 */
router.delete('/delete/:invoiceId', [
  param('invoiceId').isInt().withMessage('Valid invoice ID required')
], async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.permissions?.includes('admin_invoices')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const invoiceId = parseInt(req.params.invoiceId);

    // Get invoice from database
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Delete from S3
    await deleteS3Object(invoice.s3Key);

    // Delete from database
    await prisma.invoice.delete({
      where: { id: invoiceId }
    });

    // Log invoice deletion
    await logInvoiceDelete(req.user.id, invoice.invoiceNumber);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting invoice:', error);
    res.status(500).json({
      error: 'Failed to delete invoice',
      message: 'An internal error occurred'
    });
  }
});

/**
 * PUT /api/invoices/:invoiceId
 * Update invoice details (Admin only)
 */
router.put('/:invoiceId', [
  param('invoiceId').isInt().withMessage('Valid invoice ID required'),
  body('title').optional().isString().isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description must be max 1000 characters'),
  body('amount').optional().isNumeric().withMessage('Amount must be a valid number'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3-letter code'),
  body('status').optional().isIn(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled']).withMessage('Invalid status'),
  body('dueDate').optional().isISO8601().withMessage('Due date must be valid date'),
  body('issuedDate').optional().isISO8601().withMessage('Issued date must be valid date'),
  body('paidDate').optional().isISO8601().withMessage('Paid date must be valid date'),
  body('paymentMethod').optional({ nullable: true }).isString().isLength({ max: 50 }).withMessage('Payment method must be max 50 characters'),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 1000 }).withMessage('Notes must be max 1000 characters')
], async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.permissions?.includes('admin_invoices')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const invoiceId = parseInt(req.params.invoiceId);
    const updates = req.body;

    // Verify invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!existingInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Business logic validations
    if (updates.status === 'paid' && !updates.paidDate && !existingInvoice.paidDate) {
      updates.paidDate = new Date();
    }

    if (updates.status !== 'paid' && updates.paidDate) {
      return res.status(400).json({ error: 'Cannot set paid date for unpaid invoice' });
    }

    if (updates.dueDate && updates.issuedDate) {
      if (new Date(updates.dueDate) < new Date(updates.issuedDate)) {
        return res.status(400).json({ error: 'Due date cannot be before issued date' });
      }
    }

    // Update invoice
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updates
    });

    // Log invoice update
    const changesDescription = Object.keys(updates).join(', ');
    await logInvoiceUpdate(req.user.id, invoice.invoiceNumber, changesDescription);

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        title: invoice.title,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.dueDate,
        issuedDate: invoice.issuedDate,
        paidDate: invoice.paidDate,
        paymentMethod: invoice.paymentMethod
      }
    });
  } catch (error) {
    log.error('Error updating invoice:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.status(500).json({
      error: 'Failed to update invoice',
      message: 'An internal error occurred'
    });
  }
});

/**
 * PUT /api/invoices/payment-link/:invoiceId
 * Set payment link for an invoice (Admin only)
 */
router.put('/payment-link/:invoiceId', [
  param('invoiceId').isInt().withMessage('Valid invoice ID required'),
  body('paymentLink').isURL().withMessage('Valid payment link URL required')
], async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.permissions?.includes('admin_invoices')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const invoiceId = parseInt(req.params.invoiceId);
    const { paymentLink } = req.body;

    // Update invoice in database
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { paymentLink }
    });

    res.json({
      success: true,
      message: 'Payment link updated successfully',
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        paymentLink: invoice.paymentLink
      }
    });
  } catch (error) {
    log.error('Error updating payment link:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Invoice not found',
        message: 'The specified invoice does not exist'
      });
    }

    res.status(500).json({
      error: 'Failed to update payment link',
      message: 'An internal error occurred'
    });
  }
});

/**
 * GET /api/invoices/stats/:clientFolder
 * Get accounts receivable statistics for a specific client (Admin only)
 */
router.get('/stats/:clientFolder', [
  param('clientFolder').matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Invalid client folder')
], async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.permissions?.includes('admin_invoices')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { clientFolder } = req.params;

    // Get client by folder access
    const folderAccess = await prisma.clientFolderAccess.findFirst({
      where: { folderName: clientFolder }
    });

    if (!folderAccess) {
      return res.status(404).json({ error: 'Client folder not found' });
    }

    // Get all invoices for this client
    const invoices = await prisma.invoice.findMany({
      where: { clientId: folderAccess.clientId },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date();

    // Calculate statistics
    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const unpaidInvoices = invoices.filter(inv => ['draft', 'sent', 'viewed', 'overdue'].includes(inv.status));
    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue' || (inv.dueDate < now && inv.status !== 'paid'));

    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const outstandingBalance = unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    // Last payment date
    const lastPayment = paidInvoices.length > 0
      ? paidInvoices.sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate))[0].paidDate
      : null;

    // Average payment time (days from issued to paid)
    const avgPaymentTime = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, inv) => {
          const issued = new Date(inv.issuedDate);
          const paid = new Date(inv.paidDate);
          return sum + Math.floor((paid - issued) / (1000 * 60 * 60 * 24));
        }, 0) / paidInvoices.length
      : 0;

    res.json({
      success: true,
      clientFolder,
      stats: {
        totalInvoices,
        totalRevenue,
        outstandingBalance,
        overdueAmount,
        paidCount: paidInvoices.length,
        unpaidCount: unpaidInvoices.length,
        overdueCount: overdueInvoices.length,
        lastPaymentDate: lastPayment,
        avgPaymentTime: Math.round(avgPaymentTime),
        currency: invoices[0]?.currency || 'USD'
      }
    });
  } catch (error) {
    log.error('Error fetching AR stats:', error);
    res.status(500).json({
      error: 'Failed to fetch AR statistics',
      message: 'An internal error occurred'
    });
  }
});

/**
 * GET /api/invoices/stats
 * Get accounts receivable statistics for client's own invoices (READ ONLY)
 */
router.get('/stats', async (req, res) => {
  try {
    // SECURITY: Clients can ONLY view their own stats, not modify
    if (!req.user.permissions?.includes('view_invoices')) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // SECURITY: Query limited to user's own clientId
    const invoices = await prisma.invoice.findMany({
      where: { clientId: req.user.clientId },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date();

    // Calculate client-side statistics
    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const unpaidInvoices = invoices.filter(inv => ['draft', 'sent', 'viewed', 'overdue'].includes(inv.status));

    const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const outstandingBalance = unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    // Next payment due
    const upcomingInvoices = unpaidInvoices
      .filter(inv => inv.dueDate >= now)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const nextPaymentDue = upcomingInvoices.length > 0
      ? {
          invoiceNumber: upcomingInvoices[0].invoiceNumber,
          amount: upcomingInvoices[0].amount,
          dueDate: upcomingInvoices[0].dueDate
        }
      : null;

    res.json({
      success: true,
      stats: {
        totalInvoices,
        totalPaid,
        outstandingBalance,
        paidCount: paidInvoices.length,
        unpaidCount: unpaidInvoices.length,
        nextPaymentDue,
        currency: invoices[0]?.currency || 'USD'
      }
    });
  } catch (error) {
    log.error('Error fetching client AR stats:', error);
    res.status(500).json({
      error: 'Failed to fetch AR statistics',
      message: 'An internal error occurred'
    });
  }
});

/**
 * GET /api/invoices
 * Get client's own invoices (for client users) or redirect to client-folders (for admin)
 */
router.get('/', async (req, res) => {
  try {
    // Check permissions
    const hasAdminAccess = req.user.permissions?.includes('admin_invoices');
    const hasViewAccess = req.user.permissions?.includes('view_invoices');

    if (!hasAdminAccess && !hasViewAccess) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    if (hasAdminAccess) {
      // Admin: redirect to use client-folders endpoint
      return res.json({
        success: true,
        message: 'Use /api/invoices/client-folders to list all client folders',
        invoices: []
      });
    } else {
      // Client: get their assigned folder and return invoices
      const folderAccess = await prisma.clientFolderAccess.findFirst({
        where: {
          clientId: req.user.clientId
        }
      });

      if (!folderAccess) {
        return res.json({
          success: true,
          invoices: [],
          stats: null,
          message: 'No folder assigned to your client'
        });
      }

      // Get invoices from database
      const invoices = await prisma.invoice.findMany({
        where: { clientId: req.user.clientId },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate statistics for the client
      const now = new Date();
      const totalInvoices = invoices.length;
      const paidInvoices = invoices.filter(inv => inv.status === 'paid');
      const unpaidInvoices = invoices.filter(inv => ['draft', 'sent', 'viewed', 'overdue'].includes(inv.status));

      const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
      const outstandingBalance = unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

      // Next payment due
      const upcomingInvoices = unpaidInvoices
        .filter(inv => inv.dueDate >= now)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

      const nextPaymentDue = upcomingInvoices.length > 0
        ? {
            invoiceNumber: upcomingInvoices[0].invoiceNumber,
            amount: upcomingInvoices[0].amount,
            dueDate: upcomingInvoices[0].dueDate
          }
        : null;

      const stats = {
        totalInvoices,
        totalPaid,
        outstandingBalance,
        paidCount: paidInvoices.length,
        unpaidCount: unpaidInvoices.length,
        nextPaymentDue,
        currency: invoices[0]?.currency || 'USD'
      };

      // Generate download URLs for each invoice
      const invoicesWithUrls = await Promise.all(
        invoices.map(async (invoice) => {
          try {
            const downloadUrl = await generateDownloadUrl(invoice.s3Key);
            return {
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              title: invoice.title,
              description: invoice.description,
              amount: invoice.amount,
              currency: invoice.currency,
              status: invoice.status,
              dueDate: invoice.dueDate,
              issuedDate: invoice.issuedDate,
              paidDate: invoice.paidDate,
              fileName: invoice.s3Key.split('/').pop(),
              size: invoice.fileSize,
              lastModified: invoice.updatedAt,
              folder: folderAccess.folderName,
              key: invoice.s3Key,
              paymentLink: invoice.paymentLink,
              downloadUrl
            };
          } catch (error) {
            log.error(`Error generating URL for ${invoice.s3Key}:`, error);
            return {
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              title: invoice.title,
              fileName: invoice.s3Key.split('/').pop(),
              size: invoice.fileSize,
              lastModified: invoice.updatedAt,
              folder: folderAccess.folderName,
              key: invoice.s3Key,
              paymentLink: invoice.paymentLink,
              downloadUrl: null
            };
          }
        })
      );

      res.json({
        success: true,
        invoices: invoicesWithUrls,
        stats: stats,
        clientFolder: folderAccess.folderName
      });
    }
  } catch (error) {
    log.error('Error fetching invoices:', error);
    res.status(500).json({
      error: 'Failed to fetch invoices',
      message: 'An internal error occurred'
    });
  }
});

export default router;