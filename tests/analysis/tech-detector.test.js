/**
 * Unit tests for TechDetector module
 * Tests all detection strategies and edge cases
 */

const TechDetector = require('../../src/analysis/tech-detector');

describe('TechDetector', () => {
  let detector;

  beforeAll(() => {
    detector = new TechDetector();
  });

  afterEach(() => {
    detector.clearCache();
  });

  // ==================================================
  // HTTP Header Detection Tests
  // ==================================================
  describe('HTTP Header Detection', () => {
    test('should detect Apache from Server header', async () => {
      const pageData = { html: '', scripts: [], resources: [] };
      const headers = { 'Server': 'Apache/2.4.41' };

      const result = await detector.detectTechnologies(pageData, [], headers);

      const apache = result.technologies.find(t => t.id === 'apache');
      expect(apache).toBeDefined();
      expect(apache.confidence).toBe(100);
      expect(apache.method).toBe('HTTP_HEADER');
    });

    test('should detect Nginx from Server header', async () => {
      const pageData = { html: '', scripts: [], resources: [] };
      const headers = { 'Server': 'nginx/1.18.0' };

      const result = await detector.detectTechnologies(pageData, [], headers);

      const nginx = result.technologies.find(t => t.id === 'nginx');
      expect(nginx).toBeDefined();
      expect(nginx.confidence).toBe(100);
    });

    test('should detect Express from X-Powered-By header', async () => {
      const pageData = { html: '', scripts: [], resources: [] };
      const headers = { 'X-Powered-By': 'Express' };

      const result = await detector.detectTechnologies(pageData, [], headers);

      const express = result.technologies.find(t => t.id === 'express');
      expect(express).toBeDefined();
    });

    test('should be case-insensitive', async () => {
      const pageData = { html: '', scripts: [], resources: [] };
      const headers = { 'server': 'NGINX/1.20' };

      const result = await detector.detectTechnologies(pageData, [], headers);

      const nginx = result.technologies.find(t => t.id === 'nginx');
      expect(nginx).toBeDefined();
    });
  });

  // ==================================================
  // HTML Pattern Detection Tests
  // ==================================================
  describe('HTML Pattern Detection', () => {
    test('should detect WordPress from meta generator tag', async () => {
      const html = '<meta name="generator" content="WordPress 6.2">';
      const pageData = { html, scripts: [], resources: [] };

      const result = await detector.detectTechnologies(pageData);

      const wordpress = result.technologies.find(t => t.id === 'wordpress');
      expect(wordpress).toBeDefined();
      expect(wordpress.method).toBe('META_TAG');
    });

    test('should detect WordPress from wp-content path', async () => {
      const html = '<script src="/wp-content/themes/style.js"></script>';
      const pageData = { html, scripts: [], resources: [] };

      const result = await detector.detectTechnologies(pageData);

      const wordpress = result.technologies.find(t => t.id === 'wordpress');
      expect(wordpress).toBeDefined();
    });

    test('should detect Bootstrap from CSS classes', async () => {
      const html = '<div class="container col-md-6"></div>';
      const pageData = { html, scripts: [], resources: [] };

      const result = await detector.detectTechnologies(pageData);

      const bootstrap = result.technologies.find(t => t.id === 'bootstrap');
      expect(bootstrap).toBeDefined();
    });

    test('should detect React from data-react-root', async () => {
      const html = '<div id="root" data-react-root></div>';
      const pageData = { html, scripts: [], resources: [] };

      const result = await detector.detectTechnologies(pageData);

      const react = result.technologies.find(t => t.id === 'react');
      expect(react).toBeDefined();
    });

    test('should detect Vue from v-app directive', async () => {
      const html = '<div v-app></div>';
      const pageData = { html, scripts: [], resources: [] };

      const result = await detector.detectTechnologies(pageData);

      const vue = result.technologies.find(t => t.id === 'vue');
      expect(vue).toBeDefined();
    });
  });

  // ==================================================
  // Consolidation Tests
  // ==================================================
  describe('Detection Consolidation', () => {
    test('should consolidate multiple detection methods', async () => {
      const html = '<meta name="generator" content="WordPress">/wp-content/';
      const headers = { 'x-powered-by': 'WordPress' };
      const pageData = { html, scripts: [], resources: [] };

      const result = await detector.detectTechnologies(pageData, [], headers);

      const wordpress = result.technologies.find(t => t.id === 'wordpress');
      expect(wordpress).toBeDefined();
      expect(wordpress.detectionMethods.length).toBeGreaterThan(1);
      expect(wordpress.confidence).toBeGreaterThan(95);
    });

    test('should sort by confidence', async () => {
      const html = `
        <meta name="generator" content="WordPress">
        <script src="/jquery.js"></script>
        <div class="col-md-6"></div>
      `;
      const pageData = { html, scripts: [], resources: [] };

      const result = await detector.detectTechnologies(pageData);

      for (let i = 0; i < result.technologies.length - 1; i++) {
        expect(result.technologies[i].confidence).toBeGreaterThanOrEqual(
          result.technologies[i + 1].confidence
        );
      }
    });
  });

  // ==================================================
  // Cache Tests
  // ==================================================
  describe('Caching', () => {
    test('should cache results', async () => {
      const pageData = { html: '<meta name="generator" content="WordPress">' };

      const result1 = await detector.detectTechnologies(pageData);
      const cacheSize1 = detector.detectionCache.size;

      const result2 = await detector.detectTechnologies(pageData);
      const cacheSize2 = detector.detectionCache.size;

      expect(cacheSize1).toBe(1);
      expect(cacheSize2).toBe(1);
      expect(result1.technologies.length).toBe(result2.technologies.length);
    });

    test('should clear cache', async () => {
      const pageData = { html: '<meta name="generator" content="WordPress">' };

      await detector.detectTechnologies(pageData);
      expect(detector.detectionCache.size).toBe(1);

      detector.clearCache();
      expect(detector.detectionCache.size).toBe(0);
    });
  });

  // ==================================================
  // Edge Cases
  // ==================================================
  describe('Edge Cases', () => {
    test('should handle empty page data', async () => {
      const pageData = { html: '' };

      const result = await detector.detectTechnologies(pageData);

      expect(result.success !== false).toBeTruthy();
      expect(Array.isArray(result.technologies)).toBeTruthy();
    });

    test('should handle null headers', async () => {
      const pageData = { html: '' };

      const result = await detector.detectTechnologies(pageData, [], null);

      expect(result).toBeDefined();
    });

    test('should handle no detections', async () => {
      const pageData = { html: '<div>Random content</div>' };

      const result = await detector.detectTechnologies(pageData);

      expect(Array.isArray(result.technologies)).toBeTruthy();
    });

    test('should measure detection time', async () => {
      const pageData = { html: '<meta name="generator" content="WordPress">' };

      const result = await detector.detectTechnologies(pageData);

      expect(result.detectionTime).toBeGreaterThan(0);
      expect(typeof result.detectionTime).toBe('number');
    });
  });

  // ==================================================
  // Integration Tests
  // ==================================================
  describe('Integration', () => {
    test('should detect multi-technology stack', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="generator" content="WordPress 6.2">
            <script src="/wp-content/themes/script.js"></script>
            <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="https://www.googletagmanager.com/gtag/js?id=GA-123456"></script>
          </head>
          <body>
            <div id="root" class="container col-md-6"></div>
          </body>
        </html>
      `;
      const headers = {
        'Server': 'Apache/2.4.41',
        'X-Powered-By': 'PHP/7.4.3'
      };
      const pageData = { html, scripts: [], resources: [] };

      const result = await detector.detectTechnologies(pageData, [], headers);

      expect(result.technologies.length).toBeGreaterThan(2);
      const techIds = result.technologies.map(t => t.id);
      expect(techIds).toContain('wordpress');
      expect(techIds).toContain('apache');
      // Bootstrap and Bootstrap classes are detected
      expect(techIds).toContain('bootstrap');
    });

    test('should provide detection summary', async () => {
      const html = '<meta name="generator" content="WordPress">';
      const pageData = { html };

      const result = await detector.detectTechnologies(pageData);

      expect(result.timestamp).toBeDefined();
      expect(result.detectionTime).toBeGreaterThan(0);
    });
  });

  // ==================================================
  // Signature Tests
  // ==================================================
  describe('Signature Database', () => {
    test('should load default signatures', () => {
      expect(Object.keys(detector.signatures).length).toBeGreaterThan(10);
    });

    test('should have required signature properties', () => {
      for (const [id, sig] of Object.entries(detector.signatures)) {
        expect(sig.name).toBeDefined();
        expect(sig.category).toBeDefined();
      }
    });

    test('should handle missing signature', async () => {
      const headers = { 'server': 'UnknownServer/1.0' };
      const pageData = { html: '' };

      const result = await detector.detectTechnologies(pageData, [], headers);

      expect(Array.isArray(result.technologies)).toBeTruthy();
    });
  });

  // ==================================================
  // Performance Tests
  // ==================================================
  describe('Performance', () => {
    test('should complete detection in reasonable time', async () => {
      const html = '<meta name="generator" content="WordPress">';
      const pageData = { html };

      const start = Date.now();
      await detector.detectTechnologies(pageData);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete in <5 seconds
    });

    test('should handle large HTML', async () => {
      const largeHtml = '<meta name="generator" content="WordPress">' +
        '<div class="col-md-6">' + 'x'.repeat(100000) + '</div>';
      const pageData = { html: largeHtml };

      const start = Date.now();
      const result = await detector.detectTechnologies(pageData);
      const duration = Date.now() - start;

      expect(Array.isArray(result.technologies)).toBeTruthy();
      expect(duration).toBeLessThan(10000); // Should complete in <10 seconds
    });
  });
});
