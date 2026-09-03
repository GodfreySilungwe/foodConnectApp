const dynamo = require('./dynamo');

class MemoryOrderRepository {
  constructor(seed = []) {
    this.orders = [...seed];
  }

  async list() {
    return this.orders;
  }

  async listByCustomer(customerId) {
    return this.orders.filter((order) => order.customerId === customerId);
  }

  async save(order) {
    this.orders.push(order);
    return order;
  }
}

class DynamoOrderRepository {
  constructor(seed = []) {
    this.seed = seed;
  }

  async list() {
    const orders = await dynamo.listOrders();
    if (orders.length === 0) {
      await Promise.all(this.seed.map((order) => dynamo.saveOrder(order)));
      return this.seed;
    }
    return orders;
  }

  async listByCustomer(customerId) {
    const orders = await this.list();
    return orders.filter((order) => order.customerId === customerId);
  }

  async save(order) {
    await dynamo.saveOrder(order);
    return order;
  }
}

function createOrderRepository(seed) {
  if (dynamo.enabled) return new DynamoOrderRepository(seed);
  return new MemoryOrderRepository(seed);
}

module.exports = { createOrderRepository };
