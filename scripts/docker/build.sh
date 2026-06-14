#!/bin/bash
# Basset Hound Browser - Docker Image Builder
# Optimizes build process with caching and multi-stage build
# Usage: ./scripts/docker/build.sh [--no-cache] [--tag TAG]

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$( dirname "$SCRIPT_DIR" )" )"
cd "$PROJECT_ROOT"

# Configuration
IMAGE_NAME="${IMAGE_NAME:-basset-hound-browser}"
TAG="${TAG:-12.0.0}"
DOCKERFILE="config/docker/Dockerfile"
NO_CACHE=""
BUILD_ARGS=""

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
    --no-cache)
      NO_CACHE="--no-cache"
      log_info "Building with --no-cache"
      shift
      ;;
    --tag)
      TAG="$2"
      shift 2
      ;;
    --build-arg)
      BUILD_ARGS="$BUILD_ARGS --build-arg $2"
      shift 2
      ;;
    *)
      log_error "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Pre-build checks
log_info "Performing pre-build checks..."

if [ ! -f "package.json" ]; then
  log_error "package.json not found in project root"
  exit 1
fi
log_success "package.json found"

if [ ! -f "$DOCKERFILE" ]; then
  log_error "Dockerfile not found at $DOCKERFILE"
  exit 1
fi
log_success "Dockerfile found"

# Check Docker daemon
if ! docker ps >/dev/null 2>&1; then
  log_error "Docker daemon is not running"
  exit 1
fi
log_success "Docker daemon is running"

echo ""

# Show build configuration
log_info "Build Configuration:"
echo "  Image: $IMAGE_NAME:$TAG"
echo "  Dockerfile: $DOCKERFILE"
echo "  Context: $(pwd)"
echo "  Cache: $([ -z "$NO_CACHE" ] && echo 'enabled' || echo 'disabled')"
echo ""

# Build image
log_info "Building Docker image..."
echo "  Command: docker build $NO_CACHE -t $IMAGE_NAME:$TAG -f $DOCKERFILE $BUILD_ARGS ."
echo ""

if docker build $NO_CACHE -t "$IMAGE_NAME:$TAG" -f "$DOCKERFILE" $BUILD_ARGS .; then
  log_success "Docker image built successfully"
  echo ""

  # Show image info
  log_info "Image Information:"
  docker images "$IMAGE_NAME" --filter "reference=$IMAGE_NAME:$TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

  # Calculate build time
  CURRENT_TIME=$(date +%s)
  log_success "Build completed in $((CURRENT_TIME - BUILD_START))s"
  
  exit 0
else
  log_error "Docker image build failed"
  exit 1
fi
