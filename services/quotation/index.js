// services/quotation/index.js — Quotation Service (Port 3004)
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { auth, role, rateLimit, requestLogger, redis } = require('../../shared/middleware');
const { connect: connectBus, publish, EVENTS } = require('../../shared/eventBus');
const { tracingMiddleware, metricsEndpoint, healthCheck } = require('../../shared/observability');

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.use(express.json());
app.use(cors());
app.use(requestLogger('quotation-service'));
app.use(tracingMiddleware('quotation-service'));

// Local upload (fallback from S3)
const uploadDir = '/app/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

app.get('/health', healthCheck('quotation-service', {
  database: async () => { await pool.query('SELECT 1'); return { db: 'ok' }; },
}));
app.get('/metrics', metricsEndpoint('quotation-service'));

// ─── Create quotation (buyer) ──────────────────────────────
app.post('/api/quotations', auth, role('COMPRADOR'),
  upload.array('designFiles', 10), async (req, res) => {
  try {
    const { sellerId, productId, quantity, specifications, material, size, urgency } = req.body;
    if (!sellerId || !quantity || !specifications)
      return res.status(400).json({ error: 'sellerId, quantity y specifications son requeridos' });

    // Max 10 active quotations per buyer
    const active = await pool.query(
      "SELECT COUNT(*) FROM quotations WHERE buyer_id=$1 AND status IN ('PENDIENTE','ENVIADA')",
      [req.user.id]
    );
    if (parseInt(active.rows[0].count) >= 10)
      return res.status(400).json({ error: 'Máximo 10 cotizaciones activas simultáneas' });

    const expires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
    const q = await pool.query(
      `INSERT INTO quotations(buyer_id,seller_id,product_id,quantity,specifications,material,size,urgency,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [req.user.id, sellerId, productId || null, quantity, specifications,
       material || null, size || null, urgency || 'NORMAL', expires]
    );
    const quotationId = q.rows[0].id;

    // Save design files
    const files = [];
    if (req.files?.length) {
      for (const f of req.files) {
        const url = `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/${f.filename}`;
        await pool.query(
          'INSERT INTO design_files(quotation_id,uploaded_by,file_name,file_url,file_type,file_size) VALUES($1,$2,$3,$4,$5,$6)',
          [quotationId, req.user.id, f.originalname, url, f.mimetype, f.size]
        );
        files.push({ name: f.originalname, url });
      }
    }

    // Publish event
    const buyer = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
    await publish(EVENTS.QUOTATION_CREATED, {
      quotationId,
      sellerId: parseInt(sellerId),
      buyerId: req.user.id,
      buyerName: buyer.rows[0]?.name,
      specifications,
      quantity,
      files: files.length,
    });

    res.status(201).json({ ok: true, quotationId });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error interno' }); }
});

// ─── Get buyer quotations ──────────────────────────────────
app.get('/api/my-quotations', auth, role('COMPRADOR'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT q.*, p.title AS product_title, p.image_url,
        u.name AS seller_name,
        COALESCE(json_agg(df.*) FILTER (WHERE df.id IS NOT NULL),'[]') AS design_files
      FROM quotations q
      LEFT JOIN products p ON p.id=q.product_id
      JOIN users u ON u.id=q.seller_id
      LEFT JOIN design_files df ON df.quotation_id=q.id
      WHERE q.buyer_id=$1
      GROUP BY q.id,p.title,p.image_url,u.name
      ORDER BY q.created_at DESC`, [req.user.id]);
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Get seller quotations ─────────────────────────────────
app.get('/api/seller/quotations', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT q.*, p.title AS product_title, p.image_url,
        u.name AS buyer_name, u.email AS buyer_email, u.phone AS buyer_phone,
        COALESCE(json_agg(df.*) FILTER (WHERE df.id IS NOT NULL),'[]') AS design_files
      FROM quotations q
      LEFT JOIN products p ON p.id=q.product_id
      JOIN users u ON u.id=q.buyer_id
      LEFT JOIN design_files df ON df.quotation_id=q.id
      WHERE q.seller_id=$1
      GROUP BY q.id,p.title,p.image_url,u.name,u.email,u.phone
      ORDER BY q.created_at DESC`, [req.user.id]);
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Seller responds to quotation ──────────────────────────
app.put('/api/seller/quotations/:id', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const { quotedPrice, productionDays, notes, status, rejectedReason } = req.body;
    const q = await pool.query(
      'SELECT * FROM quotations WHERE id=$1 AND seller_id=$2', [req.params.id, req.user.id]
    );
    if (!q.rows.length) return res.status(404).json({ error: 'Cotización no encontrada' });

    const newStatus = status || 'ENVIADA';
    await pool.query(
      `UPDATE quotations SET quoted_price=$1,production_days=$2,notes=$3,
       status=$4,rejected_reason=$5,updated_at=now() WHERE id=$6`,
      [quotedPrice, productionDays, notes, newStatus, rejectedReason || null, req.params.id]
    );

    const seller = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
    if (newStatus === 'ENVIADA') {
      await publish(EVENTS.QUOTATION_SENT, {
        quotationId: parseInt(req.params.id),
        buyerId: q.rows[0].buyer_id,
        sellerId: req.user.id,
        sellerName: seller.rows[0]?.name,
        price: quotedPrice,
        productionDays,
      });
    }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Buyer accepts quotation → creates order ───────────────
app.post('/api/quotations/:id/accept', auth, role('COMPRADOR'), async (req, res) => {
  try {
    const q = await pool.query(
      "SELECT * FROM quotations WHERE id=$1 AND buyer_id=$2 AND status='ENVIADA'",
      [req.params.id, req.user.id]
    );
    if (!q.rows.length) return res.status(404).json({ error: 'Cotización no disponible' });
    const quot = q.rows[0];

    // Get commission rate
    let commissionRate = 10;
    if (quot.product_id) {
      const catR = await pool.query(
        'SELECT c.commission_rate FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=$1',
        [quot.product_id]
      );
      if (catR.rows.length) commissionRate = parseFloat(catR.rows[0].commission_rate);
    }
    const commission = quot.quoted_price * (commissionRate / 100);
    const net        = quot.quoted_price - commission;

    // Create order
    const ord = await pool.query(
      'INSERT INTO orders(buyer_id,quotation_id,total,status) VALUES($1,$2,$3,$4) RETURNING id',
      [req.user.id, quot.id, quot.quoted_price, 'CREADA']
    );
    const orderId = ord.rows[0].id;

    await pool.query(
      `INSERT INTO order_items(order_id,product_id,seller_id,quantity,price,commission,net,specifications,material,size)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [orderId, quot.product_id || 1, quot.seller_id, quot.quantity,
       quot.quoted_price, commission, net, quot.specifications, quot.material, quot.size]
    );

    await pool.query("UPDATE quotations SET status='ACEPTADA',updated_at=now() WHERE id=$1", [quot.id]);

    await publish(EVENTS.QUOTATION_ACCEPTED, {
      quotationId: quot.id, orderId,
      sellerId: quot.seller_id, buyerId: req.user.id,
      price: quot.quoted_price,
    });

    res.json({ ok: true, orderId });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error interno' }); }
});

// ─── Compare quotations ────────────────────────────────────
app.get('/api/quotations/compare', auth, role('COMPRADOR'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT q.*, u.name AS seller_name,
        sp.rating_avg, sp.total_sales, sp.location_city, sp.verified
      FROM quotations q JOIN users u ON u.id=q.seller_id
      LEFT JOIN seller_profiles sp ON sp.user_id=q.seller_id
      WHERE q.buyer_id=$1 AND q.status='ENVIADA'
      ORDER BY q.quoted_price ASC`, [req.user.id]);
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

const start = async () => {
  await connectBus(10).catch(() => console.warn('[quotation] RabbitMQ not available'));
  app.listen(3004, () => console.log('✅ Quotation Service activo en :3004'));
};
start();
