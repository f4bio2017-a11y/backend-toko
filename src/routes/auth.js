const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const { getPool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'toko-secret-key-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Middleware: verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  if (!token) return res.status(401).json({ success: false, message: 'Token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'username, email, dan password wajib diisi' });
    }
    const pool = await getPool();
    // Check existing user
    const existing = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('username', sql.NVarChar, username)
      .query('SELECT id FROM users WHERE email = @email OR username = @username');
    if (existing.recordset.length > 0) {
      return res.status(409).json({ success: false, message: 'Username atau email sudah terdaftar' });
    }
    const password_hash = await bcrypt.hash(password, 12);
    const userRole = role === 'admin' ? 'admin' : 'user';
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .input('email', sql.NVarChar, email)
      .input('password_hash', sql.NVarChar, password_hash)
      .input('role', sql.NVarChar, userRole)
      .query('INSERT INTO users (username, email, password_hash, role) OUTPUT INSERTED.id, INSERTED.username, INSERTED.email, INSERTED.role VALUES (@username, @email, @password_hash, @role)');
    const newUser = result.recordset[0];
    const token = jwt.sign({ id: newUser.id, username: newUser.username, role: newUser.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({ success: true, message: 'Registrasi berhasil', data: { user: newUser, token } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' });
    }
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id, username, email, password_hash, role, is_active FROM users WHERE email = @email');
    if (result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }
    const user = result.recordset[0];
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Akun dinonaktifkan' });
    }
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ success: true, message: 'Login berhasil', data: { user: { id: user.id, username: user.username, email: user.email, role: user.role }, token } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/auth/profile (protected)
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT id, username, email, role, is_active, created_at FROM users WHERE id = @id');
    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// PUT /api/auth/change-password (protected)
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'current_password dan new_password wajib diisi' });
    }
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT password_hash FROM users WHERE id = @id');
    const valid = await bcrypt.compare(current_password, result.recordset[0].password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Password lama salah' });
    const new_hash = await bcrypt.hash(new_password, 12);
    await pool.request()
      .input('id', sql.Int, req.user.id)
      .input('hash', sql.NVarChar, new_hash)
      .query('UPDATE users SET password_hash = @hash, updated_at = GETDATE() WHERE id = @id');
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = { router, verifyToken };
