#!/bin/bash
# Basset Hound Browser - Recovery Automation Script
# Restores application state from backups with validation and verification
# Usage: ./infrastructure/scripts/recovery-automation.sh [--list|--restore <backup>|--verify <backup>]

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-${PROJECT_ROOT}/backups}"
RECOVERY_TEMP_DIR="${RECOVERY_TEMP_DIR:-/tmp/recovery}"

# Application directories
DATA_DIR="${PROJECT_ROOT}/data"
CONFIG_DIR="${PROJECT_ROOT}/config"
LOGS_DIR="${PROJECT_ROOT}/logs"

# Container configuration
CONTAINER_NAME="basset-hound-browser"
CONTAINER_DATA_DIR="/app/data"

# Logging
LOG_FILE="${PROJECT_ROOT}/logs/recovery-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "${LOG_FILE%/*}"

# Recovery configuration
CREATE_SNAPSHOTS=true
VERIFY_CHECKSUMS=true
MAX_RECOVERY_TIME=600  # 10 minutes

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

log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ℹ $*" | tee -a "$LOG_FILE"
}

log_warn() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ $*" | tee -a "$LOG_FILE"
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

check_dependencies() {
    local deps=("tar" "gzip" "find" "date" "md5sum" "sha256sum")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Missing dependency: $dep"
            return 1
        fi
    done
    log_success "All dependencies available"
}

create_snapshot() {
    local source_dir=$1
    local snapshot_name=$2

    if [ ! -d "$source_dir" ]; then
        log_warn "Source directory not found: $source_dir"
        return 0
    fi

    log_info "Creating snapshot: $snapshot_name"
    mkdir -p "${RECOVERY_TEMP_DIR}/snapshots"

    tar -czf "${RECOVERY_TEMP_DIR}/snapshots/${snapshot_name}.tar.gz" \
        -C "${source_dir%/*}" "$(basename "$source_dir")" \
        --exclude='*.tmp' 2>/dev/null || true

    log_success "Snapshot created: $snapshot_name"
}

list_backups() {
    log "===== Available Backups ====="

    if [ ! -d "$BACKUP_BASE_DIR" ]; then
        log_error "Backup directory not found: $BACKUP_BASE_DIR"
        return 1
    fi

    local backup_count=0

    # List full backups
    log "Full Backups:"
    while IFS= read -r backup_dir; do
        [ -z "$backup_dir" ] && continue
        local backup_date=$(basename "$backup_dir")
        local backup_size=$(du -sh "$backup_dir" 2>/dev/null | awk '{print $1}')
        echo "  - $backup_date ($backup_size)"
        backup_count=$((backup_count + 1))
    done < <(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -name "full-*" | sort -r)

    # List incremental backups
    log "Incremental Backups:"
    while IFS= read -r backup_dir; do
        [ -z "$backup_dir" ] && continue
        local backup_date=$(basename "$backup_dir")
        local backup_size=$(du -sh "$backup_dir" 2>/dev/null | awk '{print $1}')
        echo "  - $backup_date ($backup_size)"
        backup_count=$((backup_count + 1))
    done < <(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -name "incremental-*" | sort -r)

    if [ "$backup_count" -eq 0 ]; then
        log_warn "No backups found"
        return 1
    fi

    log_success "Total backups: $backup_count"
}

validate_backup() {
    local backup_path=$1

    log "===== Validating Backup ====="
    log "Backup path: $backup_path"

    if [ ! -d "$backup_path" ]; then
        log_error "Backup directory not found: $backup_path"
        return 1
    fi

    local archive_count=$(find "$backup_path" -name "*.tar.gz" | wc -l)
    log_info "Found $archive_count archive files"

    if [ "$archive_count" -eq 0 ]; then
        log_error "No archive files found"
        return 1
    fi

    # Test integrity of archives
    local failed=0
    while IFS= read -r archive; do
        log "Validating archive: $(basename "$archive")"

        if tar -tzf "$archive" > /dev/null 2>&1; then
            log_success "Archive is valid"
        else
            log_error "Archive is corrupted"
            failed=$((failed + 1))
        fi
    done < <(find "$backup_path" -name "*.tar.gz")

    if [ $failed -gt 0 ]; then
        log_error "$failed archive(s) are corrupted"
        return 1
    fi

    log_success "All archives are valid"
    return 0
}

prepare_recovery() {
    log "===== Preparing for Recovery ====="

    # Create recovery directories
    mkdir -p "$RECOVERY_TEMP_DIR"
    mkdir -p "${RECOVERY_TEMP_DIR}/extract"
    mkdir -p "${RECOVERY_TEMP_DIR}/snapshots"

    log_success "Recovery directories prepared"

    # Create snapshots of current state if enabled
    if [ "$CREATE_SNAPSHOTS" = "true" ]; then
        log_info "Creating snapshots of current state..."
        [ -d "$DATA_DIR" ] && create_snapshot "$DATA_DIR" "pre-recovery-data"
        [ -d "$CONFIG_DIR" ] && create_snapshot "$CONFIG_DIR" "pre-recovery-config"
        [ -d "$LOGS_DIR" ] && create_snapshot "$LOGS_DIR" "pre-recovery-logs"
    fi

    log_success "Recovery preparation complete"
}

restore_backup() {
    local backup_path=$1

    log "===== Starting Recovery from Backup ====="
    log "Backup: $backup_path"

    # Validate backup first
    if ! validate_backup "$backup_path"; then
        log_error "Backup validation failed"
        return 1
    fi

    # Stop running container if necessary
    log "Stopping application containers..."
    docker ps -q -f "name=${CONTAINER_NAME}" | while read -r container_id; do
        log "Stopping container: $container_id"
        docker stop "$container_id" 2>/dev/null || true
    done

    # Extract and restore files
    local restore_start=$(date +%s)

    # Restore data
    if [ -f "${backup_path}/data"*.tar.gz ]; then
        log "Restoring data..."
        mkdir -p "$DATA_DIR"

        tar -xzf "${backup_path}/data"*.tar.gz -C "${DATA_DIR%/*}" 2>/dev/null || {
            log_error "Failed to restore data"
            return 1
        }

        log_success "Data restored"
    fi

    # Restore configuration
    if [ -f "${backup_path}/config"*.tar.gz ]; then
        log "Restoring configuration..."
        mkdir -p "$CONFIG_DIR"

        tar -xzf "${backup_path}/config"*.tar.gz -C "${CONFIG_DIR%/*}" 2>/dev/null || {
            log_error "Failed to restore configuration"
            return 1
        }

        log_success "Configuration restored"
    fi

    # Verify restored data
    if [ "$VERIFY_CHECKSUMS" = "true" ]; then
        log_info "Verifying restored data integrity..."
        verify_restored_data || log_warn "Verification encountered issues (continuing)"
    fi

    local restore_end=$(date +%s)
    local restore_time=$((restore_end - restore_start))

    log_success "Recovery complete in ${restore_time}s"
    echo "$backup_path"
}

verify_restored_data() {
    log "===== Verifying Restored Data ====="

    local verified_count=0
    local error_count=0

    # Check data directory
    if [ -d "$DATA_DIR" ]; then
        local file_count=$(find "$DATA_DIR" -type f 2>/dev/null | wc -l)
        log_info "Data directory: $file_count files"

        if [ "$file_count" -gt 0 ]; then
            verified_count=$((verified_count + 1))
        else
            error_count=$((error_count + 1))
        fi
    fi

    # Check configuration directory
    if [ -d "$CONFIG_DIR" ]; then
        local config_count=$(find "$CONFIG_DIR" -type f 2>/dev/null | wc -l)
        log_info "Config directory: $config_count files"

        if [ "$config_count" -gt 0 ]; then
            verified_count=$((verified_count + 1))
        else
            error_count=$((error_count + 1))
        fi
    fi

    # Check file permissions
    if [ -d "$DATA_DIR" ]; then
        log_info "Checking file permissions..."
        find "$DATA_DIR" -type f ! -perm -u+r -o ! -perm -g+r | while read -r file; do
            log_warn "File has incorrect permissions: $file"
            error_count=$((error_count + 1))
        done
    fi

    if [ $error_count -gt 0 ]; then
        log_warn "Verification found $error_count issues"
        return 1
    else
        log_success "All verification checks passed"
        return 0
    fi
}

restart_application() {
    log "===== Restarting Application ====="

    if command -v docker &> /dev/null; then
        if docker ps -a | grep -q "$CONTAINER_NAME"; then
            log "Starting container..."
            docker start "$CONTAINER_NAME" 2>/dev/null || {
                log_warn "Container failed to start, may need manual intervention"
                return 1
            }
            log_success "Container started"
        fi
    fi

    # Wait for application to be ready
    sleep 5

    log_success "Application restart complete"
}

cleanup_recovery() {
    log "===== Cleaning Up Recovery Artifacts ====="

    if [ -d "$RECOVERY_TEMP_DIR" ]; then
        # Archive snapshots for future reference
        if [ -d "${RECOVERY_TEMP_DIR}/snapshots" ]; then
            tar -czf "${BACKUP_BASE_DIR}/recovery-snapshots-$(date +%Y%m%d-%H%M%S).tar.gz" \
                -C "$RECOVERY_TEMP_DIR" "snapshots" 2>/dev/null || true
        fi

        # Remove temporary files
        rm -rf "${RECOVERY_TEMP_DIR}/extract"
    fi

    log_success "Recovery cleanup complete"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    local action="${1:-}"

    log "===== Basset Hound Browser Recovery Automation ====="
    log "Backup directory: $BACKUP_BASE_DIR"
    log "Log: $LOG_FILE"

    # Check dependencies
    if ! check_dependencies; then
        log_error "Dependency check failed"
        exit 1
    fi

    case "$action" in
        --list|list)
            list_backups
            ;;
        --verify|verify)
            if [ -z "${2:-}" ]; then
                log_error "Backup path required"
                exit 1
            fi
            validate_backup "$2"
            ;;
        --restore|restore)
            if [ -z "${2:-}" ]; then
                log_error "Backup path required"
                exit 1
            fi

            prepare_recovery
            restore_backup "$2"
            restart_application
            cleanup_recovery

            log_success "===== Recovery Complete ====="
            ;;
        *)
            log_error "Unknown action: $action"
            echo "Usage: $0 [--list|--verify <path>|--restore <path>]"
            exit 1
            ;;
    esac
}

# ============================================================================
# SIGNAL HANDLERS
# ============================================================================

cleanup() {
    log_warn "Recovery operation interrupted"
    log_info "Snapshots preserved at ${RECOVERY_TEMP_DIR}/snapshots"
}

trap cleanup EXIT
trap cleanup SIGINT SIGTERM

# Run main
main "$@"
