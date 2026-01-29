#!/bin/bash

# Stop existing containers
docker compose down -v

# Build images
echo "Building images..."
docker compose build

# Start services
echo "Starting services..."
docker compose up -d

# Wait for 10 seconds (simulating the race condition, maybe even shorter than CI's 20s)
echo "Waiting for 10 seconds..."
sleep 10

# Check health of Order Service
echo "Checking Order Service Health..."
if curl -f http://localhost:3001/health; then
  echo "Order Service is HEALTHY"
  exit 0
else
  echo "Order Service is UNHEALTHY"
  echo "Fetching logs..."
  docker compose logs order-service
  exit 1
fi
