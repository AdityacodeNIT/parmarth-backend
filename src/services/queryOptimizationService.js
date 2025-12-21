import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import cacheService from './cacheService.js';

// Database query optimization service
class QueryOptimizationService {
  constructor() {
    this.queryCache = new Map();
    this.slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD) || 1000;
    this.cacheEnabled = process.env.QUERY_CACHE_ENABLED !== 'false';
  }

  // Optimized pagination with cursor-based approach
  async paginateWithCursor(model, query = {}, options = {}) {
    const {
      limit = 20,
      cursor = null,
      sortField = '_id',
      sortOrder = 1,
      select = null,
      populate = null
    } = options;

    try {
      const startTime = Date.now();
      
      // Build query with cursor
      let mongoQuery = { ...query };
      if (cursor) {
        const operator = sortOrder === 1 ? '$gt' : '$lt';
        mongoQuery[sortField] = { [operator]: cursor };
      }

      // Execute query
      let queryBuilder = model.find(mongoQuery)
        .sort({ [sortField]: sortOrder })
        .limit(limit + 1); // Get one extra to check if there's a next page

      if (select) {
        queryBuilder = queryBuilder.select(select);
      }

      if (populate) {
        queryBuilder = queryBuilder.populate(populate);
      }

      const results = await queryBuilder.exec();
      const hasNextPage = results.length > limit;
      
      if (hasNextPage) {
        results.pop(); // Remove the extra item
      }

      const nextCursor = hasNextPage && results.length > 0 
        ? results[results.length - 1][sortField] 
        : null;

      const duration = Date.now() - startTime;
      this.logQueryPerformance('paginateWithCursor', duration, results.length);

      return {
        data: results,
        hasNextPage,
        nextCursor,
        count: results.length
      };
    } catch (error) {
      logger.error('Cursor pagination error', { 
        model: model.modelName,
        error: error.message 
      });
      throw error;
    }
  }

  // Optimized aggregation with caching
  async cachedAggregate(model, pipeline, cacheKey, ttl = 300000) {
    try {
      if (this.cacheEnabled && cacheKey) {
        const cached = cacheService.get(cacheKey);
        if (cached) {
          logger.debug('Aggregation cache hit', { cacheKey });
          return cached;
        }
      }

      const startTime = Date.now();
      const results = await model.aggregate(pipeline).exec();
      const duration = Date.now() - startTime;

      this.logQueryPerformance('aggregate', duration, results.length);

      if (this.cacheEnabled && cacheKey) {
        cacheService.set(cacheKey, results, ttl);
        logger.debug('Aggregation result cached', { cacheKey, ttl });
      }

      return results;
    } catch (error) {
      logger.error('Cached aggregation error', { 
        model: model.modelName,
        error: error.message 
      });
      throw error;
    }
  }

  // Batch operations for better performance
  async batchInsert(model, documents, options = {}) {
    const { batchSize = 1000, ordered = false } = options;
    
    try {
      const startTime = Date.now();
      const results = [];

      // Process in batches
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const batchResult = await model.insertMany(batch, { ordered });
        results.push(...batchResult);
      }

      const duration = Date.now() - startTime;
      this.logQueryPerformance('batchInsert', duration, results.length);

      return results;
    } catch (error) {
      logger.error('Batch insert error', { 
        model: model.modelName,
        error: error.message 
      });
      throw error;
    }
  }

  // Optimized bulk update
  async bulkUpdate(model, updates, options = {}) {
    const { batchSize = 1000 } = options;
    
    try {
      const startTime = Date.now();
      const bulkOps = [];

      // Prepare bulk operations
      for (const update of updates) {
        bulkOps.push({
          updateOne: {
            filter: update.filter,
            update: update.update,
            upsert: update.upsert || false
          }
        });
      }

      const results = [];
      
      // Process in batches
      for (let i = 0; i < bulkOps.length; i += batchSize) {
        const batch = bulkOps.slice(i, i + batchSize);
        const batchResult = await model.bulkWrite(batch);
        results.push(batchResult);
      }

      const duration = Date.now() - startTime;
      this.logQueryPerformance('bulkUpdate', duration, results.length);

      return results;
    } catch (error) {
      logger.error('Bulk update error', { 
        model: model.modelName,
        error: error.message 
      });
      throw error;
    }
  }

  // Optimized search with text index
  async textSearch(model, searchTerm, options = {}) {
    const {
      limit = 20,
      skip = 0,
      select = null,
      additionalFilters = {},
      sortBy = { score: { $meta: 'textScore' } }
    } = options;

    try {
      const cacheKey = `text_search:${model.modelName}:${searchTerm}:${skip}:${limit}`;
      
      return await cacheService.getOrSet(cacheKey, async () => {
        const startTime = Date.now();
        
        let query = {
          $text: { $search: searchTerm },
          ...additionalFilters
        };

        let queryBuilder = model.find(query, { score: { $meta: 'textScore' } })
          .sort(sortBy)
          .skip(skip)
          .limit(limit);

        if (select) {
          queryBuilder = queryBuilder.select(select);
        }

        const results = await queryBuilder.exec();
        const duration = Date.now() - startTime;

        this.logQueryPerformance('textSearch', duration, results.length);
        return results;
      }, 60000); // Cache for 1 minute
    } catch (error) {
      logger.error('Text search error', { 
        model: model.modelName,
        searchTerm,
        error: error.message 
      });
      throw error;
    }
  }

  // Optimized count with estimation for large collections
  async optimizedCount(model, query = {}, useEstimate = true) {
    try {
      const cacheKey = `count:${model.modelName}:${JSON.stringify(query)}`;
      
      return await cacheService.getOrSet(cacheKey, async () => {
        const startTime = Date.now();
        let count;

        if (useEstimate && Object.keys(query).length === 0) {
          // Use estimated count for empty queries on large collections
          count = await model.estimatedDocumentCount();
        } else {
          count = await model.countDocuments(query);
        }

        const duration = Date.now() - startTime;
        this.logQueryPerformance('count', duration, 1);

        return count;
      }, 30000); // Cache for 30 seconds
    } catch (error) {
      logger.error('Optimized count error', { 
        model: model.modelName,
        error: error.message 
      });
      throw error;
    }
  }

  // Find with intelligent caching
  async cachedFind(model, query, options = {}, cacheOptions = {}) {
    const { ttl = 60000, useCache = true } = cacheOptions;
    
    try {
      if (!useCache) {
        return await model.find(query, null, options).exec();
      }

      const cacheKey = `find:${model.modelName}:${JSON.stringify(query)}:${JSON.stringify(options)}`;
      
      return await cacheService.getOrSet(cacheKey, async () => {
        const startTime = Date.now();
        const results = await model.find(query, null, options).exec();
        const duration = Date.now() - startTime;

        this.logQueryPerformance('cachedFind', duration, results.length);
        return results;
      }, ttl);
    } catch (error) {
      logger.error('Cached find error', { 
        model: model.modelName,
        error: error.message 
      });
      throw error;
    }
  }

  // Optimized findById with caching
  async cachedFindById(model, id, select = null, populate = null, ttl = 300000) {
    try {
      const cacheKey = `findById:${model.modelName}:${id}`;
      
      return await cacheService.getOrSet(cacheKey, async () => {
        const startTime = Date.now();
        
        let query = model.findById(id);
        
        if (select) {
          query = query.select(select);
        }
        
        if (populate) {
          query = query.populate(populate);
        }
        
        const result = await query.exec();
        const duration = Date.now() - startTime;

        this.logQueryPerformance('cachedFindById', duration, result ? 1 : 0);
        return result;
      }, ttl);
    } catch (error) {
      logger.error('Cached findById error', { 
        model: model.modelName,
        id,
        error: error.message 
      });
      throw error;
    }
  }

  // Invalidate cache for a model
  invalidateModelCache(modelName, pattern = null) {
    try {
      let invalidatedCount = 0;
      
      for (const key of cacheService.cache.keys()) {
        const shouldInvalidate = pattern 
          ? key.includes(modelName) && key.includes(pattern)
          : key.includes(modelName);
          
        if (shouldInvalidate) {
          cacheService.delete(key);
          invalidatedCount++;
        }
      }

      logger.info('Cache invalidated', { modelName, pattern, invalidatedCount });
      return invalidatedCount;
    } catch (error) {
      logger.error('Cache invalidation error', { 
        modelName,
        error: error.message 
      });
      return 0;
    }
  }

  // Log query performance
  logQueryPerformance(operation, duration, resultCount) {
    const logData = {
      operation,
      duration: `${duration}ms`,
      resultCount,
      timestamp: new Date().toISOString()
    };

    if (duration > this.slowQueryThreshold) {
      logger.warn('Slow query detected', logData);
    } else {
      logger.debug('Query performance', logData);
    }
  }

  // Get query statistics
  getQueryStats() {
    return {
      cacheStats: cacheService.getStats(),
      slowQueryThreshold: this.slowQueryThreshold,
      cacheEnabled: this.cacheEnabled
    };
  }

  // Optimize query with hints
  addQueryHints(query, hints = {}) {
    const {
      index = null,
      maxTimeMS = 30000,
      readConcern = null
    } = hints;

    if (index) {
      query = query.hint(index);
    }

    if (maxTimeMS) {
      query = query.maxTimeMS(maxTimeMS);
    }

    if (readConcern) {
      query = query.read(readConcern);
    }

    return query;
  }
}

// Export singleton instance
export default new QueryOptimizationService();