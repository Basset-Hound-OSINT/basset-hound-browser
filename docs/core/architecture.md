# Basset Hound Browser Architecture

This document describes the architecture of the Basset Hound Browser, an Electron-based application designed for OSINT and web automation with bot detection evasion.

## Table of Contents

- [Overview](#overview)
- [Process Model](#process-model)
- [Component Diagram](#component-diagram)
- [File Structure](#file-structure)
- [Main Process](#main-process)
- [Renderer Process](#renderer-process)
- [Preload Script](#preload-script)
- [WebSocket Server](#websocket-server)
- [Evasion Modules](#evasion-modules)
- [Communication Flow](#communication-flow)
- [Security Architecture](#security-architecture)

## Overview

Basset Hound Browser follows the standard Electron architecture with a main process and renderer process, enhanced with:

- A WebSocket server for external control
- Evasion modules for bot detection circumvention
- IPC (Inter-Process Communication) bridges for secure communication

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         External Client                                  │
│                    (Python, Node.js, etc.)                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket (ws://localhost:8765)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           MAIN PROCESS                                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │   WebSocket     │    │   IPC Main      │    │   Evasion       │     │
│  │   Server        │◄──►│   Handlers      │◄──►│   Config        │     │
│  │   (server.js)   │    │   (main.js)     │    │(fingerprint.js) │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
│                                 │                                        │
│                                 │ IPC                                    │
└─────────────────────────────────│────────────────────────────────────────┘
                                  │
┌─────────────────────────────────│────────────────────────────────────────┐
│                           PRELOAD SCRIPT                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Context Bridge                                │   │
│  │  - electronAPI (IPC methods)                                     │   │
│  │  - evasionHelpers (evasion scripts)                              │   │
│  │  - domHelpers (DOM utilities)                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────│────────────────────────────────────────┘
                                  │
┌─────────────────────────────────│────────────────────────────────────────┐
│                          RENDERER PROCESS                                │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │   Browser UI    │    │   Webview       │    │   Event         │     │
│  │   (index.html)  │◄──►│   Controller    │◄──►│   Handlers      │     │
│  │                 │    │  (renderer.js)  │    │                 │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
│                                 │                                        │
│                                 ▼                                        │
│                    ┌─────────────────────┐                               │
│                    │      Webview        │                               │
│                    │   (target pages)    │                               │
│                    └─────────────────────┘                               │
└──────────────────────────────────────────────────────────────────────────┘
```

## Process Model

### Electron Process Architecture

Electron applications consist of two types of processes:

1. **Main Process** (`main.js`)
   - Controls application lifecycle
   - Creates and manages browser windows
   - Handles native OS integration
   - Runs the WebSocket server
   - Manages IPC communication

2. **Renderer Process** (`renderer/renderer.js`)
   - Renders the UI using HTML/CSS/JavaScript
   - Manages the webview for browsing
   - Handles user interactions
   - Communicates with main process via IPC

### Preload Script

The preload script (`preload.js`) runs in an isolated context and serves as a secure bridge between the main and renderer processes. It uses Electron's Context Bridge to expose specific APIs.

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              main.js                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ BrowserWindow    │  │ Session          │  │ IPC Handlers     │       │
│  │ - createWindow() │  │ - Headers        │  │ - navigate       │       │
│  │ - webPreferences │  │ - CSP            │  │ - execute        │       │
│  │ - viewport       │  │ - Cookies        │  │ - screenshot     │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │                    WebSocketServer                            │       │
│  │  - Port 8765                                                  │       │
│  │  - Command handlers                                           │       │
│  │  - Client management                                          │       │
│  └──────────────────────────────────────────────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            preload.js                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ electronAPI      │  │ evasionHelpers   │  │ domHelpers       │       │
│  │ - navigate       │  │ - getWebview     │  │ - createElement  │       │
│  │ - clickElement   │  │   EvasionScript  │  │ - query          │       │
│  │ - fillField      │  │                  │  │ - setHTML        │       │
│  │ - getPageContent │  │                  │  │                  │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          renderer/                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │                      index.html                               │       │
│  │  - Toolbar (navigation buttons, URL bar)                      │       │
│  │  - Webview container                                          │       │
│  │  - Status bar                                                 │       │
│  └──────────────────────────────────────────────────────────────┘       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │                      renderer.js                              │       │
│  │  - Navigation functions                                       │       │
│  │  - Webview event handlers                                     │       │
│  │  - IPC listeners                                              │       │
│  │  - Evasion script injection                                   │       │
│  └──────────────────────────────────────────────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          evasion/                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │                    fingerprint.js                             │       │
│  │  - Viewport randomization                                     │       │
│  │  - User agent rotation                                        │       │
│  │  - Navigator spoofing scripts                                 │       │
│  │  - WebGL/Canvas/Audio fingerprint evasion                     │       │
│  └──────────────────────────────────────────────────────────────┘       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │                     humanize.js                               │       │
│  │  - Human delay simulation                                     │       │
│  │  - Typing simulation                                          │       │
│  │  - Mouse movement paths                                       │       │
│  │  - Scroll behavior                                            │       │
│  └──────────────────────────────────────────────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
basset-hound-browser/
├── main.js                 # Main process entry point
├── preload.js              # Preload script for context bridge
├── package.json            # Project configuration
│
├── renderer/
│   ├── index.html          # Browser UI markup
│   └── renderer.js         # Renderer process logic
│
├── websocket/
│   └── server.js           # WebSocket server implementation
│
├── evasion/
│   ├── fingerprint.js      # Fingerprint spoofing module
│   └── humanize.js         # Human behavior simulation
│
└── docs/
    ├── ARCHITECTURE.md     # This file
    ├── API.md              # API documentation
    ├── EVASION.md          # Evasion techniques documentation
    └── DEVELOPMENT.md      # Development guide
```

## Main Process

### Entry Point (main.js)

The main process is responsible for:

#### 1. Window Creation

```javascript
function createWindow() {
  // Anti-detection command line switches
  app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

  mainWindow = new BrowserWindow({
    width: viewportConfig.width,
    height: viewportConfig.height,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
    },
  });
}
```

#### 2. Session Configuration

- Sets realistic user agent
- Modifies request headers to appear human
- Strips Content-Security-Policy to allow script injection
- Handles certificate errors for OSINT on sites with bad certs

#### 3. IPC Handler Setup

Registers handlers for:
- Navigation commands
- Script execution
- Screenshot capture
- Cookie management
- Page state retrieval

#### 4. WebSocket Server Initialization

Creates the WebSocket server for external control:

```javascript
wsServer = new WebSocketServer(8765, mainWindow);
```

## Renderer Process

### UI Layer (index.html)

The UI consists of three main sections:

1. **Toolbar**
   - Logo and branding
   - Navigation buttons (back, forward, refresh, home)
   - URL input bar
   - Go button

2. **Browser Content**
   - Webview element for displaying web pages
   - Loading overlay with spinner

3. **Status Bar**
   - WebSocket connection status
   - Page loading status
   - Connected clients count
   - Current URL display

### Logic Layer (renderer.js)

Handles:

#### Navigation

```javascript
function navigateTo(url) {
  // Normalize URL (add protocol if missing)
  // Update UI
  // Load in webview
}
```

#### Webview Events

- `did-start-loading`: Show loading indicator
- `did-stop-loading`: Hide loading, inject evasion scripts
- `did-navigate`: Update URL display
- `did-fail-load`: Handle errors
- `new-window`: Handle popups

#### IPC Communication

Receives commands from main process and executes them in the webview context.

## Preload Script

The preload script creates secure bridges using `contextBridge`:

### electronAPI

Exposes IPC methods:
- `navigate(url)` - Navigate to URL
- `clickElement(selector)` - Click DOM element
- `fillField(selector, value)` - Fill form field
- `getPageContent()` - Get page HTML/text
- `captureScreenshot()` - Take screenshot
- Event listeners for main process commands

### evasionHelpers

Provides the webview evasion script that spoofs:
- `navigator.webdriver`
- `navigator.plugins`
- `navigator.languages`
- Chrome runtime object
- Automation properties

### domHelpers

DOM manipulation utilities:
- `createElement(tag, attributes, text)`
- `query(selector)`
- `queryAll(selector)`
- `setHTML(element, html)`
- `addListener(element, event, handler)`

## WebSocket Server

### Class: WebSocketServer

Located in `websocket/server.js`, this class:

1. **Manages Connections**
   - Tracks connected clients
   - Assigns unique client IDs
   - Handles connection/disconnection events

2. **Processes Commands**
   - Parses JSON messages
   - Routes to appropriate handlers
   - Returns JSON responses

3. **Command Handlers**

```javascript
this.commandHandlers = {
  navigate: async (params) => { /* ... */ },
  click: async (params) => { /* ... */ },
  fill: async (params) => { /* ... */ },
  get_content: async (params) => { /* ... */ },
  screenshot: async (params) => { /* ... */ },
  // ... more handlers
};
```

### Message Flow

```
Client                    WebSocket Server              Main Process              Renderer
  │                             │                            │                        │
  │  {"command": "click", ...}  │                            │                        │
  │────────────────────────────>│                            │                        │
  │                             │                            │                        │
  │                             │  send('click-element')     │                        │
  │                             │───────────────────────────>│                        │
  │                             │                            │                        │
  │                             │                            │  send('click-element') │
  │                             │                            │───────────────────────>│
  │                             │                            │                        │
  │                             │                            │   executeJavaScript()  │
  │                             │                            │<───────────────────────│
  │                             │                            │                        │
  │                             │  once('click-response')    │                        │
  │                             │<───────────────────────────│                        │
  │                             │                            │                        │
  │  {"success": true, ...}     │                            │                        │
  │<────────────────────────────│                            │                        │
  │                             │                            │                        │
```

## Evasion Modules

### fingerprint.js

Provides functions and data for fingerprint spoofing:

#### Data Arrays
- `VIEWPORT_SIZES` - Common screen resolutions
- `USER_AGENTS` - Realistic browser user agents
- `PLATFORMS` - Operating system platforms
- `LANGUAGES` - Language configurations
- `TIMEZONES` - Timezone configurations
- `SCREEN_CONFIGS` - Screen property configurations
- `WEBGL_RENDERERS` - GPU renderer strings
- `WEBGL_VENDORS` - GPU vendor strings

#### Functions
- `getRandomViewport()` - Random viewport with slight variation
- `getRealisticUserAgent()` - Random user agent from pool
- `getEvasionScript()` - Complete evasion script for injection
- `getFingerprintConfig()` - Full fingerprint configuration

### humanize.js

Simulates human behavior:

#### Timing Functions
- `humanDelay(min, max)` - Random delay in range
- `normalDelay(mean, stdDev)` - Gaussian-distributed delay
- `humanPause()` - Weighted random pause types

#### Interaction Simulation
- `humanType(text, options)` - Realistic typing with mistakes
- `generateMousePath(start, end, steps)` - Bezier curve mouse path
- `humanMouseMove(start, end, options)` - Animate mouse movement
- `humanScroll(options)` - Natural scrolling behavior

#### Script Generators
- `getMouseMoveScript(start, end)` - Browser-executable mouse movement
- `getScrollScript(options)` - Browser-executable scroll
- `getClickScript(selector)` - Human-like click sequence
- `getTypeScript(selector, value)` - Human-like typing

## Communication Flow

### Complete Request Flow

1. **External Client** sends WebSocket message
2. **WebSocket Server** parses command and applies humanization
3. **Main Process** receives via IPC and forwards to renderer
4. **Renderer Process** executes in webview context
5. **Response** flows back through same path

### IPC Channel Map

| Main -> Renderer | Renderer -> Main |
|------------------|------------------|
| `navigate-webview` | `webview-url-response` |
| `get-webview-url` | `webview-execute-response` |
| `execute-in-webview` | `page-content-response` |
| `get-page-content` | `screenshot-response` |
| `capture-screenshot` | `click-response` |
| `click-element` | `fill-response` |
| `fill-field` | `page-state-response` |
| `get-page-state` | `wait-response` |
| `wait-for-element` | `scroll-response` |
| `scroll` | |

## Security Architecture

### Context Isolation

The app uses context isolation (`contextIsolation: true`) to prevent:
- Renderer access to Node.js APIs
- Page scripts accessing Electron internals
- Prototype pollution attacks

### Preload Script Security

The preload script only exposes:
- Specific IPC invoke methods
- Event listeners with predefined channels
- Helper functions that don't expose internals

### No Node Integration

`nodeIntegration: false` prevents:
- Loaded pages from accessing Node.js
- XSS attacks from escalating privileges
- Arbitrary code execution

### WebSocket Security

- Server binds to localhost only
- No authentication (intentional for local use)
- JSON validation on all messages

### Certificate Handling

The app accepts invalid certificates:

```javascript
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);  // Accept all certificates
});
```

**Note**: This is intentional for OSINT purposes but reduces security. Do not use for sensitive operations.

## Performance Considerations

### Memory Management

- Webview content is isolated
- Navigation to `about:blank` releases page memory
- Regular browser restarts recommended for long sessions

### Event Loop

- Async/await used throughout
- Promise-based IPC prevents blocking
- WebSocket messages processed sequentially

### Startup Optimization

- Evasion config generated once at startup
- Preload script runs before page load
- WebSocket server starts with window creation
