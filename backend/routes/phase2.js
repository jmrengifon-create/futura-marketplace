-- ============================================================
-- FUTURA v5.0 — FASE 2: Marketing & Redes Sociales
-- Ejecutar en Railway → Postgres → Query
-- ============================================================

-- ─── 1. PUBLICACIONES EN REDES SOCIALES ─────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id              SERIAL PRIMARY KEY,
  admin_id        INT NOT NULL REFERENCES users(id),
  title           VARCHAR(200) NOT NULL,
  content         TEXT NOT NULL,
  media_url       TEXT,
  media_type      VARCHAR(20) DEFAULT 'IMAGE' CHECK (media_type IN ('IMAGE','VIDEO','REEL','STORY')),
  platforms       TEXT[] DEFAULT ARRAY['FACEBOOK','INSTAGRAM'],
  status          VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SCHEDULED','PUBLISHED','FAILED')),
  scheduled_at    TIMESTAMP,
  published_at    TIMESTAMP,
  fb_post_id      TEXT,
  ig_post_id      TEXT,
  tt_post_id      TEXT,
  yt_video_id     TEXT,
  reach           INT DEFAULT 0,
  likes           INT DEFAULT 0,
  shares          INT DEFAULT 0,
  comments        INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT now()
);

-- ─── 2. CAMPAÑAS DE EMAIL ────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_campaigns (
  id              SERIAL PRIMARY KEY,
  admin_id        INT NOT NULL REFERENCES users(id),
  subject         VARCHAR(300) NOT NULL,
  content         TEXT NOT NULL,
  audience        VARCHAR(30) DEFAULT 'ALL' CHECK (audience IN ('ALL','BUYERS','SELLERS','VIP','INACTIVE','LEVEL')),
  loyalty_level   VARCHAR(20),
  status          VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENDING','SENT','FAILED')),
  sent_count      INT DEFAULT 0,
  open_count      INT DEFAULT 0,
  click_count     INT DEFAULT 0,
  scheduled_at    TIMESTAMP,
  sent_at         TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);

-- ─── 3. SUSCRIPTORES DE EMAIL ────────────────────────────────
CREATE TABLE IF NOT EXISTS email_subscribers (
  id              SERIAL PRIMARY KEY,
  user_id         INT REFERENCES users(id) ON DELETE CASCADE,
  email           VARCHAR(200) NOT NULL UNIQUE,
  name            VARCHAR(100),
  opted_in        BOOLEAN DEFAULT TRUE,
  opted_at        TIMESTAMP DEFAULT now()
);

-- Importar emails existentes
INSERT INTO email_subscribers (user_id, email, name)
SELECT id, email, name FROM users WHERE status = 'ACTIVO'
ON CONFLICT (email) DO NOTHING;

-- ─── 4. MÉTRICAS DE REDES SOCIALES ──────────────────────────
CREATE TABLE IF NOT EXISTS social_metrics (
  id              SERIAL PRIMARY KEY,
  platform        VARCHAR(20) NOT NULL,
  followers       INT DEFAULT 0,
  reach_7d        INT DEFAULT 0,
  impressions_7d  INT DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  recorded_at     TIMESTAMP DEFAULT now()
);

-- Datos iniciales de métricas
INSERT INTO social_metrics (platform, followers) VALUES
('FACEBOOK', 0), ('INSTAGRAM', 0), ('TIKTOK', 0), ('YOUTUBE', 0)
ON CONFLICT DO NOTHING;

-- ─── 5. OFERTAS PARA EMAIL/WA ────────────────────────────────
ALTER TABLE vendor_offers ADD COLUMN IF NOT EXISTS send_email BOOLEAN DEFAULT FALSE;
ALTER TABLE vendor_offers ADD COLUMN IF NOT EXISTS send_wa    BOOLEAN DEFAULT FALSE;
ALTER TABLE vendor_offers ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE vendor_offers ADD COLUMN IF NOT EXISTS wa_sent    BOOLEAN DEFAULT FALSE;
