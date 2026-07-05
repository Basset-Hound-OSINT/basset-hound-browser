# Minimal GUI Strategy - Implementation Guide

**For:** Development Teams  
**Purpose:** Practical steps to implement GUI-optional architecture  
**Status:** Pre-Phase 1  

---

## Quick Start (Phase 1 Tasks)

### Task 1.1: Create Platform Abstraction Layer

**Objective:** Enable platform-specific implementations without coupling

**Files to Create:**
```
src/platform/
├── index.js                 # Platform selector
├── base/
│   ├── window-factory.js    # Abstract interface
│   ├── renderer.js          # Abstract renderer
│   └── updater.js           # Abstract updater
├── gui/
│   ├── window-factory.js    # Electron implementation
│   ├── renderer.js          # GUI rendering
│   └── updater.js           # Electron updater
└── headless/
    ├── window-factory.js    # Headless implementation
    ├── renderer.js          # No-op renderer
    └── updater.js           # REST-based updater
```

**Implementation Template:**
```javascript
// src/platform/base/window-factory.js
class WindowFactory {
  /**
   * Create a new window instance
   * @param {Object} config - Window configuration
   * @returns {Promise<Window>}
   */
  async create(config) {
    throw new Error('Not implemented');
  }
  
  /**
   * Get list of all windows
   * @returns {Promise<Array>}
   */
  async list() {
    throw new Error('Not implemented');
  }
  
  /**
   * Destroy a window
   * @param {string} windowId
   * @returns {Promise<void>}
   */
  async destroy(windowId) {
    throw new Error('Not implemented');
  }
}

module.exports = WindowFactory;
```

**Electron Implementation:**
```javascript
// src/platform/gui/window-factory.js
const { BrowserWindow } = require('electron');
const WindowFactory = require('../base/window-factory');

class ElectronWindowFactory extends WindowFactory {
  async create(config) {
    const electronWindow = new BrowserWindow({
      width: config.width || 1280,
      height: config.height || 720,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: config.preload
      }
    });
    
    return new ElectronWindowWrapper(electronWindow);
  }
  
  async list() {
    return BrowserWindow.getAllWindows();
  }
  
  async destroy(windowId) {
    const win = BrowserWindow.fromId(windowId);
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
  }
}

class ElectronWindowWrapper {
  constructor(electronWindow) {
    this.electron = electronWindow;
    this.id = electronWindow.id;
  }
  
  async loadURL(url) {
    return new Promise((resolve, reject) => {
      this.electron.webContents.on('did-finish-load', resolve);
      this.electron.webContents.on('crashed', reject);
      this.electron.loadURL(url);
    });
  }
  
  async screenshot() {
    const image = await this.electron.webContents.capturePage();
    return image.toPNG();
  }
  
  async executeScript(code) {
    return this.electron.webContents.executeJavaScript(code);
  }
  
  destroy() {
    this.electron.destroy();
  }
}

module.exports = ElectronWindowFactory;
```

**Headless Implementation:**
```javascript
// src/platform/headless/window-factory.js
const WindowFactory = require('../base/window-factory');
const puppeteer = require('puppeteer');  // Or internal engine

class HeadlessWindowFactory extends WindowFactory {
  constructor() {
    super();
    this.windows = new Map();
  }
  
  async create(config) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-gpu']
    });
    
    const page = await browser.newPage();
    const windowId = `headless-${Date.now()}`;
    
    const window = new HeadlessWindow(windowId, browser, page);
    this.windows.set(windowId, window);
    
    return window;
  }
  
  async list() {
    return Array.from(this.windows.values());
  }
  
  async destroy(windowId) {
    const window = this.windows.get(windowId);
    if (window) {
      await window.destroy();
      this.windows.delete(windowId);
    }
  }
}

class HeadlessWindow {
  constructor(id, browser, page) {
    this.id = id;
    this.browser = browser;
    this.page = page;
  }
  
  async loadURL(url) {
    return this.page.goto(url, { waitUntil: 'networkidle2' });
  }
  
  async screenshot() {
    return this.page.screenshot({ type: 'png' });
  }
  
  async executeScript(code) {
    return this.page.evaluate(code);
  }
  
  async destroy() {
    await this.browser.close();
  }
}

module.exports = HeadlessWindowFactory;
```

### Task 1.2: Create Mode Detector

**File:** `src/main/mode-detector.js`

```javascript
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

/**
 * Detect operating mode from CLI flags, environment, or config
 * Priority: CLI flag > environment variable > config file > default
 */
function detectMode() {
  // 1. Check CLI flags
  if (process.argv.includes('--gui')) {
    console.log('[Mode Detector] GUI mode selected via CLI flag');
    return 'gui';
  }
  if (process.argv.includes('--headless')) {
    console.log('[Mode Detector] Headless mode selected via CLI flag');
    return 'headless';
  }
  if (process.argv.includes('--dashboard-only')) {
    console.log('[Mode Detector] Dashboard mode selected via CLI flag');
    return 'dashboard';
  }
  
  // 2. Check environment variable
  const envMode = process.env.BASSET_MODE;
  if (envMode && ['gui', 'headless', 'dashboard'].includes(envMode)) {
    console.log(`[Mode Detector] Mode selected via BASSET_MODE env: ${envMode}`);
    return envMode;
  }
  
  // 3. Check config file
  try {
    const configPaths = [
      path.join(process.cwd(), 'config.yaml'),
      path.join(process.env.HOME || '/root', '.basset-hound', 'config.yaml'),
      path.join(process.cwd(), '..', 'config.yaml')
    ];
    
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        const config = YAML.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.mode && ['gui', 'headless', 'dashboard'].includes(config.mode)) {
          console.log(`[Mode Detector] Mode selected from config: ${config.mode}`);
          return config.mode;
        }
      }
    }
  } catch (err) {
    console.warn('[Mode Detector] Error reading config:', err.message);
  }
  
  // 4. Default
  console.log('[Mode Detector] Using default: headless mode');
  return 'headless';
}

/**
 * Get configuration for the detected mode
 */
function getModeConfig() {
  const mode = detectMode();
  
  const configs = {
    'gui': {
      mode: 'gui',
      name: 'GUI Mode',
      description: 'Interactive Electron browser with UI',
      electron: true,
      headless: false,
      wsServer: true,
      adminDashboard: true
    },
    'headless': {
      mode: 'headless',
      name: 'Headless Mode',
      description: 'Pure Node.js browser, API-only control',
      electron: false,
      headless: true,
      wsServer: true,
      adminDashboard: false
    },
    'dashboard': {
      mode: 'dashboard',
      name: 'Dashboard Mode',
      description: 'Headless browser with lightweight web dashboard',
      electron: false,
      headless: true,
      wsServer: true,
      adminDashboard: true
    }
  };
  
  return configs[mode] || configs['headless'];
}

module.exports = {
  detectMode,
  getModeConfig
};
```

### Task 1.3: Create Mode-Specific Entry Points

**File:** `src/main/main.js` (Unified Router)

```javascript
const path = require('path');
const { detectMode, getModeConfig } = require('./mode-detector');

async function startApplication() {
  const mode = detectMode();
  const config = getModeConfig();
  
  console.log(`
  ╔════════════════════════════════════════════════════╗
  ║  Basset Hound Browser                              ║
  ║  Mode: ${config.name.padEnd(40)}║
  ╚════════════════════════════════════════════════════╝
  `);
  
  // Route to appropriate entry point
  let entry;
  
  try {
    switch (mode) {
      case 'gui':
        entry = require('./main-gui');
        break;
      case 'dashboard':
        entry = require('./main-dashboard');
        break;
      case 'headless':
      default:
        entry = require('./main-headless');
        break;
    }
    
    await entry.start(config);
  } catch (err) {
    console.error('[Main] Fatal error:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Main] SIGTERM received, shutting down gracefully...');
  await startApplication().then(() => {}).catch(() => {});
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Main] SIGINT received, shutting down gracefully...');
  await startApplication().then(() => {}).catch(() => {});
  process.exit(0);
});

// Start
startApplication().catch(err => {
  console.error('[Main] Startup failed:', err);
  process.exit(1);
});

module.exports = { startApplication };
```

**File:** `src/main/main-headless.js`

```javascript
const path = require('path');
const { EventEmitter } = require('events');
const WebSocketServer = require('../websocket/server');
const RestAPIServer = require('../api/rest/server');
const HeadlessWindowFactory = require('../platform/headless/window-factory');
const Logger = require('../logging');

class HeadlessApp extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.logger = new Logger('HeadlessApp');
    this.servers = [];
    this.running = false;
  }
  
  async start() {
    this.logger.info('Starting Basset Hound Browser (Headless Mode)');
    
    try {
      // Initialize core services
      this.windowFactory = new HeadlessWindowFactory();
      this.logger.info('Window factory initialized');
      
      // Start WebSocket API server
      this.wsServer = new WebSocketServer({
        port: process.env.WS_PORT || 8765,
        windowFactory: this.windowFactory,
        logger: this.logger
      });
      await this.wsServer.start();
      this.servers.push(this.wsServer);
      this.logger.info(`WebSocket API listening on port ${this.wsServer.port}`);
      
      // Start REST API server
      this.restServer = new RestAPIServer({
        port: process.env.REST_PORT || 8766,
        windowFactory: this.windowFactory,
        logger: this.logger
      });
      await this.restServer.start();
      this.servers.push(this.restServer);
      this.logger.info(`REST API listening on port ${this.restServer.port}`);
      
      this.running = true;
      this.logger.info('Basset Hound Browser ready for connections');
      this.emit('ready');
      
    } catch (err) {
      this.logger.error('Startup failed:', err);
      await this.stop();
      throw err;
    }
  }
  
  async stop() {
    if (!this.running) return;
    
    this.logger.info('Stopping all services...');
    
    // Stop servers in reverse order
    for (const server of this.servers.reverse()) {
      try {
        await server.stop();
      } catch (err) {
        this.logger.warn('Error stopping server:', err.message);
      }
    }
    
    this.running = false;
    this.logger.info('All services stopped');
  }
}

// Export for testing and direct usage
module.exports = {
  start: async (config) => {
    const app = new HeadlessApp(config);
    await app.start();
    
    // Keep process alive
    process.on('SIGTERM', () => app.stop().then(() => process.exit(0)));
    process.on('SIGINT', () => app.stop().then(() => process.exit(0)));
    
    return app;
  },
  HeadlessApp
};
```

**File:** `src/main/main-gui.js`

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
const Logger = require('../logging');
const ElectronWindowFactory = require('../platform/gui/window-factory');
const WebSocketServer = require('../websocket/server');

class GUIApp {
  constructor(config = {}) {
    this.config = config;
    this.logger = new Logger('GUIApp');
    this.mainWindow = null;
    this.windowFactory = null;
  }
  
  async start() {
    this.logger.info('Starting Basset Hound Browser (GUI Mode)');
    
    this.windowFactory = new ElectronWindowFactory();
    
    // Wait for Electron to be ready
    await app.whenReady();
    
    // Create main window
    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    // Load renderer
    this.mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
    
    // Start WebSocket server
    this.wsServer = new WebSocketServer({
      port: 8765,
      windowFactory: this.windowFactory,
      logger: this.logger
    });
    await this.wsServer.start();
    this.logger.info('WebSocket API started');
    
    this.logger.info('GUI Application ready');
  }
  
  async stop() {
    if (this.wsServer) {
      await this.wsServer.stop();
    }
    if (app) {
      app.quit();
    }
  }
}

module.exports = {
  start: async (config) => {
    const app = new GUIApp(config);
    await app.start();
    return app;
  },
  GUIApp
};
```

### Task 1.4: Update package.json Scripts

```json
{
  "scripts": {
    "start": "node src/main/main.js",
    "start:headless": "BASSET_MODE=headless node src/main/main.js",
    "start:gui": "BASSET_MODE=gui node src/main/main.js",
    "start:gui-flags": "node src/main/main.js --gui",
    "start:dashboard": "BASSET_MODE=dashboard node src/main/main.js",
    "dev": "nodemon src/main/main.js",
    "dev:gui": "nodemon src/main/main.js --gui",
    "test:mode-detector": "jest src/main/mode-detector.test.js"
  }
}
```

### Task 1.5: Add Configuration Schema

**File:** `config.schema.yaml`

```yaml
mode:
  type: string
  enum: ['gui', 'headless', 'dashboard']
  default: 'headless'
  description: 'Operating mode'

server:
  ws:
    port:
      type: integer
      default: 8765
    host:
      type: string
      default: '0.0.0.0'
  admin:
    port:
      type: integer
      default: 8766
    host:
      type: string
      default: 'localhost'
  dashboard:
    port:
      type: integer
      default: 3000
    enabled:
      type: boolean
      default: false  # auto-enabled for 'gui' and 'dashboard' modes

electron:
  enabled:
    type: boolean
    default: false  # auto-enabled for 'gui' mode
  window:
    width:
      type: integer
      default: 1280
    height:
      type: integer
      default: 720

memory:
  maxHeap:
    type: integer
    default: 512
    description: 'Max heap size in MB'
```

### Task 1.6: Test the Implementation

**File:** `tests/unit/mode-detector.test.js`

```javascript
describe('Mode Detector', () => {
  const { detectMode, getModeConfig } = require('../../src/main/mode-detector');
  
  beforeEach(() => {
    delete process.env.BASSET_MODE;
    process.argv = ['node', 'script.js'];
  });
  
  it('should detect headless as default', () => {
    const mode = detectMode();
    expect(mode).toBe('headless');
  });
  
  it('should detect GUI from CLI flag', () => {
    process.argv.push('--gui');
    const mode = detectMode();
    expect(mode).toBe('gui');
  });
  
  it('should detect mode from environment variable', () => {
    process.env.BASSET_MODE = 'dashboard';
    const mode = detectMode();
    expect(mode).toBe('dashboard');
  });
  
  it('should prioritize CLI flag over env var', () => {
    process.env.BASSET_MODE = 'headless';
    process.argv.push('--gui');
    const mode = detectMode();
    expect(mode).toBe('gui');
  });
  
  it('should provide config for each mode', () => {
    const configs = ['gui', 'headless', 'dashboard'];
    for (const mode of configs) {
      process.env.BASSET_MODE = mode;
      const config = getModeConfig();
      expect(config.mode).toBe(mode);
      expect(config.wsServer).toBe(true);  // All modes have WS server
    }
  });
});
```

### Task 1.7: Validation Checklist

```
□ Platform abstraction layer created
  ├─ Base classes defined
  ├─ Electron implementation complete
  └─ Headless implementation complete

□ Mode detection working
  ├─ CLI flag detection
  ├─ Environment variable detection
  ├─ Config file detection
  └─ Default fallback

□ Entry points created
  ├─ main-headless.js functional
  ├─ main-gui.js functional
  ├─ main.js router working
  └─ All modes start without errors

□ Testing complete
  ├─ Mode detection tests passing
  ├─ Manual testing of each mode
  ├─ WebSocket API works in all modes
  └─ No regression in existing functionality

□ Documentation created
  ├─ Configuration guide
  ├─ Mode selection guide
  └─ Developer setup guide
```

---

## Phase 2 Preview (Decoupling)

After Phase 1 is complete and validated, Phase 2 focuses on:

1. **IPC Reduction:** Replace IPC calls with event buses
2. **Event-Driven Architecture:** Core operations don't depend on renderer
3. **Tab Management:** Use events instead of IPC
4. **Session State:** Store independently of Electron
5. **Testing:** Ensure 164 commands work in headless mode

**Estimated Phase 2 Effort:** 100-150 hours

---

## Success Criteria for Phase 1

**All of these must be true:**

1. ✅ Headless mode starts without Electron
2. ✅ WebSocket API responds in headless mode
3. ✅ All 164 commands callable in headless mode
4. ✅ GUI mode still works unchanged
5. ✅ Configuration system flexible
6. ✅ Zero breaking changes to APIs
7. ✅ Unit tests for mode detector passing
8. ✅ Manual testing of all three modes passing
9. ✅ Documentation complete and reviewed
10. ✅ Performance metrics captured

---

## Troubleshooting Guide

**Issue:** "Cannot find module 'electron'"  
**Solution:** Headless mode should not require electron. Check imports in core modules.

**Issue:** WebSocket not available in headless mode  
**Solution:** Ensure WebSocketServer doesn't depend on electron module.

**Issue:** Window factory throwing errors  
**Solution:** Check that platform-specific factories are properly instantiated based on mode.

**Issue:** Configuration not being read  
**Solution:** Verify config.yaml exists in correct location. Check BASSET_MODE env var.

---

## Next Steps After Phase 1

1. **Phase 2 Planning:** Deep-dive into IPC elimination
2. **Performance Benchmarking:** Quantify headless vs GUI overhead
3. **Team Training:** Teach team about new architecture
4. **User Communication:** Prepare migration guide
5. **Release Planning:** Schedule v13.0.0

---

**Status:** Ready for Implementation  
**Estimated Effort:** 80-120 hours (Phase 1 only)  
**Timeline:** 2 weeks with focused team
