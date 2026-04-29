/**
 * MÓDULOS 19-22 — Dashboard Admin, Notificaciones, Reportes y Docs
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 */

const express   = require('express');
const { Pool }  = require('pg');
const PDFDoc    = require('pdfkit');
const ExcelJS   = require('exceljs');
const { eventBus, EVENTS } = require('../shared/eventBus');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// ══════════════════════════════════════════════════════════════════════════
// MÓDULO 19 — DASHBOARD ADMIN AVANZADO
// ══════════════════════════════════════════════════════════════════════════

const dashboardRouter = express.Router();

// GET Vista ejecutiva completa
dashboardRouter.get('/executive', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const month = today.substring(0, 7);

  const [todaySales, monthSales, activeUsers, pendingVendors,
         lowStock, overdueCredits, scoreDistribution, recentOrders] = await Promise.all([

    db.query(`SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
              FROM orders WHERE DATE(created_at)=$1 AND status='completed'`, [today]),

    db.query(`SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
              FROM orders WHERE TO_CHAR(created_at,'YYYY-MM')=$1 AND status='completed'`, [month]),

    db.query(`SELECT COUNT(DISTINCT buyer_id) AS count FROM orders WHERE created_at > NOW()-INTERVAL '30 days'`),

    db.query(`SELECT COUNT(*) AS count FROM users WHERE role='vendor' AND vendor_status='pending'`),

    db.query(`SELECT COUNT(*) AS count FROM inventory_items WHERE quantity <= min_stock`),

    db.query(`SELECT COUNT(DISTINCT c.buyer_id) AS count FROM credits c
              JOIN credit_installments ci ON ci.credit_id=c.id WHERE ci.status='overdue'`),

    db.query(`SELECT score_color, COUNT(*) AS count FROM users WHERE role='buyer' GROUP BY score_color`),

    db.query(`SELECT o.id, o.total_amount, o.status, o.created_at, u.name AS buyer_name
              FROM orders o JOIN users u ON u.id=o.buyer_id ORDER BY o.created_at DESC LIMIT 10`),
  ]);

  const scoreMap = {};
  scoreDistribution.rows.forEach(r => { scoreMap[r.score_color] = parseInt(r.count); });

  res.json({
    today: {
      sales:  parseFloat(todaySales.rows[0].total),
      orders: parseInt(todaySales.rows[0].count),
    },
    month: {
      sales:  parseFloat(monthSales.rows[0].total),
      orders: parseInt(monthSales.rows[0].count),
    },
    alerts: {
      pending_vendors:  parseInt(pendingVendors.rows[0].count),
      low_stock:        parseInt(lowStock.rows[0].count),
      overdue_credits:  parseInt(overdueCredits.rows[0].count),
    },
    users: {
      active_30d: parseInt(activeUsers.rows[0].count),
      score: {
        green:  scoreMap.green  || 0,
        yellow: scoreMap.yellow || 0,
        red:    scoreMap.red    || 0,
      },
    },
    recent_orders: recentOrders.rows,
    generated_at: new Date().toISOString(),
  });
});

// ══════════════════════════════════════════════════════════════════════════
// MÓDULO 20 — SISTEMA DE NOTIFICACIONES AVANZADO
// ══════════════════════════════════════════════════════════════════════════

const MIGRATION_20 = `
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  body TEXT,
  type VARCHAR(30) CHECK (type IN ('info','success','warning','error','promotion','payment')),
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  channels TEXT[] DEFAULT ARRAY['app'],
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
`;

const notifRouter = express.Router();

async function createNotification(userId, { title, body, type = 'info', priority = 'normal', channels = ['app'], actionUrl, metadata = {} }) {
  const { rows: [notif] } = await db.query(`
    INSERT INTO notifications (user_id, title, body, type, priority, channels, action_url, metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [userId, title, body, type, priority, channels, actionUrl, JSON.stringify(metadata)]);

  // Push notification via FCM (si canal 'app')
  if (channels.includes('app') && process.env.FCM_SERVER_KEY) {
    const { rows: [user] } = await db.query(`SELECT fcm_token FROM users WHERE id=$1`, [userId]);
    if (user?.fcm_token) {
      const axios = require('axios');
      await axios.post('https://fcm.googleapis.com/fcm/send', {
        to: user.fcm_token,
        notification: { title, body },
        data: { type, actionUrl, notifId: String(notif.id) },
      }, {
        headers: { Authorization: `key=${process.env.FCM_SERVER_KEY}` },
      }).catch(e => console.error('[FCM]', e.message));
    }
  }
  return notif;
}

// GET notificaciones del usuario
notifRouter.get('/', async (req, res) => {
  const { unread_only } = req.query;
  const { rows } = await db.query(`
    SELECT * FROM notifications WHERE user_id=$1
    ${unread_only === 'true' ? 'AND read=false' : ''}
    ORDER BY priority DESC, created_at DESC LIMIT 50
  `, [req.user.id]);
  const unreadCount = rows.filter(r => !r.read).length;
  res.json({ notifications: rows, unread_count: unreadCount });
});

// POST marcar como leída
notifRouter.patch('/:id/read', async (req, res) => {
  await db.query(`UPDATE notifications SET read=true, read_at=NOW() WHERE id=$1 AND user_id=$2`,
    [req.params.id, req.user.id]);
  res.json({ success: true });
});

// POST marcar todas como leídas
notifRouter.patch('/read-all', async (req, res) => {
  await db.query(`UPDATE notifications SET read=true, read_at=NOW() WHERE user_id=$1 AND read=false`,
    [req.user.id]);
  res.json({ success: true });
});

// ── Suscripciones a eventos → notificaciones automáticas ──────────────────
eventBus.subscribe(EVENTS.ORDER_PAID, ({ userId, orderId, amount }) =>
  createNotification(userId, { title: '✅ Pago confirmado', body: `Tu pedido #${orderId} por S/ ${amount} está confirmado.`, type: 'success', priority: 'high', actionUrl: `/orders/${orderId}` }));

eventBus.subscribe(EVENTS.CREDIT_PAYMENT_DUE, ({ userId, amount, dueDate }) =>
  createNotification(userId, { title: '⚠️ Cuota por vencer', body: `Tu cuota de S/ ${amount} vence el ${dueDate}.`, type: 'warning', priority: 'high' }));

eventBus.subscribe(EVENTS.CREDIT_OVERDUE, ({ userId, daysLate }) =>
  createNotification(userId, { title: '🔴 Cuota vencida', body: `Tienes ${daysLate} días de mora. Regulariza tu deuda.`, type: 'error', priority: 'urgent' }));

eventBus.subscribe('loyalty.tier_upgraded', ({ userId, newTier }) =>
  createNotification(userId, { title: '🎉 ¡Subiste de nivel!', body: `Ahora eres cliente ${newTier.toUpperCase()}.`, type: 'success', priority: 'normal' }));

eventBus.subscribe(EVENTS.VENDOR_APPROVED, ({ userId }) =>
  createNotification(userId, { title: '✅ Cuenta aprobada', body: 'Tu cuenta de vendedor fue aprobada. ¡Ya puedes publicar!', type: 'success', priority: 'high' }));

eventBus.subscribe(EVENTS.INVENTORY_LOW, ({ userId, itemName, quantity }) =>
  createNotification(userId, { title: '📦 Stock bajo', body: `${itemName} tiene solo ${quantity} unidades.`, type: 'warning', priority: 'high' }));

// ══════════════════════════════════════════════════════════════════════════
// MÓDULO 21 — SISTEMA DE REPORTES AUTOMÁTICOS
// ══════════════════════════════════════════════════════════════════════════

const reportRouter = express.Router();

// Reporte diario en Excel
async function generateDailyExcelReport(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Juan Rengifo | Futura Marketplace';

  // Hoja 1: Ventas del día
  const salesSheet = workbook.addWorksheet('Ventas');
  salesSheet.columns = [
    { header: 'Pedido #', key: 'id', width: 10 },
    { header: 'Comprador', key: 'buyer', width: 25 },
    { header: 'Monto (S/)', key: 'amount', width: 15 },
    { header: 'Estado', key: 'status', width: 15 },
    { header: 'Hora', key: 'time', width: 20 },
  ];
  salesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  salesSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };

  const { rows: orders } = await db.query(`
    SELECT o.id, u.name AS buyer, o.total_amount, o.status, o.created_at
    FROM orders o JOIN users u ON u.id=o.buyer_id
    WHERE DATE(o.created_at)=$1 ORDER BY o.created_at
  `, [dateStr]);

  orders.forEach(o => salesSheet.addRow({
    id: o.id, buyer: o.buyer, amount: parseFloat(o.total_amount),
    status: o.status, time: new Date(o.created_at).toLocaleTimeString('es-PE'),
  }));

  // Hoja 2: Inventario bajo
  const invSheet = workbook.addWorksheet('Stock Bajo');
  invSheet.columns = [
    { header: 'Ítem', key: 'item', width: 30 },
    { header: 'Sede', key: 'location', width: 15 },
    { header: 'Stock', key: 'qty', width: 10 },
    { header: 'Mínimo', key: 'min', width: 10 },
  ];
  invSheet.getRow(1).font = { bold: true };

  const { rows: lowStock } = await db.query(
    `SELECT item_name, location, quantity, min_stock FROM inventory_items WHERE quantity <= min_stock`
  );
  lowStock.forEach(i => invSheet.addRow({ item: i.item_name, location: i.location, qty: i.quantity, min: i.min_stock }));

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename: `reporte-diario-${dateStr}.xlsx` };
}

// Reporte mensual en PDF
async function generateMonthlyPDFReport(year, month) {
  return new Promise(async (resolve) => {
    const doc = new PDFDoc({ margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const { rows: summary } = await db.query(`
      SELECT
        COUNT(*) AS orders,
        COALESCE(SUM(total_amount),0) AS revenue,
        COALESCE(AVG(total_amount),0) AS avg_ticket
      FROM orders WHERE EXTRACT(YEAR FROM created_at)=$1
        AND EXTRACT(MONTH FROM created_at)=$2 AND status='completed'
    `, [year, month]);

    const { rows: topVendors } = await db.query(`
      SELECT u.name, COALESCE(SUM(o.total_amount),0) AS sales, COUNT(o.id) AS orders
      FROM orders o JOIN users u ON u.id=o.vendor_id
      WHERE EXTRACT(YEAR FROM o.created_at)=$1 AND EXTRACT(MONTH FROM o.created_at)=$2
        AND o.status='completed'
      GROUP BY u.id, u.name ORDER BY sales DESC LIMIT 5
    `, [year, month]);

    // Portada
    doc.rect(0, 0, doc.page.width, 120).fill('#1a1a2e');
    doc.fillColor('white').fontSize(24).text('⚡ FUTURA MARKETPLACE', 50, 40, { align: 'center' });
    doc.fontSize(14).text(`Reporte Mensual — ${String(month).padStart(2,'0')}/${year}`, 50, 75, { align: 'center' });
    doc.text('Autor: Juan Rengifo', 50, 95, { align: 'center', fontSize: 10 });

    doc.moveDown(3).fillColor('#1a1a2e');
    doc.fontSize(18).text('📊 Resumen del Mes', { underline: true });
    doc.moveDown();
    doc.fontSize(12).fillColor('#333');
    doc.text(`Total de Pedidos:  ${summary.rows[0].orders}`);
    doc.text(`Revenue Total:     S/ ${parseFloat(summary.rows[0].revenue).toFixed(2)}`);
    doc.text(`Ticket Promedio:   S/ ${parseFloat(summary.rows[0].avg_ticket).toFixed(2)}`);

    doc.moveDown(2).fontSize(16).fillColor('#1a1a2e').text('🏆 Top Vendedores', { underline: true });
    doc.moveDown();
    topVendors.forEach((v, i) => {
      doc.fontSize(11).fillColor('#333')
         .text(`${i + 1}. ${v.name}  —  S/ ${parseFloat(v.sales).toFixed(2)}  (${v.orders} pedidos)`);
    });

    doc.moveDown(2).fontSize(10).fillColor('#999')
       .text(`Generado automáticamente por Futura Marketplace | ${new Date().toLocaleString('es-PE')}`,
              { align: 'center' });
    doc.end();
  });
}

// GET Descargar reporte diario
reportRouter.get('/daily', async (req, res) => {
  const { buffer, filename } = await generateDailyExcelReport();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

// GET Descargar reporte mensual PDF
reportRouter.get('/monthly', async (req, res) => {
  const now = new Date();
  const year  = parseInt(req.query.year  || now.getFullYear());
  const month = parseInt(req.query.month || now.getMonth() + 1);
  const buffer = await generateMonthlyPDFReport(year, month);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-${year}-${month}.pdf"`);
  res.send(buffer);
});

// ── Cron: reporte diario automático a las 11:55pm ─────────────────────────
eventBus.subscribe(EVENTS.REPORT_GENERATED, async ({ type }) => {
  if (type === 'daily') {
    console.log('[Reports] Generando y enviando reporte diario...');
    try {
      const { buffer, filename } = await generateDailyExcelReport();
      // Enviar por email al admin
      const nodemailer = require('nodemailer');
      const tr = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: 587,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await tr.sendMail({
        from: process.env.FROM_EMAIL,
        to:   process.env.ADMIN_EMAIL,
        subject: `📊 Reporte Diario Futura — ${new Date().toLocaleDateString('es-PE')}`,
        text: 'Adjunto el reporte diario de operaciones.',
        attachments: [{ filename, content: buffer }],
      });
      console.log('[Reports] Reporte diario enviado');
    } catch (e) {
      console.error('[Reports] Error:', e.message);
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════
// MÓDULO 22 — IDENTIDAD DEL SISTEMA (Módulo 23)
// ══════════════════════════════════════════════════════════════════════════

const systemRouter = express.Router();

// Metadata del sistema en headers
function systemIdentityMiddleware(req, res, next) {
  res.setHeader('X-System',  'Futura Marketplace');
  res.setHeader('X-Author',  'Juan Rengifo');
  res.setHeader('X-Version', process.env.APP_VERSION || '3.0.0');
  res.setHeader('X-Country', 'PE');
  next();
}

// GET Info del sistema
systemRouter.get('/info', (req, res) => {
  res.json({
    system:    'Futura Marketplace',
    version:   process.env.APP_VERSION || '3.0.0',
    author:    'Juan Rengifo',
    country:   'Perú',
    currency:  'PEN',
    timezone:  'America/Lima',
    build:     new Date().toISOString(),
    modules: [
      'automation', 'promotions', 'loyalty', 'scoring', 'credits',
      'risk', 'whatsapp', 'social', 'marketing', 'bi',
      'vendors', 'inventory', 'technicians', 'events', 'i18n',
      'international', 'sunat', 'qr', 'dashboard', 'notifications',
      'reports', 'documentation',
    ],
  });
});

module.exports = {
  dashboardRouter, notifRouter, reportRouter, systemRouter,
  systemIdentityMiddleware, createNotification,
  generateDailyExcelReport, generateMonthlyPDFReport,
  MIGRATION_20,
};
