const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { createPaymentRepository } = require('../repositories');
const { withOrderKeys, withPaymentKeys } = require('../schema');

const customerToken = jwt.sign({ userId: 'u-001', role: 'customer', district: 'Lilongwe' }, 'foodconnect-development-secret');
const providerToken = jwt.sign({ userId: 'u-002', role: 'provider', providerId: 'p-001' }, 'foodconnect-development-secret');
const otherCustomerToken = jwt.sign({ userId: 'u-999', role: 'customer' }, 'foodconnect-development-secret');
const unrelatedCustomerToken = jwt.sign({ userId: 'u-998', role: 'customer' }, 'foodconnect-development-secret');
const otherProviderToken = jwt.sign({ userId: 'u-998', role: 'provider', providerId: 'p-999' }, 'foodconnect-development-secret');

describe('Order service', () => {
  it('allows browser preflight for provider status updates', async () => {
    const response = await request(app)
      .options('/api/orders/o-1001/status')
      .set('Access-Control-Request-Method', 'PATCH');

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-methods']).toContain('PATCH');
  });

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
        studentName: 'Taylor Smith',
        studentClass: 'Year 4',
        schoolId: 's-001',
        schoolName: 'FoodConnect Central Campus',
        foodPreferences: 'No peanuts; mild spice',
        deliveryType: 'delivery'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('pending');
    expect(response.body.data).toMatchObject({
      studentName: 'Taylor Smith',
      studentClass: 'Year 4',
      schoolId: 's-001',
      district: 'Lilongwe',
      foodPreferences: 'No peanuts; mild spice'
    });
  });

  it('allows parents to order from any provider for any school', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        providerId: 'p-888',
        items: [{ menuId: 'm-999', quantity: 1, price: 12 }],
        studentName: 'Jordan Lee',
        studentClass: 'Year 2',
        schoolId: 's-999',
        schoolName: 'Any Registered School'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.data).toMatchObject({ providerId: 'p-888', schoolId: 's-999' });
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

  it('returns only the authenticated kitchen orders for a requested service date', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const response = await request(app)
      .get(`/api/orders?date=${today}&providerId=p-999`)
      .set('Authorization', `Bearer ${providerToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'o-1001', providerId: 'p-001' })
    ]));
    expect(response.body.data.every((order) => order.providerId === 'p-001')).toBe(true);
  });

  it('rejects invalid or excessively wide order query windows', async () => {
    const invalidDate = await request(app)
      .get('/api/orders?date=2026-02-30')
      .set('Authorization', `Bearer ${providerToken}`);
    const incompleteRange = await request(app)
      .get('/api/orders?from=2026-10-01T00:00:00Z')
      .set('Authorization', `Bearer ${providerToken}`);
    const wideRange = await request(app)
      .get('/api/orders?from=2026-01-01T00:00:00Z&to=2026-03-01T00:00:00Z')
      .set('Authorization', `Bearer ${providerToken}`);

    expect(invalidDate.statusCode).toBe(400);
    expect(incompleteRange.statusCode).toBe(400);
    expect(wideRange.statusCode).toBe(400);
  });

  it('allows a kitchen to query its payment ledger by date', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const response = await request(app)
      .get(`/api/payments?date=${today}`)
      .set('Authorization', `Bearer ${providerToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('does not allow a customer to access the kitchen payment ledger', async () => {
    const response = await request(app)
      .get('/api/payments?date=2026-10-08')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.statusCode).toBe(403);
  });

  it('builds stable, sharded order and payment keys', async () => {
    const order = withOrderKeys({
      id: 'o-key-check',
      providerId: 'p-001',
      customerId: 'u-001',
      scheduledFor: '2026-10-08T12:00:00Z',
    });
    const payment = withPaymentKeys({
      paymentId: 'pay-key-check',
      providerId: 'p-001',
      orderId: order.id,
      settledAt: '2026-10-08T13:00:00Z',
    });

    expect(order.pk).toBe('ORDER#o-key-check');
    expect(order.gsi1pk).toMatch(/^KITCHEN#p-001#DAY#20261008#SHARD#/);
    expect(order.gsi1pk).toBe(withOrderKeys({
      id: 'o-key-check',
      providerId: 'p-001',
      customerId: 'u-001',
      scheduledFor: '2026-10-08T12:00:00Z',
    }).gsi1pk);
    expect(payment.gsi1pk).toMatch(/^KITCHEN#p-001#DAY#20261008#SHARD#/);
    expect(payment.gsi3pk).toBe(`ORDER#${order.id}`);
  });

  it('filters payment records by kitchen, date, and order', async () => {
    const paymentRepository = createPaymentRepository([
      { paymentId: 'pay-1', providerId: 'p-001', orderId: 'o-1001', settledAt: '2026-10-08T12:00:00Z', amount: 42.5 },
      { paymentId: 'pay-2', providerId: 'p-999', orderId: 'o-9999', settledAt: '2026-10-08T12:00:00Z', amount: 12 },
      { paymentId: 'pay-3', providerId: 'p-001', orderId: 'o-1002', settledAt: '2026-10-09T12:00:00Z', amount: 25 },
    ]);

    await expect(paymentRepository.listByKitchenDate('p-001', '2026-10-08', '2026-10-08T00:00:00.000Z', '2026-10-08T23:59:59.999Z'))
      .resolves.toMatchObject({ items: [expect.objectContaining({ paymentId: 'pay-1' })], hasMore: false, nextCursor: null });
    await expect(paymentRepository.listByOrder('o-1001')).resolves.toMatchObject({
      items: [expect.objectContaining({ paymentId: 'pay-1' })],
      hasMore: false,
      nextCursor: null,
    });
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
      .send({ customerId: 'u-001', providerId: 'p-001', studentName: 'Taylor Smith', studentClass: 'Year 4', schoolId: 's-001', items: [{ menuId: 'm-101', quantity: 1, price: 22.5 }] });

    expect(response.statusCode).toBe(201);
    expect(response.body.data.customerId).toBe('u-999');
  });

  it('rejects an order without student and school details', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ providerId: 'p-001', items: [{ menuId: 'm-101', quantity: 1, price: 22.5 }] });

    expect(response.statusCode).toBe(400);
    expect(response.body.details).toContain('providerId, studentName, studentClass, schoolId, and at least one item are required');
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
