const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const sql = require('mssql');

// GET all returns (with optional days filter)
router.get('/', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const pool = await getPool();
    const result = await pool.request()
      .input('days', sql.Int, days)
      .query('SELECT * FROM returns WHERE date >= DATEADD(day, -@days, GETDATE()) ORDER BY date DESC');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create return
router.post('/', async (req, res) => {
  try {
    const { id, date, platform, order_id, bundle_id, qty, reason, refund, status } = req.body;
    if (!date) return res.status(400).json({ success: false, message: 'date wajib diisi' });
    const rid = id || 'R_' + Date.now();
    const pool = await getPool();
    await pool.request()
      .input('id', rid).input('date', date).input('platform', platform || '').input('order_id', order_id || '')
      .input('bundle_id', bundle_id || null).input('qty', qty || 1).input('reason', reason || '')
      .input('refund', refund || 0).input('status', status || 'pending')
      .query('INSERT INTO returns (id,date,platform,order_id,bundle_id,qty,reason,refund,status) VALUES (@id,@date,@platform,@order_id,@bundle_id,@qty,@reason,@refund,@status)');
    const r = await pool.request().input('id', rid).query('SELECT * FROM returns WHERE id=@id');
    res.status(201).json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update return status
router.put('/:id', async (req, res) => {
  try {
    const { status, refund } = req.body;
    const pool = await getPool();
    await pool.request()
      .input('id', req.params.id).input('status', status || 'pending').input('refund', refund || 0)
      .query('UPDATE returns SET status=@status, refund=@refund WHERE id=@id');
    const r = await pool.request().input('id', req.params.id).query('SELECT * FROM returns WHERE id=@id');
    res.json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE return
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', req.params.id).query('DELETE FROM returns WHERE id=@id');
    res.json({ success: true, message: 'Retur dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
