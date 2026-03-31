import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import environment configuration
import config from './config/environment.js';

// Import routes
import authRoutes from './routes/auth-prisma.js';
import adminRoutes from './routes/admin-prisma.js';
import errorRoutes from './routes/errors.js';
import reportsRoutes from './routes/reports.js';
import invoicesRoutes from './routes/invoices.js';
import audioRecordingsRoutes from './routes/audio-recordings.js';
import logsRoutes from './routes/logs-prisma.js';
import ticketsRoutes from './routes/tickets.js';
import dashboardRoutes from './routes/dashboard-prisma.js';
import carouselRoutes from './routes/carousel.js';

// Import security middleware
import { validateCSRFToken, getCSRFToken } from './middleware/csrf.js';

// Import centralized logger
import log from './utils/console-logger.js';

// Import database
import { initializePrisma, disconnectPrisma } from './database/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = config.port;

// CORS Configuration - Must be FIRST
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Obtener orígenes permitidos desde la configuración
    const allowedOrigins = config.clientUrl.split(',').map(url => url.trim());

    if (allowedOrigins.indexOf(origin) !== -1 || config.isDevelopment) {
      callback(null, true);
    } else {
      log.info('❌ CORS blocked origin:', origin);
      log.info('   Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600, // Cache preflight for 10 minutes
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Request logging removed for security

// Enhanced security middleware
app.use(helmet({
  contentSecurityPolicy: config.isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  } : false, // Disable CSP in development to avoid CORS issues
  crossOriginEmbedderPolicy: false, // Allow embedding for development
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: config.isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false, // Disable HSTS in development
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// Additional security headers (only in production to avoid CORS conflicts)
if (config.isProduction) {
  app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Permissions policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
  });
}

// Enhanced rate limiting with different tiers
const createRateLimiter = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// General API rate limiting - disabled for development
const generalLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.round(config.security.rateLimitWindowMs / 1000)
    });
  }
});
app.use('/api', generalLimiter);

// Authentication rate limiting (stricter) - very high limit for development
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.security.authRateLimitMax,
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: Math.round((15 * 60 * 1000) / 1000)
    });
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/profile/password', authLimiter);

// Admin endpoints rate limiting (moderate)
const adminLimiter = createRateLimiter(
  5 * 60 * 1000, // 5 minutes
  50,
  'Too many admin requests, please slow down.'
);
app.use('/api/admin', adminLimiter);

// Error reporting rate limiting
const errorLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  10,
  'Too many error reports, please slow down.'
);
app.use('/api/errors', errorLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CSRF Protection (apply to state-changing operations)
app.use('/api/admin', validateCSRFToken);

// CSRF token endpoint
app.get('/api/csrf-token', getCSRFToken);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/errors', errorRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/audio-recordings', audioRecordingsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/carousel', carouselRoutes);

// S3 test endpoint
app.get('/api/s3-test', async (req, res) => {
  try {
    const { generateUploadUrl, getBucketName } = await import('./services/s3.js');
    const testKey = `test/connection-test-${Date.now()}.txt`;
    const uploadUrl = await generateUploadUrl(testKey, 'text/plain');
    
    res.json({
      success: true,
      message: 'S3 connection successful',
    });
  } catch (error) {
    log.error('S3 test failed:', error);
    res.status(500).json({
      success: false,
      message: 'S3 connection failed',
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (config.isProduction) {
  app.use(express.static(join(__dirname, '../dist')));

  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error details
  log.error('Server Error:', {
    message: err.message,
    url: req.url,
    method: req.method,
  });

  // Don't leak error details in production
  const isDevelopment = config.isDevelopment;
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      message: isDevelopment ? err.message : 'Invalid input data'
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Database connection failed'
    });
  }

  // Generic error response
  res.status(err.status || 500).json({ 
    error: 'Something went wrong!',
    message: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializePrisma();
    log.info('Database initialized successfully');

    app.listen(PORT, () => {
      log.info('SERVER STARTED SUCCESSFULLY');
    });
  } catch (error) {
    log.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  log.info('Shutting down gracefully...');
  await disconnectPrisma();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log.info('Shutting down gracefully...');
  await disconnectPrisma();
  process.exit(0);
});

startServer();