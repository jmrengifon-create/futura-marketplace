// shared/db.js — Database per service pattern
// Each service gets its own connection pool with appropriate settings.
// In production: each would point to its own RDS instance.
// In dev/MVP: all share the same PostgreSQL instance but use separate schemas.

const { Pool } = require('pg');

const SERVICE_SETTINGS = {
  'user-service':      { max: 10, idleTimeoutMillis: 30000, statement_timeout: 5000  },
  'product-service':   { max: 20, idleTimeoutMillis: 30000, statement_timeout: 8000  },
  'order-service':     { max: 15, idleTimeoutMillis: 30000, statement_timeout: 10000 },
  'quotation-service': { max: 10, idleTimeoutMillis: 30000, statement_timeout: 10000 },
  'payment-service':   { max: 5,  idleTimeoutMillis: 30000, statement_timeout: 15000 },
  'shipping-service':  { max: 5,  idleTimeoutMillis: 30000, statement_timeout: 8000  },
  'analytics-service': { max: 5,  idleTimeoutMillis: 60000, statement_timeout: 30000 },
  'notification-service': { max: 5, idleTimeoutMillis: 30000, statement_timeout: 5000 },
  'whatsapp-service':  { max: 5,  idleTimeoutMillis: 30000, statement_timeout: 5000  },
  'admin-service':     { max: 10, idleTimeoutMillis: 30000, statement_timeout: 15000 },
};

const createPool = (serviceName) => {
  const settings = SERVICE_SETTINGS[serviceName] || { max: 10 };
  const pool = new Pool({
    connectionString: process.env[`${serviceName.toUpperCase().replace(/-/g, '_')}_DATABASE_URL`]
      || process.env.DATABASE_URL,
    ...settings,
  });

  pool.on('connect', () => console.log(`[DB:${serviceName}] Connection acquired`));
  pool.on('error', (err) => console.error(`[DB:${serviceName}] Pool error:`, err.message));

  return pool;
};

// Data retention enforcement (GDPR)
const enforceRetention = async (pool) => {
  try {
    // Logs older than 90 days
    const logsResult = await pool.query(
      "DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days'"
    );
    // Carts abandoned more than 30 days
    const cartsResult = await pool.query(
      "DELETE FROM cart_items WHERE created_at < NOW() - INTERVAL '30 days'"
    );
    // WhatsApp messages older than 30 days
    const waResult = await pool.query(
      "DELETE FROM whatsapp_messages WHERE timestamp < NOW() - INTERVAL '30 days'"
    ).catch(() => ({ rowCount: 0 }));

    console.log(`[Retention] Purged: ${logsResult.rowCount} logs, ${cartsResult.rowCount} carts, ${waResult.rowCount} WA msgs`);

    await pool.query(
      'INSERT INTO data_retention_log(table_name, records_purged) VALUES($1,$2)',
      ['multiple', logsResult.rowCount + cartsResult.rowCount + waResult.rowCount]
    );
  } catch (e) {
    console.error('[Retention] Error:', e.message);
  }
};

// Run retention daily
const scheduleRetention = (pool) => {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  setInterval(() => enforceRetention(pool), MS_PER_DAY);
  // Also run at startup
  setTimeout(() => enforceRetention(pool), 30000);
};

module.exports = { createPool, scheduleRetention, enforceRetention };
