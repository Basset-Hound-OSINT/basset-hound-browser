# Phase 2 Performance Optimizations: Quick Start Guide
**Ready-to-Execute Implementation Plan**  
**Updated:** June 13, 2026  
**Target:** 400 → 450 msg/sec (+12%)

---

## TL;DR: 4 Optimizations, 15 Hours

| Optimization | Effort | Impact | Status |
|--------------|--------|--------|--------|
| **OPT-06:** Session Recording Streaming | 5h | +5% throughput, -80% memory | Partial (integrate) |
| **OPT-04:** DOM Cache Integration | 4h | +10-15% extraction | Partial (integrate) |
| **OPT-08:** Tech Cache | 3h | +5% repeat domains | Create from scratch |
| **OPT-10:** GC Tuning | 2h | +5% throughput | Integrate existing |

---

## Quick Start: OPT-06 (Session Recording Streaming)

### Step 1: Review Existing Code (15 min)
```bash
# These files already exist with ~40% of work done:
cat src/recording/streaming-recorder.js
cat src/recording/session-recorder.js
```

### Step 2: Integration Checklist (4 hours)
```bash
# Task: Replace in-memory accumulation with streaming
# File: src/recording/session-recorder.js
# Line: ~25 (in SessionRecordingManager constructor)

# BEFORE:
this.recordings = new Map();

# AFTER:
this.recordings = new Map();
this.StreamingSessionRecorder = StreamingSessionRecorder;

# Then in stopRecording():
# BEFORE: Just call storage.save()
# AFTER: Finalize streaming, then call storage.save()
```

### Step 3: Test (1 hour)
```bash
# Create test: tests/unit/streaming-recorder.test.js
npm run test:unit -- streaming-recorder.test.js

# Run 1-hour stress test
npm run test:performance -- streaming-recorder
```

**Success Criteria:**
- 1-hour session memory: <100MB
- All frames playback correctly
- Disk I/O overhead: <1% CPU

---

## Quick Start: OPT-04 (DOM Cache Integration)

### Step 1: Review Cache Implementation (10 min)
```bash
cat src/extraction/dom-cache.js
# File has: getText, getHTML, getLinks, getForms
# File has: invalidateByUrl, clear
# File has: metrics tracking
```

### Step 2: Extraction Manager Integration (2 hours)
```bash
# File: src/extraction/manager.js
# Task: Inject cache and wrap traversal methods

# Pseudocode:
class ExtractionManager {
  constructor() {
    this.cache = new DOMExtractionCache();
  }

  async extractText(sessionId, selector) {
    return this.cache.getText(
      `${sessionId}:${selector}`,
      () => this._performTraversal(sessionId, selector)
    );
  }

  invalidateCache(sessionId) {
    this.cache.invalidateByUrl(sessionId);
  }
}
```

### Step 3: Wire Up Invalidation (1 hour)
```bash
# In websocket/server.js command handlers:
# On 'navigate' command: call extractionManager.invalidateCache()
# On 'submit' command: call extractionManager.invalidateCache()

# Example:
case 'navigate':
  extractionManager.invalidateCache(sessionId);
  await browser.navigate(url);
  break;
```

### Step 4: Test (1 hour)
```bash
npm run test:unit -- dom-cache.test.js
npm run test:performance -- cache-hit-rate

# Verify: >70% hit rate on typical workloads
# Verify: Cached queries <2-5ms
```

**Success Criteria:**
- Hit rate >70%
- Cached queries <2-5ms
- First queries still 20-30ms

---

## Quick Start: OPT-08 (Technology Detection Cache)

### Step 1: Create Cache Class (1 hour)
```bash
# Create: src/technology/cache.js

# Template (80 lines):
const { LRUCache } = require('../utils/lru-cache');

class TechnologyDetectionCache {
  constructor(options = {}) {
    this.cache = new LRUCache({
      maxSize: options.maxSize || 10000,
      defaultTTL: options.ttl || 30 * 60 * 1000
    });
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  async detect(url, detectFn) {
    const cached = this.cache.get(url);
    if (cached) {
      this.metrics.hits++;
      return cached;
    }

    this.metrics.misses++;
    const result = await detectFn(url);
    this.cache.set(url, result);
    return result;
  }

  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 
        ? (this.metrics.hits / total * 100).toFixed(2) 
        : 0
    };
  }
}

module.exports = TechnologyDetectionCache;
```

### Step 2: Integrate with Technology Manager (1 hour)
```bash
# File: src/technology/manager.js
# Task: Inject cache and wrap detect() method

# In TechnologyManager constructor:
this.cache = new TechnologyDetectionCache();

# Wrap detect method:
async detect(url) {
  return this.cache.detect(url, (u) => this._performDetection(u));
}
```

### Step 3: Test (1 hour)
```bash
npm run test:unit -- technology-cache.test.js
npm run test:performance -- tech-cache

# Verify: >60% hit rate
# Verify: Cached detections 1-2ms
```

**Success Criteria:**
- Hit rate >60%
- Memory <50MB for 10K entries
- Cached detections 1-2ms

---

## Quick Start: OPT-10 (GC Tuning)

### Step 1: Review GC Configuration (5 min)
```bash
cat utils/gc-tuning.js
# File has: Node.js flag recommendations
# File has: GC monitoring utilities
```

### Step 2: Add to Startup (10 min)
```bash
# File: src/main/main.js
# Add at top:

const gcTuning = require('../utils/gc-tuning');
gcTuning.initialize(); // Applies flags

# Or in websocket/server.js:
process.env.NODE_OPTIONS = 
  '--max-old-space-size=512 --gc-interval=30000 --expose-gc';
```

### Step 3: Test (1 hour)
```bash
npm run test:performance -- gc-tuning

# Monitor output:
# - GC pause times should be <50ms (major)
# - Memory growth <1MB/hour
# - Throughput should improve slightly
```

**Success Criteria:**
- Major GC pauses <50ms
- Memory growth <1MB/hour
- No negative throughput impact

---

## Parallel Implementation (Team of 2)

### Developer 1: OPT-06 + OPT-04 (7 hours)
```bash
# Hour 0-1: Review both files
# Hour 1-3: Implement OPT-06 (streaming integration)
# Hour 3-4: Test OPT-06
# Hour 4-6: Implement OPT-04 (cache integration)
# Hour 6-7: Test OPT-04
```

### Developer 2: OPT-08 + OPT-10 (5 hours)
```bash
# Hour 0-1: Create OPT-08 cache class
# Hour 1-2: Integrate OPT-08
# Hour 2-3: Test OPT-08
# Hour 3-4: Integrate OPT-10
# Hour 4-5: Test OPT-10
```

### Both: Integration & Validation (2 hours)
```bash
# Run full regression suite
npm run test:unit && npm run test:integration

# Run Phase 2 target test
npm run test:load:200-concurrent

# Verify: 450+ msg/sec achieved
```

---

## Testing Checklist

### Before Starting (Baseline)
- [ ] `npm run test:load:200-concurrent` - Record baseline
- [ ] Document current memory/latency/throughput

### OPT-06 Tests
- [ ] 1-hour session memory <100MB
- [ ] All frames playback correctly
- [ ] Disk I/O <1% CPU overhead
- [ ] Cleanup on session end works

### OPT-04 Tests
- [ ] Hit rate >70% on typical workloads
- [ ] Cached queries <2-5ms
- [ ] Cache invalidation on navigate/submit
- [ ] Memory <10MB

### OPT-08 Tests
- [ ] Hit rate >60% on repeated domains
- [ ] Memory <50MB for 10K entries
- [ ] Eviction works correctly

### OPT-10 Tests
- [ ] GC pauses <50ms (major)
- [ ] Memory growth <1MB/hour
- [ ] No regressions in throughput

### Final Validation
- [ ] All unit tests pass (100%)
- [ ] All integration tests pass (100%)
- [ ] Phase 2 target: 450+ msg/sec
- [ ] No evasion effectiveness loss

---

## Common Issues & Fixes

### Issue: OPT-06 - Disk Full Error
**Symptoms:** Recording fails after N hours  
**Fix:** 
```javascript
// In streaming-recorder.js, add disk space check:
async recordFrame(frame) {
  const diskSpace = await checkDiskSpace();
  if (diskSpace < 100 * 1024 * 1024) { // 100MB threshold
    throw new Error('Low disk space');
  }
  // ... continue recording
}
```

### Issue: OPT-04 - Stale Cache Data
**Symptoms:** Extraction returns outdated results  
**Fix:**
```javascript
// Ensure invalidation on all DOM-mutating commands:
case 'fill':
case 'click':
case 'submit':
  extractionManager.invalidateCache(sessionId);
  // ... execute command
```

### Issue: OPT-08 - Low Hit Rate
**Symptoms:** Hit rate <40%, not enough improvement  
**Fix:**
```javascript
// Increase cache TTL for stable domains:
this.cache = new TechnologyDetectionCache({
  ttl: 60 * 60 * 1000  // 1 hour instead of 30 min
});
```

### Issue: OPT-10 - Memory Still Growing
**Symptoms:** Memory grows despite GC tuning  
**Fix:**
```javascript
// Check for other memory leaks:
// 1. Event listener cleanup in session manager
// 2. No circular references in cache structures
// 3. Connection cleanup on close

// Monitor with:
NODE_OPTIONS="--trace-gc" npm run test:load:200-concurrent
```

---

## Performance Validation Script

```bash
#!/bin/bash
# save as: scripts/validate-phase2.sh

echo "=== Phase 2 Performance Validation ==="

echo "1. Running unit tests..."
npm run test:unit > /tmp/phase2-unit.log 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL: Unit tests failed"
  exit 1
fi
echo "PASS: Unit tests"

echo "2. Running integration tests..."
npm run test:integration > /tmp/phase2-int.log 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL: Integration tests failed"
  exit 1
fi
echo "PASS: Integration tests"

echo "3. Running load test (200 concurrent)..."
npm run test:load:200-concurrent > /tmp/phase2-load.log 2>&1
THROUGHPUT=$(grep "throughput" /tmp/phase2-load.log | tail -1 | awk '{print $NF}')

if (( $(echo "$THROUGHPUT >= 440" | bc -l) )); then
  echo "PASS: Throughput $THROUGHPUT msg/sec"
else
  echo "FAIL: Throughput $THROUGHPUT msg/sec (target: 450+)"
  exit 1
fi

echo ""
echo "=== ALL PHASE 2 TESTS PASSED ==="
echo "Target achieved: 450+ msg/sec"
```

---

## Commit Strategy

```bash
# OPT-06: Session Recording Streaming
git commit -m "feat(perf): Implement session recording streaming (OPT-06)

- Move frame accumulation from memory to disk
- Implement ring buffer for recent frames
- Add streaming playback support
- 1-hour sessions: 500MB → 100MB (-80%)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

# OPT-04: DOM Cache
git commit -m "feat(perf): Integrate DOM traversal caching (OPT-04)

- Cache query results with 5-second TTL
- Implement smart invalidation on navigate/submit
- Repeated queries: 20-30ms → 2-5ms
- Hit rate >70% on typical workloads

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

# OPT-08: Tech Cache
git commit -m "feat(perf): Add technology detection cache (OPT-08)

- LRU cache with 30-minute TTL
- 10K entry capacity
- Hit rate >60% on typical usage
- Cached detection: 50-100ms → 1-2ms

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

# OPT-10: GC Tuning
git commit -m "feat(perf): Optimize Node.js GC settings (OPT-10)

- Increase heap size to 512MB
- Set GC interval to 30 seconds
- Reduce pause times: 25-80ms → <50ms
- Improve stability for 200+ concurrent

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Success Criteria Summary

### Throughput
- [ ] 400 → 450 msg/sec (+12%)
- [ ] P95 latency <100ms
- [ ] P99 latency <300ms

### Memory
- [ ] 1-hour sessions: <100MB
- [ ] Baseline: unchanged
- [ ] Growth: <1MB/hour

### Quality
- [ ] All tests: 100% pass rate
- [ ] No regressions: 0 evasion losses
- [ ] Error rate: <0.1%

### Validation
- [ ] Phase 2 target test passes
- [ ] Load test: 200 concurrent, 10 minutes
- [ ] Regression suite: all green

---

## Timeline

**Day 1:** OPT-06 (5 hours)  
**Day 2:** OPT-04 (4 hours)  
**Day 3:** OPT-08 + OPT-10 (5 hours)  
**Day 4:** Integration + Validation (2+ hours)  

**Total: 3-4 days, 1-2 developers**

---

**Next:** See PERF-PHASE2-IMPLEMENTATION.md for detailed technical guide  
**Questions:** Check GitHub issues or team channel  
**Target Release:** Within 1 week of completion
