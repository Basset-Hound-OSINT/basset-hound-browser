#!/bin/bash
# Basset Hound Browser - Docker Run Script
# Starts a production-ready container with optimized settings
# Usage: ./scripts/docker-run.sh [OPTIONS]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="basset-hound-browser"
IMAGE_TAG="${IMAGE_TAG:-12.7.0}"
CONTAINER_NAME="${CONTAINER_NAME:-basset-hound-browser}"
WS_PORT="${WS_PORT:-8765}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
  --port PORT              WebSocket port (default: 8765)
  --env FILE               Load environment from .env file
  --detach                 Run in background (default)
  --interactive            Run in foreground with logs
  --remove                 Remove container if it exists
  --name NAME              Container name (default: basset-hound-browser)
  --cpu-limit CPU          CPU limit (default: 2.0)
  --memory-limit MEM       Memory limit (default: 2G)
  --help                   Show this help message

Examples:
  $0                                    # Start with defaults
  $0 --port 9000                       # Use custom WebSocket port
  $0 --env .env.production             # Load custom environment
  $0 --interactive                     # Run with live logs
  $0 --cpu-limit 4 --memory-limit 4G  # Increase resources
EOF
}

# Parse arguments
DETACH=true
INTERACTIVE=false
REMOVE_EXISTING=false
ENV_FILE=".env"
CPU_LIMIT="2.0"
MEMORY_LIMIT="2G"

while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            WS_PORT="$2"
            shift 2
            ;;
        --env)
            ENV_FILE="$2"
            shift 2
            ;;
        --interactive)
            DETACH=false
            INTERACTIVE=true
            shift
            ;;
        --detach)
            DETACH=true
            INTERACTIVE=false
            shift
            ;;
        --remove)
            REMOVE_EXISTING=true
            shift
            ;;
        --name)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        --cpu-limit)
            CPU_LIMIT="$2"
            shift 2
            ;;
        --memory-limit)
            MEMORY_LIMIT="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            ;;
    esac
done

# Pre-flight checks
log_info "=== Basset Hound Browser - Docker Run ==="
log_info "Image: $IMAGE_NAME:$IMAGE_TAG"
log_info "Container: $CONTAINER_NAME"
log_info "WebSocket port: $WS_PORT"
log_info ""

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
fi
log_success "Docker available"

# Check image exists
if ! docker image inspect "$IMAGE_NAME:$IMAGE_TAG" >/dev/null 2>&1; then
    log_error "Image not found: $IMAGE_NAME:$IMAGE_TAG"
fi
log_success "Image found"

# Check for running container
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    if [ "$REMOVE_EXISTING" = true ]; then
        log_warn "Removing existing container: $CONTAINER_NAME"
        docker stop "$CONTAINER_NAME" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
        sleep 1
    else
        log_warn "Container already exists: $CONTAINER_NAME"
        read -p "Stop and restart? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker stop "$CONTAINER_NAME"
            docker rm "$CONTAINER_NAME"
            sleep 1
        else
            log_info "Using existing container. Run 'docker logs -f $CONTAINER_NAME' to view logs."
            exit 0
        fi
    fi
fi

# Load environment file if it exists
ENV_ARGS=""
if [ -f "$ENV_FILE" ]; then
    log_info "Loading environment from: $ENV_FILE"
    ENV_ARGS="--env-file $ENV_FILE"
else
    log_warn "Environment file not found: $ENV_FILE (using defaults)"
fi

log_info ""
log_info "=== Starting Container ==="

# Build docker run command
RUN_CMD="docker run \
    --name $CONTAINER_NAME \
    --detach \
    $ENV_ARGS \
    -p $WS_PORT:8765 \
    --cpus=$CPU_LIMIT \
    --memory=$MEMORY_LIMIT \
    --memory-reservation=512m \
    --cap-drop=ALL \
    --cap-add=SYS_ADMIN \
    --security-opt=no-new-privileges:true \
    -v basset-data:/app/data \
    -v basset-logs:/app/logs \
    -v basset-cache:/app/cache \
    -v basset-screenshots:/app/screenshots \
    -v basset-downloads:/app/downloads \
    -v basset-recordings:/app/recordings \
    --restart=on-failure:5 \
    --health-cmd='/app/health-check.sh' \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    --health-start-period=40s \
    --label='service=basset-hound-browser' \
    --label='version=12.7.0' \
    $IMAGE_NAME:$IMAGE_TAG"

# Create volumes if they don't exist
for vol in data logs cache screenshots downloads recordings; do
    docker volume create "basset-$vol" 2>/dev/null || true
done

# Run the container
if eval "$RUN_CMD"; then
    log_success "Container started: $CONTAINER_NAME"

    # Wait for container to be ready
    sleep 2

    # Check container status
    STATUS=$(docker inspect "$CONTAINER_NAME" --format='{{.State.Status}}')
    log_info "Container status: $STATUS"

    log_info ""
    log_info "=== Next Steps ==="
    log_info "View logs:        docker logs -f $CONTAINER_NAME"
    log_info "Health status:    docker inspect $CONTAINER_NAME --format='{{.State.Health.Status}}'"
    log_info "WebSocket:        ws://localhost:$WS_PORT"
    log_info "Stop container:   docker stop $CONTAINER_NAME"
    log_info "Remove container: docker rm $CONTAINER_NAME"
else
    log_error "Failed to start container"
fi
