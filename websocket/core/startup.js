// WebSocketServer prototype mixin: start, broadcast, getStatus, close.
// Extracted from server.js; methods keep `this` (attached to the prototype).
const D = require('./handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

module.exports = {
start() {
    // WebSocket compression configuration (OPT-04: Enhanced compression tuning)
    const compressionConfig = {
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 8,
          level: 4 // OPT-04: Optimized for balance (was 3, tuned to 4)
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 15, // OPT-04: Full 32KB window (was 10, now 15 for better compression)
        concurrencyLimit: 10,
        threshold: 1024 // Only compress messages > 1KB
      }
    };

    // P2-003: Handle port conflicts by finding available port
    this._ensurePortAvailability()
      .then((availablePort) => {
        this._startWebSocketServer(availablePort, compressionConfig);
      })
      .catch((error) => {
        this.logger.error(`[WebSocket] Failed to start server: ${error.message}`);
      });
  },

broadcast(message) {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  },

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
  },

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
    if (this.sessionRecordingManager) {
      this.sessionRecordingManager.cleanup();
    }
    if (this.replayEngine) {
      this.replayEngine.cleanup();
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

      // Stop monitoring service if running
      if (this.monitoringService) {
        this.monitoringService.stop();
        this.monitoringService = null;
      }

      // Close HTTPS server if SSL was active
      if (this.httpsServer) {
        this.httpsServer.close();
        this.httpsServer = null;
        this.sslActive = false;
      }

      this.logger.info('[WebSocket] Server closed');
    }
  }
};
