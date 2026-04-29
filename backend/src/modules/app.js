/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          FUTURA MARKETPLACE — app.js (Integración Completa)         ║
 * ║                   Autor: Juan Rengifo | v3.0                        ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Integra los 23 módulos faltantes en el servidor Express existente.
 * Agregar este archivo a la raíz del backend y registrar en index.js.
 *
 * INSTALACIÓN DE DEPENDENCIAS:
 *   npm install node-cron axios nodemailer qrcode pdfkit exceljs
 */

'use strict';

const express = require('express');

// ── Módulos del sistema ────────────────────────────────────────────────────
const { eventBus }              = require('./shared/eventBus');
const { i18nMiddleware, systemIdentityMiddleware } = require('./19_dashboard/dashboardService');

// Importar routers
const automationService = require('./01_automation/automationService');   // inicia crons automáticamente
const { router: promotionsRouter }   = require('./02_ofertas/promotionsService');
const { router: loyaltyRouter }      = require('./03_fidelizacion/loyaltyService');
const { router: scoringRouter }      = require('./04_scoring/scoringService');
const { router: creditsRouter }      = require('./05_creditos/creditsService');
const { router: riskRouter }         = require('./06_riesgo/riskService');
const { router: whatsappRouter }     = require('./07_whatsapp/whatsappService');
const { router: socialRouter }       = require('./08_redes/socialService');
const { router: marketingRouter }    = require('./09_marketing/marketingService');
const { router: biRouter }           = require('./10_bi/biService');
const {
  vendorRouter, inventoryRouter, technicianRouter, eventRouter,
} = require('./11_vendors/vendorService');
const {
  intlRouter, sunatRouter, qrRouter,
} = require('./15_i18n/intlService');
const {
  dashboardRouter, notifRouter, reportRouter, systemRouter,
} = require('./19_dashboard/dashboardService');

// ── Middleware global ──────────────────────────────────────────────────────
function registerFuturaModules(app) {
  app.use(systemIdentityMiddleware);  // Headers de identidad en todas las respuestas
  app.use(i18nMiddleware);            // Detección de idioma

  // ── Rutas de los 23 módulos ──────────────────────────────────────────
  app.use('/api/promotions',   promotionsRouter);   // Módulo 02
  app.use('/api/loyalty',      loyaltyRouter);      // Módulo 03
  app.use('/api/scoring',      scoringRouter);      // Módulo 04
  app.use('/api/credits',      creditsRouter);      // Módulo 05
  app.use('/api/risk',         riskRouter);         // Módulo 06
  app.use('/api/whatsapp',     whatsappRouter);     // Módulo 07
  app.use('/api/social',       socialRouter);       // Módulo 08
  app.use('/api/marketing',    marketingRouter);    // Módulo 09
  app.use('/api/bi',           biRouter);           // Módulo 10
  app.use('/api/vendors',      vendorRouter);       // Módulo 11
  app.use('/api/inventory',    inventoryRouter);    // Módulo 12
  app.use('/api/technicians',  technicianRouter);   // Módulo 13
  app.use('/api/events',       eventRouter);        // Módulo 14
  app.use('/api/intl',         intlRouter);         // Módulo 16
  app.use('/api/sunat',        sunatRouter);        // Módulo 17
  app.use('/api/machines',     qrRouter);           // Módulo 18
  app.use('/api/dashboard',    dashboardRouter);    // Módulo 19
  app.use('/api/notifications',notifRouter);        // Módulo 20
  app.use('/api/reports',      reportRouter);       // Módulo 21
  app.use('/api/system',       systemRouter);       // Módulo 22-23

  console.log('✅ [Futura v3.0] 23 módulos registrados correctamente');
  console.log('🔧 Automatización iniciada (cron jobs activos)');
  console.log('🔔 Event-driven system activo');
  console.log('👤 Sistema: Futura Marketplace | Autor: Juan Rengifo');
}

// ── Migrations SQL agrupadas ───────────────────────────────────────────────
const ALL_MIGRATIONS = `
-- ═══════════════════════════════════════════════════════
-- FUTURA MARKETPLACE v3.0 — Migrations completas
-- Autor: Juan Rengifo
-- Ejecutar una sola vez contra la BD de producción
-- ═══════════════════════════════════════════════════════

-- Módulo 01: Automatización (columnas en tablas existentes)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS notified_expiry BOOLEAN DEFAULT false;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS service_alerted BOOLEAN DEFAULT false;
ALTER TABLE credit_installments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE credit_installments ADD COLUMN IF NOT EXISTS penalty NUMERIC(12,2) DEFAULT 0;

-- Módulo 02: Promociones
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) CHECK (discount_type IN ('percentage','fixed','gift')),
  discount_value NUMERIC(10,2),
  min_purchase NUMERIC(10,2) DEFAULT 0,
  target_segment VARCHAR(30) CHECK (target_segment IN ('all','new','recurrent','vip','high_stock','low_demand')),
  product_ids INTEGER[],
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_trigger VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS promotion_uses (
  id SERIAL PRIMARY KEY,
  promotion_id INTEGER REFERENCES promotions(id),
  buyer_id INTEGER REFERENCES users(id),
  order_id INTEGER,
  discount_applied NUMERIC(10,2),
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Módulo 03: Fidelización
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR(20) DEFAULT 'new';
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_purchases NUMERIC(12,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS purchase_count INTEGER DEFAULT 0;
CREATE TABLE IF NOT EXISTS loyalty_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100),
  points_delta INTEGER,
  tier_before VARCHAR(20),
  tier_after VARCHAR(20),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS loyalty_benefits (
  id SERIAL PRIMARY KEY,
  tier VARCHAR(20) NOT NULL,
  benefit_type VARCHAR(30),
  value NUMERIC(10,2),
  description TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Módulo 04: Scoring
ALTER TABLE users ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS score_color VARCHAR(10) DEFAULT 'yellow';
ALTER TABLE users ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE TABLE IF NOT EXISTS score_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  score_before INTEGER, score_after INTEGER,
  color_before VARCHAR(10), color_after VARCHAR(10),
  factors JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Módulo 05: Créditos
CREATE TABLE IF NOT EXISTS credits (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER REFERENCES users(id),
  vendor_id INTEGER REFERENCES users(id),
  order_id INTEGER,
  total_amount NUMERIC(12,2) NOT NULL,
  monthly_rate NUMERIC(6,4) NOT NULL,
  installments_count INTEGER NOT NULL,
  penalty_rate NUMERIC(6,4) DEFAULT 0.03,
  status VARCHAR(20) DEFAULT 'active',
  score_at_approval INTEGER,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS credit_installments (
  id SERIAL PRIMARY KEY,
  credit_id INTEGER REFERENCES credits(id),
  installment_number INTEGER NOT NULL,
  principal NUMERIC(12,2), interest NUMERIC(12,2),
  amount NUMERIC(12,2), penalty NUMERIC(12,2) DEFAULT 0,
  due_date DATE NOT NULL, paid_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  reminder_sent BOOLEAN DEFAULT false
);

-- Módulo 06: Riesgo
CREATE TABLE IF NOT EXISTS credit_risk_evaluations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  source VARCHAR(30), external_score INTEGER, internal_score INTEGER,
  final_score INTEGER, risk_level VARCHAR(20),
  raw_response JSONB, evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Módulo 07: WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  phone VARCHAR(20), template_name VARCHAR(100), body TEXT,
  direction VARCHAR(10) DEFAULT 'outbound',
  wa_message_id VARCHAR(100), status VARCHAR(20) DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Módulo 08: Redes Sociales
CREATE TABLE IF NOT EXISTS social_posts (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES users(id),
  platform VARCHAR(20), post_type VARCHAR(20),
  content TEXT, media_url TEXT, external_post_id VARCHAR(200),
  scheduled_at TIMESTAMPTZ, published_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending', metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Módulo 09: Marketing
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL, segment VARCHAR(30),
  channels TEXT[] DEFAULT ARRAY['email'],
  subject VARCHAR(300), body TEXT NOT NULL, cta_url TEXT,
  scheduled_at TIMESTAMPTZ, sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'draft',
  stats JSONB DEFAULT '{"sent":0,"failed":0}',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS campaign_sends (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES marketing_campaigns(id),
  user_id INTEGER REFERENCES users(id),
  channel VARCHAR(20), status VARCHAR(20) DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Módulo 11: Vendors
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_docs JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_reviewed_by INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_reviewed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_rejection_reason TEXT;

-- Módulo 12: Inventario
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id),
  location VARCHAR(50), item_name VARCHAR(200) NOT NULL,
  sku VARCHAR(100), quantity INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 5,
  unit_price NUMERIC(12,2), category VARCHAR(100),
  expiry_date DATE, notified_expiry BOOLEAN DEFAULT false,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES inventory_items(id),
  movement_type VARCHAR(20), quantity INTEGER,
  from_location VARCHAR(50), to_location VARCHAR(50),
  reason TEXT, performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Módulo 13: Técnicos
CREATE TABLE IF NOT EXISTS technician_schedules (
  id SERIAL PRIMARY KEY,
  technician_id INTEGER REFERENCES users(id),
  date DATE NOT NULL, time_slot VARCHAR(20),
  status VARCHAR(20) DEFAULT 'available',
  service_request_id INTEGER
);
CREATE TABLE IF NOT EXISTS service_reports (
  id SERIAL PRIMARY KEY,
  technician_id INTEGER REFERENCES users(id),
  machine_id INTEGER, customer_id INTEGER REFERENCES users(id),
  problem_description TEXT, solution_applied TEXT,
  parts_used JSONB DEFAULT '[]', evidence_urls TEXT[],
  service_date DATE, duration_hours NUMERIC(4,1),
  status VARCHAR(20) DEFAULT 'open', created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Módulo 14: Event Log
CREATE TABLE IF NOT EXISTS event_log (
  id SERIAL PRIMARY KEY, event_name VARCHAR(100),
  payload JSONB, processed_by TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Módulo 17: SUNAT
ALTER TABLE users ADD COLUMN IF NOT EXISTS doc_type VARCHAR(10) DEFAULT 'DNI';
ALTER TABLE users ADD COLUMN IF NOT EXISTS doc_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS dni VARCHAR(20);
CREATE TABLE IF NOT EXISTS electronic_invoices (
  id SERIAL PRIMARY KEY, order_id INTEGER, buyer_id INTEGER REFERENCES users(id),
  invoice_type VARCHAR(10), serie VARCHAR(10), correlativo INTEGER,
  sunat_status VARCHAR(20) DEFAULT 'pending', sunat_cdr TEXT, sunat_hash TEXT,
  xml_content TEXT, pdf_url TEXT, issued_at TIMESTAMPTZ DEFAULT NOW(),
  total_amount NUMERIC(12,2), tax_amount NUMERIC(12,2), base_amount NUMERIC(12,2)
);

-- Módulo 18: Máquinas / QR
CREATE TABLE IF NOT EXISTS machines (
  id SERIAL PRIMARY KEY, owner_id INTEGER REFERENCES users(id),
  name VARCHAR(200) NOT NULL, serial_number VARCHAR(100) UNIQUE,
  brand VARCHAR(100), model VARCHAR(100), purchase_date DATE,
  next_service_date DATE, service_alerted BOOLEAN DEFAULT false,
  useful_life_years INTEGER DEFAULT 5, qr_code TEXT,
  status VARCHAR(20) DEFAULT 'active', location VARCHAR(100), specs JSONB DEFAULT '{}'
);

-- Módulo 20: Notificaciones
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fb_page_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS fb_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ig_account_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok_open_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id),
  title VARCHAR(200) NOT NULL, body TEXT,
  type VARCHAR(30) DEFAULT 'info', priority VARCHAR(10) DEFAULT 'normal',
  channels TEXT[] DEFAULT ARRAY['app'],
  read BOOLEAN DEFAULT false, read_at TIMESTAMPTZ,
  action_url TEXT, metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);

-- Seeds de datos base
INSERT INTO loyalty_benefits (tier, benefit_type, value, description) VALUES
  ('recurrent', 'discount', 5,  '5% descuento permanente'),
  ('vip',       'discount', 10, '10% descuento permanente'),
  ('vip',       'priority', 1,  'Atención prioritaria')
ON CONFLICT DO NOTHING;
`;

module.exports = { registerFuturaModules, ALL_MIGRATIONS };
