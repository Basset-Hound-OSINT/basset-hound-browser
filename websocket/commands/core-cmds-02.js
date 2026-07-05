// Command handlers (switch_tab .. force_terminate_connection) — extracted from
// server.js setupCommandHandlers. 56 handlers. Order preserved.
const D = require('../core/handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

function registerCoreCmds02(server) {
    server.commandHandlers.switch_tab = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId, index } = params;

      let result;
      if (tabId) {
        result = server.tabManager.switchTab(tabId);
      } else if (index !== undefined) {
        result = server.tabManager.switchToTabIndex(index);
      } else {
        return { success: false, error: 'Tab ID or index is required' };
      }

      // Notify renderer to switch webview
      if (result.success) {
        server.mainWindow.webContents.send('tab-switched', {
          tabId: result.tab.id,
          previousTabId: result.previousTabId
        });
      }

      return result;
    };

    // List all tabs
    server.commandHandlers.list_tabs = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { sessionId } = params;
      return server.tabManager.listTabs({ sessionId });
    };

    // Get tab info
    server.commandHandlers.get_tab_info = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      const tab = server.tabManager.getTabInfo(tabId || server.tabManager.activeTabId);

      if (!tab) {
        return { success: false, error: 'Tab not found' };
      }

      return { success: true, tab };
    };

    // Get active tab
    server.commandHandlers.get_active_tab = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const tab = server.tabManager.getActiveTab();

      if (!tab) {
        return { success: false, error: 'No active tab' };
      }

      return { success: true, tab };
    };

    // Navigate tab to URL
    server.commandHandlers.navigate_tab = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId, url } = params;
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

      const result = server.tabManager.navigateTab(tabId, url);

      if (result.success) {
        server.mainWindow.webContents.send('tab-navigate', {
          tabId: result.tabId,
          url: result.url
        });
      }

      return result;
    };

    // Reload tab
    server.commandHandlers.reload_tab = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      const result = server.tabManager.reloadTab(tabId);

      if (result.success) {
        server.mainWindow.webContents.send('tab-reload', { tabId: result.tabId });
      }

      return result;
    };

    // Go back in tab
    server.commandHandlers.tab_back = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      const result = server.tabManager.goBack(tabId);

      if (result.success) {
        server.mainWindow.webContents.send('tab-navigate', {
          tabId: result.tabId,
          url: result.url
        });
      }

      return result;
    };

    // Go forward in tab
    server.commandHandlers.tab_forward = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      const result = server.tabManager.goForward(tabId);

      if (result.success) {
        server.mainWindow.webContents.send('tab-navigate', {
          tabId: result.tabId,
          url: result.url
        });
      }

      return result;
    };

    // Duplicate tab
    server.commandHandlers.duplicate_tab = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      if (!tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      const result = server.tabManager.duplicateTab(tabId);

      if (result.success) {
        server.mainWindow.webContents.send('tab-created', result.tab);
      }

      return result;
    };

    // Pin/unpin tab
    server.commandHandlers.pin_tab = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId, pinned = true } = params;
      if (!tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      return server.tabManager.pinTab(tabId, pinned);
    };

    // Mute/unmute tab
    server.commandHandlers.mute_tab = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId, muted = true } = params;
      if (!tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      const result = server.tabManager.muteTab(tabId, muted);

      if (result.success) {
        server.mainWindow.webContents.send('tab-mute', {
          tabId: result.tab.id,
          muted: result.tab.muted
        });
      }

      return result;
    };

    // Set tab zoom
    server.commandHandlers.set_tab_zoom = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId, zoomLevel } = params;
      if (zoomLevel === undefined) {
        return { success: false, error: 'Zoom level is required' };
      }

      const result = server.tabManager.setZoom(tabId, zoomLevel);

      if (result.success) {
        server.mainWindow.webContents.send('tab-zoom', {
          tabId: result.tabId,
          zoomLevel: result.zoomLevel
        });
      }

      return result;
    };

    // Move tab
    server.commandHandlers.move_tab = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId, newIndex } = params;
      if (!tabId || newIndex === undefined) {
        return { success: false, error: 'Tab ID and new index are required' };
      }

      return server.tabManager.moveTab(tabId, newIndex);
    };

    // Close other tabs
    server.commandHandlers.close_other_tabs = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      if (!tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      const result = server.tabManager.closeOtherTabs(tabId);

      if (result.success) {
        server.mainWindow.webContents.send('tabs-closed-other', { keptTabId: tabId });
      }

      return result;
    };

    // Next tab
    server.commandHandlers.next_tab = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const result = server.tabManager.nextTab();

      if (result.success) {
        server.mainWindow.webContents.send('tab-switched', {
          tabId: result.tab.id,
          previousTabId: result.previousTabId
        });
      }

      return result;
    };

    // Previous tab
    server.commandHandlers.previous_tab = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const result = server.tabManager.previousTab();

      if (result.success) {
        server.mainWindow.webContents.send('tab-switched', {
          tabId: result.tab.id,
          previousTabId: result.previousTabId
        });
      }

      return result;
    };

    // ==================== TAB COMMAND ALIASES ====================
    // These aliases provide alternative command names for tab operations

    // create_tab - Alias for new_tab
    server.commandHandlers.create_tab = async (params) => {
      return server.commandHandlers.new_tab(params);
    };

    // get_tabs - Alias for list_tabs
    server.commandHandlers.get_tabs = async (params) => {
      return server.commandHandlers.list_tabs(params);
    };

    // tab_navigate - Alias for navigate_tab
    server.commandHandlers.tab_navigate = async (params) => {
      return server.commandHandlers.navigate_tab(params);
    };

    // ==================== UTILITY COMMANDS ====================

    // Ping/health check
    server.commandHandlers.ping = async (params) => {
      return { success: true, message: 'pong', timestamp: Date.now() };
    };

    // Get browser status
    server.commandHandlers.status = async (params) => {
      const status = {
        clients: server.clients.size,
        port: server.port,
        ready: true,
        recording: server.recordingManager.getStatus()
      };

      // Add session info if available
      if (server.sessionManager) {
        status.sessions = server.sessionManager.listSessions().sessions.length;
        status.activeSession = server.sessionManager.activeSessionId;
      }

      // Add tab info if available
      if (server.tabManager) {
        status.tabs = server.tabManager.tabs.size;
        status.activeTab = server.tabManager.activeTabId;
      }

      // Phase 3 (OPT-11): Add response serializer stats if available
      if (server.responseSerializer) {
        status.serializer = server.responseSerializer.getStats();
      }

      // Phase 3 (OPT-12): Add GC stats if adaptive GC manager available
      if (server.advancedGCStats) {
        try {
          status.gcMetrics = server.advancedGCStats.getAdaptiveStats();
        } catch (error) {
          server.logger.debug('[Phase3] Error getting GC stats', { error: error.message });
        }
      }

      return {
        success: true,
        status
      };
    };

    // ==========================================
    // v12.9.0: Health & Reliability Commands
    // ==========================================

    // Get full health status with SLA compliance
    server.commandHandlers.getHealth = async (params) => {
      try {
        const healthStatus = await server.healthEndpoint.getFullHealthStatus();
        return {
          success: true,
          ...healthStatus
        };
      } catch (error) {
        server.logger.error(`[getHealth] Error: ${error.message}`);
        return {
          success: false,
          error: error.message
        };
      }
    };

    // Get SLA-focused health status
    server.commandHandlers.getHealthStatus = async (params) => {
      try {
        const reliabilityStatus = await server.healthEndpoint.getReliabilityStatus();
        return {
          success: true,
          ...reliabilityStatus
        };
      } catch (error) {
        server.logger.error(`[getHealthStatus] Error: ${error.message}`);
        return {
          success: false,
          error: error.message
        };
      }
    };

    // ==========================================
    // Request Size Validator Commands
    // ==========================================

    // Get request size validation metrics
    server.commandHandlers.get_request_size_metrics = async (params) => {
      return {
        success: true,
        metrics: server.requestSizeValidator.getMetrics()
      };
    };

    // Get request size limit configuration
    server.commandHandlers.get_request_size_limits = async (params) => {
      return {
        success: true,
        configuration: server.requestSizeValidator.getConfiguration()
      };
    };

    // ==========================================
    // Enhanced Screenshot Commands
    // ==========================================

    // Capture full page screenshot (scroll and stitch)
    server.commandHandlers.screenshot_full_page = async (params) => {
      const {
        format = 'png',
        quality,
        scrollDelay = 100,
        maxHeight = 32000,
        savePath = null
      } = params;

      try {
        const result = await server.screenshotManager.captureFullPage({
          format,
          quality,
          scrollDelay,
          maxHeight
        });

        if (result.success && savePath) {
          const saveResult = await server.screenshotManager.saveToFile(result.data, savePath);
          result.savedTo = saveResult.success ? savePath : null;
          result.saveError = saveResult.error || null;
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Capture screenshot of specific element
    server.commandHandlers.screenshot_element = async (params) => {
      const {
        selector,
        format = 'png',
        quality,
        padding = 0,
        savePath = null
      } = params;

      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }

      try {
        const result = await server.screenshotManager.captureElement(selector, {
          format,
          quality,
          padding
        });

        if (result.success && savePath) {
          const saveResult = await server.screenshotManager.saveToFile(result.data, savePath);
          result.savedTo = saveResult.success ? savePath : null;
          result.saveError = saveResult.error || null;
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Capture screenshot of specific area (coordinates)
    server.commandHandlers.screenshot_area = async (params) => {
      const {
        x,
        y,
        width,
        height,
        format = 'png',
        quality,
        savePath = null
      } = params;

      if (x === undefined || y === undefined || width === undefined || height === undefined) {
        return { success: false, error: 'x, y, width, and height are required' };
      }

      try {
        const result = await server.screenshotManager.captureArea(
          { x, y, width, height },
          { format, quality }
        );

        if (result.success && savePath) {
          const saveResult = await server.screenshotManager.saveToFile(result.data, savePath);
          result.savedTo = saveResult.success ? savePath : null;
          result.saveError = saveResult.error || null;
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Capture viewport screenshot with enhanced options
    server.commandHandlers.screenshot_viewport = async (params) => {
      const {
        format = 'png',
        quality,
        savePath = null
      } = params;

      try {
        let result = await server.screenshotManager.captureViewport({
          format,
          quality
        });

        // If webview capture failed due to headless mode, try fallbacks
        if (!result.success && (result.needsMainProcessCapture || result.error?.includes('headless') || result.error?.includes('empty'))) {
          server.logger.info('[WebSocket] Viewport screenshot failed, attempting main window capture');

          // Try main window capture
          try {
            const image = await server.mainWindow.webContents.capturePage();
            if (!image.isEmpty()) {
              const dataUrl = image.toDataURL();
              if (dataUrl.length >= 100) {
                result = {
                  success: true,
                  data: dataUrl,
                  captureMethod: 'mainWindow',
                  width: image.getSize().width,
                  height: image.getSize().height,
                  note: 'Captured from main window (includes browser chrome) due to headless mode'
                };
              }
            }
          } catch (mainWindowError) {
            server.logger.info('[WebSocket] Main window capture failed:', mainWindowError.message);
          }

          // If still failed, try headless manager's offscreen frame
          if (!result.success && server.headlessManager && server.headlessManager.offscreenRenderingEnabled) {
            server.logger.info('[WebSocket] Attempting offscreen frame capture');
            const frameResult = server.headlessManager.captureFromLastFrame();
            if (frameResult.success) {
              result = frameResult;
            }
          }
        }

        if (result.success && savePath) {
          const saveResult = await server.screenshotManager.saveToFile(result.data, savePath);
          result.savedTo = saveResult.success ? savePath : null;
          result.saveError = saveResult.error || null;
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Annotate screenshot
    server.commandHandlers.annotate_screenshot = async (params) => {
      const { imageData, annotations } = params;

      if (!imageData) {
        return { success: false, error: 'imageData is required' };
      }

      if (!annotations || !Array.isArray(annotations) || annotations.length === 0) {
        return { success: false, error: 'annotations array is required' };
      }

      // Validate all annotations
      for (let i = 0; i < annotations.length; i++) {
        const validation = validateAnnotation(annotations[i]);
        if (!validation.valid) {
          return { success: false, error: `Annotation ${i}: ${validation.error}` };
        }
      }

      // Apply defaults to annotations
      const processedAnnotations = annotations.map(applyAnnotationDefaults);

      try {
        const result = await server.screenshotManager.annotateScreenshot(imageData, processedAnnotations);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get supported screenshot formats
    server.commandHandlers.screenshot_formats = async (params) => {
      return {
        success: true,
        formats: server.screenshotManager.getSupportedFormats()
      };
    };

    // ==========================================
    // Screen Recording Commands
    // ==========================================

    // Start screen recording
    server.commandHandlers.start_recording = async (params) => {
      const {
        format = 'webm',
        quality = 'medium',
        includeAudio = false,
        filename = null
      } = params;

      try {
        const result = await server.recordingManager.startRecording({
          format,
          quality,
          includeAudio,
          filename
        });

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Stop screen recording
    server.commandHandlers.stop_recording = async (params) => {
      const {
        savePath = null,
        returnData = true
      } = params;

      try {
        const result = await server.recordingManager.stopRecording({
          savePath,
          returnData
        });

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Pause screen recording
    server.commandHandlers.pause_recording = async (params) => {
      try {
        const result = await server.recordingManager.pauseRecording();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Resume screen recording
    server.commandHandlers.resume_recording = async (params) => {
      try {
        const result = await server.recordingManager.resumeRecording();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get recording status
    server.commandHandlers.recording_status = async (params) => {
      try {
        const status = server.recordingManager.getStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available recording sources
    server.commandHandlers.recording_sources = async (params) => {
      try {
        const result = await server.recordingManager.getAvailableSources();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get supported recording formats and quality presets
    server.commandHandlers.recording_formats = async (params) => {
      return {
        success: true,
        formats: server.recordingManager.getSupportedFormats(),
        qualityPresets: server.recordingManager.getQualityPresets()
      };
    };

    // ==========================================
    // Proxy Management Commands
    // ==========================================

    // Set proxy configuration
    server.commandHandlers.set_proxy = async (params) => {
      const { host, port, type, auth, bypassRules } = params;

      if (!host || !port) {
        return { success: false, error: 'Host and port are required' };
      }

      try {
        const result = await proxyManager.setProxy({
          host,
          port,
          type: type || 'http',
          auth,
          bypassRules
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear proxy (use direct connection)
    server.commandHandlers.clear_proxy = async (params) => {
      try {
        const result = await proxyManager.clearProxy();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get proxy status
    server.commandHandlers.get_proxy_status = async (params) => {
      try {
        const status = proxyManager.getProxyStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set proxy list for rotation
    server.commandHandlers.set_proxy_list = async (params) => {
      const { proxies } = params;

      if (!proxies || !Array.isArray(proxies)) {
        return { success: false, error: 'Proxies array is required' };
      }

      try {
        const result = proxyManager.setProxyList(proxies);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add a proxy to rotation list
    server.commandHandlers.add_proxy = async (params) => {
      const { host, port, type, auth } = params;

      if (!host || !port) {
        return { success: false, error: 'Host and port are required' };
      }

      try {
        const result = proxyManager.addProxy({
          host,
          port,
          type: type || 'http',
          auth
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Remove a proxy from rotation list
    server.commandHandlers.remove_proxy = async (params) => {
      const { host, port } = params;

      if (!host || !port) {
        return { success: false, error: 'Host and port are required' };
      }

      try {
        const result = proxyManager.removeProxy(host, port);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Rotate to next proxy
    server.commandHandlers.rotate_proxy = async (params) => {
      try {
        const result = await proxyManager.rotateProxy();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Start proxy rotation
    server.commandHandlers.start_proxy_rotation = async (params) => {
      const { intervalMs, mode, rotateAfterRequests } = params;

      try {
        const result = proxyManager.startRotation({
          intervalMs,
          mode,
          rotateAfterRequests
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Stop proxy rotation
    server.commandHandlers.stop_proxy_rotation = async (params) => {
      try {
        const result = proxyManager.stopRotation();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Test proxy connection
    server.commandHandlers.test_proxy = async (params) => {
      const { host, port, type, auth } = params;

      if (!host || !port) {
        return { success: false, error: 'Host and port are required' };
      }

      try {
        const result = await proxyManager.testProxy({
          host,
          port,
          type: type || 'http',
          auth
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get proxy statistics
    server.commandHandlers.get_proxy_stats = async (params) => {
      try {
        const stats = proxyManager.getStats();
        return { success: true, stats };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available proxy types
    server.commandHandlers.get_proxy_types = async (params) => {
      return {
        success: true,
        types: Object.values(PROXY_TYPES)
      };
    };

    // ==========================================
    // Tor Integration Commands
    // ==========================================

    // Connect to Tor network
    server.commandHandlers.connect_tor = async (params) => {
      try {
        const options = {};
        if (params.socksHost) {
          options.socksHost = params.socksHost;
        }
        if (params.socksPort) {
          options.socksPort = params.socksPort;
        }
        if (params.controlHost) {
          options.controlHost = params.controlHost;
        }
        if (params.controlPort) {
          options.controlPort = params.controlPort;
        }
        if (params.controlPassword) {
          options.controlPassword = params.controlPassword;
        }

        const result = await proxyManager.connectTor(options);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Disconnect from Tor network
    server.commandHandlers.disconnect_tor = async (params) => {
      try {
        const result = await proxyManager.disconnectTor();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get Tor connection status
    server.commandHandlers.get_tor_status = async (params) => {
      try {
        const status = proxyManager.getTorStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Connection Lifecycle Monitoring Commands
    // ==========================================
    // Get connection metrics and zombie connection statistics
    server.commandHandlers.get_connection_metrics = async (params) => {
      try {
        const metrics = server.connectionManager.getMetrics();
        return {
          success: true,
          metrics,
          gracePeriodMs: server.connectionManager.gracePeriodMs,
          checkIntervalMs: server.connectionManager.checkIntervalMs
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get detailed connection status for all connected clients
    server.commandHandlers.get_connection_status = async (params) => {
      try {
        const status = server.connectionManager.getConnectionStatus();
        return {
          success: true,
          connections: status,
          totalConnections: status.length,
          zombieCount: status.filter(c => c.isZombie).length
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Force terminate a specific zombie connection (admin command)
    server.commandHandlers.force_terminate_connection = async (params) => {
      try {
        if (!params.clientId) {
          return { success: false, error: 'clientId parameter required' };
        }
        const result = server.connectionManager.forceTerminate(params.clientId, {
          reason: 'admin_forced_termination'
        });
        return {
          success: result,
          message: result ? 'Connection terminated' : 'Connection not found'
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
}

module.exports = { registerCoreCmds02 };
