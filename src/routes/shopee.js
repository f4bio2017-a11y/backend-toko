const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');

const SHOPEE_PARTNER_ID = process.env.SHOPEE_PARTNER_ID || '';
const SHOPEE_PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || '';
const SHOPEE_REDIRECT_URL = process.env.SHOPEE_REDIRECT_URL || '';
const SHOPEE_API_BASE = 'https://partner.shopeemobile.com';

// Helper: generate Shopee signature
function generateShopeeSignature(path, timestamp, accessToken, shopId) {
  let baseStr = SHOPEE_PARTNER_ID + path + timestamp;
  if (accessToken) baseStr += accessToken;
  if (shopId) baseStr += shopId;
  return crypto.createHmac('sha256', SHOPEE_PARTNER_KEY).update(baseStr).digest('hex');
}

// Helper: make Shopee API request
function shopeeRequest(method, path, params, body, accessToken, shopId) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateShopeeSignature(path, String(timestamp), accessToken || '', shopId ? String(shopId) : '');
    const queryParams = {
      partner_id: SHOPEE_PARTNER_ID,
      timestamp: String(timestamp),
      sign,
      ...params
    };
    if (accessToken) queryParams.access_token = accessToken;
    if (shopId) queryParams.shop_id = String(shopId);
    const queryString = Object.keys(queryParams).map(k => k + '=' + encodeURIComponent(queryParams[k])).join('&');
    const options = {
      hostname: 'partner.shopeemobile.com',
      path: path + '?' + queryString,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// GET /api/shopee/status - Status konfigurasi
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      partner_id_configured: !!SHOPEE_PARTNER_ID,
      partner_key_configured: !!SHOPEE_PARTNER_KEY && SHOPEE_PARTNER_KEY !== 'your_shopee_partner_key',
      redirect_url: SHOPEE_REDIRECT_URL || 'Not configured',
      api_base: SHOPEE_API_BASE
    }
  });
});

// GET /api/shopee/auth - Redirect ke Shopee OAuth
router.get('/auth', (req, res) => {
  if (!SHOPEE_PARTNER_ID || !SHOPEE_PARTNER_KEY) {
    return res.status(500).json({ success: false, message: 'SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY belum dikonfigurasi' });
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const path = '/api/v2/shop/auth_partner';
  const sign = generateShopeeSignature(path, String(timestamp), '', '');
  const authUrl = SHOPEE_API_BASE + path + '?' +
    'partner_id=' + SHOPEE_PARTNER_ID +
    '&timestamp=' + timestamp +
    '&sign=' + sign +
    '&redirect=' + encodeURIComponent(SHOPEE_REDIRECT_URL);
  res.json({ success: true, data: { auth_url: authUrl } });
});

// GET /api/shopee/callback - Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, shop_id } = req.query;
    if (!code || !shop_id) {
      return res.status(400).json({ success: false, message: 'code dan shop_id diperlukan' });
    }
    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateShopeeSignature(path, String(timestamp), '', '');
    const body = {
      code,
      shop_id: parseInt(shop_id),
      partner_id: parseInt(SHOPEE_PARTNER_ID)
    };
    const queryParams = {
      partner_id: SHOPEE_PARTNER_ID,
      timestamp: String(timestamp),
      sign
    };
    const queryString = Object.keys(queryParams).map(k => k + '=' + encodeURIComponent(queryParams[k])).join('&');
    const options = {
      hostname: 'partner.shopeemobile.com',
      path: path + '?' + queryString,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };
    const result = await new Promise((resolve, reject) => {
      const req2 = https.request(options, (res2) => {
        let data = '';
        res2.on('data', chunk => data += chunk);
        res2.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
      });
      req2.on('error', reject);
      req2.write(JSON.stringify(body));
      req2.end();
    });
    if (result.error) {
      return res.status(400).json({ success: false, message: result.message, data: result });
    }
    res.json({
      success: true,
      message: 'Shopee OAuth berhasil! Simpan token ini.',
      data: {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expire_in: result.expire_in,
        shop_id: parseInt(shop_id)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/shopee/products - Ambil produk dari Shopee Shop
router.get('/products', async (req, res) => {
  try {
    const { access_token, shop_id, page_size = 20, offset = 0 } = req.query;
    if (!access_token || !shop_id) {
      return res.status(400).json({ success: false, message: 'access_token dan shop_id diperlukan' });
    }
    const result = await shopeeRequest('GET', '/api/v2/product/get_item_list', {
      offset: String(offset),
      page_size: String(page_size),
      item_status: 'NORMAL'
    }, null, access_token, shop_id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/shopee/orders - Ambil order dari Shopee
router.get('/orders', async (req, res) => {
  try {
    const { access_token, shop_id, time_from, time_to, page_size = 20, cursor = '' } = req.query;
    if (!access_token || !shop_id) {
      return res.status(400).json({ success: false, message: 'access_token dan shop_id diperlukan' });
    }
    const now = Math.floor(Date.now() / 1000);
    const params = {
      time_range_field: 'create_time',
      time_from: time_from || String(now - 7 * 24 * 3600), // 7 hari lalu
      time_to: time_to || String(now),
      page_size: String(page_size),
      order_status: 'READY_TO_SHIP'
    };
    if (cursor) params.cursor = cursor;
    const result = await shopeeRequest('GET', '/api/v2/order/get_order_list', params, null, access_token, shop_id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// POST /api/shopee/webhook - Handle Shopee push notification
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const signature = req.headers['authorization'] || '';
    const body = req.body.toString();
    // Verify Shopee signature
    const expected = crypto.createHmac('sha256', SHOPEE_PARTNER_KEY).update(SHOPEE_API_BASE + '/api/shopee/webhook' + '|' + body).digest('hex');
    if (signature && signature !== expected) {
      console.warn('[Shopee Webhook] Invalid signature');
    }
    const event = JSON.parse(body);
    console.log('[Shopee Webhook] Event code:', event.code, '| Shop:', event.shop_id);
    // Event codes: 3=order, 4=order cancel, etc.
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
