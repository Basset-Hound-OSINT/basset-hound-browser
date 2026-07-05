# Main.js Refactoring - Implementation Notes

**Date**: 2026-06-22  
**Status**: Ready for Implementation  
**Complexity**: Medium (careful module export/import management required)

---

## Quick Reference

- **Original file**: `/src/main/main.js` (3,056 lines)
- **Target split**: 4 files, each <800 lines
- **Plan document**: `main-js-refactor-plan.md`
- **Line mapping**: `main-js-line-mapping.txt`

---

## Module Structure

```
src/main/
├── initialization.js    (~680 lines) - Config, recovery, GC
├── window-mgmt.js       (~720 lines) - Window + 18 managers
├── websocket-integration.js (~580 lines) - WSServer setup
├── lifecycle.js         (~630 lines) - 150+ IPC handlers + app events
└── main.js              (~50 lines) - NEW orchestrator (thin wrapper)
```

---

## Critical Implementation Checklist

### Before Starting
- [ ] Backup original main.js: `cp src/main/main.js src/main/main.js.backup`
- [ ] Create feature branch: `git checkout -b feat/refactor-main-js`
- [ ] Ensure current tests pass

### Phase 1: initialization.js
- [ ] Create file with module resolution setup (lines 1-29)
- [ ] Add Electron imports + validation
- [ ] Add all manager imports (lines 38-75)
- [ ] Add GC tuning (lines 78-95)
- [ ] Add lazy manager registry
- [ ] Add configuration system
- [ ] Add recovery configuration + functions (lines 160-355)
- [ ] Add setupGlobalErrorHandlers()
- [ ] Add setupMemoryManager()
- [ ] Add manager variable declarations
- [ ] Add headless mode functions
- [ ] Add Tor mode functions
- [ ] Add viewport configuration
- [ ] Test: `node -c src/main/initialization.js` (syntax check)

### Phase 2: window-mgmt.js
- [ ] Create file with require('./initialization')
- [ ] Add window creation (lines 756-827)
- [ ] Add manager initializations (18 managers, lines 829-989)
- [ ] Add WebSocket server setup (lines 1031-1100)
- [ ] Add window closed handler + cleanup (lines 1115-1212)
- [ ] Add IPC helper function
- [ ] Export: createWindow, mainWindow, wsServer, managers
- [ ] Test: `node -c src/main/window-mgmt.js` (syntax check)

### Phase 3: websocket-integration.js (Optional - could be merged into window-mgmt.js)
- [ ] Create file OR merge into window-mgmt.js
- [ ] If separate: isolate SSL cert generation + server creation
- [ ] Test: Verify server initializes correctly

### Phase 4: lifecycle.js
- [ ] Create file with require('./initialization')
- [ ] Add setupIPCHandlers() with 150+ handlers
  - Navigation (lines 1253-1270)
  - Screenshots (lines 1281-1309)
  - Cookies (lines 1357-1470)
  - Proxy (lines 1483-1494)
  - User Agent (lines 1501-1526)
  - Sessions (lines 1528-1595)
  - History (lines 1598-1704)
  - Downloads (lines 1706-1804)
  - Tabs (lines 1806-1946)
  - Network Throttling (lines 1955-1987)
  - Geolocation (lines 1989-2047)
  - Content Blocking (lines 2049-2126)
  - Automation Scripts (lines 2128-2227)
  - Profiles (lines 2228-2330)
  - DevTools (lines 2332-2437)
  - Console (lines 2439-2527)
  - Storage (lines 2529-2659)
  - Recovery (lines 2661-2727)
- [ ] Add setupDownloadManagerEvents()
- [ ] Add initializeHeadlessModeEarly()
- [ ] Add app.whenReady() callback
- [ ] Add app lifecycle events (window-all-closed, before-quit, activate, certificate-error)
- [ ] Add global error handlers
- [ ] Test: `node -c src/main/lifecycle.js` (syntax check)

### Phase 5: New main.js Orchestrator
- [ ] Rename original: `mv src/main/main.js src/main/main.js.original`
- [ ] Create new thin main.js that:
  - Requires each module in order
  - Calls initialization
  - Sets up app.whenReady() → createWindow() → setupLifecycle()
  - Registers global error handlers
- [ ] Keep it <50 lines

### Phase 6: Testing & Verification
- [ ] Syntax check all files: `node -c src/main/{initialization,window-mgmt,lifecycle}.js`
- [ ] Test startup: `npm start`
- [ ] Test WebSocket connectivity: `npm test -- websocket`
- [ ] Test all 150+ IPC handlers: `npm test -- ipc`
- [ ] Test recovery system: Simulate crash, restart
- [ ] Test headless mode: `npm start -- --headless`
- [ ] Test Tor mode: `npm start -- --tor-mode`
- [ ] Performance test: Compare before/after startup time
- [ ] Memory test: Check for leaks over 10 minute run
- [ ] Coverage test: Ensure all code paths still covered

---

## Export/Import Strategy

### initialization.js exports:
```javascript
module.exports = {
  // Config & managers
  appConfig,
  headlessManager,
  memoryManager,
  RECOVERY_CONFIG,
  viewportConfig,
  
  // Recovery functions
  initializeRecoveryPaths,
  detectUncleanShutdown,
  saveSessionState,
  loadSessionState,
  clearSessionState,
  startAutoSave,
  stopAutoSave,
  offerRecovery,
  restoreSession,
  
  // Setup functions
  setupGlobalErrorHandlers,
  setupMemoryManager,
  getHeadlessOptions,
  configureHeadlessMode,
  getTorOptions,
  configureTorMode,
  getViewportConfig,
  initializeHeadlessModeEarly,
  
  // Manager variable refs (will be populated by window-mgmt)
  mainWindow: null,
  wsServer: null,
  sessionManager: null,
  tabManager: null,
  cookieManager: null,
  downloadManager: null,
  storageManager: null,
  devToolsManager: null,
  consoleManager: null,
  historyManager: null,
  profileManager: null,
  headerManager: null,
  scriptManager: null,
  technologyManager: null,
  extractionManager: null,
  networkAnalysisManager: null,
  sessionRecordingManager: null,
  replayEngine: null,
  windowManager: null,
  windowPool: null,
  updateManager: null
};
```

### window-mgmt.js imports & exports:
```javascript
const {
  appConfig,
  headlessManager,
  setupMemoryManager,
  initializeHeadlessModeEarly,
  viewportConfig
} = require('./initialization');

async function createWindow() {
  // ... window creation ...
  // Managers created here and stored
  return {
    mainWindow,
    wsServer,
    managers: {
      sessionManager,
      tabManager,
      cookieManager,
      // ... rest of managers
    }
  };
}

module.exports = {
  createWindow,
  mainWindow: null, // Set after createWindow()
  wsServer: null,
  managers: {}
};
```

### lifecycle.js imports & exports:
```javascript
const {
  appConfig,
  RECOVERY_CONFIG,
  startAutoSave,
  stopAutoSave,
  saveSessionState,
  loadSessionState,
  clearSessionState,
  // ... etc
} = require('./initialization');

function setupIPCHandlers() {
  // 150+ handlers that reference managers from context
}

function setupDownloadManagerEvents() { /* ... */ }

function initializeHeadlessModeEarly() { /* ... */ }

// App lifecycle
app.whenReady().then(async () => { /* ... */ });
app.on('window-all-closed', () => { /* ... */ });
// ... etc

module.exports = {
  setupIPCHandlers,
  setupDownloadManagerEvents,
  initializeHeadlessModeEarly
};
```

---

## Known Issues & Solutions

### Issue 1: Manager References in IPC Handlers
**Problem**: IPC handlers in lifecycle.js need access to managers created in window-mgmt.js

**Solution**: Pass managers object through closure or context
```javascript
// In main.js
const window = await require('./window-mgmt').createWindow();
const lifecycle = require('./lifecycle');
lifecycle.setupWithManagers(window.managers);

// In lifecycle.js
let managers = {};
function setupWithManagers(m) {
  managers = m;
}

// Then in handlers:
ipcMain.handle('some-handler', async (event, data) => {
  return managers.sessionManager.doSomething();
});
```

### Issue 2: Global Variables
**Problem**: Some globals like `mainWindow` used across files

**Solution**: Export as shared reference module or pass context
```javascript
// globals.js (optional, lightweight)
module.exports = {
  mainWindow: null,
  wsServer: null,
  managers: {}
};

// Then in any file:
const globals = require('./globals');
```

### Issue 3: Circular Dependencies
**Problem**: Could arise if lifecycle needs to access window-mgmt which imports initialization

**Solution**: Explicit initialization order in main.js
```javascript
// main.js
const init = require('./initialization');  // First
const windowMgmt = require('./window-mgmt');  // Second
const lifecycle = require('./lifecycle');  // Third

// Explicit call order
app.whenReady().then(async () => {
  const window = await windowMgmt.createWindow();
  lifecycle.setupWithContext(window);
});
```

### Issue 4: Manager Cleanup on Window Close
**Problem**: Cleanup handlers reference managers, but they're defined in window-mgmt

**Solution**: Keep cleanup logic in window-mgmt.js where managers are defined
```javascript
// window-mgmt.js
mainWindow.on('closed', () => {
  // All cleanup here, near where managers created
  sessionManager && sessionManager.cleanup();
  // ... 20+ more cleanups
});
```

---

## Testing Strategy

### Unit Tests
```bash
# Test each module loads without errors
node -c src/main/initialization.js
node -c src/main/window-mgmt.js
node -c src/main/lifecycle.js

# Test module exports exist
node -e "const init = require('./src/main/initialization'); console.log(Object.keys(init));"
```

### Integration Tests
```bash
# Full startup test
npm start

# WebSocket test
npm test -- --grep "WebSocket"

# IPC handler test
npm test -- --grep "IPC.*handlers"

# Recovery system test
npm test -- --grep "recovery"
```

### Regression Tests
```bash
# Run full test suite
npm test

# Compare performance
time npm start -- --help
```

### Manual Tests
1. Launch app: `npm start`
2. Open DevTools (F12)
3. Create tab → switch tabs → close tabs
4. Navigate to URL
5. Check WebSocket connected
6. Stop app cleanly (should see clean shutdown)
7. Restart app (should not see recovery dialog)
8. Test in headless: `npm start -- --headless`
9. Test Tor: `npm start -- --tor-mode`

---

## Performance Checklist

- [ ] Measure startup time before refactor
- [ ] Measure startup time after refactor
- [ ] Check for memory leaks (run for 10 min)
- [ ] Verify no 404s in DevTools
- [ ] Check CPU usage under load
- [ ] Verify WebSocket throughput unchanged
- [ ] Test with concurrent connections

---

## Common Pitfalls to Avoid

1. **Don't split manager initializations** - Keep all 18+ manager inits in one section
2. **Don't split IPC handlers by type across files** - Keep all in lifecycle.js
3. **Don't move recovery functions** - Keep together in initialization.js
4. **Don't rename variables unnecessarily** - Keeps diff cleaner
5. **Don't remove any error handlers** - All must be preserved
6. **Don't change IPC channel names** - They're part of the public API
7. **Don't optimize imports yet** - First get working, then optimize
8. **Don't skip TypeScript definitions** - Add .d.ts files for type safety

---

## Rollback Plan

If issues arise:
```bash
# Quick rollback
cp src/main/main.js.backup src/main/main.js
rm src/main/{initialization,window-mgmt,lifecycle,websocket-integration}.js

# Or revert commits
git reset --hard HEAD~1
```

---

## Code Review Checklist

- [ ] No lines lost (3,056 should be preserved)
- [ ] No duplicate code
- [ ] All imports resolve
- [ ] No circular dependencies
- [ ] All exports used
- [ ] Comments preserved
- [ ] File sizes: each <800 lines
- [ ] Tests pass 100%
- [ ] No console errors on startup
- [ ] All 150+ IPC handlers present
- [ ] All managers initialized
- [ ] WebSocket server running
- [ ] Recovery system functional

---

## Next Steps After Refactoring

1. **Documentation** - Update README with new module structure
2. **Type Safety** - Add TypeScript definitions
3. **Further Refactoring** - Extract IPC handlers by manager type
4. **Lazy Loading** - Load window-mgmt only when needed
5. **Testing** - Increase IPC handler test coverage
6. **Monitoring** - Add performance metrics to startup sequence

---

## Related Files

- Original: `/src/main/main.js` (to be split)
- Main entry: `package.json` - "main" field may need update
- Tests: `test/` - Verify all tests still pass
- Config: `src/config/` - Ensure config loading works
- Managers: `src/*/manager.js` - All managers imported

---

## References

- Refactoring Plan: `/docs/wiki/findings/main-js-refactor-plan.md`
- Line Mapping: `/docs/wiki/findings/main-js-line-mapping.txt`
- Original File: `/src/main/main.js`

---

**Document Created**: 2026-06-22  
**Last Updated**: 2026-06-22  
**Status**: Ready for Implementation
