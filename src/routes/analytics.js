const express = require('express');
const dbPool = require('../config/database');
const cache = require('../middleware/cache');

const router = express.Router();

// Get performance metrics
router.get('/performance', cache.cache(60), async (req, res, next) => {
  try {
    const dbStats = await dbPool.getStats();
    const cacheStats = cache.getStats();
    
    // Get request metrics from the last hour
    const performanceResult = await dbPool.query(`
      SELECT 
        COUNT(*) as total_requests,
        AVG(response_time) as avg_response_time,
        MAX(response_time) as max_response_time,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_count
      FROM request_logs 
      WHERE timestamp > NOW() - INTERVAL '1 hour'
    `);

    const metrics = performanceResult.rows[0] || {};

    res.json({
      database: {
        connections: {
          total: dbStats.totalConnections,
          idle: dbStats.idleConnections,
          waiting: dbStats.waitingClients
        }
      },
      cache: cacheStats,
      requests: {
        total: parseInt(metrics.total_requests) || 0,
        avgResponseTime: parseFloat(metrics.avg_response_time) || 0,
        maxResponseTime: parseFloat(metrics.max_response_time) || 0,
        errorCount: parseInt(metrics.error_count) || 0,
        errorRate: metrics.total_requests ? 
          (metrics.error_count / metrics.total_requests * 100).toFixed(2) : 0
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get business analytics
router.get('/business', cache.cache(300), async (req, res, next) => {
  try {
    const period = req.query.period || '7d';
    let interval;
    
    switch (period) {
      case '1d': interval = '1 day'; break;
      case '7d': interval = '7 days'; break;
      case '30d': interval = '30 days'; break;
      default: interval = '7 days';
    }

    const [usersResult, ordersResult, revenueResult, topProductsResult] = await Promise.all([
      // New users
      dbPool.query(`
        SELECT COUNT(*) as new_users,
               COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '${interval}') as period_new_users
        FROM users
      `),
      
      // Orders analytics
      dbPool.query(`
        SELECT COUNT(*) as total_orders,
               COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '${interval}') as period_orders,
               AVG(total_amount) as avg_order_value
        FROM orders
        WHERE status != 'cancelled'
      `),
      
      // Revenue analytics
      dbPool.query(`
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(SUM(total_amount) FILTER (WHERE created_at > NOW() - INTERVAL '${interval}'), 0) as period_revenue
        FROM orders
        WHERE status = 'completed'
      `),
      
      // Top products
      dbPool.query(`
        SELECT p.name, p.price, SUM(oi.quantity) as units_sold, SUM(oi.total_price) as revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at > NOW() - INTERVAL '${interval}' AND o.status != 'cancelled'
        GROUP BY p.id, p.name, p.price
        ORDER BY revenue DESC
        LIMIT 10
      `)
    ]);

    res.json({
      users: {
        total: parseInt(usersResult.rows[0].new_users),
        period: parseInt(usersResult.rows[0].period_new_users)
      },
      orders: {
        total: parseInt(ordersResult.rows[0].total_orders),
        period: parseInt(ordersResult.rows[0].period_orders),
        avgValue: parseFloat(ordersResult.rows[0].avg_order_value) || 0
      },
      revenue: {
        total: parseFloat(revenueResult.rows[0].total_revenue) || 0,
        period: parseFloat(revenueResult.rows[0].period_revenue) || 0
      },
      topProducts: topProductsResult.rows,
      period: period
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;