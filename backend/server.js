require('dotenv').config();
const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const { Pool } = require('pg');
const cors     = require('cors');
const upload   = require('./s3');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const Redis     = require('ioredis');
const rateLimit = require('express-rate-limit');
const improvementsRouter = require('./routes/improvements');
const waInbox  = require('./routes/wa-inbox');
const crmRouter = require('./routes/crm');

// Rutas v5.0
const phase1 = require('./routes/phase1');
const phase2 = require('./routes/phase2');
const phase3 = require('./routes/phase3');
const phase4 = require('./routes/phase4');
const phase5 = require('./routes/phase5');

// Redis
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { retryStrategy: (t) => Math.min(t * 50, 2000), lazyConnect: true })
  : new Redis({ host: process.env.REDIS_HOST || 'redis', port: parseInt(process.env.REDIS_PORT) || 6379, retryStrategy: (t) => Math.min(t * 50, 2000), lazyConnect: true });
redis.on('error', (e) => console.warn('[Redis] warn:', e.message));
redis.connect().catch(() => console.warn('[Redis] Not connected'));

const getCache = async (key) => { try { const v = await redis.get(key); return v ? JSON.parse(v) : null; } catch { return null; } };
const setCache = async (key, val, ttl = 120) => { try { await redis.setex(key, ttl, JSON.stringify(val)); } catch {} };
const delCache = async (...keys) => { try { await redis.del(...keys); } catch {} };

// RabbitMQ
const AMQP_URL = process.env.AMQP_URL || 'amqp://futura:futura_rabbit_2026@rabbitmq:5672';
const EXCHANGE = 'marketplace.events';
let _mqChannel = null;

const connectMQ = async () => {
  for (let i = 0; i < 5; i++) {
    try {
      const amqp = require('amqplib');
      const conn = await amqp.connect(AMQP_URL);
      _mqChannel = await conn.createChannel();
      await _mqChannel.assertExchange(EXCHANGE, 'topic', { durable: true });
      console.log('[MQ] Connected');
      conn.on('close', () => { _mqChannel = null; setTimeout(connectMQ, 5000); });
      return;
    } catch (e) {
      console.warn(`[MQ] attempt ${i + 1} failed: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.warn('[MQ] RabbitMQ unavailable');
};

const publishEvent = (routingKey, data) => {
  if (!_mqChannel) return;
  try {
    _mqChannel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify({ event: routingKey, data, ts: new Date().toISOString() })), { persistent: true });
  } catch (e) { console.warn('[MQ] publish error:', e.message); }
};

connectMQ().catch(() => {});

// App & DB
const app = express();
app.set('trust proxy', 1);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'backend', ts: new Date() }));

const limiter     = rateLimit({ windowMs: 60 * 1000, max: 120, message: { error: 'Demasiadas solicitudes' } });
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'Demasiados intentos' } });
app.use('/api/auth', authLimiter);
app.use('/api', limiter);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path !== '/health') {
      const ms  = Date.now() - start;
      const lvl = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
      console.log(`[API] ${lvl} ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
    }
  });
  next();
});

app.use(cors());
app.use('/uploads', express.static('/app/uploads'));

const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-000' });

// Middleware
const auth = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h) return res.sendStatus(401);
  try { req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); next(); }
  catch { res.sendStatus(401); }
};

const role = (r) => (req, res, next) => {
  if (req.user.role !== r) return res.sendStatus(403);
  next();
};

const auditLog = async (userId, action, ip) => {
  try { await pool.query('INSERT INTO audit_logs(user_id,action,resource,ip,status_code,payload_size) VALUES($1,$2,$3,$4,$5,$6)', [userId, action, action.split(' ')[1] || '/', ip, 200, 0]); } catch {}
};

const notify = async (userId, type, title, message, link) => {
  try { await pool.query('INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)', [userId, type, title, message, link]); }
  catch (e) { console.error('notify:', e.message); }
};

// Routers
app.use(improvementsRouter(pool, auth, role, notify, redis));
app.use(waInbox(pool, auth, role));
app.use(phase1(pool, auth, role, notify));
app.use(phase2(pool, auth, role, notify));
app.use(phase3(pool, auth, role, notify));
app.use(phase4(pool, auth, role, notify));
app.use(phase5(pool, auth, role, notify));
app.use(crmRouter(pool, auth, role, notify));

// ═══════════════════════════════════════════════════════════
// INVENTARIO
// ═══════════════════════════════════════════════════════════

app.get('/api/admin/inventory/summary', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT l.id, l.name, l.city,
        COUNT(i.id) AS total_items,
        COALESCE(SUM(i.quantity), 0) AS total_stock,
        COUNT(CASE WHEN i.quantity <= i.min_quantity THEN 1 END) AS low_stock,
        COALESCE(SUM(i.quantity * i.unit_cost), 0) AS total_value
      FROM locations l
      LEFT JOIN inventory i ON i.location_id = l.id
      WHERE l.active = TRUE
      GROUP BY l.id, l.name, l.city ORDER BY l.id`);
    res.json(r.rows);
  } catch(e) { console.error('[inv summary]', e.message); res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/inventory', auth, role('ADMIN'), async (req, res) => {
  try {
    const { location_id } = req.query;
    let sql = `SELECT i.*, l.name AS location_name FROM inventory i JOIN locations l ON l.id = i.location_id`;
    const params = [];
    if (location_id) { sql += ' WHERE i.location_id=$1'; params.push(location_id); }
    sql += ' ORDER BY i.created_at DESC';
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch(e) { console.error('[inventory]', e.message); res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/admin/inventory', auth, role('ADMIN'), async (req, res) => {
  try {
    const { location_id, item_name, item_type, quantity, min_quantity, unit_cost, unit_price } = req.body;
    if (!location_id || !item_name) return res.status(400).json({ error: 'Faltan datos requeridos' });
    const qr_code = 'QR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const r = await pool.query(
      `INSERT INTO inventory(location_id,item_name,item_type,qr_code,quantity,min_quantity,unit_cost,unit_price,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'DISPONIBLE') RETURNING *`,
      [location_id, item_name, item_type || 'PRODUCTO', qr_code, quantity || 0, min_quantity || 1, unit_cost || 0, unit_price || 0]
    );
    res.json(r.rows[0]);
  } catch(e) { console.error('[inventory POST]', e.message); res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/inventory/:id', auth, role('ADMIN'), async (req, res) => {
  try {
    const { quantity, min_quantity, unit_cost, unit_price, status } = req.body;
    await pool.query(
      `UPDATE inventory SET quantity=$1,min_quantity=$2,unit_cost=$3,unit_price=$4,status=$5 WHERE id=$6`,
      [quantity, min_quantity, unit_cost, unit_price, status || 'DISPONIBLE', req.params.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/admin/inventory/:id/movement', auth, role('ADMIN'), async (req, res) => {
  try {
    const { movement_type, quantity, notes } = req.body;
    const item = await pool.query('SELECT * FROM inventory WHERE id=$1', [req.params.id]);
    if (!item.rows.length) return res.status(404).json({ error: 'Item no encontrado' });
    const before = item.rows[0].quantity;
    const after  = movement_type === 'ENTRADA' ? before + parseInt(quantity) : before - parseInt(quantity);
    await pool.query(
      `INSERT INTO inventory_movements(inventory_id,location_id,movement_type,quantity,quantity_before,quantity_after,registered_by,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [req.params.id, item.rows[0].location_id, movement_type, quantity, before, after, req.user.id, notes || '']
    );
    await pool.query('UPDATE inventory SET quantity=$1 WHERE id=$2', [after, req.params.id]);
    res.json({ ok: true, quantity_after: after });
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/machine/:qrCode', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT i.*, l.name AS location_name, l.address AS location_address FROM inventory i
       JOIN locations l ON l.id = i.location_id WHERE i.qr_code=$1`,
      [req.params.qrCode]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Máquina no encontrada' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/receipts', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT er.*, u.name AS buyer_name, u.email AS buyer_email FROM electronic_receipts er
       LEFT JOIN users u ON u.id = er.buyer_id ORDER BY er.issued_at DESC`
    );
    res.json(r.rows);
  } catch(e) { console.error('[receipts]', e.message); res.status(500).json({ error: 'Error interno' }); }
});

// ═══════════════════════════════════════════════════════════
// TÉCNICOS
// ═══════════════════════════════════════════════════════════

app.get('/api/admin/technicians/stats', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT COUNT(*) AS total,
        COUNT(CASE WHEN status='TRABAJANDO' THEN 1 END) AS working,
        COUNT(CASE WHEN status='COMISION'   THEN 1 END) AS on_commission,
        COUNT(CASE WHEN status='PERMISO'    THEN 1 END) AS on_leave,
        COUNT(CASE WHEN status='LIBRE'      THEN 1 END) AS available
      FROM technicians WHERE active=TRUE`);
    res.json({ counts: r.rows[0] });
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/technicians', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM technicians WHERE active=TRUE ORDER BY name');
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/admin/technicians', auth, role('ADMIN'), async (req, res) => {
  try {
    const { name, phone, specialties } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const r = await pool.query(
      `INSERT INTO technicians(name,phone,specialties,status,active)
       VALUES($1,$2,$3,'LIBRE',TRUE) RETURNING *`,
      [name, phone||'', typeof specialties === 'string' ? [specialties] : (specialties||[])]
    );
    res.json(r.rows[0]);
  } catch(e) { console.error('[tech POST]', e.message); res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/technicians/:id/status', auth, role('ADMIN'), async (req, res) => {
  try {
    const { status, current_client, current_address, commission_destination,
            commission_return_date, permission_type, permission_until, notes } = req.body;
    await pool.query(
      `UPDATE technicians SET status=$1,current_client=$2,current_address=$3,
       commission_destination=$4,commission_return_date=$5,permission_type=$6,
       permission_until=$7,notes=$8 WHERE id=$9`,
      [status, current_client || null, current_address || null, commission_destination || null,
       commission_return_date || null, permission_type || null, permission_until || null, notes || null, req.params.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/technical-services', auth, role('ADMIN'), async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT ts.*, t.name AS technician_name FROM technical_services ts JOIN technicians t ON t.id=ts.technician_id`;
    const params = [];
    if (status) { sql += ' WHERE ts.status=$1'; params.push(status); }
    sql += ' ORDER BY ts.created_at DESC';
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/admin/technical-services', auth, role('ADMIN'), async (req, res) => {
  try {
    const { technician_id, client_name, client_address, client_phone, service_type, scheduled_at, problem_reported } = req.body;
    if (!technician_id || !client_name) return res.status(400).json({ error: 'Faltan datos' });
    const tech = await pool.query('SELECT name FROM technicians WHERE id=$1', [technician_id]);
    const r = await pool.query(
      `INSERT INTO technical_services(technician_id,client_name,client_address,client_phone,service_type,scheduled_at,problem_reported,status,technician_name)
       VALUES($1,$2,$3,$4,$5,$6,$7,'EN_CURSO',$8) RETURNING *`,
      [technician_id, client_name, client_address || '', client_phone || '',
       service_type || 'MANTENIMIENTO', scheduled_at || null, problem_reported || '', tech.rows[0]?.name || '']
    );
    await pool.query(
      `UPDATE technicians SET status='TRABAJANDO',current_client=$1,current_address=$2 WHERE id=$3`,
      [client_name, client_address || '', technician_id]
    );
    res.json(r.rows[0]);
  } catch(e) { console.error('[service POST]', e.message); res.status(500).json({ error: 'Error interno' }); }
});

// ═══════════════════════════════════════════════════════════
// MARKETING
// ═══════════════════════════════════════════════════════════

app.get('/api/admin/social-posts', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM social_posts ORDER BY created_at DESC LIMIT 20');
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/admin/social-posts', auth, role('ADMIN'), async (req, res) => {
  try {
    const { title, content, media_url, platforms, scheduled_at } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Título y contenido requeridos' });
    const r = await pool.query(
      `INSERT INTO social_posts(admin_id,title,content,media_url,platforms,scheduled_at,status)
       VALUES($1,$2,$3,$4,$5,$6,'PROGRAMADO') RETURNING *`,
      [req.user.id, title, content, media_url || null, platforms || ['FACEBOOK'], scheduled_at || null]
    );
    res.json(r.rows[0]);
  } catch(e) { console.error('[social POST]', e.message); res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/email-campaigns', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM email_campaigns ORDER BY created_at DESC');
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/admin/email-campaigns', auth, role('ADMIN'), async (req, res) => {
  try {
    const { subject, content, audience } = req.body;
    if (!subject || !content) return res.status(400).json({ error: 'Asunto y contenido requeridos' });
    const r = await pool.query(
      `INSERT INTO email_campaigns(admin_id,subject,content,audience,status) VALUES($1,$2,$3,$4,'BORRADOR') RETURNING *`,
      [req.user.id, subject, content, audience || 'ALL']
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/admin/email-campaigns/:id/send', auth, role('ADMIN'), async (req, res) => {
  try {
    const subs = await pool.query('SELECT COUNT(*) AS total FROM email_subscribers WHERE opted_in=TRUE');
    const count = parseInt(subs.rows[0].total);
    await pool.query("UPDATE email_campaigns SET status='ENVIADA', sent_count=$1 WHERE id=$2", [count, req.params.id]);
    res.json({ ok: true, sent: count });
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/email-subscribers', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query('SELECT COUNT(*) AS total, COUNT(CASE WHEN opted_in THEN 1 END) AS active FROM email_subscribers');
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/social-metrics', auth, role('ADMIN'), async (req, res) => {
  try {
    const posts     = await pool.query('SELECT COUNT(*) AS total, COALESCE(SUM(reach),0) AS reach, COALESCE(SUM(likes),0) AS likes FROM social_posts').catch(() => ({ rows: [{ total: 0, reach: 0, likes: 0 }] }));
    const campaigns = await pool.query('SELECT COUNT(*) AS total, COALESCE(SUM(sent_count),0) AS sent FROM email_campaigns').catch(() => ({ rows: [{ total: 0, sent: 0 }] }));
    const subs      = await pool.query('SELECT COUNT(*) AS total FROM email_subscribers WHERE opted_in=TRUE').catch(() => ({ rows: [{ total: 0 }] }));
    res.json({ posts: posts.rows[0], campaigns: campaigns.rows[0], subscribers: subs.rows[0] });
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

// ═══════════════════════════════════════════════════════════
// CRÉDITOS
// ═══════════════════════════════════════════════════════════

app.get('/api/buyer/credits', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM buyer_credits WHERE buyer_id=$1 ORDER BY created_at DESC', [req.user.id]).catch(() => ({ rows: [] }));
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/buyer/credits/request', auth, async (req, res) => {
  try {
    const { amount, installments } = req.body;
    const monthly = (parseFloat(amount) / parseInt(installments)).toFixed(2);
    const r = await pool.query(
      `INSERT INTO buyer_credits(buyer_id,amount,installments,monthly_payment,status) VALUES($1,$2,$3,$4,'PENDIENTE') RETURNING *`,
      [req.user.id, amount, installments, monthly]
    );
    const admins = await pool.query("SELECT id FROM users WHERE role='ADMIN'");
    const u = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
    for (const a of admins.rows) {
      await notify(a.id, 'SOLICITUD_CREDITO', 'Nueva solicitud de crédito',
        `${u.rows[0].name} solicita crédito de S/ ${amount} en ${installments} cuotas`, '/admin/credits');
    }
    res.json(r.rows[0]);
  } catch(e) { console.error('[credit req]', e.message); res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/credits', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT bc.*, u.name AS buyer_name, u.email AS buyer_email
      FROM buyer_credits bc JOIN users u ON u.id=bc.buyer_id
      ORDER BY bc.created_at DESC`).catch(() => ({ rows: [] }));
    const stats = await pool.query(`
      SELECT COUNT(CASE WHEN status='ACTIVO' THEN 1 END) AS activos,
        COUNT(CASE WHEN status='PENDIENTE' THEN 1 END) AS pendientes,
        COALESCE(SUM(CASE WHEN status='ACTIVO' THEN amount END),0) AS portfolio
      FROM buyer_credits`).catch(() => ({ rows: [{ activos: 0, pendientes: 0, portfolio: 0 }] }));
    res.json({ credits: r.rows, stats: stats.rows[0] });
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/credits/:id/approve', auth, role('ADMIN'), async (req, res) => {
  try {
    const credit = await pool.query('SELECT * FROM buyer_credits WHERE id=$1', [req.params.id]);
    if (!credit.rows.length) return res.status(404).json({ error: 'Crédito no encontrado' });
    await pool.query("UPDATE buyer_credits SET status='ACTIVO',approved_by=$1,approved_at=now() WHERE id=$2", [req.user.id, req.params.id]);
    await notify(credit.rows[0].buyer_id, 'CREDITO_APROBADO', '✅ Crédito aprobado',
      `Tu solicitud de crédito por S/ ${credit.rows[0].amount} fue aprobada`, '/buyer/credits');
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/credits/:id/reject', auth, role('ADMIN'), async (req, res) => {
  try {
    const { reason } = req.body;
    const credit = await pool.query('SELECT * FROM buyer_credits WHERE id=$1', [req.params.id]);
    if (!credit.rows.length) return res.status(404).json({ error: 'Crédito no encontrado' });
    await pool.query("UPDATE buyer_credits SET status='RECHAZADO',rejected_reason=$1 WHERE id=$2", [reason, req.params.id]);
    await notify(credit.rows[0].buyer_id, 'CREDITO_RECHAZADO', 'Crédito rechazado',
      `Tu solicitud fue rechazada. Motivo: ${reason}`, '/buyer/credits');
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/buyer/receipts', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM electronic_receipts WHERE buyer_id=$1 ORDER BY issued_at DESC', [req.user.id]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/locations', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM locations WHERE active=TRUE ORDER BY id');
    res.json(r.rows);
  } catch(e) { console.error('[locations]', e.message); res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/test-db', async (req, res) => {
  try {
    const r = await pool.query('SELECT COUNT(*) FROM locations');
    res.json({ ok: true, count: r.rows[0].count });
  } catch(e) { res.json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role: r } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Faltan datos' });
    const hash   = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users(name,email,password_hash,role,status) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [name, email, hash, r || 'COMPRADOR', 'ACTIVO']
    );
    const newUserId = result.rows[0].id;
    if (r === 'VENDEDOR') {
      await pool.query('INSERT INTO seller_profiles(user_id) VALUES($1) ON CONFLICT DO NOTHING', [newUserId]);
    }
    if ((r || 'COMPRADOR') === 'COMPRADOR') {
      const refCode = require('crypto').randomBytes(4).toString('hex').toUpperCase();
      await pool.query("INSERT INTO referrals(referrer_id,referral_code,status) VALUES($1,$2,'ACTIVO') ON CONFLICT DO NOTHING", [newUserId, refCode]).catch(() => {});
      await pool.query('INSERT INTO email_subscribers(user_id,email,name) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING', [newUserId, email, name]).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email ya registrado' });
    res.status(500).json({ error: 'Error al registrar' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM users WHERE email=$1', [req.body.email]);
    if (!r.rows.length) return res.status(401).json({ error: 'Credenciales incorrectas' });
    if (!await bcrypt.compare(req.body.password, r.rows[0].password_hash)) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const u     = r.rows[0];
    const token = jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, role: u.role, name: u.name, id: u.id });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/profile', auth, async (req, res) => {
  try {
    const u = await pool.query('SELECT id,name,email,role,phone,status,created_at FROM users WHERE id=$1', [req.user.id]);
    if (!u.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const orders = await pool.query(`
      SELECT o.id, o.status, o.total, o.created_at,
        COALESCE(json_agg(json_build_object('title',p.title,'price',i.price,'quantity',i.quantity)) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
      FROM orders o LEFT JOIN order_items i ON i.order_id=o.id LEFT JOIN products p ON p.id=i.product_id
      WHERE o.buyer_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`, [req.user.id]);
    let seller = null;
    if (req.user.role === 'VENDEDOR') {
      const sp = await pool.query('SELECT * FROM seller_profiles WHERE user_id=$1', [req.user.id]);
      seller = sp.rows[0];
    }
    res.json({ user: u.rows[0], orders: orders.rows, seller });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/profile', auth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    await pool.query('UPDATE users SET name=$1,phone=$2 WHERE id=$3', [name, phone, req.user.id]);
    if (req.user.role === 'VENDEDOR') {
      const { business_name, ruc, machine_type, machine_model, production_capacity, location_city, bank_name, bank_account, bank_cci, portfolio_desc } = req.body;
      await pool.query(`UPDATE seller_profiles SET business_name=$1,ruc=$2,machine_type=$3,machine_model=$4,production_capacity=$5,location_city=$6,bank_name=$7,bank_account=$8,bank_cci=$9,portfolio_desc=$10 WHERE user_id=$11`,
        [business_name, ruc, machine_type, machine_model, production_capacity, location_city, bank_name, bank_account, bank_cci, portfolio_desc, req.user.id]);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/categories', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/products', async (req, res) => {
  try {
    const { q = '', page = 1, categoryId, minPrice, maxPrice } = req.query;
    const limit = 20, offset = (page - 1) * limit;
    let where = ['p.active = TRUE'], params = [], i = 1;
    if (q)          { where.push(`(p.title ILIKE $${i} OR p.description ILIKE $${i})`); params.push(`%${q}%`); i++; }
    if (categoryId) { where.push(`p.category_id = $${i}`); params.push(categoryId); i++; }
    if (minPrice)   { where.push(`p.price >= $${i}`); params.push(minPrice); i++; }
    if (maxPrice)   { where.push(`p.price <= $${i}`); params.push(maxPrice); i++; }
    const sql = `SELECT p.*, u.name AS seller_name, c.name AS category_name,
      COALESCE(AVG(rv.rating),0)::numeric(3,2) AS rating_avg, COUNT(rv.id) AS review_count
      FROM products p JOIN users u ON u.id = p.seller_id LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN order_items oi ON oi.product_id = p.id LEFT JOIN reviews rv ON rv.seller_id = p.seller_id
      WHERE ${where.join(' AND ')} GROUP BY p.id, u.name, c.name ORDER BY p.created_at DESC LIMIT $${i} OFFSET $${i + 1}`;
    params.push(limit, offset);
    const r     = await pool.query(sql, params);
    const count = await pool.query(`SELECT COUNT(*) FROM products p WHERE ${where.join(' AND ')}`, params.slice(0, -2));
    res.json({ products: r.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.*, u.name AS seller_name, c.name AS category_name,
        sp.business_name, sp.location_city, sp.rating_avg AS seller_rating, sp.total_sales, sp.portfolio_desc, sp.verified
      FROM products p JOIN users u ON u.id = p.seller_id LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN seller_profiles sp ON sp.user_id = p.seller_id WHERE p.id = $1 AND p.active = TRUE`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    const reviews = await pool.query(`SELECT rv.*, u.name AS buyer_name FROM reviews rv JOIN users u ON u.id = rv.buyer_id WHERE rv.seller_id = $1 ORDER BY rv.created_at DESC LIMIT 5`, [r.rows[0].seller_id]);
    res.json({ ...r.rows[0], reviews: reviews.rows });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/products', auth, role('VENDEDOR'), upload.single('image'), async (req, res) => {
  try {
    const { title, description, price, categoryId, minQuantity, productionTimeDays, requiresDesignFile, materialsAvailable, sizesAvailable } = req.body;
    const imageUrl = req.file?.path || null;
    await pool.query(
      'INSERT INTO products(seller_id,category_id,title,description,price,min_quantity,production_time_days,requires_design_file,materials_available,sizes_available,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [req.user.id, categoryId || null, title, description, price, minQuantity || 1, productionTimeDays || 3, requiresDesignFile === 'true', materialsAvailable || null, sizesAvailable || null, imageUrl]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/seller/products', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const r = await pool.query('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.seller_id=$1 ORDER BY p.created_at DESC', [req.user.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.delete('/api/products/:id', auth, role('VENDEDOR'), async (req, res) => {
  try {
    await pool.query('UPDATE products SET active=FALSE WHERE id=$1 AND seller_id=$2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/sellers/:id', async (req, res) => {
  try {
    const u = await pool.query(`SELECT u.id, u.name, u.created_at, sp.business_name, sp.machine_type, sp.location_city, sp.rating_avg, sp.total_sales, sp.portfolio_desc, sp.verified, sp.production_capacity, sp.futura_client_since FROM users u JOIN seller_profiles sp ON sp.user_id=u.id WHERE u.id=$1 AND u.role='VENDEDOR'`, [req.params.id]);
    if (!u.rows.length) return res.status(404).json({ error: 'Vendedor no encontrado' });
    const products = await pool.query('SELECT * FROM products WHERE seller_id=$1 AND active=TRUE ORDER BY created_at DESC', [req.params.id]);
    const reviews  = await pool.query(`SELECT rv.*, u.name AS buyer_name, p.title AS product_title FROM reviews rv JOIN users u ON u.id=rv.buyer_id LEFT JOIN order_items oi ON oi.order_id=rv.order_id AND oi.seller_id=rv.seller_id LEFT JOIN products p ON p.id=oi.product_id WHERE rv.seller_id=$1 ORDER BY rv.created_at DESC LIMIT 10`, [req.params.id]);
    res.json({ seller: u.rows[0], products: products.rows, reviews: reviews.rows });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/quotations', auth, role('COMPRADOR'), upload.array('designFiles', 5), async (req, res) => {
  try {
    const { sellerId, productId, quantity, specifications, material, size, urgency } = req.body;
    const expires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const q = await pool.query('INSERT INTO quotations(buyer_id,seller_id,product_id,quantity,specifications,material,size,urgency,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id', [req.user.id, sellerId, productId || null, quantity, specifications, material || null, size || null, urgency || 'NORMAL', expires]);
    const qId = q.rows[0].id;
    if (req.files?.length) {
      for (const f of req.files) {
    await pool.query('INSERT INTO design_files(quotation_id,uploaded_by,file_name,file_url,file_type,file_size) VALUES($1,$2,$3,$4,$5,$6)', [qId, req.user.id, f.originalname, f.path, f.mimetype, f.size]);
      }
    }
    const buyer = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
    await notify(sellerId, 'NUEVA_COTIZACION', 'Nueva solicitud de cotización', `${buyer.rows[0].name} solicita cotización`, '/seller/quotations');
    res.json({ ok: true, quotationId: qId });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/my-quotations', auth, role('COMPRADOR'), async (req, res) => {
  try {
    const r = await pool.query(`SELECT q.*, p.title AS product_title, p.image_url, u.name AS seller_name, COALESCE(json_agg(df.*) FILTER (WHERE df.id IS NOT NULL), '[]') AS design_files FROM quotations q LEFT JOIN products p ON p.id=q.product_id JOIN users u ON u.id=q.seller_id LEFT JOIN design_files df ON df.quotation_id=q.id WHERE q.buyer_id=$1 GROUP BY q.id,p.title,p.image_url,u.name ORDER BY q.created_at DESC`, [req.user.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/seller/quotations', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const r = await pool.query(`SELECT q.*, p.title AS product_title, p.image_url, u.name AS buyer_name, u.email AS buyer_email, u.phone AS buyer_phone, COALESCE(json_agg(df.*) FILTER (WHERE df.id IS NOT NULL), '[]') AS design_files FROM quotations q LEFT JOIN products p ON p.id=q.product_id JOIN users u ON u.id=q.buyer_id LEFT JOIN design_files df ON df.quotation_id=q.id WHERE q.seller_id=$1 GROUP BY q.id,p.title,p.image_url,u.name,u.email,u.phone ORDER BY q.created_at DESC`, [req.user.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/seller/quotations/:id', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const { quotedPrice, productionDays, notes, status, rejectedReason } = req.body;
    const q = await pool.query('SELECT * FROM quotations WHERE id=$1 AND seller_id=$2', [req.params.id, req.user.id]);
    if (!q.rows.length) return res.status(404).json({ error: 'Cotización no encontrada' });
    const newStatus = status || 'ENVIADA';
    await pool.query('UPDATE quotations SET quoted_price=$1,production_days=$2,notes=$3,status=$4,rejected_reason=$5,updated_at=now() WHERE id=$6', [quotedPrice, productionDays, notes, newStatus, rejectedReason || null, req.params.id]);
    await notify(q.rows[0].buyer_id, newStatus === 'ENVIADA' ? 'COTIZACION_ENVIADA' : 'COTIZACION_RECHAZADA', newStatus === 'ENVIADA' ? 'Cotización recibida' : 'Cotización rechazada', newStatus === 'ENVIADA' ? `El vendedor respondió por S/ ${quotedPrice}` : 'El vendedor rechazó tu cotización', '/my-quotations');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/quotations/:id/accept', auth, role('COMPRADOR'), async (req, res) => {
  try {
    const q = await pool.query('SELECT * FROM quotations WHERE id=$1 AND buyer_id=$2 AND status=$3', [req.params.id, req.user.id, 'ENVIADA']);
    if (!q.rows.length) return res.status(404).json({ error: 'Cotización no disponible' });
    const quot = q.rows[0];
    let commissionRate = 10;
    if (quot.product_id) {
      const catR = await pool.query('SELECT c.commission_rate FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=$1', [quot.product_id]);
      if (catR.rows.length) commissionRate = parseFloat(catR.rows[0].commission_rate);
    }
    const commission = quot.quoted_price * (commissionRate / 100);
    const net = quot.quoted_price - commission;
    const ord = await pool.query('INSERT INTO orders(buyer_id,quotation_id,total,status) VALUES($1,$2,$3,$4) RETURNING id', [req.user.id, quot.id, quot.quoted_price, 'CREADA']);
    const ordId = ord.rows[0].id;
    await pool.query('INSERT INTO order_items(order_id,product_id,seller_id,quantity,price,commission,net,specifications,material,size) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [ordId, quot.product_id || 1, quot.seller_id, quot.quantity, quot.quoted_price, commission, net, quot.specifications, quot.material, quot.size]);
    await pool.query('UPDATE quotations SET status=$1,updated_at=now() WHERE id=$2', ['ACEPTADA', quot.id]);
    await notify(quot.seller_id, 'COTIZACION_ACEPTADA', '¡Cotización aceptada!', `El comprador aceptó. Orden #${ordId} creada.`, '/seller/orders');
    res.json({ ok: true, orderId: ordId });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/cart', auth, async (req, res) => {
  try {
    const r = await pool.query(`SELECT ci.*, p.title, p.price, p.image_url, u.name AS seller_name FROM cart_items ci JOIN products p ON p.id=ci.product_id JOIN users u ON u.id=p.seller_id WHERE ci.user_id=$1`, [req.user.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/cart', auth, async (req, res) => {
  try {
    await pool.query('INSERT INTO cart_items(user_id,product_id,quantity) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [req.user.id, req.body.productId, req.body.quantity || 1]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.delete('/api/cart/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/checkout', auth, async (req, res) => {
  try {
    const items = await pool.query(`SELECT ci.*, p.price, p.seller_id, p.category_id FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.user_id=$1`, [req.user.id]);
    if (!items.rows.length) return res.status(400).json({ error: 'Carrito vacío' });
    const total = items.rows.reduce((a, i) => a + parseFloat(i.price) * i.quantity, 0);
    const ord   = await pool.query('INSERT INTO orders(buyer_id,total,status) VALUES($1,$2,$3) RETURNING id', [req.user.id, total, 'CREADA']);
    const ordId = ord.rows[0].id;
    for (const item of items.rows) {
      let commissionRate = 10;
      if (item.category_id) {
        const catR = await pool.query('SELECT commission_rate FROM categories WHERE id=$1', [item.category_id]);
        if (catR.rows.length) commissionRate = parseFloat(catR.rows[0].commission_rate);
      }
      const price = parseFloat(item.price) * item.quantity;
      await pool.query('INSERT INTO order_items(order_id,product_id,seller_id,quantity,price,commission,net) VALUES($1,$2,$3,$4,$5,$6,$7)', [ordId, item.product_id, item.seller_id, item.quantity, price, price * (commissionRate / 100), price * (1 - commissionRate / 100)]);
    }
    await pool.query('DELETE FROM cart_items WHERE user_id=$1', [req.user.id]);
    res.json({ orderId: ordId });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/payments/create', auth, async (req, res) => {
  try {
    const o = await pool.query('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2', [req.body.orderId, req.user.id]);
    if (!o.rows.length) return res.status(404).json({ error: 'Orden no encontrada' });
    const order = o.rows[0];
    await pool.query('INSERT INTO payments(order_id,provider,provider_payment_id,status,amount,held_until) VALUES($1,$2,$3,$4,$5,$6)', [order.id, 'MP', 'SANDBOX-' + Date.now(), 'APPROVED', order.total, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]);
    await pool.query("UPDATE orders SET status='PAGADA' WHERE id=$1", [order.id]);
    publishEvent('order.paid', { orderId: order.id, buyerId: order.buyer_id, total: order.total });
    try {
      const receiptCheck = await pool.query('SELECT id FROM electronic_receipts WHERE order_id=$1', [order.id]);
      if (!receiptCheck.rows[0]) {
        const corr = await pool.query("SELECT nextval('receipt_correlative_seq') AS n");
        const receiptNumber = `B001-${String(corr.rows[0].n).padStart(8, '0')}`;
        const buyer = await pool.query('SELECT o.*, u.name AS buyer_name FROM orders o JOIN users u ON u.id=o.buyer_id WHERE o.id=$1', [order.id]);
        if (buyer.rows[0]) {
          const bd = buyer.rows[0];
          const subtotal = parseFloat(bd.total) / 1.18;
          const igv = parseFloat(bd.total) - subtotal;
          await pool.query(`INSERT INTO electronic_receipts(order_id,receipt_number,correlative,buyer_id,buyer_name,subtotal,igv,total,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'EMITIDA')`, [order.id, receiptNumber, corr.rows[0].n, bd.buyer_id, bd.buyer_name, subtotal.toFixed(2), igv.toFixed(2), bd.total]);
          await notify(bd.buyer_id, 'BOLETA_EMITIDA', '🧾 Boleta emitida', `Boleta ${receiptNumber} por S/ ${bd.total}`, '/buyer/receipts').catch(() => {});
        }
      }
    } catch (e) { console.error('[boleta]', e.message); }
    const sellers = await pool.query('SELECT DISTINCT seller_id FROM order_items WHERE order_id=$1', [order.id]);
    for (const s of sellers.rows) {
      await notify(s.seller_id, 'NUEVA_ORDEN', '¡Nuevo pedido pagado!', `Orden #${order.id} por S/ ${order.total}`, '/seller/orders');
    }
    res.json({ url: process.env.FRONTEND_URL + '/checkout/success' });
  } catch (err) { res.status(500).json({ error: 'Error al procesar pago' }); }
});

app.get('/api/my-orders', auth, async (req, res) => {
  try {
    const r = await pool.query(`SELECT o.*, json_agg(json_build_object('id',i.id,'title',p.title,'price',i.price,'quantity',i.quantity,'image_url',p.image_url,'seller_name',u.name,'seller_id',i.seller_id)) AS items FROM orders o JOIN order_items i ON i.order_id=o.id JOIN products p ON p.id=i.product_id JOIN users u ON u.id=i.seller_id WHERE o.buyer_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`, [req.user.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/orders/:id/confirm', auth, role('COMPRADOR'), async (req, res) => {
  try {
    const o = await pool.query('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2', [req.params.id, req.user.id]);
    if (!o.rows.length) return res.status(404).json({ error: 'Orden no encontrada' });
    await pool.query("UPDATE orders SET status='ENTREGADA',confirmed_at=now() WHERE id=$1", [req.params.id]);
    await pool.query("UPDATE payments SET status='RELEASED',released_at=now() WHERE order_id=$1", [req.params.id]);
    const sellers = await pool.query('SELECT DISTINCT seller_id FROM order_items WHERE order_id=$1', [req.params.id]);
    for (const s of sellers.rows) {
      await pool.query('UPDATE seller_profiles SET total_sales=total_sales+1 WHERE user_id=$1', [s.seller_id]);
      await notify(s.seller_id, 'PAGO_LIBERADO', 'Pago liberado ✓', `Fondos liberados - Orden #${req.params.id}`, '/seller/orders');
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/seller/orders', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const r = await pool.query(`SELECT o.id, o.status, o.total, o.created_at, o.delivery_method, o.tracking_code, i.price, i.commission, i.net, i.quantity, i.specifications, p.title AS product_title, p.image_url, u.name AS buyer_name, u.email AS buyer_email, u.phone AS buyer_phone, COALESCE(json_agg(pl.*) FILTER (WHERE pl.id IS NOT NULL), '[]') AS production_logs FROM orders o JOIN order_items i ON i.order_id=o.id AND i.seller_id=$1 JOIN products p ON p.id=i.product_id JOIN users u ON u.id=o.buyer_id LEFT JOIN production_logs pl ON pl.order_id=o.id AND pl.seller_id=$1 GROUP BY o.id,o.status,o.total,o.created_at,o.delivery_method,o.tracking_code,i.price,i.commission,i.net,i.quantity,i.specifications,p.title,p.image_url,u.name,u.email,u.phone ORDER BY o.created_at DESC`, [req.user.id]);
    const totals = await pool.query(`SELECT SUM(i.commission) AS total_commission, SUM(i.net) AS total_net FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.seller_id=$1 AND o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')`, [req.user.id]);
    res.json({ orders: r.rows, totals: totals.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/seller/orders/:id/production', auth, role('VENDEDOR'), upload.single('photo'), async (req, res) => {
  try {
    const { status, description } = req.body;
    const photoUrl = req.file?.path || null;
    await pool.query('INSERT INTO production_logs(order_id,seller_id,status,description,photo_url) VALUES($1,$2,$3,$4,$5)', [req.params.id, req.user.id, status, description, photoUrl]);
    const orderStatus = status === 'LISTO' ? 'LISTO' : status === 'EN_PRODUCCION' ? 'EN_PRODUCCION' : null;
    if (orderStatus) await pool.query('UPDATE orders SET status=$1 WHERE id=$2', [orderStatus, req.params.id]);
    const ord = await pool.query('SELECT buyer_id FROM orders WHERE id=$1', [req.params.id]);
    if (ord.rows.length) await notify(ord.rows[0].buyer_id, 'PRODUCCION_UPDATE', 'Actualización de producción', `${description || status} — Orden #${req.params.id}`, '/my-orders');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/orders/:id/shipped', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const { trackingCode } = req.body;
    await pool.query("UPDATE orders SET status='ENVIADA',tracking_code=$1 WHERE id=$2", [trackingCode || null, req.params.id]);
    publishEvent('order.shipped', { orderId: parseInt(req.params.id), trackingCode });
    const ord = await pool.query('SELECT buyer_id FROM orders WHERE id=$1', [req.params.id]);
    if (ord.rows.length) await notify(ord.rows[0].buyer_id, 'ORDEN_ENVIADA', '¡Tu pedido fue enviado!', `Orden #${req.params.id} en camino${trackingCode ? '. Código: ' + trackingCode : ''}`, '/my-orders');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/orders/:id/cancel', auth, role('COMPRADOR'), async (req, res) => {
  try {
    const o = await pool.query('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2', [req.params.id, req.user.id]);
    if (!o.rows.length) return res.status(404).json({ error: 'Orden no encontrada' });
    if (!['CREADA', 'PENDIENTE_PAGO', 'PAGADA'].includes(o.rows[0].status)) return res.status(400).json({ error: 'No se puede cancelar' });
    await pool.query("UPDATE orders SET status='CANCELADA' WHERE id=$1", [req.params.id]);
    const sellers = await pool.query('SELECT DISTINCT seller_id FROM order_items WHERE order_id=$1', [req.params.id]);
    for (const s of sellers.rows) await notify(s.seller_id, 'ORDEN_CANCELADA', 'Orden cancelada', `El comprador canceló la orden #${req.params.id}`, '/seller/orders');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/reviews', auth, role('COMPRADOR'), async (req, res) => {
  try {
    const { orderId, rating, comment, qualityOk, onTime } = req.body;
    const ord = await pool.query('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2 AND status=$3', [orderId, req.user.id, 'ENTREGADA']);
    if (!ord.rows.length) return res.status(400).json({ error: 'Solo puedes calificar órdenes entregadas' });
    const sellers = await pool.query('SELECT DISTINCT seller_id FROM order_items WHERE order_id=$1', [orderId]);
    for (const s of sellers.rows) {
      await pool.query('INSERT INTO reviews(order_id,buyer_id,seller_id,rating,comment,quality_ok,on_time) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(order_id) DO NOTHING', [orderId, req.user.id, s.seller_id, rating, comment, qualityOk !== false, onTime !== false]);
      await pool.query(`UPDATE seller_profiles SET rating_avg=(SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE seller_id=$1) WHERE user_id=$1`, [s.seller_id]);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/notifications', auth, async (req, res) => {
  try {
    const r      = await pool.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.user.id]);
    const unread = await pool.query('SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read=FALSE', [req.user.id]);
    res.json({ notifications: r.rows, unread: parseInt(unread.rows[0].count) });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/notifications/read', auth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read=TRUE WHERE user_id=$1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/seller/profile', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const r = await pool.query(`SELECT u.id,u.name,u.email,u.phone,u.status, sp.* FROM users u LEFT JOIN seller_profiles sp ON sp.user_id=u.id WHERE u.id=$1`, [req.user.id]);
    res.json(r.rows[0] || {});
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/seller/profile', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const { name, phone, business_name, ruc, machine_type, machine_model, production_capacity, location_city, location_address, bank_name, bank_account, bank_cci, portfolio_desc } = req.body;
    await pool.query('UPDATE users SET name=$1,phone=$2 WHERE id=$3', [name, phone, req.user.id]);
    await pool.query(`INSERT INTO seller_profiles(user_id,business_name,ruc,machine_type,machine_model,production_capacity,location_city,location_address,bank_name,bank_account,bank_cci,portfolio_desc) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(user_id) DO UPDATE SET business_name=$2,ruc=$3,machine_type=$4,machine_model=$5,production_capacity=$6,location_city=$7,location_address=$8,bank_name=$9,bank_account=$10,bank_cci=$11,portfolio_desc=$12`,
      [req.user.id, business_name, ruc, machine_type, machine_model, production_capacity || 0, location_city, location_address, bank_name, bank_account, bank_cci, portfolio_desc]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/seller/dashboard', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const [stats, topProducts, monthly, pending, profile] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT o.id) AS total_ordenes, COUNT(DISTINCT CASE WHEN o.status='EN_PRODUCCION' THEN o.id END) AS en_produccion, COUNT(DISTINCT CASE WHEN o.status='ENTREGADA' THEN o.id END) AS entregadas, COALESCE(SUM(CASE WHEN o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA') THEN i.net END),0) AS neto_total, COALESCE(SUM(CASE WHEN DATE_TRUNC('month',o.created_at)=DATE_TRUNC('month',NOW()) AND o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA') THEN i.net END),0) AS neto_mes FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.seller_id=$1`, [req.user.id]),
      pool.query(`SELECT p.title,p.image_url,COUNT(*) AS veces,SUM(i.price) AS revenue FROM order_items i JOIN products p ON p.id=i.product_id JOIN orders o ON o.id=i.order_id WHERE i.seller_id=$1 AND o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA') GROUP BY p.id,p.title,p.image_url ORDER BY veces DESC LIMIT 5`, [req.user.id]),
      pool.query(`SELECT TO_CHAR(o.created_at,'Mon YYYY') AS mes,SUM(i.net) AS neto,COUNT(DISTINCT o.id) AS ordenes FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.seller_id=$1 AND o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA') AND o.created_at>=NOW()-INTERVAL '6 months' GROUP BY DATE_TRUNC('month',o.created_at),TO_CHAR(o.created_at,'Mon YYYY') ORDER BY DATE_TRUNC('month',o.created_at)`, [req.user.id]),
      pool.query("SELECT COUNT(*) FROM quotations WHERE seller_id=$1 AND status='PENDIENTE'", [req.user.id]),
      pool.query('SELECT rating_avg,total_sales,verified FROM seller_profiles WHERE user_id=$1', [req.user.id]),
    ]);
    res.json({ stats: { ...stats.rows[0], cotizaciones_pendientes: parseInt(pending.rows[0].count) }, topProducts: topProducts.rows, monthly: monthly.rows, profile: profile.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/seller/payout', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const { amount } = req.body;
    const sp = await pool.query('SELECT bank_account,bank_name,bank_cci FROM seller_profiles WHERE user_id=$1', [req.user.id]);
    if (!sp.rows.length || !sp.rows[0].bank_account) return res.status(400).json({ error: 'Configura tu cuenta bancaria primero' });
    const admins = await pool.query("SELECT id FROM users WHERE role='ADMIN'");
    const u = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
    for (const a of admins.rows) await notify(a.id, 'SOLICITUD_RETIRO', 'Solicitud de retiro', `${u.rows[0].name} solicita retiro de S/ ${amount}`, '/admin/payouts');
    res.json({ ok: true, message: `Solicitud de S/ ${amount} enviada. Se procesará en 2-3 días hábiles.` });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/dashboard', auth, role('ADMIN'), async (req, res) => {
  try {
    const gmv = await pool.query(`SELECT COALESCE(SUM(i.price),0) AS gmv_total, COALESCE(SUM(CASE WHEN DATE_TRUNC('month',o.created_at)=DATE_TRUNC('month',NOW()) THEN i.price END),0) AS gmv_mes, COALESCE(SUM(CASE WHEN DATE_TRUNC('month',o.created_at)=DATE_TRUNC('month',NOW()-INTERVAL '1 month') THEN i.price END),0) AS gmv_mes_anterior, COALESCE(SUM(i.commission),0) AS comision_total, COUNT(DISTINCT o.id) AS total_ordenes, COUNT(DISTINCT o.buyer_id) AS compradores_activos, COALESCE(AVG(i.price),0) AS ticket_promedio FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')`);
    const vendedoresActivos = await pool.query(`SELECT COUNT(DISTINCT i.seller_id) AS count FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.created_at>=NOW()-INTERVAL '30 days' AND o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')`);
    const convRate  = await pool.query(`SELECT COUNT(*) AS total_quot, COUNT(CASE WHEN status='ACEPTADA' THEN 1 END) AS aceptadas FROM quotations`);
    const topSellers = await pool.query(`SELECT u.name,SUM(i.price) AS revenue,SUM(i.net) AS neto,COUNT(DISTINCT o.id) AS ventas,sp.rating_avg FROM order_items i JOIN orders o ON o.id=i.order_id JOIN users u ON u.id=i.seller_id LEFT JOIN seller_profiles sp ON sp.user_id=i.seller_id WHERE o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA') GROUP BY u.id,u.name,sp.rating_avg ORDER BY revenue DESC LIMIT 10`);
    const catStats  = await pool.query(`SELECT c.name,SUM(i.price) AS revenue,COUNT(*) AS ventas FROM order_items i JOIN products p ON p.id=i.product_id JOIN categories c ON c.id=p.category_id JOIN orders o ON o.id=i.order_id WHERE o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA') GROUP BY c.id,c.name ORDER BY revenue DESC`);
    const cr = convRate.rows[0];
    res.json({ gmv: gmv.rows[0], vendedores_activos: parseInt(vendedoresActivos.rows[0].count), conversion_rate: cr.total_quot > 0 ? ((cr.aceptadas / cr.total_quot) * 100).toFixed(1) : 0, top_sellers: topSellers.rows, category_stats: catStats.rows });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/commissions', auth, role('ADMIN'), async (req, res) => {
  try {
    const items  = await pool.query(`SELECT i.*, o.status AS order_status, p.title AS product_title, u.name AS seller_name FROM order_items i JOIN orders o ON o.id=i.order_id JOIN products p ON p.id=i.product_id JOIN users u ON u.id=i.seller_id ORDER BY o.created_at DESC`);
    const totals = await pool.query(`SELECT SUM(i.commission) AS total_commission, SUM(i.net) AS total_net FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA')`);
    res.json({ items: items.rows, totals: totals.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/users', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(`SELECT u.*, sp.business_name, sp.machine_type, sp.verified, sp.rating_avg, sp.total_sales FROM users u LEFT JOIN seller_profiles sp ON sp.user_id=u.id ORDER BY u.created_at DESC`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.delete('/api/admin/users/:id', auth, role('ADMIN'), async (req, res) => {
  try {
    const u = await pool.query('SELECT id,role FROM users WHERE id=$1', [req.params.id]);
    if (!u.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (u.rows[0].role === 'ADMIN') return res.status(400).json({ error: 'No se puede eliminar un Admin' });
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte' });
    await pool.query('DELETE FROM cart_items WHERE user_id=$1', [req.params.id]);
    await pool.query('UPDATE products SET active=FALSE WHERE seller_id=$1', [req.params.id]);
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/sellers/pending', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(`SELECT u.id,u.name,u.email,u.phone,u.created_at,sp.business_name,sp.ruc,sp.machine_type,sp.machine_model,sp.production_capacity,sp.location_city,sp.portfolio_desc,sp.verified FROM users u JOIN seller_profiles sp ON sp.user_id=u.id WHERE u.role='VENDEDOR' AND sp.verified=FALSE ORDER BY u.created_at DESC`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/sellers/:id/approve', auth, role('ADMIN'), async (req, res) => {
  try {
    await pool.query('UPDATE seller_profiles SET verified=TRUE,approved_at=now(),approved_by=$1 WHERE user_id=$2', [req.user.id, req.params.id]);
    await pool.query("UPDATE users SET status='ACTIVO' WHERE id=$1", [req.params.id]);
    await notify(parseInt(req.params.id), 'CUENTA_APROBADA', '¡Tu cuenta fue aprobada!', 'Ya puedes publicar productos en Futura Marketplace.', '/seller/orders');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/sellers/:id/reject', auth, role('ADMIN'), async (req, res) => {
  try {
    await pool.query("UPDATE users SET status='SUSPENDIDO' WHERE id=$1", [req.params.id]);
    await notify(parseInt(req.params.id), 'CUENTA_RECHAZADA', 'Solicitud rechazada', `Motivo: ${req.body.reason}`, '/');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/sellers/:id/suspend', auth, role('ADMIN'), async (req, res) => {
  try {
    await pool.query("UPDATE users SET status='SUSPENDIDO' WHERE id=$1", [req.params.id]);
    await pool.query('UPDATE products SET active=FALSE WHERE seller_id=$1', [req.params.id]);
    await notify(parseInt(req.params.id), 'CUENTA_SUSPENDIDA', 'Cuenta suspendida', `Motivo: ${req.body.reason}`, '/');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/products', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(`SELECT p.*, u.name AS seller_name, c.name AS category_name FROM products p JOIN users u ON u.id=p.seller_id LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.created_at DESC`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/products/:id/moderate', auth, role('ADMIN'), async (req, res) => {
  try {
    const { action, reason } = req.body;
    const active = action === 'approve';
    await pool.query('UPDATE products SET active=$1 WHERE id=$2', [active, req.params.id]);
    const p = await pool.query('SELECT seller_id,title FROM products WHERE id=$1', [req.params.id]);
    if (p.rows.length) await notify(p.rows[0].seller_id, 'PRODUCTO_MODERADO', active ? 'Producto aprobado' : 'Producto rechazado', active ? `Tu producto "${p.rows[0].title}" fue aprobado.` : `Rechazado. Motivo: ${reason}`, '/seller/orders');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/disputes', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(`SELECT d.*, o.total, o.status AS order_status, u1.name AS raised_by_name, u2.name AS against_name FROM disputes d JOIN orders o ON o.id=d.order_id JOIN users u1 ON u1.id=d.raised_by JOIN users u2 ON u2.id=d.against ORDER BY d.created_at DESC`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/disputes/:id/resolve', auth, role('ADMIN'), async (req, res) => {
  try {
    const { resolution, status } = req.body;
    const d = await pool.query('SELECT * FROM disputes WHERE id=$1', [req.params.id]);
    if (!d.rows.length) return res.status(404).json({ error: 'Disputa no encontrada' });
    await pool.query('UPDATE disputes SET resolution=$1,status=$2,resolved_by=$3,resolved_at=now() WHERE id=$4', [resolution, status || 'RESUELTA', req.user.id, req.params.id]);
    await notify(d.rows[0].raised_by, 'DISPUTA_RESUELTA', 'Disputa resuelta', resolution.substring(0, 100), '/my-orders');
    await notify(d.rows[0].against, 'DISPUTA_RESUELTA', 'Disputa resuelta', resolution.substring(0, 100), '/seller/orders');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/stats/monthly', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(`SELECT TO_CHAR(o.created_at,'YYYY-MM') AS mes, TO_CHAR(o.created_at,'Mon YYYY') AS mes_label, SUM(i.price) AS total_ventas, SUM(i.commission) AS total_comision, SUM(i.net) AS total_neto, COUNT(DISTINCT o.id) AS num_ordenes FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.status IN ('PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA') AND o.created_at >= NOW()-INTERVAL '6 months' GROUP BY TO_CHAR(o.created_at,'YYYY-MM'),TO_CHAR(o.created_at,'Mon YYYY') ORDER BY mes ASC`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/admin/categories', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query('INSERT INTO categories(name,commission_rate) VALUES($1,$2) RETURNING *', [req.body.name, req.body.commission_rate || 10]);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/categories/:id/commission', auth, role('ADMIN'), async (req, res) => {
  try {
    await pool.query('UPDATE categories SET commission_rate=$1 WHERE id=$2', [req.body.commission_rate, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/admin/newsletter', auth, role('ADMIN'), async (req, res) => {
  try {
    const { title, message, link } = req.body;
    const compradores = await pool.query("SELECT id FROM users WHERE role='COMPRADOR' AND status='ACTIVO'");
    for (const u of compradores.rows) await notify(u.id, 'NEWSLETTER', title, message, link || '/');
    res.json({ ok: true, sent: compradores.rows.length });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/payouts', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(`SELECT n.*, u.name, u.email, sp.bank_name, sp.bank_account, sp.bank_cci FROM notifications n JOIN users u ON u.id=n.user_id LEFT JOIN seller_profiles sp ON sp.user_id=n.user_id WHERE n.type='SOLICITUD_RETIRO' ORDER BY n.created_at DESC`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/disputes', auth, upload.array('evidence', 5), async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const ord = await pool.query('SELECT * FROM orders WHERE id=$1', [orderId]);
    if (!ord.rows.length) return res.status(404).json({ error: 'Orden no encontrada' });
    const order   = ord.rows[0];
    const against = req.user.id === order.buyer_id ? (await pool.query('SELECT DISTINCT seller_id FROM order_items WHERE order_id=$1', [orderId])).rows[0]?.seller_id : order.buyer_id;
    const evidenceUrls = req.files?.map(f => f.path).join(',') || null;
    const d = await pool.query('INSERT INTO disputes(order_id,raised_by,against,reason,evidence_urls) VALUES($1,$2,$3,$4,$5) RETURNING id', [orderId, req.user.id, against, reason, evidenceUrls]);
    publishEvent('dispute.opened', { disputeId: d.rows[0].id, orderId: parseInt(orderId) });
    await notify(against, 'DISPUTA_ABIERTA', 'Se abrió una disputa', `Orden #${orderId}: ${reason.substring(0, 80)}`, '/my-orders');
    const admins = await pool.query("SELECT id FROM users WHERE role='ADMIN'");
    for (const a of admins.rows) await notify(a.id, 'DISPUTA_ADMIN', 'Nueva disputa', `Orden #${orderId} - Caso #${d.rows[0].id}`, '/admin/disputes');
    res.json({ ok: true, disputeId: d.rows[0].id });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/webhook/mp', async (req, res) => { res.sendStatus(200); });

// ── Futura Marketplace v3.0 — 23 módulos nuevos ──────────────
const { registerFuturaModules } = require('./src/modules/app');
registerFuturaModules(app);
// ─────────────────────────────────────────────────────────────

app.listen(3001, () => console.log('✅ Backend Futura v5.0 activo en puerto 3001'));
