const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

// GET all materials
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      'SELECT m.*, s.name as supplier_name FROM materials m LEFT JOIN suppliers s ON m.supplier_id=s.id ORDER BY m.name'
    );
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single material
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', req.params.id)
      .query('SELECT * FROM materials WHERE id=@id');
    if (!result.recordset.length) return res.status(404).json({ success: false, message: 'Material tidak ditemukan' });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create material
router.post('/', async (req, res) => {
  try {
    const { id, name, unit, stock, hpp, supplier_id, min_stock, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name wajib diisi' });
    const mid = id || 'M_' + Date.now();
    const pool = await getPool();
    await pool.request()
      .input('id', mid)
      .input('name', name)
      .input('unit', unit || 'pcs')
      .input('stock', stock || 0)
      .input('hpp', hpp || 0)
      .input('supplier_id', supplier_id || null)
      .input('min_stock', min_stock || 0)
      .input('notes', notes || '')
      .query('INSERT INTO materials (id,name,unit,stock,hpp,supplier_id,min_stock,notes) VALUES (@id,@name,@unit,@stock,@hpp,@supplier_id,@min_stock,@notes)');
    const r = await pool.request().input('id', mid).query('SELECT * FROM materials WHERE id=@id');
    res.status(201).json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update material
router.put('/:id', async (req, res) => {
  try {
    const { name, unit, stock, hpp, supplier_id, min_stock, notes } = req.body;
    const pool = await getPool();
    await pool.request()
      .input('id', req.params.id)
      .input('name', name)
      .input('unit', unit || 'pcs')
      .input('stock', stock || 0)
      .input('hpp', hpp || 0)
      .input('supplier_id', supplier_id || null)
      .input('min_stock', min_stock || 0)
      .input('notes', notes || '')
      .query('UPDATE materials SET name=@name,unit=@unit,stock=@stock,hpp=@hpp,supplier_id=@supplier_id,min_stock=@min_stock,notes=@notes,updated_at=GETDATE() WHERE id=@id');
    const r = await pool.request().input('id', req.params.id).query('SELECT * FROM materials WHERE id=@id');
    res.json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE material
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', req.params.id).query('DELETE FROM materials WHERE id=@id');
    res.json({ success: true, message: 'Material dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH update stock only
router.patch('/:id/stock', async (req, res) => {
  try {
    const { stock } = req.body;
    const pool = await getPool();
    await pool.request()
      .input('id', req.params.id)
      .input('stock', stock)
      .query('UPDATE materials SET stock=@stock, updated_at=GETDATE() WHERE id=@id');
    res.json({ success: true, message: 'Stok diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
