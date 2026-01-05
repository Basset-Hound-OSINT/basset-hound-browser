# Integration Research Findings - Basset Hound Browser

**Date:** January 4, 2026
**Purpose:** Document integration strategies for OSINT agent automation

---

## Overview

Basset Hound Browser is an Electron-based automation browser designed for OSINT investigations. This document outlines how it integrates with the broader ecosystem for AI-driven automated investigations.

---

## Current State Analysis

### Existing Capabilities (v8.2.4)

| Category | Features |
|----------|----------|
| **Core Automation** | Navigation, form filling, clicking, scrolling, screenshots |
| **Bot Evasion** | Fingerprint spoofing, human-like typing, mouse simulation |
| **Proxy Support** | HTTP/HTTPS, SOCKS4/5, Tor integration, proxy rotation |
| **Content Extraction** | Technology detection, metadata, links, forms, images |
| **Network Analysis** | HAR export, request capture, security headers |
| **Session Management** | Recording, replay, profiles, cookies |
| **Client Libraries** | Python, Node.js, CLI tool |
| **Tor Integration** | Embedded Tor, circuit management, exit node selection |

### Architecture

```
External Client (OSINT Agent)
         |
         | WebSocket (ws://localhost:8765)
         v
+-------------------+
|   MAIN PROCESS    |  <-- main.js
|  - WebSocket srv  |
|  - IPC handlers   |
|  - Evasion config |
+-------------------+
         |
         | IPC
         v
+-------------------+
|   PRELOAD SCRIPT  |  <-- preload.js
|  - Context bridge |
+-------------------+
         |
         v
+-------------------+
|    RENDERER       |  <-- renderer/
|  - Webview ctrl   |
+-------------------+
```

---

## Integration with OSINT Agent

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        OSINT AGENT                               │
│  (palletAI, Claude with MCP, custom Python/Node.js script)       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │  Task Planner     │    │  Data Processor  │                  │
│  │  - Investigation  │    │  - Extract data  │                  │
│  │    goals          │    │  - Normalize     │                  │
│  │  - Step planning  │    │  - Deduplicate   │                  │
│  └────────┬─────────┘    └────────┬─────────┘                  │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌────────────────────────────────────────────┐                 │
│  │           Browser Controller                │                 │
│  │  - WebSocket client to basset-hound-browser│                 │
│  │  - Command execution                        │                 │
│  │  - Screenshot capture                       │                 │
│  │  - Page state extraction                    │                 │
│  └────────────────────────────────────────────┘                 │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │ WebSocket
                           ▼
              ┌─────────────────────────────┐
              │   basset-hound-browser      │
              │   (Electron automation)     │
              │                             │
              │   - Execute navigation      │
              │   - Fill forms              │
              │   - Bypass bot detection    │
              │   - Capture content         │
              └──────────────┬──────────────┘
                             │
                             │ Extracted Data
                             ▼
              ┌─────────────────────────────┐
              │       basset-hound          │
              │   (Entity Storage)          │
              │                             │
              │   - Store orphan data       │
              │   - Track relationships     │
              │   - Verify identifiers      │
              └─────────────────────────────┘
```

---

## OSINT Agent Workflow Example

### Python Implementation

```python
# osint_agent.py

import asyncio
import json
from datetime import datetime
from basset_hound_browser import BassetHoundBrowser
from basset_hound_client import BassetHoundClient

class OSINTAgent:
    def __init__(self, project_name: str):
        self.browser = BassetHoundBrowser()
        self.basset = BassetHoundClient(project=project_name)

    async def investigate_target(self, target_url: str):
        """Run automated investigation on a target URL."""

        # 1. Navigate to target
        await self.browser.navigate(target_url)
        await self.browser.wait_for_load()

        # 2. Capture page state
        page_state = await self.browser.get_page_state()
        screenshot = await self.browser.screenshot()

        # 3. Detect technologies
        tech_stack = await self.browser.detect_technologies()

        # 4. Extract content
        extracted = await self.browser.extract_all()

        # 5. Process extracted data
        findings = self.process_extraction(extracted, target_url)

        # 6. Store in basset-hound
        await self.store_findings(findings, target_url)

        return {
            "url": target_url,
            "technologies": tech_stack,
            "findings_count": len(findings),
            "screenshot": screenshot
        }

    def process_extraction(self, extracted: dict, source_url: str):
        """Process extracted content for OSINT data."""
        findings = []

        # Extract emails
        for email in extracted.get("emails", []):
            findings.append({
                "type": "EMAIL",
                "value": email,
                "source_url": source_url
            })

        # Extract links for further investigation
        for link in extracted.get("links", []):
            if self.is_interesting_link(link):
                findings.append({
                    "type": "URL",
                    "value": link["href"],
                    "source_url": source_url,
                    "context": link.get("text", "")
                })

        # Extract from structured data (JSON-LD, etc.)
        for schema in extracted.get("structured_data", []):
            if schema.get("@type") == "Person":
                findings.extend(self.extract_person_data(schema, source_url))

        return findings

    async def store_findings(self, findings: list, source_url: str):
        """Store findings in basset-hound with provenance."""
        provenance = {
            "source_type": "website",
            "source_url": source_url,
            "source_date": datetime.now().isoformat(),
            "captured_by": "basset-hound-browser"
        }

        for finding in findings:
            await self.basset.create_orphan(
                identifier_type=finding["type"],
                value=finding["value"],
                metadata={
                    "context": finding.get("context", ""),
                    "verification": await self.verify(finding)
                },
                provenance=provenance
            )

    async def verify(self, finding: dict):
        """Verify finding before storage."""
        # Call basset-hound verification API
        return await self.basset.verify(
            identifier_type=finding["type"],
            value=finding["value"]
        )

# Usage
async def main():
    agent = OSINTAgent("my-investigation")

    targets = [
        "https://example.com/about",
        "https://example.org/team"
    ]

    for target in targets:
        result = await agent.investigate_target(target)
        print(f"Investigated {target}: {result['findings_count']} findings")

asyncio.run(main())
```

### Node.js Implementation

```javascript
// osint-agent.js

const { BassetHoundBrowser } = require('basset-hound-client');
const BassetHound = require('basset-hound-client');

class OSINTAgent {
  constructor(projectName) {
    this.browser = new BassetHoundBrowser();
    this.basset = new BassetHound({ project: projectName });
  }

  async investigateTarget(targetUrl) {
    await this.browser.connect();

    try {
      // Navigate and extract
      await this.browser.navigate(targetUrl);
      const pageState = await this.browser.getPageState();
      const screenshot = await this.browser.screenshot();
      const extracted = await this.browser.extractAll();

      // Process and store
      const findings = this.processExtraction(extracted, targetUrl);
      await this.storeFindings(findings, targetUrl);

      return {
        url: targetUrl,
        findingsCount: findings.length,
        screenshot
      };
    } finally {
      await this.browser.disconnect();
    }
  }

  async storeFindings(findings, sourceUrl) {
    const provenance = {
      source_type: 'website',
      source_url: sourceUrl,
      source_date: new Date().toISOString(),
      captured_by: 'basset-hound-browser'
    };

    for (const finding of findings) {
      await this.basset.createOrphan({
        identifier_type: finding.type,
        identifier_value: finding.value,
        metadata: { context: finding.context },
        provenance
      });
    }
  }
}

module.exports = { OSINTAgent };
```

---

## New WebSocket Commands for OSINT

### Proposed Additions

| Command | Description | Parameters |
|---------|-------------|------------|
| `extract_osint_data` | Extract all OSINT-relevant data | `types[]` (email, phone, crypto, etc.) |
| `verify_data` | Verify extracted data | `type`, `value` |
| `store_to_basset` | Direct storage to basset-hound | `orphan_data`, `provenance` |
| `investigate_links` | Follow and investigate linked pages | `depth`, `patterns[]` |
| `capture_evidence` | Screenshot + HTML + metadata | `format` |

### Implementation

```javascript
// websocket/commands/osint-commands.js (TO BE CREATED)

const osintCommands = {
  extract_osint_data: async (params, webContents) => {
    const types = params.types || ['email', 'phone', 'crypto'];

    const extracted = await webContents.executeJavaScript(`
      (function() {
        const patterns = {
          email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g,
          phone: /(?:\\+?1[-.]?)?\\(?[0-9]{3}\\)?[-.]?[0-9]{3}[-.]?[0-9]{4}/g,
          crypto_btc: /\\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\\b/g,
          crypto_eth: /\\b0x[a-fA-F0-9]{40}\\b/g
        };

        const text = document.body.innerText;
        const results = {};

        for (const [type, pattern] of Object.entries(patterns)) {
          results[type] = [...new Set(text.match(pattern) || [])];
        }

        return results;
      })()
    `);

    return { success: true, data: extracted };
  },

  capture_evidence: async (params, win) => {
    const webContents = win.webContents;

    // Capture screenshot
    const image = await webContents.capturePage();
    const screenshot = image.toDataURL();

    // Capture HTML
    const html = await webContents.executeJavaScript('document.documentElement.outerHTML');

    // Capture metadata
    const metadata = await webContents.executeJavaScript(`
      ({
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        meta: Array.from(document.querySelectorAll('meta')).map(m => ({
          name: m.name || m.getAttribute('property'),
          content: m.content
        }))
      })
    `);

    return {
      success: true,
      data: {
        screenshot,
        html,
        metadata
      }
    };
  }
};

module.exports = osintCommands;
```

---

## Tor Integration for Anonymous Investigation

### Usage Pattern

```python
# Anonymous investigation with Tor
async def anonymous_investigation(target: str):
    browser = BassetHoundBrowser()

    # Start embedded Tor
    await browser.tor_start()
    await browser.tor_set_exit_country('DE')  # Use German exit

    # Verify Tor is working
    tor_status = await browser.tor_check_connection()
    print(f"Using Tor exit IP: {tor_status['exit_ip']}")

    # Navigate through Tor
    await browser.navigate(target)

    # Extract data
    data = await browser.extract_osint_data()

    # Rotate circuit for next target
    await browser.tor_rebuild_circuit()

    return data
```

---

## basset-hound-browser Client Library Enhancements

### Python Client Updates

```python
# clients/python/basset_hound_browser/osint.py (TO BE CREATED)

class OSINTMixin:
    """OSINT-specific methods for BassetHoundBrowser client."""

    async def extract_osint_data(self, types=None):
        """Extract OSINT-relevant data from current page."""
        return await self.send_command('extract_osint_data', {
            'types': types or ['email', 'phone', 'crypto', 'domain']
        })

    async def capture_evidence(self):
        """Capture screenshot, HTML, and metadata as evidence."""
        return await self.send_command('capture_evidence', {})

    async def investigate_page(self):
        """Full investigation of current page."""
        page_state = await self.get_page_state()
        technologies = await self.detect_technologies()
        osint_data = await self.extract_osint_data()
        evidence = await self.capture_evidence()

        return {
            'page_state': page_state,
            'technologies': technologies,
            'osint_data': osint_data,
            'evidence': evidence
        }
```

---

## Integration Test Suite

### Test Scenarios

```javascript
// tests/integration/osint-workflow.test.js (TO BE CREATED)

describe('OSINT Workflow Integration', () => {
  let browser;

  beforeAll(async () => {
    browser = new BassetHoundBrowser();
    await browser.connect();
  });

  afterAll(async () => {
    await browser.disconnect();
  });

  test('should extract emails from page', async () => {
    await browser.navigate('https://example.com/contact');
    const data = await browser.extractOsintData(['email']);
    expect(data.email).toBeInstanceOf(Array);
  });

  test('should capture evidence bundle', async () => {
    await browser.navigate('https://example.com');
    const evidence = await browser.captureEvidence();
    expect(evidence.screenshot).toBeDefined();
    expect(evidence.html).toBeDefined();
    expect(evidence.metadata.url).toBe('https://example.com/');
  });

  test('should use Tor for anonymous browsing', async () => {
    await browser.torStart();
    const status = await browser.torCheckConnection();
    expect(status.is_tor).toBe(true);
    expect(status.exit_ip).toBeDefined();
    await browser.torStop();
  });
});
```

---

## File Structure Updates

```
basset-hound-browser/
├── websocket/
│   └── commands/
│       ├── osint-commands.js       # NEW: OSINT extraction commands
│       └── evidence-commands.js    # NEW: Evidence capture commands
├── clients/
│   ├── python/
│   │   └── basset_hound_browser/
│   │       ├── client.py
│   │       └── osint.py            # NEW: OSINT mixin
│   └── nodejs/
│       └── osint.js                # NEW: OSINT mixin
├── tests/
│   └── integration/
│       └── osint-workflow.test.js  # NEW: OSINT tests
└── docs/
    └── OSINT-INTEGRATION.md        # NEW: Integration guide
```

---

## Security Considerations

1. **Tor Usage:** Respect exit node bandwidth, don't abuse
2. **Rate Limiting:** Implement delays between requests
3. **Target Ethics:** Only investigate legitimate targets
4. **Data Handling:** Encrypt sensitive data at rest
5. **Evidence Chain:** Maintain provenance for legal validity

---

## Next Steps

See updated ROADMAP.md for implementation phases.
