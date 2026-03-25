import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { authenticateToken, requirePermission } from '../middleware/auth-prisma.js';
import { prisma } from '../database/prisma.js';
import { logCarouselSave, logCarouselDelete } from '../services/logger.js';
import log from '../utils/console-logger.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '../uploads/carousel');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer config for carousel images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /^image\/(jpeg|png|gif|webp)$/;
    if (allowedTypes.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPG, PNG, GIF, WEBP).'));
    }
  }
});

/**
 * Flexible token auth (header or query param) for serving files in <img src>
 */
function authenticateTokenFlexible(req, res, next) {
  try {
    let token = req.query.token;
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = {
        userId: decoded.userId,
        clientId: decoded.clientId,
        roleId: decoded.roleId,
        permissions: decoded.permissions || []
      };
      next();
    });
  } catch (error) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// ========================================
// GET CAROUSEL IMAGES (client-aware with fallback)
// ========================================
router.get(
  '/',
  authenticateToken,
  async (req, res) => {
    try {
      const { clientId: queryClientId } = req.query;
      const userClientId = req.user.clientId;
      const isAdmin = req.user.permissions.includes('admin_dashboard_config');

      let images;

      if (isAdmin && queryClientId === undefined) {
        // BPO Admin with no client filter → return ALL images
        images = await prisma.carouselImage.findMany({
          orderBy: [{ clientId: 'asc' }, { slotIndex: 'asc' }]
        });
      } else if (isAdmin && queryClientId !== undefined) {
        // BPO Admin filtering by specific client
        const targetClientId = queryClientId === 'null' ? null : parseInt(queryClientId);

        if (targetClientId !== null) {
          const clientImages = await prisma.carouselImage.findMany({
            where: { clientId: targetClientId },
            orderBy: { slotIndex: 'asc' }
          });
          images = clientImages.length > 0
            ? clientImages
            : await prisma.carouselImage.findMany({ where: { clientId: null }, orderBy: { slotIndex: 'asc' } });
        } else {
          images = await prisma.carouselImage.findMany({
            where: { clientId: null },
            orderBy: { slotIndex: 'asc' }
          });
        }
      } else {
        // Regular user → their own client's images, fallback to global
        const clientImages = await prisma.carouselImage.findMany({
          where: { clientId: userClientId },
          orderBy: { slotIndex: 'asc' }
        });
        images = clientImages.length > 0
          ? clientImages
          : await prisma.carouselImage.findMany({ where: { clientId: null }, orderBy: { slotIndex: 'asc' } });
      }

      const imagesWithUrls = images.map(img => ({
        ...img,
        url: `/api/carousel/${img.id}/file`
      }));

      res.json({ success: true, data: imagesWithUrls });
    } catch (error) {
      log.error('❌ Error fetching carousel images:', error);
      res.status(500).json({ success: false, error: 'Error fetching carousel images' });
    }
  }
);

// ========================================
// SAVE CAROUSEL IMAGES (upsert per slot)
// ========================================
router.post(
  '/',
  authenticateToken,
  requirePermission('admin_dashboard_config'),
  upload.array('images', 4),
  async (req, res) => {
    try {
      const files = req.files || [];
      const slotIndices = req.body.slotIndices;
      const { clientId } = req.body;

      // Parse clientId: "null" or empty → null (global), otherwise integer
      const targetClientId = (!clientId || clientId === 'null' || clientId === '')
        ? null
        : parseInt(clientId);

      if (files.length === 0) {
        return res.status(400).json({ success: false, error: 'No images uploaded' });
      }

      // Parse slot indices — can be a string or array
      const slots = Array.isArray(slotIndices)
        ? slotIndices.map(Number)
        : [Number(slotIndices)];

      if (files.length !== slots.length) {
        // Clean up uploaded files
        files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
        return res.status(400).json({ success: false, error: 'Mismatch between files and slot indices' });
      }

      const results = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const slotIndex = slots[i];

        if (slotIndex < 0 || slotIndex > 3) {
          continue;
        }

        // Check if there's an existing image in this client+slot
        // findUnique doesn't support null in composite keys, use findFirst for global
        const existing = targetClientId !== null
          ? await prisma.carouselImage.findUnique({
              where: { clientId_slotIndex: { clientId: targetClientId, slotIndex } }
            })
          : await prisma.carouselImage.findFirst({
              where: { clientId: null, slotIndex }
            });

        // Delete old file from disk if replacing
        if (existing) {
          const oldPath = path.join(UPLOAD_DIR, existing.filePath);
          if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch {}
          }
          await prisma.carouselImage.delete({ where: { id: existing.id } });
        }

        // Create new record
        const record = await prisma.carouselImage.create({
          data: {
            clientId: targetClientId,
            slotIndex,
            fileName: file.originalname,
            filePath: file.filename,
            mimeType: file.mimetype,
            fileSize: file.size,
          }
        });

        results.push({ ...record, url: `/api/carousel/${record.id}/file` });
      }

      await logCarouselSave(req.user.id, results.length, targetClientId);

      res.status(201).json({
        success: true,
        message: `${results.length} carousel image(s) saved`,
        data: results
      });
    } catch (error) {
      log.error('❌ Error saving carousel images:', error);
      // Clean up uploaded files on error
      if (req.files) {
        req.files.forEach(f => {
          if (fs.existsSync(f.path)) { try { fs.unlinkSync(f.path); } catch {} }
        });
      }
      res.status(500).json({ success: false, error: 'Error saving carousel images' });
    }
  }
);

// ========================================
// SERVE CAROUSEL IMAGE FILE
// ========================================
router.get(
  '/:id/file',
  authenticateTokenFlexible,
  async (req, res) => {
    try {
      const { id } = req.params;

      const image = await prisma.carouselImage.findUnique({
        where: { id: parseInt(id) }
      });

      if (!image) {
        return res.status(404).json({ success: false, error: 'Image not found' });
      }

      const filePath = path.join(UPLOAD_DIR, image.filePath);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'File not found on disk' });
      }

      res.setHeader('Content-Type', image.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${image.fileName}"`);
      res.sendFile(filePath);
    } catch (error) {
      log.error('❌ Error serving carousel image:', error);
      res.status(500).json({ success: false, error: 'Error serving image' });
    }
  }
);

// ========================================
// DELETE CAROUSEL IMAGE
// ========================================
router.delete(
  '/:id',
  authenticateToken,
  requirePermission('admin_dashboard_config'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const image = await prisma.carouselImage.findUnique({
        where: { id: parseInt(id) }
      });

      if (!image) {
        return res.status(404).json({ success: false, error: 'Image not found' });
      }

      // Delete file from disk
      const filePath = path.join(UPLOAD_DIR, image.filePath);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }

      await prisma.carouselImage.delete({ where: { id: parseInt(id) } });

      await logCarouselDelete(req.user.id, parseInt(id));

      res.json({ success: true, message: 'Carousel image deleted' });
    } catch (error) {
      log.error('❌ Error deleting carousel image:', error);
      res.status(500).json({ success: false, error: 'Error deleting image' });
    }
  }
);

export default router;
