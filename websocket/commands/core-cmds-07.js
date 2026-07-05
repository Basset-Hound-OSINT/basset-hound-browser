// Command handlers (extract_scripts .. step_replay) — extracted from
// server.js setupCommandHandlers. 47 handlers. Order preserved.
const D = require('../core/handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

function registerCoreCmds07(server) {
    server.commandHandlers.extract_scripts = async (params) => {
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

      return server.extractionManager.extractScripts(html, baseUrl);
    };

    server.commandHandlers.extract_stylesheets = async (params) => {
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

      return server.extractionManager.extractStylesheets(html, baseUrl);
    };

    server.commandHandlers.extract_structured_data = async (params) => {
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

      return server.extractionManager.extractStructuredData(html);
    };

    server.commandHandlers.extract_all = async (params) => {
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

      return server.extractionManager.extractAll(html, url);
    };

    server.commandHandlers.get_extraction_stats = async (params) => {
      if (!server.extractionManager) {
        return { success: false, error: 'Extraction manager not available' };
      }
      return { success: true, stats: server.extractionManager.stats };
    };

    // ==========================================
    // Network Analysis Commands
    // ==========================================

    server.commandHandlers.start_network_capture = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }

      let webContents = null;
      if (server.mainWindow) {
        webContents = server.mainWindow.webContents;
      }

      return server.networkAnalysisManager.startCapture(webContents);
    };

    server.commandHandlers.stop_network_capture = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return server.networkAnalysisManager.stopCapture();
    };

    server.commandHandlers.get_network_requests = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return server.networkAnalysisManager.getRequests(params.filter || {});
    };

    server.commandHandlers.get_request_details = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      if (!params.requestId) {
        return { success: false, error: 'Request ID is required' };
      }
      return server.networkAnalysisManager.getRequestDetails(params.requestId);
    };

    server.commandHandlers.get_response_headers = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      if (!params.requestId) {
        return { success: false, error: 'Request ID is required' };
      }
      return server.networkAnalysisManager.getResponseHeaders(params.requestId);
    };

    server.commandHandlers.get_security_info = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      if (!params.url) {
        return { success: false, error: 'URL is required' };
      }
      return server.networkAnalysisManager.getSecurityInfo(params.url, params.requestId);
    };

    server.commandHandlers.analyze_security_headers = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      if (!params.url) {
        return { success: false, error: 'URL is required' };
      }
      return server.networkAnalysisManager.analyzeSecurityHeaders(params.url, params.headers);
    };

    server.commandHandlers.get_resource_timing = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return server.networkAnalysisManager.getResourceTiming();
    };

    server.commandHandlers.get_requests_by_domain = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return server.networkAnalysisManager.getRequestsByDomain();
    };

    server.commandHandlers.get_slow_requests = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return server.networkAnalysisManager.getSlowRequests(params.thresholdMs || 1000);
    };

    server.commandHandlers.get_failed_requests = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return server.networkAnalysisManager.getFailedRequests();
    };

    server.commandHandlers.get_network_statistics = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return server.networkAnalysisManager.getStatistics();
    };

    server.commandHandlers.get_network_capture_status = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return server.networkAnalysisManager.getStatus();
    };

    server.commandHandlers.clear_network_capture = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return server.networkAnalysisManager.clearCapture();
    };

    server.commandHandlers.export_network_capture = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return server.networkAnalysisManager.exportCapture();
    };

    server.commandHandlers.get_requests_by_status = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      const minStatus = params.minStatus || 400;
      const maxStatus = params.maxStatus || 599;
      return server.networkAnalysisManager.getRequestsByStatusRange(minStatus, maxStatus);
    };

    server.commandHandlers.get_security_headers_list = async (params) => {
      if (!server.networkAnalysisManager) {
        return { success: false, error: 'Network analysis manager not available' };
      }
      return server.networkAnalysisManager.getSecurityHeadersList();
    };

    // ==========================================
    // Forensic Export Commands (v12.7.0)
    // ==========================================

    /**
     * Export full page HTML with response headers and status code
     * Returns the complete rendered HTML, HTTP response headers, and status information
     * @param {Object} params - Export options
     * @returns {Object} Forensic export result
     */
    server.commandHandlers.export_raw_html = async (params) => {
      try {
        if (!server.mainWindow || !server.mainWindow.webContents) {
          return { success: false, error: 'Window or webContents not available' };
        }

        const timestamp = new Date().toISOString();

        // Route through the active <webview> guest, not the empty browser SHELL.
        // Reading mainWindow.webContents here returned the shell's blank document.
        const pageContent = await server.getWebviewPageContent();
        if (!pageContent || !pageContent.success) {
          return {
            success: false,
            error: 'Failed to get page content: ' + ((pageContent && pageContent.error) || 'no active webview'),
            timestamp
          };
        }
        const currentUrl = pageContent.url;
        // Get the full rendered HTML (from the guest webview)
        const html = pageContent.html;

        // Try to get response headers if available from network analysis
        let responseHeaders = {};
        let statusCode = 200;

        if (server.networkAnalysisManager) {
          const requests = server.networkAnalysisManager.requestTracker?.requests || new Map();
          // Find the main document request (usually the last navigation request)
          for (const [, request] of requests) {
            if (request.resourceType === 'xhr' || request.resourceType === 'fetch') {
              continue;
            }
            if (request.url === currentUrl || request.url.split('?')[0] === currentUrl.split('?')[0]) {
              if (request.responseHeaders) {
                responseHeaders = request.responseHeaders;
              }
              if (request.statusCode) {
                statusCode = request.statusCode;
              }
              break;
            }
          }
        }

        return {
          success: true,
          timestamp,
          url: currentUrl,
          statusCode,
          responseHeaders,
          html,
          htmlLength: html.length,
          contentType: responseHeaders['content-type'] || 'text/html'
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    };

    /**
     * Export all HTTP requests and responses captured during session
     * Returns network log with complete request/response pairs including headers, body, timing
     * @param {Object} params - Export options
     * @param {string} params.format - Export format ('json', 'har', 'csv')
     * @param {string} params.resourceType - Filter by resource type (optional)
     * @param {number} params.minDuration - Filter requests longer than N ms (optional)
     * @returns {Object} Network log export result
     */
    server.commandHandlers.export_network_log = async (params) => {
      try {
        if (!server.networkAnalysisManager) {
          return { success: false, error: 'Network analysis manager not available' };
        }

        const timestamp = new Date().toISOString();
        const format = params.format || 'json';
        const resourceType = params.resourceType || null;
        const minDuration = params.minDuration || 0;

        // Get all captured requests
        const baseExport = server.networkAnalysisManager.exportCapture();
        let requests = baseExport.requests || [];

        // Apply filters if specified
        if (resourceType) {
          requests = requests.filter(r => r.resourceType === resourceType);
        }
        if (minDuration > 0) {
          requests = requests.filter(r => (r.duration || 0) >= minDuration);
        }

        // Enrich requests with additional forensic data
        const enrichedRequests = requests.map(req => ({
          id: req.id,
          url: req.url,
          method: req.method || 'GET',
          resourceType: req.resourceType,
          statusCode: req.statusCode,
          statusMessage: req.statusMessage || '',
          requestHeaders: req.requestHeaders || {},
          responseHeaders: req.responseHeaders || {},
          requestBody: req.requestBody || null,
          responseBody: req.responseBody ? req.responseBody.substring(0, 10000) : null, // Limit body size
          contentLength: req.contentLength || 0,
          duration: req.duration || 0,
          startTime: req.startTime,
          endTime: req.endTime,
          fromCache: req.fromCache || false,
          error: req.error || null,
          initiator: req.initiator || null,
          priority: req.priority || null
        }));

        const result = {
          success: true,
          timestamp,
          format,
          exportedAt: timestamp,
          totalRequests: enrichedRequests.length,
          requests: enrichedRequests
        };

        // Add summary statistics
        result.statistics = {
          byResourceType: {},
          byStatusCode: {},
          totalSize: 0,
          totalDuration: 0,
          slowestRequest: null,
          largestRequest: null
        };

        // Calculate statistics
        let maxDuration = 0;
        let maxSize = 0;

        enrichedRequests.forEach(req => {
          // By resource type
          if (!result.statistics.byResourceType[req.resourceType]) {
            result.statistics.byResourceType[req.resourceType] = { count: 0, totalSize: 0, totalDuration: 0 };
          }
          result.statistics.byResourceType[req.resourceType].count++;
          result.statistics.byResourceType[req.resourceType].totalSize += req.contentLength || 0;
          result.statistics.byResourceType[req.resourceType].totalDuration += req.duration || 0;

          // By status code
          const statusKey = `${req.statusCode}`;
          if (!result.statistics.byStatusCode[statusKey]) {
            result.statistics.byStatusCode[statusKey] = 0;
          }
          result.statistics.byStatusCode[statusKey]++;

          // Overall stats
          result.statistics.totalSize += req.contentLength || 0;
          result.statistics.totalDuration += req.duration || 0;

          // Track slowest and largest
          if (req.duration && req.duration > maxDuration) {
            maxDuration = req.duration;
            result.statistics.slowestRequest = {
              url: req.url,
              duration: req.duration
            };
          }
          if (req.contentLength && req.contentLength > maxSize) {
            maxSize = req.contentLength;
            result.statistics.largestRequest = {
              url: req.url,
              contentLength: req.contentLength
            };
          }
        });

        return result;
      } catch (error) {
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    };

    /**
     * Export device fingerprint and browser identifiers
     * Returns all device identification data including canvas, webGL, user agent, plugins, etc.
     * @param {Object} params - Export options
     * @returns {Object} Device identifiers and fingerprint data
     */
    server.commandHandlers.export_device_ids = async (params) => {
      try {
        const timestamp = new Date().toISOString();

        // Get active profile and fingerprint
        let fingerprint = {};
        let userAgent = '';

        if (server.profileManager) {
          const activeProfile = server.profileManager.getActiveProfile();
          if (activeProfile) {
            fingerprint = activeProfile.fingerprint || {};
            userAgent = activeProfile.userAgent || '';
          }
        }

        // Get user agent from manager
        if (!userAgent && server.userAgentManager) {
          const uaInfo = server.userAgentManager.getCurrentUserAgent();
          userAgent = uaInfo?.userAgent || '';
        }

        // Extract device identifiers from JavaScript
        const deviceData = await server.mainWindow.webContents.executeJavaScript(`
          (function() {
            return {
              userAgent: navigator.userAgent,
              appVersion: navigator.appVersion,
              platform: navigator.platform,
              hardwareConcurrency: navigator.hardwareConcurrency,
              deviceMemory: navigator.deviceMemory,
              maxTouchPoints: navigator.maxTouchPoints,
              screen: {
                width: screen.width,
                height: screen.height,
                availWidth: screen.availWidth,
                availHeight: screen.availHeight,
                colorDepth: screen.colorDepth,
                pixelDepth: screen.pixelDepth,
                orientation: screen.orientation?.type || 'unknown'
              },
              language: navigator.language,
              languages: navigator.languages ? Array.from(navigator.languages) : [],
              timezone: new Date().getTimezoneOffset(),
              plugins: navigator.plugins ? Array.from(navigator.plugins).map(p => ({
                name: p.name,
                description: p.description,
                version: p.version
              })) : [],
              cookieEnabled: navigator.cookieEnabled,
              doNotTrack: navigator.doNotTrack,
              webdriver: navigator.webdriver,
              vendor: navigator.vendor,
              onLine: navigator.onLine
            };
          })()
        `);

        return {
          success: true,
          timestamp,
          deviceIdentifiers: {
            ...deviceData,
            userAgent
          },
          fingerprint: {
            canvas: fingerprint.canvasFingerprint || null,
            webgl: fingerprint.webglFingerprint || null,
            webrtc: fingerprint.webrtcFingerprint || null,
            audio: fingerprint.audioFingerprint || null,
            font: fingerprint.fontFingerprint || null,
            cssFeatures: fingerprint.cssFeatures || [],
            storage: {
              localStorage: typeof localStorage !== 'undefined' ? Object.keys(localStorage).length : 0,
              sessionStorage: typeof sessionStorage !== 'undefined' ? Object.keys(sessionStorage).length : 0,
              indexedDB: typeof indexedDB !== 'undefined' ? true : false
            }
          },
          proxyInfo: server.proxyManager ? {
            enabled: server.proxyManager.isEnabled(),
            currentProxy: server.proxyManager.getCurrentProxy(),
            rotationMode: server.proxyManager.getRotationMode?.() || null
          } : null
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    };

    /**
     * Modify DOM elements (text, attributes, classes)
     * Allows surgical modification of page content for testing, evasion, or verification
     * @param {Object} params - Modification parameters
     * @param {string} params.selector - CSS selector for element(s) to modify
     * @param {string} params.type - Modification type: 'text', 'html', 'attribute', 'class', 'css'
     * @param {string} params.value - New value (for text, html, attribute value)
     * @param {string} params.attributeName - Attribute name (required if type='attribute')
     * @param {string} params.classOperation - 'add', 'remove', 'toggle' (required if type='class')
     * @param {string} params.className - Class name to add/remove/toggle
     * @param {Object} params.cssProperties - CSS properties object (required if type='css')
     * @param {boolean} params.allMatches - Apply to all matching elements (default: true)
     * @returns {Object} Modification result
     */
    server.commandHandlers.modify_element = async (params) => {
      try {
        if (!server.mainWindow || !server.mainWindow.webContents) {
          return { success: false, error: 'Window or webContents not available' };
        }

        const {
          selector,
          type,
          value,
          attributeName,
          classOperation,
          className,
          cssProperties,
          allMatches = true
        } = params;

        if (!selector) {
          return { success: false, error: 'Selector is required' };
        }
        if (!type) {
          return { success: false, error: 'Modification type is required' };
        }

        const timestamp = new Date().toISOString();

        // Validate parameters for specific types
        if (type === 'attribute' && !attributeName) {
          return { success: false, error: 'attributeName is required for attribute modification' };
        }
        if (type === 'class' && (!classOperation || !className)) {
          return { success: false, error: 'classOperation and className are required for class modification' };
        }
        if (type === 'css' && !cssProperties) {
          return { success: false, error: 'cssProperties is required for CSS modification' };
        }

        // Execute modification in page context
        const result = await server.mainWindow.webContents.executeJavaScript(`
          (function() {
            const selector = ${JSON.stringify(selector)};
            const type = ${JSON.stringify(type)};
            const value = ${JSON.stringify(value)};
            const attributeName = ${JSON.stringify(attributeName)};
            const classOperation = ${JSON.stringify(classOperation)};
            const className = ${JSON.stringify(className)};
            const cssProperties = ${JSON.stringify(cssProperties)};
            const allMatches = ${JSON.stringify(allMatches)};

            try {
              const elements = document.querySelectorAll(selector);
              if (elements.length === 0) {
                return { matched: 0, error: 'No elements matched selector' };
              }

              const maxElements = allMatches ? elements.length : 1;
              let modified = 0;

              for (let i = 0; i < maxElements; i++) {
                const elem = elements[i];

                switch (type) {
                  case 'text':
                    elem.textContent = value;
                    modified++;
                    break;

                  case 'html':
                    elem.innerHTML = value;
                    modified++;
                    break;

                  case 'attribute':
                    if (value === null) {
                      elem.removeAttribute(attributeName);
                    } else {
                      elem.setAttribute(attributeName, value);
                    }
                    modified++;
                    break;

                  case 'class':
                    if (classOperation === 'add') {
                      elem.classList.add(className);
                    } else if (classOperation === 'remove') {
                      elem.classList.remove(className);
                    } else if (classOperation === 'toggle') {
                      elem.classList.toggle(className);
                    }
                    modified++;
                    break;

                  case 'css':
                    if (cssProperties && typeof cssProperties === 'object') {
                      Object.assign(elem.style, cssProperties);
                    }
                    modified++;
                    break;
                }
              }

              return {
                matched: elements.length,
                modified,
                type,
                success: true
              };
            } catch (error) {
              return { error: error.message, success: false };
            }
          })()
        `);

        return {
          success: result.success !== false,
          timestamp,
          selector,
          type,
          matched: result.matched || 0,
          modified: result.modified || 0,
          error: result.error || null
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    };

    // ==========================================
    // Session Recording & Replay Commands
    // ==========================================

    /**
     * Start recording user actions
     * @param {Object} params - Recording options
     * @param {string} params.name - Recording name
     * @param {string} params.description - Recording description
     * @param {string} params.startUrl - Starting URL
     * @param {Object} params.variables - Variables for parameterization
     * @param {string[]} params.tags - Tags for organizing recordings
     */
    server.commandHandlers.start_recording = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      return server.sessionRecordingManager.startRecording(params);
    };

    /**
     * Stop current recording and save
     * @param {Object} params - Stop options
     * @param {string} params.name - Override recording name
     */
    server.commandHandlers.stop_recording = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      return await server.sessionRecordingManager.stopRecording(params);
    };

    /**
     * Pause current recording
     */
    server.commandHandlers.pause_recording = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      return server.sessionRecordingManager.pauseRecording();
    };

    /**
     * Resume paused recording
     */
    server.commandHandlers.resume_recording = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      return server.sessionRecordingManager.resumeRecording();
    };

    /**
     * Get current recording status
     */
    server.commandHandlers.get_recording_status = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      return {
        success: true,
        ...server.sessionRecordingManager.getRecordingStatus()
      };
    };

    /**
     * List all saved recordings
     * @param {Object} params - List options
     * @param {string} params.search - Search query
     * @param {string[]} params.tags - Filter by tags
     * @param {string} params.sortBy - Sort field (name, createdAt, duration, actionCount)
     * @param {string} params.sortOrder - Sort order (asc, desc)
     * @param {number} params.offset - Pagination offset
     * @param {number} params.limit - Pagination limit
     */
    server.commandHandlers.list_recordings = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      return server.sessionRecordingManager.listRecordings(params);
    };

    /**
     * Load a recording by ID
     * @param {Object} params
     * @param {string} params.recordingId - Recording ID to load
     */
    server.commandHandlers.load_recording = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      if (!params.recordingId) {
        return { success: false, error: 'Recording ID is required' };
      }
      return server.sessionRecordingManager.loadRecording(params.recordingId);
    };

    /**
     * Get a recording by ID (alias for load_recording)
     */
    server.commandHandlers.get_recording = async (params) => {
      return server.commandHandlers.load_recording(params);
    };

    /**
     * Delete a recording
     * @param {Object} params
     * @param {string} params.recordingId - Recording ID to delete
     */
    server.commandHandlers.delete_recording = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      if (!params.recordingId) {
        return { success: false, error: 'Recording ID is required' };
      }
      return await server.sessionRecordingManager.deleteRecording(params.recordingId);
    };

    /**
     * Update recording metadata
     * @param {Object} params
     * @param {string} params.recordingId - Recording ID
     * @param {string} params.name - New name
     * @param {string} params.description - New description
     * @param {string[]} params.tags - New tags
     * @param {Object} params.variables - New variables
     */
    server.commandHandlers.update_recording = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      if (!params.recordingId) {
        return { success: false, error: 'Recording ID is required' };
      }
      const { recordingId, ...updates } = params;
      return await server.sessionRecordingManager.updateRecording(recordingId, updates);
    };

    /**
     * Export a recording to a specific format
     * @param {Object} params
     * @param {string} params.recordingId - Recording ID to export
     * @param {string} params.format - Export format (json, python, javascript, playwright)
     */
    server.commandHandlers.export_recording = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      if (!params.recordingId) {
        return { success: false, error: 'Recording ID is required' };
      }
      return server.sessionRecordingManager.exportRecording(params.recordingId, params.format || 'json');
    };

    /**
     * Import a recording from JSON
     * @param {Object} params
     * @param {Object|string} params.data - Recording data (JSON object or string)
     */
    server.commandHandlers.import_recording = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      if (!params.data) {
        return { success: false, error: 'Recording data is required' };
      }
      return await server.sessionRecordingManager.importRecording(params.data);
    };

    /**
     * Duplicate a recording
     * @param {Object} params
     * @param {string} params.recordingId - Recording ID to duplicate
     * @param {string} params.name - New name for the duplicate
     */
    server.commandHandlers.duplicate_recording = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      if (!params.recordingId) {
        return { success: false, error: 'Recording ID is required' };
      }
      return await server.sessionRecordingManager.duplicateRecording(params.recordingId, { name: params.name });
    };

    /**
     * Add a wait action to current recording
     * @param {Object} params
     * @param {number} params.duration - Wait duration in ms
     * @param {string} params.selector - Wait for element selector
     * @param {number} params.timeout - Timeout in ms
     */
    server.commandHandlers.add_recording_wait = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      return server.sessionRecordingManager.addWait(params);
    };

    /**
     * Add a screenshot action to current recording
     * @param {Object} params
     * @param {string} params.name - Screenshot name
     * @param {boolean} params.fullPage - Full page screenshot
     * @param {string} params.selector - Element to screenshot
     */
    server.commandHandlers.add_recording_screenshot = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      return server.sessionRecordingManager.addScreenshotAction(params);
    };

    /**
     * Add a comment to current recording
     * @param {Object} params
     * @param {string} params.comment - Comment text
     */
    server.commandHandlers.add_recording_comment = async (params) => {
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      if (!params.comment) {
        return { success: false, error: 'Comment text is required' };
      }
      return server.sessionRecordingManager.addComment(params.comment);
    };

    // ==========================================
    // Replay Commands
    // ==========================================

    /**
     * Start replaying a recording
     * @param {Object} params
     * @param {string} params.recordingId - Recording ID to replay
     * @param {number} params.speed - Replay speed multiplier (0.5, 1, 2, etc.)
     * @param {string} params.errorMode - Error handling mode (fail, skip, retry, pause)
     * @param {Object} params.variables - Variable overrides for parameterization
     * @param {number} params.startIndex - Start at specific action index
     * @param {boolean} params.stepMode - Enable step-by-step mode
     */
    server.commandHandlers.start_replay = async (params) => {
      if (!server.replayEngine) {
        return { success: false, error: 'Replay engine not available' };
      }
      if (!server.sessionRecordingManager) {
        return { success: false, error: 'Session recording manager not available' };
      }
      if (!params.recordingId) {
        return { success: false, error: 'Recording ID is required' };
      }

      // Load the recording
      const loadResult = server.sessionRecordingManager.getRecording(params.recordingId);
      if (!loadResult.success) {
        return loadResult;
      }

      return server.replayEngine.startReplay(loadResult.recording, {
        speed: params.speed,
        errorMode: params.errorMode,
        variables: params.variables,
        startIndex: params.startIndex,
        stepMode: params.stepMode
      });
    };

    /**
     * Stop current replay
     */
    server.commandHandlers.stop_replay = async (params) => {
      if (!server.replayEngine) {
        return { success: false, error: 'Replay engine not available' };
      }
      return server.replayEngine.stopReplay();
    };

    /**
     * Pause current replay
     */
    server.commandHandlers.pause_replay = async (params) => {
      if (!server.replayEngine) {
        return { success: false, error: 'Replay engine not available' };
      }
      return server.replayEngine.pauseReplay();
    };

    /**
     * Resume paused replay
     */
    server.commandHandlers.resume_replay = async (params) => {
      if (!server.replayEngine) {
        return { success: false, error: 'Replay engine not available' };
      }
      return server.replayEngine.resumeReplay();
    };

    /**
     * Step to next action in step mode
     */
    server.commandHandlers.step_replay = async (params) => {
      if (!server.replayEngine) {
        return { success: false, error: 'Replay engine not available' };
      }
      return server.replayEngine.stepNext();
    };
}

module.exports = { registerCoreCmds07 };
