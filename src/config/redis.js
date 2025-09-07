const redis = require('redis');
const logger = require('../utils/logger');

class RedisManager {
  constructor() {
    this.client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
      socket: {
        keepAlive: true,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            logger.error('Redis reconnection failed after 3 attempts');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      },
      database: 0
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    this.client.connect().catch(err => {
      logger.error('Failed to connect to Redis:', err);
    });
  }

  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) {
    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key) {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  async flushAll() {
    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      logger.error('Redis FLUSHALL error:', error);
      return false;
    }
  }

  async ping() {
    return await this.client.ping();
  }

  async disconnect() {
    await this.client.disconnect();
    logger.info('Redis client disconnected');
  }
}

module.exports = new RedisManager();