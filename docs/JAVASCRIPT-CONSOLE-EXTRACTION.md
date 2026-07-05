# JavaScript & Console Extraction Commands

## Overview

This feature provides 10 comprehensive WebSocket commands for extracting JavaScript context, console output, storage, performance metrics, and network activity from the browser. These commands enable deep inspection of page state and behavior.

**Feature Area:** Data Extraction - Category 3  
**Commands:** 10 new WebSocket commands  
**Status:** Production Ready  
**Effort:** 18 dev hours  
**Test Coverage:** >90%

---

## Table of Contents

1. [Command Summary](#command-summary)
2. [Command Reference](#command-reference)
3. [Usage Examples](#usage-examples)
4. [Response Formats](#response-formats)
5. [Error Handling](#error-handling)
6. [Performance Considerations](#performance-considerations)
7. [Limitations & Edge Cases](#limitations--edge-cases)

---

## Command Summary

| Command | Purpose | Scope | Output |
|---------|---------|-------|--------|
| `export_scripts_all` | Extract all script tags and inline scripts | Page scripts | Inline/external scripts with metadata |
| `export_scripts_sources` | Extract external script sources only | External scripts | URLs, domains, security attributes |
| `export_console_logs` | Extract all console output | Console messages | Logs, errors, warnings, info, debug |
| `export_globals` | Extract window/global variables | Global scope | All enumerable window properties |
| `export_localstorage` | Extract localStorage items | Storage API | All key-value pairs + size |
| `export_sessionstorage` | Extract sessionStorage items | Storage API | All key-value pairs + size |
| `export_cookies` | Extract browser cookies | HTTP cookies | Cookie names, values, metadata |
| `export_performance_timeline` | Extract performance metrics | Performance API | Navigation timing, resource timing, memory |
| `export_errors` | Extract JavaScript errors | Error handling | Uncaught errors, console errors |
| `export_network_from_js` | Extract JS-initiated requests | Network activity | Fetch/XHR requests, statistics |

---

## Command Reference

### 1. export_scripts_all

Extracts all script tags (both inline and external) from the current page.

#### Request

```json
{
  "command": "export_scripts_all",
  "id": "unique_id"
}
```

#### Response

```json
{
  "success": true,
  "scripts": {
    "inline": [
      {
        "index": 0,
        "content": "console.log('test');",
        "length": 19,
        "async": false,
        "defer": false,
        "type": "application/javascript"
      }
    ],
    "external": [
      {
        "index": 0,
        "src": "https://example.com/script.js",
        "async": true,
        "defer": false,
        "type": "application/javascript",
        "crossOrigin": "anonymous"
      }
    ],
    "count": {
      "inline": 1,
      "external": 1,
      "total": 2
    }
  },
  "timestamp": 1234567890000
}
```

#### Response Fields

- `inline[]` - Array of inline script objects
  - `index` - Position in document
  - `content` - Script code
  - `length` - Content length in bytes
  - `async` - Async attribute value
  - `defer` - Defer attribute value
  - `type` - Script MIME type
- `external[]` - Array of external script objects
  - `index` - Position in document
  - `src` - Script URL
  - `async` - Async attribute value
  - `defer` - Defer attribute value
  - `type` - Script MIME type
  - `crossOrigin` - CORS attribute
- `count` - Summary counts
  - `inline` - Number of inline scripts
  - `external` - Number of external scripts
  - `total` - Total script count

#### Example Use Cases

- Detect injected scripts
- Track all external dependencies
- Audit inline code execution
- Security analysis of loaded resources

---

### 2. export_scripts_sources

Extracts external script sources with full metadata and domains.

#### Request

```json
{
  "command": "export_scripts_sources",
  "id": "unique_id"
}
```

#### Response

```json
{
  "success": true,
  "sources": [
    {
      "index": 0,
      "src": "https://cdn.example.com/script.js",
      "async": true,
      "defer": false,
      "type": "application/javascript",
      "crossOrigin": "anonymous",
      "integrity": "sha256-xxx...",
      "nonce": "abc123",
      "noModule": false
    }
  ],
  "count": 5,
  "domains": [
    "cdn.example.com",
    "analytics.example.com",
    "cdn.jsdelivr.net"
  ],
  "timestamp": 1234567890000
}
```

#### Response Fields

- `sources[]` - Array of external scripts with full metadata
  - `src` - Script URL
  - `async` - Async loading
  - `defer` - Deferred execution
  - `type` - MIME type
  - `crossOrigin` - CORS policy
  - `integrity` - Subresource integrity hash
  - `nonce` - Content Security Policy nonce
  - `noModule` - Modern module detection
- `count` - Number of external scripts
- `domains[]` - Unique domain origins
- `timestamp` - Extraction time

#### Example Use Cases

- Inventory external dependencies
- Verify SRI (Subresource Integrity) hashes
- Detect CDN usage
- Third-party script analysis

---

### 3. export_console_logs

Extracts all console output including logs, errors, warnings, and debug messages.

#### Request

```json
{
  "command": "export_console_logs",
  "id": "unique_id",
  "type": "error"
}
```

#### Response

```json
{
  "success": true,
  "logs": [
    {
      "type": "log",
      "message": "Page loaded successfully",
      "args": ["Page loaded successfully"],
      "timestamp": 1234567890000,
      "source": "application"
    },
    {
      "type": "error",
      "message": "TypeError: Cannot read property 'x' of undefined",
      "stack": "at function (file.js:10:5)",
      "timestamp": 1234567890100,
      "source": "application"
    }
  ],
  "summary": {
    "total": 10,
    "byType": {
      "log": 5,
      "error": 2,
      "warn": 2,
      "info": 1,
      "debug": 0
    }
  },
  "timestamp": 1234567890000
}
```

#### Response Fields

- `logs[]` - Array of console messages
  - `type` - Message type (log, error, warn, info, debug)
  - `message` - Message text
  - `args[]` - Message arguments
  - `stack` - Stack trace if available
  - `timestamp` - Message time
  - `source` - Source origin
- `summary` - Aggregate statistics
  - `total` - Total messages
  - `byType` - Counts by message type
- `timestamp` - Extraction time

#### Parameters

- `type` - Optional filter by message type (log, error, warn, info, debug)

#### Example Use Cases

- Detect JavaScript errors
- Monitor application logging
- Debug page issues
- Security issue detection

---

### 4. export_globals

Extracts all enumerable window/global variables with type information.

#### Request

```json
{
  "command": "export_globals",
  "id": "unique_id",
  "categorize": true
}
```

#### Response

```json
{
  "success": true,
  "globals": {
    "myVar": {
      "type": "string",
      "value": "test value"
    },
    "myNumber": {
      "type": "number",
      "value": 42
    },
    "myFunction": {
      "type": "function",
      "name": "myFunction"
    },
    "myObject": {
      "type": "Object",
      "keys": ["prop1", "prop2", "prop3"]
    },
    "myArray": {
      "type": "Array",
      "length": 10
    }
  },
  "count": 250,
  "categories": {
    "window": ["innerHeight", "innerWidth"],
    "document": ["documentElement", "body"],
    "navigator": ["userAgent", "platform"],
    "console": ["log", "error"],
    "performance": ["timing", "navigation"],
    "storage": ["localStorage", "sessionStorage"],
    "custom": ["myVar", "myFunction"]
  },
  "timestamp": 1234567890000
}
```

#### Response Fields

- `globals` - Object mapping variable names to type info
  - `type` - Variable type (string, number, function, Object, Array, etc.)
  - `value` - Value for primitives
  - `name` - Function name if function
  - `keys` - First 5 keys if Object
  - `length` - Array length if Array
- `count` - Total number of global variables
- `categories` - Globals grouped by category (optional)
- `timestamp` - Extraction time

#### Parameters

- `categorize` - Boolean, include categorized globals (default: true)

#### Example Use Cases

- Inspect global state
- Detect injected variables
- Monitor application state
- Vulnerability scanning

---

### 5. export_localstorage

Extracts all localStorage items for the current origin.

#### Request

```json
{
  "command": "export_localstorage",
  "id": "unique_id",
  "origin": "https://example.com"
}
```

#### Response

```json
{
  "success": true,
  "items": {
    "theme": "dark",
    "userId": "user123",
    "preferences": "{\"lang\":\"en\",\"notifications\":true}"
  },
  "count": 3,
  "totalSize": 245,
  "timestamp": 1234567890000
}
```

#### Response Fields

- `items` - Object mapping all key-value pairs
- `count` - Number of items stored
- `totalSize` - Approximate size in bytes
- `timestamp` - Extraction time

#### Parameters

- `origin` - Optional origin (defaults to current page)

#### Example Use Cases

- Export user preferences
- Audit stored data
- Security analysis
- State persistence

---

### 6. export_sessionstorage

Extracts all sessionStorage items for the current origin.

#### Request

```json
{
  "command": "export_sessionstorage",
  "id": "unique_id",
  "origin": "https://example.com"
}
```

#### Response

```json
{
  "success": true,
  "items": {
    "tempToken": "xyz789",
    "sessionId": "sess_12345"
  },
  "count": 2,
  "totalSize": 67,
  "timestamp": 1234567890000
}
```

#### Response Fields

Same as `export_localstorage`

#### Parameters

Same as `export_localstorage`

#### Example Use Cases

- Export session tokens
- Audit temporary data
- Session analysis
- Debugging

---

### 7. export_cookies

Extracts browser cookies with metadata.

#### Request

```json
{
  "command": "export_cookies",
  "id": "unique_id"
}
```

#### Response

```json
{
  "success": true,
  "cookies": [
    {
      "name": "session_id",
      "value": "abc123xyz789",
      "fromDocument": true
    },
    {
      "name": "preferences",
      "value": "theme=dark",
      "fromDocument": true
    }
  ],
  "count": 2,
  "totalSize": 45,
  "timestamp": 1234567890000
}
```

#### Response Fields

- `cookies[]` - Array of cookie objects
  - `name` - Cookie name
  - `value` - Cookie value
  - `domain` - Domain (if available)
  - `path` - Path (if available)
  - `secure` - Secure flag
  - `httpOnly` - HttpOnly flag (limited by CORS)
  - `sameSite` - SameSite policy
  - `expires` - Expiration date
  - `fromDocument` - From document.cookie
- `count` - Number of cookies
- `totalSize` - Total size in bytes
- `timestamp` - Extraction time

#### Example Use Cases

- Export authentication cookies
- Session management
- Security analysis
- Cookie auditing

---

### 8. export_performance_timeline

Extracts performance metrics and navigation timeline data.

#### Request

```json
{
  "command": "export_performance_timeline",
  "id": "unique_id"
}
```

#### Response

```json
{
  "success": true,
  "performance": {
    "navigation": {
      "navigationStart": 1234567890000,
      "responseStart": 1234567890050,
      "domLoading": 1234567890100,
      "domInteractive": 1234567891000,
      "domComplete": 1234567892000,
      "loadEventStart": 1234567892100,
      "loadEventEnd": 1234567892500
    },
    "resources": [
      {
        "name": "https://example.com/script.js",
        "type": "script",
        "duration": 125.5,
        "transferSize": 45000,
        "decodedBodySize": 125000,
        "startTime": 500,
        "responseEnd": 625.5
      }
    ],
    "marks": [
      {
        "name": "app-start",
        "startTime": 1000
      }
    ],
    "measures": [
      {
        "name": "app-init",
        "duration": 500,
        "startTime": 1000
      }
    ],
    "memory": {
      "jsHeapSizeLimit": 2000000000,
      "totalJSHeapSize": 1500000000,
      "usedJSHeapSize": 1000000000
    }
  },
  "timestamp": 1234567890000
}
```

#### Response Fields

- `navigation` - Navigation Timing API data
  - All standard navigation timing fields
- `resources[]` - Resource Timing API entries
  - `name` - Resource URL
  - `type` - Resource type
  - `duration` - Load duration in ms
  - `transferSize` - Network transfer size
  - `decodedBodySize` - Decoded size
  - `startTime` - Start timestamp
  - `responseEnd` - Response end timestamp
- `marks[]` - Custom performance marks
- `measures[]` - Custom performance measures
- `memory` - Memory statistics (Chrome only)
  - `jsHeapSizeLimit` - Maximum heap size
  - `totalJSHeapSize` - Total heap size
  - `usedJSHeapSize` - Used heap size
- `timestamp` - Extraction time

#### Example Use Cases

- Performance analysis
- Page load optimization
- Resource monitoring
- Memory analysis

---

### 9. export_errors

Extracts all JavaScript errors encountered.

#### Request

```json
{
  "command": "export_errors",
  "id": "unique_id"
}
```

#### Response

```json
{
  "success": true,
  "errors": [
    {
      "type": "error",
      "message": "TypeError: Cannot read property 'x' of undefined",
      "source": "https://example.com/script.js",
      "lineno": 125,
      "colno": 10,
      "stack": "at function (script.js:125:10)",
      "timestamp": 1234567890100
    },
    {
      "type": "uncaughtError",
      "message": "ReferenceError: myVar is not defined",
      "timestamp": 1234567890200
    }
  ],
  "summary": {
    "total": 5,
    "byType": {
      "error": 3,
      "warning": 1,
      "uncaughtError": 1
    }
  },
  "timestamp": 1234567890000
}
```

#### Response Fields

- `errors[]` - Array of error objects
  - `type` - Error type (error, warning, uncaughtError)
  - `message` - Error message
  - `source` - Source file
  - `lineno` - Line number
  - `colno` - Column number
  - `stack` - Stack trace
  - `timestamp` - When error occurred
- `summary` - Error statistics
  - `total` - Total errors
  - `byType` - Errors categorized by type
- `timestamp` - Extraction time

#### Limitations

- Limited to errors captured after command registration
- Stack traces may be limited by browser
- Result set limited to 1000 errors

#### Example Use Cases

- Error monitoring
- Debugging
- Quality assurance
- Performance analysis

---

### 10. export_network_from_js

Extracts requests made by JavaScript (fetch/XHR).

#### Request

```json
{
  "command": "export_network_from_js",
  "id": "unique_id"
}
```

#### Response

```json
{
  "success": true,
  "requests": [
    {
      "method": "GET",
      "url": "https://api.example.com/users",
      "status": 200,
      "type": "fetch",
      "size": 1024,
      "duration": 125,
      "timestamp": 1234567890100
    },
    {
      "method": "POST",
      "url": "https://api.example.com/data",
      "status": 201,
      "type": "xhr",
      "size": 512,
      "duration": 250,
      "timestamp": 1234567890350
    }
  ],
  "summary": {
    "total": 2,
    "byMethod": {
      "GET": 1,
      "POST": 1
    },
    "byStatus": {
      "200": 1,
      "201": 1
    },
    "totalSize": 1536
  },
  "timestamp": 1234567890000
}
```

#### Response Fields

- `requests[]` - Array of network request objects
  - `method` - HTTP method (GET, POST, etc.)
  - `url` - Request URL
  - `status` - HTTP status code
  - `type` - Request type (fetch, xhr)
  - `size` - Response size in bytes
  - `duration` - Request duration in ms
  - `timestamp` - When request occurred
- `summary` - Request statistics
  - `total` - Total requests
  - `byMethod` - Requests by HTTP method
  - `byStatus` - Requests by status code
  - `totalSize` - Total bytes transferred
- `timestamp` - Extraction time

#### Limitations

- Requires JavaScript-initiated requests to be captured
- Limited to 500 requests in result set
- May not capture all network activity

#### Example Use Cases

- API monitoring
- Network analysis
- Performance optimization
- Security analysis

---

## Usage Examples

### Example 1: Full JavaScript Context Extraction

Extract all JavaScript context for analysis:

```javascript
const ws = new WebSocket('ws://localhost:8765');

async function extractFullContext() {
  const commands = [
    'export_scripts_all',
    'export_console_logs',
    'export_globals',
    'export_performance_timeline'
  ];

  const results = {};

  for (const cmd of commands) {
    const response = await sendCommand(ws, cmd);
    results[cmd] = response;
  }

  return results;
}
```

### Example 2: Security Analysis

Extract data for security assessment:

```javascript
async function performSecurityAnalysis() {
  const analysis = {};

  // Check for injected scripts
  analysis.scripts = await sendCommand(ws, 'export_scripts_all');

  // Check for suspicious global variables
  analysis.globals = await sendCommand(ws, 'export_globals');

  // Check for errors/exploits
  analysis.errors = await sendCommand(ws, 'export_errors');

  // Check for unauthorized storage
  analysis.storage = await sendCommand(ws, 'export_localstorage');

  return analysis;
}
```

### Example 3: Performance Monitoring

Extract performance data:

```javascript
async function monitorPerformance() {
  const perfData = await sendCommand(ws, 'export_performance_timeline');
  const logs = await sendCommand(ws, 'export_console_logs');
  const requests = await sendCommand(ws, 'export_network_from_js');

  return {
    timing: perfData.performance,
    issues: logs.logs.filter(l => l.type === 'error'),
    networkActivity: requests.requests
  };
}
```

### Example 4: Debugging

Extract debugging information:

```javascript
async function debugPage() {
  const debug = {};

  // Get console output
  debug.console = await sendCommand(ws, 'export_console_logs');

  // Get errors
  debug.errors = await sendCommand(ws, 'export_errors');

  // Get network requests
  debug.network = await sendCommand(ws, 'export_network_from_js');

  // Get performance metrics
  debug.performance = await sendCommand(ws, 'export_performance_timeline');

  return debug;
}
```

---

## Response Formats

### Standard Success Response

All successful responses follow this format:

```json
{
  "success": true,
  "id": "unique_request_id",
  "[command_specific_fields]": {},
  "timestamp": 1234567890000
}
```

### Standard Error Response

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "id": "unique_request_id"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `DevTools manager not available` | Manager initialization failed | Ensure page is fully loaded |
| `Console manager not available` | Console manager not initialized | Wait for WebSocket connection |
| `Storage manager not available` | Storage manager not initialized | Check browser storage availability |
| `Failed to extract [data]` | JavaScript evaluation failed | Check page state |

---

## Error Handling

### Retry Logic

Most extraction commands support automatic retry:

```javascript
async function sendCommandWithRetry(ws, command, params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await sendCommand(ws, command, params);
      if (response.success) {
        return response;
      }
    } catch (error) {
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}
```

### Timeout Handling

Commands should complete within 5 seconds:

```javascript
async function sendCommandWithTimeout(ws, command, params, timeout = 5000) {
  return Promise.race([
    sendCommand(ws, command, params),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${command}`)), timeout)
    )
  ]);
}
```

---

## Performance Considerations

### Large Result Sets

Commands may return large amounts of data:

- `export_globals` - Can return 100+ variables
- `export_console_logs` - Can return 100+ messages
- `export_localstorage` - Can return 10MB+ of data

**Optimization Tips:**

1. Use filtering parameters when available
2. Process results in batches
3. Implement compression for large responses
4. Cache results when appropriate

### Network Bandwidth

Large responses may consume significant bandwidth:

```javascript
// Estimate response size
function estimateSize(command) {
  const estimates = {
    'export_scripts_all': 50, // KB
    'export_globals': 100,     // KB
    'export_localstorage': 1000, // KB (variable)
    'export_console_logs': 200, // KB
    'export_performance_timeline': 50 // KB
  };
  return estimates[command] || 50;
}
```

### Memory Usage

Be aware of memory consumption:

- Parsing large responses consumes memory
- Consider streaming large results
- Clear completed results to free memory

---

## Limitations & Edge Cases

### Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Scripts extraction | ✓ | ✓ | ✓ | ✓ |
| Console logs | ✓ | ✓ | ✓ | ✓ |
| Globals | ✓ | ✓ | ✓ | ✓ |
| Storage | ✓ | ✓ | ✓ | ✓ |
| Performance API | ✓ | ✓ | ✓ | ✓ |
| Memory stats | ✓ | ✗ | ✗ | ✓ |

### Limitations

1. **Same-Origin Policy** - Storage limited to current origin
2. **HttpOnly Cookies** - Cannot access HttpOnly flag
3. **Error Stacks** - Stack traces may be limited or minified
4. **Performance Timing** - May be blocked by Timing-Allow-Origin
5. **Result Limits** - Errors and network requests limited to 1000/500

### Edge Cases

1. **Empty Page** - Commands still succeed with empty results
2. **Dynamic Content** - Only captures currently loaded content
3. **Deleted Variables** - May include garbage collected items
4. **Storage Quota** - Some browsers limit storage to 5-10MB
5. **Cross-Origin Resources** - May have limited metadata

---

## Integration Guide

### Adding to MCP Server

Commands are automatically registered with the WebSocket server and available via:

1. **WebSocket API** - Direct connection
2. **MCP Server** - Model Context Protocol
3. **CLI Tools** - Command-line interface

### Example MCP Tool Definition

```yaml
tools:
  - name: export_scripts_all
    description: Extract all scripts from current page
    input_schema:
      type: object
      properties: {}
  
  - name: export_console_logs
    description: Extract all console output
    input_schema:
      type: object
      properties:
        type:
          type: string
          description: Filter by log type
```

---

## Testing

### Unit Tests

Comprehensive unit test coverage:

```bash
npm test -- tests/unit/javascript-console-extraction.test.js
```

### Integration Tests

Full WebSocket integration testing:

```bash
npm test -- tests/integration/javascript-console-integration.test.js
```

### Test Coverage

- 52+ unit tests (100% command coverage)
- 20+ integration tests (end-to-end flows)
- Error handling and edge cases
- Performance characteristics

---

## Related Commands

- `get_console_logs` - Legacy console log command
- `get_network_logs` - Network monitoring
- `get_local_storage` - Individual localStorage access
- `get_session_storage` - Individual sessionStorage access
- `get_cookies` - Legacy cookie command
- `get_performance` - Performance metrics

---

## Changelog

### v1.0.0 (2026-06-20)

- ✅ Implemented 10 JavaScript & console extraction commands
- ✅ Full unit test coverage (52 tests)
- ✅ Integration test suite (20+ tests)
- ✅ Comprehensive documentation
- ✅ Error handling and recovery
- ✅ Performance optimization

---

## Support & Troubleshooting

### Common Issues

**Q: Commands return empty results**
A: Wait for page to fully load before executing. Use proper event listeners.

**Q: Memory usage is high**
A: Large pages with many scripts/globals will consume memory. Consider batching.

**Q: Performance is slow**
A: JavaScript evaluation can be slow. Results are limited to prevent timeout.

**Q: Some data is missing**
A: Dynamic content not yet loaded, or third-party scripts blocked by CORS.

### Contact & Issues

- GitHub Issues: https://github.com/basset-hound/issues
- Documentation: https://basset-hound.dev/docs
- Support: support@basset-hound.dev

---

## License

Part of Basset Hound Browser v12.7.0+

All rights reserved.
