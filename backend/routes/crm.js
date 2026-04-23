// backend/routes/crm.js
// ============================================================
// FUTURA CRM — Gestión de maquinaria y insumos por comprador
// ============================================================
// INSTRUCCION: Agregar en server.js:
//   const crmRouter = require('./routes/crm');
//   app.use(crmRouter(pool, auth, role, notify));
// ============================================================

module.exports = function(pool, auth, roleMiddleware, notify) {
  const express = require('express');
  const router  = express.Router();

  // ─── MÁQUINAS FUTURA (catálogo) ──────────────────────────

  // GET /api/admin/crm/machines — catálogo de máquinas
  router.get('/api/admin/crm/machines', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT fm.*,
          COUNT(DISTINCT fms.id) AS supply_count,
          COUNT(DISTINCT bm.id)  AS buyer_count
        FROM futura_machines fm
        LEFT JOIN futura_machine_supplies fms ON fms.machine_id = fm.id AND fms.active = TRUE
        LEFT JOIN buyer_machines bm ON bm.machine_id = fm.id
        WHERE fm.active = TRUE
        GROUP BY fm.id ORDER BY fm.category, fm.name`);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/admin/crm/machines/:id/supplies — insumos de una máquina
  router.get('/api/admin/crm/machines/:id/supplies', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(
        'SELECT * FROM futura_machine_supplies WHERE machine_id=$1 AND active=TRUE ORDER BY priority, supply_type',
        [req.params.id]
      );
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/admin/crm/machines — crear nueva máquina
  router.post('/api/admin/crm/machines', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { name, model, category, description, image_url } = req.body;
      const r = await pool.query(
        'INSERT INTO futura_machines(name,model,category,description,image_url) VALUES($1,$2,$3,$4,$5) RETURNING *',
        [name, model, category, description, image_url]
      );
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/admin/crm/machines/:id/supplies — agregar insumo a máquina
  router.post('/api/admin/crm/machines/:id/supplies', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { supply_type, name, description, frequency, priority, futura_exclusive, product_id } = req.body;
      const r = await pool.query(
        `INSERT INTO futura_machine_supplies(machine_id,supply_type,name,description,frequency,priority,futura_exclusive,product_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.params.id, supply_type, name, description, frequency, priority || 'NORMAL', futura_exclusive !== false, product_id || null]
      );
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // ─── CRM COMPRADORES ─────────────────────────────────────

  // GET /api/admin/crm/buyers — resumen CRM de todos los compradores
  router.get('/api/admin/crm/buyers', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query('SELECT * FROM buyer_crm_summary ORDER BY total_machines DESC, total_spent DESC');
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/admin/crm/buyers/:id — perfil CRM completo de un comprador
  router.get('/api/admin/crm/buyers/:id', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const [buyer, machines, orders, alerts] = await Promise.all([
        pool.query(`
          SELECT u.*, 
            COALESCE(SUM(o.total) FILTER (WHERE o.status='ENTREGADA'),0) AS total_spent,
            COUNT(DISTINCT o.id) AS total_orders,
            COUNT(DISTINCT bm.id) AS total_machines
          FROM users u
          LEFT JOIN orders o ON o.buyer_id = u.id
          LEFT JOIN buyer_machines bm ON bm.buyer_id = u.id
          WHERE u.id=$1 GROUP BY u.id`, [req.params.id]),
        pool.query(`
          SELECT bm.*, fm.name AS machine_name, fm.model, fm.category, fm.image_url,
            COUNT(bmsl.id) AS supply_logs,
            MAX(bmsl.logged_at) AS last_supply
          FROM buyer_machines bm
          JOIN futura_machines fm ON fm.id = bm.machine_id
          LEFT JOIN buyer_machine_supply_log bmsl ON bmsl.buyer_machine_id = bm.id
          WHERE bm.buyer_id=$1
          GROUP BY bm.id, fm.name, fm.model, fm.category, fm.image_url
          ORDER BY bm.status, bm.registered_at DESC`, [req.params.id]),
        pool.query(`
          SELECT o.*, COUNT(oi.id) AS items
          FROM orders o
          LEFT JOIN order_items oi ON oi.order_id = o.id
          WHERE o.buyer_id=$1
          GROUP BY o.id ORDER BY o.created_at DESC LIMIT 10`, [req.params.id]),
        pool.query(`
          SELECT ma.*, bm.serial_number, fm.name AS machine_name
          FROM machine_alerts ma
          JOIN buyer_machines bm ON bm.id = ma.buyer_machine_id
          JOIN futura_machines fm ON fm.id = bm.machine_id
          WHERE bm.buyer_id=$1 AND ma.resolved=FALSE
          ORDER BY ma.due_date ASC NULLS LAST`, [req.params.id]),
      ]);
      res.json({
        buyer: buyer.rows[0],
        machines: machines.rows,
        orders: orders.rows,
        alerts: alerts.rows,
      });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/admin/crm/buyers/:id/machines — registrar máquina a comprador
  router.post('/api/admin/crm/buyers/:id/machines', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { machine_id, serial_number, purchase_date, warranty_until, location, notes, order_id } = req.body;
      const r = await pool.query(
        `INSERT INTO buyer_machines(buyer_id,machine_id,serial_number,purchase_date,warranty_until,location,notes,order_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.params.id, machine_id, serial_number, purchase_date || null, warranty_until || null, location, notes, order_id || null]
      );
      // Crear alertas automáticas de mantenimiento
      const machine = await pool.query('SELECT * FROM futura_machines WHERE id=$1', [machine_id]);
      const supplies = await pool.query(
        "SELECT * FROM futura_machine_supplies WHERE machine_id=$1 AND priority IN ('CRITICO','ALTO') AND active=TRUE",
        [machine_id]
      );
      const buyerMachineId = r.rows[0].id;
      for (const s of supplies.rows) {
        let dueDate = null;
        if (s.frequency === 'Mensual') dueDate = new Date(Date.now() + 30*24*60*60*1000);
        else if (s.frequency === 'Cada 3 meses') dueDate = new Date(Date.now() + 90*24*60*60*1000);
        else if (s.frequency === 'Cada 6 meses') dueDate = new Date(Date.now() + 180*24*60*60*1000);
        else if (s.frequency === 'Anual') dueDate = new Date(Date.now() + 365*24*60*60*1000);
        if (dueDate) {
          await pool.query(
            `INSERT INTO machine_alerts(buyer_machine_id,alert_type,title,message,due_date)
             VALUES($1,'INSUMO',$2,$3,$4)`,
            [buyerMachineId, `Reposición: ${s.name}`, `Tu ${machine.rows[0]?.name} necesita ${s.name}. Frecuencia: ${s.frequency}`, dueDate]
          ).catch(() => {});
        }
      }
      // Notificar al comprador
      await notify(req.params.id, 'MAQUINA_REGISTRADA', '🖨️ Máquina registrada',
        `Tu ${machine.rows[0]?.name} ha sido registrada en tu perfil Futura. Recibirás alertas de mantenimiento.`, '/profile'
      ).catch(() => {});
      res.json(r.rows[0]);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Error interno' }); }
  });

  // PUT /api/admin/crm/buyer-machines/:id — actualizar estado de máquina
  router.put('/api/admin/crm/buyer-machines/:id', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { status, serial_number, location, notes, last_service, next_service, warranty_until } = req.body;
      await pool.query(
        `UPDATE buyer_machines SET status=COALESCE($1,status), serial_number=COALESCE($2,serial_number),
         location=COALESCE($3,location), notes=COALESCE($4,notes),
         last_service=COALESCE($5,last_service), next_service=COALESCE($6,next_service),
         warranty_until=COALESCE($7,warranty_until) WHERE id=$8`,
        [status, serial_number, location, notes, last_service, next_service, warranty_until, req.params.id]
      );
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/admin/crm/buyer-machines/:id/supply-log — registrar insumo usado
  router.post('/api/admin/crm/buyer-machines/:id/supply-log', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { supply_id, supply_name, supply_type, quantity, notes, order_id } = req.body;
      await pool.query(
        `INSERT INTO buyer_machine_supply_log(buyer_machine_id,supply_id,supply_name,supply_type,quantity,notes,order_id,logged_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.params.id, supply_id || null, supply_name, supply_type, quantity || 1, notes, order_id || null, req.user.id]
      );
      // Actualizar last_service si es servicio técnico
      if (supply_type === 'SERVICIO') {
        await pool.query('UPDATE buyer_machines SET last_service=now() WHERE id=$1', [req.params.id]);
      }
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/admin/crm/alerts — todas las alertas pendientes
  router.get('/api/admin/crm/alerts', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT ma.*, bm.buyer_id, fm.name AS machine_name, fm.category,
          u.name AS buyer_name, u.phone AS buyer_phone, u.email AS buyer_email
        FROM machine_alerts ma
        JOIN buyer_machines bm ON bm.id = ma.buyer_machine_id
        JOIN futura_machines fm ON fm.id = bm.machine_id
        JOIN users u ON u.id = bm.buyer_id
        WHERE ma.resolved = FALSE
        ORDER BY ma.due_date ASC NULLS LAST`);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/admin/crm/alerts/:id/resolve — resolver alerta
  router.post('/api/admin/crm/alerts/:id/resolve', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      await pool.query('UPDATE machine_alerts SET resolved=TRUE, resolved_at=now() WHERE id=$1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/admin/crm/alerts/:id/send-wa — enviar alerta por WhatsApp
  router.post('/api/admin/crm/alerts/:id/send-wa', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const alert = await pool.query(`
        SELECT ma.*, u.phone, u.name AS buyer_name, fm.name AS machine_name
        FROM machine_alerts ma
        JOIN buyer_machines bm ON bm.id = ma.buyer_machine_id
        JOIN futura_machines fm ON fm.id = bm.machine_id
        JOIN users u ON u.id = bm.buyer_id
        WHERE ma.id=$1`, [req.params.id]);
      if (!alert.rows[0]) return res.status(404).json({ error: 'Alerta no encontrada' });
      const a = alert.rows[0];
      const msg = `Hola ${a.buyer_name}! 🖨️ *Futura Marketplace*\n\n📋 *${a.title}*\n${a.message}\n\n⏰ Fecha límite: ${a.due_date ? new Date(a.due_date).toLocaleDateString('es-PE') : 'Pronto'}\n\nAdquiere tus insumos originales Futura en:\nhttps://content-intuition-production-e967.up.railway.app`;
      const WA_PHONE_ID = process.env.WA_PHONE_ID;
      const WA_TOKEN    = process.env.WA_ACCESS_TOKEN;
      if (WA_PHONE_ID && WA_TOKEN && a.phone) {
        await fetch(`https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WA_TOKEN}` },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: a.phone, type: 'text', text: { body: msg } }),
        });
      } else {
        console.log(`[CRM WA MOCK] → ${a.phone}: ${msg.substring(0,80)}`);
      }
      await pool.query('UPDATE machine_alerts SET sent_wa=TRUE, sent_at=now() WHERE id=$1', [req.params.id]);
      res.json({ ok: true, mock: !WA_PHONE_ID });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/admin/crm/stats — estadísticas globales del CRM
  router.get('/api/admin/crm/stats', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const [machines, alerts, topBuyers, supplyDemand] = await Promise.all([
        pool.query(`SELECT fm.category, COUNT(bm.id) AS total FROM buyer_machines bm JOIN futura_machines fm ON fm.id=bm.machine_id WHERE bm.status='ACTIVA' GROUP BY fm.category ORDER BY total DESC`),
        pool.query(`SELECT COUNT(*) FILTER (WHERE due_date <= now()) AS overdue, COUNT(*) FILTER (WHERE due_date <= now()+interval'30 days' AND due_date > now()) AS upcoming, COUNT(*) AS total FROM machine_alerts WHERE resolved=FALSE`),
        pool.query(`SELECT u.name, u.email, COUNT(DISTINCT bm.id) AS machines, COALESCE(SUM(o.total) FILTER (WHERE o.status='ENTREGADA'),0) AS spent FROM users u JOIN buyer_machines bm ON bm.buyer_id=u.id LEFT JOIN orders o ON o.buyer_id=u.id WHERE u.role='COMPRADOR' GROUP BY u.id,u.name,u.email ORDER BY machines DESC,spent DESC LIMIT 5`),
        pool.query(`SELECT fms.supply_type, COUNT(bmsl.id) AS uses FROM buyer_machine_supply_log bmsl JOIN futura_machine_supplies fms ON fms.id=bmsl.supply_id GROUP BY fms.supply_type ORDER BY uses DESC`),
      ]);
      res.json({
        machinesByCategory: machines.rows,
        alerts: alerts.rows[0],
        topBuyers: topBuyers.rows,
        supplyDemand: supplyDemand.rows,
      });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
  });

  return router;
};
