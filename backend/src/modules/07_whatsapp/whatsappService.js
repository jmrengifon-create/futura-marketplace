/**
 * MÓDULO 07 — WHATSAPP (Meta Cloud API)
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 *
 * Deps: npm install axios
 * Config: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID en .env
 * Routes: POST /api/whatsapp/send, POST /api/whatsapp/webhook
 */

const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { Pool } = require('pg');
const { eventBus, EVENTS } = require('../shared/eventBus');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const WA_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
const WA_HDR = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' };

const MIGRATION = `
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  phone VARCHAR(20),
  template_name VARCHAR(100),
  body TEXT,
  direction VARCHAR(10) DEFAULT 'outbound',
  wa_message_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS whatsapp_flows (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  trigger_event VARCHAR(100),
  steps JSONB,
  is_active BOOLEAN DEFAULT true
);
`;

// ── Enviar mensaje de texto simple ────────────────────────────────────────
async function sendText(phone, body) {
  const payload = {
    messaging_product: 'whatsapp',
    to: phone.replace(/\D/g, ''),
    type: 'text',
    text: { body },
  };
  const { data } = await axios.post(WA_URL, payload, { headers: WA_HDR });
  return data;
}

// ── Enviar template (requiere aprobación Meta) ─────────────────────────────
async function sendTemplate(phone, templateName, params = []) {
  const payload = {
    messaging_product: 'whatsapp',
    to: phone.replace(/\D/g, ''),
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'es' },
      components: params.length ? [{
        type: 'body',
        parameters: params.map(p => ({ type: 'text', text: String(p) })),
      }] : [],
    },
  };
  const { data } = await axios.post(WA_URL, payload, { headers: WA_HDR });
  return data;
}

// ── Guardar mensaje en BD ──────────────────────────────────────────────────
async function logMessage(userId, phone, body, templateName, waId) {
  await db.query(`
    INSERT INTO whatsapp_messages (user_id, phone, body, template_name, wa_message_id)
    VALUES ($1,$2,$3,$4,$5)
  `, [userId, phone, body, templateName, waId]);
}

// ── Obtener teléfono del usuario ───────────────────────────────────────────
async function getUserPhone(userId) {
  const { rows: [u] } = await db.query(`SELECT phone FROM users WHERE id = $1`, [userId]);
  return u?.phone || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// FLUJOS AUTOMÁTICOS (CRM Funnel)
// ═══════════════════════════════════════════════════════════════════════════

// Flujo 1: Pago recibido
eventBus.subscribe(EVENTS.ORDER_PAID, async ({ userId, amount, orderId }) => {
  const phone = await getUserPhone(userId);
  if (!phone) return;
  const msg = `✅ *Futura Marketplace*\n\nTu pago de S/ ${amount} fue confirmado. Pedido #${orderId} en proceso. ¡Gracias!`;
  const res = await sendText(phone, msg).catch(e => console.error('[WA] Error pago:', e.message));
  if (res) await logMessage(userId, phone, msg, null, res.messages?.[0]?.id);
});

// Flujo 2: Alerta cuota por vencer
eventBus.subscribe(EVENTS.CREDIT_PAYMENT_DUE, async ({ userId, amount, dueDate }) => {
  const phone = await getUserPhone(userId);
  if (!phone) return;
  const msg = `⚠️ *Futura Marketplace – Recordatorio*\n\nTu cuota de S/ ${amount} vence el ${new Date(dueDate).toLocaleDateString('es-PE')}.\nEvita penalidades pagando a tiempo.`;
  const res = await sendText(phone, msg).catch(e => console.error('[WA] Error cuota:', e.message));
  if (res) await logMessage(userId, phone, msg, null, res.messages?.[0]?.id);
});

// Flujo 3: Cuota en mora
eventBus.subscribe(EVENTS.CREDIT_OVERDUE, async ({ userId, daysLate, penalty }) => {
  const phone = await getUserPhone(userId);
  if (!phone) return;
  const msg = `🔴 *Futura Marketplace – Deuda vencida*\n\n${daysLate} días de mora. Penalidad acumulada: S/ ${penalty.toFixed(2)}.\nContáctenos para regularizar: ${process.env.CONTACT_PHONE || '+51999999999'}`;
  const res = await sendText(phone, msg).catch(e => console.error('[WA] Error mora:', e.message));
  if (res) await logMessage(userId, phone, msg, null, res.messages?.[0]?.id);
});

// Flujo 4: Nueva promoción
eventBus.subscribe(EVENTS.PROMOTION_CREATED, async ({ target_segment, title, discount_value }) => {
  if (target_segment === 'all' || target_segment === 'vip') {
    const { rows } = await db.query(
      `SELECT id, phone FROM users WHERE loyalty_tier = 'vip' AND phone IS NOT NULL`
    );
    for (const u of rows) {
      const msg = `🎁 *Oferta exclusiva Futura*\n\n${title}\n💰 ${discount_value}% de descuento. ¡Solo por tiempo limitado!`;
      await sendText(u.phone, msg).catch(() => {});
      await logMessage(u.id, u.phone, msg, null, null);
      await new Promise(r => setTimeout(r, 200)); // rate limit
    }
  }
});

// Flujo 5: Vendor aprobado
eventBus.subscribe(EVENTS.VENDOR_APPROVED, async ({ userId }) => {
  const phone = await getUserPhone(userId);
  if (!phone) return;
  const msg = `🎉 *¡Felicitaciones!*\n\nTu cuenta de vendedor en Futura Marketplace ha sido *aprobada*.\nYa puedes publicar tus productos en: ${process.env.APP_URL}`;
  await sendText(phone, msg).catch(() => {});
});

// ── POST Envío manual (admin) ──────────────────────────────────────────────
router.post('/send', async (req, res) => {
  const { user_id, phone, message } = req.body;
  const targetPhone = phone || await getUserPhone(user_id);
  if (!targetPhone) return res.status(400).json({ error: 'Teléfono no encontrado' });

  const result = await sendText(targetPhone, message);
  await logMessage(user_id, targetPhone, message, null, result.messages?.[0]?.id);
  res.json({ success: true, waId: result.messages?.[0]?.id });
});

// ── POST Webhook de WhatsApp (recibir mensajes entrantes) ─────────────────
router.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === process.env.WA_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.status(403).send('Forbidden');
  }
});

router.post('/webhook', async (req, res) => {
  const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
  if (entry?.messages) {
    for (const msg of entry.messages) {
      console.log('[WA Incoming]', msg.from, msg.text?.body);
      // Guardar mensaje entrante
      await db.query(`
        INSERT INTO whatsapp_messages (phone, body, direction, wa_message_id)
        VALUES ($1,$2,'inbound',$3)
      `, [msg.from, msg.text?.body || '', msg.id]).catch(() => {});
    }
  }
  res.sendStatus(200);
});

// ── GET Historial de mensajes ──────────────────────────────────────────────
router.get('/history/:userId', async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM whatsapp_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.params.userId]
  );
  res.json(rows);
});

module.exports = { router, sendText, sendTemplate, MIGRATION };
