/**
 * MÓDULO 02 — MOTOR DE OFERTAS Y PROMOCIONES
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 *
 * Routes: POST /api/promotions, GET /api/promotions, GET /api/promotions/active
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { eventBus, EVENTS } = require('../shared/eventBus');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Migración SQL (ejecutar una sola vez) ──────────────────────────────────
const MIGRATION = `
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) CHECK (discount_type IN ('percentage','fixed','gift')),
  discount_value NUMERIC(10,2),
  min_purchase NUMERIC(10,2) DEFAULT 0,
  target_segment VARCHAR(30) CHECK (target_segment IN ('all','new','recurrent','vip','high_stock','low_demand')),
  product_ids INTEGER[],
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_trigger VARCHAR(50),  -- 'high_stock', 'low_demand', 'loyalty'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS promotion_uses (
  id SERIAL PRIMARY KEY,
  promotion_id INTEGER REFERENCES promotions(id),
  buyer_id INTEGER REFERENCES users(id),
  order_id INTEGER,
  discount_applied NUMERIC(10,2),
  used_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// ── Crear promoción ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    title, description, discount_type, discount_value,
    min_purchase, target_segment, product_ids,
    starts_at, ends_at, auto_trigger
  } = req.body;
  const vendor_id = req.user.id;

  const { rows } = await db.query(`
    INSERT INTO promotions
      (vendor_id, title, description, discount_type, discount_value,
       min_purchase, target_segment, product_ids, starts_at, ends_at, auto_trigger)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
  `, [vendor_id, title, description, discount_type, discount_value,
      min_purchase || 0, target_segment || 'all', product_ids || [],
      starts_at, ends_at, auto_trigger]);

  eventBus.publish(EVENTS.PROMOTION_CREATED, rows[0]);
  res.json(rows[0]);
});

// ── Listar promociones activas ─────────────────────────────────────────────
router.get('/active', async (req, res) => {
  const { rows } = await db.query(`
    SELECT p.*, u.name AS vendor_name
    FROM promotions p
    JOIN users u ON u.id = p.vendor_id
    WHERE p.is_active = true
      AND p.starts_at <= NOW()
      AND p.ends_at >= NOW()
    ORDER BY p.discount_value DESC
  `);
  res.json(rows);
});

// ── Calcular descuento para una orden ─────────────────────────────────────
router.post('/calculate', async (req, res) => {
  const { buyer_id, product_ids, subtotal } = req.body;

  // Segmento del comprador
  const { rows: [buyer] } = await db.query(
    `SELECT loyalty_tier, total_purchases FROM users WHERE id = $1`, [buyer_id]
  );
  const segment = buyer?.loyalty_tier || 'new';

  const { rows: promos } = await db.query(`
    SELECT * FROM promotions
    WHERE is_active = true
      AND starts_at <= NOW() AND ends_at >= NOW()
      AND (target_segment = 'all' OR target_segment = $1)
      AND ($2::numeric >= min_purchase)
    ORDER BY discount_value DESC
    LIMIT 1
  `, [segment, subtotal]);

  if (!promos.length) return res.json({ discount: 0, promotion: null });

  const promo = promos[0];
  let discount = 0;
  if (promo.discount_type === 'percentage') {
    discount = (subtotal * promo.discount_value) / 100;
  } else if (promo.discount_type === 'fixed') {
    discount = promo.discount_value;
  }

  res.json({ discount: Math.min(discount, subtotal), promotion: promo });
});

// ── Trigger automático: stock alto o baja demanda ─────────────────────────
async function autoGeneratePromotion(productId, reason) {
  const { rows: [product] } = await db.query(
    `SELECT * FROM products WHERE id = $1`, [productId]
  );
  if (!product) return;

  const discountMap = { high_stock: 15, low_demand: 20 };
  await db.query(`
    INSERT INTO promotions
      (vendor_id, title, discount_type, discount_value, target_segment,
       product_ids, starts_at, ends_at, auto_trigger)
    VALUES ($1, $2, 'percentage', $3, 'all', $4, NOW(), NOW() + INTERVAL '7 days', $5)
  `, [
    product.vendor_id,
    `Oferta automática: ${product.name}`,
    discountMap[reason] || 10,
    [productId],
    reason
  ]);
  console.log(`[Promotions] Promoción automática creada para producto ${productId} (${reason})`);
}

module.exports = { router, autoGeneratePromotion, MIGRATION };
