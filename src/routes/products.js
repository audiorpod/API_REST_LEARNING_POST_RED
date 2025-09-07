const express = require('express');
const { body, validationResult, query } = require('express-validator');
const dbPool = require('../config/database');
const cache = require('../middleware/cache');

const router = express.Router();

// Validation middleware
const validateProduct = [
  body('name').trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isLength({ max: 1000 }),
  body('price').isFloat({ min: 0 }),
  body('category_id').isInt({ min: 1 }),
  body('stock_quantity').isInt({ min: 0 })
];

const validateQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isInt({ min: 1 }),
  query('min_price').optional().isFloat({ min: 0 }),
  query('max_price').optional().isFloat({ min: 0 }),
  query('search').optional().isLength({ max: 100 })
];

// Get products with advanced filtering and caching
router.get('/', validateQuery, cache.cache(180), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE p.active = true';
    const params = [];
    let paramCount = 0;

    // Build dynamic WHERE clause
    if (req.query.category) {
      whereClause += ` AND p.category_id = $${++paramCount}`;
      params.push(req.query.category);
    }

    if (req.query.min_price) {
      whereClause += ` AND p.price >= $${++paramCount}`;
      params.push(req.query.min_price);
    }

    if (req.query.max_price) {
      whereClause += ` AND p.price <= $${++paramCount}`;
      params.push(req.query.max_price);
    }

    if (req.query.search) {
      whereClause += ` AND (p.name ILIKE $${++paramCount} OR p.description ILIKE $${paramCount})`;
      params.push(`%${req.query.search}%`);
    }

    // Main query
    const query = `
      SELECT p.id, p.name, p.description, p.price, p.stock_quantity, 
             p.created_at, p.updated_at, c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    params.push(limit, offset);
    const result = await dbPool.query(query, params);

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) FROM products p 
      JOIN categories c ON p.category_id = c.id
      ${whereClause}
    `;
    const countResult = await dbPool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    res.json({
      products: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: req.query
    });
  } catch (error) {
    next(error);
  }
});

// Get product by ID
router.get('/:id', cache.cache(300), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await dbPool.query(`
      SELECT p.id, p.name, p.description, p.price, p.stock_quantity, 
             p.created_at, p.updated_at, c.name as category_name, c.id as category_id
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1 AND p.active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Create product
router.post('/', validateProduct, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, price, category_id, stock_quantity } = req.body;
    
    const result = await dbPool.query(`
      INSERT INTO products (name, description, price, category_id, stock_quantity, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, name, description, price, category_id, stock_quantity, created_at
    `, [name, description || null, price, category_id, stock_quantity]);

    // Invalidate cache
    await cache.invalidatePattern('products');

    res.status(201).json({
      message: 'Product created successfully',
      product: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Update product
router.put('/:id', validateProduct, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description, price, category_id, stock_quantity } = req.body;
    
    const result = await dbPool.query(`
      UPDATE products 
      SET name = $2, description = $3, price = $4, category_id = $5, 
          stock_quantity = $6, updated_at = NOW()
      WHERE id = $1 AND active = true
      RETURNING id, name, description, price, category_id, stock_quantity, updated_at
    `, [id, name, description || null, price, category_id, stock_quantity]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Invalidate cache
    await cache.invalidatePattern('products');

    res.json({
      message: 'Product updated successfully',
      product: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Delete product (soft delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await dbPool.query(
      'UPDATE products SET active = false, updated_at = NOW() WHERE id = $1 AND active = true RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Invalidate cache
    await cache.invalidatePattern('products');

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;