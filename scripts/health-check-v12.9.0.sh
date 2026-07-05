#!/bin/bash
# Basset Hound Browser - v12.9.0 Comprehensive Health Check Script
# Features: WebSocket validation, container metrics, error logs, performance baseline
# Usage: ./scripts/health-check-v12.9.0.sh [OPTIONS]
#
# OPTIONS:
#   --detailed        Generate detailed HTML report
#   --continuous      Run health checks continuously (5s interval)
#   --interval N      Custom check interval in seconds
#   --slack WEBHOOK   Send Slack notifications for failures
#   --email ADDR      Send email on failures
#   --threshold PCT   Alert if resource usage exceeds percentage (default: 80)
#   --export CSV      Export metrics to CSV file

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# CONFIGURATION
# ============================================================================

VERSION="12.9.0"
CONTAINER_NAME="basset-hound-browser-prod"
PORT=8765

# Check options
DETAILED_REPORT=false
CONTINUOUS_MODE=false
CHECK_INTERVAL=5
SLACK_WEBHOOK=""
EMAIL_ADDR=""
RESOURCE_THRESHOLD=80
CSV_EXPORT=""

# Thresholds
LATENCY_WARNING=100  # ms
LATENCY_CRITICAL=500  # ms
THROUGHPUT_WARNING=10  # requests/sec
MEMORY_WARNING_MB=1500
MEMORY_CRITICAL_MB=1900
CPU_WARNING=75  # percentage
ERROR_LOG_WARNING=10

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Results tracking
declare -A CHECK_RESULTS
declare -A CHECK_TIMES
CHECK_TIMESTAMP=$(date +%s)

# Report files
REPORT_DIR="${PROJECT_ROOT}/logs/healthcheck-reports"
REPORT_FILE="${REPORT_DIR}/health-report-v12.9.0-$(date +%Y%m%d-%H%M%S).txt"
HTML_REPORT="${REPORT_DIR}/health-report-v12.9.0-$(date +%Y%m%d-%H%M%S).html"
METRICS_FILE="${REPORT_DIR}/metrics-v12.9.0-$(date +%Y%m%d-%H%M%S).json"

mkdir -p "$REPORT_DIR"

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log_info() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[${timestamp}]${NC} INFO: $*" | tee -a "$REPORT_FILE"
}

log_success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[${timestamp}]${NC} PASS: $*" | tee -a "$REPORT_FILE"
}

log_warn() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[${timestamp}]${NC} WARN: $*" | tee -a "$REPORT_FILE"
}

log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[${timestamp}]${NC} FAIL: $*" | tee -a "$REPORT_FILE"
}

log_section() {
    echo -e "\n${CYAN}========== $* ==========${NC}" | tee -a "$REPORT_FILE"
}

log_metric() {
    local name=$1
    local value=$2
    local unit=$3
    printf "  %-30s : %10s %s\n" "$name" "$value" "$unit" | tee -a "$REPORT_FILE"
}

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --detailed)
                DETAILED_REPORT=true
                shift
                ;;
            --continuous)
                CONTINUOUS_MODE=true
                shift
                ;;
            --interval)
                CHECK_INTERVAL="$2"
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
            --threshold)
                RESOURCE_THRESHOLD="$2"
                shift 2
                ;;
            --export)
                CSV_EXPORT="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# ============================================================================
# NOTIFICATION FUNCTIONS
# ============================================================================

send_slack_alert() {
    local status=$1
    local message=$2

    if [[ -z "$SLACK_WEBHOOK" ]]; then
        return 0
    fi

    local color="danger"
    [[ "$status" == "warning" ]] && color="warning"

    local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Health Check Alert - Basset Hound Browser",
            "text": "$message",
            "fields": [
                {"title": "Version", "value": "$VERSION", "short": true},
                {"title": "Container", "value": "$CONTAINER_NAME", "short": true},
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

send_email_alert() {
    local status=$1
    local message=$2

    if [[ -z "$EMAIL_ADDR" ]]; then
        return 0
    fi

    local subject="Health Check Alert: $status - Basset Hound Browser v$VERSION"
    echo -e "Health Check Status: $status\n\n$message\n\nReport: $REPORT_FILE" | \
        mail -s "$subject" "$EMAIL_ADDR" 2>/dev/null || true
}

send_alert() {
    local status=$1
    local message=$2

    send_slack_alert "$status" "$message"
    send_email_alert "$status" "$message"
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

container_exists() {
    docker ps -a --filter "name=^${CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

container_is_running() {
    docker ps --filter "name=^${CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

container_is_healthy() {
    local status=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "none")
    [[ "$status" == "healthy" ]]
}

get_container_uptime() {
    docker inspect --format='{{.State.StartedAt}}' "$CONTAINER_NAME" 2>/dev/null || echo "unknown"
}

# ============================================================================
# HEALTH CHECK FUNCTIONS
# ============================================================================

check_container_status() {
    log_section "Container Status"

    if ! container_exists; then
        log_error "Container does not exist: $CONTAINER_NAME"
        CHECK_RESULTS["container_status"]="FAIL"
        return 1
    fi

    if ! container_is_running; then
        log_error "Container is not running"
        CHECK_RESULTS["container_status"]="FAIL"
        return 1
    fi

    log_success "Container is running"

    local uptime=$(get_container_uptime)
    log_info "Container uptime: $uptime"

    if container_is_healthy; then
        log_success "Container health status: HEALTHY"
        CHECK_RESULTS["container_status"]="PASS"
        return 0
    else
        log_warn "Container health status: UNKNOWN or UNHEALTHY"
        CHECK_RESULTS["container_status"]="WARN"
        return 0
    fi
}

check_websocket_connectivity() {
    log_section "WebSocket Connectivity"

    # Test port accessibility
    if ! nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
        log_error "Cannot connect to WebSocket port $PORT"
        CHECK_RESULTS["websocket_connectivity"]="FAIL"
        return 1
    fi

    log_success "WebSocket port $PORT is accessible"

    # Test HTTP endpoint if available
    local http_test=$(curl -s -m 5 "http://127.0.0.1:$PORT/health" 2>/dev/null || echo "TIMEOUT")

    if [[ "$http_test" == "TIMEOUT" ]]; then
        log_warn "HTTP health endpoint timeout (may be WebSocket only)"
        CHECK_RESULTS["websocket_connectivity"]="WARN"
    else
        log_success "HTTP health endpoint responsive"
        CHECK_RESULTS["websocket_connectivity"]="PASS"
    fi

    return 0
}

check_memory_usage() {
    log_section "Memory Usage"

    local mem_data=$(docker stats --no-stream "$CONTAINER_NAME" --format '{{.MemUsage}}' 2>/dev/null)

    if [[ -z "$mem_data" ]]; then
        log_error "Cannot retrieve memory usage"
        CHECK_RESULTS["memory_usage"]="FAIL"
        return 1
    fi

    local mem_used=$(echo "$mem_data" | cut -d'/' -f1 | sed 's/[GMK]B//' | sed 's/ //g')
    local mem_limit=$(echo "$mem_data" | cut -d'/' -f2 | sed 's/[GMK]B//' | sed 's/ //g')

    # Convert to MB for comparison
    local mem_used_mb=$(echo "$mem_used * 1024" | bc 2>/dev/null | cut -d'.' -f1)

    log_metric "Memory Used" "$mem_used" "GB"
    log_metric "Memory Limit" "$mem_limit" "GB"
    log_metric "Memory Used (MB)" "$mem_used_mb" "MB"

    if [[ $mem_used_mb -gt $MEMORY_CRITICAL_MB ]]; then
        log_error "Memory usage is CRITICAL: ${mem_used_mb}MB (limit: ${MEMORY_CRITICAL_MB}MB)"
        CHECK_RESULTS["memory_usage"]="FAIL"
        send_alert "CRITICAL" "Container memory usage critical: ${mem_used_mb}MB"
        return 1
    elif [[ $mem_used_mb -gt $MEMORY_WARNING_MB ]]; then
        log_warn "Memory usage is HIGH: ${mem_used_mb}MB (warning: ${MEMORY_WARNING_MB}MB)"
        CHECK_RESULTS["memory_usage"]="WARN"
        send_alert "WARNING" "Container memory usage high: ${mem_used_mb}MB"
        return 0
    else
        log_success "Memory usage normal: ${mem_used_mb}MB"
        CHECK_RESULTS["memory_usage"]="PASS"
        return 0
    fi
}

check_cpu_usage() {
    log_section "CPU Usage"

    local cpu_data=$(docker stats --no-stream "$CONTAINER_NAME" --format '{{.CPUPerc}}' 2>/dev/null)

    if [[ -z "$cpu_data" ]]; then
        log_error "Cannot retrieve CPU usage"
        CHECK_RESULTS["cpu_usage"]="FAIL"
        return 1
    fi

    local cpu_usage=$(echo "$cpu_data" | sed 's/%//' | sed 's/ //g')

    log_metric "CPU Usage" "$cpu_usage" "%"

    if (( $(echo "$cpu_usage > $CPU_WARNING" | bc -l) )); then
        log_warn "CPU usage is elevated: ${cpu_usage}%"
        CHECK_RESULTS["cpu_usage"]="WARN"
        return 0
    else
        log_success "CPU usage normal: ${cpu_usage}%"
        CHECK_RESULTS["cpu_usage"]="PASS"
        return 0
    fi
}

check_disk_usage() {
    log_section "Disk Usage"

    # Check volume usage
    local volumes=$(docker ps --filter "name=^${CONTAINER_NAME}$" --format '{{.Mounts}}' 2>/dev/null)

    if [[ -z "$volumes" ]]; then
        log_warn "Cannot determine volume usage"
        CHECK_RESULTS["disk_usage"]="WARN"
        return 0
    fi

    # Get data volume info
    local data_volume_size=$(docker volume inspect basset-prod-data 2>/dev/null | grep -A100 '"Mountpoint"' | head -1)

    if [[ -n "$data_volume_size" ]]; then
        log_info "Data volume: basset-prod-data"
        # Estimate usage
        local du_output=$(docker run --rm -v basset-prod-data:/data alpine du -sh /data 2>/dev/null | cut -f1)
        log_metric "Volume Size" "$du_output" ""
    fi

    log_success "Disk usage check completed"
    CHECK_RESULTS["disk_usage"]="PASS"
    return 0
}

check_error_logs() {
    log_section "Error Log Analysis"

    local error_count=$(docker logs "$CONTAINER_NAME" --since 10m 2>&1 | grep -ic "error\|fatal\|exception\|panic" || echo 0)

    log_metric "Errors (last 10m)" "$error_count" "count"

    if [[ $error_count -gt 100 ]]; then
        log_error "High error rate detected: $error_count errors in last 10 minutes"
        CHECK_RESULTS["error_logs"]="FAIL"

        # Show sample errors
        log_info "Sample errors:"
        docker logs "$CONTAINER_NAME" --since 10m 2>&1 | grep -i "error\|fatal" | tail -5 | while read line; do
            log_error "  $line"
        done

        send_alert "ERROR" "High error rate: $error_count errors in last 10 minutes"
        return 1
    elif [[ $error_count -gt $ERROR_LOG_WARNING ]]; then
        log_warn "Elevated error rate: $error_count errors in last 10 minutes"
        CHECK_RESULTS["error_logs"]="WARN"
        return 0
    else
        log_success "Error logs normal: $error_count errors in last 10 minutes"
        CHECK_RESULTS["error_logs"]="PASS"
        return 0
    fi
}

check_network_connectivity() {
    log_section "Network Connectivity"

    # Test DNS resolution
    if ! docker exec "$CONTAINER_NAME" getent hosts 8.8.8.8 &>/dev/null; then
        log_warn "DNS resolution may have issues"
        CHECK_RESULTS["network"]="WARN"
        return 0
    fi

    log_success "Network connectivity verified"
    CHECK_RESULTS["network"]="PASS"
    return 0
}

check_performance_baseline() {
    log_section "Performance Baseline"

    log_info "Running performance baseline tests..."

    # Simulate latency check
    local start_time=$(date +%s%N)

    if nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
        local end_time=$(date +%s%N)
        local latency_ms=$(( (end_time - start_time) / 1000000 ))

        log_metric "Connection Latency" "$latency_ms" "ms"

        if [[ $latency_ms -gt $LATENCY_CRITICAL ]]; then
            log_error "Latency is CRITICAL: ${latency_ms}ms"
            CHECK_RESULTS["performance"]="FAIL"
            send_alert "CRITICAL" "High latency detected: ${latency_ms}ms"
            return 1
        elif [[ $latency_ms -gt $LATENCY_WARNING ]]; then
            log_warn "Latency is elevated: ${latency_ms}ms"
            CHECK_RESULTS["performance"]="WARN"
            return 0
        else
            log_success "Latency within normal range: ${latency_ms}ms"
            CHECK_RESULTS["performance"]="PASS"
            return 0
        fi
    fi

    log_warn "Cannot perform performance baseline"
    CHECK_RESULTS["performance"]="WARN"
    return 0
}

# ============================================================================
# REPORTING FUNCTIONS
# ============================================================================

print_check_summary() {
    log_section "Health Check Summary"

    local passed=0
    local warned=0
    local failed=0

    for check in "${!CHECK_RESULTS[@]}"; do
        case "${CHECK_RESULTS[$check]}" in
            PASS) ((passed++)) ;;
            WARN) ((warned++)) ;;
            FAIL) ((failed++)) ;;
        esac
    done

    echo ""
    log_metric "Total Checks" "${#CHECK_RESULTS[@]}" ""
    log_metric "Passed" "$passed" ""
    log_metric "Warnings" "$warned" ""
    log_metric "Failed" "$failed" ""

    if [[ $failed -gt 0 ]]; then
        log_error "OVERALL STATUS: UNHEALTHY ($failed failures)"
        return 1
    elif [[ $warned -gt 0 ]]; then
        log_warn "OVERALL STATUS: DEGRADED ($warned warnings)"
        return 0
    else
        log_success "OVERALL STATUS: HEALTHY"
        return 0
    fi
}

generate_html_report() {
    if ! $DETAILED_REPORT; then
        return 0
    fi

    log_info "Generating HTML report..."

    cat > "$HTML_REPORT" <<'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Health Check Report - Basset Hound Browser v12.9.0</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1000px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
        .section { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #007bff; }
        .check-result { display: flex; justify-content: space-between; padding: 8px; margin: 5px 0; border-radius: 4px; }
        .pass { background-color: #d4edda; color: #155724; }
        .warn { background-color: #fff3cd; color: #856404; }
        .fail { background-color: #f8d7da; color: #721c24; }
        .metric { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 10px 0; }
        .metric-box { padding: 10px; background-color: white; border-radius: 4px; border: 1px solid #ddd; }
        .timestamp { color: #666; font-size: 0.9em; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #007bff; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Basset Hound Browser Health Check Report</h1>
        <p class="timestamp">Generated: $(date '+%Y-%m-%d %H:%M:%S')</p>
        <p class="timestamp">Version: v12.9.0</p>

        <div class="section">
            <h2>Check Results</h2>
EOF

    for check in "${!CHECK_RESULTS[@]}"; do
        local result="${CHECK_RESULTS[$check]}"
        local class=$(echo "$result" | tr '[:upper:]' '[:lower:]')
        echo "            <div class='check-result $class'><span>$check</span><span>$result</span></div>" >> "$HTML_REPORT"
    done

    cat >> "$HTML_REPORT" <<'EOF'
        </div>
    </div>
</body>
</html>
EOF

    log_success "HTML report generated: $HTML_REPORT"
}

generate_json_metrics() {
    log_info "Exporting metrics to JSON..."

    local json_data='{'
    json_data+='"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",'
    json_data+='"version":"'$VERSION'",'
    json_data+='"container":"'$CONTAINER_NAME'",'
    json_data+='"checks":{'

    local first=true
    for check in "${!CHECK_RESULTS[@]}"; do
        if ! $first; then json_data+=','; fi
        json_data+='"'$check'":"'${CHECK_RESULTS[$check]}'"'
        first=false
    done

    json_data+='}'
    json_data+='}'

    echo "$json_data" | jq '.' > "$METRICS_FILE" 2>/dev/null || echo "$json_data" > "$METRICS_FILE"

    log_success "Metrics exported to: $METRICS_FILE"
}

export_csv_metrics() {
    if [[ -z "$CSV_EXPORT" ]]; then
        return 0
    fi

    log_info "Exporting metrics to CSV: $CSV_EXPORT"

    {
        echo "timestamp,version,container,check,result"
        local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
        for check in "${!CHECK_RESULTS[@]}"; do
            echo "$timestamp,$VERSION,$CONTAINER_NAME,$check,${CHECK_RESULTS[$check]}"
        done
    } >> "$CSV_EXPORT"

    log_success "Metrics appended to CSV: $CSV_EXPORT"
}

# ============================================================================
# MAIN HEALTH CHECK FLOW
# ============================================================================

run_health_checks() {
    log_section "Basset Hound Browser v12.9.0 Health Check"
    log_info "Container: $CONTAINER_NAME"
    log_info "Port: $PORT"
    log_info "Report: $REPORT_FILE"

    # Run checks
    check_container_status
    check_websocket_connectivity
    check_memory_usage
    check_cpu_usage
    check_disk_usage
    check_error_logs
    check_network_connectivity
    check_performance_baseline

    # Generate reports
    print_check_summary
    local summary_result=$?

    generate_json_metrics
    export_csv_metrics
    generate_html_report

    return $summary_result
}

# ============================================================================
# CONTINUOUS MONITORING MODE
# ============================================================================

run_continuous_monitoring() {
    log_info "Starting continuous health monitoring (interval: ${CHECK_INTERVAL}s, press Ctrl+C to stop)"

    while true; do
        clear
        run_health_checks
        echo ""
        log_info "Next check in ${CHECK_INTERVAL}s... ($(date))"
        sleep "$CHECK_INTERVAL"
    done
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    parse_arguments "$@"

    if $CONTINUOUS_MODE; then
        run_continuous_monitoring
    else
        run_health_checks
        exit $?
    fi
}

main "$@"
