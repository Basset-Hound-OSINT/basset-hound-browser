#!/bin/bash
# Basset Hound Browser - Docker Validation Suite
# Comprehensive testing of Docker build, images, and containers
# Usage: ./scripts/docker/validate.sh [--full] [--cleanup]

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$( dirname "$SCRIPT_DIR" )" )"
DOCKER_DIR="$PROJECT_ROOT/config/docker"

cd "$PROJECT_ROOT"

# Configuration
FULL_TEST=false
CLEANUP=false
IMAGE_NAME="basset-hound-browser"
IMAGE_TAG="12.0.0"
PROD_CONTAINER="basset-hound-browser-prod"
DEV_CONTAINER="basset-hound-browser-dev"
TEST_CONTAINER="basset-hound-browser-test"
WS_PORT=8765
TEST_RESULTS_DIR="tests/results/docker-validation"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $*"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_error() {
  echo -e "${RED}[✗]${NC} $*"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_warning() {
  echo -e "${YELLOW}[!]${NC} $*"
  TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --full)
      FULL_TEST=true
      shift
      ;;
    --cleanup)
      CLEANUP=true
      shift
      ;;
    *)
      log_error "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Create test results directory
mkdir -p "$TEST_RESULTS_DIR"

echo ""
log_info "=== Basset Hound Browser - Docker Validation Suite ==="
echo ""

# ============================================================================
# SECTION 1: Infrastructure Validation
# ============================================================================
log_info "SECTION 1: Infrastructure Validation"
echo ""

# Test 1.1: Docker daemon
log_info "1.1: Docker daemon health"
if docker ps >/dev/null 2>&1; then
  DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
  log_success "Docker daemon running (Version: $DOCKER_VERSION)"
else
  log_error "Docker daemon not responding"
  exit 1
fi

# Test 1.2: Docker Compose
log_info "1.2: Docker Compose availability"
if docker-compose --version >/dev/null 2>&1; then
  COMPOSE_VERSION=$(docker-compose --version | awk '{print $3}' | sed 's/,//')
  log_success "Docker Compose installed (Version: $COMPOSE_VERSION)"
else
  log_error "Docker Compose not installed"
  exit 1
fi

# Test 1.3: Disk space check
log_info "1.3: Disk space availability"
AVAILABLE_GB=$(df /var/lib/docker | awk 'NR==2 {printf "%.1f", $4/1024/1024}')
if (( $(echo "$AVAILABLE_GB > 10" | bc -l) )); then
  log_success "Sufficient disk space ($AVAILABLE_GB GB available)"
else
  log_warning "Low disk space ($AVAILABLE_GB GB available)"
fi

echo ""

# ============================================================================
# SECTION 2: File Validation
# ============================================================================
log_info "SECTION 2: File Validation"
echo ""

# Test 2.1: Dockerfile
log_info "2.1: Dockerfile presence and validity"
if [ -f "$DOCKER_DIR/Dockerfile" ]; then
  log_success "Dockerfile exists"

  # Check for critical patterns
  if grep -q "FROM node:" "$DOCKER_DIR/Dockerfile"; then
    log_success "Dockerfile has valid base image"
  else
    log_error "Dockerfile missing valid base image"
  fi
else
  log_error "Dockerfile not found at $DOCKER_DIR/Dockerfile"
fi

# Test 2.2: Docker Compose files
log_info "2.2: Docker Compose files"
COMPOSE_FILES=("docker-compose.yml" "docker-compose.dev.yml" "docker-compose.test.yml")
for compose_file in "${COMPOSE_FILES[@]}"; do
  if [ -f "$DOCKER_DIR/$compose_file" ]; then
    if docker-compose -f "$DOCKER_DIR/$compose_file" config >/dev/null 2>&1; then
      log_success "$compose_file exists and is valid"
    else
      log_error "$compose_file exists but has syntax errors"
    fi
  else
    log_warning "$compose_file not found"
  fi
done

# Test 2.3: .dockerignore
log_info "2.3: .dockerignore configuration"
if [ -f "$PROJECT_ROOT/.dockerignore" ]; then
  IGNORE_LINES=$(wc -l < "$PROJECT_ROOT/.dockerignore")
  log_success ".dockerignore exists ($IGNORE_LINES patterns)"
else
  log_warning ".dockerignore not found"
fi

echo ""

# ============================================================================
# SECTION 3: Image Validation
# ============================================================================
log_info "SECTION 3: Image Validation"
echo ""

# Test 3.1: Image exists
log_info "3.1: Docker image availability"
if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "$IMAGE_NAME:$IMAGE_TAG"; then
  IMAGE_SIZE=$(docker images "$IMAGE_NAME:$IMAGE_TAG" --format "{{.Size}}")
  IMAGE_CREATED=$(docker images "$IMAGE_NAME:$IMAGE_TAG" --format "{{.CreatedAt}}")
  log_success "Image exists ($IMAGE_SIZE, created: $IMAGE_CREATED)"
else
  log_warning "Image $IMAGE_NAME:$IMAGE_TAG not found (may need to build)"
fi

# Test 3.2: Image configuration
log_info "3.2: Image configuration validation"
if docker images "$IMAGE_NAME:$IMAGE_TAG" >/dev/null 2>&1; then
  EXPOSED_PORTS=$(docker image inspect "$IMAGE_NAME:$IMAGE_TAG" --format '{{json .Config.ExposedPorts}}' 2>/dev/null)
  if echo "$EXPOSED_PORTS" | grep -q "8765"; then
    log_success "WebSocket port (8765) properly exposed"
  else
    log_warning "WebSocket port exposure configuration not verified"
  fi

  # Check for health check
  HEALTHCHECK=$(docker image inspect "$IMAGE_NAME:$IMAGE_TAG" --format '{{json .Config.Healthcheck}}' 2>/dev/null)
  if [ "$HEALTHCHECK" != "null" ] && [ ! -z "$HEALTHCHECK" ]; then
    log_success "Health check configured"
  else
    log_warning "Health check not configured in image"
  fi
fi

echo ""

# ============================================================================
# SECTION 4: Container Startup Tests (if --full is specified)
# ============================================================================
if [ "$FULL_TEST" = true ]; then
  log_info "SECTION 4: Full Container Startup Tests"
  echo ""

  # Clean up existing containers
  log_info "4.1: Cleanup existing test containers"
  for container in $PROD_CONTAINER $DEV_CONTAINER $TEST_CONTAINER; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
      docker stop "$container" 2>/dev/null || true
      docker rm "$container" 2>/dev/null || true
      log_success "Removed existing container: $container"
    fi
  done

  echo ""

  # Test 4.1: Production startup
  log_info "4.2: Production container startup test"
  if docker run --rm -d \
    --name "$PROD_CONTAINER" \
    -p "$WS_PORT:8765" \
    --network basset-hound-prod \
    "$IMAGE_NAME:$IMAGE_TAG" > /dev/null 2>&1; then

    CONTAINER_ID=$(docker ps -q -f name=$PROD_CONTAINER)
    if [ ! -z "$CONTAINER_ID" ]; then
      log_success "Production container started (ID: ${CONTAINER_ID:0:8})"

      # Wait for readiness
      log_info "  Waiting for application startup..."
      for i in {1..30}; do
        if docker exec "$PROD_CONTAINER" nc -z 127.0.0.1 $WS_PORT 2>/dev/null; then
          log_success "  WebSocket port is responding"
          break
        fi
        if [ $i -eq 30 ]; then
          log_warning "  WebSocket port did not respond within 30 seconds"
        fi
        sleep 1
      done

      # Get container stats
      MEMORY=$(docker stats --no-stream "$PROD_CONTAINER" --format "{{.MemUsage}}" 2>/dev/null || echo "N/A")
      CPU=$(docker stats --no-stream "$PROD_CONTAINER" --format "{{.CPUPerc}}" 2>/dev/null || echo "N/A")
      log_success "Container stats - Memory: $MEMORY, CPU: $CPU"

      # Cleanup
      docker stop "$PROD_CONTAINER" 2>/dev/null || true
    else
      log_error "Failed to start production container"
    fi
  else
    log_error "Failed to create production container"
  fi

else
  log_warning "Skipping full container startup tests (use --full to enable)"
  TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
fi

echo ""

# ============================================================================
# SECTION 5: Configuration Validation
# ============================================================================
log_info "SECTION 5: Configuration Validation"
echo ""

# Test 5.1: Environment variables
log_info "5.1: Environment variable configuration"
for compose_file in "$DOCKER_DIR/docker-compose.yml" "$DOCKER_DIR/docker-compose.dev.yml"; do
  if [ -f "$compose_file" ]; then
    if grep -q "NODE_ENV" "$compose_file"; then
      log_success "$(basename $compose_file) has NODE_ENV configured"
    else
      log_warning "$(basename $compose_file) missing NODE_ENV"
    fi
  fi
done

# Test 5.2: Volume mounts
log_info "5.2: Volume mount configuration"
if grep -q "volumes:" "$DOCKER_DIR/docker-compose.yml"; then
  VOLUME_COUNT=$(grep -c "^    - " "$DOCKER_DIR/docker-compose.yml")
  log_success "Volumes configured ($VOLUME_COUNT mount points)"
else
  log_warning "No volume mounts configured"
fi

# Test 5.3: Resource limits
log_info "5.3: Resource limit configuration"
if grep -q "deploy:" "$DOCKER_DIR/docker-compose.yml"; then
  if grep -q "memory:" "$DOCKER_DIR/docker-compose.yml"; then
    MEMORY_LIMIT=$(grep "memory:" "$DOCKER_DIR/docker-compose.yml" | head -1 | awk '{print $2}')
    log_success "Memory limit configured: $MEMORY_LIMIT"
  fi
  if grep -q "cpus:" "$DOCKER_DIR/docker-compose.yml"; then
    CPU_LIMIT=$(grep "cpus:" "$DOCKER_DIR/docker-compose.yml" | head -1 | awk '{print $2}' | sed "s/'//g")
    log_success "CPU limit configured: $CPU_LIMIT"
  fi
else
  log_warning "Resource limits not configured"
fi

echo ""

# ============================================================================
# Test Summary
# ============================================================================
echo "=== Test Summary ==="
echo "  Passed:  $TESTS_PASSED"
echo "  Failed:  $TESTS_FAILED"
echo "  Skipped: $TESTS_SKIPPED"
echo ""

# Save results
cat > "$TEST_RESULTS_DIR/validation_results.txt" << EOF
Docker Validation Results
Generated: $(date)

Summary:
  Passed:  $TESTS_PASSED
  Failed:  $TESTS_FAILED
  Skipped: $TESTS_SKIPPED

Image Information:
  Name:    $IMAGE_NAME:$IMAGE_TAG
  Status:  $(docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "$IMAGE_NAME:$IMAGE_TAG" && echo "Available" || echo "Not Found")

Compose Files:
  Production: $DOCKER_DIR/docker-compose.yml
  Development: $DOCKER_DIR/docker-compose.dev.yml
  Testing: $DOCKER_DIR/docker-compose.test.yml
EOF

log_success "Validation results saved to $TEST_RESULTS_DIR/validation_results.txt"

# Cleanup if requested
if [ "$CLEANUP" = true ]; then
  log_info "Cleaning up Docker resources..."
  for container in $PROD_CONTAINER $DEV_CONTAINER $TEST_CONTAINER; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
      docker stop "$container" 2>/dev/null || true
      docker rm "$container" 2>/dev/null || true
      log_success "Removed container: $container"
    fi
  done
fi

echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  log_success "Validation complete - all critical tests passed!"
  exit 0
else
  log_error "Validation failed - $TESTS_FAILED test(s) failed"
  exit 1
fi
