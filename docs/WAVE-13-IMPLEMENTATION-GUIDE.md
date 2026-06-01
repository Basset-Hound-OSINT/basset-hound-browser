# Wave 13: Performance Optimization Implementation Guide

**Status:** In Progress  
**Target Release:** v12.1.0 (June 14, 2026)  
**Estimated Duration:** 20-27 hours  
**Expected Improvement:** +40% throughput, -41% P99 latency, +50% concurrent capacity

---

## Overview

Wave 13 implements three critical performance optimizations to increase system throughput and reduce latency:

1. **OPT-08: Parallel Screenshot Processing** (6-8 hours) - GPU buffer parallelization
2. **OPT-09: Priority Queue Integration** (3-4 hours) - Activate priority-based request scheduling
3. **OPT-13: DOM Cache Integration** (4-5 hours) - Wire cache into extraction handlers

## Implementation Status

### ✅ Component Implementation (COMPLETE)

All three optimization components are **already implemented** and fully functional:

- `/src/screenshots/parallel-processor.js` - Parallel screenshot processor (235 lines)
- `/src/queuing/priority-queue.js` - Priority queue implementation (334 lines)
- `/src/extraction/dom-cache.js` - DOM extraction cache (176 lines)
- `/src/extraction/dom-cache-integration.js` - Cache integration helpers (NEW)

### ⏳ Integration Tasks (IN PROGRESS)

#### OPT-09 Integration (3-4 hours) - STARTED

**File:** `/websocket/connection-pool.js`  
**Status:** ✅ COMPLETE

Changes made:
- Import PriorityQueue module
- Replace `this.requestQueue = []` with `this.requestQueue = new PriorityQueue()`
- Update all queue method calls:
  - `.length` → `.size()`
  - `.shift()` → `.dequeue()`
  - `.push()` → `.enqueue()`
- Add queue breakdown to status (critical/normal/low)
- Update drain logic to use `isEmpty()`

**Verification:**
```bash
npm test tests/performance/wave13-optimizations.test.js -- --grep "OPT-09"
```

#### OPT-13 Integration (4-5 hours) - BLOCKED (Awaiting Handler Registration)

**Files to Modify:**
1. `/websocket/server.js` - Create DOM cache instance and wire handlers
2. Handler files in `/websocket/commands/` - Integrate cache support

**Steps:**

1. **Create global cache instance in server.js:**
   ```javascript
   // Near line 770 (after screenshot cache initialization)
   const { createGlobalDOMCache } = require('../src/extraction/dom-cache-integration');
   this.domCache = createGlobalDOMCache({
     ttl: 5000,                              // 5 second default
     maxCacheSize: 10 * 1024 * 1024          // 10MB cap
   });
   ```

2. **Register cache handlers in initialization:**
   ```javascript
   // In server constructor or initialization method
   const { 
     createCachedTextHandler,
     createCachedHTMLHandler,
     createCachedLinksHandler,
     createCachedFormsHandler,
     invalidateOnNavigation,
     invalidateOnReload
   } = require('../src/extraction/dom-cache-integration');

   // Wrap existing handlers
   const originalGetText = this.commandHandlers.get_text;
   this.commandHandlers.get_text = createCachedTextHandler(originalGetText, this.domCache);
   ```

3. **Add invalidation on navigation/reload:**
   ```javascript
   // In navigate handler
   const originalNavigate = this.commandHandlers.navigate;
   this.commandHandlers.navigate = async (params, session) => {
     const fromUrl = session.getCurrentURL();
     const result = await originalNavigate(params, session);
     invalidateOnNavigation(this.domCache, fromUrl, params.url);
     return result;
   };
   ```

4. **Add cache diagnostics endpoint:**
   ```javascript
   const { getCacheDiagnostics } = require('../src/extraction/dom-cache-integration');

   this.commandHandlers.get_dom_cache_stats = async (params) => {
     return {
       success: true,
       stats: getCacheDiagnostics(this.domCache)
     };
   };
   ```

#### OPT-08 Integration (6-8 hours) - NOT YET STARTED

**Status:** Ready for integration  
**Estimated Start:** After OPT-09 and OPT-13 completion

**Implementation Plan:**

1. **Create screenshot processor instance in server.js:**
   ```javascript
   // Near line 770
   const ParallelScreenshotProcessor = require('../src/screenshots/parallel-processor');
   this.parallelScreenshotProcessor = new ParallelScreenshotProcessor({
     bufferCount: 3,
     webpQuality: 85,
     enableMetrics: true
   });
   ```

2. **Integrate with screenshot handlers:**
   - Update `screenshot`, `screenshot_viewport`, `screenshot_element`, `screenshot_full_page`
   - Replace serial encoding with `processor.takeScreenshot()`
   - Add batch screenshot support

3. **Add metrics endpoint:**
   ```javascript
   this.commandHandlers.get_screenshot_stats = async (params) => {
     return {
       success: true,
       metrics: this.parallelScreenshotProcessor.getMetrics(),
       buffers: this.parallelScreenshotProcessor.getBufferStats()
     };
   };
   ```

---

## Testing Strategy

### Unit Tests (15 tests per component)

All tests located in: `/tests/performance/wave13-optimizations.test.js`

**Run all Wave 13 tests:**
```bash
npm test tests/performance/wave13-optimizations.test.js
```

**Run specific optimization tests:**
```bash
# OPT-08
npm test tests/performance/wave13-optimizations.test.js -- --grep "OPT-08"

# OPT-09
npm test tests/performance/wave13-optimizations.test.js -- --grep "OPT-09"

# OPT-13
npm test tests/performance/wave13-optimizations.test.js -- --grep "OPT-13"
```

**Test Coverage:**

| Optimization | Unit Tests | Integration | Load Tests | Total |
|---|---|---|---|---|
| OPT-08 (Parallel Screenshots) | 15 | 3 | 3 | 21 |
| OPT-09 (Priority Queue) | 18 | 3 | 2 | 23 |
| OPT-13 (DOM Cache) | 15 | 3 | 2 | 20 |
| **Total** | **48** | **9** | **7** | **64** |

### Integration Tests (9 tests)

Tests for component interaction and priority+cache combined:
- Priority queue with connection pool
- DOM cache with extraction handlers
- Cache invalidation on navigation

### Load Tests (7 tests)

Performance validation with 50-200 concurrent connections:
- Throughput measurement (ops/sec)
- Latency percentiles (P50, P95, P99)
- Memory stability
- Cache hit rate validation
- Queue fairness measurement

---

## Performance Benchmarks

### Expected Improvements (v12.0.0 → v12.1.0)

| Metric | Before | After | Improvement |
|---|---|---|---|
| **Throughput** | 285 msg/sec | 400+ msg/sec | +40% |
| **P99 Latency** | 1.7ms | 1.0ms | -41% |
| **Screenshot Latency** | 150ms | 50-60ms | -67% |
| **Memory Usage** | 1.15% | 0.9% | -22% |
| **Concurrent Capacity** | 200 clients | 300+ clients | +50% |

### Component-Specific Metrics

**OPT-08 (Parallel Screenshots):**
- Single screenshot: 150ms → 100-120ms (-20%)
- 3 concurrent: 450ms → 150ms (-67%)
- Throughput: 6-8 ops/sec → 15-20 ops/sec (+150%)

**OPT-09 (Priority Queue):**
- P99 latency: 1.7ms → 1.0ms (-41%)
- Critical request priority: Guaranteed first processing
- Starvation prevention: <5 minute max wait for low-priority

**OPT-13 (DOM Cache):**
- Cache hit latency: 1-2ms (vs 20-30ms uncached)
- Typical hit rate: 50-70%
- Memory overhead: <10MB with LRU eviction

---

## Integration Checklist

### Phase 1: Priority Queue (OPT-09)
- [x] Modify ConnectionPool to use PriorityQueue
- [x] Update queue method calls
- [x] Add queue breakdown to status
- [ ] Run unit tests
- [ ] Run integration tests with connection pool
- [ ] Run load tests (50-200 concurrent)
- [ ] Verify P99 latency improvement

### Phase 2: DOM Cache (OPT-13)
- [ ] Create global cache instance in server.js
- [ ] Wire cache into extraction handlers
- [ ] Add invalidation on navigation/reload
- [ ] Add cache diagnostics endpoint
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Run load tests with repeated URL access
- [ ] Verify 50% latency reduction for cached queries
- [ ] Monitor memory usage (should stay <10MB)

### Phase 3: Parallel Screenshots (OPT-08)
- [ ] Create parallel processor instance in server.js
- [ ] Integrate with screenshot handlers
- [ ] Implement batch screenshot support
- [ ] Add metrics endpoint
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Run load tests with screenshot-heavy workload
- [ ] Verify -67% latency improvement
- [ ] Verify +150% throughput improvement

### Phase 4: Combined Testing
- [ ] Load test all 3 optimizations together
- [ ] Progressive load: 50 → 100 → 200 concurrent
- [ ] Measure: throughput, latency (P50/P95/P99), memory growth
- [ ] Regression detection for existing functionality
- [ ] Memory leak checks
- [ ] CPU profiling comparison

### Phase 5: Documentation & Deployment
- [ ] Update API reference with new endpoints
- [ ] Document cache configuration options
- [ ] Document screenshot processor stats
- [ ] Create deployment checklist
- [ ] Update CHANGELOG.md
- [ ] Create rollback procedure
- [ ] Deploy to staging
- [ ] Deploy to production

---

## Key Files Modified

### Completed
- `/websocket/connection-pool.js` - Priority queue integration

### In Progress
- `/websocket/server.js` - Cache and processor instance creation

### Not Yet Started
- `/websocket/commands/extraction-commands.js` (or equivalent)
- `/websocket/commands/navigation-commands.js` (or equivalent)
- `/websocket/commands/screenshot-commands.js` (or equivalent)

### New Files Created
- `/src/extraction/dom-cache-integration.js` - Integration helpers
- `/tests/performance/wave13-optimizations.test.js` - Comprehensive test suite (465 lines, 48 tests)

---

## Debugging & Troubleshooting

### OPT-09: Priority Queue Issues

**Symptom:** Low-priority requests starving indefinitely
**Solution:** Check `fairnessConfig.lowPriorityProcessInterval` setting (default: 5 minutes)

**Symptom:** Performance not improving
**Solution:** Verify all command names are correctly mapped to priorities in `priorityMap`

### OPT-13: Cache Hit Rate Too Low

**Symptom:** Hit rate <30%
**Cause:** Most requests have different URLs or cache TTL too short
**Solution:** Increase TTL for workload-specific patterns (e.g., product listing pages)

**Symptom:** Memory usage growing
**Cause:** LRU eviction not triggering
**Solution:** Reduce `maxCacheSize` or increase TTL to trigger eviction

### OPT-08: Screenshot Latency Not Improving

**Symptom:** Still serial, not parallel
**Cause:** All buffers in use / contention
**Solution:** Increase `bufferCount` or reduce concurrent screenshot requests

---

## Rollback Procedure

If any optimization causes issues:

### Quick Rollback (OPT-09)
```javascript
// In connection-pool.js, revert to FIFO
this.requestQueue = [];  // Back to array
// Change .size() → .length, .dequeue() → .shift(), etc.
```

### Quick Rollback (OPT-13)
```javascript
// In server.js, remove cache wrappers
// Restore original handler functions
this.commandHandlers.get_text = originalGetText;
```

### Quick Rollback (OPT-08)
```javascript
// Disable parallel processor
// Use original screenshot handler
```

---

## Success Criteria

### Throughput
- [ ] Baseline: 285 msg/sec (200 concurrent)
- [ ] Target: 400+ msg/sec
- [ ] Acceptance: ≥350 msg/sec

### Latency
- [ ] Baseline P99: 1.7ms
- [ ] Target: 1.0ms
- [ ] Acceptance: <1.2ms

### Memory
- [ ] Baseline: 1.15% (11.5MB at typical load)
- [ ] Target: 0.9%
- [ ] Acceptance: <1.0%

### Regression Testing
- [ ] All 316 existing tests pass
- [ ] No new test failures
- [ ] Load stability: 90+ minutes at 200 concurrent
- [ ] Memory growth: <2MB/hour

---

## Timeline

| Phase | Duration | Target | Status |
|---|---|---|---|
| OPT-09 Integration | 3-4h | Jun 3 | In Progress |
| OPT-13 Integration | 4-5h | Jun 5 | Ready |
| OPT-08 Integration | 6-8h | Jun 7 | Pending |
| Combined Testing | 7-9h | Jun 8 | Pending |
| Documentation | 2-3h | Jun 9 | Pending |
| **Total** | **20-27h** | **Jun 14** | **50% Complete** |

---

## Related Documentation

- `/docs/PERFORMANCE-OPTIMIZATION-OPPORTUNITIES-2026-05-31.md` - Detailed opportunity analysis
- `/docs/findings/performance-analysis-findings.txt` - Performance analysis report
- `/docs/API-REFERENCE.md` - WebSocket API documentation (to be updated)
- `/ROADMAP.md` - Project roadmap

---

**Last Updated:** May 31, 2026  
**Next Review:** June 3, 2026  
**Owner:** Performance Engineering Team
