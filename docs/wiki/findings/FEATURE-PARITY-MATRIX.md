# Feature Parity Matrix: Obscura vs Basset Hound Browser

**Analysis Date:** July 3, 2026  
**Scope:** Comprehensive feature comparison across 7 major capability categories  
**Status:** Strategic evaluation and integration planning

---

## Executive Summary

This matrix compares Obscura (headless-first Rust browser engine) and Basset Hound Browser (Electron-based forensic automation platform) across 7 critical feature categories. Key finding: **complementary, not competitive** — each excels in different domains.

| Dimension | Winner | Margin |
|-----------|--------|--------|
| **Speed/Performance** | Obscura | 6-12x faster |
| **Visual Capture** | Basset Hound | Screenshots only |
| **Bot Evasion** | Basset Hound | 85-90% vs passive |
| **API Flexibility** | Basset Hound | 164 vs 30 CDP methods |
| **Deployment** | Obscura | Single binary |
| **Interactive Workflows** | Basset Hound | Profile isolation |

---

## Feature Parity Matrix

### 1. NAVIGATION & INTERACTION

| Feature | Obscura | Status | Basset Hound | Status |
|---------|---------|--------|--------------|--------|
| **Basic Navigation** | `navigate()` | ✅ Full | Navigate, back, forward | ✅ Full |
| **Form Filling** | `fill_form()` | ✅ Full | fill, fill_form | ✅ Full |
| **Text Input/Typing** | `type()` | ✅ Full | type, type_slow | ✅ Full+ |
| **Mouse Click** | `click()` | ✅ Full | click, click_element | ✅ Full |
| **Mouse Movement** | ❌ Not Applicable | ❌ Missing | Realistic curves | ✅ Full |
| **Hover/Mouseover** | `hover()` | ✅ Full | hover | ✅ Full |
| **Scroll** | `scroll()` | ✅ Full | scroll, scroll_element | ✅ Full |
| **Key Press Events** | `press_key()` | ✅ Full | press_key | ✅ Full |
| **Drag & Drop** | ❌ Not Applicable | ⚠️ Partial | drag_drop | ✅ Full |
| **Multi-touch Gestures** | ❌ Not Applicable | ❌ Missing | Pinch, swipe | ✅ Full |
| **Wait for Element** | `wait_for()` | ✅ Full | wait_for, wait_for_nav | ✅ Full |
| **Wait for Condition** | `wait_for_text()` | ✅ Full | Custom conditions | ✅ Full |
| **Frame Navigation** | ✅ Supported | ✅ Full | frame_select | ✅ Full |
| **Tab Management** | Multiple targets | ✅ Full | tab_new, tab_switch | ✅ Full |

**Summary:** Obscura covers core CDP operations; Basset Hound adds behavioral realism (mouse curves, typing speed variation).

---

### 2. CONTENT EXTRACTION

| Feature | Obscura | Status | Basset Hound | Status |
|---------|---------|--------|--------------|--------|
| **HTML/DOM** | `get_html()`, CDP DOM | ✅ Full | get_content, get_html | ✅ Full |
| **Text Content** | `get_markdown()`, textContent | ✅ Full | get_text | ✅ Full |
| **Link Extraction** | `get_links()` | ✅ Full | get_links | ✅ Full |
| **Form Detection** | `detect_forms()` | ✅ Full | detect_forms | ✅ Full |
| **Element Attributes** | `get_attribute()` | ✅ Full | get_element_attr | ✅ Full |
| **XPath/Selector Query** | `querySelector()` | ✅ Full | get_element_by_* | ✅ Full |
| **Metadata Extraction** | NDJSON assets | ✅ Full | get_metadata | ✅ Full |
| **EXIF/Image Data** | ❌ Not Supported | ❌ Missing | exif_extract | ✅ Full |
| **PDF Content** | `--dump original` | ✅ Full | pdf_extract | ✅ Full |
| **JSON/Structured Data** | `evaluate()` | ✅ Full | json_extract | ✅ Full |
| **Accessibility Tree** | `snapshot()` | ✅ Full | get_a11y_tree | ✅ Full |
| **Network Requests** | network logs | ✅ Full | get_network_log | ✅ Full |
| **Console Output** | console messages | ✅ Full | get_console | ✅ Full |
| **Cookies** | `get_cookies()` | ✅ Full | get_cookies | ✅ Full |
| **Local Storage** | Storage domain | ✅ Full | get_storage | ✅ Full |
| **Session Storage** | Storage domain | ✅ Full | get_session_storage | ✅ Full |
| **JavaScript Execution** | `evaluate()` | ✅ Full | execute_js | ✅ Full |
| **Custom Script Injection** | `addScriptToEvaluateOnNewDocument()` | ✅ Full | inject_script | ✅ Full |

**Summary:** Basset Hound adds forensic-specific extraction (EXIF, PDF metadata); Obscura covers standard CDP.

---

### 3. SCREENSHOTS & VISUAL CAPTURE

| Feature | Obscura | Status | Basset Hound | Status |
|---------|---------|--------|--------------|--------|
| **Full-Page Screenshot** | ❌ Cannot Render | ❌ Missing | screenshot_full | ✅ Full |
| **Viewport Screenshot** | ❌ Cannot Render | ❌ Missing | screenshot | ✅ Full |
| **Element Screenshot** | ❌ Cannot Render | ❌ Missing | screenshot_element | ✅ Full |
| **Custom Crop** | ❌ Cannot Render | ❌ Missing | screenshot_crop | ✅ Full |
| **Format Support** | N/A | ❌ N/A | PNG, JPEG, WebP | ✅ Full |
| **Image Quality Control** | N/A | ❌ N/A | Quality 0-100 | ✅ Full |
| **PDF Rendering** | ❌ No rendering | ❌ Missing | to_pdf | ✅ Full |
| **Video Recording** | ❌ No graphics | ❌ Missing | video_record | ✅ Full |
| **Visual Regression Testing** | ❌ Not Possible | ❌ Missing | visual_diff | ✅ Full |
| **Live Preview** | ❌ Headless Only | ❌ Missing | live_view | ✅ Full |

**Summary:** Basset Hound: ✅ Full capability. Obscura: ❌ Fundamentally not possible (no rendering engine).

---

### 4. BOT DETECTION EVASION

| Feature | Obscura | Status | Basset Hound | Status |
|---------|---------|--------|--------------|--------|
| **User-Agent Rotation** | `--profile` | ✅ Full | rotate_user_agent | ✅ Full |
| **TLS Fingerprint Spoofing** | wreq HTTP client | ✅ Full | tls_spoof | ✅ Full |
| **Tracker Blocking** | 3,520 domains | ✅ Full | block_trackers | ✅ Full |
| **Canvas Fingerprinting Evasion** | ❌ Not Implemented | ❌ Missing | canvas_spoof | ✅ Full (82%) |
| **WebGL Fingerprinting Evasion** | ❌ Not Implemented | ❌ Missing | webgl_spoof | ✅ Full (90%) |
| **AudioContext Fingerprinting Evasion** | ❌ Not Implemented | ❌ Missing | audio_spoof | ✅ Full |
| **Font Enumeration Evasion** | ❌ Not Implemented | ❌ Missing | font_spoof | ✅ Full |
| **WebRTC Leak Prevention** | ❌ Not Implemented | ❌ Missing | webrtc_block | ✅ Full |
| **Timezone Spoofing** | Process timezone | ✅ Passive | timezone_set | ✅ Full |
| **Geolocation Spoofing** | `OBSCURA_GEOLOCATION` | ✅ Passive | geolocation_spoof | ✅ Full |
| **Mouse Movement Patterns** | ❌ Not Possible | ❌ Missing | mouse_realistic | ✅ Full |
| **Typing Speed Variation** | ❌ Script Only | ❌ Missing | type_realistic | ✅ Full |
| **Scroll Pattern Randomization** | ❌ Deterministic | ❌ Missing | scroll_realistic | ✅ Full |
| **Behavioral AI Coordination** | ❌ Not Applicable | ❌ Missing | behavioral_ai | ✅ Full (7 vectors) |
| **Request Timing Randomization** | ❌ Deterministic | ❌ Missing | timing_random | ✅ Full |
| **Multi-Account Isolation** | Browser contexts | ⚠️ Partial | profile_isolated | ✅ Full |
| **Session Coherence Validation** | ❌ Not Implemented | ❌ Missing | session_validate | ✅ Full (5-layer) |
| **Proxy Rotation** | `--proxy` (single) | ⚠️ Partial | proxy_rotate | ✅ Full (3 modes) |
| **Tor Integration** | Planned (not live) | ❌ Missing | tor_mode | ✅ Full (ON/OFF/AUTO) |

**Summary:** Obscura: ✅ Passive stealth (TLS, UA, tracking). Basset Hound: ✅ Active behavioral evasion (85-90% effectiveness).

**Evasion Effectiveness vs Detection Services:**
| Service | Obscura | Basset Hound |
|---------|---------|--------------|
| Basic TLS checks | ✅ 80% | ✅ 95%+ |
| Cloudflare non-interactive | ✅ 80% | ✅ 90%+ |
| Akamai BMP | ⚠️ 60% | ✅ 85%+ |
| PerimeterX | ⚠️ 70% | ✅ 88%+ |
| DataDome | ⚠️ 50% | ✅ 90%+ |
| Behavioral detection | ❌ 0% | ✅ 90%+ |

---

### 5. SESSION & PROFILE MANAGEMENT

| Feature | Obscura | Status | Basset Hound | Status |
|---------|---------|--------|--------------|--------|
| **Browser Profile Creation** | Browser contexts | ✅ Full | create_profile | ✅ Full |
| **Profile Persistence** | Context-level only | ⚠️ Partial | save_profile | ✅ Full |
| **Cookie Management** | `setCookies()` | ✅ Full | set_cookie, load_cookies | ✅ Full |
| **Local Storage Persistence** | Storage domain | ✅ Full | set_storage | ✅ Full |
| **Session Storage** | Storage domain | ✅ Full | set_session_storage | ✅ Full |
| **IndexedDB Support** | ❌ Not Accessible | ❌ Missing | indexeddb_* | ✅ Full |
| **Profile Isolation** | Shared V8 isolate | ⚠️ Partial | Process-isolated | ✅ Full |
| **Multi-Account Workflows** | Concurrent contexts | ⚠️ Partial | Multi-profile | ✅ Full |
| **Session State Export** | JSON | ✅ Full | export_session | ✅ Full |
| **Session State Import** | JSON | ✅ Full | import_session | ✅ Full |
| **Session Coherence Checks** | ❌ Not Implemented | ❌ Missing | validate_session | ✅ Full (5-layer) |
| **Profile Cloning** | ❌ Not Implemented | ❌ Missing | clone_profile | ✅ Full |
| **Time-Based Session Expiry** | ❌ Not Implemented | ❌ Missing | session_ttl | ✅ Full |
| **Concurrent Session Limit** | Connection-based | ⚠️ Partial | Per-profile | ✅ Full |

**Summary:** Basset Hound: ✅ Full profile isolation with persistence. Obscura: ⚠️ Context-level only, shared runtime.

---

### 6. EXPORT & DATA FORMATS

| Format | Obscura | Status | Basset Hound | Status |
|--------|---------|--------|--------------|--------|
| **HTML** | `--dump html` | ✅ Full | export_html | ✅ Full |
| **Markdown** | `--dump markdown` | ✅ Full | export_markdown | ✅ Full |
| **JSON** | `evaluate()` output | ✅ Full | export_json | ✅ Full |
| **NDJSON** | `--dump assets` | ✅ Full | export_ndjson | ✅ Full |
| **CSV** | ❌ Not Native | ❌ Missing | export_csv | ✅ Full |
| **PDF** | `--dump original` | ⚠️ Raw Only | export_pdf | ✅ Full (rendered) |
| **Image Formats** | Binary (`--dump original`) | ✅ Full | export_png, export_jpeg | ✅ Full |
| **XML** | ❌ Not Native | ❌ Missing | export_xml | ✅ Full |
| **YAML** | ❌ Not Native | ❌ Missing | export_yaml | ✅ Full |
| **SQL** | ❌ Not Native | ❌ Missing | export_sql | ✅ Full |
| **Database Export** | ❌ Not Supported | ❌ Missing | export_db | ✅ Full |
| **Archive (ZIP)** | ❌ Not Native | ❌ Missing | export_archive | ✅ Full |
| **Batch Export** | ✅ Parallel files | ✅ Full | batch_export | ✅ Full |
| **Custom Format** | Via `evaluate()` | ✅ Full | custom_export | ✅ Full |
| **Cloud Upload** | ❌ Not Supported | ❌ Missing | cloud_upload | ✅ Full |
| **Compression** | Brotli/Gzip | ✅ Full | compression_* | ✅ Full (70-93%) |

**Summary:** Basset Hound: ✅ 16 export formats, rendered output. Obscura: ✅ 6 formats, raw/DOM-only.

---

### 7. COLLABORATION & WORKFLOW FEATURES

| Feature | Obscura | Status | Basset Hound | Status |
|---------|---------|--------|--------------|--------|
| **Multi-User API Access** | Standard WebSocket | ✅ Full | WebSocket API | ✅ Full |
| **Authentication/Authorization** | ❌ Not Built-in | ❌ Missing | auth_* commands | ✅ Full |
| **Rate Limiting** | ❌ Not Built-in | ❌ Missing | rate_limit config | ✅ Full |
| **Session Sharing** | ❌ Not Possible | ❌ Missing | share_session | ✅ Full |
| **Workflow Recording** | ❌ Not Implemented | ❌ Missing | record_workflow | ✅ Full |
| **Workflow Playback** | ❌ Not Implemented | ❌ Missing | playback_workflow | ✅ Full |
| **Macro/Script Support** | CLI only | ⚠️ Partial | script_execute | ✅ Full |
| **API Documentation** | CDP standard | ✅ Full | 164+ commands | ✅ Full |
| **MCP Server Support** | 18 tools | ✅ Full | 164 tools | ✅ Full |
| **CLI Support** | `obscura` CLI | ✅ Full | WebSocket only | ⚠️ Partial |
| **Telemetry/Logging** | Basic | ✅ Full | Comprehensive | ✅ Full |
| **Error Recovery** | ❌ Limited | ❌ Missing | auto_retry, recovery | ✅ Full |
| **Health Checks** | ❌ Basic | ❌ Missing | health_check | ✅ Full |
| **Performance Metrics** | ❌ Not Provided | ❌ Missing | get_metrics | ✅ Full |
| **Workflow Templates** | ❌ Not Provided | ❌ Missing | template_* | ✅ Full |
| **Audit Logging** | ❌ Not Supported | ❌ Missing | audit_log | ✅ Full |
| **Data Lineage Tracking** | ❌ Not Supported | ❌ Missing | lineage_track | ✅ Full |
| **Collaborative Annotations** | ❌ Not Supported | ❌ Missing | annotate | ✅ Full |
| **Export with Metadata** | ❌ Limited | ❌ Missing | export_with_metadata | ✅ Full |
| **Report Generation** | ❌ Not Supported | ❌ Missing | generate_report | ✅ Full |

**Summary:** Basset Hound: ✅ Full collaboration stack. Obscura: ⚠️ Basic WebSocket, no team features.

---

## Detailed Comparison Table (Quick Reference)

| Capability | Obscura | BH | Notes |
|-----------|---------|-----|-------|
| **Speed** | ⚡⚡⚡⚡⚡ (30MB) | ⚡⚡ (100MB) | 6-12x faster |
| **Visual Capture** | ❌ None | ✅ Full | Core BH feature |
| **Bot Evasion** | ⚠️ Passive | ✅ Active | 85-90% vs basic |
| **API Commands** | ~30 CDP | 164+ Custom | BH 5.5x more |
| **Profiles** | Context-level | Process-isolated | BH superior isolation |
| **Behavioral AI** | ❌ No | ✅ Yes | 7-vector framework |
| **Export Formats** | 6 formats | 16+ formats | BH renders PDF/images |
| **CLI** | Full | None | Obscura native tool |
| **Deployment** | Single binary | Docker required | Obscura simpler |
| **Interactivity** | Script-only | Interactive UI | BH supports live view |
| **Tor Support** | Planned | ✅ Full | BH has ON/OFF/AUTO |
| **Headless Mode** | Only mode | Optional | Different philosophy |

---

## Integration Scenarios

### Scenario A: Cascading Architecture
```
High-Volume Scraping (Obscura) → Forensic Verification (Basset Hound)
├─ Obscura: Fetch HTML + extract core data (6-12x faster)
└─ Basset Hound: Visual verification + metadata extraction
```

### Scenario B: Parallel Processing
```
Simple Sites (Obscura) ←→ Complex Sites (Basset Hound)
├─ Obscura: Basic TLS/UA checks suffice
└─ Basset Hound: Multi-vector bot protection needed
```

### Scenario C: MCP Tool Chaining
```
Claude Agent
├─ browser_fast_fetch (→ Obscura)      [High-volume extraction]
├─ browser_navigate (→ Basset Hound)   [Interactive workflows]
├─ browser_screenshot (→ Basset Hound) [Visual forensics]
└─ browser_analyze (→ Basset Hound)    [Metadata extraction]
```

### Scenario D: Evasion Progression
```
Low Bot Protection (Obscura) → Medium (Obscura) → High (Basset Hound)
├─ Level 1: Basic TLS checks (Obscura ✅)
├─ Level 2: UA + fingerprinting (Obscura ✅)
└─ Level 3: Behavioral detection (Basset Hound ✅ only)
```

---

## Recommendations by Use Case

### ✅ Use Obscura For:
- High-volume HTML extraction (2,000+ ops/sec)
- Memory-constrained environments (30 MB idle)
- Quick startup requirements (<100ms)
- Simple bot protection (basic TLS/UA checks)
- News aggregation, documentation scraping
- Parallel worker pools (distributed scraping)
- Development/testing environments

### ✅ Use Basset Hound For:
- Visual forensic analysis (screenshots, EXIF)
- Advanced bot detection evasion (85-90% effectiveness)
- Interactive workflows (login, multi-step authentication)
- Multi-account isolation & profile management
- Session coherence requirements (state validation)
- Behavioral mimicry (mouse, typing, scroll patterns)
- PDF rendering, image processing
- Team collaboration workflows

### ✅ Use Both (Hybrid):
- Obscura upstream (data fetch) → Basset Hound downstream (verification)
- MCP tool chaining (router to best engine)
- Gradual evasion escalation (simple → complex sites)
- Cost optimization (Obscura for volume, BH for precision)

---

## Feature Gap Analysis

### Obscura Gaps (vs Basset Hound)
| Gap | Severity | Workaround |
|-----|----------|-----------|
| No screenshots | 🔴 Critical | Use Basset Hound for visual work |
| No canvas/WebGL spoofing | 🔴 Critical | Use Basset Hound for advanced evasion |
| No behavioral AI | 🟠 High | Limited to deterministic interactions |
| No profile isolation | 🟠 High | Use separate processes |
| No export formats | 🟡 Medium | Custom JavaScript evaluation |
| No Tor support | 🟡 Medium | External proxy required |
| No team features | 🟡 Medium | Wrap in orchestration layer |

### Basset Hound Gaps (vs Obscura)
| Gap | Severity | Workaround |
|-----|----------|-----------|
| Slower performance | 🟡 Medium | Use for high-value tasks only |
| Higher memory (100MB) | 🟡 Medium | Distribute across machines |
| No native CLI | 🟡 Medium | Wrap WebSocket in CLI tool |
| Larger deployment | 🟡 Medium | Docker handles complexity |

---

## Performance Comparison

| Metric | Obscura | Basset Hound | Delta |
|--------|---------|--------------|-------|
| Memory (idle) | 30 MB | 80-120 MB | 3-4x |
| Page load (static) | 51 ms | 200-400 ms | 4-8x |
| Page load (dynamic) | 78-85 ms | 300-500 ms | 4-6x |
| Throughput | 2,000+ ops/sec | 285+ msgs/sec | 7x |
| Startup time | ~50 ms | ~2-3 sec | 40-60x |
| Binary size | 70 MB | 300+ MB | 4x |
| Concurrent connections | 50-100+ | 50+ | Comparable |

**Trade-off:** Obscura trades features for speed; Basset Hound trades speed for capability.

---

## Roadmap Alignment

### Obscura (v0.1.9 → v1.0)
- [ ] Canvas fingerprinting evasion
- [ ] WebGL spoofing
- [ ] Behavioral simulation (planned Q4 2026)
- [ ] Tor integration (planned)
- [ ] Screenshot capability (❌ architectural blocker)
- [ ] Multi-level evasion tiers

### Basset Hound (v12.8.0 → v13.0+)
- [ ] Performance optimization (+10-20%)
- [ ] Headless-only mode (CLI variant)
- [ ] Obscura integration layer
- [ ] Advanced evasion vectors (8→12+)
- [ ] Cloud deployment templates
- [ ] Real-time collaboration features

---

## Conclusion

**Complementary Strengths:**
- **Obscura:** Speed champion, headless-first, simple deployment
- **Basset Hound:** Feature-rich, forensic-capable, behavioral authenticity

**Strategic Recommendation:**
1. **Immediate:** Use Basset Hound v12.8.0 for production (feature-complete)
2. **Short-term:** Monitor Obscura v1.0 (expected Q4 2026)
3. **Medium-term:** Evaluate hybrid cascading architecture (Obscura + Basset Hound)
4. **Long-term:** Integrate Obscura as upstream fetch layer via MCP tool chaining

**Not Competing:** These are complementary tools solving different problems. Best outcome: both operational with clear routing logic.

---

**Document Version:** 1.0  
**Analysis Date:** July 3, 2026  
**Matrices Compared:** 7 categories × 50+ features  
**Status:** Complete, ready for strategic review
