#!/bin/bash
# Basset Hound Browser - Simple Deployment Script
# Usage: ./scripts/deploy.sh [--no-cache]

set -e

IMAGE_NAME="basset-hound-browser"
CONTAINER_NAME="basset-hound-browser"
NETWORK_NAME="basset-hound-browser"
PORT=8765

echo "=== Basset Hound Browser Deployment ==="
echo "Image: $IMAGE_NAME"
echo "Container: $CONTAINER_NAME"
echo "Network: $NETWORK_NAME"
echo "Port: $PORT"
echo ""

# Parse args
NO_CACHE=""
if [ "$1" == "--no-cache" ]; then
  NO_CACHE="--no-cache"
  echo "Building with --no-cache"
fi

# Step 1: Stop existing container (if running)
echo "[1/5] Stopping existing container..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Step 2: Create network (if not exists)
echo "[2/5] Creating Docker network..."
docker network create $NETWORK_NAME 2>/dev/null || echo "Network already exists"

# Step 3: Build new image
echo "[3/5] Building Docker image..."
docker build $NO_CACHE -t $IMAGE_NAME:latest .

# Step 4: Start new container
echo "[4/5] Starting new container..."
docker run -d --name $CONTAINER_NAME \
  --network $NETWORK_NAME \
  -p $PORT:$PORT \
  -e DISPLAY=:99 \
  -e ELECTRON_DISABLE_SANDBOX=1 \
  --cap-drop ALL \
  --cap-add SYS_ADMIN \
  --restart unless-stopped \
  $IMAGE_NAME:latest

# Step 5: Verify
echo "[5/5] Verifying deployment..."
sleep 10

# Check if container is running
if docker ps | grep -q $CONTAINER_NAME; then
  echo ""
  echo "✓ Container is running"

  # Check WebSocket server
  HEALTH=$(docker exec $CONTAINER_NAME curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT 2>/dev/null || echo "000")
  if [ "$HEALTH" == "426" ]; then
    echo "✓ WebSocket server responding on port $PORT"
    echo ""
    echo "=== Deployment successful ==="
    echo "WebSocket API: ws://localhost:$PORT"
  else
    echo "⚠ WebSocket server not responding yet (may need more time)"
  fi
else
  echo "✗ Container failed to start"
  docker logs $CONTAINER_NAME 2>&1 | tail -20
  exit 1
fi
