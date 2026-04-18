// services/payment/index.js — Payment Service (Port 3006)
// PCI-DSS: nunca almacenar datos de tarjeta — usar tokens de pasarela
require('dotenv').config();
const express  = require('express');
const { Pool } = require('pg');
const cors     = require('cors');
const crypto   = require('crypto');
const { auth, role, rateLimit, requestLogger, redis } = require('../../shared/middleware');
const { connect, publish, subscribe, EVENTS } = require('../../shared/events');
const { createMetrics } = require('../../shared/metrics');
const { MercadoPagoConfig, Preference, Payment: MPPayment } = require('mercadopago');

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const m    = createMetrics('payment');

app.use(express.json());
app.use(cors());
app.use(requestLogger('PAYMENT-SVC'));
app.use(m.middleware);
app.get('/health',  (req, res) => res.json({ status: 'ok', service: 'payment' }));
app.get('/metrics', m.metricsHandler);

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-mock',
});

// ── PCI-DSS Tokenization layer ─────────────────────────────
// Tokens se almacenan en Redis con TTL corto
// Nunca se almacena PAN, CVV ni datos sensibles en BD
const tokenizePaymentMethod = async (paymentData) => {
  const token = crypto.randomBytes(32).toString('hex');
  const safe  = { token, type: paymentData.type, last4: paymentData.last4, brand: paymentData.brand };
  await redis.setex(`pmt:token:${token}`, 3600, JSON.stringify(safe));
  return token;
};

// ── Create payment / SANDBOX ───────────────────────────────
app.post('/api/payments/create', auth, async (req, res) => {
  try {
    const { orderId } = req.body;
    const o = await pool.query('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2', [orderId, req.user.id]);
    if (!o.rows.length) return res.status(404).json({ error: 'Orden no encontrada' });
    const order = o.rows[0];

    // SANDBOX MODE: auto-approve sin pago real
    const idempotencyKey = crypto.randomUUID();
    const heldUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO payments(order_id,provider,provider_payment_id,status,amount,held_until) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
      [order.id, 'MP', 'SANDBOX-' + idempotencyKey, 'APPROVED', order.total, heldUntil]
    );
    await pool.query("UPDATE orders SET status='PAGADA' WHERE id=$1", [order.id]);

    // Audit log — PCI-DSS compliance
    await pool.query(
      'INSERT INTO audit_logs(user_id,action,resource,ip,status_code,payload_size) VALUES($1,$2,$3,$4,$5,$6)',
      [req.user.id, `PAYMENT_CREATED order:${order.id} amount:${order.total}`, '/api/payments/create', req.ip, 200, 0]
    ).catch(() => {});

    await publish(EVENTS.PAYMENT_CONFIRMED, {
      orderId: order.id,
      buyerId: req.user.id,
      amount: order.total,
    });

    res.json({ url: `${process.env.FRONTEND_URL}/checkout/success`, orderId: order.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al procesar pago' });
  }
});

// ── Payment status ─────────────────────────────────────────
app.get('/api/payments/order/:orderId', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM payments WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1', [req.params.orderId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Pago no encontrado' });
    // PCI: remove sensitive data before returning
    const { raw_response, ...safe } = r.rows[0];
    res.json(safe);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ── Refund ─────────────────────────────────────────────────
app.post('/api/payments/refund/:orderId', auth, async (req, res) => {
  try {
    const pmt = await pool.query('SELECT * FROM payments WHERE order_id=$1 AND status=$2', [req.params.orderId, 'APPROVED']);
    if (!pmt.rows.length) return res.status(404).json({ error: 'Pago no encontrado o no aprobado' });

    await pool.query("UPDATE payments SET status='REFUNDED' WHERE order_id=$1", [req.params.orderId]);
    await pool.query("UPDATE orders SET status='REEMBOLSADA' WHERE id=$1", [req.params.orderId]);

    await pool.query(
      'INSERT INTO audit_logs(user_id,action,resource,ip,status_code,payload_size) VALUES($1,$2,$3,$4,$5,$6)',
      [req.user.id, `REFUND order:${req.params.orderId}`, '/api/payments/refund', req.ip, 200, 0]
    ).catch(() => {});

    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ── MercadoPago Webhook ────────────────────────────────────
app.post('/api/webhook/mp', express.raw({ type: 'application/json' }), async (req, res) => {
  res.sendStatus(200); // Respond to MP immediately
  try {
    const body     = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const mpSig    = req.headers['x-signature'];
    const mpReqId  = req.headers['x-request-id'];

    // Verify MP signature (production)
    if (mpSig && process.env.MP_WEBHOOK_SECRET) {
      const parts = mpSig.split(',').reduce((acc, p) => {
        const [k, v] = p.split('=');
        acc[k.trim()] = v;
        return acc;
      }, {});
      const manifest  = `id:${body.data?.id};request-id:${mpReqId};ts:${parts.ts};`;
      const expected  = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET).update(manifest).digest('hex');
      if (parts.v1 !== expected) { console.warn('[MP-WEBHOOK] Invalid signature'); return; }
    }

    if (body.type === 'payment' && body.data?.id) {
      // In production: verify payment with MP API
      const orderId = body.data?.metadata?.order_id;
      if (orderId) {
        await pool.query("UPDATE orders SET status='PAGADA' WHERE id=$1 AND status='PENDIENTE_PAGO'", [orderId]);
        await publish(EVENTS.PAYMENT_CONFIRMED, { orderId, amount: body.data?.amount });
      }
    }
  } catch (e) { console.error('[MP-WEBHOOK]', e.message); }
});

// ── Admin: payment reports ─────────────────────────────────
app.get('/api/admin/commissions', auth, role('ADMIN'), async (req, res) => {
  try {
    const items = await pool.query(`
      SELECT i.*, o.status AS order_status, p.title AS product_title, u.name AS seller_name
      FROM order_items i JOIN orders o ON o.id=i.order_id
      JOIN products p ON p.id=i.product_id JOIN users u ON u.id=i.seller_id
      ORDER BY o.created_at DESC`);
    const totals = await pool.query(`
      SELECT SUM(i.commission) AS total_commission, SUM(i.net) AS total_net
      FROM order_items i JOIN orders o ON o.id=i.order_id
      WHERE o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')`);
    res.json({ items: items.rows, totals: totals.rows[0] });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

connect().then(() => console.log('[PAYMENT-SVC] RabbitMQ ready'));
app.listen(process.env.PORT || 3006, () => console.log(`✅ Payment Service :${process.env.PORT || 3006}`));
