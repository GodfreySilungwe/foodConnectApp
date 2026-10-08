const dynamo = require('./dynamo');
const { withOrderKeys, withPaymentKeys } = require('./schema');

const inRange = (timestamp, from, to) => (!from || timestamp >= from) && (!to || timestamp <= to);
const defaultPage = { cursor: undefined, limit: 25 };

function pageItems(items, { cursor, limit }, sortField) {
  const offset = cursor === undefined ? 0 : Number(Buffer.from(cursor, 'base64url').toString());
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid page cursor');
  const ordered = [...items].sort((left, right) => left[sortField].localeCompare(right[sortField]));
  const page = ordered.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < ordered.length;
  return { items: page, hasMore, nextCursor: hasMore ? Buffer.from(String(nextOffset)).toString('base64url') : null };
}

class MemoryOrderRepository {
  constructor(seed = []) {
    this.orders = seed.map(withOrderKeys);
  }

  async list(from, to, page = defaultPage) {
    return pageItems(this.orders.filter((order) => inRange(order.serviceAt, from, to)), page, 'serviceAt');
  }

  async listByCustomer(customerId, from, to, page = defaultPage) {
    return pageItems(this.orders.filter((order) => order.customerId === customerId && inRange(order.serviceAt, from, to)), page, 'serviceAt');
  }

  async listByProvider(providerId, from, to, page = defaultPage) {
    return pageItems(this.orders.filter((order) => order.providerId === providerId && inRange(order.serviceAt, from, to)), page, 'serviceAt');
  }

  async listByKitchenDate(providerId, day, from, to, page = defaultPage) {
    return pageItems(this.orders.filter((order) => order.providerId === providerId && order.serviceAt.slice(0, 10) === day && inRange(order.serviceAt, from, to)), page, 'serviceAt');
  }

  async findById(orderId) {
    return this.orders.find((order) => order.id === orderId) || null;
  }

  async save(order) {
    const keyedOrder = withOrderKeys(order);
    this.orders.push(keyedOrder);
    return keyedOrder;
  }

  async updateStatus(orderId, status) {
    const orderIndex = this.orders.findIndex((entry) => entry.id === orderId);
    if (orderIndex < 0) return null;
    this.orders[orderIndex] = { ...this.orders[orderIndex], status, updatedAt: new Date().toISOString() };
    return this.orders[orderIndex];
  }
}

class DynamoOrderRepository {
  constructor(seed = []) {
    this.seed = seed;
  }

  async list(from, to, page = defaultPage) {
    const result = await dynamo.listOrders(from, to, page);
    return result;
  }

  async listByCustomer(customerId, from, to, page = defaultPage) {
    return dynamo.listOrdersByCustomer(customerId, from, to, page);
  }

  async listByProvider(providerId, from, to, page = defaultPage) {
    return dynamo.listOrdersByProvider(providerId, from, to, page);
  }

  async listByKitchenDate(providerId, day, from, to, page = defaultPage) {
    return dynamo.listOrdersByKitchenDate(providerId, day, from, to, page);
  }

  async findById(orderId) {
    return dynamo.findOrder(orderId);
  }

  async save(order) {
    const keyedOrder = withOrderKeys(order);
    await dynamo.saveOrder(keyedOrder);
    return keyedOrder;
  }

  async updateStatus(orderId, status) {
    return dynamo.updateOrderStatus(orderId, status);
  }
}

class MemoryPaymentRepository {
  constructor(seed = []) {
    this.payments = seed.map(withPaymentKeys);
  }

  async listByProvider(providerId, from, to, page = defaultPage) {
    return pageItems(this.payments.filter((payment) => payment.providerId === providerId && inRange(payment.settledAt, from, to)), page, 'settledAt');
  }

  async listByKitchenDate(providerId, day, from, to, page = defaultPage) {
    return pageItems(this.payments.filter((payment) => payment.providerId === providerId && payment.settledAt.slice(0, 10) === day && inRange(payment.settledAt, from, to)), page, 'settledAt');
  }

  async listByOrder(orderId, page = defaultPage) {
    return pageItems(this.payments.filter((payment) => payment.orderId === orderId), page, 'settledAt');
  }

  async save(payment) {
    const keyedPayment = withPaymentKeys(payment);
    this.payments.push(keyedPayment);
    return keyedPayment;
  }
}

class DynamoPaymentRepository {
  async listByProvider(providerId, from, to, page = defaultPage) {
    return dynamo.listPaymentsByProvider(providerId, from, to, page);
  }

  async listByKitchenDate(providerId, day, from, to, page = defaultPage) {
    return dynamo.listPaymentsByKitchenDate(providerId, day, from, to, page);
  }

  async listByOrder(orderId, page = defaultPage) {
    return dynamo.listPaymentsByOrder(orderId, page);
  }

  async save(payment) {
    const keyedPayment = withPaymentKeys(payment);
    await dynamo.savePayment(keyedPayment);
    return keyedPayment;
  }
}

function createOrderRepository(seed) {
  if (dynamo.enabled) return new DynamoOrderRepository(seed);
  return new MemoryOrderRepository(seed);
}

function createPaymentRepository(seed = []) {
  if (dynamo.enabled) return new DynamoPaymentRepository();
  return new MemoryPaymentRepository(seed);
}

module.exports = { createOrderRepository, createPaymentRepository };