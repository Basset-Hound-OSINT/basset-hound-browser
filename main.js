const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const WebSocketServer = require('./websocket/server');
const { getRandomViewport, getRealisticUserAgent, getEvasionScript, getEvasionScriptWithConfig } = require('./evasion/fingerprint');
const { proxyManager } = require('./proxy/manager');
const { torManager } = require('./proxy/tor');
const { proxyChainManager } = require('./proxy/chain');
const { userAgentManager } = require('./utils/user-agents');
const SessionManager = require('./sessions/manager');
const { TabManager } = require('./tabs/manager');
const { CookieManager, COOKIE_FORMATS } = require('./cookies/manager');
const { DownloadManager } = require('./downloads/manager');
const { geolocationManager } = require('./geolocation/manager');
const { networkThrottler } = require('./network/throttling');
const StorageManager = require('./storage/manager');
const { DevToolsManager } = require('./devtools/manager');
const { ConsoleManager } = require('./devtools/console');
const { HistoryManager } = require('./history/manager');
const { ProfileManager } = require('./profiles/manager');
const { HeaderManager } = require('./headers/manager');
const { PREDEFINED_PROFILES, profileStorage } = require('./headers/profiles');
const { DOMInspector } = require('./inspector/manager');
const { blockingManager } = require('./blocking/manager');
const { ScriptManager } = require('./automation/scripts');
const { memoryManager } = require('./utils/memory-manager');
const { TechnologyManager } = require('./technology');
const { ExtractionManager } = require('./extraction');
const { NetworkAnalysisManager } = require('./network-analysis/manager');
const { SessionRecordingManager, RECORDING_STATE } = require('./recording/session-recorder');
const { ReplayEngine, REPLAY_STATE, ERROR_MODE } = require('./recording/replay');
const { HeadlessManager, headlessManager, HEADLESS_PRESETS } = require('./headless/manager');
const { WindowManager, WindowState } = require('./windows/manager');
const { WindowPool, PoolEntryState } = require('./windows/pool');
const { getUpdateManager, UPDATE_STATUS } = require('./updater/manager');
const CertificateGenerator = require('./utils/cert-generator');
const { ensureEmbeddedTor, checkTorAvailability, TorAutoSetup } = require('./utils/tor-auto-setup');

// ==========================================
// Configuration System
// ==========================================
const { initConfig } = require('./config');

// Initialize configuration from all sources (CLI, env, file, defaults)
const configResult = initConfig({ watch: true });

// Handle --help flag
if (configResult.help) {
  console.log(configResult.helpText);
  process.exit(0);
}

// Handle --version flag
if (configResult.version) {
  const packageJson = require('./package.json');
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
// Error Recovery Configuration
// ==========================================
const RECOVERY_CONFIG = {
  autoSaveInterval: appConfig.browser?.recovery?.autoSaveInterval || 30000,
  recoveryFilePath: null, // Set during app ready
  lockFilePath: null, // Lock file to detect unclean shutdown
  maxRecoveryAttempts: appConfig.browser?.recovery?.maxRecoveryAttempts || 3,
  recoveryStateVersion: appConfig.browser?.recovery?.stateVersion || 1
};

// Recovery state management
let autoSaveTimer = null;
let isCleanShutdown = false;

// ==========================================
// Error Recovery Helper Functions
// ==========================================

/**
 * Initialize recovery file paths
 */
function initializeRecoveryPaths() {
  const userDataPath = app.getPath('userData');
  RECOVERY_CONFIG.recoveryFilePath = path.join(userDataPath, 'session-recovery.json');
  RECOVERY_CONFIG.lockFilePath = path.join(userDataPath, '.browser-running.lock');
}

/**
 * Create a lock file to detect unclean shutdowns
 */
function createLockFile() {
  try {
    const lockData = {
      pid: process.pid,
      startTime: Date.now(),
      version: RECOVERY_CONFIG.recoveryStateVersion
    };
    fs.writeFileSync(RECOVERY_CONFIG.lockFilePath, JSON.stringify(lockData), 'utf8');
    console.log('[Recovery] Lock file created');
  } catch (error) {
    console.error('[Recovery] Failed to create lock file:', error.message);
  }
}

/**
 * Remove the lock file on clean shutdown
 */
function removeLockFile() {
  try {
    if (fs.existsSync(RECOVERY_CONFIG.lockFilePath)) {
      fs.unlinkSync(RECOVERY_CONFIG.lockFilePath);
      console.log('[Recovery] Lock file removed');
    }
  } catch (error) {
    console.error('[Recovery] Failed to remove lock file:', error.message);
  }
}

/**
 * Check if there was an unclean shutdown
 * @returns {boolean}
 */
function detectUncleanShutdown() {
  try {
    if (fs.existsSync(RECOVERY_CONFIG.lockFilePath)) {
      const lockData = JSON.parse(fs.readFileSync(RECOVERY_CONFIG.lockFilePath, 'utf8'));
      console.log('[Recovery] Detected previous unclean shutdown (PID:', lockData.pid, ')');
      return true;
    }
  } catch (error) {
    console.error('[Recovery] Error checking lock file:', error.message);
  }
  return false;
}

/**
 * Save current session state for recovery
 */
function saveSessionState() {
  try {
    const state = {
      version: RECOVERY_CONFIG.recoveryStateVersion,
      savedAt: Date.now(),
      tabs: [],
      activeTabId: null,
      activeSessionId: null,
      windowBounds: null
    };

    // Save tab state
    if (tabManager) {
      const tabList = tabManager.listTabs();
      if (tabList.success) {
        state.tabs = tabList.tabs.map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          active: tab.active,
          pinned: tab.pinned
        }));
        state.activeTabId = tabManager.activeTabId;
      }
    }

    // Save session state
    if (sessionManager) {
      state.activeSessionId = sessionManager.activeSessionId;
    }

    // Save window bounds
    if (mainWindow && !mainWindow.isDestroyed()) {
      state.windowBounds = mainWindow.getBounds();
    }

    // Write state to file atomically (write to temp, then rename)
    const tempPath = RECOVERY_CONFIG.recoveryFilePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tempPath, RECOVERY_CONFIG.recoveryFilePath);

    console.log('[Recovery] Session state saved (' + state.tabs.length + ' tabs)');
  } catch (error) {
    console.error('[Recovery] Failed to save session state:', error.message);
  }
}

/**
 * Load saved session state
 * @returns {Object|null}
 */
function loadSessionState() {
  try {
    if (fs.existsSync(RECOVERY_CONFIG.recoveryFilePath)) {
      const data = fs.readFileSync(RECOVERY_CONFIG.recoveryFilePath, 'utf8');
      const state = JSON.parse(data);

      // Validate state version
      if (state.version !== RECOVERY_CONFIG.recoveryStateVersion) {
        console.log('[Recovery] State version mismatch, ignoring saved state');
        return null;
      }

      // Check if state is too old (more than 24 hours)
      if (Date.now() - state.savedAt > 24 * 60 * 60 * 1000) {
        console.log('[Recovery] Saved state is too old, ignoring');
        return null;
      }

      console.log('[Recovery] Loaded session state from', new Date(state.savedAt).toISOString());
      return state;
    }
  } catch (error) {
    console.error('[Recovery] Failed to load session state:', error.message);
  }
  return null;
}

/**
 * Clear saved session state after successful recovery or clean start
 */
function clearSessionState() {
  try {
    if (fs.existsSync(RECOVERY_CONFIG.recoveryFilePath)) {
      fs.unlinkSync(RECOVERY_CONFIG.recoveryFilePath);
      console.log('[Recovery] Session state cleared');
    }
  } catch (error) {
    console.error('[Recovery] Failed to clear session state:', error.message);
  }
}

/**
 * Start auto-save timer for periodic session state saving
 */
function startAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
  }

  autoSaveTimer = setInterval(() => {
    saveSessionState();
  }, RECOVERY_CONFIG.autoSaveInterval);

  console.log('[Recovery] Auto-save started (interval:', RECOVERY_CONFIG.autoSaveInterval / 1000, 'seconds)');
}

/**
 * Stop auto-save timer
 */
function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
    console.log('[Recovery] Auto-save stopped');
  }
}

/**
 * Offer recovery dialog to user
 * @param {Object} state - Saved session state
 * @returns {Promise<boolean>}
 */
async function offerRecovery(state) {
  const tabCount = state.tabs ? state.tabs.length : 0;
  const savedTime = new Date(state.savedAt).toLocaleString();

  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Restore Session', 'Start Fresh'],
    defaultId: 0,
    title: 'Recover Previous Session',
    message: 'Basset Hound Browser was not closed properly.',
    detail: `Would you like to restore your previous session?\n\n` +
            `Tabs to restore: ${tabCount}\n` +
            `Last saved: ${savedTime}`,
    cancelId: 1
  });

  return result.response === 0;
}

/**
 * Restore session from saved state
 * @param {Object} state - Saved session state
 */
async function restoreSession(state) {
  console.log('[Recovery] Starting session restoration...');

  try {
    // Restore window bounds if available
    if (state.windowBounds && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBounds(state.windowBounds);
    }

    // Restore tabs
    if (state.tabs && state.tabs.length > 0 && tabManager) {
      // Close the default tab first
      const currentTabs = tabManager.listTabs();
      if (currentTabs.success && currentTabs.tabs.length === 1) {
        const defaultTab = currentTabs.tabs[0];

        // Restore saved tabs
        for (const savedTab of state.tabs) {
          const result = tabManager.createTab({
            url: savedTab.url,
            active: savedTab.id === state.activeTabId
          });

          if (result.success && savedTab.pinned) {
            tabManager.pinTab(result.tab.id, true);
          }
        }

        // Close the original default tab if we restored at least one tab
        const newTabs = tabManager.listTabs();
        if (newTabs.success && newTabs.tabs.length > 1) {
          tabManager.closeTab(defaultTab.id);
        }
      }
    }

    console.log('[Recovery] Session restoration complete');
  } catch (error) {
    console.error('[Recovery] Error during session restoration:', error.message);
  }
}

/**
 * Setup global error handlers for uncaught exceptions
 */
function setupGlobalErrorHandlers() {
  // Handle uncaught exceptions in main process
  process.on('uncaughtException', (error) => {
    console.error('[Error] Uncaught exception:', error);

    // Try to save session state before crashing
    try {
      saveSessionState();
    } catch (e) {
      console.error('[Error] Failed to save state during crash:', e.message);
    }

    // Show error dialog
    if (app.isReady()) {
      dialog.showErrorBox(
        'Unexpected Error',
        `An unexpected error occurred:\n\n${error.message}\n\nThe application will attempt to recover on next start.`
      );
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Error] Unhandled promise rejection:', reason);

    // Save state but don't crash for promise rejections
    try {
      saveSessionState();
    } catch (e) {
      console.error('[Error] Failed to save state during promise rejection:', e.message);
    }
  });

  console.log('[Recovery] Global error handlers installed');
}

/**
 * Setup Memory Manager with cleanup callbacks and start monitoring
 */
function setupMemoryManager() {
  // Register cleanup callbacks for various caches/managers

  // Session cache cleanup
  if (session && session.defaultSession) {
    memoryManager.registerCleanupCallback('session-cache', async () => {
      try {
        await session.defaultSession.clearCache();
        console.log('[MemoryManager] Session cache cleared');
        return { cleared: true };
      } catch (error) {
        console.error('[MemoryManager] Failed to clear session cache:', error.message);
        return { cleared: false, error: error.message };
      }
    }, 5);
  }

  // History manager cleanup (clear old entries)
  if (historyManager) {
    memoryManager.registerCleanupCallback('history-trim', async () => {
      try {
        // Keep only last 7 days of history during cleanup
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const result = await historyManager.deleteBeforeDate(new Date(sevenDaysAgo));
        console.log('[MemoryManager] Old history entries cleared');
        return result;
      } catch (error) {
        console.error('[MemoryManager] Failed to trim history:', error.message);
        return { success: false, error: error.message };
      }
    }, 10);
  }

  // Console logs cleanup
  if (consoleManager) {
    memoryManager.registerCleanupCallback('console-logs', async () => {
      try {
        const result = consoleManager.clearConsoleLogs();
        console.log('[MemoryManager] Console logs cleared');
        return result;
      } catch (error) {
        console.error('[MemoryManager] Failed to clear console logs:', error.message);
        return { success: false, error: error.message };
      }
    }, 15);
  }

  // DevTools network logs cleanup
  if (devToolsManager) {
    memoryManager.registerCleanupCallback('network-logs', async () => {
      try {
        const result = devToolsManager.clearNetworkLogs();
        console.log('[MemoryManager] Network logs cleared');
        return result;
      } catch (error) {
        console.error('[MemoryManager] Failed to clear network logs:', error.message);
        return { success: false, error: error.message };
      }
    }, 15);
  }

  // Storage manager pending operations cleanup
  if (storageManager) {
    memoryManager.registerCleanupCallback('storage-pending', async () => {
      try {
        // Clear any stuck pending operations
        const count = storageManager.pendingOperations.size;
        storageManager.pendingOperations.clear();
        console.log(`[MemoryManager] Cleared ${count} pending storage operations`);
        return { cleared: count };
      } catch (error) {
        console.error('[MemoryManager] Failed to clear pending operations:', error.message);
        return { success: false, error: error.message };
      }
    }, 20);
  }

  // Get memory config
  const memoryConfig = appConfig.memory || {};

  // Start memory monitoring with configured interval
  if (memoryConfig.monitoring?.enabled !== false) {
    const monitoringInterval = memoryConfig.monitoring?.interval || 60000;
    memoryManager.startMonitoring(monitoringInterval);

    // Listen for memory status changes
    memoryManager.on('statusChange', ({ oldStatus, newStatus, memInfo }) => {
      console.log(`[MemoryManager] Status changed: ${oldStatus} -> ${newStatus} (${memInfo.heapUsedMB} MB)`);
    });

    console.log(`[MemoryManager] Memory monitoring initialized (interval: ${monitoringInterval}ms)`);
  }
}

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
// Headless Mode Configuration
// ==========================================

/**
 * Get headless options from configuration
 * Falls back to command-line arguments for backwards compatibility
 * @returns {Object} Headless options
 */
function getHeadlessOptions() {
  const args = process.argv;
  // Config takes precedence, with CLI fallback for backwards compatibility
  return {
    headless: appConfig.headless?.enabled || args.includes('--headless'),
    disableGpu: appConfig.headless?.disableGpu || args.includes('--disable-gpu'),
    noSandbox: appConfig.headless?.noSandbox || args.includes('--no-sandbox'),
    virtualDisplay: appConfig.headless?.virtualDisplay || args.includes('--virtual-display'),
    preset: appConfig.headless?.preset || null
  };
}

/**
 * Configure Electron app for headless operation
 * Must be called before app.whenReady()
 */
function configureHeadlessMode() {
  const headlessOpts = getHeadlessOptions();

  if (!headlessOpts.headless) {
    console.log('[Headless] Headless mode not enabled');
    return false;
  }

  console.log('[Headless] Configuring headless mode...');

  // Apply preset if specified
  if (headlessOpts.preset) {
    headlessManager.applyPreset(headlessOpts.preset);
    console.log(`[Headless] Applied preset: ${headlessOpts.preset}`);
  }

  // Initialize headless manager
  headlessManager.parseCommandLineArgs();

  // Apply GPU flags
  if (headlessOpts.disableGpu) {
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    console.log('[Headless] GPU disabled');
  }

  // Apply sandbox flags (needed for Docker/root)
  if (headlessOpts.noSandbox) {
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('disable-setuid-sandbox');
    console.log('[Headless] Sandbox disabled');
  }

  // Apply common headless flags
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('disable-background-networking');

  // Detect and configure virtual display
  if (headlessOpts.virtualDisplay) {
    const envDetection = headlessManager.detectHeadlessEnvironment();
    if (!envDetection.hasDisplay) {
      const result = headlessManager.startVirtualDisplay();
      if (result.success) {
        console.log(`[Headless] Virtual display started: ${result.display}`);
      } else {
        console.warn(`[Headless] Failed to start virtual display: ${result.error}`);
      }
    }
  }

  // Enable headless manager
  headlessManager.enabled = true;
  headlessManager.initialized = true;

  console.log('[Headless] Headless mode configured');
  return true;
}

// Configure headless mode before app is ready
const isHeadlessMode = configureHeadlessMode();

// Get viewport configuration from config or use random
function getViewportConfig() {
  const browserConfig = appConfig.browser?.window || {};

  // Use config values if randomization is disabled, otherwise use random viewport
  if (!browserConfig.randomizeSize) {
    return {
      width: browserConfig.width || 1280,
      height: browserConfig.height || 720
    };
  }

  // Use random viewport for fingerprint evasion
  return getRandomViewport();
}

const viewportConfig = getViewportConfig();

function createWindow() {
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
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      sandbox: false,
      // Disable webdriver detection
      enableBlinkFeatures: '',
    },
    // Anti-fingerprinting: randomize window position based on config
    x: browserConfig.randomizePosition !== false ? Math.floor(Math.random() * 100) : undefined,
    y: browserConfig.randomizePosition !== false ? Math.floor(Math.random() * 100) : undefined,
  };

  // Apply headless mode configuration if enabled
  if (isHeadlessMode) {
    windowConfig = headlessManager.getBrowserWindowConfig(windowConfig);
    console.log('[Headless] BrowserWindow configured for headless mode');
  }

  mainWindow = new BrowserWindow(windowConfig);

  // Set realistic user agent
  const userAgent = getRealisticUserAgent();
  mainWindow.webContents.setUserAgent(userAgent);

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

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

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

  // Create initial tab if configured
  if (tabsConfig.defaultTab !== false) {
    // Use positional URL argument if provided, otherwise use home page
    const startupUrl = configResult.positionalArgs?.[0] || tabsConfig.homePage || 'https://www.google.com';
    tabManager.createTab({ url: startupUrl, active: true });
  }

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
  const automationDataPath = path.join(__dirname, 'automation', 'saved');
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
    storagePath: path.join(__dirname, 'recordings')
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
    preloadPath: path.join(__dirname, 'preload.js'),
    rendererPath: path.join(__dirname, 'renderer', 'index.html')
  });

  windowPool = new WindowPool({
    minPoolSize: 2,
    maxPoolSize: 10,
    warmupDelay: 1000,
    healthCheckInterval: 60000,
    maxIdleTime: 300000,
    preloadPath: path.join(__dirname, 'preload.js'),
    rendererPath: path.join(__dirname, 'renderer', 'index.html')
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
    proxyChainManager,
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

  // Enable offscreen rendering if in headless mode
  if (isHeadlessMode && headlessManager.presetConfig.offscreenRendering) {
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
      networkAnalysisManager.cleanup();
    }
    // Cleanup Session Recording manager
    if (sessionRecordingManager) {
      sessionRecordingManager.cleanup();
    }
    // Cleanup Replay Engine
    if (replayEngine) {
      replayEngine.cleanup();
    }
    // Cleanup Headless manager
    if (headlessManager) {
      headlessManager.cleanup();
    }
    // Cleanup Window Pool
    if (windowPool) {
      windowPool.cleanup();
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
  // Navigation handlers
  ipcMain.handle('navigate', async (event, url) => {
    if (mainWindow) {
      mainWindow.webContents.send('navigate-webview', url);
      return { success: true };
    }
    return { success: false, error: 'No window available' };
  });

  ipcMain.handle('get-webview-url', async () => {
    return createIPCPromiseWithTimeout('get-webview-url', 'webview-url-response');
  });

  // Execute script in webview
  ipcMain.handle('execute-in-webview', async (event, script) => {
    return createIPCPromiseWithTimeout('execute-in-webview', 'webview-execute-response', script);
  });

  // Get page content
  ipcMain.handle('get-page-content', async () => {
    return createIPCPromiseWithTimeout('get-page-content', 'page-content-response');
  });

  // Screenshot (basic viewport)
  ipcMain.handle('capture-screenshot', async () => {
    return createIPCPromiseWithTimeout('capture-screenshot', 'screenshot-response');
  });

  // Enhanced screenshot - full page
  ipcMain.handle('screenshot-full-page', async (event, options) => {
    return createIPCPromiseWithTimeout('screenshot-full-page', 'screenshot-full-page-response', options);
  });

  // Enhanced screenshot - element
  ipcMain.handle('screenshot-element', async (event, options) => {
    return createIPCPromiseWithTimeout('screenshot-element', 'screenshot-element-response', options);
  });

  // Enhanced screenshot - area
  ipcMain.handle('screenshot-area', async (event, options) => {
    return createIPCPromiseWithTimeout('screenshot-area', 'screenshot-area-response', options);
  });

  // Enhanced screenshot - viewport with options
  ipcMain.handle('screenshot-viewport', async (event, options) => {
    return createIPCPromiseWithTimeout('screenshot-viewport', 'screenshot-viewport-response', options);
  });

  // Annotate screenshot
  ipcMain.handle('annotate-screenshot', async (event, options) => {
    return createIPCPromiseWithTimeout('annotate-screenshot', 'annotate-screenshot-response', options);
  });

  // Screen recording - start
  ipcMain.handle('start-recording', async (event, options) => {
    return createIPCPromiseWithTimeout('start-recording', 'recording-started', options);
  });

  // Screen recording - stop
  ipcMain.handle('stop-recording', async (event, options) => {
    return createIPCPromiseWithTimeout('stop-recording', 'recording-stopped', options);
  });

  // Screen recording - pause
  ipcMain.handle('pause-recording', async () => {
    return createIPCPromiseWithTimeout('pause-recording', 'recording-paused');
  });

  // Screen recording - resume
  ipcMain.handle('resume-recording', async () => {
    return createIPCPromiseWithTimeout('resume-recording', 'recording-resumed');
  });

  // Click element
  ipcMain.handle('click-element', async (event, selector) => {
    return createIPCPromiseWithTimeout('click-element', 'click-response', selector);
  });

  // Fill form field
  ipcMain.handle('fill-field', async (event, { selector, value }) => {
    return createIPCPromiseWithTimeout('fill-field', 'fill-response', { selector, value });
  });

  // Get page state (forms, links, buttons)
  ipcMain.handle('get-page-state', async () => {
    return createIPCPromiseWithTimeout('get-page-state', 'page-state-response');
  });

  // Wait for element
  ipcMain.handle('wait-for-element', async (event, { selector, timeout }) => {
    return createIPCPromiseWithTimeout('wait-for-element', 'wait-response', { selector, timeout });
  });

  // Scroll
  ipcMain.handle('scroll', async (event, { x, y, selector }) => {
    return createIPCPromiseWithTimeout('scroll', 'scroll-response', { x, y, selector });
  });

  // ==========================================
  // Cookie Management IPC Handlers
  // ==========================================

  // Get cookies for URL
  ipcMain.handle('get-cookies', async (event, url) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.getCookies(url);
  });

  // Get all cookies
  ipcMain.handle('get-all-cookies', async (event, filter) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.getAllCookies(filter || {});
  });

  // Set a single cookie
  ipcMain.handle('set-cookie', async (event, cookie) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.setCookie(cookie);
  });

  // Set multiple cookies
  ipcMain.handle('set-cookies', async (event, cookies) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.setCookies(cookies);
  });

  // Delete a specific cookie
  ipcMain.handle('delete-cookie', async (event, { url, name }) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.deleteCookie(url, name);
  });

  // Clear all cookies
  ipcMain.handle('clear-cookies', async (event, domain) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.clearCookies(domain);
  });

  // Export cookies
  ipcMain.handle('export-cookies', async (event, { format, filter }) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.exportCookies(format || 'json', filter || {});
  });

  // Import cookies
  ipcMain.handle('import-cookies', async (event, { data, format }) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.importCookies(data, format || 'auto');
  });

  // Export cookies to file
  ipcMain.handle('export-cookies-file', async (event, { filepath, format, filter }) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.exportToFile(filepath, format || 'json', filter || {});
  });

  // Import cookies from file
  ipcMain.handle('import-cookies-file', async (event, { filepath, format }) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.importFromFile(filepath, format || 'auto');
  });

  // Get cookies for domain
  ipcMain.handle('get-cookies-domain', async (event, domain) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.getCookiesForDomain(domain);
  });

  // Get cookie stats
  ipcMain.handle('get-cookie-stats', async () => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.getStats();
  });

  // Get available cookie formats
  ipcMain.handle('get-cookie-formats', async () => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return { success: true, ...cookieManager.getFormats() };
  });

  // Flush cookies to storage
  ipcMain.handle('flush-cookies', async () => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.flushCookies();
  });

  // Get evasion script for injection
  ipcMain.handle('get-evasion-script', async () => {
    return getEvasionScript();
  });

  // WebSocket status
  ipcMain.handle('get-ws-status', async () => {
    return wsServer ? wsServer.getStatus() : { connected: false, clients: 0 };
  });

  // ==========================================
  // Proxy Management IPC Handlers
  // ==========================================

  // Set proxy
  ipcMain.handle('set-proxy', async (event, proxyConfig) => {
    return await proxyManager.setProxy(proxyConfig);
  });

  // Clear proxy
  ipcMain.handle('clear-proxy', async () => {
    return await proxyManager.clearProxy();
  });

  // Get proxy status
  ipcMain.handle('get-proxy-status', async () => {
    return proxyManager.getProxyStatus();
  });

  // ==========================================
  // User Agent Management IPC Handlers
  // ==========================================

  // Set user agent
  ipcMain.handle('set-user-agent', async (event, userAgent) => {
    return userAgentManager.setUserAgent(userAgent, mainWindow);
  });

  // Get random user agent
  ipcMain.handle('get-random-user-agent', async (event, category) => {
    if (category) {
      return userAgentManager.getUserAgentByCategory(category);
    }
    return userAgentManager.getRandomUserAgent();
  });

  // Rotate user agent
  ipcMain.handle('rotate-user-agent', async () => {
    return userAgentManager.rotateUserAgent(mainWindow);
  });

  // Get user agent status
  ipcMain.handle('get-user-agent-status', async () => {
    return userAgentManager.getStatus();
  });

  // ==========================================
  // Session Management IPC Handlers
  // ==========================================

  // Create session
  ipcMain.handle('create-session', async (event, options) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return sessionManager.createSession(options);
  });

  // Switch session
  ipcMain.handle('switch-session', async (event, sessionId) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return sessionManager.switchSession(sessionId);
  });

  // Delete session
  ipcMain.handle('delete-session', async (event, sessionId) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return await sessionManager.deleteSession(sessionId);
  });

  // List sessions
  ipcMain.handle('list-sessions', async () => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return sessionManager.listSessions();
  });

  // Export session
  ipcMain.handle('export-session', async (event, sessionId) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return await sessionManager.exportSession(sessionId);
  });

  // Import session
  ipcMain.handle('import-session', async (event, data) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return await sessionManager.importSession(data);
  });

  // Get session info
  ipcMain.handle('get-session-info', async (event, sessionId) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    const info = sessionManager.getSessionInfo(sessionId || sessionManager.activeSessionId);
    return info ? { success: true, session: info } : { success: false, error: 'Session not found' };
  });

  // Clear session data
  ipcMain.handle('clear-session-data', async (event, sessionId) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return await sessionManager.clearSessionData(sessionId);
  });

  // ==========================================
  // History Management IPC Handlers
  // ==========================================

  // Get history
  ipcMain.handle('get-history', async (event, options) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.getHistory(options || {});
  });

  // Search history
  ipcMain.handle('search-history', async (event, { query, limit }) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.searchHistory(query, { limit });
  });

  // Clear history
  ipcMain.handle('clear-history', async (event) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.clearHistory();
  });

  // Add to history (from renderer)
  ipcMain.on('add-to-history', (event, entry) => {
    if (historyManager) {
      historyManager.addEntry(entry.url, entry.title, entry.referrer, {
        tabId: entry.tabId,
        transitionType: entry.transitionType
      });
    }
  });

  // Notify history of page load complete (to update title)
  ipcMain.on('page-load-complete', (event, details) => {
    if (historyManager) {
      historyManager.onPageLoadComplete(details);
    }
  });

  // Get history entry by ID
  ipcMain.handle('get-history-entry', async (event, id) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.getEntry(id);
  });

  // Delete history entry
  ipcMain.handle('delete-history-entry', async (event, id) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.deleteEntry(id);
  });

  // Delete history range
  ipcMain.handle('delete-history-range', async (event, { startTime, endTime }) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.deleteRange(startTime, endTime);
  });

  // Get visit count for URL
  ipcMain.handle('get-visit-count', async (event, url) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.getVisitCount(url);
  });

  // Get most visited URLs
  ipcMain.handle('get-most-visited', async (event, limit) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.getMostVisited(limit || 10);
  });

  // Export history
  ipcMain.handle('export-history', async (event, format) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.exportHistory(format || 'json');
  });

  // Import history
  ipcMain.handle('import-history', async (event, { data, options }) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.importHistory(data, options || {});
  });

  // Get history stats
  ipcMain.handle('get-history-stats', async (event) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.getStats();
  });

  // ==========================================
  // Download Management IPC Handlers
  // ==========================================

  // Start download
  ipcMain.handle('start-download', async (event, { url, options }) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.startDownload(url, options || {});
  });

  // Pause download
  ipcMain.handle('pause-download', async (event, downloadId) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.pauseDownload(downloadId);
  });

  // Resume download
  ipcMain.handle('resume-download', async (event, downloadId) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.resumeDownload(downloadId);
  });

  // Cancel download
  ipcMain.handle('cancel-download', async (event, downloadId) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.cancelDownload(downloadId);
  });

  // Get download info
  ipcMain.handle('get-download', async (event, downloadId) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.getDownload(downloadId);
  });

  // Get active downloads
  ipcMain.handle('get-active-downloads', async () => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.getActiveDownloads();
  });

  // Get completed downloads
  ipcMain.handle('get-completed-downloads', async () => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.getCompletedDownloads();
  });

  // Get all downloads
  ipcMain.handle('get-downloads', async (event, options) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.getAllDownloads(options || {});
  });

  // Clear completed downloads
  ipcMain.handle('clear-completed-downloads', async () => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.clearCompleted();
  });

  // Set download path
  ipcMain.handle('set-download-path', async (event, downloadPath) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.setDownloadPath(downloadPath);
  });

  // Get download path
  ipcMain.handle('get-download-path', async () => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return { success: true, downloadPath: downloadManager.getDownloadPath() };
  });

  // Get download manager status
  ipcMain.handle('get-download-status', async () => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return { success: true, status: downloadManager.getStatus() };
  });

  // ==========================================
  // Tab Management IPC Handlers
  // ==========================================

  // Create new tab
  ipcMain.handle('new-tab', async (event, options) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.createTab(options || {});
  });

  // Close tab
  ipcMain.handle('close-tab', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.closeTab(tabId);
  });

  // Switch tab
  ipcMain.handle('switch-tab', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.switchTab(tabId);
  });

  // List tabs
  ipcMain.handle('list-tabs', async (event, options) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.listTabs(options || {});
  });

  // Get tab info
  ipcMain.handle('get-tab-info', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    const tab = tabManager.getTabInfo(tabId || tabManager.activeTabId);
    return tab ? { success: true, tab } : { success: false, error: 'Tab not found' };
  });

  // Get active tab
  ipcMain.handle('get-active-tab', async () => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    const tab = tabManager.getActiveTab();
    return tab ? { success: true, tab } : { success: false, error: 'No active tab' };
  });

  // Navigate tab
  ipcMain.handle('navigate-tab', async (event, { tabId, url }) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.navigateTab(tabId, url);
  });

  // Reload tab
  ipcMain.handle('reload-tab', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.reloadTab(tabId);
  });

  // Tab back
  ipcMain.handle('tab-back', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.goBack(tabId);
  });

  // Tab forward
  ipcMain.handle('tab-forward', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.goForward(tabId);
  });

  // Duplicate tab
  ipcMain.handle('duplicate-tab', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.duplicateTab(tabId);
  });

  // Pin tab
  ipcMain.handle('pin-tab', async (event, { tabId, pinned }) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.pinTab(tabId, pinned);
  });

  // Mute tab
  ipcMain.handle('mute-tab', async (event, { tabId, muted }) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.muteTab(tabId, muted);
  });

  // Set tab zoom
  ipcMain.handle('set-tab-zoom', async (event, { tabId, zoomLevel }) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.setZoom(tabId, zoomLevel);
  });

  // Move tab
  ipcMain.handle('move-tab', async (event, { tabId, newIndex }) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.moveTab(tabId, newIndex);
  });

  // Next tab
  ipcMain.handle('next-tab', async () => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.nextTab();
  });

  // Previous tab
  ipcMain.handle('previous-tab', async () => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.previousTab();
  });

  // Update tab info from renderer
  ipcMain.on('update-tab', (event, { tabId, updates }) => {
    if (tabManager) {
      tabManager.updateTab(tabId, updates);
    }
  });

  // ==========================================
  // Network Throttling IPC Handlers
  // ==========================================

  // Set network throttling
  ipcMain.handle('set-network-throttling', async (event, { download, upload, latency }) => {
    return await networkThrottler.setThrottling(download, upload, latency);
  });

  // Set network preset
  ipcMain.handle('set-network-preset', async (event, presetName) => {
    return await networkThrottler.setPreset(presetName);
  });

  // Get network presets
  ipcMain.handle('get-network-presets', async () => {
    return networkThrottler.getPresets();
  });

  // Enable network throttling
  ipcMain.handle('enable-network-throttling', async () => {
    return await networkThrottler.enable();
  });

  // Disable network throttling
  ipcMain.handle('disable-network-throttling', async () => {
    return await networkThrottler.disable();
  });

  // Get network throttling status
  ipcMain.handle('get-network-throttling-status', async () => {
    return { success: true, ...networkThrottler.getStatus() };
  });

  // ==========================================
  // Geolocation Management IPC Handlers
  // ==========================================

  // Set geolocation
  ipcMain.handle('set-geolocation', async (event, { latitude, longitude, options }) => {
    return geolocationManager.setLocation(latitude, longitude, options || {});
  });

  // Set geolocation by city name
  ipcMain.handle('set-geolocation-city', async (event, cityName) => {
    return geolocationManager.setLocationByCity(cityName);
  });

  // Get current geolocation
  ipcMain.handle('get-geolocation', async () => {
    return geolocationManager.getLocation();
  });

  // Enable geolocation spoofing
  ipcMain.handle('enable-geolocation-spoofing', async () => {
    const result = geolocationManager.enableSpoofing();
    if (result.success && mainWindow) {
      mainWindow.webContents.send('inject-geolocation-script', geolocationManager.getFullSpoofScript());
    }
    return result;
  });

  // Disable geolocation spoofing
  ipcMain.handle('disable-geolocation-spoofing', async () => {
    return geolocationManager.disableSpoofing();
  });

  // Get geolocation spoofing status
  ipcMain.handle('get-geolocation-status', async () => {
    return geolocationManager.getStatus();
  });

  // Get preset locations
  ipcMain.handle('get-preset-locations', async (event, filter) => {
    return {
      success: true,
      presets: geolocationManager.getPresetLocations(filter || {})
    };
  });

  // Get geolocation spoof script
  ipcMain.handle('get-geolocation-script', async () => {
    return {
      success: true,
      script: geolocationManager.getFullSpoofScript(),
      enabled: geolocationManager.isEnabled()
    };
  });

  // Reset geolocation to default
  ipcMain.handle('reset-geolocation', async () => {
    return geolocationManager.reset();
  });

  // ==========================================
  // Content Blocking IPC Handlers
  // ==========================================

  // Enable content blocking
  ipcMain.handle('enable-blocking', async () => {
    return blockingManager.enableBlocking();
  });

  // Disable content blocking
  ipcMain.handle('disable-blocking', async () => {
    return blockingManager.disableBlocking();
  });

  // Add block rule
  ipcMain.handle('add-block-rule', async (event, { pattern, options }) => {
    return blockingManager.addBlockRule(pattern, options);
  });

  // Remove block rule
  ipcMain.handle('remove-block-rule', async (event, pattern) => {
    return blockingManager.removeBlockRule(pattern);
  });

  // Get block rules
  ipcMain.handle('get-block-rules', async () => {
    return blockingManager.getBlockRules();
  });

  // Load filter list from URL
  ipcMain.handle('load-filter-list', async (event, url) => {
    return await blockingManager.loadFilterList(url);
  });

  // Load local filter list
  ipcMain.handle('load-local-filter-list', async (event, path) => {
    return await blockingManager.loadLocalFilterList(path);
  });

  // Get blocking statistics
  ipcMain.handle('get-blocking-stats', async () => {
    return blockingManager.getStats();
  });

  // Clear blocking statistics
  ipcMain.handle('clear-blocking-stats', async () => {
    return blockingManager.clearStats();
  });

  // Whitelist domain
  ipcMain.handle('whitelist-domain', async (event, domain) => {
    return blockingManager.whitelistDomain(domain);
  });

  // Remove from whitelist
  ipcMain.handle('remove-whitelist', async (event, domain) => {
    return blockingManager.removeWhitelist(domain);
  });

  // Get whitelist
  ipcMain.handle('get-whitelist', async () => {
    return blockingManager.getWhitelist();
  });

  // Set blocking category
  ipcMain.handle('set-blocking-category', async (event, { category, enabled }) => {
    return blockingManager.setCategory(category, enabled);
  });

  // Get blocking categories
  ipcMain.handle('get-blocking-categories', async () => {
    return blockingManager.getCategories();
  });

  // Get known filter list URLs
  ipcMain.handle('get-known-filter-lists', async () => {
    return blockingManager.getKnownFilterListUrls();
  });

  // ==========================================
  // Automation Script IPC Handlers
  // ==========================================

  // Create automation script
  ipcMain.handle('create-script', async (event, { name, script, options }) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.createScript(name, script, options);
  });

  // Update automation script
  ipcMain.handle('update-script', async (event, { id, updates }) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.updateScript(id, updates);
  });

  // Delete automation script
  ipcMain.handle('delete-script', async (event, id) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.deleteScript(id);
  });

  // Get automation script
  ipcMain.handle('get-script', async (event, id) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return scriptManager.getScript(id);
  });

  // List automation scripts
  ipcMain.handle('list-scripts', async (event, options) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return scriptManager.listScripts(options || {});
  });

  // Run automation script
  ipcMain.handle('run-script', async (event, { id, context }) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.runScript(id, context);
  });

  // Enable automation script
  ipcMain.handle('enable-script', async (event, id) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.enableScript(id);
  });

  // Disable automation script
  ipcMain.handle('disable-script', async (event, id) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.disableScript(id);
  });

  // Export automation scripts
  ipcMain.handle('export-scripts', async () => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return scriptManager.exportScripts();
  });

  // Import automation scripts
  ipcMain.handle('import-scripts', async (event, { data, overwrite }) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.importScripts(data, overwrite);
  });

  // Get available script context
  ipcMain.handle('get-script-context', async () => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return { success: true, context: scriptManager.runner.getAvailableContext() };
  });

  // Get script execution history
  ipcMain.handle('get-script-history', async (event, options) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return { success: true, history: scriptManager.runner.getHistory(options || {}) };
  });

  // ==========================================
  // Profile Management IPC Handlers
  // ==========================================

  // Create profile
  ipcMain.handle('create-profile', async (event, options) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return profileManager.createProfile(options);
  });

  // Delete profile
  ipcMain.handle('delete-profile', async (event, profileId) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return await profileManager.deleteProfile(profileId);
  });

  // Get profile
  ipcMain.handle('get-profile', async (event, profileId) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return profileManager.getProfile(profileId);
  });

  // List profiles
  ipcMain.handle('list-profiles', async () => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return profileManager.listProfiles();
  });

  // Switch profile
  ipcMain.handle('switch-profile', async (event, profileId) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return await profileManager.switchProfile(profileId);
  });

  // Update profile
  ipcMain.handle('update-profile', async (event, { profileId, updates }) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return profileManager.updateProfile(profileId, updates);
  });

  // Export profile
  ipcMain.handle('export-profile', async (event, profileId) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return await profileManager.exportProfile(profileId);
  });

  // Import profile
  ipcMain.handle('import-profile', async (event, data) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return await profileManager.importProfile(data);
  });

  // Randomize profile fingerprint
  ipcMain.handle('randomize-profile-fingerprint', async (event, profileId) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return profileManager.randomizeFingerprint(profileId);
  });

  // Get active profile
  ipcMain.handle('get-active-profile', async () => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    const profile = profileManager.getActiveProfile();
    if (!profile) {
      return { success: false, error: 'No active profile' };
    }
    return { success: true, profile: profile.toJSON() };
  });

  // Get evasion script for profile
  ipcMain.handle('get-profile-evasion-script', async (event, profileId) => {
    if (!profileManager) {
      return getEvasionScript();
    }
    return profileManager.getEvasionScript(profileId);
  });

  // Get active profile partition
  ipcMain.handle('get-active-profile-partition', async () => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return { success: true, partition: profileManager.getActivePartition() };
  });

  // ==========================================
  // DevTools Management IPC Handlers
  // ==========================================

  // Open DevTools
  ipcMain.handle('open-devtools', async (event, options) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.openDevTools(options);
  });

  // Close DevTools
  ipcMain.handle('close-devtools', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.closeDevTools();
  });

  // Toggle DevTools
  ipcMain.handle('toggle-devtools', async (event, options) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.toggleDevTools(options);
  });

  // Get DevTools state
  ipcMain.handle('is-devtools-open', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.getDevToolsState();
  });

  // Get network logs
  ipcMain.handle('get-network-logs', async (event, options) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.getNetworkLogs(options);
  });

  // Clear network logs
  ipcMain.handle('clear-network-logs', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.clearNetworkLogs();
  });

  // Get performance metrics
  ipcMain.handle('get-performance-metrics', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.getPerformanceMetrics();
  });

  // Get code coverage
  ipcMain.handle('get-coverage', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.getCoverage();
  });

  // Get network stats
  ipcMain.handle('get-network-stats', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.getNetworkStats();
  });

  // Start/stop network logging
  ipcMain.handle('start-network-logging', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.startNetworkLogging();
  });

  ipcMain.handle('stop-network-logging', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.stopNetworkLogging();
  });

  // Export network logs
  ipcMain.handle('export-network-logs', async (event, format) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.exportNetworkLogs(format);
  });

  // Get DevTools status
  ipcMain.handle('get-devtools-status', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return { success: true, status: devToolsManager.getStatus() };
  });

  // ==========================================
  // Console Management IPC Handlers
  // ==========================================

  // Get console logs
  ipcMain.handle('get-console-logs', async (event, options) => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.getConsoleLogs(options);
  });

  // Clear console logs
  ipcMain.handle('clear-console-logs', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.clearConsoleLogs();
  });

  // Execute in console
  ipcMain.handle('execute-in-console', async (event, { code, options }) => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.executeInConsole(code, options);
  });

  // Get console errors
  ipcMain.handle('get-console-errors', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.getErrors();
  });

  // Get console warnings
  ipcMain.handle('get-console-warnings', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.getWarnings();
  });

  // Export console logs
  ipcMain.handle('export-console-logs', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.exportLogs();
  });

  // Get console status
  ipcMain.handle('get-console-status', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return { success: true, status: consoleManager.getStatus() };
  });

  // Start/stop console capture
  ipcMain.handle('start-console-capture', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.startCapture();
  });

  ipcMain.handle('stop-console-capture', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.stopCapture();
  });

  // Set max console logs
  ipcMain.handle('set-max-console-logs', async (event, max) => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.setMaxLogs(max);
  });

  // Console message from renderer
  ipcMain.on('console-message', (event, message) => {
    if (consoleManager) {
      consoleManager.addLog(message);
    }
  });

  // ==========================================
  // Storage Management IPC Handlers
  // ==========================================

  // Get localStorage for origin
  ipcMain.handle('get-local-storage', async (event, origin) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.getLocalStorage(origin);
  });

  // Set localStorage item
  ipcMain.handle('set-local-storage-item', async (event, { origin, key, value }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.setLocalStorageItem(origin, key, value);
  });

  // Remove localStorage item
  ipcMain.handle('remove-local-storage-item', async (event, { origin, key }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.removeLocalStorageItem(origin, key);
  });

  // Clear localStorage for origin
  ipcMain.handle('clear-local-storage', async (event, origin) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.clearLocalStorage(origin);
  });

  // Get sessionStorage for origin
  ipcMain.handle('get-session-storage', async (event, origin) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.getSessionStorage(origin);
  });

  // Set sessionStorage item
  ipcMain.handle('set-session-storage-item', async (event, { origin, key, value }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.setSessionStorageItem(origin, key, value);
  });

  // Remove sessionStorage item
  ipcMain.handle('remove-session-storage-item', async (event, { origin, key }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.removeSessionStorageItem(origin, key);
  });

  // Clear sessionStorage for origin
  ipcMain.handle('clear-session-storage', async (event, origin) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.clearSessionStorage(origin);
  });

  // Get IndexedDB databases for origin
  ipcMain.handle('get-indexeddb-databases', async (event, origin) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.getIndexedDBDatabases(origin);
  });

  // Delete IndexedDB database
  ipcMain.handle('delete-indexeddb-database', async (event, { origin, name }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.deleteIndexedDBDatabase(origin, name);
  });

  // Export storage for origin
  ipcMain.handle('export-storage', async (event, { origin, types }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.exportStorage(origin, types);
  });

  // Import storage for origin
  ipcMain.handle('import-storage', async (event, { origin, data }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.importStorage(origin, data);
  });

  // Export storage to file
  ipcMain.handle('export-storage-to-file', async (event, { filepath, origin, types }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.exportStorageToFile(filepath, origin, types);
  });

  // Import storage from file
  ipcMain.handle('import-storage-from-file', async (event, { filepath, origin }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.importStorageFromFile(filepath, origin);
  });

  // Get storage statistics
  ipcMain.handle('get-storage-stats', async (event, origin) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.getStorageStats(origin);
  });

  // Clear all storage for origin
  ipcMain.handle('clear-all-storage', async (event, { origin, types }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.clearAllStorage(origin, types);
  });

  // ==========================================
  // Recovery Management IPC Handlers
  // ==========================================

  // Get recovery status
  ipcMain.handle('get-recovery-status', async () => {
    return {
      success: true,
      autoSaveEnabled: autoSaveTimer !== null,
      autoSaveInterval: RECOVERY_CONFIG.autoSaveInterval,
      recoveryFilePath: RECOVERY_CONFIG.recoveryFilePath,
      lockFilePath: RECOVERY_CONFIG.lockFilePath,
      hasRecoveryFile: fs.existsSync(RECOVERY_CONFIG.recoveryFilePath),
      hasLockFile: fs.existsSync(RECOVERY_CONFIG.lockFilePath)
    };
  });

  // Manually save session state
  ipcMain.handle('save-session-state', async () => {
    try {
      saveSessionState();
      return { success: true, message: 'Session state saved' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Load saved session state (for inspection, not restoration)
  ipcMain.handle('get-saved-session-state', async () => {
    try {
      const state = loadSessionState();
      return { success: true, state };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Clear saved session state
  ipcMain.handle('clear-saved-session-state', async () => {
    try {
      clearSessionState();
      return { success: true, message: 'Session state cleared' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Set auto-save interval
  ipcMain.handle('set-auto-save-interval', async (event, intervalMs) => {
    if (typeof intervalMs !== 'number' || intervalMs < 5000) {
      return { success: false, error: 'Interval must be at least 5000ms' };
    }
    RECOVERY_CONFIG.autoSaveInterval = intervalMs;
    // Restart auto-save with new interval
    startAutoSave();
    return { success: true, interval: intervalMs };
  });

  // Enable/disable auto-save
  ipcMain.handle('toggle-auto-save', async (event, enabled) => {
    if (enabled) {
      startAutoSave();
    } else {
      stopAutoSave();
    }
    return { success: true, autoSaveEnabled: autoSaveTimer !== null };
  });
}

/**
 * Setup download manager event handlers
 */
function setupDownloadManagerEvents() {
  if (!downloadManager) return;

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

app.whenReady().then(async () => {
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
  createWindow();

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

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
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
