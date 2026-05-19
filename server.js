// server.js v3.2.0 - compression + performance
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const app = express();

// == Compression (gzip) - reduces 4.44MB HTML to ~500KB ==
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// == Middleware ==
const allowedOrigin = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({
  origin: allowedOrigin === '*' ? '*' : allowedOrigin.split(',').map(s => s.trim()),
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-API-Key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// == API Key Middleware (optional) ==
// Customer-facing shop endpoints are whitelisted; they rely on JWT (verifyToken)
// for protection instead of the shared API key, which is reserved for backoffice access.
// TODO: remove '/admin' from this list once one-shot seeding is finished.
const SHOP_PUBLIC_PREFIXES = ['/auth', '/products', '/sales', '/admin'];
app.use('/api', (req, res, next) => {
  const apiKey = process.env.APP_API_KEY;
  if (!apiKey) return next();
  if (SHOP_PUBLIC_PREFIXES.some(p => req.path === p || req.path.startsWith(p + '/'))) return next();
  const sentKey = req.headers['x-api-key'] || req.query.api_key;
  if (sentKey !== apiKey) return res.status(401).json({ success: false, message: 'API key tidak valid' });
  next();
});

// == Request Logger ==
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// == HTML Middleware: inject patch-no-charts.js into inventaris-bundling.html ==
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

// == Static Files ==
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true,
  lastModified: true
}));

// == Routes ==
const { router: authRouter, verifyToken } = require('./src/routes/auth');
const productsRouter = require('./src/routes/products');
const salesRouter = require('./src/routes/sales');
const inventoryRouter = require('./src/routes/inventory');
const suppliersRouter = require('./src/routes/suppliers');
const materialsRouter = require('./src/routes/materials');
const bundlesRouter = require('./src/routes/bundles');
const purchasesRouter = require('./src/routes/purchases');
const warehousesRouter = require('./src/routes/warehouses');
const returnsRouter = require('./src/routes/returns');
const miscRouter = require('./src/routes/misc');
const adminRouter = require('./src/routes/admin');

app.use('/api/auth', authRouter);
app.use('/api/products', verifyToken, productsRouter);
app.use('/api/sales', verifyToken, salesRouter);
app.use('/api/inventory', verifyToken, inventoryRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/bundles', bundlesRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/warehouses', warehousesRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/transfers', miscRouter);
app.use('/api/marketplaces', miscRouter);
app.use('/api/notifications', miscRouter);
app.use('/api/mapping', miscRouter);
app.use('/api/admin', adminRouter);

// == Health Check ==
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    version: 'v3.2.0',
    compression: 'enabled',
    message: 'BundleStock Backend API',
    endpoints: [
      'GET /api/suppliers', 'POST /api/suppliers',
      'GET /api/materials', 'POST /api/materials',
      'GET /api/bundles', 'POST /api/bundles',
      'GET /api/purchases', 'POST /api/purchases',
      'GET /api/warehouses', 'POST /api/warehouses',
      'GET /api/returns', 'POST /api/returns',
      'GET /api/transfers', 'POST /api/transfers',
      'GET /api/marketplaces', 'POST /api/marketplaces',
      'GET /api/notifications',
      'GET /api/mapping/:type', 'POST /api/mapping/:type',
      'GET /api/products', 'POST /api/products',
      'GET /api/sales', 'POST /api/sales',
      'GET /api/inventory',
      'POST /api/auth/login', 'POST /api/auth/register'
    ]
  });
});

// == 404 Handler ==
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.path} tidak ditemukan` });
});

// == Error Handler ==
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

// == Start Server ==
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BundleStock Backend v3.2.0 berjalan di port ${PORT}`);
  console.log(`Compression: ENABLED (gzip level 6)`);
  console.log(`Static cache: 1 hour`);
  // Idempotent seed of products from data/seed-products.json (skips existing SKUs)
  require('./src/seed').seedProducts().catch(e => console.error('[seed] Failed:', e.message));
});
