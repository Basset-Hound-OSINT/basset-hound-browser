#!/bin/bash
# Basset Hound Browser - Docker Build Script
# Builds optimized Docker image with multi-stage caching
# Usage: ./scripts/docker-build.sh [OPTIONS]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="basset-hound-browser"
IMAGE_TAG="${1:-12.7.0}"
BUILD_CONTEXT="$PROJECT_ROOT"
DOCKERFILE="$PROJECT_ROOT/Dockerfile"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Print usage
usage() {
    cat << EOF
Usage: $0 [TAG] [OPTIONS]

Arguments:
  TAG              Image tag (default: 12.7.0)

Options:
  --no-cache       Build without using Docker cache
  --force          Force rebuild even if image exists
  --platform       Build for specific platform (linux/amd64, linux/arm64, etc.)
  --help           Show this help message

Examples:
  $0                          # Build as basset-hound-browser:12.7.0
  $0 latest                   # Build as basset-hound-browser:latest
  $0 12.7.0 --no-cache       # Rebuild from scratch
  $0 12.7.0 --platform linux/arm64  # Build for ARM64
EOF
}

# Parse arguments
NO_CACHE=""
FORCE=false
PLATFORM=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cache)
            NO_CACHE="--no-cache"
            log_info "Cache disabled"
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --platform)
            PLATFORM="--platform $2"
            log_info "Target platform: $2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            IMAGE_TAG="$1"
            shift
            ;;
    esac
done

# Pre-flight checks
log_info "=== Basset Hound Browser - Docker Build ==="
log_info "Image: $IMAGE_NAME:$IMAGE_TAG"
log_info ""

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
fi
log_success "Docker CLI available"

# Check Dockerfile exists
if [ ! -f "$DOCKERFILE" ]; then
    log_error "Dockerfile not found: $DOCKERFILE"
fi
log_success "Dockerfile found"

# Check build context
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    log_error "package.json not found at: $PROJECT_ROOT"
fi
log_success "Build context valid"

# Check if image already exists (unless --force)
if ! [ "$FORCE" = true ]; then
    if docker image inspect "$IMAGE_NAME:$IMAGE_TAG" >/dev/null 2>&1; then
        log_warn "Image already exists: $IMAGE_NAME:$IMAGE_TAG"
        read -p "Rebuild anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Build cancelled"
            exit 0
        fi
    fi
fi

log_info ""
log_info "=== Starting Docker Build ==="
log_info "Building from: $DOCKERFILE"
log_info "Build context: $BUILD_CONTEXT"
log_info "Target image: $IMAGE_NAME:$IMAGE_TAG"
log_info ""

# Build the image
START_TIME=$(date +%s)

BUILD_CMD="docker build \
    $NO_CACHE \
    $PLATFORM \
    -f $DOCKERFILE \
    -t $IMAGE_NAME:$IMAGE_TAG \
    -t $IMAGE_NAME:latest \
    --progress=plain \
    $BUILD_CONTEXT"

if eval "$BUILD_CMD"; then
    END_TIME=$(date +%s)
    BUILD_DURATION=$((END_TIME - START_TIME))

    log_success "Build completed in ${BUILD_DURATION}s"

    # Get image size
    IMAGE_SIZE=$(docker image inspect "$IMAGE_NAME:$IMAGE_TAG" --format='{{.Size}}' | numfmt --to=iec 2>/dev/null || echo "unknown")
    log_info "Image size: $IMAGE_SIZE"

    # Verify image
    log_info ""
    log_info "=== Image Verification ==="
    docker image inspect "$IMAGE_NAME:$IMAGE_TAG" --format='
    Image: {{.Id | truncate 12}}
    Created: {{.Created}}
    Size: {{.Size}}
    Architecture: {{.Architecture}}
    OS: {{.Os}}
    '

    log_success "Build successful!"
    log_info ""
    log_info "Next steps:"
    log_info "  - Test image: docker run --rm $IMAGE_NAME:$IMAGE_TAG /app/health-check.sh"
    log_info "  - Deploy: ./scripts/docker-run.sh"
    log_info "  - Compose: docker-compose up -d"
else
    log_error "Build failed"
fi
