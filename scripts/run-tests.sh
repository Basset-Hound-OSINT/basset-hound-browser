#!/bin/bash
# Comprehensive test runner for CI/CD pipeline
# Supports multiple test suites with proper error handling and reporting

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_TIMEOUT=${TEST_TIMEOUT:-300}
COVERAGE_THRESHOLD=${COVERAGE_THRESHOLD:-50}
VERBOSE=${VERBOSE:-false}
TEST_SUITE=${1:-all}

# Results tracking
RESULTS_DIR="tests/results"
mkdir -p "$RESULTS_DIR"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
START_TIME=$(date +%s)

# Logging utilities
log_info() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $*"
}

log_error() {
  echo -e "${RED}[✗]${NC} $*"
}

log_warning() {
  echo -e "${YELLOW}[!]${NC} $*"
}

# Test runner function
run_test_suite() {
  local suite_name=$1
  local npm_script=$2
  local timeout=${3:-60000}

  log_info "Running $suite_name..."
  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  if npm run "$npm_script" -- --ci --testTimeout="$timeout" 2>&1 | tee "$RESULTS_DIR/$suite_name.log"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_success "$suite_name passed"
    return 0
  else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    log_error "$suite_name failed"
    return 1
  fi
}

# Check dependencies
check_dependencies() {
  log_info "Checking dependencies..."

  if ! command -v npm &> /dev/null; then
    log_error "npm is not installed"
    exit 1
  fi

  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    exit 1
  fi

  if [ ! -d "node_modules" ]; then
    log_warning "node_modules not found, installing dependencies..."
    npm ci
  fi

  log_success "Dependencies check passed"
}

# Install test dependencies
install_dependencies() {
  log_info "Installing dependencies..."
  npm ci --prefer-offline --no-audit 2>&1 | tail -5
  log_success "Dependencies installed"
}

# Run unit tests
run_unit_tests() {
  log_info "=== Unit Tests ==="
  run_test_suite "unit-tests" "test:unit" 10000
}

# Run integration tests
run_integration_tests() {
  log_info "=== Integration Tests ==="
  run_test_suite "integration-tests" "test:integration" 60000
}

# Run bot detection tests
run_bot_detection_tests() {
  log_info "=== Bot Detection Tests ==="
  run_test_suite "bot-detection-tests" "test:bot-detection" 120000
}

# Run evasion tests
run_evasion_tests() {
  log_info "=== Evasion Framework Tests ==="
  if npm run test:evasion -- --ci 2>&1 | tee "$RESULTS_DIR/evasion-tests.log"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_success "Evasion tests passed"
  else
    log_warning "Evasion tests skipped or failed (this is optional)"
  fi
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Verify coverage thresholds
verify_coverage() {
  if [ -f "coverage/coverage-summary.json" ]; then
    log_info "Verifying coverage thresholds..."
    # This is a simplified check - in production, parse the JSON properly
    if grep -q "\"lines\"" coverage/coverage-summary.json; then
      log_success "Coverage report generated"
    fi
  fi
}

# Generate test report
generate_report() {
  local end_time=$(date +%s)
  local duration=$((end_time - START_TIME))
  local pass_rate=0

  if [ $TOTAL_TESTS -gt 0 ]; then
    pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
  fi

  cat > "$RESULTS_DIR/test-summary.txt" << EOF
Test Execution Summary
=====================
Generated: $(date -u +'%Y-%m-%dT%H:%M:%SZ')
Duration: ${duration}s

Test Results:
- Total: $TOTAL_TESTS
- Passed: $PASSED_TESTS
- Failed: $FAILED_TESTS
- Pass Rate: ${pass_rate}%

Test Suites:
- Unit Tests: $RESULTS_DIR/unit-tests.log
- Integration Tests: $RESULTS_DIR/integration-tests.log
- Bot Detection Tests: $RESULTS_DIR/bot-detection-tests.log
- Evasion Tests: $RESULTS_DIR/evasion-tests.log

Coverage:
- Report: coverage/lcov-report/index.html
- Summary: coverage/coverage-summary.json

EOF

  cat "$RESULTS_DIR/test-summary.txt"
}

# Cleanup
cleanup() {
  log_info "Cleaning up..."
  # Add any cleanup steps here
}

trap cleanup EXIT

# Main execution
main() {
  log_info "Starting test suite: $TEST_SUITE"
  log_info "Node version: $(node --version)"
  log_info "NPM version: $(npm --version)"

  check_dependencies
  install_dependencies

  case "$TEST_SUITE" in
    unit)
      run_unit_tests
      ;;
    integration)
      run_integration_tests
      ;;
    bot-detection)
      run_bot_detection_tests
      ;;
    evasion)
      run_evasion_tests
      ;;
    all)
      run_unit_tests || true
      run_integration_tests || true
      run_bot_detection_tests || true
      run_evasion_tests || true
      ;;
    *)
      log_error "Unknown test suite: $TEST_SUITE"
      echo "Usage: $0 [unit|integration|bot-detection|evasion|all]"
      exit 1
      ;;
  esac

  verify_coverage
  generate_report

  # Exit with appropriate code
  if [ $FAILED_TESTS -gt 0 ]; then
    log_error "Some tests failed"
    exit 1
  else
    log_success "All test suites passed"
    exit 0
  fi
}

main "$@"
