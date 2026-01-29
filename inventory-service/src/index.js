const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');
const { latencyGremlin } = require('./middleware/gremlin');
const { crashSimulator } = require('./middleware/crashSimulator');
require('dotenv').config();


const healthRoute = require('./routes/health');
const inventoryRoute = require('./routes/inventory');
const gremlinRoute = require('./routes/gremlin');
const metricsRoute = require('./routes/metrics');

const app = express();
const PORT = process.env.PORT || 3002;


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(latencyGremlin);


app.use(crashSimulator);


app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});


app.use('/health', healthRoute);
app.use('/api/inventory', inventoryRoute);
app.use('/api/gremlin', gremlinRoute);
app.use('/metrics', metricsRoute);


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


app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

const startServer = async () => {
  try {
    
    const dbConnected = await connectDB();
    
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`Inventory Service running on port ${PORT}`);
      console.log(`Health check: http://104.214.168.187:${PORT}/health`);
      console.log(`API endpoints: http://104.214.168.187:${PORT}/api/inventory`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
