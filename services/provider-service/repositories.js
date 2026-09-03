const dynamo = require('./dynamo');

class MemoryRepository {
  constructor(seed = []) {
    this.items = [...seed];
  }

  async list() {
    return this.items;
  }

  async listByProvider(providerId) {
    return this.items.filter((item) => item.providerId === providerId);
  }

  async findByOwnerUserId(userId) {
    return this.items.find((item) => item.ownerUserId === userId);
  }

  async findById(id) {
    return this.items.find((item) => item.id === id);
  }

  async save(item) {
    this.items.push(item);
    return item;
  }
}

class DynamoRepository {
  constructor(tableName, seed = []) {
    this.tableName = tableName;
    this.seed = seed;
  }

  async list() {
    const items = await dynamo.listItems(this.tableName);
    if (items.length === 0) {
      await Promise.all(this.seed.map((item) => dynamo.saveItem(this.tableName, item)));
      return this.seed;
    }
    return items;
  }

  async listByProvider(providerId) {
    const items = await this.list();
    return items.filter((item) => item.providerId === providerId);
  }

  async findByOwnerUserId(userId) {
    const items = await this.list();
    return items.find((item) => item.ownerUserId === userId);
  }

  async findById(id) {
    const items = await this.list();
    return items.find((item) => item.id === id);
  }

  async save(item) {
    await dynamo.saveItem(this.tableName, item);
    return item;
  }
}

function createRepository(tableName, seed) {
  if (dynamo.enabled) return new DynamoRepository(tableName, seed);
  return new MemoryRepository(seed);
}

module.exports = { createRepository };
