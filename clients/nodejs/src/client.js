/**
 * Basset Hound Browser WebSocket Client
 *
 * Main client class for interacting with the Basset Hound Browser.
 */

const WebSocket = require('ws');
const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('crypto');
const { ConnectionError, CommandError, TimeoutError } = require('./errors');

/**
 * Generate a unique request ID
 * @returns {string}
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * WebSocket client for controlling Basset Hound Browser
 * @extends EventEmitter
 */
class BassetHoundClient extends EventEmitter {
  /**
   * Create a new BassetHoundClient instance
   * @param {Object} [options] - Client options
   * @param {string} [options.host='localhost'] - WebSocket server host
   * @param {number} [options.port=8765] - WebSocket server port
   * @param {number} [options.connectionTimeout=10000] - Connection timeout in ms
   * @param {number} [options.commandTimeout=30000] - Default command timeout in ms
   * @param {boolean} [options.autoReconnect=false] - Auto-reconnect on disconnect
   * @param {number} [options.reconnectInterval=1000] - Reconnect interval in ms
   * @param {number} [options.maxReconnectAttempts=5] - Max reconnect attempts
   */
  constructor(options = {}) {
    super();

    this.host = options.host || 'localhost';
    this.port = options.port || 8765;
    this.connectionTimeout = options.connectionTimeout || 10000;
    this.commandTimeout = options.commandTimeout || 30000;
    this.autoReconnect = options.autoReconnect || false;
    this.reconnectInterval = options.reconnectInterval || 1000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;

    this._ws = null;
    this._connected = false;
    this._reconnectAttempts = 0;
    this._pendingRequests = new Map();
  }

  /**
   * Get the WebSocket URL
   * @returns {string}
   */
  get url() {
    return `ws://${this.host}:${this.port}`;
  }

  /**
   * Check if client is connected
   * @returns {boolean}
   */
  get isConnected() {
    return this._connected;
  }

  /**
   * Connect to the Basset Hound Browser WebSocket server
   * @returns {Promise<void>}
   * @throws {ConnectionError}
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this._connected) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        if (this._ws) {
          this._ws.terminate();
        }
        reject(new ConnectionError(`Connection timeout after ${this.connectionTimeout}ms`));
      }, this.connectionTimeout);

      this._ws = new WebSocket(this.url);

      this._ws.on('open', () => {
        clearTimeout(timeoutId);
        this._connected = true;
        this._reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      this._ws.on('message', (data) => {
        this._handleMessage(data.toString());
      });

      this._ws.on('error', (error) => {
        clearTimeout(timeoutId);
        this.emit('error', error);
        if (!this._connected) {
          reject(new ConnectionError(error.message));
        }
      });

      this._ws.on('close', (code, reason) => {
        this._connected = false;
        this.emit('disconnected', { code, reason: reason.toString() });

        // Reject all pending requests
        for (const [id, { reject: rejectFn }] of this._pendingRequests) {
          rejectFn(new ConnectionError('Connection closed'));
        }
        this._pendingRequests.clear();

        // Auto-reconnect if enabled
        if (this.autoReconnect && this._reconnectAttempts < this.maxReconnectAttempts) {
          this._reconnectAttempts++;
          setTimeout(() => {
            this.emit('reconnecting', this._reconnectAttempts);
            this.connect().catch(() => {});
          }, this.reconnectInterval);
        }
      });
    });
  }

  /**
   * Disconnect from the WebSocket server
   * @returns {Promise<void>}
   */
  disconnect() {
    return new Promise((resolve) => {
      if (!this._ws) {
        resolve();
        return;
      }

      this.autoReconnect = false; // Disable auto-reconnect

      this._ws.once('close', () => {
        this._connected = false;
        resolve();
      });

      this._ws.close();
    });
  }

  /**
   * Handle incoming WebSocket message
   * @private
   * @param {string} data - Message data
   */
  _handleMessage(data) {
    try {
      const message = JSON.parse(data);
      const requestId = message.id;

      if (requestId && this._pendingRequests.has(requestId)) {
        const { resolve, reject, timeoutId } = this._pendingRequests.get(requestId);
        this._pendingRequests.delete(requestId);
        clearTimeout(timeoutId);

        if (message.success === false) {
          reject(new CommandError(message.error || 'Unknown error', null, message));
        } else {
          resolve(message);
        }
      }

      this.emit('message', message);
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Send a command to the browser and wait for response
   * @param {string} command - Command name
   * @param {Object} [params={}] - Command parameters
   * @param {number} [timeout] - Command timeout (uses default if not specified)
   * @returns {Promise<Object>} Response data from the browser
   * @throws {ConnectionError} If not connected
   * @throws {CommandError} If command fails
   * @throws {TimeoutError} If command times out
   */
  sendCommand(command, params = {}, timeout = null) {
    return new Promise((resolve, reject) => {
      if (!this._connected) {
        reject(new ConnectionError('Not connected to browser'));
        return;
      }

      const requestId = generateId();
      const timeoutMs = timeout || this.commandTimeout;

      const message = {
        id: requestId,
        command,
        ...params
      };

      const timeoutId = setTimeout(() => {
        this._pendingRequests.delete(requestId);
        reject(new TimeoutError(`Command '${command}' timed out after ${timeoutMs}ms`, timeoutMs));
      }, timeoutMs);

      this._pendingRequests.set(requestId, { resolve, reject, timeoutId });

      try {
        this._ws.send(JSON.stringify(message));
      } catch (error) {
        this._pendingRequests.delete(requestId);
        clearTimeout(timeoutId);
        reject(new CommandError(`Failed to send command: ${error.message}`));
      }
    });
  }

  // ==================== Navigation Commands ====================

  /**
   * Navigate to a URL
   * @param {string} url - URL to navigate to
   * @param {string} [waitUntil='load'] - Wait condition
   * @returns {Promise<Object>}
   */
  navigate(url, waitUntil = 'load') {
    return this.sendCommand('navigate', { url, waitUntil });
  }

  /**
   * Navigate back in history
   * @returns {Promise<Object>}
   */
  goBack() {
    return this.sendCommand('go_back');
  }

  /**
   * Navigate forward in history
   * @returns {Promise<Object>}
   */
  goForward() {
    return this.sendCommand('go_forward');
  }

  /**
   * Reload the current page
   * @param {boolean} [ignoreCache=false] - Whether to ignore cache
   * @returns {Promise<Object>}
   */
  reload(ignoreCache = false) {
    return this.sendCommand('reload', { ignoreCache });
  }

  /**
   * Get the current URL
   * @returns {Promise<string>}
   */
  async getUrl() {
    const result = await this.sendCommand('get_url');
    return result.url || '';
  }

  /**
   * Get the current page title
   * @returns {Promise<string>}
   */
  async getTitle() {
    const result = await this.sendCommand('get_title');
    return result.title || '';
  }

  // ==================== Content Extraction ====================

  /**
   * Extract page metadata
   * @returns {Promise<Object>}
   */
  extractMetadata() {
    return this.sendCommand('extract_metadata');
  }

  /**
   * Extract all links from the page
   * @param {boolean} [includeExternal=true] - Include external links
   * @returns {Promise<Object>}
   */
  extractLinks(includeExternal = true) {
    return this.sendCommand('extract_links', { includeExternal });
  }

  /**
   * Extract all forms from the page
   * @returns {Promise<Object>}
   */
  extractForms() {
    return this.sendCommand('extract_forms');
  }

  /**
   * Extract all images from the page
   * @param {boolean} [includeLazy=true] - Include lazy-loaded images
   * @returns {Promise<Object>}
   */
  extractImages(includeLazy = true) {
    return this.sendCommand('extract_images', { includeLazy });
  }

  /**
   * Extract all scripts from the page
   * @returns {Promise<Object>}
   */
  extractScripts() {
    return this.sendCommand('extract_scripts');
  }

  /**
   * Extract structured data (JSON-LD, microdata)
   * @returns {Promise<Object>}
   */
  extractStructuredData() {
    return this.sendCommand('extract_structured_data');
  }

  /**
   * Extract all content types
   * @returns {Promise<Object>}
   */
  extractAll() {
    return this.sendCommand('extract_all');
  }

  // ==================== Technology Detection ====================

  /**
   * Detect technologies on current page
   * @returns {Promise<Object>}
   */
  detectTechnologies() {
    return this.sendCommand('detect_technologies');
  }

  /**
   * Get available technology categories
   * @returns {Promise<Object>}
   */
  getTechnologyCategories() {
    return this.sendCommand('get_technology_categories');
  }

  /**
   * Get info about a specific technology
   * @param {string} name - Technology name
   * @returns {Promise<Object>}
   */
  getTechnologyInfo(name) {
    return this.sendCommand('get_technology_info', { name });
  }

  /**
   * Search technologies
   * @param {string} query - Search query
   * @returns {Promise<Object>}
   */
  searchTechnologies(query) {
    return this.sendCommand('search_technologies', { query });
  }

  // ==================== Network Analysis ====================

  /**
   * Start capturing network traffic
   * @param {string[]} [filterTypes] - Resource types to capture
   * @returns {Promise<Object>}
   */
  startNetworkCapture(filterTypes = null) {
    const params = {};
    if (filterTypes) params.filterTypes = filterTypes;
    return this.sendCommand('start_network_capture', params);
  }

  /**
   * Stop capturing network traffic
   * @returns {Promise<Object>}
   */
  stopNetworkCapture() {
    return this.sendCommand('stop_network_capture');
  }

  /**
   * Get captured network requests
   * @param {Object} [options] - Filter options
   * @param {string} [options.filterType] - Filter by resource type
   * @param {string} [options.filterDomain] - Filter by domain
   * @returns {Promise<Object>}
   */
  getNetworkRequests(options = {}) {
    return this.sendCommand('get_network_requests', options);
  }

  /**
   * Get network statistics
   * @returns {Promise<Object>}
   */
  getNetworkStatistics() {
    return this.sendCommand('get_network_statistics');
  }

  /**
   * Export captured network data
   * @param {string} [format='har'] - Export format
   * @returns {Promise<Object>}
   */
  exportNetworkCapture(format = 'har') {
    return this.sendCommand('export_network_capture', { format });
  }

  /**
   * Clear captured network data
   * @returns {Promise<Object>}
   */
  clearNetworkCapture() {
    return this.sendCommand('clear_network_capture');
  }

  // ==================== Screenshots ====================

  /**
   * Take a screenshot
   * @param {Object} [options] - Screenshot options
   * @param {boolean} [options.fullPage=false] - Capture full page
   * @param {string} [options.format='png'] - Image format
   * @param {number} [options.quality=80] - JPEG quality
   * @returns {Promise<Object>}
   */
  screenshot(options = {}) {
    return this.sendCommand('screenshot', {
      fullPage: options.fullPage || false,
      format: options.format || 'png',
      quality: options.quality || 80
    });
  }

  /**
   * Save a screenshot to file
   * @param {string} path - File path
   * @param {Object} [options] - Screenshot options
   * @returns {Promise<Object>}
   */
  saveScreenshot(path, options = {}) {
    return this.sendCommand('save_screenshot', {
      path,
      fullPage: options.fullPage || false,
      format: options.format || 'png'
    });
  }

  // ==================== Cookies ====================

  /**
   * Get cookies
   * @param {string} [url] - Filter by URL
   * @returns {Promise<Object>}
   */
  getCookies(url = null) {
    const params = {};
    if (url) params.url = url;
    return this.sendCommand('get_cookies', params);
  }

  /**
   * Set a cookie
   * @param {Object} cookie - Cookie options
   * @returns {Promise<Object>}
   */
  setCookie(cookie) {
    return this.sendCommand('set_cookie', cookie);
  }

  /**
   * Delete cookies
   * @param {Object} [options] - Delete options
   * @returns {Promise<Object>}
   */
  deleteCookies(options = {}) {
    return this.sendCommand('delete_cookies', options);
  }

  // ==================== Tab Management ====================

  /**
   * Get all tabs
   * @returns {Promise<Object>}
   */
  getTabs() {
    return this.sendCommand('get_tabs');
  }

  /**
   * Open a new tab
   * @param {string} [url] - URL to open
   * @returns {Promise<Object>}
   */
  newTab(url = null) {
    const params = {};
    if (url) params.url = url;
    return this.sendCommand('new_tab', params);
  }

  /**
   * Close a tab
   * @param {string} [tabId] - Tab ID
   * @returns {Promise<Object>}
   */
  closeTab(tabId = null) {
    const params = {};
    if (tabId) params.tabId = tabId;
    return this.sendCommand('close_tab', params);
  }

  /**
   * Switch to a tab
   * @param {string} tabId - Tab ID
   * @returns {Promise<Object>}
   */
  switchTab(tabId) {
    return this.sendCommand('switch_tab', { tabId });
  }

  // ==================== Input Simulation ====================

  /**
   * Click an element
   * @param {string} selector - CSS selector
   * @returns {Promise<Object>}
   */
  click(selector) {
    return this.sendCommand('click', { selector });
  }

  /**
   * Type text into an element
   * @param {string} selector - CSS selector
   * @param {string} text - Text to type
   * @param {number} [delay=50] - Delay between keystrokes in ms
   * @returns {Promise<Object>}
   */
  type(selector, text, delay = 50) {
    return this.sendCommand('type', { selector, text, delay });
  }

  /**
   * Scroll the page or element
   * @param {Object} options - Scroll options
   * @returns {Promise<Object>}
   */
  scroll(options = {}) {
    return this.sendCommand('scroll', {
      x: options.x || 0,
      y: options.y || 0,
      selector: options.selector || null
    });
  }

  // ==================== JavaScript Execution ====================

  /**
   * Execute JavaScript in the page context
   * @param {string} script - JavaScript code
   * @returns {Promise<Object>}
   */
  executeScript(script) {
    return this.sendCommand('execute_script', { script });
  }

  // ==================== Proxy Configuration ====================

  /**
   * Set proxy configuration
   * @param {Object} config - Proxy config
   * @returns {Promise<Object>}
   */
  setProxy(config) {
    return this.sendCommand('set_proxy', config);
  }

  /**
   * Clear proxy configuration
   * @returns {Promise<Object>}
   */
  clearProxy() {
    return this.sendCommand('clear_proxy');
  }

  // ==================== Fingerprint / Evasion ====================

  /**
   * Set user agent
   * @param {string} userAgent - User agent string
   * @returns {Promise<Object>}
   */
  setUserAgent(userAgent) {
    return this.sendCommand('set_user_agent', { userAgent });
  }

  /**
   * Set viewport size
   * @param {number} width - Viewport width
   * @param {number} height - Viewport height
   * @returns {Promise<Object>}
   */
  setViewport(width, height) {
    return this.sendCommand('set_viewport', { width, height });
  }

  /**
   * Get current fingerprint
   * @returns {Promise<Object>}
   */
  getFingerprint() {
    return this.sendCommand('get_fingerprint');
  }

  /**
   * Randomize fingerprint
   * @returns {Promise<Object>}
   */
  randomizeFingerprint() {
    return this.sendCommand('randomize_fingerprint');
  }

  // ==================== Data Ingestion (Phase 13) ====================

  /**
   * Detect data types in the current page
   * @param {Object} options - Detection options
   * @param {string[]} [options.types] - Specific types to detect
   * @param {number} [options.confidenceThreshold] - Min confidence (0-1)
   * @param {string} [options.html] - HTML content to scan
   * @param {string} [options.url] - URL for context
   * @returns {Promise<Object>} Detection results
   */
  detectDataTypes(options = {}) {
    const params = {};
    if (options.types) params.types = options.types;
    if (options.confidenceThreshold !== undefined) {
      params.confidence_threshold = options.confidenceThreshold;
    }
    if (options.html) params.html = options.html;
    if (options.url) params.url = options.url;
    return this.sendCommand('detect_data_types', params);
  }

  /**
   * Get available detection types
   * @returns {Promise<Object>} Available types
   */
  getDetectionTypes() {
    return this.sendCommand('get_detection_types');
  }

  /**
   * Configure ingestion settings
   * @param {Object} config - Configuration options
   * @param {string} [config.mode] - Ingestion mode
   * @param {string[]} [config.enabledTypes] - Types to enable
   * @param {string[]} [config.autoIngestTypes] - Types to auto-ingest
   * @param {number} [config.confidenceThreshold] - Min confidence
   * @param {Object} [config.deduplication] - Deduplication settings
   * @param {Object} [config.rateLimiting] - Rate limiting settings
   * @param {Object} [config.provenance] - Provenance settings
   * @returns {Promise<Object>} Updated configuration
   */
  configureIngestion(config = {}) {
    const params = {};
    if (config.mode) params.mode = config.mode;
    if (config.enabledTypes) params.enabled_types = config.enabledTypes;
    if (config.autoIngestTypes) params.auto_ingest_types = config.autoIngestTypes;
    if (config.confidenceThreshold !== undefined) {
      params.confidence_threshold = config.confidenceThreshold;
    }
    if (config.deduplication) params.deduplication = config.deduplication;
    if (config.rateLimiting) params.rate_limiting = config.rateLimiting;
    if (config.provenance) params.provenance = config.provenance;
    return this.sendCommand('configure_ingestion', params);
  }

  /**
   * Get current ingestion configuration
   * @returns {Promise<Object>} Current config
   */
  getIngestionConfig() {
    return this.sendCommand('get_ingestion_config');
  }

  /**
   * Set ingestion mode
   * @param {string} mode - 'automatic'|'selective'|'type_filtered'|'confirmation'|'batch'
   * @returns {Promise<Object>} Confirmation
   */
  setIngestionMode(mode) {
    return this.sendCommand('set_ingestion_mode', { mode });
  }

  /**
   * Process page for ingestion
   * @param {Object} options - Processing options
   * @param {string} [options.html] - HTML content
   * @param {string} [options.url] - URL for context
   * @returns {Promise<Object>} Processing results
   */
  processPageForIngestion(options = {}) {
    const params = {};
    if (options.html) params.html = options.html;
    if (options.url) params.url = options.url;
    return this.sendCommand('process_page_for_ingestion', params);
  }

  /**
   * Get items in ingestion queue
   * @returns {Promise<Object>} Queue contents
   */
  getIngestionQueue() {
    return this.sendCommand('get_ingestion_queue');
  }

  /**
   * Ingest selected items from queue
   * @param {string[]} itemIds - Item IDs to ingest
   * @returns {Promise<Object>} Ingestion results
   */
  ingestSelected(itemIds) {
    return this.sendCommand('ingest_selected', { item_ids: itemIds });
  }

  /**
   * Ingest all items in queue
   * @returns {Promise<Object>} Ingestion results
   */
  ingestAll() {
    return this.sendCommand('ingest_all');
  }

  /**
   * Clear ingestion queue
   * @returns {Promise<Object>} Confirmation
   */
  clearIngestionQueue() {
    return this.sendCommand('clear_ingestion_queue');
  }

  /**
   * Remove items from queue
   * @param {string[]} itemIds - Item IDs to remove
   * @returns {Promise<Object>} Updated queue info
   */
  removeFromIngestionQueue(itemIds) {
    return this.sendCommand('remove_from_ingestion_queue', { item_ids: itemIds });
  }

  /**
   * Get ingestion history
   * @param {number} [limit=100] - Max items to return
   * @returns {Promise<Object>} History entries
   */
  getIngestionHistory(limit = 100) {
    return this.sendCommand('get_ingestion_history', { limit });
  }

  /**
   * Get ingestion statistics
   * @returns {Promise<Object>} Statistics
   */
  getIngestionStats() {
    return this.sendCommand('get_ingestion_stats');
  }

  /**
   * Reset ingestion statistics
   * @returns {Promise<Object>} Confirmation
   */
  resetIngestionStats() {
    return this.sendCommand('reset_ingestion_stats');
  }

  /**
   * Export detected data to JSON
   * @param {Object} options - Export options
   * @param {Object[]} [options.items] - Specific items to export
   * @param {boolean} [options.asString] - Return as JSON string
   * @returns {Promise<Object>} Exported data
   */
  exportDetections(options = {}) {
    const params = {};
    if (options.items) params.items = options.items;
    if (options.asString) params.as_string = options.asString;
    return this.sendCommand('export_detections', params);
  }

  /**
   * Add custom detection pattern
   * @param {string} key - Unique pattern identifier
   * @param {Object} config - Pattern configuration
   * @param {string[]} config.patterns - Regex patterns
   * @param {string} [config.name] - Human-readable name
   * @param {string} [config.orphanType] - basset-hound type
   * @param {string} [config.validator] - Validator name
   * @param {number} [config.contextChars] - Context characters
   * @param {number} [config.priority] - Detection priority
   * @param {Object} [config.metadata] - Additional metadata
   * @returns {Promise<Object>} Confirmation
   */
  addDetectionPattern(key, config) {
    const params = {
      key,
      patterns: config.patterns,
      orphan_type: config.orphanType || 'other',
      context_chars: config.contextChars || 50,
      priority: config.priority || 99
    };
    if (config.name) params.name = config.name;
    if (config.validator) params.validator = config.validator;
    if (config.metadata) params.metadata = config.metadata;
    return this.sendCommand('add_detection_pattern', params);
  }

  /**
   * Remove detection pattern
   * @param {string} key - Pattern key to remove
   * @returns {Promise<Object>} Confirmation
   */
  removeDetectionPattern(key) {
    return this.sendCommand('remove_detection_pattern', { key });
  }
}

module.exports = { BassetHoundClient };
