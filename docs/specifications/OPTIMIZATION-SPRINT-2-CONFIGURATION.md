# Optimization Sprint 2 - Configuration Guide

This guide covers configuration and integration of the three new optimizations.

---

## OPT-03: Parallel Screenshot Processing

### Module
```javascript
const ParallelScreenshotProcessor = require('./src/screenshots/parallel-processor');
```

### Basic Usage
```javascript
// Create processor with default settings
const processor = new ParallelScreenshotProcessor();

// Capture screenshot
const result = await processor.captureScreenshot(webContents);
console.log(result);
// {
//   success: true,
//   data: 'base64_encoded_image...',
//   metadata: {
//     buffer: 0,
//     format: 'webp',
//     size: 45000,
//     captureTime: 52,
//     encodeTime: 15,
//     totalTime: 67,
//     waitTime: 5,
//     queueSize: 1
//   }
// }
```

### Configuration Options
```javascript
const processor = new ParallelScreenshotProcessor({
  // Number of concurrent capture buffers (default: 3)
  poolSize: 3,

  // Maximum requests in queue (default: 100)
  maxQueueSize: 100,

  // Timeout for getting available buffer (default: 30000ms)
  commandTimeout: 30000,

  // GPU memory limit in MB (default: 500)
  gpuMemoryLimit: 500
});
```

### Capture Options
```javascript
const result = await processor.captureScreenshot(webContents, {
  // Output format: 'webp', 'png', 'jpeg' (default: 'webp')
  format: 'webp',

  // Quality/compression (default: 90)
  quality: 90,

  // PNG compression level 0-9 (default: 6)
  compression: 6,

  // Timeout for this request (default: 30000ms)
  timeout: 30000,

  // Priority hint (default: 'normal')
  priority: 'normal'
});
```

### Statistics and Monitoring
```javascript
// Get detailed statistics
const stats = processor.getStatistics();
console.log(stats);
// {
//   pool: {
//     size: 3,
//     buffers: [
//       { id: 0, inUse: false, uses: 10, averageTime: 67, errors: 0 },
//       { id: 1, inUse: true, uses: 8, averageTime: 70, errors: 1 },
//       { id: 2, inUse: false, uses: 12, averageTime: 65, errors: 0 }
//     ],
//     activeBuffers: 1,
//     availableBuffers: 2
//   },
//   queue: {
//     size: 3,
//     maxSize: 100,
//     peakSize: 5
//   },
//   processing: {
//     totalRequests: 30,
//     completedRequests: 27,
//     failedRequests: 1,
//     activeRequests: 2,
//     avgWaitTime: 5,
//     avgProcessingTime: 67
//   },
//   performance: {
//     throughput: 2.5,  // screenshots per second
//     totalUptime: 12000,
//     peakQueueSize: 5
//   }
// }

// Reset statistics
processor.resetStatistics();

// Resize pool dynamically
processor.resizePool(5);  // Increase to 5 buffers

// Wait for all pending requests
await processor.waitForCompletion(60000);

// Cleanup and shutdown
await processor.shutdown();
```

### Performance Tuning
```javascript
// For high-concurrency scenarios
const aggressive = new ParallelScreenshotProcessor({
  poolSize: 8,          // More buffers
  maxQueueSize: 500     // Larger queue
});

// For memory-constrained environments
const conservative = new ParallelScreenshotProcessor({
  poolSize: 1,          // Single buffer (no parallelization)
  maxQueueSize: 20      // Small queue
});

// Balanced (recommended)
const balanced = new ParallelScreenshotProcessor({
  poolSize: 3,          // 3 concurrent
  maxQueueSize: 100     // Standard queue
});
```

---

## OPT-04: Session Recording Streaming

### Module
```javascript
const StreamingSessionRecorder = require('./src/recording/streaming-recorder');
```

### Basic Usage
```javascript
// Create recorder
const recorder = new StreamingSessionRecorder('session-123', {
  logDir: './data/sessions'
});

// Record a frame
const frameId = await recorder.recordFrame({
  type: 'dom',
  html: '<html>...</html>',
  url: 'https://example.com',
  title: 'Page Title'
});

// Record an event
const eventId = await recorder.recordEvent({
  action: 'click',
  selector: '#button',
  x: 100,
  y: 50
});

// Get statistics
const stats = await recorder.getRecordingStats();
console.log(stats);
// {
//   sessionId: 'session-123',
//   status: 'recording',
//   recordingDuration: {
//     seconds: 3600,
//     formatted: '1h 0m 0s'
//   },
//   frames: {
//     total: 3600,
//     inMemory: 10,
//     onDisk: 3590
//   },
//   events: { total: 150 },
//   memory: {
//     bufferedEstimate: '0.50 MB',
//     bufferedBytes: 512000
//   },
//   disk: {
//     sizeBytes: 209715200,
//     sizeMB: '200.00',
//     filePath: './data/sessions/session-123/recording.jsonl'
//   },
//   performance: {
//     writeRate: '0.58 MB/s',
//     totalWrites: 3750,
//     maxPendingWrites: 45,
//     flushCount: 36
//   },
//   errors: {
//     count: 0,
//     lastError: null
//   }
// }

// Close recorder
await recorder.close();
```

### Configuration Options
```javascript
const recorder = new StreamingSessionRecorder('session-id', {
  // Number of recent frames to keep in memory (default: 10)
  memoryFrameLimit: 10,

  // Directory to store recording files (default: data/sessions/{id})
  logDir: './data/sessions/session-123',

  // Auto-flush interval (default: 100 frames)
  chunkSize: 100,

  // Enable compression during write (default: false)
  compress: false,

  // Generate index file for fast lookups (default: true)
  enableIndex: true
});
```

### Playback
```javascript
// Playback all frames
for await (const frame of recorder.playback()) {
  console.log(frame.frameId, frame.content);
}

// Playback with range
for await (const frame of recorder.playback({
  startFrame: 100,
  endFrame: 200
})) {
  console.log(frame);
}

// Playback with filter
for await (const frame of recorder.playback({
  filter: (f) => f.type === 'dom'  // Only DOM frames
})) {
  console.log(frame);
}

// Get frames in time range
const frames = await recorder.getFramesInRange(
  startTime,
  endTime
);
```

### Export
```javascript
// Export to JSONL format
const result = await recorder.exportRecording(
  './exports/session-123.jsonl',
  'jsonl'
);
console.log(result);
// {
//   success: true,
//   exportPath: './exports/session-123.jsonl',
//   format: 'jsonl',
//   itemCount: 3750,
//   errorCount: 0,
//   file: './exports/session-123.jsonl'
// }

// Export to JSON array format
const result = await recorder.exportRecording(
  './exports/session-123.json',
  'json'
);
```

### Memory Management
```javascript
// Get memory estimate
const memoryBytes = recorder.getMemoryEstimate();
console.log(memoryBytes / 1024 / 1024); // MB

// Get disk usage
const diskBytes = recorder.getDiskUsage();
console.log(diskBytes / 1024 / 1024); // MB

// Force flush to disk
await recorder.flushDiskWrites();

// Delete entire recording
await recorder.delete();
```

### Performance Tuning
```javascript
// For short recordings (< 1 minute)
const shortRecorder = new StreamingSessionRecorder('short', {
  memoryFrameLimit: 50,  // Keep more in memory
  chunkSize: 30          // Flush more frequently
});

// For long recordings (> 1 hour)
const longRecorder = new StreamingSessionRecorder('long', {
  memoryFrameLimit: 5,   // Keep less in memory
  chunkSize: 200         // Batch writes
});

// Memory-constrained environment
const minimalRecorder = new StreamingSessionRecorder('minimal', {
  memoryFrameLimit: 1,   // Only keep 1 frame
  chunkSize: 500,        // Large batches
  compress: true         // Compress writes
});
```

---

## OPT-10: Priority Queue System

### Module
```javascript
const PriorityQueue = require('./websocket/priority-queue');
```

### Basic Usage
```javascript
const queue = new PriorityQueue();

// Enqueue a request
const promise = queue.enqueue({
  command: 'screenshot',
  data: { viewport: { width: 1920, height: 1080 } }
});

// Get next request to process
const request = queue.getNextRequest();
if (request) {
  try {
    // Process request
    const result = await processRequest(request);
    
    // Mark as complete
    queue.completeRequest(request.id, result);
  } catch (error) {
    // Mark as failed (with retry)
    queue.failRequest(request.id, error, true);
  }
}

// Wait for result
const result = await promise;
```

### Configuration Options
```javascript
const queue = new PriorityQueue({
  // Maximum queue size (default: 10000)
  maxQueueSize: 10000,

  // Enable priority aging (default: true)
  enableAging: true,

  // Time before boosting priority (default: 30000ms)
  agingThreshold: 30000,

  // Fairness: 1 low per N critical (default: 10)
  fairnessRatio: 10
});
```

### Priority Assignment
```javascript
// Automatic priority assignment
queue.enqueue({ command: 'screenshot' });       // → CRITICAL
queue.enqueue({ command: 'navigate' });         // → HIGH
queue.enqueue({ command: 'custom_action' });    // → NORMAL
queue.enqueue({ command: 'get_status' });       // → LOW

// Manual priority assignment
queue.enqueue({
  command: 'navigate',
  priority: 'critical'  // Override automatic
});

// Query command priority
const priority = queue.getCommandPriority('screenshot');
console.log(priority);  // 'critical'
```

### Statistics and Monitoring
```javascript
// Get comprehensive statistics
const stats = queue.getStatistics();
console.log(stats);
// {
//   queue: {
//     total: 25,
//     sizes: {
//       critical: 5,
//       high: 8,
//       normal: 10,
//       low: 2
//     },
//     maxSize: 10000,
//     peakSize: 45
//   },
//   requests: {
//     total: 1000,
//     completed: 975,
//     failed: 5,
//     pending: 20,
//     priorityDistribution: {
//       critical: 500,
//       high: 300,
//       normal: 150,
//       low: 50
//     }
//   },
//   latency: {
//     avgWaitTime: 45,
//     avgProcessingTime: 150,
//     p50: 30,
//     p95: 200,
//     p99: 500
//   },
//   performance: {
//     throughput: 8.33,    // req/sec
//     uptime: 120000,
//     successRate: '97.5%'
//   }
// }

// Reset statistics
queue.resetStatistics();

// Get requests by priority
const byPriority = queue.getRequestsByPriority();

// Get oldest request
const oldest = queue.getOldestRequest();

// Check queue size
console.log(queue.size());          // Total items
console.log(queue.isEmpty());       // Is empty?
```

### Request Management
```javascript
// Get specific request
const request = queue.getRequest(requestId);

// Boost request priority
queue.boostPriority(requestId);

// Drain all requests
const all = queue.drain();

// Clear queue
queue.clear();
```

### Event Monitoring
```javascript
// Listen to queue events
queue.on('request-queued', (data) => {
  console.log(`Request ${data.requestId} queued with ${data.priority} priority`);
});

queue.on('request-completed', (data) => {
  console.log(`Request ${data.requestId} completed in ${data.waitTime}ms wait + ${data.processingTime}ms processing`);
});

queue.on('request-failed', (data) => {
  console.log(`Request ${data.requestId} failed: ${data.error}`);
});

queue.on('request-retrying', (data) => {
  console.log(`Request ${data.requestId} retry attempt ${data.attempt}`);
});

queue.on('request-boosted', (data) => {
  console.log(`Request ${data.requestId} boosted from ${data.fromPriority} to ${data.toPriority}`);
});
```

### Performance Tuning
```javascript
// Aggressive prioritization (strict)
const aggressive = new PriorityQueue({
  enableAging: true,
  agingThreshold: 5000,     // Quick aging
  fairnessRatio: 20         // Strict fairness
});

// Lenient prioritization
const lenient = new PriorityQueue({
  enableAging: false,        // No aging
  fairnessRatio: 100         // Loose fairness
});

// Balanced (recommended)
const balanced = new PriorityQueue({
  enableAging: true,
  agingThreshold: 30000,
  fairnessRatio: 10
});
```

---

## Integration Examples

### Integrated WebSocket Handler
```javascript
const ParallelScreenshotProcessor = require('./src/screenshots/parallel-processor');
const PriorityQueue = require('./websocket/priority-queue');

class OptimizedWebSocketHandler {
  constructor() {
    this.screenshotProcessor = new ParallelScreenshotProcessor({
      poolSize: 4
    });
    this.queue = new PriorityQueue();
  }

  async handleCommand(command, data, webContents) {
    // Enqueue with automatic priority
    const result = await this.queue.enqueue({
      command,
      data
    });

    // Process high-priority commands first
    const request = this.queue.getNextRequest();
    if (!request) return;

    try {
      let result;
      if (command === 'screenshot') {
        result = await this.screenshotProcessor.captureScreenshot(
          webContents,
          data
        );
      } else {
        result = await this.processCommand(command, data);
      }

      this.queue.completeRequest(request.id, result);
      return result;
    } catch (error) {
      this.queue.failRequest(request.id, error);
      throw error;
    }
  }
}
```

### Integrated Recording Handler
```javascript
const StreamingSessionRecorder = require('./src/recording/streaming-recorder');

class OptimizedRecordingHandler {
  constructor() {
    this.recorders = new Map();
  }

  startRecording(sessionId, options = {}) {
    const recorder = new StreamingSessionRecorder(sessionId, {
      memoryFrameLimit: 10,
      logDir: `./data/sessions/${sessionId}`,
      ...options
    });

    this.recorders.set(sessionId, recorder);
    return recorder;
  }

  async recordFrame(sessionId, frameData) {
    const recorder = this.recorders.get(sessionId);
    if (!recorder) throw new Error('Recording not found');

    return recorder.recordFrame(frameData);
  }

  async stopRecording(sessionId) {
    const recorder = this.recorders.get(sessionId);
    if (!recorder) throw new Error('Recording not found');

    await recorder.close();
    this.recorders.delete(sessionId);
  }

  async exportRecording(sessionId, path) {
    const recorder = this.recorders.get(sessionId);
    if (!recorder) throw new Error('Recording not found');

    return recorder.exportRecording(path, 'jsonl');
  }
}
```

---

## Troubleshooting

### Screenshot Processing Issues

**Problem:** Queue fills up, requests rejected
- **Solution:** Increase `maxQueueSize` or `poolSize`
- **Check:** GPU memory with `nvidia-smi`

**Problem:** High latency, slow screenshots
- **Solution:** Check GPU load, adjust `poolSize`
- **Monitor:** `processor.getStatistics()`

**Problem:** Out of memory
- **Solution:** Reduce `poolSize` or check image sizes
- **Monitor:** `process.memoryUsage()`

### Recording Issues

**Problem:** High memory usage
- **Solution:** Reduce `memoryFrameLimit`
- **Check:** `recorder.getRecordingStats()` memory field

**Problem:** Disk write errors
- **Solution:** Check disk space and permissions
- **Monitor:** `error` field in statistics

**Problem:** Playback incomplete
- **Solution:** Ensure all frames flushed with `flushDiskWrites()`
- **Check:** Frame count in statistics

### Queue Issues

**Problem:** High P95 latency
- **Solution:** Check for CPU bottlenecks, adjust pool sizes
- **Monitor:** `queue.getStatistics().latency`

**Problem:** Low-priority commands never run
- **Solution:** Increase `fairnessRatio`
- **Check:** Queue sizes in statistics

**Problem:** Request timeout
- **Solution:** Check command processing time, increase timeout
- **Monitor:** `avgProcessingTime` in statistics

---

## Performance Recommendations

### Recommended Settings by Scenario

**High-Concurrency OSINT Scanning:**
```javascript
const processor = new ParallelScreenshotProcessor({
  poolSize: 6,
  maxQueueSize: 500
});

const queue = new PriorityQueue({
  maxQueueSize: 5000,
  fairnessRatio: 5
});
```

**Long-Running Sessions:**
```javascript
const recorder = new StreamingSessionRecorder(sessionId, {
  memoryFrameLimit: 5,
  chunkSize: 200,
  compress: true
});
```

**Real-Time Dashboard:**
```javascript
const processor = new ParallelScreenshotProcessor({
  poolSize: 2,
  maxQueueSize: 50
});

const queue = new PriorityQueue({
  maxQueueSize: 1000,
  fairnessRatio: 20
});
```

---

**Last Updated:** May 11, 2026
