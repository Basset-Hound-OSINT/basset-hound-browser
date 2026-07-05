#!/bin/bash
# Basset Hound Browser - Development Deployment Script (v12.3.0+ Latest)
# Auto-deploys from main branch, quick startup, automatic restart on crash
# Usage: ./scripts/deploy-development.sh [--rebuild] [--no-cache] [--watch]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
CONTAINER_NAME="basset-hound-browser-dev"
COMPOSE_FILE="config/docker/docker-compose.development.yml"
PORT=8766
BUILD_PORT=8765

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
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Parse arguments
REBUILD=false
NO_CACHE=""
WATCH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --rebuild)
            REBUILD=true
            shift
            ;;
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Pre-flight checks
log_info "=== Development Deployment (v12.3.0+ Latest) - Pre-Flight Checks ==="
log_info ""

# Check Docker is available
if ! command -v docker &> /dev/null; then
    log_error "Docker not found. Please install Docker."
    exit 1
fi

log_success "Docker CLI available"

# Check docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose not found. Please install docker-compose."
    exit 1
fi

log_success "docker-compose available"

# Check we're in the right directory
if [ ! -f "$PROJECT_ROOT/$COMPOSE_FILE" ]; then
    log_error "Compose file not found: $PROJECT_ROOT/$COMPOSE_FILE"
    exit 1
fi

log_success "Compose file found: $COMPOSE_FILE"

# Check for uncommitted changes (warning only)
if ! git -C "$PROJECT_ROOT" diff-index --quiet HEAD 2>/dev/null; then
    log_warn "Uncommitted changes detected. Building from current state..."
fi

# Stop existing container (soft stop)
log_info ""
log_info "=== Preparing Environment ==="

if docker ps | grep -q "$CONTAINER_NAME"; then
    log_info "Stopping existing development container..."
    docker-compose -f "$PROJECT_ROOT/$COMPOSE_FILE" down || true
fi

# Create network if it doesn't exist
log_info "Ensuring development network exists..."
docker network create basset-hound-dev 2>/dev/null || true

log_success "Environment prepared"

# Build phase
log_info ""
log_info "=== Building Development Image ==="

if [ "$REBUILD" = true ]; then
    log_info "Rebuilding image from scratch (--no-cache enabled)..."
    BUILD_CMD="docker-compose -f $COMPOSE_FILE build --no-cache --pull"
else
    log_info "Building development image (incremental build)..."
    BUILD_CMD="docker-compose -f $COMPOSE_FILE build"
fi

cd "$PROJECT_ROOT"
if ! $BUILD_CMD; then
    log_error "Failed to build development image"
    exit 1
fi

log_success "Development image built successfully"

# Deployment phase
log_info ""
log_info "=== Starting Development Environment ==="

# Get git info for logging
GIT_BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_COMMIT=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")

log_info "Deploying from branch: $GIT_BRANCH (commit: $GIT_COMMIT)"

if ! docker-compose -f "$COMPOSE_FILE" up -d; then
    log_error "Failed to start development stack"
    exit 1
fi

log_success "Development stack started"

# Wait for container to be ready
log_info "Waiting for development container to be ready (30 seconds)..."
CONTAINER_READY=false

for i in {1..30}; do
    if docker exec "$CONTAINER_NAME" curl -sf "http://localhost:$BUILD_PORT/health" > /dev/null 2>&1; then
        log_success "Development container is ready!"
        CONTAINER_READY=true
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

if [ "$CONTAINER_READY" = false ]; then
    log_warn "Development container may still be starting (continuing anyway)"
    log_info "Check status with: docker logs $CONTAINER_NAME"
fi

# Verification
log_info ""
log_info "=== Deployment Verification ==="

# Check container is running
if docker ps | grep -q "$CONTAINER_NAME"; then
    log_success "Container is running"
else
    log_error "Container is not running"
    exit 1
fi

# Check WebSocket connectivity
if docker exec "$CONTAINER_NAME" curl -sf "http://localhost:$BUILD_PORT/health" > /dev/null 2>&1; then
    log_success "WebSocket health check passed"
else
    log_warn "WebSocket health check not yet passing (may take a moment)"
fi

# Summary
log_info ""
log_info "=== Development Deployment Complete ==="
log_success "Development environment ready (v12.3.0+ Latest)"
echo ""
echo "Development Details:"
echo "  Container: $CONTAINER_NAME"
echo "  Branch: $GIT_BRANCH"
echo "  Commit: $GIT_COMMIT"
echo "  WebSocket API: ws://localhost:$PORT"
echo "  Internal Port: $BUILD_PORT"
echo "  Health Check: http://localhost:$PORT/health"
echo "  Metrics: http://localhost:9091/metrics"
echo ""
echo "Manage Development:"
echo "  View logs: docker logs -f $CONTAINER_NAME"
echo "  View status: docker ps | grep $CONTAINER_NAME"
echo "  Stop: docker-compose -f $COMPOSE_FILE down"
echo "  Restart: docker-compose -f $COMPOSE_FILE restart"
echo "  Rebuild: ./scripts/deploy-development.sh --rebuild"
echo ""

# Watch mode (continuous logs)
if [ "$WATCH" = true ]; then
    log_info "Starting log watch (Ctrl+C to exit)..."
    docker logs -f "$CONTAINER_NAME"
fi

log_success "Deployment completed at $(date)"
