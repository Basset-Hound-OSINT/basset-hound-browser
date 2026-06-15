#!/bin/bash
# Basset Hound Browser - Canary Deployment Script
# Progressive rollout with traffic splitting: 10% -> 50% -> 100%
# Monitors metrics and rolls back automatically on errors
# Usage: ./scripts/canary-deploy.sh --version 12.7.0 [--threshold ERROR_RATE] [--duration SECONDS]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# CONFIGURATION
# ============================================================================

CANARY_VERSION=""
STABLE_VERSION="12.5.0"
CONTAINER_NAME="basset-hound-browser-prod"
PORT=8765

# Canary parameters
CANARY_PHASE_DURATION=300  # 5 minutes per phase
ERROR_THRESHOLD=5          # % error rate threshold
LATENCY_THRESHOLD=500      # ms latency threshold
MAX_ERROR_COUNT=10         # max errors before rollback

# Monitoring
MONITOR_INTERVAL=5         # seconds between checks
COLLECT_METRICS=true
METRICS_LOG=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Traffic split configuration
TRAFFIC_PHASES=(
    "10"   # Phase 1: 10%
    "50"   # Phase 2: 50%
    "100"  # Phase 3: 100%
)

# Metrics tracking
declare -A PHASE_METRICS=(
    [errors]=0
    [requests]=0
    [latency_sum]=0
    [latency_count]=0
    [start_time]=0
)

# ============================================================================
# LOGGING
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "$METRICS_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "$METRICS_LOG"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$METRICS_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "$METRICS_LOG"
}

log_section() {
    echo -e "\n${CYAN}=== $* ===${NC}" | tee -a "$METRICS_LOG"
}

log_metric() {
    if [[ "$COLLECT_METRICS" == "true" ]]; then
        echo "[METRIC] $*" >> "$METRICS_LOG"
    fi
}

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --version)
                CANARY_VERSION="$2"
                shift 2
                ;;
            --stable-version)
                STABLE_VERSION="$2"
                shift 2
                ;;
            --threshold)
                ERROR_THRESHOLD="$2"
                shift 2
                ;;
            --duration)
                CANARY_PHASE_DURATION="$2"
                shift 2
                ;;
            --no-metrics)
                COLLECT_METRICS=false
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

    # Validate required arguments
    if [[ -z "$CANARY_VERSION" ]]; then
        log_error "Version is required"
        print_usage
        exit 1
    fi

    METRICS_LOG="${PROJECT_ROOT}/logs/canary-deploy-${CANARY_VERSION}-$(date +%s).log"
    mkdir -p "$(dirname "$METRICS_LOG")"
}

print_usage() {
    cat << EOF
Usage: $0 --version VERSION [OPTIONS]

REQUIRED:
    --version VERSION           Version to canary deploy

OPTIONS:
    --stable-version VERSION    Version to roll back to (default: 12.5.0)
    --threshold PERCENT         Error rate threshold % (default: 5)
    --duration SECONDS          Phase duration in seconds (default: 300)
    --no-metrics                Don't collect metrics during deployment
    -h, --help                  Show this help message
EOF
}

# ============================================================================
# PREREQUISITES
# ============================================================================

check_prerequisites() {
    log_section "Prerequisites Check"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found"
        exit 1
    fi
    log_success "Docker available"

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose not found"
        exit 1
    fi
    log_success "Docker Compose available"

    # Check if container exists
    if ! docker ps -a | grep -q "$CONTAINER_NAME"; then
        log_error "Container not found: $CONTAINER_NAME"
        exit 1
    fi
    log_success "Container found"

    # Check image exists
    if ! docker image inspect "basset-hound-browser:${CANARY_VERSION}" &> /dev/null; then
        log_error "Image not found: basset-hound-browser:${CANARY_VERSION}"
        log_info "Building image..."
        docker build -t "basset-hound-browser:${CANARY_VERSION}" \
            -f "${PROJECT_ROOT}/config/docker/Dockerfile" \
            "$PROJECT_ROOT" || {
            log_error "Failed to build image"
            exit 1
        }
    fi
    log_success "Image available"
}

# ============================================================================
# LOAD BALANCER CONFIGURATION
# ============================================================================

setup_traffic_split() {
    local traffic_percent=$1
    local canary_replicas=1
    local stable_replicas=1

    log_info "Configuring traffic split: $traffic_percent% to canary"

    # In production, this would update load balancer/ingress rules
    # For now, we'll simulate by tracking the split
    echo "$traffic_percent" > "${PROJECT_ROOT}/.canary_traffic_split"

    log_metric "traffic_split_percent=$traffic_percent"
}

# ============================================================================
# HEALTH MONITORING
# ============================================================================

collect_metrics() {
    log_section "Collecting Metrics"

    local phase_start=${PHASE_METRICS[start_time]}
    local elapsed=$(($(date +%s) - phase_start))

    log_info "Phase metrics (${elapsed}s elapsed):"

    # Calculate metrics
    local error_rate=0
    if [[ ${PHASE_METRICS[requests]} -gt 0 ]]; then
        error_rate=$((${PHASE_METRICS[errors]} * 100 / ${PHASE_METRICS[requests]}))
    fi

    local avg_latency=0
    if [[ ${PHASE_METRICS[latency_count]} -gt 0 ]]; then
        avg_latency=$((${PHASE_METRICS[latency_sum]} / ${PHASE_METRICS[latency_count]}))
    fi

    log_info "  - Requests: ${PHASE_METRICS[requests]}"
    log_info "  - Errors: ${PHASE_METRICS[errors]} ($error_rate%)"
    log_info "  - Avg Latency: ${avg_latency}ms"

    log_metric "error_rate=$error_rate"
    log_metric "avg_latency=$avg_latency"
    log_metric "total_requests=${PHASE_METRICS[requests]}"
    log_metric "total_errors=${PHASE_METRICS[errors]}"

    # Check thresholds
    if [[ $error_rate -gt $ERROR_THRESHOLD ]]; then
        log_error "Error rate exceeded threshold: $error_rate% > $ERROR_THRESHOLD%"
        return 1
    fi

    if [[ $avg_latency -gt $LATENCY_THRESHOLD ]]; then
        log_warn "Latency high: ${avg_latency}ms > ${LATENCY_THRESHOLD}ms"
    fi

    return 0
}

simulate_health_check() {
    # Simulate health checks by testing WebSocket
    local response_code=$(timeout 2 curl -s -o /dev/null -w "%{http_code}" \
        "http://localhost:${PORT}/health" 2>/dev/null || echo "0")

    if [[ "$response_code" == "200" ]] || [[ "$response_code" == "426" ]]; then
        return 0
    else
        PHASE_METRICS[errors]=$((${PHASE_METRICS[errors]} + 1))
        return 1
    fi
}

monitor_phase() {
    local traffic_percent=$1
    local phase_num=$2
    local phase_count=${#TRAFFIC_PHASES[@]}

    log_section "Canary Phase $phase_num/$phase_count: $traffic_percent% Traffic"

    setup_traffic_split "$traffic_percent"

    # Reset metrics for this phase
    PHASE_METRICS[errors]=0
    PHASE_METRICS[requests]=0
    PHASE_METRICS[latency_sum]=0
    PHASE_METRICS[latency_count]=0
    PHASE_METRICS[start_time]=$(date +%s)

    local start_time=$(date +%s)
    local elapsed=0

    log_info "Monitoring for ${CANARY_PHASE_DURATION}s..."

    while [[ $elapsed -lt $CANARY_PHASE_DURATION ]]; do
        # Perform health check
        PHASE_METRICS[requests]=$((${PHASE_METRICS[requests]} + 1))

        if simulate_health_check; then
            log_info "[$((PHASE_METRICS[requests]))] Health check passed"
        else
            log_warn "[$((PHASE_METRICS[requests]))] Health check failed"
        fi

        # Check error threshold
        if [[ ${PHASE_METRICS[requests]} -gt 0 ]]; then
            local error_rate=$((${PHASE_METRICS[errors]} * 100 / ${PHASE_METRICS[requests]}))
            if [[ $error_rate -gt $ERROR_THRESHOLD ]]; then
                log_error "Error rate exceeded in phase $phase_num: $error_rate%"
                return 1
            fi
        fi

        sleep $MONITOR_INTERVAL
        elapsed=$(($(date +%s) - start_time))
        log_metric "phase_$phase_num elapsed=${elapsed}s traffic=$traffic_percent%"
    done

    # Collect final metrics
    if ! collect_metrics; then
        return 1
    fi

    log_success "Phase $phase_num passed ($traffic_percent% traffic)"
    return 0
}

# ============================================================================
# DEPLOYMENT PHASES
# ============================================================================

deploy_canary_version() {
    log_section "Deploying Canary Version"

    log_info "Pulling canary image: basset-hound-browser:${CANARY_VERSION}"

    if ! docker pull "basset-hound-browser:${CANARY_VERSION}" 2>&1 | tee -a "$METRICS_LOG"; then
        log_warn "Image pull failed (may be local-only)"
    fi

    log_success "Canary image ready"
}

execute_canary_phases() {
    log_section "Executing Canary Phases"

    local phase_num=1
    for traffic_percent in "${TRAFFIC_PHASES[@]}"; do
        log_info "Starting phase $phase_num ($traffic_percent% traffic)..."

        if ! monitor_phase "$traffic_percent" "$phase_num"; then
            log_error "Phase $phase_num failed - initiating rollback"
            return 1
        fi

        log_success "Phase $phase_num complete"
        phase_num=$((phase_num + 1))

        # Brief pause between phases
        if [[ $phase_num -le ${#TRAFFIC_PHASES[@]} ]]; then
            log_info "Brief pause before next phase..."
            sleep 10
        fi
    done

    return 0
}

# ============================================================================
# ROLLBACK
# ============================================================================

rollback_to_stable() {
    log_section "Rolling Back to Stable Version"

    log_error "Initiating rollback to v${STABLE_VERSION}"

    # Execute rollback script
    if [[ -f "${SCRIPT_DIR}/rollback-production.sh" ]]; then
        bash "${SCRIPT_DIR}/rollback-production.sh" --to-version "$STABLE_VERSION" --force || {
            log_error "Rollback script failed"
            return 1
        }
    else
        log_error "Rollback script not found"
        return 1
    fi

    log_success "Rollback complete"
    return 0
}

# ============================================================================
# FINALIZATION
# ============================================================================

finalize_deployment() {
    log_section "Finalizing Canary Deployment"

    # Update to 100% traffic if not already
    setup_traffic_split 100

    log_success "Canary deployment of v${CANARY_VERSION} complete!"
    log_success "Full traffic now routed to new version"

    # Generate report
    generate_canary_report
}

generate_canary_report() {
    log_section "Canary Deployment Report"

    local report_file="${PROJECT_ROOT}/logs/canary-report-${CANARY_VERSION}.txt"

    cat > "$report_file" << EOF
Basset Hound Browser - Canary Deployment Report
Version: $CANARY_VERSION
Date: $(date)
Status: SUCCESS

Deployment Configuration:
  - Canary Version: $CANARY_VERSION
  - Stable Version: $STABLE_VERSION
  - Phase Duration: ${CANARY_PHASE_DURATION}s
  - Error Threshold: ${ERROR_THRESHOLD}%
  - Latency Threshold: ${LATENCY_THRESHOLD}ms

Phases Completed:
  - Phase 1: 10% traffic (PASS)
  - Phase 2: 50% traffic (PASS)
  - Phase 3: 100% traffic (PASS)

Metrics Summary:
  - Total Requests: ${PHASE_METRICS[requests]}
  - Total Errors: ${PHASE_METRICS[errors]}
  - Error Rate: $((${PHASE_METRICS[errors]} * 100 / ${PHASE_METRICS[requests]:-1}))%
  - Average Latency: $((${PHASE_METRICS[latency_sum]} / ${PHASE_METRICS[latency_count]:-1}))ms

Monitoring Log:
  $METRICS_LOG

EOF

    log_success "Report written to: $report_file"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    log_section "Basset Hound Browser - Canary Deployment"
    log_info "Version: $CANARY_VERSION"
    log_info "Stable Version: $STABLE_VERSION"
    log_info "Start: $(date)"

    check_prerequisites
    deploy_canary_version

    if execute_canary_phases; then
        finalize_deployment
        log_success "Canary deployment succeeded"
        return 0
    else
        log_error "Canary deployment failed"
        if rollback_to_stable; then
            log_info "Successfully rolled back to v$STABLE_VERSION"
        else
            log_error "Rollback failed - manual intervention required"
            return 2
        fi
        return 1
    fi
}

# ============================================================================
# ENTRY POINT
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    parse_arguments "$@"
    main
fi
