const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');
const { latencyGremlin } = require('./middleware/gremlin');
const { crashSimulator } = require('./middleware/crashSimulator');
require('dotenv').config();

// Import routes
const healthRoute = require('./routes/health');
const inventoryRoute = require('./routes/inventory');
const gremlinRoute = require('./routes/gremlin');
const metricsRoute = require('./routes/metrics');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Latency Gremlin (chaos engineering)
app.use(latencyGremlin);

// Crash Simulator (tests idempotency)
app.use(crashSimulator);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRoute);
app.use('/api/inventory', inventoryRoute);
app.use('/api/gremlin', gremlinRoute);
app.use('/metrics', metricsRoute);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'inventory-service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      inventory: '/api/inventory'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to database
    const dbConnected = await connectDB();
    
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Inventory Service running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📍 API endpoints: http://localhost:${PORT}/api/inventory`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
