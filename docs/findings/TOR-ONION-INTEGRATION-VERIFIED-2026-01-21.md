# Tor .onion Site Integration - Verification Report

**Date:** 2026-01-21
**Status:** VERIFIED WORKING

## Summary

Basset Hound Browser successfully accesses .onion sites through portable/embedded Tor with proper DNS resolution through the Tor SOCKS proxy.

## Key Findings

### 1. Tor Mode Configuration

The browser supports a "Tor Mode" that must be enabled at startup via:
- Environment variable: `TOR_MODE=1`
- Command line flag: `--tor-mode`
- Config option: `tor.enabled: true`

When Tor Mode is enabled, Electron is configured with command-line switches that prevent DNS leaks:

```javascript
// Set proxy server - routes all traffic through Tor SOCKS proxy
app.commandLine.appendSwitch('proxy-server', 'socks5://127.0.0.1:9050');

// Prevent local DNS resolution - critical for .onion domains
app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND , EXCLUDE 127.0.0.1');

// Disable DNS prefetching to prevent DNS leaks
app.commandLine.appendSwitch('dns-prefetch-disable');
```

### 2. Why These Switches Are Required

- **`--proxy-server`**: Routes all Chromium traffic through the Tor SOCKS5 proxy
- **`--host-resolver-rules`**: Prevents Chromium from resolving DNS locally. Without this, .onion domains fail because local DNS cannot resolve them
- **`--dns-prefetch-disable`**: Prevents background DNS requests that could leak traffic outside Tor

### 3. Proxy Scheme

**Important:** Use `socks5://` NOT `socks5h://`

- `socks5h://` is a curl convention, NOT supported by Chromium/Electron
- Chromium's `socks5://` already performs DNS resolution on the proxy side by default
- Using `socks5h://` causes `ERR_NO_SUPPORTED_PROXIES` error

### 4. Session Proxy Configuration

In addition to command-line switches, the proxy is also set via session API when Tor is started:

```javascript
await session.defaultSession.setProxy({
  proxyRules: 'socks5://127.0.0.1:9050',
  proxyBypassRules: '<local>'
});

// Close existing connections to force new requests through the proxy
await session.defaultSession.closeAllConnections();
```

### 5. Verification Results

Successfully accessed DuckDuckGo .onion site:
- **URL:** `https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/`
- **HTML Content:** 374,284 characters
- **Text Content:** 6,892 characters
- **Page Title:** "DuckDuckGo - Protection. Privacy. Peace of mind."

### 6. Docker Usage

To run basset-hound-browser with Tor mode in Docker:

```bash
docker run -d --name basset-hound-browser \
  -p 8765:8765 \
  -e TOR_MODE=1 \
  basset-hound-browser
```

Then start the Tor daemon via WebSocket command:
```json
{"command": "tor_start", "mode": "embedded"}
```

### 7. API Response Structure

When calling `get_content`, the response structure is:
```json
{
  "success": true,
  "content": {
    "html": "...",
    "text": "...",
    "title": "...",
    "url": "..."
  }
}
```

Note: Content is nested under `content` property, not at the top level.

## Files Modified

1. **`main.js`**: Added `configureTorMode()` function that sets command-line switches before app is ready
2. **`proxy/manager.js`**:
   - Fixed to use `socks5://` (not `socks5h://`)
   - Added `closeAllConnections()` after setting proxy
   - Added proxy resolution verification logging

## Limitations

1. **Startup Timing**: Tor mode must be enabled at app startup. The command-line switches cannot be changed dynamically after the app starts.

2. **Tor Daemon**: The Tor daemon must be started separately via `tor_start` command. Tor mode only configures routing, not the daemon itself.

3. **Screenshot Issue**: Screenshots of .onion pages may appear empty (22 chars) even when content is successfully retrieved. This is a known Electron/Chromium issue with offscreen rendering.

## Recommendations

1. **For Production**: Consider installing system-level Tor in the Docker container for faster startup and easier updates (see DOCKER-TOR-SETUP-RESEARCH-2026-01-21.md)

2. **For Development**: Embedded/portable Tor works well and is cross-platform

3. **For Forensics**: Enable Tor mode when network forensics capabilities require anonymous access to .onion sites

## Test Scripts

- `/tests/tor-onion-verify.js` - Full verification test for .onion site access
- `/tests/tor-direct-test.js` - Direct Tor test with detailed logging
- `/tests/tor-simple-test.js` - Simplified test with longer waits
