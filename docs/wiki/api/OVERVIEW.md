# WebSocket API Overview

The Basset Hound Browser WebSocket API provides programmatic control of the browser.

## Connection

**Default URL:** `ws://localhost:8765`

```python
import websockets

async with websockets.connect("ws://localhost:8765") as ws:
    # Send commands here
    pass
```

## Request Format

All commands are JSON objects with at least `id` and `command` fields:

```json
{
  "id": "1",
  "command": "navigate",
  "url": "https://example.com"
}
```

## Response Format

All responses are JSON objects with status information:

```json
{
  "id": "1",
  "success": true,
  "command": "navigate",
  "data": {}
}
```

Or on error:

```json
{
  "id": "1",
  "success": false,
  "error": "Element not found",
  "code": "ELEMENT_NOT_FOUND"
}
```

## Response Codes

- `success: true` - Command succeeded
- `success: false` - Command failed (see `error` and `code`)

## Command Categories

- **Navigation** - Navigate, back, forward, refresh
- **Content Extraction** - Get HTML, text, page state
- **Interaction** - Click, fill, scroll, type, hover
- **Screenshots** - Capture page or element
- **Proxy Management** - Setup and rotate proxies
- **User Agent** - Rotate user agents
- **Bot Evasion** - Fingerprint spoofing
- **Profile Management** - Multiple browser profiles
- **Forensic Commands** - HTML capture, DOM snapshots
- **Utilities** - Status, health checks

## Complete Command Reference

See [Complete Reference](COMPLETE-REFERENCE.md) for all 140+ commands.

## Error Codes

See [Error Codes](ERROR-CODES.md) for all possible error codes and solutions.

## Protocol Details

See [WebSocket Protocol](WEBSOCKET-PROTOCOL.md) for advanced topics.

## Quick Links

- **[Navigation Commands](COMMAND-CATEGORIES.md#navigation)** - Navigate, click, scroll
- **[Content Extraction](COMMAND-CATEGORIES.md#extraction)** - Get HTML, text, page state
- **[Proxy Commands](COMMAND-CATEGORIES.md#proxy)** - Proxy setup and rotation
- **[Bot Evasion](COMMAND-CATEGORIES.md#evasion)** - Fingerprint spoofing, user agents
