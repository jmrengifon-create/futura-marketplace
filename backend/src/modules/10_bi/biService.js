/**
 * MÓDULO 10 — ANALÍTICA AVANZADA (BI)
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 *
 * KPIs: LTV, CAC, Cohortes, Predicciones
 * Routes: GET /api/bi/kpis, GET /api/bi/cohorts, GET /api/bi/predictions
 */

const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// ── KPIs Ejecutivos ────────────────────────────────────────────────────────
router.get('/kpis', async (req, res) => {
  const { from = '2024-01-01', to = new Date().toISOString() } = req.query;

  const [
    revenue, orders, newUsers, activeUsers, avgOrderValue,
    creditVolume, overdueRate, topProducts
  ] = await Promise.all([

    // Revenue total en periodo
    db.query(`
      SELECT COALESCE(SUM(total_amount),0) AS total
      FROM orders WHERE status='completed' AND created_at BETWEEN $1 AND $2
    `, [from, to]),

    // Total pedidos
    db.query(`
      SELECT COUNT(*) AS count FROM orders
      WHERE created_at BETWEEN $1 AND $2
    `, [from, to]),

    // Nuevos usuarios
    db.query(`
      SELECT COUNT(*) AS count FROM users
      WHERE role='buyer' AND created_at BETWEEN $1 AND $2
    `, [from, to]),

    // Usuarios activos (hicieron ≥1 pedido)
    db.query(`
      SELECT COUNT(DISTINCT buyer_id) AS count FROM orders
      WHERE created_at BETWEEN $1 AND $2
    `, [from, to]),

    // Ticket promedio
    db.query(`
      SELECT COALESCE(AVG(total_amount),0) AS avg
      FROM orders WHERE status='completed' AND created_at BETWEEN $1 AND $2
    `, [from, to]),

    // Volumen de créditos
    db.query(`
      SELECT COALESCE(SUM(total_amount),0) AS total FROM credits
      WHERE approved_at BETWEEN $1 AND $2
    `, [from, to]),

    // Tasa de mora
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='overdue') * 100.0 / NULLIF(COUNT(*),0) AS rate
      FROM credit_installments
      WHERE due_date BETWEEN $1 AND $2
    `, [from, to]),

    // Top 10 productos
    db.query(`
      SELECT p.name, SUM(oi.quantity) AS units_sold, SUM(oi.price*oi.quantity) AS revenue
      FROM order_items oi
      JOIN products p ON p.id=oi.product_id
      JOIN orders o ON o.id=oi.order_id
      WHERE o.created_at BETWEEN $1 AND $2 AND o.status='completed'
      GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 10
    `, [from, to]),
  ]);

  const totalRevenue = parseFloat(revenue.rows[0].total);
  const totalUsers   = parseInt(newUsers.rows[0].count);
  const totalOrders  = parseInt(orders.rows[0].count);

  // LTV = Revenue Total / Usuarios activos
  const activeCount = parseInt(activeUsers.rows[0].count) || 1;
  const ltv = totalRevenue / activeCount;

  // CAC estimado (asumiendo costo marketing = 5% del revenue)
  const marketingCost = totalRevenue * 0.05;
  const cac = totalUsers > 0 ? marketingCost / totalUsers : 0;

  res.json({
    period: { from, to },
    revenue: {
      total:      totalRevenue,
      orders:     totalOrders,
      avg_ticket: parseFloat(avgOrderValue.rows[0].avg),
    },
    users: {
      new:    totalUsers,
      active: activeCount,
      ltv:    +ltv.toFixed(2),
      cac:    +cac.toFixed(2),
      ltv_cac_ratio: cac > 0 ? +(ltv / cac).toFixed(2) : null,
    },
    credits: {
      volume:       parseFloat(creditVolume.rows[0].total),
      overdue_rate: +(parseFloat(overdueRate.rows[0].rate) || 0).toFixed(2),
    },
    top_products: topProducts.rows,
  });
});

// ── Análisis de Cohortes (por mes de registro) ─────────────────────────────
router.get('/cohorts', async (req, res) => {
  const { rows } = await db.query(`
    WITH cohorts AS (
      SELECT
        id AS user_id,
        DATE_TRUNC('month', created_at) AS cohort_month
      FROM users WHERE role='buyer'
    ),
    activity AS (
      SELECT
        o.buyer_id,
        DATE_TRUNC('month', o.created_at) AS activity_month,
        SUM(o.total_amount) AS revenue
      FROM orders o WHERE o.status='completed'
      GROUP BY o.buyer_id, activity_month
    )
    SELECT
      TO_CHAR(c.cohort_month,'YYYY-MM') AS cohort,
      EXTRACT(MONTH FROM AGE(a.activity_month, c.cohort_month))::INT AS month_offset,
      COUNT(DISTINCT c.user_id) AS users,
      COALESCE(SUM(a.revenue),0) AS revenue
    FROM cohorts c
    LEFT JOIN activity a ON a.buyer_id=c.user_id
    GROUP BY c.cohort_month, month_offset
    ORDER BY c.cohort_month, month_offset
    LIMIT 200
  `);
  res.json(rows);
});

// ── Predicción simple de ventas (media móvil 3 meses) ─────────────────────
router.get('/predictions', async (req, res) => {
  const { rows: monthly } = await db.query(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', created_at),'YYYY-MM') AS month,
      COALESCE(SUM(total_amount),0) AS revenue,
      COUNT(*) AS orders
    FROM orders WHERE status='completed'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY DATE_TRUNC('month', created_at)
  `);

  if (monthly.length < 3) {
    return res.json({ monthly, prediction: null, message: 'Datos insuficientes para predicción' });
  }

  // Media móvil últimos 3 meses → predicción siguiente mes
  const last3       = monthly.slice(-3);
  const avgRevenue  = last3.reduce((s, r) => s + parseFloat(r.revenue), 0) / 3;
  const avgOrders   = last3.reduce((s, r) => s + parseInt(r.orders), 0) / 3;

  // Tendencia lineal simple
  const trend = (parseFloat(last3[2].revenue) - parseFloat(last3[0].revenue)) / 2;

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  res.json({
    monthly,
    prediction: {
      month:           nextMonth.toISOString().substring(0, 7),
      predicted_revenue: +(avgRevenue + trend).toFixed(2),
      predicted_orders:  Math.round(avgOrders),
      confidence:       'medium', // Requiere ML para alta confianza
      method:          'moving_average_3m + linear_trend',
    },
  });
});

// ── Segmentación RFM (Recency, Frequency, Monetary) ──────────────────────
router.get('/rfm', async (req, res) => {
  const { rows } = await db.query(`
    SELECT
      u.id, u.name, u.email,
      MAX(o.created_at) AS last_purchase,
      EXTRACT(DAY FROM NOW()-MAX(o.created_at))::INT AS recency_days,
      COUNT(o.id)::INT AS frequency,
      COALESCE(SUM(o.total_amount),0) AS monetary,
      u.loyalty_tier, u.score
    FROM users u
    LEFT JOIN orders o ON o.buyer_id=u.id AND o.status='completed'
    WHERE u.role='buyer'
    GROUP BY u.id, u.name, u.email, u.loyalty_tier, u.score
    ORDER BY monetary DESC
  `);

  // Clasificar RFM
  const classified = rows.map(u => ({
    ...u,
    rfm_segment:
      u.recency_days <= 30  && u.frequency >= 5 && u.monetary >= 5000  ? 'Champions' :
      u.recency_days <= 60  && u.frequency >= 3 && u.monetary >= 2000  ? 'Loyal' :
      u.recency_days <= 30  && u.frequency <= 2                         ? 'New' :
      u.recency_days > 120  && u.frequency >= 3                         ? 'At Risk' :
      u.recency_days > 180                                               ? 'Lost' : 'Potential',
  }));

  res.json(classified);
});

// ── Dashboard de inventario por sede ──────────────────────────────────────
router.get('/inventory-dashboard', async (req, res) => {
  const { rows } = await db.query(`
    SELECT
      location,
      COUNT(id) AS total_items,
      SUM(quantity) AS total_units,
      SUM(quantity * unit_price) AS total_value,
      COUNT(*) FILTER (WHERE quantity <= min_stock) AS low_stock_count
    FROM inventory_items
    GROUP BY location
  `);
  res.json(rows);
});

module.exports = { router };
