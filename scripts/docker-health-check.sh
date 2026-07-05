#!/bin/bash
# Basset Hound Browser - Docker Health Check Script
# Comprehensive health monitoring for running container
# Usage: ./scripts/docker-health-check.sh [CONTAINER_NAME] [OPTIONS]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="${1:-basset-hound-browser}"
VERBOSE=${VERBOSE:-false}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $*"; }
log_error() { echo -e "${RED}[✗]${NC} $*"; }
log_section() { echo -e "\n${CYAN}=== $* ===${NC}"; }

# Usage
usage() {
    cat << EOF
Usage: $0 [CONTAINER_NAME] [OPTIONS]

Arguments:
  CONTAINER_NAME      Container name (default: basset-hound-browser)

Options:
  -v, --verbose       Show detailed output
  -w, --watch         Continuous monitoring (30s intervals)
  -h, --help          Show this help

Examples:
  $0                              # Check default container
  $0 basset-hound-browser-prod   # Check specific container
  $0 -v                           # Verbose output
  $0 -w                           # Watch mode
EOF
}

# Parse arguments
WATCH_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -w|--watch)
            WATCH_MODE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            CONTAINER_NAME="$1"
            shift
            ;;
    esac
done

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
fi

# Function to run health checks
run_health_checks() {
    log_section "Basset Hound Browser - Health Status"

    # Check if container exists
    if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_error "Container not found: $CONTAINER_NAME"
        return 1
    fi

    # Get container status
    STATUS=$(docker inspect "$CONTAINER_NAME" --format='{{.State.Status}}')
    if [ "$STATUS" != "running" ]; then
        log_error "Container is not running (status: $STATUS)"
        return 1
    fi
    log_success "Container running"

    # Get container health status
    HEALTH=$(docker inspect "$CONTAINER_NAME" --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")
    case "$HEALTH" in
        healthy)
            log_success "Health status: HEALTHY"
            ;;
        unhealthy)
            log_error "Health status: UNHEALTHY"
            if [ "$VERBOSE" = true ]; then
                docker inspect "$CONTAINER_NAME" --format='{{.State.Health.Log}}' | tail -3
            fi
            ;;
        starting)
            log_warn "Health status: STARTING"
            ;;
        *)
            log_warn "Health status: UNKNOWN (no health check configured)"
            ;;
    esac

    log_info ""

    # Memory usage
    log_section "Resource Usage"
    STATS=$(docker stats "$CONTAINER_NAME" --no-stream --format='{{.MemUsage}}\t{{.CPUPerc}}\t{{.MemPerc}}' 2>/dev/null || echo "unavailable")
    if [ "$STATS" != "unavailable" ]; then
        IFS=$'\t' read -r MEM_USAGE CPU_PERC MEM_PERC <<< "$STATS"
        log_info "Memory:   $MEM_USAGE"
        log_info "CPU:      $CPU_PERC"
        log_info "Mem %%:    $MEM_PERC"
    else
        log_warn "Unable to retrieve stats (container might be starting)"
    fi

    # Network information
    log_section "Network & Ports"
    PORTS=$(docker inspect "$CONTAINER_NAME" --format='{{range $p, $conf := .NetworkSettings.Ports}}{{$p}} -> {{(index $conf 0).HostIp}}:{{(index $conf 0).HostPort}} {{end}}' 2>/dev/null)
    if [ -n "$PORTS" ]; then
        log_info "$PORTS"
    else
        log_warn "No ports configured"
    fi

    # WebSocket connectivity test
    log_section "WebSocket Connectivity"
    WS_PORT=$(docker port "$CONTAINER_NAME" 8765 2>/dev/null | cut -d: -f2)
    if [ -n "$WS_PORT" ]; then
        if timeout 3 bash -c "echo > /dev/tcp/localhost/$WS_PORT" 2>/dev/null; then
            log_success "WebSocket port $WS_PORT is accessible"

            # Try to connect with curl (WebSocket upgrade test)
            if command -v curl &> /dev/null; then
                HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -i http://localhost:$WS_PORT 2>/dev/null || echo "000")
                case "$HTTP_CODE" in
                    426)
                        log_success "WebSocket server responding (HTTP 426 - upgrade required)"
                        ;;
                    200|101)
                        log_success "WebSocket server responding (HTTP $HTTP_CODE)"
                        ;;
                    *)
                        log_warn "WebSocket server returned HTTP $HTTP_CODE"
                        ;;
                esac
            fi
        else
            log_error "WebSocket port $WS_PORT is not accessible"
        fi
    else
        log_warn "WebSocket port not exposed"
    fi

    # Volume mounts
    log_section "Volume Mounts"
    VOLUMES=$(docker inspect "$CONTAINER_NAME" --format='{{range .Mounts}}{{.Source}} -> {{.Destination}} ({{.Mode}}){{println}}{{end}}' 2>/dev/null)
    if [ -n "$VOLUMES" ]; then
        echo "$VOLUMES" | while read -r line; do
            [ -n "$line" ] && log_info "$line"
        done
    else
        log_warn "No volumes attached"
    fi

    # Recent logs
    if [ "$VERBOSE" = true ]; then
        log_section "Recent Container Logs (last 10 lines)"
        docker logs "$CONTAINER_NAME" --tail 10 2>/dev/null | sed 's/^/  /'
    fi

    # Container details
    if [ "$VERBOSE" = true ]; then
        log_section "Container Details"
        docker inspect "$CONTAINER_NAME" --format='
        Created: {{.Created}}
        Started: {{.State.StartedAt}}
        Pid: {{.State.Pid}}
        Exit Code: {{.State.ExitCode}}
        Memory Limit: {{.HostConfig.Memory}}
        CPU Quota: {{.HostConfig.CpuQuota}}
        '
    fi

    log_info ""
    return 0
}

# Main execution
if [ "$WATCH_MODE" = true ]; then
    while true; do
        clear
        run_health_checks || true
        echo -e "\n${BLUE}[INFO]${NC} Next check in 30 seconds (Ctrl+C to exit)..."
        sleep 30
    done
else
    run_health_checks
fi
