# WebSocket Server Refactoring: Strategic Split Plan

## Executive Summary

**File:** `websocket/server.js`  
**Current Size:** 11,802 lines  
**Target:** Split into 4 modules, each <3,000 lines  
**Status:** Ready for implementation  
**Risk Level:** Medium (large refactoring, substantial behavioral preservation required)

## Current Structure Analysis

### File Breakdown by Responsibility (Lines)

```
┌─────────────────────────────────────────────────────┐
│ websocket/server.js (11,802 lines)                  │
├─────────────────────────────────────────────────────┤
│ 1. Utility Functions & Classes (1-912)              │ ~912 lines
│    - Error recovery functions (isRetryableError)    │
│    - Sleep utilities                                │
│    - StateSnapshot class                            │
│    - StateRollbackManager class                     │
│    - StatefulCommandHandler class                   │
│                                                     │
│ 2. WebSocketServer Constructor & Init (913-2728)   │ ~1,816 lines
│    - Constructor & property initialization          │
│    - Manager injection & setup                      │
│    - Logger, metrics, rate limiter setup           │
│    - Lifecycle management initialization            │
│    - setupCommandHandlers() call (2729)             │
│                                                     │
│ 3. Command Handlers Registration (2729-11564)      │ ~8,836 lines
│    - 150+ command handler definitions              │
│    - Navigation, interaction, content extraction   │
│    - Session, cookie, history management           │
│    - Proxy, evasion, monitoring, forensics         │
│    - Advanced features (replay, recording, etc)    │
│    - Command handler aliases (10712-10740)         │
│                                                     │
│ 4. Core Server Methods (11565-11802)               │ ~238 lines
│    - setupUpdateProgressNotifications()            │
│    - handleCommand() - main dispatcher             │
│    - executeWithRetry/executeWithoutRetry()        │
│    - broadcast(), getStatus(), close()             │
│    - Other lifecycle methods                       │
│                                                     │
│ 5. Inherited Methods (not in setupCommandHandlers)  │ ~variable lines
│    - start(), _startWebSocketServer()              │
│    - _sendResponse(), heartbeat, rate limit logic  │
│    - Connection handlers                           │
│    - Event listeners setup                         │
└─────────────────────────────────────────────────────┘
```

### Dependencies Analysis

**Internal Files Imported:** 47 modules  
**External Libraries:** 6 (ws, https, fs, path, crypto, child_process)  
**Total Managers Injected:** 28 optional manager instances

**Key Manager Groups:**
- **Input Control:** keyboard, mouse, humanization
- **Content:** screenshot, recording, DOM inspector, extraction
- **Network:** proxy, headers, user agents, request interceptor
- **Sessions:** session, cookies, history, downloads
- **Advanced:** Tor, plugin, window pool, recording/replay
- **Monitoring:** metrics, Cloudflare detector, technology detection

## Strategic Split Design

### Proposed Architecture

```
websocket/
├── server.js (RETAINED - Core orchestrator, <900 lines)
├── server-core.js (Core WebSocket server, ~2,500-2,800 lines)
├── command-handlers.js (Command registration, ~2,800-2,900 lines)
├── state-mgmt.js (State & rollback utilities, ~1,200-1,400 lines)
└── command-registry.js (Command index & metadata, ~1,000-1,200 lines)

NEW: Modular handlers under websocket/handlers/
├── browser-commands.js (navigate, click, scroll, etc - ~1,000 lines)
├── content-commands.js (screenshot, get_content, etc - ~1,000 lines)
├── session-commands.js (session, cookies, history - ~1,000 lines)
├── advanced-commands.js (proxy, evasion, recording - ~1,200 lines)
└── forensics-commands.js (export, correlation, evidence - ~800 lines)
```

## Module Specifications

### 1. `server-core.js` (~2,500-2,800 lines)
**Purpose:** WebSocket server initialization and lifecycle management

**Responsibility:**
- HTTPS/SSL server setup
- WebSocket.Server instantiation
- Connection handlers (on connection, message, close, error)
- Heartbeat management
- Port availability checking
- HTTP request handling for non-WebSocket requests
- Response serialization and sending
- Metrics collection integration
- Health check endpoints

**Key Classes/Functions:**
- `initializeWebSocketServer(port, mainWindow, config)` - main setup
- `setupConnectionHandlers(wss)` - event listener registration
- `setupHttpHandler()` - HTTP request routing
- `startHeartbeat()`, `stopHeartbeat()`
- `_sendResponse()` - response formatting & compression
- `_checkForZombieConnections()`
- `getStatus()`, `close()`

**Imports Needed:**
```javascript
const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createLogger, defaultLogger } = require('../logging');
const { ErrorFormatter } = require('./error-formatter');
const { ConnectionPool } = require('./connection-pool');
const { WebSocketRateLimiter } = require('./rate-limiter');
const { PrometheusMetricsCollector } = require('./metrics');
const { HttpResponseDecorator } = require('./http-response-decorator');
const { DiagnosticsAPI } = require('./diagnostics-api');
const { HealthEndpointManager } = require('./health-endpoint');
```

**Constructor Properties to Manage:**
- `this.wss`, `this.httpsServer`
- `this.clients`, `this.authenticatedClients`
- `this.port`, `this.mainWindow`
- `this.heartbeatInterval`, `this.heartbeatLoop`
- `this.rateLimiter`, `this.metricsCollector`
- SSL/TLS configuration

---

### 2. `command-handlers.js` (~2,800-2,900 lines)
**Purpose:** Core command dispatcher and main handler registration loop

**Responsibility:**
- Primary `handleCommand()` implementation
- Command validation and routing
- Retry logic for idempotent commands
- Error recovery and suggestions
- Handler delegation to specific command modules
- Command metadata mapping
- Handler registry management

**Key Classes/Functions:**
- `setupCommandHandlers()` - main registration orchestrator
- `handleCommand(data, options)` - dispatcher
- `executeWithRetry(data, maxRetries)`
- `executeWithoutRetry(data)`
- Command handler registration pattern (this.commandHandlers.X = async ...)

**Architecture Pattern:**
```javascript
// Import handler modules
const browserHandlers = require('./handlers/browser-commands');
const contentHandlers = require('./handlers/content-commands');
const sessionHandlers = require('./handlers/session-commands');
const advancedHandlers = require('./handlers/advanced-commands');
const forensicsHandlers = require('./handlers/forensics-commands');

setupCommandHandlers() {
  // Register all handlers via delegation
  browserHandlers.register(this.commandHandlers, this);
  contentHandlers.register(this.commandHandlers, this);
  sessionHandlers.register(this.commandHandlers, this);
  advancedHandlers.register(this.commandHandlers, this);
  forensicsHandlers.register(this.commandHandlers, this);
  
  // Any shared/meta commands defined here
  this.commandHandlers.status = ...;
  this.commandHandlers.get_commands_list = ...;
}

async handleCommand(data, options = {}) {
  // Existing logic: validation, retry, recovery
}
```

**Constructor Properties:**
- `this.commandHandlers` (registry object)
- `this.commandDispatcher`
- Reference to all manager instances (passed from WebSocketServer)

---

### 3. `state-mgmt.js` (~1,200-1,400 lines)
**Purpose:** State management, snapshots, and transactional semantics

**Responsibility:**
- `StateSnapshot` class (capture/restore)
- `StateRollbackManager` class (transaction lifecycle)
- `StatefulCommandHandler` class (rollback-aware execution)
- State validation and recovery helpers
- Rollback listener registration
- Error recovery utilities
- Transaction coordination

**Key Classes/Functions:**
```javascript
class StateSnapshot {
  static captureNavigation(mainWindow, url) { ... }
  static captureSession(sessionData) { ... }
  // Other domain-specific snapshots
}

class StateRollbackManager {
  saveSnapshot(id, snapshot) { ... }
  restoreSnapshot(id, restoreFn) { ... }
  beginTransaction() { ... }
  commitTransaction() { ... }
  rollbackTransaction() { ... }
}

class StatefulCommandHandler {
  executeWithRollback(handlerFn, snapshot, validationFn, rollbackFn) { ... }
  executeInTransaction(handlerFn, snapshots = []) { ... }
}

// Error recovery functions
function isRetryableError(error) { ... }
function isRetryableCommand(command) { ... }
function calculateRetryDelay(attempt) { ... }
function generateRecoverySuggestion(command, error, managerName) { ... }
```

**Imports Needed:**
```javascript
const { createLogger } = require('../logging');
```

---

### 4. `command-registry.js` (~1,000-1,200 lines)
**Purpose:** Command metadata, routing, and discovery

**Responsibility:**
- Command metadata registry (name, category, parameters, description)
- Command grouping by category
- Parameter validation schemas
- Command aliases and mappings
- Handler lookup optimization
- Command discovery API
- Documentation generation helpers
- Rate limiting rule mapping

**Structure:**
```javascript
const COMMAND_REGISTRY = {
  // Navigation & Interaction (40 commands)
  navigate: {
    category: 'navigation',
    requiresAuth: true,
    retryable: true,
    params: ['url', 'timeout'],
    description: 'Navigate to URL'
  },
  click: {
    category: 'interaction',
    requiresAuth: true,
    retryable: true,
    params: ['selector', 'options'],
    description: 'Click element'
  },
  // ... more commands
};

const COMMAND_CATEGORIES = {
  navigation: ['navigate', 'go_back', 'go_forward', ...],
  interaction: ['click', 'fill', 'type', ...],
  content: ['screenshot', 'get_content', ...],
  // ... more categories
};

const COMMAND_ALIASES = {
  'add_monitor': 'add_competitor_monitor',
  'remove_monitor': 'remove_competitor_monitor',
  // ... 30+ aliases
};

class CommandRegistry {
  getCommand(name) { ... }
  getCategory(name) { ... }
  listByCategory(category) { ... }
  validateParameters(command, params) { ... }
  resolveAlias(command) { ... }
}
```

**Imports:**
```javascript
const { createLogger } = require('../logging');
```

---

## Implementation Strategy

### Phase 1: Create New Files (Zero-Risk)
1. Create `server-core.js` with WebSocket server code
2. Create `state-mgmt.js` with state classes
3. Create `command-registry.js` with metadata
4. Create base handler files (empty registration functions)

### Phase 2: Extract Core Logic (Low-Risk)
1. Copy non-handler methods to `server-core.js`
2. Move state classes to `state-mgmt.js`
3. Move utility functions to `state-mgmt.js`
4. Verify imports resolve correctly

### Phase 3: Move Command Handlers (Medium-Risk)
1. Extract handler groups into separate files:
   - `handlers/browser-commands.js` (navigate, click, fill, etc)
   - `handlers/content-commands.js` (screenshot, get_content, etc)
   - `handlers/session-commands.js` (session, cookies, history)
   - `handlers/advanced-commands.js` (proxy, evasion, recording, monitoring)
   - `handlers/forensics-commands.js` (export, evidence, correlation)

2. Each handler file exports a `register(commandHandlers, context)` function

3. Update `command-handlers.js` to call these registration functions

### Phase 4: Integration Testing (High-Risk)
1. Ensure WebSocketServer still works with new structure
2. Run full test suite
3. Verify all 150+ commands execute correctly
4. Check error handling and recovery paths

### Phase 5: Cleanup & Optimization (Low-Risk)
1. Remove dead code from original `server.js`
2. Update imports in `src/main/main.js`
3. Update any documentation references
4. Add cross-module integration tests

---

## Breaking Down setupCommandHandlers() (8,836 lines)

The `setupCommandHandlers()` method currently spans lines 2729-11564 and contains:

### Command Groups (Estimated Line Counts)

| Group | Commands | Est. Lines | Target File |
|-------|----------|-----------|-------------|
| Navigation & Interaction | navigate, click, fill, type, scroll, wait, hover | 400-500 | browser-commands.js |
| Content Extraction | screenshot, get_content, get_page_state, execute_script | 300-400 | content-commands.js |
| Cookies & Storage | get_cookies, set_cookie, delete_cookie, clear_all, export | 400-500 | session-commands.js |
| Session Management | create_session, switch_session, delete_session, list_sessions | 300-400 | session-commands.js |
| History Management | get_history, search_history, clear_history, export_history | 300-400 | session-commands.js |
| Downloads | start_download, pause, resume, cancel, get_download | 200-300 | session-commands.js |
| Proxy & Network | set_proxy, rotate_proxy, proxy chains, geo-lock, reputation | 600-700 | advanced-commands.js |
| Evasion & Fingerprinting | fingerprint, useragent, headers, blocking, headless mode | 600-700 | advanced-commands.js |
| Recording & Replay | start_recording, replay, session recording, state checkpoints | 400-500 | advanced-commands.js |
| Plugin System | load_plugin, trigger_hook, get_plugin_hooks | 200-300 | advanced-commands.js |
| Monitoring | competitor monitoring, alerts, analytics, monitoring service | 800-900 | advanced-commands.js |
| Forensics & Export | HTML capture, DOM snapshot, export formats, correlation | 800-1,000 | forensics-commands.js |
| Advanced Features | update management, window pool, Tor, detection | 600-700 | advanced-commands.js |
| Meta/Admin | authenticate, rate limit, status, internal commands | 200-300 | command-handlers.js |

### Handler Complexity Gradient

**Low Complexity (Simple delegation):**
- Cookie commands: Just IPC calls to managers
- History commands: Straightforward manager calls
- Basic get/set operations

**Medium Complexity (State tracking):**
- Session management: Track active sessions
- Download commands: Monitor progress
- Proxy rotation: Manage state

**High Complexity (Multi-step with error recovery):**
- Navigation: URL validation, Tor mode auto-switching, state snapshots, rollback
- Recording/Replay: Temporal state, event replay, error recovery
- Monitoring: Background tasks, change detection, alerting
- Forensics: Complex extraction, correlation, export formats

---

## Module Size Predictions

With proper distribution:

```
server-core.js: 2,400-2,800 lines
- Server setup & lifecycle: 800-1,000 lines
- Connection handling: 400-500 lines
- HTTP handlers: 300-400 lines
- Heartbeat & zombie detection: 200-300 lines
- Response formatting & metrics: 300-400 lines
- Imports & class definitions: 300-400 lines

command-handlers.js: 2,600-2,900 lines
- Main handleCommand() method: 100-150 lines
- Handler registration orchestration: 150-200 lines
- setupCommandHandlers() wrapper: 100-150 lines
- executeWithRetry/executeWithoutRetry: 50-100 lines
- Command aliases registration: 200-300 lines (30+ aliases)
- Meta-commands (status, auth): 300-400 lines
- Registered command handler stubs: 1,500-2,000 lines
  (calls to external modules via register(this, context))

state-mgmt.js: 1,100-1,400 lines
- StateSnapshot class: 200-300 lines
- StateRollbackManager class: 400-500 lines
- StatefulCommandHandler class: 300-400 lines
- Utility functions: 200-300 lines

command-registry.js: 1,000-1,200 lines
- Command metadata definitions: 600-800 lines
- Category groupings: 100-150 lines
- Alias mappings: 150-200 lines
- CommandRegistry class: 150-250 lines

handlers/browser-commands.js: 800-1,000 lines
handlers/content-commands.js: 700-900 lines
handlers/session-commands.js: 1,000-1,200 lines
handlers/advanced-commands.js: 1,200-1,400 lines
handlers/forensics-commands.js: 900-1,100 lines

TOTAL: ~11,800 lines (same as current)
```

---

## Risk Assessment

### High-Risk Areas
1. **Command handler dependencies:** Some handlers reference other handlers or shared state
   - **Mitigation:** Careful dependency analysis before split
   - **Testing:** Integration tests for cross-handler calls

2. **Manager injection timing:** Many handlers expect managers to be fully initialized
   - **Mitigation:** Pass context/server reference to all handlers
   - **Testing:** Verify manager availability in each handler

3. **Side effects in handler registration:** Some handlers may have side effects during setup
   - **Mitigation:** Separate registration from side-effect initialization
   - **Testing:** Unit tests for each handler's registration function

### Medium-Risk Areas
1. **IPC communication with main process:** Many handlers use ipcWithTimeout
   - **Mitigation:** Centralize IPC utility imports
   - **Testing:** Mock IPC in handler tests

2. **Error recovery coordination:** State rollback requires careful orchestration
   - **Mitigation:** Keep state-mgmt.js tightly coupled with handlers
   - **Testing:** Rollback scenario testing for each domain

### Low-Risk Areas
1. **Simple delegation handlers:** Most handlers are straightforward manager calls
2. **Metadata extraction:** Command registry is purely declarative
3. **Utility functions:** Well-isolated, minimal dependencies

---

## Testing Strategy

### Pre-Split Baseline
- [ ] Run full test suite, document all passing tests
- [ ] Run WebSocket stress test (concurrent commands)
- [ ] Document performance baseline

### Post-Split Validation
- [ ] All baseline tests still pass
- [ ] Module-level unit tests for new files
- [ ] Integration tests between modules
- [ ] Performance regression testing
- [ ] Memory profiling (ensure no leaks from splits)

### Critical Path Tests
- [ ] Navigation with Tor auto-mode
- [ ] Screenshot with compression
- [ ] Session management with rollback
- [ ] Monitoring with background jobs
- [ ] Forensics export with complex formats
- [ ] Error recovery with retry logic

---

## Migration Path

### Option A: Big Bang (Higher Risk)
1. Create all 4 new files at once
2. Extract all code
3. Update imports in main.js
4. Single comprehensive test run

**Pros:** Faster, cleaner git history  
**Cons:** Harder to debug if something breaks

### Option B: Incremental (Recommended)
1. Create state-mgmt.js, verify integration
2. Create server-core.js, migrate server setup
3. Create command-registry.js, migrate metadata
4. Create handlers/, migrate commands by group
5. Final cleanup of command-handlers.js

**Pros:** Easier to isolate issues, incremental validation  
**Cons:** More commits, longer development time

### Option C: Dual-Mode (Safest)
1. Create new files alongside existing code
2. Keep old server.js fully functional
3. Add feature flag to toggle between implementations
4. Run both in parallel during testing
5. Cutover when confidence is high

**Pros:** Zero-risk rollback, comprehensive comparison testing  
**Cons:** Maintenance burden of dual implementations

---

## Code Examples

### How Handlers Will Be Registered

**Before (current):**
```javascript
setupCommandHandlers() {
  this.commandHandlers.navigate = async (params) => {
    // 100+ lines of navigate logic
  };
  this.commandHandlers.click = async (params) => {
    // 50+ lines of click logic
  };
  // ... 150+ more handlers inline
}
```

**After (refactored):**
```javascript
// command-handlers.js
setupCommandHandlers() {
  const browserHandlers = require('./handlers/browser-commands');
  const contentHandlers = require('./handlers/content-commands');
  // ... other imports
  
  // Pass this.commandHandlers registry and context
  browserHandlers.register(this.commandHandlers, this);
  contentHandlers.register(this.commandHandlers, this);
  // ... other registrations
}

// handlers/browser-commands.js
module.exports.register = (handlers, context) => {
  handlers.navigate = async (params) => {
    // navigate logic
  };
  handlers.click = async (params) => {
    // click logic
  };
  handlers.fill = async (params) => {
    // fill logic
  };
  // ... more browser commands
};
```

### State Management Usage

```javascript
// Before: embedded in handler
this.commandHandlers.navigate = async (params) => {
  const snapshot = StateSnapshot.captureNavigation(this.mainWindow, url);
  this.stateManager.saveSnapshot(snapshot.id, snapshot);
  const handler = new StatefulCommandHandler('navigate', this.stateManager, this.logger);
  return await handler.executeWithRollback(
    async () => { /* navigation logic */ },
    snapshot
  );
};

// After: same code, but in separate handler file with proper imports
// handlers/browser-commands.js
const { StateSnapshot, StatefulCommandHandler } = require('../state-mgmt');

module.exports.register = (handlers, context) => {
  handlers.navigate = async (params) => {
    const snapshot = StateSnapshot.captureNavigation(context.mainWindow, url);
    context.stateManager.saveSnapshot(snapshot.id, snapshot);
    const handler = new StatefulCommandHandler('navigate', context.stateManager, context.logger);
    return await handler.executeWithRollback(/* ... */);
  };
};
```

---

## Success Criteria

✅ **Code Organization:**
- [ ] Each file is < 3,000 lines
- [ ] No file has more than 3-5 levels of nesting
- [ ] Clear separation of concerns

✅ **Functionality Preservation:**
- [ ] All 150+ commands work identically
- [ ] Error recovery behaves identically
- [ ] No breaking changes to API

✅ **Performance:**
- [ ] < 5% latency change on command execution
- [ ] No memory leaks introduced
- [ ] Startup time within 10% of original

✅ **Maintainability:**
- [ ] New commands can be added to handlers/ without touching core
- [ ] State logic is centralized and easy to understand
- [ ] Module imports are clean and explicit

✅ **Testing:**
- [ ] 100% of baseline tests pass
- [ ] New module-level tests added
- [ ] Integration tests cover critical paths

---

## Next Steps

1. **Immediate:** Review this plan with team, identify risks to discuss
2. **Week 1:** Create base files with proper import structure
3. **Week 2:** Migrate state management and core server logic
4. **Week 3:** Migrate command handlers by group, test incrementally
5. **Week 4:** Integration testing, performance validation, cleanup

---

## References

- Current file: `/home/devel/basset-hound-browser/websocket/server.js`
- Constructor: Lines 920-1167
- Handler setup: Lines 2729-11564 (8,836 lines)
- Core methods: Lines 11565-11802 (238 lines)
- Utility functions: Lines 1-912 (912 lines)
- Manager references: 28 optional instances, all accessible from context
