let requestCounter = 0;


const latencyGremlin = async (req, res, next) => {

  if (req.path === '/health' || req.path === '/') {
    return next();
  }

  const enabled = process.env.ENABLE_GREMLIN === 'true';
  
  if (!enabled) {
    return next();
  }

  
  const latencyMs = parseInt(process.env.GREMLIN_LATENCY_MS) || 3000;
  const frequency = parseInt(process.env.GREMLIN_FREQUENCY) || 5;
  const pattern = process.env.GREMLIN_PATTERN || 'deterministic';

  requestCounter++;

  let shouldDelay = false;

 
  if (pattern === 'deterministic') {
    shouldDelay = (requestCounter % frequency === 0);
  }
  else if (pattern === 'random') {
    shouldDelay = (Math.random() < (1 / frequency));
  }

  if (shouldDelay) {
    console.log(`GREMLIN ACTIVATED: Delaying request #${requestCounter} by ${latencyMs}ms`);
    console.log(`   Path: ${req.method} ${req.path}`);
    
    
    res.setHeader('X-Gremlin-Delay', latencyMs);
    
  
    await new Promise(resolve => setTimeout(resolve, latencyMs));
    
    console.log(`GREMLIN RELEASED: Request #${requestCounter} proceeding`);
  }

  next();
};


const getGremlinStats = () => {
  return {
    enabled: process.env.ENABLE_GREMLIN === 'true',
    totalRequests: requestCounter,
    latencyMs: parseInt(process.env.GREMLIN_LATENCY_MS) || 3000,
    frequency: parseInt(process.env.GREMLIN_FREQUENCY) || 5,
    pattern: process.env.GREMLIN_PATTERN || 'deterministic'
  };
};


const resetGremlin = () => {
  requestCounter = 0;
};

module.exports = {
  latencyGremlin,
  getGremlinStats,
  resetGremlin
};
