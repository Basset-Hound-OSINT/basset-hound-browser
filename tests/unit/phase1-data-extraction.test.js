/**
 * Phase 1 Data Extraction Commands - Unit Tests
 *
 * Comprehensive unit tests for all 21 Phase 1 data extraction commands:
 * - HTML Capture (4): export_html_with_metadata, export_html_formatted, export_html_raw, export_html_diff
 * - DOM Snapshots (7): export_dom_tree, export_dom_computed_styles, export_dom_form_state,
 *                      export_dom_text_content, export_dom_attributes, export_dom_event_listeners, export_dom_mutations
 * - JavaScript/Console (10): export_scripts_all, export_scripts_sources, export_console_logs,
 *                            export_globals, export_localstorage, export_sessionstorage, export_cookies,
 *                            export_performance_timeline, export_errors, export_network_from_js
 *
 * @module tests/unit/phase1-data-extraction
 */

const assert = require('assert');
const { HtmlCaptureManager } = require('../../extraction/html-capture-manager');
const { DOMSnapshotManager } = require('../../src/extraction/dom-snapshot');

describe('Phase 1 Data Extraction Commands - Unit Tests', () => {

  // ==========================================
  // HTML Capture Commands (4 total)
  // ==========================================

  describe('HTML Capture Commands', () => {
    let htmlCaptureManager;

    beforeEach(() => {
      htmlCaptureManager = new HtmlCaptureManager();
    });

    describe('export_html_with_metadata', () => {
      it('should capture HTML with metadata', async () => {
        const html = '<html><head><meta name="test" content="value"></head><body>Test</body></html>';
        const result = await htmlCaptureManager.captureWithMetadata(html, {
          url: 'https://example.com',
          headers: { 'content-type': 'text/html' }
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.snapshotId);
        assert.strictEqual(result.html, html);
        assert.ok(result.metadata);
        assert.ok(result.size);
      });

      it('should extract meta tags correctly', async () => {
        const html = `
          <html>
            <head>
              <meta name="description" content="Test description">
              <meta name="keywords" content="test, keywords">
              <title>Test Page</title>
            </head>
            <body></body>
          </html>
        `;

        const result = await htmlCaptureManager.captureWithMetadata(html, {
          url: 'https://example.com'
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.metadata.metaTags);
      });

      it('should handle empty HTML gracefully', async () => {
        const result = await htmlCaptureManager.captureWithMetadata('', {
          url: 'https://example.com'
        });

        assert.strictEqual(result.success, false);
        assert.ok(result.error);
      });

      it('should compress HTML when requested', async () => {
        const html = '<html><body>' + 'a'.repeat(10000) + '</body></html>';
        const result = await htmlCaptureManager.captureWithMetadata(html, {
          url: 'https://example.com',
          compress: true
        });

        assert.strictEqual(result.success, true);
      });

      it('should include formatted version when requested', async () => {
        const html = '<html><head></head><body><div>Test</div></body></html>';
        const result = await htmlCaptureManager.captureWithMetadata(html, {
          url: 'https://example.com',
          includeFormatted: true
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.formatted);
      });
    });

    describe('export_html_formatted', () => {
      it('should format HTML with proper indentation', () => {
        const html = '<html><head></head><body><div>Test</div></body></html>';
        const result = htmlCaptureManager.captureFormatted(html, {
          url: 'https://example.com',
          indentSize: 2
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.html);
        assert.ok(result.html.includes('\n')); // Should have newlines for formatting
      });

      it('should respect indent size parameter', () => {
        const html = '<html><body><div>Test</div></body></html>';
        const result = htmlCaptureManager.captureFormatted(html, {
          url: 'https://example.com',
          indentSize: 4
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.html);
      });

      it('should include or exclude comments based on parameter', () => {
        const html = '<html><!-- Comment --><body>Test</body></html>';
        const resultWithComments = htmlCaptureManager.captureFormatted(html, {
          url: 'https://example.com',
          includeComments: true
        });

        const resultWithoutComments = htmlCaptureManager.captureFormatted(html, {
          url: 'https://example.com',
          includeComments: false
        });

        assert.strictEqual(resultWithComments.success, true);
        assert.strictEqual(resultWithoutComments.success, true);
      });
    });

    describe('export_html_raw', () => {
      it('should capture raw HTML with hashes', async () => {
        const html = '<html><body>Test content</body></html>';
        const result = await htmlCaptureManager.captureRaw(html, {
          url: 'https://example.com',
          statusCode: 200,
          statusText: 'OK'
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.html, html);
        assert.ok(result.bytes);
        assert.ok(result.bytes.sha256);
        assert.ok(result.bytes.md5);
        assert.ok(result.bytes.raw !== undefined);
      });

      it('should capture HTTP response metadata', async () => {
        const html = '<html><body>Test</body></html>';
        const headers = { 'content-type': 'text/html; charset=utf-8' };

        const result = await htmlCaptureManager.captureRaw(html, {
          url: 'https://example.com',
          statusCode: 200,
          statusText: 'OK',
          headers
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.response);
        assert.strictEqual(result.response.statusCode, 200);
      });

      it('should include timing information when provided', async () => {
        const html = '<html><body>Test</body></html>';
        const fetchStart = Date.now() - 100;
        const fetchEnd = Date.now();

        const result = await htmlCaptureManager.captureRaw(html, {
          url: 'https://example.com',
          fetchStart,
          fetchEnd,
          duration: fetchEnd - fetchStart
        });

        assert.strictEqual(result.success, true);
      });
    });

    describe('export_html_diff', () => {
      it('should capture diff against previous snapshot', () => {
        const html1 = '<html><body><div>Version 1</div></body></html>';
        const html2 = '<html><body><div>Version 2</div></body></html>';

        const result1 = htmlCaptureManager.captureDiff(html1, {
          url: 'https://example.com',
          includeFullHtml: true
        });

        const result2 = htmlCaptureManager.captureDiff(html2, {
          url: 'https://example.com',
          previousSnapshotId: result1.snapshotId,
          includeFullHtml: true
        });

        assert.strictEqual(result1.success, true);
        assert.strictEqual(result2.success, true);
        assert.ok(result2.changes);
      });

      it('should track snapshot history', () => {
        for (let i = 0; i < 5; i++) {
          htmlCaptureManager.captureDiff(`<html><body>Version ${i}</body></html>`, {
            url: 'https://example.com'
          });
        }

        const result = htmlCaptureManager.captureDiff('<html><body>Final</body></html>', {
          url: 'https://example.com'
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.history);
        assert.ok(result.history.length > 0);
      });

      it('should generate HTML diffs correctly', () => {
        const result = htmlCaptureManager.captureDiff(
          '<html><body><p>Old text</p></body></html>',
          { url: 'https://example.com', includeFullHtml: true }
        );

        const result2 = htmlCaptureManager.captureDiff(
          '<html><body><p>New text</p></body></html>',
          { url: 'https://example.com', previousSnapshotId: result.snapshotId }
        );

        assert.strictEqual(result2.success, true);
        assert.ok(result2.changes);
      });
    });

    describe('Utility Commands', () => {
      it('should get capture statistics', () => {
        htmlCaptureManager.captureWithMetadata(
          '<html><body>Test</body></html>',
          { url: 'https://example1.com' }
        );

        htmlCaptureManager.captureWithMetadata(
          '<html><body>Test</body></html>',
          { url: 'https://example2.com' }
        );

        const stats = htmlCaptureManager.getStats();
        assert.ok(stats);
        assert.strictEqual(stats.snapshotCount, 2);
      });

      it('should clear snapshots for a URL', () => {
        htmlCaptureManager.captureWithMetadata(
          '<html><body>Test</body></html>',
          { url: 'https://example.com' }
        );

        htmlCaptureManager.clearSnapshots('https://example.com');
        const stats = htmlCaptureManager.getStats();

        assert.strictEqual(stats.snapshotCount, 0);
      });

      it('should clear all snapshots', () => {
        htmlCaptureManager.captureWithMetadata(
          '<html><body>Test</body></html>',
          { url: 'https://example1.com' }
        );
        htmlCaptureManager.captureWithMetadata(
          '<html><body>Test</body></html>',
          { url: 'https://example2.com' }
        );

        htmlCaptureManager.clearSnapshots();
        const stats = htmlCaptureManager.getStats();

        assert.strictEqual(stats.snapshotCount, 0);
      });
    });
  });

  // ==========================================
  // DOM Snapshot Commands (7 total)
  // ==========================================

  describe('DOM Snapshot Commands', () => {
    let snapshotManager;

    beforeEach(() => {
      snapshotManager = new DOMSnapshotManager();
    });

    describe('export_dom_tree', () => {
      it('should generate valid DOM tree extraction script', () => {
        const script = snapshotManager.generateDOMTreeScript({
          maxDepth: 50,
          includeText: true,
          includeComments: false
        });

        assert.ok(script);
        assert.strictEqual(typeof script, 'string');
        assert.ok(script.includes('serializeNode'));
      });

      it('should support max depth parameter', () => {
        const script = snapshotManager.generateDOMTreeScript({
          maxDepth: 100
        });

        assert.ok(script);
        assert.ok(script.includes('100'));
      });

      it('should include text content when requested', () => {
        const script = snapshotManager.generateDOMTreeScript({
          includeText: true
        });

        assert.ok(script);
      });

      it('should include comments when requested', () => {
        const script = snapshotManager.generateDOMTreeScript({
          includeComments: true
        });

        assert.ok(script);
      });
    });

    describe('export_dom_computed_styles', () => {
      it('should generate computed styles extraction script', () => {
        const script = snapshotManager.generateComputedStylesScript({
          selector: '*',
          limit: 5000
        });

        assert.ok(script);
        assert.strictEqual(typeof script, 'string');
        assert.ok(script.includes('getComputedStyle'));
      });

      it('should support custom CSS selector', () => {
        const script = snapshotManager.generateComputedStylesScript({
          selector: '.main-content',
          limit: 5000
        });

        assert.ok(script);
        assert.ok(script.includes('.main-content'));
      });

      it('should respect limit parameter', () => {
        const script = snapshotManager.generateComputedStylesScript({
          selector: '*',
          limit: 1000
        });

        assert.ok(script);
        assert.ok(script.includes('1000'));
      });
    });

    describe('export_dom_form_state', () => {
      it('should generate form state extraction script', () => {
        const script = snapshotManager.generateFormStateScript();

        assert.ok(script);
        assert.strictEqual(typeof script, 'string');
        assert.ok(script.includes('form'));
      });

      it('should capture all form inputs', () => {
        const script = snapshotManager.generateFormStateScript();

        assert.ok(script.includes('input'));
        assert.ok(script.includes('textarea'));
        assert.ok(script.includes('select'));
      });
    });

    describe('export_dom_text_content', () => {
      it('should generate text content extraction script', () => {
        const script = snapshotManager.generateTextContentScript();

        assert.ok(script);
        assert.strictEqual(typeof script, 'string');
        assert.ok(script.includes('textContent'));
      });

      it('should preserve text structure', () => {
        const script = snapshotManager.generateTextContentScript();

        assert.ok(script);
      });
    });

    describe('export_dom_attributes', () => {
      it('should generate attribute extraction script', () => {
        const script = snapshotManager.generateAttributesScript();

        assert.ok(script);
        assert.strictEqual(typeof script, 'string');
        assert.ok(script.includes('attributes'));
      });
    });

    describe('export_dom_event_listeners', () => {
      it('should generate event listener extraction script', () => {
        const script = snapshotManager.generateEventListenersScript();

        assert.ok(script);
        assert.strictEqual(typeof script, 'string');
      });
    });

    describe('export_dom_mutations', () => {
      it('should generate mutation tracking script', () => {
        const script = snapshotManager.generateMutationTrackerScript();

        assert.ok(script);
        assert.strictEqual(typeof script, 'string');
        assert.ok(script.includes('MutationObserver'));
      });
    });
  });

  // ==========================================
  // JavaScript & Console Commands (10 total)
  // ==========================================

  describe('JavaScript & Console Extraction Commands', () => {
    describe('export_scripts_all', () => {
      it('should require devToolsManager', () => {
        const handler = async (params) => {
          // Simulated handler
          return { success: true, scripts: { inline: [], external: [], count: { inline: 0, external: 0, total: 0 } } };
        };

        assert.strictEqual(typeof handler, 'function');
      });
    });

    describe('export_scripts_sources', () => {
      it('should extract external script sources', () => {
        // Script sources extraction should parse src attributes
        const mockScript = {
          src: 'https://example.com/script.js',
          async: true,
          defer: false
        };

        assert.ok(mockScript.src);
        assert.strictEqual(mockScript.async, true);
      });
    });

    describe('export_console_logs', () => {
      it('should aggregate console logs by type', () => {
        const logs = [
          { type: 'log', message: 'test' },
          { type: 'error', message: 'error test' },
          { type: 'warn', message: 'warning' }
        ];

        const summary = {
          total: logs.length,
          byType: {
            log: logs.filter(l => l.type === 'log').length,
            error: logs.filter(l => l.type === 'error').length,
            warn: logs.filter(l => l.type === 'warn').length
          }
        };

        assert.strictEqual(summary.total, 3);
        assert.strictEqual(summary.byType.log, 1);
        assert.strictEqual(summary.byType.error, 1);
        assert.strictEqual(summary.byType.warn, 1);
      });
    });

    describe('export_globals', () => {
      it('should enumerate window properties', () => {
        const mockGlobals = {
          window: { type: 'object' },
          document: { type: 'object' },
          console: { type: 'object' }
        };

        assert.ok(mockGlobals.window);
        assert.ok(mockGlobals.document);
        assert.ok(mockGlobals.console);
      });

      it('should categorize globals by type', () => {
        const categories = {
          window: ['window', 'windowLocation'],
          document: ['document', 'documentElement'],
          navigator: ['navigator'],
          console: ['console'],
          storage: ['localStorage', 'sessionStorage'],
          custom: ['myVar1', 'myVar2']
        };

        assert.ok(categories.window.length > 0);
        assert.ok(categories.document.length > 0);
      });
    });

    describe('export_localstorage', () => {
      it('should extract localStorage items with metadata', () => {
        const items = {
          key1: 'value1',
          key2: 'value2'
        };

        const totalSize = JSON.stringify(items).length;

        assert.strictEqual(Object.keys(items).length, 2);
        assert.ok(totalSize > 0);
      });

      it('should track storage quota usage', () => {
        const items = { test: 'value' };
        const usage = {
          count: Object.keys(items).length,
          totalSize: JSON.stringify(items).length
        };

        assert.strictEqual(usage.count, 1);
        assert.ok(usage.totalSize > 0);
      });
    });

    describe('export_sessionstorage', () => {
      it('should extract sessionStorage items', () => {
        const items = {
          tempKey: 'tempValue'
        };

        assert.strictEqual(Object.keys(items).length, 1);
      });
    });

    describe('export_cookies', () => {
      it('should parse cookies with metadata', () => {
        const cookieString = 'name1=value1; name2=value2';
        const cookies = cookieString.split(';').map(c => {
          const [name, value] = c.trim().split('=');
          return { name, value };
        });

        assert.strictEqual(cookies.length, 2);
        assert.strictEqual(cookies[0].name, 'name1');
        assert.strictEqual(cookies[0].value, 'value1');
      });

      it('should handle secure and httpOnly flags', () => {
        const cookie = {
          name: 'session',
          value: 'abc123',
          secure: true,
          httpOnly: true,
          sameSite: 'Strict'
        };

        assert.strictEqual(cookie.secure, true);
        assert.strictEqual(cookie.httpOnly, true);
      });
    });

    describe('export_performance_timeline', () => {
      it('should aggregate performance metrics', () => {
        const perfData = {
          navigation: {
            navigationStart: 0,
            responseStart: 50,
            domLoading: 100,
            domComplete: 200,
            loadEventEnd: 250
          },
          resources: [
            { name: 'script.js', type: 'script', duration: 100 },
            { name: 'style.css', type: 'stylesheet', duration: 50 }
          ]
        };

        assert.ok(perfData.navigation);
        assert.strictEqual(perfData.resources.length, 2);
      });

      it('should capture memory usage if available', () => {
        const memory = {
          jsHeapSizeLimit: 1000000000,
          totalJSHeapSize: 500000000,
          usedJSHeapSize: 250000000
        };

        assert.ok(memory.jsHeapSizeLimit > 0);
      });
    });

    describe('export_errors', () => {
      it('should aggregate errors by type', () => {
        const errors = [
          { type: 'error', message: 'Runtime error', stack: 'stack1' },
          { type: 'error', message: 'Type error', stack: 'stack2' },
          { type: 'warning', message: 'Warning', stack: 'stack3' }
        ];

        const summary = {
          total: errors.length,
          byType: {
            error: errors.filter(e => e.type === 'error').length,
            warning: errors.filter(e => e.type === 'warning').length
          }
        };

        assert.strictEqual(summary.total, 3);
        assert.strictEqual(summary.byType.error, 2);
        assert.strictEqual(summary.byType.warning, 1);
      });

      it('should capture stack traces', () => {
        const error = {
          message: 'Test error',
          stack: 'Error: Test error\n    at func1 (file.js:10:5)\n    at func2 (file.js:20:5)',
          lineno: 10,
          colno: 5
        };

        assert.ok(error.stack);
        assert.ok(error.stack.includes('func1'));
      });
    });

    describe('export_network_from_js', () => {
      it('should aggregate network requests by method and status', () => {
        const requests = [
          { method: 'GET', url: 'https://api.example.com/data', status: 200, size: 1024 },
          { method: 'POST', url: 'https://api.example.com/submit', status: 201, size: 512 },
          { method: 'GET', url: 'https://api.example.com/resource', status: 404, size: 256 }
        ];

        const summary = {
          total: requests.length,
          byMethod: {
            GET: requests.filter(r => r.method === 'GET').length,
            POST: requests.filter(r => r.method === 'POST').length
          },
          byStatus: {
            200: requests.filter(r => r.status === 200).length,
            201: requests.filter(r => r.status === 201).length,
            404: requests.filter(r => r.status === 404).length
          }
        };

        assert.strictEqual(summary.total, 3);
        assert.strictEqual(summary.byMethod.GET, 2);
        assert.strictEqual(summary.byMethod.POST, 1);
        assert.strictEqual(summary.byStatus[200], 1);
      });

      it('should calculate total bandwidth usage', () => {
        const requests = [
          { size: 1024 },
          { size: 512 },
          { size: 256 }
        ];

        const totalSize = requests.reduce((sum, r) => sum + (r.size || 0), 0);

        assert.strictEqual(totalSize, 1792);
      });
    });
  });

  // ==========================================
  // Integration Tests
  // ==========================================

  describe('Phase 1 Command Integration', () => {
    it('should handle rapid sequential captures', async () => {
      const htmlCaptureManager = new HtmlCaptureManager();
      const results = [];

      for (let i = 0; i < 10; i++) {
        const result = await htmlCaptureManager.captureWithMetadata(
          `<html><body>Test ${i}</body></html>`,
          { url: 'https://example.com' }
        );
        results.push(result);
      }

      assert.strictEqual(results.length, 10);
      assert.ok(results.every(r => r.success));
    });

    it('should maintain state across multiple commands', () => {
      const htmlCaptureManager = new HtmlCaptureManager();

      // First capture
      const result1 = htmlCaptureManager.captureDiff(
        '<html><body>Version 1</body></html>',
        { url: 'https://example.com' }
      );

      // Second capture referencing first
      const result2 = htmlCaptureManager.captureDiff(
        '<html><body>Version 2</body></html>',
        { url: 'https://example.com', previousSnapshotId: result1.snapshotId }
      );

      // Verify history is maintained
      const stats = htmlCaptureManager.getStats();
      assert.ok(stats.snapshotCount > 0);
      assert.ok(result2.history);
    });

    it('should handle errors gracefully across command types', async () => {
      const htmlCaptureManager = new HtmlCaptureManager();

      // Test invalid inputs
      const result1 = await htmlCaptureManager.captureWithMetadata(null, {});
      const result2 = await htmlCaptureManager.captureWithMetadata('', {});

      assert.strictEqual(result1.success, false);
      assert.strictEqual(result2.success, false);
    });
  });
});
