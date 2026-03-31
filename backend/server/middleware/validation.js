import { body, param, query, validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';

// Common validation rules
export const commonValidations = {
  id: param('id').isInt({ min: 1 }).withMessage('Invalid ID format'),
  
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
    
  password: body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
  name: (field) => body(field)
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage(`${field} must be 1-255 characters long`)
    .matches(/^[\p{L}\p{N}\s\-_.]+$/u)
    .withMessage(`${field} contains invalid characters`),

  optionalName: (field) => body(field)
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage(`${field} must be 1-255 characters long`)
    .matches(/^[\p{L}\p{N}\s\-_.]+$/u)
    .withMessage(`${field} contains invalid characters`),
    
  clientId: body('clientId')
    .isInt({ min: 1 })
    .withMessage('Valid client ID is required'),

  roleId: body('roleId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Valid role ID is required'),
    
  boolean: (field) => body(field)
    .isBoolean()
    .withMessage(`${field} must be a boolean value`)
};

// Validation middleware
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * Normalize snake_case body fields to camelCase
 * Ensures frontend can send either format
 */
export const normalizeBody = (req, res, next) => {
  const map = {
    client_id: 'clientId',
    role_id: 'roleId',
    first_name: 'firstName',
    last_name: 'lastName',
  };
  for (const [snake, camel] of Object.entries(map)) {
    if (req.body[snake] !== undefined && req.body[camel] === undefined) {
      req.body[camel] = req.body[snake];
    }
  }
  next();
};

// Sanitization middleware
export const sanitizeInput = (fields = []) => {
  return (req, res, next) => {
    fields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        // Remove potentially dangerous HTML/JS
        req.body[field] = DOMPurify.sanitize(req.body[field], { 
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [] 
        });
        
        // Trim whitespace
        req.body[field] = req.body[field].trim();
      }
    });
    next();
  };
};

// Specific validation rules for different endpoints
export const userValidation = {
  create: [
    commonValidations.clientId,
    commonValidations.email,
    commonValidations.name('firstName'),
    commonValidations.name('lastName'),
    commonValidations.roleId,
    commonValidations.password,
    validateRequest
  ],
  
  update: [
    commonValidations.id,
    commonValidations.optionalName('firstName'),
    commonValidations.optionalName('lastName'),
    body('roleId').optional().isInt({ min: 1 }).withMessage('Valid role ID is required'),
    body('clientId').optional().isInt({ min: 1 }).withMessage('Valid client ID is required'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
    validateRequest
  ]
};

export const clientValidation = {
  create: [
    commonValidations.name('name'),
    commonValidations.boolean('isProspect'),
    validateRequest
  ],
  
  update: [
    commonValidations.id,
    commonValidations.name('name'),
    commonValidations.boolean('isActive'),
    commonValidations.boolean('isProspect'),
    validateRequest
  ]
};

export const roleValidation = {
  create: [
    commonValidations.clientId,
    commonValidations.name('roleName'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description too long'),
    body('permissionIds').isArray().withMessage('Permission IDs must be an array'),
    validateRequest
  ],
  
  update: [
    commonValidations.id,
    commonValidations.optionalName('roleName'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description too long'),
    body('clientId').optional().isInt({ min: 1 }).withMessage('Valid client ID is required'),
    validateRequest
  ],
  
  permissions: [
    commonValidations.id,
    body('permissions').isArray().withMessage('Permissions must be an array'),
    body('permissions.*').isInt({ min: 1 }).withMessage('Each permission must be a valid ID'),
    validateRequest
  ]
};

export const authValidation = {
  login: [
    commonValidations.email,
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest
  ],
  
  forgotPassword: [
    commonValidations.email,
    validateRequest
  ],
  
  verifyCode: [
    body('code')
      .notEmpty().withMessage('Reset code is required')
      .isLength({ min: 6, max: 6 }).withMessage('Code must be 6 characters'),
    validateRequest
  ],

  resetPassword: [
    body('token').notEmpty().withMessage('Reset token is required'),
    commonValidations.password,
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
    validateRequest
  ]
};

// ID parameter validation
export const validateId = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ID'),
  validateRequest
];

// Query parameter validation
export const validateClientQuery = [
  query('clientId').optional().isInt({ min: 1 }).withMessage('Invalid client ID'),
  validateRequest
];