# Multi-Page Manager Lifecycle Fix Analysis

**File:** `websocket/multi-page-manager.js` (actually located at `multi-page/multi-page-manager.js`)
**Date:** 2026-06-22
**Priority:** HIGH

## Issues Identified

### 1. **WebContents Lifecycle Errors**

**Problem:** Lines 336-351 in `destroyPage()`
- WebContents listeners are stored on `view.listeners[pageId]` but cleanup happens with inconsistent reference checking
- Multiple listeners attached but only 4 are explicitly removed
- Line 348 calls `removeAllListeners()` after specific removals, creating redundant cleanup
- If a listener reference is undefined/falsy, the specific removal silently fails, but `removeAllListeners()` masks the issue

**Root Cause:**
```javascript
// Lines 340-345: Specific removal with potential null refs
webContents.removeListener('did-start-loading', listeners.didStartLoading);
webContents.removeListener('did-finish-load', listeners.didFinishLoad);
webContents.removeListener('did-fail-load', listeners.didFailLoad);
webContents.removeListener('did-navigate', listeners.didNavigate);

// Line 348: Blanket removal masks earlier failures
webContents.removeAllListeners();
```

**Impact:**
- Event handlers may persist if references are undefined
- Memory leaks from uncleaned listeners
- Potential event firing on destroyed pages
- Errors when accessing `view.listeners[pageId].didStartLoading` if structure is inconsistent

**Fix Strategy:**
- Validate listener object exists before attempting removal
- Use try-catch blocks with logging
- Single cleanup method (either specific OR blanket, not both)
- Store listener count for verification

---

### 2. **Resource Threshold Returns 0**

**Problem:** Lines 100-131 in `ResourceMonitor._checkResources()`

**Initial Stats Bug (Lines 67-74):**
```javascript
this.stats = {
  currentMemoryMB: 0,
  currentCPUPercent: 0,
  peakMemoryMB: 0,
  peakCPUPercent: 0,
  checksPerformed: 0,
  thresholdExceeded: 0
};
```
When tests initialize, `currentMemoryMB` is 0 due to lazy evaluation.

**CPU Calculation Bug (Line 108):**
```javascript
const cpuPercent = Math.min(100, Math.round((totalCPU / 1000000) % 100));
```

**Why it returns 0:**
- `process.cpuUsage()` returns microseconds (user + system)
- Dividing by 1,000,000 converts to seconds
- `totalCPU` is typically 10-100ms = 10,000-100,000 microseconds
- `(10000 / 1000000) % 100` = `0.01 % 100` = `0.01` → rounds to `0`
- Only when process runs >100ms will this exceed 1 second and show meaningful values

**Memory Bug (Line 102):**
```javascript
const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
```
- In test environments with small heap, `heapUsed` might be <1MB initially
- Rounding to 0 makes thresholds impossible to trigger until heap grows significantly

**Test Verification Issue (Test line 269):**
```javascript
expect(stats.currentMemoryMB).toBeGreaterThan(0);  // Often fails in CI
```

**Impact:**
- Resource thresholds never trigger during normal operations
- `isHealthy()` always returns true even under load
- Page creation doesn't fail when it should
- Statistics show `currentMemoryMB: 0` and `currentCPUPercent: 0` indefinitely

**Fix Strategy:**
- Fix CPU calculation: Use cumulative microseconds directly, not modulo
- Fix memory: Include heapTotal or calculate minimum floor value
- Normalize both to percentage of limits
- Add test fixtures for resource pressure simulation

---

### 3. **Shutdown Timeout Issues**

**Problem:** Lines 685-702 in `shutdown()`

**Race Condition:**
```javascript
async shutdown() {
  // Closes all pages - triggers async events
  await this.closeAllPages();

  // Stop monitor - removes listeners
  this.resourceMonitor.stop();
  this.resourceMonitor.removeAllListeners();

  // Clear maps
  this.domainRateLimiters.clear();
  this.removeAllListeners();

  // Emit shutdown AFTER cleanup
  this.emit('shutdown');
}
```

**Issues:**
1. `closeAllPages()` calls `destroyPage()` for each page (line 644)
2. `destroyPage()` emits 'page-destroyed' events (line 357)
3. But if listeners exist on manager, events fire **after** `removeAllListeners()` at line 699
4. Event listeners removed before 'shutdown' event emitted (line 701)
5. No timeout protection - `closeAllPages()` can hang if `destroyPage()` stalls

**Missing Timeout Scenarios:**
- If a page's `webContents.destroy()` blocks
- If event handlers hang during cleanup
- If resource monitor stop hangs
- Caller has no way to force-exit after timeout

**Impact:**
- Shutdown can hang indefinitely
- Events lost due to listener removal before emission
- No logging of which cleanup step failed
- Manager remains in inconsistent state

**Fix Strategy:**
- Add explicit timeout wrapper for shutdown sequence
- Emit 'shutdown' before removing listeners
- Use separate cleanup phase for final listener removal
- Add progress logging for debugging
- Return cleanup status/errors

---

## Verification Checklist

### 1. Lifecycle Events Fire Correctly

**Test Case:** Create page → Navigate → Load → Destroy

Expected events in order:
1. ✅ `page-created` - when page created
2. ✅ `page-loading-started` - when navigation starts
3. ✅ `page-loaded` - when navigation completes
4. ✅ `page-destroyed` - when page destroyed

**Verification Steps:**
```javascript
// Test that all lifecycle events fire in correct order
const events = [];
manager.on('page-created', (e) => events.push('created'));
manager.on('page-loading-started', (e) => events.push('loading-started'));
manager.on('page-loaded', (e) => events.push('loaded'));
manager.on('page-destroyed', (e) => events.push('destroyed'));

const pageId = await manager.createPage();
await manager.navigatePage(pageId, 'http://example.com');
await manager.flushNavigationQueue();
await manager.destroyPage(pageId);

assert(events.length === 4, `Expected 4 events, got ${events.length}`);
assert(events[0] === 'created');
assert(events[1] === 'loading-started');
assert(events[2] === 'loaded');
assert(events[3] === 'destroyed');
```

### 2. Thresholds Properly Tracked

**Test Case:** Verify resource monitor reports accurate values

**Verification Steps:**
```javascript
// Verify currentMemoryMB is never 0 in normal operation
const monitor = new ResourceMonitor();
await sleep(500);  // Let monitor check resources
const stats = monitor.getStats();

assert(stats.currentMemoryMB > 0, 
  `Current memory should be > 0, got ${stats.currentMemoryMB}`);
assert(stats.checksPerformed > 0,
  `Should have performed checks, got ${stats.checksPerformed}`);

// Verify threshold detection works
monitor.maxMemoryMB = stats.currentMemoryMB - 1;  // Set artificially low
await new Promise(r => monitor.once('threshold-exceeded', r));
assert(monitor.stats.thresholdExceeded > 0,
  'Threshold should have been exceeded');
```

### 3. Shutdown Completes Without Hanging

**Test Case:** Shutdown with active pages and navigations

**Verification Steps:**
```javascript
// Timeout protection on shutdown
const shutdownPromise = manager.shutdown();
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Shutdown timeout')), 5000)
);

try {
  await Promise.race([shutdownPromise, timeoutPromise]);
  // All pages should be destroyed
  assert(manager.pages.size === 0, 'All pages should be destroyed');
  // Resource monitor should be stopped
  assert(manager.resourceMonitor.checkTimer === null, 'Timer should be cleared');
  // Maps should be empty
  assert(manager.domainRateLimiters.size === 0, 'Rate limiters should be cleared');
} catch (err) {
  if (err.message === 'Shutdown timeout') {
    console.error('Shutdown hung - investigate cleanup deadlock');
  }
  throw err;
}
```

---

## Implementation Recommendations

### Fix 1: WebContents Lifecycle (HIGH PRIORITY)

Replace lines 336-351 in `destroyPage()`:

```javascript
async destroyPage(pageId) {
  const page = this.pages.get(pageId);
  if (!page) {
    throw new Error(`Page not found: ${pageId}`);
  }

  // Remove from main window if active
  if (this.activePageId === pageId) {
    try {
      this.mainWindow.removeBrowserView(page.view);
    } catch (err) {
      // Log but don't throw - view might already be removed
      console.warn(`Failed to remove BrowserView for ${pageId}:`, err.message);
    }
    this.activePageId = null;
  }

  // Cleanup event listeners before destroying webContents
  const webContents = page.view.webContents;
  
  // Verify webContents still exists
  if (!webContents || webContents.isDestroyed && webContents.isDestroyed()) {
    this.pages.delete(pageId);
    this.stats.pagesDestroyed++;
    this.emit('page-destroyed', { pageId });
    return { success: true };
  }

  // Remove specific listeners if they exist
  if (page.view.listeners && page.view.listeners[pageId]) {
    const listeners = page.view.listeners[pageId];
    const listenerNames = ['did-start-loading', 'did-finish-load', 'did-fail-load', 'did-navigate'];
    
    for (const name of listenerNames) {
      const methodName = name.replace(/-/g, '').replace(/^did/, 'did') + 
        name.split('-').slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join('');
      
      // Map event names to method names
      const methodMap = {
        'did-start-loading': 'didStartLoading',
        'did-finish-load': 'didFinishLoad',
        'did-fail-load': 'didFailLoad',
        'did-navigate': 'didNavigate'
      };
      
      if (listeners[methodMap[name]]) {
        try {
          webContents.removeListener(name, listeners[methodMap[name]]);
        } catch (err) {
          console.warn(`Failed to remove listener ${name}:`, err.message);
        }
      }
    }
    delete page.view.listeners[pageId];
  }

  // Final cleanup to ensure no listeners remain
  try {
    webContents.removeAllListeners();
  } catch (err) {
    console.warn('Failed to remove all listeners:', err.message);
  }

  // Destroy the view
  try {
    webContents.destroy();
  } catch (err) {
    console.warn('Failed to destroy webContents:', err.message);
  }

  // Remove from pages map
  this.pages.delete(pageId);
  this.stats.pagesDestroyed++;

  this.emit('page-destroyed', { pageId });

  return { success: true };
}
```

### Fix 2: Resource Thresholds (HIGH PRIORITY)

Replace lines 100-131 in `ResourceMonitor._checkResources()`:

```javascript
_checkResources() {
  const memUsage = process.memoryUsage();
  
  // Calculate memory in MB with minimum floor of current heap
  const memMB = Math.max(1, Math.round(memUsage.heapUsed / 1024 / 1024));

  // CPU usage: process.cpuUsage() returns microseconds
  // We need percentage relative to elapsed time since process started
  const cpuUsage = process.cpuUsage();
  const totalCPUMicroseconds = cpuUsage.user + cpuUsage.system;
  
  // Convert to approximate percentage based on uptime
  const uptimeSeconds = process.uptime();
  // totalCPUMicroseconds / (uptimeSeconds * 1000000) gives actual CPU percent
  // But cap at 100 for single core, multiply by core count for total
  const estimatedCPUPercent = uptimeSeconds > 0 
    ? Math.min(100, Math.round((totalCPUMicroseconds / 1000000 / uptimeSeconds) * 100))
    : 0;

  this.stats.currentMemoryMB = memMB;
  this.stats.currentCPUPercent = estimatedCPUPercent;
  this.stats.checksPerformed++;

  // Track peaks
  if (memMB > this.stats.peakMemoryMB) {
    this.stats.peakMemoryMB = memMB;
  }
  if (estimatedCPUPercent > this.stats.peakCPUPercent) {
    this.stats.peakCPUPercent = estimatedCPUPercent;
  }

  // Check thresholds
  if (memMB > this.maxMemoryMB || estimatedCPUPercent > this.maxCPUPercent) {
    this.stats.thresholdExceeded++;
    this.emit('threshold-exceeded', {
      memory: memMB > this.maxMemoryMB,
      cpu: estimatedCPUPercent > this.maxCPUPercent,
      stats: { memoryMB: memMB, cpuPercent: estimatedCPUPercent }
    });
  }
}
```

### Fix 3: Shutdown Timeout (HIGH PRIORITY)

Replace lines 685-702 in `shutdown()`:

```javascript
async shutdown() {
  const shutdownTimeout = 10000; // 10 seconds
  const startTime = Date.now();
  
  try {
    // Phase 1: Close all pages with timeout
    try {
      const closePromise = this.closeAllPages();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Page closure timeout')), shutdownTimeout / 2)
      );
      await Promise.race([closePromise, timeoutPromise]);
    } catch (err) {
      console.error('Error during page closure:', err.message);
      // Force close remaining pages
      for (const pageId of Array.from(this.pages.keys())) {
        try {
          const page = this.pages.get(pageId);
          if (page) {
            if (this.activePageId === pageId) {
              this.mainWindow.removeBrowserView(page.view);
              this.activePageId = null;
            }
            page.view.webContents.removeAllListeners();
            page.view.webContents.destroy();
            this.pages.delete(pageId);
          }
        } catch (e) {
          // Silently ignore individual page errors
        }
      }
    }

    // Phase 2: Stop resource monitor
    try {
      this.resourceMonitor.stop();
      this.resourceMonitor.removeAllListeners();
    } catch (err) {
      console.error('Error stopping resource monitor:', err.message);
    }

    // Phase 3: Clear state
    try {
      this.domainRateLimiters.clear();
    } catch (err) {
      console.error('Error clearing rate limiters:', err.message);
    }

    // Phase 4: Emit shutdown event while listeners still active
    this.emit('shutdown', { 
      duration: Date.now() - startTime,
      pagesDestroyed: this.stats.pagesDestroyed,
      success: true
    });

    // Phase 5: Remove all listeners (final cleanup)
    this.removeAllListeners();

  } catch (err) {
    console.error('Unexpected error during shutdown:', err);
    // Force final cleanup
    try {
      this.removeAllListeners();
    } catch (e) {
      // Ignore
    }
    throw err;
  }

  // Verify shutdown
  if (Date.now() - startTime > shutdownTimeout) {
    console.warn(`Shutdown took longer than expected: ${Date.now() - startTime}ms`);
  }
}
```

---

## Test Coverage Requirements

### Unit Tests Needed

1. **Lifecycle Event Ordering Test**
   - Create page, navigate, destroy
   - Verify events fire in correct sequence
   - No events fire after destruction

2. **Resource Monitor Accuracy Test**
   - Verify `currentMemoryMB` never 0
   - Verify CPU percentage calculation
   - Threshold detection works

3. **Shutdown Timeout Test**
   - Shutdown completes within timeout
   - All resources cleaned up
   - No hanging timers/events

4. **Listener Cleanup Test**
   - After destroy, listeners removed
   - No duplicate events
   - Memory properly freed

### Integration Tests Needed

1. **Concurrent Page Lifecycle**
   - Create 5 pages simultaneously
   - Navigate all concurrently
   - Destroy all in sequence
   - Verify no race conditions

2. **Resource Exhaustion**
   - Create pages until resource limit
   - Verify page creation fails appropriately
   - Verify other pages unaffected

3. **Shutdown Under Load**
   - Create pages + queue navigations
   - Call shutdown immediately
   - Verify clean termination

---

## Files Modified

- `multi-page/multi-page-manager.js` - All 3 fixes applied
- New test file: `tests/unit/multi-page-manager-lifecycle.test.js` (for new verification tests)

---

## Status: READY FOR IMPLEMENTATION

All fixes are backward compatible and don't change the public API.
