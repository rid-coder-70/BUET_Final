const express = require('express');
const { sequelize } = require('../config/database');

const router = express.Router();


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
    await sequelize.authenticate();
    health.checks.database = 'connected';
  } catch (error) {
    health.checks.database = 'disconnected';
    health.status = 'unhealthy';
    health.error = error.message;
  }

  health.checks.inventoryService = 'not_configured';

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
