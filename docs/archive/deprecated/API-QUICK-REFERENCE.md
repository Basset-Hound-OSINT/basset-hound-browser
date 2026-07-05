# Basset Hound Browser - API Quick Reference Card

**Version**: 13.0.0  
**Protocol**: WebSocket  
**Port**: 8765  
**Status**: 140+ Commands Documented

---

## Connection

```javascript
// Connect
const ws = new WebSocket('ws://localhost:8765');

// Send command
ws.send(JSON.stringify({
  id: 'req-1',
  command: 'command_name',
  param1: 'value1'
}));

// Receive response
ws.onmessage = (evt) => {
  const resp = JSON.parse(evt.data);
  if (resp.success) console.log(resp.data);
  else console.error(resp.error);
};
```

---

## Command Categories (Quick Index)

### Evidence Capture (8 commands)
- `capture_screenshot_evidence` - Screenshot as evidence
- `capture_page_archive_evidence` - HTML/MHTML archive
- `capture_har_evidence` - Network traffic (HAR)
- `capture_dom_evidence` - DOM tree snapshot
- `capture_console_evidence` - JS console logs
- `capture_cookies_evidence` - All cookies
- `capture_storage_evidence` - localStorage/sessionStorage
- `get_evidence_types` - List evidence types

### Network Forensics (26 commands)
Most important: `start_network_forensics_capture`, `capture_dns_query`, `capture_tls_certificate`, `capture_http_headers`, `stop_network_forensics_capture`, `export_forensic_report`

### Legal Compliance (6 commands)
- `start_legal_compliance_mode` - Enable chain-of-custody
- `export_with_chain_of_custody` - Export with CoC
- `export_court_admissible_package` - Daubert-compliant
- `certify_evidence_integrity` - Integrity certification
- `generate_swgde_report` - SWGDE standard report
- `get_legal_compliance_status` - Compliance status

### Evidence Correlation (5 commands)
- `start_evidence_correlation` - Begin correlation
- `correlate_evidence_across_sites` - Cross-site linking
- `identify_common_patterns` - Pattern detection
- `get_correlation_graph` - Graph structure
- `export_correlation_report` - Correlation report

### Evidence Packaging (19 commands)
Workflow: `create_evidence_package` → `create_evidence_manifest` → `add_to_manifest` → `build_evidence_package` → `seal_evidence_package` → `export_evidence_package`

### DOM Snapshots (7 commands)
- `export_dom_tree` - Full DOM structure
- `export_dom_attributes` - Element attributes
- `export_dom_computed_styles` - CSS styles
- `export_dom_text_content` - Text only
- `export_dom_form_state` - Form field values
- `export_dom_event_listeners` - Event handlers
- `export_dom_mutations` - DOM changes

### JavaScript/Console (10 commands)
- `export_console_logs` - All console.log()
- `export_console_errors` - Console errors
- `export_scripts_all` - All loaded scripts
- `export_globals` - Global variables
- `export_localstorage` - localStorage items
- `export_performance_timeline` - Performance metrics

### HTML Capture (6 commands)
- `export_html_raw` - Original HTML
- `export_html_formatted` - Prettified HTML
- `export_html_with_metadata` - HTML + metadata
- `export_html_diff` - Changes between snapshots
- `get_capture_stats` - Snapshot statistics

### Export Formats (8 commands)
- `export_format_json`, `export_format_csv`, `export_format_xml`, `export_format_har`, `export_format_warc`, `export_format_markdown`, `export_format_sqlite`, `export_format_custom`

### Encrypted Export (8 commands)
- `generate_export_key` - Generate key
- `derive_export_key` - Derive from passphrase
- `encrypt_export` - Encrypt data
- `decrypt_export` - Decrypt data
- Plus 4 more specialized encryption commands

---

## Common Workflows

### Evidence Capture Workflow
```javascript
// 1. Capture screenshot
ws.send(JSON.stringify({
  id: '1',
  command: 'capture_screenshot_evidence',
  imageData: 'base64...',
  url: 'https://example.com'
}));

// 2. Capture page archive
ws.send(JSON.stringify({
  id: '2',
  command: 'capture_page_archive_evidence',
  content: '<!DOCTYPE html>...',
  format: 'mhtml',
  url: 'https://example.com'
}));

// 3. Start network capture
ws.send(JSON.stringify({
  id: '3',
  command: 'start_network_forensics_capture'
}));
// ... network activity happens ...
// 4. Stop capture
ws.send(JSON.stringify({
  id: '4',
  command: 'stop_network_forensics_capture'
}));
```

### Create & Export Evidence Package
```javascript
// 1. Create package
ws.send(JSON.stringify({
  id: '10',
  command: 'create_evidence_package',
  name: 'Case-123',
  caseId: 'CASE-123'
}));

// 2. Create manifest
ws.send(JSON.stringify({
  id: '11',
  command: 'create_evidence_manifest',
  packageId: 'pkg_001'
}));

// 3. Add evidence
ws.send(JSON.stringify({
  id: '12',
  command: 'add_to_manifest',
  manifestId: 'mf_001',
  evidenceId: 'ev_abc123'
}));

// 4. Build, seal, and export
ws.send(JSON.stringify({
  id: '13',
  command: 'build_evidence_package',
  packageId: 'pkg_001',
  format: 'zip'
}));

ws.send(JSON.stringify({
  id: '14',
  command: 'seal_evidence_package',
  packageId: 'pkg_001'
}));

ws.send(JSON.stringify({
  id: '15',
  command: 'export_evidence_package',
  packageId: 'pkg_001',
  format: 'zip'
}));
```

### Court-Ready Export
```javascript
// Enable compliance mode
ws.send(JSON.stringify({
  id: '20',
  command: 'start_legal_compliance_mode',
  jurisdiction: 'US-Federal'
}));

// Export court-admissible package
ws.send(JSON.stringify({
  id: '21',
  command: 'export_court_admissible_package',
  evidenceIds: ['ev_abc123'],
  jurisdiction: 'US-Federal'
}));

// Generate SWGDE report
ws.send(JSON.stringify({
  id: '22',
  command: 'generate_swgde_report',
  evidenceIds: ['ev_abc123']
}));
```

### Encrypted Export
```javascript
// 1. Generate key
ws.send(JSON.stringify({
  id: '30',
  command: 'generate_export_key',
  algorithm: 'AES-256-GCM'
}));

// 2. Encrypt HTML export
ws.send(JSON.stringify({
  id: '31',
  command: 'export_raw_html_encrypted',
  keyId: 'key_001'
}));
```

---

## Common Parameters

| Parameter | Type | Purpose |
|-----------|------|---------|
| `format` | string | Output: json, csv, xml, pdf, har, warc, etc. |
| `limit` | number | Max results (for list operations) |
| `offset` | number | Pagination offset |
| `includeMetadata` | boolean | Include metadata in output |
| `includeHashes` | boolean | Include SHA256 hashes |
| `includeChain` | boolean | Include chain of custody |
| `compressed` | boolean | Compress output |
| `encrypted` | boolean | Encrypt output |
| `detailed` | boolean | Detailed vs summary format |

---

## Response Format

### Success
```json
{
  "id": "req-1",
  "command": "capture_screenshot_evidence",
  "success": true,
  "data": { }
}
```

### Error
```json
{
  "id": "req-1",
  "command": "capture_screenshot_evidence",
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "recovery": {
    "suggestion": "Try this...",
    "alternativeCommands": ["cmd1", "cmd2"]
  }
}
```

---

## Performance Tips

1. **Use batch commands**: Export multiple items at once
2. **Enable compression**: Reduce payload size by 70-90%
3. **Progressive loading**: Use limit/offset for large datasets
4. **Selective export**: Only capture needed data
5. **Hash verification**: Always verify evidence integrity

---

## Debugging Commands

```javascript
// Check network forensics status
ws.send(JSON.stringify({
  id: '100',
  command: 'get_network_forensics_status'
}));

// Get statistics
ws.send(JSON.stringify({
  id: '101',
  command: 'get_network_forensics_stats'
}));

// List packages
ws.send(JSON.stringify({
  id: '102',
  command: 'list_evidence_packages'
}));

// Get package details
ws.send(JSON.stringify({
  id: '103',
  command: 'get_evidence_package',
  packageId: 'pkg_001'
}));
```

---

## Key Points

- **140+ commands** across 13 categories
- **No authentication required** (development tool)
- **All commands unrestricted** - full browser access
- **SHA256 hashing** for evidence verification
- **Chain of custody** support for legal cases
- **Multiple export formats** (JSON, CSV, PDF, HAR, WARC, etc.)
- **Encryption support** (AES-256-GCM)
- **Compression** (70-93% reduction)

---

**Complete Reference**: See `API-REFERENCE-AUTHORITATIVE.md`  
**Status**: Production Ready  
**Generated**: 2026-06-21
