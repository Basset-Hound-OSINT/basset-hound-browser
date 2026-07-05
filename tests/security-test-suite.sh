#!/bin/bash

################################################################################
# Basset Hound Browser - Security Test Suite
# Tests for WSS/HTTPS enforcement (TASK A) and IP redaction (TASK B)
#
# Usage: ./tests/security-test-suite.sh [test-name]
# Examples:
#   ./tests/security-test-suite.sh              # Run all tests
#   ./tests/security-test-suite.sh wss          # Run WSS tests only
#   ./tests/security-test-suite.sh ip           # Run IP redaction tests only
################################################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Default test to run
TEST_TYPE="${1:-all}"

################################################################################
# Utility Functions
################################################################################

print_header() {
  echo -e "\n${BLUE}================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}================================${NC}\n"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
  ((PASSED_TESTS++))
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
  ((FAILED_TESTS++))
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

run_test() {
  local test_name="$1"
  local test_command="$2"
  local test_file="$3"

  ((TOTAL_TESTS++))

  echo "Running: $test_name"
  if [ -f "$test_file" ]; then
    if npm test -- "$test_file" 2>&1 | tee /tmp/test-output.log > /dev/null; then
      print_success "$test_name"
    else
      print_error "$test_name"
      echo "  Command: $test_command"
      echo "  File: $test_file"
      head -20 /tmp/test-output.log | sed 's/^/  /'
    fi
  else
    print_warning "$test_name (test file not found: $test_file)"
  fi
}

################################################################################
# Test Suite Execution
################################################################################

print_header "Basset Hound Browser - Security Test Suite"
echo "Test Type: $TEST_TYPE"
echo "Node Version: $(node --version)"
echo "NPM Version: $(npm --version)"

# Verify test files exist
print_info "Checking for test files..."

# TASK A: WSS Enforcer Tests
WSS_TEST_FILE="tests/unit/wss-enforcer.test.js"
IP_TEST_FILE="tests/unit/ip-redaction.test.js"

if [ ! -f "$WSS_TEST_FILE" ]; then
  print_error "WSS test file not found: $WSS_TEST_FILE"
fi

if [ ! -f "$IP_TEST_FILE" ]; then
  print_error "IP redaction test file not found: $IP_TEST_FILE"
fi

# Run appropriate tests based on TEST_TYPE
if [ "$TEST_TYPE" = "all" ] || [ "$TEST_TYPE" = "wss" ]; then
  print_header "TASK A: WSS/HTTPS Enforcement Tests"

  print_info "Running WSS Enforcer unit tests..."
  run_test "WSS Enforcer Unit Tests" \
    "npm test -- $WSS_TEST_FILE" \
    "$WSS_TEST_FILE"

  print_info "Running SSL configuration tests..."
  if [ -f "tests/unit/websocket-ssl.test.js" ]; then
    run_test "WebSocket SSL Tests" \
      "npm test -- tests/unit/websocket-ssl.test.js" \
      "tests/unit/websocket-ssl.test.js"
  fi
fi

if [ "$TEST_TYPE" = "all" ] || [ "$TEST_TYPE" = "ip" ]; then
  print_header "TASK B: WebRTC IP Leakage Prevention Tests"

  print_info "Running IP Redaction Manager unit tests..."
  run_test "IP Redaction Unit Tests" \
    "npm test -- $IP_TEST_FILE" \
    "$IP_TEST_FILE"
fi

################################################################################
# Test Summary
################################################################################

print_header "Test Summary"

echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "\n${GREEN}All tests passed!${NC}\n"
  exit 0
else
  echo -e "\n${RED}Some tests failed. Please review the errors above.${NC}\n"
  exit 1
fi
