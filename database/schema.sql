-- ============================================================
-- MARKETPLACE FUTURA v3.0 — Schema completo docOficialMKPLACE
-- ============================================================

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN','VENDEDOR','COMPRADOR')),
  phone         VARCHAR(30),
  status        VARCHAR(20) DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO','PENDIENTE','SUSPENDIDO')),
  created_at    TIMESTAMP DEFAULT now()
);

CREATE TABLE seller_profiles (
  id                  SERIAL PRIMARY KEY,
  user_id             INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name       VARCHAR(200),
  ruc                 VARCHAR(20),
  machine_type        VARCHAR(200),
  machine_model       VARCHAR(200),
  production_capacity INT DEFAULT 0,
  location_city       VARCHAR(100),
  location_address    TEXT,
  bank_name           VARCHAR(100),
  bank_account        VARCHAR(60),
  bank_cci            VARCHAR(60),
  verified            BOOLEAN DEFAULT FALSE,
  approved_at         TIMESTAMP,
  approved_by         INT REFERENCES users(id),
  portfolio_desc      TEXT,
  rating_avg          NUMERIC(3,2) DEFAULT 0,
  total_sales         INT DEFAULT 0,
  futura_client_since DATE,
  created_at          TIMESTAMP DEFAULT now()
);

CREATE TABLE categories (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  commission_rate NUMERIC(5,2) DEFAULT 10.00
);

CREATE TABLE products (
  id                   SERIAL PRIMARY KEY,
  seller_id            INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id          INT REFERENCES categories(id),
  title                VARCHAR(200) NOT NULL,
  description          TEXT,
  price                NUMERIC(10,2) NOT NULL CHECK (price > 0),
  price_per_unit       NUMERIC(10,2),
  min_quantity         INT DEFAULT 1,
  max_quantity         INT DEFAULT 9999,
  production_time_days INT DEFAULT 3,
  requires_design_file BOOLEAN DEFAULT FALSE,
  materials_available  TEXT,
  sizes_available      TEXT,
  image_url            TEXT,
  active               BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_products_seller   ON products(seller_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_title    ON products USING gin(to_tsvector('spanish', title));

CREATE TABLE portfolio_images (
  id         SERIAL PRIMARY KEY,
  seller_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  image_url  TEXT NOT NULL,
  caption    VARCHAR(200),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE cart_items (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  quantity   INT DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE quotations (
  id              SERIAL PRIMARY KEY,
  buyer_id        INT NOT NULL REFERENCES users(id),
  seller_id       INT NOT NULL REFERENCES users(id),
  product_id      INT REFERENCES products(id),
  quantity        INT NOT NULL DEFAULT 1,
  specifications  TEXT,
  material        VARCHAR(100),
  size            VARCHAR(100),
  urgency         VARCHAR(20) DEFAULT 'NORMAL' CHECK (urgency IN ('NORMAL','URGENTE','EXPRESS')),
  quoted_price    NUMERIC(10,2),
  production_days INT,
  notes           TEXT,
  expires_at      TIMESTAMP,
  status          VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE','ENVIADA','ACEPTADA','RECHAZADA','EXPIRADA')),
  rejected_reason TEXT,
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_quot_buyer  ON quotations(buyer_id);
CREATE INDEX idx_quot_seller ON quotations(seller_id);

CREATE TABLE design_files (
  id           SERIAL PRIMARY KEY,
  quotation_id INT REFERENCES quotations(id) ON DELETE CASCADE,
  order_id     INT,
  uploaded_by  INT NOT NULL REFERENCES users(id),
  file_name    VARCHAR(300) NOT NULL,
  file_url     TEXT NOT NULL,
  file_type    VARCHAR(50),
  file_size    INT,
  created_at   TIMESTAMP DEFAULT now()
);

CREATE TABLE orders (
  id                 SERIAL PRIMARY KEY,
  buyer_id           INT NOT NULL REFERENCES users(id),
  quotation_id       INT REFERENCES quotations(id),
  total              NUMERIC(10,2) NOT NULL,
  status             VARCHAR(25) NOT NULL DEFAULT 'CREADA'
    CHECK (status IN ('CREADA','PENDIENTE_PAGO','PAGADA','EN_PRODUCCION','LISTO','ENVIADA','ENTREGADA','CANCELADA','REEMBOLSADA')),
  delivery_method    VARCHAR(20) DEFAULT 'ENVIO',
  delivery_address   TEXT,
  tracking_code      VARCHAR(100),
  estimated_delivery DATE,
  notes              TEXT,
  confirmed_at       TIMESTAMP,
  created_at         TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_orders_buyer ON orders(buyer_id);

CREATE TABLE order_items (
  id             SERIAL PRIMARY KEY,
  order_id       INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id     INT NOT NULL REFERENCES products(id),
  seller_id      INT NOT NULL REFERENCES users(id),
  quantity       INT DEFAULT 1,
  price          NUMERIC(10,2) NOT NULL,
  commission     NUMERIC(10,2) NOT NULL,
  net            NUMERIC(10,2) NOT NULL,
  specifications TEXT,
  material       VARCHAR(100),
  size           VARCHAR(100)
);

CREATE INDEX idx_items_order  ON order_items(order_id);
CREATE INDEX idx_items_seller ON order_items(seller_id);

CREATE TABLE order_customizations (
  id            SERIAL PRIMARY KEY,
  order_item_id INT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  file_url      TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT now()
);

CREATE TABLE production_logs (
  id          SERIAL PRIMARY KEY,
  order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id   INT NOT NULL REFERENCES users(id),
  status      VARCHAR(40) NOT NULL,
  description TEXT,
  photo_url   TEXT,
  created_at  TIMESTAMP DEFAULT now()
);

CREATE TABLE payments (
  id                  SERIAL PRIMARY KEY,
  order_id            INT NOT NULL REFERENCES orders(id),
  provider            VARCHAR(20) NOT NULL DEFAULT 'MP',
  provider_payment_id TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  amount              NUMERIC(10,2) NOT NULL,
  held_until          TIMESTAMP,
  released_at         TIMESTAMP,
  raw_response        JSONB,
  created_at          TIMESTAMP DEFAULT now(),
  updated_at          TIMESTAMP DEFAULT now()
);

CREATE TABLE reviews (
  id         SERIAL PRIMARY KEY,
  order_id   INT NOT NULL REFERENCES orders(id),
  buyer_id   INT NOT NULL REFERENCES users(id),
  seller_id  INT NOT NULL REFERENCES users(id),
  rating     INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  quality_ok BOOLEAN DEFAULT TRUE,
  on_time    BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX idx_reviews_order  ON reviews(order_id);
CREATE INDEX        idx_reviews_seller ON reviews(seller_id);

CREATE TABLE disputes (
  id            SERIAL PRIMARY KEY,
  order_id      INT NOT NULL REFERENCES orders(id),
  raised_by     INT NOT NULL REFERENCES users(id),
  against       INT NOT NULL REFERENCES users(id),
  reason        TEXT NOT NULL,
  evidence_urls TEXT,
  status        VARCHAR(20) DEFAULT 'ABIERTA' CHECK (status IN ('ABIERTA','EN_REVISION','RESUELTA','CERRADA')),
  resolution    TEXT,
  resolved_by   INT REFERENCES users(id),
  resolved_at   TIMESTAMP,
  created_at    TIMESTAMP DEFAULT now()
);

CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  message    TEXT,
  link       VARCHAR(300),
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_notif_user ON notifications(user_id, read);

-- ─── AUDIT LOGS (Security / GDPR) ────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           SERIAL PRIMARY KEY,
  user_id      INT REFERENCES users(id) ON DELETE SET NULL,
  action       VARCHAR(200) NOT NULL,
  resource     VARCHAR(200),
  ip           VARCHAR(50),
  status_code  INT,
  payload_size INT,
  created_at   TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ─── WHATSAPP MESSAGES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id        SERIAL PRIMARY KEY,
  phone     VARCHAR(30) NOT NULL,
  direction VARCHAR(5) NOT NULL CHECK (direction IN ('IN','OUT')),
  message   TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT now(),
  UNIQUE(phone, timestamp, direction)
);
CREATE INDEX IF NOT EXISTS idx_wa_phone ON whatsapp_messages(phone);

-- ─── SHIPMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipments (
  id                 SERIAL PRIMARY KEY,
  order_id           INT NOT NULL UNIQUE REFERENCES orders(id),
  carrier            VARCHAR(20) NOT NULL,
  tracking_code      VARCHAR(100) UNIQUE,
  recipient_name     VARCHAR(200),
  recipient_phone    VARCHAR(30),
  recipient_address  TEXT,
  city               VARCHAR(100),
  status             VARCHAR(30) DEFAULT 'CREATED',
  estimated_delivery DATE,
  created_at         TIMESTAMP DEFAULT now(),
  updated_at         TIMESTAMP DEFAULT now()
);

-- ─── DATA RETENTION (GDPR) ────────────────────────────────
-- Sessions expire automatically via Redis TTL
-- Orders retained 7 years (managed by scheduled job)
-- Logs retained 90 days (managed by scheduled job)
CREATE TABLE IF NOT EXISTS data_retention_log (
  id         SERIAL PRIMARY KEY,
  table_name VARCHAR(100),
  records_purged INT,
  purged_at  TIMESTAMP DEFAULT now()
);
