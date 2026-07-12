# WebSocket Server - Detailed Line Distribution

**Analysis Date:** 2026-06-22  
**File:** `/home/devel/basset-hound-browser/websocket/server.js`  
**Total Lines:** 11,802

---

## Line-by-Line Breakdown

### Section 1: Module Imports & Dependencies (Lines 1-115)
**Lines:** 115  
**Destination:** Distributed to all 4 modules  

```
1-8       WebSocket, HTTPS, fs, path, crypto, execSync, ipcMain, humanize
9-16      Managers: ScreenshotManager, RecordingManager, keyboard, mouse
17-35     Managers: proxyManager, userAgentManager, requestInterceptor, etc.
36-56     Logging: createLogger, defaultLogger, defaultProfiler, etc.
57-67     Performance: getSerializer, LazyManagerRegistry, GC tuning
68-77     Additional: CloudflareDetector, PathValidator, ErrorFormatter, etc.
78-100    Feature Command Modules (35+ require statements)
101-115   Batch, Forensic, Legal, Evidence, Session commands
```

**Distribution:**
- server-core.js: WebSocket, HTTPS, fs, path, crypto, logging
- command-handlers.js: Command modules, managers (screenshot, recording, etc.)
- state-mgmt.js: (standalone, minimal imports)
- command-registry.js: (metadata only, no manager dependencies)

---

### Section 2: Error Recovery Configuration (Lines 116-174)
**Lines:** 59  
**Destination:** command-handlers.js (retryable logic)

```
116-144   ERROR_RECOVERY_CONFIG constant (55 lines)
145-156   isRetryableError() function (12 lines)
157-165   isRetryableCommand() function (9 lines)
166-174   calculateRetryDelay() function (9 lines)
```

**New Home:** `command-handlers.js` as `RetryManager.getConfig()` and `getRetryDelay()`

---

### Section 3: Utility Functions (Lines 175-402)
**Lines:** 228  
**Destination:** Distributed / New Helpers

```
175-183   sleep() function (9 lines)
184-232   Onion detection: isOnionUrl(), isTorModeEnabled(), checkOnionWithoutTor() (49 lines)
233-237   IPC_DEFAULT_TIMEOUT constant (5 lines)
238-261   ADAPTIVE_TIMEOUT_CONFIG constant (24 lines)
262-297   calculateAdaptiveTimeout() function (36 lines)
298-402   ipcWithTimeout() function (105 lines)
```

**Distribution:**
- sleep(): Remain in server-core.js
- Tor detection (isOnionUrl, isTorModeEnabled, checkOnionWithoutTor): → **TorDetector class** in server-core.js
- calculateAdaptiveTimeout(): → **AdaptiveTimeoutManager class** in server-core.js
- ipcWithTimeout(): → **IpcBridge class** in server-core.js
- Constants: Moved to respective module configs

---

### Section 4: Recovery Suggestion Helper (Lines 401-477)
**Lines:** 77  
**Destination:** command-handlers.js

```
401-477   generateRecoverySuggestion() function (77 lines)
```

**New Home:** `ResponseTransformer.enrichWithRecovery()` or utility function in command-handlers.js

---

### Section 5: State Management Classes (Lines 478-918)
**Lines:** 441  
**Destination:** state-mgmt.js (MOVE INTACT)

```
478-590   StateSnapshot class (112 lines)
          - constructor(id, timestamp, stateData)
          - static captureProxy()
          - static captureStorage()
          - static captureNavigation()
          - static captureTorMode()
          - toString()

596-802   StateRollbackManager class (206 lines)
          - constructor(maxSnapshots, snapshotTtlMs)
          - saveSnapshot(id, snapshot)
          - restoreSnapshot(id, restoreFn)
          - discardSnapshot(id)
          - beginTransaction()
          - commitTransaction()
          - rollbackTransaction()
          - registerRollbackListener(stateType, handler)
          - listSnapshots()
          - clearExpiredSnapshots()
          - getStats()
          - _pruneOldestSnapshot()

808-918   StatefulCommandHandler class (110 lines)
          - constructor(commandName, stateManager, logger)
          - executeWithRollback(handlerFn, snapshot, validationFn, rollbackFn)
          - executeInTransaction(handlerFn, snapshots)
```

---

### Section 6: WebSocketServer Class - Constructor (Lines 920-1185)
**Lines:** 266  
**Destination:** server-core.js (refactored)

```
920-927   Constructor signature & initialization
928-937   SSL/TLS configuration setup
938-941   Authentication configuration
943-970   Heartbeat and rate limiting setup
971-974   HTTP Response decorator
976-979   Per-client concurrency limits
981-988   Screenshot/recording managers
989-1004  Manager injection points (session, tab, network, etc.)
1005-1044 Extended managers (technology, extraction, network analysis, etc.)
1045-1062 Memory, state, connection, lifecycle managers
1063-1068 Logging system initialization
1069-1185 Additional manager initialization (continued)
```

**Changes in server-core.js:**
- Dependency injection for all managers (already well-structured)
- Keep all initialization as-is
- Add method stubs for external managers

---

### Section 7: WebSocketServer Methods - Lifecycle (Lines 1186-1344)
**Lines:** 159  
**Destination:** server-core.js

```
1170-1178 setSessionManager() (9 lines)
1179-1187 setTabManager() (9 lines)
1188-1287 _setupStateRollbackListeners() (100 lines)
1288-1293 start() method signature (6 lines)
1294-1343 start() implementation (50 lines)
1344     start() closing brace
```

---

### Section 8: WebSocketServer Methods - HTTP/WebSocket Setup (Lines 1344-1927)
**Lines:** 584  
**Destination:** server-core.js

```
1344-1413 _createCompositeHttpHandler() (70 lines)
1414-1462 _startNonSSLServer() (49 lines)
1463-1927 _startWebSocketServer() (465 lines)
          - HTTP upgrade handling
          - SSL/TLS setup
          - Connection event setup
          - Compression configuration
          - CORS setup
```

---

### Section 9: WebSocketServer Methods - Message Handling (Lines 1528-1773)
**Lines:** 246  
**Destination:** Distributed (core + handlers)

```
1528-1618 HTTP request handler setup (91 lines)
1619-1773 WebSocket message handler (155 lines)
          - JSON parsing
          - Command authentication
          - Rate limit checking
          - Command execution (via dispatcher)
          - Error handling & recovery
          - Response formatting
```

**Distribution:**
- Connection lifecycle: server-core.js (onopen, onclose, onerror)
- Message routing & execution: command-handlers.js (with CommandExecutor)
- Error handling: Both modules

---

### Section 10: WebSocketServer Methods - Response Handling (Lines 1774-2038)
**Lines:** 265  
**Destination:** command-handlers.js

```
1928-1976 _sendResponse() (49 lines)
1977-2012 _standardizeErrorResponse() (36 lines)
2013-2038 _getRecoveryHint() (26 lines)
2039-2121 _loadSslCertificates() (83 lines)
```

**Refactored in command-handlers.js:**
- `_sendResponse()` → `ResponseTransformer.send()`
- `_standardizeErrorResponse()` → `ResponseTransformer.standardizeError()`
- `_getRecoveryHint()` → `ResponseTransformer.getRecoveryHint()`

---

### Section 11: WebSocketServer Methods - SSL & Protocol (Lines 2122-2239)
**Lines:** 118  
**Destination:** server-core.js

```
2122-2129 isSslEnabled() (8 lines)
2130-2138 getProtocol() (9 lines)
2139-2239 getConnectionUrl() (101 lines)
```

---

### Section 12: WebSocketServer Methods - Heartbeat & Monitoring (Lines 2240-2352)
**Lines:** 113  
**Destination:** server-core.js

```
2240-2303 startHeartbeat() (64 lines)
2304-2320 stopHeartbeat() (17 lines)
2321-2352 _checkForZombieConnections() (32 lines)
```

---

### Section 13: WebSocketServer Methods - Command Queue Processing (Lines 2353-2433)
**Lines:** 81  
**Destination:** command-handlers.js

```
2353-2375 startQueueProcessor() (23 lines)
2376-2433 stopQueueProcessor() & _processQueuedCommand() (58 lines)
```

---

### Section 14: WebSocketServer Methods - Authentication (Lines 2434-2490)
**Lines:** 57  
**Destination:** server-core.js or command-handlers.js

```
2434-2458 validateToken() (25 lines)
2459-2480 handleAuthenticate() (22 lines)
2481-2490 setAuthToken() (10 lines)
```

**Destination:** server-core.js (security at connection level)

---

### Section 15: WebSocketServer Methods - Rate Limiting (Lines 2491-2714)
**Lines:** 224  
**Destination:** command-handlers.js

```
2491-2504 initRateLimitData() (14 lines)
2505-2571 checkRateLimit() (67 lines)
2572-2624 getRateLimitStatus() (53 lines)
2625-2649 checkConcurrentOperations() (25 lines)
2650-2671 trackOperation() (22 lines)
2672-2686 completeOperation() (15 lines)
2687-2714 cleanupRateLimitData() & setRateLimitEnabled() (28 lines)
```

**Refactored in command-handlers.js:**
- Wrap in `RateLimitManager` class
- Leverage existing `WebSocketRateLimiter` from rate-limiter.js
- Methods: `checkLimit()`, `getStatus()`, `init()`, `cleanup()`

---

### Section 16: WebSocketServer Methods - Command Handler Registration (Lines 2729-11546)
**Lines:** 8,818  
**Destination:** command-handlers.js & command-registry.js

```
2729-2787 setupCommandHandlers() header & docs (59 lines)
2788-10638 Individual command registration calls (~7,851 lines)
           - registerImageCommands()
           - registerScreenshotCommands()
           - registerNetworkForensicsCommands()
           - ... (35+ more)
10639-11546 Bottom section: more registrations (~908 lines)
```

**Refactored in command-handlers.js:**
- Move ALL registration function calls here
- Keep handler definitions in respective `commands/*.js` files
- Create centralized `setupCommandHandlers()` that calls all register functions

**Refactored in command-registry.js:**
- Create `CommandRegistry` class with metadata
- Define command signatures, categories, tags, rate limit tiers
- Auto-generate from existing handlers or maintain separately

---

### Section 17: WebSocketServer Methods - Utility Methods (Lines 11565-11715)
**Lines:** 151  
**Destination:** command-handlers.js or server-core.js

```
11565-11612 setupUpdateProgressNotifications() (48 lines)
11619-11696 handleCommand() (78 lines)
11704-11715 executeWithRetry() & executeWithoutRetry() (12 lines)
```

**Destinations:**
- setupUpdateProgressNotifications(): server-core.js
- handleCommand(): command-handlers.js → `CommandExecutor.execute()`
- executeWithRetry/WithoutRetry(): command-handlers.js → `RetryManager`

---

### Section 18: WebSocketServer Methods - Final Methods (Lines 11717-11802)
**Lines:** 86  
**Destination:** server-core.js

```
11717-11724 broadcast() (8 lines)
11726-11752 getStatus() (27 lines)
11754-11799 close() (46 lines)
11800-11802 Class closing & module export (3 lines)
```

---

## Summary Table

| Section | Lines | Description | Destination |
|---------|-------|-------------|-------------|
| Imports | 115 | Dependencies | All modules |
| Error Recovery Config | 59 | Retry configuration | command-handlers |
| Utility Functions | 228 | Helpers (sleep, Tor, timeout, IPC) | server-core + utilities |
| Recovery Suggestion | 77 | Error recovery hints | command-handlers |
| State Classes | 441 | StateSnapshot, StateRollbackManager, StatefulCommandHandler | state-mgmt |
| Constructor | 266 | WebSocketServer initialization | server-core |
| Lifecycle | 159 | start(), manager setters, state setup | server-core |
| HTTP/WS Setup | 584 | Server creation, SSL, compression | server-core |
| Message Handling | 246 | Parse, route, execute commands | server-core + command-handlers |
| Response Handling | 265 | Format responses, error standardization | command-handlers |
| SSL & Protocol | 118 | SSL methods | server-core |
| Heartbeat | 113 | Heartbeat monitoring | server-core |
| Queue Processing | 81 | Command queue logic | command-handlers |
| Authentication | 57 | Token validation | server-core |
| Rate Limiting | 224 | Rate limit management | command-handlers |
| **Handler Registration** | **8,818** | **Command setup** | **command-handlers + command-registry** |
| Update Notifications | 48 | Progress tracking | server-core |
| Command Execution | 78 | Execute handlers | command-handlers |
| Retry Wrappers | 12 | Retry semantics | command-handlers |
| Broadcast/Status | 35 | Broadcast, getStatus | server-core |
| Close & Export | 49 | Cleanup, module export | server-core |
| **TOTAL** | **11,802** | | |

---

## Critical Consolidation Opportunities

### Duplicate Imports (to be consolidated)
- Manager imports appear in constructor (lines 981-1044)
- Some modules like `proxyManager`, `userAgentManager` imported twice
- **Action:** Create import manifest at top, reference in modules

### Duplicate Functions
- `isRetryableError()` logic embedded in command execution
- `calculateRetryDelay()` used in multiple places
- **Action:** Keep in `RetryManager` class, import as needed

### Command Registration Pattern
- ~35+ `register*Commands()` calls follow identical pattern
- **Action:** Abstract into `CommandRegistry.registerFromModule()`

### Error Handling
- Error standardization logic split across `_sendResponse()` and `_standardizeErrorResponse()`
- **Action:** Consolidate in `ResponseTransformer` class

---

## Module Size Projections (After Refactoring)

| Module | Current Code | Refactored | Target |
|--------|--------------|-----------|--------|
| server-core.js | ~3,600 | ~2,800 | <3,000 ✓ |
| command-handlers.js | ~8,900 | ~2,600 | <3,000 ✓ |
| state-mgmt.js | ~441 | ~2,200* | <3,000 ✓ |
| command-registry.js | New | ~1,400 | <3,000 ✓ |
| **Total** | **~11,802** | **~9,000** | |

*state-mgmt.js grows due to new StateValidator and SnapshotRepository classes

---

## Inter-Module Dependencies

```
server-core.js
  ├─ Imports: state-mgmt (StateRollbackManager)
  ├─ Imports: command-handlers (CommandExecutor)
  ├─ Imports: command-registry (CommandRegistry - optional)
  └─ No circular deps ✓

command-handlers.js
  ├─ Imports: server-core (utility functions)
  ├─ Imports: state-mgmt (StateRollbackManager, StateSnapshot)
  ├─ Imports: command-registry (CommandRegistry, CommandMetadata)
  └─ No circular deps ✓

state-mgmt.js
  ├─ Standalone (minimal external deps)
  ├─ Used by: server-core, command-handlers
  └─ No circular deps ✓

command-registry.js
  ├─ Standalone metadata definitions
  ├─ Used by: command-handlers, documentation generators
  └─ No circular deps ✓
```

---

## Testing Coverage by Module

### server-core.js Tests
- Connection establishment
- SSL/TLS configuration
- Heartbeat mechanism
- Connection pooling
- Zombie connection cleanup

### command-handlers.js Tests
- Command execution
- Retry logic
- Rate limiting
- Response formatting
- Error recovery

### state-mgmt.js Tests
- Snapshot creation
- State rollback
- Transaction semantics
- Memory pruning

### command-registry.js Tests
- Command registration
- Metadata validation
- Search/filter operations
- Documentation generation

---

**Document Version:** 1.0  
**Analysis Complete:** 2026-06-22  
**Ready for Implementation:** Yes
