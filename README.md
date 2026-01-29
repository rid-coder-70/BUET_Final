# 🚀 Valerix Microservices - Production-Ready Order Processing System

**A comprehensive microservice-based e-commerce order processing system** featuring resilience patterns, chaos engineering, automated testing, real-time monitoring, and cloud deployment readiness.

![System Status](https://img.shields.io/badge/status-production--ready-brightgreen) ![Tests](https://img.shields.io/badge/tests-passing-brightgreen) ![Docker](https://img.shields.io/badge/docker-ready-blue) ![Azure](https://img.shields.io/badge/azure-deployment--ready-blue)

---

## 📊 System Overview

### Architecture

```
┌─────────────┐      HTTP/REST      ┌──────────────────┐
│   Web UI    │ ───────────────────▶│  Order Service   │
│ localhost:  │                      │   (Port 3001)    │
│    8080     │                      │                  │
└─────────────┘                      │ - Circuit Breaker│
                                      │ - Retry Logic    │
                                      │ - Timeouts       │
                                      │ - Idempotency    │
                                      └─────────┬────────┘
                                                │
                                      HTTP with Resilience
                                                │
                                                ▼
                                      ┌──────────────────┐
                                      │ Inventory Service│
                                      │   (Port 3002)    │
                                      │                  │
                                      │ - Gremlin        │
                                      │ - Crash Simulator│
                                      │ - Idempotency    │
                                      └─────────┬────────┘
                                                │
         ┌──────────────────┬──────────────────┴──────────────────┬──────────────────┐
         ▼                  ▼                                       ▼                  ▼
  ┌──────────┐      ┌──────────┐                            ┌──────────┐      ┌──────────┐
  │PostgreSQL│      │PostgreSQL│                            │Prometheus│      │ Grafana  │
  │  Order   │      │Inventory │                            │ (9090)   │      │ (3000)   │
  │  (5432)  │      │  (5433)  │                            └──────────┘      └──────────┘
  └──────────┘      └──────────┘
```

### Core Features

✅ **Resilience Patterns** - Timeout (5s), Retry with exponential backoff (3 attempts), Circuit breaker (50% error threshold)  
✅ **Idempotency** - Exactly-once semantics with crash recovery simulation  
✅ **Chaos Engineering** - Latency gremlin (3s delays), Crash simulator (connection resets)  
✅ **Automated Testing** - Unit tests (Jest), Integration tests, Stress tests (Artillery)  
✅ **Real-time Monitoring** - Prometheus metrics, Grafana dashboards  
✅ **Interactive UI** - Web dashboard for order management and system monitoring  
✅ **Cloud-Ready** - Container-based, Kubernetes manifests, Azure deployment guide

---

## 🏁 Quick Start

### Prerequisites

- **Docker** & **Docker Compose**
- **Python 3** (for UI server)
- **Node.js 18+** (optional, for local development)

### 1. Start the System

```bash
# Clone the repository
git clone https://github.com/rid-coder-70/BUET_Final
cd BUET_Final

# Start all services
docker compose up -d

# Wait for health checks (20-30 seconds)
docker compose ps
```

### 2. Seed Sample Data

```bash
docker exec -i valerix-postgres-inventory psql -U inventory_user -d inventory_db < scripts/seed-data.sql
```

### 3. Start the Web UI

```bash
cd ui
python3 -m http.server 8080
```

### 4. Access the System

- **Web Dashboard**: http://localhost:8080
- **Order Service API**: http://localhost:3001
- **Inventory Service API**: http://localhost:3002
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

---

## 🎯 Testing the System

### Integration Tests

```bash
bash scripts/test-integration.sh
```

**Tests:**

- ✅ End-to-end order creation + inventory update
- ✅ Circuit breaker functionality
- ✅ Idempotency verification

### Resilience Tests

```bash
# Test timeout behavior
bash scripts/test-timeout.sh

# Test full resilience stack
bash scripts/test-resilience.sh

# Test idempotency with crash simulation
bash scripts/test-idempotency.sh
```

### Gremlin Tests

```bash
# Test with gremlin disabled (fast responses)
bash scripts/test-gremlin-disabled.sh

# Test with gremlin enabled (3s delays)
bash scripts/test-gremlin-enabled.sh
```

---

## 📡 API Endpoints

### Order Service (Port 3001)

| Method | Endpoint                | Description           |
| ------ | ----------------------- | --------------------- |
| GET    | `/health`               | Health check          |
| POST   | `/api/orders`           | Create order          |
| GET    | `/api/orders/:id`       | Get order by ID       |
| GET    | `/api/resilience/stats` | Circuit breaker stats |
| GET    | `/metrics`              | Prometheus metrics    |

**Create Order Example:**

```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUST-001",
    "productId": "PROD-001",
    "productName": "Dell XPS 15",
    "quantity": 2,
    "idempotencyKey": "ORDER-123-UNIQUE"
  }'
```

### Inventory Service (Port 3002)

| Method | Endpoint                    | Description           |
| ------ | --------------------------- | --------------------- |
| GET    | `/health`                   | Health check          |
| GET    | `/api/inventory`            | Get all products      |
| GET    | `/api/inventory/:productId` | Get product stock     |
| POST   | `/api/inventory/update`     | Update inventory      |
| GET    | `/api/gremlin/stats`        | Gremlin statistics    |
| GET    | `/api/gremlin/crash-stats`  | Crash simulator stats |
| GET    | `/metrics`                  | Prometheus metrics    |

---

## 🐛 Chaos Engineering

### Latency Gremlin

Simulates slow network responses to test timeout/retry logic.

**Configuration** (`docker-compose.yml`):

```yaml
ENABLE_GREMLIN: "true" # Enable/disable
GREMLIN_LATENCY_MS: 3000 # Delay duration (ms)
GREMLIN_FREQUENCY: 5 # Every Nth request
GREMLIN_PATTERN: deterministic # or "random"
```

**Testing:**

```bash
# Check stats
curl http://localhost:3002/api/gremlin/stats

# Reset counter
curl -X POST http://localhost:3002/api/gremlin/reset
```

### Crash Simulator

Simulates service crashes after database commits to test idempotency.

**Configuration:**

```yaml
ENABLE_CRASH_SIMULATION: "true" # Enable/disable
CRASH_TYPE: deterministic # or "random"
CRASH_FREQUENCY: 8 # Crash every Nth request
CRASH_MODE: connection_reset # "connection_reset", "internal_error", or "timeout"
CRASH_PROBABILITY: 0.2 # For random mode (20%)
```

**Testing:**

```bash
# Check stats
curl http://localhost:3002/api/gremlin/crash-stats

# Run idempotency test
bash scripts/test-idempotency.sh
```

---

## 📊 Monitoring & Observability

### Prometheus Metrics

Custom metrics exposed at `/metrics`:

**Order Service:**

- `orders_created_total` - Total orders created
- `inventory_calls_total` - Inventory service calls
- `order_processing_duration_seconds` - Processing latency
- `circuit_breaker_state` - Circuit breaker state (0=closed, 1=open, 2=half-open)
- `http_request_duration_seconds` - HTTP request latency

**Inventory Service:**

- `inventory_updates_total` - Total inventory updates
- `inventory_stock_level` - Current stock levels
- `gremlin_activations_total` - Gremlin activation count
- `crash_simulations_total` - Crash simulation count
- `http_request_duration_seconds` - HTTP request latency

### Grafana Dashboards

Access Grafana at http://localhost:3000 (admin/admin)

**Pre-configured datasource:** Prometheus (auto-configured)

**Useful Queries:**

```promql
# Order creation rate
rate(orders_created_total[5m])

# Average request duration
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# Circuit breaker state
circuit_breaker_state

# Current stock levels
inventory_stock_level
```

---

## 🎨 Web UI Features

Access at **http://localhost:8080**

### 1. System Status Dashboard

- Real-time health checks for all services
- Circuit breaker state monitoring
- Quick links to Prometheus/Grafana

### 2. Order Management

- Create new orders with product selection
- Customer ID input
- Quantity specification
- Optional idempotency key
- Real-time confirmation

### 3. Inventory Viewer

- Live stock levels for all products
- Color-coded indicators (high/low/out of stock)
- One-click refresh

### 4. Chaos Engineering Controls

- View latency gremlin configuration
- View crash simulator status
- Real-time statistics

### 5. Activity Log

- Recent order history
- Success/failure indicators
- Auto-updating timestamps

---

## 🏗️ Project Structure

```
valerix-microservices/
├── docker-compose.yml           # Container orchestration
├── AZURE_DEPLOYMENT.md          # Cloud deployment guide
├── README.md                    # This file
│
├── order-service/               # Order processing microservice
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── index.js
│   │   ├── metrics.js          # Prometheus metrics
│   │   ├── config/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   │       └── inventoryClient.js  # Resilient HTTP client
│   └── tests/
│       └── orders.test.js       # Unit tests
│
├── inventory-service/           # Inventory management microservice
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── index.js
│   │   ├── metrics.js          # Prometheus metrics
│   │   ├── middleware/
│   │   │   ├── gremlin.js      # Latency simulation
│   │   │   └── crashSimulator.js  # Crash simulation
│   │   ├── config/
│   │   ├── models/
│   │   └── routes/
│   └── tests/
│       └── inventory.test.js    # Unit tests
│
├── ui/                          # Web dashboard
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
├── scripts/                     # Test and utility scripts
│   ├── seed-data.sql
│   ├── test-integration.sh
│   ├── test-resilience.sh
│   ├── test-idempotency.sh
│   ├── test-gremlin-enabled.sh
│   ├── test-gremlin-disabled.sh
│   └── test-timeout.sh
│
├── monitoring/                  # Monitoring configuration
│   ├── prometheus.yml
│   └── grafana/
│       ├── provisioning/
│       └── dashboards/
│
└── .github/
    └── workflows/
        └── ci.yml              # GitHub Actions CI/CD
```

---

## 🧪 CI/CD Pipeline

### GitHub Actions

Automated pipeline (`.github/workflows/ci.yml`) runs on every push:

1. **Build Phase** - Build Docker images for both services
2. **Health Check** - Verify services start correctly
3. **Unit Tests** - Run Jest tests with coverage
4. **Integration Tests** - End-to-end workflow tests
5. **Stress Tests** - Artillery load testing (10→50→100 req/sec)
6. **Resilience Tests** - Verify timeout/retry/circuit breaker
7. **Cleanup** - Tear down containers

### Local CI/CD Simulation

```bash
# Run all tests locally
bash scripts/test-integration.sh
bash scripts/test-resilience.sh
cd order-service && npm test
cd inventory-service && npm test
```

---

## 🛠️ Development

### Local Development (Without Docker)

**Order Service:**

```bash
cd order-service
npm install
export DB_HOST=localhost DB_PORT=5432 DB_NAME=order_db DB_USER=order_user DB_PASSWORD=order_password
npm run dev
```

**Inventory Service:**

```bash
cd inventory-service
npm install
export DB_HOST=localhost DB_PORT=5433 DB_NAME=inventory_db DB_USER=inventory_user DB_PASSWORD=inventory_password
npm run dev
```

### Running Tests

```bash
# Unit tests with coverage
cd order-service && npm test
cd inventory-service && npm test

# Integration tests
bash scripts/test-integration.sh
```

---

## 🧹 Cleanup

```bash
# Stop all services
docker compose down

# Remove volumes (⚠️ deletes all data)
docker compose down -v

# Stop UI server
# Press Ctrl+C in the terminal running the UI
```

---

## ✅ System Verification

Run this command to verify everything is working:

```bash
# Check all services
docker compose ps

# Run integration tests
bash scripts/test-integration.sh

# Open web dashboard
open http://localhost:8080  # Mac
xdg-open http://localhost:8080  # Linux
```

**Expected Result**: All tests passing, all services healthy, UI accessible.

---

## 📝 License

ISC

---
