const express = require('express');
const { getGremlinStats, resetGremlin } = require('../middleware/gremlin');
const { getCrashStats, resetCrashSimulator } = require('../middleware/crashSimulator');

const router = express.Router();

/**
 * Get gremlin statistics
 * GET /api/gremlin/stats
 */
router.get('/stats', (req, res) => {
  const stats = getGremlinStats();
  res.json(stats);
});

/**
 * Reset gremlin counter
 * POST /api/gremlin/reset
 */
router.post('/reset', (req, res) => {
  resetGremlin();
  res.json({
    message: 'Gremlin counter reset',
    stats: getGremlinStats()
  });
});

/**
 * Get crash simulator statistics
 * GET /api/gremlin/crash-stats
 */
router.get('/crash-stats', (req, res) => {
  const stats = getCrashStats();
  res.json(stats);
});

/**
 * Reset crash simulator counter
 * POST /api/gremlin/crash-reset
 */
router.post('/crash-reset', (req, res) => {
  resetCrashSimulator();
  res.json({
    message: 'Crash simulator counter reset',
    stats: getCrashStats()
  });
});

module.exports = router;
