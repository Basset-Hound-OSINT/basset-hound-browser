# Phase 2 Command Specifications: Complete WebSocket API Reference

**Version**: 1.0  
**Status**: Detailed API Specification  
**Date**: June 20, 2026  
**Total Commands**: 68

---

## Overview

This document provides complete specifications for all 68 Phase 2 WebSocket commands, organized by feature area.

---

## AREA 3: Lower-Level Interaction (28 Commands)

### Direct DOM Access (7 Commands)

#### 1. GET_ELEMENT_PROPERTY

Get a property value from a DOM element.

**Command**: `get_element_property`

**Parameters**:
```javascript
{
  "selector": "string",           // CSS selector for element
  "propertyName": "string",       // Property name (e.g., 'innerHTML', 'textContent')
  "computed": "boolean?"          // If true, get computed value
}
```

**Response**:
```javascript
{
  "success": true,
  "propertyName": "string",       // The property requested
  "value": "any",                 // Property value (type depends on property)
  "type": "string",               // Value type: "string", "number", "boolean", "object"
  "writable": boolean,            // Is property writable?
  "enumerable": boolean,          // Is property enumerable?
  "timestamp": "ISO8601"
}
```

**Error Cases**:
- Element not found: `{ success: false, error: "Element not found", errorCode: "E_ELEMENT_NOT_FOUND" }`
- Invalid property: `{ success: false, error: "Property not accessible", errorCode: "E_PROPERTY_NOT_ACCESSIBLE" }`
- Permission denied: `{ success: false, error: "Access denied", errorCode: "E_PERMISSION_DENIED" }`

**Performance Target**: < 50ms (p95)

**Examples**:
```javascript
// Get element HTML
{ "id": 1, "command": "get_element_property", "selector": "#main", "propertyName": "innerHTML" }
// Response: { "success": true, "propertyName": "innerHTML", "value": "<p>Content</p>", "type": "string" }

// Get element tag name
{ "id": 2, "command": "get_element_property", "selector": "button.primary", "propertyName": "tagName" }
// Response: { "success": true, "propertyName": "tagName", "value": "BUTTON", "type": "string" }
```

---

#### 2. SET_ELEMENT_PROPERTY

Set a property value on a DOM element.

**Command**: `set_element_property`

**Parameters**:
```javascript
{
  "selector": "string",           // CSS selector for element
  "propertyName": "string",       // Property name
  "value": "any",                 // New value
  "createIfMissing": "boolean?"   // Create property if it doesn't exist
}
```

**Response**:
```javascript
{
  "success": true,
  "propertyName": "string",
  "previousValue": "any",         // Previous value (for rollback)
  "newValue": "any",
  "changed": boolean,             // Was value actually changed?
  "timestamp": "ISO8601"
}
```

**Error Cases**:
- Element not found
- Property read-only
- Invalid value type

**Performance Target**: < 50ms (p95)

---

#### 3. GET_COMPUTED_STYLES

Get computed CSS styles for one or more elements.

**Command**: `get_computed_styles`

**Parameters**:
```javascript
{
  "selector": "string",           // CSS selector (can match multiple)
  "properties": ["string?"],      // Optional: specific properties to get
  "pseudoElement": "string?"      // Optional: "::before", "::after", etc.
}
```

**Response**:
```javascript
{
  "success": true,
  "styles": {
    "elementId-1": {
      "propertyName": "value",
      "propertyName2": "value2"
    },
    "elementId-2": { ... }
  },
  "count": number,                // Number of elements matched
  "timestamp": "ISO8601"
}
```

**Performance Target**: < 100ms (p95)

---

#### 4. GET_COMPUTED_STYLE

Get a single computed CSS property for an element.

**Command**: `get_computed_style`

**Parameters**:
```javascript
{
  "selector": "string",
  "property": "string",           // CSS property name
  "pseudoElement": "string?"
}
```

**Response**:
```javascript
{
  "success": true,
  "property": "string",
  "value": "string",              // Computed value (e.g., "rgb(255, 0, 0)")
  "computed": "string",           // Final computed value
  "important": boolean,           // Is !important flag set?
  "timestamp": "ISO8601"
}
```

---

#### 5. GET_SHADOW_DOM

Access shadow DOM tree structure.

**Command**: `get_shadow_dom`

**Parameters**:
```javascript
{
  "selector": "string",           // Host element selector
  "maxDepth": "number?"           // Max nesting depth (default: 50)
}
```

**Response**:
```javascript
{
  "success": true,
  "shadowRoot": {
    "mode": "open" | "closed",
    "host": "selector",
    "children": [
      {
        "tagName": "string",
        "id": "string?",
        "classes": ["string"],
        "children": [ ... ]
      }
    ]
  },
  "slots": [
    {
      "name": "string",
      "assignedNodes": ["string"]
    }
  ],
  "timestamp": "ISO8601"
}
```

---

#### 6. GET_IFRAME_CONTENT

Access content within iframe elements.

**Command**: `get_iframe_content`

**Parameters**:
```javascript
{
  "selector": "string",           // iframe selector
  "query": "string?",             // Optional: CSS selector within frame
  "includeHTML": "boolean?"       // Include full HTML (default: true)
}
```

**Response**:
```javascript
{
  "success": true,
  "iframe": {
    "selector": "string",
    "src": "string",
    "sandbox": ["string"],
    "origin": "string"
  },
  "html": "string?",              // Frame HTML (if requested)
  "styles": ["string"],           // External stylesheets
  "scripts": ["string"],          // External scripts
  "framesNested": number,         // Number of nested frames
  "queryResults": [ ... ]?        // Results of optional query
}
```

---

#### 7. GET_ELEMENT_PATH

Get the CSS selector path to an element from the root.

**Command**: `get_element_path`

**Parameters**:
```javascript
{
  "selector": "string",
  "format": "string?"             // "css" | "xpath" (default: "css")
}
```

**Response**:
```javascript
{
  "success": true,
  "path": "string",               // "html>body>div.main>p#text"
  "format": "string",
  "depth": number,                // Nesting depth
  "ancestors": [
    {
      "tagName": "string",
      "id": "string?",
      "classes": ["string"]
    }
  ],
  "timestamp": "ISO8601"
}
```

---

### JavaScript Execution Context (7 Commands)

#### 8. EVAL_JAVASCRIPT

Evaluate a JavaScript expression.

**Command**: `eval_javascript`

**Parameters**:
```javascript
{
  "script": "string",             // JavaScript code to execute
  "timeout": "number?",           // Timeout in ms (default: 30000)
  "returnType": "string?"         // "json" | "string" | "any" (default: "json")
}
```

**Response**:
```javascript
{
  "success": true,
  "result": "any",                // Result of evaluation
  "type": "string",               // Type of result
  "executionTime": number,        // Time in ms
  "error": null,                  // null if no error
  "timestamp": "ISO8601"
}
```

**Error Cases**:
```javascript
{
  "success": false,
  "error": "string",              // Error message
  "errorType": "SyntaxError" | "ReferenceError" | "TypeError" | ...,
  "stack": "string?",             // Error stack trace
  "executionTime": number
}
```

**Performance Target**: < 200ms (p95)

**Examples**:
```javascript
// Evaluate expression
{ "id": 1, "command": "eval_javascript", "script": "document.querySelectorAll('a').length" }

// Set variable and evaluate
{ "id": 2, "command": "eval_javascript", "script": "window.test = 123; window.test * 2" }
```

---

#### 9. CALL_FUNCTION

Call a global JavaScript function.

**Command**: `call_function`

**Parameters**:
```javascript
{
  "functionName": "string",       // Function name in window scope
  "arguments": ["any?"],          // Arguments to pass
  "timeout": "number?"
}
```

**Response**:
```javascript
{
  "success": true,
  "functionName": "string",
  "arguments": ["any"],           // Arguments passed
  "result": "any",
  "returnType": "string",
  "executionTime": number,
  "timestamp": "ISO8601"
}
```

---

#### 10. GET_GLOBAL_VARIABLE

Access a global JavaScript variable.

**Command**: `get_global_variable`

**Parameters**:
```javascript
{
  "variableName": "string"        // Variable name in window scope
}
```

**Response**:
```javascript
{
  "success": true,
  "name": "string",
  "value": "any",                 // Variable value
  "type": "string",               // Type: "undefined", "object", "function", etc.
  "writable": boolean,
  "enumerable": boolean,
  "timestamp": "ISO8601"
}
```

---

#### 11. SET_GLOBAL_VARIABLE

Set a global JavaScript variable.

**Command**: `set_global_variable`

**Parameters**:
```javascript
{
  "variableName": "string",
  "value": "any"
}
```

**Response**:
```javascript
{
  "success": true,
  "variableName": "string",
  "previousValue": "any",
  "value": "any",
  "timestamp": "ISO8601"
}
```

---

#### 12. EXECUTE_WITH_CONTEXT

Execute code in a specific context/scope.

**Command**: `execute_with_context`

**Parameters**:
```javascript
{
  "functionCode": "string",       // Function body code
  "context": {                    // Context variables
    "variableName": "any"
  },
  "arguments": ["any?"]           // Arguments to pass as $0, $1, etc.
}
```

**Response**:
```javascript
{
  "success": true,
  "result": "any",
  "context": {},                  // Context state after execution
  "executionTime": number,
  "timestamp": "ISO8601"
}
```

---

#### 13. CALL_BROWSER_API

Call a browser API method safely.

**Command**: `call_browser_api`

**Parameters**:
```javascript
{
  "apiName": "string",            // e.g., "fetch", "localStorage", "navigator"
  "method": "string?",            // Method name if API is object
  "arguments": ["any?"]
}
```

**Response**:
```javascript
{
  "success": true,
  "apiName": "string",
  "method": "string?",
  "result": "any",
  "timestamp": "ISO8601"
}
```

---

#### 14. CHECK_JAVASCRIPT_SYNTAX

Validate JavaScript code syntax.

**Command**: `check_javascript_syntax`

**Parameters**:
```javascript
{
  "script": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "valid": boolean,
  "errors": [
    {
      "message": "string",
      "line": number,
      "column": number
    }
  ],
  "warnings": [
    {
      "message": "string",
      "type": "string"
    }
  ],
  "timestamp": "ISO8601"
}
```

---

### Network-Level Control (8 Commands)

#### 15. GET_PENDING_REQUESTS

Get list of pending network requests.

**Command**: `get_pending_requests`

**Parameters**:
```javascript
{
  "filter": {
    "urlPattern": "string?",      // URL pattern to match
    "method": "string?",          // HTTP method (GET, POST, etc.)
    "resourceType": "string?"     // fetch, xhr, image, etc.
  }
}
```

**Response**:
```javascript
{
  "success": true,
  "requests": [
    {
      "id": "string",
      "url": "string",
      "method": "string",
      "resourceType": "string",
      "status": number,
      "timestamp": "ISO8601"
    }
  ],
  "count": number,
  "timestamp": "ISO8601"
}
```

**Performance Target**: < 50ms (p95)

---

#### 16. GET_REQUEST_DETAILS

Get detailed information about a specific request.

**Command**: `get_request_details`

**Parameters**:
```javascript
{
  "requestId": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "requestId": "string",
  "url": "string",
  "method": "string",
  "headers": {
    "headerName": "string"
  },
  "postData": "string?",          // Request body
  "responseHeaders": {
    "headerName": "string"
  },
  "responseStatus": number,
  "responseSize": number,
  "timing": {
    "startTime": number,
    "endTime": number,
    "duration": number
  }
}
```

---

#### 17. MODIFY_REQUEST

Modify a request before it's sent.

**Command**: `modify_request`

**Parameters**:
```javascript
{
  "requestId": "string",
  "modifications": {
    "headers": {
      "headerName": "string"
    }?,
    "postData": "string"?,
    "url": "string"?
  }
}
```

**Response**:
```javascript
{
  "success": true,
  "requestId": "string",
  "modifiedHeaders": {
    "headerName": "string"
  },
  "timestamp": "ISO8601"
}
```

---

#### 18. MOCK_REQUEST_RESPONSE

Mock a response for a network request.

**Command**: `mock_request_response`

**Parameters**:
```javascript
{
  "requestId": "string",
  "responseData": {
    "status": "number?",          // HTTP status (default: 200)
    "headers": "object?",
    "body": "string"              // Response body
  }
}
```

**Response**:
```javascript
{
  "success": true,
  "requestId": "string",
  "mockedAt": "ISO8601"
}
```

---

#### 19. GET_RESPONSE_BODY

Get the response body for a completed request.

**Command**: `get_response_body`

**Parameters**:
```javascript
{
  "requestId": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "requestId": "string",
  "body": "string",               // Response body
  "encoding": "string",           // "utf-8", "gzip", etc.
  "mimeType": "string",           // Content type
  "size": number,                 // Size in bytes
  "timestamp": "ISO8601"
}
```

---

#### 20. SET_REQUEST_INTERCEPTION

Set up request interception by URL pattern.

**Command**: `set_request_interception`

**Parameters**:
```javascript
{
  "urlPattern": "string",         // URL pattern (regex or wildcard)
  "action": "string",             // "intercept", "block", "mock", "log"
  "options": {
    "modifyHeaders": "object?"?,
    "mockResponse": "object?"?
  }
}
```

**Response**:
```javascript
{
  "success": true,
  "patternId": "string",
  "pattern": "string",
  "interceptingAt": "ISO8601"
}
```

---

#### 21. GET_NETWORK_STATS

Get network statistics and metrics.

**Command**: `get_network_stats`

**Parameters**:
```javascript
{
  "startTime": "ISO8601?",
  "endTime": "ISO8601?"
}
```

**Response**:
```javascript
{
  "success": true,
  "totalRequests": number,
  "totalSize": number,            // In bytes
  "avgLatency": number,           // In ms
  "byType": {
    "fetch": { count: number, size: number },
    "xhr": { count: number, size: number },
    "image": { count: number, size: number }
  },
  "byCacheStatus": {
    "cached": number,
    "network": number
  },
  "byStatusCode": {
    "200": number,
    "404": number
  },
  "timestamp": "ISO8601"
}
```

---

#### 22. REPLAY_REQUEST

Replay a network request with optional modifications.

**Command**: `replay_request`

**Parameters**:
```javascript
{
  "requestId": "string",
  "modifications": {
    "headers": "object?"?,
    "postData": "string?"?,
    "timeout": "number?"?
  }
}
```

**Response**:
```javascript
{
  "success": true,
  "requestId": "string",
  "responseBody": "string",
  "statusCode": number,
  "headers": {},
  "latency": number,              // Response time in ms
  "timestamp": "ISO8601"
}
```

---

### Storage Access (7 Commands)

#### 23. GET_LOCALSTORAGE

Get localStorage data.

**Command**: `get_localstorage`

**Parameters**:
```javascript
{
  "keyPattern": "string?"         // Optional pattern to filter keys
}
```

**Response**:
```javascript
{
  "success": true,
  "items": {
    "key": "value"
  },
  "count": number,
  "timestamp": "ISO8601"
}
```

**Performance Target**: < 75ms (p95)

---

#### 24. SET_LOCALSTORAGE

Set a localStorage item.

**Command**: `set_localstorage`

**Parameters**:
```javascript
{
  "key": "string",
  "value": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "key": "string",
  "previousValue": "string?",
  "value": "string",
  "timestamp": "ISO8601"
}
```

---

#### 25. DELETE_LOCALSTORAGE

Delete a localStorage item.

**Command**: `delete_localstorage`

**Parameters**:
```javascript
{
  "key": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "key": "string",
  "wasPresent": boolean,
  "timestamp": "ISO8601"
}
```

---

#### 26. GET_SESSIONSTORAGE

Get sessionStorage data.

**Command**: `get_sessionstorage`

**Parameters**:
```javascript
{
  "keyPattern": "string?"
}
```

**Response**:
```javascript
{
  "success": true,
  "items": {
    "key": "value"
  },
  "count": number,
  "timestamp": "ISO8601"
}
```

---

#### 27. ACCESS_INDEXEDDB

Access IndexedDB data.

**Command**: `access_indexeddb`

**Parameters**:
```javascript
{
  "dbName": "string",
  "objectStore": "string",
  "query": {
    "keyRange": "any?"?,
    "direction": "next" | "prev"?,
    "limit": "number?"?
  }
}
```

**Response**:
```javascript
{
  "success": true,
  "dbName": "string",
  "objectStore": "string",
  "objects": [
    {
      "key": "any",
      "value": "object"
    }
  ],
  "count": number,
  "indexedAt": "ISO8601"
}
```

---

#### 28. GET_INDEXEDDB_METADATA

Get metadata about IndexedDB databases.

**Command**: `get_indexeddb_metadata`

**Parameters**:
```javascript
{
  "dbName": "string?"             // Optional specific database
}
```

**Response**:
```javascript
{
  "success": true,
  "databases": [
    {
      "dbName": "string",
      "version": number,
      "objectStores": [
        {
          "name": "string",
          "keyPath": "string",
          "indexes": ["string"]
        }
      ]
    }
  ],
  "timestamp": "ISO8601"
}
```

---

#### 29. ACCESS_CACHE_API

Access Cache API (service worker cache).

**Command**: `access_cache_api`

**Parameters**:
```javascript
{
  "cacheName": "string?",         // Specific cache name
  "query": {
    "urlPattern": "string?"?,
    "limit": "number?"?
  }
}
```

**Response**:
```javascript
{
  "success": true,
  "caches": [
    {
      "name": "string",
      "entries": [
        {
          "url": "string",
          "response": "string"      // Abbreviated response
        }
      ]
    }
  ],
  "count": number,
  "cacheAt": "ISO8601"
}
```

---

### DevTools Protocol Access (7 Commands)

#### 30. GET_DEVTOOLS_SESSION

Get current DevTools session information.

**Command**: `get_devtools_session`

**Response**:
```javascript
{
  "success": true,
  "sessionId": "string",
  "connected": boolean,
  "protocolVersion": "string",
  "features": [
    "Debugger",
    "Runtime",
    "Performance"
  ],
  "timestamp": "ISO8601"
}
```

---

#### 31. ENABLE_DEVTOOLS_DOMAIN

Enable a Chrome DevTools Protocol domain.

**Command**: `enable_devtools_domain`

**Parameters**:
```javascript
{
  "domain": "string"              // "Runtime", "Debugger", "Performance", etc.
}
```

**Response**:
```javascript
{
  "success": true,
  "domain": "string",
  "enabled": boolean,
  "methods": ["string"],          // Available methods in domain
  "timestamp": "ISO8601"
}
```

---

#### 32. GET_PERFORMANCE_METRICS

Get performance metrics from the page.

**Command**: `get_performance_metrics`

**Response**:
```javascript
{
  "success": true,
  "metrics": [
    {
      "name": "LayoutCount",
      "value": number
    },
    {
      "name": "RecalcStyleCount",
      "value": number
    }
  ],
  "timestamp": "ISO8601"
}
```

---

#### 33. SET_BREAKPOINT

Set a JavaScript breakpoint.

**Command**: `set_breakpoint`

**Parameters**:
```javascript
{
  "scriptId": "string",           // Script ID from DevTools
  "lineNumber": number,
  "columnNumber": "number?",
  "condition": "string?"          // Optional breakpoint condition
}
```

**Response**:
```javascript
{
  "success": true,
  "breakpointId": "string",
  "location": {
    "scriptId": "string",
    "lineNumber": number,
    "columnNumber": number
  },
  "timestamp": "ISO8601"
}
```

---

#### 34. GET_MEMORY_INFO

Get memory usage information.

**Command**: `get_memory_info`

**Response**:
```javascript
{
  "success": true,
  "usedJSHeapSize": number,       // In bytes
  "totalJSHeapSize": number,
  "jsHeapSizeLimit": number,
  "externalAllocatedSize": number,
  "timestamp": "ISO8601"
}
```

---

#### 35. GET_CPU_PROFILE

Get CPU profile information.

**Command**: `get_cpu_profile`

**Parameters**:
```javascript
{
  "duration": "number?"           // Duration in ms (default: 1000)
}
```

**Response**:
```javascript
{
  "success": true,
  "profile": {
    "nodes": [
      {
        "id": number,
        "callFrame": {
          "functionName": "string",
          "scriptId": "string",
          "lineNumber": number
        },
        "hitCount": number
      }
    ]
  },
  "duration": number,
  "timestamp": "ISO8601"
}
```

---

#### 36. START_PERFORMANCE_TRACE

Start a performance trace.

**Command**: `start_performance_trace`

**Parameters**:
```javascript
{
  "categories": ["string?"]?      // Trace categories (default: all)
}
```

**Response**:
```javascript
{
  "success": true,
  "sessionId": "string",
  "tracingAt": "ISO8601"
}
```

---

## AREA 2: Content Injection & Modification (25 Commands)

### CSS Injection (8 Commands)

#### 37. INJECT_CSS

Inject CSS from a string.

**Command**: `inject_css`

**Parameters**:
```javascript
{
  "cssText": "string",            // CSS code
  "id": "string?",                // Optional identifier
  "media": "string?"              // Optional media query
}
```

**Response**:
```javascript
{
  "success": true,
  "styleId": "string",
  "cssSize": number,              // In bytes
  "appliedAt": "ISO8601"
}
```

**Performance Target**: < 100ms (p95)

---

#### 38. INJECT_CSS_URL

Inject CSS from a URL.

**Command**: `inject_css_url`

**Parameters**:
```javascript
{
  "url": "string",
  "id": "string?",
  "integrity": "string?"
}
```

**Response**:
```javascript
{
  "success": true,
  "styleId": "string",
  "url": "string",
  "loadedAt": "ISO8601"
}
```

---

#### 39. CREATE_STYLESHEET

Create and adopt a stylesheet.

**Command**: `create_stylesheet`

**Parameters**:
```javascript
{
  "cssText": "string",
  "href": "string?"
}
```

**Response**:
```javascript
{
  "success": true,
  "styleId": "string",
  "href": "string",
  "cssText": "string",
  "timestamp": "ISO8601"
}
```

---

#### 40. MODIFY_STYLE_RULE

Modify a style rule.

**Command**: `modify_style_rule`

**Parameters**:
```javascript
{
  "styleId": "string",
  "ruleIndex": number,
  "cssText": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "styleId": "string",
  "ruleIndex": number,
  "newRule": "string",
  "timestamp": "ISO8601"
}
```

---

#### 41. REMOVE_INJECTED_CSS

Remove injected CSS.

**Command**: `remove_injected_css`

**Parameters**:
```javascript
{
  "styleId": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "styleId": "string",
  "removedAt": "ISO8601"
}
```

---

#### 42. APPLY_ANIMATION

Apply a CSS animation.

**Command**: `apply_animation`

**Parameters**:
```javascript
{
  "selector": "string",
  "keyframes": "string",          // CSS keyframes code
  "duration": number,             // Duration in ms
  "iterationCount": "number?"?,
  "timingFunction": "string?"?    // ease, linear, etc.
}
```

**Response**:
```javascript
{
  "success": true,
  "animationId": "string",
  "selector": "string",
  "duration": number,
  "appliedElements": number,
  "timestamp": "ISO8601"
}
```

---

#### 43. INJECT_THEME

Inject a color theme.

**Command**: `inject_theme`

**Parameters**:
```javascript
{
  "themeName": "string",
  "colorScheme": {
    "primary": "string",          // Color hex codes
    "secondary": "string",
    "text": "string",
    "background": "string"
  }
}
```

**Response**:
```javascript
{
  "success": true,
  "themeId": "string",
  "colors": {
    "primary": "string",
    "secondary": "string"
  },
  "appliedAt": "ISO8601"
}
```

---

#### 44. GET_STYLESHEETS

Get information about all stylesheets.

**Command**: `get_stylesheets`

**Response**:
```javascript
{
  "success": true,
  "stylesheets": [
    {
      "href": "string?",
      "size": number,
      "rules": number,
      "disabled": boolean,
      "media": "string?"
    }
  ],
  "count": number,
  "timestamp": "ISO8601"
}
```

---

### JavaScript Injection (8 Commands)

#### 45. INJECT_SCRIPT

Inject JavaScript from a string.

**Command**: `inject_script`

**Parameters**:
```javascript
{
  "code": "string",
  "id": "string?",
  "async": "boolean?"?,
  "defer": "boolean?"?
}
```

**Response**:
```javascript
{
  "success": true,
  "scriptId": "string",
  "scriptSize": number,
  "executedAt": "ISO8601"
}
```

**Performance Target**: < 150ms (p95)

---

#### 46. INJECT_SCRIPT_URL

Inject JavaScript from a URL.

**Command**: `inject_script_url`

**Parameters**:
```javascript
{
  "url": "string",
  "id": "string?",
  "integrity": "string?"
}
```

**Response**:
```javascript
{
  "success": true,
  "scriptId": "string",
  "url": "string",
  "loadedAt": "ISO8601"
}
```

---

#### 47. EXECUTE_IMMEDIATE

Execute code immediately in page context.

**Command**: `execute_immediate`

**Parameters**:
```javascript
{
  "code": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "result": "any",
  "executedAt": "ISO8601"
}
```

---

#### 48. CREATE_PERSISTENT_SCRIPT

Create a script that persists across navigation.

**Command**: `create_persistent_script`

**Parameters**:
```javascript
{
  "code": "string",
  "name": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "scriptId": "string",
  "name": "string",
  "persistent": boolean,
  "timestamp": "ISO8601"
}
```

---

#### 49. REMOVE_INJECTED_SCRIPT

Remove an injected script.

**Command**: `remove_injected_script`

**Parameters**:
```javascript
{
  "scriptId": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "scriptId": "string",
  "removedAt": "ISO8601"
}
```

---

#### 50. MONKEY_PATCH

Replace a function with a custom implementation.

**Command**: `monkey_patch`

**Parameters**:
```javascript
{
  "objectPath": "string",         // e.g., "window.fetch", "XMLHttpRequest.open"
  "functionName": "string?",      // If object.method pattern
  "replacement": "string"         // Replacement function code
}
```

**Response**:
```javascript
{
  "success": true,
  "scriptId": "string",
  "objectPath": "string",
  "patched": boolean,
  "timestamp": "ISO8601"
}
```

---

#### 51. HOOK_FUNCTION

Hook a function to capture calls.

**Command**: `hook_function`

**Parameters**:
```javascript
{
  "functionPath": "string",       // e.g., "window.fetch"
  "onEnter": "string?",           // Function code called before
  "onExit": "string?"             // Function code called after
}
```

**Response**:
```javascript
{
  "success": true,
  "hookId": "string",
  "functionPath": "string",
  "captures": []                  // Captured calls
}
```

---

#### 52. GET_INJECTED_SCRIPTS

Get list of injected scripts.

**Command**: `get_injected_scripts`

**Response**:
```javascript
{
  "success": true,
  "scripts": [
    {
      "id": "string",
      "name": "string",
      "size": number,
      "timestamp": "ISO8601"
    }
  ],
  "count": number
}
```

---

### DOM Manipulation (13 Commands)

#### 53. CREATE_ELEMENT

Create a new DOM element.

**Command**: `create_element`

**Parameters**:
```javascript
{
  "tagName": "string",
  "attributes": {
    "attr-name": "string"
  }?,
  "content": "string"?,           // textContent or innerHTML
  "appendTo": "string?"           // Optional parent selector
}
```

**Response**:
```javascript
{
  "success": true,
  "elementId": "string",          // Generated ID for reference
  "selector": "string",           // CSS selector to find element
  "timestamp": "ISO8601"
}
```

**Performance Target**: < 50ms (p95)

---

#### 54. CLONE_ELEMENT

Clone an element.

**Command**: `clone_element`

**Parameters**:
```javascript
{
  "selector": "string",
  "deep": "boolean?"              // Deep or shallow clone (default: true)
}
```

**Response**:
```javascript
{
  "success": true,
  "elementId": "string",
  "cloneOf": "string",            // Original selector
  "timestamp": "ISO8601"
}
```

---

#### 55. DELETE_ELEMENT

Delete an element.

**Command**: `delete_element`

**Parameters**:
```javascript
{
  "selector": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "elementId": "string",
  "parentRemaining": number,      // Remaining children in parent
  "timestamp": "ISO8601"
}
```

---

#### 56. MODIFY_ATTRIBUTES

Modify element attributes.

**Command**: `modify_attributes`

**Parameters**:
```javascript
{
  "selector": "string",
  "attributes": {
    "attr-name": "string?"        // null to remove attribute
  }
}
```

**Response**:
```javascript
{
  "success": true,
  "elementId": "string",
  "modified": {
    "attr-name": "previous-value"
  },
  "timestamp": "ISO8601"
}
```

---

#### 57. SET_ELEMENT_CONTENT

Set element content (text or HTML).

**Command**: `set_element_content`

**Parameters**:
```javascript
{
  "selector": "string",
  "content": "string",
  "type": "text" | "html"         // textContent vs innerHTML (default: text)
}
```

**Response**:
```javascript
{
  "success": true,
  "elementId": "string",
  "contentType": "string",
  "timestamp": "ISO8601"
}
```

---

#### 58. APPEND_CHILD

Append a child element.

**Command**: `append_child`

**Parameters**:
```javascript
{
  "parentSelector": "string",
  "childSelector": "string"       // Existing element to move, or new element
}
```

**Response**:
```javascript
{
  "success": true,
  "parentId": "string",
  "childId": "string",
  "newIndex": number,             // Index in parent's children
  "timestamp": "ISO8601"
}
```

---

#### 59. INSERT_BEFORE

Insert element before reference.

**Command**: `insert_before`

**Parameters**:
```javascript
{
  "referenceSelector": "string",
  "elementSelector": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "elementId": "string",
  "beforeId": "string",
  "newIndex": number,
  "timestamp": "ISO8601"
}
```

---

#### 60. REPLACE_ELEMENT

Replace one element with another.

**Command**: `replace_element`

**Parameters**:
```javascript
{
  "oldSelector": "string",
  "newSelector": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "replacedId": "string",
  "newElementId": "string",
  "timestamp": "ISO8601"
}
```

---

#### 61. GET_ELEMENT_CHILDREN

Get element's children.

**Command**: `get_element_children`

**Parameters**:
```javascript
{
  "selector": "string"
}
```

**Response**:
```javascript
{
  "success": true,
  "children": [
    {
      "tagName": "string",
      "id": "string?",
      "classes": ["string"],
      "textContent": "string?"
    }
  ],
  "count": number,
  "timestamp": "ISO8601"
}
```

---

#### 62. BATCH_CREATE_ELEMENTS

Create multiple elements at once.

**Command**: `batch_create_elements`

**Parameters**:
```javascript
{
  "definitions": [
    {
      "tagName": "string",
      "attributes": "object"?,
      "content": "string"?
    }
  ]
}
```

**Response**:
```javascript
{
  "success": true,
  "created": [
    {
      "elementId": "string",
      "selector": "string"
    }
  ],
  "count": number,
  "timestamp": "ISO8601"
}
```

---

#### 63. BATCH_MODIFY_ATTRIBUTES

Modify attributes on multiple elements.

**Command**: `batch_modify_attributes`

**Parameters**:
```javascript
{
  "modifications": [
    {
      "selector": "string",
      "attributes": "object"
    }
  ]
}
```

**Response**:
```javascript
{
  "success": true,
  "modified": [
    {
      "elementId": "string",
      "attributes": "object"
    }
  ],
  "count": number,
  "timestamp": "ISO8601"
}
```

---

#### 64. BATCH_DELETE_ELEMENTS

Delete multiple elements.

**Command**: `batch_delete_elements`

**Parameters**:
```javascript
{
  "selectors": ["string"]
}
```

**Response**:
```javascript
{
  "success": true,
  "deleted": ["string"],          // Deleted element IDs
  "count": number,
  "timestamp": "ISO8601"
}
```

---

#### 65. WRAP_ELEMENT

Wrap an element in another.

**Command**: `wrap_element`

**Parameters**:
```javascript
{
  "selector": "string",
  "wrapperElement": "string"      // HTML of wrapper
}
```

**Response**:
```javascript
{
  "success": true,
  "elementId": "string",
  "wrappedBy": "string",          // Wrapper element ID
  "timestamp": "ISO8601"
}
```

---

## AREA 4: Advanced Forensic Capture (15 Commands)

#### 66. EXTRACT_WITH_CONTEXT

Extract data with surrounding context.

**Command**: `extract_with_context`

**Parameters**:
```javascript
{
  "selector": "string",
  "context": {
    "includeParent": "boolean"?,
    "includeSiblings": "boolean"?,
    "depth": "number"?
  }
}
```

**Response**:
```javascript
{
  "success": true,
  "data": {},
  "context": {},
  "timestamp": "ISO8601"
}
```

---

#### 67. CORRELATE_EXTRACTIONS

Correlate multiple extractions.

**Command**: `correlate_extractions`

**Parameters**:
```javascript
{
  "extractionIds": ["string"]
}
```

**Response**:
```javascript
{
  "success": true,
  "correlations": [
    {
      "id1": "string",
      "id2": "string",
      "similarity": number
    }
  ],
  "patterns": ["string"],
  "timestamp": "ISO8601"
}
```

---

#### 68. CREATE_FORENSIC_SNAPSHOT

Create a complete forensic snapshot.

**Command**: `create_forensic_snapshot`

**Parameters**:
```javascript
{
  "selections": ["string"]?       // Specific data to include
}
```

**Response**:
```javascript
{
  "success": true,
  "snapshotId": "string",
  "includedData": ["string"],
  "timestamp": "ISO8601"
}
```

---

[Additional forensic commands 69-76 follow same pattern...]

---

## Error Response Format

All commands follow this error format:

```javascript
{
  "success": false,
  "error": "string",              // Human-readable error message
  "errorType": "string",          // Error category
  "errorCode": "string",          // Machine-readable code (E_*)
  "recovery": {
    "suggestion": "string",       // Suggested fix
    "alternativeCommands": ["string"],  // Alternative commands
    "retryable": boolean
  },
  "timestamp": "ISO8601"
}
```

---

## Common Error Codes

```
E_ELEMENT_NOT_FOUND         Element selector didn't match
E_PROPERTY_NOT_ACCESSIBLE   Property access denied
E_PERMISSION_DENIED         Permission missing
E_TIMEOUT                   Operation timed out
E_SYNTAX_ERROR              Invalid code syntax
E_NETWORK_ERROR             Network operation failed
E_STORAGE_QUOTA_EXCEEDED    Storage quota exceeded
E_DEVTOOLS_NOT_AVAILABLE    DevTools Protocol unavailable
E_INVALID_PARAMETER         Invalid parameter
E_UNSUPPORTED_OPERATION     Operation not supported
```

---

**Version**: 1.0  
**Total Commands**: 68  
**Last Updated**: June 20, 2026  
**Status**: Ready for Implementation
