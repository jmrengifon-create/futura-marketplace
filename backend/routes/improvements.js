// backend/routes/improvements.js
// ============================================================
// FUTURA v4.0 — Nuevas rutas: WA Broadcast + Loyalty + Lock-in
// ============================================================
// INSTRUCCION: Agregar al final de backend/server.js:
//   const improvements = require('./routes/improvements');
//   app.use(improvements(pool, auth, role, notify, redis));
// ============================================================

module.exports = function(pool, auth, roleMiddleware, notify, redis) {
  const express = require('express');
  const router  = express.Router();

  // ─── HELPERS ─────────────────────────────────────────────
  const POINTS_PER_SOL = 10; // 10 puntos por cada S/ 1 gastado

  const sendWAMessage = async (phone, message) => {
    const WA_PHONE_ID  = process.env.WA_PHONE_ID;
    const WA_TOKEN_API = process.env.WA_ACCESS_TOKEN;
    if (!WA_PHONE_ID || !WA_TOKEN_API) {
      console.log(`[WA-MOCK] → ${phone}: ${message.substring(0, 60)}...`);
      return { mock: true };
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WA_TOKEN_API}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } }),
      });
      return await res.json();
    } catch (e) {
      console.error('[WA] error:', e.message);
      return { error: e.message };
    }
  };

  // ────────────────────────────────────────────────────────
  // 1. LOYALTY POINTS
  // ────────────────────────────────────────────────────────

  // GET /api/loyalty/balance — saldo del comprador
  router.get('/api/loyalty/balance', auth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT COALESCE(SUM(CASE WHEN type IN ('EARNED','BONUS') THEN points WHEN type='REDEEMED' THEN -points ELSE 0 END),0) AS balance,
                COALESCE(SUM(CASE WHEN type IN ('EARNED','BONUS') THEN points ELSE 0 END),0) AS total_earned,
                COALESCE(SUM(CASE WHEN type='REDEEMED' THEN points ELSE 0 END),0) AS total_redeemed
         FROM loyalty_points WHERE user_id=$1 AND (expires_at IS NULL OR expires_at > now())`,
        [req.user.id]
      );
      const history = await pool.query(
        `SELECT lp.*, o.total AS order_total FROM loyalty_points lp
         LEFT JOIN orders o ON o.id = lp.order_id
         WHERE lp.user_id=$1 ORDER BY lp.created_at DESC LIMIT 20`,
        [req.user.id]
      );
      res.json({ ...r.rows[0], history: history.rows });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/admin/loyalty — admin ve todos los balances
  router.get('/api/admin/loyalty', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT u.id, u.name, u.email,
          COALESCE(SUM(CASE WHEN lp.type IN ('EARNED','BONUS') THEN lp.points WHEN lp.type='REDEEMED' THEN -lp.points ELSE 0 END),0) AS balance,
          COALESCE(SUM(CASE WHEN lp.type IN ('EARNED','BONUS') THEN lp.points ELSE 0 END),0) AS total_earned,
          COUNT(DISTINCT o.id) AS total_orders
        FROM users u
        LEFT JOIN loyalty_points lp ON lp.user_id = u.id
        LEFT JOIN orders o ON o.buyer_id = u.id AND o.status = 'ENTREGADA'
        WHERE u.role = 'COMPRADOR'
        GROUP BY u.id, u.name, u.email
        ORDER BY balance DESC`);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/admin/loyalty/bonus — admin otorga puntos bonus
  router.post('/api/admin/loyalty/bonus', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { userId, points, description } = req.body;
      if (!userId || !points || points <= 0) return res.status(400).json({ error: 'Datos inválidos' });
      await pool.query(
        `INSERT INTO loyalty_points(user_id, points, type, description) VALUES($1,$2,'BONUS',$3)`,
        [userId, points, description || 'Puntos bonus del administrador']
      );
      const user = await pool.query('SELECT name FROM users WHERE id=$1', [userId]);
      await notify(userId, 'PUNTOS_BONUS', '🎁 ¡Recibiste puntos bonus!',
        `El administrador te otorgó ${points} puntos Futura. ${description || ''}`, '/profile');
      res.json({ ok: true, message: `${points} puntos otorgados a ${user.rows[0]?.name}` });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // ────────────────────────────────────────────────────────
  // 2. WHATSAPP ADMIN BROADCAST
  // ────────────────────────────────────────────────────────

  // GET /api/admin/wa/subscribers — lista de suscritos
  router.get('/api/admin/wa/subscribers', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT ws.*, u.email, u.role, u.status AS user_status,
          (SELECT COUNT(*) FROM orders WHERE buyer_id=ws.user_id) AS total_orders
        FROM wa_subscribers ws
        LEFT JOIN users u ON u.id = ws.user_id
        ORDER BY ws.opted_at DESC`);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/admin/wa/subscribers/:id/toggle — activar/desactivar suscripción
  router.post('/api/admin/wa/subscribers/:id/toggle', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(
        'UPDATE wa_subscribers SET opted_in = NOT opted_in WHERE id=$1 RETURNING opted_in',
        [req.params.id]
      );
      res.json({ ok: true, opted_in: r.rows[0].opted_in });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/admin/wa/broadcasts — historial de broadcasts
  router.get('/api/admin/wa/broadcasts', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT wb.*, u.name AS admin_name
        FROM wa_broadcasts wb JOIN users u ON u.id = wb.admin_id
        ORDER BY wb.created_at DESC LIMIT 50`);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/admin/wa/broadcast — enviar broadcast masivo
  router.post('/api/admin/wa/broadcast', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { title, message, audience = 'ALL' } = req.body;
      if (!title || !message) return res.status(400).json({ error: 'Título y mensaje requeridos' });

      // Crear registro del broadcast
      const bc = await pool.query(
        `INSERT INTO wa_broadcasts(admin_id, title, message, audience, status) VALUES($1,$2,$3,$4,'SENDING') RETURNING id`,
        [req.user.id, title, message, audience]
      );
      const broadcastId = bc.rows[0].id;

      // Obtener suscriptores según audiencia
      let subQuery = `SELECT ws.phone, ws.name FROM wa_subscribers ws
                      LEFT JOIN users u ON u.id = ws.user_id
                      WHERE ws.opted_in = TRUE`;
      if (audience === 'BUYERS')   subQuery += ` AND u.role = 'COMPRADOR'`;
      if (audience === 'VIP')      subQuery += ` AND (SELECT COUNT(*) FROM orders WHERE buyer_id=ws.user_id AND status='ENTREGADA') >= 3`;
      if (audience === 'INACTIVE') subQuery += ` AND (SELECT MAX(created_at) FROM orders WHERE buyer_id=ws.user_id) < now() - interval '30 days'`;

      const subs = await pool.query(subQuery);

      // Responder inmediatamente
      res.json({ ok: true, broadcastId, recipients: subs.rows.length });

      // Enviar en background
      let sent = 0, failed = 0;
      const fullMsg = `*${title}*\n\n${message}\n\n_Futura Marketplace — Responde STOP para darte de baja_`;
      for (const sub of subs.rows) {
        const result = await sendWAMessage(sub.phone, fullMsg);
        if (result?.mock || result?.messages) sent++;
        else failed++;
        // Rate limiting: 1 msg cada 100ms
        await new Promise(r => setTimeout(r, 100));
      }

      // Actualizar estado del broadcast
      await pool.query(
        `UPDATE wa_broadcasts SET status='DONE', sent_count=$1, fail_count=$2, sent_at=now() WHERE id=$3`,
        [sent, failed, broadcastId]
      );
    } catch (err) {
      console.error('[WA Broadcast]', err);
      res.status(500).json({ error: 'Error interno' });
    }
  });

  // POST /api/admin/wa/test — probar mensaje a un número
  router.post('/api/admin/wa/test', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { phone, message } = req.body;
      if (!phone || !message) return res.status(400).json({ error: 'phone y message requeridos' });
      const result = await sendWAMessage(phone, message);
      res.json({ ok: true, result });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // ────────────────────────────────────────────────────────
  // 3. FUTURA CERTIFIED — Lock-in de productos
  // ────────────────────────────────────────────────────────

  // PUT /api/admin/products/:id/certify — admin certifica un producto
  router.put('/api/admin/products/:id/certify', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { futura_certified, futura_brand, futura_sku } = req.body;
      await pool.query(
        'UPDATE products SET futura_certified=$1, futura_brand=$2, futura_sku=$3 WHERE id=$4',
        [futura_certified !== false, futura_brand || null, futura_sku || null, req.params.id]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/admin/products/uncertified — productos sin certificar
  router.get('/api/admin/products/uncertified', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT p.*, u.name AS seller_name, c.name AS category_name
        FROM products p
        JOIN users u ON u.id = p.seller_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.futura_certified = FALSE AND p.active = TRUE
        ORDER BY p.created_at DESC`);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // ────────────────────────────────────────────────────────
  // 4. HOOKS EN REGISTRO Y COMPRA
  // ────────────────────────────────────────────────────────

  // POST /api/wa/optout — comprador se da de baja de WA
  router.post('/api/wa/optout', auth, async (req, res) => {
    try {
      await pool.query(
        'UPDATE wa_subscribers SET opted_in=FALSE WHERE user_id=$1',
        [req.user.id]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/wa/optin — comprador se suscribe
  router.post('/api/wa/optin', auth, async (req, res) => {
    try {
      const { phone } = req.body;
      const user = await pool.query('SELECT name, phone FROM users WHERE id=$1', [req.user.id]);
      const userPhone = phone || user.rows[0]?.phone;
      if (!userPhone) return res.status(400).json({ error: 'Teléfono requerido' });

      await pool.query(
        `INSERT INTO wa_subscribers(user_id, phone, name, opted_in)
         VALUES($1,$2,$3,TRUE)
         ON CONFLICT(phone) DO UPDATE SET opted_in=TRUE, user_id=$1, name=$3`,
        [req.user.id, userPhone, user.rows[0]?.name]
      );

      // Mensaje de bienvenida al grupo
      await sendWAMessage(userPhone,
        `¡Hola ${user.rows[0]?.name}! 👋\n\nYa eres parte del grupo exclusivo de *Futura Marketplace*.\n\nDes este número recibirás:\n✅ Ofertas especiales\n🎁 Descuentos para miembros\n📦 Novedades de productos\n\nEscribe *STOP* en cualquier momento para darte de baja.`
      );

      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  return router;
};

// ============================================================
// INSTRUCCION PARA server.js — Agregar estas líneas:
//
// Al inicio del archivo (después de los requires):
//   const improvementsRouter = require('./routes/improvements');
//
// Después de definir `auth`, `role`, `notify`, `redis`:
//   app.use(improvementsRouter(pool, auth, role, notify, redis));
//
// En el endpoint /api/register, después de crear el usuario,
// agregar:
//   if ((r || 'COMPRADOR') === 'COMPRADOR' && req.body.phone) {
//     await pool.query(
//       `INSERT INTO wa_subscribers(user_id,phone,name) VALUES($1,$2,$3) ON CONFLICT(phone) DO NOTHING`,
//       [result.rows[0].id, req.body.phone, name]
//     ).catch(()=>{});
//   }
//
// En el endpoint de webhook de MercadoPago (cuando status='approved'),
// agregar after confirmar pago:
//   const orderData = await pool.query('SELECT o.*,u.id as uid FROM orders o JOIN users u ON u.id=o.buyer_id WHERE o.id=$1',[orderId]);
//   if (orderData.rows[0]) {
//     const pts = Math.floor(parseFloat(orderData.rows[0].total) * 10);
//     await pool.query(
//       `INSERT INTO loyalty_points(user_id,points,type,description,order_id) VALUES($1,$2,'EARNED',$3,$4)`,
//       [orderData.rows[0].uid, pts, `Compra #${orderId} — ${pts} puntos Futura`, orderId]
//     ).catch(()=>{});
//   }
// ============================================================
