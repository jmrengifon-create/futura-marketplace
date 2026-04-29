/**
 * MÓDULO 04 — SCORING (SEMÁFORO DE USUARIOS)
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 *
 * Score 0-100: 🟢 70-100 (bueno) | 🟡 40-69 (medio) | 🔴 0-39 (riesgoso)
 * Routes: GET /api/scoring/:userId, GET /api/scoring/admin/dashboard
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { eventBus, EVENTS } = require('../shared/eventBus');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATION = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS score_color VARCHAR(10) DEFAULT 'yellow';
ALTER TABLE users ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS score_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  score_before INTEGER,
  score_after INTEGER,
  color_before VARCHAR(10),
  color_after VARCHAR(10),
  factors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// ── Calcular score (0-100) ─────────────────────────────────────────────────
async function calculateScore(userId) {
  const { rows: [u] } = await db.query(`
    SELECT u.*,
      (SELECT COUNT(*) FROM credit_installments ci JOIN credits c ON c.id = ci.credit_id
       WHERE c.buyer_id = u.id AND ci.status = 'paid') AS paid_installments,
      (SELECT COUNT(*) FROM credit_installments ci JOIN credits c ON c.id = ci.credit_id
       WHERE c.buyer_id = u.id AND ci.status = 'overdue') AS overdue_installments,
      (SELECT COUNT(*) FROM orders WHERE buyer_id = u.id AND status = 'completed') AS completed_orders,
      (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE reviewee_id = u.id) AS avg_rating
    FROM users u WHERE u.id = $1
  `, [userId]);

  if (!u) return null;

  const factors = {
    puntualidad:      0,  // max 40
    volumenCompra:    0,  // max 25
    comportamiento:   0,  // max 20
    calificacion:     0,  // max 15
  };

  // 1. Puntualidad de pagos (40 pts)
  const totalInst = parseInt(u.paid_installments) + parseInt(u.overdue_installments);
  if (totalInst > 0) {
    factors.puntualidad = Math.round(40 * (parseInt(u.paid_installments) / totalInst));
  } else {
    factors.puntualidad = 20; // sin historial = neutral
  }

  // 2. Volumen de compra (25 pts)
  const totalSpent = parseFloat(u.total_purchases || 0);
  if      (totalSpent >= 50000) factors.volumenCompra = 25;
  else if (totalSpent >= 20000) factors.volumenCompra = 20;
  else if (totalSpent >= 5000)  factors.volumenCompra = 14;
  else if (totalSpent >= 1000)  factors.volumenCompra = 8;
  else                           factors.volumenCompra = 3;

  // 3. Comportamiento (20 pts)
  const orders = parseInt(u.completed_orders || 0);
  if      (orders >= 20) factors.comportamiento = 20;
  else if (orders >= 10) factors.comportamiento = 15;
  else if (orders >= 5)  factors.comportamiento = 10;
  else if (orders >= 1)  factors.comportamiento = 5;
  else                    factors.comportamiento = 0;

  // 4. Calificación recibida (15 pts)
  const rating = parseFloat(u.avg_rating || 0);
  factors.calificacion = Math.round((rating / 5) * 15);

  const total = Object.values(factors).reduce((a, b) => a + b, 0);
  const color = total >= 70 ? 'green' : total >= 40 ? 'yellow' : 'red';

  // Guardar historial
  await db.query(`
    INSERT INTO score_history (user_id, score_before, score_after, color_before, color_after, factors)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [userId, u.score, total, u.score_color, color, JSON.stringify(factors)]);

  await db.query(`
    UPDATE users SET score = $1, score_color = $2, score_updated_at = NOW()
    WHERE id = $3
  `, [total, color, userId]);

  return { score: total, color, factors };
}

// ── GET score de un usuario ────────────────────────────────────────────────
router.get('/:userId', async (req, res) => {
  const result = await calculateScore(req.params.userId);
  if (!result) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(result);
});

// ── GET dashboard admin semáforo ──────────────────────────────────────────
router.get('/admin/dashboard', async (req, res) => {
  const { rows } = await db.query(`
    SELECT id, name, email, score, score_color,
           loyalty_tier, total_purchases, purchase_count
    FROM users
    WHERE role = 'buyer'
    ORDER BY score DESC
  `);
  const summary = {
    green:  rows.filter(r => r.score_color === 'green').length,
    yellow: rows.filter(r => r.score_color === 'yellow').length,
    red:    rows.filter(r => r.score_color === 'red').length,
    total:  rows.length,
  };
  res.json({ summary, users: rows });
});

// ── Recalcular score al pagar ──────────────────────────────────────────────
eventBus.subscribe(EVENTS.ORDER_PAID,         ({ userId }) => calculateScore(userId));
eventBus.subscribe(EVENTS.CREDIT_OVERDUE,     ({ userId }) => calculateScore(userId));
eventBus.subscribe(EVENTS.SCORE_UPDATED,      ({ userId }) => calculateScore(userId));

module.exports = { router, calculateScore, MIGRATION };
