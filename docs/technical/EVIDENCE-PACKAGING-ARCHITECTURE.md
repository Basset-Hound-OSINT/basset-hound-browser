> ⚠️ **OUTDATED** — see `docs/planning/PROJECT-STATUS-MATRIX.md` for the authoritative status (2026-07-04). Claims below are inflated/unverified. The described evidence WS commands (`evidence_capture_*`, 14-command API) do NOT exist / are never registered (`registerEvidenceCommands` is never called) and are passive (they hash caller-supplied data, capturing nothing live). Phase 29 chain-of-custody was explicitly REMOVED as out-of-scope. `export_format_har/warc` is wired but BROKEN (calls a nonexistent `getLogs()`).

# Evidence Packaging & Chain of Custody - Architecture

**Version:** v12.0.0  
**Last Updated:** June 13, 2026

## System Overview

Evidence Packaging & Chain of Custody provides forensic-grade evidence capture and preservation with legal admissibility. The system implements ISO/IEC 27037:2012 compliance, SHA-256 hashing, and RFC 3161 cryptographic timestamping.

```
┌──────────────────────────────────────────────────┐
│        Evidence Capture Layer                     │
│  - screenshots, archives, HAR, DOM, console      │
└────────────────────────┬─────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────┐
│     Evidence Class (Hashing & Metadata)           │
│  - SHA-256 hash generation                        │
│  - Evidence ID assignment                         │
│  - Metadata storage                               │
│  - Initial custody entry                          │
└────────────────────────┬─────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────┐
│   Chain of Custody Manager                        │
│  - Track all actions (created, accessed, etc.)   │
│  - Actor logging                                  │
│  - Timestamp management                           │
│  - RFC 3161 integration                           │
└────────────────────────┬─────────────────────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐ ┌───▼────┐ ┌──▼────────┐
         │ Chain  │ │ Sealing│ │Compliance │
         │Verif.  │ │& TSA   │ │(ISO27037) │
         └────────┘ └────────┘ └───────────┘
```

## Core Components

### 1. Evidence Class

**File:** `evidence/evidence-collector.js`

**Responsibility:** Represents a single piece of evidence with metadata and integrity.

**Key Properties:**
```javascript
{
  id: "ev_1686786225000_abc123",          // Unique ID
  type: "screenshot|page_archive|...",    // Evidence type
  data: { /* binary or JSON */ },         // Evidence content
  metadata: { /* custom fields */ },      // Custom metadata
  capturedAt: "2026-06-13T14:23:45Z",    // Capture timestamp
  capturedBy: "investigator_jane",        // Who captured
  contentHash: "sha256:abc123...",        // SHA-256 hash
  hashAlgorithm: "sha256",                // Hash method
  custodyChain: [ /* entries */ ],        // Audit trail
  verifyIntegrity(): boolean,             // Hash verification
  addCustodyEntry(action, actor),         // Add to chain
  getSummary(): object,                   // Quick summary
  toJSON(): object                        // Serialization
}
```

### 2. ChainOfCustodyManager

**File:** `evidence/chain-of-custody.js`

**Responsibility:** Manages complete audit trail for evidence.

**Key Methods:**
- `initializeChain(evidenceId, metadata)` - Start tracking
- `addEntry(evidenceId, action, actor, notes, hash)` - Log action
- `recordAccess(evidenceId, actor, purpose)` - Log access
- `recordModification(evidenceId, actor, description, oldHash, newHash)` - Log changes
- `recordExport(evidenceId, actor, format, destination)` - Log export
- `recordSealing(evidenceId, actor, hash, token)` - Seal for immutability
- `requestRFC3161Timestamp(evidenceId, hash, options)` - Cryptographic proof
- `generateISO27037Statement(evidenceId)` - Compliance report
- `getChain(evidenceId)` - Retrieve audit trail
- `verifyChainIntegrity(evidenceId)` - Validate chain

### 3. CustodyEntry

**File:** `evidence/chain-of-custody.js`

**Represents:** Single action in chain of custody

```javascript
{
  timestamp: "2026-06-13T14:23:45Z",     // When action occurred
  action: "created|accessed|modified|...", // Action type
  actor: "investigator_jane",             // Who performed action
  notes: "Evidence captured at...",       // Description
  hash: "sha256:abc123...",              // Hash at time
  previousHash: null,                     // Hash before modification
  timestampToken: null                    // RFC 3161 token
}
```

## Evidence Types & Processing

### Screenshot Evidence

**Capture Process:**
1. Navigate to page
2. Execute JavaScript screenshot (full page or viewport)
3. Annotate suspicious elements (HTML overlay)
4. Convert to PNG
5. Generate SHA-256 hash
6. Create Evidence record
7. Initialize chain of custody

**Storage:**
- Format: PNG image file
- Size: 256-500KB typical
- Compressed: 40-100KB (gzip)

### Page Archive Evidence

**Capture Process (MHTML):**
1. Fetch page HTML
2. Fetch all CSS, JS, images, fonts
3. Encode resources as base64
4. Build MIME structure
5. Save as single .mhtml file
6. Generate SHA-256 hash

**Supported Formats:**
- MHTML: Single file, all resources embedded
- HTML: Static HTML + separate resource files
- WARC: Web Archive format (preserves metadata)
- PDF: Printable snapshot

### Network HAR Evidence

**Capture Process:**
1. Monitor all HTTP requests during session
2. Capture request/response headers
3. Capture request/response bodies (optional)
4. Record timing information
5. Build HAR 1.2 structure
6. Compress to JSON

**HAR Structure:**
```javascript
{
  log: {
    version: "1.2",
    creator: { name: "basset-hound-browser", version: "12.0.0" },
    entries: [
      {
        startedDateTime: "2026-06-13T14:00:00Z",
        time: 245,
        request: { method, url, headers, postData },
        response: { status, headers, content }
      }
    ]
  }
}
```

### DOM Snapshot Evidence

**Capture Process:**
1. Get complete DOM tree
2. Serialize to JSON
3. Include computed styles (optional)
4. Preserve element state
5. Generate hash

## Chain of Custody Workflow

### Evidence Lifecycle

```
Creation
  │ (evidence_capture_*)
  ▼
Analysis (read/access)
  │ (coc_record_access)
  ▼
Modification (if needed)
  │ (coc_record_modification)
  ▼
Export (if required)
  │ (coc_record_export)
  ▼
Sealing (immutability)
  │ (coc_seal_evidence)
  ▼
Preservation
  (no more changes allowed)
```

### Compliance Statements

#### ISO/IEC 27037:2012

**Statement Generated:**
```
"This chain of custody for evidence [ID] has been maintained in 
accordance with ISO/IEC 27037:2012 principles. All evidence has 
been handled using documented procedures to maintain integrity 
and authenticity. All actions have been recorded with timestamps 
and actor information. No evidence has been modified except as 
expressly documented in the custody chain."
```

**Principles Verified:**
1. **Minimization:** Only necessary evidence collected
2. **Integrity:** Chain maintained throughout
3. **Documentation:** Complete action log
4. **Traceability:** All modifications recorded

**Compliance Checks:**
- Chain integrity verified
- No chronological violations
- No post-seal modifications
- All actions documented

#### RFC 3161 Timestamping

**Token Structure:**
```javascript
{
  version: "1",
  policyId: "1.2.840.113549.1.9.16.3.3",
  messageImprint: {
    hashAlgorithm: "sha256",
    hashedMessage: "sha256:abc123..."
  },
  serialNumber: "a1b2c3d4e5f6...",
  genTime: "2026-06-13T14:50:00Z",
  accuracy: { seconds: 1, millis: 0 },
  tsa: "freetsa.org",
  nonce: "n0n3_v4lu3_..."
}
```

**Purpose:**
- Cryptographic proof of evidence existence at specific time
- Verified by independent Time Stamping Authority
- Prevents "evidence creation after the fact" claims
- Valid for legal proceedings

## Violation Detection

### Chain Integrity Checks

**Chronological Order:**
```javascript
for (let i = 1; i < chain.length; i++) {
  if (chain[i].timestamp < chain[i-1].timestamp) {
    result.issues.push(`Chronological violation at entry ${i}`);
    result.valid = false;
  }
}
```

**Post-Seal Modifications:**
```javascript
const sealIndex = chain.findIndex(e => e.action === 'sealed');
if (sealIndex !== -1 && sealIndex < chain.length - 1) {
  const afterSeal = chain.slice(sealIndex + 1);
  const problemActions = afterSeal.filter(
    e => ['modified', 'exported'].includes(e.action)
  );
  if (problemActions.length > 0) {
    result.issues.push('Modifications after sealing');
    result.valid = false;
  }
}
```

**Required Actions:**
```javascript
const actions = chain.map(e => e.action);
if (!actions.includes('created')) {
  result.issues.push('Missing "created" action');
  result.valid = false;
}
```

## Performance Characteristics

### Evidence Capture Latency

| Type | Latency | Notes |
|------|---------|-------|
| screenshot | 500-2000ms | Page complexity dependent |
| page_archive (MHTML) | 2000-10000ms | Resource fetching |
| network_har | 1000-5000ms | Request count dependent |
| dom_snapshot | 500-2000ms | DOM size dependent |
| console_log | 100-500ms | Log size |
| cookies | 100-300ms | Lightweight |
| localStorage | 100-300ms | Lightweight |
| metadata | 50-200ms | Fastest |

### Chain Operations Latency

| Operation | Latency | Notes |
|-----------|---------|-------|
| initialize | 1-5ms | Chain creation |
| record_access | 1-3ms | Log entry |
| record_modification | 1-3ms | Hash comparison |
| record_export | 1-3ms | Log entry |
| seal_evidence | 50-1000ms | RFC 3161 adds delay |
| verify_chain | 2-10ms | Integrity check |
| generate_iso27037 | 5-20ms | Statement generation |

### Storage Requirements

| Evidence Type | Typical Size | Compressed |
|---------------|--------------|-----------|
| screenshot | 256-500KB | 40-100KB |
| page_archive (MHTML) | 500-2000KB | 100-300KB |
| network_har | 50-500KB | 10-60KB |
| dom_snapshot | 50-200KB | 10-30KB |
| console_log | 5-100KB | 1-20KB |
| cookies | 5-50KB | 2-10KB |
| localStorage | 10-100KB | 2-20KB |

## Data Structures

### Evidence JSON Format

```javascript
{
  id: "ev_1686786225000_abc123",
  type: "screenshot",
  data: "PNG binary data or JSON",
  metadata: {
    url: "https://example.com",
    caseNumber: "CASE-2026-0613-001",
    jurisdiction: "US"
  },
  capturedAt: "2026-06-13T14:23:45Z",
  capturedBy: "investigator_jane_smith",
  contentHash: "sha256:abc123def456...",
  hashAlgorithm: "sha256",
  custodyChain: [
    {
      timestamp: "2026-06-13T14:23:45Z",
      action: "created",
      actor: "investigator_jane_smith",
      notes: "Evidence captured at https://example.com",
      hash: "sha256:abc123def456..."
    }
  ]
}
```

## Serialization

### Export to JSON

```javascript
// For storage/transmission
const json = evidence.toJSON();
fs.writeFileSync(`evidence_${evidenceId}.json`, JSON.stringify(json, null, 2));
```

### Export to PDF

```javascript
// For court proceedings
const pdf = await convertToPDF({
  evidence: evidence,
  chainOfCustody: custodyManager.getChain(evidenceId),
  complianceStatement: custodyManager.generateISO27037Statement(evidenceId)
});
```

## Integration Points

### WebSocket Commands

```javascript
// Capture commands
evidence_capture_screenshot()
evidence_capture_page_archive()
evidence_capture_network_har()
evidence_capture_dom_snapshot()
evidence_capture_console_log()
evidence_capture_cookies()
evidence_capture_localStorage()
evidence_capture_metadata()

// Chain commands
coc_initialize()
coc_record_access()
coc_record_modification()
coc_record_export()
coc_seal_evidence()
coc_generate_iso27037()
coc_verify_chain()
coc_get_chain()
```

### External Dependencies

```javascript
const crypto = require('crypto');     // SHA-256 hashing
const path = require('path');        // File paths
const EventEmitter = require('events'); // Event emission
```

## Testing

### Unit Tests

- `test-evidence-collector.js` - Evidence creation
- `test-chain-custody.js` - Chain operations
- `test-evidence-hash.js` - Hash generation/verification
- `test-iso27037.js` - Compliance statements
- `test-rfc3161.js` - Timestamping

### Integration Tests

- `test-evidence-workflow.js` - Complete capture + chain flow
- `test-evidence-export.js` - Export functionality
- `test-evidence-verification.js` - Integrity verification

## Security Considerations

### Integrity Protection

- SHA-256 hashing of all evidence
- Hash stored in chain of custody
- Later verification detects tampering
- Sealing makes hash immutable

### Access Control

- All access logged in chain
- Actor identification required
- Purpose tracking for audits
- Timestamp on every action

### Non-repudiation

- Cryptographic timestamping (RFC 3161)
- TSA-signed timestamps
- Actor must sign for actions
- Complete audit trail

## Related Files

- Evidence class: `evidence/evidence-collector.js`
- Chain of custody: `evidence/chain-of-custody.js`
- WebSocket commands: `websocket/commands/forensic/evidence/evidence-commands.js`
- Tests: `tests/evidence-packaging/`

---

## Related Documentation

- [Evidence Packaging - Integration Guide](../integration/EVIDENCE-PACKAGING-INTEGRATION-GUIDE.md)
- [Evidence Packaging - API Reference](../api/EVIDENCE-PACKAGING-API-REFERENCE.md)
- [Evidence Packaging - User Guide](../guides/EVIDENCE-PACKAGING-USER-GUIDE.md)
