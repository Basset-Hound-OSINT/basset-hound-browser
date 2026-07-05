#!/bin/bash
# Basset Hound Browser - Instant Rollback Script (v12.7.0)
# Emergency rollback to previous version with session recovery
# Usage: ./scripts/rollback-v12.7.0.sh [--to-version VERSION] [--force] [--preserve-data]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# CONFIGURATION
# ============================================================================

CURRENT_VERSION="12.7.0"
ROLLBACK_VERSION="12.5.0"
CONTAINER_NAME="basset-hound-browser-prod"
IMAGE_NAME="basset-hound-browser"
DOCKER_COMPOSE_FILE="config/docker/docker-compose.production.yml"
PORT=8765

# Rollback options
FORCE=false
PRESERVE_DATA=true
VERIFY_AFTER_ROLLBACK=true

# Timing
ROLLBACK_TIMEOUT=120
HEALTH_CHECK_TIMEOUT=60

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging
ROLLBACK_LOG="${PROJECT_ROOT}/logs/rollback-${CURRENT_VERSION}-$(date +%s).log"
mkdir -p "$(dirname "$ROLLBACK_LOG")"

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "$ROLLBACK_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "$ROLLBACK_LOG"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$ROLLBACK_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "$ROLLBACK_LOG"
}

log_section() {
    echo -e "\n${CYAN}=== $* ===${NC}" | tee -a "$ROLLBACK_LOG"
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
            --preserve-data)
                PRESERVE_DATA=true
                shift
                ;;
            --no-preserve-data)
                PRESERVE_DATA=false
                shift
                ;;
            --skip-verify)
                VERIFY_AFTER_ROLLBACK=false
                shift
                ;;
            -h|--help)
                print_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done
}

print_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    --to-version VERSION        Rollback to specific version (default: 12.5.0)
    --force                     Skip confirmation prompt
    --preserve-data             Keep data volumes (default: true)
    --no-preserve-data          Remove data volumes during rollback
    --skip-verify               Don't verify rollback success
    -h, --help                  Show this help message
EOF
}

# ============================================================================
# PRE-ROLLBACK VALIDATION
# ============================================================================

validate_rollback() {
    log_section "Pre-Rollback Validation"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found"
        return 1
    fi
    log_success "Docker available"

    # Check if rollback version image exists
    if ! docker image inspect "${IMAGE_NAME}:${ROLLBACK_VERSION}" &> /dev/null; then
        log_error "Rollback image not found: ${IMAGE_NAME}:${ROLLBACK_VERSION}"
        log_info "Available images:"
        docker images "$IMAGE_NAME" | tail -10 | tee -a "$ROLLBACK_LOG"
        return 1
    fi
    log_success "Rollback image available: ${IMAGE_NAME}:${ROLLBACK_VERSION}"

    # Verify current version
    local current_image=$(docker inspect "$CONTAINER_NAME" --format='{{.Image}}' 2>/dev/null || echo "unknown")
    log_info "Current container image: $current_image"

    return 0
}

# ============================================================================
# BACKUP CURRENT STATE
# ============================================================================

backup_current_state() {
    log_section "Backing Up Current State"

    local backup_dir="${PROJECT_ROOT}/backups/rollback-${CURRENT_VERSION}-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"

    log_info "Backup directory: $backup_dir"

    # Export container configuration
    log_info "Exporting container configuration..."
    docker inspect "$CONTAINER_NAME" > "${backup_dir}/container-config.json" 2>/dev/null || {
        log_warn "Could not export container configuration"
    }

    # Export container logs
    log_info "Exporting container logs..."
    docker logs "$CONTAINER_NAME" > "${backup_dir}/container-logs.txt" 2>&1 || true

    # Backup volumes if preserving data
    if $PRESERVE_DATA; then
        log_info "Backing up data volumes..."

        # List volumes
        local volumes=$(docker inspect "$CONTAINER_NAME" --format='{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}},{{end}}{{end}}' 2>/dev/null || echo "")

        if [[ -n "$volumes" ]]; then
            for volume in ${volumes//,/ }; do
                if [[ -n "$volume" ]]; then
                    log_info "  Backing up volume: $volume"
                    docker run --rm \
                        -v "${volume}:/data" \
                        -v "${backup_dir}:/backup" \
                        busybox tar czf "/backup/${volume}.tar.gz" -C /data . 2>/dev/null || {
                        log_warn "Could not backup volume: $volume"
                    }
                fi
            done
        fi
    fi

    echo "$backup_dir" > "${PROJECT_ROOT}/.last_rollback_backup"
    log_success "Backup complete: $backup_dir"

    return 0
}

# ============================================================================
# STOP CURRENT CONTAINER
# ============================================================================

stop_current_container() {
    log_section "Stopping Current Container"

    if ! docker ps -a | grep -q "$CONTAINER_NAME"; then
        log_info "Container not running"
        return 0
    fi

    log_info "Stopping container: $CONTAINER_NAME"

    cd "$PROJECT_ROOT"

    # Use docker-compose to stop gracefully
    if [[ -f "$DOCKER_COMPOSE_FILE" ]]; then
        log_info "Using Docker Compose to stop container..."
        docker-compose -f "$DOCKER_COMPOSE_FILE" down || {
            log_warn "Docker Compose down failed, attempting direct stop"
            docker stop "$CONTAINER_NAME" || true
            docker rm "$CONTAINER_NAME" || true
        }
    else
        docker stop "$CONTAINER_NAME" || true
        docker rm "$CONTAINER_NAME" || true
    fi

    # Verify container is stopped
    if docker ps -a | grep -q "$CONTAINER_NAME"; then
        log_warn "Container still exists after stop, forcing removal..."
        docker rm -f "$CONTAINER_NAME" || true
    fi

    log_success "Container stopped"
    return 0
}

# ============================================================================
# RESTORE DATA VOLUMES
# ============================================================================

restore_data_volumes() {
    if ! $PRESERVE_DATA; then
        log_info "Skipping volume restoration (data not preserved)"
        return 0
    fi

    log_section "Restoring Data Volumes"

    local backup_dir=$(cat "${PROJECT_ROOT}/.last_rollback_backup" 2>/dev/null || echo "")

    if [[ -z "$backup_dir" ]] || [[ ! -d "$backup_dir" ]]; then
        log_warn "No backup directory found, skipping volume restoration"
        return 0
    fi

    log_info "Restoring volumes from: $backup_dir"

    # Find all tar.gz files in backup
    for backup_file in "${backup_dir}"/*.tar.gz; do
        if [[ -f "$backup_file" ]]; then
            local volume_name=$(basename "$backup_file" .tar.gz)
            log_info "Restoring volume: $volume_name"

            docker run --rm \
                -v "${volume_name}:/data" \
                -v "${backup_dir}:/backup" \
                busybox tar xzf "/backup/${volume_name}.tar.gz" -C /data 2>/dev/null || {
                log_warn "Could not restore volume: $volume_name"
            }
        fi
    done

    log_success "Volume restoration complete"
    return 0
}

# ============================================================================
# START ROLLBACK VERSION
# ============================================================================

start_rollback_version() {
    log_section "Starting Rollback Version"

    cd "$PROJECT_ROOT"

    log_info "Starting container with image: ${IMAGE_NAME}:${ROLLBACK_VERSION}"

    # Create temporary compose file with rollback version
    local temp_compose=$(mktemp)
    cp "$DOCKER_COMPOSE_FILE" "$temp_compose"

    # Replace version
    sed -i "s|image:.*basset-hound-browser:.*|image: ${IMAGE_NAME}:${ROLLBACK_VERSION}|g" "$temp_compose"

    # Start container
    if docker-compose -f "$temp_compose" up -d 2>&1 | tee -a "$ROLLBACK_LOG"; then
        log_success "Rollback container started"
    else
        log_error "Failed to start rollback container"
        rm -f "$temp_compose"
        return 1
    fi

    rm -f "$temp_compose"
    return 0
}

# ============================================================================
# HEALTH VERIFICATION
# ============================================================================

verify_rollback_health() {
    if ! $VERIFY_AFTER_ROLLBACK; then
        log_info "Skipping rollback verification"
        return 0
    fi

    log_section "Verifying Rollback Health"

    local start_time=$(date +%s)
    local elapsed=0

    log_info "Waiting for container health (max ${HEALTH_CHECK_TIMEOUT}s)..."

    # Wait for container health
    while [[ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]]; do
        if docker ps --filter "name=$CONTAINER_NAME" --filter "health=healthy" | grep -q "$CONTAINER_NAME"; then
            log_success "Container is healthy"
            break
        fi

        local health_status=$(docker inspect "$CONTAINER_NAME" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
        log_info "Health status: $health_status (waited ${elapsed}s/${HEALTH_CHECK_TIMEOUT}s)"

        sleep 3
        elapsed=$(($(date +%s) - start_time))
    done

    # Check WebSocket connectivity
    log_info "Testing WebSocket connectivity..."

    if timeout 5 bash -c "echo 'PING' | nc -q 1 localhost $PORT" &>/dev/null; then
        log_success "WebSocket connectivity verified"
        return 0
    else
        log_error "WebSocket connectivity failed"
        return 1
    fi
}

# ============================================================================
# CLEANUP
# ============================================================================

cleanup_images() {
    log_section "Cleaning Up Old Images"

    log_info "Old version image: ${IMAGE_NAME}:${CURRENT_VERSION}"

    # Don't delete the current version image by default
    # It can be useful for quick re-rollback if needed
    log_info "Keeping image ${IMAGE_NAME}:${CURRENT_VERSION} for potential re-rollback"
    log_info "To delete, run: docker rmi ${IMAGE_NAME}:${CURRENT_VERSION}"

    return 0
}

# ============================================================================
# GENERATE ROLLBACK REPORT
# ============================================================================

generate_rollback_report() {
    log_section "Rollback Summary"

    local report_file="${PROJECT_ROOT}/logs/rollback-${CURRENT_VERSION}-summary.txt"

    cat > "$report_file" << EOF
Basset Hound Browser - Rollback Report
From Version: $CURRENT_VERSION
To Version: $ROLLBACK_VERSION
Timestamp: $(date)
Status: SUCCESS

Rollback Details:
  - Container: $CONTAINER_NAME
  - Port: $PORT
  - Data Preserved: $PRESERVE_DATA
  - Health Verified: $VERIFY_AFTER_ROLLBACK

Container Status:
  - Image: ${IMAGE_NAME}:${ROLLBACK_VERSION}
  - Health: $(docker inspect "$CONTAINER_NAME" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
  - Running: $(docker ps --filter "name=$CONTAINER_NAME" --format="{{.Names}}" 2>/dev/null || echo "unknown")

Logs:
  - Rollback Log: $ROLLBACK_LOG
  - Backup Location: $(cat "${PROJECT_ROOT}/.last_rollback_backup" 2>/dev/null || echo "Not available")

Re-Deployment Command:
  ./scripts/deploy-v12.7.0.sh --force

EOF

    log_success "Report written to: $report_file"
    cat "$report_file"
}

# ============================================================================
# MAIN ROLLBACK FLOW
# ============================================================================

main() {
    log_section "Basset Hound Browser - Rollback Procedure"
    log_info "From: v${CURRENT_VERSION} To: v${ROLLBACK_VERSION}"
    log_info "Start time: $(date)"
    log_info "Log file: $ROLLBACK_LOG"

    # Validation
    if ! validate_rollback; then
        log_error "Rollback validation failed"
        return 1
    fi

    # Backup
    if ! backup_current_state; then
        log_error "Backup failed"
        if ! $FORCE; then
            return 1
        fi
        log_warn "Continuing despite backup failure (--force enabled)"
    fi

    # Stop
    if ! stop_current_container; then
        log_error "Failed to stop container"
        return 1
    fi

    # Restore data
    if ! restore_data_volumes; then
        log_warn "Volume restoration had issues"
    fi

    # Start rollback version
    if ! start_rollback_version; then
        log_error "Failed to start rollback version"
        return 1
    fi

    # Verify
    if ! verify_rollback_health; then
        log_error "Health verification failed"
        return 1
    fi

    # Cleanup
    cleanup_images

    # Report
    generate_rollback_report

    log_section "Rollback Complete"
    log_success "Successfully rolled back to v${ROLLBACK_VERSION}"
    log_info "End time: $(date)"

    return 0
}

# ============================================================================
# ENTRY POINT
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    parse_arguments "$@"

    # Confirm rollback
    if ! $FORCE; then
        log_warn "ROLLBACK PROCEDURE INITIATED"
        log_warn "This will stop the current version and restore the previous version"
        log_info "Current: v${CURRENT_VERSION}"
        log_info "Rollback To: v${ROLLBACK_VERSION}"
        read -p "Continue with rollback? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log_warn "Rollback cancelled"
            exit 0
        fi
    fi

    # Execute rollback
    if main; then
        exit 0
    else
        log_error "Rollback procedure failed"
        exit 1
    fi
fi
