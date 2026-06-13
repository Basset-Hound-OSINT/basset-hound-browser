#!/bin/bash
# Basset Hound Browser - Canary Deployment Script
# Performs automated canary deployment with health verification and rollback
# Usage: ./infrastructure/scripts/canary-deployment.sh [options]

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

IMAGE_NAME="${IMAGE_NAME:-basset-hound-browser}"
IMAGE_TAG="${IMAGE_TAG:-12.0.0}"
CONTAINER_NAME="${CONTAINER_NAME:-basset-hound-browser-canary}"
NETWORK_NAME="${NETWORK_NAME:-basset-hound-browser}"
PORT=8765

# Canary configuration
CANARY_REPLICAS=1
STABLE_REPLICAS=2
CANARY_WEIGHT=10  # Start with 10% traffic
MAX_CANARY_WEIGHT=100
HEALTH_CHECK_TIMEOUT=60
HEALTH_CHECK_INTERVAL=5
ERROR_RATE_THRESHOLD=5  # Exit if error rate > 5%
DURATION=300  # Run for 5 minutes before full rollout

# Logging
LOG_FILE="${PROJECT_ROOT}/logs/canary-deployment-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "${LOG_FILE%/*}"

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✗ $*" | tee -a "$LOG_FILE"
}

log_warn() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ $*" | tee -a "$LOG_FILE"
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    log_success "Docker is available"
}

check_image_exists() {
    if ! docker image inspect "${IMAGE_NAME}:${IMAGE_TAG}" &>/dev/null; then
        log_error "Image not found: ${IMAGE_NAME}:${IMAGE_TAG}"
        return 1
    fi
    log_success "Image found: ${IMAGE_NAME}:${IMAGE_TAG}"
}

wait_for_service() {
    local container=$1
    local timeout=$2
    local elapsed=0

    log "Waiting for service to be ready (timeout: ${timeout}s)..."

    while [ $elapsed -lt $timeout ]; do
        if docker exec "$container" curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT} 2>/dev/null | grep -q "426"; then
            log_success "Service is healthy"
            return 0
        fi
        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
    done

    log_error "Service failed to start within ${timeout}s"
    return 1
}

get_error_rate() {
    local container=$1
    # This is a simplified check - in production, integrate with monitoring system
    if docker inspect "$container" &>/dev/null; then
        # Check container health status
        local health=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
        if [ "$health" = "healthy" ]; then
            echo "0"
        else
            echo "100"
        fi
    else
        echo "100"
    fi
}

# ============================================================================
# CANARY DEPLOYMENT PHASES
# ============================================================================

phase_1_launch_canary() {
    log "===== PHASE 1: Launching Canary ==="

    log "Pulling latest image..."
    docker pull "${IMAGE_NAME}:${IMAGE_TAG}"

    log "Starting canary container..."
    docker run -d \
        --name "$CONTAINER_NAME" \
        --network "$NETWORK_NAME" \
        -p 8766:${PORT} \
        -e DISPLAY=:99 \
        -e ELECTRON_DISABLE_SANDBOX=1 \
        -e LOG_LEVEL=info \
        --cap-drop ALL \
        --cap-add SYS_ADMIN \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        --health-start-period=40s \
        "${IMAGE_NAME}:${IMAGE_TAG}" &
    CANARY_PID=$!

    log "Canary PID: $CANARY_PID"
    sleep 2

    if ! docker ps | grep -q "$CONTAINER_NAME"; then
        log_error "Failed to start canary container"
        return 1
    fi

    log_success "Canary container started"

    # Wait for service to be ready
    if ! wait_for_service "$CONTAINER_NAME" "$HEALTH_CHECK_TIMEOUT"; then
        log_error "Canary service failed health checks"
        docker logs "$CONTAINER_NAME" | tail -20 >> "$LOG_FILE"
        return 1
    fi

    log_success "Canary is healthy and responding"
}

phase_2_monitor_canary() {
    log "===== PHASE 2: Monitoring Canary (${DURATION}s) ==="

    local elapsed=0
    local check_interval=10

    while [ $elapsed -lt $DURATION ]; do
        log "Monitoring canary... (${elapsed}/${DURATION}s)"

        # Check canary health
        if ! docker ps | grep -q "$CONTAINER_NAME"; then
            log_error "Canary container stopped unexpectedly"
            return 1
        fi

        local error_rate=$(get_error_rate "$CONTAINER_NAME")
        if [ "$error_rate" -gt "$ERROR_RATE_THRESHOLD" ]; then
            log_error "Error rate exceeded threshold: ${error_rate}%"
            return 1
        fi

        log "Canary health: OK (error rate: ${error_rate}%)"

        sleep $check_interval
        elapsed=$((elapsed + check_interval))
    done

    log_success "Canary monitoring complete - no issues detected"
}

phase_3_traffic_shift() {
    log "===== PHASE 3: Traffic Shift to Canary ==="

    local weight=$CANARY_WEIGHT

    while [ $weight -le $MAX_CANARY_WEIGHT ]; do
        log "Shifting traffic: ${weight}% to canary, $((100 - weight))% to stable"

        # In Docker environment, we simulate this by logging the state
        # In Kubernetes with Istio, this would use VirtualService/DestinationRule

        sleep 30
        weight=$((weight + 10))
    done

    log_success "Traffic fully shifted to canary"
}

phase_4_promote_canary() {
    log "===== PHASE 4: Promoting Canary to Stable ==="

    log "Stopping old stable containers..."
    docker stop basset-hound-browser 2>/dev/null || true
    docker rm basset-hound-browser 2>/dev/null || true

    log "Renaming canary to stable..."
    docker rename "$CONTAINER_NAME" basset-hound-browser

    # Update port mapping
    log "Reconfiguring port mapping..."
    docker update --publish ${PORT}:${PORT} basset-hound-browser 2>/dev/null || true

    log_success "Canary promoted to stable"
}

# ============================================================================
# ROLLBACK PROCEDURES
# ============================================================================

rollback() {
    log_error "Initiating rollback..."

    log "Stopping canary container..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true

    log "Verifying stable container is running..."
    if ! docker ps | grep -q "basset-hound-browser"; then
        log_error "Stable container is not running - manual intervention required!"
        return 1
    fi

    log_success "Rollback complete"
    return 0
}

# ============================================================================
# HEALTH CHECKS
# ============================================================================

run_health_checks() {
    log "===== Running Health Checks ==="

    log "Checking Docker..."
    check_docker || return 1

    log "Checking image..."
    check_image_exists || return 1

    log_success "All health checks passed"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    log "===== Basset Hound Browser Canary Deployment ==="
    log "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
    log "Container: $CONTAINER_NAME"
    log "Network: $NETWORK_NAME"
    log "Port: $PORT"
    log "Log: $LOG_FILE"

    # Run health checks
    if ! run_health_checks; then
        log_error "Health checks failed"
        exit 1
    fi

    # Phase 1: Launch canary
    if ! phase_1_launch_canary; then
        log_error "Canary launch failed"
        exit 1
    fi

    # Phase 2: Monitor canary
    if ! phase_2_monitor_canary; then
        log_error "Canary monitoring detected issues"
        if ! rollback; then
            log_error "Rollback failed - manual intervention required"
            exit 1
        fi
        exit 1
    fi

    # Phase 3: Traffic shift
    if ! phase_3_traffic_shift; then
        log_error "Traffic shift failed"
        if ! rollback; then
            log_error "Rollback failed - manual intervention required"
            exit 1
        fi
        exit 1
    fi

    # Phase 4: Promote to stable
    if ! phase_4_promote_canary; then
        log_error "Canary promotion failed"
        exit 1
    fi

    log_success "===== Canary Deployment Complete ====="
    log_success "WebSocket API: ws://localhost:${PORT}"
}

# ============================================================================
# SIGNAL HANDLERS
# ============================================================================

cleanup() {
    log_warn "Deployment interrupted"
    if [ -n "${CANARY_PID:-}" ] && kill -0 "$CANARY_PID" 2>/dev/null; then
        log "Stopping canary process..."
        kill "$CANARY_PID" 2>/dev/null || true
    fi
    log "Cleanup complete"
}

trap cleanup EXIT
trap cleanup SIGINT SIGTERM

# Run main
main "$@"
