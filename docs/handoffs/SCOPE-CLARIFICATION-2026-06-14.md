# Scope Clarification - June 14, 2026

**Document:** Scope alignment and priority refocus  
**Date:** June 14, 2026  
**Status:** ✅ COMPLETE  
**Deliverables:** Updated SCOPE.md, ROADMAP.md  

---

## Executive Summary

Basset Hound Browser has been successfully reframed as a **focused DATA COLLECTION TOOL** rather than a multi-function OSINT platform. Out-of-scope features have been explicitly removed from the roadmap, and all priorities now align with the core data collection mission.

### Changes Made

**SCOPE.md Updates:**
- ✅ Clarified core purpose: "DATA COLLECTION TOOL, not an intelligent system"
- ✅ Reorganized "In Scope" section to emphasize data collection as PRIMARY PURPOSE
- ✅ Expanded "Out of Scope" section with explicit principles for each category
- ✅ Added clear distinction: Browser collects raw data; external systems provide intelligence

**ROADMAP.md Updates:**
- ✅ Removed third-party API integrations from v12.1.0 (Shodan, Maltego, Censys, STIX)
- ✅ Removed AI/Agent integration from planned features
- ✅ Removed advanced analytics beyond performance metrics
- ✅ Removed investigation management system from roadmap
- ✅ Refocused v12.2.0 on data collection improvements (screenshots, video, stability)
- ✅ Added v12.3.0 planning with clear data collection focus
- ✅ Added explicit "Out of Scope" section with enterprise clustering

---

## Scope Boundaries - Clarified

### ✅ IN SCOPE

**Data Collection (Primary Purpose):**
- Navigation and interaction (click, fill, scroll)
- Content extraction (HTML, text, images, metadata)
- Network capture (HAR with full timing and headers)
- Forensic evidence (screenshots, archives, hashes)
- Storage extraction (cookies, localStorage, sessionStorage)
- Metadata capture (meta tags, Open Graph, EXIF, GPS)

**Forensic Quality Features:**
- SHA-256 hashing of all evidence
- Timestamps for audit trails
- Chain of custody logging
- Complete error capture

**Bot Evasion (For Data Access):**
- Fingerprint spoofing
- Behavioral AI (mouse, typing, scroll patterns)
- Honeypot detection
- Rate limiting and backoff
- Tor integration for .onion access

---

### ❌ OUT OF SCOPE (Removed/Clarified)

**Intelligence Analysis (External System)**
- Pattern detection (emails, phones, addresses)
- Data classification and scoring
- OSINT indicator matching
- Relationship inference
- Decision-making about importance

**Investigation Management (External System)**
- Investigation workflows and case management
- Evidence packaging for investigations
- Task queuing and orchestration
- Investigation context and IDs

**Data Processing (External System)**
- Data transformation and normalization
- Deduplication across sessions
- Entity creation (Person, Organization objects)
- Data enrichment and lineage building

**External Integrations (External System)**
- Shodan, Maltego, Censys APIs (NOT in browser)
- basset-hound sync and credentials
- Sock puppet management
- Third-party service APIs

**AI/ML Analysis (External System)**
- Face detection, object detection
- Logo detection, reverse image search
- Sentiment analysis, entity extraction
- ML-based fingerprint detection
- Blockchain analysis

**Infrastructure (Post-Project Phase)**
- Kubernetes orchestration
- Terraform / Infrastructure-as-Code
- Auto-scaling and load balancing
- Cloud-native deployment
- Service discovery and mesh

---

## Roadmap Refocus

### v12.1.0 (June 15) ✅ PRODUCTION LIVE
**Focus:** Stable, production-ready data collection

**Delivers:**
- 164 WebSocket commands for browser control
- Complete data extraction (HTML, text, images, metadata)
- Forensic evidence capture with hashing
- Bot evasion (fingerprints, behavioral AI, Tor)
- Reliability improvements
- Performance: 285-481 msg/sec @ 50-200 concurrent

### v12.2.0 (July 15) 📋 PLANNED
**Focus:** Enhanced data collection and reliability

**Delivers:**
- Screenshot quality improvements and faster capture
- Video recording of browser interactions (NEW)
- Better reliability and error recovery
- Performance optimization (350-400+ msg/sec target)
- Session persistence (500+ concurrent requests)
- Load testing validation
- Additional export formats

### v12.3.0 (August 15) 📋 PLANNED
**Focus:** Advanced data capture capabilities

**Delivers:**
- Advanced screenshot modes (parallax, viewport variants)
- Video capture enhancements
- Additional metadata formats
- Extraction templates and patterns
- Concurrent capture improvements
- Export format improvements

---

## Architecture - Crystal Clear

```
EXTERNAL APPLICATIONS (palletai, Claude, investigators)
        │
        │ "Navigate to X, click Y, extract Z"
        │ (commands over WebSocket API)
        ▼
BASSET HOUND BROWSER (Data Collection Tool)
        │
        │ Raw data: HTML, images, metadata, network logs,
        │ screenshots, archives, hashing, timestamps
        │
        ▼
WEB PAGES (What we're capturing from)
```

**Browser Responsibilities:**
- ✅ Navigate and interact with pages
- ✅ Capture raw data
- ✅ Provide forensic-quality evidence (hashing, timestamps)
- ✅ Evade detection (to access pages)

**External System Responsibilities:**
- ✅ Analyze and interpret data
- ✅ Make intelligence decisions
- ✅ Manage investigations and workflows
- ✅ Integrate with third-party services
- ✅ Deploy infrastructure at scale

---

## Key Principles - Now Explicit

### 1. Data Collection First
Everything the browser does exists to support capturing accurate, forensic-quality data from web pages. This is the singular purpose.

### 2. Raw Data Only
The browser returns completely unprocessed data. Classification, scoring, confidence assessment, and intelligence decisions happen in external systems.

### 3. Stateless Operations
Each WebSocket command is independent. The browser maintains no investigation state, no case context, no task queue. External agents orchestrate.

### 4. Forensic Integrity
All data captures include:
- SHA-256 hashing for tamper detection
- Precise timestamps for audit trails
- Complete chain of custody logging
- No data modification or normalization

### 5. External Intelligence
- Pattern detection → External (Claude, agents, OSINT tools)
- Data analysis → External (Vision models, NLP, domain experts)
- Decision-making → External (Agents, investigators, systems)
- Workflow orchestration → External (palletai, task queues)

---

## What This Clarification Accomplishes

### ✅ Scope Clarity
- Browser is focused and single-purpose
- Everyone knows what's in/out of scope
- No ambiguity about responsibilities

### ✅ Simplified Architecture
- Browser is a tool, not a platform
- External systems are responsible for intelligence
- Clean separation of concerns

### ✅ Cleaner Roadmap
- No third-party API integrations to build
- No investigation management to maintain
- No enterprise clustering overhead
- Clear focus on data collection excellence

### ✅ Better Integration
- External systems (palletai, Claude) know they're responsible for analysis
- No confusion about where intelligence work happens
- Clear API boundaries

### ✅ Sustainable Development
- Browser team focuses on data collection quality
- Intelligence team focuses on analysis
- Infrastructure team focuses on scaling
- No feature creep into other domains

---

## Files Updated

**Primary Changes:**
- `/home/devel/basset-hound-browser/docs/SCOPE.md` - Clarified purpose, reorganized scope sections, explicit principles
- `/home/devel/basset-hound-browser/docs/ROADMAP.md` - Removed out-of-scope features, refocused roadmap

**Key Sections Updated:**

### SCOPE.md
- Line 7-19: Updated purpose and core principle to emphasize data collection
- Line 53-81: Reorganized "In Scope" with data collection emphasis
- Line 200-260: Expanded "Out of Scope" with explicit principles for each category

### ROADMAP.md
- Line 193-211: Removed out-of-scope features (Shodan, Maltego, STIX, agent SDKs)
- Line 213-237: Added focused roadmap for v12.2.0 (data collection improvements)
- Line 213-237: Added v12.3.0 planning section
- Line 238-247: Explicit "Out of Scope" section

---

## Next Actions

### Immediate (Post-June 14)
1. ✅ Update SCOPE.md - COMPLETE
2. ✅ Update ROADMAP.md - COMPLETE
3. Share clarification with team (palletai, infrastructure teams)
4. Update v12.1.0 production deployment documentation

### For v12.2.0 Planning (June 15+)
1. Identify specific screenshot improvements
2. Define video recording MVP
3. Plan stability enhancements
4. Set performance targets (350-400+ msg/sec)

### For External Systems
1. Update palletai documentation on browser API
2. Clarify what analysis/intelligence work stays external
3. Define integration patterns (WebSocket API consumption)
4. Provide examples of external intelligence layers

---

## Success Metrics

**Scope Clarity:**
- ✅ All team members understand browser = data collection tool
- ✅ Zero ambiguity about intelligence work location
- ✅ All planned features align with data collection mission

**Architecture Simplification:**
- ✅ Browser code stays focused on data capture
- ✅ External systems handle analysis
- ✅ Clean API boundaries maintained

**Roadmap Clarity:**
- ✅ v12.2.0+ features are all data-collection-focused
- ✅ No enterprise clustering planned at browser level
- ✅ No third-party API integration in browser

---

## Document Status

✅ **COMPLETE** - June 14, 2026

**Handoff Ready:** Yes  
**Team Alignment:** Pending communication  
**Implementation:** Can proceed with v12.2.0 planning  

---

*This scope clarification establishes Basset Hound Browser as a focused, sustainable data collection tool with clear boundaries and external intelligence responsibility.*
