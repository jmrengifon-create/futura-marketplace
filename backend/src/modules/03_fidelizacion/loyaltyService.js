/**
 * MÓDULO 03 — SISTEMA DE FIDELIZACIÓN
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 *
 * Tiers: new → recurrent → vip
 * Routes: GET /api/loyalty/:userId, POST /api/loyalty/update
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { eventBus, EVENTS } = require('../shared/eventBus');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATION = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR(20) DEFAULT 'new';
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_purchases NUMERIC(12,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS purchase_count INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS loyalty_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100),
  points_delta INTEGER,
  tier_before VARCHAR(20),
  tier_after VARCHAR(20),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_benefits (
  id SERIAL PRIMARY KEY,
  tier VARCHAR(20) NOT NULL,
  benefit_type VARCHAR(30) CHECK (benefit_type IN ('discount','gift','promotion','priority')),
  value NUMERIC(10,2),
  description TEXT,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO loyalty_benefits (tier, benefit_type, value, description) VALUES
  ('recurrent', 'discount', 5,  '5% descuento permanente'),
  ('vip',       'discount', 10, '10% descuento permanente'),
  ('vip',       'priority', 1,  'Atención prioritaria'),
  ('vip',       'gift',     0,  'Regalo en cumpleaños')
ON CONFLICT DO NOTHING;
`;

// ── Reglas de clasificación ────────────────────────────────────────────────
function calcTier(purchaseCount, totalSpent) {
  if (purchaseCount >= 10 || totalSpent >= 20000) return 'vip';
  if (purchaseCount >= 3  || totalSpent >= 3000)  return 'recurrent';
  return 'new';
}

function calcPoints(orderAmount) {
  return Math.floor(orderAmount / 10); // 1 punto por cada S/10
}

// ── Actualizar fidelidad tras un pago ─────────────────────────────────────
async function updateLoyalty(userId, orderAmount) {
  const { rows: [user] } = await db.query(
    `SELECT loyalty_tier, loyalty_points, total_purchases, purchase_count FROM users WHERE id = $1`,
    [userId]
  );

  const newTotal    = parseFloat(user.total_purchases || 0) + parseFloat(orderAmount);
  const newCount    = (user.purchase_count || 0) + 1;
  const addedPoints = calcPoints(orderAmount);
  const newPoints   = (user.loyalty_points || 0) + addedPoints;
  const newTier     = calcTier(newCount, newTotal);
  const oldTier     = user.loyalty_tier || 'new';

  await db.query(`
    UPDATE users SET
      loyalty_tier = $1, loyalty_points = $2,
      total_purchases = $3, purchase_count = $4
    WHERE id = $5
  `, [newTier, newPoints, newTotal, newCount, userId]);

  await db.query(`
    INSERT INTO loyalty_history (user_id, action, points_delta, tier_before, tier_after, metadata)
    VALUES ($1, 'purchase', $2, $3, $4, $5)
  `, [userId, addedPoints, oldTier, newTier, JSON.stringify({ orderAmount })]);

  if (newTier !== oldTier) {
    eventBus.publish('loyalty.tier_upgraded', { userId, oldTier, newTier });
  }

  eventBus.publish(EVENTS.SCORE_UPDATED, { userId });
  return { newTier, newPoints, addedPoints };
}

// ── GET historial de fidelidad ─────────────────────────────────────────────
router.get('/:userId', async (req, res) => {
  const { rows: history } = await db.query(
    `SELECT * FROM loyalty_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.params.userId]
  );
  const { rows: [user] } = await db.query(
    `SELECT loyalty_tier, loyalty_points, total_purchases, purchase_count FROM users WHERE id = $1`,
    [req.params.userId]
  );
  const { rows: benefits } = await db.query(
    `SELECT * FROM loyalty_benefits WHERE tier = $1 AND is_active = true`,
    [user?.loyalty_tier || 'new']
  );
  res.json({ ...user, benefits, history });
});

// ── POST redimir puntos ────────────────────────────────────────────────────
router.post('/redeem', async (req, res) => {
  const { userId, points } = req.body;
  const { rows: [user] } = await db.query(
    `SELECT loyalty_points FROM users WHERE id = $1`, [userId]
  );
  if (!user || user.loyalty_points < points) {
    return res.status(400).json({ error: 'Puntos insuficientes' });
  }
  const discountAmount = points * 0.1; // S/0.10 por punto
  await db.query(
    `UPDATE users SET loyalty_points = loyalty_points - $1 WHERE id = $2`,
    [points, userId]
  );
  await db.query(`
    INSERT INTO loyalty_history (user_id, action, points_delta, metadata)
    VALUES ($1, 'redeem', $2, $3)
  `, [userId, -points, JSON.stringify({ discountAmount })]);

  res.json({ discountAmount, remainingPoints: user.loyalty_points - points });
});

// ── Hook en evento de pago ─────────────────────────────────────────────────
eventBus.subscribe(EVENTS.ORDER_PAID, async ({ userId, amount }) => {
  if (userId && amount) await updateLoyalty(userId, amount);
});

module.exports = { router, updateLoyalty, calcTier, MIGRATION };
