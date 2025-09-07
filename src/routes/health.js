const express = require('express');
const dbPool = require('../config/database');
const redisClient = require('../config/redis');

const router = express.Router();

// Basic health check
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTime: 0,
    services: {}
  };

  try {
    // Check database
    await dbPool.query('SELECT 1');
    health.services.database = { status: 'OK' };
  } catch (error) {
    health.services.database = { status: 'ERROR', error: error.message };
    health.status = 'ERROR';
  }

  try {
    // Check Redis
    await redisClient.ping();
    health.services.redis = { status: 'OK' };
  } catch (error) {
    health.services.redis = { status: 'ERROR', error: error.message };
    health.status = 'ERROR';
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  health.services.memory = {
    status: 'OK',
    usage: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB'
    }
  };

  health.responseTime = Date.now() - startTime;

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTime: 0,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    },
    services: {},
    metrics: {}
  };

  try {
    // Database detailed check
    const dbStats = await dbPool.getStats();
    const dbResult = await dbPool.query('SELECT version() as version, NOW() as timestamp');
    
    health.services.database = {
      status: 'OK',
      version: dbResult.rows[0].version.split(' ')[1],
      connections: {
        total: dbStats.totalConnections,
        idle: dbStats.idleConnections,
        waiting: dbStats.waitingClients
      }
    };
  } catch (error) {
    health.services.database = { status: 'ERROR', error: error.message };
    health.status = 'ERROR';
  }

  try {
    // Redis detailed check
    const redisPong = await redisClient.ping();
    health.services.redis = {
      status: 'OK',
      ping: redisPong,
      connected: true
    };
  } catch (error) {
    health.services.redis = { status: 'ERROR', error: error.message };
    health.status = 'ERROR';
  }

  // Detailed memory and CPU info
  const memUsage = process.memoryUsage();
  health.metrics = {
    memory: {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers
    },
    cpu: process.cpuUsage(),
    eventLoop: {
      delay: 0 // Could implement event loop delay measurement
    }
  };

  health.responseTime = Date.now() - startTime;

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Readiness probe
router.get('/ready', async (req, res) => {
  try {
    // Check if all critical services are ready
    await Promise.all([
      dbPool.query('SELECT 1'),
      redisClient.ping()
    ]);
    
    res.status(200).json({ status: 'READY' });
  } catch (error) {
    res.status(503).json({ status: 'NOT_READY', error: error.message });
  }
});

// Liveness probe
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'ALIVE' });
});

module.exports = router;