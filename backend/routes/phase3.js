-- ============================================================
-- FUTURA v5.0 — FASE 3: Inventario Multi-Local + QR + Boletas
-- Ejecutar en Railway → Postgres → Query
-- ============================================================

-- ─── 1. LOCALES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  address         TEXT,
  city            VARCHAR(100) DEFAULT 'Lima',
  phone           VARCHAR(30),
  manager_id      INT REFERENCES users(id),
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT now()
);

INSERT INTO locations (name, address, city) VALUES
('Lampa',      'Jr. Lampa, Lima Centro', 'Lima'),
('Boulevard',  'Av. Boulevard, San Isidro', 'Lima'),
('Lurín',      'Av. Principal, Lurín', 'Lima'),
('Pachitea',   'Jr. Pachitea, Cercado de Lima', 'Lima')
ON CONFLICT DO NOTHING;

-- ─── 2. INVENTARIO POR LOCAL ─────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id              SERIAL PRIMARY KEY,
  location_id     INT NOT NULL REFERENCES locations(id),
  product_id      INT REFERENCES products(id),
  machine_id      INT REFERENCES futura_machines(id),
  item_type       VARCHAR(20) DEFAULT 'PRODUCT' CHECK (item_type IN ('PRODUCT','MACHINE','SUPPLY')),
  item_name       VARCHAR(200) NOT NULL,
  sku             VARCHAR(100),
  qr_code         VARCHAR(200) UNIQUE,
  quantity        INT DEFAULT 0 CHECK (quantity >= 0),
  min_quantity    INT DEFAULT 1,
  unit_cost       NUMERIC(10,2) DEFAULT 0,
  unit_price      NUMERIC(10,2) DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'DISPONIBLE' CHECK (status IN ('DISPONIBLE','AGOTADO','RESERVADO','DANADO')),
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_qr       ON inventory(qr_code);
CREATE INDEX IF NOT EXISTS idx_inventory_status   ON inventory(status);

-- ─── 3. MOVIMIENTOS DE INVENTARIO ────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id              SERIAL PRIMARY KEY,
  inventory_id    INT NOT NULL REFERENCES inventory(id),
  location_id     INT NOT NULL REFERENCES locations(id),
  movement_type   VARCHAR(20) NOT NULL CHECK (movement_type IN ('ENTRADA','SALIDA','VENTA','TRANSFERENCIA','AJUSTE','DEVOLUCION')),
  quantity        INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after  INT NOT NULL,
  unit_price      NUMERIC(10,2),
  total_value     NUMERIC(10,2),
  reference_id    INT,
  reference_type  VARCHAR(30),
  notes           TEXT,
  registered_by   INT REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movements_inventory ON inventory_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_movements_location  ON inventory_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_movements_date      ON inventory_movements(created_at);

-- ─── 4. BOLETAS ELECTRÓNICAS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS electronic_receipts (
  id              SERIAL PRIMARY KEY,
  order_id        INT NOT NULL REFERENCES orders(id),
  receipt_type    VARCHAR(10) DEFAULT 'BOLETA' CHECK (receipt_type IN ('BOLETA','FACTURA')),
  receipt_number  VARCHAR(50) UNIQUE,
  series          VARCHAR(10) DEFAULT 'B001',
  correlative     INT NOT NULL,
  buyer_id        INT NOT NULL REFERENCES users(id),
  buyer_name      VARCHAR(200),
  buyer_doc       VARCHAR(20),
  buyer_address   TEXT,
  subtotal        NUMERIC(10,2) NOT NULL,
  igv             NUMERIC(10,2) NOT NULL,
  total           NUMERIC(10,2) NOT NULL,
  status          VARCHAR(20) DEFAULT 'EMITIDA' CHECK (status IN ('EMITIDA','ANULADA','PENDIENTE')),
  pdf_url         TEXT,
  sunat_response  JSONB,
  issued_at       TIMESTAMP DEFAULT now(),
  created_at      TIMESTAMP DEFAULT now()
);

-- Secuencia para correlativos de boletas
CREATE SEQUENCE IF NOT EXISTS receipt_correlative_seq START 1;

-- ─── 5. VISTA: INVENTARIO POR LOCAL ──────────────────────────
CREATE OR REPLACE VIEW inventory_summary AS
SELECT
  l.name AS location_name, l.id AS location_id,
  COUNT(i.id) AS total_items,
  COUNT(i.id) FILTER (WHERE i.status='DISPONIBLE') AS available_items,
  COUNT(i.id) FILTER (WHERE i.status='AGOTADO') AS out_of_stock,
  COUNT(i.id) FILTER (WHERE i.quantity <= i.min_quantity AND i.quantity > 0) AS low_stock,
  COALESCE(SUM(i.quantity * i.unit_cost),0) AS inventory_value,
  COALESCE(SUM(i.quantity * i.unit_price),0) AS potential_revenue
FROM locations l
LEFT JOIN inventory i ON i.location_id = l.id
WHERE l.active = TRUE
GROUP BY l.id, l.name;
