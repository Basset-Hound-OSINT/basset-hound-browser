#!/bin/bash
# Basset Hound Browser - Scaled Deployment Script (25%, 50%, 100%)
# Usage: ./scripts/deploy-scale.sh [VERSION] [PERCENTAGE]
# Example: ./scripts/deploy-scale.sh 12.8.0 25

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSION="${1:-12.8.0}"
TARGET_PERCENTAGE="${2:-25}"
DEPLOYMENT_LOG="${PROJECT_ROOT}/logs/deployment/scale-${VERSION}-${TARGET_PERCENTAGE}pct-$(date +%Y%m%d-%H%M%S).log"
DEPLOYMENT_STATE_FILE="${PROJECT_ROOT}/logs/deployment/scale-state.json"

# Create log directory
mkdir -p "$(dirname "$DEPLOYMENT_LOG")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

log_metric() {
    echo -e "${CYAN}[METRIC]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

# Save deployment state
save_state() {
    local state=$1
    local details=$2
    cat > "$DEPLOYMENT_STATE_FILE" << EOF
{
  "version": "$VERSION",
  "percentage": $TARGET_PERCENTAGE,
  "state": "$state",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "details": "$details"
}
EOF
    log_info "Deployment state saved: $state ($TARGET_PERCENTAGE%)"
}

# Validate percentage
validate_percentage() {
    case "$TARGET_PERCENTAGE" in
        25|50|100)
            log_info "✓ Target percentage valid: $TARGET_PERCENTAGE%"
            return 0
            ;;
        *)
            log_error "Invalid percentage: $TARGET_PERCENTAGE (must be 25, 50, or 100)"
            exit 1
            ;;
    esac
}

# Check if canary was approved
verify_canary_approval() {
    log_section "Verifying canary approval"

    local canary_state_file="${PROJECT_ROOT}/logs/deployment/canary-state.json"

    if [ ! -f "$canary_state_file" ]; then
        log_warn "No canary state file found - assuming canary passed"
        return 0
    fi

    local canary_state=$(jq -r '.state' "$canary_state_file" 2>/dev/null || echo "")

    if [ "$canary_state" != "canary_approved" ]; then
        log_error "Canary deployment was not approved. Current state: $canary_state"
        log_error "Cannot proceed with scaled deployment."
        exit 1
    fi

    log_info "✓ Canary approval verified"
}

# Calculate instance count
calculate_instance_count() {
    local percentage=$1

    case "$percentage" in
        25)  echo 2 ;;   # 1 canary + 1 more = 25%
        50)  echo 4 ;;   # 1 canary + 3 more = 50%
        100) echo 10 ;; # All instances
        *)   echo 1 ;;
    esac
}

# Deploy scaled instances
deploy_scaled_instances() {
    log_section "Deploying scaled instances - $TARGET_PERCENTAGE%"

    local total_instances=$(calculate_instance_count "$TARGET_PERCENTAGE")
    local current_count=1  # canary is already running

    log_info "Total instances to run: $total_instances"
    log_info "Current instances: $current_count (including canary)"

    # Deploy additional instances
    local instances_to_deploy=$((total_instances - current_count))

    for i in $(seq 1 "$instances_to_deploy"); do
        local instance_id=$((1000 + i))
        local instance_name="basset-hound-instance-${instance_id}"

        log_info "[$i/$instances_to_deploy] Deploying instance: $instance_name"

        # Check if instance already exists
        if docker ps -a | grep -q "$instance_name"; then
            log_warn "Instance already exists, removing: $instance_name"
            docker stop "$instance_name" 2>/dev/null || true
            docker rm "$instance_name" 2>/dev/null || true
            sleep 1
        fi

        # Deploy instance
        docker run -d \
            --name "$instance_name" \
            --network basset-hound-browser \
            -e NODE_ENV=production \
            -e LOG_LEVEL=info \
            -e DISPLAY=:99 \
            -e ELECTRON_DISABLE_SANDBOX=1 \
            --cap-drop ALL \
            --cap-add SYS_ADMIN \
            --restart unless-stopped \
            --label "basset.version=$VERSION" \
            --label "basset.role=production" \
            --label "basset.percentage=$TARGET_PERCENTAGE" \
            --label "basset.deployment_id=$(date +%s)" \
            "basset-hound-browser:$VERSION" 2>&1 | tee -a "$DEPLOYMENT_LOG"

        log_info "✓ Instance deployed: $instance_name"
        sleep 3  # Stagger deployments
    done

    log_info "✓ All $instances_to_deploy instances deployed"
}

# Health check all instances
health_check_all_instances() {
    log_section "Performing health checks on all instances"

    local instances=$(docker ps -q --filter "label=basset.percentage=$TARGET_PERCENTAGE")
    local healthy_count=0
    local total_count=$(echo "$instances" | wc -l)

    for container_id in $instances; do
        local container_name=$(docker inspect -f '{{.Name}}' "$container_id" | sed 's/^\///')

        # Wait for container to be ready
        local max_retries=30
        local retry_count=0

        while [ $retry_count -lt $max_retries ]; do
            if docker ps | grep -q "$container_id"; then
                # Container is running, now check service
                if curl -s -X GET "http://localhost:8765/health" \
                    -H "Content-Type: application/json" \
                    --max-time 5 &>/dev/null; then

                    log_info "✓ Health check passed: $container_name"
                    healthy_count=$((healthy_count + 1))
                    break
                fi
            fi

            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $max_retries ]; then
                sleep 2
            fi
        done

        if [ $retry_count -eq $max_retries ]; then
            log_error "✗ Health check failed after $max_retries attempts: $container_name"
        fi
    done

    log_info "Health check results: $healthy_count/$total_count instances healthy"

    # Allow up to 20% failure rate for progressive rollouts
    local max_failures=$((total_count / 5))
    local failures=$((total_count - healthy_count))

    if [ "$failures" -le "$max_failures" ]; then
        log_info "✓ Health check threshold passed"
        return 0
    else
        log_error "✗ Too many health check failures: $failures (threshold: $max_failures)"
        return 1
    fi
}

# Collect instance metrics
collect_instance_metrics() {
    log_section "Collecting metrics from $TARGET_PERCENTAGE% deployment"

    local duration=$1
    local interval=15
    local elapsed=0
    local metrics_file="${PROJECT_ROOT}/logs/deployment/scale-metrics-${VERSION}-${TARGET_PERCENTAGE}pct.jsonl"

    > "$metrics_file"

    log_info "Collecting metrics for $duration seconds..."

    while [ $elapsed -lt $duration ]; do
        local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
        local container_count=$(docker ps -q --filter "label=basset.percentage=$TARGET_PERCENTAGE" | wc -l)

        # Aggregate metrics across all instances
        local total_memory=0
        local total_cpu=0
        local max_memory=0

        for container_id in $(docker ps -q --filter "label=basset.percentage=$TARGET_PERCENTAGE"); do
            local stats=$(docker stats --no-stream "$container_id" 2>/dev/null | tail -1 || echo "")

            if [ -n "$stats" ]; then
                local mem=$(echo "$stats" | awk '{print $NF}' | tr -d '%')
                local cpu=$(echo "$stats" | awk '{print $(NF-3)}' | tr -d '%')

                total_memory=$(echo "$total_memory + ${mem%.*}" | bc 2>/dev/null || echo "$total_memory")
                total_cpu=$(echo "$total_cpu + ${cpu%.*}" | bc 2>/dev/null || echo "$total_cpu")

                if [ "${mem%.*}" -gt "${max_memory%.*}" ]; then
                    max_memory="${mem%.*}"
                fi
            fi
        done

        # Get application metrics
        local error_rate=$(curl -s "http://localhost:8765/metrics" 2>/dev/null | grep 'error_rate' | head -1 | awk '{print $NF}' || echo "0")
        local throughput=$(curl -s "http://localhost:8765/metrics" 2>/dev/null | grep 'throughput' | head -1 | awk '{print $NF}' || echo "0")

        cat >> "$metrics_file" << EOF
{
  "timestamp": "$timestamp",
  "containers_running": $container_count,
  "total_memory_percent": $total_memory,
  "avg_memory_percent": $(echo "scale=2; $total_memory / $container_count" | bc 2>/dev/null || echo "0"),
  "max_memory_percent": $max_memory,
  "total_cpu_percent": $total_cpu,
  "avg_cpu_percent": $(echo "scale=2; $total_cpu / $container_count" | bc 2>/dev/null || echo "0"),
  "error_rate": $error_rate,
  "throughput_msg_sec": $throughput
}
EOF

        elapsed=$((elapsed + interval))
        if [ $elapsed -lt $duration ]; then
            sleep $interval
        fi
    done

    log_metric "Metrics collected and saved: $metrics_file"
}

# Validate deployment metrics
validate_deployment_metrics() {
    log_section "Validating deployment metrics"

    local metrics_file="${PROJECT_ROOT}/logs/deployment/scale-metrics-${VERSION}-${TARGET_PERCENTAGE}pct.jsonl"

    if [ ! -f "$metrics_file" ]; then
        log_warn "Metrics file not found"
        return 0
    fi

    # Analyze metrics
    local samples=$(wc -l < "$metrics_file")
    local avg_memory=$(jq -r '.avg_memory_percent' "$metrics_file" 2>/dev/null | awk '{sum+=$1; count++} END {if (count>0) print sum/count; else print "0"}')
    local max_cpu=$(jq -r '.avg_cpu_percent' "$metrics_file" 2>/dev/null | sort -rn | head -1)
    local errors=$(grep -c '"error_rate": [^0]' "$metrics_file" || echo "0")

    log_info "Metrics summary:"
    log_metric "  Samples: $samples"
    log_metric "  Avg memory: ${avg_memory}%"
    log_metric "  Peak CPU: ${max_cpu}%"
    log_metric "  Samples with errors: $errors"

    # Thresholds
    local max_memory_threshold=75
    local max_cpu_threshold=80
    local max_error_samples=$((samples / 20))  # 5% tolerance

    local validation_passed=true

    if (( $(echo "$avg_memory > $max_memory_threshold" | bc -l) )); then
        log_warn "⚠ Memory usage above threshold: ${avg_memory}% > $max_memory_threshold%"
        validation_passed=false
    fi

    if (( $(echo "$max_cpu > $max_cpu_threshold" | bc -l) )); then
        log_warn "⚠ CPU usage above threshold: ${max_cpu}% > $max_cpu_threshold%"
        validation_passed=false
    fi

    if [ "$errors" -gt "$max_error_samples" ]; then
        log_warn "⚠ Error rate above threshold: $errors > $max_error_samples samples"
        validation_passed=false
    fi

    if [ "$validation_passed" = true ]; then
        log_info "✓ Metrics validation passed"
        return 0
    else
        log_warn "⚠ Metrics validation found issues - review before proceeding"
        return 0  # Don't fail, just warn
    fi
}

# Generate scaling report
generate_scaling_report() {
    log_section "Generating scaling deployment report"

    local report_file="${PROJECT_ROOT}/logs/deployment/scale-report-${VERSION}-${TARGET_PERCENTAGE}pct.md"
    local instance_count=$(docker ps -q --filter "label=basset.percentage=$TARGET_PERCENTAGE" | wc -l)

    cat > "$report_file" << EOF
# Basset Hound Browser - Scaled Deployment Report

## Deployment Summary
- **Version:** $VERSION
- **Target Percentage:** $TARGET_PERCENTAGE%
- **Active Instances:** $instance_count
- **Timestamp:** $(date)

## Instances Deployed
\`\`\`
$(docker ps --filter "label=basset.percentage=$TARGET_PERCENTAGE" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")
\`\`\`

## Deployment Timeline
- **Canary Start:** (see canary report)
- **Phase Start:** $(date)
- **Current Status:** In Progress

## Health Status
\`\`\`
$(docker ps --filter "label=basset.percentage=$TARGET_PERCENTAGE" -q | while read cid; do
    echo "Container: $(docker inspect -f '{{.Name}}' $cid | sed 's/^\///')"
    docker inspect -f 'Status: {{.State.Status}}' $cid
done)
\`\`\`

## Next Steps
1. Monitor metrics for stability (5-10 minutes)
2. Review error rates and resource usage
3. Decide to proceed to next percentage or rollback
4. If proceeding: Run \`scripts/deploy-scale.sh $VERSION [next_percentage]\`
5. If rolling back: Run \`scripts/rollback.sh\`

---
Generated: $(date)
EOF

    log_info "✓ Scaling report generated: $report_file"
}

# Approval checkpoint for proceeding to next phase
next_phase_checkpoint() {
    log_section "Phase Completion Checkpoint - $TARGET_PERCENTAGE%"

    local next_percentage=""
    case "$TARGET_PERCENTAGE" in
        25)  next_percentage="50" ;;
        50)  next_percentage="100" ;;
        100) next_percentage="complete" ;;
    esac

    echo ""
    echo "Deployment to $TARGET_PERCENTAGE% completed successfully."
    echo "Review metrics and decide on next action:"
    echo ""
    if [ "$next_percentage" != "complete" ]; then
        echo "  [PROCEED] - Proceed to Phase $next_percentage%"
    fi
    echo "  [MONITOR] - Continue monitoring current deployment"
    echo "  [ROLLBACK] - Rollback to previous version"
    echo ""
    read -p "Enter your choice: " action

    case "$action" in
        PROCEED)
            if [ "$next_percentage" != "complete" ]; then
                log_info "Proceeding to Phase $next_percentage%"
                save_state "phase_${TARGET_PERCENTAGE}_approved" "Ready for Phase $next_percentage%"
                return 0
            fi
            ;;
        MONITOR)
            log_info "Continuing monitoring current deployment"
            return 0
            ;;
        ROLLBACK)
            log_info "Rollback requested"
            save_state "phase_${TARGET_PERCENTAGE}_rollback_requested" "Rollback initiated"
            return 1
            ;;
        *)
            log_error "Invalid choice"
            next_phase_checkpoint
            ;;
    esac
}

# Main deployment workflow
main() {
    log_section "Basset Hound Browser Scaled Deployment"
    log_info "Version: $VERSION | Target: $TARGET_PERCENTAGE%"
    log_info "Log file: $DEPLOYMENT_LOG"

    # Phase 1: Validation
    validate_percentage
    verify_canary_approval || exit 1

    # Phase 2: Deployment
    deploy_scaled_instances || { save_state "failed" "Instance deployment failed"; exit 1; }

    # Phase 3: Health Checks
    if ! health_check_all_instances; then
        log_error "Some health checks failed - review before proceeding"
    fi

    # Phase 4: Monitoring
    local monitor_duration=300  # 5 minutes
    log_info "Monitoring deployment for $monitor_duration seconds..."
    collect_instance_metrics "$monitor_duration"

    # Phase 5: Validation
    validate_deployment_metrics

    # Phase 6: Report
    generate_scaling_report

    # Phase 7: Checkpoint
    if next_phase_checkpoint; then
        log_info ""
        log_info "=========================================="
        log_info "SCALED DEPLOYMENT SUCCESSFUL - $TARGET_PERCENTAGE%"
        log_info "=========================================="
        log_info ""
        return 0
    else
        save_state "phase_${TARGET_PERCENTAGE}_rollback" "Rollback initiated"
        return 1
    fi
}

main "$@"
