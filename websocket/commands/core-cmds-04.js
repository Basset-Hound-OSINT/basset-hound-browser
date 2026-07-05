// Command handlers (set_proxy_chain .. mouse_drag) — extracted from
// server.js setupCommandHandlers. 56 handlers. Order preserved.
const D = require('../core/handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

function registerCoreCmds04(server) {
    server.commandHandlers.set_proxy_chain = async (params) => {
      const { proxies, chainType, failoverEnabled, bypassRules } = params;

      if (!proxies || !Array.isArray(proxies)) {
        return { success: false, error: 'Proxies array is required' };
      }

      try {
        const result = await proxyManager.setProxyChain(proxies, {
          chainType,
          failoverEnabled,
          bypassRules
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get current proxy chain configuration
    server.commandHandlers.get_proxy_chain = async (params) => {
      try {
        const config = proxyManager.getProxyChainConfig();
        return { success: true, ...config };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Test proxy chain connectivity
    server.commandHandlers.test_proxy_chain = async (params) => {
      try {
        const result = await proxyManager.testProxyChain();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear proxy chain
    server.commandHandlers.clear_proxy_chain = async (params) => {
      try {
        const result = await proxyManager.clearProxyChain();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get extended proxy status (includes Tor and Chain info)
    server.commandHandlers.get_extended_proxy_status = async (params) => {
      try {
        const status = proxyManager.getExtendedStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available proxy modes
    server.commandHandlers.get_proxy_modes = async (params) => {
      try {
        const modes = proxyManager.getAvailableModes();
        return { success: true, ...modes };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // User Agent Management Commands
    // ==========================================

    // Set user agent
    server.commandHandlers.set_user_agent = async (params) => {
      const { userAgent, category } = params;

      try {
        let ua = userAgent;

        // If category is provided, get a random user agent from that category
        if (category && !userAgent) {
          ua = userAgentManager.getUserAgentByCategory(category);
          if (!ua) {
            return {
              success: false,
              error: `Invalid category: ${category}`,
              availableCategories: Object.keys(UA_CATEGORIES)
            };
          }
        }

        if (!ua) {
          return { success: false, error: 'User agent or category is required' };
        }

        const result = userAgentManager.setUserAgent(ua, server.mainWindow);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get random user agent
    server.commandHandlers.get_random_user_agent = async (params) => {
      const { category } = params;

      try {
        let userAgent;
        if (category) {
          userAgent = userAgentManager.getUserAgentByCategory(category);
          if (!userAgent) {
            return {
              success: false,
              error: `Invalid category: ${category}`,
              availableCategories: Object.keys(UA_CATEGORIES)
            };
          }
        } else {
          userAgent = userAgentManager.getRandomUserAgent();
        }

        return { success: true, userAgent };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Rotate user agent
    server.commandHandlers.rotate_user_agent = async (params) => {
      try {
        const result = userAgentManager.rotateUserAgent(server.mainWindow);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Start user agent rotation
    server.commandHandlers.start_user_agent_rotation = async (params) => {
      const { intervalMs, mode, rotateAfterRequests } = params;

      try {
        const result = userAgentManager.startRotation(server.mainWindow, {
          intervalMs,
          mode,
          rotateAfterRequests
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Stop user agent rotation
    server.commandHandlers.stop_user_agent_rotation = async (params) => {
      try {
        const result = userAgentManager.stopRotation();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set enabled user agent categories
    server.commandHandlers.set_user_agent_categories = async (params) => {
      const { categories } = params;

      if (!categories || !Array.isArray(categories)) {
        return { success: false, error: 'Categories array is required' };
      }

      try {
        const result = userAgentManager.setEnabledCategories(categories);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add custom user agent
    server.commandHandlers.add_custom_user_agent = async (params) => {
      const { userAgent } = params;

      if (!userAgent) {
        return { success: false, error: 'User agent is required' };
      }

      try {
        const result = userAgentManager.addCustomUserAgent(userAgent);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear custom user agents
    server.commandHandlers.clear_custom_user_agents = async (params) => {
      try {
        const result = userAgentManager.clearCustomUserAgents();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get user agent status
    server.commandHandlers.get_user_agent_status = async (params) => {
      try {
        const status = userAgentManager.getStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available user agent categories
    server.commandHandlers.get_user_agent_categories = async (params) => {
      try {
        const categories = userAgentManager.getAvailableCategories();
        return { success: true, categories };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Parse user agent string
    server.commandHandlers.parse_user_agent = async (params) => {
      const { userAgent } = params;

      if (!userAgent) {
        return { success: false, error: 'User agent is required' };
      }

      try {
        const info = userAgentManager.parseUserAgent(userAgent);
        return { success: true, info };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Request Interception Commands
    // ==========================================

    // Set request rules (block, allow, header modification)
    server.commandHandlers.set_request_rules = async (params) => {
      const {
        blockRules,
        allowRules,
        headerRules,
        predefinedCategories,
        blockedResourceTypes,
        customHeaders,
        removeHeaders,
        clearExisting
      } = params;

      try {
        const result = requestInterceptor.setRequestRules({
          blockRules,
          allowRules,
          headerRules,
          predefinedCategories,
          blockedResourceTypes,
          customHeaders,
          removeHeaders,
          clearExisting
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Clear all request rules
    server.commandHandlers.clear_request_rules = async (params) => {
      try {
        const result = requestInterceptor.clearRequestRules();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add a block rule
    server.commandHandlers.add_block_rule = async (params) => {
      const { pattern, description, resourceTypes } = params;

      if (!pattern) {
        return { success: false, error: 'Pattern is required' };
      }

      try {
        const result = requestInterceptor.addBlockRule({
          pattern,
          description,
          resourceTypes
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add an allow rule (overrides block rules)
    server.commandHandlers.add_allow_rule = async (params) => {
      const { pattern, description } = params;

      if (!pattern) {
        return { success: false, error: 'Pattern is required' };
      }

      try {
        const result = requestInterceptor.addAllowRule({
          pattern,
          description
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add a header modification rule
    server.commandHandlers.add_header_rule = async (params) => {
      const { header, action, value, urlPattern, description } = params;

      if (!header || !action) {
        return { success: false, error: 'Header and action are required' };
      }

      try {
        const result = requestInterceptor.addHeaderRule({
          header,
          action,
          value,
          urlPattern,
          description
        });
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Remove a rule by ID
    server.commandHandlers.remove_request_rule = async (params) => {
      const { ruleId } = params;

      if (!ruleId) {
        return { success: false, error: 'Rule ID is required' };
      }

      try {
        const result = requestInterceptor.removeRule(ruleId);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set custom headers
    server.commandHandlers.set_custom_headers = async (params) => {
      const { headers } = params;

      if (!headers || typeof headers !== 'object') {
        return { success: false, error: 'Headers object is required' };
      }

      try {
        const result = requestInterceptor.setCustomHeaders(headers);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Set headers to remove
    server.commandHandlers.set_headers_to_remove = async (params) => {
      const { headers } = params;

      if (!headers || !Array.isArray(headers)) {
        return { success: false, error: 'Headers array is required' };
      }

      try {
        const result = requestInterceptor.setHeadersToRemove(headers);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Block resource type
    server.commandHandlers.block_resource_type = async (params) => {
      const { resourceType } = params;

      if (!resourceType) {
        return { success: false, error: 'Resource type is required' };
      }

      try {
        const result = requestInterceptor.blockResourceType(resourceType);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Unblock resource type
    server.commandHandlers.unblock_resource_type = async (params) => {
      const { resourceType } = params;

      if (!resourceType) {
        return { success: false, error: 'Resource type is required' };
      }

      try {
        const result = requestInterceptor.unblockResourceType(resourceType);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Apply predefined rules (ads, trackers, social)
    server.commandHandlers.apply_predefined_rules = async (params) => {
      const { category } = params;

      if (!category) {
        return { success: false, error: 'Category is required' };
      }

      try {
        const result = requestInterceptor.applyPredefinedRules(category);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get request interceptor status
    server.commandHandlers.get_request_interceptor_status = async (params) => {
      try {
        const status = requestInterceptor.getStatus();
        return { success: true, ...status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Export request rules
    server.commandHandlers.export_request_rules = async (params) => {
      try {
        const rules = requestInterceptor.exportRules();
        return { success: true, rules };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Import request rules
    server.commandHandlers.import_request_rules = async (params) => {
      const { rules, merge } = params;

      if (!rules || typeof rules !== 'object') {
        return { success: false, error: 'Rules object is required' };
      }

      try {
        const result = requestInterceptor.importRules(rules, merge);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Reset request statistics
    server.commandHandlers.reset_request_stats = async (params) => {
      try {
        const result = requestInterceptor.resetStats();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get available resource types
    server.commandHandlers.get_resource_types = async (params) => {
      return {
        success: true,
        types: Object.values(RESOURCE_TYPES)
      };
    };

    // Get predefined rule categories
    server.commandHandlers.get_predefined_categories = async (params) => {
      return {
        success: true,
        categories: Object.keys(PREDEFINED_BLOCK_RULES),
        ruleCounts: Object.fromEntries(
          Object.entries(PREDEFINED_BLOCK_RULES).map(([key, rules]) => [key, rules.length])
        )
      };
    };

    // Enable request interceptor
    server.commandHandlers.enable_request_interceptor = async (params) => {
      try {
        const result = requestInterceptor.enable();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Disable request interceptor
    server.commandHandlers.disable_request_interceptor = async (params) => {
      try {
        const result = requestInterceptor.disable();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Content Blocking Commands
    // ==========================================

    // Enable content blocking
    server.commandHandlers.enable_blocking = async (params) => {
      if (!server.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      try {
        return server.blockingManager.enableBlocking();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Disable content blocking
    server.commandHandlers.disable_blocking = async (params) => {
      if (!server.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      try {
        return server.blockingManager.disableBlocking();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Add block rule
    server.commandHandlers.add_block_rule = async (params) => {
      if (!server.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      const { pattern, description } = params;
      if (!pattern) {
        return { success: false, error: 'Pattern is required' };
      }
      try {
        return server.blockingManager.addBlockRule(pattern, { description });
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Remove block rule
    server.commandHandlers.remove_block_rule = async (params) => {
      if (!server.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      const { pattern } = params;
      if (!pattern) {
        return { success: false, error: 'Pattern is required' };
      }
      try {
        return server.blockingManager.removeBlockRule(pattern);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get block rules
    server.commandHandlers.get_block_rules = async (params) => {
      if (!server.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      try {
        return server.blockingManager.getBlockRules();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Load filter list from URL
    server.commandHandlers.load_filter_list = async (params) => {
      if (!server.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      const { url } = params;
      if (!url) {
        return { success: false, error: 'URL is required' };
      }
      try {
        return await server.blockingManager.loadFilterList(url);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get blocking statistics
    server.commandHandlers.get_blocking_stats = async (params) => {
      if (!server.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      try {
        return server.blockingManager.getStats();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Whitelist domain
    server.commandHandlers.whitelist_domain = async (params) => {
      if (!server.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      const { domain } = params;
      if (!domain) {
        return { success: false, error: 'Domain is required' };
      }
      try {
        return server.blockingManager.whitelistDomain(domain);
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get whitelist
    server.commandHandlers.get_whitelist = async (params) => {
      if (!server.blockingManager) {
        return { success: false, error: 'Blocking manager not available' };
      }
      try {
        return server.blockingManager.getWhitelist();
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==========================================
    // Advanced Keyboard Input Commands
    // ==========================================

    // Press a single key
    server.commandHandlers.key_press = async (params) => {
      const { key, modifiers = {}, humanize = true } = params;

      if (!key) {
        return { success: false, error: 'Key is required' };
      }

      if (humanize) {
        await humanDelay(30, 100);
      }

      try {
        // Check if it's a special key
        const script = keyboard.KEY_CODES[key]
          ? keyboard.getSpecialKeyScript(key, { repeat: params.repeat || 1 })
          : keyboard.getFullKeyPressScript(key, { modifiers, layout: params.layout || 'en-US' });

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

    // Press key combination (e.g., Ctrl+C, Ctrl+Shift+V)
    server.commandHandlers.key_combination = async (params) => {
      const { keys, humanize = true } = params;

      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return { success: false, error: 'Keys array is required' };
      }

      if (humanize) {
        await humanDelay(50, 150);
      }

      try {
        const script = keyboard.getKeyCombinationScript(keys, {
          holdTime: params.holdTime || 50
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

    // Type text with human-like timing
    server.commandHandlers.type_text = async (params) => {
      const {
        text,
        selector = null,
        minDelay = 30,
        maxDelay = 150,
        mistakeRate = 0.02,
        clearFirst = false,
        layout = 'en-US'
      } = params;

      if (!text) {
        return { success: false, error: 'Text is required' };
      }

      try {
        // If selector provided, focus it first
        if (selector) {
          const focusScript = `
            (function() {
              const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
              if (el) {
                el.focus();
                return { success: true };
              }
              return { success: false, error: 'Element not found' };
            })();
          `;

          const focusResult = await ipcWithTimeout(
            server.mainWindow.webContents,
            'execute-in-webview',
            'webview-execute-response',
            focusScript
          );

          if (!focusResult.success) {
            return focusResult;
          }

          await humanDelay(50, 150);
        }

        const script = keyboard.getTypeTextScript(text, {
          minDelay,
          maxDelay,
          mistakeRate,
          clearFirst,
          layout
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

    // Get estimated typing duration
    server.commandHandlers.estimate_typing = async (params) => {
      const { text, baseDelay = 80 } = params;

      if (!text) {
        return { success: false, error: 'Text is required' };
      }

      const duration = keyboard.estimateTypingDuration(text, { baseDelay });
      return { success: true, duration, text: text.length + ' characters' };
    };

    // Get available keyboard layouts
    server.commandHandlers.keyboard_layouts = async (params) => {
      return {
        success: true,
        layouts: Object.entries(keyboard.KEYBOARD_LAYOUTS).map(([code, layout]) => ({
          code,
          name: layout.name
        }))
      };
    };

    // Get special key codes
    server.commandHandlers.special_keys = async (params) => {
      return {
        success: true,
        keys: Object.keys(keyboard.KEY_CODES)
      };
    };

    // ==========================================
    // Advanced Mouse Input Commands
    // ==========================================

    // Move mouse to coordinates
    server.commandHandlers.mouse_move = async (params) => {
      const {
        x,
        y,
        duration = null,
        steps = 20,
        curvature = 0.3,
        humanize = true
      } = params;

      if (x === undefined || y === undefined) {
        return { success: false, error: 'X and Y coordinates are required' };
      }

      if (humanize) {
        await humanDelay(20, 80);
      }

      try {
        const script = mouse.getMouseMoveScript(x, y, {
          steps,
          duration,
          curvature,
          overshoot: humanize
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

    // Click at position
    server.commandHandlers.mouse_click = async (params) => {
      const {
        x,
        y,
        button = 'left',
        clickCount = 1,
        moveFirst = true,
        humanize = true
      } = params;

      if (x === undefined || y === undefined) {
        return { success: false, error: 'X and Y coordinates are required' };
      }

      if (humanize) {
        await humanDelay(30, 100);
      }

      try {
        const script = mouse.getMouseClickScript(x, y, {
          button,
          clickCount,
          moveFirst: moveFirst && humanize
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

    // Double-click at position
    server.commandHandlers.mouse_double_click = async (params) => {
      const { x, y, humanize = true } = params;

      if (x === undefined || y === undefined) {
        return { success: false, error: 'X and Y coordinates are required' };
      }

      if (humanize) {
        await humanDelay(30, 100);
      }

      try {
        const script = mouse.getMouseDoubleClickScript(x, y, {
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

    // Right-click at position
    server.commandHandlers.mouse_right_click = async (params) => {
      const { x, y, humanize = true } = params;

      if (x === undefined || y === undefined) {
        return { success: false, error: 'X and Y coordinates are required' };
      }

      if (humanize) {
        await humanDelay(30, 100);
      }

      try {
        const script = mouse.getMouseRightClickScript(x, y, {
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

    // Drag from point A to point B
    server.commandHandlers.mouse_drag = async (params) => {
      const {
        startX,
        startY,
        endX,
        endY,
        steps = 25,
        holdTime = 100,
        humanize = true
      } = params;

      if (startX === undefined || startY === undefined ||
          endX === undefined || endY === undefined) {
        return { success: false, error: 'Start and end coordinates are required' };
      }

      if (humanize) {
        await humanDelay(50, 150);
      }

      try {
        const script = mouse.getMouseDragScript(
          { x: startX, y: startY },
          { x: endX, y: endY },
          { steps, holdTime }
        );

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
}

module.exports = { registerCoreCmds04 };
