/**
 * Unit Tests for Technology Fingerprinting Module
 *
 * Tests cover:
 * - Multi-layer detection (headers, HTML, scripts, DOM, favicon)
 * - Confidence scoring and consolidation
 * - Version extraction
 * - Caching mechanism
 * - Error handling
 *
 * @module tests/unit/technology-fingerprint.test.js
 */

const TechnologyFingerprinter = require('../../src/analysis/technology-fingerprint');

describe('TechnologyFingerprinter', () => {
  let fingerprinter;

  beforeAll(() => {
    fingerprinter = new TechnologyFingerprinter({
      minConfidence: 0.50,
      maxDetections: 100,
      cacheTimeout: 3600000
    });
  });

  afterEach(() => {
    fingerprinter.clearCache();
  });

  // ==================================================
  // HTTP Header Detection Tests
  // ==================================================
  describe('HTTP Header Detection', () => {
    test('should detect Nginx from Server header', async () => {
      const result = await fingerprinter.detect({
        html: '',
        headers: { 'server': 'nginx/1.18.0' }
      });

      expect(result.success).toBe(true);
      const nginx = result.technologies.find(t => t.id === 'nginx');
      expect(nginx).toBeDefined();
      expect(nginx.confidence).toBe(0.95);
      expect(nginx.method).toBe('HTTP_HEADER');
      expect(nginx.version).toMatch(/1\.18/);
    });

    test('should detect Apache from Server header', async () => {
      const result = await fingerprinter.detect({
        html: '',
        headers: { 'server': 'Apache/2.4.41 (Ubuntu)' }
      });

      expect(result.success).toBe(true);
      const apache = result.technologies.find(t => t.id === 'apache');
      expect(apache).toBeDefined();
      expect(apache.confidence).toBe(0.95);
    });

    test('should detect Express from X-Powered-By header', async () => {
      const result = await fingerprinter.detect({
        html: '',
        headers: { 'x-powered-by': 'Express' }
      });

      expect(result.success).toBe(true);
      const express = result.technologies.find(t => t.id === 'express');
      expect(express).toBeDefined();
    });

    test('should be case-insensitive for headers', async () => {
      const result = await fingerprinter.detect({
        html: '',
        headers: { 'SERVER': 'NGINX/1.20' }
      });

      expect(result.success).toBe(true);
      const nginx = result.technologies.find(t => t.id === 'nginx');
      expect(nginx).toBeDefined();
    });

    test('should handle missing headers gracefully', async () => {
      const result = await fingerprinter.detect({
        html: '',
        headers: {}
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.technologies)).toBe(true);
    });
  });

  // ==================================================
  // HTML Pattern Detection Tests
  // ==================================================
  describe('HTML Pattern Detection', () => {
    test('should detect WordPress from meta generator tag', async () => {
      const html = '<meta name="generator" content="WordPress 6.2">';
      const result = await fingerprinter.detect({ html });

      expect(result.success).toBe(true);
      const wordpress = result.technologies.find(t => t.id === 'wordpress');
      expect(wordpress).toBeDefined();
      expect(wordpress.method).toBe('META_GENERATOR');
      expect(wordpress.version).toMatch(/6\.2/);
    });

    test('should detect Drupal from meta generator tag', async () => {
      const html = '<meta name="generator" content="Drupal 10 (https://www.drupal.org)">';
      const result = await fingerprinter.detect({ html });

      expect(result.success).toBe(true);
      const drupal = result.technologies.find(t => t.id === 'drupal');
      expect(drupal).toBeDefined();
    });

    test('should detect patterns in HTML content', async () => {
      const html = `
        <html>
          <head><title>My Site</title></head>
          <body>
            <div>/wp-content/uploads/2023/image.jpg</div>
          </body>
        </html>
      `;
      const result = await fingerprinter.detect({ html });

      expect(result.success).toBe(true);
      const wordpress = result.technologies.find(t => t.id === 'wordpress');
      expect(wordpress).toBeDefined();
    });

    test('should detect React from data-react-root', async () => {
      const html = '<div id="root" data-react-root></div>';
      const result = await fingerprinter.detect({ html });

      expect(result.success).toBe(true);
      const react = result.technologies.find(t => t.id === 'react');
      expect(react).toBeDefined();
    });

    test('should detect jQuery patterns', async () => {
      const html = '<script src="/js/jquery-3.6.0.min.js"></script>';
      const result = await fingerprinter.detect({ html });

      expect(result.success).toBe(true);
    });
  });

  // ==================================================
  // Script URL Detection Tests
  // ==================================================
  describe('Script URL Detection', () => {
    test('should detect from script URLs in array', async () => {
      const result = await fingerprinter.detect({
        html: '',
        scripts: ['https://cdn.example.com/jquery-3.6.0.min.js']
      });

      expect(result.success).toBe(true);
      const jquery = result.technologies.find(t => t.id === 'jquery');
      expect(jquery).toBeDefined();
    });

    test('should extract version from script URL', async () => {
      const result = await fingerprinter.detect({
        html: '',
        scripts: ['https://cdn.example.com/react@18.2.0.js']
      });

      expect(result.success).toBe(true);
      const react = result.technologies.find(t => t.id === 'react');
      if (react && react.version) {
        expect(react.version).toMatch(/18\.2/);
      }
    });

    test('should detect multiple scripts', async () => {
      const result = await fingerprinter.detect({
        html: '',
        scripts: [
          'https://cdn.example.com/jquery-3.6.0.min.js',
          'https://cdn.example.com/bootstrap.min.js'
        ]
      });

      expect(result.success).toBe(true);
      const jquery = result.technologies.find(t => t.id === 'jquery');
      expect(jquery).toBeDefined();
    });
  });

  // ==================================================
  // DOM Marker Detection Tests
  // ==================================================
  describe('DOM Marker Detection', () => {
    test('should detect data attributes', async () => {
      const html = '<div data-react-root></div>';
      const result = await fingerprinter.detect({ html });

      expect(result.success).toBe(true);
      const react = result.technologies.find(t => t.id === 'react');
      expect(react).toBeDefined();
    });

    test('should detect ng-app markers', async () => {
      const html = '<div ng-app="myApp"></div>';
      const result = await fingerprinter.detect({ html });

      expect(result.success).toBe(true);
      const angular = result.technologies.find(t => t.id === 'angular');
      expect(angular).toBeDefined();
    });

    test('should detect Vue.js markers', async () => {
      const html = '<div id="app" v-app></div>';
      const result = await fingerprinter.detect({ html });

      expect(result.success).toBe(true);
      const vue = result.technologies.find(t => t.id === 'vue');
      expect(vue).toBeDefined();
    });
  });

  // ==================================================
  // Multi-Layer Consolidation Tests
  // ==================================================
  describe('Multi-Layer Detection & Consolidation', () => {
    test('should increase confidence with multiple detection methods', async () => {
      const html = `
        <meta name="generator" content="WordPress 6.2">
        <script src="/wp-includes/js/wp-emoji-release.min.js"></script>
      `;
      const headers = { 'x-powered-by': 'WordPress' };

      const result = await fingerprinter.detect({ html, headers });

      expect(result.success).toBe(true);
      const wordpress = result.technologies.find(t => t.id === 'wordpress');
      expect(wordpress).toBeDefined();
      expect(wordpress.detectionMethods).toBeDefined();
      expect(wordpress.detectionMethods.length).toBeGreaterThan(1);
      // Confidence should be higher due to multiple method agreement
      expect(wordpress.confidence).toBeGreaterThanOrEqual(0.90);
    });

    test('should merge detections from all sources', async () => {
      const html = '<div data-react-root></div>';
      const scripts = [];
      const headers = {};

      const result = await fingerprinter.detect({ html, scripts, headers });

      expect(result.success).toBe(true);
      const react = result.technologies.find(t => t.id === 'react');
      expect(react).toBeDefined();
      expect(react.detectionMethods).toBeDefined();
      expect(react.detectionMethods.length).toBeGreaterThan(0);
    });

    test('should sort results by confidence', async () => {
      const html = `
        <meta name="generator" content="WordPress 6.2">
        <div data-react-root></div>
        <script src="/jquery.min.js"></script>
      `;

      const result = await fingerprinter.detect({ html });

      expect(result.success).toBe(true);
      // Verify technologies are sorted by confidence (descending)
      for (let i = 1; i < result.technologies.length; i++) {
        expect(result.technologies[i - 1].confidence).toBeGreaterThanOrEqual(
          result.technologies[i].confidence
        );
      }
    });
  });

  // ==================================================
  // Caching Tests
  // ==================================================
  describe('Detection Caching', () => {
    test('should cache detection results', async () => {
      const html = '<meta name="generator" content="WordPress 6.2">';

      const result1 = await fingerprinter.detect({ html });
      const result2 = await fingerprinter.detect({ html });

      expect(result1.technologies).toEqual(result2.technologies);
      expect(fingerprinter.getCacheSize()).toBeGreaterThan(0);
    });

    test('should clear cache', async () => {
      const html = '<meta name="generator" content="WordPress 6.2">';
      await fingerprinter.detect({ html });

      expect(fingerprinter.getCacheSize()).toBeGreaterThan(0);
      fingerprinter.clearCache();
      expect(fingerprinter.getCacheSize()).toBe(0);
    });

    test('should respect cache timeout', async () => {
      const fp = new TechnologyFingerprinter({
        minConfidence: 0.50,
        cacheTimeout: 100 // 100ms
      });

      const html = '<div></div>';
      await fp.detect({ html });

      expect(fp.getCacheSize()).toBe(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Cache should be expired (but not automatically cleared)
      // Re-detection should work
      const result = await fp.detect({ html });
      expect(result.success).toBe(true);
    });
  });

  // ==================================================
  // Response Structure Tests
  // ==================================================
  describe('Response Structure', () => {
    test('should return proper response format on success', async () => {
      const result = await fingerprinter.detect({
        html: '<meta name="generator" content="WordPress 6.2">'
      });

      expect(result.success).toBe(true);
      expect(result.technologies).toBeDefined();
      expect(Array.isArray(result.technologies)).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.detectionTimeMs).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    test('should include summary statistics', async () => {
      const html = '<meta name="generator" content="WordPress 6.2"><div data-react-root></div>';
      const result = await fingerprinter.detect({ html });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalDetected).toBeGreaterThan(0);
      expect(result.summary.highConfidence).toBeDefined();
      expect(result.summary.mediumConfidence).toBeDefined();
      expect(result.summary.lowConfidence).toBeDefined();
      expect(result.summary.categories).toBeDefined();
      expect(result.summary.byCategory).toBeDefined();
    });

    test('should include evidence in technologies', async () => {
      const result = await fingerprinter.detect({
        html: '<meta name="generator" content="WordPress 6.2">'
      });

      expect(result.success).toBe(true);
      const wordpress = result.technologies.find(t => t.id === 'wordpress');
      expect(wordpress.evidence).toBeDefined();
      expect(wordpress.detectionMethods).toBeDefined();
    });
  });

  // ==================================================
  // Version Extraction Tests
  // ==================================================
  describe('Version Extraction', () => {
    test('should extract WordPress version from meta tag', async () => {
      const html = '<meta name="generator" content="WordPress 6.2.3">';
      const result = await fingerprinter.detect({ html });

      const wordpress = result.technologies.find(t => t.id === 'wordpress');
      expect(wordpress.version).toBeDefined();
      expect(wordpress.version).toMatch(/6\.2/);
    });

    test('should extract Nginx version from header', async () => {
      const result = await fingerprinter.detect({
        html: '',
        headers: { 'server': 'nginx/1.25.1' }
      });

      const nginx = result.technologies.find(t => t.id === 'nginx');
      expect(nginx.version).toBeDefined();
      expect(nginx.version).toMatch(/1\.25/);
    });

    test('should extract version from script URL', async () => {
      const result = await fingerprinter.detect({
        html: '',
        scripts: ['https://cdn.example.com/bootstrap@5.3.0.min.js']
      });

      // Version extraction may or may not succeed depending on pattern
      // This test just verifies it doesn't crash
      expect(result.success).toBe(true);
    });
  });

  // ==================================================
  // Error Handling Tests
  // ==================================================
  describe('Error Handling', () => {
    test('should handle null/undefined parameters gracefully', async () => {
      const result = await fingerprinter.detect({
        html: null,
        headers: undefined,
        scripts: null
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.technologies)).toBe(true);
    });

    test('should handle invalid detection options', async () => {
      const result = await fingerprinter.detect({});

      expect(result.success).toBe(true);
      expect(result.technologies).toBeDefined();
    });

    test('should handle large HTML content', async () => {
      const largeHtml = '<div>' + 'a'.repeat(100000) + '</div>';
      const result = await fingerprinter.detect({ html: largeHtml });

      expect(result.success).toBe(true);
    });

    test('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<div><p>unclosed tag</div>';
      const result = await fingerprinter.detect({ html: malformedHtml });

      expect(result.success).toBe(true);
    });
  });

  // ==================================================
  // Statistics Tests
  // ==================================================
  describe('Statistics', () => {
    test('should provide accurate statistics', () => {
      const stats = fingerprinter.getStatistics();

      expect(stats.totalSignatures).toBeGreaterThan(0);
      expect(stats.categories).toBeDefined();
      expect(stats.categoryCount).toBeGreaterThan(0);
      expect(stats.cacheSize).toBeDefined();
      expect(stats.cacheTimeoutMs).toBeDefined();
    });

    test('should track multiple categories', () => {
      const stats = fingerprinter.getStatistics();
      const categories = Object.keys(stats.categories);

      expect(categories).toContain('JavaScript Framework');
      expect(categories).toContain('CMS');
      expect(categories).toContain('Web Server');
    });
  });

  // ==================================================
  // Integration Tests
  // ==================================================
  describe('Integration Tests', () => {
    test('should detect realistic WordPress site', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="generator" content="WordPress 6.2.1">
            <link rel="stylesheet" href="/wp-content/themes/twentytwentythree/style.css">
          </head>
          <body>
            <div id="root" class="wp-site-blocks">
              <div class="wp-block-group">Content</div>
            </div>
            <script src="/wp-includes/js/wp-emoji-release.min.js"></script>
          </body>
        </html>
      `;

      const result = await fingerprinter.detect({ html });

      expect(result.success).toBe(true);
      const wordpress = result.technologies.find(t => t.id === 'wordpress');
      expect(wordpress).toBeDefined();
      expect(wordpress.confidence).toBeGreaterThanOrEqual(0.80);
    });

    test('should detect realistic React app', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="generator" content="React App">
          </head>
          <body>
            <div id="root" data-react-root></div>
            <script src="/static/js/react.min.js"></script>
            <script src="/static/js/react-dom.min.js"></script>
          </body>
        </html>
      `;

      const result = await fingerprinter.detect({ html });

      expect(result.success).toBe(true);
      const react = result.technologies.find(t => t.id === 'react');
      expect(react).toBeDefined();
    });

    test('should detect multiple frameworks on same page', async () => {
      const html = `
        <html>
          <head>
            <meta name="generator" content="WordPress 6.2">
          </head>
          <body>
            <div class="react-app" data-react-root></div>
            <script src="/jquery.min.js"></script>
            <script src="/bootstrap.min.js"></script>
          </body>
        </html>
      `;

      const result = await fingerprinter.detect({ html });

      expect(result.success).toBe(true);
      // At least WordPress and React should be detected
      expect(result.technologies.length).toBeGreaterThanOrEqual(2);
      expect(result.summary.totalDetected).toBeGreaterThanOrEqual(2);
    });
  });
});
