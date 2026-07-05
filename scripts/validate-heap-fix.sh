#!/bin/bash
# Validate that heap exhaustion fix is properly configured

echo "🔍 Validating Heap Exhaustion Fix Implementation..."
echo ""

PASS=0
FAIL=0

# Test file existence
test_file() {
  if [ -f "$1" ]; then
    echo "✓ $2"
    ((PASS++))
  else
    echo "✗ $2 (missing: $1)"
    ((FAIL++))
  fi
}

# Test file contains pattern
test_pattern() {
  if grep -q "$2" "$1" 2>/dev/null; then
    echo "✓ $3"
    ((PASS++))
  else
    echo "✗ $3"
    ((FAIL++))
  fi
}

# Test file executable
test_exec() {
  if [ -x "$1" ]; then
    echo "✓ $2"
    ((PASS++))
  else
    echo "✗ $2 (not executable)"
    ((FAIL++))
  fi
}

echo "=== File Checks ==="
test_file "jest.config.js" "jest.config.js exists"
test_file "tests/helpers/memory-utils.js" "memory-utils.js exists"
test_file "tests/helpers/memory-reporter.js" "memory-reporter.js exists"
test_file "tests/helpers/setup.js" "setup.js exists"
test_file "tests/helpers/global-setup.js" "global-setup.js exists"
test_file "docs/HEAP-EXHAUSTION-FIX.md" "HEAP-EXHAUSTION-FIX.md documentation"
test_file "docs/TEST-DATA-OPTIMIZATION.md" "TEST-DATA-OPTIMIZATION.md documentation"
test_file "scripts/run-tests-memory-optimized.sh" "run-tests-memory-optimized.sh"

echo ""
echo "=== Configuration Checks ==="
test_pattern "jest.config.js" "maxWorkers" "Jest maxWorkers configured"
test_pattern "jest.config.js" "logHeapUsage" "Jest logHeapUsage enabled"
test_pattern "tests/helpers/setup.js" "memoryUtils" "Memory utilities imported"
test_pattern "tests/helpers/setup.js" "beforeEach" "beforeEach cleanup hook"
test_pattern "tests/helpers/setup.js" "afterEach" "afterEach GC hook"
test_pattern "tests/helpers/global-setup.js" "expose-gc" "NODE_OPTIONS configured for GC"
test_pattern "package.json" "expose-gc" "Test scripts include --expose-gc"

echo ""
echo "=== Permissions ==="
test_exec "scripts/run-tests-memory-optimized.sh" "run-tests-memory-optimized.sh is executable"

echo ""
echo "=== Memory Utils Module ==="
if node -e "
  try {
    const m = require('./tests/helpers/memory-utils');
    const required = [
      'forceGarbageCollection',
      'startMemoryMonitoring',
      'stopMemoryMonitoring',
      'clearCaches',
      'reduceTestData',
      'reduceBatchSize',
      'getMemoryStatus'
    ];
    let ok = true;
    for (const func of required) {
      if (typeof m[func] !== 'function') {
        console.log('Missing export:', func);
        ok = false;
      }
    }
    process.exit(ok ? 0 : 1);
  } catch(e) {
    console.log('Error loading memory-utils:', e.message);
    process.exit(1);
  }
" 2>/dev/null; then
  echo "✓ All memory-utils functions exported"
  ((PASS++))
else
  echo "✗ Memory-utils module check failed"
  ((FAIL++))
fi

echo ""
echo "=== Summary ==="
echo "Checks passed: $PASS"
echo "Checks failed: $FAIL"

if [ $FAIL -eq 0 ]; then
  echo ""
  echo "✅ All checks passed! Heap exhaustion fix is properly configured."
  echo ""
  echo "Next steps:"
  echo "  1. Run tests: ./scripts/run-tests-memory-optimized.sh"
  echo "  2. Monitor memory: cat tests/results/memory-report.json"
  exit 0
else
  echo ""
  echo "❌ Some checks failed. Please review configuration."
  exit 1
fi
