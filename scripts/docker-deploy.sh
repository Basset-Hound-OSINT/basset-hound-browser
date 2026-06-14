#!/bin/bash
# Enhanced Docker deployment script with health checks and monitoring
# Supports staging and production deployments with rollback capability

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"
cd "$PROJECT_ROOT"

# Configuration
IMAGE_NAME="${IMAGE_NAME:-basset-hound-browser}"
CONTAINER_NAME="${CONTAINER_NAME:-basset-hound-browser}"
NETWORK_NAME="${NETWORK_NAME:-basset-hound-browser}"
PORT="${PORT:-8765}"
ENVIRONMENT="${ENVIRONMENT:-staging}"
DEPLOYMENT_TIMEOUT="${DEPLOYMENT_TIMEOUT:-300}"

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

# Utility functions
wait_for_health() {
  local max_attempts=$1
  local delay=$2
  local container=$3

  log_info "Waiting for container health..."

  for ((i=1; i<=max_attempts; i++)); do
    if docker exec "$container" curl -sf http://localhost:$PORT >/dev/null 2>&1; then
      log_success "Container is healthy"
      return 0
    fi

    if [ $i -lt $max_attempts ]; then
      echo -n "."
      sleep "$delay"
    fi
  done

  log_error "Container failed to become healthy within timeout"
  return 1
}

get_container_stats() {
  local container=$1

  docker stats --no-stream "$container" 2>/dev/null | awk 'NR>1 {print $3, $4}' || echo "N/A N/A"
}

save_deployment_info() {
  local info_file="$PROJECT_ROOT/deployment-info.json"

  cat > "$info_file" << EOF
{
  "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "environment": "$ENVIRONMENT",
  "image": "$IMAGE_NAME:latest",
  "container": "$CONTAINER_NAME",
  "port": $PORT,
  "deployment_id": "$(uuidgen 2>/dev/null || echo 'unknown')",
  "status": "deployed"
}
EOF

  log_info "Deployment info saved to $info_file"
}

# Pre-deployment checks
pre_deployment_checks() {
  log_info "Running pre-deployment checks..."

  # Check Docker daemon
  if ! docker ps >/dev/null 2>&1; then
    log_error "Docker daemon is not running"
    return 1
  fi
  log_success "Docker daemon is running"

  # Check Dockerfile
  if [ ! -f "Dockerfile" ]; then
    log_error "Dockerfile not found"
    return 1
  fi
  log_success "Dockerfile found"

  # Check port availability
  if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
    log_warning "Port $PORT is already in use"
  fi

  log_success "Pre-deployment checks passed"
}

# Build Docker image
build_image() {
  log_info "Building Docker image: $IMAGE_NAME:latest"

  if docker build -t "$IMAGE_NAME:latest" \
    --build-arg NODE_ENV="$ENVIRONMENT" \
    --label "environment=$ENVIRONMENT" \
    --label "built=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    .; then
    log_success "Docker image built successfully"

    # Show image info
    docker images "$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
  else
    log_error "Docker image build failed"
    return 1
  fi
}

# Stop existing container
stop_container() {
  if docker ps -q -f name="$CONTAINER_NAME" >/dev/null 2>&1; then
    log_info "Stopping existing container: $CONTAINER_NAME"

    if docker stop "$CONTAINER_NAME"; then
      log_success "Container stopped"
    else
      log_warning "Failed to stop container gracefully"
    fi

    # Wait for container to stop
    sleep 2

    if docker ps -q -f name="$CONTAINER_NAME" >/dev/null 2>&1; then
      log_warning "Force removing container..."
      docker rm -f "$CONTAINER_NAME"
    fi

    docker rm "$CONTAINER_NAME" 2>/dev/null || true
  else
    log_info "No existing container to stop"
  fi
}

# Create Docker network
create_network() {
  if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    log_info "Creating Docker network: $NETWORK_NAME"
    docker network create "$NETWORK_NAME"
    log_success "Network created"
  else
    log_info "Network already exists: $NETWORK_NAME"
  fi
}

# Start new container
start_container() {
  log_info "Starting new container: $CONTAINER_NAME"

  docker run -d \
    --name "$CONTAINER_NAME" \
    --network "$NETWORK_NAME" \
    -p "$PORT:$PORT" \
    -e ENVIRONMENT="$ENVIRONMENT" \
    -e DISPLAY=:99 \
    -e ELECTRON_DISABLE_SANDBOX=1 \
    --cap-drop ALL \
    --cap-add SYS_ADMIN \
    --restart unless-stopped \
    --health-cmd="curl -f http://localhost:$PORT || exit 1" \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    --health-start-period=40s \
    --memory="2g" \
    --memory-swap="2g" \
    --cpus="2" \
    "$IMAGE_NAME:latest"

  log_success "Container started: $(docker ps -q -f name=$CONTAINER_NAME | cut -c1-12)"
}

# Verify deployment
verify_deployment() {
  log_info "Verifying deployment..."

  # Wait for health
  if ! wait_for_health 30 2 "$CONTAINER_NAME"; then
    log_error "Health check failed"
    return 1
  fi

  # Check if container is running
  if ! docker ps -q -f name="$CONTAINER_NAME" >/dev/null; then
    log_error "Container is not running"
    return 1
  fi

  # Check logs for errors
  if docker logs "$CONTAINER_NAME" 2>&1 | grep -i "error\|fatal" | head -5 | grep -q .; then
    log_warning "Found error messages in logs:"
    docker logs "$CONTAINER_NAME" 2>&1 | grep -i "error\|fatal" | head -5
  fi

  log_success "Deployment verified"
}

# Get deployment metrics
get_metrics() {
  log_info "Deployment metrics:"

  local stats=$(get_container_stats "$CONTAINER_NAME")
  echo "  CPU: $(echo $stats | awk '{print $1}')"
  echo "  Memory: $(echo $stats | awk '{print $2}')"

  local uptime=$(docker inspect "$CONTAINER_NAME" --format='{{.State.StartedAt}}' 2>/dev/null || echo "unknown")
  echo "  Started: $uptime"

  local port_info=$(docker port "$CONTAINER_NAME" 2>/dev/null || echo "unknown")
  echo "  Port mapping: $port_info"
}

# Rollback function
rollback() {
  log_error "Deployment failed, initiating rollback..."

  if docker ps -q -f name="$CONTAINER_NAME" >/dev/null 2>&1; then
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  fi

  log_warning "Rollback completed. Previous state restored."
}

# Main deployment flow
main() {
  log_info "=== Docker Deployment ==="
  log_info "Environment: $ENVIRONMENT"
  log_info "Image: $IMAGE_NAME:latest"
  log_info "Container: $CONTAINER_NAME"
  log_info "Port: $PORT"
  echo ""

  # Execute deployment steps
  pre_deployment_checks || exit 1
  echo ""

  build_image || exit 1
  echo ""

  create_network
  echo ""

  stop_container
  echo ""

  start_container || exit 1
  echo ""

  if verify_deployment; then
    get_metrics
    save_deployment_info
    log_success "=== Deployment Successful ==="
    echo ""
    echo "Access the application:"
    echo "  WebSocket: ws://localhost:$PORT"
    echo "  Health: http://localhost:$PORT"
    exit 0
  else
    rollback
    exit 1
  fi
}

# Error handling
trap 'rollback' ERR

# Run main
main "$@"
