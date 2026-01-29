/**
 * Latency Gremlin Middleware
 * 
 * Simulates network latency in a deterministic pattern to test resilience.
 * This helps verify timeout/retry logic in dependent services.
 */

let requestCounter = 0;

/**
 * Middleware that introduces artificial latency based on configuration
 */
const latencyGremlin = async (req, res, next) => {
  // Skip latency for health checks
  if (req.path === '/health' || req.path === '/') {
    return next();
  }

  // Check if gremlin is enabled
  const enabled = process.env.ENABLE_GREMLIN === 'true';
  
  if (!enabled) {
    return next();
  }

  // Configuration
  const latencyMs = parseInt(process.env.GREMLIN_LATENCY_MS) || 3000;
  const frequency = parseInt(process.env.GREMLIN_FREQUENCY) || 5;
  const pattern = process.env.GREMLIN_PATTERN || 'deterministic';

  requestCounter++;

  let shouldDelay = false;

  // Deterministic pattern: every Nth request gets delayed
  if (pattern === 'deterministic') {
    shouldDelay = (requestCounter % frequency === 0);
  }
  // Random pattern: delay with probability of 1/frequency
  else if (pattern === 'random') {
    shouldDelay = (Math.random() < (1 / frequency));
  }

  if (shouldDelay) {
    console.log(`🐛 GREMLIN ACTIVATED: Delaying request #${requestCounter} by ${latencyMs}ms`);
    console.log(`   Path: ${req.method} ${req.path}`);
    
    // Add header to indicate gremlin was active
    res.setHeader('X-Gremlin-Delay', latencyMs);
    
    // Introduce artificial delay
    await new Promise(resolve => setTimeout(resolve, latencyMs));
    
    console.log(`✅ GREMLIN RELEASED: Request #${requestCounter} proceeding`);
  }

  next();
};

/**
 * Get current gremlin stats
 */
const getGremlinStats = () => {
  return {
    enabled: process.env.ENABLE_GREMLIN === 'true',
    totalRequests: requestCounter,
    latencyMs: parseInt(process.env.GREMLIN_LATENCY_MS) || 3000,
    frequency: parseInt(process.env.GREMLIN_FREQUENCY) || 5,
    pattern: process.env.GREMLIN_PATTERN || 'deterministic'
  };
};

/**
 * Reset request counter (useful for testing)
 */
const resetGremlin = () => {
  requestCounter = 0;
};

module.exports = {
  latencyGremlin,
  getGremlinStats,
  resetGremlin
};
