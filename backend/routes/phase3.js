// backend/routes/phase3.js — Inventario, QR, Boletas
module.exports = function(pool, auth, roleMiddleware, notify) {
  const express = require('express');
  const router  = express.Router();

  // GET /api/locations
  router.get('/api/locations', async (req, res) => {
    try {
      const r = await pool.query('SELECT * FROM locations WHERE active=TRUE ORDER BY id');
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/admin/inventory/summary
  router.get('/api/admin/inventory/summary', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT l.id, l.name, l.city,
          COUNT(i.id) AS total_items,
          COALESCE(SUM(i.quantity), 0) AS total_stock,
          COUNT(CASE WHEN i.quantity <= i.min_quantity THEN 1 END) AS low_stock,
          COALESCE(SUM(i.quantity * i.unit_cost), 0) AS total_value
        FROM locations l
        LEFT JOIN inventory i ON i.location_id = l.id
        WHERE l.active = TRUE
        GROUP BY l.id, l.name, l.city ORDER BY l.id`);
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/admin/inventory
  router.get('/api/admin/inventory', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { location_id } = req.query;
      let sql = `SELECT i.*, l.name AS location_name FROM inventory i JOIN locations l ON l.id = i.location_id`;
      const params = [];
      if (location_id) { sql += ' WHERE i.location_id=$1'; params.push(location_id); }
      sql += ' ORDER BY i.created_at DESC';
      const r = await pool.query(sql, params);
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/admin/inventory
  router.post('/api/admin/inventory', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { location_id, item_name, item_type, quantity, min_quantity, unit_cost, unit_price } = req.body;
      if (!location_id || !item_name) return res.status(400).json({ error: 'Faltan datos requeridos' });
      const qr_code = 'QR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      const r = await pool.query(
        `INSERT INTO inventory(location_id,item_name,item_type,qr_code,quantity,min_quantity,unit_cost,unit_price,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,'DISPONIBLE') RETURNING *`,
        [location_id, item_name, item_type || 'PRODUCTO', qr_code, quantity || 0, min_quantity || 1, unit_cost || 0, unit_price || 0]
      );
      res.json(r.rows[0]);
    } catch(e) { console.error('[inventory POST]', e.message); res.status(500).json({ error: 'Error interno' }); }
  });

  // PUT /api/admin/inventory/:id
  router.put('/api/admin/inventory/:id', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { quantity, min_quantity, unit_cost, unit_price, status } = req.body;
      await pool.query(
        `UPDATE inventory SET quantity=$1,min_quantity=$2,unit_cost=$3,unit_price=$4,status=$5 WHERE id=$6`,
        [quantity, min_quantity, unit_cost, unit_price, status || 'DISPONIBLE', req.params.id]
      );
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ error: 'Error interno' }); }
  });

  // POST /api/admin/inventory/:id/movement
  router.post('/api/admin/inventory/:id/movement', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { movement_type, quantity, notes } = req.body;
      const item = await pool.query('SELECT * FROM inventory WHERE id=$1', [req.params.id]);
      if (!item.rows.length) return res.status(404).json({ error: 'Item no encontrado' });
      const before = item.rows[0].quantity;
      const after  = movement_type === 'ENTRADA' ? before + parseInt(quantity) : before - parseInt(quantity);
      await pool.query(
        `INSERT INTO inventory_movements(inventory_id,location_id,movement_type,quantity,quantity_before,quantity_after,registered_by,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.params.id, item.rows[0].location_id, movement_type, quantity, before, after, req.user.id, notes || '']
      );
      await pool.query('UPDATE inventory SET quantity=$1 WHERE id=$2', [after, req.params.id]);
      res.json({ ok: true, quantity_after: after });
    } catch(e) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/machine/:qrCode
  router.get('/api/machine/:qrCode', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT i.*, l.name AS location_name, l.address FROM inventory i
         JOIN locations l ON l.id = i.location_id WHERE i.qr_code=$1`,
        [req.params.qrCode]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
      res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/admin/receipts
  router.get('/api/admin/receipts', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT er.*, u.name AS buyer_name FROM electronic_receipts er
         LEFT JOIN users u ON u.id = er.buyer_id ORDER BY er.issued_at DESC`
      );
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error: 'Error interno' }); }
  });

  // GET /api/buyer/receipts
  router.get('/api/buyer/receipts', auth, async (req, res) => {
    try {
      const r = await pool.query(
        'SELECT * FROM electronic_receipts WHERE buyer_id=$1 ORDER BY issued_at DESC',
        [req.user.id]
      );
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error: 'Error interno' }); }
  });

  return router;
};
