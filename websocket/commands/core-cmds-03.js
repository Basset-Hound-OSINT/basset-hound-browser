// Command handlers (new_tor_identity .. get_tor_mode) — extracted from
// server.js setupCommandHandlers. 8 handlers. Order preserved.
const D = require('../core/handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

function registerCoreCmds03(server) {
    server.commandHandlers.new_tor_identity = async (params) => {
      try {
        const result = await proxyManager.newTorIdentity();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get current Tor exit node IP
    server.commandHandlers.get_exit_ip = async (params) => {
      try {
        const result = await proxyManager.getTorExitIp();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Dynamic Tor Routing Commands
    // ==========================================
    // These commands allow enabling/disabling Tor routing at runtime
    // without requiring TOR_MODE at startup.
    //
    // tor_start/tor_stop control the Tor daemon
    // tor_enable/tor_disable control whether traffic is routed through Tor
    //
    // Example workflow:
    // 1. tor_start - Start the Tor daemon
    // 2. tor_enable - Route browser traffic through Tor
    // 3. ... (browse anonymously)
    // 4. tor_disable - Stop routing (direct connection)
    // 5. ... (browse directly)
    // 6. tor_enable - Route through Tor again
    // 7. tor_stop - Stop the daemon when done
    // ==========================================

    // Enable Tor routing - route all browser traffic through Tor SOCKS proxy
    server.commandHandlers.tor_enable = async (params) => {
      try {
        const options = {};
        if (params.socksHost) {
          options.socksHost = params.socksHost;
        }
        if (params.socksPort) {
          options.socksPort = parseInt(params.socksPort, 10);
        }

        const result = await proxyManager.enableTorRouting(options);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Disable Tor routing - return to direct connection (does NOT stop Tor daemon)
    server.commandHandlers.tor_disable = async (params) => {
      try {
        const result = await proxyManager.disableTorRouting();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Toggle Tor routing state
    server.commandHandlers.tor_toggle = async (params) => {
      try {
        const options = {};
        if (params.socksHost) {
          options.socksHost = params.socksHost;
        }
        if (params.socksPort) {
          options.socksPort = parseInt(params.socksPort, 10);
        }

        const result = await proxyManager.toggleTorRouting(options);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get current Tor routing status
    server.commandHandlers.get_tor_routing_status = async (params) => {
      try {
        const result = await proxyManager.getTorRoutingStatus();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Tor Master Switch Commands
    // ==========================================
    // The master switch provides three modes:
    // - OFF: Never route through Tor (direct connection)
    // - ON: Always route through Tor (maximum anonymity)
    // - AUTO: Intelligently switch based on .onion URL detection
    //
    // AUTO mode is useful for investigations where sites might
    // redirect to Tor-facing pages. The system will automatically
    // enable Tor routing when navigating to .onion domains.
    // ==========================================

    // Set Tor master switch mode
    server.commandHandlers.set_tor_mode = async (params) => {
      try {
        const mode = params.mode;
        if (!mode) {
          return {
            success: false,
            error: 'Mode is required. Must be one of: off, on, auto'
          };
        }

        const options = {};
        if (params.socksHost) {
          options.socksHost = params.socksHost;
        }
        if (params.socksPort) {
          options.socksPort = parseInt(params.socksPort, 10);
        }

        const result = await proxyManager.setTorMasterMode(mode, options);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get current Tor master switch mode and status
    server.commandHandlers.get_tor_mode = async (params) => {
      try {
        const result = await proxyManager.getTorMasterMode();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
}

module.exports = { registerCoreCmds03 };
