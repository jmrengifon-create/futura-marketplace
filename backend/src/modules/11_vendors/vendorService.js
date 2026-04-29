/**
 * MÓDULO 11 — APROBACIÓN DE VENDEDORES
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 */

const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');
const { eventBus, EVENTS } = require('../shared/eventBus');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATION_11 = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_status VARCHAR(20) DEFAULT 'pending'
  CHECK (vendor_status IN ('pending','under_review','approved','rejected'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_docs JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_reviewed_by INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_reviewed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_rejection_reason TEXT;
`;

// GET listar vendedores pendientes de revisión
router.get('/pending', async (req, res) => {
  const { rows } = await db.query(`
    SELECT id, name, email, phone, created_at, vendor_docs, vendor_status
    FROM users WHERE role='vendor' AND vendor_status IN ('pending','under_review')
    ORDER BY created_at ASC
  `);
  res.json(rows);
});

// GET ficha completa de un vendedor
router.get('/:id', async (req, res) => {
  const { rows: [vendor] } = await db.query(`
    SELECT u.*,
      (SELECT COUNT(*) FROM products WHERE vendor_id=u.id) AS product_count,
      (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE vendor_id=u.id AND status='completed') AS total_sales
    FROM users u WHERE u.id=$1
  `, [req.params.id]);
  if (!vendor) return res.status(404).json({ error: 'Vendedor no encontrado' });
  res.json(vendor);
});

// POST cambiar estado del vendedor
router.post('/:id/review', async (req, res) => {
  const { action, reason } = req.body; // action: 'approve' | 'reject' | 'request_docs'
  const adminId = req.user.id;

  const statusMap = { approve: 'approved', reject: 'rejected', request_docs: 'under_review' };
  const newStatus = statusMap[action];
  if (!newStatus) return res.status(400).json({ error: 'Acción inválida' });

  await db.query(`
    UPDATE users SET vendor_status=$1, vendor_reviewed_by=$2,
      vendor_reviewed_at=NOW(), vendor_rejection_reason=$3
    WHERE id=$4
  `, [newStatus, adminId, reason || null, req.params.id]);

  if (newStatus === 'approved') eventBus.publish(EVENTS.VENDOR_APPROVED, { userId: parseInt(req.params.id) });
  if (newStatus === 'rejected') eventBus.publish(EVENTS.VENDOR_REJECTED, { userId: parseInt(req.params.id), reason });

  res.json({ status: newStatus });
});

// ══════════════════════════════════════════════════════════════════════════
// MÓDULO 12 — INVENTARIO INTELIGENTE MULTI-SEDE
// ══════════════════════════════════════════════════════════════════════════

const MIGRATION_12 = `
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id),
  location VARCHAR(50) CHECK (location IN ('Lampa','Boulevard','Lurín','Pachitea','Central')),
  item_name VARCHAR(200) NOT NULL,
  sku VARCHAR(100),
  quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 5,
  unit_price NUMERIC(12,2),
  category VARCHAR(100),
  expiry_date DATE,
  notified_expiry BOOLEAN DEFAULT false,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES inventory_items(id),
  movement_type VARCHAR(20) CHECK (movement_type IN ('in','out','transfer','adjustment')),
  quantity INTEGER,
  from_location VARCHAR(50),
  to_location VARCHAR(50),
  reason TEXT,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const inventoryRouter = express.Router();

// GET inventario por sede
inventoryRouter.get('/by-location', async (req, res) => {
  const { rows } = await db.query(`
    SELECT location,
      COUNT(*) AS items,
      SUM(quantity) AS total_units,
      SUM(quantity * unit_price) AS total_value,
      COUNT(*) FILTER (WHERE quantity <= min_stock) AS low_stock
    FROM inventory_items GROUP BY location
  `);
  res.json(rows);
});

// GET items con stock bajo
inventoryRouter.get('/low-stock', async (req, res) => {
  const { rows } = await db.query(`
    SELECT * FROM inventory_items WHERE quantity <= min_stock ORDER BY quantity ASC
  `);
  res.json(rows);
});

// POST movimiento de inventario
inventoryRouter.post('/movement', async (req, res) => {
  const { item_id, movement_type, quantity, from_location, to_location, reason } = req.body;

  await db.query(`
    INSERT INTO inventory_movements (item_id, movement_type, quantity, from_location, to_location, reason, performed_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
  `, [item_id, movement_type, quantity, from_location, to_location, reason, req.user.id]);

  if (movement_type === 'in') {
    await db.query(`UPDATE inventory_items SET quantity=quantity+$1, last_updated=NOW() WHERE id=$2`, [quantity, item_id]);
  } else if (movement_type === 'out') {
    await db.query(`UPDATE inventory_items SET quantity=quantity-$1, last_updated=NOW() WHERE id=$2`, [quantity, item_id]);
  } else if (movement_type === 'transfer') {
    await db.query(`UPDATE inventory_items SET quantity=quantity-$1, location=$2, last_updated=NOW() WHERE id=$3`, [quantity, to_location, item_id]);
  }

  // Revisar stock bajo
  const { rows: [item] } = await db.query(`SELECT * FROM inventory_items WHERE id=$1`, [item_id]);
  if (item && item.quantity <= item.min_stock) {
    eventBus.publish(EVENTS.INVENTORY_LOW, { itemId: item_id, itemName: item.item_name, quantity: item.quantity, minStock: item.min_stock, location: item.location });
  }

  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════
// MÓDULO 13 — GESTIÓN AVANZADA DE TÉCNICOS
// ══════════════════════════════════════════════════════════════════════════

const MIGRATION_13 = `
CREATE TABLE IF NOT EXISTS technician_schedules (
  id SERIAL PRIMARY KEY,
  technician_id INTEGER REFERENCES users(id),
  date DATE NOT NULL,
  time_slot VARCHAR(20),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available','busy','off')),
  service_request_id INTEGER
);
CREATE TABLE IF NOT EXISTS service_reports (
  id SERIAL PRIMARY KEY,
  technician_id INTEGER REFERENCES users(id),
  machine_id INTEGER,
  customer_id INTEGER REFERENCES users(id),
  problem_description TEXT,
  solution_applied TEXT,
  parts_used JSONB DEFAULT '[]',
  evidence_urls TEXT[],
  service_date DATE,
  duration_hours NUMERIC(4,1),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','in_progress','completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const technicianRouter = express.Router();

// GET disponibilidad de técnicos
technicianRouter.get('/availability', async (req, res) => {
  const { date } = req.query;
  const { rows } = await db.query(`
    SELECT u.id, u.name, u.phone,
      COALESCE(ts.status,'available') AS availability,
      ts.time_slot
    FROM users u
    LEFT JOIN technician_schedules ts ON ts.technician_id=u.id AND ts.date=$1
    WHERE u.role='technician'
  `, [date || new Date().toISOString().split('T')[0]]);
  res.json(rows);
});

// POST crear reporte técnico
technicianRouter.post('/report', async (req, res) => {
  const { machine_id, customer_id, problem_description, solution_applied, parts_used, evidence_urls, duration_hours } = req.body;
  const { rows: [report] } = await db.query(`
    INSERT INTO service_reports
      (technician_id, machine_id, customer_id, problem_description, solution_applied, parts_used, evidence_urls, service_date, duration_hours, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,'completed') RETURNING *
  `, [req.user.id, machine_id, customer_id, problem_description, solution_applied,
      JSON.stringify(parts_used || []), evidence_urls || [], duration_hours]);

  // Actualizar fecha de próximo servicio en máquina
  if (machine_id) {
    const nextService = new Date();
    nextService.setMonth(nextService.getMonth() + 3); // cada 3 meses
    await db.query(
      `UPDATE machines SET next_service_date=$1, service_alerted=false WHERE id=$2`,
      [nextService.toISOString().split('T')[0], machine_id]
    );
  }
  res.json(report);
});

// GET historial de servicios de una máquina
technicianRouter.get('/machine/:machineId/history', async (req, res) => {
  const { rows } = await db.query(`
    SELECT sr.*, u.name AS technician_name
    FROM service_reports sr
    JOIN users u ON u.id=sr.technician_id
    WHERE sr.machine_id=$1 ORDER BY sr.service_date DESC
  `, [req.params.machineId]);
  res.json(rows);
});

// POST asignación automática de técnico disponible
technicianRouter.post('/auto-assign', async (req, res) => {
  const { date, time_slot } = req.body;
  const { rows: [technician] } = await db.query(`
    SELECT u.id, u.name FROM users u
    WHERE u.role='technician'
      AND u.id NOT IN (
        SELECT technician_id FROM technician_schedules
        WHERE date=$1 AND time_slot=$2 AND status='busy'
      )
    ORDER BY RANDOM() LIMIT 1
  `, [date, time_slot]);

  if (!technician) return res.status(404).json({ error: 'No hay técnicos disponibles' });

  await db.query(`
    INSERT INTO technician_schedules (technician_id, date, time_slot, status)
    VALUES ($1,$2,$3,'busy')
    ON CONFLICT DO NOTHING
  `, [technician.id, date, time_slot]);

  res.json(technician);
});

// ══════════════════════════════════════════════════════════════════════════
// MÓDULO 14 — EVENT-DRIVEN SYSTEM (Orquestación)
// ══════════════════════════════════════════════════════════════════════════

const MIGRATION_14 = `
CREATE TABLE IF NOT EXISTS event_log (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(100),
  payload JSONB,
  processed_by TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// Registrar todos los eventos en BD
eventBus.subscribe('*', async ({ event, payload }) => {
  await db.query(
    `INSERT INTO event_log (event_name, payload) VALUES ($1,$2)`,
    [event, JSON.stringify(payload)]
  ).catch(e => console.error('[EventLog]', e.message));
});

const eventRouter = express.Router();

// GET log de eventos (admin)
eventRouter.get('/logs', async (req, res) => {
  const { limit = 100, event } = req.query;
  const { rows } = await db.query(`
    SELECT * FROM event_log
    ${event ? `WHERE event_name=$1` : ''}
    ORDER BY created_at DESC LIMIT $${event ? 2 : 1}
  `, event ? [event, limit] : [limit]);
  res.json(rows);
});

// POST disparar evento manualmente (admin)
eventRouter.post('/trigger', async (req, res) => {
  const { event, payload } = req.body;
  eventBus.publish(event, payload);
  res.json({ triggered: event, payload });
});

module.exports = {
  vendorRouter: router,
  inventoryRouter,
  technicianRouter,
  eventRouter,
  MIGRATIONS: { MIGRATION_11, MIGRATION_12, MIGRATION_13, MIGRATION_14 },
};
