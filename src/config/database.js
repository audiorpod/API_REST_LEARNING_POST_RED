const { Pool } = require('pg');
const logger = require('../utils/logger');

class DatabaseManager {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      min: parseInt(process.env.DB_POOL_MIN) || 10,
      max: parseInt(process.env.DB_POOL_MAX) || 100,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
      query_timeout: 10000,
    });

    this.pool.on('connect', (client) => {
      logger.debug(`Database connection established: ${client.processID}`);
    });

    this.pool.on('error', (err) => {
      logger.error('Database pool error:', err);
    });

    this.pool.on('remove', (client) => {
      logger.debug(`Database connection removed: ${client.processID}`);
    });
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 50) {
        logger.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}...`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Query error (${duration}ms): ${error.message}`);
      throw error;
    }
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getStats() {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount
    };
  }

  async end() {
    await this.pool.end();
    logger.info('Database pool closed');
  }
}

module.exports = new DatabaseManager();