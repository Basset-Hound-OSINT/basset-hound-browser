# Phase 2 Architecture: Forensic Features (Lower-Level Interaction & Content Injection)

**Version**: 12.9.0  
**Status**: Architecture Design & Implementation Guide  
**Date**: June 20, 2026  
**Phase**: 2 of 3 (Post-Phase 1 Core Commands)

---

## Executive Summary

Phase 2 extends the Basset Hound Browser with **68 new WebSocket commands** across four major feature areas:

1. **AREA 3: Lower-Level Interaction (28 commands)** - Direct DOM/Storage/Network/DevTools access
2. **AREA 2: Content Injection & Modification (25 commands)** - CSS/JavaScript injection, DOM manipulation
3. **AREA 4: Advanced Forensic Capture (15 commands)** - Enhanced extraction with correlation analysis

**Total Impact**: +2,800 lines of production code, 45+ new test files, comprehensive documentation

---

## Architecture Overview

```
Phase 2 Architecture Stack
═════════════════════════════════════════════════════════════════

Layer 4: WebSocket Commands (68 new commands)
├── Lower-Level Interaction (28)
├── Content Injection (25)
├── Advanced Forensic (15)
└── Deprecated/Refactored (2)

Layer 3: Manager Modules (8 new managers)
├── ElementPropertyManager
├── JavaScriptContextManager
├── RequestInterceptionManager (extended)
├── StorageAccessManager
├── DevToolsManager
├── CSSInjectionManager
├── JavaScriptInjectionManager
└── CorrelationAnalysisManager

Layer 2: Utility Modules (6 new utilities)
├── DOM Query Engine
├── Script Sandbox Executor
├── Storage Protocol Adapter
├── DevTools Protocol Client
├── CSS Validator & Transformer
└── Correlation Pattern Detector

Layer 1: Foundation (Electron/Browser APIs)
├── WebContents.executeJavaScript()
├── DevTools Protocol (chrome-remote-interface)
├── IndexedDB/LocalStorage/SessionStorage APIs
└── Network.enable/Request.getResponse

Integration Points:
├── Phase 1: Screenshot manager, HTML extraction
├── Extraction Module: DOM snapshot, content extraction
├── Request Interceptor: Network request/response modification
└── Evasion Framework: Fingerprint coordination
```

---

## AREA 3: Lower-Level Interaction Commands (28)

### 3.1 Direct DOM Access (7 commands)

These commands provide low-level DOM property access and manipulation.

#### Commands

```javascript
// Get element properties (selector, property name)
GET_ELEMENT_PROPERTY → { propertyName, value, type, writable, enumerable }

// Set element property (selector, property name, value)
SET_ELEMENT_PROPERTY → { success, previousValue, newValue }

// Get computed styles (selector, [properties])
GET_COMPUTED_STYLES → { styles: { propName: value }, pseudoElements }

// Get computed style for property (selector, property)
GET_COMPUTED_STYLE → { property, value, computed, important }

// Access shadow DOM (selector)
GET_SHADOW_DOM → { shadowRoot, children, host, slots }

// Traverse iframe/frame (selector, query)
GET_IFRAME_CONTENT → { html, styles, scripts, framesNested }

// Get element tree path (selector)
GET_ELEMENT_PATH → { path: "html>body>div.main>p#text", depth, ancestors }
```

#### Implementation: ElementPropertyManager

**File**: `/src/dom/element-property-manager.js`

```javascript
class ElementPropertyManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.cache = new Map(); // Cache frequently accessed properties
    this.maxCacheSize = options.maxCacheSize || 1000;
    this.validator = new PropertyValidator();
  }

  // Get element property with type coercion
  async getElementProperty(selector, propertyName) {
    // Validate selector & property
    // Execute in webContents
    // Cache result if needed
    // Return { propertyName, value, type, writable, enumerable }
  }

  // Set element property with validation
  async setElementProperty(selector, propertyName, value) {
    // Validate selector, property, and value
    // Get previous value for rollback
    // Execute in webContents
    // Return { success, previousValue, newValue }
  }

  // Get all computed styles
  async getComputedStyles(selector, properties) {
    // Query element(s)
    // Extract computed styles
    // Handle pseudo-elements
    // Return structured data
  }

  // Access shadow DOM
  async getShadowDOM(selector) {
    // Find host element
    // Access shadowRoot
    // Traverse shadow tree
    // Return shadow structure
  }

  // Traverse iframe content
  async getIframeContent(selector, query) {
    // Find iframe element
    // Access contentDocument
    // Query within frame
    // Return nested structure
  }

  // Get element path to root
  async getElementPath(selector) {
    // Find element
    // Walk ancestors
    // Build path string
    // Return { path, depth, ancestors }
  }
}
```

**Testing Strategy**:
- Unit tests for property validation (40 tests)
- Integration tests for DOM queries (35 tests)
- Edge cases: shadow DOM, iframes, cross-origin (25 tests)
- Performance tests: cache effectiveness (15 tests)

---

### 3.2 JavaScript Execution Context (7 commands)

Execute code in controlled contexts with proper isolation and error handling.

#### Commands

```javascript
// Evaluate JavaScript expression
EVAL_JAVASCRIPT → { result, type, error, executionTime }

// Call global function (functionName, args)
CALL_FUNCTION → { result, error, arguments, returnType }

// Get global variable (variableName)
GET_GLOBAL_VARIABLE → { name, value, type, writable, enumerable }

// Set global variable (variableName, value)
SET_GLOBAL_VARIABLE → { success, previousValue, value }

// Execute function with context (functionCode, context, args)
EXECUTE_WITH_CONTEXT → { result, context, error, executionTime }

// Access browser API (apiName, method, args)
CALL_BROWSER_API → { result, apiName, method, success }

// Get JavaScript error info (script)
CHECK_JAVASCRIPT_SYNTAX → { valid, errors: [], warnings: [] }
```

#### Implementation: JavaScriptContextManager

**File**: `/src/execution/javascript-context-manager.js`

```javascript
class JavaScriptContextManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.timeout = options.timeout || 30000;
    this.sandbox = new SandboxExecutor(options);
    this.apiWhitelist = options.apiWhitelist || DEFAULT_API_WHITELIST;
    this.errorTracker = new ErrorTracker();
  }

  // Evaluate JavaScript expression
  async evalJavaScript(script, options = {}) {
    // Validate syntax
    // Create execution context
    // Execute with timeout
    // Capture errors and results
    // Return { result, type, error, executionTime }
  }

  // Call global function safely
  async callFunction(functionName, args = []) {
    // Validate function exists
    // Validate arguments
    // Call with error handling
    // Return { result, error, arguments, returnType }
  }

  // Get global variable
  async getGlobalVariable(variableName) {
    // Check whitelist
    // Get from window
    // Serialize value
    // Return { name, value, type, writable }
  }

  // Set global variable
  async setGlobalVariable(variableName, value) {
    // Validate variable name
    // Check permissions
    // Set value
    // Return { success, previousValue, value }
  }

  // Execute function in specific context
  async executeWithContext(functionCode, context, args = []) {
    // Create execution context from object
    // Inject context variables
    // Execute function
    // Return { result, context, error, executionTime }
  }

  // Call browser API method
  async callBrowserAPI(apiName, method, args = []) {
    // Validate API in whitelist
    // Get API object
    // Call method
    // Handle async results
    // Return { result, apiName, method, success }
  }
}
```

**Sandbox Executor Pattern**:
```javascript
class SandboxExecutor {
  // Executes code in iframe sandbox for isolation
  // Validates API access via whitelist
  // Implements timeout mechanism
  // Captures console output
  // Returns structured results

  async execute(code, context, timeout) {
    // Create sandbox iframe
    // Inject code and context
    // Monitor execution
    // Clean up sandbox
    // Return result
  }
}
```

**Testing Strategy**:
- Unit tests for syntax validation (30 tests)
- Integration tests for API calls (45 tests)
- Sandbox isolation verification (25 tests)
- Error handling and recovery (20 tests)
- Performance: timeout enforcement (15 tests)

---

### 3.3 Network-Level Control (8 commands)

Intercept and manipulate network requests/responses at a lower level.

#### Commands

```javascript
// Get pending requests (filter)
GET_PENDING_REQUESTS → { requests: [{ id, url, method, status }] }

// Get request details (requestId)
GET_REQUEST_DETAILS → { url, method, headers, postData, responseHeaders }

// Modify request (requestId, modifications)
MODIFY_REQUEST → { success, requestId, modifiedHeaders }

// Mock response (requestId, responseData)
MOCK_REQUEST_RESPONSE → { success, requestId, mockedAt }

// Get response body (requestId)
GET_RESPONSE_BODY → { requestId, body, encoding, mimeType, size }

// Intercept by pattern (urlPattern, action)
SET_REQUEST_INTERCEPTION → { success, patternId, interceptingAt }

// Get network statistics (startTime, endTime)
GET_NETWORK_STATS → { totalRequests, totalSize, avgLatency, byType }

// Replay request (requestId, modifications)
REPLAY_REQUEST → { responseBody, statusCode, headers, latency }
```

#### Implementation: RequestInterceptionManager Extension

**File**: `/src/network/request-interception-extended.js`

```javascript
class RequestInterceptionManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.pendingRequests = new Map(); // Track in-flight requests
    this.requestHistory = new CircularBuffer(options.maxHistory || 10000);
    this.interceptionRules = new Map();
    this.responseCache = new Map();
  }

  // Get pending requests with filtering
  async getPendingRequests(filter = {}) {
    // Filter by URL pattern
    // Filter by method
    // Filter by status
    // Return metadata only (not body)
  }

  // Get full request details
  async getRequestDetails(requestId) {
    // Look up request
    // Get headers, postData, etc.
    // Resolve URL from request
    // Return full details
  }

  // Modify request before sending
  async modifyRequest(requestId, modifications) {
    // Validate request is pending
    // Apply header modifications
    // Apply postData modifications
    // Queue modification
    // Return { success, modifiedHeaders }
  }

  // Mock response for request
  async mockRequestResponse(requestId, responseData) {
    // Intercept network response
    // Return provided data instead
    // Cache for analysis
    // Return { success, requestId, mockedAt }
  }

  // Get response body
  async getResponseBody(requestId) {
    // Look up request
    // Get cached response
    // Decompress if needed
    // Return { body, encoding, mimeType, size }
  }

  // Set request interception pattern
  async setRequestInterception(urlPattern, action) {
    // Compile URL pattern
    // Create interception rule
    // Store in rules map
    // Start monitoring
    // Return { success, patternId }
  }

  // Get network statistics
  async getNetworkStats(startTime, endTime) {
    // Query request history
    // Calculate totals
    // Group by type
    // Compute averages
    // Return { totalRequests, totalSize, avgLatency, byType }
  }

  // Replay network request
  async replayRequest(requestId, modifications) {
    // Get original request details
    // Apply modifications
    // Send request again
    // Compare responses
    // Return response data
  }
}
```

**Testing Strategy**:
- Unit tests for request filtering (25 tests)
- Integration tests with CDP (DevTools Protocol) (40 tests)
- Mock response validation (30 tests)
- Network stats accuracy (20 tests)
- Edge cases: binary data, streaming responses (15 tests)

---

### 3.4 Storage Access (7 commands)

Low-level access to browser storage APIs with exploration capabilities.

#### Commands

```javascript
// Get localStorage (key pattern)
GET_LOCALSTORAGE → { items: { key: value }, count }

// Set localStorage (key, value)
SET_LOCALSTORAGE → { success, previousValue, key }

// Delete localStorage (key)
DELETE_LOCALSTORAGE → { success, key, wasPresent }

// Get sessionStorage (key pattern)
GET_SESSIONSTORAGE → { items: { key: value }, count }

// Access IndexedDB (dbName, objectStore, query)
ACCESS_INDEXEDDB → { objects: [...], count, indexedAt }

// Get IndexedDB metadata (dbName)
GET_INDEXEDDB_METADATA → { dbName, version, objectStores: [...] }

// Access Cache API (cacheName, query)
ACCESS_CACHE_API → { entries: [...], count, cacheAt }
```

#### Implementation: StorageAccessManager

**File**: `/src/storage/storage-access-manager.js`

```javascript
class StorageAccessManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.storageStats = new Map();
    this.accessLog = [];
    this.maxAccessLog = options.maxAccessLog || 5000;
  }

  // Get localStorage items
  async getLocalStorage(keyPattern = null) {
    // Execute script to access localStorage
    // Optionally filter by pattern
    // Return { items, count }
  }

  // Set localStorage item
  async setLocalStorage(key, value) {
    // Validate key
    // Get previous value
    // Set in localStorage
    // Update stats
    // Return { success, previousValue, key }
  }

  // Delete localStorage item
  async deleteLocalStorage(key) {
    // Find key
    // Delete from localStorage
    // Update stats
    // Return { success, key, wasPresent }
  }

  // Get sessionStorage items
  async getSessionStorage(keyPattern = null) {
    // Execute script to access sessionStorage
    // Filter by pattern
    // Return { items, count }
  }

  // Access IndexedDB
  async accessIndexedDB(dbName, objectStore, query = {}) {
    // Open IndexedDB database
    // Access specified object store
    // Query data
    // Return { objects, count, indexedAt }
  }

  // Get IndexedDB metadata
  async getIndexedDBMetadata(dbName) {
    // List all databases
    // Open specific database
    // Get version and object stores
    // Return { dbName, version, objectStores }
  }

  // Access Cache API (service worker)
  async accessCacheAPI(cacheName, query = {}) {
    // Open cache
    // Query entries
    // Optionally filter
    // Return { entries, count }
  }
}
```

**Testing Strategy**:
- Unit tests for storage validation (20 tests)
- Integration tests with each storage API (50 tests)
- Pattern matching and filtering (25 tests)
- Large data handling (15 tests)
- Storage quota handling (10 tests)

---

### 3.5 DevTools Protocol Access (7 commands)

Deep access to Chrome DevTools Protocol for advanced debugging.

#### Commands

```javascript
// Get DevTools session info
GET_DEVTOOLS_SESSION → { sessionId, connected, features: [], protocolVersion }

// Enable debugging domain (domain)
ENABLE_DEVTOOLS_DOMAIN → { domain, enabled, methods: [] }

// Get performance metrics
GET_PERFORMANCE_METRICS → { metrics: { name, value }, timestamp }

// Set JavaScript breakpoint (scriptId, lineNumber)
SET_BREAKPOINT → { success, breakpointId, location }

// Get memory info
GET_MEMORY_INFO → { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit }

// Get CPU profile
GET_CPU_PROFILE → { profile, duration, nodes: [] }

// Enable performance tracing (categories)
START_PERFORMANCE_TRACE → { success, sessionId, tracingAt }
```

#### Implementation: DevToolsManager

**File**: `/src/devtools/devtools-manager.js`

```javascript
class DevToolsManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.debuggerClient = null;
    this.enabledDomains = new Set();
    this.profiles = new Map();
    this.breakpoints = new Map();
  }

  // Initialize DevTools connection
  async initialize() {
    // Connect to chrome-remote-interface
    // Enable Runtime domain
    // Enable Debugger domain
    // Enable Performance domain
    // Return session info
  }

  // Get session info
  async getDevToolsSession() {
    // Get WebSocket debugger URL
    // Connect to CDP
    // Get protocol version
    // Return { sessionId, connected, features, protocolVersion }
  }

  // Enable specific domain
  async enableDevToolsDomain(domain) {
    // Validate domain name
    // Send enable command
    // Cache enabled domains
    // Return { domain, enabled, methods }
  }

  // Get performance metrics
  async getPerformanceMetrics() {
    // Enable Performance domain
    // Get metrics
    // Parse results
    // Return { metrics, timestamp }
  }

  // Set JavaScript breakpoint
  async setBreakpoint(scriptId, lineNumber) {
    // Enable Debugger domain
    // Set breakpoint
    // Store reference
    // Return { success, breakpointId, location }
  }

  // Get memory info
  async getMemoryInfo() {
    // Get heap statistics
    // Parse memory usage
    // Return { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit }
  }

  // Get CPU profile
  async getCPUProfile() {
    // Start profiling
    // Run for duration
    // Stop and collect
    // Return { profile, duration, nodes }
  }

  // Start performance trace
  async startPerformanceTrace(categories = []) {
    // Enable Tracing domain
    // Start trace with categories
    // Return { success, sessionId, tracingAt }
  }
}
```

**Testing Strategy**:
- Unit tests for domain validation (20 tests)
- Integration tests with DevTools Protocol (45 tests)
- Profile data validation (25 tests)
- Breakpoint management (15 tests)
- Memory tracking accuracy (10 tests)

---

## AREA 2: Content Injection & Modification (25 commands)

### 4.1 CSS Injection (8 commands)

Dynamic CSS loading and modification.

#### Commands

```javascript
// Inject CSS from string
INJECT_CSS → { success, styleId, cssSize, appliedAt }

// Inject CSS from URL
INJECT_CSS_URL → { success, styleId, url, loadedAt }

// Create dynamic stylesheet
CREATE_STYLESHEET → { success, styleId, href, cssText }

// Modify style rule (styleId, ruleIndex, cssText)
MODIFY_STYLE_RULE → { success, styleId, ruleIndex, newRule }

// Remove injected CSS (styleId)
REMOVE_INJECTED_CSS → { success, styleId, removedAt }

// Apply animation (selector, keyframes, duration)
APPLY_ANIMATION → { success, animationId, selector, duration }

// Inject theme CSS (themeName, colorScheme)
INJECT_THEME → { success, themeId, colors: {} }

// Get current stylesheets
GET_STYLESHEETS → { stylesheets: [{ href, size, rules }], count }
```

#### Implementation: CSSInjectionManager

**File**: `/src/injection/css-injection-manager.js`

```javascript
class CSSInjectionManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.injectedStyles = new Map(); // Track injected styles
    this.styleValidator = new CSSValidator();
    this.animationRegistry = new Map();
  }

  // Inject CSS from string
  async injectCSS(cssText, options = {}) {
    // Validate CSS syntax
    // Create style element
    // Inject into document
    // Track in registry
    // Return { success, styleId, cssSize, appliedAt }
  }

  // Inject CSS from URL
  async injectCSSUrl(url, options = {}) {
    // Validate URL
    // Load CSS content
    // Validate CSS
    // Create link element
    // Return { success, styleId, url, loadedAt }
  }

  // Create dynamic stylesheet
  async createStylesheet(cssText, options = {}) {
    // Validate CSS
    // Create CSSStyleSheet
    // Adopt into document
    // Store reference
    // Return { success, styleId, href, cssText }
  }

  // Modify specific style rule
  async modifyStyleRule(styleId, ruleIndex, cssText) {
    // Find style element
    // Validate rule exists
    // Modify rule
    // Validate result
    // Return { success, styleId, ruleIndex, newRule }
  }

  // Remove injected CSS
  async removeInjectedCSS(styleId) {
    // Find style element
    // Remove from DOM
    // Clean up registry
    // Return { success, styleId, removedAt }
  }

  // Apply CSS animation
  async applyAnimation(selector, keyframes, duration) {
    // Inject keyframes
    // Apply animation to elements
    // Track animation
    // Return { success, animationId, selector, duration }
  }

  // Inject color theme
  async injectTheme(themeName, colorScheme) {
    // Create CSS variables
    // Inject stylesheet
    // Apply to document
    // Return { success, themeId, colors }
  }

  // Get stylesheet information
  async getStylesheets() {
    // Query document.styleSheets
    // Extract metadata
    // Return { stylesheets, count }
  }
}
```

**CSS Validator**:
```javascript
class CSSValidator {
  // Validates CSS syntax before injection
  // Checks for malicious patterns
  // Warns about performance issues
  // Normalizes CSS

  validate(cssText, options = {}) {
    // Parse CSS
    // Check for syntax errors
    // Check for security issues
    // Return validation result
  }
}
```

**Testing Strategy**:
- Unit tests for CSS validation (30 tests)
- Integration tests for CSS injection (40 tests)
- Animation timing and performance (25 tests)
- Theme application and switching (15 tests)
- Stylesheet metadata extraction (10 tests)

---

### 4.2 JavaScript Injection (8 commands)

Execute and manage injected JavaScript code.

#### Commands

```javascript
// Inject script from string
INJECT_SCRIPT → { success, scriptId, scriptSize, executedAt }

// Inject script from URL
INJECT_SCRIPT_URL → { success, scriptId, url, loadedAt }

// Execute immediately (code)
EXECUTE_IMMEDIATE → { success, result, executedAt }

// Create persistent script (code, name)
CREATE_PERSISTENT_SCRIPT → { success, scriptId, name, persistent }

// Remove injected script (scriptId)
REMOVE_INJECTED_SCRIPT → { success, scriptId, removedAt }

// Monkey-patch function (objectPath, functionName, replacement)
MONKEY_PATCH → { success, scriptId, objectPath, patched }

// Hook function calls (functionPath, onEnter, onExit)
HOOK_FUNCTION → { success, hookId, functionPath, captures }

// List injected scripts
GET_INJECTED_SCRIPTS → { scripts: [{ id, name, size }], count }
```

#### Implementation: JavaScriptInjectionManager

**File**: `/src/injection/javascript-injection-manager.js`

```javascript
class JavaScriptInjectionManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.injectedScripts = new Map();
    this.hooks = new Map();
    this.monkeyPatches = new Map();
    this.executionLog = [];
  }

  // Inject script from string
  async injectScript(code, options = {}) {
    // Validate syntax
    // Create script element
    // Inject into document
    // Wait for execution
    // Track injected script
    // Return { success, scriptId, scriptSize, executedAt }
  }

  // Inject script from URL
  async injectScriptUrl(url, options = {}) {
    // Validate URL
    // Load script content
    // Validate syntax
    // Create script element
    // Return { success, scriptId, url, loadedAt }
  }

  // Execute code immediately
  async executeImmediate(code) {
    // Validate syntax
    // Execute in webContents
    // Capture result
    // Return { success, result, executedAt }
  }

  // Create persistent script
  async createPersistentScript(code, name) {
    // Validate syntax
    // Create script element
    // Make persistent (not removed on unload)
    // Store reference
    // Return { success, scriptId, name, persistent }
  }

  // Remove injected script
  async removeInjectedScript(scriptId) {
    // Find script element
    // Remove from DOM
    // Clean up hooks
    // Clean up patches
    // Return { success, scriptId, removedAt }
  }

  // Monkey-patch function
  async monkeyPatch(objectPath, functionName, replacement) {
    // Resolve object path
    // Get original function
    // Replace with wrapper
    // Store original
    // Return { success, scriptId, objectPath, patched }
  }

  // Hook function calls
  async hookFunction(functionPath, onEnter, onExit) {
    // Create hook wrapper
    // Intercept function calls
    // Call onEnter before
    // Call onExit after
    // Capture arguments/results
    // Return { success, hookId, functionPath, captures }
  }

  // Get injected scripts
  async getInjectedScripts() {
    // List all injected scripts
    // Get metadata
    // Return { scripts, count }
  }
}
```

**Testing Strategy**:
- Unit tests for script validation (25 tests)
- Integration tests for injection and execution (45 tests)
- Monkey-patching verification (30 tests)
- Function hooking and interception (25 tests)
- Script lifecycle management (15 tests)

---

### 4.3 DOM Manipulation (13 commands)

Advanced element creation, modification, and batch operations.

#### Commands

```javascript
// Create element (tagName, attributes)
CREATE_ELEMENT → { success, elementId, selector }

// Clone element (selector, deep)
CLONE_ELEMENT → { success, elementId, cloneOf }

// Delete element (selector)
DELETE_ELEMENT → { success, elementId, parentRemaining }

// Modify attributes (selector, attributes)
MODIFY_ATTRIBUTES → { success, elementId, modified: {} }

// Set element content (selector, content)
SET_ELEMENT_CONTENT → { success, elementId, contentType }

// Append child (parentSelector, childSelector)
APPEND_CHILD → { success, parentId, childId, newIndex }

// Insert before (referenceSelector, elementSelector)
INSERT_BEFORE → { success, elementId, beforeId, newIndex }

// Replace element (oldSelector, newSelector)
REPLACE_ELEMENT → { success, replacedId, newElementId }

// Get element children (selector)
GET_ELEMENT_CHILDREN → { children: [...], count }

// Batch create elements (definitions)
BATCH_CREATE_ELEMENTS → { success, created: [...], count }

// Batch modify attributes (modifications)
BATCH_MODIFY_ATTRIBUTES → { success, modified: [...], count }

// Batch delete elements (selectors)
BATCH_DELETE_ELEMENTS → { success, deleted: [...], count }

// Wrap element (selector, wrapperElement)
WRAP_ELEMENT → { success, elementId, wrappedBy }
```

#### Implementation: DOMManipulationManager

**File**: `/src/dom/dom-manipulation-manager.js`

```javascript
class DOMManipulationManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.elementRegistry = new Map(); // Track created elements
    this.operationHistory = [];
    this.maxHistory = options.maxHistory || 5000;
    this.batchOperationTimeout = options.batchTimeout || 5000;
  }

  // Create element
  async createElement(tagName, attributes = {}) {
    // Validate tag name
    // Create element
    // Set attributes
    // Inject into document
    // Register element
    // Return { success, elementId, selector }
  }

  // Clone element
  async cloneElement(selector, deep = true) {
    // Find element
    // Clone (deep or shallow)
    // Return { success, elementId, cloneOf }
  }

  // Delete element
  async deleteElement(selector) {
    // Find element
    // Get parent
    // Remove element
    // Unregister
    // Return { success, elementId, parentRemaining }
  }

  // Modify attributes
  async modifyAttributes(selector, attributes) {
    // Find element
    // Update attributes
    // Validate changes
    // Return { success, elementId, modified }
  }

  // Set element content
  async setElementContent(selector, content) {
    // Find element
    // Set textContent or innerHTML
    // Validate content
    // Return { success, elementId, contentType }
  }

  // Append child
  async appendChild(parentSelector, childSelector) {
    // Find parent
    // Find or create child
    // Append
    // Return { success, parentId, childId, newIndex }
  }

  // Insert before
  async insertBefore(referenceSelector, elementSelector) {
    // Find reference
    // Find element
    // Insert before reference
    // Return { success, elementId, beforeId, newIndex }
  }

  // Replace element
  async replaceElement(oldSelector, newSelector) {
    // Find old element
    // Find new element
    // Replace old with new
    // Return { success, replacedId, newElementId }
  }

  // Get element children
  async getElementChildren(selector) {
    // Find element
    // Get children
    // Return { children, count }
  }

  // Batch create elements
  async batchCreateElements(definitions) {
    // Create multiple elements
    // Inject all at once
    // Return { success, created, count }
  }

  // Batch modify attributes
  async batchModifyAttributes(modifications) {
    // Apply multiple modifications
    // Batch for performance
    // Return { success, modified, count }
  }

  // Batch delete elements
  async batchDeleteElements(selectors) {
    // Delete multiple elements
    // Batch for performance
    // Return { success, deleted, count }
  }

  // Wrap element
  async wrapElement(selector, wrapperElement) {
    // Find element
    // Create wrapper
    // Wrap element in wrapper
    // Return { success, elementId, wrappedBy }
  }
}
```

**Testing Strategy**:
- Unit tests for element validation (25 tests)
- Integration tests for DOM operations (50 tests)
- Batch operation performance (20 tests)
- Element registry accuracy (15 tests)
- Edge cases: malformed HTML, nesting (15 tests)

---

## AREA 4: Advanced Forensic Capture (15 commands)

Enhanced extraction with correlation analysis for forensic completeness.

### 5.1 Commands

```javascript
// Extract with context (selector, context)
EXTRACT_WITH_CONTEXT → { data: {}, context: {}, timestamp }

// Correlate extractions (extractionIds)
CORRELATE_EXTRACTIONS → { correlations: [...], patterns: [] }

// Detect data relationships (cssSelector)
DETECT_DATA_RELATIONSHIPS → { relationships: [...], confidence: 0.0-1.0 }

// Get extraction metadata (extractionId)
GET_EXTRACTION_METADATA → { metadata: {}, quality: 0.0-1.0 }

// Create forensic snapshot
CREATE_FORENSIC_SNAPSHOT → { snapshotId, includedData: [...], timestamp }

// Analyze extraction quality (extractionId)
ANALYZE_EXTRACTION_QUALITY → { quality: 0.0-1.0, metrics: {} }

// Get extraction history (limit)
GET_EXTRACTION_HISTORY → { extractions: [...], count }

// Validate extraction integrity
VALIDATE_EXTRACTION → { valid: boolean, errors: [...] }

// Export with metadata (extractionId, format)
EXPORT_WITH_METADATA → { exported: true, format, size }

// Batch extract and correlate (selectors)
BATCH_EXTRACT_CORRELATE → { extractions: [...], correlations: [...] }

// Get correlation patterns
GET_CORRELATION_PATTERNS → { patterns: [...], count }

// Detect anomalies (extractionId, threshold)
DETECT_ANOMALIES → { anomalies: [...], score: 0.0-1.0 }

// Get completeness score
GET_COMPLETENESS_SCORE → { score: 0.0-1.0, missing: [...] }

// Map data lineage (extractionId)
MAP_DATA_LINEAGE → { lineage: {...}, sources: [...] }

// Verify extraction consistency
VERIFY_EXTRACTION_CONSISTENCY → { consistent: boolean, issues: [...] }
```

### 5.2 Implementation: CorrelationAnalysisManager

**File**: `/src/analysis/correlation-analysis-manager.js`

```javascript
class CorrelationAnalysisManager {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.extractionStore = new Map();
    this.correlations = new Map();
    this.patternDetector = new PatternDetector();
    this.qualityAnalyzer = new QualityAnalyzer();
  }

  // Extract with context
  async extractWithContext(selector, context = {}) {
    // Extract data
    // Capture context
    // Store extraction
    // Return { data, context, timestamp }
  }

  // Correlate multiple extractions
  async correlateExtractions(extractionIds) {
    // Get extractions by ID
    // Compare data
    // Find patterns
    // Return { correlations, patterns }
  }

  // Detect data relationships
  async detectDataRelationships(selector) {
    // Extract data
    // Analyze structure
    // Detect relationships
    // Return { relationships, confidence }
  }

  // Get extraction metadata
  async getExtractionMetadata(extractionId) {
    // Get extraction
    // Analyze quality
    // Get metadata
    // Return { metadata, quality }
  }

  // Create forensic snapshot
  async createForensicSnapshot(selections = {}) {
    // Collect all selected data
    // Create snapshot
    // Store with metadata
    // Return { snapshotId, includedData, timestamp }
  }

  // Analyze extraction quality
  async analyzeExtractionQuality(extractionId) {
    // Get extraction
    // Run quality metrics
    // Calculate score
    // Return { quality, metrics }
  }

  // Get extraction history
  async getExtractionHistory(limit = 100) {
    // Get recent extractions
    // Sort by timestamp
    // Return { extractions, count }
  }

  // Validate extraction integrity
  async validateExtraction(extractionId) {
    // Get extraction
    // Check integrity
    // Validate structure
    // Return { valid, errors }
  }

  // Export with metadata
  async exportWithMetadata(extractionId, format = 'json') {
    // Get extraction and metadata
    // Export in format
    // Return { exported, format, size }
  }

  // Batch extract and correlate
  async batchExtractCorrelate(selectors) {
    // Extract all selectors
    // Correlate results
    // Return { extractions, correlations }
  }

  // Get correlation patterns
  async getCorrelationPatterns() {
    // Get all stored correlations
    // Extract patterns
    // Return { patterns, count }
  }

  // Detect anomalies
  async detectAnomalies(extractionId, threshold = 0.7) {
    // Get extraction
    // Compare to patterns
    // Detect anomalies
    // Return { anomalies, score }
  }

  // Get completeness score
  async getCompletenessScore(extractionId) {
    // Get extraction
    // Check expected fields
    // Calculate score
    // Return { score, missing }
  }

  // Map data lineage
  async mapDataLineage(extractionId) {
    // Get extraction
    // Trace data sources
    // Map dependencies
    // Return { lineage, sources }
  }

  // Verify consistency
  async verifyExtractionConsistency(extractionId) {
    // Get extraction
    // Compare with historical
    // Check consistency
    // Return { consistent, issues }
  }
}
```

---

## Implementation Sequence & Dependencies

### Phase 2 Build Order

```
Week 1: Foundation (Days 1-5)
├── Module 1: ElementPropertyManager (2 days)
│   ├── DOM queries and navigation
│   ├── Property access patterns
│   ├── Cache mechanism
│   └── 40 unit + 35 integration tests
│
├── Module 2: JavaScriptContextManager (2 days)
│   ├── Sandbox executor
│   ├── API whitelist
│   ├── Error handling
│   └── 30 unit + 45 integration tests
│
└── Module 3: RequestInterceptionManager Extension (1 day)
    ├── Extend existing request interceptor
    ├── Network statistics
    ├── Response caching
    └── 25 unit + 40 integration tests

Week 2: Integration (Days 6-10)
├── Module 4: StorageAccessManager (1.5 days)
│   ├── localStorage/sessionStorage
│   ├── IndexedDB traversal
│   ├── Cache API access
│   └── 20 unit + 50 integration tests
│
├── Module 5: DevToolsManager (1.5 days)
│   ├── CDP initialization
│   ├── Domain management
│   ├── Profile collection
│   └── 20 unit + 45 integration tests
│
├── Module 6: CSSInjectionManager (1 day)
│   ├── CSS validation
│   ├── Dynamic stylesheets
│   ├── Animation management
│   └── 30 unit + 40 integration tests
│
└── Module 7: JavaScriptInjectionManager (1 day)
    ├── Script injection
    ├── Monkey-patching
    ├── Function hooking
    └── 25 unit + 45 integration tests

Week 3: Advanced Features (Days 11-15)
├── Module 8: DOMManipulationManager (2 days)
│   ├── Element creation/deletion
│   ├── Batch operations
│   ├── Element registry
│   └── 25 unit + 50 integration tests
│
├── Module 9: CorrelationAnalysisManager (1.5 days)
│   ├── Extraction correlation
│   ├── Pattern detection
│   ├── Quality analysis
│   └── 20 unit + 40 integration tests
│
└── Module 10: Testing & Documentation (1.5 days)
    ├── End-to-end tests
    ├── Integration tests
    ├── API documentation
    └── Examples and tutorials

Total: 15 days (~3 weeks) with parallel development possible
```

### Dependency Graph

```
Foundation Layer
├── ElementPropertyManager (no deps)
├── JavaScriptContextManager (no deps)
└── StorageAccessManager (no deps)

Extension Layer
├── RequestInterceptionManager ← (existing Phase 1)
├── DevToolsManager ← (Foundation: JSContextManager)
├── CSSInjectionManager ← (Foundation: ElementPropertyManager)
└── JavaScriptInjectionManager ← (Foundation: JSContextManager)

Advanced Layer
├── DOMManipulationManager ← (Foundation: ElementPropertyManager + Extension: CSSInjectionManager)
└── CorrelationAnalysisManager ← (Foundation: StorageAccessManager + Extension: RequestInterceptionManager)

WebSocket Commands
└── All 68 commands ← (All Managers)
```

---

## Testing Strategy for Phase 2

### Test Organization

```
tests/
├── unit/                          # 450+ tests
│   ├── element-property-manager.test.js (40)
│   ├── javascript-context-manager.test.js (30)
│   ├── request-interception-extended.test.js (25)
│   ├── storage-access-manager.test.js (20)
│   ├── devtools-manager.test.js (20)
│   ├── css-injection-manager.test.js (30)
│   ├── javascript-injection-manager.test.js (25)
│   ├── dom-manipulation-manager.test.js (25)
│   └── correlation-analysis-manager.test.js (20)
│
├── integration/                   # 380+ tests
│   ├── lower-level-interaction.test.js (70)
│   ├── content-injection.test.js (65)
│   ├── dom-manipulation.test.js (60)
│   ├── forensic-capture.test.js (50)
│   ├── end-to-end-phase2.test.js (75)
│   └── performance-phase2.test.js (40)
│
└── fixtures/
    ├── sample-pages/
    ├── test-data/
    └── mock-responses/
```

### Test Coverage Targets

- **Unit Tests**: 95%+ coverage
- **Integration Tests**: 85%+ coverage
- **End-to-End Tests**: All command paths
- **Performance Tests**: Response time < 200ms per command

### Example Test Pattern

```javascript
describe('ElementPropertyManager', () => {
  let manager;
  let mainWindow;

  beforeEach(() => {
    // Setup
  });

  describe('getElementProperty', () => {
    it('should get element property with correct type', async () => {
      // Arrange
      const selector = '#test-element';
      const property = 'innerHTML';

      // Act
      const result = await manager.getElementProperty(selector, property);

      // Assert
      expect(result.success).toBe(true);
      expect(result.propertyName).toBe(property);
      expect(typeof result.value).toBe('string');
      expect(result.type).toBe('string');
    });

    it('should handle nonexistent element', async () => {
      // Arrange
      const selector = '#nonexistent';

      // Act & Assert
      await expect(
        manager.getElementProperty(selector, 'innerHTML')
      ).rejects.toThrow('Element not found');
    });

    it('should cache frequently accessed properties', async () => {
      // Arrange & Act
      await manager.getElementProperty('#cached', 'id');
      await manager.getElementProperty('#cached', 'id');

      // Assert
      expect(manager.cache.size).toBeGreaterThan(0);
    });
  });
});
```

---

## Error Handling Strategy

### Error Categories

```
Recoverable Errors:
├── Timeout errors → Retry with backoff
├── Network errors → Fallback to cached data
├── Element not found → Return empty result with flag
└── Storage quota exceeded → Compress and retry

Non-Recoverable Errors:
├── Permission denied → Return error with recovery suggestion
├── Script syntax error → Return detailed error message
├── DevTools disconnected → Reconnect and retry
└── Invalid parameter → Return validation error

Critical Errors:
└── Browser process crash → Restart and recover state
```

### Error Response Format

```javascript
{
  "success": false,
  "error": "Element not found",
  "errorType": "ElementNotFoundError",
  "errorCode": "E_ELEMENT_NOT_FOUND",
  "recovery": {
    "suggestion": "Check selector validity",
    "alternativeCommands": ["get_element_path", "get_page_state"],
    "retryable": false
  },
  "timestamp": "2026-06-20T12:00:00Z"
}
```

---

## Performance Targets

### Command Response Times (p95)

```
Lower-Level Interaction:
├── GET_ELEMENT_PROPERTY: < 50ms
├── GET_COMPUTED_STYLES: < 100ms
├── GET_SHADOW_DOM: < 75ms
├── EVAL_JAVASCRIPT: < 200ms
├── GET_PENDING_REQUESTS: < 50ms
└── GET_LOCALSTORAGE: < 75ms

Content Injection:
├── INJECT_CSS: < 100ms
├── INJECT_SCRIPT: < 150ms
├── CREATE_ELEMENT: < 50ms
├── BATCH_CREATE_ELEMENTS (100): < 500ms
└── MONKEY_PATCH: < 100ms

Forensic Capture:
├── EXTRACT_WITH_CONTEXT: < 150ms
├── CORRELATE_EXTRACTIONS: < 200ms
├── CREATE_FORENSIC_SNAPSHOT: < 300ms
└── DETECT_ANOMALIES: < 250ms
```

### Memory Targets

```
Manager Instance Memory:
├── ElementPropertyManager: < 5MB
├── JavaScriptContextManager: < 3MB
├── RequestInterceptionManager: < 8MB (with history)
├── StorageAccessManager: < 2MB
├── DevToolsManager: < 4MB
├── CSSInjectionManager: < 2MB
├── JavaScriptInjectionManager: < 3MB
├── DOMManipulationManager: < 5MB
└── CorrelationAnalysisManager: < 6MB

Total Manager Memory: < 40MB
```

---

## Integration with Phase 1

### Phase 1 Dependencies

```
Phase 1 Provides:
├── ScreenshotManager → Used by extraction verification
├── ExtractionManager → Extended by CorrelationAnalysisManager
├── DOMInspector → Used by ElementPropertyManager
├── RequestInterceptor → Extended by RequestInterceptionManager
├── UserAgentManager → Available context for forensic capture
└── WebSocket Server → Registers all Phase 2 commands

Phase 2 Extends:
├── Extraction module with correlation
├── DOM inspection with property access
├── Request interception with lower-level control
└── Content capabilities with injection
```

### API Compatibility

```
New Commands: 68 total
├── No breaking changes to Phase 1 commands
├── No changes to Phase 1 response format
├── Backward compatible with existing clients
└── Opt-in for Phase 2 features
```

---

## Module Dependencies & Imports

### ElementPropertyManager

```javascript
require('../dom/property-validator')    // Validates property access
require('../utils/cache-manager')       // For caching
require('../logging')                   // For logging
```

### JavaScriptContextManager

```javascript
require('../execution/sandbox-executor')
require('../execution/api-whitelist')
require('../utils/error-tracker')
require('../logging')
```

### StorageAccessManager

```javascript
require('../utils/storage-protocol-adapter')
require('../logging')
require('../utils/memory-manager')
```

### DevToolsManager

```javascript
require('chrome-remote-interface')      // CDP client
require('../utils/cdp-connection-pool')
require('../logging')
```

### CSSInjectionManager

```javascript
require('../dom/css-validator')
require('../dom/css-transformer')
require('../logging')
```

### JavaScriptInjectionManager

```javascript
require('../execution/script-validator')
require('../logging')
require('../utils/script-registry')
```

### DOMManipulationManager

```javascript
require('../dom/element-property-manager')
require('../dom/css-injection-manager')
require('../utils/element-registry')
require('../logging')
```

### CorrelationAnalysisManager

```javascript
require('../analysis/pattern-detector')
require('../analysis/quality-analyzer')
require('../logging')
require('../utils/extraction-store')
```

---

## Configuration & Options

### Manager Options

```javascript
// ElementPropertyManager
{
  maxCacheSize: 1000,
  cacheTTL: 300000,  // 5 minutes
  validateProperties: true
}

// JavaScriptContextManager
{
  timeout: 30000,
  sandboxEnabled: true,
  apiWhitelist: DEFAULT_WHITELIST,
  captureConsole: true
}

// RequestInterceptionManager
{
  maxHistory: 10000,
  enableNetworkStats: true,
  cacheResponses: true
}

// StorageAccessManager
{
  maxAccessLog: 5000,
  enableIndexedDB: true,
  enableCacheAPI: true
}

// DevToolsManager
{
  autoConnect: true,
  enableProfiling: true,
  enableTracing: false
}

// CSSInjectionManager
{
  validateCSS: true,
  maxInjectedSize: 10485760,  // 10MB
  enableAnimations: true
}

// JavaScriptInjectionManager
{
  validateScripts: true,
  maxInjectedSize: 10485760,
  enableHooking: true,
  executionLog: true
}

// DOMManipulationManager
{
  maxHistory: 5000,
  batchTimeout: 5000,
  enableRollback: true
}

// CorrelationAnalysisManager
{
  maxExtractions: 10000,
  enableQualityAnalysis: true,
  enableAnomalyDetection: true
}
```

---

## Documentation Artifacts

### Phase 2 Documentation Structure

```
/docs/
├── PHASE-2-ARCHITECTURE-FORENSIC-FEATURES.md (this file)
├── features/
│   ├── LOWER-LEVEL-INTERACTION-GUIDE.md
│   ├── CONTENT-INJECTION-GUIDE.md
│   └── FORENSIC-CAPTURE-GUIDE.md
├── api/
│   ├── LOWER-LEVEL-INTERACTION-API.md
│   ├── CONTENT-INJECTION-API.md
│   └── FORENSIC-CAPTURE-API.md
├── implementation/
│   ├── PHASE-2-MANAGERS-REFERENCE.md
│   ├── PHASE-2-ERROR-HANDLING.md
│   └── PHASE-2-TESTING-GUIDE.md
└── examples/
    ├── lower-level-interaction-examples.js
    ├── content-injection-examples.js
    └── forensic-capture-examples.js
```

---

## Migration & Deployment Strategy

### Release Strategy

```
Pre-Release (Alpha):
├── Internal testing with Phase 1 users
├── Performance validation against targets
├── Security review of injection features
└── Documentation validation

Beta Release:
├── Limited external testing
├── Gather feedback on API design
├── Performance optimization
└── Update documentation

Production Release:
├── All tests passing (100%)
├── Performance targets met
├── Security audit complete
└── Full documentation published
```

### Rollout Plan

```
Week 1: Deploy with feature flags disabled
├── Monitor for startup issues
├── Verify backward compatibility
└── Baseline memory/CPU

Week 2: Enable for internal testing
├── Run full test suite
├── Monitor performance
└── Gather feedback

Week 3: Gradual rollout
├── 10% of users
├── Monitor for issues
└── Expand rollout

Week 4: Full rollout
├── 100% of users
├── Monitor metrics
└── Gather feedback for Phase 3
```

---

## Success Metrics

### Code Quality

- [ ] All 450+ unit tests passing
- [ ] All 380+ integration tests passing
- [ ] 95%+ code coverage
- [ ] Zero high-severity security issues
- [ ] ESLint passes with zero warnings

### Performance

- [ ] 95% of commands < 200ms response time
- [ ] Memory usage < 40MB for all managers
- [ ] No memory leaks over 1-hour test runs
- [ ] Throughput > 100 commands/sec

### Documentation

- [ ] 3 feature guides (45 pages)
- [ ] 3 API references (30 pages)
- [ ] 50+ code examples
- [ ] Complete troubleshooting guide
- [ ] Video tutorials (5+ videos)

### User Experience

- [ ] Clear error messages for all failures
- [ ] Recovery suggestions in error responses
- [ ] Example code for every command
- [ ] Integration guide with Phase 1

---

## Risk Mitigation

### Technical Risks

```
Risk: Script injection security vulnerabilities
├── Mitigation: Sandbox execution, content validation, CSP headers
└── Owner: Security team

Risk: Memory bloat from caching
├── Mitigation: Configurable cache limits, LRU eviction
└── Owner: Performance team

Risk: DevTools Protocol compatibility
├── Mitigation: Version detection, fallback handlers
└── Owner: Integration team

Risk: Cross-frame/iframe access failures
├── Mitigation: Comprehensive iframe traversal, error handling
└── Owner: QA team
```

### Operational Risks

```
Risk: Breaking changes to Phase 1
├── Mitigation: Comprehensive compatibility testing
└── Owner: QA team

Risk: Performance regression
├── Mitigation: Continuous performance monitoring
└── Owner: DevOps team

Risk: Documentation lag
├── Mitigation: Documentation-as-code, automated validation
└── Owner: Tech writing team
```

---

## Next Steps: Phase 3 Preview

Phase 3 will continue with:

```
AREA 5: Advanced Evasion Enhancements
├── Behavioral simulation refinement
├── Detection vector expansion
└── Evasion intelligence integration

AREA 6: Session Management Advanced
├── Multi-session orchestration
├── State synchronization
└── Session migration

AREA 7: Analytics & Reporting
├── Command usage analytics
├── Performance dashboards
└── Forensic report generation

AREA 8: Integration APIs
├── palletai agent integration
├── Claude API integration
└── External system connectors
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-20 | Architecture Team | Initial design document |

---

## Appendix: Command Reference Quick Index

### By Response Time

**Fastest (< 50ms)**:
- GET_ELEMENT_PROPERTY
- GET_PENDING_REQUESTS
- GET_LOCALSTORAGE
- CREATE_ELEMENT
- REMOVE_INJECTED_CSS

**Fast (50-100ms)**:
- GET_COMPUTED_STYLES
- INJECT_CSS
- GET_SESSIONSTORAGE
- MODIFY_ATTRIBUTES
- MONKEY_PATCH

**Medium (100-200ms)**:
- GET_SHADOW_DOM
- EVAL_JAVASCRIPT
- INJECT_SCRIPT
- EXTRACT_WITH_CONTEXT
- BATCH_CREATE_ELEMENTS

**Slower (200ms+)**:
- CORRELATE_EXTRACTIONS
- CREATE_FORENSIC_SNAPSHOT
- DETECT_ANOMALIES
- GET_CPU_PROFILE

### By Security Level

**High Security**: 
- EVAL_JAVASCRIPT
- INJECT_SCRIPT
- CALL_BROWSER_API
- EXECUTE_WITH_CONTEXT

**Medium Security**:
- MODIFY_REQUEST
- MOCK_REQUEST_RESPONSE
- MONKEY_PATCH
- HOOK_FUNCTION

**Low Security**:
- GET_ELEMENT_PROPERTY
- GET_LOCALSTORAGE
- GET_STYLESHEETS
- EXTRACT_WITH_CONTEXT

---

**Status**: Ready for Implementation  
**Estimated Effort**: 200-250 developer hours  
**Target Completion**: Q3 2026
