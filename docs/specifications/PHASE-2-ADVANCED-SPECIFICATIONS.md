# Phase 2 Advanced Specifications - Error Handling, Security, & Extended Examples

**Version**: 1.0  
**Status**: Complete Reference  
**Date**: June 20, 2026  
**Focus**: Advanced scenarios, error handling, security patterns

---

## Table of Contents

1. [Error Handling Strategy](#error-handling-strategy)
2. [Security Considerations](#security-considerations)
3. [Performance Optimization Patterns](#performance-optimization-patterns)
4. [Timeout and Retry Mechanisms](#timeout-and-retry-mechanisms)
5. [Resource Management](#resource-management)
6. [Extended Command Examples](#extended-command-examples)
7. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
8. [Compliance and Audit Logging](#compliance-and-audit-logging)

---

## Error Handling Strategy

### Standardized Error Response Format

All Phase 2 commands follow this error response structure:

```json
{
  "id": "cmd-12345",
  "command": "command_name",
  "success": false,
  "error": "User-friendly error message",
  "errorCode": "STANDARDIZED_ERROR_CODE",
  "errorDetails": {
    "type": "error_type",
    "message": "Technical details",
    "stack": "Stack trace if available",
    "context": { "selector": ".failed-selector", "timeout": 5000 }
  },
  "recovery": {
    "suggestion": "What user should try next",
    "alternativeCommands": [
      "alternative_command_1",
      "alternative_command_2"
    ],
    "commonCauses": [
      "Element not loaded yet",
      "Selector is too specific"
    ],
    "documentationUrl": "https://docs.example.com/error-code"
  },
  "metadata": {
    "executionTime": 145,
    "timestamp": "2026-06-20T12:34:56.789Z",
    "attempt": 1,
    "maxRetries": 3,
    "willRetry": false
  }
}
```

### Error Code Taxonomy

**DOM-Related Errors:**
```
ELEMENT_NOT_FOUND          - Selector matched no elements
MULTIPLE_MATCHES           - Selector matched more than one element
INVALID_SELECTOR           - Selector syntax error
ELEMENT_HIDDEN             - Element exists but not visible
ELEMENT_DETACHED           - Element removed from DOM
IFRAME_NOT_LOADED          - iframe hasn't loaded yet
CROSS_ORIGIN_DENIED        - Same-origin policy violated
NO_SHADOW_DOM              - Element has no Shadow DOM
SHADOW_DOM_CLOSED          - Shadow DOM mode is 'closed'
```

**JavaScript Execution Errors:**
```
SYNTAX_ERROR               - Invalid JavaScript syntax
REFERENCE_ERROR            - Undefined variable/function
TYPE_ERROR                 - Type mismatch
EXECUTION_TIMEOUT          - Script exceeded timeout
NON_SERIALIZABLE           - Return value can't be JSON serialized
FUNCTION_NOT_FOUND         - Function doesn't exist
NOT_A_FUNCTION             - Target is not callable
CIRCULAR_REFERENCE         - Object has circular reference
```

**Network Errors:**
```
INVALID_PATTERN            - Invalid URL pattern for interception
INVALID_ACTION             - Unknown intercept action
DUPLICATE_INTERCEPT_ID     - Intercept ID already exists
REQUEST_BLOCKED            - Request was blocked by interception
MOCK_NOT_FOUND             - No mock setup for request
NETWORK_ERROR              - Underlying network failure
```

**Storage Errors:**
```
STORAGE_EMPTY              - Storage has no data
KEY_NOT_FOUND              - Specific key doesn't exist
ACCESS_DENIED              - Storage access denied
QUOTA_EXCEEDED             - Storage quota exceeded
STORAGE_CORRUPTED          - Data corruption detected
```

**Injection Errors:**
```
UNSAFE_PROPERTY_BLOCKED    - Dangerous property attempted
PROPERTY_NOT_WRITABLE      - Can't modify read-only property
NOT_WRITABLE               - Prototype/object is frozen
INJECTION_FAILED           - Failed to inject code
LIBRARY_LOAD_FAILED        - External library failed to load
INVALID_MODULE_SYNTAX      - Module code has syntax error
```

### Error Handling Best Practices

**Pattern 1: Graceful Degradation**
```javascript
// Try primary command, fall back to alternative if needed
const primaryAttempt = await execute_javascript_command(script);
if (primaryAttempt.errorCode === 'EXECUTION_TIMEOUT') {
  // Fall back to simpler approach
  const fallback = await call_function_command('window.simpleGetter');
  return fallback.success ? fallback : primaryAttempt;
}
```

**Pattern 2: Retry with Exponential Backoff**
```javascript
async function executeWithRetry(command, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await execute(command);
      if (result.success) return result;
      
      // Check if retryable
      if (!isRetryable(result.errorCode)) {
        return result;
      }
      lastError = result;
    } catch (e) {
      lastError = e;
    }
    
    // Exponential backoff: 100ms, 200ms, 400ms
    const delay = 100 * Math.pow(2, attempt - 1);
    await sleep(delay);
  }
  return { success: false, error: lastError };
}
```

**Pattern 3: Defensive Selector Verification**
```javascript
async function safeElementAccess(selector) {
  // Step 1: Verify selector is valid CSS
  try {
    document.querySelectorAll(selector);
  } catch (e) {
    return { error: 'INVALID_SELECTOR', details: e.message };
  }
  
  // Step 2: Check element exists and is visible
  const findResult = await find_elements_by_selector(selector);
  if (findResult.data.matches === 0) {
    return { error: 'ELEMENT_NOT_FOUND', suggestion: 'Use wait_for_element' };
  }
  
  // Step 3: Verify single element (if needed)
  if (findResult.data.matches > 1) {
    return { error: 'MULTIPLE_MATCHES', suggestion: 'Be more specific' };
  }
  
  return { success: true, selector };
}
```

---

## Security Considerations

### 1. Input Validation and Sanitization

All Phase 2 commands must validate and sanitize inputs:

**String Inputs:**
```javascript
// Reject strings with:
// - Script tags: <script>, javascript:, data:
// - Event handlers: on*, __proto__
// - Command injection sequences

function validateString(input, context) {
  const dangerous = /<script|javascript:|data:|on\w+=/gi;
  const hasInjection = dangerous.test(input);
  
  if (hasInjection) {
    throw {
      code: 'INJECTION_ATTEMPT',
      message: 'Input contains potentially malicious content'
    };
  }
  
  // Specific context validation
  if (context === 'CSS_SELECTOR') {
    return validateCSSSelector(input);
  }
  if (context === 'REGEX_PATTERN') {
    return validateRegex(input);
  }
}
```

**Selector Validation:**
```javascript
function validateSelector(selector) {
  const disallowed = /[;:[\]{}()|&]/; // Potential injection
  if (disallowed.test(selector)) {
    throw new Error('INVALID_SELECTOR: Contains unsafe characters');
  }
  
  // Test selector validity
  try {
    document.querySelectorAll(selector);
  } catch (e) {
    throw new Error('INVALID_SELECTOR: ' + e.message);
  }
}
```

**Object/Property Validation:**
```javascript
const FORBIDDEN_PROPERTIES = [
  'onclick', 'onerror', 'onload', 'onmouseover',
  '__proto__', 'constructor', 'prototype',
  'Function', 'eval', 'setTimeout', 'setInterval'
];

function validateProperty(name, value) {
  if (FORBIDDEN_PROPERTIES.includes(name)) {
    throw {
      code: 'UNSAFE_PROPERTY_BLOCKED',
      message: `Property '${name}' is not allowed`
    };
  }
  
  // Validate value type matches property expectations
  const expectedType = getPropertyType(name);
  if (typeof value !== expectedType && value !== null) {
    throw {
      code: 'TYPE_MISMATCH',
      message: `Expected ${expectedType}, got ${typeof value}`
    };
  }
}
```

### 2. API Whitelist System

JavaScript execution commands use API whitelist:

```javascript
const API_WHITELIST = {
  'window.fetch': {
    allowed: true,
    maxArguments: 2,
    maxBodySize: 1048576, // 1MB
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']
  },
  'window.localStorage': {
    allowed: true,
    operations: ['getItem', 'setItem', 'removeItem', 'clear'],
    maxKeyLength: 256,
    maxValueSize: 5242880 // 5MB
  },
  'window.location.href': {
    allowed: true,
    readOnly: false,
    allowedProtocols: ['http:', 'https:', 'about:']
  },
  'document.body.innerHTML': {
    allowed: false,
    reason: 'Use dom manipulation commands instead'
  },
  'eval': {
    allowed: false,
    reason: 'Use execute_javascript command'
  }
};

function validateAPIAccess(apiPath, operation) {
  const api = API_WHITELIST[apiPath];
  
  if (!api || !api.allowed) {
    throw {
      code: 'UNSAFE_API',
      message: `API '${apiPath}' is not whitelisted`,
      reason: api?.reason || 'Access denied'
    };
  }
  
  if (api.readOnly && operation === 'write') {
    throw {
      code: 'WRITE_DENIED',
      message: `Cannot write to read-only API '${apiPath}'`
    };
  }
  
  return true;
}
```

### 3. XSS Prevention in Output

All responses must sanitize sensitive data:

```javascript
function sanitizeOutput(data, sensitivePatterns) {
  const sensitiveRegexes = {
    apiKey: /api[_-]?key['":\s=]*["']?([a-zA-Z0-9_\-\.]+)/gi,
    token: /token['":\s=]*["']?([a-zA-Z0-9_\-\.]+)/gi,
    password: /password['":\s=]*["']?([^"']+)/gi,
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  };
  
  let sanitized = JSON.stringify(data);
  
  // Replace sensitive values
  for (const [type, regex] of Object.entries(sensitiveRegexes)) {
    sanitized = sanitized.replace(regex, (match) => {
      return `[REDACTED_${type.toUpperCase()}]`;
    });
  }
  
  return JSON.parse(sanitized);
}
```

### 4. Cross-Origin Restrictions

Enforce same-origin policy for sensitive operations:

```javascript
function enforceOriginRestriction(targetElement, operation) {
  // Check if target is in iframe
  if (targetElement.ownerDocument !== document) {
    const iframe = targetElement.ownerDocument.defaultView?.frameElement;
    if (iframe) {
      const iframeOrigin = new URL(iframe.src, window.location.href).origin;
      const pageOrigin = window.location.origin;
      
      if (iframeOrigin !== pageOrigin) {
        throw {
          code: 'CROSS_ORIGIN_DENIED',
          message: 'Cannot access cross-origin iframe',
          reason: `iframe origin (${iframeOrigin}) != page origin (${pageOrigin})`
        };
      }
    }
  }
  
  return true;
}
```

### 5. Audit Logging

All sensitive operations logged:

```javascript
function auditLog(command, params, result, clientId) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    clientId,
    command,
    // Log sanitized params (remove secrets)
    params: sanitizeParams(params),
    // Log result status, not sensitive data
    success: result.success,
    errorCode: result.errorCode,
    executionTime: result.metadata.executionTime,
    // Flag potentially dangerous operations
    dangerous: isDangerousOperation(command, params),
    // IP/session info
    ipAddress: getClientIP(),
    sessionId: getSessionId()
  };
  
  // Write to audit log
  logger.audit(auditEntry);
  
  // Alert if suspicious
  if (shouldAlert(auditEntry)) {
    alertSecurityTeam(auditEntry);
  }
}
```

---

## Performance Optimization Patterns

### 1. Batch Operations

Instead of multiple individual commands, use batch variants:

**Inefficient - 10 separate commands:**
```javascript
for (let i = 0; i < 10; i++) {
  await set_element_properties({
    selector: `input#field${i}`,
    properties: { value: 'test' }
  });
}
// Total time: 500-1000ms
```

**Efficient - Single batch command:**
```javascript
await batch_modify_elements({
  selector: 'input[id^="field"]',
  modifications: { value: 'test' }
});
// Total time: 50-100ms
```

### 2. Selector Optimization

**Poor Performance:**
```javascript
// Creates live NodeList, rescans on each iteration
for (let el of document.querySelectorAll('.item')) {
  // ... 1000 iterations
}
```

**Better Performance:**
```javascript
// Single query, static collection
const items = Array.from(document.querySelectorAll('.item'));
items.forEach(el => {
  // ... 1000 iterations
});
```

### 3. Debouncing and Throttling

For frequent operations:

```javascript
// Debounce: Wait for pause in activity
function debounce(fn, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// Usage: Wait 500ms after last keystroke
const debouncedSearch = debounce(
  (query) => execute_javascript({ script: `window.search('${query}')` }),
  500
);

// Throttle: Rate-limit to N times per second
function throttle(fn, limit) {
  let lastRun = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastRun >= limit) {
      fn(...args);
      lastRun = now;
    }
  };
}

// Usage: Update at most 10 times per second
const throttledUpdate = throttle(
  () => find_elements_by_selector({ selector: '.item' }),
  100 // 100ms = 10 times per second
);
```

### 4. Lazy Loading

Load data only when needed:

```javascript
// Don't load all properties
const findResult = await find_elements_by_selector({
  selector: '.item',
  properties: ['id', 'className'] // Minimal set
});

// Later, if needed, fetch full details
const fullDetails = await get_element_properties({
  selector: '.item#123',
  computed: true,
  inherited: true // Full inspection
});
```

### 5. Caching

Cache results of expensive operations:

```javascript
class CommandCache {
  constructor(ttl = 5000) {
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  async execute(key, fn) {
    // Check cache
    if (this.cache.has(key)) {
      const { data, timestamp } = this.cache.get(key);
      if (Date.now() - timestamp < this.ttl) {
        return data; // Return cached
      }
    }
    
    // Execute and cache
    const result = await fn();
    this.cache.set(key, { data: result, timestamp: Date.now() });
    return result;
  }
}

// Usage
const cache = new CommandCache(5000);
const styles = await cache.execute('compute-styles', () =>
  get_computed_styles({ selector: '.header' })
);
```

---

## Timeout and Retry Mechanisms

### 1. Adaptive Timeouts

```javascript
const TIMEOUT_PRESETS = {
  'fast': 1000,           // Quick operations
  'normal': 5000,         // Standard operations
  'slow': 30000,          // Network-dependent
  'veryLow': 100,         // Existence checks
  'extreme': 60000        // Complex operations
};

function getAdaptiveTimeout(command, context) {
  // Adjust based on operation type
  if (command.includes('execute_javascript')) {
    return context.isAsync ? 'slow' : 'normal';
  }
  
  if (command.includes('wait_for')) {
    return 'slow';
  }
  
  if (command.includes('find_')) {
    return context.limit > 100 ? 'slow' : 'normal';
  }
  
  return 'normal';
}
```

### 2. Retry Strategies

**Retryable Errors:**
```javascript
const RETRYABLE_ERRORS = {
  'ELEMENT_NOT_FOUND': {
    maxRetries: 5,
    initialDelay: 100,
    maxDelay: 5000,
    backoff: 'exponential'
  },
  'IFRAME_NOT_LOADED': {
    maxRetries: 10,
    initialDelay: 500,
    maxDelay: 10000,
    backoff: 'exponential'
  },
  'TIMEOUT': {
    maxRetries: 2,
    initialDelay: 1000,
    maxDelay: 5000,
    backoff: 'linear'
  },
  'NETWORK_ERROR': {
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 5000,
    backoff: 'exponential'
  }
};

async function executeWithRetry(command, params) {
  const config = RETRYABLE_ERRORS[command];
  if (!config) {
    return execute(command, params); // No retry
  }
  
  let delay = config.initialDelay;
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    const result = await execute(command, params);
    if (result.success) return result;
    
    if (attempt < config.maxRetries - 1) {
      await sleep(Math.min(delay, config.maxDelay));
      
      if (config.backoff === 'exponential') {
        delay *= 2;
      } else if (config.backoff === 'linear') {
        delay += config.initialDelay;
      }
    }
  }
  
  return result;
}
```

---

## Resource Management

### 1. Memory Management

```javascript
class ResourceManager {
  constructor(maxMemory = 100000000) { // 100MB
    this.resources = new Map();
    this.maxMemory = maxMemory;
    this.currentMemory = 0;
  }
  
  allocate(id, data) {
    const size = JSON.stringify(data).length;
    
    // Check quota
    if (this.currentMemory + size > this.maxMemory) {
      throw { code: 'MEMORY_QUOTA_EXCEEDED' };
    }
    
    this.resources.set(id, { data, size, created: Date.now() });
    this.currentMemory += size;
    
    return { id, size };
  }
  
  release(id) {
    const resource = this.resources.get(id);
    if (resource) {
      this.currentMemory -= resource.size;
      this.resources.delete(id);
    }
  }
  
  cleanup(maxAge = 300000) { // 5 minutes
    const now = Date.now();
    for (const [id, { created, size }] of this.resources) {
      if (now - created > maxAge) {
        this.release(id);
      }
    }
  }
}
```

### 2. Connection Pooling

```javascript
class ConnectionPool {
  constructor(maxConnections = 50) {
    this.maxConnections = maxConnections;
    this.activeConnections = 0;
    this.queue = [];
  }
  
  async acquire() {
    if (this.activeConnections >= this.maxConnections) {
      // Wait for connection to be released
      await new Promise(resolve => this.queue.push(resolve));
    }
    
    this.activeConnections++;
    return {
      release: () => this.release()
    };
  }
  
  release() {
    this.activeConnections--;
    
    const waiting = this.queue.shift();
    if (waiting) {
      this.activeConnections++;
      waiting();
    }
  }
}
```

### 3. Cleanup Strategies

```javascript
class AutoCleanup {
  constructor() {
    this.injections = new Map();
    this.listeners = [];
    this.intervals = [];
  }
  
  trackInjection(id, type, element) {
    this.injections.set(id, { type, element, created: Date.now() });
  }
  
  trackListener(element, event, handler) {
    this.listeners.push({ element, event, handler });
  }
  
  cleanupAll() {
    // Remove injected elements
    for (const { element } of this.injections.values()) {
      element?.remove?.();
    }
    this.injections.clear();
    
    // Remove event listeners
    for (const { element, event, handler } of this.listeners) {
      element.removeEventListener(event, handler);
    }
    this.listeners = [];
    
    // Clear intervals
    this.intervals.forEach(clearInterval);
    this.intervals = [];
  }
  
  onPageUnload() {
    window.addEventListener('beforeunload', () => this.cleanupAll());
  }
}
```

---

## Extended Command Examples

### 1. Complex Form Automation

```javascript
// Automated form filling with validation
async function automateComplexForm(formSelector, formData) {
  const steps = [
    // Step 1: Wait for form
    {
      command: 'wait_for_element',
      selector: formSelector,
      timeout: 10000
    },
    
    // Step 2: Get form structure
    {
      command: 'find_elements_by_selector',
      selector: `${formSelector} input, ${formSelector} select, ${formSelector} textarea`,
      properties: ['type', 'name', 'required', 'disabled']
    },
    
    // Step 3: Validate required fields exist
    {
      command: 'execute_javascript',
      script: `
        const form = document.querySelector('${formSelector}');
        const required = Array.from(form.elements).filter(el => el.required);
        return {
          totalFields: form.elements.length,
          requiredFields: required.length,
          fields: required.map(el => ({ name: el.name, type: el.type }))
        };
      `
    },
    
    // Step 4: Fill form with data
    {
      command: 'batch_modify_elements',
      selector: `${formSelector} input[type='text']`,
      modifications: { value: formData.text || '' }
    },
    
    // Step 5: Handle dropdown
    {
      command: 'set_element_properties',
      selector: `${formSelector} select[name='category']`,
      properties: { value: formData.category }
    },
    
    // Step 6: Set radio button
    {
      command: 'set_element_properties',
      selector: `${formSelector} input[type='radio'][value='${formData.option}']`,
      properties: { checked: true }
    },
    
    // Step 7: Handle dynamic fields that appear
    {
      command: 'wait_for_element',
      selector: `${formSelector} input[name='conditional']`,
      timeout: 3000
    },
    
    // Step 8: Verify form before submit
    {
      command: 'execute_javascript',
      script: `
        const form = document.querySelector('${formSelector}');
        const isValid = form.checkValidity?.() ?? true;
        const data = new FormData(form);
        return {
          isValid,
          formData: Object.fromEntries(data)
        };
      `
    }
  ];
  
  // Execute all steps
  const results = [];
  for (const step of steps) {
    const result = await executeCommand(step);
    results.push(result);
    
    if (!result.success) {
      return { error: step.command, result };
    }
  }
  
  return { success: true, steps: results };
}
```

### 2. Dynamic Content Monitoring

```javascript
// Monitor and react to dynamic content changes
async function monitorDynamicContent(selector, callback) {
  // Setup: Get initial state
  const initial = await find_elements_by_selector({
    selector,
    properties: ['textContent', 'id', 'className']
  });
  
  // Setup: Hook into update function
  const hookResult = await hook_method({
    methodPath: 'window.app.updateContent',
    before: 'console.log("Update triggered");',
    after: `
      window.dispatchEvent(new CustomEvent('contentUpdated', {
        detail: { timestamp: Date.now() }
      }));
    `
  });
  
  // Setup: Monitor custom event
  await inject_script({
    code: `
      window.contentMonitor = setInterval(() => {
        const current = document.querySelectorAll('${selector}');
        const data = Array.from(current).map(el => ({
          id: el.id,
          text: el.textContent,
          hash: hashContent(el.textContent)
        }));
        window.lastCheck = data;
      }, 1000);
      
      function hashContent(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash) + str.charCodeAt(i);
        }
        return hash.toString(36);
      }
    `
  });
  
  // Returns monitoring active
  return {
    id: hookResult.data.hook.id,
    monitoring: true,
    initialCount: initial.data.matches,
    setup: 'complete'
  };
}
```

### 3. API Interception and Mocking

```javascript
// Complex API mocking scenario
async function setupAPIInterception(endpoints) {
  const intercepts = [];
  
  for (const { pattern, mockData, delay, condition } of endpoints) {
    // Setup: Intercept request
    const intercept = await intercept_request({
      pattern,
      methods: ['GET', 'POST'],
      action: 'log',
      id: `api-mock-${pattern}`
    });
    intercepts.push(intercept.data.intercept);
    
    // Setup: Conditional mocking
    if (condition) {
      await inject_script({
        code: `
          const originalFetch = window.fetch;
          window.fetch = async function(...args) {
            const url = args[0];
            if (${condition}) {
              await new Promise(r => setTimeout(r, ${delay}));
              return new Response(JSON.stringify(${JSON.stringify(mockData)}), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            return originalFetch(...args);
          };
        `
      });
    }
    
    // Setup: Mock response
    await mock_response({
      interceptId: `api-mock-${pattern}`,
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockData),
      delay
    });
  }
  
  return {
    active: true,
    intercepts: intercepts.length,
    list: intercepts
  };
}
```

---

## Common Pitfalls and Solutions

### Pitfall 1: Timing Issues

**Problem**: Command executes before page element is ready

**Solution**: Always wait first
```javascript
// Bad:
await click({ selector: '.button' }); // Might fail if button not ready

// Good:
await wait_for_element({ selector: '.button', timeout: 5000 });
await click({ selector: '.button' });
```

### Pitfall 2: Non-Deterministic Selectors

**Problem**: Selector matches multiple elements, behavior varies

**Solution**: Use specific selectors
```javascript
// Bad:
await click({ selector: '.btn' }); // Which button?

// Good:
await click({ selector: '#submit-btn' }); // Specific element
// OR verify match count
const matches = await find_elements_by_selector({
  selector: '.btn',
  visible: true
});
if (matches.data.matches !== 1) {
  throw new Error('Selector not unique');
}
```

### Pitfall 3: Non-Serializable Data

**Problem**: JavaScript function returns non-JSON value

**Solution**: Convert to serializable format
```javascript
// Bad:
await execute_javascript({
  script: 'return document.querySelector(".item");' // Returns DOM element
});

// Good:
await execute_javascript({
  script: `
    const el = document.querySelector('.item');
    return {
      tag: el.tagName,
      id: el.id,
      text: el.textContent,
      html: el.outerHTML
    };
  `
});
```

### Pitfall 4: Same-Origin Violations

**Problem**: Trying to access cross-origin iframe content

**Solution**: Check origin before access
```javascript
// Bad:
await access_iframe({
  selector: 'iframe[src="https://other-domain.com/page"]'
});

// Good:
// Only access same-origin iframes
await access_iframe({
  selector: 'iframe[src="/internal/page"]'
});
```

### Pitfall 5: Memory Leaks from Injections

**Problem**: Injected scripts accumulate memory

**Solution**: Clean up injections
```javascript
// Track injection IDs
const injections = [];

// Inject and track
const inject = await inject_script({ code: '...' });
injections.push(inject.data.script.id);

// Later: cleanup
for (const id of injections) {
  await remove_injected_script({ id });
}
```

---

## Compliance and Audit Logging

### 1. GDPR Compliance

```javascript
class GDPRCompliance {
  // Ensure sensitive data isn't logged
  sanitizeForAudit(data) {
    const sensitiveFields = ['password', 'email', 'ssn', 'token', 'key'];
    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  // Track consent for data access
  requireConsent(dataType) {
    const consents = {
      'localStorage': 'storage_access',
      'sessionStorage': 'storage_access',
      'IndexedDB': 'storage_access',
      'networkMonitoring': 'network_monitoring'
    };
    
    const required = consents[dataType];
    if (!this.hasConsent(required)) {
      throw {
        code: 'CONSENT_REQUIRED',
        message: `User consent required for ${dataType}`
      };
    }
  }
  
  hasConsent(type) {
    // Check if user has given consent for operation
    return window.userConsent?.[type] === true;
  }
}
```

### 2. Comprehensive Audit Log

```javascript
class AuditLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 10000;
  }
  
  log(entry) {
    const fullEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      userId: getCurrentUser(),
      sessionId: getSessionId(),
      ...entry,
      // Metadata
      userAgent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer
    };
    
    this.logs.push(fullEntry);
    
    // Maintain size limit
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Write to server
    this.flushToServer(fullEntry);
  }
  
  flushToServer(entry) {
    navigator.sendBeacon('/api/audit', JSON.stringify(entry));
  }
  
  export() {
    return {
      format: 'JSON',
      logCount: this.logs.length,
      data: this.logs,
      exportDate: new Date().toISOString()
    };
  }
}
```

### 3. Risk Assessment

```javascript
function assessCommandRisk(command, params) {
  const riskScores = {
    'execute_javascript': 9,        // High risk
    'inject_script': 8,             // High risk
    'modify_prototype': 8,          // High risk
    'set_element_properties': 5,    // Medium risk
    'set_localstorage': 4,          // Medium risk
    'get_element_properties': 1,    // Low risk
    'find_elements_by_selector': 1, // Low risk
  };
  
  const baseRisk = riskScores[command] || 3;
  
  // Increase risk based on params
  let risk = baseRisk;
  
  if (params.unsafe) risk += 2;
  if (params.script?.includes('eval')) risk += 3;
  if (params.selector?.includes('*')) risk -= 1; // More specific
  
  return {
    score: Math.min(10, Math.max(1, risk)),
    level: risk < 3 ? 'LOW' : risk < 6 ? 'MEDIUM' : 'HIGH',
    shouldAlert: risk >= 7,
    requiresApproval: risk >= 8
  };
}
```

---

## Implementation Checklist

For each Phase 2 command, ensure:

- [ ] Input validation on all parameters
- [ ] Error code consistent with taxonomy
- [ ] Performance expectations documented
- [ ] Security considerations addressed
- [ ] Timeout handling implemented
- [ ] Retry logic for transient failures
- [ ] Audit logging enabled
- [ ] Resource cleanup in error paths
- [ ] Unit tests (>95% coverage)
- [ ] Integration tests with real DOM
- [ ] Performance benchmarks
- [ ] Documentation with examples
- [ ] Cross-browser testing
- [ ] Accessibility testing (where applicable)

---

## Version History

**v1.0** (June 20, 2026) - Advanced specifications
- Comprehensive error handling guide
- Security patterns and validations
- Performance optimization techniques
- Extended examples and workflows

