import logger from '../utils/logger.js';

// In-memory cache service (without Redis dependency)
class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttlMap = new Map();
    this.maxSize = parseInt(process.env.CACHE_MAX_SIZE) || 1000;
    this.defaultTTL = parseInt(process.env.CACHE_DEFAULT_TTL) || 300000; // 5 minutes
    
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
    
    logger.info('Memory cache service initialized', {
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL
    });
  }

  // Set cache entry with TTL
  set(key, value, ttl = this.defaultTTL) {
    try {
      // Check cache size limit
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        this.evictLRU();
      }

      const expiresAt = Date.now() + ttl;
      this.cache.set(key, {
        value,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        accessCount: 0
      });
      this.ttlMap.set(key, expiresAt);

      logger.debug('Cache entry set', { key, ttl, size: this.cache.size });
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }

  // Get cache entry
  get(key) {
    try {
      const entry = this.cache.get(key);
      const expiresAt = this.ttlMap.get(key);

      if (!entry || !expiresAt) {
        return null;
      }

      // Check if expired
      if (Date.now() > expiresAt) {
        this.delete(key);
        return null;
      }

      // Update access statistics
      entry.accessedAt = Date.now();
      entry.accessCount++;

      logger.debug('Cache hit', { key, accessCount: entry.accessCount });
      return entry.value;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  // Delete cache entry
  delete(key) {
    try {
      const deleted = this.cache.delete(key);
      this.ttlMap.delete(key);
      
      if (deleted) {
        logger.debug('Cache entry deleted', { key, size: this.cache.size });
      }
      
      return deleted;
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
      return false;
    }
  }

  // Check if key exists and is not expired
  has(key) {
    const expiresAt = this.ttlMap.get(key);
    if (!expiresAt || Date.now() > expiresAt) {
      this.delete(key);
      return false;
    }
    return this.cache.has(key);
  }

  // Clear all cache entries
  clear() {
    try {
      const size = this.cache.size;
      this.cache.clear();
      this.ttlMap.clear();
      
      logger.info('Cache cleared', { entriesRemoved: size });
      return true;
    } catch (error) {
      logger.error('Cache clear error', { error: error.message });
      return false;
    }
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let totalAccessCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      const expiresAt = this.ttlMap.get(key);
      if (expiresAt && now > expiresAt) {
        expiredCount++;
      }
      totalAccessCount += entry.accessCount;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expiredCount,
      totalAccessCount,
      memoryUsage: this.getMemoryUsage()
    };
  }

  // Estimate memory usage
  getMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      totalSize += this.estimateSize(key) + this.estimateSize(entry);
    }
    
    return {
      estimated: totalSize,
      unit: 'bytes'
    };
  }

  // Estimate object size in bytes
  estimateSize(obj) {
    const jsonString = JSON.stringify(obj);
    return new Blob([jsonString]).size;
  }

  // Clean up expired entries
  cleanup() {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, expiresAt] of this.ttlMap.entries()) {
        if (now > expiresAt) {
          this.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.debug('Cache cleanup completed', { 
          cleanedCount, 
          remainingSize: this.cache.size 
        });
      }
    } catch (error) {
      logger.error('Cache cleanup error', { error: error.message });
    }
  }

  // Evict least recently used entry
  evictLRU() {
    try {
      let oldestKey = null;
      let oldestTime = Date.now();

      for (const [key, entry] of this.cache.entries()) {
        if (entry.accessedAt < oldestTime) {
          oldestTime = entry.accessedAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.delete(oldestKey);
        logger.debug('LRU eviction', { evictedKey: oldestKey });
      }
    } catch (error) {
      logger.error('LRU eviction error', { error: error.message });
    }
  }

  // Cache with function execution
  async getOrSet(key, fetchFunction, ttl = this.defaultTTL) {
    try {
      // Try to get from cache first
      const cached = this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Execute function and cache result
      const result = await fetchFunction();
      this.set(key, result, ttl);
      
      logger.debug('Cache miss - function executed', { key });
      return result;
    } catch (error) {
      logger.error('Cache getOrSet error', { key, error: error.message });
      throw error;
    }
  }

  // Batch operations
  mget(keys) {
    const results = {};
    for (const key of keys) {
      results[key] = this.get(key);
    }
    return results;
  }

  mset(entries, ttl = this.defaultTTL) {
    const results = {};
    for (const [key, value] of Object.entries(entries)) {
      results[key] = this.set(key, value, ttl);
    }
    return results;
  }

  // Destroy cache service
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    logger.info('Cache service destroyed');
  }
}

// Export singleton instance
export default new CacheService();