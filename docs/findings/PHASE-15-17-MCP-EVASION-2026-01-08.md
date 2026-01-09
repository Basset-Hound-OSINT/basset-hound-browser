# Phase 15-17 Implementation Research & Findings

**Date:** January 8, 2026
**Author:** Claude Code
**Phases:**
- Phase 15: MCP Server for AI Agent Integration
- Phase 17: Enhanced Bot Detection Evasion (Research)

---

## Executive Summary

This document captures research findings and implementation details for Phase 15 (MCP Server) and Phase 17 (Enhanced Bot Detection Evasion) of basset-hound-browser. Phase 15 has been implemented with a complete MCP server using FastMCP. Phase 17 research provides comprehensive guidance for future implementation.

---

## Phase 15: MCP Server Implementation

### Overview

Phase 15 implements a Model Context Protocol (MCP) server that exposes basset-hound-browser's 434+ WebSocket commands as MCP tools for AI agents like palletAI.

### What is MCP?

The Model Context Protocol is an open standard (version 2025-11-25) for connecting AI applications to external systems. It works like a "USB-C port for AI applications" - providing a standardized way to connect AI applications to tools, data sources, and workflows.

**Protocol Architecture:**
- **MCP Host**: AI application (e.g., Claude Desktop, palletAI)
- **MCP Client**: Component maintaining connections to MCP servers
- **MCP Server**: Program exposing tools, resources, and prompts

**Key Features:**
- JSON-RPC 2.0 based protocol
- stdio and HTTP transport options
- Automatic tool schema generation from type hints
- Support for text, image, and resource content types

### Implementation Details

#### Files Created

| File | Description |
|------|-------------|
| `mcp/server.py` | FastMCP server with 40+ tools |
| `mcp/requirements.txt` | Python dependencies |
| `mcp/__init__.py` | Module exports |
| `tests/unit/mcp-server.test.js` | Unit tests (400+ lines) |

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI AGENT (palletAI)                      │
│                        Uses MCP Protocol                         │
└─────────────────────────────────────────────────────────────────┘
                               │
                    MCP Protocol (stdio or HTTP)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MCP SERVER (Python)                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      FastMCP Server                          ││
│  │                                                               ││
│  │  @mcp.tool() browser_navigate()  ───┐                        ││
│  │  @mcp.tool() browser_click()     ───┤                        ││
│  │  @mcp.tool() browser_fill()      ───┤                        ││
│  │  @mcp.tool() browser_screenshot()───┘                        ││
│  │                                    │                          ││
│  │                    ┌───────────────┘                          ││
│  │                    ▼                                          ││
│  │           ┌───────────────────┐                               ││
│  │           │  WebSocket Client │                               ││
│  │           │  (connects to     │                               ││
│  │           │   port 8765)      │                               ││
│  │           └───────────────────┘                               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                               │
                    WebSocket (ws://localhost:8765)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BASSET HOUND BROWSER                           │
│                    (Electron App)                                │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                   WebSocket Server                           ││
│  │                   (434+ commands)                            ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### MCP Tools Implemented

**Core Navigation (6 tools):**
- `browser_navigate` - Navigate to URL with wait options
- `browser_back` - Navigate back in history
- `browser_forward` - Navigate forward in history
- `browser_refresh` - Refresh current page
- `browser_get_url` - Get current URL
- `browser_get_title` - Get page title

**Interaction (8 tools):**
- `browser_click` - Click element with human-like behavior
- `browser_fill` - Fill form field with typing simulation
- `browser_type` - Type text in focused element
- `browser_press_key` - Press keyboard key
- `browser_hover` - Hover over element
- `browser_scroll` - Scroll page
- `browser_select` - Select dropdown option
- `browser_clear` - Clear input field

**Content Extraction (8 tools):**
- `browser_get_content` - Get text content
- `browser_get_html` - Get HTML content
- `browser_get_page_state` - Comprehensive page state
- `browser_extract_links` - Extract all links
- `browser_extract_forms` - Extract form information
- `browser_extract_images` - Extract image URLs
- `browser_extract_metadata` - Extract meta tags
- `browser_detect_technologies` - Detect tech stack

**Screenshots (3 tools):**
- `browser_screenshot` - Capture screenshot
- `browser_screenshot_element` - Capture specific element
- `browser_screenshot_full_page` - Full page screenshot

**OSINT/Ingestion (6 tools):**
- `browser_detect_data_types` - Detect emails, phones, crypto
- `browser_configure_ingestion` - Configure ingestion mode
- `browser_ingest_selected` - Ingest specific items
- `browser_ingest_all` - Ingest all detected items
- `browser_extract_image_metadata` - EXIF/IPTC/XMP extraction
- `browser_extract_image_text` - OCR text extraction

**Profile/Identity (4 tools):**
- `browser_switch_profile` - Switch browser profile
- `browser_create_profile` - Create new profile
- `browser_list_profiles` - List available profiles
- `browser_delete_profile` - Delete profile

**Proxy/Tor (6 tools):**
- `browser_set_proxy` - Configure proxy
- `browser_clear_proxy` - Remove proxy
- `browser_tor_start` - Start Tor
- `browser_tor_stop` - Stop Tor
- `browser_tor_new_identity` - New Tor circuit
- `browser_tor_get_circuit` - Get circuit info

**Advanced (5 tools):**
- `browser_execute_script` - Execute JavaScript
- `browser_wait_for_element` - Wait for selector
- `browser_wait_for_navigation` - Wait for page load
- `browser_get_cookies` - Get cookies
- `browser_set_cookies` - Set cookies

#### MCP Resources

| Resource URI | Description |
|--------------|-------------|
| `browser://status` | Browser connection status |
| `browser://current-page` | Current page URL and title |

#### Tool Naming Conventions

All tools follow consistent naming:
- **Prefix**: `browser_` for all browser tools
- **Case**: snake_case (e.g., `browser_get_page_state`)
- **Length**: 1-128 characters

### Configuration

**For Claude Desktop / AI Agents:**

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

### Testing

Unit tests verify:
- WebSocket command compatibility
- MCP tool schema compliance
- Tool naming conventions
- Resource URI formats

---

## Phase 17: Bot Detection Evasion Research

### Overview

Modern bot detection in 2025-2026 employs multi-layered approaches:

1. **Network-layer fingerprinting** (TLS/JA3/JA4)
2. **Behavioral machine learning** (mouse, keyboard, scroll patterns)
3. **Browser fingerprinting** (canvas, WebGL, audio)
4. **Environmental analysis** (headless detection, automation traces)

### Current Implementation Gaps

The existing `evasion/fingerprint.js` and `evasion/humanize.js` cover browser fingerprinting and basic human simulation but lack:

| Gap | Current State | Needed |
|-----|---------------|--------|
| TLS fingerprinting | None | JA3/JA4 spoofing |
| Behavioral AI | Basic Bezier | Physics-based models |
| CAPTCHA handling | None | Service integration |
| Honeypot detection | None | Hidden field avoidance |
| Rate limit adaptation | None | Adaptive throttling |
| Fingerprint consistency | Random per session | Profile-based consistency |

### TLS/JA3/JA4 Fingerprint Spoofing

#### The Problem

Electron uses Chromium's BoringSSL which produces a distinctive TLS fingerprint. This JA3 hash is consistent across all Electron apps and differs from standard Chrome, making detection trivial.

#### Recommended Solution: TLS-Modifying Proxy

Route traffic through a proxy that rewrites TLS fingerprints:

```
basset-hound-browser (Electron)
         │
         │ HTTP(S) via CONNECT
         ▼
TLS Fingerprint Proxy (Go/CycleTLS/utls)
         │
         │ Spoofed TLS matching Chrome/Firefox
         ▼
Target Website (sees real browser TLS)
```

**Recommended Libraries:**
- **CycleTLS** (Go): Can specify exact JA3 strings
- **utls** (Go): Can mimic Chrome, Firefox, Safari, iOS, Android profiles
- **curl-impersonate**: Command-line tool for browser TLS mimicry

**Critical Rule:** JA3 must match User-Agent. If claiming Chrome UA, must use Chrome JA3.

### Behavioral AI Enhancements

#### Mouse Movement: Physics-Based Model

Replace simple Bezier curves with physics-based approach using:

1. **Fitts's Law**: `Movement time = a + b * log2(2D/W)`
2. **Minimum-jerk trajectory**: Smooth curves minimizing jerk
3. **Physiological tremor**: 8-12 Hz micro-oscillations
4. **Micro-corrections**: Visual feedback loop simulation
5. **Occasional overshoot**: 15-20% probability

#### Typing Patterns: Biometric Model

1. **Inter-key intervals (IKI)**: Vary by hand alternation, finger, digraph frequency
2. **Key hold duration**: Vary by character type, position
3. **Cognitive pauses**: Before sentences, numbers, unfamiliar content
4. **Slip errors**: Type nearby key then correct (realistic errors)

#### Session-Level Consistency

Create behavioral profiles seeded per session:
- Consistent mouse speed multiplier (0.8-1.2)
- Consistent typing WPM (40-80 range)
- Consistent error rate (1-5%)
- Consistent reaction time baseline (200-400ms)
- Fatigue simulation (gradual slowdown)

### Modern Bot Detection Systems

| Service | Detection Method | Bypass Strategy |
|---------|------------------|-----------------|
| **Cloudflare** | TLS/JA3, JS challenge, ML behavior | Match TLS, pass challenge, human behavior |
| **PerimeterX** | Sensor telemetry, device motion | Spoof DeviceMotionEvent, battery |
| **GeeTest** | Mouse trajectory ML | Physics-based model, micro-corrections |
| **DataDome** | Real-time behavioral, IP intelligence | Residential proxies, high-entropy fingerprints |
| **Akamai** | Header order, sensor collection | Consistent headers, pass challenges |

### Detection Avoidance Techniques

#### Honeypot Detection

Detect hidden form fields by checking:
- `display: none`, `visibility: hidden`, `opacity: 0`
- Zero height/width elements
- Off-screen positioning
- Suspicious field names (honeypot, trap, website, url, email2)

#### Rate Limit Adaptation

1. Monitor for 429/503 status codes
2. Exponential backoff (2x multiplier)
3. Respect Retry-After headers
4. Gradually reduce delay on success (0.95x)
5. Add timing jitter (avoid patterns)

#### Ban Recovery

| Severity | Response |
|----------|----------|
| Hard ban (403) | Full identity rotation + 30-90s cooldown |
| Medium ban | Proxy rotation + 10-30s delay |
| Soft ban | Triple delay + 60s pause |
| CAPTCHA | Solve and continue |

### Browser Fingerprint Consistency

#### Current Issues

The existing `fingerprint.js` generates random values per session, causing inconsistencies:
- Canvas noise value changes across pages
- WebGL vendor/renderer may not match User-Agent
- Timezone may not match geolocation

#### Profile-Based Solution

Create fingerprint profiles with internal consistency:

1. **Platform consistency**: Win64, MacIntel, or Linux with matching UA, WebGL vendors, fonts
2. **Hardware consistency**: Screen resolution, device memory, cores matching platform
3. **Graphics consistency**: WebGL vendor/renderer appropriate for claimed platform
4. **Location consistency**: Timezone matching expected region for IP

#### Validation Rules

Before using a fingerprint:
- UA must match navigator.platform
- WebGL vendor must match platform (no Apple on Windows)
- Screen resolution must be realistic for platform
- Timezone/language must be plausible together

### Implementation Recommendations

#### Priority Order

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Profile-based fingerprint consistency | Medium | High |
| 2 | TLS fingerprint proxy | High | Critical |
| 3 | Enhanced mouse movement AI | Medium | High |
| 4 | Honeypot detection | Low | Medium |
| 5 | Rate limit adaptation | Low | Medium |
| 6 | CAPTCHA service integration | Medium | Medium |
| 7 | Typing pattern AI | Medium | Medium |
| 8 | Ban recovery automation | Medium | Medium |

#### Recommended File Structure

```
evasion/
  fingerprint-profile.js     # Profile-based consistent fingerprints
  tls-fingerprint-proxy.js   # TLS spoofing proxy integration

evasion/behavioral-ai/
  mouse-model.js             # Physics-based mouse (Fitts's Law)
  typing-model.js            # Biometric typing patterns
  scroll-model.js            # Human-like scrolling
  session-profile.js         # Session-level consistency

evasion/detection/
  honeypot-detector.js       # Hidden field detection
  captcha-detector.js        # CAPTCHA detection and routing
  ban-detector.js            # Ban/block pattern detection

evasion/recovery/
  rate-adapter.js            # Adaptive rate limiting
  ban-recovery.js            # Identity rotation on ban
  captcha-solver.js          # CAPTCHA service integration
```

#### New WebSocket Commands

```javascript
// Fingerprint management
'set_fingerprint_profile'     // Load specific profile
'get_fingerprint_profile'     // Get current config
'create_fingerprint_profile'  // Generate new profile
'validate_fingerprint'        // Check consistency

// TLS configuration
'set_tls_profile'            // Set TLS fingerprint
'get_tls_profile'            // Get current TLS config

// Behavioral configuration
'set_behavior_profile'        // Set behavior characteristics
'configure_mouse_model'       // Mouse parameters
'configure_typing_model'      // Typing parameters

// Detection handling
'enable_honeypot_detection'   // Auto honeypot avoidance
'configure_rate_limiting'     // Rate limit parameters
'set_captcha_service'         // CAPTCHA service config

// Recovery
'rotate_identity'             // Full identity rotation
'new_proxy'                   // Rotate proxy
'clear_session'               // Clear session data
```

---

## Key Takeaways

### Phase 15 (Implemented)

1. MCP server wraps existing WebSocket API as bridge layer
2. 40+ MCP tools covering navigation, interaction, extraction, OSINT
3. FastMCP framework simplifies tool definition with decorators
4. stdio transport for local integration with AI agents

### Phase 17 (Research Complete)

1. **TLS fingerprinting is the biggest gap** - Electron's distinctive TLS is trivially detectable
2. **Behavioral patterns must be consistent** - Random variation is detectable
3. **Fingerprints must be internally consistent** - WebGL, screen, timezone must match platform
4. **Physics-based models beat random models** - Fitts's Law harder to distinguish from human
5. **Defense in depth** - Combine all techniques, no single evasion is sufficient

---

## Files Created/Modified

### New Files
- `mcp/server.py` - FastMCP server (700+ lines)
- `mcp/requirements.txt` - Dependencies
- `mcp/__init__.py` - Module init
- `tests/unit/mcp-server.test.js` - Unit tests (400+ lines)
- `docs/findings/PHASE-15-17-MCP-EVASION-2026-01-08.md` - This document

### To Be Created (Phase 17)
- `evasion/fingerprint-profile.js`
- `evasion/tls-fingerprint-proxy.js`
- `evasion/behavioral-ai/*.js`
- `evasion/detection/*.js`
- `evasion/recovery/*.js`

---

## References

1. [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
2. [FastMCP Documentation](https://gofastmcp.com)
3. JA3 Fingerprinting - Salesforce Research
4. Fitts's Law - Human Motor Control
5. Minimum-jerk trajectory - Human Movement Science
6. Cloudflare Bot Management documentation
7. PerimeterX detection research
8. GeeTest security advisories

---

*Last Updated: January 8, 2026*
