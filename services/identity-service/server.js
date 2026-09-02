const express = require('express');
const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'identity-service' });
});

app.get('/api/users', (req, res) => {
  res.json({
    users: [
      { id: 'u-001', name: 'Demo Customer', role: 'customer' },
      { id: 'u-002', name: 'Demo Provider', role: 'provider' }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Identity service listening on port ${PORT}`);
});
