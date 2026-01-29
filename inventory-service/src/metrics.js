const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const inventoryUpdatesCounter = new client.Counter({
  name: 'inventory_updates_total',
  help: 'Total number of inventory updates',
  labelNames: ['product_id', 'result'],
  registers: [register]
});

const stockLevelGauge = new client.Gauge({
  name: 'inventory_stock_level',
  help: 'Current stock level for products',
  labelNames: ['product_id', 'product_name'],
  registers: [register]
});

const gremlinActivationsCounter = new client.Counter({
  name: 'gremlin_activations_total',
  help: 'Total number of gremlin activations',
  labelNames: ['type'],
  registers: [register]
});

const crashSimulationsCounter = new client.Counter({
  name: 'crash_simulations_total',
  help: 'Total number of crash simulations',
  registers: [register]
});

const inventoryQueryDuration = new client.Histogram({
  name: 'inventory_query_duration_seconds',
  help: 'Duration of inventory queries',
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

const httpRequestsCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

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
