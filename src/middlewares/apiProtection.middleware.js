import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import redisClient from '../config/redis.js';

// API Key validation middleware
export const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.get('X-API-Key') || req.query.apiKey;
    
    if (!apiKey) {
      throw new ApiError(401, 'API key is required');
    }

    // Validate API key format
    if (!/^[a-zA-Z0-9]{32,64}$/.test(apiKey)) {
      throw new ApiError(401, 'Invalid API key format');
    }

    // Check if API key exists and is active (in production, check against database)
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    
    if (!validApiKeys.includes(apiKey)) {
      logger.warn('Invalid API key used', {
        apiKey: apiKey.substring(0, 8) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });
      
      throw new ApiError(401, 'Invalid API key');
    }

    // Log API key usage
    logger.info('API key used', {
      apiKey: apiKey.substring(0, 8) + '...',
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    req.apiKey = apiKey;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error('API key validation error', { error: error.message });
    throw new ApiError(500, 'API key validation failed');
  }
};

// Request signature validation for webhooks
export const validateSignature = (secret) => {
  return (req, res, next) => {
    try {
      const signature = req.get('X-Signature') || req.get('X-Hub-Signature-256');
      
      if (!signature) {
        throw new ApiError(401, 'Request signature is required');
      }

      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody || JSON.stringify(req.body))
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');

      if (!crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      )) {
        logger.warn('Invalid webhook signature', {
          endpoint: req.originalUrl,
          ip: req.ip,
          providedSignature: providedSignature.substring(0, 8) + '...'
        });
        
        throw new ApiError(401, 'Invalid request signature');
      }

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      logger.error('Signature validation error', { error: error.message });
      throw new ApiError(500, 'Signature validation failed');
    }
  };
};

// Request timeout middleware
export const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          endpoint: req.originalUrl,
          method: req.method,
          timeout: timeoutMs,
          ip: req.ip,
          userId: req.user?.id
        });

        res.status(408).json({
          success: false,
          message: 'Request timeout',
          timeout: timeoutMs
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    const originalSend = res.send;
    res.send = function(data) {
      clearTimeout(timeout);
      originalSend.call(this, data);
    };

    next();
  };
};

// Request size monitoring
export const monitorRequestSize = (req, res, next) => {
  const contentLength = parseInt(req.get('Content-Length') || '0');
  
  if (contentLength > 0) {
    logger.debug('Request size', {
      endpoint: req.originalUrl,
      method: req.method,
      size: contentLength,
      userId: req.user?.id
    });

    // Log large requests
    if (contentLength > 1024 * 1024) { // 1MB
      logger.warn('Large request detected', {
        endpoint: req.originalUrl,
        method: req.method,
        size: contentLength,
        ip: req.ip,
        userId: req.user?.id
      });
    }
  }

  next();
};

// Suspicious activity detection
export const detectSuspiciousActivity = async (req, res, next) => {
  try {
    const redis = redisClient.getClient();
    if (!redis) {
      return next();
    }

    const clientId = req.user?.id || req.ip;
    const key = `suspicious:${clientId}`;
    
    // Track various suspicious patterns
    const suspiciousPatterns = [
      // SQL injection attempts
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/i,
      // XSS attempts
      /<script[^>]*>.*?<\/script>/gi,
      // Path traversal
      /\.\.[\/\\]/,
      // Command injection
      /[;&|`$()]/
    ];

    const requestData = JSON.stringify({
      url: req.originalUrl,
      body: req.body,
      query: req.query,
      headers: req.headers
    });

    let suspiciousScore = 0;
    const detectedPatterns = [];

    suspiciousPatterns.forEach((pattern, index) => {
      if (pattern.test(requestData)) {
        suspiciousScore += 1;
        detectedPatterns.push(index);
      }
    });

    // Check for rapid requests from same IP
    const requestCount = await redis.incr(`requests:${req.ip}`);
    await redis.expire(`requests:${req.ip}`, 60); // 1 minute window

    if (requestCount > 100) { // More than 100 requests per minute
      suspiciousScore += 2;
      detectedPatterns.push('rapid_requests');
    }

    // Check for unusual user agent patterns
    const userAgent = req.get('User-Agent') || '';
    if (!userAgent || userAgent.length < 10 || /bot|crawler|spider/i.test(userAgent)) {
      suspiciousScore += 1;
      detectedPatterns.push('suspicious_user_agent');
    }

    if (suspiciousScore > 0) {
      // Increment suspicious activity counter
      const totalSuspicious = await redis.incr(key);
      await redis.expire(key, 3600); // 1 hour

      logger.warn('Suspicious activity detected', {
        clientId,
        score: suspiciousScore,
        totalSuspicious,
        patterns: detectedPatterns,
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent
      });

      // Block if too many suspicious activities
      if (totalSuspicious > 10) {
        logger.error('Client blocked due to suspicious activity', {
          clientId,
          totalSuspicious,
          ip: req.ip
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied due to suspicious activity'
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Suspicious activity detection error', { error: error.message });
    next(); // Continue on error
  }
};

// Geolocation-based access control
export const geolocationFilter = (options = {}) => {
  const { allowedCountries = [], blockedCountries = [] } = options;

  return async (req, res, next) => {
    try {
      // In production, you would use a geolocation service
      // For now, we'll use a simple IP-based check
      const clientIP = req.ip;
      
      // Mock geolocation check (replace with actual service)
      const country = await getCountryFromIP(clientIP);
      
      if (blockedCountries.length > 0 && blockedCountries.includes(country)) {
        logger.warn('Access blocked by geolocation', {
          ip: clientIP,
          country,
          endpoint: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          message: 'Access not allowed from your location'
        });
      }

      if (allowedCountries.length > 0 && !allowedCountries.includes(country)) {
        logger.warn('Access denied by geolocation whitelist', {
          ip: clientIP,
          country,
          endpoint: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          message: 'Access not allowed from your location'
        });
      }

      req.clientCountry = country;
      next();
    } catch (error) {
      logger.error('Geolocation filter error', { error: error.message });
      next(); // Continue on error
    }
  };
};

// Mock geolocation function (replace with actual service)
const getCountryFromIP = async (ip) => {
  // This is a mock implementation
  // In production, use services like MaxMind, IPinfo, or similar
  if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return 'LOCAL';
  }
  return 'US'; // Default for testing
};

// Request correlation ID middleware
export const correlationId = (req, res, next) => {
  const correlationId = req.get('X-Correlation-ID') || 
                       req.get('X-Request-ID') || 
                       generateCorrelationId();
  
  req.correlationId = correlationId;
  res.set('X-Correlation-ID', correlationId);
  
  // Add to logger context
  req.logContext = { correlationId };
  
  next();
};

const generateCorrelationId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// API versioning middleware
export const apiVersioning = (req, res, next) => {
  const version = req.get('API-Version') || 
                 req.query.version || 
                 req.params.version || 
                 'v1';

  // Validate version format
  if (!/^v\d+(\.\d+)?$/.test(version)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid API version format'
    });
  }

  req.apiVersion = version;
  res.set('API-Version', version);
  
  next();
};

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    correlationId: req.correlationId,
    userId: req.user?.id,
    apiVersion: req.apiVersion
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      correlationId: req.correlationId,
      userId: req.user?.id
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};