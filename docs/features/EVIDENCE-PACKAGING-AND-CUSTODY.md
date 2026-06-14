# Evidence Packaging & Chain of Custody - Feature Guide

**Version:** 1.0.0  
**Released:** June 13, 2026  
**Status:** ✅ Production Ready  
**Test Coverage:** 85 tests (100% passing)  
**Standards Compliance:** ISO/IEC 27037:2012, NIST SP 800-155, ACPO, RFC 3161  

---

## Overview

Evidence Packaging & Chain of Custody provides forensic-grade evidence management with support for international standards. It enables capture, organization, sealing, and export of evidence with cryptographic verification and complete chain-of-custody documentation.

### Key Capabilities

- **Individual Evidence Capture** - Screenshots, archives, HAR, DOM, console, metadata
- **Forensic Manifest Generation** - Organized evidence collections with metadata
- **Evidence Packaging** - Create immutable packages from manifests
- **Cryptographic Sealing** - SHA-256 hashing with optional RFC 3161 timestamps
- **Standards Compliance** - ISO 27037, NIST SP 800-155, ACPO requirements
- **Multiple Export Formats** - JSON, XML, ZIP, court-ready formats

---

## Quick Start

### Capture Individual Evidence

```javascript
const ws = new WebSocket('ws://localhost:8765');

// Capture screenshot evidence
ws.send(JSON.stringify({
  id: 'req-1',
  command: 'capture_screenshot_evidence',
  params: {
    imageData: 'base64_encoded_image_data...',
    url: 'https://example.com',
    title: 'Example Homepage',
    fullPage: true,
    capturedBy: 'investigator_john'
  }
}));

// Response
{
  "success": true,
  "evidenceId": "ev_1686786225000_a1b2c3d4e5f6",
  "evidence": {
    "id": "ev_1686786225000_a1b2c3d4e5f6",
    "type": "screenshot",
    "contentHash": "sha256_hash_of_image_data",
    "capturedAt": "2026-06-13T14:23:45Z",
    "url": "https://example.com"
  }
}
```

### Create Forensic Manifest

```javascript
ws.send(JSON.stringify({
  id: 'req-2',
  command: 'create_evidence_manifest',
  params: {
    sessionId: 'session_001',
    url: 'https://example.com',
    capturedBy: 'investigator_john'
  }
}));

// Response
{
  "success": true,
  "manifestId": "manifest_1686786225000_xyz789",
  "manifest": {
    "id": "manifest_1686786225000_xyz789",
    "sessionId": "session_001",
    "createdAt": "2026-06-13T14:23:45Z",
    "entries": 0
  }
}
```

### Add Evidence to Manifest

```javascript
ws.send(JSON.stringify({
  id: 'req-3',
  command: 'add_to_manifest',
  params: {
    manifestId: 'manifest_1686786225000_xyz789',
    evidenceId: 'ev_1686786225000_a1b2c3d4e5f6',
    type: 'screenshot'
  }
}));

// Response
{
  "success": true,
  "entry": {
    "evidenceId": "ev_1686786225000_a1b2c3d4e5f6",
    "type": "screenshot",
    "addedAt": "2026-06-13T14:23:45Z"
  },
  "manifestSize": 1
}
```

### Create Package from Manifest

```javascript
ws.send(JSON.stringify({
  id: 'req-4',
  command: 'create_evidence_package',
  params: {
    manifestId: 'manifest_1686786225000_xyz789',
    autoSeal: false
  }
}));

// Response
{
  "success": true,
  "packageId": "pkg_1686786225000_abc123",
  "package": {
    "id": "pkg_1686786225000_abc123",
    "manifestId": "manifest_1686786225000_xyz789",
    "sealed": false,
    "entries": 1
  }
}
```

### Seal Package (Make Immutable)

```javascript
ws.send(JSON.stringify({
  id: 'req-5',
  command: 'seal_evidence_package',
  params: {
    packageId: 'pkg_1686786225000_abc123',
    sealedBy: 'investigator_john'
  }
}));

// Response
{
  "success": true,
  "sealData": {
    "packageId": "pkg_1686786225000_abc123",
    "sealed": true,
    "packageHash": "sha256_hash_of_all_content",
    "sealedAt": "2026-06-13T14:23:45Z",
    "sealedBy": "investigator_john",
    "chainOfCustody": [
      {
        "action": "created",
        "timestamp": "2026-06-13T14:20:00Z",
        "actor": "investigator_john"
      },
      {
        "action": "sealed",
        "timestamp": "2026-06-13T14:23:45Z",
        "actor": "investigator_john"
      }
    ]
  }
}
```

### Export Package

```javascript
ws.send(JSON.stringify({
  id: 'req-6',
  command: 'export_evidence_package',
  params: {
    packageId: 'pkg_1686786225000_abc123',
    format: 'json'  // or 'xml', 'court', 'analysis'
  }
}));

// Response
{
  "success": true,
  "format": "json",
  "data": {
    "package": {
      "id": "pkg_1686786225000_abc123",
      "manifestId": "manifest_1686786225000_xyz789",
      "sealed": true,
      "sealedAt": "2026-06-13T14:23:45Z",
      "entries": [
        {
          "evidenceId": "ev_1686786225000_a1b2c3d4e5f6",
          "type": "screenshot",
          "contentHash": "sha256_hash..."
        }
      ],
      "chainOfCustody": [ /* ... */ ]
    }
  },
  "exportTime": 45
}
```

---

## Evidence Types

### 1. Screenshot Evidence

Full-page or viewport screenshots with metadata.

```javascript
ws.send(JSON.stringify({
  id: 'req-1',
  command: 'capture_screenshot_evidence',
  params: {
    imageData: 'base64_image_data',
    url: 'https://example.com',
    title: 'Example Homepage',
    viewport: { width: 1920, height: 1080 },
    fullPage: true,
    annotations: [
      { x: 100, y: 100, text: 'Login button', color: 'red' }
    ],
    capturedBy: 'investigator_john'
  }
}));
```

### 2. Page Archive Evidence

Full-page HTML/MHTML archives for offline review.

```javascript
ws.send(JSON.stringify({
  id: 'req-2',
  command: 'capture_page_archive_evidence',
  params: {
    content: 'mhtml_or_html_content_data',
    format: 'mhtml',  // or 'html', 'warc', 'pdf'
    url: 'https://example.com',
    title: 'Example Homepage',
    capturedBy: 'investigator_john'
  }
}));
```

### 3. Network HAR Evidence

HTTP Archive (HAR) with complete network data.

```javascript
ws.send(JSON.stringify({
  id: 'req-3',
  command: 'capture_har_evidence',
  params: {
    harData: {
      log: {
        version: '1.2.0',
        creator: { name: 'basset-hound-browser', version: '12.0.0' },
        entries: [
          {
            request: { method: 'GET', url: 'https://example.com', headers: [...] },
            response: { status: 200, headers: [...], content: {...} },
            timings: { wait: 100, receive: 500 }
          }
        ]
      }
    },
    url: 'https://example.com',
    capturedBy: 'investigator_john'
  }
}));
```

### 4. DOM Snapshot Evidence

Complete DOM state at capture time.

```javascript
ws.send(JSON.stringify({
  id: 'req-4',
  command: 'capture_dom_snapshot_evidence',
  params: {
    domContent: '<html>...</html>',
    url: 'https://example.com',
    capturedBy: 'investigator_john'
  }
}));
```

### 5. Console Log Evidence

Browser console output and errors.

```javascript
ws.send(JSON.stringify({
  id: 'req-5',
  command: 'capture_console_log_evidence',
  params: {
    logs: [
      { level: 'log', message: 'Page loaded', timestamp: 1686786225000 },
      { level: 'error', message: 'Failed to load script', timestamp: 1686786226000 }
    ],
    url: 'https://example.com',
    capturedBy: 'investigator_john'
  }
}));
```

### 6. Metadata Evidence

Page metadata, cookies, storage, etc.

```javascript
ws.send(JSON.stringify({
  id: 'req-6',
  command: 'capture_metadata_evidence',
  params: {
    metadata: {
      cookies: [{ name: 'session_id', value: '...', domain: '.example.com' }],
      localStorage: { key1: 'value1', key2: 'value2' },
      sessionStorage: { key3: 'value3' }
    },
    url: 'https://example.com',
    capturedBy: 'investigator_john'
  }
}));
```

---

## WebSocket Commands Reference

### Evidence Capture Commands

#### capture_screenshot_evidence

Capture screenshot evidence with hash.

**Parameters:**
- `imageData` (required): Base64 or buffer image data
- `url` (required): Page URL
- `title` (optional): Page title
- `viewport` (optional): { width, height }
- `fullPage` (optional): Full page vs. viewport only
- `annotations` (optional): Array of annotations
- `capturedBy` (optional): Actor name

**Response:**
```javascript
{
  "success": true,
  "evidenceId": "ev_...",
  "evidence": { /* evidence summary */ }
}
```

#### capture_page_archive_evidence

Capture full-page archive.

**Parameters:**
- `content` (required): MHTML/HTML/WARC/PDF content
- `format` (required): Archive format
- `url` (required): Page URL
- `title` (optional): Page title
- `capturedBy` (optional): Actor name

**Response:** Same as screenshot_evidence

#### capture_har_evidence

Capture network HAR.

**Parameters:**
- `harData` (required): HAR format object
- `url` (required): Page URL
- `capturedBy` (optional): Actor name

**Response:** Same as screenshot_evidence

#### capture_dom_snapshot_evidence

Capture DOM snapshot.

**Parameters:**
- `domContent` (required): Full HTML DOM
- `url` (required): Page URL
- `capturedBy` (optional): Actor name

**Response:** Same as screenshot_evidence

#### capture_console_log_evidence

Capture console output.

**Parameters:**
- `logs` (required): Array of log entries
- `url` (required): Page URL
- `capturedBy` (optional): Actor name

**Response:** Same as screenshot_evidence

#### capture_metadata_evidence

Capture metadata (cookies, storage, etc).

**Parameters:**
- `metadata` (required): { cookies, localStorage, sessionStorage }
- `url` (required): Page URL
- `capturedBy` (optional): Actor name

**Response:** Same as screenshot_evidence

### Manifest & Package Commands

#### create_evidence_manifest

Create new forensic manifest.

**Parameters:**
- `sessionId` (required): Session identifier
- `url` (required): Page URL
- `capturedBy` (required): Actor name

**Response:**
```javascript
{
  "success": true,
  "manifestId": "manifest_...",
  "manifest": { /* manifest data */ }
}
```

#### add_to_manifest

Add evidence to manifest.

**Parameters:**
- `manifestId` (required): Manifest ID
- `evidenceId` (required): Evidence ID
- `type` (required): Evidence type

**Response:**
```javascript
{
  "success": true,
  "entry": { /* entry data */ },
  "manifestSize": 5
}
```

#### create_evidence_package

Create package from manifest.

**Parameters:**
- `manifestId` (required): Manifest ID
- `autoSeal` (optional): Auto-seal immediately (default false)

**Response:**
```javascript
{
  "success": true,
  "packageId": "pkg_...",
  "package": { /* package data */ }
}
```

#### seal_evidence_package

Seal package (make immutable).

**Parameters:**
- `packageId` (required): Package ID
- `sealedBy` (required): Actor name

**Response:**
```javascript
{
  "success": true,
  "sealData": {
    "packageId": "pkg_...",
    "sealed": true,
    "packageHash": "sha256_...",
    "chainOfCustody": [ /* custody chain */ ]
  }
}
```

#### verify_evidence_package

Verify package integrity.

**Parameters:**
- `packageId` (required): Package ID

**Response:**
```javascript
{
  "success": true,
  "valid": true,
  "issues": [],
  "details": {
    "packageHash": "sha256_...",
    "verified": true,
    "allEntriesVerified": true
  }
}
```

#### export_evidence_package

Export package in specified format.

**Parameters:**
- `packageId` (required): Package ID
- `format` (required): 'json' | 'xml' | 'court' | 'analysis'

**Response:**
```javascript
{
  "success": true,
  "format": "json",
  "data": { /* exported data */ },
  "exportTime": 45
}
```

#### export_evidence_package_zip

Export as ZIP bundle.

**Parameters:**
- `packageId` (required): Package ID
- `destination` (optional): Storage path

**Response:**
```javascript
{
  "success": true,
  "zipData": "base64_zip_data",
  "filename": "evidence_pkg_....zip"
}
```

#### request_rfc3161_timestamp

Request RFC 3161 timestamp for sealed package.

**Parameters:**
- `packageId` (required): Package ID
- `authority` (optional): TSA authority (default freetsa.org)

**Response:**
```javascript
{
  "success": true,
  "timestampToken": "rfc3161_token_data",
  "authority": "freetsa.org",
  "timestamp": "2026-06-13T14:23:45Z"
}
```

---

## Standards Compliance

### ISO/IEC 27037:2012 Forensic Evidence Handling

**Principles Implemented:**
1. **Integrity** - SHA-256 hashing prevents tampering
2. **Authenticity** - Chain-of-custody documentation
3. **Reliability** - RFC 3161 timestamps for non-repudiation
4. **Compliance** - Standardized metadata and export formats

**Compliance Statement:**
```javascript
// Generate compliance statement
ws.send(JSON.stringify({
  id: 'req-7',
  command: 'generate_iso27037_statement',
  params: {
    packageId: 'pkg_...'
  }
}));

// Response includes compliance certification
```

### NIST SP 800-155 Guidelines

**Guidelines Followed:**
- Hash-based verification (SHA-256)
- Secure storage considerations
- Integrity monitoring
- Metadata completeness

### ACPO Guidelines

**Guidelines Followed:**
- Legal admissibility
- Chain-of-custody documentation
- Professional handling procedures
- Clear audit trails

---

## Best Practices

### 1. Organize Evidence Properly

```javascript
// Group related evidence in single manifest
const manifestId = 'manifest_' + Date.now();

// Create manifest
await createManifest(sessionId, url);

// Capture multiple pieces of evidence
await captureScreenshot(url, manifestId);
await captureDOM(url, manifestId);
await captureHAR(harData, manifestId);
await captureMetadata(metadata, manifestId);
```

### 2. Seal Immediately After Collection

```javascript
// Create package and seal immediately after collection
const packageId = await createPackage(manifestId, autoSeal=true);

// Verify seal
const verification = await verifyPackage(packageId);
if (!verification.valid) {
  console.error('Package verification failed!');
  // Investigate before proceeding
}
```

### 3. Add RFC 3161 Timestamp for Court Admissibility

```javascript
// Request timestamp for sealed packages
const timestamp = await requestRFC3161Timestamp(packageId);

console.log('Timestamp Authority:', timestamp.authority);
console.log('Timestamp:', timestamp.timestamp);
console.log('Token:', timestamp.timestampToken);
```

### 4. Document Chain of Custody

```javascript
// Document all handlers and access
const result = await sealPackage(packageId, {
  sealedBy: 'investigator_john',
  custodyChain: [
    { action: 'captured', actor: 'auto', timestamp: '2026-06-13T14:00:00Z' },
    { action: 'reviewed', actor: 'investigator_john', timestamp: '2026-06-13T14:15:00Z' },
    { action: 'sealed', actor: 'investigator_john', timestamp: '2026-06-13T14:23:45Z' }
  ]
});
```

### 5. Export for Court Submission

```javascript
// Export in court-ready format
const courtExport = await exportPackage(packageId, 'court');

// Includes:
// - ISO 27037 compliance statement
// - Complete chain-of-custody
// - Verification hashes
// - Metadata completeness
// - Professional formatting
```

---

## Export Formats

### JSON Format

Structured, analysis-ready format.

```javascript
{
  "package": {
    "id": "pkg_...",
    "sealed": true,
    "sealedAt": "2026-06-13T14:23:45Z",
    "entries": [...]
  },
  "chainOfCustody": [...],
  "compliance": {...}
}
```

### XML Format

Standards-compliant format for interoperability.

```xml
<?xml version="1.0"?>
<package>
  <metadata>
    <id>pkg_...</id>
    <sealed>true</sealed>
    <sealedAt>2026-06-13T14:23:45Z</sealedAt>
  </metadata>
  <entries>...</entries>
  <chainOfCustody>...</chainOfCustody>
</package>
```

### Court Format

Human-readable professional format for legal proceedings.

```
EVIDENCE PACKAGE REPORT
=======================
Package ID: pkg_...
Created: 2026-06-13 14:00:00 UTC
Sealed: 2026-06-13 14:23:45 UTC
Status: SEALED & VERIFIED

CHAIN OF CUSTODY
================
...

EVIDENCE ENTRIES
================
...

COMPLIANCE CERTIFICATION
========================
...
```

### Analysis Format

Optimized for further analysis and tool processing.

```javascript
{
  "summary": {...},
  "evidence": [
    { "id": "ev_...", "type": "screenshot", "hash": "..." }
  ],
  "statistics": {...},
  "recommendations": [...]
}
```

---

## Integration Example: Complete Workflow

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');

async function captureAndPackageEvidence(sessionId, url, investigator) {
  try {
    // 1. Capture individual evidence
    console.log('Capturing evidence...');
    const screenshot = await captureScreenshot(url, investigator);
    const har = await captureHAR(harData, url, investigator);
    const dom = await captureDOM(domContent, url, investigator);
    const metadata = await captureMetadata(metadataObject, url, investigator);
    
    // 2. Create manifest
    console.log('Creating forensic manifest...');
    const manifest = await createManifest(sessionId, url, investigator);
    
    // 3. Add evidence to manifest
    console.log('Organizing evidence...');
    await addToManifest(manifest.id, screenshot.id, 'screenshot');
    await addToManifest(manifest.id, har.id, 'har');
    await addToManifest(manifest.id, dom.id, 'dom');
    await addToManifest(manifest.id, metadata.id, 'metadata');
    
    // 4. Create and seal package
    console.log('Creating evidence package...');
    const pkg = await createPackage(manifest.id, autoSeal=true);
    
    // 5. Request RFC 3161 timestamp
    console.log('Requesting RFC 3161 timestamp...');
    const timestamp = await requestRFC3161Timestamp(pkg.id);
    
    // 6. Verify integrity
    console.log('Verifying package integrity...');
    const verification = await verifyPackage(pkg.id);
    if (!verification.valid) {
      throw new Error('Package verification failed!');
    }
    
    // 7. Export for court submission
    console.log('Exporting for court submission...');
    const courtExport = await exportPackage(pkg.id, 'court');
    
    console.log('Evidence packaging complete!');
    console.log('Package ID:', pkg.id);
    console.log('Timestamp:', timestamp.timestamp);
    console.log('Verification:', verification.valid);
    
    return pkg;
  } catch (error) {
    console.error('Evidence packaging failed:', error);
    throw error;
  }
}
```

---

## Performance Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| Capture Screenshot | <500ms | Includes hashing |
| Seal Package (10 items) | <100ms | SHA-256 of all content |
| Request RFC 3161 Timestamp | 1-3s | Network dependent |
| Export to JSON | <100ms | Small packages |
| Export to ZIP | 500ms-2s | Depends on size |
| Verify Package | <50ms | Hash verification only |

---

## See Also

- [Evidence Packaging Implementation](../EVIDENCE-PACKAGING-IMPLEMENTATION-COMPLETE-2026-06-13.md)
- [Quick Start Guide](../EVIDENCE-PACKAGING-QUICK-START.md)
- [Chain of Custody Guide](../guides/FORENSIC-CHAIN-OF-CUSTODY-GUIDE.md)
- [Forensic Evidence Export Guide](../guides/FORENSIC-EVIDENCE-EXPORT-GUIDE-2026-05-31.md)
