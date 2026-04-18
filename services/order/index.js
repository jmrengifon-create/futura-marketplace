// services/order/index.js — Order Service (Port 3003)
require('dotenv').config();
const express  = require('express');
const { Pool } = require('pg');
const cors     = require('cors');
const { auth, role, rateLimit, requestLogger, redis } = require('../../shared/middleware');
const { connect, publish, subscribe, EVENTS } = require('../../shared/events');
const { createMetrics } = require('../../shared/metrics');

const app    = express();
const pool   = new Pool({ connectionString: process.env.DATABASE_URL });
const m      = createMetrics('order');

app.use(express.json());
app.use(cors());
app.use(requestLogger('ORDER-SVC'));
app.use(m.middleware);
app.get('/health',  (req, res) => res.json({ status: 'ok', service: 'order' }));
app.get('/metrics', m.metricsHandler);

// ── Helpers ────────────────────────────────────────────────
const notifyUser = async (userId, type, title, message, link) => {
  try {
    await pool.query(
      'INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)',
      [userId, type, title, message, link]
    );
  } catch {}
};

// ── GET /api/my-orders ─────────────────────────────────────
app.get('/api/my-orders', auth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT o.*,
        json_agg(json_build_object(
          'id',i.id,'title',p.title,'price',i.price,'quantity',i.quantity,
          'image_url',p.image_url,'seller_name',u.name,'seller_id',i.seller_id,
          'specifications',i.specifications
        )) AS items
      FROM orders o
      JOIN order_items i ON i.order_id=o.id
      JOIN products p ON p.id=i.product_id
      JOIN users u ON u.id=i.seller_id
      WHERE o.buyer_id=$1
      GROUP BY o.id ORDER BY o.created_at DESC`, [req.user.id]);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno' }); }
});

// ── GET /api/orders/:id/timeline ──────────────────────────
app.get('/api/orders/:id/timeline', auth, async (req, res) => {
  try {
    const order = await pool.query(`
      SELECT o.*, json_agg(json_build_object('title',p.title,'image_url',p.image_url,'seller_name',u.name)) AS items
      FROM orders o JOIN order_items i ON i.order_id=o.id
      JOIN products p ON p.id=i.product_id JOIN users u ON u.id=i.seller_id
      WHERE o.id=$1 GROUP BY o.id`, [req.params.id]);

    if (!order.rows.length) return res.status(404).json({ error: 'Orden no encontrada' });
    const o = order.rows[0];
    if (o.buyer_id !== req.user.id && req.user.role !== 'ADMIN') {
      const isSeller = await pool.query('SELECT 1 FROM order_items WHERE order_id=$1 AND seller_id=$2', [req.params.id, req.user.id]);
      if (!isSeller.rows.length) return res.sendStatus(403);
    }

    const logs = await pool.query(`
      SELECT pl.*, u.name AS by_name FROM production_logs pl
      JOIN users u ON u.id=pl.seller_id WHERE pl.order_id=$1 ORDER BY pl.created_at ASC`, [req.params.id]);

    res.json({ order: o, timeline: logs.rows });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ── POST /api/checkout ─────────────────────────────────────
app.post('/api/checkout', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const items = await client.query(`
      SELECT ci.*, p.price, p.seller_id, p.category_id
      FROM cart_items ci JOIN products p ON p.id=ci.product_id
      WHERE ci.user_id=$1`, [req.user.id]);

    if (!items.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Carrito vacío' }); }

    const total = items.rows.reduce((a, i) => a + parseFloat(i.price) * i.quantity, 0);
    const ord   = await client.query(
      'INSERT INTO orders(buyer_id,total,status) VALUES($1,$2,$3) RETURNING id',
      [req.user.id, total, 'CREADA']
    );
    const ordId = ord.rows[0].id;

    for (const item of items.rows) {
      const catR = await client.query('SELECT commission_rate FROM categories WHERE id=$1', [item.category_id]);
      const rate = catR.rows[0]?.commission_rate || 10;
      const price = parseFloat(item.price) * item.quantity;
      const comm  = price * (rate / 100);
      await client.query(
        'INSERT INTO order_items(order_id,product_id,seller_id,quantity,price,commission,net) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [ordId, item.product_id, item.seller_id, item.quantity, price, comm, price - comm]
      );
    }
    await client.query('DELETE FROM cart_items WHERE user_id=$1', [req.user.id]);
    await client.query('COMMIT');

    await publish(EVENTS.ORDER_CREATED, { orderId: ordId, buyerId: req.user.id, total });
    res.json({ orderId: ordId });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Error interno' });
  } finally { client.release(); }
});

// ── POST /api/orders/:id/confirm ──────────────────────────
app.post('/api/orders/:id/confirm', auth, role('COMPRADOR'), async (req, res) => {
  try {
    const o = await pool.query('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2', [req.params.id, req.user.id]);
    if (!o.rows.length) return res.status(404).json({ error: 'Orden no encontrada' });
    await pool.query("UPDATE orders SET status='ENTREGADA',confirmed_at=now() WHERE id=$1", [req.params.id]);
    await pool.query("UPDATE payments SET status='RELEASED',released_at=now() WHERE order_id=$1", [req.params.id]);
    const sellers = await pool.query('SELECT DISTINCT seller_id FROM order_items WHERE order_id=$1', [req.params.id]);
    for (const s of sellers.rows) {
      await pool.query('UPDATE seller_profiles SET total_sales=total_sales+1 WHERE user_id=$1', [s.seller_id]);
      await notifyUser(s.seller_id, 'PAGO_LIBERADO', '¡Pago liberado!', `Orden #${req.params.id} confirmada.`, '/seller/orders');
    }
    await publish(EVENTS.ORDER_DELIVERED, { orderId: parseInt(req.params.id), buyerId: req.user.id });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ── POST /api/orders/:id/cancel ───────────────────────────
app.post('/api/orders/:id/cancel', auth, role('COMPRADOR'), async (req, res) => {
  try {
    const o = await pool.query('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2', [req.params.id, req.user.id]);
    if (!o.rows.length) return res.status(404).json({ error: 'No encontrada' });
    if (!['CREADA','PENDIENTE_PAGO','PAGADA'].includes(o.rows[0].status)) return res.status(400).json({ error: 'No cancelable en este estado' });
    await pool.query("UPDATE orders SET status='CANCELADA' WHERE id=$1", [req.params.id]);
    await publish(EVENTS.ORDER_CANCELLED, { orderId: parseInt(req.params.id), buyerId: req.user.id });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ── POST /api/orders/:id/refund ───────────────────────────
app.post('/api/orders/:id/refund', auth, async (req, res) => {
  try {
    const o = await pool.query('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2', [req.params.id, req.user.id]);
    if (!o.rows.length) return res.status(404).json({ error: 'No encontrada' });
    if (!['PAGADA','EN_PRODUCCION'].includes(o.rows[0].status)) return res.status(400).json({ error: 'No reembolsable en este estado' });
    await pool.query("UPDATE orders SET status='REEMBOLSADA' WHERE id=$1", [req.params.id]);
    await pool.query("UPDATE payments SET status='REFUNDED' WHERE order_id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ── Seller order endpoints ─────────────────────────────────
app.get('/api/seller/orders', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT o.id, o.status, o.total, o.created_at, o.tracking_code,
        i.price, i.commission, i.net, i.quantity, i.specifications,
        p.title AS product_title, p.image_url,
        u.name AS buyer_name, u.email AS buyer_email, u.phone AS buyer_phone,
        COALESCE(json_agg(pl.*) FILTER (WHERE pl.id IS NOT NULL), '[]') AS production_logs
      FROM orders o
      JOIN order_items i ON i.order_id=o.id AND i.seller_id=$1
      JOIN products p ON p.id=i.product_id
      JOIN users u ON u.id=o.buyer_id
      LEFT JOIN production_logs pl ON pl.order_id=o.id AND pl.seller_id=$1
      GROUP BY o.id,o.status,o.total,o.created_at,o.tracking_code,
        i.price,i.commission,i.net,i.quantity,i.specifications,p.title,p.image_url,u.name,u.email,u.phone
      ORDER BY o.created_at DESC`, [req.user.id]);
    const totals = await pool.query(
      `SELECT SUM(i.commission) AS total_commission, SUM(i.net) AS total_net
       FROM order_items i JOIN orders o ON o.id=i.order_id
       WHERE i.seller_id=$1 AND o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')`,
      [req.user.id]
    );
    res.json({ orders: r.rows, totals: totals.rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/seller/orders/:id/production', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const upload = require('../../backend/s3');
    upload.single('photo')(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message });
      const { status, description } = req.body;
      const photoUrl = req.file ? `http://localhost:3001/uploads/${req.file.filename}` : null;
      await pool.query(
        'INSERT INTO production_logs(order_id,seller_id,status,description,photo_url) VALUES($1,$2,$3,$4,$5)',
        [req.params.id, req.user.id, status, description, photoUrl]
      );
      const orderStatus = { LISTO:'LISTO', EN_PRODUCCION:'EN_PRODUCCION' }[status];
      if (orderStatus) await pool.query('UPDATE orders SET status=$1 WHERE id=$2', [orderStatus, req.params.id]);
      const ord = await pool.query('SELECT buyer_id FROM orders WHERE id=$1', [req.params.id]);
      if (ord.rows.length) {
        await notifyUser(ord.rows[0].buyer_id, 'PRODUCCION_UPDATE', 'Actualización de tu pedido',
          `${description || status} — Orden #${req.params.id}`, `/orders/${req.params.id}`);
        await publish(EVENTS.PRODUCTION_UPDATED, { orderId: parseInt(req.params.id), status, photoUrl });
      }
      res.json({ ok: true });
    });
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/orders/:id/shipped', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const { trackingCode } = req.body;
    await pool.query("UPDATE orders SET status='ENVIADA',tracking_code=$1 WHERE id=$2", [trackingCode || null, req.params.id]);
    const ord = await pool.query('SELECT buyer_id FROM orders WHERE id=$1', [req.params.id]);
    if (ord.rows.length) {
      await notifyUser(ord.rows[0].buyer_id, 'ORDEN_ENVIADA', '¡Tu pedido fue enviado!',
        `Orden #${req.params.id}${trackingCode ? ' — Código: '+trackingCode : ''}`, `/my-orders`);
      await publish(EVENTS.ORDER_SHIPPED, { orderId: parseInt(req.params.id), trackingCode });
    }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ── Disputes ───────────────────────────────────────────────
app.post('/api/disputes', auth, async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const ord = await pool.query('SELECT * FROM orders WHERE id=$1', [orderId]);
    if (!ord.rows.length) return res.status(404).json({ error: 'Orden no encontrada' });
    const against = req.user.id === ord.rows[0].buyer_id
      ? (await pool.query('SELECT DISTINCT seller_id FROM order_items WHERE order_id=$1', [orderId])).rows[0]?.seller_id
      : ord.rows[0].buyer_id;
    const d = await pool.query(
      'INSERT INTO disputes(order_id,raised_by,against,reason) VALUES($1,$2,$3,$4) RETURNING id',
      [orderId, req.user.id, against, reason]
    );
    await publish(EVENTS.DISPUTE_OPENED, { disputeId: d.rows[0].id, orderId, raisedBy: req.user.id });
    res.json({ ok: true, disputeId: d.rows[0].id });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// Reviews
app.post('/api/reviews', auth, role('COMPRADOR'), async (req, res) => {
  try {
    const { orderId, rating, comment, qualityOk, onTime } = req.body;
    const ord = await pool.query("SELECT * FROM orders WHERE id=$1 AND buyer_id=$2 AND status='ENTREGADA'", [orderId, req.user.id]);
    if (!ord.rows.length) return res.status(400).json({ error: 'Solo puedes calificar órdenes entregadas' });
    const sellers = await pool.query('SELECT DISTINCT seller_id FROM order_items WHERE order_id=$1', [orderId]);
    for (const s of sellers.rows) {
      await pool.query(
        'INSERT INTO reviews(order_id,buyer_id,seller_id,rating,comment,quality_ok,on_time) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(order_id) DO NOTHING',
        [orderId, req.user.id, s.seller_id, rating, comment, qualityOk !== false, onTime !== false]
      );
      await pool.query(`UPDATE seller_profiles SET rating_avg=(SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE seller_id=$1) WHERE user_id=$1`, [s.seller_id]);
    }
    await publish(EVENTS.REVIEW_CREATED, { orderId, rating, sellerId: sellers.rows[0]?.seller_id });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// Subscribe to payment events
connect().then(() => {
  subscribe('order-service-payments', 'payment.confirmed', {
    [EVENTS.PAYMENT_CONFIRMED]: async ({ orderId, buyerId }) => {
      console.log(`[ORDER-SVC] Payment confirmed for order ${orderId}`);
      const sellers = await pool.query('SELECT DISTINCT seller_id FROM order_items WHERE order_id=$1', [orderId]);
      for (const s of sellers.rows) {
        await notifyUser(s.seller_id, 'NUEVA_ORDEN', '¡Nuevo pedido pagado!',
          `Orden #${orderId} confirmada. Por favor inicia producción.`, `/seller/orders`);
      }
    },
  });
});

app.listen(process.env.PORT || 3003, () => console.log(`✅ Order Service :${process.env.PORT || 3003}`));
