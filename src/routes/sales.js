'use strict';

const express = require('express');
const router = express.Router();
const { sql, query } = require('../db');

// GET /api/sales - list sales with pagination
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const result = await query(
      'SELECT * FROM sales ORDER BY id OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY',
      { limit, offset }
    );
    const countResult = await query('SELECT COUNT(*) AS total FROM sales');
    res.json({
      success: true,
      data: result.recordset,
      total: countResult.recordset[0].total,
      limit,
      offset,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sales/summary - sales summary
router.get('/summary', async (req, res) => {
  try {
    const result = await query(
      'SELECT COUNT(*) AS total_orders, SUM(total_price) AS total_revenue, AVG(total_price) AS avg_order_value FROM sales'
    );
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sales/:id - get single sale
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM sales WHERE id = @id',
      { id: req.params.id }
    );
    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sales - create sale
router.post('/', async (req, res) => {
  try {
    const { product_id, quantity, unit_price, sale_date, customer_name, notes } = req.body;
    // Calculate total_price automatically
    const total_price = quantity * unit_price;
    const result = await query(
      `INSERT INTO sales (product_id, quantity, unit_price, total_price, sale_date, customer_name, notes)
       OUTPUT INSERTED.*
       VALUES (@product_id, @quantity, @unit_price, @total_price, @sale_date, @customer_name, @notes)`,
      { product_id, quantity, unit_price, total_price, sale_date: sale_date || new Date(), customer_name, notes }
    );
    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
