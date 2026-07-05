# Advanced Raw HTML Capture - API Reference

## Overview

The Advanced Raw HTML Capture feature provides 4 specialized WebSocket commands for capturing and analyzing HTML content with different levels of detail and formatting. This feature is designed for forensic analysis, content verification, and change tracking.

**Feature Area:** Data Extraction - Category 1  
**Version:** 12.8.0+  
**Commands:** 4 new WebSocket commands  
**Tests:** 74 unit tests, 50+ integration tests  

## Commands

### 1. `export_html_with_metadata`

Captures HTML with comprehensive metadata extraction including all meta tags, timing information, and resource discovery.

**Parameters:**
```javascript
{
  html: string (required),           // HTML content to capture
  url: string (optional),             // Page URL for context/resolution
  headers: object (optional),         // HTTP response headers
  compress: boolean (optional),       // Compress HTML with gzip (default: false)
  includeFormatted: boolean (optional) // Include formatted version (default: false)
}
```

**Response:**
```javascript
{
  success: boolean,
  snapshotId: string,                 // Unique SHA256-based ID
  html: string,                       // Original HTML
  metadata: {
    url: string,
    timestamp: string,                // ISO 8601 format
    charset: string,
    contentLength: number,
    contentType: string,
    serverHeader: string,
    cacheControl: string,
    lastModified: string|null,
    etag: string|null,
    expires: string|null,
    language: string,                 // HTML lang attribute
    doctype: string,
    metaTags: [                       // All meta tags
      { name: string, content: string },
      { property: string, content: string }
    ],
    resources: {
      scripts: string[],              // Script URLs
      stylesheets: string[],          // Stylesheet URLs
      images: string[],               // Image URLs
      iframes: string[],              // IFrame URLs
      videos: string[],               // Video URLs
      audio: string[]                 // Audio URLs
    },
    timing: {
      capturedAt: number,             // Timestamp ms
      htmlSize: number                // Byte size
    }
  },
  formatted: string|null,             // Formatted HTML if requested
  size: {
    raw: number,                      // Original size in bytes
    compressed: number,               // Compressed size if requested
    compressionRatio: number          // Compression percentage
  },
  processingTime: number              // Execution time in ms
}
```

**Example:**
```javascript
// With metadata extraction and compression
client.send('export_html_with_metadata', {
  html: '<html>...</html>',
  url: 'https://example.com/page',
  headers: {
    'content-type': 'text/html; charset=UTF-8',
    'server': 'Apache/2.4.41'
  },
  compress: true,
  includeFormatted: true
});
```

**Use Cases:**
- Extract all metadata from a page for analysis
- Discover all resources (scripts, images, stylesheets)
- Detect language and encoding information
- Compress large HTML for efficient transmission
- Analyze page structure and metadata composition

---

### 2. `export_html_formatted`

Returns pretty-printed HTML with proper indentation and formatting for readability and debugging.

**Parameters:**
```javascript
{
  html: string (required),            // HTML content to format
  url: string (optional),             // Page URL for tracking
  indentSize: number (optional),      // Spaces per indent level (default: 2)
  includeComments: boolean (optional) // Include HTML comments (default: true)
}
```

**Response:**
```javascript
{
  success: boolean,
  snapshotId: string,                 // Unique ID for this snapshot
  url: string,
  html: string,                       // Formatted HTML
  metadata: {
    originalSize: number,             // Size before formatting
    formattedSize: number,            // Size after formatting
    indentSize: number,               // Indent size used
    includeComments: boolean
  },
  processingTime: number              // Execution time in ms
}
```

**Example:**
```javascript
// Format HTML with 4-space indentation
client.send('export_html_formatted', {
  html: '<html><body><h1>Title</h1></body></html>',
  url: 'https://example.com/page',
  indentSize: 4,
  includeComments: true
});

// Returns formatted version:
// <html>
//     <body>
//         <h1>
//             Title
//         </h1>
//     </body>
// </html>
```

**Use Cases:**
- Debugging HTML structure
- Code review and analysis
- Pretty-printing minified HTML
- Human-readable output for logs
- Documentation generation

---

### 3. `export_html_raw`

Captures exact raw HTML with cryptographic hashing and complete response metadata for forensic analysis.

**Parameters:**
```javascript
{
  html: string (required),            // HTML content
  url: string (optional),             // Page URL
  statusCode: number (optional),      // HTTP status code (default: 200)
  statusText: string (optional),      // HTTP status text (default: 'OK')
  headers: object (optional),         // HTTP response headers
  fetchStart: number (optional),      // Fetch start timestamp (ms)
  fetchEnd: number (optional),        // Fetch end timestamp (ms)
  duration: number (optional)         // Total fetch duration (ms)
}
```

**Response:**
```javascript
{
  success: boolean,
  snapshotId: string,                 // Unique ID
  url: string,
  html: string,                       // Exact raw HTML
  bytes: {
    raw: number,                      // Size in bytes
    sha256: string,                   // SHA-256 hash (hex)
    md5: string                       // MD5 hash (hex)
  },
  response: {
    statusCode: number,
    statusText: string,
    headers: object,
    timing: {
      fetchStart: number,
      fetchEnd: number,
      duration: number
    }
  },
  processingTime: number              // Execution time in ms
}
```

**Example:**
```javascript
// Capture with full response info
client.send('export_html_raw', {
  html: '<html>...</html>',
  url: 'https://example.com/page',
  statusCode: 200,
  statusText: 'OK',
  headers: { 'content-type': 'text/html' },
  fetchStart: 1704067200000,
  fetchEnd: 1704067202500,
  duration: 2500
});

// Returns:
// {
//   snapshotId: 'a1b2c3d4e5f6g7h8',
//   html: '<!DOCTYPE html>...',
//   bytes: {
//     raw: 12345,
//     sha256: 'abc123def456...',
//     md5: 'xyz789...'
//   }
// }
```

**Use Cases:**
- Forensic HTML analysis
- Content verification and validation
- Integrity checking (SHA256/MD5)
- Response timing analysis
- Audit trail creation
- Content storage with cryptographic proof

---

### 4. `export_html_diff`

Captures HTML with automatic change tracking against previous snapshots for detecting modifications.

**Parameters:**
```javascript
{
  html: string (required),            // Current HTML content
  url: string (required),             // Page URL (used as key for history)
  previousSnapshotId: string (optional), // Compare against specific snapshot
  includeFullHtml: boolean (optional) // Include full HTML in response (default: false)
}
```

**Response:**
```javascript
{
  success: boolean,
  snapshotId: string,                 // Current snapshot ID
  url: string,
  timestamp: string,                  // ISO 8601 timestamp
  current: {
    size: number,                     // Current size in bytes
    hash: string                      // SHA-256 hash of current HTML
  },
  previous: {                         // Null if first capture
    snapshotId: string,
    size: number,
    hash: string,
    timestamp: string,
    ageSinceCapture: number           // ms since capture
  } | null,
  changes: {
    sizeChanged: boolean,
    sizeChange: number,               // Bytes difference (can be negative)
    sizeChangePercent: string,        // Percentage change
    hashChanged: boolean              // Content changed
  },
  history: [                          // Last 10 snapshots
    {
      snapshotId: string,
      timestamp: string,
      size: number,
      hash: string
    }
  ],
  html: string | null,                // Full HTML if requested
  processingTime: number              // Execution time in ms
}
```

**Example:**
```javascript
// First capture - establishes baseline
const first = await client.send('export_html_diff', {
  html: '<html><body>Original content</body></html>',
  url: 'https://example.com/monitored-page'
});
// Returns: previous: null

// Second capture - automatic comparison
const second = await client.send('export_html_diff', {
  html: '<html><body>Modified content</body></html>',
  url: 'https://example.com/monitored-page'
});
// Returns:
// {
//   changes: {
//     sizeChanged: true,
//     sizeChange: 8,
//     sizeChangePercent: '3.85',
//     hashChanged: true
//   },
//   previous: { snapshotId: 'abc123...', size: 48, ... }
// }

// Compare against specific previous snapshot
const comparison = await client.send('export_html_diff', {
  html: '<html><body>New content</body></html>',
  url: 'https://example.com/monitored-page',
  previousSnapshotId: 'abc123...',  // Compare against specific version
  includeFullHtml: true
});
```

**Use Cases:**
- Monitor page changes over time
- Detect content modifications
- Track version history automatically
- Implement change alerts/notifications
- Archive and compare page versions
- Audit content modifications
- A/B testing validation

---

## Utility Commands

### `get_capture_stats`

Get statistics about capture operations.

**Parameters:** None

**Response:**
```javascript
{
  success: boolean,
  stats: {
    totalCaptures: number,
    metadataCaptures: number,
    formattedCaptures: number,
    rawCaptures: number,
    diffCaptures: number,
    totalBytesProcessed: number,
    snapshotCount: number,            // Total snapshots stored
    trackedUrls: number               // Unique URLs tracked
  }
}
```

### `clear_capture_snapshots`

Clear stored snapshots for memory management.

**Parameters:**
```javascript
{
  url: string (optional)              // URL to clear. If omitted, clears all.
}
```

**Response:**
```javascript
{
  success: boolean,
  message: string
}
```

---

## Features

### Snapshot ID Generation
- SHA256-based unique identification
- Deterministic (same HTML = same ID)
- 16-character hex string format
- Used for deduplication and comparison

### Resource Resolution
- Automatic URL resolution (relative → absolute)
- Base URL context support
- Protocol-relative URL handling
- Special URL preservation (data:, javascript:, mailto:, etc.)

### Metadata Extraction
- All meta tags (name, property, http-equiv)
- Open Graph tags detection
- Twitter Card detection
- Language and charset detection
- DOCTYPE detection
- Cache control and expiration info
- Complete resource discovery

### HTML Formatting
- Configurable indentation (default: 2 spaces)
- Proper tag nesting visualization
- Self-closing tag handling
- Text content preservation
- Comment inclusion option

### Cryptographic Hashing
- SHA-256 for content integrity
- MD5 for compatibility
- Used in raw capture and diff tracking

### Change Tracking
- Automatic snapshot storage (max 100 per URL)
- Size change detection
- Hash-based modification detection
- Historical comparison
- Percentage change calculation

### Compression Support
- GZIP compression option
- Compression ratio calculation
- Base64 encoding for transmission
- Large payload optimization

---

## Response Codes & Errors

**Success Codes:**
- `200`: Operation completed successfully

**Error Codes:**
- `INVALID_HTML_PARAM`: HTML parameter missing or not a string
- `INVALID_URL_PARAM`: URL parameter missing for diff tracking
- `EXPORT_METADATA_ERROR`: Metadata extraction failed
- `EXPORT_FORMATTED_ERROR`: HTML formatting failed
- `EXPORT_RAW_ERROR`: Raw capture failed
- `EXPORT_DIFF_ERROR`: Diff capture failed
- `GET_STATS_ERROR`: Failed to retrieve statistics
- `CLEAR_SNAPSHOTS_ERROR`: Failed to clear snapshots

---

## Performance Characteristics

| Operation | Time | Memory | Notes |
|-----------|------|--------|-------|
| Metadata extraction | <100ms | ~2-5MB | Depends on HTML size |
| HTML formatting | <50ms | ~1-3MB | Scales with HTML size |
| Raw capture | <10ms | ~1MB | Just hashing/storing |
| Diff capture | <15ms | ~1MB | Minimal processing |
| Compression | 50-200ms | ~2-5MB | GZIP dependent |
| Snapshot storage | <5ms | ~10KB | Per snapshot |

---

## Size Limits

- **Maximum HTML size:** Depends on available memory
- **Snapshot history:** 100 per URL (configurable)
- **Meta tags:** No limit (all extracted)
- **Resources:** All discovered (no limit)

---

## Integration Examples

### Complete Page Monitoring
```javascript
// Store baseline
const baseline = await client.send('export_html_with_metadata', {
  html: initialPageHtml,
  url: 'https://example.com',
  compress: true
});

// Monitor for changes
const changes = await client.send('export_html_diff', {
  html: currentPageHtml,
  url: 'https://example.com',
  includeFullHtml: true
});

if (changes.changes.hashChanged) {
  console.log('Page changed by', changes.changes.sizeChangePercent, '%');
}
```

### Forensic Analysis
```javascript
// Capture complete forensic data
const forensic = await client.send('export_html_raw', {
  html: responseHtml,
  url: 'https://example.com',
  statusCode: 200,
  headers: responseHeaders,
  fetchStart: startTime,
  fetchEnd: endTime,
  duration: endTime - startTime
});

// Verify integrity
console.log('Content Hash:', forensic.bytes.sha256);
console.log('Response Time:', forensic.response.timing.duration, 'ms');
```

### Resource Discovery
```javascript
// Discover all resources
const analysis = await client.send('export_html_with_metadata', {
  html: pageHtml,
  url: 'https://example.com'
});

console.log('Scripts:', analysis.metadata.resources.scripts);
console.log('Stylesheets:', analysis.metadata.resources.stylesheets);
console.log('Images:', analysis.metadata.resources.images);
console.log('IFrames:', analysis.metadata.resources.iframes);
```

### Code Review
```javascript
// Pretty-print for review
const formatted = await client.send('export_html_formatted', {
  html: minifiedHtml,
  url: 'https://example.com',
  indentSize: 4
});

// Save to file for review
fs.writeFileSync('page-formatted.html', formatted.html);
```

---

## Version History

### v12.8.0 (Initial Release)
- Added all 4 HTML capture commands
- Snapshot management system
- Change tracking functionality
- Comprehensive metadata extraction
- Resource discovery
- Cryptographic hashing
- HTML formatting
- GZIP compression support

---

## See Also

- [WebSocket API Reference](./API-REFERENCE.md)
- [Extraction Module](../extraction/index.js)
- [HtmlCaptureManager](../extraction/html-capture-manager.js)
