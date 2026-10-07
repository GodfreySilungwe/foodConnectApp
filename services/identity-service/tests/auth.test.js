const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');

const adminToken = jwt.sign({ userId: 'u-003', role: 'admin' }, 'foodconnect-development-secret');
const superAdminToken = jwt.sign({ userId: 'u-super-admin', role: 'superadmin' }, 'foodconnect-development-secret');

describe('Identity service auth', () => {
  it('registers a new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Smith',
        email: 'alice@example.com',
        password: 'Secret123!',
        role: 'customer',
        latitude: -13.9626,
        longitude: 33.7741
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('alice@example.com');
  });

  it('seeds the requested development super-admin account', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@admin.com', password: '123456' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.user.role).toBe('superadmin');
  });

  it('allows super-admins to suspend, delete, and restore customer accounts', async () => {
    const registration = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Managed Parent', email: 'managed-parent@example.com', password: 'Secret123!', role: 'customer', latitude: -13.9, longitude: 33.7 });
    const userId = registration.body.data.userId;
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'managed-parent@example.com', password: 'Secret123!' });

    const suspended = await request(app)
      .patch(`/api/admin/users/${userId}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'suspended' });
    expect(suspended.statusCode).toBe(200);
    expect(suspended.body.data.status).toBe('suspended');

    const inactiveSession = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${login.body.data.token}`);
    expect(inactiveSession.statusCode).toBe(403);

    const blockedLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'managed-parent@example.com', password: 'Secret123!' });
    expect(blockedLogin.statusCode).toBe(403);

    const deleted = await request(app)
      .patch(`/api/admin/users/${userId}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'deleted' });
    expect(deleted.body.data.status).toBe('deleted');

    const restored = await request(app)
      .patch(`/api/admin/users/${userId}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'active' });
    expect(restored.body.data.status).toBe('active');
    expect(restored.statusCode).toBe(200);
  });

  it('treats email duplicates as the same account regardless of casing or whitespace', async () => {
    const firstResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Case Test Parent',
        email: ' case-test@example.com ',
        password: 'Secret123!',
        role: 'customer',
        latitude: -13.9626,
        longitude: 33.7741
      });

    const secondResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Case Test Parent Again',
        email: 'CASE-TEST@EXAMPLE.COM',
        password: 'Secret123!',
        role: 'customer',
        latitude: -13.9626,
        longitude: 33.7741
      });

    expect(firstResponse.statusCode).toBe(201);
    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.body.error).toBe('User already exists');
  });

  it('stores parent coordinates when registering a customer account', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Parent With Coordinates',
        email: 'parent-coords@example.com',
        password: 'Secret123!',
        phone: '+265 991 123 456',
        role: 'customer',
        latitude: -13.9626,
        longitude: 33.7741
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.latitude).toBe(-13.9626);
    expect(response.body.data.longitude).toBe(33.7741);
    expect(response.body.data.phone).toBe('+265 991 123 456');

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'parent-coords@example.com', password: 'Secret123!' });
    expect(loginResponse.body.data.user.phone).toBe('+265 991 123 456');
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

  it('registers a school administrator account', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'School Office', email: 'school-office@example.com', password: 'Secret123!', role: 'school' });

    expect(response.statusCode).toBe(201);
    expect(response.body.data.role).toBe('school');
  });
});
