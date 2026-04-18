// shared/metrics.js — Prometheus metrics for all services
let prom;
try { prom = require('prom-client'); } catch { prom = null; }

const createMetrics = (serviceName) => {
  if (!prom) return { middleware: (req, res, next) => next(), metricsHandler: (req, res) => res.end('') };

  const register = new prom.Registry();
  prom.collectDefaultMetrics({ register, prefix: `futura_${serviceName}_` });

  const httpDuration = new prom.Histogram({
    name:    `futura_${serviceName}_http_duration_seconds`,
    help:    'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
    registers: [register],
  });

  const httpRequests = new prom.Counter({
    name:    `futura_${serviceName}_http_requests_total`,
    help:    'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  });

  const activeConnections = new prom.Gauge({
    name:    `futura_${serviceName}_active_connections`,
    help:    'Active connections',
    registers: [register],
  });

  const dbQueryDuration = new prom.Histogram({
    name:    `futura_${serviceName}_db_query_seconds`,
    help:    'DB query duration',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [register],
  });

  const middleware = (req, res, next) => {
    if (req.path === '/metrics') return next();
    activeConnections.inc();
    const end = httpDuration.startTimer({ method: req.method, route: req.path });
    res.on('finish', () => {
      end({ status_code: res.statusCode });
      httpRequests.inc({ method: req.method, route: req.path, status_code: res.statusCode });
      activeConnections.dec();
    });
    next();
  };

  const metricsHandler = async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  };

  return { middleware, metricsHandler, httpDuration, httpRequests, dbQueryDuration, register };
};

module.exports = { createMetrics };
