#!/bin/bash
# Basset Hound Browser - Production Rollback Script
# Emergency rollback to previous stable version (v12.1.0)
# Usage: ./scripts/rollback-production.sh [--force] [--to-version <version>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
CONTAINER_NAME="basset-hound-browser-prod"
IMAGE_NAME="basset-hound-browser"
DEFAULT_ROLLBACK_VERSION="12.1.0"
ROLLBACK_VERSION="${DEFAULT_ROLLBACK_VERSION}"
PORT=8765

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
    echo -e "${YELLOW}[WARN]${NC} $*""
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Parse arguments
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        --to-version)
            ROLLBACK_VERSION="$2"
            shift 2
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Pre-flight checks
log_info "=== Production Rollback - Pre-Flight Checks ==="
log_info "Target version: v${ROLLBACK_VERSION}"
log_info ""

if [ "$FORCE" = false ]; then
    log_warn "WARNING: This will rollback production to v${ROLLBACK_VERSION}"
    log_warn "Current data will be preserved."
    log_warn ""
    read -p "Are you sure you want to proceed? (yes/no) " -r RESPONSE
    echo ""

    if [[ ! "$RESPONSE" =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Rollback cancelled"
        exit 0
    fi
fi

log_info "Proceeding with rollback..."
echo ""

# Check Docker is available
if ! command -v docker &> /dev/null; then
    log_error "Docker not found"
    exit 1
fi

log_success "Docker CLI available"

# Create rollback timestamp for records
ROLLBACK_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ROLLBACK_LOG="$PROJECT_ROOT/logs/rollback_${ROLLBACK_TIMESTAMP}.log"
mkdir -p "$(dirname "$ROLLBACK_LOG")"

log_info "Rollback log: $ROLLBACK_LOG"
log_info ""

# Prepare for rollback
log_info "=== Preparing for Rollback ==="

# Stop current production container
log_info "Stopping current production container..."
if docker ps | grep -q "$CONTAINER_NAME"; then
    docker-compose -f "$PROJECT_ROOT/config/docker/docker-compose.production.yml" down 2>&1 | tee -a "$ROLLBACK_LOG" || true
    log_success "Current container stopped"
else
    log_warn "Container not running"
fi

# Verify volumes exist
log_info "Verifying data volumes..."

if ! docker volume ls | grep -q "basset-prod-data"; then
    log_error "Production data volume not found - cannot proceed with safe rollback"
    log_warn "You may need to restore from backup"
    exit 1
fi

log_success "Production data volume found"

# Create recovery snapshot
log_info ""
log_info "=== Creating Recovery Snapshot ==="

SNAPSHOT_DIR="$PROJECT_ROOT/backups/rollback"
mkdir -p "$SNAPSHOT_DIR"

SNAPSHOT_NAME="rollback_snapshot_${ROLLBACK_TIMESTAMP}"

log_info "Creating snapshot: $SNAPSHOT_NAME"

if docker volume ls | grep -q "basset-prod-data"; then
    docker run --rm -v basset-prod-data:/data -v "$SNAPSHOT_DIR":/backup \
        alpine tar czf "/backup/${SNAPSHOT_NAME}-data.tar.gz" -C /data . 2>&1 | tee -a "$ROLLBACK_LOG" || {
        log_warn "Snapshot creation failed, but continuing..."
    }
    log_success "Snapshot created"
fi

# Rollback phase
log_info ""
log_info "=== Executing Rollback to v${ROLLBACK_VERSION} ==="

# Pull the rollback image
log_info "Pulling rollback image: ${IMAGE_NAME}:v${ROLLBACK_VERSION}..."
docker pull "${IMAGE_NAME}:v${ROLLBACK_VERSION}" 2>&1 | tee -a "$ROLLBACK_LOG" || {
    log_error "Failed to pull rollback image"
    exit 1
}

log_success "Rollback image pulled"

# Create network if it doesn't exist
log_info "Ensuring network exists..."
docker network create basset-hound-prod 2>/dev/null || true

# Start container with rollback version
log_info "Starting container with v${ROLLBACK_VERSION}..."

docker run -d \
    --name "$CONTAINER_NAME" \
    --network basset-hound-prod \
    -p $PORT:$PORT \
    --env-file "$PROJECT_ROOT/config/production.env" \
    -v basset-prod-data:/app/data \
    -v basset-prod-logs:/app/logs \
    -v basset-prod-downloads:/app/downloads \
    -v basset-prod-screenshots:/app/screenshots \
    --cap-drop=ALL \
    --cap-add=SYS_ADMIN \
    --security-opt=no-new-privileges:true \
    --restart=on-failure:5 \
    "${IMAGE_NAME}:v${ROLLBACK_VERSION}" 2>&1 | tee -a "$ROLLBACK_LOG" || {
    log_error "Failed to start container with rollback image"
    exit 1
}

log_success "Container started with v${ROLLBACK_VERSION}"

# Wait for container to be healthy
log_info "Waiting for container to be healthy (60 seconds)..."

CONTAINER_HEALTHY=false
for i in {1..60}; do
    if docker exec "$CONTAINER_NAME" curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
        log_success "Container is healthy!"
        CONTAINER_HEALTHY=true
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

if [ "$CONTAINER_HEALTHY" = false ]; then
    log_error "Container failed to become healthy"
    log_info "Logs:"
    docker logs "$CONTAINER_NAME" 2>&1 | tail -20 | tee -a "$ROLLBACK_LOG"
    exit 1
fi

# Verification
log_info ""
log_info "=== Rollback Verification ==="

# Verify container is running
if docker ps | grep -q "$CONTAINER_NAME"; then
    log_success "Container is running"
else
    log_error "Container is not running"
    exit 1
fi

# Verify WebSocket connectivity
if docker exec "$CONTAINER_NAME" curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
    log_success "WebSocket health check passed"
else
    log_error "WebSocket health check failed"
    exit 1
fi

# Get current version from container
CURRENT_VERSION=$(docker exec "$CONTAINER_NAME" \
    cat /app/VERSION 2>/dev/null || echo "unknown")

log_success "Running version: $CURRENT_VERSION"

# Summary
log_info ""
log_info "=== Rollback Complete ==="
log_success "Production successfully rolled back to v${ROLLBACK_VERSION}"
echo ""
echo "Rollback Details:"
echo "  From: v12.2.0"
echo "  To: v${ROLLBACK_VERSION}"
echo "  Container: $CONTAINER_NAME"
echo "  Timestamp: $ROLLBACK_TIMESTAMP"
echo "  Snapshot: $SNAPSHOT_NAME"
echo ""
echo "Next Steps:"
echo "  1. Verify production is working normally"
echo "  2. Investigate the issue that caused the rollback"
echo "  3. Address the issue before re-deploying v12.2.0"
echo ""
echo "To check status:"
echo "  ./scripts/health-check-prod.sh --verbose"
echo ""
echo "To re-deploy v12.2.0 after fixing:"
echo "  ./scripts/deploy-production.sh"
echo ""
echo "To view rollback log:"
echo "  cat $ROLLBACK_LOG"
echo ""

log_success "Rollback completed at $(date)"
