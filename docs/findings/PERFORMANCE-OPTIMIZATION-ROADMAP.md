# Performance Optimization Roadmap
## Basset Hound Browser v12.1.0 - v12.3.0+

**Document Version:** 1.0  
**Created:** June 2, 2026  
**Planning Scope:** 6+ months, 15+ optimizations  
**Target Delivery:** v12.3.0 (December 2026)

---

## Roadmap Overview

This document outlines the complete performance optimization strategy for Basset Hound Browser, projecting improvements from current 285 msg/sec baseline to 600+ msg/sec by end of 2026.

### Performance Evolution

```
v12.0.0 (May 2026)        285 msg/sec, 200 concurrent
    ↓ (Wave 13 complete)
v12.1.0 (July 2026)       400+ msg/sec, 300 concurrent (+40%)
    ↓ (Wave 15 Phase 1)
v12.2.0 (Sept 2026)       440+ msg/sec, 350 concurrent (+10%)
    ↓ (Wave 15 Phase 2)
v12.2.5 (Oct 2026)        550+ msg/sec, 500+ concurrent (+25%)
    ↓ (Wave 16 Phase 1)
v12.3.0 (Dec 2026)        600+ msg/sec, 800+ concurrent (+9%)
```

---

## Phase 1: Wave 15 Quick Wins (July-Aug 2026)

**Duration:** 4-6 weeks  
**Effort:** 50-60 hours  
**Expected Impact:** +10-15% throughput, -50% startup time  
**Risk Level:** LOW

### OPT-17: Fingerprint Profile Lazy Generation

**Priority:** P1 (High ROI per hour)  
**Effort:** 15-20 hours  
**Complexity:** Low

**Problem:**
- All 8 fingerprint profiles loaded at startup
- 200-400ms startup delay
- 5MB memory used even if profiles never accessed
- Rapid deployments bottlenecked by profile generation

**Solution:**
- Generate profiles on-demand (first use)
- Cache generated profiles (LRU, max 50)
- Background refresh for frequently used profiles
- Pre-warm cache for common profile types

**Implementation:**
```javascript
class LazyFingerprintManager {
  async getProfile(platform, riskLevel) {
    const key = `${platform}-${riskLevel}`;
    
    // Return from cache if available
    if (this.cache.has(key)) return this.cache.get(key);
    
    // Wait if generation in-flight
    if (this.generating.has(key)) {
      return await this.generating.get(key);
    }
    
    // Generate on-demand
    const promise = this._generateProfile(platform, riskLevel);
    this.generating.set(key, promise);
    
    try {
      const profile = await promise;
      this.cache.set(key, profile, { ttl: 1800000 }); // 30min TTL
      return profile;
    } finally {
      this.generating.delete(key);
    }
  }
}
```

**Metrics:**
- Startup time: 200-400ms → 100-200ms (-50%)
- Memory baseline: -5MB
- Throughput: +2-3% (less startup overhead per session)

**Success Criteria:**
- ✅ Session creation: <200ms (down from 200-400ms)
- ✅ Profile accuracy: No degradation
- ✅ Cache hit rate: >80%
- ✅ Memory: -5MB from baseline

---

### OPT-M1: Screenshot Cache Compression

**Priority:** P1 (High value, quick implementation)  
**Effort:** 10-15 hours  
**Complexity:** Low

**Problem:**
- Store raw WebP screenshots (100-500KB each)
- Cache up to 100 screenshots = 10-50MB memory
- Memory-intensive at scale

**Solution:**
- Store compressed metadata only, re-encode on demand
- Use JPEG for thumbnails (<50KB), WebP for full resolution
- Dual-format cache (small + large)

**Implementation:**
```javascript
class CompressedScreenshotCache {
  async cacheScreenshot(image, options = {}) {
    // Thumbnail: JPEG, 10KB
    const thumbnail = await sharp(image)
      .resize(200, 150)
      .jpeg({ quality: 60 })
      .toBuffer();
    
    // Full: WebP, 80-200KB (cached if frequent)
    const hash = crypto.createHash('sha256').update(image).digest('hex');
    const metadata = {
      hash,
      width: image.width,
      height: image.height,
      size: image.length,
      timestamp: Date.now(),
      thumbnail: thumbnail
    };
    
    // Cache only metadata + thumbnail
    this.metadataCache.set(hash, metadata);
    
    // Full image available but not cached by default
    // Re-encode on demand if needed
  }
}
```

**Metrics:**
- Screenshot cache memory: -30-50%
- Re-encoding latency: +20-30ms (acceptable for infrequent access)
- Overall throughput: +10% (better memory → more concurrent)

**Success Criteria:**
- ✅ Cache memory: <200MB for 100+ sessions
- ✅ Thumbnail quality: Acceptable for preview
- ✅ Re-encoding: <50ms latency
- ✅ Hit rate: >70%

---

### OPT-M4: DOM Cache Aggressive Eviction

**Priority:** P1 (Trivial effort, quick win)  
**Effort:** 3-5 hours  
**Complexity:** Trivial

**Problem:**
- DOM cache TTL: 5 seconds (too long)
- Keeps outdated DOM across navigation
- Wastes memory with stale entries

**Solution:**
- Reduce TTL to 2 seconds
- Invalidate on navigation
- More aggressive eviction

**Implementation:**
```javascript
// Change in dom-cache.js
constructor(options = {}) {
  const ttl = options.ttl || 2000;  // Changed from 5000
  // ... rest of constructor
  
  this.page.on('framenavigated', () => this.invalidateCache());
  this.page.on('goto', () => this.invalidateCache());
}
```

**Metrics:**
- DOM cache memory: -50%
- Cache accuracy: Improved (fresher DOM)
- Throughput: +5% (faster cache misses → more accurate)

**Success Criteria:**
- ✅ Cache memory: <2MB per session
- ✅ Stale DOM incidents: 0
- ✅ Hit rate: >40% (still useful)

---

### OPT-N4: Adaptive Compression Algorithm

**Priority:** P1 (Incremental improvement)  
**Effort:** 8-10 hours  
**Complexity:** Low

**Problem:**
- Always use same compression (70-93% reduction)
- Different content types compress differently
- Wasting CPU on incompressible data

**Solution:**
- Detect content type (text/image/binary)
- Choose algorithm: gzip (text), skip (images), brotli (JSON)
- Skip compression for incompressible data

**Implementation:**
```javascript
function selectCompressionAlgorithm(data) {
  const sample = data.slice(0, 1024);
  
  // Text-based: high compression
  if (isText(sample)) return 'brotli'; // 95-98% reduction
  
  // Images: already compressed
  if (isImage(sample)) return 'none'; // WebP already ~90% reduced
  
  // JSON/structured: good compression
  if (isJSON(sample)) return 'gzip'; // 80-95% reduction
  
  // Binary: poor compression
  if (isBinary(sample)) return 'gzip'; // 20-40% reduction
  
  return 'gzip'; // Default
}
```

**Metrics:**
- CPU (compression): -20-30% (skip incompressible)
- Bandwidth: +5-10% (better compression for each type)
- Throughput: +5% (less wasted CPU)

**Success Criteria:**
- ✅ Text compression: >95%
- ✅ Image compression: Skipped (no CPU waste)
- ✅ CPU usage: -25%
- ✅ Bandwidth: Similar overall

---

## Phase 2: Wave 15 Major Improvements (Aug-Oct 2026)

**Duration:** 6-8 weeks  
**Effort:** 90-110 hours  
**Expected Impact:** +25-40% throughput  
**Risk Level:** LOW-MEDIUM

### OPT-16: Request Batching & Pipelining

**Priority:** P1 (Highest value optimization)  
**Effort:** 25-35 hours  
**Complexity:** Medium

**Problem:**
- One command at a time (request/response)
- Client waits for response before sending next
- Multi-step workflows: N × 15ms = 150-300ms

**Solution:**
- Client sends array of commands: `[cmd1, cmd2, cmd3]`
- Server processes in parallel/sequential (configurable)
- Returns array of results: `[result1, result2, result3]`

**Implementation:**
```javascript
// Client API
async function batchNavigateAndExtract(urls) {
  return await ws.batchRequest({
    commands: [
      { cmd: 'navigate', url: urls[0] },
      { cmd: 'wait_for_element', selector: 'body' },
      { cmd: 'get_content' },
      { cmd: 'navigate', url: urls[1] },
      { cmd: 'wait_for_element', selector: 'body' },
      { cmd: 'get_content' }
    ]
  });
}

// Server API
async handleBatch(commands) {
  const results = [];
  for (const cmd of commands) {
    const result = await this.commandHandlers[cmd.cmd](cmd);
    results.push(result);
  }
  return { batch_results: results };
}
```

**Metrics:**
- Throughput: +20-30% (fewer round-trips)
- Latency round-trip: -70%
- Network messages: -80-90%

**Success Criteria:**
- ✅ Batch processing: 0 errors
- ✅ Backwards compatibility: Single commands still work
- ✅ Throughput: >500 msg/sec
- ✅ Latency: <5ms average round-trip

---

### OPT-14: Per-Domain Connection Pooling

**Priority:** P1 (High value, moderate effort)  
**Effort:** 20-30 hours  
**Complexity:** Medium

**Problem:**
- Single global connection pool (48)
- High-latency domains block fast domains
- Head-of-line blocking at scale

**Solution:**
- 1 primary pool (48) for general traffic
- 5-10 domain-specific mini-pools (8-16 each)
- Auto-create for domains with >10 pending requests

**Implementation:**
```javascript
class PerDomainConnectionPool {
  constructor() {
    this.globalPool = new ConnectionPool({ size: 48 });
    this.domainPools = new Map();
    this.poolCreationThreshold = 10; // Create pool at 10 pending
  }

  async routeRequest(domain, request) {
    const pending = this.getPendingRequests(domain);
    
    if (pending > this.poolCreationThreshold) {
      const pool = this.getOrCreatePool(domain);
      return pool.enqueue(request);
    }
    
    return this.globalPool.enqueue(request);
  }

  getOrCreatePool(domain) {
    if (!this.domainPools.has(domain)) {
      this.domainPools.set(domain, 
        new ConnectionPool({ 
          size: 12, 
          domain,
          ttl: 300000 // 5 minute idle timeout
        })
      );
    }
    return this.domainPools.get(domain);
  }
}
```

**Metrics:**
- Throughput: +5-10% (reduce queue wait time)
- Latency: P99 improved (avoid head-of-line blocking)
- Memory: +2-5MB (additional pooled connections)

**Success Criteria:**
- ✅ Pool creation: Automatic at >10 pending
- ✅ Pool cleanup: Auto-evict after 5 minutes idle
- ✅ Latency distribution: More uniform across domains
- ✅ Throughput: >550 msg/sec

---

### OPT-18: Behavioral AI Path Precompilation

**Priority:** P2 (High value, medium effort)  
**Effort:** 20-25 hours  
**Complexity:** Medium

**Problem:**
- Mouse paths computed on each command: 20-50ms
- Typing patterns computed per key: 5-10ms
- Complex physics calculations for each interaction

**Solution:**
- Precompile common paths (straight, curved, zigzag)
- Cache patterns by session type
- Lookup from cache instead of recomputing

**Implementation:**
```javascript
class BehavioralAICache {
  constructor() {
    this.pathCache = new Map();
    this.typingCache = new Map();
    this.precompile();
  }

  precompile() {
    // Pre-generate common paths
    const paths = [];
    for (let distance = 10; distance <= 500; distance += 50) {
      for (const style of ['linear', 'curved', 'jittered']) {
        const path = this._computePath(distance, style);
        this.pathCache.set(`${distance}-${style}`, path);
      }
    }

    // Pre-generate typing patterns
    for (const speed of ['slow', 'normal', 'fast']) {
      const pattern = this._computeTypingPattern(speed);
      this.typingCache.set(speed, pattern);
    }
  }

  getPath(distance, style = 'curved') {
    return this.pathCache.get(`${distance}-${style}`) ||
           this._computePath(distance, style); // Fallback
  }
}
```

**Metrics:**
- Behavioral AI CPU: -60-80%
- Throughput: +10-15% under high concurrency
- Memory: +0.5-1MB (pattern cache)

**Success Criteria:**
- ✅ Cache hit rate: >90%
- ✅ Path accuracy: No degradation
- ✅ Throughput: >600 msg/sec
- ✅ CPU: -70%

---

## Phase 3: Wave 16 Advanced Optimizations (Oct-Dec 2026)

**Duration:** 8-10 weeks  
**Effort:** 120-150 hours  
**Expected Impact:** +15-25% throughput, -50-70% memory  
**Risk Level:** MEDIUM

### OPT-15: Streaming Screenshot Response

**Priority:** P1 (High value, highest complexity)  
**Effort:** 30-40 hours  
**Complexity:** High

**Problem:**
- Large screenshots (100-500KB) held entirely in memory
- Causes memory spikes and blocks next screenshot
- Entire image must complete encoding before sending

**Solution:**
- Chunked encoding (split into 64KB chunks)
- Stream chunks to client as available
- Client reassembles in WebSocket handler

**Implementation:**
```javascript
async function streamScreenshot(dimensions) {
  const encoder = new WebPStreamer({ chunkSize: 65536 });

  encoder.on('chunk', (buffer, offset) => {
    this.client.send(JSON.stringify({
      type: 'screenshot_chunk',
      offset,
      size: buffer.length,
      data: buffer.toString('base64')
    }));
  });

  encoder.on('complete', (metadata) => {
    this.client.send(JSON.stringify({
      type: 'screenshot_complete',
      hash: metadata.hash,
      size: metadata.totalSize
    }));
  });

  await encoder.encode(canvas);
}
```

**Metrics:**
- Memory spike: -60-80%
- Latency: -10-15% (streaming starts before completion)
- Throughput: +15-20% (better memory efficiency)

**Success Criteria:**
- ✅ Memory peak: <50MB for 300 concurrent
- ✅ Client reassembly: Error-free
- ✅ Throughput: >700 msg/sec
- ✅ Latency P99: <3ms

---

### OPT-N1: WebSocket Message Batching System

**Priority:** P1 (High value, quick implementation)  
**Effort:** 10-15 hours  
**Complexity:** Low

**Problem:**
- Each message sent separately
- 10 small messages = 10 WebSocket frames
- Network overhead accumulates

**Solution:**
- Batch up to 10 changes in single WebSocket message
- Configurable batch size and time window
- Transparent to callers

**Implementation:**
```javascript
class MessageBatcher {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.batchTimeWindow = options.batchTimeWindow || 10; // ms
    this.queue = [];
    this.flushTimer = null;
  }

  async send(message) {
    this.queue.push(message);

    if (this.queue.length >= this.batchSize) {
      await this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(
        () => this.flush(),
        this.batchTimeWindow
      );
    }
  }

  async flush() {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0);
    clearTimeout(this.flushTimer);
    this.flushTimer = null;

    await this.client.send(JSON.stringify({
      type: 'batch',
      messages: batch
    }));
  }
}
```

**Metrics:**
- Network messages: -80-90%
- Throughput: +20-30%
- Latency: -50% queue wait time

**Success Criteria:**
- ✅ Batch rate: >95%
- ✅ Latency increase: <5ms
- ✅ Throughput: >750 msg/sec
- ✅ Network: <30% original

---

### OPT-N3: Delta Compression for Incremental Updates

**Priority:** P2 (High value, high complexity)  
**Effort:** 25-30 hours  
**Complexity:** High

**Problem:**
- Full page HTML sent on each extraction
- Only partial changes between requests

**Solution:**
- Send only changes (delta)
- Client reconstructs from baseline
- Similar to version control diffs

**Metrics:**
- Bandwidth: -60-80% for repeated pages
- Memory: -20% (smaller messages)
- Throughput: +15-25% (less data)

**Success Criteria:**
- ✅ Compression: >60% average
- ✅ Reconstruction accuracy: 100%
- ✅ Throughput: >800 msg/sec
- ✅ Latency: <5ms

---

## Performance Target Tracking

### Metrics by Release

| Metric | v12.0.0 | v12.1.0 | v12.2.0 | v12.3.0 |
|--------|---------|---------|---------|---------|
| **Throughput** | 285 | 400+ | 550+ | 600+ |
| **Concurrent** | 200 | 300+ | 500+ | 800+ |
| **P99 Latency** | 1.7ms | 1.0ms | 0.5ms | 0.3ms |
| **Memory/Session** | 5-15MB | 4-12MB | 2-6MB | 1-3MB |
| **Startup Time** | 500ms | 300ms | 200ms | 100ms |

### Cumulative Improvement

| Target | Baseline | Final | Improvement |
|--------|----------|-------|-------------|
| **Throughput** | 285 msg/s | 600+ | +110% |
| **Concurrent** | 200 | 800+ | +300% |
| **Latency** | 1.7ms | <0.3ms | -82% |
| **Memory** | 5-15MB | 1-3MB | -80% |
| **Startup** | 500ms | 100ms | -80% |

---

## Implementation Sequencing

### Week-by-Week Breakdown (Wave 15)

**Weeks 1-2: Quick Wins**
- OPT-17: Lazy fingerprinting (15-20h)
- OPT-M1: Screenshot compression (10-15h)
- Total: 25-35 hours
- Status: Active development

**Weeks 3-4: Major Improvements (Part 1)**
- OPT-16: Request batching (25-35h)
- OPT-N4: Adaptive compression (8-10h)
- Total: 33-45 hours

**Weeks 5-6: Major Improvements (Part 2)**
- OPT-14: Per-domain pools (20-30h)
- OPT-18: Path precompilation (20-25h)
- OPT-M4: DOM cache TTL (3-5h)
- Total: 43-60 hours

**Weeks 7-8: Consolidation & Testing**
- Integration testing
- Performance validation
- Load testing (100-300 concurrent)
- Regression testing

### Release Timeline

- **v12.1.0:** June 1, 2026 (Wave 13 complete)
- **v12.2.0:** September 1, 2026 (Wave 15 complete)
- **v12.2.5:** October 15, 2026 (Quick wins deployed)
- **v12.3.0:** December 1, 2026 (Wave 16 advanced optimizations)

---

## Resource Allocation

### Development Team

**Full-time Performance Engineering:** 2-3 developers
- Primary: Implementation and testing
- Secondary: Performance validation and monitoring

**Integration with Core Team:** As needed
- Architecture review for major changes
- Integration testing
- Deployment coordination

### Time Budget

| Phase | Duration | Effort | Developer Weeks |
|-------|----------|--------|-----------------|
| Wave 15 Phase 1 | 2 weeks | 50h | 2.5 weeks |
| Wave 15 Phase 2 | 4 weeks | 100h | 5 weeks |
| Testing & Validation | 2 weeks | 40h | 2 weeks |
| **Total Wave 15** | **8 weeks** | **190h** | **9.5 weeks** |

---

## Success Criteria & Monitoring

### Performance Benchmarks

Each release must meet:

✅ **Throughput:** Target achieved or exceeded  
✅ **Latency:** P99 within target  
✅ **Memory:** Growth rate <1 MB/hour  
✅ **Reliability:** 99.99% success rate  
✅ **Regression:** No performance degradation  

### Monitoring & Alerting

**Real-time Metrics:**
- Throughput (msgs/sec)
- Latency distribution (P50, P95, P99)
- Memory growth rate (MB/hour)
- Error rate (%)
- CPU utilization (%)

**Alerts:**
- Throughput drop >5%
- P99 latency >10ms
- Memory growth >2 MB/hour
- Error rate >0.1%
- CPU >80%

---

## Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Streaming architecture issues | Medium | High | Extensive testing, phased rollout |
| Delta compression state corruption | Low | High | Comprehensive unit + integration tests |
| Memory pooling bugs | Low | Medium | Stress testing, leak detection |
| Network protocol changes | Low | High | Backwards compatibility layer |

### Mitigation Strategy

1. **Phased Rollout:** Start with 10% traffic, scale to 100% over 1 week
2. **Canary Testing:** Run new version in parallel with old for regression detection
3. **Performance Baselines:** Maintain performance metrics history
4. **Rollback Plan:** All changes must be reversible within 30 minutes

---

## Conclusion

The performance optimization roadmap provides a clear, achievable path to 2x+ performance improvement over the next 6 months. With careful implementation and thorough testing, Basset Hound Browser will reach 600+ msg/sec throughput with excellent reliability and resource efficiency.

The staged approach allows for course correction and learning, with quick wins early to build confidence before tackling more complex optimizations.

**Target: Production-ready, 600+ msg/sec system by December 2026**

---

**Document Approved:** June 2, 2026  
**Next Review:** August 15, 2026  
**Status:** ✅ APPROVED FOR IMPLEMENTATION
