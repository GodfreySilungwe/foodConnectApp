const dynamo = require('./dynamo');
const { withOrderKeys, withPaymentKeys } = require('./schema');

const inRange = (timestamp, from, to) => (!from || timestamp >= from) && (!to || timestamp <= to);

class MemoryOrderRepository {
  constructor(seed = []) {
    this.orders = seed.map(withOrderKeys);
  }

  async list(from, to) {
    return this.orders.filter((order) => inRange(order.serviceAt, from, to));
  }

  async listByCustomer(customerId, from, to) {
    return this.orders.filter((order) => order.customerId === customerId && inRange(order.serviceAt, from, to));
  }

  async listByProvider(providerId, from, to) {
    return this.orders.filter((order) => order.providerId === providerId && inRange(order.serviceAt, from, to));
  }

  async listByKitchenDate(providerId, day, from, to) {
    return this.orders.filter((order) => order.providerId === providerId && order.serviceAt.slice(0, 10) === day && inRange(order.serviceAt, from, to));
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

  async list(from, to) {
    const orders = await dynamo.listOrders(from, to);
    if (orders.length === 0) {
      const seededOrders = this.seed.map(withOrderKeys);
      await Promise.all(seededOrders.map((order) => dynamo.saveOrder(order)));
      return seededOrders;
    }
    return orders;
  }

  async listByCustomer(customerId, from, to) {
    return dynamo.listOrdersByCustomer(customerId, from, to);
  }

  async listByProvider(providerId, from, to) {
    return dynamo.listOrdersByProvider(providerId, from, to);
  }

  async listByKitchenDate(providerId, day, from, to) {
    return dynamo.listOrdersByKitchenDate(providerId, day, from, to);
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

  async listByProvider(providerId, from, to) {
    return this.payments.filter((payment) => payment.providerId === providerId && inRange(payment.settledAt, from, to));
  }

  async listByKitchenDate(providerId, day, from, to) {
    return this.payments.filter((payment) => payment.providerId === providerId && payment.settledAt.slice(0, 10) === day && inRange(payment.settledAt, from, to));
  }

  async listByOrder(orderId) {
    return this.payments.filter((payment) => payment.orderId === orderId);
  }

  async save(payment) {
    const keyedPayment = withPaymentKeys(payment);
    this.payments.push(keyedPayment);
    return keyedPayment;
  }
}

class DynamoPaymentRepository {
  async listByProvider(providerId, from, to) {
    return dynamo.listPaymentsByProvider(providerId, from, to);
  }

  async listByKitchenDate(providerId, day, from, to) {
    return dynamo.listPaymentsByKitchenDate(providerId, day, from, to);
  }

  async listByOrder(orderId) {
    return dynamo.listPaymentsByOrder(orderId);
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
