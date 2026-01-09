# Basset Hound Browser - Product Roadmap

**Last Updated:** January 9, 2026
**Current Version:** 10.0.0
**Status:** Active Development - Scope Refactored

---

## Overview

Basset Hound Browser is a **browser automation tool** designed to be controlled by external applications, AI agents, or automation scripts. It provides powerful capabilities for web interaction, data extraction, and bot detection evasion, while remaining **intelligence-agnostic**.

### Key Principle

> **The browser is a tool with capabilities, not an intelligent system.**

- The browser **captures and provides** raw data
- External agents/applications **analyze and decide** what to do with that data
- The browser does not make intelligence decisions about what data is important

### Architecture Position

```
┌─────────────────────────────────────────────────────────┐
│              AI AGENTS (palletai)                        │
│  Intelligence • Analysis • Decision-Making               │
└────────────────────┬────────────────────────────────────┘
                     │
              MCP / WebSocket API
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         BASSET HOUND BROWSER (This Tool)                │
│  Navigate • Extract • Capture • Evade • Control         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
              ┌─────────────┐
              │  Web Pages  │
              └─────────────┘
```

---

## Quick Reference

### Historical Context

**Phases 1-11** are archived in [ROADMAP-ARCHIVE-V1.md](ROADMAP-ARCHIVE-V1.md) and include:
- Phase 1-9: Core browser automation, proxy/Tor, WebSocket API, evasion
- Phase 10-11: Distribution and embedded Tor

### Scope Boundaries

See [SCOPE.md](SCOPE.md) for detailed architectural boundaries:
- **IN SCOPE:** Browser automation, data extraction, forensic capture, evasion, network control
- **OUT OF SCOPE:** Intelligence analysis, investigation management, data processing, external integrations

---

## Current Active Development

### Phase 14: Forensic Image Capabilities

**Status:** ✅ COMPLETED
**Goal:** Extract forensic metadata and text from images for evidence collection.

#### 14.1 Image Forensic Extraction

| Feature | Status | Description |
|---------|--------|-------------|
| EXIF metadata | ✅ Done | Camera, GPS, date, settings via `exifr` library |
| IPTC metadata | ✅ Done | Caption, keywords, copyright via `exifreader` |
| XMP metadata | ✅ Done | Adobe metadata via `exifreader` |
| GPS extraction | ✅ Done | Extract GPS coordinates from EXIF |
| Dimensions/format | ✅ Done | Width, height, file type via `sharp`/`jimp` |

#### 14.2 Image Analysis

| Feature | Status | Description |
|---------|--------|-------------|
| OCR (text extraction) | ✅ Done | Extract text via `tesseract.js` |
| Image hashing | ✅ Done | Perceptual hash (pHash) for similarity detection |
| Image comparison | ✅ Done | Compare images using perceptual hashing |

#### 14.3 Advanced Extraction (Jan 9, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| Canvas element capture | ✅ Done | Capture canvas as base64 PNG/JPEG with metadata |
| SVG extraction (inline) | ✅ Done | Extract inline SVG elements with structure |
| SVG extraction (external) | ✅ Done | Extract external SVG file references |
| Favicon extraction | ✅ Done | All favicon variations (16x16, 32x32, etc.) |
| Open Graph images | ✅ Done | Extract og:image with dimensions |
| Twitter Card images | ✅ Done | Extract twitter:image with metadata |
| Apple touch icons | ✅ Done | Extract apple-touch-icon variations |

#### 14.4 WebSocket Commands

Available commands:
- `extract_image_metadata` - Full metadata extraction from image
- `extract_image_gps` - GPS coordinates from image
- `extract_image_text` - OCR text extraction
- `generate_image_hash` - Perceptual hash generation
- `compare_images` - Image similarity comparison
- `extract_page_images` - Extract all images from page with metadata
- `configure_image_extractor` - Configure extractor options
- `get_image_extractor_stats` - Get extractor statistics
- `cleanup_image_extractor` - Clean up resources
- `capture_canvas_elements` - Capture canvas elements as images
- `extract_svg_elements` - Extract inline and external SVG
- `extract_favicon_og_images` - Extract favicons and OG images

**Implementation:**
- `extraction/image-metadata-extractor.js` - Core extraction engine
- `websocket/commands/image-commands.js` - WebSocket API (12 commands)
- `tests/unit/image-metadata-extractor.test.js` - Unit tests (60+ test cases)
- `docs/findings/PHASE-14-ENHANCEMENTS-2026-01-09.md` - Enhancement documentation

---

### Phase 15: MCP Server for AI Agents

**Status:** 🔄 REFACTORING
**Goal:** Expose browser control capabilities via Model Context Protocol (MCP) for AI agents.

#### 15.1 Core Browser Control Tools

| Tool | Status | Description |
|------|--------|-------------|
| `browser_navigate` | ✅ Done | Navigate to URL with wait options |
| `browser_click` | ✅ Done | Click element with human-like behavior |
| `browser_fill` | ✅ Done | Fill form field with typing simulation |
| `browser_screenshot` | ✅ Done | Capture page screenshot |
| `browser_get_page_state` | ✅ Done | Get comprehensive page state |
| `browser_extract_content` | ✅ Done | Extract content (text, HTML, links, images) |
| `browser_execute_script` | ✅ Done | Execute custom JavaScript |

#### 15.2 Advanced Control Tools

| Category | Tools | Count |
|----------|-------|-------|
| Navigation | navigate, back, forward, refresh, get_url, get_title | 6 |
| Interaction | click, fill, type, press_key, hover, scroll, select, clear | 8 |
| Content | get_content, get_html, get_page_state, extract_links, extract_forms, extract_images, extract_metadata | 7 |
| Screenshots | screenshot, screenshot_element, screenshot_full_page | 3 |
| Profile | switch_profile, create_profile, list_profiles, delete_profile | 4 |
| Proxy/Tor | set_proxy, clear_proxy, tor_start, tor_stop, tor_new_identity, tor_get_circuit | 6 |
| Advanced | execute_script, wait_for_element, wait_for_navigation, get_cookies, set_cookies | 5 |

#### 15.3 Tools to Remove (OUT OF SCOPE)

The following tools need to be removed as they perform intelligence analysis:
- ❌ `browser_detect_data_types` - Pattern detection (OUT OF SCOPE)
- ❌ `browser_configure_ingestion` - Data processing decisions (OUT OF SCOPE)
- ❌ `browser_ingest_selected` - Intelligence workflow (OUT OF SCOPE)
- ❌ `browser_ingest_all` - Intelligence workflow (OUT OF SCOPE)
- ❌ `browser_fill_form_with_entity` - External system integration (OUT OF SCOPE)
- ❌ `browser_fill_form_with_sock_puppet` - External system integration (OUT OF SCOPE)

**Refactoring Status:**
- Keep: ~40 browser control tools
- Remove: ~6 intelligence/integration tools
- Target: Pure browser automation API

#### 15.4 Configuration

**For AI Agents (Claude Desktop, palletAI):**
```json
{
  "mcpServers": {
    "basset-hound-browser": {
      "command": "python",
      "args": ["-m", "basset_hound_browser.mcp.server"],
      "env": {
        "BASSET_WS_URL": "ws://localhost:8765"
      }
    }
  }
}
```

**Implementation:**
- `mcp/server.py` - FastMCP server (to be refactored)
- `mcp/requirements.txt` - Dependencies (fastmcp, websockets, aiohttp)
- `tests/unit/mcp-server.test.js` - Unit tests

---

### Phase 17: Bot Detection Evasion

**Status:** ✅ COMPLETED
**Goal:** Advanced evasion techniques for sophisticated bot detection systems.

#### 17.1 Fingerprint Profile System

| Feature | Status | Description |
|---------|--------|-------------|
| FingerprintProfile class | ✅ Done | Platform-consistent fingerprint generation |
| FingerprintProfileManager | ✅ Done | Profile storage and management |
| Platform-specific configs | ✅ Done | Windows, macOS, Linux configurations |
| WebGL vendor/renderer matching | ✅ Done | Consistent GPU fingerprints |
| Screen/timezone/locale matching | ✅ Done | Region-appropriate settings |
| Chrome version management | ✅ Done | Realistic UA versions |
| Injection script generation | ✅ Done | Complete fingerprint override script |

#### 17.2 Behavioral AI

| Feature | Status | Description |
|---------|--------|-------------|
| BehavioralProfile class | ✅ Done | Session-consistent behavioral characteristics |
| MouseMovementAI | ✅ Done | Fitts's Law + minimum-jerk trajectory |
| Physiological tremor | ✅ Done | 8-12 Hz tremor simulation |
| Micro-corrections | ✅ Done | Near-target correction patterns |
| Overshoot behavior | ✅ Done | Realistic overshoot and correction |
| TypingAI | ✅ Done | Biometric typing patterns |
| Hand alternation speedup | ✅ Done | Faster for hand switches |
| Common digraph detection | ✅ Done | 30 common letter pairs |
| Typing errors/corrections | ✅ Done | Natural typo simulation |
| Fatigue simulation | ✅ Done | Session-based slowdown |

#### 17.3 Detection Avoidance

| Feature | Status | Description |
|---------|--------|-------------|
| HoneypotDetector class | ✅ Done | 8+ honeypot indicators |
| Hidden field detection | ✅ Done | display:none, visibility:hidden, etc. |
| Suspicious name detection | ✅ Done | honeypot, trap, confirm_email, etc. |
| Zero-dimension detection | ✅ Done | 0x0 and 1x1 pixel fields |
| Off-screen detection | ✅ Done | Position < -1000px |
| RateLimitAdapter class | ✅ Done | Adaptive rate limiting |
| Exponential backoff | ✅ Done | Configurable with jitter |
| Retry-After support | ✅ Done | Respects HTTP header |

#### 17.4 TLS/JA3 Fingerprinting

| Feature | Status | Description |
|---------|--------|-------------|
| JA3 fingerprint research | ✅ Done | Research completed - proxy approach recommended |
| JA4 fingerprint support | 📋 Deferred | Requires proxy-based TLS interception |

**Note:** TLS fingerprinting requires proxy-based approach since Electron's TLS stack is distinctive. Recommend using TLS proxy (e.g., `curl_cffi`, `tls-client`) for JA3 spoofing.

#### 17.5 WebSocket Commands (24 commands)

Available commands:
- `create_fingerprint_profile`, `create_regional_fingerprint`, `get_fingerprint_profile`, `list_fingerprint_profiles`
- `set_active_fingerprint`, `get_active_fingerprint`, `apply_fingerprint`, `delete_fingerprint_profile`
- `get_fingerprint_options`, `create_behavioral_profile`, `generate_mouse_path`, `generate_scroll_behavior`
- `generate_typing_events`, `get_behavioral_profile`, `list_behavioral_sessions`, `check_honeypot`
- `filter_honeypots`, `get_rate_limit_state`, `record_request_success`, `record_rate_limit`
- `is_rate_limited`, `reset_rate_limit`, `list_rate_limit_adapters`

**Implementation:**
- `evasion/fingerprint-profile.js` - Profile-based fingerprint system (700+ lines)
- `evasion/behavioral-ai.js` - Physics-based behavior simulation (800+ lines)
- `websocket/commands/evasion-commands.js` - WebSocket API (24 commands)
- `tests/unit/fingerprint-profile.test.js` - Fingerprint tests (200+ test cases)
- `tests/unit/behavioral-ai.test.js` - Behavioral tests (150+ test cases)

---

### Phase 18: Evidence Collection

**Status:** 🔄 REFACTORING
**Goal:** Streamlined forensic evidence capture with chain of custody.

#### 18.1 Evidence Capture (Keep)

| Feature | Status | Description |
|---------|--------|-------------|
| Screenshot capture | ✅ Done | captureScreenshot() with SHA-256 hash |
| Page archiving | ✅ Done | capturePageArchive() - MHTML/HTML/WARC/PDF |
| Network HAR capture | ✅ Done | captureNetworkHAR() with entry count |
| DOM snapshot | ✅ Done | captureDOMSnapshot() |
| Console logs | ✅ Done | captureConsoleLogs() |
| Cookie capture | ✅ Done | captureCookies() |
| Local storage capture | ✅ Done | captureLocalStorage() |

#### 18.2 Chain of Custody (Keep)

| Feature | Status | Description |
|---------|--------|-------------|
| SHA-256 hash generation | ✅ Done | Every evidence item hashed |
| Timestamp every action | ✅ Done | capturedAt timestamp |
| User/agent identification | ✅ Done | capturedBy field |

#### 18.3 Package Management (Simplify)

**Current Complexity (OUT OF SCOPE):**
- ❌ Investigation IDs and case numbers - Belongs in external system
- ❌ Package sealing and court exports - Belongs in investigation management
- ❌ Evidence packages with investigations - Belongs in evidence manager

**Simplified Scope (IN SCOPE):**
- ✅ Individual evidence capture with hash
- ✅ Timestamp and custody metadata
- ✅ Simple bundle capture (multiple items at once)

**Refactoring Status:**
- Keep: Core capture functions with hashing
- Remove: Investigation package management
- Simplify: Return raw evidence items with metadata

#### 18.4 WebSocket Commands (Simplified)

Commands to keep:
- `capture_screenshot_evidence` - Capture screenshot with hash
- `capture_page_archive_evidence` - Capture archive with hash
- `capture_har_evidence` - Capture HAR with hash
- `capture_dom_evidence` - Capture DOM with hash
- `capture_console_evidence` - Capture console logs
- `capture_cookies_evidence` - Capture cookies
- `capture_storage_evidence` - Capture localStorage

Commands to remove (investigation management):
- ❌ `create_evidence_package`, `seal_evidence_package`, `export_for_court`
- ❌ `get_evidence_package`, `list_evidence_packages`, `set_active_evidence_package`

**Implementation:**
- `evidence/evidence-collector.js` - Simplified capture API (to be refactored)
- `websocket/commands/evidence-commands.js` - WebSocket API (to be simplified)

---

## Future Roadmap

### Version 9.0.0 - Scope Compliance

**Target:** Q1 2026

#### Goals
1. Remove out-of-scope features from MCP server
2. Simplify evidence collection to capture-only
3. Update documentation to reflect scope boundaries
4. Clean up WebSocket API commands

#### Breaking Changes
- Remove OSINT/intelligence tools from MCP server
- Remove investigation package management
- Remove external system integrations (sock puppets, basset-hound API)

---

### Version 10.0.0 - Enhanced Forensics

**Status:** PARTIALLY COMPLETED

#### Completed Features (Jan 9, 2026)

**Image Forensics:**
- ✅ Canvas element capture
- ✅ SVG extraction (inline and external)
- ✅ Favicon and Open Graph image extraction

#### Remaining Features

**Image Forensics:**
- Advanced EXIF parsing (maker notes, thumbnails)

**Network Forensics:**
- WebSocket message capture
- WebRTC connection logging
- DNS query capture
- Certificate chain extraction

**Browser Forensics:**
- IndexedDB capture
- Service Worker state capture
- Cache API extraction
- WebAssembly module capture

---

### Version 11.0.0 - Advanced Evasion

**Target:** Q3 2026

#### Planned Features

**CAPTCHA Handling:**
- 2Captcha integration
- Anti-Captcha integration
- CAPTCHA detection and notification

**Advanced Evasion:**
- Canvas randomization improvements
- WebGL noise injection
- Audio fingerprint randomization
- Font fingerprint evasion

**Rate Limiting:**
- Per-domain rate limiting
- Automatic backoff strategies
- Request queue management

---

## Success Metrics

### Technical Metrics
- **API Stability:** WebSocket command compatibility across versions
- **Test Coverage:** >80% unit test coverage for core modules
- **Performance:** <100ms overhead for evasion techniques
- **Evasion Success:** Pass bot detection on major platforms

### Architectural Metrics
- **Separation of Concerns:** 0 intelligence decisions in browser code
- **API Clarity:** All commands express actions, not goals
- **Statelessness:** 0 investigation state maintained in browser
- **Raw Data:** 100% of extractions return unprocessed data

### Integration Metrics
- **MCP Compatibility:** Compatible with Claude Desktop, palletai
- **WebSocket Stability:** <1% connection failure rate
- **Agent Integration:** >5 agent types using browser via MCP

---

## Version History

### Recent Releases

**v10.0.0** (Current - Major Breaking Release)
- Scope refactored: Pure browser automation focus
- WebSocket API with 65 commands (OSINT tools removed)
- MCP server with 61 tools (intelligence tools removed)
- Bot detection evasion (fingerprints, behavioral AI)
- Tor/proxy integration
- Image forensics (EXIF, OCR, hashing)
- Simplified evidence collection

**v8.2.4** (Previous)
- WebSocket API with 98+ commands (including OSINT)
- Bot detection evasion (fingerprints, behavioral AI)
- Tor/proxy integration
- Image metadata extraction
- MCP server for AI agents (88 tools)

**v7.x**
- Advanced orchestration
- Enhanced data extraction
- Tor integration

**v6.x**
- Security and stability improvements
- Enhanced data extraction API

**v5.x**
- Advanced features (recording, technology detection)
- Testing and validation

**v1.x - v4.x**
- Core foundation
- Basic automation capabilities
- WebSocket API development

See [ROADMAP-ARCHIVE-V1.md](ROADMAP-ARCHIVE-V1.md) for detailed history of Phases 1-11.

---

## Architectural Principles

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
- **Browser:** Technical capabilities (this tool)
- **Agent:** Intelligence decisions (palletai)
- **Storage:** Entity management (basset-hound)

### 5. Tool, Not Platform
- Browser is a tool in a larger system
- It doesn't know about investigations, cases, or missions
- It just does what it's told and reports back

---

## Related Projects

- **basset-hound:** Entity storage and graph database for OSINT
- **palletai:** AI agent framework for multi-agent OSINT automation
- **autofill-extension:** Lightweight Chrome extension for quick OSINT tasks

---

## Development Status

### Active Work
- Phase 15: MCP server refactoring (removing OSINT tools)
- Phase 18: Evidence collection simplification

### Completed
- Phase 14: Image forensics (COMPLETED Jan 9, 2026)
- Phase 17: Bot detection evasion
- Phases 1-11: Core browser automation (see archive)

### Documentation
- **SCOPE.md:** Architectural boundaries and scope definition
- **ROADMAP-ARCHIVE-V1.md:** Historical phases 1-11
- **ROADMAP.md:** Current roadmap (this document)

---

*Last updated: January 9, 2026*
*Version: 10.0.0*
*Status: Active Development - Browser Automation Tool*
