# DevTools and Console Access

This document describes the DevTools and Console access features in Basset Hound Browser.

## Overview

The DevTools and Console access system provides programmatic access to browser developer tools functionality, including:

- Opening/closing DevTools windows
- Capturing console logs from web pages
- Executing JavaScript in page context
- Monitoring network requests (HAR format support)
- Getting performance metrics
- Code coverage data

## Console Manager

The `ConsoleManager` class (`devtools/console.js`) captures and manages console logs from web pages.

### Features

- Real-time console log capture (log, warn, error, info, debug)
- Unhandled error and promise rejection capture
- Execute JavaScript in page context
- Subscribe to console events for real-time updates
- Export logs to JSON

### Console Message Structure

Each console message is stored with the following properties:

```javascript
{
  id: "log-1703570000000-abc123",
  type: "log" | "warn" | "error" | "info" | "debug",
  message: "The log message content",
  source: "https://example.com/script.js",
  line: 42,
  column: 15,
  timestamp: 1703570000000,
  stackTrace: "Error: ...\n    at ...",
  args: ["formatted", "arguments"]
}
```

### API Methods

#### getConsoleLogs(options)

Get console logs with optional filtering.

**Options:**
- `types`: Array of types to filter (e.g., `['error', 'warn']`)
- `limit`: Maximum number of logs to return
- `offset`: Skip first N logs
- `since`: Only logs after this timestamp
- `search`: Search term to filter by

**Returns:**
```javascript
{
  success: true,
  logs: [...],
  total: 100,
  filtered: 25
}
```

#### clearConsoleLogs()

Clear all captured console logs.

**Returns:**
```javascript
{
  success: true,
  cleared: 50
}
```

#### executeInConsole(code, options)

Execute JavaScript code in the page context.

**Options:**
- `timeout`: Execution timeout in ms (default: 5000)
- `returnValue`: Whether to return the result (default: true)

**Returns:**
```javascript
{
  success: true,
  result: "execution result",
  type: "string",
  executionId: "exec-123",
  duration: 5.2
}
```

## DevTools Manager

The `DevToolsManager` class (`devtools/manager.js`) manages DevTools window and network logging.

### Features

- Open/close DevTools windows
- Network request logging (HAR format)
- Performance metrics collection
- Code coverage data

### API Methods

#### openDevTools(options)

Open the DevTools window.

**Options:**
- `mode`: DevTools position ('right', 'bottom', 'undocked')
- `activate`: Whether to focus the DevTools window

**Returns:**
```javascript
{
  success: true,
  message: "DevTools opened",
  mode: "right"
}
```

#### closeDevTools()

Close the DevTools window.

**Returns:**
```javascript
{
  success: true,
  message: "DevTools closed"
}
```

#### isDevToolsOpen()

Check if DevTools is currently open.

**Returns:**
```javascript
{
  success: true,
  isOpen: true
}
```

#### getNetworkLogs(options)

Get captured network requests.

**Options:**
- `limit`: Maximum number of logs
- `offset`: Skip first N logs
- `resourceType`: Filter by resource type (script, stylesheet, image, etc.)
- `status`: Filter by HTTP status code
- `search`: Search in URL
- `format`: Output format ('simple' or 'har')

**Returns (simple format):**
```javascript
{
  success: true,
  logs: [...],
  total: 50,
  filtered: 10,
  isLogging: true
}
```

**Returns (HAR format):**
```javascript
{
  success: true,
  har: {
    log: {
      version: "1.2",
      creator: { name: "Basset Hound Browser", version: "1.0.0" },
      entries: [...]
    }
  },
  total: 50,
  filtered: 10
}
```

#### clearNetworkLogs()

Clear all network logs.

**Returns:**
```javascript
{
  success: true,
  cleared: 100
}
```

#### getPerformanceMetrics()

Get page performance metrics.

**Returns:**
```javascript
{
  success: true,
  metrics: {
    domContentLoaded: 150,
    load: 500,
    firstPaint: 120,
    firstContentfulPaint: 200,
    ttfb: 50,
    resources: [...],
    memory: {
      usedJSHeapSize: 10000000,
      totalJSHeapSize: 15000000,
      jsHeapSizeLimit: 2000000000
    }
  },
  cached: false
}
```

#### getCoverage()

Get code coverage data.

**Returns:**
```javascript
{
  success: true,
  coverage: {
    scripts: [...],
    stylesheets: [...],
    timestamp: 1703570000000
  },
  cached: false
}
```

## WebSocket Commands

The following commands are available via the WebSocket API:

### DevTools Commands

| Command | Description | Parameters |
|---------|-------------|------------|
| `open_devtools` | Open DevTools window | `mode`, `activate` |
| `close_devtools` | Close DevTools window | - |
| `get_network_logs` | Get network request logs | `limit`, `offset`, `format`, etc. |
| `clear_network_logs` | Clear network logs | - |
| `get_performance` | Get performance metrics | - |
| `get_devtools_status` | Get DevTools status | - |

### Console Commands

| Command | Description | Parameters |
|---------|-------------|------------|
| `get_console_logs` | Get console logs | `types`, `limit`, `since`, etc. |
| `clear_console` | Clear console logs | - |
| `execute_console` | Execute code in console | `code`, `timeout` |

## Preload API

The following methods are exposed via `window.electronAPI`:

### DevTools

```javascript
// Open/Close DevTools
await electronAPI.openDevTools({ mode: 'right' });
await electronAPI.closeDevTools();
await electronAPI.toggleDevTools();
const isOpen = await electronAPI.isDevToolsOpen();

// Network Logging
await electronAPI.startNetworkLogging();
await electronAPI.stopNetworkLogging();
const logs = await electronAPI.getNetworkLogs({ format: 'har' });
await electronAPI.clearNetworkLogs();
const stats = await electronAPI.getNetworkStats();

// Performance
const metrics = await electronAPI.getPerformanceMetrics();
const coverage = await electronAPI.getCoverage();
```

### Console

```javascript
// Get Logs
const logs = await electronAPI.getConsoleLogs({ types: ['error'] });
const errors = await electronAPI.getConsoleErrors();
const warnings = await electronAPI.getConsoleWarnings();

// Clear
await electronAPI.clearConsoleLogs();

// Execute Code
const result = await electronAPI.executeInConsole('document.title');

// Capture Control
await electronAPI.startConsoleCapture();
await electronAPI.stopConsoleCapture();
const status = await electronAPI.getConsoleStatus();

// Export
const exported = await electronAPI.exportConsoleLogs();
```

## Console Capture Script

The console capture script is automatically injected into pages and intercepts:

- `console.log()`
- `console.warn()`
- `console.error()`
- `console.info()`
- `console.debug()`
- Unhandled errors (`window.onerror`)
- Unhandled promise rejections

The script preserves original console behavior while capturing logs for the manager.

## Network Log Format (HAR)

Network logs can be exported in HAR (HTTP Archive) format, which is compatible with tools like Chrome DevTools Network panel, HAR Viewer, and other analysis tools.

Example HAR entry:
```javascript
{
  startedDateTime: "2024-12-26T00:00:00.000Z",
  time: 150,
  request: {
    method: "GET",
    url: "https://example.com/api/data",
    httpVersion: "HTTP/1.1",
    headers: [],
    queryString: [{ name: "id", value: "123" }],
    cookies: [],
    headersSize: -1,
    bodySize: -1
  },
  response: {
    status: 200,
    statusText: "OK",
    httpVersion: "HTTP/1.1",
    headers: [{ name: "content-type", value: "application/json" }],
    cookies: [],
    content: { size: -1, mimeType: "application/json" },
    redirectURL: "",
    headersSize: -1,
    bodySize: -1
  },
  cache: {},
  timings: {
    send: 0,
    wait: 150,
    receive: 0
  }
}
```

## Usage Examples

### Python WebSocket Client

```python
import asyncio
import websockets
import json

async def get_console_logs():
    async with websockets.connect('ws://localhost:8765') as ws:
        # Get all error logs
        await ws.send(json.dumps({
            'command': 'get_console_logs',
            'types': ['error']
        }))
        response = await ws.recv()
        logs = json.loads(response)
        print(f"Found {logs['filtered']} errors")

        # Execute code
        await ws.send(json.dumps({
            'command': 'execute_console',
            'code': 'window.location.href'
        }))
        response = await ws.recv()
        result = json.loads(response)
        print(f"Current URL: {result['result']}")

asyncio.run(get_console_logs())
```

### Getting Network HAR

```python
async def get_network_har():
    async with websockets.connect('ws://localhost:8765') as ws:
        await ws.send(json.dumps({
            'command': 'get_network_logs',
            'format': 'har'
        }))
        response = await ws.recv()
        har = json.loads(response)

        # Save HAR file
        with open('network.har', 'w') as f:
            json.dump(har['har'], f, indent=2)
```

## Best Practices

1. **Console Capture**: Start console capture before navigating to capture all logs
2. **Network Logging**: Enable network logging before navigation for complete request history
3. **Memory**: Set `setMaxConsoleLogs()` to limit memory usage for long-running sessions
4. **Performance**: Use filtering options to reduce data transfer for large log sets
5. **HAR Export**: Export network logs in HAR format for compatibility with analysis tools
