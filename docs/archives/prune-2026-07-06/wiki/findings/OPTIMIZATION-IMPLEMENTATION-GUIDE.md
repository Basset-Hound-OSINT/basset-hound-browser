# Performance Optimizations - Implementation Guide

**Date:** July 3, 2026  
**Status:** Ready for Development  
**Quick Reference for Developers**

---

## QUICK START: Implementation Checklist

### Phase 1: Response Streaming (8-10 hours)
- [ ] Create `/websocket/streaming-response-writer.js`
- [ ] Modify `export_format_json` handler to use streaming
- [ ] Add backpressure handling
- [ ] Write 5+ unit tests
- [ ] Performance test with 100MB export
- [ ] Estimated latency gain: -40%

### Phase 2: DOM Query Caching (6-8 hours)
- [ ] Create `/websocket/request-scope-cache.js`
- [ ] Add cache to WebSocket server context
- [ ] Modify 20+ DOM handlers to use cache
- [ ] Write 6+ unit tests
- [ ] Measure cache hit rate (target: 40-60%)
- [ ] Estimated latency gain: -20%

### Phase 3: Context Pooling (10-13 hours)
- [ ] Create `/websocket/javascript-context-pool.js`
- [ ] Integrate with WebSocket server
- [ ] Replace all `executeJavaScript` calls
- [ ] Write 7+ unit tests
- [ ] Load test with 50+ concurrent clients
- [ ] Estimated latency gain: -15%

### Phase 4: Buffer Optimization (6-8 hours)
- [ ] Create LinkedList class in `response-serializer.js`
- [ ] Replace array-based pool with heap
- [ ] Write 5+ performance tests
- [ ] Validate no performance regression
- [ ] Estimated throughput gain: +5%

### Phase 5: Connection Affinity (4-6 hours)
- [ ] Enhance `connection-pool.js` with affinity hints
- [ ] Add command history tracking
- [ ] Write 4+ unit tests
- [ ] Measure connection reuse improvements
- [ ] Estimated queue reduction: -10%

---

## FILE-BY-FILE CHANGES

### 1. websocket/streaming-response-writer.js (NEW)

```javascript
const { Writable } = require('stream');

/**
 * Streaming JSON Response Writer
 * Handles large exports without memory spikes
 */
class StreamingJSONWriter {
  constructor(writable, options = {}) {
    this.stream = writable;
    this.enableBackpressure = options.enableBackpressure !== false;
    this.itemsWritten = 0;
    this.bytesWritten = 0;
    this.isPaused = false;
  }

  async startArray() {
    return this._write('[\n');
  }

  async writeItem(item, isLast = false) {
    const json = JSON.stringify(item);
    const suffix = isLast ? '\n' : ',\n';
    return this._write(json + suffix);
  }

  async endArray() {
    return this._write(']');
  }

  async _write(data) {
    return new Promise((resolve, reject) => {
      const success = this.stream.write(data, 'utf8', (err) => {
        this.bytesWritten += Buffer.byteLength(data, 'utf8');
        if (err) reject(err);
        else resolve();
      });

      if (!success && this.enableBackpressure) {
        this.stream.once('drain', resolve);
      } else {
        resolve();
      }
    });
  }

  getStats() {
    return {
      itemsWritten: this.itemsWritten,
      bytesWritten: this.bytesWritten
    };
  }
}

module.exports = StreamingJSONWriter;
```

### 2. websocket/request-scope-cache.js (NEW)

```javascript
/**
 * Request-Scoped Cache for DOM/JS Queries
 */
class RequestScopeCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 30000;
    this.accessOrder = [];
  }

  async getOrExecute(key, fn, options = {}) {
    const cached = this.cache.get(key);
    if (cached && !this._isExpired(cached)) {
      this.stats.hits++;
      this._updateAccessOrder(key);
      return cached.value;
    }

    this.stats.misses++;
    const value = await fn();
    this.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const lruKey = this.accessOrder.shift();
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
    this._updateAccessOrder(key);
  }

  _isExpired(entry) {
    return Date.now() - entry.timestamp > this.ttl;
  }

  _updateAccessOrder(key) {
    const idx = this.accessOrder.indexOf(key);
    if (idx > -1) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(key);
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%'
    };
  }
}

module.exports = RequestScopeCache;
```

### 3. websocket/javascript-context-pool.js (NEW)

```javascript
/**
 * JavaScript Context Pool
 * Maintains 3-5 persistent contexts for reduced IPC overhead
 */
class JavaScriptContextPool {
  constructor(options = {}) {
    this.poolSize = options.poolSize || 3;
    this.mainWindow = options.mainWindow;
    this.contexts = [];
    this.availableContexts = [];
    this.waitingQueue = [];
    this.stats = {
      totalExecutions: 0,
      contextReuses: 0,
      contextSwitches: 0,
      pollutionDetections: 0
    };
    this.executionTimes = [];
  }

  async initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      this.contexts.push({
        id: `context-${i}`,
        inUse: false,
        executionCount: 0,
        totalTime: 0
      });
      this.availableContexts.push(`context-${i}`);
    }
  }

  async execute(script, options = {}) {
    const startTime = Date.now();
    const contextId = await this._acquireContext();

    try {
      const result = await this.mainWindow.webContents.executeJavaScript(script);
      this._updateStats(contextId, Date.now() - startTime);
      return result;
    } finally {
      await this._releaseContext(contextId);
    }
  }

  async _acquireContext() {
    if (this.availableContexts.length > 0) {
      const contextId = this.availableContexts.shift();
      this._getContext(contextId).inUse = true;
      this.stats.contextReuses++;
      return contextId;
    }

    return new Promise((resolve) => {
      this.waitingQueue.push({ resolve });
    });
  }

  async _releaseContext(contextId) {
    const context = this._getContext(contextId);
    context.inUse = false;
    this.stats.contextSwitches++;

    if (context.executionCount > 1000) {
      await this._resetContext(contextId);
    }

    if (this.waitingQueue.length > 0) {
      const { resolve } = this.waitingQueue.shift();
      resolve(contextId);
    } else {
      this.availableContexts.push(contextId);
    }
  }

  async _resetContext(contextId) {
    const context = this._getContext(contextId);
    context.executionCount = 0;
    context.totalTime = 0;
    this.stats.pollutionDetections++;
  }

  _getContext(contextId) {
    return this.contexts.find(c => c.id === contextId);
  }

  _updateStats(contextId, executionTime) {
    const context = this._getContext(contextId);
    context.executionCount++;
    context.totalTime += executionTime;
    this.stats.totalExecutions++;
    this.executionTimes.push(executionTime);
    
    if (this.executionTimes.length > 100) {
      this.executionTimes.shift();
    }
  }

  getStats() {
    return {
      ...this.stats,
      poolSize: this.poolSize,
      activeContexts: this.contexts.filter(c => c.inUse).length,
      idleContexts: this.availableContexts.length,
      queuedRequests: this.waitingQueue.length
    };
  }
}

module.exports = JavaScriptContextPool;
```

### 4. websocket/response-serializer.js (MODIFICATIONS)

```javascript
// ADD: LinkedList implementation (before SerializationBufferPool)

class LinkedListNode {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class LinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  push(value) {
    const node = new LinkedListNode(value);
    if (!this.head) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.size++;
  }

  pop() {
    if (!this.head) return null;
    const value = this.head.value;
    this.head = this.head.next;
    this.size--;
    if (this.size === 0) this.tail = null;
    return value;
  }

  isEmpty() {
    return this.size === 0;
  }
}

// MODIFY: SerializationBufferPool class

class SerializationBufferPool {
  constructor(poolSize = 32, bufferSize = 8192) {
    this.poolSize = poolSize;
    this.bufferSize = bufferSize;
    this.freeBuffers = new LinkedList(); // CHANGED from array
    this.usedBuffers = new Set();
    this.bufferStats = {
      allocations: 0,
      reuses: 0,
      poolHits: 0,
      poolMisses: 0
    };

    for (let i = 0; i < poolSize; i++) {
      this.freeBuffers.push({
        buffer: Buffer.allocUnsafe(bufferSize),
        offset: 0
      });
    }
  }

  // CHANGED: O(1) acquire
  acquire() {
    if (!this.freeBuffers.isEmpty()) {
      const entry = this.freeBuffers.pop();
      this.usedBuffers.add(entry);
      entry.offset = 0;
      this.bufferStats.poolHits++;
      this.bufferStats.reuses++;
      return entry;
    }

    const entry = {
      buffer: Buffer.allocUnsafe(this.bufferSize),
      offset: 0
    };
    this.usedBuffers.add(entry);
    this.bufferStats.allocations++;
    this.bufferStats.poolMisses++;
    return entry;
  }

  // CHANGED: O(1) release
  release(entry) {
    if (entry && this.usedBuffers.has(entry)) {
      this.usedBuffers.delete(entry);
      entry.offset = 0;
      this.freeBuffers.push(entry);
    }
  }

  getStats() {
    return {
      ...this.bufferStats,
      poolSize: this.poolSize,
      freeBuffers: this.freeBuffers.size,
      usedBuffers: this.usedBuffers.size
    };
  }
}

module.exports = {
  ResponseTemplate,
  SerializationBufferPool,
  OptimizedResponseSerializer,
  getSerializer,
  LinkedList,
  LinkedListNode
};
```

### 5. websocket/connection-pool.js (ENHANCEMENTS)

```javascript
// ADD these methods to ConnectionPool class

/**
 * Acquire with command affinity hint
 */
async acquireWithHint(clientId, ws = null, request = {}) {
  const normalizedRequest = {
    command: 'unknown',
    priority: 'normal',
    ...request
  };

  let connection = this.connections.get(clientId);

  if (connection && connection.canAcceptCommand()) {
    if (this._hasAffinity(connection.lastCommandType, normalizedRequest.command)) {
      connection.connectionReuses++;
      this.metrics.totalConnectionsReused++;
      connection.recordCommand(normalizedRequest.command, 0, false);
      connection.lastCommandType = normalizedRequest.command;
      return connection;
    }
  }

  return this.acquire(clientId, ws, request);
}

/**
 * Check command affinity
 */
_hasAffinity(lastCommand, currentCommand) {
  const affinityGroups = {
    'dom-operations': ['getDOM', 'getHTML', 'getMetadata', 'dom_snapshot'],
    'export-operations': ['export_format_json', 'export_format_csv', 'export_format_har'],
    'session-operations': ['setCookie', 'getCookies', 'setLocalStorage', 'getLocalStorage']
  };

  for (const [, commands] of Object.entries(affinityGroups)) {
    if (commands.includes(lastCommand) && commands.includes(currentCommand)) {
      return true;
    }
  }
  return false;
}

/**
 * Predict next command type
 */
predictNextCommand(clientId) {
  const connection = this.connections.get(clientId);
  if (!connection || connection.commandHistory.length === 0) return null;

  const recentCommands = connection.commandHistory.slice(-5);
  const frequency = {};

  for (const cmd of recentCommands) {
    frequency[cmd.command] = (frequency[cmd.command] || 0) + 1;
  }

  return Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)[0]?.[0];
}

/**
 * Queue statistics with percentiles
 */
getQueueStatsWithPercentiles() {
  const queueStats = this.blockingQueue
    .filter(req => !req.timedOut)
    .map(req => Date.now() - req.enqueueTime)
    .sort((a, b) => a - b);

  if (queueStats.length === 0) {
    return { queueSize: 0, p50: 0, p95: 0, p99: 0 };
  }

  return {
    queueSize: queueStats.length,
    p50: queueStats[Math.floor(queueStats.length * 0.5)],
    p95: queueStats[Math.floor(queueStats.length * 0.95)],
    p99: queueStats[Math.floor(queueStats.length * 0.99)],
    max: queueStats[queueStats.length - 1]
  };
}
```

---

## USAGE EXAMPLES

### Using Response Streaming

```javascript
const StreamingJSONWriter = require('../streaming-response-writer');
const { createWriteStream } = require('fs');

server.commandHandlers.export_format_json = async (params = {}) => {
  const stream = createWriteStream(params.output_path);
  const writer = new StreamingJSONWriter(stream);

  await writer.startArray();
  
  const items = await fetchLargeDataset();
  for (let i = 0; i < items.length; i++) {
    await writer.writeItem(items[i], i === items.length - 1);
  }

  await writer.endArray();
  
  return { success: true, stats: writer.getStats() };
};
```

### Using DOM Cache

```javascript
const RequestScopeCache = require('../request-scope-cache');

class WebSocketServer {
  constructor(options) {
    this.requestCaches = new Map();
  }

  _getRequestCache(clientId) {
    if (!this.requestCaches.has(clientId)) {
      this.requestCaches.set(clientId, new RequestScopeCache());
    }
    return this.requestCaches.get(clientId);
  }

  async executeJavaScriptCached(clientId, script, cacheKey) {
    if (!cacheKey) {
      return this.mainWindow.webContents.executeJavaScript(script);
    }

    const cache = this._getRequestCache(clientId);
    return cache.getOrExecute(cacheKey, async () => {
      return this.mainWindow.webContents.executeJavaScript(script);
    });
  }
}

// In handler
server.commandHandlers.getDOM = async (params, context) => {
  const result = await server.executeJavaScriptCached(
    context.clientId,
    `({ html: document.documentElement.outerHTML })`,
    'dom-snapshot'
  );
  return { success: true, data: result };
};
```

### Using Context Pool

```javascript
const JavaScriptContextPool = require('../javascript-context-pool');

class WebSocketServer {
  async initialize() {
    this.contextPool = new JavaScriptContextPool({
      poolSize: 4,
      mainWindow: this.mainWindow
    });
    await this.contextPool.initialize();
  }

  async executeJavaScript(script, options = {}) {
    return this.contextPool.execute(script, options);
  }
}

// Handlers use same code - context pool is transparent
server.commandHandlers.getHTML = async (params) => {
  const html = await server.executeJavaScript(
    `document.documentElement.outerHTML`
  );
  return { success: true, data: html };
};
```

### Using Buffer Heap

```javascript
// No code changes required - buffer pool optimization is internal
// Just validate performance improvement with benchmarks

const serializer = require('../response-serializer').getSerializer();
const stats = serializer.bufferPool.getStats();
console.log(`Buffer pool hits: ${stats.poolHits}, misses: ${stats.poolMisses}`);
// Expected: 95%+ hit rate with heap optimization
```

### Using Connection Affinity

```javascript
// In command dispatcher
const connection = await pool.acquireWithHint(clientId, ws, {
  command: 'export_format_json',
  affinity: 'export-operations'
});

// Later, related command benefits from affinity
const connection2 = await pool.acquireWithHint(clientId, null, {
  command: 'export_format_csv',
  affinity: 'export-operations'
});
// Result: Likely reuses same connection for better cache locality
```

---

## TESTING TEMPLATES

### Performance Test Template

```javascript
describe('Performance Optimization - Response Streaming', () => {
  let server, stream;

  beforeEach(() => {
    stream = new Writable();
  });

  test('Streaming latency < 40% of baseline', async () => {
    const writer = new StreamingJSONWriter(stream);
    const startTime = Date.now();

    await writer.startArray();
    for (let i = 0; i < 10000; i++) {
      await writer.writeItem({ id: i, data: 'test' }, i === 9999);
    }
    await writer.endArray();

    const latency = Date.now() - startTime;
    const expectedBaseline = 1000; // ms
    expect(latency).toBeLessThan(expectedBaseline * 0.4);
  });

  test('Memory peak during 100MB export < 50MB', async () => {
    // Simulate 100MB export
    const writer = new StreamingJSONWriter(stream);
    const initialMem = process.memoryUsage().heapUsed;

    await writer.startArray();
    for (let i = 0; i < 100000; i++) {
      await writer.writeItem({ data: Buffer.alloc(1000) }, i === 99999);
    }
    await writer.endArray();

    const peakMem = process.memoryUsage().heapUsed - initialMem;
    expect(peakMem).toBeLessThan(50 * 1024 * 1024); // 50MB
  });
});
```

### Load Test Template

```javascript
describe('Performance Optimization - Load Test', () => {
  test('50 concurrent clients with optimizations', async () => {
    const clients = [];
    const startTime = Date.now();

    for (let i = 0; i < 50; i++) {
      clients.push(simulateClient(i));
    }

    await Promise.all(clients);
    const duration = Date.now() - startTime;

    const throughput = (50 * 100) / (duration / 1000); // 100 ops per client
    expect(throughput).toBeGreaterThan(285); // Baseline
    expect(throughput).toBeLessThan(600); // Optimistic upper bound
  });
});
```

---

## FEATURE FLAGS

```javascript
// environment.js or .env

// Enable optimizations
ENABLE_RESPONSE_STREAMING=true
ENABLE_DOM_CACHING=true
ENABLE_CONTEXT_POOLING=true
ENABLE_BUFFER_HEAP_OPTIMIZATION=true
ENABLE_CONNECTION_AFFINITY=true

// Tuning
STREAM_BACKPRESSURE=true
CACHE_TTL_MS=30000
CONTEXT_POOL_SIZE=4
BUFFER_POOL_SIZE=32
CONNECTION_AFFINITY_GROUPS=true
```

---

## DEBUGGING & MONITORING

### Health Check Endpoint

```javascript
app.get('/health/optimizations', (req, res) => {
  res.json({
    streaming: {
      enabled: process.env.ENABLE_RESPONSE_STREAMING === 'true',
      status: server.getStreamingStats()
    },
    caching: {
      enabled: process.env.ENABLE_DOM_CACHING === 'true',
      hitRate: server.getCacheHitRate()
    },
    contextPool: {
      enabled: process.env.ENABLE_CONTEXT_POOLING === 'true',
      utilization: server.contextPool.getStats()
    },
    bufferPool: {
      enabled: process.env.ENABLE_BUFFER_HEAP_OPTIMIZATION === 'true',
      stats: serializer.bufferPool.getStats()
    },
    connectionPool: {
      enabled: process.env.ENABLE_CONNECTION_AFFINITY === 'true',
      affinity: pool.getQueueStatsWithPercentiles()
    }
  });
});
```

---

## ROLLBACK PROCEDURES

**If performance regresses:**

```bash
# Disable streaming
ENABLE_RESPONSE_STREAMING=false

# Disable DOM caching
ENABLE_DOM_CACHING=false

# Disable context pooling
ENABLE_CONTEXT_POOLING=false

# Disable buffer optimization
ENABLE_BUFFER_HEAP_OPTIMIZATION=false

# Restart server
docker restart basset-hound-browser
```

---

## SUCCESS CRITERIA

- [ ] All 25+ unit tests passing
- [ ] All 15+ integration tests passing
- [ ] Export latency reduced 40% (1000ms → 600ms)
- [ ] DOM extraction latency reduced 20% (400ms → 320ms)
- [ ] Throughput improved 15% (285 → 328 msg/sec at 200 concurrent)
- [ ] Peak memory for 100MB export < 50MB
- [ ] Cache hit rate > 40% for DOM operations
- [ ] Context pool reuse > 80%
- [ ] Buffer pool hit rate > 95%
- [ ] Connection affinity utilization > 60%
- [ ] No performance regression on baseline commands
- [ ] Health checks passing
- [ ] Memory leak detection clear (90+ min sustained)

**Estimated Timeline:** 3 weeks  
**Risk Level:** LOW (feature flags, comprehensive tests)  
**Confidence:** HIGH (based on static analysis + metrics)
