import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth-prisma.js';
import log from '../utils/console-logger.js';

const router = express.Router();

// Store errors in memory for now (in production, use a proper logging service)
const errorStore = new Map();

// POST /api/errors - Log client-side errors
router.post('/', [
  authenticateToken,
  body('message').isString().isLength({ max: 1000 }).withMessage('Message must be a string'),
  body('stack').optional().isString().isLength({ max: 10000 }).withMessage('Stack trace too long'),
  body('timestamp').isISO8601().withMessage('Invalid timestamp'),
  body('url').isURL().withMessage('Invalid URL'),
  body('userAgent').isString().isLength({ max: 500 }).withMessage('User agent too long'),
  body('context').optional().isObject().withMessage('Context must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message, stack, timestamp, url, userAgent, context } = req.body;
    
    const errorReport = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      message,
      stack,
      timestamp,
      url,
      userAgent,
      userId: req.user?.id,
      clientId: req.user?.clientId,
      context,
      serverTimestamp: new Date().toISOString()
    };

    // Store error (in production, send to monitoring service)
    errorStore.set(errorReport.id, errorReport);
    
    // Keep only last 1000 errors in memory
    if (errorStore.size > 1000) {
      const firstKey = errorStore.keys().next().value;
      errorStore.delete(firstKey);
    }

    // Log error to console for development
    if (process.env.NODE_ENV !== 'production') {
      log.error('Client Error Report:', errorReport);
    }

    res.status(201).json({ message: 'Error logged successfully' });
  } catch (error) {
    log.error('Error logging error:', error);
    res.status(500).json({ error: 'Failed to log error' });
  }
});

// GET /api/errors - Get recent errors (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check if user has admin permissions
    if (!req.user?.permissions?.includes('admin_clients')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const errors = Array.from(errorStore.values())
      .sort((a, b) => new Date(b.serverTimestamp) - new Date(a.serverTimestamp))
      .slice(0, limit);

    res.json({ errors });
  } catch (error) {
    log.error('Get errors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/errors - Clear error logs (admin only)
router.delete('/', authenticateToken, async (req, res) => {
  try {
    // Check if user has admin permissions
    if (!req.user?.permissions?.includes('admin_clients')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    errorStore.clear();
    res.json({ message: 'Error logs cleared' });
  } catch (error) {
    log.error('Clear errors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;