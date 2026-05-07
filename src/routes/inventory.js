const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getPool } = require('../db');

// GET /api/inventory - Log stok semua produk
router.get('/', async (req, res) => {
  try {
    const { product_id, type, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pool = await getPool();
    const req2 = pool.request()
      .input('limit', sql.Int, parseInt(limit))
      .input('offset', sql.Int, offset);
    let where = 'WHERE 1=1';
    if (product_id) { where += ' AND il.product_id = @product_id'; req2.input('product_id', sql.Int, product_id); }
    if (type) { where += ' AND il.type = @type'; req2.input('type', sql.NVarChar, type); }
    const result = await req2.query(`
      SELECT il.*, p.name as product_name, p.sku
      FROM inventory_log il
      JOIN products p ON il.product_id = p.id
      ${where}
      ORDER BY il.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// POST /api/inventory/in - Stok masuk (tambah stok)
router.post('/in', async (req, res) => {
  try {
    const { product_id, quantity, notes, created_by } = req.body;
    if (!product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'product_id dan quantity (> 0) wajib diisi' });
    }
    const pool = await getPool();
    const product = await pool.request()
      .input('id', sql.Int, product_id)
      .query('SELECT id, name, stock FROM products WHERE id = @id');
    if (product.recordset.length === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    const stockBefore = product.recordset[0].stock;
    const stockAfter = stockBefore + parseInt(quantity);
    // Update stok & log
    await pool.request()
      .input('id', sql.Int, product_id)
      .input('stock', sql.Int, stockAfter)
      .query('UPDATE products SET stock = @stock, updated_at = GETDATE() WHERE id = @id');
    await pool.request()
      .input('product_id', sql.Int, product_id)
      .input('type', sql.NVarChar, 'in')
      .input('quantity', sql.Int, parseInt(quantity))
      .input('stock_before', sql.Int, stockBefore)
      .input('stock_after', sql.Int, stockAfter)
      .input('notes', sql.NVarChar, notes || 'Stok masuk')
      .input('created_by', sql.Int, created_by || null)
      .query('INSERT INTO inventory_log (product_id, type, quantity, stock_before, stock_after, notes, created_by) VALUES (@product_id, @type, @quantity, @stock_before, @stock_after, @notes, @created_by)');
    res.json({ success: true, message: 'Stok berhasil ditambah', data: { product_id, product_name: product.recordset[0].name, stock_before: stockBefore, stock_after: stockAfter, quantity_added: parseInt(quantity) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// POST /api/inventory/adjustment - Koreksi stok (set stok ke nilai tertentu)
router.post('/adjustment', async (req, res) => {
  try {
    const { product_id, new_stock, notes, created_by } = req.body;
    if (product_id === undefined || new_stock === undefined || new_stock < 0) {
      return res.status(400).json({ success: false, message: 'product_id dan new_stock (>= 0) wajib diisi' });
    }
    const pool = await getPool();
    const product = await pool.request()
      .input('id', sql.Int, product_id)
      .query('SELECT id, name, stock FROM products WHERE id = @id');
    if (product.recordset.length === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    const stockBefore = product.recordset[0].stock;
    const diff = parseInt(new_stock) - stockBefore;
    await pool.request()
      .input('id', sql.Int, product_id)
      .input('stock', sql.Int, parseInt(new_stock))
      .query('UPDATE products SET stock = @stock, updated_at = GETDATE() WHERE id = @id');
    await pool.request()
      .input('product_id', sql.Int, product_id)
      .input('type', sql.NVarChar, 'adjustment')
      .input('quantity', sql.Int, diff)
      .input('stock_before', sql.Int, stockBefore)
      .input('stock_after', sql.Int, parseInt(new_stock))
      .input('notes', sql.NVarChar, notes || 'Koreksi stok')
      .input('created_by', sql.Int, created_by || null)
      .query('INSERT INTO inventory_log (product_id, type, quantity, stock_before, stock_after, notes, created_by) VALUES (@product_id, @type, @quantity, @stock_before, @stock_after, @notes, @created_by)');
    res.json({ success: true, message: 'Stok berhasil dikoreksi', data: { product_id, product_name: product.recordset[0].name, stock_before: stockBefore, stock_after: parseInt(new_stock), difference: diff } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/inventory/low-stock - Produk dengan stok menipis
router.get('/low-stock', async (req, res) => {
  try {
    const { threshold = 10 } = req.query;
    const pool = await getPool();
    const result = await pool.request()
      .input('threshold', sql.Int, parseInt(threshold))
      .query('SELECT id, name, sku, stock, category_id, price FROM products WHERE stock <= @threshold AND is_active = 1 ORDER BY stock ASC');
    res.json({ success: true, data: result.recordset, count: result.recordset.length, threshold: parseInt(threshold) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
