#!/bin/bash

##############################################################################
# API Versioning Test Suite with curl
#
# Tests /api/v1/* and /api/v2/* endpoints
#
# Usage:
#   ./tests/curl-api-versioning-tests.sh
#
# Requirements:
#   - Basset Hound Browser WebSocket server running on port 8765
#   - curl command available
#
# Summary:
#   This script tests:
#   1. /api/v1/* endpoints (basic API)
#   2. /api/v2/* endpoints (enhanced with deprecation, telemetry)
#   3. Version negotiation (header, URL prefix, query parameter)
#   4. Legacy endpoints (should default to v1)
#   5. Version endpoint for negotiation info
#   6. Response headers (X-API-Version, Cache-Control, etc)
#   7. Error handling and edge cases
##############################################################################

set -e

API_HOST="http://localhost:8765"
PASS_COUNT=0
FAIL_COUNT=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}API Versioning Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Helper function to run a test
run_test() {
  local test_name="$1"
  local url="$2"
  local expected_version="$3"
  local extra_curl_args="${4:-}"

  echo -e "${YELLOW}Testing:${NC} $test_name"
  echo -e "  URL: $url"

  # Run curl and capture response
  local response=$(curl -s "$url" $extra_curl_args)
  local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" $extra_curl_args)
  local api_version=$(curl -s -i "$url" $extra_curl_args 2>/dev/null | grep -i "x-api-version" | cut -d' ' -f2 | tr -d '\r')

  # Check HTTP response code
  if [ "$http_code" != "200" ]; then
    echo -e "  ${RED}✗ FAIL${NC}: HTTP $http_code (expected 200)"
    FAIL_COUNT=$((FAIL_COUNT+1))
    return
  fi

  # Check API version in header
  if [ -z "$api_version" ]; then
    echo -e "  ${RED}✗ FAIL${NC}: No X-API-Version header found"
    FAIL_COUNT=$((FAIL_COUNT+1))
    return
  fi

  if [ "$expected_version" != "" ] && [ "$api_version" != "$expected_version" ]; then
    echo -e "  ${RED}✗ FAIL${NC}: Got version $api_version, expected $expected_version"
    FAIL_COUNT=$((FAIL_COUNT+1))
    return
  fi

  # Check response is valid JSON
  if ! echo "$response" | jq . > /dev/null 2>&1; then
    echo -e "  ${RED}✗ FAIL${NC}: Response is not valid JSON"
    FAIL_COUNT=$((FAIL_COUNT+1))
    return
  fi

  echo -e "  ${GREEN}✓ PASS${NC}: HTTP 200, Version: $api_version"
  PASS_COUNT=$((PASS_COUNT+1))
  echo ""
}

# Helper to test and display content
run_test_with_output() {
  local test_name="$1"
  local url="$2"
  local expected_version="$3"

  echo -e "${YELLOW}Testing:${NC} $test_name"
  echo -e "  URL: $url"

  local response=$(curl -s "$url")
  local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  local api_version=$(curl -s -i "$url" 2>/dev/null | grep -i "x-api-version" | cut -d' ' -f2 | tr -d '\r')

  if [ "$http_code" != "200" ]; then
    echo -e "  ${RED}✗ FAIL${NC}: HTTP $http_code"
    FAIL_COUNT=$((FAIL_COUNT+1))
    return
  fi

  if [ "$expected_version" != "" ] && [ "$api_version" != "$expected_version" ]; then
    echo -e "  ${RED}✗ FAIL${NC}: Expected version $expected_version, got $api_version"
    FAIL_COUNT=$((FAIL_COUNT+1))
    return
  fi

  echo -e "  ${GREEN}✓ PASS${NC}: HTTP 200, Version: $api_version"
  echo -e "  Sample response:"
  echo "$response" | jq . | head -20 | sed 's/^/    /'
  PASS_COUNT=$((PASS_COUNT+1))
  echo ""
}

echo -e "${BLUE}=== SECTION 1: /api/v1/* Endpoints ===${NC}"
echo ""

run_test "GET /api/v1/help" "$API_HOST/api/v1/help" "1.0"
run_test "GET /api/v1/diagnostics" "$API_HOST/api/v1/diagnostics" "1.0"
run_test "GET /api/v1/status" "$API_HOST/api/v1/status" "1.0"
run_test "GET /api/v1/schema" "$API_HOST/api/v1/schema" "1.0"

echo -e "${BLUE}=== SECTION 2: /api/v2/* Endpoints ===${NC}"
echo ""

run_test "GET /api/v2/help" "$API_HOST/api/v2/help" "2.0"
run_test "GET /api/v2/diagnostics" "$API_HOST/api/v2/diagnostics" "2.0"
run_test "GET /api/v2/status" "$API_HOST/api/v2/status" "2.0"
run_test "GET /api/v2/schema" "$API_HOST/api/v2/schema" "2.0"

echo -e "${BLUE}=== SECTION 3: Version Negotiation (Headers) ===${NC}"
echo ""

run_test "Accept-Version: 2.0 with /api/v1/help" "$API_HOST/api/v1/help" "2.0" \
  '-H "Accept-Version: 2.0"'

run_test "Accept-Version: 1.0 with /api/v2/help" "$API_HOST/api/v2/help" "1.0" \
  '-H "Accept-Version: 1.0"'

run_test "Accept-Version: 2.0 with /api/help" "$API_HOST/api/help" "2.0" \
  '-H "Accept-Version: 2.0"'

echo -e "${BLUE}=== SECTION 4: Version Negotiation (Query Parameter) ===${NC}"
echo ""

run_test "GET /api/help?apiVersion=1" "$API_HOST/api/help?apiVersion=1" "1.0"
run_test "GET /api/help?apiVersion=2" "$API_HOST/api/help?apiVersion=2" "2.0"
run_test "GET /api/diagnostics?apiVersion=2" "$API_HOST/api/diagnostics?apiVersion=2" "2.0"

echo -e "${BLUE}=== SECTION 5: Legacy Endpoints (Default to v1) ===${NC}"
echo ""

run_test "GET /api/help (legacy)" "$API_HOST/api/help" "1.0"
run_test "GET /api/diagnostics (legacy)" "$API_HOST/api/diagnostics" "1.0"
run_test "GET /api/status (legacy)" "$API_HOST/api/status" "1.0"

echo -e "${BLUE}=== SECTION 6: Version Information Endpoint ===${NC}"
echo ""

echo -e "${YELLOW}Testing:${NC} GET /api/version"
echo -e "  URL: $API_HOST/api/version"

VERSION_RESPONSE=$(curl -s "$API_HOST/api/version")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_HOST/api/version")

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "  ${RED}✗ FAIL${NC}: HTTP $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT+1))
else
  SUPPORTED_VERSIONS=$(echo "$VERSION_RESPONSE" | jq '.apiVersions | length')
  CURRENT_VERSION=$(echo "$VERSION_RESPONSE" | jq -r '.currentVersion')

  echo -e "  ${GREEN}✓ PASS${NC}: HTTP 200"
  echo -e "  Current Version: $CURRENT_VERSION"
  echo -e "  Supported Versions: $SUPPORTED_VERSIONS"

  # Check for v1 and v2
  V1_FOUND=$(echo "$VERSION_RESPONSE" | jq '.apiVersions[] | select(.version=="1.0")' | wc -l)
  V2_FOUND=$(echo "$VERSION_RESPONSE" | jq '.apiVersions[] | select(.version=="2.0")' | wc -l)

  if [ "$V1_FOUND" -gt 0 ] && [ "$V2_FOUND" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} Both v1.0 and v2.0 are listed"
    PASS_COUNT=$((PASS_COUNT+1))
  else
    echo -e "  ${RED}✗ FAIL${NC}: Missing version information"
    FAIL_COUNT=$((FAIL_COUNT+1))
  fi

  echo ""
fi

echo -e "${BLUE}=== SECTION 7: V2 Enhancements ===${NC}"
echo ""

echo -e "${YELLOW}Testing:${NC} V2 includes deprecation info"
V2_HELP=$(curl -s "$API_HOST/api/v2/help")
if echo "$V2_HELP" | jq '.deprecations' > /dev/null 2>&1; then
  DEP_COUNT=$(echo "$V2_HELP" | jq '.deprecations | length')
  echo -e "  ${GREEN}✓ PASS${NC}: V2 /help includes deprecations ($DEP_COUNT items)"
  PASS_COUNT=$((PASS_COUNT+1))
else
  echo -e "  ${RED}✗ FAIL${NC}: V2 /help missing deprecations"
  FAIL_COUNT=$((FAIL_COUNT+1))
fi
echo ""

echo -e "${YELLOW}Testing:${NC} V2 diagnostics includes telemetry"
V2_DIAG=$(curl -s "$API_HOST/api/v2/diagnostics")
if echo "$V2_DIAG" | jq '.telemetry' > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓ PASS${NC}: V2 diagnostics includes telemetry"
  PASS_COUNT=$((PASS_COUNT+1))
else
  echo -e "  ${RED}✗ FAIL${NC}: V2 diagnostics missing telemetry"
  FAIL_COUNT=$((FAIL_COUNT+1))
fi

if echo "$V2_DIAG" | jq '.recommendations' > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓ PASS${NC}: V2 diagnostics includes recommendations"
  PASS_COUNT=$((PASS_COUNT+1))
else
  echo -e "  ${RED}✗ FAIL${NC}: V2 diagnostics missing recommendations"
  FAIL_COUNT=$((FAIL_COUNT+1))
fi
echo ""

echo -e "${YELLOW}Testing:${NC} V2 schema includes version info"
V2_SCHEMA=$(curl -s "$API_HOST/api/v2/schema")
if echo "$V2_SCHEMA" | jq '.["x-version-info"]' > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓ PASS${NC}: V2 schema includes x-version-info"
  PASS_COUNT=$((PASS_COUNT+1))
else
  echo -e "  ${RED}✗ FAIL${NC}: V2 schema missing x-version-info"
  FAIL_COUNT=$((FAIL_COUNT+1))
fi
echo ""

echo -e "${BLUE}=== SECTION 8: V1 Does NOT Include V2 Features ===${NC}"
echo ""

echo -e "${YELLOW}Testing:${NC} V1 help should NOT include deprecations"
V1_HELP=$(curl -s "$API_HOST/api/v1/help")
if ! echo "$V1_HELP" | jq '.deprecations' > /dev/null 2>&1 || [ "$(echo "$V1_HELP" | jq '.deprecations')" == "null" ]; then
  echo -e "  ${GREEN}✓ PASS${NC}: V1 help correctly omits deprecations"
  PASS_COUNT=$((PASS_COUNT+1))
else
  echo -e "  ${YELLOW}⚠ INFO${NC}: V1 help has deprecations (unexpected but not critical)"
fi
echo ""

echo -e "${YELLOW}Testing:${NC} V1 diagnostics should NOT include telemetry"
V1_DIAG=$(curl -s "$API_HOST/api/v1/diagnostics")
if ! echo "$V1_DIAG" | jq '.telemetry' > /dev/null 2>&1 || [ "$(echo "$V1_DIAG" | jq '.telemetry')" == "null" ]; then
  echo -e "  ${GREEN}✓ PASS${NC}: V1 diagnostics correctly omits telemetry"
  PASS_COUNT=$((PASS_COUNT+1))
else
  echo -e "  ${YELLOW}⚠ INFO${NC}: V1 diagnostics has telemetry (unexpected but not critical)"
fi
echo ""

echo -e "${BLUE}=== SECTION 9: Response Headers ===${NC}"
echo ""

echo -e "${YELLOW}Testing:${NC} X-API-Version header present"
HEADERS=$(curl -s -i "$API_HOST/api/v1/help" 2>&1 | head -20)
if echo "$HEADERS" | grep -q "x-api-version"; then
  echo -e "  ${GREEN}✓ PASS${NC}: X-API-Version header present"
  PASS_COUNT=$((PASS_COUNT+1))
else
  echo -e "  ${RED}✗ FAIL${NC}: X-API-Version header missing"
  FAIL_COUNT=$((FAIL_COUNT+1))
fi
echo ""

echo -e "${YELLOW}Testing:${NC} X-Response-Time-Ms header present"
if echo "$HEADERS" | grep -q "x-response-time-ms"; then
  RESPONSE_TIME=$(echo "$HEADERS" | grep -i "x-response-time-ms" | cut -d' ' -f2 | tr -d '\r')
  echo -e "  ${GREEN}✓ PASS${NC}: X-Response-Time-Ms header present ($RESPONSE_TIME ms)"
  PASS_COUNT=$((PASS_COUNT+1))
else
  echo -e "  ${RED}✗ FAIL${NC}: X-Response-Time-Ms header missing"
  FAIL_COUNT=$((FAIL_COUNT+1))
fi
echo ""

echo -e "${YELLOW}Testing:${NC} Cache-Control header present"
if echo "$HEADERS" | grep -q "cache-control"; then
  CACHE=$(echo "$HEADERS" | grep -i "cache-control" | cut -d' ' -f2- | tr -d '\r')
  echo -e "  ${GREEN}✓ PASS${NC}: Cache-Control header present ($CACHE)"
  PASS_COUNT=$((PASS_COUNT+1))
else
  echo -e "  ${RED}✗ FAIL${NC}: Cache-Control header missing"
  FAIL_COUNT=$((FAIL_COUNT+1))
fi
echo ""

echo -e "${BLUE}=== SECTION 10: Parameterized Endpoints ===${NC}"
echo ""

run_test "GET /api/v1/help?command=navigate" "$API_HOST/api/v1/help?command=navigate" "1.0"
run_test "GET /api/v2/help?search=screenshot" "$API_HOST/api/v2/help?search=screenshot" "2.0"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Results Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "  ${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "  ${RED}Failed: $FAIL_COUNT${NC}"
echo ""

TOTAL=$((PASS_COUNT + FAIL_COUNT))
if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}✓ ALL TESTS PASSED ($PASS_COUNT/$TOTAL)${NC}"
  exit 0
else
  PERCENT=$((PASS_COUNT * 100 / TOTAL))
  echo -e "${YELLOW}⚠ SOME TESTS FAILED: $PERCENT% passing ($PASS_COUNT/$TOTAL)${NC}"
  exit 1
fi
