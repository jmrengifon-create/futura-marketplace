// gateway/index.js — API Gateway (Port 8080)
// Routes all requests to appropriate microservices
require('dotenv').config();
const express    = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Redis      = require('ioredis');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');

const app   = express();
const redis = new Redis({ host: process.env.REDIS_HOST || 'redis', port: 6379, lazyConnect: true });
redis.connect().catch(() => {});

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ─── Services map ─────────────────────────────────────────
const SERVICES = {
  USER:       process.env.USER_SERVICE_URL      || 'http://backend:3001',
  PRODUCT:    process.env.PRODUCT_SERVICE_URL   || 'http://backend:3001',
  ORDER:      process.env.ORDER_SERVICE_URL      || 'http://backend:3001',
  QUOTATION:  process.env.QUOTATION_SERVICE_URL  || 'http://backend:3001',
  PAYMENT:    process.env.PAYMENT_SERVICE_URL    || 'http://backend:3001',
  SHIPPING:   process.env.SHIPPING_SERVICE_URL   || 'http://backend:3001',
  WHATSAPP:   process.env.WHATSAPP_SERVICE_URL   || 'http://whatsapp:3007',
  ANALYTICS:  process.env.ANALYTICS_SERVICE_URL  || 'http://analytics:3009',
  ADMIN:      process.env.ADMIN_SERVICE_URL       || 'http://backend:3001',
};

// ─── Rate limiting ────────────────────────────────────────
const rateLimit = (max, windowSec, keyFn = (r) => r.ip) => async (req, res, next) => {
  const key   = `gw:rl:${keyFn(req)}:${Math.floor(Date.now() / (windowSec * 1000))}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    res.setHeader('X-RateLimit-Limit',     max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
    if (count > max) return res.status(429).json({ error: 'Too many requests', retry_after: windowSec });
  } catch { /* Redis down — allow request */ }
  next();
};

// ─── Auth verification ────────────────────────────────────
const verifyAuth = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h) return next();
  try {
    req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    req.headers['x-user-id']   = String(req.user.id);
    req.headers['x-user-role'] = req.user.role;
  } catch { /* Invalid token — let service handle it */ }
  next();
};

// ─── Request logger ───────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const traceId = `gw-${Date.now().toString(36)}-${Math.random().toString(36).substr(2,6)}`;
  req.headers['x-trace-id'] = traceId;
  res.setHeader('x-trace-id', traceId);
  res.on('finish', () => {
    if (req.path !== '/health')
      console.log(JSON.stringify({ gateway: true, method: req.method, path: req.path, status: res.statusCode, ms: Date.now()-start, trace: traceId }));
  });
  next();
});

// ─── Global middleware ────────────────────────────────────
app.use(rateLimit(200, 60));   // 200 req/min per IP
app.use(verifyAuth);

// ─── Health ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gateway', services: Object.keys(SERVICES) }));

// ─── Route definitions ────────────────────────────────────
const proxy = (target, pathRewrite = {}) =>
  createProxyMiddleware({ target, changeOrigin: true, pathRewrite, on: { error: (e, req, res) => res.status(502).json({ error: 'Service unavailable', detail: e.message }) } });

// Auth endpoints → User Service (strict rate limit)
app.use('/api/auth', rateLimit(20, 60), proxy(SERVICES.USER));

// Users → User Service
app.use('/api/users',         proxy(SERVICES.USER));
app.use('/api/seller/profile',proxy(SERVICES.USER));
app.use('/api/sellers',       proxy(SERVICES.USER));
app.use('/api/notifications', proxy(SERVICES.USER));
app.use('/api/admin/users',   proxy(SERVICES.USER));
app.use('/api/admin/sellers', proxy(SERVICES.USER));
app.use('/api/admin/newsletter', proxy(SERVICES.USER));
app.use('/api/admin/audit',   proxy(SERVICES.USER));

// Products → Product Service
app.use('/api/products',      proxy(SERVICES.PRODUCT));
app.use('/api/categories',    proxy(SERVICES.PRODUCT));
app.use('/api/seller/products', proxy(SERVICES.PRODUCT));
app.use('/api/admin/products',  proxy(SERVICES.PRODUCT));
app.use('/api/admin/categories',proxy(SERVICES.PRODUCT));

// Orders → Order Service
app.use('/api/orders',        proxy(SERVICES.ORDER));
app.use('/api/my-orders',     proxy(SERVICES.ORDER));
app.use('/api/seller/orders', proxy(SERVICES.ORDER));
app.use('/api/cart',          proxy(SERVICES.ORDER));
app.use('/api/checkout',      proxy(SERVICES.ORDER));

// Quotations → Quotation Service
app.use('/api/quotations',    proxy(SERVICES.QUOTATION));
app.use('/api/my-quotations', proxy(SERVICES.QUOTATION));
app.use('/api/seller/quotations', proxy(SERVICES.QUOTATION));

// Payments → Payment Service
app.use('/api/payments',      proxy(SERVICES.PAYMENT));
app.use('/api/webhook/mp',    proxy(SERVICES.PAYMENT));
app.use('/api/admin/payouts', proxy(SERVICES.PAYMENT));

// Shipping → Shipping Service
app.use('/api/shipping',      proxy(SERVICES.SHIPPING));

// WhatsApp → WhatsApp Service
app.use('/api/whatsapp',      proxy(SERVICES.WHATSAPP));

// Analytics → Analytics Service
app.use('/api/analytics',     proxy(SERVICES.ANALYTICS));
app.use('/api/admin/dashboard', proxy(SERVICES.ANALYTICS));

// Admin
app.use('/api/admin',         proxy(SERVICES.USER));

// Fallback → Legacy backend
app.use('/api', proxy(SERVICES.USER));

app.listen(8080, () => console.log('✅ API Gateway activo en :8080'));
