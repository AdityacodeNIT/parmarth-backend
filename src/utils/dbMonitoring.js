import mongoose from 'mongoose';
import logger from './logger.js';

// Database performance monitoring utilities
export class DatabaseMonitor {
  constructor() {
    this.queryStats = new Map();
    this.slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD) || 1000; // 1 second
    this.isMonitoring = false;
  }

  // Start monitoring database operations
  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    logger.info('Database monitoring started');

    // Monitor mongoose queries
    mongoose.set('debug', (collectionName, method, query, doc, options) => {
      const startTime = Date.now();
      
      // Log query details
      logger.debug('Database query', {
        collection: collectionName,
        method,
        query: JSON.stringify(query),
        options: JSON.stringify(options)
      });

      // Track query statistics
      const queryKey = `${collectionName}.${method}`;
      if (!this.queryStats.has(queryKey)) {
        this.queryStats.set(queryKey, {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          slowQueries: 0
        });
      }

      const stats = this.queryStats.get(queryKey);
      stats.count++;
      
      // Note: In a real implementation, you'd need to hook into the actual query execution
      // to measure the actual execution time. This is a simplified version.
    });

    // Set up periodic reporting
    this.setupPeriodicReporting();
  }

  // Stop monitoring
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    mongoose.set('debug', false);
    logger.info('Database monitoring stopped');
  }

  // Set up periodic performance reporting
  setupPeriodicReporting() {
    const reportInterval = parseInt(process.env.DB_REPORT_INTERVAL) || 300000; // 5 minutes
    
    setInterval(() => {
      this.generatePerformanceReport();
    }, reportInterval);
  }

  // Generate performance report
  generatePerformanceReport() {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        connectionStats: this.getConnectionStats(),
        queryStats: this.getQueryStats(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      };

      logger.info('Database performance report', report);

      // Reset query stats for next period
      this.queryStats.clear();

      return report;
    } catch (error) {
      logger.error('Error generating performance report', { error: error.message });
    }
  }

  // Get connection statistics
  getConnectionStats() {
    const connection = mongoose.connection;
    
    return {
      readyState: connection.readyState,
      host: connection.host,
      port: connection.port,
      name: connection.name,
      collections: Object.keys(connection.collections).length
    };
  }

  // Get query statistics
  getQueryStats() {
    const stats = {};
    
    for (const [queryKey, data] of this.queryStats.entries()) {
      stats[queryKey] = {
        ...data,
        avgTime: data.count > 0 ? data.totalTime / data.count : 0
      };
    }
    
    return stats;
  }

  // Analyze slow queries
  async analyzeSlowQueries() {
    try {
      const db = mongoose.connection.db;
      
      // Get current operations
      const currentOps = await db.admin().currentOp();
      
      const slowOps = currentOps.inprog.filter(op => 
        op.secs_running > this.slowQueryThreshold / 1000
      );

      if (slowOps.length > 0) {
        logger.warn('Slow queries detected', {
          count: slowOps.length,
          operations: slowOps.map(op => ({
            opid: op.opid,
            op: op.op,
            ns: op.ns,
            command: op.command,
            secs_running: op.secs_running
          }))
        });
      }

      return slowOps;
    } catch (error) {
      logger.error('Error analyzing slow queries', { error: error.message });
      return [];
    }
  }

  // Get database profiling data
  async getProfilingData() {
    try {
      const db = mongoose.connection.db;
      
      // Get profiling status
      const profilingStatus = await db.command({ profile: -1 });
      
      // Get profiling data if enabled
      let profilingData = null;
      if (profilingStatus.was > 0) {
        profilingData = await db.collection('system.profile')
          .find({})
          .sort({ ts: -1 })
          .limit(100)
          .toArray();
      }

      return {
        status: profilingStatus,
        data: profilingData
      };
    } catch (error) {
      logger.error('Error getting profiling data', { error: error.message });
      return null;
    }
  }

  // Enable database profiling
  async enableProfiling(level = 1, slowms = 100) {
    try {
      const db = mongoose.connection.db;
      
      await db.command({
        profile: level,
        slowms: slowms
      });

      logger.info('Database profiling enabled', { level, slowms });
    } catch (error) {
      logger.error('Error enabling database profiling', { error: error.message });
    }
  }

  // Disable database profiling
  async disableProfiling() {
    try {
      const db = mongoose.connection.db;
      
      await db.command({ profile: 0 });
      
      logger.info('Database profiling disabled');
    } catch (error) {
      logger.error('Error disabling database profiling', { error: error.message });
    }
  }

  // Get index usage statistics
  async getIndexStats() {
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      
      const indexStats = {};
      
      for (const collection of collections) {
        const collectionName = collection.name;
        const coll = db.collection(collectionName);
        
        try {
          const stats = await coll.aggregate([
            { $indexStats: {} }
          ]).toArray();
          
          indexStats[collectionName] = stats;
        } catch (error) {
          // Some collections might not support $indexStats
          logger.debug(`Cannot get index stats for ${collectionName}`, { 
            error: error.message 
          });
        }
      }
      
      return indexStats;
    } catch (error) {
      logger.error('Error getting index statistics', { error: error.message });
      return {};
    }
  }

  // Suggest index optimizations
  async suggestIndexOptimizations() {
    try {
      const indexStats = await this.getIndexStats();
      const suggestions = [];
      
      for (const [collectionName, stats] of Object.entries(indexStats)) {
        for (const indexStat of stats) {
          // Suggest removing unused indexes
          if (indexStat.accesses.ops === 0 && indexStat.name !== '_id_') {
            suggestions.push({
              type: 'remove_unused_index',
              collection: collectionName,
              index: indexStat.name,
              reason: 'Index has never been used'
            });
          }
          
          // Suggest compound indexes for frequently used single-field indexes
          if (indexStat.accesses.ops > 1000 && Object.keys(indexStat.key).length === 1) {
            suggestions.push({
              type: 'consider_compound_index',
              collection: collectionName,
              index: indexStat.name,
              reason: 'High usage single-field index might benefit from compound index'
            });
          }
        }
      }
      
      return suggestions;
    } catch (error) {
      logger.error('Error generating index optimization suggestions', { 
        error: error.message 
      });
      return [];
    }
  }
}

// Export singleton instance
export default new DatabaseMonitor();