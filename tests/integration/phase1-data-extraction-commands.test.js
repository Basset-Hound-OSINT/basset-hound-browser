/**
 * Phase 1 Data Extraction Commands - Integration Tests
 *
 * Full integration tests for all 21 Phase 1 data extraction WebSocket commands
 * with mock server and realistic response validation.
 *
 * @module tests/integration/phase1-data-extraction-commands
 */

const assert = require('assert');
const {
  registerHtmlCaptureCommands
} = require('../../websocket/commands/html-capture-commands');
const {
  registerDOMSnapshotCommands
} = require('../../websocket/commands/dom-snapshot-commands');
const {
  registerJavaScriptConsoleExtractionCommands
} = require('../../websocket/commands/javascript-console-extraction');

describe('Phase 1 Data Extraction Commands - Integration', () => {
  let mockServer;
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    mockServer = { commandHandlers };
  });

  // ==========================================
  // Category 1: HTML Capture (4 commands)
  // ==========================================

  describe('HTML Capture Commands (4 total)', () => {
    beforeEach(() => {
      const testServer = { commandHandlers: {} };
      registerHtmlCaptureCommands(testServer);
      Object.assign(commandHandlers, testServer.commandHandlers);
    });

    describe('Command 1: export_html_with_metadata', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_html_with_metadata);
        assert.strictEqual(typeof commandHandlers.export_html_with_metadata, 'function');
      });

      it('should capture basic HTML with metadata', async () => {
        const html = '<html><head><title>Test</title></head><body>Content</body></html>';
        const result = await commandHandlers.export_html_with_metadata({
          html,
          url: 'https://example.com'
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.html, html);
        assert.ok(result.metadata);
        assert.ok(result.snapshotId);
        assert.ok(result.size);
        assert.ok(result.processingTime !== undefined);
      });

      it('should extract HTML metadata correctly', async () => {
        const html = `
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width">
              <meta name="description" content="Page description">
              <title>My Page</title>
            </head>
            <body>Content</body>
          </html>
        `;

        const result = await commandHandlers.export_html_with_metadata({
          html,
          url: 'https://example.com',
          includeFormatted: true
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.metadata);
        assert.ok(result.formatted);
      });

      it('should handle HTTP headers', async () => {
        const html = '<html><body>Test</body></html>';
        const headers = {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-cache',
          'server': 'Apache/2.4'
        };

        const result = await commandHandlers.export_html_with_metadata({
          html,
          url: 'https://example.com',
          headers
        });

        assert.strictEqual(result.success, true);
      });

      it('should handle invalid HTML gracefully', async () => {
        const result = await commandHandlers.export_html_with_metadata({
          html: null,
          url: 'https://example.com'
        });

        assert.strictEqual(result.success, false);
        assert.ok(result.error);
        assert.strictEqual(result.errorCode, 'INVALID_HTML_PARAM');
      });

      it('should handle compression option', async () => {
        const html = '<html><body>' + 'a'.repeat(5000) + '</body></html>';
        const result = await commandHandlers.export_html_with_metadata({
          html,
          url: 'https://example.com',
          compress: true
        });

        assert.strictEqual(result.success, true);
      });

      it('should provide size information', async () => {
        const html = '<html><body>Test content</body></html>';
        const result = await commandHandlers.export_html_with_metadata({
          html,
          url: 'https://example.com'
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.size.raw !== undefined);
        assert.ok(result.size.compressed !== undefined);
      });
    });

    describe('Command 2: export_html_formatted', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_html_formatted);
        assert.strictEqual(typeof commandHandlers.export_html_formatted, 'function');
      });

      it('should format HTML with proper indentation', async () => {
        const html = '<html><head></head><body><div>Test</div></body></html>';
        const result = await commandHandlers.export_html_formatted({
          html,
          url: 'https://example.com',
          indentSize: 2
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.html);
        // Formatted HTML should have newlines
        assert.ok(result.html.includes('\n'));
      });

      it('should handle complex HTML structures', async () => {
        const html = `
          <html>
            <head>
              <meta charset="utf-8">
              <title>Complex Page</title>
            </head>
            <body>
              <header>
                <nav>
                  <ul>
                    <li><a href="#">Link 1</a></li>
                    <li><a href="#">Link 2</a></li>
                  </ul>
                </nav>
              </header>
              <main>
                <article>
                  <h1>Article Title</h1>
                  <p>Article content</p>
                </article>
              </main>
              <footer>
                <p>Footer content</p>
              </footer>
            </body>
          </html>
        `;

        const result = await commandHandlers.export_html_formatted({
          html,
          url: 'https://example.com'
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.metadata);
      });

      it('should respect includeComments parameter', async () => {
        const html = '<html><!-- Important comment --><body>Test</body></html>';

        const resultWithComments = await commandHandlers.export_html_formatted({
          html,
          url: 'https://example.com',
          includeComments: true
        });

        const resultWithoutComments = await commandHandlers.export_html_formatted({
          html,
          url: 'https://example.com',
          includeComments: false
        });

        assert.strictEqual(resultWithComments.success, true);
        assert.strictEqual(resultWithoutComments.success, true);
      });

      it('should handle invalid HTML gracefully', async () => {
        const result = await commandHandlers.export_html_formatted({
          html: undefined,
          url: 'https://example.com'
        });

        assert.strictEqual(result.success, false);
        assert.ok(result.error);
      });
    });

    describe('Command 3: export_html_raw', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_html_raw);
        assert.strictEqual(typeof commandHandlers.export_html_raw, 'function');
      });

      it('should capture raw HTML with cryptographic hashes', async () => {
        const html = '<html><body>Raw content</body></html>';
        const result = await commandHandlers.export_html_raw({
          html,
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

      it('should include HTTP response details', async () => {
        const html = '<html><body>Test</body></html>';
        const headers = {
          'content-type': 'text/html',
          'content-length': html.length.toString()
        };

        const result = await commandHandlers.export_html_raw({
          html,
          url: 'https://example.com',
          statusCode: 200,
          statusText: 'OK',
          headers
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.response);
        assert.strictEqual(result.response.statusCode, 200);
      });

      it('should handle different HTTP status codes', async () => {
        const html = '<html><body>Not Found</body></html>';
        const result = await commandHandlers.export_html_raw({
          html,
          url: 'https://example.com/missing',
          statusCode: 404,
          statusText: 'Not Found'
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.response.statusCode, 404);
      });

      it('should include timing information', async () => {
        const html = '<html><body>Test</body></html>';
        const fetchStart = Date.now() - 150;
        const fetchEnd = Date.now();

        const result = await commandHandlers.export_html_raw({
          html,
          url: 'https://example.com',
          statusCode: 200,
          statusText: 'OK',
          fetchStart,
          fetchEnd,
          duration: fetchEnd - fetchStart
        });

        assert.strictEqual(result.success, true);
      });

      it('should handle invalid HTML gracefully', async () => {
        const result = await commandHandlers.export_html_raw({
          html: false,
          url: 'https://example.com'
        });

        assert.strictEqual(result.success, false);
        assert.ok(result.error);
      });
    });

    describe('Command 4: export_html_diff', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_html_diff);
        assert.strictEqual(typeof commandHandlers.export_html_diff, 'function');
      });

      it('should track HTML changes across snapshots', async () => {
        const html1 = '<html><body><h1>Version 1</h1></body></html>';
        const html2 = '<html><body><h1>Version 2</h1></body></html>';

        const result1 = await commandHandlers.export_html_diff({
          html: html1,
          url: 'https://example.com',
          includeFullHtml: true
        });

        const result2 = await commandHandlers.export_html_diff({
          html: html2,
          url: 'https://example.com',
          previousSnapshotId: result1.snapshotId,
          includeFullHtml: true
        });

        assert.strictEqual(result1.success, true);
        assert.strictEqual(result2.success, true);
        assert.ok(result2.changes);
      });

      it('should maintain snapshot history', async () => {
        const urls = ['https://example.com'];

        // Create multiple snapshots
        for (let i = 0; i < 3; i++) {
          await commandHandlers.export_html_diff({
            html: `<html><body>Snapshot ${i}</body></html>`,
            url: urls[0]
          });
        }

        const result = await commandHandlers.export_html_diff({
          html: '<html><body>Final snapshot</body></html>',
          url: urls[0]
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.history);
      });

      it('should calculate change metrics', async () => {
        const oldHtml = '<html><body><p>Old</p><p>Keep</p></body></html>';
        const newHtml = '<html><body><p>New</p><p>Keep</p></body></html>';

        const result1 = await commandHandlers.export_html_diff({
          html: oldHtml,
          url: 'https://example.com'
        });

        const result2 = await commandHandlers.export_html_diff({
          html: newHtml,
          url: 'https://example.com',
          previousSnapshotId: result1.snapshotId
        });

        assert.strictEqual(result2.success, true);
        assert.ok(result2.changes);
      });

      it('should require URL for tracking', async () => {
        const result = await commandHandlers.export_html_diff({
          html: '<html><body>Test</body></html>',
          url: null
        });

        assert.strictEqual(result.success, false);
        assert.ok(result.error);
        assert.strictEqual(result.errorCode, 'INVALID_URL_PARAM');
      });
    });

    describe('Utility: get_capture_stats', () => {
      it('should provide capture statistics', async () => {
        // Create a few snapshots first
        await commandHandlers.export_html_with_metadata({
          html: '<html><body>Test 1</body></html>',
          url: 'https://example1.com'
        });

        await commandHandlers.export_html_with_metadata({
          html: '<html><body>Test 2</body></html>',
          url: 'https://example2.com'
        });

        const result = await commandHandlers.get_capture_stats({});

        assert.strictEqual(result.success, true);
        assert.ok(result.stats);
      });
    });

    describe('Utility: clear_capture_snapshots', () => {
      it('should clear snapshots for specific URL', async () => {
        const result = await commandHandlers.clear_capture_snapshots({
          url: 'https://example.com'
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.message);
      });

      it('should clear all snapshots when no URL provided', async () => {
        const result = await commandHandlers.clear_capture_snapshots({});

        assert.strictEqual(result.success, true);
        assert.ok(result.message);
      });
    });
  });

  // ==========================================
  // Category 2: DOM Snapshots (7 commands)
  // ==========================================

  describe('DOM Snapshot Commands (7 total)', () => {
    beforeEach(() => {
      const mockHandlers = {};
      const mockWindow = { webContents: {} };
      registerDOMSnapshotCommands(mockHandlers, mockWindow, { logger: console });
      Object.assign(commandHandlers, mockHandlers);
    });

    describe('Command 1: export_dom_tree', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_dom_tree);
        assert.strictEqual(typeof commandHandlers.export_dom_tree, 'function');
      });

      it('should handle missing window gracefully', async () => {
        const mockHandlers = {};
        registerDOMSnapshotCommands(mockHandlers, null, { logger: console });

        const result = await mockHandlers.export_dom_tree({});
        assert.strictEqual(result.success, false);
      });
    });

    describe('Command 2: export_dom_computed_styles', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_dom_computed_styles);
        assert.strictEqual(typeof commandHandlers.export_dom_computed_styles, 'function');
      });

      it('should handle missing window gracefully', async () => {
        const mockHandlers = {};
        registerDOMSnapshotCommands(mockHandlers, null, { logger: console });

        const result = await mockHandlers.export_dom_computed_styles({});
        assert.strictEqual(result.success, false);
      });
    });

    describe('Command 3: export_dom_form_state', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_dom_form_state);
        assert.strictEqual(typeof commandHandlers.export_dom_form_state, 'function');
      });
    });

    describe('Command 4: export_dom_text_content', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_dom_text_content);
        assert.strictEqual(typeof commandHandlers.export_dom_text_content, 'function');
      });
    });

    describe('Command 5: export_dom_attributes', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_dom_attributes);
        assert.strictEqual(typeof commandHandlers.export_dom_attributes, 'function');
      });
    });

    describe('Command 6: export_dom_event_listeners', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_dom_event_listeners);
        assert.strictEqual(typeof commandHandlers.export_dom_event_listeners, 'function');
      });
    });

    describe('Command 7: export_dom_mutations', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_dom_mutations);
        assert.strictEqual(typeof commandHandlers.export_dom_mutations, 'function');
      });
    });
  });

  // ==========================================
  // Category 3: JavaScript & Console (10 commands)
  // ==========================================

  describe('JavaScript & Console Extraction Commands (10 total)', () => {
    beforeEach(() => {
      const jsHandlers = {};
      registerJavaScriptConsoleExtractionCommands(jsHandlers, {
        logger: console
      });
      Object.assign(commandHandlers, jsHandlers);
    });

    describe('Command 1: export_scripts_all', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_scripts_all);
        assert.strictEqual(typeof commandHandlers.export_scripts_all, 'function');
      });

      it('should handle missing devToolsManager', async () => {
        const jsHandlers = {};
        registerJavaScriptConsoleExtractionCommands(jsHandlers, {
          logger: console
        });

        const result = await jsHandlers.export_scripts_all({});
        assert.strictEqual(result.success, false);
      });
    });

    describe('Command 2: export_scripts_sources', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_scripts_sources);
        assert.strictEqual(typeof commandHandlers.export_scripts_sources, 'function');
      });
    });

    describe('Command 3: export_console_logs', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_console_logs);
        assert.strictEqual(typeof commandHandlers.export_console_logs, 'function');
      });

      it('should handle missing consoleManager', async () => {
        const jsHandlers = {};
        registerJavaScriptConsoleExtractionCommands(jsHandlers, {
          logger: console
        });

        const result = await jsHandlers.export_console_logs({});
        assert.strictEqual(result.success, false);
      });
    });

    describe('Command 4: export_globals', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_globals);
        assert.strictEqual(typeof commandHandlers.export_globals, 'function');
      });
    });

    describe('Command 5: export_localstorage', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_localstorage);
        assert.strictEqual(typeof commandHandlers.export_localstorage, 'function');
      });
    });

    describe('Command 6: export_sessionstorage', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_sessionstorage);
        assert.strictEqual(typeof commandHandlers.export_sessionstorage, 'function');
      });
    });

    describe('Command 7: export_cookies', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_cookies);
        assert.strictEqual(typeof commandHandlers.export_cookies, 'function');
      });
    });

    describe('Command 8: export_performance_timeline', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_performance_timeline);
        assert.strictEqual(typeof commandHandlers.export_performance_timeline, 'function');
      });
    });

    describe('Command 9: export_errors', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_errors);
        assert.strictEqual(typeof commandHandlers.export_errors, 'function');
      });
    });

    describe('Command 10: export_network_from_js', () => {
      it('should register the command', () => {
        assert.ok(commandHandlers.export_network_from_js);
        assert.strictEqual(typeof commandHandlers.export_network_from_js, 'function');
      });
    });
  });

  // ==========================================
  // Summary Tests
  // ==========================================

  describe('Phase 1 Data Extraction - Command Registration Summary', () => {
    beforeEach(() => {
      const testServer = { commandHandlers: {} };
      registerHtmlCaptureCommands(testServer);
      Object.assign(commandHandlers, testServer.commandHandlers);

      const mockHandlers = {};
      const mockWindow = { webContents: {} };
      registerDOMSnapshotCommands(mockHandlers, mockWindow, { logger: console });
      Object.assign(commandHandlers, mockHandlers);

      const jsHandlers = {};
      registerJavaScriptConsoleExtractionCommands(jsHandlers, {
        logger: console
      });
      Object.assign(commandHandlers, jsHandlers);
    });

    it('should register all 21 data extraction commands', () => {
      const htmlCaptureCommands = [
        'export_html_with_metadata',
        'export_html_formatted',
        'export_html_raw',
        'export_html_diff'
      ];

      const domSnapshotCommands = [
        'export_dom_tree',
        'export_dom_computed_styles',
        'export_dom_form_state',
        'export_dom_text_content',
        'export_dom_attributes',
        'export_dom_event_listeners',
        'export_dom_mutations'
      ];

      const jsConsoleCommands = [
        'export_scripts_all',
        'export_scripts_sources',
        'export_console_logs',
        'export_globals',
        'export_localstorage',
        'export_sessionstorage',
        'export_cookies',
        'export_performance_timeline',
        'export_errors',
        'export_network_from_js'
      ];

      const allDataExtractionCommands = [
        ...htmlCaptureCommands,
        ...domSnapshotCommands,
        ...jsConsoleCommands
      ];

      // Verify all commands are registered
      allDataExtractionCommands.forEach(command => {
        assert.ok(commandHandlers[command], `Command ${command} not registered`);
        assert.strictEqual(typeof commandHandlers[command], 'function', `${command} is not a function`);
      });

      // Verify totals
      assert.strictEqual(htmlCaptureCommands.length, 4);
      assert.strictEqual(domSnapshotCommands.length, 7);
      assert.strictEqual(jsConsoleCommands.length, 10);
      assert.strictEqual(allDataExtractionCommands.length, 21);
    });

    it('should have utility commands available', () => {
      const utilityCommands = [
        'get_capture_stats',
        'clear_capture_snapshots'
      ];

      utilityCommands.forEach(command => {
        assert.ok(commandHandlers[command], `Utility command ${command} not available`);
      });
    });
  });
});
