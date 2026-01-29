# Problem Analysis & Requirements

## 📋 Project Requirements

### Core Objective

Build a **resilient microservice-based e-commerce order processing system** that demonstrates production-grade patterns for handling distributed system challenges.

---

## 🎯 Functional Requirements

### 1. Microservice Architecture

**Requirement:** Implement at least two microservices that communicate with each other.

**Our Approach:**

- **Order Service**: Handles order creation, validation, and orchestration
- **Inventory Service**: Manages product stock levels and inventory updates

**Why Two Services?**

- Demonstrates service-to-service communication
- Shows real-world separation of concerns
- Enables independent scaling
- Realistic e-commerce domain model

### 2. Independent Databases

**Requirement:** Each microservice must have its own database (database per service pattern).

**Our Approach:**

- **Order Service Database**: PostgreSQL on port 5432 (`order_db`)
  - Tables: orders, idempotency_records
- **Inventory Service Database**: PostgreSQL on port 5433 (`inventory_db`)
  - Tables: products, inventory_updates, idempotency_records

**Benefits:**

- True microservice independence
- No shared database coupling
- Each service can evolve independently
- Scalability isolation

### 3. Resilience Patterns

**Requirement:** Implement patterns to handle failures gracefully.

**Our Solution:**

#### a) **Timeout (5 seconds)**

- Every HTTP call has a maximum wait time
- Prevents hanging requests
- Configured in `inventoryClient.js`

#### b) **Retry with Exponential Backoff**

- Failed requests retry automatically
- Delays: 1s, 2s, 4s (exponential growth)
- Maximum 3 retry attempts
- Implemented using `axios-retry`

#### c) **Circuit Breaker**

- Monitors error rates
- Opens at 50% error threshold
- Stops calling failing service
- Half-open state for recovery testing
- Implemented using `opossum` library

**Problem Solved:** Prevents cascade failures when Inventory Service is slow or down.

### 4. Idempotency

**Requirement:** Handle duplicate requests safely (e.g., network retry after crash).

**The Problem (Schrödinger's Warehouse):**

```
1. Client sends: Create order for 5 units
2. Service processes: ✅ Deducts 5 from inventory, saves to DB
3. Service crashes BEFORE sending response ❌
4. Client sees: Connection error/timeout
5. Client retries: Same request again
6. Without idempotency: Deducts another 5 units (WRONG!)
```

**Our Solution:**

- Each request includes a unique `idempotencyKey`
- Service checks if key already processed
- If yes, returns original result (no re-processing)
- If no, processes and stores result with key
- Database table: `idempotency_records`

**Result:** Exactly-once semantics, even with crashes!

### 5. Failure Simulation (Chaos Engineering)

**Requirement:** Simulate failures to test resilience.

**Our Solutions:**

#### a) **Latency Gremlin**

- Simulates slow network responses
- Configurable delay (default 3 seconds)
- Deterministic pattern (every Nth request)
- Tests timeout and retry logic

#### b) **Crash Simulator**

- Simulates service crashes AFTER database commit
- Three crash modes:
  1. `connection_reset`: Drops connection immediately
  2. `internal_error`: Returns HTTP 500
  3. `timeout`: Never responds
- Tests idempotency with real crash scenarios

---

## 🔧 Non-Functional Requirements

### 6. Automated Testing

**Requirement:** Comprehensive test coverage.

**Our Tests:**

1. **Unit Tests** (Jest + Supertest)
   - Order Service: 5 test cases
   - Inventory Service: 7 test cases
   - Coverage: Critical paths

2. **Integration Tests**
   - End-to-end order creation
   - Circuit breaker verification
   - Idempotency validation

3. **Stress Tests** (Artillery)
   - Load patterns: 10 → 50 → 100 req/sec
   - 70% orders, 20% inventory queries, 10% health checks
   - Performance metrics collection

### 7. Monitoring & Observability

**Requirement:** Production-grade monitoring.

**Our Solution:**

- **Prometheus**: Metrics collection (15s scrape interval)
- **Grafana**: Visualization dashboards
- **Custom Metrics:**
  - Business: orders created, inventory updates
  - Technical: request latency, circuit breaker state
  - System: CPU, memory, GC metrics

### 8. CI/CD Pipeline

**Requirement:** Automated deployment pipeline.

**Our Pipeline (GitHub Actions):**

1. Build Docker images
2. Health check validation
3. Run unit tests
4. Run integration tests
5. Execute stress tests
6. Test resilience patterns
7. Generate reports
8. Cleanup

### 9. User Interface

**Requirement:** Minimal UI for interaction.

**Our UI (http://localhost:8080):**

- System status dashboard
- Order creation form
- Live inventory display
- Chaos engineering controls
- Activity log

### 10. Cloud Deployment

**Requirement:** Ready for cloud deployment.

**Our Approach:**

- **Platform**: Azure Kubernetes Service (AKS)
- **Container Registry**: Azure Container Registry (ACR)
- **Database**: Azure Database for PostgreSQL
- **Complete Guide**: `AZURE_DEPLOYMENT.md`
- **Cost Estimates**: Development (~$103/mo), Production (~$540/mo)

### 11. Backup Strategy

**Requirement:** Data protection and disaster recovery.

**Our Solution:**

- **Automated daily backups** at 2:00 AM
- **Retention**: 7 days local, 30 days cloud
- **Compression**: gzip for space efficiency
- **Recovery procedures** for 4 common scenarios
- **RTO**: < 1 hour, **RPO**: 24 hours

---

## 🎨 Additional Features (Beyond Requirements)

### 1. Interactive Dashboard

- Real-time system monitoring
- Beautiful dark-themed UI
- Activity tracking
- One-click operations

### 2. Comprehensive Documentation

- `README.md`: Complete system guide
- `AZURE_DEPLOYMENT.md`: Cloud deployment
- `BACKUP_STRATEGY.md`: DR procedures
- `docs/`: Detailed explanations (this folder)

### 3. Test Scripts

- `test-integration.sh`: End-to-end tests
- `test-resilience.sh`: Full resilience stack
- `test-idempotency.sh`: Crash scenarios
- `test-gremlin-enabled.sh`: Chaos testing
- `test-timeout.sh`: Specific timeout tests

### 4. Production-Ready Features

- Health check endpoints
- Graceful shutdown
- Connection pooling
- Error handling
- Logging
- Security best practices

---

## 📊 Requirements Checklist

| Requirement                  | Status   | Implementation                |
| ---------------------------- | -------- | ----------------------------- |
| ✅ Microservice architecture | Complete | Order + Inventory services    |
| ✅ Independent databases     | Complete | 2 PostgreSQL instances        |
| ✅ Timeout pattern           | Complete | 5s timeout on all HTTP calls  |
| ✅ Retry with backoff        | Complete | 3 retries, exponential delays |
| ✅ Circuit breaker           | Complete | 50% error threshold           |
| ✅ Idempotency               | Complete | Unique keys, DB tracking      |
| ✅ Failure simulation        | Complete | Gremlin + crash simulator     |
| ✅ Automated testing         | Complete | Unit + integration + stress   |
| ✅ Monitoring                | Complete | Prometheus + Grafana          |
| ✅ CI/CD pipeline            | Complete | GitHub Actions workflow       |
| ✅ User interface            | Complete | Web dashboard                 |
| ✅ Cloud deployment          | Complete | Azure AKS guide               |
| ✅ Backup strategy           | Complete | Automated daily backups       |

---

## 🔍 Problem Breakdown

### Challenge 1: Service Communication

**Problem:** How do services talk to each other reliably?

**Solution:**

- RESTful HTTP APIs
- Resilient HTTP client with timeout/retry/circuit breaker
- Clear API contracts
- Health check endpoints

### Challenge 2: Data Consistency

**Problem:** How to maintain consistency without shared database?

**Solution:**

- Each service owns its data
- Synchronous HTTP calls for order-inventory coordination
- Idempotency for exactly-once semantics
- Transaction per service (eventual consistency)

### Challenge 3: Failure Handling

**Problem:** What happens when Inventory Service is down?

**Scenarios:**

1. **Timeout**: Order service waits max 5s, then fails fast
2. **Retry**: Temporary failures retry automatically
3. **Circuit breaker open**: Order service fails immediately, saves time
4. **Partial success**: Order created but inventory not updated (tracked with `inventoryUpdated` flag)

### Challenge 4: Duplicate Prevention

**Problem:** Network retry can cause duplicate processing.

**Solution:**

- Client generates unique `idempotencyKey`
- Service checks database before processing
- If key exists, return original response
- If new, process and store with key

### Challenge 5: Testing Resilience

**Problem:** How to verify patterns work under real failures?

**Solution:**

- Latency gremlin: Tests timeout behavior
- Crash simulator: Tests idempotency with real crashes
- Integration tests: Verify end-to-end flows
- Stress tests: Performance under load

---

## 🎯 Success Criteria

### System Must:

✅ Handle 100+ requests per second  
✅ Survive inventory service failures  
✅ Prevent duplicate order processing  
✅ Maintain data consistency  
✅ Recover from crashes gracefully  
✅ Provide real-time monitoring  
✅ Support horizontal scaling  
✅ Pass all automated tests

### Demonstrated Through:

- ✅ Integration test results (all passing)
- ✅ Resilience test results (circuit breaker working)
- ✅ Idempotency test results (exactly-once confirmed)
- ✅ Stress test results (performance metrics)
- ✅ UI demonstration (visual proof)
- ✅ Documentation completeness

---

## 📝 Summary

We identified 11 core requirements and 4 additional features. Each requirement was analyzed for its purpose, broken down into technical challenges, and solved with industry-standard patterns.

The result is a **production-grade system** that not only meets all requirements but exceeds them with comprehensive testing, monitoring, documentation, and deployment readiness.

**Next:** Read [02-SOLUTION-DESIGN.md](./02-SOLUTION-DESIGN.md) to see how we designed the solution architecture.
