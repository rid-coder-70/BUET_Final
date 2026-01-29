let requestCounter = 0;

const crashSimulator = (req, res, next) => {
  if (req.path === '/health' || req.path === '/' || req.path.includes('/gremlin')) {
    return next();
  }

  const enabled = process.env.ENABLE_CRASH_SIMULATION === 'true';
  
  if (!enabled) {
    return next();
  }
  const crashProbability = parseFloat(process.env.CRASH_PROBABILITY) || 0.1; 
  const crashType = process.env.CRASH_TYPE || 'random'; 

  requestCounter++;

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  let responseSent = false;

  res.json = function(body) {
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


function decideShouldCrash(crashType, probability, counter) {
  if (crashType === 'deterministic') {
    
    const frequency = parseInt(process.env.CRASH_FREQUENCY) || 10;
    return (counter % frequency === 0);
  } else if (crashType === 'random') {
    return Math.random() < probability;
  }
  return false;
}


function simulateCrash(req, statusCode) {
  const crashMode = process.env.CRASH_MODE || 'connection_reset';
  
  console.log('');
  console.log('CRASH SIMULATION ACTIVATED!');
  console.log(`Request: ${req.method} ${req.path}`);
  console.log(`Status was going to be: ${statusCode}`);
  console.log(`Database operation: COMPLETED `);
  console.log(`Response: NEVER SENT `);
  console.log(`Crash Mode: ${crashMode}`);
  console.log('');

  if (crashMode === 'connection_reset') {
    req.socket.destroy();
  } else if (crashMode === 'internal_error') {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Service encountered an unexpected error'
    });
  } else if (crashMode === 'timeout') {
    
  }
}


const getCrashStats = () => {
  return {
    enabled: process.env.ENABLE_CRASH_SIMULATION === 'true',
    totalRequests: requestCounter,
    crashProbability: parseFloat(process.env.CRASH_PROBABILITY) || 0.1,
    crashType: process.env.CRASH_TYPE || 'random',
    crashMode: process.env.CRASH_MODE || 'connection_reset'
  };
};


const resetCrashSimulator = () => {
  requestCounter = 0;
};

module.exports = {
  crashSimulator,
  getCrashStats,
  resetCrashSimulator
};
