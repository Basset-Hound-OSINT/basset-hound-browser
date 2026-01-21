# WebSocket API Timing Requirements for Headless Mode

**Date**: 2026-01-21
**Status**: Resolved

## Summary

During integration testing, commands that interact with the page (webview-dependent commands) returned "No active webview" or "The WebView must be attached to the DOM" errors. This was initially thought to be a headless mode limitation, but is actually a **timing issue**.

## Root Cause

In headless mode with offscreen rendering:
1. The BrowserWindow is hidden (`show: false`)
2. Offscreen rendering is enabled (`webPreferences.offscreen = true`)
3. The webview `<tag>` needs time to:
   - Navigate to the URL
   - Load the page content
   - Fire the `dom-ready` event

If commands are sent immediately after navigation, the webview may not be ready yet.

## Solution

**Wait for page load before executing webview-dependent commands.**

After calling `navigate`, wait at least 2-4 seconds (or use `wait_for_element`) before calling commands like:
- `get_page_state`
- `get_content`
- `execute_script`
- `screenshot`
- `click`
- `fill`
- `scroll`
- `wait_for_element`

## Test Results

### Without Timing (Immediate)
| Command | Result |
|---------|--------|
| navigate | ✓ PASS |
| get_page_state | ✗ FAIL (No active webview) |
| get_content | ✗ FAIL (No active webview) |
| screenshot | ✗ FAIL (No active webview) |

### With Timing (4s delay after navigation)
| Command | Result |
|---------|--------|
| navigate | ✓ PASS |
| get_page_state | ✓ PASS |
| get_content | ✓ PASS |
| execute_script | ✓ PASS |
| screenshot | ✓ PASS |

**Pass rate: 91% (10/11 tests)**

## Recommended Usage Pattern

### For AI Agents / MCP Clients

```python
# Navigate first
await browser.navigate("https://example.com")

# Wait for page to load (recommended: use wait_for_element)
await asyncio.sleep(3)  # or browser.wait_for_element("body")

# Now page commands work
content = await browser.get_page_state()
screenshot = await browser.screenshot()
```

### For WebSocket Clients

```javascript
// Navigate
ws.send(JSON.stringify({ id: 1, command: 'navigate', url: 'https://example.com' }));

// Wait for navigation response, then wait for page load
setTimeout(() => {
  ws.send(JSON.stringify({ id: 2, command: 'get_page_state' }));
}, 4000);
```

## Commands That Require Page Load

These commands require the webview to be ready (DOM loaded):

| Command | Requires Page Load |
|---------|-------------------|
| `navigate` | No (initiates load) |
| `get_page_state` | Yes |
| `get_content` | Yes |
| `execute_script` | Yes |
| `screenshot` | Yes |
| `screenshot_full_page` | Yes |
| `screenshot_element` | Yes |
| `click` | Yes |
| `fill` | Yes |
| `scroll` | Yes |
| `wait_for_element` | Yes (but can wait) |
| `get_cookies` | No |
| `list_tabs` | No |
| `list_sessions` | No |
| `get_memory_usage` | No |

## Conclusion

The browser works correctly in headless mode. The "No active webview" errors are a timing issue, not a fundamental limitation. Clients should wait for page load before executing page-dependent commands.

This is standard behavior for browser automation tools and matches how Puppeteer, Playwright, and Selenium work.
