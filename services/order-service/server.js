const express = require('express');

const createApp = () => {
  const app = express();
  app.use(express.json());

  const orders = [
    {
      id: 'o-1001',
      customerId: 'u-001',
      providerId: 'p-001',
      status: 'pending',
      total: 42.5
    }
  ];

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'order-service' });
  });

  app.get('/api/orders', (req, res) => {
    res.json({ success: true, data: orders });
  });

  app.post('/api/orders', (req, res) => {
    const { customerId, providerId, items, scheduledFor, deliveryType } = req.body || {};

    if (!customerId || !providerId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['customerId, providerId, and at least one item are required']
      });
    }

    const total = items.reduce((sum, item) => {
      const itemPrice = Number(item.price || 0);
      return sum + itemPrice * Number(item.quantity || 0);
    }, 0);

    const newOrder = {
      id: `o-${Date.now()}`,
      customerId,
      providerId,
      items,
      scheduledFor: scheduledFor || null,
      deliveryType: deliveryType || 'collection',
      status: 'pending',
      total
    };

    orders.push(newOrder);

    return res.status(201).json({
      success: true,
      data: newOrder,
      message: 'Order created successfully'
    });
  });

  return app;
};

if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3004;
  app.listen(PORT, () => {
    console.log(`Order service listening on port ${PORT}`);
  });
}

module.exports = createApp();
