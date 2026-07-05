// ==========================================
// Module Resolution Setup (for proper relative path handling)
// ==========================================
const path = require('path');
const fs = require('fs');

// Define project root and create a helper for resolving module paths
const PROJECT_ROOT = path.join(__dirname, '../..');

// Helper function to resolve modules from project root
function resolveModule(modulePath) {
  if (modulePath.startsWith('.')) {
    // Relative require - resolve from project root
    return require(path.join(PROJECT_ROOT, modulePath));
  }
  return require(modulePath);
}

// EDGE CASE FIX #2: Electron app may be undefined in CI/headless environments
// This requires Electron to be running as the main process (via electron CLI)
const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');

// Validate electron exports
if (!app) {
  console.error('[main.js] FATAL: Electron app not available. This must be run via: npm start or electron .');
  console.error('[main.js] Current environment: DISPLAY=' + process.env.DISPLAY + ', NODE_ENV=' + process.env.NODE_ENV);
  console.error('[main.js] Electron exports:', Object.keys(require('electron')));
  process.exit(1);
}

// ==========================================
// Early Headless Mode Initialization (P1-001)
// ==========================================
// This MUST happen before any Electron initialization
// In Docker/headless environments, Electron fails to start without a display
// We need to initialize Xvfb BEFORE app.whenReady() is called

const WebSocketServer = require(path.join(PROJECT_ROOT, 'websocket/server'));
const { getRandomViewport, getRealisticUserAgent, getRealisticChromeUserAgent, getEvasionScript, getEvasionScriptWithConfig, setActiveUserAgent } = require(path.join(PROJECT_ROOT, 'evasion/fingerprint'));
const { proxyManager } = require(path.join(PROJECT_ROOT, 'proxy/manager'));
const { torManager } = require(path.join(PROJECT_ROOT, 'proxy/tor'));
// Proxy chain management has been migrated to basset-hound-networking
// const { proxyChainManager } = require(path.join(PROJECT_ROOT, 'proxy/chain'));
const { userAgentManager } = require(path.join(PROJECT_ROOT, 'utils/user-agents'));
const SessionManager = require(path.join(PROJECT_ROOT, 'sessions/manager'));
const { TabManager } = require(path.join(PROJECT_ROOT, 'tabs/manager'));
const { CookieManager, COOKIE_FORMATS } = require(path.join(PROJECT_ROOT, 'cookies/manager'));
const { DownloadManager } = require(path.join(PROJECT_ROOT, 'downloads/manager'));
const { geolocationManager } = require(path.join(PROJECT_ROOT, 'geolocation/manager'));
const { networkThrottler } = require(path.join(PROJECT_ROOT, 'network/throttling'));
const StorageManager = require(path.join(PROJECT_ROOT, 'storage/manager'));
const { DevToolsManager } = require(path.join(PROJECT_ROOT, 'devtools/manager'));
const { ConsoleManager } = require(path.join(PROJECT_ROOT, 'devtools/console'));
const { HistoryManager } = require(path.join(PROJECT_ROOT, 'history/manager'));
const { ProfileManager } = require(path.join(PROJECT_ROOT, 'profiles/manager'));
const { HeaderManager } = require(path.join(PROJECT_ROOT, 'headers/manager'));
const { PREDEFINED_PROFILES, profileStorage } = require(path.join(PROJECT_ROOT, 'headers/profiles'));
const { DOMInspector } = require(path.join(PROJECT_ROOT, 'inspector/manager'));
const { blockingManager } = require(path.join(PROJECT_ROOT, 'blocking/manager'));
const { ScriptManager } = require(path.join(PROJECT_ROOT, 'automation/scripts'));
const { memoryManager } = require(path.join(PROJECT_ROOT, 'utils/memory-manager'));
const { TechnologyManager } = require(path.join(PROJECT_ROOT, 'technology'));
const { ExtractionManager } = require(path.join(PROJECT_ROOT, 'extraction'));
const { NetworkAnalysisManager } = require(path.join(PROJECT_ROOT, 'network-analysis/manager'));
const { SessionRecordingManager, RECORDING_STATE } = require(path.join(PROJECT_ROOT, 'recording/session-recorder'));
const { ReplayEngine, REPLAY_STATE, ERROR_MODE } = require(path.join(PROJECT_ROOT, 'recording/replay'));
const { HeadlessManager, headlessManager, HEADLESS_PRESETS } = require(path.join(PROJECT_ROOT, 'headless/manager'));
const { WindowManager, WindowState } = require(path.join(PROJECT_ROOT, 'windows/manager'));
const { WindowPool, PoolEntryState } = require(path.join(PROJECT_ROOT, 'windows/pool'));
const { getUpdateManager, UPDATE_STATUS } = require(path.join(PROJECT_ROOT, 'updater/manager'));
const CertificateGenerator = require(path.join(PROJECT_ROOT, 'utils/cert-generator'));
const { ensureEmbeddedTor, checkTorAvailability, TorAutoSetup } = require(path.join(PROJECT_ROOT, 'utils/tor-auto-setup'));
const { initializeGCTuning, initializeAdvancedGCTuning } = require(path.join(PROJECT_ROOT, 'utils/gc-tuning'));
const { LazyManagerRegistry } = require(path.join(PROJECT_ROOT, 'src/managers/lazy-initializer'));
const { getSerializer } = require(path.join(PROJECT_ROOT, 'websocket/response-serializer'));

// ==========================================
// Modularized main-process concerns (Monolith-2 split)
// ==========================================
// Each factory/registry below is IMPORT-SIDE-EFFECT-FREE: requiring it does nothing
// until invoked. They are called at the SAME boot points as the original inline code so
// side-effect ORDER is preserved (see the mode-config / recovery / guards / IPC sections).
const { createModeConfig } = require('./mode-config');
const { createSessionRecovery } = require('./session-recovery');
const { createRuntimeGuards } = require('./runtime-guards');
const { registerAllIpcHandlers } = require('./ipc');

// ==========================================
// Garbage Collection Tuning (OPT-07 + OPT-12)
// ==========================================
const gcTuningResult = initializeGCTuning({
  maxHeapSize: 512, // MB
  enableGCMonitoring: true,
  enablePeriodicCleanup: true,
  cleanupInterval: 60000 // 1 minute
});

// Initialize advanced GC tuning (OPT-12)
const advancedGCResult = initializeAdvancedGCTuning({
  minGCInterval: 10000,
  maxGCInterval: 120000,
  memoryThreshold: 0.85,
  aggressiveGCAt: 0.95,
  adjustInterval: 5000,
  verbose: process.env.DEBUG_GC === 'true'
});

// ==========================================
// Lazy Manager Initialization (OPT-09)
// ==========================================
const lazyManagerRegistry = new LazyManagerRegistry();

// Register non-critical managers for lazy initialization
lazyManagerRegistry.register('technology', async () => {
  return new TechnologyManager();
});

lazyManagerRegistry.register('networkAnalysis', async () => {
  return new NetworkAnalysisManager();
});

// Mark managers to preload after startup (non-blocking)
lazyManagerRegistry.markForPreload('technology');
lazyManagerRegistry.markForPreload('networkAnalysis');

// ==========================================
// Response Serialization Optimization (OPT-11)
// ==========================================
const serializer = getSerializer({
  poolSize: 32,
  bufferSize: 8192,
  largePayloadThreshold: 65536,
  enableStats: true
});

// ==========================================
// Configuration System
// ==========================================
const { initConfig } = require(path.join(PROJECT_ROOT, 'config'));

// Initialize configuration from all sources (CLI, env, file, defaults)
const configResult = initConfig({ watch: true });

// Handle --help flag
if (configResult.help) {
  console.log(configResult.helpText);
  process.exit(0);
}

// Handle --version flag
if (configResult.version) {
  const packageJson = require(path.join(PROJECT_ROOT, 'package.json'));
  console.log(`Basset Hound Browser v${packageJson.version}`);
  process.exit(0);
}

// Log configuration errors (non-fatal)
if (configResult.errors.length > 0) {
  console.warn('[Config] Configuration warnings:');
  configResult.errors.forEach(err => console.warn(`  - ${err}`));
}

// Log active configuration source
if (configResult.configPath) {
  console.log(`[Config] Loaded configuration from: ${configResult.configPath}`);
}

// Make config accessible globally for this module
const appConfig = configResult.config;

// ==========================================
// Module-Level State + Extracted Main-Process Concerns
// ==========================================
// The recovery helpers, runtime guards, and mode-config functions that used to live
// inline here were extracted (Monolith-2 split) to sibling modules under src/main/. They
// are instantiated below and CALLED at the same boot points as before, so side-effect
// order is unchanged. The manager `let` declarations remain a few lines below (kept in
// place to minimize churn); the ctx getters read those live bindings.

// Clean-shutdown flag (set true in the app 'before-quit' handler).
let isCleanShutdown = false;

// Headless mode is finalized in the app.whenReady() callback.
let isHeadlessMode = false;

// ------------------------------------------------------------------
// Mode configuration (headless / GUI / Tor / viewport)
// ------------------------------------------------------------------
// mode-config.js is import-side-effect-free; the Tor/headless app.commandLine switches
// and the random viewport are applied below at the same module-load points as before.
const {
  getHeadlessOptions,
  getGuiOptions,
  configureHeadlessMode,
  getTorOptions,
  configureTorMode,
  getViewportConfig
} = createModeConfig({ app, appConfig, headlessManager, getRandomViewport });

// Configure Tor mode before app is ready (side effect: app.commandLine flags).
const isTorMode = configureTorMode();

// Viewport configuration from config, or random for fingerprint evasion.
const viewportConfig = getViewportConfig();

// ------------------------------------------------------------------
// Shared runtime context
// ------------------------------------------------------------------
// One object handed to the extracted concern modules (session-recovery, runtime-guards,
// ipc/*). State assigned later in createWindow() is exposed via getters so consumers always
// read the LIVE value (e.g. mainWindow -> null after the window closes), exactly as the
// original module-scope closures did.
const ctx = {
  /* eslint-disable brace-style -- intentionally compact one-line live getters */
  get mainWindow() { return mainWindow; },
  get wsServer() { return wsServer; },
  get sessionManager() { return sessionManager; },
  get tabManager() { return tabManager; },
  get cookieManager() { return cookieManager; },
  get downloadManager() { return downloadManager; },
  get storageManager() { return storageManager; },
  get devToolsManager() { return devToolsManager; },
  get consoleManager() { return consoleManager; },
  get historyManager() { return historyManager; },
  get profileManager() { return profileManager; },
  get headerManager() { return headerManager; },
  get scriptManager() { return scriptManager; },
  get technologyManager() { return technologyManager; },
  get extractionManager() { return extractionManager; },
  get networkAnalysisManager() { return networkAnalysisManager; },
  get sessionRecordingManager() { return sessionRecordingManager; },
  get replayEngine() { return replayEngine; },
  get windowManager() { return windowManager; },
  get windowPool() { return windowPool; },
  get updateManager() { return updateManager; },
  /* eslint-enable brace-style */
  // Stable singletons / helpers (imported once, never reassigned).
  geolocationManager,
  networkThrottler,
  blockingManager,
  memoryManager,
  proxyManager,
  userAgentManager,
  getEvasionScript,
  createIPCPromiseWithTimeout
};

// ------------------------------------------------------------------
// Session recovery (crash detection + state persistence)
// ------------------------------------------------------------------
// session-recovery.js owns RECOVERY_CONFIG + the auto-save timer and reads live browser
// state through ctx.
const recovery = createSessionRecovery({
  app,
  dialog,
  ctx,
  recoveryOptions: appConfig.browser?.recovery || {}
});
const {
  initializeRecoveryPaths,
  createLockFile,
  removeLockFile,
  detectUncleanShutdown,
  saveSessionState,
  loadSessionState,
  clearSessionState,
  startAutoSave,
  stopAutoSave,
  offerRecovery,
  restoreSession
} = recovery;

// Expose the recovery API + config to the IPC handlers via ctx.
ctx.RECOVERY_CONFIG = recovery.RECOVERY_CONFIG;
ctx.isAutoSaveEnabled = recovery.isAutoSaveEnabled;
ctx.saveSessionState = saveSessionState;
ctx.loadSessionState = loadSessionState;
ctx.clearSessionState = clearSessionState;
ctx.startAutoSave = startAutoSave;
ctx.stopAutoSave = stopAutoSave;

// ------------------------------------------------------------------
// Runtime guards (global error handlers + memory-manager wiring)
// ------------------------------------------------------------------
const { setupGlobalErrorHandlers, setupMemoryManager } = createRuntimeGuards({
  app,
  dialog,
  session,
  memoryManager,
  appConfig,
  ctx,
  saveSessionState
});

let mainWindow = null;
let wsServer = null;
let sessionManager = null;
let tabManager = null;
let cookieManager = null;
let downloadManager = null;
let storageManager = null;
let devToolsManager = null;
let consoleManager = null;
let historyManager = null;
let profileManager = null;
let headerManager = null;
let scriptManager = null;
let technologyManager = null;
let extractionManager = null;
let networkAnalysisManager = null;
let sessionRecordingManager = null;
let replayEngine = null;
let windowManager = null;
let windowPool = null;
let updateManager = null;

// ==========================================
// Headless / GUI / Tor / viewport configuration
// ==========================================
// (Extracted to src/main/mode-config.js and instantiated above near the top of the
// module; the getViewportConfig()/configureTorMode() side effects fire there.)

async function createWindow() {
  // Remove command line switches that reveal automation
  app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
  app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process');

  const browserConfig = appConfig.browser?.window || {};

  // Base window configuration using config values
  let windowConfig = {
    width: viewportConfig.width,
    height: viewportConfig.height,
    minWidth: browserConfig.minWidth || 800,
    minHeight: browserConfig.minHeight || 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js'),
      webviewTag: true,
      sandbox: false,
      // Disable webdriver detection
      enableBlinkFeatures: ''
    },
    // Anti-fingerprinting: randomize window position based on config
    x: browserConfig.randomizePosition !== false ? Math.floor(Math.random() * 100) : undefined,
    y: browserConfig.randomizePosition !== false ? Math.floor(Math.random() * 100) : undefined
  };

  // GUI visibility toggle (opt-in; default is headless/hidden).
  // isGuiMode == true only when the operator opted in AND a display is present.
  const guiOptions = getGuiOptions();
  const isGuiMode = guiOptions.isGuiMode;
  if (guiOptions.enabled && !guiOptions.hasDisplay) {
    console.warn('[GUI] --gui/BASSET_GUI requested but no display is available; falling back to headless (window stays hidden).');
  }
  // Single source of truth for window visibility.
  windowConfig.show = isGuiMode;

  // Apply headless mode configuration if enabled — UNLESS GUI mode is on.
  // In GUI mode we intentionally skip the headless hidden/offscreen override so the
  // already-wired chrome (renderer/index.html) actually paints.
  if (isHeadlessMode && !isGuiMode) {
    windowConfig = headlessManager.getBrowserWindowConfig(windowConfig);
    console.log('[Headless] BrowserWindow configured for headless mode');
  } else if (isGuiMode) {
    console.log('[GUI] GUI mode enabled — showing browser window (headless visibility override skipped)');
  }

  mainWindow = new BrowserWindow(windowConfig);

  // Establish ONE coherent browsing identity for the guest <webview>, where pages actually load.
  // The webview has no `partition`, so it inherits session.defaultSession. Route through
  // userAgentManager.setUserAgent() (the same path the WS `set_user_agent` command uses) so the
  // UA is applied to session.defaultSession AND app.userAgentFallback AND the shell — this is
  // what makes the browsed page present a clean Chrome UA with ZERO Electron/basset-hound tokens
  // on BOTH navigator.userAgent (JS) and the wire. It also records the active UA so the injected
  // evasion script derives a coherent navigator.platform. A Chrome UA is chosen because the rest
  // of the spoof (window.chrome, plugins) describes a Chromium browser.
  const userAgent = getRealisticChromeUserAgent();
  setActiveUserAgent(userAgent);
  userAgentManager.setUserAgent(userAgent, mainWindow);

  // Initialize Header Manager with storage path
  const headerStoragePath = path.join(app.getPath('userData'), 'headers');
  headerManager = new HeaderManager({ storagePath: headerStoragePath });

  // Set up default headers for human-like appearance using config values
  const headersConfig = appConfig.network?.headers || {};
  headerManager.setRequestHeader('Accept-Language', headersConfig.acceptLanguage || 'en-US,en;q=0.9');
  headerManager.setRequestHeader('Accept-Encoding', headersConfig.acceptEncoding || 'gzip, deflate, br');
  headerManager.setRequestHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');

  // Remove headers as specified in config
  const removeHeaders = headersConfig.removeHeaders || ['Sec-Ch-Ua-Platform'];
  removeHeaders.forEach(header => headerManager.removeRequestHeader(header));

  // Add custom headers from config
  if (headersConfig.customHeaders) {
    Object.entries(headersConfig.customHeaders).forEach(([name, value]) => {
      headerManager.setRequestHeader(name, value);
    });
  }

  // Load predefined profiles into header manager
  for (const [name, profile] of Object.entries(PREDEFINED_PROFILES)) {
    headerManager.createHeaderProfile(name, profile);
  }

  // Initialize header manager (sets up webRequest handlers)
  headerManager.initialize();

  // Set up response header modification for CSP bypass
  headerManager.setResponseHeader('Content-Security-Policy', '');

  mainWindow.loadFile(path.join(__dirname, '../../renderer', 'index.html'));

  // Initialize Session Manager
  const sessionDataPath = path.join(app.getPath('userData'), 'sessions');
  sessionManager = new SessionManager(sessionDataPath);

  // Initialize Cookie Manager
  cookieManager = new CookieManager(session.defaultSession);

  // Initialize Download Manager with config values
  const downloadsConfig = appConfig.browser?.downloads || {};
  downloadManager = new DownloadManager({
    downloadPath: downloadsConfig.path || app.getPath('downloads'),
    askBeforeDownload: downloadsConfig.askBeforeDownload || false,
    maxConcurrent: downloadsConfig.maxConcurrent || 5
  });

  // Setup download manager event handlers
  setupDownloadManagerEvents();

  // Setup download progress listener ONCE (outside will-download to prevent memory leaks)
  downloadManager.on('download-progress', (downloadInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', downloadInfo);
    }
  });

  // Hook into Electron's will-download event
  session.defaultSession.on('will-download', (event, downloadItem, webContents) => {
    // Register the download with our download manager
    const download = downloadManager.registerDownload(downloadItem, webContents);
  });

  // Initialize Tab Manager with config values
  const tabsConfig = appConfig.browser?.tabs || {};
  tabManager = new TabManager({
    homePage: tabsConfig.homePage || 'https://www.google.com',
    maxTabs: tabsConfig.maxTabs || 50,
    onTabCreated: (tab) => {
      if (mainWindow) {
        mainWindow.webContents.send('tab-created', tab);
      }
    },
    onTabClosed: (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('tab-closed', data);
      }
    },
    onTabSwitched: (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('tab-switched', data);
      }
    },
    onTabUpdated: (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('tab-updated', data);
      }
    }
  });

  // Wait for renderer to be ready before creating the initial tab
  // This fixes a race condition where tab-created IPC was sent before renderer was listening
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('[Main] Renderer finished loading, creating initial tab');
    // Create initial tab if configured
    if (tabsConfig.defaultTab !== false) {
      // Use positional URL argument if provided, otherwise use home page
      const startupUrl = configResult.positionalArgs?.[0] || tabsConfig.homePage || 'https://www.google.com';
      tabManager.createTab({ url: startupUrl, active: true });
    }
  });

  // Initialize Network Throttler with webContents for CDP access
  networkThrottler.initialize(mainWindow.webContents);

  // Initialize DevTools Manager
  devToolsManager = new DevToolsManager(mainWindow);

  // Initialize Console Manager
  consoleManager = new ConsoleManager(mainWindow);

  // Start console capture and network logging
  consoleManager.startCapture();
  devToolsManager.startNetworkLogging();

  // Initialize Profile Manager
  const profileDataPath = path.join(app.getPath('userData'), 'profiles');
  profileManager = new ProfileManager(profileDataPath, mainWindow);

  // Initialize Storage Manager
  storageManager = new StorageManager(mainWindow);

  // Handle storage operation responses from renderer
  ipcMain.on('storage-operation-response', (event, { operationId, result, error }) => {
    if (storageManager) {
      storageManager.handleOperationResponse(operationId, result, error);
    }
  });

  // Initialize Script Manager for automation
  const automationDataPath = path.join(__dirname, '../../automation', 'saved');
  scriptManager = new ScriptManager({
    storagePath: automationDataPath,
    mainWindow
  });

  // Initialize History Manager
  const historyDataPath = path.join(app.getPath('userData'), 'history');
  historyManager = new HistoryManager({
    dataPath: historyDataPath,
    onEntryAdded: (entry) => {
      if (mainWindow) {
        mainWindow.webContents.send('history-entry-added', entry);
      }
    },
    onHistoryCleared: () => {
      if (mainWindow) {
        mainWindow.webContents.send('history-cleared');
      }
    }
  });

  // Initialize Technology Manager
  technologyManager = new TechnologyManager();

  // Initialize Extraction Manager
  extractionManager = new ExtractionManager();

  // Initialize Network Analysis Manager
  networkAnalysisManager = new NetworkAnalysisManager();

  // Initialize Session Recording Manager for action recording
  sessionRecordingManager = new SessionRecordingManager({
    mainWindow,
    storagePath: path.join(__dirname, '../../recordings')
  });

  // Initialize Replay Engine for playing back recordings
  replayEngine = new ReplayEngine({
    mainWindow
  });

  // Initialize Window Manager and Window Pool for multi-window orchestration
  windowManager = new WindowManager({
    mainWindow,
    maxWindows: 20,
    homePage: 'about:blank',
    preloadPath: path.join(__dirname, '../preload/preload.js'),
    rendererPath: path.join(__dirname, '../../renderer', 'index.html')
  });

  windowPool = new WindowPool({
    minPoolSize: 2,
    maxPoolSize: 10,
    warmupDelay: 1000,
    healthCheckInterval: 60000,
    maxIdleTime: 300000,
    preloadPath: path.join(__dirname, '../preload/preload.js'),
    rendererPath: path.join(__dirname, '../../renderer', 'index.html')
  });

  // Link window manager and pool
  windowManager.setWindowPool(windowPool);

  // Initialize UpdateManager for auto-updates
  const updaterConfig = appConfig.updater || {};
  if (updaterConfig.enabled !== false) {
    updateManager = getUpdateManager({
      autoDownload: updaterConfig.autoDownload || false,
      autoInstallOnAppQuit: updaterConfig.autoInstallOnAppQuit !== false,
      allowPrerelease: updaterConfig.allowPrerelease || false,
      allowDowngrade: updaterConfig.allowDowngrade || false,
      checkInterval: updaterConfig.checkInterval || 3600000,
      channel: updaterConfig.allowPrerelease ? 'beta' : 'latest',
      provider: updaterConfig.provider || 'github',
      owner: updaterConfig.owner || null,
      repo: updaterConfig.repo || null,
      feedUrl: updaterConfig.updateServerUrl || null
    });

    // Set main window reference for IPC notifications
    updateManager.setMainWindow(mainWindow);
    updateManager.setupIpcHandlers();

    // Check for updates on startup if enabled
    if (updaterConfig.checkOnStartup !== false) {
      setTimeout(() => {
        console.log('[UpdateManager] Checking for updates on startup...');
        updateManager.checkForUpdates();
      }, 5000); // Delay to allow app to fully initialize
    }

    // Start auto-check if interval is configured
    if (updaterConfig.checkInterval > 0) {
      updateManager.startAutoCheck();
    }

    console.log('[UpdateManager] Initialized with config:', {
      autoDownload: updateManager.config.autoDownload,
      checkOnStartup: updaterConfig.checkOnStartup !== false,
      checkInterval: updateManager.config.checkInterval
    });
  }

  // Initialize WebSocket server for external communication with managers
  const serverConfig = appConfig.server || {};
  const wsPort = serverConfig.port || 8765;

  // Auto-generate SSL certificates if SSL is enabled but no certificate paths are provided
  let sslCertPath = serverConfig.ssl?.certPath;
  let sslKeyPath = serverConfig.ssl?.keyPath;
  let sslCaPath = serverConfig.ssl?.caPath;

  if (serverConfig.ssl?.enabled && (!sslCertPath || !sslKeyPath)) {
    console.log('[CertificateManager] SSL enabled but no certificates provided, auto-generating...');
    try {
      const certGenerator = new CertificateGenerator({
        logger: console
      });
      const certs = await certGenerator.ensureCertificates();
      sslCertPath = certs.certPath;
      sslKeyPath = certs.keyPath;
      sslCaPath = certs.caPath;
      console.log('[CertificateManager] SSL certificates ready:', {
        certPath: sslCertPath,
        keyPath: sslKeyPath,
        caPath: sslCaPath,
        location: certs.certsDir
      });
    } catch (error) {
      console.error('[CertificateManager] Failed to generate SSL certificates:', error.message);
      console.error('[CertificateManager] Continuing without SSL...');
    }
  }

  wsServer = new WebSocketServer(wsPort, mainWindow, {
    // Server options from config
    // C-1: pass the configured listen address through to the server so the
    // loopback-only default in config/defaults.js is actually honored.
    host: serverConfig.host,
    sslEnabled: serverConfig.ssl?.enabled || false,
    sslCertPath,
    sslKeyPath,
    sslCaPath,
    authToken: serverConfig.auth?.token,
    requireAuth: serverConfig.auth?.requireAuth || false,
    heartbeatInterval: serverConfig.heartbeat?.interval || 30000,
    heartbeatTimeout: serverConfig.heartbeat?.timeout || 60000,
    // Managers
    sessionManager,
    tabManager,
    cookieManager,
    downloadManager,
    geolocationManager,
    networkThrottler,
    devToolsManager,
    consoleManager,
    profileManager,
    storageManager,
    scriptManager,
    historyManager,
    blockingManager,
    headerManager,
    memoryManager,
    torManager,
    // proxyChainManager was migrated to basset-hound-networking
    technologyManager,
    extractionManager,
    networkAnalysisManager,
    sessionRecordingManager,
    replayEngine,
    headlessManager,
    windowManager,
    windowPool,
    updateManager
  });

  console.log(`[WebSocket] Server initialized on port ${wsPort}`);

  // Set main window reference for headless manager
  headlessManager.setMainWindow(mainWindow);
  headlessManager.setWebSocketServer(wsServer);

  // Enable offscreen rendering if in headless mode (never in GUI mode — a visible
  // window must render on-screen, not offscreen).
  if (isHeadlessMode && !isGuiMode && headlessManager.presetConfig.offscreenRendering) {
    headlessManager.enableOffscreenRendering(mainWindow.webContents);
  }

  // Initialize Memory Manager with cleanup callbacks
  setupMemoryManager();

  mainWindow.on('closed', () => {
    // Cleanup blocking manager
    if (blockingManager) {
      blockingManager.cleanup();
    }
    // Cleanup session manager
    if (sessionManager) {
      sessionManager.cleanup();
    }
    // Cleanup tab manager
    if (tabManager) {
      tabManager.cleanup();
    }
    // Cleanup download manager
    if (downloadManager) {
      downloadManager.cleanup();
    }
    // Cleanup geolocation manager
    if (geolocationManager) {
      geolocationManager.cleanup();
    }
    // Cleanup network throttler
    if (networkThrottler) {
      networkThrottler.cleanup();
    }
    // Cleanup DevTools manager
    if (devToolsManager) {
      devToolsManager.cleanup();
    }
    // Cleanup Console manager
    if (consoleManager) {
      consoleManager.cleanup();
    }
    // Cleanup Profile manager
    if (profileManager) {
      profileManager.cleanup();
    }
    // Cleanup Storage manager
    if (storageManager) {
      storageManager.cleanup();
    }
    // Cleanup Script manager
    if (scriptManager) {
      scriptManager.cleanup();
    }
    // Cleanup History manager
    if (historyManager) {
      historyManager.cleanup();
    }
    // Cleanup Header manager
    if (headerManager) {
      headerManager.cleanup();
    }
    // Cleanup Memory manager
    if (memoryManager) {
      memoryManager.cleanup();
    }
    // Cleanup Technology manager
    if (technologyManager) {
      technologyManager.cleanup && technologyManager.cleanup();
    }
    // Cleanup Extraction manager
    if (extractionManager) {
      extractionManager.cleanup && extractionManager.cleanup();
    }
    // Cleanup Network Analysis manager
    if (networkAnalysisManager) {
      networkAnalysisManager.cleanup && networkAnalysisManager.cleanup();
    }
    // Cleanup Session Recording manager
    if (sessionRecordingManager) {
      sessionRecordingManager.cleanup && sessionRecordingManager.cleanup();
    }
    // Cleanup Replay Engine
    if (replayEngine) {
      replayEngine.cleanup && replayEngine.cleanup();
    }
    // Cleanup Headless manager
    if (headlessManager) {
      headlessManager.cleanup && headlessManager.cleanup();
    }
    // Cleanup Window Pool
    if (windowPool) {
      windowPool.cleanup && windowPool.cleanup();
    }
    // Cleanup Window Manager
    if (windowManager) {
      windowManager.cleanup();
    }
    // Cleanup Update Manager
    if (updateManager) {
      updateManager.cleanup();
    }
    mainWindow = null;
    if (wsServer) {
      wsServer.close();
    }
  });

  // Setup IPC handlers
  setupIPCHandlers();
}

// Helper function to create IPC Promise with timeout to prevent memory leaks
// If renderer crashes or fails to respond, the Promise will reject after timeout
const IPC_TIMEOUT = 10000; // 10 seconds

function createIPCPromiseWithTimeout(channel, responseChannel, sendData = null) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    let responseHandler;

    const cleanup = () => {
      clearTimeout(timeoutId);
      ipcMain.removeListener(responseChannel, responseHandler);
    };

    responseHandler = (event, data) => {
      cleanup();
      resolve(data);
    };

    timeoutId = setTimeout(() => {
      ipcMain.removeListener(responseChannel, responseHandler);
      reject(new Error(`IPC timeout: No response from renderer for ${responseChannel} within ${IPC_TIMEOUT}ms`));
    }, IPC_TIMEOUT);

    ipcMain.once(responseChannel, responseHandler);

    if (sendData !== null) {
      mainWindow.webContents.send(channel, sendData);
    } else {
      mainWindow.webContents.send(channel);
    }
  });
}

function setupIPCHandlers() {
  // The ~195 ipcMain handlers were extracted to src/main/ipc/*.js (Monolith-2 split).
  // They register here — the SAME point as before (end of createWindow) — reading live
  // browser state, managers, helpers and the recovery API through the shared `ctx` object.
  registerAllIpcHandlers(ipcMain, ctx);
}

/**
 * Setup download manager event handlers
 */
function setupDownloadManagerEvents() {
  if (!downloadManager) {
    return;
  }

  downloadManager.on('download-started', (download) => {
    if (mainWindow) {
      mainWindow.webContents.send('download-started', download);
    }
    // Broadcast to WebSocket clients
    if (wsServer) {
      wsServer.broadcast({ type: 'download-started', download });
    }
  });

  downloadManager.on('download-progress', (download) => {
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', download);
    }
    // Broadcast to WebSocket clients
    if (wsServer) {
      wsServer.broadcast({ type: 'download-progress', download });
    }
  });

  downloadManager.on('download-completed', (download) => {
    if (mainWindow) {
      mainWindow.webContents.send('download-completed', download);
    }
    // Broadcast to WebSocket clients
    if (wsServer) {
      wsServer.broadcast({ type: 'download-completed', download });
    }
  });

  downloadManager.on('download-failed', (download) => {
    if (mainWindow) {
      mainWindow.webContents.send('download-failed', download);
    }
    // Broadcast to WebSocket clients
    if (wsServer) {
      wsServer.broadcast({ type: 'download-failed', download });
    }
  });

  downloadManager.on('download-cancelled', (download) => {
    if (mainWindow) {
      mainWindow.webContents.send('download-cancelled', download);
    }
    // Broadcast to WebSocket clients
    if (wsServer) {
      wsServer.broadcast({ type: 'download-cancelled', download });
    }
  });
}

/**
 * Initialize headless mode BEFORE app.whenReady()
 * Critical for Docker/headless environments - Electron fails without a display
 * This is the P1-001 bug fix: https://github.com/basset-hound/issues/P1-001
 */
function initializeHeadlessModeEarly() {
  try {
    const headlessOpts = getHeadlessOptions();
    const envDetection = headlessManager.detectHeadlessEnvironment();

    // Determine if we need headless mode
    const needsHeadless = headlessOpts.headless ||
                         !envDetection.hasDisplay ||
                         envDetection.dockerEnvironment ||
                         process.env.ELECTRON_DISABLE_SANDBOX === '1';

    if (needsHeadless) {
      console.log('[Headless-Early] Initializing headless mode EARLY (before app.whenReady)');
      console.log('[Headless-Early] Environment:', {
        docker: envDetection.dockerEnvironment,
        hasDisplay: envDetection.hasDisplay,
        displayVar: process.env.DISPLAY,
        ELECTRON_DISABLE_SANDBOX: process.env.ELECTRON_DISABLE_SANDBOX
      });

      // Step 1: Start Xvfb if needed (this happens in Docker)
      if (!envDetection.hasDisplay && process.env.DISPLAY) {
        console.log(`[Headless-Early] Starting Xvfb on ${process.env.DISPLAY}...`);
        const xvfbResult = headlessManager.startVirtualDisplay(process.env.DISPLAY.slice(1)); // Remove ':'
        if (xvfbResult.success) {
          console.log(`[Headless-Early] Xvfb started successfully on ${xvfbResult.display}`);
        } else {
          console.warn(`[Headless-Early] Failed to start Xvfb: ${xvfbResult.error}`);
          // Continue anyway - Xvfb might already be running
        }
      }

      // Step 2: Apply critical Electron flags BEFORE app initialization
      // These MUST be set before Electron tries to initialize the GPU/display
      app.commandLine.appendSwitch('no-sandbox');
      app.commandLine.appendSwitch('disable-setuid-sandbox');
      app.commandLine.appendSwitch('disable-gpu');
      app.commandLine.appendSwitch('disable-gpu-compositing');
      app.commandLine.appendSwitch('disable-software-rasterizer');
      app.commandLine.appendSwitch('disable-dev-shm-usage');
      app.commandLine.appendSwitch('disable-background-networking');
      app.commandLine.appendSwitch('disable-extensions');

      console.log('[Headless-Early] Critical Electron flags applied');

      // Step 3: Mark headless manager as initialized
      headlessManager.enabled = true;
      headlessManager.initialized = true;
      console.log('[Headless-Early] Headless mode initialized successfully');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Headless-Early] Error initializing headless mode:', error.message);
    console.error('[Headless-Early] Stack:', error.stack);
    // Don't exit - let Electron try to start normally
    return false;
  }
}

// Initialize headless mode EARLY if needed (P1-001 fix)
// This must happen BEFORE app.whenReady() for Docker environments
const earlyHeadlessInitialized = initializeHeadlessModeEarly();

app.whenReady().then(async () => {
  // Configure remaining headless settings (if not already done early)
  if (!earlyHeadlessInitialized) {
    isHeadlessMode = configureHeadlessMode();
  } else {
    isHeadlessMode = true;
  }

  // Initialize recovery system
  initializeRecoveryPaths();
  setupGlobalErrorHandlers();

  // ==========================================
  // First-run Tor Download
  // ==========================================
  // Check if embedded Tor needs to be downloaded on first use
  // Default to embedded Tor with auto-download enabled
  const torConfig = appConfig.network?.tor || {};
  if (torConfig.autoDownload !== false && torConfig.useEmbedded !== false) {
    try {
      const torAvailable = checkTorAvailability();
      if (!torAvailable) {
        console.log('[TorAutoSetup] Embedded Tor not found, initiating first-run download...');

        // Create a TorAutoSetup instance with progress events
        const torSetup = new TorAutoSetup();

        // Log progress events
        torSetup.on('progress', (progress) => {
          console.log(`[TorAutoSetup] ${progress.message} (${progress.progress}%)`);
        });

        torSetup.on('error', (error) => {
          console.error('[TorAutoSetup] Download failed:', error.message);
        });

        torSetup.on('complete', (result) => {
          if (result.existing) {
            console.log('[TorAutoSetup] Embedded Tor already available');
          } else {
            console.log('[TorAutoSetup] Tor setup complete:', result.version);
          }
        });

        // Run the download in the background (non-blocking)
        // Users can still use the browser while Tor downloads
        ensureEmbeddedTor({ force: false, skipIfAvailable: true })
          .then((result) => {
            if (!result.existing) {
              console.log('[TorAutoSetup] Tor bundle downloaded and configured successfully');
              console.log(`[TorAutoSetup] Tor version: ${result.version}`);
              console.log(`[TorAutoSetup] Bundle version: ${result.bundleVersion}`);
            }
            // Clean up temp files after successful download
            torSetup.cleanup();
          })
          .catch((error) => {
            console.error('[TorAutoSetup] Failed to setup embedded Tor:', error.message);
            console.log('[TorAutoSetup] The browser will still work, but Tor features may be limited.');
            console.log('[TorAutoSetup] You can manually run: node scripts/install/embedded-tor-setup.js');
          });
      } else {
        console.log('[TorAutoSetup] Embedded Tor is available');
      }
    } catch (error) {
      console.error('[TorAutoSetup] Error checking Tor availability:', error.message);
    }
  }

  // Check for unclean shutdown
  const hadUncleanShutdown = detectUncleanShutdown();
  let savedState = null;

  if (hadUncleanShutdown) {
    savedState = loadSessionState();
  }

  // Create the main window
  await createWindow();

  // If we had an unclean shutdown and have saved state, offer recovery
  if (hadUncleanShutdown && savedState && savedState.tabs && savedState.tabs.length > 0) {
    // Wait a moment for the window to be ready
    setTimeout(async () => {
      const shouldRestore = await offerRecovery(savedState);
      if (shouldRestore) {
        await restoreSession(savedState);
      }
      // Clear the saved state after handling
      clearSessionState();
    }, 1000);
  }

  // Create new lock file and start auto-save
  createLockFile();
  startAutoSave();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean shutdown handler
app.on('before-quit', () => {
  console.log('[Recovery] Application shutting down cleanly...');
  isCleanShutdown = true;

  // Stop auto-save
  stopAutoSave();

  // Save final state
  saveSessionState();

  // Remove lock file for clean shutdown
  removeLockFile();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

// Handle certificate errors (useful for OSINT on sites with bad certs)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (appConfig.network?.certificates?.ignoreCertificateErrors) {
    console.warn(`[Security] Bypassing certificate error for ${url}: ${error}`);
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// ==========================================
// SECURITY FIX #3: Global Error Handlers
// Prevent unhandled promise rejections and uncaught exceptions from crashing the process
// ==========================================

/**
 * Handle unhandled promise rejections
 * Logs the error and continues operation (non-fatal)
 */
process.on('unhandledRejection', (reason, promise) => {
  const errorMessage = reason?.message || String(reason) || 'Unknown error';
  const errorStack = reason?.stack || 'No stack trace available';
  const errorType = reason?.constructor?.name || 'UnhandledRejection';

  console.error('[UnhandledRejection]', {
    type: errorType,
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString()
  });

  // Log to file for debugging
  try {
    const logEntry = `[${new Date().toISOString()}] UnhandledRejection: ${errorType}\n${errorMessage}\n${errorStack}\n---\n`;
    const logPath = path.join(app.getPath('userData'), 'error-log.txt');
    fs.appendFileSync(logPath, logEntry, 'utf8');
  } catch (writeError) {
    console.error('[UnhandledRejection] Failed to write error log:', writeError.message);
  }

  // Don't exit process - log and continue
  // This allows the browser to stay running even if background promises fail
});

/**
 * Handle uncaught exceptions
 * These are fatal and cause process exit
 */
process.on('uncaughtException', (error) => {
  const errorMessage = error?.message || String(error) || 'Unknown error';
  const errorStack = error?.stack || 'No stack trace available';
  const errorType = error?.constructor?.name || 'UncaughtException';

  console.error('[UncaughtException]', {
    type: errorType,
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString()
  });

  // Log to file for debugging
  try {
    const logEntry = `[${new Date().toISOString()}] UncaughtException: ${errorType}\n${errorMessage}\n${errorStack}\n---\n`;
    const logPath = path.join(app.getPath('userData'), 'error-log.txt');
    fs.appendFileSync(logPath, logEntry, 'utf8');
  } catch (writeError) {
    console.error('[UncaughtException] Failed to write error log:', writeError.message);
  }

  // Exit on uncaught exceptions (fatal)
  process.exit(1);
});
