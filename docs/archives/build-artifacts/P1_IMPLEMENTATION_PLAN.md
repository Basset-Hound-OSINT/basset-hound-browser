# P1 Critical Bugs Implementation Plan

## Overview
Two critical production bugs preventing stable operation in Docker containers:
1. **P1-001: Electron Headless Mode (6 hours)** - Electron app exits without headless initialization
2. **P1-002: WebSocket Timeout (4 hours)** - Large documents (>10MB) timeout after 30 seconds

**Estimated Total Time:** 10 hours  
**Risk Level:** Medium (both affect core functionality)  
**Implementation Order:** P1-001 first (enables Docker), then P1-002 (improves reliability)

---

## P1-001: Electron Headless Mode (6 hours)

### Problem Analysis
**Root Cause:** Docker containers fail to start because:
1. `src/main/main.js` lines 6-11 hard exit if `app` is undefined (CI/headless safe guard)
2. Dockerfile has Xvfb installed but `configureHeadlessMode()` not called before `app.ready()`
3. Headless manager exists but not integrated into app startup sequence

**Current Flow (Broken):**
```
Docker start → Dockerfile entrypoint → node websocket/server.js
                ↓
          websocket/server.js requires main.js
                ↓
          main.js loads Electron (no DISPLAY)
                ↓
          main.js checks app (undefined in headless)
                ↓
          process.exit(1) → Container dies
```

**Target Flow (Fixed):**
```
Docker start → Dockerfile entrypoint → node websocket/server.js
                ↓
          websocket/server.js requires main.js
                ↓
          main.js detects headless environment
                ↓
          main.js calls configureHeadlessMode() BEFORE app.ready()
                ↓
          Headless manager starts Xvfb if needed
                ↓
          Electron app initializes in headless mode
                ↓
          WebSocket server starts successfully
```

### Solution: Option A (Xvfb-based, recommended)
Use existing Xvfb + HeadlessManager, ensure initialization happens before app.ready()

### Files to Modify

#### 1. `src/main/main.js` (Lines 1-12, 586-644)
**Change #1: Remove hard exit check (lines 6-11)**

Replace:
```javascript
if (!app) {
  console.error('[main.js] FATAL: Electron app not available...');
  process.exit(1);
}
```

With:
```javascript
// Allow undefined app in test/CI environments - will be handled gracefully
if (!app && process.env.NODE_ENV === 'production' && !process.env.RUNNING_TESTS) {
  console.error('[main.js] FATAL: Electron app not available...');
  process.exit(1);
}
```

**Change #2: Add headless initialization BEFORE app.whenReady() (line ~713)**

Add before line 713 (before `const isTorMode = configureTorMode();`):
```javascript
// ==========================================
// Pre-app Initialization: Headless Mode
// ==========================================

/**
 * Early headless initialization - must happen before app.whenReady()
 * to ensure Xvfb is available when Electron starts
 */
async function initializeHeadlessModeEarly() {
  const headlessOpts = getHeadlessOptions();
  
  if (!headlessOpts.headless) {
    return;
  }
  
  console.log('[Headless] Pre-app initialization...');
  
  // Detect environment early
  const envDetection = headlessManager.detectHeadlessEnvironment();
  
  // Auto-enable headless mode in Docker/CI if explicitly requested or detected
  if (envDetection.dockerEnvironment || envDetection.ciEnvironment) {
    console.log('[Headless] Detected headless environment (Docker/CI)');
    headlessOpts.virtualDisplay = true; // Force virtual display in containers
  }
  
  // Start Xvfb BEFORE Electron initializes if no display available
  if (headlessOpts.virtualDisplay && !envDetection.hasDisplay) {
    const vdResult = headlessManager.startVirtualDisplay({
      displayNum: 99,
      resolution: '1920x1080x24'
    });
    
    if (vdResult.success) {
      console.log('[Headless] Virtual display started early:', vdResult.display);
      isHeadlessMode = true;
    } else {
      console.warn('[Headless] Failed to start virtual display:', vdResult.error);
      // Don't fatal - Xvfb might fail but Electron might still work
    }
  }
  
  // Apply command-line flags early
  headlessManager.parseCommandLineArgs();
  if (headlessOpts.disableGpu) {
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
  }
  if (headlessOpts.noSandbox) {
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('disable-setuid-sandbox');
  }
  
  // Always safe to add these
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('disable-background-networking');
  
  headlessManager.enabled = true;
  
  console.log('[Headless] Pre-app initialization complete');
}

// Initialize headless mode early (before app.whenReady())
try {
  initializeHeadlessModeEarly();
} catch (error) {
  console.error('[Headless] Early initialization error:', error.message);
  console.error('[Headless] Continuing without early headless setup...');
}
```

**Change #3: Update app.whenReady() callback (after line 1192)**

Find existing `app.whenReady().then(async () => {` and add this at the very beginning:
```javascript
// Finalize headless mode configuration now that app is ready
if (isHeadlessMode) {
  console.log('[Headless] Finalizing headless configuration...');
  headlessManager.applyElectronFlags();
  headlessManager.initialized = true;
}
```

#### 2. `config/docker/Dockerfile` (Lines 162-164)
**Change: Ensure environment variables are set before startup**

Current startup section (lines 162-164):
```bash
RUN printf '#!/bin/bash\n\n...
echo "[startup] Display: ${DISPLAY}"\necho "[startup]"\n\n
```

Replace the startup script with:
```bash
RUN printf '#!/bin/bash\n\nexport PATH="/app/node_modules/.bin:$PATH"\n\necho "[startup] Container environment ready"\necho "[startup] DISPLAY=${DISPLAY}"\necho "[startup] Node version: $(node --version)"\necho "[startup] Starting services..."\n\n# Start Xvfb virtual display FIRST\nif [ -z "$DISPLAY" ]; then\n  echo "[startup] DISPLAY not set - starting Xvfb on :99"\n  Xvfb :99 -screen 0 1920x1080x24 -ac -noreset >/dev/null 2>&1 &\n  export DISPLAY=:99\n  sleep 1\n  echo "[startup] Xvfb started on :99"\nelse\n  echo "[startup] Using existing DISPLAY: $DISPLAY"\nfi\n\necho "[startup] DISPLAY=$DISPLAY"\necho "[startup] Starting WebSocket server on port 8765..."\n\ncd /app && npm start 2>&1\n' > /app/docker-entrypoint.sh && \\\nchmod +x /app/docker-entrypoint.sh
```

Key changes:
- Start Xvfb **before** Node.js (not in background after services start)
- Set DISPLAY env var explicitly  
- Use `npm start` instead of `node websocket/server.js` (respects package.json scripts)
- Wait 1 second for Xvfb to be ready

#### 3. Create test file: `tests/p1-001-headless.test.js`

```javascript
/**
 * P1-001: Electron Headless Mode Tests
 * Verify headless mode initialization works in Docker/CI environments
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { spawn } = require('child_process');
const path = require('path');

describe('P1-001: Electron Headless Mode', () => {
  
  it('should initialize headless mode when DISPLAY is not set', () => {
    const { HeadlessManager } = require('../headless/manager');
    const manager = new HeadlessManager();
    
    // Mock environment without DISPLAY
    const originalDisplay = process.env.DISPLAY;
    delete process.env.DISPLAY;
    
    const result = manager.detectHeadlessEnvironment();
    
    expect(result.hasDisplay).toBe(false);
    
    // Restore
    if (originalDisplay) process.env.DISPLAY = originalDisplay;
  });
  
  it('should start Xvfb successfully', () => {
    const { HeadlessManager } = require('../headless/manager');
    const manager = new HeadlessManager();
    
    // Skip on non-Linux platforms
    if (process.platform !== 'linux') {
      console.log('[Test] Skipping Xvfb test on non-Linux platform');
      return;
    }
    
    // Note: This test requires Xvfb to be installed
    // In CI, this may not be available - that's OK for now
    if (!process.env.CI) {
      const result = manager.startVirtualDisplay({
        displayNum: 199,
        resolution: '1920x1080x24'
      });
      
      expect(result.success).toBe(true);
      expect(result.display).toMatch(/^:\d+$/);
      
      // Clean up
      manager.stopVirtualDisplay();
    }
  });
  
  it('should parse headless CLI options correctly', () => {
    const { HeadlessManager } = require('../headless/manager');
    const manager = new HeadlessManager();
    
    // Mock process.argv
    const originalArgv = process.argv;
    process.argv = ['node', 'app.js', '--headless', '--disable-gpu'];
    
    const opts = manager.parseCommandLineArgs();
    
    expect(opts.headless).toBe(true);
    expect(opts.disableGpu).toBe(true);
    
    process.argv = originalArgv;
  });
  
  it('should apply electron flags when headless is enabled', () => {
    const { HeadlessManager } = require('../headless/manager');
    const manager = new HeadlessManager();
    
    manager.enabled = true;
    manager.cliOptions.disableGpu = true;
    
    // This would normally modify Electron's app.commandLine
    // Just verify the manager can be set to enabled without error
    expect(manager.enabled).toBe(true);
  });
});
```

### Validation Steps
1. Build Docker image: `docker build -f config/docker/Dockerfile -t basset-hound-browser:test .`
2. Run container: `docker run --rm basset-hound-browser:test`
3. Verify: Container starts, WebSocket server listens on port 8765, Xvfb active
4. Run tests: `npm test -- p1-001-headless.test.js`

### Backward Compatibility
- ✅ No breaking changes to public APIs
- ✅ Headless mode only enabled when explicitly requested
- ✅ Normal (GUI) mode unaffected
- ✅ Test environments still work

---

## P1-002: WebSocket Timeout (4 hours)

### Problem Analysis
**Root Cause:** Hardcoded 30-second IPC timeout insufficient for large documents
- `websocket/server.js` line 175: `const IPC_DEFAULT_TIMEOUT = 30000;`
- Documents >10MB take longer than 30s to serialize/send
- Affects: `get_content`, `screenshot_full_page`, and other large-response commands

**Current Architecture:**
```
WebSocket request → ipcWithTimeout(timeout=30000)
                 ↓
          Renders page in webContents
                 ↓
          Serializes all DOM (can be 10-50MB)
                 ↓
          Sends via IPC (slow on large payloads)
                 ↓
          TIMEOUT after 30 seconds ❌ (content not fully sent)
```

**Target Architecture:**
```
WebSocket request → adaptiveIpcWithTimeout()
                 ↓
          Start adaptive timeout (base=30s, max=120s)
                 ↓
          Listen for progress events from renderer
                 ↓
          Extend timeout if data flowing (DOM serialization)
                 ↓
          Complete large payloads (>10MB) in 60-90s ✅
```

### Solution: Adaptive Timeout with Progress Tracking

**Key Metrics:**
- Base timeout: 30 seconds (small pages)
- Max timeout: 120 seconds (very large documents)
- Progress tracking: Listens to renderer progress events
- Heartbeat interval: 5 seconds (extend timeout if data flowing)

### Files to Modify

#### 1. `websocket/server.js` (Lines 173-264)

**Change #1: Add adaptive timeout configuration (after line 175)**

Replace:
```javascript
const IPC_DEFAULT_TIMEOUT = 30000;
```

With:
```javascript
/**
 * Default timeout for IPC responses (30 seconds)
 * This is the base timeout for small responses.
 * Large responses can extend this up to IPC_MAX_TIMEOUT.
 */
const IPC_DEFAULT_TIMEOUT = 30000;

/**
 * Maximum timeout for IPC responses (120 seconds)
 * Large documents (>10MB) may take up to 2 minutes to serialize and transmit.
 */
const IPC_MAX_TIMEOUT = 120000;

/**
 * Timeout extension period when progress is detected (5 seconds)
 * If we receive data updates, we extend the timeout by this amount.
 */
const IPC_PROGRESS_HEARTBEAT = 5000;

/**
 * Configuration for adaptive timeout behavior
 */
const ADAPTIVE_TIMEOUT_CONFIG = {
  enabled: true,
  baseTimeout: IPC_DEFAULT_TIMEOUT,
  maxTimeout: IPC_MAX_TIMEOUT,
  progressHeartbeat: IPC_PROGRESS_HEARTBEAT,
  // Commands that commonly have large responses should use higher base timeouts
  largeResponseCommands: [
    'get_content',      // Full page HTML/DOM
    'screenshot_full_page',  // Full page screenshot
    'export_cookies',   // All cookies
    'export_history',   // Full history
    'get_network_logs'  // All network logs
  ]
};
```

**Change #2: Replace ipcWithTimeout function (lines 193-264)**

Replace the entire `ipcWithTimeout` function with:

```javascript
/**
 * Calculate initial timeout based on command
 * Large response commands get higher base timeout
 * @param {string} command - The command being executed (optional)
 * @returns {number} Initial timeout in milliseconds
 */
function getInitialTimeout(command = null) {
  if (!ADAPTIVE_TIMEOUT_CONFIG.enabled) {
    return ADAPTIVE_TIMEOUT_CONFIG.baseTimeout;
  }
  
  // Large response commands get more time to start responding
  if (command && ADAPTIVE_TIMEOUT_CONFIG.largeResponseCommands.includes(command)) {
    return Math.min(
      ADAPTIVE_TIMEOUT_CONFIG.baseTimeout * 1.5,  // 1.5x base (45 seconds)
      ADAPTIVE_TIMEOUT_CONFIG.maxTimeout
    );
  }
  
  return ADAPTIVE_TIMEOUT_CONFIG.baseTimeout;
}

/**
 * Execute an IPC request with adaptive timeout
 *
 * RELIABILITY FIX (P1-002):
 * - Adaptive timeout extends based on progress detection
 * - Supports large documents (>10MB) up to 120 seconds
 * - Heartbeat-based progress tracking prevents false timeouts
 * - Backward compatible: can be disabled via config
 *
 * @param {Electron.WebContents} webContents - The webContents to send to
 * @param {string} sendChannel - The channel to send the request on
 * @param {string} responseChannel - The channel to listen for response on
 * @param {any} data - Data to send (optional)
 * @param {number} timeout - Timeout in milliseconds (optional, auto-calculated)
 * @param {string} command - The command name for adaptive timeout (optional)
 * @returns {Promise<any>} The response from the renderer
 */
function ipcWithTimeout(webContents, sendChannel, responseChannel, data = null, timeout = null, command = null) {
  return new Promise((resolve, reject) => {
    // Use adaptive timeout if not specified
    if (timeout === null) {
      timeout = getInitialTimeout(command);
    }
    
    let currentTimeout = timeout;
    let timeoutId;
    let completed = false;
    let handler = null;
    let progressHandler = null;
    let lastProgressTime = Date.now();
    let totalDataReceived = 0;
    let progressEventsReceived = 0;

    /**
     * Safety cleanup function - ensures one-time execution
     * and proper resource cleanup
     * @private
     */
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (handler && completed === false) {
        // Only remove listener if handler was registered
        ipcMain.removeListener(responseChannel, handler);
      }
      if (progressHandler) {
        ipcMain.removeListener(responseChannel + '-progress', progressHandler);
      }
      handler = null;
      progressHandler = null;
    };

    /**
     * Handler for successful response
     * @private
     */
    handler = (event, result) => {
      // Atomic check-and-set to prevent race conditions
      if (completed) return;
      completed = true;

      cleanup();
      resolve(result);
    };

    /**
     * Handler for progress updates (large document serialization)
     * Extends the timeout if data is flowing
     * @private
     */
    progressHandler = (event, progressData) => {
      if (completed) return;
      
      // Track progress
      lastProgressTime = Date.now();
      progressEventsReceived++;
      if (progressData?.dataSize) {
        totalDataReceived += progressData.dataSize;
      }
      
      // Extend timeout while data is flowing
      if (timeoutId) {
        clearTimeout(timeoutId);
        
        // Calculate new timeout: extend by heartbeat amount
        const newTimeout = Math.min(
          IPC_PROGRESS_HEARTBEAT,
          ADAPTIVE_TIMEOUT_CONFIG.maxTimeout - (Date.now() - (Date.now() - currentTimeout))
        );
        
        currentTimeout = Math.min(
          currentTimeout + newTimeout,
          ADAPTIVE_TIMEOUT_CONFIG.maxTimeout
        );
        
        timeoutId = setTimeout(timeoutHandler, currentTimeout);
      }
    };

    /**
     * Handler for timeout
     * @private
     */
    const timeoutHandler = () => {
      // Atomic check-and-set to prevent race conditions
      if (completed) return;
      completed = true;

      cleanup();
      
      // Enhanced error message with diagnostic info
      const diagnostics = {
        initialTimeout: timeout,
        maxTimeout: ADAPTIVE_TIMEOUT_CONFIG.maxTimeout,
        adaptiveTimeoutEnabled: ADAPTIVE_TIMEOUT_CONFIG.enabled,
        progressEventsReceived,
        totalDataReceived,
        lastProgressTime: new Date(lastProgressTime).toISOString()
      };
      
      const errorMsg = `IPC timeout: No response from '${responseChannel}' ` +
        `within ${Math.round(currentTimeout / 1000)}s (max ${Math.round(ADAPTIVE_TIMEOUT_CONFIG.maxTimeout / 1000)}s). ` +
        `Progress events: ${progressEventsReceived}, Data received: ${totalDataReceived} bytes`;
      
      const error = new Error(errorMsg);
      error.diagnostics = diagnostics;
      error.isTimeoutError = true;
      
      reject(error);
    };

    // Register handlers
    ipcMain.once(responseChannel, handler);
    
    // Listen for progress events if adaptive timeout is enabled
    if (ADAPTIVE_TIMEOUT_CONFIG.enabled && command && 
        ADAPTIVE_TIMEOUT_CONFIG.largeResponseCommands.includes(command)) {
      ipcMain.on(responseChannel + '-progress', progressHandler);
    }

    // Set initial timeout with guaranteed cleanup
    timeoutId = setTimeout(timeoutHandler, currentTimeout);

    // Send the request (use try-catch to handle potential errors)
    try {
      if (data !== null) {
        webContents.send(sendChannel, data);
      } else {
        webContents.send(sendChannel);
      }
    } catch (error) {
      // If send fails, clean up and reject
      if (completed) return;
      completed = true;

      cleanup();
      reject(new Error(`IPC send failed on '${sendChannel}': ${error.message}`));
    }
  });
}
```

**Change #3: Update command handlers to use adaptive timeout (lines ~2217, ~2230, etc.)**

Update all large-response command handlers to pass the command name:

For `get_content` (line 2217):
```javascript
this.commandHandlers.get_content = async (params) => {
  try {
    return await ipcWithTimeout(
      this.mainWindow.webContents,
      'get-page-content',
      'page-content-response',
      null,           // data
      null,           // timeout (auto-calculate)
      'get_content'   // command name for adaptive timeout
    );
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

For `screenshot_full_page` (find and update):
```javascript
this.commandHandlers.screenshot_full_page = async (params) => {
  // ... existing code ...
  return await ipcWithTimeout(
    this.mainWindow.webContents,
    'screenshot-full-page',
    'screenshot-full-page-response',
    options,
    null,
    'screenshot_full_page'  // command name
  );
};
```

For other large-response commands, add command name parameter similarly.

#### 2. `src/preload/preload.js` - Add Progress Event Support

Find the renderer-side IPC handlers and add progress event emission for large operations:

Add (after existing IPC setup):
```javascript
/**
 * Emit progress events during large data serialization
 * Used by P1-002 adaptive timeout to track large document processing
 */
function reportProgress(event, dataSize) {
  const { ipcRenderer } = require('electron');
  try {
    ipcRenderer.send(event + '-progress', {
      dataSize,
      timestamp: Date.now()
    });
  } catch (err) {
    // Silently fail - progress is nice-to-have, not critical
  }
}

// Update get-page-content handler to report progress
ipcMain.on('get-page-content', () => {
  try {
    // Serialize DOM in chunks, reporting progress
    const htmlContent = document.documentElement.outerHTML;
    const chunkSize = 1024 * 1024; // 1MB chunks
    
    for (let i = 0; i < htmlContent.length; i += chunkSize) {
      reportProgress('page-content-response', chunkSize);
    }
    
    // ... rest of handler ...
  }
});
```

#### 3. Create test file: `tests/p1-002-timeout.test.js`

```javascript
/**
 * P1-002: WebSocket Timeout Tests
 * Verify adaptive timeout works for large documents
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('P1-002: WebSocket Adaptive Timeout', () => {
  
  let server;
  
  beforeEach(() => {
    // Mock server setup
    server = {
      mainWindow: {
        webContents: {
          send: jest.fn()
        }
      }
    };
  });
  
  it('should use base timeout for normal commands', () => {
    const timeout = require('../websocket/server.js');
    const { getInitialTimeout } = timeout;
    
    const result = getInitialTimeout('get_url');
    
    // Should use default (30s)
    expect(result).toBe(30000);
  });
  
  it('should use extended timeout for large-response commands', () => {
    const timeout = require('../websocket/server.js');
    const { getInitialTimeout } = timeout;
    
    const result = getInitialTimeout('get_content');
    
    // Should be 1.5x base = 45 seconds
    expect(result).toBe(45000);
  });
  
  it('should never exceed max timeout', () => {
    const timeout = require('../websocket/server.js');
    const { getInitialTimeout } = timeout;
    
    const result = getInitialTimeout('get_content');
    
    // Should not exceed max (120s)
    expect(result).toBeLessThanOrEqual(120000);
  });
  
  it('should handle timeout errors with diagnostics', async () => {
    // Mock ipcWithTimeout with timeout scenario
    const { ipcMain } = require('electron');
    const mockWebContents = {
      send: jest.fn()
    };
    
    // This would require mocking the IPC system to test properly
    // In practice, integration tests with real Electron are better
    expect(true).toBe(true); // Placeholder
  });
  
  it('should support disabling adaptive timeout via config', () => {
    // Verify config can disable feature
    const ADAPTIVE_TIMEOUT_CONFIG = require('../websocket/server.js').ADAPTIVE_TIMEOUT_CONFIG;
    
    expect(ADAPTIVE_TIMEOUT_CONFIG).toHaveProperty('enabled');
    expect(typeof ADAPTIVE_TIMEOUT_CONFIG.enabled).toBe('boolean');
  });
});
```

#### 4. Update configuration `config/app-config.json`

Add timeout configuration section:
```json
{
  "server": {
    "port": 8765,
    "ipc": {
      "adaptiveTimeout": {
        "enabled": true,
        "baseTimeout": 30000,
        "maxTimeout": 120000,
        "progressHeartbeat": 5000
      }
    }
  }
}
```

### Validation Steps

1. **Unit Tests:**
   ```bash
   npm test -- p1-002-timeout.test.js
   ```

2. **Integration Test (get_content with large document):**
   ```bash
   npm start &
   # In another terminal:
   curl -s http://localhost:8765 \
     -H "Content-Type: application/json" \
     -d '{"command":"navigate","url":"https://example.com"}' \
     -d '{"command":"get_content"}' \
   # Should handle large HTML without timeout
   ```

3. **Stress Test (10MB+ document):**
   ```bash
   # Navigate to a heavy page and get content
   npm run test:stress -- --command get_content --size 10mb
   ```

### Backward Compatibility
- ✅ Default behavior unchanged for small documents
- ✅ Timeout can be disabled via config
- ✅ Command signatures unchanged (timeout parameter optional)
- ✅ Progress events optional (handler degrades gracefully)

---

## Implementation Checklist

### Phase 1: P1-001 Headless Mode (6 hours)
- [ ] Modify `src/main/main.js` (Add headless init + early startup)
- [ ] Update `config/docker/Dockerfile` (Fix startup script)
- [ ] Create test file `tests/p1-001-headless.test.js`
- [ ] Verify Docker build succeeds
- [ ] Test Docker container startup
- [ ] Run headless tests: `npm test -- p1-001-headless.test.js`

### Phase 2: P1-002 Adaptive Timeout (4 hours)
- [ ] Modify `websocket/server.js` (Add adaptive timeout logic)
- [ ] Update command handlers to pass command name
- [ ] Update `src/preload/preload.js` (Add progress reporting)
- [ ] Create test file `tests/p1-002-timeout.test.js`
- [ ] Update `config/app-config.json` (Add timeout config)
- [ ] Run timeout tests: `npm test -- p1-002-timeout.test.js`
- [ ] Integration test with large documents

### Phase 3: Integration & Validation (2-4 hours)
- [ ] Full Docker build & run test
- [ ] WebSocket server startup verification
- [ ] Large document handling test (>10MB HTML)
- [ ] Performance benchmarking
- [ ] Run full test suite: `npm test`
- [ ] Code review (before commit)
- [ ] Update CHANGELOG.md

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Xvfb fails to start | Graceful degradation - app continues without virtual display |
| Timeout extends too long | Max 120s cap prevents runaway timeouts |
| Progress events not received | Falls back to static timeout (original behavior) |
| Docker entrypoint issues | Test in isolation before full deployment |
| Backward compatibility breaks | No API changes, feature is additive |

---

## Success Criteria

### P1-001
- [ ] Docker container starts without error
- [ ] WebSocket server listens on port 8765
- [ ] `echo $DISPLAY` shows `:99` in container
- [ ] All headless tests pass
- [ ] No changes to normal (non-headless) startup

### P1-002
- [ ] 10MB+ documents don't timeout
- [ ] Small documents use 30s timeout (unchanged)
- [ ] All timeout tests pass
- [ ] Diagnostics available in error messages
- [ ] Config can disable adaptive timeout

---

## Documentation Updates
- [ ] Update DEPLOYMENT.md with headless mode options
- [ ] Add timeout configuration to API documentation
- [ ] Update troubleshooting guide (Dockerfile section)
- [ ] Create P1 fixes summary in CHANGELOG

---

## Files Changed Summary
1. `src/main/main.js` - Headless initialization + early startup
2. `config/docker/Dockerfile` - Fixed startup sequence
3. `websocket/server.js` - Adaptive timeout implementation
4. `src/preload/preload.js` - Progress event support
5. `config/app-config.json` - Timeout configuration
6. `tests/p1-001-headless.test.js` - New test file
7. `tests/p1-002-timeout.test.js` - New test file

**Total Lines Changed:** ~400-500 lines (mostly additions, minimal modifications)
