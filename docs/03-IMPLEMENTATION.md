# Implementation Process

This document provides a detailed walkthrough of how we implemented the Valerix Microservices system, phase by phase.

---

## 🚀 Phase 1: Foundational Microservices

### Goal

Build basic Order and Inventory services with Docker and PostgreSQL.

### Step 1.1: Project Structure

```bash
valerix-microservices/
├── order-service/
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── index.js
│       ├── config/database.js
│       ├── models/Order.js
│       └── routes/

├── inventory-service/
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── index.js
│       ├── config/database.js
│       ├── models/Product.js
│       └── routes/inventory.js

├── docker-compose.yml
└── scripts/seed-data.sql
```

### Step 1.2: Order Service Implementation

**`order-service/package.json`:**

```json
{
  "name": "order-service",
  "dependencies": {
    "express": "^4.18.2",
    "sequelize": "^6.32.1",
    "pg": "^8.11.0",
    "cors": "^2.8.5",
    "uuid": "^9.0.0",
    "dotenv": "^16.3.1"
  }
}
```

**Why these packages?**

- `express`: Web framework
- `sequelize`: ORM for PostgreSQL
- `pg`: PostgreSQL driver
- `cors`: Enable cross-origin requests (for UI)
- `uuid`: Generate unique order IDs
- `dotenv`: Environment variables

**`order-service/src/index.js`:** (simplified)

```javascript
const express = require("express");
const cors = require("cors");
const orderRoutes = require("./routes/orders");
const healthRoutes = require("./routes/health");

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/health", healthRoutes);
app.use("/api/orders", orderRoutes);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});
```

**`order-service/src/config/database.js`:**

```javascript
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "order_db",
  username: process.env.DB_USER || "order_user",
  password: process.env.DB_PASSWORD || "order_password",
  logging: false,
  pool: {
    max: 20,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

module.exports = sequelize;
```

**Connection pooling configuration:**

- `max: 20`: Maximum 20 concurrent connections
- `min: 0`: Release idle connections
- `acquire: 30000`: 30s timeout for getting connection
- `idle: 10000`: Release after 10s idle

**`order-service/src/models/Order.js`:**

```javascript
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Order = sequelize.define(
  "order",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "customer_id",
    },
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "product_id",
    },
    productName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "product_name",
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 },
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "pending",
    },
    inventoryUpdated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "inventory_updated",
    },
  },
  {
    tableName: "orders",
    underscored: true,
  },
);

module.exports = Order;
```

### Step 1.3: Dockerfile

**`order-service/Dockerfile`:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY src ./src

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["node", "src/index.js"]
```

**Why alpine?**

- Smaller image size (~50MB vs ~900MB)
- Faster builds
- Reduced attack surface

**Health check command:**

- Checks every 30s
- Timeout after 3s
- Retries 3 times before marking unhealthy

### Step 1.4: Docker Compose

**`docker-compose.yml`:** (simplified)

```yaml
version: "3.8"

services:
  postgres-order:
    image: postgres:15-alpine
    container_name: valerix-postgres-order
    environment:
      POSTGRES_DB: order_db
      POSTGRES_USER: order_user
      POSTGRES_PASSWORD: order_password
    ports:
      - "5432:5432"
    volumes:
      - order-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U order_user -d order_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  order-service:
    build: ./order-service
    container_name: valerix-order-service
    ports:
      - "3001:3001"
    environment:
      DB_HOST: postgres-order
      DB_PORT: 5432
      DB_NAME: order_db
      DB_USER: order_user
      DB_PASSWORD: order_password
    depends_on:
      postgres-order:
        condition: service_healthy
    networks:
      - valerix-network

networks:
  valerix-network:
    driver: bridge

volumes:
  order-data:
```

**Key concepts:**

- **Health checks**: Services wait for DB to be ready
- **Networks**: All services on same network
- **Volumes**: Persistent data storage
- **Depends_on with condition**: Order starts only after DB is healthy

### Step 1.5: First Deployment

```bash
# Build and start
docker compose up --build

# Check logs
docker compose logs order-service

# Test health endpoint
curl http://localhost:3001/health
```

**Result:** ✅ Basic services running!

---

## 🐛 Phase 2: Chaos Engineering (Latency Gremlin)

### Goal

Simulate slow network responses to test timeout handling.

### Implementation: `inventory-service/src/middleware/gremlin.js`

```javascript
class LatencyGremlin {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.latencyMs = options.latencyMs || 3000;
    this.frequency = options.frequency || 5;
    this.pattern = options.pattern || "deterministic";
    this.requestCount = 0;
    this.activationCount = 0;
  }

  middleware() {
    return async (req, res, next) => {
      if (!this.enabled) {
        return next();
      }

      this.requestCount++;

      let shouldActivate = false;

      if (this.pattern === "deterministic") {
        shouldActivate = this.requestCount % this.frequency === 0;
      } else if (this.pattern === "random") {
        shouldActivate = Math.random() < 1 / this.frequency;
      }

      if (shouldActivate) {
        this.activationCount++;
        res.setHeader("X-Gremlin-Activated", "true");
        res.setHeader("X-Gremlin-Delay-Ms", this.latencyMs);

        console.log(`[GREMLIN] Injecting ${this.latencyMs}ms delay`);

        await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
      }

      next();
    };
  }

  getStats() {
    return {
      enabled: this.enabled,
      requestCount: this.requestCount,
      activationCount: this.activationCount,
      latencyMs: this.latencyMs,
      frequency: this.frequency,
      pattern: this.pattern,
    };
  }
}

module.exports = LatencyGremlin;
```

**How it works:**

1. **Request counter**: Tracks total requests
2. **Deterministic mode**: Every Nth request gets delay
3. **Random mode**: Random chance based on frequency
4. **Headers**: Response includes gremlin info
5. **Stats endpoint**: Monitor gremlin behavior

**Testing:**

```bash
# Enable in docker-compose.yml
ENABLE_GREMLIN: "true"
GREMLIN_LATENCY_MS: 3000
GREMLIN_FREQUENCY: 5

# Test
bash scripts/test-gremlin-enabled.sh
```

---

## 🛡️ Phase 3: Resilience Patterns

### Goal

Implement timeout, retry, and circuit breaker to handle failures gracefully.

### Implementation: `order-service/src/services/inventoryClient.js`

```javascript
const axios = require("axios");
const axiosRetry = require("axios-retry");
const CircuitBreaker = require("opossum");
const { inventoryCallsTotal, circuitBreakerState } = require("../metrics");

// 1. Create axios instance with timeout
const axiosInstance = axios.create({
  baseURL: process.env.INVENTORY_SERVICE_URL || "http://localhost:3002",
  timeout: parseInt(process.env.REQUEST_TIMEOUT_MS) || 5000,
  headers: { "Content-Type": "application/json" },
});

// 2. Configure retry logic
axiosRetry(axiosInstance, {
  retries: parseInt(process.env.MAX_RETRIES) || 3,
  retryDelay: (retryCount) => {
    const delay = Math.pow(2, retryCount - 1) * 1000;
    console.log(`Retry ${retryCount} after ${delay}ms`);
    return delay;
  },
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.code === "ECONNABORTED" ||
      (error.response && error.response.status >= 500)
    );
  },
});

// 3. Create circuit breaker
async function updateInventoryRaw(productId, quantity, idempotencyKey) {
  inventoryCallsTotal.inc({ status: "attempted" });

  const response = await axiosInstance.post("/api/inventory/update", {
    productId,
    quantity,
    idempotencyKey,
  });

  inventoryCallsTotal.inc({ status: "success" });
  return response.data;
}

const circuitBreakerOptions = {
  errorThresholdPercentage: 50, // Open at 50% errors
  resetTimeout: 10000, // Try again after 10s
  rollingCountTimeout: 10000, // 10s rolling window
  rollingCountBuckets: 10, // 10 buckets
};

const breaker = new CircuitBreaker(updateInventoryRaw, circuitBreakerOptions);

// 4. Event handlers
breaker.on("open", () => {
  console.error("[CIRCUIT BREAKER] OPEN - Failing fast");
  circuitBreakerState.set(1); // 1 = open
});

breaker.on("halfOpen", () => {
  console.warn("[CIRCUIT BREAKER] HALF-OPEN - Testing");
  circuitBreakerState.set(2); // 2 = half-open
});

breaker.on("close", () => {
  console.log("[CIRCUIT BREAKER] CLOSED - Normal operation");
  circuitBreakerState.set(0); // 0 = closed
});

// 5. Export wrapped function
async function updateInventory(productId, quantity, idempotencyKey) {
  try {
    return await breaker.fire(productId, quantity, idempotencyKey);
  } catch (error) {
    inventoryCallsTotal.inc({ status: "failed" });

    if (breaker.opened) {
      throw new Error("Circuit breaker is open");
    }
    throw error;
  }
}

module.exports = {
  updateInventory,
  getCircuitBreakerStats: () => breaker.stats,
  healthCheck: () => breaker.healthCheck(),
};
```

**Flow:**

1. Request → Timeout (5s)
2. If timeout/error → Retry (3x with backoff)
3. If too many failures → Circuit breaker opens
4. Circuit open → Fail fast (no network call)

**Testing:**

```bash
bash scripts/test-resilience.sh
```

---

## 🔄 Phase 4: Idempotency & Crash Recovery

### Goal

Prevent duplicate processing when client retries after crash.

### Implementation: Idempotency Check

**`order-service/src/routes/orders.js`** (simplified):

```javascript
router.post("/", async (req, res) => {
  const { customerId, productId, productName, quantity, idempotencyKey } =
    req.body;

  // 1. Check for duplicate request
  if (idempotencyKey) {
    const existing = await Order.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      console.log(`Idempotent request detected: ${idempotencyKey}`);
      return res.status(200).json({
        message: "Order already exists (idempotent)",
        order: existing,
      });
    }
  }

  // 2. Create order
  const order = await Order.create({
    customerId,
    productId,
    productName,
    quantity,
    status: "pending",
    idempotencyKey,
  });

  // 3. Update inventory with resilience
  try {
    await inventoryClient.updateInventory(productId, -quantity, idempotencyKey);

    // Success!
    order.status = "shipped";
    order.inventoryUpdated = true;
    await order.save();
  } catch (error) {
    // Inventory update failed, but order created
    order.errorMessage = error.message;
    await order.save();

    return res.status(partial ? 200 : 500).json({
      message: "Order created but inventory update failed",
      order,
    });
  }

  res.status(201).json({ message: "Order created successfully", order });
});
```

### Crash Simulator

**`inventory-service/src/middleware/crashSimulator.js`:**

```javascript
class CrashSimulator {
  simulateAfterCommit(req, res, next) {
    if (!this.shouldCrash()) {
      return next();
    }

    // Hook into response
    const originalSend = res.send;
    res.send = function (data) {
      // Simulate crash AFTER successful DB commit
      console.error("[CRASH SIMULATOR] Simulating crash after commit!");

      if (crashMode === "connection_reset") {
        req.socket.destroy(); // Drop connection
      } else if (crashMode === "timeout") {
        // Never respond (timeout)
      } else {
        res.status(500).send("Internal error");
      }
    };

    next();
  }
}
```

**Testing:**

```bash
bash scripts/test-idempotency.sh
```

**Result:** Same idempotency key→ same result, stock only decremented once!

---

## 🧪 Phase 5: CI/CD & Testing

### Unit Tests

**`order-service/tests/orders.test.js`:**

```javascript
const request = require("supertest");
const app = require("../src/index");

describe("Order Service", () => {
  test("POST /api/orders - creates order", async () => {
    const response = await request(app)
      .post("/api/orders")
      .send({
        customerId: "TEST-001",
        productId: "PROD-001",
        productName: "Test Product",
        quantity: 2,
      })
      .expect(201);

    expect(response.body.order).toHaveProperty("id");
    expect(response.body.order.status).toBe("shipped");
  });

  test("Idempotency - duplicate key returns same order", async () => {
    const key = `TEST-${Date.now()}`;

    const first = await request(app)
      .post("/api/orders")
      .send({
        customerId: "C1",
        productId: "P1",
        productName: "Test",
        quantity: 1,
        idempotencyKey: key,
      });

    const second = await request(app)
      .post("/api/orders")
      .send({
        customerId: "C1",
        productId: "P1",
        productName: "Test",
        quantity: 1,
        idempotencyKey: key,
      });

    expect(first.body.order.id).toBe(second.body.order.id);
  });
});
```

### GitHub Actions CI/CD

**`.github/workflows/ci.yml`:**

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Build services
        run: docker compose up -d --build

      - name: Wait for health checks
        run: sleep 30

      - name: Run integration tests
        run: bash scripts/test-integration.sh

      - name: Run stress tests
        run: npm install -g artillery && artillery run scripts/stress-test.yml

      - name: Cleanup
        run: docker compose down
```

---

## 📊 Phase 6: Monitoring (Prometheus + Grafana)

### Metrics Implementation

**`order-service/src/metrics.js`:**

```javascript
const client = require("prom-client");

// Default metrics (CPU, memory, etc.)
client.collectDefaultMetrics();

// Custom metrics
const ordersCreated = new client.Counter({
  name: "orders_created_total",
  help: "Total number of orders created",
  labelNames: ["status"],
});

const orderDuration = new client.Histogram({
  name: "order_processing_duration_seconds",
  help: "Order processing duration",
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const circuitBreakerState = new client.Gauge({
  name: "circuit_breaker_state",
  help: "Circuit breaker state (0=closed, 1=open, 2=half-open)",
});

module.exports = {
  register: client.register,
  ordersCreated,
  orderDuration,
  circuitBreakerState,
};
```

**Prometheus configuration:**

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "order-service"
    static_configs:
      - targets: ["order-service:3001"]

  - job_name: "inventory-service"
    static_configs:
      - targets: ["inventory-service:3002"]
```

---

## 🎨 Phase 8: Web UI

**Simple fetch-based UI:**

```javascript
// Create order
async function createOrder() {
  const response = await fetch("http://localhost:3001/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId: document.getElementById("customerId").value,
      productId: document.getElementById("productId").value,
      quantity: parseInt(document.getElementById("quantity").value),
    }),
  });

  const data = await response.json();
  displayOrder(data.order);
}
```

---

## ☁️ Phase 9: Azure Deployment

Created comprehensive Kubernetes manifests and deployment guide. See `AZURE_DEPLOYMENT.md`.

---

## 💾 Phase 10: Backup Strategy

**Automated daily backups using Docker exec:**

```bash
docker exec valerix-postgres-order pg_dump \
  -U order_user -d order_db --format=custom \
  > backups/order_db_$(date +%Y%m%d).dump
```

---

## 🎯 Key Implementation Learnings

### 1. **Start Simple, Add Complexity**

- Basic services first
- Then resilience patterns
- Then chaos engineering
- Then monitoring

### 2. **Test Everything**

- Unit tests for core logic
- Integration tests for flows
- Chaos tests for resilience
- Stress tests for performance

### 3. **Docker Health Checks Matter**

- Services depend on DB health
- Prevents startup race conditions
- Enables auto-restart

### 4. **Idempotency is Critical**

- Network retries are common
- Must handle gracefully
- Database is source of truth

### 5. **Metrics Drive Decisions**

- Can't improve what you don't measure
- Circuit breaker state visibility crucial
- Request latency shows real performance

---

**Next:** Read [04-SYSTEM-WORKFLOW.md](./04-SYSTEM-WORKFLOW.md) for detailed operational flows.
