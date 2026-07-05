// WebSocketServer prototype mixin: _isPortAvailable, _findAvailablePort, _ensurePortAvailability, _createCompositeHttpHandler, _startNonSSLServer, _startWebSocketServer, _loadSslCertificates, isSslEnabled, getProtocol, getConnectionUrl.
// Extracted from server.js; methods keep `this` (attached to the prototype).
const D = require('./handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

module.exports = {
async _isPortAvailable(port) {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();

      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port, this.host);
    });
  },

async _findAvailablePort(startPort, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;
      if (await this._isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`Could not find available port after ${maxAttempts} attempts starting from ${startPort}`);
  },

async _ensurePortAvailability() {
    const initialPort = this.port;
    const isAvailable = await this._isPortAvailable(initialPort);

    if (isAvailable) {
      this.logger.info(`[WebSocket P2-003] Port ${initialPort} is available`);
      return initialPort;
    }

    this.logger.warn(`[WebSocket P2-003] Port ${initialPort} is already in use, finding alternative...`);
    const availablePort = await this._findAvailablePort(initialPort + 1, 10);
    this.port = availablePort;
    this.logger.info(`[WebSocket P2-003] Using alternative port: ${availablePort} (requested: ${initialPort})`);
    return availablePort;
  },

_createCompositeHttpHandler() {
    return async (req, res) => {
      try {
        const url = req.url || '/';

        // Route to Prometheus metrics endpoint
        if (url === '/metrics') {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(this.metricsCollector.getMetricsText());
          return;
        }

        // Route to JSON metrics endpoint (alternative)
        if (url === '/metrics.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.metricsCollector.getMetricsJSON(), null, 2));
          return;
        }

        // Route to diagnostics API for /api/* paths
        if (url.startsWith('/api/')) {
          const diagnosticsHandler = this.diagnosticsAPI.createHttpHandler();
          return diagnosticsHandler(req, res);
        }

        // Fall through to health endpoint for /health paths
        if (url.startsWith('/health')) {
          const healthHandler = this.healthEndpoint.createHttpHandler();
          return healthHandler(req, res);
        }

        // All other paths - return 404 with available endpoints
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Not found',
          availableEndpoints: {
            metrics: {
              prometheus: 'GET /metrics',
              json: 'GET /metrics.json'
            },
            api: {
              help: 'GET /api/help',
              diagnostics: 'GET /api/diagnostics',
              status: 'GET /api/status',
              schema: 'GET /api/schema'
            },
            health: {
              full: 'GET /health',
              liveness: 'GET /health/live',
              readiness: 'GET /health/ready',
              metrics: 'GET /health/metrics'
            }
          }
        }, null, 2));
      } catch (error) {
        this.logger.error(`[WebSocket] Composite HTTP handler error: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }, null, 2));
      }
    };
  },

_startNonSSLServer(port, compressionConfig) {
    try {
      // P2-003: Use http.createServer with explicit error handling
      const http = require('http');
      const server = http.createServer();

      // v12.10.0: Attach composite handler (diagnostics + health)
      server.on('request', this._createCompositeHttpHandler());

      this.wss = new WebSocket.Server({
        server: server,
        maxPayload: 100 * 1024 * 1024, // 100 MB global limit
        ...compressionConfig
      });

      // P2-003: Handle listen errors with fallback ports
      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          this.logger.error(`[WebSocket P2-003] Port ${port} became unavailable, retrying...`);
          this._ensurePortAvailability()
            .then((newPort) => {
              server.listen(newPort);
            })
            .catch((retryError) => {
              this.logger.error(`[WebSocket] Failed to find alternative port: ${retryError.message}`);
            });
        } else {
          this.logger.error(`[WebSocket] HTTP server error: ${error.message}`);
        }
      });

      server.listen(port, this.host);
      this.sslActive = false;
      this.logger.info(`[WebSocket] Listening on ws://${this.host}:${port}`);
      this.logger.info('[WebSocket] Message compression (perMessageDeflate) enabled');

      if (this.sslEnabled && (!this.sslCertPath || !this.sslKeyPath)) {
        this.logger.warn('[WebSocket] SSL enabled but certificate/key paths not provided. Running without SSL.');
      }
    } catch (error) {
      this.logger.error(`[WebSocket] Failed to create non-SSL server: ${error.message}`);
    }
  },

_startWebSocketServer(port, compressionConfig) {
    // Determine if we should use SSL/TLS
    if (this.sslEnabled && this.sslCertPath && this.sslKeyPath) {
      try {
        const sslOptions = this._loadSslCertificates();
        this.httpsServer = https.createServer(sslOptions);

        // v12.10.0: Attach composite handler (diagnostics + health) to HTTPS server
        this.httpsServer.on('request', this._createCompositeHttpHandler());

        this.wss = new WebSocket.Server({
          server: this.httpsServer,
          maxPayload: 100 * 1024 * 1024, // 100 MB global limit
          ...compressionConfig
        });

        // P2-003: Handle listen errors with fallback ports
        this.httpsServer.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            this.logger.error(`[WebSocket P2-003] Port ${port} became unavailable, retrying...`);
            this._ensurePortAvailability()
              .then((newPort) => {
                this.httpsServer.listen(newPort);
              })
              .catch((retryError) => {
                this.logger.error(`[WebSocket] Failed to find alternative port: ${retryError.message}`);
              });
          } else {
            this.logger.error(`[WebSocket] HTTPS server error: ${error.message}`);
          }
        });

        this.httpsServer.listen(port, this.host);
        this.sslActive = true;
        this.logger.info(`[WebSocket] SSL/TLS enabled with certificate: ${this.sslCertPath}`);
        this.logger.info(`[WebSocket] Listening on wss://${this.host}:${port}`);
        this.logger.info('[WebSocket] Message compression (perMessageDeflate) enabled');
      } catch (error) {
        this.logger.error(`[WebSocket] Failed to load SSL certificates: ${error.message}`);
        this.logger.info('[WebSocket] Falling back to non-SSL mode');
        this._startNonSSLServer(port, compressionConfig);
      }
    } else {
      this._startNonSSLServer(port, compressionConfig);
    }

    // Verify WebSocket server was created successfully
    if (!this.wss) {
      this.logger.error('Failed to create WebSocket server');
      return;
    }

    // Start heartbeat monitoring
    this.startHeartbeat();

    // OPT-1: Start queue processor for priority-based command handling
    this.startQueueProcessor();

    this.wss.on('connection', (ws, req) => {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      ws.clientId = clientId;
      ws.isAlive = true;
      ws.lastHeartbeat = Date.now();
      ws.upgradeRequest = req; // Store HTTP upgrade request for TLS/security checks
      this.clients.add(ws);

      // Register connection with lifecycle manager for zombie detection
      this.connectionManager.registerConnection(clientId, ws, false);

      // Record metrics: connection opened
      this.metricsCollector.recordConnectionOpened();
      ws.connectionStartTime = Date.now();

      // Check for token in query string or headers for immediate authentication
      const protocol = this.sslActive ? 'https' : 'http';
      const urlParams = new URL(req.url, `${protocol}://localhost:${this.port}`).searchParams;
      const queryToken = urlParams.get('token');
      const headerToken = req.headers['authorization']?.replace('Bearer ', '');
      const providedToken = queryToken || headerToken;

      if (providedToken && this.validateToken(providedToken)) {
        ws.isAuthenticated = true;
        this.authenticatedClients.add(ws);
        this.logger.info(`Client authenticated via token: ${clientId}`);
      } else {
        ws.isAuthenticated = !this.requireAuth;
      }

      this.logger.info(`Client connected: ${clientId}`, {
        remoteAddress: req.socket.remoteAddress,
        authenticated: ws.isAuthenticated,
        ssl: this.sslActive
      });

      // Connection status is available via status command, not sent automatically
      // This prevents response format inconsistency where first message differs from command responses

      // Handle pong responses for heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
        ws.lastHeartbeat = Date.now();
        this.connectionManager.recordPong(clientId);
      });

      ws.on('message', async (message) => {
        try {
          // Record activity for zombie detection
          this.connectionManager.recordActivity(clientId);

          // Record metrics: message received
          this.metricsCollector.recordMessageReceived(message.length || 0);

          // Security: Validate request size before parsing
          const sizeValidation = this.requestSizeValidator.validateMessageSize(
            message,
            'unknown' // Command not yet parsed
          );

          // Record metrics: request size validation
          this.metricsCollector.recordRequestSizeValidation(message.length || 0, !sizeValidation.valid);

          if (!sizeValidation.valid) {
            this.metricsCollector.recordMessageError();
            this._sendResponse(ws, ErrorFormatter.payloadTooLargeError(
              sizeValidation.actual,
              sizeValidation.limit,
              'unknown',
              null,
              false
            ));
            this.logger.warn(`Size validation failed: ${sizeValidation.error}`);
            return;
          }

          const data = JSON.parse(message.toString());

          // Validate command-specific size limit
          const commandSizeValidation = this.requestSizeValidator.validateMessageSize(
            message,
            data.command || 'unknown'
          );

          if (!commandSizeValidation.valid) {
            this._sendResponse(ws, ErrorFormatter.payloadTooLargeError(
              commandSizeValidation.actual,
              commandSizeValidation.limit,
              data.command,
              data.id,
              true
            ));
            this.logger.warn(`Command '${data.command}' request size validation failed: ${commandSizeValidation.error}`);
            return;
          }

          // Handle authentication command
          if (data.command === 'authenticate') {
            const authResult = this.handleAuthenticate(ws, data);
            this._sendResponse(ws, {
              id: data.id,
              command: 'authenticate',
              ...authResult
            }, authResult.success ? 'success' : 'error');
            return;
          }

          // Check authentication for all other commands
          if (this.requireAuth && !ws.isAuthenticated) {
            this._sendResponse(ws, ErrorFormatter.authRequiredError(data.command, data.id));
            return;
          }

          // Handle get_rate_limit_status command without counting against rate limit
          if (data.command === 'get_rate_limit_status') {
            const status = this.getRateLimitStatus(ws.clientId);
            this._sendResponse(ws, {
              id: data.id,
              command: 'get_rate_limit_status',
              success: true,
              ...status
            }, 'success');
            return;
          }

          // Check rate limit before processing command
          const rateLimitResult = this.checkRateLimit(ws.clientId);
          if (!rateLimitResult.allowed) {
            // Record metrics: rate limit exceeded
            this.metricsCollector.recordRateLimitEvent(true);
            this.metricsCollector.recordClientRateLimited();
            this._sendResponse(ws, ErrorFormatter.rateLimitError(rateLimitResult, data.command, data.id));
            return;
          }
          // Record metrics: rate limit check passed
          this.metricsCollector.recordRateLimitEvent(false);

          // EDGE CASE FIX #4: Check concurrent operation limits per client
          const concurrencyCheck = this.checkConcurrentOperations(ws.clientId);
          if (!concurrencyCheck.allowed) {
            this._sendResponse(ws, ErrorFormatter.concurrencyLimitError(concurrencyCheck, data.command, data.id));
            return;
          }

          // Log command reception
          this.logger.debug(`Received command: ${data.command}`, { id: data.id, clientId: ws.clientId });
          this.debugManager.logWebSocket('command', data, ws.clientId);

          // Track operation for concurrency monitoring
          const operationId = `${ws.clientId}:${data.id || Date.now()}`;
          this.trackOperation(ws.clientId, operationId);

          try {
            // Start profiling timer for command execution
            const timerName = `cmd:${data.command}:${data.id || Date.now()}`;
            this.profiler.startTimer(timerName, { command: data.command, clientId: ws.clientId });

            // v12.9.0: Wrap command execution with reliability manager for automatic retries and metrics
            const { command, id, ...params } = data;
            const reliabilityResult = await this.reliabilityManager.execute(
              command,
              async () => {
                return await this.commandDispatcher.execute(command, params, {
                  enableRetry: true,
                  maxRetries: ERROR_RECOVERY_CONFIG.maxRetries,
                  clientId: ws.clientId,
                  commandId: id,
                  upgradeRequest: ws.upgradeRequest,
                  remoteAddress: req.socket.remoteAddress
                });
              },
              {
                timeout: calculateAdaptiveTimeout(command)
              }
            );

            // End profiling timer
            const timing = this.profiler.endTimer(timerName);

            // Handle reliability manager result
            let response;
            if (reliabilityResult.success) {
              response = reliabilityResult.result;
              // Record successful command in health endpoint
              this.healthEndpoint.recordCommand(command, reliabilityResult.latency, false);
              // Record metrics: successful command execution
              this.metricsCollector.recordCommandExecution(command, reliabilityResult.latency || 0, true);
            } else {
              // Record failed command in health endpoint
              this.healthEndpoint.recordCommand(command, reliabilityResult.latency, true);
              // Record metrics: failed command execution
              this.metricsCollector.recordCommandExecution(command, reliabilityResult.latency || 0, false);
              response = {
                success: false,
                error: reliabilityResult.error,
                attempts: reliabilityResult.attempts,
                latency: reliabilityResult.latency,
                retried: reliabilityResult.retried,
                timedOut: reliabilityResult.timedOut,
                suggestion: reliabilityResult.timedOut
                  ? 'Command execution timeout - the operation took longer than expected'
                  : 'Command failed after retries - check server health or try again'
              };
            }

            // Log response
            this.logger.debug(`Command response: ${command}`, {
              id: id,
              success: response.success,
              duration: timing ? timing.duration : null,
              attempts: reliabilityResult.attempts
            });
            this.debugManager.logWebSocket('response', { ...response, command: command, id: id }, ws.clientId);
            const templateName = response.success ? 'success' : 'error';
            // Envelope: spread the command response FIRST, then stamp the real
            // request id/command LAST so they win. Some formatters (e.g.
            // ErrorFormatter.validationError) inject `id: null`; if the spread came
            // last it would clobber the real request id and break client correlation.
            this._sendResponse(ws, {
              ...response,
              id: id,
              command: command
            }, templateName);
          } finally {
            // Always mark operation as complete
            this.completeOperation(ws.clientId, operationId);
          }
        } catch (error) {
          // EDGE CASE FIX #3: Malformed JSON recovery and detailed error reporting
          this.logger.error(`Error processing message: ${error.message}`, { error, message: message.toString().substring(0, 200) });
          this.debugManager.logError(error, { clientId: ws.clientId, message: message.toString().substring(0, 200) });

          // Determine error type and provide appropriate response
          let errorCode = 'INTERNAL_ERROR';
          let errorDetails = null;

          if (error instanceof SyntaxError) {
            errorCode = 'MALFORMED_JSON';
            errorDetails = { parseError: error.message };
          } else if (error.message.includes('Cannot read')) {
            errorCode = 'INVALID_MESSAGE_FORMAT';
            errorDetails = { missingField: 'command' };
          }

          // Send detailed error response to help client recovery
          this._sendResponse(ws, {
            success: false,
            error: error.message,
            errorCode,
            details: errorDetails,
            // Include request echoing first 100 chars for debugging
            requestSample: message.toString().substring(0, 100)
          }, 'error');

          // Server continues to accept new commands (doesn't close connection)
        }
      });

      ws.on('close', () => {
        try {
          // Record metrics: connection closed
          const connectionDuration = ws.connectionStartTime ? Date.now() - ws.connectionStartTime : 0;
          this.metricsCollector.recordConnectionClosed(connectionDuration);

          // Unregister from connection lifecycle manager
          this.connectionManager.unregisterConnection(clientId);

          // Remove from client sets
          this.clients.delete(ws);
          this.authenticatedClients.delete(ws);

          // Cleanup rate limit data
          this.cleanupRateLimitData(ws.clientId);

          // EDGE CASE FIX #5: Clean up any pending operations for this client
          this.clientOperations.delete(ws.clientId);

          // Remove all event listeners to prevent memory leaks
          ws.removeAllListeners();

          // Clear client-specific properties
          ws.clientId = null;
          ws.isAlive = null;
          ws.lastHeartbeat = null;
          ws.isAuthenticated = null;

          this.logger.info(`Client disconnected and cleaned up: ${clientId}`);
        } catch (error) {
          this.logger.error(`Error during client cleanup (${clientId}): ${error.message}`, { error });
        }
      });

      ws.on('error', (error) => {
        try {
          this.logger.error(`Client error (${clientId}): ${error.message}`, { error });

          // Unregister from connection lifecycle manager
          this.connectionManager.unregisterConnection(clientId);

          // Remove from client sets
          this.clients.delete(ws);
          this.authenticatedClients.delete(ws);

          // Cleanup rate limit data
          this.cleanupRateLimitData(ws.clientId);

          // EDGE CASE FIX #5: Clean up any pending operations for this client
          this.clientOperations.delete(ws.clientId);

          // Remove all event listeners
          ws.removeAllListeners();

          // Clear client-specific properties
          ws.clientId = null;
          ws.isAlive = null;
          ws.lastHeartbeat = null;
          ws.isAuthenticated = null;

          // Attempt to close the connection if still open
          if (ws.readyState === ws.OPEN) {
            ws.close(1011, 'Internal server error');
          }

          this.logger.info(`Client error handled and cleaned up: ${clientId}`);
        } catch (err) {
          this.logger.error(`Error during error handling cleanup: ${err.message}`, { error: err });
        }
      });
    });

    this.wss.on('error', (error) => {
      this.logger.error(`Server error: ${error.message}`, { error });
    });

    // Initialize Phase 3 performance optimizations (OPT-9, OPT-11, OPT-12)
    this._initializePhase3Optimizations();

    const authStatus = this.requireAuth ? 'enabled' : 'disabled';
    const rateLimitStatus = this.rateLimitEnabled ? `enabled (${this.maxRequestsPerMinute}/min, burst: ${this.burstAllowance})` : 'disabled';
    const sslStatus = this.sslActive ? 'enabled' : 'disabled';
    this.logger.info(`Server started on ${this.getConnectionUrl()}`, { auth: authStatus, ssl: sslStatus, rateLimit: rateLimitStatus });
  },

_loadSslCertificates() {
    const pathValidator = getPathValidator();

    // Validate certificate path exists
    if (!fs.existsSync(this.sslCertPath)) {
      throw new Error(`SSL certificate file not found: ${this.sslCertPath}`);
    }

    // Validate key path exists
    if (!fs.existsSync(this.sslKeyPath)) {
      throw new Error(`SSL private key file not found: ${this.sslKeyPath}`);
    }

    // Validate paths are within allowed directories
    const certValidation = pathValidator.validatePath(this.sslCertPath, 'read');
    if (!certValidation.valid) {
      throw new Error(`SSL certificate path validation failed: ${certValidation.error}`);
    }

    const keyValidation = pathValidator.validatePath(this.sslKeyPath, 'read');
    if (!keyValidation.valid) {
      throw new Error(`SSL private key path validation failed: ${keyValidation.error}`);
    }

    let cert, key, ca;

    try {
      cert = fs.readFileSync(certValidation.realPath);
    } catch (error) {
      throw new Error(`Failed to read SSL certificate: ${error.message}`);
    }

    try {
      key = fs.readFileSync(keyValidation.realPath);
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
        this.logger.warn(`[WebSocket] CA certificate file not found: ${this.sslCaPath}. Client verification disabled.`);
      } else {
        // Validate CA path
        const caValidation = pathValidator.validatePath(this.sslCaPath, 'read');
        if (!caValidation.valid) {
          this.logger.warn(`[WebSocket] CA certificate path validation failed: ${caValidation.error}. Client verification disabled.`);
        } else {
          try {
            ca = fs.readFileSync(caValidation.realPath);
            sslOptions.ca = ca;
            sslOptions.requestCert = true;
            sslOptions.rejectUnauthorized = true;
            this.logger.info(`[WebSocket] Client certificate verification enabled with CA: ${this.sslCaPath}`);
          } catch (error) {
            this.logger.warn(`[WebSocket] Failed to read CA certificate: ${error.message}. Client verification disabled.`);
          }
        }
      }
    }

    return sslOptions;
  },

isSslEnabled() {
    return this.sslActive;
  },

getProtocol() {
    return this.sslActive ? 'wss' : 'ws';
  },

getConnectionUrl(hostname = 'localhost') {
    return `${this.getProtocol()}://${hostname}:${this.port}`;
  }
};
