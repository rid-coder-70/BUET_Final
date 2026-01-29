#!/bin/bash

echo "======================================"
echo "Testing Latency Gremlin - ENABLED"
echo "======================================"
echo ""

# Reset counter
echo "1. Resetting gremlin counter..."
curl -s -X POST http://localhost:3002/api/gremlin/reset | jq .
echo ""

# Check gremlin stats (should be enabled)
echo "2. Checking gremlin configuration..."
curl -s http://localhost:3002/api/gremlin/stats | jq .
echo ""

# Make 10 requests and measure time
echo "3. Making 10 requests with gremlin ENABLED..."
echo "   (Every 5th request should be delayed by 3000ms)"
echo ""
for i in {1..10}; do
  START=$(date +%s%3N)
  RESPONSE=$(curl -s -i http://localhost:3002/api/inventory)
  END=$(date +%s%3N)
  ELAPSED=$((END - START))
  
  # Check if gremlin header is present
  GREMLIN_HEADER=$(echo "$RESPONSE" | grep -i "X-Gremlin-Delay" | cut -d' ' -f2 | tr -d '\r')
  
  if [ -n "$GREMLIN_HEADER" ]; then
    echo "Request $i: ${ELAPSED}ms 🐛 GREMLIN (delay: ${GREMLIN_HEADER}ms)"
  else
    echo "Request $i: ${ELAPSED}ms"
  fi
done

echo ""
echo "======================================"
echo "Requests 5 and 10 should be delayed!"
echo "======================================"
