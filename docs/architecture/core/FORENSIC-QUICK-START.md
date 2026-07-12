> ⚠️ **HISTORICAL / SUPERSEDED** — authoritative status: **docs/planning/PROJECT-STATUS-MATRIX.md** (2026-07-04). For the CURRENT forensic capture flow use the one-shot `forensic_capture` command (navigate → evidence bundle + SHA-256 manifest); see handoffs/MCP-FORENSIC-CAPTURE-TOOL-2026-07-04.md. The evidence-packaging / 5-minute flow below is stale/partly-removed.

# Basset Hound Browser - Forensic Quick Start Guide

**Version:** 1.0  
**Date:** June 20, 2026  
**Purpose:** Get started with forensic evidence extraction in 5 minutes

---

## What Is This Browser?

Basset Hound Browser is a **forensic data collection tool** designed for legitimate investigations. It extracts raw, unfiltered data from web pages with cryptographic integrity verification.

**Key Characteristics:**
- ✅ Extract complete HTML, DOM, network traffic, storage contents
- ✅ All data captured with SHA-256 hashing for integrity
- ✅ Complete audit trail of every operation (chain of custody)
- ✅ Bypass bot detection using realistic behavior simulation
- ✅ WebSocket API (language-independent)
- ✅ Docker deployment (standardized, reproducible)

**Not A:**
- Security-hardened browser (unrestricted access)
- Production web browser (forensic research tool)
- Automatic analyst (you make intelligence decisions)

---

## 5-Minute Setup

### 1. Start the Browser (Docker)

```bash
# Pull latest image
docker pull your-registry/basset-hound-browser:12.7.0

# Run container
docker run -d \
  --name basset-hound \
  -p 8765:8765 \
  your-registry/basset-hound-browser:12.7.0

# Verify it's running
curl http://localhost:8765/health
```

### 2. Connect via WebSocket

```python
import json
import asyncio
import websockets

async def extract_evidence():
    uri = "ws://localhost:8765"
    
    async with websockets.connect(uri) as websocket:
        # Request raw HTML extraction
        command = {
            "id": "extract_001",
            "command": "export_raw_html",
            "url": "https://example.com"
        }
        
        await websocket.send(json.dumps(command))
        response = await websocket.recv()
        
        result = json.loads(response)
        print(json.dumps(result, indent=2))

asyncio.run(extract_evidence())
```

### 3. Extract Evidence

The browser responds with:

```json
{
  "success": true,
  "result": {
    "url": "https://example.com",
    "html": "<!DOCTYPE html>...",
    "statusCode": 200,
    "timestamp": "2026-06-20T10:30:00.000Z"
  },
  "integrity": {
    "algorithm": "SHA-256",
    "hash": "abc123def456...",
    "size": 45320
  }
}
```

**Key Elements:**
- `html` - Raw HTML source (100% captured)
- `statusCode` - HTTP response code
- `timestamp` - When extracted (forensic record)
- `hash` - SHA-256 for integrity verification

---

## Common Extraction Tasks

### Extract Full HTML with Metadata

```python
command = {
    "id": "extract_001",
    "command": "export_raw_html",
    "url": "https://example.com"
}
```

**Returns:** Complete HTML source + HTTP headers + timing

---

### Extract DOM State (Elements, Form Values)

```python
command = {
    "id": "dom_001",
    "command": "export_dom_snapshot",
    "url": "https://example.com"
}
```

**Returns:** Complete DOM tree + computed styles + form field values

---

### Capture Network Traffic (HAR Format)

```python
command = {
    "id": "network_001",
    "command": "export_network_log",
    "url": "https://example.com"
}
```

**Returns:** All HTTP requests/responses in standard HAR format

---

### Extract All Cookies

```python
command = {
    "id": "storage_001",
    "command": "export_storage",
    "url": "https://example.com"
}
```

**Returns:** Cookies, localStorage, sessionStorage, IndexedDB

---

### Extract Image EXIF Metadata

```python
command = {
    "id": "media_001",
    "command": "extract_image_metadata",
    "url": "https://example.com"
}
```

**Returns:** GPS coordinates, camera info, timestamps from images

---

## Forensic Best Practices

### 1. Always Verify Integrity

```python
# Extract evidence
evidence = extract_html("https://example.com")

# Verify hash (prevent tampering)
import hashlib
calculated_hash = hashlib.sha256(evidence["html"].encode()).hexdigest()
assert calculated_hash == evidence["integrity"]["hash"], "Tampering detected!"
```

### 2. Document Everything

```python
audit_log = {
    "investigationId": "INV-2026-001",
    "timestamp": "2026-06-20T10:30:00.000Z",
    "examiner": "Dr. Jane Smith",
    "url": "https://example.com",
    "command": "export_raw_html",
    "resultHash": evidence["integrity"]["hash"],
    "purpose": "Copyright infringement investigation"
}
```

### 3. Export in Multiple Formats

```python
# Original extraction
raw_evidence = extract_html(url)

# Export as JSON (structured)
export_json(raw_evidence)

# Export as HAR (for network analysis)
network_evidence = extract_network_log(url)
export_har(network_evidence)

# Export as CSV (for spreadsheet analysis)
dom_evidence = extract_dom_snapshot(url)
export_csv(dom_evidence)
```

### 4. Preserve Chain of Custody

Every extraction includes:
- **Timestamp** - When it was captured
- **Hash** - Integrity verification
- **Metadata** - Source information
- **Audit Entry** - Who did it and why

---

## Access Blocked Sites (Bot Evasion)

Some sites block automation. Use evasion:

```python
command = {
    "id": "config_001",
    "command": "set_evasion_profile",
    "profile": {
        "fingerprint_spoofing": True,      # Hide automation
        "behavioral_ai": True,              # Realistic behavior
        "honeypot_detection": True,         # Avoid traps
        "rate_limiting": True               # Realistic speed
    }
}

# Now extraction should work on protected sites
extract_html("https://protected-site.com")
```

---

## Multi-Page Investigation

Extract evidence from multiple pages:

```python
urls = [
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3"
]

evidence_collection = []

for url in urls:
    evidence = extract_html(url)
    
    # Verify integrity before storing
    verify_hash(evidence)
    
    evidence_collection.append({
        "url": url,
        "timestamp": evidence["timestamp"],
        "hash": evidence["integrity"]["hash"],
        "size": evidence["integrity"]["size"]
    })

# Export all as batch
export_batch(evidence_collection)
```

---

## Correlate Evidence Across Sites

```python
command = {
    "id": "correlate_001",
    "command": "correlate_data",
    "extractions": ["extract_001", "extract_002", "extract_003"],
    "correlationFields": ["email", "phone", "socialMedia"]
}

# Returns: Common data across sites
# Use case: Track same person across multiple accounts
```

---

## Common Commands Reference

| Command | Purpose | Returns |
|---------|---------|---------|
| `export_raw_html` | Raw HTML + metadata | Complete HTML source |
| `export_dom_snapshot` | Page structure at point in time | Complete DOM tree |
| `export_network_log` | All HTTP requests/responses | HAR format |
| `export_all_scripts` | JavaScript code | All scripts + console logs |
| `export_all_css` | CSS rules and styles | All stylesheets |
| `extract_image_metadata` | Image EXIF data | GPS, camera, timestamps |
| `export_storage` | Cookies, localStorage, IndexedDB | All storage contents |
| `export_page_metadata` | Meta tags, Open Graph, etc | Page metadata |
| `export_data` | Convert to different format | JSON/CSV/HAR/etc |
| `correlate_data` | Find patterns across extractions | Common data |

---

## Error Handling

Every response includes success status:

```python
response = extract_html(url)

if not response["success"]:
    error_message = response.get("error", "Unknown error")
    print(f"Extraction failed: {error_message}")
else:
    evidence = response["result"]
    # Process evidence
```

---

## Exporting Evidence

### To JSON (Structured Data)
```python
export_format = {
    "command": "export_data",
    "sourceData": evidence,
    "format": "json"
}
```

### To CSV (Spreadsheet Analysis)
```python
export_format = {
    "command": "export_data",
    "sourceData": evidence,
    "format": "csv"
}
```

### To HAR (Network Standard)
```python
export_format = {
    "command": "export_data",
    "sourceData": network_evidence,
    "format": "har"
}
```

### To SQLite (Queryable Database)
```python
export_format = {
    "command": "export_data",
    "sourceData": evidence,
    "format": "sqlite"
}

# Now query with SQL
import sqlite3
db = sqlite3.connect("evidence.db")
results = db.execute("SELECT * FROM pages WHERE hasImages > 5").fetchall()
```

---

## Integration Example: Full Forensic Workflow

```python
import json
import asyncio
import websockets
import hashlib

async def forensic_investigation(target_urls):
    uri = "ws://localhost:8765"
    evidence_package = []
    
    async with websockets.connect(uri) as websocket:
        for i, url in enumerate(target_urls):
            # 1. Extract evidence
            command = {
                "id": f"extract_{i}",
                "command": "export_raw_html",
                "url": url
            }
            
            await websocket.send(json.dumps(command))
            response = json.loads(await websocket.recv())
            
            # 2. Verify integrity
            if not response["success"]:
                print(f"Failed to extract {url}")
                continue
            
            evidence = response["result"]
            calculated_hash = hashlib.sha256(
                evidence["html"].encode()
            ).hexdigest()
            
            if calculated_hash != evidence["integrity"]["hash"]:
                print(f"WARNING: Hash mismatch on {url}")
                continue
            
            # 3. Document evidence
            evidence_package.append({
                "url": url,
                "timestamp": evidence["timestamp"],
                "hash": evidence["integrity"]["hash"],
                "size": evidence["integrity"]["size"],
                "statusCode": evidence.get("statusCode")
            })
            
            print(f"✓ Extracted {url}")
    
    # 4. Export complete package
    return evidence_package

# Run investigation
async def main():
    urls = [
        "https://example.com",
        "https://example.com/about",
        "https://example.com/contact"
    ]
    
    evidence = await forensic_investigation(urls)
    print(json.dumps(evidence, indent=2))

asyncio.run(main())
```

---

## Next Steps

### Learn More
1. **Full Scope:** Read [PROJECT-SCOPE.md](../../archives/prune-2026-07-06/PROJECT-SCOPE.md)
2. **Technical Details:** Read [FORENSIC-ARCHITECTURE.md](FORENSIC-ARCHITECTURE.md)
3. **All Commands:** Reference [API-REFERENCE-v12.7.0.md](../../archive/deprecated/API-REFERENCE-v12.7.0.md)
4. **Integration Patterns:** Read [CUSTOM-INTEGRATION-GUIDE.md](CUSTOM-INTEGRATION-GUIDE.md)

### Common Questions

**Q: Is the browser legal to use?**
A: Yes, for legitimate investigations where you have proper authorization. See [PROJECT-SCOPE.md](../../archives/prune-2026-07-06/PROJECT-SCOPE.md) for details.

**Q: How do I extract evidence admissible in court?**
A: Follow chain of custody requirements. See [FORENSIC-CHAIN-OF-CUSTODY-GUIDE.md](FORENSIC-CHAIN-OF-CUSTODY-GUIDE.md).

**Q: How do I bypass bot detection?**
A: Use `set_evasion_profile` command with behavioral AI enabled.

**Q: Can I extract from multiple sites in parallel?**
A: Yes, the browser supports 200+ concurrent connections.

**Q: What formats can I export to?**
A: JSON, CSV, HAR, WARC, SQLite, Markdown, XML. See [FORENSIC-EXPORTS-API-REFERENCE.md](../../archive/deprecated/FORENSIC-EXPORTS-API-REFERENCE.md).

---

## Support

- **Documentation:** See [FORENSIC-DOCUMENTATION-INDEX.md](FORENSIC-DOCUMENTATION-INDEX.md)
- **API Reference:** See [API-REFERENCE-v12.7.0.md](../../archive/deprecated/API-REFERENCE-v12.7.0.md)
- **Integration Help:** See [CUSTOM-INTEGRATION-GUIDE.md](CUSTOM-INTEGRATION-GUIDE.md)

---

**Start with the examples above, then dive into full documentation as needed.**

*Last Updated: June 20, 2026*
