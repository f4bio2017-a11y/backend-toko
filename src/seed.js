'use strict';

const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const { getPool } = require('./db');

async function loadSeedFile() {
  const filePath = path.join(__dirname, '..', 'data', 'seed-products.json');
  if (!fs.existsSync(filePath)) {
    console.log('[seed] data/seed-products.json not found at', filePath);
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(data)) return [];
    return data;
  } catch (e) {
    console.error('[seed] Failed to parse seed file:', e.message);
    return [];
  }
}

async function getProductColumns(pool) {
  const res = await pool.request().query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'products'`
  );
  return new Set(res.recordset.map(r => String(r.COLUMN_NAME).toLowerCase()));
}

async function seedProducts(options = {}) {
  const products = await loadSeedFile();
  console.log(`[seed] Loaded ${products.length} products from seed file`);
  if (products.length === 0) return { loaded: 0, inserted: 0, skipped: 0, errors: 0, sampleErrors: [] };

  let pool;
  try {
    pool = await getPool();
  } catch (e) {
    console.error('[seed] DB pool unavailable:', e.message);
    return { loaded: products.length, inserted: 0, skipped: 0, errors: 1, sampleErrors: [e.message] };
  }

  let cols;
  try {
    cols = await getProductColumns(pool);
  } catch (e) {
    console.error('[seed] Failed to inspect products schema:', e.message);
    return { loaded: products.length, inserted: 0, skipped: 0, errors: 1, sampleErrors: [e.message] };
  }
  console.log('[seed] products columns:', Array.from(cols).join(', '));

  const hasCategory = cols.has('category');
  const hasIsActive = cols.has('is_active');

  const columnNames = ['name', 'sku', 'price', 'stock'];
  const paramNames = ['@name', '@sku', '@price', '@stock'];
  if (hasCategory) { columnNames.push('category'); paramNames.push('@category'); }
  if (hasIsActive) { columnNames.push('is_active'); paramNames.push('1'); }

  const insertSql = `
    INSERT INTO products (${columnNames.join(', ')})
    SELECT ${paramNames.join(', ')}
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = @sku)
  `;

  let inserted = 0, skipped = 0, errors = 0;
  const sampleErrors = [];

  for (const p of products) {
    const name = String(p.name || '').slice(0, 250);
    const sku = String(p.sku || '').slice(0, 90);
    const price = Number(p.price) || 0;
    const stock = Number(p.stock) || 0;
    const category = String(p.category || '').slice(0, 100);
    if (!name || !sku) { skipped++; continue; }
    try {
      const req = pool.request()
        .input('name', sql.NVarChar, name)
        .input('sku', sql.NVarChar, sku)
        .input('price', sql.Decimal(18, 2), price)
        .input('stock', sql.Int, stock);
      if (hasCategory) req.input('category', sql.NVarChar, category);
      const r = await req.query(insertSql);
      if (r.rowsAffected && r.rowsAffected[0] > 0) inserted++;
      else skipped++;
    } catch (e) {
      errors++;
      if (sampleErrors.length < 5) sampleErrors.push(`${sku}: ${e.message}`);
    }
  }

  console.log(`[seed] Done: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
  if (sampleErrors.length) console.error('[seed] Sample errors:', sampleErrors);
  return { loaded: products.length, inserted, skipped, errors, sampleErrors, hasCategory, hasIsActive };
}

module.exports = { seedProducts };
