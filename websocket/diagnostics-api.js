/**
 * Diagnostics & Self-Documenting API Handler with API Versioning
 *
 * Provides comprehensive API documentation endpoints that allow users to query
 * the browser for help and command documentation without external files.
 *
 * Versioned Endpoints:
 * - GET /api/v1/help - List all available commands (v1)
 * - GET /api/v1/help?command=<name> - Get command details (v1)
 * - GET /api/v2/help - Enhanced help with deprecation info (v2)
 * - GET /api/v1/diagnostics - Browser health, version, capabilities (v1)
 * - GET /api/v2/diagnostics - Extended diagnostics with telemetry (v2)
 * - GET /api/v1/status - Current browser status (v1)
 * - GET /api/v2/status - Extended status with recommendations (v2)
 * - GET /api/v1/schema - OpenAPI schema (v1)
 * - GET /api/v2/schema - Extended schema with versioning info (v2)
 * - GET /api/version - Version negotiation and available versions
 * - Legacy endpoints without version prefix continue to work (v1 default)
 *
 * Version Negotiation:
 * - Accept-Version header: "1.0" or "2.0"
 * - Query parameter: ?apiVersion=1 or ?apiVersion=2
 * - URL prefix: /api/v1/* or /api/v2/*
 * - Header takes precedence > URL > Query parameter
 *
 * Benefits:
 * - Self-documenting API (no external files needed)
 * - Users can query help directly from browser
 * - Automatic documentation generation
 * - Error recovery guidance
 * - Real-time capability discovery
 * - Backward compatibility with legacy endpoints
 * - Version negotiation for client compatibility
 *
 * @module websocket/diagnostics-api
 */

const registry = require('./command-registry');
const os = require('os');
const fs = require('fs');
const path = require('path');

class DiagnosticsAPI {
  constructor(options = {}) {
    this.version = options.version || '12.7.0';
    this.startTime = Date.now();
    this.healthManager = options.healthManager || null;
    this.logger = options.logger || console;
    this.browserInfo = options.browserInfo || {};
    this.capabilities = options.capabilities || {};

    // API versioning configuration
    this.supportedVersions = {
      '1.0': { name: 'v1', status: 'stable', releaseDate: '2026-01-01' },
      '2.0': { name: 'v2', status: 'stable', releaseDate: '2026-06-21' }
    };
    this.defaultVersion = '1.0';
    this.requestMetrics = {
      v1: { count: 0, avgResponseTime: 0 },
      v2: { count: 0, avgResponseTime: 0 }
    };
  }

  /**
   * Negotiate API version from request
   * Priority: Accept-Version header > URL prefix > Query parameter
   * @private
   */
  _negotiateVersion(req) {
    const url = req.url || '/';

    // 1. Check Accept-Version header
    if (req.headers && req.headers['accept-version']) {
      const headerVersion = req.headers['accept-version'];
      if (this.supportedVersions[headerVersion]) {
        return headerVersion;
      }
    }

    // 2. Check URL prefix
    if (url.startsWith('/api/v1/')) {
      return '1.0';
    }
    if (url.startsWith('/api/v2/')) {
      return '2.0';
    }

    // 3. Check query parameter
    const parsedUrl = new URL(url, 'http://localhost');
    const queryVersion = parsedUrl.searchParams.get('apiVersion');
    if (queryVersion) {
      const normalizedVersion = queryVersion === '1' ? '1.0' : queryVersion === '2' ? '2.0' : null;
      if (normalizedVersion && this.supportedVersions[normalizedVersion]) {
        return normalizedVersion;
      }
    }

    // Default to v1
    return this.defaultVersion;
  }

  /**
   * Normalize request URL by removing version prefix for internal routing
   * @private
   */
  _normalizeUrl(url) {
    return url.replace(/^\/api\/v[12]/, '/api');
  }

  /**
   * GET /api/version - Version negotiation and available versions
   */
  handleVersionRequest() {
    try {
      const versions = Object.entries(this.supportedVersions).map(([version, info]) => ({
        version,
        ...info,
        metrics: this.requestMetrics[info.name]
      }));

      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          currentVersion: this.version,
          apiVersions: versions,
          defaultVersion: this.defaultVersion,
          versionNegotiation: {
            description: 'Specify API version using one of these methods (priority order)',
            methods: [
              {
                method: 'HTTP Header',
                example: 'Accept-Version: 2.0',
                priority: 1
              },
              {
                method: 'URL Prefix',
                example: '/api/v2/help',
                priority: 2
              },
              {
                method: 'Query Parameter',
                example: '/api/help?apiVersion=2',
                priority: 3
              }
            ]
          },
          endpoints: {
            v1: {
              help: '/api/v1/help',
              diagnostics: '/api/v1/diagnostics',
              status: '/api/v1/status',
              schema: '/api/v1/schema'
            },
            v2: {
              help: '/api/v2/help',
              diagnostics: '/api/v2/diagnostics',
              status: '/api/v2/status',
              schema: '/api/v2/schema'
            },
            legacy: {
              help: '/api/help (defaults to v1)',
              diagnostics: '/api/diagnostics (defaults to v1)',
              status: '/api/status (defaults to v1)',
              schema: '/api/schema (defaults to v1)'
            }
          }
        }, null, 2)
      };
    } catch (error) {
      this.logger.error(`[DiagnosticsAPI] Version request error: ${error.message}`);
      return {
        statusCode: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }, null, 2)
      };
    }
  }

  /**
   * GET /api/help - List all commands or get command details
   *
   * Supports:
   * - /api/help - Returns list of all commands grouped by category
   * - /api/help?command=<name> - Returns detailed info for specific command
   * - /api/help?error=<code> - Returns error details and recovery hints
   * - /api/help?search=<keyword> - Search commands by keyword
   * - Versioned: /api/v1/help, /api/v2/help
   */
  handleHelpRequest(url, version = '1.0') {
    try {
      const parsedUrl = new URL(url, 'http://localhost');
      const params = parsedUrl.searchParams;

      // Get specific command
      if (params.has('command')) {
        const commandName = params.get('command');
        const command = registry.getCommand(commandName);
        if (!command) {
          return {
            statusCode: 404,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Command not found',
              command: commandName,
              suggestion: 'Use /api/help to list all available commands'
            }, null, 2)
          };
        }

        return {
          statusCode: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            command: command.command,
            category: command.category,
            description: command.description,
            parameters: command.parameters,
            required: command.required,
            examples: command.examples,
            errorCodes: command.errorCodes,
            recoveryHints: command.recoveryHints
          }, null, 2)
        };
      }

      // Get error details
      if (params.has('error')) {
        const errorCode = params.get('error');
        const error = registry.getError(errorCode);
        if (!error) {
          return {
            statusCode: 404,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Error code not found',
              errorCode,
              suggestion: 'Check /api/help for valid error codes'
            }, null, 2)
          };
        }

        return {
          statusCode: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            errorCode: error.errorCode,
            description: error.description,
            recoveryHint: error.recoveryHint,
            relatedErrors: error.relatedErrors
          }, null, 2)
        };
      }

      // Search commands
      if (params.has('search')) {
        const keyword = params.get('search');
        const results = registry.searchCommands(keyword);
        return {
          statusCode: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            keyword,
            resultCount: results.length,
            results: results
          }, null, 2)
        };
      }

      // List all commands grouped by category
      const commandsByCategory = registry.getCommandsByCategory();
      const stats = registry.getRegistryStats();

      const response = {
        apiVersion: version,
        totalCommands: stats.totalCommands,
        totalCategories: stats.totalCategories,
        commands: commandsByCategory,
        helpEndpoints: {
          listCommands: `GET /api/v${version.split('.')[0]}/help`,
          getCommand: `GET /api/v${version.split('.')[0]}/help?command=<name>`,
          getError: `GET /api/v${version.split('.')[0]}/help?error=<code>`,
          searchCommands: `GET /api/v${version.split('.')[0]}/help?search=<keyword>`,
          diagnostics: `GET /api/v${version.split('.')[0]}/diagnostics`,
          status: `GET /api/v${version.split('.')[0]}/status`,
          schema: `GET /api/v${version.split('.')[0]}/schema`
        }
      };

      // V2 enhancements
      if (version === '2.0') {
        response.versionInfo = {
          version: '2.0',
          status: 'stable',
          releaseDate: '2026-06-21',
          improvements: [
            'Extended command metadata',
            'Deprecation warnings for v1 commands',
            'Performance metrics',
            'Enhanced error recovery hints'
          ]
        };
        response.deprecations = this._getDeprecatedCommands();
      }

      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify(response, null, 2)
      };
    } catch (error) {
      this.logger.error(`[DiagnosticsAPI] Help request error: ${error.message}`);
      return {
        statusCode: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }, null, 2)
      };
    }
  }

  /**
   * GET /api/diagnostics - Browser health, version, capabilities
   */
  handleDiagnosticsRequest(version = '1.0') {
    try {
      const stats = registry.getRegistryStats();
      const memUsage = process.memoryUsage();
      const uptime = Date.now() - this.startTime;

      const response = {
        apiVersion: version,
        version: this.version,
        status: 'operational',
        uptime: {
          ms: uptime,
          seconds: Math.floor(uptime / 1000),
          readable: this._formatUptime(uptime)
        },
        system: {
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          nodeVersion: process.version
        },
        memory: {
          heapUsed: this._formatBytes(memUsage.heapUsed),
          heapTotal: this._formatBytes(memUsage.heapTotal),
          heapUsedPercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%',
          external: this._formatBytes(memUsage.external),
          rss: this._formatBytes(memUsage.rss)
        },
        api: {
          totalCommands: stats.totalCommands,
          totalCategories: stats.totalCategories,
          errorCodes: stats.totalErrorCodes
        },
        features: {
          navigation: true,
          screenshots: true,
          contentExtraction: true,
          formInteraction: true,
          proxySupport: true,
          fingerprinting: true,
          forensicCapture: true,
          sessionRecording: true,
          selfDocumentation: true
        }
      };

      // V2 enhancements
      if (version === '2.0') {
        response.versionInfo = {
          version: '2.0',
          status: 'stable',
          releaseDate: '2026-06-21',
          improvements: [
            'Extended telemetry',
            'Performance recommendations',
            'Resource optimization hints'
          ]
        };
        response.telemetry = {
          requestMetrics: this.requestMetrics,
          responseTime: 'See API version endpoint for detailed metrics'
        };
        response.recommendations = this._getHealthRecommendations(memUsage, uptime);
      }

      // Add health manager data if available
      if (this.healthManager && this.healthManager.getFullHealthStatus) {
        try {
          const healthStatus = this.healthManager.getFullHealthStatus();
          response.health = healthStatus;
        } catch (e) {
          this.logger.debug(`[DiagnosticsAPI] Could not get health status: ${e.message}`);
        }
      }

      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify(response, null, 2)
      };
    } catch (error) {
      this.logger.error(`[DiagnosticsAPI] Diagnostics request error: ${error.message}`);
      return {
        statusCode: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }, null, 2)
      };
    }
  }

  /**
   * GET /api/status - Current browser status
   */
  handleStatusRequest(version = '1.0') {
    try {
      const majorVersion = version.split('.')[0];
      const response = {
        apiVersion: version,
        status: 'operational',
        version: this.version,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        endpoints: {
          websocket: 'ws://localhost:8765',
          help: `http://localhost:8765/api/v${majorVersion}/help`,
          diagnostics: `http://localhost:8765/api/v${majorVersion}/diagnostics`,
          status: `http://localhost:8765/api/v${majorVersion}/status`,
          schema: `http://localhost:8765/api/v${majorVersion}/schema`
        }
      };

      // V2 enhancements
      if (version === '2.0') {
        response.versionInfo = {
          version: '2.0',
          status: 'stable',
          releaseDate: '2026-06-21'
        };
        response.recommendations = {
          nextSteps: [
            'For extended diagnostics, use GET /api/v2/diagnostics',
            'For versioning details, use GET /api/version',
            'For schema with version info, use GET /api/v2/schema'
          ]
        };
      }

      if (this.healthManager) {
        try {
          const health = this.healthManager.getFullHealthStatus &&
                        this.healthManager.getFullHealthStatus();
          if (health) {
            response.health = health;
          }
        } catch (e) {
          // Silently ignore health check failures
        }
      }

      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify(response, null, 2)
      };
    } catch (error) {
      this.logger.error(`[DiagnosticsAPI] Status request error: ${error.message}`);
      return {
        statusCode: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }, null, 2)
      };
    }
  }

  /**
   * GET /api/schema - OpenAPI-compatible schema
   */
  handleSchemaRequest(version = '1.0') {
    try {
      const allCommands = registry.getAllCommands();
      const commandsByCategory = registry.getCommandsByCategory();

      // Build minimal OpenAPI-compatible schema
      const schema = {
        openapi: '3.0.0',
        info: {
          title: 'Basset Hound Browser WebSocket API',
          version: this.version,
          description: 'Self-documenting browser automation API',
          'x-api-version': version,
          'x-api-status': this.supportedVersions[version].status
        },
        servers: [
          {
            url: 'ws://localhost:8765',
            description: 'WebSocket server',
            'x-api-version': version
          }
        ],
        paths: {}
      };

      // Add endpoints for each command
      allCommands.forEach(cmd => {
        const path = `/ws/${cmd.command}`;
        schema.paths[path] = {
          post: {
            summary: cmd.description,
            tags: [cmd.category],
            'x-api-version': version,
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: registry.getCommand(cmd.command).parameters
                  }
                }
              }
            },
            responses: {
              200: {
                description: 'Command executed successfully'
              },
              400: {
                description: 'Invalid parameters'
              },
              500: {
                description: 'Internal server error'
              }
            }
          }
        };
      });

      // V2 enhancements
      if (version === '2.0') {
        schema['x-version-info'] = {
          apiVersion: '2.0',
          status: 'stable',
          releaseDate: '2026-06-21',
          improvements: [
            'Extended command metadata',
            'Deprecation information',
            'Performance metrics',
            'Enhanced error descriptions'
          ]
        };
        schema['x-deprecated-commands'] = this._getDeprecatedCommands();
      }

      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify(schema, null, 2)
      };
    } catch (error) {
      this.logger.error(`[DiagnosticsAPI] Schema request error: ${error.message}`);
      return {
        statusCode: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }, null, 2)
      };
    }
  }

  /**
   * Create HTTP handler function for use with http.createServer
   * @returns {Function} Handler for HTTP requests
   */
  createHttpHandler() {
    return async (req, res) => {
      try {
        const url = req.url || '/';
        const startTime = Date.now();

        // Negotiate API version
        const version = this._negotiateVersion(req);
        const majorVersion = version.split('.')[0];

        // Normalize URL for routing
        const normalizedUrl = this._normalizeUrl(url);

        let result;

        if (normalizedUrl.startsWith('/api/help')) {
          result = this.handleHelpRequest(`http://localhost${normalizedUrl}`, version);
        } else if (normalizedUrl.startsWith('/api/diagnostics')) {
          result = this.handleDiagnosticsRequest(version);
        } else if (normalizedUrl.startsWith('/api/status')) {
          result = this.handleStatusRequest(version);
        } else if (normalizedUrl.startsWith('/api/schema')) {
          result = this.handleSchemaRequest(version);
        } else if (url === '/api/version') {
          result = this.handleVersionRequest();
        } else {
          result = {
            statusCode: 404,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Not found',
              availableEndpoints: {
                version: 'GET /api/version',
                v1: {
                  help: 'GET /api/v1/help',
                  diagnostics: 'GET /api/v1/diagnostics',
                  status: 'GET /api/v1/status',
                  schema: 'GET /api/v1/schema'
                },
                v2: {
                  help: 'GET /api/v2/help',
                  diagnostics: 'GET /api/v2/diagnostics',
                  status: 'GET /api/v2/status',
                  schema: 'GET /api/v2/schema'
                },
                legacy: {
                  help: 'GET /api/help (defaults to v1)',
                  diagnostics: 'GET /api/diagnostics (defaults to v1)',
                  status: 'GET /api/status (defaults to v1)',
                  schema: 'GET /api/schema (defaults to v1)'
                }
              }
            }, null, 2)
          };
        }

        // Update metrics
        const responseTime = Date.now() - startTime;
        const versionKey = majorVersion === '1' ? 'v1' : 'v2';
        this.requestMetrics[versionKey].count++;
        this.requestMetrics[versionKey].avgResponseTime =
          (this.requestMetrics[versionKey].avgResponseTime * (this.requestMetrics[versionKey].count - 1) + responseTime) /
          this.requestMetrics[versionKey].count;

        res.writeHead(result.statusCode, {
          'Content-Type': result.contentType || 'application/json',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
          'X-API-Version': version,
          'X-Response-Time-Ms': responseTime.toString()
        });
        res.end(result.body);
      } catch (error) {
        this.logger.error(`[DiagnosticsAPI] HTTP handler error: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }, null, 2));
      }
    };
  }

  /**
   * Format bytes to human-readable format
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format uptime to human-readable format
   * @private
   */
  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get deprecated commands (for V2 API)
   * @private
   */
  _getDeprecatedCommands() {
    return [
      {
        command: 'getScreenshot',
        reason: 'Replaced with more powerful captureElement command',
        alternative: 'captureElement',
        deprecatedSince: '2026-05-01',
        removedIn: '2027-01-01'
      },
      {
        command: 'basicNavigate',
        reason: 'Use navigate command with enhanced options',
        alternative: 'navigate',
        deprecatedSince: '2026-05-01',
        removedIn: '2027-01-01'
      }
    ];
  }

  /**
   * Get health recommendations (for V2 API)
   * @private
   */
  _getHealthRecommendations(memUsage, uptime) {
    const recommendations = [];
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (heapUsagePercent > 80) {
      recommendations.push({
        severity: 'warning',
        recommendation: 'High memory usage detected',
        action: 'Consider increasing heap size or clearing cache',
        metric: `${heapUsagePercent.toFixed(2)}% heap used`
      });
    }

    if (uptime > 7 * 24 * 60 * 60 * 1000) { // 7 days
      recommendations.push({
        severity: 'info',
        recommendation: 'Long uptime detected',
        action: 'Consider restarting the browser for optimal performance',
        metric: `Uptime: ${(uptime / (24 * 60 * 60 * 1000)).toFixed(1)} days`
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        severity: 'success',
        recommendation: 'System is operating optimally',
        metric: `Memory usage: ${heapUsagePercent.toFixed(2)}%`
      });
    }

    return recommendations;
  }
}

module.exports = {
  DiagnosticsAPI
};
