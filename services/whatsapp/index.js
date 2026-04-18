// services/whatsapp/index.js — WhatsApp Business API Service (Port 3007)
require('dotenv').config();
const express = require('express');
const crypto  = require('crypto');
const { Pool } = require('pg');
const cors    = require('cors');
const Redis   = require('ioredis');
const { publish, EVENTS } = require('../../shared/events');

// Direct Redis connection for FSM state
const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: false,
});
redis.on('connect', () => console.log('[WA] Redis connected'));
redis.on('error', (e) => console.warn('[WA] Redis error:', e.message));

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(cors());

const WA_TOKEN    = process.env.WA_VERIFY_TOKEN  || 'futura_whatsapp_token';
const WA_API_URL  = 'https://graph.facebook.com/v18.0';
const WA_PHONE_ID = process.env.WA_PHONE_ID      || '';
const WA_TOKEN_API= process.env.WA_ACCESS_TOKEN  || '';

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'whatsapp' }));

// ─── FSM States ───────────────────────────────────────────
const STATES = {
  IDLE:             'IDLE',
  MAIN_MENU:        'MAIN_MENU',
  SEARCH_PRODUCT:   'SEARCH_PRODUCT',
  VIEW_PRODUCT:     'VIEW_PRODUCT',
  REQUEST_QUOTE:    'REQUEST_QUOTE',
  QUOTE_SPECS:      'QUOTE_SPECS',
  QUOTE_QUANTITY:   'QUOTE_QUANTITY',
  CHECK_ORDER:      'CHECK_ORDER',
  SUPPORT:          'SUPPORT',
};

// ─── Message Templates ────────────────────────────────────
const TEMPLATES = {
  welcome: (name) => `¡Hola ${name}! 👋 Bienvenido a *Futura Marketplace*.\n\nSoy tu asistente virtual. ¿En qué puedo ayudarte?\n\n1️⃣ Buscar productos\n2️⃣ Ver mis pedidos\n3️⃣ Solicitar cotización\n4️⃣ Soporte\n\nEscribe el número o tu consulta.`,
  mainMenu:  () => `¿Qué deseas hacer?\n\n1️⃣ Buscar productos o servicios\n2️⃣ Ver estado de mis pedidos\n3️⃣ Solicitar cotización personalizada\n4️⃣ Hablar con soporte\n\n_Escribe "menú" en cualquier momento para volver aquí._`,
  searching: (q) => `🔍 Buscando *"${q}"*...\n\nEspera un momento.`,
  noResults: (q) => `😕 No encontré resultados para *"${q}"*.\n\n¿Quieres intentar con otra búsqueda? Escribe el nombre del producto.`,
  productList: (products) => {
    if (!products.length) return 'No hay productos disponibles en este momento.';
    let msg = `📦 *Resultados encontrados:*\n\n`;
    products.slice(0, 5).forEach((p, i) => {
      msg += `*${i+1}. ${p.title}*\n`;
      msg += `   💰 S/ ${parseFloat(p.price).toLocaleString()}\n`;
      msg += `   👤 ${p.seller_name}\n`;
      msg += `   🔗 Ver en web: ${process.env.FRONTEND_URL}/product/${p.id}\n\n`;
    });
    msg += `_Escribe el número para más detalles o cotizar._`;
    return msg;
  },
  quoteStart: () => `📋 *Solicitar Cotización Personalizada*\n\nVoy a ayudarte a solicitar una cotización.\n\n¿Para qué tipo de producto o servicio necesitas la cotización?\n\n_(Ejemplo: Banner 100x70cm, uniformes DTF, tarjetas de presentación)_`,
  quoteQty:   (spec) => `Perfecto! Necesito saber la *cantidad* para el pedido:\n"${spec}"\n\n¿Cuántas unidades necesitas?`,
  quoteConfirm: (spec, qty) => `✅ *Resumen de tu solicitud:*\n\nProducto/Servicio: ${spec}\nCantidad: ${qty}\n\n¿Confirmas el envío de esta cotización a los vendedores disponibles?\n\n1️⃣ Sí, confirmar\n2️⃣ No, modificar`,
  quoteSent:  () => `🎉 ¡Tu solicitud fue enviada!\n\nLos vendedores disponibles responderán en menos de *4 horas*.\n\nPuedes ver tus cotizaciones en: ${process.env.FRONTEND_URL}/my-quotations\n\n_¿Puedo ayudarte con algo más?_`,
  orderStatus: (order) => `📦 *Orden #${order.id}*\n\nEstado: ${statusEmoji(order.status)} *${statusLabel(order.status)}*\nTotal: S/ ${parseFloat(order.total).toLocaleString()}\nFecha: ${new Date(order.created_at).toLocaleDateString('es-PE')}\n\nVer detalles: ${process.env.FRONTEND_URL}/orders/${order.id}`,
  support: () => `🆘 *Soporte Futura Marketplace*\n\nUn agente humano estará disponible pronto.\n\nMientras tanto:\n- 📧 soporte@futuradigital.pe\n- 🌐 ${process.env.FRONTEND_URL}\n\nEscribe tu consulta y la registraremos.`,
};

const statusEmoji = (s) => ({ CREADA:'📋', PENDIENTE_PAGO:'⏳', PAGADA:'✅', EN_PRODUCCION:'⚙️', LISTO:'📦', ENVIADA:'🚚', ENTREGADA:'✓', CANCELADA:'❌' }[s] || '•');
const statusLabel = (s) => ({ CREADA:'Creada', PENDIENTE_PAGO:'Pago pendiente', PAGADA:'Pagada', EN_PRODUCCION:'En producción', LISTO:'Listo', ENVIADA:'Enviada', ENTREGADA:'Entregada', CANCELADA:'Cancelada' }[s] || s);

// ─── Send WhatsApp message ─────────────────────────────────
const sendMessage = async (to, text) => {
  if (!WA_PHONE_ID || !WA_TOKEN_API) {
    // Modo simulación — log y guardar en BD
    console.log(`[WA-MOCK] → ${to}: ${text.substring(0, 80)}...`);
    await pool.query(
      'INSERT INTO whatsapp_messages(phone,direction,message,timestamp) VALUES($1,$2,$3,now())',
      [to, 'OUT', text]
    ).catch(() => {});
    return { mock: true };
  }
  try {
    const res = await fetch(`${WA_API_URL}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WA_TOKEN_API}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    return await res.json();
  } catch (e) {
    console.error('[WA] sendMessage error:', e.message);
  }
};

const sendButtons = async (to, body, buttons) => {
  if (!WA_PHONE_ID || !WA_TOKEN_API) {
    console.log(`[WA-MOCK] → ${to}: [BUTTONS] ${body}`);
    return;
  }
  try {
    await fetch(`${WA_API_URL}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WA_TOKEN_API}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'interactive',
        interactive: {
          type: 'button', body: { text: body },
          action: { buttons: buttons.map((b,i) => ({ type:'reply', reply:{ id:`btn_${i}`, title: b } })) }
        }
      }),
    });
  } catch (e) { console.error('[WA] sendButtons error:', e.message); }
};

// ─── FSM Processor ────────────────────────────────────────
const processMessage = async (phone, message, userName) => {
  const stateKey  = `wa:state:${phone}`;
  const ctxKey    = `wa:ctx:${phone}`;
  const stateData = await redis.get(stateKey);
  const ctx       = await redis.get(ctxKey);

  let state   = stateData ? JSON.parse(stateData) : { state: STATES.IDLE };
  let context = ctx ? JSON.parse(ctx) : {};

  const msg = message.trim().toLowerCase();

  // Global commands
  if (['menu', 'menú', 'inicio', 'start', 'hola', 'hi'].includes(msg)) {
    state = { state: STATES.MAIN_MENU };
    await sendMessage(phone, TEMPLATES.welcome(userName));
    await redis.setex(stateKey, 3600, JSON.stringify(state));
    return;
  }

  switch (state.state) {
    case STATES.IDLE:
    case STATES.MAIN_MENU: {
      if (msg === '1' || msg.includes('buscar') || msg.includes('product')) {
        state.state = STATES.SEARCH_PRODUCT;
        await sendMessage(phone, '🔍 ¿Qué producto o servicio estás buscando?\n\n_(Ejemplo: banner, impresora, tela, camiseta)_');
      } else if (msg === '2' || msg.includes('pedido') || msg.includes('orden')) {
        state.state = STATES.CHECK_ORDER;
        // Get user orders
        const user = await pool.query('SELECT id FROM users WHERE phone=$1', [phone]);
        if (user.rows.length) {
          const orders = await pool.query(
            'SELECT id,status,total,created_at FROM orders WHERE buyer_id=$1 ORDER BY created_at DESC LIMIT 3',
            [user.rows[0].id]
          );
          if (orders.rows.length) {
            await sendMessage(phone, '📋 *Tus últimos pedidos:*\n');
            for (const o of orders.rows) await sendMessage(phone, TEMPLATES.orderStatus(o));
          } else {
            await sendMessage(phone, 'No tienes pedidos registrados.\n\n¿Deseas hacer una cotización?\n\n1️⃣ Sí\n2️⃣ Volver al menú');
          }
        } else {
          await sendMessage(phone, `Para ver tus pedidos, regístrate en:\n${process.env.FRONTEND_URL}/register\n\n¿Te ayudo con otra cosa?`);
        }
        state.state = STATES.MAIN_MENU;
      } else if (msg === '3' || msg.includes('cotiza') || msg.includes('presupuesto')) {
        state.state = STATES.REQUEST_QUOTE;
        await sendMessage(phone, TEMPLATES.quoteStart());
      } else if (msg === '4' || msg.includes('soporte') || msg.includes('ayuda') || msg.includes('help')) {
        state.state = STATES.SUPPORT;
        await sendMessage(phone, TEMPLATES.support());
      } else {
        await sendMessage(phone, TEMPLATES.mainMenu());
        state.state = STATES.MAIN_MENU;
      }
      break;
    }

    case STATES.SEARCH_PRODUCT: {
      // Query products
      await sendMessage(phone, TEMPLATES.searching(message));
      const results = await pool.query(
        `SELECT p.id,p.title,p.price,u.name AS seller_name
         FROM products p JOIN users u ON u.id=p.seller_id
         WHERE p.active=TRUE AND (
           to_tsvector('spanish', p.title || ' ' || COALESCE(p.description,'')) @@ plainto_tsquery('spanish', $1)
           OR p.title ILIKE $2
         ) ORDER BY p.created_at DESC LIMIT 5`,
        [message, `%${message}%`]
      );

      if (!results.rows.length) {
        await sendMessage(phone, TEMPLATES.noResults(message));
        state.state = STATES.SEARCH_PRODUCT;
      } else {
        context.searchResults = results.rows;
        await sendMessage(phone, TEMPLATES.productList(results.rows));
        state.state = STATES.VIEW_PRODUCT;
      }
      break;
    }

    case STATES.VIEW_PRODUCT: {
      const idx = parseInt(msg) - 1;
      if (!isNaN(idx) && context.searchResults && context.searchResults[idx]) {
        const p = context.searchResults[idx];
        context.selectedProduct = p;
        // Send product details as text (works in mock and real)
        await sendMessage(phone,
          `*${p.title}*\n💰 Precio: S/ ${parseFloat(p.price).toLocaleString()}\n👤 Vendedor: ${p.seller_name}\n🔗 Ver en web: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/product/${p.id}\n\n¿Qué deseas hacer?\n1️⃣ Solicitar cotización\n2️⃣ Buscar otro producto\n0️⃣ Volver al menú`
        );
        state.state = STATES.QUOTE_SPECS;
      } else if (msg === '0' || msg.includes('menú') || msg.includes('menu')) {
        state.state = STATES.MAIN_MENU;
        await sendMessage(phone, TEMPLATES.mainMenu());
      } else {
        await sendMessage(phone, 'Escribe el número del producto (1-5) que te interesa, o *0* para volver al menú.');
      }
      break;
    }

    case STATES.REQUEST_QUOTE:
    case STATES.QUOTE_SPECS: {
      // Handle choices from product detail view
      if (msg === '2') {
        state.state = STATES.SEARCH_PRODUCT;
        await sendMessage(phone, '🔍 ¿Qué producto o servicio estás buscando?');
        break;
      }
      if (msg === '0') {
        state.state = STATES.MAIN_MENU;
        await sendMessage(phone, TEMPLATES.mainMenu());
        break;
      }
      // msg === '1' or free text = start quote
      const specText = msg === '1' && context.selectedProduct
        ? context.selectedProduct.title
        : message;
      context.quoteSpec = specText;
      state.state = STATES.QUOTE_QUANTITY;
      await sendMessage(phone, TEMPLATES.quoteQty(specText));
      break;
    }

    case STATES.QUOTE_QUANTITY: {
      const qty = parseInt(msg);
      if (isNaN(qty) || qty <= 0) {
        await sendMessage(phone, '❌ Por favor escribe una cantidad válida (número entero).');
      } else {
        context.quoteQty = qty;
        state.state = STATES.MAIN_MENU;
        await sendMessage(phone, TEMPLATES.quoteConfirm(context.quoteSpec, qty));
        // Store pending quote in Redis for confirmation
        await redis.setex(`wa:pending_quote:${phone}`, 300, JSON.stringify({ spec: context.quoteSpec, qty }));
      }
      break;
    }

    case STATES.SUPPORT: {
      // Log support request
      await pool.query(
        'INSERT INTO audit_logs(user_id,action,resource,ip,status_code,payload_size) VALUES($1,$2,$3,$4,$5,$6)',
        [null, `WA_SUPPORT: ${message}`, `/whatsapp/${phone}`, phone, 200, message.length]
      ).catch(() => {});
      await sendMessage(phone, '✅ Mensaje registrado. Un agente te contactará pronto.\n\nPuedes también crear una solicitud en nuestro portal.');
      state.state = STATES.MAIN_MENU;
      break;
    }
  }

  await redis.setex(stateKey, 3600, JSON.stringify(state));
  await redis.setex(ctxKey, 3600, JSON.stringify(context));
};

// ─── Webhook verification (Meta) ──────────────────────────
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WA_TOKEN) {
    console.log('[WA] Webhook verificado por Meta');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ─── Webhook receiver (Meta messages) ─────────────────────
app.post('/api/whatsapp/webhook', async (req, res) => {
  // Verify Meta signature
  const sig = req.headers['x-hub-signature-256'];
  if (sig && process.env.WA_APP_SECRET) {
    const expected = 'sha256=' + crypto.createHmac('sha256', process.env.WA_APP_SECRET)
      .update(JSON.stringify(req.body)).digest('hex');
    if (sig !== expected) return res.sendStatus(403);
  }

  res.sendStatus(200); // Responder a Meta rápido

  try {
    const entry   = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;

    if (value?.messages?.length) {
      for (const msg of value.messages) {
        if (msg.type !== 'text') continue;
        const phone    = msg.from;
        const text     = msg.text?.body || '';
        const contact  = value.contacts?.find(c => c.wa_id === phone);
        const userName = contact?.profile?.name || 'Cliente';

        console.log(`[WA] Mensaje de ${phone} (${userName}): ${text}`);

        // Log incoming message
        await pool.query(
          'INSERT INTO whatsapp_messages(phone,direction,message,timestamp) VALUES($1,$2,$3,$4)',
          [phone, 'IN', text, new Date(parseInt(msg.timestamp)*1000)]
        ).catch(() => {});

        // Process FSM
        await processMessage(phone, text, userName);
      }
    }
  } catch (e) {
    console.error('[WA] Webhook processing error:', e);
  }
});

// ─── Send WhatsApp notification (internal API) ────────────
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone y message requeridos' });
    await sendMessage(phone, message);
    await pool.query(
      'INSERT INTO whatsapp_messages(phone,direction,message,timestamp) VALUES($1,$2,$3,$4)',
      [phone, 'OUT', message, new Date()]
    ).catch(() => {});
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Test endpoint ────────────────────────────────────────
app.post('/api/whatsapp/test', async (req, res) => {
  const { phone = '51999000000', message = 'hola' } = req.body;

  // Save incoming message
  await pool.query(
    'INSERT INTO whatsapp_messages(phone,direction,message,timestamp) VALUES($1,$2,$3,now())',
    [phone, 'IN', message]
  ).catch(() => {});

  // Process FSM synchronously — bot responses saved inside sendMessage
  await processMessage(phone, message, 'Test User');

  // Small delay to ensure all async DB writes complete
  await new Promise(r => setTimeout(r, 400));

  // Return full conversation history ordered by ID (most reliable ordering)
  const msgs = await pool.query(
    'SELECT * FROM whatsapp_messages WHERE phone=$1 ORDER BY id ASC LIMIT 60',
    [phone]
  ).catch(() => ({ rows: [] }));

  res.json({ ok: true, messages: msgs.rows });
});

app.post('/api/whatsapp/reset', async (req, res) => {
  const { phone = '51999000000' } = req.body;
  try {
    await redis.del(`wa:state:${phone}`, `wa:ctx:${phone}`);
    await pool.query('DELETE FROM whatsapp_messages WHERE phone=$1', [phone]);
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

app.get('/api/whatsapp/history/:phone', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM whatsapp_messages WHERE phone=$1 ORDER BY timestamp DESC LIMIT 50',
      [req.params.phone]
    );
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.listen(3007, () => console.log('✅ WhatsApp Service activo en :3007'));
