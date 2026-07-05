// WebSocketServer prototype mixin: _setupStateRollbackListeners, _initializePhase3Optimizations, _sendResponse, _standardizeErrorResponse, _getRecoveryHint, setupUpdateProgressNotifications, getWebviewPageContent, handleCommand, executeWithRetry, executeWithoutRetry, validateToken, handleAuthenticate, setAuthToken.
// Extracted from server.js; methods keep `this` (attached to the prototype).
const D = require('./handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

module.exports = {
_setupStateRollbackListeners() {
    // Proxy rollback listener
    this.stateManager.registerRollbackListener('proxy', async (snapshot) => {
      if (!snapshot.stateData.config) {
        return;
      }
      const config = snapshot.stateData.config;
      await proxyManager.setProxy({
        host: config.host,
        port: config.port,
        type: config.proxyType,
        auth: config.auth,
        bypassRules: config.bypassRules
      });
      this.logger.info('[StateRollback] Proxy configuration restored');
    });

    // Tor mode rollback listener
    this.stateManager.registerRollbackListener('tor_mode', async (snapshot) => {
      if (!snapshot.stateData.torMode) {
        return;
      }
      await proxyManager.setTorMasterMode(snapshot.stateData.torMode, {
        socksHost: snapshot.stateData.socksHost,
        socksPort: snapshot.stateData.socksPort
      });
      this.logger.info('[StateRollback] Tor mode restored');
    });

    // Navigation rollback listener
    this.stateManager.registerRollbackListener('navigation', async (snapshot) => {
      if (!snapshot.stateData.currentUrl) {
        return;
      }
      this.mainWindow.webContents.send('navigate-webview', snapshot.stateData.currentUrl);
      this.logger.info('[StateRollback] Navigation restored');
    });

    // Storage rollback listener (localStorage)
    this.stateManager.registerRollbackListener('localStorage', async (snapshot) => {
      // Storage rollback is handled via custom rollback functions in command handlers
      this.logger.info('[StateRollback] LocalStorage rollback triggered');
    });

    // Storage rollback listener (sessionStorage)
    this.stateManager.registerRollbackListener('sessionStorage', async (snapshot) => {
      // Storage rollback is handled via custom rollback functions in command handlers
      this.logger.info('[StateRollback] SessionStorage rollback triggered');
    });

    // Periodic cleanup of expired snapshots
    setInterval(() => {
      this.stateManager.clearExpiredSnapshots();
    }, 300000); // Every 5 minutes

    this.logger.info('[WebSocket] State rollback listeners configured');
  },

_initializePhase3Optimizations() {
    const startTime = Date.now();

    try {
      // Initialize Response Serializer (OPT-11)
      this.responseSerializer = getSerializer({
        poolSize: 32,
        bufferSize: 8192,
        enableStats: true,
        largePayloadThreshold: 65536
      });
      this.logger.debug('[Phase3:OPT-11] Response Serializer initialized', {
        poolSize: 32,
        bufferSize: '8KB',
        templates: 5
      });

      // Initialize Lazy Manager Registry (OPT-9)
      this.lazyManagerRegistry = new LazyManagerRegistry();
      this.logger.debug('[Phase3:OPT-9] Lazy Manager Registry initialized');

      // Initialize basic GC tuning (OPT-12 Part 1)
      this.gcTuningCleanup = initializeGCTuning({
        maxHeapSize: 512,
        enableGCMonitoring: true,
        enablePeriodicCleanup: true,
        cleanupInterval: 60000
      });
      this.logger.debug('[Phase3:OPT-12] Basic GC Tuning initialized');

      // Initialize advanced GC tuning (OPT-12 Part 2)
      this.advancedGCStats = initializeAdvancedGCTuning({
        memoryThreshold: 0.85,
        aggressiveGCAt: 0.95,
        adjustInterval: 5000,
        verbose: false
      });
      this.logger.debug('[Phase3:OPT-12] Advanced GC Tuning initialized');

      const elapsed = Date.now() - startTime;
      this.logger.info('[Phase3] All optimizations initialized', {
        elapsed: `${elapsed}ms`,
        components: ['ResponseSerializer', 'LazyManagerRegistry', 'GCTuning'],
        status: 'ready'
      });
    } catch (error) {
      this.logger.error('[Phase3] Failed to initialize optimizations', {
        error: error.message,
        stack: error.stack
      });
    }
  },

_sendResponse(ws, responseData, templateName = null) {
    // Validate and standardize error responses
    if (responseData.success === false) {
      // This is an error response - ensure it conforms to the standard schema
      const standardizedError = this._standardizeErrorResponse(responseData);
      responseData = standardizedError;
    }

    try {
      let serialized;
      if (this.responseSerializer) {
        // NOTE: template-based serialization (OPT-11) is lossy — ResponseTemplate.fill()
        // only copies the template's own keys, dropping `id`, `content`, `url`, etc. from
        // the actual response. That leaves clients unable to match replies (every command
        // appears to hang). Serialize the full response object directly to preserve all
        // fields. templateName is intentionally ignored here.
        serialized = this.responseSerializer.serialize(responseData, null);
        ws.send(serialized);
      } else {
        // Fallback for initialization phase
        serialized = JSON.stringify(responseData);
        ws.send(serialized);
      }
      // Record metrics: message sent
      this.metricsCollector.recordMessageSent(serialized ? serialized.length : 0);
    } catch (error) {
      this.logger.error('[ErrorResponse] Error sending response', {
        error: error.message,
        clientId: ws.clientId
      });
      this.metricsCollector.recordMessageError();
      // Attempt fallback send
      try {
        const fallbackSerialized = JSON.stringify(responseData);
        ws.send(fallbackSerialized);
        // Record metrics: message sent (fallback)
        this.metricsCollector.recordMessageSent(fallbackSerialized ? fallbackSerialized.length : 0);
      } catch (fallbackError) {
        this.logger.error('[ErrorResponse] Failed to send response via fallback', {
          error: fallbackError.message
        });
        this.metricsCollector.recordMessageError();
      }
    }
  },

_standardizeErrorResponse(errorResponse) {
    // Default values for error responses
    const standardized = {
      success: false,
      error: errorResponse.error || 'An error occurred',
      errorCode: errorResponse.errorCode || 'SYSTEM_INTERNAL_ERROR',
      command: errorResponse.command || 'unknown',
      id: errorResponse.id === undefined ? null : errorResponse.id,
      recoveryHint: errorResponse.recoveryHint || this._getRecoveryHint(errorResponse.errorCode)
    };

    // Include details if provided and not empty
    if (errorResponse.details && Object.keys(errorResponse.details).length > 0) {
      standardized.details = errorResponse.details;
    }

    // Validate the standardized response
    const validation = ErrorFormatter.validateErrorResponse(standardized);
    if (!validation.valid) {
      this.logger.warn('[ErrorResponse] Standardized error response failed validation', {
        errors: validation.errors,
        response: standardized
      });
    }

    return standardized;
  },

_getRecoveryHint(errorCode) {
    try {
      // Try to load recovery hints if not already cached
      if (!this._recoveryHints) {
        const hintsPath = path.join(__dirname, 'ERROR-RECOVERY-HINTS.json');
        const content = fs.readFileSync(hintsPath, 'utf8');
        this._recoveryHints = JSON.parse(content);
      }

      const hint = this._recoveryHints[errorCode];
      return hint ? hint.hint : 'Please check the error details and try again.';
    } catch (error) {
      this.logger.debug('[ErrorResponse] Failed to load recovery hints', {
        errorCode,
        error: error.message
      });
      return 'Please check the error details and try again.';
    }
  },

validateToken(token) {
    if (!this.authToken) {
      return false;
    }

    try {
      // Use constant-time comparison to prevent timing attacks
      // This prevents attackers from inferring token length/content through response timing
      return crypto.timingSafeEqual(
        Buffer.from(token || ''),
        Buffer.from(this.authToken)
      );
    } catch (err) {
      // Catches length mismatches (both buffers must be equal length)
      // Safer to return false for any mismatch condition
      return false;
    }
  },

handleAuthenticate(ws, data) {
    const { token } = data;

    if (!token) {
      return { success: false, error: 'Token is required' };
    }

    if (this.validateToken(token)) {
      ws.isAuthenticated = true;
      this.authenticatedClients.add(ws);
      this.logger.info(`[WebSocket] Client ${ws.clientId} authenticated successfully`);
      return { success: true, message: 'Authentication successful' };
    } else {
      this.logger.info(`[WebSocket] Client ${ws.clientId} authentication failed`);
      return { success: false, error: 'Invalid token' };
    }
  },

setAuthToken(token) {
    this.authToken = token;
    this.requireAuth = token !== null;
    this.logger.info(`[WebSocket] Auth token ${token ? 'set' : 'cleared'}, auth ${this.requireAuth ? 'enabled' : 'disabled'}`);
  },

async getWebviewPageContent() {
    const timeout = calculateAdaptiveTimeout('get_content');
    const result = await ipcWithTimeout(
      this.mainWindow.webContents,
      'get-page-content',
      'page-content-response',
      null, // no data parameter
      timeout
    );
    // Normalize: get_content responds with { success, content, html, text, title, url }
    if (result && result.success && !result.html && result.content) {
      result.html = result.content;
    }
    return result;
  },

setupUpdateProgressNotifications(ws) {
    if (!this.updateManager) {
      return;
    }

    const progressHandler = (progress) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'update_progress',
          data: progress
        }));
      }
    };

    const statusHandler = (info) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'update_status',
          data: {
            status: this.updateManager.status,
            info
          }
        }));
      }
    };

    const errorHandler = (error) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'update_error',
          data: error
        }));
      }
    };

    // Register event handlers
    this.updateManager.on('downloading', progressHandler);
    this.updateManager.on('downloaded', statusHandler);
    this.updateManager.on('error', errorHandler);

    // Cleanup on connection close
    ws.on('close', () => {
      this.updateManager.off('downloading', progressHandler);
      this.updateManager.off('downloaded', statusHandler);
      this.updateManager.off('error', errorHandler);
    });
  },

async handleCommand(data, options = {}) {
    const { command, id, ...params } = data;
    const { enableRetry = true, maxRetries = ERROR_RECOVERY_CONFIG.maxRetries } = options;

    if (!command) {
      return ErrorFormatter.formatError({
        errorCode: 'VALIDATION_MISSING_REQUIRED_PARAM',
        error: 'Command is required',
        command: 'unknown',
        id,
        details: { parameter: 'command' }
      });
    }

    const handler = this.commandHandlers[command];
    if (!handler) {
      return ErrorFormatter.formatError({
        errorCode: 'COMMAND_NOT_FOUND',
        error: `Unknown command: ${command}`,
        command: command || 'unknown',
        id,
        details: {
          providedCommand: command,
          availableCommandsCount: Object.keys(this.commandHandlers).length,
          availableCommandsSample: Object.keys(this.commandHandlers).slice(0, 10)
        }
      });
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
          this.logger.info(`[WebSocket] Command ${command} succeeded after ${attemptCount} retry(ies)`);
        }

        return result;
      } catch (error) {
        lastError = error;
        attemptCount++;

        // Check if error is retryable and we have retries left
        if (canRetry && isRetryableError(error) && attemptCount <= maxRetries) {
          const delay = calculateRetryDelay(attemptCount - 1);
          this.logger.info(`[WebSocket] Command ${command} failed (attempt ${attemptCount}/${maxRetries + 1}), retrying in ${delay}ms: ${error.message}`);
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
    this.logger.error(`[WebSocket] Command ${command} failed after ${attemptCount} attempt(s): ${lastError.message}`);

    return {
      success: false,
      error: lastError.message,
      attemptCount,
      recovery
    };
  },

async executeWithRetry(data, maxRetries = ERROR_RECOVERY_CONFIG.maxRetries) {
    return this.handleCommand(data, { enableRetry: true, maxRetries });
  },

async executeWithoutRetry(data) {
    return this.handleCommand(data, { enableRetry: false });
  }
};
