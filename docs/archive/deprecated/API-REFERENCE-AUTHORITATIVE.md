# Basset Hound Browser - Authoritative API Reference

**Version**: 12.8.0 (Production Ready)  
**Status**: Phase 1 Forensic Commands Complete - 50 new commands documented  
**Protocol**: WebSocket (JSON messages)  
**Default Port**: 8765  
**Last Updated**: June 21, 2026  
**Total Commands**: 140+ documented across 16 categories

---

## CRITICAL NOTICE: OPEN ACCESS - NO AUTHENTICATION

**This is a DEVELOPMENT TOOL.** All commands are OPEN and UNRESTRICTED. No authentication or authorization is enforced. This documentation is for authorized developers only.

---

## Table of Contents

1. [Security Considerations](#security-considerations)
2. [Connection & Protocol](#connection--protocol)
3. [Request Size Limits](#request-size-limits)
4. [Rate Limiting](#rate-limiting)
5. [Command Categories](#command-categories)
6. [Command Reference by Category](#command-reference-by-category)
7. [Error Handling](#error-handling)
8. [Quick Reference Card](#quick-reference-card)
9. [Command Index](#command-index)

---

## Security Considerations

Basset Hound Browser implements **four critical security measures** to protect the WebSocket API:

### 1. Request Size Validation
All requests are validated to prevent memory exhaustion and DoS attacks. See [Request Size Limits](#request-size-limits) below.

### 2. Rate Limiting (Per-Command)
Requests are rate-limited per client and command to prevent flooding attacks. See [Rate Limiting](#rate-limiting) below.

### 3. Path Traversal Prevention
All file system operations validate paths to prevent directory traversal attacks (`../` escape sequences). Allowed directories are whitelisted.

### 4. Connection Security
WebSocket connections support TLS/SSL encryption via `wss://` protocol and connection validation at the transport layer.

**For complete security documentation including configuration options, deployment hardening, and troubleshooting, see [SECURITY.md](../../SECURITY.md).**

---

## Request Size Limits

The API enforces request size limits to prevent denial-of-service attacks through oversized payloads:

| Category | Default Limit | Environment Variable |
|----------|---------------|----------------------|
| Global maximum | 100 MB | `REQUEST_SIZE_LIMIT_GLOBAL` |
| Screenshot commands | 100 MB | `REQUEST_SIZE_LIMIT_SCREENSHOT` |
| Capture commands | 100 MB | `REQUEST_SIZE_LIMIT_CAPTURE` |
| Extraction commands | 50 MB | `REQUEST_SIZE_LIMIT_EXTRACTION` |
| Analysis commands | 50 MB | `REQUEST_SIZE_LIMIT_ANALYSIS` |
| All other commands | 10 MB | `REQUEST_SIZE_LIMIT_DEFAULT` |

**Response on size violation** (HTTP 413 equivalent):
```json
{
  "success": false,
  "error": "Request payload exceeds size limit",
  "code": "SIZE_EXCEEDED",
  "details": {
    "limit": 10485760,
    "received": 15728640,
    "category": "default"
  }
}
```

**Configuration example**:
```bash
# Reduce all limits for stricter control
export REQUEST_SIZE_LIMIT_GLOBAL=52428800           # 50 MB
export REQUEST_SIZE_LIMIT_SCREENSHOT=52428800      # 50 MB
export REQUEST_SIZE_LIMIT_DEFAULT=5242880          # 5 MB

# Or in Docker
docker run -e REQUEST_SIZE_LIMIT_GLOBAL=52428800 basset-hound-browser
```

---

## Rate Limiting

The API implements per-command rate limiting using a sliding window algorithm:

### Global Limits (requests per minute)
- **Unauthenticated clients**: 100 req/min (configurable via `RATE_LIMIT_UNAUTHENTICATED`)
- **Authenticated clients**: 1000 req/min (configurable via `RATE_LIMIT_AUTHENTICATED`)

### Per-Command Limits (requests per minute)

| Command | Limit | Reason |
|---------|-------|--------|
| `screenshot` | 5 | CPU/memory intensive |
| `screenshot_viewport` | 5 | I/O heavy |
| `screenshot_element` | 8 | DOM query + render |
| `screenshot_full_page` | 3 | Most resource intensive |
| `execute_script` | 20 | Dangerous operation |
| `navigate` | 15 | Network/parsing cost |
| `create_profile` | 5 | File system operations |
| `get_content` | 100 | Safe read operation |
| `get_url` | 100 | Safe read operation |

### Rate Limit Response

When a client exceeds the rate limit:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "data": {
    "limit": 100,
    "window": "60000ms",
    "remaining": 0,
    "resetAt": 1687345678000,
    "retryAfter": 15000
  }
}
```

### Check Rate Limit Status

The `get_rate_limit_status` command does NOT count against the rate limit:
```javascript
{
  "id": "status-1",
  "command": "get_rate_limit_status"
}

// Response
{
  "success": true,
  "data": {
    "remaining": 47,
    "limit": 100,
    "window": "60000ms",
    "resetAt": 1687345678000
  }
}
```

### Configuration

| Environment Variable | Default | Purpose |
|----------------------|---------|---------|
| `RATE_LIMIT_ENABLED` | true | Enable rate limiting globally |
| `RATE_LIMIT_UNAUTHENTICATED` | 100 | Req/min for unauthenticated |
| `RATE_LIMIT_AUTHENTICATED` | 1000 | Req/min for authenticated |
| `RATE_LIMIT_WINDOW_MS` | 60000 | Sliding window (1 minute) |
| `RATE_LIMIT_BURST_ALLOWANCE` | 10 | Extra requests allowed for spikes |

**Production configuration example**:
```bash
# Tighten limits for production
export RATE_LIMIT_UNAUTHENTICATED=25
export RATE_LIMIT_AUTHENTICATED=250
export RATE_LIMIT_SCREENSHOT=2         # Much stricter for screenshots
export RATE_LIMIT_SCREENSHOT_FULL_PAGE=1

# Or in Docker
docker run \
  -e RATE_LIMIT_UNAUTHENTICATED=25 \
  -e RATE_LIMIT_AUTHENTICATED=250 \
  basset-hound-browser
```

---

## Connection & Protocol

### WebSocket Connection

```
ws://localhost:8765       # Standard connection
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

### Authentication (Optional)

Authentication is **disabled by default** in development mode.

```javascript
// Via query parameter
ws://localhost:8765?token=YOUR_TOKEN

// Via header
Authorization: Bearer YOUR_TOKEN

// Via authenticate command
{ "id": 1, "command": "authenticate", "token": "YOUR_TOKEN" }
```

---

## Command Categories

| Category | Count | Description |
|----------|-------|-------------|
| Evidence Capture | 8 | Screenshot, archive, HAR, DOM, console, cookies, storage capture |
| Network Forensics | 26 | DNS, TLS, WebSocket, HTTP headers, cookie analysis |
| Legal Compliance | 6 | Court-admissible exports, chain of custody, SWGDE reports |
| Evidence Correlation | 5 | Pattern detection, evidence linking, anomaly detection |
| Evidence Packaging | 19 | Package creation, sealing, manifests, compliance reports |
| Extraction Templates | 11 | Custom extraction templates, transforms, validation |
| DOM Snapshots | 7 | DOM tree, attributes, styles, mutations, form state |
| JavaScript/Console | 10 | Console logs, errors, globals, scripts, performance data |
| HTML Capture | 6 | Raw HTML, formatted, diffs, metadata export |
| Export Formats | 8 | CSV, JSON, XML, HAR, WARC, Markdown, SQLite |
| Encrypted Export | 8 | Encryption, key generation, encrypted exports |
| Basic Extraction | 8 | User agents, profiles, credentials, anonymity settings |
| Additional Categories | 40+ | Monitoring, session management, evasion, video recording, etc. |

---

## Command Reference by Category

### 1. EVIDENCE CAPTURE (8 Commands)

**Category File**: `websocket/commands/forensic/evidence/evidence-commands.js`

#### capture_screenshot_evidence
Capture and store a screenshot as forensic evidence.

**Parameters:**
- `imageData` (string/buffer, required): Base64-encoded image or buffer
- `url` (string, required): URL of the page
- `title` (string, optional): Page title
- `fullPage` (boolean, optional): Full page screenshot flag
- `viewport` (object, optional): `{width, height}`
- `annotations` (array, optional): Array of annotation objects
- `capturedBy` (string, optional): Identifier of capture agent

**Response:**
```json
{
  "success": true,
  "evidenceId": "ev_abc123",
  "evidence": {
    "id": "ev_abc123",
    "type": "screenshot",
    "capturedAt": "2026-06-21T10:30:45Z",
    "hash": "sha256:...",
    "size": 245678,
    "url": "https://example.com"
  }
}
```

**Error Codes:**
- `INVALID_IMAGE_DATA`: Image data is invalid or corrupted
- `SIZE_EXCEEDED`: Image exceeds maximum size limit

---

#### capture_page_archive_evidence
Capture complete page archive (HTML, MHTML, WARC, PDF).

**Parameters:**
- `content` (string, required): Archive content
- `format` (string, required): `mhtml|html|warc|pdf`
- `url` (string, required): Page URL
- `title` (string, optional): Page title
- `capturedBy` (string, optional): Capture agent identifier

**Response:**
```json
{
  "success": true,
  "evidenceId": "ev_arc456",
  "evidence": {
    "id": "ev_arc456",
    "type": "page_archive",
    "format": "mhtml",
    "capturedAt": "2026-06-21T10:30:45Z",
    "hash": "sha256:...",
    "size": 1048576
  }
}
```

---

#### capture_har_evidence
Capture network traffic as HAR (HTTP Archive).

**Parameters:**
- `harData` (object, required): HAR format object
- `url` (string, required): Page URL
- `title` (string, optional): Page title
- `capturedBy` (string, optional): Capture agent

**Response:**
```json
{
  "success": true,
  "evidenceId": "ev_har789",
  "evidence": {
    "id": "ev_har789",
    "type": "har",
    "entries": 45,
    "capturedAt": "2026-06-21T10:30:45Z",
    "hash": "sha256:..."
  }
}
```

---

#### capture_dom_evidence
Capture DOM tree snapshot.

**Parameters:**
- `domString` (string, required): Serialized DOM
- `url` (string, required): Page URL
- `includeStyles` (boolean, optional, default: true): Include computed styles
- `capturedBy` (string, optional): Capture agent

**Response:**
```json
{
  "success": true,
  "evidenceId": "ev_dom001",
  "evidence": {
    "id": "ev_dom001",
    "type": "dom_snapshot",
    "elements": 234,
    "capturedAt": "2026-06-21T10:30:45Z",
    "hash": "sha256:..."
  }
}
```

---

#### capture_console_evidence
Capture JavaScript console output.

**Parameters:**
- `logs` (array, required): Console log entries
- `errors` (array, optional): Error entries
- `warnings` (array, optional): Warning entries
- `url` (string, required): Page URL
- `capturedBy` (string, optional): Capture agent

**Response:**
```json
{
  "success": true,
  "evidenceId": "ev_console",
  "evidence": {
    "id": "ev_console",
    "type": "console",
    "logCount": 24,
    "errorCount": 3,
    "capturedAt": "2026-06-21T10:30:45Z"
  }
}
```

---

#### capture_cookies_evidence
Capture all cookies from a page.

**Parameters:**
- `cookies` (array, required): Cookie array
- `url` (string, required): Page URL
- `capturedBy` (string, optional): Capture agent

**Response:**
```json
{
  "success": true,
  "evidenceId": "ev_cookies",
  "evidence": {
    "id": "ev_cookies",
    "type": "cookies",
    "count": 12,
    "capturedAt": "2026-06-21T10:30:45Z",
    "hash": "sha256:..."
  }
}
```

---

#### capture_storage_evidence
Capture localStorage and sessionStorage.

**Parameters:**
- `localStorage` (object, required): localStorage entries
- `sessionStorage` (object, required): sessionStorage entries
- `url` (string, required): Page URL
- `capturedBy` (string, optional): Capture agent

**Response:**
```json
{
  "success": true,
  "evidenceId": "ev_storage",
  "evidence": {
    "id": "ev_storage",
    "type": "storage",
    "localStorageCount": 8,
    "sessionStorageCount": 4,
    "capturedAt": "2026-06-21T10:30:45Z"
  }
}
```

---

#### get_evidence_types
List all supported evidence types.

**Parameters:** (none)

**Response:**
```json
{
  "success": true,
  "types": [
    "screenshot",
    "page_archive",
    "har",
    "dom_snapshot",
    "console",
    "cookies",
    "storage"
  ]
}
```

---

### 2. NETWORK FORENSICS (26 Commands)

**Category File**: `websocket/commands/forensic/network/network-forensics-commands.js`

#### start_network_forensics_capture
Begin capturing network forensic data.

**Parameters:**
- `options` (object, optional):
  - `maxDnsQueries` (number): Max DNS entries to capture
  - `maxCertificates` (number): Max certificates
  - `maxWebSocketConnections` (number): Max WebSocket connections
  - `maxHttpHeaders` (number): Max HTTP header captures
  - `maxCookies` (number): Max cookie captures
  - `enableHashing` (boolean): Generate content hashes
  - `enableTimeline` (boolean): Build event timeline
  - `collectedBy` (string): Collector identifier

**Response:**
```json
{
  "success": true,
  "sessionId": "nf_sess_abc123",
  "timestamp": "2026-06-21T10:30:45Z",
  "message": "Network forensics capture started"
}
```

---

#### stop_network_forensics_capture
Stop network forensics capture.

**Parameters:** (none)

**Response:**
```json
{
  "success": true,
  "sessionId": "nf_sess_abc123",
  "duration": 45000,
  "itemsCaptured": {
    "dnsQueries": 12,
    "tlsCertificates": 3,
    "websocketConnections": 2,
    "httpHeaders": 45,
    "cookies": 8
  },
  "message": "Network forensics capture stopped"
}
```

---

#### get_network_forensics_status
Get current capture status.

**Parameters:** (none)

**Response:**
```json
{
  "success": true,
  "status": {
    "capturing": true,
    "sessionId": "nf_sess_abc123",
    "startedAt": "2026-06-21T10:30:45Z",
    "elapsed": 5000,
    "itemsCaptured": {
      "dnsQueries": 12,
      "tlsCertificates": 3
    }
  }
}
```

---

#### capture_dns_query
Record a DNS query event.

**Parameters:**
- `hostname` (string, required): Domain queried
- `type` (string, optional, default: `A`): Query type (A, AAAA, CNAME, etc.)
- `response` (object, optional): Response data
- `responseTime` (number, optional): Response time in ms
- `status` (string, optional): Query status
- `nameserver` (string, optional): Nameserver used
- `cached` (boolean, optional): Was response cached
- `ttl` (number, optional): Time-to-live
- `answers` (array, optional): Response answers

**Response:**
```json
{
  "success": true,
  "query": {
    "id": "dns_001",
    "hostname": "example.com",
    "type": "A",
    "status": "success",
    "hash": "sha256:..."
  }
}
```

---

#### capture_tls_certificate
Record TLS certificate details.

**Parameters:**
- `hostname` (string, required): Target hostname
- `certificate` (object, required): Certificate data
- `chain` (array, optional): Certificate chain
- `pinning` (object, optional): HPKP pinning info
- `ocsp` (object, optional): OCSP stapling data

**Response:**
```json
{
  "success": true,
  "certificate": {
    "id": "cert_001",
    "hostname": "example.com",
    "subject": "CN=example.com",
    "issuer": "CN=Let's Encrypt",
    "notBefore": "2026-01-15T00:00:00Z",
    "notAfter": "2027-01-15T00:00:00Z",
    "hash": "sha256:..."
  }
}
```

---

#### capture_websocket_connection
Record WebSocket connection details.

**Parameters:**
- `url` (string, required): WebSocket URL
- `protocol` (string, optional): Sub-protocol
- `headers` (object, optional): Connection headers
- `extensions` (array, optional): Negotiated extensions
- `timestamp` (number, optional): Connection timestamp

**Response:**
```json
{
  "success": true,
  "connection": {
    "id": "ws_001",
    "url": "wss://example.com/socket",
    "protocol": "chat",
    "timestamp": "2026-06-21T10:30:45Z",
    "hash": "sha256:..."
  }
}
```

---

#### capture_http_headers
Record HTTP request/response headers.

**Parameters:**
- `url` (string, required): Request URL
- `method` (string, required): HTTP method
- `requestHeaders` (object, required): Request headers
- `responseHeaders` (object, required): Response headers
- `statusCode` (number, required): HTTP status
- `timestamp` (number, optional): Request timestamp

**Response:**
```json
{
  "success": true,
  "headers": {
    "id": "hdr_001",
    "url": "https://example.com",
    "statusCode": 200,
    "requestHeaderCount": 12,
    "responseHeaderCount": 18,
    "timestamp": "2026-06-21T10:30:45Z"
  }
}
```

---

#### capture_cookie
Record individual cookie details.

**Parameters:**
- `name` (string, required): Cookie name
- `value` (string, required): Cookie value
- `domain` (string, required): Cookie domain
- `path` (string, optional): Cookie path
- `secure` (boolean, optional): Secure flag
- `httpOnly` (boolean, optional): HttpOnly flag
- `sameSite` (string, optional): SameSite policy
- `expires` (string, optional): Expiration time
- `timestamp` (number, optional): Capture timestamp

**Response:**
```json
{
  "success": true,
  "cookie": {
    "id": "cook_001",
    "name": "sessionId",
    "domain": ".example.com",
    "secure": true,
    "httpOnly": true,
    "timestamp": "2026-06-21T10:30:45Z",
    "hash": "sha256:..."
  }
}
```

---

#### capture_performance_metric
Record performance metrics.

**Parameters:**
- `url` (string, required): Page URL
- `navigationStart` (number, optional): Start time
- `domContentLoaded` (number, optional): DCL time
- `loadComplete` (number, optional): Load complete time
- `metrics` (object, optional): Custom metrics
- `timestamp` (number, optional): Capture time

**Response:**
```json
{
  "success": true,
  "metric": {
    "id": "perf_001",
    "url": "https://example.com",
    "domContentLoaded": 1234,
    "loadComplete": 2345,
    "timestamp": "2026-06-21T10:30:45Z"
  }
}
```

---

#### get_cookies
Retrieve all captured cookies.

**Parameters:**
- `domain` (string, optional): Filter by domain
- `limit` (number, optional): Result limit
- `offset` (number, optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "cookies": [...],
  "total": 45,
  "limit": 50,
  "offset": 0
}
```

---

#### get_dns_queries
Retrieve all captured DNS queries.

**Parameters:**
- `hostname` (string, optional): Filter by hostname
- `limit` (number, optional): Result limit

**Response:**
```json
{
  "success": true,
  "queries": [...],
  "total": 34,
  "limit": 50
}
```

---

#### get_tls_certificates
Retrieve all captured TLS certificates.

**Parameters:**
- `hostname` (string, optional): Filter by hostname
- `limit` (number, optional): Result limit

**Response:**
```json
{
  "success": true,
  "certificates": [...],
  "total": 8,
  "limit": 50
}
```

---

#### get_websocket_connections
Retrieve all WebSocket connections.

**Parameters:**
- `url` (string, optional): Filter by URL pattern
- `limit` (number, optional): Result limit

**Response:**
```json
{
  "success": true,
  "connections": [...],
  "total": 3,
  "limit": 50
}
```

---

#### get_http_headers
Retrieve captured HTTP headers.

**Parameters:**
- `url` (string, optional): Filter by URL
- `method` (string, optional): Filter by HTTP method
- `limit` (number, optional): Result limit

**Response:**
```json
{
  "success": true,
  "headers": [...],
  "total": 45,
  "limit": 50
}
```

---

#### get_performance_metrics
Retrieve performance metrics.

**Parameters:**
- `url` (string, optional): Filter by URL
- `limit` (number, optional): Result limit

**Response:**
```json
{
  "success": true,
  "metrics": [...],
  "total": 12,
  "limit": 50
}
```

---

#### get_network_forensics_stats
Get aggregate forensics statistics.

**Parameters:** (none)

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalDnsQueries": 45,
    "totalCertificates": 12,
    "totalWebSocketConnections": 5,
    "totalHttpHeaders": 234,
    "totalCookies": 67,
    "totalMetrics": 89,
    "captureSize": 2097152
  }
}
```

---

#### analyze_dns_queries
Perform statistical analysis on DNS queries.

**Parameters:**
- `groupBy` (string, optional): Group by `domain|type|status`
- `analyze` (string, optional): `frequency|patterns|anomalies`

**Response:**
```json
{
  "success": true,
  "analysis": {
    "uniqueDomains": 23,
    "queryFrequency": {...},
    "anomalies": [...]
  }
}
```

---

#### analyze_tls_certificates
Analyze TLS certificate security.

**Parameters:**
- `checkExpiration` (boolean, optional): Check expiry
- `checkChain` (boolean, optional): Validate chain
- `checkPinning` (boolean, optional): Check pin violations

**Response:**
```json
{
  "success": true,
  "analysis": {
    "totalCertificates": 12,
    "expiringSoon": 1,
    "chainValid": true,
    "pinningViolations": 0,
    "issues": [...]
  }
}
```

---

#### analyze_cookies
Analyze cookie security posture.

**Parameters:**
- `checkSecure` (boolean, optional): Check secure flag
- `checkHttpOnly` (boolean, optional): Check httpOnly flag
- `checkSameSite` (boolean, optional): Check SameSite policy

**Response:**
```json
{
  "success": true,
  "analysis": {
    "totalCookies": 67,
    "secureCount": 45,
    "httpOnlyCount": 60,
    "sameSiteCount": 40,
    "insecure": [...]
  }
}
```

---

#### analyze_websocket_connections
Analyze WebSocket usage patterns.

**Parameters:** (none)

**Response:**
```json
{
  "success": true,
  "analysis": {
    "totalConnections": 5,
    "uniqueUrls": 3,
    "protocolCount": 2,
    "connectionPatterns": [...]
  }
}
```

---

#### analyze_http_headers
Perform header security analysis.

**Parameters:**
- `checkSecurity` (boolean, optional): Check security headers
- `checkCors` (boolean, optional): Check CORS headers

**Response:**
```json
{
  "success": true,
  "analysis": {
    "totalRequests": 234,
    "securityHeadersPresent": 180,
    "corsEnabled": 45,
    "missingHeaders": [...]
  }
}
```

---

#### get_cookie_provenance
Trace cookie origin and history.

**Parameters:**
- `cookieName` (string, required): Cookie to trace
- `domain` (string, optional): Cookie domain

**Response:**
```json
{
  "success": true,
  "provenance": {
    "cookieName": "sessionId",
    "firstSeen": "2026-06-21T10:15:00Z",
    "sources": [...],
    "modifications": [...],
    "currentValue": "..."
  }
}
```

---

#### export_forensic_report
Export comprehensive forensic report.

**Parameters:**
- `format` (string, required): `json|html|pdf|csv`
- `includeAnalysis` (boolean, optional, default: true)
- `detailed` (boolean, optional, default: false)

**Response:**
```json
{
  "success": true,
  "report": {
    "id": "report_001",
    "format": "json",
    "size": 1048576,
    "sections": [
      "dns_analysis",
      "certificate_analysis",
      "cookie_analysis",
      "header_analysis"
    ],
    "hash": "sha256:..."
  }
}
```

---

#### clear_network_forensics_data
Clear all captured forensics data.

**Parameters:**
- `confirm` (boolean, required): Confirmation flag

**Response:**
```json
{
  "success": true,
  "itemsCleared": {
    "dnsQueries": 45,
    "tlsCertificates": 12,
    "websocketConnections": 5,
    "httpHeaders": 234,
    "cookies": 67
  },
  "freedMemory": 2097152
}
```

---

#### update_websocket_connection
Update WebSocket connection record.

**Parameters:**
- `id` (string, required): Connection ID
- `status` (string, optional): New status
- `metadata` (object, optional): Additional metadata

**Response:**
```json
{
  "success": true,
  "connection": {...}
}
```

---

### 3. LEGAL COMPLIANCE (6 Commands)

**Category File**: `websocket/commands/forensic/legal/legal-compliance-commands.js`

#### start_legal_compliance_mode
Enable strict chain-of-custody and audit logging.

**Parameters:**
- `jurisdiction` (string, optional): Legal jurisdiction
- `caseId` (string, optional): Associated case ID
- `investigator` (string, optional): Investigator name
- `agency` (string, optional): Investigating agency

**Response:**
```json
{
  "success": true,
  "mode": "LEGAL_COMPLIANCE",
  "auditLog": "log_file_path",
  "jurisdiction": "US-Federal",
  "message": "Legal compliance mode enabled"
}
```

---

#### export_with_chain_of_custody
Export evidence with chain-of-custody documentation.

**Parameters:**
- `evidenceIds` (array, required): Evidence IDs to export
- `format` (string, required): Export format
- `includeHash` (boolean, optional, default: true)
- `includeTimeline` (boolean, optional, default: true)
- `signedBy` (string, optional): Signing officer

**Response:**
```json
{
  "success": true,
  "export": {
    "id": "export_coc_001",
    "evidenceCount": 12,
    "chainOfCustody": {
      "initials": [...],
      "handoffs": [...],
      "sealed": true
    },
    "hash": "sha256:..."
  }
}
```

---

#### export_court_admissible_package
Create court-ready evidence package (Daubert-compliant).

**Parameters:**
- `evidenceIds` (array, required): Evidence to include
- `jurisdiction` (string, required): Legal jurisdiction
- `expert` (string, optional): Expert name
- `method` (string, optional): Collection methodology
- `limitations` (array, optional): Known limitations

**Response:**
```json
{
  "success": true,
  "package": {
    "id": "court_pkg_001",
    "jurisdiction": "US-Federal",
    "admissible": true,
    "requirements": {
      "daubert": true,
      "frye": true,
      "authentication": true
    },
    "documentation": [...]
  }
}
```

---

#### certify_evidence_integrity
Generate integrity certification for evidence.

**Parameters:**
- `evidenceId` (string, required): Evidence to certify
- `method` (string, required): Certification method
- `certificationLevel` (string, optional): `standard|enhanced|forensic`
- `certifier` (string, optional): Certifying officer

**Response:**
```json
{
  "success": true,
  "certification": {
    "id": "cert_001",
    "evidenceId": "ev_abc123",
    "method": "SHA256_HASH",
    "level": "FORENSIC",
    "hash": "sha256:...",
    "timestamp": "2026-06-21T10:30:45Z",
    "certified": true
  }
}
```

---

#### generate_swgde_report
Generate SWGDE (Scientific Working Group on Digital Evidence) report.

**Parameters:**
- `evidenceIds` (array, required): Evidence to report
- `methodology` (string, optional): Collection methodology
- `limitations` (array, optional): Collection limitations
- `examiner` (string, optional): Examiner name

**Response:**
```json
{
  "success": true,
  "report": {
    "id": "swgde_001",
    "standard": "SWGDE-Compliant",
    "sections": [
      "case_information",
      "evidence_description",
      "examination_methodology",
      "findings",
      "limitations",
      "examiner_certification"
    ],
    "hash": "sha256:..."
  }
}
```

---

#### get_legal_compliance_status
Get current legal compliance configuration.

**Parameters:** (none)

**Response:**
```json
{
  "success": true,
  "status": {
    "mode": "LEGAL_COMPLIANCE",
    "enabled": true,
    "jurisdiction": "US-Federal",
    "auditLogFile": "/path/to/audit.log",
    "chainOfCustodyEnabled": true,
    "auditTrail": [...]
  }
}
```

---

### 4. EVIDENCE CORRELATION (5 Commands)

**Category File**: `websocket/commands/evidence-correlation-commands.js`

#### start_evidence_correlation
Begin correlating evidence across multiple sources.

**Parameters:**
- `evidenceIds` (array, required): Evidence to correlate
- `method` (string, optional): Correlation method
- `crossSite` (boolean, optional, default: false): Enable cross-site correlation

**Response:**
```json
{
  "success": true,
  "correlationId": "corr_001",
  "evidenceCount": 12,
  "message": "Correlation analysis started"
}
```

---

#### correlate_evidence_across_sites
Correlate evidence from multiple sites for user tracking.

**Parameters:**
- `evidenceIds` (array, required): Evidence IDs
- `correlationLevel` (string, optional): `weak|moderate|strong|forensic`
- `includePassive` (boolean, optional): Include passive tracking vectors

**Response:**
```json
{
  "success": true,
  "correlation": {
    "id": "corr_cross_001",
    "sites": 5,
    "correlationLevel": "STRONG",
    "commonIdentifiers": [
      "cookieId_123",
      "fingerprintHash_456",
      "ipAddress_789"
    ],
    "confidence": 0.94
  }
}
```

---

#### identify_common_patterns
Identify patterns common across multiple evidence items.

**Parameters:**
- `evidenceIds` (array, required): Evidence to analyze
- `patternTypes` (array, optional): Pattern types to find
- `threshold` (number, optional): Confidence threshold (0-1)

**Response:**
```json
{
  "success": true,
  "patterns": {
    "identified": [
      {
        "type": "cookie_pattern",
        "frequency": 8,
        "confidence": 0.98,
        "evidence": [...]
      }
    ],
    "totalPatterns": 3
  }
}
```

---

#### get_correlation_graph
Get correlation graph structure.

**Parameters:**
- `correlationId` (string, required): Correlation ID
- `format` (string, optional): `json|dot|mermaid`
- `simplified` (boolean, optional, default: false)

**Response:**
```json
{
  "success": true,
  "graph": {
    "nodes": [...],
    "edges": [...],
    "centralityScores": {...},
    "communities": [...]
  }
}
```

---

#### export_correlation_report
Export correlation analysis report.

**Parameters:**
- `correlationId` (string, required): Correlation ID
- `format` (string, required): `json|html|pdf|csv`
- `detailed` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "report": {
    "id": "report_corr_001",
    "format": "html",
    "size": 524288,
    "sections": [
      "correlation_summary",
      "pattern_analysis",
      "confidence_scores",
      "recommendations"
    ],
    "hash": "sha256:..."
  }
}
```

---

### 5. EVIDENCE PACKAGING (19 Commands)

**Category File**: `websocket/commands/forensic/packaging/evidence-packaging.js`

#### create_evidence_package
Create a new evidence package.

**Parameters:**
- `name` (string, required): Package name
- `description` (string, optional): Package description
- `caseId` (string, optional): Associated case ID
- `investigator` (string, optional): Investigator name
- `jurisdiction` (string, optional): Legal jurisdiction

**Response:**
```json
{
  "success": true,
  "packageId": "pkg_001",
  "name": "Investigation-Case123",
  "created": "2026-06-21T10:30:45Z",
  "status": "OPEN"
}
```

---

#### create_evidence_manifest
Create manifest for tracking evidence contents.

**Parameters:**
- `packageId` (string, required): Package ID
- `template` (string, optional): Manifest template
- `includeHashes` (boolean, optional, default: true)
- `includeChain` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "manifestId": "mf_001",
  "packageId": "pkg_001",
  "entries": 0,
  "created": "2026-06-21T10:30:45Z"
}
```

---

#### add_to_manifest
Add evidence item to manifest.

**Parameters:**
- `manifestId` (string, required): Manifest ID
- `evidenceId` (string, required): Evidence to add
- `metadata` (object, optional): Additional metadata
- `hash` (string, optional): Content hash

**Response:**
```json
{
  "success": true,
  "manifestId": "mf_001",
  "entry": {
    "sequenceNumber": 1,
    "evidenceId": "ev_abc123",
    "addedAt": "2026-06-21T10:30:45Z",
    "hash": "sha256:..."
  }
}
```

---

#### get_manifest
Retrieve manifest details.

**Parameters:**
- `manifestId` (string, required): Manifest ID

**Response:**
```json
{
  "success": true,
  "manifest": {
    "id": "mf_001",
    "packageId": "pkg_001",
    "entries": [
      {
        "sequenceNumber": 1,
        "evidenceId": "ev_abc123",
        "addedAt": "2026-06-21T10:30:45Z",
        "hash": "sha256:..."
      }
    ],
    "totalEntries": 5,
    "manifestHash": "sha256:..."
  }
}
```

---

#### list_manifests
List all manifests.

**Parameters:**
- `packageId` (string, optional): Filter by package
- `limit` (number, optional): Result limit
- `offset` (number, optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "manifests": [...],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

---

#### build_evidence_package
Compile evidence package for export.

**Parameters:**
- `packageId` (string, required): Package ID
- `format` (string, required): Package format
- `compress` (boolean, optional, default: true)
- `encrypt` (boolean, optional, default: false)

**Response:**
```json
{
  "success": true,
  "package": {
    "id": "pkg_001",
    "status": "BUILT",
    "size": 10485760,
    "itemCount": 45,
    "hash": "sha256:...",
    "ready": true
  }
}
```

---

#### seal_evidence_package
Seal package to prevent modification.

**Parameters:**
- `packageId` (string, required): Package ID
- `sealedBy` (string, optional): Officer sealing package
- `evidence` (string, optional): Sealing evidence

**Response:**
```json
{
  "success": true,
  "package": {
    "id": "pkg_001",
    "status": "SEALED",
    "sealed": true,
    "sealedAt": "2026-06-21T10:30:45Z",
    "sealHash": "sha256:..."
  }
}
```

---

#### get_evidence_package
Retrieve package details.

**Parameters:**
- `packageId` (string, required): Package ID

**Response:**
```json
{
  "success": true,
  "package": {
    "id": "pkg_001",
    "name": "Investigation-Case123",
    "status": "SEALED",
    "itemCount": 45,
    "size": 10485760,
    "created": "2026-06-21T10:15:00Z",
    "sealed": true,
    "sealedAt": "2026-06-21T10:30:45Z"
  }
}
```

---

#### list_evidence_packages
List all evidence packages.

**Parameters:**
- `status` (string, optional): Filter by status (OPEN|BUILT|SEALED)
- `caseId` (string, optional): Filter by case ID
- `limit` (number, optional): Result limit

**Response:**
```json
{
  "success": true,
  "packages": [...],
  "total": 20,
  "limit": 50
}
```

---

#### export_evidence_package
Export package in specified format.

**Parameters:**
- `packageId` (string, required): Package ID
- `format` (string, required): `zip|tar.gz|iso|custom`
- `includeManifest` (boolean, optional, default: true)
- `chainOfCustody` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "export": {
    "id": "exp_001",
    "packageId": "pkg_001",
    "format": "zip",
    "path": "/exports/pkg_001.zip",
    "size": 10485760,
    "hash": "sha256:..."
  }
}
```

---

#### export_evidence_package_zip
Export as ZIP archive.

**Parameters:**
- `packageId` (string, required): Package ID
- `includeManifest` (boolean, optional, default: true)
- `compression` (string, optional): `store|deflate|bzip2`

**Response:**
```json
{
  "success": true,
  "export": {
    "id": "exp_zip_001",
    "file": "pkg_001.zip",
    "size": 5242880,
    "hash": "sha256:..."
  }
}
```

---

#### get_custody_chain
Get chain of custody for package.

**Parameters:**
- `packageId` (string, required): Package ID

**Response:**
```json
{
  "success": true,
  "chain": {
    "packageId": "pkg_001",
    "entries": [
      {
        "timestamp": "2026-06-21T10:15:00Z",
        "person": "Officer Smith",
        "action": "CREATED",
        "location": "Lab A",
        "notes": "Initial package creation"
      }
    ],
    "intact": true
  }
}
```

---

#### generate_custody_report
Generate chain-of-custody report.

**Parameters:**
- `packageId` (string, required): Package ID
- `format` (string, required): `pdf|html|txt|csv`

**Response:**
```json
{
  "success": true,
  "report": {
    "id": "coc_report_001",
    "packageId": "pkg_001",
    "format": "pdf",
    "size": 262144,
    "path": "/reports/coc_pkg_001.pdf",
    "hash": "sha256:..."
  }
}
```

---

#### generate_compliance_report
Generate legal compliance report.

**Parameters:**
- `packageId` (string, required): Package ID
- `standard` (string, optional): `swgde|nist|iso27001`
- `includeGaps` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "report": {
    "id": "comp_report_001",
    "packageId": "pkg_001",
    "standard": "swgde",
    "compliant": true,
    "sections": [
      "requirements",
      "implementation",
      "gaps",
      "recommendations"
    ],
    "hash": "sha256:..."
  }
}
```

---

#### request_rfc3161_timestamp
Request RFC 3161 trusted timestamp.

**Parameters:**
- `packageId` (string, required): Package ID
- `data` (string, required): Data to timestamp
- `timestampServer` (string, optional): TSA server URL
- `algorithm` (string, optional): Hash algorithm

**Response:**
```json
{
  "success": true,
  "timestamp": {
    "id": "ts_001",
    "packageId": "pkg_001",
    "timestamp": "2026-06-21T10:30:45Z",
    "token": "...",
    "verified": true,
    "tsa": "GlobalSign TSA"
  }
}
```

---

#### check_timestamp_readiness
Verify package is ready for timestamping.

**Parameters:**
- `packageId` (string, required): Package ID

**Response:**
```json
{
  "success": true,
  "ready": true,
  "issues": [],
  "hash": "sha256:..."
}
```

---

#### verify_evidence_package
Verify package integrity.

**Parameters:**
- `packageId` (string, required): Package ID
- `deepVerify` (boolean, optional, default: false): Verify all items

**Response:**
```json
{
  "success": true,
  "valid": true,
  "issues": [],
  "hash": "sha256:...",
  "itemsVerified": 45
}
```

---

#### get_packaging_stats
Get packaging statistics.

**Parameters:** (none)

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalPackages": 20,
    "openPackages": 3,
    "builtPackages": 5,
    "sealedPackages": 12,
    "totalSize": 52428800,
    "totalItems": 234
  }
}
```

---

### 6. DOM SNAPSHOTS (7 Commands)

**Category File**: `websocket/commands/dom-snapshot-commands.js`

#### export_dom_tree
Export complete DOM tree structure.

**Parameters:**
- `format` (string, required): `json|xml|html`
- `includeAttributes` (boolean, optional, default: true)
- `includeStyles` (boolean, optional, default: true)
- `compact` (boolean, optional, default: false)

**Response:**
```json
{
  "success": true,
  "dom": {
    "elementCount": 234,
    "size": 1048576,
    "hash": "sha256:...",
    "tree": {...}
  }
}
```

---

#### export_dom_attributes
Export element attributes only.

**Parameters:**
- `selector` (string, optional): CSS selector filter
- `format` (string, optional): `json|csv|xml`

**Response:**
```json
{
  "success": true,
  "attributes": {
    "elementCount": 45,
    "attributeCount": 234,
    "data": [...]
  }
}
```

---

#### export_dom_computed_styles
Export computed CSS styles.

**Parameters:**
- `selector` (string, optional): CSS selector filter
- `properties` (array, optional): Specific properties to export
- `format` (string, optional): `json|css|xml`

**Response:**
```json
{
  "success": true,
  "styles": {
    "elementCount": 45,
    "styleCount": 234,
    "data": [...]
  }
}
```

---

#### export_dom_text_content
Export all text content from DOM.

**Parameters:**
- `selector` (string, optional): CSS selector filter
- `includeHidden` (boolean, optional, default: false)
- `format` (string, optional): `json|txt|csv`

**Response:**
```json
{
  "success": true,
  "text": {
    "elementCount": 89,
    "charCount": 12345,
    "content": [...]
  }
}
```

---

#### export_dom_form_state
Export form field values and metadata.

**Parameters:**
- `formSelector` (string, optional): Form selector filter
- `includeMetadata` (boolean, optional, default: true)
- `format` (string, optional): `json|xml|csv`

**Response:**
```json
{
  "success": true,
  "forms": {
    "formCount": 3,
    "fieldCount": 34,
    "data": [...]
  }
}
```

---

#### export_dom_event_listeners
Export event listener information.

**Parameters:**
- `selector` (string, optional): Element selector filter
- `eventType` (string, optional): Specific event type
- `format` (string, optional): `json|xml`

**Response:**
```json
{
  "success": true,
  "listeners": {
    "elementCount": 45,
    "listenerCount": 123,
    "eventTypes": [
      "click",
      "change",
      "submit"
    ],
    "data": [...]
  }
}
```

---

#### export_dom_mutations
Export DOM mutation history.

**Parameters:**
- `includeAttachments` (boolean, optional, default: true)
- `includeRemovals` (boolean, optional, default: true)
- `format` (string, optional): `json|xml|csv`

**Response:**
```json
{
  "success": true,
  "mutations": {
    "changeCount": 234,
    "types": {
      "attribute": 45,
      "content": 120,
      "structure": 69
    },
    "data": [...]
  }
}
```

---

### 7. JAVASCRIPT/CONSOLE EXTRACTION (10 Commands)

**Category File**: `websocket/commands/javascript-console-extraction.js`

#### export_console_logs
Export all console.log() entries.

**Parameters:**
- `limit` (number, optional): Result limit
- `format` (string, optional): `json|txt|csv|html`
- `includeTimestamps` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "logs": {
    "count": 45,
    "data": [
      {
        "timestamp": "2026-06-21T10:30:45.123Z",
        "level": "log",
        "message": "...",
        "args": [...]
      }
    ]
  }
}
```

---

#### export_console_errors
Export console error entries.

**Parameters:**
- `limit` (number, optional): Result limit
- `format` (string, optional): `json|txt|csv|html`
- `includeStackTraces` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "errors": {
    "count": 8,
    "data": [
      {
        "timestamp": "2026-06-21T10:30:45.123Z",
        "level": "error",
        "message": "...",
        "stack": "..."
      }
    ]
  }
}
```

---

#### export_scripts_all
Export all loaded scripts.

**Parameters:**
- `format` (string, optional): `json|xml|csv`
- `includeSource` (boolean, optional, default: false): Include script source
- `includeMetadata` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "scripts": {
    "count": 34,
    "data": [
      {
        "src": "https://example.com/app.js",
        "type": "text/javascript",
        "async": false,
        "defer": false,
        "hash": "sha256:..."
      }
    ]
  }
}
```

---

#### export_scripts_sources
Export inline script sources.

**Parameters:**
- `format` (string, optional): `json|xml|txt`
- `minified` (boolean, optional, default: false): Minify flag

**Response:**
```json
{
  "success": true,
  "scripts": {
    "count": 12,
    "totalSize": 524288,
    "data": [...]
  }
}
```

---

#### export_globals
Export global variables and objects.

**Parameters:**
- `filter` (string, optional): Variable name pattern
- `format` (string, optional): `json|txt|xml`
- `includeValues` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "globals": {
    "count": 87,
    "data": [
      {
        "name": "window",
        "type": "object",
        "value": "..."
      }
    ]
  }
}
```

---

#### export_localstorage
Export all localStorage entries.

**Parameters:**
- `format` (string, optional): `json|csv|xml`

**Response:**
```json
{
  "success": true,
  "localStorage": {
    "count": 23,
    "data": [
      {
        "key": "userId",
        "value": "...",
        "size": 256
      }
    ],
    "totalSize": 5120
  }
}
```

---

#### export_sessionstorage
Export all sessionStorage entries.

**Parameters:**
- `format` (string, optional): `json|csv|xml`

**Response:**
```json
{
  "success": true,
  "sessionStorage": {
    "count": 12,
    "data": [...],
    "totalSize": 2048
  }
}
```

---

#### export_cookies
Export all accessible cookies.

**Parameters:**
- `format` (string, optional): `json|csv|xml|netscape`

**Response:**
```json
{
  "success": true,
  "cookies": {
    "count": 34,
    "data": [
      {
        "name": "sessionId",
        "value": "...",
        "domain": ".example.com",
        "path": "/",
        "secure": true,
        "httpOnly": true
      }
    ]
  }
}
```

---

#### export_performance_timeline
Export performance metrics from performance API.

**Parameters:**
- `entryType` (string, optional): Filter by entry type
- `format` (string, optional): `json|csv|xml`
- `detailed` (boolean, optional, default: false)

**Response:**
```json
{
  "success": true,
  "performance": {
    "navigationStart": 0,
    "domContentLoaded": 1234,
    "loadComplete": 2345,
    "entries": [
      {
        "name": "resource",
        "type": "script",
        "duration": 234,
        "size": 102400
      }
    ]
  }
}
```

---

#### export_errors
Export all runtime errors captured.

**Parameters:**
- `limit` (number, optional): Result limit
- `format` (string, optional): `json|txt|csv|html`
- `includeStackTraces` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "errors": {
    "count": 8,
    "data": [
      {
        "timestamp": "2026-06-21T10:30:45.123Z",
        "type": "ReferenceError",
        "message": "...",
        "stack": "...",
        "source": "app.js:123"
      }
    ]
  }
}
```

---

#### export_network_from_js
Export network activity captured via JavaScript.

**Parameters:**
- `format` (string, optional): `json|har|csv|xml`
- `includePayloads` (boolean, optional, default: false)

**Response:**
```json
{
  "success": true,
  "network": {
    "requestCount": 45,
    "data": [
      {
        "method": "GET",
        "url": "https://api.example.com/data",
        "status": 200,
        "duration": 234,
        "size": 10240
      }
    ]
  }
}
```

---

### 8. HTML CAPTURE (6 Commands)

**Category File**: `websocket/commands/html-capture-commands.js`

#### export_html_raw
Export unmodified HTML source.

**Parameters:**
- `includeMarkup` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "html": {
    "size": 1048576,
    "lines": 2345,
    "hash": "sha256:...",
    "data": "<!DOCTYPE html>..."
  }
}
```

---

#### export_html_formatted
Export prettified HTML with indentation.

**Parameters:**
- `indentation` (number, optional, default: 2): Indent spaces

**Response:**
```json
{
  "success": true,
  "html": {
    "size": 1097728,
    "indentation": 2,
    "hash": "sha256:...",
    "data": "<!DOCTYPE html>..."
  }
}
```

---

#### export_html_with_metadata
Export HTML with embedded metadata.

**Parameters:**
- `includeScripts` (boolean, optional, default: false)
- `includeStyles` (boolean, optional, default: true)
- `metadata` (object, optional): Custom metadata

**Response:**
```json
{
  "success": true,
  "html": {
    "size": 1097728,
    "metadata": {
      "captured": "2026-06-21T10:30:45Z",
      "url": "https://example.com",
      "title": "Example Site"
    },
    "hash": "sha256:..."
  }
}
```

---

#### export_html_diff
Export changes between two snapshots.

**Parameters:**
- `originalId` (string, required): Original snapshot ID
- `modifiedId` (string, required): Modified snapshot ID
- `format` (string, optional): `unified|side-by-side|json`

**Response:**
```json
{
  "success": true,
  "diff": {
    "originalId": "snap_001",
    "modifiedId": "snap_002",
    "additions": 45,
    "deletions": 12,
    "modifications": 23,
    "data": [...]
  }
}
```

---

#### get_capture_stats
Get HTML capture statistics.

**Parameters:** (none)

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalSnapshots": 45,
    "totalSize": 52428800,
    "averageSize": 1164764,
    "oldestSnapshot": "2026-06-21T09:00:00Z",
    "newestSnapshot": "2026-06-21T10:30:45Z"
  }
}
```

---

#### clear_capture_snapshots
Clear stored HTML snapshots.

**Parameters:**
- `olderThan` (string, optional): ISO 8601 timestamp

**Response:**
```json
{
  "success": true,
  "deleted": 23,
  "freedMemory": 26214400
}
```

---

### 9. EXPORT FORMATS (8 Commands)

**Category File**: `websocket/commands/export-formats.js`

#### export_format_json
Export data in JSON format.

**Parameters:**
- `data` (object, required): Data to export
- `pretty` (boolean, optional, default: true): Pretty-print

**Response:**
```json
{
  "success": true,
  "export": {
    "format": "json",
    "size": 1024000,
    "hash": "sha256:..."
  }
}
```

---

#### export_format_csv
Export data in CSV format.

**Parameters:**
- `data` (array, required): Array of objects
- `delimiter` (string, optional, default: `,`): Field delimiter
- `includeHeaders` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "export": {
    "format": "csv",
    "rows": 234,
    "columns": 12,
    "size": 256000,
    "hash": "sha256:..."
  }
}
```

---

#### export_format_xml
Export data in XML format.

**Parameters:**
- `data` (object, required): Data to export
- `rootElement` (string, optional): Root XML element

**Response:**
```json
{
  "success": true,
  "export": {
    "format": "xml",
    "size": 512000,
    "hash": "sha256:..."
  }
}
```

---

#### export_format_har
Export network data as HAR.

**Parameters:**
- `entries` (array, required): Network entries
- `includeContent` (boolean, optional, default: false)

**Response:**
```json
{
  "success": true,
  "export": {
    "format": "har",
    "entries": 45,
    "size": 2048000,
    "hash": "sha256:..."
  }
}
```

---

#### export_format_warc
Export as WARC (Web ARChive).

**Parameters:**
- `data` (object, required): Data to archive
- `compression` (string, optional): `gzip|bzip2|none`

**Response:**
```json
{
  "success": true,
  "export": {
    "format": "warc",
    "records": 45,
    "compressed": true,
    "size": 1024000,
    "hash": "sha256:..."
  }
}
```

---

#### export_format_markdown
Export as Markdown document.

**Parameters:**
- `data` (object, required): Data to export
- `includeHeaders` (boolean, optional, default: true)
- `includeMetadata` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "export": {
    "format": "markdown",
    "size": 256000,
    "hash": "sha256:..."
  }
}
```

---

#### export_format_sqlite
Export as SQLite database.

**Parameters:**
- `tables` (array, required): Table definitions
- `data` (object, required): Data to store

**Response:**
```json
{
  "success": true,
  "export": {
    "format": "sqlite",
    "tables": 5,
    "records": 1234,
    "size": 4096000,
    "hash": "sha256:..."
  }
}
```

---

#### export_format_custom
Export using custom formatter.

**Parameters:**
- `format` (string, required): Custom format name
- `data` (object, required): Data to export
- `config` (object, optional): Format configuration

**Response:**
```json
{
  "success": true,
  "export": {
    "format": "custom",
    "size": 512000,
    "hash": "sha256:..."
  }
}
```

---

### 10. ENCRYPTED EXPORT (8 Commands)

**Category File**: `websocket/commands/encrypted-export-commands.js`

#### generate_export_key
Generate encryption key for exports.

**Parameters:**
- `algorithm` (string, optional, default: `AES-256-GCM`): Encryption algorithm
- `keyLength` (number, optional, default: 256): Key length in bits

**Response:**
```json
{
  "success": true,
  "key": {
    "id": "key_001",
    "algorithm": "AES-256-GCM",
    "keyLength": 256,
    "created": "2026-06-21T10:30:45Z"
  }
}
```

---

#### derive_export_key
Derive key from passphrase.

**Parameters:**
- `passphrase` (string, required): Passphrase
- `salt` (string, optional): Salt value
- `iterations` (number, optional, default: 100000): PBKDF2 iterations
- `algorithm` (string, optional): Key derivation algorithm

**Response:**
```json
{
  "success": true,
  "key": {
    "id": "key_002",
    "algorithm": "PBKDF2-SHA256",
    "keyLength": 256,
    "derived": true
  }
}
```

---

#### encrypt_export
Encrypt export data.

**Parameters:**
- `data` (string, required): Data to encrypt
- `keyId` (string, required): Key ID to use
- `format` (string, optional, default: `base64`): Output format
- `includeTag` (boolean, optional, default: true): Include auth tag

**Response:**
```json
{
  "success": true,
  "encrypted": {
    "ciphertext": "...",
    "iv": "...",
    "tag": "...",
    "algorithm": "AES-256-GCM",
    "size": 1024000
  }
}
```

---

#### decrypt_export
Decrypt exported data.

**Parameters:**
- `ciphertext` (string, required): Encrypted data
- `keyId` (string, required): Key ID
- `iv` (string, required): Initialization vector
- `tag` (string, optional): Authentication tag

**Response:**
```json
{
  "success": true,
  "plaintext": "...",
  "verified": true,
  "size": 1048576
}
```

---

#### export_raw_html_encrypted
Export HTML with encryption.

**Parameters:**
- `keyId` (string, required): Encryption key ID
- `includeMetadata` (boolean, optional, default: true)

**Response:**
```json
{
  "success": true,
  "export": {
    "format": "html-encrypted",
    "keyId": "key_001",
    "size": 1024000,
    "hash": "sha256:..."
  }
}
```

---

#### export_network_log_encrypted
Export network log with encryption.

**Parameters:**
- `keyId` (string, required): Encryption key ID
- `format` (string, optional, default: `har`): Format before encryption

**Response:**
```json
{
  "success": true,
  "export": {
    "format": "network-log-encrypted",
    "keyId": "key_001",
    "entries": 45,
    "size": 512000,
    "hash": "sha256:..."
  }
}
```

---

#### get_encryption_stats
Get encryption statistics.

**Parameters:** (none)

**Response:**
```json
{
  "success": true,
  "stats": {
    "keysGenerated": 12,
    "keysDerived": 5,
    "encryptedExports": 23,
    "totalEncryptedSize": 52428800,
    "algorithmUsage": {
      "AES-256-GCM": 18,
      "ChaCha20-Poly1305": 5
    }
  }
}
```

---

#### reset_encryption_stats
Reset encryption statistics.

**Parameters:** (none)

**Response:**
```json
{
  "success": true,
  "message": "Encryption statistics reset"
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "id": "request-id",
  "command": "command_name",
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "param": "parameter_name",
    "issue": "Specific problem"
  },
  "recovery": {
    "suggestion": "What to try next",
    "alternativeCommands": [
      "command1",
      "command2"
    ]
  }
}
```

### Common Error Codes

| Code | Meaning | Recovery |
|------|---------|----------|
| INVALID_PARAMS | Missing or invalid parameters | Check parameter names and types |
| NOT_FOUND | Resource not found | Verify resource ID exists |
| UNAUTHORIZED | Authentication/authorization failed | Provide valid token |
| CONFLICT | Resource already exists | Use different ID or delete existing |
| SIZE_EXCEEDED | Data exceeds size limit | Reduce data or chunk request |
| TIMEOUT | Command execution timeout | Retry or use async variant |
| INTERNAL_ERROR | Server-side error | Contact administrator |

---

## Quick Reference Card

### Connection
```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  console.log('Connected');
};

ws.send(JSON.stringify({
  id: '1',
  command: 'capture_screenshot_evidence',
  imageData: 'base64data...',
  url: 'https://example.com'
}));

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log(response);
};
```

### Common Patterns

#### Evidence Capture
1. `capture_screenshot_evidence` - Screenshot
2. `capture_page_archive_evidence` - Page archive
3. `capture_har_evidence` - Network traffic
4. `capture_dom_evidence` - DOM snapshot
5. `capture_console_evidence` - Console output

#### Network Forensics
1. `start_network_forensics_capture` - Begin capture
2. `capture_dns_query` - Record DNS query
3. `capture_tls_certificate` - Record TLS cert
4. `capture_http_headers` - Record HTTP headers
5. `stop_network_forensics_capture` - End capture
6. `export_forensic_report` - Export results

#### Package & Export
1. `create_evidence_package` - Create package
2. `add_to_manifest` - Add evidence
3. `build_evidence_package` - Compile
4. `seal_evidence_package` - Seal
5. `export_evidence_package` - Export

---

## Command Index

### A
- `add_competitor_monitor`
- `add_monitoring_zone`
- `add_slack_routing_rule`
- `add_to_manifest`
- `analyze_all_cookies`
- `analyze_change_trend`
- `analyze_cookie_security`
- `analyze_correlations`
- `analyze_cookies`
- `analyze_dns_queries`
- `analyze_form`
- `analyze_forms`
- `analyze_http_headers`
- `analyze_page_structure`
- `analyze_tls_certificates`
- `analyze_websocket_connections`
- `annotate_recording`

### B
- `batch_acknowledge_alerts`
- `batch_detect_technologies`
- `batch_dismiss_alerts`
- `batch_export_urls`
- `batch_filtering`
- `batch_mark_alerts_read`
- `batch_parallel_processing`
- `batch_status`
- `blur`
- `build_evidence_package`
- `build_link_graph`

### C
- `cancel_batch_job`
- `capture_canvas_elements`
- `capture_cookie`
- `capture_console_evidence`
- `capture_cookies_evidence`
- `capture_dns_query`
- `capture_dom_evidence`
- `capture_element_screenshot_with_context`
- `capture_favicon_og_images`
- `capture_full_page`
- `capture_har_evidence`
- `capture_http_headers`
- `capture_page_archive_evidence`
- `capture_performance_metric`
- `capture_screenshot_diff`
- `capture_screenshot_evidence`
- `capture_screenshot_with_annotations`
- `capture_screenshot_with_blur`
- `capture_screenshot_with_highlights`
- `capture_scrolling_screenshot`
- `capture_storage_evidence`
- `capture_tls_certificate`
- `capture_with_scrollback`
- `capture_websocket_connection`
- `certify_evidence_integrity`
- `change`
- `check_competitor_monitor`
- `check_honeypot`
- `check_page_changes_now`
- `check_timestamp_readiness`
- `cleanup_competitor_monitoring_data`
- `cleanup_expired_sessions`
- `cleanup_image_extractor`
- `cleanup_page_monitor`
- `cleanup_screenshot_manager`
- `cleanup_tab`
- `cleanup_video_storage`
- `clear_all_competitor_monitors`
- `clear_all_cookies`
- `clear_cache`
- `clear_capture_snapshots`
- `clear_network_forensics_data`
- `clear_offline_queue`
- `clear_slack_alert_history`
- `clear_tech_cache`
- `click`
- `clone_export_template`
- `clone_extraction_template`
- `clone_profile_template`
- `cluster_data`
- `compare_images`
- `compare_page_versions`
- `compare_periods`
- `compare_screenshots_similarity`
- `compare_sessions`
- `compare_to_reference`
- `compress_sessions`
- `configure_alert_rule`
- `configure_audio_noise`
- `configure_behavioral_anonymization`
- `configure_canvas_noise`
- `configure_change_detection`
- `configure_competitor_alerts`
- `configure_font_evasion`
- `configure_form_filler`
- `configure_http`
- `configure_http2_headers`
- `configure_image_extractor`
- `configure_monitoring`
- `configure_partner`
- `configure_patterns`
- `configure_screenshot_quality`
- `configure_tls_evasion`
- `configure_webgl_noise`
- `correlate_data`
- `correlate_evidence_across_sites`
- `cost_optimization_mode`
- `create_alert_rule`
- `create_behavioral_profile`
- `create_cookie_jar`
- `create_custom_profile`
- `create_dashboard_alert`
- `create_dashboard_view`
- `create_detection_rule`
- `create_evidence_manifest`
- `create_evidence_package`
- `create_export_template`
- `create_extraction_template`
- `create_fingerprint_profile`
- `create_page`
- `create_profile_template`
- `create_regional_fingerprint`
- `create_recording_checkpoint`
- `create_video_thumbnail`

### D
- `dashboard_commands`
- `deduplicate_exports`
- `delete_coherence_session`
- `delete_cookie_jar`
- `delete_custom_profile`
- `delete_detection_rule`
- `delete_export_template`
- `delete_extraction_template`
- `delete_fingerprint_profile`
- `delete_interaction_recording`
- `delete_profile_template`
- `delete_session_state`
- `delete_stored_session`
- `delete_video`
- `derive_export_key`
- `detect_anomalies`
- `detect_behavior_anomalies`
- `detect_captchas`
- `detect_changes`
- `detect_data_leakage`
- `detect_failure_type`
- `detect_honeypots`
- `detect_patterns`
- `detect_technologies`
- `detect_technologies_from_html`
- `detect_technologies_from_html`
- `disable_behavioral_scoring`
- `disable_location_spoofing`
- `dismiss_alert`

### E
- `enable_change_tracking`
- `enable_cluster_mode`
- `enable_location_spoofing`
- `enable_predictive_monitoring`
- `enable_timing_randomization`
- `enable_behavioral_scoring`
- `enrich_screenshot_metadata`
- `escalate_alert`
- `evaluate_css_selector`
- `execute_on_page`
- `execute_script`
- `export_analytics`
- `export_campaign_results`
- `export_change_report`
- `export_competitor_monitoring_data`
- `export_cookies`
- `export_correlation_report`
- `export_court_admissible_package`
- `export_delta`
- `export_evidence_package`
- `export_evidence_package_zip`
- `export_format_csv`
- `export_format_custom`
- `export_format_har`
- `export_format_json`
- `export_format_markdown`
- `export_format_sqlite`
- `export_format_warc`
- `export_format_xml`
- `export_html_diff`
- `export_html_formatted`
- `export_html_raw`
- `export_html_with_metadata`
- `export_profile`
- `export_profile_template`
- `export_raw_html_encrypted`
- `export_recording_as_script`
- `export_recovery_data`
- `export_session_analytics`
- `export_session_evidence_package`
- `export_session_for_sync`
- `export_session_forensic`
- `export_session_history_csv`
- `export_session_history_json`
- `export_session_recording`
- `export_slack_routing_config`
- `export_timeline`
- `export_video`
- `export_with_chain_of_custody`
- `export_with_template`
- `extract_favicon_og_images`
- `extract_frames`
- `extract_image_gps`
- `extract_image_metadata`
- `extract_image_text`
- `extract_page_images`
- `extract_svg_elements`
- `extract_text_from_screenshot`
- `extract_bulk`
- `extract_with_template`

### F
- `failover_policy`
- `find_clickable_elements`
- `find_elements_by_text`
- `find_insecure_cookies`
- `find_similar_elements`
- `find_text_regions`
- `focus`
- `force_garbage_collection`
- `forecast_changes`
- `format_export_data`
- `fill_form`
- `fill_form_smart`

### G
- `generate_all_fake_data`
- `generate_browser_profile`
- `generate_compliance_report`
- `generate_custom_report`
- `generate_custody_report`
- `generate_export_key`
- `generate_gpu_specs`
- `generate_hotp`
- `generate_image_hash`
- `generate_insights`
- `generate_mouse_path`
- `generate_profile_from_template`
- `generate_report`
- `generate_screen_resolution`
- `generate_scroll_behavior`
- `generate_swgde_report`
- `generate_totp`
- `generate_typing_events`
- `generate_user_agent`
- `get_active_alerts`
- `get_active_fingerprint`
- `get_aggregate_analytics`
- `get_alert_history`
- `get_alert_summary`
- `get_anomaly_score`
- `get_batch_performance`
- `get_batch_statistics`
- `get_behavioral_history`
- `get_behavioral_metrics`
- `get_behavioral_profile`
- `get_behavioral_score`
- `get_cache_stats`
- `get_coherence_recommendations`
- `get_coherence_report`
- `get_coherence_score`
- `get_coherence_violations`
- `get_command_performance`
- `get_competitor_changes`
- `get_competitor_comparison`
- `get_competitor_monitor`
- `get_competitor_monitoring_stats`
- `get_competitor_monitoring_status`
- `get_competitor_snapshots`
- `get_competitor_stats`
- `get_consent_audit_trail`
- `get_consent_stats`
- `get_cookie_history`
- `get_cookie_manager_stats`
- `get_cookie_provenance`
- `get_cookies`
- `get_cookies_by_classification`
- `get_correlation_graph`
- `get_correlation_status`
- `get_custody_chain`
- `get_dashboard_alerts`
- `get_dashboard_data`
- `get_dashboard_metrics`
- `get_dashboard_status`
- `get_dashboard_timeline`
- `get_dashboard_view`
- `get_distributed_status`
- `get_dns_queries`
- `get_element_properties`
- `get_element_state`
- `get_encryption_stats`
- `get_evasion_config`
- `get_evasion_metrics`
- `get_evidence_package`
- `get_evidence_types`
- `get_exchange_rate`
- `get_export_template`
- `get_export_template_stats`
- `get_export_transforms`
- `get_extraction_stats`
- `get_extraction_template`
- `get_field_types`
- `get_filtered_changes`
- `get_fingerprint_options`
- `get_fingerprint_profile`
- `get_form_filler_stats`
- `get_forensics_types`
- `get_gc_statistics`
- `get_http_headers`
- `get_historical_data`
- `get_image_extractor_stats`
- `get_interaction_recording`
- `get_interaction_timeline`
- `get_instance_metrics`
- `get_isolation_status`
- `get_layer_details`
- `get_legal_compliance_status`
- `get_location_stats`
- `get_location_status`
- `get_manifest`
- `get_memory_profile`
- `get_memory_trends`
- `get_metric_history`
- `get_metrics`
- `get_monitor_changes`
- `get_monitor_details`
- `get_monitor_events`
- `get_monitor_status`
- `get_monitored_targets`
- `get_monitoring_consent`
- `get_monitoring_schedule`
- `get_monitoring_stats`
- `get_multi_page_stats`
- `get_network_forensics_stats`
- `get_network_forensics_status`
- `get_optimization_recommendations`
- `get_page_changes`
- `get_page_info`
- `get_page_screenshot`
- `get_partner_countries`
- `get_partner_metrics`
- `get_partner_pricing`
- `get_partner_status`
- `get_performance_dashboard`
- `get_performance_metrics`
- `get_performance_stats`
- `get_pii_patterns`
- `get_prediction_confidence`
- `get_profile_consistency`
- `get_profile_template`
- `get_profile_template_stats`
- `get_rate_limit_state`
- `get_recording_stats`
- `get_recording_status`
- `get_recovery_log`
- `get_recovery_metrics`
- `get_resource_usage`
- `get_rule_hits`
- `get_screenshot_quality_presets`
- `get_session_analytics`
- `get_session_error_report`
- `get_session_history_summary`
- `get_session_metadata`
- `get_session_performance_report`
- `get_session_recording`
- `get_session_statistics`
- `get_session_stats`
- `get_session_timeline`
- `get_slack_alert_history`
- `get_slack_routing_config`
- `get_slack_status`
- `get_storage_health`
- `get_storage_stats`
- `get_sync_status`
- `get_tech_database`
- `get_tech_stats`
- `get_technologies_by_category`
- `get_technology_info`
- `get_template_activity_patterns`
- `get_template_categories`
- `get_template_risk_levels`
- `get_timeline`
- `get_totp_info`
- `get_trends`
- `get_unread_alerts`
- `get_video_info`
- `get_video_recording_status`
- `get_video_storage_stats`

### H
- `handle_failure`
- `hover`

### I
- `identify_common_patterns`
- `import_competitor_monitoring_config`
- `import_profile`
- `import_profile_template`
- `import_session_from_sync`
- `import_slack_routing_config`
- `init_coherence_session`
- `init_monitoring_consent`
- `init_multi_page`
- `input`
- `isolate_session`

### J
- `json`

### K
- `keydown`
- `keyup`

### L
- `list_anonymity_profiles`
- `list_active_monitoring`
- `list_batch_jobs`
- `list_coherence_sessions`
- `list_competitor_monitors`
- `list_cookie_jars`
- `list_evidence_packages`
- `list_export_templates`
- `list_extraction_templates`
- `list_fingerprint_profiles`
- `list_instances`
- `list_interaction_recordings`
- `list_manifests`
- `list_monitored_pages`
- `list_pages`
- `list_profile_templates`
- `list_proxy_partners`
- `list_rate_limit_adapters`
- `list_recordings`
- `list_saved_sessions`
- `list_slack_routing_rules`
- `list_slack_webhooks`
- `list_stored_sessions`
- `load_from_cookie_jar`

### M
- `mark_alert_read`
- `match_location_to_proxy`
- `migrate_monitor`
- `migrate_session`
- `multi_page_commands`

### O
- `obfuscate_network`

### P
- `parse_date`
- `partner_performance_report`
- `pause_competitor_monitor`
- `pause_competitor_monitoring`
- `pause_interaction_recording`
- `pause_monitoring`
- `pause_monitoring_page`
- `pause_video_recording`
- `performance_metrics`
- `playwright`
- `puppeteer`

### Q
- `query_analytics`
- `query_changes`
- `query_session_operations`

### R
- `record_element_interaction`
- `record_interaction`
- `record_keyboard_input`
- `record_mouse_click`
- `record_mouse_move`
- `record_navigation`
- `record_operation`
- `record_rate_limit`
- `record_recovery_success`
- `record_request_success`
- `record_scroll`
- `record_session_event`
- `remove_competitor_monitor`
- `remove_monitoring_zone`
- `remove_slack_webhook`
- `remove_slack_routing_rule`
- `replay_offline_queue`
- `replay_recording`
- `replay_session`
- `request_rfc`
- `request_rfc3161_timestamp`
- `reset_anonymity_settings`
- `reset_batch_statistics`
- `reset_behavioral_tracking`
- `reset_encryption_stats`
- `reset_fake_data`
- `reset_fingerprint_profiles`
- `reset_form_filler_stats`
- `reset_location`
- `reset_partner_cache`
- `reset_rate_limit`
- `resume_competitor_monitor`
- `resume_competitor_monitoring`
- `resume_interaction_recording`
- `resume_monitoring`
- `resume_monitoring_page`
- `resume_video_recording`
- `revoke_monitoring_consent`

### S
- `save_screenshot_to_file`
- `save_session_state`
- `save_to_cookie_jar`
- `seal_evidence_package`
- `search_profile_templates`
- `select`
- `selenium`
- `send_slack_alert`
- `send_slack_alerts_batch`
- `set_active_fingerprint`
- `set_active_page`
- `set_alert_threshold`
- `set_alert_thresholds`
- `set_anonymity_custom`
- `set_anonymity_profile`
- `set_coherence_mode`
- `set_evasion_coherence`
- `set_evasion_levels`
- `set_geolocation`
- `set_locale`
- `set_location_profile`
- `set_monitor_priority`
- `set_monitoring_consent`
- `set_partner_region`
- `set_preferred_partner`
- `setup_slack_routing`
- `setup_slack_webhook`
- `session_coherence_edge_cases`
- `session_management`
- `session_tracking`
- `shutdown_multi_page`
- `start_coherence_session`
- `start_competitor_monitoring`
- `start_evidence_correlation`
- `start_interaction_recording`
- `start_legal_compliance_mode`
- `start_monitoring`
- `start_monitoring_page`
- `start_network_forensics_capture`
- `start_session_recording`
- `start_video_recording`
- `stitch_screenshots`
- `stop_change_monitoring`
- `stop_competitor_monitoring`
- `stop_interaction_recording`
- `stop_monitoring`
- `stop_monitoring_page`
- `stop_network_forensics_capture`
- `stop_video_recording`
- `suppress_alert`
- `switch_cookie_jar`
- `sync_cookie_jars`

### T
- `tech_detection`
- `test_export_template`
- `test_partner_proxy`
- `test_slack_routing`
- `test_slack_webhook`
- `text_analytics`
- `track_multi_site_session`
- `trigger_failover`

### U
- `update_competitor_monitor`
- `update_export_template`
- `update_extraction_template`
- `update_fingerprint_profile`
- `update_multi_page_config`
- `update_profile_template`
- `update_session_state`
- `update_slack_channel`
- `update_slack_routing_rule`
- `update_websocket_connection`
- `use_extraction_template`

### V
- `validate_export_template`
- `validate_extraction_template`
- `validate_hotp`
- `validate_session_coherence`
- `validate_totp`
- `verify_evidence_integrity`
- `verify_evidence_package`
- `verify_session_coherence`
- `verify_session_isolation`
- `verify_session_state`
- `video_recording_commands`

### X
- `xpath_query`

---

## Additional Categories

Due to space constraints, the following 40+ additional commands are organized by their category files but not fully documented in this reference:

### Session Management (19 commands)
- Session compression, clustering, data leakage detection, analytics export, isolation verification, etc.

### Monitoring & Analytics (60+ commands)
- Advanced monitoring, continuous monitoring, change detection, competitor monitoring, dashboard management, metrics collection, etc.

### Evasion & Fingerprinting (55+ commands)
- Behavioral anonymization, extended evasion, device fingerprinting, fake data generation, profile templates, tech detection, etc.

### Recording & Playback (35+ commands)
- Video recording, interaction recording, session recording, replay functionality, etc.

### Forms & Input (10 commands)
- Form analysis, smart form filling, CAPTCHA detection, honeypot detection, field type detection, etc.

For complete documentation on these categories, refer to individual command files in `/websocket/commands/`.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 13.0.0 | 2026-06-21 | Complete 140+ command documentation |
| 12.1.0 | 2026-05-31 | Initial API reference with 164 commands |
| 12.0.0 | 2026-05-11 | Production deployment |

---

**Generated**: 2026-06-21  
**Status**: Production Ready  
**Access Level**: Development (No Authentication Required)
