const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
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
const { memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus } = require('../utils/memory-manager');
const { TechnologyManager } = require('../technology');
const { ExtractionManager } = require('../extraction');
const { NetworkAnalysisManager } = require('../network-analysis/manager');

// ==========================================
// Error Recovery Configuration
// ==========================================
const ERROR_RECOVERY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // Base delay in ms (exponential backoff applied)
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
    'TIMEOUT',
    'temporarily unavailable'
  ],
  // Commands that are safe to retry (idempotent operations)
  retryableCommands: [
    'get_url', 'get_content', 'get_page_state', 'screenshot', 'screenshot_viewport',
    'screenshot_full_page', 'screenshot_element', 'get_cookies', 'get_all_cookies',
    'list_sessions', 'list_tabs', 'get_tab_info', 'get_active_tab', 'get_history',
    'get_downloads', 'get_proxy_status', 'get_user_agent_status', 'status', 'ping',
    'get_network_logs', 'get_console_logs', 'list_profiles', 'get_profile',
    'get_storage_stats', 'get_local_storage', 'get_session_storage', 'list_scripts',
    'get_script', 'get_blocking_stats', 'get_devtools_status', 'get_console_status'
  ]
};

/**
 * Check if an error is transient/retryable
 * @param {Error|string} error - The error to check
 * @returns {boolean}
 */
function isRetryableError(error) {
  const errorMessage = error?.message || error?.toString() || '';
  return ERROR_RECOVERY_CONFIG.retryableErrors.some(
    retryableError => errorMessage.toLowerCase().includes(retryableError.toLowerCase())
  );
}

/**
 * Check if a command is safe to retry (idempotent)
 * @param {string} command - The command name
 * @returns {boolean}
 */
function isRetryableCommand(command) {
  return ERROR_RECOVERY_CONFIG.retryableCommands.includes(command);
}

/**
 * Calculate delay for retry with exponential backoff
 * @param {number} attempt - Current attempt number (0-based)
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(attempt) {
  return ERROR_RECOVERY_CONFIG.retryDelay * Math.pow(2, attempt);
}

/**
 * Sleep for specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a recovery suggestion based on error type
 * @param {string} command - The failed command
 * @param {Error|string} error - The error that occurred
 * @param {string} managerName - The name of the manager that's unavailable
 * @returns {Object} Recovery suggestion object
 */
function generateRecoverySuggestion(command, error, managerName = null) {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const suggestion = {
    error: errorMessage,
    recoverable: false,
    suggestion: '',
    alternativeCommands: []
  };

  // Manager unavailable errors
  if (managerName) {
    suggestion.recoverable = true;
    suggestion.suggestion = `The ${managerName} is not initialized. This may happen if the browser is still starting up. ` +
      `Try waiting a few seconds and retry the command. If the issue persists, the manager may have failed to initialize.`;
    suggestion.alternativeCommands = ['status', 'ping'];
    return suggestion;
  }

  // Network/connection errors
  if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ECONNRESET')) {
    suggestion.recoverable = true;
    suggestion.suggestion = 'Network timeout or connection reset. Check your network connection and retry. ' +
      'For proxy-related issues, verify your proxy settings with get_proxy_status.';
    suggestion.alternativeCommands = ['get_proxy_status', 'status'];
  }
  // Element not found
  else if (errorMessage.includes('not found') || errorMessage.includes('no such element')) {
    suggestion.suggestion = 'Element not found on the page. Verify the selector is correct and the page has fully loaded. ' +
      'Use wait_for_element before interacting with dynamic content.';
    suggestion.alternativeCommands = ['wait_for_element', 'get_page_state', 'get_content'];
  }
  // Timeout waiting for element
  else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    suggestion.recoverable = true;
    suggestion.suggestion = 'Operation timed out. The page may be slow to load or the element may not exist. ' +
      'Increase the timeout parameter or check if the element exists.';
    suggestion.alternativeCommands = ['get_page_state', 'screenshot_viewport'];
  }
  // Navigation errors
  else if (errorMessage.includes('navigation') || errorMessage.includes('ERR_')) {
    suggestion.suggestion = 'Navigation failed. The URL may be invalid, blocked, or the server is unavailable. ' +
      'Check the URL and your network/proxy settings.';
    suggestion.alternativeCommands = ['get_url', 'get_proxy_status', 'status'];
  }
  // Permission/access errors
  else if (errorMessage.includes('permission') || errorMessage.includes('access denied')) {
    suggestion.suggestion = 'Permission denied. The operation may require authentication or the resource may be restricted.';
    suggestion.alternativeCommands = ['get_cookies', 'status'];
  }
  // Script execution errors
  else if (errorMessage.includes('script') || errorMessage.includes('JavaScript')) {
    suggestion.suggestion = 'Script execution failed. Check the script syntax and ensure the page context is correct.';
    suggestion.alternativeCommands = ['get_console_logs', 'get_page_state'];
  }
  // Generic recoverable errors
  else if (isRetryableError(error)) {
    suggestion.recoverable = true;
    suggestion.suggestion = 'A transient error occurred. The command may succeed if retried.';
  }
  // Unknown errors
  else {
    suggestion.suggestion = 'An unexpected error occurred. Check the browser console and logs for more details. ' +
      'Use the status command to verify the browser state.';
    suggestion.alternativeCommands = ['status', 'get_console_logs'];
  }

  return suggestion;
}

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
    this.httpsServer = null; // HTTPS server for SSL/TLS support
    this.clients = new Set();
    this.commandHandlers = {};

    // SSL/TLS configuration (disabled by default for backwards compatibility)
    this.sslEnabled = options.sslEnabled || (process.env.BASSET_WS_SSL_ENABLED === 'true') || false;
    this.sslCertPath = options.sslCertPath || process.env.BASSET_WS_SSL_CERT || null;
    this.sslKeyPath = options.sslKeyPath || process.env.BASSET_WS_SSL_KEY || null;
    this.sslCaPath = options.sslCaPath || process.env.BASSET_WS_SSL_CA || null;
    this.sslActive = false; // Tracks whether SSL is actually in use

    // Authentication configuration
    this.authToken = options.authToken || process.env.BASSET_WS_TOKEN || null;
    this.requireAuth = options.requireAuth !== undefined ? options.requireAuth : (this.authToken !== null);
    this.authenticatedClients = new Set();

    // Heartbeat configuration
    this.heartbeatInterval = options.heartbeatInterval || 30000; // 30 seconds
    this.heartbeatTimeout = options.heartbeatTimeout || 60000; // 60 seconds
    this.heartbeatLoop = null;

    // Rate limiting configuration (disabled by default for backwards compatibility)
    this.rateLimitEnabled = options.rateLimitEnabled || false;
    this.maxRequestsPerMinute = options.maxRequestsPerMinute || 60;
    this.rateLimitWindow = options.rateLimitWindow || 60000; // 60 seconds (1 minute)
    this.burstAllowance = options.burstAllowance || 10; // Allow short bursts above the limit
    this.rateLimitData = new Map(); // Track request counts per client

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

    // Technology detection manager
    this.technologyManager = options.technologyManager || null;

    // Content extraction manager
    this.extractionManager = options.extractionManager || null;

    // Network analysis manager
    this.networkAnalysisManager = options.networkAnalysisManager || null;

    // Initialize Memory Manager (use global singleton or provided instance)
    this.memoryManager = options.memoryManager || memoryManager;
    this.memoryManager.setWebSocketServer(this);

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
    // Determine if we should use SSL/TLS
    if (this.sslEnabled && this.sslCertPath && this.sslKeyPath) {
      try {
        const sslOptions = this._loadSslCertificates();
        this.httpsServer = https.createServer(sslOptions);
        this.wss = new WebSocket.Server({ server: this.httpsServer });
        this.httpsServer.listen(this.port);
        this.sslActive = true;
        console.log(`[WebSocket] SSL/TLS enabled with certificate: ${this.sslCertPath}`);
      } catch (error) {
        console.error(`[WebSocket] Failed to load SSL certificates: ${error.message}`);
        console.log('[WebSocket] Falling back to non-SSL mode');
        this.wss = new WebSocket.Server({ port: this.port });
        this.sslActive = false;
      }
    } else {
      // Standard non-SSL WebSocket server
      this.wss = new WebSocket.Server({ port: this.port });
      this.sslActive = false;

      if (this.sslEnabled && (!this.sslCertPath || !this.sslKeyPath)) {
        console.warn('[WebSocket] SSL enabled but certificate/key paths not provided. Running without SSL.');
      }
    }

    // Start heartbeat monitoring
    this.startHeartbeat();

    this.wss.on('connection', (ws, req) => {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      ws.clientId = clientId;
      ws.isAlive = true;
      ws.lastHeartbeat = Date.now();
      this.clients.add(ws);

      // Check for token in query string or headers for immediate authentication
      const protocol = this.sslActive ? 'https' : 'http';
      const urlParams = new URL(req.url, `${protocol}://localhost:${this.port}`).searchParams;
      const queryToken = urlParams.get('token');
      const headerToken = req.headers['authorization']?.replace('Bearer ', '');
      const providedToken = queryToken || headerToken;

      if (providedToken && this.validateToken(providedToken)) {
        ws.isAuthenticated = true;
        this.authenticatedClients.add(ws);
        console.log(`[WebSocket] Client authenticated via token: ${clientId}`);
      } else {
        ws.isAuthenticated = !this.requireAuth;
      }

      console.log(`[WebSocket] Client connected: ${clientId} from ${req.socket.remoteAddress} (auth: ${ws.isAuthenticated}, ssl: ${this.sslActive})`);

      // Send connection status with auth requirement info
      ws.send(JSON.stringify({
        type: 'status',
        message: 'connected',
        clientId,
        authenticated: ws.isAuthenticated,
        authRequired: this.requireAuth,
        ssl: this.sslActive,
        protocol: this.getProtocol(),
        connectionUrl: this.getConnectionUrl()
      }));

      // Handle pong responses for heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
        ws.lastHeartbeat = Date.now();
      });

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());

          // Handle authentication command
          if (data.command === 'authenticate') {
            const authResult = this.handleAuthenticate(ws, data);
            ws.send(JSON.stringify({
              id: data.id,
              command: 'authenticate',
              ...authResult
            }));
            return;
          }

          // Check authentication for all other commands
          if (this.requireAuth && !ws.isAuthenticated) {
            ws.send(JSON.stringify({
              id: data.id,
              command: data.command,
              success: false,
              error: 'Authentication required. Send authenticate command with token.'
            }));
            return;
          }

          // Handle get_rate_limit_status command without counting against rate limit
          if (data.command === 'get_rate_limit_status') {
            const status = this.getRateLimitStatus(ws.clientId);
            ws.send(JSON.stringify({
              id: data.id,
              command: 'get_rate_limit_status',
              success: true,
              ...status
            }));
            return;
          }

          // Check rate limit before processing command
          const rateLimitResult = this.checkRateLimit(ws.clientId);
          if (!rateLimitResult.allowed) {
            ws.send(JSON.stringify({
              id: data.id,
              command: data.command,
              success: false,
              error: rateLimitResult.error,
              rateLimited: true,
              resetIn: rateLimitResult.resetIn,
              remaining: rateLimitResult.remaining
            }));
            return;
          }

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
        this.authenticatedClients.delete(ws);
        this.cleanupRateLimitData(ws.clientId);
        console.log(`[WebSocket] Client disconnected: ${clientId}`);
      });

      ws.on('error', (error) => {
        console.error(`[WebSocket] Client error (${clientId}):`, error);
        this.clients.delete(ws);
        this.authenticatedClients.delete(ws);
        this.cleanupRateLimitData(ws.clientId);
      });
    });

    this.wss.on('error', (error) => {
      console.error('[WebSocket] Server error:', error);
    });

    const authStatus = this.requireAuth ? 'enabled' : 'disabled';
    const rateLimitStatus = this.rateLimitEnabled ? `enabled (${this.maxRequestsPerMinute}/min, burst: ${this.burstAllowance})` : 'disabled';
    const sslStatus = this.sslActive ? 'enabled' : 'disabled';
    console.log(`[WebSocket] Server started on ${this.getConnectionUrl()} (auth: ${authStatus}, ssl: ${sslStatus}, rate limit: ${rateLimitStatus})`);
  }

  /**
   * Load SSL certificates from the configured paths
   * @returns {Object} SSL options for https.createServer
   * @throws {Error} If certificates cannot be loaded
   * @private
   */
  _loadSslCertificates() {
    // Validate certificate path exists
    if (!fs.existsSync(this.sslCertPath)) {
      throw new Error(`SSL certificate file not found: ${this.sslCertPath}`);
    }

    // Validate key path exists
    if (!fs.existsSync(this.sslKeyPath)) {
      throw new Error(`SSL private key file not found: ${this.sslKeyPath}`);
    }

    let cert, key, ca;

    try {
      cert = fs.readFileSync(this.sslCertPath);
    } catch (error) {
      throw new Error(`Failed to read SSL certificate: ${error.message}`);
    }

    try {
      key = fs.readFileSync(this.sslKeyPath);
    } catch (error) {
      throw new Error(`Failed to read SSL private key: ${error.message}`);
    }

    // Validate certificate format (basic check for PEM format)
    const certString = cert.toString();
    if (!certString.includes('-----BEGIN CERTIFICATE-----') &&
        !certString.includes('-----BEGIN TRUSTED CERTIFICATE-----')) {
      throw new Error('Invalid certificate format: Expected PEM format with BEGIN CERTIFICATE header');
    }

    // Validate key format (basic check for PEM format)
    const keyString = key.toString();
    if (!keyString.includes('-----BEGIN') || !keyString.includes('KEY-----')) {
      throw new Error('Invalid private key format: Expected PEM format with BEGIN key header');
    }

    const sslOptions = { cert, key };

    // Load CA certificate if provided (for client certificate verification)
    if (this.sslCaPath) {
      if (!fs.existsSync(this.sslCaPath)) {
        console.warn(`[WebSocket] CA certificate file not found: ${this.sslCaPath}. Client verification disabled.`);
      } else {
        try {
          ca = fs.readFileSync(this.sslCaPath);
          sslOptions.ca = ca;
          sslOptions.requestCert = true;
          sslOptions.rejectUnauthorized = true;
          console.log(`[WebSocket] Client certificate verification enabled with CA: ${this.sslCaPath}`);
        } catch (error) {
          console.warn(`[WebSocket] Failed to read CA certificate: ${error.message}. Client verification disabled.`);
        }
      }
    }

    return sslOptions;
  }

  /**
   * Check if SSL/TLS is currently active
   * @returns {boolean} True if SSL is active
   */
  isSslEnabled() {
    return this.sslActive;
  }

  /**
   * Get the WebSocket protocol based on SSL status
   * @returns {string} 'wss' if SSL is active, 'ws' otherwise
   */
  getProtocol() {
    return this.sslActive ? 'wss' : 'ws';
  }

  /**
   * Get the full connection URL for the WebSocket server
   * @param {string} [hostname='localhost'] - The hostname to use in the URL
   * @returns {string} Full connection URL (e.g., wss://localhost:8765)
   */
  getConnectionUrl(hostname = 'localhost') {
    return `${this.getProtocol()}://${hostname}:${this.port}`;
  }

  /**
   * Generate a self-signed certificate for development/testing
   * @param {string} outputDir - Directory to store the generated certificates
   * @param {Object} [options] - Certificate generation options
   * @param {string} [options.commonName='localhost'] - Common name for the certificate
   * @param {number} [options.days=365] - Validity period in days
   * @param {string} [options.keySize=2048] - RSA key size
   * @returns {Object} Paths to the generated certificate and key files
   * @static
   */
  static generateSelfSignedCert(outputDir, options = {}) {
    const {
      commonName = 'localhost',
      days = 365,
      keySize = 2048
    } = options;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const keyPath = path.join(outputDir, 'server.key');
    const certPath = path.join(outputDir, 'server.crt');

    // Check if openssl is available
    try {
      execSync('openssl version', { stdio: 'ignore' });
    } catch (error) {
      throw new Error('OpenSSL is required to generate self-signed certificates. Please install OpenSSL and try again.');
    }

    try {
      // Generate private key and self-signed certificate in one command
      const opensslCmd = `openssl req -x509 -newkey rsa:${keySize} -keyout "${keyPath}" -out "${certPath}" -days ${days} -nodes -subj "/CN=${commonName}" -addext "subjectAltName=DNS:${commonName},DNS:localhost,IP:127.0.0.1"`;

      execSync(opensslCmd, { stdio: 'pipe' });

      console.log(`[WebSocket] Self-signed certificate generated:`);
      console.log(`  Certificate: ${certPath}`);
      console.log(`  Private Key: ${keyPath}`);
      console.log(`  Valid for: ${days} days`);
      console.log(`  Common Name: ${commonName}`);

      return {
        certPath,
        keyPath,
        commonName,
        validDays: days
      };
    } catch (error) {
      throw new Error(`Failed to generate self-signed certificate: ${error.message}`);
    }
  }

  /**
   * Start heartbeat monitoring to detect dead connections
   */
  startHeartbeat() {
    this.heartbeatLoop = setInterval(() => {
      this.clients.forEach((ws) => {
        if (!ws.isAlive) {
          // Connection failed to respond to ping
          console.log(`[WebSocket] Client ${ws.clientId} failed heartbeat, terminating`);
          this.clients.delete(ws);
          this.authenticatedClients.delete(ws);
          this.cleanupRateLimitData(ws.clientId);
          return ws.terminate();
        }

        // Check if client hasn't responded within timeout
        if (Date.now() - ws.lastHeartbeat > this.heartbeatTimeout) {
          console.log(`[WebSocket] Client ${ws.clientId} heartbeat timeout, terminating`);
          this.clients.delete(ws);
          this.authenticatedClients.delete(ws);
          this.cleanupRateLimitData(ws.clientId);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeat() {
    if (this.heartbeatLoop) {
      clearInterval(this.heartbeatLoop);
      this.heartbeatLoop = null;
    }
  }

  /**
   * Validate authentication token
   * @param {string} token - Token to validate
   * @returns {boolean} - True if token is valid
   */
  validateToken(token) {
    if (!this.authToken) return false;
    return token === this.authToken;
  }

  /**
   * Handle authentication command
   * @param {WebSocket} ws - Client WebSocket
   * @param {Object} data - Command data with token
   * @returns {Object} - Authentication result
   */
  handleAuthenticate(ws, data) {
    const { token } = data;

    if (!token) {
      return { success: false, error: 'Token is required' };
    }

    if (this.validateToken(token)) {
      ws.isAuthenticated = true;
      this.authenticatedClients.add(ws);
      console.log(`[WebSocket] Client ${ws.clientId} authenticated successfully`);
      return { success: true, message: 'Authentication successful' };
    } else {
      console.log(`[WebSocket] Client ${ws.clientId} authentication failed`);
      return { success: false, error: 'Invalid token' };
    }
  }

  /**
   * Set authentication token at runtime
   * @param {string} token - New authentication token
   */
  setAuthToken(token) {
    this.authToken = token;
    this.requireAuth = token !== null;
    console.log(`[WebSocket] Auth token ${token ? 'set' : 'cleared'}, auth ${this.requireAuth ? 'enabled' : 'disabled'}`);
  }

  /**
   * Initialize rate limit data for a client
   * @param {string} clientId - Client identifier
   */
  initRateLimitData(clientId) {
    this.rateLimitData.set(clientId, {
      requestCount: 0,
      burstCount: 0,
      windowStart: Date.now(),
      lastRequest: Date.now()
    });
  }

  /**
   * Check if a client has exceeded the rate limit
   * @param {string} clientId - Client identifier
   * @returns {Object} - { allowed: boolean, error?: string, remaining?: number, resetIn?: number }
   */
  checkRateLimit(clientId) {
    if (!this.rateLimitEnabled) {
      return { allowed: true };
    }

    let data = this.rateLimitData.get(clientId);
    if (!data) {
      this.initRateLimitData(clientId);
      data = this.rateLimitData.get(clientId);
    }

    const now = Date.now();
    const windowElapsed = now - data.windowStart;

    // Reset counters if window has expired
    if (windowElapsed >= this.rateLimitWindow) {
      data.requestCount = 0;
      data.burstCount = 0;
      data.windowStart = now;
    }

    // Calculate effective limit (base limit + burst allowance)
    const effectiveLimit = this.maxRequestsPerMinute + this.burstAllowance;

    // Check if within limits
    if (data.requestCount < this.maxRequestsPerMinute) {
      // Within normal limit
      data.requestCount++;
      data.lastRequest = now;
      const remaining = this.maxRequestsPerMinute - data.requestCount;
      return {
        allowed: true,
        remaining,
        resetIn: this.rateLimitWindow - windowElapsed
      };
    } else if (data.requestCount < effectiveLimit) {
      // Within burst allowance
      data.requestCount++;
      data.burstCount++;
      data.lastRequest = now;
      const remaining = effectiveLimit - data.requestCount;
      console.log(`[WebSocket] Client ${clientId} using burst allowance (${data.burstCount}/${this.burstAllowance})`);
      return {
        allowed: true,
        remaining,
        resetIn: this.rateLimitWindow - windowElapsed,
        usingBurst: true,
        burstRemaining: this.burstAllowance - data.burstCount
      };
    } else {
      // Rate limit exceeded
      const resetIn = this.rateLimitWindow - windowElapsed;
      console.log(`[WebSocket] Client ${clientId} rate limited, reset in ${resetIn}ms`);
      return {
        allowed: false,
        error: `Rate limit exceeded. Maximum ${this.maxRequestsPerMinute} requests per ${this.rateLimitWindow / 1000} seconds (plus ${this.burstAllowance} burst). Try again in ${Math.ceil(resetIn / 1000)} seconds.`,
        remaining: 0,
        resetIn
      };
    }
  }

  /**
   * Get rate limit status for a client
   * @param {string} clientId - Client identifier
   * @returns {Object} - Current rate limit status
   */
  getRateLimitStatus(clientId) {
    if (!this.rateLimitEnabled) {
      return {
        enabled: false,
        message: 'Rate limiting is disabled'
      };
    }

    let data = this.rateLimitData.get(clientId);
    if (!data) {
      this.initRateLimitData(clientId);
      data = this.rateLimitData.get(clientId);
    }

    const now = Date.now();
    const windowElapsed = now - data.windowStart;
    const resetIn = Math.max(0, this.rateLimitWindow - windowElapsed);

    // If window has expired, show fresh limits
    if (windowElapsed >= this.rateLimitWindow) {
      return {
        enabled: true,
        requestCount: 0,
        maxRequestsPerMinute: this.maxRequestsPerMinute,
        burstAllowance: this.burstAllowance,
        burstUsed: 0,
        remaining: this.maxRequestsPerMinute,
        burstRemaining: this.burstAllowance,
        rateLimitWindow: this.rateLimitWindow,
        resetIn: this.rateLimitWindow,
        windowStart: now
      };
    }

    return {
      enabled: true,
      requestCount: data.requestCount,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      burstAllowance: this.burstAllowance,
      burstUsed: data.burstCount,
      remaining: Math.max(0, this.maxRequestsPerMinute - data.requestCount),
      burstRemaining: Math.max(0, this.burstAllowance - data.burstCount),
      rateLimitWindow: this.rateLimitWindow,
      resetIn,
      windowStart: data.windowStart,
      lastRequest: data.lastRequest
    };
  }

  /**
   * Clean up rate limit data for a client
   * @param {string} clientId - Client identifier
   */
  cleanupRateLimitData(clientId) {
    this.rateLimitData.delete(clientId);
  }

  /**
   * Enable or disable rate limiting at runtime
   * @param {boolean} enabled - Whether to enable rate limiting
   * @param {Object} options - Optional configuration overrides
   */
  setRateLimitEnabled(enabled, options = {}) {
    this.rateLimitEnabled = enabled;
    if (options.maxRequestsPerMinute !== undefined) {
      this.maxRequestsPerMinute = options.maxRequestsPerMinute;
    }
    if (options.rateLimitWindow !== undefined) {
      this.rateLimitWindow = options.rateLimitWindow;
    }
    if (options.burstAllowance !== undefined) {
      this.burstAllowance = options.burstAllowance;
    }
    console.log(`[WebSocket] Rate limiting ${enabled ? 'enabled' : 'disabled'} (max: ${this.maxRequestsPerMinute}/min, burst: ${this.burstAllowance})`);
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

    // ==========================================
    // Memory Management Commands
    // ==========================================

    /**
     * Get current memory usage statistics
     * Returns heap, RSS, external memory with MB values and percentages
     */
    this.commandHandlers.get_memory_usage = async (params) => {
      if (!this.memoryManager) return { success: false, error: 'Memory manager not available' };
      try {
        const usage = this.memoryManager.getMemoryUsage();
        const status = this.memoryManager.getMemoryStatus(usage);
        return {
          success: true,
          memory: {
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            external: usage.external,
            rss: usage.rss,
            arrayBuffers: usage.arrayBuffers,
            heapUsedMB: usage.heapUsedMB,
            heapTotalMB: usage.heapTotalMB,
            externalMB: usage.externalMB,
            rssMB: usage.rssMB,
            arrayBuffersMB: usage.arrayBuffersMB,
            heapUsedPercent: usage.heapUsedPercent
          },
          status,
          thresholds: this.memoryManager.thresholds,
          gcAvailable: this.memoryManager.isGCAvailable()
        };
      } catch (error) { return { success: false, error: error.message }; }
    };

    /**
     * Get memory statistics including peak usage, counts, and uptime
     */
    this.commandHandlers.get_memory_stats = async (params) => {
      if (!this.memoryManager) return { success: false, error: 'Memory manager not available' };
      try {
        const stats = this.memoryManager.getStats();
        return { success: true, ...stats };
      } catch (error) { return { success: false, error: error.message }; }
    };

    /**
     * Force garbage collection if available
     * Requires Node.js to be started with --expose-gc flag
     */
    this.commandHandlers.force_gc = async (params) => {
      if (!this.memoryManager) return { success: false, error: 'Memory manager not available' };
      const { full = true } = params || {};
      try {
        const result = this.memoryManager.triggerGC(full);
        return { success: result.success, ...result };
      } catch (error) { return { success: false, error: error.message }; }
    };

    /**
     * Clear various caches to free memory
     * Runs all registered cleanup callbacks and triggers GC
     */
    this.commandHandlers.clear_caches = async (params) => {
      if (!this.memoryManager) return { success: false, error: 'Memory manager not available' };
      try {
        const result = await this.memoryManager.runCleanup();
        return { success: true, ...result };
      } catch (error) { return { success: false, error: error.message }; }
    };

    /**
     * Start periodic memory monitoring
     * Optional interval parameter in milliseconds
     */
    this.commandHandlers.start_memory_monitoring = async (params) => {
      if (!this.memoryManager) return { success: false, error: 'Memory manager not available' };
      const { interval } = params || {};
      try {
        const result = this.memoryManager.startMonitoring(interval);
        return result;
      } catch (error) { return { success: false, error: error.message }; }
    };

    /**
     * Stop periodic memory monitoring
     */
    this.commandHandlers.stop_memory_monitoring = async (params) => {
      if (!this.memoryManager) return { success: false, error: 'Memory manager not available' };
      try {
        const result = this.memoryManager.stopMonitoring();
        return result;
      } catch (error) { return { success: false, error: error.message }; }
    };

    /**
     * Set custom memory thresholds
     * Parameters: warning (MB), critical (MB), cleanup (MB)
     */
    this.commandHandlers.set_memory_thresholds = async (params) => {
      if (!this.memoryManager) return { success: false, error: 'Memory manager not available' };
      const { warning, critical, cleanup } = params || {};
      if (!warning && !critical && !cleanup) {
        return { success: false, error: 'At least one threshold (warning, critical, or cleanup) is required' };
      }
      try {
        const result = this.memoryManager.setThresholds({ warning, critical, cleanup });
        return result;
      } catch (error) { return { success: false, error: error.message }; }
    };

    /**
     * Apply a preset threshold configuration
     * Parameters: preset (low, medium, high)
     */
    this.commandHandlers.apply_memory_preset = async (params) => {
      if (!this.memoryManager) return { success: false, error: 'Memory manager not available' };
      const { preset } = params || {};
      if (!preset) {
        return { success: false, error: 'Preset name is required (low, medium, high)' };
      }
      try {
        const result = this.memoryManager.applyPreset(preset);
        return result;
      } catch (error) { return { success: false, error: error.message }; }
    };

    /**
     * Get memory history entries
     * Optional limit parameter for number of entries
     */
    this.commandHandlers.get_memory_history = async (params) => {
      if (!this.memoryManager) return { success: false, error: 'Memory manager not available' };
      const { limit } = params || {};
      try {
        const history = this.memoryManager.getHistory(limit);
        return { success: true, history, count: history.length };
      } catch (error) { return { success: false, error: error.message }; }
    };

    /**
     * Reset memory statistics
     */
    this.commandHandlers.reset_memory_stats = async (params) => {
      if (!this.memoryManager) return { success: false, error: 'Memory manager not available' };
      try {
        const result = this.memoryManager.resetStats();
        return result;
      } catch (error) { return { success: false, error: error.message }; }
    };

    /**
     * Check memory now and return status
     * Will trigger cleanup if in critical state with autoCleanup enabled
     */
    this.commandHandlers.check_memory = async (params) => {
      if (!this.memoryManager) return { success: false, error: 'Memory manager not available' };
      try {
        const result = await this.memoryManager.checkMemory();
        return { success: true, ...result };
      } catch (error) { return { success: false, error: error.message }; }
    };

    // ==========================================
    // Error Recovery Commands
    // ==========================================

    /**
     * Get error recovery configuration and status
     */
    this.commandHandlers.get_recovery_config = async (params) => {
      return {
        success: true,
        config: {
          maxRetries: ERROR_RECOVERY_CONFIG.maxRetries,
          retryDelay: ERROR_RECOVERY_CONFIG.retryDelay,
          retryableErrorPatterns: ERROR_RECOVERY_CONFIG.retryableErrors,
          retryableCommands: ERROR_RECOVERY_CONFIG.retryableCommands
        }
      };
    };

    /**
     * Check if a specific command is retryable
     */
    this.commandHandlers.is_command_retryable = async (params) => {
      const { command } = params;
      if (!command) {
        return { success: false, error: 'Command name is required' };
      }

      return {
        success: true,
        command,
        retryable: isRetryableCommand(command),
        exists: command in this.commandHandlers
      };
    };

    /**
     * Get manager availability status
     * Useful for clients to check which features are available
     */
    this.commandHandlers.get_manager_status = async (params) => {
      return {
        success: true,
        managers: {
          sessionManager: this.sessionManager !== null,
          tabManager: this.tabManager !== null,
          cookieManager: this.cookieManager !== null,
          downloadManager: this.downloadManager !== null,
          blockingManager: this.blockingManager !== null,
          geolocationManager: this.geolocationManager !== null,
          networkThrottler: this.networkThrottler !== null,
          headerManager: this.headerManager !== null,
          scriptManager: this.scriptManager !== null,
          storageManager: this.storageManager !== null,
          historyManager: this.historyManager !== null,
          profileManager: this.profileManager !== null,
          devToolsManager: this.devToolsManager !== null,
          consoleManager: this.consoleManager !== null,
          screenshotManager: this.screenshotManager !== null,
          recordingManager: this.recordingManager !== null,
          domInspector: this.domInspector !== null,
          memoryManager: this.memoryManager !== null
        }
      };
    };

    /**
     * Execute a command with explicit retry, useful for one-off retries
     */
    this.commandHandlers.retry_command = async (params) => {
      const { command: targetCommand, params: targetParams, maxRetries = ERROR_RECOVERY_CONFIG.maxRetries } = params;

      if (!targetCommand) {
        return { success: false, error: 'Target command is required' };
      }

      if (!isRetryableCommand(targetCommand)) {
        return {
          success: false,
          error: `Command "${targetCommand}" is not safe to retry automatically`,
          suggestion: 'Only read-only (idempotent) commands can be retried automatically'
        };
      }

      // Execute with explicit retry
      const result = await this.executeWithRetry(
        { command: targetCommand, ...(targetParams || {}) },
        maxRetries
      );

      return result;
    };

    // ==========================================
    // Technology Detection Commands
    // ==========================================

    this.commandHandlers.detect_technologies = async (params) => {
      if (!this.technologyManager) {
        return { success: false, error: 'Technology manager not available', recovery: generateRecoverySuggestion('detect_technologies', null, 'technologyManager') };
      }

      // Get page content if not provided
      let pageData = params;
      if (!params.html && this.mainWindow) {
        try {
          const result = await this.mainWindow.webContents.executeJavaScript(`
            (() => {
              const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
              const meta = Array.from(document.querySelectorAll('meta')).map(m => ({
                name: m.getAttribute('name'),
                property: m.getAttribute('property'),
                content: m.getAttribute('content')
              }));
              return {
                url: window.location.href,
                html: document.documentElement.outerHTML,
                scripts,
                meta
              };
            })()
          `);
          pageData = { ...result, ...params };
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return await this.technologyManager.detectTechnologies(pageData);
    };

    this.commandHandlers.get_technology_categories = async (params) => {
      if (!this.technologyManager) {
        return { success: false, error: 'Technology manager not available' };
      }
      return this.technologyManager.getCategories();
    };

    this.commandHandlers.get_technology_info = async (params) => {
      if (!this.technologyManager) {
        return { success: false, error: 'Technology manager not available' };
      }
      if (!params.name) {
        return { success: false, error: 'Technology name is required' };
      }
      return this.technologyManager.getTechnologyInfo(params.name);
    };

    this.commandHandlers.search_technologies = async (params) => {
      if (!this.technologyManager) {
        return { success: false, error: 'Technology manager not available' };
      }
      if (!params.query) {
        return { success: false, error: 'Search query is required' };
      }
      return this.technologyManager.searchTechnologies(params.query, params.options);
    };

    // ==========================================
    // Content Extraction Commands
    // ==========================================

    this.commandHandlers.extract_metadata = async (params) => {
      if (!this.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }

      let html = params.html;
      let url = params.url || '';

      if (!html && this.mainWindow) {
        try {
          const result = await this.mainWindow.webContents.executeJavaScript(`
            ({ html: document.documentElement.outerHTML, url: window.location.href })
          `);
          html = result.html;
          url = url || result.url;
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return this.extractionManager.extractMetadata(html, url);
    };

    this.commandHandlers.extract_links = async (params) => {
      if (!this.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }

      let html = params.html;
      let baseUrl = params.baseUrl || params.url || '';

      if (!html && this.mainWindow) {
        try {
          const result = await this.mainWindow.webContents.executeJavaScript(`
            ({ html: document.documentElement.outerHTML, url: window.location.href })
          `);
          html = result.html;
          baseUrl = baseUrl || result.url;
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return this.extractionManager.extractLinks(html, baseUrl);
    };

    this.commandHandlers.extract_forms = async (params) => {
      if (!this.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }

      let html = params.html;

      if (!html && this.mainWindow) {
        try {
          html = await this.mainWindow.webContents.executeJavaScript(`document.documentElement.outerHTML`);
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return this.extractionManager.extractForms(html);
    };

    this.commandHandlers.extract_images = async (params) => {
      if (!this.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }

      let html = params.html;
      let baseUrl = params.baseUrl || params.url || '';

      if (!html && this.mainWindow) {
        try {
          const result = await this.mainWindow.webContents.executeJavaScript(`
            ({ html: document.documentElement.outerHTML, url: window.location.href })
          `);
          html = result.html;
          baseUrl = baseUrl || result.url;
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return this.extractionManager.extractImages(html, baseUrl);
    };

    this.commandHandlers.extract_scripts = async (params) => {
      if (!this.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }

      let html = params.html;
      let baseUrl = params.baseUrl || params.url || '';

      if (!html && this.mainWindow) {
        try {
          const result = await this.mainWindow.webContents.executeJavaScript(`
            ({ html: document.documentElement.outerHTML, url: window.location.href })
          `);
          html = result.html;
          baseUrl = baseUrl || result.url;
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return this.extractionManager.extractScripts(html, baseUrl);
    };

    this.commandHandlers.extract_stylesheets = async (params) => {
      if (!this.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }

      let html = params.html;
      let baseUrl = params.baseUrl || params.url || '';

      if (!html && this.mainWindow) {
        try {
          const result = await this.mainWindow.webContents.executeJavaScript(`
            ({ html: document.documentElement.outerHTML, url: window.location.href })
          `);
          html = result.html;
          baseUrl = baseUrl || result.url;
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return this.extractionManager.extractStylesheets(html, baseUrl);
    };

    this.commandHandlers.extract_structured_data = async (params) => {
      if (!this.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }

      let html = params.html;

      if (!html && this.mainWindow) {
        try {
          html = await this.mainWindow.webContents.executeJavaScript(`document.documentElement.outerHTML`);
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return this.extractionManager.extractStructuredData(html);
    };

    this.commandHandlers.extract_all = async (params) => {
      if (!this.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }

      let html = params.html;
      let url = params.url || '';

      if (!html && this.mainWindow) {
        try {
          const result = await this.mainWindow.webContents.executeJavaScript(`
            ({ html: document.documentElement.outerHTML, url: window.location.href })
          `);
          html = result.html;
          url = url || result.url;
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return this.extractionManager.extractAll(html, url);
    };

    this.commandHandlers.get_extraction_stats = async (params) => {
      if (!this.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }
      return { success: true, stats: this.extractionManager.stats };
    };

    // ==========================================
    // Network Analysis Commands
    // ==========================================

    this.commandHandlers.start_network_capture = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }

      let webContents = null;
      if (this.mainWindow) {
        webContents = this.mainWindow.webContents;
      }

      return this.networkAnalysisManager.startCapture(webContents);
    };

    this.commandHandlers.stop_network_capture = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return this.networkAnalysisManager.stopCapture();
    };

    this.commandHandlers.get_network_requests = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return this.networkAnalysisManager.getRequests(params.filter || {});
    };

    this.commandHandlers.get_request_details = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      if (!params.requestId) {
        return { success: false, error: 'Request ID is required' };
      }
      return this.networkAnalysisManager.getRequestDetails(params.requestId);
    };

    this.commandHandlers.get_response_headers = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      if (!params.requestId) {
        return { success: false, error: 'Request ID is required' };
      }
      return this.networkAnalysisManager.getResponseHeaders(params.requestId);
    };

    this.commandHandlers.get_security_info = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      if (!params.url) {
        return { success: false, error: 'URL is required' };
      }
      return this.networkAnalysisManager.getSecurityInfo(params.url, params.requestId);
    };

    this.commandHandlers.analyze_security_headers = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      if (!params.url) {
        return { success: false, error: 'URL is required' };
      }
      return this.networkAnalysisManager.analyzeSecurityHeaders(params.url, params.headers);
    };

    this.commandHandlers.get_resource_timing = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return this.networkAnalysisManager.getResourceTiming();
    };

    this.commandHandlers.get_requests_by_domain = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return this.networkAnalysisManager.getRequestsByDomain();
    };

    this.commandHandlers.get_slow_requests = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return this.networkAnalysisManager.getSlowRequests(params.thresholdMs || 1000);
    };

    this.commandHandlers.get_failed_requests = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return this.networkAnalysisManager.getFailedRequests();
    };

    this.commandHandlers.get_network_statistics = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return this.networkAnalysisManager.getStatistics();
    };

    this.commandHandlers.get_network_capture_status = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return this.networkAnalysisManager.getStatus();
    };

    this.commandHandlers.clear_network_capture = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return this.networkAnalysisManager.clearCapture();
    };

    this.commandHandlers.export_network_capture = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return this.networkAnalysisManager.exportCapture();
    };

    this.commandHandlers.get_requests_by_status = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      const minStatus = params.minStatus || 400;
      const maxStatus = params.maxStatus || 599;
      return this.networkAnalysisManager.getRequestsByStatusRange(minStatus, maxStatus);
    };

    this.commandHandlers.get_security_headers_list = async (params) => {
      if (!this.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return this.networkAnalysisManager.getSecurityHeadersList();
    };
  }

  /**
   * Handle incoming command with retry logic for transient failures
   * @param {Object} data - Command data
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Command result
   */
  async handleCommand(data, options = {}) {
    const { command, ...params } = data;
    const { enableRetry = true, maxRetries = ERROR_RECOVERY_CONFIG.maxRetries } = options;

    if (!command) {
      return { success: false, error: 'Command is required' };
    }

    const handler = this.commandHandlers[command];
    if (!handler) {
      const recovery = generateRecoverySuggestion(command, new Error(`Unknown command: ${command}`));
      return {
        success: false,
        error: `Unknown command: ${command}`,
        recovery: {
          ...recovery,
          suggestion: `The command "${command}" is not recognized. Check the command name and try again.`,
          availableCommands: Object.keys(this.commandHandlers).slice(0, 20) // Return first 20 commands as hint
        }
      };
    }

    let lastError = null;
    let attemptCount = 0;
    const canRetry = enableRetry && isRetryableCommand(command);

    // Execute with retry logic for idempotent commands
    while (attemptCount <= (canRetry ? maxRetries : 0)) {
      try {
        const result = await handler(params);

        // Check if the result indicates a manager unavailable error
        if (!result.success && result.error && result.error.includes('not available')) {
          const managerName = result.error.replace(' not available', '').replace(' manager', ' Manager');
          const recovery = generateRecoverySuggestion(command, result.error, managerName);
          return {
            ...result,
            recovery
          };
        }

        // If we had to retry and succeeded, include that info
        if (attemptCount > 0 && result.success) {
          result.retriedCount = attemptCount;
          console.log(`[WebSocket] Command ${command} succeeded after ${attemptCount} retry(ies)`);
        }

        return result;
      } catch (error) {
        lastError = error;
        attemptCount++;

        // Check if error is retryable and we have retries left
        if (canRetry && isRetryableError(error) && attemptCount <= maxRetries) {
          const delay = calculateRetryDelay(attemptCount - 1);
          console.log(`[WebSocket] Command ${command} failed (attempt ${attemptCount}/${maxRetries + 1}), retrying in ${delay}ms: ${error.message}`);
          await sleep(delay);
          continue;
        }

        // No more retries or non-retryable error
        break;
      }
    }

    // Generate recovery suggestion for the final error
    const recovery = generateRecoverySuggestion(command, lastError);

    // Log the failure
    console.error(`[WebSocket] Command ${command} failed after ${attemptCount} attempt(s): ${lastError.message}`);

    return {
      success: false,
      error: lastError.message,
      attemptCount,
      recovery
    };
  }

  /**
   * Execute a command with explicit retry options
   * @param {Object} data - Command data
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<Object>} Command result
   */
  async executeWithRetry(data, maxRetries = ERROR_RECOVERY_CONFIG.maxRetries) {
    return this.handleCommand(data, { enableRetry: true, maxRetries });
  }

  /**
   * Execute a command without retry (for non-idempotent operations)
   * @param {Object} data - Command data
   * @returns {Promise<Object>} Command result
   */
  async executeWithoutRetry(data) {
    return this.handleCommand(data, { enableRetry: false });
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
      authenticatedClients: this.authenticatedClients.size,
      port: this.port,
      authEnabled: this.requireAuth,
      heartbeatInterval: this.heartbeatInterval,
      heartbeatTimeout: this.heartbeatTimeout,
      ssl: {
        enabled: this.sslEnabled,
        active: this.sslActive,
        protocol: this.getProtocol(),
        connectionUrl: this.getConnectionUrl(),
        certPath: this.sslActive ? this.sslCertPath : null,
        keyPath: this.sslActive ? this.sslKeyPath : null,
        caPath: this.sslActive && this.sslCaPath ? this.sslCaPath : null,
        clientCertVerification: this.sslActive && this.sslCaPath ? true : false
      },
      errorRecovery: {
        enabled: true,
        maxRetries: ERROR_RECOVERY_CONFIG.maxRetries,
        retryDelay: ERROR_RECOVERY_CONFIG.retryDelay,
        retryableCommandCount: ERROR_RECOVERY_CONFIG.retryableCommands.length
      }
    };
  }

  close() {
    // Stop heartbeat monitoring
    this.stopHeartbeat();

    // Cleanup managers
    if (this.screenshotManager) {
      this.screenshotManager.cleanup();
    }
    if (this.recordingManager) {
      this.recordingManager.cleanup();
    }
    if (this.memoryManager) {
      this.memoryManager.cleanup();
    }

    if (this.wss) {
      this.clients.forEach((client) => {
        client.close();
      });
      this.wss.close();
      this.wss = null;
      this.authenticatedClients.clear();
      this.rateLimitData.clear();

      // Close HTTPS server if SSL was active
      if (this.httpsServer) {
        this.httpsServer.close();
        this.httpsServer = null;
        this.sslActive = false;
      }

      console.log('[WebSocket] Server closed');
    }
  }
}

module.exports = WebSocketServer;
