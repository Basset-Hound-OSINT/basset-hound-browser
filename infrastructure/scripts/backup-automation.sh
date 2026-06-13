#!/bin/bash
# Basset Hound Browser - Backup Automation Script
# Performs incremental backups of application data, configurations, and databases
# Usage: ./infrastructure/scripts/backup-automation.sh [--full|--incremental|--verify]

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-${PROJECT_ROOT}/backups}"
BACKUP_TYPE="${BACKUP_TYPE:-incremental}"
BACKUP_RETENTION_DAYS=30
COMPRESSION_LEVEL=6  # 1-9, higher = better compression but slower

# Directories to backup
DATA_DIR="${PROJECT_ROOT}/data"
CONFIG_DIR="${PROJECT_ROOT}/config"
APP_DIR="${PROJECT_ROOT}/src"
LOGS_DIR="${PROJECT_ROOT}/logs"

# Container backup
CONTAINER_NAME="basset-hound-browser"
CONTAINER_DATA_DIR="/app/data"
CONTAINER_LOGS_DIR="/app/logs"

# Logging
LOG_FILE="${PROJECT_ROOT}/logs/backup-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "${LOG_FILE%/*}"

# Backup metadata
BACKUP_MANIFEST="${BACKUP_BASE_DIR}/MANIFEST.json"
INCREMENTAL_STATE="${BACKUP_BASE_DIR}/.incremental-state"

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

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

check_dependencies() {
    local deps=("tar" "gzip" "find" "date" "jq")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Missing dependency: $dep"
            return 1
        fi
    done
    log_success "All dependencies available"
}

get_docker_container_id() {
    docker ps -q -f "name=${CONTAINER_NAME}" 2>/dev/null || echo ""
}

create_backup_directories() {
    local backup_dir="$1"
    mkdir -p "$backup_dir"
    mkdir -p "${BACKUP_BASE_DIR}/logs"
    mkdir -p "${BACKUP_BASE_DIR}/configs"
    mkdir -p "${BACKUP_BASE_DIR}/data"
    log_success "Backup directories created: $backup_dir"
}

calculate_file_hash() {
    local file=$1
    if [ -f "$file" ]; then
        sha256sum "$file" | awk '{print $1}'
    else
        echo ""
    fi
}

create_manifest_entry() {
    local backup_path=$1
    local backup_type=$2
    local backup_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local file_count=$(find "$backup_path" -type f | wc -l)
    local total_size=$(du -sh "$backup_path" | awk '{print $1}')
    local checksum=$(calculate_file_hash "$backup_path")

    cat <<EOF
{
  "backup_path": "$backup_path",
  "backup_type": "$backup_type",
  "backup_date": "$backup_date",
  "file_count": $file_count,
  "total_size": "$total_size",
  "checksum": "$checksum"
}
EOF
}

# ============================================================================
# FULL BACKUP
# ============================================================================

perform_full_backup() {
    log "===== Performing Full Backup ====="

    local backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_dir="${BACKUP_BASE_DIR}/full-${backup_timestamp}"

    create_backup_directories "$backup_dir"

    # Backup application data
    if [ -d "$DATA_DIR" ]; then
        log "Backing up application data..."
        tar -czf "${backup_dir}/data-$(date +%Y%m%d-%H%M%S).tar.gz" \
            -C "${DATA_DIR%/*}" "$(basename "$DATA_DIR")" \
            --exclude='*.tmp' --exclude='.git'
        log_success "Application data backed up"
    fi

    # Backup configuration
    if [ -d "$CONFIG_DIR" ]; then
        log "Backing up configuration..."
        tar -czf "${backup_dir}/config-$(date +%Y%m%d-%H%M%S).tar.gz" \
            -C "${CONFIG_DIR%/*}" "$(basename "$CONFIG_DIR")"
        log_success "Configuration backed up"
    fi

    # Backup logs
    if [ -d "$LOGS_DIR" ]; then
        log "Backing up logs..."
        tar -czf "${backup_dir}/logs-$(date +%Y%m%d-%H%M%S).tar.gz" \
            -C "${LOGS_DIR%/*}" "$(basename "$LOGS_DIR")"
        log_success "Logs backed up"
    fi

    # Backup from container if running
    local container_id=$(get_docker_container_id)
    if [ -n "$container_id" ]; then
        log "Backing up container data..."
        docker exec "$CONTAINER_NAME" tar -czf - -C "$CONTAINER_DATA_DIR" . > \
            "${backup_dir}/container-data-$(date +%Y%m%d-%H%M%S).tar.gz" 2>/dev/null || true
        log_success "Container data backed up"
    fi

    # Create and update manifest
    create_manifest_entry "$backup_dir" "full" >> "$BACKUP_MANIFEST"

    log_success "Full backup completed: $backup_dir"
    echo "$backup_dir"
}

# ============================================================================
# INCREMENTAL BACKUP
# ============================================================================

perform_incremental_backup() {
    log "===== Performing Incremental Backup ====="

    local backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_dir="${BACKUP_BASE_DIR}/incremental-${backup_timestamp}"

    create_backup_directories "$backup_dir"

    # Create list of new/modified files since last backup
    local find_newer=""
    if [ -f "$INCREMENTAL_STATE" ]; then
        find_newer="-newer $INCREMENTAL_STATE"
    fi

    # Backup changed data
    if [ -d "$DATA_DIR" ]; then
        log "Backing up changed data..."
        find "$DATA_DIR" $find_newer -type f 2>/dev/null | \
            tar -czf "${backup_dir}/data-incremental-${backup_timestamp}.tar.gz" \
            -T - --exclude='*.tmp' 2>/dev/null || true
        log_success "Changed data backed up"
    fi

    # Backup changed configs
    if [ -d "$CONFIG_DIR" ]; then
        log "Backing up changed configuration..."
        find "$CONFIG_DIR" $find_newer -type f 2>/dev/null | \
            tar -czf "${backup_dir}/config-incremental-${backup_timestamp}.tar.gz" \
            -T - 2>/dev/null || true
        log_success "Changed configuration backed up"
    fi

    # Update incremental state
    touch "$INCREMENTAL_STATE"

    # Create and update manifest
    create_manifest_entry "$backup_dir" "incremental" >> "$BACKUP_MANIFEST"

    log_success "Incremental backup completed: $backup_dir"
    echo "$backup_dir"
}

# ============================================================================
# BACKUP VERIFICATION
# ============================================================================

verify_backup() {
    local backup_path=$1

    log "===== Verifying Backup: $backup_path ====="

    if [ ! -d "$backup_path" ]; then
        log_error "Backup directory not found: $backup_path"
        return 1
    fi

    local archive_count=$(find "$backup_path" -name "*.tar.gz" | wc -l)
    log_info "Found $archive_count archive files"

    if [ "$archive_count" -eq 0 ]; then
        log_error "No archive files found in backup"
        return 1
    fi

    # Test integrity of each archive
    local failed=0
    while IFS= read -r archive; do
        log "Testing archive: $(basename "$archive")"

        if tar -tzf "$archive" > /dev/null 2>&1; then
            log_success "Archive is valid: $(basename "$archive")"
        else
            log_error "Archive is corrupted: $(basename "$archive")"
            failed=$((failed + 1))
        fi
    done < <(find "$backup_path" -name "*.tar.gz")

    if [ $failed -gt 0 ]; then
        log_error "$failed archive(s) failed verification"
        return 1
    fi

    log_success "Backup verification passed"
    return 0
}

# ============================================================================
# BACKUP RETENTION AND CLEANUP
# ============================================================================

cleanup_old_backups() {
    log "===== Cleaning Up Old Backups ====="

    local cutoff_date=$(date -d "${BACKUP_RETENTION_DAYS} days ago" +%Y%m%d 2>/dev/null || \
                       date -v-${BACKUP_RETENTION_DAYS}d +%Y%m%d)

    local deleted_count=0
    while IFS= read -r backup_dir; do
        local backup_date=$(basename "$backup_dir" | grep -oE '[0-9]{8}' | head -1)

        if [ "$backup_date" -lt "$cutoff_date" ]; then
            log "Removing old backup: $backup_dir"
            rm -rf "$backup_dir"
            deleted_count=$((deleted_count + 1))
        fi
    done < <(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -name "full-*" -o -name "incremental-*")

    log_success "Deleted $deleted_count old backup(s)"
}

# ============================================================================
# BACKUP MONITORING
# ============================================================================

get_backup_statistics() {
    log "===== Backup Statistics ====="

    local total_backups=$(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d | wc -l)
    local total_size=$(du -sh "$BACKUP_BASE_DIR" 2>/dev/null | awk '{print $1}')
    local latest_backup=$(ls -trd "$BACKUP_BASE_DIR"/*/ 2>/dev/null | tail -1)

    log_info "Total backups: $((total_backups - 1))"
    log_info "Total size: $total_size"
    log_info "Latest backup: $(basename "${latest_backup%/*}")"

    if [ -f "$BACKUP_MANIFEST" ]; then
        local backup_count=$(grep -c '"backup_date"' "$BACKUP_MANIFEST" 2>/dev/null || echo "0")
        log_info "Documented backups: $backup_count"
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    local backup_action="${1:-$BACKUP_TYPE}"

    log "===== Basset Hound Browser Backup Automation ====="
    log "Action: $backup_action"
    log "Backup directory: $BACKUP_BASE_DIR"
    log "Log: $LOG_FILE"

    # Check dependencies
    if ! check_dependencies; then
        log_error "Dependency check failed"
        exit 1
    fi

    case "$backup_action" in
        --full|full)
            log "Performing full backup..."
            local backup_path=$(perform_full_backup)
            verify_backup "$backup_path"
            ;;
        --incremental|incremental)
            log "Performing incremental backup..."
            local backup_path=$(perform_incremental_backup)
            verify_backup "$backup_path"
            ;;
        --verify|verify)
            if [ -z "${2:-}" ]; then
                log_error "Backup path required for verification"
                exit 1
            fi
            verify_backup "$2"
            ;;
        *)
            log_error "Unknown action: $backup_action"
            echo "Usage: $0 [--full|--incremental|--verify <path>]"
            exit 1
            ;;
    esac

    # Cleanup old backups
    cleanup_old_backups

    # Display statistics
    get_backup_statistics

    log_success "===== Backup Complete ====="
}

# ============================================================================
# SIGNAL HANDLERS
# ============================================================================

cleanup() {
    log_info "Backup operation interrupted"
}

trap cleanup EXIT
trap cleanup SIGINT SIGTERM

# Run main
main "$@"
