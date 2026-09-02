const express = require('express');

const createApp = () => {
  const app = express();

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'foodconnect-backend' });
  });

  app.get('/api', (req, res) => {
    res.json({ message: 'FoodConnect API is running.' });
  });

  return app;
};

if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`FoodConnect backend listening on port ${PORT}`);
  });
}

module.exports = createApp();
