#!/bin/bash

# Clean Test Artifacts Script (Bash Version)
#
# Removes test output files and temporary directories before committing.
# Used by pre-commit hooks when Node.js is unavailable.
#
# Usage:
#   bash scripts/clean-test-artifacts.sh
#   ./scripts/clean-test-artifacts.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🧹 Cleaning test artifacts..."
echo

CLEANED=0

# Function to remove a pattern safely
clean_pattern() {
  local pattern="$1"
  local description="$2"

  # Handle glob patterns
  if [[ "$pattern" == *"*"* ]]; then
    # shellcheck disable=SC2086
    for item in $pattern 2>/dev/null; do
      if [[ -e "$item" && "$item" != *".gitkeep" ]]; then
        if [[ -d "$item" ]]; then
          rm -rf "$item"
          echo "✓ Removed: $item/"
          ((CLEANED++))
        else
          rm -f "$item"
          echo "✓ Removed: $item"
          ((CLEANED++))
        fi
      fi
    done
  else
    # Direct path
    if [[ -e "$pattern" && "$pattern" != *".gitkeep" ]]; then
      if [[ -d "$pattern" ]]; then
        rm -rf "$pattern"
        echo "✓ Removed: $pattern/"
        ((CLEANED++))
      else
        rm -f "$pattern"
        echo "✓ Removed: $pattern"
        ((CLEANED++))
      fi
    fi
  fi
}

# Clean test outputs (centralized) - preserve directory structure
clean_pattern "tests/output/reports/*" "test reports"
clean_pattern "tests/output/results/*" "test results"
clean_pattern "tests/output/screenshots/*" "test screenshots"
clean_pattern "tests/output/logs/*" "test logs"
clean_pattern ".test-sessions*" "test sessions"
clean_pattern ".test-scratch*" "test scratch"
clean_pattern "test-sessions/" "legacy test sessions"
clean_pattern "tmp_tests/" "temporary tests"
clean_pattern "tests/tmp/" "tests tmp"
clean_pattern ".mypy_cache/" "Python mypy cache"
clean_pattern ".pytest_cache/" "Python pytest cache"
clean_pattern "__pycache__/" "Python cache"
clean_pattern "htmlcov/" "coverage report"
clean_pattern ".coverage" "coverage data"

echo
echo "=================================================="
if [[ $CLEANED -gt 0 ]]; then
  echo "✅ Cleaned $CLEANED artifact(s)"
else
  echo "ℹ️  No test artifacts found to clean"
fi
echo

exit 0
