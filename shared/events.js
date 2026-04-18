// shared/events.js — Event Bus via RabbitMQ
let amqp;
try { amqp = require('amqplib'); } catch { amqp = null; }

let channel    = null;
let connection = null;
let connected  = false;

const EXCHANGE = 'marketplace.events';

const EVENTS = {
  ORDER_CREATED:      'order.created',
  ORDER_PAID:         'order.paid',
  ORDER_SHIPPED:      'order.shipped',
  ORDER_DELIVERED:    'order.delivered',
  ORDER_CANCELLED:    'order.cancelled',
  QUOTATION_CREATED:  'quotation.created',
  QUOTATION_SENT:     'quotation.sent',
  QUOTATION_ACCEPTED: 'quotation.accepted',
  PRODUCTION_UPDATED: 'production.updated',
  SELLER_APPROVED:    'seller.approved',
  PAYMENT_CONFIRMED:  'payment.confirmed',
  REVIEW_CREATED:     'review.created',
  DISPUTE_OPENED:     'dispute.opened',
  DISPUTE_RESOLVED:   'dispute.resolved',
  USER_REGISTERED:    'user.registered',
};

const connect = async (retries = 8) => {
  if (!amqp) { console.warn('[RabbitMQ] amqplib not installed'); return null; }
  for (let i = 0; i < retries; i++) {
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://futura:futura2026@rabbitmq:5672/marketplace';
      connection = await amqp.connect(url);
      channel    = await connection.createChannel();
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      connection.on('error',  (e) => { connected = false; console.error('[RabbitMQ]', e.message); });
      connection.on('close',  ()  => { connected = false; console.warn('[RabbitMQ] closed'); setTimeout(connect, 5000); });
      connected = true;
      console.log('[RabbitMQ] ✅ Conectado');
      return channel;
    } catch (e) {
      console.warn(`[RabbitMQ] intento ${i+1}/${retries}: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.warn('[RabbitMQ] no disponible — eventos desactivados');
  return null;
};

const publish = async (event, data) => {
  try {
    if (!channel || !connected) {
      console.log(`[EVENTS-MOCK] ${event}:`, JSON.stringify(data).substring(0, 80));
      return;
    }
    const msg = JSON.stringify({ event, data, ts: new Date().toISOString(), svc: process.env.SERVICE_NAME || 'backend' });
    channel.publish(EXCHANGE, event, Buffer.from(msg), { persistent: true });
  } catch (e) { console.error('[EVENTS] publish:', e.message); }
};

const subscribe = async (queue, routingKey, handlers) => {
  try {
    if (!channel || !connected) return;
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, EXCHANGE, routingKey);
    channel.prefetch(5);
    channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const { event, data } = JSON.parse(msg.content.toString());
        if (handlers[event]) await handlers[event](data);
        channel.ack(msg);
      } catch (e) {
        console.error('[EVENTS] handler:', e.message);
        channel.nack(msg, false, false);
      }
    });
    console.log(`[EVENTS] Subscribed: ${queue}`);
  } catch (e) { console.error('[EVENTS] subscribe:', e.message); }
};

module.exports = { connect, publish, subscribe, EVENTS };
