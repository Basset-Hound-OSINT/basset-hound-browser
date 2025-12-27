const { contextBridge, ipcRenderer } = require('electron');

// Secure IPC bridge - only expose specific methods
contextBridge.exposeInMainWorld('electronAPI', {
  // Navigation
  navigate: (url) => ipcRenderer.invoke('navigate', url),
  getWebviewUrl: () => ipcRenderer.invoke('get-webview-url'),

  // Script execution
  executeInWebview: (script) => ipcRenderer.invoke('execute-in-webview', script),

  // Page content
  getPageContent: () => ipcRenderer.invoke('get-page-content'),
  getPageState: () => ipcRenderer.invoke('get-page-state'),

  // Screenshot (basic)
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),

  // Enhanced Screenshots
  screenshotFullPage: (options) => ipcRenderer.invoke('screenshot-full-page', options),
  screenshotElement: (options) => ipcRenderer.invoke('screenshot-element', options),
  screenshotArea: (options) => ipcRenderer.invoke('screenshot-area', options),
  screenshotViewport: (options) => ipcRenderer.invoke('screenshot-viewport', options),
  annotateScreenshot: (options) => ipcRenderer.invoke('annotate-screenshot', options),

  // Screen Recording
  startRecording: (options) => ipcRenderer.invoke('start-recording', options),
  stopRecording: (options) => ipcRenderer.invoke('stop-recording', options),
  pauseRecording: () => ipcRenderer.invoke('pause-recording'),
  resumeRecording: () => ipcRenderer.invoke('resume-recording'),

  // DOM manipulation
  clickElement: (selector) => ipcRenderer.invoke('click-element', selector),
  fillField: (selector, value) => ipcRenderer.invoke('fill-field', { selector, value }),
  waitForElement: (selector, timeout) => ipcRenderer.invoke('wait-for-element', { selector, timeout }),
  scroll: (x, y, selector) => ipcRenderer.invoke('scroll', { x, y, selector }),

  // ==========================================
  // Cookie Management
  // ==========================================
  getCookies: (url) => ipcRenderer.invoke('get-cookies', url),
  getAllCookies: (filter) => ipcRenderer.invoke('get-all-cookies', filter),
  setCookie: (cookie) => ipcRenderer.invoke('set-cookie', cookie),
  setCookies: (cookies) => ipcRenderer.invoke('set-cookies', cookies),
  deleteCookie: (url, name) => ipcRenderer.invoke('delete-cookie', { url, name }),
  clearCookies: (domain) => ipcRenderer.invoke('clear-cookies', domain),
  exportCookies: (format, filter) => ipcRenderer.invoke('export-cookies', { format, filter }),
  importCookies: (data, format) => ipcRenderer.invoke('import-cookies', { data, format }),
  exportCookiesFile: (filepath, format, filter) => ipcRenderer.invoke('export-cookies-file', { filepath, format, filter }),
  importCookiesFile: (filepath, format) => ipcRenderer.invoke('import-cookies-file', { filepath, format }),
  getCookiesDomain: (domain) => ipcRenderer.invoke('get-cookies-domain', domain),
  getCookieStats: () => ipcRenderer.invoke('get-cookie-stats'),
  getCookieFormats: () => ipcRenderer.invoke('get-cookie-formats'),
  flushCookies: () => ipcRenderer.invoke('flush-cookies'),

  // Evasion
  getEvasionScript: () => ipcRenderer.invoke('get-evasion-script'),

  // WebSocket status
  getWsStatus: () => ipcRenderer.invoke('get-ws-status'),

  // ==========================================
  // Session Management
  // ==========================================
  createSession: (options) => ipcRenderer.invoke('create-session', options),
  switchSession: (sessionId) => ipcRenderer.invoke('switch-session', sessionId),
  deleteSession: (sessionId) => ipcRenderer.invoke('delete-session', sessionId),
  listSessions: () => ipcRenderer.invoke('list-sessions'),
  exportSession: (sessionId) => ipcRenderer.invoke('export-session', sessionId),
  importSession: (data) => ipcRenderer.invoke('import-session', data),
  getSessionInfo: (sessionId) => ipcRenderer.invoke('get-session-info', sessionId),
  clearSessionData: (sessionId) => ipcRenderer.invoke('clear-session-data', sessionId),

  // ==========================================
  // History Management
  // ==========================================
  getHistory: (options) => ipcRenderer.invoke('get-history', options),
  searchHistory: (query, limit) => ipcRenderer.invoke('search-history', { query, limit }),
  getHistoryEntry: (id) => ipcRenderer.invoke('get-history-entry', id),
  deleteHistoryEntry: (id) => ipcRenderer.invoke('delete-history-entry', id),
  deleteHistoryRange: (startTime, endTime) => ipcRenderer.invoke('delete-history-range', { startTime, endTime }),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getVisitCount: (url) => ipcRenderer.invoke('get-visit-count', url),
  getMostVisited: (limit) => ipcRenderer.invoke('get-most-visited', limit),
  exportHistory: (format) => ipcRenderer.invoke('export-history', format),
  importHistory: (data, options) => ipcRenderer.invoke('import-history', { data, options }),
  getHistoryStats: () => ipcRenderer.invoke('get-history-stats'),
  addToHistory: (entry) => ipcRenderer.send('add-to-history', entry),
  notifyPageLoadComplete: (details) => ipcRenderer.send('page-load-complete', details),

  // History event listeners
  onHistoryEntryAdded: (callback) => ipcRenderer.on('history-entry-added', (event, entry) => callback(entry)),
  onHistoryCleared: (callback) => ipcRenderer.on('history-cleared', () => callback()),

  // ==========================================
  // Download Management
  // ==========================================
  startDownload: ({ url, options }) => ipcRenderer.invoke('start-download', { url, options }),
  pauseDownload: (downloadId) => ipcRenderer.invoke('pause-download', downloadId),
  resumeDownload: (downloadId) => ipcRenderer.invoke('resume-download', downloadId),
  cancelDownload: (downloadId) => ipcRenderer.invoke('cancel-download', downloadId),
  getDownload: (downloadId) => ipcRenderer.invoke('get-download', downloadId),
  getActiveDownloads: () => ipcRenderer.invoke('get-active-downloads'),
  getCompletedDownloads: () => ipcRenderer.invoke('get-completed-downloads'),
  getDownloads: (options) => ipcRenderer.invoke('get-downloads', options),
  clearCompletedDownloads: () => ipcRenderer.invoke('clear-completed-downloads'),
  setDownloadPath: (downloadPath) => ipcRenderer.invoke('set-download-path', downloadPath),
  getDownloadPath: () => ipcRenderer.invoke('get-download-path'),
  getDownloadStatus: () => ipcRenderer.invoke('get-download-status'),

  // Download event listeners
  onDownloadStarted: (callback) => ipcRenderer.on('download-started', (event, download) => callback(download)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, download) => callback(download)),
  onDownloadCompleted: (callback) => ipcRenderer.on('download-completed', (event, download) => callback(download)),
  onDownloadFailed: (callback) => ipcRenderer.on('download-failed', (event, download) => callback(download)),
  onDownloadCancelled: (callback) => ipcRenderer.on('download-cancelled', (event, download) => callback(download)),

  // ==========================================
  // Tab Management
  // ==========================================
  // Core tab operations
  newTab: (options) => ipcRenderer.invoke('new-tab', options),
  createTab: (options) => ipcRenderer.invoke('new-tab', options), // Alias for newTab
  closeTab: (tabId) => ipcRenderer.invoke('close-tab', tabId),
  switchTab: (tabId) => ipcRenderer.invoke('switch-tab', tabId),

  // Tab queries
  listTabs: (options) => ipcRenderer.invoke('list-tabs', options),
  getTabs: (options) => ipcRenderer.invoke('list-tabs', options), // Alias for listTabs
  getAllTabs: (options) => ipcRenderer.invoke('list-tabs', options), // Alias for listTabs
  getTab: (tabId) => ipcRenderer.invoke('get-tab-info', tabId), // Alias for getTabInfo
  getTabInfo: (tabId) => ipcRenderer.invoke('get-tab-info', tabId),
  getActiveTab: () => ipcRenderer.invoke('get-active-tab'),

  // Tab navigation
  navigateTab: (tabId, url) => ipcRenderer.invoke('navigate-tab', { tabId, url }),
  tabNavigate: (tabId, url) => ipcRenderer.invoke('navigate-tab', { tabId, url }), // Alias
  reloadTab: (tabId) => ipcRenderer.invoke('reload-tab', tabId),
  tabBack: (tabId) => ipcRenderer.invoke('tab-back', tabId),
  tabForward: (tabId) => ipcRenderer.invoke('tab-forward', tabId),

  // Tab management
  duplicateTab: (tabId) => ipcRenderer.invoke('duplicate-tab', tabId),
  pinTab: (tabId, pinned) => ipcRenderer.invoke('pin-tab', { tabId, pinned }),
  muteTab: (tabId, muted) => ipcRenderer.invoke('mute-tab', { tabId, muted }),
  setTabZoom: (tabId, zoomLevel) => ipcRenderer.invoke('set-tab-zoom', { tabId, zoomLevel }),
  moveTab: (tabId, newIndex) => ipcRenderer.invoke('move-tab', { tabId, newIndex }),

  // Tab switching
  nextTab: () => ipcRenderer.invoke('next-tab'),
  previousTab: () => ipcRenderer.invoke('previous-tab'),

  // Tab updates
  updateTab: (tabId, updates) => ipcRenderer.send('update-tab', { tabId, updates }),

  // Event listeners for IPC from main process
  onNavigateWebview: (callback) => ipcRenderer.on('navigate-webview', (event, url) => callback(url)),
  onGetWebviewUrl: (callback) => ipcRenderer.on('get-webview-url', () => callback()),
  onExecuteInWebview: (callback) => ipcRenderer.on('execute-in-webview', (event, script) => callback(script)),
  onGetPageContent: (callback) => ipcRenderer.on('get-page-content', () => callback()),
  onCaptureScreenshot: (callback) => ipcRenderer.on('capture-screenshot', () => callback()),

  // Enhanced screenshot listeners
  onScreenshotFullPage: (callback) => ipcRenderer.on('screenshot-full-page', (event, data) => callback(data)),
  onScreenshotElement: (callback) => ipcRenderer.on('screenshot-element', (event, data) => callback(data)),
  onScreenshotArea: (callback) => ipcRenderer.on('screenshot-area', (event, data) => callback(data)),
  onScreenshotViewport: (callback) => ipcRenderer.on('screenshot-viewport', (event, data) => callback(data)),
  onAnnotateScreenshot: (callback) => ipcRenderer.on('annotate-screenshot', (event, data) => callback(data)),

  // Recording listeners
  onStartRecording: (callback) => ipcRenderer.on('start-recording', (event, data) => callback(data)),
  onStopRecording: (callback) => ipcRenderer.on('stop-recording', (event, data) => callback(data)),
  onPauseRecording: (callback) => ipcRenderer.on('pause-recording', (event, data) => callback(data)),
  onResumeRecording: (callback) => ipcRenderer.on('resume-recording', (event, data) => callback(data)),
  onClickElement: (callback) => ipcRenderer.on('click-element', (event, selector) => callback(selector)),
  onFillField: (callback) => ipcRenderer.on('fill-field', (event, data) => callback(data)),
  onGetPageState: (callback) => ipcRenderer.on('get-page-state', () => callback()),
  onWaitForElement: (callback) => ipcRenderer.on('wait-for-element', (event, data) => callback(data)),
  onScroll: (callback) => ipcRenderer.on('scroll', (event, data) => callback(data)),

  // Send responses back to main process
  sendWebviewUrlResponse: (url) => ipcRenderer.send('webview-url-response', url),
  sendExecuteResponse: (result) => ipcRenderer.send('webview-execute-response', result),
  sendPageContentResponse: (content) => ipcRenderer.send('page-content-response', content),
  sendScreenshotResponse: (data) => ipcRenderer.send('screenshot-response', data),

  // Enhanced screenshot responses
  sendScreenshotFullPageResponse: (data) => ipcRenderer.send('screenshot-full-page-response', data),
  sendScreenshotElementResponse: (data) => ipcRenderer.send('screenshot-element-response', data),
  sendScreenshotAreaResponse: (data) => ipcRenderer.send('screenshot-area-response', data),
  sendScreenshotViewportResponse: (data) => ipcRenderer.send('screenshot-viewport-response', data),
  sendAnnotateScreenshotResponse: (data) => ipcRenderer.send('annotate-screenshot-response', data),

  // Recording responses
  sendRecordingStarted: (data) => ipcRenderer.send('recording-started', data),
  sendRecordingStopped: (data) => ipcRenderer.send('recording-stopped', data),
  sendRecordingPaused: (data) => ipcRenderer.send('recording-paused', data),
  sendRecordingResumed: (data) => ipcRenderer.send('recording-resumed', data),
  sendRecordingError: (data) => ipcRenderer.send('recording-error', data),
  sendRecordingChunk: (data) => ipcRenderer.send('recording-chunk', data),
  sendClickResponse: (result) => ipcRenderer.send('click-response', result),
  sendFillResponse: (result) => ipcRenderer.send('fill-response', result),
  sendPageStateResponse: (state) => ipcRenderer.send('page-state-response', state),
  sendWaitResponse: (result) => ipcRenderer.send('wait-response', result),
  sendScrollResponse: (result) => ipcRenderer.send('scroll-response', result),

  // ==========================================
  // Session Event Listeners
  // ==========================================
  onSessionChanged: (callback) => ipcRenderer.on('session-changed', (event, data) => callback(data)),

  // ==========================================
  // Tab Event Listeners
  // ==========================================
  onTabCreated: (callback) => ipcRenderer.on('tab-created', (event, tab) => callback(tab)),
  onTabClosed: (callback) => ipcRenderer.on('tab-closed', (event, data) => callback(data)),
  onTabSwitched: (callback) => ipcRenderer.on('tab-switched', (event, data) => callback(data)),
  onTabUpdated: (callback) => ipcRenderer.on('tab-updated', (event, data) => callback(data)),
  onTabNavigate: (callback) => ipcRenderer.on('tab-navigate', (event, data) => callback(data)),
  onTabReload: (callback) => ipcRenderer.on('tab-reload', (event, data) => callback(data)),
  onTabMute: (callback) => ipcRenderer.on('tab-mute', (event, data) => callback(data)),
  onTabZoom: (callback) => ipcRenderer.on('tab-zoom', (event, data) => callback(data)),
  onTabsClosedOther: (callback) => ipcRenderer.on('tabs-closed-other', (event, data) => callback(data)),

  // ==========================================
  // Download Event Listeners
  // ==========================================
  onDownloadFile: (callback) => ipcRenderer.on('download-file', (event, data) => callback(data)),

  // ==========================================
  // Network Throttling
  // ==========================================
  // Set custom throttling speeds (bytes/second)
  setNetworkThrottling: (download, upload, latency) => ipcRenderer.invoke('set-network-throttling', { download, upload, latency }),

  // Set throttling using a preset profile
  setNetworkPreset: (presetName) => ipcRenderer.invoke('set-network-preset', presetName),

  // Get available network presets
  getNetworkPresets: () => ipcRenderer.invoke('get-network-presets'),

  // Enable network throttling
  enableNetworkThrottling: () => ipcRenderer.invoke('enable-network-throttling'),

  // Disable network throttling
  disableNetworkThrottling: () => ipcRenderer.invoke('disable-network-throttling'),

  // Get current throttling status
  getNetworkThrottlingStatus: () => ipcRenderer.invoke('get-network-throttling-status'),

  // ==========================================
  // Content Blocking
  // ==========================================

  // Enable content blocking
  enableBlocking: () => ipcRenderer.invoke('enable-blocking'),

  // Disable content blocking
  disableBlocking: () => ipcRenderer.invoke('disable-blocking'),

  // Add custom block rule
  addBlockRule: (pattern, options) => ipcRenderer.invoke('add-block-rule', { pattern, options }),

  // Remove block rule
  removeBlockRule: (pattern) => ipcRenderer.invoke('remove-block-rule', pattern),

  // Get all block rules
  getBlockRules: () => ipcRenderer.invoke('get-block-rules'),

  // Load filter list from URL (supports EasyList format)
  loadFilterList: (url) => ipcRenderer.invoke('load-filter-list', url),

  // Load local filter list file
  loadLocalFilterList: (path) => ipcRenderer.invoke('load-local-filter-list', path),

  // Get blocking statistics
  getBlockingStats: () => ipcRenderer.invoke('get-blocking-stats'),

  // Clear blocking statistics
  clearBlockingStats: () => ipcRenderer.invoke('clear-blocking-stats'),

  // Whitelist a domain (bypass blocking)
  whitelistDomain: (domain) => ipcRenderer.invoke('whitelist-domain', domain),

  // Remove domain from whitelist
  removeWhitelist: (domain) => ipcRenderer.invoke('remove-whitelist', domain),

  // Get whitelisted domains
  getWhitelist: () => ipcRenderer.invoke('get-whitelist'),

  // Enable/disable blocking category
  setBlockingCategory: (category, enabled) => ipcRenderer.invoke('set-blocking-category', { category, enabled }),

  // Get available blocking categories
  getBlockingCategories: () => ipcRenderer.invoke('get-blocking-categories'),

  // Get known filter list URLs (EasyList, etc.)
  getKnownFilterLists: () => ipcRenderer.invoke('get-known-filter-lists'),

  // ==========================================
  // Geolocation Spoofing
  // ==========================================

  // Set custom geolocation coordinates
  setGeolocation: (latitude, longitude, options) => ipcRenderer.invoke('set-geolocation', { latitude, longitude, options }),

  // Set geolocation by city name
  setGeolocationCity: (cityName) => ipcRenderer.invoke('set-geolocation-city', cityName),

  // Get current geolocation settings
  getGeolocation: () => ipcRenderer.invoke('get-geolocation'),

  // Enable geolocation spoofing
  enableGeolocationSpoofing: () => ipcRenderer.invoke('enable-geolocation-spoofing'),

  // Disable geolocation spoofing
  disableGeolocationSpoofing: () => ipcRenderer.invoke('disable-geolocation-spoofing'),

  // Get geolocation spoofing status
  getGeolocationStatus: () => ipcRenderer.invoke('get-geolocation-status'),

  // Get preset locations (cities)
  getPresetLocations: (filter) => ipcRenderer.invoke('get-preset-locations', filter),

  // Get geolocation spoof script
  getGeolocationScript: () => ipcRenderer.invoke('get-geolocation-script'),

  // Reset geolocation to default
  resetGeolocation: () => ipcRenderer.invoke('reset-geolocation'),

  // Event listener for geolocation script injection
  onInjectGeolocationScript: (callback) => ipcRenderer.on('inject-geolocation-script', (event, script) => callback(script)),

  // ==========================================
  // DOM Inspector
  // ==========================================

  // Inspect element - get detailed element information
  inspectElement: (selector) => ipcRenderer.invoke('inspect-element', selector),

  // Get element tree - get DOM subtree
  getElementTree: (selector, depth) => ipcRenderer.invoke('get-element-tree', { selector, depth }),

  // Get element styles - computed and inline styles
  getElementStyles: (selector) => ipcRenderer.invoke('get-element-styles', selector),

  // Get element attributes - all attributes
  getElementAttributes: (selector) => ipcRenderer.invoke('get-element-attributes', selector),

  // Generate CSS selector for element
  generateSelector: (selector) => ipcRenderer.invoke('generate-selector', selector),

  // Highlight element visually
  highlightElement: (selector, color) => ipcRenderer.invoke('highlight-element', { selector, color }),

  // Remove all highlights
  removeHighlight: () => ipcRenderer.invoke('remove-highlight'),

  // Find elements by various criteria
  findElements: (query) => ipcRenderer.invoke('find-elements', query),

  // Get element parent
  getElementParent: (selector) => ipcRenderer.invoke('get-element-parent', selector),

  // Get element children
  getElementChildren: (selector) => ipcRenderer.invoke('get-element-children', selector),

  // Get element siblings
  getElementSiblings: (selector) => ipcRenderer.invoke('get-element-siblings', selector),

  // Highlight multiple elements
  highlightMultiple: (selectors) => ipcRenderer.invoke('highlight-multiple', selectors),

  // Get interactive elements (forms, buttons, links)
  getInteractiveElements: (selector) => ipcRenderer.invoke('get-interactive-elements', selector),

  // Get form data
  getFormData: (selector) => ipcRenderer.invoke('get-form-data', selector),

  // Set highlight style
  setHighlightStyle: (options) => ipcRenderer.invoke('set-highlight-style', options),

  // ==========================================
  // Header Management
  // ==========================================

  // Request Headers
  setRequestHeader: (name, value) => ipcRenderer.invoke('set-request-header', { name, value }),
  removeRequestHeader: (name) => ipcRenderer.invoke('remove-request-header', { name }),
  getRequestHeaders: () => ipcRenderer.invoke('get-request-headers'),
  clearRequestHeaders: () => ipcRenderer.invoke('clear-headers', { type: 'request' }),

  // Response Headers
  setResponseHeader: (name, value) => ipcRenderer.invoke('set-response-header', { name, value }),
  removeResponseHeader: (name) => ipcRenderer.invoke('remove-response-header', { name }),
  getResponseHeaders: () => ipcRenderer.invoke('get-response-headers'),
  clearResponseHeaders: () => ipcRenderer.invoke('clear-headers', { type: 'response' }),

  // All Headers
  getCustomHeaders: () => ipcRenderer.invoke('get-custom-headers'),
  clearAllHeaders: () => ipcRenderer.invoke('clear-headers', {}),

  // Header Profiles
  createHeaderProfile: (name, headers) => ipcRenderer.invoke('create-header-profile', { name, headers }),
  loadHeaderProfile: (name) => ipcRenderer.invoke('load-header-profile', { name }),
  listHeaderProfiles: () => ipcRenderer.invoke('list-header-profiles'),
  deleteHeaderProfile: (name) => ipcRenderer.invoke('delete-header-profile', { name }),
  getPredefinedHeaderProfiles: () => ipcRenderer.invoke('get-predefined-header-profiles'),

  // Conditional Headers (URL-based rules)
  setConditionalHeader: (pattern, name, value, type) => ipcRenderer.invoke('set-conditional-header', { pattern, name, value, type }),
  getConditionalHeaders: () => ipcRenderer.invoke('get-conditional-headers'),
  removeConditionalHeader: (ruleId) => ipcRenderer.invoke('remove-conditional-header', { ruleId }),
  clearConditionalHeaders: () => ipcRenderer.invoke('clear-conditional-headers'),

  // Header Manager Status
  getHeaderStatus: () => ipcRenderer.invoke('get-header-status'),
  enableHeaderManager: () => ipcRenderer.invoke('enable-header-manager'),
  disableHeaderManager: () => ipcRenderer.invoke('disable-header-manager'),
  resetHeaderStats: () => ipcRenderer.invoke('reset-header-stats'),

  // Header Configuration Import/Export
  exportHeaderConfig: () => ipcRenderer.invoke('export-header-config'),
  importHeaderConfig: (config, merge) => ipcRenderer.invoke('import-header-config', { config, merge }),

  // ==========================================
  // Profile/Identity Management
  // ==========================================

  // Create a new browser profile
  createProfile: (options) => ipcRenderer.invoke('create-profile', options),

  // Delete a browser profile
  deleteProfile: (profileId) => ipcRenderer.invoke('delete-profile', profileId),

  // Get profile details
  getProfile: (profileId) => ipcRenderer.invoke('get-profile', profileId),

  // List all browser profiles
  listProfiles: () => ipcRenderer.invoke('list-profiles'),

  // Switch to a different browser profile
  switchProfile: (profileId) => ipcRenderer.invoke('switch-profile', profileId),

  // Update a browser profile
  updateProfile: (profileId, updates) => ipcRenderer.invoke('update-profile', { profileId, updates }),

  // Export a browser profile to JSON
  exportProfile: (profileId) => ipcRenderer.invoke('export-profile', profileId),

  // Import a browser profile from JSON
  importProfile: (data) => ipcRenderer.invoke('import-profile', data),

  // Randomize a profile's fingerprint
  randomizeProfileFingerprint: (profileId) => ipcRenderer.invoke('randomize-profile-fingerprint', profileId),

  // Get the active browser profile
  getActiveProfile: () => ipcRenderer.invoke('get-active-profile'),

  // Get the fingerprint evasion script for a profile
  getProfileEvasionScript: (profileId) => ipcRenderer.invoke('get-profile-evasion-script', profileId),

  // Get the active profile partition
  getActiveProfilePartition: () => ipcRenderer.invoke('get-active-profile-partition'),

  // Profile event listeners
  onProfileChanged: (callback) => ipcRenderer.on('profile-changed', (event, data) => callback(data)),

  // ==========================================
  // Storage Management
  // ==========================================

  // LocalStorage operations
  getLocalStorage: (origin) => ipcRenderer.invoke('get-local-storage', origin),
  setLocalStorageItem: (origin, key, value) => ipcRenderer.invoke('set-local-storage-item', { origin, key, value }),
  removeLocalStorageItem: (origin, key) => ipcRenderer.invoke('remove-local-storage-item', { origin, key }),
  clearLocalStorage: (origin) => ipcRenderer.invoke('clear-local-storage', origin),

  // SessionStorage operations
  getSessionStorage: (origin) => ipcRenderer.invoke('get-session-storage', origin),
  setSessionStorageItem: (origin, key, value) => ipcRenderer.invoke('set-session-storage-item', { origin, key, value }),
  removeSessionStorageItem: (origin, key) => ipcRenderer.invoke('remove-session-storage-item', { origin, key }),
  clearSessionStorage: (origin) => ipcRenderer.invoke('clear-session-storage', origin),

  // IndexedDB operations
  getIndexedDBDatabases: (origin) => ipcRenderer.invoke('get-indexeddb-databases', origin),
  deleteIndexedDBDatabase: (origin, name) => ipcRenderer.invoke('delete-indexeddb-database', { origin, name }),

  // Storage export/import
  exportStorage: (origin, types) => ipcRenderer.invoke('export-storage', { origin, types }),
  importStorage: (origin, data) => ipcRenderer.invoke('import-storage', { origin, data }),
  exportStorageToFile: (filepath, origin, types) => ipcRenderer.invoke('export-storage-to-file', { filepath, origin, types }),
  importStorageFromFile: (filepath, origin) => ipcRenderer.invoke('import-storage-from-file', { filepath, origin }),

  // Storage statistics and utilities
  getStorageStats: (origin) => ipcRenderer.invoke('get-storage-stats', origin),
  clearAllStorage: (origin, types) => ipcRenderer.invoke('clear-all-storage', { origin, types }),

  // Storage operation responses from webview
  sendStorageOperationResponse: (operationId, result, error) => ipcRenderer.send('storage-operation-response', { operationId, result, error }),

  // Listen for storage operations to execute in webview
  onExecuteStorageOperation: (callback) => ipcRenderer.on('execute-storage-operation', (event, data) => callback(data)),

  // ==========================================
  // DevTools Management
  // ==========================================

  // Open DevTools window
  openDevTools: (options) => ipcRenderer.invoke('open-devtools', options),

  // Close DevTools window
  closeDevTools: () => ipcRenderer.invoke('close-devtools'),

  // Toggle DevTools window
  toggleDevTools: (options) => ipcRenderer.invoke('toggle-devtools', options),

  // Check if DevTools is open
  isDevToolsOpen: () => ipcRenderer.invoke('is-devtools-open'),

  // Get network logs (supports HAR format)
  getNetworkLogs: (options) => ipcRenderer.invoke('get-network-logs', options),

  // Clear network logs
  clearNetworkLogs: () => ipcRenderer.invoke('clear-network-logs'),

  // Get performance metrics
  getPerformanceMetrics: () => ipcRenderer.invoke('get-performance-metrics'),

  // Get code coverage
  getCoverage: () => ipcRenderer.invoke('get-coverage'),

  // Get network stats
  getNetworkStats: () => ipcRenderer.invoke('get-network-stats'),

  // Start network logging
  startNetworkLogging: () => ipcRenderer.invoke('start-network-logging'),

  // Stop network logging
  stopNetworkLogging: () => ipcRenderer.invoke('stop-network-logging'),

  // Export network logs (HAR or JSON)
  exportNetworkLogs: (format) => ipcRenderer.invoke('export-network-logs', format),

  // Get DevTools status
  getDevToolsStatus: () => ipcRenderer.invoke('get-devtools-status'),

  // ==========================================
  // Console Management
  // ==========================================

  // Get console logs
  getConsoleLogs: (options) => ipcRenderer.invoke('get-console-logs', options),

  // Clear console logs
  clearConsoleLogs: () => ipcRenderer.invoke('clear-console-logs'),

  // Execute code in console context
  executeInConsole: (code, options) => ipcRenderer.invoke('execute-in-console', { code, options }),

  // Get console errors only
  getConsoleErrors: () => ipcRenderer.invoke('get-console-errors'),

  // Get console warnings only
  getConsoleWarnings: () => ipcRenderer.invoke('get-console-warnings'),

  // Export console logs
  exportConsoleLogs: () => ipcRenderer.invoke('export-console-logs'),

  // Get console status
  getConsoleStatus: () => ipcRenderer.invoke('get-console-status'),

  // Start console capture
  startConsoleCapture: () => ipcRenderer.invoke('start-console-capture'),

  // Stop console capture
  stopConsoleCapture: () => ipcRenderer.invoke('stop-console-capture'),

  // Set max console logs
  setMaxConsoleLogs: (max) => ipcRenderer.invoke('set-max-console-logs', max),

  // Send console message (from webview)
  sendConsoleMessage: (message) => ipcRenderer.send('console-message', message),

  // Send console execute result (from webview)
  sendConsoleExecuteResult: (result) => ipcRenderer.send(`console-execute-result-${result.executionId}`, result),

  // Listen for console capture injection request
  onInjectConsoleCapture: (callback) => ipcRenderer.on('inject-console-capture', () => callback()),

  // Listen for console execute request
  onExecuteInConsole: (callback) => ipcRenderer.on('execute-in-console', (event, data) => callback(data)),

  // Listen for DevTools open request
  onOpenDevTools: (callback) => ipcRenderer.on('open-devtools', (event, data) => callback(data)),

  // Listen for DevTools close request
  onCloseDevTools: (callback) => ipcRenderer.on('close-devtools', () => callback()),

  // Listen for performance metrics request
  onGetPerformanceMetrics: (callback) => ipcRenderer.on('get-performance-metrics', () => callback()),

  // Send performance metrics response
  sendPerformanceMetricsResponse: (metrics) => ipcRenderer.send('performance-metrics-response', metrics),

  // Listen for coverage data request
  onGetCoverageData: (callback) => ipcRenderer.on('get-coverage-data', () => callback()),

  // Send coverage data response
  sendCoverageDataResponse: (data) => ipcRenderer.send('coverage-data-response', data),

  // ==========================================
  // Automation Scripts
  // ==========================================

  // Create a new automation script
  createScript: (name, script, options) => ipcRenderer.invoke('create-script', { name, script, options }),

  // Update an existing automation script
  updateScript: (id, updates) => ipcRenderer.invoke('update-script', { id, updates }),

  // Delete an automation script
  deleteScript: (id) => ipcRenderer.invoke('delete-script', id),

  // Get a script by ID
  getScript: (id) => ipcRenderer.invoke('get-script', id),

  // List all automation scripts
  listScripts: (options) => ipcRenderer.invoke('list-scripts', options),

  // Run an automation script manually
  runScript: (id, context) => ipcRenderer.invoke('run-script', { id, context }),

  // Enable auto-run for a script
  enableScript: (id) => ipcRenderer.invoke('enable-script', id),

  // Disable auto-run for a script
  disableScript: (id) => ipcRenderer.invoke('disable-script', id),

  // Export all scripts to JSON
  exportScripts: () => ipcRenderer.invoke('export-scripts'),

  // Import scripts from JSON
  importScripts: (data, overwrite) => ipcRenderer.invoke('import-scripts', { data, overwrite }),

  // Get available script context/helper functions
  getScriptContext: () => ipcRenderer.invoke('get-script-context'),

  // Get script execution history
  getScriptHistory: (options) => ipcRenderer.invoke('get-script-history', options),
});

// Bot evasion injections - override navigator.webdriver and other telltales
contextBridge.exposeInMainWorld('evasionHelpers', {
  // Script to inject into webview to evade bot detection
  getWebviewEvasionScript: () => {
    return `
      (function() {
        // Override navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true
        });

        // Remove webdriver from navigator
        delete navigator.__proto__.webdriver;

        // Override navigator.plugins to look realistic
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const plugins = [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
              { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
            ];
            plugins.length = 3;
            return plugins;
          },
          configurable: true
        });

        // Override navigator.languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
          configurable: true
        });

        // Override navigator.platform
        Object.defineProperty(navigator, 'platform', {
          get: () => 'Win32',
          configurable: true
        });

        // Override permissions query
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => {
          if (parameters.name === 'notifications') {
            return Promise.resolve({ state: Notification.permission });
          }
          return originalQuery(parameters);
        };

        // Override chrome runtime
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {}
        };

        // Remove automation-related properties
        const automationProps = [
          '_phantom', '__nightmare', '_selenium', 'callPhantom',
          'callSelenium', '_Selenium_IDE_Recorder', 'bot', 'headless'
        ];

        automationProps.forEach(prop => {
          if (window[prop]) delete window[prop];
          if (document[prop]) delete document[prop];
        });

        console.log('Basset Hound evasion script loaded');
      })();
    `;
  },
});

// DOM manipulation helpers exposed to renderer
contextBridge.exposeInMainWorld('domHelpers', {
  // Create element with attributes
  createElement: (tag, attributes, textContent) => {
    const el = document.createElement(tag);
    if (attributes) {
      Object.keys(attributes).forEach(key => {
        el.setAttribute(key, attributes[key]);
      });
    }
    if (textContent) {
      el.textContent = textContent;
    }
    return el;
  },

  // Query selector helper
  query: (selector) => document.querySelector(selector),
  queryAll: (selector) => document.querySelectorAll(selector),

  // Safe innerHTML setter
  setHTML: (element, html) => {
    if (element && typeof html === 'string') {
      element.innerHTML = html;
    }
  },

  // Add event listener safely
  addListener: (element, event, handler) => {
    if (element && event && handler) {
      element.addEventListener(event, handler);
    }
  },
});
