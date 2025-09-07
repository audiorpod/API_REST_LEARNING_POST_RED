const NodeCache = require('node-cache');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

class CacheManager {
  constructor() {
    // Memory cache for ultra-fast access
    this.memoryCache = new NodeCache({
      stdTTL: parseInt(process.env.CACHE_TTL) || 300,
      maxKeys: parseInt(process.env.MEMORY_CACHE_MAX) || 1000,
      deleteOnExpire: true
    });

    this.memoryCache.on('expired', (key, value) => {
      logger.debug(`Memory cache key expired: ${key}`);
    });
  }

  // Multi-level caching middleware
  cache(ttl = 300, useMemory = true) {
    return async (req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }

      const key = this.generateKey(req);
      
      try {
        // Level 1: Memory cache (fastest)
        if (useMemory) {
          const memoryResult = this.memoryCache.get(key);
          if (memoryResult) {
            res.set('X-Cache', 'HIT-MEMORY');
            return res.json(memoryResult);
          }
        }

        // Level 2: Redis cache (fast)
        const redisResult = await redisClient.get(key);
        if (redisResult) {
          // Store in memory for next time
          if (useMemory) {
            this.memoryCache.set(key, redisResult, ttl);
          }
          res.set('X-Cache', 'HIT-REDIS');
          return res.json(redisResult);
        }

        // Cache miss - continue to route handler
        res.set('X-Cache', 'MISS');
        
        // Override res.json to cache the response
        const originalJson = res.json;
        res.json = (data) => {
          // Store in both caches
          if (useMemory) {
            this.memoryCache.set(key, data, ttl);
          }
          redisClient.set(key, data, ttl);
          
          return originalJson.call(res, data);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next();
      }
    };
  }

  generateKey(req) {
    const { method, originalUrl, query, user } = req;
    const userId = user ? user.id : 'anonymous';
    return `api:${method}:${originalUrl}:${JSON.stringify(query)}:${userId}`;
  }

  async invalidatePattern(pattern) {
    try {
      // Clear memory cache
      const keys = this.memoryCache.keys();
      keys.forEach(key => {
        if (key.includes(pattern)) {
          this.memoryCache.del(key);
        }
      });

      // TODO: Implement Redis pattern deletion
      logger.info(`Cache invalidated for pattern: ${pattern}`);
    } catch (error) {
      logger.error('Cache invalidation error:', error);
    }
  }

  getStats() {
    const memoryStats = this.memoryCache.getStats();
    return {
      memory: {
        keys: memoryStats.keys,
        hits: memoryStats.hits,
        misses: memoryStats.misses,
        hitRate: memoryStats.hits / (memoryStats.hits + memoryStats.misses) || 0
      }
    };
  }
}

module.exports = new CacheManager();