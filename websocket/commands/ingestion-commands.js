/**
 * Basset Hound Browser - Data Ingestion WebSocket Commands
 *
 * Provides WebSocket API commands for data type detection and ingestion.
 * These commands enable automated and selective ingestion of OSINT data
 * from web pages into the basset-hound platform.
 *
 * Commands:
 * - detect_data_types: Scan page and return all detected data types
 * - configure_ingestion: Set ingestion mode and type filters
 * - ingest_selected: Ingest user-selected items
 * - ingest_all: Ingest all detected/queued items
 * - get_ingestion_config: Get current ingestion configuration
 * - get_ingestion_queue: Get items awaiting ingestion
 * - get_ingestion_history: Get log of ingested items
 * - get_detection_types: Get available detection types
 * - export_detections: Export detected data to JSON
 * - clear_ingestion_queue: Clear pending items
 *
 * @module websocket/commands/ingestion-commands
 */

const {
  DataTypeDetector,
  createDetector,
  IngestionProcessor,
  createIngestionProcessor,
  INGESTION_MODES,
  DETECTION_PATTERNS
} = require('../../extraction');

// Singleton instances
let ingestionProcessor = null;
let dataTypeDetector = null;

/**
 * Initialize the ingestion processor
 * @param {Object} config - Initial configuration
 * @returns {IngestionProcessor}
 */
function getIngestionProcessor(config = {}) {
  if (!ingestionProcessor) {
    ingestionProcessor = createIngestionProcessor(config);
  }
  return ingestionProcessor;
}

/**
 * Get or create data type detector
 * @param {Object} config - Configuration
 * @returns {DataTypeDetector}
 */
function getDataTypeDetector(config = {}) {
  if (!dataTypeDetector) {
    dataTypeDetector = createDetector(config);
  }
  return dataTypeDetector;
}

/**
 * Helper to generate recovery suggestions
 * @param {string} command - Command name
 * @param {string} param - Parameter name
 * @param {string} type - Expected type
 * @returns {Object}
 */
function generateRecoverySuggestion(command, param, type) {
  return {
    suggestion: param
      ? `Ensure parameter '${param}' is provided and is of type ${type}`
      : `Check command parameters for '${command}'`,
    documentation: `See Phase 13 in ROADMAP.md for ${command} documentation`
  };
}

/**
 * Register ingestion commands on the WebSocket server
 * @param {Object} server - WebSocket server instance with commandHandlers
 * @param {Object} mainWindow - Electron BrowserWindow
 */
function registerIngestionCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  // ==========================================
  // detect_data_types - Scan page for data types
  // ==========================================
  commandHandlers.detect_data_types = async (params) => {
    try {
      let html = params.html;
      let url = params.url || '';

      // Get page content if not provided
      if (!html && mainWindow) {
        try {
          const webContents = mainWindow.webContents;
          html = await webContents.executeJavaScript('document.documentElement.outerHTML');
          url = await webContents.executeJavaScript('window.location.href');
        } catch (e) {
          return {
            success: false,
            error: 'Failed to get page content',
            details: e.message
          };
        }
      }

      if (!html) {
        return {
          success: false,
          error: 'No HTML content available',
          recovery: generateRecoverySuggestion('detect_data_types', 'html', 'string')
        };
      }

      // Get detector with optional type filters
      const detector = getDataTypeDetector({
        enabledTypes: params.types || undefined,
        confidenceThreshold: params.confidence_threshold || 0.5
      });

      // Perform detection
      const result = detector.detectAll(html, url);

      return {
        success: result.success,
        data: {
          pageUrl: result.pageUrl,
          detectedAt: result.detectedAt,
          totalItems: result.totalItems,
          items: result.items,
          summary: result.summary,
          processingTime: result.processingTime
        },
        errors: result.errors,
        warnings: result.warnings
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        recovery: generateRecoverySuggestion('detect_data_types', null, null)
      };
    }
  };

  // ==========================================
  // configure_ingestion - Set ingestion configuration
  // ==========================================
  commandHandlers.configure_ingestion = async (params) => {
    try {
      const processor = getIngestionProcessor();

      // Validate mode if provided
      if (params.mode && !Object.values(INGESTION_MODES).includes(params.mode)) {
        return {
          success: false,
          error: `Invalid ingestion mode: ${params.mode}`,
          valid_modes: Object.values(INGESTION_MODES)
        };
      }

      // Apply configuration
      processor.configure({
        mode: params.mode,
        enabledTypes: params.enabled_types,
        autoIngestTypes: params.auto_ingest_types,
        confidenceThreshold: params.confidence_threshold,
        deduplication: params.deduplication,
        rateLimiting: params.rate_limiting,
        provenance: params.provenance
      });

      return {
        success: true,
        message: 'Ingestion configuration updated',
        config: processor.getConfig()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // get_ingestion_config - Get current configuration
  // ==========================================
  commandHandlers.get_ingestion_config = async () => {
    try {
      const processor = getIngestionProcessor();

      return {
        success: true,
        config: processor.getConfig(),
        available_modes: Object.values(INGESTION_MODES),
        available_types: Object.keys(DETECTION_PATTERNS)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // process_page - Full page processing
  // ==========================================
  commandHandlers.process_page_for_ingestion = async (params) => {
    try {
      let html = params.html;
      let url = params.url || '';

      // Get page content if not provided
      if (!html && mainWindow) {
        try {
          const webContents = mainWindow.webContents;
          html = await webContents.executeJavaScript('document.documentElement.outerHTML');
          url = await webContents.executeJavaScript('window.location.href');
        } catch (e) {
          return {
            success: false,
            error: 'Failed to get page content',
            details: e.message
          };
        }
      }

      if (!html) {
        return {
          success: false,
          error: 'No HTML content available'
        };
      }

      const processor = getIngestionProcessor();
      const result = await processor.processPage(html, url);

      return {
        success: result.success,
        data: {
          url: result.url,
          processedAt: result.processedAt,
          detected: result.detected.length,
          autoIngested: result.autoIngested,
          queued: result.queued,
          skipped: result.skipped.length
        },
        errors: result.errors
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // ingest_selected - Ingest selected items
  // ==========================================
  commandHandlers.ingest_selected = async (params) => {
    try {
      if (!params.item_ids || !Array.isArray(params.item_ids)) {
        return {
          success: false,
          error: 'item_ids parameter required (array of item IDs)',
          recovery: generateRecoverySuggestion('ingest_selected', 'item_ids', 'array')
        };
      }

      const processor = getIngestionProcessor();
      const result = await processor.ingestSelected(params.item_ids);

      return {
        success: true,
        data: {
          ingested: result.ingested.length,
          failed: result.failed,
          notFound: result.notFound,
          items: result.ingested
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // ingest_all - Ingest all queued items
  // ==========================================
  commandHandlers.ingest_all = async () => {
    try {
      const processor = getIngestionProcessor();
      const result = await processor.ingestAll();

      return {
        success: true,
        data: {
          ingested: result.ingested.length,
          failed: result.failed,
          items: result.ingested
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // get_ingestion_queue - Get pending items
  // ==========================================
  commandHandlers.get_ingestion_queue = async () => {
    try {
      const processor = getIngestionProcessor();
      const queue = processor.getQueue();

      return {
        success: true,
        data: {
          count: queue.length,
          items: queue
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // clear_ingestion_queue - Clear queue
  // ==========================================
  commandHandlers.clear_ingestion_queue = async () => {
    try {
      const processor = getIngestionProcessor();
      processor.clearQueue();

      return {
        success: true,
        message: 'Ingestion queue cleared'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // remove_from_queue - Remove specific items
  // ==========================================
  commandHandlers.remove_from_ingestion_queue = async (params) => {
    try {
      if (!params.item_ids || !Array.isArray(params.item_ids)) {
        return {
          success: false,
          error: 'item_ids parameter required',
          recovery: generateRecoverySuggestion('remove_from_ingestion_queue', 'item_ids', 'array')
        };
      }

      const processor = getIngestionProcessor();
      processor.removeFromQueue(params.item_ids);

      return {
        success: true,
        message: `Removed ${params.item_ids.length} items from queue`,
        queueLength: processor.getQueue().length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // get_ingestion_history - Get history
  // ==========================================
  commandHandlers.get_ingestion_history = async (params) => {
    try {
      const processor = getIngestionProcessor();
      const limit = params.limit || 100;
      const history = processor.getHistory(limit);

      return {
        success: true,
        data: {
          count: history.length,
          items: history
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // get_ingestion_stats - Get statistics
  // ==========================================
  commandHandlers.get_ingestion_stats = async () => {
    try {
      const processor = getIngestionProcessor();

      return {
        success: true,
        stats: processor.getStats()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // get_detection_types - Get available types
  // ==========================================
  commandHandlers.get_detection_types = async () => {
    try {
      const detector = getDataTypeDetector();
      const types = detector.getAvailableTypes();

      return {
        success: true,
        types: types,
        count: Object.keys(types).length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // export_detections - Export to JSON
  // ==========================================
  commandHandlers.export_detections = async (params) => {
    try {
      const processor = getIngestionProcessor();

      // Get items to export (queue by default)
      let items;
      if (params.items) {
        items = params.items;
      } else {
        items = processor.getQueue();
      }

      const json = processor.exportToJson(items);

      return {
        success: true,
        data: {
          format: 'json',
          itemCount: items.length,
          content: params.as_string ? json : JSON.parse(json)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // set_ingestion_mode - Quick mode change
  // ==========================================
  commandHandlers.set_ingestion_mode = async (params) => {
    try {
      if (!params.mode) {
        return {
          success: false,
          error: 'mode parameter required',
          valid_modes: Object.values(INGESTION_MODES)
        };
      }

      const processor = getIngestionProcessor();
      processor.setMode(params.mode);

      return {
        success: true,
        message: `Ingestion mode set to: ${params.mode}`,
        mode: params.mode
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // reset_ingestion_stats - Reset statistics
  // ==========================================
  commandHandlers.reset_ingestion_stats = async () => {
    try {
      const processor = getIngestionProcessor();
      processor.resetStats();

      return {
        success: true,
        message: 'Ingestion statistics reset'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // add_detection_pattern - Add custom pattern
  // ==========================================
  commandHandlers.add_detection_pattern = async (params) => {
    try {
      if (!params.key || !params.patterns) {
        return {
          success: false,
          error: 'key and patterns parameters required'
        };
      }

      const detector = getDataTypeDetector();
      detector.addPattern(params.key, {
        name: params.name || params.key,
        patterns: params.patterns,
        orphanType: params.orphan_type || 'other',
        validator: params.validator,
        contextChars: params.context_chars || 50,
        priority: params.priority || 99,
        metadata: params.metadata
      });

      return {
        success: true,
        message: `Detection pattern '${params.key}' added`,
        key: params.key
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // ==========================================
  // remove_detection_pattern - Remove pattern
  // ==========================================
  commandHandlers.remove_detection_pattern = async (params) => {
    try {
      if (!params.key) {
        return {
          success: false,
          error: 'key parameter required'
        };
      }

      const detector = getDataTypeDetector();
      detector.removePattern(params.key);

      return {
        success: true,
        message: `Detection pattern '${params.key}' removed`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  console.log('[WebSocket] Ingestion commands registered (14 commands)');
}

module.exports = {
  registerIngestionCommands,
  getIngestionProcessor,
  getDataTypeDetector,
  INGESTION_MODES
};
