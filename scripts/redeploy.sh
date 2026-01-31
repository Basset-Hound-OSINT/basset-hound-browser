#!/bin/bash
# Quick redeploy - rebuilds and restarts without full verification
# For fast iteration during development

set -e

IMAGE_NAME="basset-hound-browser"
CONTAINER_NAME="basset-hound-browser"
NETWORK_NAME="basset-hound-browser"

echo "Quick redeploy starting..."

# Stop, rebuild, start
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Ensure network exists
docker network create $NETWORK_NAME 2>/dev/null || true

docker build -t $IMAGE_NAME:latest . | tail -5

docker run -d --name $CONTAINER_NAME \
  --network $NETWORK_NAME \
  -p 8765:8765 \
  -e DISPLAY=:99 \
  -e ELECTRON_DISABLE_SANDBOX=1 \
  --cap-drop ALL \
  --cap-add SYS_ADMIN \
  --restart unless-stopped \
  $IMAGE_NAME:latest

echo "Redeployed. WebSocket at ws://localhost:8765"
echo "Container on network: $NETWORK_NAME"
