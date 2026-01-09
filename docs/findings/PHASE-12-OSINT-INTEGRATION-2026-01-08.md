# Phase 12: OSINT Agent Integration - Implementation Report

**Date:** January 8, 2026
**Version:** 9.4.0
**Status:** COMPLETED

---

## Overview

Phase 12 implements comprehensive OSINT (Open Source Intelligence) agent integration for basset-hound-browser. This phase enables AI agents and automated tools to conduct structured investigations, extract OSINT data from web pages, and prepare findings for ingestion into the basset-hound platform.

---

## Key Components Implemented

### 1. InvestigationManager Class

A full-featured investigation management system that tracks:
- Investigation lifecycle (create, active, complete)
- URL queue with depth tracking
- Pattern-based URL filtering
- Findings with provenance
- Evidence attachments
- Error logging

```javascript
const manager = new InvestigationManager();
const inv = manager.createInvestigation({
  name: 'Target Research',
  caseNumber: 'CASE-2026-001',
  maxDepth: 2,
  patterns: ['/team', '/about'],
});
```

### 2. OSINT Data Extraction

13 data patterns with validation and basset-hound type mapping:

| Type | Pattern | basset-hound Type |
|------|---------|-------------------|
| email | RFC 5322 | EMAIL |
| phone | US/International | PHONE |
| crypto_btc | Bitcoin | CRYPTO_ADDRESS |
| crypto_eth | Ethereum | CRYPTO_ADDRESS |
| crypto_xmr | Monero | CRYPTO_ADDRESS |
| social_twitter | @handle | SOCIAL_MEDIA |
| social_linkedin | /in/profile | SOCIAL_MEDIA |
| social_github | /username | SOCIAL_MEDIA |
| ip_address | IPv4 | IP_ADDRESS |
| domain | Common TLDs | DOMAIN |
| onion | .onion | DOMAIN |
| ssn | XXX-XX-XXXX | SSN (sensitive) |
| credit_card | Card formats | CREDIT_CARD (sensitive) |

### 3. Investigation Workflow

```
┌─────────────────────────────────────────────────────────┐
│                  Investigation Workflow                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. create_investigation(name, config)                  │
│           │                                              │
│           ▼                                              │
│  2. queue_investigation_url(url, depth=0)               │
│           │                                              │
│           ▼                                              │
│  3. get_next_investigation_url() ◄──────────────┐       │
│           │                                      │       │
│           ▼                                      │       │
│  4. browser_navigate(url)                        │       │
│           │                                      │       │
│           ▼                                      │       │
│  5. investigate_page()                           │       │
│      - extract_osint_data()                      │       │
│      - capture_screenshot_evidence()             │       │
│      - investigate_links() ─────────────────────►│       │
│           │                                              │
│           ▼                                              │
│  6. Repeat until queue empty                            │
│           │                                              │
│           ▼                                              │
│  7. complete_investigation()                            │
│           │                                              │
│           ▼                                              │
│  8. prepare_for_basset_hound()                          │
│           │                                              │
│           ▼                                              │
│  9. Store orphans in basset-hound API                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 4. basset-hound Integration

Findings are automatically mapped to basset-hound orphan format:

```javascript
// Input finding
{
  type: 'crypto_btc',
  value: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
  context: 'Send donations to 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
  confidence: 0.9
}

// Output orphan (basset-hound format)
{
  identifier_type: 'CRYPTO_ADDRESS',
  identifier_value: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
  metadata: {
    source_type: 'crypto_btc',
    subtype: 'BTC',
    context: '...',
    confidence: 0.9
  },
  provenance: {
    sourceType: 'website',
    sourceUrl: 'https://example.com',
    capturedAt: '2026-01-08T...',
    capturedBy: 'basset-hound-browser',
    investigationId: 'inv_...'
  },
  tags: ['investigation:inv_...', 'crypto_btc', 'subtype:BTC']
}
```

---

## WebSocket Commands (18 total)

### Investigation Management
- `create_investigation` - Create with config
- `get_investigation` - Get by ID
- `list_investigations` - List all
- `set_active_investigation` - Set active
- `complete_investigation` - Complete
- `export_investigation` - Full export

### OSINT Extraction
- `extract_osint_data` - Extract from page
- `get_osint_data_types` - Get available types

### Investigation Workflow
- `investigate_page` - Full page investigation
- `investigate_links` - Queue page links
- `queue_investigation_url` - Add URL to queue
- `get_next_investigation_url` - Get next URL
- `get_investigation_queue` - View queue

### Findings & Export
- `get_investigation_findings` - Get findings
- `get_findings_summary` - Summary by type
- `prepare_for_basset_hound` - Export for API

---

## MCP Tools (12 total, 88 cumulative)

| Tool | Description |
|------|-------------|
| `browser_create_investigation` | Create new investigation |
| `browser_extract_osint_data` | Extract OSINT data |
| `browser_investigate_page` | Full page investigation |
| `browser_investigate_links` | Queue links |
| `browser_get_next_investigation_url` | Get next URL |
| `browser_get_investigation_findings` | Get findings |
| `browser_get_findings_summary` | Summary |
| `browser_prepare_for_basset_hound` | Prepare orphans |
| `browser_complete_investigation` | Complete |
| `browser_export_investigation` | Export |
| `browser_list_investigations` | List all |
| `browser_get_osint_data_types` | Get types |

---

## Usage Example

### Python Agent Usage

```python
import asyncio
from basset_hound_browser import BassetHoundBrowser

async def investigate_target(target_url: str):
    browser = BassetHoundBrowser()
    await browser.connect()

    # Create investigation
    inv = await browser.send_command('create_investigation', {
        'name': 'Target Research',
        'caseNumber': 'CASE-001',
        'maxDepth': 2,
        'patterns': ['/about', '/team', '/contact']
    })

    # Queue initial URL
    await browser.send_command('queue_investigation_url', {
        'url': target_url,
        'depth': 0
    })

    # Process queue
    while True:
        next_url = await browser.send_command('get_next_investigation_url')
        if not next_url.get('hasNext'):
            break

        # Navigate and investigate
        await browser.navigate(next_url['url'])
        await browser.send_command('investigate_page', {
            'captureEvidence': True,
            'extractData': True,
            'followLinks': True
        })

        # Respect rate limit
        await asyncio.sleep(1)

    # Complete and export
    await browser.send_command('complete_investigation')
    orphans = await browser.send_command('prepare_for_basset_hound')

    # Send to basset-hound API
    # await basset_hound.bulk_create_orphans(orphans['orphans'])

    return orphans
```

### MCP Agent Usage (Claude)

```
1. browser_create_investigation(name="Research Project", max_depth=2)
2. browser_navigate(url="https://target.com")
3. browser_investigate_page(capture_evidence=True, follow_links=True)
4. Repeat steps 2-3 using browser_get_next_investigation_url()
5. browser_complete_investigation()
6. browser_prepare_for_basset_hound()
```

---

## Security Considerations

### Sensitive Data Handling
- SSN and credit card data are marked `sensitive: true`
- `prepare_for_basset_hound` excludes sensitive by default
- Use `includeSensitive: true` only when explicitly authorized

### Rate Limiting
- Configurable `delayMs` between requests (default 1000ms)
- Integration with Phase 17 RateLimitAdapter recommended

### Evidence Integrity
- Integrates with Phase 18 Evidence Collection
- SHA-256 hashing for all captured evidence
- Chain of custody tracking

---

## Integration Points

### Phase 13: Data Ingestion
- Uses existing DataTypeDetector patterns where applicable
- OSINT_PATTERNS extends detection capabilities

### Phase 17: Bot Detection Evasion
- Use fingerprint profiles during investigations
- Behavioral AI for human-like navigation
- Rate limit adaptation

### Phase 18: Evidence Collection
- `investigate_page` automatically captures evidence
- Evidence linked to investigation provenance
- Court-ready export available

### Phase 16: Sock Puppet Integration
- Use sock puppet profiles for investigations
- Track investigation sessions per identity

---

## Files Created

| File | Lines | Description |
|------|-------|-------------|
| `websocket/commands/osint-commands.js` | ~700 | Core OSINT commands |
| `tests/unit/osint-commands.test.js` | ~500 | Unit tests (150+ cases) |
| `mcp/server.py` (updated) | +300 | 12 new MCP tools |

---

## Test Coverage

- Pattern matching tests for all 13 OSINT types
- InvestigationManager lifecycle tests
- Queue management tests (depth, patterns, limits)
- Provenance generation tests
- Integration workflow tests

---

## Future Enhancements

1. **Structured Data Extraction** - JSON-LD, Schema.org parsing
2. **NLP Entity Recognition** - Person/organization name detection
3. **Relationship Inference** - Detect connections between entities
4. **Learning Mode** - Track user choices to improve suggestions
5. **Real-time Notifications** - WebSocket events for findings
6. **Visual Graph Export** - Investigation relationship visualization

---

*Phase 12 completes the core OSINT agent integration, enabling fully automated investigations with evidence capture and basset-hound platform integration.*
