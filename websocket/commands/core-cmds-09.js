// Command handlers (reload_plugin .. get_plugin_hooks) — extracted from
// server.js setupCommandHandlers. 12 handlers. Order preserved.
const D = require('../core/handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

function registerCoreCmds09(server) {
    server.commandHandlers.reload_plugin = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      const { name } = params;
      if (!name) {
        return { success: false, error: 'Plugin name is required' };
      }

      try {
        return await server.pluginManager.reloadPlugin(name);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * List all loaded plugins
     */
    server.commandHandlers.list_plugins = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      try {
        return server.pluginManager.listPlugins();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Enable a plugin
     * @param {string} name - Plugin name to enable
     */
    server.commandHandlers.enable_plugin = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      const { name } = params;
      if (!name) {
        return { success: false, error: 'Plugin name is required' };
      }

      try {
        return server.pluginManager.enablePlugin(name);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Disable a plugin
     * @param {string} name - Plugin name to disable
     */
    server.commandHandlers.disable_plugin = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      const { name } = params;
      if (!name) {
        return { success: false, error: 'Plugin name is required' };
      }

      try {
        return server.pluginManager.disablePlugin(name);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Get plugin configuration
     * @param {string} name - Plugin name
     */
    server.commandHandlers.get_plugin_config = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      const { name } = params;
      if (!name) {
        return { success: false, error: 'Plugin name is required' };
      }

      try {
        return server.pluginManager.getPluginConfig(name);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Set plugin configuration
     * @param {string} name - Plugin name
     * @param {Object} config - Configuration object
     */
    server.commandHandlers.set_plugin_config = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      const { name, config } = params;
      if (!name) {
        return { success: false, error: 'Plugin name is required' };
      }
      if (!config || typeof config !== 'object') {
        return { success: false, error: 'Config object is required' };
      }

      try {
        return server.pluginManager.setPluginConfig(name, config);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Execute a plugin command
     * @param {string} command - Full command name (plugin:name:command)
     * @param {Object} params - Command parameters
     */
    server.commandHandlers.plugin_command = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      const { command, commandParams } = params;
      if (!command) {
        return { success: false, error: 'Command name is required' };
      }

      try {
        return await server.pluginManager.executeCommand(command, commandParams || {});
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * List all plugin commands
     */
    server.commandHandlers.list_plugin_commands = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      try {
        return server.pluginManager.listCommands();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Get plugin system status
     */
    server.commandHandlers.get_plugin_status = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      try {
        return server.pluginManager.getStatus();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Load plugins from a directory
     * @param {string} directory - Path to plugins directory
     */
    server.commandHandlers.load_plugins_directory = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      const { directory } = params;
      if (!directory) {
        return { success: false, error: 'Directory path is required' };
      }

      try {
        return await server.pluginManager.loadPluginsFromDirectory(directory);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Trigger a plugin hook
     * @param {string} hook - Hook name
     * @param {Object} data - Hook data
     */
    server.commandHandlers.trigger_plugin_hook = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      const { hook, data } = params;
      if (!hook) {
        return { success: false, error: 'Hook name is required' };
      }

      try {
        const results = await server.pluginManager.triggerHook(hook, data || {});
        return { success: true, results };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Get available plugin hooks
     */
    server.commandHandlers.get_plugin_hooks = async (params) => {
      if (!server.pluginManager) {
        return { success: false, error: 'Plugin manager not available' };
      }

      try {
        return server.pluginManager.getAvailableHooks();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
}

module.exports = { registerCoreCmds09 };
