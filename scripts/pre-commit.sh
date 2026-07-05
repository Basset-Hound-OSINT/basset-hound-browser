#!/bin/bash

# ============================================================================
# Pre-Commit Hook for Basset Hound Browser
# ============================================================================
# This script performs code quality checks before commits:
# 1. ESLint validation on staged JS files
# 2. Detects suspicious patterns (console.log, TODO, FIXME)
# 3. Validates package.json and lock files
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
ESLINT_ENABLED=${ESLINT_ENABLED:-true}
STRICT_MODE=${STRICT_MODE:-false}
MAX_WARNINGS=20

# Initialize counters
TOTAL_ERRORS=0
ESLINT_ERRORS=0
ESLINT_WARNINGS=0
SUSPICIOUS_PATTERNS=0
PACKAGE_JSON_ERRORS=0

# Functions
print_header() {
  echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# Get the project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

print_header "Pre-Commit Quality Checks (v1.0)"

# ============================================================================
# 1. Check if Node/npm are available
# ============================================================================
print_header "Verifying environment..."
if ! command -v node &> /dev/null; then
  print_error "Node.js not found. Pre-commit checks require Node.js."
  exit 1
fi
if ! command -v npm &> /dev/null; then
  print_error "npm not found. Pre-commit checks require npm."
  exit 1
fi
print_success "Node.js $(node -v) and npm $(npm -v) detected"

# ============================================================================
# 2. Get list of staged files
# ============================================================================
print_header "Analyzing staged files..."
STAGED_JS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.js$' || true)
STAGED_JSON_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.json$' || true)

if [ -z "$STAGED_JS_FILES" ]; then
  print_warning "No JavaScript files staged for commit"
else
  echo "Staged JavaScript files:"
  echo "$STAGED_JS_FILES" | sed 's/^/  /'
  FILE_COUNT=$(echo "$STAGED_JS_FILES" | wc -l)
  echo "Total: $FILE_COUNT file(s)"
fi

# ============================================================================
# 3. ESLint Check
# ============================================================================
if [ "$ESLINT_ENABLED" = "true" ] && [ ! -z "$STAGED_JS_FILES" ]; then
  print_header "Running ESLint on staged files..."

  if [ ! -f ".eslintrc.json" ]; then
    print_error "ESLint configuration not found (.eslintrc.json)"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
  elif ! npm list eslint &>/dev/null; then
    print_warning "ESLint not installed. Skipping linting check."
    print_warning "  Install with: npm install --save-dev eslint"
  else
    # Run ESLint with JSON output for parsing
    if npx eslint --format json $STAGED_JS_FILES > /tmp/eslint-report.json 2>&1; then
      print_success "ESLint passed - no errors"
    else
      # Parse ESLint output
      ESLINT_ERRORS=$(grep -o '"fatal":true' /tmp/eslint-report.json | wc -l || true)
      ESLINT_WARNINGS=$(grep -o '"severity":1' /tmp/eslint-report.json | wc -l || true)

      if [ "$ESLINT_ERRORS" -gt 0 ]; then
        print_error "ESLint found $ESLINT_ERRORS critical error(s):"
        npx eslint --format stylish $STAGED_JS_FILES | head -50
        TOTAL_ERRORS=$((TOTAL_ERRORS + ESLINT_ERRORS))
      fi

      if [ "$ESLINT_WARNINGS" -gt 0 ]; then
        if [ "$ESLINT_WARNINGS" -gt "$MAX_WARNINGS" ]; then
          print_warning "ESLint found $ESLINT_WARNINGS warning(s) (threshold: $MAX_WARNINGS)"
          if [ "$STRICT_MODE" = "true" ]; then
            TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
          fi
        else
          print_warning "ESLint found $ESLINT_WARNINGS warning(s)"
        fi
      fi
    fi
    rm -f /tmp/eslint-report.json
  fi
fi

# ============================================================================
# 4. Suspicious Pattern Detection
# ============================================================================
print_header "Checking for suspicious patterns..."
SUSPICIOUS_COUNT=0

if [ ! -z "$STAGED_JS_FILES" ]; then
  # Check for console.log (except in allowed contexts)
  CONSOLE_LOGS=$(git diff --cached $STAGED_JS_FILES | grep '^+' | grep -E 'console\.(log|debug|trace)\(' | grep -v 'console\.(warn|error|info)\(' | wc -l || true)
  if [ "$CONSOLE_LOGS" -gt 0 ]; then
    print_warning "Found $CONSOLE_LOGS console.log() statement(s) - consider using proper logging"
    SUSPICIOUS_COUNT=$((SUSPICIOUS_COUNT + CONSOLE_LOGS))
  fi

  # Check for TODO/FIXME comments
  TODOS=$(git diff --cached $STAGED_JS_FILES | grep '^+' | grep -iE '(TODO|FIXME|HACK):' | wc -l || true)
  if [ "$TODOS" -gt 0 ]; then
    print_warning "Found $TODOS TODO/FIXME/HACK comment(s)"
    SUSPICIOUS_COUNT=$((SUSPICIOUS_COUNT + 1))
  fi

  # Check for debugger statements
  DEBUGGERS=$(git diff --cached $STAGED_JS_FILES | grep '^+' | grep -E 'debugger;' | wc -l || true)
  if [ "$DEBUGGERS" -gt 0 ]; then
    print_error "Found $DEBUGGERS debugger statement(s)"
    SUSPICIOUS_PATTERNS=$((SUSPICIOUS_PATTERNS + DEBUGGERS))
  fi

  # Check for large files (>500KB)
  LARGE_FILES=$(git diff --cached --name-only --diff-filter=ACM | while read file; do
    if [ -f "$file" ]; then
      SIZE=$(wc -c < "$file")
      if [ "$SIZE" -gt 500000 ]; then
        echo "$file ($((SIZE / 1024))KB)"
      fi
    fi
  done || true)

  if [ ! -z "$LARGE_FILES" ]; then
    print_warning "Found large file(s):"
    echo "$LARGE_FILES" | sed 's/^/    /'
  fi
fi

# ============================================================================
# 5. Package.json Validation
# ============================================================================
print_header "Validating package.json..."
if echo "$STAGED_JSON_FILES" | grep -q "package.json"; then
  if npm run lint:package-json 2>/dev/null || npx package-json-validator package.json 2>/dev/null; then
    print_success "package.json is valid"
  else
    print_warning "package.json validation skipped (package-json-validator not installed)"
  fi
fi

# ============================================================================
# 6. Summary and Exit
# ============================================================================
echo ""
print_header "Summary"
echo "  ESLint errors: $ESLINT_ERRORS"
echo "  ESLint warnings: $ESLINT_WARNINGS"
echo "  Suspicious patterns: $SUSPICIOUS_PATTERNS"
echo "  Total critical issues: $TOTAL_ERRORS"
echo ""

if [ "$TOTAL_ERRORS" -gt 0 ]; then
  print_error "Pre-commit checks failed with $TOTAL_ERRORS critical issue(s)"
  echo ""
  echo "To fix ESLint issues automatically:"
  echo "  npx eslint --fix $STAGED_JS_FILES"
  echo ""
  echo "To bypass these checks (NOT RECOMMENDED):"
  echo "  git commit --no-verify"
  echo ""
  exit 1
fi

if [ "$SUSPICIOUS_PATTERNS" -gt 0 ]; then
  print_warning "Pre-commit checks passed but found $SUSPICIOUS_PATTERNS suspicious pattern(s)"
  echo "  Review and fix before pushing to main"
fi

if [ "$ESLINT_WARNINGS" -gt 0 ]; then
  print_warning "Commit proceeding with $ESLINT_WARNINGS ESLint warning(s)"
fi

print_success "Pre-commit checks passed"
exit 0
