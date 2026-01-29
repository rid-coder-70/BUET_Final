const client = require('prom-client');

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom Metrics

// Counter: Total inventory updates
const inventoryUpdatesCounter = new client.Counter({
  name: 'inventory_updates_total',
  help: 'Total number of inventory updates',
  labelNames: ['product_id', 'result'],
  registers: [register]
});

// Gauge: Current stock levels
const stockLevelGauge = new client.Gauge({
  name: 'inventory_stock_level',
  help: 'Current stock level for products',
  labelNames: ['product_id', 'product_name'],
  registers: [register]
});

// Counter: Gremlin activations
const gremlinActivationsCounter = new client.Counter({
  name: 'gremlin_activations_total',
  help: 'Total number of gremlin activations',
  labelNames: ['type'],
  registers: [register]
});

// Counter: Crash simulations
const crashSimulationsCounter = new client.Counter({
  name: 'crash_simulations_total',
  help: 'Total number of crash simulations',
  registers: [register]
});

// Histogram: Inventory query duration
const inventoryQueryDuration = new client.Histogram({
  name: 'inventory_query_duration_seconds',
  help: 'Duration of inventory queries',
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

// Counter: HTTP requests
const httpRequestsCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

// Histogram: HTTP request duration
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

module.exports = {
  register,
  inventoryUpdatesCounter,
  stockLevelGauge,
  gremlinActivationsCounter,
  crashSimulationsCounter,
  inventoryQueryDuration,
  httpRequestsCounter,
  httpRequestDuration
};
