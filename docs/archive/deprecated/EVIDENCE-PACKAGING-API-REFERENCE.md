# Evidence Packaging & Chain of Custody - API Reference

**Version:** v12.0.0  
**Last Updated:** June 13, 2026  
**API Endpoint:** `ws://localhost:8765`  
**Compliance:** ISO/IEC 27037:2012, RFC 3161, NIST SP 800-86

## Overview

The Evidence Packaging & Chain of Custody API provides 14 WebSocket commands for forensic-grade evidence capture and preservation. All evidence is automatically hashed with SHA-256 and includes chain of custody tracking.

## Evidence Capture Commands

### 1. evidence_capture_screenshot

Capture annotated webpage screenshot.

**Command Name:** `evidence_capture_screenshot`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Investigation/session ID |
| url | string | No | - | URL being captured |
| capturedBy | string | Yes | - | Investigator/actor name |
| fullPage | boolean | No | false | Capture full page or viewport |
| annotate | object | No | {} | Annotations to add |
| annotate.elements | array | No | [] | DOM element annotations |
| annotate.text | string | No | "" | Text annotation |
| metadata | object | No | {} | Custom metadata |

**Request Example:**

```json
{
  "command": "evidence_capture_screenshot",
  "params": {
    "sessionId": "case_2026_0613_001",
    "url": "https://fraudsite.example.com",
    "capturedBy": "investigator_jane_smith",
    "fullPage": true,
    "annotate": {
      "elements": [
        {
          "selector": ".checkout-form",
          "label": "Fake checkout stealing CC#",
          "color": "#FF0000"
        }
      ],
      "text": "Evidence of payment card fraud"
    },
    "metadata": {
      "caseNumber": "CASE-2026-0613-001",
      "jurisdiction": "US",
      "reason": "Credit card fraud investigation"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225000_abc123",
    "type": "screenshot",
    "format": "png",
    "capturedAt": "2026-06-13T14:23:45.123Z",
    "contentHash": "sha256:abc123def456ghi789jkl012mno345pqr678stu901vwx234yz5",
    "hashAlgorithm": "sha256",
    "size": 256000,
    "dimensions": {
      "width": 1920,
      "height": 12480
    },
    "metadata": {
      "url": "https://fraudsite.example.com",
      "viewport": "1920x1080",
      "annotated": true,
      "annotationCount": 1,
      "caseNumber": "CASE-2026-0613-001"
    },
    "custodyChainInitialized": true,
    "capturedBy": "investigator_jane_smith"
  }
}
```

**Error Codes:**

| Error | Cause |
|-------|-------|
| "sessionId is required" | Missing sessionId |
| "capturedBy is required" | Missing investigator name |
| "Failed to capture screenshot" | Browser error during capture |
| "Invalid annotation format" | Malformed annotation object |

**Latency:** 500-2000ms (depends on page size)

---

### 2. evidence_capture_page_archive

Archive complete webpage with all resources.

**Command Name:** `evidence_capture_page_archive`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Investigation/session ID |
| url | string | Yes | - | URL to archive |
| capturedBy | string | Yes | - | Investigator name |
| format | string | No | "mhtml" | Archive format (mhtml, html, warc, pdf) |
| includeNetworkLog | boolean | No | true | Include request/response log |
| metadata | object | No | {} | Custom metadata |

**Request Example:**

```json
{
  "command": "evidence_capture_page_archive",
  "params": {
    "sessionId": "case_2026_0613_001",
    "url": "https://fraudsite.example.com",
    "capturedBy": "investigator_jane_smith",
    "format": "mhtml",
    "includeNetworkLog": true,
    "metadata": {
      "caseNumber": "CASE-2026-0613-001"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225001_def456",
    "type": "page_archive",
    "format": "mhtml",
    "capturedAt": "2026-06-13T14:23:46Z",
    "contentHash": "sha256:def456ghi789jkl012mno345pqr678stu901vwx234yz567abc890",
    "hashAlgorithm": "sha256",
    "size": 1048576,
    "resourceCount": 47,
    "resources": [
      "html", "css", "js", "images", "fonts", "media"
    ],
    "metadata": {
      "url": "https://fraudsite.example.com",
      "includeNetworkLog": true,
      "caseNumber": "CASE-2026-0613-001"
    },
    "custodyChainInitialized": true,
    "capturedBy": "investigator_jane_smith"
  }
}
```

**Supported Formats:**

| Format | File Extension | Characteristics | Legal Use |
|--------|----------------|-----------------|-----------|
| MHTML | .mhtml | Single file, all resources embedded, mime-encoded | Excellent |
| HTML | .html | Static HTML, requires resource files | Good |
| WARC | .warc | Standard web archive, preserves metadata | Excellent |
| PDF | .pdf | Printable, human-readable, fixed layout | Good |

**Latency:** 2000-10000ms (depends on page complexity)

---

### 3. evidence_capture_network_har

Capture HTTP Archive with all network requests and responses.

**Command Name:** `evidence_capture_network_har`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Investigation/session ID |
| capturedBy | string | Yes | - | Investigator name |
| includeRequestBodies | boolean | No | true | Include POST/PUT data |
| includeResponseBodies | boolean | No | true | Include response content |
| filterByUrl | string | No | "" | URL pattern to filter |
| metadata | object | No | {} | Custom metadata |

**Request Example:**

```json
{
  "command": "evidence_capture_network_har",
  "params": {
    "sessionId": "case_2026_0613_001",
    "capturedBy": "investigator_jane_smith",
    "includeRequestBodies": true,
    "includeResponseBodies": true,
    "filterByUrl": "fraudsite.example.com",
    "metadata": {
      "caseNumber": "CASE-2026-0613-001",
      "investigationType": "data_exfiltration"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225002_ghi789",
    "type": "network_har",
    "format": "har",
    "capturedAt": "2026-06-13T14:23:47Z",
    "contentHash": "sha256:ghi789jkl012mno345pqr678stu901vwx234yz567abc890def123",
    "hashAlgorithm": "sha256",
    "size": 524288,
    "requestCount": 147,
    "requests": {
      "GET": 89,
      "POST": 34,
      "PUT": 12,
      "DELETE": 5,
      "OPTIONS": 7
    },
    "timeRange": {
      "start": "2026-06-13T14:00:00Z",
      "end": "2026-06-13T14:23:47Z",
      "duration": 1427000
    },
    "metadata": {
      "caseNumber": "CASE-2026-0613-001",
      "investigationType": "data_exfiltration"
    },
    "custodyChainInitialized": true,
    "capturedBy": "investigator_jane_smith"
  }
}
```

**HAR Structure** (see HAR 1.2 spec):
```json
{
  "log": {
    "version": "1.2",
    "creator": {"name": "basset-hound-browser", "version": "12.0.0"},
    "entries": [
      {
        "startedDateTime": "2026-06-13T14:00:00Z",
        "time": 245,
        "request": {
          "method": "GET",
          "url": "https://fraudsite.example.com",
          "headers": [...]
        },
        "response": {
          "status": 200,
          "headers": [...],
          "content": {...}
        }
      }
    ]
  }
}
```

**Latency:** 1000-5000ms (depends on request count)

---

### 4. evidence_capture_dom_snapshot

Capture complete DOM tree at moment of capture.

**Command Name:** `evidence_capture_dom_snapshot`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Investigation/session ID |
| url | string | No | - | URL captured from |
| capturedBy | string | Yes | - | Investigator name |
| includeComputedStyles | boolean | No | true | Include CSS styles |
| metadata | object | No | {} | Custom metadata |

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225003_jkl012",
    "type": "dom_snapshot",
    "format": "json",
    "capturedAt": "2026-06-13T14:23:48Z",
    "contentHash": "sha256:jkl012mno345pqr678stu901vwx234yz567abc890def123ghi456",
    "hashAlgorithm": "sha256",
    "size": 102400,
    "nodeCount": 1247,
    "metadata": {
      "url": "https://fraudsite.example.com"
    },
    "custodyChainInitialized": true
  }
}
```

**Latency:** 500-2000ms

---

### 5. evidence_capture_console_log

Capture browser console output.

**Command Name:** `evidence_capture_console_log`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Investigation/session ID |
| capturedBy | string | Yes | - | Investigator name |
| levels | array | No | ["error", "warn", "log"] | Console levels to capture |
| metadata | object | No | {} | Custom metadata |

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225004_mno345",
    "type": "console_log",
    "format": "json",
    "capturedAt": "2026-06-13T14:23:49Z",
    "contentHash": "sha256:mno345pqr678stu901vwx234yz567abc890def123ghi456jkl789",
    "size": 15360,
    "logCount": 37,
    "levels": {
      "error": 3,
      "warn": 8,
      "log": 26
    },
    "custodyChainInitialized": true
  }
}
```

**Latency:** 100-500ms

---

### 6. evidence_capture_cookies

Capture all cookies from session.

**Command Name:** `evidence_capture_cookies`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Investigation/session ID |
| capturedBy | string | Yes | - | Investigator name |
| domain | string | No | "" | Filter by domain |
| metadata | object | No | {} | Custom metadata |

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225005_pqr678",
    "type": "cookies",
    "format": "json",
    "capturedAt": "2026-06-13T14:23:50Z",
    "contentHash": "sha256:pqr678stu901vwx234yz567abc890def123ghi456jkl789mno012",
    "size": 8192,
    "cookieCount": 23,
    "domains": 5,
    "metadata": {
      "sessionId": "case_2026_0613_001"
    },
    "custodyChainInitialized": true
  }
}
```

**Cookie Data Structure:**
```json
[
  {
    "name": "sessionid",
    "value": "abc123def456",
    "domain": "fraudsite.example.com",
    "path": "/",
    "expires": "2026-06-20T14:23:50Z",
    "secure": true,
    "httpOnly": true,
    "sameSite": "Strict"
  }
]
```

**Latency:** 100-300ms

---

### 7. evidence_capture_localStorage

Capture browser localStorage.

**Command Name:** `evidence_capture_localStorage`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Investigation/session ID |
| capturedBy | string | Yes | - | Investigator name |
| domain | string | No | "" | Filter by domain |
| metadata | object | No | {} | Custom metadata |

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225006_stu901",
    "type": "local_storage",
    "format": "json",
    "capturedAt": "2026-06-13T14:23:51Z",
    "contentHash": "sha256:stu901vwx234yz567abc890def123ghi456jkl789mno012pqr345",
    "size": 20480,
    "keyCount": 15,
    "domains": 3,
    "custodyChainInitialized": true
  }
}
```

**localStorage Data Structure:**
```json
[
  {
    "domain": "fraudsite.example.com",
    "keys": [
      {
        "key": "userProfile",
        "value": "{...json...}",
        "size": 512
      }
    ]
  }
]
```

**Latency:** 100-300ms

---

### 8. evidence_capture_metadata

Capture session/request metadata.

**Command Name:** `evidence_capture_metadata`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Investigation/session ID |
| capturedBy | string | Yes | - | Investigator name |
| includeHeaders | boolean | No | true | Include HTTP headers |
| metadata | object | No | {} | Custom metadata |

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225007_vwx234",
    "type": "metadata",
    "format": "json",
    "capturedAt": "2026-06-13T14:23:52Z",
    "contentHash": "sha256:vwx234yz567abc890def123ghi456jkl789mno012pqr345stu678",
    "size": 4096,
    "metadata": {
      "sessionId": "case_2026_0613_001",
      "userAgent": "Mozilla/5.0...",
      "ipAddress": "203.0.113.42",
      "country": "US",
      "timestamp": "2026-06-13T14:23:52Z"
    },
    "custodyChainInitialized": true
  }
}
```

**Latency:** 50-200ms

---

## Chain of Custody Commands

### 9. coc_initialize

Initialize chain of custody tracking.

**Command Name:** `coc_initialize`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| evidenceId | string | Yes | Evidence identifier |
| metadata | object | No | Initial metadata |

**Request Example:**

```json
{
  "command": "coc_initialize",
  "params": {
    "evidenceId": "ev_1686786225000_abc123",
    "metadata": {
      "capturedBy": "investigator_jane_smith",
      "url": "https://fraudsite.example.com",
      "caseNumber": "CASE-2026-0613-001"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225000_abc123",
    "chainInitialized": true,
    "initialEntry": {
      "timestamp": "2026-06-13T14:23:45.123Z",
      "action": "created",
      "actor": "investigator_jane_smith",
      "notes": "Evidence captured at https://fraudsite.example.com",
      "hash": "sha256:abc123def456ghi789jkl012mno345pqr678stu901vwx234yz5"
    }
  }
}
```

**Latency:** 1-5ms

---

### 10. coc_record_access

Record evidence access.

**Command Name:** `coc_record_access`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| evidenceId | string | Yes | Evidence identifier |
| actor | string | Yes | Who accessed it |
| purpose | string | No | Why accessed |
| notes | string | No | Additional notes |

**Request Example:**

```json
{
  "command": "coc_record_access",
  "params": {
    "evidenceId": "ev_1686786225000_abc123",
    "actor": "prosecutor_smith",
    "purpose": "trial_preparation",
    "notes": "Reviewed for evidence presentation"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225000_abc123",
    "action": "accessed",
    "entry": {
      "timestamp": "2026-06-13T14:35:00Z",
      "action": "accessed",
      "actor": "prosecutor_smith",
      "notes": "Accessed for: trial_preparation"
    }
  }
}
```

**Latency:** 1-3ms

---

### 11. coc_record_modification

Record evidence modification.

**Command Name:** `coc_record_modification`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| evidenceId | string | Yes | Evidence identifier |
| actor | string | Yes | Who modified it |
| description | string | Yes | What changed |
| oldHash | string | No | Hash before modification |
| newHash | string | Yes | Hash after modification |

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225000_abc123",
    "action": "modified",
    "entry": {
      "timestamp": "2026-06-13T14:40:00Z",
      "action": "modified",
      "actor": "examiner_johnson",
      "notes": "Added metadata annotations",
      "previousHash": "sha256:abc123...",
      "newHash": "sha256:xyz789..."
    }
  }
}
```

**Latency:** 1-3ms

---

### 12. coc_record_export

Record evidence export.

**Command Name:** `coc_record_export`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| evidenceId | string | Yes | Evidence identifier |
| actor | string | Yes | Who exported it |
| exportFormat | string | Yes | Format (json, pdf, xml, etc.) |
| destination | string | No | Export destination |

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225000_abc123",
    "action": "exported",
    "entry": {
      "timestamp": "2026-06-13T14:45:00Z",
      "action": "exported",
      "actor": "prosecutor_smith",
      "notes": "Exported as pdf to external_storage"
    }
  }
}
```

**Latency:** 1-3ms

---

### 13. coc_seal_evidence

Seal evidence for immutability.

**Command Name:** `coc_seal_evidence`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| evidenceId | string | Yes | - | Evidence identifier |
| actor | string | Yes | - | Who sealed it |
| requestRFC3161 | boolean | No | false | Request RFC 3161 timestamp |

**Request Example:**

```json
{
  "command": "coc_seal_evidence",
  "params": {
    "evidenceId": "ev_1686786225000_abc123",
    "actor": "investigator_jane_smith",
    "requestRFC3161": true
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225000_abc123",
    "sealed": true,
    "sealTimestamp": "2026-06-13T14:50:00Z",
    "sealHash": "sha256:xyz789abc123def456ghi789jkl012mno345pqr678stu901vwx234",
    "rfc3161Token": {
      "version": "1",
      "policyId": "1.2.840.113549.1.9.16.3.3",
      "messageImprint": {
        "hashAlgorithm": "sha256",
        "hashedMessage": "sha256:xyz789abc123..."
      },
      "serialNumber": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
      "genTime": "2026-06-13T14:50:00Z",
      "accuracy": {
        "seconds": 1,
        "millis": 0
      },
      "tsa": "freetsa.org",
      "nonce": "n0n3_v4lu3_1234567890abcdef"
    }
  }
}
```

**RFC 3161 Timestamp Token:**
- Used for long-term cryptographic proof of evidence existence
- Verified by independent Time Stamping Authority (TSA)
- Prevents "evidence creation after the fact" claims
- Valid for legal proceedings

**Latency:** 50-1000ms (RFC 3161 adds delay)

---

### 14. coc_generate_iso27037

Generate ISO/IEC 27037:2012 compliance statement.

**Command Name:** `coc_generate_iso27037`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| evidenceId | string | Yes | Evidence identifier |

**Response:**

```json
{
  "success": true,
  "data": {
    "standard": "ISO/IEC 27037:2012",
    "version": "1.0",
    "evidenceId": "ev_1686786225000_abc123",
    "statement": "This chain of custody for evidence ev_1686786225000_abc123 has been maintained in accordance with ISO/IEC 27037:2012 principles. All evidence has been handled using documented procedures to maintain integrity and authenticity. All actions have been recorded with timestamps and actor information. No evidence has been modified except as expressly documented in the custody chain.",
    "principles": {
      "minimization": "Only necessary evidence was collected and preserved",
      "integrity": "Chain of custody maintained throughout handling",
      "documentation": "Complete action log with timestamps and actors",
      "traceability": "All modifications and accesses fully documented"
    },
    "requirements": {
      "chainIntegrity": true,
      "totalActions": 5,
      "documentedModifications": 0,
      "documentedAccesses": 2,
      "sealed": true
    },
    "complianceChecks": {
      "unbrokenChain": true,
      "allActionsDocumented": true,
      "noPostSealModifications": true
    },
    "generatedAt": "2026-06-13T14:50:00Z"
  }
}
```

**Latency:** 5-20ms

---

### 15. coc_verify_chain

Verify chain of custody integrity.

**Command Name:** `coc_verify_chain`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| evidenceId | string | Yes | Evidence identifier |

**Response (Valid Chain):**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "issues": [],
    "entryCount": 5,
    "firstEntry": "2026-06-13T14:23:45Z",
    "lastEntry": "2026-06-13T14:50:00Z",
    "chronological": true,
    "sealed": true,
    "recommendations": []
  }
}
```

**Response (Invalid Chain):**

```json
{
  "success": true,
  "data": {
    "valid": false,
    "issues": [
      "Chronological violation at entry 3",
      "Modifications detected after sealing"
    ],
    "entryCount": 6,
    "chronological": false,
    "sealed": true,
    "recommendations": [
      "Review entry 3 timestamp",
      "Verify seal integrity"
    ]
  }
}
```

**Latency:** 2-10ms

---

### 16. coc_get_chain

Retrieve complete chain of custody.

**Command Name:** `coc_get_chain`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| evidenceId | string | Yes | Evidence identifier |

**Response:**

```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225000_abc123",
    "chain": [
      {
        "timestamp": "2026-06-13T14:23:45Z",
        "action": "created",
        "actor": "investigator_jane_smith",
        "notes": "Evidence captured at https://fraudsite.example.com",
        "hash": "sha256:abc123def456ghi789jkl012mno345pqr678stu901vwx234yz5"
      },
      {
        "timestamp": "2026-06-13T14:35:00Z",
        "action": "accessed",
        "actor": "prosecutor_smith",
        "notes": "Accessed for: trial_preparation"
      },
      {
        "timestamp": "2026-06-13T14:45:00Z",
        "action": "exported",
        "actor": "prosecutor_smith",
        "notes": "Exported as pdf to external_storage"
      },
      {
        "timestamp": "2026-06-13T14:50:00Z",
        "action": "sealed",
        "actor": "investigator_jane_smith",
        "notes": "Evidence sealed for preservation",
        "hash": "sha256:xyz789abc123def456ghi789jkl012mno345pqr678stu901vwx234"
      }
    ],
    "totalEntries": 4
  }
}
```

**Latency:** 1-5ms

---

## Error Handling

### Common Error Codes

| Error | Cause | Resolution |
|-------|-------|-----------|
| "sessionId is required" | Missing sessionId parameter | Provide investigation/session ID |
| "capturedBy is required" | Missing investigator name | Specify who captured evidence |
| "evidenceId is required" | Missing evidence ID | Check evidence ID from capture response |
| "Failed to capture screenshot" | Browser screenshot error | Retry, check page loads correctly |
| "Invalid format parameter" | Unknown archive format | Use: mhtml, html, warc, or pdf |
| "No custody chain found" | Evidence not tracked | Initialize chain with coc_initialize |
| "Chain already exists" | Chain already initialized | Don't reinitialize - automatic |

### Error Response Format

```json
{
  "success": false,
  "error": "error message describing the issue"
}
```

---

## Evidence Hash Verification

All evidence includes SHA-256 hash for integrity:

```javascript
const crypto = require('crypto');

function verifyEvidenceHash(evidenceData, reportedHash) {
  const computed = crypto
    .createHash('sha256')
    .update(JSON.stringify(evidenceData))
    .digest('hex');
  
  return computed === reportedHash;
}

// Verify captured evidence
if (verifyEvidenceHash(captureResult.data, captureResult.data.contentHash)) {
  console.log('Evidence integrity verified');
} else {
  console.error('Evidence hash mismatch - possible tampering');
}
```

---

## Performance Characteristics

| Operation | Latency | Notes |
|-----------|---------|-------|
| evidence_capture_screenshot | 500-2000ms | Depends on page complexity |
| evidence_capture_page_archive | 2000-10000ms | MHTML is fastest |
| evidence_capture_network_har | 1000-5000ms | Depends on request count |
| evidence_capture_dom_snapshot | 500-2000ms | Full DOM traversal |
| evidence_capture_console_log | 100-500ms | Fastest capture |
| evidence_capture_cookies | 100-300ms | Very fast |
| evidence_capture_localStorage | 100-300ms | Very fast |
| evidence_capture_metadata | 50-200ms | Fastest capture |
| coc_initialize | 1-5ms | Chain creation |
| coc_record_access | 1-3ms | Access logging |
| coc_seal_evidence | 50-1000ms | RFC 3161 adds ~500ms |
| coc_verify_chain | 2-10ms | Integrity check |

---

## Payload Sizes

| Evidence Type | Typical Size | Compressed (gzip) | Compression |
|---------------|--------------|-------------------|-------------|
| Screenshot | 256-500KB | 40-100KB | 85-90% |
| Page Archive (MHTML) | 500-2000KB | 100-300KB | 80-85% |
| Network HAR | 50-500KB | 10-60KB | 85-90% |
| DOM Snapshot | 50-200KB | 10-30KB | 85-90% |
| Console Log | 5-100KB | 1-20KB | 80-90% |
| Cookies | 5-50KB | 2-10KB | 70-80% |
| localStorage | 10-100KB | 2-20KB | 80-90% |

---

## Related Documentation

- [Evidence Packaging - Integration Guide](../integration/EVIDENCE-PACKAGING-INTEGRATION-GUIDE.md)
- [Evidence Packaging - Architecture](../technical/EVIDENCE-PACKAGING-ARCHITECTURE.md)
- [Evidence Packaging - User Guide](../guides/EVIDENCE-PACKAGING-USER-GUIDE.md)
- [Session Coherence Validation - API Reference](./SESSION-COHERENCE-VALIDATION-API-REFERENCE.md)
