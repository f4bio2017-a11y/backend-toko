const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

// GET all bundles with components
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const bundles = await pool.request().query('SELECT * FROM bundles ORDER BY name');
    const components = await pool.request().query(
      'SELECT bc.*, m.name as material_name, m.unit FROM bundle_components bc LEFT JOIN materials m ON bc.material_id=m.id'
    );
    const data = bundles.recordset.map(b => ({
      ...b,
      components: components.recordset.filter(c => c.bundle_id === b.id)
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single bundle
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const bundle = await pool.request().input('id', req.params.id).query('SELECT * FROM bundles WHERE id=@id');
    if (!bundle.recordset.length) return res.status(404).json({ success: false, message: 'Bundle tidak ditemukan' });
    const components = await pool.request().input('id', req.params.id).query(
      'SELECT bc.*, m.name as material_name, m.unit FROM bundle_components bc LEFT JOIN materials m ON bc.material_id=m.id WHERE bc.bundle_id=@id'
    );
    res.json({ success: true, data: { ...bundle.recordset[0], components: components.recordset } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create bundle
router.post('/', async (req, res) => {
  try {
    const { id, name, sku, platform, price, weight, notes, components } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name wajib diisi' });
    const bid = id || 'B_' + Date.now();
    const pool = await getPool();
    await pool.request()
      .input('id', bid).input('name', name).input('sku', sku || '').input('platform', platform || 'all')
      .input('price', price || 0).input('weight', weight || 0).input('notes', notes || '')
      .query('INSERT INTO bundles (id,name,sku,platform,price,weight,notes) VALUES (@id,@name,@sku,@platform,@price,@weight,@notes)');
    if (components && components.length) {
      for (const c of components) {
        await pool.request()
          .input('bundle_id', bid).input('material_id', c.material_id || c.id).input('qty', c.qty || 1)
          .query('INSERT INTO bundle_components (bundle_id,material_id,qty) VALUES (@bundle_id,@material_id,@qty)');
      }
    }
    const r = await pool.request().input('id', bid).query('SELECT * FROM bundles WHERE id=@id');
    res.status(201).json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update bundle
router.put('/:id', async (req, res) => {
  try {
    const { name, sku, platform, price, weight, notes, is_active, components } = req.body;
    const pool = await getPool();
    await pool.request()
      .input('id', req.params.id).input('name', name).input('sku', sku || '').input('platform', platform || 'all')
      .input('price', price || 0).input('weight', weight || 0).input('notes', notes || '').input('is_active', is_active !== false ? 1 : 0)
      .query('UPDATE bundles SET name=@name,sku=@sku,platform=@platform,price=@price,weight=@weight,notes=@notes,is_active=@is_active,updated_at=GETDATE() WHERE id=@id');
    if (components) {
      await pool.request().input('bid', req.params.id).query('DELETE FROM bundle_components WHERE bundle_id=@bid');
      for (const c of components) {
        await pool.request()
          .input('bundle_id', req.params.id).input('material_id', c.material_id || c.id).input('qty', c.qty || 1)
          .query('INSERT INTO bundle_components (bundle_id,material_id,qty) VALUES (@bundle_id,@material_id,@qty)');
      }
    }
    const r = await pool.request().input('id', req.params.id).query('SELECT * FROM bundles WHERE id=@id');
    res.json({ success: true, data: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE bundle
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', req.params.id).query('DELETE FROM bundle_components WHERE bundle_id=@id');
    await pool.request().input('id', req.params.id).query('DELETE FROM bundles WHERE id=@id');
    res.json({ success: true, message: 'Bundle dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
