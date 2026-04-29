/**
 * MÓDULO 06 — VALIDACIÓN FINANCIERA (RIESGO CREDITICIO)
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 *
 * Integración: Infocorp (Perú) / Equifax
 * Routes: POST /api/risk/evaluate, GET /api/risk/:userId
 *
 * NOTA: Infocorp y Equifax requieren contrato comercial.
 * Este módulo implementa el patrón de integración real + fallback interno.
 */

const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { Pool } = require('pg');
const { eventBus } = require('../shared/eventBus');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATION = `
CREATE TABLE IF NOT EXISTS credit_risk_evaluations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  source VARCHAR(30),           -- 'infocorp','equifax','internal'
  external_score INTEGER,
  internal_score INTEGER,
  final_score INTEGER,
  risk_level VARCHAR(20),       -- 'low','medium','high','rejected'
  raw_response JSONB,
  evaluated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// ── Infocorp (SBS Perú) ────────────────────────────────────────────────────
async function queryInfocorp(dni) {
  try {
    const response = await axios.post(
      process.env.INFOCORP_API_URL || 'https://api.infocorp.com.pe/v1/consulta',
      { dni, token: process.env.INFOCORP_TOKEN },
      { timeout: 8000 }
    );
    return { source: 'infocorp', data: response.data, score: response.data?.score || null };
  } catch (err) {
    console.warn('[Risk] Infocorp no disponible:', err.message);
    return null;
  }
}

// ── Equifax Perú ───────────────────────────────────────────────────────────
async function queryEquifax(dni) {
  try {
    const response = await axios.post(
      process.env.EQUIFAX_API_URL || 'https://api.equifax.com.pe/v2/credit-report',
      { documentNumber: dni, documentType: 'DNI' },
      {
        headers: { Authorization: `Bearer ${process.env.EQUIFAX_TOKEN}` },
        timeout: 8000,
      }
    );
    return { source: 'equifax', data: response.data, score: response.data?.creditScore || null };
  } catch (err) {
    console.warn('[Risk] Equifax no disponible:', err.message);
    return null;
  }
}

// ── Score interno como fallback ────────────────────────────────────────────
async function internalRiskScore(userId) {
  const { rows: [u] } = await db.query(`
    SELECT score,
      (SELECT COUNT(*) FROM credit_installments ci
       JOIN credits c ON c.id = ci.credit_id
       WHERE c.buyer_id = $1 AND ci.status = 'overdue') AS overdue_count,
      (SELECT COALESCE(SUM(penalty),0) FROM credit_installments ci
       JOIN credits c ON c.id = ci.credit_id
       WHERE c.buyer_id = $1) AS total_penalties
    FROM users WHERE id = $1
  `, [userId]);

  if (!u) return 0;
  let base = u.score || 50;
  base -= parseInt(u.overdue_count || 0) * 8;
  base -= Math.min(parseFloat(u.total_penalties || 0) / 100, 20);
  return Math.max(0, Math.min(base, 100));
}

// ── Evaluación completa de riesgo ─────────────────────────────────────────
async function evaluateRisk(userId) {
  const { rows: [user] } = await db.query(
    `SELECT dni, score FROM users WHERE id = $1`, [userId]
  );
  if (!user) throw new Error('Usuario no encontrado');

  let externalScore = null;
  let source = 'internal';
  let rawResponse = {};

  // Intentar Infocorp primero, luego Equifax
  const infocorp = await queryInfocorp(user.dni);
  if (infocorp?.score != null) {
    externalScore = infocorp.score;
    source = 'infocorp';
    rawResponse = infocorp.data;
  } else {
    const equifax = await queryEquifax(user.dni);
    if (equifax?.score != null) {
      externalScore = equifax.score;
      source = 'equifax';
      rawResponse = equifax.data;
    }
  }

  const internalScore = await internalRiskScore(userId);

  // Score final: 60% externo (si disponible) + 40% interno
  const finalScore = externalScore != null
    ? Math.round(externalScore * 0.6 + internalScore * 0.4)
    : internalScore;

  const riskLevel =
    finalScore >= 70 ? 'low' :
    finalScore >= 45 ? 'medium' :
    finalScore >= 25 ? 'high' : 'rejected';

  const { rows: [evaluation] } = await db.query(`
    INSERT INTO credit_risk_evaluations
      (user_id, source, external_score, internal_score, final_score, risk_level, raw_response)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [userId, source, externalScore, internalScore, finalScore, riskLevel,
      JSON.stringify(rawResponse)]);

  return evaluation;
}

// ── POST Evaluar riesgo ────────────────────────────────────────────────────
router.post('/evaluate', async (req, res) => {
  try {
    const { userId } = req.body;
    const result = await evaluateRisk(userId || req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET Historial de evaluaciones ─────────────────────────────────────────
router.get('/:userId', async (req, res) => {
  const { rows } = await db.query(`
    SELECT * FROM credit_risk_evaluations
    WHERE user_id = $1 ORDER BY evaluated_at DESC LIMIT 10
  `, [req.params.userId]);
  res.json(rows);
});

module.exports = { router, evaluateRisk, MIGRATION };
