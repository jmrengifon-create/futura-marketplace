-- ============================================================
-- FUTURA CRM v1.0 — Base de datos de maquinaria por comprador
-- Ejecutar en Railway → Postgres → Database → Query
-- ============================================================

-- ─── 1. CATÁLOGO DE MÁQUINAS FUTURA ─────────────────────────
CREATE TABLE IF NOT EXISTS futura_machines (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  model           VARCHAR(100),
  category        VARCHAR(50) NOT NULL CHECK (category IN ('ECOSOLVENTE','UV','DTF','SUBLIMACION','PLOTTER','OTRO')),
  description     TEXT,
  image_url       TEXT,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT now()
);

-- ─── 2. INSUMOS/REPUESTOS POR MÁQUINA ───────────────────────
CREATE TABLE IF NOT EXISTS futura_machine_supplies (
  id              SERIAL PRIMARY KEY,
  machine_id      INT NOT NULL REFERENCES futura_machines(id) ON DELETE CASCADE,
  product_id      INT REFERENCES products(id) ON DELETE SET NULL,
  supply_type     VARCHAR(30) NOT NULL CHECK (supply_type IN ('TINTA','REPUESTO','SERVICIO','CONSUMIBLE','ACCESORIO')),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  frequency       VARCHAR(50),  -- ej: 'Mensual', 'Cada 6 meses', 'Anual'
  priority        VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('CRITICO','ALTO','NORMAL','BAJO')),
  futura_exclusive BOOLEAN DEFAULT TRUE,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT now()
);

-- ─── 3. MÁQUINAS REGISTRADAS POR COMPRADOR ──────────────────
CREATE TABLE IF NOT EXISTS buyer_machines (
  id              SERIAL PRIMARY KEY,
  buyer_id        INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id      INT NOT NULL REFERENCES futura_machines(id),
  order_id        INT REFERENCES orders(id),
  serial_number   VARCHAR(100),
  purchase_date   DATE,
  warranty_until  DATE,
  location        VARCHAR(200),
  status          VARCHAR(20) DEFAULT 'ACTIVA' CHECK (status IN ('ACTIVA','EN_SERVICIO','INACTIVA','VENDIDA')),
  notes           TEXT,
  last_service    DATE,
  next_service    DATE,
  registered_at   TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buyer_machines_buyer   ON buyer_machines(buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_machines_machine ON buyer_machines(machine_id);

-- ─── 4. HISTORIAL DE INSUMOS/SERVICIOS POR MÁQUINA ──────────
CREATE TABLE IF NOT EXISTS buyer_machine_supply_log (
  id              SERIAL PRIMARY KEY,
  buyer_machine_id INT NOT NULL REFERENCES buyer_machines(id) ON DELETE CASCADE,
  supply_id       INT REFERENCES futura_machine_supplies(id),
  order_id        INT REFERENCES orders(id),
  supply_name     VARCHAR(200) NOT NULL,
  supply_type     VARCHAR(30),
  quantity        INT DEFAULT 1,
  notes           TEXT,
  logged_by       INT REFERENCES users(id),
  logged_at       TIMESTAMP DEFAULT now()
);

-- ─── 5. ALERTAS DE MANTENIMIENTO ────────────────────────────
CREATE TABLE IF NOT EXISTS machine_alerts (
  id              SERIAL PRIMARY KEY,
  buyer_machine_id INT NOT NULL REFERENCES buyer_machines(id) ON DELETE CASCADE,
  alert_type      VARCHAR(30) NOT NULL CHECK (alert_type IN ('SERVICIO','GARANTIA','INSUMO','PERSONALIZADA')),
  title           VARCHAR(200) NOT NULL,
  message         TEXT,
  due_date        DATE,
  sent_wa         BOOLEAN DEFAULT FALSE,
  sent_at         TIMESTAMP,
  resolved        BOOLEAN DEFAULT FALSE,
  resolved_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);

-- ─── 6. DATOS INICIALES — Máquinas Futura ───────────────────
INSERT INTO futura_machines (name, model, category, description) VALUES
('Impresora Ecosolvente 1.60m',  'FE-ECO-160',  'ECOSOLVENTE', 'Impresora de gran formato ecosolvente 1.60m. Resolución hasta 1440dpi. Cabezal Epson i3200.'),
('Impresora Ecosolvente 3.20m',  'FE-ECO-320',  'ECOSOLVENTE', 'Roll printer gran formato 3.20m para producción industrial.'),
('Impresora UV Flatbed 60x90',   'FE-UV-6090',   'UV',          'Impresora UV cama plana formato 60x90cm. Impresión directa sobre rígidos.'),
('Impresora DTF 30cm',           'FE-DTF-030',   'DTF',         'Impresora DTF 30cm para transfer de alta calidad en textiles.'),
('Impresora DTF 60cm',           'FE-DTF-060',   'DTF',         'Impresora DTF 60cm producción media-alta. Incluye sistema de polvo automático.'),
('Plotter de Corte 60cm',        'FE-PLT-060',   'PLOTTER',     'Plotter de corte profesional 60cm para vinil, stickers y transfer.'),
('Plotter de Corte 120cm',       'FE-PLT-120',   'PLOTTER',     'Plotter de corte industrial 120cm alta velocidad.'),
('Impresora Sublimación 1.60m',  'FE-SUB-160',   'SUBLIMACION', 'Impresora de sublimación 1.60m para telas y transfer sublimático.')
ON CONFLICT DO NOTHING;

-- ─── 7. INSUMOS POR MÁQUINA ─────────────────────────────────
-- Ecosolvente 1.60m
INSERT INTO futura_machine_supplies (machine_id, supply_type, name, description, frequency, priority, futura_exclusive) VALUES
(1, 'TINTA',      'Kit Tintas Ecosolvente CMYK 1L x4',  'Tintas ecosolvente originales Futura para Epson i3200', 'Mensual',      'CRITICO',  TRUE),
(1, 'REPUESTO',   'Cabezal Epson i3200',                 'Cabezal original de reemplazo',                         'Según desgaste','CRITICO',  TRUE),
(1, 'CONSUMIBLE', 'Topes de tinta (Waste Ink)',           'Esponjas de absorción de tinta residual',               'Cada 6 meses', 'ALTO',     TRUE),
(1, 'SERVICIO',   'Mantenimiento Preventivo',             'Limpieza de cabezales, encoder, riel y rodillos',       'Cada 3 meses', 'ALTO',     TRUE),
(1, 'ACCESORIO',  'Papel o Vinilo Ecosolvente',           'Medios de impresión certificados Futura',               'Según uso',    'NORMAL',   TRUE),
-- Ecosolvente 3.20m
(2, 'TINTA',      'Kit Tintas Ecosolvente CMYK 2L x4',  'Tintas ecosolvente para producción 3.20m',              'Mensual',      'CRITICO',  TRUE),
(2, 'REPUESTO',   'Cabezal Epson i3200 x2',              '2 cabezales para impresora 3.20m',                      'Según desgaste','CRITICO',  TRUE),
(2, 'SERVICIO',   'Mantenimiento Preventivo Industrial', 'Servicio técnico para formato industrial',               'Cada 3 meses', 'ALTO',     TRUE),
-- UV Flatbed
(3, 'TINTA',      'Kit Tintas UV CMYK+W+V 500ml',        'Tintas UV originales con blanco y barniz',               'Cada 2 meses', 'CRITICO',  TRUE),
(3, 'REPUESTO',   'Lámpara UV LED',                      'Lámpara de curado UV de reemplazo',                     'Anual',        'ALTO',     TRUE),
(3, 'SERVICIO',   'Calibración y Limpieza UV',           'Calibración de cama plana y limpieza de cabezales',     'Cada 3 meses', 'ALTO',     TRUE),
-- DTF 30cm
(4, 'TINTA',      'Tintas DTF CMYK + White 500ml',       'Set completo de tintas DTF incluyendo blanco',          'Mensual',      'CRITICO',  TRUE),
(4, 'CONSUMIBLE', 'PET Film DTF 30cm x 100m',            'Rollo de film PET para impresión DTF',                  'Mensual',      'CRITICO',  TRUE),
(4, 'CONSUMIBLE', 'Polvo Adhesivo DTF Hot Melt',          'Polvo termofusible para transfer DTF',                  'Mensual',      'ALTO',     TRUE),
(4, 'SERVICIO',   'Mantenimiento DTF',                   'Limpieza de cabezal y sistema de tinta blanca',         'Mensual',      'ALTO',     TRUE),
-- DTF 60cm
(5, 'TINTA',      'Tintas DTF CMYK + White 1L',          'Set tintas DTF 1 litro para producción',                'Mensual',      'CRITICO',  TRUE),
(5, 'CONSUMIBLE', 'PET Film DTF 60cm x 100m',            'Film PET 60cm para producción media-alta',              'Mensual',      'CRITICO',  TRUE),
(5, 'CONSUMIBLE', 'Polvo Adhesivo DTF 1kg',              'Polvo hot melt 1kg para DTF 60cm',                      'Mensual',      'ALTO',     TRUE),
(5, 'SERVICIO',   'Mantenimiento DTF Industrial',        'Mantenimiento completo sistema DTF 60cm',               'Mensual',      'ALTO',     TRUE),
-- Plotter 60cm
(6, 'REPUESTO',   'Cuchilla de Corte Roland/Graphtec',  'Cuchillas de repuesto para plotter 60cm',               'Cada 3 meses', 'ALTO',     TRUE),
(6, 'CONSUMIBLE', 'Vinil de Corte 60cm x 50m',          'Vinil adhesivo para ploteo',                            'Según uso',    'NORMAL',   TRUE),
(6, 'SERVICIO',   'Calibración Plotter',                 'Calibración de presión y velocidad de corte',           'Cada 6 meses', 'NORMAL',   TRUE),
-- Sublimación
(8, 'TINTA',      'Tintas Sublimación CMYK 500ml',       'Tintas de sublimación para impresora Futura',           'Mensual',      'CRITICO',  TRUE),
(8, 'CONSUMIBLE', 'Papel Sublimación 100g 1.60m x 100m','Papel de sublimación alta transferencia',                'Según uso',    'NORMAL',   TRUE),
(8, 'SERVICIO',   'Mantenimiento Sublimación',           'Limpieza y calibración impresora sublimación',          'Cada 3 meses', 'NORMAL',   TRUE)
ON CONFLICT DO NOTHING;

-- Vista resumen CRM por comprador
CREATE OR REPLACE VIEW buyer_crm_summary AS
SELECT
  u.id AS buyer_id,
  u.name AS buyer_name,
  u.email,
  u.phone,
  COUNT(DISTINCT bm.id) AS total_machines,
  COUNT(DISTINCT bm.id) FILTER (WHERE bm.status = 'ACTIVA') AS active_machines,
  COUNT(DISTINCT bmsl.id) AS total_supply_logs,
  MAX(bmsl.logged_at) AS last_supply_date,
  COUNT(DISTINCT o.id) AS total_orders,
  COALESCE(SUM(o.total) FILTER (WHERE o.status = 'ENTREGADA'), 0) AS total_spent,
  COUNT(DISTINCT ma.id) FILTER (WHERE ma.resolved = FALSE AND ma.due_date <= now() + interval '30 days') AS pending_alerts
FROM users u
LEFT JOIN buyer_machines bm ON bm.buyer_id = u.id
LEFT JOIN buyer_machine_supply_log bmsl ON bmsl.buyer_machine_id = bm.id
LEFT JOIN orders o ON o.buyer_id = u.id
LEFT JOIN machine_alerts ma ON ma.buyer_machine_id = bm.id
WHERE u.role = 'COMPRADOR'
GROUP BY u.id, u.name, u.email, u.phone;
