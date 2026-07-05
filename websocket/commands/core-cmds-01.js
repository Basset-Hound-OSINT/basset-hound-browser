// Command handlers (navigate .. close_tab) — extracted from
// server.js setupCommandHandlers. 54 handlers. Order preserved.
const D = require('../core/handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

function registerCoreCmds01(server) {
    server.commandHandlers.navigate = async (params) => {
      const { url, timeout = 10000 } = params;

      // PHASE 1: VALIDATION - Perform all validation BEFORE modifying state
      if (!url) {
        return ErrorFormatter.missingParameterError('url', 'navigate');
      }

      // Validate URL format
      try {
        new URL(url); // Throws if invalid
      } catch (error) {
        return ErrorFormatter.validationError(
          `Invalid URL: ${error.message}`,
          'navigate',
          null,
          { parameter: 'url', provided: url, expectedFormat: 'Valid HTTP/HTTPS URL' }
        );
      }

      // H-1: SSRF guard — block file://, non-http(s), loopback, RFC1918,
      // link-local and cloud-metadata targets unless explicitly allowed via env.
      // Return a plain error object (no `id` key) so the server's response
      // envelope preserves the request id for client correlation.
      const ssrfCheck = await validateNavigationUrl(url);
      if (!ssrfCheck.allowed) {
        return { success: false, error: ssrfCheck.reason, blocked: 'ssrf', url };
      }

      // PHASE 2: SNAPSHOT - Capture current state before any changes
      const currentUrl = server.mainWindow.webContents.getURL();
      const navigationSnapshot = StateSnapshot.captureNavigation(server.mainWindow, currentUrl);
      server.stateManager.saveSnapshot(navigationSnapshot.id, navigationSnapshot);

      // Create stateful handler for this command
      const handler = new StatefulCommandHandler('navigate', server.stateManager, server.logger);

      // PHASE 3: EXECUTE WITH ROLLBACK - Execute with automatic state restoration on failure
      const result = await handler.executeWithRollback(
        // Handler function: actual navigation logic
        async () => {
          // Handle Tor Master Switch AUTO mode - automatically enable/disable routing
          let autoModeResult = null;
          try {
            autoModeResult = await proxyManager.handleAutoModeNavigation(url);
            if (autoModeResult.handled) {
              server.logger.info(`[Navigate] AUTO mode: ${autoModeResult.action} for ${url}`);
            }
          } catch (error) {
            server.logger.error('[Navigate] AUTO mode error:', error.message);
          }

          // Check for .onion URL without Tor mode (only if not in AUTO mode or AUTO mode failed)
          const onionError = checkOnionWithoutTor(url);
          if (onionError && (!autoModeResult || !autoModeResult.handled || autoModeResult.action !== 'enabled_tor')) {
            throw new Error(onionError.error);
          }

          await humanDelay(100, 300);

          // Send navigation command and wait for navigation-complete event
          server.mainWindow.webContents.send('navigate-webview', url);

          // Wait for actual navigation completion (timeout configurable, default 10s)
          const navigationData = await ipcWithTimeout(
            server.mainWindow.webContents,
            'navigate-webview',
            'navigation-complete',
            null,
            timeout
          );

          return {
            success: true,
            url: navigationData.url || url,
            tabId: navigationData.tabId,
            timestamp: navigationData.timestamp,
            torAutoMode: autoModeResult?.handled ? autoModeResult : undefined
          };
        },
        navigationSnapshot,
        null, // No post-execution validation needed
        async (snapshot) => {
          // Custom rollback: navigate back to previous URL if available
          if (snapshot.stateData.currentUrl) {
            server.mainWindow.webContents.send('navigate-webview', snapshot.stateData.currentUrl);
            // Wait for navigation to complete
            try {
              await ipcWithTimeout(
                server.mainWindow.webContents,
                'navigate-webview',
                'navigation-complete',
                null,
                timeout
              );
            } catch (error) {
              server.logger.warn(`[Navigate] Rollback timeout for ${snapshot.stateData.currentUrl}`);
            }
          }
        }
      );

      // Handle timeout gracefully - navigation was initiated even if completion not confirmed
      if (result.success === false && result.rollbackAttempted !== true) {
        // Original error, not a rollback error
        if (result.error?.includes('timeout')) {
          server.logger.warn(`[Navigate] Timeout waiting for completion of ${url}`);
          return {
            success: true,
            url,
            timeout: true,
            message: 'Navigation initiated but completion not confirmed'
          };
        }
      }

      return result;
    };

    // Click element by selector
    server.commandHandlers.click = async (params) => {
      const { selector, humanize = true } = params;
      if (!selector) {
        return ErrorFormatter.missingParameterError('selector', 'click');
      }

      if (humanize) {
        await humanDelay(50, 200);
      }

      try {
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'click-element',
          'click-response',
          selector
        );
      } catch (error) {
        return ErrorFormatter.commandExecutionError('click', error);
      }
    };

    // Fill form field
    server.commandHandlers.fill = async (params) => {
      const { selector, value, humanize = true } = params;
      if (!selector) {
        return ErrorFormatter.missingParameterError('selector', 'fill');
      }
      if (value === undefined) {
        return ErrorFormatter.missingParameterError('value', 'fill');
      }

      if (humanize) {
        // Simulate human typing with delays
        const typedValue = await humanType(value);
        await humanDelay(50, 150);
      }

      try {
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'fill-field',
          'fill-response',
          { selector, value }
        );
      } catch (error) {
        return ErrorFormatter.commandExecutionError('fill', error);
      }
    };

    // Get page content
    server.commandHandlers.get_content = async (params) => {
      try {
        // P1-002: Use adaptive timeout for content extraction
        // Large HTML documents may take longer than 30 seconds
        const timeout = calculateAdaptiveTimeout('get_content');
        const result = await ipcWithTimeout(
          server.mainWindow.webContents,
          'get-page-content',
          'page-content-response',
          null, // no data parameter
          timeout
        );

        // P2-004: Check for Cloudflare challenge
        if (result.success && result.content) {
          const cfDetection = server.cloudflareDetector.detectChallenge(
            result.content,
            result.statusCode || 200,
            result.headers || {}
          );

          if (cfDetection > 0) {
            server.logger.warn('[CF-004] Cloudflare challenge detected in content extraction');

            // Try to resolve the challenge
            try {
              // Send message to renderer to wait for CF challenge
              const resolveResult = await ipcWithTimeout(
                server.mainWindow.webContents,
                'wait-for-cloudflare',
                'cloudflare-resolved-response',
                { timeout: 10000 },
                15000
              );

              if (resolveResult.success && resolveResult.content) {
                // Verify challenge is gone
                const cfCheckResult = server.cloudflareDetector.detectChallenge(
                  resolveResult.content,
                  200,
                  {}
                );

                if (cfCheckResult === 0) {
                  server.logger.info('[CF-004] Cloudflare challenge resolved, returning real content');
                  return {
                    success: true,
                    content: resolveResult.content,
                    cloudflareResolved: true,
                    statusCode: 200,
                    headers: {}
                  };
                }
              }
            } catch (cfError) {
              server.logger.warn(`[CF-004] Cloudflare challenge resolution timeout: ${cfError.message}`);
            }

            // Return content with Cloudflare warning
            return {
              success: true,
              content: result.content,
              cloudflareChallenge: true,
              warning: 'Content may be Cloudflare challenge page. Consider enabling evasion techniques.',
              statusCode: result.statusCode || 200,
              headers: result.headers || {}
            };
          }
        }

        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Capture screenshot
    server.commandHandlers.screenshot = async (params) => {
      const { format = 'png' } = params;
      try {
        // First try capturing from the webview via renderer process
        const result = await ipcWithTimeout(
          server.mainWindow.webContents,
          'capture-screenshot',
          'screenshot-response'
        );

        // If webview capture succeeded, return it
        if (result.success) {
          return result;
        }

        // If webview capture failed due to headless mode, try capturing from main window
        // This captures the entire browser window including chrome, but works in headless mode
        if (result.needsMainProcessCapture || result.error?.includes('headless')) {
          server.logger.debug('[WebSocket] Webview screenshot failed, attempting main window capture');
          try {
            const image = await server.mainWindow.webContents.capturePage();
            if (!image.isEmpty()) {
              const dataUrl = image.toDataURL();
              // Verify we got actual data
              if (dataUrl.length >= 100) {
                return {
                  success: true,
                  data: dataUrl,
                  captureMethod: 'mainWindow',
                  note: 'Captured from main window (includes browser chrome) due to headless mode'
                };
              }
            }

            // Main window capture also failed, try headless manager's offscreen frame
            if (server.headlessManager && server.headlessManager.offscreenRenderingEnabled) {
              server.logger.debug('[WebSocket] Main window capture failed, attempting offscreen frame capture');
              const frameResult = server.headlessManager.captureFromLastFrame();
              if (frameResult.success) {
                return frameResult;
              }
              server.logger.debug('[WebSocket] Offscreen frame capture failed:', frameResult.error);
            }

            return {
              success: false,
              error: 'Screenshot capture failed: all capture methods returned empty images in headless mode. Try using screenshot_viewport command instead.'
            };
          } catch (mainWindowError) {
            // Try headless manager's offscreen frame as last resort
            if (server.headlessManager && server.headlessManager.offscreenRenderingEnabled) {
              server.logger.debug('[WebSocket] Main window capture threw error, attempting offscreen frame capture');
              const frameResult = server.headlessManager.captureFromLastFrame();
              if (frameResult.success) {
                return frameResult;
              }
            }
            return {
              success: false,
              error: `Screenshot capture failed in headless mode: ${mainWindowError.message}`
            };
          }
        }

        // Return the original error from webview capture
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Get page state (forms, links, buttons)
    server.commandHandlers.get_page_state = async (params) => {
      try {
        // P1-002: Use adaptive timeout for page state extraction
        const timeout = calculateAdaptiveTimeout('get_page_state');
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'get-page-state',
          'page-state-response',
          null,
          timeout
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Execute arbitrary JavaScript
    server.commandHandlers.execute_script = async (params) => {
      const { script } = params;
      if (!script) {
        return { success: false, error: 'Script is required' };
      }

      try {
        // P1-002: Use adaptive timeout for script execution
        // Large scripts or those that process large data need more time
        const timeout = calculateAdaptiveTimeout('execute_script');
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'execute-in-webview',
          'webview-execute-response',
          script,
          timeout
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Wait for element to appear
    server.commandHandlers.wait_for_element = async (params) => {
      const { selector, timeout = 10000 } = params;
      if (!selector) {
        return { success: false, error: 'Selector is required' };
      }

      try {
        // Use longer timeout for wait_for_element since it has its own internal timeout
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'wait-for-element',
          'wait-response',
          { selector, timeout },
          timeout + 5000 // Give extra buffer beyond the element wait timeout
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // Scroll to position or element
    server.commandHandlers.scroll = async (params) => {
      const { x, y, selector, humanize = true } = params;

      if (humanize) {
        await humanScroll();
      }

      try {
        return await ipcWithTimeout(
          server.mainWindow.webContents,
          'scroll',
          'scroll-response',
          { x, y, selector }
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==================== COOKIE MANAGEMENT COMMANDS ====================

    // Get cookies for URL
    server.commandHandlers.get_cookies = async (params) => {
      if (!server.cookieManager) {
        // Fallback to direct session access if cookieManager not available
        const { url } = params;
        if (!url) {
          return { success: false, error: 'URL is required' };
        }
        try {
          const { session } = require('electron');
          const cookies = await session.defaultSession.cookies.get({ url });
          return { success: true, cookies };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }

      const { url } = params;
      if (!url) {
        return { success: false, error: 'URL is required' };
      }
      return await server.cookieManager.getCookies(url);
    };

    // Get all cookies
    server.commandHandlers.get_all_cookies = async (params) => {
      if (!server.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { filter } = params;
      return await server.cookieManager.getAllCookies(filter || {});
    };

    // Set a single cookie
    server.commandHandlers.set_cookie = async (params) => {
      if (!server.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { cookie } = params;
      if (!cookie) {
        return { success: false, error: 'Cookie object is required' };
      }
      return await server.cookieManager.setCookie(cookie);
    };

    // Set multiple cookies
    server.commandHandlers.set_cookies = async (params) => {
      if (!server.cookieManager) {
        // Fallback to direct session access
        const { cookies } = params;
        if (!cookies || !Array.isArray(cookies)) {
          return { success: false, error: 'Cookies array is required' };
        }
        try {
          const { session } = require('electron');
          for (const cookie of cookies) {
            await session.defaultSession.cookies.set(cookie);
          }
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }

      const { cookies } = params;
      if (!cookies || !Array.isArray(cookies)) {
        return { success: false, error: 'Cookies array is required' };
      }
      return await server.cookieManager.setCookies(cookies);
    };

    // Delete a specific cookie
    server.commandHandlers.delete_cookie = async (params) => {
      if (!server.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { url, name } = params;
      if (!url || !name) {
        return { success: false, error: 'URL and name are required' };
      }
      return await server.cookieManager.deleteCookie(url, name);
    };

    // Clear all cookies (optionally for a specific domain)
    server.commandHandlers.clear_all_cookies = async (params) => {
      if (!server.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { domain } = params;
      return await server.cookieManager.clearCookies(domain);
    };

    // Export cookies to specified format
    server.commandHandlers.export_cookies = async (params) => {
      if (!server.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { format, filter, domain } = params;
      const exportFilter = filter || (domain ? { domain } : {});
      return await server.cookieManager.exportCookies(format || 'json', exportFilter);
    };

    // Import cookies from data string
    server.commandHandlers.import_cookies = async (params) => {
      if (!server.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { data, format } = params;
      if (!data) {
        return { success: false, error: 'Cookie data is required' };
      }
      return await server.cookieManager.importCookies(data, format || 'auto');
    };

    // Export cookies to file
    server.commandHandlers.export_cookies_file = async (params) => {
      if (!server.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { filepath, format, filter, domain } = params;
      if (!filepath) {
        return { success: false, error: 'Filepath is required' };
      }
      const exportFilter = filter || (domain ? { domain } : {});
      return await server.cookieManager.exportToFile(filepath, format || 'json', exportFilter);
    };

    // Import cookies from file
    server.commandHandlers.import_cookies_file = async (params) => {
      if (!server.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { filepath, format } = params;
      if (!filepath) {
        return { success: false, error: 'Filepath is required' };
      }
      return await server.cookieManager.importFromFile(filepath, format || 'auto');
    };

    // Get cookies for a specific domain
    server.commandHandlers.get_cookies_for_domain = async (params) => {
      if (!server.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }

      const { domain } = params;
      if (!domain) {
        return { success: false, error: 'Domain is required' };
      }
      return await server.cookieManager.getCookiesForDomain(domain);
    };

    // Get cookie statistics
    server.commandHandlers.get_cookie_stats = async (params) => {
      if (!server.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }
      return await server.cookieManager.getStats();
    };

    // Get available cookie formats
    server.commandHandlers.get_cookie_formats = async (params) => {
      if (!server.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }
      return { success: true, ...server.cookieManager.getFormats() };
    };

    // Flush cookies to storage
    server.commandHandlers.flush_cookies = async (params) => {
      if (!server.cookieManager) {
        return { success: false, error: 'Cookie manager not available' };
      }
      return await server.cookieManager.flushCookies();
    };

    // Get current URL
    server.commandHandlers.get_url = async (params) => {
      try {
        const url = await ipcWithTimeout(
          server.mainWindow.webContents,
          'get-webview-url',
          'webview-url-response'
        );
        return { success: true, url };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // ==================== SESSION MANAGEMENT COMMANDS ====================

    // Create a new session
    server.commandHandlers.create_session = async (params) => {
      if (!server.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { name, userAgent, fingerprint } = params;
      return server.sessionManager.createSession({ name, userAgent, fingerprint });
    };

    // Switch to a different session
    server.commandHandlers.switch_session = async (params) => {
      if (!server.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { sessionId } = params;
      if (!sessionId) {
        return { success: false, error: 'Session ID is required' };
      }

      const result = server.sessionManager.switchSession(sessionId);

      // Notify renderer to update webview partition
      if (result.success) {
        server.mainWindow.webContents.send('session-changed', {
          sessionId,
          partition: server.sessionManager.getActivePartition()
        });
      }

      return result;
    };

    // Delete a session
    server.commandHandlers.delete_session = async (params) => {
      if (!server.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { sessionId } = params;
      if (!sessionId) {
        return { success: false, error: 'Session ID is required' };
      }

      return await server.sessionManager.deleteSession(sessionId);
    };

    // List all sessions
    server.commandHandlers.list_sessions = async (params) => {
      if (!server.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      return server.sessionManager.listSessions();
    };

    // Export a session
    server.commandHandlers.export_session = async (params) => {
      if (!server.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { sessionId } = params;
      return await server.sessionManager.exportSession(sessionId);
    };

    // Import a session
    server.commandHandlers.import_session = async (params) => {
      if (!server.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { data } = params;
      if (!data) {
        return { success: false, error: 'Session data is required' };
      }

      return await server.sessionManager.importSession(data);
    };

    // Get session info
    server.commandHandlers.get_session_info = async (params) => {
      if (!server.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { sessionId } = params;
      const info = server.sessionManager.getSessionInfo(sessionId || server.sessionManager.activeSessionId);

      if (!info) {
        return { success: false, error: 'Session not found' };
      }

      return { success: true, session: info };
    };

    // Clear session data (cookies, cache, storage)
    server.commandHandlers.clear_session_data = async (params) => {
      if (!server.sessionManager) {
        return { success: false, error: 'Session manager not available' };
      }

      const { sessionId } = params;
      return await server.sessionManager.clearSessionData(sessionId);
    };

    // ==================== HISTORY COMMANDS ====================

    // Get browsing history
    server.commandHandlers.get_history = async (params) => {
      if (!server.historyManager) {
        return { success: false, error: 'History manager not available' };
      }

      const { limit, offset, startTime, endTime, search } = params;
      return server.historyManager.getHistory({ limit, offset, startTime, endTime, search });
    };

    // Search history
    server.commandHandlers.search_history = async (params) => {
      if (!server.historyManager) {
        return { success: false, error: 'History manager not available' };
      }

      const { query, limit } = params;
      if (!query) {
        return { success: false, error: 'Search query is required' };
      }

      return server.historyManager.searchHistory(query, { limit });
    };

    // Clear all history
    server.commandHandlers.clear_history = async (params) => {
      if (!server.historyManager) {
        return { success: false, error: 'History manager not available' };
      }

      return server.historyManager.clearHistory();
    };

    // Get specific history entry
    server.commandHandlers.get_history_entry = async (params) => {
      if (!server.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { id } = params;
      if (!id) {
        return { success: false, error: 'Entry ID is required' };
      }
      return server.historyManager.getEntry(id);
    };

    // Delete history entry
    server.commandHandlers.delete_history_entry = async (params) => {
      if (!server.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { id } = params;
      if (!id) {
        return { success: false, error: 'Entry ID is required' };
      }
      return server.historyManager.deleteEntry(id);
    };

    // Delete history range
    server.commandHandlers.delete_history_range = async (params) => {
      if (!server.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { startTime, endTime } = params;
      if (!startTime || !endTime) {
        return { success: false, error: 'Start and end times are required' };
      }
      return server.historyManager.deleteRange(startTime, endTime);
    };

    // Get visit count for URL
    server.commandHandlers.get_visit_count = async (params) => {
      if (!server.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { url } = params;
      if (!url) {
        return { success: false, error: 'URL is required' };
      }
      return server.historyManager.getVisitCount(url);
    };

    // Get most visited URLs
    server.commandHandlers.get_most_visited = async (params) => {
      if (!server.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { limit } = params;
      return server.historyManager.getMostVisited(limit || 10);
    };

    // Export history
    server.commandHandlers.export_history = async (params) => {
      if (!server.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { format } = params;
      return server.historyManager.exportHistory(format || 'json');
    };

    // Import history
    server.commandHandlers.import_history = async (params) => {
      if (!server.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      const { data, overwrite } = params;
      if (!data) {
        return { success: false, error: 'History data is required' };
      }
      return server.historyManager.importHistory(data, { overwrite: overwrite || false });
    };

    // Get history statistics
    server.commandHandlers.get_history_stats = async (params) => {
      if (!server.historyManager) {
        return { success: false, error: 'History manager not available' };
      }
      return server.historyManager.getStats();
    };

    // ==================== DOWNLOAD COMMANDS ====================

    // Start a download
    server.commandHandlers.start_download = async (params) => {
      if (!server.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { url, filename, path } = params;
      if (!url) {
        return { success: false, error: 'URL is required' };
      }

      // Trigger download by navigating to URL
      server.mainWindow.webContents.send('download-file', { url, filename });

      return server.downloadManager.startDownload(url, { filename, path });
    };

    // Pause a download
    server.commandHandlers.pause_download = async (params) => {
      if (!server.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { downloadId } = params;
      if (!downloadId) {
        return { success: false, error: 'Download ID is required' };
      }

      return server.downloadManager.pauseDownload(downloadId);
    };

    // Resume a download
    server.commandHandlers.resume_download = async (params) => {
      if (!server.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { downloadId } = params;
      if (!downloadId) {
        return { success: false, error: 'Download ID is required' };
      }

      return server.downloadManager.resumeDownload(downloadId);
    };

    // Cancel a download
    server.commandHandlers.cancel_download = async (params) => {
      if (!server.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { downloadId } = params;
      if (!downloadId) {
        return { success: false, error: 'Download ID is required' };
      }

      return server.downloadManager.cancelDownload(downloadId);
    };

    // Get download info
    server.commandHandlers.get_download = async (params) => {
      if (!server.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { downloadId } = params;
      if (!downloadId) {
        return { success: false, error: 'Download ID is required' };
      }

      return server.downloadManager.getDownload(downloadId);
    };

    // Get all downloads
    server.commandHandlers.get_downloads = async (params) => {
      if (!server.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { limit, state } = params || {};
      return server.downloadManager.getAllDownloads({ limit, state });
    };

    // Set download directory
    server.commandHandlers.set_download_path = async (params) => {
      if (!server.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      const { path: downloadPath } = params;
      if (!downloadPath) {
        return { success: false, error: 'Download path is required' };
      }

      return server.downloadManager.setDownloadPath(downloadPath);
    };

    // Clear download history
    server.commandHandlers.clear_downloads = async (params) => {
      if (!server.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      return server.downloadManager.clearCompleted();
    };

    // Get download status
    server.commandHandlers.get_download_status = async (params) => {
      if (!server.downloadManager) {
        return { success: false, error: 'Download manager not available' };
      }

      return { success: true, status: server.downloadManager.getStatus() };
    };

    // ==================== TAB MANAGEMENT COMMANDS ====================

    // Create a new tab
    server.commandHandlers.new_tab = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { url, title, sessionId, active } = params;
      const result = server.tabManager.createTab({ url, title, sessionId, active });

      // Notify renderer to create webview for new tab
      if (result.success) {
        server.mainWindow.webContents.send('tab-created', result.tab);
      }

      return result;
    };

    // Close a tab
    server.commandHandlers.close_tab = async (params) => {
      if (!server.tabManager) {
        return { success: false, error: 'Tab manager not available' };
      }

      const { tabId } = params;
      if (!tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      const result = server.tabManager.closeTab(tabId);

      // Notify renderer to close webview
      if (result.success) {
        server.mainWindow.webContents.send('tab-closed', {
          closedTabId: result.closedTabId,
          activeTabId: result.activeTabId
        });
      }

      return result;
    };
}

module.exports = { registerCoreCmds01 };
