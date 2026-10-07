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
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const users = await this.list();
    return users.find((user) => user.email === normalizedEmail);
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
  if (dynamo.enabled) return new DynamoUserRepository().withSeed(seedUsers);
  return new MemoryUserRepository(seedUsers);
}

module.exports = { createUserRepository };
