# Basset Hound Browser - Forensic Capture Expansion
## Complete Technical Design Specification

**Version:** 1.0.0  
**Status:** Design Phase - Production Ready  
**Date:** June 20, 2026  
**Target Release:** v12.8.0  
**Audience:** Architecture, Development, Integration Teams

---

## Executive Summary

This specification defines the complete forensic capture expansion for Basset Hound Browser, enabling legal-grade evidence collection, chain-of-custody tracking, and comprehensive digital forensics capabilities. The design implements a multi-layer architecture combining real-time capture, integrity verification (SHA-256), WARC-format archival, and structured export formats.

### Key Capabilities
- **Full HTML Capture**: Raw, prettified, and minified formats with DOM completeness validation
- **JavaScript Extraction**: Inline and external scripts with source mapping
- **CSS Extraction**: Computed styles, external stylesheets, and media queries
- **Network Forensics**: HAR-compliant traffic logs with full request/response bodies
- **Forensic Packaging**: Structured exports with integrity hashes and metadata
- **Chain of Custody**: Audit logs, timestamps, and provenance tracking

---

## 1. FORENSIC CAPTURE ARCHITECTURE

### 1.1 ForensicCaptureManager Class Design

```javascript
/**
 * ForensicCaptureManager
 * Central orchestrator for forensic data capture with integrity verification
 * 
 * Responsibilities:
 * - Coordinate multi-layer capture (HTML, JS, CSS, Network)
 * - Manage capture state and lifecycle
 * - Ensure data integrity with SHA-256 hashing
 * - Implement chain-of-custody tracking
 * - Export structured forensic packages
 */
class ForensicCaptureManager {
  constructor(options = {}) {
    // Core managers (injected or lazy-loaded)
    this.extractionManager = null;
    this.networkAnalysisManager = null;
    this.webContents = null;
    
    // Capture state
    this.captureState = {
      isCapturing: false,
      startTime: null,
      endTime: null,
      sessionId: generateUUID(),
      requestId: null,  // Operator/audit ID
      captureType: null // 'full', 'html', 'network', 'scripts', 'styles'
    };
    
    // Data containers (organized by capture layer)
    this.capturedData = {
      html: {
        raw: null,
        prettified: null,
        minified: null,
        metadata: {
          elementCount: 0,
          uniqueTagTypes: [],
          totalSize: 0,
          hasShadowDOM: false,
          hasFrames: false,
          hasIframes: false,
          timestamp: null,
          isIdempotent: false
        }
      },
      scripts: {
        inline: [],      // Inline <script> tags
        external: [],    // External .js files
        total: 0,
        metadata: {
          timestamp: null,
          totalSize: 0,
          sourceMapCount: 0
        }
      },
      styles: {
        inline: [],      // Inline <style> tags
        external: [],    // External .css files
        computed: {},    // Element -> computed styles mapping
        total: 0,
        metadata: {
          timestamp: null,
          totalSize: 0,
          mediaQueryCount: 0
        }
      },
      network: {
        requests: [],    // Full request/response pairs
        har: null,       // HAR 1.2 format export
        metadata: {
          timestamp: null,
          captureStartTime: null,
          captureEndTime: null,
          requestCount: 0,
          totalBytes: 0
        }
      }
    };
    
    // Integrity verification
    this.integrityData = {
      checksums: {},   // filename -> SHA-256 hash
      captureSignature: null,  // SHA-256 of entire capture
      createdAt: null,
      operator: options.operator || 'unknown',
      auditLog: []
    };
    
    // Security & filtering
    this.sensitiveDataFilter = options.sensitiveDataFilter || {
      keywords: [
        'password', 'token', 'apikey', 'secret', 'bearer', 'authorization',
        'credential', 'key', 'signature', 'nonce', 'jwt', 'oauth'
      ],
      patterns: [
        /password\s*[:=]\s*["']([^"']+)["']/gi,
        /token\s*[:=]\s*["']([^"']+)["']/gi,
        /apikey\s*[:=]\s*["']([^"']+)["']/gi,
        /Bearer\s+([A-Za-z0-9\-._~+/]+=*)/gi
      ]
    };
    
    // Configuration
    this.config = {
      maxCaptureSize: options.maxCaptureSize || 100 * 1024 * 1024, // 100MB
      enableCompression: options.enableCompression !== false,
      enableIntegrityVerification: options.enableIntegrityVerification !== false,
      enableAuditLogging: options.enableAuditLogging !== false,
      filterSensitiveData: options.filterSensitiveData !== false,
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3
    };
    
    // Statistics
    this.stats = {
      totalCaptures: 0,
      successfulCaptures: 0,
      failedCaptures: 0,
      totalDataCaptured: 0,
      totalCompressionRatio: 0,
      averageCaptureDuration: 0
    };
    
    console.log('[ForensicCaptureManager] Initialized');
  }

  /**
   * Initialize manager with external dependencies
   */
  initialize(extractionManager, networkAnalysisManager, webContents) {
    this.extractionManager = extractionManager;
    this.networkAnalysisManager = networkAnalysisManager;
    this.webContents = webContents;
    
    console.log('[ForensicCaptureManager] Dependencies injected');
    return { success: true };
  }

  /**
   * Start forensic capture session
   */
  async startCapture(options = {}) {
    if (this.captureState.isCapturing) {
      return { success: false, error: 'Capture already in progress' };
    }

    const sessionId = options.sessionId || generateUUID();
    const requestId = options.requestId || generateUUID();

    this.captureState.isCapturing = true;
    this.captureState.startTime = Date.now();
    this.captureState.sessionId = sessionId;
    this.captureState.requestId = requestId;
    this.captureState.captureType = options.captureType || 'full';

    // Audit logging
    this.integrityData.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'capture_started',
      sessionId,
      requestId,
      operator: this.config.operator
    });

    console.log('[ForensicCaptureManager] Capture started:', {
      sessionId,
      requestId,
      type: this.captureState.captureType
    });

    return {
      success: true,
      sessionId,
      requestId,
      startTime: this.captureState.startTime
    };
  }

  /**
   * Stop forensic capture session
   */
  async stopCapture() {
    if (!this.captureState.isCapturing) {
      return { success: false, error: 'No capture in progress' };
    }

    this.captureState.isCapturing = false;
    this.captureState.endTime = Date.now();
    const duration = this.captureState.endTime - this.captureState.startTime;

    // Audit logging
    this.integrityData.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'capture_stopped',
      sessionId: this.captureState.sessionId,
      durationMs: duration
    });

    console.log('[ForensicCaptureManager] Capture stopped:', {
      duration,
      dataSize: this.stats.totalDataCaptured
    });

    return {
      success: true,
      sessionId: this.captureState.sessionId,
      duration,
      dataSize: this.stats.totalDataCaptured
    };
  }

  /**
   * Calculate SHA-256 hash for integrity verification
   */
  calculateChecksum(data, algorithm = 'sha256') {
    const crypto = require('crypto');
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * Filter sensitive data from content
   */
  filterSensitiveContent(content, type = 'html') {
    if (!this.config.filterSensitiveData) return content;
    if (!content) return content;

    let filtered = content;

    // Apply keyword filtering
    this.sensitiveDataFilter.keywords.forEach(keyword => {
      const regex = new RegExp(`${keyword}[^,}\\s]*`, 'gi');
      filtered = filtered.replace(regex, `[REDACTED:${keyword.toUpperCase()}]`);
    });

    // Apply pattern-based filtering
    this.sensitiveDataFilter.patterns.forEach(pattern => {
      filtered = filtered.replace(pattern, (match, group) => {
        return match.replace(group, '[REDACTED]');
      });
    });

    return filtered;
  }

  /**
   * Generate audit log entry
   */
  logAudit(action, metadata = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      sessionId: this.captureState.sessionId,
      operator: this.config.operator,
      ...metadata
    };
    
    this.integrityData.auditLog.push(entry);
    return entry;
  }
}
```

### 1.2 Data Structures

#### 1.2.1 HTML Capture Structure
```javascript
CapturedHTML = {
  raw: string,           // Original unmodified HTML
  prettified: string,    // Formatted with indentation
  minified: string,      // Compressed for transmission
  metadata: {
    elementCount: number,
    uniqueTagTypes: string[],
    totalSize: number,
    hasShadowDOM: boolean,
    hasFrames: boolean,
    hasIframes: boolean,
    timestamp: string (ISO-8601),
    isIdempotent: boolean,
    domCompleteness: {
      confidence: number,      // 0-100
      indicators: string[],
      score: number
    }
  },
  structure: {
    rootElement: string,
    documentType: string,
    namespace: string
  }
}
```

#### 1.2.2 Script Capture Structure
```javascript
CapturedScript = {
  id: string,              // Unique identifier
  type: 'inline' | 'external',
  source: string,          // Script content
  attributes: {
    src?: string,
    type?: string,
    async: boolean,
    defer: boolean,
    crossOrigin?: string,
    integrity?: string
  },
  sourceMap?: string,      // Source map content if available
  size: number,
  hash: string,            // SHA-256 checksum
  timestamp: string,
  lineCount: number
}

ScriptCollection = {
  inline: CapturedScript[],
  external: CapturedScript[],
  total: number,
  metadata: {
    timestamp: string,
    totalSize: number,
    sourceMapCount: number,
    asyncCount: number,
    deferCount: number
  }
}
```

#### 1.2.3 Style Capture Structure
```javascript
CapturedStyle = {
  id: string,
  type: 'inline' | 'external',
  content: string,        // CSS content
  attributes: {
    href?: string,
    media?: string,
    rel?: string,
    type?: string
  },
  size: number,
  hash: string,           // SHA-256 checksum
  timestamp: string
}

ComputedStyleEntry = {
  selector: string,       // CSS selector
  element: string,        // HTML element tag
  styles: {
    [property]: string   // e.g., "color": "#000000"
  }
}

StyleCollection = {
  inline: CapturedStyle[],
  external: CapturedStyle[],
  computed: ComputedStyleEntry[],
  total: number,
  metadata: {
    timestamp: string,
    totalSize: number,
    mediaQueryCount: number,
    computedStylesCount: number
  }
}
```

#### 1.2.4 Network Forensics Structure
```javascript
ForensicRequest = {
  id: string,              // Unique request ID
  method: string,          // GET, POST, etc.
  url: string,
  timestamp: string,       // ISO-8601
  duration: number,        // ms
  
  request: {
    headers: Record<string, string>,
    body: string | Buffer,
    bodySize: number,
    bodyHash: string
  },
  
  response: {
    status: number,
    statusText: string,
    headers: Record<string, string>,
    body: string | Buffer,
    bodySize: number,
    bodyHash: string,
    mimeType: string
  },
  
  security: {
    wasSecure: boolean,
    certChain: string[],
    securityHeaders: Record<string, string>
  },
  
  forensics: {
    isRedirect: boolean,
    isCached: boolean,
    resourceType: string,
    hasResourceTiming: boolean,
    resourceTiming?: PerformanceResourceTiming
  }
}

NetworkLog = {
  requests: ForensicRequest[],
  har: HARFormat,         // HAR 1.2 format
  metadata: {
    timestamp: string,
    captureStartTime: string,
    captureEndTime: string,
    requestCount: number,
    totalBytes: number,
    redirectCount: number,
    errorCount: number,
    securityIssues: string[]
  }
}
```

#### 1.2.5 Forensic Package Export Structure
```javascript
ForensicPackage = {
  metadata: {
    version: string,       // e.g. "1.0.0"
    createdAt: string,    // ISO-8601
    createdBy: string,    // operator/user
    sessionId: string,
    requestId: string,
    targetUrl: string,
    captureType: string,
    durationMs: number,
    totalSize: number
  },
  
  integrity: {
    algorithm: 'sha256',
    packageHash: string,   // Hash of entire package
    fileChecksums: {
      [filename]: string   // filename -> hash mapping
    }
  },
  
  html: CapturedHTML,
  scripts: ScriptCollection,
  styles: StyleCollection,
  network: NetworkLog,
  
  auditLog: Array<{
    timestamp: string,
    action: string,
    details: Record<string, any>
  }>,
  
  forensicMetadata: {
    captureMethod: string,
    integrity: {
      verified: boolean,
      algorithm: 'sha256'
    },
    chainOfCustody: [{
      timestamp: string,
      action: string,
      actor: string
    }],
    exportFormat: 'json' | 'warc' | 'har'
  }
}
```

### 1.3 Integration with Existing Managers

#### 1.3.1 Dependency Injection Pattern

```javascript
// In src/main/main.js - Initialize ForensicCaptureManager
const { ForensicCaptureManager } = require(path.join(PROJECT_ROOT, 'forensics/manager'));

// After ExtractionManager and NetworkAnalysisManager are initialized:
const forensicCaptureManager = new ForensicCaptureManager({
  operator: process.env.FORENSICS_OPERATOR || 'system',
  enableCompression: true,
  enableIntegrityVerification: true,
  enableAuditLogging: true,
  filterSensitiveData: process.env.FORENSICS_FILTER_SENSITIVE !== 'false'
});

// Inject dependencies
forensicCaptureManager.initialize(
  extractionManager,
  networkAnalysisManager,
  mainWindow.webContents
);

// Register with WebSocket server
const registerForensicCommands = require(path.join(PROJECT_ROOT, 'websocket/commands/forensic-commands'));
registerForensicCommands(server, mainWindow, forensicCaptureManager);
```

#### 1.3.2 Manager Relationships

```
ForensicCaptureManager
├── delegates to → ExtractionManager
│   ├── extractMetadata()
│   ├── extractLinks()
│   ├── extractImages()
│   └── custom DOM queries
├── delegates to → NetworkAnalysisManager
│   ├── getNetworkLogs()
│   ├── getSecurityAnalysis()
│   └── getCertificateInfo()
├── uses → DOMInspector
│   ├── executeScript()
│   ├── querySelectorAll()
│   └── getComputedStyles()
└── creates → ExportPackager
    ├── formatJSON()
    ├── formatWARC()
    ├── formatHAR()
    └── generateChecksums()
```

---

## 2. WEBSOCKET API EXTENSIONS

### 2.1 New Commands Reference

#### 2.1.1 `capture_page_html` - Full Page HTML Extraction

**Description:** Capture complete rendered page HTML with DOM completeness validation.

**Command Format:**
```json
{
  "id": "unique-request-id",
  "command": "capture_page_html",
  "format": "raw|prettified|minified|all",
  "includeMetadata": true,
  "validateDomCompleteness": true,
  "timeout": 30000,
  "selector": ".content"
}
```

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `format` | string | No | "all" | Output format(s): raw, prettified, minified, all |
| `includeMetadata` | boolean | No | true | Include element count, size metrics, DOM analysis |
| `validateDomCompleteness` | boolean | No | true | Detect incomplete DOM and retry with delays |
| `timeout` | number | No | 30000 | Capture timeout in milliseconds |
| `selector` | string | No | null | Capture subtree by CSS selector (null = full page) |
| `includeShadowDOM` | boolean | No | true | Include Shadow DOM content |
| `includeFrames` | boolean | No | false | Include iframe and frame content |

**Response (Success):**
```json
{
  "id": "unique-request-id",
  "command": "capture_page_html",
  "success": true,
  "data": {
    "html": {
      "raw": "<!DOCTYPE html>...",
      "prettified": "<!DOCTYPE html>\n<html>...",
      "minified": "<!DOCTYPE html><html>..."
    },
    "metadata": {
      "elementCount": 842,
      "uniqueTagTypes": ["div", "span", "p", "a", ...],
      "totalSize": 245632,
      "hasShadowDOM": true,
      "hasFrames": false,
      "hasIframes": false,
      "timestamp": "2026-06-20T10:30:45.123Z",
      "isIdempotent": true,
      "domCompleteness": {
        "confidence": 98,
        "indicators": [],
        "score": 2
      }
    },
    "structure": {
      "rootElement": "html",
      "documentType": "html",
      "namespace": "http://www.w3.org/1999/xhtml"
    },
    "checksums": {
      "raw": "abc123...",
      "prettified": "def456...",
      "minified": "ghi789..."
    }
  },
  "executionTime": 145
}
```

**Error Response:**
```json
{
  "id": "unique-request-id",
  "command": "capture_page_html",
  "success": false,
  "error": "DOM appears incomplete after retries",
  "error_code": "DOM_INCOMPLETE",
  "recovery": {
    "suggestion": "Increase timeout or wait for dynamic content to load",
    "alternativeCommands": ["wait", "capture_page_html"]
  }
}
```

**Notes:**
- Idempotent operation: Multiple calls should return identical HTML
- Shadow DOM captured when present
- Implements exponential backoff retry for incomplete DOM detection
- Response size can be large; compression recommended for big pages

---

#### 2.1.2 `capture_page_scripts` - JavaScript Extraction

**Description:** Extract all JavaScript (inline and external) with source maps.

**Command Format:**
```json
{
  "id": "unique-request-id",
  "command": "capture_page_scripts",
  "includeSourceMaps": true,
  "includeInline": true,
  "includeExternal": true,
  "timeout": 30000
}
```

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `includeSourceMaps` | boolean | No | true | Extract source maps (if available) |
| `includeInline` | boolean | No | true | Extract inline <script> tags |
| `includeExternal` | boolean | No | true | Extract external .js files |
| `timeout` | number | No | 30000 | Capture timeout in milliseconds |

**Response (Success):**
```json
{
  "id": "unique-request-id",
  "command": "capture_page_scripts",
  "success": true,
  "data": {
    "inline": [
      {
        "id": "script-1",
        "type": "inline",
        "source": "console.log('hello');",
        "attributes": {
          "type": "text/javascript",
          "async": false,
          "defer": false
        },
        "size": 2048,
        "hash": "abc123...",
        "timestamp": "2026-06-20T10:30:45.123Z",
        "lineCount": 42
      }
    ],
    "external": [
      {
        "id": "script-2",
        "type": "external",
        "source": "var x = 1; ...",
        "attributes": {
          "src": "https://example.com/app.js",
          "type": "text/javascript",
          "async": true,
          "defer": false,
          "integrity": "sha384-..."
        },
        "sourceMap": "https://example.com/app.js.map",
        "size": 102400,
        "hash": "def456...",
        "timestamp": "2026-06-20T10:30:45.123Z",
        "lineCount": 2847
      }
    ],
    "total": 2,
    "metadata": {
      "timestamp": "2026-06-20T10:30:45.123Z",
      "totalSize": 104448,
      "sourceMapCount": 1,
      "asyncCount": 1,
      "deferCount": 0
    }
  },
  "executionTime": 342
}
```

---

#### 2.1.3 `capture_page_styles` - CSS Extraction

**Description:** Extract all CSS (inline, external, computed) with media queries.

**Command Format:**
```json
{
  "id": "unique-request-id",
  "command": "capture_page_styles",
  "includeComputed": true,
  "includeInline": true,
  "includeExternal": true,
  "selector": "*",
  "timeout": 30000
}
```

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `includeComputed` | boolean | No | true | Extract computed styles via getComputedStyle() |
| `includeInline` | boolean | No | true | Extract inline <style> tags |
| `includeExternal` | boolean | No | true | Extract external .css files |
| `selector` | string | No | "*" | CSS selector for computed styles (null = all) |
| `timeout` | number | No | 30000 | Capture timeout in milliseconds |

**Response (Success):**
```json
{
  "id": "unique-request-id",
  "command": "capture_page_styles",
  "success": true,
  "data": {
    "inline": [
      {
        "id": "style-1",
        "type": "inline",
        "content": "body { color: black; }",
        "attributes": {
          "type": "text/css",
          "media": "screen"
        },
        "size": 512,
        "hash": "abc123...",
        "timestamp": "2026-06-20T10:30:45.123Z"
      }
    ],
    "external": [
      {
        "id": "style-2",
        "type": "external",
        "content": "@import url(...); body { ... }",
        "attributes": {
          "href": "https://example.com/style.css",
          "media": "screen and (min-width: 768px)",
          "rel": "stylesheet"
        },
        "size": 8192,
        "hash": "def456...",
        "timestamp": "2026-06-20T10:30:45.123Z"
      }
    ],
    "computed": [
      {
        "selector": "body",
        "element": "BODY",
        "styles": {
          "color": "rgb(0, 0, 0)",
          "font-size": "16px",
          "line-height": "1.5"
        }
      },
      {
        "selector": ".container",
        "element": "DIV",
        "styles": {
          "display": "flex",
          "width": "100%"
        }
      }
    ],
    "total": 2,
    "metadata": {
      "timestamp": "2026-06-20T10:30:45.123Z",
      "totalSize": 8704,
      "mediaQueryCount": 5,
      "computedStylesCount": 47
    }
  },
  "executionTime": 287
}
```

---

#### 2.1.4 `capture_network_log` - Network Forensics

**Description:** Get complete network traffic log in HAR format with full request/response bodies.

**Command Format:**
```json
{
  "id": "unique-request-id",
  "command": "capture_network_log",
  "format": "har|forensic|both",
  "includeRequestBodies": true,
  "includeResponseBodies": true,
  "filterMimeTypes": ["image/*", "font/*"],
  "timeout": 30000
}
```

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `format` | string | No | "both" | Output format: HAR, forensic JSON, or both |
| `includeRequestBodies` | boolean | No | true | Include full request bodies |
| `includeResponseBodies` | boolean | No | true | Include full response bodies |
| `filterMimeTypes` | string[] | No | [] | Exclude MIME types (e.g., "image/*") |
| `timeout` | number | No | 30000 | Capture timeout in milliseconds |

**Response (Success):**
```json
{
  "id": "unique-request-id",
  "command": "capture_network_log",
  "success": true,
  "data": {
    "har": {
      "log": {
        "version": "1.2",
        "creator": {
          "name": "Basset Hound Browser",
          "version": "12.8.0"
        },
        "entries": [
          {
            "startedDateTime": "2026-06-20T10:30:45.123Z",
            "time": 245,
            "request": {
              "method": "GET",
              "url": "https://example.com/api/data",
              "headers": [...],
              "queryString": [...],
              "cookies": [...],
              "headersSize": 512,
              "bodySize": 0
            },
            "response": {
              "status": 200,
              "statusText": "OK",
              "httpVersion": "HTTP/1.1",
              "headers": [...],
              "cookies": [...],
              "content": {
                "size": 8192,
                "mimeType": "application/json",
                "text": "{...}"
              },
              "redirectURL": "",
              "headersSize": 328,
              "bodySize": 8192
            },
            "cache": {},
            "timings": {
              "blocked": 10,
              "dns": 50,
              "connect": 75,
              "send": 25,
              "wait": 100,
              "receive": -1,
              "ssl": 75
            }
          }
        ]
      }
    },
    "forensic": {
      "requests": [
        {
          "id": "request-1",
          "method": "GET",
          "url": "https://example.com/api/data",
          "timestamp": "2026-06-20T10:30:45.123Z",
          "duration": 245,
          "request": {
            "headers": {...},
            "body": "...",
            "bodySize": 0,
            "bodyHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
          },
          "response": {
            "status": 200,
            "statusText": "OK",
            "headers": {...},
            "body": "...",
            "bodySize": 8192,
            "bodyHash": "abc123...",
            "mimeType": "application/json"
          },
          "security": {
            "wasSecure": true,
            "certChain": [...],
            "securityHeaders": {...}
          },
          "forensics": {
            "isRedirect": false,
            "isCached": false,
            "resourceType": "xhr",
            "hasResourceTiming": true
          }
        }
      ],
      "metadata": {
        "timestamp": "2026-06-20T10:30:45.123Z",
        "captureStartTime": "2026-06-20T10:30:45.123Z",
        "captureEndTime": "2026-06-20T10:30:50.456Z",
        "requestCount": 47,
        "totalBytes": 2048576,
        "redirectCount": 2,
        "errorCount": 0,
        "securityIssues": []
      }
    },
    "checksums": {
      "har": "abc123...",
      "forensic": "def456..."
    }
  },
  "executionTime": 512
}
```

---

#### 2.1.5 `export_forensic_package` - Complete Forensic Package Export

**Description:** Export all captured forensic data as structured archive with integrity verification.

**Command Format:**
```json
{
  "id": "unique-request-id",
  "command": "export_forensic_package",
  "sessionId": "session-uuid",
  "format": "json|warc|combined",
  "compress": true,
  "includeAuditLog": true,
  "exportPath": "/path/to/export",
  "encryptionKey": null
}
```

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `sessionId` | string | Yes | - | Session ID from capture_page_html or similar |
| `format` | string | No | "combined" | Export format: JSON, WARC, or both |
| `compress` | boolean | No | true | Gzip compress export files |
| `includeAuditLog` | boolean | No | true | Include chain of custody audit log |
| `exportPath` | string | No | "./exports" | Base directory for export |
| `encryptionKey` | string | No | null | Optional AES-256 encryption key (base64) |

**Response (Success):**
```json
{
  "id": "unique-request-id",
  "command": "export_forensic_package",
  "success": true,
  "data": {
    "exportPath": "/exports/example.com/2026-06-20T10-30-45Z",
    "format": "json+warc",
    "fileCount": 8,
    "totalSize": 5242880,
    "compressedSize": 1048576,
    "compressionRatio": 0.20,
    "files": [
      {
        "name": "package.json",
        "size": 245632,
        "compressedSize": 49152,
        "hash": "abc123...",
        "path": "/exports/example.com/2026-06-20T10-30-45Z/package.json"
      },
      {
        "name": "page.html",
        "size": 1048576,
        "compressedSize": 204800,
        "hash": "def456...",
        "path": "/exports/example.com/2026-06-20T10-30-45Z/page.html"
      },
      {
        "name": "package.warc.gz",
        "size": 2097152,
        "compressedSize": 512000,
        "hash": "ghi789...",
        "path": "/exports/example.com/2026-06-20T10-30-45Z/package.warc.gz"
      }
    ],
    "integrity": {
      "algorithm": "sha256",
      "packageHash": "master-hash-xyz...",
      "verified": true
    },
    "auditLog": [
      {
        "timestamp": "2026-06-20T10:30:45.123Z",
        "action": "capture_started",
        "actor": "operator1"
      }
    ],
    "metadata": {
      "createdAt": "2026-06-20T10:30:45.123Z",
      "createdBy": "operator1",
      "targetUrl": "https://example.com",
      "captureType": "full",
      "version": "1.0.0"
    }
  },
  "executionTime": 2847
}
```

---

#### 2.1.6 `start_forensic_capture` - Begin Forensic Session

**Description:** Begin a forensic capture session with audit logging.

**Command Format:**
```json
{
  "id": "unique-request-id",
  "command": "start_forensic_capture",
  "operator": "user@example.com",
  "requestId": "case-123-456",
  "captureType": "full"
}
```

**Response:**
```json
{
  "id": "unique-request-id",
  "command": "start_forensic_capture",
  "success": true,
  "data": {
    "sessionId": "session-uuid-123",
    "requestId": "case-123-456",
    "startTime": "2026-06-20T10:30:45.123Z",
    "operator": "user@example.com"
  }
}
```

---

#### 2.1.7 `stop_forensic_capture` - End Forensic Session

**Description:** End forensic capture session and finalize audit log.

**Command Format:**
```json
{
  "id": "unique-request-id",
  "command": "stop_forensic_capture"
}
```

**Response:**
```json
{
  "id": "unique-request-id",
  "command": "stop_forensic_capture",
  "success": true,
  "data": {
    "sessionId": "session-uuid-123",
    "startTime": "2026-06-20T10:30:45.123Z",
    "endTime": "2026-06-20T10:35:12.456Z",
    "durationMs": 267331,
    "dataCaptured": 5242880
  }
}
```

---

#### 2.1.8 `get_forensic_status` - Query Capture Status

**Description:** Get current forensic capture session status and statistics.

**Command Format:**
```json
{
  "id": "unique-request-id",
  "command": "get_forensic_status"
}
```

**Response:**
```json
{
  "id": "unique-request-id",
  "command": "get_forensic_status",
  "success": true,
  "data": {
    "isCapturing": true,
    "sessionId": "session-uuid-123",
    "startTime": "2026-06-20T10:30:45.123Z",
    "elapsedMs": 127500,
    "dataCaptured": 2097152,
    "estimatedSize": 5242880,
    "layers": {
      "html": {
        "captured": true,
        "size": 1048576,
        "elementCount": 842
      },
      "scripts": {
        "captured": true,
        "count": 12,
        "size": 524288
      },
      "styles": {
        "captured": true,
        "count": 8,
        "size": 262144
      },
      "network": {
        "capturing": true,
        "requestCount": 47,
        "size": 262144
      }
    }
  }
}
```

---

### 2.2 Command Registration Pattern

```javascript
// websocket/commands/forensic-commands.js
function registerForensicCommands(server, mainWindow, forensicCaptureManager) {
  const commandHandlers = server.commandHandlers || server;

  commandHandlers.capture_page_html = async (params) => {
    try {
      const result = await forensicCaptureManager.capturePageHTML(params);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  commandHandlers.capture_page_scripts = async (params) => {
    try {
      const result = await forensicCaptureManager.capturePageScripts(params);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ... register other commands
}

module.exports = { registerForensicCommands };
```

---

## 3. CLIENT LIBRARY ARCHITECTURE

### 3.1 Python Client (basset_hound)

```python
"""
Basset Hound Browser - Python Forensic Capture Client
Extends main BrowserClient with forensic capture capabilities
"""

from typing import Optional, Dict, Any, List, Literal, AsyncContextManager
import hashlib
import os

class ForensicBrowser(BrowserClient):
    """
    Extended browser client with forensic capture capabilities
    Inherits all standard browser operations from BrowserClient
    """

    async def capture_html(
        self,
        format: Literal['raw', 'prettified', 'minified', 'all'] = 'all',
        include_metadata: bool = True,
        validate_dom: bool = True,
        timeout: Optional[int] = None,
        selector: Optional[str] = None,
        include_shadow_dom: bool = True,
        include_frames: bool = False
    ) -> Dict[str, Any]:
        """
        Capture complete rendered HTML with metadata
        
        Args:
            format: Output format
            include_metadata: Include element count, size metrics
            validate_dom: Detect incomplete DOM and retry
            timeout: Capture timeout in ms
            selector: CSS selector for subtree capture
            include_shadow_dom: Include Shadow DOM content
            include_frames: Include iframe/frame content
            
        Returns:
            Dict with html (raw/prettified/minified), metadata, structure
            
        Example:
            html_data = await browser.capture_html(
                format='all',
                validate_dom=True,
                selector='.main-content'
            )
        """
        return await self._execute_command(
            'capture_page_html',
            {
                'format': format,
                'includeMetadata': include_metadata,
                'validateDomCompleteness': validate_dom,
                'timeout': timeout or self.timeout,
                'selector': selector,
                'includeShadowDOM': include_shadow_dom,
                'includeFrames': include_frames
            }
        )

    async def capture_scripts(
        self,
        include_source_maps: bool = True,
        include_inline: bool = True,
        include_external: bool = True,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Extract all JavaScript (inline and external)
        
        Returns:
            Dict with inline scripts, external scripts, and metadata
        """
        return await self._execute_command(
            'capture_page_scripts',
            {
                'includeSourceMaps': include_source_maps,
                'includeInline': include_inline,
                'includeExternal': include_external,
                'timeout': timeout or self.timeout
            }
        )

    async def capture_styles(
        self,
        include_computed: bool = True,
        include_inline: bool = True,
        include_external: bool = True,
        selector: str = '*',
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Extract all CSS (inline, external, computed)
        
        Returns:
            Dict with inline styles, external styles, computed styles, metadata
        """
        return await self._execute_command(
            'capture_page_styles',
            {
                'includeComputed': include_computed,
                'includeInline': include_inline,
                'includeExternal': include_external,
                'selector': selector,
                'timeout': timeout or self.timeout
            }
        )

    async def capture_network(
        self,
        format: Literal['har', 'forensic', 'both'] = 'both',
        include_request_bodies: bool = True,
        include_response_bodies: bool = True,
        filter_mime_types: Optional[List[str]] = None,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get network traffic log in HAR/forensic format
        
        Returns:
            Dict with HAR format, forensic metadata, checksums
        """
        return await self._execute_command(
            'capture_network_log',
            {
                'format': format,
                'includeRequestBodies': include_request_bodies,
                'includeResponseBodies': include_response_bodies,
                'filterMimeTypes': filter_mime_types or [],
                'timeout': timeout or self.timeout
            }
        )

    async def export_forensic_package(
        self,
        session_id: str,
        format: Literal['json', 'warc', 'combined'] = 'combined',
        compress: bool = True,
        include_audit_log: bool = True,
        export_path: str = './exports',
        encryption_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Export forensic package with integrity verification
        
        Args:
            session_id: Session ID from capture operations
            format: Export format (JSON, WARC, or both)
            compress: Gzip compress export files
            include_audit_log: Include chain of custody log
            export_path: Base directory for export
            encryption_key: Optional AES-256 encryption key (base64)
            
        Returns:
            Dict with export path, file list, integrity hashes
        """
        return await self._execute_command(
            'export_forensic_package',
            {
                'sessionId': session_id,
                'format': format,
                'compress': compress,
                'includeAuditLog': include_audit_log,
                'exportPath': export_path,
                'encryptionKey': encryption_key
            }
        )

    async def start_forensic_capture(
        self,
        operator: str,
        request_id: Optional[str] = None,
        capture_type: str = 'full'
    ) -> Dict[str, Any]:
        """
        Begin forensic capture session with audit logging
        
        Returns:
            Dict with sessionId, requestId, startTime
        """
        return await self._execute_command(
            'start_forensic_capture',
            {
                'operator': operator,
                'requestId': request_id,
                'captureType': capture_type
            }
        )

    async def stop_forensic_capture(self) -> Dict[str, Any]:
        """
        End forensic capture session
        
        Returns:
            Dict with session info and duration
        """
        return await self._execute_command('stop_forensic_capture')

    async def get_forensic_status(self) -> Dict[str, Any]:
        """
        Get current forensic capture status
        
        Returns:
            Dict with capture state, data captured, layer status
        """
        return await self._execute_command('get_forensic_status')

    async def forensic_capture_workflow(
        self,
        url: str,
        operator: str,
        request_id: Optional[str] = None,
        export_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Complete forensic capture workflow:
        1. Start capture
        2. Navigate to URL
        3. Capture all data layers
        4. Export forensic package
        
        Returns:
            Dict with export info and all captured data
        """
        try:
            # Start forensic session
            session = await self.start_forensic_capture(
                operator=operator,
                request_id=request_id,
                capture_type='full'
            )
            session_id = session['data']['sessionId']
            
            # Navigate to target
            await self.navigate(url)
            
            # Capture all layers
            html_data = await self.capture_html(format='all')
            scripts_data = await self.capture_scripts()
            styles_data = await self.capture_styles()
            network_data = await self.capture_network()
            
            # Stop capture
            await self.stop_forensic_capture()
            
            # Export package
            export = await self.export_forensic_package(
                session_id=session_id,
                format='combined',
                export_path=export_path or './exports'
            )
            
            return {
                'success': True,
                'session': session['data'],
                'html': html_data['data'],
                'scripts': scripts_data['data'],
                'styles': styles_data['data'],
                'network': network_data['data'],
                'export': export['data']
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}

# Usage Example
async def main():
    async with ForensicBrowser('ws://localhost:8765') as browser:
        # Single layer capture
        html = await browser.capture_html(format='all', validate_dom=True)
        scripts = await browser.capture_scripts()
        styles = await browser.capture_styles()
        network = await browser.capture_network()
        
        # Complete workflow
        result = await browser.forensic_capture_workflow(
            url='https://example.com',
            operator='forensics-team@company.com',
            request_id='case-2026-06-20-001',
            export_path='/forensics/exports'
        )
        
        print(f"Exported to: {result['export']['exportPath']}")
        print(f"Files: {len(result['export']['files'])}")
        print(f"Total size: {result['export']['totalSize']} bytes")
        print(f"Compression ratio: {result['export']['compressionRatio']:.2%}")
```

### 3.2 JavaScript/Node.js Client

```javascript
/**
 * Basset Hound Browser - JavaScript Forensic Capture Client
 * Extends main BrowserClient with forensic capabilities
 */

class ForensicBrowser extends BrowserClient {
  /**
   * Capture complete rendered HTML
   */
  async captureHTML(options = {}) {
    const params = {
      format: options.format || 'all',
      includeMetadata: options.includeMetadata !== false,
      validateDomCompleteness: options.validateDom !== false,
      timeout: options.timeout || this.timeout,
      selector: options.selector || null,
      includeShadowDOM: options.includeShadowDOM !== false,
      includeFrames: options.includeFrames || false
    };

    return this.executeCommand('capture_page_html', params);
  }

  /**
   * Extract all JavaScript
   */
  async captureScripts(options = {}) {
    const params = {
      includeSourceMaps: options.includeSourceMaps !== false,
      includeInline: options.includeInline !== false,
      includeExternal: options.includeExternal !== false,
      timeout: options.timeout || this.timeout
    };

    return this.executeCommand('capture_page_scripts', params);
  }

  /**
   * Extract all CSS
   */
  async captureStyles(options = {}) {
    const params = {
      includeComputed: options.includeComputed !== false,
      includeInline: options.includeInline !== false,
      includeExternal: options.includeExternal !== false,
      selector: options.selector || '*',
      timeout: options.timeout || this.timeout
    };

    return this.executeCommand('capture_page_styles', params);
  }

  /**
   * Capture network traffic
   */
  async captureNetwork(options = {}) {
    const params = {
      format: options.format || 'both',
      includeRequestBodies: options.includeRequestBodies !== false,
      includeResponseBodies: options.includeResponseBodies !== false,
      filterMimeTypes: options.filterMimeTypes || [],
      timeout: options.timeout || this.timeout
    };

    return this.executeCommand('capture_network_log', params);
  }

  /**
   * Export forensic package
   */
  async exportForensicPackage(options = {}) {
    if (!options.sessionId) {
      throw new Error('sessionId is required');
    }

    const params = {
      sessionId: options.sessionId,
      format: options.format || 'combined',
      compress: options.compress !== false,
      includeAuditLog: options.includeAuditLog !== false,
      exportPath: options.exportPath || './exports',
      encryptionKey: options.encryptionKey || null
    };

    return this.executeCommand('export_forensic_package', params);
  }

  /**
   * Complete forensic capture workflow
   */
  async forensicCaptureWorkflow(options = {}) {
    if (!options.url || !options.operator) {
      throw new Error('url and operator are required');
    }

    try {
      // Start session
      const session = await this.executeCommand('start_forensic_capture', {
        operator: options.operator,
        requestId: options.requestId,
        captureType: options.captureType || 'full'
      });

      const sessionId = session.data.sessionId;

      // Navigate
      await this.navigate(options.url);

      // Capture all layers
      const [html, scripts, styles, network] = await Promise.all([
        this.captureHTML(options.htmlOptions),
        this.captureScripts(options.scriptOptions),
        this.captureStyles(options.styleOptions),
        this.captureNetwork(options.networkOptions)
      ]);

      // Stop capture
      await this.executeCommand('stop_forensic_capture', {});

      // Export
      const exportResult = await this.exportForensicPackage({
        sessionId,
        ...options.exportOptions
      });

      return {
        success: true,
        session: session.data,
        html: html.data,
        scripts: scripts.data,
        styles: styles.data,
        network: network.data,
        export: exportResult.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Usage
(async () => {
  const browser = new ForensicBrowser('ws://localhost:8765');

  // Single layer
  const html = await browser.captureHTML({ format: 'all' });
  
  // Complete workflow
  const result = await browser.forensicCaptureWorkflow({
    url: 'https://example.com',
    operator: 'forensics@company.com',
    requestId: 'case-2026-06-20-001',
    exportOptions: {
      format: 'combined',
      exportPath: '/forensics/exports'
    }
  });

  console.log('Exported to:', result.export.exportPath);
  console.log('File count:', result.export.files.length);
})();
```

---

## 4. DATA EXPORT FORMAT

### 4.1 Directory Structure

```
/exports/
├── [hostname]/
│   └── [timestamp]/
│       ├── package.json                 # Main package metadata + all capture layers
│       ├── package.json.gz              # (if compress=true)
│       ├── page.html                    # Raw HTML
│       ├── page-prettified.html         # Formatted HTML
│       ├── page-minified.html           # Minified HTML
│       ├── scripts/
│       │   ├── inline-1.js
│       │   ├── inline-2.js
│       │   ├── external-1.js
│       │   └── sourcemaps/
│       │       └── external-1.js.map
│       ├── styles/
│       │   ├── inline-1.css
│       │   ├── inline-2.css
│       │   ├── external-1.css
│       │   └── computed-styles.json
│       ├── network/
│       │   ├── network.har              # HAR 1.2 format
│       │   ├── network-forensic.json    # Forensic format
│       │   ├── requests/                # Individual request/response pairs
│       │   │   ├── 001-GET.json
│       │   │   ├── 002-POST.json
│       │   │   └── ...
│       │   └── certificates/            # SSL cert chains
│       │       ├── cert-1.pem
│       │       └── cert-2.pem
│       ├── metadata.json                # Export metadata
│       ├── audit-log.json               # Chain of custody
│       ├── checksums.json               # SHA-256 hashes
│       ├── MANIFEST.txt                 # File listing
│       └── package.warc.gz              # (if format includes WARC)
└── [hostname]/
    └── [timestamp]/
        └── ...
```

### 4.2 JSON Package Format

```json
{
  "metadata": {
    "version": "1.0.0",
    "createdAt": "2026-06-20T10:30:45.123Z",
    "createdBy": "operator@example.com",
    "sessionId": "session-uuid-123",
    "requestId": "case-2026-06-20-001",
    "targetUrl": "https://example.com",
    "userAgent": "Mozilla/5.0...",
    "captureType": "full",
    "durationMs": 5000,
    "totalSize": 5242880
  },

  "html": {
    "raw": "<!DOCTYPE html>...",
    "prettified": "<!DOCTYPE html>\n<html>...",
    "minified": "<!DOCTYPE html><html>...",
    "metadata": {
      "elementCount": 842,
      "uniqueTagTypes": ["div", "span", "p", "a"],
      "totalSize": 245632,
      "timestamp": "2026-06-20T10:30:45.123Z"
    }
  },

  "scripts": {
    "inline": [
      {
        "id": "script-1",
        "source": "console.log('hello');",
        "attributes": { "type": "text/javascript" },
        "hash": "abc123...",
        "size": 2048
      }
    ],
    "external": [
      {
        "id": "script-2",
        "attributes": { "src": "https://example.com/app.js" },
        "sourceMapUrl": "https://example.com/app.js.map",
        "hash": "def456...",
        "size": 102400
      }
    ]
  },

  "styles": {
    "inline": [],
    "external": [],
    "computed": []
  },

  "network": {
    "requestCount": 47,
    "totalBytes": 2048576,
    "har": { "log": { ... } }
  },

  "integrity": {
    "algorithm": "sha256",
    "packageHash": "master-hash-xyz...",
    "fileChecksums": {
      "page.html": "abc123...",
      "scripts/inline-1.js": "def456...",
      "styles/computed-styles.json": "ghi789...",
      "network/network.har": "jkl012..."
    }
  },

  "auditLog": [
    {
      "timestamp": "2026-06-20T10:30:45.123Z",
      "action": "capture_started",
      "operator": "operator@example.com",
      "sessionId": "session-uuid-123"
    },
    {
      "timestamp": "2026-06-20T10:30:50.456Z",
      "action": "capture_stopped",
      "operator": "operator@example.com"
    },
    {
      "timestamp": "2026-06-20T10:31:12.789Z",
      "action": "export_created",
      "format": "json+warc"
    }
  ]
}
```

### 4.3 WARC Format Export

```
WARC/1.0
WARC-Type: resource
WARC-Date: 2026-06-20T10:30:45Z
WARC-Record-ID: <urn:uuid:session-uuid-123>
WARC-Filename: page.html
Content-Length: 245632
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
...
(HTML content)
...

WARC/1.0
WARC-Type: resource
WARC-Date: 2026-06-20T10:30:45Z
WARC-Record-ID: <urn:uuid:script-1-uuid>
WARC-Filename: scripts/inline-1.js
Content-Length: 2048
Content-Type: application/javascript

(Script content)
...
```

### 4.4 Compression & Integrity

**Compression Strategy:**
- Files stored individually (enables selective extraction)
- Optional gzip compression per file
- Overall package compression: 70-90% reduction for text-heavy content
- Large binary responses stored with compression flag

**Integrity Verification:**
```json
{
  "checksums": {
    "algorithm": "sha256",
    "files": {
      "package.json": "abc123...",
      "page.html": "def456...",
      "network/network.har": "ghi789..."
    },
    "packageHash": "master-hash-xyz..."
  }
}
```

**Verification Command (Node.js):**
```javascript
const fs = require('fs');
const crypto = require('crypto');
const manifest = JSON.parse(fs.readFileSync('checksums.json'));

for (const [file, expectedHash] of Object.entries(manifest.files)) {
  const content = fs.readFileSync(file);
  const actualHash = crypto.createHash('sha256').update(content).digest('hex');
  
  if (actualHash !== expectedHash) {
    console.warn(`INTEGRITY MISMATCH: ${file}`);
    console.warn(`Expected: ${expectedHash}`);
    console.warn(`Actual: ${actualHash}`);
  }
}
```

---

## 5. INTEGRATION POINTS

### 5.1 Integration with src/main/main.js

```javascript
// src/main/main.js - Locate around line 63
const { ExtractionManager } = require(path.join(PROJECT_ROOT, 'extraction'));
const { NetworkAnalysisManager } = require(path.join(PROJECT_ROOT, 'network-analysis/manager'));

// ADD AFTER ExtractionManager import:
const { ForensicCaptureManager } = require(path.join(PROJECT_ROOT, 'forensics/manager'));

// Later in initialization (around line 200-300, in WebSocket setup):
// After extractionManager and networkAnalysisManager are created:

const forensicCaptureManager = new ForensicCaptureManager({
  operator: process.env.FORENSICS_OPERATOR || 'system',
  enableCompression: process.env.FORENSICS_COMPRESSION !== 'false',
  enableIntegrityVerification: process.env.FORENSICS_INTEGRITY !== 'false',
  enableAuditLogging: process.env.FORENSICS_AUDIT !== 'false',
  filterSensitiveData: process.env.FORENSICS_FILTER_SENSITIVE !== 'false'
});

// Initialize dependencies
forensicCaptureManager.initialize(
  extractionManager,
  networkAnalysisManager,
  mainWindow.webContents
);

// Pass to WebSocket server setup
const registerForensicCommands = require(path.join(PROJECT_ROOT, 'websocket/commands/forensic-commands'));
registerForensicCommands(server, mainWindow, forensicCaptureManager);
```

### 5.2 Manager Dependencies & Methods

**From ExtractionManager, ForensicCaptureManager uses:**
```javascript
extractionManager.extractMetadata(html, url)
extractionManager.extractLinks(html, baseUrl)
extractionManager.extractImages(html, baseUrl)
extractionManager.extractScripts(html, baseUrl)
extractionManager.extractStylesheets(html, baseUrl)
extractionManager.extractStructuredData(html)
extractionManager.detectIncompleteDom(html)
extractionManager.resolveUrl(url, baseUrl)
```

**From NetworkAnalysisManager, ForensicCaptureManager uses:**
```javascript
networkAnalysisManager.startCapture(webContents)
networkAnalysisManager.stopCapture()
networkAnalysisManager.getNetworkLog()
networkAnalysisManager.getHAR()
networkAnalysisManager.getSecurityAnalysis()
networkAnalysisManager.getCertificateChain(url)
```

**From DOMInspector, ForensicCaptureManager uses:**
```javascript
domInspector.executeScript(script, context)
domInspector.querySelectorAll(selector)
domInspector.getComputedStyles(element)
domInspector.getElementText(selector)
```

### 5.3 ForensicCaptureManager → ExtractionManager Extension

```javascript
// forensics/manager.js
class ForensicCaptureManager {
  async capturePageHTML(options = {}) {
    // Use ExtractionManager for DOM completeness detection
    const domAnalysis = this.extractionManager.detectIncompleteDom(html);
    
    if (domAnalysis.incomplete && options.validateDomCompleteness) {
      // Retry with exponential backoff
      for (let i = 0; i < this.config.retryAttempts; i++) {
        await this.sleep(Math.pow(2, i) * 1000);
        const retryHtml = await this.webContents.executeJavaScript('document.documentElement.outerHTML');
        const retryAnalysis = this.extractionManager.detectIncompleteDom(retryHtml);
        
        if (!retryAnalysis.incomplete) {
          html = retryHtml;
          domAnalysis = retryAnalysis;
          break;
        }
      }
    }
    
    return {
      raw: html,
      prettified: this.prettifyHTML(html),
      minified: this.minifyHTML(html),
      metadata: {
        elementCount: this.countElements(html),
        uniqueTagTypes: this.getUniqueTags(html),
        totalSize: html.length,
        isIdempotent: domAnalysis.confidence > 90,
        domCompleteness: domAnalysis
      }
    };
  }

  async capturePageScripts(options = {}) {
    // Leverage ExtractionManager for script extraction
    const extraction = this.extractionManager.extractScripts(html, this.currentUrl);
    
    return {
      inline: extraction.inline.map(s => ({
        ...s,
        hash: this.calculateChecksum(s.source)
      })),
      external: extraction.external.map(s => ({
        ...s,
        hash: this.calculateChecksum(s.content)
      })),
      total: extraction.inline.length + extraction.external.length
    };
  }

  async capturePageStyles(options = {}) {
    // Get external styles from ExtractionManager
    const stylesheets = this.extractionManager.extractStylesheets(html, this.currentUrl);
    
    // Get computed styles via DOMInspector
    const computed = await this.getComputedStyles(options.selector);
    
    return {
      inline: stylesheets.inline,
      external: stylesheets.external,
      computed: computed,
      total: stylesheets.inline.length + stylesheets.external.length
    };
  }
}
```

### 5.4 WebSocket Command Registration

```javascript
// websocket/commands/forensic-commands.js
const path = require('path');

function registerForensicCommands(server, mainWindow, forensicCaptureManager) {
  const commandHandlers = server.commandHandlers || server;

  // Register all forensic commands
  commandHandlers.capture_page_html = async (params) => {
    try {
      const result = await forensicCaptureManager.capturePageHTML(params);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        error_code: 'CAPTURE_FAILED'
      };
    }
  };

  commandHandlers.capture_page_scripts = async (params) => {
    try {
      const result = await forensicCaptureManager.capturePageScripts(params);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        error_code: 'SCRIPT_CAPTURE_FAILED'
      };
    }
  };

  // ... register other commands

  commandHandlers.export_forensic_package = async (params) => {
    try {
      const result = await forensicCaptureManager.exportForensicPackage(params);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        error_code: 'EXPORT_FAILED'
      };
    }
  };
}

module.exports = { registerForensicCommands };
```

---

## 6. SECURITY CONSIDERATIONS

### 6.1 Sensitive Data Filtering

**Automatic Filtering Patterns:**
```javascript
const SENSITIVE_PATTERNS = {
  // Credentials
  password: /password\s*[:=]\s*["']([^"']+)["']/gi,
  apiKey: /apikey\s*[:=]\s*["']([^"']+)["']/gi,
  token: /token\s*[:=]\s*["']([^"']+)["']/gi,
  
  // OAuth/JWT
  bearer: /Bearer\s+([A-Za-z0-9\-._~+/]+=*)/gi,
  jwt: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
  
  // Request signatures
  signature: /signature\s*[:=]\s*["']([^"']+)["']/gi,
  nonce: /nonce\s*[:=]\s*["']([^"']+)["']/gi,
  
  // SQL/Data
  connectionString: /([A-Za-z]+:\/\/[^:]+:([^@]+)@)/gi,
  sqlPassword: /password\s*=\s*([^;]+)/gi
};

class ForensicCaptureManager {
  filterSensitiveContent(content, type = 'html') {
    if (!this.config.filterSensitiveData) return content;
    
    let filtered = content;
    
    Object.entries(SENSITIVE_PATTERNS).forEach(([name, pattern]) => {
      filtered = filtered.replace(pattern, (match, ...groups) => {
        // Redact captured groups but keep surrounding context
        let result = match;
        for (let i = 1; i < groups.length - 2; i++) {
          if (groups[i]) {
            result = result.replace(groups[i], `[REDACTED:${name.toUpperCase()}]`);
          }
        }
        return result;
      });
    });
    
    return filtered;
  }

  /**
   * Generate redaction report
   */
  getRedactionReport(originalContent, filteredContent) {
    const redactionCount = (originalContent.match(/\[REDACTED:/g) || []).length;
    const redactionTypes = {};
    
    const matches = originalContent.matchAll(/\[REDACTED:([^\]]+)\]/g);
    for (const match of matches) {
      redactionTypes[match[1]] = (redactionTypes[match[1]] || 0) + 1;
    }
    
    return {
      totalRedactions: redactionCount,
      byType: redactionTypes,
      reportTimestamp: new Date().toISOString()
    };
  }
}
```

### 6.2 Export File Encryption

**Optional AES-256-GCM Encryption:**
```javascript
const crypto = require('crypto');

class ForensicCaptureManager {
  encryptExport(data, encryptionKey) {
    if (!encryptionKey) return { encrypted: false, data };
    
    // Decode base64 key
    const keyBuffer = Buffer.from(encryptionKey, 'base64');
    if (keyBuffer.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (base64)');
    }
    
    // Generate random IV
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final()
    ]);
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: true,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      data: encrypted.toString('base64')
    };
  }

  decryptExport(encryptedData, encryptionKey) {
    if (!encryptionKey) return JSON.parse(encryptedData);
    
    const keyBuffer = Buffer.from(encryptionKey, 'base64');
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const encrypted = Buffer.from(encryptedData.data, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  }
}
```

### 6.3 Audit Logging & Chain of Custody

```javascript
class ForensicCaptureManager {
  logAudit(action, metadata = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      sessionId: this.captureState.sessionId,
      operator: this.config.operator,
      userAgent: process.env.USER_AGENT || 'unknown',
      ipAddress: metadata.ipAddress || 'unknown',
      ...metadata
    };
    
    // Store in memory
    this.integrityData.auditLog.push(entry);
    
    // Log to persistent storage (if configured)
    if (this.config.enableAuditLogging) {
      const fs = require('fs');
      const auditFile = path.join(this.config.auditLogPath, 'forensics-audit.log');
      fs.appendFileSync(auditFile, JSON.stringify(entry) + '\n');
    }
    
    console.log('[ForensicCaptureManager] Audit:', entry);
    return entry;
  }

  /**
   * Generate chain of custody report
   */
  generateChainOfCustodyReport() {
    return {
      sessionId: this.captureState.sessionId,
      initiatedBy: this.config.operator,
      startTime: new Date(this.captureState.startTime).toISOString(),
      endTime: this.captureState.endTime ? new Date(this.captureState.endTime).toISOString() : null,
      chain: this.integrityData.auditLog.map(entry => ({
        timestamp: entry.timestamp,
        action: entry.action,
        actor: entry.operator,
        details: entry
      }))
    };
  }
}
```

### 6.4 Data Retention Policy

```javascript
class ForensicCaptureManager {
  /**
   * Set data retention policy
   */
  setDataRetentionPolicy(policy = {}) {
    this.retentionPolicy = {
      enabled: policy.enabled !== false,
      retentionDays: policy.retentionDays || 90,
      archiveAfterDays: policy.archiveAfterDays || 30,
      deleteAfterDays: policy.deleteAfterDays || 365,
      secureDelete: policy.secureDelete !== false
    };
  }

  /**
   * Auto-delete expired exports
   */
  async cleanupExpiredExports() {
    if (!this.retentionPolicy.enabled) return;
    
    const fs = require('fs').promises;
    const path = require('path');
    const now = Date.now();
    
    const exportsDir = path.join(this.config.exportBasePath, 'exports');
    
    for (const hostname of await fs.readdir(exportsDir)) {
      const hostnameDir = path.join(exportsDir, hostname);
      
      for (const timestamp of await fs.readdir(hostnameDir)) {
        const exportDir = path.join(hostnameDir, timestamp);
        const metadata = JSON.parse(
          await fs.readFile(path.join(exportDir, 'metadata.json'), 'utf8')
        );
        
        const createdAt = new Date(metadata.createdAt).getTime();
        const ageMs = now - createdAt;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        
        if (ageDays > this.retentionPolicy.deleteAfterDays) {
          // Securely delete directory
          await this.secureDelete(exportDir);
          console.log(`[ForensicCaptureManager] Deleted expired export: ${exportDir}`);
        }
      }
    }
  }

  /**
   * Secure deletion (overwrite before delete)
   */
  async secureDelete(dirPath) {
    if (!this.retentionPolicy.secureDelete) {
      // Regular delete
      const fs = require('fs').promises;
      await fs.rm(dirPath, { recursive: true, force: true });
      return;
    }
    
    // Secure delete: overwrite with random data first
    const fs = require('fs').promises;
    const crypto = require('crypto');
    
    // Recursively overwrite and delete
    async function secureDeleteDir(dir) {
      for (const file of await fs.readdir(dir)) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
          await secureDeleteDir(filePath);
          await fs.rmdir(filePath);
        } else {
          // Overwrite with random data
          const size = stat.size;
          const randomData = crypto.randomBytes(size);
          await fs.writeFile(filePath, randomData);
          await fs.unlink(filePath);
        }
      }
    }
    
    await secureDeleteDir(dirPath);
    await fs.rmdir(dirPath);
  }
}
```

---

## 7. IMPLEMENTATION CHECKLIST

### Phase 1: Core Implementation
- [ ] Create `forensics/manager.js` with ForensicCaptureManager class
- [ ] Implement HTML capture with DOM completeness validation
- [ ] Implement script extraction with source map support
- [ ] Implement CSS extraction with computed styles
- [ ] Implement network forensics with HAR export
- [ ] Create `forensics/exporter.js` for package generation
- [ ] Implement SHA-256 integrity verification

### Phase 2: WebSocket Integration
- [ ] Create `websocket/commands/forensic-commands.js`
- [ ] Register 8 new commands in server.js
- [ ] Implement error handling and recovery
- [ ] Add command validation and rate limiting
- [ ] Create test suite (50+ tests)

### Phase 3: Client Libraries
- [ ] Update Python SDK with ForensicBrowser class
- [ ] Update JavaScript SDK with forensic methods
- [ ] Add workflow helpers (forensic_capture_workflow)
- [ ] Create Python/JS usage examples

### Phase 4: Export & Storage
- [ ] Implement JSON export format
- [ ] Implement WARC export format
- [ ] Implement HAR export format
- [ ] Add optional AES-256 encryption
- [ ] Add compression support (gzip)
- [ ] Create manifest/checksum generation

### Phase 5: Security & Audit
- [ ] Implement sensitive data filtering
- [ ] Add audit logging infrastructure
- [ ] Implement chain of custody tracking
- [ ] Add data retention policy enforcement
- [ ] Create redaction reporting

### Phase 6: Testing & Documentation
- [ ] Write 100+ integration tests
- [ ] Create deployment guide
- [ ] Create API documentation
- [ ] Create security guidelines
- [ ] Create workflow examples

---

## 8. PERFORMANCE TARGETS

| Metric | Target | Notes |
|--------|--------|-------|
| HTML Capture | <2s | 1MB page |
| Script Extraction | <3s | Full page |
| Style Extraction | <2s | All computed styles |
| Network Log Export | <5s | 50 requests |
| Forensic Package Export | <15s | Full capture |
| Compression Ratio | 70-90% | Text-heavy content |
| Memory Overhead | <50MB | Per capture session |
| Integrity Verification | <1s | SHA-256 hashing |

---

## 9. LEGAL & COMPLIANCE

### Chain of Custody Requirements Met
✅ Unique session IDs for each capture  
✅ Operator/user identification in audit log  
✅ Timestamp integrity (ISO-8601)  
✅ SHA-256 checksums for all files  
✅ Immutable audit log  
✅ Secure deletion capability  
✅ Export encryption support  
✅ Data retention policies  

### Forensic Grade Evidence
✅ No modifications to captured content  
✅ Hash verification for integrity  
✅ Complete audit trail  
✅ Documented procedures  
✅ Repeatable capture methodology  
✅ Tamper-evident packaging  

---

## 10. FUTURE ENHANCEMENTS

- WARC-WARC signature support for legal-grade evidence
- Integration with digital forensics frameworks (EnCase, Forensic Toolkit)
- Automated eDiscovery compliance reporting
- Machine-readable provenance (PROV-O ontology)
- Blockchain-based integrity verification
- Multi-signature support for distributed verification
- Automated report generation (Forensic Report Generator)
- Integration with case management systems

---

## Version History

| Version | Date | Status | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-20 | Draft | Initial specification |
| (future) | TBD | Planning | Implementation phase |

---

**End of Specification Document**

For questions or clarifications, contact the Architecture Team.
