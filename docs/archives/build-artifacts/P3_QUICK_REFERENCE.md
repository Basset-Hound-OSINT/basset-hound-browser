# P3 Bug Fixes - Quick Reference Guide

**TL;DR:** 4 medium-priority bugs, 8 hours total, 40 tests, 700 LOC changes

---

## One-Liner Summaries

| Bug | Issue | Fix | Impact |
|-----|-------|-----|--------|
| **P3-001** | Screenshot buffers accumulate in memory | CircularBuffer + stream cleanup | Memory growth < 5MB/10K ops |
| **P3-002** | False coherence violations on legitimate changes | Add exemptions + fix variance calc | Coherence score > 0.90 for valid sessions |
| **P3-003** | Timeout handlers never cleaned up | AbortController + cleanup watcher | activeTasks always empties |
| **P3-004** | Error logs unbounded; search O(n) | Context validation + indexing | O(1) search, < 10MB per 10K errors |

---

## Implementation Checklist

### Phase 1: Memory Fixes (Monday-Tuesday, 8 hours)

#### P3-001: Screenshot Memory Leaks
- [ ] Add CircularBuffer class (before ResilienceCoordinator)
- [ ] Replace `this.recoveryLog = []` with CircularBuffer
- [ ] Add try-finally to executeWithResilience for cleanup
- [ ] Add stream cleanup in tryCompressionFallback (setImmediate)
- [ ] Implement error report object pool in constructor
- [ ] Add GC trigger on recovery failure (line 579)
- [ ] Run 10 unit tests
- [ ] Verify heap delta < 2MB over 1000 cycles

#### P3-003: Timeout Handler Cleanup
- [ ] Implement CancellableTimeout class with AbortController
- [ ] Rewrite withTimeout() to use CancellableTimeout
- [ ] Add activeTimeouts Map to constructor
- [ ] Implement _startTimeoutCleanupWatcher() (30-second interval)
- [ ] Update executeWithFallback() to track and cancel retries
- [ ] Enhance trackTask() with guaranteed cleanup
- [ ] Add destroy() method for process cleanup
- [ ] Run 10 unit tests
- [ ] Verify no dangling setTimeout/setInterval

### Phase 2: Validation & Indexing (Wednesday-Thursday, 8 hours)

#### P3-002: Session Coherence Edge Cases
- [ ] Add allowedComponentUpdates to initializeSession (line 26)
- [ ] Update validateTemporalCoherence to skip exempt components
- [ ] Replace request variance check with coefficient of variation
- [ ] Implement screen rotation normalization (sort dimensions)
- [ ] Update detectImpossibleCombinations (iPad+Firefox, Chrome OS)
- [ ] Add atomic locking to recordInteraction
- [ ] Run 10 unit tests
- [ ] Verify coherence score > 0.90 for legitimate sessions

#### P3-004: Error Logging Context
- [ ] Add context size constants (MAX_CONTEXT_SIZE = 1MB)
- [ ] Implement _validateAndSanitizeContext method
- [ ] Add error indexing Maps (byType, byComponent, bySeverity, bySpan)
- [ ] Implement _updateErrorIndexes method
- [ ] Rewrite findRelatedErrors() to use indexes (O(1))
- [ ] Bound recoveryAttempts array to MAX_RECOVERY_ATTEMPTS (10)
- [ ] Limit error pattern Sets to 100 entries
- [ ] Implement _limitStackTrace() for MAX_STACK_DEPTH (15)
- [ ] Enhance close() for index cleanup
- [ ] Run 10 unit tests
- [ ] Verify search < 10ms for 10K errors

### Phase 3: Verification (Friday, 2-4 hours)
- [ ] Run full 40-test suite
- [ ] Performance profiling (memory, latency, throughput)
- [ ] Regression testing vs v12.0.0 baseline
- [ ] Edge case validation (screen rotation, Chrome OS, etc.)
- [ ] Real-world stress tests (1000+ concurrent operations)
- [ ] Heap snapshot analysis before/after
- [ ] Documentation review and handoff

---

## File Modification Summary

### src/extraction/screenshot-phase4-robustness.js
**Changes:** 5 major modifications, ~100 LOC
- Lines 500: CircularBuffer instead of array
- Lines 371-395: Stream cleanup
- Lines 424-438: Object pooling
- Lines 543-546: Cleanup trigger
- Lines 626-640: Use pool in recovery log

### src/evasion/session-coherence.js
**Changes:** 6 major modifications, ~150 LOC
- Line 26: allowedComponentUpdates config
- Lines 202-239: Exempt component logic
- Lines 380-397: Coefficient of variation
- Lines 452-468: Screen rotation normalization
- Lines 545-580: Impossible combinations update
- Line 87: Atomic locking

### src/resilience/timeout-protection.js
**Changes:** 6 major modifications, ~200 LOC
- New: CancellableTimeout class
- Lines 56-77: Rewrite withTimeout with AbortController
- Lines 36-47: activeTimeouts + cleanup watcher
- New: _startTimeoutCleanupWatcher + _stopTimeoutCleanupWatcher
- Lines 112-115: Cancel prior timeouts on retry
- Lines 203-224: Enhanced trackTask with guaranteed cleanup
- New: destroy() method

### src/observability/error-tracer.js
**Changes:** 9 major modifications, ~250 LOC
- New: Context validation constants
- New: _validateAndSanitizeContext method
- Line 34: Add error indexing Maps
- Line 96: Update indexes on error trace
- New: _updateErrorIndexes method
- Lines 249-306: Rewrite findRelatedErrors with indexes
- Line 161: Bound recovery attempts array
- Lines 452-453: Bound pattern Sets
- New: _limitStackTrace method
- Lines 515-523: Enhanced close() cleanup

---

## Test Files to Create

### tests/unit/p3-001-screenshot-memory.test.js
10 tests focusing on:
- CircularBuffer bounds
- Stream handle cleanup
- Error report pooling
- Mixed success/failure cycles
- Memory growth limits

### tests/unit/p3-002-session-coherence.test.js
10 tests focusing on:
- Component exemptions
- Network variance thresholds
- Screen rotation handling
- Device impossible combinations
- Race condition prevention

### tests/unit/p3-003-timeout-cleanup.test.js
10 tests focusing on:
- Timeout cleanup on resolution
- activeTasks map drainage
- Retry handler cleanup
- Emergency overdue detection
- 1000+ concurrent timeout stability

### tests/unit/p3-004-error-context.test.js
10 tests focusing on:
- Context size validation
- Circular reference handling
- Search performance O(1)
- Pattern Set bounds
- Recovery attempt limits

---

## Performance Targets

| Metric | P3-001 | P3-002 | P3-003 | P3-004 |
|--------|--------|--------|--------|--------|
| Memory Delta | < 5MB/10K ops | N/A | < 1MB/1K tasks | < 10MB/10K errors |
| Latency | N/A | < 50ms coherence | < 100ms cleanup | < 10ms search |
| Concurrency | 1000 ops/sec | N/A | 1000+ concurrent | 10K+ errors |
| Heap Growth | Linear | N/A | 0 after cleanup | Linear |

---

## Common Pitfalls & Fixes

### P3-001 CircularBuffer
**Issue:** Forgot to implement toArray() method  
**Fix:** Return `this.buffer` directly in toArray()

**Issue:** Index wrapping incorrect  
**Fix:** Use modulo: `this.buffer[this.index % this.maxSize]`

### P3-002 Screen Rotation
**Issue:** Dimensions still match but variance high  
**Fix:** Sort both dimension arrays before comparison

**Issue:** Exemptions don't work  
**Fix:** Check session.allowedComponentUpdates is loaded in constructor

### P3-003 AbortController
**Issue:** Timeout fires but not caught  
**Fix:** Wrap in try-catch after Promise.race

**Issue:** Emergency cleanup never triggers  
**Fix:** Interval check is `> timeoutMs + 5000`, not `> timeoutMs`

### P3-004 Indexing
**Issue:** Search still slow  
**Fix:** Make sure all errors update indexes in traceError

**Issue:** Context truncation breaks object structure  
**Fix:** Return new object with truncated fields, not modified original

---

## Debugging Tips

### Memory Leaks (P3-001, P3-004)
```bash
# Take heap snapshots
node --expose-gc --trace-gc your-test.js

# Compare snapshots
node -r ./heapdump server.js
# Check heapdump files for retained objects
```

### Timeout Issues (P3-003)
```bash
# Monitor active tasks
console.log(timeoutProtection.activeTasks.size);
console.log(timeoutProtection.getActiveTasks());

# Check for dangling timers
setInterval(() => console.log(process._getActiveRequests()), 1000);
```

### Coherence Issues (P3-002)
```bash
# Check violation log
console.log(session.violations);
console.log(sessionCoherence.calculateOverallCoherence(session));

# Debug specific layer
console.log(session.layers.temporal.history);
console.log(session.layers.device.changes);
```

---

## Success Criteria Checklist

- [ ] All 40 tests passing
- [ ] Memory growth < 5MB for P3-001 (10K ops)
- [ ] Memory growth < 10MB for P3-004 (10K errors)
- [ ] Search time < 10ms for P3-004 (10K errors)
- [ ] activeTasks empty after timeouts (P3-003)
- [ ] Coherence > 0.90 for legitimate sessions (P3-002)
- [ ] Zero regressions vs v12.0.0 baseline
- [ ] Edge cases validated (screen rotation, Chrome OS, etc.)
- [ ] Performance profiling complete
- [ ] Heap snapshots show proper cleanup

---

## Deployment Steps

1. Create feature branch: `git checkout -b p3/bug-fixes`
2. Implement Phase 1 (P3-001, P3-003)
3. Run tests: `npm test -- tests/unit/p3-*.test.js`
4. Implement Phase 2 (P3-002, P3-004)
5. Run full test suite
6. Performance profiling
7. Code review
8. Create PR with detailed commit messages
9. Merge to main after approval

---

## Questions?

**For memory issues:** Check heap snapshots and GC logs
**For timeout issues:** Monitor activeTasks map and cleanup watcher logs
**For coherence issues:** Review violation log and individual layer validation
**For performance issues:** Profile with node --inspect and DevTools

---

Generated: June 14, 2026  
Status: Ready for implementation
