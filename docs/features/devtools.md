# DevTools API Documentation

The DevTools module provides comprehensive developer tools functionality for the Basset Hound Browser, including network logging, console access, performance metrics, and code execution capabilities.

## Overview

The DevTools module consists of two main classes:

- **DevToolsManager** (`devtools/manager.js`) - Manages DevTools window, network logging, and performance metrics
- **ConsoleManager** (`devtools/console.js`) - Captures and manages console logs with code execution support

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                             │
│  ┌─────────────────┐         ┌──────────────────────┐       │
│  │ DevToolsManager │         │   ConsoleManager     │       │
│  │  - Network logs │         │  - Console capture   │       │
│  │  - Performance  │         │  - Code execution    │       │
│  │  - DevTools UI  │         │  - Event subscriptions│      │
│  └────────┬────────┘         └──────────┬───────────┘       │
│           │           IPC               │                    │
└───────────┼─────────────────────────────┼────────────────────┘
            │                             │
            ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      Renderer/Webview                        │
│  - Console intercept script                                  │
│  - Performance timing script                                 │
│  - Network events                                            │
└─────────────────────────────────────────────────────────────┘
```

---

# DevToolsManager

## Constructor

```javascript
const { DevToolsManager } = require('./devtools/manager');
const devToolsManager = new DevToolsManager(mainWindow);
```

**Parameters:**
- `mainWindow` - Electron BrowserWindow instance

---

## DevTools Window Control

### openDevTools(options)

Open the DevTools window.

**Parameters:**
- `options` (Object, optional)
  - `mode` (string) - DevTools position: `'right'`, `'bottom'`, `'undocked'`, `'detach'`
    - Default: `'right'`
  - `activate` (boolean) - Whether to focus DevTools window
    - Default: `true`

**Returns:** `Object`
```javascript
{
  success: true,
  message: 'DevTools opened',
  mode: 'right'
}
```

**WebSocket Command:**
```json
{
  "command": "devtools:open",
  "params": {
    "mode": "bottom",
    "activate": true
  }
}
```

---

### closeDevTools()

Close the DevTools window.

**Returns:** `Object`
```javascript
{
  success: true,
  message: 'DevTools closed'
}
```

**WebSocket Command:**
```json
{
  "command": "devtools:close"
}
```

---

### toggleDevTools(options)

Toggle the DevTools window open/closed.

**Parameters:**
- `options` (Object, optional) - Same as `openDevTools`

**Returns:** `Object` - Result from either `openDevTools` or `closeDevTools`

**WebSocket Command:**
```json
{
  "command": "devtools:toggle",
  "params": {
    "mode": "undocked"
  }
}
```

---

### getDevToolsState()

Check if DevTools is currently open.

**Returns:** `Object`
```javascript
{
  success: true,
  isOpen: true
}
```

---

## Network Logging

The DevToolsManager intercepts all network requests using Electron's `session.webRequest` API, capturing request details, response headers, timing, and errors.

### Network Request States

```javascript
const REQUEST_STATES = {
  PENDING: 'pending',
  COMPLETE: 'complete',
  FAILED: 'failed',
  BLOCKED: 'blocked'
};
```

---

### startNetworkLogging()

Start capturing network requests.

**Returns:** `Object`
```javascript
{
  success: true,
  message: 'Network logging started'
}
```

**WebSocket Command:**
```json
{
  "command": "devtools:startNetworkLogging"
}
```

---

### stopNetworkLogging()

Stop capturing network requests.

**Returns:** `Object`
```javascript
{
  success: true,
  message: 'Network logging stopped'
}
```

**WebSocket Command:**
```json
{
  "command": "devtools:stopNetworkLogging"
}
```

---

### getNetworkLogs(options)

Retrieve captured network logs with optional filtering.

**Parameters:**
- `options` (Object, optional)
  - `limit` (number) - Maximum logs to return
  - `offset` (number) - Number of logs to skip
  - `resourceType` (string) - Filter by resource type (e.g., 'xhr', 'script', 'image')
  - `status` (number) - Filter by HTTP status code
  - `search` (string) - Search term to filter URLs
  - `format` (string) - Output format: `'simple'` or `'har'`
    - Default: `'simple'`

**Returns:** `Object`
```javascript
// Simple format
{
  success: true,
  logs: [
    {
      id: 'req-123',
      startTime: 1705312200000,
      endTime: 1705312200500,
      request: {
        method: 'GET',
        url: 'https://example.com/api/data',
        resourceType: 'xhr',
        referrer: 'https://example.com/',
        timestamp: 1705312200000
      },
      response: {
        statusCode: 200,
        statusLine: 'HTTP/1.1 200 OK',
        headers: { 'content-type': ['application/json'] },
        timestamp: 1705312200500
      },
      state: 'complete',
      timing: {
        total: 500,
        fromCache: false
      }
    }
  ],
  total: 150,
  filtered: 10,
  isLogging: true
}

// HAR format
{
  success: true,
  har: {
    log: {
      version: '1.2',
      creator: { name: 'Basset Hound Browser', version: '1.0.0' },
      entries: [ /* HAR entries */ ]
    }
  },
  total: 150,
  filtered: 10
}
```

**WebSocket Command:**
```json
{
  "command": "devtools:getNetworkLogs",
  "params": {
    "limit": 50,
    "resourceType": "xhr",
    "format": "har"
  }
}
```

---

### clearNetworkLogs()

Clear all captured network logs.

**Returns:** `Object`
```javascript
{
  success: true,
  cleared: 150
}
```

**WebSocket Command:**
```json
{
  "command": "devtools:clearNetworkLogs"
}
```

---

### getNetworkStats()

Get statistics about captured network requests.

**Returns:** `Object`
```javascript
{
  success: true,
  stats: {
    total: 150,
    byType: {
      xhr: 45,
      script: 30,
      image: 50,
      stylesheet: 15,
      document: 10
    },
    byStatus: {
      200: 140,
      304: 5,
      404: 3,
      500: 2
    },
    totalSize: 0,
    totalTime: 75000,
    averageTime: 500,
    failed: 2,
    blocked: 0
  }
}
```

**WebSocket Command:**
```json
{
  "command": "devtools:getNetworkStats"
}
```

---

### exportNetworkLogs(format)

Export network logs in the specified format.

**Parameters:**
- `format` (string, optional) - Export format: `'json'` or `'har'`
  - Default: `'json'`

**Returns:** `Object`
```javascript
// JSON format
{
  success: true,
  data: {
    exportedAt: 1705312200000,
    totalLogs: 150,
    logs: [ /* network logs */ ]
  }
}

// HAR format
{
  success: true,
  data: {
    log: { /* HAR structure */ }
  }
}
```

**WebSocket Command:**
```json
{
  "command": "devtools:exportNetworkLogs",
  "params": {
    "format": "har"
  }
}
```

---

## Performance Metrics

### getPerformanceMetrics()

Get performance timing metrics from the current page.

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  metrics: {
    navigationStart: 1705312200000,
    domContentLoaded: 1200,
    load: 2500,
    firstPaint: 800,
    firstContentfulPaint: 1000,
    resources: [
      {
        name: 'https://example.com/script.js',
        type: 'script',
        duration: 150,
        size: 45000,
        startTime: 500
      }
    ],
    redirectTime: 0,
    dnsLookup: 20,
    tcpConnect: 50,
    sslConnect: 30,
    ttfb: 200,
    responseTime: 150,
    domParsing: 300,
    domContentLoadedTime: 100,
    loadEventTime: 50,
    memory: {
      usedJSHeapSize: 10485760,
      totalJSHeapSize: 20971520,
      jsHeapSizeLimit: 2147483648
    },
    longTasks: [],
    timestamp: 1705312200000
  },
  cached: false
}
```

**WebSocket Command:**
```json
{
  "command": "devtools:getPerformanceMetrics"
}
```

---

### getCoverage()

Get code coverage data (scripts and stylesheets loaded).

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  coverage: {
    scripts: [
      {
        src: 'https://example.com/app.js',
        type: 'text/javascript',
        async: false,
        defer: true
      }
    ],
    stylesheets: [
      {
        href: 'https://example.com/styles.css',
        media: 'all'
      }
    ],
    timestamp: 1705312200000
  },
  cached: false
}
```

**WebSocket Command:**
```json
{
  "command": "devtools:getCoverage"
}
```

---

### getStatus()

Get the current DevTools status.

**Returns:** `Object`
```javascript
{
  isDevToolsOpen: true,
  isNetworkLogging: true,
  networkLogCount: 150,
  pendingRequests: 3,
  hasPerformanceMetrics: true,
  hasCoverageData: true
}
```

**WebSocket Command:**
```json
{
  "command": "devtools:getStatus"
}
```

---

### cleanup()

Cleanup all DevTools resources.

```javascript
devToolsManager.cleanup();
```

---

# ConsoleManager

## Console Message Types

```javascript
const CONSOLE_TYPES = {
  LOG: 'log',
  WARN: 'warn',
  ERROR: 'error',
  INFO: 'info',
  DEBUG: 'debug'
};
```

---

## Constructor

```javascript
const { ConsoleManager } = require('./devtools/console');
const consoleManager = new ConsoleManager(mainWindow);
```

---

## Console Capture

### startCapture()

Start capturing console logs from web pages.

**Returns:** `Object`
```javascript
{
  success: true,
  message: 'Console capture started'
}
```

**WebSocket Command:**
```json
{
  "command": "console:startCapture"
}
```

---

### stopCapture()

Stop capturing console logs.

**Returns:** `Object`
```javascript
{
  success: true,
  message: 'Console capture stopped'
}
```

**WebSocket Command:**
```json
{
  "command": "console:stopCapture"
}
```

---

## Console Log Retrieval

### getConsoleLogs(options)

Get captured console logs with optional filtering.

**Parameters:**
- `options` (Object, optional)
  - `types` (string[]) - Filter by message types (e.g., `['error', 'warn']`)
  - `limit` (number) - Maximum logs to return
  - `offset` (number) - Number of logs to skip
  - `since` (number) - Only logs after this timestamp
  - `search` (string) - Search term to filter messages

**Returns:** `Object`
```javascript
{
  success: true,
  logs: [
    {
      id: 'log-1705312200000-abc123',
      type: 'log',
      message: 'User logged in successfully',
      source: 'https://example.com/app.js',
      line: 42,
      column: 15,
      timestamp: 1705312200000,
      stackTrace: 'Error\n    at login (app.js:42:15)\n    ...',
      args: ['User logged in successfully']
    }
  ],
  total: 500,
  filtered: 50
}
```

**WebSocket Command:**
```json
{
  "command": "console:getLogs",
  "params": {
    "types": ["error", "warn"],
    "limit": 100,
    "search": "error"
  }
}
```

---

### getLogsByType(type)

Get logs filtered by a specific type.

**Parameters:**
- `type` (string) - Console type: `'log'`, `'warn'`, `'error'`, `'info'`, `'debug'`

**Returns:** `Object`
```javascript
{
  success: true,
  logs: [ /* filtered logs */ ],
  count: 25
}
```

**WebSocket Command:**
```json
{
  "command": "console:getLogsByType",
  "params": {
    "type": "error"
  }
}
```

---

### getErrors()

Get only error logs.

**Returns:** `Object`
```javascript
{
  success: true,
  logs: [ /* error logs */ ],
  count: 10
}
```

**WebSocket Command:**
```json
{
  "command": "console:getErrors"
}
```

---

### getWarnings()

Get only warning logs.

**Returns:** `Object`
```javascript
{
  success: true,
  logs: [ /* warning logs */ ],
  count: 15
}
```

**WebSocket Command:**
```json
{
  "command": "console:getWarnings"
}
```

---

### clearConsoleLogs()

Clear all captured console logs.

**Returns:** `Object`
```javascript
{
  success: true,
  cleared: 500
}
```

**WebSocket Command:**
```json
{
  "command": "console:clear"
}
```

---

## Console Code Execution

### executeInConsole(code, options)

Execute JavaScript code in the page context.

**Parameters:**
- `code` (string) - JavaScript code to execute
- `options` (Object, optional)
  - `timeout` (number) - Execution timeout in milliseconds
    - Default: `5000`
  - `returnValue` (boolean) - Whether to return the execution result
    - Default: `true`

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  result: { /* execution result */ },
  type: 'object',  // 'string', 'number', 'boolean', 'object', 'array', 'null', 'undefined', 'error'
  executionId: 'exec-1705312200000-abc123',
  duration: 15.5
}
```

**WebSocket Command:**
```json
{
  "command": "console:execute",
  "params": {
    "code": "document.querySelectorAll('a').length",
    "timeout": 10000
  }
}
```

**Example - Get DOM element count:**
```javascript
const result = await consoleManager.executeInConsole(
  "document.querySelectorAll('*').length"
);
console.log(`Page has ${result.result} elements`);
```

**Example - Extract data:**
```javascript
const result = await consoleManager.executeInConsole(`
  Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
    tag: h.tagName,
    text: h.textContent.trim()
  }))
`);
console.log('Headings:', result.result);
```

---

## Event Subscriptions

### subscribeToConsole(callback)

Subscribe to real-time console events.

**Parameters:**
- `callback` (Function) - Callback function for console events

**Returns:** `string` - Subscription ID

**Event Types:**
- `{ type: 'new', log: {...} }` - New log entry
- `{ type: 'clear' }` - Console cleared

**Example:**
```javascript
const subscriptionId = consoleManager.subscribeToConsole((event) => {
  if (event.type === 'new') {
    console.log(`[${event.log.type}] ${event.log.message}`);
  }
});
```

---

### unsubscribeFromConsole(subscriptionId)

Unsubscribe from console events.

**Parameters:**
- `subscriptionId` (string) - Subscription ID from subscribeToConsole

**Returns:** `boolean` - Whether unsubscription was successful

---

## Configuration

### setMaxLogs(max)

Set the maximum number of logs to store.

**Parameters:**
- `max` (number) - Maximum logs to retain

**Returns:** `Object`
```javascript
{
  success: true,
  maxLogs: 5000
}
```

---

### getStatus()

Get the console capture status.

**Returns:** `Object`
```javascript
{
  isCapturing: true,
  logCount: 500,
  maxLogs: 10000,
  subscriberCount: 2
}
```

**WebSocket Command:**
```json
{
  "command": "console:getStatus"
}
```

---

### exportLogs()

Export all console logs.

**Returns:** `Object`
```javascript
{
  success: true,
  data: {
    exportedAt: 1705312200000,
    totalLogs: 500,
    logs: [ /* all logs */ ]
  }
}
```

**WebSocket Command:**
```json
{
  "command": "console:export"
}
```

---

### cleanup()

Cleanup console manager resources.

```javascript
consoleManager.cleanup();
```

---

## Complete WebSocket Command Reference

### DevTools Commands

| Command | Description |
|---------|-------------|
| `devtools:open` | Open DevTools window |
| `devtools:close` | Close DevTools window |
| `devtools:toggle` | Toggle DevTools window |
| `devtools:getStatus` | Get DevTools status |
| `devtools:startNetworkLogging` | Start network logging |
| `devtools:stopNetworkLogging` | Stop network logging |
| `devtools:getNetworkLogs` | Get network logs |
| `devtools:clearNetworkLogs` | Clear network logs |
| `devtools:getNetworkStats` | Get network statistics |
| `devtools:exportNetworkLogs` | Export network logs |
| `devtools:getPerformanceMetrics` | Get page performance metrics |
| `devtools:getCoverage` | Get code coverage data |

### Console Commands

| Command | Description |
|---------|-------------|
| `console:startCapture` | Start console capture |
| `console:stopCapture` | Stop console capture |
| `console:getLogs` | Get console logs |
| `console:getLogsByType` | Get logs by type |
| `console:getErrors` | Get error logs |
| `console:getWarnings` | Get warning logs |
| `console:clear` | Clear console logs |
| `console:execute` | Execute JavaScript |
| `console:getStatus` | Get console status |
| `console:export` | Export console logs |

---

## Configuration Options

### DevToolsManager

| Option | Default | Description |
|--------|---------|-------------|
| maxNetworkLogs | 5000 | Maximum network log entries |

### ConsoleManager

| Option | Default | Description |
|--------|---------|-------------|
| maxLogs | 10000 | Maximum console log entries |
| timeout | 5000 | Default execution timeout (ms) |

---

## Usage Examples

### Monitor Page Errors

```javascript
// Start capturing
consoleManager.startCapture();

// Subscribe to errors
consoleManager.subscribeToConsole((event) => {
  if (event.type === 'new' && event.log.type === 'error') {
    console.error(`Page error at ${event.log.source}:${event.log.line}`);
    console.error(event.log.message);
  }
});
```

### Capture Network Waterfall

```javascript
// Start logging
devToolsManager.startNetworkLogging();

// Navigate to page...
// await navigation

// Get HAR for analysis
const har = devToolsManager.getNetworkLogs({ format: 'har' });
fs.writeFileSync('waterfall.har', JSON.stringify(har.har, null, 2));
```

### Extract Page Data

```javascript
const result = await consoleManager.executeInConsole(`
  JSON.stringify({
    title: document.title,
    url: window.location.href,
    links: Array.from(document.links).map(l => l.href),
    images: Array.from(document.images).map(i => i.src)
  })
`);

const pageData = JSON.parse(result.result);
console.log('Page data:', pageData);
```

### Performance Analysis

```javascript
const metrics = await devToolsManager.getPerformanceMetrics();

if (metrics.success) {
  const { domContentLoaded, load, firstContentfulPaint } = metrics.metrics;
  console.log(`DOMContentLoaded: ${domContentLoaded}ms`);
  console.log(`Load: ${load}ms`);
  console.log(`First Contentful Paint: ${firstContentfulPaint}ms`);
}
```
