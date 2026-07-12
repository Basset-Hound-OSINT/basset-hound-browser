# Evidence Packaging & Chain of Custody - Integration Guide

**Version:** v12.0.0  
**Last Updated:** June 13, 2026  
**Status:** Production Ready  
**Compliance:** ISO/IEC 27037:2012, RFC 3161, NIST Guidelines

## Feature Overview

Evidence Packaging & Chain of Custody provides a complete digital forensics workflow for capturing, tracking, and preserving evidence with legal admissibility. The system implements ISO/IEC 27037:2012 compliance standards, maintains SHA-256 integrity hashes, and supports RFC 3161 cryptographic timestamping.

**Capabilities:**
- 8 evidence types: screenshots, page archives, network HAR, DOM snapshots, console logs, cookies, localStorage, metadata
- 4 archive formats: MHTML, HTML, WARC, PDF
- Full chain of custody with actor tracking and modification logging
- SHA-256 hashing for integrity verification
- RFC 3161 timestamping for long-term proof
- ISO/IEC 27037:2012 compliance statements
- Forensic-grade evidence sealing

## Quick Start

### Minimal Example - Node.js

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  // Capture a screenshot
  const captureMsg = {
    command: 'evidence_capture_screenshot',
    params: {
      sessionId: 'investigation_001',
      url: 'https://example.com',
      capturedBy: 'investigator_jane',
      annotate: {
        elements: [
          { selector: '.fraud-indicator', label: 'Suspicious content' }
        ]
      }
    }
  };
  
  ws.send(JSON.stringify(captureMsg));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Evidence captured:', response.data.evidenceId);
  console.log('Hash:', response.data.contentHash);
});
```

### Python Example

```python
import json
import asyncio
import websockets
import hashlib

async def evidence_workflow():
    uri = "ws://localhost:8765"
    
    async with websockets.connect(uri) as websocket:
        # Step 1: Capture evidence
        capture_msg = {
            "command": "evidence_capture_screenshot",
            "params": {
                "sessionId": "investigation_forensic_01",
                "url": "https://suspicious-site.com",
                "capturedBy": "investigator_smith",
                "metadata": {
                    "caseNumber": "CASE-2026-0613-001",
                    "reason": "Suspected fraud scheme"
                }
            }
        }
        
        await websocket.send(json.dumps(capture_msg))
        response = json.loads(await websocket.recv())
        evidence_id = response['data']['evidenceId']
        print(f"Evidence captured: {evidence_id}")
        print(f"Hash: {response['data']['contentHash']}")
        
        # Step 2: Initialize chain of custody
        coc_msg = {
            "command": "coc_initialize",
            "params": {
                "evidenceId": evidence_id,
                "metadata": {
                    "capturedBy": "investigator_smith",
                    "url": "https://suspicious-site.com"
                }
            }
        }
        
        await websocket.send(json.dumps(coc_msg))
        response = json.loads(await websocket.recv())
        print(f"Chain of custody initialized")

asyncio.run(evidence_workflow())
```

### JavaScript/Browser Example

```javascript
// Capture evidence from browser context
async function capturePageEvidence() {
  const evidence = {
    screenshotData: await captureScreenshot(),
    htmlContent: document.documentElement.outerHTML,
    timestamp: Date.now(),
    url: window.location.href,
    metadata: {
      caseNumber: 'CASE-2026-0613-001',
      purpose: 'Webpage forensic capture'
    }
  };
  
  // Send to backend for hashing and storage
  const response = await fetch('http://localhost:8765', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'evidence_capture_screenshot',
      params: {
        sessionId: 'evidence_batch_' + Date.now(),
        data: evidence,
        capturedBy: 'browser_client'
      }
    })
  });
  
  const result = await response.json();
  return {
    evidenceId: result.data.evidenceId,
    hash: result.data.contentHash,
    timestamp: result.data.capturedAt
  };
}
```

## Evidence Types & Formats

### Supported Evidence Types

| Type | Description | Typical Size | Archive Format |
|------|-------------|--------------|-----------------|
| `screenshot` | Full page or element screenshot | 100-500KB | PNG |
| `page_archive` | Complete webpage archive | 50-2000KB | MHTML/HTML/WARC |
| `network_har` | HTTP Archive with all requests | 10-500KB | JSON (HAR) |
| `dom_snapshot` | Complete DOM tree at moment | 5-200KB | JSON |
| `console_log` | Browser console output | 1-100KB | JSON |
| `cookies` | All cookies from session | 1-50KB | JSON |
| `local_storage` | LocalStorage contents | 1-100KB | JSON |
| `metadata` | Session/request metadata | 1-20KB | JSON |

### Archive Formats

| Format | Use Case | Preservation Quality |
|--------|----------|----------------------|
| MHTML | Web archives with embedded resources | Excellent - single file, self-contained |
| HTML | Static HTML snapshot | Good - requires separate resources |
| WARC | Standard web archiving format | Excellent - preserves headers/timing |
| PDF | Printable reports | Good - human-readable, fixed format |

## WebSocket Commands

### Command Overview

| Command | Purpose | Compliance |
|---------|---------|-----------|
| `evidence_capture_screenshot` | Capture annotated screenshot | ISO 27037 |
| `evidence_capture_page_archive` | Archive complete webpage | ISO 27037 |
| `evidence_capture_network_har` | Capture network requests | ISO 27037 |
| `evidence_capture_dom_snapshot` | Snapshot DOM tree | ISO 27037 |
| `evidence_capture_console_log` | Capture console output | ISO 27037 |
| `evidence_capture_cookies` | Capture cookie jar | ISO 27037 |
| `evidence_capture_localStorage` | Capture localStorage | ISO 27037 |
| `evidence_capture_metadata` | Capture metadata | ISO 27037 |
| `coc_initialize` | Initialize chain of custody | ISO 27037 |
| `coc_record_access` | Record evidence access | ISO 27037 |
| `coc_record_modification` | Record evidence modification | ISO 27037 |
| `coc_record_export` | Record evidence export | ISO 27037 |
| `coc_seal_evidence` | Seal evidence (immutable) | ISO 27037 |
| `coc_generate_iso27037` | Generate compliance statement | ISO 27037 |
| `coc_verify_chain` | Verify chain integrity | ISO 27037 |
| `coc_get_chain` | Retrieve chain of custody | ISO 27037 |

## Command Details

### evidence_capture_screenshot

Capture annotated webpage screenshot with forensic metadata.

**Parameters:**
```json
{
  "sessionId": "investigation_001",
  "url": "https://example.com",
  "capturedBy": "investigator_jane",
  "fullPage": false,
  "annotate": {
    "elements": [
      {
        "selector": ".fraud-indicator",
        "label": "Suspicious content",
        "color": "#FF0000"
      }
    ],
    "text": "Potential evidence of fraud found here"
  },
  "metadata": {
    "caseNumber": "CASE-2026-0613-001",
    "jurisdiction": "US",
    "reason": "Fraud investigation"
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
    "capturedAt": "2026-06-13T14:23:45Z",
    "contentHash": "sha256:abc123def456...",
    "hashAlgorithm": "sha256",
    "size": 256000,
    "metadata": {
      "url": "https://example.com",
      "viewport": "1920x1080",
      "annotated": true,
      "caseNumber": "CASE-2026-0613-001"
    },
    "custodyChainInitialized": true
  }
}
```

### evidence_capture_page_archive

Archive complete webpage with all resources.

**Parameters:**
```json
{
  "sessionId": "investigation_001",
  "url": "https://example.com",
  "capturedBy": "investigator_jane",
  "format": "mhtml",
  "includeNetworkLog": true,
  "metadata": {
    "caseNumber": "CASE-2026-0613-001"
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
    "capturedAt": "2026-06-13T14:23:45Z",
    "contentHash": "sha256:def456ghi789...",
    "size": 1024000,
    "resourceCount": 47,
    "metadata": {
      "url": "https://example.com",
      "includedResources": [
        "css", "js", "images", "fonts"
      ]
    }
  }
}
```

### evidence_capture_network_har

Capture HTTP Archive with all network requests/responses.

**Parameters:**
```json
{
  "sessionId": "investigation_001",
  "capturedBy": "investigator_jane",
  "includeRequestBodies": true,
  "includeResponseBodies": true,
  "metadata": {
    "caseNumber": "CASE-2026-0613-001"
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
    "capturedAt": "2026-06-13T14:23:45Z",
    "contentHash": "sha256:ghi789jkl012...",
    "size": 512000,
    "requestCount": 147,
    "metadata": {
      "timeRange": {
        "start": "2026-06-13T14:00:00Z",
        "end": "2026-06-13T14:23:45Z"
      }
    }
  }
}
```

### coc_initialize

Initialize chain of custody tracking for evidence.

**Parameters:**
```json
{
  "evidenceId": "ev_1686786225000_abc123",
  "metadata": {
    "capturedBy": "investigator_jane",
    "url": "https://example.com",
    "caseNumber": "CASE-2026-0613-001"
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
      "timestamp": "2026-06-13T14:23:45Z",
      "action": "created",
      "actor": "investigator_jane",
      "notes": "Evidence captured at https://example.com",
      "hash": "sha256:abc123def456..."
    }
  }
}
```

### coc_record_access

Record evidence access for audit trail.

**Parameters:**
```json
{
  "evidenceId": "ev_1686786225000_abc123",
  "actor": "prosecutor_smith",
  "purpose": "Review for court proceeding",
  "notes": "Accessed for trial preparation"
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
      "notes": "Accessed for: Review for court proceeding"
    }
  }
}
```

### coc_seal_evidence

Seal evidence to make it immutable for legal proceedings.

**Parameters:**
```json
{
  "evidenceId": "ev_1686786225000_abc123",
  "actor": "investigator_jane",
  "requestRFC3161": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "evidenceId": "ev_1686786225000_abc123",
    "sealed": true,
    "sealTimestamp": "2026-06-13T14:40:00Z",
    "sealHash": "sha256:xyz789abc123...",
    "rfc3161Token": {
      "version": "1",
      "genTime": "2026-06-13T14:40:00Z",
      "authority": "freetsa.org",
      "serialNumber": "a1b2c3d4e5f6g7h8i9j0k1l2"
    }
  }
}
```

### coc_generate_iso27037

Generate ISO/IEC 27037:2012 compliance statement.

**Parameters:**
```json
{
  "evidenceId": "ev_1686786225000_abc123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "standard": "ISO/IEC 27037:2012",
    "version": "1.0",
    "statement": "This chain of custody for evidence ev_1686786225000_abc123 has been maintained in accordance with ISO/IEC 27037:2012 principles...",
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
    }
  }
}
```

### coc_verify_chain

Verify chain of custody integrity.

**Parameters:**
```json
{
  "evidenceId": "ev_1686786225000_abc123"
}
```

**Response - Valid Chain:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "issues": [],
    "entryCount": 5,
    "firstEntry": "2026-06-13T14:23:45Z",
    "lastEntry": "2026-06-13T14:40:00Z",
    "chronological": true,
    "sealed": true,
    "recommendations": []
  }
}
```

**Response - Invalid Chain:**
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

## Use Cases

### Use Case 1: Forensic Evidence Capture with Full Chain of Custody

Complete workflow for capturing evidence and maintaining legal chain of custody.

```javascript
async function captureForensicEvidence(caseNumber, url) {
  const investigatorId = 'inv_' + Date.now();
  
  // Step 1: Capture evidence
  const captureMsg = {
    command: 'evidence_capture_screenshot',
    params: {
      sessionId: `case_${caseNumber}`,
      url: url,
      capturedBy: investigatorId,
      metadata: {
        caseNumber: caseNumber,
        jurisdiction: 'US',
        reason: 'Fraud investigation - screenshots'
      }
    }
  };
  
  const captureResult = await sendWebSocketCommand(captureMsg);
  const evidenceId = captureResult.data.evidenceId;
  
  // Step 2: Capture page archive
  const archiveMsg = {
    command: 'evidence_capture_page_archive',
    params: {
      sessionId: `case_${caseNumber}`,
      url: url,
      capturedBy: investigatorId,
      format: 'mhtml',
      metadata: { caseNumber }
    }
  };
  
  const archiveResult = await sendWebSocketCommand(archiveMsg);
  
  // Step 3: Capture network activity
  const harMsg = {
    command: 'evidence_capture_network_har',
    params: {
      sessionId: `case_${caseNumber}`,
      capturedBy: investigatorId,
      includeRequestBodies: true,
      metadata: { caseNumber }
    }
  };
  
  const harResult = await sendWebSocketCommand(harMsg);
  
  // Step 4: Initialize chain of custody for all evidence
  const chainMsg = {
    command: 'coc_initialize',
    params: {
      evidenceId: evidenceId,
      metadata: {
        capturedBy: investigatorId,
        url: url,
        caseNumber: caseNumber
      }
    }
  };
  
  const chainResult = await sendWebSocketCommand(chainMsg);
  
  return {
    caseNumber,
    evidenceIds: [
      captureResult.data.evidenceId,
      archiveResult.data.evidenceId,
      harResult.data.evidenceId
    ],
    chainInitialized: chainResult.success,
    timestamp: new Date().toISOString()
  };
}
```

### Use Case 2: Evidence Audit Trail for Legal Proceedings

Track who accessed evidence and when.

```javascript
async function recordEvidenceAccess(evidenceId, accessor, purpose) {
  const accessMsg = {
    command: 'coc_record_access',
    params: {
      evidenceId: evidenceId,
      actor: accessor,
      purpose: purpose,
      notes: `Accessed by ${accessor} for ${purpose}`
    }
  };
  
  const result = await sendWebSocketCommand(accessMsg);
  
  console.log(`Access recorded at ${result.data.entry.timestamp}`);
  console.log(`Actor: ${result.data.entry.actor}`);
  console.log(`Purpose: ${result.data.entry.notes}`);
  
  return result;
}

// Usage
await recordEvidenceAccess('ev_123', 'prosecutor_smith', 'trial preparation');
await recordEvidenceAccess('ev_123', 'defense_attorney_jones', 'discovery review');
```

### Use Case 3: Seal Evidence for Court Proceedings

Lock evidence with cryptographic proof.

```javascript
async function sealEvidenceForCourt(evidenceId, investigator) {
  const sealMsg = {
    command: 'coc_seal_evidence',
    params: {
      evidenceId: evidenceId,
      actor: investigator,
      requestRFC3161: true  // Get cryptographic timestamp
    }
  };
  
  const result = await sendWebSocketCommand(sealMsg);
  
  // Save RFC 3161 token for timestamping authority verification
  const token = result.data.rfc3161Token;
  
  console.log('Evidence Sealed');
  console.log(`Seal Timestamp: ${result.data.sealTimestamp}`);
  console.log(`TSA Authority: ${token.authority}`);
  console.log(`Serial Number: ${token.serialNumber}`);
  
  return result.data;
}
```

### Use Case 4: Generate ISO 27037 Compliance Report

Create legal compliance documentation.

```javascript
async function generateComplianceReport(evidenceId) {
  const complianceMsg = {
    command: 'coc_generate_iso27037',
    params: {
      evidenceId: evidenceId
    }
  };
  
  const result = await sendWebSocketCommand(complianceMsg);
  
  const report = {
    title: 'ISO/IEC 27037:2012 Evidence Integrity Report',
    standard: result.data.standard,
    evidence: evidenceId,
    statement: result.data.statement,
    principles: result.data.principles,
    compliance: result.data.complianceChecks,
    generatedAt: result.data.generatedAt
  };
  
  // Save to file for legal proceedings
  fs.writeFileSync(
    `compliance_report_${evidenceId}.json`,
    JSON.stringify(report, null, 2)
  );
  
  return report;
}
```

## Troubleshooting

### "Chain already exists for evidence" Error

**Problem:** Cannot initialize chain for evidence that already has one

**Solution:**
- Chain is automatically initialized when evidence is captured
- Don't call `coc_initialize` - it's done internally
- Only call `coc_initialize` for evidence captured outside normal flow

### Chain Integrity Verification Fails

**Problem:** `coc_verify_chain` returns `valid: false`

**Solutions:**
1. **Chronological violation:** Check timestamps are in order
2. **Post-seal modification:** Verify no modifications after sealing
3. **Missing created action:** First entry should be "created"

```javascript
async function diagnoseChainIssue(evidenceId) {
  const verifyMsg = {
    command: 'coc_verify_chain',
    params: { evidenceId }
  };
  
  const result = await sendWebSocketCommand(verifyMsg);
  
  if (!result.data.valid) {
    console.error('Chain issues detected:');
    result.data.issues.forEach(issue => console.error(`- ${issue}`));
    
    result.data.recommendations.forEach(rec => console.log(`Fix: ${rec}`));
  }
}
```

### RFC 3161 Timestamp Failed

**Problem:** TSA (Time Stamping Authority) request fails

**Solution:**
- Ensure internet connectivity to timestamp authority
- Try alternative authority: `freetsa.org`, `globalsign.com`
- RFC 3161 timestamping is optional - evidence is still valid without it

### Evidence Hash Mismatch

**Problem:** Later verification shows different hash

**Solution:**
- Evidence data was modified (error on purpose or accident)
- Chain of custody will show modification action
- If sealed before modification, chain verification fails (expected)

## Performance Tips

1. **Batch Evidence Capture**: Capture multiple types together
   - Capture screenshot + archive + HAR in sequence
   - More efficient than individual captures
   - Reduces server I/O overhead

2. **Use Appropriate Formats**:
   - MHTML for complete snapshots (self-contained)
   - WARC for scientific/research preservation
   - PDF for printable court documents
   - HAR for network analysis

3. **Chain of Custody Access Logging**:
   - Don't record every view (produces noise)
   - Log access for significant milestones only
   - Example: "Reviewed for trial", "Provided to prosecution"

4. **Seal Strategically**:
   - Seal only when case/phase is finalized
   - Can't add entries after seal without breaking chain
   - RFC 3161 timestamping adds ~500ms, only use for critical evidence

5. **Compression**:
   - Archive payloads: ~70-90% reduction with gzip
   - HAR files: ~80% reduction with gzip
   - Network savings significant for large cases

## Related Documentation

- [Evidence Packaging - API Reference](../api/EVIDENCE-PACKAGING-API-REFERENCE.md)
- [Evidence Packaging - Architecture](../technical/EVIDENCE-PACKAGING-ARCHITECTURE.md)
- [Evidence Packaging - User Guide](../guides/EVIDENCE-PACKAGING-USER-GUIDE.md)
- [Session Coherence Validation](../integration/SESSION-COHERENCE-VALIDATION-INTEGRATION-GUIDE.md)
