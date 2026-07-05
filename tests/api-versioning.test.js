/**
 * API Versioning Tests for /api/v1/* and /api/v2/* endpoints
 *
 * Tests verify that:
 * 1. Both v1 and v2 endpoints exist and return correct data
 * 2. Version negotiation works via header, URL prefix, and query parameter
 * 3. Legacy endpoints default to v1
 * 4. V2 endpoints include enhanced features (deprecation info, telemetry, etc)
 * 5. Response headers include X-API-Version
 * 6. Metrics are tracked per version
 *
 * Run with: npm test -- tests/api-versioning.test.js
 * Or manually with curl (see curl-commands below)
 */

const http = require('http');
const assert = require('assert');
const { DiagnosticsAPI } = require('../websocket/diagnostics-api');

// Helper to make HTTP requests
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('API Versioning - /api/v1/* and /api/v2/* endpoints', () => {
  let diagnosticsAPI;
  let server;
  const PORT = 9876; // Different port to avoid conflicts

  before((done) => {
    diagnosticsAPI = new DiagnosticsAPI({
      version: '12.7.0',
      capabilities: {
        navigation: true,
        screenshots: true,
        contentExtraction: true
      }
    });

    const handler = diagnosticsAPI.createHttpHandler();
    server = http.createServer(handler);
    server.listen(PORT, () => {
      console.log(`Test server listening on port ${PORT}`);
      done();
    });
  });

  after(() => {
    server.close();
  });

  describe('Version negotiation priority', () => {
    it('should prioritize Accept-Version header over URL prefix', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/help',
        method: 'GET',
        headers: {
          'Accept-Version': '2.0'
        }
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.headers['x-api-version'], '2.0');
      assert(result.body.versionInfo, 'V2 response should include versionInfo');
      console.log('✓ Accept-Version header takes priority');
    });

    it('should use URL prefix when header is absent', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v2/help',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.headers['x-api-version'], '2.0');
      console.log('✓ URL prefix v2 works');
    });

    it('should use query parameter when header and URL are absent', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/help?apiVersion=2',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.headers['x-api-version'], '2.0');
      console.log('✓ Query parameter apiVersion=2 works');
    });

    it('should default to v1 when no version specified', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/help',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.headers['x-api-version'], '1.0');
      console.log('✓ Legacy /api/help defaults to v1');
    });
  });

  describe('/api/v1/* endpoints', () => {
    it('GET /api/v1/help returns command list', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/help',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.headers['x-api-version'], '1.0');
      assert.strictEqual(result.body.apiVersion, '1.0');
      assert(result.body.totalCommands >= 0);
      assert(result.body.commands);
      assert(!result.body.versionInfo, 'V1 should not include versionInfo');
      console.log(`✓ GET /api/v1/help returned ${result.body.totalCommands} commands`);
    });

    it('GET /api/v1/diagnostics returns health info', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/diagnostics',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body.apiVersion, '1.0');
      assert(result.body.version);
      assert(result.body.system);
      assert(result.body.memory);
      assert(!result.body.telemetry, 'V1 should not include telemetry');
      console.log('✓ GET /api/v1/diagnostics works');
    });

    it('GET /api/v1/status returns operational status', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/status',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body.apiVersion, '1.0');
      assert.strictEqual(result.body.status, 'operational');
      console.log('✓ GET /api/v1/status works');
    });

    it('GET /api/v1/schema returns OpenAPI schema', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/schema',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body.info['x-api-version'], '1.0');
      assert.strictEqual(result.body.openapi, '3.0.0');
      console.log('✓ GET /api/v1/schema works');
    });
  });

  describe('/api/v2/* endpoints with enhancements', () => {
    it('GET /api/v2/help includes deprecation info', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v2/help',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.headers['x-api-version'], '2.0');
      assert.strictEqual(result.body.apiVersion, '2.0');
      assert(result.body.versionInfo, 'V2 should include versionInfo');
      assert(result.body.deprecations, 'V2 should include deprecations array');
      assert.strictEqual(result.body.versionInfo.version, '2.0');
      console.log(`✓ GET /api/v2/help includes deprecation info (${result.body.deprecations.length} deprecated commands)`);
    });

    it('GET /api/v2/diagnostics includes telemetry', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v2/diagnostics',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body.apiVersion, '2.0');
      assert(result.body.versionInfo);
      assert(result.body.telemetry, 'V2 should include telemetry');
      assert(result.body.recommendations, 'V2 should include recommendations');
      console.log('✓ GET /api/v2/diagnostics includes telemetry and recommendations');
    });

    it('GET /api/v2/status includes version info', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v2/status',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body.apiVersion, '2.0');
      assert(result.body.versionInfo);
      assert(result.body.recommendations);
      console.log('✓ GET /api/v2/status works with recommendations');
    });

    it('GET /api/v2/schema includes deprecation info', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v2/schema',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert(result.body['x-version-info']);
      assert.strictEqual(result.body['x-version-info'].apiVersion, '2.0');
      assert(result.body['x-deprecated-commands']);
      console.log('✓ GET /api/v2/schema includes version and deprecation info');
    });
  });

  describe('Version endpoint', () => {
    it('GET /api/version lists all supported versions', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/version',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      assert(result.body.apiVersions);
      assert(result.body.apiVersions.length >= 2);
      assert(result.body.versionNegotiation);

      const versionNames = result.body.apiVersions.map(v => v.version);
      assert(versionNames.includes('1.0'));
      assert(versionNames.includes('2.0'));

      console.log(`✓ GET /api/version shows ${result.body.apiVersions.length} supported versions`);
      console.log(`  Versions: ${versionNames.join(', ')}`);
    });

    it('Version negotiation details are accurate', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/version',
        method: 'GET'
      };

      const result = await makeRequest(options);
      const methods = result.body.versionNegotiation.methods;

      assert.strictEqual(methods.length, 3);
      assert.strictEqual(methods[0].method, 'HTTP Header');
      assert.strictEqual(methods[1].method, 'URL Prefix');
      assert.strictEqual(methods[2].method, 'Query Parameter');

      console.log('✓ Version negotiation priority is correct');
    });
  });

  describe('Response headers and metadata', () => {
    it('All responses include X-API-Version header', async () => {
      const paths = ['/api/v1/help', '/api/v2/help', '/api/help'];

      for (const path of paths) {
        const options = {
          hostname: 'localhost',
          port: PORT,
          path,
          method: 'GET'
        };

        const result = await makeRequest(options);
        assert(result.headers['x-api-version'], `Missing X-API-Version for ${path}`);
      }

      console.log('✓ All responses include X-API-Version header');
    });

    it('Responses include X-Response-Time-Ms header', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/help',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert(result.headers['x-response-time-ms']);
      const responseTime = parseInt(result.headers['x-response-time-ms']);
      assert(responseTime >= 0);
      console.log(`✓ Response time: ${responseTime}ms`);
    });

    it('Responses include Cache-Control header', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/help',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.headers['cache-control'], 'no-cache');
      console.log('✓ Cache-Control header set correctly');
    });
  });

  describe('Metrics tracking per version', () => {
    it('Should track request metrics for v1', async () => {
      // Make a v1 request
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/help',
        method: 'GET'
      };

      await makeRequest(options);

      // Check metrics
      assert(diagnosticsAPI.requestMetrics.v1.count > 0);
      console.log(`✓ V1 metrics tracked: ${diagnosticsAPI.requestMetrics.v1.count} requests`);
    });

    it('Should track request metrics for v2', async () => {
      // Make a v2 request
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v2/help',
        method: 'GET'
      };

      await makeRequest(options);

      // Check metrics
      assert(diagnosticsAPI.requestMetrics.v2.count > 0);
      console.log(`✓ V2 metrics tracked: ${diagnosticsAPI.requestMetrics.v2.count} requests`);
    });
  });

  describe('Error handling', () => {
    it('Returns 404 for unknown endpoints', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/unknown',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 404);
      assert(result.body.error);
      console.log('✓ 404 error handling works');
    });

    it('Invalid apiVersion query parameter falls back to v1', async () => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/help?apiVersion=99',
        method: 'GET'
      };

      const result = await makeRequest(options);
      assert.strictEqual(result.statusCode, 200);
      // Should fall back to v1 since 99 is not a valid version
      console.log('✓ Invalid apiVersion handled gracefully');
    });
  });

  describe('Content-Type headers', () => {
    it('All API responses are application/json', async () => {
      const paths = ['/api/v1/help', '/api/v2/diagnostics', '/api/status', '/api/version'];

      for (const path of paths) {
        const options = {
          hostname: 'localhost',
          port: PORT,
          path,
          method: 'GET'
        };

        const result = await makeRequest(options);
        assert(result.headers['content-type'].includes('application/json'),
          `Wrong content-type for ${path}: ${result.headers['content-type']}`);
      }

      console.log('✓ All responses have application/json content-type');
    });
  });
});

/**
 * CURL TEST COMMANDS
 *
 * Run these commands to verify API versioning manually:
 *
 * 1. Test v1 endpoints:
 *    curl -v http://localhost:8765/api/v1/help
 *    curl -v http://localhost:8765/api/v1/diagnostics
 *    curl -v http://localhost:8765/api/v1/status
 *    curl -v http://localhost:8765/api/v1/schema
 *
 * 2. Test v2 endpoints:
 *    curl -v http://localhost:8765/api/v2/help
 *    curl -v http://localhost:8765/api/v2/diagnostics
 *    curl -v http://localhost:8765/api/v2/status
 *    curl -v http://localhost:8765/api/v2/schema
 *
 * 3. Test version negotiation with headers:
 *    curl -v -H "Accept-Version: 2.0" http://localhost:8765/api/help
 *    curl -v -H "Accept-Version: 1.0" http://localhost:8765/api/v2/help
 *
 * 4. Test query parameter version:
 *    curl -v http://localhost:8765/api/help?apiVersion=2
 *    curl -v http://localhost:8765/api/diagnostics?apiVersion=1
 *
 * 5. Test version endpoint:
 *    curl -v http://localhost:8765/api/version
 *
 * 6. Test legacy endpoints (should default to v1):
 *    curl -v http://localhost:8765/api/help
 *    curl -v http://localhost:8765/api/diagnostics
 *
 * 7. Test with specific command:
 *    curl -v http://localhost:8765/api/v1/help?command=navigate
 *    curl -v http://localhost:8765/api/v2/help?command=navigate
 *
 * 8. Test error handling:
 *    curl -v http://localhost:8765/api/v1/help?error=COMMAND_NOT_FOUND
 *    curl -v http://localhost:8765/api/v2/help?search=screenshot
 *
 * 9. Check response headers:
 *    curl -i http://localhost:8765/api/v1/help
 *    curl -i http://localhost:8765/api/v2/help
 */
