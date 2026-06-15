#!/bin/bash
# Basset Hound Browser - Development Health Check Script
# Quick health checks for development environment (v12.3.0+ Latest)
# Usage: ./scripts/health-check-dev.sh [--verbose] [--watch]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
CONTAINER_NAME="basset-hound-browser-dev"
PORT=8765
METRICS_PORT=9091

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parsing arguments
VERBOSE=false
WATCH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            VERBOSE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
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

# Run health check once
run_health_check() {
    # Initialize check results
    local CHECKS_PASSED=0
    local CHECKS_FAILED=0
    local CHECKS_WARNED=0

    # Check 1: Container is running
    if [ "$VERBOSE" = true ]; then
        log_info "=== Development Health Check (v12.3.0+ Latest) ==="
    fi

    if docker ps | grep -q "$CONTAINER_NAME"; then
        log_success "Container is running"
        ((CHECKS_PASSED++))
    else
        log_error "Container is NOT running"
        ((CHECKS_FAILED++))
    fi

    # Check 2: WebSocket health endpoint
    if [ "$VERBOSE" = true ]; then
        log_info "Checking WebSocket health endpoint..."
    fi

    HEALTH_RESPONSE=$(docker exec "$CONTAINER_NAME" \
        curl -s -m 5 "http://localhost:$PORT/health" 2>/dev/null || echo "failed")

    if echo "$HEALTH_RESPONSE" | grep -q "ok\|healthy"; then
        log_success "WebSocket responding"
        ((CHECKS_PASSED++))
    else
        log_warn "WebSocket not yet responding"
        ((CHECKS_WARNED++))
    fi

    # Check 3: Container resource usage
    if [ "$VERBOSE" = true ]; then
        log_info "Checking container resource usage..."
    fi

    CONTAINER_STATS=$(docker stats --no-stream "$CONTAINER_NAME" 2>/dev/null || echo "")

    if [ -n "$CONTAINER_STATS" ]; then
        if [ "$VERBOSE" = true ]; then
            echo "$CONTAINER_STATS"
        fi
        ((CHECKS_PASSED++))
    else
        ((CHECKS_WARNED++))
    fi

    # Check 4: Volume mounts
    if [ "$VERBOSE" = true ]; then
        log_info "Checking volume mounts..."
    fi

    if docker volume ls | grep -q "basset-dev-data"; then
        log_success "Data volume mounted"
        ((CHECKS_PASSED++))
    else
        log_warn "Data volume not found"
        ((CHECKS_WARNED++))
    fi

    # Check 5: Metrics endpoint
    if [ "$VERBOSE" = true ]; then
        log_info "Checking metrics endpoint..."
    fi

    METRICS_RESPONSE=$(docker exec "$CONTAINER_NAME" \
        curl -s -m 5 "http://localhost:$METRICS_PORT/metrics" 2>/dev/null || echo "")

    if [ -n "$METRICS_RESPONSE" ]; then
        log_success "Metrics available"
        ((CHECKS_PASSED++))
    else
        log_warn "Metrics not yet available"
        ((CHECKS_WARNED++))
    fi

    # Summary
    if [ "$VERBOSE" = true ]; then
        echo ""
        log_info "=== Summary ==="
        echo "  Passed: $CHECKS_PASSED"
        echo "  Warned: $CHECKS_WARNED"
        echo "  Failed: $CHECKS_FAILED"
    fi

    # Return status
    if [ $CHECKS_FAILED -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

# If watch mode, run continuously
if [ "$WATCH" = true ]; then
    log_info "Starting health check watch (Ctrl+C to exit)..."
    echo ""

    while true; do
        clear || true
        echo "=== Development Health Status (Updated: $(date '+%Y-%m-%d %H:%M:%S')) ==="
        echo ""

        run_health_check || true

        echo ""
        log_info "Next check in 10 seconds... (Ctrl+C to exit)"
        sleep 10
    done
else
    # Single health check
    if [ "$VERBOSE" = false ]; then
        log_info "=== Development Health Check (v12.3.0+ Latest) ==="
    fi

    run_health_check

    if [ $? -eq 0 ]; then
        if [ "$VERBOSE" = true ]; then
            echo ""
            log_success "Development environment is HEALTHY"
        fi
        exit 0
    else
        if [ "$VERBOSE" = true ]; then
            echo ""
            log_error "Development environment has issues"
        fi
        exit 1
    fi
fi
