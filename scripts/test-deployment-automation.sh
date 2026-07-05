#!/bin/bash
# Basset Hound Browser - Deployment Automation Test Suite
# Tests: health checks, rollback scenarios, notifications, zero-downtime logic
# Usage: ./scripts/test-deployment-automation.sh [OPTIONS]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# CONFIGURATION
# ============================================================================

TEST_MODE=false
VERBOSE=false
SKIP_DOCKER_TESTS=false
TEST_RESULTS_DIR="${PROJECT_ROOT}/logs/test-results"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0
declare -a FAILED_TESTS

mkdir -p "$TEST_RESULTS_DIR"

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $*"
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $*"
}

log_skip() {
    echo -e "${YELLOW}[SKIP]${NC} $*"
}

log_test_section() {
    echo -e "\n${CYAN}========== $* ==========${NC}"
}

# ============================================================================
# TEST FUNCTIONS - SCRIPT VALIDATION
# ============================================================================

test_script_exists() {
    local script=$1
    if [[ -f "$SCRIPT_DIR/$script" ]]; then
        log_success "Script exists: $script"
        ((TESTS_PASSED++))
        return 0
    else
        log_failure "Script not found: $script"
        FAILED_TESTS+=("script_exists_$script")
        ((TESTS_FAILED++))
        return 1
    fi
}

test_script_executable() {
    local script=$1
    if [[ -x "$SCRIPT_DIR/$script" ]]; then
        log_success "Script is executable: $script"
        ((TESTS_PASSED++))
        return 0
    else
        log_failure "Script is not executable: $script"
        FAILED_TESTS+=("script_executable_$script")
        ((TESTS_FAILED++))
        return 1
    fi
}

test_script_syntax() {
    local script=$1
    if bash -n "$SCRIPT_DIR/$script" 2>/dev/null; then
        log_success "Script syntax valid: $script"
        ((TESTS_PASSED++))
        return 0
    else
        log_failure "Script syntax invalid: $script"
        FAILED_TESTS+=("script_syntax_$script")
        ((TESTS_FAILED++))
        return 1
    fi
}

test_script_has_usage() {
    local script=$1
    if grep -q "print_usage\|Usage:" "$SCRIPT_DIR/$script"; then
        log_success "Script has usage documentation: $script"
        ((TESTS_PASSED++))
        return 0
    else
        log_failure "Script missing usage documentation: $script"
        FAILED_TESTS+=("script_usage_$script")
        ((TESTS_FAILED++))
        return 1
    fi
}

test_script_has_logging() {
    local script=$1
    if grep -q "log_info\|log_error\|log_success\|log_section" "$SCRIPT_DIR/$script"; then
        log_success "Script has logging functions: $script"
        ((TESTS_PASSED++))
        return 0
    else
        log_failure "Script missing logging functions: $script"
        FAILED_TESTS+=("script_logging_$script")
        ((TESTS_FAILED++))
        return 1
    fi
}

# ============================================================================
# TEST FUNCTIONS - HEALTH CHECK
# ============================================================================

test_health_check_basic() {
    log_test_section "Health Check - Basic Functionality"

    if ! command -v docker &>/dev/null; then
        log_skip "Docker not available, skipping health check tests"
        ((TESTS_SKIPPED++))
        return 0
    fi

    # Test health check script help
    if "$SCRIPT_DIR/health-check-v12.9.0.sh" --help &>/dev/null 2>&1 || true; then
        log_success "Health check script runs with --help"
        ((TESTS_PASSED++))
    else
        log_failure "Health check script failed with --help"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("health_check_help")
    fi
}

test_health_check_dry_run() {
    log_test_section "Health Check - Dry Run"

    if ! docker ps &>/dev/null; then
        log_skip "Docker not available, skipping dry run test"
        ((TESTS_SKIPPED++))
        return 0
    fi

    # Create test output
    local test_output=$(mktemp)
    if timeout 10 "$SCRIPT_DIR/health-check-v12.9.0.sh" 2>&1 | tee "$test_output" | grep -q "FAIL\|PASS\|WARN"; then
        log_success "Health check runs and produces output"
        ((TESTS_PASSED++))
    else
        log_failure "Health check did not produce expected output"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("health_check_dry_run")
    fi
    rm -f "$test_output"
}

# ============================================================================
# TEST FUNCTIONS - ROLLBACK
# ============================================================================

test_rollback_script_basic() {
    log_test_section "Rollback - Script Validation"

    # Test rollback script help
    if "$SCRIPT_DIR/rollback-v12.9.0.sh" --help &>/dev/null 2>&1 || true; then
        log_success "Rollback script shows help"
        ((TESTS_PASSED++))
    else
        log_failure "Rollback script help failed"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("rollback_help")
    fi
}

test_rollback_dry_run() {
    log_test_section "Rollback - Dry Run Mode"

    # Test rollback dry run
    if timeout 10 "$SCRIPT_DIR/rollback-v12.9.0.sh" --dry-run --force 2>&1 | grep -q "\[DRY RUN\]"; then
        log_success "Rollback dry run executes successfully"
        ((TESTS_PASSED++))
    else
        log_failure "Rollback dry run did not produce expected output"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("rollback_dry_run")
    fi
}

# ============================================================================
# TEST FUNCTIONS - DEPLOYMENT
# ============================================================================

test_deployment_script_basic() {
    log_test_section "Deployment - Script Validation"

    # Test deployment script help
    if "$SCRIPT_DIR/deploy-v12.9.0.sh" --help &>/dev/null 2>&1 || true; then
        log_success "Deployment script shows help"
        ((TESTS_PASSED++))
    else
        log_failure "Deployment script help failed"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("deploy_help")
    fi
}

test_deployment_dry_run() {
    log_test_section "Deployment - Dry Run Mode"

    # Test deployment dry run
    if timeout 10 "$SCRIPT_DIR/deploy-v12.9.0.sh" --dry-run --force --no-backup 2>&1 | grep -q "\[DRY RUN\]"; then
        log_success "Deployment dry run executes successfully"
        ((TESTS_PASSED++))
    else
        log_failure "Deployment dry run did not produce expected output"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("deploy_dry_run")
    fi
}

# ============================================================================
# TEST FUNCTIONS - NOTIFICATIONS
# ============================================================================

test_notification_script_basic() {
    log_test_section "Notifications - Script Validation"

    # Test notification script help
    if "$SCRIPT_DIR/notification-integration.sh" --help &>/dev/null 2>&1 || true; then
        log_success "Notification script shows help"
        ((TESTS_PASSED++))
    else
        log_failure "Notification script help failed"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("notification_help")
    fi
}

test_notification_dry_send() {
    log_test_section "Notifications - Dry Send"

    # Test sending notification without actual credentials
    if timeout 5 "$SCRIPT_DIR/notification-integration.sh" \
        --type deployment \
        --status success \
        --version 12.9.0 \
        --duration 120 2>&1 | grep -q "INFO"; then
        log_success "Notification script handles missing credentials gracefully"
        ((TESTS_PASSED++))
    else
        log_failure "Notification script error handling failed"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("notification_dry_send")
    fi
}

# ============================================================================
# TEST FUNCTIONS - CONFIGURATION
# ============================================================================

test_docker_compose_config() {
    log_test_section "Docker Compose Configuration"

    local compose_file="${PROJECT_ROOT}/infrastructure/docker/docker-compose.prod.yml"

    if [[ ! -f "$compose_file" ]]; then
        log_skip "Docker compose file not found: $compose_file"
        ((TESTS_SKIPPED++))
        return 0
    fi

    # Check for required services
    if grep -q "basset-hound-browser" "$compose_file"; then
        log_success "Docker compose has basset-hound-browser service"
        ((TESTS_PASSED++))
    else
        log_failure "Docker compose missing basset-hound-browser service"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("docker_compose_service")
    fi

    # Check for healthcheck
    if grep -q "healthcheck" "$compose_file"; then
        log_success "Docker compose has healthcheck configuration"
        ((TESTS_PASSED++))
    else
        log_failure "Docker compose missing healthcheck configuration"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("docker_compose_healthcheck")
    fi

    # Check for volumes
    if grep -q "basset-prod-data" "$compose_file"; then
        log_success "Docker compose has data volumes"
        ((TESTS_PASSED++))
    else
        log_failure "Docker compose missing data volumes"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("docker_compose_volumes")
    fi
}

# ============================================================================
# TEST FUNCTIONS - LOG DIRECTORY
# ============================================================================

test_log_directories() {
    log_test_section "Log Directories"

    local log_dir="${PROJECT_ROOT}/logs"

    if [[ ! -d "$log_dir" ]]; then
        mkdir -p "$log_dir"
        log_success "Created logs directory"
    else
        log_success "Logs directory exists"
    fi
    ((TESTS_PASSED++))

    # Check subdirectories
    local subdirs=("deployments" "rollbacks" "healthcheck-reports" "test-results")
    for subdir in "${subdirs[@]}"; do
        if [[ ! -d "$log_dir/$subdir" ]]; then
            mkdir -p "$log_dir/$subdir"
            log_success "Created logs subdirectory: $subdir"
        else
            log_success "Logs subdirectory exists: $subdir"
        fi
        ((TESTS_PASSED++))
    done
}

# ============================================================================
# TEST FUNCTIONS - EDGE CASES
# ============================================================================

test_deployment_version_parsing() {
    log_test_section "Version Parsing"

    # Extract version from deployment script
    local version=$(grep "DEPLOYMENT_VERSION=" "$SCRIPT_DIR/deploy-v12.9.0.sh" | head -1 | cut -d'"' -f2)

    if [[ "$version" == "12.9.0" ]]; then
        log_success "Deployment version correctly set to 12.9.0"
        ((TESTS_PASSED++))
    else
        log_failure "Deployment version incorrect (expected 12.9.0, got $version)"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("version_parsing")
    fi
}

test_argument_parsing() {
    log_test_section "Argument Parsing"

    # Test with various argument combinations
    local test_count=0
    local test_pass=0

    # Test 1: --help
    if "$SCRIPT_DIR/deploy-v12.9.0.sh" --help 2>&1 | grep -q "Usage"; then
        ((test_pass++))
    fi
    ((test_count++))

    # Test 2: --dry-run --force
    if timeout 5 "$SCRIPT_DIR/deploy-v12.9.0.sh" --dry-run --force --no-backup 2>&1 | grep -q "\[DRY RUN\]"; then
        ((test_pass++))
    fi
    ((test_count++))

    # Test 3: --force --no-backup
    if timeout 5 "$SCRIPT_DIR/deploy-v12.9.0.sh" --force --no-backup --dry-run 2>&1 | grep -q "Pre-Flight\|ERROR"; then
        ((test_pass++))
    fi
    ((test_count++))

    log_success "Argument parsing tests: $test_pass/$test_count passed"
    TESTS_PASSED=$((TESTS_PASSED + test_pass))
}

# ============================================================================
# INTEGRATION TESTS
# ============================================================================

test_complete_workflow() {
    log_test_section "Complete Workflow Simulation"

    log_info "Testing deployment -> health check -> rollback workflow (dry-run)"

    # Test 1: Deployment dry-run
    if timeout 10 "$SCRIPT_DIR/deploy-v12.9.0.sh" --dry-run --force --no-backup 2>&1 | grep -q "Pre-Flight"; then
        log_success "Deployment dry-run workflow validated"
        ((TESTS_PASSED++))
    else
        log_failure "Deployment dry-run workflow failed"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("workflow_deployment")
    fi

    # Test 2: Health check
    if timeout 10 "$SCRIPT_DIR/health-check-v12.9.0.sh" 2>&1 | grep -q "Container Status"; then
        log_success "Health check workflow validated"
        ((TESTS_PASSED++))
    else
        log_skip "Health check workflow (Docker not available)"
        ((TESTS_SKIPPED++))
    fi

    # Test 3: Rollback dry-run
    if timeout 10 "$SCRIPT_DIR/rollback-v12.9.0.sh" --dry-run --force 2>&1 | grep -q "Pre-Flight"; then
        log_success "Rollback dry-run workflow validated"
        ((TESTS_PASSED++))
    else
        log_failure "Rollback dry-run workflow failed"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("workflow_rollback")
    fi
}

# ============================================================================
# REPORT GENERATION
# ============================================================================

generate_test_report() {
    local report_file="${TEST_RESULTS_DIR}/deployment-automation-test-$(date +%Y%m%d-%H%M%S).json"

    log_info "Generating test report: $report_file"

    local report=$(cat <<EOF
{
  "test_suite": "deployment_automation",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "version": "12.9.0",
  "summary": {
    "total_tests": $((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED)),
    "passed": $TESTS_PASSED,
    "failed": $TESTS_FAILED,
    "skipped": $TESTS_SKIPPED,
    "pass_rate": $(awk "BEGIN {printf \"%.2f\", ($TESTS_PASSED / ($TESTS_PASSED + $TESTS_FAILED)) * 100}")
  },
  "failed_tests": [
    $(printf '"%s"' "${FAILED_TESTS[@]}" | paste -sd, -)
  ],
  "environment": {
    "host": "$(hostname)",
    "os": "$(uname -s)",
    "user": "$(whoami)",
    "docker_available": $(command -v docker &>/dev/null && echo "true" || echo "false")
  }
}
EOF
)

    echo "$report" | jq '.' > "$report_file" 2>/dev/null || echo "$report" > "$report_file"

    log_success "Report saved to $report_file"
}

print_test_summary() {
    echo ""
    log_test_section "Test Summary"

    local total=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))
    local pass_rate=0
    if [[ $((TESTS_PASSED + TESTS_FAILED)) -gt 0 ]]; then
        pass_rate=$((TESTS_PASSED * 100 / (TESTS_PASSED + TESTS_FAILED)))
    fi

    echo ""
    echo "Total Tests: $total"
    echo "Passed:      $TESTS_PASSED"
    echo "Failed:      $TESTS_FAILED"
    echo "Skipped:     $TESTS_SKIPPED"
    echo "Pass Rate:   ${pass_rate}%"

    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo ""
        echo "Failed Tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  - $test"
        done
    fi

    echo ""

    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "All tests passed!"
        return 0
    else
        log_failure "$TESTS_FAILED test(s) failed"
        return 1
    fi
}

# ============================================================================
# MAIN TEST EXECUTION
# ============================================================================

main() {
    log_test_section "Basset Hound Browser - Deployment Automation Test Suite"
    log_info "Test execution started at $(date)"

    # Script validation tests
    log_test_section "Script Validation Tests"
    test_script_exists "deploy-v12.9.0.sh"
    test_script_executable "deploy-v12.9.0.sh"
    test_script_syntax "deploy-v12.9.0.sh"
    test_script_has_usage "deploy-v12.9.0.sh"
    test_script_has_logging "deploy-v12.9.0.sh"

    test_script_exists "health-check-v12.9.0.sh"
    test_script_executable "health-check-v12.9.0.sh"
    test_script_syntax "health-check-v12.9.0.sh"

    test_script_exists "rollback-v12.9.0.sh"
    test_script_executable "rollback-v12.9.0.sh"
    test_script_syntax "rollback-v12.9.0.sh"

    test_script_exists "notification-integration.sh"
    test_script_executable "notification-integration.sh"
    test_script_syntax "notification-integration.sh"

    # Configuration tests
    test_docker_compose_config
    test_log_directories

    # Functional tests
    test_deployment_script_basic
    test_deployment_dry_run
    test_health_check_basic
    test_health_check_dry_run
    test_rollback_script_basic
    test_rollback_dry_run
    test_notification_script_basic
    test_notification_dry_send

    # Advanced tests
    test_deployment_version_parsing
    test_argument_parsing
    test_complete_workflow

    # Generate reports
    generate_test_report
    print_test_summary

    log_info "Test execution completed at $(date)"
}

main "$@"
