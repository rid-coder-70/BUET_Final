#!/bin/bash

echo "======================================"
echo "Testing Latency Gremlin - DISABLED"
echo "======================================"
echo ""

# Check gremlin stats (should be disabled)
echo "1. Checking gremlin configuration..."
curl -s http://localhost:3002/api/gremlin/stats | jq .
echo ""

# Make 10 requests and measure time
echo "2. Making 10 requests with gremlin DISABLED..."
for i in {1..10}; do
  START=$(date +%s%3N)
  curl -s http://localhost:3002/api/inventory >/dev/null
  END=$(date +%s%3N)
  ELAPSED=$((END - START))
  echo "Request $i: ${ELAPSED}ms"
done

echo ""
echo "======================================"
echo "All requests should be fast (<100ms)"
echo "======================================"
