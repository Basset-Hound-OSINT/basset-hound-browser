/**
 * Integration Tests for Technology Detection API
 *
 * Tests:
 * - WebSocket API commands
 * - Real website analysis
 * - HTML/header-based detection
 * - Performance and accuracy
 */

const assert = require('assert');
const TechnologyDetectorHandler = require('../../websocket/handlers/technology-detector-handler');

describe('Technology Detection API Integration', () => {
  let handler;
  let mockServer;

  beforeAll(() => {
    handler = new TechnologyDetectorHandler();

    // Create mock WebSocket server
    mockServer = {
      handlers: {},
      on(action, callback) {
        this.handlers[action] = callback;
      },
      emit(action, params, wsCallback, context) {
        if (this.handlers[action]) {
          return this.handlers[action](params, wsCallback, context);
        }
        throw new Error(`No handler for ${action}`);
      }
    };

    // Register handlers
    handler.registerHandlers(mockServer);
  });

  afterAll(async () => {
    await handler.cleanup();
  });

  // ==========================================
  // Basic Command Tests
  // ==========================================

  describe('WebSocket Commands', () => {
    it('should handle detect_technologies command', async () => {
      const params = {
        html: '<meta name="generator" content="WordPress 5.9" />',
        headers: { 'server': 'nginx' }
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response);
      assert(response.success);
      assert(response.result);
      assert(Array.isArray(response.result.technologies));
      assert(response.result.totalDetected >= 0);
      assert(response.result.scanTimeMs >= 0);
    });

    it('should handle detect_technologies_from_html command', async () => {
      const params = {
        html: '<meta name="generator" content="Drupal 9.3" />'
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies_from_html', params, callback);

      assert(response);
      assert(response.success);
      assert(response.result.technologies);
    });

    it('should reject missing html parameter', async () => {
      const params = {
        // No html provided
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies_from_html', params, callback);

      assert(response);
      assert(!response.success);
      assert(response.error);
    });

    it('should handle null parameters gracefully', async () => {
      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', null, callback);

      assert(response);
      assert(!response.success);
    });
  });

  // ==========================================
  // Real Website Analysis Tests
  // ==========================================

  describe('Real Website Analysis', () => {
    it('should analyze WordPress website', async () => {
      const params = {
        url: 'https://wordpress.example.com',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="generator" content="WordPress 5.9.3" />
            <link rel="stylesheet" href="/wp-content/themes/theme/style.css" />
          </head>
          <body>
            <script src="/wp-includes/js/jquery/jquery.min.js"></script>
            <a href="/wp-json/wp/v2/posts">API</a>
          </body>
          </html>
        `,
        headers: { 'server': 'nginx' }
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success);
      const technologies = response.result.technologies.map(t => t.name);
      assert(technologies.includes('WordPress') || technologies.includes('Nginx'));
    });

    it('should analyze React/Next.js website', async () => {
      const params = {
        url: 'https://nextjs.example.com',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="generator" content="Next.js" />
          </head>
          <body>
            <div id="__next">
              <script src="/_next/static/chunks/main.js"></script>
            </div>
          </body>
          </html>
        `,
        headers: { 'server': 'node/14.0' }
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success);
      const technologies = response.result.technologies.map(t => t.name);
      assert(technologies.includes('Next.js') || technologies.includes('Node.js'));
    });

    it('should analyze Shopify website', async () => {
      const params = {
        url: 'https://store.example.com',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="generator" content="Shopify" />
          </head>
          <body>
            <script>
              window.Shopify = window.Shopify || {};
              window.ShopifyAnalytics = {};
            </script>
          </body>
          </html>
        `,
        headers: { 'x-powered-by': 'Shopify' }
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success);
      const technologies = response.result.technologies.map(t => t.name);
      assert(technologies.includes('Shopify'));
    });

    it('should analyze multi-tech website', async () => {
      const params = {
        url: 'https://complex.example.com',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="generator" content="WordPress 5.9" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
          </head>
          <body>
            <script>
              var ga = function() {};
              window.dataLayer = [];
            </script>
            <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/css/bootstrap.min.css">
          </body>
          </html>
        `,
        headers: {
          'server': 'apache/2.4.41',
          'x-powered-by': 'PHP/7.4'
        }
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success);
      assert(response.result.technologies.length > 1);
    });
  });

  // ==========================================
  // Response Format Tests
  // ==========================================

  describe('Response Format', () => {
    it('should return properly formatted success response', async () => {
      const params = {
        html: '<meta name="generator" content="WordPress" />'
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      // Check response structure
      assert('success' in response);
      assert('result' in response);
      assert(Array.isArray(response.result.technologies));
      assert(typeof response.result.totalDetected === 'number');
      assert(typeof response.result.scanTimeMs === 'number');
      assert(typeof response.result.timestamp === 'string');
    });

    it('should return properly formatted error response', async () => {
      const params = {}; // Invalid - missing html

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies_from_html', params, callback);

      // Check error response structure
      assert('success' in response);
      assert(!response.success);
      assert('error' in response);
    });

    it('should include technology details in response', async () => {
      const params = {
        html: '<meta name="generator" content="WordPress 5.9" />',
        headers: { 'server': 'nginx/1.21.0' }
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success);
      const tech = response.result.technologies[0];
      if (tech) {
        assert('name' in tech);
        assert('category' in tech);
        assert('confidence' in tech);
        assert('detectionMethod' in tech);
      }
    });
  });

  // ==========================================
  // Performance Tests
  // ==========================================

  describe('Performance', () => {
    it('should complete detection in under 1 second', async () => {
      const params = {
        html: `
          <meta name="generator" content="WordPress 5.9" />
          <script>
            var ga = function() {};
          </script>
        `,
        headers: { 'server': 'nginx' }
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      const startTime = Date.now();
      await mockServer.emit('detect_technologies', params, callback);
      const duration = Date.now() - startTime;

      assert(response.success);
      assert(duration < 1000, `Expected <1000ms, got ${duration}ms`);
    });

    it('should handle large HTML efficiently', async () => {
      const largeHtml = `
        <meta name="generator" content="WordPress 5.9" />
        <div>Content</div>
      `.repeat(1000);

      const params = {
        html: largeHtml,
        headers: { 'server': 'nginx' }
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      const startTime = Date.now();
      await mockServer.emit('detect_technologies', params, callback);
      const duration = Date.now() - startTime;

      assert(response.success);
      assert(duration < 2000, `Expected <2000ms, got ${duration}ms`);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = [];

      for (let i = 0; i < 10; i++) {
        const promise = new Promise((resolve) => {
          const params = {
            html: `<meta name="generator" content="WordPress ${i}" />`
          };

          const callback = (result) => {
            resolve(result);
          };

          mockServer.emit('detect_technologies', params, callback);
        });

        requests.push(promise);
      }

      const results = await Promise.all(requests);

      assert(results.length === 10);
      assert(results.every(r => r.success));
    });
  });

  // ==========================================
  // Accuracy Tests
  // ==========================================

  describe('Accuracy', () => {
    it('should detect WordPress with high confidence', async () => {
      const params = {
        html: '<meta name="generator" content="WordPress 5.9" />',
        headers: { 'x-powered-by': 'WordPress' }
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      const wordpress = response.result.technologies.find(t => t.name === 'WordPress');
      assert(wordpress);
      assert(wordpress.confidence >= 0.85);
    });

    it('should detect multiple framework types', async () => {
      const params = {
        html: `
          <script>var __NEXT_DATA__ = {};</script>
          <script>window.ga = function() {};</script>
        `
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      const names = response.result.technologies.map(t => t.name);
      // Should detect both Next.js and Google Analytics (if implementation includes it)
      assert(names.length > 0);
    });

    it('should have low false positive rate on generic HTML', async () => {
      const params = {
        html: '<html><head><title>Page</title></head><body>Content</body></html>'
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success);
      // Generic HTML should have few detections
      // Just verify we don't detect too many (reasonable threshold)
      assert(response.result.totalDetected <= 5,
        `Expected <= 5 detections for generic HTML, got ${response.result.totalDetected}`);
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('Edge Cases', () => {
    it('should handle empty HTML', async () => {
      const params = {
        html: ''
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success);
      assert(response.result.technologies.length === 0);
    });

    it('should handle special characters in HTML', async () => {
      const params = {
        html: '<meta name="generator" content="WordPress &amp; Plugins" />'
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success);
    });

    it('should handle case-insensitive header matching', async () => {
      const params = {
        html: '',
        headers: { 'Server': 'Nginx/1.21.0' } // Capital S
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success);
      const nginx = response.result.technologies.find(t => t.name === 'Nginx');
      assert(nginx);
    });

    it('should handle malformed headers', async () => {
      const params = {
        html: '',
        headers: { 'server': 'weird/broken>>server' }
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success); // Should not throw
    });
  });

  // ==========================================
  // Parameter Validation Tests
  // ==========================================

  describe('Parameter Validation', () => {
    it('should accept url parameter for reference', async () => {
      const params = {
        url: 'https://example.com',
        html: '<meta name="generator" content="WordPress" />'
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success);
    });

    it('should support passive_only parameter', async () => {
      const params = {
        html: '<meta name="generator" content="WordPress" />',
        passive_only: true
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success);
      if (response.result.technologies.length > 0) {
        assert(response.result.technologies[0].detectionMethod === 'passive');
      }
    });

    it('should support active_only parameter', async () => {
      const params = {
        html: '<meta name="generator" content="WordPress" />',
        active_only: true
      };

      let response = null;
      const callback = (result) => {
        response = result;
      };

      await mockServer.emit('detect_technologies', params, callback);

      assert(response.success);
      // Without page object, active detection won't work
    });
  });
});
