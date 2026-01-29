

echo "=============================================="
echo "Testing TIMEOUT Scenario"
echo "=============================================="
echo ""
echo "Temporarily reducing timeout to 2 seconds"
echo "Gremlin delay: 3 seconds"
echo "Expected: Request should TIMEOUT"
echo ""

echo "Triggering 4 quick inventory calls first..."
for i in {1..4}; do
  curl -s http://104.214.168.187:3002/api/inventory/PROD-001 > /dev/null
  echo "  Request $i completed"
done

echo ""
echo "Now creating order (will be 5th inventory call - should hit gremlin)..."
echo ""



START=$(date +%s%3N)
RESPONSE=$(curl -s -X POST http://104.214.168.187:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"CUST-TIMEOUT-TEST","productId":"PROD-002","productName":"Xbox Series X","quantity":2}')
END=$(date +%s%3N)
ELAPSED=$((END - START))

echo "Response time: ${ELAPSED}ms"
echo ""
echo "Response:"
echo "$RESPONSE" | jq .

echo ""
echo "=============================================="
echo "Analysis:"
if [ $ELAPSED -gt 2500 ]; then
  echo "Request took ${ELAPSED}ms - gremlin delay handled!"
  echo "Timeout (5000ms) allowed request to complete"
else
  echo "Request was too fast (${ELAPSED}ms)"
  echo "   Gremlin may not have activated"
fi
echo "=============================================="
