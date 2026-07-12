# Basset Hound Browser - Documentation Versioning Guide

**Last Updated**: June 21, 2026  
**Current Version**: 12.8.0

---

## Current Documentation (v12.8.0)

### Primary References (Use These)

1. **[README.md](../README.md)** - Main project overview and quick start
2. **[API-REFERENCE-V12.8.0.md](../../archive/deprecated/API-REFERENCE-V12.8.0.md)** - Comprehensive v12.8.0 API with all 140+ commands
3. **[API-REFERENCE-AUTHORITATIVE.md](../../API-REFERENCE-AUTHORITATIVE.md)** - Authoritative command reference (12.8.0)
4. **[RELEASE-NOTES-v12.1.0.md](../../releases/RELEASE-NOTES-v12.1.0.md)** - Latest production release notes

### Feature Documentation (Current)

- [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) - Deployment for dev/production/headless
- [TROUBLESHOOTING.md](../../support/TROUBLESHOOTING.md) - Common issues and solutions
- [DEVELOPMENT.md](../../core/development.md) - Development setup and guidelines
- [ROADMAP.md](../../roadmap/ROADMAP.md) - Project roadmap and planned features

---

## Phase 1 Forensic Commands (v12.8.0 - NEW)

### New Command Categories

#### 1. HTML Capture (17 commands)
- `capture_html` - Complete page HTML with metadata
- `capture_html_clean` - HTML with scripts/styles removed
- `capture_html_with_styles` - HTML preserving styles
- `capture_html_with_compression` - Compressed HTML
- And 13 more variants

#### 2. DOM Snapshots (7 new WebSocket commands)
- `capture_dom_snapshot` - Full DOM with state
- `capture_dom_tree` - DOM tree structure only
- `get_dom_diff` - Changes since last snapshot
- And 4 more variants

#### 3. JavaScript & Console Extraction (10 commands)
- `extract_javascript_context` - All JS state and variables
- `get_console_logs` - Console output history
- `get_console_errors` - Error logs only
- `get_performance_metrics` - Page performance
- And 6 more variants

#### 4. Export Formats & Templates (18 commands)
- `export_as_json` - JSON format
- `export_as_csv` - CSV format
- `export_as_har` - HAR (HTTP Archive) format
- `export_as_html` - Self-contained HTML
- `export_as_markdown` - Markdown format
- `create_export_template` - Custom templates
- `list_export_templates` - List all templates
- `export_with_template` - Use template
- And 10 more variants

#### 5. Batch Operations (8 commands)
- `batch_extract_urls` - Process multiple URLs
- `batch_status` - Get operation status
- `batch_cancel` - Cancel operation
- `batch_results` - Retrieve results
- And 4 more variants

#### 6. Correlation & Analysis (5 commands)
- `correlate_evidence` - Cross-evidence correlation
- `detect_patterns` - Pattern detection
- `detect_anomalies` - Anomaly detection
- `analyze_timeline` - Timeline analysis
- `build_correlation_graph` - Correlation graph

### Total: 50 Phase 1 Commands

---

## Historical Documentation (Archived - Reference Only)

### Why These Are Archived

Documents below reference older versions (v12.0-v12.7) and are provided for historical context only. **Do not use for current development.**

### Legacy v12.1.0 Documentation (May 31, 2026)

**Status**: ✓ Production Release - Archived for reference  
**File**: [API-REFERENCE.md](API-REFERENCE.md) (OUTDATED - see v12.8.0 version instead)

#### Wave 12 Features (Implemented in v12.1.0, still in v12.8.0):
- Technology Detection Module (200+ technologies)
- Forensic Evidence Export
- Platform Integrations (Splunk, ELK, SIEM)
- Session Recording Streaming
- Priority Queue System
- Parallel Screenshot Processing

### v12.0.0 Documentation (May 11, 2026)

**Status**: ✓ Production Release - Archived for reference  
**Files**:
- [RELEASE-NOTES-v12.0.0.md](../../releases/RELEASE-NOTES-v12.0.0.md)
- [DEPLOYMENT-COMPLETE-2026-05-11.md](../../archives/deployment-reports/DEPLOYMENT-COMPLETE-2026-05-11.md)
- [docs/archives/session_records/2026-05-11_V12.0.0-PRODUCTION-DEPLOYMENT-COMPLETE.md](../../archives/session_records/2026-05-11_V12.0.0-PRODUCTION-DEPLOYMENT-COMPLETE.md)

#### Features (Still in v12.8.0):
- Phase 3 Authentication
- Session Persistence
- Device Fingerprinting (61 tests)
- Bot Evasion Framework (85-90% effectiveness)
- WebSocket Optimization
- Multi-Agent Orchestration

### v11.2.0 & Earlier (Phase 2 Evasion)

**Status**: ✓ Research Phase Complete - Archived for reference  
**Files**:
- [docs/PHASE-2-COMPLETION-SUMMARY-2026-05-07.md](../../planning/PHASE-2-COMPLETION-SUMMARY-2026-05-07.md)
- [docs/archives/roadmap_v1_2026-06-13.md](../../archives/roadmap_v1_2026-06-13.md)

---

## Documentation Organization by Topic

### Getting Started
- [README.md](../README.md) - **CURRENT** - Start here
- [QUICKSTART.md](../../deployment/QUICKSTART-V12.1.0-2026-05-31.md) - **CURRENT** - v12.1.0 quick start

### API Reference
- [API-REFERENCE-V12.8.0.md](../../archive/deprecated/API-REFERENCE-V12.8.0.md) - **CURRENT** - v12.8.0 complete reference
- [API-REFERENCE-AUTHORITATIVE.md](../../API-REFERENCE-AUTHORITATIVE.md) - **CURRENT** - Command index
- [API-REFERENCE.md](API-REFERENCE.md) - **OUTDATED** - v12.1.0 reference (for history only)

### Deployment & Operations
- [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) - **CURRENT** - Deployment instructions
- [TROUBLESHOOTING.md](../../support/TROUBLESHOOTING.md) - **CURRENT** - Common issues
- [deployment/TOR-SETUP-GUIDE.md](../../archives/prune-2026-07-06/deployment/TOR-SETUP-GUIDE.md) - **CURRENT** - Tor setup

### Development
- [DEVELOPMENT.md](../../core/development.md) - **CURRENT** - Dev setup
- [ARCHITECTURE.md](ARCHITECTURE.md) - **CURRENT** - Architecture overview
- [ROADMAP.md](../../roadmap/ROADMAP.md) - **CURRENT** - Project roadmap

### Feature Guides
- [TECHNOLOGY-DETECTION-GUIDE-2026-05-31.md](TECHNOLOGY-DETECTION-GUIDE-2026-05-31.md) - Tech detection
- [FORENSIC-EVIDENCE-EXPORT-GUIDE-2026-05-31.md](FORENSIC-EVIDENCE-EXPORT-GUIDE-2026-05-31.md) - Evidence export
- [PLATFORM-INTEGRATIONS-QUICK-START.md](PLATFORM-INTEGRATIONS-QUICK-START.md) - Splunk/ELK/SIEM

### Historical Reference (Read Only)
- [docs/archives/](archives/) - All archived documentation
- [docs/research/](research/) - Research documents
- [Phase 2 Completion](../../planning/PHASE-2-COMPLETION-SUMMARY-2026-05-07.md) - Phase 2 evasion research
- [Session Records](archives/session_records/) - Development session records

---

## Version Numbering

### Current Stable Release
- **v12.8.0** (June 21, 2026) - Phase 1 Forensic Commands Complete
  - 50 new forensic commands
  - 140+ total commands
  - All Phase 1 feature areas complete
  - Ready for Phase 2 planning

### Previous Stable Releases
- **v12.7.0** (June 16, 2026) - Real-world validation, production approved
- **v12.1.0** (May 31, 2026) - Wave 12 features, production deployment
- **v12.0.0** (May 11, 2026) - Initial production release

---

## What Changed in v12.8.0

### New Features
1. **50 Phase 1 Forensic Commands**
   - HTML capture with metadata
   - DOM snapshots with state
   - JavaScript context extraction
   - Export in 5+ formats (JSON, CSV, HAR, HTML, Markdown)
   - Batch URL processing
   - Evidence correlation and analysis

### Updated Documentation
1. **README.md** - Updated version to v12.8.0, added forensics focus
2. **API-REFERENCE-V12.8.0.md** - New comprehensive v12.8.0 API reference
3. **API-REFERENCE-AUTHORITATIVE.md** - Updated to v12.8.0
4. **This document** - Versioning guide created

### Still Valid from Previous Versions
1. Core navigation and interaction commands (v12.0.0+)
2. Bot evasion and fingerprinting (v11.2.0+)
3. Proxy and user agent rotation (v12.0.0+)
4. Session and profile management (v12.0.0+)
5. DevTools and console access (v12.0.0+)
6. Cookie, storage, and tab management (v12.0.0+)

---

## Documentation Maintenance Policy

### Current Documentation
- Updated on each release
- Includes all v12.8.0+ features
- Reflects actual command implementations

### Archived Documentation
- Preserved in `/docs/archives/`
- Read-only - for historical reference only
- Used for understanding project evolution

### How to Report Documentation Issues
1. Check if issue is in current v12.8.0 documentation
2. Check README.md for latest version number
3. If docs don't match implementation, file issue with:
   - Version number of docs
   - Version number of code
   - What's missing or incorrect

---

## Quick Navigation

**I need to...**

| Task | Document |
|------|----------|
| Get started with Basset Hound | [README.md](../README.md) |
| Learn all commands (v12.8.0) | [API-REFERENCE-V12.8.0.md](../../archive/deprecated/API-REFERENCE-V12.8.0.md) |
| Deploy the browser | [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) |
| Troubleshoot issues | [TROUBLESHOOTING.md](../../support/TROUBLESHOOTING.md) |
| Set up development | [DEVELOPMENT.md](../../core/development.md) |
| Understand architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |
| See what's planned | [ROADMAP.md](../../roadmap/ROADMAP.md) |
| Find a specific command | [API-REFERENCE-AUTHORITATIVE.md](../../API-REFERENCE-AUTHORITATIVE.md) |
| Learn about v12.8.0 forensics | [API-REFERENCE-V12.8.0.md](../../archive/deprecated/API-REFERENCE-V12.8.0.md#phase-1-forensic-commands-new) |

