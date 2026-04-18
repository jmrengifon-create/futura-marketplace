// services/analytics/index.js — Analytics Service (Port 3009)
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors    = require('cors');
const { auth, role, requestLogger, redis } = require('../../shared/middleware');

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.use(express.json());
app.use(cors());
app.use(requestLogger('ANALYTICS-SVC'));

const cache = async (key, ttl, fn) => {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  const data = await fn();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
};

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'analytics' }));

// ─── GMV Dashboard ────────────────────────────────────────
app.get('/api/analytics/gmv', auth, role('ADMIN'), async (req, res) => {
  try {
    const data = await cache('analytics:gmv', 60, async () => {
      const gmv = await pool.query(`
        SELECT
          COALESCE(SUM(i.price),0)                                               AS gmv_total,
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month',o.created_at)=DATE_TRUNC('month',NOW()) THEN i.price END),0) AS gmv_mes,
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month',o.created_at)=DATE_TRUNC('month',NOW()-INTERVAL '1 month') THEN i.price END),0) AS gmv_mes_anterior,
          COALESCE(SUM(i.commission),0)                                          AS comision_total,
          COUNT(DISTINCT o.id)                                                   AS total_ordenes,
          COUNT(DISTINCT o.buyer_id)                                             AS compradores_activos,
          COALESCE(AVG(i.price),0)                                               AS ticket_promedio
        FROM order_items i JOIN orders o ON o.id=i.order_id
        WHERE o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')`);

      const vendedoresActivos = await pool.query(`
        SELECT COUNT(DISTINCT i.seller_id) AS count FROM order_items i
        JOIN orders o ON o.id=i.order_id
        WHERE o.created_at >= NOW()-INTERVAL '30 days'
          AND o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')`);

      const convRate = await pool.query(`
        SELECT COUNT(*) AS total, COUNT(CASE WHEN status='ACEPTADA' THEN 1 END) AS aceptadas FROM quotations`);

      const cr = convRate.rows[0];
      return {
        gmv: gmv.rows[0],
        vendedores_activos: parseInt(vendedoresActivos.rows[0].count),
        conversion_rate: cr.total > 0 ? ((cr.aceptadas / cr.total)*100).toFixed(1) : 0,
      };
    });
    res.json(data);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error interno' }); }
});

// ─── Monthly revenue ──────────────────────────────────────
app.get('/api/analytics/monthly', auth, role('ADMIN'), async (req, res) => {
  try {
    const data = await cache('analytics:monthly', 120, async () => {
      const r = await pool.query(`
        SELECT
          TO_CHAR(o.created_at,'YYYY-MM') AS mes,
          TO_CHAR(o.created_at,'Mon YYYY') AS mes_label,
          SUM(i.price) AS total_ventas,
          SUM(i.commission) AS total_comision,
          SUM(i.net) AS total_neto,
          COUNT(DISTINCT o.id) AS num_ordenes,
          COUNT(DISTINCT o.buyer_id) AS compradores_unicos
        FROM orders o JOIN order_items i ON i.order_id=o.id
        WHERE o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')
          AND o.created_at >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR(o.created_at,'YYYY-MM'), TO_CHAR(o.created_at,'Mon YYYY')
        ORDER BY mes ASC`);
      return r.rows;
    });
    res.json(data);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Seller ranking ───────────────────────────────────────
app.get('/api/analytics/sellers', auth, role('ADMIN'), async (req, res) => {
  try {
    const data = await cache('analytics:sellers', 120, async () => {
      const r = await pool.query(`
        SELECT
          u.id, u.name AS vendedor,
          COUNT(DISTINCT o.id) AS num_ventas,
          SUM(i.price) AS total_vendido,
          SUM(i.commission) AS total_comision,
          SUM(i.net) AS total_neto,
          COALESCE(sp.rating_avg,0) AS rating,
          sp.verified
        FROM users u JOIN order_items i ON i.seller_id=u.id
        JOIN orders o ON o.id=i.order_id
        LEFT JOIN seller_profiles sp ON sp.user_id=u.id
        WHERE o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')
        GROUP BY u.id,u.name,sp.rating_avg,sp.verified
        ORDER BY total_vendido DESC`);
      return r.rows;
    });
    res.json(data);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Top products ─────────────────────────────────────────
app.get('/api/analytics/products', auth, role('ADMIN'), async (req, res) => {
  try {
    const data = await cache('analytics:products', 120, async () => {
      const r = await pool.query(`
        SELECT
          u.name AS vendedor, p.title AS producto, c.name AS categoria,
          COUNT(*) AS veces_vendido,
          SUM(i.price) AS total_generado,
          SUM(i.commission) AS comision_futura,
          SUM(i.net) AS neto_vendedor
        FROM order_items i JOIN orders o ON o.id=i.order_id
        JOIN products p ON p.id=i.product_id JOIN users u ON u.id=i.seller_id
        LEFT JOIN categories c ON c.id=p.category_id
        WHERE o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')
        GROUP BY u.name,p.title,c.name ORDER BY total_generado DESC`);
      return r.rows;
    });
    res.json(data);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Category stats ───────────────────────────────────────
app.get('/api/analytics/categories', auth, role('ADMIN'), async (req, res) => {
  try {
    const data = await cache('analytics:categories', 120, async () => {
      const r = await pool.query(`
        SELECT COALESCE(c.name,'Sin categoría') AS categoria,
          COUNT(*) AS num_ventas, SUM(i.price) AS total_vendido
        FROM order_items i JOIN orders o ON o.id=i.order_id
        JOIN products p ON p.id=i.product_id LEFT JOIN categories c ON c.id=p.category_id
        WHERE o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')
        GROUP BY c.name ORDER BY total_vendido DESC`);
      return r.rows;
    });
    res.json(data);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Seller dashboard ─────────────────────────────────────
app.get('/api/analytics/seller/:id', auth, async (req, res) => {
  if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'ADMIN') return res.sendStatus(403);
  try {
    const data = await cache(`analytics:seller:${req.params.id}`, 120, async () => {
      const stats = await pool.query(`
        SELECT
          COUNT(DISTINCT o.id) AS total_ordenes,
          COUNT(DISTINCT CASE WHEN o.status='PAGADA' THEN o.id END) AS ordenes_pagadas,
          COUNT(DISTINCT CASE WHEN o.status='EN_PRODUCCION' THEN o.id END) AS en_produccion,
          COUNT(DISTINCT CASE WHEN o.status='ENTREGADA' THEN o.id END) AS entregadas,
          COALESCE(SUM(CASE WHEN o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA') THEN i.net END),0) AS neto_total,
          COALESCE(SUM(CASE WHEN o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA') THEN i.commission END),0) AS comision_total,
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month',o.created_at)=DATE_TRUNC('month',NOW()) AND o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA') THEN i.net END),0) AS neto_mes
        FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.seller_id=$1`, [req.params.id]);

      const topProducts = await pool.query(`
        SELECT p.title, p.image_url, COUNT(*) AS veces, SUM(i.price) AS revenue
        FROM order_items i JOIN products p ON p.id=i.product_id JOIN orders o ON o.id=i.order_id
        WHERE i.seller_id=$1 AND o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')
        GROUP BY p.id,p.title,p.image_url ORDER BY veces DESC LIMIT 5`, [req.params.id]);

      const monthly = await pool.query(`
        SELECT TO_CHAR(o.created_at,'Mon YYYY') AS mes, SUM(i.net) AS neto, COUNT(DISTINCT o.id) AS ordenes
        FROM order_items i JOIN orders o ON o.id=i.order_id
        WHERE i.seller_id=$1 AND o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')
          AND o.created_at >= NOW()-INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month',o.created_at),TO_CHAR(o.created_at,'Mon YYYY')
        ORDER BY DATE_TRUNC('month',o.created_at)`, [req.params.id]);

      const pending = await pool.query("SELECT COUNT(*) FROM quotations WHERE seller_id=$1 AND status='PENDIENTE'", [req.params.id]);
      const profile = await pool.query('SELECT rating_avg,total_sales,verified FROM seller_profiles WHERE user_id=$1', [req.params.id]);

      return {
        stats: { ...stats.rows[0], cotizaciones_pendientes: parseInt(pending.rows[0].count) },
        topProducts: topProducts.rows,
        monthly: monthly.rows,
        profile: profile.rows[0],
      };
    });
    res.json(data);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error interno' }); }
});

// ─── System health metrics ────────────────────────────────
app.get('/api/analytics/health', auth, role('ADMIN'), async (req, res) => {
  try {
    const [users, products, orders, quotations, disputes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM products WHERE active=TRUE'),
      pool.query('SELECT COUNT(*) FROM orders'),
      pool.query('SELECT COUNT(*) FROM quotations'),
      pool.query("SELECT COUNT(*) FROM disputes WHERE status='ABIERTA'"),
    ]);

    const redisInfo = await redis.info('stats').catch(() => null);

    res.json({
      database: { users: parseInt(users.rows[0].count), products: parseInt(products.rows[0].count), orders: parseInt(orders.rows[0].count), quotations: parseInt(quotations.rows[0].count), disputes: parseInt(disputes.rows[0].count) },
      redis: { connected: true },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.listen(3009, () => console.log('✅ Analytics Service activo en :3009'));
