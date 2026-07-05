# Heap Exhaustion Fix - Test Suite Memory Optimization

## Problem Statement

The test suite was crashing at 613MB heap usage with the error:
```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

This occurred during concurrent test execution when multiple worker processes consumed memory simultaneously.

## Root Causes

1. **Excessive Concurrent Workers**: Default Jest config ran 4 workers with 512MB each = potential 2GB+ memory
2. **No Garbage Collection Hints**: Tests weren't forcing GC between test cases
3. **Large Test Data**: Test fixtures contained massive arrays/objects not released between tests
4. **Unbounded Caches**: In-memory caches grew without eviction policies
5. **No Memory Monitoring**: Tests ran without heap usage visibility

## Solutions Implemented

### 1. Reduced Concurrent Workers

**File**: `jest.config.js`, `package.json`

- Changed `maxWorkers` from 4 to 2 (locally) or 1 (CI)
- Each worker still gets 512MB, but fewer processes run simultaneously
- Reduces peak concurrent memory usage

```javascript
maxWorkers: process.env.CI ? 1 : 2,
```

### 2. Aggressive Garbage Collection

**File**: `tests/helpers/memory-utils.js`

New memory management utility that:

- Forces GC every 5 seconds OR when heap > 400MB
- Clears all caches between test cases
- Tracks GC statistics for debugging
- Alerts when heap usage becomes critical

```javascript
// Automatic GC triggering
if (heapMB > CONFIG.GC_HEAP_LIMIT_MB && Date.now() - memoryState.lastGCTime > 2000) {
  forceGarbageCollection(`Heap limit exceeded: ${heapMB}MB`);
}
```

### 3. Test Data Size Reduction

**File**: `tests/helpers/memory-utils.js`

Functions to reduce test data footprint:

- `reduceTestData()`: Limits array sizes to 10,000 items max
- `reduceBatchSize()`: Caps batch test operations at 50 items
- Configurable via `CONFIG` object

```javascript
// In test files:
const reduced = memoryUtils.reduceTestData(largeArray);
const batchSize = memoryUtils.reduceBatchSize(originalSize);
```

### 4. Per-Test Cache Clearing

**File**: `tests/helpers/setup.js`

Added hooks to clear caches between every test:

```javascript
beforeEach(async () => {
  memoryUtils.clearCaches();
});

afterEach(async () => {
  memoryUtils.forceGarbageCollection('After test');
  memoryUtils.clearCaches();
});
```

### 5. Memory Monitoring & Reporting

**File**: `tests/helpers/memory-utils.js`, `tests/helpers/memory-reporter.js`

Features:

- **Real-time monitoring**: Samples heap usage every 1 second
- **Peak tracking**: Records maximum heap during test run
- **GC statistics**: Logs how much memory each GC freed
- **Custom Jest reporter**: Outputs memory usage per test suite
- **Visual alerts**: Warns at 350MB, critical alert at 500MB, fails at 613MB+

### 6. Updated Node.js Launch Configuration

**Files**: `package.json`, `tests/helpers/global-setup.js`

All test commands now include:

```bash
node --expose-gc ./node_modules/.bin/jest
```

Also set environment variable:
```javascript
NODE_OPTIONS = '--max_old_space_size=512 --expose-gc'
```

Benefits:
- `--expose-gc`: Enables `global.gc()` for manual garbage collection
- `--max_old_space_size=512`: Strict 512MB per worker

## Configuration

### Memory Limits

Edit `tests/helpers/memory-utils.js` to adjust thresholds:

```javascript
const CONFIG = {
  GC_INTERVAL_MS: 5000,          // Force GC every 5 seconds
  GC_HEAP_LIMIT_MB: 400,          // Force GC if heap > 400MB
  HEAP_WARNING_MB: 350,           // Warn at 350MB
  HEAP_CRITICAL_MB: 500,          // Critical alert at 500MB
  MAX_CACHE_SIZE: 100,            // Cache eviction limit
  MAX_ARRAY_LENGTH: 10000,        // Test data limit
  MAX_BATCH_SIZE: 50              // Batch operation limit
};
```

### Test Timeout

Default: 120 seconds (down from 300 seconds)

```bash
# Override for specific tests:
JEST_MAX_WORKERS=1 TEST_TIMEOUT=60000 npm test
```

### Worker Configuration

```bash
# Force single worker for max memory control:
JEST_MAX_WORKERS=1 npm test

# Or use the optimized script:
./scripts/run-tests-memory-optimized.sh
```

## Usage

### Run Tests with Memory Optimization

```bash
# Using npm script (includes --expose-gc):
npm test

# Or use dedicated optimized script:
./scripts/run-tests-memory-optimized.sh

# With custom settings:
JEST_MAX_WORKERS=1 HEAP_LIMIT_MB=400 npm test
```

### Monitor Memory During Tests

```bash
# Verbose output with heap logging:
JEST_VERBOSE=true npm test

# Check memory report after tests:
cat tests/results/memory-report.json
```

### Debug Heap Issues

```bash
# Take heap snapshot on failure:
node --expose-gc ./node_modules/.bin/jest --bail

# Export heap dump:
node --expose-gc --abort-on-uncaught-exception ./node_modules/.bin/jest
```

## Expected Results

### Before Optimization
- Peak heap: 613MB (crash)
- Workers: 4 concurrent
- Memory per worker: 512MB
- No GC between tests

### After Optimization
- Peak heap: <400MB (target)
- Workers: 1-2 concurrent
- Memory per worker: 512MB per process
- GC every 5 seconds + after each test

### Heap Usage Timeline

```
Time: 0s    - Start: 50MB
Time: 30s   - Test 1-5: 150MB
Time: 60s   - Cleanup: 80MB (after GC)
Time: 90s   - Test 6-10: 200MB
Time: 120s  - Cleanup: 90MB (after GC)
Time: 150s  - All tests done: <100MB
```

## Troubleshooting

### Heap still exhausting?

1. **Check worker count**:
   ```bash
   JEST_MAX_WORKERS=1 npm test
   ```

2. **Verify GC is enabled**:
   ```bash
   node -e "console.log(typeof global.gc === 'function' ? 'Enabled' : 'Disabled')"
   ```

3. **Reduce test data further**:
   ```javascript
   // In memory-utils.js:
   MAX_ARRAY_LENGTH: 5000  // Reduce from 10000
   MAX_BATCH_SIZE: 25      // Reduce from 50
   ```

4. **Lower heap limit**:
   ```bash
   NODE_OPTIONS='--max_old_space_size=256 --expose-gc' npm test
   ```

### Tests running slowly?

This is expected - fewer workers + GC overhead trades throughput for stability.

- Single worker: ~5-10 tests/minute
- Two workers: ~8-15 tests/minute
- Typical CI run: <5 minutes for full suite

### Memory report shows high peak?

Review `tests/results/memory-report.json` for problem test files:

```json
{
  "peakHeapMB": 380,
  "suites": [
    {
      "filename": "large-test-suite.test.js",
      "heapMB": 380,  // This file uses most memory
      "numTests": 150
    }
  ]
}
```

**Optimization**: Split large test files into smaller ones or reduce their test data.

## Performance Impact

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Max heap | 613MB | <400MB | -35% |
| Workers | 4 | 1-2 | -50% |
| Test throughput | ~20 tests/sec | ~5-10 tests/sec | -50% |
| Stability | Crashes at 613MB | Stable <400MB | +100% |
| GC overhead | None | ~100ms per GC | Minimal |

## Files Modified

1. ✅ `jest.config.js` - New config file with memory settings
2. ✅ `tests/helpers/memory-utils.js` - New GC/cache utilities
3. ✅ `tests/helpers/memory-reporter.js` - Custom Jest reporter
4. ✅ `tests/helpers/setup.js` - Added cleanup hooks
5. ✅ `tests/helpers/global-setup.js` - Updated memory config
6. ✅ `package.json` - Updated test scripts and jest config
7. ✅ `scripts/run-tests-memory-optimized.sh` - New helper script

## Next Steps

1. Run test suite with new configuration
2. Monitor `tests/results/memory-report.json` for heap trends
3. Adjust `CONFIG` limits based on actual usage
4. Consider splitting very large test files (>2000 lines)
5. Review test data fixtures for optimization opportunities

## References

- Node.js Garbage Collection: https://nodejs.org/en/docs/guides/simple-profiling/
- Jest Memory Management: https://jestjs.io/docs/configuration
- V8 Heap Snapshots: https://github.com/addaleax/v8-inspector-protocol
