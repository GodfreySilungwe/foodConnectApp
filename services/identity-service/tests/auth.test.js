const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');

const adminToken = jwt.sign({ userId: 'u-003', role: 'admin' }, 'foodconnect-development-secret');

describe('Identity service auth', () => {
  it('registers a new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Smith',
        email: 'alice@example.com',
        password: 'Secret123!',
        role: 'customer'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('alice@example.com');
  });

  it('logs in an existing user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'customer@example.com',
        password: '123456'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.role).toBe('customer');
    expect(response.body.data.token).toBeTruthy();
  });

  it('rejects invalid login credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'customer@example.com',
        password: 'wrongpass'
      });

    expect(response.statusCode).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('allows an admin to list users without password data', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'admin', email: 'admin@example.com' })
    ]));
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('does not allow customers to list users', async () => {
    const customerToken = jwt.sign({ userId: 'u-001', role: 'customer' }, 'foodconnect-development-secret');
    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.statusCode).toBe(403);
  });

  it('does not allow self-registration as admin', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Imposter', email: 'imposter@example.com', password: 'Secret123!', role: 'admin' });

    expect(response.statusCode).toBe(400);
  });

  it('assigns a provider ID when registering a provider account', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New Provider', email: 'new-provider@example.com', password: 'Secret123!', role: 'provider' });

    expect(response.statusCode).toBe(201);
    expect(response.body.data.providerId).toMatch(/^p-/);
  });
});
