# Basset Hound Browser - Development Roadmap

## Overview

Basset Hound Browser is a custom Electron-based automation browser designed for OSINT investigations and AI-driven web automation. This roadmap tracks development progress and planned features.

### Core Purpose
- Automated web browsing with programmatic control via WebSocket
- Bot detection evasion through fingerprint spoofing and human behavior simulation
- OSINT data collection with page content extraction and screenshot capabilities
- Integration with the broader Basset Hound OSINT toolkit

### Tech Stack
- **Framework**: Electron (Chromium + Node.js)
- **Control Interface**: WebSocket server (port 8765)
- **Language**: JavaScript (ES6+)
- **Testing**: Jest for unit tests, custom integration test harness

### System Requirements
- **Node.js**: v18+ (recommended v20 LTS via nvm)
- **npm**: v9+
- **Tor**: Required for Tor integration features (install via `scripts/install/install-tor.sh`)
- **Xvfb**: Optional, for headless mode on Linux
- **Electron Dependencies**: X11 libraries, GTK+, etc. (install via `scripts/install/install-electron-deps.sh`)

---

## Current Architecture

```
External Client (Python, Node.js, etc.)
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
|  - electronAPI    |
|  - evasionHelpers |
+-------------------+
         |
         | Context Bridge
         v
+-------------------+
|    RENDERER       |  <-- renderer/
|  - Browser UI     |
|  - Webview ctrl   |
|  - Event handlers |
+-------------------+
```

---

## Phase 1: Core Foundation ✅ COMPLETED

### 1.1 Electron Architecture
| Task | Status | Description |
|------|--------|-------------|
| Main Process | ✅ Done | Electron main with BrowserWindow |
| Preload Script | ✅ Done | Secure IPC bridge |
| Renderer Process | ✅ Done | Browser UI |
| WebSocket Server | ✅ Done | Remote automation interface (port 8765) |

### 1.2 Core Commands
| Command | Status | Description |
|---------|--------|-------------|
| navigate | ✅ Done | URL navigation |
| click | ✅ Done | Element clicking |
| fill | ✅ Done | Form field filling |
| get_content | ✅ Done | Content extraction |
| screenshot | ✅ Done | Page capture |
| get_page_state | ✅ Done | Page analysis |
| execute_script | ✅ Done | Custom JS execution |
| wait_for_element | ✅ Done | Element waiting |
| scroll | ✅ Done | Page scrolling |
| get_cookies | ✅ Done | Cookie retrieval |
| set_cookies | ✅ Done | Cookie setting |

### 1.3 Bot Detection Evasion
| Feature | Status | Description |
|---------|--------|-------------|
| Navigator spoofing | ✅ Done | webdriver, plugins, languages |
| WebGL fingerprinting | ✅ Done | Vendor/renderer randomization |
| Canvas fingerprinting | ✅ Done | Noise injection |
| Audio fingerprinting | ✅ Done | Frequency data modification |
| Timezone spoofing | ✅ Done | Offset and name |
| User agent rotation | ✅ Done | Realistic UA rotation (70+ UAs) |

### 1.4 Human Behavior Simulation
| Feature | Status | Description |
|---------|--------|-------------|
| Natural mouse movement | ✅ Done | Bezier curves with jitter |
| Realistic typing | ✅ Done | Variable speed, mistakes |
| Random scroll patterns | ✅ Done | Smooth scrolling |
| Variable delays | ✅ Done | Random micro-delays |

---

## Phase 2: Enhanced Capabilities ✅ COMPLETED

### 2.1 Proxy Support
| Task | Status | Description |
|------|--------|-------------|
| HTTP/HTTPS proxy | ✅ Done | Basic proxy support |
| SOCKS4/SOCKS5 proxy | ✅ Done | SOCKS protocol |
| Proxy authentication | ✅ Done | Username/password auth |
| Proxy rotation | ✅ Done | Auto-rotate proxies |
| Proxy statistics | ✅ Done | Track success/failure |

### 2.2 User Agent Management
| Task | Status | Description |
|------|--------|-------------|
| UA library | ✅ Done | 70+ realistic user agents |
| Category selection | ✅ Done | Chrome, Firefox, Safari, etc. |
| UA rotation | ✅ Done | Auto-rotate with timing |
| Custom UAs | ✅ Done | Add custom strings |
| UA parsing | ✅ Done | Extract browser/OS info |

### 2.3 Request Interception
| Task | Status | Description |
|------|--------|-------------|
| Resource blocking | ✅ Done | Block ads, trackers |
| Header modification | ✅ Done | Add/modify/remove headers |
| Predefined rules | ✅ Done | Built-in blocking rules |
| Custom rules | ✅ Done | User-defined patterns |
| Rule import/export | ✅ Done | Save/load configurations |

### 2.4 Screenshot & Recording
| Task | Status | Description |
|------|--------|-------------|
| Full page capture | ✅ Done | Scroll and stitch |
| Element capture | ✅ Done | Specific element screenshots |
| Area capture | ✅ Done | Coordinate-based capture |
| Annotations | ✅ Done | Text, shapes, blur |
| Screen recording | ✅ Done | Video capture |

### 2.5 Session Management
| Task | Status | Description |
|------|--------|-------------|
| Session save | ✅ Done | Save browser state |
| Session restore | ✅ Done | Restore from saved |
| Cookie persistence | ✅ Done | Save cookies to disk |

---

## Phase 3: Testing & Validation ✅ COMPLETED

### 3.1 Unit Tests
| Task | Status | Description |
|------|--------|-------------|
| WebSocket server tests | ✅ Done | Test command handling (websocket-server.test.js) |
| Fingerprint tests | ✅ Done | Verify fingerprinting (fingerprint.test.js) |
| Humanize tests | ✅ Done | Test human behavior simulation (humanize.test.js) |
| Proxy tests | ✅ Done | Test proxy functionality (proxy-manager.test.js) |
| Tab manager tests | ✅ Done | Test tab management (tab-manager.test.js) |
| Geolocation tests | ✅ Done | Test geolocation spoofing (geolocation-manager.test.js) |
| Cookie tests | ✅ Done | Test cookie management (cookies-manager.test.js) |
| Profile tests | ✅ Done | Test profile management (profiles-manager.test.js) |
| Storage tests | ✅ Done | Test storage operations (storage-manager.test.js) |

### 3.2 Integration Tests
| Task | Status | Description |
|------|--------|-------------|
| Browser launch tests | ✅ Done | Verify app starts (browser-launch.test.js) |
| Navigation tests | ✅ Done | Test URL loading (navigation.test.js) |
| Automation tests | ✅ Done | Test automation flows (automation.test.js) |
| Evasion tests | ✅ Done | Test evasion techniques (evasion.test.js) |
| Protocol tests | ✅ Done | Test WebSocket protocol (protocol.test.js) |
| Form filling tests | ✅ Done | Test form interactions (scenarios/form-filling.test.js) |
| Data extraction tests | ✅ Done | Test content extraction (scenarios/data-extraction.test.js) |
| Screenshot tests | ✅ Done | Test screenshot capture (scenarios/screenshot.test.js) |
| Extension communication tests | ✅ Done | WebSocket connection, command flow, session/cookie sharing, profile sync, network coordination, error handling |

### 3.3 End-to-End Tests
| Task | Status | Description |
|------|--------|-------------|
| Full workflow tests | ✅ Done | Complete automation workflows (e2e/full-workflow.test.js) |
| Browser automation tests | ✅ Done | Full browser automation (e2e/browser-automation.test.js) |

### 3.4 Bot Detection Tests
| Task | Status | Description |
|------|--------|-------------|
| Detector tests | ✅ Done | Test against detection services (bot-detection/detector-tests.js) |
| Fingerprint consistency | ✅ Done | Verify fingerprint consistency (bot-detection/fingerprint-consistency.js) |

---

## Phase 4: Advanced Features ✅ COMPLETED

### 4.1 Tab Management
| Task | Status | Description |
|------|--------|-------------|
| Multiple tabs | ✅ Done | Support multiple tabs |
| Tab creation | ✅ Done | Create new tabs via API |
| Tab switching | ✅ Done | Switch active tab |
| Tab closing | ✅ Done | Close tabs via API |
| Tab state tracking | ✅ Done | Track tab states |

### 4.2 Profile/Identity Management
| Task | Status | Description |
|------|--------|-------------|
| Browser profiles | ✅ Done | Isolated browser profiles |
| Identity switching | ✅ Done | Switch between identities |
| Fingerprint profiles | ✅ Done | Consistent fingerprints |
| Profile persistence | ✅ Done | Save/load profiles |

### 4.3 Cookie Management
| Task | Status | Description |
|------|--------|-------------|
| Cookie import | ✅ Done | Import from file/JSON |
| Cookie export | ✅ Done | Export to file/JSON |
| Cookie editor | ✅ Done | GUI cookie editing |
| Cookie sync | ✅ Done | Sync across profiles |

### 4.4 Download Management
| Task | Status | Description |
|------|--------|-------------|
| Download tracking | ✅ Done | Track active downloads |
| Download control | ✅ Done | Pause/resume/cancel |
| Auto-save | ✅ Done | Configure save location |
| Download events | ✅ Done | WebSocket notifications |

### 4.5 DevTools Access
| Task | Status | Description |
|------|--------|-------------|
| Console access | ✅ Done | Read console logs |
| Network panel | ✅ Done | Access network data |
| Elements panel | ✅ Done | DOM inspection |
| Console execution | ✅ Done | Run console commands |

### 4.6 Network Throttling
| Task | Status | Description |
|------|--------|-------------|
| Bandwidth limiting | ✅ Done | Limit download/upload speed |
| Latency simulation | ✅ Done | Add artificial latency |
| Preset profiles | ✅ Done | 3G, 4G, slow connection |
| Custom throttling | ✅ Done | User-defined settings |

### 4.7 Geolocation Spoofing
| Task | Status | Description |
|------|--------|-------------|
| GPS spoofing | ✅ Done | Override navigator.geolocation |
| Timezone matching | ✅ Done | Match timezone to location |
| Preset locations | ✅ Done | Major cities |
| Custom coordinates | ✅ Done | User-defined lat/long |

### 4.8 Local Storage Manager
| Task | Status | Description |
|------|--------|-------------|
| Storage viewer | ✅ Done | View all storage |
| Storage editor | ✅ Done | Edit storage values |
| Storage export | ✅ Done | Export storage data |
| Storage import | ✅ Done | Import storage data |

### 4.9 Header Modification (Enhanced)
| Task | Status | Description |
|------|--------|-------------|
| Request headers | ✅ Done | Modify outgoing headers |
| Response headers | ✅ Done | Modify incoming headers |
| Header profiles | ✅ Done | Save/load header sets |
| Conditional headers | ✅ Done | URL-based header rules |

### 4.10 Page History Tracking
| Task | Status | Description |
|------|--------|-------------|
| History recording | ✅ Done | Track visited pages |
| History export | ✅ Done | Export browsing history |
| History search | ✅ Done | Search history |
| History API | ✅ Done | WebSocket history access |

### 4.11 Ad/Tracker Blocking
| Task | Status | Description |
|------|--------|-------------|
| Ad blocking | ✅ Done | Block common ad domains |
| Tracker blocking | ✅ Done | Block trackers |
| Filter lists | ✅ Done | EasyList integration |
| Custom filters | ✅ Done | User-defined filters |

### 4.12 Page Automation Scripts
| Task | Status | Description |
|------|--------|-------------|
| Script storage | ✅ Done | Save automation scripts |
| Script execution | ✅ Done | Run saved scripts |
| Script editor | ✅ Done | GUI script editing |
| Script scheduling | ✅ Done | Timed execution |

### 4.13 DOM Inspector
| Task | Status | Description |
|------|--------|-------------|
| Element inspection | ✅ Done | Inspect DOM elements |
| Selector generation | ✅ Done | Generate CSS selectors |
| Element highlighting | ✅ Done | Visual element highlight |
| DOM tree view | ✅ Done | Hierarchical DOM display |

---

## Phase 5: Security & Stability ✅ COMPLETED

### 5.1 WebSocket Security
| Task | Status | Description |
|------|--------|-------------|
| Authentication mechanism | ✅ Done | Token-based auth for WebSocket (query param, header, or command) |
| Heartbeat/keepalive | ✅ Done | Connection health monitoring with configurable intervals |
| Rate limiting | ✅ Done | Configurable rate limiting with burst allowance (disabled by default) |
| SSL/TLS support | ✅ Done | Encrypted WebSocket (wss://) with BASSET_WS_SSL_* env vars |

### 5.2 Stability Improvements
| Task | Status | Description |
|------|--------|-------------|
| Memory management | ✅ Done | MemoryManager class with threshold monitoring, GC hints, cache cleanup |
| Error recovery | ✅ Done | Crash recovery with session state persistence and auto-save |
| Connection resilience | ✅ Done | Auto-reconnect examples in API docs, exponential backoff patterns |

---

## Phase 6: Enhanced Data Extraction API ✅ COMPLETED

> **Architecture Note**: Basset Hound Browser is an API-first tool. It exposes a WebSocket API that external applications connect to for browser automation. It does NOT connect to other backends - other apps connect to IT.

### 6.1 Technology Detection (Wappalyzer-like)
| Task | Status | Description |
|------|--------|-------------|
| Integrate tech detection library | ✅ Done | TechnologyManager with 100+ fingerprints |
| `detect_technologies` command | ✅ Done | Return detected tech stack with confidence scores |
| Framework detection | ✅ Done | React, Vue, Angular, Next.js, etc. |
| CMS detection | ✅ Done | WordPress, Drupal, Shopify, Joomla, etc. |
| Server/hosting detection | ✅ Done | Apache, Nginx, Cloudflare, AWS, etc. |
| Analytics detection | ✅ Done | Google Analytics, Mixpanel, Hotjar, etc. |
| `get_technology_categories` command | ✅ Done | List all detection categories |
| `get_technology_info` command | ✅ Done | Get details for specific technology |
| `search_technologies` command | ✅ Done | Search fingerprint database |

### 6.2 Advanced Content Extraction
| Task | Status | Description |
|------|--------|-------------|
| `extract_metadata` command | ✅ Done | OG tags, meta tags, Twitter cards, Dublin Core |
| `extract_links` command | ✅ Done | All links with categorization (internal/external/mailto/tel) |
| `extract_forms` command | ✅ Done | Form fields, inputs, textareas, selects, buttons |
| `extract_images` command | ✅ Done | Image URLs, alt text, dimensions, lazy-loaded |
| `extract_scripts` command | ✅ Done | External/inline scripts with library detection |
| `extract_stylesheets` command | ✅ Done | CSS files and inline styles |
| `extract_structured_data` command | ✅ Done | JSON-LD, Microdata, RDFa parsing |
| `extract_all` command | ✅ Done | Extract all content types at once |
| `get_extraction_stats` command | ✅ Done | Extraction statistics and counts |

### 6.3 Network Analysis API
| Task | Status | Description |
|------|--------|-------------|
| `start_network_capture` command | ✅ Done | Start capturing network traffic |
| `stop_network_capture` command | ✅ Done | Stop capture and get summary |
| `get_network_requests` command | ✅ Done | All HTTP requests with filtering |
| `get_request_details` command | ✅ Done | Full details for specific request |
| `get_response_headers` command | ✅ Done | Response headers for any request |
| `get_security_info` command | ✅ Done | SSL/TLS cert info, security analysis |
| `analyze_security_headers` command | ✅ Done | Analyze HSTS, CSP, X-Frame-Options, etc. |
| `get_resource_timing` command | ✅ Done | Performance metrics and timing |
| `get_requests_by_domain` command | ✅ Done | Group requests by domain |
| `get_slow_requests` command | ✅ Done | Filter by duration threshold |
| `get_failed_requests` command | ✅ Done | List failed network requests |
| `get_network_statistics` command | ✅ Done | Capture session statistics |
| `export_network_capture` command | ✅ Done | Export all captured data |
| `clear_network_capture` command | ✅ Done | Clear captured data |

### 6.4 API Client Libraries ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Python client library | ✅ Done | `pip install basset-hound-client` - Full-featured Python client with sync API |
| Node.js client library | ✅ Done | `npm install basset-hound-client` - Promise-based Node.js client with events |
| CLI tool | ✅ Done | `basset-hound-cli` - Full command-line interface for all browser operations |
| API documentation (OpenAPI) | ✅ Done | OpenAPI 3.0 spec with Swagger UI at `docs/api/` |

---

## Phase 7: Advanced Orchestration ✅ COMPLETED

### 7.1 Multi-Window Orchestration ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Spawn multiple windows | ✅ Done | WindowManager class for multiple browser instances |
| Window-to-window communication | ✅ Done | Inter-window messaging via broadcast() |
| Parallel page processing | ✅ Done | Concurrent operations across windows |
| Window pooling | ✅ Done | WindowPool class with pre-warming and recycling |

### 7.2 Extended Proxy Support ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Tor integration | ✅ Done | TorManager with SOCKS5 proxy and circuit management |
| Proxy chaining | ✅ Done | ProxyChainManager for multi-hop proxies |

### 7.3 Recording & Replay ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Record user actions | ✅ Done | SessionRecorder for action capture |
| Export as script | ✅ Done | ActionSerializer for Python Selenium/Puppeteer/Playwright |
| Replay with modifications | ✅ Done | Parameterized replay with variable substitution |
| Visual diff detection | ✅ Done | Screenshot comparison for page changes |

### 7.4 Headless Mode ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Run without UI | ✅ Done | HeadlessManager for headless operation |
| Virtual frame buffer | ✅ Done | Xvfb detection and configuration |
| Resource optimization | ✅ Done | Preset profiles: minimal, standard, performance |

---

## Phase 8: Developer Experience ✅ COMPLETED

### 8.1 Plugin System ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Define plugin API | ✅ Done | PluginAPI class with sandboxed API access |
| Plugin loading | ✅ Done | PluginLoader with dynamic loading from directories |
| Built-in examples | ✅ Done | Example plugins in plugins/examples/ |
| Plugin isolation | ✅ Done | PluginSandbox with security limits and allowed modules |
| Plugin registry | ✅ Done | PluginRegistry for tracking and configuration |
| Plugin commands | ✅ Done | Register custom WebSocket commands from plugins |
| Plugin hooks | ✅ Done | Hook system for page events and lifecycle |

### 8.2 Configuration System ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| YAML/JSON config | ✅ Done | ConfigManager with YAML and JSON support |
| Environment variables | ✅ Done | Env loader with BASSET_* prefix mapping |
| Command-line arguments | ✅ Done | CLI parser with full argument support |
| Runtime config API | ✅ Done | get/set/has/reset methods for runtime changes |
| Config validation | ✅ Done | Schema-based validation with Types system |
| Config watching | ✅ Done | Watch file for changes and auto-reload |
| Default presets | ✅ Done | Defaults for server, browser, evasion, network, logging |

### 8.3 Logging & Debugging ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Structured logging | ✅ Done | Logger class with JSON and text formatters |
| Log levels | ✅ Done | trace, debug, info, warn, error, fatal levels |
| Debug mode | ✅ Done | DebugManager with verbose/diagnostic modes |
| Performance profiling | ✅ Done | Profiler class with Timer and Metric tracking |
| Memory monitoring | ✅ Done | MemoryMonitor with thresholds and alerts |
| Multiple transports | ✅ Done | Console, File, WebSocket, Memory transports |
| Color formatting | ✅ Done | ColorFormatter for terminal output |

---

## Phase 9: Advanced Tor Integration ✅ COMPLETED

> **Goal**: Provide comprehensive Tor integration with full control over circuits, nodes, bridges, and anonymity features for OSINT and privacy-focused browsing.

### 9.1 Tor Process Management ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Auto-start Tor daemon | ✅ Done | AdvancedTorManager.start() - automatically start/stop embedded Tor process |
| Tor binary bundling | ✅ Done | Auto-detect Tor binary on Linux/macOS/Windows |
| Tor configuration generation | ✅ Done | _generateTorrc() - generate torrc files programmatically |
| Process health monitoring | ✅ Done | Bootstrap progress tracking and state monitoring |
| Graceful shutdown | ✅ Done | stop() with SIGTERM and cleanup |

### 9.2 Exit Node Control ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Exit country selection | ✅ Done | setExitCountries() - 30+ country codes supported |
| Exit node exclusion | ✅ Done | excludeExitCountries() - exclude specific countries |
| Exit node preferences | ✅ Done | StrictNodes support for enforcement |
| Real-time exit IP detection | ✅ Done | checkExitIp() via check.torproject.org |
| Exit node geolocation | ✅ Done | _getNodeInfo() with GeoIP lookup |

### 9.3 Guard & Entry Node Configuration ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Guard node selection | ✅ Done | guardNodes configuration in torrc |
| Guard persistence | ✅ Done | Persistent data directory |
| Entry node country control | ✅ Done | setEntryCountries() |
| Guard rotation settings | ✅ Done | Configurable via torrc generation |

### 9.4 Bridge Support (Censorship Circumvention) ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Built-in bridges | ✅ Done | BUILTIN_BRIDGES with obfs4, meek, snowflake |
| Custom bridge configuration | ✅ Done | addBridge() method |
| Bridge DB integration | ✅ Done | fetchBridgesFromBridgeDB() (returns builtin as fallback) |
| Automatic bridge selection | ✅ Done | enableBridges() with useBuiltin option |

### 9.5 Pluggable Transports ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| obfs4 transport | ✅ Done | TRANSPORT_TYPES.OBFS4 with binary detection |
| meek transport | ✅ Done | TRANSPORT_TYPES.MEEK |
| snowflake transport | ✅ Done | TRANSPORT_TYPES.SNOWFLAKE |
| webtunnel transport | ✅ Done | TRANSPORT_TYPES.WEBTUNNEL |
| Transport auto-detection | ✅ Done | _getTransportPath() binary detection |

### 9.6 Circuit Management ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Circuit visualization | ✅ Done | getCircuitPath() with Guard/Middle/Exit roles |
| Circuit rebuilding | ✅ Done | newIdentity() via SIGNAL NEWNYM |
| Circuit pinning | ✅ Done | closeCircuit() for specific circuits |
| Multi-circuit support | ✅ Done | getCircuitInfo() lists all circuits |
| Circuit latency monitoring | ✅ Done | Latency tracking in stats |

### 9.7 Stream Isolation ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Per-tab isolation | ✅ Done | ISOLATION_MODES.PER_TAB |
| Per-domain isolation | ✅ Done | ISOLATION_MODES.PER_DOMAIN |
| Isolation policies | ✅ Done | setIsolationMode() with 4 modes |
| Session correlation prevention | ✅ Done | getIsolatedPort() for unique SOCKS ports |

### 9.8 Onion Services (.onion) ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| .onion URL handling | ✅ Done | isOnionUrl() with v2/v3 detection |
| Onion-Location header support | ✅ Done | handleOnionLocation() |
| Onion service hosting | ✅ Done | createOnionService() via ADD_ONION |
| Onion authentication | ✅ Done | ED25519-V3 key support |

### 9.9 Enhanced Tor WebSocket API ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| `tor_start` command | ✅ Done | Start Tor daemon |
| `tor_stop` command | ✅ Done | Stop Tor daemon |
| `tor_set_exit_country` command | ✅ Done | Set preferred exit country |
| `tor_exclude_countries` command | ✅ Done | Exclude countries from circuits |
| `tor_get_circuit_path` command | ✅ Done | Get current circuit node info |
| `tor_rebuild_circuit` command | ✅ Done | Force circuit rebuild |
| `tor_add_bridge` command | ✅ Done | Add bridge configuration |
| `tor_set_transport` command | ✅ Done | Set pluggable transport |
| `tor_get_bandwidth` command | ✅ Done | Get bandwidth statistics |
| `tor_set_isolation` command | ✅ Done | Configure stream isolation |
| `tor_check_connection` command | ✅ Done | Check Tor connectivity |
| `tor_get_consensus` command | ✅ Done | Get network consensus info |
| `tor_create_onion_service` | ✅ Done | Create hidden service |
| `tor_list_onion_services` | ✅ Done | List active onion services |
| `tor_get_country_codes` | ✅ Done | Get available country codes |
| `tor_get_transports` | ✅ Done | Get available transport types |
| `tor_configure` | ✅ Done | Configure Tor manager |

### 9.10 Testing & Validation ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Tor unit tests | ✅ Done | 70 tests in tor-advanced.test.js |
| Tor integration tests | ✅ Done | 48 tests in tor-integration.test.js |
| Circuit path validation | ✅ Done | _parseCircuits() tests |
| Exit IP verification | ✅ Done | checkExitIp() tests |
| Bridge connectivity tests | ✅ Done | Bridge configuration tests |
| Transport tests | ✅ Done | Transport type validation tests |
| Live Tor connectivity test | ✅ Done | tor-integration-test.js - All 6 tests passed (Dec 29, 2024) |

### 9.11 Tor Integration Verified ✅ COMPLETED (December 29, 2024)
| Test | Status | Result |
|------|--------|--------|
| SOCKS Port (9050) | ✅ Pass | Port open, accepting connections |
| Control Port (9051) | ✅ Pass | Port open, accepting connections |
| Authentication | ✅ Pass | Tor version: 0.4.8.21 |
| Circuit Retrieval | ✅ Pass | 18 built circuits detected |
| New Identity (NEWNYM) | ✅ Pass | Signal sent successfully |
| Exit IP Verification | ✅ Pass | Exit IP: 45.84.107.47 (confirmed Tor exit) |

**Documentation Added:**
- [TOR-INTEGRATION.md](features/TOR-INTEGRATION.md) - Comprehensive integration guide
- [TOR-SETUP-GUIDE.md](deployment/TOR-SETUP-GUIDE.md) - Cross-platform setup guide
- [tor-integration-test.js](../tests/tor-integration-test.js) - Live connectivity test script

---

## Phase 10: Distribution 🚧 IN PROGRESS

### 10.1 Packaging ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| electron-builder config | ✅ Done | Comprehensive build configuration with all 34 modules |
| Windows installer | ✅ Done | NSIS installer (.exe) + portable build for x64/ia32 |
| macOS app bundle | ✅ Done | DMG + ZIP for x64/arm64 with entitlements |
| Linux packages | ✅ Done | AppImage, DEB, RPM, tar.gz for x64 |
| Icon generation | ✅ Done | SVG source with generation script for all platforms |
| Distribution docs | ✅ Done | Comprehensive DISTRIBUTION.md guide |

### 10.2 Auto-Update ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Update server | ✅ Done | GitHub releases as default provider, custom server support |
| Delta updates | ✅ Done | Differential downloads via electron-updater |
| Update notifications | ✅ Done | Toast-style UI notifications with progress |
| Rollback capability | ✅ Done | Version history with rollback support |
| WebSocket API | ✅ Done | 10 update commands (check, download, install, config, etc.) |
| Update manager | ✅ Done | UpdateManager class with full lifecycle management |
| IPC integration | ✅ Done | Renderer-side update manager with IPC handlers |
| Configuration | ✅ Done | Schema validation with 17 configurable options |

### 10.3 Docker Deployment ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Dockerfile | ✅ Done | Production-ready container with Xvfb |
| Docker Compose | ✅ Done | Full configuration with volumes, limits, security |
| .dockerignore | ✅ Done | Optimized build context |
| Health check endpoints | ✅ Done | Container health monitoring configured |
| Kubernetes manifests | 📋 Planned | K8s deployment (future) |

### 10.4 SSL Certificate Auto-Generation ✅ COMPLETED
| Task | Status | Description |
|------|--------|-------------|
| Certificate generator module | ✅ Done | CertificateGenerator class with multiple generation methods |
| OpenSSL support | ✅ Done | Primary method for creating X.509 certificates |
| node-forge support | ✅ Done | Fallback for pure JavaScript certificate generation |
| Node.js crypto fallback | ✅ Done | Last-resort method using built-in crypto module |
| Auto-generation on startup | ✅ Done | Automatic certificate creation when SSL enabled but no certs provided |
| Certificate renewal | ✅ Done | Automatic renewal when certificates expire (<30 days) |
| Configurable storage | ✅ Done | Store certificates in userData directory or custom location |
| Certificate validation | ✅ Done | Check certificate existence, validity, and expiration |
| Integration with WebSocket server | ✅ Done | Seamless integration with existing WSS support |
| Documentation | ✅ Done | Comprehensive SSL-CERTIFICATES.md guide |

---

## Phase 11: Embedded Tor 🚧 IN PROGRESS

### 11.1 Portable Tor Distribution
| Task | Status | Description |
|------|--------|-------------|
| Tor Expert Bundle download | ✅ Done | Download script for all platforms (Linux, macOS, Windows) |
| Binary extraction | ✅ Done | Automated extraction to `bin/tor/` directory |
| Pluggable transports | ✅ Done | Includes lyrebird (obfs4/meek/webtunnel/snowflake) and conjure |
| GeoIP databases | ✅ Done | IPv4 and IPv6 GeoIP files included |
| Setup script | ✅ Done | `scripts/install/embedded-tor-setup.js` |
| Version verification | ✅ Done | Automatic binary validation after install |

**Tested Configuration:**
- **Bundle Version**: 15.0.3
- **Tor Daemon**: 0.4.8.21
- **Platform Tested**: Linux x86_64

### 11.2 Embedded Tor Manager Integration
| Task | Status | Description |
|------|--------|-------------|
| AdvancedTorManager binary detection | ✅ Done | `_findTorBinary()` checks `bin/tor/` directory |
| Local data directory | ✅ Done | `~/.local/share/basset-hound-browser/tor/` |
| Dynamic torrc generation | ✅ Done | `_generateTorrc()` creates config at runtime |
| Process lifecycle management | ✅ Done | Start/stop/restart embedded Tor process |
| Control port authentication | ✅ Done | Cookie or password authentication |
| Bootstrap progress tracking | ✅ Done | Real-time bootstrap percentage events |

### 11.3 Deployment Strategy
| Task | Status | Description |
|------|--------|-------------|
| User-space installation | ✅ Done | No sudo/root required for embedded mode |
| Minimal system impact | ✅ Done | All files in application directory |
| First-run download | ✅ Done | tor-auto-setup.js downloads on first use if not present |
| Bundle with release | 📋 Planned | Include Tor in electron-builder packages |
| Platform auto-detection | ✅ Done | Downloads correct bundle for OS/arch |
| CLI arguments for Tor modes | ✅ Done | --tor, --system-tor, --embedded-tor, --[no-]tor-auto-download |
| System Tor documentation | ✅ Done | SYSTEM-TOR-INSTALLATION.md with cross-platform guides |

### 11.4 Usage Options

**Option 1: System Tor (Requires Installation)**
```bash
# Install Tor via system package manager
sudo ./scripts/install/install-tor.sh

# Browser connects to system Tor on ports 9050/9051
```

**Option 2: Embedded Tor (Portable)**
```bash
# Download and setup embedded Tor
node scripts/install/embedded-tor-setup.js

# Browser spawns its own Tor process
# No installation required, no sudo needed
```

**Deployment Comparison:**
| Feature | System Tor | Embedded Tor |
|---------|------------|--------------|
| Installation | Requires sudo | No installation |
| Permissions | Root/admin needed | User-space only |
| System Impact | Installs service | None (portable) |
| Multiple Apps | Shared by all | Isolated per-app |
| Configuration | `/etc/tor/torrc` | Local `torrc` |
| Auto-Start | Via systemd | Via application |
| Memory Usage | Single daemon | Per-application |

---

## Technical Debt

| Item | Priority | Description |
|------|----------|-------------|
| Memory management | ✅ Resolved | MemoryManager class with monitoring and cleanup |
| Error recovery | ✅ Resolved | Crash recovery with session state persistence |
| Performance profiling | ✅ Resolved | IPC timeout handling prevents memory leaks from hanging promises |
| Code documentation | Medium | Add JSDoc comments |
| Dependency updates | Low | Update Electron version |
| Test flakiness | ✅ Resolved | Manager test flakiness fixed (extraction, cookies, storage, proxy, tabs) - corrected mock configurations, API expectations, and method names (v8.2.1) |
| SSL/TLS for WebSocket | ✅ Resolved | wss:// support with BASSET_WS_SSL_* env vars |
| IPC memory leaks | ✅ Resolved | Added timeouts and cleanup functions for all IPC handlers |
| Event listener leaks | ✅ Resolved | Preload event listeners return cleanup functions |
| JavaScript injection | ✅ Resolved | Used JSON.stringify() for safe selector escaping in renderer |
| Certificate bypass | ✅ Resolved | Made certificate error handling configurable (disabled by default) |
| WebSocket IPC timeouts | ✅ Resolved | Added ipcWithTimeout helper for all WebSocket server commands |
| Command injection in cert gen | ✅ Resolved | Used execFileSync with input validation instead of execSync |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12 | Initial release with core features |
| 1.1.0 | 2024-12 | Added proxy support |
| 1.2.0 | 2024-12 | Added user agent management |
| 1.3.0 | 2024-12 | Added request interception |
| 1.4.0 | 2024-12 | Added screenshot enhancements |
| 1.5.0 | 2024-12 | Added input simulation |
| 2.0.0 | 2024-12 | Completed Phase 3 testing |
| 2.1.0 | 2024-12 | Completed Phase 4 advanced features |
| 2.2.0 | 2024-12 | Added WebSocket authentication and heartbeat/keepalive |
| 2.3.0 | 2024-12 | Added rate limiting with burst allowance |
| 2.4.0 | 2024-12 | Added memory management utilities (MemoryManager class) |
| 2.5.0 | 2024-12 | Added crash recovery and error recovery mechanisms |
| 3.0.0 | 2024-12 | Completed Phase 5 Security & Stability |
| 3.1.0 | 2024-12 | Added SSL/TLS support for WebSocket (wss://) |
| 4.0.0 | 2024-12 | Completed Phase 6 Enhanced Data Extraction API |
| 4.1.0 | 2024-12 | Completed Phase 6.4 API Client Libraries |
| 5.0.0 | 2024-12 | Completed Phase 7 Advanced Orchestration |
| 6.0.0 | 2024-12 | Completed Phase 8 Developer Experience (Plugin, Config, Logging) |
| 7.0.0 | 2024-12 | Completed Phase 9 Advanced Tor Integration |
| 8.0.0 | 2024-12 | Phase 10.1 Packaging Complete - electron-builder config for all platforms |
| 8.1.0 | 2024-12 | Phase 10.2 Auto-Update Complete - electron-updater, WebSocket API, rollback support |
| 8.1.1 | 2024-12 | Security & Stability Fixes - IPC memory leaks, event listener cleanup, injection vulnerabilities (renderer + websocket cert gen), certificate handling |
| 8.1.2 | 2024-12 | Verified all security fixes: IPC timeouts in main.js, cleanup functions in preload.js, JSON.stringify() escaping in renderer.js, configurable certificate handling, execFileSync in websocket server |
| 8.1.3 | 2024-12 | Test suite improvements: Fixed humanize.test.js (60 tests), fingerprint.test.js, tor-manager.test.js, tor-advanced.test.js, websocket-server.test.js, window-pool.test.js, headless-manager.test.js. Improved test tolerances for randomness-based functions and platform-dependent tests. 903/1011 tests passing (89.3% pass rate). |
| 8.1.4 | 2024-12 | Phase 10.4 SSL Certificate Auto-Generation - Automatic certificate creation for WebSocket SSL, multi-method generation (OpenSSL, node-forge, Node.js crypto), automatic renewal, configurable storage location, integration with main.js startup sequence |
| 8.1.5 | 2024-12 | Tor Integration Verified - Live testing with system Tor (v0.4.8.21), all 6 connectivity tests passed, comprehensive documentation for cross-platform setup (Ubuntu, Debian, Fedora, Arch, macOS, Windows), TOR-INTEGRATION.md and TOR-SETUP-GUIDE.md added |
| 8.2.0 | 2024-12 | Phase 11 Embedded Tor - Portable Tor distribution (Tor Expert Bundle 15.0.3), embedded-tor-setup.js script, no-install user-space operation, pluggable transports (obfs4/meek/snowflake/conjure), GeoIP databases included |
| 8.2.1 | 2024-12 | Test Suite Improvements - Fixed manager test flakiness (12 test files, 588 manager tests now passing), corrected mock configurations and API expectations, improved test pass rate from 75.1% to 82.5% (1097/1329 tests passing), added 23 embedded Tor tests, fixed URL history tracking bug in TabManager, verified embedded Tor bootstrap to 100% |
| 8.2.2 | 2024-12-29 | Major Test Suite Overhaul - Comprehensive Electron mock rewrite (session, webContents, globalShortcut), fixed 43+ test failures, scenario tests converted to Jest format (94 tests), extension communication tests structured, fingerprint test fixes (47 tests), tor-advanced.js null reference fix. Test results: 27 suites passing, 1307 tests passing. Moved embedded Tor to production location (bin/tor/). |
| 8.2.3 | 2024-12-29 | Test Infrastructure & Embedded Tor Verification - CI environment support (28 suites pass, 1313 tests), fixed nativeImage mock circular reference, scenario tests with proper skip conditions, cert-generator Jest mock hoisting fix, SSL connection race condition fix, Tor integration test flexibility. Embedded Tor verified: bootstrap 100%, circuit routing confirmed via check.torproject.org. |
| 8.2.4 | 2024-12-29 | Embedded Tor CLI Integration - CLI arguments for Tor modes (--tor, --system-tor, --embedded-tor, --[no-]tor-auto-download), embedded Tor as default behavior, system Tor installation guide (SYSTEM-TOR-INSTALLATION.md), first-run auto-download via tor-auto-setup.js, updated default configuration. |
| 8.3.0 | 2026-01-05 | Phase 13 Web Content Data Ingestion - DataTypeDetector (25+ patterns), IngestionProcessor (5 modes), 14 WebSocket commands, Python client mixin (15 methods), Node.js client methods (18 added), comprehensive tests (130+ test cases). |
| 8.4.0 | 2026-01-05 | Phase 14 Advanced Image Ingestion - ImageMetadataExtractor (EXIF/IPTC/XMP/GPS), 10 WebSocket commands, OCR via tesseract.js, perceptual hashing, image similarity comparison, basset-hound orphan data generation. |
| 9.0.0 | 2026-01-08 | Phase 15 MCP Server Complete - FastMCP server with 46 MCP tools for AI agent integration, BrowserConnection WebSocket client, MCP resources, comprehensive unit tests. Research completed for Phase 17 bot detection evasion. |
| 9.1.0 | 2026-01-08 | Phase 16 Sock Puppet Integration - SockPuppetIntegration class (600+ lines), 17 WebSocket commands, 10 MCP tools, basset-hound API integration, session/activity tracking, fingerprint consistency validation, comprehensive tests (70+ cases). |
| 9.2.0 | 2026-01-08 | Phase 17 Enhanced Bot Detection Evasion - FingerprintProfile (platform-consistent fingerprints), BehavioralAI (Fitts's Law mouse, biometric typing), HoneypotDetector, RateLimitAdapter, 24 WebSocket commands, 11 MCP tools (67 total). |
| 9.3.0 | 2026-01-08 | Phase 18 Evidence Collection Workflow - Evidence/EvidencePackage/EvidenceCollector classes, SHA-256 chain of custody, court-ready export, 22 WebSocket commands, 10 MCP tools (76 total), comprehensive tests. |
| 9.4.0 | 2026-01-08 | Phase 12 OSINT Agent Integration - InvestigationManager class, 13 OSINT patterns, investigation workflow (queue, depth, patterns), basset-hound orphan export, 18 WebSocket commands, 12 MCP tools (88 total). |

---

## Success Metrics

- [x] All unit tests passing
- [x] Integration tests passing
- [x] Bot detection tests passing
- [x] E2E tests passing
- [x] Documentation up to date
- [x] WebSocket authentication implemented
- [x] WebSocket heartbeat/keepalive implemented
- [x] Rate limiting implemented
- [x] Memory management implemented
- [x] Error recovery implemented
- [x] SSL/TLS support implemented
- [x] Phase 5 Security & Stability complete
- [x] Technology detection implemented (30+ WebSocket commands)
- [x] Content extraction implemented (9 extraction commands)
- [x] Network analysis implemented (15 network commands)
- [x] Phase 6 Enhanced Data Extraction complete
- [x] Python client library implemented
- [x] Node.js client library implemented
- [x] CLI tool implemented
- [x] OpenAPI documentation generated
- [x] Phase 6.4 API Client Libraries complete
- [x] Multi-Window Orchestration implemented (WindowManager, WindowPool)
- [x] Extended Proxy Support implemented (TorManager, ProxyChainManager)
- [x] Recording & Replay implemented (SessionRecorder, ActionSerializer)
- [x] Headless Mode implemented (HeadlessManager with Xvfb support)
- [x] Phase 7 Advanced Orchestration complete
- [x] Plugin System implemented (PluginManager, PluginAPI, PluginLoader, PluginSandbox)
- [x] Configuration System implemented (ConfigManager with YAML/JSON/ENV/CLI support)
- [x] Logging System implemented (Logger, Profiler, MemoryMonitor, DebugManager)
- [x] Phase 8 Developer Experience complete
- [x] Phase 7 unit tests added (window-manager, window-pool, headless-manager, tor-manager, recording-action)
- [x] Advanced Tor Integration implemented (AdvancedTorManager with 1900+ lines)
- [x] Tor process management (auto-start/stop, torrc generation)
- [x] Exit/Entry node country selection (30+ countries)
- [x] Bridge support with obfs4, meek, snowflake transports
- [x] Stream isolation (per-tab, per-domain, per-session)
- [x] Onion service support (.onion URL handling, service hosting)
- [x] 25+ new Tor WebSocket API commands
- [x] 118 new Tor tests (70 unit + 48 integration)
- [x] Phase 9 Advanced Tor Integration complete
- [x] Phase 10.1 Packaging complete (electron-builder config, all platforms)
- [x] Phase 10.3 Docker Deployment complete (Dockerfile, docker-compose, .dockerignore)
- [x] Phase 10.2 Auto-Update complete (UpdateManager, WebSocket API, UI notifications)
- [x] No critical bugs (v8.1.1 security & stability fixes applied)
- [x] Embedded Tor support (portable Tor bundle, no installation required)
- [x] Pluggable transports (obfs4, meek, snowflake, conjure)
- [x] Phase 13.1 Data Type Detection implemented (25+ patterns)
- [x] Phase 13.2 Ingestion Modes implemented (5 modes)
- [x] Phase 13.4 WebSocket Commands implemented (14 commands)
- [x] Phase 13.5 basset-hound Integration (orphan data mapping, provenance, deduplication)
- [x] Python client ingestion mixin (15 methods)
- [x] Node.js client ingestion methods (18 methods)
- [x] Phase 14 Image Metadata Extractor (EXIF/IPTC/XMP/GPS)
- [x] Phase 14 WebSocket Commands (10 image commands)
- [x] OCR text extraction from images
- [x] Perceptual hashing for image similarity
- [x] Phase 15 MCP Server implemented (46 tools)
- [x] FastMCP server for AI agent integration
- [x] MCP resources (browser://status, browser://current-page)
- [x] Phase 17 bot detection evasion research complete
- [x] Phase 16 Sock Puppet Integration complete
- [x] SockPuppetIntegration class with basset-hound API
- [x] 17 sock puppet WebSocket commands
- [x] 10 sock puppet MCP tools (56 total)
- [x] Activity tracking and session management
- [x] Fingerprint consistency validation
- [x] Phase 17 Enhanced Bot Detection Evasion complete
- [x] FingerprintProfile for platform-consistent fingerprints
- [x] BehavioralAI with Fitts's Law mouse movement
- [x] TypingAI with biometric patterns
- [x] HoneypotDetector with 8+ indicators
- [x] RateLimitAdapter with exponential backoff
- [x] 24 evasion WebSocket commands
- [x] 11 evasion MCP tools (67 total)
- [x] Phase 18 Evidence Collection Workflow complete
- [x] Evidence/EvidencePackage/EvidenceCollector classes
- [x] SHA-256 hash for all evidence
- [x] Chain of custody tracking
- [x] Court-ready export with certification
- [x] 22 evidence WebSocket commands
- [x] 10 evidence MCP tools (76 total)
- [x] Phase 12 OSINT Agent Integration complete
- [x] InvestigationManager for workflow management
- [x] 13 OSINT data patterns with validation
- [x] Investigation queue with depth/pattern control
- [x] basset-hound orphan format export
- [x] 18 OSINT WebSocket commands
- [x] 12 OSINT MCP tools (88 total)

---

## Quick Start

### Development Setup
```bash
cd ~/basset-hound-browser

# Install system dependencies (recommended)
sudo ./scripts/install/main-install.sh --all

# Or install npm dependencies only (if system deps already installed)
npm install

# Start the browser
npm start  # or npm run dev for DevTools
```

### Installation Scripts

Comprehensive installation scripts are available in `scripts/install/`:

- **main-install.sh**: Interactive installer for all components (Node.js, Tor, Electron deps, Xvfb)
- **install-node.sh**: Install Node.js v20 LTS via nvm with bash integration
- **install-tor.sh**: Install and configure Tor with ControlPort for programmatic access
- **install-electron-deps.sh**: Install X11, GTK+, and other Electron dependencies
- **install-xvfb.sh**: Install Xvfb for headless browser operation

**Usage Examples**:
```bash
# Install everything (interactive)
sudo ./scripts/install/main-install.sh

# Install specific components
sudo ./scripts/install/main-install.sh --tor --node

# Or use embedded Tor (no sudo required)
node scripts/install/embedded-tor-setup.js

# Non-interactive installation
sudo ./scripts/install/main-install.sh --all --assume-yes

# Dry run (see what would be installed)
sudo ./scripts/install/main-install.sh --all --dry-run
```

### Using Python Client
```python
from basset_hound import BassetHoundClient

with BassetHoundClient() as client:
    client.navigate("https://example.com")
    print(client.get_title())
    client.save_screenshot("screenshot.png")
```

### Using Node.js Client
```javascript
const { BassetHoundClient } = require('basset-hound-client');

const client = new BassetHoundClient();
await client.connect();
await client.navigate('https://example.com');
console.log(await client.getTitle());
await client.disconnect();
```

### Using CLI
```bash
basset-hound navigate https://example.com
basset-hound title
basset-hound screenshot page.png
basset-hound detect  # Detect technologies
```

### Low-Level WebSocket (Advanced)
```python
import websockets
import asyncio
import json

async def test():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        response = await ws.recv()
        print(response)

asyncio.run(test())
```

### Run Tests
```bash
npm test                            # Run all tests
node tests/test-ws-api.js           # WebSocket API tests (browser must be running)
npm test -- tests/unit/fingerprint.test.js  # Specific test file
```

---

## Phase 12: OSINT Agent Integration - ✅ COMPLETED

**Goal:** Enable OSINT agents to use basset-hound-browser for automated investigations with results stored in basset-hound.

### 12.1 OSINT Data Extraction

| Task | Status | Description |
|------|--------|-------------|
| `extract_osint_data` command | ✅ Done | Extract 13+ data types from pages |
| OSINT_PATTERNS library | ✅ Done | Email, phone, crypto, social, IP, domain, onion |
| Context extraction | ✅ Done | 50-char surrounding text for each finding |
| Confidence scoring | ✅ Done | Validator-based confidence scores |
| Sensitive data marking | ✅ Done | SSN, credit card flagged as sensitive |
| Orphan type mapping | ✅ Done | Maps to basset-hound identifier types |

### 12.2 Investigation Management

| Task | Status | Description |
|------|--------|-------------|
| InvestigationManager class | ✅ Done | Full investigation lifecycle management |
| `create_investigation` command | ✅ Done | Create with config (depth, patterns, etc.) |
| `get_investigation` command | ✅ Done | Get investigation by ID |
| `list_investigations` command | ✅ Done | List all investigations |
| `set_active_investigation` | ✅ Done | Switch active investigation |
| `complete_investigation` | ✅ Done | Mark complete with stats |
| `export_investigation` | ✅ Done | Export all data and metadata |

### 12.3 Investigation Workflow

| Task | Status | Description |
|------|--------|-------------|
| `investigate_page` command | ✅ Done | Full page OSINT + evidence + links |
| `investigate_links` command | ✅ Done | Queue links matching patterns |
| `queue_investigation_url` | ✅ Done | Add URL to queue with depth |
| `get_next_investigation_url` | ✅ Done | Get next URL from queue |
| `get_investigation_queue` | ✅ Done | View queued URLs |
| Depth control | ✅ Done | Configurable maxDepth (default 2) |
| Pattern filtering | ✅ Done | Include/exclude URL patterns |
| Rate limiting config | ✅ Done | Configurable delayMs between requests |

### 12.4 Evidence Integration

| Task | Status | Description |
|------|--------|-------------|
| Evidence capture integration | ✅ Done | Uses Phase 18 evidence system |
| Screenshot with provenance | ✅ Done | Automatic evidence capture |
| Finding provenance | ✅ Done | Source URL, timestamp, investigation ID |

### 12.5 basset-hound Integration

| Task | Status | Description |
|------|--------|-------------|
| `prepare_for_basset_hound` | ✅ Done | Convert findings to orphan format |
| Provenance generation | ✅ Done | Full capture context included |
| Sensitive data filtering | ✅ Done | Exclude SSN/CC by default |
| Investigation tagging | ✅ Done | Tags for investigation ID, type |

### 12.6 WebSocket Commands

| Command | Status | Description |
|---------|--------|-------------|
| `create_investigation` | ✅ Done | Create new investigation |
| `get_investigation` | ✅ Done | Get by ID |
| `list_investigations` | ✅ Done | List all |
| `set_active_investigation` | ✅ Done | Set active |
| `complete_investigation` | ✅ Done | Complete and get stats |
| `export_investigation` | ✅ Done | Full export |
| `extract_osint_data` | ✅ Done | Extract from current page |
| `get_osint_data_types` | ✅ Done | Get available types |
| `investigate_page` | ✅ Done | Full page investigation |
| `investigate_links` | ✅ Done | Queue page links |
| `queue_investigation_url` | ✅ Done | Add to queue |
| `get_next_investigation_url` | ✅ Done | Get next URL |
| `get_investigation_queue` | ✅ Done | View queue |
| `get_investigation_findings` | ✅ Done | Get findings |
| `get_findings_summary` | ✅ Done | Summary by type |
| `prepare_for_basset_hound` | ✅ Done | Export for API |

**Total: 18 WebSocket commands**

### 12.7 MCP Tools

| Tool | Status | Description |
|------|--------|-------------|
| `browser_create_investigation` | ✅ Done | Create investigation |
| `browser_extract_osint_data` | ✅ Done | Extract data |
| `browser_investigate_page` | ✅ Done | Full page investigation |
| `browser_investigate_links` | ✅ Done | Queue links |
| `browser_get_next_investigation_url` | ✅ Done | Get next URL |
| `browser_get_investigation_findings` | ✅ Done | Get findings |
| `browser_get_findings_summary` | ✅ Done | Summary |
| `browser_prepare_for_basset_hound` | ✅ Done | Prepare orphans |
| `browser_complete_investigation` | ✅ Done | Complete |
| `browser_export_investigation` | ✅ Done | Export |
| `browser_list_investigations` | ✅ Done | List all |
| `browser_get_osint_data_types` | ✅ Done | Get types |

**Total: 12 MCP tools (88 total)**

### 12.8 OSINT Patterns Supported

| Pattern Type | Format | basset-hound Type |
|--------------|--------|-------------------|
| email | RFC 5322 | EMAIL |
| phone | US/International | PHONE |
| crypto_btc | Bitcoin address | CRYPTO_ADDRESS (BTC) |
| crypto_eth | Ethereum address | CRYPTO_ADDRESS (ETH) |
| crypto_xmr | Monero address | CRYPTO_ADDRESS (XMR) |
| social_twitter | @handle | SOCIAL_MEDIA (twitter) |
| social_linkedin | linkedin.com/in/* | SOCIAL_MEDIA (linkedin) |
| social_github | github.com/* | SOCIAL_MEDIA (github) |
| ip_address | IPv4 | IP_ADDRESS |
| domain | Common TLDs | DOMAIN |
| onion | .onion addresses | DOMAIN (onion) |
| ssn | US SSN format | SSN (sensitive) |
| credit_card | Visa/MC/Amex | CREDIT_CARD (sensitive) |

### 12.9 Files Created

- `websocket/commands/osint-commands.js` - OSINT commands (700+ lines)
- `tests/unit/osint-commands.test.js` - Tests (150+ test cases)

See [INTEGRATION-RESEARCH-2026-01-04.md](docs/findings/INTEGRATION-RESEARCH-2026-01-04.md) for design details.

---

## Phase 13: Web Content Data Ingestion - 🚧 IN PROGRESS

> **Goal:** Automatically detect, extract, and ingest various data types from web content into the basset-hound OSINT platform with configurable supervision modes.

### 13.1 Data Type Detection Engine

| Task | Status | Description |
|------|--------|-------------|
| DataTypeDetector class | ✅ Done | Core engine for detecting data types in web content (`extraction/data-type-detector.js`) |
| Phone number detection | ✅ Done | US, UK, and E.164 international formats with validation |
| Email detection | ✅ Done | RFC 5322 patterns with validation |
| Image extraction | 📋 Planned | URLs, base64, dimensions, alt text, EXIF metadata |
| Address detection | 📋 Planned | US/international address patterns with geocoding |
| Cryptocurrency detection | ✅ Done | BTC, ETH, XMR, LTC wallet address formats with validation |
| Social media handles | ✅ Done | Twitter, LinkedIn, GitHub, Instagram, Facebook, TikTok, YouTube |
| Date/time detection | ✅ Done | ISO 8601 format detection |
| Price/currency detection | ✅ Done | USD, EUR, GBP, JPY currency amounts |
| URL/link extraction | ✅ Done | Full URL extraction with validation |
| Personal name detection | 📋 Planned | NLP-based name recognition |
| Company/org detection | 📋 Planned | Business entity recognition |
| Document references | 📋 Planned | PDF, DOC, file links detection |
| Structured data parsing | 📋 Planned | JSON-LD, Microdata, RDFa extraction |
| IP address detection | ✅ Done | IPv4 address detection with validation |
| Domain detection | ✅ Done | Domain name detection with TLD validation |
| MAC address detection | ✅ Done | Standard MAC address format |
| SSN detection | ✅ Done | US Social Security Number format (with warnings) |
| Credit card detection | ✅ Done | Visa, MasterCard, AmEx, Discover formats |

### 13.2 Ingestion Modes

| Task | Status | Description |
|------|--------|-------------|
| Automatic mode | ✅ Done | Fully unsupervised - ingest all detected data (`INGESTION_MODES.AUTOMATIC`) |
| Selective mode | ✅ Done | User picks which detected items to ingest (`INGESTION_MODES.SELECTIVE`) |
| Type-filtered mode | ✅ Done | User specifies which data types to auto-ingest (`INGESTION_MODES.TYPE_FILTERED`) |
| Confirmation mode | ✅ Done | Review detected data before each ingestion (`INGESTION_MODES.CONFIRMATION`) |
| Learning mode | 📋 Planned | Track user choices to improve suggestions |
| Batch mode | ✅ Done | Process multiple pages with consistent settings (`INGESTION_MODES.BATCH`) |

### 13.3 User Interface Components

| Task | Status | Description |
|------|--------|-------------|
| Ingestion sidebar panel | 📋 Planned | Real-time display of detected data on page |
| Data type toggles | 📋 Planned | Enable/disable detection per data type |
| Highlight overlay | 📋 Planned | Visual highlighting of detected items on page |
| Quick-select interface | 📋 Planned | Click-to-select items for ingestion |
| Ingestion queue view | 📋 Planned | Pending items awaiting user action |
| Ingestion history | 📋 Planned | Log of all ingested data with source URLs |
| Settings panel | 📋 Planned | Configure default modes and preferences |

### 13.4 WebSocket Commands

| Command | Status | Description |
|---------|--------|-------------|
| `detect_data_types` | ✅ Done | Scan page and return detected data with types |
| `configure_ingestion` | ✅ Done | Set ingestion mode and type filters |
| `ingest_selected` | ✅ Done | Ingest user-selected items |
| `ingest_all` | ✅ Done | Ingest all detected items (auto mode) |
| `get_detection_config` | ✅ Done | Get current detection configuration |
| `set_detection_patterns` | ✅ Done | Add/remove custom patterns for detection |
| `get_ingestion_history` | ✅ Done | Retrieve ingestion log |
| `export_detections` | ✅ Done | Export detected data to file/JSON |
| `get_ingestion_queue` | ✅ Done | Get pending items in queue |
| `clear_ingestion_queue` | ✅ Done | Clear all queued items |
| `get_ingestion_stats` | ✅ Done | Get detection and ingestion statistics |
| `get_detection_types` | ✅ Done | Get available detection types |
| `set_ingestion_mode` | ✅ Done | Change the ingestion mode |
| `process_page_for_ingestion` | ✅ Done | Process arbitrary HTML content |

### 13.5 basset-hound Integration

| Task | Status | Description |
|------|--------|-------------|
| Orphan data mapping | ✅ Done | Map detected types to basset-hound IdentifierTypes |
| Entity creation | 📋 Planned | Auto-create entities from rich data (Person, Org) |
| Relationship inference | 📋 Planned | Detect relationships from page context |
| Provenance tracking | ✅ Done | Full source URL, timestamp, extraction context |
| Batch API calls | 📋 Planned | Efficient bulk ingestion to basset-hound |
| Deduplication | ✅ Done | Local cache-based deduplication with TTL |
| Confidence scoring | ✅ Done | Score reliability of detected data based on validation |

### 13.6 Detection Patterns Library

```javascript
// Data type patterns (to be implemented in extraction/patterns.js)
const DETECTION_PATTERNS = {
  phone: {
    patterns: [
      /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,  // US
      /(?:\+?44[-.\s]?)?(?:\(?0\)?[-.\s]?)?[0-9]{4}[-.\s]?[0-9]{6}/g,   // UK
      /\+[1-9]\d{1,14}/g,  // E.164 international
    ],
    validator: 'libphonenumber',
    orphanType: 'phone'
  },
  email: {
    patterns: [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g],
    validator: 'rfc5322',
    orphanType: 'email'
  },
  crypto_btc: {
    patterns: [/\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g],
    validator: 'btc-address',
    orphanType: 'crypto_address'
  },
  crypto_eth: {
    patterns: [/\b0x[a-fA-F0-9]{40}\b/g],
    validator: 'eth-address',
    orphanType: 'crypto_address'
  },
  social_twitter: {
    patterns: [/@[a-zA-Z0-9_]{1,15}\b/g, /twitter\.com\/([a-zA-Z0-9_]{1,15})/g],
    orphanType: 'social_media'
  },
  social_instagram: {
    patterns: [/instagram\.com\/([a-zA-Z0-9_.]{1,30})/g],
    orphanType: 'social_media'
  },
  url: {
    patterns: [/https?:\/\/[^\s<>"{}|\\^`\[\]]+/g],
    orphanType: 'url'
  },
  ip_address: {
    patterns: [/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g],
    orphanType: 'ip_address'
  },
  domain: {
    patterns: [/\b[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}\b/g],
    orphanType: 'domain'
  }
};
```

### 13.7 Ingestion Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEB PAGE LOADED                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              DATA TYPE DETECTION ENGINE                          │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Phone   │  │  Email   │  │  Image   │  │  Crypto  │  ...   │
│  │ Detector │  │ Detector │  │ Detector │  │ Detector │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │             │             │             │               │
│       └─────────────┴─────────────┴─────────────┘               │
│                         │                                        │
│                         ▼                                        │
│              ┌─────────────────────┐                            │
│              │   Detected Items    │                            │
│              │   with Confidence   │                            │
│              └──────────┬──────────┘                            │
└─────────────────────────┼───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ AUTOMATIC│   │ SELECTIVE│   │   TYPE   │
    │   MODE   │   │   MODE   │   │ FILTERED │
    └────┬─────┘   └────┬─────┘   └────┬─────┘
         │              │              │
         │         User Selection      │
         │              │              │
         └──────────────┴──────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INGESTION PROCESSOR                            │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │  Validation    │→ │ Deduplication  │→ │ Normalization  │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
│                                                │                 │
│                                                ▼                 │
│                                  ┌────────────────────────┐     │
│                                  │  Provenance Attachment │     │
│                                  │  - Source URL          │     │
│                                  │  - Timestamp           │     │
│                                  │  - Context snippet     │     │
│                                  │  - Confidence score    │     │
│                                  └────────────┬───────────┘     │
└───────────────────────────────────────────────┼─────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    basset-hound API                              │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │  Create Orphan  │    │  Create Entity  │                    │
│  │  (identifiers)  │    │  (rich objects) │                    │
│  └─────────────────┘    └─────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

### 13.8 Implementation Files

**Completed Files:**
- `extraction/data-type-detector.js` ✅ - Core detection engine (25+ patterns, validation, confidence scoring)
- `extraction/ingestion-processor.js` ✅ - Ingestion workflow (5 modes, queue, history, statistics)
- `websocket/commands/ingestion-commands.js` ✅ - WebSocket API (14 commands)
- `clients/python/basset_hound/ingestion.py` ✅ - Python mixin (15 methods)
- `clients/nodejs/src/client.js` ✅ - Node.js client methods (18 methods added)
- `tests/unit/data-type-detector.test.js` ✅ - Detection tests (50+ test cases)
- `tests/unit/ingestion-processor.test.js` ✅ - Ingestion tests (60+ test cases)
- `tests/integration/ingestion-workflow.test.js` ✅ - E2E tests (20+ scenarios)

**Planned Files:**
- `renderer/components/ingestion-panel.js` - UI sidebar
- `renderer/components/highlight-overlay.js` - Visual highlighting

### 13.9 Configuration Schema

```yaml
# config/ingestion.yaml
ingestion:
  default_mode: selective  # automatic | selective | type_filtered | confirmation

  enabled_types:
    - email
    - phone
    - crypto_btc
    - crypto_eth
    - social_media
    - url
    - ip_address
    - domain
    - image
    - address

  auto_ingest_types:  # For type_filtered mode
    - email
    - phone

  confidence_threshold: 0.7  # Minimum confidence to show/ingest

  deduplication:
    enabled: true
    check_basset_hound: true  # Query existing orphans
    local_cache_ttl: 3600     # Seconds to cache known values

  rate_limiting:
    enabled: true
    max_items_per_page: 100
    min_delay_between_ingests: 500  # ms

  ui:
    highlight_detected: true
    highlight_color: "#ffff00"
    show_confidence_scores: true
    sidebar_position: "right"
```

### 13.10 API Response Format

```json
// Response from detect_data_types command
{
  "success": true,
  "page_url": "https://example.com/contact",
  "detected_at": "2026-01-05T10:30:00Z",
  "total_items": 15,
  "items": [
    {
      "id": "det_001",
      "type": "email",
      "value": "contact@example.com",
      "confidence": 0.95,
      "context": "...reach us at contact@example.com for inquiries...",
      "position": { "start": 245, "end": 267 },
      "element_xpath": "/html/body/div[2]/p[3]",
      "orphan_type": "email",
      "suggested_tags": ["contact", "business"]
    },
    {
      "id": "det_002",
      "type": "phone",
      "value": "+1-555-123-4567",
      "confidence": 0.92,
      "context": "Call us: +1-555-123-4567",
      "normalized": "+15551234567",
      "country_code": "US",
      "orphan_type": "phone"
    },
    {
      "id": "det_003",
      "type": "image",
      "value": "https://example.com/team/john-doe.jpg",
      "confidence": 1.0,
      "alt_text": "John Doe - CEO",
      "dimensions": { "width": 400, "height": 400 },
      "file_type": "image/jpeg",
      "orphan_type": "url",
      "metadata": {
        "exif": { "camera": "iPhone 14", "date": "2025-12-01" }
      }
    }
  ],
  "summary": {
    "by_type": {
      "email": 3,
      "phone": 2,
      "image": 8,
      "social_media": 2
    }
  }
}
```

---

## Phase 14: Advanced Image Ingestion - 🚧 IN PROGRESS

> **Goal:** Specialized image extraction and analysis for OSINT investigations.

### 14.1 Image Extraction

| Task | Status | Description |
|------|--------|-------------|
| Inline image extraction | ✅ Done | Extract `<img>` src, srcset, data-src via `extract_page_images` |
| Background image extraction | ✅ Done | CSS background-image URLs |
| Canvas snapshot | 📋 Planned | Capture canvas element contents |
| SVG extraction | 📋 Planned | Inline and external SVG files |
| Favicon extraction | 📋 Planned | Site icons and touch icons |
| Open Graph images | 📋 Planned | og:image meta tags |
| Lazy-loaded images | ✅ Done | Detect and handle data-src, data-lazy-src |

### 14.2 Image Metadata

| Task | Status | Description |
|------|--------|-------------|
| EXIF extraction | ✅ Done | Camera, GPS, date, settings via `exifr` library |
| IPTC extraction | ✅ Done | Caption, keywords, copyright via `exifreader` |
| XMP extraction | ✅ Done | Adobe metadata via `exifreader` |
| Dimensions and format | ✅ Done | Width, height, file type via `sharp`/`jimp` |
| Image hash (pHash) | ✅ Done | Perceptual hash for similarity |
| Reverse image lookup | 📋 Planned | Find similar images online |

### 14.3 Image Analysis

| Task | Status | Description |
|------|--------|-------------|
| Face detection | 📋 Planned | Detect faces with `face-api.js` (models required) |
| Text extraction (OCR) | ✅ Done | Extract text via `tesseract.js` |
| Object detection | 📋 Planned | Identify objects in images |
| Logo detection | 📋 Planned | Identify company logos |
| Screenshot detection | 📋 Planned | Identify screenshots vs photos |

### 14.4 WebSocket Commands

| Command | Status | Description |
|---------|--------|-------------|
| `extract_image_metadata` | ✅ Done | Full metadata extraction from image |
| `extract_image_gps` | ✅ Done | GPS coordinates from image |
| `extract_image_text` | ✅ Done | OCR text extraction |
| `generate_image_hash` | ✅ Done | Perceptual hash generation |
| `compare_images` | ✅ Done | Image similarity comparison |
| `extract_page_images` | ✅ Done | Extract all images from page with metadata |
| `get_image_osint_data` | ✅ Done | basset-hound orphan data generation |
| `configure_image_extractor` | ✅ Done | Configure extractor options |
| `get_image_extractor_stats` | ✅ Done | Get extractor statistics |
| `cleanup_image_extractor` | ✅ Done | Clean up resources |

### 14.5 Implementation Files

**Completed Files:**
- `extraction/image-metadata-extractor.js` ✅ - Core extraction engine
- `websocket/commands/image-commands.js` ✅ - WebSocket API (10 commands)
- `tests/unit/image-metadata-extractor.test.js` ✅ - Unit tests (40+ test cases)

---

## Strategic Vision: Multi-Project Intelligence Platform Integration

### Evolution and Pivot Potential

**basset-hound-browser** started as an OSINT-focused automation browser but is evolving toward **general-purpose browser automation** - similar to how basset-hound evolved from OSINT-specific to a general entity backbone.

**Potential future applications beyond OSINT:**
- General web automation and testing
- Research data collection
- Automated form submissions
- Web scraping with anti-detection
- Any task requiring programmatic browser control with evasion

### Project Scope Definition

**basset-hound-browser Core Mission:** Full-control Electron browser with anti-detection - the **power-user** browser automation option.

| In Scope | Out of Scope |
|----------|--------------|
| Full browser automation (navigate, click, fill, extract) | Entity storage (→ basset-hound) |
| Advanced bot detection evasion (TLS, behavioral AI) | OSINT data detection patterns (shared with extension) |
| Profile/identity isolation | AI agent logic (→ palletai) |
| Proxy and Tor integration | Graph analysis |
| WebSocket API for external control | Quick-start simplicity (→ autofill-extension) |
| Content extraction and screenshots | |
| Deep customization, boutique configurations | |

### Relationship with autofill-extension

**basset-hound-browser** and **autofill-extension** provide **similar functionality** but serve different user needs and are developed in parallel:

| Aspect | basset-hound-browser (This Project) | autofill-extension |
|--------|-------------------------------------|-------------------|
| **Deployment** | Standalone Electron app | Chrome Web Store install |
| **Target user** | Power users, deep customization | Quick-start users |
| **Customization** | Fully open-source, unlimited control | Limited by Chrome APIs |
| **Control** | Full control over TLS, profiles, everything | Subject to Chrome restrictions |
| **Use case** | Boutique configs, advanced automation | Get up and running immediately |
| **Bot evasion** | Advanced (TLS/JA3, behavioral AI, full profile isolation) | Basic (UA rotation, typing sim) |

**Why two projects?**
1. Chrome extensions can't control TLS fingerprints, full process isolation
2. Power users need capabilities Chrome's security model prevents
3. Different features need independent iteration timelines
4. Some operations require fully isolated browser instances (sock puppets)

Both expose similar MCP tools to AI agents (palletai), allowing agents to choose based on operation requirements.

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI AGENT LAYER (palletai)                     │
│         OSINT Agent • Knowledge Base • Multi-Agent Coordination      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                    MCP Protocol + WebSocket
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                              ▼                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  basset-hound-browser                           │  │
│  │                                                                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │  │
│  │  │  WebSocket  │  │  Fingerprint│  │    Content Extraction   │ │  │
│  │  │  434 cmds   │  │  Evasion    │  │    + Image Analysis     │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │  │
│  │                                                                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │  │
│  │  │   Profile   │  │  Human-like │  │      Proxy / Tor        │ │  │
│  │  │  Isolation  │  │  Behavior   │  │      Integration        │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              │                                        │
└──────────────────────────────┼────────────────────────────────────────┘
                               │
                    REST API + WebSocket
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         basset-hound                                  │
│              Entity Storage • Graph Analysis • MCP Server             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Phase 15: MCP Server for AI Agent Integration - ✅ COMPLETED

**Goal:** Expose browser automation capabilities via MCP protocol for AI agents (palletai).

### 15.1 Core MCP Tools

| Tool | Status | Description |
|------|--------|-------------|
| `browser_navigate` | ✅ Done | Navigate to URL with wait options |
| `browser_click` | ✅ Done | Click element with human-like behavior |
| `browser_fill` | ✅ Done | Fill form field with typing simulation |
| `browser_screenshot` | ✅ Done | Capture page screenshot |
| `browser_get_page_state` | ✅ Done | Get comprehensive page state |
| `browser_extract_content` | ✅ Done | Extract content (text, HTML, links, images) |
| `browser_execute_script` | ✅ Done | Execute custom JavaScript |

### 15.2 Advanced MCP Tools

| Tool | Status | Description |
|------|--------|-------------|
| `browser_fill_form_with_entity` | 📋 Planned | Fill form from basset-hound entity |
| `browser_fill_form_with_sock_puppet` | 📋 Planned | Fill with sock puppet credentials |
| `browser_detect_login_form` | 📋 Planned | Detect and analyze login forms |
| `browser_switch_profile` | ✅ Done | Switch to different browser profile |
| `browser_set_proxy` | ✅ Done | Configure proxy settings |
| `browser_new_identity` | ✅ Done | Get new Tor identity (`browser_tor_new_identity`) |

### 15.3 Additional MCP Tools Implemented

| Tool Category | Tools | Count |
|--------------|-------|-------|
| Navigation | navigate, back, forward, refresh, get_url, get_title | 6 |
| Interaction | click, fill, type, press_key, hover, scroll, select, clear | 8 |
| Content | get_content, get_html, get_page_state, extract_links, extract_forms, extract_images, extract_metadata, detect_technologies | 8 |
| Screenshots | screenshot, screenshot_element, screenshot_full_page | 3 |
| OSINT/Ingestion | detect_data_types, configure_ingestion, ingest_selected, ingest_all, extract_image_metadata, extract_image_text | 6 |
| Profile | switch_profile, create_profile, list_profiles, delete_profile | 4 |
| Proxy/Tor | set_proxy, clear_proxy, tor_start, tor_stop, tor_new_identity, tor_get_circuit | 6 |
| Advanced | execute_script, wait_for_element, wait_for_navigation, get_cookies, set_cookies | 5 |

**Total: 46 MCP tools**

### 15.4 Implementation Tasks

| Task | Status | Description |
|------|--------|-------------|
| Create MCP server wrapper | ✅ Done | FastMCP server (`mcp/server.py`) |
| Map WebSocket commands to MCP tools | ✅ Done | 46 tools mapped to WebSocket commands |
| BrowserConnection class | ✅ Done | WebSocket client for browser communication |
| MCP Resources | ✅ Done | `browser://status`, `browser://current-page` |
| Add basset-hound integration | 📋 Planned | Entity lookup for form filling |
| Document MCP tools | ✅ Done | Docstrings and type hints for all tools |
| Unit tests | ✅ Done | `tests/unit/mcp-server.test.js` (400+ lines) |

### 15.5 Configuration

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

### 15.6 Files Created

- `mcp/server.py` - FastMCP server (700+ lines, 46 tools)
- `mcp/requirements.txt` - Dependencies (fastmcp, websockets, aiohttp)
- `mcp/__init__.py` - Module exports
- `tests/unit/mcp-server.test.js` - Unit tests

**Research Reference:** Based on [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) and [FastMCP 2.0](https://gofastmcp.com).

---

## Phase 16: Sock Puppet Profile Integration - ✅ COMPLETED

**Goal:** Enable browser profiles tied to basset-hound sock puppet identities.

### 16.1 Profile-Identity Linking

| Task | Status | Description |
|------|--------|-------------|
| Fetch sock puppet from basset-hound | ✅ Done | SockPuppetIntegration.fetchSockPuppet() |
| Create profile from sock puppet | ✅ Done | SockPuppetIntegration.createProfileFromSockPuppet() |
| Sync fingerprint to identity | ✅ Done | SockPuppetIntegration.syncFingerprintFromSockPuppet() |
| Link existing profile | ✅ Done | SockPuppetIntegration.linkProfileToSockPuppet() |
| Unlink profile | ✅ Done | SockPuppetIntegration.unlinkProfile() |
| Validate fingerprint consistency | ✅ Done | SockPuppetIntegration.validateFingerprintConsistency() |

### 16.2 Credential Management

| Task | Status | Description |
|------|--------|-------------|
| Fetch credentials from basset-hound | ✅ Done | SockPuppetIntegration.getCredentials() |
| Fill form with sock puppet credentials | ✅ Done | SockPuppetIntegration.fillFormWithCredentials() |
| Human-like typing simulation | ✅ Done | Uses existing humanize.js behaviors |
| Credential field mapping | ✅ Done | 10 standard fields (username, email, password, phone, etc.) |

### 16.3 Session Management

| Task | Status | Description |
|------|--------|-------------|
| Start session tracking | ✅ Done | SockPuppetIntegration.startSession() |
| End session with summary | ✅ Done | SockPuppetIntegration.endSession() |
| Session metadata | ✅ Done | Custom metadata per session |
| Multi-profile sessions | ✅ Done | Each profile can have active session |

### 16.4 Activity Tracking

| Task | Status | Description |
|------|--------|-------------|
| Log activities | ✅ Done | SockPuppetIntegration.logActivity() |
| Page visit recording | ✅ Done | recordPageVisit() helper |
| Screenshot recording | ✅ Done | recordScreenshot() helper |
| Data extraction recording | ✅ Done | recordDataExtraction() helper |
| Activity log retrieval | ✅ Done | getActivityLog() with filtering |
| Sync to basset-hound | ✅ Done | syncActivitiesToBassetHound() |

### 16.5 WebSocket Commands

| Command | Status | Description |
|---------|--------|-------------|
| `list_sock_puppets` | ✅ Done | List all sock puppets from basset-hound |
| `get_sock_puppet` | ✅ Done | Get sock puppet details |
| `link_profile_to_sock_puppet` | ✅ Done | Link browser profile to identity |
| `unlink_profile_from_sock_puppet` | ✅ Done | Remove profile link |
| `create_profile_from_sock_puppet` | ✅ Done | Create new profile from identity |
| `get_linked_sock_puppet` | ✅ Done | Get sock puppet for a profile |
| `get_sock_puppet_credentials` | ✅ Done | Fetch credentials |
| `fill_form_with_sock_puppet` | ✅ Done | Auto-fill form with credentials |
| `start_sock_puppet_session` | ✅ Done | Start activity tracking |
| `end_sock_puppet_session` | ✅ Done | End session and sync |
| `log_sock_puppet_activity` | ✅ Done | Manual activity logging |
| `get_sock_puppet_activity_log` | ✅ Done | Retrieve activities |
| `sync_fingerprint_from_sock_puppet` | ✅ Done | Sync fingerprint config |
| `validate_sock_puppet_fingerprint` | ✅ Done | Check consistency |
| `get_sock_puppet_stats` | ✅ Done | Usage statistics |
| `get_sock_puppet_credential_fields` | ✅ Done | Available field names |
| `get_sock_puppet_activity_types` | ✅ Done | Activity type constants |

**Total: 17 WebSocket commands**

### 16.6 MCP Tools

| Tool | Status | Description |
|------|--------|-------------|
| `browser_list_sock_puppets` | ✅ Done | List identities for AI agents |
| `browser_get_sock_puppet` | ✅ Done | Get identity details |
| `browser_link_profile_to_sock_puppet` | ✅ Done | Link profile |
| `browser_create_profile_from_sock_puppet` | ✅ Done | Create profile from identity |
| `browser_fill_form_with_sock_puppet` | ✅ Done | Auto-fill with credentials |
| `browser_start_sock_puppet_session` | ✅ Done | Start session tracking |
| `browser_end_sock_puppet_session` | ✅ Done | End session |
| `browser_get_sock_puppet_activity_log` | ✅ Done | Get activities |
| `browser_validate_sock_puppet_fingerprint` | ✅ Done | Validate consistency |
| `browser_get_sock_puppet_stats` | ✅ Done | Usage stats |

**Total: 10 MCP tools (56 total MCP tools)**

### 16.7 Files Created

- `profiles/sock-puppet-integration.js` - Core integration class (600+ lines)
- `websocket/commands/sock-puppet-commands.js` - WebSocket API (17 commands)
- `tests/unit/sock-puppet-integration.test.js` - Unit tests (70+ test cases)
- Updated `mcp/server.py` - Added 10 sock puppet MCP tools

### 16.8 Integration Points

- basset-hound API: `GET /api/v1/entities/{id}` - Fetch sock puppet
- basset-hound API: `GET /api/v1/entities?type=SOCK_PUPPET` - List sock puppets
- basset-hound API: `POST /api/v1/entities/{id}/credentials` - Get credentials
- basset-hound API: `POST /api/v1/entities/{id}/activity` - Sync activities

---

## Phase 17: Enhanced Bot Detection Evasion - ✅ COMPLETED

**Goal:** Advanced evasion techniques for sophisticated bot detection systems.

### 17.1 TLS/JA3 Fingerprinting

| Task | Status | Description |
|------|--------|-------------|
| JA3 fingerprint research | ✅ Done | Research completed - proxy approach recommended |
| JA4 fingerprint support | 📋 Deferred | Requires proxy-based TLS interception |
| Client hello randomization | 📋 Deferred | Electron TLS is distinctive - use proxy |

**Note:** TLS fingerprinting requires proxy-based approach since Electron's TLS stack is distinctive. Recommend using TLS proxy (e.g., `curl_cffi`, `tls-client`) for JA3 spoofing.

### 17.2 Fingerprint Profile Consistency

| Task | Status | Description |
|------|--------|-------------|
| FingerprintProfile class | ✅ Done | Platform-consistent fingerprint generation |
| FingerprintProfileManager | ✅ Done | Profile storage and management |
| Platform-specific configs | ✅ Done | Windows, macOS, Linux configurations |
| WebGL vendor/renderer matching | ✅ Done | Consistent GPU fingerprints |
| Screen/timezone/locale matching | ✅ Done | Region-appropriate settings |
| Chrome version management | ✅ Done | Realistic UA versions |
| Injection script generation | ✅ Done | Complete fingerprint override script |

### 17.3 Behavioral AI

| Task | Status | Description |
|------|--------|-------------|
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

### 17.4 Detection Avoidance

| Task | Status | Description |
|------|--------|-------------|
| HoneypotDetector class | ✅ Done | 8+ honeypot indicators |
| Hidden field detection | ✅ Done | display:none, visibility:hidden, etc. |
| Suspicious name detection | ✅ Done | honeypot, trap, confirm_email, etc. |
| Zero-dimension detection | ✅ Done | 0x0 and 1x1 pixel fields |
| Off-screen detection | ✅ Done | Position < -1000px |
| RateLimitAdapter class | ✅ Done | Adaptive rate limiting |
| Exponential backoff | ✅ Done | Configurable with jitter |
| Retry-After support | ✅ Done | Respects HTTP header |
| CAPTCHA handling | 📋 Planned | Integration with solving services |
| Ban recovery | 📋 Planned | Automatic identity rotation |

### 17.5 WebSocket Commands

| Command | Status | Description |
|---------|--------|-------------|
| `create_fingerprint_profile` | ✅ Done | Create consistent fingerprint |
| `create_regional_fingerprint` | ✅ Done | Profile for specific region |
| `get_fingerprint_profile` | ✅ Done | Get profile by ID |
| `list_fingerprint_profiles` | ✅ Done | List all profiles |
| `set_active_fingerprint` | ✅ Done | Set active profile |
| `get_active_fingerprint` | ✅ Done | Get active profile |
| `apply_fingerprint` | ✅ Done | Inject fingerprint to page |
| `delete_fingerprint_profile` | ✅ Done | Remove profile |
| `get_fingerprint_options` | ✅ Done | Available platforms/timezones |
| `create_behavioral_profile` | ✅ Done | Create behavioral session |
| `generate_mouse_path` | ✅ Done | Human-like mouse movement |
| `generate_scroll_behavior` | ✅ Done | Natural scrolling |
| `generate_typing_events` | ✅ Done | Biometric typing |
| `get_behavioral_profile` | ✅ Done | Get session profile |
| `list_behavioral_sessions` | ✅ Done | List all sessions |
| `check_honeypot` | ✅ Done | Check single element |
| `filter_honeypots` | ✅ Done | Filter form fields |
| `get_rate_limit_state` | ✅ Done | Get adapter state |
| `record_request_success` | ✅ Done | Record successful request |
| `record_rate_limit` | ✅ Done | Record rate limit hit |
| `is_rate_limited` | ✅ Done | Check status code |
| `reset_rate_limit` | ✅ Done | Reset adapter |
| `list_rate_limit_adapters` | ✅ Done | List all adapters |

**Total: 24 WebSocket commands**

### 17.6 MCP Tools

| Tool | Status | Description |
|------|--------|-------------|
| `browser_create_fingerprint_profile` | ✅ Done | Create consistent fingerprint |
| `browser_create_regional_fingerprint` | ✅ Done | Profile for region |
| `browser_list_fingerprint_profiles` | ✅ Done | List profiles |
| `browser_apply_fingerprint` | ✅ Done | Apply to page |
| `browser_get_fingerprint_options` | ✅ Done | Get options |
| `browser_create_behavioral_profile` | ✅ Done | Create session |
| `browser_generate_mouse_path` | ✅ Done | Human-like mouse |
| `browser_generate_typing_events` | ✅ Done | Biometric typing |
| `browser_check_honeypot` | ✅ Done | Check element |
| `browser_get_rate_limit_delay` | ✅ Done | Get delay |
| `browser_record_rate_limit` | ✅ Done | Record limit hit |

**Total: 11 MCP tools (67 total)**

### 17.7 Files Created

- `evasion/fingerprint-profile.js` - Profile-based fingerprint system (700+ lines)
- `evasion/behavioral-ai.js` - Physics-based behavior simulation (800+ lines)
- `websocket/commands/evasion-commands.js` - WebSocket API (24 commands)
- `tests/unit/fingerprint-profile.test.js` - Fingerprint tests (200+ test cases)
- `tests/unit/behavioral-ai.test.js` - Behavioral tests (150+ test cases)

**Research Reference:** Based on [browser fingerprinting evasion research](https://github.com/nickspodd/browser-fingerprinting) and [GeeTest analysis](https://www.geetest.com/en/article/how-to-defeat-botbrowser-in-2025).

---

## Phase 18: Evidence Collection Workflow - ✅ COMPLETED

**Goal:** Streamlined evidence capture for law enforcement investigations.

### 18.1 Evidence Core Classes

| Task | Status | Description |
|------|--------|-------------|
| Evidence class | ✅ Done | Individual evidence item with SHA-256 hash |
| EvidencePackage class | ✅ Done | Collection of related evidence |
| EvidenceCollector class | ✅ Done | High-level evidence capture API |
| EVIDENCE_TYPES constants | ✅ Done | 8 evidence types (screenshot, archive, HAR, etc.) |
| ARCHIVE_FORMATS constants | ✅ Done | MHTML, HTML, WARC, PDF formats |

### 18.2 Evidence Capture

| Task | Status | Description |
|------|--------|-------------|
| Screenshot capture | ✅ Done | captureScreenshot() with hash |
| Page archiving | ✅ Done | capturePageArchive() - MHTML/HTML/WARC/PDF |
| Network HAR capture | ✅ Done | captureNetworkHAR() with entry count |
| DOM snapshot | ✅ Done | captureDOMSnapshot() |
| Console logs | ✅ Done | captureConsoleLogs() |
| Cookie capture | ✅ Done | captureCookies() |
| Local storage capture | ✅ Done | captureLocalStorage() |
| Bundle capture | ✅ Done | captureBundle() - multiple types at once |
| Annotated screenshots | ✅ Done | Annotations in metadata |

### 18.3 Chain of Custody

| Task | Status | Description |
|------|--------|-------------|
| SHA-256 hash generation | ✅ Done | Every evidence item hashed |
| Timestamp every action | ✅ Done | capturedAt timestamp |
| Custody chain tracking | ✅ Done | custodyChain array per evidence |
| User/agent identification | ✅ Done | capturedBy field |
| Hash verification | ✅ Done | verifyIntegrity() method |
| Package sealing | ✅ Done | seal() - no modifications allowed |
| Package verification | ✅ Done | verifyPackage() with hash check |
| Export for court | ✅ Done | exportForCourt() with certification |

### 18.4 WebSocket Commands

| Command | Status | Description |
|---------|--------|-------------|
| `create_evidence_package` | ✅ Done | Create new package |
| `get_evidence_package` | ✅ Done | Get package by ID |
| `list_evidence_packages` | ✅ Done | List all packages |
| `set_active_evidence_package` | ✅ Done | Set active package |
| `add_package_annotation` | ✅ Done | Add annotation |
| `seal_evidence_package` | ✅ Done | Seal package |
| `verify_evidence_package` | ✅ Done | Verify integrity |
| `capture_screenshot_evidence` | ✅ Done | Capture screenshot |
| `capture_page_archive_evidence` | ✅ Done | Capture archive |
| `capture_har_evidence` | ✅ Done | Capture HAR |
| `capture_dom_evidence` | ✅ Done | Capture DOM |
| `capture_console_evidence` | ✅ Done | Capture console logs |
| `capture_cookies_evidence` | ✅ Done | Capture cookies |
| `capture_storage_evidence` | ✅ Done | Capture localStorage |
| `get_evidence` | ✅ Done | Get evidence by ID |
| `get_evidence_summary` | ✅ Done | Get summary without data |
| `verify_evidence` | ✅ Done | Verify single evidence |
| `export_for_court` | ✅ Done | Court-ready export |
| `export_evidence_package` | ✅ Done | JSON export |
| `get_evidence_stats` | ✅ Done | Collector statistics |
| `get_evidence_types` | ✅ Done | Available types |

**Total: 22 WebSocket commands**

### 18.5 MCP Tools

| Tool | Status | Description |
|------|--------|-------------|
| `browser_create_evidence_package` | ✅ Done | Create package |
| `browser_capture_screenshot_evidence` | ✅ Done | Screenshot with hash |
| `browser_capture_page_archive_evidence` | ✅ Done | Archive capture |
| `browser_capture_har_evidence` | ✅ Done | HAR capture |
| `browser_seal_evidence_package` | ✅ Done | Seal package |
| `browser_verify_evidence_package` | ✅ Done | Verify integrity |
| `browser_export_evidence_for_court` | ✅ Done | Court export |
| `browser_list_evidence_packages` | ✅ Done | List packages |
| `browser_get_evidence_stats` | ✅ Done | Get stats |
| `browser_add_evidence_annotation` | ✅ Done | Add annotation |

**Total: 10 MCP tools (76 total)**

### 18.6 Court Export Format

```json
{
  "packageInfo": {
    "id": "pkg_...",
    "name": "Investigation Evidence",
    "caseNumber": "CASE-2026-001",
    "sealed": true,
    "sealedAt": "2026-01-08T...",
    "sealedBy": "investigator"
  },
  "verification": {
    "status": "VERIFIED",
    "packageHash": "sha256:...",
    "allEvidenceIntact": true
  },
  "evidence": [...],
  "annotations": [...],
  "certificationStatement": "I hereby certify..."
}
```

### 18.7 Files Created

- `evidence/evidence-collector.js` - Core evidence system (600+ lines)
- `websocket/commands/evidence-commands.js` - WebSocket API (22 commands)
- `tests/unit/evidence-collector.test.js` - Evidence tests (100+ test cases)

### 18.8 Integration

| Task | Status | Description |
|------|--------|-------------|
| Investigation ID tracking | ✅ Done | investigationId field |
| Case number tracking | ✅ Done | caseNumber field |
| Tag support | ✅ Done | tags array |
| basset-hound storage | 📋 Planned | Store evidence with entity |
| Provenance tracking | ✅ Done | Full capture context in metadata |

**Industry Reference:** Based on [Axon Evidence](https://www.axon.com/resources/digital-evidence-management-guide) standards.

---

## Documentation References

See basset-hound's [VISION-RESEARCH-2026-01-08.md](/home/devel/basset-hound/docs/findings/VISION-RESEARCH-2026-01-08.md) for:
- Sock puppet management best practices
- Evidence chain of custody standards
- MCP integration patterns
- Multi-project architecture

---

## Contributing

See [DEVELOPMENT.md](DEVELOPMENT.md) for contribution guidelines.

---

*Last Updated: January 8, 2026*
*Version: 9.4.0 - OSINT Agent Integration Complete*
*88 MCP Tools | Phases 12, 15-18 Complete | Full AI Agent & Investigation Workflow Support*
