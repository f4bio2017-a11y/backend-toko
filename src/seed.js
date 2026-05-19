'use strict';

const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const { getPool } = require('./db');

async function seedProducts() {
  const filePath = path.join(__dirname, '..', 'data', 'seed-products.json');
  if (!fs.existsSync(filePath)) {
    console.log('[seed] data/seed-products.json not found, skipping');
    return;
  }

  let products;
  try {
    products = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('[seed] Failed to parse seed file:', e.message);
    return;
  }
  if (!Array.isArray(products) || products.length === 0) {
    console.log('[seed] No products in seed file');
    return;
  }

  let pool;
  try {
    pool = await getPool();
  } catch (e) {
    console.error('[seed] DB pool unavailable, skipping seed:', e.message);
    return;
  }

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const p of products) {
    const name = String(p.name || '').slice(0, 250);
    const sku = String(p.sku || '').slice(0, 90);
    const price = Number(p.price) || 0;
    const stock = Number(p.stock) || 0;
    const category = String(p.category || '').slice(0, 100);
    if (!name || !sku) { skipped++; continue; }
    try {
      const r = await pool.request()
        .input('name', sql.NVarChar, name)
        .input('sku', sql.NVarChar, sku)
        .input('price', sql.Decimal(18, 2), price)
        .input('stock', sql.Int, stock)
        .input('category', sql.NVarChar, category)
        .query(`
          INSERT INTO products (name, sku, price, stock, category, is_active)
          SELECT @name, @sku, @price, @stock, @category, 1
          WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = @sku)
        `);
      if (r.rowsAffected && r.rowsAffected[0] > 0) inserted++;
      else skipped++;
    } catch (e) {
      errors++;
      if (errors <= 3) console.error('[seed] Insert error for', sku, ':', e.message);
    }
  }

  console.log(`[seed] Done: ${inserted} inserted, ${skipped} skipped, ${errors} errors (total ${products.length})`);
}

module.exports = { seedProducts };
