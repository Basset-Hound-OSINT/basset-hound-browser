/**
 * Batch Operations & Deduplication WebSocket Commands
 *
 * Provides WebSocket API commands for batch processing operations:
 * - batch_export_urls - Extract from multiple URLs
 * - batch_parallel_processing - Concurrent extractions
 * - deduplicate_exports - Remove duplicate records
 * - merge_exports - Combine multiple exports
 * - export_delta - Only changed data since last export
 * - batch_filtering - Apply filters across batch
 * - batch_status - Track progress of batch job
 *
 * Commands: 7 new WebSocket operations
 * Expected throughput: 500-1000 records/sec (with 5 parallel operations)
 *
 * @module websocket/commands/batch-operations-commands
 */

const { BatchOperationsEngine } = require('../../src/export/batch-operations-engine');

// Global engine instance
let batchEngine = null;

/**
 * Register batch operations commands with WebSocket server
 *
 * @param {Object} server - WebSocket server instance
 * @param {Object} mainWindow - Electron main window
 */
function registerBatchOperationsCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  // Initialize engine on first use
  const getEngine = () => {
    if (!batchEngine) {
      batchEngine = new BatchOperationsEngine({
        maxConcurrentOperations: 5,
        batchTimeout: 300000, // 5 minutes
        deduplicationAlgorithm: 'hash',
        progressUpdateInterval: 500
      });

      // Set up event forwarding to WebSocket clients
      setupEventForwarding(server);
    }
    return batchEngine;
  };

  /**
   * batch_export_urls - Extract data from multiple URLs
   *
   * Command: batch_export_urls
   * Params: {
   *   batchId: string,
   *   urls: string[],
   *   extractionTemplate?: string,
   *   options?: {
   *     parallel?: boolean,
   *     maxConcurrent?: number,
   *     timeout?: number,
   *     retryOnFailure?: boolean,
   *     maxRetries?: number
   *   }
   * }
   * Response: {
   *   success: boolean,
   *   batchId: string,
   *   jobId: string,
   *   status: string,
   *   totalUrls: number
   * }
   */
  commandHandlers.batch_export_urls = async (params) => {
    try {
      if (!params.batchId || !params.urls || params.urls.length === 0) {
        return {
          success: false,
          error: 'batchId and non-empty urls array are required'
        };
      }

      const engine = getEngine();

      // Create extraction callback based on template or default
      const extractionCallback = async (url, options) => {
        // Use mainWindow's page loading capability
        return new Promise((resolve, reject) => {
          mainWindow.webContents.send('extract-from-url', { url, options });

          const timeout = options.timeout || 30000;
          const timer = setTimeout(() => {
            reject(new Error('Extraction timeout'));
          }, timeout);

          const handleExtractResult = (event, result) => {
            clearTimeout(timer);
            mainWindow.webContents.off('extraction-result', handleExtractResult);
            if (result.success) {
              resolve(result.data);
            } else {
              reject(new Error(result.error));
            }
          };

          mainWindow.webContents.on('extraction-result', handleExtractResult);
        });
      };

      const result = await engine.startBatchExport(
        params.batchId,
        params.urls,
        params.options || {},
        extractionCallback
      );

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * batch_parallel_processing - Process multiple URLs with parallel execution
   *
   * Command: batch_parallel_processing
   * Params: {
   *   batchId: string,
   *   urls: string[],
   *   maxConcurrent?: number (default: 5),
   *   timeout?: number (default: 300000)
   * }
   * Response: {
   *   success: boolean,
   *   jobId: string,
   *   totalUrls: number,
   *   maxConcurrent: number
   * }
   */
  commandHandlers.batch_parallel_processing = async (params) => {
    try {
      if (!params.batchId || !params.urls || params.urls.length === 0) {
        return {
          success: false,
          error: 'batchId and urls are required'
        };
      }

      const engine = getEngine();

      const extractionCallback = async (url, options) => {
        // Implementation: navigate to URL and extract content
        return new Promise((resolve, reject) => {
          const timeout = options.timeout || 30000;
          const timer = setTimeout(() => {
            reject(new Error('Extraction timeout'));
          }, timeout);

          mainWindow.webContents.send('navigate-and-extract', { url });

          const handleResult = (event, result) => {
            clearTimeout(timer);
            mainWindow.webContents.off('navigation-result', handleResult);
            resolve(result);
          };

          mainWindow.webContents.on('navigation-result', handleResult);
        });
      };

      const result = await engine.startBatchExport(
        params.batchId,
        params.urls,
        {
          parallel: true,
          maxConcurrent: params.maxConcurrent || 5,
          timeout: params.timeout || 300000
        },
        extractionCallback
      );

      return {
        success: true,
        ...result,
        maxConcurrent: params.maxConcurrent || 5
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * deduplicate_exports - Remove duplicate records from batch
   *
   * Command: deduplicate_exports
   * Params: {
   *   records: object[],
   *   algorithm?: string ('hash' | 'content' | 'fuzzy'),
   *   fields?: string[] (for hash algorithm)
   * }
   * Response: {
   *   success: boolean,
   *   unique: object[],
   *   duplicates: object[],
   *   deduplicationStats: {
   *     totalRecords: number,
   *     uniqueRecords: number,
   *     duplicatesRemoved: number,
   *     deduplicationRatio: string
   *   }
   * }
   */
  commandHandlers.deduplicate_exports = async (params) => {
    try {
      if (!params.records || !Array.isArray(params.records)) {
        return {
          success: false,
          error: 'records array is required'
        };
      }

      const engine = getEngine();

      const result = engine.deduplicateRecords(params.records, {
        algorithm: params.algorithm || 'hash',
        fields: params.fields || ['url', 'id', 'hash']
      });

      if (result.success === false) {
        return result;
      }

      return {
        success: true,
        unique: result.unique,
        duplicates: result.duplicates,
        deduplicationStats: result.deduplicationStats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * merge_exports - Combine multiple exports into one
   *
   * Command: merge_exports
   * Params: {
   *   exports: object[],
   *   strategy?: string ('union' | 'intersection' | 'custom'),
   *   resolver?: function (for custom strategy)
   * }
   * Response: {
   *   success: boolean,
   *   mergeId: string,
   *   merged: object[],
   *   mergeStats: {
   *     totalSourceExports: number,
   *     totalRecordsBefore: number,
   *     totalRecordsAfter: number,
   *     recordsAddedByMerge: number,
   *     recordsUpdatedByMerge: number,
   *     conflictsResolved: number,
   *     mergeDuration: number
   *   }
   * }
   */
  commandHandlers.merge_exports = async (params) => {
    try {
      if (!params.exports || !Array.isArray(params.exports) || params.exports.length === 0) {
        return {
          success: false,
          error: 'non-empty exports array is required'
        };
      }

      const engine = getEngine();

      const result = engine.mergeExports(params.exports, {
        strategy: params.strategy || 'union',
        resolver: params.resolver
      });

      if (result.success === false) {
        return result;
      }

      return {
        success: true,
        mergeId: result.mergeId,
        merged: result.merged,
        mergeStats: result.mergeStats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * export_delta - Get only changed data since last export
   *
   * Command: export_delta
   * Params: {
   *   currentExport: object,
   *   baselineExport: object,
   *   compareFields?: string[]
   * }
   * Response: {
   *   success: boolean,
   *   delta: {
   *     added: object[],
   *     updated: object[],
   *     removed: object[]
   *   },
   *   deltaStats: {
   *     added: number,
   *     updated: number,
   *     removed: number,
   *     unchanged: number,
   *     totalChanges: number
   *   }
   * }
   */
  commandHandlers.export_delta = async (params) => {
    try {
      if (!params.currentExport || !params.baselineExport) {
        return {
          success: false,
          error: 'currentExport and baselineExport are required'
        };
      }

      const engine = getEngine();

      const result = engine.exportDelta(
        params.currentExport,
        params.baselineExport,
        {
          compareFields: params.compareFields
        }
      );

      if (result.success === false) {
        return result;
      }

      return {
        success: true,
        delta: result.delta,
        deltaStats: {
          added: result.deltaStats.added.length,
          updated: result.deltaStats.updated.length,
          removed: result.deltaStats.removed.length,
          unchanged: result.deltaStats.unchanged.length,
          totalChanges: result.deltaStats.totalChanges
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * batch_filtering - Apply filters across batch of records
   *
   * Command: batch_filtering
   * Params: {
   *   records: object[],
   *   filters: {
   *     field: string,
   *     operator: string,
   *     value: any
   *   }[]
   * }
   * Operators: equals, notEquals, contains, greaterThan, lessThan,
   *           greaterThanOrEqual, lessThanOrEqual, in, notIn, regex, exists
   * Response: {
   *   success: boolean,
   *   filtered: object[],
   *   filterStats: {
   *     totalRecords: number,
   *     filtersApplied: number,
   *     recordsMatched: number,
   *     filterDetails: object[]
   *   }
   * }
   */
  commandHandlers.batch_filtering = async (params) => {
    try {
      if (!params.records || !Array.isArray(params.records)) {
        return {
          success: false,
          error: 'records array is required'
        };
      }

      if (!params.filters || !Array.isArray(params.filters)) {
        return {
          success: false,
          error: 'filters array is required'
        };
      }

      const engine = getEngine();

      const result = engine.applyBatchFilters(params.records, params.filters);

      if (result.success === false) {
        return result;
      }

      return {
        success: true,
        filtered: result.filtered,
        filterStats: result.filterStats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * batch_status - Get status of batch operation
   *
   * Command: batch_status
   * Params: {
   *   jobId: string
   * }
   * Response: {
   *   success: boolean,
   *   jobId: string,
   *   batchId?: string,
   *   status: string,
   *   progress: {
   *     processed: number,
   *     successful: number,
   *     failed: number,
   *     total: number
   *   },
   *   errorCount: number,
   *   duration: number,
   *   active: boolean
   * }
   */
  commandHandlers.batch_status = async (params) => {
    try {
      if (!params.jobId) {
        return {
          success: false,
          error: 'jobId is required'
        };
      }

      const engine = getEngine();
      const status = engine.getBatchStatus(params.jobId);

      if (status.error) {
        return {
          success: false,
          error: status.error
        };
      }

      return {
        success: true,
        ...status
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * list_batch_jobs - List all active and recent batch jobs
   *
   * Command: list_batch_jobs
   * Params: {} (no parameters)
   * Response: {
   *   success: boolean,
   *   activeBatches: object[],
   *   totalActive: number
   * }
   */
  commandHandlers.list_batch_jobs = async (params) => {
    try {
      const engine = getEngine();
      const activeBatches = engine.listActiveBatches();

      return {
        success: true,
        activeBatches,
        totalActive: activeBatches.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * cancel_batch_job - Cancel a running batch job
   *
   * Command: cancel_batch_job
   * Params: {
   *   jobId: string
   * }
   * Response: {
   *   success: boolean,
   *   jobId: string,
   *   processedBefore: number
   * }
   */
  commandHandlers.cancel_batch_job = async (params) => {
    try {
      if (!params.jobId) {
        return {
          success: false,
          error: 'jobId is required'
        };
      }

      const engine = getEngine();
      const result = engine.cancelBatch(params.jobId);

      if (result.error) {
        return {
          success: false,
          error: result.error
        };
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * get_batch_statistics - Get batch engine statistics
   *
   * Command: get_batch_statistics
   * Params: {} (no parameters)
   * Response: {
   *   success: boolean,
   *   statistics: {
   *     totalBatchesProcessed: number,
   *     totalRecordsProcessed: number,
   *     totalDuplicatesRemoved: number,
   *     totalMerges: number,
   *     activeBatchCount: number,
   *     historicalBatchCount: number
   *   }
   * }
   */
  commandHandlers.get_batch_statistics = async (params) => {
    try {
      const engine = getEngine();
      const statistics = engine.getStatistics();

      return {
        success: true,
        statistics
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * reset_batch_statistics - Reset batch engine statistics
   *
   * Command: reset_batch_statistics
   * Params: {} (no parameters)
   * Response: { success: boolean }
   */
  commandHandlers.reset_batch_statistics = async (params) => {
    try {
      const engine = getEngine();
      engine.resetStatistics();

      return {
        success: true,
        message: 'Statistics reset'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };
}

/**
 * Setup event forwarding from batch engine to WebSocket clients
 *
 * @private
 */
function setupEventForwarding(server) {
  if (!batchEngine) return;

  batchEngine.on('batch-started', (data) => {
    server.broadcast('batch-event', {
      type: 'batch-started',
      ...data
    });
  });

  batchEngine.on('batch-progress', (data) => {
    server.broadcast('batch-event', {
      type: 'batch-progress',
      ...data
    });
  });

  batchEngine.on('batch-completed', (data) => {
    server.broadcast('batch-event', {
      type: 'batch-completed',
      ...data
    });
  });

  batchEngine.on('batch-cancelled', (data) => {
    server.broadcast('batch-event', {
      type: 'batch-cancelled',
      ...data
    });
  });

  batchEngine.on('url-error', (data) => {
    server.broadcast('batch-event', {
      type: 'url-error',
      ...data
    });
  });

  batchEngine.on('batch-error', (data) => {
    server.broadcast('batch-event', {
      type: 'batch-error',
      ...data
    });
  });

  batchEngine.on('deduplication-complete', (data) => {
    server.broadcast('batch-event', {
      type: 'deduplication-complete',
      ...data
    });
  });

  batchEngine.on('merge-complete', (data) => {
    server.broadcast('batch-event', {
      type: 'merge-complete',
      ...data
    });
  });

  batchEngine.on('batch-filter-complete', (data) => {
    server.broadcast('batch-event', {
      type: 'batch-filter-complete',
      ...data
    });
  });
}

module.exports = {
  registerBatchOperationsCommands,
  BatchOperationsEngine: require('../../src/export/batch-operations-engine').BatchOperationsEngine
};
