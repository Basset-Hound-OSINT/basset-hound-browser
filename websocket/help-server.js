/**
 * Self-Documenting Help Server Module
 *
 * Provides comprehensive, self-documenting HTTP endpoints for discovering
 * and understanding the Basset Hound Browser WebSocket API without needing
 * external documentation files.
 *
 * Endpoints Provided:
 * - GET /api/help - List all commands grouped by category
 * - GET /api/help?command=<name> - Get detailed command documentation
 * - GET /api/help?error=<code> - Get error details and recovery guidance
 * - GET /api/help?search=<keyword> - Search commands by keyword
 * - GET /api/health - Per-command reliability metrics and SLA status
 * - GET /api/diagnostics - Browser health, version, capabilities
 * - GET /api/status - Current operational status and endpoints
 * - GET /api/schema - OpenAPI 3.0 schema for integration
 * - GET /api/version - Version negotiation and available versions
 * - GET /api/openapi.yaml - OpenAPI YAML schema (generated)
 * - GET /api/metrics - Per-command reliability metrics
 *
 * Key Features:
 * - API versioning (v1, v2) with automatic negotiation
 * - Per-command reliability metrics (success %, latency, attempts)
 * - Self-documenting (no external files needed for API discovery)
 * - Error recovery guidance with related errors
 * - Full parameter validation and schema information
 * - OpenAPI 3.0 compatible schema generation
 * - Health metrics and SLA tracking
 *
 * Usage:
 * curl http://localhost:8765/api/help
 * curl http://localhost:8765/api/help?command=navigate
 * curl http://localhost:8765/api/health
 * curl http://localhost:8765/api/diagnostics
 *
 * @module websocket/help-server
 */

const fs = require('fs');
const path = require('path');
const registry = require('./command-registry');

class HelpServer {
  constructor(options = {}) {
    this.version = options.version || '12.10.0';
    this.startTime = Date.now();
    this.reliabilityManager = options.reliabilityManager || null;
    this.healthManager = options.healthManager || null;
    this.logger = options.logger || console;

    // OpenAPI schema cache
    this.openApiCache = null;
    this.openApiYamlCache = null;
    this.lastSchemaGeneration = null;
    this.schemaCacheTTL = options.schemaCacheTTL || 300000; // 5 minutes
  }

  /**
   * Generate comprehensive OpenAPI 3.0 schema
   * @private
   */
  _generateOpenApiSchema() {
    try {
      const allCommands = registry.getAllCommands();
      const commandsByCategory = registry.getCommandsByCategory();
      const now = new Date().toISOString();

      // Check cache first
      if (this.openApiCache && this.lastSchemaGeneration &&
          (Date.now() - this.lastSchemaGeneration) < this.schemaCacheTTL) {
        return this.openApiCache;
      }

      const schema = {
        openapi: '3.0.0',
        info: {
          title: 'Basset Hound Browser WebSocket API',
          version: this.version,
          description: 'Self-documenting browser automation and forensic capture API',
          contact: {
            name: 'API Support',
            url: 'http://localhost:8765/api/help'
          },
          license: {
            name: 'Proprietary',
            url: 'https://example.com/license'
          },
          'x-api-status': 'production',
          'x-self-documenting': true,
          'x-schema-generated': now,
          'x-total-commands': allCommands.length
        },
        servers: [
          {
            url: 'ws://localhost:8765',
            description: 'WebSocket server (non-SSL)',
            'x-protocol': 'WebSocket'
          },
          {
            url: 'wss://localhost:8765',
            description: 'WebSocket server (SSL/TLS)',
            'x-protocol': 'WebSocket Secure'
          }
        ],
        tags: Array.from(new Set(allCommands.map(c => c.category)))
          .map(category => ({
            name: category,
            description: `Commands in the ${category} category`,
            'x-command-count': allCommands.filter(c => c.category === category).length
          })),
        paths: {},
        components: {
          schemas: {
            CommandRequest: {
              type: 'object',
              description: 'WebSocket command request envelope',
              required: ['command', 'data'],
              properties: {
                command: {
                  type: 'string',
                  description: 'Command name (e.g., "navigate", "click", "screenshot")'
                },
                data: {
                  type: 'object',
                  description: 'Command-specific parameters'
                },
                sessionId: {
                  type: 'string',
                  description: 'Optional session ID for session management'
                }
              }
            },
            CommandResponse: {
              type: 'object',
              description: 'WebSocket command response envelope',
              required: ['success', 'data'],
              properties: {
                success: {
                  type: 'boolean',
                  description: 'Whether the command succeeded'
                },
                data: {
                  type: 'object',
                  description: 'Response data'
                },
                error: {
                  type: 'object',
                  description: 'Error details if unsuccessful',
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                    recoveryHint: { type: 'string' }
                  }
                },
                metadata: {
                  type: 'object',
                  description: 'Response metadata',
                  properties: {
                    latency: { type: 'number', description: 'Response time in ms' },
                    timestamp: { type: 'string' },
                    sessionId: { type: 'string' }
                  }
                }
              }
            },
            Error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code (e.g., TIMEOUT, ELEMENT_NOT_FOUND)'
                },
                message: {
                  type: 'string',
                  description: 'Human-readable error message'
                },
                recoveryHint: {
                  type: 'string',
                  description: 'Suggested recovery action'
                },
                details: {
                  type: 'object',
                  description: 'Additional error context'
                }
              }
            }
          }
        }
      };

      // Add paths for each command
      allCommands.forEach(cmd => {
        const pathKey = `/ws/${cmd.command}`;
        const cmdRegistry = registry.getCommand(cmd.command);

        schema.paths[pathKey] = {
          post: {
            summary: cmd.description,
            description: cmdRegistry.description || cmd.description,
            operationId: cmd.command,
            tags: [cmd.category],
            'x-category': cmd.category,
            'x-command-name': cmd.command,
            requestBody: {
              required: true,
              description: 'Command parameters',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: cmdRegistry.parameters || {},
                    required: cmdRegistry.required || []
                  }
                }
              }
            },
            responses: {
              200: {
                description: 'Command executed successfully',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/CommandResponse'
                    }
                  }
                }
              },
              400: {
                description: 'Invalid parameters',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' }
                  }
                }
              },
              408: {
                description: 'Command timeout',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' }
                  }
                }
              },
              500: {
                description: 'Internal server error',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' }
                  }
                }
              }
            }
          }
        };
      });

      this.openApiCache = schema;
      this.lastSchemaGeneration = Date.now();
      return schema;
    } catch (error) {
      this.logger.error(`[HelpServer] Error generating OpenAPI schema: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert JSON schema to YAML format
   * @private
   */
  _jsonToYaml(obj, indent = 0) {
    const indentStr = ' '.repeat(indent);
    let yaml = '';

    if (typeof obj === 'string') {
      // Escape special YAML characters
      if (obj.includes(':') || obj.includes('#') || obj.includes('\n')) {
        yaml += `'${obj.replace(/'/g, "''")}'`;
      } else {
        yaml += obj;
      }
    } else if (typeof obj === 'number' || typeof obj === 'boolean') {
      yaml += obj.toString();
    } else if (Array.isArray(obj)) {
      if (obj.length === 0) {
        yaml += '[]';
      } else {
        yaml += '\n';
        obj.forEach((item, idx) => {
          yaml += indentStr + '- ';
          const itemYaml = this._jsonToYaml(item, 0);
          if (itemYaml.startsWith('\n')) {
            yaml += itemYaml.substring(1);
          } else {
            yaml += itemYaml;
          }
          if (idx < obj.length - 1) yaml += '\n';
        });
      }
    } else if (typeof obj === 'object' && obj !== null) {
      yaml += '\n';
      const keys = Object.keys(obj);
      keys.forEach((key, idx) => {
        yaml += `${indentStr}${key}: `;
        const valYaml = this._jsonToYaml(obj[key], indent + 2);
        if (valYaml.startsWith('\n')) {
          yaml += valYaml;
        } else {
          yaml += valYaml;
        }
        if (idx < keys.length - 1) yaml += '\n';
      });
    } else {
      yaml += 'null';
    }

    return yaml;
  }

  /**
   * Generate OpenAPI YAML schema
   * @private
   */
  _generateOpenApiYaml() {
    try {
      if (this.openApiYamlCache && this.lastSchemaGeneration &&
          (Date.now() - this.lastSchemaGeneration) < this.schemaCacheTTL) {
        return this.openApiYamlCache;
      }

      const jsonSchema = this._generateOpenApiSchema();
      const yaml = this._jsonToYaml(jsonSchema);
      this.openApiYamlCache = yaml;
      return yaml;
    } catch (error) {
      this.logger.error(`[HelpServer] Error generating OpenAPI YAML: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate per-command reliability metrics
   * @private
   */
  _getCommandMetrics() {
    const metrics = {};

    if (this.reliabilityManager) {
      const allMetrics = this.reliabilityManager.getMetrics();
      Object.entries(allMetrics).forEach(([cmd, data]) => {
        metrics[cmd] = {
          command: cmd,
          successRate: `${(data.successRate || 0).toFixed(2)}%`,
          totalAttempts: data.totalAttempts || 0,
          successCount: data.successCount || 0,
          failureCount: data.failureCount || 0,
          averageLatency: `${(data.averageLatency || 0).toFixed(2)}ms`,
          p50Latency: `${(data.p50Latency || 0).toFixed(2)}ms`,
          p95Latency: `${(data.p95Latency || 0).toFixed(2)}ms`,
          p99Latency: `${(data.p99Latency || 0).toFixed(2)}ms`,
          slaCompliant: (data.successRate || 0) >= 95,
          lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toISOString() : null
        };
      });
    }

    return metrics;
  }

  /**
   * Handle GET /api/health - Per-command reliability metrics
   */
  handleHealthRequest() {
    try {
      const stats = registry.getRegistryStats();
      const metrics = this._getCommandMetrics();
      const commandMetrics = Object.values(metrics);

      // Calculate global SLA compliance
      const totalCommands = commandMetrics.length;
      const slaCompliantCommands = commandMetrics.filter(m => m.slaCompliant).length;
      const globalSlaCompliance = totalCommands > 0
        ? (slaCompliantCommands / totalCommands * 100).toFixed(2)
        : '0.00';

      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          apiVersion: '1.0',
          timestamp: new Date().toISOString(),
          overallStatus: {
            totalCommands: totalCommands,
            slaCompliantCommands: slaCompliantCommands,
            globalSlaCompliance: `${globalSlaCompliance}%`,
            slaTarget: '95%',
            slaStatus: parseFloat(globalSlaCompliance) >= 95 ? 'healthy' : 'degraded'
          },
          commandMetrics: metrics,
          globalMetrics: {
            uptime: Date.now() - this.startTime,
            totalRequests: stats.totalRequests || 0,
            totalCommands: stats.totalCommands || 0,
            averageSuccessRate: this._calculateAverageSuccessRate(commandMetrics)
          }
        }, null, 2)
      };
    } catch (error) {
      this.logger.error(`[HelpServer] Health request error: ${error.message}`);
      return {
        statusCode: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: error.message }, null, 2)
      };
    }
  }

  /**
   * Calculate average success rate across all commands
   * @private
   */
  _calculateAverageSuccessRate(metrics) {
    if (metrics.length === 0) return '0.00%';
    const sum = metrics.reduce((acc, m) => {
      const rate = parseFloat(m.successRate);
      return acc + (isNaN(rate) ? 0 : rate);
    }, 0);
    return `${(sum / metrics.length).toFixed(2)}%`;
  }

  /**
   * Handle request routing and version negotiation
   */
  handleRequest(req, res) {
    try {
      const url = req.url || '/';
      const method = req.method || 'GET';

      // Only handle GET requests
      if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }, null, 2));
        return;
      }

      // Route to appropriate handler
      if (url.startsWith('/api/openapi.yaml')) {
        this._handleOpenApiYaml(res);
      } else if (url.startsWith('/api/openapi') || url.startsWith('/api/schema')) {
        this._handleOpenApiJson(res);
      } else if (url.startsWith('/api/health')) {
        this._handleHealth(res);
      } else if (url.startsWith('/api/help')) {
        this._handleHelp(url, res);
      } else if (url.startsWith('/api/diagnostics')) {
        this._handleDiagnostics(res);
      } else if (url.startsWith('/api/metrics')) {
        this._handleMetrics(res);
      } else if (url === '/api/version') {
        this._handleVersion(res);
      } else if (url === '/') {
        this._handleRoot(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Not found',
          availableEndpoints: {
            help: 'GET /api/help',
            health: 'GET /api/health',
            diagnostics: 'GET /api/diagnostics',
            metrics: 'GET /api/metrics',
            schema: 'GET /api/schema',
            openapi: 'GET /api/openapi or GET /api/openapi.yaml',
            version: 'GET /api/version',
            root: 'GET /'
          }
        }, null, 2));
      }
    } catch (error) {
      this.logger.error(`[HelpServer] Request handling error: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }, null, 2));
    }
  }

  /**
   * Handle GET /api/openapi.yaml
   * @private
   */
  _handleOpenApiYaml(res) {
    try {
      const yaml = this._generateOpenApiYaml();
      res.writeHead(200, {
        'Content-Type': 'application/x-yaml',
        'Cache-Control': 'public, max-age=300'
      });
      res.end(yaml);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }, null, 2));
    }
  }

  /**
   * Handle GET /api/openapi or /api/schema
   * @private
   */
  _handleOpenApiJson(res) {
    try {
      const schema = this._generateOpenApiSchema();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      });
      res.end(JSON.stringify(schema, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }, null, 2));
    }
  }

  /**
   * Handle GET /api/health
   * @private
   */
  _handleHealth(res) {
    try {
      const result = this.handleHealthRequest();
      res.writeHead(result.statusCode, { 'Content-Type': result.contentType });
      res.end(result.body);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }, null, 2));
    }
  }

  /**
   * Handle GET /api/help
   * @private
   */
  _handleHelp(url, res) {
    try {
      const parsedUrl = new URL(url, 'http://localhost');
      const command = parsedUrl.searchParams.get('command');
      const search = parsedUrl.searchParams.get('search');
      const error = parsedUrl.searchParams.get('error');

      let result;

      if (command) {
        const cmd = registry.getCommand(command);
        if (!cmd) {
          result = {
            statusCode: 404,
            body: JSON.stringify({ error: 'Command not found', command }, null, 2)
          };
        } else {
          result = {
            statusCode: 200,
            body: JSON.stringify(cmd, null, 2)
          };
        }
      } else if (search) {
        const results = registry.searchCommands(search);
        result = {
          statusCode: 200,
          body: JSON.stringify({ keyword: search, resultCount: results.length, results }, null, 2)
        };
      } else if (error) {
        const errorInfo = registry.getError(error);
        if (!errorInfo) {
          result = {
            statusCode: 404,
            body: JSON.stringify({ error: 'Error code not found', errorCode: error }, null, 2)
          };
        } else {
          result = {
            statusCode: 200,
            body: JSON.stringify(errorInfo, null, 2)
          };
        }
      } else {
        const commands = registry.getCommandsByCategory();
        const stats = registry.getRegistryStats();
        result = {
          statusCode: 200,
          body: JSON.stringify({
            totalCommands: stats.totalCommands,
            totalCategories: stats.totalCategories,
            commands
          }, null, 2)
        };
      }

      res.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
      res.end(result.body);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }, null, 2));
    }
  }

  /**
   * Handle GET /api/diagnostics
   * @private
   */
  _handleDiagnostics(res) {
    try {
      const os = require('os');
      const memUsage = process.memoryUsage();
      const stats = registry.getRegistryStats();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        version: this.version,
        timestamp: new Date().toISOString(),
        uptime: {
          ms: Date.now() - this.startTime,
          readable: this._formatUptime(Date.now() - this.startTime)
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
          heapUsedPercent: `${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)}%`,
          rss: this._formatBytes(memUsage.rss)
        },
        api: {
          totalCommands: stats.totalCommands,
          totalCategories: stats.totalCategories,
          errorCodes: stats.totalErrorCodes
        }
      }, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }, null, 2));
    }
  }

  /**
   * Handle GET /api/metrics
   * @private
   */
  _handleMetrics(res) {
    try {
      const metrics = this._getCommandMetrics();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(metrics, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }, null, 2));
    }
  }

  /**
   * Handle GET /api/version
   * @private
   */
  _handleVersion(res) {
    try {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        version: this.version,
        timestamp: new Date().toISOString(),
        supportedVersions: ['1.0', '2.0'],
        defaultVersion: '1.0'
      }, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }, null, 2));
    }
  }

  /**
   * Handle GET / (root)
   * @private
   */
  _handleRoot(res) {
    try {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: 'Basset Hound Browser Self-Documenting API',
        version: this.version,
        description: 'Query the browser for API documentation without external files',
        quickStart: {
          discoverCommands: 'GET /api/help',
          getCommandHelp: 'GET /api/help?command=navigate',
          searchCommands: 'GET /api/help?search=screenshot',
          checkHealth: 'GET /api/health',
          getBrowserDiagnostics: 'GET /api/diagnostics',
          getOpenApiSchema: 'GET /api/openapi',
          getOpenApiYaml: 'GET /api/openapi.yaml'
        },
        endpoints: {
          help: 'GET /api/help',
          health: 'GET /api/health',
          diagnostics: 'GET /api/diagnostics',
          metrics: 'GET /api/metrics',
          schema: 'GET /api/schema',
          openapi: 'GET /api/openapi',
          openapiYaml: 'GET /api/openapi.yaml',
          version: 'GET /api/version'
        }
      }, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }, null, 2));
    }
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
}

module.exports = {
  HelpServer
};
