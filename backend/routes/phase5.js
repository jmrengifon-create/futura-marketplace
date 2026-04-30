-- ============================================================
-- FUTURA v5.0 — FASE 5 & 6: Legal, Riesgo, Multiidioma
-- Ejecutar en Railway → Postgres → Query
-- ============================================================

-- ─── 1. CONSULTAS DE RIESGO CREDITICIO ───────────────────────
CREATE TABLE IF NOT EXISTS credit_risk_checks (
  id              SERIAL PRIMARY KEY,
  buyer_id        INT NOT NULL REFERENCES users(id),
  credit_id       INT REFERENCES credit_applications(id),
  checked_by      INT NOT NULL REFERENCES users(id),
  doc_number      VARCHAR(20),
  infocorp_score  INT,
  sbs_status      VARCHAR(30),
  risk_level      VARCHAR(10) DEFAULT 'MEDIO' CHECK (risk_level IN ('BAJO','MEDIO','ALTO','BLOQUEADO')),
  total_debt      NUMERIC(12,2) DEFAULT 0,
  default_count   INT DEFAULT 0,
  response_data   JSONB,
  notes           TEXT,
  checked_at      TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_risk_buyer ON credit_risk_checks(buyer_id);

-- ─── 2. CONFIGURACIÓN DE IDIOMAS ─────────────────────────────
CREATE TABLE IF NOT EXISTS language_settings (
  id              SERIAL PRIMARY KEY,
  user_id         INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  language        VARCHAR(10) DEFAULT 'es' CHECK (language IN ('es','en','zh')),
  updated_at      TIMESTAMP DEFAULT now()
);

-- ─── 3. COMPLIANCE Y NORMATIVAS ──────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_documents (
  id              SERIAL PRIMARY KEY,
  product_id      INT REFERENCES products(id),
  doc_type        VARCHAR(50) NOT NULL CHECK (doc_type IN ('MSDS','FICHA_TECNICA','CERT_AMBIENTAL','GARANTIA','MANUAL','OTRO')),
  title           VARCHAR(200) NOT NULL,
  file_url        TEXT,
  valid_until     DATE,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT now()
);

-- ─── 4. PROGRAMA DE REFERIDOS ────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id              SERIAL PRIMARY KEY,
  referrer_id     INT NOT NULL REFERENCES users(id),
  referred_id     INT REFERENCES users(id),
  referral_code   VARCHAR(20) UNIQUE NOT NULL,
  status          VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE','ACTIVO','RECOMPENSADO')),
  reward_points   INT DEFAULT 500,
  commission_pct  NUMERIC(5,2) DEFAULT 5.00,
  first_purchase_id INT REFERENCES orders(id),
  rewarded_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);

-- Generar códigos de referido para usuarios existentes
INSERT INTO referrals (referrer_id, referral_code, status)
SELECT id, UPPER(SUBSTRING(MD5(id::TEXT || 'futura2026') FROM 1 FOR 8)), 'ACTIVO'
FROM users WHERE role = 'COMPRADOR'
ON CONFLICT (referral_code) DO NOTHING;

-- ─── 5. REGISTRO DE VENDEDORES CON PAGO ─────────────────────
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS registration_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS registration_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS registration_paid_at TIMESTAMP;
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS registration_order_id INT REFERENCES orders(id);

-- ─── 6. LOG DE ACTIVIDADES ADMIN ─────────────────────────────
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id              SERIAL PRIMARY KEY,
  admin_id        INT NOT NULL REFERENCES users(id),
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(50),
  entity_id       INT,
  description     TEXT,
  ip_address      VARCHAR(50),
  created_at      TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_log_date ON admin_activity_log(created_at DESC);
