const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');

const customerToken = jwt.sign({ userId: 'u-001', role: 'customer' }, 'foodconnect-development-secret');

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
});
