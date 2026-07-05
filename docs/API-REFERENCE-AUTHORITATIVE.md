> ⚠️ **OUTDATED** — see `docs/planning/PROJECT-STATUS-MATRIX.md` for the authoritative status (2026-07-04). Claims below are inflated/unverified. Despite the "AUTHORITATIVE" name, command schemas here are not verified against the running server (e.g. `extract_links` returns categorized keys `{internal,external,mailto,...,all[],count}`, not `{links,total}`), and "300+ commands" conflates written handlers with proven-working ones. Only a small core subset is verified.

# Basset Hound Browser - Complete WebSocket API Reference

**Version**: 12.2.0 (Enterprise Ready)
**Protocol**: WebSocket (JSON messages)
**Default Port**: 8765
**Last Updated**: June 3, 2026
**Total Commands**: 300+ WebSocket commands

## Table of Contents

1. [Connection & Authentication](#connection--authentication)
2. [Message Format & Protocol](#message-format--protocol)
3. [Navigation Commands](#navigation-commands)
4. [Content Extraction Commands](#content-extraction-commands)
5. [Screenshot Commands](#screenshot-commands)
6. [Input & Interaction Commands](#input--interaction-commands)
7. [Storage & Cookie Management](#storage--cookie-management)
8. [Proxy & Network Commands](#proxy--network-commands)
9. [Session Management](#session-management)
10. [Bot Evasion & Fingerprinting](#bot-evasion--fingerprinting)
11. [Recording & Playback](#recording--playback)
12. [Window & Tab Management](#window--tab-management)
13. [Performance & Monitoring](#performance--monitoring)
14. [Plugin System](#plugin-system)
15. [Tor Integration](#tor-integration)
16. [Error Handling & Recovery](#error-handling--recovery)
17. [Advanced Features](#advanced-features)

---

## Connection & Authentication

### WebSocket Connection

```
ws://localhost:8765     # Standard connection
wss://localhost:8765    # SSL/TLS connection (if configured)
```

### Authentication Methods

**1. Query Parameter**
```javascript
ws://localhost:8765?token=YOUR_TOKEN
```

**2. Bearer Token Header**
```javascript
Authorization: Bearer YOUR_TOKEN
```

**3. Authenticate Command**
```json
{
  "id": 1,
  "command": "authenticate",
  "token": "YOUR_TOKEN"
}
```

**Response:**
```json
{
  "id": 1,
  "command": "authenticate",
  "success": true,
  "data": {
    "authenticated": true,
    "sessionId": "sess_xxxxx",
    "expiresAt": 1623847382000
  }
}
```

### Connection Validation

**Ping Command**
```json
{
  "id": 2,
  "command": "ping"
}
```

**Response:**
```json
{
  "id": 2,
  "command": "ping",
  "success": true,
  "data": {
    "pong": true,
    "latency": 2.5,
    "timestamp": 1623847382000
  }
}
```

---

## Message Format & Protocol

### Request Format

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "param1": "value1",
  "param2": "value2",
  "timeout": 30000
}
```

**Required Fields:**
- `id` (string/number): Unique identifier for request-response matching
- `command` (string): Command name

**Optional Fields:**
- `timeout` (number, ms): Request timeout (default: 30000ms)

### Success Response Format

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "success": true,
  "data": {
    "result": "...",
    "timestamp": 1623847382000
  }
}
```

### Error Response Format

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "recovery": {
    "recoverable": true,
    "suggestion": "Suggestion for recovery",
    "alternativeCommands": ["command1", "command2"]
  }
}
```

### Status & Timing Information

**Important: Timing Requirements**

After calling `navigate`, wait 2-4 seconds (or use `wait_for_element`) before calling:
- `get_page_state`
- `get_content`
- `execute_script`
- `screenshot`
- `click`, `fill`, `scroll`
- `extract_*` commands

This is standard browser automation behavior.

---

## Navigation Commands

### navigate

Navigate to a URL with optional timeout and error handling.

**Request:**
```json
{
  "id": 1,
  "command": "navigate",
  "url": "https://example.com",
  "timeout": 30000
}
```

**Parameters:**
- `url` (string, required): URL to navigate to
- `timeout` (number, optional, default: 10000): Maximum time to wait for navigation (ms)

**Response:**
```json
{
  "id": 1,
  "success": true,
  "data": {
    "url": "https://example.com",
    "tabId": "tab_123",
    "timestamp": 1623847382000,
    "torAutoMode": {
      "handled": true,
      "action": "enabled_tor"
    }
  }
}
```

**Error Cases:**
- Invalid URL format
- .onion URL without Tor mode enabled
- Network unreachable
- DNS resolution failure
- Timeout

**Example (JavaScript):**
```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  ws.send(JSON.stringify({
    id: 1,
    command: "navigate",
    url: "https://example.com",
    timeout: 30000
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  if (response.success) {
    console.log('Navigated to:', response.data.url);
  } else {
    console.error('Navigation failed:', response.error);
  }
};
```

### reload_tab

Reload the current tab.

**Request:**
```json
{
  "id": 2,
  "command": "reload_tab",
  "tabId": "tab_123",
  "timeout": 15000
}
```

**Parameters:**
- `tabId` (string, optional): Tab ID to reload (default: active tab)
- `timeout` (number, optional, default: 15000): Reload timeout (ms)

**Response:**
```json
{
  "id": 2,
  "success": true,
  "data": {
    "reloaded": true,
    "url": "https://example.com"
  }
}
```

### tab_back / tab_forward

Navigate back or forward in tab history.

**Request:**
```json
{
  "id": 3,
  "command": "tab_back"
}
```

**Response:**
```json
{
  "id": 3,
  "success": true,
  "data": {
    "url": "https://previous.com",
    "timestamp": 1623847382000
  }
}
```

### tab_navigate / navigate_tab

Navigate a specific tab by ID.

**Request:**
```json
{
  "id": 4,
  "command": "navigate_tab",
  "tabId": "tab_123",
  "url": "https://example.com"
}
```

### get_url

Get the current page URL.

**Request:**
```json
{
  "id": 5,
  "command": "get_url"
}
```

**Response:**
```json
{
  "id": 5,
  "success": true,
  "data": {
    "url": "https://example.com",
    "tabId": "tab_123"
  }
}
```

### get_page_state

Get current page state including DOM readiness and resources.

**Request:**
```json
{
  "id": 6,
  "command": "get_page_state"
}
```

**Response:**
```json
{
  "id": 6,
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Example Domain",
    "readyState": "complete",
    "domReady": true,
    "resourcesLoaded": true,
    "performanceMetrics": {
      "navigationStart": 1623847380000,
      "loadEventEnd": 1623847382500,
      "pageLoadTime": 2500
    }
  }
}
```

### wait_for_element

Wait for an element to appear with timeout.

**Request:**
```json
{
  "id": 7,
  "command": "wait_for_element",
  "selector": ".result",
  "timeout": 10000,
  "visible": true
}
```

**Parameters:**
- `selector` (string, required): CSS or XPath selector
- `timeout` (number, optional, default: 5000): Wait timeout (ms)
- `visible` (boolean, optional, default: true): Wait for visibility or just existence

**Response:**
```json
{
  "id": 7,
  "success": true,
  "data": {
    "found": true,
    "visible": true,
    "element": {
      "selector": ".result",
      "tagName": "div",
      "id": "result_1"
    },
    "waitTime": 245
  }
}
```

---

## Content Extraction Commands

### get_content

Get page HTML content.

**Request:**
```json
{
  "id": 8,
  "command": "get_content",
  "includeMetadata": true
}
```

**Parameters:**
- `includeMetadata` (boolean, optional): Include page metadata

**Response:**
```json
{
  "id": 8,
  "success": true,
  "data": {
    "html": "<!DOCTYPE html>...",
    "size": 45320,
    "metadata": {
      "title": "Example Domain",
      "description": "...",
      "keywords": "..."
    }
  }
}
```

### extract_all

Extract all content types from page.

**Request:**
```json
{
  "id": 9,
  "command": "extract_all",
  "types": ["text", "links", "images", "forms"]
}
```

**Response:**
```json
{
  "id": 9,
  "success": true,
  "data": {
    "text": "...",
    "links": [...],
    "images": [...],
    "forms": [...]
  }
}
```

### extract_links

Extract all links from page.

**Request:**
```json
{
  "id": 10,
  "command": "extract_links"
}
```

**Response:**
```json
{
  "id": 10,
  "success": true,
  "data": {
    "links": [
      {
        "href": "https://example.com/page1",
        "text": "Page 1",
        "title": "Go to Page 1"
      }
    ],
    "total": 42
  }
}
```

### extract_images

Extract all images from page.

**Request:**
```json
{
  "id": 11,
  "command": "extract_images",
  "includeAttributes": true
}
```

**Response:**
```json
{
  "id": 11,
  "success": true,
  "data": {
    "images": [
      {
        "src": "https://example.com/image.jpg",
        "alt": "Image description",
        "width": 640,
        "height": 480,
        "title": "Image title"
      }
    ],
    "total": 15
  }
}
```

### extract_forms

Extract all forms from page.

**Request:**
```json
{
  "id": 12,
  "command": "extract_forms"
}
```

**Response:**
```json
{
  "id": 12,
  "success": true,
  "data": {
    "forms": [
      {
        "id": "search-form",
        "method": "GET",
        "action": "https://example.com/search",
        "fields": [
          {
            "name": "q",
            "type": "text",
            "value": "",
            "required": true
          }
        ]
      }
    ],
    "total": 3
  }
}
```

### extract_metadata

Extract page metadata (SEO, social media, etc).

**Request:**
```json
{
  "id": 13,
  "command": "extract_metadata"
}
```

**Response:**
```json
{
  "id": 13,
  "success": true,
  "data": {
    "title": "Example Domain",
    "description": "Example description",
    "keywords": "example, domain",
    "canonical": "https://example.com",
    "ogData": {
      "title": "Example",
      "description": "...",
      "image": "https://example.com/og.jpg"
    },
    "twitterData": {
      "card": "summary",
      "title": "..."
    }
  }
}
```

### extract_scripts

Extract all scripts from page.

**Request:**
```json
{
  "id": 14,
  "command": "extract_scripts"
}
```

**Response:**
```json
{
  "id": 14,
  "success": true,
  "data": {
    "scripts": [
      {
        "type": "text/javascript",
        "src": "https://example.com/script.js",
        "inline": false,
        "async": true
      }
    ],
    "total": 8
  }
}
```

### extract_stylesheets

Extract all stylesheets from page.

**Request:**
```json
{
  "id": 15,
  "command": "extract_stylesheets"
}
```

**Response:**
```json
{
  "id": 15,
  "success": true,
  "data": {
    "stylesheets": [
      {
        "href": "https://example.com/style.css",
        "media": "screen",
        "rel": "stylesheet"
      }
    ],
    "total": 5
  }
}
```

### extract_structured_data

Extract JSON-LD and Schema.org structured data.

**Request:**
```json
{
  "id": 16,
  "command": "extract_structured_data"
}
```

**Response:**
```json
{
  "id": 16,
  "success": true,
  "data": {
    "jsonld": [...],
    "microdata": [...],
    "rdfa": [...]
  }
}
```

### detect_technologies

Detect technologies used on page.

**Request:**
```json
{
  "id": 17,
  "command": "detect_technologies"
}
```

**Response:**
```json
{
  "id": 17,
  "success": true,
  "data": {
    "technologies": [
      {
        "name": "React",
        "category": "JavaScript Framework",
        "version": "18.2.0",
        "confidence": 95
      }
    ]
  }
}
```

---

## Screenshot Commands

### screenshot

Capture full page screenshot.

**Request:**
```json
{
  "id": 18,
  "command": "screenshot",
  "format": "png",
  "quality": 90,
  "fullPage": true
}
```

**Parameters:**
- `format` (string, optional): "png", "jpeg", "webp" (default: "png")
- `quality` (number, optional): 0-100 (default: 90, jpeg only)
- `fullPage` (boolean, optional): Capture full page or viewport

**Response:**
```json
{
  "id": 18,
  "success": true,
  "data": {
    "screenshot": "base64-encoded-image",
    "format": "png",
    "width": 1920,
    "height": 1080,
    "size": 245320,
    "timestamp": 1623847382000
  }
}
```

### screenshot_viewport

Capture viewport-only screenshot.

**Request:**
```json
{
  "id": 19,
  "command": "screenshot_viewport",
  "format": "png"
}
```

**Response:**
```json
{
  "id": 19,
  "success": true,
  "data": {
    "screenshot": "base64-encoded-image",
    "width": 1920,
    "height": 1080
  }
}
```

### screenshot_element

Capture specific element.

**Request:**
```json
{
  "id": 20,
  "command": "screenshot_element",
  "selector": "#main-content",
  "format": "png"
}
```

**Response:**
```json
{
  "id": 20,
  "success": true,
  "data": {
    "screenshot": "base64-encoded-image",
    "selector": "#main-content",
    "width": 800,
    "height": 600
  }
}
```

### screenshot_area

Capture specific area by coordinates.

**Request:**
```json
{
  "id": 21,
  "command": "screenshot_area",
  "x": 100,
  "y": 100,
  "width": 800,
  "height": 600,
  "format": "png"
}
```

### screenshot_full_page

Capture entire scrollable page.

**Request:**
```json
{
  "id": 22,
  "command": "screenshot_full_page",
  "format": "png",
  "quality": 85
}
```

### annotate_screenshot

Add annotations to screenshot.

**Request:**
```json
{
  "id": 23,
  "command": "annotate_screenshot",
  "screenshot": "base64-image",
  "annotations": [
    {
      "type": "box",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 200,
      "color": "red",
      "label": "Important"
    },
    {
      "type": "arrow",
      "fromX": 100,
      "fromY": 100,
      "toX": 300,
      "toY": 300,
      "color": "blue"
    }
  ]
}
```

**Parameters:**
- `screenshot` (string): Base64-encoded screenshot
- `annotations` (array): Array of annotation objects

**Annotation Types:**
- `box`: Rectangle with label
- `arrow`: Directional arrow
- `circle`: Circle annotation
- `line`: Line annotation
- `text`: Text annotation
- `highlight`: Area highlight

---

## Input & Interaction Commands

### click

Click element by selector.

**Request:**
```json
{
  "id": 24,
  "command": "click",
  "selector": "button.submit",
  "humanize": true,
  "button": "left"
}
```

**Parameters:**
- `selector` (string, required): CSS or XPath selector
- `humanize` (boolean, optional, default: true): Add human-like delay
- `button` (string, optional): "left", "right", "middle" (default: "left")
- `clickCount` (number, optional): Number of clicks (default: 1)

**Response:**
```json
{
  "id": 24,
  "success": true,
  "data": {
    "clicked": true,
    "element": {
      "tagName": "button",
      "id": "submit"
    }
  }
}
```

### fill

Fill form field with text.

**Request:**
```json
{
  "id": 25,
  "command": "fill",
  "selector": "input[name='email']",
  "value": "user@example.com",
  "humanize": true
}
```

**Parameters:**
- `selector` (string, required): Input selector
- `value` (string, required): Value to fill
- `humanize` (boolean, optional, default: true): Human-like typing

**Response:**
```json
{
  "id": 25,
  "success": true,
  "data": {
    "filled": true,
    "value": "user@example.com"
  }
}
```

### type_text

Type text with individual key presses.

**Request:**
```json
{
  "id": 26,
  "command": "type_text",
  "text": "Hello World",
  "delay": 50
}
```

**Parameters:**
- `text` (string, required): Text to type
- `delay` (number, optional): Delay between keypresses (ms)

**Response:**
```json
{
  "id": 26,
  "success": true,
  "data": {
    "typed": true,
    "text": "Hello World"
  }
}
```

### key_press

Press a single key.

**Request:**
```json
{
  "id": 27,
  "command": "key_press",
  "key": "Enter"
}
```

**Parameters:**
- `key` (string): Key name (Enter, Tab, Escape, etc.)

### key_combination

Press key combination (e.g., Ctrl+C).

**Request:**
```json
{
  "id": 28,
  "command": "key_combination",
  "keys": ["Control", "c"]
}
```

### mouse_click

Click at specific coordinates.

**Request:**
```json
{
  "id": 29,
  "command": "mouse_click",
  "x": 500,
  "y": 300,
  "button": "left"
}
```

### mouse_double_click

Double-click at coordinates.

**Request:**
```json
{
  "id": 30,
  "command": "mouse_double_click",
  "x": 500,
  "y": 300
}
```

### mouse_hover

Hover over element.

**Request:**
```json
{
  "id": 31,
  "command": "mouse_hover",
  "selector": ".hover-menu"
}
```

### mouse_move

Move mouse to coordinates.

**Request:**
```json
{
  "id": 32,
  "command": "mouse_move",
  "x": 500,
  "y": 300
}
```

### mouse_drag

Drag from one element/point to another.

**Request:**
```json
{
  "id": 33,
  "command": "mouse_drag",
  "fromX": 100,
  "fromY": 100,
  "toX": 500,
  "toY": 500
}
```

### scroll

Scroll page.

**Request:**
```json
{
  "id": 34,
  "command": "scroll",
  "selector": "body",
  "x": 0,
  "y": 1000,
  "smooth": true
}
```

**Parameters:**
- `selector` (string, optional): Element to scroll (default: body)
- `x` (number): Horizontal scroll amount
- `y` (number): Vertical scroll amount
- `smooth` (boolean, optional): Smooth scrolling

---

## Storage & Cookie Management

### set_cookie

Set a cookie.

**Request:**
```json
{
  "id": 35,
  "command": "set_cookie",
  "name": "session_id",
  "value": "abc123xyz",
  "domain": ".example.com",
  "path": "/",
  "secure": true,
  "httpOnly": true,
  "sameSite": "Strict",
  "expiresIn": 3600000
}
```

**Parameters:**
- `name` (string, required): Cookie name
- `value` (string, required): Cookie value
- `domain` (string, optional): Cookie domain
- `path` (string, optional, default: "/"): Cookie path
- `secure` (boolean, optional): HTTPS only
- `httpOnly` (boolean, optional): JavaScript inaccessible
- `sameSite` (string, optional): "Strict", "Lax", "None"
- `expiresIn` (number, optional): Expiration in milliseconds

**Response:**
```json
{
  "id": 35,
  "success": true,
  "data": {
    "name": "session_id",
    "value": "abc123xyz",
    "set": true
  }
}
```

### get_cookies

Get cookies for current page.

**Request:**
```json
{
  "id": 36,
  "command": "get_cookies"
}
```

**Response:**
```json
{
  "id": 36,
  "success": true,
  "data": {
    "cookies": [
      {
        "name": "session_id",
        "value": "abc123xyz",
        "domain": ".example.com",
        "path": "/",
        "secure": true,
        "httpOnly": true,
        "sameSite": "Strict",
        "expires": 1623850982000
      }
    ]
  }
}
```

### get_all_cookies

Get all cookies across all domains.

**Request:**
```json
{
  "id": 37,
  "command": "get_all_cookies"
}
```

### delete_cookie

Delete a cookie.

**Request:**
```json
{
  "id": 38,
  "command": "delete_cookie",
  "name": "session_id"
}
```

### clear_all_cookies

Clear all cookies.

**Request:**
```json
{
  "id": 39,
  "command": "clear_all_cookies"
}
```

### export_cookies

Export cookies to file.

**Request:**
```json
{
  "id": 40,
  "command": "export_cookies",
  "format": "json"
}
```

**Parameters:**
- `format` (string, optional): "json", "netscape" (default: "json")

**Response:**
```json
{
  "id": 40,
  "success": true,
  "data": {
    "filename": "cookies_2026-06-03.json",
    "path": "/home/user/cookies_2026-06-03.json",
    "size": 2048
  }
}
```

### import_cookies

Import cookies from file.

**Request:**
```json
{
  "id": 41,
  "command": "import_cookies",
  "path": "/home/user/cookies.json",
  "merge": true
}
```

### set_local_storage

Set localStorage value.

**Request:**
```json
{
  "id": 42,
  "command": "set_local_storage",
  "key": "user_theme",
  "value": "dark"
}
```

### get_local_storage

Get localStorage value.

**Request:**
```json
{
  "id": 43,
  "command": "get_local_storage",
  "key": "user_theme"
}
```

**Response:**
```json
{
  "id": 43,
  "success": true,
  "data": {
    "key": "user_theme",
    "value": "dark"
  }
}
```

### clear_local_storage

Clear localStorage.

**Request:**
```json
{
  "id": 44,
  "command": "clear_local_storage"
}
```

### set_session_storage

Set sessionStorage value.

**Request:**
```json
{
  "id": 45,
  "command": "set_session_storage",
  "key": "temp_data",
  "value": "temporary value"
}
```

### get_session_storage

Get sessionStorage value.

**Request:**
```json
{
  "id": 46,
  "command": "get_session_storage",
  "key": "temp_data"
}
```

### clear_session_storage

Clear sessionStorage.

**Request:**
```json
{
  "id": 47,
  "command": "clear_session_storage"
}
```

### get_indexeddb

Get IndexedDB data.

**Request:**
```json
{
  "id": 48,
  "command": "get_indexeddb",
  "database": "mydb",
  "store": "mystore"
}
```

### delete_indexeddb

Delete IndexedDB data.

**Request:**
```json
{
  "id": 49,
  "command": "delete_indexeddb",
  "database": "mydb"
}
```

### clear_session_data

Clear all session data (cookies, storage, cache).

**Request:**
```json
{
  "id": 50,
  "command": "clear_session_data"
}
```

---

## Proxy & Network Commands

### set_proxy

Set proxy configuration.

**Request:**
```json
{
  "id": 51,
  "command": "set_proxy",
  "host": "proxy.example.com",
  "port": 8080,
  "type": "http",
  "auth": {
    "username": "user",
    "password": "pass"
  },
  "bypassRules": ["localhost", "127.0.0.1"]
}
```

**Parameters:**
- `host` (string, required): Proxy host
- `port` (number, required): Proxy port
- `type` (string, optional): "http", "socks4", "socks5" (default: "http")
- `auth` (object, optional): Authentication credentials
- `bypassRules` (array, optional): Domains to bypass proxy

**Proxy Types:**
- `http`: Standard HTTP proxy
- `https`: HTTPS proxy
- `socks4`: SOCKS4 protocol
- `socks5`: SOCKS5 protocol

**Response:**
```json
{
  "id": 51,
  "success": true,
  "data": {
    "proxy": {
      "host": "proxy.example.com",
      "port": 8080,
      "type": "http"
    },
    "configured": true
  }
}
```

### get_proxy_status

Get current proxy status.

**Request:**
```json
{
  "id": 52,
  "command": "get_proxy_status"
}
```

**Response:**
```json
{
  "id": 52,
  "success": true,
  "data": {
    "proxy": {
      "host": "proxy.example.com",
      "port": 8080,
      "type": "http",
      "active": true
    },
    "exitIp": "203.0.113.45",
    "exitCountry": "US",
    "lastChange": 1623847382000
  }
}
```

### test_proxy

Test proxy connectivity.

**Request:**
```json
{
  "id": 53,
  "command": "test_proxy",
  "host": "proxy.example.com",
  "port": 8080,
  "testUrl": "https://httpbin.org/ip"
}
```

**Response:**
```json
{
  "id": 53,
  "success": true,
  "data": {
    "working": true,
    "latency": 125,
    "exitIp": "203.0.113.45"
  }
}
```

### rotate_proxy

Rotate to next proxy in chain.

**Request:**
```json
{
  "id": 54,
  "command": "rotate_proxy"
}
```

**Response:**
```json
{
  "id": 54,
  "success": true,
  "data": {
    "previousProxy": "proxy1.example.com:8080",
    "currentProxy": "proxy2.example.com:8080",
    "exitIp": "203.0.113.46"
  }
}
```

### start_proxy_rotation

Start automatic proxy rotation.

**Request:**
```json
{
  "id": 55,
  "command": "start_proxy_rotation",
  "proxies": [
    { "host": "proxy1.example.com", "port": 8080 },
    { "host": "proxy2.example.com", "port": 8080 }
  ],
  "interval": 300000
}
```

**Parameters:**
- `proxies` (array): List of proxy configurations
- `interval` (number, optional): Rotation interval in milliseconds

### stop_proxy_rotation

Stop automatic proxy rotation.

**Request:**
```json
{
  "id": 56,
  "command": "stop_proxy_rotation"
}
```

### get_extended_proxy_status

Get detailed proxy analytics.

**Request:**
```json
{
  "id": 57,
  "command": "get_extended_proxy_status"
}
```

**Response:**
```json
{
  "id": 57,
  "success": true,
  "data": {
    "proxy": {...},
    "statistics": {
      "requestsCount": 1240,
      "totalBandwidth": 5242880,
      "averageLatency": 125.5
    },
    "reputation": {
      "score": 95,
      "status": "clean"
    }
  }
}
```

### set_proxy_chain

Set proxy chain (multiple proxies).

**Request:**
```json
{
  "id": 58,
  "command": "set_proxy_chain",
  "proxies": [
    { "host": "proxy1.com", "port": 8080, "type": "http" },
    { "host": "proxy2.com", "port": 1080, "type": "socks5" }
  ]
}
```

### get_proxy_chain

Get current proxy chain.

**Request:**
```json
{
  "id": 59,
  "command": "get_proxy_chain"
}
```

### clear_proxy

Clear proxy configuration.

**Request:**
```json
{
  "id": 60,
  "command": "clear_proxy"
}
```

---

## Session Management

### create_session

Create new browser session.

**Request:**
```json
{
  "id": 61,
  "command": "create_session",
  "name": "research_session_1",
  "profile": "default",
  "isolated": true
}
```

**Parameters:**
- `name` (string, optional): Session name
- `profile` (string, optional): Profile to use
- `isolated` (boolean, optional, default: true): Isolated session

**Response:**
```json
{
  "id": 61,
  "success": true,
  "data": {
    "sessionId": "sess_abc123",
    "name": "research_session_1",
    "created": 1623847382000
  }
}
```

### list_sessions

List all active sessions.

**Request:**
```json
{
  "id": 62,
  "command": "list_sessions"
}
```

**Response:**
```json
{
  "id": 62,
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "sess_abc123",
        "name": "research_session_1",
        "created": 1623847382000,
        "tabCount": 3
      }
    ]
  }
}
```

### get_session_info

Get session details.

**Request:**
```json
{
  "id": 63,
  "command": "get_session_info",
  "sessionId": "sess_abc123"
}
```

### switch_session

Switch to different session.

**Request:**
```json
{
  "id": 64,
  "command": "switch_session",
  "sessionId": "sess_abc123"
}
```

### delete_session

Delete session.

**Request:**
```json
{
  "id": 65,
  "command": "delete_session",
  "sessionId": "sess_abc123"
}
```

### create_session_checkpoint

Create checkpoint of current session state.

**Request:**
```json
{
  "id": 66,
  "command": "create_session_checkpoint",
  "name": "checkpoint_1"
}
```

### rollback_to_checkpoint

Restore session from checkpoint.

**Request:**
```json
{
  "id": 67,
  "command": "rollback_to_checkpoint",
  "checkpointId": "ckpt_123"
}
```

### export_session

Export session to file.

**Request:**
```json
{
  "id": 68,
  "command": "export_session",
  "sessionId": "sess_abc123",
  "includeProfile": true
}
```

### import_session

Import session from file.

**Request:**
```json
{
  "id": 69,
  "command": "import_session",
  "path": "/home/user/session.json"
}
```

### branch_session

Create session branch for parallel exploration.

**Request:**
```json
{
  "id": 70,
  "command": "branch_session",
  "fromSessionId": "sess_abc123",
  "name": "parallel_branch"
}
```

---

## Bot Evasion & Fingerprinting

### set_user_agent

Set custom user agent.

**Request:**
```json
{
  "id": 71,
  "command": "set_user_agent",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
```

### get_user_agent_status

Get current user agent.

**Request:**
```json
{
  "id": 72,
  "command": "get_user_agent_status"
}
```

**Response:**
```json
{
  "id": 72,
  "success": true,
  "data": {
    "userAgent": "Mozilla/5.0...",
    "browser": "Chrome",
    "version": "91.0",
    "os": "Windows",
    "category": "desktop"
  }
}
```

### start_user_agent_rotation

Start automatic user agent rotation.

**Request:**
```json
{
  "id": 73,
  "command": "start_user_agent_rotation",
  "category": "desktop",
  "interval": 300000
}
```

**Categories:**
- `desktop`: Desktop browsers
- `mobile`: Mobile browsers
- `tablet`: Tablet browsers
- `bot`: Bot user agents

### stop_user_agent_rotation

Stop user agent rotation.

**Request:**
```json
{
  "id": 74,
  "command": "stop_user_agent_rotation"
}
```

### get_random_user_agent

Get random user agent from category.

**Request:**
```json
{
  "id": 75,
  "command": "get_random_user_agent",
  "category": "desktop"
}
```

### set_geolocation

Set geolocation.

**Request:**
```json
{
  "id": 76,
  "command": "set_geolocation",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 100
}
```

**Parameters:**
- `latitude` (number): Latitude (-90 to 90)
- `longitude` (number): Longitude (-180 to 180)
- `accuracy` (number, optional): Accuracy in meters

### set_geolocation_city

Set geolocation by city.

**Request:**
```json
{
  "id": 77,
  "command": "set_geolocation_city",
  "city": "New York",
  "country": "United States"
}
```

### reset_geolocation

Clear geolocation spoofing.

**Request:**
```json
{
  "id": 78,
  "command": "reset_geolocation"
}
```

### randomize_profile_fingerprint

Randomize browser fingerprint.

**Request:**
```json
{
  "id": 79,
  "command": "randomize_profile_fingerprint"
}
```

**Response:**
```json
{
  "id": 79,
  "success": true,
  "data": {
    "fingerprint": {
      "userAgent": "Mozilla/5.0...",
      "acceptLanguage": "en-US,en;q=0.9",
      "timezone": "America/New_York",
      "platform": "Win32",
      "hardwareConcurrency": 8,
      "deviceMemory": 16,
      "maxTouchPoints": 0
    },
    "timestamp": 1623847382000
  }
}
```

### detect_headless_environment

Check if running in headless mode.

**Request:**
```json
{
  "id": 80,
  "command": "detect_headless_environment"
}
```

**Response:**
```json
{
  "id": 80,
  "success": true,
  "data": {
    "isHeadless": false,
    "detectionMethod": "chrome.webstore check"
  }
}
```

---

## Recording & Playback

### start_recording

Start session recording.

**Request:**
```json
{
  "id": 81,
  "command": "start_recording",
  "name": "recording_1",
  "captureScreenshots": true,
  "captureNetwork": true
}
```

**Parameters:**
- `name` (string, optional): Recording name
- `captureScreenshots` (boolean, optional, default: true)
- `captureNetwork` (boolean, optional, default: true)
- `captureConsole` (boolean, optional, default: true)

**Response:**
```json
{
  "id": 81,
  "success": true,
  "data": {
    "recordingId": "rec_123",
    "started": true,
    "timestamp": 1623847382000
  }
}
```

### stop_recording

Stop session recording.

**Request:**
```json
{
  "id": 82,
  "command": "stop_recording"
}
```

### get_recording_status

Get recording status.

**Request:**
```json
{
  "id": 83,
  "command": "get_recording_status"
}
```

**Response:**
```json
{
  "id": 83,
  "success": true,
  "data": {
    "recording": true,
    "recordingId": "rec_123",
    "duration": 45230,
    "eventCount": 234
  }
}
```

### list_recordings

List all recordings.

**Request:**
```json
{
  "id": 84,
  "command": "list_recordings"
}
```

### get_recording

Get recording details.

**Request:**
```json
{
  "id": 85,
  "command": "get_recording",
  "recordingId": "rec_123"
}
```

### export_recording

Export recording.

**Request:**
```json
{
  "id": 86,
  "command": "export_recording",
  "recordingId": "rec_123",
  "format": "json"
}
```

**Formats:**
- `json`: JSON format
- `har`: HAR format (HTTP Archive)
- `video`: Video format (if supported)

### load_recording

Load and prepare recording for playback.

**Request:**
```json
{
  "id": 87,
  "command": "load_recording",
  "recordingId": "rec_123"
}
```

### start_replay

Start playback of recording.

**Request:**
```json
{
  "id": 88,
  "command": "start_replay",
  "recordingId": "rec_123",
  "speed": 1.0
}
```

**Parameters:**
- `recordingId` (string): Recording to replay
- `speed` (number, optional, default: 1.0): Playback speed multiplier

### pause_replay

Pause replay.

**Request:**
```json
{
  "id": 89,
  "command": "pause_replay"
}
```

### resume_replay

Resume paused replay.

**Request:**
```json
{
  "id": 90,
  "command": "resume_replay"
}
```

### stop_replay

Stop replay.

**Request:**
{
  "id": 91,
  "command": "stop_replay"
}
```

---

## Window & Tab Management

### create_tab

Create new tab.

**Request:**
```json
{
  "id": 92,
  "command": "create_tab",
  "url": "about:blank"
}
```

**Response:**
```json
{
  "id": 92,
  "success": true,
  "data": {
    "tabId": "tab_456",
    "created": true
  }
}
```

### list_tabs

List all tabs.

**Request:**
```json
{
  "id": 93,
  "command": "list_tabs"
}
```

**Response:**
```json
{
  "id": 93,
  "success": true,
  "data": {
    "tabs": [
      {
        "tabId": "tab_456",
        "title": "New Tab",
        "url": "about:blank",
        "active": true
      }
    ]
  }
}
```

### close_tab

Close tab.

**Request:**
```json
{
  "id": 94,
  "command": "close_tab",
  "tabId": "tab_456"
}
```

### switch_tab

Switch to tab.

**Request:**
```json
{
  "id": 95,
  "command": "switch_tab",
  "tabId": "tab_456"
}
```

### get_active_tab

Get active tab.

**Request:**
```json
{
  "id": 96,
  "command": "get_active_tab"
}
```

### duplicate_tab

Duplicate tab.

**Request:**
```json
{
  "id": 97,
  "command": "duplicate_tab",
  "tabId": "tab_456"
}
```

### mute_tab

Mute tab audio.

**Request:**
```json
{
  "id": 98,
  "command": "mute_tab",
  "tabId": "tab_456"
}
```

### pin_tab

Pin tab.

**Request:**
```json
{
  "id": 99,
  "command": "pin_tab",
  "tabId": "tab_456"
}
```

### set_tab_zoom

Set tab zoom level.

**Request:**
```json
{
  "id": 100,
  "command": "set_tab_zoom",
  "tabId": "tab_456",
  "zoomLevel": 1.5
}
```

---

## Performance & Monitoring

### get_performance

Get page performance metrics.

**Request:**
```json
{
  "id": 101,
  "command": "get_performance"
}
```

**Response:**
```json
{
  "id": 101,
  "success": true,
  "data": {
    "navigation": {
      "navigationStart": 1623847380000,
      "domInteractive": 1623847381200,
      "domComplete": 1623847382100,
      "loadEventEnd": 1623847382500
    },
    "timing": {
      "pageLoadTime": 2500,
      "domReadyTime": 1200,
      "firstPaint": 850,
      "firstContentfulPaint": 1050
    },
    "resources": {
      "totalRequests": 45,
      "totalSize": 2048000,
      "averageLatency": 125
    }
  }
}
```

### get_memory_stats

Get memory usage statistics.

**Request:**
```json
{
  "id": 102,
  "command": "get_memory_stats"
}
```

**Response:**
```json
{
  "id": 102,
  "success": true,
  "data": {
    "jsHeapSize": 52428800,
    "jsHeapSizeLimit": 2196083712,
    "externalMemoryUsage": 8388608,
    "usagePercentage": 2.4
  }
}
```

### start_profiling

Start performance profiling.

**Request:**
```json
{
  "id": 103,
  "command": "start_profiling"
}
```

### stop_profiling

Stop profiling and get results.

**Request:**
```json
{
  "id": 104,
  "command": "stop_profiling"
}
```

### get_metrics

Get comprehensive metrics.

**Request:**
```json
{
  "id": 105,
  "command": "get_metrics"
}
```

**Response:**
```json
{
  "id": 105,
  "success": true,
  "data": {
    "webvitals": {
      "lcp": 2400,
      "fid": 45,
      "cls": 0.05
    },
    "resources": {
      "totalResources": 45,
      "slowestResource": {
        "url": "https://example.com/large.js",
        "duration": 1250
      }
    }
  }
}
```

### start_memory_monitoring

Start continuous memory monitoring.

**Request:**
```json
{
  "id": 106,
  "command": "start_memory_monitoring",
  "interval": 5000
}
```

### stop_memory_monitoring

Stop memory monitoring.

**Request:**
```json
{
  "id": 107,
  "command": "stop_memory_monitoring"
}
```

### check_memory

Check memory and trigger GC if needed.

**Request:**
```json
{
  "id": 108,
  "command": "check_memory"
}
```

### force_gc

Force garbage collection.

**Request:**
```json
{
  "id": 109,
  "command": "force_gc"
}
```

---

## Plugin System

### load_plugin

Load plugin from file.

**Request:**
```json
{
  "id": 110,
  "command": "load_plugin",
  "path": "/plugins/my-plugin.js"
}
```

### list_plugins

List loaded plugins.

**Request:**
```json
{
  "id": 111,
  "command": "list_plugins"
}
```

### get_plugin_status

Get plugin status.

**Request:**
```json
{
  "id": 112,
  "command": "get_plugin_status",
  "pluginName": "my-plugin"
}
```

### plugin_command

Execute plugin command.

**Request:**
```json
{
  "id": 113,
  "command": "plugin_command",
  "pluginName": "my-plugin",
  "method": "process",
  "args": {}
}
```

### reload_plugin

Reload plugin.

**Request:**
```json
{
  "id": 114,
  "command": "reload_plugin",
  "pluginName": "my-plugin"
}
```

### unload_plugin

Unload plugin.

**Request:**
```json
{
  "id": 115,
  "command": "unload_plugin",
  "pluginName": "my-plugin"
}
```

---

## Tor Integration

### tor_status

Get Tor status.

**Request:**
```json
{
  "id": 116,
  "command": "tor_status"
}
```

**Response:**
```json
{
  "id": 116,
  "success": true,
  "data": {
    "running": true,
    "connectedCircuits": 5,
    "version": "0.4.6.7",
    "bootstrapPercentage": 100
  }
}
```

### tor_start

Start Tor service.

**Request:**
```json
{
  "id": 117,
  "command": "tor_start"
}
```

### tor_stop

Stop Tor service.

**Request:**
```json
{
  "id": 118,
  "command": "tor_stop"
}
```

### tor_new_identity

Request new Tor identity.

**Request:**
```json
{
  "id": 119,
  "command": "tor_new_identity"
}
```

### set_tor_mode

Set Tor mode (ON/OFF/AUTO).

**Request:**
```json
{
  "id": 120,
  "command": "set_tor_mode",
  "mode": "AUTO"
}
```

**Modes:**
- `ON`: Tor always enabled
- `OFF`: Tor disabled
- `AUTO`: Auto-enable for .onion domains

### get_tor_status

Get detailed Tor status.

**Request:**
```json
{
  "id": 121,
  "command": "get_tor_status"
}
```

### tor_set_exit_country

Set Tor exit country.

**Request:**
```json
{
  "id": 122,
  "command": "tor_set_exit_country",
  "countryCode": "US"
}
```

### tor_get_country_codes

Get available Tor exit countries.

**Request:**
```json
{
  "id": 123,
  "command": "tor_get_country_codes"
}
```

---

## Error Handling & Recovery

### Error Response Structure

```json
{
  "id": "request-id",
  "command": "command_name",
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "recovery": {
    "recoverable": true,
    "suggestion": "What to do next",
    "alternativeCommands": ["cmd1", "cmd2"]
  }
}
```

### Common Error Codes

- `NAVIGATION_FAILED`: Navigation to URL failed
- `ELEMENT_NOT_FOUND`: Selector didn't match any element
- `TIMEOUT`: Operation exceeded timeout
- `INVALID_URL`: URL format invalid
- `PROXY_ERROR`: Proxy connection failed
- `AUTHENTICATION_FAILED`: Invalid credentials
- `PERMISSION_DENIED`: Operation not allowed
- `NETWORK_ERROR`: Network connectivity issue
- `TOR_NOT_ENABLED`: Tor mode required but not enabled
- `INVALID_PARAMETER`: Parameter type or value invalid
- `COMMAND_NOT_FOUND`: Unknown command
- `SESSION_NOT_FOUND`: Session ID doesn't exist
- `TAB_NOT_FOUND`: Tab ID doesn't exist

### Retry Command

**Request:**
```json
{
  "id": 124,
  "command": "retry_command",
  "originalId": "123",
  "maxRetries": 3
}
```

### Get Recovery Config

**Request:**
```json
{
  "id": 125,
  "command": "get_recovery_config"
}
```

---

## Advanced Features

### Status Command

Get comprehensive system status.

**Request:**
```json
{
  "id": 126,
  "command": "status"
}
```

**Response:**
```json
{
  "id": 126,
  "success": true,
  "data": {
    "browser": {
      "version": "12.2.0",
      "userAgent": "Mozilla/5.0...",
      "uptime": 3600000
    },
    "proxy": {
      "active": true,
      "host": "proxy.example.com",
      "exitIp": "203.0.113.45"
    },
    "session": {
      "sessionId": "sess_abc123",
      "tabCount": 3,
      "memory": "2.4%"
    }
  }
}
```

### execute_script

Execute arbitrary JavaScript in page context.

**Request:**
```json
{
  "id": 127,
  "command": "execute_script",
  "script": "return document.title;",
  "args": []
}
```

**Response:**
```json
{
  "id": 127,
  "success": true,
  "data": {
    "result": "Example Domain"
  }
}
```

### get_console_logs

Get browser console logs.

**Request:**
```json
{
  "id": 128,
  "command": "get_console_logs",
  "level": "all"
}
```

**Levels:**
- `all`: All logs
- `error`: Only errors
- `warning`: Only warnings
- `info`: Only info

### get_network_logs

Get network request logs.

**Request:**
```json
{
  "id": 129,
  "command": "get_network_logs",
  "filter": "xhr"
}
```

**Filters:**
- `all`: All requests
- `xhr`: XMLHttpRequest/Fetch
- `image`: Image requests
- `stylesheet`: CSS files
- `script`: JavaScript files

### set_network_throttling

Simulate network conditions.

**Request:**
```json
{
  "id": 130,
  "command": "set_network_throttling",
  "downloadSpeed": 1000000,
  "uploadSpeed": 500000,
  "latency": 100
}
```

**Parameters:**
- `downloadSpeed` (number): Bytes per second
- `uploadSpeed` (number): Bytes per second
- `latency` (number): Additional latency in ms

### start_network_capture

Start capturing network traffic.

**Request:**
```json
{
  "id": 131,
  "command": "start_network_capture"
}
```

### stop_network_capture

Stop network capture.

**Request:**
```json
{
  "id": 132,
  "command": "stop_network_capture"
}
```

### export_network_capture

Export captured network data.

**Request:**
```json
{
  "id": 133,
  "command": "export_network_capture",
  "format": "har"
}
```

---

## Command Timeouts & Best Practices

### Recommended Timeouts by Command Category

**Navigation Commands**: 30000ms
- navigate
- reload_tab
- tab_back / tab_forward

**Interaction Commands**: 10000ms
- click
- fill
- type_text
- scroll

**Content Extraction**: 5000ms
- get_content
- extract_links
- extract_forms
- screenshot

**Storage Commands**: 5000ms
- get_cookies
- set_cookie
- clear_all_cookies

**Status/Info Commands**: 2000ms
- status
- ping
- get_url
- list_tabs

### Best Practices

1. **Wait for Page Load**: Always use `wait_for_element` or check `get_page_state` before interacting with dynamic content
2. **Handle Timeouts**: Implement exponential backoff for retries
3. **Manage State**: Use checkpoints for complex workflows
4. **Monitor Resources**: Track memory and proxy rotation
5. **Error Recovery**: Implement automatic fallback strategies
6. **Proxy Rotation**: Rotate proxies based on IP bans or rate limiting
7. **User Agent Rotation**: Change user agents to avoid detection
8. **Session Management**: Maintain separate sessions for sensitive operations
9. **Recording & Replay**: Record important workflows for debugging and automation
10. **Security**: Keep authentication tokens secure and rotate regularly

---

## Rate Limiting

The API implements rate limiting to prevent abuse.

**Default Limits**:
- 1000 requests per minute per connection
- 100 concurrent connections per session
- Burst limit: 50 requests in 1 second

**Rate Limit Response Headers**:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1623847442000
```

**Exceeded Response**:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "recovery": {
    "retryAfter": 60000
  }
}
```

---

## Examples

### Complete Workflow Example

```javascript
const WebSocket = require('ws');

async function completeWorkflow() {
  const ws = new WebSocket('ws://localhost:8765');

  // 1. Navigate to page
  await send(ws, {
    id: 1,
    command: 'navigate',
    url: 'https://example.com'
  });

  // 2. Wait for page load
  await send(ws, {
    id: 2,
    command: 'wait_for_element',
    selector: '.content',
    timeout: 10000
  });

  // 3. Interact with form
  await send(ws, {
    id: 3,
    command: 'fill',
    selector: 'input[name="email"]',
    value: 'user@example.com'
  });

  // 4. Submit form
  await send(ws, {
    id: 4,
    command: 'click',
    selector: 'button[type="submit"]'
  });

  // 5. Extract results
  const result = await send(ws, {
    id: 5,
    command: 'extract_links'
  });

  console.log('Links found:', result.data.links.length);

  // 6. Take screenshot
  await send(ws, {
    id: 6,
    command: 'screenshot'
  });

  ws.close();
}

function send(ws, data) {
  return new Promise((resolve, reject) => {
    ws.send(JSON.stringify(data));
    ws.once('message', (msg) => {
      const response = JSON.parse(msg);
      if (response.id === data.id) {
        resolve(response);
      }
    });
  });
}
```

---

## Version History

- **v12.2.0** (June 3, 2026): Complete API documentation with 300+ commands
- **v12.1.0** (May 31, 2026): Added competitor monitoring and platform integrations
- **v12.0.0** (May 11, 2026): Production deployment with performance optimization
- **v11.2.0** (May 7, 2026): Bot evasion framework completion

---

## Support & Documentation

For additional help:
- API Status: Check `/status` endpoint
- Error Codes: See [Error Handling](#error-handling--recovery) section
- Examples: See [Examples](#examples) section
- Performance: See `/docs/PERFORMANCE-TUNING.md`
- Troubleshooting: See `/docs/TROUBLESHOOTING-ADVANCED.md`

