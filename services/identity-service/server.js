const express = require('express');

const createApp = () => {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json());

  const users = [
    { id: 'u-001', name: 'Demo Customer', email: 'customer@example.com', password: '123456', role: 'customer' },
    { id: 'u-002', name: 'Demo Provider', email: 'provider@example.com', password: '123456', role: 'provider' }
  ];

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'identity-service' });
  });

  app.get('/api/users', (req, res) => {
    res.json({ users });
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, role } = req.body || {};

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['name, email, password, and role are required']
      });
    }

    const exists = users.some((user) => user.email === email);
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    const newUser = {
      id: `u-${Date.now()}`,
      name,
      email,
      password,
      role
    };

    users.push(newUser);

    return res.status(201).json({
      success: true,
      data: {
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      },
      message: 'User registered successfully'
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['email and password are required']
      });
    }

    const user = users.find((entry) => entry.email === email && entry.password === password);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        token: `mock-token-${user.id}`,
        user: {
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      },
      message: 'Login successful'
    });
  });

  return app;
};

if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`Identity service listening on port ${PORT}`);
  });
}

module.exports = createApp();
