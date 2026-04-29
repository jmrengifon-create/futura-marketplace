/**
 * MÓDULO 05 — CRÉDITOS AVANZADOS
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 *
 * Tabla de amortización francesa (cuotas iguales)
 * Routes: POST /api/credits/simulate, POST /api/credits/apply,
 *         GET  /api/credits/:id, POST /api/credits/:id/pay
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { eventBus, EVENTS } = require('../shared/eventBus');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATION = `
CREATE TABLE IF NOT EXISTS credits (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER REFERENCES users(id),
  vendor_id INTEGER REFERENCES users(id),
  order_id INTEGER,
  total_amount NUMERIC(12,2) NOT NULL,
  monthly_rate NUMERIC(6,4) NOT NULL,
  installments_count INTEGER NOT NULL,
  penalty_rate NUMERIC(6,4) DEFAULT 0.03,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('pending','active','completed','blocked','defaulted')),
  score_at_approval INTEGER,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_installments (
  id SERIAL PRIMARY KEY,
  credit_id INTEGER REFERENCES credits(id),
  installment_number INTEGER NOT NULL,
  principal NUMERIC(12,2),
  interest NUMERIC(12,2),
  amount NUMERIC(12,2),
  penalty NUMERIC(12,2) DEFAULT 0,
  due_date DATE NOT NULL,
  paid_date DATE,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue')),
  reminder_sent BOOLEAN DEFAULT false
);
`;

// ── Generar tabla de amortización francesa ────────────────────────────────
function buildAmortization(principal, monthlyRate, numInstallments) {
  const r = monthlyRate / 100;
  // Cuota fija: C = P * r * (1+r)^n / ((1+r)^n - 1)
  const quota = r === 0
    ? principal / numInstallments
    : principal * r * Math.pow(1 + r, numInstallments) / (Math.pow(1 + r, numInstallments) - 1);

  const table = [];
  let balance = principal;

  for (let i = 1; i <= numInstallments; i++) {
    const interest   = balance * r;
    const principalP = quota - interest;
    balance          = Math.max(balance - principalP, 0);
    table.push({
      installment_number: i,
      principal: +principalP.toFixed(2),
      interest:  +interest.toFixed(2),
      amount:    +quota.toFixed(2),
      balance:   +balance.toFixed(2),
    });
  }
  return table;
}

// ── POST Simular crédito ───────────────────────────────────────────────────
router.post('/simulate', (req, res) => {
  const { amount, monthly_rate, installments } = req.body;
  if (!amount || !installments) {
    return res.status(400).json({ error: 'amount e installments son requeridos' });
  }
  const table = buildAmortization(amount, monthly_rate || 1.5, installments);
  const totalInterest = table.reduce((s, r) => s + r.interest, 0);
  const totalAmount   = table.reduce((s, r) => s + r.amount, 0);
  res.json({ table, totalInterest: +totalInterest.toFixed(2), totalAmount: +totalAmount.toFixed(2) });
});

// ── POST Solicitar crédito ─────────────────────────────────────────────────
router.post('/apply', async (req, res) => {
  const { order_id, vendor_id, total_amount, monthly_rate, installments_count } = req.body;
  const buyer_id = req.user.id;

  // Verificar score mínimo
  const { rows: [user] } = await db.query(`SELECT score FROM users WHERE id = $1`, [buyer_id]);
  if ((user?.score || 50) < 40) {
    return res.status(403).json({ error: 'Score insuficiente para crédito' });
  }

  const { rows: [credit] } = await db.query(`
    INSERT INTO credits (buyer_id, vendor_id, order_id, total_amount, monthly_rate,
                         installments_count, score_at_approval, status, approved_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'active',NOW())
    RETURNING *
  `, [buyer_id, vendor_id, order_id, total_amount, monthly_rate || 1.5,
      installments_count, user.score]);

  // Generar cuotas
  const table = buildAmortization(total_amount, monthly_rate || 1.5, installments_count);
  const today = new Date();

  for (const row of table) {
    const dueDate = new Date(today);
    dueDate.setMonth(dueDate.getMonth() + row.installment_number);
    await db.query(`
      INSERT INTO credit_installments
        (credit_id, installment_number, principal, interest, amount, due_date)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [credit.id, row.installment_number, row.principal, row.interest, row.amount,
        dueDate.toISOString().split('T')[0]]);
  }

  eventBus.publish(EVENTS.CREDIT_APPROVED, { userId: buyer_id, creditId: credit.id, total_amount });
  res.json({ credit, installments: table });
});

// ── GET detalle de crédito con cuotas ────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { rows: [credit] } = await db.query(`SELECT * FROM credits WHERE id = $1`, [req.params.id]);
  if (!credit) return res.status(404).json({ error: 'Crédito no encontrado' });

  const { rows: installments } = await db.query(
    `SELECT * FROM credit_installments WHERE credit_id = $1 ORDER BY installment_number`,
    [req.params.id]
  );
  const paid    = installments.filter(i => i.status === 'paid').length;
  const overdue = installments.filter(i => i.status === 'overdue').length;
  res.json({ ...credit, installments, paid, overdue, progress: `${paid}/${installments.length}` });
});

// ── POST Registrar pago de cuota ──────────────────────────────────────────
router.post('/:id/pay', async (req, res) => {
  const { installment_id } = req.body;
  const { rows: [inst] } = await db.query(
    `SELECT * FROM credit_installments WHERE id = $1`, [installment_id]
  );
  if (!inst) return res.status(404).json({ error: 'Cuota no encontrada' });

  const total = parseFloat(inst.amount) + parseFloat(inst.penalty || 0);
  await db.query(`
    UPDATE credit_installments
    SET status = 'paid', paid_date = NOW()
    WHERE id = $1
  `, [installment_id]);

  // Verificar si todo el crédito está pagado
  const { rows: pending } = await db.query(`
    SELECT COUNT(*) as cnt FROM credit_installments
    WHERE credit_id = $1 AND status != 'paid'
  `, [inst.credit_id]);

  if (parseInt(pending[0].cnt) === 0) {
    await db.query(`UPDATE credits SET status = 'completed' WHERE id = $1`, [inst.credit_id]);
    // Beneficio por pago puntual: +10 puntos de fidelidad
    const { rows: [credit] } = await db.query(`SELECT buyer_id FROM credits WHERE id = $1`, [inst.credit_id]);
    await db.query(`UPDATE users SET loyalty_points = loyalty_points + 10 WHERE id = $1`, [credit.buyer_id]);
  }

  eventBus.publish(EVENTS.SCORE_UPDATED, { userId: req.user.id });
  res.json({ paid: total, remainingInstallments: parseInt(pending[0].cnt) });
});

module.exports = { router, buildAmortization, MIGRATION };
