#!/bin/bash
#
# Documentation Structure Validation Script
# Verifies API documentation consolidation and structure
# Run before each release to ensure documentation integrity
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCS_DIR="$PROJECT_ROOT/docs"
ARCHIVE_DIR="$DOCS_DIR/archive/deprecated"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0
WARN=0

# Utility functions
log_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASS++))
}

log_fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAIL++))
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARN++))
}

log_info() {
  echo "  $1"
}

# Test functions
test_file_exists() {
  local filepath=$1
  local description=$2

  if [ -f "$filepath" ]; then
    log_pass "File exists: $description"
  else
    log_fail "File missing: $description ($filepath)"
  fi
}

test_file_readable() {
  local filepath=$1
  local description=$2

  if [ -r "$filepath" ]; then
    log_pass "File readable: $description"
  else
    log_fail "File not readable: $description"
  fi
}

test_json_valid() {
  local filepath=$1
  local description=$2

  if command -v jq &> /dev/null; then
    if jq empty < "$filepath" 2>/dev/null; then
      log_pass "Valid JSON: $description"
    else
      log_fail "Invalid JSON: $description"
    fi
  else
    log_warn "jq not installed, skipping JSON validation: $description"
  fi
}

test_yaml_valid() {
  local filepath=$1
  local description=$2

  if command -v yamllint &> /dev/null; then
    if yamllint -d relaxed "$filepath" > /dev/null 2>&1; then
      log_pass "Valid YAML: $description"
    else
      log_fail "Invalid YAML: $description"
    fi
  elif python3 -c "import yaml; yaml.safe_load(open('$filepath'))" 2>/dev/null; then
    log_pass "Valid YAML: $description"
  else
    log_warn "YAML validator not available, skipping: $description"
  fi
}

test_link_in_file() {
  local filepath=$1
  local pattern=$2
  local description=$3

  if grep -q "$pattern" "$filepath" 2>/dev/null; then
    log_pass "Link found: $description"
  else
    log_fail "Link missing: $description in $filepath"
  fi
}

# ============================================================================
# MAIN VALIDATION
# ============================================================================

echo "=========================================="
echo "API Documentation Consolidation Validator"
echo "=========================================="
echo ""

# 1. CANONICAL DOCUMENTS
echo "1. Canonical Documentation Files"
echo "================================"
test_file_exists "$DOCS_DIR/API-DOCUMENTATION-SUMMARY.md" "API-DOCUMENTATION-SUMMARY.md"
test_file_exists "$DOCS_DIR/API-VERSIONS.md" "API-VERSIONS.md"
test_file_exists "$DOCS_DIR/openapi.yaml" "openapi.yaml"
test_file_exists "$DOCS_DIR/QUICK-START-GUIDE.md" "QUICK-START-GUIDE.md"
test_file_exists "$DOCS_DIR/EXAMPLES.md" "EXAMPLES.md"
test_file_exists "$DOCS_DIR/INTEGRATION-GUIDE.md" "INTEGRATION-GUIDE.md"
test_file_exists "$DOCS_DIR/API-DOCUMENTATION-INDEX.md" "API-DOCUMENTATION-INDEX.md"
test_file_exists "$DOCS_DIR/version.json" "version.json"
echo ""

# 2. WIKI API REFERENCE
echo "2. Wiki API Reference Files"
echo "==========================="
test_file_exists "$DOCS_DIR/wiki/api/INDEX.md" "wiki/api/INDEX.md"
test_file_exists "$DOCS_DIR/wiki/api/OVERVIEW.md" "wiki/api/OVERVIEW.md"
test_file_exists "$DOCS_DIR/wiki/api/COMPLETE-REFERENCE.md" "wiki/api/COMPLETE-REFERENCE.md"
test_file_exists "$DOCS_DIR/wiki/api/COMMAND-CATEGORIES.md" "wiki/api/COMMAND-CATEGORIES.md"
test_file_exists "$DOCS_DIR/wiki/api/WEBSOCKET-PROTOCOL.md" "wiki/api/WEBSOCKET-PROTOCOL.md"
test_file_exists "$DOCS_DIR/wiki/api/ERROR-CODES.md" "wiki/api/ERROR-CODES.md"
test_file_exists "$DOCS_DIR/wiki/api/CHANGELOG.md" "wiki/api/CHANGELOG.md"
echo ""

# 3. ARCHIVE
echo "3. Archive Structure"
echo "===================="
test_file_exists "$ARCHIVE_DIR/README.md" "archive/deprecated/README.md"
if [ -d "$ARCHIVE_DIR" ]; then
  archive_count=$(find "$ARCHIVE_DIR" -type f | wc -l)
  if [ "$archive_count" -gt 40 ]; then
    log_pass "Archive contains $archive_count files (expected ~43)"
  else
    log_warn "Archive contains $archive_count files (expected ~43)"
  fi
fi
echo ""

# 4. FILE VALIDATION
echo "4. File Format Validation"
echo "========================="
test_yaml_valid "$DOCS_DIR/openapi.yaml" "openapi.yaml"
test_json_valid "$DOCS_DIR/version.json" "version.json"
echo ""

# 5. CROSS-REFERENCES
echo "5. Cross-Reference Validation"
echo "============================="
test_link_in_file "$DOCS_DIR/wiki/api/INDEX.md" "API-DOCUMENTATION-SUMMARY.md" "INDEX.md -> API-DOCUMENTATION-SUMMARY.md"
test_link_in_file "$DOCS_DIR/wiki/api/INDEX.md" "openapi.yaml" "INDEX.md -> openapi.yaml"
test_link_in_file "$DOCS_DIR/wiki/api/INDEX.md" "API-VERSIONS.md" "INDEX.md -> API-VERSIONS.md"
test_link_in_file "$DOCS_DIR/wiki/api/COMPLETE-REFERENCE.md" "API-DOCUMENTATION-SUMMARY.md" "COMPLETE-REFERENCE.md -> API-DOCUMENTATION-SUMMARY.md"
test_link_in_file "$DOCS_DIR/API-DOCUMENTATION-SUMMARY.md" "openapi.yaml" "API-DOCUMENTATION-SUMMARY.md -> openapi.yaml"
test_link_in_file "$DOCS_DIR/README.md" "API-DOCUMENTATION-SUMMARY.md" "README.md references canonical API docs"
echo ""

# 6. ARCHIVE REFERENCES
echo "6. Archived Files Validation"
echo "============================"
if [ -f "$ARCHIVE_DIR/README.md" ]; then
  if grep -q "deprecated\|archive\|consolidated" "$ARCHIVE_DIR/README.md" 2>/dev/null; then
    log_pass "Archive README explains consolidation"
  else
    log_warn "Archive README may need consolidation explanation"
  fi
fi
echo ""

# 7. NO BROKEN REFERENCES
echo "7. Checking for Broken References"
echo "=================================="
# Check for references to API-REFERENCE-AUTHORITATIVE outside archive
if grep -r "API-REFERENCE-AUTHORITATIVE" "$DOCS_DIR" --exclude-dir=archive --exclude-dir=.git 2>/dev/null | grep -v "^Binary"; then
  log_fail "Found references to API-REFERENCE-AUTHORITATIVE outside archive"
else
  log_pass "No broken references to API-REFERENCE-AUTHORITATIVE"
fi

# Check for references to archived versioning files
if grep -r "API-VERSIONING" "$DOCS_DIR/wiki" 2>/dev/null | grep -v "^Binary"; then
  log_warn "Found references to API-VERSIONING docs in wiki (should reference canonical)"
else
  log_pass "No references to deprecated API-VERSIONING files"
fi
echo ""

# 8. READABILITY CHECKS
echo "8. Key Files Readability"
echo "========================"
test_file_readable "$DOCS_DIR/API-DOCUMENTATION-SUMMARY.md" "API-DOCUMENTATION-SUMMARY.md"
test_file_readable "$DOCS_DIR/openapi.yaml" "openapi.yaml"
test_file_readable "$DOCS_DIR/version.json" "version.json"
echo ""

# SUMMARY
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo -e "Passed:  ${GREEN}$PASS${NC}"
echo -e "Failed:  ${RED}$FAIL${NC}"
echo -e "Warned:  ${YELLOW}$WARN${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✓ Documentation structure is valid!${NC}"
  exit 0
else
  echo -e "${RED}✗ Documentation validation failed!${NC}"
  echo "Please fix the issues above before proceeding."
  exit 1
fi
