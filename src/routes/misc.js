// misc.js - Routes: transfers, marketplaces, notifications, mapping
const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const sql = require('mssql');

// ============ TRANSFERS ============
router.get('/transfers', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM transfers ORDER BY date DESC');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/transfers', async (req, res) => {
  try {
    const { id, date, from_warehouse, to_warehouse, bundle_id, qty, notes } = req.body;
    const tid = id || 'T_' + Date.now();
    const pool = await getPool();
    await pool.request()
      .input('id', tid).input('date', date || new Date().toISOString().split('T')[0])
      .input('from_warehouse', from_warehouse || null).input('to_warehouse', to_warehouse || null)
      .input('bundle_id', bundle_id || null).input('qty', qty || 1).input('notes', notes || '')
      .query('INSERT INTO transfers (id,date,from_warehouse,to_warehouse,bundle_id,qty,notes) VALUES (@id,@date,@from_warehouse,@to_warehouse,@bundle_id,@qty,@notes)');
    const r = await pool.request().input('id', tid).query('SELECT * FROM transfers WHERE id=@id');
    res.status(201).json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/transfers/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', req.params.id).query('DELETE FROM transfers WHERE id=@id');
    res.json({ success: true, message: 'Transfer dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ MARKETPLACES ============
router.get('/marketplaces', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM marketplaces ORDER BY platform');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/marketplaces', async (req, res) => {
  try {
    const { id, platform, name, fee_pct, tax_pct } = req.body;
    const mid = id || 'MP_' + Date.now();
    const pool = await getPool();
    await pool.request()
      .input('id', mid).input('platform', platform || 'other').input('name', name || '').input('fee_pct', fee_pct || 0).input('tax_pct', tax_pct || 0)
      .query('INSERT INTO marketplaces (id,platform,name,fee_pct,tax_pct) VALUES (@id,@platform,@name,@fee_pct,@tax_pct)');
    const r = await pool.request().input('id', mid).query('SELECT * FROM marketplaces WHERE id=@id');
    res.status(201).json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/marketplaces/:id', async (req, res) => {
  try {
    const { platform, name, fee_pct, tax_pct, is_active } = req.body;
    const pool = await getPool();
    await pool.request()
      .input('id', req.params.id).input('platform', platform).input('name', name || '').input('fee_pct', fee_pct || 0).input('tax_pct', tax_pct || 0).input('is_active', is_active !== false ? 1 : 0)
      .query('UPDATE marketplaces SET platform=@platform,name=@name,fee_pct=@fee_pct,tax_pct=@tax_pct,is_active=@is_active WHERE id=@id');
    const r = await pool.request().input('id', req.params.id).query('SELECT * FROM marketplaces WHERE id=@id');
    res.json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ NOTIFICATIONS ============
router.get('/notifications', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM notifications ORDER BY created_at DESC');
    res.json({ success: true, data: result.recordset, unread: result.recordset.filter(n => !n.is_read).length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/notifications', async (req, res) => {
  try {
    const { type, title, message } = req.body;
    const pool = await getPool();
    const r = await pool.request()
      .input('type', type || 'info').input('title', title || '').input('message', message || '')
      .query('INSERT INTO notifications (type,title,message) OUTPUT INSERTED.* VALUES (@type,@title,@message)');
    res.status(201).json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', req.params.id).query('UPDATE notifications SET is_read=1 WHERE id=@id');
    res.json({ success: true, message: 'Notifikasi ditandai dibaca' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/notifications/read-all', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('UPDATE notifications SET is_read=1');
    res.json({ success: true, message: 'Semua notifikasi ditandai dibaca' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ MAPPING ============
router.get('/mapping', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT m.*, b.name as bundle_name FROM mapping m LEFT JOIN bundles b ON m.bundle_id=b.id ORDER BY m.platform');
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/mapping/auto', async (req, res) => {
  try {
    const pool = await getPool();
    const bundles = await pool.request().query('SELECT id, name, sku FROM bundles WHERE is_active=1');
    const suggestions = bundles.recordset.map(b => ({
      bundle_id: b.id, bundle_name: b.name, suggested_sku: b.sku || b.name
    }));
    res.json({ success: true, data: suggestions, message: 'Saran mapping otomatis dibuat' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/mapping/bundles/:bundle_id', async (req, res) => {
  try {
    const { platform, marketplace_sku, marketplace_product_id } = req.body;
    const pool = await getPool();
    await pool.request()
      .input('bundle_id', req.params.bundle_id).input('platform', platform || '').input('marketplace_sku', marketplace_sku || '').input('marketplace_product_id', marketplace_product_id || '')
      .query('INSERT INTO mapping (bundle_id,platform,marketplace_sku,marketplace_product_id) VALUES (@bundle_id,@platform,@marketplace_sku,@marketplace_product_id)');
    res.status(201).json({ success: true, message: 'Mapping disimpan' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/mapping/status', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      'SELECT b.id, b.name, COUNT(m.id) as mapped_platforms FROM bundles b LEFT JOIN mapping m ON b.id=m.bundle_id GROUP BY b.id, b.name'
    );
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
