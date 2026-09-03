const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');

const customerToken = jwt.sign({ userId: 'u-001', role: 'customer' }, 'foodconnect-development-secret');
const providerToken = jwt.sign({ userId: 'u-002', role: 'provider', providerId: 'p-001' }, 'foodconnect-development-secret');
const otherCustomerToken = jwt.sign({ userId: 'u-999', role: 'customer' }, 'foodconnect-development-secret');
const unrelatedCustomerToken = jwt.sign({ userId: 'u-998', role: 'customer' }, 'foodconnect-development-secret');
const otherProviderToken = jwt.sign({ userId: 'u-998', role: 'provider', providerId: 'p-999' }, 'foodconnect-development-secret');

describe('Order service', () => {
  it('creates a new order', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        customerId: 'u-001',
        providerId: 'p-001',
        items: [
          { menuId: 'm-101', quantity: 2, price: 22.5 }
        ],
        deliveryType: 'delivery'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('pending');
  });

  it('rejects order without required fields', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        customerId: 'u-001'
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('allows a provider to view and update an incoming order', async () => {
    const listResponse = await request(app)
      .get('/api/orders?providerId=p-001')
      .set('Authorization', `Bearer ${providerToken}`);

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'o-1001', status: 'pending' })
    ]));

    const updateResponse = await request(app)
      .patch('/api/orders/o-1001/status')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'accepted' });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.data.status).toBe('accepted');
  });

  it('rejects an invalid status transition', async () => {
    const response = await request(app)
      .patch('/api/orders/o-1001/status')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'completed' });

    expect(response.statusCode).toBe(400);
  });

  it('uses the authenticated customer as the order owner', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .send({ customerId: 'u-001', providerId: 'p-001', items: [{ menuId: 'm-101', quantity: 1, price: 22.5 }] });

    expect(response.statusCode).toBe(201);
    expect(response.body.data.customerId).toBe('u-999');
  });

  it('does not expose another provider’s incoming orders', async () => {
    const response = await request(app)
      .get('/api/orders?providerId=p-001')
      .set('Authorization', `Bearer ${otherProviderToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('returns only the authenticated customer’s history', async () => {
    const response = await request(app)
      .get('/api/orders?customerId=u-001')
      .set('Authorization', `Bearer ${unrelatedCustomerToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('allows an admin to view all orders', async () => {
    const adminToken = jwt.sign({ userId: 'u-003', role: 'admin' }, 'foodconnect-development-secret');
    const response = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'o-1001' })
    ]));
  });
});
