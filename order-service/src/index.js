const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');
require('dotenv').config();

// Import routes
const healthRoute = require('./routes/health');
const ordersRoute = require('./routes/orders');
const resilienceRoute = require('./routes/resilience');
const metricsRoute = require('./routes/metrics');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRoute);
app.use('/api/orders', ordersRoute);
app.use('/api/resilience', resilienceRoute);
app.use('/metrics', metricsRoute);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'order-service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      orders: '/api/orders'
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
      console.log(`🚀 Order Service running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📍 API endpoints: http://localhost:${PORT}/api/orders`);
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
