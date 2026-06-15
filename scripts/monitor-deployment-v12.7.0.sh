#!/bin/bash
# Basset Hound Browser - Deployment Monitoring Script
# Real-time metrics collection, alerts, and dashboard
# Usage: ./scripts/monitor-deployment-v12.7.0.sh [--duration SECONDS] [--interval SECONDS]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# CONFIGURATION
# ============================================================================

CONTAINER_NAME="basset-hound-browser-prod"
PORT=8765

# Monitoring parameters
MONITOR_DURATION=3600        # 1 hour default
MONITOR_INTERVAL=5           # 5 seconds between samples
ALERT_ON_ANOMALY=true
EMAIL_ON_ALERT=""
SLACK_WEBHOOK=""

# Thresholds
MEMORY_THRESHOLD=85          # % of limit
CPU_THRESHOLD=80             # %
LATENCY_THRESHOLD=500        # ms
ERROR_RATE_THRESHOLD=5       # %
RESTART_THRESHOLD=3          # restarts in monitoring period

# Metrics storage
METRICS_FILE="${PROJECT_ROOT}/logs/deployment-metrics-$(date +%Y%m%d-%H%M%S).csv"
ALERTS_FILE="${PROJECT_ROOT}/logs/deployment-alerts-$(date +%Y%m%d-%H%M%S).txt"
DASHBOARD_FILE="${PROJECT_ROOT}/logs/deployment-dashboard.txt"

mkdir -p "$(dirname "$METRICS_FILE")"

# Metrics tracking
declare -A METRICS=(
    [memory_peak]=0
    [cpu_peak]=0
    [latency_peak]=0
    [error_count]=0
    [request_count]=0
    [restart_count]=0
    [sample_count]=0
    [alerts_triggered]=0
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# LOGGING
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_alert() {
    echo -e "${RED}[ALERT]${NC} $*" | tee -a "$ALERTS_FILE"
}

log_metric() {
    echo "$*" >> "$METRICS_FILE"
}

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --duration)
                MONITOR_DURATION="$2"
                shift 2
                ;;
            --interval)
                MONITOR_INTERVAL="$2"
                shift 2
                ;;
            --memory-threshold)
                MEMORY_THRESHOLD="$2"
                shift 2
                ;;
            --cpu-threshold)
                CPU_THRESHOLD="$2"
                shift 2
                ;;
            --email)
                EMAIL_ON_ALERT="$2"
                shift 2
                ;;
            --slack)
                SLACK_WEBHOOK="$2"
                shift 2
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
    --duration SECONDS          Monitor duration (default: 3600)
    --interval SECONDS          Sample interval (default: 5)
    --memory-threshold PCT      Memory threshold % (default: 85)
    --cpu-threshold PCT         CPU threshold % (default: 80)
    --email ADDRESS             Send alerts to email
    --slack WEBHOOK_URL         Send alerts to Slack
    -h, --help                  Show this help message
EOF
}

# ============================================================================
# PREREQUISITES
# ============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker not found"
        return 1
    fi

    if ! docker ps -a | grep -q "$CONTAINER_NAME"; then
        log_error "Container not found: $CONTAINER_NAME"
        return 1
    fi

    # Initialize metrics file with header
    echo "timestamp,memory_usage,memory_limit,memory_pct,cpu_pct,latency_ms,health_status,running" > "$METRICS_FILE"

    log_success "Prerequisites verified"
    return 0
}

# ============================================================================
# METRIC COLLECTION
# ============================================================================

collect_docker_stats() {
    # Get container stats
    local stats=$(docker stats --no-stream "$CONTAINER_NAME" \
        --format="{{.MemUsage}} {{.MemLimit}} {{.CPUPerc}}" 2>/dev/null || echo "")

    if [[ -z "$stats" ]]; then
        return 1
    fi

    # Parse stats (format: "123MiB / 2GiB 45.67%")
    local mem_usage=$(echo "$stats" | awk '{print $1}')
    local mem_limit=$(echo "$stats" | awk '{print $3}')
    local cpu_pct=$(echo "$stats" | awk '{print $4}')

    echo "$mem_usage $mem_limit $cpu_pct"
}

collect_health_status() {
    docker inspect "$CONTAINER_NAME" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown"
}

check_container_running() {
    if docker ps | grep -q "$CONTAINER_NAME"; then
        echo "running"
    else
        echo "stopped"
    fi
}

test_websocket_latency() {
    local start=$(date +%s%N)

    if timeout 3 bash -c "echo 'PING' | nc -q 1 localhost $PORT" &>/dev/null; then
        local end=$(date +%s%N)
        local latency=$(( (end - start) / 1000000 ))  # Convert to ms
        echo $latency
    else
        echo "-1"
    fi
}

# ============================================================================
# ALERT LOGIC
# ============================================================================

check_memory_threshold() {
    local mem_usage=$1
    local mem_limit=$2

    # Rough conversion to percentage
    local mem_usage_num=${mem_usage%?}  # Remove unit
    local mem_limit_num=${mem_limit%?}

    if [[ -z "$mem_usage_num" ]] || [[ -z "$mem_limit_num" ]]; then
        return 0
    fi

    # Simple heuristic: if usage is close to limit
    if [[ $mem_usage_num -gt $((mem_limit_num * 80 / 100)) ]]; then
        return 1
    fi

    return 0
}

check_cpu_threshold() {
    local cpu_pct=$1

    # Remove percentage sign and compare
    local cpu_num=${cpu_pct%\%}

    if [[ -z "$cpu_num" ]] || [[ ! "$cpu_num" =~ ^[0-9]+$ ]]; then
        return 0
    fi

    if [[ $cpu_num -gt $CPU_THRESHOLD ]]; then
        return 1
    fi

    return 0
}

check_latency_threshold() {
    local latency=$1

    if [[ -z "$latency" ]] || [[ "$latency" == "-1" ]]; then
        return 0
    fi

    if [[ $latency -gt $LATENCY_THRESHOLD ]]; then
        return 1
    fi

    return 0
}

# ============================================================================
# MONITORING LOOP
# ============================================================================

run_monitoring() {
    log_info "Starting deployment monitoring..."
    log_info "Duration: ${MONITOR_DURATION}s"
    log_info "Interval: ${MONITOR_INTERVAL}s"
    log_info "Metrics file: $METRICS_FILE"
    log_info "Alerts file: $ALERTS_FILE"

    local start_time=$(date +%s)
    local sample_count=0

    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [[ $elapsed -gt $MONITOR_DURATION ]]; then
            log_info "Monitoring duration reached"
            break
        fi

        # Collect metrics
        local stats=$(collect_docker_stats)
        local health=$(collect_health_status)
        local running=$(check_container_running)
        local latency=$(test_websocket_latency)
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

        if [[ -n "$stats" ]]; then
            local mem_usage=$(echo "$stats" | awk '{print $1}')
            local mem_limit=$(echo "$stats" | awk '{print $2}')
            local cpu_pct=$(echo "$stats" | awk '{print $3}')

            # Check thresholds
            local alerts=""

            if ! check_memory_threshold "$mem_usage" "$mem_limit"; then
                alerts="${alerts}HIGH_MEMORY "
                METRICS[alerts_triggered]=$((${METRICS[alerts_triggered]} + 1))
            fi

            if ! check_cpu_threshold "$cpu_pct"; then
                alerts="${alerts}HIGH_CPU "
                METRICS[alerts_triggered]=$((${METRICS[alerts_triggered]} + 1))
            fi

            if ! check_latency_threshold "$latency"; then
                alerts="${alerts}HIGH_LATENCY "
                METRICS[alerts_triggered]=$((${METRICS[alerts_triggered]} + 1))
            fi

            # Log metrics
            log_metric "$timestamp,$mem_usage,$mem_limit,$cpu_pct,$latency,$health,$running"

            # Display current status
            printf "\r${CYAN}[%s]${NC} Mem: %s (limit: %s) | CPU: %s | Latency: %sms | Health: %s" \
                "$(printf '%02d:%02d:%02d' $((elapsed/3600)) $((elapsed%3600/60)) $((elapsed%60)))" \
                "$mem_usage" "$mem_limit" "$cpu_pct" "$latency" "$health"

            # Alert on anomalies
            if [[ -n "$alerts" ]] && $ALERT_ON_ANOMALY; then
                log_alert "Anomaly detected at $timestamp: $alerts"
                notify_alert "$timestamp" "$alerts" "$mem_usage" "$cpu_pct" "$latency"
            fi

            METRICS[sample_count]=$((${METRICS[sample_count]} + 1))
        fi

        sample_count=$((sample_count + 1))
        sleep $MONITOR_INTERVAL
    done

    echo ""  # New line after progress
}

# ============================================================================
# NOTIFICATIONS
# ============================================================================

notify_alert() {
    local timestamp=$1
    local alerts=$2
    local mem_usage=$3
    local cpu_pct=$4
    local latency=$5

    # Email notification
    if [[ -n "$EMAIL_ON_ALERT" ]]; then
        send_email_alert "$timestamp" "$alerts" "$mem_usage" "$cpu_pct" "$latency"
    fi

    # Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        send_slack_alert "$timestamp" "$alerts" "$mem_usage" "$cpu_pct" "$latency"
    fi
}

send_email_alert() {
    local timestamp=$1
    local alerts=$2
    local mem_usage=$3
    local cpu_pct=$4
    local latency=$5

    if ! command -v mail &> /dev/null; then
        return 0
    fi

    {
        echo "Subject: Basset Hound Browser Deployment Alert - $alerts"
        echo "To: $EMAIL_ON_ALERT"
        echo ""
        echo "Alert Time: $timestamp"
        echo "Container: $CONTAINER_NAME"
        echo "Alerts: $alerts"
        echo ""
        echo "Metrics:"
        echo "  Memory: $mem_usage"
        echo "  CPU: $cpu_pct"
        echo "  Latency: ${latency}ms"
        echo ""
        echo "See $ALERTS_FILE for full details"
    } | sendmail "$EMAIL_ON_ALERT" 2>/dev/null || true
}

send_slack_alert() {
    local timestamp=$1
    local alerts=$2
    local mem_usage=$3
    local cpu_pct=$4
    local latency=$5

    local message=$(cat << EOF
{
  "attachments": [
    {
      "color": "danger",
      "title": "Basset Hound Browser - Deployment Alert",
      "fields": [
        {
          "title": "Timestamp",
          "value": "$timestamp",
          "short": true
        },
        {
          "title": "Alerts",
          "value": "$alerts",
          "short": true
        },
        {
          "title": "Memory",
          "value": "$mem_usage",
          "short": true
        },
        {
          "title": "CPU",
          "value": "$cpu_pct",
          "short": true
        },
        {
          "title": "Latency",
          "value": "${latency}ms",
          "short": true
        },
        {
          "title": "Container",
          "value": "$CONTAINER_NAME",
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
        -d "$message" > /dev/null 2>&1 || true
}

# ============================================================================
# REPORTING
# ============================================================================

generate_monitoring_report() {
    log_info "Generating monitoring report..."

    local report_file="${PROJECT_ROOT}/logs/deployment-monitoring-report.txt"

    cat > "$report_file" << EOF
Basset Hound Browser - Deployment Monitoring Report
Generated: $(date)
Container: $CONTAINER_NAME

Monitoring Configuration:
  - Duration: ${MONITOR_DURATION}s
  - Interval: ${MONITOR_INTERVAL}s
  - Samples Collected: ${METRICS[sample_count]}

Thresholds:
  - Memory: ${MEMORY_THRESHOLD}%
  - CPU: ${CPU_THRESHOLD}%
  - Latency: ${LATENCY_THRESHOLD}ms
  - Error Rate: ${ERROR_RATE_THRESHOLD}%

Results:
  - Alerts Triggered: ${METRICS[alerts_triggered]}
  - Duration: ${MONITOR_DURATION}s
  - Total Samples: ${METRICS[sample_count]}

Metrics Log:
  $METRICS_FILE

Alerts Log:
  $ALERTS_FILE

EOF

    # Append summary statistics from metrics file
    if [[ -f "$METRICS_FILE" ]]; then
        cat >> "$report_file" << EOF

Metrics Summary:
EOF
        # Calculate stats from CSV
        tail -n +2 "$METRICS_FILE" | awk -F, '{
            mem_sum += $4; cpu_sum += $5; latency_sum += $6
            if ($4 > mem_max) mem_max = $4
            if ($5 > cpu_max) cpu_max = $5
            if ($6 > latency_max) latency_max = $6
            count++
        }
        END {
            printf "  - Avg Memory: %.1f%%\n", mem_sum/count
            printf "  - Peak Memory: %.1f%%\n", mem_max
            printf "  - Avg CPU: %.1f%%\n", cpu_sum/count
            printf "  - Peak CPU: %.1f%%\n", cpu_max
            printf "  - Avg Latency: %.1fms\n", latency_sum/count
            printf "  - Peak Latency: %.1fms\n", latency_max
        }' >> "$report_file" || true
    fi

    log_success "Report generated: $report_file"
}

# ============================================================================
# DASHBOARD UPDATE
# ============================================================================

update_dashboard() {
    local latest_metrics=$(tail -1 "$METRICS_FILE" 2>/dev/null || echo "")

    if [[ -z "$latest_metrics" ]]; then
        return 0
    fi

    cat > "$DASHBOARD_FILE" << EOF
Basset Hound Browser - Deployment Dashboard
Updated: $(date)

Container Status: $(check_container_running)
Health: $(collect_health_status)

Latest Metrics:
$latest_metrics

Alerts Triggered: ${METRICS[alerts_triggered]}

Logs:
  Metrics: $METRICS_FILE
  Alerts: $ALERTS_FILE

EOF
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    log_info "Basset Hound Browser - Deployment Monitoring"
    log_info "Start: $(date)"

    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        return 1
    fi

    # Run monitoring
    run_monitoring

    # Generate report
    generate_monitoring_report
    update_dashboard

    log_info "Monitoring complete"
    log_success "Reports generated successfully"
}

# ============================================================================
# ENTRY POINT
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    parse_arguments "$@"
    main
fi
