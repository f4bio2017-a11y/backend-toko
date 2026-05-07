require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

// ===== MIDDLEWARE =====
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger (simple)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log('[' + new Date().toISOString() + '] ' + req.method + ' ' + req.path + ' ' + res.statusCode + ' (' + ms + 'ms)');
    });
    next();
});

// ===== ROUTES =====
// Core
app.use('/api/health', require('./src/routes/health'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/sales', require('./src/routes/sales'));
app.use('/api/auth', require('./src/routes/auth').router);

// Master data
app.use('/api/categories', require('./src/routes/categories'));
app.use('/api/customers', require('./src/routes/customers'));
app.use('/api/inventory', require('./src/routes/inventory'));

// Marketplace integrations
app.use('/api/tiktok', require('./src/routes/tiktok'));
app.use('/api/shopee', require('./src/routes/shopee'));

// ===== ROOT & ERROR HANDLERS =====
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        name: 'Backend Toko API',
        version: '2.1.0',
        endpoints: [
            '/api/health', '/api/products', '/api/sales',
            '/api/auth', '/api/categories', '/api/customers',
            '/api/inventory', '/api/tiktok', '/api/shopee'
        ]
    });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.path });
});

app.use((err, req, res, next) => {
    console.error('[ERROR]', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log('Backend Toko v2.1.0 running on port ' + PORT);
});
