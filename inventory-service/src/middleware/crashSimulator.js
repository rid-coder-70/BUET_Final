/**
 * Crash Simulation Middleware
 * 
 * Simulates service crashes and network failures AFTER database operations
 * to test idempotency and consistency guarantees.
 */

let requestCounter = 0;

/**
 * Middleware that simulates crashes after successful database operations
 */
const crashSimulator = (req, res, next) => {
  // Skip crash simulation for health checks and gremlin endpoints
  if (req.path === '/health' || req.path === '/' || req.path.includes('/gremlin')) {
    return next();
  }

  // Check if crash simulation is enabled
  const enabled = process.env.ENABLE_CRASH_SIMULATION === 'true';
  
  if (!enabled) {
    return next();
  }

  // Configuration
  const crashProbability = parseFloat(process.env.CRASH_PROBABILITY) || 0.1; // 10% chance
  const crashType = process.env.CRASH_TYPE || 'random'; // 'random', 'deterministic', or 'after-commit'

  requestCounter++;

  // Store original res.json and res.send to intercept responses
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  // Flag to track if response was already sent
  let responseSent = false;

  // Intercept successful responses (200-299 status codes)
  res.json = function(body) {
    if (responseSent) return;
    
    const statusCode = res.statusCode || 200;
    
    // Only simulate crash on successful operations
    if (statusCode >= 200 && statusCode < 300) {
      const shouldCrash = decideShouldCrash(crashType, crashProbability, requestCounter);
      
      if (shouldCrash) {
        simulateCrash(req, statusCode);
        responseSent = true;
        return;
      }
    }
    
    responseSent = true;
    return originalJson(body);
  };

  res.send = function(body) {
    if (responseSent) return;
    
    const statusCode = res.statusCode || 200;
    
    if (statusCode >= 200 && statusCode < 300) {
      const shouldCrash = decideShouldCrash(crashType, crashProbability, requestCounter);
      
      if (shouldCrash) {
        simulateCrash(req, statusCode);
        responseSent = true;
        return;
      }
    }
    
    responseSent = true;
    return originalSend(body);
  };

  next();
};

/**
 * Decide whether to crash based on crash type
 */
function decideShouldCrash(crashType, probability, counter) {
  if (crashType === 'deterministic') {
    // Every 10th request
    const frequency = parseInt(process.env.CRASH_FREQUENCY) || 10;
    return (counter % frequency === 0);
  } else if (crashType === 'random') {
    return Math.random() < probability;
  }
  return false;
}

/**
 * Simulate different types of crashes
 */
function simulateCrash(req, statusCode) {
  const crashMode = process.env.CRASH_MODE || 'connection_reset';
  
  console.log('');
  console.log('💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥');
  console.log('💥 CRASH SIMULATION ACTIVATED!');
  console.log(`💥 Request: ${req.method} ${req.path}`);
  console.log(`💥 Status was going to be: ${statusCode}`);
  console.log(`💥 Database operation: COMPLETED ✅`);
  console.log(`💥 Response: NEVER SENT ❌`);
  console.log(`💥 Crash Mode: ${crashMode}`);
  console.log('💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥💥');
  console.log('');

  if (crashMode === 'connection_reset') {
    // Simulate sudden connection termination (most realistic)
    // The response is destroyed without sending anything
    req.socket.destroy();
  } else if (crashMode === 'internal_error') {
    // Send 500 error instead of success
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Service encountered an unexpected error'
    });
  } else if (crashMode === 'timeout') {
    // Never respond (client will timeout)
    // Do nothing - connection stays open until client timeout
  }
}

/**
 * Get crash simulation stats
 */
const getCrashStats = () => {
  return {
    enabled: process.env.ENABLE_CRASH_SIMULATION === 'true',
    totalRequests: requestCounter,
    crashProbability: parseFloat(process.env.CRASH_PROBABILITY) || 0.1,
    crashType: process.env.CRASH_TYPE || 'random',
    crashMode: process.env.CRASH_MODE || 'connection_reset'
  };
};

/**
 * Reset crash counter
 */
const resetCrashSimulator = () => {
  requestCounter = 0;
};

module.exports = {
  crashSimulator,
  getCrashStats,
  resetCrashSimulator
};
