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

  async listByDistrict(district) {
    return this.items.filter((item) => item.district === district);
  }

  async listBySchool(schoolId) {
    return this.items.filter((item) => (item.schoolIds || []).includes(schoolId));
  }

  async findByOwnerUserId(userId) {
    return this.items.find((item) => item.ownerUserId === userId);
  }

  async findByName(name) {
    const normalizedName = String(name).trim().toLowerCase();
    return this.items.filter((item) => String(item.name || '').trim().toLowerCase() === normalizedName);
  }

  async findById(id) {
    return this.items.find((item) => item.id === id);
  }

  async save(item) {
    const existingIndex = this.items.findIndex((existing) => existing.id === item.id);
    if (existingIndex < 0) this.items.push(item);
    else this.items[existingIndex] = item;
    return item;
  }
}

class DynamoRepository {
  constructor(tableName, seed = []) {
    this.tableName = tableName;
    this.seed = seed;
    this.initialization = null;
  }

  async initialize() {
    if (!this.initialization) {
      this.initialization = Promise.all(this.seed.map(async (item) => {
        if (!await dynamo.findItemById(this.tableName, item.id)) await dynamo.saveItem(this.tableName, item);
      })).catch((error) => {
        this.initialization = null;
        throw error;
      });
    }
    await this.initialization;
  }

  async list() {
    await this.initialize();
    return dynamo.listItems(this.tableName);
  }

  async listByProvider(providerId) {
    await this.initialize();
    return dynamo.listItemsByProvider(this.tableName, providerId);
  }

  async listByDistrict(district) {
    await this.initialize();
    return dynamo.listItemsByDistrict(this.tableName, district);
  }

  async listBySchool(schoolId) {
    await this.initialize();
    return dynamo.listProvidersBySchool(this.tableName, schoolId);
  }

  async findByOwnerUserId(userId) {
    await this.initialize();
    return dynamo.findItemByOwnerUserId(this.tableName, userId);
  }

  async findByName(name) {
    await this.initialize();
    return dynamo.findItemsByName(this.tableName, name);
  }

  async findById(id) {
    await this.initialize();
    return dynamo.findItemById(this.tableName, id);
  }

  async save(item) {
    await this.initialize();
    await dynamo.saveItem(this.tableName, item);
    return item;
  }
}

function createRepository(tableName, seed) {
  if (dynamo.enabled) return new DynamoRepository(tableName, seed);
  return new MemoryRepository(seed);
}

module.exports = { createRepository };
