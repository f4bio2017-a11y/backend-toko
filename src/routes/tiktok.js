const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');

const TIKTOK_APP_KEY = process.env.TIKTOK_APP_KEY || '';
const TIKTOK_APP_SECRET = process.env.TIKTOK_APP_SECRET || '';
const TIKTOK_REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || '';
const TIKTOK_API_BASE = 'https://open-api.tiktokglobalshop.com';

// Helper: generate HMAC-SHA256 signature for TikTok API
function generateSignature(params, body, path) {
  const sortedParams = Object.keys(params).sort().map(k => k + params[k]).join('');
  const toSign = TIKTOK_APP_SECRET + path + sortedParams + (body || '') + TIKTOK_APP_SECRET;
  return crypto.createHmac('sha256', TIKTOK_APP_SECRET).update(toSign).digest('hex');
}

// Helper: make TikTok API request
function tiktokRequest(method, path, params, body, accessToken) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const allParams = { app_key: TIKTOK_APP_KEY, timestamp: String(timestamp), ...params };
    if (accessToken) allParams.access_token = accessToken;
    const sign = generateSignature(allParams, body ? JSON.stringify(body) : '', path);
    allParams.sign = sign;
    const queryString = Object.keys(allParams).map(k => k + '=' + encodeURIComponent(allParams[k])).join('&');
    const url = new URL(TIKTOK_API_BASE + path + '?' + queryString);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON response: ' + data)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// GET /api/tiktok/status - Check TikTok integration status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      app_key_configured: !!TIKTOK_APP_KEY,
      app_secret_configured: !!TIKTOK_APP_SECRET && TIKTOK_APP_SECRET !== 'your_tiktok_app_secret',
      redirect_uri: TIKTOK_REDIRECT_URI || 'Not configured',
      api_base: TIKTOK_API_BASE
    }
  });
});

// GET /api/tiktok/auth - Redirect to TikTok OAuth
router.get('/auth', (req, res) => {
  if (!TIKTOK_APP_KEY) {
    return res.status(500).json({ success: false, message: 'TIKTOK_APP_KEY belum dikonfigurasi' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = 'https://auth.tiktok-shops.com/oauth/authorize?' +
    'app_key=' + TIKTOK_APP_KEY +
    '&redirect_uri=' + encodeURIComponent(TIKTOK_REDIRECT_URI) +
    '&state=' + state +
    '&response_type=code';
  res.json({ success: true, data: { auth_url: authUrl, state } });
});

// GET /api/tiktok/callback - Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Authorization code tidak ditemukan' });
    }
    // Exchange code for access token
    const tokenRes = await tiktokRequest('GET', '/api/v2/token/get', {
      auth_code: code,
      grant_type: 'authorized_code'
    }, null, null);
    if (tokenRes.code !== 0) {
      return res.status(400).json({ success: false, message: 'Gagal mendapatkan token', data: tokenRes });
    }
    res.json({
      success: true,
      message: 'OAuth berhasil! Simpan token ini.',
      data: {
        access_token: tokenRes.data.access_token,
        refresh_token: tokenRes.data.refresh_token,
        access_token_expire_in: tokenRes.data.access_token_expire_in,
        seller_id: tokenRes.data.seller_id,
        seller_name: tokenRes.data.seller_name
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/tiktok/products - Get TikTok Shop products
router.get('/products', async (req, res) => {
  try {
    const { access_token, page_size = 20, page_number = 1 } = req.query;
    if (!access_token) {
      return res.status(400).json({ success: false, message: 'access_token diperlukan' });
    }
    const result = await tiktokRequest('GET', '/api/products/search', {
      page_size: String(page_size),
      page_number: String(page_number)
    }, null, access_token);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/tiktok/orders - Get TikTok Shop orders
router.get('/orders', async (req, res) => {
  try {
    const { access_token, order_status, page_size = 20, cursor = '' } = req.query;
    if (!access_token) {
      return res.status(400).json({ success: false, message: 'access_token diperlukan' });
    }
    const params = {
      page_size: String(page_size),
      sort_by: 'CREATE_TIME',
      sort_type: '2'
    };
    if (order_status) params.order_status = order_status;
    if (cursor) params.cursor = cursor;
    const result = await tiktokRequest('GET', '/api/orders/search', params, null, access_token);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// POST /api/tiktok/webhook - Handle TikTok webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const signature = req.headers['x-tts-signature'] || '';
    const body = req.body.toString();
    // Verify signature
    const expected = crypto.createHmac('sha256', TIKTOK_APP_SECRET).update(body).digest('hex');
    if (signature && signature !== expected) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }
    const event = JSON.parse(body);
    console.log('[TikTok Webhook]', JSON.stringify(event));
    // Handle different event types
    switch (event.type) {
      case 'ORDER_STATUS_CHANGE':
        console.log('[TikTok] Order status changed:', event.data);
        break;
      case 'PRODUCT_STATUS_CHANGE':
        console.log('[TikTok] Product status changed:', event.data);
        break;
      default:
        console.log('[TikTok] Unknown event type:', event.type);
    }
    res.json({ success: true, message: 'Webhook received' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
