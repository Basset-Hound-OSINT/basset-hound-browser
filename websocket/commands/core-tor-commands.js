// Advanced Tor Integration Commands — extracted from server.js setupCommandHandlers.
// Preserves the lazy advancedTorManager closure that these handlers share.
const D = require('../core/handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

function registerCoreTorCommands(server) {
let advancedTorManager = null;
    const getAdvancedTorManager = () => {
      if (!advancedTorManager) {
        try {
          const torAdvanced = require('../../proxy/tor-advanced');
          advancedTorManager = torAdvanced.advancedTorManager;
        } catch (error) {
          server.logger.error('[WebSocket] Failed to load AdvancedTorManager:', error.message);
        }
      }
      return advancedTorManager;
    };

    // Start Tor daemon
    server.commandHandlers.tor_start = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        if (params.torBinaryPath) {
          tor.configure({ torBinaryPath: params.torBinaryPath });
        }
        if (params.dataDirectory) {
          tor.configure({ dataDirectory: params.dataDirectory });
        }

        const result = await tor.start();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Stop Tor daemon
    server.commandHandlers.tor_stop = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.stop();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Restart Tor daemon
    server.commandHandlers.tor_restart = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.restart();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Connect to existing Tor instance
    server.commandHandlers.tor_connect_existing = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.connectExisting(params);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get advanced Tor status
    server.commandHandlers.tor_status = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const status = tor.getStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set exit countries
    server.commandHandlers.tor_set_exit_country = async (params) => {
      const { countries } = params;

      if (!countries) {
        return { success: false, error: 'Countries parameter is required (string or array)' };
      }

      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.setExitCountries(countries);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Exclude countries from exit nodes
    server.commandHandlers.tor_exclude_countries = async (params) => {
      const { countries } = params;

      if (!countries) {
        return { success: false, error: 'Countries parameter is required (string or array)' };
      }

      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.excludeExitCountries(countries);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set entry countries
    server.commandHandlers.tor_set_entry_country = async (params) => {
      const { countries } = params;

      if (!countries) {
        return { success: false, error: 'Countries parameter is required (string or array)' };
      }

      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.setEntryCountries(countries);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear exit restrictions
    server.commandHandlers.tor_clear_exit_restrictions = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.clearExitRestrictions();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get circuit information
    server.commandHandlers.tor_get_circuits = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.getCircuitInfo();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get circuit path with node details
    server.commandHandlers.tor_get_circuit_path = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.getCircuitPath(params.circuitId);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Rebuild circuit (new identity)
    server.commandHandlers.tor_rebuild_circuit = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.newIdentity();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // New identity (user-friendly alias for tor_rebuild_circuit)
    server.commandHandlers.tor_new_identity = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.newIdentity();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get detailed exit node information
    server.commandHandlers.tor_get_exit_info = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.getExitInfo();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Close specific circuit
    server.commandHandlers.tor_close_circuit = async (params) => {
      const { circuitId } = params;

      if (!circuitId) {
        return { success: false, error: 'Circuit ID is required' };
      }

      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.closeCircuit(circuitId);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Enable bridges
    server.commandHandlers.tor_enable_bridges = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.enableBridges({
          transport: params.transport || 'obfs4',
          bridges: params.bridges,
          useBuiltin: params.useBuiltin !== false
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add custom bridge
    server.commandHandlers.tor_add_bridge = async (params) => {
      const { bridge } = params;

      if (!bridge) {
        return { success: false, error: 'Bridge line is required' };
      }

      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = tor.addBridge(bridge);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Disable bridges
    server.commandHandlers.tor_disable_bridges = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.disableBridges();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set pluggable transport
    server.commandHandlers.tor_set_transport = async (params) => {
      const { transport, bridges, useBuiltin } = params;

      if (!transport) {
        return { success: false, error: 'Transport type is required (obfs4, meek, snowflake, webtunnel)' };
      }

      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.enableBridges({ transport, bridges, useBuiltin: useBuiltin !== false });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set stream isolation mode
    server.commandHandlers.tor_set_isolation = async (params) => {
      const { mode } = params;

      if (!mode) {
        return { success: false, error: 'Isolation mode is required (none, per_tab, per_domain, per_session)' };
      }

      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = tor.setIsolationMode(mode);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get isolated port for key
    server.commandHandlers.tor_get_isolated_port = async (params) => {
      const { key } = params;

      if (!key) {
        return { success: false, error: 'Isolation key is required (e.g., tab ID or domain)' };
      }

      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = tor.getIsolatedPort(key);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Check real exit IP
    server.commandHandlers.tor_check_connection = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.checkExitIp();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get bandwidth statistics
    server.commandHandlers.tor_get_bandwidth = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.getBandwidth();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get network consensus info
    server.commandHandlers.tor_get_consensus = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.getConsensusInfo();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get relay count
    server.commandHandlers.tor_get_relay_count = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.getRelayCount();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Create onion service
    server.commandHandlers.tor_create_onion_service = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.createOnionService({
          port: params.port || 80,
          targetPort: params.targetPort || 8080,
          targetHost: params.targetHost || '127.0.0.1'
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Remove onion service
    server.commandHandlers.tor_remove_onion_service = async (params) => {
      const { serviceId } = params;

      if (!serviceId) {
        return { success: false, error: 'Service ID is required' };
      }

      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.removeOnionService(serviceId);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // List onion services
    server.commandHandlers.tor_list_onion_services = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = await tor.listOnionServices();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Check if URL is onion
    server.commandHandlers.tor_is_onion_url = async (params) => {
      const { url } = params;

      if (!url) {
        return { success: false, error: 'URL is required' };
      }

      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = tor.isOnionUrl(url);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available country codes
    server.commandHandlers.tor_get_country_codes = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = tor.getCountryCodes();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available transport types
    server.commandHandlers.tor_get_transports = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = tor.getTransportTypes();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Configure Tor manager
    server.commandHandlers.tor_configure = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const result = tor.configure(params);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get proxy config for Electron session
    server.commandHandlers.tor_get_proxy_config = async (params) => {
      try {
        const tor = getAdvancedTorManager();
        if (!tor) {
          return { success: false, error: 'Advanced Tor manager not available' };
        }

        const config = tor.getProxyConfig(params.isolationKey);
        const rules = tor.getProxyRules(params.isolationKey);
        return {
          success: true,
          config,
          rules
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
}

module.exports = { registerCoreTorCommands };
