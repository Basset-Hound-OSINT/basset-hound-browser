# Technology Fingerprinting Integration Guide

**Quick Integration Steps for WebSocket Server**

---

## Step-by-Step Integration

### Step 1: Add Require Statement

**File:** `/websocket/server.js` (around line 30)

**Add:**
```javascript
const { registerTechDetectionCommands } = require('./commands/tech-detection');
```

**Location in file (example context):**
```javascript
// Line 20-30 context
const { NetworkAnalysisManager } = require('../network-analysis/manager');
const { SessionRecordingManager, RECORDING_STATE } = require('../recording/session-recorder');
const { ReplayEngine, REPLAY_STATE, ERROR_MODE } = require('../recording/replay');
const { headlessManager, HEADLESS_PRESETS } = require('../headless/manager');
const { WindowManager, WindowState } = require('../windows/manager');
const { WindowPool, PoolEntryState } = require('../windows/pool');
const { PluginManager, PLUGIN_STATE } = require('../plugins');
const { ConnectionPool } = require('./connection-pool');
const { registerTechDetectionCommands } = require('./commands/tech-detection');  // ADD THIS LINE
```

### Step 2: Register Commands in Server Initialization

**File:** `/websocket/server.js`

**Find:** The WebSocketServer class initialization or constructor method

**Add:** Call to register tech-detection commands (typically in `initialize()` or constructor)

**Example:**
```javascript
class WebSocketServer {
  constructor(options) {
    // ... existing initialization ...
    
    // Register all WebSocket commands
    this.commandHandlers = {};
    
    // Register module-specific commands
    registerTechDetectionCommands(this, this.mainWindow);  // ADD THIS LINE
  }
  
  // ... rest of class ...
}
```

Or if registration happens in a separate method:
```javascript
initialize() {
  // ... existing code ...
  
  // Register technology detection commands
  registerTechDetectionCommands(this, this.mainWindow);  // ADD THIS LINE
}
```

### Step 3: Update Retryable Commands List

**File:** `/websocket/server.js` (around line 61-68)

**Current Code:**
```javascript
retryableCommands: [
  'get_url', 'get_content', 'get_page_state', 'screenshot', 'screenshot_viewport',
  'screenshot_full_page', 'screenshot_element', 'get_cookies', 'get_all_cookies',
  'list_sessions', 'list_tabs', 'get_tab_info', 'get_active_tab', 'get_history',
  'get_downloads', 'get_proxy_status', 'get_user_agent_status', 'status', 'ping',
  'get_network_logs', 'get_console_logs', 'list_profiles', 'get_profile',
  'get_storage_stats', 'get_local_storage', 'get_session_storage', 'list_scripts',
  'get_script', 'get_blocking_stats', 'get_devtools_status', 'get_console_status'
]
```

**Updated Code:**
```javascript
retryableCommands: [
  'get_url', 'get_content', 'get_page_state', 'screenshot', 'screenshot_viewport',
  'screenshot_full_page', 'screenshot_element', 'get_cookies', 'get_all_cookies',
  'list_sessions', 'list_tabs', 'get_tab_info', 'get_active_tab', 'get_history',
  'get_downloads', 'get_proxy_status', 'get_user_agent_status', 'status', 'ping',
  'get_network_logs', 'get_console_logs', 'list_profiles', 'get_profile',
  'get_storage_stats', 'get_local_storage', 'get_session_storage', 'list_scripts',
  'get_script', 'get_blocking_stats', 'get_devtools_status', 'get_console_status',
  // Technology detection commands (read-only, safe to retry)
  'detect_technologies', 'detect_technologies_from_html', 'get_tech_database',
  'get_tech_stats', 'clear_tech_cache', 'get_technology_info',
  'get_technologies_by_category', 'batch_detect_technologies'
]
```

---

## Verification Steps

### Test 1: Verify Commands are Registered

**Method:** Check WebSocket server startup logs

**Expected Output:**
```
[INFO] TechDetectionCommands: tech_detection_commands_registered
```

**What to look for:**
- No error messages during startup
- Server initializes successfully
- All WebSocket handlers loaded

### Test 2: Quick Command Test

**Method:** Run test suite

```bash
npm test -- tests/unit/technology-fingerprint.test.js
```

**Expected Result:**
```
Tests: 37 passed, 37 total
PASS tests/unit/technology-fingerprint.test.js
```

### Test 3: Integration Test (via WebSocket)

**Method:** Manual client test

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('wss://localhost:8765');

ws.on('open', () => {
  // Test 1: Get tech stats
  ws.send(JSON.stringify({
    command: 'get_tech_stats',
    params: {}
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Response:', response);
  // Should show { success: true, statistics: { totalSignatures: 87, ... } }
});
```

### Test 4: Real Detection Test

**Method:** Test actual technology detection

```javascript
ws.send(JSON.stringify({
  command: 'detect_technologies_from_html',
  params: {
    html: `<html>
      <head>
        <meta name="generator" content="WordPress 6.4.1">
        <link rel="stylesheet" href="/wp-content/themes/style.css">
      </head>
      <body>
        <div data-react-root></div>
        <script src="/cdn/react.min.js"></script>
      </body>
    </html>`
  }
}));

// Expected response:
// {
//   "success": true,
//   "technologies": [
//     { "id": "wordpress", "name": "WordPress", "version": "6.4.1", "confidence": 0.95 },
//     { "id": "react", "name": "React", "confidence": 0.85 }
//   ],
//   "summary": { "totalDetected": 2, ... },
//   "detectionTimeMs": 45
// }
```

---

## Troubleshooting

### Issue: "registerTechDetectionCommands is not a function"

**Cause:** Import path incorrect or file not found

**Solution:**
1. Verify file exists: `/websocket/commands/tech-detection.js`
2. Verify require path: `require('./commands/tech-detection')`
3. Check export: File must have `module.exports = { registerTechDetectionCommands };`

### Issue: Commands not appearing in WebSocket

**Cause:** registerTechDetectionCommands() was not called during initialization

**Solution:**
1. Add call to `registerTechDetectionCommands(this, this.mainWindow)` in server initialization
2. Ensure it's called BEFORE server starts accepting connections
3. Check logs for registration confirmation

### Issue: Command returns "Tab not found"

**Cause:** `tabId` parameter incorrect or tab doesn't exist

**Solution:**
1. Verify tabId is valid: Use `list_tabs` command first
2. Ensure WebContents exists: `mainWindow.webContents.getAllWebContents()`
3. Pass correct parameters

### Issue: Empty detection results

**Cause:** Confidence threshold too high or no patterns match

**Solution:**
1. Lower `minConfidence` in TechnologyFingerprinter config
2. Verify HTML contains known patterns
3. Check which detection layer should match
4. Try `detect_technologies_from_html` with minimal HTML

---

## Optional: Header Collection Integration

For full HTTP header detection, integrate with Electron's network interception:

```javascript
// In websocket/server.js, add to initialization:
const { session } = require('electron');

// Capture response headers for technology detection
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  // Store headers in memory for detection
  if (!this.pageHeaders) this.pageHeaders = {};
  this.pageHeaders[details.url] = details.responseHeaders;
  
  callback({ responseHeaders: details.responseHeaders });
});
```

Then pass headers to detection:
```javascript
commandHandlers.detect_technologies = async (params) => {
  // ... existing code ...
  const pageData = {
    // ... existing data ...
    headers: this.pageHeaders[pageData.url] || {}  // ADD THIS
  };
  // ... rest of detection ...
};
```

---

## Performance Tuning (Optional)

### Cache Configuration

**Default:** 1-hour TTL

**To change cache timeout:**
```javascript
// In tech-detection.js, line 31:
fingerprinter = new TechnologyFingerprinter({
  minConfidence: 0.50,
  maxDetections: 100,
  enableFaviconHashing: true,
  enableJSDetection: true,
  enableDOMAnalysis: true,
  cacheTimeout: 1800000  // 30 minutes instead of 1 hour
});
```

### Confidence Threshold

**Default:** 0.50 (50%)

**For stricter detection:**
```javascript
// Require higher confidence
minConfidence: 0.75  // 75% minimum confidence
```

**For looser detection:**
```javascript
// Accept lower confidence
minConfidence: 0.30  // 30% minimum confidence
```

---

## Monitoring & Logging

### Enable Detailed Logging

```javascript
// In websocket server initialization
const logger = require('../logging').createLogger('WebSocketServer');
logger.setLevel('debug');  // Shows tech-detection debug logs
```

### Check Cache Statistics

```javascript
ws.send(JSON.stringify({
  command: 'get_tech_stats',
  params: {}
}));

// Returns:
// {
//   "success": true,
//   "statistics": {
//     "totalSignatures": 87,
//     "categoryCount": 8,
//     "categories": { "JavaScript Framework": 25, ... },
//     "cacheSize": 12,        // Number of cached detections
//     "cacheTimeoutMs": 3600000
//   }
// }
```

### Monitor Performance

Log detection times:
```javascript
commandHandlers.detect_technologies = async (params) => {
  const startTime = Date.now();
  // ... detection logic ...
  const duration = Date.now() - startTime;
  
  if (duration > 200) {
    logger.warn('detection_slow', { duration, html_length: pageData.html?.length });
  }
};
```

---

## Post-Integration Validation

### Checklist

- [ ] Server starts without errors
- [ ] Tech detection commands registered in logs
- [ ] `get_tech_stats` returns 87 signatures
- [ ] `detect_technologies_from_html` detects WordPress correctly
- [ ] `detect_technologies_from_html` detects React correctly
- [ ] Performance <200ms for typical detection
- [ ] Cache improves performance (3-5ms on second detection)
- [ ] All 8 commands respond correctly
- [ ] Error handling works (invalid params return errors)
- [ ] Documentation updated with new commands

---

## Rollback Procedure

If integration causes issues:

1. **Remove require statement** (line ~30):
   ```javascript
   // const { registerTechDetectionCommands } = require('./commands/tech-detection');
   ```

2. **Remove registration call** (initialization method):
   ```javascript
   // registerTechDetectionCommands(this, this.mainWindow);
   ```

3. **Remove from retryable commands** (line 61-68):
   ```javascript
   // Remove: 'detect_technologies', 'detect_technologies_from_html', etc.
   ```

4. **Restart server** - Commands will no longer be available

---

## Success Criteria

Integration is complete when:
1. ✅ Server starts without errors
2. ✅ All 8 commands are registered
3. ✅ `get_tech_stats` shows 87 signatures
4. ✅ HTML-based detection works
5. ✅ Performance <200ms average
6. ✅ All unit tests pass (37/37)
7. ✅ Cache is functional
8. ✅ Error handling works

---

## Next Steps

After successful integration:

1. **Accuracy Validation** (Optional, recommended)
   - Test against 5-10 real websites
   - Document results in `docs/findings/`

2. **Signature Expansion** (Optional, Phase 2)
   - Expand from 87 to 500+ signatures
   - Add more categories and technologies

3. **User Documentation**
   - Add to API reference
   - Include example WebSocket calls
   - Document all 8 commands

4. **Release**
   - Merge to main branch
   - Tag as v12.1.0-tech-fingerprinting
   - Deploy to production

---

**Document Version:** 1.0.0  
**Date:** June 13, 2026  
**Time Estimate:** 10-15 minutes for integration
