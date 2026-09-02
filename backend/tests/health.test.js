const request = require('supertest');
const app = require('../server');

describe('Health endpoint', () => {
  it('should return ok status', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
