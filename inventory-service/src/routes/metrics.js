const express = require('express');
const { register } = require('../metrics');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
});

module.exports = router;
