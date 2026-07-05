// WebSocketServer prototype mixin: initRateLimitData, checkRateLimit, getRateLimitStatus, checkConcurrentOperations, trackOperation, completeOperation, cleanupRateLimitData, setRateLimitEnabled.
// Extracted from server.js; methods keep `this` (attached to the prototype).
const D = require('./handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

module.exports = {
initRateLimitData(clientId) {
    this.rateLimitData.set(clientId, {
      requestCount: 0,
      burstCount: 0,
      windowStart: Date.now(),
      lastRequest: Date.now()
    });
  },

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
      this.logger.info(`[WebSocket] Client ${clientId} using burst allowance (${data.burstCount}/${this.burstAllowance})`);
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
      this.logger.info(`[WebSocket] Client ${clientId} rate limited, reset in ${resetIn}ms`);
      return {
        allowed: false,
        error: `Rate limit exceeded. Maximum ${this.maxRequestsPerMinute} requests per ${this.rateLimitWindow / 1000} seconds (plus ${this.burstAllowance} burst). Try again in ${Math.ceil(resetIn / 1000)} seconds.`,
        remaining: 0,
        resetIn
      };
    }
  },

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
  },

checkConcurrentOperations(clientId) {
    if (!this.clientOperations.has(clientId)) {
      this.clientOperations.set(clientId, { count: 0, operations: new Set() });
    }

    const opData = this.clientOperations.get(clientId);
    if (opData.count >= this.maxConcurrentOpsPerClient) {
      return {
        allowed: false,
        error: `Maximum concurrent operations (${this.maxConcurrentOpsPerClient}) exceeded for this client`,
        current: opData.count,
        max: this.maxConcurrentOpsPerClient
      };
    }

    return {
      allowed: true,
      current: opData.count,
      max: this.maxConcurrentOpsPerClient
    };
  },

trackOperation(clientId, operationId) {
    if (!this.clientOperations.has(clientId)) {
      this.clientOperations.set(clientId, { count: 0, operations: new Set() });
    }

    const opData = this.clientOperations.get(clientId);
    opData.count++;
    opData.operations.add(operationId);

    // Auto-cleanup operation after timeout
    setTimeout(() => {
      opData.operations.delete(operationId);
      opData.count = Math.max(0, opData.count - 1);
      if (opData.count === 0) {
        this.clientOperations.delete(clientId);
      }
    }, this.operationTimeout);
  },

completeOperation(clientId, operationId) {
    if (this.clientOperations.has(clientId)) {
      const opData = this.clientOperations.get(clientId);
      opData.operations.delete(operationId);
      opData.count = Math.max(0, opData.count - 1);
      if (opData.count === 0) {
        this.clientOperations.delete(clientId);
      }
    }
  },

cleanupRateLimitData(clientId) {
    if (clientId) {
      // Clean up specific client
      this.rateLimitData.delete(clientId);
    } else {
      // Global cleanup: remove entries older than 2x the rate limit window
      const now = Date.now();
      const maxAge = this.rateLimitWindow * 2;
      let cleanedCount = 0;

      for (const [id, data] of this.rateLimitData.entries()) {
        if (now - data.windowStart > maxAge) {
          this.rateLimitData.delete(id);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug(`[WebSocket] Rate limit cleanup: removed ${cleanedCount} old entries (age > ${maxAge}ms)`);
      }
    }
  },

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
    this.logger.info(`[WebSocket] Rate limiting ${enabled ? 'enabled' : 'disabled'} (max: ${this.maxRequestsPerMinute}/min, burst: ${this.burstAllowance})`);
  }
};
