// services/shipping/index.js — Shipping Service (Port 3005)
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors    = require('cors');
const { auth, requestLogger, redis } = require('../../shared/middleware');
const { subscribe, publish, EVENTS } = require('../../shared/events');

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.use(express.json());
app.use(cors());
app.use(requestLogger('SHIPPING-SVC'));

const CARRIERS = {
  OLVA:   { name: 'Olva Courier', trackUrl: 'https://www.olvacourier.com/tracking?code=' },
  SHALOM: { name: 'Shalom',       trackUrl: 'https://www.shalomempresarial.com.pe/tracking?guia=' },
  FEDEX:  { name: 'FedEx',        trackUrl: 'https://www.fedex.com/fedextrack/?trknbr=' },
  UPS:    { name: 'UPS',          trackUrl: 'https://www.ups.com/track?tracknum=' },
};

// ─── Mock shipping rate calculation ───────────────────────
const calculateRate = (origin, destination, weight, dimensions) => {
  const baseRate    = 12.00;
  const weightRate  = parseFloat(weight || 1) * 2.50;
  const distanceMod = origin === destination ? 0 : 15.00;
  return {
    rates: [
      { carrier: 'OLVA',   name: 'Olva Courier',  price: parseFloat((baseRate + weightRate + distanceMod * 0.8).toFixed(2)), days: 2, service: 'Estándar' },
      { carrier: 'SHALOM', name: 'Shalom',         price: parseFloat((baseRate + weightRate + distanceMod).toFixed(2)),      days: 3, service: 'Estándar' },
      { carrier: 'FEDEX',  name: 'FedEx Express',  price: parseFloat((baseRate + weightRate + distanceMod * 1.8).toFixed(2)), days: 1, service: 'Express' },
    ].sort((a, b) => a.price - b.price),
  };
};

// ─── Generate mock tracking code ──────────────────────────
const genTracking = (carrier) => {
  const prefix = { OLVA:'OLV', SHALOM:'SHM', FEDEX:'FDX', UPS:'UPS' }[carrier] || 'FUT';
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
};

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'shipping' }));

// ─── Calculate shipping rates ─────────────────────────────
app.post('/api/shipping/calculate', async (req, res) => {
  try {
    const { origin = 'Lima', destination = 'Lima', weight = 1, dimensions } = req.body;
    const result = calculateRate(origin, destination, weight, dimensions);
    res.json(result);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Create shipment ──────────────────────────────────────
app.post('/api/shipping/create', auth, async (req, res) => {
  try {
    const { orderId, carrier, recipientName, recipientPhone, recipientAddress, city } = req.body;

    const tracking = genTracking(carrier);
    const est = new Date();
    est.setDate(est.getDate() + (CARRIERS[carrier]?.days || 3));

    // Save to DB
    await pool.query(
      `INSERT INTO shipments(order_id,carrier,tracking_code,recipient_name,recipient_phone,
       recipient_address,city,status,estimated_delivery) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT(order_id) DO UPDATE SET
         carrier=$2,tracking_code=$3,status=$8,estimated_delivery=$9`,
      [orderId, carrier, tracking, recipientName, recipientPhone, recipientAddress, city, 'CREATED', est.toISOString().split('T')[0]]
    );

    // Update order tracking code
    await pool.query('UPDATE orders SET tracking_code=$1,estimated_delivery=$2 WHERE id=$3',
      [tracking, est.toISOString().split('T')[0], orderId]);

    const carrierInfo = CARRIERS[carrier] || { name: carrier, trackUrl: '' };
    res.json({
      ok: true,
      tracking,
      carrier: carrierInfo.name,
      trackUrl: `${carrierInfo.trackUrl}${tracking}`,
      estimatedDelivery: est.toISOString().split('T')[0],
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error interno' }); }
});

// ─── Track shipment ───────────────────────────────────────
app.get('/api/shipping/track/:code', async (req, res) => {
  try {
    const cacheKey = `shipment:${req.params.code}`;
    const cached   = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const r = await pool.query(
      'SELECT s.*,o.buyer_id FROM shipments s LEFT JOIN orders o ON o.id=s.order_id WHERE s.tracking_code=$1',
      [req.params.code]
    );

    if (!r.rows.length) return res.status(404).json({ error: 'Envío no encontrado' });
    const shipment = r.rows[0];

    // Mock tracking events
    const events = [
      { timestamp: shipment.created_at,     status: 'CREATED',      description: 'Envío creado y registrado',      location: 'Almacén origen' },
      { timestamp: new Date(new Date(shipment.created_at).getTime() + 2*3600*1000), status: 'PICKED_UP', description: 'Paquete recogido por courier', location: 'Almacén origen' },
      { timestamp: new Date(new Date(shipment.created_at).getTime() + 8*3600*1000), status: 'IN_TRANSIT', description: 'En tránsito', location: 'Centro de distribución Lima' },
    ];

    if (shipment.status === 'DELIVERED') {
      events.push({ timestamp: new Date(), status: 'DELIVERED', description: 'Entregado al destinatario', location: shipment.city });
    }

    const data = { ...shipment, events, carrier: CARRIERS[shipment.carrier] || { name: shipment.carrier } };
    await redis.setex(cacheKey, 300, JSON.stringify(data));
    res.json(data);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Webhook from carrier (mock) ─────────────────────────
app.post('/api/shipping/webhook/:carrier', async (req, res) => {
  res.sendStatus(200);
  try {
    const { tracking_code, status, timestamp, location } = req.body;
    if (!tracking_code) return;

    await pool.query(
      'UPDATE shipments SET status=$1,updated_at=now() WHERE tracking_code=$2',
      [status, tracking_code]
    );

    if (status === 'DELIVERED') {
      const s = await pool.query(
        'SELECT s.order_id,o.buyer_id FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.tracking_code=$1',
        [tracking_code]
      );
      if (s.rows.length) {
        await pool.query('INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)',
          [s.rows[0].buyer_id, 'ORDEN_ENTREGADA', '¡Tu pedido fue entregado!',
           `Código de seguimiento: ${tracking_code}`, `/orders/${s.rows[0].order_id}`]);
      }
    }

    await redis.del(`shipment:${tracking_code}`);
  } catch (e) { console.error('[SHIPPING-WEBHOOK]', e.message); }
});

// ─── Order shipping status ────────────────────────────────
app.get('/api/shipping/order/:orderId', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM shipments WHERE order_id=$1', [req.params.orderId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Sin envío registrado' });
    const s = r.rows[0];
    const carrierInfo = CARRIERS[s.carrier] || { name: s.carrier, trackUrl: '' };
    res.json({ ...s, carrier_info: carrierInfo, track_url: `${carrierInfo.trackUrl}${s.tracking_code}` });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// Subscribe to order events
subscribe({
  [EVENTS.ORDER_PAID]: async ({ orderId, buyerId }) => {
    console.log(`[SHIPPING] Orden #${orderId} pagada, notificando al vendedor para preparar envío`);
    await pool.query('INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)',
      [buyerId, 'ENVIO_INFO', 'Tu pedido está siendo preparado',
       'El vendedor preparará tu pedido para envío.', `/orders/${orderId}`]
    ).catch(() => {});
  },
});

app.listen(3005, () => console.log('✅ Shipping Service activo en :3005'));
