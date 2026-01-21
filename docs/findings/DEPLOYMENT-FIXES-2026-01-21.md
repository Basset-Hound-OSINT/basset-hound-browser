# Deployment Fixes - 2026-01-21

## Summary

During the build and deployment testing of basset-hound-browser v11.0.0, several issues were identified and fixed to enable successful Docker-based deployment.

## Issues Found and Fixed

### 1. Dockerfile: npm install --production Issue
**Problem**: The Dockerfile used `npm install --production` which skipped installing `electron` (a devDependency), causing the entrypoint script to fail with "electron: not found".

**Fix**: Changed to `npm install` to install all dependencies including electron.

```diff
- RUN npm install --production
+ RUN npm install
```

### 2. Dockerfile: PATH not set for node_modules/.bin
**Problem**: The Docker entrypoint script couldn't find `electron` because `/app/node_modules/.bin` wasn't in PATH.

**Fix**: Added PATH export to the entrypoint script.

```bash
export PATH="/app/node_modules/.bin:$PATH"
```

### 3. main.js: Missing async keyword on createWindow()
**Problem**: The `createWindow()` function used `await` for certificate generation but wasn't declared as `async`, causing a SyntaxError.

**Fix**: Changed function declaration:
```diff
- function createWindow() {
+ async function createWindow() {
```

Also updated callers to await the function.

### 4. network-analysis/manager.js: Session accessed before app ready
**Problem**: The NetworkAnalysisManager singleton accessed `session.defaultSession` at module load time, before `app.whenReady()`.

**Fix**: Implemented lazy-loading for the session property:
```javascript
get session() {
  if (!this._sessionInitialized) {
    this._session = session.defaultSession;
    this._sessionInitialized = true;
  }
  return this._session;
}
```

### 5. .dockerignore: Source code directories incorrectly excluded
**Problem**: The `.dockerignore` excluded `sessions/`, `downloads/`, and `screenshots/` directories which contain essential source code (`manager.js` files), not just runtime data.

**Fix**: Removed these directories from .dockerignore, only excluding `recordings/data`:
```diff
- recordings
- screenshots
- sessions
- downloads
+ recordings/data
```

### 6. main.js: Reference to removed proxyChainManager
**Problem**: The `proxyChainManager` was referenced in the WebSocketServer initialization but was migrated to `basset-hound-networking` package.

**Fix**: Commented out the reference:
```javascript
// proxyChainManager was migrated to basset-hound-networking
```

### 7. Dockerfile: Missing runtime directories
**Problem**: The non-root `basset` user couldn't create directories at runtime, causing permission errors.

**Fix**: Pre-created all required directories before changing ownership:
```dockerfile
RUN mkdir -p /app/automation/saved \
    /app/recordings/screenshots \
    /app/recordings/data \
    /app/bin/tor \
    /app/data \
    /app/screenshots \
    /app/downloads \
    /app/blocking-data
```

### 8. websocket/commands/*.js: Wrong command registration pattern
**Problem**: Six command files used `server.registerCommand()` method which doesn't exist. They should use the `commandHandlers.command_name = async (params) => {}` pattern.

**Affected files**:
- cookie-commands.js
- evidence-chain-commands.js
- extraction-commands.js
- location-commands.js
- multi-page-commands.js
- profile-template-commands.js
- form-commands.js (already fixed)

**Fix**: Updated all files to use the correct pattern:
```javascript
const commandHandlers = server.commandHandlers || server;
commandHandlers.command_name = async (params) => {
  // handler code
};
```

### 9. Dockerfile: Health check expects HTTP but server is WebSocket
**Problem**: The health check used `curl -f http://localhost:8765` but WebSocket servers return HTTP 426 "Upgrade Required" for HTTP requests, causing health check failures.

**Fix**: Updated health check to expect 426 status code:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -s -o /dev/null -w "%{http_code}" http://localhost:8765 | grep -q "426" || exit 1
```

## Verification

After all fixes, the Docker container:
1. ✅ Builds successfully
2. ✅ Starts Xvfb display
3. ✅ Starts Electron in headless mode
4. ✅ WebSocket server listens on port 8765
5. ✅ Responds to WebSocket commands (navigate, get_cookies, etc.)

## Commands Verified Working
- `navigate` - Navigate to URL ✅
- `get_cookies` - Get browser cookies ✅
- `get_page_state` - Requires active webview (expected in headless)
- `screenshot` - Requires active webview (expected in headless)

## Notes for Integration

1. **WebSocket API**: Connects via `ws://localhost:8765` (or container host:port)
2. **Command format**:
   ```json
   {"id": 1, "command": "navigate", "url": "https://example.com"}
   ```
3. **MCP Server**: Python MCP server at `mcp/server.py` connects to WebSocket API
4. **Authentication**: Disabled by default (configurable)

## Files Modified
- `/home/devel/basset-hound-browser/Dockerfile`
- `/home/devel/basset-hound-browser/.dockerignore`
- `/home/devel/basset-hound-browser/main.js`
- `/home/devel/basset-hound-browser/network-analysis/manager.js`
- `/home/devel/basset-hound-browser/websocket/commands/form-commands.js`
- `/home/devel/basset-hound-browser/websocket/commands/cookie-commands.js`
- `/home/devel/basset-hound-browser/websocket/commands/evidence-chain-commands.js`
- `/home/devel/basset-hound-browser/websocket/commands/extraction-commands.js`
- `/home/devel/basset-hound-browser/websocket/commands/location-commands.js`
- `/home/devel/basset-hound-browser/websocket/commands/multi-page-commands.js`
- `/home/devel/basset-hound-browser/websocket/commands/profile-template-commands.js`
