// Command handlers (get_element_tree .. extract_images) — extracted from
// server.js setupCommandHandlers. 53 handlers. Order preserved.
const D = require('../core/handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

function registerCoreCmds06(server) {
    server.commandHandlers.get_element_tree = async (params) => {
      const { selector, depth = 3 } = params;
      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }
      try {
        const script = server.domInspector.getElementTree(selector, depth);
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.get_element_styles = async (params) => {
      const { selector } = params;
      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }
      try {
        const script = server.domInspector.getElementStyles(selector);
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.get_element_attributes = async (params) => {
      const { selector } = params;
      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }
      try {
        const script = server.domInspector.getElementAttributes(selector);
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.generate_selector = async (params) => {
      const { selector } = params;
      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }
      try {
        const script = server.domInspector.getGenerateSelectorScript(selector);
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.highlight_element = async (params) => {
      const { selector, color } = params;
      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }
      try {
        const script = server.domInspector.highlightElement(selector, color);
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.remove_highlight = async (params) => {
      try {
        const script = server.domInspector.removeHighlight();
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.find_elements = async (params) => {
      const { selector, tagName, text, attribute, attributeValue, xpath, visibleOnly, limit, exact } = params;
      if (!selector && !tagName && !text && !attribute && !xpath) {
        return { success: false, error: 'At least one search criterion is required' };
      }
      try {
        const query = { selector, tagName, text, attribute, attributeValue, xpath, visibleOnly: visibleOnly || false, limit: limit || 100, exact: exact || false };
        const script = server.domInspector.findElements(query);
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.get_element_parent = async (params) => {
      const { selector } = params;
      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }
      try {
        const script = server.domInspector.getParent(selector);
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.get_element_children = async (params) => {
      const { selector } = params;
      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }
      try {
        const script = server.domInspector.getChildren(selector);
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // DevTools Management Commands
    // ==========================================

    // Open DevTools
    server.commandHandlers.open_devtools = async (params) => {
      if (!server.devToolsManager) {
        return { success: false, error: 'DevTools manager not available' };
      }
      try {
        return server.devToolsManager.openDevTools(params);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Close DevTools
    server.commandHandlers.close_devtools = async (params) => {
      if (!server.devToolsManager) {
        return { success: false, error: 'DevTools manager not available' };
      }
      try {
        return server.devToolsManager.closeDevTools();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get network logs
    server.commandHandlers.get_network_logs = async (params) => {
      if (!server.devToolsManager) {
        return { success: false, error: 'DevTools manager not available' };
      }
      try {
        return server.devToolsManager.getNetworkLogs(params);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get performance metrics
    server.commandHandlers.get_performance = async (params) => {
      if (!server.devToolsManager) {
        return { success: false, error: 'DevTools manager not available' };
      }
      try {
        return await server.devToolsManager.getPerformanceMetrics();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Console Management Commands
    // ==========================================

    // Get console logs
    server.commandHandlers.get_console_logs = async (params) => {
      if (!server.consoleManager) {
        return { success: false, error: 'Console manager not available' };
      }
      try {
        return server.consoleManager.getConsoleLogs(params);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear console
    server.commandHandlers.clear_console = async (params) => {
      if (!server.consoleManager) {
        return { success: false, error: 'Console manager not available' };
      }
      try {
        return server.consoleManager.clearConsoleLogs();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Execute console code
    server.commandHandlers.execute_console = async (params) => {
      if (!server.consoleManager) {
        return { success: false, error: 'Console manager not available' };
      }
      const { code, timeout, returnValue } = params;
      if (!code) {
        return { success: false, error: 'Code is required' };
      }
      try {
        return await server.consoleManager.executeInConsole(code, { timeout, returnValue });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Automation Script Commands
    // ==========================================

    server.commandHandlers.create_script = async (params) => {
      const { name, script, options = {} } = params;
      if (!name) {
        return { success: false, error: 'Script name is required' };
      }
      if (!script) {
        return { success: false, error: 'Script code is required' };
      }
      if (!server.scriptManager) {
        return { success: false, error: 'Script manager not available' };
      }
      try {
        return await server.scriptManager.createScript(name, script, options);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.update_script = async (params) => {
      const { id, updates } = params;
      if (!id) {
        return { success: false, error: 'Script ID is required' };
      }
      if (!updates) {
        return { success: false, error: 'Updates object is required' };
      }
      if (!server.scriptManager) {
        return { success: false, error: 'Script manager not available' };
      }
      try {
        return await server.scriptManager.updateScript(id, updates);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.delete_script = async (params) => {
      const { id } = params;
      if (!id) {
        return { success: false, error: 'Script ID is required' };
      }
      if (!server.scriptManager) {
        return { success: false, error: 'Script manager not available' };
      }
      try {
        return await server.scriptManager.deleteScript(id);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.get_script = async (params) => {
      const { id } = params;
      if (!id) {
        return { success: false, error: 'Script ID is required' };
      }
      if (!server.scriptManager) {
        return { success: false, error: 'Script manager not available' };
      }
      try {
        return server.scriptManager.getScript(id);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.list_scripts = async (params) => {
      if (!server.scriptManager) {
        return { success: false, error: 'Script manager not available' };
      }
      try {
        return server.scriptManager.listScripts(params || {});
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.run_script = async (params) => {
      const { id, context = {} } = params;
      if (!id) {
        return { success: false, error: 'Script ID is required' };
      }
      if (!server.scriptManager) {
        return { success: false, error: 'Script manager not available' };
      }
      try {
        return await server.scriptManager.runScript(id, context);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.enable_script = async (params) => {
      const { id } = params;
      if (!id) {
        return { success: false, error: 'Script ID is required' };
      }
      if (!server.scriptManager) {
        return { success: false, error: 'Script manager not available' };
      }
      try {
        return await server.scriptManager.enableScript(id);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.disable_script = async (params) => {
      const { id } = params;
      if (!id) {
        return { success: false, error: 'Script ID is required' };
      }
      if (!server.scriptManager) {
        return { success: false, error: 'Script manager not available' };
      }
      try {
        return await server.scriptManager.disableScript(id);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.export_scripts = async (params) => {
      if (!server.scriptManager) {
        return { success: false, error: 'Script manager not available' };
      }
      try {
        return server.scriptManager.exportScripts();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.import_scripts = async (params) => {
      const { data, overwrite = false } = params;
      if (!data) {
        return { success: false, error: 'Import data is required' };
      }
      if (!server.scriptManager) {
        return { success: false, error: 'Script manager not available' };
      }
      try {
        return await server.scriptManager.importScripts(data, overwrite);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.get_script_context = async (params) => {
      if (!server.scriptManager) {
        return { success: false, error: 'Script manager not available' };
      }
      try {
        return { success: true, context: server.scriptManager.runner.getAvailableContext() };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    server.commandHandlers.get_script_history = async (params) => {
      if (!server.scriptManager) {
        return { success: false, error: 'Script manager not available' };
      }
      try {
        return { success: true, history: server.scriptManager.runner.getHistory(params || {}) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Memory Management Commands
    // ==========================================

    /**
     * Get current memory usage statistics
     * Returns heap, RSS, external memory with MB values and percentages
     */
    server.commandHandlers.get_memory_usage = async (params) => {
      if (!server.memoryManager) {
        return { success: false, error: 'Memory manager not available' };
      }
      try {
        const usage = server.memoryManager.getMemoryUsage();
        const status = server.memoryManager.getMemoryStatus(usage);
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
          thresholds: server.memoryManager.thresholds,
          gcAvailable: server.memoryManager.isGCAvailable()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Get memory statistics including peak usage, counts, and uptime
     */
    server.commandHandlers.get_memory_stats = async (params) => {
      if (!server.memoryManager) {
        return { success: false, error: 'Memory manager not available' };
      }
      try {
        const stats = server.memoryManager.getStats();
        return { success: true, ...stats };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Force garbage collection if available
     * Requires Node.js to be started with --expose-gc flag
     */
    server.commandHandlers.force_gc = async (params) => {
      if (!server.memoryManager) {
        return { success: false, error: 'Memory manager not available' };
      }
      const { full = true } = params || {};
      try {
        const result = server.memoryManager.triggerGC(full);
        return { success: result.success, ...result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Clear various caches to free memory
     * Runs all registered cleanup callbacks and triggers GC
     */
    server.commandHandlers.clear_caches = async (params) => {
      if (!server.memoryManager) {
        return { success: false, error: 'Memory manager not available' };
      }
      try {
        const result = await server.memoryManager.runCleanup();
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Start periodic memory monitoring
     * Optional interval parameter in milliseconds
     */
    server.commandHandlers.start_memory_monitoring = async (params) => {
      if (!server.memoryManager) {
        return { success: false, error: 'Memory manager not available' };
      }
      const { interval } = params || {};
      try {
        const result = server.memoryManager.startMonitoring(interval);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Stop periodic memory monitoring
     */
    server.commandHandlers.stop_memory_monitoring = async (params) => {
      if (!server.memoryManager) {
        return { success: false, error: 'Memory manager not available' };
      }
      try {
        const result = server.memoryManager.stopMonitoring();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Set custom memory thresholds
     * Parameters: warning (MB), critical (MB), cleanup (MB)
     */
    server.commandHandlers.set_memory_thresholds = async (params) => {
      if (!server.memoryManager) {
        return { success: false, error: 'Memory manager not available' };
      }
      const { warning, critical, cleanup } = params || {};
      if (!warning && !critical && !cleanup) {
        return { success: false, error: 'At least one threshold (warning, critical, or cleanup) is required' };
      }
      try {
        const result = server.memoryManager.setThresholds({ warning, critical, cleanup });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Apply a preset threshold configuration
     * Parameters: preset (low, medium, high)
     */
    server.commandHandlers.apply_memory_preset = async (params) => {
      if (!server.memoryManager) {
        return { success: false, error: 'Memory manager not available' };
      }
      const { preset } = params || {};
      if (!preset) {
        return { success: false, error: 'Preset name is required (low, medium, high)' };
      }
      try {
        const result = server.memoryManager.applyPreset(preset);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Get memory history entries
     * Optional limit parameter for number of entries
     */
    server.commandHandlers.get_memory_history = async (params) => {
      if (!server.memoryManager) {
        return { success: false, error: 'Memory manager not available' };
      }
      const { limit } = params || {};
      try {
        const history = server.memoryManager.getHistory(limit);
        return { success: true, history, count: history.length };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Reset memory statistics
     */
    server.commandHandlers.reset_memory_stats = async (params) => {
      if (!server.memoryManager) {
        return { success: false, error: 'Memory manager not available' };
      }
      try {
        const result = server.memoryManager.resetStats();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Check memory now and return status
     * Will trigger cleanup if in critical state with autoCleanup enabled
     */
    server.commandHandlers.check_memory = async (params) => {
      if (!server.memoryManager) {
        return { success: false, error: 'Memory manager not available' };
      }
      try {
        const result = await server.memoryManager.checkMemory();
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Error Recovery Commands
    // ==========================================

    /**
     * Get error recovery configuration and status
     */
    server.commandHandlers.get_recovery_config = async (params) => {
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
    server.commandHandlers.is_command_retryable = async (params) => {
      const { command } = params;
      if (!command) {
        return { success: false, error: 'Command name is required' };
      }

      return {
        success: true,
        command,
        retryable: isRetryableCommand(command),
        exists: command in server.commandHandlers
      };
    };

    /**
     * Get manager availability status
     * Useful for clients to check which features are available
     */
    server.commandHandlers.get_manager_status = async (params) => {
      return {
        success: true,
        managers: {
          sessionManager: server.sessionManager !== null,
          tabManager: server.tabManager !== null,
          cookieManager: server.cookieManager !== null,
          downloadManager: server.downloadManager !== null,
          blockingManager: server.blockingManager !== null,
          geolocationManager: server.geolocationManager !== null,
          networkThrottler: server.networkThrottler !== null,
          headerManager: server.headerManager !== null,
          scriptManager: server.scriptManager !== null,
          storageManager: server.storageManager !== null,
          historyManager: server.historyManager !== null,
          profileManager: server.profileManager !== null,
          devToolsManager: server.devToolsManager !== null,
          consoleManager: server.consoleManager !== null,
          screenshotManager: server.screenshotManager !== null,
          recordingManager: server.recordingManager !== null,
          sessionRecordingManager: server.sessionRecordingManager !== null,
          replayEngine: server.replayEngine !== null,
          domInspector: server.domInspector !== null,
          memoryManager: server.memoryManager !== null,
          headlessManager: server.headlessManager !== null
        }
      };
    };

    /**
     * Execute a command with explicit retry, useful for one-off retries
     */
    server.commandHandlers.retry_command = async (params) => {
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
      const result = await server.executeWithRetry(
        { command: targetCommand, ...(targetParams || {}) },
        maxRetries
      );

      return result;
    };

    // ==========================================
    // Technology Detection Commands
    // ==========================================

    server.commandHandlers.detect_technologies = async (params) => {
      if (!server.technologyManager) {
        return { success: false, error: 'Technology manager not available', recovery: generateRecoverySuggestion('detect_technologies', null, 'technologyManager') };
      }

      // Get page content if not provided
      let pageData = params;
      if (!params.html && server.mainWindow) {
        try {
          // Route through the active <webview> guest, not the empty browser SHELL.
          // The detector derives script[src] and <meta> tags from the raw HTML when
          // explicit scripts/meta arrays are not supplied (see technology/detector.js).
          const result = await server.getWebviewPageContent();
          if (!result || !result.success) {
            return { success: false, error: 'Failed to get page content: ' + ((result && result.error) || 'no active webview') };
          }
          pageData = { url: result.url, html: result.html, ...params };
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return await server.technologyManager.detectTechnologies(pageData);
    };

    server.commandHandlers.get_technology_categories = async (params) => {
      if (!server.technologyManager) {
        return { success: false, error: 'Technology manager not available' };
      }
      return server.technologyManager.getCategories();
    };

    server.commandHandlers.get_technology_info = async (params) => {
      if (!server.technologyManager) {
        return { success: false, error: 'Technology manager not available' };
      }
      if (!params.name) {
        return { success: false, error: 'Technology name is required' };
      }
      return server.technologyManager.getTechnologyInfo(params.name);
    };

    server.commandHandlers.search_technologies = async (params) => {
      if (!server.technologyManager) {
        return { success: false, error: 'Technology manager not available' };
      }
      if (!params.query) {
        return { success: false, error: 'Search query is required' };
      }
      return server.technologyManager.searchTechnologies(params.query, params.options);
    };

    // Wave 14: Specialized tech detection commands
    server.commandHandlers.identify_cms = async (params) => {
      if (!server.technologyManager) {
        return { success: false, error: 'Technology manager not available', recovery: generateRecoverySuggestion('identify_cms', null, 'technologyManager') };
      }

      // Get page content if not provided
      let pageData = params;
      if (!params.html && server.mainWindow) {
        try {
          // Route through the active <webview> guest, not the empty browser SHELL.
          const result = await server.getWebviewPageContent();
          if (!result || !result.success) {
            return { success: false, error: 'Failed to get page content: ' + ((result && result.error) || 'no active webview') };
          }
          pageData = { url: result.url, html: result.html, ...params };
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      try {
        // Filter for CMS-specific technologies
        const fullDetection = await server.technologyManager.detectTechnologies(pageData);
        if (!fullDetection.success) {
          return fullDetection;
        }

        // Filter to CMS category only
        const cmsCategories = ['CMS', 'cms', 'Content Management System'];
        const cmsTechs = fullDetection.technologies.filter(tech => {
          // The detector emits `category` (singular string); tolerate `categories` (array) too.
          const categories = Array.isArray(tech.categories)
            ? tech.categories
            : (tech.category ? [tech.category] : []);
          return cmsCategories.some(cat => categories.includes(cat)) ||
                 cmsCategories.some(cat => categories.some(c => c.includes(cat)));
        });

        return {
          success: true,
          cms: cmsTechs,
          detectionCount: cmsTechs.length,
          totalDetected: fullDetection.totalDetected,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'CMS identification failed: ' + error.message };
      }
    };

    server.commandHandlers.identify_analytics = async (params) => {
      if (!server.technologyManager) {
        return { success: false, error: 'Technology manager not available', recovery: generateRecoverySuggestion('identify_analytics', null, 'technologyManager') };
      }

      // Get page content if not provided
      let pageData = params;
      if (!params.html && server.mainWindow) {
        try {
          // Route through the active <webview> guest, not the empty browser SHELL.
          const result = await server.getWebviewPageContent();
          if (!result || !result.success) {
            return { success: false, error: 'Failed to get page content: ' + ((result && result.error) || 'no active webview') };
          }
          pageData = { url: result.url, html: result.html, ...params };
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      try {
        // Filter for analytics-specific technologies
        const fullDetection = await server.technologyManager.detectTechnologies(pageData);
        if (!fullDetection.success) {
          return fullDetection;
        }

        // Filter to Analytics category
        const analyticsCategories = ['Analytics', 'analytics', 'Tracking', 'tracking'];
        const analyticsTechs = fullDetection.technologies.filter(tech => {
          // The detector emits `category` (singular string); tolerate `categories` (array) too.
          const categories = Array.isArray(tech.categories)
            ? tech.categories
            : (tech.category ? [tech.category] : []);
          return analyticsCategories.some(cat => categories.includes(cat)) ||
                 analyticsCategories.some(cat => categories.some(c => c.includes(cat)));
        });

        return {
          success: true,
          analytics: analyticsTechs,
          detectionCount: analyticsTechs.length,
          totalDetected: fullDetection.totalDetected,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: 'Analytics identification failed: ' + error.message };
      }
    };

    // ==========================================
    // Content Extraction Commands
    // ==========================================

    server.commandHandlers.extract_metadata = async (params) => {
      if (!server.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }

      let html = params.html;
      let url = params.url || '';

      if (!html && server.mainWindow) {
        try {
          const result = await server.getWebviewPageContent();
          if (!result || !result.success) {
            return { success: false, error: 'Failed to get page content: ' + ((result && result.error) || 'no active webview') };
          }
          html = result.html;
          url = url || result.url;
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return server.extractionManager.extractMetadata(html, url);
    };

    server.commandHandlers.extract_links = async (params) => {
      if (!server.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }

      let html = params.html;
      let baseUrl = params.baseUrl || params.url || '';

      if (!html && server.mainWindow) {
        try {
          const result = await server.getWebviewPageContent();
          if (!result || !result.success) {
            return { success: false, error: 'Failed to get page content: ' + ((result && result.error) || 'no active webview') };
          }
          html = result.html;
          baseUrl = baseUrl || result.url;
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return server.extractionManager.extractLinks(html, baseUrl);
    };

    server.commandHandlers.extract_forms = async (params) => {
      if (!server.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }

      let html = params.html;

      if (!html && server.mainWindow) {
        try {
          const result = await server.getWebviewPageContent();
          if (!result || !result.success) {
            return { success: false, error: 'Failed to get page content: ' + ((result && result.error) || 'no active webview') };
          }
          html = result.html;
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return server.extractionManager.extractForms(html);
    };

    server.commandHandlers.extract_images = async (params) => {
      if (!server.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }

      let html = params.html;
      let baseUrl = params.baseUrl || params.url || '';

      if (!html && server.mainWindow) {
        try {
          const result = await server.getWebviewPageContent();
          if (!result || !result.success) {
            return { success: false, error: 'Failed to get page content: ' + ((result && result.error) || 'no active webview') };
          }
          html = result.html;
          baseUrl = baseUrl || result.url;
        } catch (error) {
          return { success: false, error: 'Failed to get page content: ' + error.message };
        }
      }

      return server.extractionManager.extractImages(html, baseUrl);
    };
}

module.exports = { registerCoreCmds06 };
