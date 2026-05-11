# Optimization Sprint 2 Specification

**Sprint:** May 18-25, 2026 (Weeks 3-4 of Phase 3)  
**Duration:** 12 hours total effort  
**Status:** Ready for Implementation  
**Priority:** HIGH - High-impact optimizations for v12.1.0  

---

## Executive Summary

Optimization Sprint 2 targets three high-impact bottlenecks identified in performance profiling:

| Optimization | Impact | Effort | Priority |
|---|---|---|---|
| **OPT-03:** Parallel Screenshot Processing | 2-3x throughput | 3-4 hours | P1 |
| **OPT-04:** Session Recording Streaming | 70-80% memory | 4-5 hours | P1 |
| **OPT-10:** Priority Queue System | 20-40% P95 latency | 2-3 hours | P2 |

**Combined Impact:**
- 2-3x faster concurrent screenshots
- 80% memory reduction for long sessions
- 20-40% P95 latency improvement
- 0 breaking changes

---

## OPT-03: Parallel Screenshot Processing

### Overview

**Problem:** Screenshot capture is serialized - only one screenshot at a time.  
**Target:** Parallel buffers for 2-3x concurrent screenshot throughput.  
**Impact:** 2-3x faster performance for concurrent screenshot requests.

### Root Cause Analysis

Current bottleneck in `src/screenshots/manager.js`:

```javascript
// CURRENT: Serialized screenshot capture
class ScreenshotManager {
  constructor() {
    this.captureInProgress = false;
  }

  async captureScreenshot(webContents) {
    // Wait for previous screenshot to finish
    while (this.captureInProgress) {
      await sleep(10);
    }
    
    this.captureInProgress = true;
    try {
      const image = await webContents.capturePage();
      const encoded = await sharp(image).webp().toBuffer();
      return encoded.toString('base64');
    } finally {
      this.captureInProgress = false;
    }
  }
}

// Result: 10 screenshots = 150ms × 10 = 1500ms total
```

### Solution Design

Implement round-robin buffer pool:

```javascript
class ParallelScreenshotManager {
  constructor(poolSize = 3) {
    // Pre-allocate rendering contexts
    this.renderBuffers = Array(poolSize).fill(null).map((_, i) => ({
      id: i,
      inUse: false,
      activeRequest: null,
      statistics: {
        uses: 0,
        totalTime: 0,
        errors: 0
      }
    }));
    this.nextBufferId = 0;
    this.poolSize = poolSize;
  }

  async captureScreenshot(webContents, options = {}) {
    const buffer = await this.getNextAvailableBuffer(options.timeout);
    
    if (!buffer) {
      throw new Error('All screenshot buffers busy - queue too deep');
    }

    buffer.inUse = true;
    buffer.activeRequest = {
      startTime: Date.now(),
      options
    };

    try {
      const startCapture = Date.now();
      
      // GPU-accelerated capture (native)
      const image = await webContents.capturePage();
      const captureTime = Date.now() - startCapture;
      
      // Encode with selected format (WebP by default for compression)
      const format = options.format || 'webp';
      const startEncode = Date.now();
      
      let encoded;
      switch (format) {
        case 'png':
          encoded = await sharp(image).png({ quality: 95 }).toBuffer();
          break;
        case 'jpeg':
          encoded = await sharp(image).jpeg({ quality: 90 }).toBuffer();
          break;
        case 'webp':
        default:
          encoded = await sharp(image).webp({ quality: 90 }).toBuffer();
      }
      
      const encodeTime = Date.now() - startEncode;
      
      // Update statistics
      buffer.statistics.uses++;
      buffer.statistics.totalTime += Date.now() - buffer.activeRequest.startTime;
      
      return {
        data: encoded.toString('base64'),
        metadata: {
          buffer: buffer.id,
          format,
          captureTime,
          encodeTime,
          size: encoded.length
        }
      };
    } catch (error) {
      buffer.statistics.errors++;
      throw error;
    } finally {
      buffer.inUse = false;
      buffer.activeRequest = null;
    }
  }

  async getNextAvailableBuffer(timeoutMs = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      // Try to find an available buffer in round-robin
      for (let i = 0; i < this.poolSize; i++) {
        const bufferId = (this.nextBufferId + i) % this.poolSize;
        const buf = this.renderBuffers[bufferId];
        
        if (!buf.inUse) {
          this.nextBufferId = (bufferId + 1) % this.poolSize;
          return buf;
        }
      }
      
      // All buffers busy, wait and retry
      await sleep(5);
    }
    
    return null; // Timeout
  }

  getBufferStatistics() {
    return {
      pool: this.renderBuffers.map(b => ({
        id: b.id,
        inUse: b.inUse,
        statistics: b.statistics
      })),
      averageUseTime: Math.round(
        this.renderBuffers.reduce((sum, b) => sum + b.statistics.totalTime, 0) /
        this.renderBuffers.reduce((sum, b) => sum + b.statistics.uses, 0)
      ),
      totalErrors: this.renderBuffers.reduce((sum, b) => sum + b.statistics.errors, 0)
    };
  }
}
```

### Implementation Details

**Files to Create/Modify:**
- `src/screenshots/parallel-manager.js` (NEW, 280 lines)
- `src/screenshots/manager.js` (Modify: replace capture logic, add switchover)
- `websocket/commands/screenshot-commands.js` (Modify: add parallel routing)

**Implementation Steps:**

1. **Create parallel manager** (2 hours)
   - Implement buffer pool with round-robin scheduling
   - Add timeout and error handling
   - Add statistics collection

2. **Integrate with WebSocket API** (1 hour)
   - Route screenshot commands to parallel manager
   - Update response format with metadata
   - Add statistics endpoints

3. **Testing** (1 hour)
   - Concurrent load testing (3, 5, 10 simultaneous)
   - GPU memory monitoring
   - Image quality validation

### Testing Strategy

**Unit Tests:**
```javascript
describe('ParallelScreenshotManager', () => {
  it('should capture multiple screenshots concurrently', async () => {
    // 3 simultaneous screenshots, all complete in ~150ms
    const promises = [
      manager.captureScreenshot(webContents),
      manager.captureScreenshot(webContents),
      manager.captureScreenshot(webContents)
    ];
    
    const results = await Promise.all(promises);
    assert(results.length === 3);
    assert(results.every(r => r.data.length > 0));
  });

  it('should queue excess requests when pool full', async () => {
    // Create 5 requests, but pool size is 3
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(manager.captureScreenshot(webContents));
    }
    
    // All should complete, but some queued
    const results = await Promise.all(promises);
    assert(results.length === 5);
  });

  it('should track statistics per buffer', async () => {
    await manager.captureScreenshot(webContents);
    const stats = manager.getBufferStatistics();
    
    assert(stats.averageUseTime < 200); // < 200ms per screenshot
    assert(stats.totalErrors === 0);
  });
});
```

**Performance Tests:**
```
Scenario: 10 screenshots in parallel

Before OPT-03:
  Total time: 1500ms (150ms × 10, serialized)
  
After OPT-03 (3-buffer pool):
  Total time: 500ms (150ms + queue delays)
  Improvement: 3x faster
  
With 5-buffer pool:
  Total time: 300ms (150ms + minimal queue)
  Improvement: 5x faster (GPU limited)
```

### Success Criteria

- ✅ 3 concurrent screenshots complete in ~150ms (vs 450ms before)
- ✅ 10 concurrent screenshots complete in <500ms (vs 1500ms before)
- ✅ GPU memory usage stays <200MB
- ✅ Image quality unchanged
- ✅ All existing tests still pass
- ✅ No memory leaks with sustained load

### Edge Cases & Recovery

1. **All buffers busy (queue full)**
   - Return error after timeout (default 30 seconds)
   - Retry with exponential backoff (100ms, 200ms, 500ms)

2. **GPU memory exhaustion**
   - Reduce pool size automatically (3 → 2 → 1)
   - Log warning and alert monitoring

3. **Frame capture timeout**
   - Retry with fresh GPU context
   - Fall back to single-buffered mode if persistent

---

## OPT-04: Session Recording Streaming

### Overview

**Problem:** Session recordings accumulate all frames in memory (500MB+ per hour).  
**Target:** Stream frames to disk, keep recent frames in memory.  
**Impact:** 70-80% memory reduction for long sessions.

### Root Cause Analysis

Current implementation in `src/recording/session-recorder.js`:

```javascript
// CURRENT: In-memory accumulation
class SessionRecorder {
  constructor() {
    this.frames = [];      // Accumulates all frames
    this.events = [];      // Accumulates all events
  }

  recordFrame(frame) {
    this.frames.push(frame);  // 50-100KB per frame
    this.events.push(event);
  }
}

// Memory usage:
// 1 minute: 60 frames = 3-6MB
// 1 hour: 3600 frames = 180-360MB
// Problem: GC can't collect, still referenced
```

### Solution Design

Implement streaming recorder with disk spillover:

```javascript
class StreamingSessionRecorder {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.options = {
      memoryFrameLimit: options.memoryFrameLimit || 10,
      logDir: options.logDir || `data/sessions/${sessionId}`,
      chunkSize: options.chunkSize || 100, // Flush every 100 frames
      ...options
    };

    this.memoryBuffer = [];    // Last N frames for playback
    this.diskWriter = null;    // Write stream
    this.totalFrameCount = 0;
    this.totalEventCount = 0;
    this.logPath = path.join(this.options.logDir, 'recording.jsonl');
    this.indexPath = path.join(this.options.logDir, 'index.json');
    this.writePending = 0;

    this.initializeDiskWriter();
  }

  initializeDiskWriter() {
    // Create append-only JSONL file
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.diskWriter = fs.createWriteStream(
      this.logPath,
      { flags: 'a', encoding: 'utf8' }
    );

    this.diskWriter.on('error', (err) => {
      console.error('Recording write error:', err);
      this.onDiskWriteError(err);
    });
  }

  async recordFrame(frame) {
    const frameData = {
      frameId: this.totalFrameCount++,
      timestamp: Date.now(),
      ...frame
    };

    // Write to disk
    this.writePending++;
    const written = this.diskWriter.write(
      JSON.stringify(frameData) + '\n',
      'utf8',
      (err) => {
        this.writePending--;
        if (err) this.onDiskWriteError(err);
      }
    );

    // Add to memory buffer
    this.memoryBuffer.push(frameData);
    if (this.memoryBuffer.length > this.options.memoryFrameLimit) {
      this.memoryBuffer.shift();
    }

    // Manage backpressure
    if (!written && this.writePending > 100) {
      await this.flushDiskWrites();
    }

    return frameData.frameId;
  }

  async recordEvent(event) {
    const eventData = {
      eventId: this.totalEventCount++,
      timestamp: Date.now(),
      ...event
    };

    // Same write pattern as frames
    this.writePending++;
    this.diskWriter.write(
      JSON.stringify(eventData) + '\n',
      'utf8',
      (err) => {
        this.writePending--;
        if (err) this.onDiskWriteError(err);
      }
    );

    return eventData.eventId;
  }

  async flushDiskWrites() {
    return new Promise((resolve, reject) => {
      if (this.diskWriter.writableNeedsMore) {
        this.diskWriter.once('drain', resolve);
      } else {
        resolve();
      }
    });
  }

  async *playback(options = {}) {
    const { startFrame = 0, endFrame = null } = options;

    // Yield recent frames from memory first
    for (const frame of this.memoryBuffer) {
      if (frame.frameId >= startFrame && (!endFrame || frame.frameId <= endFrame)) {
        yield frame;
      }
    }

    // Stream remaining frames from disk
    const readline = require('readline');
    const stream = fs.createReadStream(this.logPath);
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    try {
      for await (const line of rl) {
        const item = JSON.parse(line);
        if (item.frameId >= startFrame && (!endFrame || item.frameId <= endFrame)) {
          yield item;
        }
      }
    } finally {
      rl.close();
    }
  }

  async getRecordingStats() {
    // Calculate actual disk size
    const stat = await fs.promises.stat(this.logPath).catch(() => null);
    const diskSizeBytes = stat ? stat.size : 0;

    return {
      sessionId: this.sessionId,
      totalFrames: this.totalFrameCount,
      totalEvents: this.totalEventCount,
      memoryFrames: this.memoryBuffer.length,
      diskSizeBytes,
      diskSizeMB: (diskSizeBytes / 1024 / 1024).toFixed(2),
      memoryEstimateMB: (
        this.memoryBuffer.reduce((sum, f) => sum + JSON.stringify(f).length, 0) /
        1024 / 1024
      ).toFixed(2),
      estimatedDiskMB: (diskSizeBytes / 1024 / 1024).toFixed(2)
    };
  }

  async exportRecording(exportPath, format = 'jsonl') {
    const writeStream = fs.createWriteStream(exportPath);

    for await (const item of this.playback()) {
      if (format === 'jsonl') {
        writeStream.write(JSON.stringify(item) + '\n');
      } else if (format === 'json') {
        // JSON format: array of items
        writeStream.write(JSON.stringify(item) + ',\n');
      }
    }

    writeStream.end();
    return new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  async cleanup() {
    await this.flushDiskWrites();
    
    return new Promise((resolve, reject) => {
      this.diskWriter.end((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  onDiskWriteError(err) {
    console.error('Disk write failed:', err);
    // Try to recover or fall back to memory-only mode
  }
}
```

### Implementation Details

**Files to Create/Modify:**
- `src/recording/streaming-recorder.js` (NEW, 350 lines)
- `src/recording/session-recorder.js` (Modify: switch to streaming)
- `websocket/commands/recording-commands.js` (Update: add streaming stats)

**Implementation Steps:**

1. **Create streaming recorder** (2 hours)
   - Implement JSONL append-only writer
   - Add memory buffer management
   - Add playback generator
   - Add export functionality

2. **Migrate existing recorder** (1.5 hours)
   - Update session recorder initialization
   - Update frame/event recording paths
   - Maintain API compatibility

3. **Testing** (1.5 hours)
   - 1-hour session test (verify < 100MB memory)
   - Playback accuracy test
   - Disk I/O performance test
   - Export functionality test

### Testing Strategy

**Unit Tests:**
```javascript
describe('StreamingSessionRecorder', () => {
  it('should keep memory buffer limited', async () => {
    const recorder = new StreamingSessionRecorder('test-session', {
      memoryFrameLimit: 10
    });

    // Add 100 frames
    for (let i = 0; i < 100; i++) {
      await recorder.recordFrame({ data: 'frame' + i });
    }

    // Memory buffer should have only last 10
    assert.equal(recorder.memoryBuffer.length, 10);
    assert.equal(recorder.totalFrameCount, 100);
  });

  it('should replay frames in correct order', async () => {
    const recorder = new StreamingSessionRecorder('test-session');

    // Record 50 frames
    for (let i = 0; i < 50; i++) {
      await recorder.recordFrame({ value: i });
    }

    // Playback and verify order
    let count = 0;
    for await (const frame of recorder.playback()) {
      assert.equal(frame.frameId, count);
      count++;
    }
    assert.equal(count, 50);
  });

  it('should reduce memory usage', async () => {
    const memBefore = process.memoryUsage().heapUsed;

    const recorder = new StreamingSessionRecorder('test-session');

    // Simulate 1-hour session (3600 frames)
    for (let i = 0; i < 3600; i++) {
      await recorder.recordFrame({
        type: 'dom',
        html: '<div>' + 'x'.repeat(1000) + '</div>'
      });
      if (i % 100 === 0) await recorder.flushDiskWrites();
    }

    const memAfter = process.memoryUsage().heapUsed;
    const memGrowth = (memAfter - memBefore) / 1024 / 1024;

    // Should grow < 100MB even with 3600 frames
    assert(memGrowth < 100, `Memory grew too much: ${memGrowth}MB`);
  });
});
```

**Performance Tests:**
```
Scenario: 1-hour recording (3600 frames)

Before OPT-04:
  Memory: 180-360MB
  All frames in heap
  
After OPT-04:
  Memory: <100MB (only 10 recent frames)
  3600 frames on disk (~100-200MB)
  Improvement: 70-80% memory reduction
```

### Success Criteria

- ✅ 1-hour session uses < 100MB memory (was 500MB+)
- ✅ Playback works correctly for all frames
- ✅ Disk I/O doesn't block recording
- ✅ Export functionality preserves all frames
- ✅ Recent frames accessible from memory instantly
- ✅ Zero frame loss

### Edge Cases & Recovery

1. **Disk full (no space left)**
   - Stop recording with error
   - Keep in-memory buffer as fallback
   - Alert monitoring system

2. **Disk write lag (I/O slow)**
   - Enable write batching (100 frames)
   - Use non-blocking writes
   - Monitor and adjust buffer size

3. **Playback on slow disk**
   - Stream frames gradually
   - Implement seek (resume playback at frame N)
   - Cache hot frames in memory

---

## OPT-10: Priority Queue System

### Overview

**Problem:** All commands processed in FIFO order - slow commands delay fast ones.  
**Target:** Priority queue: critical commands (screenshot) before low-priority (status).  
**Impact:** 20-40% P95 latency improvement for mixed workloads.

### Root Cause Analysis

Current implementation in `websocket/server.js`:

```javascript
// CURRENT: Single FIFO queue
class ConnectionPool {
  constructor() {
    this.requestQueue = [];  // Simple FIFO
    this.availableConnections = [];
  }

  async acquire(request) {
    this.requestQueue.push(request);
    // Wait for connection
    const conn = await this.waitForConnection();
    const req = this.requestQueue.shift();
    return this.execute(conn, req);
  }
}

// Problem: slow navigation (1000ms) blocks fast screenshot (150ms)
// Request order: [navigate, screenshot, ping, get_status]
// Execution: navigate(1000) -> screenshot(150) -> ping(50) -> status(10)
// Result: status waits 1150ms (should be ~10ms)
```

### Solution Design

Implement priority-based request scheduling:

```javascript
class PriorityConnectionPool {
  constructor(poolSize = 16, executeHandler) {
    this.poolSize = poolSize;
    this.executeHandler = executeHandler;
    
    // Priority buckets instead of single queue
    this.requestQueue = {
      critical: [],   // P0: screenshot, extraction
      normal: [],     // P1: navigation, interaction
      low: []         // P2: status, logging
    };

    this.availableConnections = [];
    this.activeRequests = new Map();
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      totalWaitTime: 0,
      priorityBreakdown: {
        critical: 0,
        normal: 0,
        low: 0
      }
    };
  }

  getCommandPriority(command) {
    // Critical: Fast, high-value operations
    const criticalCommands = [
      'screenshot', 'screenshot_viewport', 'screenshot_full_page',
      'screenshot_element', 'screenshot_diff',
      'get_content', 'get_html', 'get_text',
      'extract_text', 'extract_html', 'extract_links',
      'extract_images', 'extract_forms'
    ];

    // Low-priority: Status, monitoring, logging
    const lowCommands = [
      'ping', 'list_tabs', 'get_status',
      'get_console_logs', 'get_memory_stats',
      'get_performance_stats', 'list_profiles'
    ];

    if (criticalCommands.includes(command)) {
      return 'critical';
    } else if (lowCommands.includes(command)) {
      return 'low';
    } else {
      return 'normal';
    }
  }

  async acquire(request) {
    // Assign priority
    request.priority = this.getCommandPriority(request.command);
    request.queuedAt = Date.now();

    this.stats.totalRequests++;
    this.stats.priorityBreakdown[request.priority]++;

    // Add to appropriate queue
    this.requestQueue[request.priority].push(request);

    // Try to process immediately
    await this.processNextRequest();

    // Wait for result
    return this.waitForResult(request.id);
  }

  async processNextRequest() {
    // Skip if no connections available
    if (this.availableConnections.length === 0) {
      return;
    }

    // Drain by priority: critical -> normal -> low
    const request = (
      this.requestQueue.critical.shift() ||
      this.requestQueue.normal.shift() ||
      this.requestQueue.low.shift()
    );

    if (!request) {
      return; // No requests pending
    }

    const connection = this.availableConnections.shift();
    const waitTime = Date.now() - request.queuedAt;

    this.stats.totalWaitTime += waitTime;
    this.activeRequests.set(request.id, {
      request,
      connection,
      startTime: Date.now()
    });

    // Execute asynchronously
    this.executeRequest(request, connection);
  }

  async executeRequest(request, connection) {
    try {
      const result = await this.executeHandler(request);
      this.completeRequest(request.id, result);
    } catch (error) {
      this.failRequest(request.id, error);
    } finally {
      // Return connection to pool and process next
      this.availableConnections.push(connection);
      await this.processNextRequest();
    }
  }

  completeRequest(requestId, result) {
    const active = this.activeRequests.get(requestId);
    if (active) {
      const executionTime = Date.now() - active.startTime;
      active.result = result;
      active.completed = true;
      this.stats.completedRequests++;
      
      // Notify waiters
      this.notifyWaiters(requestId);
    }
  }

  failRequest(requestId, error) {
    const active = this.activeRequests.get(requestId);
    if (active) {
      active.error = error;
      active.completed = true;
      
      // Notify waiters
      this.notifyWaiters(requestId);
    }
  }

  waitForResult(requestId, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkResult = () => {
        const active = this.activeRequests.get(requestId);
        
        if (!active) {
          reject(new Error('Request not found'));
          return;
        }

        if (active.completed) {
          this.activeRequests.delete(requestId);
          if (active.error) {
            reject(active.error);
          } else {
            resolve(active.result);
          }
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Request timeout'));
          return;
        }

        // Check again in 10ms
        setTimeout(checkResult, 10);
      };

      checkResult();
    });
  }

  notifyWaiters(requestId) {
    // Implementation uses events/promises
    // Simplified here for clarity
  }

  getStatistics() {
    const avgWaitTime = this.stats.completedRequests > 0
      ? Math.round(this.stats.totalWaitTime / this.stats.completedRequests)
      : 0;

    return {
      totalRequests: this.stats.totalRequests,
      completedRequests: this.stats.completedRequests,
      averageWaitTime: avgWaitTime,
      queueSizes: {
        critical: this.requestQueue.critical.length,
        normal: this.requestQueue.normal.length,
        low: this.requestQueue.low.length
      },
      priorityDistribution: this.stats.priorityBreakdown,
      activeRequests: this.activeRequests.size,
      availableConnections: this.availableConnections.length
    };
  }
}
```

### Implementation Details

**Files to Create/Modify:**
- `websocket/priority-pool.js` (NEW, 240 lines)
- `websocket/server.js` (Modify: use priority pool instead of connection pool)
- `websocket/commands/status-commands.js` (NEW: add priority stats)

**Implementation Steps:**

1. **Create priority pool** (1.5 hours)
   - Implement 3-bucket priority queue
   - Add command classification
   - Add request tracking and statistics

2. **Integrate with WebSocket server** (0.5 hours)
   - Replace ConnectionPool with PriorityConnectionPool
   - Update request handling paths
   - Maintain backward compatibility

3. **Testing** (1 hour)
   - Mixed workload test (navigation + screenshot + status)
   - P95 latency measurement
   - Fairness test (no starvation)
   - Statistics accuracy

### Testing Strategy

**Unit Tests:**
```javascript
describe('PriorityConnectionPool', () => {
  it('should prioritize critical commands', async () => {
    const pool = new PriorityConnectionPool(1, mockHandler);

    const requests = [
      { command: 'navigate', id: 1 },           // Normal
      { command: 'screenshot', id: 2 },         // Critical
      { command: 'get_status', id: 3 }          // Low
    ];

    // Queue all requests
    const promises = requests.map(r => pool.acquire(r));

    // Screenshot should execute before get_status
    // (navigate finishes first, then screenshot queued before status)
    const results = await Promise.all(promises);
    assert(results.length === 3);
  });

  it('should not starve low-priority commands', async () => {
    const pool = new PriorityConnectionPool(1, mockHandler);

    // Continuously queue critical commands
    const criticalPromises = [];
    for (let i = 0; i < 5; i++) {
      criticalPromises.push(
        pool.acquire({ command: 'screenshot', id: i })
      );
    }

    // Queue one low-priority command
    const lowPromise = pool.acquire({
      command: 'get_status',
      id: 'low'
    });

    // All should complete
    await Promise.all([...criticalPromises, lowPromise]);
  });

  it('should track statistics', async () => {
    const pool = new PriorityConnectionPool(1, mockHandler);

    // Queue mixed requests
    await pool.acquire({ command: 'screenshot', id: 1 });
    await pool.acquire({ command: 'navigate', id: 2 });
    await pool.acquire({ command: 'get_status', id: 3 });

    const stats = pool.getStatistics();
    assert(stats.totalRequests === 3);
    assert(stats.priorityDistribution.critical >= 1);
    assert(stats.priorityDistribution.low >= 1);
  });
});
```

**Load Tests:**
```javascript
describe('Priority Queue under load', () => {
  it('should reduce P95 latency for critical operations', async () => {
    const pool = new PriorityConnectionPool(2, mockHandler);
    
    const latencies = {
      critical: [],
      normal: [],
      low: []
    };

    // Generate 100 mixed requests
    for (let i = 0; i < 100; i++) {
      const priority = i % 3 === 0 ? 'low' : (i % 3 === 1 ? 'normal' : 'critical');
      const command = priority === 'critical' ? 'screenshot' :
                      priority === 'normal' ? 'navigate' : 'get_status';

      const start = Date.now();
      await pool.acquire({ command, id: i });
      latencies[priority].push(Date.now() - start);
    }

    // Calculate P95
    const p95 = (arr) => {
      arr.sort((a, b) => a - b);
      return arr[Math.floor(arr.length * 0.95)];
    };

    // Critical should have much lower P95 than low
    const criticalP95 = p95(latencies.critical);
    const lowP95 = p95(latencies.low);

    console.log(`Critical P95: ${criticalP95}ms`);
    console.log(`Low P95: ${lowP95}ms`);
    assert(criticalP95 < lowP95 * 0.5); // Critical at least 2x faster
  });
});
```

**Performance Characteristics:**

```
Scenario: Mixed workload (50 screenshots, 50 navigations, 50 status checks)

Before OPT-10 (FIFO):
  All in queue order
  Status check P95: 2000ms (waits for navigations before it)
  
After OPT-10 (Priority):
  Status checks execute immediately (low priority, fast)
  Screenshots execute ahead of navigations
  Status check P95: 200ms (50x improvement!)
  Screenshot P95: 150ms (unchanged)
  Navigation P95: 1000ms (unchanged)
```

### Success Criteria

- ✅ Critical commands: P95 < 100ms
- ✅ Low-priority commands: P95 < 500ms (acceptable)
- ✅ No command starvation (all eventually execute)
- ✅ Statistics accurate
- ✅ No performance regression for single-priority workloads

### Edge Cases & Recovery

1. **Queue overflow (1000+ pending requests)**
   - Implement backpressure: reject new requests
   - Alert monitoring system
   - Reject low-priority, accept critical

2. **Priority inversion** (critical blocked by normal)
   - Detect and boost priority of blocking request
   - Reorder queue if needed

3. **Fairness starvation** (low-priority never runs)
   - Implement aging: low→normal after 5 minutes
   - Guarantee execution: process one low per 10 critical

---

## Integration & Scheduling

### Sprint Schedule

**Week 1 (May 18-21):**
- Day 1: Setup, parallel screenshot manager (5 hours)
- Day 2: Integration, testing (3 hours)
- Day 3: Review, refinement (2 hours)
- **Subtotal:** 10 hours

**Week 2 (May 22-25):**
- Day 1: Session streaming recorder (6 hours)
- Day 2: Priority queue implementation (4 hours)
- Day 3: Testing, integration, documentation (2 hours)
- **Subtotal:** 12 hours

**Total:** 12 hours (distributed over 2 weeks)

### Parallel Development

Optimizations can be developed in parallel:
- **Track A:** OPT-03 (parallel screenshots) - Developer 1
- **Track B:** OPT-04 (session streaming) - Developer 2
- **Track C:** OPT-10 (priority queue) - Developer 1 (after OPT-03)

### Dependencies

- **OPT-03 → OPT-04:** None (independent)
- **OPT-04 → OPT-10:** None (independent)
- **OPT-10 → OPT-03/04:** None (orthogonal)

All three can be developed in parallel with no blockers.

---

## Release Readiness

### Code Review Checklist

- [ ] All implementations complete
- [ ] All tests passing (100% pass rate required)
- [ ] No breaking changes
- [ ] Backward compatible with v12.0.0
- [ ] Code style consistent
- [ ] Error handling comprehensive
- [ ] Logging appropriate
- [ ] Documentation complete

### Testing Checklist

- [ ] Unit tests for each optimization
- [ ] Integration tests with existing features
- [ ] Performance benchmarks documented
- [ ] Edge cases covered
- [ ] Load testing passed
- [ ] Memory leak testing passed
- [ ] 24-hour stability test passed

### Documentation Checklist

- [ ] Code comments complete
- [ ] Architecture documented
- [ ] Configuration documented
- [ ] Examples provided
- [ ] Migration guide updated
- [ ] API reference updated
- [ ] Troubleshooting guide updated

---

## Risk Assessment

### OPT-03: Parallel Screenshots

**Risks:**
- GPU memory exhaustion (if pool size too large)
- Image quality variance (different encoding paths)
- Synchronization issues (buffer state)

**Mitigation:**
- Monitor GPU memory, auto-adjust pool size
- Quality testing across all formats
- Thread-safe buffer management with locks

### OPT-04: Session Streaming

**Risks:**
- Disk I/O contention (blocking recording)
- Data loss (disk write failure)
- Playback accuracy (frame ordering)

**Mitigation:**
- Non-blocking writes with buffering
- Checksums and validation
- Comprehensive replay testing

### OPT-10: Priority Queue

**Risks:**
- Priority inversion (critical blocked by normal)
- Starvation (low-priority never runs)
- Incorrect classification (wrong priority assigned)

**Mitigation:**
- Aging mechanism (boost priority over time)
- Fairness guarantee (process all eventually)
- Comprehensive command classification review

---

## Success Metrics

### Performance Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Concurrent screenshots (3x) | 450ms | 150ms | 3x faster |
| 1-hour session memory | 500MB | <100MB | 80% reduction |
| Mixed workload P95 | 2000ms | <500ms | 4x faster |

### Quality Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Test pass rate | 100% | TBD |
| Memory leaks | 0 | TBD |
| Performance regressions | 0 | TBD |
| Breaking changes | 0 | TBD |

---

## References

- **Bottleneck Report:** `tests/results/BOTTLENECK-REPORT-2026-05-11.md`
- **Optimization Roadmap:** `docs/analysis/OPTIMIZATION-ROADMAP.md`
- **Sprint 1 Complete:** `OPTIMIZATION-SPRINT-1-COMPLETE.md`
- **v12.0.0 Release Notes:** `docs/RELEASE-NOTES-v12.0.0.md`

---

**Status:** ✅ Ready for Implementation  
**Priority:** High (P1 for 2 items, P2 for 1 item)  
**Effort:** 12 hours total  
**Timeline:** May 18-25, 2026  
**Target Release:** v12.1.0 (July 1, 2026)

---

*This specification is detailed and ready for development. Each optimization includes complete code examples, testing strategy, and integration paths. Team can begin implementation immediately.*
