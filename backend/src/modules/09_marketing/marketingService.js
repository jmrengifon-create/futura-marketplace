/**
 * MÓDULO 09 — MOTOR DE MARKETING INTELIGENTE
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 *
 * Segmentación avanzada + campañas multicanal (email, WhatsApp, app)
 * Routes: POST /api/marketing/campaign, GET /api/marketing/campaigns
 */

const express  = require('express');
const router   = express.Router();
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const { sendText } = require('../07_whatsapp/whatsappService');
const { eventBus } = require('../shared/eventBus');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATION = `
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  segment VARCHAR(30) CHECK (segment IN ('all','new','recurrent','vip','overdue','high_value','inactive')),
  channels TEXT[] DEFAULT ARRAY['email'],
  subject VARCHAR(300),
  body TEXT NOT NULL,
  cta_url TEXT,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'draft',
  stats JSONB DEFAULT '{"sent":0,"opened":0,"clicked":0,"failed":0}',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS campaign_sends (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES marketing_campaigns(id),
  user_id INTEGER REFERENCES users(id),
  channel VARCHAR(20),
  status VARCHAR(20) DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// ── Mailer (SMTP: SendGrid/Mailgun/SMTP propio) ───────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SMTP_PASS || '',
  },
});

async function sendEmail(to, subject, htmlBody) {
  await transporter.sendMail({
    from: `"Futura Marketplace" <${process.env.FROM_EMAIL || 'noreply@futura.pe'}>`,
    to, subject,
    html: htmlBody,
  });
}

// ── Segmentación de usuarios ──────────────────────────────────────────────
async function getSegmentedUsers(segment) {
  const queries = {
    all:        `SELECT id,name,email,phone FROM users WHERE role='buyer'`,
    new:        `SELECT id,name,email,phone FROM users WHERE loyalty_tier='new' AND role='buyer'`,
    recurrent:  `SELECT id,name,email,phone FROM users WHERE loyalty_tier='recurrent' AND role='buyer'`,
    vip:        `SELECT id,name,email,phone FROM users WHERE loyalty_tier='vip' AND role='buyer'`,
    overdue:    `
      SELECT DISTINCT u.id,u.name,u.email,u.phone FROM users u
      JOIN credits c ON c.buyer_id=u.id
      JOIN credit_installments ci ON ci.credit_id=c.id
      WHERE ci.status='overdue'`,
    high_value: `SELECT id,name,email,phone FROM users WHERE total_purchases >= 10000 AND role='buyer'`,
    inactive:   `
      SELECT id,name,email,phone FROM users
      WHERE role='buyer'
        AND id NOT IN (SELECT DISTINCT buyer_id FROM orders WHERE created_at > NOW()-INTERVAL '60 days')`,
  };
  const query = queries[segment] || queries.all;
  const { rows } = await db.query(query);
  return rows;
}

// ── Construir HTML de email ────────────────────────────────────────────────
function buildEmailHTML(campaign, user) {
  return `
  <!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0}
  .container{max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden}
  .header{background:#1a1a2e;padding:24px;text-align:center}
  .header h1{color:#e94560;margin:0;font-size:22px}
  .body{padding:32px;color:#333;line-height:1.7}
  .cta{display:inline-block;background:#e94560;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;margin:16px 0}
  .footer{background:#f0f0f0;padding:16px;text-align:center;font-size:12px;color:#999}
  </style></head><body>
  <div class="container">
    <div class="header"><h1>⚡ Futura Marketplace</h1></div>
    <div class="body">
      <p>Hola <strong>${user.name}</strong>,</p>
      ${campaign.body.replace(/\n/g, '<br>')}
      ${campaign.cta_url ? `<br><a href="${campaign.cta_url}" class="cta">Ver oferta →</a>` : ''}
    </div>
    <div class="footer">
      Futura Marketplace | Lima, Perú<br>
      <a href="${process.env.APP_URL}/unsubscribe?uid=${user.id}">Cancelar suscripción</a>
    </div>
  </div></body></html>`;
}

// ── Ejecutar campaña ──────────────────────────────────────────────────────
async function executeCampaign(campaignId) {
  const { rows: [campaign] } = await db.query(
    `SELECT * FROM marketing_campaigns WHERE id=$1`, [campaignId]
  );
  if (!campaign) throw new Error('Campaña no encontrada');

  const users    = await getSegmentedUsers(campaign.segment);
  let sent = 0, failed = 0;

  for (const user of users) {
    for (const channel of (campaign.channels || ['email'])) {
      try {
        if (channel === 'email' && user.email) {
          const html = buildEmailHTML(campaign, user);
          await sendEmail(user.email, campaign.subject || campaign.name, html);
          sent++;
        }
        if (channel === 'whatsapp' && user.phone) {
          await sendText(user.phone, `*${campaign.name}*\n\n${campaign.body}${campaign.cta_url ? `\n\n🔗 ${campaign.cta_url}` : ''}`);
          sent++;
        }
        await db.query(
          `INSERT INTO campaign_sends (campaign_id,user_id,channel) VALUES ($1,$2,$3)`,
          [campaignId, user.id, channel]
        );
      } catch (e) {
        console.error(`[Marketing] Error enviando a ${user.email}:`, e.message);
        failed++;
      }
      await new Promise(r => setTimeout(r, 100)); // rate limit
    }
  }

  await db.query(`
    UPDATE marketing_campaigns
    SET status='sent', sent_at=NOW(),
        stats=jsonb_set(jsonb_set(stats,'{sent}',$1::jsonb),'{failed}',$2::jsonb)
    WHERE id=$3
  `, [sent, failed, campaignId]);

  console.log(`[Marketing] Campaña ${campaignId}: ${sent} enviados, ${failed} fallidos`);
  return { sent, failed, total: users.length };
}

// ── POST Crear campaña ─────────────────────────────────────────────────────
router.post('/campaign', async (req, res) => {
  const { name, segment, channels, subject, body, cta_url, scheduled_at } = req.body;
  const { rows: [campaign] } = await db.query(`
    INSERT INTO marketing_campaigns (name,segment,channels,subject,body,cta_url,scheduled_at,created_by,status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [name, segment || 'all', channels || ['email'], subject, body, cta_url,
      scheduled_at || null, req.user.id, scheduled_at ? 'scheduled' : 'draft']);

  // Enviar inmediatamente si no está programada
  if (!scheduled_at) {
    const stats = await executeCampaign(campaign.id);
    return res.json({ campaign, stats });
  }
  res.json({ campaign, message: 'Campaña programada' });
});

// ── GET Listar campañas ────────────────────────────────────────────────────
router.get('/campaigns', async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM marketing_campaigns ORDER BY created_at DESC LIMIT 50`
  );
  res.json(rows);
});

// ── GET Stats de una campaña ───────────────────────────────────────────────
router.get('/campaigns/:id/stats', async (req, res) => {
  const { rows: [campaign] } = await db.query(
    `SELECT * FROM marketing_campaigns WHERE id=$1`, [req.params.id]
  );
  const { rows: sends } = await db.query(
    `SELECT channel, status, COUNT(*) as count FROM campaign_sends WHERE campaign_id=$1 GROUP BY channel,status`,
    [req.params.id]
  );
  res.json({ ...campaign, breakdown: sends });
});

module.exports = { router, executeCampaign, getSegmentedUsers, MIGRATION };
