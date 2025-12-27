const WebSocket = require('ws');
const { ipcMain } = require('electron');
const { humanDelay, humanType, humanMouseMove, humanScroll } = require('../evasion/humanize');
const { ScreenshotManager, validateAnnotation, applyAnnotationDefaults } = require('../screenshots/manager');
const { RecordingManager, RecordingState } = require('../recording/manager');
const keyboard = require('../input/keyboard');
const mouse = require('../input/mouse');
const { proxyManager, PROXY_TYPES } = require('../proxy/manager');
const { userAgentManager, UA_CATEGORIES } = require('../utils/user-agents');
const { requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES } = require('../utils/request-interceptor');
const { DOMInspector } = require('../inspector/manager');
const { HeaderManager } = require('../headers/manager');
const { PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames } = require('../headers/profiles');

/**
 * WebSocket Server for Basset Hound Browser
 * Enables external control of the browser for automation and OSINT tasks
 * Supports session management, tab management, history, downloads, screenshots, and recording
 */
class WebSocketServer {
  constructor(port, mainWindow, options = {}) {
    this.port = port;
    this.mainWindow = mainWindow;
    this.wss = null;
    this.clients = new Set();
    this.commandHandlers = {};

    // Initialize screenshot and recording managers
    this.screenshotManager = new ScreenshotManager(mainWindow);
    this.recordingManager = new RecordingManager(mainWindow);

    // Managers for session and tab management (injected from main.js)
    this.sessionManager = options.sessionManager || null;
    this.tabManager = options.tabManager || null;
    this.networkThrottler = options.networkThrottler || null;
    this.cookieManager = options.cookieManager || null;
    this.downloadManager = options.downloadManager || null;
    this.blockingManager = options.blockingManager || null;
    this.geolocationManager = options.geolocationManager || null;
    this.headerManager = options.headerManager || null;
    this.scriptManager = options.scriptManager || null;
    this.storageManager = options.storageManager || null;
    this.historyManager = options.historyManager || null;
    this.profileManager = options.profileManager || null;
    this.devToolsManager = options.devToolsManager || null;
    this.consoleManager = options.consoleManager || null;

    // Initialize DOM Inspector
    this.domInspector = new DOMInspector(mainWindow);

    // Initialize request interceptor
    requestInterceptor.initialize();

    // Setup proxy authentication handler
    proxyManager.setupAuthHandler(mainWindow);

    this.setupCommandHandlers();
    this.start();
  }

  /**
   * Set the session manager
   * @param {SessionManager} manager - Session manager instance
   */
  setSessionManager(manager) {
    this.sessionManager = manager;
    console.log('[WebSocket] Session manager attached');
  }

  /**
   * Set the tab manager
   * @param {TabManager} manager - Tab manager instance
   */
  setTabManager(manager) {
    this.tabManager = manager;
    console.log('[WebSocket] Tab manager attached');
  }

  start() {
    this.wss = new WebSocket.Server({ port: this.port });

    this.wss.on('connection', (ws, req) => {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      ws.clientId = clientId;
      this.clients.add(ws);

      console.log(`[WebSocket] Client connected: ${clientId} from ${req.socket.remoteAddress}`);
      this.broadcast({ type: 'status', message: 'connected', clientId });

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log(`[WebSocket] Received command: ${data.command}`, data);
          const response = await this.handleCommand(data);
          ws.send(JSON.stringify({
            id: data.id,
            command: data.command,
            ...response
          }));
        } catch (error) {
          console.error('[WebSocket] Error processing message:', error);
          ws.send(JSON.stringify({
            success: false,
            error: error.message
          }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WebSocket] Client disconnected: ${clientId}`);
      });

      ws.on('error', (error) => {
        console.error(`[WebSocket] Client error (${clientId}):`, error);
        this.clients.delete(ws);
      });
    });

    this.wss.on('error', (error) => {
      console.error('[WebSocket] Server error:', error);
    });

    console.log(`[WebSocket] Server started on port ${this.port}`);
  }

  setupCommandHandlers() {
    // Navigate to URL
    this.commandHandlers.navigate = async (params) => {
      const { url } = params;
      if (!url) {
        return { success: false, error: 'URL is required' };
      }

      await humanDelay(100, 300);
      return new Promise((resolve) => {
        this.mainWindow.webContents.send('navigate-webview', url);
        // Wait for navigation to complete
        setTimeout(() => {
          resolve({ success: true, url });
        }, 1000);
      });
    };

    // Click element by selector
    this.commandHandlers.click = async (params) => {
      const { selector, humanize = true } = params;
      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }

      if (humanize) {
        await humanDelay(50, 200);
      }

      return new Promise((resolve) => {
        this.mainWindow.webContents.send('click-element', selector);
        ipcMain.once('click-response', (event, result) => {
          resolve(result);
        });
      });
    };

    // Fill form field
    this.commandHandlers.fill = async (params) => {
      const { selector, value, humanize = true } = params;
      if (!selector || value === undefined) {
        return { success: false, error: 'Selector and value are required' };
      }

      if (humanize) {
        // Simulate human typing with delays
        const typedValue = await humanType(value);
        await humanDelay(50, 150);
      }

      return new Promise((resolve) => {
        this.mainWindow.webContents.send('fill-field', { selector, value });
        ipcMain.once('fill-response', (event, result) => {
          resolve(result);
        });
      });
    };

    // Get page content
    this.commandHandlers.get_content = async (params) => {
      return new Promise((resolve) => {
        this.mainWindow.webContents.send('get-page-content');
        ipcMain.once('page-content-response', (event, result) => {
          resolve(result);
        });
      });
    };

    // Capture screenshot
    this.commandHandlers.screenshot = async (params) => {
      const { format = 'png' } = params;
      return new Promise((resolve) => {
        this.mainWindow.webContents.send('capture-screenshot');
        ipcMain.once('screenshot-response', (event, result) => {
          resolve(result);
        });
      });
    };

    // Get page state (forms, links, buttons)
    this.commandHandlers.get_page_state = async (params) => {
      return new Promise((resolve) => {
        this.mainWindow.webContents.send('get-page-state');
        ipcMain.once('page-state-response', (event, result) => {
          resolve(result);
        });
      });
    };

    // Execute arbitrary JavaScript
    this.commandHandlers.execute_script = async (params) => {
      const { script } = params;
      if (!script) {
        return { success: false, error: 'Script is required' };
      }

      return new Promise((resolve) => {
        this.mainWindow.webContents.send('execute-in-webview', script);
        ipcMain.once('webview-execute-response', (event, result) => {
          resolve(result);
        });
      });
    };

    // Wait for element to appear
    this.commandHandlers.wait_for_element = async (params) => {
      const { selector, timeout = 10000 } = params;
      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }

      return new Promise((resolve) => {
        this.mainWindow.webContents.send('wait-for-element', { selector, timeout });
        ipcMain.once('wait-response', (event, result) => {
          resolve(result);
        });
      });
    };

    // Scroll to position or element
    this.commandHandlers.scroll = async (params) => {
      const { x, y, selector, humanize = true } = params;

      if (humanize) {
        await humanScroll();
      }

      return new Promise((resolve) => {
        this.mainWindow.webContents.send('scroll', { x, y, selector });
        ipcMain.once('scroll-response', (event, result) => {
          resolve(result);
        });
      });
    };

    // ==================== COOKIE MANAGEMENT COMMANDS ====================

    // Get cookies for URL
    this.commandHandlers.get_cookies = async (params) => {
      if (!this.cookieManager) {
        // Fallback to direct session access if cookieManager not available
        const { url } = params;
        if (!url) {
          return { success: false, error: 'URL is required' };
        }
        try {
          const { session } = require('electron');
          const cookies = await session.defaultSession.cookies.get({ url });
          return { success: true, cookies };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }

      const { url } = params;
      if (!url) {
        return { success: false, error: 'URL is required' };
      }
      return await this.cookieManager.getCookies(url);
    };

    // Get all cookies
    this.commandHandlers.get_all_cookies = async (params) => {
      if (!this.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { filter } = params;
      return await this.cookieManager.getAllCookies(filter || {});
    };

    // Set a single cookie
    this.commandHandlers.set_cookie = async (params) => {
      if (!this.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { cookie } = params;
      if (!cookie) {
        return { success: false, error: 'Cookie object is required' };
      }
      return await this.cookieManager.setCookie(cookie);
    };

    // Set multiple cookies
    this.commandHandlers.set_cookies = async (params) => {
      if (!this.cookieManager) {
        // Fallback to direct session access
        const { cookies } = params;
        if (!cookies || !Array.isArray(cookies)) {
          return { success: false, error: 'Cookies array is required' };
        }
        try {
          const { session } = require('electron');
          for (const cookie of cookies) {
            await session.defaultSession.cookies.set(cookie);
          }
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }

      const { cookies } = params;
      if (!cookies || !Array.isArray(cookies)) {
        return { success: false, error: 'Cookies array is required' };
      }
      return await this.cookieManager.setCookies(cookies);
    };

    // Delete a specific cookie
    this.commandHandlers.delete_cookie = async (params) => {
      if (!this.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { url, name } = params;
      if (!url || !name) {
        return { success: false, error: 'URL and name are required' };
      }
      return await this.cookieManager.deleteCookie(url, name);
    };

    // Clear all cookies (optionally for a specific domain)
    this.commandHandlers.clear_all_cookies = async (params) => {
      if (!this.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { domain } = params;
      return await this.cookieManager.clearCookies(domain);
    };

    // Export cookies to specified format
    this.commandHandlers.export_cookies = async (params) => {
      if (!this.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { format, filter, domain } = params;
      const exportFilter = filter || (domain ? { domain } : {});
      return await this.cookieManager.exportCookies(format || 'json', exportFilter);
    };

    // Import cookies from data string
    this.commandHandlers.import_cookies = async (params) => {
      if (!this.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { data, format } = params;
      if (!data) {
        return { success: false, error: 'Cookie data is required' };
      }
      return await this.cookieManager.importCookies(data, format || 'auto');
    };

    // Export cookies to file
    this.commandHandlers.export_cookies_file = async (params) => {
      if (!this.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { filepath, format, filter, domain } = params;
      if (!filepath) {
        return { success: false, error: 'Filepath is required' };
      }
      const exportFilter = filter || (domain ? { domain } : {});
      return await this.cookieManager.exportToFile(filepath, format || 'json', exportFilter);
    };

    // Import cookies from file
    this.commandHandlers.import_cookies_file = async (params) => {
      if (!this.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { filepath, format } = params;
      if (!filepath) {
        return { success: false, error: 'Filepath is required' };
      }
      return await this.cookieManager.importFromFile(filepath, format || 'auto');
    };

    // Get cookies for a specific domain
    this.commandHandlers.get_cookies_for_domain = async (params) => {
      if (!this.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { domain } = params;
      if (!domain) {
        return { success: false, error: 'Domain is required' };
      }
      return await this.cookieManager.getCookiesForDomain(domain);
    };

    // Get cookie statistics
    this.commandHandlers.get_cookie_stats = async (params) => {
      if (!this.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }
      return await this.cookieManager.getStats();
    };

    // Get available cookie formats
    this.commandHandlers.get_cookie_formats = async (params) => {
      if (!this.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }
      return { success: true, ...this.cookieManager.getFormats() };
    };

    // Flush cookies to storage
    this.commandHandlers.flush_cookies = async (params) => {
      if (!this.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }
      return await this.cookieManager.flushCookies();
    };

    // Get current URL
    this.commandHandlers.get_url = async (params) => {
      return new Promise((resolve) => {
        this.mainWindow.webContents.send('get-webview-url');
        ipcMain.once('webview-url-response', (event, url) => {
          resolve({ success: true, url });
        });
      });
    };

    // ==================== SESSION MANAGEMENT COMMANDS ====================

    // Create a new session
    this.commandHandlers.create_session = async (params) => {
      if (!this.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { name, userAgent, fingerprint } = params;
      return this.sessionManager.createSession({ name, userAgent, fingerprint });
    };

    // Switch to a different session
    this.commandHandlers.switch_session = async (params) => {
      if (!this.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { sessionId } = params;
      if (!sessionId) {
        return { success: false, error: 'Session ID is required' };
      }

      const result = this.sessionManager.switchSession(sessionId);

      // Notify renderer to update webview partition
      if (result.success) {
        this.mainWindow.webContents.send('session-changed', {
          sessionId,
          partition: this.sessionManager.getActivePartition()
        });
      }

      return result;
    };

    // Delete a session
    this.commandHandlers.delete_session = async (params) => {
      if (!this.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { sessionId } = params;
      if (!sessionId) {
        return { success: false, error: 'Session ID is required' };
      }

      return await this.sessionManager.deleteSession(sessionId);
    };

    // List all sessions
    this.commandHandlers.list_sessions = async (params) => {
      if (!this.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      return this.sessionManager.listSessions();
    };

    // Export a session
    this.commandHandlers.export_session = async (params) => {
      if (!this.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { sessionId } = params;
      return await this.sessionManager.exportSession(sessionId);
    };

    // Import a session
    this.commandHandlers.import_session = async (params) => {
      if (!this.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { data } = params;
      if (!data) {
        return { success: false, error: 'Session data is required' };
      }

      return await this.sessionManager.importSession(data);
    };

    // Get session info
    this.commandHandlers.get_session_info = async (params) => {
      if (!this.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { sessionId } = params;
      const info = this.sessionManager.getSessionInfo(sessionId || this.sessionManager.activeSessionId);

      if (!info) {
        return { success: false, error: 'Session not found' };
      }

      return { success: true, session: info };
    };

    // Clear session data (cookies, cache, storage)
    this.commandHandlers.clear_session_data = async (params) => {
      if (!this.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { sessionId } = params;
      return await this.sessionManager.clearSessionData(sessionId);
    };

    // ==================== HISTORY COMMANDS ====================

    // Get browsing history
    this.commandHandlers.get_history = async (params) => {
      if (!this.historyManager) {
        return { success: false, error: 'History manager not available' };
      }

      const { limit, offset, startTime, endTime, search } = params;
      return this.historyManager.getHistory({ limit, offset, startTime, endTime, search });
    };

    // Search history
    this.commandHandlers.search_history = async (params) => {
      if (!this.historyManager) {
        return { success: false, error: 'History manager not available' };
      }

      const { query, limit } = params;
      if (!query) {
        return { success: false, error: 'Search query is required' };
      }

      return this.historyManager.searchHistory(query, { limit });
    };

    // Clear all history
    this.commandHandlers.clear_history = async (params) => {
      if (!this.historyManager) {
        return { success: false, error: 'History manager not available' };
      }

      return this.historyManager.clearHistory();
    };

    // Get specific history entry
    this.commandHandlers.get_history_entry = async (params) => {
      if (!this.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { id } = params;
      if (!id) {
        return { success: false, error: 'Entry ID is required' };
      }
      return this.historyManager.getEntry(id);
    };

    // Delete history entry
    this.commandHandlers.delete_history_entry = async (params) => {
      if (!this.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { id } = params;
      if (!id) {
        return { success: false, error: 'Entry ID is required' };
      }
      return this.historyManager.deleteEntry(id);
    };

    // Delete history range
    this.commandHandlers.delete_history_range = async (params) => {
      if (!this.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { startTime, endTime } = params;
      if (!startTime || !endTime) {
        return { success: false, error: 'Start and end times are required' };
      }
      return this.historyManager.deleteRange(startTime, endTime);
    };

    // Get visit count for URL
    this.commandHandlers.get_visit_count = async (params) => {
      if (!this.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { url } = params;
      if (!url) {
        return { success: false, error: 'URL is required' };
      }
      return this.historyManager.getVisitCount(url);
    };

    // Get most visited URLs
    this.commandHandlers.get_most_visited = async (params) => {
      if (!this.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { limit } = params;
      return this.historyManager.getMostVisited(limit || 10);
    };

    // Export history
    this.commandHandlers.export_history = async (params) => {
      if (!this.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { format } = params;
      return this.historyManager.exportHistory(format || 'json');
    };

    // Import history
    this.commandHandlers.import_history = async (params) => {
      if (!this.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { data, overwrite } = params;
      if (!data) {
        return { success: false, error: 'History data is required' };
      }
      return this.historyManager.importHistory(data, { overwrite: overwrite || false });
    };

    // Get history statistics
    this.commandHandlers.get_history_stats = async (params) => {
      if (!this.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      return this.historyManager.getStats();
    };

    // ==================== DOWNLOAD COMMANDS ====================

    // Start a download
    this.commandHandlers.start_download = async (params) => {
      if (!this.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { url, filename, path } = params;
      if (!url) {
        return { success: false, error: 'URL is required' };
      }

      // Trigger download by navigating to URL
      this.mainWindow.webContents.send('download-file', { url, filename });

      return this.downloadManager.startDownload(url, { filename, path });
    };

    // Pause a download
    this.commandHandlers.pause_download = async (params) => {
      if (!this.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { downloadId } = params;
      if (!downloadId) {
        return { success: false, error: 'Download ID is required' };
      }

      return this.downloadManager.pauseDownload(downloadId);
    };

    // Resume a download
    this.commandHandlers.resume_download = async (params) => {
      if (!this.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { downloadId } = params;
      if (!downloadId) {
        return { success: false, error: 'Download ID is required' };
      }

      return this.downloadManager.resumeDownload(downloadId);
    };

    // Cancel a download
    this.commandHandlers.cancel_download = async (params) => {
      if (!this.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { downloadId } = params;
      if (!downloadId) {
        return { success: false, error: 'Download ID is required' };
      }

      return this.downloadManager.cancelDownload(downloadId);
    };

    // Get download info
    this.commandHandlers.get_download = async (params) => {
      if (!this.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { downloadId } = params;
      if (!downloadId) {
        return { success: false, error: 'Download ID is required' };
      }

      return this.downloadManager.getDownload(downloadId);
    };

    // Get all downloads
    this.commandHandlers.get_downloads = async (params) => {
      if (!this.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { limit, state } = params || {};
      return this.downloadManager.getAllDownloads({ limit, state });
    };

    // Set download directory
    this.commandHandlers.set_download_path = async (params) => {
      if (!this.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { path: downloadPath } = params;
      if (!downloadPath) {
        return { success: false, error: 'Download path is required' };
      }

      return this.downloadManager.setDownloadPath(downloadPath);
    };

    // Clear download history
    this.commandHandlers.clear_downloads = async (params) => {
      if (!this.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      return this.downloadManager.clearCompleted();
    };

    // Get download status
    this.commandHandlers.get_download_status = async (params) => {
      if (!this.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      return { success: true, status: this.downloadManager.getStatus() };
    };

    // ==================== TAB MANAGEMENT COMMANDS ====================

    // Create a new tab
    this.commandHandlers.new_tab = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { url, title, sessionId, active } = params;
      const result = this.tabManager.createTab({ url, title, sessionId, active });

      // Notify renderer to create webview for new tab
      if (result.success) {
        this.mainWindow.webContents.send('tab-created', result.tab);
      }

      return result;
    };

    // Close a tab
    this.commandHandlers.close_tab = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      if (!tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      const result = this.tabManager.closeTab(tabId);

      // Notify renderer to close webview
      if (result.success) {
        this.mainWindow.webContents.send('tab-closed', {
          closedTabId: result.closedTabId,
          activeTabId: result.activeTabId
        });
      }

      return result;
    };

    // Switch to a tab
    this.commandHandlers.switch_tab = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId, index } = params;

      let result;
      if (tabId) {
        result = this.tabManager.switchTab(tabId);
      } else if (index !== undefined) {
        result = this.tabManager.switchToTabIndex(index);
      } else {
        return { success: false, error: 'Tab ID or index is required' };
      }

      // Notify renderer to switch webview
      if (result.success) {
        this.mainWindow.webContents.send('tab-switched', {
          tabId: result.tab.id,
          previousTabId: result.previousTabId
        });
      }

      return result;
    };

    // List all tabs
    this.commandHandlers.list_tabs = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { sessionId } = params;
      return this.tabManager.listTabs({ sessionId });
    };

    // Get tab info
    this.commandHandlers.get_tab_info = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      const tab = this.tabManager.getTabInfo(tabId || this.tabManager.activeTabId);

      if (!tab) {
        return { success: false, error: 'Tab not found' };
      }

      return { success: true, tab };
    };

    // Get active tab
    this.commandHandlers.get_active_tab = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const tab = this.tabManager.getActiveTab();

      if (!tab) {
        return { success: false, error: 'No active tab' };
      }

      return { success: true, tab };
    };

    // Navigate tab to URL
    this.commandHandlers.navigate_tab = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId, url } = params;
      if (!url) {
        return { success: false, error: 'URL is required' };
      }

      const result = this.tabManager.navigateTab(tabId, url);

      if (result.success) {
        this.mainWindow.webContents.send('tab-navigate', {
          tabId: result.tabId,
          url: result.url
        });
      }

      return result;
    };

    // Reload tab
    this.commandHandlers.reload_tab = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      const result = this.tabManager.reloadTab(tabId);

      if (result.success) {
        this.mainWindow.webContents.send('tab-reload', { tabId: result.tabId });
      }

      return result;
    };

    // Go back in tab
    this.commandHandlers.tab_back = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      const result = this.tabManager.goBack(tabId);

      if (result.success) {
        this.mainWindow.webContents.send('tab-navigate', {
          tabId: result.tabId,
          url: result.url
        });
      }

      return result;
    };

    // Go forward in tab
    this.commandHandlers.tab_forward = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      const result = this.tabManager.goForward(tabId);

      if (result.success) {
        this.mainWindow.webContents.send('tab-navigate', {
          tabId: result.tabId,
          url: result.url
        });
      }

      return result;
    };

    // Duplicate tab
    this.commandHandlers.duplicate_tab = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      if (!tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      const result = this.tabManager.duplicateTab(tabId);

      if (result.success) {
        this.mainWindow.webContents.send('tab-created', result.tab);
      }

      return result;
    };

    // Pin/unpin tab
    this.commandHandlers.pin_tab = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId, pinned = true } = params;
      if (!tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      return this.tabManager.pinTab(tabId, pinned);
    };

    // Mute/unmute tab
    this.commandHandlers.mute_tab = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId, muted = true } = params;
      if (!tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      const result = this.tabManager.muteTab(tabId, muted);

      if (result.success) {
        this.mainWindow.webContents.send('tab-mute', {
          tabId: result.tab.id,
          muted: result.tab.muted
        });
      }

      return result;
    };

    // Set tab zoom
    this.commandHandlers.set_tab_zoom = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId, zoomLevel } = params;
      if (zoomLevel === undefined) {
        return { success: false, error: 'Zoom level is required' };
      }

      const result = this.tabManager.setZoom(tabId, zoomLevel);

      if (result.success) {
        this.mainWindow.webContents.send('tab-zoom', {
          tabId: result.tabId,
          zoomLevel: result.zoomLevel
        });
      }

      return result;
    };

    // Move tab
    this.commandHandlers.move_tab = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId, newIndex } = params;
      if (!tabId || newIndex === undefined) {
        return { success: false, error: 'Tab ID and new index are required' };
      }

      return this.tabManager.moveTab(tabId, newIndex);
    };

    // Close other tabs
    this.commandHandlers.close_other_tabs = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      if (!tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      const result = this.tabManager.closeOtherTabs(tabId);

      if (result.success) {
        this.mainWindow.webContents.send('tabs-closed-other', { keptTabId: tabId });
      }

      return result;
    };

    // Next tab
    this.commandHandlers.next_tab = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const result = this.tabManager.nextTab();

      if (result.success) {
        this.mainWindow.webContents.send('tab-switched', {
          tabId: result.tab.id,
          previousTabId: result.previousTabId
        });
      }

      return result;
    };

    // Previous tab
    this.commandHandlers.previous_tab = async (params) => {
      if (!this.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const result = this.tabManager.previousTab();

      if (result.success) {
        this.mainWindow.webContents.send('tab-switched', {
          tabId: result.tab.id,
          previousTabId: result.previousTabId
        });
      }

      return result;
    };

    // ==================== TAB COMMAND ALIASES ====================
    // These aliases provide alternative command names for tab operations

    // create_tab - Alias for new_tab
    this.commandHandlers.create_tab = async (params) => {
      return this.commandHandlers.new_tab(params);
    };

    // get_tabs - Alias for list_tabs
    this.commandHandlers.get_tabs = async (params) => {
      return this.commandHandlers.list_tabs(params);
    };

    // tab_navigate - Alias for navigate_tab
    this.commandHandlers.tab_navigate = async (params) => {
      return this.commandHandlers.navigate_tab(params);
    };

    // ==================== UTILITY COMMANDS ====================

    // Ping/health check
    this.commandHandlers.ping = async (params) => {
      return { success: true, message: 'pong', timestamp: Date.now() };
    };

    // Get browser status
    this.commandHandlers.status = async (params) => {
      const status = {
        clients: this.clients.size,
        port: this.port,
        ready: true,
        recording: this.recordingManager.getStatus()
      };

      // Add session info if available
      if (this.sessionManager) {
        status.sessions = this.sessionManager.listSessions().sessions.length;
        status.activeSession = this.sessionManager.activeSessionId;
      }

      // Add tab info if available
      if (this.tabManager) {
        status.tabs = this.tabManager.tabs.size;
        status.activeTab = this.tabManager.activeTabId;
      }

      return {
        success: true,
        status
      };
    };

    // ==========================================
    // Enhanced Screenshot Commands
    // ==========================================

    // Capture full page screenshot (scroll and stitch)
    this.commandHandlers.screenshot_full_page = async (params) => {
      const {
        format = 'png',
        quality,
        scrollDelay = 100,
        maxHeight = 32000,
        savePath = null
      } = params;

      try {
        const result = await this.screenshotManager.captureFullPage({
          format,
          quality,
          scrollDelay,
          maxHeight
        });

        if (result.success && savePath) {
          const saveResult = await this.screenshotManager.saveToFile(result.data, savePath);
          result.savedTo = saveResult.success ? savePath : null;
          result.saveError = saveResult.error || null;
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Capture screenshot of specific element
    this.commandHandlers.screenshot_element = async (params) => {
      const {
        selector,
        format = 'png',
        quality,
        padding = 0,
        savePath = null
      } = params;

      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }

      try {
        const result = await this.screenshotManager.captureElement(selector, {
          format,
          quality,
          padding
        });

        if (result.success && savePath) {
          const saveResult = await this.screenshotManager.saveToFile(result.data, savePath);
          result.savedTo = saveResult.success ? savePath : null;
          result.saveError = saveResult.error || null;
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Capture screenshot of specific area (coordinates)
    this.commandHandlers.screenshot_area = async (params) => {
      const {
        x,
        y,
        width,
        height,
        format = 'png',
        quality,
        savePath = null
      } = params;

      if (x === undefined || y === undefined || width === undefined || height === undefined) {
        return { success: false, error: 'x, y, width, and height are required' };
      }

      try {
        const result = await this.screenshotManager.captureArea(
          { x, y, width, height },
          { format, quality }
        );

        if (result.success && savePath) {
          const saveResult = await this.screenshotManager.saveToFile(result.data, savePath);
          result.savedTo = saveResult.success ? savePath : null;
          result.saveError = saveResult.error || null;
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Capture viewport screenshot with enhanced options
    this.commandHandlers.screenshot_viewport = async (params) => {
      const {
        format = 'png',
        quality,
        savePath = null
      } = params;

      try {
        const result = await this.screenshotManager.captureViewport({
          format,
          quality
        });

        if (result.success && savePath) {
          const saveResult = await this.screenshotManager.saveToFile(result.data, savePath);
          result.savedTo = saveResult.success ? savePath : null;
          result.saveError = saveResult.error || null;
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Annotate screenshot
    this.commandHandlers.annotate_screenshot = async (params) => {
      const { imageData, annotations } = params;

      if (!imageData) {
        return { success: false, error: 'imageData is required' };
      }

      if (!annotations || !Array.isArray(annotations) || annotations.length === 0) {
        return { success: false, error: 'annotations array is required' };
      }

      // Validate all annotations
      for (let i = 0; i < annotations.length; i++) {
        const validation = validateAnnotation(annotations[i]);
        if (!validation.valid) {
          return { success: false, error: `Annotation ${i}: ${validation.error}` };
        }
      }

      // Apply defaults to annotations
      const processedAnnotations = annotations.map(applyAnnotationDefaults);

      try {
        const result = await this.screenshotManager.annotateScreenshot(imageData, processedAnnotations);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get supported screenshot formats
    this.commandHandlers.screenshot_formats = async (params) => {
      return {
        success: true,
        formats: this.screenshotManager.getSupportedFormats()
      };
    };

    // ==========================================
    // Screen Recording Commands
    // ==========================================

    // Start screen recording
    this.commandHandlers.start_recording = async (params) => {
      const {
        format = 'webm',
        quality = 'medium',
        includeAudio = false,
        filename = null
      } = params;

      try {
        const result = await this.recordingManager.startRecording({
          format,
          quality,
          includeAudio,
          filename
        });

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Stop screen recording
    this.commandHandlers.stop_recording = async (params) => {
      const {
        savePath = null,
        returnData = true
      } = params;

      try {
        const result = await this.recordingManager.stopRecording({
          savePath,
          returnData
        });

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Pause screen recording
    this.commandHandlers.pause_recording = async (params) => {
      try {
        const result = await this.recordingManager.pauseRecording();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Resume screen recording
    this.commandHandlers.resume_recording = async (params) => {
      try {
        const result = await this.recordingManager.resumeRecording();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get recording status
    this.commandHandlers.recording_status = async (params) => {
      try {
        const status = this.recordingManager.getStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available recording sources
    this.commandHandlers.recording_sources = async (params) => {
      try {
        const result = await this.recordingManager.getAvailableSources();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get supported recording formats and quality presets
    this.commandHandlers.recording_formats = async (params) => {
      return {
        success: true,
        formats: this.recordingManager.getSupportedFormats(),
        qualityPresets: this.recordingManager.getQualityPresets()
      };
    };

    // ==========================================
    // Proxy Management Commands
    // ==========================================

    // Set proxy configuration
    this.commandHandlers.set_proxy = async (params) => {
      const { host, port, type, auth, bypassRules } = params;

      if (!host || !port) {
        return { success: false, error: 'Host and port are required' };
      }

      try {
        const result = await proxyManager.setProxy({
          host,
          port,
          type: type || 'http',
          auth,
          bypassRules
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear proxy (use direct connection)
    this.commandHandlers.clear_proxy = async (params) => {
      try {
        const result = await proxyManager.clearProxy();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get proxy status
    this.commandHandlers.get_proxy_status = async (params) => {
      try {
        const status = proxyManager.getProxyStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set proxy list for rotation
    this.commandHandlers.set_proxy_list = async (params) => {
      const { proxies } = params;

      if (!proxies || !Array.isArray(proxies)) {
        return { success: false, error: 'Proxies array is required' };
      }

      try {
        const result = proxyManager.setProxyList(proxies);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add a proxy to rotation list
    this.commandHandlers.add_proxy = async (params) => {
      const { host, port, type, auth } = params;

      if (!host || !port) {
        return { success: false, error: 'Host and port are required' };
      }

      try {
        const result = proxyManager.addProxy({
          host,
          port,
          type: type || 'http',
          auth
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Remove a proxy from rotation list
    this.commandHandlers.remove_proxy = async (params) => {
      const { host, port } = params;

      if (!host || !port) {
        return { success: false, error: 'Host and port are required' };
      }

      try {
        const result = proxyManager.removeProxy(host, port);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Rotate to next proxy
    this.commandHandlers.rotate_proxy = async (params) => {
      try {
        const result = await proxyManager.rotateProxy();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Start proxy rotation
    this.commandHandlers.start_proxy_rotation = async (params) => {
      const { intervalMs, mode, rotateAfterRequests } = params;

      try {
        const result = proxyManager.startRotation({
          intervalMs,
          mode,
          rotateAfterRequests
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Stop proxy rotation
    this.commandHandlers.stop_proxy_rotation = async (params) => {
      try {
        const result = proxyManager.stopRotation();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Test proxy connection
    this.commandHandlers.test_proxy = async (params) => {
      const { host, port, type, auth } = params;

      if (!host || !port) {
        return { success: false, error: 'Host and port are required' };
      }

      try {
        const result = await proxyManager.testProxy({
          host,
          port,
          type: type || 'http',
          auth
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get proxy statistics
    this.commandHandlers.get_proxy_stats = async (params) => {
      try {
        const stats = proxyManager.getStats();
        return { success: true, stats };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available proxy types
    this.commandHandlers.get_proxy_types = async (params) => {
      return {
        success: true,
        types: Object.values(PROXY_TYPES)
      };
    };

    // ==========================================
    // User Agent Management Commands
    // ==========================================

    // Set user agent
    this.commandHandlers.set_user_agent = async (params) => {
      const { userAgent, category } = params;

      try {
        let ua = userAgent;

        // If category is provided, get a random user agent from that category
        if (category && !userAgent) {
          ua = userAgentManager.getUserAgentByCategory(category);
          if (!ua) {
            return {
              success: false,
              error: `Invalid category: ${category}`,
              availableCategories: Object.keys(UA_CATEGORIES)
            };
          }
        }

        if (!ua) {
          return { success: false, error: 'User agent or category is required' };
        }

        const result = userAgentManager.setUserAgent(ua, this.mainWindow);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get random user agent
    this.commandHandlers.get_random_user_agent = async (params) => {
      const { category } = params;

      try {
        let userAgent;
        if (category) {
          userAgent = userAgentManager.getUserAgentByCategory(category);
          if (!userAgent) {
            return {
              success: false,
              error: `Invalid category: ${category}`,
              availableCategories: Object.keys(UA_CATEGORIES)
            };
          }
        } else {
          userAgent = userAgentManager.getRandomUserAgent();
        }

        return { success: true, userAgent };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Rotate user agent
    this.commandHandlers.rotate_user_agent = async (params) => {
      try {
        const result = userAgentManager.rotateUserAgent(this.mainWindow);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Start user agent rotation
    this.commandHandlers.start_user_agent_rotation = async (params) => {
      const { intervalMs, mode, rotateAfterRequests } = params;

      try {
        const result = userAgentManager.startRotation(this.mainWindow, {
          intervalMs,
          mode,
          rotateAfterRequests
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Stop user agent rotation
    this.commandHandlers.stop_user_agent_rotation = async (params) => {
      try {
        const result = userAgentManager.stopRotation();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set enabled user agent categories
    this.commandHandlers.set_user_agent_categories = async (params) => {
      const { categories } = params;

      if (!categories || !Array.isArray(categories)) {
        return { success: false, error: 'Categories array is required' };
      }

      try {
        const result = userAgentManager.setEnabledCategories(categories);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add custom user agent
    this.commandHandlers.add_custom_user_agent = async (params) => {
      const { userAgent } = params;

      if (!userAgent) {
        return { success: false, error: 'User agent is required' };
      }

      try {
        const result = userAgentManager.addCustomUserAgent(userAgent);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear custom user agents
    this.commandHandlers.clear_custom_user_agents = async (params) => {
      try {
        const result = userAgentManager.clearCustomUserAgents();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get user agent status
    this.commandHandlers.get_user_agent_status = async (params) => {
      try {
        const status = userAgentManager.getStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available user agent categories
    this.commandHandlers.get_user_agent_categories = async (params) => {
      try {
        const categories = userAgentManager.getAvailableCategories();
        return { success: true, categories };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Parse user agent string
    this.commandHandlers.parse_user_agent = async (params) => {
      const { userAgent } = params;

      if (!userAgent) {
        return { success: false, error: 'User agent is required' };
      }

      try {
        const info = userAgentManager.parseUserAgent(userAgent);
        return { success: true, info };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Request Interception Commands
    // ==========================================

    // Set request rules (block, allow, header modification)
    this.commandHandlers.set_request_rules = async (params) => {
      const {
        blockRules,
        allowRules,
        headerRules,
        predefinedCategories,
        blockedResourceTypes,
        customHeaders,
        removeHeaders,
        clearExisting
      } = params;

      try {
        const result = requestInterceptor.setRequestRules({
          blockRules,
          allowRules,
          headerRules,
          predefinedCategories,
          blockedResourceTypes,
          customHeaders,
          removeHeaders,
          clearExisting
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear all request rules
    this.commandHandlers.clear_request_rules = async (params) => {
      try {
        const result = requestInterceptor.clearRequestRules();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add a block rule
    this.commandHandlers.add_block_rule = async (params) => {
      const { pattern, description, resourceTypes } = params;

      if (!pattern) {
        return { success: false, error: 'Pattern is required' };
      }

      try {
        const result = requestInterceptor.addBlockRule({
          pattern,
          description,
          resourceTypes
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add an allow rule (overrides block rules)
    this.commandHandlers.add_allow_rule = async (params) => {
      const { pattern, description } = params;

      if (!pattern) {
        return { success: false, error: 'Pattern is required' };
      }

      try {
        const result = requestInterceptor.addAllowRule({
          pattern,
          description
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add a header modification rule
    this.commandHandlers.add_header_rule = async (params) => {
      const { header, action, value, urlPattern, description } = params;

      if (!header || !action) {
        return { success: false, error: 'Header and action are required' };
      }

      try {
        const result = requestInterceptor.addHeaderRule({
          header,
          action,
          value,
          urlPattern,
          description
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Remove a rule by ID
    this.commandHandlers.remove_request_rule = async (params) => {
      const { ruleId } = params;

      if (!ruleId) {
        return { success: false, error: 'Rule ID is required' };
      }

      try {
        const result = requestInterceptor.removeRule(ruleId);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set custom headers
    this.commandHandlers.set_custom_headers = async (params) => {
      const { headers } = params;

      if (!headers || typeof headers !== 'object') {
        return { success: false, error: 'Headers object is required' };
      }

      try {
        const result = requestInterceptor.setCustomHeaders(headers);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set headers to remove
    this.commandHandlers.set_headers_to_remove = async (params) => {
      const { headers } = params;

      if (!headers || !Array.isArray(headers)) {
        return { success: false, error: 'Headers array is required' };
      }

      try {
        const result = requestInterceptor.setHeadersToRemove(headers);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Block resource type
    this.commandHandlers.block_resource_type = async (params) => {
      const { resourceType } = params;

      if (!resourceType) {
        return { success: false, error: 'Resource type is required' };
      }

      try {
        const result = requestInterceptor.blockResourceType(resourceType);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Unblock resource type
    this.commandHandlers.unblock_resource_type = async (params) => {
      const { resourceType } = params;

      if (!resourceType) {
        return { success: false, error: 'Resource type is required' };
      }

      try {
        const result = requestInterceptor.unblockResourceType(resourceType);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Apply predefined rules (ads, trackers, social)
    this.commandHandlers.apply_predefined_rules = async (params) => {
      const { category } = params;

      if (!category) {
        return { success: false, error: 'Category is required' };
      }

      try {
        const result = requestInterceptor.applyPredefinedRules(category);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get request interceptor status
    this.commandHandlers.get_request_interceptor_status = async (params) => {
      try {
        const status = requestInterceptor.getStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Export request rules
    this.commandHandlers.export_request_rules = async (params) => {
      try {
        const rules = requestInterceptor.exportRules();
        return { success: true, rules };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Import request rules
    this.commandHandlers.import_request_rules = async (params) => {
      const { rules, merge } = params;

      if (!rules || typeof rules !== 'object') {
        return { success: false, error: 'Rules object is required' };
      }

      try {
        const result = requestInterceptor.importRules(rules, merge);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Reset request statistics
    this.commandHandlers.reset_request_stats = async (params) => {
      try {
        const result = requestInterceptor.resetStats();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available resource types
    this.commandHandlers.get_resource_types = async (params) => {
      return {
        success: true,
        types: Object.values(RESOURCE_TYPES)
      };
    };

    // Get predefined rule categories
    this.commandHandlers.get_predefined_categories = async (params) => {
      return {
        success: true,
        categories: Object.keys(PREDEFINED_BLOCK_RULES),
        ruleCounts: Object.fromEntries(
          Object.entries(PREDEFINED_BLOCK_RULES).map(([key, rules]) => [key, rules.length])
        )
      };
    };

    // Enable request interceptor
    this.commandHandlers.enable_request_interceptor = async (params) => {
      try {
        const result = requestInterceptor.enable();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Disable request interceptor
    this.commandHandlers.disable_request_interceptor = async (params) => {
      try {
        const result = requestInterceptor.disable();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Content Blocking Commands
    // ==========================================

    // Enable content blocking
    this.commandHandlers.enable_blocking = async (params) => {
      if (!this.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      try {
        return this.blockingManager.enableBlocking();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Disable content blocking
    this.commandHandlers.disable_blocking = async (params) => {
      if (!this.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      try {
        return this.blockingManager.disableBlocking();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add block rule
    this.commandHandlers.add_block_rule = async (params) => {
      if (!this.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      const { pattern, description } = params;
      if (!pattern) {
        return { success: false, error: 'Pattern is required' };
      }
      try {
        return this.blockingManager.addBlockRule(pattern, { description });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Remove block rule
    this.commandHandlers.remove_block_rule = async (params) => {
      if (!this.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      const { pattern } = params;
      if (!pattern) {
        return { success: false, error: 'Pattern is required' };
      }
      try {
        return this.blockingManager.removeBlockRule(pattern);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get block rules
    this.commandHandlers.get_block_rules = async (params) => {
      if (!this.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      try {
        return this.blockingManager.getBlockRules();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Load filter list from URL
    this.commandHandlers.load_filter_list = async (params) => {
      if (!this.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      const { url } = params;
      if (!url) {
        return { success: false, error: 'URL is required' };
      }
      try {
        return await this.blockingManager.loadFilterList(url);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get blocking statistics
    this.commandHandlers.get_blocking_stats = async (params) => {
      if (!this.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      try {
        return this.blockingManager.getStats();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Whitelist domain
    this.commandHandlers.whitelist_domain = async (params) => {
      if (!this.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      const { domain } = params;
      if (!domain) {
        return { success: false, error: 'Domain is required' };
      }
      try {
        return this.blockingManager.whitelistDomain(domain);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get whitelist
    this.commandHandlers.get_whitelist = async (params) => {
      if (!this.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      try {
        return this.blockingManager.getWhitelist();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Advanced Keyboard Input Commands
    // ==========================================

    // Press a single key
    this.commandHandlers.key_press = async (params) => {
      const { key, modifiers = {}, humanize = true } = params;

      if (!key) {
        return { success: false, error: 'Key is required' };
      }

      if (humanize) {
        await humanDelay(30, 100);
      }

      try {
        // Check if it's a special key
        const script = keyboard.KEY_CODES[key]
          ? keyboard.getSpecialKeyScript(key, { repeat: params.repeat || 1 })
          : keyboard.getFullKeyPressScript(key, { modifiers, layout: params.layout || 'en-US' });

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Press key combination (e.g., Ctrl+C, Ctrl+Shift+V)
    this.commandHandlers.key_combination = async (params) => {
      const { keys, humanize = true } = params;

      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return { success: false, error: 'Keys array is required' };
      }

      if (humanize) {
        await humanDelay(50, 150);
      }

      try {
        const script = keyboard.getKeyCombinationScript(keys, {
          holdTime: params.holdTime || 50
        });

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Type text with human-like timing
    this.commandHandlers.type_text = async (params) => {
      const {
        text,
        selector = null,
        minDelay = 30,
        maxDelay = 150,
        mistakeRate = 0.02,
        clearFirst = false,
        layout = 'en-US'
      } = params;

      if (!text) {
        return { success: false, error: 'Text is required' };
      }

      try {
        // If selector provided, focus it first
        if (selector) {
          const focusScript = `
            (function() {
              const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
              if (el) {
                el.focus();
                return { success: true };
              }
              return { success: false, error: 'Element not found' };
            })();
          `;

          const focusResult = await new Promise((resolve) => {
            this.mainWindow.webContents.send('execute-in-webview', focusScript);
            ipcMain.once('webview-execute-response', (event, result) => {
              resolve(result);
            });
          });

          if (!focusResult.success) {
            return focusResult;
          }

          await humanDelay(50, 150);
        }

        const script = keyboard.getTypeTextScript(text, {
          minDelay,
          maxDelay,
          mistakeRate,
          clearFirst,
          layout
        });

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get estimated typing duration
    this.commandHandlers.estimate_typing = async (params) => {
      const { text, baseDelay = 80 } = params;

      if (!text) {
        return { success: false, error: 'Text is required' };
      }

      const duration = keyboard.estimateTypingDuration(text, { baseDelay });
      return { success: true, duration, text: text.length + ' characters' };
    };

    // Get available keyboard layouts
    this.commandHandlers.keyboard_layouts = async (params) => {
      return {
        success: true,
        layouts: Object.entries(keyboard.KEYBOARD_LAYOUTS).map(([code, layout]) => ({
          code,
          name: layout.name
        }))
      };
    };

    // Get special key codes
    this.commandHandlers.special_keys = async (params) => {
      return {
        success: true,
        keys: Object.keys(keyboard.KEY_CODES)
      };
    };

    // ==========================================
    // Advanced Mouse Input Commands
    // ==========================================

    // Move mouse to coordinates
    this.commandHandlers.mouse_move = async (params) => {
      const {
        x,
        y,
        duration = null,
        steps = 20,
        curvature = 0.3,
        humanize = true
      } = params;

      if (x === undefined || y === undefined) {
        return { success: false, error: 'X and Y coordinates are required' };
      }

      if (humanize) {
        await humanDelay(20, 80);
      }

      try {
        const script = mouse.getMouseMoveScript(x, y, {
          steps,
          duration,
          curvature,
          overshoot: humanize
        });

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Click at position
    this.commandHandlers.mouse_click = async (params) => {
      const {
        x,
        y,
        button = 'left',
        clickCount = 1,
        moveFirst = true,
        humanize = true
      } = params;

      if (x === undefined || y === undefined) {
        return { success: false, error: 'X and Y coordinates are required' };
      }

      if (humanize) {
        await humanDelay(30, 100);
      }

      try {
        const script = mouse.getMouseClickScript(x, y, {
          button,
          clickCount,
          moveFirst: moveFirst && humanize
        });

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Double-click at position
    this.commandHandlers.mouse_double_click = async (params) => {
      const { x, y, humanize = true } = params;

      if (x === undefined || y === undefined) {
        return { success: false, error: 'X and Y coordinates are required' };
      }

      if (humanize) {
        await humanDelay(30, 100);
      }

      try {
        const script = mouse.getMouseDoubleClickScript(x, y, {
          moveFirst: humanize
        });

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Right-click at position
    this.commandHandlers.mouse_right_click = async (params) => {
      const { x, y, humanize = true } = params;

      if (x === undefined || y === undefined) {
        return { success: false, error: 'X and Y coordinates are required' };
      }

      if (humanize) {
        await humanDelay(30, 100);
      }

      try {
        const script = mouse.getMouseRightClickScript(x, y, {
          moveFirst: humanize
        });

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Drag from point A to point B
    this.commandHandlers.mouse_drag = async (params) => {
      const {
        startX,
        startY,
        endX,
        endY,
        steps = 25,
        holdTime = 100,
        humanize = true
      } = params;

      if (startX === undefined || startY === undefined ||
          endX === undefined || endY === undefined) {
        return { success: false, error: 'Start and end coordinates are required' };
      }

      if (humanize) {
        await humanDelay(50, 150);
      }

      try {
        const script = mouse.getMouseDragScript(
          { x: startX, y: startY },
          { x: endX, y: endY },
          { steps, holdTime }
        );

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Hover at position
    this.commandHandlers.mouse_hover = async (params) => {
      const {
        x,
        y,
        duration = 500,
        humanize = true
      } = params;

      if (x === undefined || y === undefined) {
        return { success: false, error: 'X and Y coordinates are required' };
      }

      if (humanize) {
        await humanDelay(20, 80);
      }

      try {
        const script = mouse.getMouseHoverScript(x, y, {
          duration,
          moveFirst: humanize
        });

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Scroll at position with momentum
    this.commandHandlers.mouse_scroll = async (params) => {
      const {
        x = null,
        y = null,
        deltaY = 300,
        deltaX = 0,
        momentum = true,
        selector = null,
        humanize = true
      } = params;

      if (humanize) {
        await humanDelay(30, 100);
      }

      try {
        const script = mouse.getMouseScrollScript({
          x,
          y,
          deltaY,
          deltaX,
          momentum: momentum && humanize,
          selector
        });

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Mouse wheel event
    this.commandHandlers.mouse_wheel = async (params) => {
      const {
        x = null,
        y = null,
        deltaY = 100,
        deltaX = 0,
        deltaMode = 0
      } = params;

      try {
        const script = mouse.getMouseWheelScript({
          x,
          y,
          deltaY,
          deltaX,
          deltaMode
        });

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Click on element by selector
    this.commandHandlers.click_at_element = async (params) => {
      const {
        selector,
        button = 'left',
        clickCount = 1,
        offsetX = 0.5,
        offsetY = 0.5,
        humanize = true
      } = params;

      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }

      if (humanize) {
        await humanDelay(50, 150);
      }

      try {
        const script = mouse.getClickElementScript(selector, {
          button,
          clickCount,
          offset: { x: offsetX, y: offsetY }
        });

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Initialize mouse position tracking
    this.commandHandlers.init_mouse_tracking = async (params) => {
      try {
        const script = mouse.getMousePositionTrackingScript();

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, position: result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get current mouse position
    this.commandHandlers.get_mouse_position = async (params) => {
      try {
        const script = `
          (function() {
            return window.__lastMousePos || { x: null, y: null, tracked: false };
          })();
        `;

        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => {
            resolve({ success: true, ...result });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Network Throttling Commands
    // ==========================================

    // Set custom network throttling speeds
    this.commandHandlers.set_network_throttling = async (params) => {
      if (!this.networkThrottler) {
        return { success: false, error: 'Network throttler not available' };
      }

      const { download, upload, latency } = params;

      try {
        const result = await this.networkThrottler.setThrottling(download, upload, latency);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set network throttling using a preset profile
    this.commandHandlers.set_network_preset = async (params) => {
      if (!this.networkThrottler) {
        return { success: false, error: 'Network throttler not available' };
      }

      const { preset } = params;
      if (!preset) {
        return { success: false, error: 'Preset name is required' };
      }

      try {
        const result = await this.networkThrottler.setPreset(preset);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available network throttling presets
    this.commandHandlers.get_network_presets = async (params) => {
      if (!this.networkThrottler) {
        return { success: false, error: 'Network throttler not available' };
      }

      try {
        return this.networkThrottler.getPresets();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Enable network throttling
    this.commandHandlers.enable_throttling = async (params) => {
      if (!this.networkThrottler) {
        return { success: false, error: 'Network throttler not available' };
      }

      try {
        const result = await this.networkThrottler.enable();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Disable network throttling
    this.commandHandlers.disable_throttling = async (params) => {
      if (!this.networkThrottler) {
        return { success: false, error: 'Network throttler not available' };
      }

      try {
        const result = await this.networkThrottler.disable();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get current network throttling status
    this.commandHandlers.get_throttling_status = async (params) => {
      if (!this.networkThrottler) {
        return { success: false, error: 'Network throttler not available' };
      }

      try {
        const status = this.networkThrottler.getStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Geolocation Spoofing Commands
    // ==========================================

    // Set geolocation with custom coordinates
    this.commandHandlers.set_geolocation = async (params) => {
      if (!this.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed, timezone } = params;

      if (latitude === undefined || longitude === undefined) {
        return { success: false, error: 'Latitude and longitude are required' };
      }

      try {
        const result = this.geolocationManager.setLocation(latitude, longitude, {
          accuracy, altitude, altitudeAccuracy, heading, speed, timezone
        });

        if (result.success && this.geolocationManager.isEnabled()) {
          this.mainWindow.webContents.send('inject-geolocation-script', this.geolocationManager.getFullSpoofScript());
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set geolocation by city name
    this.commandHandlers.set_geolocation_city = async (params) => {
      if (!this.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      const { city } = params;
      if (!city) {
        return { success: false, error: 'City name is required' };
      }

      try {
        const result = this.geolocationManager.setLocationByCity(city);

        if (result.success && this.geolocationManager.isEnabled()) {
          this.mainWindow.webContents.send('inject-geolocation-script', this.geolocationManager.getFullSpoofScript());
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get current geolocation settings
    this.commandHandlers.get_geolocation = async (params) => {
      if (!this.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      try {
        const location = this.geolocationManager.getLocation();
        return { success: true, ...location };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Enable geolocation spoofing
    this.commandHandlers.enable_geolocation_spoofing = async (params) => {
      if (!this.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      try {
        const result = this.geolocationManager.enableSpoofing();

        if (result.success) {
          this.mainWindow.webContents.send('inject-geolocation-script', this.geolocationManager.getFullSpoofScript());
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Disable geolocation spoofing
    this.commandHandlers.disable_geolocation_spoofing = async (params) => {
      if (!this.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      try {
        return this.geolocationManager.disableSpoofing();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available preset locations
    this.commandHandlers.get_preset_locations = async (params) => {
      if (!this.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      try {
        const { country, region } = params || {};
        const presets = this.geolocationManager.getPresetLocations({ country, region });
        return { success: true, presets };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get geolocation spoofing status
    this.commandHandlers.get_geolocation_status = async (params) => {
      if (!this.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      try {
        const status = this.geolocationManager.getStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Reset geolocation to default
    this.commandHandlers.reset_geolocation = async (params) => {
      if (!this.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      try {
        return this.geolocationManager.reset();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Header Management Commands
    // ==========================================

    // Set a request header
    this.commandHandlers.set_request_header = async (params) => {
      if (!this.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { name, value } = params;
      if (!name) {
        return { success: false, error: 'Header name is required' };
      }
      try {
        return this.headerManager.setRequestHeader(name, value);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Remove a request header
    this.commandHandlers.remove_request_header = async (params) => {
      if (!this.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { name } = params;
      if (!name) {
        return { success: false, error: 'Header name is required' };
      }
      try {
        return this.headerManager.removeRequestHeader(name);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set a response header
    this.commandHandlers.set_response_header = async (params) => {
      if (!this.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { name, value } = params;
      if (!name) {
        return { success: false, error: 'Header name is required' };
      }
      try {
        return this.headerManager.setResponseHeader(name, value);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get all custom headers
    this.commandHandlers.get_custom_headers = async (params) => {
      if (!this.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      try {
        const requestHeaders = this.headerManager.getRequestHeaders();
        const responseHeaders = this.headerManager.getResponseHeaders();
        return { success: true, requestHeaders, responseHeaders };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear all headers
    this.commandHandlers.clear_headers = async (params) => {
      if (!this.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { type } = params;
      try {
        if (type === 'request') return this.headerManager.clearRequestHeaders();
        if (type === 'response') return this.headerManager.clearResponseHeaders();
        return this.headerManager.clearAllHeaders();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Create a header profile
    this.commandHandlers.create_header_profile = async (params) => {
      if (!this.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { name, headers } = params;
      if (!name) {
        return { success: false, error: 'Profile name is required' };
      }
      try {
        return this.headerManager.createHeaderProfile(name, headers || {});
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Load a header profile
    this.commandHandlers.load_header_profile = async (params) => {
      if (!this.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { name } = params;
      if (!name) {
        return { success: false, error: 'Profile name is required' };
      }
      try {
        return this.headerManager.loadHeaderProfile(name);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // List all header profiles
    this.commandHandlers.list_header_profiles = async (params) => {
      if (!this.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      try {
        const result = this.headerManager.listHeaderProfiles();
        return { ...result, predefinedProfiles: getPredefinedProfileNames() };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set a conditional header (URL-based rule)
    this.commandHandlers.set_conditional_header = async (params) => {
      if (!this.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { pattern, name, value, type = 'request' } = params;
      if (!pattern || !name) {
        return { success: false, error: 'Pattern and header name are required' };
      }
      try {
        if (type === 'response') {
          return this.headerManager.setConditionalResponseHeader(pattern, name, value);
        }
        return this.headerManager.setConditionalHeader(pattern, name, value);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get header manager status
    this.commandHandlers.get_header_status = async (params) => {
      if (!this.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      try {
        return { success: true, status: this.headerManager.getStatus() };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get predefined profiles list
    this.commandHandlers.get_predefined_header_profiles = async (params) => {
      return {
        success: true,
        profiles: Object.keys(PREDEFINED_PROFILES).map(name => ({
          name,
          description: PREDEFINED_PROFILES[name].description || name
        }))
      };
    };

    // ==========================================
    // Browser Profile Management Commands
    // ==========================================

    // Create a new browser profile
    this.commandHandlers.create_profile = async (params) => {
      if (!this.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { name, userAgent, fingerprint, proxy } = params;
      return this.profileManager.createProfile({ name, userAgent, fingerprint, proxy });
    };

    // Delete a browser profile
    this.commandHandlers.delete_profile = async (params) => {
      if (!this.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId } = params;
      if (!profileId) {
        return { success: false, error: 'Profile ID is required' };
      }

      return await this.profileManager.deleteProfile(profileId);
    };

    // Get profile details
    this.commandHandlers.get_profile = async (params) => {
      if (!this.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId } = params;
      if (!profileId) {
        return { success: false, error: 'Profile ID is required' };
      }

      return this.profileManager.getProfile(profileId);
    };

    // List all browser profiles
    this.commandHandlers.list_profiles = async (params) => {
      if (!this.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      return this.profileManager.listProfiles();
    };

    // Switch to a different browser profile
    this.commandHandlers.switch_profile = async (params) => {
      if (!this.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId } = params;
      if (!profileId) {
        return { success: false, error: 'Profile ID is required' };
      }

      const result = await this.profileManager.switchProfile(profileId);

      // Notify renderer to update partition and apply fingerprint
      if (result.success) {
        this.mainWindow.webContents.send('profile-changed', {
          profileId,
          partition: result.partition,
          profile: result.profile
        });
      }

      return result;
    };

    // Update a browser profile
    this.commandHandlers.update_profile = async (params) => {
      if (!this.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId, updates } = params;
      if (!profileId) {
        return { success: false, error: 'Profile ID is required' };
      }
      if (!updates) {
        return { success: false, error: 'Updates object is required' };
      }

      return this.profileManager.updateProfile(profileId, updates);
    };

    // Export a browser profile to JSON
    this.commandHandlers.export_profile = async (params) => {
      if (!this.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId } = params;
      return await this.profileManager.exportProfile(profileId);
    };

    // Import a browser profile from JSON
    this.commandHandlers.import_profile = async (params) => {
      if (!this.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { data } = params;
      if (!data) {
        return { success: false, error: 'Profile data is required' };
      }

      return await this.profileManager.importProfile(data);
    };

    // Randomize a profile's fingerprint
    this.commandHandlers.randomize_profile_fingerprint = async (params) => {
      if (!this.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId } = params;
      if (!profileId) {
        return { success: false, error: 'Profile ID is required' };
      }

      return this.profileManager.randomizeFingerprint(profileId);
    };

    // Get the active browser profile
    this.commandHandlers.get_active_profile = async (params) => {
      if (!this.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const profile = this.profileManager.getActiveProfile();
      if (!profile) {
        return { success: false, error: 'No active profile' };
      }

      return { success: true, profile: profile.toJSON() };
    };

    // Get the fingerprint evasion script for a profile
    this.commandHandlers.get_profile_evasion_script = async (params) => {
      if (!this.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId } = params;
      return { success: true, script: this.profileManager.getEvasionScript(profileId) };
    };

    // ==========================================
    // Storage Management Commands
    // ==========================================

    // Get localStorage for origin
    this.commandHandlers.get_local_storage = async (params) => {
      if (!this.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await this.storageManager.getLocalStorage(origin);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set localStorage item
    this.commandHandlers.set_local_storage = async (params) => {
      if (!this.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin, key, value } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }
      if (!key) {
        return { success: false, error: 'Key is required' };
      }

      try {
        return await this.storageManager.setLocalStorageItem(origin, key, value);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear localStorage for origin
    this.commandHandlers.clear_local_storage = async (params) => {
      if (!this.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await this.storageManager.clearLocalStorage(origin);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get sessionStorage for origin
    this.commandHandlers.get_session_storage = async (params) => {
      if (!this.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await this.storageManager.getSessionStorage(origin);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set sessionStorage item
    this.commandHandlers.set_session_storage = async (params) => {
      if (!this.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin, key, value } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }
      if (!key) {
        return { success: false, error: 'Key is required' };
      }

      try {
        return await this.storageManager.setSessionStorageItem(origin, key, value);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear sessionStorage for origin
    this.commandHandlers.clear_session_storage = async (params) => {
      if (!this.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await this.storageManager.clearSessionStorage(origin);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get IndexedDB databases for origin
    this.commandHandlers.get_indexeddb = async (params) => {
      if (!this.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await this.storageManager.getIndexedDBDatabases(origin);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Delete IndexedDB database
    this.commandHandlers.delete_indexeddb = async (params) => {
      if (!this.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin, name } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }
      if (!name) {
        return { success: false, error: 'Database name is required' };
      }

      try {
        return await this.storageManager.deleteIndexedDBDatabase(origin, name);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Export storage for origin
    this.commandHandlers.export_storage = async (params) => {
      if (!this.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin, types, filepath } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        if (filepath) {
          return await this.storageManager.exportStorageToFile(filepath, origin, types);
        }
        return await this.storageManager.exportStorage(origin, types);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Import storage for origin
    this.commandHandlers.import_storage = async (params) => {
      if (!this.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin, data, filepath } = params;

      try {
        if (filepath) {
          return await this.storageManager.importStorageFromFile(filepath, origin);
        }
        if (!data) {
          return { success: false, error: 'Data or filepath is required' };
        }
        return await this.storageManager.importStorage(origin, data);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get storage statistics for origin
    this.commandHandlers.get_storage_stats = async (params) => {
      if (!this.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await this.storageManager.getStorageStats(origin);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear all storage for origin
    this.commandHandlers.clear_all_storage = async (params) => {
      if (!this.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin, types } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await this.storageManager.clearAllStorage(origin, types);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // DOM Inspector Commands
    // ==========================================

    this.commandHandlers.inspect_element = async (params) => {
      const { selector } = params;
      if (!selector) return { success: false, error: 'Selector is required' };
      try {
        const script = this.domInspector.getElement(selector);
        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => resolve(result));
        });
      } catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.get_element_tree = async (params) => {
      const { selector, depth = 3 } = params;
      if (!selector) return { success: false, error: 'Selector is required' };
      try {
        const script = this.domInspector.getElementTree(selector, depth);
        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => resolve(result));
        });
      } catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.get_element_styles = async (params) => {
      const { selector } = params;
      if (!selector) return { success: false, error: 'Selector is required' };
      try {
        const script = this.domInspector.getElementStyles(selector);
        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => resolve(result));
        });
      } catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.get_element_attributes = async (params) => {
      const { selector } = params;
      if (!selector) return { success: false, error: 'Selector is required' };
      try {
        const script = this.domInspector.getElementAttributes(selector);
        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => resolve(result));
        });
      } catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.generate_selector = async (params) => {
      const { selector } = params;
      if (!selector) return { success: false, error: 'Selector is required' };
      try {
        const script = this.domInspector.getGenerateSelectorScript(selector);
        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => resolve(result));
        });
      } catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.highlight_element = async (params) => {
      const { selector, color } = params;
      if (!selector) return { success: false, error: 'Selector is required' };
      try {
        const script = this.domInspector.highlightElement(selector, color);
        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => resolve(result));
        });
      } catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.remove_highlight = async (params) => {
      try {
        const script = this.domInspector.removeHighlight();
        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => resolve(result));
        });
      } catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.find_elements = async (params) => {
      const { selector, tagName, text, attribute, attributeValue, xpath, visibleOnly, limit, exact } = params;
      if (!selector && !tagName && !text && !attribute && !xpath) return { success: false, error: 'At least one search criterion is required' };
      try {
        const query = { selector, tagName, text, attribute, attributeValue, xpath, visibleOnly: visibleOnly || false, limit: limit || 100, exact: exact || false };
        const script = this.domInspector.findElements(query);
        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => resolve(result));
        });
      } catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.get_element_parent = async (params) => {
      const { selector } = params;
      if (!selector) return { success: false, error: 'Selector is required' };
      try {
        const script = this.domInspector.getParent(selector);
        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => resolve(result));
        });
      } catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.get_element_children = async (params) => {
      const { selector } = params;
      if (!selector) return { success: false, error: 'Selector is required' };
      try {
        const script = this.domInspector.getChildren(selector);
        return new Promise((resolve) => {
          this.mainWindow.webContents.send('execute-in-webview', script);
          ipcMain.once('webview-execute-response', (event, result) => resolve(result));
        });
      } catch (error) { return { success: false, error: error.message }; }
    };

    // ==========================================
    // DevTools Management Commands
    // ==========================================

    // Open DevTools
    this.commandHandlers.open_devtools = async (params) => {
      if (!this.devToolsManager) return { success: false, error: 'DevTools manager not available' };
      try { return this.devToolsManager.openDevTools(params); }
      catch (error) { return { success: false, error: error.message }; }
    };

    // Close DevTools
    this.commandHandlers.close_devtools = async (params) => {
      if (!this.devToolsManager) return { success: false, error: 'DevTools manager not available' };
      try { return this.devToolsManager.closeDevTools(); }
      catch (error) { return { success: false, error: error.message }; }
    };

    // Get network logs
    this.commandHandlers.get_network_logs = async (params) => {
      if (!this.devToolsManager) return { success: false, error: 'DevTools manager not available' };
      try { return this.devToolsManager.getNetworkLogs(params); }
      catch (error) { return { success: false, error: error.message }; }
    };

    // Get performance metrics
    this.commandHandlers.get_performance = async (params) => {
      if (!this.devToolsManager) return { success: false, error: 'DevTools manager not available' };
      try { return await this.devToolsManager.getPerformanceMetrics(); }
      catch (error) { return { success: false, error: error.message }; }
    };

    // ==========================================
    // Console Management Commands
    // ==========================================

    // Get console logs
    this.commandHandlers.get_console_logs = async (params) => {
      if (!this.consoleManager) return { success: false, error: 'Console manager not available' };
      try { return this.consoleManager.getConsoleLogs(params); }
      catch (error) { return { success: false, error: error.message }; }
    };

    // Clear console
    this.commandHandlers.clear_console = async (params) => {
      if (!this.consoleManager) return { success: false, error: 'Console manager not available' };
      try { return this.consoleManager.clearConsoleLogs(); }
      catch (error) { return { success: false, error: error.message }; }
    };

    // Execute console code
    this.commandHandlers.execute_console = async (params) => {
      if (!this.consoleManager) return { success: false, error: 'Console manager not available' };
      const { code, timeout, returnValue } = params;
      if (!code) return { success: false, error: 'Code is required' };
      try { return await this.consoleManager.executeInConsole(code, { timeout, returnValue }); }
      catch (error) { return { success: false, error: error.message }; }
    };

    // ==========================================
    // Automation Script Commands
    // ==========================================

    this.commandHandlers.create_script = async (params) => {
      const { name, script, options = {} } = params;
      if (!name) return { success: false, error: 'Script name is required' };
      if (!script) return { success: false, error: 'Script code is required' };
      if (!this.scriptManager) return { success: false, error: 'Script manager not available' };
      try { return await this.scriptManager.createScript(name, script, options); }
      catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.update_script = async (params) => {
      const { id, updates } = params;
      if (!id) return { success: false, error: 'Script ID is required' };
      if (!updates) return { success: false, error: 'Updates object is required' };
      if (!this.scriptManager) return { success: false, error: 'Script manager not available' };
      try { return await this.scriptManager.updateScript(id, updates); }
      catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.delete_script = async (params) => {
      const { id } = params;
      if (!id) return { success: false, error: 'Script ID is required' };
      if (!this.scriptManager) return { success: false, error: 'Script manager not available' };
      try { return await this.scriptManager.deleteScript(id); }
      catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.get_script = async (params) => {
      const { id } = params;
      if (!id) return { success: false, error: 'Script ID is required' };
      if (!this.scriptManager) return { success: false, error: 'Script manager not available' };
      try { return this.scriptManager.getScript(id); }
      catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.list_scripts = async (params) => {
      if (!this.scriptManager) return { success: false, error: 'Script manager not available' };
      try { return this.scriptManager.listScripts(params || {}); }
      catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.run_script = async (params) => {
      const { id, context = {} } = params;
      if (!id) return { success: false, error: 'Script ID is required' };
      if (!this.scriptManager) return { success: false, error: 'Script manager not available' };
      try { return await this.scriptManager.runScript(id, context); }
      catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.enable_script = async (params) => {
      const { id } = params;
      if (!id) return { success: false, error: 'Script ID is required' };
      if (!this.scriptManager) return { success: false, error: 'Script manager not available' };
      try { return await this.scriptManager.enableScript(id); }
      catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.disable_script = async (params) => {
      const { id } = params;
      if (!id) return { success: false, error: 'Script ID is required' };
      if (!this.scriptManager) return { success: false, error: 'Script manager not available' };
      try { return await this.scriptManager.disableScript(id); }
      catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.export_scripts = async (params) => {
      if (!this.scriptManager) return { success: false, error: 'Script manager not available' };
      try { return this.scriptManager.exportScripts(); }
      catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.import_scripts = async (params) => {
      const { data, overwrite = false } = params;
      if (!data) return { success: false, error: 'Import data is required' };
      if (!this.scriptManager) return { success: false, error: 'Script manager not available' };
      try { return await this.scriptManager.importScripts(data, overwrite); }
      catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.get_script_context = async (params) => {
      if (!this.scriptManager) return { success: false, error: 'Script manager not available' };
      try { return { success: true, context: this.scriptManager.runner.getAvailableContext() }; }
      catch (error) { return { success: false, error: error.message }; }
    };

    this.commandHandlers.get_script_history = async (params) => {
      if (!this.scriptManager) return { success: false, error: 'Script manager not available' };
      try { return { success: true, history: this.scriptManager.runner.getHistory(params || {}) }; }
      catch (error) { return { success: false, error: error.message }; }
    };
  }

  async handleCommand(data) {
    const { command, ...params } = data;

    if (!command) {
      return { success: false, error: 'Command is required' };
    }

    const handler = this.commandHandlers[command];
    if (!handler) {
      return { success: false, error: `Unknown command: ${command}` };
    }

    try {
      return await handler(params);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  getStatus() {
    return {
      connected: this.wss !== null,
      clients: this.clients.size,
      port: this.port
    };
  }

  close() {
    // Cleanup managers
    if (this.screenshotManager) {
      this.screenshotManager.cleanup();
    }
    if (this.recordingManager) {
      this.recordingManager.cleanup();
    }

    if (this.wss) {
      this.clients.forEach((client) => {
        client.close();
      });
      this.wss.close();
      this.wss = null;
      console.log('[WebSocket] Server closed');
    }
  }
}

module.exports = WebSocketServer;
