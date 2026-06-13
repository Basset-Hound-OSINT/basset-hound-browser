#!/bin/bash
# Basset Hound Browser - Infrastructure Monitoring Script
# Monitors container health, resource usage, and application metrics
# Usage: ./infrastructure/scripts/infrastructure-monitoring.sh [--continuous|--report]

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CONTAINER_NAME="basset-hound-browser"
MONITORING_INTERVAL=10  # seconds
MONITORING_DURATION=600  # seconds (10 minutes for single run)

# Thresholds for alerting
CPU_THRESHOLD=80        # percent
MEMORY_THRESHOLD=85     # percent
DISK_THRESHOLD=90       # percent
ERROR_RATE_THRESHOLD=5  # percent

# Logging
LOG_FILE="${PROJECT_ROOT}/logs/monitoring-$(date +%Y%m%d-%H%M%S).log"
METRICS_FILE="${PROJECT_ROOT}/logs/metrics-$(date +%Y%m%d-%H%M%S).json"
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

log_metric() {
    echo "$*" >> "$METRICS_FILE"
}

# ============================================================================
# CONTAINER MONITORING
# ============================================================================

check_container_status() {
    local container=$1

    if ! docker ps -a | grep -q "$container"; then
        log_error "Container not found: $container"
        return 1
    fi

    local status=$(docker inspect -f '{{.State.Status}}' "$container")
    local health=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")

    echo "{\"status\": \"$status\", \"health\": \"$health\"}"
}

get_container_cpu_usage() {
    local container=$1

    # Get CPU stats using docker stats
    local stats=$(docker stats --no-stream "$container" 2>/dev/null | tail -1)
    if [ -z "$stats" ]; then
        echo "0"
        return
    fi

    # Extract CPU percentage (format: "container ID CPU% MemUsage/Limit MemPercent")
    local cpu_percent=$(echo "$stats" | awk '{print $2}' | sed 's/%//')
    echo "$cpu_percent"
}

get_container_memory_usage() {
    local container=$1

    local stats=$(docker stats --no-stream "$container" 2>/dev/null | tail -1)
    if [ -z "$stats" ]; then
        echo "0"
        return
    fi

    # Extract memory percentage
    local mem_percent=$(echo "$stats" | awk '{print $4}' | sed 's/%//')
    echo "$mem_percent"
}

get_container_network_stats() {
    local container=$1

    # Get network stats from docker inspect or calculate from logs
    local inspect=$(docker inspect "$container" 2>/dev/null)
    if [ -z "$inspect" ]; then
        echo "{\"rx_bytes\": 0, \"tx_bytes\": 0}"
        return
    fi

    # Parse network statistics (simplified)
    echo "{\"rx_bytes\": 0, \"tx_bytes\": 0}"
}

check_container_restarts() {
    local container=$1

    local restart_count=$(docker inspect -f '{{.RestartCount}}' "$container" 2>/dev/null || echo "0")
    echo "$restart_count"
}

# ============================================================================
# HEALTH CHECKS
# ============================================================================

check_websocket_connectivity() {
    local container=$1
    local port=8765

    if docker exec "$container" curl -s -o /dev/null -w "%{http_code}" http://localhost:${port} 2>/dev/null | grep -q "426"; then
        echo "true"
    else
        echo "false"
    fi
}

check_disk_space() {
    # Check disk space for container storage
    local docker_root=$(docker info -f '{{.DockerRootDir}}' 2>/dev/null || echo "/var/lib/docker")

    if [ -d "$docker_root" ]; then
        local usage=$(df "$docker_root" | tail -1 | awk '{print int(($3/$2)*100)}')
        echo "$usage"
    else
        echo "0"
    fi
}

check_system_load() {
    local load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}')
    echo "$load"
}

# ============================================================================
# MONITORING METRICS COLLECTION
# ============================================================================

collect_metrics() {
    local container=$1
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Check container status
    local status_json=$(check_container_status "$container")
    local status=$(echo "$status_json" | grep -o '"status": "[^"]*' | cut -d'"' -f4)
    local health=$(echo "$status_json" | grep -o '"health": "[^"]*' | cut -d'"' -f4)

    # CPU and Memory
    local cpu=$(get_container_cpu_usage "$container")
    local memory=$(get_container_memory_usage "$container")

    # Network
    local network_json=$(get_container_network_stats "$container")

    # Health checks
    local websocket=$(check_websocket_connectivity "$container")
    local restarts=$(check_container_restarts "$container")
    local disk=$(check_disk_space)
    local load=$(check_system_load)

    # Build metrics JSON
    local metrics_json=$(cat <<EOF
{
  "timestamp": "$timestamp",
  "container": "$container",
  "status": "$status",
  "health": "$health",
  "cpu_percent": $cpu,
  "memory_percent": $memory,
  "websocket_healthy": $websocket,
  "restart_count": $restarts,
  "disk_percent": $disk,
  "system_load": $load
}
EOF
)

    log_metric "$metrics_json"

    # Log summary
    log "Container: $container | Status: $status | Health: $health | CPU: ${cpu}% | Mem: ${memory}%"

    # Check thresholds
    if (( $(echo "$cpu > $CPU_THRESHOLD" | bc -l) )); then
        log_warn "CPU usage high: ${cpu}%"
    fi

    if (( $(echo "$memory > $MEMORY_THRESHOLD" | bc -l) )); then
        log_warn "Memory usage high: ${memory}%"
    fi

    if (( $(echo "$disk > $DISK_THRESHOLD" | bc -l) )); then
        log_warn "Disk usage high: ${disk}%"
    fi

    if [ "$websocket" = "false" ]; then
        log_error "WebSocket connectivity issue detected"
    fi

    echo "$metrics_json"
}

# ============================================================================
# CONTINUOUS MONITORING
# ============================================================================

continuous_monitoring() {
    local container=$1
    local duration=${2:-$MONITORING_DURATION}
    local elapsed=0

    log "===== Starting Continuous Monitoring ====="
    log "Container: $container"
    log "Duration: ${duration}s"
    log "Interval: ${MONITORING_INTERVAL}s"

    while [ $elapsed -lt $duration ]; do
        collect_metrics "$container"
        sleep "$MONITORING_INTERVAL"
        elapsed=$((elapsed + MONITORING_INTERVAL))
    done

    log_success "===== Continuous Monitoring Complete ====="
}

# ============================================================================
# MONITORING REPORT GENERATION
# ============================================================================

generate_monitoring_report() {
    local container=$1

    log "===== Generating Monitoring Report ====="

    # Create report header
    {
        echo "Basset Hound Browser - Infrastructure Monitoring Report"
        echo "Generated: $(date)"
        echo ""
        echo "Container: $container"
        echo ""
    } > "${METRICS_FILE%.json}-report.txt"

    # Single snapshot
    local metrics=$(collect_metrics "$container")

    # Extract and format metrics
    {
        echo "Current Status:"
        echo "  Status: $(echo "$metrics" | grep -o '"status": "[^"]*' | cut -d'"' -f4)"
        echo "  Health: $(echo "$metrics" | grep -o '"health": "[^"]*' | cut -d'"' -f4)"
        echo ""
        echo "Resource Usage:"
        echo "  CPU: $(echo "$metrics" | grep -o '"cpu_percent": [0-9.]*' | cut -d' ' -f2)%"
        echo "  Memory: $(echo "$metrics" | grep -o '"memory_percent": [0-9.]*' | cut -d' ' -f2)%"
        echo "  Disk: $(echo "$metrics" | grep -o '"disk_percent": [0-9.]*' | cut -d' ' -f2)%"
        echo ""
        echo "Health Checks:"
        echo "  WebSocket: $(echo "$metrics" | grep -o '"websocket_healthy": [^,]*' | cut -d' ' -f2)"
        echo "  Restarts: $(echo "$metrics" | grep -o '"restart_count": [0-9]*' | cut -d' ' -f2)"
        echo "  System Load: $(echo "$metrics" | grep -o '"system_load": "[^"]*' | cut -d'"' -f4)"
    } >> "${METRICS_FILE%.json}-report.txt"

    log_success "Report generated: ${METRICS_FILE%.json}-report.txt"
}

# ============================================================================
# ALERTING
# ============================================================================

send_alert() {
    local severity=$1
    local message=$2

    log_error "[ALERT - $severity] $message"

    # Integration points for external alerting systems:
    # - Slack: send to webhook
    # - PagerDuty: trigger incident
    # - Email: send notification
    # - Prometheus AlertManager: push metric

    # Example: Log to syslog
    if command -v logger &> /dev/null; then
        logger -t "basset-monitoring" -p "user.${severity,,}" "$message"
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    local action="${1:-report}"

    log "===== Basset Hound Browser Infrastructure Monitoring ====="
    log "Container: $CONTAINER_NAME"
    log "Log: $LOG_FILE"
    log "Metrics: $METRICS_FILE"

    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    # Check if container exists
    if ! docker ps -a | grep -q "$CONTAINER_NAME"; then
        log_error "Container not found: $CONTAINER_NAME"
        exit 1
    fi

    case "$action" in
        --continuous|continuous)
            continuous_monitoring "$CONTAINER_NAME" "${2:-$MONITORING_DURATION}"
            ;;
        --report|report|single)
            generate_monitoring_report "$CONTAINER_NAME"
            ;;
        *)
            log_error "Unknown action: $action"
            echo "Usage: $0 [--continuous [duration]|--report]"
            exit 1
            ;;
    esac

    log_success "Monitoring complete"
}

# ============================================================================
# SIGNAL HANDLERS
# ============================================================================

cleanup() {
    log_warn "Monitoring interrupted"
    log_info "Partial metrics available at $METRICS_FILE"
}

trap cleanup EXIT
trap cleanup SIGINT SIGTERM

# Run main
main "$@"
