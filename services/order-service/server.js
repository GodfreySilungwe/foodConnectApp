const express = require('express');
const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

app.get('/api/orders', (req, res) => {
  res.json({
    orders: [
      {
        id: 'o-1001',
        customerId: 'u-001',
        providerId: 'p-001',
        status: 'pending',
        total: 42.5
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Order service listening on port ${PORT}`);
});
