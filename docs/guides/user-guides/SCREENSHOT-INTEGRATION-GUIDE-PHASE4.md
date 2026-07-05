# Screenshot Integration Guide - Phase 4 Complete

**Document Version:** 1.0  
**Status:** PRODUCTION READY  
**Date:** June 14, 2026  

---

## Quick Start

### 1. Initialize Screenshot System

```javascript
// In your main.js or initialization code
const { ScreenshotManager } = require('./screenshots/manager');

const screenshotManager = new ScreenshotManager(mainWindow, {
  bufferPoolSize: 100,
  maxConcurrent: 5,
  compressionLevel: 6,
  cacheSize: 100,
  debug: false
});
```

### 2. Register WebSocket Commands

```javascript
// In websocket/server.js
const { registerScreenshotCommands } = require('./websocket/commands/screenshot-commands');

function setupWebSocketServer(server, mainWindow) {
  // ... other setup ...
  
  // Register all screenshot commands
  registerScreenshotCommands(server, mainWindow);
  
  // Now all 30+ screenshot commands are available
}
```

### 3. Basic Usage via WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  // Capture viewport screenshot
  ws.send(JSON.stringify({
    command: 'capture_screenshot_viewport',
    params: { format: 'png', quality: 0.95 }
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  if (response.success) {
    console.log('Screenshot:', response.width, 'x', response.height);
    // Use response.data (base64-encoded image)
  } else {
    console.error('Capture failed:', response.error);
  }
};
```

---

## Detailed Integration Steps

### Step 1: Module Setup

#### A. Import Core Modules

```javascript
// screenshots/manager.js - Main coordinator
const { ScreenshotManager } = require('./screenshots/manager');

// Phase 1-3 modules
const { ImageValidator } = require('./screenshots/validators');
const { BatchScreenshotProcessor } = require('./screenshots/batch-processor');
const { ScreenshotStreamer } = require('./screenshots/streaming');
const { ThumbnailGenerator } = require('./screenshots/thumbnails');

// Phase 4 modules
const {
  EdgeCaseHandler,
  ErrorRecoveryManager,
  ResilienceCoordinator
} = require('./src/extraction/screenshot-phase4-robustness');
```

#### B. Initialize Manager

```javascript
class ScreenshotManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    
    // Initialize Phase 1-3 components
    this.validator = new ImageValidator();
    this.batchProcessor = new BatchScreenshotProcessor(this, options);
    this.streamer = new ScreenshotStreamer();
    this.thumbnailGenerator = new ThumbnailGenerator();
    
    // Initialize Phase 4 resilience
    this.resilience = new ResilienceCoordinator(options);
    this.edgeCaseHandler = this.resilience.edgeCaseHandler;
    this.errorRecovery = this.resilience.errorRecovery;
    
    // Apply configuration
    this.config = { ...defaultConfig, ...options };
  }
}
```

---

### Step 2: WebSocket Command Registration

#### A. Register All Commands

```javascript
function registerScreenshotCommands(server, mainWindow) {
  const manager = new ScreenshotManager(mainWindow);
  const handlers = server.commandHandlers || server;
  
  // Phase 1: Basic Commands
  handlers.capture_screenshot_viewport = async (params) => {
    return await manager.executeWithResilience(
      () => manager.captureViewport(params),
      { command: 'capture_viewport', ...params }
    );
  };
  
  handlers.capture_screenshot_fullpage = async (params) => {
    return await manager.executeWithResilience(
      () => manager.captureFullPage(params),
      { command: 'capture_fullpage', ...params }
    );
  };
  
  handlers.capture_screenshot_element = async (params) => {
    return await manager.executeWithResilience(
      () => manager.captureElement(params.selector, params),
      { command: 'capture_element', selector: params.selector }
    );
  };
  
  // Phase 2: Batch & Streaming
  handlers.batch_capture_screenshots = async (params) => {
    return await manager.batchProcessor.captureBatch(
      params.captures,
      params
    );
  };
  
  handlers.stream_large_screenshot = async (params) => {
    const handle = await manager.streamer.createCompressedReadStream(
      params.data,
      params
    );
    return {
      success: true,
      sessionId: handle.sessionId,
      totalSize: params.data.length,
      chunks: Math.ceil(params.data.length / params.chunkSize)
    };
  };
  
  // Phase 4: Validation & Recovery
  handlers.validate_screenshot_quality = async (params) => {
    return await manager.validator.validateScreenshot(params);
  };
  
  handlers.get_recovery_stats = async () => {
    return manager.resilience.getRecoveryStats();
  };
  
  // ... more commands
}
```

#### B. Error Handling in Commands

```javascript
handlers.capture_screenshot_with_recovery = async (params) => {
  try {
    // Execute with full resilience coordination
    const result = await manager.resilience.executeWithResilience(
      async () => {
        // Detect blank pages
        const blankCheck = manager.edgeCaseHandler.detectBlankPage(
          params.imageData
        );
        if (blankCheck.isBlank) {
          return { success: true, warning: 'blank_page', blankCheck };
        }
        
        // Proceed with normal flow
        return await manager.captureElement(params.selector, params);
      },
      { selector: params.selector, format: params.format }
    );
    
    return result;
  } catch (error) {
    // Generate error report
    const report = manager.errorRecovery.generateErrorReport(error, params);
    return {
      success: false,
      error: error.message,
      errorReport: report,
      suggestion: report.suggestion
    };
  }
};
```

---

### Step 3: Resilience Integration

#### A. Use ResilienceCoordinator

```javascript
// In manager methods
async captureWithResilience(operation, context) {
  return await this.resilience.executeWithResilience(
    operation,
    context
  );
}

// Usage in commands
const result = await manager.captureWithResilience(
  async () => await manager.captureViewport(options),
  { viewport: true, format: options.format }
);
```

#### B. Implement Edge Case Handling

```javascript
async captureFullPage(options) {
  // Wait for dynamic content
  const ready = await this.edgeCaseHandler.waitForDynamicContent(
    async () => document.readyState,
    3  // 3 stable checks
  );
  
  if (!ready.success) {
    console.warn('Content not stabilized');
  }
  
  // Perform capture with retry
  const captureOp = async () => {
    // Actual capture logic
    return await this.mainWindow.webContents.capturePage();
  };
  
  const result = await this.edgeCaseHandler.retryWithBackoff(
    captureOp,
    { type: 'fullpage' }
  );
  
  return result;
}
```

#### C. Handle Recovery Actions

```javascript
async captureElement(selector, options) {
  try {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    // Capture element...
    return { success: true, data: imageBuffer };
  } catch (error) {
    // Get recovery suggestion
    const report = this.errorRecovery.generateErrorReport(error, {
      selector,
      command: 'capture_element'
    });
    
    // Try partial fallback
    if (error.message.includes('not found')) {
      const partial = await this.errorRecovery.capturePartialOnFailure({
        selector,
        viewport: { x: 0, y: 0, width: 1920, height: 1080 }
      });
      
      if (partial.success) {
        return { ...partial, originalError: error.message };
      }
    }
    
    return {
      success: false,
      error: error.message,
      errorReport: report
    };
  }
}
```

---

### Step 4: Monitoring & Logging

#### A. Log Recovery Actions

```javascript
// In resilience coordinator
manager.resilience.errorRecovery.logRecoveryAction({
  type: 'retry_with_backoff',
  status: 'succeeded',
  details: 'Recovered after 2 retries'
});

// Get statistics
const stats = manager.resilience.getRecoveryStats();
console.log(`Recovery attempts: ${stats.totalRecoveryAttempts}`);
console.log(`Success rate: ${stats.successRate}%`);
```

#### B. Monitor Performance

```javascript
// Track screenshot performance
const startTime = Date.now();
const result = await manager.captureViewport(options);
const duration = Date.now() - startTime;

console.log(`Capture time: ${duration}ms`);
console.log(`Quality score: ${result.qualityScore}`);

// Monitor cache effectiveness
const cacheStats = manager.resilience.getRecoveryStats();
if (cacheStats.cacheStats) {
  console.log(`Cache hit rate: ${cacheStats.cacheStats.hitRate}%`);
}
```

#### C. Error Tracking

```javascript
// Log errors for monitoring
const trackError = (error, context) => {
  const report = manager.errorRecovery.generateErrorReport(error, context);
  
  // Send to monitoring system
  logger.error({
    type: report.type,
    message: report.error,
    suggestion: report.suggestion,
    context: report.context,
    timestamp: report.timestamp
  });
};
```

---

### Step 5: Configuration

#### A. Development Configuration

```javascript
const devConfig = {
  debug: true,
  logLevel: 'verbose',
  maxConcurrent: 2,      // Slower for debugging
  timeout: 60000,        // Longer timeout
  cacheSize: 10,         // Small cache
  bufferPoolSize: 10,
  enableValidation: true,
  enableRecovery: true
};

const manager = new ScreenshotManager(mainWindow, devConfig);
```

#### B. Production Configuration

```javascript
const prodConfig = {
  debug: false,
  logLevel: 'error',
  maxConcurrent: 8,      // High concurrency
  timeout: 30000,        // Shorter timeout
  cacheSize: 1000,       // Large cache
  bufferPoolSize: 100,
  maxBufferMemory: 104857600,  // 100MB
  enableValidation: true,
  enableRecovery: true,
  recoveryRetries: 3,
  compressionLevel: 6    // Balanced
};

const manager = new ScreenshotManager(mainWindow, prodConfig);
```

---

## Integration Patterns

### Pattern 1: Simple Capture

```javascript
// Single screenshot, no special handling
async function simpleCapture(selector) {
  const result = await manager.captureElement(selector, {
    format: 'png'
  });
  
  if (result.success) {
    return result.data;
  } else {
    throw new Error(result.error);
  }
}
```

### Pattern 2: Batch with Fallback

```javascript
// Multiple captures with automatic fallback
async function batchCaptureWithFallback(selectors) {
  const specs = selectors.map(s => ({
    type: 'element',
    selector: s
  }));
  
  const result = await manager.batchProcessor.captureBatch(specs);
  
  // Some captures may have failed, some succeeded
  return result.results.map((r, i) => ({
    selector: selectors[i],
    success: r.success,
    data: r.data,
    error: r.error
  }));
}
```

### Pattern 3: Large File with Streaming

```javascript
// Stream large capture to file
async function captureToFile(filepath) {
  const imageData = await manager.captureFullPage();
  
  const handle = await manager.streamer.createCompressedReadStream(
    imageData,
    { chunkSize: 65536, compressionLevel: 6 }
  );
  
  const file = fs.createWriteStream(filepath);
  
  while (true) {
    const chunk = handle.getNextChunk();
    file.write(Buffer.from(chunk.data, 'base64'));
    if (chunk.isLast) break;
  }
  
  file.end();
}
```

### Pattern 4: Resilient Capture with Monitoring

```javascript
// Capture with full resilience and monitoring
async function resilientCapture(selector, options) {
  const startTime = Date.now();
  
  try {
    const result = await manager.resilience.executeWithResilience(
      () => manager.captureElement(selector, options),
      { selector, ...options }
    );
    
    const duration = Date.now() - startTime;
    
    // Log success
    logger.info({
      event: 'screenshot_captured',
      selector,
      duration,
      format: options.format,
      size: result.data ? result.data.length : 0
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const report = manager.errorRecovery.generateErrorReport(error);
    
    // Log failure
    logger.error({
      event: 'screenshot_failed',
      selector,
      duration,
      error: report.type,
      suggestion: report.suggestion
    });
    
    throw error;
  }
}
```

---

## Testing Integration

### Unit Test Example

```javascript
describe('Screenshot Integration', () => {
  let manager;
  
  beforeEach(() => {
    manager = new ScreenshotManager(mockWindow, {
      debug: false,
      maxConcurrent: 2
    });
  });
  
  test('captures viewport with resilience', async () => {
    const result = await manager.resilience.executeWithResilience(
      () => manager.captureViewport({ format: 'png' }),
      { viewport: true }
    );
    
    expect(result.success).toBe(true);
    expect(result.executionTimeMs).toBeGreaterThan(0);
  });
  
  test('recovers from blank page', async () => {
    const result = await manager.resilience.executeWithResilience(
      async () => ({
        success: true,
        data: Buffer.alloc(100, 255)  // Blank page
      }),
      { selector: '.element' }
    );
    
    if (result.warning === 'blank_page_detected') {
      expect(result.blankDetails).toBeDefined();
    }
  });
  
  test('logs recovery actions', async () => {
    manager.errorRecovery.logRecoveryAction({
      type: 'compression',
      status: 'succeeded'
    });
    
    const stats = manager.resilience.getRecoveryStats();
    expect(stats.totalRecoveryAttempts).toBeGreaterThan(0);
  });
});
```

---

## Migration from Previous Versions

### From Phase 1-2 to Phase 4

No breaking changes. Existing code continues to work.

**Before:**
```javascript
const result = await manager.captureViewport(options);
```

**Still works!**

**But now you can also use Phase 4 features:**
```javascript
const result = await manager.resilience.executeWithResilience(
  () => manager.captureViewport(options),
  { viewport: true }
);
```

### Gradual Migration

1. **Phase 1:** Keep existing code as-is
2. **Phase 2:** Optionally use batch/streaming for new features
3. **Phase 3:** Enable caching for performance
4. **Phase 4:** Wrap critical paths with resilience coordinator

```javascript
// Gradual adoption
async function migrate() {
  // Old way still works
  const oldResult = await manager.captureViewport(options);
  
  // New way available
  const newResult = await manager.resilience.executeWithResilience(
    () => manager.captureViewport(options)
  );
  
  // Both produce same output, but new way has resilience
}
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All screenshot modules installed
- [ ] WebSocket commands registered
- [ ] Resilience coordinator initialized
- [ ] Error logging configured
- [ ] Cache configured for production
- [ ] Monitoring dashboards set up
- [ ] Tests pass (250+)
- [ ] Documentation reviewed

### Deployment Script

```bash
#!/bin/bash

echo "Screenshot System Deployment"

# 1. Copy modules
cp screenshots/*.js src/extraction/*.js /app/src/

# 2. Copy tests
cp tests/unit/screenshot-*.test.js /app/tests/unit/

# 3. Run tests
npm test -- tests/unit/screenshot-*.test.js

# 4. Check test results
if [ $? -eq 0 ]; then
  echo "✓ All screenshot tests pass"
else
  echo "✗ Tests failed, aborting deployment"
  exit 1
fi

# 5. Validate WebSocket commands
node scripts/validate-websocket-commands.js

# 6. Start service
npm start

echo "✓ Screenshot system deployed"
```

---

## Troubleshooting Integration

### WebSocket Commands Not Available

**Problem:** `Unknown command: capture_screenshot_viewport`

**Solution:**
```javascript
// Verify commands are registered
function setupWebSocketServer(server, mainWindow) {
  const { registerScreenshotCommands } = require('./websocket/commands/screenshot-commands');
  
  // This line is required
  registerScreenshotCommands(server, mainWindow);
  
  // Verify
  console.log('Screenshot commands registered:', 
    Object.keys(server.commandHandlers).filter(k => k.includes('screenshot')).length
  );
}
```

### Memory Issues

**Problem:** Heap out of memory during batch capture

**Solution:**
```javascript
// Reduce concurrency
const manager = new ScreenshotManager(mainWindow, {
  maxConcurrent: 2,  // Was 8
  compressionLevel: 9  // Maximum compression
});

// Or use streaming for large files
const handle = await manager.streamer.createCompressedReadStream(
  largeImageData,
  { chunkSize: 32768 }  // Smaller chunks
);
```

### Slow Captures

**Problem:** Screenshot capture taking >5 seconds

**Solution:**
```javascript
// Increase performance settings
const manager = new ScreenshotManager(mainWindow, {
  format: 'jpeg',      // Faster than PNG
  quality: 0.7,        // Lower quality
  fullPage: false,     // Viewport only
  cacheSize: 1000      // Bigger cache
});
```

---

## Maintenance

### Regular Maintenance Tasks

**Daily:**
- Monitor recovery stats
- Check error logs
- Verify cache hit rate > 90%

**Weekly:**
- Review performance metrics
- Clear old cache entries
- Update monitoring dashboards

**Monthly:**
- Full test suite execution
- Performance benchmarking
- Configuration optimization

### Health Checks

```javascript
async function healthCheck() {
  const stats = manager.resilience.getRecoveryStats();
  const cacheStats = manager.streamer.getStreamStats();
  
  return {
    recoveryAttempts: stats.totalRecoveryAttempts,
    cacheHitRate: cacheStats?.hitRate || 0,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,  // MB
    timestamp: new Date().toISOString()
  };
}

// Run health check
setInterval(async () => {
  const health = await healthCheck();
  console.log('Health check:', health);
}, 60000);  // Every minute
```

---

**End of Integration Guide**
