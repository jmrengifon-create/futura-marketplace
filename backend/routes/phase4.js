-- ============================================================
-- FUTURA v5.0 — FASE 4: Personal Técnico & Reportes
-- Ejecutar en Railway → Postgres → Query
-- ============================================================

-- ─── 1. PERSONAL TÉCNICO ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS technicians (
  id              SERIAL PRIMARY KEY,
  user_id         INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialties     TEXT[],
  status          VARCHAR(20) DEFAULT 'LIBRE' CHECK (status IN ('TRABAJANDO','COMISION','PERMISO','LIBRE','INACTIVO')),
  current_client  VARCHAR(200),
  current_address TEXT,
  commission_destination VARCHAR(200),
  commission_return_date DATE,
  permission_type VARCHAR(50),
  permission_until DATE,
  permission_days_total INT DEFAULT 0,
  rating_avg      NUMERIC(3,2) DEFAULT 0,
  total_services  INT DEFAULT 0,
  next_available  DATE,
  phone           VARCHAR(30),
  emergency_contact VARCHAR(100),
  emergency_phone VARCHAR(30),
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

-- ─── 2. SERVICIOS TÉCNICOS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS technical_services (
  id              SERIAL PRIMARY KEY,
  technician_id   INT NOT NULL REFERENCES technicians(id),
  buyer_id        INT REFERENCES users(id),
  buyer_machine_id INT REFERENCES buyer_machines(id),
  service_type    VARCHAR(30) DEFAULT 'MANTENIMIENTO' CHECK (service_type IN ('MANTENIMIENTO','REPARACION','INSTALACION','CAPACITACION','GARANTIA','OTRO')),
  status          VARCHAR(20) DEFAULT 'PROGRAMADO' CHECK (status IN ('PROGRAMADO','EN_CURSO','COMPLETADO','CANCELADO')),
  scheduled_at    TIMESTAMP,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  client_name     VARCHAR(200),
  client_address  TEXT,
  client_phone    VARCHAR(30),
  problem_reported TEXT,
  diagnosis       TEXT,
  solution_applied TEXT,
  parts_used      TEXT,
  service_cost    NUMERIC(10,2) DEFAULT 0,
  parts_cost      NUMERIC(10,2) DEFAULT 0,
  total_cost      NUMERIC(10,2) DEFAULT 0,
  client_signature BOOLEAN DEFAULT FALSE,
  client_rating   INT CHECK (client_rating BETWEEN 1 AND 5),
  client_feedback TEXT,
  photos_before   TEXT[],
  photos_after    TEXT[],
  location_id     INT REFERENCES locations(id),
  created_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_tech   ON technical_services(technician_id);
CREATE INDEX IF NOT EXISTS idx_services_buyer  ON technical_services(buyer_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON technical_services(status);

-- ─── 3. DISPONIBILIDAD DEL TÉCNICO ──────────────────────────
CREATE TABLE IF NOT EXISTS technician_availability (
  id              SERIAL PRIMARY KEY,
  technician_id   INT NOT NULL REFERENCES technicians(id),
  available_date  DATE NOT NULL,
  time_slots      TEXT[] DEFAULT ARRAY['09:00','10:00','11:00','14:00','15:00','16:00'],
  is_available    BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  UNIQUE(technician_id, available_date)
);

-- ─── 4. VISTA: PANEL DE TÉCNICOS ─────────────────────────────
CREATE OR REPLACE VIEW technician_panel AS
SELECT
  t.*, u.name, u.email, u.phone AS user_phone,
  COUNT(DISTINCT ts.id) FILTER (WHERE ts.status='EN_CURSO') AS active_services,
  COUNT(DISTINCT ts.id) FILTER (WHERE ts.status='PROGRAMADO' AND ts.scheduled_at >= now()) AS upcoming_services,
  COUNT(DISTINCT ts.id) FILTER (WHERE ts.status='COMPLETADO' AND ts.completed_at >= now()-interval'30 days') AS services_last_30d
FROM technicians t
JOIN users u ON u.id = t.user_id
LEFT JOIN technical_services ts ON ts.technician_id = t.id
WHERE t.status != 'INACTIVO'
GROUP BY t.id, u.name, u.email, u.phone;
