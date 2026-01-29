const express = require('express');
const { sequelize } = require('../config/database');

const router = express.Router();

/**
 * Health check endpoint with dependency validation
 * Returns 200 if healthy, 503 if unhealthy
 */
router.get('/', async (req, res) => {
  const health = {
    service: 'order-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      inventoryService: 'unknown'
    }
  };

  try {
    // Check database connectivity
    await sequelize.authenticate();
    health.checks.database = 'connected';
  } catch (error) {
    health.checks.database = 'disconnected';
    health.status = 'unhealthy';
    health.error = error.message;
  }

  // TODO: Add inventory service health check in Phase 1
  // For now, mark as not checked
  health.checks.inventoryService = 'not_configured';

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
