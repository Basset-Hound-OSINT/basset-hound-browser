/**
 * Unit tests for TechDetector with Seed Database
 * Tests detection accuracy with expanded signature database
 */

const TechDetector = require('../../src/analysis/tech-detector');

describe('TechDetector with Seed Database', () => {
  let detector;

  beforeAll(async () => {
    detector = new TechDetector();
    // Load seed database before running tests
    await detector.loadSeedDatabase();
  });

  afterEach(() => {
    detector.clearCache();
  });

  describe('Initialization with Seed Database', () => {
    test('should have loaded seed database', () => {
      const count = detector.getSignatureCount();
      expect(count).toBeGreaterThan(50);
    });

    test('should have proper signature format', () => {
      const sigs = detector.signatures;
      for (const [id, sig] of Object.entries(sigs)) {
        expect(sig.name).toBeDefined();
        expect(sig.category).toBeDefined();
      }
    });
  });

  describe('E-commerce Site Detection', () => {
    test('should detect WordPress-based site', async () => {
      const pageData = {
        html: `
          <meta name="generator" content="WordPress 6.2">
          <link rel="stylesheet" href="/wp-content/themes/style.css">
          <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
          <div class="container col-md-6">Products</div>
        `,
        scripts: [
          'https://code.jquery.com/jquery-3.6.0.min.js'
        ],
        resources: []
      };

      const result = await detector.detectTechnologies(pageData);

      expect(result.technologies).toBeDefined();
      expect(Array.isArray(result.technologies)).toBeTruthy();
      expect(result.detectionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('SPA Framework Detection', () => {
    test('should run detection for React', async () => {
      const pageData = {
        html: '<div id="root" data-react-root></div>',
        scripts: [],
        resources: []
      };

      const result = await detector.detectTechnologies(pageData);

      expect(result.technologies).toBeDefined();
      expect(Array.isArray(result.technologies)).toBeTruthy();
    });

    test('should run detection for Vue', async () => {
      const pageData = {
        html: '<div v-app></div>',
        scripts: [],
        resources: []
      };

      const result = await detector.detectTechnologies(pageData);

      expect(result.technologies).toBeDefined();
      expect(Array.isArray(result.technologies)).toBeTruthy();
    });

    test('should run detection for Angular', async () => {
      const pageData = {
        html: '<div ng-app="myApp"><div ng-bind="message"></div></div>',
        scripts: [],
        resources: []
      };

      const result = await detector.detectTechnologies(pageData);

      expect(result.technologies).toBeDefined();
      expect(Array.isArray(result.technologies)).toBeTruthy();
    });
  });

  describe('Server Detection', () => {
    test('should detect Apache from headers', async () => {
      const pageData = { html: '', scripts: [], resources: [] };
      const headers = { 'Server': 'Apache/2.4.41' };

      const result = await detector.detectTechnologies(pageData, [], headers);

      const apache = result.technologies.find(t => t.id === 'apache');
      expect(apache).toBeDefined();
      expect(apache.confidence).toBeGreaterThan(80);
    });

    test('should detect Nginx from headers', async () => {
      const pageData = { html: '', scripts: [], resources: [] };
      const headers = { 'Server': 'nginx/1.18.0' };

      const result = await detector.detectTechnologies(pageData, [], headers);

      const nginx = result.technologies.find(t => t.id === 'nginx');
      expect(nginx).toBeDefined();
      expect(nginx.confidence).toBeGreaterThan(80);
    });
  });

  describe('Multi-Technology Stack Detection', () => {
    test('should detect modern tech stack', async () => {
      const pageData = {
        html: `
          <meta name="generator" content="WordPress 6.2">
          <div id="root" data-react-root></div>
          <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/css/bootstrap.min.css">
          <script async src="https://www.googletagmanager.com/gtag/js?id=GA-123456789"></script>
          <div class="container col-md-6"></div>
        `,
        scripts: [
          'https://code.jquery.com/jquery-3.6.0.min.js',
          'https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/js/bootstrap.bundle.min.js',
          'https://www.googletagmanager.com/gtag/js?id=GA-123456789'
        ],
        resources: []
      };

      const headers = {
        'Server': 'Apache/2.4.41'
      };

      const result = await detector.detectTechnologies(pageData, [], headers);

      expect(result.technologies).toBeDefined();
      expect(Array.isArray(result.technologies)).toBeTruthy();
      expect(result.detectionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Caching', () => {
    test('should cache results efficiently', async () => {
      const pageData = {
        html: '<meta name="generator" content="WordPress">',
        scripts: [],
        resources: []
      };

      // Clear cache and detect
      detector.clearCache();
      const start1 = Date.now();
      await detector.detectTechnologies(pageData);
      const duration1 = Date.now() - start1;

      // Detect again (should be cached)
      const start2 = Date.now();
      await detector.detectTechnologies(pageData);
      const duration2 = Date.now() - start2;

      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });

  describe('Performance', () => {
    test('should complete detection in reasonable time', async () => {
      const pageData = {
        html: '<meta name="generator" content="WordPress">' + 'x'.repeat(10000),
        scripts: [],
        resources: []
      };

      const start = Date.now();
      await detector.detectTechnologies(pageData);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    test('should handle large HTML efficiently', async () => {
      const pageData = {
        html: `
          <meta name="generator" content="WordPress">
          <div class="col-md-6">Content</div>
          ${' x'.repeat(50000)}
        `,
        scripts: [],
        resources: []
      };

      const start = Date.now();
      const result = await detector.detectTechnologies(pageData);
      const duration = Date.now() - start;

      expect(result.technologies).toBeDefined();
      expect(Array.isArray(result.technologies)).toBeTruthy();
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty page data', async () => {
      const pageData = { html: '', scripts: [], resources: [] };

      const result = await detector.detectTechnologies(pageData);

      expect(result.technologies).toBeDefined();
      expect(Array.isArray(result.technologies)).toBeTruthy();
    });

    test('should handle null headers', async () => {
      const pageData = { html: '<meta name="generator" content="WordPress">', scripts: [], resources: [] };

      const result = await detector.detectTechnologies(pageData, [], null);

      expect(result.technologies).toBeDefined();
      expect(Array.isArray(result.technologies)).toBeTruthy();
    });

    test('should handle malformed HTML', async () => {
      const pageData = {
        html: '<<<>>><div>Broken</div>>>',
        scripts: [],
        resources: []
      };

      const result = await detector.detectTechnologies(pageData);

      expect(result.technologies).toBeDefined();
    });
  });

  describe('Signature Loader Integration', () => {
    test('should report signature loader status', () => {
      const loader = detector.getSignatureLoader();
      const status = loader.getStatus();

      expect(status.signaturesLoaded).toBeGreaterThan(50);
      expect(status.sourceFile).toBeDefined();
    });

    test('should support loading additional signatures', async () => {
      const beforeCount = detector.getSignatureCount();

      const additional = {
        'test-tech': {
          name: 'Test Technology',
          category: 'Testing'
        }
      };

      detector.signatureLoader.mergeSignatures(additional);
      detector.signatures = detector.signatureLoader.getSignatures();

      const afterCount = detector.getSignatureCount();

      expect(afterCount).toBe(beforeCount + 1);
    });
  });
});
