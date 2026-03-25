import crypto from 'crypto';
import { authenticateToken } from './auth-prisma.js';
import log from '../utils/console-logger.js';

// In-memory store for CSRF tokens (in production, use Redis or similar)
const csrfTokens = new Map();

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now > data.expires) {
      csrfTokens.delete(token);
    }
  }
}, 3600000);

export const generateCSRFToken = (req, res, next) => {
  // Generate a cryptographically secure random token
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  // Store token with user association and expiration
  csrfTokens.set(token, {
    userId: req.user?.id || null,
    sessionId: req.sessionID || req.ip,
    expires,
    created: Date.now()
  });
  
  // Add token to response headers
  res.setHeader('X-CSRF-Token', token);
  
  // Also add to response body if JSON
  const originalJson = res.json;
  res.json = function(data) {
    if (typeof data === 'object' && data !== null) {
      data.csrfToken = token;
    }
    return originalJson.call(this, data);
  };
  
  next();
};

export const validateCSRFToken = (req, res, next) => {
  // Skip CSRF validation for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for JWT-authenticated endpoints (token sent via Authorization header, not cookies)
  // Note: req.path is relative to the mount point (e.g. app.use('/api/admin', ...))
  // so we check both relative and absolute paths
  const skipPaths = [
    '/api/auth/login',
    '/api/errors',
    '/roles',        // JWT protected (relative when mounted at /api/admin)
    '/users',        // JWT protected
    '/clients',      // JWT protected
    '/permissions',  // JWT protected
  ];
  if (skipPaths.some(path => req.path.startsWith(path) || req.originalUrl.startsWith(path))) {
    return next();
  }

  // Get token from header or body
  const token = req.headers['x-csrf-token'] || req.body.csrfToken;

  if (!token) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'CSRF token is required for this request'
    });
  }

  // Validate token
  const tokenData = csrfTokens.get(token);

  if (!tokenData) {
    // Token not found - generate a new one and send it back
    log.debug('CSRF token not found, generating new one');
    const newToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    csrfTokens.set(newToken, {
      userId: req.user?.id || null,
      sessionId: req.sessionID || req.ip,
      expires,
      created: Date.now()
    });

    res.setHeader('X-CSRF-Token', newToken);

    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token is invalid or expired',
      csrfToken: newToken
    });
  }

  // Check if token is expired
  if (Date.now() > tokenData.expires) {
    csrfTokens.delete(token);

    // Generate new token
    const newToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (24 * 60 * 60 * 1000);

    csrfTokens.set(newToken, {
      userId: req.user?.id || null,
      sessionId: req.sessionID || req.ip,
      expires,
      created: Date.now()
    });

    res.setHeader('X-CSRF-Token', newToken);

    return res.status(403).json({
      error: 'CSRF token expired',
      message: 'CSRF token has expired, please refresh and try again',
      csrfToken: newToken
    });
  }

  // For authenticated requests, only check user match if userId was set when token was created
  if (req.user && tokenData.userId && req.user.id !== tokenData.userId) {
    log.warn('CSRF user mismatch detected');
    return res.status(403).json({
      error: 'CSRF token mismatch',
      message: 'CSRF token does not match current user'
    });
  }

  next();
};

// Get CSRF token endpoint
export const getCSRFToken = [
  authenticateToken,
  generateCSRFToken,
  (req, res) => {
    res.json({
      message: 'CSRF token generated',
      token: res.getHeader('X-CSRF-Token')
    });
  }
];

// Middleware to add CSRF token to safe requests
export const addCSRFToken = [
  authenticateToken,
  generateCSRFToken
];