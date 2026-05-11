# Basset Hound Browser v11.3.0 - Optimization Roadmap
**Date:** May 11, 2026  
**Version:** 1.0  
**Status:** Ready for Implementation  

---

## Overview

This document defines prioritized optimization opportunities identified from performance profiling of v11.3.0. Optimizations are sequenced by impact, effort, and risk.

---

## Quick Reference: Optimization Matrix

```
                    LOW EFFORT        MEDIUM EFFORT       HIGH EFFORT
HIGH IMPACT         OPT-01           OPT-03, OPT-04       
                    OPT-02           OPT-06
                    OPT-07

MEDIUM IMPACT       OPT-08           OPT-05               
                    OPT-09           OPT-10

LOW IMPACT          OPT-11           OPT-12              OPT-13
```

---

## Sprint 1: Foundation (Weeks 1-2)

### OPT-01: WebSocket Message Compression
**Priority:** P0 (Critical path)  
**Impact:** 70-80% size reduction for large payloads  
**Effort:** 2-3 hours  
**Risk:** Low (standard WebSocket feature)

#### Description
Enable per-message-deflate extension on WebSocket connections to compress large JSON payloads, particularly screenshot responses and session recordings.

#### Implementation
**File:** `websocket/server.js`

```javascript
// Enable compression on WebSocket server
const wss = new WebSocket.Server({
  port: 8765,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024 // Only compress messages > 1KB
  }
});
```

#### Testing
- Benchmark message sizes before/after
- Verify with existing test suite
- Monitor CPU overhead of compression
- Test with real screenshot payloads

#### Success Criteria
- Screenshots compressed to 20-30% of original size
- CPU overhead <5%
- No latency increase for small messages

#### Blockers/Dependencies
None

---

### OPT-02: Screenshot Cache Compression
**Priority:** P0 (Quick win)  
**Impact:** 80-90% memory reduction per screenshot  
**Effort:** 2-3 hours  
**Risk:** Low

#### Description
Replace in-memory base64 screenshot storage with compressed on-disk storage. Maintain metadata and thumbnails in memory for fast access.

#### Implementation
**Files:** 
- `src/screenshots/enhanced-capture.js` (cache logic)
- `websocket/server.js` (response handling)

```javascript
// Screenshot cache with compression
class CompressedScreenshotCache {
  constructor(cacheDir = '.basset-hound/screenshots') {
    this.cacheDir = cacheDir;
    this.metadataCache = new Map(); // Keep metadata in memory
  }

  async saveScreenshot(sessionId, screenshot) {
    // Compress to WebP (better compression than PNG for screenshots)
    const filename = `${sessionId}-${Date.now()}.webp`;
    const filePath = path.join(this.cacheDir, filename);
    
    // Save compressed
    await sharp(Buffer.from(screenshot, 'base64'))
      .webp({ quality: 90 })
      .toFile(filePath);
    
    // Store metadata only
    this.metadataCache.set(filename, {
      path: filePath,
      size: fs.statSync(filePath).size,
      width: 1920, // From header
      height: 1080,
      timestamp: Date.now()
    });
  }

  async getScreenshot(filename) {
    const metadata = this.metadataCache.get(filename);
    if (!metadata) return null;
    
    // Load from disk on demand
    return fs.readFileSync(metadata.path, 'base64');
  }
}
```

#### Testing
- Compare memory usage: before vs. after
- Benchmark load/save performance
- Test with 100+ screenshots
- Verify compression ratios

#### Success Criteria
- Memory usage reduced 85%+
- Load time <100ms per screenshot
- No impact to existing API responses

#### Blockers/Dependencies
Requires disk I/O, test on SSD and HDD performance

---

### OPT-07: Garbage Collection Tuning
**Priority:** P1 (Stability)  
**Impact:** 5-15% more stable baseline  
**Effort:** 1 hour  
**Risk:** Low

#### Description
Optimize Node.js garbage collection settings for long-running browser process with many tab cycles.

#### Implementation
**File:** `package.json` (script) or `scripts/start.sh`

```bash
#!/bin/bash
# Optimized Node.js flags for long-running browser

node \
  --max-old-space-size=512 \
  --gc-interval=30000 \
  --expose-gc \
  websocket/server.js
```

#### Testing
- Monitor heap size over 24 hours
- Measure GC pause times
- Test with normal workload
- Verify no performance regression

#### Success Criteria
- More stable heap growth (<0.5MB/hour)
- GC pauses <100ms
- Memory baseline unchanged

#### Blockers/Dependencies
None

---

## Sprint 2: High-Volume Operations (Weeks 3-4)

### OPT-03: Parallel Screenshot Processing
**Priority:** P1 (High-volume scenarios)  
**Impact:** 2-3x throughput for concurrent screenshots  
**Effort:** 3-4 hours  
**Risk:** Medium (GPU resource contention)

#### Description
Implement parallel rendering buffers for screenshot capture to prevent serialization bottleneck when multiple screenshots requested concurrently.

#### Implementation
**File:** `src/screenshots/manager.js`

```javascript
class ScreenshotManager {
  constructor(poolSize = 3) {
    // Pre-allocate rendering buffers
    this.renderBuffers = Array(poolSize).fill(null).map(() => ({
      buffer: createOffscreenBuffer(),
      inUse: false,
      activeRequest: null
    }));
    this.nextBufferId = 0;
  }

  async captureScreenshot(webContents) {
    // Round-robin through available buffers
    let buffer = this.getNextAvailableBuffer();
    
    // Wait if all buffers in use
    while (!buffer) {
      await sleep(10);
      buffer = this.getNextAvailableBuffer();
    }
    
    buffer.inUse = true;
    
    try {
      const result = await this.renderToBuffer(webContents, buffer);
      return result;
    } finally {
      buffer.inUse = false;
    }
  }

  getNextAvailableBuffer() {
    // Try to find an available buffer in round-robin fashion
    for (let i = 0; i < this.renderBuffers.length; i++) {
      const bufferId = (this.nextBufferId + i) % this.renderBuffers.length;
      const buf = this.renderBuffers[bufferId];
      if (!buf.inUse) {
        this.nextBufferId = (bufferId + 1) % this.renderBuffers.length;
        return buf;
      }
    }
    return null;
  }
}
```

#### Testing
- Benchmark concurrent screenshot performance
- Test with 3, 5, 10 concurrent requests
- Monitor GPU memory usage
- Verify image quality unchanged

#### Success Criteria
- 3 concurrent screenshots: 150ms instead of 450ms
- GPU memory usage <200MB
- No image quality degradation

#### Blockers/Dependencies
May require GPU memory investigation if Electron doesn't expose multi-buffer API

---

### OPT-04: Session Recording Streaming
**Priority:** P1 (Long sessions)  
**Impact:** 70-80% memory reduction for hour+ sessions  
**Effort:** 4-5 hours  
**Risk:** Medium (data integrity)

#### Description
Stream session recording frames to disk (append-only log) instead of accumulating in memory. Keep only recent frames in memory for fast playback.

#### Implementation
**File:** `src/recording/session-recorder.js`

```javascript
class StreamingSessionRecorder {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.logPath = `data/sessions/${sessionId}/recording.jsonl`;
    this.memoryBuffer = []; // Keep last 10 frames
    this.maxMemoryFrames = 10;
    this.totalFrameCount = 0;
  }

  async recordFrame(frame) {
    // Write to disk
    fs.appendFileSync(
      this.logPath,
      JSON.stringify({
        frameId: this.totalFrameCount++,
        timestamp: Date.now(),
        ...frame
      }) + '\n'
    );

    // Keep recent frames in memory
    this.memoryBuffer.push(frame);
    if (this.memoryBuffer.length > this.maxMemoryFrames) {
      this.memoryBuffer.shift();
    }
  }

  async playback(startFrame = 0, endFrame = null) {
    // Stream from disk
    const readline = require('readline');
    const stream = fs.createReadStream(this.logPath);
    const rl = readline.createInterface({ input: stream });
    
    let frameNum = 0;
    for await (const line of rl) {
      if (frameNum >= startFrame && (endFrame === null || frameNum <= endFrame)) {
        yield JSON.parse(line);
      }
      frameNum++;
    }
  }
}
```

#### Testing
- Record 1-hour session, monitor memory
- Verify playback works correctly
- Test disk I/O performance
- Ensure data integrity

#### Success Criteria
- 1-hour session: <100MB memory vs 500MB before
- Playback latency <1 second from disk
- Zero frame loss

#### Blockers/Dependencies
Requires careful disk I/O management to avoid I/O contention

---

### OPT-06: Profile Object Deduplication
**Priority:** P2 (Multi-connection workloads)  
**Impact:** 90% memory reduction with 100+ connections  
**Effort:** 3-4 hours  
**Risk:** Medium (careful mutation handling)

#### Description
Share profile objects across connections instead of duplicating. Use read-only semantics to prevent accidental mutations.

#### Implementation
**File:** `websocket/server.js`

```javascript
// Global profile cache - shared across all connections
const globalProfileCache = new Map();

class ProfileManager {
  static getProfile(profileId) {
    if (!globalProfileCache.has(profileId)) {
      const profile = loadProfileFromDisk(profileId);
      globalProfileCache.set(profileId, Object.freeze(profile)); // Immutable
    }
    return globalProfileCache.get(profileId);
  }

  static getProfileCopy(profileId) {
    const original = this.getProfile(profileId);
    // Deep clone only if mutation needed
    return JSON.parse(JSON.stringify(original));
  }
}

// Usage
const readOnlyProfile = ProfileManager.getProfile(profileId);      // Reference
const mutableProfile = ProfileManager.getProfileCopy(profileId);  // Clone if needed
```

#### Testing
- Test with 100 concurrent connections
- Verify memory usage reduced
- Ensure no cross-connection mutations
- Validate profile integrity

#### Success Criteria
- 100 connections: 50MB memory vs 100MB before
- Profile operations still <1ms
- Zero cross-connection contamination

#### Blockers/Dependencies
Requires careful code review to prevent mutation bugs

---

## Sprint 3: Caching & Query Optimization (Weeks 5-6)

### OPT-05: DOM Traversal Caching
**Priority:** P2 (Repeated queries)  
**Impact:** 5-10x faster for repeated queries  
**Effort:** 3-4 hours  
**Risk:** Medium (cache invalidation)

#### Description
Cache DOM traversal results with TTL to avoid redundant re-computation when multiple text/HTML extractions happen on same page.

#### Implementation
**File:** `extraction/content-extractor.js` (new caching layer)

```javascript
class CachedContentExtractor {
  constructor() {
    this.cache = new Map(); // sessionId -> {content, timestamp}
    this.ttl = 5000; // 5 second TTL
  }

  async extractText(sessionId, selector = null) {
    const cacheKey = `text:${sessionId}:${selector || 'all'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.content;
    }

    // Perform extraction
    const result = await this._performExtraction(sessionId, selector);
    
    // Cache result
    this.cache.set(cacheKey, {
      content: result,
      timestamp: Date.now()
    });

    return result;
  }

  invalidateSession(sessionId) {
    // Clear all cache entries for session
    for (const key of this.cache.keys()) {
      if (key.includes(sessionId)) {
        this.cache.delete(key);
      }
    }
  }
}
```

#### Testing
- Benchmark repeated queries: before vs. after
- Test cache invalidation on page change
- Verify accuracy of cached results
- Test cache size under load

#### Success Criteria
- Repeated queries: 10x faster (5ms vs 50ms)
- Cache doesn't grow unbounded
- Zero stale data issues

#### Blockers/Dependencies
Requires robust cache invalidation strategy (detect page navigation)

---

### OPT-08: Evasion Fingerprint Template Caching
**Priority:** P2 (Session startup)  
**Impact:** 40-60% faster fingerprint generation  
**Effort:** 3-4 hours  
**Risk:** High (must maintain evasion effectiveness)

#### Description
Pre-compute fingerprint templates for each profile, varying only truly session-specific properties. Avoid re-computing static properties each session.

#### Implementation
**File:** `src/evasion/device-fingerprinter.js`

```javascript
class TemplatedFingerprinter {
  constructor() {
    this.templates = new Map();
    this.initializeTemplates();
  }

  initializeTemplates() {
    // Pre-compute static properties per profile
    for (const [profileId, profile] of Object.entries(PROFILES)) {
      this.templates.set(profileId, {
        // Static - computed once
        static: {
          webglVendor: profile.webglVendor,
          webglRenderer: profile.webglRenderer,
          plugins: profile.plugins,
          fonts: profile.fonts
        },
        // Session-specific - generated per session
        variableSlots: {
          canvasNoise: null,      // Varies each session
          audioNoise: null,
          timing: null
        }
      });
    }
  }

  async generateFingerprint(profileId) {
    const template = this.templates.get(profileId);
    if (!template) throw new Error(`Unknown profile: ${profileId}`);

    // Combine static template with session-specific data
    return {
      ...template.static,
      // Only generate session-varying properties
      canvas: await this.generateCanvasFingerprint(),
      audio: await this.generateAudioFingerprint(),
      // Avoid regenerating expensive properties
    };
  }
}
```

#### Testing
- Benchmark fingerprint generation time
- **CRITICAL:** Test evasion effectiveness after optimization
- Verify randomization still works
- Test against FingerprintJS, bot detection services

#### Success Criteria
- Fingerprint generation: 40-60% faster
- Evasion effectiveness: No regression
- Canvas/Audio still properly randomized

#### Blockers/Dependencies
**HIGH PRIORITY:** Must maintain evasion effectiveness. Test against known detection services before deploying.

---

### OPT-09: Screenshot Thumbnail Cache
**Priority:** P3 (Low-priority)  
**Impact:** 10-20x faster thumbnail generation  
**Effort:** 1-2 hours  
**Risk:** Low

#### Description
Cache low-quality thumbnails of recent screenshots for quick preview without full decompression.

#### Implementation
**File:** `src/screenshots/enhanced-capture.js`

```javascript
class ThumbnailCache {
  constructor(maxEntries = 50) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
  }

  async generateThumbnail(screenshot) {
    const hash = crypto.createHash('md5').update(screenshot).digest('hex');
    
    if (this.cache.has(hash)) {
      return this.cache.get(hash);
    }

    // Generate thumbnail (much faster than full processing)
    const thumbnail = await sharp(Buffer.from(screenshot, 'base64'))
      .resize(200, 200, { fit: 'cover', quality: 20 })
      .webp()
      .toBuffer();

    // Cache with LRU eviction
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(hash, thumbnail);

    return thumbnail;
  }
}
```

#### Testing
- Benchmark thumbnail generation
- Test cache hit/miss ratios
- Verify LRU eviction works
- Test with real workloads

#### Success Criteria
- Thumbnail generation: <50ms
- Cache hit rate: >70%
- Memory overhead: <50MB

#### Blockers/Dependencies
None

---

## Sprint 4: Advanced Optimizations (Weeks 7-8)

### OPT-10: Queue Priority System
**Priority:** P2 (Mixed workload)  
**Impact:** 20-40% P95 latency reduction  
**Effort:** 2-3 hours  
**Risk:** Low

#### Description
Implement priority queue to process critical operations (screenshots, content extraction) ahead of low-priority operations (status checks, logging).

#### Implementation
**File:** `websocket/connection-pool.js`

```javascript
class PriorityConnectionPool extends ConnectionPool {
  constructor(poolSize = 16, executeHandler) {
    super(poolSize, executeHandler);
    
    // Replace single queue with priority buckets
    this.requestQueue = {
      critical: [],   // P0: screenshot, extraction
      normal: [],     // P1: navigation, interaction
      low: []         // P2: status, logging
    };
  }

  getQueuePriority(command) {
    const criticalCommands = [
      'screenshot', 'screenshot_viewport', 'screenshot_full_page',
      'screenshot_element', 'get_content', 'extract_text', 'extract_html'
    ];
    
    const lowCommands = [
      'ping', 'list_tabs', 'get_status', 'get_console_logs'
    ];

    if (criticalCommands.includes(command)) return 'critical';
    if (lowCommands.includes(command)) return 'low';
    return 'normal';
  }

  async acquire(request) {
    // Assign priority
    request.priority = this.getQueuePriority(request.command);
    
    // ... rest of implementation
  }

  async _drainNextFromQueue() {
    // Drain by priority: critical -> normal -> low
    return (
      this.requestQueue.critical.shift() ||
      this.requestQueue.normal.shift() ||
      this.requestQueue.low.shift()
    );
  }
}
```

#### Testing
- Benchmark latency with mixed workloads
- Test priority order (critical before low)
- Verify fairness (low-priority jobs still complete)
- Test starvation prevention

#### Success Criteria
- Critical operations: P95 <100ms
- Low-priority operations: P95 <500ms
- No starvation (all jobs eventually run)

#### Blockers/Dependencies
None

---

### OPT-11: Memory Growth Monitoring
**Priority:** P1 (Operational)  
**Impact:** Early detection of memory leaks  
**Effort:** 2 hours  
**Risk:** Low

#### Description
Add automatic alerts for abnormal memory growth patterns to detect leaks in production.

#### Implementation
**File:** `logging/memory.js` (enhancement)

```javascript
class MemoryAnomalyDetector {
  constructor() {
    this.baseline = null;
    this.history = [];
    this.maxHistory = 100;
    this.growthThreshold = 0.5; // MB/hour
  }

  async checkAnomalies() {
    const current = process.memoryUsage();
    const sample = {
      heapMB: current.heapUsed / 1024 / 1024,
      timestamp: Date.now()
    };

    if (!this.baseline) {
      this.baseline = sample;
      return null;
    }

    this.history.push(sample);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Check growth rate
    const hourAgo = Date.now() - 3600000;
    const oldSamples = this.history.filter(s => s.timestamp < hourAgo);
    
    if (oldSamples.length > 0) {
      const growth = sample.heapMB - oldSamples[0].heapMB;
      const growthPerHour = growth; // Simple calculation
      
      if (growthPerHour > this.growthThreshold) {
        return {
          alert: 'HIGH_MEMORY_GROWTH',
          growthPerHour: growthPerHour.toFixed(2),
          currentHeap: sample.heapMB.toFixed(2),
          baselineHeap: this.baseline.heapMB.toFixed(2)
        };
      }
    }

    return null;
  }
}
```

#### Testing
- Test with normal workload (no alerts)
- Inject artificial memory leak, verify detection
- Test alert frequency (not too noisy)
- Verify baseline calculation

#### Success Criteria
- Detects >0.5MB/hour growth
- <5% false positive rate
- Alerts within 1 hour of anomaly start

#### Blockers/Dependencies
None

---

### OPT-12: Request Batching Framework
**Priority:** P3 (Future enhancement)  
**Impact:** 30-40% reduction in network overhead  
**Effort:** 4-5 hours  
**Risk:** Medium

#### Description
Allow clients to batch multiple operations in single WebSocket message to reduce message overhead and improve throughput for bulk operations.

#### Implementation
**File:** `websocket/server.js` (new handler)

```javascript
// Batch command: Execute multiple operations atomically
{
  command: 'batch',
  operations: [
    { command: 'navigate', args: { url: '...' } },
    { command: 'screenshot', args: { format: 'png' } },
    { command: 'get_text', args: { } }
  ],
  continueOnError: true
}
```

#### Testing
- Benchmark batch vs sequential
- Test with 10, 50, 100 operations
- Verify atomicity/ordering
- Test error handling

#### Success Criteria
- 100 operations: 5 seconds vs 25 seconds sequentially
- Error handling correct
- API remains backward compatible

#### Blockers/Dependencies
None

---

### OPT-13: Binary Protocol Alternative
**Priority:** P3 (Phase 2+)  
**Impact:** 50% additional message reduction  
**Effort:** 8-10 hours  
**Risk:** High (breaking change)

#### Description
Implement optional binary protocol using MessagePack for clients needing minimal latency (after message compression deployed and evaluated).

#### Implementation
**File:** `websocket/server.js` (new protocol handler)

- Requires new client library
- Keep JSON as default for compatibility
- Benchmark before deployment
- **NOT RECOMMENDED** until compression proven insufficient

#### Testing
- Compare binary vs JSON performance
- Verify backward compatibility
- Test with real workloads

#### Success Criteria
- 50% message size reduction
- <5ms overhead for format conversion
- No breaking changes for JSON clients

#### Blockers/Dependencies
**Major breaking change** - only if compression insufficient

---

## Implementation Checklist

### Pre-Deployment
- [ ] All optimizations have corresponding tests
- [ ] No performance regressions from optimization changes
- [ ] Memory leaks confirmed absent (24-hour test)
- [ ] All optimizations merge to main branch
- [ ] Documentation updated

### Deployment
- [ ] Gradual rollout (10% → 50% → 100%)
- [ ] Monitor performance metrics in production
- [ ] Set up alerts for anomalies
- [ ] Have rollback plan for each optimization
- [ ] Document any issues found in production

### Post-Deployment
- [ ] Collect production metrics
- [ ] Compare to baseline expectations
- [ ] Adjust tuning parameters if needed
- [ ] Plan next optimization sprint
- [ ] Share findings with team

---

## Performance Baselines

### Current Metrics (v11.3.0 - Before Optimizations)
- Command throughput: 6,522 cmd/sec
- Screenshot latency: 150-250ms
- Memory growth: <2MB/hour
- Navigation latency: 100-1357ms (network-bound)
- Response serialization: 1-3ms

### Target Metrics (After All Optimizations)
- Command throughput: 8,000+ cmd/sec (22% improvement)
- Screenshot latency: 50-150ms (50% reduction with parallelization)
- Memory growth: <0.5MB/hour (75% improvement)
- Response size: 20-30% of original (with compression)
- Navigation latency: Unchanged (network-bound)

---

## Success Criteria

Optimization is considered **successful** when:

1. **Performance improvements** meet or exceed targets
2. **No regressions** in unrelated functionality
3. **Stability maintained** (24+ hour stable operation)
4. **Production ready** (passes all test suites)
5. **Documented** (changes recorded in CHANGELOG)

---

## Rollback Strategy

Each optimization has a rollback plan:

1. **OPT-01 (Compression):** Disable `perMessageDeflate` in server config
2. **OPT-02 (Cache):** Revert to in-memory storage
3. **OPT-03 (Parallel Screenshots):** Revert to single buffer
4. **OPT-04 (Streaming):** Revert to in-memory buffer
5. **OPT-05 (DOM Cache):** Disable cache layer
6. **OPT-06 (Profile Dedup):** Revert to per-connection copies
7. **OPT-07 (GC Tuning):** Use default Node.js flags
8. **OPT-08 (Fingerprint Cache):** Revert to full generation
9. **OPT-09 (Thumbnails):** Disable thumbnail caching
10. **OPT-10 (Priority Queue):** Revert to FIFO queue

Each can be rolled back independently without affecting others.

---

## Timeline

- **Sprint 1 (Weeks 1-2):** Foundation - 6 hours total effort
- **Sprint 2 (Weeks 3-4):** High-volume ops - 12 hours total effort
- **Sprint 3 (Weeks 5-6):** Caching - 10 hours total effort
- **Sprint 4 (Weeks 7-8):** Advanced - 14 hours total effort

**Total Estimated Effort:** 42 hours (about 1 person-month)

---

## Next Steps

1. Review this roadmap with team
2. Select optimization focus based on production workloads
3. Create Jira/GitHub issues for each optimization
4. Assign owners and target dates
5. Plan testing strategy for each optimization
6. Set up monitoring/alerts for deployment

---

**Document Status:** Ready for Implementation  
**Last Updated:** May 11, 2026  
**Maintained By:** Performance Engineering Team
