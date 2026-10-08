const { createHash } = require('node:crypto');

const SHARD_COUNT = 16;

function shardForId(id) {
  return createHash('sha256').update(String(id)).digest().readUInt32BE(0) % SHARD_COUNT;
}

function toIsoTimestamp(value) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw new Error('A valid ISO-8601 timestamp is required');
  return timestamp.toISOString();
}

function dayForTimestamp(timestamp) {
  return timestamp.slice(0, 10).replace(/-/g, '');
}

function orderSortKey(order) {
  return `SERVICE_AT#${order.serviceAt}#ORDER#${order.id}`;
}

function withOrderKeys(order) {
  const createdAt = toIsoTimestamp(order.createdAt || new Date());
  const serviceAt = toIsoTimestamp(order.scheduledFor || createdAt);
  const shard = shardForId(order.id);
  const sortKey = orderSortKey({ ...order, serviceAt });

  return {
    ...order,
    createdAt,
    serviceAt,
    pk: `ORDER#${order.id}`,
    sk: 'META',
    gsi1pk: `KITCHEN#${order.providerId}#DAY#${dayForTimestamp(serviceAt)}#SHARD#${shard}`,
    gsi1sk: sortKey,
    gsi2pk: `KITCHEN#${order.providerId}#SHARD#${shard}`,
    gsi2sk: sortKey,
    gsi3pk: `CUSTOMER#${order.customerId}#SHARD#${shard}`,
    gsi3sk: sortKey,
    gsi4pk: `ORDERS#SHARD#${shard}`,
    gsi4sk: sortKey,
  };
}

function withPaymentKeys(payment) {
  const settledAt = toIsoTimestamp(payment.settledAt);
  const shard = shardForId(payment.paymentId);
  const sortKey = `SETTLED_AT#${settledAt}#PAYMENT#${payment.paymentId}`;

  return {
    ...payment,
    settledAt,
    pk: `PAYMENT#${payment.paymentId}`,
    sk: 'META',
    gsi1pk: `KITCHEN#${payment.providerId}#DAY#${dayForTimestamp(settledAt)}#SHARD#${shard}`,
    gsi1sk: sortKey,
    gsi2pk: `KITCHEN#${payment.providerId}#SHARD#${shard}`,
    gsi2sk: sortKey,
    gsi3pk: `ORDER#${payment.orderId}`,
    gsi3sk: sortKey,
  };
}

module.exports = {
  SHARD_COUNT,
  dayForTimestamp,
  shardForId,
  toIsoTimestamp,
  withOrderKeys,
  withPaymentKeys,
};
