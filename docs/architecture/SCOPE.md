# Basset Hound Browser - Project Scope Definition

**Last Updated:** July 5, 2026

> **CURRENT STATUS (2026-07-05):** MVP complete + proven — boots/drives headless + GUI (`npm run smoke:mvp` = **15/15**), **18-tool MCP** incl. `forensic_capture`, Tor/proxy anonymity + coherent stealth identity proven, all 13 files >1200 lines modularized to <1200 (`websocket/server.js` 12,096→1,110, 904 commands preserved), security hardened. Repo hygiene pass (2026-07-05): fake-secret test/doc fixtures scrubbed, ~45 MB of test-artifact/screenshot junk untracked + gitignored, dev TLS certs untracked. **Authoritative live status → [../planning/PROJECT-STATUS-MATRIX.md](../planning/PROJECT-STATUS-MATRIX.md).** The scope boundaries below (§0 blacklist, in/out-of-scope) are **UNCHANGED** and remain in force. Known still-present blacklist violations, DEFERRED: `src/agents/orchestrator.js`, `src/features/ai-analysis.js`.

---

## Purpose

Basset Hound Browser is a **focused data collection tool** - a custom browser designed to be controlled by external applications, AI agents, or automation scripts. It captures raw data from web pages through WebSocket API commands, providing forensic-grade evidence and interaction capabilities while remaining **intelligence-agnostic**.

---

## Core Principle

> **The browser is a DATA COLLECTION TOOL, not an intelligent system.**

- The browser **captures and provides** raw data from web pages
- External agents/applications **analyze and decide** what to do with that data
- The browser does not make intelligence decisions about what data is important or valuable
- All browser capabilities exist to support accurate, forensic-quality data capture

---

## Development Timeline Philosophy

### Dates are Planning Guides, Not Deadlines

Timeline targets (June 15 v12.1.0, July 15 v12.2.0, etc.) exist to inform planning and communicate expected delivery windows to stakeholders. They are **not constraints on development velocity**.

- **Early delivery accelerates progress:** If features are ready before a target date, we deploy immediately—waiting serves no one
- **Extended timelines focus on quality:** If work requires more time beyond the target date, we continue working until the job is complete
- **Dates inform stakeholders, not developers:** Timelines help us communicate with external teams about when they can expect capabilities, but they don't dictate when we stop working

### Continuous Development Model

Basset Hound Browser operates under a **continuous development philosophy**:

- **Work continues as long as improvements are identified.** There is no "waiting for the next sprint" or pausing at calendar milestones
- **Each completion triggers identification of next work.** As soon as one feature is done and deployed, we identify and begin the next set of improvements
- **Autonomous agent cycles continue indefinitely.** Wave 10, Wave 11, Wave 12... continue as long as the project is active and improvements exist
- **Quality gates, not calendar events, determine readiness.** A feature is deployed when it meets quality standards—whether that's on schedule or ahead of it

### Key Principle

> **When there's work to be done, we do it. Dates help us communicate timelines to stakeholders, but actual delivery is driven by completion of work, not calendar events.**

This approach means:
- **Predictable velocity:** External teams can rely on consistent delivery
- **Rapid feedback cycles:** Features ship as soon as they're ready
- **No artificial delays:** Calendar alignment doesn't override technical readiness
- **Stakeholder clarity:** Published timelines set expectations without constraining technical execution

---

## Core Mission (SIMPLIFIED)

> **Extract all possible information from websites and make it available over the WebSocket API. Later: add optional data conditioning operations on top of that raw data.**

This is straightforward. The browser:
1. **Extracts everything** - HTML, network logs, device IDs, storage, console, etc.
2. **Returns raw data** - unprocessed, as-captured, ready for external analysis
3. **Optionally conditions data** - if we need to process/filter/transform, add that as additional operations (not replacements)

---

## In Scope ✅

### 1. Browser Navigation & Control
- **Navigation:** Load URLs, go back/forward, refresh
- **Interaction:** Click elements, fill forms, type text, scroll, hover
- **Waiting:** Wait for elements, page loads, network idle
- **JavaScript execution:** Run custom scripts in page context
- **Tab/window management:** Create, switch, close tabs

### 2. Raw Data Extraction (PRIMARY PURPOSE)
All extraction returns complete, unprocessed data for external analysis.
- **Page content:** Full HTML source, plain text, DOM structure
- **Page metadata:** Meta tags, Open Graph, Twitter Card, favicon
- **Links:** All links from page (no filtering)
- **Images:** Image URLs, dimensions, alt text, EXIF metadata
- **Forms:** Form structure, field types, validation rules
- **Network logs:** Complete HTTP requests/responses, headers, timing
- **Storage:** Cookies, localStorage, sessionStorage, IndexedDB contents
- **Console output:** Browser console logs, errors, warnings
- **Device/Browser IDs:** User agent, platform, screen resolution, hardware info

### 3. Forensic Evidence Capture (WITH INTEGRITY)
Capture raw page states with cryptographic verification.
- **Screenshots:** Full page, element, viewport captures with metadata
- **Page archives:** Save as HTML, WARC, PDF
- **Network capture:** Full HAR including headers and response bodies
- **DOM snapshots:** Complete DOM tree with computed styles
- **Image metadata:** EXIF, IPTC, XMP, GPS data, OCR text
- **Integrity verification:** SHA-256 hashing of all captured evidence
- **Audit trail:** Timestamp, source, and method for each capture

### 4. Bot Evasion (TO ACCESS CONTENT)
Allows the browser to access sites that block automation.
- **Fingerprint spoofing:** Canvas, WebGL, Audio, fonts
- **Behavior simulation:** Natural mouse movement, realistic typing
- **Honeypot detection:** Identify and avoid trap fields
- **Rate limiting:** Adaptive delays to avoid blocking
- **User agent rotation:** Match common browsers and platforms

### 5. Optional Data Conditioning (FUTURE LAYER)
Additional operations applied on top of raw data (not replacing it).
- **HTML sanitization:** Clean/normalize HTML
- **Text extraction:** Clean text from HTML
- **Link classification:** Categorize extracted links
- **Data filtering:** User-defined raw data filters
- **Format conversion:** Convert raw data between formats

❌ **NOT IN SCOPE** (Intelligence/Analysis Functions)
- ❌ Threat analysis or classification
- ❌ OSINT correlation or enrichment
- ❌ Third-party API calls (Shodan, Maltego, etc.)
- ❌ Complex edge case handling (focus on reliability, not exhaustive coverage)
- ❌ **Censys API integration:** Not implemented, browser does not call Censys
- ❌ **Domain intelligence APIs:** Not implemented, browser does not call threat intel services
- ❌ **Reverse image search APIs:** Not implemented, browser does not use image lookup services
- ❌ **ML-based analysis services:** Not implemented, browser does not call ML APIs
- ❌ **Any cloud service integrations:** Not in browser scope

> **Key Principle:** Basset Hound Browser is a **focused automation and data collection API**. It does NOT integrate with external intelligence services. External applications calling the browser API can choose to integrate third-party services in their own layers if desired.

> **Architecture:** Basset provides raw data via WebSocket API. External agents/applications consuming that data can optionally enrich it with Shodan, Maltego, Censys, or other services. The browser stays focused on browser automation and forensic capture.

### 6. Machine Learning Integrations
❌ **EXPLICITLY OUT OF SCOPE**
- ❌ **ML-based fingerprint detection:** Browser does not use ML models
- ❌ **Behavioral pattern learning:** Not implemented in browser
- ❌ **Adaptive evasion ML:** Browser uses deterministic evasion, not trained models
- ❌ **Computer vision services:** Not implemented (image analysis is agent responsibility)
- ❌ **NLP/text analysis:** Not implemented (text analysis is agent responsibility)
- ❌ **Any ML inference:** Not in browser scope

> **Principle:** Machine learning and AI analysis are handled by **external agents** using the raw data provided by the browser. The browser itself is deterministic and model-free.

### 7. Network Capabilities (Tor-Focused)

> **Key Clarification:** Generic proxy configuration is NOT a user-configurable feature. The browser's proxy capabilities exist specifically for **Tor integration** to support network forensics and .onion site access.

#### Tor Integration (IN SCOPE)
- **Embedded/Portable Tor:** Start and manage embedded Tor daemon
- **System-level Tor (Docker):** Connect to system Tor installation in containers
- **Onion services:** Navigate to .onion sites via Tor SOCKS proxy
- **Tor new identity:** Request new circuit for IP rotation
- **Tor status/control:** Monitor bootstrap progress, get exit node info
- **Tor configuration:** Exit country preferences, circuit management
- **Tor Master Switch:** Intelligent routing control with three modes
  - `set_tor_mode` / `get_tor_mode` - Master switch control
  - **OFF mode:** Never route through Tor (direct connection)
  - **ON mode:** Always route through Tor (maximum anonymity)
  - **AUTO mode:** Automatically switch based on .onion URLs
- **Tor on/off toggle:** Dynamically enable/disable Tor routing during automation
  - `tor_enable` - Route traffic through Tor
  - `tor_disable` - Return to direct connection
  - `tor_toggle` - Toggle current state
  - Note: .onion domains require `TOR_MODE=1` at startup for DNS resolution

#### SOCKS Proxy for Tor (IN SCOPE)
- **SOCKS5 proxy support:** For routing traffic through Tor (127.0.0.1:9050)
- **Tor connectivity verification:** Test that Tor is functioning
- **DNS resolution via Tor:** Prevent DNS leaks for .onion access

#### Generic Proxy (OUT OF SCOPE)
- ❌ **User-configurable HTTP/HTTPS proxies:** Not exposed to users
- ❌ **Generic proxy rotation:** Not a browser feature
- ❌ **Proxy pool management:** Belongs in basset-hound-networking

> **Why this distinction matters:** Tor integration has a direct impact on **network forensics capabilities** - accessing .onion sites, anonymous browsing for investigations, and exit node rotation. Generic proxy support would be outside the browser's forensic focus.

#### Docker Considerations
- **Embedded Tor:** Works in Docker, downloads on first run (~80MB)
- **System Tor:** Alternative for Docker - install Tor daemon in container (smaller, faster startup)
- **No special permissions needed:** Browser connects to Tor SOCKS like any client

> **Note:** Advanced networking infrastructure (proxy pools, rotation strategies, bridge configuration, exit node selection) has been moved to a separate project: **Basset Hound Networking**. This browser accepts a single proxy/Tor configuration; external tools manage complex routing.

#### Summary: Network Control Architecture

| Feature | In Scope? | Reason |
|---------|-----------|--------|
| Tor Master Switch (OFF/ON/AUTO) | ✅ YES | Network forensics - intelligent .onion handling |
| Tor daemon control (start/stop) | ✅ YES | Network forensics - required for .onion access |
| Tor identity/circuit management | ✅ YES | Network forensics - IP rotation for investigations |
| Exit node configuration | ✅ YES | Network forensics - geographic targeting |
| .onion site access | ✅ YES | Network forensics - dark web investigations |
| Generic HTTP/HTTPS proxies | ❌ NO | Out of scope - use basset-hound-networking |
| Proxy pool management | ❌ NO | Out of scope - use basset-hound-networking |
| Proxy rotation strategies | ❌ NO | Out of scope - use basset-hound-networking |
| Proxy health checking | ❌ NO | Out of scope - use basset-hound-networking |

**The Tor Master Switch is the ONLY user-facing network routing control in this browser.** This matches normal browser behavior - browsers have Tor support (like Tor Browser) but don't have generic proxy pool management built in.

### 6. Network Monitoring & Forensics (Browser-Level)
- **DNS query capture:** Record all DNS lookups made by browser
- **TLS certificate extraction:** Capture SSL certificates and chains
- **WebSocket tracking:** Monitor WebSocket connections and messages
- **HTTP header analysis:** Extract and analyze security headers
- **HAR capture:** Complete HTTP archive recording
- **Cookie provenance:** Track cookie origins and modifications
- **Timeline generation:** Chronological network event log

> **Distinction:** Network *monitoring* observes what the browser sees (passive). Network *infrastructure* modifies how traffic is routed (active). This browser does monitoring only.

### 7. Profile & Identity Management
- **Browser profiles:** Isolated sessions with separate cookies/storage
- **Fingerprint profiles:** Consistent fingerprints per identity
- **Profile switching:** Switch between multiple identities
- **Credential filling:** Fill forms with provided credentials
- **Session management:** Track when profiles are active

### 8. Control Interfaces
- **WebSocket API:** Remote control via WebSocket (port 8765)
- **MCP Server:** AI agent integration via Model Context Protocol
- **Authentication:** Token-based auth for secure connections
- **SSL/TLS:** Encrypted WebSocket (wss://)

---

## Out of Scope ❌

### 0. Internal Agent Orchestration & AI/ML Models (BLACKLIST — HARD BOUNDARY)

> ⛔ **BLACKLIST:** These are the most fundamental scope violations. They are non-negotiable and take precedence over any feature request or roadmap item.

**The browser MUST NOT create, spawn, schedule, or orchestrate agents internally.**
- ❌ **No in-process agent orchestrator:** No `AgentOrchestrator`, task queue, agent registry, or load balancer that runs "agents" inside the browser process
- ❌ **No internal task scheduling/dispatch:** No submitting, assigning, or completing "tasks" against internally managed agents/workers
- ❌ **No agent lifecycle management:** No registering, health-checking, or coordinating agents from within browser source

**The browser MUST NOT integrate or call AI/ML models.**
- ❌ **No LLM/model API calls:** No Claude, OpenAI, Ollama, or any other LLM/inference endpoint invoked from browser source
- ❌ **No embeddings or inference:** No embedding generation, vector inference, or ML model loading/execution in the browser
- ❌ **No model SDKs in browser code:** `anthropic`, `openai`, `@anthropic-ai/*`, and similar model clients do not belong in browser source

> **Rationale:** Basset Hound Browser is a **capture/control tool**, not an intelligent system. Intelligence — reasoning, orchestration, model inference — belongs in **EXTERNAL agents** that drive the browser via the **MCP server** and the **WebSocket/HTTP API**. Keeping the browser deterministic and model-free preserves forensic reproducibility and a clean architectural boundary.

**✅ IN SCOPE / ADJACENT — control & coordination surfaces (NOT internal agents or models):**
- ✅ **MCP server + WebSocket/HTTP API:** The control surface external agents call to drive the browser. This is how orchestration reaches the browser — from the outside in.
- ✅ **Deterministic forensic capture/analysis:** Hashing (SHA-256), metadata extraction, and chain-of-custody documentation — deterministic and model-free.
- ✅ **Real-Time Collaboration API:** Session locking and event streaming that coordinate concurrent **EXTERNAL** clients. This coordinates external callers; it does not run agents or models inside the browser.

### 1. Networking Infrastructure (Moved to Basset Hound Networking)
- ❌ **Proxy pool management:** Managing multiple proxies, health checking, failover
- ❌ **Proxy rotation strategies:** Round-robin, random, fastest, geo-based selection
- ❌ **Geographic proxy selection:** Selecting proxies by country/region
- ❌ **Proxy health monitoring:** Checking if proxies are alive, tracking performance
- ❌ **Proxy chaining:** Multi-hop proxy configurations
- ❌ **VPN integration:** VPN tunnel management and configuration
- ❌ **SSH tunnel management:** SSH-based proxy tunnels
- ❌ **Tor bridge configuration:** Advanced bridge setup (obfs4, meek, etc.)
- ❌ **Generic HTTP/HTTPS proxy UI:** User-configurable proxy settings for non-Tor use

> **Why out of scope:** These features modify network routing at infrastructure level. Browser automation should use a pre-configured proxy endpoint; external tools handle the infrastructure.

> **Exception - Tor:** Basic Tor integration IS in scope because it directly enables network forensics (accessing .onion sites, anonymous investigation). The browser can start/stop embedded Tor and route traffic through it, but advanced Tor configuration (bridges, guards) is out of scope.

### 2. Intelligence Analysis & Decision-Making
These are EXTERNAL SYSTEM responsibilities - not the browser's job.
- ❌ **Pattern detection:** Detecting emails, phones, crypto addresses, social handles
- ❌ **Data classification:** Deciding what data is "important" or "relevant"  
- ❌ **OSINT pattern matching:** Automated detection of intelligence indicators
- ❌ **Confidence scoring:** Rating how "useful" extracted data is
- ❌ **Relationship inference:** Detecting connections between data points
- ❌ **Decision-making:** What to extract, where to navigate, what to click
- ❌ **Investigation context:** Understanding why data matters

> **Principle:** External agents decide what is important. Browser provides everything and lets agents/humans decide.

### 3. Investigation Management
These are EXTERNAL APPLICATION responsibilities - move to palletai or basset-hound.
- ❌ **Investigation workflows:** Managing investigation lifecycle, queuing URLs
- ❌ **Case management:** Organizing evidence into cases/investigations
- ❌ **Evidence packages:** Creating investigation bundles for specific cases
- ❌ **Investigation IDs:** Linking evidence to investigations
- ❌ **Workflow orchestration:** Deciding what pages to visit next
- ❌ **Task queuing:** Managing the investigation task queue

> **Principle:** External agents orchestrate. Browser is called for individual actions.

### 4. Data Processing & Transformation
These are EXTERNAL SYSTEM responsibilities - not the browser's job.
- ❌ **Ingestion modes:** Deciding what to ingest (automatic/selective/filtered)
- ❌ **Deduplication:** Tracking what's been seen before across sessions
- ❌ **Normalization:** Converting data to standard formats
- ❌ **Entity creation:** Creating Person/Organization objects from data
- ❌ **Orphan data generation:** Transforming data for external systems
- ❌ **Provenance building:** Creating complex data lineage structures
- ❌ **Data enrichment:** Adding additional fields or computed values

> **Principle:** Browser extracts raw data. External systems transform as needed.

### 5. External System Integration
These are EXTERNAL APPLICATION responsibilities - not the browser's job.
- ❌ **basset-hound API integration:** Fetching/pushing data to external database
- ❌ **Sock puppet management:** Managing fake personas
- ❌ **Activity syncing:** Pushing activity logs to external systems
- ❌ **Credential fetching:** Pulling credentials from external APIs
- ❌ **Third-party API calls:** Any external service integration

> **Architecture:** Browser provides raw data via WebSocket. External applications call third-party services if needed.

### 6. Analysis & AI Services
These are EXTERNAL APPLICATION responsibilities - not the browser's job.
- ❌ **Face detection:** Identifying faces in images
- ❌ **Object detection:** Identifying objects in images
- ❌ **Logo detection:** Identifying company logos
- ❌ **Reverse image search:** Looking up images online
- ❌ **Sentiment analysis:** Analyzing text sentiment
- ❌ **Entity extraction:** NLP-based name/org extraction
- ❌ **ML-based analysis:** Any machine learning models
- ❌ **Blockchain analysis:** Analyzing crypto transactions

> **Principle:** Browser provides raw images/text. External agents use Claude, vision models, etc.

### 8. Infrastructure, Deployment & Scaling (OUT OF SCOPE - Post-Project)
- ❌ **Kubernetes orchestration:** K8s deployments, service mesh, container orchestration
- ❌ **Terraform/IaC:** Infrastructure-as-code, cloud resource management
- ❌ **Load balancing:** Multi-instance scaling, traffic distribution
- ❌ **Auto-scaling policies:** Horizontal pod autoscaling, cloud autoscaling
- ❌ **Cluster management:** Multi-node deployments, cluster control planes
- ❌ **Service discovery:** DNS, service registration, endpoint management
- ❌ **Storage orchestration:** Persistent volumes, distributed storage setup
- ❌ **Secrets management:** Kubernetes secrets, HashiCorp Vault integration
- ❌ **Monitoring/observability:** Prometheus, Grafana, distributed tracing infrastructure
- ❌ **GitOps/CI-CD pipelines:** Flux, ArgoCD, complex deployment automation
- ❌ **Container registry management:** Docker Hub/ECR/GCR setup and management
- ❌ **Network policies:** K8s network policy definitions, ingress controllers
- ❌ **Cloud provider integration:** AWS, GCP, Azure-specific features

> **Explicit Note:** Kubernetes and Terraform infrastructure scaling are **explicitly out of scope** for this project. The browser is designed for:
> - **Single-container deployment** (standard Docker container)
> - **Docker Compose** for multi-service coordination (with basset-hound-networking)
> - **Manual horizontal scaling** (run multiple containers, external load balancer)
> 
> Infrastructure automation (Kubernetes, Terraform) will be addressed in a **separate phase after core production deployment** is complete and operational. Current focus is **browser functionality, stability, and performance**.

---

## Boundary Examples

### ✅ IN SCOPE: Extract All Links
```javascript
// Browser command: extract_links
{
  "links": [
    {"href": "https://example.com/page1", "text": "Page 1"},
    {"href": "mailto:contact@example.com", "text": "Email Us"},
    {"href": "tel:+1-555-1234", "text": "Call Us"}
  ]
}
```
**Why:** Raw extraction of page structure

### ❌ OUT OF SCOPE: Detect Email Addresses
```javascript
// This would be OUT OF SCOPE
{
  "osint_data": [
    {"type": "email", "value": "contact@example.com", "confidence": 0.95},
    {"type": "phone", "value": "+1-555-1234", "confidence": 0.92}
  ]
}
```
**Why:** Pattern detection and classification is intelligence work

---

### ✅ IN SCOPE: Capture Evidence with Hash
```javascript
// Browser command: screenshot
{
  "screenshot": "base64...",
  "sha256": "abc123...",
  "timestamp": "2026-01-09T10:30:00Z",
  "url": "https://example.com",
  "dimensions": {"width": 1920, "height": 1080}
}
```
**Why:** Raw forensic capture with integrity verification

### ❌ OUT OF SCOPE: Create Evidence Package
```javascript
// This would be OUT OF SCOPE
{
  "package_id": "pkg_123",
  "investigation_id": "inv_456",
  "case_number": "CASE-2026-001",
  "evidence_items": [...]
}
```
**Why:** Organizing evidence into investigations is intelligence work

---

### ✅ IN SCOPE: Fill Form with Provided Credentials
```javascript
// Browser command: fill_form
{
  "fields": {
    "username": "john.doe",
    "password": "secret123",
    "email": "john@example.com"
  }
}
```
**Why:** Executing automation with provided data

### ❌ OUT OF SCOPE: Fetch Credentials from Sock Puppet
```javascript
// This would be OUT OF SCOPE
{
  "sock_puppet_id": "sp_789",
  "fetch_from_basset_hound": true
}
```
**Why:** Managing identities in external systems is intelligence work

---

### ✅ IN SCOPE: Extract Image EXIF Metadata
```javascript
// Browser command: extract_image_metadata
{
  "exif": {
    "Make": "Apple",
    "Model": "iPhone 14",
    "DateTime": "2025:12:01 10:30:00",
    "GPSLatitude": 37.7749,
    "GPSLongitude": -122.4194
  }
}
```
**Why:** Raw forensic metadata extraction

### ❌ OUT OF SCOPE: Prepare OSINT Data for Ingestion
```javascript
// This would be OUT OF SCOPE
{
  "orphan_type": "GEOLOCATION",
  "basset_hound_format": {...},
  "confidence": 0.98,
  "tags": ["photo", "location"]
}
```
**Why:** Transforming data for external systems is intelligence work

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    AI AGENTS (palletai)                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   OSINT      │  │  Investigation│  │   Evidence   │      │
│  │   Agent      │  │    Manager    │  │   Manager    │      │
│  └──────┬───────┘  └──────┬────────┘  └──────┬───────┘      │
│         │                 │                   │              │
│         └─────────────────┴───────────────────┘              │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                     MCP / WebSocket
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              BASSET HOUND BROWSER (This Tool)                │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Navigate   │  │   Extract    │  │   Capture    │      │
│  │   Click      │  │   Data       │  │   Evidence   │      │
│  │   Fill       │  │   (Raw)      │  │   (Forensic) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Evade      │  │   Tor/Proxy  │  │   Profiles   │      │
│  │   Detection  │  │   Network    │  │   Sessions   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Web Pages   │
                    └───────────────┘
```

**Key Points:**
- **Agents** make intelligence decisions (what to investigate, what data matters)
- **Browser** provides capabilities (navigate, extract, evade, capture)
- **Data flows UP** from browser to agents (raw and unprocessed)
- **Commands flow DOWN** from agents to browser (what to do)

---

## Design Principles

### 1. Stateless Operation
- Browser does not maintain investigation state
- Each command is independent
- Agent maintains context and state

### 2. Raw Data First
- Always return unprocessed data
- No filtering or classification
- Let the agent decide what's important

### 3. Capability-Focused API
- Commands express **actions** (navigate, click, extract)
- Not **goals** (investigate, analyze, classify)

### 4. Separation of Concerns
- **Browser:** Technical capabilities
- **Agent:** Intelligence decisions
- **basset-hound:** Data storage
- **palletai:** Multi-agent orchestration

### 5. Tool, Not Platform
- Browser is a tool in a larger system
- It doesn't know about investigations, cases, or missions
- It just does what it's told and reports back

---

## AI Agent Integration Testing (IN SCOPE)

### MCP Testing Methodology

Basset Hound Browser's MCP server is systematically validated through **multi-model agent testing**. This ensures the MCP interface works effectively with different AI models and capability levels, providing integrators with clear performance expectations.

#### Testing Strategy

**Three-Model Validation:**
- **Opus 4.7** (full capability) - Complex reasoning, comprehensive testing
- **Sonnet 4.6** (balanced) - Strong reasoning with good speed-capability tradeoff  
- **Haiku 4.5** (fast) - Optimized for speed, practical tasks

**Ten Core Test Scenarios:**
1. Simple Navigation - Visit multiple URLs
2. Form Interaction - Fill and submit forms
3. Content Extraction - Get HTML, text, links
4. Screenshot Capture - Full-page image capture
5. Cookie Management - Get, set, clear cookies
6. Multiple Tabs - Create, switch, close tabs
7. JavaScript Execution - Run custom scripts in page
8. Proxy Configuration - Set and test proxy
9. User Agent Rotation - Get and rotate user agents
10. Tor Integration - Check Tor mode and status

#### Testing Artifacts

All MCP testing is systematically documented in:

```
docs/archive/experimentation/
├── mcp-testing-opus-4-7-[DATE]/
│   ├── test-prompts.md (exact prompts used)
│   ├── test-results.json (success rates, timings)
│   ├── findings.md (observations, issues)
│   └── screenshots/ (captures for analysis)
├── mcp-testing-sonnet-4-6-[DATE]/
│   ├── test-prompts.md
│   ├── test-results.json
│   └── findings.md
├── mcp-testing-haiku-4-5-[DATE]/
│   ├── test-prompts.md
│   ├── test-results.json
│   └── findings.md
└── MCP-TESTING-MASTER-REPORT-[DATE].md (consolidated findings)
```

#### Integration Performance Guide

`docs/integration-performance-recommendations.md` provides integrators with:
- Which model to use for different use cases
- Cost-benefit analysis per model
- Prompt engineering patterns that work well
- Error recovery strategies
- Optimization recommendations

This ensures secondary projects (like palletai agents) can make informed decisions about:
- Which Claude model to use for browser automation
- Expected performance and cost tradeoffs
- Prompt engineering best practices
- Error handling strategies

#### Scope of MCP Testing

✅ **IN SCOPE:**
- Systematic validation of browser automation capabilities via MCP
- Multi-model performance profiling
- Prompt engineering best practices documentation
- Error handling and recovery patterns
- Performance comparison across models

❌ **OUT OF SCOPE:**
- Intelligence analysis results
- Decision-making about what to test next
- Creating test data or scenarios
- Data interpretation or analysis

---

## Related Projects

- **basset-hound:** Entity storage and graph database
- **palletai:** AI agent framework for OSINT automation
- **autofill-extension:** Chrome extension for quick OSINT (lighter alternative)

---

## Migration Notes

**If you're coming from the previous architecture:**

- ❌ **Remove:** `InvestigationManager`, `DataTypeDetector`, `IngestionProcessor`, `SockPuppetIntegration`
- ✅ **Keep:** `EvidenceCollector` (simplified), `ImageMetadataExtractor`, `ExtractionManager`
- 🔄 **Refactor:** MCP server to remove OSINT tools, keep browser control tools

**For palletai agents:**
- Pattern detection moved to agent layer
- Investigation workflow managed by agents
- Browser is just called for extraction and capture

---

*This document defines the architectural boundaries of basset-hound-browser. Features outside this scope should be implemented in agent layers (palletai) or data layers (basset-hound).*
