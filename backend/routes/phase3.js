// backend/routes/phase3.js — Inventario Multi-Local + QR + Boletas
// INSTRUCCION server.js:
//   const phase3 = require('./routes/phase3');
//   app.use(phase3(pool, auth, role, notify));

module.exports = function(pool, auth, roleMiddleware, notify) {
  const express = require('express');
  const router  = express.Router();
  const crypto  = require('crypto');

  const genQR = (prefix, id) => `FUT-${prefix}-${id}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  // ── LOCALES ────────────────────────────────────────────────

  router.get('/api/locations', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT l.*, u.name AS manager_name FROM locations l
         LEFT JOIN users u ON u.id=l.manager_id WHERE l.active=TRUE ORDER BY l.name`
      );
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // ── INVENTARIO ─────────────────────────────────────────────

  router.get('/api/admin/inventory', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { location_id, status } = req.query;
      let q = `SELECT i.*, l.name AS location_name FROM inventory i
               JOIN locations l ON l.id=i.location_id WHERE 1=1`;
      const params = [];
      if (location_id) { params.push(location_id); q += ` AND i.location_id=$${params.length}`; }
      if (status) { params.push(status); q += ` AND i.status=$${params.length}`; }
      q += ' ORDER BY l.name, i.item_name';
      const r = await pool.query(q, params);
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  router.get('/api/admin/inventory/summary', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query('SELECT * FROM inventory_summary');
      const lowStock = await pool.query(
        `SELECT i.*, l.name AS location_name FROM inventory i JOIN locations l ON l.id=i.location_id
         WHERE i.quantity <= i.min_quantity ORDER BY i.quantity ASC LIMIT 10`
      );
      const todayMov = await pool.query(
        `SELECT l.name AS location_name, im.movement_type, COUNT(*) AS ops,
                COALESCE(SUM(im.total_value),0) AS total_value
         FROM inventory_movements im JOIN locations l ON l.id=im.location_id
         WHERE im.created_at >= CURRENT_DATE GROUP BY l.name, im.movement_type`
      );
      res.json({ locations: r.rows, lowStock: lowStock.rows, todayMovements: todayMov.rows });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  router.post('/api/admin/inventory', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { location_id, item_name, item_type, product_id, machine_id, sku, quantity, min_quantity, unit_cost, unit_price } = req.body;
      const qrCode = genQR(item_type?.substring(0,3)||'ITM', Date.now());
      const r = await pool.query(
        `INSERT INTO inventory(location_id,item_name,item_type,product_id,machine_id,sku,qr_code,quantity,min_quantity,unit_cost,unit_price)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [location_id, item_name, item_type||'PRODUCT', product_id||null, machine_id||null,
         sku||null, qrCode, quantity||0, min_quantity||1, unit_cost||0, unit_price||0]
      );
      res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  router.post('/api/admin/inventory/:id/movement', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const { movement_type, quantity, unit_price, notes } = req.body;
      const item = await pool.query('SELECT * FROM inventory WHERE id=$1', [req.params.id]);
      if (!item.rows[0]) return res.status(404).json({ error:'Item no encontrado' });
      const i = item.rows[0];
      const qty = parseInt(quantity);
      let newQty = i.quantity;
      if (['ENTRADA','DEVOLUCION'].includes(movement_type)) newQty += qty;
      else if (['SALIDA','VENTA','TRANSFERENCIA'].includes(movement_type)) {
        if (i.quantity < qty) return res.status(400).json({ error:'Stock insuficiente' });
        newQty -= qty;
      } else newQty = qty; // AJUSTE

      const newStatus = newQty === 0 ? 'AGOTADO' : 'DISPONIBLE';
      await pool.query(
        'UPDATE inventory SET quantity=$1, status=$2, updated_at=now() WHERE id=$3',
        [newQty, newStatus, i.id]
      );
      await pool.query(
        `INSERT INTO inventory_movements(inventory_id,location_id,movement_type,quantity,quantity_before,quantity_after,unit_price,total_value,notes,registered_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [i.id, i.location_id, movement_type, qty, i.quantity, newQty, unit_price||i.unit_price, (unit_price||i.unit_price)*qty, notes, req.user.id]
      );
      res.json({ ok:true, new_quantity: newQty, status: newStatus });
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // QR público — ver info del item
  router.get('/api/qr/:code', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT i.*, l.name AS location_name, l.address, l.phone,
                p.description AS product_desc, fm.description AS machine_desc, fm.category
         FROM inventory i
         JOIN locations l ON l.id=i.location_id
         LEFT JOIN products p ON p.id=i.product_id
         LEFT JOIN futura_machines fm ON fm.id=i.machine_id
         WHERE i.qr_code=$1`, [req.params.code]
      );
      if (!r.rows[0]) return res.status(404).json({ error:'Código QR no encontrado' });
      res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  // ── BOLETAS ELECTRÓNICAS ───────────────────────────────────

  router.post('/api/receipts/generate', auth, async (req, res) => {
    try {
      const { order_id } = req.body;
      const order = await pool.query(
        `SELECT o.*, u.name AS buyer_name, u.email AS buyer_email
         FROM orders o JOIN users u ON u.id=o.buyer_id WHERE o.id=$1`, [order_id]
      );
      if (!order.rows[0]) return res.status(404).json({ error:'Orden no encontrada' });
      const o = order.rows[0];

      // Verificar si ya tiene boleta
      const existing = await pool.query('SELECT id FROM electronic_receipts WHERE order_id=$1', [order_id]);
      if (existing.rows[0]) return res.json({ ok:true, receipt_id: existing.rows[0].id, existing:true });

      const corr = await pool.query('SELECT nextval($1) AS n', ['receipt_correlative_seq']);
      const corrNum = corr.rows[0].n;
      const receiptNumber = `B001-${String(corrNum).padStart(8,'0')}`;
      const subtotal = parseFloat(o.total) / 1.18;
      const igv = parseFloat(o.total) - subtotal;

      const r = await pool.query(
        `INSERT INTO electronic_receipts(order_id,receipt_number,correlative,buyer_id,buyer_name,subtotal,igv,total,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,'EMITIDA') RETURNING *`,
        [order_id, receiptNumber, corrNum, o.buyer_id, o.buyer_name, subtotal.toFixed(2), igv.toFixed(2), o.total]
      );

      // Notificar al comprador
      await notify(o.buyer_id, 'BOLETA_EMITIDA', '🧾 Tu boleta está lista',
        `Boleta ${receiptNumber} por S/ ${o.total} emitida correctamente. La recibirás en tu email.`, '/buyer/receipts'
      ).catch(()=>{});

      res.json({ ok:true, receipt: r.rows[0] });
    } catch(e) { console.error(e); res.status(500).json({ error:'Error interno' }); }
  });

  router.get('/api/admin/receipts', auth, roleMiddleware('ADMIN'), async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT er.*, u.name AS buyer_name, u.email FROM electronic_receipts er
         JOIN users u ON u.id=er.buyer_id ORDER BY er.created_at DESC LIMIT 100`
      );
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  router.get('/api/buyer/receipts', auth, async (req, res) => {
    try {
      const r = await pool.query(
        'SELECT * FROM electronic_receipts WHERE buyer_id=$1 ORDER BY created_at DESC',
        [req.user.id]
      );
      res.json(r.rows);
    } catch(e) { res.status(500).json({ error:'Error interno' }); }
  });

  return router;
};
