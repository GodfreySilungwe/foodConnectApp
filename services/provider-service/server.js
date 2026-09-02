const express = require('express');
const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'provider-service' });
});

app.get('/api/providers', (req, res) => {
  res.json({
    providers: [
      {
        id: 'p-001',
        name: 'Sunrise Kitchen',
        status: 'active',
        menuCount: 7
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Provider service listening on port ${PORT}`);
});
