# Basset Hound Browser - Stress Testing Improvements
**Date:** May 8, 2026  
**Findings from:** Comprehensive Stress Testing & Hardening Phase  
**Version:** 11.2.0 → 11.3.0 (with improvements)

---

## Overview

Based on the stress testing results, this document outlines improvements to be implemented. Improvements are categorized by priority and impact.

---

## Critical Fixes (P0)

### 1. Memory Leak in Rate Limiting System
**File:** `websocket/server.js`  
**Issue:** Rate limit data cleanup not implemented (line 313)  
**Impact:** Memory grows unbounded in long-running sessions  
**Symptom:** Memory growth rate > 5MB/hour  
**Fix Priority:** CRITICAL

**Implementation:**
```javascript
// Add cleanup to heartbeat loop (every 5 minutes)
// Remove rate limit entries older than the window
const now = Date.now();
const window = 60000; // 1 minute default
for (const [key, data] of rateLimit.entries()) {
  if (now - data.lastReset > window * 2) {
    rateLimit.delete(key);
  }
}
```

**Testing:**
- Run 1+ hour long-running session
- Measure memory at 0min, 30min, 60min
- Verify growth rate < 2MB/hour

**Expected Outcome:** Memory stable, no unbounded growth

---

### 2. Console Logging in Production
**File:** `websocket/server.js` (multiple locations)  
**Issue:** Using console.* instead of logger (10+ occurrences)  
**Impact:** Inconsistent logging, potential performance issue  
**Fix Priority:** HIGH

**Implementation:**
Replace all `console.log()`, `console.error()` with `this.logger` calls

**Example:**
```javascript
// Before
console.log('[WebSocket]', `Received command from ${clientId}`);

// After
this.logger.info('[WebSocket]', `Received command from ${clientId}`);
```

**Testing:** Run stress tests, verify logging works as expected

---

## High Priority Improvements (P1)

### 3. Event Listener Cleanup on Tab Destruction
**Files:**
- `src/main/tab-manager.js`
- `src/multi-page/multi-page-manager.js`

**Issue:** Event listeners not cleaned up when tabs destroyed  
**Impact:** Memory leak in multi-page operations  
**Symptom:** Memory growth when creating/destroying many tabs  
**Fix Priority:** HIGH

**Implementation:**
```javascript
// Tab destruction cleanup
destroyTab(tabId) {
  const tab = this.tabs.get(tabId);
  if (tab) {
    // Remove all event listeners
    if (tab.view) {
      tab.view.removeAllListeners();
      // Or: for (const event of eventNames) { tab.view.removeListener(event); }
    }
    
    // Clean up timers
    if (tab.timers) {
      tab.timers.forEach(tid => clearTimeout(tid));
    }
    
    // Clean up references
    this.tabs.delete(tabId);
  }
}
```

**Testing:** Monitor memory during rapid tab creation/destruction (100+ cycles)

---

### 4. WebSocket Connection Cleanup Under Stress
**File:** `websocket/server.js`  
**Issue:** Rapid connect/disconnect may leave dangling connections  
**Impact:** Port exhaustion, memory leaks under stress  
**Symptom:** 'Address in use' errors after 100+ reconnects  
**Fix Priority:** HIGH

**Implementation:**
```javascript
// Ensure all resources cleaned up on client disconnect
client.on('close', () => {
  // Remove from active clients
  this.clients.delete(clientId);
  
  // Cancel any pending operations
  if (this.pendingOperations.has(clientId)) {
    this.pendingOperations.get(clientId).forEach(timer => clearTimeout(timer));
    this.pendingOperations.delete(clientId);
  }
  
  // Clean up client-specific data
  if (this.clientData.has(clientId)) {
    const data = this.clientData.get(clientId);
    // Free any resources
    this.clientData.delete(clientId);
  }
});
```

**Testing:** Run 500+ rapid connect/disconnect cycles, verify no port exhaustion

---

## High Priority Optimizations (P1)

### 5. Fingerprint Profile Caching
**File:** `evasion/fingerprint-profile.js`  
**Issue:** Profiles recreated on each use instead of cached  
**Impact:** Overhead in fingerprinting, slower evasion  
**Expected Improvement:** 10-20ms per session

**Implementation:**
```javascript
// Add caching layer
class FingerprintProfileManager {
  constructor() {
    this.profiles = new Map();
    this.cache = new Map(); // Add cache
  }

  getProfile(profileId) {
    if (!this.cache.has(profileId)) {
      const profile = this._loadProfile(profileId);
      this.cache.set(profileId, profile);
    }
    return this.cache.get(profileId);
  }
}
```

**Testing:** Measure fingerprint creation time before/after

---

### 6. Session State Snapshot Optimization
**File:** `src/session/session-manager.js`  
**Issue:** Full session snapshots on every save (expensive)  
**Impact:** Slower session recovery, higher CPU  
**Expected Improvement:** 20-50ms per session save

**Implementation:**
```javascript
// Implement delta snapshots
saveSession(sessionId) {
  const current = this.getCurrentState(sessionId);
  const previous = this.lastSnapshot.get(sessionId);
  
  // Only save what changed
  const delta = this._calculateDelta(current, previous);
  
  if (Object.keys(delta).length > 0) {
    this._saveDelta(sessionId, delta);
    this.lastSnapshot.set(sessionId, current);
  }
}
```

**Testing:** Measure save time and CPU usage during multi-page operations

---

## Medium Priority Improvements (P2)

### 7. Connection Pool for Concurrent Requests
**File:** `websocket/server.js`  
**Issue:** No connection pooling, each request creates new context  
**Impact:** Higher latency under concurrent load  
**Expected Improvement:** 5-15% throughput increase

**Implementation:**
- Implement request queue with worker pool
- Pre-allocate resources for expected concurrency
- Implement backpressure handling

---

### 8. Tor Exit Node Caching
**File:** `proxy/tor-advanced.js`  
**Issue:** Exit node checked on every request  
**Impact:** Extra latency in Tor requests  
**Expected Improvement:** 20-50ms per Tor request

**Implementation:**
```javascript
// Cache exit node info with TTL
getExitNodeInfo() {
  const now = Date.now();
  if (this.exitCache && now - this.exitCacheTime < 300000) { // 5 min cache
    return this.exitCache;
  }
  
  // Fetch new exit info
  const exitInfo = this._fetchExitInfo();
  this.exitCache = exitInfo;
  this.exitCacheTime = now;
  return exitInfo;
}
```

**Testing:** Measure request latency with Tor enabled

---

### 9. Screenshot Format Optimization
**File:** `screenshots/manager.js`  
**Issue:** Always generates full PNG even for small captures  
**Impact:** Slower screenshot operations, larger memory  
**Expected Improvement:** 30-100ms per screenshot

**Implementation:**
```javascript
// Optimize based on capture size
async captureScreenshot(options = {}) {
  const { width, height } = options;
  
  // For small captures, use JPEG instead of PNG
  if ((width || 1920) * (height || 1080) < 200000) {
    return this._captureAsJPEG(options); // Smaller, faster
  }
  
  return this._captureAsPNG(options); // Full quality
}
```

**Testing:** Profile screenshot performance before/after

---

### 10. Behavioral AI Simplification
**File:** `evasion/behavioral-ai.js`  
**Issue:** Complex physics calculations on every event  
**Impact:** CPU overhead during interaction  
**Expected Improvement:** 10-20% CPU reduction

**Implementation:**
```javascript
// Pre-calculate common paths
initializeCommonPaths() {
  // Store pre-calculated paths for common movements
  this.commonPaths = {
    short: this._calculatePath(0, 0, 50, 50, 100),
    medium: this._calculatePath(0, 0, 200, 200, 300),
    long: this._calculatePath(0, 0, 500, 500, 1000)
  };
}

getMousePath(startX, startY, endX, endY, duration) {
  const distance = Math.sqrt((endX-startX)**2 + (endY-startY)**2);
  
  // Use pre-calculated for common distances
  if (distance < 100) return this.commonPaths.short;
  if (distance < 300) return this.commonPaths.medium;
  
  // Calculate for unique paths
  return this._calculatePath(startX, startY, endX, endY, duration);
}
```

**Testing:** Profile CPU usage during heavy interaction

---

## Low Priority Improvements (P3)

### 11. Lazy Load Optional Modules
**Impact:** 200-400ms startup improvement (deferred because network is bottleneck)
**Files:** `src/main/main.js`, individual modules
**Status:** DEFERRED - Network I/O dominates (1-5 second per page), not startup

---

### 12. Documentation Improvements
- [ ] `docs/features/rate-limiting.md` - Configuration guide
- [ ] `docs/features/memory-management.md` - Memory thresholds
- [ ] `docs/features/performance-tuning.md` - Optimization guide

---

## Validation & Testing

### Phase 1: Implement Fixes
1. Fix critical issues first (memory leak, console logging)
2. Test each fix with appropriate stress tests
3. Verify no regressions

### Phase 2: Implement Optimizations
1. Profile before/after for each optimization
2. Ensure improvements are measurable
3. Update performance baselines

### Phase 3: Validation
```bash
# Run full stress test suite again
npm run test:stress

# Run baseline comparison
node tests/stress/performance-compare.js

# Run Claude agent tests
# (See AGENT-TESTING-GUIDE.md)
```

### Success Criteria
- ✅ All critical issues fixed
- ✅ Memory stable in long-running sessions
- ✅ No performance regressions
- ✅ Stress test success rate > 95%
- ✅ Claude agent pass rate > 90%

---

## Timeline

### Week 1 (Priority)
- Implement memory leak fix
- Fix console logging
- Fix event listener cleanup
- Run validation tests

### Week 2
- Implement WebSocket connection cleanup
- Implement fingerprint caching
- Profile improvements
- Run full test suite

### Week 3
- Implement remaining optimizations
- Full validation
- Documentation updates
- Release v11.3.0

---

## Implementation Checklist

### Critical (P0)
- [ ] Fix memory leak in rate limiting
- [ ] Fix console logging
- [ ] Test memory stability

### High (P1)
- [ ] Fix event listener cleanup
- [ ] Fix WebSocket connection cleanup
- [ ] Implement fingerprint caching
- [ ] Optimize session snapshots

### Medium (P2)
- [ ] Implement connection pooling
- [ ] Implement Tor caching
- [ ] Optimize screenshots
- [ ] Simplify behavioral AI

### Low (P3)
- [ ] Write documentation
- [ ] Performance tuning guide

---

## Estimated Impact

| Improvement | Latency Impact | Memory Impact | CPU Impact | Priority |
|-------------|----------------|---------------|-----------|----------|
| Memory leak fix | — | -50MB/hour | — | P0 |
| Console logging cleanup | -5ms | -10MB | -5% | P0 |
| Event listener cleanup | — | -20MB | — | P1 |
| WS connection cleanup | — | -30MB | — | P1 |
| Fingerprint caching | -15ms | — | -5% | P1 |
| Session snapshots | -30ms | — | -10% | P1 |
| Connection pooling | -50ms | -5MB | — | P2 |
| Tor caching | -40ms | — | — | P2 |
| Screenshot optimization | -50ms | -20MB | -5% | P2 |
| Behavioral AI simplification | — | — | -10% | P2 |

**Total Estimated Impact:**
- **Latency:** -90-190ms per operation
- **Memory:** -135MB long-term
- **CPU:** -35% peak usage

---

## References

- `docs/ROADMAP.md` - Known issues and optimizations
- `docs/findings/STRESS-TEST-FINDINGS-2026-05-08.md` - Test results
- `tests/stress/*.js` - Test implementations

---

*Improvements documented: May 8, 2026*  
*Based on stress testing phase (Phase 3-5)*  
*Target version: 11.3.0*  
*Status: Ready for implementation*
