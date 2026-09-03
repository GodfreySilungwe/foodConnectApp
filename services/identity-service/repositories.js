const dynamo = require('./dynamo');

class MemoryUserRepository {
  constructor(seed = []) {
    this.users = [...seed];
  }

  async list() {
    return this.users;
  }

  async findByEmail(email) {
    return this.users.find((user) => user.email === email);
  }

  async save(user) {
    this.users.push(user);
    return user;
  }
}

class DynamoUserRepository {
  async list() {
    const storedUsers = await dynamo.listUsers();
    if (storedUsers.length === 0) {
      await Promise.all(this.seedUsers.map((user) => dynamo.saveUser(user)));
      return this.seedUsers;
    }
    return storedUsers;
  }

  async findByEmail(email) {
    const users = await this.list();
    return users.find((user) => user.email === email);
  }

  async save(user) {
    await dynamo.saveUser(user);
    return user;
  }

  withSeed(seedUsers) {
    this.seedUsers = seedUsers;
    return this;
  }
}

function createUserRepository(seedUsers) {
  if (dynamo.enabled) return new DynamoUserRepository().withSeed(seedUsers);
  return new MemoryUserRepository(seedUsers);
}

module.exports = { createUserRepository };
