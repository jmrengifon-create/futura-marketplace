// shared/eventBus.js — RabbitMQ event-driven messaging
const amqp = require('amqplib');

const EXCHANGE = 'marketplace.events';
const AMQP_URL = process.env.AMQP_URL || 'amqp://guest:guest@rabbitmq:5672';

const EVENTS = {
  ORDER_CREATED:       'order.created',
  ORDER_PAID:          'order.paid',
  ORDER_SHIPPED:       'order.shipped',
  ORDER_DELIVERED:     'order.delivered',
  ORDER_CANCELLED:     'order.cancelled',
  QUOTATION_CREATED:   'quotation.created',
  QUOTATION_SENT:      'quotation.sent',
  QUOTATION_ACCEPTED:  'quotation.accepted',
  PRODUCTION_UPDATED:  'production.updated',
  SELLER_APPROVED:     'seller.approved',
  PAYMENT_CONFIRMED:   'payment.confirmed',
  PAYMENT_REFUNDED:    'payment.refunded',
  REVIEW_CREATED:      'review.created',
  DISPUTE_OPENED:      'dispute.opened',
  DISPUTE_RESOLVED:    'dispute.resolved',
  USER_REGISTERED:     'user.registered',
  NOTIFICATION_SEND:   'notification.send',
  WHATSAPP_SEND:       'whatsapp.send',
};

let _channel   = null;
let _reconnectTimer = null;

const connect = async (retries = 10) => {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await amqp.connect(AMQP_URL);
      _channel   = await conn.createChannel();
      await _channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      console.log('[EventBus] Connected to RabbitMQ');

      conn.on('close', () => {
        console.warn('[EventBus] Connection closed, reconnecting in 5s...');
        _channel = null;
        _reconnectTimer = setTimeout(() => connect(), 5000);
      });
      return _channel;
    } catch (e) {
      console.warn(`[EventBus] Attempt ${i + 1}/${retries} failed: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error('[EventBus] Could not connect to RabbitMQ. Events will be logged only.');
  return null;
};

const getChannel = () => _channel;

const publish = async (eventType, data, options = {}) => {
  const message = {
    event:     eventType,
    data,
    timestamp: new Date().toISOString(),
    service:   process.env.SERVICE_NAME || 'unknown',
    traceId:   options.traceId || `tr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  console.log(`[EventBus] Publishing: ${eventType}`, JSON.stringify(data).substring(0, 80));

  if (!_channel) {
    console.warn('[EventBus] No channel, event dropped:', eventType);
    return false;
  }

  try {
    return _channel.publish(
      EXCHANGE,
      eventType,
      Buffer.from(JSON.stringify(message)),
      { persistent: true, contentType: 'application/json', ...options }
    );
  } catch (e) {
    console.error('[EventBus] Publish error:', e.message);
    return false;
  }
};

const subscribe = async (serviceName, handlers) => {
  if (!_channel) {
    console.warn('[EventBus] No channel for subscribe');
    return;
  }

  const queueName = `${serviceName}.queue`;
  await _channel.assertQueue(queueName, { durable: true, arguments: { 'x-dead-letter-exchange': `${EXCHANGE}.dlx` } });

  for (const routingKey of Object.keys(handlers)) {
    await _channel.bindQueue(queueName, EXCHANGE, routingKey);
    console.log(`[EventBus] ${serviceName} bound to: ${routingKey}`);
  }

  _channel.consume(queueName, async (msg) => {
    if (!msg) return;
    try {
      const { event, data, traceId } = JSON.parse(msg.content.toString());
      const handler = handlers[event];
      if (handler) {
        await handler(data, { traceId });
        _channel.ack(msg);
      } else {
        _channel.nack(msg, false, false); // Dead-letter unknown events
      }
    } catch (e) {
      console.error('[EventBus] Handler error:', e.message);
      _channel.nack(msg, false, false);
    }
  }, { noAck: false });
};

module.exports = { connect, publish, subscribe, getChannel, EVENTS };
