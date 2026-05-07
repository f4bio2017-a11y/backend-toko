const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const sql = require('mssql');

// GET all purchases (with optional limit)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query('SELECT TOP (@limit) p.*, s.name as supplier_name, m.name as material_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id LEFT JOIN materials m ON p.material_id=m.id ORDER BY p.date DESC, p.created_at DESC');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create purchase
router.post('/', async (req, res) => {
  try {
    const { id, date, supplier_id, material_id, qty, unit_price, invoice, notes } = req.body;
    if (!date || !qty || !unit_price) return res.status(400).json({ success: false, message: 'date, qty, unit_price wajib diisi' });
    const pid = id || 'P_' + Date.now();
    const total_price = parseFloat(qty) * parseFloat(unit_price);
    const pool = await getPool();
    await pool.request()
      .input('id', pid).input('date', date).input('supplier_id', supplier_id || null)
      .input('material_id', material_id || null).input('qty', qty).input('unit_price', unit_price)
      .input('total_price', total_price).input('invoice', invoice || '').input('notes', notes || '')
      .query('INSERT INTO purchases (id,date,supplier_id,material_id,qty,unit_price,total_price,invoice,notes) VALUES (@id,@date,@supplier_id,@material_id,@qty,@unit_price,@total_price,@invoice,@notes)');
    // Update material stock
    if (material_id) {
      await pool.request()
        .input('qty', qty).input('material_id', material_id)
        .query('UPDATE materials SET stock=stock+@qty, updated_at=GETDATE() WHERE id=@material_id');
    }
    const r = await pool.request().input('id', pid).query('SELECT * FROM purchases WHERE id=@id');
    res.status(201).json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE purchase
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', req.params.id).query('DELETE FROM purchases WHERE id=@id');
    res.json({ success: true, message: 'Pembelian dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET purchase summary/stats
router.get('/stats/summary', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      'SELECT COUNT(*) as total_orders, SUM(total_price) as total_spent FROM purchases'
    );
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
