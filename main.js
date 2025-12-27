const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const WebSocketServer = require('./websocket/server');
const { getRandomViewport, getRealisticUserAgent, getEvasionScript, getEvasionScriptWithConfig } = require('./evasion/fingerprint');
const { proxyManager } = require('./proxy/manager');
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

// Realistic viewport sizes for randomization
const viewportConfig = getRandomViewport();

function createWindow() {
  // Remove command line switches that reveal automation
  app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
  app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process');

  mainWindow = new BrowserWindow({
    width: viewportConfig.width,
    height: viewportConfig.height,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      sandbox: false,
      // Disable webdriver detection
      enableBlinkFeatures: '',
    },
    // Anti-fingerprinting: randomize window position slightly
    x: Math.floor(Math.random() * 100),
    y: Math.floor(Math.random() * 100),
  });

  // Set realistic user agent
  const userAgent = getRealisticUserAgent();
  mainWindow.webContents.setUserAgent(userAgent);

  // Initialize Header Manager with storage path
  const headerStoragePath = path.join(app.getPath('userData'), 'headers');
  headerManager = new HeaderManager({ storagePath: headerStoragePath });

  // Set up default headers for human-like appearance
  headerManager.setRequestHeader('Accept-Language', 'en-US,en;q=0.9');
  headerManager.setRequestHeader('Accept-Encoding', 'gzip, deflate, br');
  headerManager.setRequestHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');
  headerManager.removeRequestHeader('Sec-Ch-Ua-Platform');

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

  // Initialize Download Manager
  downloadManager = new DownloadManager({
    downloadPath: app.getPath('downloads')
  });

  // Setup download manager event handlers
  setupDownloadManagerEvents();

  // Hook into Electron's will-download event
  session.defaultSession.on('will-download', (event, downloadItem, webContents) => {
    // Register the download with our download manager
    const download = downloadManager.registerDownload(downloadItem, webContents);

    // Notify renderer of download progress
    downloadManager.on('download-progress', (downloadInfo) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', downloadInfo);
      }
    });
  });

  // Initialize Tab Manager with event callbacks
  tabManager = new TabManager({
    homePage: 'https://www.google.com',
    maxTabs: 50,
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

  // Create initial tab
  tabManager.createTab({ url: 'https://www.google.com', active: true });

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

  // Initialize WebSocket server for external communication with managers
  wsServer = new WebSocketServer(8765, mainWindow, {
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
    headerManager
  });

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
    mainWindow = null;
    if (wsServer) {
      wsServer.close();
    }
  });

  // Setup IPC handlers
  setupIPCHandlers();
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
    return new Promise((resolve) => {
      mainWindow.webContents.send('get-webview-url');
      ipcMain.once('webview-url-response', (event, url) => {
        resolve(url);
      });
    });
  });

  // Execute script in webview
  ipcMain.handle('execute-in-webview', async (event, script) => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('execute-in-webview', script);
      ipcMain.once('webview-execute-response', (event, result) => {
        resolve(result);
      });
    });
  });

  // Get page content
  ipcMain.handle('get-page-content', async () => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('get-page-content');
      ipcMain.once('page-content-response', (event, content) => {
        resolve(content);
      });
    });
  });

  // Screenshot (basic viewport)
  ipcMain.handle('capture-screenshot', async () => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('capture-screenshot');
      ipcMain.once('screenshot-response', (event, data) => {
        resolve(data);
      });
    });
  });

  // Enhanced screenshot - full page
  ipcMain.handle('screenshot-full-page', async (event, options) => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('screenshot-full-page', options);
      ipcMain.once('screenshot-full-page-response', (event, data) => {
        resolve(data);
      });
    });
  });

  // Enhanced screenshot - element
  ipcMain.handle('screenshot-element', async (event, options) => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('screenshot-element', options);
      ipcMain.once('screenshot-element-response', (event, data) => {
        resolve(data);
      });
    });
  });

  // Enhanced screenshot - area
  ipcMain.handle('screenshot-area', async (event, options) => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('screenshot-area', options);
      ipcMain.once('screenshot-area-response', (event, data) => {
        resolve(data);
      });
    });
  });

  // Enhanced screenshot - viewport with options
  ipcMain.handle('screenshot-viewport', async (event, options) => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('screenshot-viewport', options);
      ipcMain.once('screenshot-viewport-response', (event, data) => {
        resolve(data);
      });
    });
  });

  // Annotate screenshot
  ipcMain.handle('annotate-screenshot', async (event, options) => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('annotate-screenshot', options);
      ipcMain.once('annotate-screenshot-response', (event, data) => {
        resolve(data);
      });
    });
  });

  // Screen recording - start
  ipcMain.handle('start-recording', async (event, options) => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('start-recording', options);
      ipcMain.once('recording-started', (event, data) => {
        resolve(data);
      });
    });
  });

  // Screen recording - stop
  ipcMain.handle('stop-recording', async (event, options) => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('stop-recording', options);
      ipcMain.once('recording-stopped', (event, data) => {
        resolve(data);
      });
    });
  });

  // Screen recording - pause
  ipcMain.handle('pause-recording', async () => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('pause-recording');
      ipcMain.once('recording-paused', (event, data) => {
        resolve(data);
      });
    });
  });

  // Screen recording - resume
  ipcMain.handle('resume-recording', async () => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('resume-recording');
      ipcMain.once('recording-resumed', (event, data) => {
        resolve(data);
      });
    });
  });

  // Click element
  ipcMain.handle('click-element', async (event, selector) => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('click-element', selector);
      ipcMain.once('click-response', (event, result) => {
        resolve(result);
      });
    });
  });

  // Fill form field
  ipcMain.handle('fill-field', async (event, { selector, value }) => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('fill-field', { selector, value });
      ipcMain.once('fill-response', (event, result) => {
        resolve(result);
      });
    });
  });

  // Get page state (forms, links, buttons)
  ipcMain.handle('get-page-state', async () => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('get-page-state');
      ipcMain.once('page-state-response', (event, state) => {
        resolve(state);
      });
    });
  });

  // Wait for element
  ipcMain.handle('wait-for-element', async (event, { selector, timeout }) => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('wait-for-element', { selector, timeout });
      ipcMain.once('wait-response', (event, result) => {
        resolve(result);
      });
    });
  });

  // Scroll
  ipcMain.handle('scroll', async (event, { x, y, selector }) => {
    return new Promise((resolve) => {
      mainWindow.webContents.send('scroll', { x, y, selector });
      ipcMain.once('scroll-response', (event, result) => {
        resolve(result);
      });
    });
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle certificate errors (useful for OSINT on sites with bad certs)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});
