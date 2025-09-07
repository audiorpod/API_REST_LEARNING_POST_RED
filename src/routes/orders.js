const express = require('express');
const { body, validationResult } = require('express-validator');
const dbPool = require('../config/database');
const cache = require('../middleware/cache');

const router = express.Router();

// Create order
router.post('/', [
  body('items').isArray({ min: 1 }),
  body('items.*.product_id').isInt({ min: 1 }),
  body('items.*.quantity').isInt({ min: 1 }),
  body('shipping_address').isObject(),
  body('payment_method').isIn(['credit_card', 'paypal', 'bank_transfer'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { items, shipping_address, payment_method } = req.body;
    const user_id = req.user.id;

    // Transaction for order creation
    const result = await dbPool.transaction(async (client) => {
      // Create order
      const orderResult = await client.query(`
        INSERT INTO orders (user_id, status, shipping_address, payment_method, created_at)
        VALUES ($1, 'pending', $2, $3, NOW())
        RETURNING id, status, created_at
      `, [user_id, JSON.stringify(shipping_address), payment_method]);

      const order = orderResult.rows[0];
      let totalAmount = 0;

      // Create order items and update stock
      for (const item of items) {
        const { product_id, quantity } = item;

        // Get product price and check stock
        const productResult = await client.query(
          'SELECT price, stock_quantity FROM products WHERE id = $1 AND active = true',
          [product_id]
        );

        if (productResult.rows.length === 0) {
          throw new Error(`Product ${product_id} not found`);
        }

        const product = productResult.rows[0];
        if (product.stock_quantity < quantity) {
          throw new Error(`Insufficient stock for product ${product_id}`);
        }

        const itemTotal = product.price * quantity;
        totalAmount += itemTotal;

        // Insert order item
        await client.query(`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5)
        `, [order.id, product_id, quantity, product.price, itemTotal]);

        // Update product stock
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
          [quantity, product_id]
        );
      }

      // Update order total
      await client.query(
        'UPDATE orders SET total_amount = $1 WHERE id = $2',
        [totalAmount, order.id]
      );

      return { ...order, total_amount: totalAmount };
    });

    // Invalidate relevant caches
    await cache.invalidatePattern('orders');
    await cache.invalidatePattern('products');

    res.status(201).json({
      message: 'Order created successfully',
      order: result
    });
  } catch (error) {
    next(error);
  }
});

// Get user orders
router.get('/', cache.cache(60), async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;

    const result = await dbPool.query(`
      SELECT o.id, o.status, o.total_amount, o.payment_method, o.created_at, o.updated_at,
             COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1
      GROUP BY o.id, o.status, o.total_amount, o.payment_method, o.created_at, o.updated_at
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `, [user_id, limit, offset]);

    const countResult = await dbPool.query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1',
      [user_id]
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      orders: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get order details
router.get('/:id', cache.cache(60), async (req, res, next) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const orderResult = await dbPool.query(`
      SELECT o.*, 
             json_agg(
               json_build_object(
                 'product_id', oi.product_id,
                 'product_name', p.name,
                 'quantity', oi.quantity,
                 'unit_price', oi.unit_price,
                 'total_price', oi.total_price
               )
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.id = $1 AND o.user_id = $2
      GROUP BY o.id
    `, [id, user_id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order: orderResult.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;