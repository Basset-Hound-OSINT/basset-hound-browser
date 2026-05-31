# Basset Hound Browser - Project Scope Definition

**Last Updated:** May 31, 2026

---

## Purpose

Basset Hound Browser is a **browser automation tool** designed to be controlled by external applications, AI agents, or automation scripts. It provides powerful capabilities for web interaction, data extraction, and bot detection evasion, while remaining **intelligence-agnostic**.

---

## Core Principle

> **The browser is a tool with capabilities, not an intelligent system.**

- The browser **captures and provides** raw data
- External agents/applications **analyze and decide** what to do with that data
- The browser does not make intelligence decisions about what data is important

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

## In Scope ✅

### 1. Browser Automation
- **Navigation:** Load URLs, go back/forward, refresh
- **Interaction:** Click elements, fill forms, type text, scroll
- **Waiting:** Wait for elements, page loads, network idle
- **JavaScript execution:** Run custom scripts in page context

### 2. Data Extraction (Raw/Unprocessed)
- **Page content:** HTML, text, DOM structure
- **Links:** Extract all links from page (no classification)
- **Images:** Extract image URLs, dimensions, alt text
- **Forms:** Extract form structure and fields
- **Metadata:** Extract meta tags, Open Graph tags
- **Network data:** Capture HTTP requests/responses (HAR format)
- **Storage:** Extract cookies, localStorage, sessionStorage
- **Console logs:** Capture browser console output

### 3. Forensic Data Capture
- **Screenshots:** Full page, specific elements, annotated
- **Page archives:** Save as MHTML, HTML, WARC, PDF
- **Network capture:** Full HAR with timing, headers, bodies
- **DOM snapshots:** Capture full DOM state
- **Image forensics:** EXIF, IPTC, XMP metadata, GPS coordinates
- **OCR:** Extract text from images (tesseract.js)
- **Cryptographic hashing:** SHA-256 for integrity verification
- **Timestamps:** Capture time for all actions
- **Chain of custody:** Log who captured what and when

### 4. Bot Detection Evasion
- **Fingerprint spoofing:** Canvas, WebGL, Audio, fonts
- **Platform consistency:** Match OS, browser, GPU, screen resolution
- **Human behavior simulation:** Natural mouse movement, realistic typing
- **Behavioral AI:** Fitts's Law mouse paths, biometric typing patterns
- **Honeypot detection:** Identify trap fields in forms
- **Rate limiting:** Adaptive delays, exponential backoff
- **TLS fingerprinting:** JA3/JA4 research and mitigation strategies

### 5. Network Capabilities (Tor-Focused)

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

### 2. Intelligence Analysis
- ❌ **Pattern detection:** Detecting emails, phones, crypto addresses, social handles
- ❌ **Data classification:** Deciding what data is "important" or "relevant"
- ❌ **OSINT pattern matching:** Automated detection of intelligence indicators
- ❌ **Confidence scoring:** Rating how "useful" extracted data is
- ❌ **Relationship inference:** Detecting connections between data points

### 3. Investigation Management
- ❌ **Investigation workflows:** Managing investigation lifecycle, queuing URLs
- ❌ **Case management:** Organizing evidence into cases/investigations
- ❌ **Evidence packages:** Creating investigation bundles (just capture raw evidence)
- ❌ **Investigation IDs:** Tracking which investigation evidence belongs to
- ❌ **Workflow orchestration:** Deciding what pages to visit next

### 4. Data Processing & Transformation
- ❌ **Ingestion modes:** Deciding what to ingest (automatic/selective/filtered)
- ❌ **Deduplication:** Tracking what's been seen before across sessions
- ❌ **Normalization:** Converting data to standard formats
- ❌ **Entity creation:** Creating Person/Organization objects from data
- ❌ **Orphan data generation:** Transforming data for external systems
- ❌ **Provenance building:** Creating complex data lineage structures

### 5. External System Integration
- ❌ **basset-hound API integration:** Fetching/pushing data to basset-hound
- ❌ **Sock puppet management:** Managing fake personas in external database
- ❌ **Activity syncing:** Pushing activity logs to external systems
- ❌ **Credential fetching:** Pulling credentials from external APIs

### 6. Analysis Tools
- ❌ **Blockchain analysis:** Analyzing crypto transactions
- ❌ **Face detection:** Identifying faces in images
- ❌ **Object detection:** Identifying objects in images
- ❌ **Logo detection:** Identifying company logos
- ❌ **Reverse image search:** Looking up images online
- ❌ **Sentiment analysis:** Analyzing text sentiment
- ❌ **Entity extraction:** NLP-based name/org extraction

### 7. Decision-Making
- ❌ **What to extract:** Browser extracts everything, agent decides what to keep
- ❌ **Where to navigate:** Agent tells browser where to go
- ❌ **What to click:** Agent identifies targets, browser executes
- ❌ **When to capture evidence:** Agent triggers capture at right moment

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
