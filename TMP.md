# Basset Hound Browser - Project Continuity File

> **Purpose**: This file serves as a "session resume" document for future Claude Code conversations working on this project. Read this first when starting a new development session.

---

## 1. Project Overview

**Basset Hound Browser** is an Electron-based browser designed for OSINT (Open Source Intelligence) investigations with comprehensive bot detection evasion capabilities.

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

---

## 2. Current State (December 2024)

### Completed Features

#### Core Electron App
- [x] Main process with comprehensive IPC handlers (`main.js`)
- [x] Preload script with secure context bridge (`preload.js`)
- [x] Renderer with browser UI (`renderer/`)
- [x] WebSocket server for remote control (`websocket/`)

#### Bot Detection Evasion
- [x] Navigator property spoofing (webdriver, plugins, languages, platform)
- [x] WebGL fingerprint randomization (vendor/renderer strings)
- [x] Canvas fingerprint noise injection
- [x] Audio context fingerprint modification
- [x] Timezone spoofing
- [x] Screen resolution spoofing
- [x] User agent rotation (70+ realistic UAs across 10 categories)

#### Human Behavior Simulation
- [x] Bezier curve-based mouse movement paths
- [x] Realistic typing with variable speed and occasional mistakes
- [x] Natural scroll patterns
- [x] Configurable random delays between actions

#### Advanced Features
- [x] Multi-tab management (create, close, switch)
- [x] Profile management with fingerprint spoofing
- [x] Cookie import/export (JSON, Netscape, EditThisCookie formats)
- [x] Download management
- [x] DevTools integration
- [x] Network throttling
- [x] Geolocation spoofing with presets
- [x] Local storage and IndexedDB management
- [x] Custom headers management
- [x] Browsing history storage
- [x] Ad/tracker blocking with EasyList support
- [x] Automation script storage and execution
- [x] DOM inspector with CSS selector generation
- [x] Proxy support (HTTP, HTTPS, SOCKS4, SOCKS5 with rotation)
- [x] Screenshots and recording
- [x] Session persistence

---

## 3. Key Files

### Core Application Files

| File | Description |
|------|-------------|
| `main.js` | Electron main process - window management, IPC handlers, WebSocket server init |
| `preload.js` | Secure IPC bridge with context isolation, evasion script injection |
| `package.json` | Project dependencies and npm scripts |

### Renderer (Browser UI)

| Path | Description |
|------|-------------|
| `renderer/index.html` | Browser UI markup (toolbar, webview container, status bar) |
| `renderer/renderer.js` | Renderer process logic, navigation, webview events |
| `src/renderer/` | Additional renderer resources (index.html, styles, main.js) |

### Module Directories

| Directory | Key Files | Purpose |
|-----------|-----------|---------|
| `automation/` | `scripts.js`, `storage.js`, `runner.js` | Script storage and execution for automated workflows |
| `blocking/` | `manager.js`, `filters.js` | Ad/tracker blocking with EasyList support |
| `cookies/` | `manager.js` | Cookie import/export (JSON, Netscape, EditThisCookie) |
| `devtools/` | `manager.js`, `console.js` | Chrome DevTools integration |
| `downloads/` | `manager.js` | Download management and handling |
| `evasion/` | `fingerprint.js`, `humanize.js` | Bot detection evasion, fingerprint spoofing, human behavior |
| `geolocation/` | `manager.js`, `presets.js` | Geolocation spoofing with city/region presets |
| `headers/` | `manager.js`, `profiles.js` | Custom HTTP header management |
| `history/` | `manager.js`, `storage.js` | Browsing history storage and retrieval |
| `input/` | `index.js`, `keyboard.js`, `mouse.js` | Input simulation (keyboard, mouse) |
| `inspector/` | `manager.js`, `highlighter.js`, `selector-generator.js` | DOM inspection and CSS selector generation |
| `network/` | `throttling.js` | Network throttling simulation |
| `profiles/` | `manager.js`, `storage.js` | Browser profile management with fingerprint settings |
| `proxy/` | `manager.js` | Proxy configuration and rotation (HTTP/HTTPS/SOCKS) |
| `recording/` | `manager.js` | Action recording for automation |
| `screenshots/` | `manager.js` | Screenshot capture functionality |
| `sessions/` | `manager.js` | Session persistence and restoration |
| `storage/` | `manager.js` | LocalStorage and IndexedDB management |
| `tabs/` | `manager.js` | Multi-tab management |
| `utils/` | `user-agents.js`, `request-interceptor.js` | User agent library, request interception |
| `websocket/` | `server.js` | WebSocket server for remote control (port 8765) |

### Documentation

| File | Description |
|------|-------------|
| `docs/ARCHITECTURE.md` | Detailed architecture with diagrams |
| `docs/API.md` | Complete WebSocket API reference |
| `docs/EVASION.md` | Bot detection evasion techniques |
| `docs/DEVELOPMENT.md` | Development setup and contribution guide |
| `docs/roadmap.md` | Development roadmap with task status |

### Tests

| Path | Description |
|------|-------------|
| `tests/unit/` | Unit tests (websocket-server, fingerprint, humanize, proxy-manager) |
| `tests/integration/` | Integration tests (browser-launch, navigation, automation, extension-browser) |
| `tests/test-ws-api.js` | WebSocket API test script |
| `tests/test-client.js` | WebSocket client test utility |

---

## 4. Architecture Notes

### Process Model

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

### Key Architectural Decisions

1. **Context Isolation**: `contextIsolation: true` for security - no direct Node.js access from renderer
2. **No Node Integration**: `nodeIntegration: false` prevents page scripts from accessing Node.js
3. **WebSocket Server**: Binds to localhost:8765 for external automation control
4. **Modular Design**: Separate managers for each feature (cookies, profiles, tabs, etc.)
5. **Evasion Injection**: Bot evasion scripts injected via preload script into every page

### Communication Flow

1. External client sends WebSocket command to port 8765
2. WebSocket server in main process parses command
3. Main process sends IPC message to renderer
4. Renderer executes in webview context
5. Response flows back through same path

### IPC Channels (Main <-> Renderer)

| Main -> Renderer | Renderer -> Main |
|------------------|------------------|
| `navigate-webview` | `webview-url-response` |
| `execute-in-webview` | `webview-execute-response` |
| `get-page-content` | `page-content-response` |
| `capture-screenshot` | `screenshot-response` |
| `click-element` | `click-response` |
| `fill-field` | `fill-response` |
| `get-page-state` | `page-state-response` |

---

## 5. Module Summary

| Module | Purpose |
|--------|---------|
| **automation/** | Store and execute automation scripts; script runner with step-by-step execution |
| **blocking/** | Block ads/trackers using filter lists (EasyList compatible); URL pattern matching |
| **cookies/** | Import/export cookies in JSON, Netscape, EditThisCookie formats |
| **devtools/** | Chrome DevTools integration; console logging and inspection |
| **downloads/** | Handle file downloads; download queue management |
| **evasion/** | Fingerprint spoofing (WebGL, canvas, audio); human behavior simulation |
| **geolocation/** | Spoof browser geolocation; city/region presets |
| **headers/** | Modify HTTP request/response headers; header profiles |
| **history/** | Store and query browsing history |
| **input/** | Keyboard and mouse input simulation; humanized typing |
| **inspector/** | DOM element inspection; CSS selector generation for automation |
| **network/** | Network throttling simulation (3G, 4G, etc.) |
| **profiles/** | Browser profile management; per-profile fingerprint settings |
| **proxy/** | Proxy configuration (HTTP/HTTPS/SOCKS4/SOCKS5); proxy rotation |
| **recording/** | Record user actions for automation replay |
| **screenshots/** | Capture page screenshots |
| **sessions/** | Save/restore browser sessions (tabs, URLs, scroll positions) |
| **storage/** | LocalStorage and IndexedDB backup/restore |
| **tabs/** | Multi-tab management; tab create/close/switch |
| **utils/** | User agent library (70+ UAs); request interception utilities |
| **websocket/** | WebSocket server for external control; command routing |

---

## 6. Next Steps / TODOs

### Immediate Tasks
- [ ] Complete Phase 3 testing (stealth and fingerprint management tests)
- [ ] Add authentication to WebSocket server
- [ ] Implement heartbeat/keepalive for WebSocket connections

### Phase 5: Backend Integration
- [ ] Direct API connection to main basset-hound backend
- [ ] Entity creation from extracted data
- [ ] Relationship mapping from discovered links
- [ ] Profile enrichment from web data

### Phase 6: Advanced Features
- [ ] Multi-window orchestration
- [ ] Tor integration for proxy
- [ ] Recording and replay functionality
- [ ] Headless mode

### Future Phases
- Phase 7: Developer Experience (plugin system, configuration, logging)
- Phase 8: Distribution (electron-builder, auto-update, Docker)

### Reference
See `docs/roadmap.md` for complete roadmap with detailed task status.

---

## 7. How to Resume Development

### Quick Start

```bash
# Navigate to project
cd ~/basset-hound-browser

# Install dependencies (if needed)
npm install

# Launch the browser
npm start

# Or launch in development mode with DevTools
npm run dev
```

### Connect WebSocket Client

```python
# Python example
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
# Run all tests
npm test

# Run WebSocket API tests (browser must be running)
node tests/test-ws-api.js

# Run specific test file
npm test -- tests/unit/fingerprint.test.js
```

### Key Documentation to Review

1. `docs/roadmap.md` - Current task status and next steps
2. `docs/ARCHITECTURE.md` - System design and component interaction
3. `docs/API.md` - Complete WebSocket command reference
4. `docs/EVASION.md` - Bot detection evasion implementation details

### Development Workflow

1. Check `docs/roadmap.md` for current phase and pending tasks
2. Review relevant module in its directory (e.g., `cookies/manager.js`)
3. Write/update tests in `tests/` before implementing
4. Update roadmap when completing tasks

---

## 8. Important Notes

### Security Considerations
- WebSocket server binds to localhost only - do not expose externally
- Browser accepts self-signed certificates (for OSINT purposes)
- No authentication on WebSocket by default - implement before production use

### Known Limitations
- Memory usage can grow with long sessions; restart periodically
- Some highly protected sites may still detect automation
- CDP exposure not yet implemented

### Common Issues

| Issue | Solution |
|-------|----------|
| WebSocket connection fails | Ensure browser is running; check port 8765 is free |
| Bot detection triggered | Increase delays; add random mouse movements |
| High memory usage | Navigate to `about:blank`; restart browser |
| Build fails | Run `npm install`; check electron-builder requirements |

---

*Last Updated: December 2024*
*For Claude Code sessions: Start by reading this file and `docs/roadmap.md`*
