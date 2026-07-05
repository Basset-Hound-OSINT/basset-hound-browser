// Command handlers (skip_replay_action .. unload_plugin) — extracted from
// server.js setupCommandHandlers. 67 handlers. Order preserved.
const D = require('../core/handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

function registerCoreCmds08(server) {
    server.commandHandlers.skip_replay_action = async (params) => {
      if (!server.replayEngine) {
        return { success: false, error: 'Replay engine not available' };
      }
      return server.replayEngine.skipAction();
    };

    /**
     * Set replay speed
     * @param {Object} params
     * @param {number} params.speed - Speed multiplier (0.25, 0.5, 1, 2, 4, etc.)
     */
    server.commandHandlers.set_replay_speed = async (params) => {
      if (!server.replayEngine) {
        return { success: false, error: 'Replay engine not available' };
      }
      if (params.speed === undefined) {
        return { success: false, error: 'Speed is required' };
      }
      return server.replayEngine.setSpeed(params.speed);
    };

    /**
     * Set replay error handling mode
     * @param {Object} params
     * @param {string} params.errorMode - Error mode (fail, skip, retry, pause)
     */
    server.commandHandlers.set_replay_error_mode = async (params) => {
      if (!server.replayEngine) {
        return { success: false, error: 'Replay engine not available' };
      }
      if (!params.errorMode) {
        return { success: false, error: 'Error mode is required' };
      }
      return server.replayEngine.setErrorMode(params.errorMode);
    };

    /**
     * Set replay variables for parameterization
     * @param {Object} params
     * @param {Object} params.variables - Variables object
     */
    server.commandHandlers.set_replay_variables = async (params) => {
      if (!server.replayEngine) {
        return { success: false, error: 'Replay engine not available' };
      }
      if (!params.variables) {
        return { success: false, error: 'Variables object is required' };
      }
      return server.replayEngine.setVariables(params.variables);
    };

    /**
     * Get current replay status
     */
    server.commandHandlers.get_replay_status = async (params) => {
      if (!server.replayEngine) {
        return { success: false, error: 'Replay engine not available' };
      }
      return {
        success: true,
        ...server.replayEngine.getStatus()
      };
    };

    /**
     * Get replay results
     */
    server.commandHandlers.get_replay_results = async (params) => {
      if (!server.replayEngine) {
        return { success: false, error: 'Replay engine not available' };
      }
      return server.replayEngine.getResults();
    };

    /**
     * Get available error modes
     */
    server.commandHandlers.get_replay_error_modes = async (params) => {
      return {
        success: true,
        modes: Object.values(ERROR_MODE),
        descriptions: {
          [ERROR_MODE.FAIL]: 'Stop replay on first error',
          [ERROR_MODE.SKIP]: 'Skip failed action and continue',
          [ERROR_MODE.RETRY]: 'Retry failed action (up to max retries)',
          [ERROR_MODE.PAUSE]: 'Pause replay on error for manual intervention'
        }
      };
    };

    /**
     * Get available export formats
     */
    server.commandHandlers.get_recording_export_formats = async (params) => {
      return {
        success: true,
        formats: ['json', 'python', 'javascript', 'playwright'],
        descriptions: {
          json: 'Raw JSON format for backup/import',
          python: 'Python Selenium script',
          javascript: 'JavaScript Puppeteer script',
          playwright: 'JavaScript Playwright script'
        }
      };
    };

    // ==========================================
    // Headless Mode Commands
    // ==========================================

    /**
     * Get headless mode status
     * Returns detailed information about headless configuration and environment
     */
    server.commandHandlers.get_headless_status = async (params) => {
      if (!server.headlessManager) {
        return { success: false, error: 'Headless manager not available' };
      }
      return {
        success: true,
        ...server.headlessManager.getStatus()
      };
    };

    /**
     * Enable or disable offscreen rendering
     * Useful for optimizing headless performance
     */
    server.commandHandlers.set_offscreen_rendering = async (params) => {
      if (!server.headlessManager) {
        return { success: false, error: 'Headless manager not available' };
      }

      const { enabled } = params;
      if (enabled === undefined) {
        return { success: false, error: 'enabled parameter is required (true/false)' };
      }

      if (!server.mainWindow) {
        return { success: false, error: 'Main window not available' };
      }

      if (enabled) {
        return server.headlessManager.enableOffscreenRendering(server.mainWindow.webContents);
      } else {
        return server.headlessManager.disableOffscreenRendering(server.mainWindow.webContents);
      }
    };

    /**
     * Get rendering statistics for headless mode
     * Returns frame counts, timing, and performance metrics
     */
    server.commandHandlers.get_render_stats = async (params) => {
      if (!server.headlessManager) {
        return { success: false, error: 'Headless manager not available' };
      }
      return {
        success: true,
        ...server.headlessManager.getRenderStats()
      };
    };

    /**
     * Reset rendering statistics
     */
    server.commandHandlers.reset_render_stats = async (params) => {
      if (!server.headlessManager) {
        return { success: false, error: 'Headless manager not available' };
      }
      return server.headlessManager.resetRenderStats();
    };

    /**
     * Set offscreen rendering frame rate
     */
    server.commandHandlers.set_frame_rate = async (params) => {
      if (!server.headlessManager) {
        return { success: false, error: 'Headless manager not available' };
      }

      const { frameRate } = params;
      if (frameRate === undefined) {
        return { success: false, error: 'frameRate parameter is required (1-120)' };
      }

      if (!server.mainWindow) {
        return { success: false, error: 'Main window not available' };
      }

      return server.headlessManager.setFrameRate(frameRate, server.mainWindow.webContents);
    };

    /**
     * Get available headless presets
     */
    server.commandHandlers.get_headless_presets = async (params) => {
      if (!server.headlessManager) {
        return { success: false, error: 'Headless manager not available' };
      }
      return server.headlessManager.getPresets();
    };

    /**
     * Apply a headless preset configuration
     */
    server.commandHandlers.apply_headless_preset = async (params) => {
      if (!server.headlessManager) {
        return { success: false, error: 'Headless manager not available' };
      }

      const { preset } = params;
      if (!preset) {
        return { success: false, error: 'preset parameter is required' };
      }

      return server.headlessManager.applyPreset(preset);
    };

    /**
     * Start virtual display (Xvfb) for headless operation on Linux
     */
    server.commandHandlers.start_virtual_display = async (params) => {
      if (!server.headlessManager) {
        return { success: false, error: 'Headless manager not available' };
      }

      const options = {
        displayNum: params.displayNum,
        resolution: params.resolution,
        screen: params.screen
      };

      return server.headlessManager.startVirtualDisplay(options);
    };

    /**
     * Stop virtual display
     */
    server.commandHandlers.stop_virtual_display = async (params) => {
      if (!server.headlessManager) {
        return { success: false, error: 'Headless manager not available' };
      }
      return server.headlessManager.stopVirtualDisplay();
    };

    /**
     * Detect headless environment
     * Returns information about display, Docker, CI, WSL environments
     */
    server.commandHandlers.detect_headless_environment = async (params) => {
      if (!server.headlessManager) {
        return { success: false, error: 'Headless manager not available' };
      }
      return {
        success: true,
        ...server.headlessManager.detectHeadlessEnvironment()
      };
    };

    // ==========================================
    // Window Orchestration Commands
    // ==========================================

    /**
     * Spawn a new browser window
     * Creates a new independent browser window, optionally from pool
     */
    server.commandHandlers.spawn_window = async (params) => {
      if (!server.windowManager) {
        return { success: false, error: 'Window manager not available' };
      }

      const { url, partition, profileId, metadata, show, usePool } = params;
      return await server.windowManager.spawnWindow({
        url,
        partition,
        profileId,
        metadata,
        show: show !== false,
        usePool: usePool !== false
      });
    };

    /**
     * List all browser windows
     * Returns information about all managed windows
     */
    server.commandHandlers.list_windows = async (params) => {
      if (!server.windowManager) {
        return { success: false, error: 'Window manager not available' };
      }

      const { state, profileId } = params;
      return server.windowManager.listWindows({ state, profileId });
    };

    /**
     * Switch to a specific window
     * Makes the specified window active and focused
     */
    server.commandHandlers.switch_window = async (params) => {
      if (!server.windowManager) {
        return { success: false, error: 'Window manager not available' };
      }

      const { windowId } = params;
      if (!windowId) {
        return { success: false, error: 'Window ID is required' };
      }

      return server.windowManager.switchWindow(windowId);
    };

    /**
     * Close a specific window
     * Closes the window, optionally returning it to pool
     */
    server.commandHandlers.close_window = async (params) => {
      if (!server.windowManager) {
        return { success: false, error: 'Window manager not available' };
      }

      const { windowId, returnToPool, force } = params;
      if (!windowId) {
        return { success: false, error: 'Window ID is required' };
      }

      return await server.windowManager.closeWindow(windowId, {
        returnToPool: returnToPool || false,
        force: force || false
      });
    };

    /**
     * Get info about a specific window
     * Returns detailed state and metadata for a window
     */
    server.commandHandlers.get_window_info = async (params) => {
      if (!server.windowManager) {
        return { success: false, error: 'Window manager not available' };
      }

      const { windowId } = params;
      if (!windowId) {
        return { success: false, error: 'Window ID is required' };
      }

      const windowInfo = server.windowManager.getWindowInfo(windowId);
      if (!windowInfo) {
        return { success: false, error: 'Window not found' };
      }

      return { success: true, window: windowInfo };
    };

    /**
     * Get the currently active window
     * Returns info about the window that has focus
     */
    server.commandHandlers.get_active_window = async (params) => {
      if (!server.windowManager) {
        return { success: false, error: 'Window manager not available' };
      }

      const activeWindow = server.windowManager.getActiveWindow();
      if (!activeWindow) {
        return { success: false, error: 'No active window' };
      }

      return { success: true, window: activeWindow };
    };

    /**
     * Send command to a specific window
     * Sends an IPC message to the specified window
     */
    server.commandHandlers.send_to_window = async (params) => {
      if (!server.windowManager) {
        return { success: false, error: 'Window manager not available' };
      }

      const { windowId, channel, data } = params;
      if (!windowId) {
        return { success: false, error: 'Window ID is required' };
      }
      if (!channel) {
        return { success: false, error: 'Channel is required' };
      }

      return server.windowManager.sendToWindow(windowId, channel, data);
    };

    /**
     * Broadcast command to all windows
     * Sends an IPC message to all (or filtered) windows
     */
    server.commandHandlers.broadcast_windows = async (params) => {
      if (!server.windowManager) {
        return { success: false, error: 'Window manager not available' };
      }

      const { channel, data, excludeWindows, onlyActive, state } = params;
      if (!channel) {
        return { success: false, error: 'Channel is required' };
      }

      return server.windowManager.broadcast(channel, data, {
        excludeWindows: excludeWindows || [],
        onlyActive: onlyActive || false,
        state
      });
    };

    /**
     * Navigate a window to a URL
     * Changes the URL of a specific window
     */
    server.commandHandlers.navigate_window = async (params) => {
      if (!server.windowManager) {
        return { success: false, error: 'Window manager not available' };
      }

      const { windowId, url } = params;
      if (!windowId) {
        return { success: false, error: 'Window ID is required' };
      }
      if (!url) {
        return { success: false, error: 'URL is required' };
      }

      // H-1: SSRF guard
      const ssrfCheck = await validateNavigationUrl(url);
      if (!ssrfCheck.allowed) {
        return { success: false, error: ssrfCheck.reason, url };
      }

      // Check for .onion URL without Tor mode
      const onionError = checkOnionWithoutTor(url);
      if (onionError) {
        return onionError;
      }

      return await server.windowManager.navigateWindow(windowId, url);
    };

    /**
     * Execute script in a specific window
     * Runs JavaScript code in the context of the window
     */
    server.commandHandlers.execute_in_window = async (params) => {
      if (!server.windowManager) {
        return { success: false, error: 'Window manager not available' };
      }

      const { windowId, script } = params;
      if (!windowId) {
        return { success: false, error: 'Window ID is required' };
      }
      if (!script) {
        return { success: false, error: 'Script is required' };
      }

      return await server.windowManager.executeInWindow(windowId, script);
    };

    /**
     * Close all windows
     * Closes all managed windows, with optional exceptions
     */
    server.commandHandlers.close_all_windows = async (params) => {
      if (!server.windowManager) {
        return { success: false, error: 'Window manager not available' };
      }

      const { force, exceptActive } = params;
      return await server.windowManager.closeAllWindows({
        force: force || false,
        exceptActive: exceptActive || false
      });
    };

    /**
     * Perform health check on all windows
     * Returns health status of all managed windows
     */
    server.commandHandlers.window_health_check = async (params) => {
      if (!server.windowManager) {
        return { success: false, error: 'Window manager not available' };
      }

      return server.windowManager.healthCheck();
    };

    // ==========================================
    // Window Pool Commands
    // ==========================================

    /**
     * Get window pool status
     * Returns detailed pool statistics and configuration
     */
    server.commandHandlers.get_window_pool_status = async (params) => {
      if (!server.windowPool) {
        return { success: false, error: 'Window pool not available' };
      }

      return server.windowPool.getStatus();
    };

    /**
     * Initialize the window pool
     * Starts pool warming and health monitoring
     */
    server.commandHandlers.initialize_window_pool = async (params) => {
      if (!server.windowPool) {
        return { success: false, error: 'Window pool not available' };
      }

      return await server.windowPool.initialize();
    };

    /**
     * Update window pool configuration
     * Modifies pool size limits and timing parameters
     */
    server.commandHandlers.update_window_pool_config = async (params) => {
      if (!server.windowPool) {
        return { success: false, error: 'Window pool not available' };
      }

      const { minPoolSize, maxPoolSize, warmupDelay, healthCheckInterval, maxIdleTime } = params;
      return server.windowPool.updateConfig({
        minPoolSize,
        maxPoolSize,
        warmupDelay,
        healthCheckInterval,
        maxIdleTime
      });
    };

    /**
     * Manually warm up the pool
     * Creates additional pre-warmed windows
     */
    server.commandHandlers.warmup_window_pool = async (params) => {
      if (!server.windowPool) {
        return { success: false, error: 'Window pool not available' };
      }

      const { count } = params;
      return await server.windowPool.warmup(count);
    };

    /**
     * Drain the window pool
     * Disposes all pooled windows
     */
    server.commandHandlers.drain_window_pool = async (params) => {
      if (!server.windowPool) {
        return { success: false, error: 'Window pool not available' };
      }

      return await server.windowPool.drain();
    };

    // ==================== LOGGING COMMANDS ====================

    /**
     * Set log level
     * @param {string} level - Log level (error, warn, info, debug, trace)
     */
    server.commandHandlers.set_log_level = async (params) => {
      const { level } = params;

      if (!level) {
        return { success: false, error: 'Level is required' };
      }

      if (!LEVEL_NAMES.includes(level)) {
        return {
          success: false,
          error: `Invalid level. Valid levels: ${LEVEL_NAMES.join(', ')}`
        };
      }

      try {
        server.logger.setLevel(level);
        return {
          success: true,
          level,
          message: `Log level set to ${level}`
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Get current log level
     */
    server.commandHandlers.get_log_level = async (params) => {
      return {
        success: true,
        level: server.logger.getLevel(),
        availableLevels: LEVEL_NAMES
      };
    };

    /**
     * Get logs from memory transport (if available)
     * @param {Object} filter - Optional filter (level, since, limit)
     */
    server.commandHandlers.get_logs = async (params) => {
      const { level, since, limit } = params;

      const memoryTransport = server.logger.getTransport('memory');
      if (!memoryTransport) {
        return {
          success: false,
          error: 'Memory transport not configured. Logs are not stored in memory.'
        };
      }

      const logs = memoryTransport.getEntries({ level, since, limit });
      return {
        success: true,
        count: logs.length,
        logs
      };
    };

    /**
     * Get logger statistics
     */
    server.commandHandlers.get_log_stats = async (params) => {
      return {
        success: true,
        stats: server.logger.getStats()
      };
    };

    // ==================== PROFILING COMMANDS ====================

    /**
     * Start profiling
     */
    server.commandHandlers.start_profiling = async (params) => {
      server.profiler.enable();
      return {
        success: true,
        message: 'Profiling started'
      };
    };

    /**
     * Stop profiling and get summary
     */
    server.commandHandlers.stop_profiling = async (params) => {
      server.profiler.disable();
      return {
        success: true,
        message: 'Profiling stopped',
        summary: server.profiler.getSummary()
      };
    };

    /**
     * Start a named timer
     * @param {string} name - Timer name
     * @param {Object} metadata - Optional metadata
     */
    server.commandHandlers.start_timer = async (params) => {
      const { name, metadata } = params;

      if (!name) {
        return { success: false, error: 'Timer name is required' };
      }

      server.profiler.startTimer(name, metadata || {});
      return {
        success: true,
        name,
        message: `Timer '${name}' started`
      };
    };

    /**
     * Stop a named timer
     * @param {string} name - Timer name
     */
    server.commandHandlers.stop_timer = async (params) => {
      const { name } = params;

      if (!name) {
        return { success: false, error: 'Timer name is required' };
      }

      const result = server.profiler.endTimer(name);
      if (!result) {
        return { success: false, error: `Timer '${name}' not found` };
      }

      return {
        success: true,
        ...result
      };
    };

    /**
     * Get all metrics
     */
    server.commandHandlers.get_metrics = async (params) => {
      return {
        success: true,
        metrics: server.profiler.getMetrics(),
        stats: server.profiler.getStats()
      };
    };

    /**
     * Get active timers
     */
    server.commandHandlers.get_active_timers = async (params) => {
      return {
        success: true,
        timers: server.profiler.getActiveTimers()
      };
    };

    /**
     * Get timer history
     * @param {Object} filter - Optional filter (name, since, limit)
     */
    server.commandHandlers.get_timer_history = async (params) => {
      const { name, since, limit } = params;
      const history = server.profiler.getTimerHistory({ name, since, limit });
      return {
        success: true,
        count: history.length,
        history
      };
    };

    /**
     * Reset profiling data
     */
    server.commandHandlers.reset_profiling = async (params) => {
      server.profiler.reset();
      return {
        success: true,
        message: 'Profiling data reset'
      };
    };

    // ==================== MEMORY MONITORING COMMANDS ====================

    /**
     * Get current memory usage
     */
    server.commandHandlers.get_memory_stats = async (params) => {
      return {
        success: true,
        usage: server.memoryMonitor.getMemoryUsage(),
        stats: server.memoryMonitor.getStats()
      };
    };

    /**
     * Start memory monitoring
     * @param {number} interval - Monitoring interval in ms
     */
    server.commandHandlers.start_memory_monitoring = async (params) => {
      const { interval } = params;
      return server.memoryMonitor.startMonitoring(interval);
    };

    /**
     * Stop memory monitoring
     */
    server.commandHandlers.stop_memory_monitoring = async (params) => {
      return server.memoryMonitor.stopMonitoring();
    };

    /**
     * Get memory history
     * @param {number} limit - Max entries to return
     */
    server.commandHandlers.get_memory_history = async (params) => {
      const { limit } = params;
      const history = server.memoryMonitor.getHistory(limit);
      return {
        success: true,
        count: history.length,
        history
      };
    };

    /**
     * Detect memory leaks
     */
    server.commandHandlers.detect_memory_leaks = async (params) => {
      const result = server.memoryMonitor.detectLeaks();
      return {
        success: true,
        ...result
      };
    };

    /**
     * Get heap snapshot info
     */
    server.commandHandlers.get_heap_snapshot = async (params) => {
      return {
        success: true,
        snapshot: server.memoryMonitor.getHeapSnapshot()
      };
    };

    /**
     * Trigger garbage collection (if available)
     */
    server.commandHandlers.trigger_gc = async (params) => {
      return server.memoryMonitor.triggerGC();
    };

    // ==================== DEBUG COMMANDS ====================

    /**
     * Enable debug mode
     * @param {string} mode - Debug mode (basic, verbose, trace)
     */
    server.commandHandlers.enable_debug = async (params) => {
      const { mode } = params;
      return server.debugManager.enableDebugMode(mode);
    };

    /**
     * Disable debug mode
     */
    server.commandHandlers.disable_debug = async (params) => {
      return server.debugManager.disableDebugMode();
    };

    /**
     * Get debug status
     */
    server.commandHandlers.get_debug_status = async (params) => {
      return {
        success: true,
        mode: server.debugManager.getDebugMode(),
        stats: server.debugManager.getStats()
      };
    };

    /**
     * Start tracing IPC messages
     */
    server.commandHandlers.trace_ipc = async (params) => {
      return server.debugManager.traceIPC();
    };

    /**
     * Stop tracing IPC messages
     */
    server.commandHandlers.stop_trace_ipc = async (params) => {
      return server.debugManager.stopTraceIPC();
    };

    /**
     * Get IPC trace
     * @param {Object} filter - Optional filter
     */
    server.commandHandlers.get_ipc_trace = async (params) => {
      const { channel, direction, since, limit } = params;
      const trace = server.debugManager.getIPCTrace({ channel, direction, since, limit });
      return {
        success: true,
        count: trace.length,
        trace
      };
    };

    /**
     * Start tracing WebSocket commands
     */
    server.commandHandlers.trace_websocket = async (params) => {
      return server.debugManager.traceWebSocket();
    };

    /**
     * Stop tracing WebSocket commands
     */
    server.commandHandlers.stop_trace_websocket = async (params) => {
      return server.debugManager.stopTraceWebSocket();
    };

    /**
     * Get WebSocket trace
     * @param {Object} filter - Optional filter
     */
    server.commandHandlers.get_websocket_trace = async (params) => {
      const { command, type, clientId, since, limit } = params;
      const trace = server.debugManager.getWebSocketTrace({ command, type, clientId, since, limit });
      return {
        success: true,
        count: trace.length,
        trace
      };
    };

    /**
     * Dump current browser state
     */
    server.commandHandlers.dump_state = async (params) => {
      // Set additional references for more complete state dump
      server.debugManager.setReferences({
        tabManager: server.tabManager,
        sessionManager: server.sessionManager
      });

      return {
        success: true,
        state: server.debugManager.dumpState()
      };
    };

    /**
     * Clear debug buffers
     */
    server.commandHandlers.clear_debug_buffers = async (params) => {
      server.debugManager.clearBuffers();
      return {
        success: true,
        message: 'Debug buffers cleared'
      };
    };

    // ==========================================
    // Plugin System Commands
    // ==========================================

    /**
     * Load a plugin from file path
     * @param {string} path - Path to the plugin file
     * @param {boolean} replace - Replace existing plugin if loaded
     */
    server.commandHandlers.load_plugin = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      const { path: pluginPath, replace } = params;
      if (!pluginPath) {
        return { success: false, error: 'Plugin path is required' };
      }

      try {
        return await server.pluginManager.loadPlugin(pluginPath, { replace });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Unload a plugin by name
     * @param {string} name - Plugin name to unload
     */
    server.commandHandlers.unload_plugin = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      const { name } = params;
      if (!name) {
        return { success: false, error: 'Plugin name is required' };
      }

      try {
        return await server.pluginManager.unloadPlugin(name);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
}

module.exports = { registerCoreCmds08 };
