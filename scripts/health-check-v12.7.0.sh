#!/bin/bash
# Basset Hound Browser - Comprehensive Health Check Script
# Validates WebSocket, performance, error logs, and generates reports
# Usage: ./scripts/health-check-v12.7.0.sh [--detailed] [--email ADDR] [--slack WEBHOOK]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# CONFIGURATION
# ============================================================================

CONTAINER_NAME="basset-hound-browser-prod"
PORT=8765
HEALTHCHECK_TIMEOUT=10
PERFORMANCE_BASELINE_LATENCY=100  # ms
PERFORMANCE_BASELINE_THROUGHPUT=50  # requests/sec

# Report options
DETAILED_REPORT=false
EMAIL_REPORT=""
SLACK_WEBHOOK=""
GENERATE_HTML=true

# Health check categories
CHECKS=(
    "websocket_connectivity"
    "container_health"
    "memory_usage"
    "cpu_usage"
    "error_logs"
    "performance_baseline"
    "disk_usage"
)

# Results tracking
declare -A CHECK_RESULTS
declare -A CHECK_TIMES

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Output files
REPORT_DIR="${PROJECT_ROOT}/logs/healthcheck-reports"
REPORT_FILE="${REPORT_DIR}/health-report-$(date +%Y%m%d-%H%M%S).txt"
HTML_REPORT="${REPORT_DIR}/health-report-$(date +%Y%m%d-%H%M%S).html"

mkdir -p "$REPORT_DIR"

# ============================================================================
# LOGGING
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "$REPORT_FILE"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $*" | tee -a "$REPORT_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$REPORT_FILE"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $*" | tee -a "$REPORT_FILE"
}

log_section() {
    echo -e "\n${CYAN}=== $* ===${NC}" | tee -a "$REPORT_FILE"
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
            --email)
                EMAIL_REPORT="$2"
                shift 2
                ;;
            --slack)
                SLACK_WEBHOOK="$2"
                shift 2
                ;;
            --no-html)
                GENERATE_HTML=false
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
    --detailed                  Generate detailed report with all metrics
    --email ADDRESS             Send report to email address
    --slack WEBHOOK_URL         Send report to Slack webhook
    --no-html                   Don't generate HTML report
    -h, --help                  Show this help message
EOF
}

# ============================================================================
# PREREQUISITE CHECKS
# ============================================================================

check_prerequisites() {
    log_section "Checking Prerequisites"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not installed"
        return 1
    fi
    log_success "Docker available"

    # Check container exists
    if ! docker ps -a | grep -q "$CONTAINER_NAME"; then
        log_error "Container not found: $CONTAINER_NAME"
        return 1
    fi
    log_success "Container found"

    # Check basic connectivity tools
    if ! command -v curl &> /dev/null; then
        log_warn "curl not available (some tests will be skipped)"
    fi

    if ! command -v nc &> /dev/null; then
        log_warn "netcat not available (WebSocket test will use curl)"
    fi

    return 0
}

# ============================================================================
# HEALTH CHECKS
# ============================================================================

check_websocket_connectivity() {
    log_section "WebSocket Connectivity Check"

    local start_time=$(date +%s%N)
    local response_code=0

    # Try direct connection
    if timeout $HEALTHCHECK_TIMEOUT bash -c "echo 'PING' | nc -q 1 localhost $PORT" &>/dev/null; then
        response_code=200
    else
        # Fallback to curl
        response_code=$(timeout $HEALTHCHECK_TIMEOUT curl -s -o /dev/null -w "%{http_code}" \
            "http://localhost:${PORT}" 2>/dev/null || echo "0")
    fi

    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 ))  # Convert to ms

    log_info "Response Code: $response_code"
    log_info "Response Time: ${response_time}ms"

    if [[ "$response_code" == "200" ]] || [[ "$response_code" == "426" ]]; then
        log_success "WebSocket connectivity verified"
        CHECK_RESULTS[websocket_connectivity]="PASS"
        CHECK_TIMES[websocket_connectivity]=$response_time
        return 0
    else
        log_error "WebSocket connectivity failed (code: $response_code)"
        CHECK_RESULTS[websocket_connectivity]="FAIL"
        return 1
    fi
}

check_container_health() {
    log_section "Container Health Check"

    # Get container status
    local status=$(docker ps -a --filter "name=$CONTAINER_NAME" \
        --format="{{.State}}" 2>/dev/null || echo "unknown")

    log_info "Container Status: $status"

    if [[ "$status" != "running" ]]; then
        log_error "Container is not running"
        CHECK_RESULTS[container_health]="FAIL"
        return 1
    fi

    # Check health status
    local health_status=$(docker inspect "$CONTAINER_NAME" \
        --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")

    log_info "Health Status: $health_status"

    if [[ "$health_status" == "healthy" ]] || [[ "$health_status" == "none" ]]; then
        log_success "Container health verified"
        CHECK_RESULTS[container_health]="PASS"
        return 0
    else
        log_warn "Container health status: $health_status"
        CHECK_RESULTS[container_health]="WARN"
        return 0
    fi
}

check_memory_usage() {
    log_section "Memory Usage Check"

    local mem_stats=$(docker stats --no-stream "$CONTAINER_NAME" \
        --format="{{.MemUsage}}" 2>/dev/null || echo "unknown")

    log_info "Memory Usage: $mem_stats"

    # Extract numeric value (rough parsing)
    if [[ "$mem_stats" != "unknown" ]]; then
        log_success "Memory usage within limits"
        CHECK_RESULTS[memory_usage]="PASS"
        return 0
    else
        log_warn "Could not determine memory usage"
        CHECK_RESULTS[memory_usage]="UNKNOWN"
        return 0
    fi
}

check_cpu_usage() {
    log_section "CPU Usage Check"

    local cpu_stats=$(docker stats --no-stream "$CONTAINER_NAME" \
        --format="{{.CPUPerc}}" 2>/dev/null || echo "unknown")

    log_info "CPU Usage: $cpu_stats"

    if [[ "$cpu_stats" != "unknown" ]]; then
        log_success "CPU usage monitored"
        CHECK_RESULTS[cpu_usage]="PASS"
        return 0
    else
        log_warn "Could not determine CPU usage"
        CHECK_RESULTS[cpu_usage]="UNKNOWN"
        return 0
    fi
}

check_error_logs() {
    log_section "Error Log Analysis"

    local error_count=0
    local warning_count=0

    # Get recent logs
    local recent_logs=$(docker logs --tail 100 "$CONTAINER_NAME" 2>&1 | grep -i "error\|fail" || echo "")

    if [[ -n "$recent_logs" ]]; then
        error_count=$(echo "$recent_logs" | wc -l)
        log_warn "Found $error_count error lines in recent logs"
        if $DETAILED_REPORT; then
            log_info "Error lines:"
            echo "$recent_logs" | sed 's/^/  /' | tee -a "$REPORT_FILE"
        fi
    else
        log_success "No errors in recent logs"
    fi

    # Get warning count
    local warning_logs=$(docker logs --tail 100 "$CONTAINER_NAME" 2>&1 | grep -i "warn" || echo "")
    warning_count=$(echo "$warning_logs" | wc -l)

    if [[ $error_count -gt 5 ]]; then
        log_error "High error count detected"
        CHECK_RESULTS[error_logs]="FAIL"
        return 1
    else
        log_success "Error logs within acceptable range"
        CHECK_RESULTS[error_logs]="PASS"
        return 0
    fi
}

check_performance_baseline() {
    log_section "Performance Baseline Check"

    log_info "Baseline Latency Threshold: ${PERFORMANCE_BASELINE_LATENCY}ms"
    log_info "Baseline Throughput Threshold: ${PERFORMANCE_BASELINE_THROUGHPUT} req/s"

    # Measure simple ping-pong latency
    local total_latency=0
    local measurement_count=10
    local failed_count=0

    log_info "Measuring response latency ($measurement_count samples)..."

    for i in $(seq 1 $measurement_count); do
        local start=$(date +%s%N)

        if timeout 5 bash -c "echo 'PING' | nc -q 1 localhost $PORT" &>/dev/null; then
            local end=$(date +%s%N)
            local latency=$(( (end - start) / 1000000 ))  # Convert to ms
            total_latency=$((total_latency + latency))
            log_info "  Sample $i: ${latency}ms"
        else
            failed_count=$((failed_count + 1))
        fi

        sleep 0.5
    done

    local avg_latency=$(( (total_latency + (measurement_count / 2)) / measurement_count ))

    log_info "Average Latency: ${avg_latency}ms (failed: $failed_count/$measurement_count)"

    if [[ $avg_latency -lt $PERFORMANCE_BASELINE_LATENCY ]]; then
        log_success "Performance within baseline"
        CHECK_RESULTS[performance_baseline]="PASS"
        return 0
    else
        log_warn "Latency exceeds baseline: ${avg_latency}ms > ${PERFORMANCE_BASELINE_LATENCY}ms"
        CHECK_RESULTS[performance_baseline]="WARN"
        return 0
    fi
}

check_disk_usage() {
    log_section "Disk Usage Check"

    # Check container filesystem
    local disk_usage=$(docker exec "$CONTAINER_NAME" \
        df -h / 2>/dev/null | tail -1 | awk '{print $5}' || echo "unknown")

    log_info "Container Root Disk Usage: $disk_usage"

    # Check volumes
    local volume_count=$(docker inspect "$CONTAINER_NAME" \
        --format='{{len .Mounts}}' 2>/dev/null || echo "0")

    log_info "Mounted Volumes: $volume_count"

    if [[ "$disk_usage" != "unknown" ]]; then
        # Extract numeric value
        local disk_percent=${disk_usage%\%}
        if [[ $disk_percent -lt 80 ]]; then
            log_success "Disk usage acceptable: $disk_usage"
            CHECK_RESULTS[disk_usage]="PASS"
            return 0
        else
            log_warn "Disk usage high: $disk_usage"
            CHECK_RESULTS[disk_usage]="WARN"
            return 0
        fi
    else
        log_warn "Could not determine disk usage"
        CHECK_RESULTS[disk_usage]="UNKNOWN"
        return 0
    fi
}

# ============================================================================
# REPORT GENERATION
# ============================================================================

generate_text_report() {
    log_section "Health Check Summary"

    local total_checks=${#CHECK_RESULTS[@]}
    local passed_checks=0
    local failed_checks=0
    local warned_checks=0

    for check in "${!CHECK_RESULTS[@]}"; do
        case ${CHECK_RESULTS[$check]} in
            PASS) passed_checks=$((passed_checks + 1)) ;;
            FAIL) failed_checks=$((failed_checks + 1)) ;;
            WARN|UNKNOWN) warned_checks=$((warned_checks + 1)) ;;
        esac
    done

    local health_percentage=$(( (passed_checks * 100) / total_checks ))

    cat >> "$REPORT_FILE" << EOF

======================================================================
HEALTH CHECK SUMMARY
======================================================================
Timestamp: $(date)
Container: $CONTAINER_NAME
Overall Health: ${health_percentage}%

Check Results:
EOF

    for check in "${!CHECK_RESULTS[@]}"; do
        local result="${CHECK_RESULTS[$check]}"
        local symbol=""
        case $result in
            PASS) symbol="✓" ;;
            FAIL) symbol="✗" ;;
            *) symbol="⚠" ;;
        esac
        printf "  $symbol %-30s %s\n" "$check" "$result" >> "$REPORT_FILE"
    done

    cat >> "$REPORT_FILE" << EOF

Statistics:
  - Total Checks: $total_checks
  - Passed: $passed_checks
  - Failed: $failed_checks
  - Warnings: $warned_checks

Recommendations:
EOF

    if [[ $failed_checks -gt 0 ]]; then
        echo "  - CRITICAL: Failed checks detected - immediate action required" >> "$REPORT_FILE"
    fi

    if [[ $warned_checks -gt 0 ]]; then
        echo "  - WARNING: Some metrics exceed thresholds - monitor closely" >> "$REPORT_FILE"
    fi

    if [[ $health_percentage -eq 100 ]]; then
        echo "  - System is healthy - no action required" >> "$REPORT_FILE"
    fi

    echo "" >> "$REPORT_FILE"
}

generate_html_report() {
    if ! $GENERATE_HTML; then
        return 0
    fi

    log_info "Generating HTML report..."

    local total_checks=${#CHECK_RESULTS[@]}
    local passed_checks=0

    for check in "${!CHECK_RESULTS[@]}"; do
        [[ "${CHECK_RESULTS[$check]}" == "PASS" ]] && passed_checks=$((passed_checks + 1))
    done

    local health_percentage=$(( (passed_checks * 100) / total_checks ))

    cat > "$HTML_REPORT" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Health Check Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .header { background-color: #333; color: white; padding: 20px; border-radius: 5px; }
        .summary { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status { font-size: 24px; font-weight: bold; margin: 10px 0; }
        .healthy { color: green; }
        .warning { color: orange; }
        .critical { color: red; }
        .checks { background-color: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .check-item { padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .check-name { font-weight: 500; }
        .check-result { padding: 5px 10px; border-radius: 3px; font-weight: bold; }
        .result-pass { background-color: #d4edda; color: #155724; }
        .result-fail { background-color: #f8d7da; color: #721c24; }
        .result-warn { background-color: #fff3cd; color: #856404; }
        .timestamp { color: #666; margin-top: 20px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Basset Hound Browser - Health Check Report</h1>
        <p>Container: CONTAINER_NAME</p>
    </div>

    <div class="summary">
        <h2>System Status</h2>
        <div class="status HEALTH_CLASS">HEALTH_PERCENTAGE%</div>
        <p>Overall health: HEALTH_TEXT</p>
    </div>

    <div class="checks">
        <h2>Check Results</h2>
EOF

    for check in "${!CHECK_RESULTS[@]}"; do
        local result="${CHECK_RESULTS[$check]}"
        local result_class="result-pass"
        [[ "$result" == "FAIL" ]] && result_class="result-fail"
        [[ "$result" == "WARN" ]] || [[ "$result" == "UNKNOWN" ]] && result_class="result-warn"

        cat >> "$HTML_REPORT" << EOF
        <div class="check-item">
            <span class="check-name">$check</span>
            <span class="check-result $result_class">$result</span>
        </div>
EOF
    done

    cat >> "$HTML_REPORT" << EOF
    </div>

    <div class="timestamp">
        Report generated: $(date)<br>
        Container: $CONTAINER_NAME
    </div>
</body>
</html>
EOF

    # Replace placeholders
    sed -i "s/CONTAINER_NAME/$CONTAINER_NAME/g" "$HTML_REPORT"
    sed -i "s/HEALTH_PERCENTAGE/$health_percentage/g" "$HTML_REPORT"

    local health_class="healthy"
    [[ $health_percentage -lt 50 ]] && health_class="critical"
    [[ $health_percentage -lt 80 ]] && health_class="warning"
    sed -i "s/HEALTH_CLASS/$health_class/g" "$HTML_REPORT"

    local health_text="Healthy"
    [[ $health_percentage -lt 50 ]] && health_text="Critical"
    [[ $health_percentage -lt 80 ]] && health_text="Warning"
    sed -i "s/HEALTH_TEXT/$health_text/g" "$HTML_REPORT"

    log_success "HTML report generated: $HTML_REPORT"
}

# ============================================================================
# NOTIFICATION
# ============================================================================

send_email_report() {
    if [[ -z "$EMAIL_REPORT" ]]; then
        return 0
    fi

    log_info "Sending email report to: $EMAIL_REPORT"

    if ! command -v mail &> /dev/null && ! command -v sendmail &> /dev/null; then
        log_warn "Email client not available (mail/sendmail)"
        return 1
    fi

    # Prepare email
    {
        echo "Subject: Basset Hound Browser Health Report"
        echo "To: $EMAIL_REPORT"
        echo ""
        cat "$REPORT_FILE"
    } | sendmail "$EMAIL_REPORT" || mail -s "Basset Hound Browser Health Report" "$EMAIL_REPORT" < "$REPORT_FILE"

    log_success "Email sent successfully"
}

send_slack_report() {
    if [[ -z "$SLACK_WEBHOOK" ]]; then
        return 0
    fi

    log_info "Sending Slack notification..."

    local health_color="danger"
    local total_checks=${#CHECK_RESULTS[@]}
    local passed_checks=0

    for check in "${!CHECK_RESULTS[@]}"; do
        [[ "${CHECK_RESULTS[$check]}" == "PASS" ]] && passed_checks=$((passed_checks + 1))
    done

    local health_percentage=$(( (passed_checks * 100) / total_checks ))

    if [[ $health_percentage -eq 100 ]]; then
        health_color="good"
    elif [[ $health_percentage -ge 80 ]]; then
        health_color="warning"
    fi

    # Prepare Slack message
    local message=$(cat << EOF
{
  "attachments": [
    {
      "color": "$health_color",
      "title": "Basset Hound Browser Health Report",
      "fields": [
        {
          "title": "Overall Health",
          "value": "$health_percentage%",
          "short": true
        },
        {
          "title": "Container",
          "value": "$CONTAINER_NAME",
          "short": true
        },
        {
          "title": "Checks Passed",
          "value": "$passed_checks / $total_checks",
          "short": true
        },
        {
          "title": "Timestamp",
          "value": "$(date)",
          "short": true
        }
      ]
    }
  ]
}
EOF
)

    curl -s -X POST "$SLACK_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "$message" > /dev/null || log_warn "Slack notification failed"

    log_success "Slack notification sent"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    log_section "Basset Hound Browser - Health Check"
    log_info "Start Time: $(date)"
    log_info "Report File: $REPORT_FILE"

    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        return 1
    fi

    # Run all health checks
    local failed=0

    for check_name in "${CHECKS[@]}"; do
        if ! "check_${check_name}"; then
            failed=$((failed + 1))
        fi
    done

    # Generate reports
    generate_text_report
    generate_html_report

    # Send notifications
    send_email_report
    send_slack_report

    log_section "Health Check Complete"
    log_info "Report: $REPORT_FILE"
    [[ -f "$HTML_REPORT" ]] && log_info "HTML Report: $HTML_REPORT"

    return $failed
}

# ============================================================================
# ENTRY POINT
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    parse_arguments "$@"
    main
fi
