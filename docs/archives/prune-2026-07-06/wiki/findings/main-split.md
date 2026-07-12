# src/main/main.js Refactoring Plan: 3056 Lines → 4 Files

## Executive Summary

Current `src/main/main.js` is a monolithic 3,056-line file combining initialization, window management, WebSocket integration, and application lifecycle. This refactoring splits it into 4 focused modules, each under 800 lines, maintaining all exports and backward compatibility.

**File Size Reduction:**
- Before: 3,056 lines (1 file)
- After: ~700-750 lines per file (4 files)
- Code organization: By responsibility domain

---

## File Breakdown

### 1. `src/main/initialization.js` (~450 lines)
**Responsibility:** Module loading, configuration, early setup, Tor/Headless initialization

**Exports:**
- `configureHeadlessMode()` - headless mode configuration
- `getHeadlessOptions()` - get headless options from config
- `getTorOptions()` - get Tor options
- `configureTorMode()` - Tor setup
- `getViewportConfig()` - viewport resolution
- `initializeHeadlessModeEarly()` - P1-001 early headless init
- `isTorMode` - boolean state

**Imports:**
```javascript
// All module imports from lines 3-76
// Configuration initialization (lines 128-159)
// GC tuning (lines 80-95)
// Lazy manager initialization (lines 100-113)
// Response serialization (lines 118-123)
```

**Line References:**
- Lines 1-76: Module imports
- Lines 80-95: GC tuning setup
- Lines 100-113: Lazy manager registry
- Lines 118-123: Response serializer
- Lines 128-159: Config initialization
- Lines 594-667: `getHeadlessOptions()` & `configureHeadlessMode()`
- Lines 680-733: `getTorOptions()` & `configureTorMode()`
- Lines 739-754: `getViewportConfig()` & viewport config
- Lines 2794-2857: `initializeHeadlessModeEarly()` & call site

---

### 2. `src/main/window-mgmt.js` (~700 lines)
**Responsibility:** Window creation, header management, manager initialization, window cleanup

**Exports:**
- `createWindow()` - create main BrowserWindow + all managers
- `setupDownloadManagerEvents()` - download event handlers
- `mainWindow` - reference (state variable)
- `[manager references]` - all manager references (sessionManager, tabManager, etc.)

**Imports:**
- From initialization.js: configuration, GC tuning, serializer
- Electron modules: BrowserWindow, session
- All manager classes from lines 39-75

**Line References:**
- Lines 756-1216: `createWindow()` (461 lines)
- Lines 2733-2787: `setupDownloadManagerEvents()`
- Lines 563-583: Manager variable declarations

**Key Components Included:**
- Window configuration (lines 763-787)
- Header manager setup (lines 795-822)
- Session, Tab, Cookie, Download managers init (lines 830-885)
- DevTools, Console, Profile, Storage managers init (lines 902-930)
- Recording, Replay, Window managers init (lines 958-989)
- Update manager init (lines 992-1029)
- WebSocket server init (lines 1031-1106)
- Memory manager setup (lines 1112-1113)
- Window close handler with 28 cleanup callbacks (lines 1115-1212)
- IPC handlers setup call (line 1215)

---

### 3. `src/main/websocket-integration.js` (~750 lines)
**Responsibility:** WebSocket server instantiation, IPC handlers for all domains

**Exports:**
- `setupIPCHandlers()` - registers all 140+ ipcMain handlers
- `wsServer` - WebSocket server reference (state variable)

**Imports:**
- From window-mgmt.js: createIPCPromiseWithTimeout helper, all managers
- Electron ipcMain module

**Line References:**
- Lines 1218-1250: `createIPCPromiseWithTimeout()` helper
- Lines 1252-2728: `setupIPCHandlers()` (1,477 lines → split across domains)
  - Lines 1252-1355: Navigation/Content handlers (screenshot, scroll, click, fill)
  - Lines 1357-1462: Cookie management (15 handlers)
  - Lines 1483-1526: Proxy & User Agent management (10 handlers)
  - Lines 1529-1596: Session management (9 handlers)
  - Lines 1598-1705: History management (11 handlers)
  - Lines 1707-1805: Download management (12 handlers)
  - Lines 1807-1953: Tab management (17 handlers)
  - Lines 1955-1987: Network throttling (7 handlers)
  - Lines 1989-2047: Geolocation management (9 handlers)
  - Lines 2049-2127: Content blocking (15 handlers)
  - Lines 2129-2219: Automation scripts (11 handlers)
  - Lines 2230-2331: Profile management (12 handlers)
  - Lines 2333-2437: DevTools management (11 handlers)
  - Lines 2439-2527: Console management (11 handlers)
  - Lines 2529-2660: Storage management (14 handlers)
  - Lines 2662-2727: Recovery management (7 handlers)

**Handler Count:** 162 ipcMain handlers (handle + on)

---

### 4. `src/main/lifecycle.js` (~650 lines)
**Responsibility:** Error recovery, Tor setup, event handlers, lifecycle hooks

**Exports:**
- `saveSessionState()` - save recovery state
- `loadSessionState()` - load recovery state
- `clearSessionState()` - clear recovery files
- `startAutoSave()` - begin periodic saves
- `stopAutoSave()` - stop auto-save
- `detectUncleanShutdown()` - check for crash
- `setupGlobalErrorHandlers()` - install error handlers
- `offerRecovery()` - recovery dialog
- `restoreSession()` - restore tabs from saved state
- Various state variables: `RECOVERY_CONFIG`, `autoSaveTimer`, `isCleanShutdown`, `isHeadlessMode`

**Imports:**
- fs, path modules
- Electron app, dialog modules
- From window-mgmt.js: managers

**Line References:**
- Lines 162-169: `RECOVERY_CONFIG` definition
- Lines 172-173: Recovery state variables
- Lines 182-234: Recovery path/lock file helpers
- Lines 239-329: Session state save/load
- Lines 362-425: Recovery dialog & restoration
- Lines 430-464: Global error handlers setup
- Lines 469-561: Memory manager setup
- Lines 2789-2853: Headless early init function (different phase)
- Lines 2859-2955: `app.whenReady()` handler (Tor setup, recovery check, window creation)
- Lines 2957-3056: App lifecycle events (window-all-closed, before-quit, activate, certificate-error, unhandled errors)

---

## Export/Import Matrix

### initialization.js Exports
```javascript
module.exports = {
  configureHeadlessMode,
  getHeadlessOptions,
  getTorOptions,
  configureTorMode,
  getViewportConfig,
  initializeHeadlessModeEarly,
  isTorMode,
  appConfig,           // From config init
  serializer,          // From response serializer
  lazyManagerRegistry, // From lazy init
  // (re-export of managers if needed)
};
```

### window-mgmt.js Exports
```javascript
module.exports = {
  createWindow,
  setupDownloadManagerEvents,
  mainWindow: () => mainWindow,  // getter
  // Managers (or just reference them)
  getManagers: () => ({
    sessionManager,
    tabManager,
    cookieManager,
    downloadManager,
    devToolsManager,
    consoleManager,
    // ... all 15 managers
  })
};
```

### websocket-integration.js Exports
```javascript
module.exports = {
  setupIPCHandlers,
  getWsServer: () => wsServer
};
```

### lifecycle.js Exports
```javascript
module.exports = {
  saveSessionState,
  loadSessionState,
  clearSessionState,
  startAutoSave,
  stopAutoSave,
  detectUncleanShutdown,
  setupGlobalErrorHandlers,
  offerRecovery,
  restoreSession,
  initializeRecoveryPaths,
  createLockFile,
  removeLockFile,
  // Export app event handlers as functions
  setupAppLifecycleHandlers
};
```

---

## Refactored main.js Structure

```javascript
// src/main/main.js (revised ~150 lines)
const path = require('path');
const { app, BrowserWindow } = require('electron');

// Initialize core systems
const {
  configureHeadlessMode,
  initializeHeadlessModeEarly,
  getTorOptions,
  configureTorMode,
  appConfig
} = require('./initialization');

const {
  createWindow,
  setupDownloadManagerEvents
} = require('./window-mgmt');

const { setupIPCHandlers } = require('./websocket-integration');

const {
  setupAppLifecycleHandlers,
  initializeRecoveryPaths,
  setupGlobalErrorHandlers,
  detectUncleanShutdown,
  loadSessionState,
  clearSessionState,
  offerRecovery,
  restoreSession,
  createLockFile,
  startAutoSave
} = require('./lifecycle');

// Configure Tor mode before app ready
const isTorMode = configureTorMode();

// Initialize headless early (P1-001 fix)
const earlyHeadlessInitialized = initializeHeadlessModeEarly();

// Main app ready handler
app.whenReady().then(async () => {
  // Configure remaining headless settings
  let isHeadlessMode = false;
  if (!earlyHeadlessInitialized) {
    isHeadlessMode = configureHeadlessMode();
  } else {
    isHeadlessMode = true;
  }

  // Initialize recovery system
  initializeRecoveryPaths();
  setupGlobalErrorHandlers();

  // Check for unclean shutdown and offer recovery
  const hadUncleanShutdown = detectUncleanShutdown();
  let savedState = null;
  if (hadUncleanShutdown) {
    savedState = loadSessionState();
  }

  // Create main window and initialize all managers
  await createWindow();

  // Offer recovery if needed
  if (hadUncleanShutdown && savedState && savedState.tabs.length > 0) {
    setTimeout(async () => {
      const shouldRestore = await offerRecovery(savedState);
      if (shouldRestore) {
        await restoreSession(savedState);
      }
      clearSessionState();
    }, 1000);
  }

  // Start recovery system
  createLockFile();
  startAutoSave();
});

// Setup app lifecycle handlers (window-all-closed, before-quit, activate, etc.)
setupAppLifecycleHandlers();

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (appConfig.network?.certificates?.ignoreCertificateErrors) {
    console.warn(`[Security] Bypassing certificate error for ${url}: ${error}`);
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  // Log and continue
});

process.on('uncaughtException', (error) => {
  // Log and exit
  process.exit(1);
});
```

---

## Migration Checklist

### Phase 1: Create new files
- [ ] Create initialization.js with all setup functions
- [ ] Create window-mgmt.js with createWindow() and managers
- [ ] Create websocket-integration.js with IPC handlers
- [ ] Create lifecycle.js with recovery and event handlers

### Phase 2: Update imports
- [ ] Update all internal imports between new files
- [ ] Ensure all manager references are properly passed
- [ ] Verify state variables (mainWindow, wsServer, etc.) are accessible

### Phase 3: Refactor main.js
- [ ] Remove old code from main.js
- [ ] Import all functions from 4 new modules
- [ ] Update app.whenReady() to use new imports
- [ ] Update event handlers to call new functions

### Phase 4: Testing
- [ ] Run unit tests for each module
- [ ] Test initialization sequence
- [ ] Test IPC handlers (sample of 10+ handlers)
- [ ] Test recovery mechanism
- [ ] Test window creation and cleanup
- [ ] Test error handling

### Phase 5: Documentation
- [ ] Update README with new architecture
- [ ] Document each module's public API
- [ ] Add examples of adding new IPC handlers
- [ ] Document manager initialization order

---

## Benefits of This Refactoring

1. **Readability:** Each file focuses on a single responsibility
2. **Maintainability:** Easier to locate and modify features
3. **Testability:** Smaller modules are easier to unit test
4. **Scalability:** Simpler to add new managers/handlers
5. **Performance:** Same runtime performance, cleaner code
6. **Documentation:** Each file becomes self-documenting

---

## Potential Challenges

1. **Circular Dependencies:** Need careful import ordering
   - Solution: Use getter functions for late-bound references

2. **State Management:** Managers stored in window-mgmt.js
   - Solution: Export getters/setters from window-mgmt.js

3. **IPC Handler Dependencies:** Handlers reference multiple managers
   - Solution: Import manager getter functions, call at handler invocation time

4. **Manager Initialization Order:** Some managers depend on others
   - Solution: Document order in window-mgmt.js with clear comments

---

## Implementation Notes

### Import Strategy for Managers
Since window-mgmt.js creates all managers, other modules need access:

```javascript
// window-mgmt.js
function getManagers() {
  return {
    sessionManager,
    tabManager,
    cookieManager,
    downloadManager,
    geolocationManager,
    networkThrottler,
    devToolsManager,
    consoleManager,
    profileManager,
    storageManager,
    scriptManager,
    historyManager,
    headerManager,
    memoryManager,
    blockingManager,
    technologyManager,
    extractionManager,
    networkAnalysisManager,
    sessionRecordingManager,
    replayEngine,
    headlessManager,
    windowManager,
    windowPool,
    updateManager
  };
}

module.exports = {
  createWindow,
  setupDownloadManagerEvents,
  getManagers,
  getMainWindow: () => mainWindow
};
```

```javascript
// websocket-integration.js
const { getManagers, getMainWindow } = require('./window-mgmt');

function setupIPCHandlers() {
  const managers = getManagers();
  
  ipcMain.handle('cookie-handler', async (event, data) => {
    // Use managers.cookieManager
  });
}
```

---

## File Organization Summary

```
src/main/
├── main.js                    (~150 lines) - Entry point, orchestration
├── initialization.js          (~450 lines) - Setup, config, headless/Tor
├── window-mgmt.js            (~700 lines) - Window + all managers
├── websocket-integration.js  (~750 lines) - IPC handlers (162 handlers)
└── lifecycle.js              (~650 lines) - Recovery, lifecycle events
```

**Total: ~2,700 lines of actual code + ~350 lines in main.js = ~3,050 lines**

(Slight reduction due to removed duplication and cleaner organization)

---

## Version History

- **v1.0** (2026-06-22) - Initial refactoring plan created
