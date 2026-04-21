// backend/routes/wa-inbox.js
// ============================================================
// Bandeja de entrada WhatsApp: simulador ↔ admin en tiempo real
// ============================================================
// INSTRUCCION: Agregar en server.js:
//   const waInbox = require('./routes/wa-inbox');
//   app.use(waInbox(pool, auth, role));
// ============================================================

module.exports = function(pool, auth, roleMiddleware) {
  const express = require('express');
  const router  = express.Router();

  // ── Crear tabla si no existe (se ejecuta al iniciar) ──────
  pool.query(`
    CREATE TABLE IF NOT EXISTS wa_inbox (
      id          SERIAL PRIMARY KEY,
      phone       VARCHAR(30) NOT NULL,
      name        VARCHAR(100) DEFAULT 'Cliente',
      direction   VARCHAR(10) NOT NULL CHECK (direction IN ('IN','OUT','ADMIN')),
      message     TEXT NOT NULL,
      read_admin  BOOLEAN DEFAULT FALSE,
      timestamp   TIMESTAMP DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_wa_inbox_phone ON wa_inbox(phone);
    CREATE INDEX IF NOT EXISTS idx_wa_inbox_ts    ON wa_inbox(timestamp DESC);
  `).catch(e => console.error('[wa-inbox] init:', e.message));

  // ─────────────────────────────────────────────────────────
  // RUTAS DEL SIMULADOR (públicas — sin auth)
  // ─────────────────────────────────────────────────────────

  // POST /api/wa/inbox/send — simulador envía mensaje
  router.post('/api/wa/inbox/send', async (req, res) => {
    try {
      const { phone, name, message, direction = 'IN' } = req.body;
      if (!phone || !message) return res.status(400).json({ error: 'phone y message requeridos' });

      // Guardar mensaje del usuario
      await pool.query(
        'INSERT INTO wa_inbox(phone, name, direction, message) VALUES($1,$2,$3,$4)',
        [phone, name || 'Cliente Test', direction, message]
      );

      // Si es mensaje entrante (IN), generar respuesta automática del bot
      if (direction === 'IN') {
        const botReply = generateBotReply(message.toLowerCase().trim());
        if (botReply) {
          await pool.query(
            'INSERT INTO wa_inbox(phone, name, direction, message) VALUES($1,$2,$3,$4)',
            [phone, 'Bot Futura', 'OUT', botReply]
          );
        }
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('[wa-inbox send]', err);
      res.status(500).json({ error: 'Error interno' });
    }
  });

  // GET /api/wa/inbox/thread?phone=51999... — historial de una conversación
  router.get('/api/wa/inbox/thread', async (req, res) => {
    try {
      const { phone } = req.query;
      if (!phone) return res.status(400).json({ error: 'phone requerido' });
      const r = await pool.query(
        'SELECT * FROM wa_inbox WHERE phone=$1 ORDER BY timestamp ASC LIMIT 100',
        [phone]
      );
      res.json({ messages: r.rows });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/wa/inbox/clear — limpiar conversación (para nueva conv.)
  router.post('/api/wa/inbox/clear', async (req, res) => {
    try {
      const { phone } = req.body;
      await pool.query('DELETE FROM wa_inbox WHERE phone=$1', [phone]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // ─────────────────────────────────────────────────────────
  // RUTAS DEL ADMIN
  // ─────────────────────────────────────────────────────────

  // GET /api/admin/wa/inbox — lista de conversaciones activas
  router.get('/api/admin/wa/inbox', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT DISTINCT ON (phone)
          phone, name,
          message AS last_message,
          direction AS last_direction,
          timestamp AS last_ts,
          (SELECT COUNT(*) FROM wa_inbox wi2 WHERE wi2.phone = wi.phone AND wi2.direction = 'IN' AND wi2.read_admin = FALSE) AS unread
        FROM wa_inbox wi
        ORDER BY phone, timestamp DESC
      `);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/admin/wa/inbox/:phone — mensajes de una conversación
  router.get('/api/admin/wa/inbox/:phone', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { phone } = req.params;
      // Marcar como leídos
      await pool.query('UPDATE wa_inbox SET read_admin=TRUE WHERE phone=$1 AND direction=\'IN\'', [phone]);
      const r = await pool.query(
        'SELECT * FROM wa_inbox WHERE phone=$1 ORDER BY timestamp ASC LIMIT 100',
        [phone]
      );
      res.json({ messages: r.rows });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/admin/wa/inbox/:phone/reply — admin responde
  router.post('/api/admin/wa/inbox/:phone/reply', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { phone } = req.params;
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'message requerido' });

      // Guardar respuesta del admin
      await pool.query(
        'INSERT INTO wa_inbox(phone, name, direction, message) VALUES($1,$2,\'ADMIN\',$3)',
        [phone, 'Admin Futura', message]
      );

      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // ─────────────────────────────────────────────────────────
  // BOT DE RESPUESTAS AUTOMÁTICAS
  // ─────────────────────────────────────────────────────────
  function generateBotReply(msg) {
    if (msg === 'hola' || msg === 'hi' || msg === 'buenas' || msg === 'inicio') {
      return `¡Hola Test User! 👋 Bienvenido a *Futura Marketplace*.\n\nSoy tu asistente virtual. ¿En qué puedo ayudarte?\n\n1️⃣ Buscar productos\n2️⃣ Ver mis pedidos\n3️⃣ Solicitar cotización\n4️⃣ Soporte\n\nEscribe el número o tu consulta.`;
    }
    if (msg === '1' || msg.includes('buscar') || msg.includes('producto')) {
      return `🔍 *Búsqueda de productos*\n\nPuedes buscar en nuestro catálogo en:\n👉 ${process.env.FRONTEND_URL || 'https://content-intuition-production-e967.up.railway.app'}\n\nTenemos:\n🖨 Impresoras Ecosolvente\n🖨 Impresoras UV y DTF\n✂️ Plotters de corte\n🧴 Tintas y suministros\n🔧 Servicio técnico\n\n¿Hay algún producto específico que buscas?`;
    }
    if (msg === '2' || msg.includes('pedido')) {
      return `📦 *Mis pedidos*\n\nPara ver tus pedidos:\n1. Ingresa a tu cuenta en la plataforma\n2. Ve a "Mis pedidos" en tu perfil\n\n¿Tienes algún pedido con problemas? Escríbenos el número de orden.`;
    }
    if (msg === '3' || msg.includes('cotiz')) {
      return `💼 *Solicitar cotización*\n\nPara solicitar una cotización necesitamos:\n📐 Tipo de trabajo\n📏 Dimensiones o cantidad\n🎨 Materiales requeridos\n⏰ Fecha de entrega\n\nEscríbenos los detalles y un vendedor te contactará pronto.`;
    }
    if (msg === '4' || msg.includes('soporte') || msg.includes('ayuda')) {
      return `🛟 *Soporte técnico*\n\nNuestro equipo está disponible:\n🕐 Lun-Vie: 9am - 6pm\n📧 soporte@futuradigital.tech\n\nUn agente revisará tu consulta pronto. También puedes escribir directamente aquí y el administrador te responderá. 👆`;
    }
    if (msg === 'menú' || msg === 'menu') {
      return `📋 *Menú principal*\n\n1️⃣ Buscar productos\n2️⃣ Ver mis pedidos\n3️⃣ Solicitar cotización\n4️⃣ Soporte\n\nEscribe el número de la opción.`;
    }
    if (msg.includes('precio') || msg.includes('costo') || msg.includes('cuanto')) {
      return `💰 Los precios varían según el producto y cantidad.\n\nTe recomendamos:\n• Ver el catálogo en la plataforma\n• Solicitar una cotización personalizada (opción 3)\n\nNuestros vendedores responden en menos de 24 horas. ⏱`;
    }
    if (msg.includes('gracias') || msg.includes('ok') || msg.includes('perfecto')) {
      return `¡Con gusto! 😊 Estamos aquí para ayudarte.\n\nSi necesitas algo más, escríbenos. 🚀`;
    }
    // Respuesta por defecto — notificar que un agente revisará
    return `Gracias por tu mensaje. 🙏\n\nHemos recibido tu consulta y un agente la revisará pronto.\n\nMientras tanto, puedes escribir *menú* para ver las opciones disponibles.`;
  }

  return router;
};
