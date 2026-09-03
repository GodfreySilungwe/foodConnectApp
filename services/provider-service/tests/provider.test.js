const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');

const providerToken = jwt.sign({ userId: 'u-002', role: 'provider' }, 'foodconnect-development-secret');
const newProviderToken = jwt.sign({ userId: 'u-004', role: 'provider', providerId: 'p-004' }, 'foodconnect-development-secret');
const customerToken = jwt.sign({ userId: 'u-001', role: 'customer' }, 'foodconnect-development-secret');

describe('Provider service', () => {
  it('registers a provider', async () => {
    const response = await request(app)
      .post('/api/providers')
      .set('Authorization', `Bearer ${newProviderToken}`)
      .send({
        name: 'Green Bowl',
        ownerName: 'Jane Doe',
        email: 'green@example.com',
        status: 'active'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Green Bowl');

    const duplicateResponse = await request(app)
      .post('/api/providers')
      .set('Authorization', `Bearer ${newProviderToken}`)
      .send({ name: 'Second Kitchen', ownerName: 'Jane Doe', email: 'second@example.com' });

    expect(duplicateResponse.statusCode).toBe(409);
  });

  it('creates a menu item for a provider', async () => {
    const response = await request(app)
      .post('/api/providers/p-001/menu')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        name: 'Beef Burger',
        price: 18.5,
        available: true
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Beef Burger');
  });

  it('lists menu items for a provider', async () => {
    const response = await request(app).get('/api/providers/p-001/menu');

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'm-101', name: 'Chicken Rice', price: 22.5 })
    ]));
  });

  it('rejects menu creation by a customer', async () => {
    const response = await request(app)
      .post('/api/providers/p-001/menu')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Unauthorized Dish', price: 10 });

    expect(response.statusCode).toBe(403);
  });
});
