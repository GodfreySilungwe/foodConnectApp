const express = require('express');
const { createRepository } = require('./repositories');
const { requireAuth } = require('./auth');

const createApp = () => {
  const app = express();
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json());

  const providerRepository = createRepository(process.env.PROVIDERS_TABLE || 'foodconnect-dev-providers', [
    {
      id: 'p-001',
      name: 'Sunrise Kitchen',
      ownerName: 'Alice',
      email: 'sunrise@example.com',
      status: 'active',
      ownerUserId: 'u-002',
      schoolIds: ['s-001']
    }
  ]);

  const menuRepository = createRepository(process.env.MENUS_TABLE || 'foodconnect-dev-menus', [
    { id: 'm-101', providerId: 'p-001', name: 'Chicken Rice', price: 22.5, available: true }
  ]);

  const schoolRepository = createRepository(process.env.SCHOOLS_TABLE || 'foodconnect-dev-schools', [
    { id: 's-001', name: 'FoodConnect Central Campus', location: 'Singapore', studentCount: 1200, providerCount: 1 }
  ]);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'provider-service' });
  });

  app.get('/api/providers', async (req, res) => {
    res.json({ success: true, data: await providerRepository.list() });
  });

  app.get('/api/providers/:providerId', async (req, res) => {
    const provider = await providerRepository.findById(req.params.providerId);
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });
    const menu = await menuRepository.listByProvider(provider.id);
    return res.json({ success: true, data: { ...provider, menuCount: menu.length } });
  });

  app.get('/api/providers/:providerId/menu', async (req, res) => {
    const items = await menuRepository.listByProvider(req.params.providerId);
    return res.json({ success: true, data: items });
  });

  app.get('/api/menu/featured', async (req, res) => {
    const providers = await providerRepository.list();
    const providerNames = new Map(providers.map((provider) => [provider.id, provider.name]));
    const items = (await menuRepository.list()).filter((item) => item.available).map((item) => ({
      ...item,
      providerName: providerNames.get(item.providerId) || 'Food provider'
    }));
    return res.json({ success: true, data: items });
  });

  app.get('/api/schools', async (req, res) => {
    res.json({ success: true, data: await schoolRepository.list() });
  });

  app.get('/api/schools/:schoolId', async (req, res) => {
    const school = await schoolRepository.findById(req.params.schoolId);
    if (!school) return res.status(404).json({ success: false, error: 'School not found' });
    return res.json({ success: true, data: school });
  });

  app.post('/api/schools', requireAuth('school'), async (req, res) => {
    const { name, location, studentCount } = req.body || {};
    if (!name || !location) {
      return res.status(400).json({ success: false, error: 'School name and location are required' });
    }

    const existingSchools = await schoolRepository.list();
    if (existingSchools.some((school) => school.name.toLowerCase() === name.trim().toLowerCase())) {
      return res.status(409).json({ success: false, error: 'A school with this name is already registered' });
    }

    const newSchool = {
      id: `s-${Date.now()}`,
      name: name.trim(),
      location: location.trim(),
      studentCount: Number(studentCount) || 0,
      providerCount: 0,
      registeredBy: req.user.userId
    };
    await schoolRepository.save(newSchool);

    return res.status(201).json({ success: true, data: newSchool, message: 'School registered successfully' });
  });

  app.get('/api/admin/providers', requireAuth('admin'), async (req, res) => {
    res.json({ success: true, data: await providerRepository.list() });
  });

  app.post('/api/providers', requireAuth('provider'), async (req, res) => {
    const { name, ownerName, email, status, schoolIds = [] } = req.body || {};

    if (await providerRepository.findByOwnerUserId(req.user.userId) || await providerRepository.findById(req.user.providerId)) {
      return res.status(409).json({ success: false, error: 'Provider account may register only one provider' });
    }

    if (!name || !ownerName || !email || !Array.isArray(schoolIds)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['name, ownerName, email, and an array of schoolIds are required']
      });
    }

    const registeredSchools = await schoolRepository.list();
    const registeredSchoolIds = new Set(registeredSchools.map((school) => school.id));
    if (schoolIds.some((schoolId) => !registeredSchoolIds.has(schoolId))) {
      return res.status(400).json({ success: false, error: 'One or more selected schools are not registered' });
    }

    const newProvider = {
      id: req.user.providerId || `p-${Date.now()}`,
      name,
      ownerName,
      email,
      status: status || 'active',
      ownerUserId: req.user.userId,
      schoolIds: [...new Set(schoolIds)]
    };

    await providerRepository.save(newProvider);

    return res.status(201).json({
      success: true,
      data: newProvider,
      message: 'Provider registered successfully'
    });
  });

  app.put('/api/providers/:providerId/schools', requireAuth('provider'), async (req, res) => {
    const { providerId } = req.params;
    const { schoolIds } = req.body || {};
    const provider = await providerRepository.findById(providerId);
    const ownsProvider = provider && (
      provider.ownerUserId === req.user.userId ||
      (req.user.providerId === providerId && (!provider.ownerUserId || provider.ownerUserId === req.user.userId))
    );

    if (!ownsProvider) {
      return res.status(403).json({ success: false, error: 'Provider does not own this provider record' });
    }
    if (!Array.isArray(schoolIds)) {
      return res.status(400).json({ success: false, error: 'schoolIds must be an array' });
    }

    const registeredSchools = await schoolRepository.list();
    const registeredSchoolIds = new Set(registeredSchools.map((school) => school.id));
    if (schoolIds.some((schoolId) => !registeredSchoolIds.has(schoolId))) {
      return res.status(400).json({ success: false, error: 'One or more selected schools are not registered' });
    }

    const updatedProvider = { ...provider, schoolIds: [...new Set(schoolIds)] };
    await providerRepository.save(updatedProvider);
    return res.json({ success: true, data: updatedProvider, message: 'Provider school coverage updated' });
  });

  app.post('/api/providers/:providerId/menu', requireAuth('provider'), async (req, res) => {
    const { providerId } = req.params;
    const { name, price, available } = req.body || {};

    if (!name || typeof price !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['name and numeric price are required']
      });
    }

    const owner = await providerRepository.findByOwnerUserId(req.user.userId);
    const ownsLegacyProvider = req.user.providerId === providerId;
    const ownsCurrentProvider = owner && owner.id === providerId && owner.ownerUserId === req.user.userId;
    if (!ownsCurrentProvider && !ownsLegacyProvider) {
      return res.status(403).json({ success: false, error: 'Provider does not own this provider record' });
    }

    const newItem = {
      id: `m-${Date.now()}`,
      providerId,
      name,
      price,
      available: available !== false
    };

    await menuRepository.save(newItem);

    return res.status(201).json({
      success: true,
      data: newItem,
      message: 'Menu item created successfully'
    });
  });

  return app;
};

if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3003;
  app.listen(PORT, () => {
    console.log(`Provider service listening on port ${PORT}`);
  });
}

module.exports = createApp();
