const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'foodconnect-backend' });
});

app.get('/api', (req, res) => {
  res.json({ message: 'FoodConnect API is running.' });
});

app.listen(PORT, () => {
  console.log(`FoodConnect backend listening on port ${PORT}`);
});
