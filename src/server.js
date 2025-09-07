const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const expressWinston = require('express-winston');
require('dotenv').config();

const logger = require('./utils/logger');
const dbPool = require('./config/database');
const redisClient = require('./config/redis');
const errorHandler = require('./middleware/errorHandler');
const auth = require('./middleware/auth');

// Route imports
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const analyticsRoutes = require('./routes/analytics');
const healthRoutes = require('./routes/health');

class HighPerformanceAPI {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration for high performance
    this.app.use(cors({
      origin: true,
      credentials: true,
      optionsSuccessStatus: 200
    }));

    // Compression for reduced payload size
    this.app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      }
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
      message: { error: 'Too many requests, please try again later' },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path === '/health'
    });
    this.app.use(limiter);

    // Body parsing with size limits
    this.app.use(express.json({ 
      limit: '10mb',
      type: ['application/json', 'text/plain']
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));

    // Request logging
    this.app.use(expressWinston.logger({
      winstonInstance: logger,
      statusLevels: true,
      level: function(req, res) {
        return res.statusCode >= 400 ? 'error' : 'info';
      },
      meta: false,
      msg: "{{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms",
      expressFormat: true,
      colorize: false
    }));

    // Custom performance middleware
    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        if (duration > 100) {
          logger.warn(`Slow request: ${req.method} ${req.url} took ${duration}ms`);
        }
      });
      next();
    });
  }

  initializeRoutes() {
    // API routes
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/products', productRoutes);
    this.app.use('/api/orders', auth, orderRoutes);
    this.app.use('/api/analytics', analyticsRoutes);
    this.app.use('/health', healthRoutes);

    // API documentation
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'High Performance REST API',
        version: '1.0.0',
        endpoints: {
          users: '/api/users',
          products: '/api/products', 
          orders: '/api/orders',
          analytics: '/api/analytics',
          health: '/health'
        },
        documentation: 'https://api-docs.example.com'
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });
  }

  initializeErrorHandling() {
    this.app.use(errorHandler);
  }

  async start() {
    try {
      // Test database connection
      await dbPool.query('SELECT NOW()');
      logger.info('Database connected successfully');

      // Test Redis connection
      await redisClient.ping();
      logger.info('Redis connected successfully');

      const server = this.app.listen(this.port, () => {
        logger.info(`🚀 High Performance API server running on port ${this.port}`);
        logger.info(`📊 Process ID: ${process.pid}`);
        logger.info(`🔥 Environment: ${process.env.NODE_ENV || 'development'}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown(server));
      process.on('SIGINT', () => this.shutdown(server));

      return server;
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown(server) {
    logger.info('Shutting down server gracefully...');
    
    server.close(async () => {
      try {
        await dbPool.end();
        await redisClient.disconnect();
        logger.info('Server shut down successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  }
}

// Start server if not in cluster mode
if (require.main === module) {
  const api = new HighPerformanceAPI();
  api.start();
}

module.exports = HighPerformanceAPI;