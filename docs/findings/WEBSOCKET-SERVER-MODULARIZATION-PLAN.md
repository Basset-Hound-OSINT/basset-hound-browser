# WebSocket Server Modularization Plan

**Document:** Server Decomposition Strategy  
**Status:** Analysis Complete  
**File:** `/home/devel/basset-hound-browser/websocket/server.js`  
**Current Size:** 11,802 lines  
**Target:** 4 modules, each <3,000 lines  
**Date:** 2026-06-22

---

## Executive Summary

The monolithic `server.js` file will be split into 4 focused modules following dependency injection and single-responsibility patterns. This plan maintains 100% functionality while improving testability, maintainability, and code organization.

**Target Distribution:**
- `server-core.js` (~2,800 lines) - Server lifecycle, WebSocket setup, request routing
- `command-handlers.js` (~2,600 lines) - Command execution pipeline, handler registration
- `state-mgmt.js` (~2,200 lines) - State management, rollback, transactions
- `command-registry.js` (~1,400 lines) - Command definitions, routing, metadata

**Estimated Line Reductions:**
- Imports/setup overhead: ~300 lines
- Utility helpers: ~750 lines (shared)
- Final total: ~9,000 lines (24% reduction due to deduplication)

---

## Decomposition Analysis

### Current Code Structure

```
server.js (11,802 lines)
├── Imports & Dependencies (115 lines)
├── Error Recovery Config (145 lines)
├── Utility Functions (350 lines)
│   ├── isRetryableError, isRetryableCommand
│   ├── calculateRetryDelay, sleep
│   ├── isOnionUrl, isTorModeEnabled
│   ├── calculateAdaptiveTimeout
│   ├── ipcWithTimeout, generateRecoverySuggestion
│   └── checkOnionWithoutTor
├── StateSnapshot Class (112 lines)
├── StateRollbackManager Class (206 lines)
├── StatefulCommandHandler Class (110 lines)
├── WebSocketServer Class (10,850 lines)
│   ├── Constructor (1,150 lines)
│   ├── Lifecycle Methods (start, close) (1,200 lines)
│   ├── Connection Management (500 lines)
│   ├── Command Processing (2,000 lines)
│   ├── Rate Limiting (600 lines)
│   ├── Concurrency Control (200 lines)
│   ├── State Management Setup (100 lines)
│   ├── Command Handler Registration (~2,500 lines)
│   ├── Authentication (150 lines)
│   ├── Heartbeat Management (300 lines)
│   ├── SSL/TLS Configuration (300 lines)
│   ├── Error Handling & Recovery (1,000 lines)
│   ├── Response Formatting (300 lines)
│   └── Utility Methods (500 lines)
└── Module Export (1 line)
```

---

## Module 1: `server-core.js` (~2,800 lines)

**Purpose:** Server lifecycle, HTTP/WebSocket infrastructure, connection management  
**Primary Responsibility:** WebSocket server creation, SSL/TLS, connection pooling, heartbeat

### Contents

#### Imports & Constants
```javascript
// WebSocket and networking
const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { ipcMain } = require('electron');

// Managers and utilities (subset)
const { createLogger, ... } = require('../logging');
const { ErrorFormatter } = require('./error-formatter');
const { HttpResponseDecorator } = require('./http-response-decorator');
const { ConnectionLifecycleManager } = require('./connection-manager');
const { WebSocketRateLimiter } = require('./rate-limiter');
const { ConnectionPool } = require('./connection-pool');
const { ReliabilityManager } = require('./reliability-manager');
const { HealthEndpointManager } = require('./health-endpoint');
const { PrometheusMetricsCollector } = require('./metrics');

// Configuration constants
const IPC_DEFAULT_TIMEOUT = 30000;
const ADAPTIVE_TIMEOUT_CONFIG = { ... };
```

#### Classes

**1. AdaptiveTimeoutManager**
- Lines from: `calculateAdaptiveTimeout()` function
- Methods:
  - `calculateTimeout(commandName, estimatedSize)`
  - `registerLargeResponseCommand(name)`
  - `getConfig()`

**2. IpcBridge**
- Lines from: `ipcWithTimeout()` function
- Methods:
  - `sendWithTimeout(webContents, sendChannel, data, timeout)`
  - `addTimeoutHandler(timeout, onTimeout)`

**3. TorDetector**
- Lines from: `isOnionUrl()`, `isTorModeEnabled()`, `checkOnionWithoutTor()`
- Methods:
  - `isOnionUrl(url)`
  - `isTorModeEnabled()`
  - `validateTorUrl(url)`

**4. WebSocketServer (MODIFIED)**
- **Responsibilities:** Lifecycle, HTTP setup, SSL, connection handling
- **Size:** ~2,400 lines
- **Constructor Changes:** Accept dependencies, initialize managers
- **Methods to Keep:**
  - `start()`
  - `close()`
  - `_createCompositeHttpHandler()`
  - `_startNonSSLServer(port, compressionConfig)`
  - `_startWebSocketServer(port, compressionConfig)`
  - `_loadSslCertificates()`
  - `isSslEnabled()`
  - `getProtocol()`
  - `getConnectionUrl(hostname)`
  - `startHeartbeat()`
  - `stopHeartbeat()`
  - `_checkForZombieConnections()`
  - `setSessionManager(manager)`
  - `setTabManager(manager)`
  - `_setupStateRollbackListeners()`
  - `broadcast(message)`
  - `getStatus()`
  - Connection event handlers (on 'connection', 'message', 'close', 'error')

#### Dependencies
- Injected from caller: mainWindow, options
- Imports: state-mgmt, command-handlers, command-registry (circular ref safe)

---

## Module 2: `command-handlers.js` (~2,600 lines)

**Purpose:** Command execution pipeline, handler invocation, error recovery  
**Primary Responsibility:** Execute commands, manage retries, transform responses

### Contents

#### Imports & Constants
```javascript
const { calculateRetryDelay, sleep, isRetryableError, isRetryableCommand } = require('./server-core');
const { ErrorFormatter } = require('./error-formatter');
const { generateRecoverySuggestion } = require('./utilities');
const { StateRollbackManager } = require('./state-mgmt');
```

#### Classes

**1. CommandExecutor**
- **Methods:**
  - `async execute(command, params, options)`
  - `async executeWithRetry(data, maxRetries)`
  - `async executeWithoutRetry(data)`
  - `registerHandler(command, handler)`
  - `unregisterHandler(command)`
  - `hasHandler(command)`
  - `getHandlerMetadata(command)`

**2. RetryManager**
- Lines from: `executeWithRetry()` logic
- **Methods:**
  - `async executeWithRetry(fn, options)`
  - `isRetryable(command, error)`
  - `getRetryDelay(attemptNumber)`
  - `recordRetryAttempt(command, error)`

**3. ResponseTransformer**
- Lines from: `_sendResponse()`, response formatting
- **Methods:**
  - `formatSuccess(data, commandName, id)`
  - `formatError(error, commandName, id)`
  - `enrichWithMetadata(response, metadata)`
  - `applyTemplate(response, templateName)`

**4. CommandDispatcher (REFACTORED)**
- **Current:** Located at `./command-dispatcher.js`
- **Integration point** with handlers
- **Methods:**
  - `async execute(command, params, options)`
  - `registerHandlers(handlers)`

#### Handler Registration Functions
- `registerImageCommands()`
- `registerScreenshotCommands()`
- `registerNetworkForensicsCommands()`
- `registerMonitoringCommands()`
- `registerFormCommands()`
- ... (all 35+ registration functions)

#### Dependencies
- Imports from: server-core (retry utilities), state-mgmt (StateRollbackManager)
- Injected: commandHandlers map, commandRegistry, logger, profiler

---

## Module 3: `state-mgmt.js` (~2,200 lines)

**Purpose:** State snapshots, rollback operations, transactions  
**Primary Responsibility:** Track application state, enable rollback/replay

### Contents

#### Imports & Constants
```javascript
const { createLogger } = require('../logging');
```

#### Classes

**1. StateSnapshot** (EXISTING, lines 478-590)
- Purpose: Immutable state capture
- **Methods:**
  - `constructor(id, timestamp, stateData)`
  - `static captureProxy(proxyManager)`
  - `static captureStorage(storageManager, origin, storageType)`
  - `static captureNavigation(mainWindow, currentUrl)`
  - `static captureTorMode(proxyManager)`
  - `toString()`

**2. StateRollbackManager** (EXISTING, lines 596-802)
- Purpose: Manage snapshots, restore state
- **Methods:**
  - `constructor(maxSnapshots, snapshotTtlMs)`
  - `saveSnapshot(id, snapshot)`
  - `async restoreSnapshot(id, restoreFn)`
  - `discardSnapshot(id)`
  - `beginTransaction()`
  - `commitTransaction()`
  - `async rollbackTransaction()`
  - `registerRollbackListener(stateType, handler)`
  - `listSnapshots()`
  - `clearExpiredSnapshots()`
  - `getStats()`
  - `_pruneOldestSnapshot()`

**3. StatefulCommandHandler** (EXISTING, lines 808-918)
- Purpose: Wrapper for commands requiring rollback
- **Methods:**
  - `constructor(commandName, stateManager, logger)`
  - `async executeWithRollback(handlerFn, snapshot, validationFn, rollbackFn)`
  - `async executeInTransaction(handlerFn, snapshots)`

**4. StateValidator** (NEW)
- Purpose: Validate state before/after operations
- **Methods:**
  - `async validateProxyState(snapshot)`
  - `async validateStorageState(snapshot)`
  - `async validateNavigationState(snapshot)`
  - `addCustomValidator(stateType, validatorFn)`

**5. SnapshotRepository** (NEW)
- Purpose: Query and analyze snapshots
- **Methods:**
  - `findById(id)`
  - `findByType(stateType)`
  - `findByDateRange(start, end)`
  - `getChain(startId, endId)`
  - `export(format)`

#### Dependencies
- Standalone: Minimal external dependencies
- Used by: server-core, command-handlers

---

## Module 4: `command-registry.js` (~1,400 lines)

**Purpose:** Command definitions, routing metadata, discovery  
**Primary Responsibility:** Define available commands, their signatures, capabilities

### Contents

#### Imports
```javascript
// Utility for command metadata
const { createLogger } = require('../logging');
```

#### Classes

**1. CommandRegistry**
- Purpose: Central command definition and metadata
- **Methods:**
  - `register(commandName, metadata, handler)`
  - `unregister(commandName)`
  - `get(commandName)`
  - `getAll()`
  - `getByTag(tag)`
  - `getByCategory(category)`
  - `search(query)`
  - `validate(commandName, params)`

**2. CommandMetadata**
- Purpose: Define command signature and constraints
- **Properties:**
  - `name`: Command name
  - `description`: Human-readable description
  - `category`: Command category (navigation, extraction, evasion, etc.)
  - `tags`: Array of tags for grouping
  - `params`: Parameter schema (JSON Schema)
  - `returns`: Return value schema
  - `requiresAuth`: Boolean
  - `rateLimitTier`: 'low', 'medium', 'high'
  - `timeout`: Command execution timeout
  - `isIdempotent`: Can be safely retried
  - `priority`: Execution priority queue level
  - `version`: API version introduced
  - `deprecated`: Deprecation info
  - `examples`: Usage examples

**3. CommandGroupRegistry** (NEW)
- Purpose: Organize commands into logical groups
- **Methods:**
  - `createGroup(name, description)`
  - `addCommandToGroup(groupName, commandName)`
  - `listGroups()`
  - `getGroupCommands(groupName)`

**4. CommandDocGenerator** (NEW)
- Purpose: Auto-generate API documentation
- **Methods:**
  - `generateMarkdown(commandName)`
  - `generateJson(commandName)`
  - `generateOpenAPI()`
  - `generateCliReference()`

#### Command Definitions
```javascript
// Organized by category

// Navigation Commands
const NAVIGATION_COMMANDS = {
  navigate: { ... },
  go_back: { ... },
  go_forward: { ... },
  reload: { ... }
};

// Extraction Commands
const EXTRACTION_COMMANDS = {
  get_content: { ... },
  screenshot: { ... },
  screenshot_viewport: { ... },
  // ... more
};

// Evasion Commands
const EVASION_COMMANDS = {
  set_user_agent: { ... },
  set_proxy: { ... },
  enable_tor: { ... }
};

// ... more categories
```

#### Dependencies
- Imports: Minimal, mostly metadata definitions
- Used by: server-core, command-handlers, documentation generators

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────┐
│  External Dependencies (ws, electron, https, etc)   │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    ┌─────────┐ ┌─────────┐ ┌──────────────┐
    │state-   │ │command- │ │command-      │
    │mgmt.js  │ │handlers │ │registry.js   │
    └─────────┘ └────┬────┘ └──────────────┘
        │            │            │
        └────────────┼────────────┘
                     │
                     ▼
            ┌──────────────────┐
            │  server-core.js  │
            │ (WebSocket init, │
            │  connection mgmt)│
            └──────────────────┘
                     │
                     ▼
            ┌──────────────────┐
            │   main.js        │
            │  (Electron main) │
            └──────────────────┘
```

**Circular Dependencies:** Avoided through interface-based injection

---

## Migration Strategy

### Phase 1: Preparation
1. Create new module files with directory structure
2. Copy all imports and dependencies to each module
3. Establish export interfaces

### Phase 2: Extract State Management (`state-mgmt.js`)
- Move `StateSnapshot` class (lines 478-590)
- Move `StateRollbackManager` class (lines 596-802)
- Move `StatefulCommandHandler` class (lines 808-918)
- Add new: `StateValidator`, `SnapshotRepository`
- **Verification:** Run existing state management tests
- **File size check:** ~2,200 lines

### Phase 3: Extract Command Registry (`command-registry.js`)
- Create command definitions from current registration patterns
- Implement `CommandRegistry`, `CommandMetadata` classes
- Move command metadata from handlers to definitions
- **Verification:** Validate all command signatures
- **File size check:** ~1,400 lines

### Phase 4: Extract Command Handlers (`command-handlers.js`)
- Move all handler registration functions (lines 10,639-11,546)
- Create `CommandExecutor`, `RetryManager` classes
- Adapt to use `CommandRegistry` for metadata
- **Verification:** Run command execution tests
- **File size check:** ~2,600 lines

### Phase 5: Refactor Server Core (`server-core.js`)
- Move utility functions: timeout, IPC, Tor detection
- Create helper classes: `AdaptiveTimeoutManager`, `IpcBridge`, `TorDetector`
- Refactor `WebSocketServer` to use dependency injection
- Remove handler registration (moved to command-handlers)
- **Verification:** Connection and lifecycle tests pass
- **File size check:** ~2,800 lines

### Phase 6: Update Main Entry Point
- Update `server.js` (keep as facade or thin shim)
- Or update `main.js` to import 4 modules directly

### Phase 7: Testing & Verification
- Run full test suite
- Check for circular dependencies (via `node --inspect`)
- Performance benchmarking
- Load testing at scale

---

## File Layout Structure

```
websocket/
├── server.js                    (REFACTORED - thin shim or deleted)
├── server-core.js             (NEW, ~2,800 lines)
│   ├── AdaptiveTimeoutManager
│   ├── IpcBridge
│   ├── TorDetector
│   └── WebSocketServer (refactored)
├── command-handlers.js        (NEW, ~2,600 lines)
│   ├── CommandExecutor
│   ├── RetryManager
│   ├── ResponseTransformer
│   └── Handler registration functions
├── state-mgmt.js              (NEW, ~2,200 lines)
│   ├── StateSnapshot
│   ├── StateRollbackManager
│   ├── StatefulCommandHandler
│   ├── StateValidator
│   └── SnapshotRepository
├── command-registry.js        (NEW, ~1,400 lines)
│   ├── CommandRegistry
│   ├── CommandMetadata
│   ├── CommandGroupRegistry
│   ├── CommandDocGenerator
│   └── Command definitions (by category)
├── connection-pool.js         (EXISTING)
├── connection-manager.js      (EXISTING)
├── command-dispatcher.js      (EXISTING, minor refactoring)
├── rate-limiter.js            (EXISTING)
├── error-formatter.js         (EXISTING)
├── http-response-decorator.js (EXISTING)
├── reliability-manager.js     (EXISTING)
├── health-endpoint.js         (EXISTING)
├── metrics.js                 (EXISTING)
└── commands/
    ├── image-commands.js
    ├── screenshot-commands.js
    ├── ... (35+ command modules)
```

---

## Integration Points

### 1. Main Entry Point (`main.js`)
```javascript
// BEFORE
const WebSocketServer = require('./websocket/server');

// AFTER
const { WebSocketServer } = require('./websocket/server-core');
const { CommandHandlers } = require('./websocket/command-handlers');
const { StateManager } = require('./websocket/state-mgmt');
const { CommandRegistry } = require('./websocket/command-registry');

// Initialize with dependency injection
const registry = new CommandRegistry();
const stateManager = new StateManager();
const handlers = new CommandHandlers(registry, stateManager);
const server = new WebSocketServer(port, mainWindow, {
  commandHandlers: handlers,
  commandRegistry: registry,
  stateManager: stateManager
});
```

### 2. Test Entry Points
- Unit tests: Import individual modules
- Integration tests: Import all 4 + test harness
- E2E tests: Start from main.js

### 3. Documentation Generation
```javascript
const { CommandDocGenerator } = require('./websocket/command-registry');
const docGen = new CommandDocGenerator(registry);
docGen.generateMarkdown('output/API.md');
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Circular Dependencies** | Use dependency injection; no module directly imports from WebSocketServer. Each accepts dependencies as constructor params. |
| **Breaking Changes** | Keep `server.js` as thin facade initially; gradual migration. |
| **Performance Regression** | Benchmark before/after; module structure has negligible overhead. |
| **Testing Coverage** | Run full suite after Phase 3, 5, 6 to catch issues early. |
| **Documentation Drift** | Use `CommandRegistry` to auto-generate docs; keep in sync. |
| **Import Path Changes** | Create `websocket/index.js` to export all modules, maintain backward compatibility. |

---

## Success Criteria

✅ All 4 files <3,000 lines each  
✅ Zero loss of functionality  
✅ Zero circular dependencies  
✅ 100% test pass rate maintained  
✅ <5% performance overhead  
✅ Clear separation of concerns  
✅ Improved code discoverability  
✅ All 35+ command handlers properly registered  

---

## Implementation Checklist

- [ ] Create new module files
- [ ] Phase 1: Prepare imports
- [ ] Phase 2: Extract state-mgmt.js
- [ ] Phase 2: Test state management
- [ ] Phase 3: Extract command-registry.js
- [ ] Phase 3: Validate command signatures
- [ ] Phase 4: Extract command-handlers.js
- [ ] Phase 4: Test command execution
- [ ] Phase 5: Refactor server-core.js
- [ ] Phase 5: Test connections
- [ ] Phase 6: Update main.js
- [ ] Phase 6: Update imports in existing modules
- [ ] Phase 7: Full test suite
- [ ] Phase 7: Performance benchmarking
- [ ] Phase 7: Documentation review
- [ ] Cleanup: Remove old server.js or keep as facade
- [ ] Commit: Create PR with all changes

---

## Estimated Effort

| Phase | Effort | Duration |
|-------|--------|----------|
| Prep | 2 hours | Session 1 |
| State Mgmt | 1 hour | Session 1 |
| Command Registry | 2 hours | Session 2 |
| Command Handlers | 3 hours | Session 2-3 |
| Server Core | 3 hours | Session 3-4 |
| Integration | 2 hours | Session 4 |
| Testing | 3 hours | Session 4-5 |
| **TOTAL** | **16 hours** | **5 sessions** |

---

## Related Documentation

- `/docs/API-REFERENCE.md` - Command definitions (source for registry)
- `/docs/SCOPE.md` - Architectural boundaries
- `/docs/ROADMAP.md` - Feature roadmap (helps prioritize registry)

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-22  
**Author:** Claude Code  
**Status:** Ready for Implementation
