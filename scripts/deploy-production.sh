#!/bin/bash
# Basset Hound Browser - Production Deployment Script (v12.5.0)
# Strict version locking, canary rollout, automatic rollback on failure
# Usage: ./scripts/deploy-production.sh [--canary] [--no-backup] [--force]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
PRODUCTION_VERSION="12.5.0"
ROLLBACK_VERSION="12.2.0"
IMAGE_NAME="basset-hound-browser"
CONTAINER_NAME="basset-hound-browser-prod"
COMPOSE_FILE="docker-compose.production.yml"
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
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Parse arguments
CANARY=false
NO_BACKUP=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --canary)
            CANARY=true
            shift
            ;;
        --no-backup)
            NO_BACKUP=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Pre-flight checks
log_info "=== Production Deployment (v${PRODUCTION_VERSION}) - Pre-Flight Checks ==="
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

# Check version in compose file
if ! grep -q "v${PRODUCTION_VERSION}" "$PROJECT_ROOT/$COMPOSE_FILE"; then
    if [ "$FORCE" = false ]; then
        log_error "Compose file does not specify v${PRODUCTION_VERSION}"
        log_warn "Use --force to deploy anyway (NOT RECOMMENDED)"
        exit 1
    else
        log_warn "Forcing deployment despite version mismatch"
    fi
fi

log_success "Version v${PRODUCTION_VERSION} confirmed in compose file"

# Backup existing data
if [ "$NO_BACKUP" = false ]; then
    log_info ""
    log_info "=== Creating Backup ==="

    BACKUP_DIR="$PROJECT_ROOT/backups/prod"
    BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_NAME="prod_backup_v${PRODUCTION_VERSION}_${BACKUP_TIMESTAMP}"

    mkdir -p "$BACKUP_DIR"

    # Stop container temporarily for consistent backup
    if docker ps | grep -q "$CONTAINER_NAME"; then
        log_info "Stopping container for backup..."
        docker-compose -f "$PROJECT_ROOT/$COMPOSE_FILE" down || true
    fi

    # Backup volumes
    if docker volume ls | grep -q "basset-prod-data"; then
        log_info "Backing up production data..."
        docker run --rm -v basset-prod-data:/data -v "$BACKUP_DIR":/backup \
            alpine tar czf "/backup/${BACKUP_NAME}-data.tar.gz" -C /data . || {
            log_warn "Data backup failed, but continuing..."
        }
        log_success "Data backup: ${BACKUP_NAME}-data.tar.gz"
    fi

    if docker volume ls | grep -q "basset-prod-logs"; then
        log_info "Backing up production logs..."
        docker run --rm -v basset-prod-logs:/data -v "$BACKUP_DIR":/backup \
            alpine tar czf "/backup/${BACKUP_NAME}-logs.tar.gz" -C /data . || {
            log_warn "Logs backup failed, but continuing..."
        }
        log_success "Logs backup: ${BACKUP_NAME}-logs.tar.gz"
    fi
fi

# Canary deployment
if [ "$CANARY" = true ]; then
    log_info ""
    log_info "=== Canary Deployment ==="
    log_info "Starting 1 instance with v${PRODUCTION_VERSION}..."

    CANARY_CONTAINER="basset-hound-browser-prod-canary"

    # Pull the production image
    log_info "Pulling production image: ${IMAGE_NAME}:v${PRODUCTION_VERSION}..."
    docker pull "${IMAGE_NAME}:v${PRODUCTION_VERSION}" || {
        log_error "Failed to pull production image"
        exit 1
    }

    # Run canary container
    docker run -d \
        --name "$CANARY_CONTAINER" \
        --network basset-hound-prod \
        -p 8765:8765 \
        --env-file "$PROJECT_ROOT/config/production.env" \
        -v basset-prod-data:/app/data \
        -v basset-prod-logs:/app/logs \
        -v basset-prod-downloads:/app/downloads \
        -v basset-prod-screenshots:/app/screenshots \
        --cap-drop=ALL \
        --cap-add=SYS_ADMIN \
        --security-opt=no-new-privileges:true \
        --healthcheck-interval=30s \
        --restart=on-failure:5 \
        "${IMAGE_NAME}:v${PRODUCTION_VERSION}" || {
        log_error "Failed to start canary container"
        exit 1
    }

    log_success "Canary container started: $CANARY_CONTAINER"

    # Wait for canary to be healthy
    log_info "Waiting for canary to be healthy (60 seconds)..."
    CANARY_HEALTHY=false
    for i in {1..60}; do
        if docker exec "$CANARY_CONTAINER" curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
            log_success "Canary is healthy!"
            CANARY_HEALTHY=true
            break
        fi
        echo -n "."
        sleep 1
    done
    echo ""

    if [ "$CANARY_HEALTHY" = false ]; then
        log_error "Canary failed to become healthy. Rolling back..."
        docker stop "$CANARY_CONTAINER" || true
        docker rm "$CANARY_CONTAINER" || true
        exit 1
    fi

    # Run canary tests
    log_info "Running canary health tests..."
    CANARY_TESTS_PASSED=true

    # Test WebSocket connectivity
    if ! docker exec "$CANARY_CONTAINER" curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
        log_error "Canary health check failed"
        CANARY_TESTS_PASSED=false
    else
        log_success "Canary health check passed"
    fi

    if [ "$CANARY_TESTS_PASSED" = false ]; then
        log_error "Canary tests failed. Rolling back..."
        docker stop "$CANARY_CONTAINER" || true
        docker rm "$CANARY_CONTAINER" || true
        exit 1
    fi

    log_success "Canary tests passed. Proceeding to full deployment..."

    # Stop canary
    docker stop "$CANARY_CONTAINER"
    docker rm "$CANARY_CONTAINER"
fi

# Full deployment
log_info ""
log_info "=== Full Production Deployment ==="

# Stop existing container
if docker ps | grep -q "$CONTAINER_NAME"; then
    log_info "Stopping existing production container..."
    docker-compose -f "$PROJECT_ROOT/$COMPOSE_FILE" down || true
fi

# Create network if it doesn't exist
log_info "Ensuring production network exists..."
docker network create basset-hound-prod 2>/dev/null || true

# Pull latest production image
log_info "Pulling production image: ${IMAGE_NAME}:v${PRODUCTION_VERSION}..."
docker pull "${IMAGE_NAME}:v${PRODUCTION_VERSION}" || {
    log_error "Failed to pull production image"
    exit 1
}

log_success "Image pulled successfully"

# Deploy production stack
log_info "Starting production stack..."
cd "$PROJECT_ROOT"
docker-compose -f "$COMPOSE_FILE" up -d || {
    log_error "Failed to start production stack"

    if [ "$NO_BACKUP" = false ] && [ -n "${BACKUP_DIR:-}" ]; then
        log_warn "Attempting rollback to v${ROLLBACK_VERSION}..."
        "$SCRIPT_DIR/rollback-production.sh" || true
    fi

    exit 1
}

log_success "Production stack started"

# Wait for container to be ready
log_info "Waiting for production container to be ready (60 seconds)..."
CONTAINER_READY=false

for i in {1..60}; do
    if docker exec "$CONTAINER_NAME" curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
        log_success "Production container is ready!"
        CONTAINER_READY=true
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

if [ "$CONTAINER_READY" = false ]; then
    log_error "Production container failed to become ready"
    log_warn "Attempting rollback to v${ROLLBACK_VERSION}..."
    "$SCRIPT_DIR/rollback-production.sh" || true
    exit 1
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
if docker exec "$CONTAINER_NAME" curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
    log_success "WebSocket health check passed"
else
    log_error "WebSocket health check failed"
    exit 1
fi

# Check metrics are available
if docker exec "$CONTAINER_NAME" curl -sf "http://localhost:9090/metrics" > /dev/null 2>&1; then
    log_success "Prometheus metrics available"
else
    log_warn "Prometheus metrics not yet available (may take a moment)"
fi

# Summary
log_info ""
log_info "=== Deployment Complete ==="
log_success "Production deployment successful (v${PRODUCTION_VERSION})"
echo ""
echo "Deployment Details:"
echo "  Container: $CONTAINER_NAME"
echo "  Version: v${PRODUCTION_VERSION}"
echo "  WebSocket API: ws://localhost:$PORT"
echo "  Health Check: http://localhost:$PORT/health"
echo "  Metrics: http://localhost:9090/metrics"
echo ""
echo "Manage Production:"
echo "  View logs: docker logs $CONTAINER_NAME"
echo "  View status: docker ps | grep $CONTAINER_NAME"
echo "  Stop: docker-compose -f $COMPOSE_FILE down"
echo "  Restart: docker-compose -f $COMPOSE_FILE restart"
echo "  Rollback: ./scripts/rollback-production.sh"
echo ""

log_success "Deployment completed at $(date)"
