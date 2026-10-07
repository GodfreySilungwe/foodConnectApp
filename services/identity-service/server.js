const express = require('express');
const { createUserRepository } = require('./repositories');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('./auth');

const jwtSecret = process.env.JWT_SECRET || 'foodconnect-development-secret';

const normalizeEmail = (email) => typeof email === 'string' ? email.trim().toLowerCase() : '';

const validCoordinates = (latitude, longitude) => {
  const coordinatesMissing = (latitude === undefined || latitude === null) && (longitude === undefined || longitude === null);
  return coordinatesMissing || (
    typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
  );
};

const createApp = () => {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json());

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'admin@admin.com');
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : '123456');
  const seedUsers = [
    { id: 'u-001', name: 'Demo Customer', email: 'customer@example.com', passwordHash: bcrypt.hashSync('123456', 10), role: 'customer' },
    { id: 'u-002', name: 'Demo Provider', email: 'provider@example.com', passwordHash: bcrypt.hashSync('123456', 10), role: 'provider', providerId: 'p-001' },
    { id: 'u-003', name: 'Demo Admin', email: 'admin@example.com', passwordHash: bcrypt.hashSync('123456', 10), role: 'admin' }
  ];
  if (superAdminEmail && superAdminPassword) {
    seedUsers.push({
      id: 'u-super-admin',
      name: 'Super Administrator',
      email: superAdminEmail.trim().toLowerCase(),
      passwordHash: bcrypt.hashSync(superAdminPassword, 10),
      role: 'superadmin',
      status: 'active'
    });
  }
  const userRepository = createUserRepository(seedUsers);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'identity-service' });
  });

  app.get('/api/auth/session', requireAuth(), async (req, res) => {
    const user = (await userRepository.list()).find((entry) => entry.id === req.user.userId);
    if (!user || (user.status && user.status !== 'active')) {
      return res.status(403).json({ success: false, error: 'This account is inactive' });
    }
    const { password, passwordHash, ...safeUser } = user;
    return res.json({ success: true, data: safeUser });
  });

  app.get('/api/users', requireAuth('admin'), async (req, res) => {
    const users = await userRepository.list();
    res.json({ users: users.map(({ password, passwordHash, ...user }) => user) });
  });

  app.get('/api/admin/users', requireAuth(['admin', 'superadmin']), async (req, res) => {
    const users = await userRepository.list();
    res.json({ success: true, data: users.map(({ password, passwordHash, ...user }) => user) });
  });

  app.patch('/api/admin/users/:userId/status', requireAuth('superadmin'), async (req, res) => {
    const { status } = req.body || {};
    if (!['active', 'suspended', 'deleted'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be active, suspended, or deleted' });
    }
    const user = (await userRepository.list()).find((entry) => entry.id === req.params.userId);
    if (!user) return res.status(404).json({ success: false, error: 'Account not found' });
    if (['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Administrator accounts cannot be managed here' });
    }
    const updatedUser = { ...user, status };
    await userRepository.save(updatedUser);
    const { password, passwordHash, ...safeUser } = updatedUser;
    return res.json({ success: true, data: safeUser, message: 'Account status updated' });
  });

  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, phone, role, latitude, longitude } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!name || !normalizedEmail || !password || !['customer', 'provider', 'school'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['name, email, password, and role are required']
      });
    }

    if (role === 'customer' && !validCoordinates(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Customer location coordinates are required',
        details: ['latitude and longitude are required for parent accounts']
      });
    }

    const exists = await userRepository.findByEmail(normalizedEmail);
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    const newUser = {
      id: `u-${Date.now()}`,
      name,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      ...(typeof phone === 'string' && phone.trim() ? { phone: phone.trim() } : {}),
      latitude: role === 'customer' ? latitude : null,
      longitude: role === 'customer' ? longitude : null,
      ...(role === 'provider' ? { providerId: `p-${Date.now()}` } : {})
    };

    await userRepository.save(newUser);

    return res.status(201).json({
      success: true,
      data: {
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        ...(newUser.phone ? { phone: newUser.phone } : {}),
        role: newUser.role,
        latitude: newUser.latitude ?? null,
        longitude: newUser.longitude ?? null,
        ...(newUser.providerId ? { providerId: newUser.providerId } : {})
      },
      message: 'User registered successfully'
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['email and password are required']
      });
    }

    const user = await userRepository.findByEmail(normalizedEmail);

    if (user && user.status && user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: user.status === 'suspended' ? 'This account is suspended' : 'This account is unavailable'
      });
    }

    const passwordMatches = user && user.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : user && user.password === password;

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        token: jwt.sign({
          userId: user.id,
          role: user.role,
          email: user.email,
          latitude: user.latitude ?? null,
          longitude: user.longitude ?? null,
          ...(user.providerId ? { providerId: user.providerId } : {})
        }, jwtSecret, { expiresIn: '2h' }),
        user: {
          userId: user.id,
          name: user.name,
          email: user.email,
          ...(user.phone ? { phone: user.phone } : {}),
          role: user.role,
          latitude: user.latitude ?? null,
          longitude: user.longitude ?? null,
          ...(user.providerId ? { providerId: user.providerId } : {})
        }
      },
      message: 'Login successful'
    });
  });

  return app;
};

if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`Identity service listening on port ${PORT}`);
  });
}

module.exports = createApp();
