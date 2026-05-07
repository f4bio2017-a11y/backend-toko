'use strict';

const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

// GET /api/health
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS alive');
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
