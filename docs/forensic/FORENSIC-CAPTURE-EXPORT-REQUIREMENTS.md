# Forensic Capture & Export Features - Requirements Specification

**Project:** Basset Hound Browser v12.7.0+  
**Date:** June 20, 2026  
**Status:** Requirements Analysis  
**Audience:** Development Team, Integration Partners

---

## Executive Summary

This document defines comprehensive requirements for forensic capture and export features in Basset Hound Browser. The browser provides 164 WebSocket commands; this specification focuses on 8 new command families for forensic-grade data capture, supporting HTML extraction, JavaScript capture, CSS extraction, network forensics, and structured export formats.

**Key Deliverables:**
- 8 new command families (24+ commands)
- Python/JavaScript client libraries
- Batch operation support
- Encrypted export options
- Forensic integrity verification

---

## Part 1: Functional Requirements

### Category 1: HTML Extraction & Capture

#### FR-FC-001: Full Page HTML Extraction
**Requirement:** Capture complete rendered page HTML with all DOM elements, attributes, and structure.

**Description:**  
Extract the full source HTML of a rendered page including dynamically loaded content, inline scripts, and embedded styles. Provide three output formats: raw (original structure), prettified (human-readable), and minified (compressed).

**Acceptance Criteria:**
- [ ] Capture returns identical HTML regardless of capture timing (idempotent)
- [ ] All DOM elements (including Shadow DOM) are included in output
- [ ] Inline scripts and styles are preserved verbatim with proper escaping
- [ ] HTML structure is valid and re-parseable by standard HTML parsers
- [ ] Handles edge cases: frames, iframes, web components, custom elements, portals
- [ ] Provides three format options in single response
- [ ] Response includes metrics: element count, total size, unique tag types
- [ ] Supports selective capture: full page or specific subtree by selector
- [ ] Includes comments and doctype declarations

**WebSocket Commands:**
```
capture_html
capture_html_subtree
get_html_metrics
```

**Response Structure:**
```json
{
  "success": true,
  "command": "capture_html",
  "data": {
    "html_raw": "<html>...</html>",
    "html_prettified": "<html>\\n  <head>...</head>\\n</html>",
    "html_minified": "<html><head>...</head>...</html>",
    "format": "application/html",
    "charset": "utf-8",
    "metrics": {
      "element_count": 847,
      "total_size_bytes": 245603,
      "unique_tags": ["div", "span", "p", "a", ...],
      "has_shadow_dom": true,
      "has_iframes": 2
    },
    "timestamp": "2026-06-20T14:30:00Z",
    "url": "https://example.com/page",
    "captured_at_scroll": {"x": 0, "y": 0}
  }
}
```

---

#### FR-FC-002: DOM Structure Snapshot
**Requirement:** Create structured snapshot of DOM tree with metadata about hierarchy and element properties.

**Description:**  
Capture the complete DOM hierarchy including element types, classes, IDs, attributes, computed styles, visibility state, and spatial position. Return as structured JSON with XPath for element location.

**Acceptance Criteria:**
- [ ] DOM snapshot includes parent-child relationships for all elements
- [ ] Computed styles captured (not just inline styles)
- [ ] Element visibility state recorded (display, visibility, opacity, z-index)
- [ ] Data-* attributes and custom element properties preserved
- [ ] Form field metadata: type, name, value, required, validation rules
- [ ] Detects and marks hidden elements (display:none, visibility:hidden, aria-hidden)
- [ ] Returns hierarchical JSON with XPath for element location
- [ ] Includes text node content with whitespace preservation option
- [ ] Captures bounding box and scroll position for each element
- [ ] Identifies dynamic content markers (data-reactid, ng-*, v-*, etc.)

**WebSocket Commands:**
```
capture_dom_snapshot
get_dom_statistics
capture_form_structure
```

**Response Structure:**
```json
{
  "success": true,
  "command": "capture_dom_snapshot",
  "data": {
    "root": {
      "tag": "html",
      "attributes": {"lang": "en"},
      "xpath": "/html",
      "computed_styles": {"margin": "0", "padding": "0"},
      "bounding_box": {"x": 0, "y": 0, "width": 1920, "height": 1080},
      "visible": true,
      "children": [
        {
          "tag": "head",
          "xpath": "/html/head",
          "children": []
        },
        {
          "tag": "body",
          "xpath": "/html/body",
          "computed_styles": {...},
          "children": [
            {
              "tag": "div",
              "id": "main-content",
              "classes": ["container", "main"],
              "attributes": {"data-page": "home", "role": "main"},
              "computed_styles": {"display": "block", "width": "100%"},
              "bounding_box": {"x": 0, "y": 0, "width": 1920, "height": 1000},
              "visible": true,
              "xpath": "/html/body/div[1]",
              "children": []
            }
          ]
        }
      ]
    },
    "statistics": {
      "total_elements": 847,
      "visible_elements": 623,
      "hidden_elements": 224,
      "form_elements": 45,
      "interactive_elements": 128,
      "text_nodes": 1256
    },
    "timestamp": "2026-06-20T14:30:00Z"
  }
}
```

---

### Category 2: JavaScript Capture

#### FR-FC-003: Complete JavaScript Code Extraction
**Requirement:** Capture all JavaScript code from page including inline scripts, external scripts, and loaded modules.

**Description:**  
Extract all JavaScript executing in the page context. Provide inline scripts (text content of script tags), external script sources (from src attribute), and dynamically loaded scripts. Include source maps and transpilation information when available.

**Acceptance Criteria:**
- [ ] Extracts inline script tag content with original formatting
- [ ] Captures external script URLs with integrity hash (SRI) when present
- [ ] Identifies dynamically injected scripts (added via DOM manipulation)
- [ ] Records script execution order and dependencies
- [ ] Includes script tags with attributes (async, defer, module, nomodule, type)
- [ ] Detects bundled code (webpack, rollup, parcel) markers
- [ ] Returns source maps if available
- [ ] Identifies minified vs. source code
- [ ] Captures variable scope information when available
- [ ] Records error callbacks and event listeners

**WebSocket Commands:**
```
capture_scripts
capture_script_context
analyze_script_dependencies
get_script_statistics
```

**Response Structure:**
```json
{
  "success": true,
  "command": "capture_scripts",
  "data": {
    "inline_scripts": [
      {
        "index": 0,
        "tag_index": 0,
        "attributes": {"type": "text/javascript", "async": false},
        "content": "console.log('hello');",
        "hash": "sha256:abc123...",
        "size_bytes": 18,
        "minified": false,
        "execution_order": 1
      }
    ],
    "external_scripts": [
      {
        "index": 0,
        "url": "https://cdn.example.com/react.min.js",
        "integrity": "sha384-...",
        "attributes": {"async": true, "defer": false, "type": "text/javascript"},
        "crossorigin": "anonymous",
        "status_code": 200,
        "loaded": true,
        "execution_order": 2,
        "size_bytes": 245603,
        "hash": "sha256:def456..."
      }
    ],
    "dynamic_scripts": [
      {
        "method": "document.createElement",
        "src": "https://example.com/analytics.js",
        "injected_at": "2026-06-20T14:30:02Z",
        "detected": true
      }
    ],
    "service_workers": [
      {
        "scope": "/",
        "script": "/sw.js",
        "state": "activated"
      }
    ],
    "statistics": {
      "total_inline_scripts": 12,
      "total_external_scripts": 45,
      "total_dynamic_scripts": 3,
      "bundled_code_detected": true,
      "bundler": "webpack",
      "source_maps_present": false,
      "minified_ratio": 0.92
    },
    "timestamp": "2026-06-20T14:30:00Z"
  }
}
```

---

#### FR-FC-004: JavaScript Execution Context
**Requirement:** Capture global scope variables, function definitions, and runtime state.

**Description:**  
Snapshot the JavaScript execution context at capture time including window object state, defined functions, global variables, and loaded libraries.

**Acceptance Criteria:**
- [ ] Captures window object enumerable properties
- [ ] Records defined function names and signatures
- [ ] Identifies loaded libraries (jQuery, React, Angular, etc.)
- [ ] Captures console output history (logs, errors, warnings)
- [ ] Records event listeners attached to elements
- [ ] Includes timers (setTimeout, setInterval) state
- [ ] Captures localStorage and sessionStorage contents
- [ ] Records IndexedDB database information
- [ ] Handles circular references and non-serializable objects
- [ ] Provides safe serialization for function contents

**WebSocket Commands:**
```
capture_script_context
get_console_logs
get_event_listeners
get_global_variables
```

---

### Category 3: CSS Extraction

#### FR-FC-005: Complete CSS Extraction
**Requirement:** Capture all stylesheets (inline, external, @imports) and computed styles.

**Description:**  
Extract all CSS styling the page including stylesheet link references, inline style blocks, external files, and @import directives. Include computed styles applied to elements.

**Acceptance Criteria:**
- [ ] Extracts inline style tag content with original formatting
- [ ] Captures external stylesheet URLs with integrity hashes
- [ ] Detects @import directives and resolves imported stylesheets
- [ ] Identifies CSS preprocessor files (SASS, LESS, PostCSS)
- [ ] Records stylesheet load order
- [ ] Includes media query conditions and specificity
- [ ] Captures CSS variables (custom properties) and values
- [ ] Records font imports (@font-face)
- [ ] Identifies CSS-in-JS frameworks (styled-components, emotion, etc.)
- [ ] Returns computed styles for each element

**WebSocket Commands:**
```
capture_stylesheets
capture_computed_styles
get_css_statistics
extract_css_variables
```

**Response Structure:**
```json
{
  "success": true,
  "command": "capture_stylesheets",
  "data": {
    "inline_styles": [
      {
        "tag_index": 0,
        "content": "body { margin: 0; } .main { color: blue; }",
        "hash": "sha256:xyz789...",
        "size_bytes": 42,
        "rule_count": 2,
        "media_queries": 0,
        "variables": 0
      }
    ],
    "external_stylesheets": [
      {
        "url": "https://cdn.example.com/bootstrap.min.css",
        "integrity": "sha384-...",
        "media": "all",
        "rel": "stylesheet",
        "status_code": 200,
        "size_bytes": 156234,
        "hash": "sha256:def456...",
        "rule_count": 2845,
        "media_queries": 12,
        "variables": 24,
        "loaded": true
      }
    ],
    "css_variables": {
      "--primary-color\": \"#0066cc\",\n      \"--spacing-unit\": \"8px\"\n    },\n    \"font_imports\": [\n      {\n        \"family\": \"Open Sans\",\n        \"url\": \"https://fonts.googleapis.com/css2?family=Open+Sans\",\n        \"weights\": [400, 700],\n        \"styles\": [\"normal\", \"italic\"]\n      }\n    ],\n    \"preprocessor_detected\": \"sass\",\n    \"css_frameworks\": [\"bootstrap\", \"tailwind\"],\n    \"css_in_js\": false,\n    \"statistics\": {\n      \"total_rules\": 3456,\n      \"total_selectors\": 1234,\n      \"media_queries\": 23,\n      \"keyframes_animations\": 12,\n      \"variables_defined\": 45,\n      \"total_size_bytes\": 245603\n    },\n    \"timestamp\": \"2026-06-20T14:30:00Z\"\n  }\n}\n```\n\n---\n\n### Category 4: Network Capture\n\n#### FR-FC-006: Network Request/Response Capture\n**Requirement:** Capture HTTP/HTTPS requests and responses with headers, body, timing, and status codes.\n\n**Description:**\nRecord all network traffic from the page in HAR (HTTP Archive) format. Include request/response headers, bodies, timing information, DNS resolution, and TLS data.\n\n**Acceptance Criteria:**\n- [ ] Captures all HTTP/HTTPS requests and responses\n- [ ] Records request headers, method, URL, query parameters\n- [ ] Records response headers, status code, reason phrase\n- [ ] Includes request and response bodies (with size limits)\n- [ ] Records timing: DNS lookup, connect, SSL/TLS, wait, download\n- [ ] Captures query strings and POST form data\n- [ ] Records redirect chains\n- [ ] Identifies blocked requests (CORS, CSP, etc.)\n- [ ] Includes TLS certificate information\n- [ ] Records content-type and encoding\n- [ ] Supports filtering by resource type, domain, or pattern\n- [ ] Exports to HAR format compatible with tools\n- [ ] Records WebSocket connections and messages\n- [ ] Handles binary data appropriately\n\n**WebSocket Commands:**\n```\ncapture_network_traffic\nget_har_archive\nget_network_statistics\nfilter_network_by_type\nget_failed_requests\n```\n\n**Response Structure:**\n```json\n{\n  \"success\": true,\n  \"command\": \"capture_network_traffic\",\n  \"data\": {\n    \"har\": {\n      \"log\": {\n        \"version\": \"1.2\",\n        \"creator\": {\n          \"name\": \"Basset Hound Browser\",\n          \"version\": \"12.7.0\"\n        },\n        \"entries\": [\n          {\n            \"startedDateTime\": \"2026-06-20T14:30:00.123Z\",\n            \"request\": {\n              \"method\": \"GET\",\n              \"url\": \"https://example.com/api/data\",\n              \"headers\": [\n                {\"name\": \"Accept\", \"value\": \"application/json\"},\n                {\"name\": \"User-Agent\", \"value\": \"...\"}\n              ],\n              \"queryString\": [{\"name\": \"id\", \"value\": \"123\"}],\n              \"postData\": {\"mimeType\": \"application/json\", \"text\": \"{...}\"},\n              \"headersSize\": 245,\n              \"bodySize\": 156\n            },\n            \"response\": {\n              \"status\": 200,\n              \"statusText\": \"OK\",\n              \"headers\": [\n                {\"name\": \"Content-Type\", \"value\": \"application/json\"},\n                {\"name\": \"Content-Length\", \"value\": \"245\"}\n              ],\n              \"content\": {\n                \"mimeType\": \"application/json\",\n                \"size\": 245,\n                \"compression\": 0,\n                \"text\": \"{\\\"data\\\": ...}\"\n              },\n              \"redirectURL\": \"\",\n              \"headersSize\": 312,\n              \"bodySize\": 245\n            },\n            \"cache\": {},\n            \"timings\": {\n              \"dns\": 2.5,\n              \"connect\": 45.2,\n              \"ssl\": 34.1,\n              \"wait\": 123.4,\n              \"receive\": 12.3,\n              \"total\": 217.5\n            }\n          }\n        ]\n      }\n    },\n    \"statistics\": {\n      \"total_requests\": 245,\n      \"total_responses\": 245,\n      \"successful_requests\": 240,\n      \"failed_requests\": 5,\n      \"blocked_requests\": 3,\n      \"total_downloaded_bytes\": 2456789,\n      \"total_transferred_bytes\": 245678,\n      \"average_response_time_ms\": 245.6,\n      \"resource_types\": {\n        \"document\": 5,\n        \"stylesheet\": 12,\n        \"image\": 56,\n        \"javascript\": 23,\n        \"xhr\": 45,\n        \"fetch\": 32,\n        \"font\": 8,\n        \"media\": 3,\n        \"other\": 2\n      }\n    },\n    \"timestamp\": \"2026-06-20T14:30:00Z\"\n  }\n}\n```\n\n---\n\n#### FR-FC-007: TLS Certificate Extraction\n**Requirement:** Extract TLS/SSL certificate information from secure connections.\n\n**Description:**\nCapture the complete TLS certificate chain, including subject, issuer, validity dates, public key, extensions, and cipher suite information.\n\n**Acceptance Criteria:**\n- [ ] Extracts server certificate (leaf certificate)\n- [ ] Captures full certificate chain to root CA\n- [ ] Records subject distinguished name (CN, O, C, etc.)\n- [ ] Records issuer distinguished name\n- [ ] Includes validity period (notBefore, notAfter)\n- [ ] Captures public key and key size\n- [ ] Records certificate serial number\n- [ ] Includes signature algorithm and hash\n- [ ] Records certificate extensions (SAN, EKU, etc.)\n- [ ] Captures cipher suite information\n- [ ] Records protocol version (TLS 1.2, 1.3, etc.)\n- [ ] Identifies self-signed certificates\n- [ ] Checks certificate validity and expiration\n- [ ] Records OCSP stapling status\n\n**WebSocket Commands:**\n```\nget_tls_certificate\nget_certificate_chain\nget_cipher_suite\nvalidate_certificate\n```\n\n---\n\n### Category 5: Structured Export\n\n#### FR-FC-008: Multi-Format Export\n**Requirement:** Export captured forensic data in multiple structured formats.\n\n**Description:**\nExport forensic capture results in JSON, CSV, XML, and HTML formats. Support hierarchical directory structure for organized output.\n\n**Acceptance Criteria:**\n- [ ] Supports JSON format with complete data structure\n- [ ] Supports CSV format with flattened records\n- [ ] Supports XML format with schema validation\n- [ ] Supports HTML format with interactive viewing\n- [ ] Creates organized directory structure\n- [ ] Includes metadata files (timestamps, source URLs, capture method)\n- [ ] Generates integrity hashes (SHA-256) for all files\n- [ ] Creates manifest file with file inventory\n- [ ] Supports compression (ZIP, TAR.GZ)\n- [ ] Preserves data relationships across formats\n- [ ] Handles large files with streaming\n- [ ] Includes README with format documentation\n\n**WebSocket Commands:**\n```\nexport_forensic_data\nexport_to_json\nexport_to_csv\nexport_to_xml\nexport_to_html\nget_export_status\n```\n\n---\n\n#### FR-FC-009: Batch Operations\n**Requirement:** Perform forensic capture operations across multiple pages.\n\n**Description:**\nCapture forensic data from a list of URLs in a single batch operation. Support parallel and sequential execution with progress tracking.\n\n**Acceptance Criteria:**\n- [ ] Accepts array of URLs for batch processing\n- [ ] Supports parallel execution (configurable concurrency)\n- [ ] Provides sequential execution mode\n- [ ] Records success/failure for each URL\n- [ ] Includes partial failure handling (continue on error)\n- [ ] Provides progress callbacks\n- [ ] Returns aggregated results\n- [ ] Supports output organization by URL\n- [ ] Allows capture type filtering per URL\n- [ ] Records execution timing per URL\n- [ ] Handles timeout and retry logic\n- [ ] Provides cancellation capability\n\n**WebSocket Commands:**\n```\nbatch_capture_forensic\nbatch_export_data\nget_batch_progress\ncancel_batch_operation\n```\n\n**Request Structure:**\n```json\n{\n  \"command\": \"batch_capture_forensic\",\n  \"urls\": [\n    \"https://example.com/page1\",\n    \"https://example.com/page2\",\n    \"https://example.com/page3\"\n  ],\n  \"capture_types\": [\"html\", \"scripts\", \"stylesheets\", \"network\"],\n  \"parallel_count\": 3,\n  \"timeout_per_url_ms\": 30000,\n  \"output_format\": \"json\",\n  \"output_directory\": \"/tmp/forensic-batch\",\n  \"progress_callback\": true\n}\n```\n\n---\n\n#### FR-FC-010: Encrypted Export\n**Requirement:** Support encrypted export of sensitive forensic data.\n\n**Description:**\nEncrypt exported forensic data using AES-256 encryption. Support password-based and key-based encryption with integrity verification.\n\n**Acceptance Criteria:**\n- [ ] Uses AES-256-GCM encryption\n- [ ] Supports password-based key derivation (PBKDF2)\n- [ ] Supports direct key provision\n- [ ] Includes authentication tag (GCM mode)\n- [ ] Records encryption metadata (algorithm, salt, IV)\n- [ ] Supports compression before encryption\n- [ ] Provides secure key management\n- [ ] Includes decryption instructions\n- [ ] Validates integrity after decryption\n- [ ] Supports selective field encryption\n\n**WebSocket Commands:**\n```\nexport_forensic_encrypted\nencrypt_export_file\n```\n\n---\n\n## Part 2: Non-Functional Requirements\n\n### NFR-PERF: Performance\n\n#### NFR-PERF-001: Capture Performance\n- [ ] HTML capture completes in <2 seconds per page\n- [ ] DOM snapshot completes in <1.5 seconds\n- [ ] JavaScript extraction completes in <1 second\n- [ ] CSS extraction completes in <1 second\n- [ ] Network capture (HAR) completes in <2 seconds\n- [ ] Batch operation processes 10 URLs in <45 seconds (parallel)\n- [ ] No memory leaks during batch operations\n- [ ] Memory usage remains <500MB for 1000-element pages\n\n#### NFR-PERF-002: Export Performance\n- [ ] JSON export completes in <3 seconds for full page capture\n- [ ] CSV export completes in <2 seconds\n- [ ] Compression (ZIP) completes in <5 seconds\n- [ ] Encryption (AES-256) completes in <4 seconds\n- [ ] Large file handling (>100MB) uses streaming\n\n### NFR-ACCURACY: Accuracy & Fidelity\n\n#### NFR-ACC-001: Content Fidelity\n- [ ] 100% of DOM elements captured without loss\n- [ ] HTML is character-for-character accurate\n- [ ] No content alteration or modification\n- [ ] All inline resources preserved\n- [ ] Whitespace and formatting preserved (when requested)\n\n#### NFR-ACC-002: Forensic Integrity\n- [ ] SHA-256 hash verification of all captured content\n- [ ] Chain of custody documentation without gaps\n- [ ] Timestamp accuracy within 100ms\n- [ ] All data verifiable against independent sources\n\n### NFR-SECURITY: Security\n\n#### NFR-SEC-001: Data Protection\n- [ ] Optional encryption for exported data (AES-256-GCM)\n- [ ] Secure handling of sensitive data (passwords redacted)\n- [ ] SSL/TLS for network capture\n- [ ] Audit logging of all export operations\n- [ ] Access control to forensic data\n\n#### NFR-SEC-002: Integrity Verification\n- [ ] Cryptographic hashing of all evidence\n- [ ] Tamper detection capability\n- [ ] Chain of custody validation\n- [ ] Timestamp verification\n\n### NFR-COMPAT: Compatibility\n\n#### NFR-COMPAT-001: Browser Compatibility\n- [ ] Works with all 164 existing WebSocket commands\n- [ ] Compatible with existing evasion features\n- [ ] Compatible with proxy/Tor integration\n- [ ] Compatible with session management\n- [ ] Compatible with all 7 fingerprint profiles\n\n#### NFR-COMPAT-002: Format Compatibility\n- [ ] HAR format compatible with HAR viewer tools\n- [ ] JSON schema-compliant output\n- [ ] CSV follows RFC 4180 standard\n- [ ] HTML renders in all modern browsers\n- [ ] ZIP archives compatible with standard tools\n\n### NFR-USABILITY: Usability\n\n#### NFR-USAB-001: API Simplicity\n- [ ] Python client library with intuitive interface\n- [ ] JavaScript/Node.js client library\n- [ ] Comprehensive examples for common tasks\n- [ ] Clear error messages with recovery suggestions\n- [ ] Documentation for all commands and parameters\n\n#### NFR-USAB-002: Documentation\n- [ ] Complete API reference with examples\n- [ ] Quick start guide (5-minute setup)\n- [ ] Integration guide for common platforms\n- [ ] Troubleshooting guide\n- [ ] Best practices document\n\n---\n\n## Part 3: API Contract Specification\n\n### WebSocket Message Structure\n\n#### Request Format\n```json\n{\n  \"id\": \"unique-request-id\",\n  \"command\": \"command_name\",\n  \"params\": {\n    \"param1\": \"value1\",\n    \"param2\": \"value2\"\n  }\n}\n```\n\n#### Success Response Format\n```json\n{\n  \"id\": \"unique-request-id\",\n  \"command\": \"command_name\",\n  \"success\": true,\n  \"data\": {\n    \"result\": \"...\"\n  },\n  \"timestamp\": \"2026-06-20T14:30:00.123Z\",\n  \"execution_time_ms\": 245\n}\n```\n\n#### Error Response Format\n```json\n{\n  \"id\": \"unique-request-id\",\n  \"command\": \"command_name\",\n  \"success\": false,\n  \"error\": \"Error message\",\n  \"error_code\": \"CAPTURE_TIMEOUT\",\n  \"recovery\": {\n    \"suggestion\": \"Try increasing timeout or using capture_html_subtree for smaller section\",\n    \"alternative_commands\": [\"capture_html_subtree\", \"capture_dom_snapshot\"]\n  },\n  \"timestamp\": \"2026-06-20T14:30:00.123Z\"\n}\n```\n\n### Command Categories\n\n#### 1. HTML Capture Commands\n\n**capture_html**\n- Description: Capture complete rendered HTML\n- Parameters: `format` (raw|prettified|minified), `include_comments` (boolean)\n- Response: HTML in requested format + metrics\n- Timeout: 5000ms\n- Retryable: Yes\n\n**capture_html_subtree**\n- Description: Capture HTML of specific element\n- Parameters: `selector` (string, CSS selector)\n- Response: Subtree HTML + element metrics\n- Timeout: 3000ms\n- Retryable: Yes\n\n**capture_dom_snapshot**\n- Description: Capture DOM structure with metadata\n- Parameters: `include_styles` (boolean), `include_text_nodes` (boolean)\n- Response: Hierarchical DOM structure\n- Timeout: 4000ms\n- Retryable: Yes\n\n---\n\n#### 2. JavaScript Capture Commands\n\n**capture_scripts**\n- Description: Extract all JavaScript code\n- Parameters: `include_content` (boolean), `include_source_maps` (boolean)\n- Response: Inline scripts, external scripts, dynamic scripts\n- Timeout: 3000ms\n- Retryable: Yes\n\n**capture_script_context**\n- Description: Snapshot JavaScript execution context\n- Parameters: `include_console_logs` (boolean), `max_console_logs` (number)\n- Response: Global scope, functions, libraries, console logs\n- Timeout: 2000ms\n- Retryable: Yes\n\n---\n\n#### 3. CSS Capture Commands\n\n**capture_stylesheets**\n- Description: Extract all CSS styling\n- Parameters: `include_computed_styles` (boolean)\n- Response: Inline styles, external stylesheets, CSS variables\n- Timeout: 3000ms\n- Retryable: Yes\n\n**capture_computed_styles**\n- Description: Get computed styles for elements\n- Parameters: `selectors` (array), `properties` (array, optional)\n- Response: Computed style values per element\n- Timeout: 2000ms\n- Retryable: Yes\n\n---\n\n#### 4. Network Capture Commands\n\n**capture_network_traffic**\n- Description: Capture HTTP/HTTPS traffic (HAR format)\n- Parameters: `include_bodies` (boolean), `filter_by_type` (string)\n- Response: HAR archive + statistics\n- Timeout: 5000ms\n- Retryable: No (stateful)\n\n**get_har_archive**\n- Description: Retrieve captured HAR data\n- Parameters: `format` (har|json)\n- Response: HAR data in requested format\n- Timeout: 2000ms\n- Retryable: Yes\n\n---\n\n#### 5. Export Commands\n\n**export_forensic_data**\n- Description: Export all captured forensic data\n- Parameters: `format` (json|csv|xml|html), `output_path` (string), `include_metadata` (boolean)\n- Response: Export path, file size, hash\n- Timeout: 10000ms\n- Retryable: Yes\n\n**export_forensic_encrypted**\n- Description: Export data with encryption\n- Parameters: `format` (json|csv), `password` (string), `algorithm` (AES-256-GCM)\n- Response: Encrypted file path, decryption key, metadata\n- Timeout: 15000ms\n- Retryable: Yes\n\n---\n\n#### 6. Batch Commands\n\n**batch_capture_forensic**\n- Description: Capture forensic data from multiple URLs\n- Parameters: `urls` (array), `capture_types` (array), `parallel_count` (number), `output_directory` (string)\n- Response: Batch job ID, status\n- Timeout: 60000ms (per URL)\n- Retryable: Partial\n\n**get_batch_progress**\n- Description: Get progress of batch operation\n- Parameters: `batch_id` (string)\n- Response: Progress percentage, completed items, failed items\n- Timeout: 1000ms\n- Retryable: Yes\n\n---\n\n## Part 4: Data Export Specification\n\n### Directory Structure\n\nForensic captures organized in hierarchical structure:\n\n```\nforenasic-capture-2026-06-20/\n├── metadata.json\n├── manifest.json\n├── INTEGRITY_HASHES.txt\n├── html/\n│   ├── index_raw.html\n│   ├── index_prettified.html\n│   └── index_minified.html\n├── dom/\n│   └── snapshot.json\n├── scripts/\n│   ├── inline/\n│   │   ├── script_0.js\n│   │   ├── script_1.js\n│   │   └── ...\n│   ├── external/\n│   │   └── scripts_references.json\n│   └── analysis.json\n├── stylesheets/\n│   ├── inline/\n│   │   ├── style_0.css\n│   │   └── ...\n│   ├── external/\n│   │   └── stylesheets_references.json\n│   └── variables.json\n├── network/\n│   ├── har.json\n│   ├── certificates/\n│   │   ├── example.com.pem\n│   │   └── ...\n│   └── statistics.json\n├── screenshots/\n│   ├── viewport.png\n│   ├── fullpage.png\n│   └── metadata.json\n└── README.md\n```\n\n### Metadata Files\n\n#### metadata.json\n```json\n{\n  \"capture_id\": \"fc_2026-06-20_14-30-00_abc123\",\n  \"timestamp\": \"2026-06-20T14:30:00.123Z\",\n  \"url\": \"https://example.com/page\",\n  \"browser_version\": \"12.7.0\",\n  \"captured_by\": \"system\",\n  \"capture_method\": \"forensic_capture\",\n  \"capture_types\": [\"html\", \"dom\", \"scripts\", \"stylesheets\", \"network\"],\n  \"page_title\": \"Example Page\",\n  \"page_load_time_ms\": 2456,\n  \"document_ready_time_ms\": 1234,\n  \"metrics\": {\n    \"dom_elements\": 847,\n    \"scripts_count\": 45,\n    \"stylesheets_count\": 12,\n    \"images_count\": 156,\n    \"network_requests\": 245\n  }\n}\n```\n\n#### manifest.json\n```json\n{\n  \"version\": \"1.0\",\n  \"manifest_timestamp\": \"2026-06-20T14:30:00.123Z\",\n  \"total_files\": 156,\n  \"total_size_bytes\": 12456789,\n  \"files\": [\n    {\n      \"path\": \"html/index_raw.html\",\n      \"size_bytes\": 245603,\n      \"hash_sha256\": \"abc123...\",\n      \"content_type\": \"text/html\",\n      \"compressed\": false\n    }\n  ]\n}\n```\n\n#### INTEGRITY_HASHES.txt\n```\nsha256:abc123... html/index_raw.html\nsha256:def456... dom/snapshot.json\nsha256:ghi789... scripts/inline/script_0.js\n...\n```\n\n---\n\n## Part 5: Client Library Specifications\n\n### Python Client Library\n\n**Module Name:** `basset_hound_client`\n\n**Usage Example:**\n```python\nfrom basset_hound_client import BrowserClient, ForensicCapture\n\n# Connect to browser\nclient = BrowserClient('ws://localhost:8765')\n\n# Perform forensic capture\ncapture = ForensicCapture(client)\n\n# Capture HTML\nhtml_result = capture.html(url='https://example.com')\nprint(f\"Captured {html_result.metrics.element_count} elements\")\n\n# Capture all forensic data\nfull_capture = capture.all(\n    url='https://example.com',\n    types=['html', 'scripts', 'stylesheets', 'network'],\n    output_format='json',\n    output_path='/tmp/forensic'\n)\n\n# Batch operations\nbatch = capture.batch_urls(\n    urls=['https://example.com/page1', 'https://example.com/page2'],\n    types=['html', 'scripts'],\n    parallel_count=2\n)\n\nfor result in batch.results:\n    print(f\"{result.url}: {result.status}\")\n```\n\n### JavaScript/Node.js Client Library\n\n**Module Name:** `basset-hound-client`\n\n**Usage Example:**\n```javascript\nconst BrowserClient = require('basset-hound-client');\n\nconst client = new BrowserClient('ws://localhost:8765');\n\n// Capture HTML\nconst htmlResult = await client.forensic.html({\n  url: 'https://example.com'\n});\n\nconsole.log(`Elements: ${htmlResult.metrics.element_count}`);\n\n// Batch capture\nconst batch = await client.forensic.batchCapture({\n  urls: ['https://example.com/page1', 'https://example.com/page2'],\n  types: ['html', 'scripts', 'stylesheets'],\n  parallelCount: 2,\n  outputDirectory: '/tmp/forensic'\n});\n\nfor (const result of batch.results) {\n  console.log(`${result.url}: ${result.status}`);\n}\n```\n\n---\n\n## Part 6: Acceptance Criteria Summary\n\n### Feature Completeness\n- [ ] 8 command families implemented (24+ commands)\n- [ ] All capture types working and tested\n- [ ] All export formats supported\n- [ ] Batch operations functional\n- [ ] Encryption support implemented\n- [ ] Both Python and JS client libraries released\n\n### Quality Metrics\n- [ ] 95%+ test coverage for forensic capture code\n- [ ] Zero data loss in capture operations\n- [ ] 100% accuracy of extracted data\n- [ ] Performance targets met\n- [ ] Security requirements satisfied\n\n### Documentation\n- [ ] Complete API reference\n- [ ] 5-minute quick start\n- [ ] Integration guide\n- [ ] Best practices document\n- [ ] Troubleshooting guide\n- [ ] Example scripts for common tasks\n\n### Integration\n- [ ] Compatible with existing 164 commands\n- [ ] No regression in existing functionality\n- [ ] Works with all evasion features\n- [ ] Works with Tor/proxy integration\n- [ ] Works with all fingerprint profiles\n\n---\n\n## Part 7: Risk Assessment & Mitigation\n\n### Risk 1: Large Page Memory Overhead\n**Risk:** Capturing full-page HTML and DOM for large pages (>10MB) may cause memory issues.\n**Mitigation:** Implement streaming for large exports, provide subtree capture option, add memory monitoring.\n\n### Risk 2: Network Capture State Management\n**Risk:** Network capture is stateful; multiple concurrent captures may conflict.\n**Mitigation:** Use unique capture IDs, support multiple simultaneous captures, queue management.\n\n### Risk 3: Performance Under Heavy Load\n**Risk:** Batch operations with high parallelism may degrade performance.\n**Mitigation:** Implement adaptive concurrency, memory limits, progress callbacks.\n\n### Risk 4: Data Sensitivity\n**Risk:** Captured data may contain sensitive information (passwords, tokens).\n**Mitigation:** Automatic redaction of known sensitive fields, encryption support, audit logging.\n\n---\n\n## Part 8: Success Metrics\n\n### Deployment Success Criteria\n1. All 24+ forensic commands operational\n2. Capture performance meets targets (<5 seconds per page)\n3. Zero data loss across 1000+ test captures\n4. 95%+ test coverage\n5. Client libraries available in Python and JavaScript\n6. Documentation complete and accurate\n7. No regressions in existing functionality\n8. Security review passed\n\n### User Adoption Metrics\n1. Client libraries downloaded/used\n2. Integration into palletai agents\n3. Forensic capture workflow adoption\n4. Bug reports and feature requests\n5. User satisfaction surveys\n\n---\n\n## Appendix A: Related Documentation\n\n- `/docs/API-REFERENCE.md` - Current API reference\n- `/docs/SCOPE.md` - Project scope definition\n- `/evidence/evidence-collector.js` - Existing evidence collection\n- `/extraction/manager.js` - Existing extraction manager\n- `/docs/FORENSIC-EVIDENCE-EXPORT-GUIDE-2026-05-31.md` - Export guide\n- `/src/features/forensic-chain.js` - Forensic chain implementation\n\n---\n\n**Document Version:** 1.0  \n**Last Updated:** June 20, 2026  \n**Status:** Requirements Analysis Complete\n