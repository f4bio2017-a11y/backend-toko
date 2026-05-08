const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

// ── Middleware ──────────────────────────────────────────────
const allowedOrigin = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({
  origin: allowedOrigin === '*' ? '*' : allowedOrigin.split(',').map(s => s.trim()),
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-API-Key']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── API Key Middleware (optional) ────────────────────────────
app.use('/api', (req, res, next) => {
  const apiKey = process.env.APP_API_KEY;
  if (!apiKey) return next();
  const sentKey = req.headers['x-api-key'] || req.query.api_key;
  if (sentKey !== apiKey) return res.status(401).json({ success: false, message: 'API key tidak valid' });
  next();
});

// ── Request Logger ───────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── HTML Middleware: inject patch-no-charts.js into inventaris-bundling.html ──
app.get('/inventaris-bundling.html', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'inventaris-bundling.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(404).send('File tidak ditemukan');
    // Inject patch script before </head>
    const patched = data
      .replace(
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>',
        '<!-- Chart.js disabled for performance -->'
      )
      .replace(
        '</head>',
        '<script src="/patch-no-charts.js"></script>\n</head>'
      );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(patched);
  });
});

// ── Static Files (Frontend) ──────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ───────────────────────────────────────────────
app.use('/api/health',         require('./src/routes/health'));
app.use('/api/auth',           require('./src/routes/auth').router);
app.use('/api/products',       require('./src/routes/products'));
app.use('/api/sales',          require('./src/routes/sales'));
app.use('/api/categories',     require('./src/routes/categories'));
app.use('/api/customers',      require('./src/routes/customers'));
app.use('/api/inventory',      require('./src/routes/inventory'));
app.use('/api/suppliers',      require('./src/routes/suppliers'));
app.use('/api/materials',      require('./src/routes/materials'));
app.use('/api/warehouses',     require('./src/routes/warehouses'));
app.use('/api/bundles',        require('./src/routes/bundles'));
app.use('/api/purchases',      require('./src/routes/purchases'));
app.use('/api/returns',        require('./src/routes/returns'));
app.use('/api',                require('./src/routes/misc'));
app.use('/api/tiktok',         require('./src/routes/tiktok'));
app.use('/api/shopee',         require('./src/routes/shopee'));

// ── Root Endpoint ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'BundleStock Backend API',
    version: '3.1.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health:        '/api/health',
      auth:          '/api/auth',
      products:      '/api/products',
      sales:         '/api/sales',
      categories:    '/api/categories',
      customers:     '/api/customers',
      inventory:     '/api/inventory',
      suppliers:     '/api/suppliers',
      materials:     '/api/materials',
      warehouses:    '/api/warehouses',
      bundles:       '/api/bundles',
      purchases:     '/api/purchases',
      returns:       '/api/returns',
      transfers:     '/api/transfers',
      marketplaces:  '/api/marketplaces',
      notifications: '/api/notifications',
      mapping:       '/api/mapping',
      tiktok:        '/api/tiktok',
      shopee:        '/api/shopee',
      frontend:      '/inventaris-bundling.html'
    }
  });
});

// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan', path: req.path });
});

// ── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// ── Start Server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BundleStock API v3.1.0 berjalan di port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
});

module.exports = app;
