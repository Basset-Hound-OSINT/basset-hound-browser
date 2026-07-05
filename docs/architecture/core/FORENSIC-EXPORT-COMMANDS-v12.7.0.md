# Forensic Export Commands (v12.7.0)

## Overview

Four new WebSocket commands have been added to Basset Hound Browser to support forensic content extraction and DOM manipulation. These commands enable comprehensive capture of page content, network activity, device fingerprints, and surgical DOM modifications for testing and evasion verification.

**Integration Point:** `websocket/server.js` (lines 7864-8251)

---

## 1. export_raw_html

### Purpose
Export the full page HTML with HTTP response headers and status code for forensic analysis.

### Usage
```javascript
{
  "command": "export_raw_html"
}
```

### Parameters
None required.

### Response Example

```json
{
  "success": true,
  "timestamp": "2026-06-20T14:32:45.123Z",
  "url": "https://example.com/page",
  "statusCode": 200,
  "responseHeaders": {
    "content-type": "text/html; charset=utf-8",
    "content-length": "45238",
    "server": "nginx/1.21.0",
    "date": "Wed, 20 Jun 2026 14:32:44 GMT",
    "cache-control": "public, max-age=3600",
    "etag": "\"abc123def456\"",
    "content-encoding": "gzip"
  },
  "html": "<!DOCTYPE html>\n<html>\n<head>\n<title>Example Page</title>\n...",
  "htmlLength": 45238,
  "contentType": "text/html; charset=utf-8"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Window or webContents not available",
  "timestamp": "2026-06-20T14:32:45.123Z"
}
```

### Implementation Details
- Retrieves current URL from `window.location.href`
- Captures full rendered HTML via `document.documentElement.outerHTML`
- Correlates captured requests to find response headers for main document
- Returns HTTP status code and response headers for forensic accuracy
- Includes HTML length and content-type for analysis

---

## 2. export_network_log

### Purpose
Export all captured HTTP requests and responses with comprehensive forensic metadata.

### Usage
```javascript
{
  "command": "export_network_log",
  "resourceType": "xhr",           // optional: filter by resource type
  "minDuration": 100,              // optional: filter requests >= N ms
  "format": "json"                 // optional: 'json', 'har', 'csv'
}
```

### Parameters
- `format` (string, optional): Export format - `'json'` (default), `'har'`, `'csv'`
- `resourceType` (string, optional): Filter by resource type (`document`, `xhr`, `fetch`, `script`, `stylesheet`, `image`, `media`, `font`, etc.)
- `minDuration` (number, optional): Only include requests with duration >= N milliseconds

### Response Example

```json
{
  "success": true,
  "timestamp": "2026-06-20T14:32:50.456Z",
  "format": "json",
  "exportedAt": "2026-06-20T14:32:50.456Z",
  "totalRequests": 87,
  "requests": [
    {
      "id": "req_001",
      "url": "https://example.com/api/data",
      "method": "POST",
      "resourceType": "xhr",
      "statusCode": 200,
      "statusMessage": "OK",
      "requestHeaders": {
        "content-type": "application/json",
        "accept": "application/json",
        "authorization": "Bearer token_abc123",
        "user-agent": "Mozilla/5.0..."
      },
      "responseHeaders": {
        "content-type": "application/json",
        "cache-control": "no-cache",
        "server": "nginx/1.21.0"
      },
      "requestBody": "{\"query\": \"search term\"}",
      "responseBody": "{\"results\": [{...}], \"total\": 42}",
      "contentLength": 1523,
      "duration": 145,
      "startTime": "2026-06-20T14:32:40.100Z",
      "endTime": "2026-06-20T14:32:40.245Z",
      "fromCache": false,
      "error": null,
      "initiator": "XMLHttpRequest",
      "priority": "high"
    },
    {
      "id": "req_002",
      "url": "https://cdn.example.com/script.js",
      "method": "GET",
      "resourceType": "script",
      "statusCode": 200,
      "statusMessage": "OK",
      "requestHeaders": {
        "user-agent": "Mozilla/5.0...",
        "accept": "*/*"
      },
      "responseHeaders": {
        "content-type": "application/javascript",
        "content-length": "12345",
        "cache-control": "public, max-age=31536000"
      },
      "requestBody": null,
      "responseBody": "// Script content...",
      "contentLength": 12345,
      "duration": 87,
      "startTime": "2026-06-20T14:32:35.000Z",
      "endTime": "2026-06-20T14:32:35.087Z",
      "fromCache": false,
      "error": null,
      "initiator": "<script>",
      "priority": "high"
    }
  ],
  "statistics": {
    "byResourceType": {
      "xhr": {
        "count": 15,
        "totalSize": 45230,
        "totalDuration": 2341
      },
      "script": {
        "count": 8,
        "totalSize": 145230,
        "totalDuration": 1200
      },
      "stylesheet": {
        "count": 3,
        "totalSize": 23450,
        "totalDuration": 450
      },
      "image": {
        "count": 42,
        "totalSize": 345000,
        "totalDuration": 3200
      },
      "document": {
        "count": 1,
        "totalSize": 45238,
        "totalDuration": 523
      }
    },
    "byStatusCode": {
      "200": 78,
      "304": 6,
      "404": 2,
      "500": 1
    },
    "totalSize": 603148,
    "totalDuration": 7714,
    "slowestRequest": {
      "url": "https://analytics.example.com/track",
      "duration": 2100
    },
    "largestRequest": {
      "url": "https://cdn.example.com/media.mp4",
      "contentLength": 145230
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Network analysis manager not available",
  "timestamp": "2026-06-20T14:32:45.123Z"
}
```

### Implementation Details
- Uses `NetworkAnalysisManager.exportCapture()` to get captured requests
- Applies filtering by `resourceType` and `minDuration` if specified
- Enriches each request with: headers, body (truncated), timing, cache status, errors
- Calculates comprehensive statistics: by resource type, by status code, slowest/largest requests
- Limits response body to first 10,000 characters to prevent payload bloat
- Returns all forensic metadata for traffic analysis

---

## 3. export_device_ids

### Purpose
Export device fingerprint, browser identifiers, and hardware characteristics for forensic analysis.

### Usage
```javascript
{
  "command": "export_device_ids"
}
```

### Parameters
None required.

### Response Example

```json
{
  "success": true,
  "timestamp": "2026-06-20T14:32:55.789Z",
  "deviceIdentifiers": {
    "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "appVersion": "5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "platform": "Linux x86_64",
    "hardwareConcurrency": 8,
    "deviceMemory": 16,
    "maxTouchPoints": 0,
    "screen": {
      "width": 1920,
      "height": 1080,
      "availWidth": 1920,
      "availHeight": 1040,
      "colorDepth": 24,
      "pixelDepth": 24,
      "orientation": "landscape-primary"
    },
    "language": "en-US",
    "languages": [
      "en-US",
      "en"
    ],
    "timezone": -240,
    "plugins": [
      {
        "name": "Chrome PDF Plugin",
        "description": "Portable Document Format",
        "version": "1.0"
      }
    ],
    "cookieEnabled": true,
    "doNotTrack": null,
    "webdriver": false,
    "vendor": "Google Inc.",
    "onLine": true
  },
  "fingerprint": {
    "canvas": {
      "hash": "7d8b9f2c1e5a3b6d",
      "data": "canvas fingerprint data"
    },
    "webgl": {
      "hash": "9c2d5e8f1a4b7c3e",
      "vendor": "Google Inc.",
      "renderer": "ANGLE (Intel)"
    },
    "webrtc": {
      "ipv4": "192.168.1.100",
      "ipv6": null,
      "mtu": 1500
    },
    "audio": {
      "hash": "4f7e9b2d1c8a5f3e",
      "context": "AudioContext"
    },
    "font": {
      "detectedFonts": 28,
      "hash": "2a8c4f9e1d5b7c3e"
    },
    "cssFeatures": [
      "supports-grid",
      "supports-flex",
      "supports-backdrop-filter"
    ],
    "storage": {
      "localStorage": 12,
      "sessionStorage": 5,
      "indexedDB": true
    }
  },
  "proxyInfo": {
    "enabled": true,
    "currentProxy": {
      "host": "proxy.example.com",
      "port": 8080,
      "protocol": "http"
    },
    "rotationMode": "round-robin"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error accessing device properties",
  "timestamp": "2026-06-20T14:32:55.789Z"
}
```

### Implementation Details
- Extracts device identifiers from browser APIs (`navigator`, `screen`, etc.)
- Retrieves active profile fingerprint data (canvas, webGL, webRTC, audio, fonts)
- Includes storage capacity summary (localStorage, sessionStorage, indexedDB)
- Integrates proxy information if proxy manager is available
- Captures timezone, language, hardware concurrency, device memory, touch points
- Returns complete fingerprint hash and vendor/renderer information

---

## 4. modify_element

### Purpose
Surgically modify DOM elements for testing, verification, or evasion purposes.

### Usage

#### Modify Text Content
```javascript
{
  "command": "modify_element",
  "selector": ".header h1",
  "type": "text",
  "value": "New Title"
}
```

#### Modify HTML
```javascript
{
  "command": "modify_element",
  "selector": "#content",
  "type": "html",
  "value": "<div>New HTML content</div>",
  "allMatches": false
}
```

#### Modify Attributes
```javascript
{
  "command": "modify_element",
  "selector": "input[type='email']",
  "type": "attribute",
  "attributeName": "placeholder",
  "value": "Enter your email"
}
```

#### Manage Classes
```javascript
{
  "command": "modify_element",
  "selector": ".button",
  "type": "class",
  "classOperation": "add",
  "className": "active"
}
```

#### Apply CSS Styles
```javascript
{
  "command": "modify_element",
  "selector": ".sidebar",
  "type": "css",
  "cssProperties": {
    "display": "none",
    "backgroundColor": "red",
    "opacity": "0.5"
  }
}
```

### Parameters
- `selector` (string, required): CSS selector for target element(s)
- `type` (string, required): Modification type - `'text'`, `'html'`, `'attribute'`, `'class'`, `'css'`
- `value` (string, required if type is 'text', 'html', or 'attribute'): New value
- `attributeName` (string, required if type='attribute'): Attribute name to modify
- `classOperation` (string, required if type='class'): `'add'`, `'remove'`, or `'toggle'`
- `className` (string, required if type='class'): Class name to modify
- `cssProperties` (object, required if type='css'): CSS property key-value pairs
- `allMatches` (boolean, optional): Apply to all matching elements (default: `true`)

### Response Examples

#### Text Modification
```json
{
  "success": true,
  "timestamp": "2026-06-20T14:33:10.234Z",
  "selector": ".header h1",
  "type": "text",
  "matched": 1,
  "modified": 1,
  "error": null
}
```

#### Class Addition (Multiple)
```json
{
  "success": true,
  "timestamp": "2026-06-20T14:33:10.234Z",
  "selector": ".button",
  "type": "class",
  "matched": 12,
  "modified": 12,
  "error": null
}
```

#### CSS Modification
```json
{
  "success": true,
  "timestamp": "2026-06-20T14:33:10.234Z",
  "selector": ".sidebar",
  "type": "css",
  "matched": 1,
  "modified": 1,
  "error": null
}
```

### Error Responses

#### Selector Not Found
```json
{
  "success": false,
  "timestamp": "2026-06-20T14:33:10.234Z",
  "selector": ".nonexistent",
  "type": "text",
  "matched": 0,
  "modified": 0,
  "error": "No elements matched selector"
}
```

#### Missing Required Parameter
```json
{
  "success": false,
  "error": "attributeName is required for attribute modification",
  "timestamp": "2026-06-20T14:33:10.234Z"
}
```

#### Window Not Available
```json
{
  "success": false,
  "error": "Window or webContents not available",
  "timestamp": "2026-06-20T14:33:10.234Z"
}
```

### Implementation Details
- Executes modifications in page context via `webContents.executeJavaScript()`
- Validates required parameters based on modification type
- Queries elements using `document.querySelectorAll(selector)`
- Applies modification to first element by default, all if `allMatches=true`
- Supports CSS property modification via `Object.assign(elem.style, cssProperties)`
- Returns count of matched and successfully modified elements
- Includes detailed error reporting for debugging

---

## Integration Points in websocket/server.js

### Location
Lines 7864-8251 (before Session Recording & Replay Commands section)

### Dependencies Used
- `this.mainWindow.webContents` - Electron WebContents for JavaScript execution
- `this.networkAnalysisManager` - Network traffic capture and analysis
- `this.profileManager` - Browser profile and fingerprint data
- `this.userAgentManager` - User agent management
- `this.proxyManager` - Proxy configuration and rotation

### Manager Requirements
All commands gracefully handle missing managers with appropriate error responses:
```javascript
if (!this.mainWindow || !this.mainWindow.webContents) {
  return { success: false, error: 'Window or webContents not available' };
}
```

---

## Usage Examples

### Example 1: Capture Full Page for Forensic Analysis
```javascript
// Step 1: Export raw HTML and network log
const html = await ws.sendCommand({
  command: 'export_raw_html'
});

const network = await ws.sendCommand({
  command: 'export_network_log',
  minDuration: 100
});

// Step 2: Save to files
fs.writeFileSync('page.html', html.html);
fs.writeFileSync('network.json', JSON.stringify(network, null, 2));
```

### Example 2: Device Fingerprint Verification
```javascript
const deviceIds = await ws.sendCommand({
  command: 'export_device_ids'
});

console.log('Device Canvas Hash:', deviceIds.fingerprint.canvas.hash);
console.log('WebGL Renderer:', deviceIds.fingerprint.webgl.renderer);
console.log('Proxy Status:', deviceIds.proxyInfo.enabled);
```

### Example 3: DOM Manipulation for Testing
```javascript
// Hide all tracking pixels
await ws.sendCommand({
  command: 'modify_element',
  selector: 'img[src*="tracking"]',
  type: 'css',
  cssProperties: { display: 'none' }
});

// Update form labels
await ws.sendCommand({
  command: 'modify_element',
  selector: 'label[for="email"]',
  type: 'text',
  value: 'Email Address (Required)'
});

// Add test class to buttons
await ws.sendCommand({
  command: 'modify_element',
  selector: 'button.submit',
  type: 'class',
  classOperation: 'add',
  className: 'test-mode'
});
```

---

## Performance Considerations

1. **export_raw_html**: Fast operation, HTML size dependent (~50-500ms typical)
2. **export_network_log**: Variable based on request count; enrichment adds ~10-50ms
3. **export_device_ids**: Moderate speed (~100-200ms) due to JavaScript execution
4. **modify_element**: DOM operations very fast (<10ms) unless targeting many elements

---

## Security Notes

- All commands execute in the browser's security context
- Modified DOM is user-visible and may trigger change detection
- HTML export includes full source including sensitive data in pages
- Network log contains request/response bodies (limited to 10KB)
- Device IDs expose browser fingerprinting data
- Commands are subject to existing WebSocket authentication/authorization

---

## Forensic Accuracy

All commands include:
- `timestamp`: ISO 8601 timestamp of command execution
- Response headers and status codes for `export_raw_html`
- Complete request/response metadata for network capture
- Hardware/software identifiers for fingerprinting
- DOM modification audit trail via return values

This ensures comprehensive forensic documentation of browser state and activity.

---

## Related Commands

- `get_content` - Alternative HTML extraction (without headers)
- `export_network_capture` - Network export (base format)
- `get_active_profile` - Profile information
- `get_custom_headers` - Current request headers
- `screenshot` / `screenshot_full_page` - Visual capture
- `execute_javascript` - Custom JavaScript execution (if available)

---

## Version
- **Added:** v12.7.0
- **Status:** Production Ready
- **Last Updated:** June 20, 2026
