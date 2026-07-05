/**
 * Basset Hound Browser - WebSocket Logging Middleware Integration Example
 *
 * This file demonstrates how to integrate the WebSocketLoggingMiddleware
 * into the main WebSocket server for request/response logging.
 *
 * LOCATION: Add to websocket/server.js
 */

// ============================================================================
// STEP 1: Import the logging middleware at the top of server.js
// ============================================================================
const { WebSocketLoggingMiddleware } = require('./logging-middleware');

// ============================================================================
// STEP 2: Initialize middleware in the WebSocketServer constructor
// ============================================================================
class WebSocketServer {
  constructor(options = {}) {
    // ... existing initialization code ...

    // Initialize WebSocket request/response logging middleware
    // Can be configured via environment variables:
    // - WS_LOG_LEVEL: DEBUG, INFO, WARN, ERROR (default: INFO)
    // - WS_LOG_DIR: Directory for log files (default: ./logs/websocket)
    // - WS_LOG_ENABLE: Enable logging (default: true)
    this.loggingMiddleware = new WebSocketLoggingMiddleware({
      level: process.env.WS_LOG_LEVEL || 'INFO',
      logDir: process.env.WS_LOG_DIR || path.join(process.cwd(), 'logs', 'websocket'),
      maskSensitive: true,
      truncatePayloads: true,
      maxPayloadLength: 1000,
      writeToFile: process.env.WS_LOG_ENABLE !== 'false',
      writeToConsole: process.env.WS_LOG_CONSOLE === 'true',
      excludeCommands: [
        'ping', // Exclude high-frequency heartbeat commands
        'get_rate_limit_status' // Exclude rate limit status checks
      ]
    });

    // Listen for logging middleware events
    this.loggingMiddleware.on('error', (error) => {
      this.logger.error(`Logging middleware error: ${error.message}`, { error });
    });

    this.loggingMiddleware.on('logFileOpened', (filePath) => {
      this.logger.info(`Logging middleware opened new log file: ${filePath}`);
    });

    this.loggingMiddleware.on('logRotated', () => {
      this.logger.info('Logging middleware rotated log file');
    });
  }

  // ============================================================================
  // STEP 3: Update the message handler in handleConnection()
  // ============================================================================
  handleConnection(ws, req) {
    // ... existing connection setup code ...

    ws.on('message', async (message) => {
      const startTime = Date.now();
      let command = 'unknown';
      let clientId = ws.clientId;

      try {
        // ... existing security validation code ...

        const data = JSON.parse(message.toString());
        command = data.command || 'unknown';

        // LOG REQUEST: Record incoming command
        this.loggingMiddleware.logRequest(
          command,
          clientId,
          data, // Full request parameters (will mask sensitive data)
          'DEBUG' // Log level
        );

        // ... existing authentication and rate limiting code ...

        try {
          // Execute command
          const reliabilityResult = await this.reliabilityManager.execute(
            command,
            async () => {
              return await this.commandDispatcher.execute(command, params, {
                enableRetry: true,
                maxRetries: ERROR_RECOVERY_CONFIG.maxRetries,
                clientId: clientId,
                commandId: data.id,
                upgradeRequest: ws.upgradeRequest,
                remoteAddress: req.socket.remoteAddress
              });
            },
            {
              timeout: calculateAdaptiveTimeout(command)
            }
          );

          // Calculate response time
          const responseTime = Date.now() - startTime;

          // Prepare response
          let response;
          let statusCode = 200; // Success
          let responseSize = 0;
          let error = null;
          let errorCode = null;

          if (reliabilityResult.success) {
            response = reliabilityResult.result;
            responseSize = JSON.stringify(response).length;
          } else {
            statusCode = 500; // Generic server error
            error = reliabilityResult.error;
            errorCode = 'COMMAND_FAILED';

            // Determine specific error code and status
            if (reliabilityResult.timedOut) {
              statusCode = 504; // Gateway Timeout
              errorCode = 'COMMAND_TIMED_OUT';
            } else if (reliabilityResult.error.includes('rate limit')) {
              statusCode = 429; // Too Many Requests
              errorCode = 'RATE_LIMIT_EXCEEDED';
            } else if (reliabilityResult.error.includes('not found')) {
              statusCode = 404; // Not Found
              errorCode = 'RESOURCE_NOT_FOUND';
            }

            response = {
              success: false,
              error: reliabilityResult.error,
              attempts: reliabilityResult.attempts,
              latency: reliabilityResult.latency,
              retried: reliabilityResult.retried,
              timedOut: reliabilityResult.timedOut
            };
            responseSize = JSON.stringify(response).length;
          }

          // LOG RESPONSE: Record outgoing response
          this.loggingMiddleware.logResponse(
            command,
            clientId,
            statusCode,
            responseTime,
            responseSize,
            error,
            errorCode,
            reliabilityResult.timedOut ? 'Increase timeout or check selector' : null,
            statusCode >= 400 ? 'WARN' : 'DEBUG'
          );

          // Send response to client
          this._sendResponse(ws, {
            id: data.id,
            command: command,
            ...response
          }, statusCode >= 400 ? 'error' : 'success');

        } catch (error) {
          // Handle execution errors
          const responseTime = Date.now() - startTime;

          // LOG ERROR RESPONSE
          this.loggingMiddleware.logResponse(
            command,
            clientId,
            500,
            responseTime,
            0,
            error.message,
            'INTERNAL_ERROR',
            'Check server logs for details',
            'ERROR'
          );

          this._sendResponse(ws, {
            success: false,
            error: error.message,
            errorCode: 'INTERNAL_ERROR'
          }, 'error');
        }

      } catch (error) {
        const responseTime = Date.now() - startTime;

        // LOG PARSING/VALIDATION ERRORS
        this.loggingMiddleware.logResponse(
          command,
          clientId,
          400,
          responseTime,
          0,
          error.message,
          error instanceof SyntaxError ? 'MALFORMED_JSON' : 'INVALID_FORMAT',
          'Check request format and required fields',
          'WARN'
        );

        this._sendResponse(ws, {
          success: false,
          error: error.message,
          errorCode: error instanceof SyntaxError ? 'MALFORMED_JSON' : 'INVALID_FORMAT'
        }, 'error');
      }
    });
  }

  // ============================================================================
  // STEP 4: Add helper methods to expose logging stats and configuration
  // ============================================================================

  /**
   * Get logging middleware statistics
   * @returns {Object} Logging statistics
   */
  getLoggingStats() {
    return this.loggingMiddleware.getStats();
  }

  /**
   * Get list of active log files
   * @returns {Array<Object>} Array of log file objects
   */
  getLogFiles() {
    return this.loggingMiddleware.getLogFiles();
  }

  /**
   * Set logging level
   * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
   */
  setLoggingLevel(level) {
    try {
      this.loggingMiddleware.setLevel(level);
      this.logger.info(`Logging level changed to ${level}`);
    } catch (error) {
      this.logger.error(`Failed to set logging level: ${error.message}`);
    }
  }

  /**
   * Clear all log files
   */
  clearLogs() {
    this.loggingMiddleware.clearLogs();
    this.logger.info('Log files cleared');
  }

  // ============================================================================
  // STEP 5: Add shutdown cleanup
  // ============================================================================

  /**
   * Shutdown (update existing shutdown method)
   */
  shutdown() {
    // ... existing shutdown code ...

    // Cleanup logging middleware
    if (this.loggingMiddleware) {
      this.loggingMiddleware.shutdown();
    }
  }
}

// ============================================================================
// STEP 6: Add WebSocket commands for logging management (optional)
// ============================================================================

/**
 * Register logging management commands
 * These commands allow clients to control logging behavior
 */
function registerLoggingCommands(dispatcher, server) {
  dispatcher.register('get_logging_stats', async (params, context) => {
    return {
      success: true,
      stats: server.getLoggingStats()
    };
  });

  dispatcher.register('get_log_files', async (params, context) => {
    return {
      success: true,
      files: server.getLogFiles()
    };
  });

  dispatcher.register('set_logging_level', async (params, context) => {
    const { level } = params;
    if (!['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(level)) {
      return {
        success: false,
        error: `Invalid log level. Valid values: DEBUG, INFO, WARN, ERROR`
      };
    }

    server.setLoggingLevel(level);
    return {
      success: true,
      message: `Logging level set to ${level}`,
      stats: server.getLoggingStats()
    };
  });

  dispatcher.register('clear_logs', async (params, context) => {
    server.clearLogs();
    return {
      success: true,
      message: 'All log files cleared'
    };
  });
}

// ============================================================================
// EXAMPLE USAGE IN CLIENT
// ============================================================================

/**
 * Example client commands for logging
 *
 * // Get logging statistics
 * {
 *   "command": "get_logging_stats",
 *   "id": "123"
 * }
 *
 * Response:
 * {
 *   "id": "123",
 *   "command": "get_logging_stats",
 *   "success": true,
 *   "stats": {
 *     "totalRequests": 1234,
 *     "totalResponses": 1230,
 *     "successfulResponses": 1200,
 *     "failedResponses": 30,
 *     "averageResponseTime": 145,
 *     "uptime": 3600000,
 *     "requestsPerMinute": 20,
 *     "successRate": "97.56%",
 *     "currentLogFile": "/path/to/logs/websocket/websocket-2026-06-21T16-30-45.log",
 *     "currentLogFileSize": "2.3MB"
 *   }
 * }
 *
 * // Get list of log files
 * {
 *   "command": "get_log_files",
 *   "id": "124"
 * }
 *
 * // Change logging level
 * {
 *   "command": "set_logging_level",
 *   "id": "125",
 *   "level": "DEBUG"
 * }
 *
 * // Clear all logs
 * {
 *   "command": "clear_logs",
 *   "id": "126"
 * }
 */

module.exports = {
  registerLoggingCommands
};
