/**
 * Diagnostics API Integration Tests
 *
 * Tests for self-documenting diagnostics endpoints:
 * - GET /api/help - Command discovery
 * - GET /api/help?command=X - Command details
 * - GET /api/help?search=keyword - Search
 * - GET /api/help?error=CODE - Error guidance
 * - GET /api/health - Reliability metrics
 * - GET /api/diagnostics - Browser health
 * - GET /api/status - Operational status
 * - GET /api/schema - OpenAPI schema
 * - GET /api/openapi.yaml - YAML schema
 * - GET /api/metrics - Per-command metrics
 * - GET /api/version - Version info
 * - Version negotiation (v1/v2)
 *
 * @module tests/websocket/diagnostics-api
 */

const http = require('http');
const { DiagnosticsAPI } = require('../../websocket/diagnostics-api');
const { HelpServer } = require('../../websocket/help-server');

describe('DiagnosticsAPI - Self-Documenting Endpoints', () => {
  let server;
  let diagnosticsAPI;

  beforeAll((done) => {
    diagnosticsAPI = new DiagnosticsAPI({
      version: '12.10.0',
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      }
    });

    // Create test HTTP server
    server = http.createServer(diagnosticsAPI.createHttpHandler());
    server.listen(0, () => {
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  /**
   * Helper to make HTTP requests to test server
   */
  function makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(`http://localhost:${server.address().port}${path}`);

      const requestOptions = {
        method: options.method || 'GET',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      };

      const req = http.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: data });
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  describe('GET /api/help - Command Discovery', () => {
    it('should return list of all commands grouped by category', async () => {
      const res = await makeRequest('/api/help');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalCommands');
      expect(res.body).toHaveProperty('totalCategories');
      expect(res.body).toHaveProperty('commands');
      expect(typeof res.body.totalCommands).toBe('number');
      expect(res.body.totalCommands).toBeGreaterThan(0);
    });

    it('should include help endpoints in response', async () => {
      const res = await makeRequest('/api/help');

      expect(res.body).toHaveProperty('helpEndpoints');
      expect(res.body.helpEndpoints).toHaveProperty('listCommands');
      expect(res.body.helpEndpoints).toHaveProperty('getCommand');
      expect(res.body.helpEndpoints).toHaveProperty('diagnostics');
    });
  });

  describe('GET /api/help?command=X - Command Details', () => {
    it('should return command details for valid command', async () => {
      const res = await makeRequest('/api/help?command=navigate');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('command');
      expect(res.body).toHaveProperty('category');
      expect(res.body).toHaveProperty('description');
    });

    it('should return 404 for non-existent command', async () => {
      const res = await makeRequest('/api/help?command=nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('not found');
    });

    it('should include parameter details', async () => {
      const res = await makeRequest('/api/help?command=navigate');

      expect(res.body).toHaveProperty('parameters');
      expect(typeof res.body.parameters).toBe('object');
    });

    it('should include required fields list', async () => {
      const res = await makeRequest('/api/help?command=navigate');

      expect(res.body).toHaveProperty('required');
      expect(Array.isArray(res.body.required)).toBe(true);
    });
  });

  describe('GET /api/help?search=keyword - Search', () => {
    it('should find commands by keyword', async () => {
      const res = await makeRequest('/api/help?search=navigate');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('keyword');
      expect(res.body).toHaveProperty('resultCount');
      expect(res.body).toHaveProperty('results');
      expect(res.body.resultCount).toBeGreaterThan(0);
    });

    it('should return array of matching commands', async () => {
      const res = await makeRequest('/api/help?search=screenshot');

      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.resultCount).toBe(res.body.results.length);
    });

    it('should return empty results for no matches', async () => {
      const res = await makeRequest('/api/help?search=xyz123notfound');

      expect(res.status).toBe(200);
      expect(res.body.resultCount).toBe(0);
      expect(res.body.results).toEqual([]);
    });
  });

  describe('GET /api/health - Reliability Metrics', () => {
    it('should return health metrics structure', async () => {
      const res = await makeRequest('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('apiVersion');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('overallStatus');
    });

    it('should include SLA compliance info', async () => {
      const res = await makeRequest('/api/health');

      expect(res.body.overallStatus).toHaveProperty('totalCommands');
      expect(res.body.overallStatus).toHaveProperty('slaCompliantCommands');
      expect(res.body.overallStatus).toHaveProperty('globalSlaCompliance');
      expect(res.body.overallStatus).toHaveProperty('slaStatus');
    });

    it('should include command metrics', async () => {
      const res = await makeRequest('/api/health');

      expect(res.body).toHaveProperty('commandMetrics');
      expect(typeof res.body.commandMetrics).toBe('object');
    });

    it('should include global metrics', async () => {
      const res = await makeRequest('/api/health');

      expect(res.body).toHaveProperty('globalMetrics');
      expect(res.body.globalMetrics).toHaveProperty('uptime');
      expect(res.body.globalMetrics).toHaveProperty('totalRequests');
    });
  });

  describe('GET /api/diagnostics - Browser Health', () => {
    it('should return diagnostics structure', async () => {
      const res = await makeRequest('/api/diagnostics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('uptime');
    });

    it('should include system information', async () => {
      const res = await makeRequest('/api/diagnostics');

      expect(res.body).toHaveProperty('system');
      expect(res.body.system).toHaveProperty('platform');
      expect(res.body.system).toHaveProperty('arch');
      expect(res.body.system).toHaveProperty('cpus');
      expect(res.body.system).toHaveProperty('nodeVersion');
    });

    it('should include memory information', async () => {
      const res = await makeRequest('/api/diagnostics');

      expect(res.body).toHaveProperty('memory');
      expect(res.body.memory).toHaveProperty('heapUsed');
      expect(res.body.memory).toHaveProperty('heapTotal');
      expect(res.body.memory).toHaveProperty('heapUsedPercent');
    });

    it('should include API statistics', async () => {
      const res = await makeRequest('/api/diagnostics');

      expect(res.body).toHaveProperty('api');
      expect(res.body.api).toHaveProperty('totalCommands');
      expect(res.body.api).toHaveProperty('totalCategories');
    });

    it('should include features list', async () => {
      const res = await makeRequest('/api/diagnostics');

      expect(res.body).toHaveProperty('features');
      expect(res.body.features).toHaveProperty('navigation');
      expect(res.body.features).toHaveProperty('screenshots');
    });
  });

  describe('GET /api/status - Operational Status', () => {
    it('should return status structure', async () => {
      const res = await makeRequest('/api/status');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should include endpoints', async () => {
      const res = await makeRequest('/api/status');

      expect(res.body).toHaveProperty('endpoints');
      expect(res.body.endpoints).toHaveProperty('websocket');
      expect(res.body.endpoints).toHaveProperty('help');
    });
  });

  describe('GET /api/schema - OpenAPI Schema', () => {
    it('should return OpenAPI schema', async () => {
      const res = await makeRequest('/api/schema');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('openapi');
      expect(res.body).toHaveProperty('info');
      expect(res.body).toHaveProperty('paths');
    });

    it('should have valid OpenAPI version', async () => {
      const res = await makeRequest('/api/schema');

      expect(res.body.openapi).toBe('3.0.0');
    });

    it('should include command paths', async () => {
      const res = await makeRequest('/api/schema');

      expect(Object.keys(res.body.paths).length).toBeGreaterThan(0);
    });

    it('should have proper info metadata', async () => {
      const res = await makeRequest('/api/schema');

      expect(res.body.info).toHaveProperty('title');
      expect(res.body.info).toHaveProperty('version');
      expect(res.body.info).toHaveProperty('description');
    });
  });

  describe('GET /api/metrics - Per-Command Metrics', () => {
    it('should return metrics object', async () => {
      const res = await makeRequest('/api/metrics');

      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
    });

    it('should include command success rates', async () => {
      const res = await makeRequest('/api/metrics');

      const commands = Object.values(res.body);
      if (commands.length > 0) {
        const firstCmd = commands[0];
        expect(firstCmd).toHaveProperty('command');
        expect(firstCmd).toHaveProperty('successRate');
        expect(firstCmd).toHaveProperty('totalAttempts');
      }
    });
  });

  describe('GET /api/version - Version Negotiation', () => {
    it('should return version info', async () => {
      const res = await makeRequest('/api/version');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('currentVersion');
      expect(res.body).toHaveProperty('apiVersions');
      expect(res.body).toHaveProperty('defaultVersion');
    });

    it('should include version negotiation methods', async () => {
      const res = await makeRequest('/api/version');

      expect(res.body).toHaveProperty('versionNegotiation');
      expect(res.body.versionNegotiation).toHaveProperty('methods');
      expect(Array.isArray(res.body.versionNegotiation.methods)).toBe(true);
    });

    it('should list supported versions', async () => {
      const res = await makeRequest('/api/version');

      expect(Array.isArray(res.body.apiVersions)).toBe(true);
      expect(res.body.apiVersions.length).toBeGreaterThan(0);
    });
  });

  describe('Version Negotiation', () => {
    it('should accept v1 via URL prefix', async () => {
      const res = await makeRequest('/api/v1/help');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('apiVersion');
      expect(res.body.apiVersion).toBe('1.0');
    });

    it('should accept v2 via URL prefix', async () => {
      const res = await makeRequest('/api/v2/help');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('apiVersion');
      expect(res.body.apiVersion).toBe('2.0');
    });

    it('should accept version via Accept-Version header', async () => {
      const res = await makeRequest('/api/help', {
        headers: { 'Accept-Version': '2.0' }
      });

      expect(res.status).toBe(200);
      expect(res.body.apiVersion).toBe('2.0');
    });

    it('should accept version via query parameter', async () => {
      const res = await makeRequest('/api/help?apiVersion=2');

      expect(res.status).toBe(200);
      expect(res.body.apiVersion).toBe('2.0');
    });

    it('should prioritize header over URL', async () => {
      const res = await makeRequest('/api/v1/help', {
        headers: { 'Accept-Version': '2.0' }
      });

      expect(res.body.apiVersion).toBe('2.0');
    });
  });

  describe('V2 API Enhancements', () => {
    it('should include deprecations in v2', async () => {
      const res = await makeRequest('/api/v2/help');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('deprecations');
      expect(Array.isArray(res.body.deprecations)).toBe(true);
    });

    it('should include version info in v2 diagnostics', async () => {
      const res = await makeRequest('/api/v2/diagnostics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('versionInfo');
      expect(res.body.versionInfo.version).toBe('2.0');
    });

    it('should include telemetry in v2 diagnostics', async () => {
      const res = await makeRequest('/api/v2/diagnostics');

      expect(res.body).toHaveProperty('telemetry');
      expect(res.body).toHaveProperty('recommendations');
    });

    it('should include recommendations in v2 diagnostics', async () => {
      const res = await makeRequest('/api/v2/diagnostics');

      expect(Array.isArray(res.body.recommendations)).toBe(true);
    });
  });

  describe('HTTP Headers & Caching', () => {
    it('should set Content-Type header', async () => {
      const res = await makeRequest('/api/help');

      expect(res.headers['content-type']).toContain('application/json');
    });

    it('should include API version header', async () => {
      const res = await makeRequest('/api/help');

      expect(res.headers['x-api-version']).toBeDefined();
    });

    it('should include response time header', async () => {
      const res = await makeRequest('/api/help');

      expect(res.headers['x-response-time-ms']).toBeDefined();
    });

    it('should set CORS headers', async () => {
      const res = await makeRequest('/api/help');

      expect(res.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for invalid endpoint', async () => {
      const res = await makeRequest('/api/invalid');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 with available endpoints', async () => {
      const res = await makeRequest('/api/invalid');

      expect(res.body).toHaveProperty('availableEndpoints');
    });

    it('should handle missing query parameters gracefully', async () => {
      const res = await makeRequest('/api/help?unknown=value');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalCommands');
    });
  });

  describe('Root Endpoint', () => {
    it('should return API root information', async () => {
      const res = await makeRequest('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('quickStart');
    });

    it('should include endpoint list', async () => {
      const res = await makeRequest('/');

      expect(res.body).toHaveProperty('endpoints');
      expect(res.body.endpoints).toHaveProperty('help');
      expect(res.body.endpoints).toHaveProperty('diagnostics');
    });
  });
});

describe('HelpServer - Modular Help Handler', () => {
  let helpServer;

  beforeAll(() => {
    helpServer = new HelpServer({
      version: '12.10.0',
      logger: console
    });
  });

  describe('OpenAPI Schema Generation', () => {
    it('should generate valid OpenAPI schema', () => {
      const schema = helpServer._generateOpenApiSchema();

      expect(schema).toHaveProperty('openapi');
      expect(schema.openapi).toBe('3.0.0');
    });

    it('should cache OpenAPI schema', () => {
      const schema1 = helpServer._generateOpenApiSchema();
      const schema2 = helpServer._generateOpenApiSchema();

      expect(schema1).toBe(schema2); // Same reference (cached)
    });

    it('should generate YAML from schema', () => {
      const yaml = helpServer._generateOpenApiYaml();

      expect(typeof yaml).toBe('string');
      expect(yaml.length).toBeGreaterThan(0);
    });

    it('should handle JSON to YAML conversion', () => {
      const testObj = {
        name: 'test',
        values: [1, 2, 3],
        nested: { key: 'value' }
      };

      const yaml = helpServer._jsonToYaml(testObj);

      expect(yaml).toContain('name:');
      expect(yaml).toContain('test');
    });
  });

  describe('Format Utilities', () => {
    it('should format bytes correctly', () => {
      const bytes = helpServer._formatBytes(1024);

      expect(bytes).toContain('KB');
    });

    it('should handle zero bytes', () => {
      const result = helpServer._formatBytes(0);

      expect(result).toBe('0 B');
    });

    it('should format uptime correctly', () => {
      const uptime = helpServer._formatUptime(3661000); // 1h 1m 1s

      expect(uptime).toContain('h');
      expect(uptime).toContain('m');
      expect(uptime).toContain('s');
    });
  });

  describe('Command Metrics Aggregation', () => {
    it('should aggregate command metrics', () => {
      const metrics = helpServer._getCommandMetrics();

      expect(typeof metrics).toBe('object');
      // Metrics structure may vary based on registry state
    });
  });
});

describe('Integration Tests', () => {
  describe('Multi-Endpoint Consistency', () => {
    let server;
    let diagnosticsAPI;
    let baseUrl;

    beforeAll((done) => {
      diagnosticsAPI = new DiagnosticsAPI({
        version: '12.10.0',
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn()
        }
      });

      server = http.createServer(diagnosticsAPI.createHttpHandler());
      server.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}`;
        done();
      });
    });

    afterAll((done) => {
      if (server) {
        server.close(done);
      } else {
        done();
      }
    });

    function makeRequest(path) {
      return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const req = http.request(url, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve(data);
            }
          });
        });
        req.on('error', reject);
        req.end();
      });
    }

    it('should have consistent command count across endpoints', async () => {
      const help = await makeRequest('/api/help');
      const schema = await makeRequest('/api/schema');
      const diagnostics = await makeRequest('/api/diagnostics');

      expect(help.totalCommands).toBe(schema.info['x-total-commands']);
      expect(help.totalCommands).toBe(diagnostics.api.totalCommands);
    });

    it('should have consistent category count', async () => {
      const help = await makeRequest('/api/help');
      const diagnostics = await makeRequest('/api/diagnostics');

      expect(help.totalCategories).toBe(diagnostics.api.totalCategories);
    });
  });
});
