const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { ipcMain } = require('electron');
const { humanDelay, humanType, humanMouseMove, humanScroll } = require('../evasion/humanize');
const { ScreenshotManager, validateAnnotation, applyAnnotationDefaults } = require('../screenshots/manager');
const { CompressedScreenshotCache } = require('../screenshots/cache');
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
const { SessionRecordingManager, RECORDING_STATE } = require('../recording/session-recorder');
const { ReplayEngine, REPLAY_STATE, ERROR_MODE } = require('../recording/replay');
const { headlessManager, HEADLESS_PRESETS } = require('../headless/manager');
const { WindowManager, WindowState } = require('../windows/manager');
const { WindowPool, PoolEntryState } = require('../windows/pool');
const { PluginManager, PLUGIN_STATE } = require('../plugins');
const { ConnectionPool } = require('./connection-pool');
const { CommandDispatcher } = require('./command-dispatcher');
const { ConnectionLifecycleManager } = require('./connection-manager');
const { WebSocketRateLimiter } = require('./rate-limiter'); // Rate limiting for security
const PriorityQueue = require('./priority-queue'); // OPT-1: Priority queue integration

// Logging and debugging
const {
  createLogger,
  defaultLogger,
  defaultProfiler,
  defaultMemoryMonitor,
  defaultDebugManager,
  LOG_LEVELS,
  LEVEL_NAMES,
  WebSocketTransport
} = require('../logging');

// Phase 3 Performance Optimizations (OPT-9, OPT-11, OPT-12)
const { getSerializer } = require('./response-serializer');
const { LazyManagerRegistry } = require('../src/managers/lazy-initializer');
const {
  initializeGCTuning,
  initializeAdvancedGCTuning,
  getAdaptiveGCManager
} = require('../utils/gc-tuning');

// P2-004: Cloudflare detection and handling
const { CloudflareDetector } = require('../src/cloudflare/detector');

// Security: Request size validation
const { RequestSizeValidator } = require('./request-validator');

// Security: Path validation
const { PathValidator, getInstance: getPathValidator } = require('../utils/path-validator');

// Error standardization
const { ErrorFormatter } = require('./error-formatter');

// HTTP Response decoration (Retry-After headers, rate limit headers)
const { HttpResponseDecorator } = require('./http-response-decorator');

// v12.9.0 Reliability & SLA Management
const { ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS } = require('./reliability-manager');
const { HealthEndpointManager } = require('./health-endpoint');

// v12.10.0 Self-Documenting API & Diagnostics
const { DiagnosticsAPI } = require('./diagnostics-api');

// Prometheus Metrics Collection
const { PrometheusMetricsCollector } = require('./metrics');

// v12.7.0 Feature Modules - Credentials, Session Persistence, Extended Evasion, Monitoring
const { registerCredentialsCommands } = require('./commands/credentials-commands');
const { registerSessionPersistenceCommands } = require('./commands/session-persistence-commands');
const { registerExtendedEvasionCommands } = require('./commands/extended-evasion-commands');
const { registerMonitoringMetricsCommands, registerConsentCommands } = require('./commands/monitoring-metrics-commands');
const { getConsentManager } = require('./middleware/monitoring-consent');
const { registerJavaScriptConsoleExtractionCommands } = require('./commands/javascript-console-extraction');

// v12.8.0 Feature Module - Complete DOM Snapshot Extraction
const { registerDOMSnapshotCommands } = require('./commands/dom-snapshot-commands');

// Phase 1 Forensic Commands - Data Extraction & Export/Analysis
// Feature Area 1: HTML Capture & DOM Snapshots
const { registerHtmlCaptureCommands } = require('./commands/html-capture-commands');

// Feature Area 2: Export Formats & Templates
const { registerExportFormatCommands } = require('./commands/export-formats');
const { registerExportTemplateCommands } = require('./commands/export-templates-commands');

// One-shot forensic capture (server-side macro: navigate + hash + manifest bundle)
const { registerForensicCaptureCommand } = require('./commands/forensic-capture-command');

// Feature Area 3: Batch Operations
const { registerBatchOperationsCommands } = require('./commands/batch-operations-commands');

// Feature Area 4: Correlation & Analysis
const { registerCorrelationCommands } = require('./commands/forensic/correlation/correlation-commands');

// Phase 2 P0 Commands - Legal Compliance, Evidence Correlation, Session Tracking
// Feature 1: Legal Compliance & Chain of Custody
const { registerLegalComplianceCommands } = require('./commands/forensic/legal/legal-compliance-commands');

// Feature 2: Evidence Correlation
const { registerEvidenceCorrelationCommands } = require('./commands/forensic/evidence/evidence-correlation-commands');

// Feature 3: Session Tracking
const { registerSessionTrackingCommands } = require('./commands/session-tracking-commands');

// Shared module-scope helpers + support classes (extracted to ./core/*)
const { isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl } = require('./core/url-guards');
const { IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout } = require('./core/timing');
const { ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion } = require('./core/retry');
const { StateSnapshot, StateRollbackManager, StatefulCommandHandler } = require('./core/state-management');

/**
 * WebSocket Server for Basset Hound Browser
 * Enables external control of the browser for automation and OSINT tasks
 * Supports session management, tab management, history, downloads, screenshots, and recording
 */
class WebSocketServer {
  constructor(port, mainWindow, options = {}) {
    this.port = port;
    // C-1: Listen address. Defaults to loopback-only so the control API is not
    // network-reachable by default. The `host` config from config/defaults.js is
    // now wired through from main.js; BASSET_WS_BIND is the explicit opt-in to
    // expose on other interfaces (e.g. BASSET_WS_BIND=0.0.0.0 for all interfaces
    // / container port-publishing).
    this.host = process.env.BASSET_WS_BIND || options.host || '127.0.0.1';
    this.mainWindow = mainWindow;
    this.wss = null;
    this.httpsServer = null; // HTTPS server for SSL/TLS support
    this.clients = new Set();
    this.commandHandlers = {};

    // SSL/TLS configuration (enabled by default in production, backwards compatible fallback)
    const defaultSslEnabled = process.env.NODE_ENV === 'production' ? true : false;
    this.sslEnabled = options.sslEnabled !== undefined ? options.sslEnabled :
      (process.env.BASSET_WS_SSL_ENABLED === 'true' ? true :
        (process.env.BASSET_WS_SSL_ENABLED === 'false' ? false : defaultSslEnabled));
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

    // Rate limiting configuration (ENABLED BY DEFAULT for security)
    // Can be disabled via RATE_LIMIT_ENABLED=false environment variable
    const enableRateLimit = options.rateLimitEnabled !== undefined
      ? options.rateLimitEnabled
      : (process.env.RATE_LIMIT_ENABLED !== 'false');

    this.rateLimitEnabled = enableRateLimit;
    this.maxRequestsPerMinute = options.maxRequestsPerMinute || 60;
    this.rateLimitWindow = options.rateLimitWindow || 60000; // 60 seconds (1 minute)
    this.burstAllowance = options.burstAllowance || 10; // Allow short bursts above the limit
    this.rateLimitData = new Map(); // Track request counts per client (legacy)

    // Initialize new WebSocket-specific rate limiter with sliding window
    this.rateLimiter = new WebSocketRateLimiter({
      enabled: enableRateLimit,
      unauthenticatedLimit: options.unauthenticatedLimit || 100,
      authenticatedLimit: options.authenticatedLimit || 1000,
      commandLimits: options.commandLimits,
      windowMs: options.windowMs || 60000,
      burstAllowance: options.burstAllowance || 10,
      adminBypass: options.adminBypass !== false,
      logger: this.logger
    });

    // HTTP Response decorator for setting Retry-After headers and rate limit headers
    this.httpResponseDecorator = HttpResponseDecorator;

    // EDGE CASE FIX #4: Per-client operation concurrency limits and tracking
    // Prevents resource exhaustion from rapid concurrent operations
    this.maxConcurrentOpsPerClient = options.maxConcurrentOpsPerClient || 20;
    this.clientOperations = new Map(); // Maps clientId -> { count: number, operations: Set }
    this.operationTimeout = options.operationTimeout || 120000; // 2 minutes

    // Initialize screenshot and recording managers
    this.screenshotManager = new ScreenshotManager(mainWindow);
    this.recordingManager = new RecordingManager(mainWindow);

    // Initialize screenshot cache with compression (OPT-02)
    const cacheDir = path.join(process.cwd(), 'tmp', '.basset-hound', 'screenshots');
    this.screenshotCache = new CompressedScreenshotCache(cacheDir);

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

    // Tor manager
    this.torManager = options.torManager || null;

    // Proxy chain manager
    this.proxyChainManager = options.proxyChainManager || null;

    // Headless mode manager
    this.headlessManager = options.headlessManager || headlessManager;

    // Window orchestration managers
    this.windowManager = options.windowManager || null;
    this.windowPool = options.windowPool || null;

    // Session recording and replay managers
    this.sessionRecordingManager = options.sessionRecordingManager || null;
    this.replayEngine = options.replayEngine || null;

    // Plugin manager
    this.pluginManager = options.pluginManager || null;

    // Update manager for auto-updates
    this.updateManager = options.updateManager || null;

    // Proxy intelligence managers (Wave 14)
    this.proxyIntelligence = options.proxyIntelligence || null;
    this.geoConsistencyEngine = options.geoConsistencyEngine || null;
    this.reputationScorer = options.reputationScorer || null;
    this.proxyAnalytics = options.proxyAnalytics || null;

    // Monitor manager (Wave 14)
    this.monitorManager = options.monitorManager || null;

    // Initialize Memory Manager (use global singleton or provided instance)
    this.memoryManager = options.memoryManager || memoryManager;
    this.memoryManager.setWebSocketServer(this);

    // Initialize State Rollback Manager for transactional state management
    this.stateManager = new StateRollbackManager(
      options.maxSnapshots || 50,
      options.snapshotTtlMs || 3600000 // 1 hour default
    );

    // Initialize Connection Lifecycle Manager for zombie connection cleanup
    this.connectionManager = new ConnectionLifecycleManager({
      gracePeriodMs: options.connectionGracePeriodMs || 300000, // 5 minutes
      checkIntervalMs: options.connectionCheckIntervalMs || 30000, // 30 seconds
      logger: this.logger,
      highZombieCount: options.highZombieConnectionCount || 10
    });
    this.zombieDetectionInterval = null;

    // Initialize Logging System
    this.logger = options.logger || defaultLogger.child('websocket');
    this.profiler = options.profiler || defaultProfiler;
    this.memoryMonitor = options.memoryMonitor || defaultMemoryMonitor;

    // P2-004: Initialize Cloudflare detector
    this.cloudflareDetector = options.cloudflareDetector || new CloudflareDetector(this.logger);
    this.debugManager = options.debugManager || defaultDebugManager;

    // Set WebSocket server reference for debug manager
    this.debugManager.setReferences({ wsServer: this });

    // Security: Initialize Request Size Validator
    this.requestSizeValidator = new RequestSizeValidator({
      logger: this.logger,
      limits: options.requestSizeLimits
    });

    // Initialize DOM Inspector
    this.domInspector = new DOMInspector(mainWindow);

    // Initialize request interceptor
    requestInterceptor.initialize();

    // Setup proxy authentication handler
    proxyManager.setupAuthHandler(mainWindow);

    // Set logger for state manager (after logger initialization)
    this.stateManager.logger = this.logger;

    // Initialize Monitoring Consent Manager (Security Fix #3)
    // Tracks user consent for monitoring before collecting metrics
    this.consentManager = getConsentManager();

    // Setup rollback listeners for different state types
    this._setupStateRollbackListeners();

    this.setupCommandHandlers();

    // Initialize Command Dispatcher (Phase 2 refactoring)
    this.commandDispatcher = new CommandDispatcher(this.commandHandlers, {
      logger: this.logger,
      profiler: this.profiler,
      debugManager: this.debugManager
    });

    // OPT-1: Initialize Priority Queue for command prioritization
    this.commandQueue = new PriorityQueue({
      maxQueueSize: 10000,
      enableAging: true,
      agingThreshold: 30000,
      fairnessRatio: 10
    });

    // Queue processor interval (processes queue every 10ms)
    this.queueProcessorInterval = null;

    // Phase 3 Performance Optimizations initialization (OPT-9, OPT-11, OPT-12)
    this.responseSerializer = null;
    this.lazyManagerRegistry = null;
    this.gcTuningCleanup = null;
    this.advancedGCStats = null;

    // v12.9.0: Initialize Reliability Manager (99%+ SLA guarantees)
    this.reliabilityManager = new ReliabilityManager({
      maxRetries: 3,
      commandTimeout: 30000, // 30 seconds base
      metricsWindow: 10000,
      maxRecentRequests: 5000,
      logger: this.logger
    });

    // v12.9.0: Initialize Health Endpoint Manager (SLA monitoring)
    this.healthEndpoint = new HealthEndpointManager({
      reliabilityManager: this.reliabilityManager,
      maxSamples: 1000,
      version: '12.9.0',
      logger: this.logger
    });

    // Register default health checks
    this.healthEndpoint.registerCheck('websocket', async () => ({
      ok: this.wss && this.wss.clients.size >= 0,
      message: `${this.wss ? this.wss.clients.size : 0} connected clients`
    }));

    // v12.10.0: Initialize Self-Documenting API (Diagnostics)
    this.diagnosticsAPI = new DiagnosticsAPI({
      version: '12.10.0',
      healthManager: this.healthEndpoint,
      logger: this.logger
    });
    this.logger.info('[WebSocket] DiagnosticsAPI initialized - Users can query /api/help for documentation');

    // Initialize Prometheus Metrics Collector
    this.metricsCollector = new PrometheusMetricsCollector();
    this.logger.info('[WebSocket] Prometheus Metrics initialized - Metrics available at GET /metrics');

    this.start();
  }

  /**
   * Set the session manager
   * @param {SessionManager} manager - Session manager instance
   */
  setSessionManager(manager) {
    this.sessionManager = manager;
    this.logger.info('[WebSocket] Session manager attached');
  }

  /**
   * Set the tab manager
   * @param {TabManager} manager - Tab manager instance
   */
  setTabManager(manager) {
    this.tabManager = manager;
    this.logger.info('[WebSocket] Tab manager attached');
  }

  /**
   * Setup rollback listeners for different state types
   * These handlers are called when a rollback is needed
   */
  

  /**
   * Check if a port is available (not in use)
   * @param {number} port - Port to check
   * @returns {Promise<boolean>} True if port is available
   */
  

  /**
   * Find the next available port starting from the given port
   * @param {number} startPort - Port to start searching from
   * @param {number} maxAttempts - Maximum ports to try (default 10)
   * @returns {Promise<number>} First available port
   */
  

  

  /**
   * Ensure the desired port is available, find alternative if not
   * @returns {Promise<number>} The port to use (either requested port or next available)
   */
  

  /**
   * Create a composite HTTP request handler that handles both diagnostics and health endpoints
   * @returns {Function} HTTP request handler
   * @private
   */
  

  /**
   * Start a non-SSL WebSocket server
   * @param {number} port - Port to listen on
   * @param {object} compressionConfig - Compression configuration
   */
  

  /**
   * Start the WebSocket server on the given port
   * @param {number} port - Port to listen on
   * @param {object} compressionConfig - Compression configuration
   */
  

  /**
   * Initialize Phase 3 Performance Optimizations (OPT-9, OPT-11, OPT-12)
   * - OPT-11: Response Serializer with template caching and buffer pooling
   * - OPT-9: Lazy Manager Registry for deferred initialization
   * - OPT-12: Advanced GC Tuning with adaptive garbage collection
   * @private
   */
  

  /**
   * Send a response through the optimized serializer (OPT-11)
   * Falls back to direct JSON.stringify if serializer not available
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} responseData - Response data to send
   * @param {string} templateName - Optional template name for pre-compiled responses
   * @private
   */
  

  /**
   * Standardize an error response to conform to the unified error schema
   * Ensures all error responses have required fields and proper formatting
   *
   * @param {Object} errorResponse - The error response object
   * @returns {Object} Standardized error response
   * @private
   */
  

  /**
   * Get recovery hint for an error code
   * Loads from the recovery hints mapping
   *
   * @param {string} errorCode - Error code
   * @returns {string} Recovery hint
   * @private
   */
  

  /**
   * Load SSL certificates from the configured paths
   * @returns {Object} SSL options for https.createServer
   * @throws {Error} If certificates cannot be loaded
   * @private
   */
  

  /**
   * Check if SSL/TLS is currently active
   * @returns {boolean} True if SSL is active
   */
  

  /**
   * Get the WebSocket protocol based on SSL status
   * @returns {string} 'wss' if SSL is active, 'ws' otherwise
   */
  

  /**
   * Get the full connection URL for the WebSocket server
   * @param {string} [hostname='localhost'] - The hostname to use in the URL
   * @returns {string} Full connection URL (e.g., wss://localhost:8765)
   */
  

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

    // Validate and sanitize inputs to prevent command injection
    // Validate commonName: only allow alphanumeric, dots, hyphens (valid DNS characters)
    if (typeof commonName !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(commonName)) {
      throw new Error('Invalid commonName: must contain only alphanumeric characters, dots, and hyphens');
    }
    if (commonName.length > 253) {
      throw new Error('Invalid commonName: maximum length is 253 characters');
    }

    // Validate days: must be a positive integer
    const daysNum = parseInt(days, 10);
    if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 3650) {
      throw new Error('Invalid days: must be an integer between 1 and 3650');
    }

    // Validate keySize: only allow specific secure key sizes
    const allowedKeySizes = [2048, 3072, 4096];
    const keySizeNum = parseInt(keySize, 10);
    if (!allowedKeySizes.includes(keySizeNum)) {
      throw new Error(`Invalid keySize: must be one of ${allowedKeySizes.join(', ')}`);
    }

    // Validate outputDir: must be an absolute path within expected directories
    const resolvedDir = path.resolve(outputDir);
    if (resolvedDir.includes('..') || !path.isAbsolute(resolvedDir)) {
      throw new Error('Invalid outputDir: must be an absolute path without directory traversal');
    }

    // Ensure output directory exists
    if (!fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true });
    }

    const keyPath = path.join(resolvedDir, 'server.key');
    const certPath = path.join(resolvedDir, 'server.crt');

    // Check if openssl is available
    try {
      execSync('openssl version', { stdio: 'ignore' });
    } catch (error) {
      throw new Error('OpenSSL is required to generate self-signed certificates. Please install OpenSSL and try again.');
    }

    try {
      // Generate private key and self-signed certificate using spawn for safety
      // Use execFileSync instead of execSync to avoid shell interpretation
      const { execFileSync } = require('child_process');

      execFileSync('openssl', [
        'req', '-x509',
        '-newkey', `rsa:${keySizeNum}`,
        '-keyout', keyPath,
        '-out', certPath,
        '-days', String(daysNum),
        '-nodes',
        '-subj', `/CN=${commonName}`,
        '-addext', `subjectAltName=DNS:${commonName},DNS:localhost,IP:127.0.0.1`
      ], { stdio: 'pipe' });

      defaultLogger.info(`[WebSocket] Self-signed certificate generated:`);
      defaultLogger.info(`  Certificate: ${certPath}`);
      defaultLogger.info(`  Private Key: ${keyPath}`);
      defaultLogger.info(`  Valid for: ${days} days`);
      defaultLogger.info(`  Common Name: ${commonName}`);

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
   * Enhanced with zombie connection detection and forced cleanup
   */
  

  /**
   * Stop heartbeat monitoring and zombie detection
   */
  

  /**
   * Check for zombie connections and force terminate them
   * Called periodically during heartbeat cycle
   * @private
   */
  

  /**
   * Start queue processor - OPT-1 Priority Queue processing
   * Continuously processes queued commands based on priority
   */
  

  /**
   * Stop queue processor
   */
  

  /**
   * Process a queued command - OPT-1
   * @private
   */
  

  /**
   * Validate authentication token using constant-time comparison to prevent timing attacks
   * @param {string} token - Token to validate
   * @returns {boolean} - True if token is valid
   */
  

  /**
   * Handle authentication command
   * @param {WebSocket} ws - Client WebSocket
   * @param {Object} data - Command data with token
   * @returns {Object} - Authentication result
   */
  

  /**
   * Set authentication token at runtime
   * @param {string} token - New authentication token
   */
  

  /**
   * Initialize rate limit data for a client
   * @param {string} clientId - Client identifier
   */
  

  /**
   * Check if a client has exceeded the rate limit
   * @param {string} clientId - Client identifier
   * @returns {Object} - { allowed: boolean, error?: string, remaining?: number, resetIn?: number }
   */
  

  /**
   * Get rate limit status for a client
   * @param {string} clientId - Client identifier
   * @returns {Object} - Current rate limit status
   */
  

  /**
   * EDGE CASE FIX #4: Check if client has exceeded concurrent operation limit
   * Prevents resource exhaustion from rapid concurrent operations
   */
  

  /**
   * Track a new operation for a client
   */
  

  /**
   * Mark operation as complete (for explicit tracking)
   */
  

  /**
   * Clean up rate limit data for a client or perform global cleanup
   * @param {string} [clientId] - Client identifier (optional). If not provided, performs global cleanup
   */
  

  /**
   * Enable or disable rate limiting at runtime
   * @param {boolean} enabled - Whether to enable rate limiting
   * @param {Object} options - Optional configuration overrides
   */
  

  /**
   * Fetch the live page HTML from the active <webview> guest.
   *
   * The extract_* / detect_* commands historically read
   * `this.mainWindow.webContents.executeJavaScript('document.documentElement.outerHTML')`,
   * but that runs against the empty browser SHELL, not the <webview> where pages
   * actually load — so extraction always saw an empty document. This routes through
   * the same 'get-page-content' IPC that get_content uses, which the renderer answers
   * from getActiveWebview() (see renderer/renderer.js onGetPageContent).
   *
   * @returns {Promise<{success: boolean, html?: string, url?: string, text?: string, title?: string, error?: string}>}
   */
  

  setupCommandHandlers() {
    // Navigate to URL
    // 54 handlers (navigate .. close_tab) -> ./commands/core-cmds-01.js
    const { registerCoreCmds01 } = require('./commands/core-cmds-01.js');
    registerCoreCmds01(this);


    // Switch to a tab
    // 56 handlers (switch_tab .. force_terminate_connection) -> ./commands/core-cmds-02.js
    const { registerCoreCmds02 } = require('./commands/core-cmds-02.js');
    registerCoreCmds02(this);


    // Request new Tor identity (circuit)
    // 8 handlers (new_tor_identity .. get_tor_mode) -> ./commands/core-cmds-03.js
    const { registerCoreCmds03 } = require('./commands/core-cmds-03.js');
    registerCoreCmds03(this);

    // Advanced Tor Integration Commands (extracted to ./commands/core-tor-commands.js)
    const { registerCoreTorCommands } = require('./commands/core-tor-commands');
    registerCoreTorCommands(this);


    // ==========================================
    // Proxy Chain Commands
    // ==========================================

    // Set proxy chain
    // 56 handlers (set_proxy_chain .. mouse_drag) -> ./commands/core-cmds-04.js
    const { registerCoreCmds04 } = require('./commands/core-cmds-04.js');
    registerCoreCmds04(this);


    // Hover at position
    // 55 handlers (mouse_hover .. inspect_element) -> ./commands/core-cmds-05.js
    const { registerCoreCmds05 } = require('./commands/core-cmds-05.js');
    registerCoreCmds05(this);


    // 53 handlers (get_element_tree .. extract_images) -> ./commands/core-cmds-06.js
    const { registerCoreCmds06 } = require('./commands/core-cmds-06.js');
    registerCoreCmds06(this);


    // 47 handlers (extract_scripts .. step_replay) -> ./commands/core-cmds-07.js
    const { registerCoreCmds07 } = require('./commands/core-cmds-07.js');
    registerCoreCmds07(this);


    /**
     * Skip current action during replay
     */
    // 67 handlers (skip_replay_action .. unload_plugin) -> ./commands/core-cmds-08.js
    const { registerCoreCmds08 } = require('./commands/core-cmds-08.js');
    registerCoreCmds08(this);


    /**
     * Reload a plugin
     * @param {string} name - Plugin name to reload
     */
    // 12 handlers (reload_plugin .. get_plugin_hooks) -> ./commands/core-cmds-09.js
    const { registerCoreCmds09 } = require('./commands/core-cmds-09.js');
    registerCoreCmds09(this);


    // ==========================================
    // Image Metadata Commands (Phase 14)
    // ==========================================

    // Import and register image metadata commands
    const { registerImageCommands } = require('./commands/image-commands');
    registerImageCommands(this, this.mainWindow);

    // Register screenshot commands (Phase 21)
    const { registerScreenshotCommands } = require('./commands/screenshot-commands');
    registerScreenshotCommands(this, this.mainWindow);

    // Register network forensics commands (Phase 19)
    const { registerNetworkForensicsCommands } = require('./commands/forensic/network/network-forensics-commands');
    // Preserve the core session-cookie-jar get_cookies handler (defined in
    // setupCommandHandlers above -> cookieManager.getCookies): the forensics module
    // registers its OWN get_cookies backed by the network-capture collector and keyed on
    // params.filter, which silently clobbers the standard command. That override made
    // `get_cookies { url }` always return 0 (it ignored `url` and read a different store).
    const _sessionGetCookies = this.commandHandlers.get_cookies;
    registerNetworkForensicsCommands(this.commandHandlers);
    // Keep the forensic (network-capture) variant reachable under a distinct name, then
    // restore the standard get_cookies so `get_cookies { url }` returns the Electron
    // session cookies applicable to that URL (see cookies/manager.js getCookies()).
    if (_sessionGetCookies && this.commandHandlers.get_cookies !== _sessionGetCookies) {
      this.commandHandlers.get_cookies_network = this.commandHandlers.get_cookies;
      this.commandHandlers.get_cookies = _sessionGetCookies;
    }

    // Register page monitoring commands (Phase 25)
    const { registerMonitoringCommands } = require('./commands/monitoring-commands');
    registerMonitoringCommands(this, this.mainWindow);

    // Register smart form filling commands (Phase 22)
    const { registerFormCommands } = require('./commands/form-commands');
    registerFormCommands(this, this.mainWindow);

    // Register profile template commands (Phase 23)
    const { registerProfileTemplateCommands } = require('./commands/profile-template-commands');
    registerProfileTemplateCommands(this, this.mainWindow);

    // Register evasion commands (Phase 17)
    const { registerEvasionCommands } = require('./commands/evasion-commands');
    registerEvasionCommands(this.commandHandlers, (script) => {
      return this.executeInRenderer(script);
    });

    // Phase 24: Proxy Pool Commands - MIGRATED TO basset-hound-networking
    // Proxy rotation and pool management has been moved to a separate package.
    // Use basic proxy setting via proxy/manager.js instead.

    // Register advanced cookie management commands (Phase 27)
    const { registerCookieCommands } = require('./commands/cookie-commands');
    registerCookieCommands(this, this.mainWindow);

    // Register multi-page management commands (Phase 28)
    const { registerMultiPageCommands } = require('./commands/multi-page-commands');
    registerMultiPageCommands(this, this.mainWindow);

    // Phase 29: Evidence Chain Commands - REMOVED (out of scope)
    // Investigation management belongs in external systems (palletai, basset-hound)
    // Basic evidence capture is available via evidence-commands.js

    // Register geolocation/location simulation commands (Phase 30)
    const { registerLocationCommands } = require('./commands/location-commands');
    registerLocationCommands(this, this.mainWindow);

    // Register data extraction template commands (Phase 31)
    const { registerExtractionCommands } = require('./commands/extraction-commands');
    registerExtractionCommands(this, this.mainWindow);

    // Register competitor monitoring service (Phase 26)
    const { MonitoringService } = require('../src/monitoring/monitoring-service');
    const { registerCompetitorMonitoringCommands } = require('./commands/competitor-monitoring-commands');

    // Initialize monitoring service
    const monitoringService = new MonitoringService({
      dataDir: this.dataDir || './data/monitoring',
      enableAutoCheck: true,
      checkInterval: 3600000 // 1 hour default
    });

    // Register commands with the service
    registerCompetitorMonitoringCommands(this.commandHandlers, monitoringService);

    // Register extended features commands (Phase 3 v12.5.0)
    const { registerExtendedFeatureCommands } = require('./commands/extended-features-commands');
    registerExtendedFeatureCommands(this, this.mainWindow);

    // Wave 14: Register command aliases for standard naming scheme
    // Monitor management (8)
    // 23 handlers (add_monitor .. clear_all_monitors) -> ./commands/core-cmds-10.js
    const { registerCoreCmds10 } = require('./commands/core-cmds-10.js');
    registerCoreCmds10(this);


    // Store reference for cleanup
    this.monitoringService = monitoringService;

    // ==========================================
    // Phase 26: Advanced Monitoring Commands
    // ==========================================
    const { registerAdvancedMonitoringCommands } = require('./commands/monitoring-advanced');
    registerAdvancedMonitoringCommands(this, this.mainWindow);

    // ==========================================
    // Phase 27: Performance Metrics Commands
    // ==========================================
    const { registerPerformanceMetricsCommands } = require('./commands/performance-metrics');
    registerPerformanceMetricsCommands(this, this.mainWindow);

    // ==========================================
    // Phase 28: Session Management Commands
    // ==========================================
    const { registerSessionManagementCommands } = require('./commands/session-management');
    registerSessionManagementCommands(this, this.mainWindow);

    // ==========================================
    // Phase 29: Advanced Analytics Commands
    // ==========================================
    const { registerAdvancedAnalyticsCommands } = require('./commands/analytics-advanced');
    registerAdvancedAnalyticsCommands(this, this.mainWindow);

    // ==========================================
    // Wave 14: Proxy Intelligence Commands
    // ==========================================

    // Get proxy reputation score and health metrics
    // 25 handlers (get_proxy_reputation .. get_rollback_versions) -> ./commands/core-cmds-11.js
    const { registerCoreCmds11 } = require('./commands/core-cmds-11.js');
    registerCoreCmds11(this);


    // ==========================================
    // v12.7.0 FEATURE COMMANDS - Phase 1 Integration
    // ==========================================
    // Feature 1: Credentials (TOTP/HOTP)
    registerCredentialsCommands(this.commandHandlers);
    this.logger.info('[WebSocket] Registered 6 credentials commands (TOTP/HOTP)');

    // Feature 2: Session Persistence (State Capture/Restore)
    registerSessionPersistenceCommands(this.commandHandlers, this.mainWindow);
    this.logger.info('[WebSocket] Registered 6 session persistence commands');

    // Feature 3: Extended Evasion (TLS, HTTP/2, Timing, Network)
    registerExtendedEvasionCommands(this.commandHandlers);
    this.logger.info('[WebSocket] Registered 6 extended evasion commands');

    // Feature 4: Monitoring & Metrics
    registerMonitoringMetricsCommands(this.commandHandlers, null, this);
    this.logger.info('[WebSocket] Registered 10 monitoring/metrics commands');

    // Feature 4B: Monitoring Consent Management (Security Fix #3)
    registerConsentCommands(this.commandHandlers, this.consentManager);
    this.logger.info('[WebSocket] Registered 6 monitoring consent commands');

    // Feature 5: JavaScript & Console Extraction
    registerJavaScriptConsoleExtractionCommands(this.commandHandlers, {
      consoleManager: this.consoleManager,
      devToolsManager: this.devToolsManager,
      storageManager: this.storageManager,
      logger: this.logger
    });
    this.logger.info('[WebSocket] Registered 10 JavaScript/console extraction commands');

    // ==========================================
    // INTERACTION RECORDING COMMANDS (Phase 20)
    // ==========================================
    const { registerRecordingCommands } = require('./commands/recording-commands');
    registerRecordingCommands(this.commandHandlers);

    // ==========================================
    // VIDEO RECORDING COMMANDS (Phase 21)
    // ==========================================
    const { registerVideoRecordingCommands } = require('./commands/video-recording-commands');
    registerVideoRecordingCommands(this.commandHandlers, this.mainWindow);

    // ==========================================
    // DOM SNAPSHOT EXTRACTION COMMANDS (v12.8.0)
    // ==========================================
    registerDOMSnapshotCommands(this.commandHandlers, this.mainWindow, {
      logger: this.logger
    });
    this.logger.info('[WebSocket] Registered 7 DOM snapshot extraction commands');

    // ==========================================
    // PHASE 1 FORENSIC COMMANDS - DATA EXTRACTION
    // ==========================================
    // Feature Area 1: HTML Capture (4 commands)
    registerHtmlCaptureCommands(this);
    this.logger.info('[WebSocket] Registered 4 HTML capture commands');

    // ==========================================
    // PHASE 1 FORENSIC COMMANDS - EXPORT & ANALYSIS
    // ==========================================
    // Feature Area 2a: Export Formats (8 commands)
    registerExportFormatCommands(this, {
      networkAnalysisManager: this.networkAnalysisManager
    });
    this.logger.info('[WebSocket] Registered 8 export format commands');

    // One-shot forensic capture command (orchestrates existing handlers)
    registerForensicCaptureCommand(this, { networkAnalysisManager: this.networkAnalysisManager });

    // Feature Area 2b: Export Templates (6 commands)
    registerExportTemplateCommands(this, {});
    this.logger.info('[WebSocket] Registered 6 export template commands');

    // Feature Area 3: Batch Operations (7 commands)
    registerBatchOperationsCommands(this, this.mainWindow);
    this.logger.info('[WebSocket] Registered 7 batch operations commands');

    // Feature Area 4: Correlation & Analysis (8 commands)
    registerCorrelationCommands(this, this.mainWindow);
    this.logger.info('[WebSocket] Registered 8 correlation/analysis commands');

    // Total Phase 1 Forensic Commands: 21 (Data Extraction) + 29 (Export & Analysis) = 50 commands
    this.logger.info('[WebSocket] ==========================================');

    // ==========================================
    // Phase 2 P0 Commands - Legal/Evidence/Session
    // ==========================================

    // Feature 1: Legal Compliance & Chain of Custody (6 commands)
    registerLegalComplianceCommands(this, this.mainWindow);
    this.logger.info('[WebSocket] Registered 6 legal compliance commands');

    // Feature 2: Evidence Correlation (5 commands)
    registerEvidenceCorrelationCommands(this, this.mainWindow);
    this.logger.info('[WebSocket] Registered 5 evidence correlation commands');

    // Feature 3: Session Tracking (3 commands)
    registerSessionTrackingCommands(this, this.mainWindow);
    this.logger.info('[WebSocket] Registered 3 session tracking commands');

    // Phase 2 P0 Commands Total: 6 + 5 + 3 = 14 commands
    this.logger.info('[WebSocket] PHASE 2 P0 COMMANDS - TOTAL: 14 commands');
    this.logger.info('[WebSocket]   - Legal Compliance: 6 commands');
    this.logger.info('[WebSocket]   - Evidence Correlation: 5 commands');
    this.logger.info('[WebSocket]   - Session Tracking: 3 commands');

    this.logger.info('[WebSocket] PHASE 1 FORENSIC COMMANDS - TOTAL: 50 commands');
    this.logger.info('[WebSocket]   - Data Extraction: 21 commands');
    this.logger.info('[WebSocket]   - Export & Analysis: 29 commands');
    this.logger.info('[WebSocket] ==========================================');

    // ==========================================
    // v12.9.0 FEATURE COMMANDS - Compression + Forensic Analysis
    // ==========================================
    // Wire the Adaptive Compression Engine + Forensic Analyzer (deterministic
    // SHA-256 hashing, chain-of-custody, artifact integrity verification) into
    // the live command dispatcher. The registration was defined but never
    // invoked, leaving these commands unreachable at runtime.
    // Scope: compression + forensic ONLY (no orchestration / model-based tools,
    // per docs/SCOPE.md). Guarded so a registration failure never blocks boot.
    try {
      const {
        initializeV12_9_0Engines,
        registerV12_9_0Commands
      } = require('./commands/v12-9-0-integration-commands');
      initializeV12_9_0Engines();
      registerV12_9_0Commands(this.commandHandlers);
      this.logger.info('[WebSocket] Registered 14 v12.9.0 commands (5 compression + 8 forensic + 1 reset)');
    } catch (v12_9_0Err) {
      this.logger.error('[WebSocket] Failed to register v12.9.0 commands: ' + (v12_9_0Err && v12_9_0Err.message));
    }
  }

  /**
   * Setup progress notifications for update downloads
   * @param {WebSocket} ws - WebSocket client
   */
  

  /**
   * Handle incoming command with retry logic for transient failures
   * @param {Object} data - Command data
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Command result
   */
  

  /**
   * Execute a command with explicit retry options
   * @param {Object} data - Command data
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<Object>} Command result
   */
  

  /**
   * Execute a command without retry (for non-idempotent operations)
   * @param {Object} data - Command data
   * @returns {Promise<Object>} Command result
   */
  

  

  

  
}

Object.assign(WebSocketServer.prototype, require('./core/transport'));

Object.assign(WebSocketServer.prototype, require('./core/ratelimit'));

Object.assign(WebSocketServer.prototype, require('./core/heartbeat'));

Object.assign(WebSocketServer.prototype, require('./core/dispatch'));

Object.assign(WebSocketServer.prototype, require('./core/startup'));

module.exports = WebSocketServer;
