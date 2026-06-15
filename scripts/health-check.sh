#!/bin/bash

# Health Check Script for Basset Hound Browser - v12.3.0
# Comprehensive health checking with auto-recovery support

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:8765/health}"
READINESS_URL="${READINESS_URL:-http://localhost:8765/ready}"
LIVENESS_URL="${LIVENESS_URL:-http://localhost:8765/alive}"
METRICS_URL="${METRICS_URL:-http://localhost:9090/metrics}"

TIMEOUT="${TIMEOUT:-5}"
MAX_RETRIES="${MAX_RETRIES:-3}"
RETRY_DELAY="${RETRY_DELAY:-2}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging
log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Check liveness (is process alive?)
check_liveness() {
    log_info "Checking liveness probe..."

    local retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -s -m $TIMEOUT "$LIVENESS_URL" > /dev/null 2>&1; then
            log_info "✓ Process is alive"
            return 0
        fi

        retries=$((retries + 1))
        if [ $retries -lt $MAX_RETRIES ]; then
            log_warn "Liveness check failed, retrying ($retries/$MAX_RETRIES)..."
            sleep $RETRY_DELAY
        fi
    done

    log_error "✗ Process not responding to liveness probe"
    return 1
}

# Check readiness (can accept traffic?)
check_readiness() {
    log_info "Checking readiness probe..."

    if curl -s -m $TIMEOUT "$READINESS_URL" | jq -e '.ready' > /dev/null 2>&1; then
        log_info "✓ Service is ready to accept traffic"
        return 0
    fi

    log_warn "✗ Service not ready for traffic"
    return 1
}

# Check health status
check_health() {
    log_info "Checking health status..."

    local health_response
    health_response=$(curl -s -m $TIMEOUT "$HEALTH_CHECK_URL" || echo "{}")

    local status
    status=$(echo "$health_response" | jq -r '.status // "unknown"')

    case $status in
        healthy)
            log_info "✓ Health status: HEALTHY"
            return 0
            ;;
        degraded)
            log_warn "⚠ Health status: DEGRADED"
            return 0
            ;;
        *)
            log_error "✗ Health status: UNHEALTHY or UNKNOWN"
            echo "$health_response" | jq '.' || echo "$health_response"
            return 1
            ;;
    esac
}

# Check metrics availability
check_metrics() {
    log_info "Checking metrics endpoint..."

    if curl -s -m $TIMEOUT "$METRICS_URL" > /dev/null 2>&1; then
        log_info "✓ Metrics endpoint responding"
        return 0
    fi

    log_warn "✗ Metrics endpoint not responding"
    return 1
}

# Check system resources
check_resources() {
    log_info "Checking system resources..."

    local mem_usage
    mem_usage=$(ps aux | grep "node\|electron" | grep -v grep | awk '{sum+=$6} END {print sum}')

    if [ -z "$mem_usage" ]; then
        mem_usage=0
    fi

    local mem_mb=$((mem_usage / 1024))
    log_info "Memory usage: ${mem_mb}MB"

    # Check if memory usage is reasonable
    if [ $mem_mb -gt 2048 ]; then
        log_warn "⚠ High memory usage detected: ${mem_mb}MB"
        return 1
    fi

    return 0
}

# Perform auto-recovery
recover() {
    log_warn "Attempting auto-recovery..."

    # Restart the service
    if [ -x "$PROJECT_ROOT/scripts/restart-service.sh" ]; then
        log_info "Restarting service..."
        "$PROJECT_ROOT/scripts/restart-service.sh"
        sleep 3

        # Retry health check
        if check_health; then
            log_info "✓ Recovery successful"
            return 0
        fi
    fi

    log_error "✗ Recovery failed"
    return 1
}

# Main health check routine
main() {
    log_info "Starting health check for Basset Hound Browser..."

    local failed_checks=0

    # Run all checks
    check_liveness || failed_checks=$((failed_checks + 1))
    check_readiness || failed_checks=$((failed_checks + 1))
    check_health || failed_checks=$((failed_checks + 1))
    check_metrics || failed_checks=$((failed_checks + 1))
    check_resources || failed_checks=$((failed_checks + 1))

    # Summary
    echo ""
    if [ $failed_checks -eq 0 ]; then
        log_info "✓ All health checks passed"
        return 0
    else
        log_error "✗ $failed_checks health check(s) failed"

        # Attempt recovery
        if recover; then
            return 0
        fi

        return 1
    fi
}

# Parse command line arguments
case "${1:-}" in
    --liveness)
        check_liveness
        ;;
    --readiness)
        check_readiness
        ;;
    --health)
        check_health
        ;;
    --metrics)
        check_metrics
        ;;
    --resources)
        check_resources
        ;;
    --recover)
        recover
        ;;
    --help)
        cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    --liveness      Check liveness probe only
    --readiness     Check readiness probe only
    --health        Check health status only
    --metrics       Check metrics endpoint only
    --resources     Check system resources only
    --recover       Attempt auto-recovery
    --help          Show this help message

Default: Run all checks
EOF
        ;;
    *)
        main
        ;;
esac
