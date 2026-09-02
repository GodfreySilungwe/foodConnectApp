const request = require('supertest');
const app = require('../server');

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
});
