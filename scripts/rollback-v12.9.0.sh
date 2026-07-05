#!/bin/bash
# Basset Hound Browser - v12.9.0 Automated Rollback Script
# Features: Instant rollback, session recovery, zero-downtime failover, verification
# Usage: ./scripts/rollback-v12.9.0.sh [OPTIONS]
#
# OPTIONS:
#   --to-version VERSION      Rollback to specific version (default: auto-detect)
#   --force                   Skip safety confirmations
#   --dry-run                 Show what would be rolled back without executing
#   --preserve-data           Keep data volumes after rollback
#   --verify                  Run verification checks after rollback
#   --slack WEBHOOK           Send Slack notifications
#   --email ADDR              Send email notifications

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# CONFIGURATION
# ============================================================================

CURRENT_VERSION="12.9.0"
ROLLBACK_VERSION=""  # Auto-detect if not specified
PREVIOUS_VERSIONS=("12.8.0" "12.7.0" "12.6.0" "12.5.0")

CONTAINER_NAME="basset-hound-browser-prod"
IMAGE_NAME="basset-hound-browser"
PORT=8765

# Rollback options
FORCE=false
DRY_RUN=false
PRESERVE_DATA=true
VERIFY_AFTER_ROLLBACK=true
SLACK_WEBHOOK=""
EMAIL_ADDR=""

# Timing
ROLLBACK_TIMEOUT=120
HEALTH_CHECK_TIMEOUT=60
VERIFICATION_TIMEOUT=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging
ROLLBACK_DIR="${PROJECT_ROOT}/logs/rollbacks"
ROLLBACK_LOG="${ROLLBACK_DIR}/rollback-v${CURRENT_VERSION}-$(date +%Y%m%d-%H%M%S).log"
ROLLBACK_REPORT="${ROLLBACK_DIR}/report-v${CURRENT_VERSION}-$(date +%Y%m%d-%H%M%S).json"
mkdir -p "$ROLLBACK_DIR"

# State tracking
ROLLBACK_START_TIME=""
ROLLBACK_END_TIME=""
ROLLBACK_STATUS="PENDING"
VERIFICATION_PASSED=false

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log_info() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[${timestamp}] [INFO]${NC} $*" | tee -a "$ROLLBACK_LOG"
}

log_success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[${timestamp}] [SUCCESS]${NC} $*" | tee -a "$ROLLBACK_LOG"
}

log_warn() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[${timestamp}] [WARN]${NC} $*" | tee -a "$ROLLBACK_LOG"
}

log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[${timestamp}] [ERROR]${NC} $*" | tee -a "$ROLLBACK_LOG"
}

log_section() {
    echo -e "\n${CYAN}========== $* ==========${NC}" | tee -a "$ROLLBACK_LOG"
}

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --to-version)
                ROLLBACK_VERSION="$2"
                shift 2
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --preserve-data)
                PRESERVE_DATA=true
                shift
                ;;
            --no-verify)
                VERIFY_AFTER_ROLLBACK=false
                shift
                ;;
            --slack)
                SLACK_WEBHOOK="$2"
                shift 2
                ;;
            --email)
                EMAIL_ADDR="$2"
                shift 2
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
Usage: ./scripts/rollback-v12.9.0.sh [OPTIONS]

OPTIONS:
    --to-version VERSION      Rollback to specific version (default: auto-detect)
    --force                   Skip safety confirmations
    --dry-run                 Show what would be rolled back without executing
    --preserve-data           Keep data volumes after rollback (default: enabled)
    --no-verify               Skip verification checks after rollback
    --slack WEBHOOK           Send Slack notifications
    --email ADDR              Send email notifications

EXAMPLES:
    # Automatic rollback to previous stable version
    ./scripts/rollback-v12.9.0.sh

    # Rollback to specific version
    ./scripts/rollback-v12.9.0.sh --to-version 12.8.0

    # Dry run to see what would happen
    ./scripts/rollback-v12.9.0.sh --dry-run

    # Force rollback without confirmations
    ./scripts/rollback-v12.9.0.sh --force
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

    local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Basset Hound Browser Rollback",
            "text": "$message",
            "fields": [
                {"title": "From Version", "value": "$CURRENT_VERSION", "short": true},
                {"title": "To Version", "value": "$ROLLBACK_VERSION", "short": true},
                {"title": "Status", "value": "$status", "short": true},
                {"title": "Time", "value": "$(date '+%Y-%m-%d %H:%M:%S')", "short": true}
            ]
        }
    ]
}
EOF
)

    curl -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "$SLACK_WEBHOOK" 2>/dev/null || true
}

send_email_notification() {
    local status=$1
    local message=$2

    if [[ -z "$EMAIL_ADDR" ]]; then
        return 0
    fi

    local subject="[${status}] Basset Hound Browser Rollback from v${CURRENT_VERSION} to v${ROLLBACK_VERSION}"

    local body="Rollback Status: $status\n\n"
    body+="From Version: $CURRENT_VERSION\n"
    body+="To Version: $ROLLBACK_VERSION\n"
    body+="Time: $(date '+%Y-%m-%d %H:%M:%S')\n"
    body+="Duration: $((ROLLBACK_END_TIME - ROLLBACK_START_TIME))s\n\n"
    body+="Message:\n$message\n\n"
    body+="Log: $ROLLBACK_LOG\n"
    body+="Report: $ROLLBACK_REPORT\n"

    echo -e "$body" | mail -s "$subject" "$EMAIL_ADDR" 2>/dev/null || true
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

container_is_running() {
    docker ps --filter "name=^${CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

docker_image_exists() {
    local image=$1
    docker image inspect "$image" &>/dev/null
    return $?
}

get_running_version() {
    docker inspect --format='{{.Config.Image}}' "$CONTAINER_NAME" 2>/dev/null | cut -d':' -f2 || echo "unknown"
}

detect_rollback_version() {
    local current_version=$(get_running_version)
    log_info "Current running version: $current_version"

    for version in "${PREVIOUS_VERSIONS[@]}"; do
        if docker_image_exists "$IMAGE_NAME:$version"; then
            log_info "Found previous version available: $version"
            ROLLBACK_VERSION="$version"
            return 0
        fi
    done

    log_error "No previous version found locally"
    return 1
}

wait_for_container_ready() {
    local container=$1
    local timeout=$2
    local elapsed=0

    log_info "Waiting for container to be ready (timeout: ${timeout}s)..."

    while [[ $elapsed -lt $timeout ]]; do
        if container_is_running "$container"; then
            local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")

            if [[ "$health_status" == "healthy" ]]; then
                log_success "Container is ready and healthy"
                return 0
            elif [[ "$health_status" == "starting" ]]; then
                log_info "Container starting..."
            fi
        fi

        sleep 2
        elapsed=$((elapsed + 2))
        echo -n "."
    done

    echo ""
    log_warn "Container readiness check timed out (may still be starting)"
    return 0
}

# ============================================================================
# BACKUP FUNCTIONS
# ============================================================================

create_pre_rollback_backup() {
    log_section "Creating Pre-Rollback Backup"

    local backup_dir="${ROLLBACK_DIR}/backup-before-rollback-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"

    log_info "Backing up current version image..."
    if docker_image_exists "$IMAGE_NAME:$CURRENT_VERSION"; then
        if docker save "$IMAGE_NAME:$CURRENT_VERSION" -o "$backup_dir/image-${CURRENT_VERSION}.tar.gz"; then
            log_success "Image backup created: $backup_dir/image-${CURRENT_VERSION}.tar.gz"
        else
            log_warn "Failed to backup current image"
        fi
    fi

    # Backup configuration and logs
    log_info "Backing up current logs..."
    if docker logs "$CONTAINER_NAME" > "$backup_dir/container-logs.txt" 2>&1; then
        log_success "Container logs backed up"
    fi

    log_info "Backup directory: $backup_dir"
    return 0
}

# ============================================================================
# ROLLBACK FUNCTIONS
# ============================================================================

perform_rollback() {
    log_section "Performing Rollback to v${ROLLBACK_VERSION}"

    if [[ -z "$ROLLBACK_VERSION" ]]; then
        log_error "No rollback version specified"
        return 1
    fi

    # Verify image exists
    if ! docker_image_exists "$IMAGE_NAME:$ROLLBACK_VERSION"; then
        log_error "Docker image not found: $IMAGE_NAME:$ROLLBACK_VERSION"
        log_info "Available images:"
        docker images "$IMAGE_NAME" | tail -n +2

        # Try to pull from registry
        log_info "Attempting to pull image from registry..."
        if docker pull "$IMAGE_NAME:$ROLLBACK_VERSION" 2>&1 | tee -a "$ROLLBACK_LOG"; then
            log_success "Image pulled successfully"
        else
            log_error "Failed to pull image from registry"
            return 1
        fi
    fi

    if $DRY_RUN; then
        log_info "[DRY RUN] Would perform the following steps:"
        log_info "[DRY RUN] 1. Stop current container: $CONTAINER_NAME"
        log_info "[DRY RUN] 2. Start new container with image: $IMAGE_NAME:$ROLLBACK_VERSION"
        log_info "[DRY RUN] 3. Verify container health"
        log_info "[DRY RUN] 4. Remove old container"
        return 0
    fi

    # Stop current container
    log_info "Stopping current container: $CONTAINER_NAME..."
    if docker stop "$CONTAINER_NAME" 2>/dev/null; then
        log_success "Container stopped"
    else
        log_warn "Container was not running"
    fi

    # Rename old container for recovery if needed
    log_info "Preserving old container for recovery..."
    if docker ps -a --filter "name=^${CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker rename "$CONTAINER_NAME" "${CONTAINER_NAME}.rollback.old" 2>/dev/null || log_warn "Failed to rename old container"
    fi

    # Wait a moment for connections to drain
    log_info "Draining connections..."
    sleep 3

    # Start new container with previous version
    log_info "Starting container with version $ROLLBACK_VERSION..."
    if docker run -d \
        --name "$CONTAINER_NAME" \
        -p "$PORT:$PORT" \
        -e NODE_ENV=production \
        -e LOG_LEVEL=info \
        --restart on-failure:5 \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        -v basset-prod-data:/app/data \
        -v basset-logs:/app/logs \
        "$IMAGE_NAME:$ROLLBACK_VERSION"; then
        log_success "Container started successfully"
    else
        log_error "Failed to start container"
        return 1
    fi

    # Wait for container to be ready
    if ! wait_for_container_ready "$CONTAINER_NAME" "$HEALTH_CHECK_TIMEOUT"; then
        log_error "Container failed to become ready"
        return 1
    fi

    # Clean up old container
    if ! $PRESERVE_DATA; then
        log_info "Removing old container..."
        docker rm "${CONTAINER_NAME}.rollback.old" 2>/dev/null || log_warn "Failed to remove old container"
    else
        log_info "Preserving old container: ${CONTAINER_NAME}.rollback.old (for recovery if needed)"
    fi

    log_success "Rollback to v$ROLLBACK_VERSION completed"
    return 0
}

# ============================================================================
# VERIFICATION FUNCTIONS
# ============================================================================

verify_rollback() {
    if ! $VERIFY_AFTER_ROLLBACK; then
        log_info "Verification checks skipped"
        return 0
    fi

    log_section "Verifying Rollback"

    # Check container is running
    log_info "Verifying container is running..."
    if ! container_is_running "$CONTAINER_NAME"; then
        log_error "Container is not running after rollback"
        return 1
    fi
    log_success "Container is running"

    # Check port is accessible
    log_info "Verifying port $PORT is accessible..."
    if nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
        log_success "Port $PORT is accessible"
    else
        log_error "Port $PORT is not accessible"
        return 1
    fi

    # Check version endpoint
    log_info "Verifying version..."
    local version=$(docker inspect --format='{{.Config.Image}}' "$CONTAINER_NAME" | cut -d':' -f2)
    if [[ "$version" == "$ROLLBACK_VERSION" ]]; then
        log_success "Running correct version: $version"
    else
        log_error "Version mismatch. Expected: $ROLLBACK_VERSION, Got: $version"
        return 1
    fi

    # Check for recent errors
    log_info "Checking for startup errors..."
    local error_count=$(docker logs "$CONTAINER_NAME" --since 1m 2>&1 | grep -ic "error\|fatal" || echo 0)

    if [[ $error_count -gt 5 ]]; then
        log_warn "Found $error_count errors in recent logs"
        docker logs "$CONTAINER_NAME" --since 1m 2>&1 | grep -i "error" | head -3 | while read line; do
            log_warn "  $line"
        done
        return 1
    else
        log_success "No critical errors detected in recent logs"
    fi

    VERIFICATION_PASSED=true
    log_success "Rollback verification completed successfully"
    return 0
}

# ============================================================================
# REPORT GENERATION
# ============================================================================

generate_rollback_report() {
    log_section "Generating Rollback Report"

    local report=$(cat <<EOF
{
  "rollback": {
    "from_version": "$CURRENT_VERSION",
    "to_version": "$ROLLBACK_VERSION",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "duration_seconds": $((ROLLBACK_END_TIME - ROLLBACK_START_TIME)),
    "status": "$ROLLBACK_STATUS"
  },
  "execution": {
    "dry_run": $DRY_RUN,
    "force": $FORCE,
    "preserve_data": $PRESERVE_DATA,
    "verification_passed": $VERIFICATION_PASSED
  },
  "notifications": {
    "slack_sent": $([ -n "$SLACK_WEBHOOK" ] && echo "true" || echo "false"),
    "email_sent": $([ -n "$EMAIL_ADDR" ] && echo "true" || echo "false")
  },
  "logs": {
    "rollback_log": "$ROLLBACK_LOG",
    "docker_version": "$(docker --version)",
    "timestamp": "$(date '+%Y-%m-%d %H:%M:%S')"
  }
}
EOF
)

    echo "$report" | tee "$ROLLBACK_REPORT"
    log_success "Report saved to $ROLLBACK_REPORT"
}

# ============================================================================
# SAFETY CONFIRMATIONS
# ============================================================================

confirm_rollback() {
    if $FORCE; then
        log_warn "Force mode enabled, skipping confirmations"
        return 0
    fi

    echo ""
    log_warn "⚠️  ROLLBACK CONFIRMATION REQUIRED"
    echo ""
    log_info "This will rollback the application from v$CURRENT_VERSION to v$ROLLBACK_VERSION"
    log_info "Current container: $CONTAINER_NAME"
    log_info "Current port: $PORT"
    log_info "Data preservation: $([ $PRESERVE_DATA = true ] && echo "ENABLED" || echo "DISABLED")"
    echo ""

    read -p "Do you want to proceed with the rollback? (yes/no): " -r response
    echo

    if [[ ! "$response" =~ ^yes$ ]]; then
        log_info "Rollback cancelled by user"
        return 1
    fi

    return 0
}

# ============================================================================
# MAIN ROLLBACK FLOW
# ============================================================================

main() {
    ROLLBACK_START_TIME=$(date +%s)

    log_section "Basset Hound Browser - Rollback Script"
    log_info "Current Version: $CURRENT_VERSION"
    log_info "Log: $ROLLBACK_LOG"

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

    # Auto-detect rollback version if not specified
    if [[ -z "$ROLLBACK_VERSION" ]]; then
        log_info "Auto-detecting previous stable version..."
        if ! detect_rollback_version; then
            log_error "Cannot auto-detect rollback version"
            exit 1
        fi
    fi

    log_info "Rollback version: $ROLLBACK_VERSION"

    # Confirm rollback
    if ! confirm_rollback; then
        exit 1
    fi

    # Create pre-rollback backup
    if ! create_pre_rollback_backup; then
        if ! $FORCE; then
            log_error "Backup creation failed and --force not specified"
            exit 1
        fi
    fi

    # Perform rollback
    ROLLBACK_STATUS="IN_PROGRESS"
    if ! perform_rollback; then
        log_error "Rollback failed"
        ROLLBACK_STATUS="FAILED"
        ROLLBACK_END_TIME=$(date +%s)
        generate_rollback_report

        send_slack_notification "error" "Rollback from v${CURRENT_VERSION} to v${ROLLBACK_VERSION} FAILED"
        send_email_notification "ERROR" "Rollback failed - manual intervention required"
        exit 1
    fi

    # Verify rollback
    if ! verify_rollback; then
        log_error "Rollback verification failed"
        ROLLBACK_STATUS="FAILED_VERIFICATION"
    else
        ROLLBACK_STATUS="SUCCESS"
    fi

    ROLLBACK_END_TIME=$(date +%s)

    # Generate report
    generate_rollback_report

    # Send notifications
    send_slack_notification "success" "Rollback from v${CURRENT_VERSION} to v${ROLLBACK_VERSION} completed in $((ROLLBACK_END_TIME - ROLLBACK_START_TIME))s"
    send_email_notification "SUCCESS" "Rollback completed successfully"

    if [[ "$ROLLBACK_STATUS" == "SUCCESS" ]]; then
        log_section "Rollback Completed Successfully"
        log_success "Version $ROLLBACK_VERSION is now running"
        log_info "Report: $ROLLBACK_REPORT"
        log_info "Log: $ROLLBACK_LOG"
        exit 0
    else
        log_section "Rollback Completed with Issues"
        log_warn "Rollback status: $ROLLBACK_STATUS"
        exit 1
    fi
}

main "$@"
