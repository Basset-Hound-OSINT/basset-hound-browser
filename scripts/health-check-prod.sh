#!/bin/bash
# Basset Hound Browser - Production Health Check Script
# Comprehensive health checks with alerting for production (v12.2.0)
# Usage: ./scripts/health-check-prod.sh [--verbose] [--alert-webhook <url>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
CONTAINER_NAME="basset-hound-browser-prod"
PORT=8765
METRICS_PORT=9090

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parsing arguments
VERBOSE=false
ALERT_WEBHOOK=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            VERBOSE=true
            shift
            ;;
        --alert-webhook)
            ALERT_WEBHOOK="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[✗]${NC} $*"
}

# Send alert
send_alert() {
    local message="$1"
    local severity="${2:-error}"

    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
                \"severity\": \"$severity\",
                \"message\": \"$message\",
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
                \"environment\": \"production\",
                \"version\": \"12.2.0\"
            }" || true
    fi
}

# Initialize check results
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

# Check 1: Container is running
log_info "=== Production Health Check (v12.2.0) ==="
log_info ""
log_info "[1/7] Checking if container is running..."

if docker ps | grep -q "$CONTAINER_NAME"; then
    log_success "Container is running"
    ((CHECKS_PASSED++))
else
    log_error "Container is NOT running"
    ((CHECKS_FAILED++))
    send_alert "Production container is not running" "critical"
fi

# Check 2: WebSocket health endpoint
log_info "[2/7] Checking WebSocket health endpoint..."

HEALTH_RESPONSE=$(docker exec "$CONTAINER_NAME" \
    curl -s -m 5 "http://localhost:$PORT/health" || echo "failed")

if echo "$HEALTH_RESPONSE" | grep -q "ok\|healthy"; then
    log_success "WebSocket health endpoint responding"
    ((CHECKS_PASSED++))
else
    log_error "WebSocket health endpoint not responding"
    ((CHECKS_FAILED++))
    send_alert "Production WebSocket health check failed" "critical"
fi

# Check 3: Readiness endpoint
log_info "[3/7] Checking readiness endpoint..."

READY_RESPONSE=$(docker exec "$CONTAINER_NAME" \
    curl -s -m 5 "http://localhost:$PORT/ready" || echo "failed")

if echo "$READY_RESPONSE" | grep -q "ready\|ok"; then
    log_success "Readiness endpoint responding"
    ((CHECKS_PASSED++))
else
    log_warn "Readiness endpoint not responding (may be normal)"
    ((CHECKS_WARNED++))
fi

# Check 4: Container resource usage
log_info "[4/7] Checking container resource usage..."

CONTAINER_STATS=$(docker stats --no-stream "$CONTAINER_NAME" 2>/dev/null || echo "")

if [ -n "$CONTAINER_STATS" ]; then
    if [ "$VERBOSE" = true ]; then
        echo "$CONTAINER_STATS"
    fi

    # Extract memory percentage
    MEM_PERCENT=$(echo "$CONTAINER_STATS" | tail -1 | awk '{print $7}' | sed 's/%//')

    # Check if memory usage is reasonable (< 80% of 2G limit = 1.6G)
    if (( $(echo "$MEM_PERCENT < 80" | bc -l) )); then
        log_success "Memory usage healthy ($MEM_PERCENT%)"
        ((CHECKS_PASSED++))
    else
        log_warn "Memory usage elevated ($MEM_PERCENT%)"
        ((CHECKS_WARNED++))
        send_alert "Production memory usage elevated: ${MEM_PERCENT}%" "warning"
    fi
else
    log_warn "Could not get container stats"
    ((CHECKS_WARNED++))
fi

# Check 5: Volume mounts
log_info "[5/7] Checking volume mounts..."

VOLUMES_OK=true

# Check data volume
if docker volume ls | grep -q "basset-prod-data"; then
    log_success "Data volume is mounted"
    ((CHECKS_PASSED++))
else
    log_error "Data volume is missing"
    ((CHECKS_FAILED++))
    VOLUMES_OK=false
fi

# Check logs volume
if docker volume ls | grep -q "basset-prod-logs"; then
    if [ "$VERBOSE" = true ]; then
        log_success "Logs volume is mounted"
    fi
else
    log_error "Logs volume is missing"
    ((CHECKS_FAILED++))
    VOLUMES_OK=false
fi

# Check 6: Network connectivity
log_info "[6/7] Checking network connectivity..."

NETWORK_OK=true

# Check if port 8765 is listening
if docker exec "$CONTAINER_NAME" \
    curl -s -m 5 "http://localhost:$PORT" > /dev/null 2>&1; then
    log_success "Port $PORT is responding"
    ((CHECKS_PASSED++))
else
    log_error "Port $PORT is not responding"
    ((CHECKS_FAILED++))
    NETWORK_OK=false
    send_alert "Production port $PORT not responding" "critical"
fi

# Check 7: Metrics endpoint
log_info "[7/7] Checking metrics endpoint..."

METRICS_RESPONSE=$(docker exec "$CONTAINER_NAME" \
    curl -s -m 5 "http://localhost:$METRICS_PORT/metrics" || echo "")

if [ -n "$METRICS_RESPONSE" ] && echo "$METRICS_RESPONSE" | grep -q "basset"; then
    log_success "Prometheus metrics available"
    ((CHECKS_PASSED++))
else
    log_warn "Prometheus metrics not yet available"
    ((CHECKS_WARNED++))
fi

# Summary
echo ""
log_info "=== Health Check Summary ==="
echo ""
echo -e "${GREEN}Passed:${NC} $CHECKS_PASSED"
echo -e "${YELLOW}Warned:${NC} $CHECKS_WARNED"
echo -e "${RED}Failed:${NC} $CHECKS_FAILED"
echo ""

# Determine overall health status
if [ $CHECKS_FAILED -eq 0 ]; then
    if [ $CHECKS_WARNED -eq 0 ]; then
        log_success "All checks passed - Production is HEALTHY"
        exit 0
    else
        log_warn "Some checks warned - Production is OPERATIONAL (with warnings)"
        exit 0
    fi
else
    log_error "Critical checks failed - Production is UNHEALTHY"
    send_alert "Production health check failed: $CHECKS_FAILED failures" "critical"
    exit 1
fi
