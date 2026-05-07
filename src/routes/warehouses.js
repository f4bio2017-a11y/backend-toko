const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

// GET all warehouses
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM warehouses ORDER BY name');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create warehouse
router.post('/', async (req, res) => {
  try {
    const { id, name, location, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name wajib diisi' });
    const wid = id || 'W_' + Date.now();
    const pool = await getPool();
    await pool.request()
      .input('id', wid).input('name', name).input('location', location || '').input('notes', notes || '')
      .query('INSERT INTO warehouses (id,name,location,notes) VALUES (@id,@name,@location,@notes)');
    const r = await pool.request().input('id', wid).query('SELECT * FROM warehouses WHERE id=@id');
    res.status(201).json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update warehouse
router.put('/:id', async (req, res) => {
  try {
    const { name, location, notes } = req.body;
    const pool = await getPool();
    await pool.request()
      .input('id', req.params.id).input('name', name).input('location', location || '').input('notes', notes || '')
      .query('UPDATE warehouses SET name=@name, location=@location, notes=@notes WHERE id=@id');
    const r = await pool.request().input('id', req.params.id).query('SELECT * FROM warehouses WHERE id=@id');
    res.json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE warehouse
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', req.params.id).query('DELETE FROM warehouses WHERE id=@id');
    res.json({ success: true, message: 'Gudang dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
