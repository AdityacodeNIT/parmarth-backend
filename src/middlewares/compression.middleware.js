import compression from 'compression';
import zlib from 'zlib'; //  Added to fix constants issue
import crypto from 'crypto'; //  ES module import for ETag generation
import logger from '../utils/logger.js';

// Enhanced compression middleware with intelligent compression
export const intelligentCompression = compression({
  // Compression level (1-9, where 9 is best compression but slowest)
  level: parseInt(process.env.COMPRESSION_LEVEL) || 6,

  // Minimum response size to compress (in bytes)
  threshold: parseInt(process.env.COMPRESSION_THRESHOLD) || 1024,

  // Custom filter function to determine what to compress
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (!compression.filter(req, res)) {
      return false;
    }

    // Don't compress images, videos, or already compressed files
    const contentType = res.getHeader('Content-Type') || '';
    const skipTypes = [
      'image/',
      'video/',
      'audio/',
      'application/zip',
      'application/gzip',
      'application/x-rar-compressed',
      'application/pdf'
    ];

    if (skipTypes.some(type => contentType.includes(type))) {
      return false;
    }

    // Don't compress small responses
    const contentLength = res.getHeader('Content-Length');
    if (contentLength && parseInt(contentLength) < 1024) {
      return false;
    }

    // Compress text-based content
    const compressTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/rss+xml',
      'application/atom+xml'
    ];

    return compressTypes.some(type => contentType.includes(type));
  },

  //  Fixed: Use zlib.constants instead of compression.constants
  strategy:
    process.env.NODE_ENV === 'production'
      ? zlib.constants.Z_DEFAULT_STRATEGY
      : zlib.constants.Z_HUFFMAN_ONLY
});

// Response optimization middleware
export const responseOptimization = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  const originalJson = res.json;

  // Override res.send to add optimization
  res.send = function (data) {
    const responseTime = Date.now() - startTime;

    // Add performance headers
    res.set({
      'X-Response-Time': `${responseTime}ms`,
      'X-Powered-By': 'Adyog-API',
      'Cache-Control': getCacheControl(req, res),
      Vary: 'Accept-Encoding, Accept'
    });

    // Log response metrics
    logResponseMetrics(req, res, data, responseTime);

    return originalSend.call(this, data);
  };

  // Override res.json to add optimization
  res.json = function (data) {
    const responseTime = Date.now() - startTime;

    // Optimize JSON response
    const optimizedData = optimizeJsonResponse(data, req);

    // Add performance headers
    res.set({
      'X-Response-Time': `${responseTime}ms`,
      'X-Powered-By': 'Adyog-API',
      'Cache-Control': getCacheControl(req, res),
      Vary: 'Accept-Encoding, Accept',
      'Content-Type': 'application/json; charset=utf-8'
    });

    // Log response metrics
    logResponseMetrics(req, res, optimizedData, responseTime);

    return originalJson.call(this, optimizedData);
  };

  next();
};

// Get appropriate cache control headers
const getCacheControl = (req, res) => {
  const method = req.method;
  const path = req.path;
  const statusCode = res.statusCode;

  // No cache for errors
  if (statusCode >= 400) {
    return 'no-cache, no-store, must-revalidate';
  }

  // No cache for POST, PUT, DELETE
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return 'no-cache, no-store, must-revalidate';
  }

  // Static assets - long cache
  if (path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return 'public, max-age=31536000, immutable'; // 1 year
  }

  // API responses - short cache
  if (path.startsWith('/api/')) {
    // Product data - moderate cache
    if (path.includes('/product')) {
      return 'public, max-age=300, s-maxage=600'; // 5 minutes client, 10 minutes CDN
    }

    // User data - no cache
    if (path.includes('/user') || path.includes('/auth')) {
      return 'private, no-cache, no-store, must-revalidate';
    }

    // General API - short cache
    return 'public, max-age=60, s-maxage=120'; // 1 minute client, 2 minutes CDN
  }

  // Default - short cache
  return 'public, max-age=300'; // 5 minutes
};

// Optimize JSON response structure
const optimizeJsonResponse = (data, req) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Remove null/undefined values if requested
  if (req.query.compact === 'true') {
    return removeNullValues(data);
  }

  // Field selection if requested
  if (req.query.fields) {
    const fields = req.query.fields.split(',');
    return selectFields(data, fields);
  }

  return data;
};

// Remove null/undefined values from object
const removeNullValues = (obj) => {
  if (Array.isArray(obj)) {
    return obj
      .map(removeNullValues)
      .filter((item) => item !== null && item !== undefined);
  }

  if (obj && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = removeNullValues(value);
      }
    }
    return cleaned;
  }

  return obj;
};

// Select specific fields from response
const selectFields = (obj, fields) => {
  if (Array.isArray(obj)) {
    return obj.map((item) => selectFields(item, fields));
  }

  if (obj && typeof obj === 'object') {
    const selected = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(obj, field)) {
        selected[field] = obj[field];
      }
    }
    return selected;
  }

  return obj;
};

// Log response metrics
const logResponseMetrics = (req, res, data, responseTime) => {
  const dataSize = Buffer.byteLength(JSON.stringify(data || ''), 'utf8');
  const contentEncoding = res.getHeader('Content-Encoding');

  const metrics = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    dataSize: `${dataSize} bytes`,
    compressed: !!contentEncoding,
    encoding: contentEncoding || 'none',
    userAgent: req.get('User-Agent'),
    ip: req.ip
  };

  // Log slow responses
  if (responseTime > 1000) {
    logger.warn('Slow response detected', metrics);
  } else if (responseTime > 500) {
    logger.info('Response metrics', metrics);
  } else {
    logger.debug('Response metrics', metrics);
  }
};

// ETag generation for caching
export const etagMiddleware = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (data) {
    // Generate ETag for GET requests
    if (req.method === 'GET' && res.statusCode === 200) {
      const etag = generateETag(data);
      res.set('ETag', etag);

      // Check if client has cached version
      const clientETag = req.get('If-None-Match');
      if (clientETag === etag) {
        res.status(304).end();
        return;
      }
    }

    return originalSend.call(this, data);
  };

  next();
};

//  Use ES module import for crypto
const generateETag = (data) => {
  const hash = crypto.createHash('md5');
  hash.update(JSON.stringify(data));
  return `"${hash.digest('hex')}"`;
};

// Conditional requests middleware
export const conditionalRequests = (req, res, next) => {
  // Handle If-Modified-Since
  const ifModifiedSince = req.get('If-Modified-Since');
  if (ifModifiedSince && req.method === 'GET') {
    const modifiedSince = new Date(ifModifiedSince);
    const lastModified = res.getHeader('Last-Modified');

    if (lastModified && new Date(lastModified) <= modifiedSince) {
      res.status(304).end();
      return;
    }
  }

  next();
};

// Response streaming for large datasets
export const streamingResponse = (req, res, next) => {
  // Add streaming method to response
  res.streamJson = function (data, options = {}) {
    const { chunkSize = 1000 } = options;

    if (!Array.isArray(data)) {
      return res.json(data);
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    });

    res.write('{"data":[');

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const chunkJson = JSON.stringify(chunk).slice(1, -1); // Remove array brackets

      if (i > 0) res.write(',');
      res.write(chunkJson);
    }

    res.write(']}');
    res.end();
  };

  next();
};
