# System Workflow & Data Flows

This document explains in detail how data flows through the Valerix Microservices system for various scenarios.

---

## 🔄 Core Workflows

### Workflow 1: Normal Order Creation (Happy Path)

```
Step-by-Step Flow:
═══════════════════

1. USER ACTION
   └─> User fills order form on UI (http://localhost:8080)
       • Customer ID: CUST-001
       • Product: Dell XPS 15
       • Quantity: 2
       • Click "Create Order"

2. UI → ORDER SERVICE
   └─> POST http://localhost:3001/api/orders
       Body: {
         "customerId": "CUST-001",
         "product Id": "PROD-001",
         "productName": "Dell XPS 15",
         "quantity": 2
       }

3. ORDER SERVICE PROCESSING
   ├─> Validate input
   │   • Check required fields
   │   • Validate quantity > 0
   │
   ├─> Check idempotency (if key provided)
   │   • Query: SELECT * FROM orders WHERE idempotency_key = ?
   │   • Not found → Continue
   │
   ├─> Create order in database
   │   • Generate UUID for order ID
   │   • Insert into orders table
   │   • Status: 'pending'
   │   • Transaction committed ✅
   │
   └─> Record metrics
       • orders_created_total{status="pending"} +1
       • Start timer for order_processing_duration

4. ORDER SERVICE → INVENTORY SERVICE
   ├─> HTTP POST with resilience
   │   • Timeout: 5 seconds
   │   • Retry: 3 attempts with exponential backoff
   │   • Circuit breaker: Monitor failure rate
   │
   └─> Request:
       POST http://localhost:3002/api/inventory/update
       Body: {
         "productId": "PROD-001",
         "quantity": -2,  // Negative = deduction
         "idempotencyKey": "ORDER-abc123"
       }

5. INVENTORY SERVICE PROCESSING
   ├─> Middleware: Latency gremlin (if enabled)
   │   • Every 5th request → delay 3 seconds
   │   • This request is #7 → No delay
   │
   ├─> Check idempotency
   │   • Query: SELECT * FROM inventory_updates WHERE idempotency_key = ?
   │   • Not found → Continue
   │
   ├─> Get current stock
   │   • Query: SELECT stock_quantity FROM products WHERE product_id = 'PROD-001'
   │   • Current stock: 100 units
   │
   ├─> Validate stock availability
   │   • Required: 2 units
   │   • Available: 100 units
   │   • Check: 100 >= 2 ✅ OK
   │
   ├─> Update stock (TRANSACTION BEGIN)
   │   • UPDATE products SET stock_quantity = 98 WHERE product_id = 'PROD-001'
   │   • INSERT INTO inventory_updates (product_id, quantity_change, previous_stock, new_stock, order_id, idempotency_key)
   │   • VALUES ('PROD-001', -2, 100, 98, 'abc123', 'ORDER-abc123')
   │   • COMMIT ✅
   │
   ├─> Record metrics
   │   • inventory_updates_total +1
   │   • inventory_stock_level{product="PROD-001"} = 98
   │
   └─> Return success
       Response: {
         "success": true,
         "previousStock": 100,
         "newStock": 98
       }

6. ORDER SERVICE RECEIVES RESPONSE
   ├─> Inventory update successful
   │
   ├─> Update order status
   │   • UPDATE orders SET status = 'shipped', inventory_updated = true WHERE id = ?
   │   • COMMIT ✅
   │
   ├─> Record metrics
   │   • orders_created_total{status="shipped"} +1
   │   • inventory_calls_total{status="success"} +1
   │   • order_processing_duration_seconds.observe(0.234)
   │
   └─> Return to client
       Response: 201 Created
       Body: {
         "message": "Order created successfully",
         "order": {
           "id": "550e8400-e29b-41d4-a716-446655440000",
           "customerId": "CUST-001",
           "productId": "PROD-001",
           "quantity": 2,
           "status": "shipped",
           "inventoryUpdated": true,
           "createdAt": "2026-01-29T03:00:00.000Z"
         }
       }

7. UI UPDATES
   └─> Display order confirmation
       • Show order ID
       • Update inventory display (98 units)
       • Add to activity log
       • Show success message

════════════════════════════════
RESULT:
✅ Order created successfully
✅ Inventory deducted correctly
✅ Both databases consistent
Total time: ~250ms
════════════════════════════════
```

---

### Workflow 2: Order with Retry (Temporary Failure)

```
Scenario: Inventory service is temporarily slow (first attempt times out)
═════════════════════════════════════════════════════════════════════════

1. USER → ORDER SERVICE
   └─> POST /api/orders (quantity: 3)

2. ORDER SERVICE
   └─> Create order in DB (status: pending) ✅

3. ATTEMPT 1: ORDER SERVICE → INVENTORY SERVICE
   ├─> HTTP POST with 5s timeout
   │
   ├─> INVENTORY SERVICE
   │   ├─> Latency gremlin activated! (3s delay)
   │   ├─> Sleep 3000ms...
   │   ├─> Process request...
   │   └─> Total time: 5.2 seconds
   │
   └─> TIMEOUT! (exceeded 5s limit)
       Error: ECONNABORTED

4. ATTEMPT 2: AUTOMATIC RETRY (after 1s delay)
   ├─> Wait 1000ms (exponential backoff: 2^0 * 1000)
   │
   ├─> HTTP POST again (same idempotency key!)
   │
   ├─> INVENTORY SERVICE
   │   ├─> No gremlin this time
   │   ├─> Process in 50ms
   │   └─> SUCCESS! ✅
   │
   └─> Response received

5. ORDER SERVICE
   └─> Update order status to 'shipped' ✅

═════════════════════════════════
RESULT:
✅ Order successful after retry
✅ Client doesn't see the retry
✅ Total time: ~7 seconds
   (5s timeout + 1s delay + 1s processing)
═════════════════════════════════
```

---

### Workflow 3: Crash After Commit (Idempotency Test)

```
Scenario: Inventory service crashes AFTER updating DB but BEFORE sending response
════════════════════════════════════════════════════════════════════════════════

1. USER → ORDER SERVICE
   └─> POST /api/orders
       Body: {
         "customerId": "CUST-001",
         "productId": "PROD-001",
         "quantity": 5,
         "idempotencyKey": "UNIQUE-KEY-123"  // Important!
       }

2. ORDER SERVICE
   ├─> Create order (ID: ORDER-xyz)
   └─> Status: pending ✅

3. ORDER SERVICE → INVENTORY SERVICE (Request #1)
   └─> POST /api/inventory/update
       Body: {
         "productId": "PROD-001",
         "quantity": -5,
         "idempotencyKey": "UNIQUE-KEY-123"
       }

4. INVENTORY SERVICE PROCESSING
   ├─> Get current stock
   │   • SELECT stock_quantity FROM products WHERE product_id = 'PROD-001'
   │   • Result: 100 units
   │
   ├─> Update database (TRANSACTION)
   │   • UPDATE products SET stock_quantity = 95
   │   • INSERT INTO inventory_updates (..., idempotency_key = 'UNIQUE-KEY-123')
   │   • COMMIT ✅  ← DATABASE UPDATED!
   │
   ├─> Prepare response: { success: true, newStock: 95 }
   │
   └─> 💥 CRASH SIMULATOR ACTIVATED!
       • Before sending response
       • Connection dropped/reset
       • Service appears to crash

5. ORDER SERVICE SEES
   └─> Error: Connection reset / ECONNRESET
       ❌ No response received

6. ORDER SERVICE RETRY LOGIC
   ├─> Circuit breaker: Still closed (not enough failures)
   │
   ├─> Retry attempt #2 (after 1s)
   │
   └─> POST /api/inventory/update (SAME REQUEST)
       Body: {
         "productId": "PROD-001",
         "quantity": -5,
         "idempotencyKey": "UNIQUE-KEY-123"  ← SAME KEY!
       }

7. INVENTORY SERVICE PROCESSING (2nd time)
   ├─> Check idempotency
   │   • Query: SELECT * FROM inventory_updates
   │             WHERE idempotency_key = 'UNIQUE-KEY-123'
   │   • FOUND! ✅  (from previous attempt)
   │
   ├─> Return cached response (NO RE-PROCESSING!)
   │   • Response: {
   │       "success": true,
   │       "previousStock": 100,
   │       "newStock": 95,
   │       "idempotent": true,
   │       "message": "Request already processed"
   │     }
   │
   └─> Stock remains 95 (not decremented again!)

8. ORDER SERVICE
   └─> Update order status to 'shipped' ✅

═════════════════════════════════════════════
RESULT:
✅ Idempotency worked!
✅ Stock only decremented once (95, not 90)
✅ Client eventually gets response
✅ Exactly-once semantics maintained
═════════════════════════════════════════════

WHAT IF NO IDEMPOTENCY KEY?
════════════════════════════
Without idempotency key, the 2nd request would:
❌ Deduct another 5 units (stock = 90)
❌ Create duplicate inventory update record
❌ Data inconsistency!
```

---

### Workflow 4: Circuit Breaker Opens (Multiple Failures)

```
Scenario: Inventory service is down, circuit breaker protects Order service
═══════════════════════════════════════════════════════════════════════════

INITIAL STATE:
• Circuit breaker: CLOSED (normal operation)
• Error threshold: 50%
• Rolling window: 10 seconds
• Reset timeout: 10 seconds

────────────────────────────────────────

REQUEST #1 (t=0s)
├─> Order Service → Inventory Service
├─> Timeout (5s)
└─> Error rate: 1/1 = 100% 🔴
    Circuit breaker: Still CLOSED (needs more data)

REQUEST #2 (t=6s)
├─> Order Service → Inventory Service
├─> Timeout (5s)
└─> Error rate: 2/2 = 100% 🔴
    Circuit breaker: Still CLOSED

REQUEST #3 (t=12s)
├─> Order Service → Inventory Service
├─> Timeout (5s)
└─> Error rate: 3/3 = 100% 🔴
    Circuit breaker: Still CLOSED

REQUEST #4 (t=18s)
├─> Order Service → Inventory Service
├─> Timeout (5s)
└─> Error rate: 4/4 = 100% 🔴
    Circuit breaker: Still CLOSED

REQUEST #5 (t=24s)
├─> Order Service → Inventory Service
├─> Timeout (5s)
└─> Error rate: 5/5 = 100% 🔴
    🚨 CIRCUIT BREAKER OPENS! 🚨
    • Error threshold exceeded (100% > 50%)
    • Minimum requests met
    • Log: "[CIRCUIT BREAKER] OPEN - Failing fast"
    • Metric: circuit_breaker_state = 1

────────────────────────────────────────

CIRCUIT OPEN PERIOD (t=29s - t=39s)

REQUEST #6-10 (t=30s - t=38s)
├─> Order Service checks circuit breaker
├─> Circuit: OPEN
└─> Fail immediately (no network call)
    • Response time: <5ms (vs 5000ms timeout)
    • Error: "Circuit breaker is open"
    • Order status: 'pending' with error message
    • Metric: inventory_calls_total{status="circuit_open"} +5

────────────────────────────────────────

RECOVERY ATTEMPT (t=39s)

REQUEST #11 (t=39s)
├─> Reset timeout elapsed (10s)
├─> Circuit breaker: HALF-OPEN (testing)
│   • Log: "[CIRCUIT BREAKER] HALF-OPEN - Testing"
│   • Metric: circuit_breaker_state = 2
│
├─> Single test request sent
│
└─> Inventory service responds successfully!
    • Response time: 150ms ✅

Circuit breaker: CLOSED ✅
• Log: "[CIRCUIT BREAKER] CLOSED - Normal operation"
• Metric: circuit_breaker_state = 0
• Normal operation resumed

────────────────────────────────────────

REQUEST #12+ (t=40s+)
└─> All requests succeed
    Circuit breaker remains CLOSED ✅

═════════════════════════════════════════
BENEFITS:
✅ Fast failure during outage (5ms vs 5s)
✅ Reduced load on failing service
✅ Automatic recovery detection
✅ Better user experience
✅ Prevented 5 unnecessary timeouts (saved 25s)
═════════════════════════════════════════
```

---

## 📊 Monitoring & Metrics Flow

### Prometheus Scraping Workflow

```
Every 15 seconds:
═════════════════

1. PROMETHEUS
   ├─> Scrape Order Service
   │   • GET http://order-service:3001/metrics
   │   • Response: Prometheus format text
   │
   └─> Scrape Inventory Service
       • GET http://inventory-service:3002/metrics
       • Response: Prometheus format text

2. METRICS COLLECTED (Order Service)
   ├─> orders_created_total{status="shipped"} 42
   ├─> orders_created_total{status="pending"} 3
   ├─> inventory_calls_total{status="success"} 39
   ├─> inventory_calls_total{status="failed"} 3
   ├─> circuit_breaker_state 0
   ├─> http_request_duration_seconds{le="0.5"} 35
   ├─> http_request_duration_seconds{le="1"} 40
   └─> ...

3. METRICS COLLECTED (Inventory Service)
   ├─> inventory_updates_total 42
   ├─> inventory_stock_level{product="PROD-001"} 58
   ├─> inventory_stock_level{product="PROD-002"} 145
   ├─> gremlin_activations_total 8
   ├─> crash_simulations_total 2
   └─> ...

4. PROMETHEUS STORAGE
   └─> Store all metrics in time-series database
       • Timestamp: 2026-01-29 03:00:15
       • Retention: 15 days
       • Compression applied

5. GRAFANA QUERIES
   └─> User views dashboard
       • Query: rate(orders_created_total[5m])
       • Result: Graph showing order rate over time
       • Update: Every 5 seconds
```

---

## 🔄 Database Transaction Patterns

### Pattern 1: Single Service Transaction

```sql
-- Order Service: Create order
BEGIN TRANSACTION;

INSERT INTO orders (
  id, customer_id, product_id, product_name,
  quantity, status, idempotency_key
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'CUST-001', 'PROD-001', 'Dell XPS 15',
  2, 'pending', 'KEY-123'
);

COMMIT;  -- Transaction boundary
```

**Key Points:**

- ✅ ACID guarantees within single service
- ✅ Either all changes commit or none
- ✅ Isolation from other transactions

### Pattern 2: Distributed Transaction (2-Phase Commit Alternative)

We use **eventual consistency** with idempotency instead of 2-phase commit.

```
Step 1: Order Service transaction
BEGIN;
  INSERT INTO orders (...);
COMMIT; ✅

Step 2: HTTP call to Inventory Service
  → Network may fail after this ⚠️

Step 3: Inventory Service transaction
BEGIN;
  UPDATE products SET stock_quantity = stock_quantity - 2;
  INSERT INTO inventory_updates (...);
COMMIT; ✅

Consistency achieved through:
• Idempotency keys (prevent duplicates)
• Retry logic (eventual success)
• Error flags (track partial failures)
```

---

## 🎯 Error Handling Flows

### Scenario: Insufficient Stock

```
1. User orders 100 units
2. Current stock: 10 units
3. Inventory Service checks availability
   └─> 10 < 100 ❌
4. Return error: "Insufficient stock"
5. Order Service receives error
6. Order status: 'pending' with error message
7. User sees: "Order failed: Insufficient stock"
```

### Scenario: Database Connection Lost

```
1. Order Service tries to create order
2. Database connection pool exhausted/failed
3. Sequelize throws error
4. Express error handler catches
5. Response: 500 Internal Server Error
6. Logs error for investigation
7. Metrics: database_errors_total +1
```

---

## 📈 Performance Characteristics

### Latency Breakdown (Normal Request)

```
Total: ~250ms

├─> UI → Order Service: 10ms (network)
├─> Order Service validation: 5ms
├─> Database: Create order: 20ms
├─> Order Service → Inventory Service: 15ms (network)
├─> Inventory Service processing:
│   ├─> Idempotency check: 10ms
│   ├─> Stock query: 15ms
│   ├─> Update transaction: 25ms
│   └─> Metrics recording: 5ms
├─> Inventory Service → Order Service: 15ms (network)
├─> Order Service: Update order: 20ms
├─> Order Service → UI: 10ms (network)
└─> UI rendering: 100ms

Total visible to user: ~350ms (including rendering)
```

### Throughput Metrics

```
Single instance capacity:
• Order Service: ~100 req/sec
• Inventory Service: ~150 req/sec
• Bottleneck: Order Service (orchestration overhead)

With 3 replicas:
• Order Service: ~300 req/sec
• Inventory Service: ~450 req/sec
• Database becomes bottleneck: ~400 req/sec
```

---

## 🔐 Security Workflow

### Input Validation Flow

```
1. Request arrives at Order Service
2. Express body parser validates JSON
3. Custom validation:
   • customerId: Required, string, max 50 chars
   • productId: Required, string, max 50 chars
   • quantity: Required, integer, 1-100
4. If invalid → 400 Bad Request
5. If valid → Proceed to business logic
```

### SQL Injection Prevention

```javascript
// ❌ VULNERABLE (we don't do this)
const query = `SELECT * FROM orders WHERE customer_id = '${customerId}'`;

// ✅ SAFE (what we use)
const order = await Order.findAll({
  where: { customerId }, // Sequelize uses parameterized queries
});
```

---

**Next:** Read [05-TESTING-VALIDATION.md](./05-TESTING-VALIDATION.md) for testing strategies and results.
