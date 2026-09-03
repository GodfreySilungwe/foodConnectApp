const request = require('supertest');
const app = require('../server');

describe('Provider service', () => {
  it('registers a provider', async () => {
    const response = await request(app)
      .post('/api/providers')
      .send({
        name: 'Green Bowl',
        ownerName: 'Jane Doe',
        email: 'green@example.com',
        status: 'active'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Green Bowl');
  });

  it('creates a menu item for a provider', async () => {
    const response = await request(app)
      .post('/api/providers/p-001/menu')
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
});
