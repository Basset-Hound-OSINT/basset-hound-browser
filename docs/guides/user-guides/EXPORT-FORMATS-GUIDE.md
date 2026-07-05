# Export Formats Guide

## Overview

The Basset Hound Browser provides 8 WebSocket commands for exporting captured data in multiple formats. This guide covers all supported export formats, their use cases, and best practices.

## Supported Export Formats

### 1. JSON Export (`export_format_json`)

**Best for:** Structured data, programmatic processing, API integration

**Features:**
- Full data structure preservation
- Optional prettification
- Field filtering (include/exclude)
- File or in-memory export

**Example:**
```json
POST /export_format_json

{
  "id": 1,
  "command": "export_format_json",
  "data_type": "network_logs",
  "prettify": true,
  "include_fields": ["url", "statusCode", "duration"]
}

Response:
{
  "success": true,
  "data": {
    "networkLogs": [
      {
        "url": "https://example.com",
        "statusCode": 200,
        "duration": 150
      }
    ]
  },
  "stats": {
    "dataType": "network_logs",
    "size": 1234,
    "exported_at": "2026-06-20T10:00:00Z"
  }
}
```

**Parameters:**
- `data_type` (string): `network_logs`, `session_data`, `all` (default: `all`)
- `filters` (object): Filter criteria
- `prettify` (boolean): Pretty-print JSON (default: false)
- `output_path` (string): Optional file path
- `include_fields` (array): Specific fields to include
- `exclude_fields` (array): Fields to exclude

---

### 2. CSV Export (`export_format_csv`)

**Best for:** Spreadsheet analysis, reporting, data warehouses

**Features:**
- Configurable delimiters
- Automatic header generation
- Field flattening for nested data
- Column selection

**Example:**
```json
POST /export_format_csv

{
  "id": 2,
  "command": "export_format_csv",
  "data_type": "network_logs",
  "delimiter": ",",
  "columns": ["url", "method", "statusCode"]
}

Response:
{
  "success": true,
  "data": "url,method,statusCode\nhttps://example.com,GET,200\n...",
  "stats": {
    "rowCount": 150,
    "columnCount": 3,
    "size": 8456,
    "exported_at": "2026-06-20T10:00:00Z"
  }
}
```

**Parameters:**
- `data_type` (string): Type of data to export
- `filters` (object): Filter criteria
- `delimiter` (string): CSV delimiter (default: comma)
- `include_headers` (boolean): Include header row (default: true)
- `output_path` (string): Optional file path
- `columns` (array): Specific columns to include

**Supported Delimiters:**
- `,` - Comma (default, Excel compatible)
- `;` - Semicolon (European standard)
- `\t` - Tab
- `|` - Pipe

---

### 3. HAR Export (`export_format_har`)

**Best for:** Web developer tools integration, network analysis, performance debugging

**Features:**
- HTTP Archive 1.0 format compliance
- Compatible with Chrome DevTools, Firefox, Fiddler
- Detailed timing information
- Request/response metadata

**Example:**
```json
POST /export_format_har

{
  "id": 3,
  "command": "export_format_har",
  "title": "Example.com Capture"
}

Response HAR structure:
{
  "log": {
    "version": "1.0",
    "creator": {
      "name": "Basset Hound Browser",
      "version": "1.0.0"
    },
    "entries": [
      {
        "startedDateTime": "2026-06-20T10:00:00Z",
        "time": 150,
        "request": {
          "method": "GET",
          "url": "https://example.com",
          "httpVersion": "HTTP/1.1",
          "headers": [],
          "queryString": [],
          "cookies": [],
          "headersSize": 0,
          "bodySize": 0
        },
        "response": {
          "status": 200,
          "statusText": "OK",
          "headers": [],
          "content": {
            "size": 5000,
            "mimeType": "text/html"
          }
        },
        "timings": {
          "wait": 150
        }
      }
    ]
  }
}
```

**Tools that accept HAR:**
- Chrome DevTools (Network tab → Save as HAR)
- Firefox Network Monitor
- Fiddler
- WebPageTest
- HAR Viewer online tools

---

### 4. WARC Export (`export_format_warc`)

**Best for:** Web archival, long-term preservation, research

**Features:**
- WARC 1.0 standard compliance
- Archival-grade format
- Preserves request/response pairs
- Metadata preservation

**Example:**
```
WARC/1.0
WARC-Type: response
WARC-Date: 20260620T100000Z
WARC-Record-ID: <urn:uuid:12345678-1234-5678-1234-567812345678>
WARC-Content-Length: 1024

[Response content]

WARC/1.0
[Next record...]
```

**Parameters:**
- `filters` (object): Filter criteria
- `output_path` (string): Required for WARC (file-based format)
- `creation_date` (string): WARC creation date (ISO 8601)

**Use Cases:**
- Library of Congress-style web archival
- Research data preservation
- Long-term evidence storage
- Compliance/legal requirements

---

### 5. SQLite Export (`export_format_sqlite`)

**Best for:** Local analysis, querying, relational operations

**Features:**
- Structured database format
- Multiple tables (network_logs, sessions, metadata)
- Queryable with SQL
- Index support

**Example:**
```json
POST /export_format_sqlite

{
  "id": 5,
  "command": "export_format_sqlite",
  "output_path": "/exports/capture.db",
  "include_tables": ["network_logs", "sessions", "metadata"]
}

Response:
{
  "success": true,
  "file_path": "/exports/capture.db",
  "stats": {
    "format": "SQLite",
    "recordsInserted": 250,
    "size": 102400,
    "exported_at": "2026-06-20T10:00:00Z"
  }
}
```

**Database Schema:**
```sql
CREATE TABLE network_logs (
  id INTEGER PRIMARY KEY,
  url TEXT,
  method TEXT,
  status_code INTEGER,
  timestamp TEXT,
  duration INTEGER,
  resource_type TEXT,
  content_length INTEGER,
  cached BOOLEAN
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  session_id TEXT UNIQUE,
  created_at TEXT,
  user_agent TEXT,
  cookies_count INTEGER
);

CREATE TABLE metadata (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE,
  value TEXT,
  timestamp TEXT
);
```

**Query Examples:**
```sql
-- Get all successful requests
SELECT url, duration FROM network_logs WHERE status_code = 200;

-- Average response time by resource type
SELECT resource_type, AVG(duration) FROM network_logs GROUP BY resource_type;

-- Find slow requests
SELECT url, duration FROM network_logs WHERE duration > 1000 ORDER BY duration DESC;
```

---

### 6. Markdown Export (`export_format_markdown`)

**Best for:** Human-readable reports, documentation, dashboards

**Features:**
- Multiple sections (summary, network, session, timeline)
- Tables for network data
- Formatted headers and lists
- Timeline visualization

**Example:**
```json
POST /export_format_markdown

{
  "id": 6,
  "command": "export_format_markdown",
  "title": "Capture Report",
  "sections": ["summary", "network", "session", "timeline"]
}

Response Markdown:
# Capture Report

Generated: 2026-06-20T10:00:00Z

## Summary

- **Export Date:** 2026-06-20T10:00:00Z
- **Creator:** Basset Hound Browser
- **Format Version:** 1.0

## Network Requests

| URL | Method | Status | Duration (ms) | Size |
|-----|--------|--------|---------------|------|
| https://example.com | GET | 200 | 150 | 5000 |
| https://api.example.com/data | POST | 201 | 200 | 1500 |

## Session Information

- **Session Start:** 2026-06-20T10:00:00Z
- **Browser:** Basset Hound
- **User Agent:** Custom

## Timeline

- **2026-06-20T10:00:00Z** - [200] https://example.com
- **2026-06-20T10:00:01Z** - [201] https://api.example.com/data
```

**Sections:**
- `summary` - Export metadata and statistics
- `network` - Network requests table
- `session` - Session information
- `timeline` - Chronological request timeline

---

### 7. XML Export (`export_format_xml`)

**Best for:** Legacy system integration, SOAP/XML APIs, validation

**Features:**
- XML 1.0 compliance
- Proper character escaping
- Nested structure support
- Custom root elements

**Example:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<basset_hound_export>
  <metadata>
    <exported_at>2026-06-20T10:00:00Z</exported_at>
    <format_version>1.0</format_version>
    <creator>Basset Hound Browser</creator>
  </metadata>
  <network_logs>
    <log>
      <url>https://example.com</url>
      <method>GET</method>
      <status>200</status>
      <duration>150</duration>
    </log>
  </network_logs>
</basset_hound_export>
```

**Parameters:**
- `data_type` (string): `network_logs`, `session_data`, `all`
- `filters` (object): Filter criteria
- `output_path` (string): Optional file path
- `root_element` (string): Root element name (default: basset_hound_export)

---

### 8. Custom Format (`export_format_custom`)

**Best for:** Specialized requirements, template-based generation

**Features:**
- Template-based output
- Variable substitution
- Formatting options
- Flexible content generation

**Example:**
```json
POST /export_format_custom

{
  "id": 8,
  "command": "export_format_custom",
  "template": "Export Summary\n\nTotal Requests: {{total}}\nFailed: {{failed}}\nSuccessful: {{successful}}\nAverage Duration: {{avg_duration}}ms",
  "data": {
    "total": "250",
    "failed": "5",
    "successful": "245",
    "avg_duration": "125"
  },
  "options": {
    "trim": true
  }
}

Response:
{
  "success": true,
  "data": "Export Summary\n\nTotal Requests: 250\nFailed: 5\nSuccessful: 245\nAverage Duration: 125ms",
  "stats": {
    "format": "Custom",
    "size": 123,
    "exported_at": "2026-06-20T10:00:00Z"
  }
}
```

**Template Variables:**
Use `{{variable_name}}` syntax for substitution

**Formatting Options:**
- `trim` (boolean): Remove leading/trailing whitespace
- `uppercase` (boolean): Convert to uppercase
- `lowercase` (boolean): Convert to lowercase

**Example Templates:**

CSV Header Template:
```
"url,method,status,duration\n{{csv_rows}}"
```

Report Template:
```
"Report: {{title}}\n\nGenerated: {{date}}\n\nTotal: {{count}}"
```

---

## Format Conversion

The FormatConverter utility supports bidirectional conversion between formats:

```javascript
const { FormatConverter } = require('./extraction/format-converters');

const converter = new FormatConverter();

// Convert JSON array to CSV
const csvData = converter.convert(jsonData, 'json', 'csv');

// Convert CSV to JSON
const jsonData = converter.convert(csvData, 'csv', 'json');

// Convert JSON to HAR
const harData = converter.convert(jsonData, 'json', 'har');

// Check if conversion is supported
if (converter.isConversionSupported('json', 'csv')) {
  // Safe to convert
}

// List all supported formats
const formats = converter.listSupportedFormats();
```

### Supported Conversions

| From | To | Status |
|------|-----|--------|
| JSON | CSV | ✓ |
| JSON | HAR | ✓ |
| JSON | XML | ✓ |
| JSON | Markdown | ✓ |
| CSV | JSON | ✓ |
| HAR | JSON | ✓ |
| HAR | CSV | ✓ |
| XML | JSON | ✓ |

---

## Best Practices

### 1. Choose the Right Format

- **Analysis & Reporting:** Markdown, CSV, SQLite
- **Web Development:** HAR, JSON
- **Archival:** WARC, SQLite
- **Integration:** JSON, XML
- **Custom Needs:** Custom format with templates

### 2. File Path Handling

```javascript
// Automatic directory creation
{
  "command": "export_format_json",
  "output_path": "/exports/2026/06/20/capture.json"
  // Parent directories created automatically
}
```

### 3. Large Exports

For large datasets:
- Use SQLite for queryability
- Use CSV for streaming analysis
- Use HAR for limited size (network requests only)
- Implement filtering for subset exports

### 4. Filtering Data

```javascript
{
  "command": "export_format_json",
  "data_type": "network_logs",
  "include_fields": ["url", "statusCode", "duration"],
  "exclude_fields": ["internalData"]
}
```

### 5. Performance Optimization

```javascript
// Prettify only when needed
{
  "command": "export_format_json",
  "prettify": false  // Default, saves CPU and space
}

// For large exports, use file output
{
  "command": "export_format_csv",
  "output_path": "/exports/large_export.csv"  // Streamed to file
}
```

### 6. Timestamp Handling

All exports include `exported_at` timestamp in UTC/ISO 8601 format:
```
"exported_at": "2026-06-20T10:00:00Z"
```

### 7. Size Tracking

Check statistics for actual export size:
```javascript
{
  "stats": {
    "size": 1234567,  // Bytes
    "dataType": "network_logs",
    "exported_at": "2026-06-20T10:00:00Z"
  }
}
```

---

## Examples

### Example 1: Create Spreadsheet Analysis

```javascript
// Export as CSV for Excel
const result = await fetch('ws://localhost:8765', {
  command: 'export_format_csv',
  data_type: 'network_logs',
  columns: ['url', 'method', 'statusCode', 'duration', 'contentLength'],
  output_path: '/reports/network_analysis.csv'
});

// Then open in Excel, Google Sheets, etc.
```

### Example 2: Generate Report

```javascript
// Create human-readable report
const result = await fetch('ws://localhost:8765', {
  command: 'export_format_markdown',
  title: 'Capture Report - 2026-06-20',
  sections: ['summary', 'network', 'timeline'],
  output_path: '/reports/capture_report.md'
});

// View in GitHub, document viewers, or convert to PDF
```

### Example 3: Query Data

```javascript
// Export to SQLite for analysis
const result = await fetch('ws://localhost:8765', {
  command: 'export_format_sqlite',
  output_path: '/data/capture.db',
  include_tables: ['network_logs', 'sessions']
});

// Query with SQL
// sqlite3 capture.db
// SELECT url, AVG(duration) as avg_ms FROM network_logs GROUP BY url;
```

### Example 4: Archive Web Capture

```javascript
// Create archival export
const result = await fetch('ws://localhost:8765', {
  command: 'export_format_warc',
  output_path: '/archives/2026-06-20-capture.warc',
  creation_date: '2026-06-20T10:00:00Z'
});

// Can be opened with:
// - Wayback Machine
// - WARC viewers
// - Archive utilities
```

---

## Troubleshooting

### Export File Not Created

**Problem:** File path returned but no file exists

**Solution:**
```javascript
// Check directory permissions
// Ensure output_path is absolute
const path = require('path');
const fullPath = path.resolve('/exports/file.json');
```

### Large Export Timeout

**Problem:** Large exports timing out

**Solution:**
```javascript
// Use file output (async)
{
  "command": "export_format_json",
  "output_path": "/large_export.json"  // Non-blocking
}

// Or filter data
{
  "command": "export_format_csv",
  "filters": { "statusCode": 200 }  // Only successful requests
}
```

### Encoding Issues

**Problem:** Special characters appear corrupted

**Solution:**
- All exports use UTF-8 encoding by default
- JSON, XML, and CSV proper escape special characters
- HAR and WARC are binary-safe

### Memory Usage

**Problem:** Large in-memory export uses too much RAM

**Solution:**
```javascript
// Use file output instead
{
  "command": "export_format_csv",
  "output_path": "/exports/file.csv"  // Streamed, not buffered
}
```

---

## Integration Examples

### Integration with Python

```python
import websocket
import json

ws = websocket.create_connection("ws://localhost:8765")

# Export as JSON
request = {
    "id": 1,
    "command": "export_format_json",
    "data_type": "network_logs"
}

ws.send(json.dumps(request))
response = json.loads(ws.recv())

print(response['data'])
```

### Integration with Node.js

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    command: 'export_format_csv',
    data_type: 'network_logs',
    output_path: '/exports/network.csv'
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log(response.stats);
});
```

### Integration with Shell Script

```bash
#!/bin/bash

# Export network logs as CSV
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  ws://localhost:8765 \
  << EOF
{
  "id": 1,
  "command": "export_format_csv",
  "data_type": "network_logs",
  "output_path": "/exports/$(date +%Y%m%d).csv"
}
EOF
```

---

## API Reference

### Response Structure

All export commands return:

```json
{
  "success": boolean,
  "data": "exported data (if not written to file)",
  "file_path": "path/to/file (if output_path specified)",
  "stats": {
    "format": "format name",
    "size": number (bytes),
    "dataType": "type exported",
    "rowCount": number (CSV only),
    "columnCount": number (CSV only),
    "entryCount": number (HAR only),
    "recordCount": number (WARC only),
    "recordsInserted": number (SQLite only),
    "sections": number (Markdown only),
    "exported_at": "ISO 8601 timestamp"
  },
  "error": "error message (if success === false)"
}
```

### Common Parameters

All export commands support:

- `output_path` (string): Write to file
- `filters` (object): Filter exported data
- `timestamp` (string): Export timestamp (read-only)

---

## Performance Characteristics

| Format | Export Speed | File Size | Query Speed | Best For |
|--------|--------------|-----------|-------------|----------|
| JSON | Fast | Large | Medium | API integration |
| CSV | Fast | Medium | Fast | Analysis |
| HAR | Medium | Large | Slow | Web dev tools |
| WARC | Slow | Huge | Slow | Archival |
| SQLite | Medium | Medium | Fastest | Local analysis |
| Markdown | Fast | Medium | N/A | Reporting |
| XML | Medium | Large | Medium | Legacy systems |
| Custom | Variable | Variable | N/A | Specialized |

---

## Version History

- **v1.0.0** (2026-06-20): Initial release with 8 export formats
  - JSON, CSV, HAR, WARC, SQLite, Markdown, XML, Custom
  - Format conversion utilities
  - WebSocket API integration
