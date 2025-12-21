import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

/* -------------------------------------------------------------------------- */
/* ✅ RATE LIMIT HANDLER                                                      */
/* -------------------------------------------------------------------------- */

const rateLimitHandler = (req, res) => {
  const clientInfo = {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    endpoint: req.originalUrl,
    method: req.method,
    userId: req.user?.id || 'guest'
  };

  logger.warn('Rate limit exceeded', clientInfo);

  res.set({
    'X-RateLimit-Limit': req.rateLimit?.limit,
    'X-RateLimit-Remaining': 0,
    'X-RateLimit-Reset': new Date(Date.now() + (req.rateLimit?.resetTime || 60000))
  });

  return res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later.',
    retryAfter: Math.ceil((req.rateLimit?.resetTime || 60000) / 1000)
  });
};

/* -------------------------------------------------------------------------- */
/* ✅ SKIP FUNCTION (For Whitelisted or Health Routes)                        */
/* -------------------------------------------------------------------------- */

const skipRateLimit = (req) => {
  const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];

  if (req.path === '/health' || req.path === '/active') return true;
  if (whitelist.includes(req.ip)) return true;

  return false;
};

/* -------------------------------------------------------------------------- */
/* ✅ PREDEFINED LIMITERS                                                     */
/* -------------------------------------------------------------------------- */

// General limiter (for most endpoints)
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  keyGenerator: (req) => req.user?.id || req.ip
});

// Authentication limiter
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `auth:${req.ip}:${req.body?.email || req.body?.username || 'unknown'}`
});

// Password reset limiter
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => `pwd_reset:${req.ip}:${req.body?.email || 'unknown'}`
});

// File upload limiter
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => `upload:${req.user?.id || req.ip}`
});

// Search limiter
export const searchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => `search:${req.user?.id || req.ip}`
});

// Order limiter
export const orderRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => `order:${req.user?.id || req.ip}`
});

// Review limiter
export const reviewRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => `review:${req.user?.id || req.ip}`
});

// Burst protection
export const burstProtection = rateLimit({
  windowMs: 1000, // 1 second
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => `burst:${req.user?.id || req.ip}`
});

/* -------------------------------------------------------------------------- */
/* ✅ ROLE-BASED DYNAMIC LIMITER                                             */
/* -------------------------------------------------------------------------- */

export const dynamicRateLimit = (options = {}) => {
  const {
    customer = { windowMs: 15 * 60 * 1000, max: 100 },
    seller = { windowMs: 15 * 60 * 1000, max: 500 },
    admin = { windowMs: 15 * 60 * 1000, max: 1000 },
    superadmin = { windowMs: 15 * 60 * 1000, max: 5000 }
  } = options;

  return (req, res, next) => {
    const role = req.user?.role || 'customer';
    const config = { customer, seller, admin, superadmin }[role] || customer;

    const limiter = rateLimit({
      ...config,
      standardHeaders: true,
      legacyHeaders: false,
      handler: rateLimitHandler,
      keyGenerator: (req) => `role:${role}:${req.user?.id || req.ip}`
    });

    return limiter(req, res, next);
  };
};

/* -------------------------------------------------------------------------- */
/* ✅ UNIVERSAL DYNAMIC MIDDLEWARE EXPORT (MAIN FIX)                          */
/* -------------------------------------------------------------------------- */

export const rateLimitMiddleware = (type, options = {}) => {
  const limiters = {
    general: generalRateLimit,
    auth: authRateLimit,
    passwordReset: passwordResetRateLimit,
    upload: uploadRateLimit,
    search: searchRateLimit,
    order: orderRateLimit,
    review: reviewRateLimit,
    burst: burstProtection
  };

  // Use a predefined limiter if one exists
  if (limiters[type]) return limiters[type];

  // Otherwise create one dynamically
  return rateLimit({
    ...options,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${type}:${req.user?.id || req.ip}`
  });
};
