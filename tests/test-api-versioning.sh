#!/bin/bash

###############################################################################
# API Versioning Test Suite
# Tests /api/v1/* and /api/v2/* endpoints with version negotiation
###############################################################################

BASE_URL="http://localhost:8765"
RESULTS_FILE="/tmp/api-versioning-test-results.txt"
TEST_COUNT=0
PASSED_COUNT=0
FAILED_COUNT=0

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test helper function
test_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local headers="$4"
  local expected_status="$5"

  TEST_COUNT=$((TEST_COUNT + 1))

  # Build curl command
  local curl_cmd="curl -s -w '\n%{http_code}' -X $method"

  # Add headers if provided
  if [ -n "$headers" ]; then
    while IFS='|' read -r header; do
      curl_cmd="$curl_cmd -H '$header'"
    done <<< "$headers"
  fi

  curl_cmd="$curl_cmd '$BASE_URL$endpoint'"

  # Execute curl
  local response=$(eval $curl_cmd)
  local http_code=$(echo "$response" | tail -n 1)
  local body=$(echo "$response" | head -n -1)

  # Check result
  if [ "$http_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} - $name (HTTP $http_code)"
    PASSED_COUNT=$((PASSED_COUNT + 1))
    echo "$body" | head -c 200
    echo ""
  else
    echo -e "${RED}✗ FAIL${NC} - $name (Expected $expected_status, got $http_code)"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    echo "$body" | head -c 200
    echo ""
  fi
  echo "" >> "$RESULTS_FILE"
}

# Print header
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}API Versioning Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Clear results file
> "$RESULTS_FILE"

# Test 1: Version negotiation endpoint
echo -e "${YELLOW}[1] Version Negotiation Endpoint${NC}"
test_endpoint "Version endpoint" "GET" "/api/version" "" "200"

# Test 2: V1 Help endpoint via URL prefix
echo -e "${YELLOW}[2] V1 Help Endpoint (URL Prefix)${NC}"
test_endpoint "V1 Help via URL" "GET" "/api/v1/help" "" "200"

# Test 3: V2 Help endpoint via URL prefix
echo -e "${YELLOW}[3] V2 Help Endpoint (URL Prefix)${NC}"
test_endpoint "V2 Help via URL" "GET" "/api/v2/help" "" "200"

# Test 4: Legacy help endpoint (should default to v1)
echo -e "${YELLOW}[4] Legacy Help Endpoint (Defaults to V1)${NC}"
test_endpoint "Legacy Help (v1 default)" "GET" "/api/help" "" "200"

# Test 5: V1 Diagnostics endpoint
echo -e "${YELLOW}[5] V1 Diagnostics Endpoint${NC}"
test_endpoint "V1 Diagnostics" "GET" "/api/v1/diagnostics" "" "200"

# Test 6: V2 Diagnostics endpoint
echo -e "${YELLOW}[6] V2 Diagnostics Endpoint${NC}"
test_endpoint "V2 Diagnostics with telemetry" "GET" "/api/v2/diagnostics" "" "200"

# Test 7: V1 Status endpoint
echo -e "${YELLOW}[7] V1 Status Endpoint${NC}"
test_endpoint "V1 Status" "GET" "/api/v1/status" "" "200"

# Test 8: V2 Status endpoint
echo -e "${YELLOW}[8] V2 Status Endpoint${NC}"
test_endpoint "V2 Status with recommendations" "GET" "/api/v2/status" "" "200"

# Test 9: V1 Schema endpoint
echo -e "${YELLOW}[9] V1 Schema Endpoint${NC}"
test_endpoint "V1 Schema" "GET" "/api/v1/schema" "" "200"

# Test 10: V2 Schema endpoint
echo -e "${YELLOW}[10] V2 Schema Endpoint${NC}"
test_endpoint "V2 Schema with version info" "GET" "/api/v2/schema" "" "200"

# Test 11: Version negotiation via Accept-Version header
echo -e "${YELLOW}[11] Version Negotiation (Accept-Version Header)${NC}"
test_endpoint "Accept-Version: 2.0 header" "GET" "/api/help" "Accept-Version: 2.0" "200"

# Test 12: Version negotiation via query parameter
echo -e "${YELLOW}[12] Version Negotiation (Query Parameter)${NC}"
test_endpoint "Query param apiVersion=2" "GET" "/api/help?apiVersion=2" "" "200"

# Test 13: Invalid endpoint
echo -e "${YELLOW}[13] Invalid Endpoint (404)${NC}"
test_endpoint "Invalid endpoint" "GET" "/api/invalid" "" "404"

# Test 14: V1 Help with command parameter
echo -e "${YELLOW}[14] V1 Help with Command Parameter${NC}"
test_endpoint "V1 Help command param" "GET" "/api/v1/help?command=navigate" "" "200"

# Test 15: V2 Help with command parameter
echo -e "${YELLOW}[15] V2 Help with Command Parameter${NC}"
test_endpoint "V2 Help command param" "GET" "/api/v2/help?command=navigate" "" "200"

# Test 16: V1 Help search
echo -e "${YELLOW}[16] V1 Help Search${NC}"
test_endpoint "V1 Help search" "GET" "/api/v1/help?search=screenshot" "" "200"

# Test 17: V2 Help search
echo -e "${YELLOW}[17] V2 Help Search${NC}"
test_endpoint "V2 Help search" "GET" "/api/v2/help?search=screenshot" "" "200"

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Total Tests:  $TEST_COUNT"
echo -e "Passed:       ${GREEN}$PASSED_COUNT${NC}"
echo -e "Failed:       ${RED}$FAILED_COUNT${NC}"

# Return appropriate exit code
if [ $FAILED_COUNT -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
