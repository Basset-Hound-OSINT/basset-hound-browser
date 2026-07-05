# Architecture Overview

High-level system design and architecture.

## System Components

```
┌─────────────────┐
│   WebSocket     │
│     Client      │
│  (Python, JS)   │
└────────┬────────┘
         │
         │ JSON messages
         │
┌────────▼────────────────────┐
│   WebSocket Server          │
│  (websocket/server.js)      │
└────────┬─────────────────────┘
         │
         ├─────────────┐
         │             │
    ┌────▼────┐   ┌───▼────────┐
    │ Browser │   │  Command   │
    │ Process │   │ Dispatcher │
    │(Electron)   │            │
    └──────────   └───┬────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    ┌────▼───┐   ┌───▼───┐  ┌────▼───┐
    │Evasion │   │Proxy  │  │Profile │
    │Manager │   │Manager│  │Manager │
    └────────┘   └───────┘  └────────┘
```

## Module Organization

**Core:**
- `src/main/main.js` - Electron main process
- `websocket/server.js` - WebSocket API server

**Evasion & Behavior:**
- `evasion/fingerprint.js` - Anti-fingerprinting
- `evasion/humanize.js` - Human behavior simulation

**Management:**
- `proxy/manager.js` - Proxy rotation
- `profiles/manager.js` - Browser profiles
- `tabs/manager.js` - Tab management
- `cookies/manager.js` - Cookie handling
- `sessions/manager.js` - Session persistence

**Content & Analysis:**
- `extraction/` - Forensic data capture
- `screenshots/manager.js` - Page captures
- `blocking/manager.js` - Ad/tracker blocking

**Utilities:**
- `utils/user-agents.js` - User agent library
- `utils/request-interceptor.js` - Request interception

## Request Flow

1. Client sends JSON command via WebSocket
2. Server receives and validates JSON
3. Command dispatcher routes to handler
4. Handler executes in browser process
5. Response collected and sent back
6. Client receives JSON response

## Command Execution

Commands execute in the following order:

1. **Validation** - Check command/parameters valid
2. **Authorization** - Check permissions (if enabled)
3. **Rate Limiting** - Check not rate limited
4. **Execution** - Run command in browser
5. **Response** - Return result to client

## Session Coherence

Browser maintains state across commands:
- Navigation history
- Cookies and storage
- Active profile/tab
- Proxy configuration
- User agent setting

## Error Handling

All commands wrap in try/catch:
- Return error code + message
- Log to console/audit trail
- Continue accepting commands

## See Also

- **[Directory Structure](DIRECTORY-STRUCTURE.md)** - File organization
- **[Development Setup](DEV-SETUP.md)** - Setup environment
- **[Testing Guide](TESTING.md)** - Test organization
