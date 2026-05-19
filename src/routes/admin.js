'use strict';

const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { seedProducts } = require('../seed');

// POST /api/admin/seed-products
// Run the product seeder on demand. Returns counts and sample errors.
router.post('/seed-products', async (req, res) => {
  try {
    const result = await seedProducts();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/products-stats
// Lightweight diagnostic: total products, with category, active.
router.get('/products-stats', async (req, res) => {
  try {
    const pool = await getPool();
    const colsRes = await pool.request().query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'products'`
    );
    const cols = colsRes.recordset.map(r => r.COLUMN_NAME);
    const totalRes = await pool.request().query('SELECT COUNT(*) AS total FROM products');
    res.json({
      success: true,
      data: {
        total: totalRes.recordset[0].total,
        columns: cols,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
