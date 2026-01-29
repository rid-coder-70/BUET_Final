const express = require('express');
const { getCircuitBreakerStats } = require('../services/inventoryClient');

const router = express.Router();

/**
 * Get resilience statistics (circuit breaker, retry stats)
 * GET /api/resilience/stats
 */
router.get('/stats', (req, res) => {
  const stats = getCircuitBreakerStats();
  res.json(stats);
});

module.exports = router;
