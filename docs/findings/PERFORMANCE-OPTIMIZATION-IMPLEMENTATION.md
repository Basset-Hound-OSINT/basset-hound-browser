# Performance Optimization Implementation Guide
## Basset Hound Browser v12.2.0+ Phase 1 Optimizations

**Date:** June 4, 2026  
**Status:** Ready for Implementation  
**Target Gain:** +40-50% throughput (380-420 msg/sec)

---

## Quick Reference: Optimization Checklist

### Phase 1A: Hash-Based Command Routing (2 hours)
- [ ] Create command router hash map in server.js
- [ ] Register all 164 commands in router map
- [ ] Replace if/else chain with hash lookup
- [ ] Add command not found error handling
- [ ] Test: All commands still work
- [ ] Benchmark: Check lookup time <10µs
- **Expected gain:** +20% throughput (+57 msg/sec)

### Phase 1B: DOM Extraction Caching (2 hours)
- [ ] Add cache property to DOMInspector
- [ ] Implement TTL-based cache invalidation
- [ ] Add cache hit/miss tracking
- [ ] Monitor cache size
- [ ] Test: Cache invalidates on navigation
- [ ] Benchmark: Multi-extract operations 50% faster
- **Expected gain:** +15% throughput (+42 msg/sec)

### Phase 1C: Async Screenshot Writing (2 hours)
- [ ] Create screenshot write queue
- [ ] Implement async batch flushing
- [ ] Add backpressure handling
- [ ] Persist queue on shutdown
- [ ] Test: Screenshots written in background
- [ ] Benchmark: Screenshot requests return <100ms
- **Expected gain:** +15% throughput (+42 msg/sec)

### Phase 2: External API Caching (2 hours)
- [ ] Create API cache with TTL
- [ ] Cache Tor node lookups (1 hour TTL)
- [ ] Cache proxy reputation (1 hour TTL)
- [ ] Monitor cache hit rate
- [ ] Test: Cached lookups <1ms
- **Expected gain:** +5% throughput (+14 msg/sec)

### Phase 3: JavaScript Context Pooling (2 hours)
- [ ] Create sandbox context pool
- [ ] Implement context reuse
- [ ] Add pool metrics tracking
- [ ] Clean up contexts on error
- [ ] Test: Context creation <1ms
- **Expected gain:** +15% throughput (+42 msg/sec)

---

## Detailed Implementation Steps

### OPT-01: Hash-Based Command Routing

#### Location: `/home/devel/basset-hound-browser/websocket/server.js`

#### Change 1: Add Router Initialization (Lines ~850-900)

```javascript
// Add after constructor initialization, before start() method
initializeCommandRouter() {
  this.commandRouter = new Map();
  
  // Register all command handlers with their command names
  const commands = [
    'ping', 'navigate', 'click', 'fill', 'type', 'screenshot', 
    'screenshot_viewport', 'screenshot_full_page', 'screenshot_element',
    'get_content', 'get_text', 'get_html', 'get_cookies', 'get_all_cookies',
    'list_sessions', 'list_tabs', 'get_tab_info', 'get_active_tab',
    'get_history', 'get_downloads', 'get_proxy_status', 'get_user_agent_status',
    'status', 'get_network_logs', 'get_console_logs', 'list_profiles',
    'get_profile', 'get_storage_stats', 'get_local_storage', 'get_session_storage',
    'list_scripts', 'get_script', 'get_blocking_stats', 'get_devtools_status',
    'get_console_status', 'create_session', 'switch_session', 'delete_session',
    'list_sessions', 'get_session', 'wait_for_element', 'wait_for_navigation',
    'scroll', 'hover', 'double_click', 'right_click', 'submit_form',
    'select_option', 'check_checkbox', 'uncheck_checkbox', 'clear_field',
    'execute_script', 'get_page_state', 'get_url', 'close_tab',
    // ... add all 164 commands here
  ];
  
  // Build hash map from handler registry
  for (const command of commands) {
    if (this.commandHandlers.has(command)) {
      this.commandRouter.set(command, command);
    } else {
      this.logger.warn(`Command not registered: ${command}`);
    }
  }
  
  this.logger.info(`Command router initialized with ${this.commandRouter.size} commands`);
}

// Call in start() method
start() {
  // ... existing code ...
  this.initializeCommandRouter();
  // ... rest of start code ...
}
```

#### Change 2: Replace handleCommand Method (Lines ~3700-3800)

**Current Code (INEFFICIENT - LINEAR SEARCH):**
```javascript
async handleCommand(data) {
  // Switch statement = linear search
  switch (data.command) {
    case 'ping':
      return await this.commandHandlers.get('ping')();
    case 'navigate':
      return await this.commandHandlers.get('navigate')(data.args);
    case 'screenshot':
      return await this.commandHandlers.get('screenshot')(data.args);
    // ... 161 more case statements
    default:
      return { success: false, error: 'Unknown command' };
  }
}
```

**Optimized Code (O(1) HASH LOOKUP):**
```javascript
async handleCommand(data) {
  // Hash map lookup = O(1) instead of O(n)
  const commandName = this.commandRouter.get(data.command);
  
  if (!commandName) {
    return {
      success: false,
      error: `Unknown command: ${data.command}`,
      availableCommands: Array.from(this.commandRouter.keys()).length
    };
  }
  
  const handler = this.commandHandlers.get(commandName);
  if (!handler || typeof handler !== 'function') {
    this.logger.error(`Handler not found for command: ${commandName}`);
    return {
      success: false,
      error: `Handler not found for command: ${commandName}`
    };
  }
  
  // Execute handler with arguments
  try {
    return await handler(data.args || {});
  } catch (error) {
    this.logger.error(`Command execution failed: ${commandName}`, error);
    return {
      success: false,
      error: error.message,
      command: commandName
    };
  }
}
```

#### Testing:
```bash
# Run existing test suite - all commands should still work
npm test -- tests/websocket-api-test.js

# Benchmark: Time command lookup
time npm run benchmark:commands
# Should show <10µs per lookup (vs 30-80µs before)
```

---

### OPT-02: DOM Extraction Caching

#### Location: `/home/devel/basset-hound-browser/inspector/manager.js`

#### Change: Add Cache Layer to DOMInspector Class

```javascript
class DOMInspector {
  constructor(page) {
    this.page = page;
    
    // Add cache for DOM operations
    this.cache = new Map();
    this.selectorCache = new Map();
    this.cacheVersion = 0;
    this.cacheTTL = 60000; // 60 seconds default
    
    // Cache statistics
    this.cacheStats = {
      hits: 0,
      misses: 0,
      invalidations: 0
    };
    
    // Monitor navigation to invalidate cache
    this.page.on('framenavigated', () => {
      this.invalidateCache('navigation');
    });
    
    this.page.on('load', () => {
      this.refreshCache();
    });
  }
  
  // Get cache hit rate
  getCacheHitRate() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    if (total === 0) return 0;
    return (this.cacheStats.hits / total) * 100;
  }
  
  // Invalidate cache
  invalidateCache(reason = 'unknown') {
    const prevSize = this.cache.size;
    this.cache.clear();
    this.selectorCache.clear();
    this.cacheVersion++;
    this.cacheStats.invalidations++;
    
    this.logger?.debug(`Cache invalidated: ${reason} (cleared ${prevSize} entries)`);
  }
  
  // Refresh cache (called after page load)
  async refreshCache() {
    try {
      // Pre-cache common selectors
      const commonSelectors = ['body', 'main', '.content', '#app', '.page-content'];
      for (const selector of commonSelectors) {
        try {
          await this.compileSelector(selector);
        } catch (e) {
          // Selector may not exist on this page, skip
        }
      }
    } catch (error) {
      this.logger?.warn('Error refreshing cache:', error.message);
    }
  }
  
  // Compile and cache selector
  async compileSelector(selector) {
    const cacheKey = `selector:${selector}`;
    const cached = this.selectorCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached;
    }
    
    const compiled = await this.page.evaluate((sel) => {
      try {
        const element = document.querySelector(sel);
        const count = document.querySelectorAll(sel).length;
        return {
          valid: true,
          count,
          selector: sel
        };
      } catch (e) {
        return {
          valid: false,
          error: e.message,
          selector: sel
        };
      }
    }, selector);
    
    this.selectorCache.set(cacheKey, {
      ...compiled,
      timestamp: Date.now()
    });
    
    return compiled;
  }
  
  // Extract HTML with caching
  async extractHTML(selector = 'body') {
    const cacheKey = `html:${selector}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      this.cacheStats.hits++;
      return cached.html;
    }
    
    this.cacheStats.misses++;
    
    // Validate selector
    const compiled = await this.compileSelector(selector);
    if (!compiled.valid) {
      throw new Error(`Invalid selector: ${selector}`);
    }
    
    // Extract HTML
    const html = await this.page.$eval(selector, el => el.outerHTML);
    
    this.cache.set(cacheKey, {
      html,
      timestamp: Date.now(),
      size: html.length
    });
    
    return html;
  }
  
  // Extract text with caching
  async extractText(selector = 'body') {
    const cacheKey = `text:${selector}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      this.cacheStats.hits++;
      return cached.text;
    }
    
    this.cacheStats.misses++;
    
    // Validate selector
    await this.compileSelector(selector);
    
    // Extract text
    const text = await this.page.$eval(selector, el => el.innerText);
    
    this.cache.set(cacheKey, {
      text,
      timestamp: Date.now(),
      size: text.length
    });
    
    return text;
  }
  
  // Extract links with caching
  async extractLinks(selector = 'body') {
    const cacheKey = `links:${selector}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      this.cacheStats.hits++;
      return cached.links;
    }
    
    this.cacheStats.misses++;
    
    // Validate selector
    await this.compileSelector(selector);
    
    // Extract links
    const links = await this.page.$eval(selector, (root) => {
      return Array.from(root.querySelectorAll('a')).map(el => ({
        href: el.href,
        text: el.innerText?.substring(0, 100),
        title: el.title,
        target: el.target
      }));
    });
    
    this.cache.set(cacheKey, {
      links,
      timestamp: Date.now(),
      size: JSON.stringify(links).length
    });
    
    return links;
  }
  
  // Get cache statistics
  getStats() {
    return {
      cacheSize: this.cache.size,
      selectorCacheSize: this.selectorCache.size,
      hitRate: `${this.getCacheHitRate().toFixed(1)}%`,
      totalHits: this.cacheStats.hits,
      totalMisses: this.cacheStats.misses,
      totalInvalidations: this.cacheStats.invalidations,
      memoryEstimate: this.estimateCacheMemory()
    };
  }
  
  // Estimate cache memory usage
  estimateCacheMemory() {
    let bytes = 0;
    
    for (const entry of this.cache.values()) {
      bytes += entry.size || 0;
    }
    
    return {
      bytes,
      mb: (bytes / 1024 / 1024).toFixed(2)
    };
  }
}
```

#### Testing:
```bash
# Run extraction tests
npm test -- tests/extraction.test.js

# Benchmark: Compare cached vs non-cached
npm run benchmark:extraction
# Should show 50-70% latency reduction on cache hits
```

---

### OPT-03: Async Screenshot Writing

#### Location: Create new file `/home/devel/basset-hound-browser/screenshots/async-writer.js`

```javascript
/**
 * Asynchronous Screenshot Write Queue
 * Decouples screenshot capture from disk I/O
 * 
 * Benefits:
 * - Screenshot operations return immediately
 * - Batch writes to reduce I/O overhead
 * - Configurable backpressure and flushing
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class AsyncScreenshotWriter extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.queue = [];
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.flushInterval = options.flushInterval || 100; // ms
    this.maxBatchSize = options.maxBatchSize || 50;
    
    this.timer = null;
    this.isWriting = false;
    this.stats = {
      queued: 0,
      written: 0,
      failed: 0,
      totalQueueSize: 0
    };
    
    this.logger = options.logger || console;
  }
  
  /**
   * Queue a screenshot for async writing
   * Returns immediately (non-blocking)
   */
  async queueScreenshot(data, filename) {
    if (this.queue.length >= this.maxQueueSize) {
      this.stats.failed++;
      throw new Error(
        `Screenshot queue full (${this.maxQueueSize} max). ` +
        `Try again in a moment.`
      );
    }
    
    this.queue.push({ data, filename, timestamp: Date.now() });
    this.stats.queued++;
    this.stats.totalQueueSize = Math.max(this.stats.totalQueueSize, this.queue.length);
    
    // Trigger flush if queue is full or no timer running
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
    
    // Emit event for monitoring
    this.emit('queued', { filename, queueSize: this.queue.length });
    
    return { success: true, queued: true, queueSize: this.queue.length };
  }
  
  /**
   * Flush queued screenshots to disk
   * Writes in parallel with batching
   */
  async flush() {
    if (this.queue.length === 0 || this.isWriting) return;
    
    clearTimeout(this.timer);
    this.timer = null;
    
    this.isWriting = true;
    const batch = this.queue.splice(0, this.maxBatchSize);
    
    try {
      const startTime = Date.now();
      
      // Write all screenshots in parallel
      const writePromises = batch.map(item =>
        this._writeScreenshot(item)
      );
      
      const results = await Promise.allSettled(writePromises);
      
      // Track results
      let successCount = 0;
      let failureCount = 0;
      
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled') {
          successCount++;
          this.stats.written++;
        } else {
          failureCount++;
          this.stats.failed++;
          this.logger.error(
            `Failed to write screenshot ${batch[i].filename}: ${results[i].reason}`
          );
        }
      }
      
      const duration = Date.now() - startTime;
      this.logger.debug(
        `Flushed ${successCount} screenshots (${failureCount} failed) in ${duration}ms`
      );
      
      this.emit('flushed', { successCount, failureCount, duration });
      
    } catch (error) {
      this.logger.error('Critical error during flush:', error);
      this.emit('error', error);
    } finally {
      this.isWriting = false;
      
      // Schedule next flush if queue still has items
      if (this.queue.length > 0) {
        this.timer = setTimeout(() => this.flush(), this.flushInterval);
      }
    }
  }
  
  /**
   * Write a single screenshot to disk
   * @private
   */
  async _writeScreenshot(item) {
    const { data, filename } = item;
    
    // Ensure directory exists
    const dir = path.dirname(filename);
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(filename, data);
  }
  
  /**
   * Graceful shutdown - flush remaining screenshots
   */
  async shutdown() {
    clearTimeout(this.timer);
    
    // Flush remaining items
    while (this.queue.length > 0) {
      await this.flush();
    }
    
    this.logger.info(`Shutdown complete. Written: ${this.stats.written}, Failed: ${this.stats.failed}`);
  }
  
  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.queue.length,
      successRate: this.stats.written / (this.stats.written + this.stats.failed) || 0
    };
  }
}

module.exports = { AsyncScreenshotWriter };
```

#### Integration with ScreenshotManager (Location: `/home/devel/basset-hound-browser/screenshots/manager.js`)

```javascript
// Add to ScreenshotManager constructor
constructor(options = {}) {
  // ... existing code ...
  
  // Initialize async writer
  const { AsyncScreenshotWriter } = require('./async-writer');
  this.asyncWriter = new AsyncScreenshotWriter({
    maxQueueSize: options.maxScreenshotQueue || 1000,
    flushInterval: options.flushInterval || 100,
    logger: this.logger
  });
}

// Modify screenshot capture to use async writer
async captureScreenshot(params) {
  const { type = 'full', format = 'png', annotate = false, selector } = params;
  
  try {
    // Capture screenshot (existing logic)
    const screenshot = await this._captureScreenshotData(type, format, selector);
    
    // Generate filename
    const filename = this._generateScreenshotFilename(format);
    
    // Queue for async writing instead of blocking
    await this.asyncWriter.queueScreenshot(screenshot, filename);
    
    // Return immediately without waiting for disk write
    return {
      success: true,
      filename,
      size: screenshot.length,
      format,
      queued: true,
      timestamp: Date.now()
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Add shutdown hook
async shutdown() {
  await this.asyncWriter.shutdown();
}
```

#### Testing:
```bash
# Run screenshot tests
npm test -- tests/screenshots.test.js

# Benchmark: Screenshot performance
npm run benchmark:screenshots
# Should show screenshots return <100ms (not waiting for disk)
```

---

## Performance Validation Protocol

### Before Optimization Baseline
```bash
# Terminal 1: Start server
npm start

# Terminal 2: Run profiler with current code
node tests/performance-profiler-advanced.js \
  --duration 120 \
  --concurrency 100 \
  --output tests/results/BASELINE-BEFORE.md

# Results will show:
# - Command lookup time: 30-80µs (average)
# - DOM extraction latency: 20-30ms per operation
# - Screenshot latency: 50-200ms (waiting for disk)
# - Throughput: ~285 msg/sec
```

### After Optimization Measurements
```bash
# Run profiler with optimized code
node tests/performance-profiler-advanced.js \
  --duration 120 \
  --concurrency 100 \
  --output tests/results/BASELINE-AFTER.md

# Expected improvements:
# - Command lookup time: <10µs (85% reduction)
# - DOM extraction latency: 5-10ms per operation (70% reduction)
# - Screenshot latency: 50-70ms (non-blocking)
# - Throughput: ~380-420 msg/sec (33-47% improvement)
```

### Comparison
```bash
# Generate comparison report
node tests/performance-comparison.js \
  --before tests/results/BASELINE-BEFORE.md \
  --after tests/results/BASELINE-AFTER.md \
  --output tests/results/OPTIMIZATION-RESULTS.md
```

---

## Risk Mitigation Checklist

### Hash Routing
- [ ] Validate all 164 commands in command router
- [ ] Test each command with hash routing
- [ ] Verify error handling for unknown commands
- [ ] Check for performance regression (should not occur)

### DOM Caching
- [ ] Test cache invalidation on navigation
- [ ] Test cache invalidation on framenavigated
- [ ] Verify cache doesn't hold stale data
- [ ] Monitor cache memory usage
- [ ] Test with fast navigation sequences

### Async Screenshot Writing
- [ ] Test queue doesn't lose screenshots on crash
- [ ] Test graceful shutdown with pending writes
- [ ] Test backpressure handling (queue full)
- [ ] Test concurrent writes don't corrupt files
- [ ] Verify directory creation works

---

## Success Criteria

### Minimum Performance Targets
- [ ] Command routing latency: <10µs (vs 30-80µs)
- [ ] DOM cache hit rate: >80%
- [ ] Screenshot queue: <100 items on average
- [ ] Throughput increase: ≥20%
- [ ] No test regressions

### Target Performance Metrics
- [ ] Throughput: 380-420 msg/sec (+33-47%)
- [ ] P99 latency: 1.2ms (-40% from 2.1ms)
- [ ] Cache memory: <5 MB
- [ ] Queue flush time: <50ms for 50 items
- [ ] Zero data loss scenarios

---

## Rollback Procedure

If issues arise after any optimization:

1. **Hash Routing Rollback:**
   ```javascript
   // Comment out initializeCommandRouter() call
   // Revert handleCommand() to switch statement
   // Restart server
   ```

2. **DOM Caching Rollback:**
   ```javascript
   // Set cacheTTL = 0 to disable
   // Or comment out cache.get() checks
   // Restart server
   ```

3. **Async Writing Rollback:**
   ```javascript
   // Make queueScreenshot() synchronous
   // Or await flush immediately
   // Restart server
   ```

Each optimization can be independently rolled back without affecting others.

---

## Implementation Timeline

**Hour 1-2: Hash-Based Routing**
- Implement command router
- Test all commands
- Benchmark lookup time
- Expected gain: +20%

**Hour 3-4: DOM Caching**
- Add cache layer
- Implement invalidation
- Monitor cache hit rate
- Expected gain: +15%

**Hour 5-6: Async Screenshot Writing**
- Create write queue
- Implement batching
- Test queue management
- Expected gain: +15%

**Hour 7-8: Testing & Validation**
- Run full test suite
- Execute load tests (100-200 concurrent)
- Compare before/after metrics
- Document improvements

**Hour 9-10: Monitoring & Tuning**
- Deploy optimizations
- Monitor production metrics
- Adjust cache TTLs if needed
- Fine-tune batch sizes

**Hour 11-12: Advanced Optimizations (if time permits)**
- Implement API caching
- Implement context pooling
- Additional performance tuning

---

**Status:** Ready for Implementation  
**Confidence:** HIGH (based on profiling analysis)  
**Effort Required:** 10-12 hours  
**Expected Result:** 380-420 msg/sec throughput (+40-50% improvement)
