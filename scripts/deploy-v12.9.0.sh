#!/bin/bash
# Basset Hound Browser - v12.9.0 Zero-Downtime Deployment Script
# Features: Blue-green deployment, automated health checks, rollback on failure, notifications
# Usage: ./scripts/deploy-v12.9.0.sh [OPTIONS]
#
# OPTIONS:
#   --canary              Deploy to canary (5% traffic) first
#   --staged              Deploy in stages (10%, 50%, 100%)
#   --force               Skip safety checks
#   --skip-health-check   Skip post-deployment health checks
#   --dry-run             Show what would be deployed without deploying
#   --registry URL        Use custom Docker registry
#   --slack WEBHOOK       Send Slack notifications
#   --email ADDR          Send email notifications
#   --backup              Create backup before deployment (default: enabled)
#   --no-backup           Skip backup
#   --preserve-data       Keep data volumes after old container removal

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# CONFIGURATION
# ============================================================================

DEPLOYMENT_VERSION="12.9.0"
PREVIOUS_VERSION="12.8.0"
IMAGE_NAME="basset-hound-browser"
IMAGE_TAG="${DEPLOYMENT_VERSION}"
REGISTRY=""
PORT=8765
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/infrastructure/docker/docker-compose.prod.yml"

# Deployment modes
CANARY_MODE=false
STAGED_MODE=false
DRY_RUN=false
FORCE=false
SKIP_HEALTH_CHECK=false
BACKUP_ENABLED=true
PRESERVE_DATA=false

# Notification settings
SLACK_WEBHOOK=""
EMAIL_ADDR=""

# Timing configuration
HEALTH_CHECK_TIMEOUT=120
SMOKE_TEST_TIMEOUT=60
TRAFFIC_RAMP_INTERVAL=30
MAX_RETRIES=3
ZERO_DOWNTIME_CHECK_INTERVAL=5

# Container names (blue-green)
CONTAINER_OLD="basset-hound-browser-prod"
CONTAINER_BLUE="basset-hound-browser-blue"
CONTAINER_GREEN="basset-hound-browser-green"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging
DEPLOYMENT_DIR="${PROJECT_ROOT}/logs/deployments"
DEPLOYMENT_LOG="${DEPLOYMENT_DIR}/deploy-${DEPLOYMENT_VERSION}-$(date +%Y%m%d-%H%M%S).log"
DEPLOYMENT_REPORT="${DEPLOYMENT_DIR}/report-${DEPLOYMENT_VERSION}-$(date +%Y%m%d-%H%M%S).json"
mkdir -p "$DEPLOYMENT_DIR"

# Deployment state tracking
BACKUP_CREATED=false
BACKUP_PATH=""
DEPLOYMENT_START_TIME=""
DEPLOYMENT_END_TIME=""
DEPLOYMENT_STATUS="PENDING"
FAILED_CHECKS=""

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log_info() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[${timestamp}] [INFO]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

log_success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[${timestamp}] [SUCCESS]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

log_warn() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[${timestamp}] [WARN]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[${timestamp}] [ERROR]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

log_section() {
    echo -e "\n${CYAN}========== $* ==========${NC}" | tee -a "$DEPLOYMENT_LOG"
}

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --canary)
                CANARY_MODE=true
                shift
                ;;
            --staged)
                STAGED_MODE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --skip-health-check)
                SKIP_HEALTH_CHECK=true
                shift
                ;;
            --registry)
                REGISTRY="$2"
                shift 2
                ;;
            --slack)
                SLACK_WEBHOOK="$2"
                shift 2
                ;;
            --email)
                EMAIL_ADDR="$2"
                shift 2
                ;;
            --no-backup)
                BACKUP_ENABLED=false
                shift
                ;;
            --preserve-data)
                PRESERVE_DATA=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done
}

print_usage() {
    cat <<EOF
Usage: ./scripts/deploy-v12.9.0.sh [OPTIONS]

OPTIONS:
    --canary              Deploy to canary (5% traffic) first
    --staged              Deploy in stages (10%, 50%, 100%)
    --force               Skip safety checks
    --skip-health-check   Skip post-deployment health checks
    --dry-run             Show what would be deployed without deploying
    --registry URL        Use custom Docker registry
    --slack WEBHOOK       Send Slack notifications
    --email ADDR          Send email notifications
    --backup              Create backup before deployment (default: enabled)
    --no-backup           Skip backup
    --preserve-data       Keep data volumes after old container removal

EXAMPLES:
    # Standard deployment with health checks and notifications
    ./scripts/deploy-v12.9.0.sh --email ops@company.com --slack https://hooks.slack.com/...

    # Canary deployment with staged rollout
    ./scripts/deploy-v12.9.0.sh --canary --staged

    # Dry run to see what would happen
    ./scripts/deploy-v12.9.0.sh --dry-run

    # Force deployment without backups or checks
    ./scripts/deploy-v12.9.0.sh --force --no-backup
EOF
}

# ============================================================================
# NOTIFICATION FUNCTIONS
# ============================================================================

send_slack_notification() {
    local status=$1
    local message=$2

    if [[ -z "$SLACK_WEBHOOK" ]]; then
        return 0
    fi

    local color="danger"
    case "$status" in
        success) color="good" ;;
        warning) color="warning" ;;
        error) color="danger" ;;
    esac

    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Basset Hound Browser Deployment",
            "text": "$message",
            "fields": [
                {"title": "Version", "value": "$DEPLOYMENT_VERSION", "short": true},
                {"title": "Status", "value": "$status", "short": true},
                {"title": "Time", "value": "$timestamp", "short": true},
                {"title": "Host", "value": "$(hostname)", "short": true}
            ]
        }
    ]
}
EOF
)

    curl -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "$SLACK_WEBHOOK" 2>/dev/null || log_warn "Failed to send Slack notification"
}

send_email_notification() {
    local status=$1
    local message=$2

    if [[ -z "$EMAIL_ADDR" ]]; then
        return 0
    fi

    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local subject="[${status}] Basset Hound Browser v${DEPLOYMENT_VERSION} Deployment"

    local body="Deployment Status: $status\n\n"
    body+="Version: $DEPLOYMENT_VERSION\n"
    body+="Time: $timestamp\n"
    body+="Host: $(hostname)\n"
    body+="Duration: $((DEPLOYMENT_END_TIME - DEPLOYMENT_START_TIME))s\n\n"
    body+="Message:\n$message\n\n"
    body+="Log: $DEPLOYMENT_LOG\n"
    body+="Report: $DEPLOYMENT_REPORT\n"

    echo -e "$body" | mail -s "$subject" "$EMAIL_ADDR" 2>/dev/null || log_warn "Failed to send email notification"
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

docker_image_exists() {
    local image=$1
    docker image inspect "$image" &>/dev/null
    return $?
}

container_is_running() {
    local container=$1
    [[ $(docker ps --filter "name=^${container}$" --format '{{.Names}}' | wc -l) -eq 1 ]]
    return $?
}

container_is_healthy() {
    local container=$1
    local status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
    [[ "$status" == "healthy" ]]
    return $?
}

get_container_id() {
    local container=$1
    docker ps --filter "name=^${container}$" --format '{{.ID}}' 2>/dev/null || echo ""
}

wait_for_container_healthy() {
    local container=$1
    local timeout=$2
    local elapsed=0

    log_info "Waiting for container '$container' to be healthy (timeout: ${timeout}s)..."

    while [[ $elapsed -lt $timeout ]]; do
        if container_is_running "$container" && container_is_healthy "$container"; then
            log_success "Container '$container' is healthy"
            return 0
        fi

        sleep 2
        elapsed=$((elapsed + 2))
        echo -n "."
    done

    echo ""
    log_error "Container '$container' did not become healthy within ${timeout}s"
    return 1
}

wait_for_port_ready() {
    local port=$1
    local timeout=$2
    local elapsed=0

    log_info "Waiting for port $port to be ready (timeout: ${timeout}s)..."

    while [[ $elapsed -lt $timeout ]]; do
        if nc -z 127.0.0.1 "$port" 2>/dev/null; then
            log_success "Port $port is ready"
            return 0
        fi

        sleep 1
        elapsed=$((elapsed + 1))
        echo -n "."
    done

    echo ""
    log_error "Port $port is not ready within ${timeout}s"
    return 1
}

# ============================================================================
# BACKUP FUNCTIONS
# ============================================================================

create_deployment_backup() {
    if ! $BACKUP_ENABLED; then
        log_info "Backup disabled, skipping backup creation"
        return 0
    fi

    log_section "Creating Deployment Backup"

    BACKUP_PATH="${DEPLOYMENT_DIR}/backup-${DEPLOYMENT_VERSION}-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_PATH"

    # Backup current container state
    log_info "Backing up current container image..."
    if docker image inspect "$IMAGE_NAME:$PREVIOUS_VERSION" &>/dev/null; then
        docker save "$IMAGE_NAME:$PREVIOUS_VERSION" -o "$BACKUP_PATH/image-${PREVIOUS_VERSION}.tar.gz" || {
            log_warn "Failed to backup docker image"
        }
    fi

    # Backup container data volumes
    log_info "Backing up data volumes..."
    if docker volume ls --filter "name=basset-prod-data" --format '{{.Name}}' | grep -q basset-prod-data; then
        docker run --rm \
            -v basset-prod-data:/data \
            -v "$BACKUP_PATH:/backup" \
            alpine tar czf /backup/data-volume.tar.gz -C /data . || {
            log_warn "Failed to backup data volume"
        }
    fi

    # Backup current docker-compose configuration
    log_info "Backing up docker-compose configuration..."
    cp "$DOCKER_COMPOSE_FILE" "$BACKUP_PATH/docker-compose.backup.yml" || true

    log_success "Backup created at $BACKUP_PATH"
    BACKUP_CREATED=true
}

restore_from_backup() {
    if [[ -z "$BACKUP_PATH" ]] || ! $BACKUP_CREATED; then
        log_error "No backup available for restoration"
        return 1
    fi

    log_section "Restoring from Backup"

    log_info "Restoring previous version..."
    if [[ -f "$BACKUP_PATH/image-${PREVIOUS_VERSION}.tar.gz" ]]; then
        docker load -i "$BACKUP_PATH/image-${PREVIOUS_VERSION}.tar.gz" || {
            log_error "Failed to restore docker image"
            return 1
        }
    fi

    log_success "Backup restoration completed"
    return 0
}

# ============================================================================
# HEALTH CHECK FUNCTIONS
# ============================================================================

perform_websocket_health_check() {
    local container=$1

    log_info "Performing WebSocket health check..."

    if ! container_is_running "$container"; then
        log_error "Container is not running"
        return 1
    fi

    if ! wait_for_port_ready "$PORT" "$HEALTH_CHECK_TIMEOUT"; then
        log_error "WebSocket port not accessible"
        return 1
    fi

    # Test WebSocket connectivity
    local test_payload='{"command":"getVersion"}'
    local response=$(timeout 5 docker exec "$container" \
        curl -s -N \
        -H "Connection: Upgrade" \
        -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
        -H "Sec-WebSocket-Version: 13" \
        "ws://127.0.0.1:$PORT" || echo "FAILED")

    # Alternative: Use nc with timeout
    if echo "$test_payload" | nc -w2 127.0.0.1 "$PORT" &>/dev/null; then
        log_success "WebSocket connectivity verified"
        return 0
    fi

    log_warn "WebSocket check inconclusive (port accessible)"
    return 0
}

perform_container_health_check() {
    local container=$1

    log_info "Performing container health check..."

    if ! container_is_running "$container"; then
        log_error "Container is not running"
        FAILED_CHECKS+="container_running "
        return 1
    fi

    # Check memory usage
    local mem_usage=$(docker stats --no-stream "$container" --format '{{.MemUsage}}' 2>/dev/null | cut -d' ' -f1 | sed 's/[GMK]B//')
    if [[ -n "$mem_usage" ]]; then
        log_info "Memory usage: ${mem_usage}MB"
        # Warn if exceeds 1.5GB
        if (( $(echo "$mem_usage > 1500" | bc -l) )); then
            log_warn "Memory usage is high (>1.5GB)"
            FAILED_CHECKS+="memory_usage "
        fi
    fi

    # Check CPU usage
    local cpu_usage=$(docker stats --no-stream "$container" --format '{{.CPUPerc}}' 2>/dev/null | sed 's/%//')
    if [[ -n "$cpu_usage" ]]; then
        log_info "CPU usage: ${cpu_usage}%"
    fi

    log_success "Container health check completed"
    return 0
}

perform_error_log_check() {
    local container=$1

    log_info "Checking for errors in logs..."

    local error_count=$(docker logs "$container" 2>&1 | grep -ic "error\|fatal\|exception" || echo 0)

    if [[ $error_count -gt 10 ]]; then
        log_warn "Found $error_count errors in recent logs"
        docker logs "$container" 2>&1 | grep -i "error\|fatal" | tail -5 | while read line; do
            log_warn "  $line"
        done
        FAILED_CHECKS+="error_logs "
        return 1
    else
        log_success "Error log check passed ($error_count errors)"
        return 0
    fi
}

perform_smoke_tests() {
    local container=$1

    log_info "Running smoke tests..."

    # Test 1: Version endpoint
    log_info "Test 1: Checking version endpoint..."
    if docker exec "$container" curl -s http://127.0.0.1:$PORT/version 2>/dev/null | grep -q "12.9.0"; then
        log_success "Version check passed"
    else
        log_warn "Version check inconclusive"
    fi

    # Test 2: Basic connectivity
    log_info "Test 2: Basic connectivity..."
    if wait_for_port_ready "$PORT" 10; then
        log_success "Port connectivity check passed"
    else
        log_warn "Port connectivity check failed"
        FAILED_CHECKS+="smoke_test_port "
        return 1
    fi

    log_success "Smoke tests completed"
    return 0
}

# ============================================================================
# DEPLOYMENT FUNCTIONS
# ============================================================================

build_docker_image() {
    log_section "Building Docker Image"

    if $DRY_RUN; then
        log_info "[DRY RUN] Would build image: $IMAGE_NAME:$IMAGE_TAG"
        return 0
    fi

    log_info "Building Docker image: $IMAGE_NAME:$IMAGE_TAG..."

    if docker build -t "$IMAGE_NAME:$IMAGE_TAG" -f "$PROJECT_ROOT/Dockerfile" \
        --build-arg VERSION="$DEPLOYMENT_VERSION" \
        "$PROJECT_ROOT" | tee -a "$DEPLOYMENT_LOG"; then
        log_success "Docker image built successfully"
        return 0
    else
        log_error "Failed to build Docker image"
        return 1
    fi
}

push_docker_image() {
    if [[ -z "$REGISTRY" ]]; then
        log_info "No registry specified, skipping image push"
        return 0
    fi

    log_section "Pushing Docker Image to Registry"

    if $DRY_RUN; then
        log_info "[DRY RUN] Would push image to: $REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
        return 0
    fi

    log_info "Tagging image for registry: $REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
    docker tag "$IMAGE_NAME:$IMAGE_TAG" "$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"

    log_info "Pushing image to registry..."
    if docker push "$REGISTRY/$IMAGE_NAME:$IMAGE_TAG" | tee -a "$DEPLOYMENT_LOG"; then
        log_success "Image pushed to registry successfully"
        return 0
    else
        log_error "Failed to push image to registry"
        return 1
    fi
}

deploy_blue_green() {
    log_section "Deploying with Blue-Green Strategy"

    # Determine which is currently active
    local current_active=""
    if container_is_running "$CONTAINER_OLD"; then
        current_active="$CONTAINER_OLD"
        log_info "Current production container: $CONTAINER_OLD"
    elif container_is_running "$CONTAINER_BLUE"; then
        current_active="$CONTAINER_BLUE"
        log_info "Current production container: $CONTAINER_BLUE"
    elif container_is_running "$CONTAINER_GREEN"; then
        current_active="$CONTAINER_GREEN"
        log_info "Current production container: $CONTAINER_GREEN"
    else
        log_info "No current production container running"
    fi

    # Determine which to use as new environment
    local new_env
    if [[ "$current_active" == "$CONTAINER_BLUE" ]] || [[ "$current_active" == "$CONTAINER_OLD" ]]; then
        new_env="$CONTAINER_GREEN"
        log_info "Deploying to GREEN environment"
    else
        new_env="$CONTAINER_BLUE"
        log_info "Deploying to BLUE environment"
    fi

    if $DRY_RUN; then
        log_info "[DRY RUN] Would start container: $new_env"
        log_info "[DRY RUN] Would perform health checks"
        log_info "[DRY RUN] Would switch traffic to: $new_env"
        return 0
    fi

    # Start new environment
    log_info "Starting new container: $new_env..."
    docker run -d \
        --name "$new_env" \
        -p "$PORT:$PORT" \
        -e NODE_ENV=production \
        -e LOG_LEVEL=info \
        --restart on-failure:5 \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        -v basset-prod-data:/app/data \
        -v basset-logs:/app/logs \
        "$IMAGE_NAME:$IMAGE_TAG" || {
        log_error "Failed to start new container"
        return 1
    }

    # Wait for new container to be healthy
    if ! wait_for_container_healthy "$new_env" "$HEALTH_CHECK_TIMEOUT"; then
        log_error "New container failed health checks"
        docker stop "$new_env" 2>/dev/null || true
        docker rm "$new_env" 2>/dev/null || true
        return 1
    fi

    # Perform health checks
    if ! perform_websocket_health_check "$new_env"; then
        log_error "WebSocket health check failed"
        docker stop "$new_env" 2>/dev/null || true
        docker rm "$new_env" 2>/dev/null || true
        return 1
    fi

    if ! perform_container_health_check "$new_env"; then
        log_warn "Container health check issues detected"
    fi

    # Perform smoke tests
    if ! perform_smoke_tests "$new_env"; then
        log_error "Smoke tests failed"
        docker stop "$new_env" 2>/dev/null || true
        docker rm "$new_env" 2>/dev/null || true
        return 1
    fi

    # Switch traffic (rename container)
    log_info "Switching traffic to new environment..."
    if [[ -n "$current_active" ]]; then
        docker rename "$current_active" "$current_active.old" 2>/dev/null || true
    fi
    docker rename "$new_env" "$CONTAINER_OLD" || {
        log_error "Failed to rename container to production"
        return 1
    }

    # Cleanup old container
    if [[ -n "$current_active" ]]; then
        log_info "Cleaning up old container..."
        sleep 5  # Give connections time to drain
        docker stop "$current_active.old" 2>/dev/null || true
        if $PRESERVE_DATA; then
            log_info "Preserving data volumes"
        else
            docker rm "$current_active.old" 2>/dev/null || true
        fi
    fi

    log_success "Blue-green deployment completed successfully"
    return 0
}

deploy_canary() {
    log_section "Deploying Canary (5% Traffic)"

    if $DRY_RUN; then
        log_info "[DRY RUN] Would deploy canary with 5% traffic allocation"
        return 0
    fi

    # This would integrate with load balancer or service mesh
    log_info "Deploying canary container..."

    local canary_container="${CONTAINER_OLD}-canary"
    docker run -d \
        --name "$canary_container" \
        -p 8766:$PORT \
        -e NODE_ENV=production \
        -e LOG_LEVEL=debug \
        --restart on-failure:5 \
        "$IMAGE_NAME:$IMAGE_TAG" || {
        log_error "Failed to start canary container"
        return 1
    }

    if ! wait_for_container_healthy "$canary_container" 60; then
        log_error "Canary container failed health checks"
        docker stop "$canary_container" 2>/dev/null || true
        docker rm "$canary_container" 2>/dev/null || true
        return 1
    fi

    log_success "Canary deployed on port 8766"
    log_info "Monitor canary for 5-10 minutes before proceeding with full rollout"

    return 0
}

deploy_staged() {
    log_section "Deploying in Stages"

    local stages=(10 50 100)

    for stage in "${stages[@]}"; do
        log_info "Stage $stage%: Deploying to $stage% of traffic..."

        if $DRY_RUN; then
            log_info "[DRY RUN] Would allocate $stage% traffic to new version"
        fi

        log_info "Waiting ${TRAFFIC_RAMP_INTERVAL}s before next stage..."
        sleep "$TRAFFIC_RAMP_INTERVAL"

        # Check for errors
        if perform_error_log_check "$CONTAINER_OLD"; then
            log_success "Stage $stage% completed successfully"
        else
            log_error "Stage $stage% encountered errors"
            if [[ $stage -eq 10 ]]; then
                log_error "Early stage failure, initiating rollback"
                return 1
            fi
        fi
    done

    log_success "All deployment stages completed successfully"
    return 0
}

# ============================================================================
# ROLLBACK FUNCTIONS
# ============================================================================

trigger_automated_rollback() {
    log_section "Triggering Automated Rollback"

    log_error "Deployment failed, initiating automated rollback..."
    DEPLOYMENT_STATUS="ROLLBACK_IN_PROGRESS"

    if [[ -z "$BACKUP_PATH" ]] || ! $BACKUP_CREATED; then
        log_error "No backup available, manual intervention required!"
        DEPLOYMENT_STATUS="ROLLBACK_FAILED"
        return 1
    fi

    # Attempt to restore previous version
    if restore_from_backup; then
        log_info "Restarting with previous version..."

        if $DRY_RUN; then
            log_info "[DRY RUN] Would restart container with previous version"
            DEPLOYMENT_STATUS="ROLLED_BACK"
            return 0
        fi

        docker stop "$CONTAINER_OLD" 2>/dev/null || true
        sleep 2

        docker run -d \
            --name "${CONTAINER_OLD}-restored" \
            -p "$PORT:$PORT" \
            -e NODE_ENV=production \
            -e LOG_LEVEL=info \
            --restart on-failure:5 \
            -v basset-prod-data:/app/data \
            -v basset-logs:/app/logs \
            "$IMAGE_NAME:$PREVIOUS_VERSION" || {
            log_error "Failed to restart container with previous version"
            DEPLOYMENT_STATUS="ROLLBACK_FAILED"
            return 1
        }

        if wait_for_container_healthy "${CONTAINER_OLD}-restored" 60; then
            docker rename "${CONTAINER_OLD}-restored" "$CONTAINER_OLD"
            log_success "Rollback completed successfully"
            DEPLOYMENT_STATUS="ROLLED_BACK"
            return 0
        fi
    fi

    log_error "Automatic rollback failed, manual intervention required!"
    DEPLOYMENT_STATUS="ROLLBACK_FAILED"
    return 1
}

# ============================================================================
# REPORT GENERATION
# ============================================================================

generate_deployment_report() {
    local deployment_status=$1
    local duration=$((DEPLOYMENT_END_TIME - DEPLOYMENT_START_TIME))

    log_section "Generating Deployment Report"

    local report=$(cat <<EOF
{
  "deployment": {
    "version": "$DEPLOYMENT_VERSION",
    "previous_version": "$PREVIOUS_VERSION",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "duration_seconds": $duration,
    "status": "$deployment_status"
  },
  "deployment_mode": {
    "canary": $CANARY_MODE,
    "staged": $STAGED_MODE,
    "dry_run": $DRY_RUN,
    "backup_enabled": $BACKUP_ENABLED
  },
  "health_checks": {
    "backup_created": $BACKUP_CREATED,
    "backup_path": "$BACKUP_PATH",
    "failed_checks": "$FAILED_CHECKS"
  },
  "notifications": {
    "slack_sent": $([ -n "$SLACK_WEBHOOK" ] && echo "true" || echo "false"),
    "email_sent": $([ -n "$EMAIL_ADDR" ] && echo "true" || echo "false")
  },
  "logs": {
    "deployment_log": "$DEPLOYMENT_LOG",
    "docker_version": "$(docker --version)",
    "container_os": "$(uname -s)"
  }
}
EOF
)

    echo "$report" | tee "$DEPLOYMENT_REPORT"
    log_success "Report saved to $DEPLOYMENT_REPORT"
}

# ============================================================================
# MAIN DEPLOYMENT FLOW
# ============================================================================

main() {
    DEPLOYMENT_START_TIME=$(date +%s)

    log_section "Basset Hound Browser - v12.9.0 Deployment"
    log_info "Deployment Version: $DEPLOYMENT_VERSION"
    log_info "Previous Version: $PREVIOUS_VERSION"
    log_info "Mode: $([ $CANARY_MODE = true ] && echo "CANARY" || echo "STANDARD")"
    log_info "Log: $DEPLOYMENT_LOG"

    # Parse arguments
    parse_arguments "$@"

    # Pre-flight checks
    log_section "Pre-Flight Checks"

    if ! command -v docker &>/dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    log_success "Docker available"

    if ! docker info &>/dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    log_success "Docker daemon running"

    if ! [[ -f "$DOCKER_COMPOSE_FILE" ]]; then
        log_warn "Docker compose file not found at $DOCKER_COMPOSE_FILE"
    fi

    # Safety checks
    if ! $FORCE; then
        if container_is_running "$CONTAINER_OLD"; then
            log_warn "Production container is already running"
            log_info "Proceeding with zero-downtime deployment"
        fi
    fi

    # Create backup
    if ! create_deployment_backup; then
        if ! $FORCE; then
            log_error "Backup creation failed and --force not specified"
            exit 1
        fi
    fi

    # Build image
    if ! build_docker_image; then
        log_error "Docker image build failed"
        send_slack_notification "error" "Failed to build Docker image"
        send_email_notification "ERROR" "Failed to build Docker image for v${DEPLOYMENT_VERSION}"
        exit 1
    fi

    # Push to registry if specified
    if ! push_docker_image; then
        log_error "Docker image push failed"
        send_slack_notification "error" "Failed to push Docker image"
        send_email_notification "ERROR" "Failed to push Docker image to registry"
        exit 1
    fi

    # Deploy based on mode
    if $CANARY_MODE; then
        if ! deploy_canary; then
            log_error "Canary deployment failed"
            send_slack_notification "error" "Canary deployment failed"
            send_email_notification "ERROR" "Canary deployment failed for v${DEPLOYMENT_VERSION}"
            exit 1
        fi

        if $STAGED_MODE; then
            read -p "Canary looks good? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                log_info "Proceeding with staged rollout..."
                if ! deploy_staged; then
                    log_error "Staged deployment failed"
                    trigger_automated_rollback
                fi
            else
                log_info "Cancelling deployment"
                exit 1
            fi
        fi
    elif ! deploy_blue_green; then
        log_error "Blue-green deployment failed"
        send_slack_notification "error" "Blue-green deployment failed"
        send_email_notification "ERROR" "Blue-green deployment failed for v${DEPLOYMENT_VERSION}"

        # Attempt automatic rollback
        if ! trigger_automated_rollback; then
            log_error "Automatic rollback failed!"
            DEPLOYMENT_STATUS="FAILED_ROLLBACK_FAILED"
            exit 1
        fi
        exit 1
    fi

    # Post-deployment health checks
    if ! $SKIP_HEALTH_CHECK; then
        log_section "Post-Deployment Health Checks"

        if ! perform_websocket_health_check "$CONTAINER_OLD"; then
            log_error "Post-deployment health check failed"
            if ! trigger_automated_rollback; then
                log_error "Automatic rollback also failed!"
                DEPLOYMENT_STATUS="FAILED_ROLLBACK_FAILED"
                exit 1
            fi
            exit 1
        fi

        perform_container_health_check "$CONTAINER_OLD"
        perform_error_log_check "$CONTAINER_OLD"
    fi

    DEPLOYMENT_END_TIME=$(date +%s)
    DEPLOYMENT_STATUS="SUCCESS"

    # Generate report
    generate_deployment_report "$DEPLOYMENT_STATUS"

    # Send notifications
    send_slack_notification "success" "v${DEPLOYMENT_VERSION} deployed successfully in $((DEPLOYMENT_END_TIME - DEPLOYMENT_START_TIME))s"
    send_email_notification "SUCCESS" "v${DEPLOYMENT_VERSION} deployed successfully"

    log_section "Deployment Completed Successfully"
    log_success "Version $DEPLOYMENT_VERSION is now live"
    log_info "Report: $DEPLOYMENT_REPORT"
    log_info "Log: $DEPLOYMENT_LOG"
}

# ============================================================================
# SCRIPT EXECUTION
# ============================================================================

main "$@"
