// backend/routes/phase2.js — Marketing & Redes Sociales
// INSTRUCCION server.js:
//   const phase2 = require('./routes/phase2');
//   app.use(phase2(pool, auth, role, notify));

module.exports = function(pool, auth, roleMiddleware, notify) {
  const express = require('express');
  const router  = express.Router();

  // ── EMAIL CAMPAIGNS ─────────────────────────────────────────

  // GET /api/admin/email-campaigns
  router.get('/api/admin/email-campaigns', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT ec.*, u.name AS admin_name FROM email_campaigns ec
         JOIN users u ON u.id = ec.admin_id ORDER BY ec.created_at DESC`
      );
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/admin/email-campaigns — crear campaña
  router.post('/api/admin/email-campaigns', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { subject, content, audience, loyalty_level, scheduled_at } = req.body;
      const r = await pool.query(
        `INSERT INTO email_campaigns(admin_id,subject,content,audience,loyalty_level,scheduled_at)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.user.id, subject, content, audience||'ALL', loyalty_level||null, scheduled_at||null]
      );
      res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/admin/email-campaigns/:id/send — enviar campaña
  router.post('/api/admin/email-campaigns/:id/send', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const campaign = await pool.query('SELECT * FROM email_campaigns WHERE id=$1', [req.params.id]);
      if (!campaign.rows[0]) return res.status(404).json({ error:'Campaña no encontrada' });
      const c = campaign.rows[0];

      // Obtener destinatarios
      let query = 'SELECT email, name FROM email_subscribers WHERE opted_in=TRUE';
      const params = [];
      if (c.audience === 'BUYERS') {
        query = `SELECT es.email, es.name FROM email_subscribers es JOIN users u ON u.id=es.user_id WHERE es.opted_in=TRUE AND u.role='COMPRADOR'`;
      } else if (c.audience === 'SELLERS') {
        query = `SELECT es.email, es.name FROM email_subscribers es JOIN users u ON u.id=es.user_id WHERE es.opted_in=TRUE AND u.role='VENDEDOR'`;
      } else if (c.audience === 'VIP') {
        query = `SELECT es.email, es.name FROM email_subscribers es JOIN user_scores us ON us.user_id=es.user_id WHERE es.opted_in=TRUE AND us.color='VERDE'`;
      }

      const subscribers = await pool.query(query, params);

      await pool.query("UPDATE email_campaigns SET status='SENDING' WHERE id=$1", [c.id]);

      // Enviar emails via SendGrid si está configurado
      const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
      let sent = 0;

      if (SENDGRID_KEY && SENDGRID_KEY !== 'SG.example') {
        for (const sub of subscribers.rows) {
          try {
            await fetch('https://api.sendgrid.com/v3/mail/send', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${SENDGRID_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: sub.email, name: sub.name }] }],
                from: { email: 'no-reply@futuradigital.tech', name: 'Futura Marketplace' },
                subject: c.subject,
                content: [{ type: 'text/html', value: `
                  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:20px">
                    <div style="background:#0D3B87;padding:20px;border-radius:12px 12px 0 0;text-align:center">
                      <h1 style="color:white;margin:0;font-size:24px">FUTURA MARKETPLACE</h1>
                    </div>
                    <div style="background:white;padding:30px;border-radius:0 0 12px 12px">
                      <p style="color:#334155;font-size:16px">Hola ${sub.name},</p>
                      <div style="color:#475569;font-size:15px;line-height:1.6">${c.content.replace(/\n/g,'<br>')}</div>
                      <div style="text-align:center;margin:24px 0">
                        <a href="https://content-intuition-production-e967.up.railway.app" style="background:#3B75C0;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700">Ver ofertas →</a>
                      </div>
                      <p style="color:#94a3b8;font-size:12px;text-align:center">Futura Marketplace — <a href="#" style="color:#3B75C0">Cancelar suscripción</a></p>
                    </div>
                  </div>` }]
              })
            });
            sent++;
          } catch(e) { console.error('[email]', e.message); }
        }
      } else {
        // Mock mode
        sent = subscribers.rows.length;
        console.log(`[EMAIL MOCK] Campaign "${c.subject}" → ${sent} destinatarios`);
      }

      await pool.query(
        "UPDATE email_campaigns SET status='SENT', sent_count=$1, sent_at=now() WHERE id=$2",
        [sent, c.id]
      );
      res.json({ ok:true, sent, mock: !SENDGRID_KEY });
    } catch(e) { console.error(e); res.status(500).json({ error:'Error interno' }); }
  });

  // GET /api/admin/email-subscribers — suscriptores
  router.get('/api/admin/email-subscribers', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT es.*, u.role FROM email_subscribers es
        LEFT JOIN users u ON u.id=es.user_id
        WHERE es.opted_in=TRUE ORDER BY es.opted_at DESC`);
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // ── SOCIAL MEDIA POSTS ──────────────────────────────────────

  // GET /api/admin/social-posts
  router.get('/api/admin/social-posts', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT sp.*, u.name AS admin_name FROM social_posts sp
         JOIN users u ON u.id=sp.admin_id ORDER BY sp.created_at DESC LIMIT 50`
      );
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/admin/social-posts — crear post
  router.post('/api/admin/social-posts', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { title, content, media_url, media_type, platforms, scheduled_at } = req.body;
      const r = await pool.query(
        `INSERT INTO social_posts(admin_id,title,content,media_url,media_type,platforms,scheduled_at,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.user.id, title, content, media_url||null, media_type||'IMAGE',
         platforms||['FACEBOOK','INSTAGRAM'], scheduled_at||null,
         scheduled_at ? 'SCHEDULED' : 'DRAFT']
      );
      res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/admin/social-posts/:id/publish — publicar en redes
  router.post('/api/admin/social-posts/:id/publish', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const post = await pool.query('SELECT * FROM social_posts WHERE id=$1', [req.params.id]);
      if (!post.rows[0]) return res.status(404).json({ error:'Post no encontrado' });
      const p = post.rows[0];
      const results = {};

      // Facebook (Meta Graph API)
      const FB_TOKEN = process.env.FB_PAGE_TOKEN;
      const FB_PAGE_ID = process.env.FB_PAGE_ID;
      if (FB_TOKEN && FB_PAGE_ID && p.platforms?.includes('FACEBOOK')) {
        try {
          const fbRes = await fetch(`https://graph.facebook.com/v18.0/${FB_PAGE_ID}/feed`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ message: `${p.title}\n\n${p.content}`, access_token: FB_TOKEN })
          });
          const fbData = await fbRes.json();
          results.facebook = fbData.id || 'published';
        } catch(e) { results.facebook = 'error: '+e.message; }
      } else {
        results.facebook = 'mock_published';
        console.log(`[FB MOCK] Post: "${p.title}"`);
      }

      // TikTok (TikTok Business API)
      const TT_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
      if (TT_TOKEN && p.platforms?.includes('TIKTOK')) {
        results.tiktok = 'mock_published'; // TikTok requiere video
        console.log(`[TT MOCK] Post: "${p.title}"`);
      } else if (p.platforms?.includes('TIKTOK')) {
        results.tiktok = 'mock_published';
      }

      await pool.query(
        `UPDATE social_posts SET status='PUBLISHED', published_at=now(),
         fb_post_id=$1, tt_post_id=$2 WHERE id=$3`,
        [results.facebook||null, results.tiktok||null, p.id]
      );

      res.json({ ok:true, results, mock: !FB_TOKEN });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // GET /api/admin/social-metrics — métricas de redes
  router.get('/api/admin/social-metrics', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT DISTINCT ON (platform) * FROM social_metrics ORDER BY platform, recorded_at DESC`
      );
      const posts = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE status='PUBLISHED') AS published,
                COUNT(*) FILTER (WHERE status='SCHEDULED') AS scheduled,
                COALESCE(SUM(likes),0) AS total_likes,
                COALESCE(SUM(shares),0) AS total_shares,
                COALESCE(SUM(reach),0) AS total_reach
         FROM social_posts`
      );
      const campaigns = await pool.query(
        `SELECT COUNT(*) AS total, COALESCE(SUM(sent_count),0) AS total_sent,
                COUNT(*) FILTER (WHERE status='SENT') AS sent FROM email_campaigns`
      );
      res.json({
        platforms: r.rows,
        posts: posts.rows[0],
        campaigns: campaigns.rows[0],
      });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/admin/social-metrics/update — actualizar métricas manualmente
  router.post('/api/admin/social-metrics/update', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { platform, followers, reach_7d, impressions_7d, engagement_rate } = req.body;
      await pool.query(
        `INSERT INTO social_metrics(platform,followers,reach_7d,impressions_7d,engagement_rate)
         VALUES($1,$2,$3,$4,$5)`,
        [platform, followers||0, reach_7d||0, impressions_7d||0, engagement_rate||0]
      );
      res.json({ ok:true });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  return router;
};
