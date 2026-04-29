/**
 * MÓDULOS 15-18 — i18n, Internacional, SUNAT, QR
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 */

// ══════════════════════════════════════════════════════════════════════════
// MÓDULO 15 — MULTI-IDIOMA (i18n)
// ══════════════════════════════════════════════════════════════════════════

// locales/es.json
const ES = {
  "order.created":       "Pedido creado exitosamente",
  "order.paid":          "Pago confirmado",
  "credit.approved":     "Crédito aprobado",
  "credit.overdue":      "Cuota vencida",
  "loyalty.tier.new":    "Cliente Nuevo",
  "loyalty.tier.recurrent": "Cliente Recurrente",
  "loyalty.tier.vip":    "Cliente VIP",
  "error.insufficient_score": "Puntaje insuficiente para solicitar crédito",
  "error.not_found":     "Recurso no encontrado",
  "error.unauthorized":  "No autorizado",
};

const EN = {
  "order.created":       "Order created successfully",
  "order.paid":          "Payment confirmed",
  "credit.approved":     "Credit approved",
  "credit.overdue":      "Installment overdue",
  "loyalty.tier.new":    "New Customer",
  "loyalty.tier.recurrent": "Returning Customer",
  "loyalty.tier.vip":    "VIP Customer",
  "error.insufficient_score": "Insufficient score to apply for credit",
  "error.not_found":     "Resource not found",
  "error.unauthorized":  "Unauthorized",
};

const ZH = {
  "order.created":       "订单创建成功",
  "order.paid":          "付款已确认",
  "credit.approved":     "信用已批准",
  "credit.overdue":      "分期付款逾期",
  "loyalty.tier.new":    "新客户",
  "loyalty.tier.recurrent": "回头客",
  "loyalty.tier.vip":    "VIP客户",
  "error.not_found":     "未找到资源",
  "error.unauthorized":  "未授权",
};

const LOCALES = { es: ES, en: EN, zh: ZH };

function t(key, lang = 'es') {
  const locale = LOCALES[lang] || LOCALES.es;
  return locale[key] || LOCALES.es[key] || key;
}

// Middleware Express para detectar idioma
function i18nMiddleware(req, res, next) {
  const lang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'es';
  req.lang = ['es', 'en', 'zh'].includes(lang) ? lang : 'es';
  req.t = (key) => t(key, req.lang);
  next();
}

// ══════════════════════════════════════════════════════════════════════════
// MÓDULO 16 — ESCALABILIDAD INTERNACIONAL
// ══════════════════════════════════════════════════════════════════════════

// Tipos de cambio (actualizar via API o cron)
const EXCHANGE_RATES = {
  PEN: 1,      // Sol peruano (base)
  USD: 0.267,  // Dólar
  CLP: 245,    // Peso chileno
  COP: 1050,   // Peso colombiano
  CNY: 1.93,   // Yuan
};

const TAX_BY_COUNTRY = {
  PE: { name: 'IGV',  rate: 0.18, included: true  },
  US: { name: 'Sales Tax', rate: 0.08, included: false },
  CL: { name: 'IVA',  rate: 0.19, included: false },
  CO: { name: 'IVA',  rate: 0.19, included: false },
};

function convertCurrency(amountPEN, targetCurrency) {
  const rate = EXCHANGE_RATES[targetCurrency];
  if (!rate) throw new Error(`Moneda no soportada: ${targetCurrency}`);
  return +(amountPEN * rate).toFixed(2);
}

function calcTaxes(amountPEN, countryCode) {
  const tax = TAX_BY_COUNTRY[countryCode] || TAX_BY_COUNTRY.PE;
  if (tax.included) {
    const base = amountPEN / (1 + tax.rate);
    return { base: +base.toFixed(2), taxAmount: +(amountPEN - base).toFixed(2), total: amountPEN, tax };
  }
  const taxAmount = amountPEN * tax.rate;
  return { base: amountPEN, taxAmount: +taxAmount.toFixed(2), total: +(amountPEN + taxAmount).toFixed(2), tax };
}

const express = require('express');
const intlRouter = express.Router();

intlRouter.get('/convert', (req, res) => {
  const { amount, currency } = req.query;
  res.json({ original: parseFloat(amount), currency, converted: convertCurrency(parseFloat(amount), currency) });
});

intlRouter.get('/taxes/:country', (req, res) => {
  const { amount } = req.query;
  res.json(calcTaxes(parseFloat(amount || 100), req.params.country.toUpperCase()));
});

// ══════════════════════════════════════════════════════════════════════════
// MÓDULO 17 — CUMPLIMIENTO LEGAL PERÚ (SUNAT)
// ══════════════════════════════════════════════════════════════════════════

const axios = require('axios');
const { Pool } = require('pg');
const db = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATION_17 = `
CREATE TABLE IF NOT EXISTS electronic_invoices (
  id SERIAL PRIMARY KEY,
  order_id INTEGER,
  buyer_id INTEGER REFERENCES users(id),
  invoice_type VARCHAR(10) CHECK (invoice_type IN ('boleta','factura','nota_credito')),
  serie VARCHAR(10),
  correlativo INTEGER,
  sunat_status VARCHAR(20) DEFAULT 'pending',
  sunat_cdr TEXT,
  sunat_hash TEXT,
  xml_content TEXT,
  pdf_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  total_amount NUMERIC(12,2),
  tax_amount NUMERIC(12,2),
  base_amount NUMERIC(12,2)
);
`;

// Contador de correlativos por serie
async function getNextCorrelativo(serie) {
  const { rows: [last] } = await db.query(
    `SELECT MAX(correlativo) AS max FROM electronic_invoices WHERE serie=$1`, [serie]
  );
  return (parseInt(last?.max) || 0) + 1;
}

// Generar XML UBL 2.1 (formato SUNAT)
function generateInvoiceXML(invoice, buyer, items) {
  const correlativo = String(invoice.correlativo).padStart(8, '0');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${invoice.serie}-${correlativo}</cbc:ID>
  <cbc:IssueDate>${new Date().toISOString().split('T')[0]}</cbc:IssueDate>
  <cbc:InvoiceTypeCode listID="0101">${invoice.invoice_type === 'factura' ? '01' : '03'}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${process.env.RUC || '20000000000'}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName><cbc:Name>FUTURA MARKETPLACE SAC</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${buyer.doc_type === 'RUC' ? '6' : '1'}">${buyer.doc_number}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity><cbc:RegistrationName>${buyer.name}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${invoice.tax_amount.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${invoice.base_amount.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${invoice.total_amount.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${invoice.total_amount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;
}

// Enviar a SUNAT via API REST (OSE o directa)
async function sendToSUNAT(xml, serie, correlativo) {
  try {
    const response = await axios.post(
      process.env.SUNAT_API_URL || 'https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes',
      { xml: Buffer.from(xml).toString('base64') },
      {
        headers: {
          Authorization: `Bearer ${process.env.SUNAT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    return { success: true, cdr: response.data.cdrZip, hash: response.data.hashCpe };
  } catch (err) {
    console.error('[SUNAT]', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

const sunatRouter = express.Router();

// POST Emitir comprobante electrónico
sunatRouter.post('/emit', async (req, res) => {
  const { order_id, invoice_type, items } = req.body;
  const buyer_id = req.user.id;

  const { rows: [buyer] } = await db.query(
    `SELECT name, doc_type, doc_number FROM users WHERE id=$1`, [buyer_id]
  );

  const serie = invoice_type === 'factura' ? 'F001' : 'B001';
  const correlativo = await getNextCorrelativo(serie);
  const totalAmount = items.reduce((s, i) => s + i.price * i.qty, 0);
  const baseAmount  = totalAmount / 1.18;
  const taxAmount   = totalAmount - baseAmount;

  const { rows: [inv] } = await db.query(`
    INSERT INTO electronic_invoices
      (order_id, buyer_id, invoice_type, serie, correlativo, total_amount, base_amount, tax_amount)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [order_id, buyer_id, invoice_type, serie, correlativo, totalAmount, baseAmount, taxAmount]);

  const xml = generateInvoiceXML(inv, buyer, items);
  await db.query(`UPDATE electronic_invoices SET xml_content=$1 WHERE id=$2`, [xml, inv.id]);

  const sunatResult = await sendToSUNAT(xml, serie, correlativo);
  if (sunatResult.success) {
    await db.query(`
      UPDATE electronic_invoices SET sunat_status='accepted', sunat_cdr=$1, sunat_hash=$2 WHERE id=$3
    `, [sunatResult.cdr, sunatResult.hash, inv.id]);
  }

  res.json({ invoice: { ...inv, xml_content: undefined }, sunat: sunatResult });
});

// GET Historial de comprobantes
sunatRouter.get('/invoices', async (req, res) => {
  const { rows } = await db.query(`
    SELECT id, invoice_type, serie, correlativo, sunat_status, total_amount, issued_at
    FROM electronic_invoices WHERE buyer_id=$1 ORDER BY issued_at DESC
  `, [req.user.id]);
  res.json(rows);
});

// ══════════════════════════════════════════════════════════════════════════
// MÓDULO 18 — INVENTARIO + QR AVANZADO
// ══════════════════════════════════════════════════════════════════════════

const QRCode = require('qrcode');

const MIGRATION_18 = `
CREATE TABLE IF NOT EXISTS machines (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id),
  name VARCHAR(200) NOT NULL,
  serial_number VARCHAR(100) UNIQUE,
  brand VARCHAR(100),
  model VARCHAR(100),
  purchase_date DATE,
  next_service_date DATE,
  service_alerted BOOLEAN DEFAULT false,
  useful_life_years INTEGER DEFAULT 5,
  qr_code TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','maintenance','retired')),
  location VARCHAR(100),
  specs JSONB DEFAULT '{}'
);
`;

const qrRouter = express.Router();

// POST Registrar máquina y generar QR
qrRouter.post('/machines', async (req, res) => {
  const { name, serial_number, brand, model, purchase_date, useful_life_years, location, specs } = req.body;

  const { rows: [machine] } = await db.query(`
    INSERT INTO machines (owner_id, name, serial_number, brand, model, purchase_date, useful_life_years, location, specs, next_service_date)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW() + INTERVAL '3 months') RETURNING *
  `, [req.user.id, name, serial_number, brand, model, purchase_date,
      useful_life_years || 5, location, JSON.stringify(specs || {})]);

  // Generar QR con URL del historial de la máquina
  const qrUrl  = `${process.env.APP_URL}/machines/${machine.id}`;
  const qrData = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 });
  await db.query(`UPDATE machines SET qr_code=$1 WHERE id=$2`, [qrData, machine.id]);

  res.json({ ...machine, qr_code: qrData, qr_url: qrUrl });
});

// GET Detalle de máquina por ID (escaneo QR)
qrRouter.get('/machines/:id', async (req, res) => {
  const { rows: [machine] } = await db.query(
    `SELECT m.*, u.name AS owner_name FROM machines m JOIN users u ON u.id=m.owner_id WHERE m.id=$1`,
    [req.params.id]
  );
  if (!machine) return res.status(404).json({ error: 'Máquina no encontrada' });

  const { rows: history } = await db.query(`
    SELECT sr.*, u.name AS technician_name FROM service_reports sr
    JOIN users u ON u.id=sr.technician_id WHERE sr.machine_id=$1 ORDER BY sr.service_date DESC
  `, [req.params.id]);

  const purchaseDate  = new Date(machine.purchase_date);
  const ageYears      = (Date.now() - purchaseDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  const lifeRemaining = Math.max(0, machine.useful_life_years - ageYears);

  res.json({
    ...machine, qr_code: undefined,
    history,
    analytics: {
      age_years:       +ageYears.toFixed(1),
      life_remaining:  +lifeRemaining.toFixed(1),
      life_pct:        +((ageYears / machine.useful_life_years) * 100).toFixed(1),
      days_to_service: machine.next_service_date
        ? Math.ceil((new Date(machine.next_service_date) - Date.now()) / 86400000) : null,
    },
  });
});

module.exports = {
  i18nMiddleware, t, convertCurrency, calcTaxes,
  intlRouter, sunatRouter, qrRouter,
  MIGRATIONS: { MIGRATION_17, MIGRATION_18 },
};
