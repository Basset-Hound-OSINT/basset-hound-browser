#!/bin/bash
# Basset Hound Browser - Quick Start Script
# Single command to build and run the application
# Usage: ./scripts/docker/quick-start.sh [--dev|--test|--prod] [--no-build]

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$( dirname "$SCRIPT_DIR" )" )"
DOCKER_DIR="$PROJECT_ROOT/config/docker"

cd "$PROJECT_ROOT"

# Configuration
MODE="${MODE:-prod}"
NO_BUILD=""
COMPOSE_FILE="$DOCKER_DIR/docker-compose.yml"
NETWORK_NAME="basset-hound-prod"
PORT=8765

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log_info() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $*"
}

log_error() {
  echo -e "${RED}[✗]${NC} $*"
}

log_warning() {
  echo -e "${YELLOW}[!]${NC} $*"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dev)
      MODE="dev"
      COMPOSE_FILE="$DOCKER_DIR/docker-compose.dev.yml"
      NETWORK_NAME="basset-hound-dev"
      shift
      ;;
    --test)
      MODE="test"
      COMPOSE_FILE="$DOCKER_DIR/docker-compose.test.yml"
      NETWORK_NAME="basset-hound-test"
      shift
      ;;
    --prod)
      MODE="prod"
      COMPOSE_FILE="$DOCKER_DIR/docker-compose.yml"
      NETWORK_NAME="basset-hound-prod"
      shift
      ;;
    --no-build)
      NO_BUILD="--no-build"
      shift
      ;;
    *)
      log_error "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Welcome message
echo ""
log_info "=== Basset Hound Browser Quick Start ==="
echo "  Mode: $MODE"
echo "  Compose File: $COMPOSE_FILE"
echo "  Port: $PORT"
echo ""

# Pre-flight checks
log_info "Performing pre-flight checks..."

if [ ! -f "$COMPOSE_FILE" ]; then
  log_error "Docker Compose file not found: $COMPOSE_FILE"
  exit 1
fi
log_success "Docker Compose file found"

if ! docker ps >/dev/null 2>&1; then
  log_error "Docker daemon is not running"
  exit 1
fi
log_success "Docker daemon is running"

echo ""

# Check for existing containers
CONTAINER_NAME="basset-hound-browser-$MODE"
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  log_warning "Container $CONTAINER_NAME already exists"
  read -p "  Stop and remove existing container? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    log_success "Removed existing container"
  fi
fi

echo ""

# Build image if needed
if [ -z "$NO_BUILD" ]; then
  log_info "Building Docker image..."
  docker-compose -f "$COMPOSE_FILE" build
  log_success "Image built"
  echo ""
fi

# Create network if needed
log_info "Setting up network: $NETWORK_NAME"
docker network create "$NETWORK_NAME" 2>/dev/null || log_warning "Network already exists"

echo ""

# Start containers
log_info "Starting application in $MODE mode..."
docker-compose -f "$COMPOSE_FILE" up -d

echo ""

# Wait for health
log_info "Waiting for application to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if docker exec "${CONTAINER_NAME}" curl -sf http://localhost:$PORT >/dev/null 2>&1; then
    log_success "Application is ready!"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
    echo -n "."
    sleep 2
  fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  log_warning "Application health check timed out"
fi

echo ""
echo ""
log_success "=== Quick Start Complete ==="
echo ""
echo "Access the application:"
echo "  WebSocket API: ws://localhost:$PORT"
echo ""
echo "Useful commands:"
echo "  View logs:    docker-compose -f $COMPOSE_FILE logs -f"
echo "  Stop:         docker-compose -f $COMPOSE_FILE stop"
echo "  Restart:      docker-compose -f $COMPOSE_FILE restart"
echo "  Remove:       docker-compose -f $COMPOSE_FILE down"
echo ""
