'use strict';

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getPool, query } = require('../db');

const isAdmin = (req) => req.user && req.user.role === 'admin';
const requireAdmin = (req, res, next) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
};

// GET /api/products - list products
// Admin sees all (incl inactive); regular users only see active.
router.get('/', async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true' && isAdmin(req);
    const sqlStr = includeInactive
      ? 'SELECT * FROM products ORDER BY id DESC'
      : 'SELECT * FROM products WHERE is_active = 1 ORDER BY id DESC';
    const result = await query(sqlStr);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM products WHERE id = @id', { id: req.params.id });
    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, sku, description, price, stock, category, image_url, is_active } = req.body;
    if (!name || !sku) {
      return res.status(400).json({ success: false, message: 'name dan sku wajib diisi' });
    }
    const pool = await getPool();
    const r = await pool.request()
      .input('name', sql.NVarChar, String(name).slice(0, 250))
      .input('sku', sql.NVarChar, String(sku).slice(0, 90))
      .input('description', sql.NVarChar, description ? String(description) : null)
      .input('price', sql.Decimal(18, 2), Number(price) || 0)
      .input('stock', sql.Int, Number(stock) || 0)
      .input('category', sql.NVarChar, category ? String(category).slice(0, 100) : null)
      .input('image_url', sql.NVarChar, image_url ? String(image_url).slice(0, 1000) : null)
      .input('is_active', sql.Bit, is_active === false ? 0 : 1)
      .query(`
        INSERT INTO products (name, sku, description, price, stock, category, image_url, is_active)
        OUTPUT INSERTED.*
        VALUES (@name, @sku, @description, @price, @stock, @category, @image_url, @is_active)
      `);
    res.status(201).json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/products/:id (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, sku, description, price, stock, category, image_url, is_active } = req.body;
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('name', sql.NVarChar, name != null ? String(name).slice(0, 250) : null)
      .input('sku', sql.NVarChar, sku != null ? String(sku).slice(0, 90) : null)
      .input('description', sql.NVarChar, description != null ? String(description) : null)
      .input('price', sql.Decimal(18, 2), price != null ? Number(price) : null)
      .input('stock', sql.Int, stock != null ? Number(stock) : null)
      .input('category', sql.NVarChar, category != null ? String(category).slice(0, 100) : null)
      .input('image_url', sql.NVarChar, image_url != null ? String(image_url).slice(0, 1000) : null)
      .input('is_active', sql.Bit, is_active != null ? (is_active ? 1 : 0) : null)
      .query(`
        UPDATE products
        SET name = COALESCE(@name, name),
            sku = COALESCE(@sku, sku),
            description = CASE WHEN @description IS NULL THEN description ELSE @description END,
            price = COALESCE(@price, price),
            stock = COALESCE(@stock, stock),
            category = CASE WHEN @category IS NULL THEN category ELSE @category END,
            image_url = CASE WHEN @image_url IS NULL THEN image_url ELSE @image_url END,
            is_active = COALESCE(@is_active, is_active)
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    if (r.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/products/:id (admin only) — soft delete (is_active = 0)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('UPDATE products SET is_active = 0 OUTPUT INSERTED.* WHERE id = @id');
    if (r.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
