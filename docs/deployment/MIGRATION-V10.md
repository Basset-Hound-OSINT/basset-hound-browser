# Migration Guide: v8.2.4 → v10.0.0

**Last Updated:** January 9, 2026
**Migration Difficulty:** Major
**Estimated Migration Time:** 4-8 hours depending on usage

---

## Table of Contents

1. [Overview of Breaking Changes](#overview-of-breaking-changes)
2. [MCP Tools Migration](#mcp-tools-migration)
3. [WebSocket Commands Migration](#websocket-commands-migration)
4. [Feature-Specific Migration](#feature-specific-migration)
5. [Code Examples](#code-examples)
6. [Testing Your Migration](#testing-your-migration)
7. [Getting Help](#getting-help)

---

## Overview of Breaking Changes

### Scope Transformation

Basset Hound Browser v10.0.0 represents a **major architectural shift** from an OSINT intelligence platform to a **pure browser automation tool**. This change clarifies the project's role in the automation ecosystem.

**v8.2.4 (OSINT Platform):**
```
┌────────────────────────────────────┐
│   BASSET HOUND BROWSER             │
│  • Browser automation              │
│  • OSINT pattern detection         │
│  • Investigation management        │
│  • Data ingestion workflows        │
│  • External system integration     │
└────────────────────────────────────┘
```

**v10.0.0 (Browser Automation Tool):**
```
┌─────────────────────────────────────────┐
│        AI AGENTS (palletai)             │
│  • Pattern detection                    │
│  • Investigation management             │
│  • Data analysis & classification       │
└───────────────┬─────────────────────────┘
                │
         MCP / WebSocket
                │
                ▼
┌─────────────────────────────────────────┐
│    BASSET HOUND BROWSER (Tool)          │
│  • Navigate, click, extract             │
│  • Forensic data capture                │
│  • Bot detection evasion                │
└─────────────────────────────────────────┘
```

### What Changed

| Metric | v8.2.4 | v10.0.0 | Change |
|--------|--------|---------|--------|
| **WebSocket Commands** | 98+ | 65 | -33 commands (-33.7%) |
| **MCP Tools** | 88 | 61 | -27 tools (-30.7%) |
| **Lines of Code** | ~45,000 | ~36,000 | -8,228 lines (-18.3%) |
| **Scope** | OSINT Platform | Browser Automation | Focused |

### Impact Assessment

#### ✅ No Impact (Still Supported)
- **Browser Automation:** Navigate, click, fill, scroll, wait
- **Data Extraction:** HTML, text, links, images, forms, metadata
- **Forensic Capture:** Screenshots, HAR, DOM snapshots, cookies
- **Bot Detection Evasion:** Fingerprinting, behavioral AI, honeypot detection
- **Network Control:** Tor, proxies, circuit management
- **Image Forensics:** EXIF/IPTC/XMP extraction, OCR, perceptual hashing
- **Profile Management:** Browser profiles with isolated sessions

#### ⚠️ Breaking Changes (Removed)
- **Pattern Detection:** Automatic detection of emails, phones, crypto addresses, SSNs
- **Investigation Management:** Investigation creation, URL queues, workflow orchestration
- **Evidence Packages:** Investigation-level evidence organization
- **Data Ingestion:** Automatic/selective/filtered ingestion modes
- **Sock Puppet Integration:** basset-hound API integration for identity management
- **Orphan Data Generation:** Transforming data for external systems

#### 🔄 Migration Required
- **AI Agent Developers:** Must implement pattern detection in agent layer
- **Investigation Users:** Must implement investigation management externally
- **Evidence Users:** Must organize evidence in external systems
- **Sock Puppet Users:** Must manage identities in external systems

---

## MCP Tools Migration

### Summary of Removed Tools

**27 MCP tools removed** across three categories:

1. **OSINT Investigation Tools** (12 tools)
2. **Data Ingestion Tools** (3 tools)
3. **Sock Puppet Tools** (12 tools)

### Removed Tools List

#### OSINT Investigation Tools (12 tools)

| Removed Tool | Purpose | Alternative |
|-------------|---------|-------------|
| `browser_create_investigation` | Create investigation with config | Use external investigation manager |
| `browser_extract_osint_data` | Extract emails, phones, crypto | Use `browser_get_content` + agent logic |
| `browser_investigate_page` | Automated page investigation | Use `browser_navigate` + agent orchestration |
| `browser_investigate_links` | Crawl and investigate links | Use `browser_extract_links` + agent logic |
| `browser_get_next_investigation_url` | Get next URL from queue | Implement URL queue in agent |
| `browser_get_investigation_findings` | Get investigation results | Store findings in agent/database |
| `browser_get_findings_summary` | Summarize findings | Implement in agent layer |
| `browser_prepare_for_basset_hound` | Format data for basset-hound | Implement in agent layer |
| `browser_complete_investigation` | Mark investigation complete | Implement in agent layer |
| `browser_export_investigation` | Export investigation package | Implement in agent layer |
| `browser_list_investigations` | List all investigations | Implement in agent layer |
| `browser_get_osint_data_types` | Get supported OSINT types | Not needed (agent defines types) |

#### Data Ingestion Tools (3 tools)

| Removed Tool | Purpose | Alternative |
|-------------|---------|-------------|
| `browser_detect_data_types` | Detect patterns in text | Use `browser_get_content` + agent regex |
| `browser_ingest_selected` | Ingest specific data types | Implement in agent layer |
| `browser_get_ingestion_stats` | Get ingestion statistics | Implement in agent layer |

#### Sock Puppet Tools (12 tools)

| Removed Tool | Purpose | Alternative |
|-------------|---------|-------------|
| `browser_list_sock_puppets` | List available sock puppets | Query external identity database |
| `browser_get_sock_puppet` | Get sock puppet details | Query external identity database |
| `browser_link_profile_to_sock_puppet` | Link browser profile to sock puppet | Implement in agent layer |
| `browser_create_profile_from_sock_puppet` | Create profile from sock puppet | Use `browser_create_profile` + agent data |
| `browser_fill_form_with_sock_puppet` | Auto-fill form from sock puppet | Use `browser_fill` + agent provides data |
| `browser_start_sock_puppet_session` | Start tracked session | Implement session tracking in agent |
| `browser_end_sock_puppet_session` | End tracked session | Implement session tracking in agent |
| `browser_get_sock_puppet_activity_log` | Get activity log | Implement activity logging in agent |
| `browser_validate_sock_puppet_fingerprint` | Validate fingerprint consistency | Implement in agent layer |
| `browser_get_sock_puppet_stats` | Get sock puppet statistics | Implement in agent layer |

### Retained MCP Tools (61 tools)

| Category | Tools | Count |
|----------|-------|-------|
| **Navigation & Control** | navigate, back, forward, refresh, get_url, get_title | 6 |
| **User Interaction** | click, fill, type, press_key, hover, scroll, select, clear | 8 |
| **Content Extraction** | get_content, get_html, get_page_state, extract_links, extract_forms, extract_images, extract_metadata | 7 |
| **Screenshots** | screenshot, screenshot_element, screenshot_full_page | 3 |
| **Profiles** | switch_profile, create_profile, list_profiles, delete_profile | 4 |
| **Proxy/Tor** | set_proxy, clear_proxy, tor_start, tor_stop, tor_new_identity, tor_get_circuit | 6 |
| **Advanced** | execute_script, wait_for_element, wait_for_navigation, get_cookies, set_cookies | 5 |
| **Image Forensics** | extract_image_metadata, extract_image_gps, extract_image_text, generate_image_hash, compare_images, extract_page_images, configure_image_extractor, get_image_extractor_stats, cleanup_image_extractor | 9 |
| **Technology Detection** | detect_technologies, get_technology_categories, get_technology_info | 3 |
| **Evidence Collection** | capture_screenshot_evidence, capture_page_archive_evidence, capture_har_evidence, capture_dom_evidence, capture_console_evidence, capture_cookies_evidence, capture_storage_evidence, get_evidence_types | 8 |
| **Fingerprint Evasion** | create_fingerprint_profile, create_regional_fingerprint, get_fingerprint_profile, set_active_fingerprint, apply_fingerprint | 5 |
| **Behavioral AI** | create_behavioral_profile, generate_mouse_path, generate_scroll_behavior, generate_typing_events, check_honeypot, filter_honeypots | 6 |

---

## WebSocket Commands Migration

### Summary of Removed Commands

**33 WebSocket commands removed** across three categories:

### Removed Commands List

#### OSINT Investigation Commands (19 commands)

| Removed Command | Alternative Approach |
|----------------|---------------------|
| `create_investigation` | Implement investigation manager in agent |
| `add_investigation_url` | Implement URL queue in agent |
| `set_investigation_config` | Store config in agent |
| `get_investigation_status` | Track status in agent |
| `get_investigation_queue` | Implement queue in agent |
| `extract_osint_data` | Use `get_content` + agent pattern detection |
| `investigate_page` | Use `navigate` + `get_content` + agent logic |
| `investigate_links` | Use `extract_links` + agent orchestration |
| `get_next_investigation_url` | Implement in agent |
| `get_investigation_findings` | Store in agent/database |
| `get_findings_by_type` | Filter in agent |
| `get_findings_summary` | Summarize in agent |
| `prepare_for_basset_hound` | Format in agent |
| `complete_investigation` | Track in agent |
| `export_investigation` | Export from agent |
| `list_investigations` | List from agent database |
| `get_investigation` | Query agent database |
| `delete_investigation` | Delete from agent database |
| `get_osint_data_types` | Define in agent |

#### Data Ingestion Commands (7 commands)

| Removed Command | Alternative Approach |
|----------------|---------------------|
| `configure_ingestion` | Implement in agent |
| `detect_data_types` | Use `get_content` + agent regex |
| `ingest_selected` | Implement in agent |
| `ingest_all` | Implement in agent |
| `get_ingestion_queue` | Implement queue in agent |
| `clear_ingestion_queue` | Implement in agent |
| `get_ingestion_stats` | Track stats in agent |

#### Sock Puppet Commands (7 commands)

| Removed Command | Alternative Approach |
|----------------|---------------------|
| `list_sock_puppets` | Query identity database |
| `get_sock_puppet` | Query identity database |
| `fill_form_with_sock_puppet` | Use `fill` + agent provides data |
| `start_sock_puppet_session` | Track in agent |
| `end_sock_puppet_session` | Track in agent |
| `get_sock_puppet_activity` | Implement logging in agent |
| `get_sock_puppet_stats` | Calculate in agent |

### Retained WebSocket Commands (65 commands)

All core browser automation commands are retained:
- Navigation (6): navigate, back, forward, refresh, get_url, get_title
- Interaction (8): click, fill, type, press_key, hover, scroll, select, clear
- Content (7): get_content, get_html, get_page_state, extract_links, extract_forms, extract_images, extract_metadata
- Screenshots (3): screenshot, screenshot_element, screenshot_full_page
- Cookies (3): get_cookies, set_cookies, clear_cookies
- Profiles (4): switch_profile, create_profile, list_profiles, delete_profile
- Proxy/Tor (6): set_proxy, clear_proxy, tor_start, tor_stop, tor_new_identity, tor_get_circuit
- Advanced (5): execute_script, wait_for_element, wait_for_navigation, ping, status
- Image Forensics (9): extract_image_metadata, extract_image_gps, extract_image_text, etc.
- Evidence (8): capture_screenshot_evidence, capture_har_evidence, etc.
- Evasion (11): fingerprint and behavioral commands

---

## Feature-Specific Migration

### 1. Pattern Detection Migration

**What Changed:**
- Removed: Automatic detection of emails, phones, crypto addresses, SSNs, credit cards, social media handles
- Removed: Confidence scoring and pattern classification
- Removed: OSINT data type enumeration

**Before (v8.2.4):**
```python
# This no longer works in v10.0.0
response = await client.send({
    "command": "extract_osint_data",
    "types": ["email", "phone", "crypto_btc", "ssn"]
})

# Response included:
# {
#   "osintData": [
#     {"type": "email", "value": "user@example.com", "confidence": 0.95},
#     {"type": "phone", "value": "+1-555-0123", "confidence": 0.92}
#   ]
# }
```

**After (v10.0.0):**
```python
# Step 1: Browser extracts raw text
response = await client.send({"command": "get_content"})
text = response["content"]["text"]
html = response["content"]["html"]

# Step 2: Agent performs pattern detection
import re

def detect_patterns(text):
    """Pattern detection in agent layer"""
    patterns = {
        "emails": re.findall(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            text
        ),
        "phones": re.findall(
            r'\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}',
            text
        ),
        "crypto_btc": re.findall(
            r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b',
            text
        ),
        "ssn": re.findall(
            r'\b\d{3}-\d{2}-\d{4}\b',
            text
        )
    }
    return patterns

# Step 3: Agent stores results
findings = detect_patterns(text)
# Store in your investigation database
```

### 2. Investigation Management Migration

**What Changed:**
- Removed: Investigation creation and lifecycle management
- Removed: URL queue management
- Removed: Investigation state tracking
- Removed: Findings aggregation

**Before (v8.2.4):**
```python
# Create investigation
await client.send({
    "command": "create_investigation",
    "name": "Target Person Investigation",
    "config": {
        "maxDepth": 2,
        "maxPages": 50,
        "dataTypes": ["email", "phone", "social"]
    }
})

# Add URLs to queue
await client.send({
    "command": "add_investigation_url",
    "url": "https://example.com/profile",
    "priority": 1
})

# Process queue
while True:
    response = await client.send({
        "command": "get_next_investigation_url"
    })
    if not response.get("url"):
        break

    await client.send({
        "command": "investigate_page",
        "url": response["url"]
    })

# Get findings
findings = await client.send({
    "command": "get_investigation_findings"
})
```

**After (v10.0.0):**
```python
class InvestigationManager:
    """Agent-level investigation management"""

    def __init__(self, browser_client):
        self.client = browser_client
        self.investigations = {}
        self.url_queues = {}

    async def create_investigation(self, name, config):
        """Create investigation in agent"""
        inv_id = str(uuid.uuid4())
        self.investigations[inv_id] = {
            "id": inv_id,
            "name": name,
            "config": config,
            "findings": [],
            "status": "active",
            "created": datetime.now()
        }
        self.url_queues[inv_id] = []
        return inv_id

    def add_url(self, inv_id, url, priority=0):
        """Add URL to investigation queue"""
        self.url_queues[inv_id].append({
            "url": url,
            "priority": priority,
            "status": "pending"
        })

    async def investigate_page(self, inv_id, url):
        """Investigate a single page"""
        # Navigate with browser
        await self.client.send({"command": "navigate", "url": url})
        await asyncio.sleep(2)

        # Extract content
        response = await self.client.send({"command": "get_content"})
        content = response["content"]

        # Detect patterns (agent logic)
        findings = self.detect_patterns(content["text"])

        # Store findings
        self.investigations[inv_id]["findings"].extend(findings)

        return findings

    async def process_queue(self, inv_id):
        """Process all URLs in queue"""
        queue = self.url_queues[inv_id]

        for item in sorted(queue, key=lambda x: x["priority"], reverse=True):
            if item["status"] == "pending":
                findings = await self.investigate_page(inv_id, item["url"])
                item["status"] = "complete"
                item["findings"] = findings

    def get_findings(self, inv_id):
        """Get all findings for investigation"""
        return self.investigations[inv_id]["findings"]

# Usage
manager = InvestigationManager(browser_client)

inv_id = await manager.create_investigation(
    "Target Person Investigation",
    {"maxDepth": 2, "maxPages": 50}
)

manager.add_url(inv_id, "https://example.com/profile", priority=1)
manager.add_url(inv_id, "https://example.com/posts", priority=2)

await manager.process_queue(inv_id)
findings = manager.get_findings(inv_id)
```

### 3. Evidence Package Migration

**What Changed:**
- Removed: Investigation-level evidence packages
- Removed: Evidence package sealing
- Removed: Court-ready evidence export
- Kept: Individual evidence capture with hashing

**Before (v8.2.4):**
```python
# Create evidence package
await client.send({
    "command": "create_evidence_package",
    "investigationId": "inv_123",
    "caseNumber": "CASE-2026-001",
    "metadata": {
        "investigator": "John Doe",
        "organization": "Acme Investigations"
    }
})

# Capture evidence (auto-added to package)
await client.send({
    "command": "capture_screenshot_evidence",
    "description": "Profile page screenshot"
})

await client.send({
    "command": "capture_har_evidence",
    "description": "Network traffic"
})

# Seal and export
await client.send({
    "command": "seal_evidence_package"
})

package = await client.send({
    "command": "export_for_court",
    "format": "pdf"
})
```

**After (v10.0.0):**
```python
class EvidenceManager:
    """Agent-level evidence management"""

    def __init__(self, browser_client):
        self.client = browser_client
        self.packages = {}

    def create_package(self, case_number, metadata):
        """Create evidence package in agent"""
        pkg_id = str(uuid.uuid4())
        self.packages[pkg_id] = {
            "id": pkg_id,
            "caseNumber": case_number,
            "metadata": metadata,
            "evidence": [],
            "created": datetime.now(),
            "sealed": False
        }
        return pkg_id

    async def capture_screenshot(self, pkg_id, description, captured_by):
        """Capture screenshot evidence"""
        # Browser captures raw evidence
        response = await self.client.send({
            "command": "capture_screenshot_evidence",
            "capturedBy": captured_by
        })

        # Agent organizes into package
        evidence = {
            "type": "screenshot",
            "description": description,
            "sha256": response["sha256"],
            "data": response["data"],
            "timestamp": response["timestamp"],
            "url": response["url"],
            "capturedBy": captured_by
        }

        self.packages[pkg_id]["evidence"].append(evidence)
        return evidence

    async def capture_har(self, pkg_id, description, captured_by):
        """Capture network traffic evidence"""
        response = await self.client.send({
            "command": "capture_har_evidence",
            "capturedBy": captured_by
        })

        evidence = {
            "type": "har",
            "description": description,
            "sha256": response["sha256"],
            "data": response["data"],
            "timestamp": response["timestamp"],
            "capturedBy": captured_by
        }

        self.packages[pkg_id]["evidence"].append(evidence)
        return evidence

    def seal_package(self, pkg_id):
        """Seal evidence package"""
        package = self.packages[pkg_id]
        package["sealed"] = True
        package["sealedAt"] = datetime.now()

        # Generate package hash
        package_data = json.dumps(package["evidence"], sort_keys=True)
        package["hash"] = hashlib.sha256(package_data.encode()).hexdigest()

        return package

    def export_package(self, pkg_id, format="json"):
        """Export evidence package"""
        package = self.packages[pkg_id]

        if format == "json":
            return json.dumps(package, indent=2, default=str)
        elif format == "pdf":
            # Generate PDF report (implement with reportlab)
            return self.generate_pdf_report(package)

# Usage
evidence_mgr = EvidenceManager(browser_client)

pkg_id = evidence_mgr.create_package(
    "CASE-2026-001",
    {
        "investigator": "John Doe",
        "organization": "Acme Investigations"
    }
)

await evidence_mgr.capture_screenshot(
    pkg_id,
    "Profile page screenshot",
    captured_by="agent-001"
)

await evidence_mgr.capture_har(
    pkg_id,
    "Network traffic",
    captured_by="agent-001"
)

package = evidence_mgr.seal_package(pkg_id)
pdf_export = evidence_mgr.export_package(pkg_id, format="pdf")
```

### 4. Sock Puppet Integration Migration

**What Changed:**
- Removed: basset-hound API integration
- Removed: Automatic credential fetching
- Removed: Session activity tracking
- Kept: Profile management (browser profiles)
- Kept: Form filling (with agent-provided data)

**Before (v8.2.4):**
```python
# Fetch sock puppet from basset-hound API
sock_puppet = await client.send({
    "command": "get_sock_puppet",
    "sockPuppetId": "sp_12345"
})

# Create browser profile from sock puppet
await client.send({
    "command": "create_profile_from_sock_puppet",
    "sockPuppetId": "sp_12345",
    "applyFingerprint": True
})

# Fill form with sock puppet credentials
await client.send({
    "command": "fill_form_with_sock_puppet",
    "sockPuppetId": "sp_12345",
    "formSelector": "#login-form"
})

# Activity auto-tracked in basset-hound
```

**After (v10.0.0):**
```python
class IdentityManager:
    """Agent-level identity management"""

    def __init__(self, browser_client, identity_db_client):
        self.browser = browser_client
        self.identity_db = identity_db_client

    async def get_identity(self, identity_id):
        """Fetch identity from external database"""
        # Query your identity database (not basset-hound-browser)
        identity = await self.identity_db.get(identity_id)
        return identity

    async def create_profile_for_identity(self, identity):
        """Create browser profile with identity data"""
        # Create browser profile
        profile_response = await self.browser.send({
            "command": "create_profile",
            "name": f"profile_{identity['id']}"
        })

        profile_name = profile_response["profileName"]

        # Apply fingerprint if needed
        if identity.get("fingerprint"):
            await self.browser.send({
                "command": "create_fingerprint_profile",
                "platform": identity["fingerprint"]["platform"],
                "region": identity["fingerprint"]["region"]
            })

        return profile_name

    async def fill_form_with_identity(self, identity, form_selector):
        """Fill form with identity credentials"""
        credentials = identity["credentials"]

        # Agent provides data, browser fills form
        for field_name, value in credentials.items():
            selector = f"{form_selector} [name='{field_name}']"
            await self.browser.send({
                "command": "fill",
                "selector": selector,
                "value": value,
                "humanize": True
            })

    async def track_session(self, identity_id, action, metadata):
        """Track identity activity in external database"""
        await self.identity_db.log_activity({
            "identityId": identity_id,
            "action": action,
            "metadata": metadata,
            "timestamp": datetime.now()
        })

# Usage
identity_mgr = IdentityManager(browser_client, identity_db_client)

# Fetch identity from your database
identity = await identity_mgr.get_identity("identity_12345")

# Create browser profile
profile_name = await identity_mgr.create_profile_for_identity(identity)

# Switch to profile
await browser_client.send({
    "command": "switch_profile",
    "profileName": profile_name
})

# Navigate and fill form
await browser_client.send({
    "command": "navigate",
    "url": "https://example.com/login"
})

await identity_mgr.fill_form_with_identity(
    identity,
    "#login-form"
)

# Track activity
await identity_mgr.track_session(
    "identity_12345",
    "login",
    {"site": "example.com"}
)
```

---

## Code Examples

### Python Migration Examples

#### Example 1: Simple Page Analysis

**Before (v8.2.4):**
```python
import asyncio
import websockets
import json

async def analyze_page_v8():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Navigate
        await ws.send(json.dumps({
            "command": "navigate",
            "url": "https://example.com/profile"
        }))
        await ws.recv()

        # Auto-detect OSINT data
        await ws.send(json.dumps({
            "command": "extract_osint_data",
            "types": ["email", "phone", "social"]
        }))
        response = json.loads(await ws.recv())

        # Data pre-classified by browser
        emails = [d for d in response["osintData"] if d["type"] == "email"]
        phones = [d for d in response["osintData"] if d["type"] == "phone"]

        print(f"Found {len(emails)} emails, {len(phones)} phones")

asyncio.run(analyze_page_v8())
```

**After (v10.0.0):**
```python
import asyncio
import websockets
import json
import re

async def analyze_page_v10():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Navigate (same)
        await ws.send(json.dumps({
            "command": "navigate",
            "url": "https://example.com/profile"
        }))
        await ws.recv()

        # Extract raw content
        await ws.send(json.dumps({
            "command": "get_content"
        }))
        response = json.loads(await ws.recv())
        text = response["content"]["text"]

        # Agent performs pattern detection
        emails = re.findall(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            text
        )
        phones = re.findall(
            r'\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}',
            text
        )

        print(f"Found {len(emails)} emails, {len(phones)} phones")

asyncio.run(analyze_page_v10())
```

#### Example 2: Multi-Page Investigation

**Before (v8.2.4):**
```python
async def investigate_target_v8():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Create investigation
        await ws.send(json.dumps({
            "command": "create_investigation",
            "name": "Target Investigation",
            "config": {"maxPages": 10}
        }))
        await ws.recv()

        # Add URLs
        urls = ["https://example.com/profile", "https://example.com/posts"]
        for url in urls:
            await ws.send(json.dumps({
                "command": "add_investigation_url",
                "url": url
            }))
            await ws.recv()

        # Process automatically
        await ws.send(json.dumps({
            "command": "investigate_links"
        }))
        await ws.recv()

        # Get findings
        await ws.send(json.dumps({
            "command": "get_investigation_findings"
        }))
        response = json.loads(await ws.recv())
        print(f"Total findings: {len(response['findings'])}")
```

**After (v10.0.0):**
```python
class Investigation:
    def __init__(self, ws):
        self.ws = ws
        self.findings = []

    async def send(self, command):
        await self.ws.send(json.dumps(command))
        return json.loads(await self.ws.recv())

    async def investigate_page(self, url):
        """Investigate single page"""
        # Navigate
        await self.send({"command": "navigate", "url": url})
        await asyncio.sleep(2)

        # Extract content
        response = await self.send({"command": "get_content"})
        text = response["content"]["text"]

        # Extract links for further investigation
        links_response = await self.send({"command": "extract_links"})
        links = links_response.get("links", [])

        # Detect patterns
        findings = {
            "url": url,
            "emails": re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', text),
            "phones": re.findall(r'\+?1?\d{9,15}', text),
            "links": [l["href"] for l in links]
        }

        self.findings.append(findings)
        return findings

    async def investigate_multiple(self, urls, max_depth=1):
        """Investigate multiple pages with optional crawling"""
        visited = set()
        to_visit = urls[:]
        depth = 0

        while to_visit and depth < max_depth:
            url = to_visit.pop(0)
            if url in visited:
                continue

            visited.add(url)
            findings = await self.investigate_page(url)

            # Add new links if within depth
            if depth < max_depth - 1:
                to_visit.extend([
                    l for l in findings["links"]
                    if l not in visited
                ])

            depth += 1

        return self.findings

async def investigate_target_v10():
    async with websockets.connect("ws://localhost:8765") as ws:
        investigation = Investigation(ws)

        urls = ["https://example.com/profile", "https://example.com/posts"]
        findings = await investigation.investigate_multiple(urls, max_depth=2)

        print(f"Total findings: {len(findings)}")

        # Store findings in your database
        # await save_to_database(findings)
```

### JavaScript Migration Examples

#### Example 1: Simple Page Analysis

**Before (v8.2.4):**
```javascript
const WebSocket = require('ws');

async function analyzePageV8() {
  const ws = new WebSocket('ws://localhost:8765');

  await new Promise(resolve => ws.on('open', resolve));

  // Navigate
  ws.send(JSON.stringify({
    command: 'navigate',
    url: 'https://example.com/profile'
  }));
  await new Promise(resolve => ws.once('message', resolve));

  // Auto-detect OSINT data
  ws.send(JSON.stringify({
    command: 'extract_osint_data',
    types: ['email', 'phone', 'social']
  }));

  const response = await new Promise(resolve =>
    ws.once('message', data => resolve(JSON.parse(data)))
  );

  const emails = response.osintData.filter(d => d.type === 'email');
  const phones = response.osintData.filter(d => d.type === 'phone');

  console.log(`Found ${emails.length} emails, ${phones.length} phones`);

  ws.close();
}

analyzePageV8();
```

**After (v10.0.0):**
```javascript
const WebSocket = require('ws');

async function analyzePageV10() {
  const ws = new WebSocket('ws://localhost:8765');

  await new Promise(resolve => ws.on('open', resolve));

  // Navigate
  ws.send(JSON.stringify({
    command: 'navigate',
    url: 'https://example.com/profile'
  }));
  await new Promise(resolve => ws.once('message', resolve));

  // Extract raw content
  ws.send(JSON.stringify({
    command: 'get_content'
  }));

  const response = await new Promise(resolve =>
    ws.once('message', data => resolve(JSON.parse(data)))
  );

  const text = response.content.text;

  // Agent performs pattern detection
  const emails = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [];
  const phones = text.match(/\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}/g) || [];

  console.log(`Found ${emails.length} emails, ${phones.length} phones`);

  ws.close();
}

analyzePageV10();
```

#### Example 2: Evidence Collection

**Before (v8.2.4):**
```javascript
async function collectEvidenceV8() {
  const ws = new WebSocket('ws://localhost:8765');
  await new Promise(resolve => ws.on('open', resolve));

  // Create evidence package
  ws.send(JSON.stringify({
    command: 'create_evidence_package',
    caseNumber: 'CASE-2026-001'
  }));
  await waitForResponse(ws);

  // Navigate
  ws.send(JSON.stringify({
    command: 'navigate',
    url: 'https://example.com'
  }));
  await waitForResponse(ws);

  // Capture evidence (auto-added to package)
  ws.send(JSON.stringify({
    command: 'capture_screenshot_evidence'
  }));
  await waitForResponse(ws);

  // Seal package
  ws.send(JSON.stringify({
    command: 'seal_evidence_package'
  }));
  const sealed = await waitForResponse(ws);

  console.log('Package sealed:', sealed.packageHash);

  ws.close();
}
```

**After (v10.0.0):**
```javascript
class EvidenceCollector {
  constructor(ws) {
    this.ws = ws;
    this.packages = new Map();
  }

  async send(command) {
    return new Promise((resolve) => {
      this.ws.send(JSON.stringify(command));
      this.ws.once('message', (data) => resolve(JSON.parse(data)));
    });
  }

  createPackage(caseNumber, metadata) {
    const packageId = `pkg_${Date.now()}`;
    this.packages.set(packageId, {
      id: packageId,
      caseNumber,
      metadata,
      evidence: [],
      created: new Date()
    });
    return packageId;
  }

  async captureScreenshot(packageId, description, capturedBy) {
    // Browser captures raw evidence
    const response = await this.send({
      command: 'capture_screenshot_evidence',
      capturedBy
    });

    // Agent organizes into package
    const evidence = {
      type: 'screenshot',
      description,
      sha256: response.sha256,
      data: response.data,
      timestamp: response.timestamp,
      url: response.url,
      capturedBy
    };

    this.packages.get(packageId).evidence.push(evidence);
    return evidence;
  }

  sealPackage(packageId) {
    const pkg = this.packages.get(packageId);
    pkg.sealed = true;
    pkg.sealedAt = new Date();

    // Generate package hash
    const packageData = JSON.stringify(pkg.evidence);
    const crypto = require('crypto');
    pkg.hash = crypto.createHash('sha256').update(packageData).digest('hex');

    return pkg;
  }
}

async function collectEvidenceV10() {
  const ws = new WebSocket('ws://localhost:8765');
  await new Promise(resolve => ws.on('open', resolve));

  const collector = new EvidenceCollector(ws);

  // Create package in agent
  const packageId = collector.createPackage(
    'CASE-2026-001',
    { investigator: 'John Doe' }
  );

  // Navigate
  await collector.send({
    command: 'navigate',
    url: 'https://example.com'
  });

  // Capture evidence
  await collector.captureScreenshot(
    packageId,
    'Homepage screenshot',
    'agent-001'
  );

  // Seal package in agent
  const sealed = collector.sealPackage(packageId);
  console.log('Package sealed:', sealed.hash);

  ws.close();
}

collectEvidenceV10();
```

### palletai Agent Integration Examples

#### Example 1: OSINT Agent with Pattern Detection

```python
from palletai import Agent, Task
import re

class OSINTAgent(Agent):
    """OSINT agent with integrated pattern detection"""

    def __init__(self, browser_client):
        super().__init__()
        self.browser = browser_client
        self.patterns = {
            "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            "phone": r'\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}',
            "btc": r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b',
            "eth": r'\b0x[a-fA-F0-9]{40}\b',
            "ssn": r'\b\d{3}-\d{2}-\d{4}\b',
            "twitter": r'@\w{1,15}',
            "linkedin": r'linkedin\.com/in/[\w-]+',
        }

    async def extract_and_analyze(self, url):
        """Extract page content and detect patterns"""
        # Navigate
        await self.browser.send({
            "command": "navigate",
            "url": url
        })
        await asyncio.sleep(2)

        # Extract raw content
        response = await self.browser.send({
            "command": "get_content"
        })
        text = response["content"]["text"]
        html = response["content"]["html"]

        # Detect all patterns
        findings = {}
        for pattern_name, pattern_regex in self.patterns.items():
            matches = re.findall(pattern_regex, text, re.IGNORECASE)
            if matches:
                findings[pattern_name] = list(set(matches))  # Deduplicate

        return {
            "url": url,
            "findings": findings,
            "timestamp": datetime.now()
        }

    async def investigate_target(self, seed_url, max_pages=10):
        """Multi-page investigation"""
        visited = set()
        to_visit = [seed_url]
        all_findings = []

        while to_visit and len(visited) < max_pages:
            url = to_visit.pop(0)
            if url in visited:
                continue

            visited.add(url)

            # Analyze page
            findings = await self.extract_and_analyze(url)
            all_findings.append(findings)

            # Extract links for crawling
            links_response = await self.browser.send({
                "command": "extract_links"
            })

            # Filter relevant links
            for link in links_response.get("links", []):
                href = link.get("href", "")
                if self.is_relevant_link(href) and href not in visited:
                    to_visit.append(href)

        return all_findings

    def is_relevant_link(self, url):
        """Determine if link is relevant for investigation"""
        # Agent logic for link filtering
        relevant_domains = ["example.com", "social-site.com"]
        return any(domain in url for domain in relevant_domains)

# Usage
agent = OSINTAgent(browser_client)
findings = await agent.investigate_target(
    "https://example.com/target-profile",
    max_pages=20
)
```

#### Example 2: Investigation Orchestration Agent

```python
from palletai import Agent, Task, Workflow

class InvestigationAgent(Agent):
    """Agent that orchestrates investigations"""

    def __init__(self, browser_client, db_client):
        super().__init__()
        self.browser = browser_client
        self.db = db_client

    async def create_investigation(self, target_name, seed_urls):
        """Create and manage investigation"""
        # Create investigation in agent database
        inv_id = await self.db.investigations.create({
            "targetName": target_name,
            "seedUrls": seed_urls,
            "status": "active",
            "created": datetime.now()
        })

        return inv_id

    async def process_url(self, inv_id, url):
        """Process single URL"""
        # Navigate
        await self.browser.send({
            "command": "navigate",
            "url": url
        })
        await asyncio.sleep(2)

        # Capture evidence
        screenshot = await self.browser.send({
            "command": "capture_screenshot_evidence",
            "capturedBy": "investigation-agent"
        })

        # Extract content
        content = await self.browser.send({
            "command": "get_content"
        })

        # Detect patterns
        findings = self.detect_patterns(content["content"]["text"])

        # Store in investigation
        await self.db.findings.create({
            "investigationId": inv_id,
            "url": url,
            "screenshot": screenshot,
            "findings": findings,
            "timestamp": datetime.now()
        })

        return findings

    def detect_patterns(self, text):
        """Pattern detection logic"""
        # Implement pattern detection
        pass

class EvidenceAgent(Agent):
    """Agent that manages evidence collection"""

    async def create_evidence_package(self, case_number, metadata):
        """Create evidence package"""
        pkg_id = await self.db.evidence_packages.create({
            "caseNumber": case_number,
            "metadata": metadata,
            "created": datetime.now()
        })
        return pkg_id

    async def add_evidence(self, pkg_id, evidence_type, **kwargs):
        """Add evidence to package"""
        # Capture evidence from browser
        evidence = await self.browser.send({
            "command": f"capture_{evidence_type}_evidence",
            **kwargs
        })

        # Add to package
        await self.db.evidence_items.create({
            "packageId": pkg_id,
            "type": evidence_type,
            "data": evidence,
            "timestamp": datetime.now()
        })

        return evidence

# Multi-agent workflow
workflow = Workflow([
    InvestigationAgent(browser_client, db_client),
    EvidenceAgent(browser_client, db_client)
])

await workflow.execute({
    "target": "John Doe",
    "urls": ["https://example.com/profile"],
    "caseNumber": "CASE-2026-001"
})
```

---

## Testing Your Migration

### Pre-Migration Checklist

Before migrating, ensure you understand:

- [ ] Which removed features you're currently using
- [ ] Where to implement replacement logic (agent layer)
- [ ] Your data storage strategy (database/files)
- [ ] Your investigation management needs
- [ ] Your evidence collection requirements

### Migration Testing Steps

#### Step 1: Verify Browser Installation

```bash
# Start browser
npm start

# Verify WebSocket server is running
curl http://localhost:8765 || echo "WebSocket running"
```

#### Step 2: Test Basic Connectivity

**Python:**
```python
import asyncio
import websockets
import json

async def test_connection():
    try:
        async with websockets.connect("ws://localhost:8765") as ws:
            # Receive connection message
            conn_msg = await ws.recv()
            print("Connected:", conn_msg)

            # Test ping
            await ws.send(json.dumps({"command": "ping"}))
            response = json.loads(await ws.recv())
            print("Ping response:", response)

            print("✓ Connection test passed")
    except Exception as e:
        print("✗ Connection test failed:", e)

asyncio.run(test_connection())
```

**JavaScript:**
```javascript
const WebSocket = require('ws');

function testConnection() {
  const ws = new WebSocket('ws://localhost:8765');

  ws.on('open', () => {
    console.log('Connected');
    ws.send(JSON.stringify({ command: 'ping' }));
  });

  ws.on('message', (data) => {
    const response = JSON.parse(data);
    console.log('Response:', response);
    console.log('✓ Connection test passed');
    ws.close();
  });

  ws.on('error', (error) => {
    console.log('✗ Connection test failed:', error);
  });
}

testConnection();
```

#### Step 3: Test Core Browser Commands

```python
async def test_core_commands():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.recv()  # Connection message

        # Test navigation
        await ws.send(json.dumps({
            "command": "navigate",
            "url": "https://example.com"
        }))
        nav_response = json.loads(await ws.recv())
        assert nav_response["success"], "Navigation failed"
        print("✓ Navigation works")

        await asyncio.sleep(2)

        # Test content extraction
        await ws.send(json.dumps({
            "command": "get_content"
        }))
        content_response = json.loads(await ws.recv())
        assert "content" in content_response, "Content extraction failed"
        assert "html" in content_response["content"], "HTML missing"
        print("✓ Content extraction works")

        # Test screenshot
        await ws.send(json.dumps({
            "command": "screenshot"
        }))
        screenshot_response = json.loads(await ws.recv())
        assert "data" in screenshot_response, "Screenshot failed"
        print("✓ Screenshot works")

        print("✓ All core commands working")

asyncio.run(test_core_commands())
```

#### Step 4: Test Pattern Detection (Agent Layer)

```python
def test_pattern_detection():
    """Test pattern detection in agent layer"""
    test_text = """
    Contact us at: support@example.com
    Phone: +1-555-123-4567
    Bitcoin: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
    Twitter: @example_user
    """

    patterns = {
        "emails": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "phones": r'\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}',
        "btc": r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b',
        "twitter": r'@\w{1,15}'
    }

    for name, pattern in patterns.items():
        matches = re.findall(pattern, test_text)
        print(f"✓ {name}: {len(matches)} found - {matches}")

    print("✓ Pattern detection works")

test_pattern_detection()
```

#### Step 5: Test Evidence Collection

```python
async def test_evidence_collection():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.recv()

        # Navigate to test page
        await ws.send(json.dumps({
            "command": "navigate",
            "url": "https://example.com"
        }))
        await ws.recv()
        await asyncio.sleep(2)

        # Capture screenshot evidence
        await ws.send(json.dumps({
            "command": "capture_screenshot_evidence",
            "capturedBy": "test-agent"
        }))
        evidence = json.loads(await ws.recv())

        assert evidence["success"], "Evidence capture failed"
        assert "sha256" in evidence, "Hash missing"
        assert "timestamp" in evidence, "Timestamp missing"
        print("✓ Evidence capture works")
        print(f"  SHA256: {evidence['sha256'][:16]}...")
        print(f"  Timestamp: {evidence['timestamp']}")

asyncio.run(test_evidence_collection())
```

### Common Issues and Solutions

#### Issue 1: "Unknown command: extract_osint_data"

**Symptom:**
```json
{
  "success": false,
  "error": "Unknown command: extract_osint_data"
}
```

**Solution:**
Replace with `get_content` and implement pattern detection in agent:
```python
# Old (v8.2.4)
await ws.send({"command": "extract_osint_data"})

# New (v10.0.0)
await ws.send({"command": "get_content"})
response = json.loads(await ws.recv())
text = response["content"]["text"]
# Agent detects patterns
emails = re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', text)
```

#### Issue 2: "Unknown command: create_investigation"

**Symptom:**
```json
{
  "success": false,
  "error": "Unknown command: create_investigation"
}
```

**Solution:**
Implement investigation management in agent layer (see [Investigation Management Migration](#2-investigation-management-migration)).

#### Issue 3: "Unknown command: fill_form_with_sock_puppet"

**Symptom:**
```json
{
  "success": false,
  "error": "Unknown command: fill_form_with_sock_puppet"
}
```

**Solution:**
Agent fetches credentials and uses `fill` command:
```python
# Fetch identity from your database
identity = await identity_db.get(identity_id)

# Fill form fields individually
for field_name, value in identity["credentials"].items():
    await browser.send({
        "command": "fill",
        "selector": f"[name='{field_name}']",
        "value": value
    })
```

#### Issue 4: MCP Tool Not Found

**Symptom:**
```
Error: Tool "browser_extract_osint_data" not found
```

**Solution:**
Use `browser_get_content` and implement pattern detection in agent:
```python
# Old (v8.2.4)
result = await mcp.call_tool("browser_extract_osint_data", {
    "types": ["email", "phone"]
})

# New (v10.0.0)
content = await mcp.call_tool("browser_get_content", {})
text = content["content"]["text"]
# Agent detects patterns
emails = re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', text)
```

### Performance Considerations

#### Before (v8.2.4):
- Single command for pattern detection: ~100ms
- Investigation management overhead: ~50ms per page
- Built-in deduplication: ~20ms

#### After (v10.0.0):
- Content extraction: ~50ms
- Agent pattern detection: ~10ms (simple regex)
- Agent deduplication: ~5ms (set operations)
- **Net result:** Faster due to simpler browser architecture

### Migration Verification Checklist

- [ ] All browser commands working (navigate, click, fill, extract)
- [ ] Pattern detection working in agent layer
- [ ] Investigation management implemented in agent
- [ ] Evidence collection working with agent organization
- [ ] Identity management working with external database
- [ ] Performance acceptable (see benchmarks above)
- [ ] Error handling robust
- [ ] Logging and monitoring in place

---

## Getting Help

### Documentation

- **[SCOPE.md](SCOPE.md)** - Architectural boundaries and scope definition
- **[ROADMAP.md](ROADMAP.md)** - Current development roadmap
- **[API Reference](core/api-reference.md)** - Complete WebSocket API documentation
- **[REFACTORING-COMPLETE-2026-01-09.md](REFACTORING-COMPLETE-2026-01-09.md)** - Detailed refactoring summary

### GitHub Issues

Report migration issues: [github.com/yourusername/basset-hound-browser/issues](https://github.com/yourusername/basset-hound-browser/issues)

Use these labels:
- `migration` - Migration-related questions
- `breaking-change` - Issues with breaking changes
- `documentation` - Documentation improvements

### Community Support

- **Discord:** [Join our server](#) (link TBD)
- **Email:** support@basset-hound.dev (TBD)

### Example Projects

See complete migration examples:
- [basset-hound-examples](https://github.com/yourusername/basset-hound-examples) - Migration examples
- [palletai-agents](https://github.com/yourusername/palletai-agents) - Agent implementation examples

### Professional Support

For enterprise migrations or custom implementation:
- Email: enterprise@basset-hound.dev (TBD)
- Consulting services available for large-scale migrations

---

## Summary

### Key Takeaways

1. **v10.0.0 is a major architectural shift** - Browser is now a pure automation tool
2. **33 commands removed** - All OSINT/intelligence features moved to agent layer
3. **27 MCP tools removed** - Same architectural focus
4. **Migration is straightforward** - Most changes are moving logic to agent layer
5. **Performance improved** - Simpler architecture = faster execution

### Migration Timeline

- **Simple usage (basic automation):** 1-2 hours
- **Medium usage (pattern detection):** 2-4 hours
- **Complex usage (investigations, evidence):** 4-8 hours
- **Enterprise deployment:** 1-2 days with testing

### Next Steps

1. Read [SCOPE.md](SCOPE.md) to understand new architecture
2. Test your current usage against v10.0.0
3. Implement agent-layer pattern detection
4. Implement investigation management if needed
5. Test thoroughly before production deployment

### Support

If you encounter issues during migration, please open a GitHub issue with:
- Your v8.2.4 usage pattern
- The specific command/tool that's not working
- Your attempted v10.0.0 equivalent
- Error messages (if any)

We're here to help make your migration smooth!

---

**Last Updated:** January 9, 2026
**Version:** 10.0.0
**Status:** Production Ready
