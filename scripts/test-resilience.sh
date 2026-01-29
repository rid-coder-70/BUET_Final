

echo "=============================================="
echo "Testing Resilience Patterns (Phase 3)"
echo "=============================================="
echo ""
echo "Configuration:"
echo "  - Gremlin: ENABLED (every 5th request, 3s delay)"
echo "  - Timeout: 5000ms"
echo "  - Max Retries: 3"
echo ""


curl -s -X POST http://localhost:3002/api/gremlin/reset > /dev/null
echo "Gremlin counter reset"
echo ""


echo "Circuit Breaker Status (before):"
curl -s http://localhost:3001/api/resilience/stats | jq '{state, config}'
echo ""

echo "=============================================="
echo "Test 1: Normal requests (should succeed)"
echo "=============================================="
echo ""

for i in {1..3}; do
  echo "Creating order $i..."
  START=$(date +%s%3N)
  RESPONSE=$(curl -s -X POST http://localhost:3001/api/orders \
    -H "Content-Type: application/json" \
    -d "{\"customerId\":\"CUST-TEST\",\"productId\":\"PROD-001\",\"productName\":\"Test Product\",\"quantity\":1}")
  END=$(date +%s%3N)
  ELAPSED=$((END - START))
  
  STATUS=$(echo "$RESPONSE" | jq -r '.message')
  ORDER_STATUS=$(echo "$RESPONSE" | jq -r '.order.status')
  
  echo " ${ELAPSED}ms - Status: $ORDER_STATUS - $STATUS"
done

echo ""
echo "=============================================="
echo "Test 2: Request that hits gremlin (delayed)"
echo "=============================================="
echo ""

echo "Creating order (should hit gremlin on 5th inventory call)..."
START=$(date +%s%3N)
RESPONSE=$(curl -s -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"CUST-TEST","productId":"PROD-001","productName":"Test Product","quantity":1}')
END=$(date +%s%3N)
ELAPSED=$((END - START))

STATUS=$(echo "$RESPONSE" | jq -r '.message')
ORDER_STATUS=$(echo "$RESPONSE" | jq -r '.order.status')
HAS_ERROR=$(echo "$RESPONSE" | jq -r '.inventoryError // "none"')

echo "  ${ELAPSED}ms - Status: $ORDER_STATUS"
echo "  Message: $STATUS"
if [ "$HAS_ERROR" != "none" ]; then
  echo "  Inventory Error: $HAS_ERROR"
fi

echo ""
echo "=============================================="
echo "Circuit Breaker Status (after):"
echo "=============================================="
curl -s http://localhost:3001/api/resilience/stats | jq .

echo ""
echo "=============================================="
echo "Expected Behavior:"
echo "  - Requests 1-3: Fast, successful (~20ms)"
echo "  - Request 4: Delayed by gremlin (~3s)"
echo "  - Circuit breaker: Should remain CLOSED"
echo "=============================================="
