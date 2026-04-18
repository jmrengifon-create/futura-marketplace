// services/user/index.js — User Service (Port 3001)
require('dotenv').config();
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { Pool } = require('pg');
const cors    = require('cors');
const { auth, role, anyRole, rateLimit, auditLog, requestLogger, redis } = require('../../shared/middleware');
const { publish, EVENTS } = require('../../shared/events');

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(cors());
app.use(requestLogger('USER-SVC'));

// ─── Health ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'user', ts: new Date() }));

// ─── Auth ─────────────────────────────────────────────────
app.post('/api/auth/register', rateLimit(10, 60), async (req, res) => {
  try {
    const { name, email, password, role: r = 'COMPRADOR', phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const hash   = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users(name,email,password_hash,role,phone,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,email,role',
      [name, email, hash, r, phone || null, 'ACTIVO']
    );
    const user = result.rows[0];

    if (r === 'VENDEDOR') {
      await pool.query('INSERT INTO seller_profiles(user_id) VALUES($1) ON CONFLICT DO NOTHING', [user.id]);
    }

    await publish(EVENTS.SELLER_APPROVED, { userId: user.id, role: r, name });
    res.status(201).json({ ok: true, user: { id: user.id, name, email, role: r } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email ya registrado' });
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/api/auth/login', rateLimit(20, 60), async (req, res) => {
  try {
    const { email, password } = req.body;
    const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!r.rows.length) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const u = r.rows[0];
    if (u.status === 'SUSPENDIDO') return res.status(403).json({ error: 'Cuenta suspendida. Contacta a soporte.' });
    if (!await bcrypt.compare(password, u.password_hash)) return res.status(401).json({ error: 'Credenciales incorrectas' });

    // Cache session in Redis (TTL 8h)
    const token = jwt.sign({ id: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET, { expiresIn: '8h' });
    await redis.setex(`session:${u.id}`, 28800, JSON.stringify({ id: u.id, role: u.role }));

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs(user_id,action,resource,ip,status_code,payload_size) VALUES($1,$2,$3,$4,$5,$6)',
      [u.id, 'POST /api/auth/login', '/api/auth/login', req.ip, 200, 0]
    ).catch(() => {});

    res.json({ token, role: u.role, name: u.name, id: u.id });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/auth/logout', auth, async (req, res) => {
  await redis.del(`session:${req.user.id}`);
  res.json({ ok: true });
});

// ─── Profiles ─────────────────────────────────────────────
app.get('/api/users/:id', async (req, res) => {
  try {
    const u = await pool.query(
      'SELECT id,name,email,role,phone,status,created_at FROM users WHERE id=$1',
      [req.params.id]
    );
    if (!u.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(u.rows[0]);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/users/:id', auth, async (req, res) => {
  if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'ADMIN') return res.sendStatus(403);
  try {
    const { name, phone } = req.body;
    await pool.query('UPDATE users SET name=$1,phone=$2 WHERE id=$3', [name, phone, req.params.id]);

    // GDPR: invalidar cache
    await redis.del(`user:${req.params.id}`);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// GDPR — Right to be forgotten
app.delete('/api/users/:id/data', auth, async (req, res) => {
  if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'ADMIN') return res.sendStatus(403);
  try {
    const anonName  = `Usuario_${Date.now()}`;
    const anonEmail = `deleted_${Date.now()}@futura.deleted`;
    await pool.query(
      'UPDATE users SET name=$1,email=$2,phone=NULL,password_hash=$3 WHERE id=$4',
      [anonName, anonEmail, 'DELETED', req.params.id]
    );
    await redis.del(`session:${req.params.id}`);
    await pool.query(
      'INSERT INTO audit_logs(user_id,action,resource,ip,status_code,payload_size) VALUES($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'GDPR_DELETE', `/api/users/${req.params.id}/data`, req.ip, 200, 0]
    ).catch(() => {});
    res.json({ ok: true, message: 'Datos anonimizados según GDPR' });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Seller profiles ──────────────────────────────────────
app.get('/api/seller/profile', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const cacheKey = `seller:profile:${req.user.id}`;
    const cached   = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const r = await pool.query(`
      SELECT u.id,u.name,u.email,u.phone,u.status,sp.*
      FROM users u LEFT JOIN seller_profiles sp ON sp.user_id=u.id
      WHERE u.id=$1`, [req.user.id]);

    const profile = r.rows[0] || {};
    await redis.setex(cacheKey, 300, JSON.stringify(profile)); // Cache 5 min
    res.json(profile);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/seller/profile', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const { name, phone, business_name, ruc, machine_type, machine_model,
      production_capacity, location_city, location_address,
      bank_name, bank_account, bank_cci, portfolio_desc } = req.body;

    await pool.query('UPDATE users SET name=$1,phone=$2 WHERE id=$3', [name, phone, req.user.id]);
    await pool.query(`
      INSERT INTO seller_profiles(user_id,business_name,ruc,machine_type,machine_model,
        production_capacity,location_city,location_address,bank_name,bank_account,bank_cci,portfolio_desc)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT(user_id) DO UPDATE SET
        business_name=$2,ruc=$3,machine_type=$4,machine_model=$5,
        production_capacity=$6,location_city=$7,location_address=$8,
        bank_name=$9,bank_account=$10,bank_cci=$11,portfolio_desc=$12`,
      [req.user.id,business_name,ruc,machine_type,machine_model,
       production_capacity||0,location_city,location_address,
       bank_name,bank_account,bank_cci,portfolio_desc]);

    await redis.del(`seller:profile:${req.user.id}`);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/sellers/:id', async (req, res) => {
  try {
    const cacheKey = `seller:public:${req.params.id}`;
    const cached   = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const u = await pool.query(`
      SELECT u.id, u.name, u.created_at,
        sp.business_name, sp.machine_type, sp.location_city, sp.rating_avg,
        sp.total_sales, sp.portfolio_desc, sp.verified, sp.production_capacity, sp.futura_client_since
      FROM users u JOIN seller_profiles sp ON sp.user_id=u.id
      WHERE u.id=$1 AND u.role='VENDEDOR'`, [req.params.id]);

    if (!u.rows.length) return res.status(404).json({ error: 'Vendedor no encontrado' });

    const products = await pool.query('SELECT * FROM products WHERE seller_id=$1 AND active=TRUE ORDER BY created_at DESC', [req.params.id]);
    const reviews  = await pool.query(`
      SELECT rv.*, u.name AS buyer_name FROM reviews rv
      JOIN users u ON u.id=rv.buyer_id WHERE rv.seller_id=$1 ORDER BY rv.created_at DESC LIMIT 10`, [req.params.id]);

    const data = { seller: u.rows[0], products: products.rows, reviews: reviews.rows };
    await redis.setex(cacheKey, 120, JSON.stringify(data));
    res.json(data);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Notifications ────────────────────────────────────────
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30',
      [req.user.id]
    );
    const unread = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read=FALSE', [req.user.id]
    );
    res.json({ notifications: r.rows, unread: parseInt(unread.rows[0].count) });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/notifications/read', auth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read=TRUE WHERE user_id=$1', [req.user.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Admin user management ────────────────────────────────
app.get('/api/admin/users', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT u.*, sp.business_name, sp.machine_type, sp.verified, sp.rating_avg, sp.total_sales
      FROM users u LEFT JOIN seller_profiles sp ON sp.user_id=u.id
      ORDER BY u.created_at DESC`);
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.delete('/api/admin/users/:id', auth, role('ADMIN'), async (req, res) => {
  try {
    const u = await pool.query('SELECT id,role FROM users WHERE id=$1', [req.params.id]);
    if (!u.rows.length) return res.status(404).json({ error: 'No encontrado' });
    if (u.rows[0].role === 'ADMIN') return res.status(400).json({ error: 'No se puede eliminar un Admin' });
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    await pool.query('DELETE FROM cart_items WHERE user_id=$1', [req.params.id]);
    await pool.query('UPDATE products SET active=FALSE WHERE seller_id=$1', [req.params.id]);
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    await redis.del(`session:${req.params.id}`, `seller:profile:${req.params.id}`);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/admin/sellers/pending', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT u.id,u.name,u.email,u.phone,u.created_at,
        sp.business_name,sp.ruc,sp.machine_type,sp.machine_model,
        sp.production_capacity,sp.location_city,sp.portfolio_desc,sp.verified
      FROM users u JOIN seller_profiles sp ON sp.user_id=u.id
      WHERE u.role='VENDEDOR' AND sp.verified=FALSE ORDER BY u.created_at DESC`);
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/sellers/:id/approve', auth, role('ADMIN'), async (req, res) => {
  try {
    await pool.query('UPDATE seller_profiles SET verified=TRUE,approved_at=now(),approved_by=$1 WHERE user_id=$2', [req.user.id, req.params.id]);
    await pool.query("UPDATE users SET status='ACTIVO' WHERE id=$1", [req.params.id]);
    await pool.query('INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)',
      [req.params.id,'CUENTA_APROBADA','¡Tu cuenta fue aprobada!','Ya puedes publicar productos.','/seller/orders']);
    await redis.del(`seller:profile:${req.params.id}`);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/sellers/:id/reject', auth, role('ADMIN'), async (req, res) => {
  try {
    const { reason } = req.body;
    await pool.query("UPDATE users SET status='SUSPENDIDO' WHERE id=$1", [req.params.id]);
    await pool.query('INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)',
      [req.params.id,'CUENTA_RECHAZADA','Solicitud rechazada',`Motivo: ${reason}`,'/']);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/sellers/:id/suspend', auth, role('ADMIN'), async (req, res) => {
  try {
    const { reason } = req.body;
    await pool.query("UPDATE users SET status='SUSPENDIDO' WHERE id=$1", [req.params.id]);
    await pool.query('UPDATE products SET active=FALSE WHERE seller_id=$1', [req.params.id]);
    await pool.query('INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)',
      [req.params.id,'CUENTA_SUSPENDIDA','Cuenta suspendida',`Motivo: ${reason}`,'/']);
    await redis.del(`session:${req.params.id}`, `seller:profile:${req.params.id}`);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// Newsletter
app.post('/api/admin/newsletter', auth, role('ADMIN'), async (req, res) => {
  try {
    const { title, message, link } = req.body;
    const compradores = await pool.query("SELECT id FROM users WHERE role='COMPRADOR' AND status='ACTIVO'");
    for (const u of compradores.rows) {
      await pool.query('INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)',
        [u.id,'NEWSLETTER',title,message,link||'/']);
    }
    res.json({ ok: true, sent: compradores.rows.length });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// Audit logs
app.get('/api/admin/audit', auth, role('ADMIN'), async (req, res) => {
  try {
    const { userId, action, from, to } = req.query;
    let where = [];
    const params = [];
    let i = 1;
    if (userId) { where.push(`al.user_id=$${i++}`); params.push(userId); }
    if (action)  { where.push(`al.action ILIKE $${i++}`); params.push(`%${action}%`); }
    if (from)    { where.push(`al.created_at >= $${i++}`); params.push(from); }
    if (to)      { where.push(`al.created_at <= $${i++}`); params.push(to); }
    const sql = `SELECT al.*, u.name, u.email FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id ${where.length ? 'WHERE '+where.join(' AND ') : ''} ORDER BY al.created_at DESC LIMIT 200`;
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.listen(3001, () => console.log('✅ User Service activo en :3001'));
