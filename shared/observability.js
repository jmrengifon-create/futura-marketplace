// shared/observability.js — APM, metrics, distributed tracing
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: 6379,
  lazyConnect: true,
});
redis.connect().catch(() => {});

// ─── Distributed tracing ─────────────────────────────────
const generateTraceId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

const tracingMiddleware = (serviceName) => (req, res, next) => {
  req.traceId  = req.headers['x-trace-id']  || generateTraceId();
  req.spanId   = req.headers['x-span-id']   || generateTraceId();
  req.parentId = req.headers['x-parent-id'] || null;

  res.setHeader('x-trace-id', req.traceId);
  res.setHeader('x-service',  serviceName);

  const start = process.hrtime.bigint();

  res.on('finish', async () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

    // Collect metrics
    await collectMetrics(serviceName, {
      method:   req.method,
      path:     req.route?.path || req.path,
      status:   res.statusCode,
      duration: durationMs,
      traceId:  req.traceId,
    });

    if (req.path !== '/health' && req.path !== '/metrics') {
      const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
      console.log(
        JSON.stringify({
          level, service: serviceName,
          method: req.method, path: req.path,
          status: res.statusCode,
          duration_ms: durationMs.toFixed(2),
          trace_id: req.traceId,
          ts: new Date().toISOString(),
        })
      );
    }
  });

  next();
};

// ─── Metrics collection ───────────────────────────────────
const collectMetrics = async (service, { method, path, status, duration }) => {
  try {
    const min  = Math.floor(Date.now() / 60000); // 1-min bucket
    const base = `metrics:${service}:${min}`;

    await redis.pipeline()
      .incr(`${base}:requests`)
      .incr(`${base}:${status >= 500 ? 'errors' : status >= 400 ? 'client_errors' : 'success'}`)
      .lpush(`${base}:latencies`, duration.toFixed(2))
      .ltrim(`${base}:latencies`, 0, 999)      // Keep last 1000 per window
      .expire(`${base}:requests`, 3600)
      .expire(`${base}:latencies`, 3600)
      .exec();
  } catch { /* non-critical */ }
};

// ─── Metrics endpoint ─────────────────────────────────────
const metricsEndpoint = (service) => async (req, res) => {
  try {
    const now  = Math.floor(Date.now() / 60000);
    const keys = [];
    for (let i = 0; i < 60; i++) keys.push(`metrics:${service}:${now - i}`);

    const pipeline = redis.pipeline();
    for (const k of keys) {
      pipeline.get(`${k}:requests`);
      pipeline.get(`${k}:errors`);
      pipeline.lrange(`${k}:latencies`, 0, -1);
    }
    const results = await pipeline.exec();

    let totalReqs = 0, totalErrors = 0;
    const allLatencies = [];

    for (let i = 0; i < results.length; i += 3) {
      totalReqs   += parseInt(results[i][1]   || 0);
      totalErrors += parseInt(results[i+1][1] || 0);
      const lats   = results[i+2][1] || [];
      allLatencies.push(...lats.map(Number));
    }

    allLatencies.sort((a, b) => a - b);
    const p50  = percentile(allLatencies, 0.50);
    const p95  = percentile(allLatencies, 0.95);
    const p99  = percentile(allLatencies, 0.99);

    res.json({
      service,
      window_minutes: 60,
      requests:     totalReqs,
      errors:       totalErrors,
      error_rate:   totalReqs > 0 ? ((totalErrors / totalReqs) * 100).toFixed(2) + '%' : '0%',
      latency: { p50: p50.toFixed(2), p95: p95.toFixed(2), p99: p99.toFixed(2), unit: 'ms' },
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const percentile = (sorted, p) => {
  if (!sorted.length) return 0;
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
};

// ─── Health check ─────────────────────────────────────────
const healthCheck = (service, checks = {}) => async (req, res) => {
  const status = { service, status: 'ok', checks: {}, ts: new Date().toISOString() };

  for (const [name, fn] of Object.entries(checks)) {
    try {
      const result = await Promise.race([fn(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))]);
      status.checks[name] = { status: 'ok', ...result };
    } catch (e) {
      status.checks[name] = { status: 'error', message: e.message };
      status.status = 'degraded';
    }
  }

  res.status(status.status === 'ok' ? 200 : 503).json(status);
};

module.exports = { tracingMiddleware, metricsEndpoint, healthCheck, collectMetrics };
