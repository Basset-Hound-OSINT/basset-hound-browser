# Basset Hound Browser - Comprehensive Forensic Feature Architecture

**Version:** 1.0  
**Date:** June 20, 2026  
**Status:** Architecture Document  
**Scope:** Complete forensic/research capabilities (NO security restrictions)

---

## Executive Summary

This document defines a comprehensive forensic feature set for Basset Hound Browser—a focused data collection tool without security-hardening constraints. All features enable **unfiltered, complete data extraction** and **unrestricted content injection** for legitimate forensic research and evidence collection workflows.

**Core Principle:** Users SHOULD be able to inject content, extract raw unfiltered data, and interact at the lowest level. No security restrictions apply.

**Five Feature Areas:**
1. Forensic Data Extraction (Complete, unfiltered)
2. Content Injection & Modification (No restrictions)
3. Lower-Level Interaction (Direct DOM/JS/Network access)
4. Export & Analysis (Multiple formats, correlation tools)
5. User Control API (Granular selection, custom scripting)

---

## Table of Contents

1. [Area 1: Forensic Data Extraction](#area-1-forensic-data-extraction)
2. [Area 2: Content Injection & Modification](#area-2-content-injection--modification)
3. [Area 3: Lower-Level Interaction](#area-3-lower-level-interaction)
4. [Area 4: Export & Analysis](#area-4-export--analysis)
5. [Area 5: User Control API](#area-5-user-control-api)
6. [Integration Architecture](#integration-architecture)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Success Metrics](#success-metrics)

---

# AREA 1: FORENSIC DATA EXTRACTION

## Overview

Complete, unfiltered data extraction from web pages—all content, metadata, resources, and execution state captured with forensic integrity.

**Current Status:** 40% implemented (export_raw_html, export_network_log, export_device_ids)  
**Implementation Level:** 3 core commands, need expansion to 20+ specialized extractors

---

## 1.1 Feature Breakdown

### A. Raw HTML Capture

**Purpose:** Capture complete page HTML with all HTTP metadata

**Features:**
- Complete HTML source (document.documentElement.outerHTML)
- Unmodified response body (original bytes from server)
- Full HTTP headers (request + response)
- Status code and status text
- Content-Type with charset
- Cookies sent with request
- Referrer information
- Cache headers and validation tokens
- Content-Length (original + compressed)
- Server identification headers

**Data Returned:**
```json
{
  "html": "<!DOCTYPE html>...",
  "htmlLength": 45320,
  "url": "https://example.com",
  "timestamp": 1718863200000,
  "statusCode": 200,
  "statusText": "OK",
  "contentType": "text/html; charset=utf-8",
  "responseHeaders": {
    "content-type": "text/html; charset=utf-8",
    "server": "nginx/1.21.0",
    "cache-control": "max-age=3600",
    "etag": "\"abc123\"",
    "last-modified": "Mon, 20 Jun 2026 10:00:00 GMT",
    "set-cookie": ["sessionid=xyz; Path=/; HttpOnly"]
  },
  "requestHeaders": {
    "user-agent": "Mozilla/5.0...",
    "accept": "text/html,application/xhtml+xml",
    "referer": "https://google.com",
    "accept-encoding": "gzip, deflate"
  },
  "originalBytes": 45320,
  "compressedBytes": null,
  "compressionAlgorithm": null,
  "loadTime": 450,
  "hash": {
    "sha256": "abc123def456..."
  }
}
```

**Commands Needed:**
- `export_raw_html` - Current (✅ exists)
- `export_html_with_resources` - Include inline CSS/JS/images base64
- `export_original_response` - Unmodified server response (if cached)
- `export_response_headers_only` - Headers without body (lightweight)

**Success Criteria:**
- Captures 100% of HTML source
- Preserves original encoding
- Includes all HTTP metadata
- Consistent with original server response

---

### B. Complete DOM Snapshot

**Purpose:** Capture full DOM state at specific point in time with all properties

**Features:**
- Complete DOM tree (all nodes, attributes, properties)
- Computed styles for every element (CSS-applied values)
- Event listeners (what listeners are attached)
- Custom properties and data attributes
- Form field values (current state)
- Input/textarea content (before submission)
- Selected state (checkboxes, radio buttons)
- Element position/dimensions (getBoundingClientRect)
- z-index and visibility state
- Animation state
- Scroll position
- Focus state

**Data Returned:**
```json
{
  "dom": {
    "nodeCount": 1243,
    "maxDepth": 15,
    "tree": {
      "type": "element",
      "tag": "html",
      "attributes": { "lang": "en" },
      "computedStyle": {},
      "children": [
        {
          "type": "element",
          "tag": "head",
          "children": [
            {
              "type": "element",
              "tag": "title",
              "textContent": "Example Page",
              "computedStyle": {}
            }
          ]
        },
        {
          "type": "element",
          "tag": "body",
          "attributes": { "class": "dark-mode" },
          "children": [
            {
              "type": "element",
              "tag": "div",
              "attributes": { "id": "main", "data-component": "header" },
              "computedStyle": {
                "display": "block",
                "color": "rgb(255, 255, 255)",
                "backgroundColor": "rgb(0, 0, 0)"
              },
              "boundingRect": {
                "top": 0,
                "left": 0,
                "width": 1920,
                "height": 100
              },
              "eventListeners": ["click", "mouseover"],
              "children": []
            }
          ]
        }
      ]
    }
  },
  "forms": {
    "count": 5,
    "forms": [
      {
        "id": "login-form",
        "action": "/login",
        "method": "POST",
        "enctype": "application/x-www-form-urlencoded",
        "fields": [
          {
            "name": "username",
            "type": "text",
            "value": "",
            "required": true,
            "placeholder": "Enter username"
          },
          {
            "name": "password",
            "type": "password",
            "value": "",
            "required": true
          },
          {
            "name": "remember",
            "type": "checkbox",
            "checked": false
          }
        ]
      }
    ]
  },
  "scrollState": {
    "x": 0,
    "y": 425,
    "maxX": 0,
    "maxY": 5000
  },
  "focusedElement": {
    "tag": "input",
    "attributes": { "id": "search-input", "type": "text" }
  },
  "timestamp": 1718863200000,
  "hash": {
    "sha256": "abc123def456..."
  }
}
```

**Commands Needed:**
- `export_dom_snapshot` - Complete tree with styles
- `export_dom_tree_only` - Structure without styles (lightweight)
- `export_computed_styles` - All CSS-applied properties
- `export_form_state` - Current values in all forms
- `export_element_properties` - Advanced DOM properties (listeners, etc.)
- `export_dom_diff` - Changes since last snapshot

**Success Criteria:**
- Captures every node in DOM
- Includes computed styles (not just defined)
- Preserves form values before submission
- Can reconstruct page visually from data

---

### C. Full JavaScript Extraction

**Purpose:** Extract all JavaScript code, execution context, and runtime state

**Features:**
- All inline scripts (from `<script>` tags)
- All external scripts (with source mapping if available)
- Script execution order and timing
- Global variables and state
- Function definitions
- Event handler source code
- Dynamic scripts (injected via createElement)
- Service worker code
- Web Worker code
- Module definitions (ES6 imports)
- Runtime stack traces
- Console history (all logs, errors, warnings)
- Network request details (fetch/XHR origin)
- Cookie jar (all cookies in context)
- LocalStorage/SessionStorage contents
- IndexedDB data
- Error stack traces

**Data Returned:**
```json
{
  "scripts": {
    "inline": [
      {
        "id": "inline-1",
        "source": "window.addEventListener('load', function() { ... });",
        "hash": "sha256:abc123...",
        "line": 45,
        "executionTime": 125,
        "errors": []
      }
    ],
    "external": [
      {
        "id": "script-2",
        "src": "https://cdn.example.com/main.js",
        "hash": "sha256:def456...",
        "size": 45320,
        "mimeType": "application/javascript",
        "loaded": true,
        "error": null,
        "executionTime": 450,
        "sourceMap": "https://cdn.example.com/main.js.map"
      }
    ],
    "dynamic": [
      {
        "id": "dynamic-1",
        "source": "injected code here",
        "injectedBy": "analytics.js",
        "injectionTime": 1718863250000,
        "hash": "sha256:ghi789..."
      }
    ]
  },
  "globals": {
    "window": {
      "customProperty": "value",
      "apiKey": "***REDACTED***",
      "configuration": { "mode": "production" }
    }
  },
  "functions": [
    {
      "name": "fetchUserData",
      "scope": "window.api",
      "source": "function fetchUserData() { ... }",
      "callCount": 3,
      "lastCalled": 1718863250000,
      "errors": []
    }
  ],
  "eventListeners": [
    {
      "element": "window",
      "event": "click",
      "handler": "function(e) { ... }",
      "capture": false
    }
  ],
  "console": {
    "logs": [
      { "time": 1718863200000, "level": "log", "message": "Page loaded" },
      { "time": 1718863201000, "level": "error", "message": "API call failed", "stack": "..." }
    ],
    "warnings": [],
    "errors": []
  },
  "network": {
    "requests": [
      {
        "id": "req-1",
        "method": "GET",
        "url": "https://api.example.com/data",
        "headers": { "authorization": "Bearer ***REDACTED***" },
        "response": { "status": 200, "body": "..." },
        "timing": { "start": 0, "end": 145 }
      }
    ]
  },
  "storage": {
    "cookies": [
      { "name": "sessionid", "value": "***REDACTED***", "secure": true, "httpOnly": true }
    ],
    "localStorage": { "theme": "dark" },
    "sessionStorage": { "tempData": "..." },
    "indexedDB": {
      "stores": [{ "name": "cache", "keyPath": "id", "entries": 234 }]
    }
  },
  "timestamp": 1718863200000
}
```

**Commands Needed:**
- `export_all_scripts` - All script tags + external + dynamic
- `export_inline_scripts_only` - Just inline `<script>` content
- `export_external_scripts` - Fetch source of external scripts
- `export_global_variables` - window.* object contents
- `export_function_definitions` - All callable functions with source
- `export_event_listeners` - What listeners are attached where
- `export_console_history` - All logs, errors, warnings
- `export_network_requests` - All fetch/XHR with bodies
- `export_storage` - Cookies, localStorage, sessionStorage, IndexedDB
- `export_execution_timeline` - Script timing and order
- `export_source_maps` - If available for debugging

**Success Criteria:**
- Captures every line of executable code
- Includes execution order and timing
- Shows all storage (cookies, localStorage, etc.)
- Can analyze for malware/tracker signatures
- Console history complete from page load

---

### D. Complete CSS Capture

**Purpose:** Extract all CSS rules and computed styles

**Features:**
- All stylesheet rules (from `<style>` tags and `<link>` stylesheets)
- CSS properties and values
- Media queries and breakpoints
- Font definitions (@font-face)
- Keyframe animations
- Computed styles for every element
- CSS variables (custom properties)
- Pseudo-element styles
- CSS Grid and Flexbox layouts
- Print styles
- Viewport settings

**Data Returned:**
```json
{
  "stylesheets": {
    "count": 8,
    "stylesheets": [
      {
        "id": "stylesheet-1",
        "type": "inline",
        "source": "body { color: black; }",
        "hash": "sha256:abc123...",
        "rules": [
          {
            "selector": "body",
            "declarations": {
              "color": "black",
              "font-family": "Arial, sans-serif",
              "margin": "0"
            }
          }
        ]
      },
      {
        "id": "stylesheet-2",
        "type": "external",
        "href": "https://cdn.example.com/style.css",
        "loaded": true,
        "size": 45320,
        "hash": "sha256:def456...",
        "rules": []
      }
    ]
  },
  "rules": [
    {
      "selector": ".button",
      "specificity": "010",
      "declarations": {
        "background-color": "rgb(0, 120, 215)",
        "padding": "10px 20px",
        "border": "1px solid rgb(0, 100, 200)"
      }
    }
  ],
  "mediaQueries": [
    {
      "query": "(max-width: 768px)",
      "rules": [
        {
          "selector": ".button",
          "declarations": { "padding": "5px 10px" }
        }
      ]
    }
  ],
  "animations": [
    {
      "name": "slideIn",
      "duration": "0.5s",
      "keyframes": [
        { "offset": "0%", "declarations": { "transform": "translateX(-100%)" } },
        { "offset": "100%", "declarations": { "transform": "translateX(0)" } }
      ]
    }
  ],
  "fonts": [
    {
      "family": "CustomFont",
      "src": "url('https://cdn.example.com/font.woff2')",
      "weight": "400",
      "style": "normal"
    }
  ],
  "variables": {
    "--primary-color": "rgb(0, 120, 215)",
    "--spacing": "16px"
  },
  "computedStyles": [
    {
      "selector": "#main-content",
      "styles": {
        "display": "grid",
        "grid-template-columns": "1fr 1fr",
        "gap": "20px"
      }
    }
  ],
  "timestamp": 1718863200000
}
```

**Commands Needed:**
- `export_all_css` - All stylesheets + inline styles
- `export_stylesheet_list` - References to all stylesheets
- `export_stylesheet_source` - Source of a specific stylesheet
- `export_computed_styles` - CSS-applied values for elements
- `export_css_rules` - Parsed CSS rules with selectors
- `export_media_queries` - All breakpoints and rules
- `export_css_animations` - @keyframes and animation definitions
- `export_font_definitions` - @font-face declarations
- `export_css_variables` - Custom properties (--var: value)

**Success Criteria:**
- Captures every CSS rule
- Shows media queries and breakpoints
- Includes computed styles (not just defined)
- Can reconstruct page layout visually
- Font definitions retrievable

---

### E. Full Network Capture

**Purpose:** Complete HTTP request/response capture with timing and analysis

**Features:**
- All HTTP requests (document, XHR, fetch, assets)
- Request method, URL, headers, body
- Response status, headers, body, timing
- DNS resolution details
- TLS/SSL handshake information
- Request/response compression details
- Cookies sent and received
- Cache headers and validation
- Content-Type negotiation
- Custom headers
- Redirects and chain
- Failed requests and errors
- Resource size (original + compressed)
- Network timing (DNS, TCP, TTFB, download)
- Protocol version (HTTP/1.1, HTTP/2, etc.)

**Data Returned (HAR Format Enhanced):**
```json
{
  "log": {
    "version": "1.2",
    "creator": {
      "name": "Basset Hound Browser",
      "version": "12.1.0"
    },
    "entries": [
      {
        "startedDateTime": "2026-06-20T10:30:00.000Z",
        "time": 450,
        "request": {
          "method": "GET",
          "url": "https://example.com/",
          "httpVersion": "HTTP/2.0",
          "headers": [
            { "name": "user-agent", "value": "Mozilla/5.0...", "raw": true },
            { "name": "accept", "value": "text/html,application/xhtml+xml", "raw": true }
          ],
          "queryString": [],
          "cookies": [
            { "name": "sessionid", "value": "xyz123" }
          ],
          "headersSize": -1,
          "bodySize": 0
        },
        "response": {
          "status": 200,
          "statusText": "OK",
          "httpVersion": "HTTP/2.0",
          "headers": [
            { "name": "content-type", "value": "text/html; charset=utf-8" },
            { "name": "server", "value": "nginx/1.21.0" }
          ],
          "cookies": [
            { "name": "newid", "value": "abc456", "path": "/", "secure": true }
          ],
          "content": {
            "size": 45320,
            "mimeType": "text/html; charset=utf-8",
            "text": "<!DOCTYPE html>...",
            "encoding": "utf-8"
          },
          "redirectURL": "",
          "headersSize": -1,
          "bodySize": 45320
        },
        "cache": {
          "beforeRequest": {},
          "afterRequest": {
            "expires": "2026-06-20T11:30:00.000Z",
            "lastAccess": "2026-06-20T10:30:00.000Z",
            "eTag": "abc123",
            "hitCount": 0
          }
        },
        "timings": {
          "blocked": 5,
          "dns": 25,
          "connect": 50,
          "send": 10,
          "wait": 200,
          "receive": 160,
          "ssl": 30
        },
        "serverIPAddress": "93.184.216.34",
        "connection": "443",
        "tlsVersion": "TLSv1.3",
        "tlsCipherSuite": "TLS_AES_256_GCM_SHA384",
        "tlsProtocol": "h2"
      }
    ]
  }
}
```

**Commands Needed:**
- `export_network_log` - Complete HAR format log (✅ exists)
- `export_network_log_har` - Standard HAR format
- `export_network_log_csv` - CSV format for spreadsheet analysis
- `export_network_log_filtered` - Filter by resource type, status, etc.
- `export_request_bodies` - All request bodies (POST, PUT, etc.)
- `export_response_bodies` - All response bodies (can be large)
- `export_network_timings` - Timing analysis and waterfall data
- `export_dns_data` - DNS resolution details (if available)
- `export_tls_certificates` - TLS cert chain and details
- `export_network_errors` - Failed requests and error details
- `export_cookie_jar` - All cookies sent/received
- `export_websocket_traffic` - WebSocket frames if any

**Success Criteria:**
- Captures 100% of requests
- Includes request and response bodies
- Shows all headers and cookies
- Network timing accurate
- Can replay requests with captured data

---

### F. Metadata Extraction

**Purpose:** Extract all page metadata and structural information

**Features:**
- Meta tags (charset, viewport, description, keywords, etc.)
- Open Graph data (social media sharing)
- Twitter Card data
- Canonical URL
- Favicon and apple icons
- Feed URLs (RSS/Atom)
- Structured data (JSON-LD, microdata, RDFa)
- Language information
- Viewport settings
- Security headers
- MIME type information
- Link relations (prev, next, alternate, etc.)
- Author and copyright information
- Generator meta tag
- Theme color
- Manifest links (PWA)

**Data Returned:**
```json
{
  "metaTags": {
    "charset": "utf-8",
    "viewport": "width=device-width, initial-scale=1",
    "description": "Example website description",
    "keywords": "example, test, metadata",
    "author": "John Doe",
    "robots": "index, follow",
    "language": "en",
    "themeColor": "#FFFFFF"
  },
  "openGraph": {
    "title": "Example Page",
    "description": "Description for social media",
    "image": "https://example.com/image.jpg",
    "url": "https://example.com/page",
    "type": "website"
  },
  "twitterCard": {
    "card": "summary_large_image",
    "title": "Example Page",
    "description": "Twitter description",
    "image": "https://example.com/image.jpg"
  },
  "structuredData": [
    {
      "type": "application/ld+json",
      "content": {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "Example Article",
        "author": "John Doe"
      }
    }
  ],
  "links": {
    "canonical": "https://example.com/canonical",
    "favicon": "https://example.com/favicon.ico",
    "appleTouchIcon": "https://example.com/apple-icon.png",
    "feedRss": "https://example.com/feed.xml",
    "feedAtom": "https://example.com/feed.atom",
    "manifest": "https://example.com/manifest.json"
  },
  "security": {
    "contentSecurityPolicy": "default-src 'self'",
    "xFrameOptions": "SAMEORIGIN",
    "xContentTypeOptions": "nosniff",
    "xXSSProtection": "1; mode=block"
  },
  "timestamp": 1718863200000
}
```

**Commands Needed:**
- `export_page_metadata` - All meta tags and metadata
- `export_open_graph` - OG tags for social sharing
- `export_twitter_card` - Twitter Card data
- `export_structured_data` - JSON-LD, microdata, RDFa
- `export_link_relations` - All link tags (canonical, feeds, etc.)
- `export_security_headers` - CSP, X-Frame-Options, etc.

**Success Criteria:**
- Captures all meta tags
- Includes structured data (all formats)
- Shows security headers
- Open Graph and Twitter Card complete

---

## 1.2 Implementation Architecture

### Database/Cache Layer
```
extraction/
├── dom-cache.js                 # DOM state caching
├── batch-extractor.js           # Multi-item batch extraction
├── dom-cache-integration.js     # Integration with WebSocket
├── forensic-extractors/         # New: Specialized extractors
│   ├── html-extractor.js        # Raw HTML capture
│   ├── dom-snapshot.js          # Complete DOM capture
│   ├── javascript-extractor.js  # Script extraction
│   ├── css-extractor.js         # Stylesheet capture
│   ├── network-extractor.js     # HAR generation
│   ├── metadata-extractor.js    # Meta tag extraction
│   ├── form-extractor.js        # Form data capture
│   └── cache.js                 # Extraction cache/dedup
└── extraction-manager.js        # Orchestration
```

### WebSocket Command Registration
```
websocket/commands/
├── extraction-commands.js       # Current (templates)
├── forensic-extraction-commands.js  # New: All extraction commands
├── dom-extraction-commands.js   # New: DOM-specific commands
├── javascript-extraction-commands.js # New: JS extraction
└── network-extraction-commands.js    # New: Network extraction
```

### Pipeline Architecture

```
User Request
    ↓
WebSocket Server
    ↓
Command Dispatcher
    ↓
Extraction Manager (orchestration)
    ↓
[Specialized Extractors] (parallel)
├── HTMLExtractor (page source)
├── DOMExtractor (tree snapshot)
├── JavaScriptExtractor (scripts + console + storage)
├── CSSExtractor (stylesheets)
├── NetworkExtractor (HAR logs)
└── MetadataExtractor (meta tags)
    ↓
[Enrichment Layer]
├── Hash calculation (SHA-256)
├── Timestamp addition
├── Format conversion (JSON/CSV/HAR)
├── Compression (optional)
└── Redaction (passwords, API keys)
    ↓
Client Response
```

### Performance Optimization

- **Batching:** Extract multiple items in single DOM walk (existing BatchExtractor)
- **Caching:** Cache extraction results with 5-minute TTL
- **Async:** All extraction operations non-blocking
- **Streaming:** Large responses (network logs) streamed to client
- **Compression:** 70-93% compression on responses

---

## 1.3 Priority & Dependencies

**Phase 1 (Must Have):**
- Complete CSS capture (users often need visual analysis)
- Complete DOM snapshot (required for layout reconstruction)
- JavaScript extraction with console history
- Network log enhancement (add request/response bodies)

**Phase 2 (High Priority):**
- Source maps for external scripts
- DNS/TLS details in network log
- Structured data extraction
- Form extraction (separate from DOM)

**Phase 3 (Nice to Have):**
- WebSocket traffic capture
- Service Worker code extraction
- IndexedDB data export

---

## 1.4 Effort Estimates

| Feature | Dev Hours | Testing | Documentation | Total |
|---------|-----------|---------|----------------|-------|
| Complete CSS Capture | 8 | 4 | 2 | 14 |
| DOM Snapshot Enhancement | 10 | 6 | 2 | 18 |
| JavaScript Extraction | 12 | 6 | 3 | 21 |
| Network Log Enhancement | 6 | 4 | 2 | 12 |
| Metadata Extraction | 6 | 3 | 1 | 10 |
| Form Extraction | 4 | 2 | 1 | 7 |
| Integration Testing | - | 8 | - | 8 |
| Documentation | - | - | 10 | 10 |
| **TOTAL** | **46** | **33** | **21** | **100 hours** |

---

## 1.5 Integration Points

- **ExtractionManager:** Central orchestration for all extractors
- **WebSocket Server:** Command registration and response handling
- **NetworkAnalysisManager:** Network capture integration (already exists)
- **DOMInspector:** DOM analysis utilities
- **ScreenshotManager:** Screenshot coordination (if needed)

---

## 1.6 Success Metrics

- All 164 WebSocket commands still passing tests ✅
- 20+ new extraction commands added
- 95%+ test coverage on extraction modules
- Average extraction time <500ms per command
- Zero data loss on extraction
- SHA-256 hashes match across repeated extractions
- Network log 100% request capture rate
- DOM snapshots can reconstruct page layout

---

---

# AREA 2: CONTENT INJECTION & MODIFICATION

## Overview

Unrestricted content modification—inject CSS, JavaScript, manipulate DOM, modify network requests, and control page state with complete freedom.

**Current Status:** 20% implemented (modify_element command)  
**Implementation Level:** Single element modification, need full injection framework

---

## 2.1 Feature Breakdown

### A. CSS Injection

**Purpose:** Inject and execute arbitrary CSS (no restrictions)

**Features:**
- Inject CSS into `<style>` tag
- Inject CSS via dynamically created `<link>`
- Modify existing stylesheets
- Add @media queries
- Add @font-face definitions
- Add @keyframes animations
- Override computed styles
- Inject critical CSS
- Remove CSS rules
- Disable stylesheets
- Add CSS variables

**Use Cases:**
- Visual analysis (highlight elements, hide sections)
- Testing responsive layouts
- A/B testing variants
- Removing modal overlays
- Forcing visibility of hidden elements

**Implementation:**

```javascript
// Command: inject_css
{
  "id": "inject_css_1",
  "command": "inject_css",
  "css": ".hidden { display: block !important; }",
  "target": "page",        // page, head, body, or selector
  "priority": "important"  // important or normal
}

// Response
{
  "success": true,
  "injected": true,
  "styleId": "basset-injected-1",
  "selector": "style#basset-injected-1",
  "css": ".hidden { display: block !important; }",
  "cssLength": 42,
  "timestamp": 1718863200000
}
```

**Commands Needed:**
- `inject_css` - Add CSS to page
- `inject_css_link` - Add external CSS stylesheet link
- `modify_stylesheet` - Modify existing stylesheet
- `add_css_rule` - Add single rule to existing sheet
- `remove_css_rule` - Remove rule by selector
- `disable_stylesheet` - Disable `<link>` by href or index
- `inject_css_variables` - Add/modify CSS custom properties
- `inject_font_face` - Inject @font-face definitions

**Success Criteria:**
- CSS applies immediately
- !important flag works
- Media queries function
- Affects page rendering
- Can target specific stylesheets

---

### B. JavaScript Injection & Execution

**Purpose:** Execute arbitrary JavaScript with full page context

**Features:**
- Execute code in page scope (not isolated)
- Access window object
- Modify global variables
- Call existing functions
- Create new functions
- Monkey-patch existing code
- Inject libraries (jQuery, etc.)
- Override native methods
- Hook event listeners
- Intercept network calls
- Return values to caller
- Catch errors
- Set breakpoints

**Use Cases:**
- Modify page behavior
- Extract data
- Simulate user actions
- Test functionality
- Debug issues
- Bypass client-side validation

**Implementation:**

```javascript
// Command: inject_javascript
{
  "id": "inject_js_1",
  "command": "inject_javascript",
  "code": "document.title = 'Modified Title'; return document.title;",
  "scope": "page",  // page or isolated
  "timeout": 5000
}

// Response
{
  "success": true,
  "executed": true,
  "result": "Modified Title",
  "resultType": "string",
  "executionTime": 12,
  "timestamp": 1718863200000
}
```

**Commands Needed:**
- `inject_javascript` - Execute code (already exists as execute_script)
- `inject_library` - Load external library (jQuery, lodash, etc.)
- `monkey_patch` - Override function/method
- `hook_function` - Attach code before/after function
- `hook_event` - Intercept event listener
- `modify_global` - Set/modify window.* property
- `inject_fetch_intercept` - Intercept fetch/XHR
- `inject_timing_attack` - Simulate timing delays

**Success Criteria:**
- Code executes in page context
- Can access/modify window
- Return values passed back
- Errors caught and reported
- Affects page behavior

---

### C. DOM Manipulation

**Purpose:** Modify DOM structure and content (unrestricted)

**Features:**
- Create elements
- Delete elements
- Modify element content (text, HTML)
- Modify attributes
- Modify classes
- Modify styles
- Move elements (reparent)
- Clone elements
- Append/prepend
- Replace elements
- Modify form fields
- Trigger events
- Undo/rollback changes

**Use Cases:**
- Remove ads and trackers
- Modify form fields
- Extract hidden content
- Change page structure
- Test UI changes
- Simulate user state

**Implementation:**

```javascript
// Command: modify_element (enhanced)
{
  "id": "mod_1",
  "command": "modify_element",
  "selector": "#modal",
  "type": "delete",  // delete, hide, show, content, attribute, class, style
  "value": null
}

// Advanced command: dom_operation
{
  "id": "dom_1",
  "command": "dom_operation",
  "operation": "create_element",
  "tag": "div",
  "attributes": { "id": "my-div", "class": "container" },
  "content": "<p>Hello</p>",
  "insertBefore": "#main",  // selector to insert before
  "innerHTML": true
}

// Batch operations
{
  "id": "batch_1",
  "command": "dom_batch_operations",
  "operations": [
    { "operation": "create_element", "tag": "div", "attributes": { "id": "test" } },
    { "operation": "add_class", "selector": "#test", "className": "visible" },
    { "operation": "set_content", "selector": "#test", "content": "Hello" }
  ]
}
```

**Commands Needed:**
- `modify_element` - Enhanced (✅ exists, needs expansion)
- `create_element` - Create new element with attributes
- `delete_element` - Remove element from DOM
- `move_element` - Reparent element
- `clone_element` - Duplicate element
- `dom_batch_operations` - Multiple operations atomically
- `show_element` - Set display: block
- `hide_element` - Set display: none
- `set_element_content` - Set textContent or innerHTML
- `set_element_attributes` - Batch attribute modification
- `set_element_classes` - Add/remove classes
- `set_element_styles` - Inline style modification
- `trigger_event` - Fire synthetic events

**Success Criteria:**
- Changes apply immediately to DOM
- Can delete protected elements
- Form fields fully modifiable
- Events can be triggered
- Can access document.body and HTML

---

### D. Form Manipulation

**Purpose:** Modify form structure and values with full control

**Features:**
- Fill form fields
- Clear form fields
- Modify validation rules
- Remove validation
- Change field types
- Add/remove fields
- Modify form action
- Modify form method
- Add hidden fields
- Modify submit buttons
- Inject form fields
- Override form submission
- Pre-fill with data
- Access form values before submission

**Use Cases:**
- Fill out forms programmatically
- Bypass client-side validation
- Test form submissions
- Extract form structure
- Modify form behavior

**Implementation:**

```javascript
// Command: fill_form_batch
{
  "id": "fill_1",
  "command": "fill_form_batch",
  "formSelector": "#login-form",
  "fields": {
    "username": "testuser",
    "password": "testpass123",
    "remember": true
  },
  "submitForm": false
}

// Command: inject_form_field
{
  "id": "inject_1",
  "command": "inject_form_field",
  "formSelector": "#checkout-form",
  "fieldName": "coupon_code",
  "fieldType": "text",
  "fieldValue": "DISCOUNT2026",
  "position": "before_submit"  // before_submit, after_submit, append
}

// Command: modify_form_validation
{
  "id": "valid_1",
  "command": "modify_form_validation",
  "formSelector": "#contact-form",
  "action": "disable"  // disable, remove, override
}
```

**Commands Needed:**
- `fill_form_batch` - Fill multiple fields
- `get_form_structure` - Analyze form layout
- `inject_form_field` - Add hidden or visible field
- `modify_form_validation` - Remove client-side checks
- `modify_form_action` - Change form submission URL
- `modify_form_method` - Change POST to GET, etc.
- `get_form_values` - Extract all form data
- `override_form_submit` - Intercept submission
- `populate_form` - Fill with sample data

**Success Criteria:**
- Can fill any form field
- Can bypass validation
- Can change form action
- Can intercept submission
- Can add hidden fields

---

### E. Content Insertion

**Purpose:** Insert arbitrary content into page

**Features:**
- Insert text
- Insert HTML
- Insert elements
- Insert scripts
- Insert stylesheets
- Insert content before/after element
- Insert at specific position
- Replace element content
- Append to element
- Prepend to element
- Insert multiple items

**Use Cases:**
- Add content for testing
- Inject test data
- Add debugging elements
- Insert analysis tools

**Implementation:**

```javascript
// Command: insert_content
{
  "id": "insert_1",
  "command": "insert_content",
  "content": "<div id='test'>Test content</div>",
  "target": "#main",
  "position": "append",  // append, prepend, after, before, replace
  "type": "html"  // html or text
}

// Command: insert_element
{
  "id": "insert_2",
  "command": "insert_element",
  "element": {
    "tag": "div",
    "attributes": { "id": "debug-panel", "class": "panel" },
    "content": "<h3>Debug Info</h3><p>Ready</p>",
    "styles": { "position": "fixed", "bottom": "0", "right": "0" }
  },
  "target": "body",
  "position": "append"
}
```

**Commands Needed:**
- `insert_content` - Insert HTML or text
- `insert_element` - Create and insert element
- `insert_script` - Add script tag or code
- `insert_stylesheet` - Add stylesheet link
- `replace_content` - Replace target content

**Success Criteria:**
- Content appears in DOM
- HTML is properly parsed
- Can insert scripts
- Content can be styled

---

## 2.2 Implementation Architecture

### Module Structure
```
injection/
├── css-injector.js              # CSS injection engine
├── javascript-injector.js       # JS execution engine
├── dom-modifier.js              # DOM manipulation (extends modify_element)
├── form-modifier.js             # Form-specific operations
├── content-inserter.js          # Content insertion
├── injection-manager.js         # Central orchestration
└── rollback-manager.js          # Undo/rollback capability

websocket/commands/
├── injection-commands.js        # New: All injection commands
├── css-injection-commands.js    # CSS-specific
├── javascript-injection-commands.js # JS-specific
├── dom-manipulation-commands.js # DOM-specific
└── form-modification-commands.js   # Form-specific
```

### Safety Note

**Critical:** These features are UNRESTRICTED because this is a forensic/research tool, not a security-hardened application. Users can:
- Inject any code
- Modify any element
- Bypass any client-side security
- Execute arbitrary JavaScript
- Modify forms before submission

This is intentional and documented in SCOPE.md.

---

## 2.3 Priority & Dependencies

**Phase 1 (Must Have):**
- Enhanced DOM modification (expand current modify_element)
- CSS injection (high forensic value)
- JavaScript injection (already exists as execute_script)
- Form batch operations

**Phase 2 (High Priority):**
- Form validation bypass
- Content insertion framework
- Rollback capability

**Phase 3 (Nice to Have):**
- Batch DOM operations
- Transaction-like semantics
- Performance optimization

---

## 2.4 Effort Estimates

| Feature | Dev Hours | Testing | Docs | Total |
|---------|-----------|---------|------|-------|
| Enhanced DOM Modification | 6 | 4 | 1 | 11 |
| CSS Injection Framework | 8 | 4 | 2 | 14 |
| Form Manipulation | 8 | 4 | 2 | 14 |
| Content Insertion | 6 | 3 | 1 | 10 |
| Rollback/Transaction | 6 | 4 | 1 | 11 |
| Integration | - | 6 | - | 6 |
| Documentation | - | - | 8 | 8 |
| **TOTAL** | **34** | **25** | **15** | **74 hours** |

---

## 2.5 Success Metrics

- All modifications apply immediately
- Can bypass client-side validation
- Can modify any DOM element
- CSS injection works with !important
- JavaScript executes in page context
- Forms can be filled programmatically
- Changes persist until page reload

---

---

# AREA 3: LOWER-LEVEL INTERACTION

## Overview

Direct browser engine access—DOM protocols, JavaScript execution context, network-level control, and storage access without restrictions.

**Current Status:** 30% implemented (execute_script, some network control)  
**Implementation Level:** Need unified lower-level API

---

## 3.1 Feature Breakdown

### A. Direct DOM Access

**Purpose:** Low-level DOM manipulation without restrictions

**Features:**
- Access document object
- Access window object
- Access DOM nodes directly
- Access node properties (offsetWidth, scrollHeight, etc.)
- Access computed styles
- Access CSS classes
- Access attributes
- Modify prototypes (monkey-patch)
- Access internal properties
- Shadow DOM access
- iframe access and manipulation
- Cross-origin iframe access (with permissions)

**Use Cases:**
- Extract element measurements
- Analyze layout
- Debug styling
- Test interactions
- Verify page state
- Analyze DOM structure

**Implementation:**

```javascript
// Command: access_dom_element
{
  "id": "dom_access_1",
  "command": "access_dom_element",
  "selector": "#main",
  "properties": ["offsetWidth", "offsetHeight", "scrollHeight", "className", "style"]
}

// Response
{
  "success": true,
  "element": {
    "selector": "#main",
    "tag": "div",
    "offsetWidth": 1200,
    "offsetHeight": 600,
    "scrollHeight": 2400,
    "className": "container active",
    "style": {
      "display": "block",
      "width": "100%",
      "height": "600px"
    },
    "attributes": {
      "id": "main",
      "data-section": "content"
    }
  }
}

// Command: access_computed_style
{
  "id": "style_1",
  "command": "access_computed_style",
  "selector": ".button",
  "pseudoElement": null
}

// Response
{
  "success": true,
  "computedStyle": {
    "display": "inline-block",
    "backgroundColor": "rgb(0, 120, 215)",
    "color": "rgb(255, 255, 255)",
    "padding": "10px 20px",
    "borderRadius": "4px"
  }
}
```

**Commands Needed:**
- `access_dom_element` - Get element properties
- `access_computed_style` - Get computed CSS
- `access_dom_node` - Get node information
- `access_shadow_dom` - Access shadow DOM if present
- `access_iframe` - Access iframe document
- `query_dom_all` - Query multiple elements
- `get_dom_traversal` - Get parent/child/sibling info

**Success Criteria:**
- Can access any DOM element
- Can read all computed styles
- Can access shadow DOM
- Returns accurate measurements
- Can traverse parent/child

---

### B. JavaScript Execution Context

**Purpose:** Execute code with full JavaScript engine access

**Features:**
- Execute code in page scope
- Access and modify global state
- Call any JavaScript function
- Return values from execution
- Catch and report errors
- Access browser APIs (localStorage, fetch, etc.)
- Set up long-running code
- Interrupt execution
- Measure execution time
- Profile code execution
- Evaluate expressions
- Access console

**Use Cases:**
- Extract data via JavaScript
- Test functionality
- Debug issues
- Modify page behavior
- Analyze execution
- Performance profiling

**Implementation:**

```javascript
// Command: eval_javascript (enhanced execute_script)
{
  "id": "eval_1",
  "command": "eval_javascript",
  "code": "return document.querySelectorAll('a').map(el => ({ text: el.textContent, href: el.href }))",
  "timeout": 5000,
  "captureErrors": true,
  "captureConsole": true,
  "returnAsJson": true
}

// Response
{
  "success": true,
  "result": [
    { "text": "Home", "href": "https://example.com/" },
    { "text": "About", "href": "https://example.com/about" }
  ],
  "resultType": "object",
  "executionTime": 45,
  "errors": [],
  "console": [],
  "timestamp": 1718863200000
}

// Command: call_function
{
  "id": "call_1",
  "command": "call_function",
  "functionPath": "window.myApp.getData",
  "args": [{ "userId": 123 }, "json"],
  "timeout": 5000
}

// Response
{
  "success": true,
  "result": { "id": 123, "name": "John Doe" },
  "executionTime": 250
}

// Command: access_browser_api
{
  "id": "api_1",
  "command": "access_browser_api",
  "api": "localStorage",
  "operation": "getItem",
  "args": ["theme"]
}

// Response
{
  "success": true,
  "result": "dark"
}
```

**Commands Needed:**
- `eval_javascript` - Execute code (enhanced execute_script)
- `call_function` - Call specific function by path
- `set_global_variable` - Set window.* property
- `get_global_variable` - Get window.* property
- `profile_execution` - Measure execution time
- `set_breakpoint` - Debug support
- `access_browser_api` - localStorage, sessionStorage, fetch, etc.
- `get_console_logs` - Access browser console (✅ exists)

**Success Criteria:**
- Code executes with full access
- Can return values
- Can call functions
- Can modify globals
- Errors reported accurately

---

### C. Network-Level Control

**Purpose:** Intercept, modify, and replay network requests

**Features:**
- Intercept HTTP requests
- Intercept HTTP responses
- Modify request headers
- Modify request body
- Modify response headers
- Modify response body
- Block requests
- Redirect requests
- Throttle requests
- Simulate network conditions
- Replay requests
- Mock responses
- Record request/response pairs

**Use Cases:**
- Block trackers and ads
- Modify API responses for testing
- Test error handling
- Simulate network conditions
- Analyze requests/responses
- Reverse engineer APIs

**Implementation:**

```javascript
// Command: intercept_request
{
  "id": "intercept_1",
  "command": "intercept_request",
  "urlPattern": "*api.example.com*",
  "action": "modify",  // intercept, block, redirect, mock
  "modifyHeaders": {
    "Authorization": "Bearer NEW_TOKEN"
  },
  "modifyBody": null,
  "priority": "high"
}

// Response
{
  "success": true,
  "interceptId": "intercept_1",
  "pattern": "*api.example.com*",
  "active": true
}

// Command: intercept_response
{
  "id": "intercept_2",
  "command": "intercept_response",
  "urlPattern": "*api.example.com/users*",
  "action": "modify",
  "modifyHeaders": {
    "Content-Type": "application/json"
  },
  "modifyBody": "{\"users\": []}",
  "statusCode": 200
}

// Command: mock_request
{
  "id": "mock_1",
  "command": "mock_request",
  "urlPattern": "*analytics.example.com*",
  "method": "POST",
  "responseStatus": 204,
  "responseHeaders": {},
  "responseBody": ""
}

// Command: replay_request
{
  "id": "replay_1",
  "command": "replay_request",
  "requestId": "req_123",  // from network log
  "modifyHeaders": {}
}
```

**Commands Needed:**
- `intercept_request` - Intercept and modify requests
- `intercept_response` - Intercept and modify responses
- `block_request` - Block requests matching pattern (✅ exists as part of request blocking)
- `redirect_request` - Redirect to different URL
- `mock_request` - Mock endpoint with response
- `throttle_request` - Add latency
- `replay_request` - Replay captured request
- `simulate_network_conditions` - Latency, bandwidth, offline

**Success Criteria:**
- Can block any request
- Can modify request/response
- Can mock endpoints
- Can replay requests
- Modifications apply before transmission

---

### D. Storage Access

**Purpose:** Direct access to all browser storage mechanisms

**Features:**
- localStorage access (get, set, delete, clear)
- sessionStorage access
- IndexedDB access (create, query, update, delete)
- Cookies access (get, set, delete)
- Service Worker registration status
- Web Workers state
- Cache API access
- WebSQL access (if available)

**Use Cases:**
- Extract stored data
- Modify stored credentials
- Test storage mechanisms
- Clear tracking cookies
- Analyze session data

**Implementation:**

```javascript
// Command: access_storage
{
  "id": "storage_1",
  "command": "access_storage",
  "storageType": "localStorage",  // localStorage, sessionStorage, cookies, indexedDB
  "operation": "get",  // get, set, delete, clear, list
  "key": "theme",
  "value": null
}

// Response
{
  "success": true,
  "storageType": "localStorage",
  "operation": "get",
  "key": "theme",
  "value": "dark",
  "timestamp": 1718863200000
}

// Command: export_all_storage
{
  "id": "storage_2",
  "command": "export_all_storage"
}

// Response
{
  "success": true,
  "localStorage": {
    "theme": "dark",
    "language": "en"
  },
  "sessionStorage": {
    "sessionId": "xyz123"
  },
  "cookies": [
    { "name": "sessionid", "value": "abc123", "secure": true, "httpOnly": true }
  ],
  "indexedDB": {
    "stores": [
      { "name": "cache", "entries": 234 }
    ]
  }
}

// Command: modify_storage
{
  "id": "storage_3",
  "command": "modify_storage",
  "storageType": "localStorage",
  "key": "apiKey",
  "value": "new_key_value",
  "operation": "set"
}
```

**Commands Needed:**
- `access_storage` - Get/set/delete from storage
- `export_all_storage` - Export all storage contents
- `clear_storage` - Clear specific storage type
- `access_cookies` - Cookie manipulation
- `access_indexeddb` - IndexedDB operations
- `export_indexeddb` - Export IndexedDB data
- `modify_cookies` - Add/update/delete cookies

**Success Criteria:**
- Can read all storage types
- Can modify storage
- Can delete cookies
- IndexedDB queryable
- Changes persist

---

### E. DevTools Protocol Access

**Purpose:** Access to Chrome DevTools Protocol for advanced debugging

**Features:**
- Page inspection
- Element highlighting
- Console access
- Network monitoring
- Performance profiling
- Memory profiling
- Code coverage
- Breakpoints
- Stepping through code
- Runtime evaluation
- Event listener inspection
- DOM tree inspection

**Use Cases:**
- Advanced debugging
- Performance analysis
- Memory profiling
- Code coverage analysis
- Deep inspection

**Implementation:**

```javascript
// Command: devtools_evaluate
{
  "id": "devtools_1",
  "command": "devtools_evaluate",
  "expression": "navigator.userAgent",
  "includeCommandLineAPI": true
}

// Response
{
  "success": true,
  "result": "Mozilla/5.0...",
  "type": "string"
}

// Command: devtools_get_page_source
{
  "id": "devtools_2",
  "command": "devtools_get_page_source"
}

// Response
{
  "success": true,
  "frameId": "123",
  "content": "<!DOCTYPE html>...",
  "hash": "abc123"
}

// Command: devtools_get_event_listeners
{
  "id": "devtools_3",
  "command": "devtools_get_event_listeners",
  "objectId": "elem_456"
}

// Response
{
  "success": true,
  "listeners": [
    { "type": "click", "listener": "function onClick() {...}", "passive": false }
  ]
}
```

**Commands Needed:**
- `devtools_evaluate` - Evaluate expression
- `devtools_get_page_source` - Get page source
- `devtools_get_event_listeners` - List listeners
- `devtools_inspect_element` - Inspect element
- `devtools_take_heap_snapshot` - Memory profiling
- `devtools_profile_performance` - Performance profiling
- `devtools_get_coverage` - Code coverage

**Success Criteria:**
- Can evaluate expressions
- Can inspect elements
- Can access event listeners
- Can profile performance
- Can analyze memory usage

---

## 3.2 Implementation Architecture

### Module Structure
```
lowlevel/
├── dom-accessor.js              # Direct DOM access
├── javascript-executor.js       # JS context execution
├── network-interceptor.js       # Request/response interception (extends request-interceptor)
├── storage-manager.js           # Storage access (extends existing)
├── devtools-proxy.js            # DevTools protocol wrapper
└── lowlevel-manager.js          # Central orchestration

websocket/commands/
├── lowlevel-commands.js         # All lower-level commands
├── dom-access-commands.js       # DOM-specific
├── execution-context-commands.js # JS execution
├── network-interceptor-commands.js # Network control
└── devtools-commands.js         # DevTools access
```

---

## 3.3 Priority & Dependencies

**Phase 1 (Must Have):**
- Enhanced DOM access (property reading)
- Direct JavaScript execution context
- Network interception and modification

**Phase 2 (High Priority):**
- Full storage access API
- DevTools protocol wrapper

**Phase 3 (Nice to Have):**
- Performance profiling
- Memory profiling
- Advanced debugging

---

## 3.4 Effort Estimates

| Feature | Dev Hours | Testing | Docs | Total |
|---------|-----------|---------|------|-------|
| DOM Accessor | 6 | 4 | 1 | 11 |
| JS Execution Context | 4 | 3 | 1 | 8 |
| Network Interception | 10 | 6 | 2 | 18 |
| Storage Manager API | 8 | 4 | 1 | 13 |
| DevTools Proxy | 8 | 4 | 2 | 14 |
| Integration | - | 6 | - | 6 |
| Documentation | - | - | 6 | 6 |
| **TOTAL** | **36** | **27** | **13** | **76 hours** |

---

## 3.5 Success Metrics

- Can access any DOM property
- Can execute JavaScript with full context
- Can intercept and modify requests
- Can read/write storage
- DevTools commands execute correctly
- No restrictions on operations

---

---

# AREA 4: EXPORT & ANALYSIS

## Overview

Multiple export formats, custom templates, batch operations, and built-in analysis tools for extracted data.

**Current Status:** 15% implemented (basic JSON/HAR export)  
**Implementation Level:** Need format conversion, templating, correlation analysis

---

## 4.1 Feature Breakdown

### A. Multiple Export Formats

**Purpose:** Export data in various formats for different tools/workflows

**Supported Formats:**

#### JSON (Structured Data)
```json
{
  "data": { ... },
  "metadata": {
    "exportTime": 1718863200000,
    "dataVersion": "1.0"
  }
}
```

#### CSV (Spreadsheet Analysis)
```
url,statusCode,loadTime,hasImages,formCount
https://example.com,200,450,12,3
https://example.com/page2,200,350,8,1
```

#### HAR (Network Standard)
```json
{
  "log": {
    "version": "1.2",
    "creator": { ... },
    "entries": [ ... ]
  }
}
```

#### WARC (Web Archive Standard)
```
WARC/1.0
WARC-Type: response
WARC-Record-ID: <urn:uuid:12345>
WARC-Date: 2026-06-20T10:30:00Z
...
```

#### SQLite (Queryable Database)
```sql
CREATE TABLE pages (id, url, statusCode, loadTime);
CREATE TABLE network (id, url, method, statusCode);
```

#### Markdown (Human-Readable Report)
```markdown
# Page Analysis Report
**URL:** https://example.com
**Status:** 200 OK
**Load Time:** 450ms
...
```

#### XML (Enterprise Integration)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<pageAnalysis>
  <url>https://example.com</url>
  <statusCode>200</statusCode>
  ...
</pageAnalysis>
```

**Implementation:**

```javascript
// Command: export_data
{
  "id": "export_1",
  "command": "export_data",
  "sourceCommand": "export_dom_snapshot",  // or any extraction command
  "format": "json",  // json, csv, har, warc, sqlite, markdown, xml
  "includeDerivedData": true,
  "includeMetadata": true,
  "compress": true,
  "compressionFormat": "gzip"  // gzip, brotli, deflate
}

// Response
{
  "success": true,
  "exportId": "export_1",
  "format": "json",
  "dataSize": 45320,
  "compressedSize": 3200,
  "compressionRatio": 0.93,
  "downloadUrl": "/exports/export_1.json.gz",
  "expires": 1718863200000 + (24 * 60 * 60 * 1000),
  "timestamp": 1718863200000
}

// Command: export_batch
{
  "id": "batch_1",
  "command": "export_batch",
  "extractions": [
    { "command": "export_raw_html", "format": "json" },
    { "command": "export_network_log", "format": "har" },
    { "command": "export_dom_snapshot", "format": "json" }
  ],
  "packageFormat": "zip",  // zip, tar, none
  "packageName": "site_analysis_2026-06-20"
}

// Response
{
  "success": true,
  "packageId": "batch_1",
  "files": [
    { "name": "html_export.json", "size": 45320 },
    { "name": "network_export.har", "size": 234560 },
    { "name": "dom_export.json", "size": 123456 }
  ],
  "totalSize": 403336,
  "downloadUrl": "/exports/site_analysis_2026-06-20.zip",
  "timestamp": 1718863200000
}
```

**Commands Needed:**
- `export_data` - Convert extraction to format
- `export_batch` - Export multiple extractions
- `export_template` - Use custom export template
- `export_as_csv` - Quick CSV export
- `export_as_json` - Quick JSON export
- `export_as_har` - Quick HAR export
- `export_as_markdown` - Quick markdown report
- `export_as_sqlite` - Create queryable database
- `export_as_warc` - Create WARC archive
- `export_compare` - Compare two extractions

**Success Criteria:**
- All formats supported
- Data preserved in conversion
- Compression working
- Batch operations atomic
- Exports queryable/analyzable

---

### B. Custom Export Templates

**Purpose:** Define custom export schemas for domain-specific needs

**Features:**
- Define field mappings
- Include/exclude fields
- Custom calculations
- Data transformations
- Field renaming
- Nesting
- Aggregation
- Filtering

**Implementation:**

```javascript
// Command: create_export_template
{
  "id": "template_1",
  "command": "create_export_template",
  "name": "ecommerce_product_analysis",
  "description": "Extract product information from e-commerce sites",
  "sourceCommand": "export_dom_snapshot",
  "fields": {
    "productName": {
      "selector": ".product-name",
      "type": "text",
      "required": true
    },
    "price": {
      "selector": ".product-price",
      "type": "number",
      "pattern": "\\$([0-9.]+)",
      "required": true
    },
    "rating": {
      "selector": ".product-rating",
      "type": "number",
      "default": 0
    },
    "availability": {
      "selector": ".in-stock",
      "type": "boolean",
      "default": false
    },
    "imageUrls": {
      "selector": ".product-image img",
      "type": "array",
      "attribute": "src"
    }
  }
}

// Response
{
  "success": true,
  "templateId": "template_1",
  "name": "ecommerce_product_analysis",
  "fields": 5,
  "timestamp": 1718863200000
}

// Command: use_export_template
{
  "id": "use_template_1",
  "command": "use_export_template",
  "templateId": "template_1",
  "format": "json"
}

// Response
{
  "success": true,
  "data": {
    "products": [
      {
        "productName": "Product A",
        "price": 29.99,
        "rating": 4.5,
        "availability": true,
        "imageUrls": ["image1.jpg", "image2.jpg"]
      }
    ]
  },
  "itemsExtracted": 1
}
```

**Commands Needed:**
- `create_export_template` - Define template
- `list_export_templates` - List available templates
- `use_export_template` - Apply template
- `modify_export_template` - Edit template
- `delete_export_template` - Remove template
- `save_template_as_preset` - Save for future use

**Success Criteria:**
- Templates save and load
- Field mappings work
- Transformations apply
- Data extracted accurately

---

### C. Batch Operations

**Purpose:** Process multiple pages/extractions together

**Features:**
- Extract from multiple pages
- Combine results
- Deduplicate across sites
- Correlate data
- Aggregate statistics
- Compare versions
- Diff analysis

**Implementation:**

```javascript
// Command: batch_extract
{
  "id": "batch_extract_1",
  "command": "batch_extract",
  "urls": [
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3"
  ],
  "extractionType": "export_dom_snapshot",
  "executeSequentially": true,
  "delayBetweenRequests": 2000
}

// Response
{
  "success": true,
  "batchId": "batch_extract_1",
  "totalPages": 3,
  "extractedPages": 3,
  "failedPages": 0,
  "totalExtractionTime": 5000,
  "exports": [
    { "url": "https://example.com/page1", "exportId": "export_p1", "size": 45320 },
    { "url": "https://example.com/page2", "exportId": "export_p2", "size": 38240 },
    { "url": "https://example.com/page3", "exportId": "export_p3", "size": 42100 }
  ]
}

// Command: correlate_data
{
  "id": "correlate_1",
  "command": "correlate_data",
  "extractions": ["export_p1", "export_p2", "export_p3"],
  "correlationFields": ["url", "title", "author"],
  "aggregations": {
    "wordCount": "sum",
    "linkCount": "sum",
    "imageCount": "sum"
  }
}

// Response
{
  "success": true,
  "correlationId": "correlate_1",
  "commonFields": ["url", "title", "author"],
  "aggregates": {
    "totalWords": 12345,
    "totalLinks": 234,
    "totalImages": 89
  },
  "uniqueValues": {
    "authors": ["John Doe", "Jane Smith"],
    "domains": ["example.com"]
  }
}
```

**Commands Needed:**
- `batch_extract` - Extract from multiple URLs
- `combine_exports` - Merge multiple exports
- `deduplicate_data` - Remove duplicates
- `correlate_data` - Find relationships
- `aggregate_statistics` - Summary statistics
- `compare_exports` - Diff analysis
- `merge_exports` - Combine into single file

**Success Criteria:**
- Can process multiple pages
- Results combinable
- Deduplication accurate
- Correlation finds relationships
- Performance acceptable

---

### D. Data Correlation & Analysis

**Purpose:** Built-in analysis tools for extracted data

**Features:**
- Find common data across extractions
- Identify duplicates
- Detect patterns
- Timeline analysis
- Domain/URL clustering
- Link graph generation
- Text analysis (word frequency, etc.)
- Image duplicate detection
- Code similarity detection

**Implementation:**

```javascript
// Command: analyze_extractions
{
  "id": "analyze_1",
  "command": "analyze_extractions",
  "extractions": ["export_1", "export_2", "export_3"],
  "analysisType": "pattern",  // pattern, similarity, timeline, graph, textfreq, imagedup
  "options": {
    "includeMetadata": true,
    "generateVisualization": true
  }
}

// Response (Pattern Analysis)
{
  "success": true,
  "analysisId": "analyze_1",
  "analysisType": "pattern",
  "patterns": [
    {
      "pattern": "Tracking pixel in footer",
      "occurrences": 3,
      "locations": ["footer", "body"],
      "type": "tracking",
      "examples": ["<img src='analytics.js'>"]
    }
  ]
}

// Response (Similarity Analysis)
{
  "success": true,
  "analysisType": "similarity",
  "similarities": [
    {
      "extraction1": "export_1",
      "extraction2": "export_2",
      "similarity": 0.92,
      "matchedElements": 234,
      "differences": 20
    }
  ]
}

// Command: generate_link_graph
{
  "id": "graph_1",
  "command": "generate_link_graph",
  "exports": ["export_1", "export_2"],
  "format": "json"  // json, dot, gexf
}

// Response
{
  "success": true,
  "graphId": "graph_1",
  "nodes": 456,
  "edges": 1234,
  "clusters": 5,
  "downloadUrl": "/exports/link_graph.json"
}
```

**Commands Needed:**
- `analyze_extractions` - Multi-extraction analysis
- `find_patterns` - Pattern detection
- `detect_similarity` - Compare extractions
- `analyze_timeline` - Timeline analysis
- `generate_link_graph` - Link relationship graph
- `analyze_text_frequency` - Word frequency, NLP
- `detect_duplicate_images` - Image comparison
- `detect_similar_code` - Code similarity

**Success Criteria:**
- Patterns accurately detected
- Similarity scores meaningful
- Link graphs correct
- Analysis complete
- Results actionable

---

## 4.2 Implementation Architecture

### Module Structure
```
export/
├── format-converters/
│   ├── json-converter.js
│   ├── csv-converter.js
│   ├── har-converter.js
│   ├── warc-converter.js
│   ├── sqlite-converter.js
│   ├── markdown-converter.js
│   └── xml-converter.js
├── template-engine.js            # Custom templates
├── batch-processor.js            # Batch operations
├── correlation-engine.js         # Data correlation
├── analysis-engine.js            # Built-in analysis
└── export-manager.js             # Central orchestration

websocket/commands/
├── export-commands.js            # Main export commands
├── format-converter-commands.js   # Format conversion
├── template-commands.js          # Template management
├── batch-commands.js             # Batch operations
└── analysis-commands.js          # Analysis tools
```

---

## 4.3 Priority & Dependencies

**Phase 1 (Must Have):**
- JSON/CSV/HAR conversion (format converters)
- Basic batch extraction
- Data correlation framework

**Phase 2 (High Priority):**
- Custom export templates
- Advanced analysis tools
- Link graph generation

**Phase 3 (Nice to Have):**
- SQLite export
- WARC export
- Markdown report generation
- Image duplicate detection

---

## 4.4 Effort Estimates

| Feature | Dev Hours | Testing | Docs | Total |
|---------|-----------|---------|------|-------|
| Format Converters | 16 | 8 | 3 | 27 |
| Custom Templates | 10 | 5 | 2 | 17 |
| Batch Operations | 10 | 6 | 2 | 18 |
| Correlation Engine | 12 | 6 | 2 | 20 |
| Analysis Tools | 16 | 8 | 2 | 26 |
| Link Graph Generation | 8 | 4 | 1 | 13 |
| Integration | - | 8 | - | 8 |
| Documentation | - | - | 8 | 8 |
| **TOTAL** | **72** | **45** | **20** | **137 hours** |

---

## 4.5 Success Metrics

- All 7 export formats working
- Batch processing 100+ pages
- Data lossless in conversion
- Templates save and reuse
- Analysis accurate and fast
- Correlation finds relationships
- Exports queryable/analyzable

---

---

# AREA 5: USER CONTROL API

## Overview

Granular user control over extraction, custom scripting interface, and extension capabilities for power users.

**Current Status:** 10% implemented (basic template system)  
**Implementation Level:** Need full scripting API and customization framework

---

## 5.1 Feature Breakdown

### A. Granular Data Selection

**Purpose:** Users select exactly which data to extract

**Features:**
- Field-level selection
- Element-level selection
- Attribute selection
- Custom CSS selectors
- XPath selectors
- Regex patterns
- Data type selection
- Inclusion/exclusion lists
- Conditional extraction
- Custom logic

**Implementation:**

```javascript
// Command: configure_extraction
{
  "id": "config_1",
  "command": "configure_extraction",
  "extractionType": "export_dom_snapshot",
  "fieldSelection": {
    "include": ["title", "headings", "links", "forms"],
    "exclude": ["scripts", "styles", "comments"],
    "custom": {
      "productPrices": {
        "selector": ".price",
        "attribute": "data-price",
        "type": "number",
        "required": true
      }
    }
  }
}

// Command: select_elements_for_extraction
{
  "id": "select_1",
  "command": "select_elements_for_extraction",
  "selectors": [
    "#main .article",
    ".sidebar aside",
    "[data-analyze='true']"
  ],
  "fields": ["title", "content", "metadata"],
  "format": "json"
}

// Command: extraction_with_xpath
{
  "id": "xpath_1",
  "command": "extraction_with_xpath",
  "expressions": [
    "//article[@class='post']",
    "//div[@id='sidebar']//*[@class='widget']"
  ],
  "format": "json"
}
```

**Commands Needed:**
- `configure_extraction` - Set extraction options
- `select_elements_for_extraction` - Choose elements by selector
- `extraction_with_xpath` - XPath-based selection
- `extraction_with_regex` - Regex-based selection
- `set_extraction_filters` - Include/exclude rules
- `preview_extraction` - Show what will be extracted

**Success Criteria:**
- Users can select specific data
- Selectors work accurately
- XPath expressions evaluated
- Filters applied correctly
- Preview shows expected data

---

### B. Raw vs Processed Output

**Purpose:** Users choose between raw unprocessed and processed/normalized data

**Modes:**

#### Raw Mode
- No processing
- Original data as-is
- No validation
- No cleanup
- No formatting

#### Processed Mode
- Data validation
- Cleanup (whitespace, encoding)
- Normalization (URLs, dates)
- Type conversion
- Security redaction (optional)

**Implementation:**

```javascript
// Command: extraction_with_mode
{
  "id": "mode_1",
  "command": "extraction_with_mode",
  "extractionType": "export_raw_html",
  "mode": "raw",  // raw or processed
  "options": {
    "minify": false,
    "removeComments": false,
    "normalizeWhitespace": false,
    "preserveEncoding": true
  }
}

// Raw mode response
{
  "success": true,
  "mode": "raw",
  "html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <title>Page  Title</title>\n</head>\n...",
  "dataSize": 45320,
  "processed": false
}

// Processed mode response
{
  "success": true,
  "mode": "processed",
  "html": "<!DOCTYPE html><html lang=\"en\"><head><title>Page Title</title></head>...",
  "dataSize": 42100,
  "normalizations": {
    "whitespaceCleaned": true,
    "commentsRemoved": false,
    "minified": true
  },
  "processed": true
}
```

**Commands Needed:**
- `extraction_with_mode` - Raw or processed output
- `configure_processing` - Set processing options
- `normalize_extracted_data` - Post-process extraction
- `minify_output` - Compress output
- `validate_extracted_data` - Data validation

**Success Criteria:**
- Raw mode returns unmodified data
- Processed mode cleans data
- Users can choose mode
- Processing options work
- Data integrity maintained

---

### C. Custom Filtering & Transformation

**Purpose:** Apply custom logic to filter and transform data

**Features:**
- Filter by condition
- Transform values
- Map/reduce operations
- Custom functions
- Chained transformations
- Conditional logic

**Implementation:**

```javascript
// Command: extraction_with_transformation
{
  "id": "transform_1",
  "command": "extraction_with_transformation",
  "extractionType": "export_dom_snapshot",
  "transformations": [
    {
      "type": "filter",
      "expression": "item.price > 100"
    },
    {
      "type": "map",
      "expression": "{ name: item.title, cost: item.price * 1.1 }"
    },
    {
      "type": "custom",
      "function": "function(data) { return data.filter(x => x.cost < 200); }"
    }
  ]
}

// Response
{
  "success": true,
  "transformations": 3,
  "inputItems": 100,
  "outputItems": 23,
  "data": [
    { "name": "Product A", "cost": 110.00 },
    { "name": "Product B", "cost": 132.00 }
  ]
}

// Command: build_extraction_pipeline
{
  "id": "pipeline_1",
  "command": "build_extraction_pipeline",
  "steps": [
    {
      "step": "extract",
      "command": "export_dom_snapshot",
      "selector": ".product"
    },
    {
      "step": "filter",
      "condition": "item.price > 50"
    },
    {
      "step": "transform",
      "mapping": { "title": "name", "price": "cost" }
    },
    {
      "step": "deduplicate",
      "field": "name"
    },
    {
      "step": "export",
      "format": "csv"
    }
  ]
}

// Response
{
  "success": true,
  "pipelineId": "pipeline_1",
  "steps": 5,
  "executed": true,
  "results": { ... }
}
```

**Commands Needed:**
- `extraction_with_transformation` - Apply transformations
- `build_extraction_pipeline` - Multi-step pipeline
- `apply_filter` - Filter results
- `apply_mapping` - Transform field names
- `apply_reducer` - Aggregation
- `apply_custom_function` - Custom logic

**Success Criteria:**
- Filters work accurately
- Transformations apply
- Pipelines execute in order
- Custom functions work
- Results correct

---

### D. Scripting Interface

**Purpose:** Full scripting capability for power users

**Features:**
- JavaScript scripting support
- Python scripting support (via separate SDK)
- Access to all commands
- Custom helper functions
- Loop and conditional support
- Variable storage
- Script debugging
- Error handling
- Script scheduling

**Implementation:**

```javascript
// Command: run_extraction_script
{
  "id": "script_1",
  "command": "run_extraction_script",
  "language": "javascript",
  "script": `
    // Extract all links from page and analyze
    const links = await extract('export_raw_html');
    
    const pattern = /<a\\s+href=["'](.*?)["']/g;
    const urls = [];
    let match;
    
    while ((match = pattern.exec(links.html)) !== null) {
      urls.push(match[1]);
    }
    
    // Filter external links
    const external = urls.filter(url => 
      !url.startsWith('/') && !url.includes(window.location.hostname)
    );
    
    // Export results
    return {
      totalLinks: urls.length,
      externalLinks: external.length,
      urls: external
    };
  `,
  "timeout": 30000
}

// Response
{
  "success": true,
  "scriptId": "script_1",
  "result": {
    "totalLinks": 234,
    "externalLinks": 45,
    "urls": ["https://external1.com", "https://external2.com"]
  },
  "executionTime": 245
}

// Command: save_extraction_script
{
  "id": "save_1",
  "command": "save_extraction_script",
  "scriptId": "script_1",
  "name": "analyze_external_links",
  "description": "Extract and analyze external links from page",
  "category": "analysis"
}

// Response
{
  "success": true,
  "scriptId": "script_1",
  "saved": true,
  "scriptName": "analyze_external_links"
}

// Command: list_user_scripts
{
  "id": "list_1",
  "command": "list_user_scripts"
}

// Response
{
  "success": true,
  "scripts": [
    {
      "id": "script_1",
      "name": "analyze_external_links",
      "category": "analysis",
      "created": 1718863200000,
      "lastModified": 1718863200000,
      "executions": 12
    }
  ]
}
```

**Commands Needed:**
- `run_extraction_script` - Execute custom script
- `save_extraction_script` - Save script for reuse
- `list_user_scripts` - List saved scripts
- `modify_script` - Edit saved script
- `delete_script` - Remove script
- `schedule_script` - Run on schedule
- `debug_script` - Step through execution

**Success Criteria:**
- Scripts execute correctly
- Can access all commands
- Return values accurate
- Error handling works
- Scripts can be saved/reused

---

## 5.2 Implementation Architecture

### Module Structure
```
scripting/
├── script-engine.js             # JavaScript execution
├── pipeline-builder.js          # Pipeline construction
├── filter-engine.js             # Filter evaluation
├── transformation-engine.js     # Data transformation
├── script-storage.js            # Save/load scripts
└── user-api.js                  # User-facing API

websocket/commands/
├── user-control-commands.js     # User control API
├── scripting-commands.js        # Script execution
├── filtering-commands.js        # Filter operations
└── pipeline-commands.js         # Pipeline operations
```

### Script Execution Context

```javascript
// Available in user scripts
const context = {
  // Extraction functions
  extract: async (command, params) => {},
  exportData: async (format, options) => {},
  
  // Data manipulation
  filter: (array, condition) => {},
  map: (array, transform) => {},
  reduce: (array, reducer) => {},
  
  // Storage
  saveVariable: (name, value) => {},
  getVariable: (name) => {},
  
  // Logging
  log: (message) => {},
  debug: (message) => {},
  
  // Utilities
  delay: (ms) => {},
  fetch: (url, options) => {}
};
```

---

## 5.3 Priority & Dependencies

**Phase 1 (Must Have):**
- Granular data selection (field-level)
- Raw vs processed output mode
- Custom filtering & transformation

**Phase 2 (High Priority):**
- Scripting interface
- Script storage/reuse
- Pipeline builder

**Phase 3 (Nice to Have):**
- Advanced scripting features
- Schedule support
- Debugging tools

---

## 5.4 Effort Estimates

| Feature | Dev Hours | Testing | Docs | Total |
|---------|-----------|---------|------|-------|
| Granular Selection | 8 | 4 | 1 | 13 |
| Raw vs Processed | 6 | 3 | 1 | 10 |
| Custom Filtering | 10 | 5 | 2 | 17 |
| Scripting Engine | 16 | 8 | 3 | 27 |
| Script Storage | 6 | 3 | 1 | 10 |
| Pipeline Builder | 12 | 6 | 2 | 20 |
| Integration | - | 6 | - | 6 |
| Documentation | - | - | 12 | 12 |
| **TOTAL** | **58** | **35** | **22** | **115 hours** |

---

## 5.5 Success Metrics

- Users can select specific fields
- Raw data unmodified, processed data cleaned
- Filters work accurately
- Pipelines execute in order
- Scripts execute without errors
- Scripts can be saved and reused
- Custom functions work

---

---

# INTEGRATION ARCHITECTURE

## Cross-Area Communication

```
User API (Area 5)
    ↓
Scripting Engine ← → Extraction Manager (Area 1)
    ↓               ↓
User Scripts ← → Injection Manager (Area 2)
    ↓               ↓
Export Engine ← → Lower-Level Access (Area 3)
    ↓
Format Converters (Area 4)
    ↓
Client Response
```

## Unified Command Handler

```javascript
// websocket/unified-command-handler.js
class UnifiedCommandHandler {
  // Extraction methods (Area 1)
  async exportRawHtml() {}
  async exportDomSnapshot() {}
  
  // Injection methods (Area 2)
  async injectCss() {}
  async injectJavaScript() {}
  
  // Lower-level methods (Area 3)
  async accessDomElement() {}
  async interceptRequest() {}
  
  // Export methods (Area 4)
  async exportData() {}
  async analyzeExtractions() {}
  
  // User control methods (Area 5)
  async runExtractionScript() {}
  async buildPipeline() {}
}
```

## Database/Cache Architecture

```
cache/
├── extraction-cache.js          # Cache extraction results
├── script-storage.js            # Store user scripts
├── template-storage.js          # Store templates
├── pipeline-storage.js          # Store pipelines
└── cache-manager.js             # Central cache orchestration
```

---

---

# IMPLEMENTATION ROADMAP

## Phase 1: Forensic Data Extraction (Weeks 1-3)
**Hours: 100 | Effort: High**

- Week 1: Raw HTML, DOM snapshot, metadata extraction
- Week 2: JavaScript extraction, CSS extraction
- Week 3: Network log enhancement, integration testing

**Deliverables:**
- 20 new extraction commands
- Complete test coverage (95%+)
- API documentation
- Usage examples

**Success Criteria:**
- All extractions working
- 0 data loss
- <500ms extraction time
- Pass rate 95%+

---

## Phase 2: Content Injection & Lower-Level (Weeks 4-6)
**Hours: 150 | Effort: High**

- Week 4: CSS injection, enhanced DOM modification
- Week 5: JavaScript injection, form manipulation
- Week 6: Network interception, storage access, integration

**Deliverables:**
- 25 new injection/control commands
- Integration tests
- Security documentation (clarifying unrestricted nature)
- Usage examples

**Success Criteria:**
- All modifications apply
- No data loss
- Forms fully controllable
- Network interception 100% effective

---

## Phase 3: Export & User Control (Weeks 7-9)
**Hours: 252 | Effort: Very High**

- Week 7: Format converters, basic templating
- Week 8: Batch operations, data correlation
- Week 9: Scripting engine, user API, integration

**Deliverables:**
- 25+ new export/analysis commands
- Scripting documentation
- Analysis tools
- Complete API reference

**Success Criteria:**
- All formats supported
- Batch processing 100+ pages
- Scripts execute correctly
- Analysis accurate

---

## Timeline Summary

| Phase | Duration | Hours | Start | End |
|-------|----------|-------|-------|-----|
| Phase 1 | 3 weeks | 100 | June 24 | July 15 |
| Phase 2 | 3 weeks | 150 | July 15 | August 5 |
| Phase 3 | 3 weeks | 252 | August 5 | August 26 |
| **TOTAL** | **9 weeks** | **502** | **June 24** | **August 26** |

---

---

# SUCCESS METRICS & KPIs

## Extraction Performance
- **Metric:** Average extraction time
- **Target:** <500ms per command
- **Success:** 95% of commands <500ms

- **Metric:** Data losslessness
- **Target:** 100% of data captured
- **Success:** Zero data loss across all extractions

- **Metric:** Hash consistency
- **Target:** Same extraction = same hash
- **Success:** SHA-256 hashes match 100% of time

---

## Injection Reliability
- **Metric:** Modification success rate
- **Target:** 100% of injections apply
- **Success:** All CSS/JS/DOM modifications visible

- **Metric:** Form manipulation accuracy
- **Target:** Fill any form field
- **Success:** 100% of form fields fillable

- **Metric:** Network interception effectiveness
- **Target:** Block/modify any request
- **Success:** 100% of targeted requests intercepted

---

## Export Quality
- **Metric:** Format conversion accuracy
- **Target:** Lossless conversion to all formats
- **Success:** Data identical across formats

- **Metric:** Batch processing scalability
- **Target:** Process 100+ pages
- **Success:** Can batch-process 500+ URLs

- **Metric:** Analysis accuracy
- **Target:** Correct pattern/correlation detection
- **Success:** Analysis results validated

---

## User Control & Scripting
- **Metric:** Script execution success
- **Target:** Scripts execute without errors
- **Success:** 99%+ script execution success rate

- **Metric:** API completeness
- **Target:** All features accessible via API
- **Success:** All 164+ commands callable from scripts

- **Metric:** Documentation quality
- **Target:** Every command documented
- **Success:** 100% API documentation coverage

---

---

# CONCLUSION

This comprehensive forensic feature architecture defines a complete, unrestricted data collection and manipulation platform for Basset Hound Browser. 

**Key Characteristics:**
- **Complete:** All 5 feature areas covered in detail
- **Unrestricted:** No security limitations (forensic/research tool)
- **Practical:** 502 hours, 9-week implementation timeline
- **Measurable:** Clear success criteria and KPIs

**Total Implementation Effort:**
- Development: 212 hours
- Testing: 140 hours
- Documentation: 100 hours
- **Total: 452 hours (~9 weeks, 1-2 person team)**

**Expected Outcome:**
A comprehensive forensic analysis platform with 60+ new WebSocket commands, full scripting support, multiple export formats, and advanced data correlation capabilities.

---

**Document Version:** 1.0  
**Status:** Architecture Complete  
**Next Step:** Engineering sprint planning and detailed specifications
