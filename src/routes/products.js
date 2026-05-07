'use strict';

const express = require('express');
const router = express.Router();
const { sql, query } = require('../db');

// GET /api/products - list all products
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM products ORDER BY id');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/:id - get single product
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM products WHERE id = @id',
      { id: req.params.id }
    );
    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products - create product
router.post('/', async (req, res) => {
  try {
    const { name, sku, price, stock } = req.body;
    const result = await query(
      'INSERT INTO products (name, sku, price, stock) OUTPUT INSERTED.* VALUES (@name, @sku, @price, @stock)',
      { name, sku, price, stock }
    );
    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/products/:id - update product
router.put('/:id', async (req, res) => {
  try {
    const { name, sku, price, stock } = req.body;
    const result = await query(
      'UPDATE products SET name=@name, sku=@sku, price=@price, stock=@stock OUTPUT INSERTED.* WHERE id=@id',
      { name, sku, price, stock, id: req.params.id }
    );
    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
