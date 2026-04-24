// backend/routes/phase5.js — Legal, Riesgo, Referidos, Multiidioma
// INSTRUCCION server.js:
//   const phase5 = require('./routes/phase5');
//   app.use(phase5(pool, auth, role, notify));

module.exports = function(pool, auth, roleMiddleware, notify) {
  const express = require('express');
  const router  = express.Router();

  // ── CONSULTA DE RIESGO CREDITICIO ─────────────────────────

  router.post('/api/admin/credits/risk-check', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { buyer_id, credit_id, doc_number } = req.body;
      if (!doc_number) return res.status(400).json({ error:'DNI/RUC requerido' });

      // Historial interno Futura
      const history = await pool.query(`
        SELECT
          COUNT(ci.id) FILTER (WHERE ci.status='VENCIDO') AS overdue,
          COUNT(ci.id) FILTER (WHERE ci.status='PAGADO') AS paid_on_time,
          COUNT(DISTINCT ca.id) AS total_credits,
          COALESCE(SUM(ca.amount) FILTER (WHERE ca.status='ACTIVO'),0) AS active_debt
        FROM credit_installments ci
        JOIN credit_applications ca ON ca.id=ci.credit_id
        WHERE ca.buyer_id=$1`, [buyer_id]
      );
      const h = history.rows[0];

      // Calcular riesgo interno
      let riskLevel = 'BAJO';
      let infocorpScore = 800;
      let sbsStatus = 'NORMAL';
      let notes = '';

      if (parseInt(h.overdue) >= 3) { riskLevel = 'ALTO'; infocorpScore = 400; sbsStatus = 'DEFICIENTE'; notes = '3+ cuotas vencidas en Futura.'; }
      else if (parseInt(h.overdue) >= 1) { riskLevel = 'MEDIO'; infocorpScore = 600; sbsStatus = 'CON PROBLEMAS'; notes = '1-2 cuotas vencidas.'; }
      else if (parseInt(h.paid_on_time) >= 5) { riskLevel = 'BAJO'; infocorpScore = 900; sbsStatus = 'NORMAL'; notes = 'Excelente historial.'; }

      // Mock de consulta externa (en producción conectar a SBS API real)
      const mockResponse = {
        doc_number, provider: 'MOCK_SBS_INFOCORP',
        score: infocorpScore, status: sbsStatus,
        internal_history: h,
        note: 'Consulta en modo simulación. Configura SBS_API_KEY para consulta real.'
      };

      const r = await pool.query(
        `INSERT INTO credit_risk_checks(buyer_id,credit_id,checked_by,doc_number,infocorp_score,sbs_status,risk_level,total_debt,default_count,response_data,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [buyer_id, credit_id||null, req.user.id, doc_number, infocorpScore, sbsStatus, riskLevel,
         h.active_debt, h.overdue, JSON.stringify(mockResponse), notes]
      );

      // Actualizar riesgo en la solicitud de crédito
      if (credit_id) {
        await pool.query('UPDATE credit_applications SET risk_level=$1, credit_score=$2 WHERE id=$3',
          [riskLevel, infocorpScore, credit_id]);
      }

      res.json({ ok:true, risk: r.rows[0], summary: mockResponse });
    } catch(e) { console.error(e); res.status(500).json({ error:'Error interno' }); }
  });

  router.get('/api/admin/credits/risk-history/:buyerId', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT cr.*, u.name AS checked_by_name FROM credit_risk_checks cr
         JOIN users u ON u.id=cr.checked_by WHERE cr.buyer_id=$1
         ORDER BY cr.checked_at DESC`, [req.params.buyerId]
      );
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // ── REFERIDOS ──────────────────────────────────────────────

  router.get('/api/buyer/referral-code', auth, async (req, res) => {
    try {
      let r = await pool.query('SELECT * FROM referrals WHERE referrer_id=$1 AND status=\'ACTIVO\'', [req.user.id]);
      if (!r.rows[0]) {
        const code = require('crypto').randomBytes(4).toString('hex').toUpperCase();
        r = await pool.query(
          'INSERT INTO referrals(referrer_id,referral_code,status) VALUES($1,$2,\'ACTIVO\') ON CONFLICT DO NOTHING RETURNING *',
          [req.user.id, code]
        );
        r = await pool.query('SELECT * FROM referrals WHERE referrer_id=$1', [req.user.id]);
      }
      const stats = await pool.query(
        `SELECT COUNT(*) AS total_referred, COUNT(*) FILTER (WHERE status='RECOMPENSADO') AS rewarded,
                COALESCE(SUM(reward_points) FILTER (WHERE status='RECOMPENSADO'),0) AS total_points
         FROM referrals WHERE referrer_id=$1`, [req.user.id]
      );
      res.json({ referral: r.rows[0], stats: stats.rows[0] });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  router.post('/api/referral/register', async (req, res) => {
    try {
      const { referral_code } = req.body;
      const ref = await pool.query('SELECT * FROM referrals WHERE referral_code=$1 AND status=\'ACTIVO\'', [referral_code]);
      if (!ref.rows[0]) return res.status(404).json({ error:'Código de referido inválido' });
      res.json({ ok:true, referrer_id: ref.rows[0].referrer_id, code: referral_code });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // GET /api/admin/referrals — admin ve todos los referidos
  router.get('/api/admin/referrals', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT rf.*, u.name AS referrer_name, u.email AS referrer_email,
               r.name AS referred_name
        FROM referrals rf
        JOIN users u ON u.id=rf.referrer_id
        LEFT JOIN users r ON r.id=rf.referred_id
        ORDER BY rf.created_at DESC`);
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // ── IDIOMA / LANGUAGE ──────────────────────────────────────

  router.get('/api/user/language', auth, async (req, res) => {
    try {
      const r = await pool.query('SELECT language FROM language_settings WHERE user_id=$1', [req.user.id]);
      res.json({ language: r.rows[0]?.language || 'es' });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  router.post('/api/user/language', auth, async (req, res) => {
    try {
      const { language } = req.body;
      if (!['es','en','zh'].includes(language)) return res.status(400).json({ error:'Idioma no soportado' });
      await pool.query(
        `INSERT INTO language_settings(user_id,language) VALUES($1,$2)
         ON CONFLICT(user_id) DO UPDATE SET language=$2, updated_at=now()`,
        [req.user.id, language]
      );
      res.json({ ok:true, language });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // ── COMPLIANCE DOCUMENTS ───────────────────────────────────

  router.get('/api/products/:id/compliance', async (req, res) => {
    try {
      const r = await pool.query(
        'SELECT * FROM compliance_documents WHERE product_id=$1 ORDER BY doc_type',
        [req.params.id]
      );
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  router.post('/api/admin/compliance', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { product_id, doc_type, title, file_url, valid_until, notes } = req.body;
      const r = await pool.query(
        'INSERT INTO compliance_documents(product_id,doc_type,title,file_url,valid_until,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [product_id, doc_type, title, file_url||null, valid_until||null, notes]
      );
      res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // ── ADMIN ACTIVITY LOG ────────────────────────────────────

  router.get('/api/admin/activity-log', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT al.*, u.name AS admin_name FROM admin_activity_log al
        JOIN users u ON u.id=al.admin_id
        ORDER BY al.created_at DESC LIMIT 100`);
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // Middleware para logear acciones del admin (agregar en server.js)
  router.use('/api/admin', auth, async (req, res, next) => {
    if (req.user?.role === 'ADMIN' && req.method !== 'GET') {
      pool.query(
        'INSERT INTO admin_activity_log(admin_id,action,description,ip_address) VALUES($1,$2,$3,$4)',
        [req.user.id, `${req.method} ${req.path}`, JSON.stringify(req.body).substring(0,200), req.ip]
      ).catch(()=>{});
    }
    next();
  });

  return router;
};
