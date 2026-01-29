const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const CircuitBreaker = require('opossum');


const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002';
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS) || 5000;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;


const CIRCUIT_BREAKER_OPTIONS = {
  timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 30000, 
  errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD) || 50, 
  resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT) || 10000 
};

const createAxiosInstance = () => {
  const instance = axios.create({
    baseURL: INVENTORY_SERVICE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  axiosRetry(instance, {
    retries: MAX_RETRIES,
    retryDelay: (retryCount) => {
      const delay = Math.pow(2, retryCount - 1) * 1000;
      console.log(`⏳ Retry attempt ${retryCount}/${MAX_RETRIES}, waiting ${delay}ms`);
      return delay;
    },
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
             (error.response && error.response.status >= 500);
    },
    onRetry: (retryCount, error, requestConfig) => {
      console.log(`🔄 Retrying request to ${requestConfig.url} (attempt ${retryCount}/${MAX_RETRIES})`);
    }
  });

  return instance;
};

const axiosInstance = createAxiosInstance();

const updateInventoryFunction = async (productId, quantity, orderId, idempotencyKey) => {
  console.log(`📦 Calling Inventory Service: productId=${productId}, quantity=${quantity}`);
  
  const startTime = Date.now();
  
  try {
    const response = await axiosInstance.post('/api/inventory/update', {
      productId,
      quantity,
      orderId,
      idempotencyKey
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Inventory updated successfully in ${elapsed}ms`);
    
    return response.data;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    
    if (error.code === 'ECONNABORTED') {
      console.error(`Request timeout after ${elapsed}ms (configured: ${REQUEST_TIMEOUT_MS}ms)`);
      throw new Error(`Inventory Service timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    
    if (error.response) {
      console.error(`Inventory Service error (${error.response.status}): ${error.response.data?.error || 'Unknown error'}`);
      throw new Error(error.response.data?.error || 'Inventory update failed');
    }
    
    console.error(`Network error: ${error.message}`);
    throw error;
  }
};


const inventoryCircuitBreaker = new CircuitBreaker(updateInventoryFunction, CIRCUIT_BREAKER_OPTIONS);

inventoryCircuitBreaker.on('open', () => {
  console.warn('CIRCUIT BREAKER OPEN: Too many failures, blocking requests to Inventory Service');
});

inventoryCircuitBreaker.on('halfOpen', () => {
  console.log('CIRCUIT BREAKER HALF-OPEN: Testing if Inventory Service recovered');
});

inventoryCircuitBreaker.on('close', () => {
  console.log('CIRCUIT BREAKER CLOSED: Inventory Service is healthy again');
});

inventoryCircuitBreaker.on('timeout', () => {
  console.warn('⏱CIRCUIT BREAKER TIMEOUT: Request took too long');
});

inventoryCircuitBreaker.on('fallback', (result) => {
  console.log('CIRCUIT BREAKER FALLBACK: Using fallback response');
});


const updateInventory = async (productId, quantity, orderId, idempotencyKey) => {
  try {
    const result = await inventoryCircuitBreaker.fire(productId, quantity, orderId, idempotencyKey);
    return { success: true, data: result };
  } catch (error) {
   
    if (inventoryCircuitBreaker.opened) {
      return {
        success: false,
        error: 'Inventory Service temporarily unavailable (circuit breaker open)',
        circuitBreakerOpen: true
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to update inventory',
      circuitBreakerOpen: false
    };
  }
};


const getCircuitBreakerStats = () => {
  return {
    state: inventoryCircuitBreaker.opened ? 'open' : 
           inventoryCircuitBreaker.halfOpen ? 'half-open' : 'closed',
    stats: inventoryCircuitBreaker.stats,
    config: {
      timeout: CIRCUIT_BREAKER_OPTIONS.timeout,
      errorThresholdPercentage: CIRCUIT_BREAKER_OPTIONS.errorThresholdPercentage,
      resetTimeout: CIRCUIT_BREAKER_OPTIONS.resetTimeout,
      requestTimeout: REQUEST_TIMEOUT_MS,
      maxRetries: MAX_RETRIES
    }
  };
};

module.exports = {
  updateInventory,
  getCircuitBreakerStats
};
