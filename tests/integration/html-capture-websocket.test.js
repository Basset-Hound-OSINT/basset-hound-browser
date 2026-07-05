/**
 * HTML Capture WebSocket Integration Tests
 * Tests all 4 HTML capture commands via WebSocket API
 *
 * Commands tested:
 * 1. export_html_with_metadata
 * 2. export_html_formatted
 * 3. export_html_raw
 * 4. export_html_diff
 */

const WebSocket = require('ws');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

class WebSocketClient {
  constructor(url = 'ws://localhost:8765') {
    this.url = url;
    this.ws = null;
    this.messageHandlers = new Map();
    this.nextId = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.on('open', () => resolve());
      this.ws.on('error', reject);
      this.ws.on('message', (data) => this.handleMessage(data));
    });
  }

  async send(command, params = {}) {
    const id = ++this.nextId;
    const message = {
      command,
      params,
      id
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(id);
        reject(new Error(`Command ${command} timeout after 30s`));
      }, 30000);

      this.messageHandlers.set(id, (response) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });

      this.ws.send(JSON.stringify(message));
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      const handler = this.messageHandlers.get(message.id);
      if (handler) {
        handler(message);
        this.messageHandlers.delete(message.id);
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  async close() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

describe('HTML Capture WebSocket Integration', () => {
  let client;
  const testUrl = 'https://example.com/test-page';

  const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="description" content="Test page for HTML capture">
  <meta name="keywords" content="test, html, capture">
  <meta property="og:title" content="Test Page Title">
  <meta property="og:description" content="Test description">
  <title>HTML Capture Test Page</title>
  <link rel="stylesheet" href="https://example.com/style.css">
  <script src="https://example.com/app.js"></script>
</head>
<body>
  <header>
    <h1>Welcome to Test Page</h1>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="https://external.com">External</a>
    </nav>
  </header>
  <main>
    <article>
      <h2>Article Title</h2>
      <p>This is test content for HTML capture testing.</p>
      <img src="https://example.com/image.jpg" alt="Test image">
      <img src="/relative/image.png" alt="Relative image">
    </article>
    <aside>
      <h3>Sidebar</h3>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
      </ul>
    </aside>
  </main>
  <footer>
    <p>&copy; 2024 Example Corp</p>
    <iframe src="https://example.com/embed"></iframe>
    <video src="https://example.com/video.mp4"></video>
    <audio src="https://example.com/audio.mp3"></audio>
  </footer>
</body>
</html>`;

  beforeEach(async () => {
    // Skip if server not running
    const serverRunning = await isServerRunning();
    if (!serverRunning) {
      this.skip();
    }
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
  });

  async function isServerRunning() {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket('ws://localhost:8765');
        ws.on('open', () => {
          ws.close();
          resolve(true);
        });
        ws.on('error', () => resolve(false));
        setTimeout(() => resolve(false), 3000);
      } catch (e) {
        resolve(false);
      }
    });
  }

  describe('export_html_with_metadata command', () => {
    beforeEach(async () => {
      client = new WebSocketClient();
      await client.connect();
    });

    test('should capture HTML with metadata', async () => {
      const response = await client.send('export_html_with_metadata', {
        html: sampleHtml,
        url: testUrl,
        headers: {
          'content-type': 'text/html; charset=UTF-8',
          'server': 'Apache/2.4.41',
          'cache-control': 'max-age=3600'
        }
      });

      assert(response.success, 'Response should be successful');
      assert(response.snapshotId, 'Should generate snapshot ID');
      assert(response.metadata, 'Should include metadata');
      assert.deepStrictEqual(response.metadata.url, testUrl);
    }, 30000);

    test('should extract all meta tags', async () => {
      const response = await client.send('export_html_with_metadata', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      assert(response.metadata.metaTags.length > 0, 'Should extract meta tags');
      const descTag = response.metadata.metaTags.find(t => t.name === 'description');
      assert(descTag, 'Should find description meta tag');
    }, 30000);

    test('should extract all resources', async () => {
      const response = await client.send('export_html_with_metadata', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      assert(response.metadata.resources.scripts.length > 0, 'Should extract scripts');
      assert(response.metadata.resources.stylesheets.length > 0, 'Should extract stylesheets');
      assert(response.metadata.resources.images.length > 0, 'Should extract images');
      assert(response.metadata.resources.iframes.length > 0, 'Should extract iframes');
    }, 30000);

    test('should resolve relative URLs in resources', async () => {
      const response = await client.send('export_html_with_metadata', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      const resources = response.metadata.resources;
      assert(resources.images.some(img => img.includes('example.com')),
        'Should resolve relative URLs to absolute');
    }, 30000);

    test('should support compression', async () => {
      const response = await client.send('export_html_with_metadata', {
        html: sampleHtml,
        url: testUrl,
        compress: true
      });

      assert(response.success);
      assert(response.size.compressed > 0, 'Should compress HTML');
      assert(response.size.compressionRatio > 0, 'Should calculate compression ratio');
      assert(response.htmlCompressed, 'Should return compressed HTML');
    }, 30000);

    test('should include formatted HTML when requested', async () => {
      const response = await client.send('export_html_with_metadata', {
        html: sampleHtml,
        url: testUrl,
        includeFormatted: true
      });

      assert(response.success);
      assert(response.formatted, 'Should include formatted HTML');
      assert(response.formatted.length > 0);
    }, 30000);

    test('should handle missing headers gracefully', async () => {
      const response = await client.send('export_html_with_metadata', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      assert(response.metadata.serverHeader, 'Should have default server header');
    }, 30000);
  });

  describe('export_html_formatted command', () => {
    beforeEach(async () => {
      client = new WebSocketClient();
      await client.connect();
    });

    test('should return formatted HTML', async () => {
      const response = await client.send('export_html_formatted', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      assert(response.html, 'Should return formatted HTML');
      assert(response.html.includes('\n'), 'Should have line breaks');
    }, 30000);

    test('should preserve all content', async () => {
      const response = await client.send('export_html_formatted', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      assert(response.html.includes('Welcome to Test Page'), 'Should preserve text content');
      assert(response.html.includes('<h1>'), 'Should preserve HTML tags');
    }, 30000);

    test('should respect custom indent size', async () => {
      const response = await client.send('export_html_formatted', {
        html: '<html><body><p>Test</p></body></html>',
        url: testUrl,
        indentSize: 4
      });

      assert(response.success);
      assert(response.metadata.indentSize === 4);
    }, 30000);

    test('should generate snapshot ID', async () => {
      const response = await client.send('export_html_formatted', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      assert(response.snapshotId, 'Should generate snapshot ID');
    }, 30000);

    test('should include size information', async () => {
      const response = await client.send('export_html_formatted', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      assert(response.metadata.originalSize === sampleHtml.length);
      assert(response.metadata.formattedSize > 0);
    }, 30000);

    test('should handle large HTML', async () => {
      const largeHtml = sampleHtml + '\n<!-- '.repeat(1000) + ' -->';
      const response = await client.send('export_html_formatted', {
        html: largeHtml,
        url: testUrl
      });

      assert(response.success);
      assert(response.html.length > 0);
    }, 30000);
  });

  describe('export_html_raw command', () => {
    beforeEach(async () => {
      client = new WebSocketClient();
      await client.connect();
    });

    test('should return exact raw HTML', async () => {
      const response = await client.send('export_html_raw', {
        html: sampleHtml,
        url: testUrl,
        statusCode: 200
      });

      assert(response.success);
      assert.deepStrictEqual(response.html, sampleHtml, 'Should return exact HTML');
    }, 30000);

    test('should calculate SHA256 hash', async () => {
      const response = await client.send('export_html_raw', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      assert(response.bytes.sha256, 'Should include SHA256 hash');
      assert(/^[a-f0-9]{64}$/.test(response.bytes.sha256), 'Hash should be valid SHA256');
    }, 30000);

    test('should calculate MD5 hash', async () => {
      const response = await client.send('export_html_raw', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      assert(response.bytes.md5, 'Should include MD5 hash');
      assert(/^[a-f0-9]{32}$/.test(response.bytes.md5), 'Hash should be valid MD5');
    }, 30000);

    test('should include response information', async () => {
      const response = await client.send('export_html_raw', {
        html: sampleHtml,
        url: testUrl,
        statusCode: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html',
          'server': 'Test/1.0'
        }
      });

      assert(response.success);
      assert.deepStrictEqual(response.response.statusCode, 200);
      assert.deepStrictEqual(response.response.statusText, 'OK');
      assert(response.response.headers['server'] === 'Test/1.0');
    }, 30000);

    test('should track response timing', async () => {
      const response = await client.send('export_html_raw', {
        html: sampleHtml,
        url: testUrl,
        fetchStart: 1000,
        fetchEnd: 1500,
        duration: 500
      });

      assert(response.success);
      assert.deepStrictEqual(response.response.timing.duration, 500);
    }, 30000);

    test('should handle different status codes', async () => {
      const response404 = await client.send('export_html_raw', {
        html: '<html><body>Not Found</body></html>',
        url: testUrl,
        statusCode: 404,
        statusText: 'Not Found'
      });

      assert(response404.success);
      assert.deepStrictEqual(response404.response.statusCode, 404);
    }, 30000);

    test('should calculate byte size', async () => {
      const response = await client.send('export_html_raw', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      assert(response.bytes.raw > 0);
    }, 30000);
  });

  describe('export_html_diff command', () => {
    beforeEach(async () => {
      client = new WebSocketClient();
      await client.connect();
    });

    test('should generate snapshot ID', async () => {
      const response = await client.send('export_html_diff', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      assert(response.snapshotId);
    }, 30000);

    test('should track current size', async () => {
      const response = await client.send('export_html_diff', {
        html: sampleHtml,
        url: testUrl
      });

      assert(response.success);
      assert.deepStrictEqual(response.current.size, sampleHtml.length);
    }, 30000);

    test('should handle first capture without previous', async () => {
      const response = await client.send('export_html_diff', {
        html: sampleHtml,
        url: testUrl + '/first'
      });

      assert(response.success);
      assert(response.previous === null, 'First capture should have no previous');
    }, 30000);

    test('should detect size changes', async () => {
      // First capture
      await client.send('export_html_diff', {
        html: sampleHtml,
        url: testUrl + '/change'
      });

      // Second capture with different size
      const response = await client.send('export_html_diff', {
        html: sampleHtml + '<!-- extra content -->',
        url: testUrl + '/change'
      });

      assert(response.success);
      assert(response.changes.sizeChanged === true, 'Should detect size change');
      assert(response.changes.sizeChange > 0, 'Size increase should be positive');
    }, 30000);

    test('should detect hash changes', async () => {
      // First capture
      await client.send('export_html_diff', {
        html: sampleHtml,
        url: testUrl + '/hash'
      });

      // Second capture with different content
      const response = await client.send('export_html_diff', {
        html: sampleHtml + '<!-- modified -->',
        url: testUrl + '/hash'
      });

      assert(response.success);
      assert(response.changes.hashChanged === true, 'Should detect hash change');
    }, 30000);

    test('should calculate size change percentage', async () => {
      // Setup: First capture
      await client.send('export_html_diff', {
        html: sampleHtml,
        url: testUrl + '/percent'
      });

      // Second capture
      const response = await client.send('export_html_diff', {
        html: sampleHtml + ' <-- 100 bytes added'.repeat(5),
        url: testUrl + '/percent'
      });

      assert(response.success);
      assert(response.changes.sizeChangePercent, 'Should calculate change percentage');
      assert(parseFloat(response.changes.sizeChangePercent) > 0);
    }, 30000);

    test('should optionally include full HTML', async () => {
      // Without HTML
      const responseWithout = await client.send('export_html_diff', {
        html: sampleHtml,
        url: testUrl + '/nofull',
        includeFullHtml: false
      });

      assert(response.success);
      assert(!responseWithout.html, 'Should not include HTML when not requested');

      // With HTML
      const responseWith = await client.send('export_html_diff', {
        html: sampleHtml,
        url: testUrl + '/withfull',
        includeFullHtml: true
      });

      assert(responseWith.success);
      assert.deepStrictEqual(responseWith.html, sampleHtml);
    }, 30000);

    test('should track snapshot history', async () => {
      const url = testUrl + '/history';

      // Capture multiple versions
      for (let i = 0; i < 3; i++) {
        await client.send('export_html_diff', {
          html: sampleHtml + `<!-- version ${i} -->`,
          url: url
        });
      }

      const response = await client.send('export_html_diff', {
        html: sampleHtml + '<!-- version 3 -->',
        url: url
      });

      assert(response.success);
      assert(response.history.length > 0, 'Should track history');
      assert(Array.isArray(response.history));
    }, 30000);

    test('should include previous snapshot info when available', async () => {
      const url = testUrl + '/previnfo';

      // First capture
      const first = await client.send('export_html_diff', {
        html: sampleHtml,
        url: url
      });

      // Second capture
      const second = await client.send('export_html_diff', {
        html: sampleHtml + '<!-- modified -->',
        url: url
      });

      assert(second.success);
      assert(second.previous, 'Should include previous snapshot info');
      assert.deepStrictEqual(second.previous.snapshotId, first.snapshotId);
    }, 30000);
  });

  describe('Command integration scenarios', () => {
    beforeEach(async () => {
      client = new WebSocketClient();
      await client.connect();
    });

    test('should handle all 4 commands in sequence', async () => {
      const baseUrl = testUrl + '/sequence';

      // 1. With metadata
      const meta = await client.send('export_html_with_metadata', {
        html: sampleHtml,
        url: baseUrl
      });
      assert(meta.success);

      // 2. Formatted
      const fmt = await client.send('export_html_formatted', {
        html: sampleHtml,
        url: baseUrl
      });
      assert(fmt.success);

      // 3. Raw
      const raw = await client.send('export_html_raw', {
        html: sampleHtml,
        url: baseUrl
      });
      assert(raw.success);

      // 4. Diff
      const diff = await client.send('export_html_diff', {
        html: sampleHtml,
        url: baseUrl
      });
      assert(diff.success);
    }, 60000);

    test('should use same snapshot ID for identical content', async () => {
      const url = testUrl + '/sameid';

      const resp1 = await client.send('export_html_with_metadata', {
        html: sampleHtml,
        url: url
      });

      const resp2 = await client.send('export_html_formatted', {
        html: sampleHtml,
        url: url
      });

      assert.deepStrictEqual(resp1.snapshotId, resp2.snapshotId,
        'Should generate same ID for identical content');
    }, 30000);

    test('should generate different snapshot IDs for different content', async () => {
      const url = testUrl + '/diffid';

      const resp1 = await client.send('export_html_with_metadata', {
        html: sampleHtml,
        url: url
      });

      const resp2 = await client.send('export_html_with_metadata', {
        html: sampleHtml + '<!-- different -->',
        url: url
      });

      assert.notDeepStrictEqual(resp1.snapshotId, resp2.snapshotId,
        'Should generate different IDs for different content');
    }, 30000);
  });

  describe('Error handling', () => {
    beforeEach(async () => {
      client = new WebSocketClient();
      await client.connect();
    });

    test('should handle empty HTML', async () => {
      const response = await client.send('export_html_with_metadata', {
        html: '',
        url: testUrl
      });

      // Should still succeed but with empty content
      assert(response.success || response.error);
    }, 30000);

    test('should handle missing URL parameter gracefully', async () => {
      const response = await client.send('export_html_with_metadata', {
        html: sampleHtml
        // No URL provided
      });

      // Should handle gracefully (error or success)
      assert(response.success !== undefined);
    }, 30000);

    test('should handle very large HTML', async () => {
      const largeHtml = sampleHtml.repeat(100); // ~100KB

      const response = await client.send('export_html_with_metadata', {
        html: largeHtml,
        url: testUrl
      });

      assert(response.success || response.error);
    }, 30000);

    test('should handle malformed HTML', async () => {
      const malformedHtml = '<html><body><p>Unclosed paragraph<div>Unclosed div</body></html>';

      const response = await client.send('export_html_formatted', {
        html: malformedHtml,
        url: testUrl
      });

      // Should still process malformed HTML
      assert(response.success || response.error);
    }, 30000);
  });
});
