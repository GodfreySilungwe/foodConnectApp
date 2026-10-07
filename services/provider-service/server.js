const express = require('express');
const { createRepository } = require('./repositories');
const { requireAuth } = require('./auth');

const createApp = () => {
  const app = express();
  const validCoordinates = (latitude, longitude) => {
    const coordinatesMissing = (latitude === undefined || latitude === null) && (longitude === undefined || longitude === null);
    return coordinatesMissing || (
      typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
      typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    );
  };
  const getProviderRatingSummary = (provider) => {
    const ratings = Array.isArray(provider?.ratings) ? provider.ratings : [];
    const validRatings = ratings
      .filter((entry) => entry && typeof entry === 'object' && Number.isFinite(entry.rating) && entry.rating >= 1 && entry.rating <= 5)
      .map((entry) => Number(entry.rating));
    const ratingCount = validRatings.length;
    const averageRating = ratingCount
      ? Number((validRatings.reduce((sum, value) => sum + value, 0) / ratingCount).toFixed(1))
      : 0;
    return {
      rating: averageRating,
      ratingCount,
      averageRating
    };
  };
  const withProviderRatingSummary = (provider) => provider ? { ...provider, ...getProviderRatingSummary(provider) } : provider;
  const isActiveRecord = (record) => !record.status || record.status === 'active';
  const distanceKmBetween = (first, second) => {
    if (!Number.isFinite(first.latitude) || !Number.isFinite(first.longitude) || !Number.isFinite(second.latitude) || !Number.isFinite(second.longitude)) return null;
    const radians = (degrees) => degrees * Math.PI / 180;
    const latitudeDelta = radians(second.latitude - first.latitude);
    const longitudeDelta = radians(second.longitude - first.longitude);
    const haversine = Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) * 10) / 10;
  };
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
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
        providerCount: providers.filter((provider) => isActiveRecord(provider) && (provider.schoolIds || []).includes(school.id)).length
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
      const providerLocation = provider && Number.isFinite(provider.latitude) && Number.isFinite(provider.longitude)
        ? { latitude: provider.latitude, longitude: provider.longitude }
        : null;
      return {
        ...item,
        providerLocation,
        availableSchools: schools.filter((school) => isActiveRecord(school) && schoolIds.includes(school.id)).map((school) => {
          const distanceKm = providerLocation ? distanceKmBetween(providerLocation, school) : null;
          return {
            id: school.id,
            name: school.name,
            distanceKm,
            estimatedMinutes: distanceKm === null ? null : Math.max(5, Math.round((distanceKm * 1.3 / 25) * 60))
          };
        })
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
    const providers = (await providerRepository.list()).filter(isActiveRecord);
    res.json({ success: true, data: providers.map(withProviderRatingSummary) });
  });

  app.post('/api/providers/:providerId/ratings', requireAuth('customer'), async (req, res) => {
    const provider = await providerRepository.findById(req.params.providerId);
    if (!provider || !isActiveRecord(provider)) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    const rating = Number(req.body?.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be a number from 1 to 5' });
    }

    const existingRatings = Array.isArray(provider.ratings) ? provider.ratings : [];
    const nextRatings = [...existingRatings.filter((entry) => entry?.userId !== req.user.userId)];
    nextRatings.push({ userId: req.user.userId, rating });

    const updatedProvider = { ...provider, ratings: nextRatings };
    await providerRepository.save(updatedProvider);

    return res.status(201).json({
      success: true,
      data: withProviderRatingSummary(updatedProvider),
      message: 'Provider rating submitted successfully'
    });
  });

  app.get('/api/providers/:providerId', async (req, res) => {
    const provider = await providerRepository.findById(req.params.providerId);
    if (!provider || !isActiveRecord(provider)) return res.status(404).json({ success: false, error: 'Provider not found' });
    const menu = await menuRepository.listByProvider(provider.id);
    return res.json({ success: true, data: { ...withProviderRatingSummary(provider), menuCount: menu.length } });
  });

  app.get('/api/providers/:providerId/menu', async (req, res) => {
    const provider = await providerRepository.findById(req.params.providerId);
    if (!provider || !isActiveRecord(provider)) return res.status(404).json({ success: false, error: 'Provider not found' });
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
    if (!isActiveRecord(ownedProvider)) return res.status(403).json({ success: false, error: 'Provider account is inactive' });

    const items = await menuRepository.listByProvider(ownedProvider.id);
    return res.json({ success: true, data: await addSchoolAvailability(items, [ownedProvider]) });
  });

  app.get('/api/menu/featured', async (req, res) => {
    const providers = (await providerRepository.list()).filter(isActiveRecord);
    const providerNames = new Map(providers.map((provider) => [provider.id, provider.name]));
    const featuredItems = (await menuRepository.list()).filter((item) => item.available).map((item) => ({
      ...item,
      providerName: providerNames.get(item.providerId) || 'Food provider'
    }));
    const items = await addSchoolAvailability(featuredItems, providers);
    return res.json({ success: true, data: items });
  });

  app.get('/api/schools', async (req, res) => {
    res.json({ success: true, data: (await refreshSchoolProviderCounts()).filter(isActiveRecord) });
  });

  app.get('/api/schools/:schoolId', async (req, res) => {
    await updateSchoolProviderCounts([req.params.schoolId]);
    const school = await schoolRepository.findById(req.params.schoolId);
    if (!school || !isActiveRecord(school)) return res.status(404).json({ success: false, error: 'School not found' });
    return res.json({ success: true, data: school });
  });

  app.get('/api/schools/:schoolId/providers', async (req, res) => {
    await updateSchoolProviderCounts([req.params.schoolId]);
    const school = await schoolRepository.findById(req.params.schoolId);
    if (!school || !isActiveRecord(school)) return res.status(404).json({ success: false, error: 'School not found' });

    const providers = (await providerRepository.list())
      .filter((provider) => isActiveRecord(provider) && (provider.schoolIds || []).includes(school.id))
      .map(({ id, name, ownerName, status, schoolIds }) => ({ id, name, ownerName, status, schoolIds }));
    return res.json({ success: true, data: providers });
  });

  app.post('/api/schools', requireAuth(), async (req, res) => {
    if (!['school', 'provider', 'admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only administrators and providers can register schools' });
    }

    const { name, location, studentCount, image, latitude, longitude } = req.body || {};
    if (!name || !location) {
      return res.status(400).json({ success: false, error: 'School name and location are required' });
    }
    if (!validCoordinates(latitude, longitude)) {
      return res.status(400).json({ success: false, error: 'A valid latitude and longitude pair is required' });
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
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      providerCount: 0,
      registeredBy: req.user.userId
    };
    await schoolRepository.save(newSchool);

    const registeredSchool = await schoolRepository.findById(newSchool.id);
    return res.status(201).json({ success: true, data: registeredSchool, message: 'School registered successfully' });
  });

  app.put('/api/schools/:schoolId', requireAuth(), async (req, res) => {
    if (!['school', 'provider', 'admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only administrators can update school details' });
    }
    const school = await schoolRepository.findById(req.params.schoolId);
    if (!school) return res.status(404).json({ success: false, error: 'School not found' });
    if (!['admin', 'superadmin'].includes(req.user.role) && school.registeredBy !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'School administrator does not own this school record' });
    }

    const { name, location, studentCount, image, latitude, longitude } = req.body || {};
    if (!isValidProfileImage(image)) {
      return res.status(400).json({ success: false, error: 'School image must be one valid image under 160 KB' });
    }
    if (!validCoordinates(latitude, longitude)) {
      return res.status(400).json({ success: false, error: 'A valid latitude and longitude pair is required' });
    }
    const updatedSchool = {
      ...school,
      ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
      ...(typeof location === 'string' && location.trim() ? { location: location.trim() } : {}),
      ...(studentCount !== undefined ? { studentCount: Number(studentCount) || 0 } : {}),
      ...(image !== undefined ? { image: image || null } : {}),
      ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {})
    };
    await schoolRepository.save(updatedSchool);
    return res.json({ success: true, data: updatedSchool, message: 'School details updated' });
  });

  app.get('/api/admin/providers', requireAuth(['admin', 'superadmin']), async (req, res) => {
    res.json({ success: true, data: (await providerRepository.list()).map(withProviderRatingSummary) });
  });

  app.get('/api/admin/schools', requireAuth('superadmin'), async (req, res) => {
    res.json({ success: true, data: await refreshSchoolProviderCounts() });
  });

  app.patch('/api/admin/providers/:providerId/status', requireAuth('superadmin'), async (req, res) => {
    const { status } = req.body || {};
    if (!['active', 'suspended', 'deleted'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be active, suspended, or deleted' });
    }
    const provider = await providerRepository.findById(req.params.providerId);
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });
    const updatedProvider = { ...provider, status };
    await providerRepository.save(updatedProvider);
    await updateSchoolProviderCounts(provider.schoolIds || []);
    return res.json({ success: true, data: updatedProvider, message: 'Provider status updated' });
  });

  app.patch('/api/admin/schools/:schoolId/status', requireAuth('superadmin'), async (req, res) => {
    const { status } = req.body || {};
    if (!['active', 'suspended', 'deleted'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be active, suspended, or deleted' });
    }
    const school = await schoolRepository.findById(req.params.schoolId);
    if (!school) return res.status(404).json({ success: false, error: 'School not found' });
    const updatedSchool = { ...school, status };
    await schoolRepository.save(updatedSchool);
    return res.json({ success: true, data: updatedSchool, message: 'School status updated' });
  });

  app.post('/api/providers', requireAuth('provider'), async (req, res) => {
    const { name, ownerName, email, phone = '', status, schoolIds = [], description = '', image = null, location = '', latitude = null, longitude = null } = req.body || {};

    if (await providerRepository.findByOwnerUserId(req.user.userId) || await providerRepository.findById(req.user.providerId)) {
      return res.status(409).json({ success: false, error: 'Provider account may register only one provider' });
    }

    if (!name || !ownerName || !email || !Array.isArray(schoolIds) || typeof description !== 'string' || typeof location !== 'string' || !isValidProfileImage(image) || !validCoordinates(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['name, ownerName, email, location, valid coordinates, and an array of schoolIds are required']
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
      phone: typeof phone === 'string' ? phone.trim() : '',
      description: description.trim(),
      image,
      location: location.trim(),
      latitude,
      longitude,
      status: status || 'active',
      ownerUserId: req.user.userId,
      schoolIds: [...new Set(schoolIds)],
      ratings: []
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
    if (!isActiveRecord(provider)) return res.status(403).json({ success: false, error: 'Provider account is inactive' });

    const { name, description, image, location, phone, latitude, longitude } = req.body || {};
    if ((name !== undefined && (typeof name !== 'string' || !name.trim())) || (description !== undefined && typeof description !== 'string') || (location !== undefined && typeof location !== 'string') || (phone !== undefined && typeof phone !== 'string') || !isValidProfileImage(image) || !validCoordinates(latitude, longitude)) {
      return res.status(400).json({ success: false, error: 'Provider details or image are invalid' });
    }
    const updatedProvider = {
      ...provider,
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description.trim() } : {}),
      ...(image !== undefined ? { image: image || null } : {}),
      ...(location !== undefined ? { location: location.trim() } : {}),
      ...(phone !== undefined ? { phone: phone.trim() } : {}),
      ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {})
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
    if (!isActiveRecord(provider)) return res.status(403).json({ success: false, error: 'Provider account is inactive' });
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
    const provider = await providerRepository.findById(providerId);
    if (!provider || !isActiveRecord(provider)) return res.status(403).json({ success: false, error: 'Provider account is inactive' });
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
    if (!isActiveRecord(provider)) return res.status(403).json({ success: false, error: 'Provider account is inactive' });

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
    if (!isActiveRecord(provider)) return res.status(403).json({ success: false, error: 'Provider account is inactive' });
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
