# v12.3.0 Phase 1 - Quickstart Guide
## Stability Fixes (Aug 1-8, 2026)

**Duration:** 2-3 working days (18-22 hours)  
**Status:** Ready to start August 1, 2026  
**Target Completion:** August 8, 2026 (EOD)  
**Success Criteria:** All 4 MEDIUM-priority issues fixed + 100% test pass  

---

## THE 4 ISSUES YOU'RE FIXING

From the security audit (June 14, 2026), v12.3.0 Phase 1 focuses on these MEDIUM-priority production stability issues:

### Issue 1: Event Listener Memory Leaks
**Problem:** WebSocket event listeners can accumulate over time, causing memory leaks  
**Impact:** Process slowdown, eventual OOM crash after 1000+ connections  
**Solution:** Implement listener tracking + automatic cleanup  
**Effort:** 6-8 hours (4 tasks)  

### Issue 2: Screenshot Cache Unbounded Growth
**Problem:** Cache metadata grows indefinitely, screenshot files never deleted  
**Impact:** Memory growth, disk space exhaustion  
**Solution:** LRU eviction policy + background cleanup job  
**Effort:** 5-7 hours (4 tasks)  

### Issue 3: No Circuit Breaker for Tor Failures
**Problem:** When Tor is down, system keeps retrying indefinitely  
**Impact:** Cascading failures, resource exhaustion  
**Solution:** Circuit breaker pattern (CLOSED → OPEN → HALF_OPEN)  
**Effort:** 4-6 hours (3 tasks)  

### Issue 4: Missing Rate Limiting on WebSocket Commands
**Problem:** Expensive operations like screenshots have no per-client limits  
**Impact:** Denial of service via resource exhaustion  
**Solution:** Per-command rate limits with sliding window  
**Effort:** 4-5 hours (4 tasks)  

**BONUS:** Issue 5 - Enhance error context (3-4 hours, 2 tasks)

---

## WHAT YOU'RE BUILDING

### New Files to Create

```
src/stability/
├── listener-tracker.js         # Track event listeners per client
├── cache-cleanup.js            # LRU eviction + background cleanup
├── circuit-breaker.js          # Tor failure isolation
└── rate-limiter.js             # Per-command rate limiting

src/config/
└── rate-limits.js              # Default rate limit configuration

src/monitoring/
├── cache-stats.js              # Cache usage monitoring
├── circuit-breaker-metrics.js  # Circuit breaker state tracking
└── rate-limit-stats.js         # Rate limit reporting

src/errors/
├── error-context.js            # Enhanced error responses
└── error-logger.js             # Structured error logging

tests/stability/
├── listener-tracking.test.js    # Listener tests
├── cache-cleanup.test.js        # Cache eviction tests
├── circuit-breaker.test.js      # Circuit breaker tests
├── rate-limiter.test.js         # Rate limiting tests
├── error-context.test.js        # Error context tests
├── stress-listeners.test.js     # 1000+ connection stress test
└── memory-leak-test.js          # Memory leak verification

tests/monitoring/
├── cache-stats.test.js
├── circuit-breaker-metrics.test.js
└── rate-limit-stats.test.js
```

### Files to Modify

```
websocket/server.js             # Integrate all stability fixes
screenshots/cache.js            # Integrate cache cleanup
proxy/manager.js                # Integrate circuit breaker
src/logging/                    # Update error handling
```

---

## IMPLEMENTATION ORDER (Fastest to Working State)

**Day 1 (Aug 1-2): Circuit Breaker + Rate Limiting (8 hours)**
1. Create `circuit-breaker.js` - Start simple state machine
2. Create `rate-limiter.js` - Basic timestamp tracking
3. Integrate both into `websocket/server.js`
4. Write tests for both (15+ tests)
5. **Result:** Rate limiting + Tor failover working

**Day 2 (Aug 5-6): Event Listener Tracking + Cleanup (8 hours)**
1. Create `listener-tracker.js` - Track listeners per client
2. Create `cache-cleanup.js` - LRU eviction policy
3. Integrate both into `websocket/server.js` and `screenshots/cache.js`
4. Implement background cleanup jobs
5. Write tests (15+ tests)
6. **Result:** No more memory leaks, cache auto-cleanup

**Day 3 (Aug 7-8): Error Context + Validation + Testing (6 hours)**
1. Create `error-context.js` - Enhanced error responses
2. Update command handlers in `websocket/server.js`
3. Create monitoring classes for metrics
4. Run full Phase 1 test suite (50+ tests)
5. Memory stress test (1000+ connections)
6. **Result:** All 4 issues fixed, 100% test pass

---

## KEY CODE EXAMPLES

### Circuit Breaker Usage (Tor Manager)
```javascript
// In proxy/manager.js:
const TorCircuitBreaker = require('../stability/circuit-breaker');
this.torBreaker = new TorCircuitBreaker({ failureThreshold: 5 });

// When calling Tor:
const status = await this.torBreaker.execute(
  () => checkTorStatus(),
  () => ({ success: false, message: 'Tor circuit open, using fallback' })
);
```

### Rate Limiter Usage (WebSocket Server)
```javascript
// In websocket/server.js:
const RateLimiter = require('../stability/rate-limiter');
this.rateLimiter = new RateLimiter();

// Before executing command:
if (this.rateLimiter.isRateLimited(clientId, command)) {
  return { success: false, error: 'Rate limit exceeded' };
}
```

### Listener Tracking Usage (WebSocket Server)
```javascript
// In websocket/server.js:
const ListenerTracker = require('../stability/listener-tracker');
this.listeners = new ListenerTracker();

// When registering listener:
this.listeners.track(clientId, ws, 'message', handler);

// When client disconnects:
this.listeners.cleanupClient(clientId);
```

### Error Context Usage (Command Handler)
```javascript
// In websocket/server.js command handler:
async executeCommand(cmd, params) {
  const startTime = Date.now();
  const operationId = generateUUID();
  
  try {
    // ... command execution
  } catch (error) {
    return {
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      operationId,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      debugInfo: process.env.DEBUG ? { stack: error.stack } : undefined
    };
  }
}
```

---

## TEST STRATEGY FOR PHASE 1

**Run tests ONCE at phase end (Aug 8), not after every change.**

### Test Files to Create (50+ tests)

1. **listener-tracking.test.js** (15+ tests)
   - Track listeners correctly
   - Cleanup removes all listeners
   - No memory leaks (use gc module)
   - Works with 1000+ clients

2. **cache-cleanup.test.js** (15+ tests)
   - LRU eviction working
   - Age-based cleanup working
   - File deletion verified
   - Metadata consistency maintained

3. **circuit-breaker.test.js** (10+ tests)
   - CLOSED → OPEN on failure threshold
   - OPEN → HALF_OPEN after reset timeout
   - HALF_OPEN → CLOSED on success
   - Fallback called when OPEN

4. **rate-limiter.test.js** (10+ tests)
   - Enforce per-client limits
   - Enforce per-command limits
   - Timestamp cleanup (1-min window)
   - Allow after window expires

5. **error-context.test.js** (5+ tests)
   - Operation ID generated
   - Error type captured
   - Duration calculated
   - Debug info in DEBUG mode

6. **stress-listeners.test.js** (5+ tests)
   - 1000+ concurrent connections
   - All listeners cleaned on disconnect
   - Memory returns to baseline
   - Cleanup overhead <5ms per client

---

## DAILY CHECKLIST

### Day 1 (Aug 1-2)
- [ ] Read full Phase 1 section from master plan
- [ ] Review circuit-breaker code from audit (section 3.3)
- [ ] Review rate-limiter code from audit (section 3.4)
- [ ] Create `circuit-breaker.js` with state machine
- [ ] Create `rate-limiter.js` with timestamp tracking
- [ ] Write 15+ tests
- [ ] Integrate into `websocket/server.js`
- [ ] Run tests (should pass)
- [ ] Commit to feature branch

### Day 2 (Aug 5-6)
- [ ] Create `listener-tracker.js` from audit
- [ ] Create `cache-cleanup.js` from audit
- [ ] Integrate `listener-tracker` into WebSocket handlers
- [ ] Integrate `cache-cleanup` into screenshot cache
- [ ] Add background cleanup jobs
- [ ] Write 15+ tests
- [ ] Run tests (should pass)
- [ ] Commit to feature branch

### Day 3 (Aug 7-8)
- [ ] Create `error-context.js` from audit section 3.5
- [ ] Update command handlers to use error context
- [ ] Create monitoring classes (cache, circuit, rate limit)
- [ ] Write 5+ error context tests
- [ ] Create stress test (1000+ connections)
- [ ] Run full Phase 1 test suite (50+ tests)
- [ ] Verify 100% test pass
- [ ] Memory leak test (use node --expose-gc)
- [ ] Document any issues
- [ ] Write Phase 1 completion report
- [ ] Merge feature branch to main

---

## SUCCESS CRITERIA (August 8, EOD)

### Code Changes
✅ All 5 new stability modules created  
✅ All integrations completed in websocket/server.js  
✅ All background jobs running  
✅ No compilation errors  

### Testing
✅ 50+ tests created  
✅ 100% test pass rate (50/50 tests passing)  
✅ Stress test passes (1000+ connections)  
✅ Memory leak test passes (baseline maintained)  

### Quality Checks
✅ No regressions in existing tests  
✅ Latency maintained (<2ms P99)  
✅ Memory stable (<5% utilization)  
✅ Code review passed (if applicable)  

### Documentation
✅ Phase 1 completion report written  
✅ All tasks marked complete in work queue  
✅ Effort tracking updated  
✅ Blockers documented (if any)  

---

## COMMON PITFALLS TO AVOID

❌ **DON'T** try to optimize before it works
- Get circuit breaker working, then optimize state machine

❌ **DON'T** skip tests
- Each task needs tests, write them as you go

❌ **DON'T** run full test suite after each change
- Just run Phase 1 tests at the end (Aug 8)

❌ **DON'T** modify more than one file per task
- Keep changes focused and testable

❌ **DON'T** assume listeners will cleanup automatically
- You must explicitly track and remove them

✅ **DO** start with the simplest implementation
- Circuit breaker: basic state machine
- Rate limiter: simple timestamp array

✅ **DO** test with realistic workloads
- 1000+ connections for listener tracking
- Long-running cache for eviction policy

✅ **DO** measure memory usage
- Use `node --expose-gc` for garbage collection control
- Use `process.memoryUsage()` to track heap

✅ **DO** log everything in development
- Add logging to see state transitions
- Remove verbose logs before committing

---

## HELP & DEBUGGING

### Memory Leak Detection
```bash
# Run with garbage collection exposed
node --expose-gc app.js

# In test code
if (global.gc) {
  global.gc();
  const before = process.memoryUsage().heapUsed;
  // ... test code ...
  global.gc();
  const after = process.memoryUsage().heapUsed;
  if (after > before * 1.1) throw new Error('Memory leak detected');
}
```

### Circuit Breaker Debugging
```javascript
// Log state transitions
breaker.on('stateChange', (oldState, newState) => {
  console.log(`Circuit breaker: ${oldState} → ${newState}`);
});
```

### Rate Limiting Debugging
```javascript
// Check limits per client
console.log(limiter.getClientStats(clientId));
// Output: { screenshot: 3/10, execute_script: 5/30, ... }
```

---

## FILES TO READ FIRST

1. **Audit findings** (security audit document, sections 3.1-3.5)
2. **Master plan** (v12.3.0 master plan, Phase 1 details)
3. **Work queue** (specific tasks breakdown)

Then start implementation!

---

## ESTIMATED TIMELINE

| Date | Task | Hours | Status |
|------|------|-------|--------|
| Aug 1-2 | Circuit breaker + rate limiter | 8 | 🎯 Focus |
| Aug 5-6 | Listener tracking + cache cleanup | 8 | Next |
| Aug 7-8 | Error context + testing | 6 | Final |
| **Total** | **Phase 1 Complete** | **22** | **Target: 100%** |

**Buffer:** 0 days (aggressive but achievable)  
**Contingency:** If issues arise, extend to Aug 9 if needed

---

## READY TO START?

1. Read the master plan (Part 2, Phase 1)
2. Read this quickstart (you're here!)
3. Read the work queue (45 tasks)
4. Create feature branch: `feature/v12.3.0-phase-1-stability`
5. Start with Task 1.3.1 (Circuit Breaker) on Aug 1
6. Follow the daily checklist above
7. Report progress daily
8. Run full test suite on Aug 8
9. Submit Phase 1 completion report by Aug 8 EOD

**Good luck! Phase 1 sets the foundation for everything else.** ✅

---

**Document Status:** ✅ READY FOR EXECUTION  
**Created:** June 14, 2026  
**Target Start:** August 1, 2026  
**Target Completion:** August 8, 2026
