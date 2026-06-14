# Phase 1 Performance Optimizations - Implementation Guide
**Date:** June 13, 2026  
**Target:** 285 → 400+ msg/sec (+40% throughput)  
**Estimated Duration:** 10-15 hours total  
**Complexity:** Medium (existing infrastructure, integration-heavy)

---

## Quick Reference: Implementation Order

```
Start → OPT-5 (2-3h) → OPT-4 (2-3h) → OPT-1 (4-6h) → OPT-2 (5-6h) → OPT-3 (3-4h) → Testing → Done
```

---

## OPT-5: Connection Pool Tuning (2-3 hours)

### Overview
Adjust connection pool parameters for optimal throughput under load. This is a configuration-only change with immediate testability.

### Files to Modify
- **Primary:** `/home/devel/basset-hound-browser/websocket/connection-pool.js`

### Current Configuration (Lines 41-43)
```javascript
this.maxQueueSize = poolSize * 10; // Allow queue up to 10x pool size
this.backpressureThreshold = poolSize * 8; // Trigger backpressure at 8x
```

### Implementation Steps

#### Step 1: Benchmark Current State
```bash
cd /home/devel/basset-hound-browser
npm run test:batch:performance
# Record baseline metrics:
# - Throughput at 50, 100, 200 concurrent
# - Queue depth at peak load
# - P95/P99 latency
```

#### Step 2: Adjust Pool Parameters
Edit `/home/devel/basset-hound-browser/websocket/connection-pool.js`:

```javascript
// Line 22: Change constructor
constructor(poolSize = 20, executeHandler) {  // Was: 16, now 20
  this.poolSize = poolSize;
  this.activeConnections = 0;
  this.requestQueue = new PriorityQueue();
  this.executeHandler = executeHandler;

  // Lines 31-43: Metrics and configuration
  this.metrics = {
    totalProcessed: 0,
    peakConcurrency: 0,
    avgQueueWait: 0,
    queueWaitSamples: [],
    totalQueueWaitMs: 0,
    rejectedRequests: 0
  };

  // Configuration - TUNE THESE VALUES
  this.maxQueueSize = poolSize * 10;      // 200 (was 160)
  this.backpressureThreshold = poolSize * 7.5; // 150 (was 128)
  
  // NEW: Adaptive tuning parameters
  this.metricsWindow = 60000; // 1 minute window
  this.targetLatency = 50; // Target P95 latency in ms
  this.adaptiveScaling = false; // Set to true after testing
}
```

#### Step 3: Add Optional Monitoring
In the `_executeRequest()` method, add latency tracking:

```javascript
async _executeRequest(request) {
  this.activeConnections++;
  
  if (this.activeConnections > this.metrics.peakConcurrency) {
    this.metrics.peakConcurrency = this.activeConnections;
  }

  try {
    const startTime = Date.now();
    request.executeTime = startTime;
    
    // Log queue depth at peak concurrency
    if (this.activeConnections === this.metrics.peakConcurrency) {
      const queueSize = this.requestQueue.size();
      console.log(`[PoolMetrics] Peak concurrency: ${this.activeConnections}, Queue: ${queueSize}`);
    }
    
    // Rest of method...
```

#### Step 4: Test & Validate
```bash
# Test at 50 concurrent
npm run test:batch:performance -- --concurrent=50

# Test at 100 concurrent
npm run test:batch:performance -- --concurrent=100

# Test at 200 concurrent (full load)
npm run test:batch:performance -- --concurrent=200

# Compare with baseline:
# Expected: 5-10% throughput improvement
# Rejection rate: <1%
# Queue stability: Peak depth <50
```

### Validation Checklist
- [ ] Pool size increased from 16 → 20
- [ ] Max queue increased from 160 → 200
- [ ] Backpressure threshold adjusted to 150
- [ ] Latency improvement verified at high concurrency
- [ ] Rejection rate <1% across all test levels
- [ ] Memory usage stable (no growth)
- [ ] Zero functional regressions

### Rollback Procedure
If issues occur, revert to original values:
```javascript
constructor(poolSize = 16, executeHandler) {  // Revert to 16
  // ...
  this.maxQueueSize = poolSize * 10;      // 160
  this.backpressureThreshold = poolSize * 8; // 128
}
```

### Expected Results
- Throughput: 285 → 315 msg/sec (+10.5%)
- Queue depth: More stable at peak load
- Rejection rate: <1%

---

## OPT-4: WebSocket Compression Tuning (2-3 hours)

### Overview
Verify and optimize WebSocket per-message-deflate compression settings for optimal bandwidth reduction with minimal latency impact.

### Files to Modify
- **Primary:** `/home/devel/basset-hound-browser/websocket/server.js` (search for compression config)

### Current State
The ws module typically has default compression settings. Need to find and verify them.

### Implementation Steps

#### Step 1: Locate Compression Configuration
```bash
grep -n "perMessageDeflate\|compression\|deflate" /home/devel/basset-hound-browser/websocket/server.js
```

#### Step 2: Verify Current Settings
Look for WebSocket server initialization (typically in server startup):
```javascript
// Expected location - search around line 1500-2000 in server.js
const server = new WebSocket.Server({
  // ... other config ...
  perMessageDeflate: {
    zlibDeflateOptions: {
      // Current settings (may vary)
    },
    zlibInflateOptions: {
      // Current settings (may vary)
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024 // Min size to compress
  }
});
```

#### Step 3: Benchmark Baseline Compression
Create a quick test:
```javascript
// Add to server.js or test file
const zlib = require('zlib');

function benchmarkCompression(data, level) {
  const before = data.length;
  const compressed = zlib.deflateSync(data, { level });
  const after = compressed.length;
  const ratio = ((1 - after/before) * 100).toFixed(1);
  console.log(`Level ${level}: ${before}B → ${after}B (${ratio}% reduction)`);
}

// Test with sample payloads
const jsonPayload = JSON.stringify({ large: new Array(1000).fill({data: 'test'}) });
const screenshotPayload = 'x'.repeat(100000); // 100KB

console.log('=== Compression Benchmarks ===');
[1, 3, 5, 6, 9].forEach(level => {
  console.log(`\nCompression Level ${level}:`);
  benchmarkCompression(jsonPayload, level);
  benchmarkCompression(screenshotPayload, level);
});
```

#### Step 4: Optimal Settings
Based on testing, update compression configuration:
```javascript
// Recommended settings for balance of compression ratio and CPU overhead
perMessageDeflate: {
  zlibDeflateOptions: {
    level: 4,  // Balance: 3-5 optimal (lower = faster, higher = better ratio)
    memLevel: 8,
    strategy: 'default'
  },
  zlibInflateOptions: {
    chunkSize: 10 * 1024  // 10KB chunks
  },
  clientNoContextTakeover: true,
  serverNoContextTakeover: true,
  serverMaxWindowBits: 15,  // Full 32KB window
  concurrencyLimit: 10,
  threshold: 1024  // Only compress >1KB messages
}
```

#### Step 5: Test CPU Overhead
Monitor CPU while running load tests:
```bash
# Terminal 1: Monitor CPU
top -b -n 1 | grep node

# Terminal 2: Run load test
npm run test:batch:performance -- --duration=60

# Check CPU usage - should be <5% additional
```

#### Step 6: Validate Compression Effectiveness
```bash
# Test with and without compression enabled
# Measure message sizes at application level
npm run test:batch:performance -- --measure-compression

# Expected:
# - Small JSON: 20-30% reduction
# - Large payloads (>10KB): 70-90% reduction
# - Overall: 40-60% average reduction
```

### Validation Checklist
- [ ] Compression settings located and documented
- [ ] Baseline compression ratio measured
- [ ] Level 4 (or optimal from testing) confirmed
- [ ] CPU overhead <5%
- [ ] Latency impact <5% (acceptable)
- [ ] Large payloads compress to 70-90%
- [ ] Client-side decompression working correctly
- [ ] Test suite passes with compression enabled

### Rollback Procedure
Disable compression if issues arise:
```javascript
// Set perMessageDeflate to false
const server = new WebSocket.Server({
  perMessageDeflate: false
});
```

### Expected Results
- Message size reduction: 40-60% average
- Throughput: 285 → 295 msg/sec (+3.5% from reduced network overhead)
- CPU overhead: <5%

---

## OPT-1: Priority Queue Full Deployment (4-6 hours)

### Overview
Complete integration of the existing priority queue framework into the main WebSocket server message handling loop. This is the most impactful optimization.

### Files to Modify
1. **Fix import:** `/home/devel/basset-hound-browser/websocket/connection-pool.js` (line 17)
2. **Integrate:** `/home/devel/basset-hound-browser/websocket/server.js` (message handler)
3. **Verify:** `/home/devel/basset-hound-browser/websocket/priority-queue.js` (already complete)

### Current State
- Priority queue fully implemented in `websocket/priority-queue.js` (511 lines)
- Connection pool attempting to use it (but import path may be wrong)
- Server.js NOT using priority queue in message loop

### Implementation Steps

#### Step 1: Fix Import Path
In `/home/devel/basset-hound-browser/websocket/connection-pool.js` line 17:

**Current:**
```javascript
const { PriorityQueue } = require('../src/queuing/priority-queue');
```

**Change to:**
```javascript
const PriorityQueue = require('./priority-queue');
```

Then verify the export at the bottom of `/home/devel/basset-hound-browser/websocket/priority-queue.js`:
```javascript
module.exports = PriorityQueue;  // Should be this (not destructured)
```

#### Step 2: Verify Priority Queue Functionality
Test that priority queue works correctly:
```bash
# Create quick test
cat > /tmp/test-pq.js << 'EOF'
const PriorityQueue = require('/home/devel/basset-hound-browser/websocket/priority-queue.js');

const pq = new PriorityQueue();

// Enqueue requests with different priorities
(async () => {
  const ping = { command: 'ping' };
  const screenshot = { command: 'screenshot' };
  const navigation = { command: 'navigate', data: { url: 'http://example.com' } };

  // Enqueue in order: ping, screenshot, nav
  // Should process: screenshot (critical), nav (high), ping (low)
  
  console.log('Testing priority queue...');
  
  // This is async, just verify no errors
  pq.enqueue(ping).catch(() => {});
  pq.enqueue(screenshot).catch(() => {});
  pq.enqueue(navigation).catch(() => {});
  
  console.log('Queue size:', pq.size());
  console.log('Next request priority:', pq.getNextRequest().priority);
  
  setTimeout(() => {
    console.log('✓ Priority queue working');
    process.exit(0);
  }, 100);
})();
EOF

node /tmp/test-pq.js
```

#### Step 3: Integrate into WebSocket Server

The server message handler needs to use the priority queue instead of FIFO processing. Find the main message handler in `server.js` (search for something like `ws.on('message'`):

**Current pattern (FIFO):**
```javascript
ws.on('message', async (rawMessage) => {
  try {
    const message = JSON.parse(rawMessage);
    // Process immediately in FIFO order
    const result = await handleCommand(message);
    ws.send(JSON.stringify(result));
  } catch (error) {
    // Error handling
  }
});
```

**New pattern (Priority Queue):**
```javascript
// At server initialization
const commandQueue = new PriorityQueue();

// Message handler
ws.on('message', async (rawMessage) => {
  try {
    const message = JSON.parse(rawMessage);
    
    // Queue the request (async, but don't await immediately)
    commandQueue.enqueue(message)
      .then(result => {
        ws.send(JSON.stringify(result));
      })
      .catch(error => {
        ws.send(JSON.stringify({
          success: false,
          error: error.message
        }));
      });
  } catch (parseError) {
    ws.send(JSON.stringify({
      success: false,
      error: 'Invalid JSON'
    }));
  }
});

// Process queue continuously
setInterval(() => {
  const nextRequest = commandQueue.getNextRequest();
  if (nextRequest) {
    handleCommand(nextRequest.originalRequest)
      .then(result => {
        commandQueue.completeRequest(nextRequest.id, result);
      })
      .catch(error => {
        commandQueue.failRequest(nextRequest.id, error);
      });
  }
}, 10); // Process queue every 10ms
```

#### Step 4: Verify All Commands Are Classified
The priority queue has a `getCommandPriority()` method that classifies commands. Verify all 164 WebSocket commands are properly classified:

```bash
grep -h "\.on('message'\\|'command':" /home/devel/basset-hound-browser/websocket/commands/*.js | \
  grep -o "'[a-z_]*'" | sort -u | wc -l
# Should match the 164 commands mentioned in project memory
```

Check that critical commands are in the priority queue's list (around line 179):
```javascript
const criticalCommands = [
  'screenshot', 'screenshot_viewport', 'screenshot_full_page',
  'screenshot_element', 'screenshot_diff',
  'get_content', 'get_html', 'get_text',
  'extract_text', 'extract_html', 'extract_links',
  'extract_images', 'extract_forms', 'extract_metadata',
  'get_page_content', 'get_all_links'
];
```

If any critical commands are missing, add them.

#### Step 5: Test Priority Queue Integration

Create a test to verify queue behavior:
```bash
cat > /tmp/test-queue-integration.js << 'EOF'
const PriorityQueue = require('/home/devel/basset-hound-browser/websocket/priority-queue.js');

async function testPriorityOrdering() {
  const pq = new PriorityQueue();
  
  // Enqueue mixed priority requests
  const requests = [
    { command: 'ping', priority: 'low' },
    { command: 'screenshot', priority: 'critical' },
    { command: 'ping', priority: 'low' },
    { command: 'navigate', priority: 'high' },
    { command: 'screenshot', priority: 'critical' }
  ];
  
  for (const req of requests) {
    await pq.enqueue(req);
  }
  
  // Verify processing order
  const order = [];
  while (!pq.isEmpty()) {
    const next = pq.getNextRequest();
    if (next) {
      order.push(`${next.priority}:${next.command}`);
    }
  }
  
  console.log('Processing order:', order);
  // Expected: critical, critical, high, low, low
}

testPriorityOrdering();
EOF

node /tmp/test-queue-integration.js
```

#### Step 6: Benchmark Before/After

```bash
# Baseline (before priority queue)
npm run test:batch:performance -- --label="OPT-1-before"

# After integration
npm run test:batch:performance -- --label="OPT-1-after"

# Compare metrics:
# - Throughput should increase 10-15%
# - P95 latency should drop to ~100ms (from ~150ms)
# - P99 latency should drop to 250-300ms (from ~500ms)
```

### Validation Checklist
- [ ] Import path fixed in connection-pool.js
- [ ] Priority queue exports verified correct
- [ ] Queue integration into message handler complete
- [ ] All 164 commands classified into priority levels
- [ ] Critical commands (screenshots, extraction) in correct list
- [ ] Fairness ratio prevents starvation (testing)
- [ ] Benchmark shows 10-15% throughput improvement
- [ ] P95 latency <100ms verified
- [ ] P99 latency <300ms verified
- [ ] Full test suite passes

### Rollback Procedure
If issues occur, revert to FIFO processing:
```javascript
// Remove priority queue integration
// Restore original message handler
ws.on('message', async (rawMessage) => {
  const message = JSON.parse(rawMessage);
  const result = await handleCommand(message);
  ws.send(JSON.stringify(result));
});
```

### Expected Results
- P95 latency: 150ms → 100ms (33% improvement)
- P99 latency: 500ms → 250-300ms (40-50% improvement)
- Throughput: 285 → 315 msg/sec (+10%)

---

## OPT-2: Parallel Screenshot Processing (5-6 hours)

### Overview
Implement parallel GPU buffer management to process multiple concurrent screenshots simultaneously instead of serializing them.

### Files to Modify
1. **Main:** `/home/devel/basset-hound-browser/src/screenshots/parallel-processor.js`
2. **Buffer mgmt:** `/home/devel/basset-hound-browser/src/optimization/buffer-manager.js`
3. **Capture logic:** `/home/devel/basset-hound-browser/src/screenshots/enhanced-capture.js`
4. **Integration:** `/home/devel/basset-hound-browser/websocket/server.js`

### Current State
- Parallel processor exists but partially implemented
- Buffer manager exists but needs GPU-specific tuning
- Screenshot handler needs to route through parallel processor

### Implementation Steps

#### Step 1: Review Parallel Processor
```bash
head -100 /home/devel/basset-hound-browser/src/screenshots/parallel-processor.js
```

Document current structure and what needs to be added.

#### Step 2: Implement GPU Buffer Pool
In `/home/devel/basset-hound-browser/src/optimization/buffer-manager.js`, ensure it has:

```javascript
class GPUBufferPool {
  constructor(bufferCount = 3) {
    this.bufferCount = bufferCount;
    this.buffers = [];
    this.nextBufferId = 0;
    
    // Pre-allocate buffers at startup
    for (let i = 0; i < bufferCount; i++) {
      this.buffers.push({
        id: i,
        inUse: false,
        canvas: this.createOffscreenCanvas(1920, 1080),
        memoryUsage: 0
      });
    }
    
    // Track memory
    this.maxMemory = 250 * 1024 * 1024; // 250MB cap
    this.totalMemory = bufferCount * 50 * 1024 * 1024; // ~50MB per buffer
  }

  getNextAvailableBuffer() {
    // Round-robin allocation
    for (let i = 0; i < this.bufferCount; i++) {
      const bufferId = (this.nextBufferId + i) % this.bufferCount;
      const buffer = this.buffers[bufferId];
      
      if (!buffer.inUse) {
        this.nextBufferId = (bufferId + 1) % this.bufferCount;
        return buffer;
      }
    }
    
    // No buffer available (all busy)
    return null;
  }

  createOffscreenCanvas(width, height) {
    // Create OffscreenCanvas for rendering
    // Implementation depends on Electron version
    try {
      return new OffscreenCanvas(width, height);
    } catch {
      // Fallback
      return null;
    }
  }

  allocateBuffer() {
    let buffer = this.getNextAvailableBuffer();
    
    // Backpressure: wait if no buffer available
    if (!buffer) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          buffer = this.getNextAvailableBuffer();
          if (buffer) {
            clearInterval(checkInterval);
            buffer.inUse = true;
            resolve(buffer);
          }
        }, 5); // Check every 5ms
      });
    }
    
    buffer.inUse = true;
    return Promise.resolve(buffer);
  }

  releaseBuffer(buffer) {
    if (buffer) {
      buffer.inUse = false;
      buffer.memoryUsage = 0;
    }
  }

  getMetrics() {
    return {
      buffersInUse: this.buffers.filter(b => b.inUse).length,
      totalBuffers: this.bufferCount,
      totalMemory: this.totalMemory,
      maxMemory: this.maxMemory,
      utilizationPercent: 
        (this.buffers.filter(b => b.inUse).length / this.bufferCount * 100).toFixed(1)
    };
  }
}

module.exports = { GPUBufferPool };
```

#### Step 3: Update Screenshot Handler
In screenshot command handler (find in `/home/devel/basset-hound-browser/websocket/commands/screenshot-commands.js`):

```javascript
// Add buffer pool initialization
const { GPUBufferPool } = require('../../src/optimization/buffer-manager.js');
const screenshotBufferPool = new GPUBufferPool(3); // 3 parallel buffers

// Modify screenshot handler
async function handleScreenshot(session, options) {
  // Instead of: const result = await captureScreenshot(webContents);
  
  // Use: allocate buffer, capture, release
  const buffer = await screenshotBufferPool.allocateBuffer();
  
  try {
    const result = await captureScreenshotToBuffer(webContents, buffer, options);
    return result;
  } finally {
    screenshotBufferPool.releaseBuffer(buffer);
  }
}
```

#### Step 4: Add Memory Monitoring
Track GPU memory to prevent exhaustion:

```javascript
// In screenshot handler or middleware
async function handleScreenshotWithMemoryCheck(session, options) {
  const metrics = screenshotBufferPool.getMetrics();
  
  if (metrics.utilizationPercent >= 100) {
    // All buffers in use, apply backpressure
    console.warn('[Screenshot] Buffer pool fully utilized, adding request to queue');
    // Wait in queue, don't reject
  }
  
  if (metrics.totalMemory >= metrics.maxMemory * 0.9) {
    // 90% memory utilization, warn
    console.warn('[Screenshot] GPU memory at 90% capacity');
  }
  
  // Proceed with screenshot
  return handleScreenshot(session, options);
}
```

#### Step 5: Test Concurrent Screenshots

Create a stress test:
```javascript
// tests/performance/parallel-screenshot-stress.test.js
const assert = require('assert');

describe('Parallel Screenshot Processing', () => {
  it('should handle 3 concurrent screenshots', async () => {
    const startTime = Date.now();
    
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        websocketClient.send({
          command: 'screenshot'
        })
      );
    }
    
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    // All should succeed
    assert(results.every(r => r.success), 'All screenshots should succeed');
    
    // 3 concurrent should complete in ~150ms
    // vs 450ms serial (150ms each)
    console.log(`3 concurrent screenshots: ${duration}ms (target: <200ms)`);
    assert(duration < 200, 'Should complete in <200ms');
  });

  it('should track GPU buffer metrics', async () => {
    // Monitor buffer utilization
    const metrics = screenshotBufferPool.getMetrics();
    
    console.log('Buffer metrics:', metrics);
    assert(metrics.buffersInUse <= metrics.totalBuffers);
    assert(metrics.totalMemory <= metrics.maxMemory);
  });

  it('should handle 10 concurrent screenshot requests with backpressure', async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        websocketClient.send({
          command: 'screenshot'
        }).catch(err => ({ error: err.message }))
      );
    }
    
    const results = await Promise.all(promises);
    
    // Should NOT error, should queue
    const errors = results.filter(r => r.error);
    assert(errors.length === 0, 'Should queue, not error');
  });
});
```

#### Step 6: Benchmark Parallel vs Serial

```bash
# Baseline (serial)
npm run test:batch:performance -- --label="OPT-2-serial"

# After parallel implementation
npm run test:batch:performance -- --label="OPT-2-parallel"

# Expected:
# - 3 concurrent: 450ms → 150ms (3x)
# - Overall throughput: +15-20%
# - Memory stable (no leaks)
```

### Validation Checklist
- [ ] GPU buffer pool implemented (3-4 buffers)
- [ ] Round-robin allocation working
- [ ] Backpressure handling prevents memory exhaustion
- [ ] GPU memory capped at 250MB
- [ ] 3 concurrent screenshots complete in <200ms
- [ ] Memory monitoring shows no leaks
- [ ] Error handling for buffer exhaustion
- [ ] Full test suite passes
- [ ] Benchmark shows 15-20% improvement

### Rollback Procedure
Disable parallel processing (fall back to serial):
```javascript
// In screenshot handler, remove buffer pool
const result = await captureScreenshot(webContents, options);
// vs the parallel approach
```

### Expected Results
- 3 concurrent screenshots: 450ms → 150ms (3x improvement)
- Overall throughput: 285 → 340 msg/sec (+19%)
- GPU memory: +50MB increase (150MB total, acceptable)

---

## OPT-3: Fingerprint Template Caching (3-4 hours)

### Overview
Cache static fingerprint properties per profile to avoid expensive recomputation while maintaining session-specific randomization for evasion effectiveness.

### Files to Modify/Create
1. **Create:** `/home/devel/basset-hound-browser/src/evasion/fingerprint-template-cache.js`
2. **Modify:** `/home/devel/basset-hound-browser/src/evasion/device-fingerprinter.js`
3. **Test:** Create evasion regression tests

### Current State
- Fingerprinting system exists but regenerates full fingerprint per session
- Validator exists to check evasion effectiveness
- Need caching layer that maintains randomization

### Implementation Steps

#### Step 1: Understand Current Fingerprinting
```bash
grep -A 20 "generateFingerprint\|getFingerprint" \
  /home/devel/basset-hound-browser/src/evasion/device-fingerprinter.js | head -40
```

Document the current generation flow.

#### Step 2: Create Template Cache Module
Create `/home/devel/basset-hound-browser/src/evasion/fingerprint-template-cache.js`:

```javascript
/**
 * Fingerprint Template Cache
 * OPT-03: Cache static profile properties, regenerate session variance
 * 
 * Static (cached): WebGL vendor/renderer, fonts, plugins
 * Dynamic (session-specific): Canvas noise, audio fingerprint, timing
 */

class FingerprintTemplateCache {
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get or create fingerprint template for a profile
   */
  async getTemplate(profileId, profileData) {
    // Check cache
    if (this.cache.has(profileId)) {
      this.hitCount++;
      return this.cache.get(profileId);
    }

    // Cache miss - compute template
    this.missCount++;
    const template = await this._computeTemplate(profileData);
    
    // Cache with LRU eviction
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(profileId, template);
    return template;
  }

  /**
   * Compute static properties once per profile
   */
  async _computeTemplate(profileData) {
    return {
      // Static (computed once, cached)
      webgl: {
        vendor: profileData.webglVendor,
        renderer: profileData.webglRenderer,
        extensions: profileData.webglExtensions || []
      },
      fonts: profileData.fonts || [],
      plugins: profileData.plugins || [],
      
      // Session variance will be added per session
      // (not cached - must be random each time)
      sessionVariance: null // Will be populated per-session
    };
  }

  /**
   * Generate complete fingerprint with session variance
   */
  async generateSessionFingerprint(profileId, profileData) {
    // Get cached template
    const template = await this.getTemplate(profileId, profileData);
    
    // Add session-specific variance
    const fingerprint = {
      ...template,
      
      // Session-unique (regenerate each time)
      canvas: {
        noisePattern: this._generateCanvasNoise(),
        seed: Math.random()
      },
      
      audio: {
        contextState: this._generateAudioFingerprint(),
        variance: Math.random() * 0.01 // Small random variance
      },
      
      timing: {
        randomDelay: Math.random() * 50, // 0-50ms random
        jsRandom: Math.random()
      },
      
      // Session ID (unique per session)
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      
      // Timestamp (changes per session)
      timestamp: Date.now()
    };
    
    return fingerprint;
  }

  /**
   * Generate random canvas noise
   */
  _generateCanvasNoise() {
    // Canvas fingerprinting evasion: add slight noise each session
    return {
      pattern: Array(10).fill(0).map(() => Math.random()),
      offset: Math.random() * 256
    };
  }

  /**
   * Generate audio context fingerprint variance
   */
  _generateAudioFingerprint() {
    return {
      channelCount: 2,
      sampleRate: 44100 + Math.random() * 100, // Slight variation
      maxChannels: 32 + Math.random() * 10
    };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cachedProfiles: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hitCount + this.missCount > 0
        ? ((this.hitCount / (this.hitCount + this.missCount)) * 100).toFixed(1) + '%'
        : 'N/A',
      totalHits: this.hitCount,
      totalMisses: this.missCount
    };
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }
}

module.exports = { FingerprintTemplateCache };
```

#### Step 3: Integrate with Device Fingerprinter
Modify `/home/devel/basset-hound-browser/src/evasion/device-fingerprinter.js`:

```javascript
const { FingerprintTemplateCache } = require('./fingerprint-template-cache.js');

class DeviceFingerprinter {
  constructor() {
    // ... existing code ...
    this.templateCache = new FingerprintTemplateCache(50);
  }

  /**
   * Generate fingerprint for a session
   * Old: Full recomputation
   * New: Use cached template + session variance
   */
  async generateFingerprint(profileId, profileData) {
    // Use cache (static properties)
    // + regenerate session variance each time
    return this.templateCache.generateSessionFingerprint(profileId, profileData);
  }

  /**
   * For backward compatibility
   */
  getTemplateCache() {
    return this.templateCache;
  }
}
```

#### Step 4: Test Evasion Effectiveness (CRITICAL)

Create comprehensive evasion tests:
```javascript
// tests/evasion/fingerprint-caching-regression.test.js
const assert = require('assert');
const { DeviceFingerprinter } = require('../../src/evasion/device-fingerprinter.js');

describe('Fingerprint Caching - Evasion Regression Tests', () => {
  let fingerprinter;

  beforeEach(() => {
    fingerprinter = new DeviceFingerprinter();
  });

  it('should cache templates but generate unique session fingerprints', async () => {
    const profileId = 'chrome-windows';
    const profileData = {
      webglVendor: 'Google Inc.',
      webglRenderer: 'ANGLE (Intel HD Graphics 630)',
      fonts: ['Arial', 'Helvetica'],
      plugins: []
    };

    // Generate fingerprints for same profile
    const fp1 = await fingerprinter.generateFingerprint(profileId, profileData);
    const fp2 = await fingerprinter.generateFingerprint(profileId, profileData);

    // Static properties should match (cached)
    assert.strictEqual(fp1.webgl.vendor, fp2.webgl.vendor);
    assert.deepStrictEqual(fp1.fonts, fp2.fonts);

    // Session properties should differ (random)
    assert.notStrictEqual(fp1.sessionId, fp2.sessionId);
    assert.notStrictEqual(fp1.canvas.seed, fp2.canvas.seed);
    assert.notStrictEqual(fp1.timestamp, fp2.timestamp);
  });

  it('should show high cache hit rate in multi-session scenarios', async () => {
    const profileId = 'chrome-windows';
    const profileData = {
      webglVendor: 'Google Inc.',
      webglRenderer: 'ANGLE (Intel)',
      fonts: ['Arial'],
      plugins: []
    };

    // Generate 100 fingerprints for same profile
    for (let i = 0; i < 100; i++) {
      await fingerprinter.generateFingerprint(profileId, profileData);
    }

    const stats = fingerprinter.getTemplateCache().getStats();
    console.log('Cache stats:', stats);

    // Should have 1 miss (first time) and 99 hits
    assert(stats.hitRate >= '98%', 'Cache hit rate should be >98%');
  });

  it('should be undetectable by FingerprintJS', async () => {
    // This test requires FingerprintJS running
    // Skip if integration test environment unavailable
    
    const browserContext = await getBrowserContext();
    
    // Generate fingerprint and apply
    const profileData = { /* ... */ };
    const fingerprint = await fingerprinter.generateFingerprint('test', profileData);
    
    // Apply fingerprint to browser
    await applyFingerprintToBrowser(browserContext, fingerprint);

    // Check with FingerprintJS
    const detected = await checkWithFingerprintJS(browserContext);
    
    // Should vary each session (detection service)
    assert(detected.consistent === false, 'Fingerprint should vary per session');
  });

  it('should handle cache eviction with LRU', async () => {
    // Create cache with small size
    fingerprinter.templateCache = new FingerprintTemplateCache(5);

    // Generate fingerprints for 10 different profiles
    for (let i = 0; i < 10; i++) {
      const profileId = `profile-${i}`;
      const profileData = {
        webglVendor: `Vendor ${i}`,
        webglRenderer: `Renderer ${i}`,
        fonts: [],
        plugins: []
      };

      await fingerprinter.generateFingerprint(profileId, profileData);
    }

    const stats = fingerprinter.templateCache.getStats();
    console.log('Cache after eviction:', stats);

    // Should have exactly 5 entries (evicted first 5)
    assert.strictEqual(stats.cachedProfiles, 5, 'Should evict old entries');
  });

  it('should improve generation time compared to non-cached', async () => {
    const profileId = 'chrome-windows';
    const profileData = {
      webglVendor: 'Google Inc.',
      webglRenderer: 'ANGLE',
      fonts: ['Arial', 'Times'],
      plugins: []
    };

    // Warmup (fill cache)
    await fingerprinter.generateFingerprint(profileId, profileData);

    // Measure cached generation
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      await fingerprinter.generateFingerprint(profileId, profileData);
    }
    const cachedTime = Date.now() - start;

    console.log(`Cached: 100 fingerprints in ${cachedTime}ms (avg ${(cachedTime/100).toFixed(2)}ms)`);

    // Expected: <40ms per fingerprint (vs 100ms without cache)
    assert(cachedTime < 4000, 'Should complete 100 in <4000ms');
  });
});
```

#### Step 5: Performance Benchmark
```bash
# Before caching
npm run test:batch:performance -- --label="OPT-3-no-cache"

# After caching implementation
npm run test:batch:performance -- --label="OPT-3-with-cache"

# Expected improvement:
# - Session initialization: 150ms → 100ms (33%)
# - Fingerprint generation: 100ms → 40ms (60%)
```

### Validation Checklist
- [ ] Template cache module created and tested
- [ ] Device fingerprinter integrated with cache
- [ ] Static properties cached (WebGL, fonts, plugins)
- [ ] Session variance regenerated each call
- [ ] Session fingerprints are unique (tests verify)
- [ ] FingerprintJS still detects variation (critical test)
- [ ] Cache hit rate >98% in multi-session scenarios
- [ ] Cache eviction (LRU) working correctly
- [ ] Generation time improved 60% (100ms → 40ms)
- [ ] Full evasion test suite passes (NO regressions)

### CRITICAL: Evasion Effectiveness Testing
**MUST verify** that caching doesn't reduce evasion effectiveness:
```bash
# Run against real detection services
npm run test:bot-detection

# Expected: Detection evasion rate remains unchanged (85-90%)
# If rate drops: Cache is too aggressive, add more variance
```

### Rollback Procedure
If evasion effectiveness drops, remove caching:
```javascript
// In device-fingerprinter.js
async generateFingerprint(profileId, profileData) {
  // Remove caching, regenerate fully
  return this._generateFullFingerprint(profileData);
}
```

### Expected Results
- Fingerprint generation: 100ms → 40ms (60% improvement)
- Session initialization: 150ms → 100ms (33% improvement)
- Throughput: 285 → 295 msg/sec (+3.5%)
- Evasion effectiveness: UNCHANGED (must verify)

---

## Phase 1 Completion Checklist

### All Optimizations
- [ ] OPT-5: Connection pool tuning (2-3 hours)
- [ ] OPT-4: WebSocket compression (2-3 hours)
- [ ] OPT-1: Priority queue deployment (4-6 hours)
- [ ] OPT-2: Parallel screenshots (5-6 hours)
- [ ] OPT-3: Fingerprint caching (3-4 hours)

### Testing & Validation
- [ ] Baseline performance metrics collected
- [ ] Per-optimization metrics verified
- [ ] Combined performance target met (285 → 400+ msg/sec)
- [ ] All regressions tests passing
- [ ] Load tests passing at 200 concurrent
- [ ] Memory stability verified
- [ ] GC pause times acceptable

### Documentation
- [ ] Implementation status updated in this file
- [ ] Rollback procedures documented
- [ ] Metrics collected and analyzed
- [ ] Known issues documented
- [ ] Next steps for Phase 2 identified

### Ready for Phase 2
- [ ] All Phase 1 optimizations deployed
- [ ] Performance baseline established
- [ ] Team familiar with new systems
- [ ] Monitoring and alerting configured

---

## Quick Troubleshooting

### Issue: Priority queue import error
**Solution:** Verify both files export correct signature
```bash
grep "module.exports" /home/devel/basset-hound-browser/websocket/priority-queue.js
# Should be: module.exports = PriorityQueue;

grep "module.exports" /home/devel/basset-hound-browser/src/queuing/priority-queue.js
# Should be: module.exports = { PriorityQueue };
```

### Issue: Screenshot processing hangs
**Solution:** Implement timeout with backpressure
```javascript
const timeout = setTimeout(() => {
  buffer.inUse = false;
  throw new Error('Screenshot timeout');
}, 30000); // 30 second timeout
```

### Issue: Fingerprint varies too much (detection service detects pattern)
**Solution:** Reduce variance, add correlation
```javascript
// Less aggressive variance
canvas: {
  noisePattern: this._generateCanvasNoise(),
  seed: Math.random() * 0.001 // Smaller range
}
```

### Issue: Memory usage growing after optimization
**Solution:** Check for buffer leaks
```bash
# Monitor with heap profiler
NODE_OPTIONS="--expose-gc --heap-prof" npm start

# Analyze heap dumps
node --prof-process isolate-*.log > profile.txt
```

---

## Next Steps After Phase 1

1. **Collect metrics** for all optimizations
2. **Document results** in `PERF-PHASE1-STATUS.md`
3. **Review** for any regressions
4. **Plan Phase 2** (disk streaming, DOM caching)
5. **Prepare v12.1.0** release

---

**Document Complete**  
Ready for implementation by development team  
Last Updated: June 13, 2026
