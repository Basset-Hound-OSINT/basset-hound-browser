// Command handlers (mouse_hover .. inspect_element) — extracted from
// server.js setupCommandHandlers. 55 handlers. Order preserved.
const D = require('../core/handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

function registerCoreCmds05(server) {
    server.commandHandlers.mouse_hover = async (params) => {
      const {
        x,
        y,
        duration = 500,
        humanize = true
      } = params;

      if (x === undefined || y === undefined) {
        return { success: false, error: 'X and Y coordinates are required' };
      }

      if (humanize) {
        await humanDelay(20, 80);
      }

      try {
        const script = mouse.getMouseHoverScript(x, y, {
          duration,
          moveFirst: humanize
        });

        const result = await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Scroll at position with momentum
    server.commandHandlers.mouse_scroll = async (params) => {
      const {
        x = null,
        y = null,
        deltaY = 300,
        deltaX = 0,
        momentum = true,
        selector = null,
        humanize = true
      } = params;

      if (humanize) {
        await humanDelay(30, 100);
      }

      try {
        const script = mouse.getMouseScrollScript({
          x,
          y,
          deltaY,
          deltaX,
          momentum: momentum && humanize,
          selector
        });

        const result = await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Mouse wheel event
    server.commandHandlers.mouse_wheel = async (params) => {
      const {
        x = null,
        y = null,
        deltaY = 100,
        deltaX = 0,
        deltaMode = 0
      } = params;

      try {
        const script = mouse.getMouseWheelScript({
          x,
          y,
          deltaY,
          deltaX,
          deltaMode
        });

        const result = await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Click on element by selector
    server.commandHandlers.click_at_element = async (params) => {
      const {
        selector,
        button = 'left',
        clickCount = 1,
        offsetX = 0.5,
        offsetY = 0.5,
        humanize = true
      } = params;

      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }

      if (humanize) {
        await humanDelay(50, 150);
      }

      try {
        const script = mouse.getClickElementScript(selector, {
          button,
          clickCount,
          offset: { x: offsetX, y: offsetY }
        });

        const result = await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Initialize mouse position tracking
    server.commandHandlers.init_mouse_tracking = async (params) => {
      try {
        const script = mouse.getMousePositionTrackingScript();

        const result = await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
        return { success: true, position: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get current mouse position
    server.commandHandlers.get_mouse_position = async (params) => {
      try {
        const script = `
          (function() {
            return window.__lastMousePos || { x: null, y: null, tracked: false };
          })();
        `;

        const result = await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script
        );
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Network Throttling Commands
    // ==========================================

    // Set custom network throttling speeds
    server.commandHandlers.set_network_throttling = async (params) => {
      if (!server.networkThrottler) {
        return { success: false, error: 'Network throttler not available' };
      }

      const { download, upload, latency } = params;

      try {
        const result = await server.networkThrottler.setThrottling(download, upload, latency);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set network throttling using a preset profile
    server.commandHandlers.set_network_preset = async (params) => {
      if (!server.networkThrottler) {
        return { success: false, error: 'Network throttler not available' };
      }

      const { preset } = params;
      if (!preset) {
        return { success: false, error: 'Preset name is required' };
      }

      try {
        const result = await server.networkThrottler.setPreset(preset);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available network throttling presets
    server.commandHandlers.get_network_presets = async (params) => {
      if (!server.networkThrottler) {
        return { success: false, error: 'Network throttler not available' };
      }

      try {
        return server.networkThrottler.getPresets();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Enable network throttling
    server.commandHandlers.enable_throttling = async (params) => {
      if (!server.networkThrottler) {
        return { success: false, error: 'Network throttler not available' };
      }

      try {
        const result = await server.networkThrottler.enable();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Disable network throttling
    server.commandHandlers.disable_throttling = async (params) => {
      if (!server.networkThrottler) {
        return { success: false, error: 'Network throttler not available' };
      }

      try {
        const result = await server.networkThrottler.disable();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get current network throttling status
    server.commandHandlers.get_throttling_status = async (params) => {
      if (!server.networkThrottler) {
        return { success: false, error: 'Network throttler not available' };
      }

      try {
        const status = server.networkThrottler.getStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Geolocation Spoofing Commands
    // ==========================================

    // Set geolocation with custom coordinates
    server.commandHandlers.set_geolocation = async (params) => {
      if (!server.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed, timezone } = params;

      if (latitude === undefined || longitude === undefined) {
        return { success: false, error: 'Latitude and longitude are required' };
      }

      try {
        const result = server.geolocationManager.setLocation(latitude, longitude, {
          accuracy, altitude, altitudeAccuracy, heading, speed, timezone
        });

        if (result.success && server.geolocationManager.isEnabled()) {
          server.mainWindow.webContents.send('inject-geolocation-script', server.geolocationManager.getFullSpoofScript());
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set geolocation by city name
    server.commandHandlers.set_geolocation_city = async (params) => {
      if (!server.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      const { city } = params;
      if (!city) {
        return { success: false, error: 'City name is required' };
      }

      try {
        const result = server.geolocationManager.setLocationByCity(city);

        if (result.success && server.geolocationManager.isEnabled()) {
          server.mainWindow.webContents.send('inject-geolocation-script', server.geolocationManager.getFullSpoofScript());
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get current geolocation settings
    server.commandHandlers.get_geolocation = async (params) => {
      if (!server.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      try {
        const location = server.geolocationManager.getLocation();
        return { success: true, ...location };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Enable geolocation spoofing
    server.commandHandlers.enable_geolocation_spoofing = async (params) => {
      if (!server.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      try {
        const result = server.geolocationManager.enableSpoofing();

        if (result.success) {
          server.mainWindow.webContents.send('inject-geolocation-script', server.geolocationManager.getFullSpoofScript());
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Disable geolocation spoofing
    server.commandHandlers.disable_geolocation_spoofing = async (params) => {
      if (!server.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      try {
        return server.geolocationManager.disableSpoofing();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available preset locations
    server.commandHandlers.get_preset_locations = async (params) => {
      if (!server.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      try {
        const { country, region } = params || {};
        const presets = server.geolocationManager.getPresetLocations({ country, region });
        return { success: true, presets };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get geolocation spoofing status
    server.commandHandlers.get_geolocation_status = async (params) => {
      if (!server.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      try {
        const status = server.geolocationManager.getStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Reset geolocation to default
    server.commandHandlers.reset_geolocation = async (params) => {
      if (!server.geolocationManager) {
        return { success: false, error: 'Geolocation manager not available' };
      }

      try {
        return server.geolocationManager.reset();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Header Management Commands
    // ==========================================

    // Set a request header
    server.commandHandlers.set_request_header = async (params) => {
      if (!server.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { name, value } = params;
      if (!name) {
        return { success: false, error: 'Header name is required' };
      }
      try {
        return server.headerManager.setRequestHeader(name, value);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Remove a request header
    server.commandHandlers.remove_request_header = async (params) => {
      if (!server.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { name } = params;
      if (!name) {
        return { success: false, error: 'Header name is required' };
      }
      try {
        return server.headerManager.removeRequestHeader(name);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set a response header
    server.commandHandlers.set_response_header = async (params) => {
      if (!server.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { name, value } = params;
      if (!name) {
        return { success: false, error: 'Header name is required' };
      }
      try {
        return server.headerManager.setResponseHeader(name, value);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get all custom headers
    server.commandHandlers.get_custom_headers = async (params) => {
      if (!server.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      try {
        const requestHeaders = server.headerManager.getRequestHeaders();
        const responseHeaders = server.headerManager.getResponseHeaders();
        return { success: true, requestHeaders, responseHeaders };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear all headers
    server.commandHandlers.clear_headers = async (params) => {
      if (!server.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { type } = params;
      try {
        if (type === 'request') {
          return server.headerManager.clearRequestHeaders();
        }
        if (type === 'response') {
          return server.headerManager.clearResponseHeaders();
        }
        return server.headerManager.clearAllHeaders();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Create a header profile
    server.commandHandlers.create_header_profile = async (params) => {
      if (!server.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { name, headers } = params;
      if (!name) {
        return { success: false, error: 'Profile name is required' };
      }
      try {
        return server.headerManager.createHeaderProfile(name, headers || {});
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Load a header profile
    server.commandHandlers.load_header_profile = async (params) => {
      if (!server.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { name } = params;
      if (!name) {
        return { success: false, error: 'Profile name is required' };
      }
      try {
        return server.headerManager.loadHeaderProfile(name);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // List all header profiles
    server.commandHandlers.list_header_profiles = async (params) => {
      if (!server.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      try {
        const result = server.headerManager.listHeaderProfiles();
        return { ...result, predefinedProfiles: getPredefinedProfileNames() };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set a conditional header (URL-based rule)
    server.commandHandlers.set_conditional_header = async (params) => {
      if (!server.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      const { pattern, name, value, type = 'request' } = params;
      if (!pattern || !name) {
        return { success: false, error: 'Pattern and header name are required' };
      }
      try {
        if (type === 'response') {
          return server.headerManager.setConditionalResponseHeader(pattern, name, value);
        }
        return server.headerManager.setConditionalHeader(pattern, name, value);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get header manager status
    server.commandHandlers.get_header_status = async (params) => {
      if (!server.headerManager) {
        return { success: false, error: 'Header manager not available' };
      }
      try {
        return { success: true, status: server.headerManager.getStatus() };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get predefined profiles list
    server.commandHandlers.get_predefined_header_profiles = async (params) => {
      return {
        success: true,
        profiles: Object.keys(PREDEFINED_PROFILES).map(name => ({
          name,
          description: PREDEFINED_PROFILES[name].description || name
        }))
      };
    };

    // ==========================================
    // Browser Profile Management Commands
    // ==========================================

    // Create a new browser profile
    server.commandHandlers.create_profile = async (params) => {
      if (!server.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { name, userAgent, fingerprint, proxy } = params;
      return server.profileManager.createProfile({ name, userAgent, fingerprint, proxy });
    };

    // Delete a browser profile
    server.commandHandlers.delete_profile = async (params) => {
      if (!server.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId } = params;
      if (!profileId) {
        return { success: false, error: 'Profile ID is required' };
      }

      return await server.profileManager.deleteProfile(profileId);
    };

    // Get profile details
    server.commandHandlers.get_profile = async (params) => {
      if (!server.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId } = params;
      if (!profileId) {
        return { success: false, error: 'Profile ID is required' };
      }

      return server.profileManager.getProfile(profileId);
    };

    // List all browser profiles
    server.commandHandlers.list_profiles = async (params) => {
      if (!server.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      return server.profileManager.listProfiles();
    };

    // Switch to a different browser profile
    server.commandHandlers.switch_profile = async (params) => {
      if (!server.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId } = params;
      if (!profileId) {
        return { success: false, error: 'Profile ID is required' };
      }

      const result = await server.profileManager.switchProfile(profileId);

      // Notify renderer to update partition and apply fingerprint
      if (result.success) {
        server.mainWindow.webContents.send('profile-changed', {
          profileId,
          partition: result.partition,
          profile: result.profile
        });
      }

      return result;
    };

    // Update a browser profile
    server.commandHandlers.update_profile = async (params) => {
      if (!server.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId, updates } = params;
      if (!profileId) {
        return { success: false, error: 'Profile ID is required' };
      }
      if (!updates) {
        return { success: false, error: 'Updates object is required' };
      }

      return server.profileManager.updateProfile(profileId, updates);
    };

    // Export a browser profile to JSON
    server.commandHandlers.export_profile = async (params) => {
      if (!server.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId } = params;
      return await server.profileManager.exportProfile(profileId);
    };

    // Import a browser profile from JSON
    server.commandHandlers.import_profile = async (params) => {
      if (!server.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { data } = params;
      if (!data) {
        return { success: false, error: 'Profile data is required' };
      }

      return await server.profileManager.importProfile(data);
    };

    // Randomize a profile's fingerprint
    server.commandHandlers.randomize_profile_fingerprint = async (params) => {
      if (!server.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId } = params;
      if (!profileId) {
        return { success: false, error: 'Profile ID is required' };
      }

      return server.profileManager.randomizeFingerprint(profileId);
    };

    // Get the active browser profile
    server.commandHandlers.get_active_profile = async (params) => {
      if (!server.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const profile = server.profileManager.getActiveProfile();
      if (!profile) {
        return { success: false, error: 'No active profile' };
      }

      return { success: true, profile: profile.toJSON() };
    };

    // Get the fingerprint evasion script for a profile
    server.commandHandlers.get_profile_evasion_script = async (params) => {
      if (!server.profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }

      const { profileId } = params;
      return { success: true, script: server.profileManager.getEvasionScript(profileId) };
    };

    // ==========================================
    // Storage Management Commands
    // ==========================================

    // Get localStorage for origin
    server.commandHandlers.get_local_storage = async (params) => {
      if (!server.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await server.storageManager.getLocalStorage(origin);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set localStorage item
    server.commandHandlers.set_local_storage = async (params) => {
      if (!server.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin, key, value } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }
      if (!key) {
        return { success: false, error: 'Key is required' };
      }

      try {
        return await server.storageManager.setLocalStorageItem(origin, key, value);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear localStorage for origin
    server.commandHandlers.clear_local_storage = async (params) => {
      if (!server.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await server.storageManager.clearLocalStorage(origin);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get sessionStorage for origin
    server.commandHandlers.get_session_storage = async (params) => {
      if (!server.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await server.storageManager.getSessionStorage(origin);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set sessionStorage item
    server.commandHandlers.set_session_storage = async (params) => {
      if (!server.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin, key, value } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }
      if (!key) {
        return { success: false, error: 'Key is required' };
      }

      try {
        return await server.storageManager.setSessionStorageItem(origin, key, value);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear sessionStorage for origin
    server.commandHandlers.clear_session_storage = async (params) => {
      if (!server.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await server.storageManager.clearSessionStorage(origin);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get IndexedDB databases for origin
    server.commandHandlers.get_indexeddb = async (params) => {
      if (!server.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await server.storageManager.getIndexedDBDatabases(origin);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Delete IndexedDB database
    server.commandHandlers.delete_indexeddb = async (params) => {
      if (!server.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin, name } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }
      if (!name) {
        return { success: false, error: 'Database name is required' };
      }

      try {
        return await server.storageManager.deleteIndexedDBDatabase(origin, name);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Export storage for origin
    server.commandHandlers.export_storage = async (params) => {
      if (!server.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin, types, filepath } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        if (filepath) {
          return await server.storageManager.exportStorageToFile(filepath, origin, types);
        }
        return await server.storageManager.exportStorage(origin, types);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Import storage for origin
    server.commandHandlers.import_storage = async (params) => {
      if (!server.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin, data, filepath } = params;

      try {
        if (filepath) {
          return await server.storageManager.importStorageFromFile(filepath, origin);
        }
        if (!data) {
          return { success: false, error: 'Data or filepath is required' };
        }
        return await server.storageManager.importStorage(origin, data);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get storage statistics for origin
    server.commandHandlers.get_storage_stats = async (params) => {
      if (!server.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await server.storageManager.getStorageStats(origin);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear all storage for origin
    server.commandHandlers.clear_all_storage = async (params) => {
      if (!server.storageManager) {
        return { success: false, error: 'Storage manager not available' };
      }

      const { origin, types } = params;
      if (!origin) {
        return { success: false, error: 'Origin is required' };
      }

      try {
        return await server.storageManager.clearAllStorage(origin, types);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // DOM Inspector Commands
    // ==========================================

    server.commandHandlers.inspect_element = async (params) => {
      const { selector } = params;
      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }
      try {
        const script = server.domInspector.getElement(selector);
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
}

module.exports = { registerCoreCmds05 };
