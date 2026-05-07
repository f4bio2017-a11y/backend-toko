const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getPool } = require('../db');

// Helper: generate slug dari nama
function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// GET /api/categories - List semua kategori
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT c.*, p.name as parent_name FROM categories c LEFT JOIN categories p ON c.parent_id = p.id WHERE c.is_active = 1 ORDER BY c.name');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/categories/:id - Detail kategori + produk di dalamnya
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const cat = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM categories WHERE id = @id');
    if (cat.recordset.length === 0) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    const products = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT id, name, sku, price, stock, is_active FROM products WHERE category_id = @id AND is_active = 1');
    res.json({ success: true, data: { ...cat.recordset[0], products: products.recordset } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// POST /api/categories - Tambah kategori
router.post('/', async (req, res) => {
  try {
    const { name, description, parent_id } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name wajib diisi' });
    const slug = toSlug(name);
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('slug', sql.NVarChar, slug)
      .input('description', sql.NVarChar, description || null)
      .input('parent_id', sql.Int, parent_id || null)
      .query('INSERT INTO categories (name, slug, description, parent_id) OUTPUT INSERTED.* VALUES (@name, @slug, @description, @parent_id)');
    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627) return res.status(409).json({ success: false, message: 'Kategori sudah ada' });
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// PUT /api/categories/:id - Update kategori
router.put('/:id', async (req, res) => {
  try {
    const { name, description, parent_id, is_active } = req.body;
    const pool = await getPool();
    const updates = [];
    const req2 = pool.request().input('id', sql.Int, req.params.id);
    if (name !== undefined) { updates.push('name = @name'); updates.push('slug = @slug'); req2.input('name', sql.NVarChar, name); req2.input('slug', sql.NVarChar, toSlug(name)); }
    if (description !== undefined) { updates.push('description = @description'); req2.input('description', sql.NVarChar, description); }
    if (parent_id !== undefined) { updates.push('parent_id = @parent_id'); req2.input('parent_id', sql.Int, parent_id); }
    if (is_active !== undefined) { updates.push('is_active = @is_active'); req2.input('is_active', sql.Bit, is_active); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'Tidak ada field yang diupdate' });
    const result = await req2.query('UPDATE categories SET ' + updates.join(', ') + ' OUTPUT INSERTED.* WHERE id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
