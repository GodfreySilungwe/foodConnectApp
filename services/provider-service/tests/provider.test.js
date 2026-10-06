const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');

const providerToken = jwt.sign({ userId: 'u-002', role: 'provider' }, 'foodconnect-development-secret');
const newProviderToken = jwt.sign({ userId: 'u-004', role: 'provider', providerId: 'p-004' }, 'foodconnect-development-secret');
const customerToken = jwt.sign({ userId: 'u-001', role: 'customer' }, 'foodconnect-development-secret');
const schoolToken = jwt.sign({ userId: 'u-school', role: 'school' }, 'foodconnect-development-secret');
const adminToken = jwt.sign({ userId: 'u-admin', role: 'admin' }, 'foodconnect-development-secret');

describe('Provider service', () => {
  it('repairs an outdated provider count when a school is viewed', async () => {
    const response = await request(app).get('/api/schools/s-001');

    expect(response.statusCode).toBe(200);
    expect(response.body.data.providerCount).toBe(1);
  });

  it('registers a provider', async () => {
    const response = await request(app)
      .post('/api/providers')
      .set('Authorization', `Bearer ${newProviderToken}`)
      .send({
        name: 'Green Bowl',
        ownerName: 'Jane Doe',
        email: 'green@example.com',
        status: 'active',
        schoolIds: ['s-001']
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Green Bowl');
    expect(response.body.data.schoolIds).toEqual(['s-001']);
    const schoolResponse = await request(app).get('/api/schools/s-001');
    expect(schoolResponse.body.data.providerCount).toBe(2);

    const duplicateResponse = await request(app)
      .post('/api/providers')
      .set('Authorization', `Bearer ${newProviderToken}`)
      .send({ name: 'Second Kitchen', ownerName: 'Jane Doe', email: 'second@example.com' });

    expect(duplicateResponse.statusCode).toBe(409);
  });

  it('updates school coverage only for the owning provider', async () => {
    const response = await request(app)
      .put('/api/providers/p-001/schools')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ schoolIds: ['s-001'] });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.schoolIds).toEqual(['s-001']);

    const unauthorizedResponse = await request(app)
      .put('/api/providers/p-001/schools')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ schoolIds: [] });
    expect(unauthorizedResponse.statusCode).toBe(403);
  });

  it('returns distance and approximate delivery time for located provider-school pairs', async () => {
    const schoolResponse = await request(app)
      .post('/api/schools')
      .set('Authorization', `Bearer ${schoolToken}`)
      .send({ name: 'Travel Estimate School', location: 'Lilongwe', latitude: -13.96, longitude: 33.77 });
    expect(schoolResponse.statusCode).toBe(201);

    const providerLocationResponse = await request(app)
      .put('/api/providers/p-001/profile')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ location: 'Blantyre', latitude: -15.7861, longitude: 35.0058 });
    expect(providerLocationResponse.statusCode).toBe(200);

    const coverageResponse = await request(app)
      .put('/api/providers/p-001/schools')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ schoolIds: [schoolResponse.body.data.id] });
    expect(coverageResponse.statusCode).toBe(200);

    const menuResponse = await request(app).get('/api/providers/p-001/menu');
    const associatedSchool = menuResponse.body.data[0].availableSchools[0];
    expect(associatedSchool.distanceKm).toBeGreaterThan(0);
    expect(associatedSchool.estimatedMinutes).toBeGreaterThan(0);

    await request(app)
      .put('/api/providers/p-001/profile')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ location: '', latitude: null, longitude: null });
    await request(app)
      .put('/api/providers/p-001/schools')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ schoolIds: ['s-001'] });
  });

  it('allows providers to update their profile description and card image', async () => {
    const response = await request(app)
      .put('/api/providers/p-001/profile')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ description: 'Fresh local meals every day', image: 'data:image/jpeg;base64,AA==' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toMatchObject({
      description: 'Fresh local meals every day',
      image: 'data:image/jpeg;base64,AA=='
    });

    const unauthorizedResponse = await request(app)
      .put('/api/providers/p-001/profile')
      .set('Authorization', `Bearer ${newProviderToken}`)
      .send({ image: null });
    expect(unauthorizedResponse.statusCode).toBe(403);
  });

  it('rejects coverage that references an unregistered school', async () => {
    const response = await request(app)
      .put('/api/providers/p-001/schools')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ schoolIds: ['s-missing'] });

    expect(response.statusCode).toBe(400);
  });

  it('creates a menu item for a provider', async () => {
    const response = await request(app)
      .post('/api/providers/p-001/menu')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        name: 'Beef Burger',
        price: 18.5,
        available: true,
        images: ['data:image/jpeg;base64,AA==', 'https://images.example.com/burger.jpg']
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Beef Burger');
    expect(response.body.data.images).toHaveLength(2);
    expect(response.body.data.image).toBe('data:image/jpeg;base64,AA==');
  });

  it('rejects menu items with more than four images', async () => {
    const response = await request(app)
      .post('/api/providers/p-001/menu')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ name: 'Photo Limit Dish', price: 10, images: Array(5).fill('https://images.example.com/dish.jpg') });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('accepts four compressed photos within the item payload limit', async () => {
    const photo = `data:image/jpeg;base64,${'A'.repeat(59900)}`;
    const response = await request(app)
      .post('/api/providers/p-001/menu')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ name: 'Four Photo Dish', price: 10, images: [photo, photo, photo, photo] });

    expect(response.statusCode).toBe(201);
    expect(response.body.data.images).toHaveLength(4);
  });

  it('allows providers to add photos to existing menu items', async () => {
    const response = await request(app)
      .put('/api/providers/p-001/menu/m-101')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        name: 'Chicken Rice',
        description: 'Updated dish details',
        price: 22.5,
        images: ['data:image/jpeg;base64,AA==']
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.images).toEqual(['data:image/jpeg;base64,AA==']);

    const otherProviderResponse = await request(app)
      .put('/api/providers/p-001/menu/m-101')
      .set('Authorization', `Bearer ${newProviderToken}`)
      .send({ name: 'Not owned', price: 10, images: [] });
    expect(otherProviderResponse.statusCode).toBe(403);
  });

  it('allows only the owning provider to update menu availability', async () => {
    const response = await request(app)
      .put('/api/providers/p-001/menu/m-101/availability')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ available: false });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.available).toBe(false);

    const unauthorizedResponse = await request(app)
      .put('/api/providers/p-001/menu/m-101/availability')
      .set('Authorization', `Bearer ${newProviderToken}`)
      .send({ available: true });
    expect(unauthorizedResponse.statusCode).toBe(403);

    const restoreResponse = await request(app)
      .put('/api/providers/p-001/menu/m-101/availability')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ available: true });
    expect(restoreResponse.statusCode).toBe(200);
  });

  it('lists menu items for a provider', async () => {
    const response = await request(app).get('/api/providers/p-001/menu');

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'm-101',
        name: 'Chicken Rice',
        price: 22.5,
        availableSchools: [expect.objectContaining({ id: 's-001' })]
      })
    ]));
  });

  it('limits a provider menu view to the authenticated provider', async () => {
    const response = await request(app)
      .get('/api/my/menu')
      .set('Authorization', `Bearer ${providerToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'm-101', providerId: 'p-001' })
    ]));

    const customerResponse = await request(app)
      .get('/api/my/menu')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(customerResponse.statusCode).toBe(403);
  });

  it('provides featured menu and school discovery data', async () => {
    const menuResponse = await request(app).get('/api/menu/featured');
    const schoolResponse = await request(app).get('/api/schools');

    expect(menuResponse.statusCode).toBe(200);
    expect(menuResponse.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'm-101',
        providerName: 'Sunrise Kitchen',
        availableSchools: [expect.objectContaining({ id: 's-001', name: 'FoodConnect Central Campus' })]
      })
    ]));
    expect(schoolResponse.statusCode).toBe(200);
    expect(schoolResponse.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 's-001' })
    ]));
    const schoolProvidersResponse = await request(app).get('/api/schools/s-001/providers');
    expect(schoolProvidersResponse.statusCode).toBe(200);
    expect(schoolProvidersResponse.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'p-001', name: 'Sunrise Kitchen', schoolIds: ['s-001'] })
    ]));
  });

  it('registers schools for authenticated school administrators', async () => {
    const response = await request(app)
      .post('/api/schools')
      .set('Authorization', `Bearer ${schoolToken}`)
      .send({ name: 'Northside Primary', location: 'North District', studentCount: 450, image: 'data:image/jpeg;base64,AA==' });

    expect(response.statusCode).toBe(201);
    expect(response.body.data).toMatchObject({ name: 'Northside Primary', location: 'North District', studentCount: 450, image: 'data:image/jpeg;base64,AA==' });

    const updateResponse = await request(app)
      .put(`/api/schools/${response.body.data.id}`)
      .set('Authorization', `Bearer ${schoolToken}`)
      .send({ image: 'data:image/png;base64,AA==' });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.data.image).toBe('data:image/png;base64,AA==');

    const unauthorizedResponse = await request(app)
      .put(`/api/schools/${response.body.data.id}`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ image: null });
    expect(unauthorizedResponse.statusCode).toBe(403);
  });

  it('allows administrators to register schools', async () => {
    const response = await request(app)
      .post('/api/schools')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin Registered School', location: 'South District' });

    expect(response.statusCode).toBe(201);
    expect(response.body.data).toMatchObject({ name: 'Admin Registered School', studentCount: 0 });
  });

  it('allows providers to register a school with the default student count', async () => {
    const response = await request(app)
      .post('/api/schools')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ name: 'Provider Registered School', location: 'West District' });

    expect(response.statusCode).toBe(201);
    expect(response.body.data).toMatchObject({
      name: 'Provider Registered School',
      studentCount: 0,
      providerCount: 1,
      registeredBy: 'u-002'
    });
    const providerResponse = await request(app).get('/api/providers/p-001');
    expect(providerResponse.body.data.schoolIds).toContain(response.body.data.id);
  });

  it('shows all providers and associated counts to anyone viewing a school', async () => {
    const schoolResponse = await request(app)
      .post('/api/schools')
      .set('Authorization', `Bearer ${schoolToken}`)
      .send({ name: 'Provider Directory School', location: 'Central District' });
    const schoolId = schoolResponse.body.data.id;

    const coverageResponse = await request(app)
      .put('/api/providers/p-001/schools')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ schoolIds: [schoolId] });
    expect(coverageResponse.statusCode).toBe(200);

    const providersResponse = await request(app).get(`/api/schools/${schoolId}/providers`);

    expect(providersResponse.statusCode).toBe(200);
    expect(providersResponse.body.data).toEqual([
      expect.objectContaining({ id: 'p-001', name: 'Sunrise Kitchen' })
    ]);
    const updatedSchool = await request(app).get(`/api/schools/${schoolId}`);
    expect(updatedSchool.body.data.providerCount).toBe(1);
    const formerSchool = await request(app).get('/api/schools/s-001');
    expect(formerSchool.body.data.providerCount).toBe(1);

    const customerProvidersResponse = await request(app).get('/api/schools/s-001/providers');
    expect(customerProvidersResponse.statusCode).toBe(200);
  });

  it('prevents customer accounts from registering schools', async () => {
    const response = await request(app)
      .post('/api/schools')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Unverified School', location: 'Anywhere' });

    expect(response.statusCode).toBe(403);
  });

  it('rejects menu creation by a customer', async () => {
    const response = await request(app)
      .post('/api/providers/p-001/menu')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Unauthorized Dish', price: 10 });

    expect(response.statusCode).toBe(403);
  });
});
