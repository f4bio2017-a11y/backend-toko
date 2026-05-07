const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getPool } = require('../db');

// GET /api/customers - List semua pelanggan
router.get('/', async (req, res) => {
  try {
    const { search, city, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pool = await getPool();
    const req2 = pool.request()
      .input('limit', sql.Int, parseInt(limit))
      .input('offset', sql.Int, offset);
    let where = 'WHERE 1=1';
    if (search) { where += ' AND (name LIKE @search OR email LIKE @search OR phone LIKE @search)'; req2.input('search', sql.NVarChar, '%' + search + '%'); }
    if (city) { where += ' AND city = @city'; req2.input('city', sql.NVarChar, city); }
    const countResult = await req2.query('SELECT COUNT(*) as total FROM customers ' + where);
    const total = countResult.recordset[0].total;
    const result = await req2.query('SELECT * FROM customers ' + where + ' ORDER BY total_orders DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY');
    res.json({ success: true, data: result.recordset, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/customers/:id - Detail pelanggan + riwayat order
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const customer = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM customers WHERE id = @id');
    if (customer.recordset.length === 0) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
    const orders = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT s.*, p.name as product_name FROM sales s JOIN products p ON s.product_id = p.id WHERE s.customer_id = @id ORDER BY s.sale_date DESC');
    res.json({ success: true, data: { ...customer.recordset[0], orders: orders.recordset } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// POST /api/customers - Tambah pelanggan baru
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, address, city, province, source } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name wajib diisi' });
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email || null)
      .input('phone', sql.NVarChar, phone || null)
      .input('address', sql.NVarChar, address || null)
      .input('city', sql.NVarChar, city || null)
      .input('province', sql.NVarChar, province || null)
      .input('source', sql.NVarChar, source || 'manual')
      .query('INSERT INTO customers (name, email, phone, address, city, province, source) OUTPUT INSERTED.* VALUES (@name, @email, @phone, @address, @city, @province, @source)');
    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627) return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// PUT /api/customers/:id - Update pelanggan
router.put('/:id', async (req, res) => {
  try {
    const { name, email, phone, address, city, province } = req.body;
    const pool = await getPool();
    const updates = [];
    const req2 = pool.request().input('id', sql.Int, req.params.id);
    if (name !== undefined) { updates.push('name = @name'); req2.input('name', sql.NVarChar, name); }
    if (email !== undefined) { updates.push('email = @email'); req2.input('email', sql.NVarChar, email); }
    if (phone !== undefined) { updates.push('phone = @phone'); req2.input('phone', sql.NVarChar, phone); }
    if (address !== undefined) { updates.push('address = @address'); req2.input('address', sql.NVarChar, address); }
    if (city !== undefined) { updates.push('city = @city'); req2.input('city', sql.NVarChar, city); }
    if (province !== undefined) { updates.push('province = @province'); req2.input('province', sql.NVarChar, province); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'Tidak ada field yang diupdate' });
    updates.push('updated_at = GETDATE()');
    const result = await req2.query('UPDATE customers SET ' + updates.join(', ') + ' OUTPUT INSERTED.* WHERE id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/customers/stats/top - Top pelanggan berdasarkan total belanja
router.get('/stats/top', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, parseInt(limit))
      .query('SELECT TOP (@limit) id, name, email, city, total_orders, total_spent FROM customers ORDER BY total_spent DESC');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
