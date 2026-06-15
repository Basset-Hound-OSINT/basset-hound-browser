# P3 Bug Fixes Implementation Plan - Basset Hound Browser v12.0.0+

**Status:** DESIGN COMPLETE  
**Priority Level:** Medium (P3)  
**Total Estimated Effort:** 8 hours (2 hours per bug + testing + integration)  
**Target Completion:** 2 development sprints  
**Approved for:** Engineering Team Review & Execution

---

## Executive Summary

This document outlines the comprehensive implementation plan for fixing 4 medium-priority bugs in Basset Hound Browser that impact memory stability, session consistency, timeout reliability, and error observability. Each bug has been analyzed for root cause, provided with exact code fixes, comprehensive test strategies (10 tests per bug = 40 total), and verification approaches.

**Key Deliverables:**
- 4 bug fixes with production-quality code
- 40 comprehensive unit/integration tests (10 per bug)
- 0 regressions vs Phase 1-2 production code
- Full Phase 2 completion verification

---

## Bug Details & Implementation Strategy

### P3-001: Screenshot Memory Leaks in Phase 4 Robustness

**File:** `/src/extraction/screenshot-phase4-robustness.js`  
**Time Estimate:** 2 hours  
**Severity:** Medium - Memory accumulation over time  
**Impact:** Long-running screenshot operations cause memory pressure

#### Root Cause Analysis

The `ResilienceCoordinator` class has three memory leak vectors:

1. **Recovery Log Accumulation (Lines 626-640):** The `_logRecovery()` method appends to `this.recoveryLog` unbounded. While line 635-636 attempts bounding via array slice, this is an O(n) operation that causes memory churn. Under high-frequency recovery attempts (>100/sec), this becomes the dominant memory consumer.

2. **Stream Handle Leaks (Line 377):** `ErrorRecoveryManager.tryCompressionFallback()` creates a compressed stream handle via `streamer.createCompressedReadStream()` but never explicitly closes or releases it. Over 1000+ screenshot operations, these handles accumulate.

3. **Error Report Context Retention (Lines 428-437):** The `generateErrorReport()` method captures full error stack traces and context objects. Large context objects (DOM fragments, full request bodies) are retained indefinitely in the error object graph.

#### Exact Code Changes

**Change 1: Replace Array Slice with CircularBuffer (Line 500)**
```javascript
// BEFORE (Line 500):
this.recoveryLog = [];

// AFTER:
this.recoveryLog = new CircularBuffer(this.maxLogSize);

// Add CircularBuffer class (before ResilienceCoordinator):
class CircularBuffer {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.buffer = [];
    this.index = 0;
  }
  
  push(item) {
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(item);
    } else {
      this.buffer[this.index % this.maxSize] = item;
      this.index++;
    }
  }
  
  toArray() {
    return this.buffer;
  }
}
```

**Change 2: Add Try-Finally to executeWithResilience (Lines 543-546)**
```javascript
// BEFORE:
return {
  success: false,
  error: error.message,
  errorReport,
  executionTimeMs: Date.now() - startTime,
  suggestion: this.errorRecovery._getSuggestion(error, context)
};

// AFTER:
return {
  success: false,
  error: error.message,
  errorReport,
  executionTimeMs: Date.now() - startTime,
  suggestion: this.errorRecovery._getSuggestion(error, context)
};
// Cleanup happens in finally block (add to line 510)
```

**Change 3: Add Stream Cleanup in tryCompressionFallback (After Line 387)**
```javascript
// BEFORE (Lines 371-395):
async tryCompressionFallback(imageData) {
  try {
    if (!this.enableCompression) {
      return { success: false, error: 'compression_disabled' };
    }

    const handle = await this.streamer.createCompressedReadStream(imageData, {
      compressionLevel: 6
    });

    return {
      success: true,
      compressed: true,
      sessionId: handle.sessionId,
      originalSize: imageData.length,
      estimatedCompressedSize: Math.round(imageData.length * 0.3)
    };

// AFTER:
async tryCompressionFallback(imageData) {
  try {
    if (!this.enableCompression) {
      return { success: false, error: 'compression_disabled' };
    }

    const handle = await this.streamer.createCompressedReadStream(imageData, {
      compressionLevel: 6
    });

    const result = {
      success: true,
      compressed: true,
      sessionId: handle.sessionId,
      originalSize: imageData.length,
      estimatedCompressedSize: Math.round(imageData.length * 0.3)
    };

    // Schedule cleanup after stream is consumed
    setImmediate(() => {
      if (this.streamer && handle.sessionId) {
        this.streamer.closeStream?.(handle.sessionId);
      }
    });

    return result;
```

**Change 4: Bounded Error Report Object Pool (Lines 424-438)**
```javascript
// Add to constructor (line 326):
this.errorReportPool = [];
this.maxReportPoolSize = 50;

// BEFORE (Lines 424-438):
generateErrorReport(error, context = {}) {
  const report = {
    timestamp: new Date().toISOString(),
    error: error.message,
    type: this._classifyError(error),
    context,
    suggestion: this._getSuggestion(error, context)
  };

  if (error.stack) {
    report.stack = error.stack.split('\n').slice(0, 5);
  }

  return report;
}

// AFTER:
generateErrorReport(error, context = {}) {
  // Reuse pooled object if available
  let report = this.errorReportPool.pop() || {};
  
  report.timestamp = new Date().toISOString();
  report.error = error.message;
  report.type = this._classifyError(error);
  report.context = context;
  report.suggestion = this._getSuggestion(error, context);
  report.stack = error.stack ? error.stack.split('\n').slice(0, 5) : [];

  // Return to pool later via caller responsibility
  return report;
}

// Add pool cleanup method:
_returnReportToPool(report) {
  if (this.errorReportPool.length < this.maxReportPoolSize) {
    this.errorReportPool.push(report);
  }
}
```

**Change 5: Add Garbage Collection Trigger (Line 579)**
```javascript
// BEFORE (Line 579):
recoveryAction.status = 'failed_all_recovery';
this._logRecovery(recoveryAction);
return result;

// AFTER:
recoveryAction.status = 'failed_all_recovery';
this._logRecovery(recoveryAction);

// Trigger GC if memory pressure high
if (global.gc && process.memoryUsage().heapUsed > 100 * 1024 * 1024) {
  global.gc();
}

return result;
```

#### Test Strategy (10 Tests)

1. **Test: Recovery Log Size Bound**
   - Execute 1000 recovery cycles, verify `recoveryLog.length <= maxLogSize`
   - Assert CircularBuffer properly overwrites old entries
   - Time: Confirm < 50ms overhead

2. **Test: CircularBuffer Correct Behavior**
   - Push 10 items to buffer with maxSize=5
   - Verify toArray() returns last 5 items
   - Verify order is preserved with wrapping

3. **Test: Memory Growth < 5MB Over 10,000 Cycles**
   - Measure heap before/after 10,000 screenshot operations
   - Assert `(heapAfter - heapBefore) < 5 * 1024 * 1024`
   - Check memory returns to baseline after operations complete

4. **Test: Stream Handle Cleanup**
   - Track active streams before/after compression fallback
   - Mock streamer.closeStream() and verify called with correct sessionId
   - Assert no dangling handles remain

5. **Test: Error Report Pooling**
   - Generate 100 error reports with context
   - Verify pool size doesn't exceed maxReportPoolSize
   - Confirm reports are reused from pool

6. **Test: Mixed Success/Failure Recovery Sequences**
   - Execute alternating success/failure recovery cycles
   - Verify memory growth linear, not exponential
   - Confirm recovery log bounded throughout

7. **Test: Recovery Stats Don't Leak**
   - Call `getRecoveryStats()` 500 times
   - Verify heap doesn't grow after initial object creation
   - Check stats object is immutable/copy

8. **Test: Concurrent Recovery Operations**
   - Execute 50 parallel recovery operations
   - Verify log entries don't duplicate
   - Confirm thread-safe access to CircularBuffer

9. **Test: clearLog() Deallocates References**
   - Create large recovery log
   - Call clearLog()
   - Verify heap freed and all references nulled

10. **Test: Large Context Objects**
    - Pass 10MB context object to recovery
    - Verify truncated or rejected gracefully
    - Confirm no OOM errors

#### Verification Approach

**Automated Verification:**
```bash
# Memory profiling
node --expose-gc tests/p3-001-screenshot-memory-leak.test.js

# Expected output:
# ✓ Heap delta < 2MB over 1000 cycles
# ✓ CircularBuffer maintains max size
# ✓ Stream handles released properly
```

**Manual Verification:**
1. Take heap snapshot before screenshot stress test
2. Run 10,000 screenshots with recovery operations
3. Take heap snapshot after
4. Compare snapshots: expect < 2MB delta
5. Monitor active handles via DevTools

---

### P3-002: Session Coherence Edge Cases

**File:** `/src/evasion/session-coherence.js`  
**Time Estimate:** 2 hours  
**Severity:** Medium - Race conditions under specific patterns  
**Impact:** Legitimate state transitions incorrectly flagged as violations

#### Root Cause Analysis

The 5-layer validation has multiple edge case failures:

1. **Temporal Coherence False Positives (Lines 207-249):**
   - The similarity check (line 207) treats all component updates as violations if they differ > 2%
   - Legitimate updates (installed browser extensions, updated plugins) get flagged as suspicious
   - No exemption mechanism for intentional fingerprint changes

2. **Network Coherence Over-Flagging (Lines 386-397):**
   - Requests with variance < 100ms incorrectly labeled "robotic"
   - This threshold doesn't account for legitimate user behavior patterns
   - No confidence interval consideration

3. **Device Coherence Screen Rotation (Lines 452-468):**
   - Portrait→Landscape transitions (e.g., 1920x1080 → 1080x1920) incorrectly flagged
   - Variance calculation (lines 457-459) doesn't normalize for orientation
   - 15% threshold is too strict for legitimate rotations

4. **Impossible Combinations Outdated (Lines 545-580):**
   - Chrome on iOS doesn't exist (correct)
   - But Chrome on Chrome OS isn't recognized as valid
   - iPad with Firefox is flagged as impossible (but is valid)

5. **Race Condition in State Updates:**
   - No atomic state updates; concurrent modifications to session layers can cause inconsistency
   - `recordInteraction()` doesn't lock while updating multiple layer states

#### Exact Code Changes

**Change 1: Add Allowed Updates Configuration (Line 26)**
```javascript
// BEFORE (Line 26):
initializeSession(sessionId, initialData = {}) {
  const session = {

// AFTER:
initializeSession(sessionId, initialData = {}) {
  const session = {
    allowedComponentUpdates: initialData.allowedComponentUpdates || {
      canvas: false,
      webgl: false,
      audio: false,
      fonts: false,    // Allow font updates (plugin installations)
      screen: true,    // Always allow screen rotation
      navigator: false // Don't allow UA changes
    },
```

**Change 2: Skip Exempt Components in Temporal Validation (Lines 202-239)**
```javascript
// BEFORE (Lines 202-224):
for (const component of components) {
  if (!newFingerprint[component] || !lastRecord.fingerprint[component]) {
    continue;
  }

  const similarity = this.calculateSimilarity(
    lastRecord.fingerprint[component],
    newFingerprint[component]
  );

  scores.push(similarity);

  // Fingerprints shouldn't change much within 2 minutes
  if (timeDeltaMs < 120000 && similarity < 0.98) {
    violations.push({
      layer: 'temporal',
      component,
      severity: 'medium',
      reason: 'Fingerprint changed too quickly',
      timeDelta: timeDeltaMs,
      similarity
    });
  }

// AFTER:
for (const component of components) {
  if (!newFingerprint[component] || !lastRecord.fingerprint[component]) {
    continue;
  }

  // Skip exempt components
  if (session.allowedComponentUpdates && session.allowedComponentUpdates[component] === true) {
    scores.push(1.0); // Treat as perfect match
    continue;
  }

  const similarity = this.calculateSimilarity(
    lastRecord.fingerprint[component],
    newFingerprint[component]
  );

  scores.push(similarity);

  // Fingerprints shouldn't change much within 2 minutes
  if (timeDeltaMs < 120000 && similarity < 0.98) {
    violations.push({
      layer: 'temporal',
      component,
      severity: 'medium',
      reason: 'Fingerprint changed too quickly',
      timeDelta: timeDeltaMs,
      similarity
    });
  }
```

**Change 3: Network Variance with Confidence Interval (Lines 380-397)**
```javascript
// BEFORE (Lines 379-397):
const recentIntervals = session.layers.network.requests
  .slice(-5)
  .reduce((acc, req, idx, arr) => {
    if (idx > 0) acc.push(req.timestamp - arr[idx - 1].timestamp);
    return acc;
  }, []);

if (recentIntervals.length > 2) {
  const variance = this.calculateVariance(recentIntervals);
  if (variance < 100) {  // Intervals are too regular
    violations.push({
      layer: 'network',
      component: 'request_pattern',
      severity: 'low',
      reason: 'Request timing too regular (robotic)',
      variance
    });
  }
}

// AFTER:
const recentIntervals = session.layers.network.requests
  .slice(-5)
  .reduce((acc, req, idx, arr) => {
    if (idx > 0) acc.push(req.timestamp - arr[idx - 1].timestamp);
    return acc;
  }, []);

if (recentIntervals.length > 2) {
  const variance = this.calculateVariance(recentIntervals);
  const mean = recentIntervals.reduce((a, b) => a + b) / recentIntervals.length;
  
  // Calculate coefficient of variation (normalized variance)
  const coefficientOfVariation = variance / (mean * mean);
  
  // Human-like behavior has CV > 0.15 (15% variance)
  // Robotic patterns have CV < 0.05
  if (coefficientOfVariation < 0.05) {
    violations.push({
      layer: 'network',
      component: 'request_pattern',
      severity: 'low',
      reason: 'Request timing too regular (robotic)',
      variance,
      coefficientOfVariation
    });
  }
}
```

**Change 4: Screen Orientation Normalization (Lines 452-468)**
```javascript
// BEFORE (Lines 452-468):
// Screen resolution shouldn't change (except orientation)
if (deviceData.screenWidth && session.layers.device.initialDevice.screenWidth) {
  const area = deviceData.screenWidth * (deviceData.screenHeight || 1);
  const initialArea = session.layers.device.initialDevice.screenWidth *
                    (session.layers.device.initialDevice.screenHeight || 1);

  // Allow 5% variance for orientation changes
  const variance = Math.abs(area - initialArea) / initialArea;
  if (variance > 0.15) {
    violations.push({
      layer: 'device',
      component: 'screen_resolution',
      severity: 'high',
      reason: 'Screen resolution changed significantly',
      variance
    });
  }
}

// AFTER:
// Screen resolution shouldn't change (except orientation)
if (deviceData.screenWidth && session.layers.device.initialDevice.screenWidth) {
  // Normalize for orientation: sort dimensions to compare actual resolution
  const currentDims = [deviceData.screenWidth, deviceData.screenHeight || 1].sort((a, b) => a - b);
  const initialDims = [
    session.layers.device.initialDevice.screenWidth,
    session.layers.device.initialDevice.screenHeight || 1
  ].sort((a, b) => a - b);

  // Check if dimensions match (ignoring rotation)
  const dimMatch = currentDims[0] === initialDims[0] && currentDims[1] === initialDims[1];
  
  if (!dimMatch) {
    // Only flag if actual resolution changed, not just rotated
    const area = deviceData.screenWidth * (deviceData.screenHeight || 1);
    const initialArea = session.layers.device.initialDevice.screenWidth *
                      (session.layers.device.initialDevice.screenHeight || 1);

    const variance = Math.abs(area - initialArea) / initialArea;
    if (variance > 0.15) {
      violations.push({
        layer: 'device',
        component: 'screen_resolution',
        severity: 'high',
        reason: 'Screen resolution changed significantly',
        variance
      });
    }
  }
}
```

**Change 5: Update Impossible Combinations (Lines 545-580)**
```javascript
// BEFORE (Lines 543-580):
detectImpossibleCombinations(deviceData) {
  const violations = [];

  // iOS devices don't run Chrome
  if (deviceData.os === 'iOS' && deviceData.browser === 'Chrome') {
    violations.push({
      layer: 'device',
      component: 'impossibility',
      severity: 'critical',
      reason: 'Impossible combination: iOS + Chrome'
    });
  }

  // Android tablets typically don't run Safari
  if (deviceData.os === 'Android' &&
      deviceData.browser === 'Safari' &&
      deviceData.deviceType === 'tablet') {
    violations.push({
      layer: 'device',
      component: 'impossibility',
      severity: 'high',
      reason: 'Unlikely combination: Android tablet + Safari'
    });
  }

  // iPads run Safari by default
  if (deviceData.model && deviceData.model.includes('iPad') &&
      deviceData.browser && deviceData.browser !== 'Safari') {
    violations.push({
      layer: 'device',
      component: 'impossibility',
      severity: 'high',
      reason: 'Suspicious: iPad with non-Safari browser'
    });
  }

  return violations;
}

// AFTER:
detectImpossibleCombinations(deviceData) {
  const violations = [];

  // iOS devices don't run Chrome (but can run Firefox, Edge)
  if (deviceData.os === 'iOS' && deviceData.browser === 'Chrome') {
    violations.push({
      layer: 'device',
      component: 'impossibility',
      severity: 'critical',
      reason: 'Impossible combination: iOS + Chrome'
    });
  }

  // Android tablets typically don't run Safari
  if (deviceData.os === 'Android' &&
      deviceData.browser === 'Safari' &&
      deviceData.deviceType === 'tablet') {
    violations.push({
      layer: 'device',
      component: 'impossibility',
      severity: 'high',
      reason: 'Unlikely combination: Android tablet + Safari'
    });
  }

  // iPads can run multiple browsers now (Safari, Chrome, Firefox)
  // Don't flag non-Safari browsers on iPad as impossible
  
  // Chrome OS can only run Chrome/Chromium-based browsers
  if (deviceData.os === 'Chrome OS' && 
      deviceData.browser !== 'Chrome' && 
      !['Chromium', 'Edge'].includes(deviceData.browser)) {
    violations.push({
      layer: 'device',
      component: 'impossibility',
      severity: 'high',
      reason: 'Unlikely combination: Chrome OS with non-Chromium browser'
    });
  }

  return violations;
}
```

**Change 6: Add Atomic State Updates with Locking (Line 87)**
```javascript
// BEFORE (Line 87):
recordInteraction(sessionId, interactionData) {
  const session = this.sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

// AFTER:
recordInteraction(sessionId, interactionData) {
  const session = this.sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Simple locking mechanism to prevent race conditions
  if (session._locked) {
    // Retry with exponential backoff
    return new Promise(resolve => {
      const attemptLock = () => {
        if (!session._locked) {
          session._locked = true;
          resolve(this._recordInteractionAtomic(sessionId, interactionData, session));
        } else {
          setTimeout(attemptLock, Math.random() * 10);
        }
      };
      attemptLock();
    });
  }

  session._locked = true;
  try {
    return this._recordInteractionAtomic(sessionId, interactionData, session);
  } finally {
    session._locked = false;
  }
}

// Rename original logic to _recordInteractionAtomic
_recordInteractionAtomic(sessionId, interactionData, session) {
  // All original recordInteraction logic moved here
  const timestamp = Date.now();
  // ... rest of original code
}
```

#### Test Strategy (10 Tests)

1. **Test: Exempted Components Don't Trigger Violations**
   - Create session with fonts marked as `allowedComponentUpdates: { fonts: true }`
   - Update fonts component by 50%
   - Assert no temporal violations recorded

2. **Test: Legitimate Minor Browser Updates Pass**
   - Create baseline with browser v100.0.1
   - Update to v100.0.2 (patch bump)
   - Assert temporal coherence score > 0.90

3. **Test: Network Variance Thresholds**
   - Create request pattern with coefficient of variation 0.08 (slightly robotic)
   - Assert violation flagged
   - Create pattern with CV 0.20 (human-like)
   - Assert no violation

4. **Test: Screen Rotation Detection**
   - Start with resolution 1920x1080 (landscape)
   - Rotate to 1080x1920 (portrait)
   - Assert no screen resolution violations
   - Assert screen rotation is detected as legitimate

5. **Test: Chrome OS + Chrome Combination**
   - Create device data: { os: 'Chrome OS', browser: 'Chrome' }
   - Assert no impossibility violations

6. **Test: iPad with Firefox**
   - Create device data: { model: 'iPad Pro', browser: 'Firefox' }
   - Assert no impossibility violations (removed old check)

7. **Test: Large Session with 50+ Requests**
   - Record 50 network interactions with natural variance
   - Assert overall coherence score > 0.90
   - Verify no false positives on network patterns

8. **Test: Behavioral Patterns with 20% Deviation**
   - Record typing speeds: [100, 110, 95, 105, 120] (20% max variance)
   - Assert behavioral coherence passes

9. **Test: Concurrent State Updates (Race Condition)**
   - Spawn 10 concurrent recordInteraction() calls
   - Assert all complete without inconsistency
   - Verify session state remains coherent

10. **Test: Coherence Recovery After Legitimate Changes**
    - Create violations via legitimate updates
    - Call `calculateOverallCoherence()`
    - Assert score > 0.85 after exemptions applied

#### Verification Approach

**Automated Verification:**
```bash
node tests/p3-002-session-coherence.test.js

# Expected output:
# ✓ Screen rotation handled correctly
# ✓ Network variance thresholds accurate
# ✓ Concurrent updates don't cause race conditions
# ✓ Overall coherence > 0.90 for legitimate sessions
```

**Manual Verification:**
1. Create test session with Chrome OS device
2. Record interactions with legitimate state changes
3. Verify `calculateOverallCoherence()` > 0.90
4. Check violation log for false positives

---

### P3-003: Timeout Handler Cleanup Failures

**File:** `/src/resilience/timeout-protection.js`  
**Time Estimate:** 2 hours  
**Severity:** Medium - Dangling timers cause memory/resource exhaustion  
**Impact:** Long-running processes accumulate timeout handlers, eventual system hangs

#### Root Cause Analysis

The timeout implementation has critical cleanup failures:

1. **Promise Resolution Race (Lines 63-77):**
   - The `withTimeout()` method uses `Promise.race()` with a timeout promise
   - The `clearTimeout()` calls (lines 73-74) only fire AFTER the promise settles
   - If the original promise never resolves (deadlock), timeout handler remains indefinitely
   - Under high concurrency (1000+ operations), handlers accumulate faster than cleanup

2. **ActiveTasks Accumulation (Line 46, 221-223):**
   - Tasks are added to `activeTasks` Map when created (line 206)
   - Cleanup in `.finally()` (line 221) only fires if promise ever settles
   - Abandoned promises (e.g., hung operations) leave entries in Map forever
   - No mechanism to detect and clean up overdue tasks

3. **Retry Loop Timeout Leak (Lines 112-115):**
   - Each retry in `executeWithFallback()` creates a new timeout handler via `withTimeout()`
   - Previous timeout handlers aren't cancelled when retrying
   - After 3 retries with no cancellation, 3x timeout handlers remain pending

4. **No AbortController Usage:**
   - Modern Node.js supports AbortController for cancellation
   - Current implementation uses old `setTimeout` + manual tracking
   - No way to cancel a timeout once created (except by promise resolution)

5. **Finally Block Not Guaranteed:**
   - `.finally()` on line 221 assumes promise eventually settles
   - Hung promises don't trigger finally block
   - Emergency cleanup mechanism missing

#### Exact Code Changes

**Change 1: Replace setTimeout with AbortController (Lines 36-77)**
```javascript
// ADD NEW CLASS before TimeoutProtection:
class CancellableTimeout {
  constructor(fn, delayMs) {
    this.controller = new AbortController();
    this.timeoutId = null;
    this.cancelled = false;

    this.promise = new Promise((resolve, reject) => {
      this.timeoutId = setTimeout(() => {
        if (!this.cancelled) {
          reject(new Error('timeout'));
        }
      }, delayMs);
    });

    // Signal cancellation immediately to controller
    this.controller.signal.addEventListener('abort', () => {
      this.cancelled = true;
      if (this.timeoutId) clearTimeout(this.timeoutId);
    });
  }

  cancel() {
    this.controller.abort();
  }

  get isActive() {
    return !this.cancelled;
  }
}

// BEFORE (Lines 56-77):
async withTimeout(promise, timeoutMs, operationName = 'Operation') {
  // Validate timeout
  const timeout = Math.min(
    timeoutMs || DEFAULT_TIMEOUTS.defaultMax,
    this.maxTimeout
  );

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        this.logger.warn(`[Timeout] ${operationName} exceeded ${timeout}ms`);
        reject(new TimeoutError(operationName, timeout));
      }, timeout);

      // Clean up timeout on promise resolution
      promise
        .then(() => clearTimeout(timeoutId))
        .catch(() => clearTimeout(timeoutId));
    })
  ]);
}

// AFTER:
async withTimeout(promise, timeoutMs, operationName = 'Operation') {
  const timeout = Math.min(
    timeoutMs || DEFAULT_TIMEOUTS.defaultMax,
    this.maxTimeout
  );

  const cancellableTimeout = new CancellableTimeout(null, timeout);
  const timeoutPromise = cancellableTimeout.promise;

  // Make timeout message available
  timeoutPromise.catch(err => {
    if (err.message === 'timeout') {
      this.logger.warn(`[Timeout] ${operationName} exceeded ${timeout}ms`);
    }
  });

  try {
    return await Promise.race([
      promise,
      timeoutPromise.then(() => {
        throw new TimeoutError(operationName, timeout);
      })
    ]);
  } finally {
    // ALWAYS cancel timeout, even if promise resolves
    cancellableTimeout.cancel();
  }
}
```

**Change 2: Add Timeout Reference Tracking (Lines 46-47)**
```javascript
// BEFORE (Line 46):
this.activeTasks = new Map();  // Track active operations

// AFTER:
this.activeTasks = new Map();  // Track active operations
this.activeTimeouts = new Map();  // Track timeout handlers for cleanup
this.timeoutCleanupInterval = null;
this._startTimeoutCleanupWatcher();
```

**Change 3: Add Cleanup Watcher for Overdue Tasks (After Line 256)**
```javascript
// ADD NEW METHOD:
_startTimeoutCleanupWatcher() {
  // Check for overdue tasks every 30 seconds
  this.timeoutCleanupInterval = setInterval(() => {
    const now = Date.now();
    const overdue = [];

    for (const [taskId, task] of this.activeTasks.entries()) {
      const elapsed = now - task.startTime;
      // If task is > 5 seconds overdue and not resolved, emergency cleanup
      if (elapsed > (task.timeoutMs + 5000) && !task.resolved) {
        overdue.push(taskId);
      }
    }

    for (const taskId of overdue) {
      this.logger.warn(`[TimeoutCleanup] Emergency cleanup for overdue task: ${taskId}`);
      this.cancelTask(taskId);
    }
  }, 30000);
}

_stopTimeoutCleanupWatcher() {
  if (this.timeoutCleanupInterval) {
    clearInterval(this.timeoutCleanupInterval);
    this.timeoutCleanupInterval = null;
  }
}
```

**Change 4: Cancel Prior Timeouts on Retry (Lines 112-115)**
```javascript
// BEFORE (Lines 95-119):
let lastError = null;

for (let attempt = 1; attempt <= retries + 1; attempt++) {
  try {
    const result = await this.withTimeout(
      fn(),
      timeoutMs,
      `${operationName} (attempt ${attempt})`
    );
    return result;
  } catch (error) {
    lastError = error;

    if (error instanceof TimeoutError) {
      this.logger.warn(
        `[Timeout] ${operationName} timed out on attempt ${attempt}/${retries + 1}`
      );

      if (attempt <= retries) {
        // Exponential backoff on retry
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    } else {
      throw error;  // Non-timeout errors aren't retried
    }
  }
}

// AFTER:
let lastError = null;
const taskId = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

for (let attempt = 1; attempt <= retries + 1; attempt++) {
  try {
    const result = await this.trackTask(
      `${taskId}_attempt_${attempt}`,
      fn(),
      timeoutMs
    );
    return result;
  } catch (error) {
    lastError = error;

    // ALWAYS cleanup this attempt's task
    this.cancelTask(`${taskId}_attempt_${attempt}`);

    if (error instanceof TimeoutError) {
      this.logger.warn(
        `[Timeout] ${operationName} timed out on attempt ${attempt}/${retries + 1}`
      );

      if (attempt <= retries) {
        // Exponential backoff on retry
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    } else {
      throw error;  // Non-timeout errors aren't retried
    }
  }
}
```

**Change 5: Enhanced trackTask with Guaranteed Cleanup (Lines 203-224)**
```javascript
// BEFORE (Lines 203-224):
trackTask(taskId, promise, timeoutMs = DEFAULT_TIMEOUTS.defaultMax) {
  const startTime = Date.now();

  this.activeTasks.set(taskId, {
    startTime,
    timeoutMs,
    resolved: false
  });

  return this.withTimeout(promise, timeoutMs, `Task: ${taskId}`)
    .then(result => {
      const task = this.activeTasks.get(taskId);
      if (task) {
        task.resolved = true;
        task.duration = Date.now() - startTime;
      }
      return result;
    })
    .finally(() => {
      this.activeTasks.delete(taskId);
    });
}

// AFTER:
trackTask(taskId, promise, timeoutMs = DEFAULT_TIMEOUTS.defaultMax) {
  const startTime = Date.now();

  this.activeTasks.set(taskId, {
    startTime,
    timeoutMs,
    resolved: false,
    cleanup: null
  });

  // Wrap promise with guaranteed cleanup
  const wrappedPromise = (async () => {
    try {
      return await this.withTimeout(promise, timeoutMs, `Task: ${taskId}`);
    } finally {
      // Mark as resolved BEFORE deleting
      const task = this.activeTasks.get(taskId);
      if (task) {
        task.resolved = true;
        task.duration = Date.now() - startTime;
      }
    }
  })();

  // Return wrapped promise that cleans up on settle
  return wrappedPromise
    .finally(() => {
      // Emergency cleanup if still present
      const task = this.activeTasks.get(taskId);
      if (task?.cleanup) {
        task.cleanup();
      }
      this.activeTasks.delete(taskId);
    });
}
```

**Change 6: Add Destructor for Cleanup (After Line 281)**
```javascript
// ADD NEW METHOD:
destroy() {
  // Cancel all active tasks
  for (const [taskId, task] of this.activeTasks.entries()) {
    if (task.cleanup) {
      task.cleanup();
    }
  }
  this.activeTasks.clear();
  
  // Stop cleanup watcher
  this._stopTimeoutCleanupWatcher();
  
  // Clear all references
  this.activeTimeouts.clear();
  this.logger = null;
}
```

#### Test Strategy (10 Tests)

1. **Test: Timeout Fires and Cleans Up**
   - Create promise that never resolves
   - Wrap with withTimeout(500ms)
   - Assert TimeoutError thrown
   - Assert timeout handler removed

2. **Test: ActiveTasks Map Decreases After Task Completes**
   - Track activeTasks size before/after
   - Execute 100 tasks that resolve immediately
   - Assert size returns to 0

3. **Test: Retries Don't Accumulate Handlers**
   - Execute with retries=3
   - Each attempt times out
   - Assert only 1 timeout handler active at a time

4. **Test: Abandoned Promises Don't Hold References**
   - Create promise that never resolves
   - Don't await it (abandon)
   - Wait 35 seconds for emergency cleanup
   - Assert task removed from activeTasks

5. **Test: Emergency Cleanup for Overdue Tasks**
   - Create task that exceeds timeout + 5s
   - Wait for cleanup watcher interval
   - Assert task removed and logged

6. **Test: GetActiveTasks Accurate Remaining Time**
   - Start 5-second timeout
   - Check remaining after 2 seconds
   - Assert remaining ~3000ms

7. **Test: CancelTask Immediately Removes Entry**
   - Add task to activeTasks
   - Call cancelTask()
   - Assert not in Map anymore

8. **Test: 1000+ Concurrent Timeouts**
   - Spawn 1000 concurrent operations with timeouts
   - Let them complete normally
   - Assert activeTasks empty, < 1MB overhead

9. **Test: Mixed Resolve/Reject Scenarios**
   - 500 operations resolve successfully
   - 500 operations timeout
   - Assert all cleaned up

10. **Test: No Dangling Timers After Destroy**
    - Create 100 active timeouts
    - Call destroy()
    - Assert no setInterval/setTimeout pending

#### Verification Approach

**Automated Verification:**
```bash
node --expose-gc tests/p3-003-timeout-cleanup.test.js

# Expected output:
# ✓ All timeout handlers cleaned up
# ✓ activeTasks Map empty after operations
# ✓ No dangling setTimeout/setInterval
# ✓ Emergency cleanup triggers correctly
```

**Manual Verification with Heap Inspection:**
```javascript
const pt = new TimeoutProtection();

// Before stress test
const heapBefore = process.memoryUsage().heapUsed;

// Stress test: 10,000 concurrent timeouts
for (let i = 0; i < 10000; i++) {
  pt.withTimeout(
    new Promise(resolve => setTimeout(resolve, 100)),
    500,
    `test-${i}`
  );
}

// After completion
global.gc();
const heapAfter = process.memoryUsage().heapUsed;

console.log(`Heap delta: ${(heapAfter - heapBefore) / 1024 / 1024}MB (expect < 5MB)`);
console.log(`Active tasks: ${pt.activeTasks.size} (expect 0)`);
```

---

### P3-004: Error Logging Context Loss

**File:** `/src/observability/error-tracer.js`  
**Time Estimate:** 2-3 hours  
**Severity:** Medium - Error analysis and debugging becomes difficult  
**Impact:** Large context objects cause unbounded memory growth; slow error queries

#### Root Cause Analysis

The error tracing system lacks proper bounds and indexing:

1. **Unbounded Context Storage (Lines 51-72):**
   - `traceError()` stores entire context objects without size validation
   - Large objects (10MB+ DOM trees, full request bodies) stored as-is
   - No serialization check or circular reference detection
   - Under high-error scenarios, heap can grow GB+

2. **Unindexed Error Search (Lines 249-306):**
   - `findRelatedErrors()` performs O(n) scan over all errors
   - With 10K+ errors, this becomes O(n²) when called in loops
   - No index by errorType, component, or severity
   - Calls to `getErrorMetrics()` on large error sets timeout

3. **Unbounded Error Pattern Collections (Lines 452-453):**
   - `affectedSpans` and `affectedComponents` are Set objects with no size limits
   - Under high-frequency errors, these accumulate 1000s of entries
   - No deduplication or aging mechanism

4. **Recovery Attempt Array Accumulation (Line 161):**
   - Each error stores all retry attempts in array
   - Failed operations with 3+ retries create 3+ attempt objects
   - No maximum on array size; grows indefinitely

5. **Stack Trace Retention (Line 67):**
   - Full stack traces captured without depth limits
   - Large stack traces (100+ frames) stored in every error
   - Stack frame objects hold references to variables (closure capture)

#### Exact Code Changes

**Change 1: Add Context Size Validation (Lines 51-72)**
```javascript
// ADD CONSTANTS before ErrorTracer class:
const MAX_CONTEXT_SIZE = 1024 * 1024; // 1MB max per error
const MAX_STACK_DEPTH = 15;
const MAX_RECOVERY_ATTEMPTS = 10;

// BEFORE (Lines 51-72):
const error = {
  // ... fields ...
  context: {
    spanContext: errorData.spanContext || {},
    userContext: errorData.userContext || {},
    systemContext: errorData.systemContext || {},
    debugInfo: errorData.debugInfo || {}
  },

// AFTER:
const error = {
  // ... fields ...
  context: this._validateAndSanitizeContext({
    spanContext: errorData.spanContext || {},
    userContext: errorData.userContext || {},
    systemContext: errorData.systemContext || {},
    debugInfo: errorData.debugInfo || {}
  }),
```

**Change 2: Add Context Validation Method (After constructor)**
```javascript
_validateAndSanitizeContext(contextData) {
  try {
    // Serialize to JSON to check size and detect circular refs
    const serialized = JSON.stringify(contextData, (key, value) => {
      // Limit string values to 10KB each
      if (typeof value === 'string' && value.length > 10000) {
        return `[TRUNCATED: ${value.length} chars]`;
      }
      return value;
    });

    // Check total size
    if (serialized.length > MAX_CONTEXT_SIZE) {
      this.logger?.warn(
        `[ErrorTracer] Context exceeds max size ${MAX_CONTEXT_SIZE}, truncating`
      );
      
      // Return truncated context
      return {
        spanContext: contextData.spanContext || {},
        userContext: { _truncated: true, size: serialized.length },
        systemContext: contextData.systemContext || {},
        debugInfo: { _truncated: true }
      };
    }

    return contextData;
  } catch (err) {
    // Handle circular references or serialization errors
    return {
      spanContext: {},
      userContext: { _error: err.message },
      systemContext: {},
      debugInfo: { _serialization_failed: true }
    };
  }
}
```

**Change 3: Add Error Indexing (Line 34)**
```javascript
// BEFORE (Line 34):
this.errors = new Map();

// AFTER:
this.errors = new Map();
this.errorIndexes = {
  byType: new Map(),        // errorType -> Set of errorIds
  byComponent: new Map(),   // component -> Set of errorIds
  bySeverity: new Map(),    // severity -> Set of errorIds
  bySpan: new Map()         // spanId -> Set of errorIds
};
```

**Change 4: Update Indexes on Error Trace (After line 96)**
```javascript
// AFTER LINE 96 (after this.errors.set(error.errorId, error)):
// Update all indexes
this._updateErrorIndexes(error);

// ADD NEW METHOD:
_updateErrorIndexes(error) {
  // Index by type
  if (!this.errorIndexes.byType.has(error.errorType)) {
    this.errorIndexes.byType.set(error.errorType, new Set());
  }
  this.errorIndexes.byType.get(error.errorType).add(error.errorId);

  // Index by component
  if (error.component) {
    if (!this.errorIndexes.byComponent.has(error.component)) {
      this.errorIndexes.byComponent.set(error.component, new Set());
    }
    this.errorIndexes.byComponent.get(error.component).add(error.errorId);
  }

  // Index by severity
  if (!this.errorIndexes.bySeverity.has(error.severity)) {
    this.errorIndexes.bySeverity.set(error.severity, new Set());
  }
  this.errorIndexes.bySeverity.get(error.severity).add(error.errorId);

  // Index by span
  if (error.spanId) {
    if (!this.errorIndexes.bySpan.has(error.spanId)) {
      this.errorIndexes.bySpan.set(error.spanId, new Set());
    }
    this.errorIndexes.bySpan.get(error.spanId).add(error.errorId);
  }
}
```

**Change 5: Rewrite findRelatedErrors Using Indexes (Lines 249-306)**
```javascript
// BEFORE (Lines 249-306):
findRelatedErrors(errorData) {
  const relatedErrors = [];
  const criteria = {
    errorType: errorData.errorType || null,
    errorCode: errorData.errorCode || null,
    component: errorData.component || null,
    severity: errorData.severity || null,
    timeWindow: errorData.timeWindow || 300000 // 5 minutes
  };

  const now = Date.now();

  for (const [errorId, error] of this.errors) {
    let matches = 0;
    let totalCriteria = 0;

    if (criteria.errorType) {
      totalCriteria++;
      if (error.errorType === criteria.errorType) matches++;
    }

    if (criteria.errorCode) {
      totalCriteria++;
      if (error.errorCode === criteria.errorCode) matches++;
    }

    if (criteria.component) {
      totalCriteria++;
      if (error.component === criteria.component) matches++;
    }

    if (criteria.severity) {
      totalCriteria++;
      if (error.severity === criteria.severity) matches++;
    }

    if (criteria.timeWindow && (now - error.timestamp) < criteria.timeWindow) {
      matches++;
      totalCriteria++;
    }

    if (totalCriteria > 0 && matches / totalCriteria >= 0.5) {
      relatedErrors.push({
        errorId,
        matchScore: matches / totalCriteria,
        error: {
          errorType: error.errorType,
          errorMessage: error.errorMessage,
          timestamp: error.timestamp,
          component: error.component
        }
      });
    }
  }

  relatedErrors.sort((a, b) => b.matchScore - a.matchScore);
  return relatedErrors;
}

// AFTER:
findRelatedErrors(errorData) {
  const criteria = {
    errorType: errorData.errorType || null,
    errorCode: errorData.errorCode || null,
    component: errorData.component || null,
    severity: errorData.severity || null,
    timeWindow: errorData.timeWindow || 300000 // 5 minutes
  };

  const now = Date.now();
  const candidateIds = new Set();

  // Use indexes for fast lookup
  if (criteria.errorType && this.errorIndexes.byType.has(criteria.errorType)) {
    const typeIds = this.errorIndexes.byType.get(criteria.errorType);
    for (const id of typeIds) candidateIds.add(id);
  } else if (criteria.errorType) {
    return []; // Fast return if type not found
  } else {
    // No type filter, use all
    for (const errorId of this.errors.keys()) candidateIds.add(errorId);
  }

  // Filter by other criteria
  const relatedErrors = [];
  for (const errorId of candidateIds) {
    const error = this.errors.get(errorId);
    if (!error) continue;

    // Quick time window filter
    if (now - error.timestamp > criteria.timeWindow) continue;

    // Check other criteria
    let matches = 1; // Already matched errorType
    let totalCriteria = 1;

    if (criteria.component) {
      totalCriteria++;
      if (error.component === criteria.component) matches++;
    }

    if (criteria.severity) {
      totalCriteria++;
      if (error.severity === criteria.severity) matches++;
    }

    if (matches / totalCriteria >= 0.5) {
      relatedErrors.push({
        errorId,
        matchScore: matches / totalCriteria,
        error: {
          errorType: error.errorType,
          errorMessage: error.errorMessage,
          timestamp: error.timestamp,
          component: error.component
        }
      });
    }
  }

  relatedErrors.sort((a, b) => b.matchScore - a.matchScore);
  return relatedErrors;
}
```

**Change 6: Bound Recovery Attempts (Line 161)**
```javascript
// BEFORE (Line 161):
if (!error.recoveryAttempts) {
  error.recoveryAttempts = [];
}
error.recoveryAttempts.push(attempt);

// AFTER:
if (!error.recoveryAttempts) {
  error.recoveryAttempts = [];
}
error.recoveryAttempts.push(attempt);

// Keep only last MAX_RECOVERY_ATTEMPTS
if (error.recoveryAttempts.length > MAX_RECOVERY_ATTEMPTS) {
  error.recoveryAttempts.shift(); // Remove oldest
}
```

**Change 7: Bound Error Pattern Collections (Lines 452-453)**
```javascript
// BEFORE (Line 452):
const pattern = {
  patternId,
  errorType: error.errorType,
  occurrences: recentErrors.length,
  timeSpan: recentErrors[0].timestamp - recentErrors[recentErrors.length - 1].timestamp,
  affectedSpans: new Set(recentErrors.map(e => e.spanId)),
  affectedComponents: new Set(recentErrors.map(e => e.component).filter(c => c)),
  severity: error.severity,

// AFTER:
const pattern = {
  patternId,
  errorType: error.errorType,
  occurrences: recentErrors.length,
  timeSpan: recentErrors[0].timestamp - recentErrors[recentErrors.length - 1].timestamp,
  affectedSpans: new Set(
    recentErrors
      .map(e => e.spanId)
      .slice(0, 100)  // Limit to 100 spans
  ),
  affectedComponents: new Set(
    recentErrors
      .map(e => e.component)
      .filter(c => c)
      .slice(0, 100)  // Limit to 100 components
  ),
  severity: error.severity,
```

**Change 8: Add Stack Trace Depth Limit to traceError (Line 67)**
```javascript
// BEFORE (Line 67):
stackTrace: errorData.stackTrace || this._captureStackTrace(new Error()),

// AFTER:
stackTrace: this._limitStackTrace(
  errorData.stackTrace || this._captureStackTrace(new Error())
),

// ADD NEW METHOD:
_limitStackTrace(stackTrace) {
  if (Array.isArray(stackTrace)) {
    return stackTrace.slice(0, MAX_STACK_DEPTH);
  }
  if (typeof stackTrace === 'string') {
    const lines = stackTrace.split('\n');
    return lines.slice(0, MAX_STACK_DEPTH).join('\n');
  }
  return stackTrace;
}
```

**Change 9: Add Cleanup on close() (Lines 515-523)**
```javascript
// BEFORE (Lines 515-523):
close() {
  this.errors.clear();
  this.errorTrees.clear();
  this.errorPatterns.clear();
  this.errorChains.clear();
  this.stackTraces.clear();
  this.errorCausalityGraph.clear();
  this.emit('system:closed');
}

// AFTER:
close() {
  this.errors.clear();
  this.errorTrees.clear();
  this.errorPatterns.clear();
  this.errorChains.clear();
  this.stackTraces.clear();
  this.errorCausalityGraph.clear();
  
  // Clear indexes
  for (const [key, set] of this.errorIndexes.byType) {
    set.clear();
  }
  for (const [key, set] of this.errorIndexes.byComponent) {
    set.clear();
  }
  for (const [key, set] of this.errorIndexes.bySeverity) {
    set.clear();
  }
  for (const [key, set] of this.errorIndexes.bySpan) {
    set.clear();
  }
  
  this.errorIndexes.byType.clear();
  this.errorIndexes.byComponent.clear();
  this.errorIndexes.bySeverity.clear();
  this.errorIndexes.bySpan.clear();
  
  this.emit('system:closed');
}
```

#### Test Strategy (10 Tests)

1. **Test: Large Context Objects Rejected**
   - Create 10MB context object
   - Call traceError() with it
   - Assert context truncated or context._truncated = true
   - Verify no OOM error

2. **Test: Circular References Handled**
   - Create circular object: `{ a: { b: null } }; obj.a.b = obj;`
   - Call traceError() with it
   - Assert no stack overflow
   - Check context stored safely

3. **Test: Stack Trace Depth Limited**
   - Create error with 100-frame stack
   - Trace it
   - Assert stackTrace length <= MAX_STACK_DEPTH (15)

4. **Test: Recovery Attempt Array Bounded**
   - Record 15 recovery attempts on single error
   - Assert recoveryAttempts.length <= MAX_RECOVERY_ATTEMPTS (10)
   - Verify oldest attempts evicted

5. **Test: Error Search O(1) Performance**
   - Create 10,000 errors
   - Call findRelatedErrors() by errorType
   - Assert completes in < 10ms (vs O(n) = 10,000+ ms)

6. **Test: Error Pattern Sets Bounded**
   - Create error pattern matching 1000 spans
   - Assert affectedSpans.size <= 100
   - Verify no memory explosion

7. **Test: GetErrorMetrics Efficient on Large Set**
   - Create 10,000 errors
   - Call getErrorMetrics()
   - Assert completes in < 100ms

8. **Test: Error Timeline Grouping Without Memory Explosion**
   - Create 5000 errors spread over 24 hours
   - Call getErrorTimeline({ groupBy: 'hour' })
   - Verify < 1MB memory for result

9. **Test: Indexes Properly Updated**
   - Create 100 errors
   - Verify errorIndexes.byType has all types
   - Verify errorIndexes.byComponent has all components
   - Call findRelatedErrors() and verify uses indexes

10. **Test: Close() Cleanup**
    - Create 10,000 errors and patterns
    - Call close()
    - Verify all Maps and Sets cleared
    - Confirm heap freed

#### Verification Approach

**Automated Verification:**
```bash
node tests/p3-004-error-context.test.js

# Expected output:
# ✓ Context size validation working
# ✓ Circular reference detection working
# ✓ Error search O(1) performance
# ✓ Memory usage < 5MB with 10K errors
```

**Manual Verification with Real Error Load:**
```javascript
const ErrorTracer = require('./src/observability/error-tracer');
const tracer = new ErrorTracer();

// Simulate error spike
const heapBefore = process.memoryUsage().heapUsed;

for (let i = 0; i < 10000; i++) {
  tracer.traceError(`span-${i}`, {
    errorType: 'TestError',
    errorMessage: `Error ${i}`,
    component: `component-${i % 10}`,
    severity: ['error', 'warning', 'critical'][i % 3],
    context: {
      userContext: { userId: `user-${i}`, sessionId: `session-${i}` },
      debugInfo: { requestId: `req-${i}` }
    }
  });
}

global.gc();
const heapAfter = process.memoryUsage().heapUsed;
const heapDelta = (heapAfter - heapBefore) / 1024 / 1024;

console.log(`Heap delta: ${heapDelta.toFixed(2)}MB (expect < 10MB)`);
console.log(`Errors stored: ${tracer.errors.size}`);

// Test search performance
const start = Date.now();
const related = tracer.findRelatedErrors({ errorType: 'TestError' });
const elapsed = Date.now() - start;

console.log(`Search time: ${elapsed}ms (expect < 10ms)`);
console.log(`Results: ${related.length}`);
```

---

## Implementation Schedule

### Phase 1: Memory & Cleanup (Days 1-2)
- **Monday (4 hours):** Implement P3-001 and P3-003 fixes
  - Screenshot memory leak: CircularBuffer, stream cleanup, pool management
  - Timeout cleanup: AbortController, cleanup watcher, emergency recovery
- **Tuesday (4 hours):** Complete unit testing and integration
  - 10 tests each for P3-001 and P3-003 (20 tests total)
  - Verify memory profiling and cleanup behavior

### Phase 2: Validation & Indexing (Days 3-4)
- **Wednesday (4 hours):** Implement P3-002 and P3-004 fixes
  - Session coherence: exemptions, rotation handling, race conditions
  - Error context: validation, indexing, bounds checking
- **Thursday (4 hours):** Complete unit testing and integration
  - 10 tests each for P3-002 and P3-004 (20 tests total)
  - Verify coherence and search performance

### Phase 3: Verification & Cleanup (Day 5)
- **Friday (2 hours):** Comprehensive testing and verification
  - Run full 40-test suite
  - Performance profiling across all fixes
  - Regression testing vs Phase 1-2 baseline
  - Documentation and handoff

---

## Critical Success Criteria

### Memory Stability
- P3-001: Memory growth < 5MB over 10,000 screenshot operations
- P3-003: activeTasks Map empty after all timeouts resolve
- P3-004: Error storage < 10MB for 10K errors with full context

### Performance
- P3-002: Session coherence calculations < 50ms
- P3-004: Error search O(1), < 10ms for 10K errors
- Overall: Zero performance regression vs v12.0.0 baseline

### Correctness
- All 40 tests passing
- 0 regressions in existing test suite (Phase 1-2 validation)
- Edge cases properly handled (screen rotation, Chrome OS, etc.)

### Observability
- P3-004: Error logs include full context (request ID, command, parameters, stack)
- Structured logging fields for analysis
- Emergency cleanup logging for P3-003 overdue tasks

---

## Risk Mitigation

### Code Review Checkpoints
1. **Before Phase 1:** Review memory management strategy with team
2. **After Phase 1:** Performance profiling sign-off
3. **After Phase 2:** Edge case handling validation
4. **Before Deploy:** Full regression test suite execution

### Testing Strategy
- Unit tests (isolated component testing)
- Integration tests (cross-component interactions)
- Performance tests (memory, latency, throughput)
- Stress tests (1000+ concurrent operations)
- Real-world validation (existing test suite)

### Rollback Plan
- If P3-001 memory leaks persist: Revert CircularBuffer, use WeakMap
- If P3-002 false positives continue: Increase coherence thresholds
- If P3-003 cleanup fails: Extend emergency detection window
- If P3-004 search slow: Add LRU cache to frequently accessed queries

---

## Deliverables Summary

| Bug | Files | Changes | Tests | Est. Time |
|-----|-------|---------|-------|-----------|
| P3-001 | 1 | 5 changes, ~100 LOC | 10 | 2 hrs |
| P3-002 | 1 | 6 changes, ~150 LOC | 10 | 2 hrs |
| P3-003 | 1 | 6 changes, ~200 LOC | 10 | 2 hrs |
| P3-004 | 1 | 9 changes, ~250 LOC | 10 | 2-3 hrs |
| **Total** | **4** | **26 changes, ~700 LOC** | **40** | **8 hrs** |

---

## Sign-Off

**Prepared By:** Claude Engineering  
**Date:** June 14, 2026  
**Status:** Ready for Team Review & Implementation Approval

**Recommended Approval Workflow:**
1. Engineering team reviews plan
2. Schedule 2-week sprint (Days 1-5)
3. Execute Phase 1-3 sequentially
4. Validate against success criteria
5. Deploy to staging for final validation
6. Merge to main branch

---

**Questions?** Contact engineering team for clarification on specific fixes or test strategies.
