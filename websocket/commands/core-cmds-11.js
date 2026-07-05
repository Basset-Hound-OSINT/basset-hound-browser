// Command handlers (get_proxy_reputation .. get_rollback_versions) — extracted from
// server.js setupCommandHandlers. 25 handlers. Order preserved.
const D = require('../core/handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

function registerCoreCmds11(server) {
    server.commandHandlers.get_proxy_reputation = async (params) => {
      if (!server.proxyIntelligence && !server.reputationScorer) {
        return { success: false, error: 'Proxy intelligence not available' };
      }

      const { proxy_address, session_id } = params;
      if (!proxy_address) {
        return { success: false, error: 'Proxy address is required' };
      }

      try {
        let reputation = null;

        // Try reputationScorer first, then proxyIntelligence
        if (server.reputationScorer) {
          reputation = server.reputationScorer.getReputation(proxy_address);
        } else if (server.proxyIntelligence) {
          const session = session_id ? server.proxyIntelligence.createProxySession(session_id) : null;
          const proxy = { address: proxy_address };
          reputation = server.proxyIntelligence.scoreProxy(proxy, session);
        }

        return {
          success: true,
          proxy_address,
          reputation: reputation || {},
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'Failed to get proxy reputation: ' + error.message };
      }
    };

    // Set geographic lock to enforce consistency
    server.commandHandlers.set_geo_lock = async (params) => {
      if (!server.geoConsistencyEngine) {
        return { success: false, error: 'Geo consistency engine not available' };
      }

      const { country, region, latitude, longitude, enforce = true } = params;

      if (!country && !latitude) {
        return { success: false, error: 'Country code or coordinates required' };
      }

      try {
        const geoLock = {
          country: country || null,
          region: region || null,
          coordinates: latitude && longitude ? { latitude, longitude } : null,
          enforce,
          createdAt: new Date().toISOString()
        };

        // Store geo lock in engine
        if (server.geoConsistencyEngine.setGeoLock) {
          await server.geoConsistencyEngine.setGeoLock(geoLock);
        }

        return {
          success: true,
          geoLock,
          message: `Geo lock applied to ${country || 'specified region'}`
        };
      } catch (error) {
        return { success: false, error: 'Failed to set geo lock: ' + error.message };
      }
    };

    // Get proxy analytics and performance metrics
    server.commandHandlers.get_proxy_analytics = async (params) => {
      if (!server.proxyAnalytics && !server.proxyIntelligence) {
        return { success: false, error: 'Proxy analytics not available' };
      }

      const { session_id, aggregate = false } = params;

      try {
        let analytics = null;

        if (server.proxyAnalytics) {
          analytics = server.proxyAnalytics.getAnalytics(session_id, aggregate);
        } else if (server.proxyIntelligence && session_id) {
          analytics = server.proxyIntelligence.getSessionIntelligence(session_id);
        } else if (server.proxyIntelligence) {
          analytics = server.proxyIntelligence.getProxyPoolStats();
        }

        return {
          success: true,
          analytics: analytics || {},
          sessionId: session_id,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'Failed to get proxy analytics: ' + error.message };
      }
    };

    // ==========================================
    // Wave 14: Session Checkpoint & Branching Commands
    // ==========================================

    // Create a checkpoint of the current session state
    server.commandHandlers.create_session_checkpoint = async (params) => {
      const { label = '', description = '' } = params;

      try {
        const checkpointId = `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Capture current state
        const currentUrl = server.mainWindow?.webContents?.getURL() || '';
        const snapshot = {
          id: checkpointId,
          label,
          description,
          timestamp: Date.now(),
          stateData: {
            type: 'session_checkpoint',
            currentUrl,
            checkpointTime: new Date().toISOString()
          },
          metadata: {
            label,
            description
          }
        };

        // Save snapshot in state manager
        server.stateManager.saveSnapshot(checkpointId, snapshot);

        return {
          success: true,
          checkpointId,
          label,
          timestamp: snapshot.timestamp,
          message: `Checkpoint "${label}" created successfully`
        };
      } catch (error) {
        return { success: false, error: 'Failed to create checkpoint: ' + error.message };
      }
    };

    // Rollback to a specific checkpoint
    server.commandHandlers.rollback_to_checkpoint = async (params) => {
      const { checkpoint_id } = params;

      if (!checkpoint_id) {
        return { success: false, error: 'checkpoint_id is required' };
      }

      try {
        const restored = await server.stateManager.restoreSnapshot(checkpoint_id);

        if (!restored) {
          return { success: false, error: `Checkpoint ${checkpoint_id} not found or restoration failed` };
        }

        return {
          success: true,
          checkpointId: checkpoint_id,
          message: 'Session rolled back to checkpoint',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'Failed to rollback to checkpoint: ' + error.message };
      }
    };

    // List all available checkpoints
    server.commandHandlers.list_checkpoints = async (params) => {
      try {
        const snapshots = server.stateManager.listSnapshots();
        const checkpoints = snapshots
          .filter(s => s.stateData && s.stateData.type === 'session_checkpoint')
          .map(s => ({
            id: s.id,
            label: s.metadata?.label || '',
            description: s.metadata?.description || '',
            timestamp: s.timestamp,
            createdAt: new Date(s.timestamp).toISOString()
          }))
          .sort((a, b) => b.timestamp - a.timestamp);

        return {
          success: true,
          checkpoints,
          total: checkpoints.length,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'Failed to list checkpoints: ' + error.message };
      }
    };

    // Get details about a specific checkpoint
    server.commandHandlers.get_checkpoint_details = async (params) => {
      const { checkpoint_id } = params;

      if (!checkpoint_id) {
        return { success: false, error: 'checkpoint_id is required' };
      }

      try {
        const snapshots = server.stateManager.listSnapshots();
        const checkpoint = snapshots.find(s => s.id === checkpoint_id);

        if (!checkpoint) {
          return { success: false, error: `Checkpoint ${checkpoint_id} not found` };
        }

        return {
          success: true,
          checkpoint: {
            id: checkpoint.id,
            label: checkpoint.metadata?.label || '',
            description: checkpoint.metadata?.description || '',
            timestamp: checkpoint.timestamp,
            createdAt: new Date(checkpoint.timestamp).toISOString(),
            stateData: checkpoint.stateData
          }
        };
      } catch (error) {
        return { success: false, error: 'Failed to get checkpoint details: ' + error.message };
      }
    };

    // Delete a checkpoint
    server.commandHandlers.delete_checkpoint = async (params) => {
      const { checkpoint_id } = params;

      if (!checkpoint_id) {
        return { success: false, error: 'checkpoint_id is required' };
      }

      try {
        server.stateManager.discardSnapshot(checkpoint_id);

        return {
          success: true,
          checkpointId: checkpoint_id,
          message: 'Checkpoint deleted successfully'
        };
      } catch (error) {
        return { success: false, error: 'Failed to delete checkpoint: ' + error.message };
      }
    };

    // Create a session branch (transaction)
    server.commandHandlers.branch_session = async (params) => {
      const { label = '' } = params;

      try {
        const branchId = server.stateManager.beginTransaction();

        // Create a checkpoint at branch start
        const checkpointId = `branch-start-${branchId}`;
        const snapshot = {
          id: checkpointId,
          label: `Branch: ${label}`,
          timestamp: Date.now(),
          stateData: {
            type: 'session_branch',
            branchId
          },
          metadata: {
            branchId,
            label
          }
        };
        server.stateManager.saveSnapshot(checkpointId, snapshot);

        return {
          success: true,
          branchId,
          label,
          checkpointId,
          message: `Session branch "${label}" created`,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'Failed to create branch: ' + error.message };
      }
    };

    // List active branches
    server.commandHandlers.list_branches = async (params) => {
      try {
        const transactionDepth = server.stateManager.transactionStack.length;
        const branches = server.stateManager.transactionStack.map((tx, idx) => ({
          index: idx,
          id: tx.id,
          depth: idx + 1,
          snapshotCount: tx.snapshots.length,
          startedAt: new Date(tx.startTime).toISOString()
        }));

        return {
          success: true,
          branches,
          activeCount: transactionDepth,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'Failed to list branches: ' + error.message };
      }
    };

    // Merge a branch (commit transaction)
    server.commandHandlers.merge_branch = async (params) => {
      try {
        const committed = server.stateManager.commitTransaction();

        if (!committed) {
          return { success: false, error: 'No active branch to merge' };
        }

        return {
          success: true,
          message: 'Branch merged and committed successfully',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'Failed to merge branch: ' + error.message };
      }
    };

    // Detect failures in current session
    server.commandHandlers.detect_failure = async (params) => {
      try {
        // Check for common failure indicators
        const failures = [];

        // Check console for errors
        try {
          const logs = await server.mainWindow?.webContents?.executeJavaScript(`
            (() => {
              const errors = window.__browserConsoleErrors || [];
              return { errorCount: errors.length, recentErrors: errors.slice(-5) };
            })()
          `) || { errorCount: 0 };

          if (logs.errorCount > 0) {
            failures.push({
              type: 'console_error',
              severity: 'warning',
              count: logs.errorCount,
              description: 'JavaScript errors detected in console'
            });
          }
        } catch (e) {
          // Silently ignore if console access fails
        }

        // Check network errors
        try {
          const networkStatus = await server.mainWindow?.webContents?.executeJavaScript(`
            (() => {
              const failedRequests = window.__networkErrors || [];
              return { count: failedRequests.length, requests: failedRequests.slice(-3) };
            })()
          `) || { count: 0 };

          if (networkStatus.count > 0) {
            failures.push({
              type: 'network_error',
              severity: 'warning',
              count: networkStatus.count,
              description: 'Network request failures detected'
            });
          }
        } catch (e) {
          // Silently ignore if network access fails
        }

        return {
          success: true,
          hasFailures: failures.length > 0,
          failures,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'Failed to detect failures: ' + error.message };
      }
    };

    // Get recovery strategies
    server.commandHandlers.get_recovery_strategies = async (params) => {
      const { failure_type } = params;

      try {
        const strategies = {
          console_error: [
            { strategy: 'reload_page', description: 'Reload the current page to clear errors' },
            { strategy: 'navigate_back', description: 'Navigate back to previous page' },
            { strategy: 'rollback_checkpoint', description: 'Rollback to last checkpoint' }
          ],
          network_error: [
            { strategy: 'rotate_proxy', description: 'Rotate to different proxy' },
            { strategy: 'wait_and_retry', description: 'Wait and retry the request' },
            { strategy: 'switch_network', description: 'Switch to different network' },
            { strategy: 'rollback_checkpoint', description: 'Rollback to last checkpoint' }
          ],
          timeout_error: [
            { strategy: 'increase_timeout', description: 'Increase operation timeout' },
            { strategy: 'navigate_back', description: 'Navigate back and retry' },
            { strategy: 'retry_operation', description: 'Retry failed operation' }
          ]
        };

        const applicableStrategies = failure_type && strategies[failure_type] ?
          strategies[failure_type] :
          Object.values(strategies).flat();

        return {
          success: true,
          strategies: applicableStrategies,
          failureType: failure_type,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'Failed to get recovery strategies: ' + error.message };
      }
    };

    // Resume session from checkpoint
    server.commandHandlers.resume_session = async (params) => {
      const { checkpoint_id, recovery_strategy } = params;

      if (!checkpoint_id) {
        return { success: false, error: 'checkpoint_id is required' };
      }

      try {
        const restored = await server.stateManager.restoreSnapshot(checkpoint_id);

        if (!restored) {
          return { success: false, error: `Could not restore from checkpoint ${checkpoint_id}` };
        }

        return {
          success: true,
          checkpointId: checkpoint_id,
          recoveryStrategy: recovery_strategy,
          message: 'Session resumed from checkpoint',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'Failed to resume session: ' + error.message };
      }
    };

    // Export checkpoint for external use
    server.commandHandlers.export_checkpoint = async (params) => {
      const { checkpoint_id, format = 'json' } = params;

      if (!checkpoint_id) {
        return { success: false, error: 'checkpoint_id is required' };
      }

      try {
        const snapshots = server.stateManager.listSnapshots();
        const checkpoint = snapshots.find(s => s.id === checkpoint_id);

        if (!checkpoint) {
          return { success: false, error: `Checkpoint ${checkpoint_id} not found` };
        }

        const exportedData = {
          id: checkpoint.id,
          label: checkpoint.metadata?.label || '',
          description: checkpoint.metadata?.description || '',
          timestamp: checkpoint.timestamp,
          stateData: checkpoint.stateData
        };

        return {
          success: true,
          checkpoint: exportedData,
          format,
          exportedAt: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'Failed to export checkpoint: ' + error.message };
      }
    };

    // ==========================================
    // Auto-Update Commands
    // ==========================================

    /**
     * Check for updates
     */
    server.commandHandlers.check_for_updates = async (params) => {
      if (!server.updateManager) {
        return { success: false, error: 'Update manager not available' };
      }

      try {
        const result = await server.updateManager.checkForUpdates();
        return {
          success: result.success,
          updateAvailable: result.updateAvailable || false,
          updateInfo: result.updateInfo || null,
          currentVersion: server.updateManager.currentVersion,
          error: result.error || null
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Download available update
     */
    server.commandHandlers.download_update = async (params, ws) => {
      if (!server.updateManager) {
        return { success: false, error: 'Update manager not available' };
      }

      try {
        const result = await server.updateManager.downloadUpdate();

        // Setup progress notifications for this client if download started
        if (result.success && ws) {
          server.setupUpdateProgressNotifications(ws);
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Install update and restart
     */
    server.commandHandlers.install_update = async (params) => {
      if (!server.updateManager) {
        return { success: false, error: 'Update manager not available' };
      }

      try {
        const silent = params?.silent || false;
        const forceRunAfter = params?.forceRunAfter !== false;
        return server.updateManager.installUpdate(silent, forceRunAfter);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Get current update status
     */
    server.commandHandlers.get_update_status = async (params) => {
      if (!server.updateManager) {
        return { success: false, error: 'Update manager not available' };
      }

      try {
        const status = server.updateManager.getStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Configure update settings
     */
    server.commandHandlers.set_update_config = async (params) => {
      if (!server.updateManager) {
        return { success: false, error: 'Update manager not available' };
      }

      try {
        return server.updateManager.setConfig(params || {});
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Get update history
     */
    server.commandHandlers.get_update_history = async (params) => {
      if (!server.updateManager) {
        return { success: false, error: 'Update manager not available' };
      }

      try {
        return server.updateManager.getUpdateHistory(params || {});
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Rollback to previous version
     */
    server.commandHandlers.rollback_update = async (params) => {
      if (!server.updateManager) {
        return { success: false, error: 'Update manager not available' };
      }

      if (!params?.version) {
        return { success: false, error: 'Version parameter is required' };
      }

      try {
        return server.updateManager.rollback(params.version);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Start automatic update checking
     */
    server.commandHandlers.start_auto_update_check = async (params) => {
      if (!server.updateManager) {
        return { success: false, error: 'Update manager not available' };
      }

      try {
        if (params?.interval) {
          server.updateManager.setConfig({ checkInterval: params.interval });
        }
        server.updateManager.startAutoCheck();
        return {
          success: true,
          message: 'Auto-check started',
          interval: server.updateManager.config.checkInterval
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Stop automatic update checking
     */
    server.commandHandlers.stop_auto_update_check = async (params) => {
      if (!server.updateManager) {
        return { success: false, error: 'Update manager not available' };
      }

      try {
        server.updateManager.stopAutoCheck();
        return { success: true, message: 'Auto-check stopped' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Get available rollback versions
     */
    server.commandHandlers.get_rollback_versions = async (params) => {
      if (!server.updateManager) {
        return { success: false, error: 'Update manager not available' };
      }

      try {
        const versions = server.updateManager.getRollbackVersions();
        return {
          success: true,
          versions,
          currentVersion: server.updateManager.currentVersion
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
}

module.exports = { registerCoreCmds11 };
