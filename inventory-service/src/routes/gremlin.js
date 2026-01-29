const express = require('express');
const { getGremlinStats, resetGremlin } = require('../middleware/gremlin');
const { getCrashStats, resetCrashSimulator } = require('../middleware/crashSimulator');

const router = express.Router();

router.get('/stats', (req, res) => {
  const stats = getGremlinStats();
  res.json(stats);
});


router.post('/reset', (req, res) => {
  resetGremlin();
  res.json({
    message: 'Gremlin counter reset',
    stats: getGremlinStats()
  });
});


router.get('/crash-stats', (req, res) => {
  const stats = getCrashStats();
  res.json(stats);
});


router.post('/crash-reset', (req, res) => {
  resetCrashSimulator();
  res.json({
    message: 'Crash simulator counter reset',
    stats: getCrashStats()
  });
});

module.exports = router;
