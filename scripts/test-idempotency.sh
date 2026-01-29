

echo "============================================================"
echo "Phase 4: Testing Idempotency (Schrödinger's Warehouse)"
echo "============================================================"
echo ""
echo "Scenario: Service crashes AFTER database commit"
echo "         but BEFORE sending response to client"
echo ""
echo "Expected: Idempotency key prevents duplicate processing"
echo "============================================================"
echo ""

echo "🔧 Configuring services..."
echo "   - Gremlin: DISABLED"
echo "   - Crash Simulation: ENABLED (every 8th request)"
echo ""


echo "Current inventory for PROD-003:"
INITIAL_STOCK=$(curl -s http://104.214.168.187:3002/api/inventory/PROD-003 | jq -r '.product.stockQuantity')
echo "   Stock: $INITIAL_STOCK units"
echo ""


curl -s -X POST http://104.214.168.187:3002/api/gremlin/crash-reset > /dev/null
echo "Crash simulator counter reset"
echo ""

echo "============================================================"
echo "Test: Creating orders to trigger crash on 8th inventory call"
echo "============================================================"
echo ""

IDEMPOTENCY_KEY="ORDER-IDEMPOTENT-TEST-$(date +%s)"

for i in {1..10}; do
  echo "Attempt $i: Creating order with idempotency key: $IDEMPOTENCY_KEY"
  
  START=$(date +%s%3N)
  RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://104.214.168.187:3001/api/orders \
    -H "Content-Type: application/json" \
    -d "{\"customerId\":\"CUST-IDEMPOTENCY\",\"productId\":\"PROD-003\",\"productName\":\"Nintendo Switch\",\"quantity\":5,\"idempotencyKey\":\"$IDEMPOTENCY_KEY\"}" 2>&1)
  END=$(date +%s%3N)
  ELAPSED=$((END - START))
  
  HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
  BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")
  
  if [ -z "$HTTP_CODE" ] || [ "$HTTP_CODE" == "000" ]; then
    echo "  Connection failed (crash simulation?) - ${ELAPSED}ms"
  elif [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "201" ]; then
    MESSAGE=$(echo "$BODY" | jq -r '.message // "Success"')
    ORDER_ID=$(echo "$BODY" | jq -r '.order.id // "N/A"')
    IS_IDEMPOTENT=$(echo "$MESSAGE" | grep -i "already exists")
    
    if [ -n "$IS_IDEMPOTENT" ]; then
      echo "Idempotent response (order already exists) - ${ELAPSED}ms"
    else
      echo "Order created: $ORDER_ID - ${ELAPSED}ms"
    fi
  else
    echo "HTTP $HTTP_CODE - ${ELAPSED}ms"
  fi
  
  sleep 0.2
done

echo ""
echo "============================================================"
echo "Verification: Check inventory consistency"
echo "============================================================"
echo ""

FINAL_STOCK=$(curl -s http://104.214.168.187:3002/api/inventory/PROD-003 | jq -r '.product.stockQuantity')
EXPECTED_STOCK=$((INITIAL_STOCK - 5))

echo "Initial stock:  $INITIAL_STOCK units"
echo "Final stock:    $FINAL_STOCK units"
echo "Expected stock: $EXPECTED_STOCK units (initial - 5)"
echo ""

if [ "$FINAL_STOCK" == "$EXPECTED_STOCK" ]; then
  echo "SUCCESS: Inventory is CONSISTENT!"
  echo "   Despite crashes, only ONE deduction occurred"
  echo "   Idempotency working perfectly!"
else
  DIFFERENCE=$((INITIAL_STOCK - FINAL_STOCK))
  echo "Stock difference: -$DIFFERENCE units"
  if [ "$DIFFERENCE" -gt 5 ]; then
    echo "FAILURE: Duplicate processing detected!"
  else
    echo "Unexpected state - manual investigation needed"
  fi
fi

echo ""
echo "============================================================"
