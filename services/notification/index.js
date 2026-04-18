// services/notification/index.js — Notification Service (Port 3008)
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors    = require('cors');
const { connect: connectBus, subscribe, EVENTS } = require('../../shared/eventBus');
const { tracingMiddleware, metricsEndpoint, healthCheck } = require('../../shared/observability');

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.use(express.json());
app.use(cors());
app.use(tracingMiddleware('notification-service'));

const createNotification = async (userId, type, title, message, link) => {
  await pool.query(
    'INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)',
    [userId, type, title, message, link || '/']
  );
};

const sendEmail = async (to, subject, body) => {
  if (process.env.SENDGRID_API_KEY) {
    console.log(`[EMAIL] → ${to}: ${subject}`);
  } else {
    console.log(`[EMAIL-MOCK] → ${to}: ${subject}`);
  }
};

const sendWhatsApp = async (phone, message) => {
  if (!phone) return;
  try {
    await fetch(`${process.env.WHATSAPP_SERVICE_URL || 'http://whatsapp:3007'}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message }),
    });
  } catch (e) {
    console.warn('[WA]', e.message);
  }
};

const getUserInfo = async (userId) => {
  const r = await pool.query('SELECT name, email, phone FROM users WHERE id=$1', [userId]);
  return r.rows[0] || {};
};

const handlers = {
  [EVENTS.ORDER_PAID]: async ({ orderId, buyerId, sellerId, total }) => {
    const buyer = await getUserInfo(buyerId);
    await createNotification(buyerId, 'PAGO_CONFIRMADO', 'Pago confirmado',
      `Orden #${orderId} por S/ ${total} confirmada.`, `/my-orders`);
    await createNotification(sellerId, 'NUEVA_ORDEN', 'Nueva orden pagada',
      `Orden #${orderId} por S/ ${total}. Inicia producción.`, `/seller/orders`);
    await sendEmail(buyer.email, `Confirmacion orden #${orderId}`,
      `Hola ${buyer.name}, tu pago de S/ ${total} fue confirmado.`);
    await sendWhatsApp(buyer.phone,
      `Pago confirmado - Orden #${orderId}\nTotal: S/ ${total}\nVer: ${process.env.FRONTEND_URL}/my-orders`);
  },

  [EVENTS.ORDER_SHIPPED]: async ({ orderId, buyerId, trackingCode, carrier }) => {
    const buyer = await getUserInfo(buyerId);
    await createNotification(buyerId, 'ORDEN_ENVIADA', 'Pedido enviado',
      `Orden #${orderId}${trackingCode ? ` - Tracking: ${trackingCode}` : ''}`, `/orders/${orderId}`);
    await sendWhatsApp(buyer.phone,
      `Tu pedido fue enviado!\nOrden #${orderId}\n${trackingCode ? `Tracking: ${trackingCode}` : ''}\nVer: ${process.env.FRONTEND_URL}/orders/${orderId}`);
  },

  [EVENTS.QUOTATION_CREATED]: async ({ quotationId, sellerId, buyerName }) => {
    const seller = await getUserInfo(sellerId);
    await createNotification(sellerId, 'NUEVA_COTIZACION', 'Nueva cotizacion',
      `${buyerName} solicita cotizacion. Responde en 4 horas.`, `/seller/quotations`);
    await sendWhatsApp(seller.phone,
      `Nueva solicitud de cotizacion\nDe: ${buyerName}\nResponde: ${process.env.FRONTEND_URL}/seller/quotations`);
  },

  [EVENTS.QUOTATION_SENT]: async ({ buyerId, sellerName, price }) => {
    const buyer = await getUserInfo(buyerId);
    await createNotification(buyerId, 'COTIZACION_RECIBIDA', 'Cotizacion recibida',
      `${sellerName} respondio: S/ ${price}`, `/my-quotations`);
    await sendWhatsApp(buyer.phone,
      `Cotizacion recibida\nDe: ${sellerName}\nPrecio: S/ ${price}\nVer: ${process.env.FRONTEND_URL}/my-quotations`);
  },

  [EVENTS.QUOTATION_ACCEPTED]: async ({ sellerId, buyerName, price }) => {
    await createNotification(sellerId, 'COTIZACION_ACEPTADA', 'Cotizacion aceptada',
      `${buyerName} acepto tu cotizacion por S/ ${price}`, `/seller/orders`);
  },

  [EVENTS.SELLER_APPROVED]: async ({ userId, name }) => {
    const user = await getUserInfo(userId);
    await createNotification(userId, 'CUENTA_APROBADA', 'Cuenta aprobada',
      'Ya puedes publicar productos.', `/seller/orders`);
    await sendEmail(user.email, 'Bienvenido a Futura Marketplace',
      `Hola ${name}, tu cuenta fue aprobada.`);
  },

  [EVENTS.DISPUTE_OPENED]: async ({ disputeId, orderId, againstId }) => {
    await createNotification(againstId, 'DISPUTA_ABIERTA', 'Disputa abierta',
      `Disputa #${disputeId} en orden #${orderId}`, `/my-orders`);
    const admins = await pool.query("SELECT id FROM users WHERE role='ADMIN'");
    for (const a of admins.rows) {
      await createNotification(a.id, 'DISPUTA_ADMIN', 'Nueva disputa',
        `Caso #${disputeId} - Orden #${orderId}`, `/admin/disputes`);
    }
  },

  [EVENTS.PAYMENT_REFUNDED]: async ({ orderId, buyerId, amount }) => {
    const buyer = await getUserInfo(buyerId);
    await createNotification(buyerId, 'REEMBOLSO', 'Reembolso procesado',
      `S/ ${amount} seran devueltos en 3-5 dias habiles`, `/my-orders`);
    await sendEmail(buyer.email, `Reembolso - Orden #${orderId}`,
      `Tu reembolso de S/ ${amount} fue procesado.`);
  },

  [EVENTS.REVIEW_CREATED]: async ({ sellerId, rating, buyerName }) => {
    await createNotification(sellerId, 'NUEVA_RESENA', 'Nueva resena',
      `${buyerName} te califico con ${rating} estrellas`, `/seller/dashboard`);
  },

  [EVENTS.NOTIFICATION_SEND]: async ({ userId, type, title, message, link, channels }) => {
    await createNotification(userId, type, title, message, link);
    const user = await getUserInfo(userId);
    if (channels?.includes('whatsapp') && user.phone)
      await sendWhatsApp(user.phone, `${title}\n${message}`);
    if (channels?.includes('email') && user.email)
      await sendEmail(user.email, title, message);
  },

  [EVENTS.WHATSAPP_SEND]: async ({ phone, message }) => {
    await sendWhatsApp(phone, message);
  },
};

app.get('/health', healthCheck('notification-service', {
  database: async () => { await pool.query('SELECT 1'); return { db: 'ok' }; },
}));
app.get('/metrics', metricsEndpoint('notification-service'));

app.post('/api/notifications/send', async (req, res) => {
  try {
    await handlers[EVENTS.NOTIFICATION_SEND](req.body);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const start = async () => {
  await connectBus(15);
  await subscribe('notification-service', handlers);
  app.listen(3008, () => console.log('✅ Notification Service activo en :3008'));
};

start().catch(console.error);
