# Basset Hound Browser - Source Code Index

**Last Updated:** May 11, 2026  
**Version:** 11.3.0

---

## Quick Navigation

### Source Code Organization
- **Main modules** - Core browser functionality
- **Feature modules** - Specialized capabilities
- **Integration modules** - External system connections
- **Utilities** - Helper functions and tools

---

## Core Modules

### Main Entry Point
- `main.js` - Electron main process
  - Application initialization
  - Window management
  - Process lifecycle
  - IPC communication setup
  - Version: 11.3.0

### Preload Module
- `preload.js` - Electron preload script
  - Secure context initialization
  - IPC bridge setup
  - API exposure to renderer
  - Security sandboxing

---

## Feature Modules

### Evasion Module (`/evasion/`)
Advanced bot detection evasion techniques:
- Canvas fingerprinting bypass
- WebGL profiling evasion
- AudioContext spoofing
- Font enumeration hiding
- WebRTC IP leak prevention
- **Status:** Production ready (Phase 2 complete)

### Forensics Module (`/forensics/`)
Evidence collection and analysis:
- Network forensics
- DOM analysis
- Storage inspection
- JavaScript execution tracking
- Screenshot metadata extraction
- **Status:** Production ready (v11.2.0)

### Recording Module (`/recording/`)
Session recording and playback:
- WebM recording
- Frame capture
- Audio recording
- Session replay
- Timestamp tracking
- **Status:** Production ready (v11.2.0)

### Proxy Module (`/proxy/`)
Network proxy management:
- SOCKS5 support
- HTTP/HTTPS proxying
- Residential proxy rotation
- Health checking
- Performance metrics
- **Status:** Production ready (Phase 2)

### Screenshots Module (`/screenshots/`)
Advanced screenshot capture:
- Full-page screenshots
- Element-specific captures
- OCR integration
- Metadata extraction
- Compression optimization
- **Status:** Production ready (v11.2.0)

### Session Module (`/session/`)
Session and profile management:
- Profile isolation
- Cookie management
- Storage management
- Session lifecycle
- State persistence
- **Status:** Production ready

### Analysis Module (`/analysis/`)
Website and content analysis:
- Technology detection
- Site structure analysis
- Link extraction
- Form identification
- Content classification
- **Status:** Production ready (Phase 1)

### Authentication Module (`/authentication/`)
Account and credential management:
- Credential storage
- Session authentication
- OAuth support
- MFA handling
- Token management
- **Status:** Production ready

### Agents Module (`/agents/`)
Multi-agent orchestration:
- OSINT agent coordination
- Forensic agent management
- Workflow orchestration
- Result aggregation
- Error handling
- **Status:** Production ready (Phase 2)

---

## WebSocket & MCP Integration

### WebSocket Server
- `websocket/server.js` - Main WebSocket server
  - 164 command handlers
  - Connection management
  - Message routing
  - Error handling

### Command Handlers
- `websocket/handlers/` - Command-specific handlers
  - Navigation commands
  - Extraction commands
  - Evasion commands
  - Proxy commands
  - Recording commands

### MCP Server
- `../browser_mcp/server.py` - Model Context Protocol
  - Tool definitions
  - Request handling
  - Response formatting

---

## Module Structure

### Standard Module Layout
Each feature module typically includes:

```
module/
  ├── index.js           - Main module export
  ├── core.js            - Core functionality
  ├── utils.js           - Utility functions
  ├── config.js          - Configuration
  └── [features]/        - Feature-specific files
```

---

## Key Files by Functionality

### Navigation
- Core: Handles page navigation
- Handlers: navigate, reload, back, forward
- Features: JavaScript execution, wait conditions

### Content Extraction
- Core: DOM and content analysis
- Handlers: getText, getHTML, getImages, getLinks
- Features: Metadata extraction, forensic capture

### Interaction
- Core: User input simulation
- Handlers: click, fill, type, scroll, hover
- Features: Behavior timing, event triggering

### Evasion
- Core: Detection bypass techniques
- Location: `/evasion/` module
- Features: Canvas, WebGL, Audio, Font, WebRTC

### Recording
- Core: Video capture and serialization
- Location: `/recording/` module
- Features: WebM encoding, session replay

### Forensics
- Core: Evidence collection
- Location: `/forensics/` module
- Features: Network analysis, DOM inspection, storage capture

### Proxy Management
- Core: Proxy configuration and rotation
- Location: `/proxy/` module
- Features: Health checking, performance metrics, rotation modes

---

## Module Dependencies

### Critical Dependencies
- `ws` - WebSocket server
- `electron` - GUI framework
- `electron-builder` - Packaging
- Testing framework dependencies

### Optional Dependencies
- `tor-service` - Tor integration
- `tesseract.js` - OCR for screenshot analysis
- `puppeteer` - Chromium control (optional)

---

## API Surface

### WebSocket Commands
- **164 total commands** across all handlers
- **Command format:** JSON messages via WebSocket
- **Response format:** Structured JSON with status codes

### Categories
- Navigation: 15+ commands
- Extraction: 20+ commands
- Interaction: 15+ commands
- Evasion: 30+ commands
- Proxy: 10+ commands
- Recording: 10+ commands
- Session: 15+ commands
- Analysis: 20+ commands
- Other: 20+ commands

---

## Code Organization Principles

### Separation of Concerns
- **Browser Core:** Main process + Electron features
- **Control Interface:** WebSocket server + MCP
- **Intelligent Analysis:** External agents only
- **Feature Modules:** Self-contained with clear APIs

### Error Handling
- Consistent error codes
- Exception logging
- Recovery procedures
- Timeout management

### Performance
- Resource pooling
- Connection reuse
- Optimization flags
- Memory management

### Security
- Sandboxing
- IPC validation
- Credential protection
- Rate limiting

---

## Development Workflow

### Adding a New Feature
1. Create feature directory under `/src/`
2. Implement `index.js` with exports
3. Add WebSocket handlers in `websocket/handlers/`
4. Add tests in `tests/`
5. Document in feature README
6. Update API reference

### Modifying Existing Modules
1. Ensure backward compatibility
2. Add tests for new behavior
3. Update documentation
4. Test with comprehensive-integration-test.js
5. Run full test suite

---

## Version History

### v11.3.0 (May 7-11, 2026)
- Phase 1 completion (4 modules, 8,500+ lines, 141+ tests)
- Phase 2 completion (8 modules, 10,500+ lines, 325+ tests)
- Total: 19,000+ lines, 466+ tests, 100% pass rate

### v11.2.0 (May 6-7, 2026)
- Recording module (1,090 lines)
- Forensics module (1,290 lines)
- Analysis module (1,100 lines)
- Multi-agent orchestration (Phase 2 Track 7)

### v11.1.0 (Jan-May 2026)
- MCP server integration
- Client libraries (CLI, Node.js, Python)
- Production validation
- Docker deployment

### v11.0.0 (Jan 2026)
- Core browser functionality
- WebSocket API (164 commands)
- Initial evasion framework
- Docker support

---

## Testing & Quality

### Test Coverage
- **Unit Tests:** Individual component testing
- **Integration Tests:** Module interaction validation
- **E2E Tests:** Complete workflow testing
- **Performance Tests:** Load and stress testing
- **Evasion Tests:** Detection bypass verification

### Quality Metrics
- **Pass Rate:** 100% (466+ tests)
- **Code Coverage:** >90% critical paths
- **Performance:** <50ms for 99%+ operations
- **Stability:** <0.1% error rate in production

---

## Documentation

For detailed information, see:
- `docs/API-REFERENCE.md` - Complete command documentation
- `docs/SCOPE.md` - Architectural boundaries
- `docs/DEPLOYMENT.md` - Deployment guide
- Each module's README.md file

---

## Directory Structure (Complete)

```
src/
├── main/
│   ├── main.js               - Electron main process
│   └── preload.js            - Electron preload
├── agents/                   - Multi-agent orchestration
├── analysis/                 - Technology detection
├── authentication/           - Authentication handling
├── evasion/                  - Bot detection evasion
├── forensics/                - Evidence collection
├── proxy/                    - Proxy management
├── recording/                - Session recording
├── session/                  - Profile management
└── screenshots/              - Screenshot capture
```

---

## Quick Reference

| Module | Purpose | Status |
|--------|---------|--------|
| agents | Multi-agent orchestration | Production |
| analysis | Technology detection | Production |
| authentication | Auth handling | Production |
| evasion | Detection bypass | Production |
| forensics | Evidence collection | Production |
| proxy | Proxy management | Production |
| recording | Session recording | Production |
| session | Profile management | Production |
| screenshots | Screenshot capture | Production |

---

**Status:** ✅ Production Ready  
**Last Updated:** May 11, 2026  
**Total Code:** 19,000+ lines  
**Test Coverage:** 100% pass rate
