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

  const providers = [
    {
      id: 'p-001',
      name: 'Sunrise Kitchen',
      ownerName: 'Alice',
      email: 'sunrise@example.com',
      status: 'active'
    }
  ];

  const menuItems = [
    { id: 'm-101', providerId: 'p-001', name: 'Chicken Rice', price: 22.5, available: true }
  ];

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'provider-service' });
  });

  app.get('/api/providers', (req, res) => {
    res.json({ success: true, data: providers });
  });

  app.post('/api/providers', (req, res) => {
    const { name, ownerName, email, status } = req.body || {};

    if (!name || !ownerName || !email) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['name, ownerName, and email are required']
      });
    }

    const newProvider = {
      id: `p-${Date.now()}`,
      name,
      ownerName,
      email,
      status: status || 'active'
    };

    providers.push(newProvider);

    return res.status(201).json({
      success: true,
      data: newProvider,
      message: 'Provider registered successfully'
    });
  });

  app.post('/api/providers/:providerId/menu', (req, res) => {
    const { providerId } = req.params;
    const { name, price, available } = req.body || {};

    if (!name || typeof price !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['name and numeric price are required']
      });
    }

    const newItem = {
      id: `m-${Date.now()}`,
      providerId,
      name,
      price,
      available: available !== false
    };

    menuItems.push(newItem);

    return res.status(201).json({
      success: true,
      data: newItem,
      message: 'Menu item created successfully'
    });
  });

  return app;
};

if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3003;
  app.listen(PORT, () => {
    console.log(`Provider service listening on port ${PORT}`);
  });
}

module.exports = createApp();
