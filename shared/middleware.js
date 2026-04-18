// shared/middleware.js — JWT auth, roles, audit, rate limiting
const jwt    = require('jsonwebtoken');
const Redis  = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('error', (e) => console.warn('Redis warn:', e.message));

// ─── Auth middleware ───────────────────────────────────────
const auth = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h) return res.sendStatus(401);
  try {
    req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch { res.sendStatus(401); }
};

const role = (r) => (req, res, next) => {
  if (req.user.role !== r) return res.sendStatus(403);
  next();
};

const anyRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.sendStatus(403);
  next();
};

// ─── Rate limiting via Redis ───────────────────────────────
const rateLimit = (maxRequests = 100, windowSec = 60) => async (req, res, next) => {
  const key = `rate:${req.ip}:${Math.floor(Date.now() / (windowSec * 1000))}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    if (count > maxRequests) return res.status(429).json({ error: 'Too many requests. Intenta en un momento.' });
    next();
  } catch {
    next(); // Si Redis falla, no bloqueamos
  }
};

// ─── Audit log ────────────────────────────────────────────
const auditLog = (pool) => async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Log asíncrono — no bloquea la respuesta
    if (req.user && req.method !== 'GET') {
      pool.query(
        'INSERT INTO audit_logs(user_id,action,resource,ip,status_code,payload_size) VALUES($1,$2,$3,$4,$5,$6)',
        [
          req.user.id,
          `${req.method} ${req.path}`,
          req.path,
          req.ip,
          res.statusCode,
          JSON.stringify(body).length,
        ]
      ).catch(() => {});
    }
    return originalJson(body);
  };
  next();
};

// ─── Request logger ───────────────────────────────────────
const requestLogger = (serviceName) => (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    if (req.path !== '/health')
      console.log(`[${serviceName}] ${level} ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
};

module.exports = { auth, role, anyRole, rateLimit, auditLog, requestLogger, redis };
