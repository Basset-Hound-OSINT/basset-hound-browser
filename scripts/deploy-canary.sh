#!/bin/bash
# Basset Hound Browser - Canary Deployment Script (5% Rollout)
# Usage: ./scripts/deploy-canary.sh [VERSION]
# Example: ./scripts/deploy-canary.sh 12.8.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSION="${1:-12.8.0}"
DEPLOYMENT_LOG="${PROJECT_ROOT}/logs/deployment/canary-${VERSION}-$(date +%Y%m%d-%H%M%S).log"
DEPLOYMENT_STATE_FILE="${PROJECT_ROOT}/logs/deployment/canary-state.json"
METRICS_BASELINE_FILE="${PROJECT_ROOT}/logs/deployment/canary-metrics-baseline.json"

# Create log directory
mkdir -p "$(dirname "$DEPLOYMENT_LOG")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$DEPLOYMENT_LOG"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$DEPLOYMENT_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$DEPLOYMENT_LOG"
}

log_section() {
    echo -e "\n${BLUE}=== $* ===${NC}\n" | tee -a "$DEPLOYMENT_LOG"
}

# Save deployment state
save_state() {
    local state=$1
    local details=$2
    cat > "$DEPLOYMENT_STATE_FILE" << EOF
{
  "version": "$VERSION",
  "state": "$state",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "details": "$details"
}
EOF
    log_info "Deployment state saved: $state"
}

# Capture baseline metrics before deployment
capture_baseline_metrics() {
    log_section "Capturing baseline metrics"

    local baseline_file="$METRICS_BASELINE_FILE"

    # Get current instance metrics
    local mem_usage=$(docker stats --no-stream basset-hound-browser 2>/dev/null | tail -1 | awk '{print $NF}' || echo "N/A")
    local cpu_usage=$(docker stats --no-stream basset-hound-browser 2>/dev/null | tail -1 | awk '{print $(NF-3)}' || echo "N/A")

    # Get WebSocket metrics
    local ws_connections=$(curl -s http://localhost:8765/metrics 2>/dev/null | grep 'ws_connections' | head -1 | awk '{print $NF}' || echo "0")
    local ws_throughput=$(curl -s http://localhost:8765/metrics 2>/dev/null | grep 'ws_throughput' | head -1 | awk '{print $NF}' || echo "0")

    cat > "$baseline_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "memory_usage": "$mem_usage",
  "cpu_usage": "$cpu_usage",
  "ws_connections": $ws_connections,
  "ws_throughput_msg_sec": $ws_throughput
}
EOF

    log_info "Baseline metrics captured:"
    log_info "  Memory: $mem_usage"
    log_info "  CPU: $cpu_usage"
    log_info "  WS Connections: $ws_connections"
    log_info "  WS Throughput: $ws_throughput msgs/sec"
}

# Pre-deployment validation
validate_prerequisites() {
    log_section "Validating prerequisites"

    # Check Docker is available
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    log_info "✓ Docker is installed"

    # Check Docker daemon is running
    if ! docker ps &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    log_info "✓ Docker daemon is running"

    # Check if existing container exists
    if docker ps -a | grep -q "basset-hound-browser"; then
        log_info "✓ Existing container found"
    else
        log_warn "No existing container found"
    fi

    # Check image exists or can be pulled
    if docker image inspect "basset-hound-browser:$VERSION" &> /dev/null; then
        log_info "✓ Image basset-hound-browser:$VERSION exists"
    else
        log_warn "Image basset-hound-browser:$VERSION not found, will need to build/pull"
    fi

    # Check network exists
    if docker network inspect basset-hound-browser &> /dev/null; then
        log_info "✓ Docker network 'basset-hound-browser' exists"
    else
        log_warn "Docker network 'basset-hound-browser' not found, will create"
    fi
}

# Build or pull Docker image
prepare_image() {
    log_section "Preparing Docker image"

    if docker image inspect "basset-hound-browser:$VERSION" &> /dev/null; then
        log_info "Using existing image: basset-hound-browser:$VERSION"
        return 0
    fi

    log_info "Building Docker image for version $VERSION..."
    if [ -f "$PROJECT_ROOT/config/docker/Dockerfile" ]; then
        cd "$PROJECT_ROOT"
        docker build -f config/docker/Dockerfile -t "basset-hound-browser:$VERSION" . 2>&1 | tee -a "$DEPLOYMENT_LOG"
        log_info "✓ Docker image built successfully"
    else
        log_error "Dockerfile not found at config/docker/Dockerfile"
        exit 1
    fi
}

# Deploy canary instance
deploy_canary_instance() {
    log_section "Deploying canary instance (5% traffic)"

    # Create network if needed
    if ! docker network inspect basset-hound-browser &> /dev/null; then
        docker network create basset-hound-browser
        log_info "Created Docker network"
    fi

    # Define canary container name
    local canary_name="basset-hound-canary-$VERSION"

    # Stop any existing canary instance
    if docker ps -a | grep -q "$canary_name"; then
        log_info "Stopping existing canary instance: $canary_name"
        docker stop "$canary_name" 2>/dev/null || true
        docker rm "$canary_name" 2>/dev/null || true
        sleep 2
    fi

    # Start canary instance
    log_info "Starting canary container: $canary_name"
    docker run -d \
        --name "$canary_name" \
        --network basset-hound-browser \
        -p 8765:8765 \
        -e NODE_ENV=production \
        -e LOG_LEVEL=info \
        -e DISPLAY=:99 \
        -e ELECTRON_DISABLE_SANDBOX=1 \
        --cap-drop ALL \
        --cap-add SYS_ADMIN \
        --restart unless-stopped \
        --label "basset.version=$VERSION" \
        --label "basset.role=canary" \
        --label "basset.deployment_id=$(date +%s)" \
        "basset-hound-browser:$VERSION" 2>&1 | tee -a "$DEPLOYMENT_LOG"

    log_info "✓ Canary container started: $canary_name"
}

# Health check for canary
health_check_canary() {
    log_section "Performing health checks on canary"

    local max_retries=30
    local retry_count=0
    local check_interval=2

    while [ $retry_count -lt $max_retries ]; do
        # Wait for container to be ready
        if docker ps | grep -q "basset-hound-canary-$VERSION"; then
            log_info "Container is running, checking service readiness..."

            # Check WebSocket endpoint
            if curl -s -X GET "http://localhost:8765/health" \
                -H "Content-Type: application/json" \
                --max-time 5 | grep -q "healthy\|ready"; then

                log_info "✓ Health check passed"
                return 0
            fi
        fi

        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $max_retries ]; then
            log_warn "Health check failed, retrying ($retry_count/$max_retries)..."
            sleep $check_interval
        fi
    done

    log_error "✗ Canary failed health checks after $max_retries attempts"
    docker logs "basset-hound-canary-$VERSION" 2>&1 | tail -50 | tee -a "$DEPLOYMENT_LOG"
    return 1
}

# Collect metrics during canary observation period
collect_canary_metrics() {
    log_section "Collecting canary metrics for $1 seconds"

    local duration=$1
    local interval=10
    local elapsed=0
    local metrics_file="${PROJECT_ROOT}/logs/deployment/canary-metrics-${VERSION}.jsonl"

    > "$metrics_file"

    while [ $elapsed -lt $duration ]; do
        local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

        # Get container metrics
        local container_id=$(docker ps -q --filter "label=basset.role=canary" 2>/dev/null | head -1)
        if [ -n "$container_id" ]; then
            local mem_usage=$(docker stats --no-stream "$container_id" 2>/dev/null | tail -1 | awk '{print $NF}' || echo "N/A")
            local cpu_usage=$(docker stats --no-stream "$container_id" 2>/dev/null | tail -1 | awk '{print $(NF-3)}' || echo "N/A")

            # Get application metrics
            local ws_connections=$(curl -s "http://localhost:8765/metrics" 2>/dev/null | grep 'ws_connections' | head -1 | awk '{print $NF}' || echo "0")
            local error_rate=$(curl -s "http://localhost:8765/metrics" 2>/dev/null | grep 'error_rate' | head -1 | awk '{print $NF}' || echo "0")

            # Write to metrics file
            cat >> "$metrics_file" << EOF
{
  "timestamp": "$timestamp",
  "memory_usage": "$mem_usage",
  "cpu_usage": "$cpu_usage",
  "ws_connections": $ws_connections,
  "error_rate": $error_rate
}
EOF
        fi

        elapsed=$((elapsed + interval))
        if [ $elapsed -lt $duration ]; then
            sleep $interval
        fi
    done

    log_info "✓ Metrics collected and saved to: $metrics_file"
}

# Validate canary metrics
validate_canary_metrics() {
    log_section "Validating canary metrics"

    local metrics_file="${PROJECT_ROOT}/logs/deployment/canary-metrics-${VERSION}.jsonl"

    if [ ! -f "$metrics_file" ]; then
        log_warn "Metrics file not found"
        return 0
    fi

    # Check for anomalies
    local error_count=$(grep -c '"error_rate": [^0]' "$metrics_file" || echo "0")
    local high_memory_count=$(grep '"memory_usage".*G' "$metrics_file" | wc -l)
    local total_samples=$(wc -l < "$metrics_file")

    log_info "Metrics analysis:"
    log_info "  Total samples: $total_samples"
    log_info "  Samples with errors: $error_count"
    log_info "  Samples with high memory: $high_memory_count"

    # Error rate threshold: allow max 5% of samples with errors
    if [ "$error_count" -gt $((total_samples / 20)) ]; then
        log_warn "⚠ High error rate detected in canary"
        return 1
    fi

    log_info "✓ Metrics validation passed"
    return 0
}

# Generate canary report
generate_canary_report() {
    log_section "Generating canary deployment report"

    local report_file="${PROJECT_ROOT}/logs/deployment/canary-report-${VERSION}.md"

    cat > "$report_file" << 'EOF'
# Basset Hound Browser - Canary Deployment Report

## Deployment Summary
- **Version Deployed:** $VERSION
- **Deployment Type:** Canary (5% traffic)
- **Start Time:** $START_TIME
- **End Time:** $END_TIME
- **Duration:** $DURATION

## Pre-Deployment Checks
- [ ] Docker available
- [ ] Network configured
- [ ] Image prepared
- [ ] Baseline metrics captured

## Canary Instance Details
- **Container Name:** basset-hound-canary-$VERSION
- **Health Status:** $HEALTH_STATUS
- **Startup Time:** $STARTUP_TIME

## Metrics Analysis
### Baseline
- Memory: $BASELINE_MEMORY
- CPU: $BASELINE_CPU
- Connections: $BASELINE_CONNECTIONS

### Canary Performance
- Max Memory: $CANARY_MAX_MEMORY
- Avg CPU: $CANARY_AVG_CPU
- Peak Connections: $CANARY_PEAK_CONNECTIONS
- Error Rate: $CANARY_ERROR_RATE

## Validation Results
- [ ] Health checks passed
- [ ] Metrics within acceptable range
- [ ] No critical errors
- [ ] Response times nominal

## Decision
**Status:** $DECISION_STATUS
**Approved By:**
**Date:** $(date)

## Next Steps
1. If APPROVED: Proceed to Phase 1 (25% rollout)
2. If REJECTED: Execute rollback to previous version
3. Review logs: $DEPLOYMENT_LOG

---
Generated: $(date)
EOF

    log_info "✓ Canary report generated: $report_file"
}

# Interactive approval checkpoint
approval_checkpoint() {
    log_section "Canary Deployment Approval Checkpoint"

    echo ""
    echo "Canary deployment for version $VERSION completed."
    echo "Review the metrics and logs to determine if canary is healthy."
    echo ""
    echo "Metrics collected:"
    cat "${PROJECT_ROOT}/logs/deployment/canary-metrics-${VERSION}.jsonl" | tail -5 | jq '.' || true
    echo ""
    echo "Would you like to approve this canary deployment?"
    echo ""
    read -p "Enter [APPROVE/REJECT]: " approval

    case "$approval" in
        APPROVE)
            log_info "Canary deployment APPROVED"
            save_state "canary_approved" "Canary approved for progress to Phase 1"
            return 0
            ;;
        REJECT)
            log_info "Canary deployment REJECTED"
            save_state "canary_rejected" "Canary rejected - rollback initiated"
            return 1
            ;;
        *)
            log_error "Invalid input. Please enter APPROVE or REJECT"
            approval_checkpoint
            ;;
    esac
}

# Main deployment workflow
main() {
    log_section "Basset Hound Browser Canary Deployment v$VERSION"
    log_info "Deployment started by: $USER"
    log_info "Log file: $DEPLOYMENT_LOG"

    # Phase 1: Validation
    validate_prerequisites || { save_state "failed" "Prerequisites validation failed"; exit 1; }
    capture_baseline_metrics

    # Phase 2: Preparation
    prepare_image || { save_state "failed" "Image preparation failed"; exit 1; }

    # Phase 3: Canary Deployment
    deploy_canary_instance || { save_state "failed" "Canary deployment failed"; exit 1; }

    # Phase 4: Health Checks
    if ! health_check_canary; then
        save_state "failed" "Canary health checks failed"
        log_error "Canary deployment failed health checks"
        exit 1
    fi

    # Phase 5: Monitoring & Metrics
    log_info "Monitoring canary for 5 minutes (300 seconds)..."
    collect_canary_metrics 300

    # Phase 6: Validation
    if ! validate_canary_metrics; then
        log_warn "Canary metrics validation found issues"
        save_state "failed" "Canary metrics validation failed"
        exit 1
    fi

    # Phase 7: Report
    generate_canary_report

    # Phase 8: Approval
    if approval_checkpoint; then
        save_state "canary_approved" "Ready for Phase 1 (25% rollout)"
        log_info ""
        log_info "=========================================="
        log_info "CANARY DEPLOYMENT SUCCESSFUL"
        log_info "=========================================="
        log_info ""
        log_info "Next step: Run 'scripts/deploy-scale.sh $VERSION 25' to proceed to Phase 1"
        log_info ""
        return 0
    else
        save_state "canary_rejected" "Canary rejected - initiate rollback"
        log_error "Canary deployment rejected - initiating rollback"
        return 1
    fi
}

main "$@"
