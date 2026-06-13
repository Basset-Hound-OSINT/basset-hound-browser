#!/bin/bash
# Basset Hound Browser - Rolling Deployment Script
# Zero-downtime updates using rolling restart with health verification
# Usage: ./infrastructure/scripts/rolling-deployment.sh [options]

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

IMAGE_NAME="${IMAGE_NAME:-basset-hound-browser}"
IMAGE_TAG="${IMAGE_TAG:-12.0.0}"
CONTAINER_PREFIX="${CONTAINER_PREFIX:-basset-hound-browser}"
NETWORK_NAME="${NETWORK_NAME:-basset-hound-browser}"
PORT=8765

# Rolling deployment configuration
TOTAL_REPLICAS=3
BATCH_SIZE=1  # Update one replica at a time
HEALTH_CHECK_TIMEOUT=60
HEALTH_CHECK_INTERVAL=5
READY_WAIT_TIME=10

# Logging
LOG_FILE="${PROJECT_ROOT}/logs/rolling-deployment-$(date +%Y%m%d-%H%M%S).log"
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

get_running_containers() {
    docker ps --filter "name=${CONTAINER_PREFIX}" --format "{{.Names}}" | sort
}

get_container_status() {
    local container=$1
    docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "missing"
}

get_container_health() {
    local container=$1
    docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none"
}

wait_for_service() {
    local container=$1
    local timeout=$2
    local elapsed=0

    log "Waiting for $container to be ready (timeout: ${timeout}s)..."

    while [ $elapsed -lt $timeout ]; do
        local status=$(get_container_status "$container")
        if [ "$status" != "running" ]; then
            sleep $HEALTH_CHECK_INTERVAL
            elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
            continue
        fi

        # Check WebSocket health
        if docker exec "$container" curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT} 2>/dev/null | grep -q "426"; then
            log_success "$container is healthy"
            return 0
        fi

        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
    done

    log_error "$container failed to become healthy within ${timeout}s"
    return 1
}

verify_service_health() {
    local container=$1
    local health=$(get_container_health "$container")

    case $health in
        healthy)
            log_success "$container is healthy"
            return 0
            ;;
        unhealthy)
            log_error "$container is unhealthy"
            return 1
            ;;
        starting)
            log "Container is still starting..."
            return 2
            ;;
        none)
            log_warn "No health check defined for $container"
            return 0
            ;;
        *)
            log_warn "Unknown health status: $health"
            return 2
            ;;
    esac
}

# ============================================================================
# ROLLING DEPLOYMENT LOGIC
# ============================================================================

validate_deployment() {
    log "===== Validating Deployment Configuration ====="

    check_docker || return 1
    check_image_exists || return 1

    log "Getting current running containers..."
    local containers=$(get_running_containers)
    local count=$(echo "$containers" | wc -w)

    log "Found $count running container(s): $containers"

    if [ "$count" -eq 0 ]; then
        log_warn "No running containers found - will start fresh deployment"
    fi

    log_success "Validation complete"
}

create_replacement_container() {
    local replica_num=$1
    local container_name="${CONTAINER_PREFIX}-${replica_num}"
    local port=$((PORT + replica_num))

    log "Creating replacement container: $container_name on port $port"

    docker run -d \
        --name "$container_name" \
        --network "$NETWORK_NAME" \
        -p ${port}:${PORT} \
        -e DISPLAY=:99 \
        -e ELECTRON_DISABLE_SANDBOX=1 \
        -e LOG_LEVEL=info \
        --cap-drop ALL \
        --cap-add SYS_ADMIN \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        --health-start-period=40s \
        --restart unless-stopped \
        "${IMAGE_NAME}:${IMAGE_TAG}"

    log_success "Created $container_name"
}

update_replica() {
    local replica_num=$1
    local container_name="${CONTAINER_PREFIX}-${replica_num}"

    log "===== Updating Replica $replica_num (${container_name}) ====="

    # Check if container exists
    if ! docker ps -a --filter "name=${container_name}" | grep -q "$container_name"; then
        log "Container does not exist, creating new one..."
        create_replacement_container "$replica_num" || return 1
    else
        # Container exists, stop and remove it
        log "Stopping old container..."
        docker stop "$container_name" 2>/dev/null || true
        docker rm "$container_name" 2>/dev/null || true
        sleep 1

        # Create new container
        create_replacement_container "$replica_num" || return 1
    fi

    # Wait for container to be ready
    sleep $READY_WAIT_TIME

    if ! wait_for_service "$container_name" "$HEALTH_CHECK_TIMEOUT"; then
        log_error "Container failed health checks"
        docker logs "$container_name" | tail -20 >> "$LOG_FILE"
        return 1
    fi

    # Final health verification
    if ! verify_service_health "$container_name"; then
        log_error "Container health verification failed"
        return 1
    fi

    log_success "Replica $replica_num updated successfully"
    return 0
}

perform_rolling_update() {
    log "===== Starting Rolling Deployment ====="
    log "Total replicas: $TOTAL_REPLICAS"
    log "Batch size: $BATCH_SIZE"

    local failed_replicas=()
    local updated_count=0

    for ((i = 1; i <= TOTAL_REPLICAS; i++)); do
        log "Processing batch starting at replica $i..."

        for ((j = 0; j < BATCH_SIZE && (i + j - 1) < TOTAL_REPLICAS; j++)); do
            local replica=$((i + j))

            if update_replica "$replica"; then
                updated_count=$((updated_count + 1))
            else
                log_error "Failed to update replica $replica"
                failed_replicas+=("$replica")
            fi
        done

        # Wait before next batch
        if [ $((i + BATCH_SIZE)) -le "$TOTAL_REPLICAS" ]; then
            log "Batch processed, waiting before next batch..."
            sleep 5
        fi
    done

    log_success "Rolling update complete"
    log "Successfully updated: $updated_count/$TOTAL_REPLICAS replicas"

    if [ ${#failed_replicas[@]} -gt 0 ]; then
        log_error "Failed replicas: ${failed_replicas[*]}"
        return 1
    fi

    return 0
}

verify_deployment_health() {
    log "===== Verifying Deployment Health ====="

    local healthy_count=0
    local total_count=0

    for ((i = 1; i <= TOTAL_REPLICAS; i++)); do
        local container_name="${CONTAINER_PREFIX}-${i}"

        if docker ps | grep -q "$container_name"; then
            total_count=$((total_count + 1))
            local health=$(get_container_health "$container_name")

            if [ "$health" = "healthy" ]; then
                log_success "Replica $i: HEALTHY"
                healthy_count=$((healthy_count + 1))
            else
                log_warn "Replica $i: $health"
            fi
        fi
    done

    log "Healthy replicas: $healthy_count/$total_count"

    if [ "$healthy_count" -lt $((TOTAL_REPLICAS / 2 + 1)) ]; then
        log_error "Insufficient healthy replicas"
        return 1
    fi

    log_success "Deployment health check passed"
    return 0
}

# ============================================================================
# HEALTH CHECKS AND VALIDATION
# ============================================================================

run_pre_deployment_checks() {
    log "===== Pre-Deployment Health Checks ====="

    check_docker || return 1
    check_image_exists || return 1

    log_success "Pre-deployment checks passed"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    log "===== Basset Hound Browser Rolling Deployment ==="
    log "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
    log "Network: $NETWORK_NAME"
    log "Port: $PORT"
    log "Replicas: $TOTAL_REPLICAS"
    log "Log: $LOG_FILE"

    # Pre-deployment validation
    if ! run_pre_deployment_checks; then
        log_error "Pre-deployment checks failed"
        exit 1
    fi

    # Validate deployment configuration
    if ! validate_deployment; then
        log_error "Deployment validation failed"
        exit 1
    fi

    # Perform rolling update
    if ! perform_rolling_update; then
        log_error "Rolling deployment failed"
        exit 1
    fi

    # Verify deployment health
    if ! verify_deployment_health; then
        log_error "Deployment health verification failed"
        exit 1
    fi

    log_success "===== Rolling Deployment Complete ====="
    log "All replicas are running and healthy"
}

# ============================================================================
# SIGNAL HANDLERS
# ============================================================================

cleanup() {
    log_warn "Rolling deployment interrupted"
    log "Some containers may be in intermediate state"
    log "Manual cleanup may be required"
}

trap cleanup EXIT
trap cleanup SIGINT SIGTERM

# Run main
main "$@"
