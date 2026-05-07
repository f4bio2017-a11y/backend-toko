# backend-toko 🛒

Backend API untuk sistem e-commerce **BundleStock** — dibangun dengan Node.js, Express, dan Azure SQL Database. Deploy otomatis ke Azure App Service via GitHub Actions.

## 🌐 URL Produksi

```
https://backend-toko-agerfpc6fpgndhbt.centralindia-01.azurewebsites.net
```

## 🏗️ Arsitektur

- **Runtime**: Node.js 20.20.2 di Azure App Service (Windows, iisnode)
- **Database**: Azure SQL (Serverless) — bundlestock
- **CI/CD**: GitHub Actions → Azure App Service
- **Auth**: JWT (jsonwebtoken + bcryptjs)

## 📋 API Endpoints

### Health
| Method | Path | Keterangan |
|--------|------|------------|
| GET | /api/health | Cek status server & database |

### Products
| Method | Path | Keterangan |
|--------|------|------------|
| GET | /api/products | List semua produk |
| GET | /api/products/:id | Detail produk |
| POST | /api/products | Tambah produk baru |
| PUT | /api/products/:id | Update produk |

### Sales
| Method | Path | Keterangan |
|--------|------|------------|
| GET | /api/sales | List semua penjualan |
| GET | /api/sales/summary | Ringkasan penjualan (total, revenue) |
| POST | /api/sales | Catat penjualan baru |

### Authentication
| Method | Path | Keterangan |
|--------|------|------------|
| POST | /api/auth/register | Daftar user baru |
| POST | /api/auth/login | Login & dapatkan JWT token |
| GET | /api/auth/profile | Profil user (🔒 token required) |
| PUT | /api/auth/change-password | Ganti password (🔒 token required) |

### TikTok Shop
| Method | Path | Keterangan |
|--------|------|------------|
| GET | /api/tiktok/status | Status konfigurasi TikTok |
| GET | /api/tiktok/auth | URL OAuth TikTok Shop |
| GET | /api/tiktok/callback | Callback OAuth (exchange code → token) |
| GET | /api/tiktok/products | List produk TikTok Shop |
| GET | /api/tiktok/orders | List order TikTok Shop |
| POST | /api/tiktok/webhook | Handler webhook TikTok |

## 🔑 Autentikasi JWT

Endpoint yang dilindungi membutuhkan Bearer Token di header:

```
Authorization: Bearer <jwt_token>
```

### Contoh Login

```bash
curl -X POST https://backend-toko-agerfpc6fpgndhbt.centralindia-01.azurewebsites.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bundlestock.com","password":"Admin@2026!"}'
```

## 🗄️ Database Schema

```sql
-- Products
CREATE TABLE products (
  id INT IDENTITY PRIMARY KEY,
  name NVARCHAR(255) NOT NULL,
  sku NVARCHAR(100) UNIQUE,
  price DECIMAL(18,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  category NVARCHAR(100),
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 DEFAULT GETDATE()
);

-- Sales
CREATE TABLE sales (
  id INT IDENTITY PRIMARY KEY,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(18,2) NOT NULL,
  total_price DECIMAL(18,2) NOT NULL,
  customer_name NVARCHAR(255),
  sale_date DATETIME2 DEFAULT GETDATE()
);

-- Users
CREATE TABLE users (
  id INT IDENTITY PRIMARY KEY,
  username NVARCHAR(100) NOT NULL UNIQUE,
  email NVARCHAR(255) NOT NULL UNIQUE,
  password_hash NVARCHAR(500) NOT NULL,
  role NVARCHAR(50) DEFAULT 'user',
  is_active BIT DEFAULT 1,
  created_at DATETIME2 DEFAULT GETDATE()
);
```

## ⚙️ Environment Variables

| Variable | Keterangan |
|----------|------------|
| SQL_SERVER | Azure SQL server hostname |
| SQL_DATABASE | Nama database |
| SQL_USER | Username database |
| SQL_PASSWORD | Password database |
| JWT_SECRET | Secret key untuk JWT |
| JWT_EXPIRES_IN | Masa berlaku token (default: 24h) |
| FRONTEND_ORIGIN | URL frontend untuk CORS |
| TIKTOK_APP_KEY | App Key dari TikTok Developer |
| TIKTOK_APP_SECRET | App Secret dari TikTok Developer |
| TIKTOK_REDIRECT_URI | Callback URL untuk OAuth TikTok |

## 🚀 Deploy

Push ke branch `main` akan otomatis trigger GitHub Actions untuk deploy ke Azure.

## 📊 GitHub Actions History

- Workflow #1: Initial setup
- Workflow #2: Update web.config
- Workflow #3: Fix Node.js 20.20.2 path
- Workflow #4: Fix auto-calculate total_price
- Workflow #5: Add JWT auth routes
- Workflow #6: Add TikTok Shop routes
- Workflow #7: Register routes in server.js ✅
