const client = require('prom-client');
const register = new client.Registry();


client.collectDefaultMetrics({ register });


const ordersCreatedCounter = new client.Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['status'],
  registers: [register]
});

const inventoryCallsCounter = new client.Counter({
  name: 'inventory_calls_total',
  help: 'Total number of calls to inventory service',
  labelNames: ['status'],
  registers: [register]
});

const orderProcessingDuration = new client.Histogram({
  name: 'order_processing_duration_seconds',
  help: 'Order processing duration in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  registers: [register]
});

const circuitBreakerEvents = new client.Counter({
  name: 'circuit_breaker_events_total',
  help: 'Total circuit breaker state changes',
  labelNames: ['event'],
  registers: [register]
});

const inventoryCallDuration = new client.Histogram({
  name: 'inventory_call_duration_seconds',
  help: 'Duration of calls to inventory service',
  buckets: [0.1, 0.5, 1, 2, 3, 5],
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
  ordersCreatedCounter,
  inventoryCallsCounter,
  orderProcessingDuration,
  circuitBreakerState,
  circuitBreakerEvents,
  inventoryCallDuration,
  httpRequestsCounter,
  httpRequestDuration
};
