const dynamo = require('./dynamo');

class MemoryUserRepository {
  constructor(seed = []) {
    this.users = [...seed.map((user) => ({
      ...user,
      email: typeof user.email === 'string' ? user.email.trim().toLowerCase() : user.email
    }))];
  }

  async list() {
    return this.users;
  }

  async findByEmail(email) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    return this.users.find((user) => user.email === normalizedEmail);
  }

  async findById(userId) {
    return this.users.find((user) => user.id === userId) || null;
  }

  async listByDistrictRole(district, role) {
    return this.users.filter((user) => user.district === district && user.role === role);
  }

  async save(user) {
    const normalizedUser = {
      ...user,
      email: typeof user.email === 'string' ? user.email.trim().toLowerCase() : user.email
    };
    const existingIndex = this.users.findIndex((existing) => existing.id === normalizedUser.id);
    if (existingIndex === -1) this.users.push(normalizedUser);
    else this.users[existingIndex] = normalizedUser;
    return user;
  }
}

class DynamoUserRepository {
  constructor() {
    this.initialization = null;
  }

  async initialize() {
    if (!this.initialization) {
      this.initialization = Promise.all(this.seedUsers.map(async (user) => {
        if (!await dynamo.getUser(user.id)) await dynamo.saveUser(user);
      })).catch((error) => {
        this.initialization = null;
        throw error;
      });
    }
    await this.initialization;
  }

  async list() {
    await this.initialize();
    return dynamo.listUsers();
  }

  async findByEmail(email) {
    await this.initialize();
    return dynamo.findUserByEmail(email);
  }

  async findById(userId) {
    await this.initialize();
    return dynamo.getUser(userId);
  }

  async listByDistrictRole(district, role) {
    await this.initialize();
    return dynamo.listUsersByDistrictRole(district, role);
  }

  async save(user) {
    await dynamo.saveUser({
      ...user,
      email: typeof user.email === 'string' ? user.email.trim().toLowerCase() : user.email
    });
    return user;
  }

  withSeed(seedUsers) {
    this.seedUsers = seedUsers;
    return this;
  }
}

function createUserRepository(seedUsers) {
  if (dynamo.enabled) {
    const repository = new DynamoUserRepository();
    repository.seedUsers = seedUsers;
    return repository;
  }
  return new MemoryUserRepository(seedUsers);
}

module.exports = { createUserRepository };
