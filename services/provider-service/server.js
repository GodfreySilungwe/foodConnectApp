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
  app.use(express.json({ limit: '320kb' }));

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
    { id: 's-001', name: 'FoodConnect Central Campus', location: 'Singapore', studentCount: 1200, providerCount: 0 }
  ]);

  const updateSchoolProviderCounts = async (schoolIds) => {
    const affectedSchoolIds = new Set(schoolIds);
    const [schools, providers] = await Promise.all([schoolRepository.list(), providerRepository.list()]);
    await Promise.all(schools
      .filter((school) => affectedSchoolIds.has(school.id))
      .map((school) => schoolRepository.save({
        ...school,
        providerCount: providers.filter((provider) => (provider.schoolIds || []).includes(school.id)).length
      })));
  };

  const refreshSchoolProviderCounts = async () => {
    const schools = await schoolRepository.list();
    await updateSchoolProviderCounts(schools.map((school) => school.id));
    return schoolRepository.list();
  };

  const addSchoolAvailability = async (items, providers) => {
    const schools = await schoolRepository.list();
    const providerById = new Map(providers.map((provider) => [provider.id, provider]));
    return items.map((item) => {
      const provider = providerById.get(item.providerId);
      const schoolIds = provider?.schoolIds || [];
      return {
        ...item,
        availableSchools: schools.filter((school) => schoolIds.includes(school.id)).map(({ id, name }) => ({ id, name }))
      };
    });
  };

  const isValidProfileImage = (image) => image === undefined || image === null || image === '' || (
    typeof image === 'string' && image.length <= 160000 && (
      /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(image) ||
      /^https:\/\//i.test(image)
    )
  );

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
    const [items, providers] = await Promise.all([menuRepository.listByProvider(req.params.providerId), providerRepository.list()]);
    const availableItems = await addSchoolAvailability(items, providers);
    return res.json({ success: true, data: availableItems });
  });

  app.get('/api/my/menu', requireAuth('provider'), async (req, res) => {
    const provider = await providerRepository.findByOwnerUserId(req.user.userId);
    const legacyProvider = !provider && req.user.providerId
      ? await providerRepository.findById(req.user.providerId)
      : null;
    const ownedProvider = provider || (
      legacyProvider && (!legacyProvider.ownerUserId || legacyProvider.ownerUserId === req.user.userId)
        ? legacyProvider
        : null
    );

    if (!ownedProvider) {
      return res.status(404).json({ success: false, error: 'Provider profile not found' });
    }

    const items = await menuRepository.listByProvider(ownedProvider.id);
    return res.json({ success: true, data: await addSchoolAvailability(items, [ownedProvider]) });
  });

  app.get('/api/menu/featured', async (req, res) => {
    const providers = await providerRepository.list();
    const providerNames = new Map(providers.map((provider) => [provider.id, provider.name]));
    const featuredItems = (await menuRepository.list()).filter((item) => item.available).map((item) => ({
      ...item,
      providerName: providerNames.get(item.providerId) || 'Food provider'
    }));
    const items = await addSchoolAvailability(featuredItems, providers);
    return res.json({ success: true, data: items });
  });

  app.get('/api/schools', async (req, res) => {
    res.json({ success: true, data: await refreshSchoolProviderCounts() });
  });

  app.get('/api/schools/:schoolId', async (req, res) => {
    await updateSchoolProviderCounts([req.params.schoolId]);
    const school = await schoolRepository.findById(req.params.schoolId);
    if (!school) return res.status(404).json({ success: false, error: 'School not found' });
    return res.json({ success: true, data: school });
  });

  app.get('/api/schools/:schoolId/providers', async (req, res) => {
    await updateSchoolProviderCounts([req.params.schoolId]);
    const school = await schoolRepository.findById(req.params.schoolId);
    if (!school) return res.status(404).json({ success: false, error: 'School not found' });

    const providers = (await providerRepository.list())
      .filter((provider) => (provider.schoolIds || []).includes(school.id))
      .map(({ id, name, ownerName, status, schoolIds }) => ({ id, name, ownerName, status, schoolIds }));
    return res.json({ success: true, data: providers });
  });

  app.post('/api/schools', requireAuth(), async (req, res) => {
    if (!['school', 'provider', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only administrators and providers can register schools' });
    }

    const { name, location, studentCount, image } = req.body || {};
    if (!name || !location) {
      return res.status(400).json({ success: false, error: 'School name and location are required' });
    }
    if (!isValidProfileImage(image)) {
      return res.status(400).json({ success: false, error: 'School image must be one valid image under 160 KB' });
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
      image: image || null,
      providerCount: 0,
      registeredBy: req.user.userId
    };
    await schoolRepository.save(newSchool);

    if (req.user.role === 'provider') {
      const ownedProvider = await providerRepository.findByOwnerUserId(req.user.userId);
      const legacyProvider = !ownedProvider && req.user.providerId
        ? await providerRepository.findById(req.user.providerId)
        : null;
      const provider = ownedProvider || (
        legacyProvider && (!legacyProvider.ownerUserId || legacyProvider.ownerUserId === req.user.userId)
          ? legacyProvider
          : null
      );
      if (provider) {
        await providerRepository.save({
          ...provider,
          schoolIds: [...new Set([...(provider.schoolIds || []), newSchool.id])]
        });
        await updateSchoolProviderCounts([newSchool.id]);
      }
    }

    const registeredSchool = await schoolRepository.findById(newSchool.id);
    return res.status(201).json({ success: true, data: registeredSchool, message: 'School registered successfully' });
  });

  app.put('/api/schools/:schoolId', requireAuth(), async (req, res) => {
    if (!['school', 'provider', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only administrators can update school details' });
    }
    const school = await schoolRepository.findById(req.params.schoolId);
    if (!school) return res.status(404).json({ success: false, error: 'School not found' });
    if (req.user.role !== 'admin' && school.registeredBy !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'School administrator does not own this school record' });
    }

    const { name, location, studentCount, image } = req.body || {};
    if (!isValidProfileImage(image)) {
      return res.status(400).json({ success: false, error: 'School image must be one valid image under 160 KB' });
    }
    const updatedSchool = {
      ...school,
      ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
      ...(typeof location === 'string' && location.trim() ? { location: location.trim() } : {}),
      ...(studentCount !== undefined ? { studentCount: Number(studentCount) || 0 } : {}),
      ...(image !== undefined ? { image: image || null } : {})
    };
    await schoolRepository.save(updatedSchool);
    return res.json({ success: true, data: updatedSchool, message: 'School details updated' });
  });

  app.get('/api/admin/providers', requireAuth('admin'), async (req, res) => {
    res.json({ success: true, data: await providerRepository.list() });
  });

  app.post('/api/providers', requireAuth('provider'), async (req, res) => {
    const { name, ownerName, email, status, schoolIds = [], description = '', image = null } = req.body || {};

    if (await providerRepository.findByOwnerUserId(req.user.userId) || await providerRepository.findById(req.user.providerId)) {
      return res.status(409).json({ success: false, error: 'Provider account may register only one provider' });
    }

    if (!name || !ownerName || !email || !Array.isArray(schoolIds) || typeof description !== 'string' || !isValidProfileImage(image)) {
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
      description: description.trim(),
      image,
      status: status || 'active',
      ownerUserId: req.user.userId,
      schoolIds: [...new Set(schoolIds)]
    };

    await providerRepository.save(newProvider);
    await updateSchoolProviderCounts(newProvider.schoolIds);

    return res.status(201).json({
      success: true,
      data: newProvider,
      message: 'Provider registered successfully'
    });
  });

  app.put('/api/providers/:providerId/profile', requireAuth('provider'), async (req, res) => {
    const provider = await providerRepository.findById(req.params.providerId);
    const ownsProvider = provider && (
      provider.ownerUserId === req.user.userId ||
      (req.user.providerId === provider.id && (!provider.ownerUserId || provider.ownerUserId === req.user.userId))
    );
    if (!ownsProvider) {
      return res.status(403).json({ success: false, error: 'Provider does not own this provider record' });
    }

    const { name, description, image } = req.body || {};
    if ((name !== undefined && (typeof name !== 'string' || !name.trim())) || (description !== undefined && typeof description !== 'string') || !isValidProfileImage(image)) {
      return res.status(400).json({ success: false, error: 'Provider details or image are invalid' });
    }
    const updatedProvider = {
      ...provider,
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description.trim() } : {}),
      ...(image !== undefined ? { image: image || null } : {})
    };
    await providerRepository.save(updatedProvider);
    return res.json({ success: true, data: updatedProvider, message: 'Provider profile updated' });
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
    await updateSchoolProviderCounts([...(provider.schoolIds || []), ...updatedProvider.schoolIds]);
    return res.json({ success: true, data: updatedProvider, message: 'Provider school coverage updated' });
  });

  app.post('/api/providers/:providerId/menu', requireAuth('provider'), async (req, res) => {
    const { providerId } = req.params;
    const { name, description, price, available, images = [] } = req.body || {};

    const validImages = Array.isArray(images) && images.length <= 4 && images.every((image) =>
      typeof image === 'string' && (
        /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(image) ||
        /^https:\/\//i.test(image)
      )
    );
    const imagePayloadSize = Array.isArray(images)
      ? images.reduce((total, image) => total + (typeof image === 'string' ? image.length : 0), 0)
      : Infinity;

    if (!name || typeof price !== 'number' || !Number.isFinite(price) || price < 0 || !validImages || imagePayloadSize > 240000) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['name, a non-negative numeric price, and up to four valid images are required']
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
      description: description || '',
      price,
      available: available !== false,
      image: images[0] || null,
      images
    };

    await menuRepository.save(newItem);

    return res.status(201).json({
      success: true,
      data: newItem,
      message: 'Menu item created successfully'
    });
  });

  app.put('/api/providers/:providerId/menu/:menuId', requireAuth('provider'), async (req, res) => {
    const { providerId, menuId } = req.params;
    const { name, description, price, available, images = [] } = req.body || {};
    const validImages = Array.isArray(images) && images.length <= 4 && images.every((image) =>
      typeof image === 'string' && (
        /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(image) ||
        /^https:\/\//i.test(image)
      )
    );
    const imagePayloadSize = Array.isArray(images)
      ? images.reduce((total, image) => total + (typeof image === 'string' ? image.length : 0), 0)
      : Infinity;
    if (!name || typeof price !== 'number' || !Number.isFinite(price) || price < 0 || !validImages || imagePayloadSize > 240000 || (available !== undefined && typeof available !== 'boolean')) {
      return res.status(400).json({ success: false, error: 'Menu item fields or images are invalid' });
    }

    const provider = await providerRepository.findById(providerId);
    const ownsProvider = provider && (
      provider.ownerUserId === req.user.userId ||
      (req.user.providerId === providerId && (!provider.ownerUserId || provider.ownerUserId === req.user.userId))
    );
    if (!ownsProvider) {
      return res.status(403).json({ success: false, error: 'Provider does not own this provider record' });
    }

    const item = await menuRepository.findById(menuId);
    if (!item || item.providerId !== providerId) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    const updatedItem = {
      ...item,
      name: name.trim(),
      description: description || '',
      price,
      available: available === undefined ? item.available !== false : available,
      image: images[0] || null,
      images
    };
    await menuRepository.save(updatedItem);
    return res.json({ success: true, data: updatedItem, message: 'Menu item updated successfully' });
  });

  app.put('/api/providers/:providerId/menu/:menuId/availability', requireAuth('provider'), async (req, res) => {
    const { providerId, menuId } = req.params;
    const { available } = req.body || {};
    const provider = await providerRepository.findById(providerId);
    const ownsProvider = provider && (
      provider.ownerUserId === req.user.userId ||
      (req.user.providerId === providerId && (!provider.ownerUserId || provider.ownerUserId === req.user.userId))
    );
    if (!ownsProvider) {
      return res.status(403).json({ success: false, error: 'Provider does not own this provider record' });
    }
    if (typeof available !== 'boolean') {
      return res.status(400).json({ success: false, error: 'available must be a boolean' });
    }

    const item = await menuRepository.findById(menuId);
    if (!item || item.providerId !== providerId) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    const updatedItem = { ...item, available };
    await menuRepository.save(updatedItem);
    return res.json({ success: true, data: updatedItem, message: 'Menu availability updated' });
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
