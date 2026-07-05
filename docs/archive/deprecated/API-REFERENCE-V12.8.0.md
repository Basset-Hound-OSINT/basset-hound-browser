# Basset Hound Browser - API Reference v12.8.0

**Version**: 12.8.0 (Production Ready)  
**Release Date**: June 21, 2026  
**Protocol**: WebSocket (JSON messages)  
**Default Port**: 8765  
**Status**: Phase 1 Forensic Commands Complete (50 commands)  
**Total Commands**: 140+ WebSocket commands  

---

## CRITICAL NOTICE: OPEN ACCESS - NO AUTHENTICATION

**This is a DEVELOPMENT TOOL.** All commands are OPEN and UNRESTRICTED. No authentication or authorization is enforced. This documentation is for authorized developers only.

**DO NOT EXPOSE TO UNTRUSTED NETWORKS.** Bind to localhost only.

---

## Table of Contents

1. [Connection & Protocol](#connection--protocol)
2. [v12.8.0 New Features](#v128-new-features)
3. [Command Categories](#command-categories)
4. [Core Commands Reference](#core-commands-reference)
5. [Phase 1 Forensic Commands (NEW)](#phase-1-forensic-commands-new)
6. [Error Handling & Recovery](#error-handling--recovery)
7. [Quick Start Examples](#quick-start-examples)

---

## Connection & Protocol

### WebSocket Connection

```
ws://localhost:8765       # Standard connection (unencrypted)
wss://localhost:8765      # SSL/TLS connection (if configured)
```

### Message Format

#### Request
```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "param1": "value1",
  "param2": "value2"
}
```

#### Success Response
```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "success": true,
  "data": { }
}
```

#### Error Response
```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "recovery": {
    "suggestion": "...",
    "alternativeCommands": [...]
  }
}
```

### Authentication (Disabled)

Authentication is **disabled by default** in v12.8.0 (development mode).

```javascript
// These methods are available but not required:

// Via query parameter
ws://localhost:8765?token=YOUR_TOKEN

// Via header
Authorization: Bearer YOUR_TOKEN

// Via authenticate command
{ "id": 1, "command": "authenticate", "token": "YOUR_TOKEN" }
```

---

## v12.8.0 New Features

### Phase 1 Forensic Commands (50 new commands)

Organized into 5 feature areas:

1. **HTML Capture & DOM Snapshots (17 commands)**
   - Complete HTML page capture with metadata
   - Full DOM snapshots with JavaScript state
   - Element-level extraction
   - History and diff tracking

2. **Export Formats & Templates (18 commands)**
   - Multiple export formats: JSON, CSV, HAR, HTML, Markdown
   - Custom export templates
   - Encryption support
   - Metadata preservation

3. **Batch Operations (8 commands)**
   - Batch URL processing
   - Parallel extraction
   - Progress tracking
   - Failure recovery

4. **Correlation & Analysis (5 commands)**
   - Cross-evidence correlation
   - Pattern detection
   - Anomaly detection
   - Timeline analysis

5. **JavaScript & Console Extraction (10 commands)**
   - Complete JavaScript context extraction
   - Console log history
   - Error tracking
   - Performance metrics

---

## Command Categories

| Category | Count | Description |
|----------|-------|-------------|
| **Navigation & Interaction** | 15+ | Navigate, click, fill, scroll, interact |
| **Content Extraction** | 20+ | Get HTML, text, links, forms, metadata |
| **Screenshots & Recording** | 12+ | Capture viewport, full-page, element, record |
| **Proxy Management** | 12+ | Set, rotate, test proxies; manage lists |
| **User Agent Management** | 10+ | Set, rotate, manage user agents |
| **Request Interception** | 15+ | Block, allow, modify headers, rules |
| **Cookie Management** | 8+ | Get, set, import, export, manage cookies |
| **Profile Management** | 8+ | Create, switch, persist profiles |
| **Session Management** | 10+ | Create, switch, persist, track sessions |
| **Storage Management** | 8+ | localStorage, sessionStorage, IndexedDB |
| **Tab Management** | 10+ | Create, switch, close, manage tabs |
| **HTML Capture** | 17+ | **NEW** Complete HTML and DOM extraction |
| **Export Formats** | 18+ | **NEW** Multiple format export with templates |
| **Batch Operations** | 8+ | **NEW** Batch URL processing and extraction |
| **Correlation & Analysis** | 5+ | **NEW** Evidence correlation and pattern detection |
| **JavaScript Extraction** | 10+ | **NEW** JavaScript context and console logs |

**Total: 140+ commands**

---

## Core Commands Reference

### Navigation & Interaction Commands

#### navigate
Navigate to a URL.
```json
{
  "id": "1",
  "command": "navigate",
  "url": "https://example.com"
}
```
**Response**: `{ "success": true, "data": { "url": "...", "loaded": true } }`

#### get_url
Get the current page URL.
```json
{
  "id": "2",
  "command": "get_url"
}
```

#### back
Navigate to previous page.
```json
{
  "id": "3",
  "command": "back"
}
```

#### forward
Navigate to next page.
```json
{
  "id": "4",
  "command": "forward"
}
```

#### refresh
Refresh the current page.
```json
{
  "id": "5",
  "command": "refresh"
}
```

#### click
Click an element.
```json
{
  "id": "6",
  "command": "click",
  "selector": "#submit-button"
}
```

#### fill
Fill a form field with text.
```json
{
  "id": "7",
  "command": "fill",
  "selector": "input[name='search']",
  "value": "search query"
}
```

#### scroll
Scroll the page or to an element.
```json
{
  "id": "8",
  "command": "scroll",
  "selector": "#target-element"
}
```

#### wait_for_element
Wait for an element to appear (timeout: 30s).
```json
{
  "id": "9",
  "command": "wait_for_element",
  "selector": ".dynamic-element"
}
```

#### wait_for_navigation
Wait for page navigation to complete.
```json
{
  "id": "10",
  "command": "wait_for_navigation"
}
```

#### execute_script
Execute JavaScript code.
```json
{
  "id": "11",
  "command": "execute_script",
  "script": "return document.title"
}
```

### Content Extraction Commands

#### get_content
Get page HTML and text content.
```json
{
  "id": "12",
  "command": "get_content"
}
```
**Response**: `{ "success": true, "data": { "html": "...", "text": "...", "title": "..." } }`

#### get_page_state
Get page structure (forms, links, buttons, inputs).
```json
{
  "id": "13",
  "command": "get_page_state"
}
```

#### extract_links
Extract all links from the page.
```json
{
  "id": "14",
  "command": "extract_links"
}
```

#### extract_forms
Extract form data and structure.
```json
{
  "id": "15",
  "command": "extract_forms"
}
```

#### extract_images
Extract image URLs and metadata.
```json
{
  "id": "16",
  "command": "extract_images"
}
```

### Screenshot Commands

#### screenshot
Capture current viewport screenshot.
```json
{
  "id": "17",
  "command": "screenshot"
}
```
**Response**: `{ "success": true, "data": { "image": "data:image/png;base64,..." } }`

#### screenshot_full_page
Capture full page screenshot (scrolls entire page).
```json
{
  "id": "18",
  "command": "screenshot_full_page"
}
```

#### screenshot_element
Capture specific element screenshot.
```json
{
  "id": "19",
  "command": "screenshot_element",
  "selector": "#target-element"
}
```

### Proxy Management Commands

#### set_proxy
Set a single proxy.
```json
{
  "id": "20",
  "command": "set_proxy",
  "host": "proxy.example.com",
  "port": 8080,
  "type": "http",
  "auth": {
    "username": "user",
    "password": "pass"
  }
}
```

#### get_proxy_status
Get current proxy configuration.
```json
{
  "id": "21",
  "command": "get_proxy_status"
}
```

#### clear_proxy
Disable proxy (direct connection).
```json
{
  "id": "22",
  "command": "clear_proxy"
}
```

#### set_proxy_list
Set multiple proxies for rotation.
```json
{
  "id": "23",
  "command": "set_proxy_list",
  "proxies": [
    {"host": "proxy1.com", "port": 8080, "type": "http"},
    {"host": "proxy2.com", "port": 1080, "type": "socks5"}
  ]
}
```

#### start_proxy_rotation
Start automatic proxy rotation.
```json
{
  "id": "24",
  "command": "start_proxy_rotation",
  "intervalMs": 300000,
  "mode": "random"
}
```

#### stop_proxy_rotation
Stop automatic proxy rotation.
```json
{
  "id": "25",
  "command": "stop_proxy_rotation"
}
```

#### test_proxy
Test proxy connection.
```json
{
  "id": "26",
  "command": "test_proxy",
  "host": "proxy.example.com",
  "port": 8080
}
```

### User Agent Management Commands

#### set_user_agent
Set a specific user agent.
```json
{
  "id": "27",
  "command": "set_user_agent",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
}
```

#### get_user_agent_status
Get current user agent.
```json
{
  "id": "28",
  "command": "get_user_agent_status"
}
```

#### get_random_user_agent
Get a random user agent.
```json
{
  "id": "29",
  "command": "get_random_user_agent"
}
```

#### start_user_agent_rotation
Start automatic user agent rotation.
```json
{
  "id": "30",
  "command": "start_user_agent_rotation",
  "intervalMs": 600000,
  "mode": "random"
}
```

#### stop_user_agent_rotation
Stop automatic user agent rotation.
```json
{
  "id": "31",
  "command": "stop_user_agent_rotation"
}
```

### Cookie Management Commands

#### get_cookies
Get cookies for a URL.
```json
{
  "id": "32",
  "command": "get_cookies",
  "url": "https://example.com"
}
```

#### set_cookies
Set cookies.
```json
{
  "id": "33",
  "command": "set_cookies",
  "cookies": [
    {"name": "session", "value": "abc123", "domain": "example.com"}
  ]
}
```

#### get_all_cookies
Get all cookies.
```json
{
  "id": "34",
  "command": "get_all_cookies"
}
```

#### clear_cookies
Clear all cookies.
```json
{
  "id": "35",
  "command": "clear_cookies"
}
```

### Tab Management Commands

#### create_tab
Create a new tab.
```json
{
  "id": "36",
  "command": "create_tab",
  "url": "https://example.com"
}
```

#### list_tabs
List all open tabs.
```json
{
  "id": "37",
  "command": "list_tabs"
}
```

#### switch_to_tab
Switch to a specific tab.
```json
{
  "id": "38",
  "command": "switch_to_tab",
  "tabId": "tab-123"
}
```

#### close_tab
Close a tab.
```json
{
  "id": "39",
  "command": "close_tab",
  "tabId": "tab-123"
}
```

### Session Management Commands

#### create_session
Create a new session.
```json
{
  "id": "40",
  "command": "create_session",
  "name": "my-session"
}
```

#### list_sessions
List all sessions.
```json
{
  "id": "41",
  "command": "list_sessions"
}
```

#### switch_session
Switch to a session.
```json
{
  "id": "42",
  "command": "switch_session",
  "sessionId": "session-123"
}
```

#### save_session
Save current session state.
```json
{
  "id": "43",
  "command": "save_session"
}
```

### Health & Status Commands

#### ping
Health check.
```json
{
  "id": "44",
  "command": "ping"
}
```
**Response**: `{ "success": true, "data": { "pong": true } }`

#### status
Get browser status.
```json
{
  "id": "45",
  "command": "status"
}
```
**Response**: `{ "success": true, "data": { "version": "12.8.0", "uptime": 12345, "connectedClients": 1 } }`

---

## Phase 1 Forensic Commands (NEW)

### HTML Capture Commands

#### capture_html
Capture complete page HTML with metadata.

```json
{
  "id": "46",
  "command": "capture_html",
  "includeMetadata": true,
  "preserveScripts": false,
  "removeScripts": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "html": "<html>...</html>",
    "metadata": {
      "title": "...",
      "url": "...",
      "timestamp": 1234567890,
      "charset": "utf-8"
    }
  }
}
```

#### capture_html_clean
Capture HTML with script and style removal.

```json
{
  "id": "47",
  "command": "capture_html_clean"
}
```

#### capture_html_with_styles
Capture HTML preserving all styles.

```json
{
  "id": "48",
  "command": "capture_html_with_styles"
}
```

### DOM Snapshot Commands

#### capture_dom_snapshot
Capture complete DOM snapshot with state.

```json
{
  "id": "49",
  "command": "capture_dom_snapshot",
  "includeComputedStyles": true,
  "includeEventListeners": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "snapshot": { "nodeId": 1, "tag": "html", "children": [...] },
    "computedStyles": {...},
    "eventListeners": {...}
  }
}
```

#### capture_dom_tree
Capture DOM tree structure.

```json
{
  "id": "50",
  "command": "capture_dom_tree"
}
```

#### get_dom_diff
Get changes since last snapshot.

```json
{
  "id": "51",
  "command": "get_dom_diff"
}
```

### JavaScript & Console Extraction

#### extract_javascript_context
Extract all JavaScript state and variables.

```json
{
  "id": "52",
  "command": "extract_javascript_context"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "globalVariables": {...},
    "functionList": [...],
    "modules": [...],
    "state": {...}
  }
}
```

#### get_console_logs
Get console output history.

```json
{
  "id": "53",
  "command": "get_console_logs",
  "since": 1234567890
}
```

#### get_console_errors
Get console errors only.

```json
{
  "id": "54",
  "command": "get_console_errors"
}
```

#### get_performance_metrics
Get page performance metrics.

```json
{
  "id": "55",
  "command": "get_performance_metrics"
}
```

### Export Format Commands

#### export_as_json
Export page data as JSON.

```json
{
  "id": "56",
  "command": "export_as_json",
  "includeMetadata": true,
  "pretty": true
}
```

#### export_as_csv
Export page data as CSV.

```json
{
  "id": "57",
  "command": "export_as_csv",
  "fields": ["title", "url", "timestamp"]
}
```

#### export_as_har
Export as HAR (HTTP Archive) format.

```json
{
  "id": "58",
  "command": "export_as_har",
  "includeNetworkLog": true
}
```

#### export_as_html
Export as self-contained HTML file.

```json
{
  "id": "59",
  "command": "export_as_html",
  "includeImages": false,
  "includeStyles": true
}
```

#### export_as_markdown
Export as Markdown format.

```json
{
  "id": "60",
  "command": "export_as_markdown"
}
```

### Export Template Commands

#### create_export_template
Create custom export template.

```json
{
  "id": "61",
  "command": "create_export_template",
  "name": "my-template",
  "format": "json",
  "fields": ["title", "url", "html", "metadata"],
  "transformations": []
}
```

#### list_export_templates
List all export templates.

```json
{
  "id": "62",
  "command": "list_export_templates"
}
```

#### export_with_template
Export using a template.

```json
{
  "id": "63",
  "command": "export_with_template",
  "templateName": "my-template"
}
```

#### delete_export_template
Delete an export template.

```json
{
  "id": "64",
  "command": "delete_export_template",
  "templateName": "my-template"
}
```

### Batch Operations Commands

#### batch_extract_urls
Extract data from multiple URLs.

```json
{
  "id": "65",
  "command": "batch_extract_urls",
  "urls": ["https://example.com", "https://example.org"],
  "parallel": 2,
  "timeout": 30000,
  "extractOptions": {
    "html": true,
    "screenshots": false,
    "links": true
  }
}
```

#### batch_status
Get batch operation status.

```json
{
  "id": "66",
  "command": "batch_status",
  "batchId": "batch-123"
}
```

#### batch_cancel
Cancel a batch operation.

```json
{
  "id": "67",
  "command": "batch_cancel",
  "batchId": "batch-123"
}
```

#### batch_results
Get results from completed batch.

```json
{
  "id": "68",
  "command": "batch_results",
  "batchId": "batch-123"
}
```

### Correlation & Analysis Commands

#### correlate_evidence
Find correlations across evidence items.

```json
{
  "id": "69",
  "command": "correlate_evidence",
  "evidenceIds": ["evidence-1", "evidence-2"],
  "correlationType": "timeline"
}
```

#### detect_patterns
Detect patterns in evidence.

```json
{
  "id": "70",
  "command": "detect_patterns",
  "evidenceId": "evidence-123",
  "patternType": "repeated_elements"
}
```

#### detect_anomalies
Detect anomalies in evidence.

```json
{
  "id": "71",
  "command": "detect_anomalies",
  "evidenceId": "evidence-123"
}
```

#### analyze_timeline
Build timeline from evidence.

```json
{
  "id": "72",
  "command": "analyze_timeline",
  "evidenceIds": ["evidence-1", "evidence-2"]
}
```

#### build_correlation_graph
Build graph of correlated evidence.

```json
{
  "id": "73",
  "command": "build_correlation_graph",
  "evidenceIds": ["evidence-1", "evidence-2"]
}
```

---

## Error Handling & Recovery

### Error Response Structure

```json
{
  "id": "123",
  "command": "navigate",
  "success": false,
  "error": "Navigation failed: ERR_NAME_NOT_RESOLVED",
  "code": "NAVIGATION_ERROR",
  "recovery": {
    "suggestion": "Check the URL and network connection...",
    "alternativeCommands": ["get_proxy_status", "status"],
    "recoverable": true
  }
}
```

### Common Errors

| Error Code | Cause | Recovery |
|------------|-------|----------|
| `NAVIGATION_ERROR` | URL invalid or unreachable | Check URL, proxy, network |
| `ELEMENT_NOT_FOUND` | Selector didn't match any element | Verify selector, use `get_page_state` |
| `TIMEOUT` | Operation exceeded time limit | Increase timeout, check page speed |
| `MANAGER_UNAVAILABLE` | Manager not initialized | Wait a few seconds, retry |
| `INVALID_PARAMS` | Missing or invalid parameters | Check command documentation |
| `SCRIPT_ERROR` | JavaScript execution failed | Check script syntax, page context |

### Retry Logic

Commands are automatically retried up to 3 times for transient errors:
- `ETIMEDOUT`
- `ECONNRESET`
- `ECONNREFUSED`
- `EPIPE`
- `ENOTFOUND`

---

## Quick Start Examples

### Python

```python
import asyncio
import json
import websockets

async def main():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Navigate
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        response = json.loads(await ws.recv())
        print(f"Navigation: {response['success']}")

        # Wait for page
        await asyncio.sleep(2)

        # Capture HTML (NEW - v12.8.0)
        await ws.send(json.dumps({
            "id": "2",
            "command": "capture_html",
            "includeMetadata": True
        }))
        response = json.loads(await ws.recv())
        html = response['data']['html']
        print(f"Captured {len(html)} bytes of HTML")

        # Extract links
        await ws.send(json.dumps({
            "id": "3",
            "command": "extract_links"
        }))
        response = json.loads(await ws.recv())
        links = response['data']['links']
        print(f"Found {len(links)} links")

asyncio.run(main())
```

### Node.js

```javascript
const WebSocket = require('ws');

async function main() {
  const ws = new WebSocket('ws://localhost:8765');

  ws.on('open', () => {
    ws.send(JSON.stringify({
      id: '1',
      command: 'navigate',
      url: 'https://example.com'
    }));
  });

  ws.on('message', (data) => {
    const response = JSON.parse(data);
    console.log(`Response:`, response);
  });
}

main();
```

---

## Version History

- **v12.8.0** (June 21, 2026) - Phase 1 Forensic Commands: 50 new commands for HTML capture, DOM snapshots, JavaScript extraction, export formats, batch operations, and correlation
- **v12.7.0** (June 16, 2026) - Real-world testing validation, 4/4 websites successful, 0 bot detections
- **v12.0.0** (May 11, 2026) - Production deployment, 164 core commands, performance optimization
- **v11.x** - Initial releases with bot evasion, fingerprinting, proxy support

---

## Support & Documentation

- **Main README**: [README.md](../README.md)
- **Authoritative Reference**: [API-REFERENCE-AUTHORITATIVE.md](API-REFERENCE-AUTHORITATIVE.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Release Notes**: [RELEASE-NOTES-v12.1.0.md](RELEASE-NOTES-v12.1.0.md)

