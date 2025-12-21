import logger from '../utils/logger.js';
import cacheService from './cacheService.js';

// Performance monitoring and optimization service
class PerformanceService {
  constructor() {
    this.metrics = {
      requests: new Map(),
      responses: new Map(),
      errors: new Map(),
      slowQueries: new Map()
    };
    
    this.thresholds = {
      slowRequest: parseInt(process.env.SLOW_REQUEST_THRESHOLD) || 1000,
      slowQuery: parseInt(process.env.SLOW_QUERY_THRESHOLD) || 500,
      highMemory: parseInt(process.env.HIGH_MEMORY_THRESHOLD) || 500 * 1024 * 1024, // 500MB
      highCpu: parseInt(process.env.HIGH_CPU_THRESHOLD) || 80 // 80%
    };

    // Start monitoring
    this.startMonitoring();
  }

  // Start performance monitoring
  startMonitoring() {
    // Monitor system resources every 30 seconds
    this.resourceMonitor = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Generate performance report every 5 minutes
    this.reportInterval = setInterval(() => {
      this.generatePerformanceReport();
    }, 300000);

    logger.info('Performance monitoring started', {
      thresholds: this.thresholds
    });
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
    }
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }
    logger.info('Performance monitoring stopped');
  }

  // Collect system metrics
  collectSystemMetrics() {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const metrics = {
        timestamp: new Date().toISOString(),
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime(),
        eventLoop: this.getEventLoopLag()
      };

      // Check for performance issues
      this.checkPerformanceThresholds(metrics);

      // Store metrics in cache for reporting
      cacheService.set('system_metrics', metrics, 60000); // 1 minute TTL

      return metrics;
    } catch (error) {
      logger.error('Error collecting system metrics', { error: error.message });
      return null;
    }
  }

  // Measure event loop lag
  getEventLoopLag() {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      cacheService.set('event_loop_lag', lag, 10000); // 10 seconds TTL
    });
    
    return cacheService.get('event_loop_lag') || 0;
  }

  // Check performance thresholds
  checkPerformanceThresholds(metrics) {
    // Check memory usage
    if (metrics.memory.heapUsed > this.thresholds.highMemory) {
      logger.warn('High memory usage detected', {
        heapUsed: `${Math.round(metrics.memory.heapUsed / 1024 / 1024)}MB`,
        threshold: `${Math.round(this.thresholds.highMemory / 1024 / 1024)}MB`
      });
    }

    // Check event loop lag
    if (metrics.eventLoop > 100) { // 100ms lag
      logger.warn('High event loop lag detected', {
        lag: `${metrics.eventLoop}ms`
      });
    }
  }

  // Track request performance
  trackRequest(req, res, responseTime) {
    try {
      const endpoint = `${req.method} ${req.route?.path || req.path}`;
      const key = `req_${Date.now()}`;
      
      const requestMetrics = {
        endpoint,
        method: req.method,
        path: req.path,
        responseTime,
        statusCode: res.statusCode,
        contentLength: res.get('Content-Length') || 0,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip
      };

      // Store in metrics map
      this.metrics.requests.set(key, requestMetrics);

      // Clean old metrics (keep last 1000)
      if (this.metrics.requests.size > 1000) {
        const oldestKey = this.metrics.requests.keys().next().value;
        this.metrics.requests.delete(oldestKey);
      }

      // Track slow requests
      if (responseTime > this.thresholds.slowRequest) {
        this.metrics.slowQueries.set(key, requestMetrics);
        logger.warn('Slow request detected', requestMetrics);
      }

      return requestMetrics;
    } catch (error) {
      logger.error('Error tracking request performance', { error: error.message });
    }
  }

  // Track database query performance
  trackQuery(operation, duration, resultCount, collection) {
    try {
      const key = `query_${Date.now()}`;
      
      const queryMetrics = {
        operation,
        duration,
        resultCount,
        collection,
        timestamp: new Date().toISOString()
      };

      // Track slow queries
      if (duration > this.thresholds.slowQuery) {
        this.metrics.slowQueries.set(key, queryMetrics);
        logger.warn('Slow query detected', queryMetrics);
      }

      return queryMetrics;
    } catch (error) {
      logger.error('Error tracking query performance', { error: error.message });
    }
  }

  // Generate performance report
  generatePerformanceReport() {
    try {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);

      // Filter recent metrics
      const recentRequests = Array.from(this.metrics.requests.values())
        .filter(req => new Date(req.timestamp).getTime() > oneHourAgo);

      const recentSlowQueries = Array.from(this.metrics.slowQueries.values())
        .filter(query => new Date(query.timestamp).getTime() > oneHourAgo);

      // Calculate statistics
      const stats = this.calculateStatistics(recentRequests);
      const systemMetrics = cacheService.get('system_metrics');
      const cacheStats = cacheService.getStats();

      const report = {
        timestamp: new Date().toISOString(),
        period: '1 hour',
        requests: {
          total: recentRequests.length,
          ...stats
        },
        slowQueries: {
          count: recentSlowQueries.length,
          queries: recentSlowQueries.slice(-10) // Last 10 slow queries
        },
        system: systemMetrics,
        cache: cacheStats,
        recommendations: this.generateRecommendations(stats, systemMetrics, cacheStats)
      };

      logger.info('Performance report generated', report);
      
      // Store report in cache
      cacheService.set('performance_report', report, 3600000); // 1 hour TTL

      return report;
    } catch (error) {
      logger.error('Error generating performance report', { error: error.message });
      return null;
    }
  }

  // Calculate request statistics
  calculateStatistics(requests) {
    if (requests.length === 0) {
      return {
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        p95ResponseTime: 0,
        errorRate: 0,
        throughput: 0
      };
    }

    const responseTimes = requests.map(req => req.responseTime).sort((a, b) => a - b);
    const errors = requests.filter(req => req.statusCode >= 400);

    return {
      avgResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      minResponseTime: responseTimes[0],
      maxResponseTime: responseTimes[responseTimes.length - 1],
      p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)],
      errorRate: Math.round((errors.length / requests.length) * 100 * 100) / 100,
      throughput: Math.round(requests.length / 60 * 100) / 100 // requests per minute
    };
  }

  // Generate performance recommendations
  generateRecommendations(requestStats, systemMetrics, cacheStats) {
    const recommendations = [];

    // High response time
    if (requestStats.avgResponseTime > 1000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Average response time is high. Consider optimizing database queries and adding caching.',
        metric: `${requestStats.avgResponseTime}ms average response time`
      });
    }

    // High error rate
    if (requestStats.errorRate > 5) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: 'Error rate is high. Review error logs and fix underlying issues.',
        metric: `${requestStats.errorRate}% error rate`
      });
    }

    // High memory usage
    if (systemMetrics && systemMetrics.memory.heapUsed > this.thresholds.highMemory) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'Memory usage is high. Consider optimizing memory-intensive operations.',
        metric: `${Math.round(systemMetrics.memory.heapUsed / 1024 / 1024)}MB heap used`
      });
    }

    // Low cache hit rate (if cache stats available)
    if (cacheStats && cacheStats.size > 0) {
      const hitRate = (cacheStats.totalAccessCount / cacheStats.size) * 100;
      if (hitRate < 50) {
        recommendations.push({
          type: 'caching',
          priority: 'medium',
          message: 'Cache hit rate is low. Review caching strategy and TTL settings.',
          metric: `${Math.round(hitRate)}% cache hit rate`
        });
      }
    }

    return recommendations;
  }

  // Get current performance metrics
  getCurrentMetrics() {
    return {
      system: cacheService.get('system_metrics'),
      cache: cacheService.getStats(),
      recentRequests: Array.from(this.metrics.requests.values()).slice(-10),
      slowQueries: Array.from(this.metrics.slowQueries.values()).slice(-10)
    };
  }

  // Get performance report
  getPerformanceReport() {
    return cacheService.get('performance_report') || this.generatePerformanceReport();
  }

  // Optimize performance based on current metrics
  async optimizePerformance() {
    try {
      const metrics = this.getCurrentMetrics();
      const optimizations = [];

      // Clear expired cache entries
      const cacheCleared = cacheService.cleanup ? cacheService.cleanup() : 0;
      if (cacheCleared > 0) {
        optimizations.push(`Cleared ${cacheCleared} expired cache entries`);
      }

      // Force garbage collection if memory usage is high
      if (metrics.system && metrics.system.memory.heapUsed > this.thresholds.highMemory) {
        if (global.gc) {
          global.gc();
          optimizations.push('Forced garbage collection');
        }
      }

      logger.info('Performance optimization completed', { optimizations });
      return optimizations;
    } catch (error) {
      logger.error('Error during performance optimization', { error: error.message });
      return [];
    }
  }
}

// Export singleton instance
export default new PerformanceService();