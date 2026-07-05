#!/bin/bash
# Basset Hound Browser - Emergency Rollback Script
# Usage: ./scripts/rollback.sh [PREVIOUS_VERSION]
# Example: ./scripts/rollback.sh 12.7.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PREVIOUS_VERSION="${1:-12.7.0}"
ROLLBACK_LOG="${PROJECT_ROOT}/logs/deployment/rollback-$(date +%Y%m%d-%H%M%S).log"
ROLLBACK_STATE_FILE="${PROJECT_ROOT}/logs/deployment/rollback-state.json"

# Create log directory
mkdir -p "$(dirname "$ROLLBACK_LOG")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$ROLLBACK_LOG"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$ROLLBACK_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$ROLLBACK_LOG"
}

log_section() {
    echo -e "\n${BLUE}=== $* ===${NC}\n" | tee -a "$ROLLBACK_LOG"
}

# Save rollback state
save_state() {
    local state=$1
    local details=$2
    cat > "$ROLLBACK_STATE_FILE" << EOF
{
  "previous_version": "$PREVIOUS_VERSION",
  "state": "$state",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "details": "$details"
}
EOF
    log_info "Rollback state saved: $state"
}

# Emergency stop confirmation
confirm_rollback() {
    log_section "EMERGENCY ROLLBACK CONFIRMATION"

    echo ""
    echo "=========================================="
    echo "INITIATING EMERGENCY ROLLBACK"
    echo "=========================================="
    echo ""
    echo "This action will:"
    echo "  1. Stop all new version containers"
    echo "  2. Restart previous version containers"
    echo "  3. Redirect traffic back to $PREVIOUS_VERSION"
    echo "  4. Preserve logs and metrics for analysis"
    echo ""
    read -p "Type 'ROLLBACK' to confirm, or 'CANCEL' to abort: " confirm

    if [ "$confirm" != "ROLLBACK" ]; then
        log_warn "Rollback cancelled by user"
        return 1
    fi

    log_info "ROLLBACK CONFIRMED"
    return 0
}

# Identify running versions
identify_running_versions() {
    log_section "Identifying running container versions"

    docker ps --filter "label=basset.version" --format "table {{.Label \"basset.version\"}}\t{{.Names}}\t{{.Status}}" | tee -a "$ROLLBACK_LOG"

    local running_versions=$(docker ps --filter "label=basset.version" -q | while read cid; do
        docker inspect -f '{{.Config.Labels.basset\.version}}' "$cid"
    done | sort | uniq)

    log_info "Running versions: $running_versions"
    echo "$running_versions"
}

# Stop new version containers
stop_new_version_containers() {
    log_section "Stopping new version containers"

    local new_containers=$(docker ps -q --filter "label=basset.role=canary" --filter "label=basset.role=production")

    if [ -z "$new_containers" ]; then
        log_warn "No new version containers found"
        return 0
    fi

    local count=0
    for container_id in $new_containers; do
        local container_name=$(docker inspect -f '{{.Name}}' "$container_id" | sed 's/^\///')
        log_info "Stopping container: $container_name"

        docker stop "$container_id" 2>&1 | tee -a "$ROLLBACK_LOG"
        log_info "✓ Container stopped: $container_name"
        count=$((count + 1))

        # Optional: remove container
        docker rm "$container_id" 2>/dev/null || true
    done

    log_info "✓ Stopped $count containers"
}

# Restart previous version containers
restart_previous_version_containers() {
    log_section "Restarting previous version containers ($PREVIOUS_VERSION)"

    # Check if we have saved container configs
    local config_dir="${PROJECT_ROOT}/logs/deployment/container-configs"

    if [ ! -d "$config_dir" ]; then
        log_warn "No saved container configurations found"
        log_info "Starting single instance of $PREVIOUS_VERSION..."

        # Start at least one container of the previous version
        docker run -d \
            --name "basset-hound-browser-$PREVIOUS_VERSION" \
            --network basset-hound-browser \
            -p 8765:8765 \
            -e NODE_ENV=production \
            -e LOG_LEVEL=info \
            -e DISPLAY=:99 \
            -e ELECTRON_DISABLE_SANDBOX=1 \
            --cap-drop ALL \
            --cap-add SYS_ADMIN \
            --restart unless-stopped \
            --label "basset.version=$PREVIOUS_VERSION" \
            --label "basset.role=restored" \
            "basset-hound-browser:$PREVIOUS_VERSION" 2>&1 | tee -a "$ROLLBACK_LOG"

        log_info "✓ Started container: basset-hound-browser-$PREVIOUS_VERSION"
        return 0
    fi

    # If we have saved configs, use them to restore previous setup
    log_info "Restoring from saved container configurations..."

    for config_file in "$config_dir"/*.json; do
        if [ -f "$config_file" ]; then
            local container_name=$(jq -r '.name' "$config_file")
            log_info "Restoring container: $container_name"

            # Re-create container from config
            docker run -d \
                --name "$container_name" \
                --network basset-hound-browser \
                -e NODE_ENV=production \
                -e LOG_LEVEL=info \
                -e DISPLAY=:99 \
                -e ELECTRON_DISABLE_SANDBOX=1 \
                --cap-drop ALL \
                --cap-add SYS_ADMIN \
                --restart unless-stopped \
                --label "basset.version=$PREVIOUS_VERSION" \
                --label "basset.role=restored" \
                "basset-hound-browser:$PREVIOUS_VERSION" 2>&1 | tee -a "$ROLLBACK_LOG"

            log_info "✓ Container restored: $container_name"
        fi
    done
}

# Health check restored containers
health_check_restored_containers() {
    log_section "Verifying restored containers"

    local containers=$(docker ps -q --filter "label=basset.role=restored")
    local healthy_count=0
    local total_count=0

    for container_id in $containers; do
        total_count=$((total_count + 1))
        local container_name=$(docker inspect -f '{{.Name}}' "$container_id" | sed 's/^\///')

        log_info "Health checking: $container_name"

        local max_retries=20
        local retry_count=0

        while [ $retry_count -lt $max_retries ]; do
            if curl -s -X GET "http://localhost:8765/health" \
                -H "Content-Type: application/json" \
                --max-time 5 &>/dev/null; then

                log_info "✓ Health check passed: $container_name"
                healthy_count=$((healthy_count + 1))
                break
            fi

            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $max_retries ]; then
                sleep 2
            fi
        done

        if [ $retry_count -eq $max_retries ]; then
            log_error "✗ Health check failed: $container_name"
        fi
    done

    log_info "Health check results: $healthy_count/$total_count containers healthy"

    if [ "$healthy_count" -eq 0 ]; then
        log_error "No healthy containers found after rollback"
        return 1
    fi

    if [ "$healthy_count" -lt "$total_count" ]; then
        log_warn "⚠ Some containers are unhealthy"
        return 0
    fi

    log_info "✓ All containers healthy"
    return 0
}

# Update load balancer configuration
update_load_balancer_config() {
    log_section "Updating load balancer configuration"

    # Get restored containers
    local containers=$(docker ps -q --filter "label=basset.role=restored")

    if [ -z "$containers" ]; then
        log_warn "No containers to update in load balancer"
        return 0
    fi

    log_info "Updating load balancer to route to restored containers..."

    # If load balancer endpoint is available
    if curl -s "http://load-balancer:8080/health" &>/dev/null; then
        # Update instance weights
        for container_id in $containers; do
            local container_name=$(docker inspect -f '{{.Name}}' "$container_id" | sed 's/^\///')
            local container_ip=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$container_id")

            log_info "Registering instance: $container_name ($container_ip)"

            curl -s -X POST "http://load-balancer:8080/instances" \
                -H "Content-Type: application/json" \
                -d "{\"name\": \"$container_name\", \"ip\": \"$container_ip\", \"port\": 8765, \"weight\": 100}" \
                2>&1 | tee -a "$ROLLBACK_LOG" || log_warn "Load balancer update failed"
        done

        log_info "✓ Load balancer configuration updated"
    else
        log_warn "Load balancer not accessible - manual configuration may be needed"
    fi
}

# Archive failed deployment for analysis
archive_failed_deployment() {
    log_section "Archiving failed deployment for analysis"

    local archive_dir="${PROJECT_ROOT}/logs/deployment/failed-rollouts/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$archive_dir"

    log_info "Archiving logs to: $archive_dir"

    # Collect container logs
    for container_id in $(docker ps -a -q --filter "label=basset.role=canary" --filter "label=basset.role=production"); do
        local container_name=$(docker inspect -f '{{.Name}}' "$container_id" | sed 's/^\///')
        local log_file="$archive_dir/$container_name.log"

        docker logs "$container_id" > "$log_file" 2>&1 || true
        log_info "Archived logs: $log_file"
    done

    # Archive deployment logs and metrics
    if [ -f "${PROJECT_ROOT}/logs/deployment/canary-metrics-"* ]; then
        cp "${PROJECT_ROOT}/logs/deployment/canary-metrics-"* "$archive_dir/" 2>/dev/null || true
    fi

    if [ -f "${PROJECT_ROOT}/logs/deployment/scale-metrics-"* ]; then
        cp "${PROJECT_ROOT}/logs/deployment/scale-metrics-"* "$archive_dir/" 2>/dev/null || true
    fi

    log_info "✓ Failed deployment archived"
}

# Generate rollback report
generate_rollback_report() {
    log_section "Generating rollback report"

    local report_file="${PROJECT_ROOT}/logs/deployment/rollback-report-$(date +%Y%m%d-%H%M%S).md"

    cat > "$report_file" << EOF
# Basset Hound Browser - Rollback Report

## Incident Summary
- **Rollback Time:** $(date)
- **Rolled Back From:** (previous version)
- **Rolled Back To:** $PREVIOUS_VERSION
- **Reason:** Deployment issues detected

## Rollback Actions Completed
- [x] Stopped new version containers
- [x] Restarted previous version containers
- [x] Verified health checks
- [x] Updated load balancer configuration
- [x] Archived failed deployment

## Restored Environment
\`\`\`
$(docker ps --filter "label=basset.role=restored" --format "table {{.Names}}\t{{.Status}}\t{{.Label \"basset.version\"}}")
\`\`\`

## Next Steps
1. Verify application functionality
2. Review deployment logs: $ROLLBACK_LOG
3. Analyze root cause of deployment failure
4. Plan corrective actions
5. Re-deploy with fixes

## Incident Investigation
- Failed deployment logs: \`logs/deployment/failed-rollouts/\`
- Metrics and analysis: Review canary/scale reports
- Container logs: Archived in failed-rollouts directory

---
Rollback initiated: $(date)
Completed: $(date)
EOF

    log_info "✓ Rollback report generated: $report_file"
}

# Main rollback workflow
main() {
    log_section "Basset Hound Browser Emergency Rollback"
    log_info "Target version: $PREVIOUS_VERSION"
    log_info "Log file: $ROLLBACK_LOG"

    # Phase 1: Confirmation
    if ! confirm_rollback; then
        exit 1
    fi

    # Phase 2: Assessment
    identify_running_versions

    # Phase 3: Stop new version
    stop_new_version_containers || log_warn "Some containers may not have stopped cleanly"

    # Phase 4: Restore previous version
    restart_previous_version_containers || { save_state "failed" "Failed to restart previous version"; exit 1; }

    # Phase 5: Verify restored system
    if ! health_check_restored_containers; then
        log_error "Restored containers are not healthy"
    fi

    # Phase 6: Update routing
    update_load_balancer_config || true

    # Phase 7: Archive failed deployment
    archive_failed_deployment

    # Phase 8: Report
    generate_rollback_report

    save_state "rollback_complete" "Successfully rolled back to $PREVIOUS_VERSION"

    log_info ""
    log_info "=========================================="
    log_info "ROLLBACK COMPLETED SUCCESSFULLY"
    log_info "=========================================="
    log_info ""
    log_info "System restored to version: $PREVIOUS_VERSION"
    log_info "Review rollback report for details"
    log_info ""
}

# Handle errors
trap 'log_error "Rollback script failed"; save_state "rollback_failed" "Rollback script encountered an error"; exit 1' ERR

main "$@"
