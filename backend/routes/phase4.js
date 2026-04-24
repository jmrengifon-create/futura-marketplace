// backend/routes/phase4.js — Personal Técnico & Reportes
// INSTRUCCION server.js:
//   const phase4 = require('./routes/phase4');
//   app.use(phase4(pool, auth, role, notify));

module.exports = function(pool, auth, roleMiddleware, notify) {
  const express = require('express');
  const router  = express.Router();

  // ── PANEL DE TÉCNICOS ──────────────────────────────────────

  router.get('/api/admin/technicians', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query('SELECT * FROM technician_panel ORDER BY status, name');
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  router.post('/api/admin/technicians', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { user_id, specialties, phone, emergency_contact, emergency_phone } = req.body;
      // Crear usuario si es necesario o usar existente
      const r = await pool.query(
        `INSERT INTO technicians(user_id,specialties,phone,emergency_contact,emergency_phone)
         VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET specialties=$2,phone=$3 RETURNING *`,
        [user_id, specialties||[], phone, emergency_contact, emergency_phone]
      );
      res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  router.put('/api/admin/technicians/:id/status', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { status, current_client, current_address, commission_destination, commission_return_date, permission_type, permission_until, next_available, notes } = req.body;
      await pool.query(
        `UPDATE technicians SET status=$1, current_client=$2, current_address=$3,
         commission_destination=$4, commission_return_date=$5,
         permission_type=$6, permission_until=$7, next_available=$8,
         notes=$9, updated_at=now() WHERE id=$10`,
        [status, current_client||null, current_address||null,
         commission_destination||null, commission_return_date||null,
         permission_type||null, permission_until||null, next_available||null,
         notes, req.params.id]
      );
      res.json({ ok:true });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // ── SERVICIOS TÉCNICOS ─────────────────────────────────────

  router.get('/api/admin/technical-services', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { status, technician_id } = req.query;
      let q = `SELECT ts.*, u.name AS technician_name, b.name AS buyer_name
               FROM technical_services ts
               JOIN technicians t ON t.id=ts.technician_id
               JOIN users u ON u.id=t.user_id
               LEFT JOIN users b ON b.id=ts.buyer_id WHERE 1=1`;
      const params = [];
      if (status) { params.push(status); q += ` AND ts.status=$${params.length}`; }
      if (technician_id) { params.push(technician_id); q += ` AND ts.technician_id=$${params.length}`; }
      q += ' ORDER BY ts.scheduled_at DESC LIMIT 100';
      const r = await pool.query(q, params);
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  router.post('/api/admin/technical-services', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { technician_id, buyer_id, buyer_machine_id, service_type, scheduled_at, client_name, client_address, client_phone, problem_reported, location_id } = req.body;
      const r = await pool.query(
        `INSERT INTO technical_services(technician_id,buyer_id,buyer_machine_id,service_type,scheduled_at,client_name,client_address,client_phone,problem_reported,location_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [technician_id, buyer_id||null, buyer_machine_id||null, service_type||'MANTENIMIENTO',
         scheduled_at||null, client_name, client_address, client_phone, problem_reported, location_id||null]
      );
      // Actualizar estado del técnico
      if (scheduled_at && new Date(scheduled_at) <= new Date()) {
        await pool.query("UPDATE technicians SET status='TRABAJANDO', current_client=$1, current_address=$2 WHERE id=$3",
          [client_name, client_address, technician_id]);
      }
      res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // POST /api/technical-services/:id/report — técnico registra informe
  router.post('/api/technical-services/:id/report', auth, async (req, res) => {
    try {
      const { diagnosis, solution_applied, parts_used, service_cost, parts_cost, client_signature } = req.body;
      const total = parseFloat(service_cost||0) + parseFloat(parts_cost||0);
      await pool.query(
        `UPDATE technical_services SET diagnosis=$1, solution_applied=$2, parts_used=$3,
         service_cost=$4, parts_cost=$5, total_cost=$6, client_signature=$7,
         status='COMPLETADO', completed_at=now() WHERE id=$8`,
        [diagnosis, solution_applied, parts_used, service_cost||0, parts_cost||0, total, client_signature||false, req.params.id]
      );
      // Liberar al técnico
      const svc = await pool.query('SELECT technician_id FROM technical_services WHERE id=$1', [req.params.id]);
      if (svc.rows[0]) {
        await pool.query("UPDATE technicians SET status='LIBRE', current_client=NULL, current_address=NULL, total_services=total_services+1 WHERE id=$1", [svc.rows[0].technician_id]);
      }
      res.json({ ok:true });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // GET /api/admin/technicians/stats — estadísticas de técnicos
  router.get('/api/admin/technicians/stats', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE t.status='TRABAJANDO') AS working,
          COUNT(*) FILTER (WHERE t.status='COMISION') AS on_commission,
          COUNT(*) FILTER (WHERE t.status='PERMISO') AS on_leave,
          COUNT(*) FILTER (WHERE t.status='LIBRE') AS available,
          COUNT(*) AS total
        FROM technicians t`);
      const topTech = await pool.query(`
        SELECT u.name, t.rating_avg, t.total_services, t.status
        FROM technicians t JOIN users u ON u.id=t.user_id
        ORDER BY t.total_services DESC LIMIT 5`);
      res.json({ counts: r.rows[0], top: topTech.rows });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  return router;
};
