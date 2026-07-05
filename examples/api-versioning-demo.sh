#!/bin/bash

###############################################################################
# API Versioning Demonstration
# Shows practical examples of using API versioning with the diagnostics API
###############################################################################

BASE_URL="http://localhost:8765"

echo "API Versioning Demonstration"
echo "============================="
echo ""
echo "This script demonstrates the API versioning features."
echo "Ensure the diagnostics API server is running on localhost:8765"
echo ""
echo "Press Enter to continue..."
read

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Helper function to show request and response
demo_request() {
  local title="$1"
  local method="$2"
  local endpoint="$3"
  local headers="$4"

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}$title${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # Build curl command
  local cmd="curl -s -i"
  if [ -n "$headers" ]; then
    cmd="$cmd $headers"
  fi
  cmd="$cmd -X $method $BASE_URL$endpoint"

  echo -e "${YELLOW}Request:${NC}"
  echo "$cmd"
  echo ""

  echo -e "${YELLOW}Response:${NC}"
  eval $cmd | head -n 20
  echo "..."
  echo ""
  echo "Press Enter to continue..."
  read
}

# Demo 1: Version Information
demo_request \
  "1. Check Available API Versions" \
  "GET" \
  "/api/version"

# Demo 2: V1 Help
demo_request \
  "2. V1 Help Endpoint (via URL prefix)" \
  "GET" \
  "/api/v1/help" \
  ""

# Demo 3: V2 Help
demo_request \
  "3. V2 Help Endpoint (via URL prefix)" \
  "GET" \
  "/api/v2/help" \
  ""

# Demo 4: Version Negotiation - Header
demo_request \
  "4. Version Negotiation via Accept-Version Header (V2)" \
  "GET" \
  "/api/help" \
  "-H 'Accept-Version: 2.0'"

# Demo 5: Version Negotiation - Query Parameter
demo_request \
  "5. Version Negotiation via Query Parameter (V1)" \
  "GET" \
  "/api/diagnostics?apiVersion=1" \
  ""

# Demo 6: V1 Diagnostics
demo_request \
  "6. V1 Diagnostics (Minimal info)" \
  "GET" \
  "/api/v1/diagnostics" \
  ""

# Demo 7: V2 Diagnostics
demo_request \
  "7. V2 Diagnostics (With telemetry & recommendations)" \
  "GET" \
  "/api/v2/diagnostics" \
  ""

# Demo 8: V1 Status
demo_request \
  "8. V1 Status" \
  "GET" \
  "/api/v1/status" \
  ""

# Demo 9: V2 Status
demo_request \
  "9. V2 Status (With recommendations)" \
  "GET" \
  "/api/v2/status" \
  ""

# Demo 10: Response Headers
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}10. Response Headers with Version Info${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Request:${NC}"
echo "curl -i $BASE_URL/api/v2/help"
echo ""
echo -e "${YELLOW}Response Headers (relevant ones):${NC}"
curl -s -i "$BASE_URL/api/v2/help" | grep -E "(X-API-Version|X-Response-Time-Ms|Content-Type)"
echo ""

# Demo 11: Comparing V1 and V2 Output
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}11. Comparing V1 and V2 Key Differences${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}V1 Help has these fields:${NC}"
curl -s "$BASE_URL/api/v1/help" | jq 'keys' | head -n 10

echo ""
echo -e "${YELLOW}V2 Help has these additional fields:${NC}"
curl -s "$BASE_URL/api/v2/help" | jq 'keys | .[] | select(. == "versionInfo" or . == "deprecations")'

echo ""
echo -e "${YELLOW}V2 Deprecations:${NC}"
curl -s "$BASE_URL/api/v2/help" | jq '.deprecations[] | {command, reason, alternative}'

echo ""
echo "Press Enter to continue..."
read

# Demo 12: Search across versions
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}12. Search Same Query, Different Versions${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}V1 Search Results:${NC}"
curl -s "$BASE_URL/api/v1/help?search=navigate" | jq '{apiVersion, resultCount}'

echo ""
echo -e "${YELLOW}V2 Search Results:${NC}"
curl -s "$BASE_URL/api/v2/help?search=navigate" | jq '{apiVersion, resultCount, versionInfo: .versionInfo.version}'

echo ""

# Final summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}API Versioning Demonstration Complete${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Key Takeaways:"
echo "1. Version negotiation works via URL prefix, headers, or query params"
echo "2. V2 adds telemetry, deprecation warnings, and recommendations"
echo "3. Legacy endpoints default to V1 for backward compatibility"
echo "4. Response includes X-API-Version header"
echo "5. Both V1 and V2 are stable and production-ready"
echo ""
echo "For more information, see: /home/devel/basset-hound-browser/docs/API-VERSIONING.md"
echo ""
