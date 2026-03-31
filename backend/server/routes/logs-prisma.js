import express from 'express';
import { prisma } from '../database/prisma.js';
import { authenticateToken, requirePermission } from '../middleware/auth-prisma.js';
import log from '../utils/console-logger.js';

const router = express.Router();

/**
 * GET /api/logs
 * Get all logs (Super Admin only)
 */
router.get('/',
  authenticateToken,
  async (req, res) => {
    try {
      // Check if user has admin permissions (from JWT)
      const isBPOAdmin = req.user.permissions?.includes('admin_clients');
      log.error('DEBUG LOGS - userId:', req.user.id, 'permissions:', req.user.permissions, 'isBPOAdmin:', isBPOAdmin);

      if (!isBPOAdmin) {
        return res.status(403).json({
          error: 'Access denied. Only BPO administrators can view logs.'
        });
      }

      log.debug('[LOGS API] Access GRANTED');

      const {
        page = 1,
        limit = 10,
        sortBy = 'timestamp',
        sortOrder = 'desc',
        search = '',
        eventType = '',
        entity = '',
        status = ''
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build where clause for filtering
      const where = {};

      // Search across multiple fields
      if (search) {
        where.OR = [
          { id: { contains: search } },
          { userId: { contains: search } },
          { description: { contains: search } },
          { entity: { contains: search } },
          { eventType: { contains: search } },
          { status: { contains: search } },
          { ipAddress: { contains: search } },
        ];
      }

      // Filter by eventType
      if (eventType) {
        where.eventType = eventType;
      }

      // Filter by entity
      if (entity) {
        where.entity = entity;
      }

      // Filter by status
      if (status) {
        where.status = status;
      }

      log.debug('[LOGS API] Query params:', { page, limit, sortBy, sortOrder });

      // Get total count
      const totalCount = await prisma.log.count({ where });

      log.debug('[LOGS API] Total count:', totalCount);

      // Get logs with pagination
      const logs = await prisma.log.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: {
          [sortBy]: sortOrder.toLowerCase()
        }
      });

      log.debug('[LOGS API] Returning', logs.length, 'logs');

      res.json({
        logs: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      });

    } catch (error) {
      log.error('Error fetching logs:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  }
);

/**
 * GET /api/logs/:id
 * Get a specific log by ID (Super Admin only)
 */
router.get('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const isBPOAdmin = req.user.permissions?.includes('admin_clients');

      if (!isBPOAdmin) {
        return res.status(403).json({
          error: 'Access denied. Only BPO administrators can view logs.'
        });
      }

      const { id } = req.params;

      const log = await prisma.log.findUnique({
        where: { id }
      });

      if (!log) {
        return res.status(404).json({ error: 'Log not found' });
      }

      res.json({ data: log });

    } catch (error) {
      log.error('Error fetching log:', error);
      res.status(500).json({ error: 'Failed to fetch log' });
    }
  }
);

/**
 * POST /api/logs
 * Create a new log entry
 */
router.post('/',
  authenticateToken,
  async (req, res) => {
    try {
      const { userId, eventType, entity, description, status = 'SUCCESS', ipAddress } = req.body;

      // Validate required fields
      if (!userId || !eventType || !entity || !description) {
        return res.status(400).json({
          error: 'Missing required fields: userId, eventType, entity, description'
        });
      }

      // Get IP address from request if not provided
      let logIpAddress = ipAddress || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

      // Clean IPv6-mapped IPv4 addresses (::ffff:192.168.1.1 -> 192.168.1.1)
      if (logIpAddress && logIpAddress.startsWith('::ffff:')) {
        logIpAddress = logIpAddress.replace('::ffff:', '');
      }

      const log = await prisma.log.create({
        data: {
          userId,
          eventType,
          entity,
          description,
          status,
          ipAddress: logIpAddress
        }
      });

      res.status(201).json({ data: log });

    } catch (error) {
      log.error('Error creating log:', error);
      res.status(500).json({ error: 'Failed to create log' });
    }
  }
);

/**
 * DELETE /api/logs/:id
 * Delete a log entry (Super Admin only)
 */
router.delete('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const isBPOAdmin = req.user.permissions?.includes('admin_clients');

      if (!isBPOAdmin) {
        return res.status(403).json({
          error: 'Access denied. Only BPO administrators can delete logs.'
        });
      }

      const { id } = req.params;

      await prisma.log.delete({
        where: { id }
      });

      res.json({ message: 'Log deleted successfully' });

    } catch (error) {
      log.error('Error deleting log:', error);
      res.status(500).json({ error: 'Failed to delete log' });
    }
  }
);

export default router;
