'use strict';

function registerFuturaModules(app) {
  try {
    const { router: promotionsRouter }  = require('./02_ofertas/promotionsService');
    const { router: loyaltyRouter }     = require('./03_fidelizacion/loyaltyService');
    const { router: scoringRouter }     = require('./04_scoring/scoringService');
    const { router: creditsRouter }     = require('./05_creditos/creditsService');
    const { router: riskRouter }        = require('./06_riesgo/riskService');
    const { router: whatsappRouter }    = require('./07_whatsapp/whatsappService');
    const { router: socialRouter }      = require('./08_redes/socialService');
    const { router: marketingRouter }   = require('./09_marketing/marketingService');
    const { router: biRouter }          = require('./10_bi/biService');
    const { vendorRouter, inventoryRouter, technicianRouter, eventRouter } = require('./11_vendors/vendorService');
    const { intlRouter, sunatRouter, qrRouter } = require('./15_i18n/intlService');
    const { dashboardRouter, notifRouter, reportRouter, systemRouter } = require('./19_dashboard/dashboardService');

    require('./01_automation/automationService');

    app.use('/api/promotions',    promotionsRouter);
    app.use('/api/loyalty',       loyaltyRouter);
    app.use('/api/scoring',       scoringRouter);
    app.use('/api/credits',       creditsRouter);
    app.use('/api/risk',          riskRouter);
    app.use('/api/whatsapp',      whatsappRouter);
    app.use('/api/social',        socialRouter);
    app.use('/api/marketing',     marketingRouter);
    app.use('/api/bi',            biRouter);
    app.use('/api/vendors',       vendorRouter);
    app.use('/api/inventory',     inventoryRouter);
    app.use('/api/technicians',   technicianRouter);
    app.use('/api/events',        eventRouter);
    app.use('/api/intl',          intlRouter);
    app.use('/api/sunat',         sunatRouter);
    app.use('/api/machines',      qrRouter);
    app.use('/api/dashboard',     dashboardRouter);
    app.use('/api/notifications', notifRouter);
    app.use('/api/reports',       reportRouter);
    app.use('/api/system',        systemRouter);

    console.log('✅ [Futura v3.0] 23 módulos registrados correctamente');
    console.log('👤 Autor: Juan Rengifo | Futura Marketplace');
  } catch(e) {
    console.error('❌ Error cargando módulos v3.0:', e.message);
  }
}

module.exports = { registerFuturaModules };
