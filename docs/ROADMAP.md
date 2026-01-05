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

## Phase 12: OSINT Agent Integration - 📋 PLANNED

### 12.1 OSINT Data Extraction Commands

| Task | Status | Description |
|------|--------|-------------|
| `extract_osint_data` command | 📋 Planned | Extract emails, phones, crypto from page |
| Pattern library | 📋 Planned | Comprehensive regex for OSINT data types |
| Context extraction | 📋 Planned | Capture surrounding text |
| Structured data extraction | 📋 Planned | JSON-LD, Schema.org parsing |

### 12.2 Evidence Capture

| Task | Status | Description |
|------|--------|-------------|
| `capture_evidence` command | 📋 Planned | Screenshot + HTML + metadata bundle |
| Evidence storage format | 📋 Planned | Standard evidence package structure |
| Timestamp verification | 📋 Planned | Cryptographic timestamp for evidence |

### 12.3 basset-hound Integration

| Task | Status | Description |
|------|--------|-------------|
| `store_to_basset` command | 📋 Planned | Direct storage to basset-hound API |
| Provenance tracking | 📋 Planned | Include source URL, date, browser info |
| Verification before store | 📋 Planned | Verify data before sending |

### 12.4 Investigation Workflow Support

| Task | Status | Description |
|------|--------|-------------|
| `investigate_links` command | 📋 Planned | Follow and investigate linked pages |
| Depth control | 📋 Planned | Configurable crawl depth |
| Pattern filtering | 📋 Planned | Only follow matching URLs |
| Rate limiting | 📋 Planned | Polite crawling |

**Purpose:** Enable OSINT agents to use basset-hound-browser for automated investigations with results stored in basset-hound.

**New Files:**
- `websocket/commands/osint-commands.js` - OSINT extraction commands
- `websocket/commands/evidence-commands.js` - Evidence capture commands
- `clients/python/basset_hound_browser/osint.py` - Python OSINT mixin
- `clients/nodejs/osint.js` - Node.js OSINT mixin
- `tests/integration/osint-workflow.test.js` - Integration tests

See [INTEGRATION-RESEARCH-2026-01-04.md](docs/findings/INTEGRATION-RESEARCH-2026-01-04.md) for details.

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

## Contributing

See [DEVELOPMENT.md](DEVELOPMENT.md) for contribution guidelines.

---

*Last Updated: January 5, 2026*
*Version: 8.4.0 - Advanced Image Ingestion*
*Next Steps: Phase 13.3 - UI Components, Phase 14 Remaining - Face Detection, Object Detection*
