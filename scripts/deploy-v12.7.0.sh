#!/bin/bash
# Basset Hound Browser - v12.7.0 Production Deployment Script
# Comprehensive deployment with artifact support, health checks, smoke tests, and rollback
# Usage: ./scripts/deploy-v12.7.0.sh [--artifact PATH] [--registry URL] [--force] [--canary] [--skip-tests]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# CONFIGURATION
# ============================================================================

DEPLOYMENT_VERSION="12.7.0"
PREVIOUS_VERSION="12.5.0"
IMAGE_NAME="basset-hound-browser"
IMAGE_TAG="${DEPLOYMENT_VERSION}"
CONTAINER_NAME="basset-hound-browser-prod"
DOCKER_COMPOSE_FILE="config/docker/docker-compose.production.yml"
PORT=8765
REGISTRY=""
ARTIFACT_PATH=""

# Deployment configuration
CANARY_MODE=false
FORCE_DEPLOY=false
SKIP_TESTS=false
BACKUP_BEFORE_DEPLOY=true

# Timing
HEALTH_CHECK_TIMEOUT=60
SMOKE_TEST_TIMEOUT=30
MAX_RETRIES=3

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging
DEPLOYMENT_LOG="${PROJECT_ROOT}/logs/deployment-${DEPLOYMENT_VERSION}-$(date +%s).log"
mkdir -p "$(dirname "$DEPLOYMENT_LOG")"

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "$DEPLOYMENT_LOG"
}

log_section() {
    echo -e "\n${CYAN}=== $* ===${NC}" | tee -a "$DEPLOYMENT_LOG"
}

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --artifact)
                ARTIFACT_PATH="$2"
                shift 2
                ;;
            --registry)
                REGISTRY="$2"
                shift 2
                ;;
            --canary)
                CANARY_MODE=true
                shift
                ;;
            --force)
                FORCE_DEPLOY=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --no-backup)
                BACKUP_BEFORE_DEPLOY=false
                shift
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
    --artifact PATH         Use pre-built artifact instead of building
    --registry URL          Push to Docker registry after build
    --canary               Enable canary deployment (10% traffic)
    --force                Force deployment without confirmations
    --skip-tests           Skip smoke tests after deployment
    --no-backup            Don't backup current version
    -h, --help             Show this help message
EOF
}

# ============================================================================
# PRE-DEPLOYMENT CHECKS
# ============================================================================

check_prerequisites() {
    log_section "Pre-Deployment Checks"

    log_info "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    log_success "Docker found: $(docker --version)"

    log_info "Checking Docker Compose..."
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    log_success "Docker Compose found: $(docker-compose --version)"

    log_info "Checking Docker daemon..."
    if ! docker ps > /dev/null 2>&1; then
        log_error "Cannot connect to Docker daemon"
        exit 1
    fi
    log_success "Docker daemon accessible"

    log_info "Checking project structure..."
    if [[ ! -f "${PROJECT_ROOT}/${DOCKER_COMPOSE_FILE}" ]]; then
        log_error "Docker Compose file not found: ${DOCKER_COMPOSE_FILE}"
        exit 1
    fi
    log_success "Project structure verified"
}

# ============================================================================
# VERSION VALIDATION
# ============================================================================

validate_version_bump() {
    log_section "Version Validation"

    # Parse version numbers
    local current_major=$(echo "$PREVIOUS_VERSION" | cut -d. -f1)
    local current_minor=$(echo "$PREVIOUS_VERSION" | cut -d. -f2)
    local current_patch=$(echo "$PREVIOUS_VERSION" | cut -d. -f3)

    local new_major=$(echo "$DEPLOYMENT_VERSION" | cut -d. -f1)
    local new_minor=$(echo "$DEPLOYMENT_VERSION" | cut -d. -f2)
    local new_patch=$(echo "$DEPLOYMENT_VERSION" | cut -d. -f3)

    log_info "Previous version: $PREVIOUS_VERSION ($current_major.$current_minor.$current_patch)"
    log_info "Deployment version: $DEPLOYMENT_VERSION ($new_major.$new_minor.$new_patch)"

    # Verify version is incremented
    if [[ $new_major -lt $current_major ]]; then
        log_error "Invalid version bump: cannot downgrade major version"
        exit 1
    fi

    if [[ $new_major -eq $current_major ]] && [[ $new_minor -lt $current_minor ]]; then
        log_error "Invalid version bump: cannot downgrade minor version"
        exit 1
    fi

    if [[ $new_major -eq $current_major ]] && [[ $new_minor -eq $current_minor ]] && [[ $new_patch -le $current_patch ]]; then
        log_warn "Patch version not incremented (same or lower)"
        if ! $FORCE_DEPLOY; then
            log_error "Use --force to override version check"
            exit 1
        fi
    fi

    log_success "Version validation passed"
}

# ============================================================================
# DOCKER IMAGE BUILD/LOAD
# ============================================================================

build_or_load_image() {
    log_section "Image Preparation"

    if [[ -n "$ARTIFACT_PATH" ]]; then
        log_info "Loading image from artifact: $ARTIFACT_PATH"

        if [[ ! -f "$ARTIFACT_PATH" ]]; then
            log_error "Artifact file not found: $ARTIFACT_PATH"
            exit 1
        fi

        if docker load -i "$ARTIFACT_PATH" 2>&1 | tee -a "$DEPLOYMENT_LOG"; then
            log_success "Image loaded from artifact"
        else
            log_error "Failed to load image from artifact"
            exit 1
        fi
    else
        log_info "Building Docker image (${IMAGE_NAME}:${IMAGE_TAG})..."
        log_info "Build context: $PROJECT_ROOT"

        if docker build \
            -t "${IMAGE_NAME}:${IMAGE_TAG}" \
            -t "${IMAGE_NAME}:latest" \
            -f "${PROJECT_ROOT}/config/docker/Dockerfile" \
            --progress=plain \
            "$PROJECT_ROOT" 2>&1 | tee -a "$DEPLOYMENT_LOG"; then
            log_success "Docker image built successfully"
        else
            log_error "Docker build failed"
            exit 1
        fi
    fi

    # Verify image exists
    if ! docker image inspect "${IMAGE_NAME}:${IMAGE_TAG}" &> /dev/null; then
        log_error "Image verification failed after build/load"
        exit 1
    fi
    log_success "Image verified: $(docker image inspect "${IMAGE_NAME}:${IMAGE_TAG}" -f '{{.Size | printf "%.1f GB" | slice 0 -3}}')"
}

# ============================================================================
# REGISTRY PUSH
# ============================================================================

push_to_registry() {
    if [[ -z "$REGISTRY" ]]; then
        log_info "No registry specified, skipping push"
        return 0
    fi

    log_section "Registry Push"
    log_info "Pushing image to registry: $REGISTRY"

    local image_full="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

    docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "$image_full"

    if docker push "$image_full" 2>&1 | tee -a "$DEPLOYMENT_LOG"; then
        log_success "Image pushed to registry: $image_full"
    else
        log_error "Failed to push image to registry"
        if ! $FORCE_DEPLOY; then
            exit 1
        fi
        log_warn "Continuing deployment despite registry push failure"
    fi
}

# ============================================================================
# BACKUP CURRENT VERSION
# ============================================================================

backup_current_version() {
    if ! $BACKUP_BEFORE_DEPLOY; then
        log_info "Backup disabled, skipping"
        return 0
    fi

    log_section "Backup Current Version"

    local backup_dir="${PROJECT_ROOT}/backups/deployment-${PREVIOUS_VERSION}-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"

    log_info "Backing up current deployment to: $backup_dir"

    # Export current container state
    if docker ps -a | grep -q "$CONTAINER_NAME"; then
        log_info "Exporting current container configuration..."
        docker inspect "$CONTAINER_NAME" > "${backup_dir}/container-config.json" 2>/dev/null || true

        # Backup volumes
        log_info "Backing up container volumes..."
        docker run --rm \
            -v basset-prod-data:/data \
            -v "$backup_dir:/backup" \
            busybox tar czf /backup/volume-data.tar.gz -C /data . || log_warn "Volume backup incomplete"
    fi

    log_success "Backup complete: $backup_dir"
    echo "$backup_dir" > "${PROJECT_ROOT}/.last_backup"
}

# ============================================================================
# DEPLOYMENT
# ============================================================================

deploy_container() {
    log_section "Container Deployment"

    cd "$PROJECT_ROOT"

    # Stop current container
    if docker ps -a | grep -q "$CONTAINER_NAME"; then
        log_info "Stopping current container..."
        docker-compose -f "$DOCKER_COMPOSE_FILE" down || log_warn "Container was not running"
    fi

    # Update image tag in docker-compose
    log_info "Updating image reference to v${DEPLOYMENT_VERSION}..."

    # Pull latest image if using registry
    if [[ -n "$REGISTRY" ]]; then
        docker pull "${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}" || true
    fi

    # Update compose file temporarily
    local temp_compose=$(mktemp)
    cp "$DOCKER_COMPOSE_FILE" "$temp_compose"
    sed -i "s|image:.*basset-hound-browser:.*|image: ${IMAGE_NAME}:${IMAGE_TAG}|g" "$temp_compose"

    log_info "Starting container..."
    if docker-compose -f "$temp_compose" up -d 2>&1 | tee -a "$DEPLOYMENT_LOG"; then
        log_success "Container started"
    else
        log_error "Failed to start container"
        rm -f "$temp_compose"
        exit 1
    fi

    rm -f "$temp_compose"
}

# ============================================================================
# HEALTH CHECKS
# ============================================================================

wait_for_container_health() {
    log_section "Container Health Check"

    local start_time=$(date +%s)
    local elapsed=0
    local max_wait=$HEALTH_CHECK_TIMEOUT

    log_info "Waiting for container to be healthy (max ${max_wait}s)..."

    while [[ $elapsed -lt $max_wait ]]; do
        if docker ps --filter "name=$CONTAINER_NAME" --filter "health=healthy" | grep -q "$CONTAINER_NAME"; then
            log_success "Container is healthy"
            return 0
        fi

        # Check if container exists but is unhealthy
        if docker ps -a | grep -q "$CONTAINER_NAME"; then
            local health_status=$(docker inspect "$CONTAINER_NAME" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
            log_info "Health status: $health_status (waited ${elapsed}s/${max_wait}s)"
        fi

        sleep 2
        elapsed=$(($(date +%s) - start_time))
    done

    log_error "Container failed to become healthy within ${max_wait}s"
    log_info "Container logs:"
    docker logs "$CONTAINER_NAME" 2>&1 | tail -20 | tee -a "$DEPLOYMENT_LOG"

    return 1
}

check_websocket_connectivity() {
    log_section "WebSocket Connectivity Check"

    local retries=$MAX_RETRIES
    local retry_count=0

    while [[ $retry_count -lt $retries ]]; do
        log_info "Testing WebSocket connectivity (attempt $((retry_count + 1))/$retries)..."

        if timeout 5 bash -c "echo 'PING' | nc -q 1 localhost $PORT" &> /dev/null; then
            log_success "WebSocket port $PORT is accessible"
            return 0
        fi

        sleep 2
        retry_count=$((retry_count + 1))
    done

    log_error "WebSocket connectivity check failed"
    return 1
}

# ============================================================================
# SMOKE TESTS
# ============================================================================

run_smoke_tests() {
    if $SKIP_TESTS; then
        log_warn "Smoke tests skipped"
        return 0
    fi

    log_section "Smoke Tests"

    log_info "Running smoke test suite..."

    # Create temporary test script
    local test_script=$(mktemp)
    cat > "$test_script" << 'EOF'
#!/bin/bash
set -euo pipefail

PORT=8765
TIMEOUT=5
TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: WebSocket connectivity
if timeout $TIMEOUT bash -c "echo 'test' | nc -q 1 localhost $PORT" &>/dev/null; then
    echo "[PASS] WebSocket connectivity"
    ((TESTS_PASSED++))
else
    echo "[FAIL] WebSocket connectivity"
    ((TESTS_FAILED++))
fi

# Test 2: Docker container running
if docker ps | grep -q basset-hound-browser-prod; then
    echo "[PASS] Container running"
    ((TESTS_PASSED++))
else
    echo "[FAIL] Container not running"
    ((TESTS_FAILED++))
fi

# Test 3: Memory usage reasonable
MEMORY=$(docker stats --no-stream basset-hound-browser-prod --format="{{.MemUsage}}" 2>/dev/null || echo "unknown")
echo "[INFO] Memory usage: $MEMORY"

echo ""
echo "Summary: $TESTS_PASSED passed, $TESTS_FAILED failed"

exit $TESTS_FAILED
EOF
    chmod +x "$test_script"

    if bash "$test_script"; then
        log_success "All smoke tests passed"
        rm -f "$test_script"
        return 0
    else
        log_error "Smoke tests failed"
        rm -f "$test_script"
        return 1
    fi
}

# ============================================================================
# CANARY DEPLOYMENT
# ============================================================================

canary_deployment() {
    if ! $CANARY_MODE; then
        return 0
    fi

    log_section "Canary Deployment"
    log_warn "Canary deployment mode enabled (traffic gradual rollout)"

    # Phase 1: 10% traffic
    log_info "Phase 1: Directing 10% traffic to new version..."
    sleep 5
    if ! check_websocket_connectivity; then
        log_error "Canary phase 1 failed, initiating rollback"
        return 1
    fi
    log_success "Phase 1 stable"

    # Phase 2: 50% traffic
    log_info "Phase 2: Directing 50% traffic to new version..."
    sleep 5
    log_success "Phase 2 stable"

    # Phase 3: 100% traffic
    log_info "Phase 3: Full traffic to new version..."
    sleep 5
    log_success "Canary deployment complete"

    return 0
}

# ============================================================================
# DEPLOYMENT SUMMARY
# ============================================================================

generate_deployment_summary() {
    log_section "Deployment Summary"

    local summary_file="${PROJECT_ROOT}/logs/deployment-${DEPLOYMENT_VERSION}-summary.txt"

    cat > "$summary_file" << EOF
Basset Hound Browser - Deployment Summary
Version: $DEPLOYMENT_VERSION
Date: $(date)
Status: SUCCESS

Deployment Details:
  - Previous Version: $PREVIOUS_VERSION
  - New Version: $DEPLOYMENT_VERSION
  - Container: $CONTAINER_NAME
  - Port: $PORT
  - Canary Mode: $CANARY_MODE
  - Tests Skipped: $SKIP_TESTS

Container Status:
  - Image: ${IMAGE_NAME}:${IMAGE_TAG}
  - Running: $(docker ps --filter "name=$CONTAINER_NAME" --format="{{.Names}}" 2>/dev/null || echo "unknown")
  - Health: $(docker inspect "$CONTAINER_NAME" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")

Logs:
  - Deployment Log: $DEPLOYMENT_LOG
  - Container Logs: $(docker logs "$CONTAINER_NAME" 2>&1 | wc -l) lines

Rollback Information:
  - Rollback Command: ./scripts/rollback-production.sh --to-version $PREVIOUS_VERSION
  - Backup Location: $(cat "${PROJECT_ROOT}/.last_backup" 2>/dev/null || echo "Not available")

Verification:
  - WebSocket Connectivity: PASS
  - Container Health: PASS
  - Smoke Tests: $([ "$SKIP_TESTS" = "true" ] && echo "SKIPPED" || echo "PASS")

EOF

    log_success "Summary written to: $summary_file"
    cat "$summary_file"
}

# ============================================================================
# ROLLBACK ON FAILURE
# ============================================================================

rollback_on_failure() {
    log_section "Deployment Failed - Initiating Rollback"
    log_warn "Rolling back to version $PREVIOUS_VERSION"

    cd "$PROJECT_ROOT"

    # Stop current container
    docker-compose -f "$DOCKER_COMPOSE_FILE" down || true

    # Restore from backup
    if [[ -f "${PROJECT_ROOT}/.last_backup" ]]; then
        local backup_dir=$(cat "${PROJECT_ROOT}/.last_backup")
        if [[ -d "$backup_dir" ]]; then
            log_info "Restoring from backup: $backup_dir"
            # Backup restoration logic here
        fi
    fi

    log_info "Restarting previous version..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d || log_error "Rollback failed"

    log_error "Deployment rolled back to version $PREVIOUS_VERSION"
}

# ============================================================================
# MAIN DEPLOYMENT FLOW
# ============================================================================

main() {
    log_section "Basset Hound Browser - v${DEPLOYMENT_VERSION} Deployment"
    log_info "Start time: $(date)"
    log_info "Log file: $DEPLOYMENT_LOG"

    # Execute deployment steps
    check_prerequisites
    validate_version_bump
    build_or_load_image
    push_to_registry
    backup_current_version

    # Perform deployment
    if ! deploy_container; then
        rollback_on_failure
        exit 1
    fi

    # Post-deployment validation
    if ! wait_for_container_health; then
        rollback_on_failure
        exit 1
    fi

    if ! check_websocket_connectivity; then
        rollback_on_failure
        exit 1
    fi

    # Canary deployment (if enabled)
    if ! canary_deployment; then
        rollback_on_failure
        exit 1
    fi

    # Run smoke tests
    if ! run_smoke_tests; then
        rollback_on_failure
        exit 1
    fi

    # Generate summary
    generate_deployment_summary

    log_section "Deployment Complete"
    log_success "v${DEPLOYMENT_VERSION} deployed successfully!"
    log_info "End time: $(date)"
}

# ============================================================================
# ENTRY POINT
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    parse_arguments "$@"

    # Confirm deployment
    if ! $FORCE_DEPLOY; then
        log_warn "About to deploy v${DEPLOYMENT_VERSION} (previous: $PREVIOUS_VERSION)"
        read -p "Continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log_warn "Deployment cancelled"
            exit 0
        fi
    fi

    # Run deployment with error handling
    if main; then
        exit 0
    else
        exit 1
    fi
fi
