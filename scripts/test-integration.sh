

echo "=============================================="
echo "Integration Tests"
echo "=============================================="
echo ""


echo "Checking service health..."
ORDER_HEALTH=$(curl -s http://104.214.168.187:3001/health | jq -r '.status')
INVENTORY_HEALTH=$(curl -s http://104.214.168.187:3002/health | jq -r '.status')

if [ "$ORDER_HEALTH" != "healthy" ] || [ "$INVENTORY_HEALTH" != "healthy" ]; then
  echo "Services are not healthy!"
  echo "   Order Service: $ORDER_HEALTH"
  echo "   Inventory Service: $INVENTORY_HEALTH"
  exit 1
fi

echo "All services healthy"
echo ""


echo "Test 1: End-to-end order creation"
echo "-----------------------------------"

INITIAL_STOCK=$(curl -s http://104.214.168.187:3002/api/inventory/PROD-001 | jq -r '.product.stockQuantity')
echo "Initial stock for PROD-001: $INITIAL_STOCK"

ORDER_RESPONSE=$(curl -s -X POST http://104.214.168.187:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"CUST-INTEGRATION","productId":"PROD-001","productName":"Integration Test","quantity":2,"idempotencyKey":"INTEGRATION-TEST-'$(date +%s)'"}')

ORDER_STATUS=$(echo "$ORDER_RESPONSE" | jq -r '.order.status')
ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.order.id')

if [ "$ORDER_STATUS" == "shipped" ]; then
  echo "Order created and shipped: $ORDER_ID"
else
  echo "Order failed with status: $ORDER_STATUS"
  exit 1
fi

FINAL_STOCK=$(curl -s http://104.214.168.187:3002/api/inventory/PROD-001 | jq -r '.product.stockQuantity')
EXPECTED_STOCK=$((INITIAL_STOCK - 2))

echo "Final stock for PROD-001: $FINAL_STOCK"
echo "Expected: $EXPECTED_STOCK"

if [ "$FINAL_STOCK" == "$EXPECTED_STOCK" ]; then
  echo "Inventory correctly updated"
else
  echo "Inventory mismatch!"
  exit 1
fi

echo ""


echo "Test 2: Circuit breaker stats"
echo "-----------------------------------"

CB_STATS=$(curl -s http://104.214.168.187:3001/api/resilience/stats)
CB_STATE=$(echo "$CB_STATS" | jq -r '.state')

echo "Circuit breaker state: $CB_STATE"

if [ "$CB_STATE" == "closed" ] || [ "$CB_STATE" == "open" ] || [ "$CB_STATE" == "half-open" ]; then
  echo "Circuit breaker is functioning"
else
  echo "Circuit breaker in unknown state"
  exit 1
fi

echo ""

echo "Test 3: Idempotency verification"
echo "-----------------------------------"

IDEM_KEY="IDEM-TEST-$(date +%s%3N)"
echo "Using idempotency key: $IDEM_KEY"


RESP1=$(curl -s -X POST http://104.214.168.187:3001/api/orders \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"CUST-IDEM\",\"productId\":\"PROD-002\",\"productName\":\"Idem Test\",\"quantity\":1,\"idempotencyKey\":\"$IDEM_KEY\"}")

ORDER_ID_1=$(echo "$RESP1" | jq -r '.order.id')
echo "First request - Order ID: $ORDER_ID_1"


RESP2=$(curl -s -X POST http://104.214.168.187:3001/api/orders \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"CUST-IDEM\",\"productId\":\"PROD-002\",\"productName\":\"Idem Test\",\"quantity\":1,\"idempotencyKey\":\"$IDEM_KEY\"}")

ORDER_ID_2=$(echo "$RESP2" | jq -r '.order.id')
MESSAGE_2=$(echo "$RESP2" | jq -r '.message')

echo "Second request - Order ID: $ORDER_ID_2"
echo "Message: $MESSAGE_2"

if [ "$ORDER_ID_1" == "$ORDER_ID_2" ]; then
  echo "Idempotency working correctly"
else
  echo "Idempotency failed - different order IDs!"
  exit 1
fi

echo ""
echo "=============================================="
echo "All integration tests passed!"
echo "=============================================="
