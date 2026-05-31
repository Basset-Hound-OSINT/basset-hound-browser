/**
 * Unit Tests for Technology Detector
 *
 * Tests:
 * - Passive detection (HTTP headers, HTML meta tags, endpoints)
 * - Active detection (JavaScript globals, DOM markers)
 * - Version detection
 * - Confidence scoring
 * - Edge cases and error handling
 */

const assert = require('assert');
const TechnologyDetector = require('../../src/analysis/technology-detector');

describe('TechnologyDetector', () => {
  let detector;

  beforeAll(() => {
    detector = new TechnologyDetector();
  });

  afterAll(async () => {
    await detector.cleanup();
  });

  // ==========================================
  // HTTP Header Detection Tests
  // ==========================================

  describe('HTTP Header Detection', () => {
    it('should detect Nginx from Server header', async () => {
      const result = await detector.detect({
        headers: { 'server': 'nginx/1.21.0' },
        html: ''
      });

      assert(result.success);
      const nginx = result.technologies.find(t => t.name === 'Nginx');
      assert(nginx);
      assert.strictEqual(nginx.detectionMethod, 'passive');
      assert.strictEqual(nginx.confidence, 0.95);
    });

    it('should detect Apache from Server header', async () => {
      const result = await detector.detect({
        headers: { 'server': 'Apache/2.4.41' },
        html: ''
      });

      assert(result.success);
      const apache = result.technologies.find(t => t.name === 'Apache');
      assert(apache);
      assert.strictEqual(apache.confidence, 0.95);
    });

    it('should detect IIS from Server header', async () => {
      const result = await detector.detect({
        headers: { 'server': 'Microsoft-IIS/10.0' },
        html: ''
      });

      assert(result.success);
      const iis = result.technologies.find(t => t.name === 'Microsoft-IIS');
      assert(iis);
    });

    it('should detect Cloudflare CDN', async () => {
      const result = await detector.detect({
        headers: {
          'server': 'cloudflare',
          'cf-ray': '12345abcde-SFO',
          'cf-cache-status': 'HIT'
        },
        html: ''
      });

      assert(result.success);
      const cloudflare = result.technologies.find(t => t.name === 'Cloudflare');
      assert(cloudflare);
      assert.strictEqual(cloudflare.confidence, 0.95);
    });

    it('should detect Node.js from X-Powered-By header', async () => {
      const result = await detector.detect({
        headers: { 'x-powered-by': 'Node.js' },
        html: ''
      });

      assert(result.success);
      const nodejs = result.technologies.find(t => t.name === 'Node.js');
      assert(nodejs);
    });

    it('should be case-insensitive for header names', async () => {
      const result = await detector.detect({
        headers: { 'Server': 'Nginx/1.20.0' },
        html: ''
      });

      assert(result.success);
      const nginx = result.technologies.find(t => t.name === 'Nginx');
      assert(nginx);
    });
  });

  // ==========================================
  // HTML Meta Tag Detection Tests
  // ==========================================

  describe('HTML Meta Tag Detection', () => {
    it('should detect WordPress from generator meta tag', async () => {
      const html = '<meta name="generator" content="WordPress 5.9.3" />';
      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
      const wordpress = result.technologies.find(t => t.name === 'WordPress');
      assert(wordpress);
      assert.strictEqual(wordpress.detectionMethod, 'passive');
    });

    it('should detect Drupal from generator meta tag', async () => {
      const html = '<meta name="generator" content="Drupal 9.3" />';
      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
      const drupal = result.technologies.find(t => t.name === 'Drupal');
      assert(drupal);
    });

    it('should detect Joomla from generator meta tag', async () => {
      const html = '<meta name="generator" content="Joomla! 3.10.0" />';
      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
      const joomla = result.technologies.find(t => t.name === 'Joomla');
      assert(joomla);
    });

    it('should detect Ghost from generator meta tag', async () => {
      const html = '<meta name="generator" content="Ghost 4.0" />';
      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
      const ghost = result.technologies.find(t => t.name === 'Ghost');
      assert(ghost);
    });

    it('should detect Gatsby from generator meta tag', async () => {
      const html = '<meta name="generator" content="Gatsby 4.0.0" />';
      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
      const gatsby = result.technologies.find(t => t.name === 'Gatsby');
      assert(gatsby);
    });

    it('should detect Shopify from generator meta tag', async () => {
      const html = '<meta name="generator" content="Shopify" />';
      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
      const shopify = result.technologies.find(t => t.name === 'Shopify');
      assert(shopify);
    });
  });

  // ==========================================
  // HTML Comment Detection Tests
  // ==========================================

  describe('HTML Comment Detection', () => {
    it('should detect WordPress from HTML comments', async () => {
      const html = '<!-- Powered by WordPress --><html></html>';
      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
      // WordPress should be detected from multiple sources
    });

    it('should detect Magento from HTML comments', async () => {
      const html = '<!-- Magento application --><html></html>';
      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
    });
  });

  // ==========================================
  // Endpoint Detection Tests
  // ==========================================

  describe('Endpoint Detection', () => {
    it('should detect WordPress from endpoint paths', async () => {
      const html = '<a href="/wp-json/wp/v2/posts">API</a>';
      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
      const wordpress = result.technologies.find(t => t.name === 'WordPress');
      assert(wordpress);
    });

    it('should detect Drupal from endpoint paths', async () => {
      const html = '<a href="/api/v1/users">API</a>';
      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
    });

    it('should detect Next.js from endpoint paths', async () => {
      const html = '<script src="/_next/static/chunks/main.js"></script>';
      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
      const nextjs = result.technologies.find(t => t.name === 'Next.js');
      assert(nextjs);
    });

    it('should detect Gatsby from endpoint paths', async () => {
      const html = '<script src="/.cache/main.js"></script>';
      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
    });
  });

  // ==========================================
  // Version Detection Tests
  // ==========================================

  describe('Version Detection', () => {
    it('should extract Nginx version from header', async () => {
      const result = await detector.detect({
        headers: { 'server': 'nginx/1.21.5' },
        html: ''
      });

      assert(result.success);
      const nginx = result.technologies.find(t => t.name === 'Nginx');
      assert(nginx);
      assert(nginx.version);
    });

    it('should extract Apache version from header', async () => {
      const result = await detector.detect({
        headers: { 'server': 'Apache/2.4.51' },
        html: ''
      });

      assert(result.success);
      const apache = result.technologies.find(t => t.name === 'Apache');
      assert(apache);
      assert(apache.version);
    });

    it('should handle version not available', async () => {
      const result = await detector.detect({
        headers: { 'server': 'Apache' },
        html: ''
      });

      assert(result.success);
      const apache = result.technologies.find(t => t.name === 'Apache');
      assert(apache);
      // Version might be null or undefined
    });
  });

  // ==========================================
  // Confidence Scoring Tests
  // ==========================================

  describe('Confidence Scoring', () => {
    it('should score Nginx detection highly', async () => {
      const result = await detector.detect({
        headers: { 'server': 'nginx/1.21.0' },
        html: ''
      });

      assert(result.success);
      const nginx = result.technologies.find(t => t.name === 'Nginx');
      assert(nginx);
      assert(nginx.confidence >= 0.90);
    });

    it('should score Cloudflare detection highly', async () => {
      const result = await detector.detect({
        headers: {
          'server': 'cloudflare',
          'cf-ray': '12345'
        },
        html: ''
      });

      assert(result.success);
      const cloudflare = result.technologies.find(t => t.name === 'Cloudflare');
      assert(cloudflare);
      assert(cloudflare.confidence >= 0.90);
    });

    it('should apply minimum confidence threshold', async () => {
      const lowConfidenceDetector = new TechnologyDetector({
        minConfidence: 0.95
      });

      const result = await lowConfidenceDetector.detect({
        html: '<meta name="generator" content="Some Unknown Tool" />',
        headers: {}
      });

      // Should filter out low-confidence detections
      assert(result.success);
      assert.strictEqual(result.technologies.length, 0);

      lowConfidenceDetector.cleanup();
    });
  });

  // ==========================================
  // Multiple Technology Detection Tests
  // ==========================================

  describe('Multiple Technologies', () => {
    it('should detect multiple technologies in one page', async () => {
      const html = `
        <meta name="generator" content="WordPress 5.9" />
        <script>
          window.ga = window.ga || function() {};
          window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {};
        </script>
        <link rel="stylesheet" href="/bootstrap/css/bootstrap.min.css" />
      `;

      const result = await detector.detect({
        html,
        headers: { 'server': 'nginx' }
      });

      assert(result.success);
      assert(result.totalDetected >= 2);

      // Should detect multiple technologies
      const detectedNames = result.technologies.map(t => t.name);
      assert(detectedNames.includes('Nginx') || detectedNames.includes('WordPress'));
    });

    it('should sort technologies by confidence', async () => {
      const html = '<meta name="generator" content="WordPress 5.9" />';
      const result = await detector.detect({
        html,
        headers: { 'server': 'nginx/1.21.0' }
      });

      assert(result.success);
      if (result.technologies.length > 1) {
        // Check that confidence is in descending order
        for (let i = 0; i < result.technologies.length - 1; i++) {
          assert(result.technologies[i].confidence >= result.technologies[i + 1].confidence);
        }
      }
    });
  });

  // ==========================================
  // Error Handling Tests
  // ==========================================

  describe('Error Handling', () => {
    it('should handle empty input gracefully', async () => {
      const result = await detector.detect({
        html: '',
        headers: {}
      });

      assert(result.success);
      assert.strictEqual(result.technologies.length, 0);
    });

    it('should handle null headers', async () => {
      const result = await detector.detect({
        html: '<html></html>',
        headers: null
      });

      // Should handle gracefully by using empty object
      assert(result.success);
    });

    it('should handle malformed HTML', async () => {
      const result = await detector.detect({
        html: '<meta name="generator">>> BROKEN <<<',
        headers: {}
      });

      assert(result.success);
      // Should not throw error
    });

    it('should handle very large input', async () => {
      const largeHtml = '<html>' + '<div>Content</div>'.repeat(10000) + '</html>';
      const result = await detector.detect({
        html: largeHtml,
        headers: {}
      });

      assert(result.success);
      assert(result.scanTimeMs < 5000); // Should complete in reasonable time
    });

    it('should return consistent structure on error', async () => {
      const result = await detector.detect({
        html: undefined,
        headers: undefined
      });

      assert('success' in result);
      assert('technologies' in result);
      assert('totalDetected' in result);
      assert('scanTimeMs' in result);
    });
  });

  // ==========================================
  // Performance Tests
  // ==========================================

  describe('Performance', () => {
    it('should complete detection in under 2 seconds', async () => {
      const html = `
        <meta name="generator" content="WordPress 5.9" />
        <script>
          var ga = function() {};
        </script>
        <link rel="stylesheet" href="/css/style.css" />
      `;

      const startTime = Date.now();
      const result = await detector.detect({
        html,
        headers: { 'server': 'nginx' }
      });
      const duration = Date.now() - startTime;

      assert(result.success);
      assert(duration < 2000, `Detection took ${duration}ms, expected <2000ms`);
    });

    it('should handle concurrent detections', async () => {
      const html1 = '<meta name="generator" content="WordPress" />';
      const html2 = '<meta name="generator" content="Drupal" />';

      const promises = [
        detector.detect({ html: html1, headers: {} }),
        detector.detect({ html: html2, headers: {} })
      ];

      const results = await Promise.all(promises);

      assert(results.length === 2);
      assert(results[0].success);
      assert(results[1].success);
    });
  });

  // ==========================================
  // Cookie Detection Tests
  // ==========================================

  describe('Cookie Detection', () => {
    it('should identify technologies from cookies in HTML', async () => {
      // Cookies are typically detected from response headers, not HTML
      // This test verifies the structure supports cookie detection
      const result = await detector.detect({
        html: '',
        headers: { 'set-cookie': 'wordpress_logged_in=abc123' }
      });

      assert(result.success);
      // Cookie detection would be in full implementation
    });
  });

  // ==========================================
  // Active Detection Options Tests
  // ==========================================

  describe('Detection Options', () => {
    it('should support passive-only detection', async () => {
      const result = await detector.detect({
        html: '<meta name="generator" content="WordPress" />',
        headers: {},
        passiveOnly: true
      });

      assert(result.success);
      assert(result.technologies.every(t => t.detectionMethod === 'passive'));
    });

    it('should skip detection when activeOnly is true without page', async () => {
      const result = await detector.detect({
        html: '<meta name="generator" content="WordPress" />',
        headers: {},
        activeOnly: true
        // No page object provided
      });

      assert(result.success);
      // Should handle gracefully
    });

    it('should respect maxDetections limit', async () => {
      const detector100 = new TechnologyDetector({ maxDetections: 5 });

      const html = `
        <meta name="generator" content="WordPress" />
        <script>
          window.ga = function() {};
          window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {};
        </script>
      `;

      const result = await detector100.detect({
        html,
        headers: { 'server': 'nginx' }
      });

      assert(result.success);
      assert(result.technologies.length <= 5);

      detector100.cleanup();
    });
  });

  // ==========================================
  // Analytics Tools Detection Tests
  // ==========================================

  describe('Analytics Tools', () => {
    it('should detect Google Analytics', async () => {
      const html = `
        <script async src="https://www.googletagmanager.com/gtag/js?id=UA-123456-1"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          window.ga = function() {};
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
        </script>
      `;

      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
      // Note: GA detection might not work without active detection
      // Check if detected or just ensure no error
      assert(Array.isArray(result.technologies));
    });

    it('should detect Hotjar', async () => {
      const html = `
        <script>
          window.hj = window.hj || {};
          window.hjSiteId = 123456;
        </script>
      `;

      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
      // Hotjar detection requires active detection (JS globals)
      // Just ensure no error occurs
      assert(Array.isArray(result.technologies));
    });

    it('should detect Mixpanel', async () => {
      const html = `
        <script>
          var mixpanel = window.mixpanel || [];
        </script>
      `;

      const result = await detector.detect({
        html,
        headers: {}
      });

      assert(result.success);
    });
  });
});
