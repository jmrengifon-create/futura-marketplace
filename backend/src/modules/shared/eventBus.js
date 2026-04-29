/**
 * Futura Marketplace — Event Bus (Event-Driven Core)
 * Autor: Juan Rengifo
 * Patrón: Publisher/Subscriber in-process (upgradeable a Redis Pub/Sub)
 */

const EventEmitter = require('events');

class FuturaEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this._log = [];
  }

  publish(event, payload) {
    const entry = { event, payload, ts: new Date().toISOString() };
    this._log.push(entry);
    console.log(`[EventBus] 📢 ${event}`, payload);
    this.emit(event, payload);
    this.emit('*', entry); // wildcard listener
  }

  subscribe(event, handler) {
    this.on(event, handler);
  }

  getLogs(limit = 100) {
    return this._log.slice(-limit);
  }
}

// Singleton global
const eventBus = new FuturaEventBus();

// ── Eventos canónicos del sistema ──────────────────────────────────────────
const EVENTS = {
  ORDER_PAID:          'order.paid',
  ORDER_SHIPPED:       'order.shipped',
  ORDER_DELIVERED:     'order.delivered',
  ORDER_DISPUTED:      'order.disputed',
  CREDIT_APPROVED:     'credit.approved',
  CREDIT_REJECTED:     'credit.rejected',
  CREDIT_PAYMENT_DUE:  'credit.payment_due',
  CREDIT_OVERDUE:      'credit.overdue',
  INVENTORY_LOW:       'inventory.low',
  MACHINE_SERVICE_DUE: 'machine.service_due',
  USER_REGISTERED:     'user.registered',
  VENDOR_APPROVED:     'vendor.approved',
  VENDOR_REJECTED:     'vendor.rejected',
  PROMOTION_CREATED:   'promotion.created',
  SCORE_UPDATED:       'score.updated',
  REPORT_GENERATED:    'report.generated',
};

module.exports = { eventBus, EVENTS };
