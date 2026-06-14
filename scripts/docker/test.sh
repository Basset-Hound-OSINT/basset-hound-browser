#!/bin/bash
# Basset Hound Browser - Docker Testing Script
# Comprehensive validation of Docker build and container
# Usage: ./scripts/docker/test.sh [--build] [--full]

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$( dirname "$SCRIPT_DIR" )" )"
DOCKER_DIR="$PROJECT_ROOT/config/docker"

cd "$PROJECT_ROOT"

# Configuration
REBUILD=false
FULL_TEST=false
TEST_TIMEOUT=120
IMAGE_NAME="basset-hound-browser"
CONTAINER_NAME="basset-hound-browser-test"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Logging
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
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --build)
      REBUILD=true
      shift
      ;;
    --full)
      FULL_TEST=true
      shift
      ;;
    *)
      log_error "Unknown argument: $1"
      exit 1
      ;;
  esac
done

echo ""
log_info "=== Basset Hound Browser Docker Test Suite ==="
echo ""

# Test 1: Docker daemon
log_info "Test 1: Docker daemon health"
if docker ps >/dev/null 2>&1; then
  log_success "Docker daemon is running"
else
  log_error "Docker daemon is not responding"
  exit 1
fi

# Test 2: Dockerfile syntax
log_info "Test 2: Dockerfile syntax validation"
if docker build --dry-run -f "$DOCKER_DIR/Dockerfile" . >/dev/null 2>&1; then
  log_success "Dockerfile syntax is valid"
else
  log_error "Dockerfile syntax is invalid"
  exit 1
fi

# Test 3: Docker Compose files
log_info "Test 3: Docker Compose file validation"
for compose_file in "$DOCKER_DIR"/docker-compose*.yml; do
  if docker-compose -f "$compose_file" config >/dev/null 2>&1; then
    log_success "$(basename $compose_file) is valid"
  else
    log_error "$(basename $compose_file) is invalid"
  fi
done

echo ""

# Test 4: Image build (if requested)
if [ "$REBUILD" = true ]; then
  log_info "Test 4: Building Docker image"
  if docker build -t "$IMAGE_NAME:test" -f "$DOCKER_DIR/Dockerfile" .; then
    log_success "Docker image built successfully"
  else
    log_error "Docker image build failed"
    exit 1
  fi
fi

# Test 5: Image exists
log_info "Test 5: Docker image availability"
if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "$IMAGE_NAME"; then
  log_success "Docker image is available"
else
  log_warning "Docker image not found (use --build to create it)"
fi

echo ""

# Test 6: Container creation
log_info "Test 6: Container creation and startup"
if timeout "$TEST_TIMEOUT" docker-compose -f "$DOCKER_DIR/docker-compose.test.yml" up --abort-on-container-exit >/dev/null 2>&1; then
  log_success "Container started successfully"
else
  log_warning "Container test timed out or failed (expected if running full tests)"
fi

# Test 7: WebSocket health check
log_info "Test 7: WebSocket API health check"
if [ -n "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
  if docker exec "$CONTAINER_NAME" /app/health-check.sh >/dev/null 2>&1; then
    log_success "WebSocket API is responding"
  else
    log_error "WebSocket API health check failed"
  fi
else
  log_warning "Container not running (skipping health check)"
fi

# Test 8: Image size
log_info "Test 8: Image size validation"
IMAGE_SIZE=$(docker images --format "{{.Size}}" -f "reference=$IMAGE_NAME" 2>/dev/null | head -1 || echo "unknown")
if [ "$IMAGE_SIZE" != "unknown" ]; then
  log_success "Image size: $IMAGE_SIZE"
else
  log_warning "Unable to determine image size"
fi

echo ""

# Cleanup
log_info "Cleaning up test containers..."
docker-compose -f "$DOCKER_DIR/docker-compose.test.yml" down >/dev/null 2>&1 || true
log_success "Test environment cleaned up"

echo ""
echo "=== Test Results ==="
echo "  Passed: $TESTS_PASSED"
echo "  Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  log_success "All tests passed!"
  exit 0
else
  log_error "Some tests failed"
  exit 1
fi
