# Tor Master Switch Implementation

**Date:** 2026-01-21
**Status:** Complete
**Version:** 11.0.0

## Summary

Implemented a Tor Master Switch feature with three modes (OFF/ON/AUTO) for intelligent Tor routing control. This allows human operators and AI agents to manage Tor networking with flexible control depending on the investigation scenario.

---

## Feature Overview

### The Problem

Previously, Tor routing had to be managed manually with explicit `tor_enable` and `tor_disable` commands. This created friction when:
- Investigating websites that might redirect to Tor-facing pages
- Switching between clearnet and .onion domains frequently
- Running automated workflows that need to adapt to URL types

### The Solution: Master Switch

A master switch provides three modes:

| Mode | Behavior | Use Case |
|------|----------|----------|
| **OFF** | Never route through Tor | Normal browsing, maximum speed |
| **ON** | Always route through Tor | Maximum anonymity, manual control |
| **AUTO** | Intelligently switch based on .onion URLs | Best of both worlds |

---

## Implementation Details

### Files Modified

1. **`proxy/manager.js`**
   - Added `TOR_MASTER_MODES` constant: `{ OFF: 'off', ON: 'on', AUTO: 'auto' }`
   - Added `torMasterMode` state variable
   - Added `setTorMasterMode(mode, options)` method
   - Added `getTorMasterMode()` method
   - Added `handleAutoModeNavigation(url)` method for AUTO mode
   - Added `isOnionUrl(url)` helper method

2. **`websocket/server.js`**
   - Added `set_tor_mode` command handler
   - Added `get_tor_mode` command handler
   - Updated `navigate` command to call `handleAutoModeNavigation()` in AUTO mode

3. **`docs/ROADMAP.md`**
   - Added Tor Master Switch section under Tor Integration
   - Updated Recent Updates section

---

## WebSocket API

### `set_tor_mode`

Set the Tor master switch mode.

**Request:**
```json
{
  "command": "set_tor_mode",
  "mode": "auto",
  "socksHost": "127.0.0.1",
  "socksPort": 9050
}
```

**Response:**
```json
{
  "success": true,
  "mode": "auto",
  "previousMode": "off",
  "routing": {
    "enabled": false
  },
  "note": "Routing will automatically switch when navigating to .onion URLs..."
}
```

### `get_tor_mode`

Get current Tor master switch status.

**Request:**
```json
{
  "command": "get_tor_mode"
}
```

**Response:**
```json
{
  "success": true,
  "mode": "auto",
  "description": "Tor routing switches automatically based on URL type (.onion = Tor, clearnet = direct).",
  "routing": {
    "enabled": true,
    "socksHost": "127.0.0.1",
    "socksPort": 9050
  },
  "daemon": {
    "reachable": true,
    "connected": true
  }
}
```

---

## AUTO Mode Behavior

When the master switch is set to AUTO mode:

1. **Navigating to .onion URL:**
   - System detects `.onion` in hostname
   - Automatically calls `enableTorRouting()`
   - Navigation proceeds through Tor

2. **Navigating to clearnet URL:**
   - System detects non-.onion hostname
   - Automatically calls `disableTorRouting()`
   - Navigation proceeds directly

3. **Navigation response includes auto-mode info:**
   ```json
   {
     "success": true,
     "url": "https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/",
     "torAutoMode": {
       "handled": true,
       "action": "enabled_tor",
       "isOnion": true
     }
   }
   ```

---

## Usage Examples

### Example 1: Enable AUTO mode for an investigation

```json
// Set AUTO mode
{"command": "set_tor_mode", "mode": "auto"}

// Navigate to clearnet - uses direct connection
{"command": "navigate", "url": "https://example.com"}

// Navigate to .onion - automatically enables Tor
{"command": "navigate", "url": "https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/"}

// Navigate back to clearnet - automatically disables Tor
{"command": "navigate", "url": "https://google.com"}
```

### Example 2: Force Tor ON for sensitive investigation

```json
// Set ON mode - all traffic through Tor
{"command": "set_tor_mode", "mode": "on"}

// All navigations now route through Tor
{"command": "navigate", "url": "https://example.com"}
{"command": "navigate", "url": "https://google.com"}
```

### Example 3: Switch back to direct connection

```json
// Set OFF mode
{"command": "set_tor_mode", "mode": "off"}
```

---

## Important Notes

1. **TOR_MODE at Startup:** For full `.onion` domain support (DNS resolution through Tor), the browser must be started with `TOR_MODE=1` or `--tor-mode` flag. Without this, dynamic routing works for clearnet sites through Tor but may not resolve `.onion` DNS.

2. **Daemon vs Routing:** The Tor daemon can be running independently of routing. The master switch controls routing, not the daemon lifecycle. Use `tor_start`/`tor_stop` to control the daemon.

3. **Default Mode:** The default mode is `OFF` (direct connection).

4. **Mode Persistence:** The mode is not persisted across browser restarts. It resets to `OFF` on startup.

---

## Integration with palletai

AI agents using palletai can now use the master switch for smarter automation:

```python
# Set AUTO mode at the start of investigation
await browser.send_command("set_tor_mode", {"mode": "auto"})

# Agent navigates to various URLs - Tor routing handled automatically
for url in urls_to_investigate:
    await browser.send_command("navigate", {"url": url})
    # Screenshots, evidence capture, etc.

# If suspicious activity detected, switch to ON mode
await browser.send_command("set_tor_mode", {"mode": "on"})
```

---

## Architectural Clarification

**The Tor Master Switch is the ONLY network routing control in basset-hound-browser.**

| Feature | Location | Status |
|---------|----------|--------|
| Tor Master Switch (OFF/ON/AUTO) | basset-hound-browser | ✅ IN SCOPE |
| Tor daemon control | basset-hound-browser | ✅ IN SCOPE |
| Tor identity/circuit management | basset-hound-browser | ✅ IN SCOPE |
| .onion site access | basset-hound-browser | ✅ IN SCOPE |
| Generic proxy pools | basset-hound-networking | ❌ OUT OF SCOPE |
| Proxy rotation strategies | basset-hound-networking | ❌ OUT OF SCOPE |
| Proxy health checking | basset-hound-networking | ❌ OUT OF SCOPE |

**Why Tor is in scope:** Tor integration directly enables network forensics capabilities - accessing .onion sites, anonymous browsing for investigations, and exit node rotation. This is similar to how Tor Browser has Tor built-in but doesn't have generic proxy pool management.

**Why generic proxies are out of scope:** Proxy pool management, rotation strategies, and health checking are infrastructure concerns that belong in a dedicated networking service (`basset-hound-networking`), not in a browser automation tool.

---

## Related Documentation

- [TOR-IMPLEMENTATION-COMPLETE-2026-01-21.md](TOR-IMPLEMENTATION-COMPLETE-2026-01-21.md) - Full Tor integration
- [SCOPE-CLEANUP-AND-PERFORMANCE-2026-01-21.md](SCOPE-CLEANUP-AND-PERFORMANCE-2026-01-21.md) - Scope cleanup
- [ROADMAP.md](../ROADMAP.md) - Project roadmap
- [SCOPE.md](../SCOPE.md) - Project scope definition

---

*Document generated: 2026-01-21*
