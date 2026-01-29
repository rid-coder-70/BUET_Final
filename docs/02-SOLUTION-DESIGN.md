# Solution Design & Architecture

## 🏗️ Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Web UI     │    │   cURL/API   │    │  Mobile App  │      │
│  │ (Port 8080)  │    │   Clients    │    │   (Future)   │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼────────────────┘
          │                  │                  │
          └─────────────────┬┴──────────────────┘
                            │ HTTP/REST
          ┌─────────────────▼─────────────────┐
          │      API GATEWAY (Future)          │
          │    Load Balancer / Nginx           │
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────▼─────────────────┐
          │        ORDER SERVICE               │
          │         (Port 3001)                │
          │                                    │
          │  ┌──────────────────────────────┐ │
          │  │  Resilience Layer            │ │
          │  │  - Timeout (5s)              │ │
          │  │  - Retry (3x exponential)    │ │
          │  │  - Circuit Breaker (50%)     │ │
          │  └──────────────────────────────┘ │
          │  ┌──────────────────────────────┐ │
          │  │  Business Logic              │ │
          │  │  - Order validation          │ │
          │  │  - Idempotency check         │ │
          │  │  - Inventory coordination    │ │
          │  └──────────────────────────────┘ │
          │  ┌──────────────────────────────┐ │
          │  │  Metrics & Observability     │ │
          │  │  - Prometheus metrics        │ │
          │  │  - Request logging           │ │
          │  └──────────────────────────────┘ │
          └─────────────────┬─────────────────┘
                            │
                            │ PostgreSQL
                            ▼
                   ┌────────────────┐
                   │  Order DB      │
                   │  (Port 5432)   │
                   │                │
                   │  Tables:       │
                   │  - orders      │
                   │  - idempotency │
                   └────────────────┘

                            │ HTTP with Resilience
          ┌─────────────────▼─────────────────┐
          │     INVENTORY SERVICE              │
          │        (Port 3002)                 │
          │                                    │
          │  ┌──────────────────────────────┐ │
          │  │  Chaos Engineering           │ │
          │  │  - Latency Gremlin (3s)      │ │
          │  │  - Crash Simulator           │ │
          │  └──────────────────────────────┘ │
          │  ┌──────────────────────────────┐ │
          │  │  Business Logic              │ │
          │  │  - Stock management          │ │
          │  │  - Inventory updates         │ │
          │  │  - Idempotency check         │ │
          │  └──────────────────────────────┘ │
          │  ┌──────────────────────────────┐ │
          │  │  Metrics & Observability     │ │
          │  │  - Prometheus metrics        │ │
          │  │  - Stock level gauges        │ │
          │  └──────────────────────────────┘ │
          └─────────────────┬─────────────────┘
                            │
                            │ PostgreSQL
                            ▼
                   ┌────────────────┐
                   │ Inventory DB   │
                   │ (Port 5433)    │
                   │                │
                   │  Tables:       │
                   │  - products    │
                   │  - updates     │
                   │  - idempotency │
                   └────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                  MONITORING LAYER                            │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │  Prometheus  │◄────────│   Grafana    │                 │
│  │  (Port 9090) │ scrape  │  (Port 3000) │                 │
│  │              │         │              │                 │
│  │  - Metrics   │         │  - Dashboards│                 │
│  │  - Alerts    │         │  - Queries   │                 │
│  └──────┬───────┘         └──────────────┘                 │
│         │                                                   │
│         │ Scrape /metrics every 15s                        │
│         │                                                   │
│         ▼                                                   │
│   [Order Service]  [Inventory Service]                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 Design Decisions

### 1. Technology Stack

#### Backend: **Node.js + Express**

**Why?**

- ✅ Fast development and prototyping
- ✅ Non-blocking I/O perfect for microservices
- ✅ Large ecosystem (npm packages)
- ✅ JSON-native (REST APIs)
- ✅ Easy containerization

**Alternatives Considered:**

- Python/Flask: Slower, less async
- Java/Spring Boot: Heavier, longer startup
- Go: Great choice, but steeper learning curve

#### Database: **PostgreSQL**

**Why?**

- ✅ ACID transactions (data integrity)
- ✅ Mature and reliable
- ✅ JSON support (flexible schemas)
- ✅ Great performance
- ✅ Azure support (managed service)

**Alternatives Considered:**

- MySQL: Similar, but less advanced features
- MongoDB: NoSQL, but we need ACID
- SQLite: Not for production

#### Containerization: **Docker**

**Why?**

- ✅ Industry standard
- ✅ Environment consistency
- ✅ Easy local development
- ✅ Cloud-ready (Kubernetes)
- ✅ Isolation

#### Resilience: **Axios-retry + Opossum**

**Why?**

- ✅ `axios-retry`: Simple, configurable retry logic
- ✅ `opossum`: Battle-tested circuit breaker
- ✅ Both well-maintained
- ✅ Easy integration

#### Monitoring: **Prometheus + Grafana**

**Why?**

- ✅ Industry standard for metrics
- ✅ Pull-based (services don't push)
- ✅ Time-series database
- ✅ Powerful query language (PromQL)
- ✅ Beautiful Grafana visualizations

### 2. Architectural Patterns

#### Pattern 1: **Database Per Service**

```
Order Service → Order DB
Inventory Service → Inventory DB
```

**Benefits:**

- 🔹 True microservice independence
- 🔹 Teams can evolve schemas independently
- 🔹 No database-level coupling
- 🔹 Different databases possible (polyglot persistence)

**Tradeoffs:**

- ⚠️ No cross-service SQL joins
- ⚠️ Eventual consistency challenges
- ⚠️ More complex transactions

**Our Handling:**

- Synchronous HTTP for immediate consistency needs
- Idempotency for exactly-once semantics
- Clear service boundaries

#### Pattern 2: **Synchronous Communication (HTTP/REST)**

**Why not async (message queues)?**

- Order → Inventory coordination needs immediate response
- Simpler to implement and understand
- Clear request/response semantics
- Appropriate for this domain

**When to use async:**

- Order confirmation emails (future)
- Analytics/reporting
- Notifications
- Background jobs

#### Pattern 3: **Resilience Patterns (Timeout, Retry, Circuit Breaker)**

**Timeout:**

```javascript
axios.create({ timeout: 5000 });
```

**Purpose:** Don't wait forever for failing services

**Retry with Exponential Backoff:**

```javascript
axiosRetry(instance, {
  retries: 3,
  retryDelay: (retryCount) => Math.pow(2, retryCount - 1) * 1000,
});
```

**Purpose:** Temporary failures often resolve quickly

**Circuit Breaker:**

```javascript
new CircuitBreaker(asyncFunction, {
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
});
```

**Purpose:** Stop calling failing services, fail fast

**Combined Effect:**

```
Request 1: ──┬── Timeout 5s ──┬── Retry 1s ──┬── Success ✓
Request 2: ──┴── (failed)     └── Retry 2s ──┴── Success ✓
Request 3: Circuit opens (too many failures) → Fail fast ✗
...wait 10s...
Request N: Half-open → Test → Success → Circuit closed ✓
```

#### Pattern 4: **Idempotency**

**Design:**

```sql
CREATE TABLE idempotency_records (
  idempotency_key VARCHAR(255) PRIMARY KEY,
  response_data JSONB,
  created_at TIMESTAMP
);
```

**Flow:**

```javascript
// 1. Check if key exists
const existing = await findByIdempotencyKey(key);
if (existing) {
  return existing.response; // Return cached response
}

// 2. Process request
const result = await processOrder();

// 3. Store with key
await storeIdempotency(key, result);

return result;
```

**Why JSONB?**

- Store entire response for exact replay
- Flexible schema
- PostgreSQL JSON performance

---

## 🔄 Data Flow Diagrams

### Flow 1: Successful Order Creation

```
User                Order Service           Inventory Service        Databases
 │                       │                         │                     │
 │ POST /api/orders      │                         │                     │
 ├──────────────────────>│                         │                     │
 │ {customerId, product} │                         │                     │
 │                       │                         │                     │
 │                       │ 1. Validate input       │                     │
 │                       │                         │                     │
 │                       │ 2. Check                │                     │
 │                       │    idempotency          │                     │
 │                       ├─────────────────────────┼────────────────────>│
 │                       │                         │     SELECT ... WHERE│
 │                       │<────────────────────────┼─────────────────────┤
 │                       │   (not found)           │       idempotency_key
 │                       │                         │                     │
 │                       │ 3. Create order         │                     │
 │                       ├─────────────────────────┼────────────────────>│
 │                       │                         │   INSERT INTO orders│
 │                       │<────────────────────────┼─────────────────────┤
 │                       │                         │                     │
 │                       │ 4. Update inventory     │                     │
 │                       ├────────────────────────>│                     │
 │                       │  with resilience        │                     │
 │                       │  (timeout/retry/CB)     │                     │
 │                       │                         │ 5. Check idempotency│
 │                       │                         ├────────────────────>│
 │                       │                         │                     │
 │                       │                         │<────────────────────┤
 │                       │                         │  (not found)        │
 │                       │                         │ 6. Update stock     │
 │                       │                         ├────────────────────>│
 │                       │                         │   UPDATE products   │
 │                       │                         │<────────────────────┤
 │                       │                         │                     │
 │                       │<────────────────────────┤                     │
 │                       │   {success: true}       │                     │
 │                       │                         │                     │
 │                       │ 7. Store idempotency    │                     │
 │                       ├─────────────────────────┼────────────────────>│
 │                       │                         │   INSERT idempotency│
 │                       │                         │                     │
 │<──────────────────────┤                         │                     │
 │ 201 Created           │                         │                     │
 │ {order details}       │                         │                     │
```

### Flow 2: Retry After Crash (Idempotency)

```
User              Order Service           Inventory Service        Databases
 │                     │                         │                     │
 │ POST /api/orders    │                         │                     │
 │ key: "ABC123"       │                         │                     │
 ├────────────────────>│ 1. Process order        │                     │
 │                     ├─────────────────────────┼────────────────────>│
 │                     │                         │   INSERT order      │
 │                     │                         │                     │
 │                     │ 2. Update inventory     │                     │
 │                     ├────────────────────────>│                     │
 │                     │                         ├────────────────────>│
 │                     │                         │  UPDATE stock (-5)  │
 │                     │                         │<────────────────────┤
 │                     │                         │                     │
 │                     │<────────────────────────┤                     │
 │                     │   SUCCESS               │                     │
 │                     │                         │                     │
 │                     │ 💥 CRASH! (before       │                     │
 │ ❌ Connection reset  │     response sent)      │                     │
 │                     │                         │                     │
 │                     │                         │                     │
 │ RETRY:              │                         │                     │
 │ POST /api/orders    │                         │                     │
 │ key: "ABC123"       │                         │                     │
 ├────────────────────>│ 3. Check idempotency    │                     │
 │ (same key!)         ├─────────────────────────┼────────────────────>│
 │                     │                         │   SELECT ... WHERE  │
 │                     │<────────────────────────┼─────────────────────┤
 │                     │   FOUND! (original)     │       key="ABC123"  │
 │                     │                         │                     │
 │<────────────────────┤                         │                     │
 │ 200 OK              │  (no re-processing!)    │                     │
 │ {original order}    │                         │                     │
 │                     │                         │                     │
 │ Stock: Still -5     │                         │  (not -10!)         │
 │ (exactly once! ✓)   │                         │                     │
```

### Flow 3: Circuit Breaker Opening

```
Order Service           Inventory Service         Circuit Breaker State
      │                         │                         │
      │ Request 1               │                         │ CLOSED
      ├────────────────────────>│                         │ (normal)
      │                         X  (timeout)              │
      │<──────X─────────────────┤                         │
      │  Timeout!               │                         │
      │  Retry...               │                         │ Error: 1/10
      │                         │                         │
      │ Request 2               │                         │
      ├────────────────────────>│                         │
      │                         X  (error)                │
      │<──────X─────────────────┤                         │
      │  500 Error!             │                         │ Error: 2/10
      │                         │                         │
      │ Request 3..4..5         │                         │
      ├────────────────────────>│                         │
      │<──────X─────────────────┤                         │
      │  More failures...       │                         │ Error: 5/10
      │                         │                         │ (50% reached!)
      │                         │                         │
      │                         │                         │ ⚠️ OPEN
      │ Request 6               │                         │
      X  Fail fast!             │                         │ (no call made)
      │  (circuit open)         │                         │
      │                         │                         │
      │ ... wait 10 seconds ... │                         │
      │                         │                         │
      │ Request N               │                         │ HALF-OPEN
      ├────────────────────────>│                         │ (testing)
      │                         │                         │
      │<────────────────────────┤                         │
      │  Success!               │                         │
      │                         │                         │ ✅ CLOSED
      │                         │                         │ (recovered)
```

---

## 📐 Database Schema Design

### Order Service Database

```sql
-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    inventory_updated BOOLEAN DEFAULT FALSE,
    idempotency_key VARCHAR(255) UNIQUE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_idempotency ON orders(idempotency_key);
```

**Design Choices:**

- `UUID` for globally unique IDs
- `inventory_updated` flag tracks partial failures
- `idempotency_key` nullable (optional feature)
- `status` for order lifecycle tracking
- Indexes on frequent queries

### Inventory Service Database

```sql
-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Inventory updates history
CREATE TABLE inventory_updates (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    quantity_change INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    order_id UUID,
    idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_updates_product ON inventory_updates(product_id);
CREATE INDEX idx_updates_order ON inventory_updates(order_id);
CREATE INDEX idx_updates_idempotency ON inventory_updates(idempotency_key);
```

**Design Choices:**

- Separate `inventory_updates` for audit trail
- `idempotency_key` prevents duplicate updates
- Historical tracking for analytics
- CHECK constraint prevents negative stock

---

## 🔐 Security Considerations

### 1. Input Validation

```javascript
// Validate all inputs
if (!customerId || !productId || !quantity) {
  return res.status(400).json({ error: "Missing fields" });
}

if (quantity < 1 || quantity > 100) {
  return res.status(400).json({ error: "Invalid quantity" });
}
```

### 2. Database Security

- Separate credentials per service
- No shared database access
- Parameterized queries (SQL injection prevention)
- Connection pooling with limits

### 3. Network Security

- Services communicate via internal Docker network
- No direct database exposure
- Health checks on safe endpoints only

### 4. Production Additions (Future)

- HTTPS/TLS for encryption
- API rate limiting
- JWT authentication
- Role-based access control (RBAC)
- Secrets management (Azure Key Vault)

---

## 📊 Scalability Design

### Horizontal Scaling

**Current:** Single instance per service  
**Production:** Multiple replicas

```yaml
# Kubernetes scaling
replicas: 3 # 3 instances of each service
```

**Load Distribution:**

- Load balancer distributes requests
- Each instance independent
- Session-less (stateless services)

### Database Scaling

**Current:** Single PostgreSQL instance  
**Production Options:**

1. **Read replicas** for query scaling
2. **Connection pooling** (already implemented)
3. **Sharding** by customer ID (if needed)
4. **Managed Azure Database** (auto-scaling)

### Caching Strategy (Future)

- Redis for frequent product lookups
- Cache invalidation on updates
- TTL-based expiry

---

## 🎯 Why This Design Works

### ✅ **Meets All Requirements**

Every requirement has a clear implementation path

### ✅ **Industry-Standard Patterns**

Resilience patterns used by Netflix, Amazon, etc.

### ✅ **Production-Ready**

Monitoring, testing, backup, deployment guide

### ✅ **Maintainable**

Clear separation of concerns, documented

### ✅ **Scalable**

Stateless services, horizontal scaling ready

### ✅ **Testable**

Unit tests, integration tests, chaos tests

---

**Next:** Read [03-IMPLEMENTATION.md](./03-IMPLEMENTATION.md) for step-by-step implementation details.
