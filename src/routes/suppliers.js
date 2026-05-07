const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

// GET all suppliers
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM suppliers ORDER BY name');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single supplier
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', req.params.id)
      .query('SELECT * FROM suppliers WHERE id = @id');
    if (!result.recordset.length) return res.status(404).json({ success: false, message: 'Supplier tidak ditemukan' });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create supplier
router.post('/', async (req, res) => {
  try {
    const { id, name, phone, address, rating, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name wajib diisi' });
    const sid = id || 'S_' + Date.now();
    const pool = await getPool();
    await pool.request()
      .input('id', sid)
      .input('name', name)
      .input('phone', phone || '-')
      .input('address', address || '-')
      .input('rating', rating || 5.0)
      .input('notes', notes || '')
      .query('INSERT INTO suppliers (id,name,phone,address,rating,notes) VALUES (@id,@name,@phone,@address,@rating,@notes)');
    const r = await pool.request().input('id', sid).query('SELECT * FROM suppliers WHERE id=@id');
    res.status(201).json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update supplier
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, address, rating, notes } = req.body;
    const pool = await getPool();
    await pool.request()
      .input('id', req.params.id)
      .input('name', name)
      .input('phone', phone || '-')
      .input('address', address || '-')
      .input('rating', rating || 5.0)
      .input('notes', notes || '')
      .query('UPDATE suppliers SET name=@name, phone=@phone, address=@address, rating=@rating, notes=@notes, updated_at=GETDATE() WHERE id=@id');
    const r = await pool.request().input('id', req.params.id).query('SELECT * FROM suppliers WHERE id=@id');
    res.json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE supplier
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', req.params.id).query('DELETE FROM suppliers WHERE id=@id');
    res.json({ success: true, message: 'Supplier dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
