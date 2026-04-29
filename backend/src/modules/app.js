'use strict';

function registerFuturaModules(app) {
  const modules = [
    { path: './02_ofertas/promotionsService',      mount: '/api/promotions' },
    { path: './03_fidelizacion/loyaltyService',    mount: '/api/loyalty' },
    { path: './04_scoring/scoringService',          mount: '/api/scoring' },
    { path: './05_creditos/creditsService',         mount: '/api/credits' },
    { path: './06_riesgo/riskService',              mount: '/api/risk' },
    { path: './07_whatsapp/whatsappService',        mount: '/api/whatsapp' },
    { path: './08_redes/socialService',             mount: '/api/social' },
    { path: './09_marketing/marketingService',      mount: '/api/marketing' },
    { path: './10_bi/biService',                    mount: '/api/bi' },
    { path: './15_i18n/intlService',                mount: null },
    { path: './19_dashboard/dashboardService',      mount: null },
  ];

  let loaded = 0;

  // Automation (solo crons, sin router)
  try {
    require('./01_automation/automationService');
    console.log('✅ [v3.0] automation cargado');
    loaded++;
  } catch(e) { console.warn('⚠️ automation:', e.message); }

  // Módulos con router simple
  for (const mod of modules) {
    try {
      const m = require(mod.path);
      const router = m.router || m.default;
      if (mod.mount && router) {
        app.use(mod.mount, router);
        console.log(`✅ [v3.0] ${mod.mount} cargado`);
        loaded++;
      }
    } catch(e) {
      console.warn(`⚠️ ${mod.path}:`, e.message);
    }
  }

  // vendors (múltiples routers)
  try {
    const m = require('./11_vendors/vendorService');
    if (m.vendorRouter)     { app.use('/api/vendors',     m.vendorRouter);     }
    if (m.inventoryRouter)  { app.use('/api/inventory',   m.inventoryRouter);  }
    if (m.technicianRouter) { app.use('/api/technicians', m.technicianRouter); }
    if (m.eventRouter)      { app.use('/api/events',      m.eventRouter);      }
    console.log('✅ [v3.0] vendors/inventory/technicians/events cargados');
    loaded++;
  } catch(e) { console.warn('⚠️ vendorService:', e.message); }

  // intl (múltiples routers)
  try {
    const m = require('./15_i18n/intlService');
    if (m.intlRouter)   { app.use('/api/intl',   m.intlRouter);   }
    if (m.sunatRouter)  { app.use('/api/sunat',  m.sunatRouter);  }
    if (m.qrRouter)     { app.use('/api/machines', m.qrRouter);   }
    console.log('✅ [v3.0] intl/sunat/machines cargados');
    loaded++;
  } catch(e) { console.warn('⚠️ intlService:', e.message); }

  // dashboard (múltiples routers)
  try {
    const m = require('./19_dashboard/dashboardService');
    if (m.dashboardRouter) { app.use('/api/dashboard',     m.dashboardRouter); }
    if (m.notifRouter)     { app.use('/api/notifications', m.notifRouter);     }
    if (m.reportRouter)    { app.use('/api/reports',       m.reportRouter);    }
    if (m.systemRouter)    { app.use('/api/system',        m.systemRouter);    }
    console.log('✅ [v3.0] dashboard/notifications/reports/system cargados');
    loaded++;
  } catch(e) { console.warn('⚠️ dashboardService:', e.message); }

  console.log(`✅ [Futura v3.0] ${loaded} módulos registrados correctamente`);
  console.log('👤 Autor: Juan Rengifo | Futura Marketplace');
}

module.exports = { registerFuturaModules };
