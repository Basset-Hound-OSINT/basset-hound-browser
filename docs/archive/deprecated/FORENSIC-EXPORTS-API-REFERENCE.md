# Forensic Exports - Complete API Reference

**Version:** 1.0  
**Last Updated:** June 20, 2026  
**Commands:** 4 core forensic commands  
**Status:** Production Ready

---

## Table of Contents

1. [Connection & Message Format](#connection--message-format)
2. [export_raw_html](#export_raw_html)
3. [export_network_log](#export_network_log)
4. [export_device_ids](#export_device_ids)
5. [modify_element](#modify_element)
6. [Response Codes & Errors](#response-codes--errors)
7. [Data Types Reference](#data-types-reference)

---

## Connection & Message Format

### WebSocket URL

```
ws://localhost:8765       # Standard (no auth)
wss://localhost:8765      # Secure SSL/TLS
ws://localhost:8765?token=YOUR_TOKEN  # With token auth
```

### Request Format

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "param1": "value1",
  "param2": "value2"
}
```

**Required fields:**
- `id` (string) - Unique identifier for this request (used to correlate responses)
- `command` (string) - The command to execute

**Optional fields:**
- Any command-specific parameters (see command details below)

### Success Response Format

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "success": true,
  "data": { ... },
  "executionTime": 45
}
```

### Error Response Format

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "success": false,
  "error": "Error message describing what went wrong",
  "recovery": {
    "suggestion": "Recommended fix or next action",
    "alternativeCommands": ["alt_cmd1", "alt_cmd2"]
  }
}
```

---

## export_raw_html

Exports the complete page HTML with HTTP metadata (status code, headers, content type).

**Use Cases:**
- Forensic analysis of page content
- Compliance audit archival
- Content verification
- Historical page snapshots
- Header validation

### Request

```json
{
  "id": "export_html_1",
  "command": "export_raw_html",
  "includeMetadata": true,
  "timeout": 5000
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| id | string | Yes | - | Unique request ID |
| command | string | Yes | - | Must be `export_raw_html` |
| includeMetadata | boolean | No | false | Include response headers and metadata |
| timeout | number | No | 5000 | Timeout in milliseconds |

### Response (Success)

```json
{
  "id": "export_html_1",
  "command": "export_raw_html",
  "success": true,
  "data": {
    "url": "https://example.com",
    "statusCode": 200,
    "statusText": "OK",
    "contentType": "text/html; charset=utf-8",
    "htmlLength": 1234,
    "html": "<!DOCTYPE html><html>...</html>",
    "responseHeaders": {
      "content-type": "text/html; charset=utf-8",
      "server": "nginx/1.21.0",
      "cache-control": "max-age=3600",
      "date": "Mon, 20 Jun 2026 10:30:00 GMT",
      "content-length": "1234"
    },
    "timestamp": 1718863200000,
    "loadTime": 450
  },
  "executionTime": 95
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| url | string | The page URL |
| statusCode | number | HTTP status code (200, 404, etc.) |
| statusText | string | HTTP status text ("OK", "Not Found", etc.) |
| contentType | string | Content-Type header value |
| htmlLength | number | Size of HTML in bytes |
| html | string | Complete page HTML |
| responseHeaders | object | All HTTP response headers |
| timestamp | number | Unix timestamp when captured |
| loadTime | number | Page load time in milliseconds |

### Error Responses

**Navigation Error**
```json
{
  "success": false,
  "error": "No page loaded. Navigate to a URL first.",
  "recovery": {
    "suggestion": "Use navigate command before export_raw_html",
    "alternativeCommands": ["navigate", "get_url"]
  }
}
```

**Timeout Error**
```json
{
  "success": false,
  "error": "Export timeout after 5000ms",
  "recovery": {
    "suggestion": "Increase timeout parameter or wait for page to load",
    "alternativeCommands": ["wait_for_element", "wait_for_navigation"]
  }
}
```

---

## export_network_log

Exports all network requests made by the page with statistics and optional filtering.

**Use Cases:**
- Network performance analysis
- Tracking detection and blocking
- Security auditing
- Request filtering and analysis
- Performance profiling

### Request

```json
{
  "id": "export_net_1",
  "command": "export_network_log",
  "format": "json",
  "resourceType": "xhr",
  "minDuration": 100,
  "maxDuration": 5000,
  "limit": 100
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| id | string | Yes | - | Unique request ID |
| command | string | Yes | - | Must be `export_network_log` |
| format | string | No | json | Output format: `json`, `csv`, `har` |
| resourceType | string | No | all | Filter by type: `document`, `stylesheet`, `script`, `image`, `xhr`, `fetch`, `websocket`, `manifest`, `other` |
| minDuration | number | No | 0 | Minimum request duration (ms) |
| maxDuration | number | No | ∞ | Maximum request duration (ms) |
| statusCode | string | No | all | Regex pattern for status codes (e.g., `"4[0-9]{2}"` for 4xx errors) |
| limit | number | No | 10000 | Maximum number of requests to return |
| includeRequest | boolean | No | false | Include request headers and body |
| includeResponse | boolean | No | false | Include response headers and body |

### Response (Success)

```json
{
  "id": "export_net_1",
  "command": "export_network_log",
  "success": true,
  "data": {
    "totalRequests": 47,
    "filteredRequests": 5,
    "statistics": {
      "totalSize": 2456789,
      "totalDuration": 3245,
      "averageDuration": 69,
      "byResourceType": {
        "document": {
          "count": 1,
          "totalSize": 15000,
          "totalDuration": 450,
          "averageDuration": 450
        },
        "stylesheet": {
          "count": 3,
          "totalSize": 25000,
          "totalDuration": 120,
          "averageDuration": 40
        },
        "script": {
          "count": 12,
          "totalSize": 250000,
          "totalDuration": 1200,
          "averageDuration": 100
        },
        "xhr": {
          "count": 5,
          "totalSize": 50000,
          "totalDuration": 800,
          "averageDuration": 160
        }
      },
      "byStatusCode": {
        "200": 45,
        "304": 2
      },
      "slowestRequest": {
        "url": "https://cdn.example.com/app.js",
        "duration": 1200,
        "resourceType": "script"
      },
      "largestRequest": {
        "url": "https://example.com/api/data",
        "contentLength": 250000,
        "resourceType": "xhr"
      }
    },
    "requests": [
      {
        "url": "https://example.com",
        "method": "GET",
        "statusCode": 200,
        "statusText": "OK",
        "resourceType": "document",
        "contentType": "text/html",
        "contentLength": 15000,
        "duration": 450,
        "startTime": 0,
        "endTime": 450,
        "initiator": "document"
      },
      {
        "url": "https://example.com/api/user",
        "method": "GET",
        "statusCode": 200,
        "statusText": "OK",
        "resourceType": "xhr",
        "contentType": "application/json",
        "contentLength": 5000,
        "duration": 250,
        "startTime": 500,
        "endTime": 750
      }
    ],
    "timestamp": 1718863200000
  },
  "executionTime": 45
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| totalRequests | number | Total requests captured (before filtering) |
| filteredRequests | number | Requests matching filter criteria |
| statistics | object | Aggregate statistics (see table below) |
| requests | array | Array of request objects (see request fields) |
| timestamp | number | Unix timestamp when captured |

### Request Object Fields

| Field | Type | Description |
|-------|------|-------------|
| url | string | Request URL |
| method | string | HTTP method (GET, POST, etc.) |
| statusCode | number | HTTP response status |
| statusText | string | HTTP status text |
| resourceType | string | Resource type |
| contentType | string | Content-Type header |
| contentLength | number | Response body size (bytes) |
| duration | number | Total request duration (ms) |
| startTime | number | When request started (ms) |
| endTime | number | When request ended (ms) |
| initiator | string | What initiated the request |

### Example Queries

**All XHR requests:**
```json
{
  "command": "export_network_log",
  "resourceType": "xhr",
  "id": "net_xhr"
}
```

**Slow requests (>500ms):**
```json
{
  "command": "export_network_log",
  "minDuration": 500,
  "id": "net_slow"
}
```

**Failed requests (4xx, 5xx):**
```json
{
  "command": "export_network_log",
  "statusCode": "4[0-9]{2}|5[0-9]{2}",
  "id": "net_errors"
}
```

**Export as HAR format:**
```json
{
  "command": "export_network_log",
  "format": "har",
  "id": "net_har"
}
```

---

## export_device_ids

Exports device identifiers, fingerprints, browser properties, and evasion status.

**Use Cases:**
- Verify fingerprint spoofing effectiveness
- Audit device identifiers
- Validate evasion profiles
- Analyze fingerprint confidence
- Monitor proxy configuration

### Request

```json
{
  "id": "device_1",
  "command": "export_device_ids",
  "includeProxy": true,
  "includeFingerprints": true
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| id | string | Yes | - | Unique request ID |
| command | string | Yes | - | Must be `export_device_ids` |
| includeProxy | boolean | No | true | Include proxy configuration |
| includeFingerprints | boolean | No | true | Include fingerprint data |
| includeStorage | boolean | No | true | Include storage information |

### Response (Success)

```json
{
  "id": "device_1",
  "command": "export_device_ids",
  "success": true,
  "data": {
    "deviceIdentifiers": {
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "platform": "Win32",
      "platformVersion": "10.0",
      "hardwareConcurrency": 8,
      "deviceMemory": 8,
      "maxTouchPoints": 0,
      "language": "en-US",
      "languages": ["en-US", "en"],
      "timezone": -300,
      "timezoneOffsetString": "EDT",
      "webdriver": false,
      "vendor": "Google Inc.",
      "appVersion": "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    "screen": {
      "width": 1920,
      "height": 1080,
      "colorDepth": 24,
      "pixelDepth": 24,
      "orientation": "landscape-primary",
      "availWidth": 1920,
      "availHeight": 1040,
      "devicePixelRatio": 1
    },
    "fingerprint": {
      "canvas": {
        "hash": "8fe3d4a8c2f9e1b6a7c8d9e0f1g2h3i4",
        "confidence": 0.98,
        "method": "text-only"
      },
      "webgl": {
        "hash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
        "confidence": 0.95,
        "renderer": "ANGLE (Intel HD Graphics 630)",
        "vendor": "Google Inc. (Intel)"
      },
      "webrtc": {
        "ipv4": "192.168.1.100",
        "ipv6": null,
        "portProbability": 0.85
      },
      "storage": {
        "localStorage": 12,
        "sessionStorage": 5,
        "indexedDB": true,
        "cookies": 23
      },
      "audio": {
        "hash": "d4e5f6a7b8c9d0e1f2g3h4i5j6k7l8m9",
        "confidence": 0.92,
        "context": "AudioContext"
      },
      "fonts": {
        "detected": ["Arial", "Times New Roman", "Courier New"],
        "hash": "7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3"
      }
    },
    "proxyInfo": {
      "enabled": true,
      "currentProxy": {
        "host": "proxy.example.com",
        "port": 8080,
        "protocol": "http",
        "country": "US",
        "type": "residential"
      },
      "rotationMode": "round-robin",
      "rotationCount": 5,
      "lastRotation": 1718863150000
    },
    "timestamp": 1718863200000,
    "captureTime": 25
  },
  "executionTime": 35
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| deviceIdentifiers | object | Browser and device properties |
| screen | object | Screen/display information |
| fingerprint | object | Canvas, WebGL, WebRTC, storage fingerprints |
| proxyInfo | object | Proxy configuration and status |
| timestamp | number | Unix timestamp when captured |
| captureTime | number | Time to capture fingerprint data (ms) |

### Fingerprint Object Details

**Canvas Fingerprint:**
- `hash` - MD5 hash of canvas rendering
- `confidence` - Confidence score (0-1)
- `method` - Fingerprinting method used

**WebGL Fingerprint:**
- `hash` - MD5 hash of WebGL rendering
- `confidence` - Confidence score (0-1)
- `renderer` - GPU renderer string
- `vendor` - GPU vendor string

**WebRTC:**
- `ipv4` - IPv4 address detected
- `ipv6` - IPv6 address detected (if available)
- `portProbability` - Likelihood of port leak (0-1)

**Storage:**
- `localStorage` - Number of items
- `sessionStorage` - Number of items
- `indexedDB` - Whether available
- `cookies` - Number of cookies

### Error Response Example

**No page loaded:**
```json
{
  "success": false,
  "error": "No page loaded. Navigate to a URL first.",
  "recovery": {
    "suggestion": "Use navigate command before export_device_ids",
    "alternativeCommands": ["navigate"]
  }
}
```

---

## modify_element

Modifies DOM elements for testing, verification, and content manipulation.

**Use Cases:**
- Test website interactivity
- Inject test content
- Verify element selectors
- Hide/show elements
- Modify form fields

### Request

```json
{
  "id": "modify_1",
  "command": "modify_element",
  "selector": "h1.title",
  "type": "text",
  "value": "New Title",
  "allMatches": false
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| id | string | Yes | - | Unique request ID |
| command | string | Yes | - | Must be `modify_element` |
| selector | string | Yes | - | CSS selector for element(s) |
| type | string | Yes | - | Modification type: `text`, `attribute`, `class`, `css`, `html`, `remove`, `append` |
| value | string/object | Yes | - | Value to set (type-dependent) |
| allMatches | boolean | No | false | Apply to all matching elements |
| attributeName | string | Conditional | - | Attribute name (required if type=`attribute`) |
| classOperation | string | Conditional | add | Class operation: `add`, `remove`, `toggle` (for type=`class`) |
| className | string | Conditional | - | Class name (required if type=`class`) |
| cssProperties | object | Conditional | - | CSS properties object (required if type=`css`) |

### Modification Types

**type: "text"** - Modify text content
```json
{
  "command": "modify_element",
  "selector": "h1",
  "type": "text",
  "value": "New Title"
}
```

**type: "html"** - Modify HTML content
```json
{
  "command": "modify_element",
  "selector": "#main",
  "type": "html",
  "value": "<div>New content</div>"
}
```

**type: "attribute"** - Modify HTML attribute
```json
{
  "command": "modify_element",
  "selector": "input[type='text']",
  "type": "attribute",
  "attributeName": "placeholder",
  "value": "Enter text here"
}
```

**type: "class"** - Add/remove CSS class
```json
{
  "command": "modify_element",
  "selector": "button.submit",
  "type": "class",
  "classOperation": "add",
  "className": "highlight"
}
```

**type: "css"** - Apply inline CSS
```json
{
  "command": "modify_element",
  "selector": ".popup",
  "type": "css",
  "cssProperties": {
    "display": "none",
    "visibility": "hidden",
    "opacity": "0"
  }
}
```

**type: "remove"** - Remove element
```json
{
  "command": "modify_element",
  "selector": "#tracking-pixel",
  "type": "remove"
}
```

**type: "append"** - Append content
```json
{
  "command": "modify_element",
  "selector": "body",
  "type": "append",
  "value": "<script>console.log('test')</script>"
}
```

### Response (Success)

```json
{
  "id": "modify_1",
  "command": "modify_element",
  "success": true,
  "data": {
    "matched": 5,
    "modified": 5,
    "selector": "h1.title",
    "type": "text",
    "details": [
      {
        "element": "h1.title",
        "originalValue": "Old Title",
        "newValue": "New Title"
      }
    ]
  },
  "executionTime": 8
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| matched | number | Number of elements matching selector |
| modified | number | Number of elements actually modified |
| selector | string | The CSS selector used |
| type | string | The modification type |
| details | array | Array of details for each modified element |

### Error Responses

**Selector not found:**
```json
{
  "success": false,
  "error": "Selector '.nonexistent' matched 0 elements",
  "recovery": {
    "suggestion": "Verify the CSS selector using browser DevTools",
    "alternativeCommands": ["get_content", "execute_script"]
  }
}
```

**Invalid modification type:**
```json
{
  "success": false,
  "error": "Invalid modification type 'invalid'. Valid types: text, attribute, class, css, html, remove, append",
  "recovery": {
    "suggestion": "Use one of the valid modification types",
    "alternativeCommands": []
  }
}
```

---

## Response Codes & Errors

### HTTP Status Codes

| Code | Meaning | Typical Cause |
|------|---------|---------------|
| 101 | Switching Protocols | WebSocket upgrade successful |
| 200 | OK | Command executed successfully |
| 400 | Bad Request | Invalid JSON or missing required parameter |
| 401 | Unauthorized | Authentication token invalid/missing |
| 403 | Forbidden | Command not allowed in current context |
| 404 | Not Found | Element/resource not found |
| 408 | Request Timeout | Command took too long to execute |
| 500 | Internal Error | Browser engine error |

### WebSocket Error Messages

| Error | Cause | Recovery |
|-------|-------|----------|
| No page loaded | navigate not called or page crashed | Call navigate first |
| Selector not found | CSS selector doesn't match any elements | Verify selector with DevTools |
| Command timeout | Operation exceeded timeout limit | Increase timeout or wait longer |
| Network error | WebSocket connection lost | Reconnect and retry |
| Browser crashed | Browser process terminated | Restart browser server |

---

## Data Types Reference

### String Selectors

CSS selectors for `modify_element`:

```javascript
// ID selector
"#main"

// Class selector
".container"

// Tag selector
"button"

// Attribute selector
"input[type='text']"

// Combination
"div.container > button.primary"

// Pseudo-class
"a:hover"

// Multiple
"h1, h2, h3"
```

### Resource Types

For `export_network_log` `resourceType` filter:

```
document       - HTML documents
stylesheet     - CSS stylesheets
script         - JavaScript files
image          - Images (PNG, JPG, etc.)
xhr            - XMLHttpRequest/Fetch calls
websocket      - WebSocket connections
manifest       - Web app manifest
other          - Other resource types
```

### HTTP Methods

For network log entries:

```
GET     - Retrieve resource
POST    - Create resource
PUT     - Update resource
DELETE  - Delete resource
PATCH   - Partial update
HEAD    - Like GET but no body
OPTIONS - Query capabilities
```

### Timezones

Timezones are represented as:
- **Offset format:** `-300` (minutes from UTC, e.g., -300 = EDT)
- **String format:** `"EST"`, `"EDT"`, `"PST"`, etc.

### Timestamps

All timestamps are Unix epoch milliseconds:

```javascript
Date.now()  // JavaScript
time.time() * 1000  // Python
```

---

## Common Parameter Patterns

### Regex Patterns

```javascript
// Match 4xx errors
"4[0-9]{2}"

// Match 5xx errors
"5[0-9]{2}"

// Match any error
"[4-5][0-9]{2}"

// Match specific codes
"404|500|503"
```

### Duration Ranges

```javascript
// Fast requests: <100ms
{ minDuration: 0, maxDuration: 100 }

// Slow requests: >1s
{ minDuration: 1000 }

// Medium requests: 100-500ms
{ minDuration: 100, maxDuration: 500 }
```

### CSS Properties (for modify_element)

```javascript
{
  "display": "none",           // Hide element
  "visibility": "hidden",      // Hidden but takes space
  "opacity": "0",              // Transparent
  "width": "100px",            // Set width
  "background-color": "red",   // Change color
  "z-index": "-1",             // Send to back
  "pointer-events": "none"     // Disable interaction
}
```

---

## Rate Limiting & Quotas

**Per Connection:**
- Max 10,000 requests/minute
- Max 100 concurrent commands
- Max 50 MB response payload

**Recovery:**
- Commands are queued if limit exceeded
- Queue processes at ~1,000 requests/second
- Typical wait: 0.1-1 second for queued commands

---

## Legacy & Compatibility

**Deprecated Parameters:**
- `htmlOnly` (deprecated in v1.0, use `export_raw_html` directly)
- `networkOnly` (deprecated in v1.0, use `export_network_log` directly)

**Backwards Compatibility:**
- All v1.0 commands work in v1.1
- Response format unchanged
- No breaking changes planned

---

## Examples by Use Case

### Use Case: Page Capture for Archive

```json
{
  "command": "export_raw_html",
  "includeMetadata": true,
  "id": "archive_1"
}
```

### Use Case: Performance Analysis

```json
{
  "command": "export_network_log",
  "minDuration": 100,
  "id": "perf_1"
}
```

### Use Case: Security Audit

```json
{
  "command": "export_network_log",
  "statusCode": "4[0-9]{2}|5[0-9]{2}",
  "id": "security_1"
}
```

### Use Case: Fingerprint Verification

```json
{
  "command": "export_device_ids",
  "includeFingerprints": true,
  "includeProxy": true,
  "id": "fp_1"
}
```

### Use Case: Test Form Submission

```json
[
  {
    "command": "fill",
    "selector": "input[name='email']",
    "value": "test@example.com",
    "id": "fill_1"
  },
  {
    "command": "modify_element",
    "selector": "button[type='submit']",
    "type": "class",
    "classOperation": "add",
    "className": "testing",
    "id": "mod_1"
  }
]
```

---

**Ready to code?** See [Usage Examples](./FORENSIC-EXPORTS-EXAMPLES.md) for copy-paste code samples.
