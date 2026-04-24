// backend/routes/phase1.js
// ============================================================
// FUTURA v5.0 FASE 1 — Ofertas, Créditos, Semáforo, Fidelidad
// ============================================================
// INSTRUCCION server.js:
//   const phase1 = require('./routes/phase1');
//   app.use(phase1(pool, auth, role, notify));
// ============================================================

module.exports = function(pool, auth, roleMiddleware, notify) {
  const express = require('express');
  const router  = express.Router();

  // ── HELPERS ─────────────────────────────────────────────────
  const calcMonthlyPayment = (amount, months, tea) => {
    const tem = Math.pow(1 + tea/100, 1/12) - 1;
    const pmt = amount * tem / (1 - Math.pow(1+tem, -months));
    return Math.ceil(pmt * 100) / 100;
  };

  const recalcScore = async (userId) => {
    try {
      const r = await pool.query('SELECT * FROM calculate_user_score($1)', [userId]);
      if (r.rows[0]) {
        await pool.query(
          `INSERT INTO user_scores(user_id,score,color,last_calculated,notes)
           VALUES($1,$2,$3,now(),$4)
           ON CONFLICT(user_id) DO UPDATE SET score=$2,color=$3,last_calculated=now(),notes=$4,updated_at=now()`,
          [userId, r.rows[0].score, r.rows[0].color, r.rows[0].notes]
        );
      }
    } catch(e) { console.error('[score]', e.message); }
  };

  // ══════════════════════════════════════════════════════════
  // OFERTAS DE VENDEDORES
  // ══════════════════════════════════════════════════════════

  // GET /api/offers — listar ofertas aprobadas (público)
  router.get('/api/offers', async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT vo.*, u.name AS seller_name, sp.business_name,
               p.title AS product_title, fm.name AS machine_name
        FROM vendor_offers vo
        JOIN users u ON u.id = vo.seller_id
        LEFT JOIN seller_profiles sp ON sp.user_id = vo.seller_id
        LEFT JOIN products p ON p.id = vo.product_id
        LEFT JOIN futura_machines fm ON fm.id = vo.machine_id
        WHERE vo.status = 'APROBADA'
          AND (vo.valid_until IS NULL OR vo.valid_until > now())
        ORDER BY vo.created_at DESC LIMIT 20`);
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // GET /api/vendor/offers — mis ofertas (vendedor)
  router.get('/api/vendor/offers', auth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT vo.*, p.title AS product_title, fm.name AS machine_name
         FROM vendor_offers vo
         LEFT JOIN products p ON p.id = vo.product_id
         LEFT JOIN futura_machines fm ON fm.id = vo.machine_id
         WHERE vo.seller_id = $1 ORDER BY vo.created_at DESC`,
        [req.user.id]
      );
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/vendor/offers — crear oferta
  router.post('/api/vendor/offers', auth, async (req, res) => {
    try {
      const { title, description, discount_pct, offer_type, target_audience, machine_id, product_id, image_url, valid_from, valid_until } = req.body;
      const r = await pool.query(
        `INSERT INTO vendor_offers(seller_id,title,description,discount_pct,offer_type,target_audience,machine_id,product_id,image_url,valid_from,valid_until,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDIENTE') RETURNING *`,
        [req.user.id, title, description, discount_pct||0, offer_type||'DESCUENTO', target_audience||'TODOS', machine_id||null, product_id||null, image_url||null, valid_from||null, valid_until||null]
      );
      // Notificar al admin
      const admins = await pool.query("SELECT id FROM users WHERE role='ADMIN'");
      for (const a of admins.rows) {
        await notify(a.id, 'NUEVA_OFERTA', '🏷️ Nueva oferta pendiente', `Un vendedor envió una oferta para aprobación: "${title}"`, '/admin/offers').catch(()=>{});
      }
      res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // GET /api/admin/offers — admin ve todas las ofertas
  router.get('/api/admin/offers', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT vo.*, u.name AS seller_name, sp.business_name,
               p.title AS product_title, fm.name AS machine_name,
               a.name AS approved_by_name
        FROM vendor_offers vo
        JOIN users u ON u.id = vo.seller_id
        LEFT JOIN seller_profiles sp ON sp.user_id = vo.seller_id
        LEFT JOIN products p ON p.id = vo.product_id
        LEFT JOIN futura_machines fm ON fm.id = vo.machine_id
        LEFT JOIN users a ON a.id = vo.approved_by
        ORDER BY CASE vo.status WHEN 'PENDIENTE' THEN 1 WHEN 'APROBADA' THEN 2 ELSE 3 END, vo.created_at DESC`);
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/admin/offers/:id/approve — aprobar oferta
  router.post('/api/admin/offers/:id/approve', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { action, notes } = req.body; // action: 'APROBADA' | 'RECHAZADA'
      const r = await pool.query(
        `UPDATE vendor_offers SET status=$1, admin_notes=$2, approved_by=$3, approved_at=now()
         WHERE id=$4 RETURNING *, seller_id`,
        [action, notes, req.user.id, req.params.id]
      );
      const offer = r.rows[0];
      if (!offer) return res.status(404).json({ error:'Oferta no encontrada' });

      // Notificar al vendedor
      await notify(offer.seller_id, 'OFERTA_' + action,
        action === 'APROBADA' ? '✅ Oferta aprobada' : '❌ Oferta rechazada',
        action === 'APROBADA'
          ? `Tu oferta "${offer.title}" fue aprobada y ya está visible para los compradores.`
          : `Tu oferta "${offer.title}" fue rechazada. Motivo: ${notes||'Sin motivo especificado'}`,
        '/vendor/offers'
      ).catch(()=>{});

      // Si se aprobó: notificar a compradores según audiencia
      if (action === 'APROBADA') {
        let query = "SELECT id FROM users WHERE role='COMPRADOR' AND status='ACTIVO'";
        if (offer.target_audience === 'VIP') {
          query = `SELECT DISTINCT u.id FROM users u JOIN user_scores us ON us.user_id=u.id WHERE u.role='COMPRADOR' AND us.color='VERDE'`;
        }
        const buyers = await pool.query(query);
        for (const b of buyers.rows) {
          await notify(b.id, 'NUEVA_OFERTA_COMPRADOR', `🏷️ Nueva oferta: ${offer.title}`,
            `${offer.description||''} ${offer.discount_pct>0?`Descuento: ${offer.discount_pct}%`:''}`,
            '/offers'
          ).catch(()=>{});
        }
      }
      res.json({ ok:true });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // ══════════════════════════════════════════════════════════
  // SISTEMA DE CRÉDITOS
  // ══════════════════════════════════════════════════════════

  // POST /api/credits/apply — solicitar crédito
  router.post('/api/credits/apply', auth, async (req, res) => {
    try {
      const { product_id, machine_id, amount, initial_payment, installments, purpose } = req.body;
      if (!amount || !installments) return res.status(400).json({ error:'Monto y cuotas requeridos' });

      const tea = 18.00; // configurable
      const netAmount = parseFloat(amount) - parseFloat(initial_payment||0);
      const monthly = calcMonthlyPayment(netAmount, installments, tea);
      const total = monthly * installments + parseFloat(initial_payment||0);

      const r = await pool.query(
        `INSERT INTO credit_applications(buyer_id,product_id,machine_id,amount,initial_payment,installments,tea_rate,monthly_payment,total_with_interest,purpose)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [req.user.id, product_id||null, machine_id||null, amount, initial_payment||0, installments, tea, monthly.toFixed(2), total.toFixed(2), purpose]
      );

      // Notificar admin
      const admins = await pool.query("SELECT id FROM users WHERE role='ADMIN'");
      for (const a of admins.rows) {
        await notify(a.id, 'CREDITO_SOLICITADO', '💳 Nueva solicitud de crédito',
          `Solicitud de S/ ${amount} a ${installments} cuotas (cuota: S/ ${monthly.toFixed(2)}/mes)`, '/admin/credits'
        ).catch(()=>{});
      }
      res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // GET /api/credits/simulate — simulador de crédito (sin auth)
  router.get('/api/credits/simulate', async (req, res) => {
    try {
      const { amount, installments, initial } = req.query;
      const tea = 18.00;
      const net = parseFloat(amount||0) - parseFloat(initial||0);
      const monthly = calcMonthlyPayment(net, parseInt(installments||12), tea);
      const total = monthly * parseInt(installments||12) + parseFloat(initial||0);
      res.json({
        amount: parseFloat(amount||0),
        initial: parseFloat(initial||0),
        net_amount: net,
        installments: parseInt(installments||12),
        monthly_payment: parseFloat(monthly.toFixed(2)),
        total_with_interest: parseFloat(total.toFixed(2)),
        tea_rate: tea,
        interest_total: parseFloat((total - parseFloat(amount||0)).toFixed(2)),
      });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // GET /api/buyer/credits — mis créditos
  router.get('/api/buyer/credits', auth, async (req, res) => {
    try {
      const credits = await pool.query(
        `SELECT ca.*, p.title AS product_title, fm.name AS machine_name
         FROM credit_applications ca
         LEFT JOIN products p ON p.id = ca.product_id
         LEFT JOIN futura_machines fm ON fm.id = ca.machine_id
         WHERE ca.buyer_id=$1 ORDER BY ca.created_at DESC`,
        [req.user.id]
      );
      for (const c of credits.rows) {
        const inst = await pool.query('SELECT * FROM credit_installments WHERE credit_id=$1 ORDER BY installment_num', [c.id]);
        c.installments_list = inst.rows;
      }
      res.json(credits.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // GET /api/admin/credits — admin ve todos los créditos
  router.get('/api/admin/credits', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT ca.*, u.name AS buyer_name, u.email, u.phone,
               p.title AS product_title, fm.name AS machine_name,
               us.color AS traffic_light, us.score,
               COUNT(ci.id) FILTER (WHERE ci.status='VENCIDO') AS overdue_installments,
               COUNT(ci.id) FILTER (WHERE ci.status='PAGADO') AS paid_installments,
               COUNT(ci.id) AS total_installments
        FROM credit_applications ca
        JOIN users u ON u.id = ca.buyer_id
        LEFT JOIN products p ON p.id = ca.product_id
        LEFT JOIN futura_machines fm ON fm.id = ca.machine_id
        LEFT JOIN user_scores us ON us.user_id = ca.buyer_id
        LEFT JOIN credit_installments ci ON ci.credit_id = ca.id
        GROUP BY ca.id, u.name, u.email, u.phone, p.title, fm.name, us.color, us.score
        ORDER BY CASE ca.status WHEN 'PENDIENTE' THEN 1 WHEN 'ACTIVO' THEN 2 ELSE 3 END, ca.created_at DESC`);
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/admin/credits/:id/review — aprobar/rechazar crédito
  router.post('/api/admin/credits/:id/review', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { action, notes, tea_rate } = req.body;
      const credit = await pool.query('SELECT * FROM credit_applications WHERE id=$1', [req.params.id]);
      if (!credit.rows[0]) return res.status(404).json({ error:'Crédito no encontrado' });
      const c = credit.rows[0];

      const newTea = parseFloat(tea_rate||c.tea_rate);
      const net = parseFloat(c.amount) - parseFloat(c.initial_payment||0);
      const monthly = calcMonthlyPayment(net, c.installments, newTea);
      const total = monthly * c.installments + parseFloat(c.initial_payment||0);

      await pool.query(
        `UPDATE credit_applications SET status=$1, admin_notes=$2, reviewed_by=$3, reviewed_at=now(),
         tea_rate=$4, monthly_payment=$5, total_with_interest=$6
         ${action === 'APROBADO' ? ', approved_at=now()' : ''}
         WHERE id=$7`,
        [action, notes, req.user.id, newTea, monthly.toFixed(2), total.toFixed(2), c.id]
      );

      // Si aprobado: crear cuotas
      if (action === 'APROBADO') {
        const start = new Date();
        for (let i=1; i<=c.installments; i++) {
          const dueDate = new Date(start);
          dueDate.setMonth(dueDate.getMonth() + i);
          await pool.query(
            'INSERT INTO credit_installments(credit_id,installment_num,amount,due_date) VALUES($1,$2,$3,$4)',
            [c.id, i, monthly.toFixed(2), dueDate.toISOString().split('T')[0]]
          );
        }
        await pool.query("UPDATE credit_applications SET status='ACTIVO' WHERE id=$1", [c.id]);
      }

      await notify(c.buyer_id, 'CREDITO_'+action,
        action==='APROBADO' ? '✅ Crédito aprobado' : '❌ Crédito rechazado',
        action==='APROBADO'
          ? `Tu crédito de S/ ${c.amount} fue aprobado. Cuota mensual: S/ ${monthly.toFixed(2)} por ${c.installments} meses.`
          : `Tu solicitud de crédito fue rechazada. ${notes||''}`,
        '/buyer/credits'
      ).catch(()=>{});

      res.json({ ok:true });
    } catch(e) { console.error(e); res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/credits/installments/:id/pay — registrar pago de cuota
  router.post('/api/credits/installments/:id/pay', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { payment_method, reference } = req.body;
      const inst = await pool.query(
        `UPDATE credit_installments SET status='PAGADO', paid_at=now(), payment_method=$1
         WHERE id=$2 RETURNING *, credit_id`,
        [payment_method||'EFECTIVO', req.params.id]
      );
      if (!inst.rows[0]) return res.status(404).json({ error:'Cuota no encontrada' });

      const credit = await pool.query('SELECT * FROM credit_applications WHERE id=$1', [inst.rows[0].credit_id]);
      const buyer_id = credit.rows[0]?.buyer_id;

      // Verificar si es puntual y dar puntos extra
      const wasOnTime = new Date() <= new Date(inst.rows[0].due_date + 'T23:59:59');
      if (wasOnTime && buyer_id) {
        await pool.query(
          "INSERT INTO loyalty_points(user_id,points,type,description) VALUES($1,10,'BONUS','Pago puntual de cuota')",
          [buyer_id]
        ).catch(()=>{});
        await notify(buyer_id, 'PAGO_PUNTUAL', '⭐ +10 puntos por pago puntual',
          'Gracias por tu pago a tiempo. Acumulaste 10 puntos extra de fidelidad.', '/buyer/credits'
        ).catch(()=>{});
      }

      // Verificar si todas las cuotas están pagadas
      const pending = await pool.query(
        "SELECT COUNT(*) FROM credit_installments WHERE credit_id=$1 AND status!='PAGADO'",
        [inst.rows[0].credit_id]
      );
      if (parseInt(pending.rows[0].count) === 0) {
        await pool.query("UPDATE credit_applications SET status='PAGADO' WHERE id=$1", [inst.rows[0].credit_id]);
        if (buyer_id) await notify(buyer_id, 'CREDITO_PAGADO', '🎉 Crédito pagado completamente',
          'Has completado el pago de tu crédito. Eres elegible para mejores condiciones en tu próxima solicitud.', '/buyer/credits'
        ).catch(()=>{});
      }

      // Recalcular score
      if (buyer_id) await recalcScore(buyer_id);

      res.json({ ok:true, on_time: wasOnTime });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // ══════════════════════════════════════════════════════════
  // SEMÁFORO
  // ══════════════════════════════════════════════════════════

  // GET /api/admin/semaforo — semáforo de todos los usuarios
  router.get('/api/admin/semaforo', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const buyers = await pool.query(`
        SELECT * FROM buyer_loyalty_view ORDER BY score DESC`);
      const sellers = await pool.query(`
        SELECT u.id, u.name, u.email, u.phone, sp.business_name,
               COALESCE(us.score,50) AS score, COALESCE(us.color,'AMARILLO') AS traffic_light,
               COUNT(DISTINCT p.id) AS total_products,
               COUNT(DISTINCT o.id) FILTER (WHERE o.status='ENTREGADA') AS total_sales,
               COALESCE(SUM(oi.net) FILTER (WHERE o.status='ENTREGADA'),0) AS total_revenue,
               AVG(r.rating)::NUMERIC(3,2) AS avg_rating
        FROM users u
        LEFT JOIN seller_profiles sp ON sp.user_id = u.id
        LEFT JOIN user_scores us ON us.user_id = u.id
        LEFT JOIN products p ON p.seller_id = u.id AND p.active=TRUE
        LEFT JOIN order_items oi ON oi.seller_id = u.id
        LEFT JOIN orders o ON o.id = oi.order_id
        LEFT JOIN reviews r ON r.seller_id = u.id
        WHERE u.role = 'VENDEDOR'
        GROUP BY u.id, u.name, u.email, u.phone, sp.business_name, us.score, us.color
        ORDER BY COALESCE(us.score,50) DESC`);
      res.json({ buyers: buyers.rows, sellers: sellers.rows });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/admin/semaforo/:userId/recalc — recalcular score de un usuario
  router.post('/api/admin/semaforo/:userId/recalc', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      await recalcScore(parseInt(req.params.userId));
      const r = await pool.query('SELECT * FROM user_scores WHERE user_id=$1', [req.params.userId]);
      res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/admin/semaforo/recalc-all — recalcular todos los scores
  router.post('/api/admin/semaforo/recalc-all', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const users = await pool.query("SELECT id FROM users WHERE role IN ('COMPRADOR','VENDEDOR')");
      for (const u of users.rows) await recalcScore(u.id);
      res.json({ ok:true, recalculated: users.rows.length });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // ══════════════════════════════════════════════════════════
  // FIDELIDAD POR AÑOS
  // ══════════════════════════════════════════════════════════

  // GET /api/loyalty/levels — niveles de fidelidad
  router.get('/api/loyalty/levels', async (req, res) => {
    try {
      const r = await pool.query('SELECT * FROM loyalty_levels ORDER BY min_months');
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // GET /api/buyer/loyalty-status — mi estado de fidelidad
  router.get('/api/buyer/loyalty-status', auth, async (req, res) => {
    try {
      const r = await pool.query('SELECT * FROM buyer_loyalty_view WHERE buyer_id=$1', [req.user.id]);
      res.json(r.rows[0] || null);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/admin/loyalty/send-benefits — enviar beneficios de fidelidad a un comprador
  router.post('/api/admin/loyalty/send-benefits', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { buyer_id, message, points_bonus } = req.body;
      if (points_bonus > 0) {
        await pool.query(
          "INSERT INTO loyalty_points(user_id,points,type,description) VALUES($1,$2,'BONUS',$3)",
          [buyer_id, points_bonus, 'Beneficio especial de fidelidad']
        );
      }
      await notify(buyer_id, 'BENEFICIO_FIDELIDAD', '🎁 Beneficio especial para ti',
        message || 'El equipo de Futura Marketplace te envía un beneficio especial por tu fidelidad.',
        '/buyer/loyalty'
      );
      res.json({ ok:true });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // ══════════════════════════════════════════════════════════
  // ALERTAS AUTOMÁTICAS DE CUOTAS (cron-like endpoint)
  // ══════════════════════════════════════════════════════════

  // POST /api/admin/credits/check-alerts — revisar cuotas próximas a vencer
  router.post('/api/admin/credits/check-alerts', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      let sent = 0;

      // Cuotas que vencen en 7 días
      const in7 = await pool.query(`
        SELECT ci.*, ca.buyer_id, u.name AS buyer_name, u.phone
        FROM credit_installments ci
        JOIN credit_applications ca ON ca.id = ci.credit_id
        JOIN users u ON u.id = ca.buyer_id
        WHERE ci.status='PENDIENTE' AND ci.alert_7d_sent=FALSE
          AND ci.due_date = CURRENT_DATE + 7`);
      for (const i of in7.rows) {
        await notify(i.buyer_id, 'CUOTA_7_DIAS', '⏰ Tu cuota vence en 7 días',
          `Tu cuota #${i.installment_num} de S/ ${i.amount} vence el ${i.due_date}. No olvides realizar el pago a tiempo.`, '/buyer/credits'
        ).catch(()=>{});
        await pool.query('UPDATE credit_installments SET alert_7d_sent=TRUE WHERE id=$1', [i.id]);
        sent++;
      }

      // Cuotas que vencen en 3 días
      const in3 = await pool.query(`
        SELECT ci.*, ca.buyer_id, u.name AS buyer_name
        FROM credit_installments ci
        JOIN credit_applications ca ON ca.id = ci.credit_id
        JOIN users u ON u.id = ca.buyer_id
        WHERE ci.status='PENDIENTE' AND ci.alert_3d_sent=FALSE
          AND ci.due_date = CURRENT_DATE + 3`);
      for (const i of in3.rows) {
        await notify(i.buyer_id, 'CUOTA_3_DIAS', '🔔 Tu cuota vence en 3 días',
          `URGENTE: Tu cuota #${i.installment_num} de S/ ${i.amount} vence el ${i.due_date}. Pago puntual = +10 pts fidelidad.`, '/buyer/credits'
        ).catch(()=>{});
        await pool.query('UPDATE credit_installments SET alert_3d_sent=TRUE WHERE id=$1', [i.id]);
        sent++;
      }

      // Cuotas vencidas hoy — marcar como VENCIDO
      const overdue = await pool.query(`
        UPDATE credit_installments SET status='VENCIDO'
        WHERE status='PENDIENTE' AND due_date < CURRENT_DATE
        RETURNING credit_id, (SELECT buyer_id FROM credit_applications WHERE id=credit_id)`);
      for (const i of overdue.rows) {
        if (i.buyer_id) await recalcScore(i.buyer_id);
      }

      res.json({ ok:true, alerts_sent: sent, overdue_marked: overdue.rows.length });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  return router;
};
