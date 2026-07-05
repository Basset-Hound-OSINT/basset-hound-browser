// WebSocketServer prototype mixin: startHeartbeat, stopHeartbeat, _checkForZombieConnections, startQueueProcessor, stopQueueProcessor, _processQueuedCommand.
// Extracted from server.js; methods keep `this` (attached to the prototype).
const D = require('./handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

module.exports = {
startHeartbeat() {
    let cleanupCounter = 0;

    this.heartbeatLoop = setInterval(() => {
      // Record metrics: heartbeat
      this.metricsCollector.recordHeartbeat();

      // Perform rate limit cleanup every 10 heartbeats (5 minute intervals with 30s heartbeat)
      cleanupCounter++;
      if (cleanupCounter >= 10) {
        cleanupCounter = 0;
        this.cleanupRateLimitData();
      }

      this.clients.forEach((ws) => {
        if (!ws.isAlive) {
          // Connection failed to respond to ping - mark as dead in lifecycle manager
          this.logger.info(`[WebSocket] Client ${ws.clientId} failed heartbeat, terminating`);
          this.metricsCollector.recordHeartbeatMissed();
          this.connectionManager.markDead(ws.clientId);
          this.clients.delete(ws);
          this.authenticatedClients.delete(ws);
          this.cleanupRateLimitData(ws.clientId);
          return ws.terminate();
        }

        // Check if client hasn't responded within timeout
        if (Date.now() - ws.lastHeartbeat > this.heartbeatTimeout) {
          this.logger.info(`[WebSocket] Client ${ws.clientId} heartbeat timeout, terminating`);
          this.metricsCollector.recordHeartbeatMissed();
          this.connectionManager.markDead(ws.clientId);
          this.clients.delete(ws);
          this.authenticatedClients.delete(ws);
          this.cleanupRateLimitData(ws.clientId);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
        this.connectionManager.recordPing(ws.clientId);
      });

      // Run zombie detection every 60 seconds (every 2 heartbeats with 30s interval)
      if (cleanupCounter % 2 === 0) {
        this._checkForZombieConnections();
      }
    }, this.heartbeatInterval);

    // Start periodic zombie detection interval
    if (!this.zombieDetectionInterval) {
      this.zombieDetectionInterval = this.connectionManager.startZombieDetection(
        () => Array.from(this.clients).map(ws => ws.clientId),
        {
          clients: this.clients,
          authenticatedClients: this.authenticatedClients,
          rateLimitData: this.rateLimitData
        }
      );
    }
  },

stopHeartbeat() {
    if (this.heartbeatLoop) {
      clearInterval(this.heartbeatLoop);
      this.heartbeatLoop = null;
    }

    if (this.zombieDetectionInterval) {
      this.connectionManager.stopZombieDetection(this.zombieDetectionInterval);
      this.zombieDetectionInterval = null;
    }
  },

_checkForZombieConnections() {
    try {
      const status = this.connectionManager.getConnectionStatus();
      const zombies = status.filter(conn => conn.isZombie);

      if (zombies.length > 0) {
        this.logger.warn(`[Heartbeat] Detected ${zombies.length} zombie connection(s)`, {
          zombies: zombies.map(z => ({
            clientId: z.clientId,
            inactiveFor: z.inactiveFor,
            duration: z.duration
          }))
        });

        // Force terminate all zombies
        for (const zombie of zombies) {
          this.connectionManager.forceTerminate(zombie.clientId, {
            reason: 'grace_period_exceeded'
          });
        }
      }
    } catch (error) {
      this.logger.error(`[Heartbeat] Error checking zombie connections: ${error.message}`, {
        error
      });
    }
  },

startQueueProcessor() {
    if (this.queueProcessorInterval) {
      return; // Already running
    }

    this.queueProcessorInterval = setInterval(() => {
      try {
        const nextRequest = this.commandQueue.getNextRequest();
        if (nextRequest && nextRequest.ws && !nextRequest.ws.closed) {
          // Process the request asynchronously
          this._processQueuedCommand(nextRequest).catch((error) => {
            this.logger.error(`[QueueProcessor] Error processing queued command: ${error.message}`);
          });
        }
      } catch (error) {
        this.logger.error(`[QueueProcessor] Error in queue processor: ${error.message}`);
      }
    }, 10); // Process queue every 10ms
  },

stopQueueProcessor() {
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
      this.queueProcessorInterval = null;
    }
  },

async _processQueuedCommand(queuedRequest) {
    const { originalRequest, ws, id } = queuedRequest;
    const { command, ...params } = originalRequest;

    try {
      // Execute the command through the dispatcher
      const response = await this.commandDispatcher.execute(command, params, {
        enableRetry: true,
        maxRetries: ERROR_RECOVERY_CONFIG.maxRetries,
        clientId: ws.clientId,
        commandId: id
      });

      // Send response back to client. Same envelope rule as _sendResponse: spread
      // the response FIRST, stamp id/command LAST so the real request id wins over
      // any formatter-injected id:null (preserves client reply correlation).
      if (ws && !ws.closed) {
        ws.send(JSON.stringify({
          ...response,
          id: id,
          command: command
        }));
      }

      // Mark request as completed
      this.commandQueue.completeRequest(queuedRequest.id, response);
    } catch (error) {
      this.logger.error(`[QueueProcessor] Command execution error: ${error.message}`);

      // Send error response
      if (ws && !ws.closed) {
        ws.send(JSON.stringify({
          id: id,
          command: command,
          success: false,
          error: error.message
        }));
      }

      // Mark request as failed
      this.commandQueue.failRequest(queuedRequest.id, error);
    }
  }
};
