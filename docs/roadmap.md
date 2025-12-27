# Basset Hound Browser - Development Roadmap

## Overview

Basset Hound Browser is a custom Electron-based automation browser designed for OSINT investigations and AI-driven web automation. This roadmap outlines the development path from current state to a production-ready automation platform.

---

## Current State (v1.0-alpha)

### Completed Features
- [x] Basic Electron browser shell
- [x] Multi-tab management (create, close, switch)
- [x] Address bar with navigation
- [x] Back/Forward/Refresh controls
- [x] Chrome extension loading from `/extensions` directory
- [x] Extension popup rendering
- [x] Window state persistence
- [x] Form submission interception (`target="_blank"`)
- [x] Webview security configuration (CSP, context isolation)
- [x] IPC bridge for extension communication

### Current Architecture
```
Main Process (main.js)
    └── Extension loading
    └── Window management
    └── IPC handlers

Preload (preload.js)
    └── Context bridge
    └── Form interception

Renderer (index_main.js)
    └── Tab management
    └── Webview events
    └── Extension UI
```

---

## Phase 1: API Layer

**Priority: Critical**
**Goal**: Enable external control of the browser via HTTP/WebSocket API

### 1.1 WebSocket Server
- [x] Embed WebSocket server in main process (port 8765)
- [x] Define command protocol (JSON-based with type/command/id structure)
- [ ] Implement authentication mechanism
- [x] Handle concurrent connections
- [ ] Add heartbeat/keepalive

### 1.2 Command Handlers
```javascript
// Commands implemented:
- navigate(url)        ✅ Tested
- newTab(url?)         ✅ Tested
- getTabs()            ✅ Tested
- getPageState()       ✅ Tested
- click(selector)      ✅ Tested
- fill(selector, value) ✅ Tested
- screenshot()         ✅ Tested
- executeScript(code)  ✅ Tested

// Commands to implement:
- closeTab(tabId)
- switchTab(tabId)
- waitForSelector(selector)
- waitForNavigation()
- cookies.get(url?)
- cookies.set(cookie)
- cookies.clear(url?)
```

### 1.3 REST API (Optional)
- [ ] Express server for simple endpoints
- [ ] Session management endpoints
- [ ] Status and health checks
- [ ] Swagger/OpenAPI documentation

### 1.4 CDP Exposure
- [ ] Expose Chrome DevTools Protocol from webviews
- [ ] Allow Puppeteer/Playwright connection
- [ ] CDP WebSocket proxy

---

## Phase 2: Automation Core

**Priority: High**
**Goal**: Robust automation primitives for OSINT operations

### 2.1 Element Interaction
- [ ] Smart element detection (multiple selector strategies)
- [ ] Realistic typing simulation
- [ ] Mouse movement simulation
- [ ] Scroll behaviors (smooth, instant, to element)
- [ ] Hover and focus events
- [ ] Drag and drop support

### 2.2 Wait Utilities
- [ ] Wait for selector (with timeout)
- [ ] Wait for navigation
- [ ] Wait for network idle
- [ ] Wait for text content
- [ ] Wait for element state (visible, enabled, etc.)
- [ ] Custom condition waits

### 2.3 Content Extraction
- [ ] Full page HTML extraction
- [ ] Text content extraction
- [ ] Structured data extraction (tables, lists)
- [ ] Meta tag extraction
- [ ] Link extraction with classification
- [ ] Form detection and mapping

### 2.4 Network Layer
- [ ] Request/response interception
- [ ] Request modification (headers, body)
- [ ] Response mocking
- [ ] Network logging (HAR export)
- [ ] Resource blocking (ads, trackers)
- [ ] Download handling

---

## Phase 3: Stealth & Fingerprint Management

**Priority: High**
**Goal**: Evade bot detection for OSINT operations

### 3.1 Fingerprint Control
- [ ] Configurable user agent
- [ ] WebGL vendor/renderer spoofing
- [ ] Canvas fingerprint randomization
- [ ] Plugin list customization
- [ ] Screen resolution configuration
- [ ] Timezone/locale settings
- [ ] Language preferences

### 3.2 Automation Evasion
- [ ] Patch `navigator.webdriver`
- [ ] Emulate `chrome.runtime`
- [ ] Fix `iframe.contentWindow`
- [ ] Handle permission API properly
- [ ] Randomize timing patterns
- [ ] Natural scroll behavior

### 3.3 Profile Management
- [ ] Create/save browser profiles
- [ ] Load profiles with fingerprint settings
- [ ] Profile isolation (cookies, storage)
- [ ] Profile rotation for multi-account

---

## Phase 4: Session & State Management

**Priority: Medium-High**
**Goal**: Persistent sessions for long-running OSINT tasks

### 4.1 Cookie Management
- [ ] Export/import cookies
- [ ] Cookie persistence across restarts
- [ ] Cookie filtering by domain
- [ ] Secure cookie storage

### 4.2 Session Persistence
- [ ] Save browser state (tabs, URLs, scroll positions)
- [ ] Restore sessions on startup
- [ ] Named session profiles
- [ ] Session sharing between instances

### 4.3 Local Storage/IndexedDB
- [ ] Backup/restore localStorage
- [ ] IndexedDB export
- [ ] Storage inspection tools

---

## Phase 5: Integration Features

**Priority: Medium**
**Goal**: Connect browser to OSINT ecosystem

### 5.1 basset-hound Integration
- [ ] Direct API connection to basset-hound backend
- [ ] Entity creation from extracted data
- [ ] Relationship mapping from discovered links
- [ ] Profile enrichment from web data

### 5.2 osint-resources Integration
- [ ] Load tool configurations from knowledge base
- [ ] Auto-fill based on tool_info YAML
- [ ] Tool-specific command presets
- [ ] Result parsing and storage

### 5.3 palletAI Integration
- [ ] Agent command protocol
- [ ] Task queue integration
- [ ] Result reporting
- [ ] Human-in-the-loop callbacks

---

## Phase 6: Advanced Features

**Priority: Medium**
**Goal**: Power-user features for complex OSINT workflows

### 6.1 Multi-Window Orchestration
- [ ] Spawn multiple browser windows
- [ ] Window-to-window communication
- [ ] Parallel page processing
- [ ] Window pooling

### 6.2 Proxy Support
- [ ] Per-tab proxy configuration
- [ ] Proxy rotation
- [ ] SOCKS5 support
- [ ] Tor integration
- [ ] Proxy authentication

### 6.3 Recording & Replay
- [ ] Record user actions
- [ ] Export as automation script
- [ ] Replay with modifications
- [ ] Visual diff detection

### 6.4 Headless Mode
- [ ] Run without UI
- [ ] Virtual frame buffer support
- [ ] Headless-specific optimizations
- [ ] Resource usage reduction

---

## Phase 7: Developer Experience

**Priority: Medium**
**Goal**: Make the browser easy to extend and maintain

### 7.1 Plugin System
- [ ] Define plugin API
- [ ] Plugin loading mechanism
- [ ] Built-in plugin examples
- [ ] Plugin isolation/security

### 7.2 Configuration
- [ ] YAML/JSON config files
- [ ] Environment variable support
- [ ] Command-line arguments
- [ ] Runtime configuration API

### 7.3 Logging & Debugging
- [ ] Structured logging
- [ ] Log levels and filtering
- [ ] Debug mode with verbose output
- [ ] Performance profiling
- [ ] Memory usage monitoring

### 7.4 Testing
- [ ] Unit test setup
- [ ] Integration tests
- [ ] E2E automation tests
- [ ] CI/CD pipeline

---

## Phase 8: Distribution

**Priority: Low (Later)**
**Goal**: Package and distribute the browser

### 8.1 Packaging
- [ ] electron-builder configuration
- [ ] Windows installer (.exe, .msi)
- [ ] macOS app bundle (.app, .dmg)
- [ ] Linux packages (.deb, .rpm, .AppImage)

### 8.2 Auto-Update
- [ ] Update server setup
- [ ] Delta updates
- [ ] Update notifications
- [ ] Rollback capability

### 8.3 Docker Deployment
- [ ] Dockerfile for headless operation
- [ ] Docker Compose configuration
- [ ] Kubernetes manifests
- [ ] Health check endpoints

---

## Version Milestones

| Version | Focus | Key Deliverables |
|---------|-------|------------------|
| 1.0-alpha | Current | Basic browser, tabs, extensions |
| 1.1 | API | WebSocket server, command handlers |
| 1.2 | Automation | Element interaction, waits, extraction |
| 1.3 | Stealth | Fingerprint management, evasion |
| 2.0 | Integration | basset-hound, palletAI connections |
| 2.1 | Advanced | Multi-window, proxy, recording |
| 3.0 | Production | Headless, packaging, Docker |

---

## Technical Decisions

### Why Electron?
- Chromium rendering engine (consistent with Chrome)
- Node.js for backend operations
- Chrome extension support
- Cross-platform desktop app
- Large ecosystem and community

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|----------------|
| Playwright | No built-in extension support, no custom UI |
| Puppeteer | Chrome-only, no UI capabilities |
| CEF | C++ complexity, harder to develop |
| Steel Browser | Good option for headless, but less UI control |
| Browserless | Cloud-only, no local customization |

### Integration with autofill-extension

The autofill-extension is loaded as a Chrome extension within Electron:
```
extensions/
└── autofill/  (git submodule → autofill-extension repo)
    ├── manifest.json
    ├── background.js
    ├── content.js
    └── popup.html
```

This allows:
1. Electron browser to use extension's automation logic
2. Same extension works in regular Chrome
3. Updates to extension apply to both environments

---

## Dependencies

```json
{
  "dependencies": {
    "ws": "^8.14.2",         // WebSocket server ✅ Added
    "express": "^4.x",       // Optional REST API (not yet added)
    "electron-store": "^8.x" // Already present ✅
  },
  "devDependencies": {
    "jest": "^29.x",         // Testing (not yet added)
    "spectron": "^x.x"       // E2E testing (deprecated, consider Playwright)
  }
}
```

## Testing Infrastructure

### Test Files
| File | Purpose |
|------|---------|
| `tests/test-ws-api.js` | WebSocket API test script |

### Running Tests
```bash
# Start the browser
npm start

# In another terminal, run API tests
node tests/test-ws-api.js
```

---

## Getting Started

### Development Setup
```bash
cd ~/basset-hound-browser
npm install
npm start  # or npm run watch
```

### Current Commands
```bash
npm start   # Run the browser
npm run watch  # Run with auto-reload
npm run build  # Package for distribution
```

---

## Contributing

When implementing features:

1. Create feature branch from `main`
2. Implement with tests
3. Update this roadmap with completion status
4. Create PR with description

---

*Last Updated: December 2024*
