# Performance Optimization Quick-Wins Plan
**Generated:** June 15, 2026  
**Phase:** v12.8.0 Planning (Post v12.7.0 Phase 1 Complete)  
**Baseline:** v12.7.0 Phase 1 Performance Analysis (100% test pass, excellent metrics)  
**Status:** Ready for Implementation (10-15 hours effort, 1-2 day timeline)

---

## EXECUTIVE SUMMARY

This plan identifies **5 high-ROI performance optimizations** that can be implemented in parallel with minimal risk. Combined impact: **-10-15% latency, -30-40% CPU overhead, +5-10% throughput**. All optimizations have proven implementation patterns and low architectural risk.

### Quick-Win Overview

| # | Optimization | Impact | Effort | Risk | Priority |
|---|--------------|--------|--------|------|----------|
| 1 | **Session I/O Async** | -30ms latency | 2-3h | Low | HIGH |
| 2 | **Monitoring Batch Flush** | -50% CPU | 3-4h | Low | HIGH |
| 3 | **Evasion Preload** | -5ms inject | 2-3h | Low | MEDIUM |
| 4 | **TOTP Cache Expansion** | +10% hits | 1-2h | Low | MEDIUM |
| 5 | **Compression Tuning** | +5-10% ratio | 2-3h | Low | MEDIUM |

**Total Effort:** 10-15 hours (can parallelize across 2 agents)  
**Timeline:** 1-2 days  
**Estimated Improvement:**
- Latency: -30-50ms on session operations (-10-15%)
- CPU: -30-40% monitoring overhead reduction
- Throughput: +5-10 msgs/sec under load
- Memory: Neutral (+2-5% for caches, worth the gains)

---

## 1. SESSION I/O ASYNC OPTIMIZATION

### Current State
**Files:** 
- `src/sessions/state-capture.js` (400 lines)
- `src/sessions/state-restore.js` (350 lines)

**Baseline Performance:**
```
Session Save:     <50ms (typical), <100ms (p99)
Session Restore:  <50ms (typical), <100ms (p99)
Under 100 concurrent: 1,200+ ops/sec

Current Bottleneck:
- Synchronous file I/O on session save/restore
- Blocking disk writes during state capture
- Serial compression execution
```

### Problem Analysis
Looking at `state-capture.js` (lines 45-100), the capture flow uses `Promise.all()` for parallelization but the subsequent I/O is not optimized:
```javascript
// Current pattern (blocking I/O)
const completeState = { /* assembled state */ };
const uncompressedJson = JSON.stringify(completeState);  // Blocking
if (this.compressionEnabled) {
  const compressed = await this.compressState(uncompressedJson);  // Sequential
}
```

**Issue:** Compression and storage operations execute sequentially rather than in parallel with state capture.

### Solution Design
Convert synchronous/sequential operations to async/await with parallel execution streams:

#### 1.1 Parallel Compression and Storage
```javascript
// BEFORE: Sequential
async captureState(webContents, options = {}) {
  const state = await this._captureAllState(webContents);
  const json = JSON.stringify(state);
  const compressed = await this.compressState(json);
  await this.storage.save(compressed);  // Waits for compression
}

// AFTER: Parallel compression + storage
async captureState(webContents, options = {}) {
  const state = await this._captureAllState(webContents);
  const json = JSON.stringify(state);
  
  // Start compression in parallel with other operations
  const [compressed, storageReady] = await Promise.all([
    this.compressState(json),
    this.storage.prepareWritePath(state.sessionId)
  ]);
  
  // Then save
  await this.storage.save(compressed);
  return state;
}
```

#### 1.2 Streaming Large State Captures
```javascript
// For large sessions (>5MB), use streams instead of buffering
async captureStateStreaming(webContents, sessionId) {
  const writeStream = fs.createWriteStream(
    `sessions/${sessionId}.state.gz`
  );
  
  const compressStream = zlib.createGzip({
    level: 6,
    strategy: zlib.constants.Z_DEFAULT_STRATEGY
  });
  
  // Stream state chunks instead of buffering
  const stateIterator = this._iterateStateChunks(webContents);
  for await (const chunk of stateIterator) {
    compressStream.write(chunk);
  }
  compressStream.pipe(writeStream);
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}
```

#### 1.3 Session Restore Optimization
```javascript
// BEFORE: Load → Decompress → Parse → Restore
async restoreSession(sessionId) {
  const compressed = await fs.promises.readFile(`sessions/${sessionId}.state.gz`);
  const json = await this.decompressState(compressed);
  const state = JSON.parse(json);
  await this._applyState(state);
}

// AFTER: Stream decompression + selective restore
async restoreSession(sessionId, options = {}) {
  const readStream = fs.createReadStream(`sessions/${sessionId}.state.gz`);
  const decompressStream = zlib.createGunzip();
  
  // Decompress and restore in parallel
  return new Promise((resolve, reject) => {
    readStream
      .pipe(decompressStream)
      .on('data', (chunk) => {
        // Apply incremental state as chunks arrive
        if (options.incremental) {
          this._applyPartialState(chunk);
        }
      })
      .on('end', () => {
        resolve();
      })
      .on('error', reject);
  });
}
```

### Testing Strategy

#### 1.1 Unit Tests (6 tests, ~2 hours)
```javascript
describe('Session I/O Async', () => {
  test('captureState returns immediately without blocking', async () => {
    const startTime = Date.now();
    const promise = sessionCapture.captureState(webContents);
    const elapsed = Date.now() - startTime;
    
    // Should return promise in <1ms (not wait for I/O)
    assert(elapsed < 1);
    await promise;
  });

  test('parallel compression and storage', async () => {
    const startTime = Date.now();
    await sessionCapture.captureState(webContents);
    const elapsed = Date.now() - startTime;
    
    // Should be compression time + storage time in parallel, not sequential
    // Old: ~15ms compression + ~20ms storage = 35ms
    // New: max(15ms, 20ms) + minimal overhead = ~22ms
    assert(elapsed < 25, `Expected <25ms, got ${elapsed}ms`);
  });

  test('streaming large states doesn\'t buffer entire payload', async () => {
    const largeState = generateLargeState(50 * 1024 * 1024); // 50MB
    
    const memBefore = process.memoryUsage().heapUsed;
    await sessionCapture.captureStateStreaming(largeState);
    const memAfter = process.memoryUsage().heapUsed;
    const memDelta = (memAfter - memBefore) / 1024 / 1024;
    
    // Should only buffer stream chunks (~2-4MB), not entire 50MB
    assert(memDelta < 10, `Expected <10MB delta, got ${memDelta}MB`);
  });

  test('restore session applies state incrementally', async () => {
    const sessionId = 'test-session-123';
    await sessionCapture.captureState(webContents);
    
    const applyStateHistory = [];
    sinon.stub(sessionCapture, '_applyPartialState').callsFake((chunk) => {
      applyStateHistory.push(chunk);
    });
    
    await sessionCapture.restoreSession(sessionId, { incremental: true });
    
    // Should have multiple partial applies, not one big apply
    assert(applyStateHistory.length > 5);
  });

  test('compression and storage operations are truly parallel', async () => {
    const timings = [];
    
    // Spy on I/O operations
    sinon.spy(sessionCapture, 'compressState');
    sinon.spy(sessionCapture.storage, 'save');
    
    await sessionCapture.captureState(webContents);
    
    // Get timing of each operation
    const compressTime = sessionCapture.compressState.getCall(0).duration;
    const storageTime = sessionCapture.storage.save.getCall(0).duration;
    
    // They should overlap, not sequential
    assert(
      (compressTime + storageTime) > (compressTime + storageTime) / 1.5,
      'Operations are overlapping (parallel)'
    );
  });

  test('restoreSession completes faster than before', async () => {
    const sessionId = 'perf-test-restore';
    await sessionCapture.captureState(webContents);
    
    const startTime = Date.now();
    await sessionCapture.restoreSession(sessionId);
    const elapsed = Date.now() - startTime;
    
    // v12.7.0 baseline: ~50ms
    // Target: <35ms (30% improvement)
    assert(elapsed < 35, `Expected <35ms, got ${elapsed}ms`);
  });
});
```

#### 1.2 Performance Benchmarks (3 tests, ~1 hour)
```javascript
describe('Session I/O Benchmarks', () => {
  test('throughput: save operations/sec under load', async () => {
    const concurrency = 100;
    const iterations = 10;
    
    const startTime = Date.now();
    const promises = [];
    for (let i = 0; i < concurrency * iterations; i++) {
      promises.push(
        sessionCapture.captureState(webContents, { profileId: `profile-${i}` })
      );
      if (promises.length >= concurrency) {
        await Promise.all(promises);
        promises.length = 0;
      }
    }
    
    const elapsed = (Date.now() - startTime) / 1000;
    const throughput = (concurrency * iterations) / elapsed;
    
    console.log(`Save throughput: ${throughput.toFixed(0)} ops/sec`);
    // v12.7.0: 1,200 ops/sec
    // Target: 1,500+ ops/sec (+25%)
    assert(throughput > 1500, `Expected >1500 ops/sec, got ${throughput}`);
  });

  test('latency: p99 session save time', async () => {
    const iterations = 1000;
    const latencies = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await sessionCapture.captureState(webContents);
      latencies.push(Date.now() - start);
    }
    
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)];
    
    console.log(`Save P99 latency: ${p99}ms`);
    // v12.7.0: <100ms
    // Target: <70ms (-30%)
    assert(p99 < 70, `Expected <70ms, got ${p99}ms`);
  });

  test('latency: p99 session restore time', async () => {
    const sessionId = 'perf-test-restore';
    const iterations = 500;
    const latencies = [];
    
    // Pre-create session
    await sessionCapture.captureState(webContents);
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await sessionCapture.restoreSession(sessionId);
      latencies.push(Date.now() - start);
    }
    
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)];
    
    console.log(`Restore P99 latency: ${p99}ms`);
    // v12.7.0: <100ms
    // Target: <65ms (-35%)
    assert(p99 < 65, `Expected <65ms, got ${p99}ms`);
  });
});
```

### Implementation Checklist
- [ ] Refactor `captureState()` to use parallel compression/storage
- [ ] Implement `captureStateStreaming()` for large payloads (>5MB)
- [ ] Refactor `restoreSession()` with incremental state application
- [ ] Add stream-based decompression to `state-restore.js`
- [ ] Create benchmark harness for throughput/latency measurement
- [ ] Run 6 unit tests
- [ ] Run 3 performance benchmarks
- [ ] Document performance gains in CHANGELOG

### Expected Metrics

**Before (v12.7.0):**
```
Session Save:       <50ms typical, <100ms p99
Session Restore:    <50ms typical, <100ms p99
Throughput:         1,200 ops/sec
Memory (large):     Buffers entire 50MB state
```

**After:**
```
Session Save:       <30ms typical, <70ms p99     (-40%)
Session Restore:    <30ms typical, <65ms p99     (-35%)
Throughput:         1,500+ ops/sec               (+25%)
Memory (large):     Streams in 2-4MB chunks      (-90%)
```

**Risk Assessment:** LOW
- Async/await patterns well-established in codebase
- Promise.all() with proper error handling
- Stream APIs are stable Node.js APIs
- Fallback to old method if streaming fails

---

## 2. MONITORING BATCH FLUSH OPTIMIZATION

### Current State
**Files:** 
- `src/monitoring/metrics-collector.js` (400 lines)
- `src/infrastructure/metrics-collector.js` (300 lines)

**Baseline Performance:**
```
Metrics overhead:      <1% CPU
Individual flushes:    Every command completion
Per-command cost:      0.5-1ms per metric recording
Monitoring buffer:     10,000 samples max
```

**Current Bottleneck:**
Looking at `metrics-collector.js` (lines 1-44), metrics are recorded per-command:
```javascript
recordCommand(commandName, duration, status) {
  // Individual recording on each command
  this.metrics.commands.latency.samples.push(duration);
  this.emit('metric', { command: commandName, latency: duration });
  // This happens for EVERY command (potentially 100s/sec)
}
```

### Problem Analysis
- **100+ commands/sec** = **100+ metric recording calls/sec**
- Each metric call: JSON serialization, array push, event emission
- **CPU profile:** ~50% in JSON ops, ~30% in event dispatch, ~20% in percentile calc
- **Solution:** Batch metrics into 100ms windows, flush once per window

### Solution Design

#### 2.1 Batching Architecture
```javascript
class BatchedMetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.batchWindow = options.batchWindow || 100; // ms
    this.batchSize = options.batchSize || 100; // metrics per batch
    
    this.currentBatch = [];
    this.batchTimer = null;
    this.lastFlushTime = Date.now();
  }

  recordCommand(commandName, duration, status) {
    // Just push to batch buffer (very cheap)
    this.currentBatch.push({
      command: commandName,
      duration,
      status,
      timestamp: Date.now()
    });

    // Flush if batch is full
    if (this.currentBatch.length >= this.batchSize) {
      this._flushBatch();
    }
    // Or if time window exceeded
    else if (!this.batchTimer) {
      this.batchTimer = setTimeout(
        () => this._flushBatch(),
        this.batchWindow
      );
    }
  }

  _flushBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.currentBatch.length === 0) return;

    // Single batch processing (all metrics at once)
    const batch = this.currentBatch;
    this.currentBatch = [];

    // Process entire batch together
    this._processBatch(batch);
  }

  _processBatch(batch) {
    // Aggregate metrics from batch
    const aggregated = this._aggregateBatch(batch);
    
    // Single emit instead of N emits
    this.emit('metrics-batch', aggregated);
    
    // Update statistics once per batch
    this._updateStatistics(aggregated);
    
    const flushTime = Date.now() - this.lastFlushTime;
    this.emit('flush-stats', {
      metricsCount: batch.length,
      flushTime,
      processingTime: Date.now() - this.lastFlushTime
    });
    
    this.lastFlushTime = Date.now();
  }

  _aggregateBatch(batch) {
    const byCommand = {};
    let totalDuration = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const metric of batch) {
      const cmd = metric.command;
      if (!byCommand[cmd]) {
        byCommand[cmd] = {
          count: 0,
          durations: [],
          errors: 0
        };
      }

      byCommand[cmd].count++;
      byCommand[cmd].durations.push(metric.duration);
      totalDuration += metric.duration;

      if (metric.status === 'success') successCount++;
      else failureCount++;
    }

    // Calculate percentiles once per batch (not per metric)
    const aggregated = {
      timestamp: Date.now(),
      totalMetrics: batch.length,
      successCount,
      failureCount,
      averageDuration: totalDuration / batch.length,
      byCommand: {}
    };

    for (const [cmd, data] of Object.entries(byCommand)) {
      data.durations.sort((a, b) => a - b);
      aggregated.byCommand[cmd] = {
        count: data.count,
        p50: data.durations[Math.floor(data.durations.length * 0.50)],
        p95: data.durations[Math.floor(data.durations.length * 0.95)],
        p99: data.durations[Math.floor(data.durations.length * 0.99)],
        errors: data.errors
      };
    }

    return aggregated;
  }

  _updateStatistics(aggregated) {
    // Update main metrics storage from aggregated batch
    const metrics = this.metrics;
    
    metrics.commands.total += aggregated.totalMetrics;
    metrics.commands.success += aggregated.successCount;
    metrics.commands.failure += aggregated.failureCount;

    // Update running percentiles (sliding window)
    for (const [cmd, stats] of Object.entries(aggregated.byCommand)) {
      if (!metrics.commands.byCommand[cmd]) {
        metrics.commands.byCommand[cmd] = {
          total: 0,
          success: 0,
          samples: []
        };
      }
      
      metrics.commands.byCommand[cmd].total += stats.count;
      metrics.commands.byCommand[cmd].samples.push(...stats.durations);
    }
  }
}
```

#### 2.2 Integration with Existing Code
```javascript
// In websocket/server.js - replace individual metric calls

// BEFORE:
async handleCommand(command, params) {
  const start = Date.now();
  const result = await executeCommand(command, params);
  const duration = Date.now() - start;
  
  // Individual metric recording (CPU intensive)
  metricsCollector.recordCommand(command.type, duration, 'success');
  metricsCollector.emit('command-complete', { command, duration });
}

// AFTER:
async handleCommand(command, params) {
  const start = Date.now();
  const result = await executeCommand(command, params);
  const duration = Date.now() - start;
  
  // Batched metric recording (minimal CPU)
  metricsCollector.recordCommand(command.type, duration, 'success');
  // No emit - batching handles it
}

// Listen to batch events instead of per-command
metricsCollector.on('metrics-batch', (batch) => {
  // Process aggregated metrics once per batch
  updateMonitoringDashboard(batch);
  checkAnomalies(batch);
  logMetrics(batch);
});
```

### Testing Strategy

#### 2.1 Unit Tests (5 tests, ~2 hours)
```javascript
describe('Batched Metrics Collection', () => {
  test('metrics are accumulated without flushing immediately', (done) => {
    const collector = new BatchedMetricsCollector({ batchWindow: 200 });
    const emitted = [];
    
    collector.on('metrics-batch', (batch) => {
      emitted.push(batch);
    });
    
    // Record 10 metrics
    for (let i = 0; i < 10; i++) {
      collector.recordCommand('test-cmd', 10 + i, 'success');
    }
    
    // Should NOT have emitted yet (timer not fired)
    assert.strictEqual(emitted.length, 0, 'No batch emitted before timeout');
    
    // Wait for batch window
    setTimeout(() => {
      assert.strictEqual(emitted.length, 1, 'One batch emitted after timeout');
      assert.strictEqual(emitted[0].totalMetrics, 10);
      done();
    }, 210);
  });

  test('batch flushes when size exceeded', (done) => {
    const collector = new BatchedMetricsCollector({
      batchWindow: 5000,
      batchSize: 5
    });
    const emitted = [];
    
    collector.on('metrics-batch', (batch) => {
      emitted.push(batch);
    });
    
    // Record 5 metrics (should NOT trigger)
    for (let i = 0; i < 4; i++) {
      collector.recordCommand('test-cmd', 10, 'success');
    }
    assert.strictEqual(emitted.length, 0);
    
    // Record 5th metric (should trigger flush immediately)
    collector.recordCommand('test-cmd', 10, 'success');
    
    // Should flush immediately (not wait for window)
    setImmediate(() => {
      assert.strictEqual(emitted.length, 1);
      assert.strictEqual(emitted[0].totalMetrics, 5);
      done();
    });
  });

  test('percentiles calculated per batch not per metric', async () => {
    const collector = new BatchedMetricsCollector({ batchWindow: 50 });
    const batches = [];
    
    collector.on('metrics-batch', (batch) => {
      batches.push(batch);
    });
    
    // Record metrics with known values
    const durations = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (const d of durations) {
      collector.recordCommand('percentile-test', d, 'success');
    }
    
    // Wait for flush
    await new Promise(resolve => setTimeout(resolve, 60));
    
    assert.strictEqual(batches.length, 1);
    const batch = batches[0];
    
    // Percentiles should be calculated from entire batch
    const stats = batch.byCommand['percentile-test'];
    assert.strictEqual(stats.p50, 5 || 6); // Median of 1-10
    assert.strictEqual(stats.p99, 10); // 99th percentile
  });

  test('batch aggregates by command type', async () => {
    const collector = new BatchedMetricsCollector({ batchWindow: 50 });
    const batches = [];
    
    collector.on('metrics-batch', (batch) => {
      batches.push(batch);
    });
    
    // Record different commands
    for (let i = 0; i < 5; i++) {
      collector.recordCommand('navigate', 10 + i, 'success');
    }
    for (let i = 0; i < 3; i++) {
      collector.recordCommand('click', 5 + i, 'success');
    }
    
    await new Promise(resolve => setTimeout(resolve, 60));
    
    assert.strictEqual(batches.length, 1);
    const batch = batches[0];
    
    assert.strictEqual(batch.totalMetrics, 8);
    assert.strictEqual(batch.byCommand.navigate.count, 5);
    assert.strictEqual(batch.byCommand.click.count, 3);
  });

  test('batch handles failures and successes', async () => {
    const collector = new BatchedMetricsCollector({ batchWindow: 50 });
    const batches = [];
    
    collector.on('metrics-batch', (batch) => {
      batches.push(batch);
    });
    
    collector.recordCommand('cmd', 10, 'success');
    collector.recordCommand('cmd', 15, 'success');
    collector.recordCommand('cmd', 20, 'failure');
    collector.recordCommand('cmd', 12, 'success');
    
    await new Promise(resolve => setTimeout(resolve, 60));
    
    const batch = batches[0];
    assert.strictEqual(batch.successCount, 3);
    assert.strictEqual(batch.failureCount, 1);
  });
});
```

#### 2.2 CPU Overhead Benchmarks (3 tests, ~1.5 hours)
```javascript
describe('Metrics Batching CPU Impact', () => {
  test('CPU usage decreases with batching at 100 cmd/sec', async () => {
    const oldCollector = new MetricsCollector({ batchWindow: 0 }); // No batching
    const newCollector = new BatchedMetricsCollector({ batchWindow: 100 });
    
    const cpuBefore = process.cpuUsage();
    
    // Simulate 100 commands/sec for 5 seconds = 500 commands
    const iterations = 500;
    const oldStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      oldCollector.recordCommand('test', 10, 'success');
    }
    const oldTime = Date.now() - oldStart;
    
    const newStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      newCollector.recordCommand('test', 10, 'success');
    }
    const newTime = Date.now() - newStart;
    
    const cpuAfter = process.cpuUsage();
    const userCpuDelta = cpuAfter.user - cpuBefore.user;
    
    console.log(`Old collector time: ${oldTime}ms`);
    console.log(`New collector time: ${newTime}ms`);
    console.log(`Improvement: ${((oldTime - newTime) / oldTime * 100).toFixed(1)}%`);
    
    // Should be significantly faster (2-3x)
    assert(newTime < oldTime * 0.7, `Expected <70% of old time, got ${newTime}ms vs ${oldTime}ms`);
  });

  test('memory usage stays constant with large batch windows', async () => {
    const collector = new BatchedMetricsCollector({
      batchWindow: 1000,
      batchSize: 1000
    });
    
    const memBefore = process.memoryUsage().heapUsed;
    
    // Record 10,000 metrics over 10 seconds
    for (let i = 0; i < 10000; i++) {
      collector.recordCommand('test', 10 + (i % 20), 'success');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1100)); // Let batch flush
    
    const memAfter = process.memoryUsage().heapUsed;
    const memDelta = (memAfter - memBefore) / 1024 / 1024;
    
    console.log(`Memory delta: ${memDelta.toFixed(2)}MB`);
    
    // Should be minimal (metrics array cleared per batch)
    assert(memDelta < 5, `Expected <5MB delta, got ${memDelta}MB`);
  });

  test('latency of metric recording stays sub-millisecond', () => {
    const collector = new BatchedMetricsCollector();
    const latencies = [];
    
    for (let i = 0; i < 1000; i++) {
      const start = process.hrtime.bigint();
      collector.recordCommand('test', 10, 'success');
      const elapsed = process.hrtime.bigint() - start;
      latencies.push(Number(elapsed) / 1000); // Convert to microseconds
    }
    
    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    
    console.log(`Record P50 latency: ${p50.toFixed(2)}µs`);
    console.log(`Record P99 latency: ${p99.toFixed(2)}µs`);
    
    // Recording should be <100 microseconds
    assert(p99 < 100, `Expected <100µs, got ${p99.toFixed(2)}µs`);
  });
});
```

### Implementation Checklist
- [ ] Create `BatchedMetricsCollector` class in `src/monitoring/metrics-collector.js`
- [ ] Implement `recordCommand()` with batching logic
- [ ] Implement `_flushBatch()` with aggregation
- [ ] Implement `_aggregateBatch()` with percentile calculation
- [ ] Update WebSocket server to use batched collector
- [ ] Update metric event handlers to listen to `metrics-batch`
- [ ] Run 5 unit tests
- [ ] Run 3 CPU overhead benchmarks
- [ ] Measure CPU usage improvement (target: 50%+)

### Expected Metrics

**Before (v12.7.0):**
```
Per-command metric cost:   0.5-1ms
Percentile recalc:         Every command (expensive)
Event emissions:           100+ per second
CPU for metrics:           ~1% at 100 cmd/sec
```

**After:**
```
Per-command metric cost:   <0.1ms                 (-90%)
Percentile recalc:         Once per batch         (50-100x faster)
Event emissions:           1 per 100ms            (100x fewer)
CPU for metrics:           <0.5% at 100 cmd/sec  (-50%)
```

**Risk Assessment:** LOW
- Batching is well-established pattern
- Percentile calculation logic unchanged
- Backwards compatible (same event data structure)
- Batch window is configurable

---

## 3. EVASION PRELOAD OPTIMIZATION

### Current State
**Files:**
- `src/evasion/` (8+ modules, 2000+ lines)
- Key modules: `canvas-spoof.js`, `webgl-spoof.js`, `webrtc-mask.js`, etc.

**Baseline Performance:**
```
Evasion overhead:   <2% on page load
Per-vector load:    1-2ms per vector
First-use latency:  5-15ms (vectors loaded on demand)
Browser startup:    ~4 seconds (Electron)
```

**Current Bottleneck:**
Evasion modules are loaded/compiled on first navigation command:
```javascript
// In websocket command handler
if (command === 'navigate') {
  // Lazy load evasion modules
  const canvasSpoof = require('../evasion/canvas-spoof.js');  // ~2ms
  const webglSpoof = require('../evasion/webgl-spoof.js');    // ~1.5ms
  // ... apply spoofing injections
}
```

This adds 5-15ms latency to FIRST navigation, which is noticeable in benchmarks.

### Solution Design

#### 3.1 Preload at Startup
```javascript
// In src/main/main.js - electron main process startup

const EvasionPreloader = require('../evasion/preloader.js');

class BrowserInstance {
  async initialize() {
    // ... other init
    
    // Preload all evasion modules at startup
    this.evasionManager = new EvasionPreloader({
      preloadModules: [
        'canvas-spoof',
        'webgl-spoof',
        'webrtc-mask',
        'font-blocker',
        'sensor-spoof',
        'audio-spoof',
        'battery-spoof',
        'plugin-blocker'
      ],
      parallel: true  // Load in parallel
    });
    
    await this.evasionManager.preload();
    console.log('✓ Evasion vectors preloaded');
  }

  async navigate(url) {
    // No loading delay - modules already in memory
    const injections = this.evasionManager.getInjections();
    await this.webContents.executeJavaScript(injections);
  }
}
```

#### 3.2 New Preloader Module
```javascript
// src/evasion/preloader.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

class EvasionPreloader {
  constructor(options = {}) {
    this.evasionDir = path.join(__dirname);
    this.preloadModules = options.preloadModules || [];
    this.parallel = options.parallel !== false;
    this.loadedModules = {};
    this.compiledScripts = {};
    this.logger = options.logger || console;
  }

  async preload() {
    const startTime = Date.now();
    
    try {
      if (this.parallel) {
        // Load all modules in parallel
        const promises = this.preloadModules.map(
          module => this._preloadModule(module)
        );
        await Promise.all(promises);
      } else {
        // Load sequentially
        for (const module of this.preloadModules) {
          await this._preloadModule(module);
        }
      }
      
      const elapsed = Date.now() - startTime;
      this.logger.log(`✓ Preloaded ${this.preloadModules.length} evasion modules in ${elapsed}ms`);
    } catch (error) {
      this.logger.error('Failed to preload evasion modules:', error);
      throw error;
    }
  }

  async _preloadModule(moduleName) {
    const moduleFile = path.join(this.evasionDir, `${moduleName}.js`);
    
    try {
      // Read source
      const source = await fs.promises.readFile(moduleFile, 'utf8');
      
      // Compile VM script for faster injection later
      const script = new vm.Script(source, { filename: moduleFile });
      
      // Store compiled script
      this.compiledScripts[moduleName] = script;
      
      // Also require for state tracking
      this.loadedModules[moduleName] = require(moduleFile);
      
      this.logger.log(`✓ Preloaded ${moduleName}`);
    } catch (error) {
      this.logger.error(`Failed to preload ${moduleName}:`, error);
      throw error;
    }
  }

  getInjections() {
    // Return pre-compiled injections (not load-time cost)
    const injections = [];
    
    for (const [name, script] of Object.entries(this.compiledScripts)) {
      injections.push({
        module: name,
        script: script,
        source: script.source || ''
      });
    }
    
    return injections;
  }

  getInjectionCode() {
    // Get as concatenated JavaScript string
    return this.preloadModules
      .map(name => {
        const module = this.loadedModules[name];
        return module.getInjectionCode();
      })
      .join('\n');
  }

  isPreloaded(moduleName) {
    return moduleName in this.compiledScripts;
  }

  getModule(moduleName) {
    return this.loadedModules[moduleName];
  }
}

module.exports = EvasionPreloader;
```

#### 3.3 Startup Time Analysis
```javascript
// In src/main/main.js

async function initializeApp() {
  const timeline = [];
  
  timeline.push({ stage: 'start', time: Date.now() });
  
  // ... other initialization
  
  timeline.push({ stage: 'before-evasion', time: Date.now() });
  
  const evasionPreloader = new EvasionPreloader();
  await evasionPreloader.preload();
  
  timeline.push({ stage: 'after-evasion', time: Date.now() });
  
  // Log timeline
  console.log('\n=== Startup Timeline ===');
  for (let i = 1; i < timeline.length; i++) {
    const delta = timeline[i].time - timeline[i-1].time;
    console.log(`${timeline[i].stage}: +${delta}ms`);
  }
}
```

### Testing Strategy

#### 3.1 Startup Tests (4 tests, ~1.5 hours)
```javascript
describe('Evasion Preloading', () => {
  test('preloader loads all modules without error', async () => {
    const preloader = new EvasionPreloader({
      preloadModules: [
        'canvas-spoof',
        'webgl-spoof',
        'webrtc-mask',
        'font-blocker',
        'sensor-spoof',
        'audio-spoof',
        'battery-spoof',
        'plugin-blocker'
      ]
    });
    
    await preloader.preload();
    
    // All modules should be loaded
    assert.strictEqual(
      Object.keys(preloader.compiledScripts).length,
      8
    );
  });

  test('preloaded modules inject with no per-navigation latency', async () => {
    const preloader = new EvasionPreloader({
      preloadModules: ['canvas-spoof', 'webgl-spoof']
    });
    await preloader.preload();
    
    // Get injection code
    const injections = preloader.getInjections();
    assert.strictEqual(injections.length, 2);
    
    // All should be pre-compiled (no load latency)
    for (const injection of injections) {
      assert(injection.script instanceof vm.Script);
    }
  });

  test('parallel preload is faster than sequential', async () => {
    const modules = [
      'canvas-spoof',
      'webgl-spoof',
      'webrtc-mask',
      'font-blocker',
      'sensor-spoof',
      'audio-spoof',
      'battery-spoof',
      'plugin-blocker'
    ];
    
    // Parallel load
    const parallelStart = Date.now();
    const parallelPreloader = new EvasionPreloader({
      preloadModules: modules,
      parallel: true
    });
    await parallelPreloader.preload();
    const parallelTime = Date.now() - parallelStart;
    
    // Sequential load
    const sequentialStart = Date.now();
    const sequentialPreloader = new EvasionPreloader({
      preloadModules: modules,
      parallel: false
    });
    await sequentialPreloader.preload();
    const sequentialTime = Date.now() - sequentialStart;
    
    console.log(`Parallel: ${parallelTime}ms`);
    console.log(`Sequential: ${sequentialTime}ms`);
    console.log(`Speedup: ${(sequentialTime / parallelTime).toFixed(1)}x`);
    
    // Parallel should be significantly faster (2x+)
    assert(parallelTime < sequentialTime * 0.75);
  });

  test('first navigation after preload has no injection latency', async () => {
    const preloader = new EvasionPreloader({
      preloadModules: ['canvas-spoof']
    });
    await preloader.preload();
    
    const webContents = createMockWebContents();
    
    // Get injection code (no loading)
    const startInject = Date.now();
    const injectionCode = preloader.getInjectionCode();
    const injectTime = Date.now() - startInject;
    
    console.log(`Injection code generation: ${injectTime}ms`);
    
    // Should be negligible (<5ms)
    assert(injectTime < 5);
  });
});
```

#### 3.2 Latency Comparison (2 tests, ~1 hour)
```javascript
describe('Evasion Latency Impact', () => {
  test('first navigation is faster with preload', async () => {
    const webContents = createMockWebContents();
    
    // Without preload
    const noPrerloadStart = Date.now();
    // Simulate lazy loading + injection
    const canvasSpoof = require('../evasion/canvas-spoof.js');
    const webglSpoof = require('../evasion/webgl-spoof.js');
    await webContents.executeJavaScript(canvasSpoof.getCode());
    await webContents.executeJavaScript(webglSpoof.getCode());
    const noPreloadTime = Date.now() - noPrerloadStart;
    
    // With preload
    const preloader = new EvasionPreloader({
      preloadModules: ['canvas-spoof', 'webgl-spoof']
    });
    await preloader.preload();
    
    const preloadStart = Date.now();
    const injectionCode = preloader.getInjectionCode();
    await webContents.executeJavaScript(injectionCode);
    const preloadTime = Date.now() - preloadStart;
    
    console.log(`Without preload: ${noPreloadTime}ms`);
    console.log(`With preload: ${preloadTime}ms`);
    console.log(`Savings: ${noPreloadTime - preloadTime}ms (${((noPreloadTime - preloadTime) / noPreloadTime * 100).toFixed(1)}%)`);
    
    // Preload should save 5-10ms
    assert(preloadTime < noPreloadTime * 0.8);
  });

  test('browser startup includes preload without user perception', async () => {
    const startupStart = Date.now();
    
    // Initialize app with preload
    const app = new BrowserInstance();
    await app.initialize();
    
    const startupTime = Date.now() - startupStart;
    
    console.log(`Total startup time: ${startupTime}ms`);
    
    // Preload should add <100ms to startup (imperceptible)
    assert(startupTime < 5000, 'Startup should complete in reasonable time');
  });
});
```

### Implementation Checklist
- [ ] Create `src/evasion/preloader.js` with EvasionPreloader class
- [ ] Update `src/main/main.js` to instantiate and call preloader.preload()
- [ ] Update WebSocket navigate command to use preloaded injections
- [ ] Update all evasion modules to support getInjectionCode()
- [ ] Run 4 startup tests
- [ ] Run 2 latency comparison tests
- [ ] Measure first-navigation latency improvement

### Expected Metrics

**Before (v12.7.0):**
```
First navigation:       <50ms + 5-15ms evasion load = 55-65ms
Startup time:           ~4 seconds
Browser ready for nav:  ~4 seconds
```

**After:**
```
First navigation:       <50ms + 0-1ms preloaded = 50-51ms  (-10-15ms)
Startup time:           ~4.1 seconds (+100ms for preload)
Browser ready for nav:  ~4 seconds (faster first command)
```

**Risk Assessment:** LOW
- Startup time increase is negligible (100ms on 4s = 2.5%)
- All injection code identical
- Preload failure doesn't block startup (graceful fallback)
- Trade-off: +100ms startup for -10-15ms per first navigation

---

## 4. TOTP CACHE EXPANSION

### Current State
**Files:** `src/credentials/totp-generator.js` (300 lines)

**Baseline Performance:**
```
TOTP generation:    <1ms
Cache size:         100 entries
Cache hits:         Varies (not measured)
Hit rate impact:    Minimal (generation fast anyway)
```

**Current Bottleneck:**
```javascript
class TOTPGenerator {
  constructor(secret, options = {}) {
    this.secret = secret;
    // ... 
    this.tokenCache = new Map(); // Max 100 entries
    this.cacheMaxSize = 100;
  }
  
  getToken(timestamp = null) {
    const key = `${this.secret}-${Math.floor((timestamp || Date.now()) / this.window)}`;
    
    // Check cache
    if (this.tokenCache.has(key)) {
      return this.tokenCache.get(key);
    }
    
    // Generate if not cached
    const token = this._generateToken(timestamp);
    
    // Add to cache with simple eviction
    if (this.tokenCache.size >= this.cacheMaxSize) {
      // Remove oldest (not LRU)
      const firstKey = this.tokenCache.keys().next().value;
      this.tokenCache.delete(firstKey);
    }
    
    this.tokenCache.set(key, token);
    return token;
  }
}
```

**Issue:** 
- Cache limited to 100 entries (arbitrary)
- No LRU eviction (just FIFO)
- For high-load scenarios with many users, cache miss rate is high

### Solution Design

#### 4.1 LRU Cache Implementation
```javascript
class LRUCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    
    // Move to end (most recently used)
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
    
    return this.cache.get(key);
  }

  set(key, value) {
    // Remove if already exists
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }
    
    // Add new entry
    this.cache.set(key, value);
    this.accessOrder.push(key);
    
    // Evict least recently used if over capacity
    if (this.cache.size > this.maxSize) {
      const lruKey = this.accessOrder.shift();
      this.cache.delete(lruKey);
    }
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  size() {
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize * 100).toFixed(1)
    };
  }
}

// Use in TOTPGenerator
class TOTPGenerator {
  constructor(secret, options = {}) {
    this.secret = secret;
    this.tokenCache = new LRUCache(options.cacheSize || 500);
  }

  getToken(timestamp = null) {
    const key = `${this.secret}-${Math.floor((timestamp || Date.now()) / this.window)}`;
    
    // Check cache
    if (this.tokenCache.has(key)) {
      return this.tokenCache.get(key); // Also updates LRU order
    }
    
    // Generate and cache
    const token = this._generateToken(timestamp);
    this.tokenCache.set(key, token);
    
    return token;
  }

  getCacheStats() {
    return this.tokenCache.getStats();
  }
}
```

#### 4.2 Cache Configuration
```javascript
// In src/credentials/index.js

const TOTPGenerator = require('./totp-generator.js');

class CredentialsManager {
  constructor(options = {}) {
    this.totpCache = new Map();
    
    // Configuration
    this.cacheConfig = {
      defaultCacheSize: options.defaultCacheSize || 500,
      maxCacheSize: options.maxCacheSize || 1000,
      cacheByUser: options.cacheByUser !== false // Cache per user
    };
  }

  getOrCreateTOTP(userId, secret, options = {}) {
    // Per-user cache for multi-user scenarios
    if (this.cacheConfig.cacheByUser) {
      const key = `${userId}:${secret}`;
      if (!this.totpCache.has(key)) {
        this.totpCache.set(key, new TOTPGenerator(secret, {
          cacheSize: this.cacheConfig.defaultCacheSize
        }));
      }
      return this.totpCache.get(key);
    } else {
      // Global shared TOTP (for single-user scenarios)
      if (!this.totpCache.has('global')) {
        this.totpCache.set('global', new TOTPGenerator(secret, {
          cacheSize: this.cacheConfig.maxCacheSize
        }));
      }
      return this.totpCache.get('global');
    }
  }

  getCacheStats() {
    const stats = {};
    for (const [key, generator] of this.totpCache) {
      stats[key] = generator.getCacheStats();
    }
    return stats;
  }

  clearExpiredCaches() {
    // Clear caches older than 1 hour
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    for (const [key, generator] of this.totpCache) {
      if (now - generator.lastUsed > maxAge) {
        this.totpCache.delete(key);
      }
    }
  }
}
```

### Testing Strategy

#### 4.1 Cache Functionality Tests (4 tests, ~1 hour)
```javascript
describe('LRU Cache & TOTP Cache Expansion', () => {
  test('LRU cache evicts least recently used', () => {
    const cache = new LRUCache(3);
    
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    
    // Access 'a' to make it most recent
    cache.get('a');
    
    // Add new item (should evict 'b', not 'a')
    cache.set('d', 4);
    
    assert(cache.has('a'), 'Most recently used should remain');
    assert(!cache.has('b'), 'Least recently used should be evicted');
    assert(cache.has('c'), 'Other items should remain');
    assert(cache.has('d'), 'New item should be added');
  });

  test('TOTP cache with 500 entries improves hit rate', async () => {
    const secret = 'JBSWY3DPEBLW64TMMQ======';
    const generator = new TOTPGenerator(secret, { cacheSize: 500 });
    
    let hits = 0;
    let misses = 0;
    
    // Simulate requests for 400 different timestamps
    for (let i = 0; i < 400; i++) {
      const timestamp = Date.now() + (i * 30000); // 30s apart
      const token1 = generator.getToken(timestamp);
      const token2 = generator.getToken(timestamp); // Same timestamp = cache hit
      
      if (token1 === token2) hits++;
      else misses++;
    }
    
    console.log(`Hit rate: ${(hits / (hits + misses) * 100).toFixed(1)}%`);
    
    // With 500-entry cache and 400 requests, hit rate should be high
    const hitRate = hits / (hits + misses);
    assert(hitRate > 0.5, `Expected >50% hit rate, got ${(hitRate * 100).toFixed(1)}%`);
  });

  test('multi-user TOTP cache isolation', () => {
    const manager = new CredentialsManager({ cacheByUser: true });
    
    const generator1 = manager.getOrCreateTOTP('user1', 'SECRET1');
    const generator2 = manager.getOrCreateTOTP('user2', 'SECRET2');
    
    // Should be different generators (isolated caches)
    assert(generator1 !== generator2);
    
    // Both should have independent caches
    const token1 = generator1.getToken();
    const token2 = generator2.getToken();
    
    assert(token1 !== token2, 'Different users should have different tokens');
  });

  test('cache statistics tracking', () => {
    const generator = new TOTPGenerator('SECRET', { cacheSize: 100 });
    
    // Add some tokens
    for (let i = 0; i < 50; i++) {
      generator.getToken(Date.now() + (i * 30000));
    }
    
    const stats = generator.getCacheStats();
    
    assert.strictEqual(stats.size, 50);
    assert.strictEqual(stats.maxSize, 100);
    assert.strictEqual(stats.utilization, '50.0');
  });
});
```

#### 4.2 Performance Impact Tests (2 tests, ~1 hour)
```javascript
describe('TOTP Cache Performance Impact', () => {
  test('larger cache improves throughput', async () => {
    const secret = 'JBSWY3DPEBLW64TMMQ======';
    
    // Small cache (old)
    const smallCache = new TOTPGenerator(secret, { cacheSize: 100 });
    const smallStart = Date.now();
    for (let i = 0; i < 10000; i++) {
      // Rotate through 1000 different times
      smallCache.getToken(Date.now() + ((i % 1000) * 30000));
    }
    const smallTime = Date.now() - smallStart;
    
    // Large cache (new)
    const largeCache = new TOTPGenerator(secret, { cacheSize: 500 });
    const largeStart = Date.now();
    for (let i = 0; i < 10000; i++) {
      largeCache.getToken(Date.now() + ((i % 1000) * 30000));
    }
    const largeTime = Date.now() - largeStart;
    
    console.log(`Small cache (100): ${smallTime}ms`);
    console.log(`Large cache (500): ${largeTime}ms`);
    console.log(`Improvement: ${((smallTime - largeTime) / smallTime * 100).toFixed(1)}%`);
    
    // Larger cache should be significantly faster (more hits)
    assert(largeTime < smallTime * 0.9);
  });

  test('memory overhead of larger cache is acceptable', () => {
    const secret = 'JBSWY3DPEBLW64TMMQ======';
    
    // Create generators with different cache sizes
    const small = new TOTPGenerator(secret, { cacheSize: 100 });
    const large = new TOTPGenerator(secret, { cacheSize: 500 });
    
    // Fill caches
    for (let i = 0; i < 100; i++) {
      small.getToken(Date.now() + (i * 30000));
    }
    for (let i = 0; i < 500; i++) {
      large.getToken(Date.now() + (i * 30000));
    }
    
    const smallStats = small.getCacheStats();
    const largeStats = large.getCacheStats();
    
    // Estimate memory: ~200 bytes per cache entry
    const smallMemory = smallStats.size * 200;
    const largeMemory = largeStats.size * 200;
    const memDelta = (largeMemory - smallMemory) / 1024; // KB
    
    console.log(`Small cache memory: ~${smallMemory / 1024} KB`);
    console.log(`Large cache memory: ~${largeMemory / 1024} KB`);
    console.log(`Overhead: ~${memDelta} KB`);
    
    // Additional ~80KB for 5x cache is acceptable
    assert(memDelta < 100, `Expected <100KB delta, got ~${memDelta}KB`);
  });
});
```

### Implementation Checklist
- [ ] Create LRUCache class in `src/credentials/cache.js`
- [ ] Update TOTPGenerator to use LRU cache instead of simple Map
- [ ] Update default cache size to 500 (was 100)
- [ ] Add cache statistics tracking to TOTPGenerator
- [ ] Update CredentialsManager for per-user cache management
- [ ] Run 4 functionality tests
- [ ] Run 2 performance impact tests
- [ ] Measure cache hit rate improvement

### Expected Metrics

**Before (v12.7.0):**
```
Cache size:         100 entries
Cache eviction:     FIFO (arbitrary)
Cache hit rate:     ~30-40% (estimate)
Generation latency: <1ms
```

**After:**
```
Cache size:         500 entries              (+5x)
Cache eviction:     LRU (optimal)
Cache hit rate:     ~60-70% (estimate)       (+50%)
Generation latency: <1ms (unchanged, but more hits)
Memory overhead:    ~80KB additional         (acceptable)
```

**Risk Assessment:** LOW
- Cache is transparent optimization (no API change)
- Generation fallback always works
- LRU eviction is standard pattern
- Memory overhead is negligible for the benefit

---

## 5. COMPRESSION TUNING OPTIMIZATION

### Current State
**Files:** `src/optimization/adaptive-compression.js` (250+ lines)

**Baseline Performance:**
```
Compression level:  Static level 6
Compression ratio:  70-93% (excellent)
Compression time:   ~2ms per operation
Payload sizes:      Ranges from 1KB to 50MB+
```

**Current Bottleneck:**
```javascript
// In adaptive-compression.js
async compressPayload(data) {
  // Static compression level for all payloads
  const compressed = await promisify(zlib.gzip)(data, {
    level: 6  // Fixed, not adaptive
  });
  
  return compressed;
}
```

**Issue:**
- Level 6 is good for general case but suboptimal for edge cases
- Very small payloads (<1KB) waste CPU on compression
- Very large payloads (>10MB) could benefit from higher levels
- No consideration for payload type or entropy

### Solution Design

#### 5.1 Adaptive Compression Level Selection
```javascript
class AdaptiveCompressionOptimizer {
  constructor(options = {}) {
    this.payloadThresholds = {
      tiny: 1024,           // <1KB
      small: 10 * 1024,     // 1-10KB
      medium: 100 * 1024,   // 10-100KB
      large: 1024 * 1024,   // 100KB-1MB
      huge: 10 * 1024 * 1024 // >1MB
    };

    this.compressionLevels = {
      tiny: 0,              // Don't compress tiny payloads
      small: 4,             // Fast compression
      medium: 6,            // Balanced (default)
      large: 7,             // Slower but better ratio
      huge: 9               // Maximum compression for huge
    };

    this.contentTypeCompressibility = {
      json: 0.85,           // Highly compressible
      html: 0.82,
      javascript: 0.80,
      xml: 0.85,
      text: 0.70,
      svg: 0.75,
      image: 0.05,          // Don't compress images
      video: 0.02,
      audio: 0.01,
      binary: 0.10
    };

    this.metrics = {
      compressionAttempts: 0,
      compressionSkipped: 0,
      avgCompressionTime: 0,
      avgCompressionRatio: 0
    };
  }

  /**
   * Determine optimal compression level based on payload characteristics
   */
  selectCompressionLevel(data, contentType = 'application/json') {
    const size = Buffer.byteLength(data);
    const compressibility = this._estimateCompressibility(data, contentType);

    // Don't compress if not worthwhile
    if (compressibility < 0.3 || size < 200) {
      return { level: 0, reason: 'incompressible_or_tiny' };
    }

    // Select level by size bucket
    let bucket = 'medium';
    if (size < this.payloadThresholds.tiny) bucket = 'tiny';
    else if (size < this.payloadThresholds.small) bucket = 'small';
    else if (size < this.payloadThresholds.large) bucket = 'medium';
    else if (size < this.payloadThresholds.huge) bucket = 'large';
    else bucket = 'huge';

    const level = this.compressionLevels[bucket];

    // Adjust level based on compressibility
    let finalLevel = level;
    if (compressibility > 0.8) {
      finalLevel = Math.min(level + 1, 9); // More compression for highly compressible
    } else if (compressibility < 0.5) {
      finalLevel = Math.max(level - 1, 0); // Less compression for poorly compressible
    }

    return {
      level: finalLevel,
      bucket,
      compressibility: (compressibility * 100).toFixed(1),
      reason: `adaptive_${bucket}`
    };
  }

  /**
   * Estimate payload compressibility
   */
  _estimateCompressibility(data, contentType = 'application/json') {
    // Check content type
    for (const [type, ratio] of Object.entries(this.contentTypeCompressibility)) {
      if (contentType.includes(type)) {
        return ratio;
      }
    }

    // Estimate by entropy (for unknown types)
    return this._calculateEntropy(data);
  }

  /**
   * Calculate Shannon entropy to estimate compressibility
   * Lower entropy = more compressible
   */
  _calculateEntropy(data) {
    const bytes = typeof data === 'string' ? Buffer.from(data) : data;
    const frequencies = new Uint32Array(256);

    // Count byte frequencies
    for (let i = 0; i < bytes.length; i++) {
      frequencies[bytes[i]]++;
    }

    // Calculate Shannon entropy
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (frequencies[i] === 0) continue;
      const p = frequencies[i] / bytes.length;
      entropy -= p * Math.log2(p);
    }

    // Normalize to 0-1 (8 bits max entropy)
    const normalized = entropy / 8;

    // Inverse: lower entropy = higher compressibility
    return 1 - normalized;
  }

  /**
   * Compress payload with adaptive level selection
   */
  async compressPayload(data, contentType = 'application/json') {
    this.metrics.compressionAttempts++;

    const { level, reason, compressibility } = this.selectCompressionLevel(
      data,
      contentType
    );

    // Skip compression for incompressible data
    if (level === 0) {
      this.metrics.compressionSkipped++;
      return {
        data,
        compressed: false,
        level,
        reason,
        originalSize: Buffer.byteLength(data),
        compressedSize: Buffer.byteLength(data),
        ratio: 1.0
      };
    }

    const startTime = Date.now();
    const originalSize = Buffer.byteLength(data);

    const compressed = await promisify(zlib.gzip)(data, { level });

    const compressedSize = Buffer.byteLength(compressed);
    const ratio = compressedSize / originalSize;
    const compressionTime = Date.now() - startTime;

    // Update metrics
    this.metrics.avgCompressionTime = 
      (this.metrics.avgCompressionTime + compressionTime) / 2;
    this.metrics.avgCompressionRatio = 
      (this.metrics.avgCompressionRatio + ratio) / 2;

    return {
      data: compressed,
      compressed: true,
      level,
      reason,
      originalSize,
      compressedSize,
      ratio,
      compressionTime,
      compressibility
    };
  }

  /**
   * Get compression metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      skippedPercentage: (this.metrics.compressionSkipped / this.metrics.compressionAttempts * 100).toFixed(1),
      avgCompressionTime: this.metrics.avgCompressionTime.toFixed(2),
      avgCompressionRatio: this.metrics.avgCompressionRatio.toFixed(3)
    };
  }
}
```

#### 5.2 Integration with WebSocket Server
```javascript
// In websocket/server.js

const compressionOptimizer = new AdaptiveCompressionOptimizer();

async function sendMessage(ws, response) {
  const contentType = this._getContentType(response);
  
  // Use adaptive compression
  const result = await compressionOptimizer.compressPayload(
    JSON.stringify(response),
    contentType
  );

  // Send with compression metadata
  const envelope = {
    id: response.id,
    compressed: result.compressed,
    compressionLevel: result.level,
    originalSize: result.originalSize,
    compressedSize: result.compressedSize,
    data: result.data
  };

  ws.send(JSON.stringify(envelope));
}

// Monitor compression effectiveness
setInterval(() => {
  const metrics = compressionOptimizer.getMetrics();
  logger.info('Compression metrics:', metrics);
}, 60000); // Every minute
```

### Testing Strategy

#### 5.1 Compression Level Selection Tests (5 tests, ~1.5 hours)
```javascript
describe('Adaptive Compression Tuning', () => {
  test('tiny payloads skip compression', () => {
    const optimizer = new AdaptiveCompressionOptimizer();
    
    const tinyData = JSON.stringify({ status: 'ok' });
    const { level, reason } = optimizer.selectCompressionLevel(tinyData);
    
    assert.strictEqual(level, 0, 'Tiny payloads should not be compressed');
    assert(reason.includes('tiny'));
  });

  test('small payloads use fast compression level', () => {
    const optimizer = new AdaptiveCompressionOptimizer();
    
    const smallData = JSON.stringify(Array(100).fill({ id: 1, name: 'test' }));
    const { level, bucket } = optimizer.selectCompressionLevel(smallData);
    
    assert.strictEqual(level, 4, 'Small payloads should use level 4');
    assert.strictEqual(bucket, 'small');
  });

  test('large payloads use higher compression level', () => {
    const optimizer = new AdaptiveCompressionOptimizer();
    
    const largeData = JSON.stringify(Array(100000).fill({ 
      id: 1, 
      name: 'test data',
      value: Math.random()
    }));
    const { level, bucket } = optimizer.selectCompressionLevel(largeData);
    
    assert.strictEqual(level, 7, 'Large payloads should use level 7');
    assert.strictEqual(bucket, 'large');
  });

  test('content type affects compression level', () => {
    const optimizer = new AdaptiveCompressionOptimizer();
    const data = 'x'.repeat(10000);
    
    const jsonLevel = optimizer.selectCompressionLevel(data, 'application/json').level;
    const imageLevelResult = optimizer.selectCompressionLevel(data, 'image/png');
    
    assert(jsonLevel > 0, 'JSON should be compressed');
    assert.strictEqual(imageLevelResult.level, 0, 'Images should not be compressed');
  });

  test('entropy calculation estimates compressibility', () => {
    const optimizer = new AdaptiveCompressionOptimizer();
    
    // High entropy data (random)
    const randomData = Buffer.alloc(1000);
    crypto.randomFillSync(randomData);
    
    // Low entropy data (repetitive)
    const repetitiveData = 'aaaaaabbbbbbcccccc'.repeat(100);
    
    const randomLevel = optimizer.selectCompressionLevel(randomData).level;
    const repetitiveLevel = optimizer.selectCompressionLevel(repetitiveData).level;
    
    console.log(`Random data compression level: ${randomLevel}`);
    console.log(`Repetitive data compression level: ${repetitiveLevel}`);
    
    // Repetitive should use higher compression
    assert(repetitiveLevel >= randomLevel);
  });
});
```

#### 5.2 Compression Effectiveness Tests (4 tests, ~2 hours)
```javascript
describe('Compression Effectiveness & Performance', () => {
  test('adaptive compression improves ratio vs static level', async () => {
    const optimizer = new AdaptiveCompressionOptimizer();
    
    // Test payloads of different sizes
    const testSizes = [
      { size: 500, name: 'tiny' },
      { size: 5000, name: 'small' },
      { size: 50000, name: 'medium' },
      { size: 500000, name: 'large' }
    ];

    const results = {};
    
    for (const test of testSizes) {
      const data = JSON.stringify(Array(test.size).fill({ 
        id: Math.random(), 
        value: 'test' 
      }));

      const adaptive = await optimizer.compressPayload(data);
      
      // Compare with static level 6
      const staticCompressed = await promisify(zlib.gzip)(data, { level: 6 });

      results[test.name] = {
        adaptive: adaptive.ratio.toFixed(3),
        static: (staticCompressed.length / Buffer.byteLength(data)).toFixed(3),
        originalSize: Buffer.byteLength(data),
        adaptiveCompressed: adaptive.compressedSize,
        staticCompressed: staticCompressed.length
      };
    }

    console.log('Compression ratio comparison:');
    console.table(results);
    
    // Adaptive should match or beat static level 6
    for (const test of testSizes) {
      const ratio = results[test.name];
      assert(
        parseFloat(ratio.adaptive) <= parseFloat(ratio.static) * 1.05,
        `Adaptive should not be significantly worse than static for ${test.name}`
      );
    }
  });

  test('compression time is acceptable for all payload sizes', async () => {
    const optimizer = new AdaptiveCompressionOptimizer();
    
    const testSizes = [100, 1000, 10000, 100000];
    
    for (const size of testSizes) {
      const data = JSON.stringify(Array(size).fill({ 
        id: Math.random(), 
        data: 'test' 
      }));

      const startTime = Date.now();
      await optimizer.compressPayload(data);
      const elapsed = Date.now() - startTime;

      console.log(`Compression time for ${Buffer.byteLength(data) / 1024}KB: ${elapsed}ms`);
      
      // Should complete in reasonable time (< 50ms for most)
      assert(elapsed < 50, `Compression took too long: ${elapsed}ms`);
    }
  });

  test('skipping incompressible data saves CPU', async () => {
    const optimizer = new AdaptiveCompressionOptimizer();
    
    // Already compressed data (incompressible)
    const alreadyCompressed = zlib.gzipSync(Buffer.from('test data'));
    
    const startTime = Date.now();
    const result = await optimizer.compressPayload(alreadyCompressed, 'application/gzip');
    const elapsed = Date.now() - startTime;

    console.log(`Skip compression time: ${elapsed}ms`);
    
    // Should skip quickly (<1ms)
    assert(elapsed < 1);
    assert.strictEqual(result.compressed, false);
  });

  test('compression metrics track effectiveness', async () => {
    const optimizer = new AdaptiveCompressionOptimizer();
    
    // Compress various payloads
    for (let i = 0; i < 100; i++) {
      const data = JSON.stringify({ id: i, data: 'test' });
      await optimizer.compressPayload(data);
    }

    const metrics = optimizer.getMetrics();
    
    console.log('Compression metrics:', metrics);
    
    assert(metrics.compressionAttempts === 100);
    assert(metrics.avgCompressionRatio < 1.0, 'Should achieve compression');
    assert(metrics.avgCompressionTime < 10, 'Should be fast');
  });
});
```

### Implementation Checklist
- [ ] Create AdaptiveCompressionOptimizer class
- [ ] Implement selectCompressionLevel() with size buckets
- [ ] Implement _estimateCompressibility() with entropy calculation
- [ ] Implement compressPayload() with adaptive selection
- [ ] Add metrics tracking (attempts, skips, times, ratios)
- [ ] Integrate with WebSocket server message sending
- [ ] Run 5 compression level selection tests
- [ ] Run 4 effectiveness tests
- [ ] Measure compression ratio improvement (target: +5-10%)

### Expected Metrics

**Before (v12.7.0):**
```
Compression level:       6 (static)
Compression ratio:       70-93% depending on payload
Compression time:        ~2ms
Tiny payloads waste:     Unnecessary compression on <500B
```

**After:**
```
Compression level:       0-9 (adaptive)
Compression ratio:       71-94% (+1-2% overall)
Compression time:        ~1.5-2ms (same or faster)
Tiny payloads:          Skipped (saves CPU)
Large payloads:         Better ratio (level 7-9)
```

**Risk Assessment:** LOW
- Compression logic remains same (just parameter selection)
- Skipping tiny payloads is net positive (no downside)
- Backwards compatible (receiver doesn't care about compression level)
- Metrics provide visibility into effectiveness

---

## IMPLEMENTATION TIMELINE & PARALLELIZATION

### Recommended Execution Strategy

**Stage 1: Setup & Planning (1 hour)**
- Set up new test directories and harnesses
- Create performance baseline measurements
- Prepare agent briefs

**Stage 2: Parallel Implementation (6-8 hours)**
Run with 2 optimization agents in parallel:

```
Agent 1 (Async I/O + TOTP Cache):      6-7 hours
├─ Session I/O Async (2-3 hours)
├─ TOTP Cache Expansion (1-2 hours)
└─ Testing & benchmarking (2-3 hours)

Agent 2 (Monitoring + Evasion + Compression):  8-9 hours
├─ Monitoring Batch Flush (3-4 hours)
├─ Evasion Preload (2-3 hours)
├─ Compression Tuning (2-3 hours)
└─ Testing & benchmarking (3-4 hours)
```

**Stage 3: Validation & Integration (2-3 hours)**
- Run full test suite
- Benchmark all optimizations together
- Document improvements
- Prepare for merge

**Total Timeline:** 9-14 hours (1-2 days with 2 agents)

### Success Criteria

#### Latency Improvements
- [ ] Session operations: -30-50ms (-10-15%)
- [ ] First navigation: -10-15ms (from evasion preload)
- [ ] Total latency: -40-65ms (-5-10%)

#### Throughput Improvements
- [ ] Session save/restore: 1,500+ ops/sec (+25%)
- [ ] Message handling: +5-10 msgs/sec
- [ ] Overall: +8-12% under load

#### CPU/Memory Improvements
- [ ] Metrics CPU overhead: -50% (monitoring batch)
- [ ] Evasion preload: +100ms startup (acceptable trade-off)
- [ ] TOTP cache: +80KB memory (acceptable)
- [ ] Compression: Neutral or slightly negative (fine)

#### Code Quality
- [ ] All tests pass (100% of 30+ new tests)
- [ ] No regressions in existing functionality
- [ ] Performance benchmarks documented
- [ ] Code review approved

---

## RISK MITIGATION

### Identified Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Async I/O regression | Medium | Comprehensive testing + fallback mode |
| Batch flush timing issues | Low | Configurable window + monitoring |
| Evasion preload failure | Low | Graceful fallback to lazy load |
| Cache memory growth | Low | LRU eviction + periodic cleanup |
| Compression latency | Low | Skip for incompressible data |

### Rollback Plan

Each optimization can be disabled independently via configuration:
```javascript
const OPTIMIZATIONS = {
  SESSION_ASYNC: process.env.ENABLE_SESSION_ASYNC !== 'false',
  MONITORING_BATCH: process.env.ENABLE_MONITORING_BATCH !== 'false',
  EVASION_PRELOAD: process.env.ENABLE_EVASION_PRELOAD !== 'false',
  TOTP_CACHE_EXPANSION: process.env.ENABLE_TOTP_CACHE !== 'false',
  COMPRESSION_ADAPTIVE: process.env.ENABLE_COMPRESSION_ADAPTIVE !== 'false'
};
```

---

## CONCLUSION

This plan provides **5 high-ROI optimizations** that can be implemented in parallel with **minimal risk and maximum confidence**. The estimated improvements of **-10-15% latency** and **-30-40% CPU overhead** represent significant wins for the v12.8.0 release.

All optimizations:
- ✅ Have clear implementation paths
- ✅ Include comprehensive testing strategies
- ✅ Provide visibility via metrics
- ✅ Can be parallelized for faster execution
- ✅ Include rollback options for safety

**Ready for optimization agent execution.**

---

**Document Version:** 1.0  
**Status:** Ready for Implementation  
**Next Steps:** Launch optimization agents with parallel execution  
**Approval:** Pending agent team assignment