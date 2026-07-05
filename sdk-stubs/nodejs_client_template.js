/**
 * Basset Hound Browser - Node.js SDK Template
 * Version: 12.8.0
 * Protocol: WebSocket (JSON)
 *
 * This is a template/stub for building Node.js clients. Extend this class with
 * your specific requirements.
 *
 * Usage:
 *   const { BassetClient } = require('./basset-client');
 *
 *   (async () => {
 *     const client = new BassetClient({ url: 'ws://localhost:8765' });
 *     await client.connect();
 *     const screenshot = await client.screenshot();
 *     await client.disconnect();
 *   })();
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const util = require('util');

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG = {
  url: 'ws://localhost:8765',
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  logLevel: 'info',
  autoReconnect: true,
  token: null,
};

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const ERROR_CODES = {
  INVALID_PARAMS: 'INVALID_PARAMS',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CONFLICT: 'CONFLICT',
  SIZE_EXCEEDED: 'SIZE_EXCEEDED',
  TIMEOUT: 'TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
};

// ============================================================================
// Error Classes
// ============================================================================

class BassetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BassetError';
  }
}

class ConnectionError extends BassetError {
  constructor(message) {
    super(message);
    this.name = 'ConnectionError';
  }
}

class CommandError extends BassetError {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'CommandError';
    this.code = code;
    this.details = details;
  }
}

class TimeoutError extends BassetError {
  constructor(command, timeout) {
    super(`Command '${command}' timeout after ${timeout}ms`);
    this.name = 'TimeoutError';
    this.command = command;
    this.timeout = timeout;
  }
}

class RateLimitError extends BassetError {
  constructor(rateLimit) {
    super(
      `Rate limit exceeded: ${rateLimit.remaining}/${rateLimit.limit} remaining, ` +
      `retry in ${rateLimit.retryAfter}ms`
    );
    this.name = 'RateLimitError';
    this.rateLimit = rateLimit;
  }
}

class SizeExceededError extends BassetError {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SizeExceededError';
    this.details = details;
  }
}

// ============================================================================
// Logger
// ============================================================================

class Logger {
  constructor(level = 'info') {
    this.level = LOG_LEVELS[level] || LOG_LEVELS.info;
  }

  debug(...args) {
    if (this.level <= LOG_LEVELS.debug) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args) {
    if (this.level <= LOG_LEVELS.info) {
      console.log('[INFO]', ...args);
    }
  }

  warn(...args) {
    if (this.level <= LOG_LEVELS.warn) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args) {
    if (this.level <= LOG_LEVELS.error) {
      console.error('[ERROR]', ...args);
    }
  }
}

// ============================================================================
// Basset Hound Client
// ============================================================================

class BassetClient extends EventEmitter {
  /**
   * Initialize Basset Hound client.
   *
   * @param {Object} config - Configuration object
   * @param {string} config.url - WebSocket URL (default: ws://localhost:8765)
   * @param {number} config.timeout - Request timeout in ms (default: 30000)
   * @param {boolean} config.autoReconnect - Auto reconnect on disconnect
   * @param {string} config.token - API token for authentication
   * @param {string} config.logLevel - Log level (debug, info, warn, error)
   */
  constructor(config = {}) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger(this.config.logLevel);

    this.ws = null;
    this.connected = false;
    this.requestCounter = 0;
    this.responseHandlers = new Map();
    this.rateLimit = null;

    this.logger.debug('Client initialized', this.config);
  }

  /**
   * Connect to WebSocket server.
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        const url = this._buildUrl();
        this.logger.info(`Connecting to ${url}...`);

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          this.connected = true;
          this.logger.info('Connected successfully');
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data) => this._handleMessage(data));

        this.ws.on('error', (error) => {
          this.logger.error('WebSocket error:', error);
          this.emit('error', error);
          if (!this.connected) {
            reject(new ConnectionError(`Failed to connect: ${error.message}`));
          }
        });

        this.ws.on('close', () => {
          this.connected = false;
          this.logger.info('Disconnected');
          this.emit('disconnected');

          if (this.config.autoReconnect) {
            this.logger.info('Attempting to reconnect...');
            setTimeout(() => this.connect(), this.config.retryDelay);
          }
        });
      } catch (error) {
        reject(new ConnectionError(`Connection failed: ${error.message}`));
      }
    });
  }

  /**
   * Disconnect from WebSocket server.
   */
  async disconnect() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close();
        setTimeout(resolve, 100);
      } else {
        resolve();
      }
    });
  }

  /**
   * Build WebSocket URL with optional token.
   */
  _buildUrl() {
    let url = this.config.url;
    if (this.config.token) {
      url += `?token=${encodeURIComponent(this.config.token)}`;
    }
    return url;
  }

  /**
   * Generate unique request ID.
   */
  _getRequestId() {
    this.requestCounter++;
    return `req-${Date.now()}-${this.requestCounter}`;
  }

  /**
   * Handle incoming WebSocket message.
   */
  _handleMessage(data) {
    try {
      const response = JSON.parse(data);
      const { id } = response;

      if (this.responseHandlers.has(id)) {
        const handler = this.responseHandlers.get(id);
        this.responseHandlers.delete(id);

        clearTimeout(handler.timeout);
        handler.resolve(response);
      } else {
        this.logger.warn(`Received response for unknown request ID: ${id}`);
      }
    } catch (error) {
      this.logger.error('Error parsing message:', error);
    }
  }

  /**
   * Execute a command.
   *
   * @param {string} command - Command name
   * @param {Object} params - Command parameters
   * @param {number} timeout - Request timeout in ms
   * @returns {Promise<Object>} Response data
   * @throws {ConnectionError} Not connected
   * @throws {TimeoutError} Command timeout
   * @throws {CommandError} Command failed
   * @throws {RateLimitError} Rate limit exceeded
   */
  async execute(command, params = {}, timeout = this.config.timeout) {
    if (!this.connected) {
      throw new ConnectionError('Not connected to server');
    }

    const id = this._getRequestId();

    // Build request
    const request = {
      id,
      command,
      timeout,
      ...params,
    };

    // Send request
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.responseHandlers.delete(id);
        reject(new TimeoutError(command, timeout));
      }, timeout);

      try {
        this.ws.send(JSON.stringify(request), (error) => {
          if (error) {
            clearTimeout(timeoutHandle);
            this.responseHandlers.delete(id);
            reject(new ConnectionError(`Failed to send command: ${error.message}`));
          }
        });

        // Store handler
        this.responseHandlers.set(id, {
          resolve: (response) => {
            this._handleResponse(response, resolve, reject);
          },
          reject,
          timeout: timeoutHandle,
        });
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.responseHandlers.delete(id);
        reject(new BassetError(`Error executing command: ${error.message}`));
      }
    });
  }

  /**
   * Handle command response.
   */
  _handleResponse(response, resolve, reject) {
    const { success, error, code, data, details } = response;

    if (!success) {
      if (code === ERROR_CODES.RATE_LIMITED) {
        this.rateLimit = details;
        reject(new RateLimitError(details));
      } else if (code === ERROR_CODES.SIZE_EXCEEDED) {
        reject(new SizeExceededError(error, details));
      } else {
        reject(new CommandError(code, error, details));
      }
    } else {
      resolve(data);
    }
  }

  /**
   * Get current rate limit status.
   */
  async getRateLimitStatus() {
    try {
      const data = await this.execute('get_rate_limit_status');
      if (data) {
        this.rateLimit = data;
        return data;
      }
    } catch (error) {
      this.logger.warn(`Failed to get rate limit status: ${error.message}`);
    }
    return null;
  }

  // ========================================================================
  // Common Commands
  // ========================================================================

  /**
   * Navigate to URL.
   */
  async navigate(url, waitUntil = 'networkidle2') {
    return this.execute('navigate', { url, waitUntil });
  }

  /**
   * Take screenshot.
   */
  async screenshot(fullPage = false) {
    const command = fullPage ? 'screenshot_full_page' : 'screenshot';
    return this.execute(command, { fullPage });
  }

  /**
   * Take screenshot of element.
   */
  async screenshotElement(selector) {
    return this.execute('screenshot_element', { selector });
  }

  /**
   * Click element.
   */
  async click(selector) {
    return this.execute('click', { selector });
  }

  /**
   * Fill input field.
   */
  async fill(selector, text) {
    return this.execute('fill', { selector, text });
  }

  /**
   * Type text.
   */
  async typeText(text, delay = 100) {
    return this.execute('type', { text, delay });
  }

  /**
   * Get page content.
   */
  async getContent(type = 'text') {
    return this.execute('get_content', { type });
  }

  /**
   * Get current URL.
   */
  async getUrl() {
    return this.execute('get_url');
  }

  /**
   * Get page title.
   */
  async getTitle() {
    return this.execute('get_title');
  }

  /**
   * Execute JavaScript.
   */
  async executeScript(script) {
    return this.execute('execute_script', { script });
  }

  /**
   * Wait for selector.
   */
  async waitForSelector(selector, timeout = 30000) {
    return this.execute('wait_for_selector', { selector, timeout });
  }

  /**
   * Scroll page.
   */
  async scroll(x = 0, y = 0) {
    return this.execute('scroll', { x, y });
  }

  /**
   * Get page state.
   */
  async getPageState() {
    return this.execute('get_page_state');
  }

  // ========================================================================
  // Evidence Capture Commands
  // ========================================================================

  /**
   * Capture screenshot as evidence.
   */
  async captureScreenshotEvidence(imageData, url, title = null, fullPage = false) {
    return this.execute('capture_screenshot_evidence', {
      imageData,
      url,
      title,
      fullPage,
    });
  }

  /**
   * Capture page archive (MHTML, WARC, PDF).
   */
  async capturePageArchive(content, format, url, title = null) {
    return this.execute('capture_page_archive_evidence', {
      content,
      format,
      url,
      title,
    });
  }

  /**
   * Capture network traffic as HAR.
   */
  async captureHarEvidence(harData, url, title = null) {
    return this.execute('capture_har_evidence', {
      harData,
      url,
      title,
    });
  }

  /**
   * Capture DOM snapshot.
   */
  async captureDomEvidence(domString, url, includeStyles = true) {
    return this.execute('capture_dom_evidence', {
      domString,
      url,
      includeStyles,
    });
  }

  /**
   * Capture console output.
   */
  async captureConsoleEvidence(logs, url, errors = null, warnings = null) {
    return this.execute('capture_console_evidence', {
      logs,
      url,
      errors,
      warnings,
    });
  }

  // ========================================================================
  // Network Forensics Commands
  // ========================================================================

  /**
   * Start network forensics capture.
   */
  async startNetworkForensics(options = {}) {
    return this.execute('start_network_forensics_capture', options);
  }

  /**
   * Stop network forensics capture.
   */
  async stopNetworkForensics() {
    return this.execute('stop_network_forensics_capture');
  }

  /**
   * Get network forensics status.
   */
  async getNetworkForensicsStatus() {
    return this.execute('get_network_forensics_status');
  }

  // ========================================================================
  // Session Management Commands
  // ========================================================================

  /**
   * Create new browser profile.
   */
  async createProfile(profileName) {
    return this.execute('create_profile', { profileName });
  }

  /**
   * List available profiles.
   */
  async listProfiles() {
    return this.execute('list_profiles');
  }

  /**
   * Get cookies.
   */
  async getCookies(domain = null) {
    return this.execute('get_cookies', { domain });
  }

  /**
   * Clear all cookies.
   */
  async clearCookies() {
    return this.execute('clear_all_cookies');
  }

  /**
   * Get local storage.
   */
  async getLocalStorage() {
    return this.execute('get_local_storage');
  }

  /**
   * Get session storage.
   */
  async getSessionStorage() {
    return this.execute('get_session_storage');
  }

  // ========================================================================
  // Evasion Commands
  // ========================================================================

  /**
   * Set user agent.
   */
  async setUserAgent(userAgent) {
    return this.execute('set_user_agent', { userAgent });
  }

  /**
   * Set proxy.
   */
  async setProxy(proxyType, host, port, username = null, password = null) {
    return this.execute('set_proxy', {
      proxyType,
      host,
      port,
      username,
      password,
    });
  }

  /**
   * Set geolocation.
   */
  async setGeolocation(latitude, longitude, accuracy = 100) {
    return this.execute('set_geolocation', {
      latitude,
      longitude,
      accuracy,
    });
  }

  /**
   * Set timezone.
   */
  async setTimezone(timezoneId) {
    return this.execute('set_timezone', { timezoneId });
  }

  /**
   * Set locale.
   */
  async setLocale(locale) {
    return this.execute('set_locale', { locale });
  }
}

// ============================================================================
// Module Exports
// ============================================================================

module.exports = {
  BassetClient,
  BassetError,
  ConnectionError,
  CommandError,
  TimeoutError,
  RateLimitError,
  SizeExceededError,
  ERROR_CODES,
  LOG_LEVELS,
};

// ============================================================================
// Example Usage
// ============================================================================

if (require.main === module) {
  (async () => {
    const client = new BassetClient({
      url: 'ws://localhost:8765',
      logLevel: 'info',
    });

    try {
      // Connect
      await client.connect();
      console.log('Connected');

      // Navigate
      console.log('Navigating...');
      await client.navigate('https://example.com');

      // Get title
      const titleData = await client.getTitle();
      console.log(`Title: ${titleData.title}`);

      // Take screenshot
      console.log('Taking screenshot...');
      const screenshot = await client.screenshot();
      console.log(`Screenshot size: ${screenshot.imageData.length}`);

      // Capture evidence
      console.log('Capturing evidence...');
      const evidence = await client.captureScreenshotEvidence(
        screenshot.imageData,
        'https://example.com'
      );
      console.log(`Evidence ID: ${evidence.evidenceId}`);

      // Check rate limits
      const limits = await client.getRateLimitStatus();
      if (limits) {
        console.log(`Rate limit: ${limits.remaining}/${limits.limit}`);
      }

      // Disconnect
      await client.disconnect();
      console.log('Disconnected');
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}
