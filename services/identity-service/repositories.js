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
    const storedIds = new Set(storedUsers.map((user) => user.id));
    const missingUsers = this.seedUsers.filter((user) => !storedIds.has(user.id));
    const seedById = new Map(this.seedUsers.map((user) => [user.id, user]));
    const migratedUsers = storedUsers.map((user) => {
      const seedUser = seedById.get(user.id);
      if (!seedUser) return user;

      const migratedUser = { ...user };
      if (!migratedUser.providerId && seedUser.providerId) migratedUser.providerId = seedUser.providerId;
      if (!migratedUser.role && seedUser.role) migratedUser.role = seedUser.role;
      return migratedUser;
    });

    const changedUsers = migratedUsers.filter((user, index) => user !== storedUsers[index]);
    if (changedUsers.length > 0) {
      await Promise.all(changedUsers.map((user) => dynamo.saveUser(user)));
    }

    if (missingUsers.length > 0) {
      await Promise.all(missingUsers.map((user) => dynamo.saveUser(user)));
      return [...migratedUsers, ...missingUsers];
    }
    return migratedUsers;
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
