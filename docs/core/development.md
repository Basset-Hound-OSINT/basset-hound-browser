# Basset Hound Browser - Development Guide

Complete guide for setting up, developing, and contributing to the Basset Hound Browser.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Building](#building)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x or higher | Runtime environment |
| npm | 9.x or higher | Package manager |
| Git | Any recent version | Version control |

### Optional Software

| Software | Purpose |
|----------|---------|
| VS Code | Recommended IDE with Electron support |
| Chrome DevTools | Debugging Electron apps |
| Wine | Building Windows apps on Linux/macOS |

### System Requirements

- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 500MB for development, 1GB+ for builds
- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)

## Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd basset-hound/basset-hound-browser
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- `electron` - Application framework
- `electron-builder` - Build and packaging tool
- `ws` - WebSocket library

### 3. Verify Installation

```bash
# Check Node.js version
node --version  # Should be 18.x or higher

# Check npm version
npm --version   # Should be 9.x or higher

# Run the application
npm start
```

### 4. IDE Setup (VS Code)

Install recommended extensions:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "nickmillerdev.electron-snippets"
  ]
}
```

Create `.vscode/launch.json` for debugging:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron: Main",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": ["."],
      "outputCapture": "std"
    }
  ]
}
```

## Project Structure

```
basset-hound-browser/
├── main.js                 # Main process (Electron entry point)
├── preload.js              # Preload script (context bridge)
├── package.json            # Project configuration
├── package-lock.json       # Dependency lock file
│
├── renderer/               # Renderer process files
│   ├── index.html          # Browser UI markup
│   └── renderer.js         # Renderer process logic
│
├── websocket/              # WebSocket server
│   └── server.js           # WebSocket implementation
│
├── evasion/                # Bot detection evasion
│   ├── fingerprint.js      # Fingerprint spoofing
│   └── humanize.js         # Human behavior simulation
│
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md     # Architecture documentation
│   ├── API.md              # API reference
│   ├── EVASION.md          # Evasion techniques
│   └── DEVELOPMENT.md      # This file
│
├── assets/                 # Application assets (icons, etc.)
│   ├── icon.ico            # Windows icon
│   ├── icon.icns           # macOS icon
│   └── icon.png            # Linux icon
│
└── dist/                   # Build output (generated)
```

### File Responsibilities

| File | Process | Description |
|------|---------|-------------|
| `main.js` | Main | App lifecycle, window management, IPC handling |
| `preload.js` | Preload | Secure bridge between main and renderer |
| `renderer/index.html` | Renderer | UI structure and styling |
| `renderer/renderer.js` | Renderer | UI logic, webview control |
| `websocket/server.js` | Main | WebSocket server, command handling |
| `evasion/fingerprint.js` | Main/Renderer | Fingerprint spoofing scripts |
| `evasion/humanize.js` | Main | Human behavior simulation |

## Development Workflow

### Starting Development

```bash
# Run with DevTools open
npm run dev

# Or run in production mode
npm start
```

### Making Changes

1. **Main Process Changes** (`main.js`, `websocket/`, `evasion/`)
   - Requires app restart to see changes

2. **Renderer Process Changes** (`renderer/`)
   - Can use Ctrl+R to reload without restart

3. **Preload Script Changes** (`preload.js`)
   - Requires app restart

### Hot Reload (Manual)

For renderer changes, press `Ctrl+R` in the browser window to reload.

For a full restart:
```bash
# Stop with Ctrl+C
# Start again
npm start
```

### Watching for Changes

You can use nodemon for auto-restart:

```bash
npm install -g nodemon
nodemon --exec npm start --watch main.js --watch preload.js --watch websocket --watch evasion
```

## Code Style

### JavaScript Conventions

1. **Use ES6+ features**
   ```javascript
   // Good
   const { app, BrowserWindow } = require('electron');
   const result = items.map(item => item.value);

   // Avoid
   var result = [];
   for (var i = 0; i < items.length; i++) {
     result.push(items[i].value);
   }
   ```

2. **Use async/await over callbacks**
   ```javascript
   // Good
   async function loadData() {
     const data = await fetchData();
     return process(data);
   }

   // Avoid
   function loadData(callback) {
     fetchData(function(data) {
       callback(process(data));
     });
   }
   ```

3. **Proper error handling**
   ```javascript
   // Good
   try {
     await riskyOperation();
   } catch (error) {
     console.error('Operation failed:', error.message);
     return { success: false, error: error.message };
   }
   ```

4. **Descriptive naming**
   ```javascript
   // Good
   const userAgentList = [...];
   function getRandomViewport() { ... }

   // Avoid
   const ua = [...];
   function getVP() { ... }
   ```

### File Organization

- Keep related code together
- Export only what's needed
- Document exported functions

```javascript
/**
 * Generate a random viewport configuration
 * @returns {Object} Viewport with width and height
 */
function getRandomViewport() {
  // ...
}

module.exports = {
  getRandomViewport,
  // other exports
};
```

### Comments

```javascript
// Single line for brief explanations

/**
 * Multi-line for function documentation
 * @param {string} selector - CSS selector
 * @returns {Promise<Object>} Result object
 */

/*
 * Block comments for longer explanations
 * or temporarily disabling code
 */
```

## Testing

### Manual Testing

1. **WebSocket API Testing**

   Using Python:
   ```python
   import asyncio
   import websockets
   import json

   async def test():
       async with websockets.connect("ws://localhost:8765") as ws:
           await ws.send(json.dumps({"command": "ping"}))
           response = await ws.recv()
           print(response)

   asyncio.run(test())
   ```

   Using wscat:
   ```bash
   npm install -g wscat
   wscat -c ws://localhost:8765
   > {"command": "ping"}
   ```

2. **Bot Detection Testing**

   Navigate to these sites to test evasion:
   - `https://bot.sannysoft.com/`
   - `https://browserleaks.com/canvas`
   - `https://abrahamjuliot.github.io/creepjs/`

3. **UI Testing**

   - Test all navigation buttons
   - Test URL input and submission
   - Test loading indicators
   - Test status bar updates

### Automated Testing (Future)

Consider adding:
- Jest for unit tests
- Spectron for end-to-end testing
- Playwright for browser automation testing

```javascript
// Example unit test structure
describe('fingerprint.js', () => {
  test('getRandomViewport returns valid dimensions', () => {
    const viewport = getRandomViewport();
    expect(viewport.width).toBeGreaterThan(0);
    expect(viewport.height).toBeGreaterThan(0);
  });
});
```

## Building

### Development Build

```bash
# Create unpacked build for testing
npm run pack
```

Output: `dist/win-unpacked/`, `dist/mac/`, or `dist/linux-unpacked/`

### Production Build

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win    # Windows NSIS installer
npm run build:mac    # macOS DMG
npm run build:linux  # Linux AppImage
```

### Build Configuration

Build settings in `package.json`:

```json
{
  "build": {
    "appId": "com.bassethound.browser",
    "productName": "Basset Hound Browser",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "renderer/**/*",
      "websocket/**/*",
      "evasion/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.icns"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png"
    }
  }
}
```

### Cross-Platform Building

To build for other platforms:

**Windows from Linux/macOS:**
```bash
# Install Wine first
npm run build:win
```

**macOS from Linux/Windows:**
Requires macOS for signing/notarization. Use CI/CD service.

## Debugging

### DevTools

1. **Renderer DevTools**
   - Press `Ctrl+Shift+I` or `F12` in the app
   - Or add to `main.js`:
     ```javascript
     mainWindow.webContents.openDevTools();
     ```

2. **Webview DevTools**
   - Right-click in webview area
   - Select "Inspect Element"
   - Or:
     ```javascript
     webview.openDevTools();
     ```

### Console Logging

```javascript
// Main process
console.log('[Main] Message');

// Renderer process
console.log('[Renderer] Message');

// WebSocket server
console.log('[WebSocket] Message');
```

### VS Code Debugging

1. Set breakpoints in code
2. Use launch configuration from IDE Setup
3. Press F5 to start debugging

### Common Debug Scenarios

**IPC Not Working:**
```javascript
// Add logging to both ends
ipcMain.handle('channel', (event, data) => {
  console.log('[Main] Received:', data);
  // ...
});

ipcRenderer.invoke('channel', data).then(result => {
  console.log('[Renderer] Response:', result);
});
```

**WebSocket Issues:**
```javascript
// Server side
this.wss.on('connection', (ws) => {
  console.log('[WS] New connection');
  ws.on('message', (msg) => {
    console.log('[WS] Received:', msg.toString());
  });
});
```

## Common Tasks

### Adding a New WebSocket Command

1. **Add handler in `websocket/server.js`:**

```javascript
setupCommandHandlers() {
  // ... existing handlers

  this.commandHandlers.my_new_command = async (params) => {
    const { requiredParam } = params;
    if (!requiredParam) {
      return { success: false, error: 'requiredParam is required' };
    }

    // Implementation
    return { success: true, data: result };
  };
}
```

2. **Document in `docs/API.md`**

3. **Test the command:**
```bash
wscat -c ws://localhost:8765
> {"command": "my_new_command", "requiredParam": "value"}
```

### Adding a New Evasion Technique

1. **Add to `evasion/fingerprint.js`:**

```javascript
// New evasion script section
const newEvasionScript = `
  // Your evasion code here
`;

function getEvasionScript() {
  return `
    // existing code...
    ${newEvasionScript}
  `;
}
```

2. **Test on detection sites**

3. **Document in `docs/EVASION.md`**

### Updating User Agents

1. **Edit `evasion/fingerprint.js`:**

```javascript
const USER_AGENTS = [
  // Add new Chrome version
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  // Keep some older versions for variety
];
```

2. **Test that pages load correctly**

### Modifying the UI

1. **Edit `renderer/index.html`** for structure/styling
2. **Edit `renderer/renderer.js`** for behavior
3. Reload with `Ctrl+R` to test

## Contributing

### Contribution Workflow

1. **Fork the repository**

2. **Create a feature branch**
   ```bash
   git checkout -b feature/my-new-feature
   ```

3. **Make changes**

4. **Test thoroughly**
   - Run the app
   - Test affected features
   - Check for console errors

5. **Commit with clear message**
   ```bash
   git commit -m "Add: New feature description"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/my-new-feature
   ```

### Commit Message Format

```
Type: Brief description

Longer explanation if needed.

- Bullet points for multiple changes
- Another change
```

Types:
- `Add:` New feature
- `Fix:` Bug fix
- `Update:` Modification to existing feature
- `Remove:` Feature removal
- `Docs:` Documentation only
- `Refactor:` Code restructuring
- `Style:` Formatting, no code change

### Pull Request Guidelines

1. **Clear title and description**
2. **Link related issues**
3. **Include testing steps**
4. **Update documentation if needed**
5. **Keep changes focused**

## Troubleshooting

### Common Issues

#### `npm install` Fails

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules
npm install
```

#### Electron Won't Start

```bash
# Check for missing dependencies
npm install

# Verify Electron installation
./node_modules/.bin/electron --version

# Try running directly
./node_modules/.bin/electron .
```

#### WebSocket Connection Refused

1. Check if app is running
2. Check if port 8765 is available:
   ```bash
   lsof -i :8765  # Linux/macOS
   netstat -ano | findstr :8765  # Windows
   ```
3. Check firewall settings

#### Build Fails

```bash
# Check for errors in output
npm run build 2>&1 | tee build.log

# Common fixes:
# - Ensure all dependencies are installed
# - Check that icon files exist in assets/
# - Verify package.json build configuration
```

#### Memory Issues

If the app uses excessive memory:

1. Navigate to `about:blank` when idle
2. Clear browsing data
3. Restart the app between sessions

### Getting Help

1. Check existing issues in the repository
2. Search documentation
3. Create a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages/logs
   - System information

### Useful Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder Documentation](https://www.electron.build/)
- [WebSocket API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Node.js Documentation](https://nodejs.org/docs/)
