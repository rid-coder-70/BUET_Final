const express = require('express');
const { getCircuitBreakerStats } = require('../services/inventoryClient');

const router = express.Router();

get('/stats', (req, res) => {
  const stats = getCircuitBreakerStats();
  res.json(stats);
});

module.exports = router;
