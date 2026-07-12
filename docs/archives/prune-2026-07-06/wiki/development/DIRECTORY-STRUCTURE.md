# Directory Structure

File organization and module layout.

## Root Files

```
README.md                 # Project overview (minimal)
package.json             # Dependencies and scripts
.gitignore              # Git ignore rules
LICENSE                 # MIT License
```

## Main Directories

```
basset-hound-browser/
├── src/                 # Source code
│   ├── main/            # Electron main process
│   │   ├── main.js      # Entry point
│   │   └── preload.js   # IPC bridge
│   └── renderer/        # Electron renderer
│       ├── index.html   # UI
│       └── index_main.js # Renderer logic
│
├── websocket/           # WebSocket API
│   └── server.js        # WebSocket server
│
├── evasion/             # Bot detection evasion
│   ├── fingerprint.js   # Anti-fingerprinting
│   └── humanize.js      # Behavior simulation
│
├── proxy/               # Proxy management
│   └── manager.js
│
├── profiles/            # Browser profiles
│   ├── manager.js
│   └── storage.js
│
├── tabs/                # Tab management
│   └── manager.js
│
├── cookies/             # Cookie handling
│   └── manager.js
│
├── sessions/            # Session management
│   └── manager.js
│
├── extraction/          # Forensic capture
│   └── ...
│
├── screenshots/         # Screenshots
│   └── manager.js
│
├── blocking/            # Ad/tracker blocking
│   ├── manager.js
│   └── filters.js
│
├── utils/               # Utilities
│   ├── user-agents.js
│   └── request-interceptor.js
│
├── docs/                # Documentation
│   ├── wiki/            # Wiki (start here)
│   ├── API-REFERENCE-AUTHORITATIVE.md
│   ├── EXAMPLES.md
│   └── ...
│
├── tests/               # Test suites
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── results/         # Test output
│
├── scripts/             # Build & deploy scripts
│   ├── install/
│   ├── deploy.sh
│   └── ...
│
└── examples/            # Example scripts
    ├── python/
    ├── nodejs/
    └── ...
```

## Key Files

**Entry Points:**
- `src/main/main.js` - Electron app start
- `websocket/server.js` - WebSocket server
- `package.json` - npm configuration

**Core Modules:**
- `evasion/fingerprint.js` - Spoofing logic
- `evasion/humanize.js` - Behavior patterns
- `proxy/manager.js` - Proxy control
- `websocket/server.js` - Command handling

**Configuration:**
- `.env` - Environment variables
- `package.json` - Dependencies and scripts

## Documentation Map

**User Documentation:**
- `docs/wiki/` - User-friendly wiki (start here)
- `README.md` - Project overview

**Developer Documentation:**
- `docs/API-REFERENCE-AUTHORITATIVE.md` - Complete API reference
- `docs/EXAMPLES.md` - Code examples
- `docs/SECURITY.md` - Security details

**Internal Documentation:**
- `docs/` - Various internal docs
- See `docs/DOCS-INDEX.md` for complete index

## See Also

- **[Architecture](ARCHITECTURE.md)** - System design
- **[Development Setup](DEV-SETUP.md)** - Setup environment
- **[Testing](TESTING.md)** - Test organization
