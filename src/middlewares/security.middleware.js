import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import hpp from 'hpp';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

// XSS Protection Middleware
export const xssProtection = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('XSS protection error', {
      error: error.message,
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    
    throw new ApiError(400, 'Invalid input detected');
  }
};

// Recursive function to sanitize nested objects
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key as well
      const cleanKey = typeof key === 'string' ? xss(key) : key;
      sanitized[cleanKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    // Apply XSS filtering
    return xss(obj, {
      whiteList: {}, // No HTML tags allowed by default
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script']
    });
  }

  return obj;
};

// NoSQL Injection Protection
export const noSQLInjectionProtection = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn('NoSQL injection attempt detected', {
      endpoint: req.originalUrl,
      method: req.method,
      suspiciousKey: key,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    });
  }
});

// HTTP Parameter Pollution Protection
export const parameterPollutionProtection = hpp({
  whitelist: [
    'category', 'tags', 'colors', 'sizes', // Allow arrays for these parameters
    'sort', 'fields'
  ]
});

// Content Security Policy Headers
export const contentSecurityPolicy = (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self' https://api.razorpay.com; " +
    "frame-src 'self' https://api.razorpay.com; " +
    "object-src 'none'; " +
    "base-uri 'self';"
  );
  next();
};

// Request Size Limiting
export const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      logger.warn('Request size limit exceeded', {
        contentLength,
        maxSize,
        endpoint: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(413).json({
        success: false,
        message: `Request size too large. Maximum allowed: ${maxSize}`
      });
    }

    next();
  };
};

// Helper function to parse size strings like '10mb', '500kb'
const parseSize = (size) => {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)$/);
  if (!match) {
    throw new Error('Invalid size format');
  }

  const [, number, unit] = match;
  return parseFloat(number) * units[unit];
};

// File Upload Security
export const fileUploadSecurity = (options = {}) => {
  const {
    allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ],
    maxFileSize = 5 * 1024 * 1024, // 5MB
    maxFiles = 10
  } = options;

  return (req, res, next) => {
    try {
      // Check if files exist
      const files = req.files || (req.file ? [req.file] : []);
      
      if (files.length === 0) {
        return next();
      }

      // Check number of files
      if (files.length > maxFiles) {
        throw new ApiError(400, `Maximum ${maxFiles} files allowed`);
      }

      // Validate each file
      for (const file of files) {
        // Check file size
        if (file.size > maxFileSize) {
          throw new ApiError(400, `File size exceeds limit of ${maxFileSize / (1024 * 1024)}MB`);
        }

        // Check MIME type
        if (!allowedMimeTypes.includes(file.mimetype)) {
          throw new ApiError(400, `File type ${file.mimetype} not allowed`);
        }

        // Check for suspicious file names
        if (file.originalname && /[<>:"/\\|?*]/.test(file.originalname)) {
          throw new ApiError(400, 'Invalid file name');
        }

        // Additional security checks for images
        if (file.mimetype.startsWith('image/')) {
          // Check for embedded scripts in image files
          if (file.buffer && file.buffer.includes('<script')) {
            logger.warn('Suspicious image file detected', {
              filename: file.originalname,
              mimetype: file.mimetype,
              ip: req.ip,
              userId: req.user?.id
            });
            throw new ApiError(400, 'Invalid image file');
          }
        }
      }

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error('File upload security error', {
        error: error.message,
        endpoint: req.originalUrl,
        ip: req.ip
      });

      throw new ApiError(400, 'File validation failed');
    }
  };
};

// IP Whitelist/Blacklist Middleware
export const ipFilter = (options = {}) => {
  const { whitelist = [], blacklist = [] } = options;

  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    // Check blacklist first
    if (blacklist.length > 0 && blacklist.includes(clientIP)) {
      logger.warn('Blocked IP attempted access', {
        ip: clientIP,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent')
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check whitelist if configured
    if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
      logger.warn('Non-whitelisted IP attempted access', {
        ip: clientIP,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent')
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    next();
  };
};

// Request ID Middleware for tracking
export const requestId = (req, res, next) => {
  req.id = Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Security Headers Middleware
export const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filtering
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Comprehensive security middleware stack
export const applySecurity = [
  requestId,
  securityHeaders,
  contentSecurityPolicy,
  noSQLInjectionProtection,
  xssProtection,
  parameterPollutionProtection,
  requestSizeLimit('10mb')
];