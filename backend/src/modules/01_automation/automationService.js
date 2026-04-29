/**
 * MÓDULO 01 — AUTOMATIZACIÓN (Motor de Tareas Programadas)
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 *
 * Deps: npm install node-cron
 */

const cron = require('node-cron');
const { Pool } = require('pg');
const { eventBus, EVENTS } = require('../shared/eventBus');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// ── 1. Alertas de vencimiento de insumos (diario 8am) ─────────────────────
cron.schedule('0 8 * * *', async () => {
  console.log('[CRON] Revisando insumos por vencer...');
  const { rows } = await db.query(`
    SELECT i.*, u.email, u.name
    FROM inventory_items i
    JOIN users u ON u.id = i.owner_id
    WHERE i.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
      AND i.notified_expiry = false
  `);
  for (const item of rows) {
    eventBus.publish('inventory.expiring', {
      userId: item.owner_id,
      email: item.email,
      name: item.name,
      itemName: item.item_name,
      expiryDate: item.expiry_date,
    });
    await db.query(
      `UPDATE inventory_items SET notified_expiry = true WHERE id = $1`,
      [item.id]
    );
  }
  console.log(`[CRON] ${rows.length} insumos por vencer notificados`);
});

// ── 2. Alertas de vida útil de máquinas (diario 8:30am) ───────────────────
cron.schedule('30 8 * * *', async () => {
  console.log('[CRON] Revisando vida útil de máquinas...');
  const { rows } = await db.query(`
    SELECT m.*, u.email, u.name
    FROM machines m
    JOIN users u ON u.id = m.owner_id
    WHERE m.next_service_date <= NOW() + INTERVAL '14 days'
      AND m.service_alerted = false
  `);
  for (const machine of rows) {
    eventBus.publish(EVENTS.MACHINE_SERVICE_DUE, {
      userId: machine.owner_id,
      email: machine.email,
      machineName: machine.name,
      serviceDate: machine.next_service_date,
    });
    await db.query(
      `UPDATE machines SET service_alerted = true WHERE id = $1`,
      [machine.id]
    );
  }
});

// ── 3. Alertas de cuotas por vencer (diario 9am) ──────────────────────────
cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] Revisando cuotas por vencer...');
  const { rows } = await db.query(`
    SELECT ci.*, u.email, u.name, c.total_amount
    FROM credit_installments ci
    JOIN credits c ON c.id = ci.credit_id
    JOIN users u ON u.id = c.buyer_id
    WHERE ci.due_date BETWEEN NOW() AND NOW() + INTERVAL '3 days'
      AND ci.status = 'pending'
      AND ci.reminder_sent = false
  `);
  for (const inst of rows) {
    eventBus.publish(EVENTS.CREDIT_PAYMENT_DUE, {
      userId: inst.buyer_id,
      email: inst.email,
      installmentId: inst.id,
      amount: inst.amount,
      dueDate: inst.due_date,
    });
    await db.query(
      `UPDATE credit_installments SET reminder_sent = true WHERE id = $1`,
      [inst.id]
    );
  }
});

// ── 4. Penalidades por mora (diario 6am) ──────────────────────────────────
cron.schedule('0 6 * * *', async () => {
  console.log('[CRON] Aplicando penalidades por mora...');
  const { rows } = await db.query(`
    SELECT ci.*, c.buyer_id, c.penalty_rate
    FROM credit_installments ci
    JOIN credits c ON c.id = ci.credit_id
    WHERE ci.due_date < NOW()
      AND ci.status = 'pending'
  `);
  for (const inst of rows) {
    const daysLate = Math.floor((Date.now() - new Date(inst.due_date)) / 86400000);
    const penalty = parseFloat(inst.amount) * (inst.penalty_rate || 0.03) * daysLate;
    await db.query(
      `UPDATE credit_installments SET penalty = $1, status = 'overdue' WHERE id = $2`,
      [penalty, inst.id]
    );
    eventBus.publish(EVENTS.CREDIT_OVERDUE, {
      userId: inst.buyer_id,
      installmentId: inst.id,
      daysLate,
      penalty,
    });
  }
});

// ── 5. Reporte diario automático (cada día a las 11:55pm) ─────────────────
cron.schedule('55 23 * * *', async () => {
  console.log('[CRON] Generando reporte diario...');
  eventBus.publish(EVENTS.REPORT_GENERATED, { type: 'daily', date: new Date().toISOString() });
});

// ── 6. Reglas automáticas de negocio (IFTTT) ──────────────────────────────
const businessRules = [
  {
    trigger: EVENTS.ORDER_PAID,
    condition: (p) => p.amount > 5000,
    action: (p) => eventBus.publish('loyalty.vip_candidate', p),
  },
  {
    trigger: EVENTS.CREDIT_OVERDUE,
    condition: (p) => p.daysLate > 30,
    action: (p) => eventBus.publish('user.block_credit', { userId: p.userId }),
  },
  {
    trigger: EVENTS.INVENTORY_LOW,
    condition: (p) => p.quantity < p.minStock,
    action: (p) => eventBus.publish('inventory.reorder_alert', p),
  },
];

businessRules.forEach(({ trigger, condition, action }) => {
  eventBus.subscribe(trigger, (payload) => {
    if (condition(payload)) action(payload);
  });
});

module.exports = { businessRules };
