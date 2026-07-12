# Fix Idle Timing Tests - Connection Pool

**Date:** 2026-06-22  
**File:** `tests/connection-pool.test.js`  
**Status:** ✅ FIXED - All 28 tests passing

## Problem Statement

Three idle timing tests in the connection pool test suite were failing because `activeCommands` was not being reset after `acquire()` calls. The `isIdle()` checks required `activeCommands === 0` as a precondition, but the tests were not calling `completeCommand()` to decrement this counter.

### Failing Tests

1. **"should track reuse count correctly"** (line 119-130)
   - Error: Request timeout on 5000ms queue timeout
   - Cause: Connection remained at `activeCommands=1` after reuse attempts
   - Impact: Subsequent acquire calls queued instead of reusing

2. **"should apply custom idle timeout"** (line 177-195)
   - Error: Assertion failed - `conn.isIdle(500)` returned `false` instead of `true`
   - Cause: `activeCommands > 0` after `acquire()` prevented idle detection
   - Impact: Idle timeout validation test could not verify timeout behavior

3. **"should close idle connections"** (line 227-251)
   - Error: Assertion failed - active connections = 1 instead of 0
   - Cause: Connection not marked idle, so manual close condition failed
   - Impact: Idle cleanup behavior could not be verified

## Root Cause Analysis

### The Issue

When `acquire()` is called, it internally calls `recordCommand()` which increments `activeCommands`:

```javascript
// From connection-pool.js line 249
connection.recordCommand(normalizedRequest.command, 0, false);
// This increments activeCommands++
```

The `isIdle()` check requires BOTH conditions:

```javascript
// From connection-pool.js line 107-109
isIdle(idleTimeoutMs) {
  return this.getIdleDuration() >= idleTimeoutMs && this.activeCommands === 0;
}
```

**Solution:** Call `completeCommand()` after `acquire()` to simulate command completion and decrement `activeCommands`.

## Fixes Applied

### Fix 1: "should track reuse count correctly" (lines 119-130)

**Before:**
```javascript
it('should track reuse count correctly', async () => {
  const ws = new MockWebSocket();
  await pool.acquire('client1', ws);

  // Reuse 5 times
  for (let i = 0; i < 5; i++) {
    const conn = await pool.acquire('client1', ws);
    assert.strictEqual(conn.connectionReuses, i + 1);
  }

  assert.strictEqual(pool.getMetrics().summary.totalConnectionsReused, 5);
});
```

**After:**
```javascript
it('should track reuse count correctly', async () => {
  const ws = new MockWebSocket();
  const conn1 = await pool.acquire('client1', ws);
  conn1.completeCommand();  // ← NEW: Reset activeCommands

  // Reuse 5 times
  for (let i = 0; i < 5; i++) {
    const conn = await pool.acquire('client1', ws);
    assert.strictEqual(conn.connectionReuses, i + 1);
    conn.completeCommand();  // ← NEW: Reset activeCommands for each reuse
  }

  assert.strictEqual(pool.getMetrics().summary.totalConnectionsReused, 5);
});
```

**Impact:** Connection is now available for reuse after each acquire because `activeCommands` is reset.

### Fix 2: "should apply custom idle timeout" (lines 177-195)

**Before:**
```javascript
const ws = new MockWebSocket();
const conn = await customPool.acquire('client1', ws);

assert.strictEqual(conn.isIdle(500), false);

// Advance time
conn.lastActivity = Date.now() - 600;
assert.strictEqual(conn.isIdle(500), true);  // ← FAILS: activeCommands still 1
```

**After:**
```javascript
const ws = new MockWebSocket();
const conn = await customPool.acquire('client1', ws);
conn.completeCommand();  // ← NEW: Reset activeCommands

assert.strictEqual(conn.isIdle(500), false);

// Advance time
conn.lastActivity = Date.now() - 600;
assert.strictEqual(conn.isIdle(500), true);  // ← NOW PASSES
```

**Impact:** Connection is now properly idle after time advancement, allowing idle timeout validation.

### Fix 3: "should close idle connections" (lines 227-251)

**Before:**
```javascript
const ws = new MockWebSocket();
const conn = await cleanupPool.acquire('client1', ws);
const initialActive = cleanupPool.getStatus().active;

// Mark as idle
conn.lastActivity = Date.now() - 600;

// Manually close idle connection
if (conn.isIdle(cleanupPool.idleTimeout)) {  // ← FAILS: activeCommands prevents idle
  cleanupPool.closeConnection('client1');
}

assert.strictEqual(cleanupPool.getStatus().active, 0);  // ← FAILS: connection not closed
```

**After:**
```javascript
const ws = new MockWebSocket();
const conn = await cleanupPool.acquire('client1', ws);
conn.completeCommand();  // ← NEW: Reset activeCommands

const initialActive = cleanupPool.getStatus().active;

// Mark as idle
conn.lastActivity = Date.now() - 600;

// Manually close idle connection
if (conn.isIdle(cleanupPool.idleTimeout)) {  // ← NOW SUCCEEDS
  cleanupPool.closeConnection('client1');
}

assert.strictEqual(cleanupPool.getStatus().active, 0);  // ← NOW PASSES
```

**Impact:** Connection is now properly detected as idle and closed, validating cleanup behavior.

## Test Results

### Before Fix
```
Tests:       3 failed, 25 passed, 28 total
Failures:
  1. ConnectionPool - Connection Reuse › should track reuse count correctly
  2. ConnectionPool - Configuration Limits › should apply custom idle timeout
  3. ConnectionPool - Idle Cleanup › should close idle connections
```

### After Fix
```
Tests:       28 passed, 0 failed, 28 total
✅ All idle timing tests now pass
```

## Pattern Recognition

This pattern applies whenever:

1. A connection is acquired with `pool.acquire()`
2. You need to check `isIdle()` on that connection
3. The connection hasn't actually performed a real command yet

**Best Practice:** Always call `conn.completeCommand()` after `acquire()` in tests that validate idle/cleanup behavior, unless you're specifically testing concurrent command scenarios.

## Implementation Details

### Method Used: `completeCommand()`

```javascript
// From connection-pool.js lines 91-95
completeCommand() {
  if (this.activeCommands > 0) {
    this.activeCommands--;
  }
}
```

- Safely decrements `activeCommands` (guards against negative values)
- Simulates command completion from the pool's perspective
- Allows `isIdle()` checks to work correctly
- Does not close the connection

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `tests/connection-pool.test.js` | Added 4 `completeCommand()` calls | 125, 129, 191, 239 |

## Verification

```bash
npx jest tests/connection-pool.test.js --no-coverage

Result:
  PASS basset-hound-browser tests/connection-pool.test.js
  ✅ Test Suites: 1 passed, 1 total
  ✅ Tests: 28 passed, 28 total
  ✅ Memory: 34 MB (within normal range)
```

All tests now pass consistently.

## Related Concepts

- **activeCommands**: Counter tracking concurrent commands per connection
- **completeCommand()**: Decrement activeCommands when command finishes
- **isIdle()**: Check if connection has no active commands AND exceeded idle timeout
- **recordCommand()**: Increment activeCommands when command starts
- **Idle Cleanup**: Background process that closes idle connections to free resources
