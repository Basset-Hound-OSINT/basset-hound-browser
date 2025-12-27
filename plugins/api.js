/**
 * Basset Hound Browser - Plugin API Module
 * Defines the API surface available to plugins
 */

const { EventEmitter } = require('events');

/**
 * Permission levels for API access
 */
const PERMISSION_LEVELS = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
  ADMIN: 3
};

/**
 * Available API categories
 */
const API_CATEGORIES = {
  BROWSER: 'browser',
  NAVIGATION: 'navigation',
  NETWORK: 'network',
  CONTENT: 'content',
  STORAGE: 'storage',
  EVENTS: 'events',
  UI: 'ui'
};

/**
 * PluginAPI class
 * Provides a sandboxed API for plugins to interact with the browser
 */
class PluginAPI extends EventEmitter {
  /**
   * Create a new PluginAPI instance
   * @param {Object} options - API options
   * @param {Object} [options.mainWindow] - Electron main window reference
   * @param {Object} [options.webContents] - WebContents reference
   * @param {Object} [options.tabManager] - Tab manager instance
   * @param {Object} [options.sessionManager] - Session manager instance
   * @param {Object} [options.cookieManager] - Cookie manager instance
   * @param {Object} [options.headerManager] - Header manager instance
   * @param {Object} [options.networkAnalysisManager] - Network analysis manager
   * @param {Object} [options.extractionManager] - Content extraction manager
   * @param {Object} [options.storageManager] - Storage manager instance
   */
  constructor(options = {}) {
    super();

    // Browser references
    this.mainWindow = options.mainWindow || null;
    this.webContents = options.webContents || null;

    // Manager references
    this.managers = {
      tab: options.tabManager || null,
      session: options.sessionManager || null,
      cookie: options.cookieManager || null,
      header: options.headerManager || null,
      network: options.networkAnalysisManager || null,
      extraction: options.extractionManager || null,
      storage: options.storageManager || null,
      history: options.historyManager || null,
      geolocation: options.geolocationManager || null,
      profile: options.profileManager || null
    };

    // Plugin hooks registry
    this.hooks = {
      'page:load': [],
      'page:navigate': [],
      'page:beforeNavigate': [],
      'page:domReady': [],
      'page:error': [],
      'request:beforeSend': [],
      'request:completed': [],
      'response:received': [],
      'tab:created': [],
      'tab:closed': [],
      'tab:switched': [],
      'session:created': [],
      'session:switched': [],
      'cookie:set': [],
      'cookie:removed': []
    };

    // Registered commands from plugins
    this.commands = new Map();

    // Plugin contexts for isolation
    this.contexts = new Map();

    // API version for compatibility checking
    this.version = '1.0.0';

    console.log('[PluginAPI] Initialized');
  }

  /**
   * Set a manager reference
   * @param {string} name - Manager name
   * @param {Object} manager - Manager instance
   */
  setManager(name, manager) {
    this.managers[name] = manager;
  }

  /**
   * Set the main window reference
   * @param {Object} mainWindow - Electron BrowserWindow
   */
  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
    this.webContents = mainWindow?.webContents || null;
  }

  /**
   * Create a context for a plugin
   * @param {string} pluginName - Plugin name
   * @param {Object} permissions - Plugin permissions
   * @returns {Object} Plugin context
   */
  createContext(pluginName, permissions = {}) {
    const context = {
      pluginName,
      permissions,
      createdAt: new Date().toISOString(),
      data: new Map()
    };

    this.contexts.set(pluginName, context);

    // Return a bound API for this plugin
    return this.createBoundAPI(pluginName, permissions);
  }

  /**
   * Create a bound API with specific permissions
   * @param {string} pluginName - Plugin name
   * @param {Object} permissions - Plugin permissions
   * @returns {Object} Bound API object
   */
  createBoundAPI(pluginName, permissions = {}) {
    const self = this;

    return {
      // API version
      version: this.version,

      // ==================== Browser API ====================
      browser: {
        /**
         * Get current URL
         */
        async getUrl() {
          return self.safeCall(pluginName, 'browser.getUrl', async () => {
            return new Promise((resolve) => {
              if (self.mainWindow) {
                self.mainWindow.webContents.send('get-webview-url');
                const { ipcMain } = require('electron');
                ipcMain.once('webview-url-response', (event, url) => {
                  resolve({ success: true, url });
                });
              } else {
                resolve({ success: false, error: 'Main window not available' });
              }
            });
          });
        },

        /**
         * Get current page title
         */
        async getTitle() {
          return self.safeCall(pluginName, 'browser.getTitle', async () => {
            return new Promise((resolve) => {
              if (self.mainWindow) {
                self.mainWindow.webContents.send('get-page-title');
                const { ipcMain } = require('electron');
                ipcMain.once('page-title-response', (event, title) => {
                  resolve({ success: true, title });
                });
              } else {
                resolve({ success: false, error: 'Main window not available' });
              }
            });
          });
        },

        /**
         * Get browser status
         */
        getStatus() {
          return {
            success: true,
            hasMainWindow: !!self.mainWindow,
            apiVersion: self.version
          };
        }
      },

      // ==================== Navigation API ====================
      navigation: {
        /**
         * Navigate to URL
         * @param {string} url - URL to navigate to
         */
        async navigate(url) {
          self.checkPermission(pluginName, 'navigation', PERMISSION_LEVELS.WRITE);
          return self.safeCall(pluginName, 'navigation.navigate', async () => {
            return new Promise((resolve) => {
              if (self.mainWindow) {
                self.mainWindow.webContents.send('navigate-webview', url);
                setTimeout(() => resolve({ success: true, url }), 1000);
              } else {
                resolve({ success: false, error: 'Main window not available' });
              }
            });
          });
        },

        /**
         * Go back in history
         */
        async goBack() {
          self.checkPermission(pluginName, 'navigation', PERMISSION_LEVELS.WRITE);
          return self.safeCall(pluginName, 'navigation.goBack', async () => {
            if (self.managers.tab) {
              return self.managers.tab.goBack();
            }
            return { success: false, error: 'Tab manager not available' };
          });
        },

        /**
         * Go forward in history
         */
        async goForward() {
          self.checkPermission(pluginName, 'navigation', PERMISSION_LEVELS.WRITE);
          return self.safeCall(pluginName, 'navigation.goForward', async () => {
            if (self.managers.tab) {
              return self.managers.tab.goForward();
            }
            return { success: false, error: 'Tab manager not available' };
          });
        },

        /**
         * Reload current page
         */
        async reload() {
          self.checkPermission(pluginName, 'navigation', PERMISSION_LEVELS.WRITE);
          return self.safeCall(pluginName, 'navigation.reload', async () => {
            if (self.managers.tab) {
              const activeTab = self.managers.tab.getActiveTab();
              if (activeTab) {
                return self.managers.tab.reloadTab(activeTab.id);
              }
            }
            return { success: false, error: 'No active tab' };
          });
        }
      },

      // ==================== Tab API ====================
      tabs: {
        /**
         * Get all tabs
         */
        async list() {
          return self.safeCall(pluginName, 'tabs.list', async () => {
            if (self.managers.tab) {
              return self.managers.tab.listTabs();
            }
            return { success: false, error: 'Tab manager not available' };
          });
        },

        /**
         * Get active tab
         */
        async getActive() {
          return self.safeCall(pluginName, 'tabs.getActive', async () => {
            if (self.managers.tab) {
              const tab = self.managers.tab.getActiveTab();
              return { success: true, tab };
            }
            return { success: false, error: 'Tab manager not available' };
          });
        },

        /**
         * Create a new tab
         * @param {Object} options - Tab options
         */
        async create(options = {}) {
          self.checkPermission(pluginName, 'tabs', PERMISSION_LEVELS.WRITE);
          return self.safeCall(pluginName, 'tabs.create', async () => {
            if (self.managers.tab) {
              return self.managers.tab.createTab(options);
            }
            return { success: false, error: 'Tab manager not available' };
          });
        },

        /**
         * Close a tab
         * @param {string} tabId - Tab ID
         */
        async close(tabId) {
          self.checkPermission(pluginName, 'tabs', PERMISSION_LEVELS.WRITE);
          return self.safeCall(pluginName, 'tabs.close', async () => {
            if (self.managers.tab) {
              return self.managers.tab.closeTab(tabId);
            }
            return { success: false, error: 'Tab manager not available' };
          });
        },

        /**
         * Switch to a tab
         * @param {string} tabId - Tab ID
         */
        async switchTo(tabId) {
          self.checkPermission(pluginName, 'tabs', PERMISSION_LEVELS.WRITE);
          return self.safeCall(pluginName, 'tabs.switchTo', async () => {
            if (self.managers.tab) {
              return self.managers.tab.switchTab(tabId);
            }
            return { success: false, error: 'Tab manager not available' };
          });
        }
      },

      // ==================== Network API ====================
      network: {
        /**
         * Get network logs
         */
        async getLogs() {
          self.checkPermission(pluginName, 'network', PERMISSION_LEVELS.READ);
          return self.safeCall(pluginName, 'network.getLogs', async () => {
            if (self.managers.network) {
              return self.managers.network.getLogs();
            }
            return { success: false, error: 'Network manager not available' };
          });
        },

        /**
         * Set request header
         * @param {string} name - Header name
         * @param {string} value - Header value
         */
        async setRequestHeader(name, value) {
          self.checkPermission(pluginName, 'network', PERMISSION_LEVELS.WRITE);
          return self.safeCall(pluginName, 'network.setRequestHeader', async () => {
            if (self.managers.header) {
              return self.managers.header.setRequestHeader(name, value);
            }
            return { success: false, error: 'Header manager not available' };
          });
        },

        /**
         * Remove request header
         * @param {string} name - Header name
         */
        async removeRequestHeader(name) {
          self.checkPermission(pluginName, 'network', PERMISSION_LEVELS.WRITE);
          return self.safeCall(pluginName, 'network.removeRequestHeader', async () => {
            if (self.managers.header) {
              return self.managers.header.removeRequestHeader(name);
            }
            return { success: false, error: 'Header manager not available' };
          });
        },

        /**
         * Get current headers
         */
        async getHeaders() {
          self.checkPermission(pluginName, 'network', PERMISSION_LEVELS.READ);
          return self.safeCall(pluginName, 'network.getHeaders', async () => {
            if (self.managers.header) {
              return {
                success: true,
                request: self.managers.header.getRequestHeaders(),
                response: self.managers.header.getResponseHeaders()
              };
            }
            return { success: false, error: 'Header manager not available' };
          });
        }
      },

      // ==================== Content API ====================
      content: {
        /**
         * Get page content
         */
        async getContent() {
          return self.safeCall(pluginName, 'content.getContent', async () => {
            return new Promise((resolve) => {
              if (self.mainWindow) {
                self.mainWindow.webContents.send('get-page-content');
                const { ipcMain } = require('electron');
                ipcMain.once('page-content-response', (event, result) => {
                  resolve(result);
                });
              } else {
                resolve({ success: false, error: 'Main window not available' });
              }
            });
          });
        },

        /**
         * Execute script in page context
         * @param {string} script - JavaScript code to execute
         */
        async executeScript(script) {
          self.checkPermission(pluginName, 'content', PERMISSION_LEVELS.WRITE);
          return self.safeCall(pluginName, 'content.executeScript', async () => {
            return new Promise((resolve) => {
              if (self.mainWindow) {
                self.mainWindow.webContents.send('execute-in-webview', script);
                const { ipcMain } = require('electron');
                ipcMain.once('webview-execute-response', (event, result) => {
                  resolve(result);
                });
              } else {
                resolve({ success: false, error: 'Main window not available' });
              }
            });
          });
        },

        /**
         * Extract data from page
         * @param {string} type - Extraction type (metadata, links, forms, etc.)
         */
        async extract(type) {
          return self.safeCall(pluginName, 'content.extract', async () => {
            if (self.managers.extraction) {
              // Get page content first
              const contentResult = await this.getContent();
              if (!contentResult.success) {
                return contentResult;
              }

              const html = contentResult.html || contentResult.content;
              const url = contentResult.url || '';

              switch (type) {
                case 'metadata':
                  return { success: true, data: self.managers.extraction.extractMetadata(html, url) };
                case 'links':
                  return { success: true, data: self.managers.extraction.extractLinks(html, url) };
                case 'forms':
                  return { success: true, data: self.managers.extraction.extractForms(html) };
                case 'images':
                  return { success: true, data: self.managers.extraction.extractImages(html, url) };
                case 'all':
                  return { success: true, data: self.managers.extraction.extractAll(html, url) };
                default:
                  return { success: false, error: `Unknown extraction type: ${type}` };
              }
            }
            return { success: false, error: 'Extraction manager not available' };
          });
        }
      },

      // ==================== Storage API ====================
      storage: {
        /**
         * Get plugin-specific storage value
         * @param {string} key - Storage key
         */
        async get(key) {
          return self.safeCall(pluginName, 'storage.get', async () => {
            const context = self.contexts.get(pluginName);
            if (context) {
              const value = context.data.get(key);
              return { success: true, value };
            }
            return { success: false, error: 'Plugin context not found' };
          });
        },

        /**
         * Set plugin-specific storage value
         * @param {string} key - Storage key
         * @param {*} value - Value to store
         */
        async set(key, value) {
          return self.safeCall(pluginName, 'storage.set', async () => {
            const context = self.contexts.get(pluginName);
            if (context) {
              context.data.set(key, value);
              return { success: true };
            }
            return { success: false, error: 'Plugin context not found' };
          });
        },

        /**
         * Delete plugin-specific storage value
         * @param {string} key - Storage key
         */
        async delete(key) {
          return self.safeCall(pluginName, 'storage.delete', async () => {
            const context = self.contexts.get(pluginName);
            if (context) {
              context.data.delete(key);
              return { success: true };
            }
            return { success: false, error: 'Plugin context not found' };
          });
        },

        /**
         * Get all plugin storage keys
         */
        async keys() {
          return self.safeCall(pluginName, 'storage.keys', async () => {
            const context = self.contexts.get(pluginName);
            if (context) {
              return { success: true, keys: Array.from(context.data.keys()) };
            }
            return { success: false, error: 'Plugin context not found' };
          });
        },

        /**
         * Clear all plugin storage
         */
        async clear() {
          return self.safeCall(pluginName, 'storage.clear', async () => {
            const context = self.contexts.get(pluginName);
            if (context) {
              context.data.clear();
              return { success: true };
            }
            return { success: false, error: 'Plugin context not found' };
          });
        }
      },

      // ==================== Cookies API ====================
      cookies: {
        /**
         * Get cookies for URL
         * @param {string} url - URL to get cookies for
         */
        async get(url) {
          self.checkPermission(pluginName, 'cookies', PERMISSION_LEVELS.READ);
          return self.safeCall(pluginName, 'cookies.get', async () => {
            if (self.managers.cookie) {
              return self.managers.cookie.getCookies(url);
            }
            return { success: false, error: 'Cookie manager not available' };
          });
        },

        /**
         * Set a cookie
         * @param {Object} cookie - Cookie object
         */
        async set(cookie) {
          self.checkPermission(pluginName, 'cookies', PERMISSION_LEVELS.WRITE);
          return self.safeCall(pluginName, 'cookies.set', async () => {
            if (self.managers.cookie) {
              return self.managers.cookie.setCookie(cookie);
            }
            return { success: false, error: 'Cookie manager not available' };
          });
        },

        /**
         * Delete a cookie
         * @param {string} url - Cookie URL
         * @param {string} name - Cookie name
         */
        async delete(url, name) {
          self.checkPermission(pluginName, 'cookies', PERMISSION_LEVELS.WRITE);
          return self.safeCall(pluginName, 'cookies.delete', async () => {
            if (self.managers.cookie) {
              return self.managers.cookie.deleteCookie(url, name);
            }
            return { success: false, error: 'Cookie manager not available' };
          });
        }
      },

      // ==================== Events API ====================
      events: {
        /**
         * Register a hook callback
         * @param {string} hookName - Hook name
         * @param {Function} callback - Callback function
         */
        on(hookName, callback) {
          return self.registerHook(pluginName, hookName, callback);
        },

        /**
         * Unregister a hook callback
         * @param {string} hookName - Hook name
         * @param {Function} callback - Callback function
         */
        off(hookName, callback) {
          return self.unregisterHook(pluginName, hookName, callback);
        },

        /**
         * Emit an event (for inter-plugin communication)
         * @param {string} eventName - Event name
         * @param {*} data - Event data
         */
        emit(eventName, data) {
          self.emit(`plugin:${pluginName}:${eventName}`, data);
        }
      },

      // ==================== Commands API ====================
      commands: {
        /**
         * Register a command that can be called via WebSocket
         * @param {string} commandName - Command name
         * @param {Function} handler - Command handler
         */
        register(commandName, handler) {
          return self.registerCommand(pluginName, commandName, handler);
        },

        /**
         * Unregister a command
         * @param {string} commandName - Command name
         */
        unregister(commandName) {
          return self.unregisterCommand(pluginName, commandName);
        }
      },

      // ==================== Logging API ====================
      log: {
        info: (...args) => console.log(`[Plugin:${pluginName}]`, ...args),
        warn: (...args) => console.warn(`[Plugin:${pluginName}]`, ...args),
        error: (...args) => console.error(`[Plugin:${pluginName}]`, ...args),
        debug: (...args) => console.debug(`[Plugin:${pluginName}]`, ...args)
      }
    };
  }

  /**
   * Safe call wrapper with error handling
   * @param {string} pluginName - Plugin name
   * @param {string} methodName - Method name
   * @param {Function} fn - Function to call
   * @returns {Promise<*>} Result
   */
  async safeCall(pluginName, methodName, fn) {
    try {
      return await fn();
    } catch (error) {
      console.error(`[PluginAPI] Error in ${pluginName}.${methodName}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if plugin has required permission
   * @param {string} pluginName - Plugin name
   * @param {string} category - Permission category
   * @param {number} level - Required permission level
   * @throws {Error} If permission denied
   */
  checkPermission(pluginName, category, level) {
    const context = this.contexts.get(pluginName);
    if (!context) {
      throw new Error('Plugin context not found');
    }

    const pluginLevel = context.permissions[category] || PERMISSION_LEVELS.NONE;
    if (pluginLevel < level) {
      throw new Error(`Permission denied: ${category} requires level ${level}, plugin has ${pluginLevel}`);
    }
  }

  /**
   * Register a hook callback
   * @param {string} pluginName - Plugin name
   * @param {string} hookName - Hook name
   * @param {Function} callback - Callback function
   * @returns {Object} Registration result
   */
  registerHook(pluginName, hookName, callback) {
    if (!this.hooks[hookName]) {
      return { success: false, error: `Unknown hook: ${hookName}` };
    }

    if (typeof callback !== 'function') {
      return { success: false, error: 'Callback must be a function' };
    }

    this.hooks[hookName].push({
      pluginName,
      callback
    });

    console.log(`[PluginAPI] Hook registered: ${hookName} for ${pluginName}`);

    return { success: true };
  }

  /**
   * Unregister a hook callback
   * @param {string} pluginName - Plugin name
   * @param {string} hookName - Hook name
   * @param {Function} callback - Callback function
   * @returns {Object} Unregistration result
   */
  unregisterHook(pluginName, hookName, callback) {
    if (!this.hooks[hookName]) {
      return { success: false, error: `Unknown hook: ${hookName}` };
    }

    const index = this.hooks[hookName].findIndex(
      h => h.pluginName === pluginName && h.callback === callback
    );

    if (index >= 0) {
      this.hooks[hookName].splice(index, 1);
      return { success: true };
    }

    return { success: false, error: 'Hook not found' };
  }

  /**
   * Trigger a hook
   * @param {string} hookName - Hook name
   * @param {*} data - Hook data
   * @returns {Promise<Array>} Results from all hook handlers
   */
  async triggerHook(hookName, data) {
    if (!this.hooks[hookName]) {
      return [];
    }

    const results = [];

    for (const hook of this.hooks[hookName]) {
      try {
        const result = await hook.callback(data);
        results.push({ pluginName: hook.pluginName, result });
      } catch (error) {
        console.error(`[PluginAPI] Hook error in ${hook.pluginName}:`, error.message);
        results.push({ pluginName: hook.pluginName, error: error.message });
      }
    }

    return results;
  }

  /**
   * Register a command
   * @param {string} pluginName - Plugin name
   * @param {string} commandName - Command name
   * @param {Function} handler - Command handler
   * @returns {Object} Registration result
   */
  registerCommand(pluginName, commandName, handler) {
    const fullName = `plugin:${pluginName}:${commandName}`;

    if (this.commands.has(fullName)) {
      return { success: false, error: `Command already registered: ${fullName}` };
    }

    this.commands.set(fullName, {
      pluginName,
      commandName,
      handler
    });

    console.log(`[PluginAPI] Command registered: ${fullName}`);

    return { success: true, command: fullName };
  }

  /**
   * Unregister a command
   * @param {string} pluginName - Plugin name
   * @param {string} commandName - Command name
   * @returns {Object} Unregistration result
   */
  unregisterCommand(pluginName, commandName) {
    const fullName = `plugin:${pluginName}:${commandName}`;

    if (!this.commands.has(fullName)) {
      return { success: false, error: `Command not found: ${fullName}` };
    }

    this.commands.delete(fullName);
    return { success: true };
  }

  /**
   * Execute a plugin command
   * @param {string} commandName - Full command name
   * @param {Object} params - Command parameters
   * @returns {Promise<Object>} Command result
   */
  async executeCommand(commandName, params = {}) {
    const command = this.commands.get(commandName);

    if (!command) {
      return { success: false, error: `Command not found: ${commandName}` };
    }

    try {
      const result = await command.handler(params);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List all registered commands
   * @returns {Object} List of commands
   */
  listCommands() {
    const commands = [];

    for (const [name, cmd] of this.commands) {
      commands.push({
        name,
        pluginName: cmd.pluginName,
        commandName: cmd.commandName
      });
    }

    return { success: true, commands };
  }

  /**
   * Get available hooks
   * @returns {Object} Available hooks
   */
  getAvailableHooks() {
    return {
      success: true,
      hooks: Object.keys(this.hooks)
    };
  }

  /**
   * Remove all hooks for a plugin
   * @param {string} pluginName - Plugin name
   */
  removePluginHooks(pluginName) {
    for (const hookName of Object.keys(this.hooks)) {
      this.hooks[hookName] = this.hooks[hookName].filter(
        h => h.pluginName !== pluginName
      );
    }
  }

  /**
   * Remove all commands for a plugin
   * @param {string} pluginName - Plugin name
   */
  removePluginCommands(pluginName) {
    for (const [name, cmd] of this.commands) {
      if (cmd.pluginName === pluginName) {
        this.commands.delete(name);
      }
    }
  }

  /**
   * Cleanup a plugin's resources
   * @param {string} pluginName - Plugin name
   */
  cleanupPlugin(pluginName) {
    this.removePluginHooks(pluginName);
    this.removePluginCommands(pluginName);
    this.contexts.delete(pluginName);
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    this.hooks = Object.fromEntries(
      Object.keys(this.hooks).map(k => [k, []])
    );
    this.commands.clear();
    this.contexts.clear();
    console.log('[PluginAPI] Cleanup complete');
  }
}

module.exports = {
  PluginAPI,
  PERMISSION_LEVELS,
  API_CATEGORIES
};
