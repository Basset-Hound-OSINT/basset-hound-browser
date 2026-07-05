# Test Coverage Expansion Plan for Basset Hound Browser v12.1.0+
**Created:** May 31, 2026  
**Status:** Ready for Implementation  
**Target:** 95%+ Code Coverage (from current 93.2%)  
**Expected New Tests:** 1,300+  
**Estimated Effort:** 4-6 weeks

---

## Part 1: Current Coverage Assessment (400+ lines)

### 1.1 Overall Coverage Baseline

**Current State (v12.1.0):**
- **Test Pass Rate:** 93.2% (1,837/1,975 tests passing)
- **Test Suites:** 37 total (26 passing, 11 failing = 70.3% suite pass rate)
- **Code Base:** 47 source files, 21,680 lines of code
- **Test Base:** 203 test files, ~1,975+ tests
- **Coverage Improvement Needed:** +1.8% to reach 95%

**Key Metrics:**
| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| **Test Pass Rate** | 93.2% | 95.0%+ | -1.8% |
| **Code Coverage** | 92.3% (est.) | 95%+ | -2.7% |
| **Test Suite Pass Rate** | 70.3% | 100% | -29.7% |
| **Critical Issues** | 1 | 0 | -1 |
| **High Priority Issues** | 15 | 0 | -15 |

### 1.2 Coverage by Module (Detailed Analysis)

#### Well-Tested Modules (90%+ coverage)
1. **Humanize Module** (100% - 89 tests)
   - Status: ✓ FULLY COVERED
   - Tests: 89 passing
   - Coverage: All interaction timing, scroll, mouse movement
   - Edge Cases: All handled

2. **Certificate Generator** (100% - 45 tests)
   - Status: ✓ FULLY COVERED
   - Tests: 45 passing
   - Coverage: OpenSSL generation, Node crypto fallback
   - Edge Cases: All lifecycle stages tested

3. **Screenshot Headless Mode** (100% - 16 tests)
   - Status: ✓ FULLY COVERED
   - Tests: 16 passing
   - Coverage: Headless detection, frame caching

#### Adequately-Tested Modules (80-90% coverage)
1. **Evasion Modules** (85% estimated)
   - Device Fingerprinting: 89 tests
   - Canvas Evasion: 78 tests
   - WebGL Evasion: 82 tests
   - Session Coherence: 100 tests
   - **Gaps Identified:**
     - Error recovery paths (5-8 tests needed)
     - Timeout scenarios (3-5 tests needed)
     - Concurrent evasion execution (4-6 tests needed)

2. **Proxy Management** (82% estimated)
   - Rotation logic: 45 tests
   - Health checking: 38 tests
   - **Gaps Identified:**
     - Network failure handling (8-10 tests)
     - Pool exhaustion scenarios (4-6 tests)
     - Concurrent proxy access (6-8 tests)

#### Under-Tested Modules (<80% coverage)
1. **Utility Modules** (45% estimated)
   - `async-utils.js` (472 LOC)
     - Status: ✗ NO TESTS FOUND
     - Functions: retryAsync, CircuitBreaker, parallelAsync, sequentialAsync, memoizeAsync, debounceAsync
     - Required Tests: 120-150 tests
       - retryAsync: 25 tests (success, failures, backoff, callbacks, shouldRetry predicate)
       - CircuitBreaker: 40 tests (state transitions, open/closed/half-open, thresholds, callbacks)
       - parallelAsync: 30 tests (concurrency limits, ordering, error handling)
       - sequentialAsync: 25 tests (order preservation, progress callbacks)
       - memoizeAsync: 20 tests (TTL, key generation, cache behavior)
       - debounceAsync: 15 tests (timing, leading edge, promise chaining)
   
   - `response-formatter.js` (368 LOC)
     - Status: ✗ NO TESTS FOUND
     - Methods: success, error, partial, paginated, async, redirect, isValid, toJSON, errorResponse
     - Required Tests: 80-100 tests
       - success(): 12 tests (data, metadata, various code types)
       - error(): 15 tests (codes, status codes, details, error mapping)
       - partial(): 12 tests (succeeded/failed counts, errors array)
       - paginated(): 12 tests (page calculation, hasNext/Prev, boundaries)
       - async(): 8 tests (operation tracking, status URLs)
       - redirect(): 8 tests (permanent vs temporary)
       - isValid(): 15 tests (validation of all fields, edge cases)
       - errorResponse(): 12 tests (error code mapping, status codes)
       - toJSON(): 8 tests (circular references, Error objects, serialization)

2. **Session Management** (65% estimated)
   - `session-manager.js` (400+ LOC)
     - Status: PARTIAL (some tests exist)
     - Gaps:
       - Concurrent session creation (5-7 tests)
       - Session timeout handling (6-8 tests)
       - Profile rotation edge cases (4-6 tests)
       - Coherence validation failures (8-10 tests)
       - Required: 40-50 additional tests

3. **Proxy Management** (72% estimated)
   - `residential-proxy-manager.js` (521 LOC)
     - Gaps:
       - Rotation mode switching (5 tests)
       - Health check failure cascades (8 tests)
       - Pool exhaustion (6 tests)
       - Performance metric tracking edge cases (5 tests)
       - Required: 30-40 additional tests

4. **Authentication Flows** (60% estimated)
   - `headless-auth.js` (777 LOC)
     - Gaps:
       - Auth flow registration errors (6 tests)
       - Step execution failures (8 tests)
       - Retry logic under various conditions (10 tests)
       - Context parameter propagation (5 tests)
       - Session caching edge cases (6 tests)
       - Required: 50-70 additional tests

5. **Forensic Analysis** (68% estimated)
   - `metadata-extractor.js` (668 LOC) - Partial coverage
     - Gaps:
       - Image format edge cases (10 tests)
       - Corrupted metadata handling (8 tests)
       - Missing field handling (5 tests)
       - Required: 30-40 additional tests
   
   - `network-analyzer.js` (611 LOC) - Partial coverage
     - Gaps:
       - Connection timeout handling (6 tests)
       - Malformed packet handling (8 tests)
       - DNS resolution failures (4 tests)
       - Required: 25-35 additional tests

### 1.3 Critical Paths 100% Coverage Checklist

**Authentication Flow (Must be 100% covered):**
- [ ] OAuth initialization with missing parameters
- [ ] CAPTCHA detection and handling
- [ ] Login form validation errors
- [ ] Session persistence across auth failures
- [ ] Cookie injection during auth
- [ ] Timeout during auth step
- [ ] Step retry exhaustion
- [ ] Context data corruption during flow

**WebSocket Communication (Must be 100% covered):**
- [ ] Connection establishment success/failure
- [ ] Message serialization edge cases (binary, large payloads)
- [ ] Disconnect and reconnection scenarios
- [ ] Message ordering under concurrent load
- [ ] Frame fragmentation handling
- [ ] Ping/pong timeout scenarios
- [ ] Client-initiated disconnect cleanup
- [ ] Server-initiated disconnect handling

**Command Processing (Must be 100% covered):**
- [ ] Unknown command handling
- [ ] Malformed command JSON parsing
- [ ] Command timeout scenarios
- [ ] Concurrent command execution ordering
- [ ] Command result buffering
- [ ] Command execution context cleanup
- [ ] Resource exhaustion during command execution
- [ ] Partial command results

**Error Handling (Must be 100% covered):**
- [ ] All error types with specific handling
- [ ] Error propagation through call stack
- [ ] Resource cleanup on error
- [ ] Error logging and reporting
- [ ] Error recovery retry logic
- [ ] Cascading failure prevention
- [ ] Silent vs. logged failures
- [ ] User-facing error messages

**Resource Management (Must be 100% covered):**
- [ ] Memory limit enforcement
- [ ] Connection pool exhaustion
- [ ] File descriptor limits
- [ ] Timeout-based resource cleanup
- [ ] Circular reference handling
- [ ] Event listener cleanup
- [ ] Stream resource cleanup
- [ ] Browser process cleanup

### 1.4 Edge Cases & Systematic Gaps Identified

**Identified Coverage Gaps by Category:**

1. **Boundary Conditions (Estimated 45 missing tests)**
   - Zero/empty inputs: strings, arrays, objects
   - Null/undefined handling in complex objects
   - Maximum size limits (large arrays, large strings)
   - Minimum/maximum numeric values
   - Unicode/special character handling
   - Extremely long operation names/ids
   - Deeply nested object structures

2. **Concurrency Issues (Estimated 60 missing tests)**
   - Race conditions in cache access
   - Concurrent proxy rotation
   - Simultaneous session creation
   - Parallel command execution
   - Concurrent event emission
   - Lock/mutex scenarios
   - Deadlock prevention
   - Stale data in concurrent access

3. **Timeout & Timing (Estimated 50 missing tests)**
   - Operation timeout at exactly T milliseconds
   - Timeouts in nested async operations
   - Timeout during partial operation
   - Clock skew handling
   - Timeout recovery and retry
   - Timeout during callback execution
   - Multiple overlapping timeouts

4. **Network Failures (Estimated 55 missing tests)**
   - Connection reset
   - Connection timeout
   - Partial data received
   - Data corruption on wire
   - DNS resolution failures
   - SSL certificate errors
   - Proxy connection failures
   - Rate limiting / throttling

5. **Resource Exhaustion (Estimated 40 missing tests)**
   - Out of memory conditions
   - File descriptor limits
   - Connection pool exhaustion
   - Event listener limits
   - Message queue overflow
   - Cache memory overflow
   - Process limit exceeded

---

## Part 2: Untested Code Paths (600+ lines)

### 2.1 Error Handling Paths (Negative Testing)

**Status:** Currently untested for 60-70% of error paths

#### A. async-utils.js Error Paths (35 missing tests)
1. **retryAsync Errors:**
   - Invalid input: non-function argument (1 test)
   - shouldRetry predicate returns false (1 test)
   - Initial delay exceeds max delay (1 test)
   - Backoff multiplier edge cases (1 test)
   - onRetry callback throws error (1 test)
   - maxRetries = 0 (no retries) (1 test)
   - Each retry attempt with different error types (5 tests)
   - Callback errors during retry sequence (2 tests)

2. **CircuitBreaker Errors:**
   - Circuit opening at exact threshold (1 test)
   - Transition from open to half-open timing (1 test)
   - Success threshold transition during half-open (2 tests)
   - shouldOpen predicate edge cases (2 tests)
   - Callback errors during state transitions (2 tests)
   - getStats() during each state (1 test)
   - Manual open() while already open (1 test)
   - reset() while already closed (1 test)

3. **parallelAsync Errors:**
   - Invalid input: non-array (1 test)
   - Empty array handling (1 test)
   - Concurrency > array length (1 test)
   - One function throws, others in-flight (1 test)
   - All functions throw (1 test)
   - Partial completion on error (1 test)
   - Concurrency=0 or negative (1 test)

4. **sequentialAsync Errors:**
   - Progress callback throws (1 test)
   - Function at index N fails (3 tests for different N)
   - onProgress called with correct index (2 tests)

5. **memoizeAsync Errors:**
   - Custom keyGenerator throws (1 test)
   - Cache TTL expiration (1 test)
   - Multiple calls with same args (1 test)
   - Large payload caching (1 test)

6. **debounceAsync Errors:**
   - Leading edge execution (1 test)
   - Multiple rapid calls collapse (1 test)
   - Delayed call after function thrown (1 test)

#### B. response-formatter.js Error Paths (28 missing tests)
1. **Validation Errors:**
   - Null/undefined input to all methods (9 tests)
   - Invalid code values (1 test)
   - Invalid status codes (1 test)
   - Missing required fields (2 tests)

2. **Serialization Errors:**
   - Circular references in toJSON() (1 test)
   - Error objects with custom properties (1 test)
   - Symbols in response objects (1 test)
   - Function references in data (1 test)

3. **Edge Case Responses:**
   - Extremely large data payloads (1 test)
   - Nested error responses (1 test)
   - Null metadata in success() (1 test)
   - Empty errors array in partial() (1 test)
   - pageSize = 0 in paginated() (1 test)
   - total < pageSize in paginated() (1 test)
   - Negative page numbers (1 test)

4. **Error Mapping:**
   - Unknown error codes (1 test)
   - Error.code not in switch statement (1 test)
   - Error missing message property (1 test)

#### C. Session Manager Error Paths (22 missing tests)
1. **Session Creation:**
   - Create with invalid device profile (1 test)
   - Create with invalid proxy config (1 test)
   - Create while session exists (1 test)

2. **Session Recording:**
   - Record interaction with null session (1 test)
   - Record with no current session (1 test)

3. **Profile Rotation:**
   - Rotate with invalid profile (1 test)
   - Rotate while no session active (1 test)
   - Rotation count overflow (1 test)

4. **Coherence Validation:**
   - Validate with missing checks (1 test)
   - Validate with network failure (1 test)
   - Validate timeout handling (1 test)
   - Update coherence with partial data (1 test)
   - Get coherence stats on empty session (1 test)

5. **Session Cleanup:**
   - Destroy non-existent session (1 test)
   - Destroy while recording (1 test)
   - Cleanup on error (1 test)
   - Resource cleanup verification (1 test)

6. **History Management:**
   - Query history with invalid filters (1 test)
   - Prune history exceeding max size (1 test)

#### D. Proxy Manager Error Paths (18 missing tests)
1. **Proxy Configuration:**
   - Invalid proxy URL (1 test)
   - Invalid rotation mode (1 test)
   - Negative health check interval (1 test)

2. **Health Checking:**
   - Health check timeout (1 test)
   - Health check connection refused (1 test)
   - Partial response from health check (1 test)

3. **Rotation:**
   - Rotate with empty pool (1 test)
   - Round-robin index overflow (1 test)
   - Random mode with single proxy (1 test)

4. **Performance Metrics:**
   - Record latency with invalid values (1 test)
   - Update success/failure counts with negatives (1 test)

5. **Fallback Mode:**
   - Enter fallback mode without direct proxies (1 test)
   - Recovery from fallback (1 test)
   - Fallback mode resource usage (1 test)

6. **Recovery:**
   - Recover proxy that's still failing (1 test)
   - Recover non-existent proxy (1 test)

#### E. Authentication Flow Error Paths (25 missing tests)
1. **Flow Registration:**
   - Register without type (1 test)
   - Register without steps (1 test)
   - Register duplicate name (1 test)
   - Register with empty steps array (1 test)

2. **Flow Execution:**
   - Execute non-existent flow (1 test)
   - Execute with missing context (1 test)
   - Execute with corrupted context (1 test)

3. **Step Execution:**
   - Step timeout (1 test)
   - Step action execution error (1 test)
   - Step waiting condition timeout (1 test)
   - Step with invalid selector (1 test)
   - Step with malformed payload (1 test)

4. **Retry Logic:**
   - Retry when non-retryable (1 test)
   - Retry exceeds max attempts (1 test)
   - Retry delay calculation error (1 test)
   - Retry with modified context (1 test)

5. **Session Management:**
   - Session cache hit/miss (2 tests)
   - Cache invalidation (1 test)
   - Cache memory pressure (1 test)

6. **Error Context:**
   - Error during context update (1 test)
   - Context propagation failures (1 test)
   - Metadata extraction on failure (1 test)

### 2.2 Edge Cases & Boundary Conditions (150+ missing tests)

**Numeric Boundaries:**
- Very large numbers (Number.MAX_VALUE, Number.MIN_VALUE)
- Negative zero (-0)
- Infinity and negative infinity
- NaN handling in calculations
- Integer overflow in counters
- Floating-point precision errors
- Zero timeout values
- Negative timeout values
- Extremely large delays (years)

**String & Data:**
- Empty strings ""
- Strings with only whitespace
- Extremely long strings (>10MB)
- Unicode edge cases (surrogate pairs)
- Binary data in string fields
- Null bytes in strings
- Control characters
- Very deeply nested JSON
- Circular JSON references
- Missing object properties

**Array & Collection:**
- Empty arrays []
- Arrays with null elements
- Arrays with undefined elements
- Very large arrays (>1M elements)
- Sparse arrays
- Arrays with mixed types
- Duplicate elements
- Out-of-order elements
- Index boundary conditions (0, length-1)

**Timing & Concurrency:**
- Operations completing in exact same millisecond
- Clock going backward (system time change)
- Microsecond-scale race conditions
- Timeout firing at exactly scheduled time
- Multiple simultaneous timeouts
- Timeout during callback execution
- Recursive async operations
- Deeply nested promise chains

### 2.3 Timeout and Retry Scenarios (80+ missing tests)

**Test Categories:**

1. **Retry with Various Delays:**
   - Initial delay = 0ms (2 tests)
   - Initial delay = max delay (1 test)
   - Backoff multiplier = 1 (no increase) (1 test)
   - Backoff multiplier > 2 (1 test)
   - Delay exceeds max after backoff (1 test)
   - Delay stabilizes at max (1 test)

2. **Retry Exhaustion:**
   - Fail on attempt N of M retries (6 tests)
   - All retries fail (1 test)
   - No retries allowed (maxRetries=0) (1 test)
   - Custom shouldRetry prevents retry (1 test)

3. **Timeout Boundaries:**
   - Operation completes at T ms (various T values) (5 tests)
   - Operation exceeds timeout by 1ms (1 test)
   - Timeout during network I/O (1 test)
   - Timeout during file I/O (1 test)
   - Timeout during CPU-bound work (1 test)

4. **Circuit Breaker Timeout:**
   - Timeout expires during execution (1 test)
   - Timeout expires between retries (1 test)
   - Timeout value = 0 (immediate half-open) (1 test)

5. **Cascading Timeouts:**
   - Parent operation timeout (1 test)
   - Child operation timeout (1 test)
   - Both timeouts fire (1 test)
   - Parent timeout clears child operations (1 test)

6. **Concurrent Timeout Scenarios:**
   - Multiple operations timing out simultaneously (1 test)
   - Timeout while operation in progress (1 test)
   - Timeout during context switch (1 test)

### 2.4 Concurrent Access Scenarios (100+ missing tests)

**Concurrency Issues:**

1. **Race Conditions in Cache:**
   - Two readers, cache miss (1 test)
   - Reader + writer collision (1 test)
   - Writer + writer collision (1 test)
   - TTL expiration during read (1 test)
   - Multiple TTL expirations (1 test)

2. **Proxy Pool Concurrent Access:**
   - Concurrent rotate() calls (2 tests)
   - Remove while rotating (1 test)
   - Health check during rotation (1 test)
   - Performance update during rotation (1 test)

3. **Session Concurrent Operations:**
   - Create two sessions simultaneously (1 test)
   - Record interaction while rotating (1 test)
   - Rotate while recording (1 test)
   - Validate coherence while rotating (1 test)

4. **WebSocket Concurrent Messages:**
   - Multiple messages before response (1 test)
   - Response arrives out of order (1 test)
   - Large message split across packets (1 test)
   - Message during connection close (1 test)

5. **Event Emitter Concurrency:**
   - Emit while listener added (1 test)
   - Emit while listener removed (1 test)
   - Multiple emits interleaved (1 test)

6. **Resource Pool Exhaustion:**
   - All resources in use simultaneously (1 test)
   - Requesting beyond pool size (1 test)
   - Concurrent acquisition + release (2 tests)
   - Deadlock scenarios (2 tests)

7. **Memoization Concurrent Access:**
   - Multiple calls same key (1 test)
   - Key collision in hash (1 test)
   - Cache clear during read (1 test)

8. **Circuit Breaker State Transitions:**
   - Transition open → half-open → closed (1 test)
   - Failed recovery attempt (1 test)
   - Success during half-open (1 test)
   - Failure during half-open (1 test)

### 2.5 Resource Constraint Scenarios (70+ missing tests)

**Memory Pressure:**
- Cache approaching memory limits (2 tests)
- Out of memory during operation (1 test)
- Memory leak detection (1 test)
- Garbage collection during operation (1 test)
- Large object allocation (1 test)
- Array buffer limits (1 test)
- Map/Set memory limits (1 test)

**File Descriptor Limits:**
- Max concurrent connections (1 test)
- Connection after limit reached (1 test)
- Recovery from connection limit (1 test)
- Rapid open/close cycles (1 test)

**Event Listener Limits:**
- MaxListenersExceeded warning (1 test)
- Removing listeners under pressure (1 test)
- Listener cleanup on error (1 test)

**Queue Overflow:**
- Message queue at capacity (1 test)
- Adding to full queue (1 test)
- Draining queue under pressure (1 test)

**Network Bandwidth:**
- Saturated network (1 test)
- Large payload transmission (1 test)
- Compression during bandwidth pressure (1 test)

**CPU Pressure:**
- Operation under high CPU load (1 test)
- Blocking operations competing (1 test)
- Event loop starvation (1 test)

**Disk I/O Pressure:**
- Slow disk I/O (1 test)
- Disk full condition (1 test)
- Concurrent disk access (1 test)

---

## Part 3: Test Expansion Roadmap (800+ lines)

### 3.1 Phase 1: Quick Wins to Reach 94% (1-2 weeks)

**Objective:** Bridge gap from 93.2% to 94.0% with focus on quick-win tests

**Sprint 1a: Utility Module Testing (4-5 days)**

**async-utils.js Tests (120 tests)**
```javascript
// Test Structure:
describe('retryAsync', () => {
  // 25 tests covering:
  it('should retry with exponential backoff');
  it('should throw on invalid input');
  it('should respect maxRetries option');
  it('should call onRetry callback');
  it('should use shouldRetry predicate');
  it('should respect maxDelay limit');
  it('should preserve this context');
  // ... 18 more tests
});

describe('CircuitBreaker', () => {
  // 40 tests covering:
  it('should open circuit after threshold');
  it('should transition to half-open after timeout');
  it('should close on success threshold');
  it('should emit callbacks on state change');
  it('should handle concurrent requests');
  // ... 35 more tests
});

describe('parallelAsync', () => {
  // 30 tests covering:
  it('should limit concurrency');
  it('should preserve order');
  it('should handle failures');
  // ... 27 more tests
});

describe('sequentialAsync', () => {
  // 25 tests covering:
  it('should execute in order');
  it('should call progress callback');
  it('should stop on first error');
  // ... 22 more tests
});

describe('memoizeAsync', () => {
  // 20 tests covering:
  it('should cache results');
  it('should respect TTL');
  it('should use custom key generator');
  // ... 17 more tests
});

describe('debounceAsync', () => {
  // 15 tests covering:
  it('should debounce calls');
  it('should support leading edge');
  it('should return promises');
  // ... 12 more tests
});
```

**response-formatter.js Tests (100 tests)**
```javascript
describe('ResponseFormatter', () => {
  describe('success()', () => {
    // 12 tests
    it('should format success response');
    it('should include metadata if provided');
    it('should set correct code');
    // ... 9 more tests
  });

  describe('error()', () => {
    // 15 tests
    it('should format error response');
    it('should set correct status code');
    it('should handle custom codes');
    // ... 12 more tests
  });

  describe('partial()', () => {
    // 12 tests
  });

  describe('paginated()', () => {
    // 12 tests
    it('should calculate total pages');
    it('should set hasNextPage correctly');
    // ... 10 more tests
  });

  describe('async()', () => {
    // 8 tests
  });

  describe('redirect()', () => {
    // 8 tests
  });

  describe('isValid()', () => {
    // 15 tests
    it('should validate response structure');
    it('should check required fields');
    // ... 13 more tests
  });

  describe('toJSON()', () => {
    // 8 tests
    it('should serialize responses');
    it('should handle Error objects');
    // ... 6 more tests
  });

  describe('errorResponse()', () => {
    // 12 tests
  });
});
```

**Effort:** 3-4 days  
**Expected Impact:** +0.5% coverage

**Sprint 1b: Error Path Testing (4-5 days)**

**Negative Tests for Session Manager (50 tests)**
```javascript
describe('SessionManager Error Paths', () => {
  describe('error handling', () => {
    it('should handle null session on recordInteraction');
    it('should handle rotation with invalid profile');
    it('should handle concurrent creation');
    // ... 47 more tests
  });
});
```

**Negative Tests for Proxy Manager (40 tests)**
```javascript
describe('ResidentialProxyManager Error Paths', () => {
  describe('configuration errors', () => {
    it('should reject invalid proxy URLs');
    it('should reject invalid rotation modes');
    // ... 38 more tests
  });
});
```

**Effort:** 3-4 days  
**Expected Impact:** +0.3% coverage

**Sprint 1c: Edge Case Testing (4-5 days)**

**Boundary Condition Tests (80 tests)**
- Zero/empty input tests: 15 tests
- Maximum size tests: 15 tests
- Unicode/special char tests: 10 tests
- Numeric boundary tests: 20 tests
- Timeout boundary tests: 20 tests

**Effort:** 3-4 days  
**Expected Impact:** +0.2% coverage

**Phase 1 Summary:**
- **Total Tests Added:** 320 tests
- **Coverage Gain:** +1.0% (93.2% → 94.2%)
- **Timeline:** 1-2 weeks
- **Success Criteria:** 
  - All new tests passing
  - No regressions in existing tests
  - Coverage >94%

### 3.2 Phase 2: Reach 95%+ Coverage (2-3 weeks)

**Objective:** Systematic coverage of remaining gaps

**Sprint 2a: Concurrency & Timing Tests (6-8 days)**

**Race Condition Tests (80 tests)**
```javascript
describe('Concurrency Issues', () => {
  describe('cache access patterns', () => {
    it('should handle simultaneous cache reads');
    it('should handle read/write collision');
    it('should handle TTL expiration race');
    // ... 77 more tests
  });

  describe('proxy rotation races', () => {
    it('should maintain consistency during concurrent rotation');
    it('should handle removal during rotation');
    // ... tests for all race scenarios
  });

  describe('session races', () => {
    it('should handle concurrent session creation');
    it('should handle record + rotate races');
    // ... tests for session races
  });

  describe('event emitter races', () => {
    it('should handle emit during listener add');
    it('should handle multiple concurrent emits');
    // ... tests for event races
  });
});
```

**Timeout & Timing Tests (60 tests)**
```javascript
describe('Timeout & Timing Boundaries', () => {
  describe('retry timing', () => {
    it('should complete exactly at timeout');
    it('should fail just after timeout');
    it('should handle clock skew');
    // ... 57 more tests
  });

  describe('cascade timeouts', () => {
    it('should handle parent timeout');
    it('should propagate child timeout');
    // ... tests for cascade scenarios
  });
});
```

**Effort:** 6-8 days  
**Expected Impact:** +0.4% coverage

**Sprint 2b: Network & Error Path Tests (6-8 days)**

**Network Failure Scenarios (80 tests)**
- Connection reset: 8 tests
- Connection timeout: 8 tests
- Partial data: 8 tests
- Data corruption: 8 tests
- DNS failures: 6 tests
- SSL errors: 8 tests
- Proxy failures: 8 tests
- Rate limiting: 8 tests
- Bandwidth exhaustion: 8 tests
- Concurrent network errors: 6 tests

**Resource Exhaustion Tests (70 tests)**
- Memory pressure: 12 tests
- Connection pool limits: 8 tests
- Event listener limits: 6 tests
- File descriptor limits: 6 tests
- Queue overflow: 8 tests
- Cache overflow: 8 tests
- Message buffer limits: 8 tests
- Process limit: 6 tests

**Effort:** 6-8 days  
**Expected Impact:** +0.5% coverage

**Sprint 2c: Integration & E2E Tests (6-8 days)**

**Cross-Module Integration Tests (90 tests)**
- Session + Proxy interaction: 15 tests
- Session + Auth integration: 15 tests
- Evasion + Proxy coordination: 15 tests
- WebSocket + Command execution: 15 tests
- Cache + Network coordination: 15 tests
- Forensics + Analysis pipeline: 15 tests

**End-to-End Scenarios (50 tests)**
- Full auth flow with retries: 8 tests
- Session lifecycle with rotation: 8 tests
- Proxy failover chains: 8 tests
- Multi-step evasion execution: 8 tests
- Data pipeline with errors: 8 tests
- Concurrent user sessions: 10 tests

**Effort:** 6-8 days  
**Expected Impact:** +0.6% coverage

**Phase 2 Summary:**
- **Total Tests Added:** 430 tests
- **Coverage Gain:** +1.5% (94.2% → 95.7%)
- **Timeline:** 2-3 weeks
- **Success Criteria:**
  - All tests passing
  - Coverage >95%
  - No flaky tests
  - CI/CD integration working

### 3.3 Phase 3: Advanced Coverage & Polish (3-4 weeks)

**Objective:** Cover remaining edge cases and implement coverage gates

**Sprint 3a: Fuzzing & Property-Based Tests (5-6 days)**

**Input Fuzzing (100 tests)**
```javascript
// Using libraries like fast-check or jsverify
describe('Property-Based Testing', () => {
  it('should handle any valid JSON', () => {
    fc.assert(
      fc.property(fc.json(), (input) => {
        const response = ResponseFormatter.success(input);
        expect(ResponseFormatter.isValid(response)).toBe(true);
      })
    );
  });

  it('should handle any string as key', () => {
    fc.assert(
      fc.property(fc.string(), (key) => {
        const cache = new Map();
        cache.set(key, 'value');
        expect(cache.has(key)).toBe(true);
      })
    );
  });

  // ... 98 more property-based tests
});
```

**Mutation Testing (50 tests)**
- Verify test detection of code mutations
- Identify tests that don't catch changes
- Increase test quality metrics

**Effort:** 5-6 days  
**Expected Impact:** +0.2% coverage

**Sprint 3b: Security-Specific Tests (5-6 days)**

**Input Validation Tests (80 tests)**
- SQL injection patterns: 10 tests
- XSS injection patterns: 10 tests
- Command injection patterns: 8 tests
- Path traversal patterns: 8 tests
- XXE injection patterns: 6 tests
- CSRF token validation: 8 tests
- Authentication bypass: 8 tests
- Authorization checks: 8 tests
- Data tampering detection: 8 tests
- Rate limiting bypass: 6 tests

**Error Handling Security (40 tests)**
- Information disclosure in errors: 8 tests
- Stack trace exposure: 8 tests
- Timing-based side channels: 6 tests
- Resource exhaustion attacks: 8 tests
- Denial of service vectors: 6 tests
- Cryptographic weaknesses: 6 tests

**Effort:** 5-6 days  
**Expected Impact:** +0.2% coverage

**Sprint 3c: Performance & Load Tests (5-6 days)**

**Performance Regression Tests (60 tests)**
- Throughput benchmarks: 15 tests
- Latency percentiles: 15 tests
- Memory usage profiles: 10 tests
- CPU efficiency: 8 tests
- Cache hit rates: 6 tests
- Queue depth metrics: 6 tests

**Load Testing Under Edge Cases (50 tests)**
- 100 concurrent operations: 2 tests
- 200 concurrent operations: 2 tests
- 500 concurrent operations: 2 tests
- Memory pressure load: 2 tests
- Network saturation load: 2 tests
- Mixed workload patterns: 4 tests
- Sustained load stability: 3 tests
- Load recovery after spikes: 3 tests
- Cascading failure under load: 3 tests
- Graceful degradation: 3 tests
- Resource cleanup under load: 3 tests
- Metric accuracy under load: 3 tests
- Error rate under load: 3 tests
- ... and 19 more tests

**Effort:** 5-6 days  
**Expected Impact:** +0.2% coverage

**Sprint 3d: Coverage Infrastructure (4-5 days)**

**Coverage Measurement Tools:**
- Implement codecov.io integration
- Set up coverage gates in CI/CD
- Create coverage trend dashboard
- Automate coverage reports

**Test Quality Metrics:**
- Implement mutation testing (Stryker)
- Set up test effectiveness scoring
- Create code coverage heatmaps
- Automated gap detection

**Effort:** 4-5 days  
**Expected Impact:** Infrastructure for maintaining 95%+ coverage

**Phase 3 Summary:**
- **Total Tests Added:** 340 tests
- **Coverage Gain:** +0.4% (95.7% → 96.1%)
- **Timeline:** 3-4 weeks
- **Success Criteria:**
  - Coverage >95%
  - All tests passing
  - CI/CD gates enforced
  - Mutation testing integrated

### 3.4 Overall Roadmap Timeline

```
Week 1-2 (May 31-Jun 13):  Phase 1 - Quick Wins
├─ Sprint 1a: Utilities (120 tests)
├─ Sprint 1b: Error Paths (90 tests)
└─ Sprint 1c: Edge Cases (80 tests)
└─ Result: 290 tests, 94.0% coverage

Week 3-5 (Jun 14-Jun 28): Phase 2 - Reach 95%
├─ Sprint 2a: Concurrency (140 tests)
├─ Sprint 2b: Network/Resources (150 tests)
└─ Sprint 2c: Integration/E2E (140 tests)
└─ Result: 430 tests, 95.7% coverage

Week 6-8 (Jun 29-Jul 13): Phase 3 - Advanced
├─ Sprint 3a: Fuzzing (150 tests)
├─ Sprint 3b: Security (120 tests)
├─ Sprint 3c: Performance (110 tests)
└─ Sprint 3d: Infrastructure (n/a)
└─ Result: 380 tests, 96.1% coverage

Total: 1,100+ new tests, 93.2% → 96.1% coverage
```

---

## Part 4: Test Types Missing (400+ lines)

### 4.1 Fuzzing Tests (Currently: 0, Required: 150+)

**Input Fuzzing**

Purpose: Test system behavior with random/malformed inputs

Status: NOT IMPLEMENTED

Coverage needed:
- JSON structure fuzzing: 30 tests
- String content fuzzing: 25 tests
- Array/object shape fuzzing: 25 tests
- Numeric value fuzzing: 20 tests
- Buffer/binary fuzzing: 20 tests
- Command parameter fuzzing: 20 tests
- Configuration parameter fuzzing: 15 tests

Implementation approach:
```javascript
// Using fast-check library
const fc = require('fast-check');

describe('Fuzzing Tests', () => {
  it('should handle arbitrary JSON payloads', () => {
    fc.assert(
      fc.property(fc.json(), (payload) => {
        try {
          const response = ResponseFormatter.success(payload);
          expect(response.success).toBe(true);
        } catch (e) {
          // Should throw or handle gracefully, not crash
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('should handle random proxy configurations', () => {
    fc.assert(
      fc.property(
        fc.record({
          host: fc.domain(),
          port: fc.integer({ min: 1, max: 65535 }),
          protocol: fc.oneof(fc.constant('http'), fc.constant('https'))
        }),
        (config) => {
          const result = proxyManager.validateProxyConfig(config);
          expect(typeof result).toBe('object');
        }
      ),
      { numRuns: 500 }
    );
  });
});
```

### 4.2 Mutation Testing (Currently: 0, Required: 100+)

**Mutation Test Suite**

Purpose: Verify test quality by checking if tests catch code changes

Status: NOT IMPLEMENTED

Tools needed:
- Stryker mutation testing framework
- Custom mutation detectors
- Mutation report generation

Implementation:
```bash
# Install Stryker
npm install --save-dev @stryker-mutator/core @stryker-mutator/javascript-mutator

# Configuration in stryker.conf.json
{
  "mutate": ["src/**/*.js"],
  "testRunner": "jest",
  "transpilers": [],
  "timeoutMS": 10000,
  "logLevel": "info"
}

# Run mutation tests
npm run mutation
```

Coverage goals:
- Line mutations: 95%+ killed
- Conditional mutations: 90%+ killed
- Operator mutations: 92%+ killed
- Method mutations: 88%+ killed

### 4.3 Penetration Testing (Currently: 0, Required: 80+)

**Security-Focused Tests**

Purpose: Identify security vulnerabilities through testing

Status: NOT IMPLEMENTED

Test categories:

1. **Input Validation Penetration (20 tests)**
   - SQL injection attempts
   - Command injection attempts
   - Path traversal attempts
   - XSS payload injection
   - XXE attacks
   - SSRF attempts
   - Format string attacks
   - Buffer overflow attempts
   - Integer overflow attempts
   - Null byte injection

2. **Authentication Penetration (15 tests)**
   - Default credential attempts
   - Weak password patterns
   - Session fixation
   - Session hijacking
   - CSRF attacks
   - Auth bypass techniques
   - Token forgery
   - Privilege escalation
   - Impersonation attacks
   - Replay attacks

3. **Data Protection Penetration (15 tests)**
   - Unencrypted transmission
   - Weak encryption algorithms
   - Insufficient hashing
   - Information disclosure
   - Memory dumps
   - Log exposure
   - Error message leakage
   - Timing attacks
   - Side channel attacks
   - Metadata exposure

4. **Resource Abuse (20 tests)**
   - Denial of service
   - Rate limiting bypass
   - Resource exhaustion
   - Amplification attacks
   - Cascade failures
   - Circuit breaker bypass
   - Timeout manipulation
   - Memory exhaustion
   - File descriptor exhaustion
   - Lock contention attacks

5. **API Abuse (10 tests)**
   - Invalid method calls
   - Type confusion
   - Object manipulation
   - Prototype pollution
   - Function hooking
   - Event listener abuse
   - Promise rejection handling
   - Error handler exploitation
   - Callback hijacking
   - Synchronization bypass

### 4.4 Load Testing Under Edge Cases (Currently: Basic, Required: 100+)

**Advanced Load Testing**

Purpose: Verify stability and performance under stress conditions

Status: PARTIALLY IMPLEMENTED

Missing test scenarios:

1. **Cascading Failure Load (15 tests)**
   - Service degradation cascade
   - Error propagation under load
   - Circuit breaker triggering
   - Fallback mechanism activation
   - Recovery sequence validation
   - Resource cleanup during cascade
   - Message queue behavior
   - Connection pool exhaustion
   - Memory growth tracking
   - CPU saturation handling

2. **Mixed Workload Load (15 tests)**
   - Heavy read, light write
   - Light read, heavy write
   - Balanced mixed operations
   - Bursty traffic patterns
   - Gradual ramp-up
   - Sudden spikes
   - Sustained high load
   - Oscillating load
   - Sawtooth patterns
   - Random load distributions

3. **Resource Constrained Load (15 tests)**
   - Limited memory (512MB)
   - Limited connections (50)
   - Limited file descriptors (256)
   - Limited CPU (single core)
   - Limited network bandwidth (1Mbps)
   - Limited disk space (100MB)
   - Limited event listeners (max)
   - Limited queue depth (100)
   - Combined resource limits
   - Selective resource limits

4. **Duration & Stability Load (15 tests)**
   - 1-hour sustained load
   - 4-hour sustained load
   - 24-hour stability test
   - Memory leak detection
   - Garbage collection impact
   - Connection leak detection
   - File descriptor leak detection
   - Event listener leak detection
   - Cache growth monitoring
   - Performance degradation tracking

5. **Recovery & Failover Load (15 tests)**
   - Recovery from overload
   - Connection pool recovery
   - Queue drain timing
   - Metric reset after recovery
   - Client reconnection handling
   - State consistency after failover
   - Data loss during failover
   - Transaction consistency
   - Session persistence
   - Request replay scenarios

6. **Error Condition Load (15 tests)**
   - 50% operation failure rate
   - Intermittent failures
   - Timeout-induced failures
   - Network failure injection
   - Partial response failures
   - Corrupted data injection
   - Out-of-order message injection
   - Duplicate message injection
   - Missing data injection
   - Rate limiting injection

### 4.5 Recovery & Failover Testing (Currently: Limited, Required: 70+)

**Resilience Testing**

Purpose: Verify system recovery and failover mechanisms

Status: INCOMPLETE

Test categories:

1. **Automatic Recovery (20 tests)**
   - Circuit breaker auto-recovery
   - Connection auto-reconnection
   - Session auto-restoration
   - Cache auto-invalidation
   - Pool auto-rebalance
   - Metric auto-reset
   - State auto-sync
   - Timeout auto-adjust
   - Rate limiting auto-adjust
   - Resource auto-release

2. **Manual Recovery (15 tests)**
   - Manual restart
   - Manual reset
   - Manual refresh
   - Manual flush
   - Manual recalibration
   - State rollback
   - Cache clear
   - Pool drain
   - Connection close
   - Event purge

3. **Failover Scenarios (20 tests)**
   - Primary failure
   - Secondary failure
   - Cascade failures
   - Partial failures
   - Network partition
   - Data center outage
   - Service degradation
   - Dependency failure
   - External service failure
   - Infrastructure failure

4. **Data Consistency (15 tests)**
   - Data loss prevention
   - State synchronization
   - Transaction integrity
   - Message ordering
   - Duplicate detection
   - Version consistency
   - Cache coherency
   - Session consistency
   - Configuration consistency
   - Metric consistency

---

## Part 5: Critical Path 100% Coverage (400+ lines)

### 5.1 Authentication Flow (Must Reach 100%)

**Current Status:** ~70% estimated  
**Gaps Identified:** 18-20 critical tests missing

**Authentication Flow Paths:**

1. **OAuth Flow Complete Coverage (8 tests)**
   ```javascript
   describe('OAuth Flow - 100% Coverage', () => {
     it('should initialize OAuth with valid config');
     it('should initialize OAuth with missing config');
     it('should initialize OAuth with invalid config');
     it('should redirect to provider');
     it('should handle redirect timeout');
     it('should handle provider rejection');
     it('should exchange code for token');
     it('should handle token expiration');
   });
   ```

2. **Login Form Complete Coverage (6 tests)**
   ```javascript
   describe('Login Form - 100% Coverage', () => {
     it('should find and fill login form');
     it('should handle missing username field');
     it('should handle missing password field');
     it('should submit form and wait for redirect');
     it('should handle form submission timeout');
     it('should handle form validation error');
   });
   ```

3. **CAPTCHA Handling Complete Coverage (4 tests)**
   ```javascript
   describe('CAPTCHA - 100% Coverage', () => {
     it('should detect CAPTCHA presence');
     it('should skip when CAPTCHA detected (configured)');
     it('should attempt CAPTCHA solve');
     it('should fail flow on CAPTCHA failure');
   });
   ```

4. **Session Persistence Complete Coverage (3 tests)**
   ```javascript
   describe('Session Persistence - 100% Coverage', () => {
     it('should save session cookies');
     it('should restore session on reuse');
     it('should handle session expiration');
   });
   ```

**Implementation Plan:**
- Week 1: Implement 8 OAuth tests
- Week 1: Implement 6 login form tests
- Week 2: Implement 4 CAPTCHA tests
- Week 2: Implement 3 session tests
- Total: 21 tests, completing authentication path

### 5.2 WebSocket Communication (Must Reach 100%)

**Current Status:** ~75% estimated  
**Gaps Identified:** 25-30 critical tests missing

**WebSocket Paths:**

1. **Connection Lifecycle (10 tests)**
   ```javascript
   describe('WebSocket Connection - 100% Coverage', () => {
     it('should establish connection successfully');
     it('should handle connection refused');
     it('should handle connection timeout');
     it('should handle invalid URL');
     it('should handle protocol mismatch');
     it('should handle certificate errors');
     it('should reconnect after disconnect');
     it('should reconnect with backoff');
     it('should give up after max retries');
     it('should emit connection events');
   });
   ```

2. **Message Handling (10 tests)**
   ```javascript
   describe('Message Handling - 100% Coverage', () => {
     it('should send text message');
     it('should send binary message');
     it('should receive text message');
     it('should receive binary message');
     it('should handle malformed JSON');
     it('should handle oversized message');
     it('should handle fragmented message');
     it('should preserve message order');
     it('should buffer during disconnect');
     it('should flush buffer on reconnect');
   });
   ```

3. **Frame Handling (6 tests)**
   ```javascript
   describe('Frame Handling - 100% Coverage', () => {
     it('should handle ping frame');
     it('should handle pong frame');
     it('should send ping on idle');
     it('should timeout on ping response');
     it('should handle connection close frame');
     it('should cleanup on close');
   });
   ```

4. **Error Handling (6 tests)**
   ```javascript
   describe('WebSocket Errors - 100% Coverage', () => {
     it('should handle network error');
     it('should handle protocol error');
     it('should handle timeout error');
     it('should handle invalid frame');
     it('should handle close with code');
     it('should emit error event');
   });
   ```

**Implementation Plan:**
- Week 1-2: Implement 10 connection tests
- Week 2: Implement 10 message tests
- Week 2: Implement 6 frame tests
- Week 3: Implement 6 error tests
- Total: 32 tests, completing WebSocket path

### 5.3 Command Processing (Must Reach 100%)

**Current Status:** ~80% estimated  
**Gaps Identified:** 15-20 critical tests missing

**Command Paths:**

1. **Command Parsing (8 tests)**
   ```javascript
   describe('Command Parsing - 100% Coverage', () => {
     it('should parse valid command');
     it('should reject unknown command');
     it('should reject malformed JSON');
     it('should validate command schema');
     it('should handle missing parameters');
     it('should handle invalid parameter types');
     it('should handle extra parameters');
     it('should handle null/undefined values');
   });
   ```

2. **Command Execution (8 tests)**
   ```javascript
   describe('Command Execution - 100% Coverage', () => {
     it('should execute synchronous command');
     it('should execute asynchronous command');
     it('should timeout long-running command');
     it('should handle command exception');
     it('should cleanup after command');
     it('should queue concurrent commands');
     it('should maintain command order');
     it('should report execution progress');
   });
   ```

3. **Result Handling (4 tests)**
   ```javascript
   describe('Result Handling - 100% Coverage', () => {
     it('should format success result');
     it('should format error result');
     it('should handle large result');
     it('should compress result');
   });
   ```

**Implementation Plan:**
- Week 2: Implement 8 parsing tests
- Week 3: Implement 8 execution tests
- Week 3: Implement 4 result tests
- Total: 20 tests, completing command path

### 5.4 Error Handling (Must Reach 100%)

**Current Status:** ~65% estimated  
**Gaps Identified:** 30-35 critical tests missing

**Error Paths:**

1. **Error Detection (10 tests)**
   ```javascript
   describe('Error Detection - 100% Coverage', () => {
     it('should detect TypeError');
     it('should detect ReferenceError');
     it('should detect RangeError');
     it('should detect SyntaxError');
     it('should detect custom errors');
     it('should detect timeout errors');
     it('should detect network errors');
     it('should detect authentication errors');
     it('should detect validation errors');
     it('should detect resource errors');
   });
   ```

2. **Error Propagation (10 tests)**
   ```javascript
   describe('Error Propagation - 100% Coverage', () => {
     it('should propagate synchronous errors');
     it('should propagate promise rejections');
     it('should propagate async errors');
     it('should propagate callback errors');
     it('should propagate event errors');
     it('should chain error handlers');
     it('should maintain error context');
     it('should preserve stack traces');
     it('should prevent swallowed errors');
     it('should report uncaught errors');
   });
   ```

3. **Error Recovery (10 tests)**
   ```javascript
   describe('Error Recovery - 100% Coverage', () => {
     it('should retry transient errors');
     it('should skip non-retryable errors');
     it('should exhaust retry attempts');
     it('should apply exponential backoff');
     it('should fallback to alternative');
     it('should graceful degrade');
     it('should cleanup on error');
     it('should reset state on recovery');
     it('should log recovery actions');
     it('should emit recovery events');
   });
   ```

4. **Error Logging (5 tests)**
   ```javascript
   describe('Error Logging - 100% Coverage', () => {
     it('should log error with context');
     it('should include stack trace');
     it('should sanitize sensitive data');
     it('should respect log level');
     it('should handle logging errors');
   });
   ```

**Implementation Plan:**
- Week 2-3: Implement 10 detection tests
- Week 3: Implement 10 propagation tests
- Week 4: Implement 10 recovery tests
- Week 4: Implement 5 logging tests
- Total: 35 tests, completing error path

### 5.5 Resource Management (Must Reach 100%)

**Current Status:** ~60% estimated  
**Gaps Identified:** 35-40 critical tests missing

**Resource Paths:**

1. **Memory Management (10 tests)**
   ```javascript
   describe('Memory Management - 100% Coverage', () => {
     it('should allocate memory for cache');
     it('should deallocate on removal');
     it('should detect memory leaks');
     it('should enforce memory limits');
     it('should trigger garbage collection');
     it('should handle OOM gracefully');
     it('should monitor memory growth');
     it('should clear cache under pressure');
     it('should trim large objects');
     it('should report memory stats');
   });
   ```

2. **Connection Management (10 tests)**
   ```javascript
   describe('Connection Management - 100% Coverage', () => {
     it('should create connection');
     it('should reuse pooled connection');
     it('should close idle connection');
     it('should cleanup on error');
     it('should timeout stale connection');
     it('should handle connection limit');
     it('should drain pool gracefully');
     it('should report pool stats');
     it('should monitor connection health');
     it('should handle connection leak');
   });
   ```

3. **File Descriptor Management (8 tests)**
   ```javascript
   describe('File Descriptor Management - 100% Coverage', () => {
     it('should open file');
     it('should close file');
     it('should cleanup on error');
     it('should handle FD limit');
     it('should detect FD leak');
     it('should report FD stats');
     it('should fallback on limit');
     it('should reclaim FDs');
   });
   ```

4. **Event Listener Management (8 tests)**
   ```javascript
   describe('Event Listener Management - 100% Coverage', () => {
     it('should add listener');
     it('should remove listener');
     it('should prevent duplicate listeners');
     it('should cleanup on error');
     it('should warn on listener limit');
     it('should detect listener leak');
     it('should report listener stats');
     it('should cleanup abandoned listeners');
   });
   ```

5. **Cleanup & Shutdown (4 tests)**
   ```javascript
   describe('Cleanup & Shutdown - 100% Coverage', () => {
     it('should cleanup all resources');
     it('should close all connections');
     it('should flush all buffers');
     it('should report shutdown status');
   });
   ```

**Implementation Plan:**
- Week 3-4: Implement 10 memory tests
- Week 4: Implement 10 connection tests
- Week 4: Implement 8 FD tests
- Week 5: Implement 8 listener tests
- Week 5: Implement 4 cleanup tests
- Total: 40 tests, completing resource path

---

## Part 6: Testing Infrastructure Improvements (300+ lines)

### 6.1 Coverage Measurement & Reporting

**Current State:**
- Jest coverage reporting available
- No automated coverage gates
- No trend tracking
- No coverage dashboards

**Improvements Needed:**

1. **Automated Coverage Gates**
   ```javascript
   // jest.config.js
   module.exports = {
     collectCoverageFrom: [
       'src/**/*.js',
       '!src/**/*.test.js',
       '!src/index.js'
     ],
     coverageThreshold: {
       global: {
         branches: 95,
         functions: 95,
         lines: 95,
         statements: 95
       },
       './src/utils/': {
         branches: 100,
         functions: 100,
         lines: 100,
         statements: 100
       }
     },
     coverageReporters: [
       'text',
       'lcov',
       'json',
       'html'
     ]
   };
   ```

2. **CI/CD Integration**
   ```yaml
   # .github/workflows/coverage.yml
   name: Coverage Check
   on: [pull_request]
   jobs:
     coverage:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         - uses: actions/setup-node@v2
         - run: npm install
         - run: npm test -- --coverage
         - uses: codecov/codecov-action@v2
           with:
             files: ./coverage/lcov.info
         - name: Comment PR
           if: failure()
           uses: actions/github-script@v6
   ```

3. **Coverage Trend Tracking**
   - Store coverage metrics in time-series DB
   - Generate trend reports (weekly/monthly)
   - Alert on coverage regression
   - Visualize progress toward 95%+ target

4. **Coverage Heatmaps**
   - Identify most tested vs. least tested modules
   - Highlight high-complexity, low-coverage areas
   - Suggest tests for low-coverage files
   - Track coverage by commit

### 6.2 Continuous Coverage Tracking

**Implementation:**

1. **Weekly Coverage Reports**
   ```bash
   # scripts/coverage-report.sh
   npm test -- --coverage
   
   # Generate report
   coverage_pct=$(cat coverage/coverage-summary.json | \
                  jq '.total.lines.pct')
   
   echo "Coverage: ${coverage_pct}%"
   
   # Store in metrics
   echo "${coverage_pct}" >> metrics/coverage-trend.txt
   ```

2. **Coverage Metrics Dashboard**
   - Real-time coverage percentage
   - Test count by module
   - Test pass rate by module
   - Coverage trend (weekly)
   - Failing test details
   - Code coverage heatmap

3. **Automated Coverage Gap Detection**
   ```javascript
   // scripts/coverage-gaps.js
   const coverage = require('./coverage/coverage-summary.json');
   
   const gaps = Object.entries(coverage)
     .filter(([file, stats]) => stats.lines.pct < 90)
     .sort((a, b) => a[1].lines.pct - b[1].lines.pct);
   
   console.log('Files below 90% coverage:');
   gaps.forEach(([file, stats]) => {
     console.log(`  ${file}: ${stats.lines.pct}%`);
   });
   ```

### 6.3 Test Data Generation & Fixtures

**Current State:**
- Manual test data creation
- Hardcoded test fixtures
- Limited data variation
- Difficult to maintain

**Improvements Needed:**

1. **Data Factory Pattern**
   ```javascript
   // tests/fixtures/factories.js
   
   class ProxyFactory {
     static create(overrides = {}) {
       return {
         host: 'proxy.example.com',
         port: 8080,
         protocol: 'http',
         ...overrides
       };
     }
     
     static createMany(count, overrides = {}) {
       return Array(count).fill(0)
         .map((_, i) => this.create({
           ...overrides,
           host: `proxy${i}.example.com`
         }));
     }
   }
   
   class SessionFactory {
     static create(overrides = {}) {
       return {
         id: crypto.randomBytes(16).toString('hex'),
         createdAt: Date.now(),
         deviceProfile: null,
         ...overrides
       };
     }
   }
   ```

2. **Realistic Data Generators**
   ```javascript
   // tests/fixtures/generators.js
   
   function generateProxyList(count) {
     return Array(count).fill(0).map((_, i) => ({
       host: `residential${i}.proxy-pool.com`,
       port: 8080 + i,
       protocol: ['http', 'https'][i % 2]
     }));
   }
   
   function generateWebSocketCommands(count) {
     const commands = ['navigate', 'click', 'fill', 'screenshot'];
     return Array(count).fill(0).map((_, i) => ({
       id: `cmd-${i}`,
       command: commands[i % commands.length],
       params: {}
     }));
   }
   ```

3. **Fixture Management**
   ```javascript
   // tests/fixtures/index.js
   
   module.exports = {
     // Pre-generated fixture sets
     proxyPool: require('./proxy-pool.json'),
     validSessions: require('./valid-sessions.json'),
     errorScenarios: require('./error-scenarios.json'),
     
     // Factories for dynamic generation
     factories: require('./factories'),
     
     // Generators for varied data
     generators: require('./generators')
   };
   ```

### 6.4 Mock & Stub Improvements

**Current State:**
- Jest mocks available
- Limited stub coverage
- No mock validation
- Difficult to track mock calls

**Improvements Needed:**

1. **Mock Verification Library**
   ```javascript
   // tests/utils/mock-assertions.js
   
   class MockAssertions {
     static verifyCallCount(mock, count) {
       if (mock.mock.calls.length !== count) {
         throw new Error(
           `Expected ${count} calls, got ${mock.mock.calls.length}`
         );
       }
     }
     
     static verifyArgumentsAt(mock, index, expected) {
       const actual = mock.mock.calls[index];
       if (!deepEqual(actual, expected)) {
         throw new Error(`Arguments at index ${index} don't match`);
       }
     }
     
     static verifyCallOrder(mocks) {
       // Verify mocks called in expected order
     }
   }
   ```

2. **Spy & Stub Framework**
   ```javascript
   // Wrapper around Jest mocks with better ergonomics
   
   class TestDouble {
     constructor(impl) {
       this.impl = impl;
       this.mock = jest.fn(impl);
       this.callHistory = [];
     }
     
     reset() {
       this.mock.mockReset();
       this.callHistory = [];
     }
     
     expectCalls(pattern) {
       // Assert call pattern
     }
     
     spy() {
       // Start spying without mocking behavior
     }
   }
   ```

3. **HTTP & Network Mocking**
   ```javascript
   // tests/utils/http-mock.js
   
   class HttpMock {
     static createServer(routes) {
       const server = require('http').createServer((req, res) => {
         const route = routes[req.url];
         if (route) {
           res.writeHead(route.status);
           res.end(route.body);
         }
       });
       return server;
     }
   }
   
   class WebSocketMock {
     static create(handlers = {}) {
       // Create mock WebSocket with handlers
     }
   }
   ```

### 6.5 Test Execution & Reporting

**Current State:**
- Jest CLI execution
- Basic pass/fail reporting
- No detailed metrics
- Difficult to find slow tests

**Improvements Needed:**

1. **Test Performance Analysis**
   ```bash
   # scripts/analyze-tests.js
   npm test -- --verbose --collectCoverageFrom=src \
     --testTimeout=30000 > test-results.json
   
   # Analyze slow tests
   node scripts/find-slow-tests.js test-results.json
   ```

2. **Test Categorization & Filtering**
   ```javascript
   // jest.config.js
   module.exports = {
     testMatch: [
       '<rootDir>/tests/unit/**/*.test.js',
       '<rootDir>/tests/integration/**/*.test.js',
       '<rootDir>/tests/e2e/**/*.test.js',
     ],
     
     projects: [
       {
         displayName: 'unit',
         testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
         testTimeout: 5000
       },
       {
         displayName: 'integration',
         testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
         testTimeout: 30000
       },
       {
         displayName: 'e2e',
         testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
         testTimeout: 60000
       }
     ]
   };
   ```

3. **Test Retry & Flakiness Detection**
   ```javascript
   // tests/utils/retry-test.js
   
   function retryTest(testFn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return testFn();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         // Test is flaky, log warning
       }
     }
   }
   ```

4. **Test Results Dashboard**
   - Real-time test execution status
   - Pass rate trending
   - Slow test identification
   - Flaky test tracking
   - Coverage by test category
   - Execution time by module

### 6.6 Test Documentation & Maintenance

**Current State:**
- Inline test comments
- No test registry
- No testing guidelines
- Difficult to find related tests

**Improvements Needed:**

1. **Test Registry & Discovery**
   ```javascript
   // tests/registry.js
   
   const testRegistry = {
     'async-utils': [
       { name: 'retryAsync', tests: 25, coverage: 100 },
       { name: 'CircuitBreaker', tests: 40, coverage: 100 },
       // ...
     ],
     'session-manager': [
       { name: 'creation', tests: 8, coverage: 90 },
       { name: 'rotation', tests: 12, coverage: 85 },
       // ...
     ]
   };
   ```

2. **Testing Guidelines**
   - Test naming conventions
   - Test structure best practices
   - Assertion patterns
   - Mock/stub best practices
   - Coverage expectations per file

3. **Test Documentation**
   ```javascript
   /**
    * @testGroup Authentication
    * @testArea OAuth
    * @coverage 100%
    * @complexity high
    * 
    * Tests authentication flow through OAuth provider
    * Covers: initialization, redirect, token exchange, session
    * 
    * Prerequisites: OAuth test provider running
    * Flakiness: No known flaky tests
    */
   describe('OAuth Flow', () => {
     // tests...
   });
   ```

---

## Implementation Timeline & Resource Allocation

### Resources Required
- **QA Engineers:** 2-3 (full-time)
- **Developers:** 1 (part-time, for test infrastructure)
- **Test Infrastructure:** CI/CD pipeline, coverage tools
- **Timeline:** 8-10 weeks total

### Success Metrics
- [ ] Coverage increases from 93.2% to 95%+
- [ ] All critical paths at 100% coverage
- [ ] Zero flaky tests
- [ ] Test suite completes in <5 minutes
- [ ] Coverage gates enforced in CI/CD
- [ ] Monthly trend reports showing improvement

### Sign-Off & Approval
- [ ] QA Lead approval of plan
- [ ] Development team capacity confirmed
- [ ] Infrastructure readiness validated
- [ ] Stakeholder sign-off on timeline

---

**Document Status:** Ready for Implementation  
**Last Updated:** May 31, 2026  
**Next Review:** June 15, 2026 (End of Phase 1)  
**Target Completion:** July 31, 2026 (All 3 Phases)
