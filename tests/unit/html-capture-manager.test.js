/**
 * HTML Capture Manager Unit Tests
 * Tests all 4 HTML capture modes with comprehensive scenarios
 */

const { HtmlCaptureManager } = require('../../extraction/html-capture-manager');

describe('HtmlCaptureManager', () => {
  let manager;

  const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="description" content="Test page">
  <meta property="og:title" content="Test">
  <title>Test Page</title>
  <link rel="stylesheet" href="/style.css">
  <script src="/app.js"></script>
</head>
<body>
  <h1>Welcome</h1>
  <img src="/image.jpg" alt="Test image">
  <iframe src="/iframe.html"></iframe>
  <p>Content here</p>
</body>
</html>`;

  const sampleHeaders = {
    'content-type': 'text/html; charset=UTF-8',
    'server': 'Apache/2.4.41',
    'cache-control': 'max-age=3600',
    'etag': '"abc123"',
    'last-modified': 'Mon, 01 Jan 2024 12:00:00 GMT'
  };

  const sampleUrl = 'https://example.com/page';

  beforeEach(() => {
    manager = new HtmlCaptureManager();
  });

  describe('initialization', () => {
    test('should initialize with empty stats', () => {
      expect(manager.stats).toBeDefined();
      expect(manager.stats.totalCaptures).toBe(0);
      expect(manager.stats.metadataCaptures).toBe(0);
    });

    test('should initialize with snapshot storage', () => {
      expect(manager.snapshots).toBeDefined();
      expect(manager.snapshots.size).toBe(0);
    });
  });

  describe('metadata extraction', () => {
    test('should extract charset from meta tag', () => {
      const metadata = manager.extractMetadata(sampleHtml, {}, sampleUrl);
      expect(metadata.charset).toBe('UTF-8');
    });

    test('should extract charset from headers', () => {
      const metadata = manager.extractMetadata(sampleHtml, sampleHeaders, sampleUrl);
      expect(metadata.charset).toBe('UTF-8');
    });

    test('should extract language attribute', () => {
      const metadata = manager.extractMetadata(sampleHtml, {}, sampleUrl);
      expect(metadata.language).toBe('en');
    });

    test('should extract DOCTYPE', () => {
      const metadata = manager.extractMetadata(sampleHtml, {}, sampleUrl);
      expect(metadata.doctype).toBe('html');
    });

    test('should extract server header', () => {
      const metadata = manager.extractMetadata(sampleHtml, sampleHeaders, sampleUrl);
      expect(metadata.serverHeader).toContain('Apache');
    });

    test('should extract all meta tags', () => {
      const metadata = manager.extractMetadata(sampleHtml, {}, sampleUrl);
      expect(metadata.metaTags.length).toBeGreaterThan(0);
      expect(metadata.metaTags.some(tag => tag.name === 'description')).toBe(true);
    });

    test('should extract resources', () => {
      const metadata = manager.extractMetadata(sampleHtml, {}, sampleUrl);
      expect(metadata.resources.stylesheets.length).toBeGreaterThan(0);
      expect(metadata.resources.scripts.length).toBeGreaterThan(0);
      expect(metadata.resources.images.length).toBeGreaterThan(0);
      expect(metadata.resources.iframes.length).toBeGreaterThan(0);
    });

    test('should resolve relative URLs', () => {
      const metadata = manager.extractMetadata(sampleHtml, {}, sampleUrl);
      expect(metadata.resources.stylesheets[0]).toContain('example.com');
      expect(metadata.resources.stylesheets[0]).toMatch(/^https?:\/\//);
    });

    test('should extract content length', () => {
      const metadata = manager.extractMetadata(sampleHtml, {}, sampleUrl);
      expect(metadata.contentLength).toBe(sampleHtml.length);
    });

    test('should set timestamp', () => {
      const metadata = manager.extractMetadata(sampleHtml, {}, sampleUrl);
      expect(metadata.timestamp).toBeDefined();
      expect(new Date(metadata.timestamp)).toBeInstanceOf(Date);
    });

    test('should default charset to UTF-8 when not found', () => {
      const html = '<html><body>Test</body></html>';
      const metadata = manager.extractMetadata(html, {}, sampleUrl);
      expect(metadata.charset).toBe('utf-8');
    });

    test('should default language to unknown when not found', () => {
      const html = '<html><body>Test</body></html>';
      const metadata = manager.extractMetadata(html, {}, sampleUrl);
      expect(metadata.language).toBe('unknown');
    });
  });

  describe('snapshot ID generation', () => {
    test('should generate unique IDs for different content', () => {
      const id1 = manager.generateSnapshotId(sampleUrl, sampleHtml);
      const id2 = manager.generateSnapshotId(sampleUrl, sampleHtml + '<!-- different -->');
      expect(id1).not.toBe(id2);
    });

    test('should generate same ID for identical content', () => {
      const id1 = manager.generateSnapshotId(sampleUrl, sampleHtml);
      const id2 = manager.generateSnapshotId(sampleUrl, sampleHtml);
      expect(id1).toBe(id2);
    });

    test('should return consistent format', () => {
      const id = manager.generateSnapshotId(sampleUrl, sampleHtml);
      expect(id).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('HTML formatting', () => {
    test('should format HTML with indentation', () => {
      const formatted = manager.formatHtml('<html><body><p>Text</p></body></html>', { indentSize: 2 });
      expect(formatted).toContain('\n');
      expect(formatted.split('\n').length).toBeGreaterThan(1);
    });

    test('should respect custom indent size', () => {
      const formatted = manager.formatHtml('<html><body></body></html>', { indentSize: 4 });
      const lines = formatted.split('\n');
      const indentedLine = lines.find(l => l.startsWith('    ')); // 4 spaces
      expect(indentedLine).toBeDefined();
    });

    test('should handle nested tags', () => {
      const html = '<div><ul><li>Item</li></ul></div>';
      const formatted = manager.formatHtml(html, { indentSize: 2 });
      expect(formatted).toContain('  ');
    });

    test('should preserve text content', () => {
      const html = '<p>Hello World</p>';
      const formatted = manager.formatHtml(html);
      expect(formatted).toContain('Hello World');
    });

    test('should handle self-closing tags', () => {
      const html = '<br><img src="test.jpg"><input type="text">';
      const formatted = manager.formatHtml(html);
      expect(formatted.includes('br') || formatted.includes('img')).toBe(true);
    });

    test('should extract tag names correctly', () => {
      expect(manager.extractTagName('<div>')).toBe('div');
      expect(manager.extractTagName('</span>')).toBe('span');
      expect(manager.extractTagName('<img />')).toBe('img');
    });
  });

  describe('URL resolution', () => {
    test('should keep absolute URLs unchanged', () => {
      const url = manager.resolveUrl('https://other.com/path', sampleUrl);
      expect(url).toBe('https://other.com/path');
    });

    test('should resolve root-relative URLs', () => {
      const url = manager.resolveUrl('/path/file.js', sampleUrl);
      expect(url).toBe('https://example.com/path/file.js');
    });

    test('should resolve relative URLs', () => {
      const url = manager.resolveUrl('../style.css', 'https://example.com/dir/page.html');
      expect(url).toContain('example.com');
    });

    test('should handle protocol-relative URLs', () => {
      const url = manager.resolveUrl('//cdn.example.com/file.js', sampleUrl);
      expect(url).toContain('cdn.example.com');
    });

    test('should preserve special URLs', () => {
      expect(manager.resolveUrl('javascript:void(0)', sampleUrl)).toBe('javascript:void(0)');
      expect(manager.resolveUrl('mailto:test@example.com', sampleUrl)).toBe('mailto:test@example.com');
      expect(manager.resolveUrl('data:image/png;base64,...', sampleUrl)).toContain('data:');
    });

    test('should handle empty base URL', () => {
      const url = manager.resolveUrl('/path', '');
      expect(url).toBe('/path');
    });
  });

  describe('captureWithMetadata', () => {
    test('should return success result', async () => {
      const result = await manager.captureWithMetadata(sampleHtml, {
        url: sampleUrl,
        headers: sampleHeaders
      });
      expect(result.success).toBe(true);
    });

    test('should include metadata', async () => {
      const result = await manager.captureWithMetadata(sampleHtml, {
        url: sampleUrl,
        headers: sampleHeaders
      });
      expect(result.metadata).toBeDefined();
      expect(result.metadata.url).toBe(sampleUrl);
    });

    test('should generate snapshot ID', async () => {
      const result = await manager.captureWithMetadata(sampleHtml, { url: sampleUrl });
      expect(result.snapshotId).toBeDefined();
      expect(result.snapshotId).toMatch(/^[a-f0-9]{16}$/);
    });

    test('should track statistics', async () => {
      await manager.captureWithMetadata(sampleHtml, { url: sampleUrl });
      expect(manager.stats.metadataCaptures).toBe(1);
      expect(manager.stats.totalCaptures).toBe(1);
    });

    test('should optionally include formatted HTML', async () => {
      const result = await manager.captureWithMetadata(sampleHtml, {
        url: sampleUrl,
        includeFormatted: true
      });
      expect(result.formatted).toBeDefined();
    });

    test('should support compression', async () => {
      const result = await manager.captureWithMetadata(sampleHtml, {
        url: sampleUrl,
        compress: true
      });
      expect(result.size.compressed).toBeGreaterThan(0);
      expect(result.size.compressionRatio).toBeGreaterThan(0);
      expect(result.htmlCompressed).toBeDefined();
    });

    test('should calculate processing time', async () => {
      const result = await manager.captureWithMetadata(sampleHtml, { url: sampleUrl });
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    test('should include size information', async () => {
      const result = await manager.captureWithMetadata(sampleHtml, { url: sampleUrl });
      expect(result.size.raw).toBe(sampleHtml.length);
    });

    test('should handle empty HTML', async () => {
      const result = await manager.captureWithMetadata('', { url: sampleUrl });
      expect(result.success).toBe(true);
      expect(result.size.raw).toBe(0);
    });

    test('should handle null HTML gracefully', async () => {
      const result = await manager.captureWithMetadata(null, { url: sampleUrl });
      expect(result.success || result.error).toBeDefined();
    });
  });

  describe('captureFormatted', () => {
    test('should return formatted HTML', () => {
      const result = manager.captureFormatted(sampleHtml, { url: sampleUrl });
      expect(result.success).toBe(true);
      expect(result.html).toBeDefined();
      expect(result.html.length).toBeGreaterThan(0);
    });

    test('should generate snapshot ID', () => {
      const result = manager.captureFormatted(sampleHtml, { url: sampleUrl });
      expect(result.snapshotId).toMatch(/^[a-f0-9]{16}$/);
    });

    test('should include metadata', () => {
      const result = manager.captureFormatted(sampleHtml, { url: sampleUrl });
      expect(result.metadata).toBeDefined();
      expect(result.metadata.originalSize).toBe(sampleHtml.length);
    });

    test('should track statistics', () => {
      manager.captureFormatted(sampleHtml, { url: sampleUrl });
      expect(manager.stats.formattedCaptures).toBe(1);
    });

    test('should respect custom indent size', () => {
      const result = manager.captureFormatted(sampleHtml, {
        url: sampleUrl,
        indentSize: 4
      });
      expect(result.metadata.indentSize).toBe(4);
    });

    test('should handle empty HTML', () => {
      const result = manager.captureFormatted('', { url: sampleUrl });
      expect(result.success).toBe(true);
    });
  });

  describe('captureRaw', () => {
    test('should return exact HTML', async () => {
      const result = await manager.captureRaw(sampleHtml, {
        url: sampleUrl,
        statusCode: 200
      });
      expect(result.success).toBe(true);
      expect(result.html).toBe(sampleHtml);
    });

    test('should generate snapshot ID', async () => {
      const result = await manager.captureRaw(sampleHtml, { url: sampleUrl });
      expect(result.snapshotId).toBeDefined();
    });

    test('should calculate SHA256 hash', async () => {
      const result = await manager.captureRaw(sampleHtml, { url: sampleUrl });
      expect(result.bytes.sha256).toBeDefined();
      expect(result.bytes.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should calculate MD5 hash', async () => {
      const result = await manager.captureRaw(sampleHtml, { url: sampleUrl });
      expect(result.bytes.md5).toBeDefined();
      expect(result.bytes.md5).toMatch(/^[a-f0-9]{32}$/);
    });

    test('should include response info', async () => {
      const result = await manager.captureRaw(sampleHtml, {
        url: sampleUrl,
        statusCode: 200,
        statusText: 'OK',
        headers: sampleHeaders
      });
      expect(result.response.statusCode).toBe(200);
      expect(result.response.headers).toBe(sampleHeaders);
    });

    test('should track statistics', async () => {
      await manager.captureRaw(sampleHtml, { url: sampleUrl });
      expect(manager.stats.rawCaptures).toBe(1);
    });

    test('should handle response timing', async () => {
      const result = await manager.captureRaw(sampleHtml, {
        url: sampleUrl,
        fetchStart: 1000,
        fetchEnd: 1500,
        duration: 500
      });
      expect(result.response.timing.duration).toBe(500);
    });

    test('should calculate byte size', async () => {
      const result = await manager.captureRaw(sampleHtml, { url: sampleUrl });
      expect(result.bytes.raw).toBeGreaterThan(0);
    });
  });

  describe('captureDiff', () => {
    test('should generate snapshot ID', () => {
      const result = manager.captureDiff(sampleHtml, { url: sampleUrl });
      expect(result.snapshotId).toBeDefined();
    });

    test('should track current snapshot size', () => {
      const result = manager.captureDiff(sampleHtml, { url: sampleUrl });
      expect(result.current.size).toBe(sampleHtml.length);
    });

    test('should detect size changes', () => {
      // First capture
      manager.captureDiff(sampleHtml, { url: sampleUrl });
      // Second capture with different size
      const result = manager.captureDiff(sampleHtml + '<!-- extra -->', { url: sampleUrl });
      expect(result.changes.sizeChanged).toBe(true);
      expect(result.changes.sizeChange).toBeGreaterThanOrEqual(0);
    });

    test('should detect hash changes', () => {
      manager.captureDiff(sampleHtml, { url: sampleUrl });
      const result = manager.captureDiff(sampleHtml + '<!-- different -->', { url: sampleUrl });
      expect(result.changes.hashChanged).toBe(true);
    });

    test('should track snapshot history', () => {
      const uniqueUrl = sampleUrl + '/history-test-' + Date.now();
      manager.captureDiff(sampleHtml, { url: uniqueUrl });
      manager.captureDiff(sampleHtml + '1', { url: uniqueUrl });
      manager.captureDiff(sampleHtml + '2', { url: uniqueUrl });
      const result = manager.captureDiff(sampleHtml + '3', { url: uniqueUrl });
      expect(result.history.length).toBeGreaterThanOrEqual(1);
    });

    test('should optionally include full HTML', () => {
      const resultWithout = manager.captureDiff(sampleHtml, {
        url: sampleUrl,
        includeFullHtml: false
      });
      expect(resultWithout.html).toBeUndefined();

      const resultWith = manager.captureDiff(sampleHtml, {
        url: sampleUrl,
        includeFullHtml: true
      });
      expect(resultWith.html).toBe(sampleHtml);
    });

    test('should calculate size change percentage', () => {
      const uniqueUrl = sampleUrl + '/percent-test-' + Date.now();
      manager.captureDiff(sampleHtml, { url: uniqueUrl });
      const result = manager.captureDiff(sampleHtml + ' extra content', { url: uniqueUrl });
      expect(result.changes.sizeChangePercent).toBeDefined();
      expect(parseFloat(result.changes.sizeChangePercent)).toBeGreaterThanOrEqual(0);
    });

    test('should track statistics', () => {
      manager.captureDiff(sampleHtml, { url: sampleUrl });
      expect(manager.stats.diffCaptures).toBe(1);
    });

    test('should handle no previous snapshot', () => {
      const result = manager.captureDiff(sampleHtml, { url: sampleUrl });
      expect(result.previous).toBeNull();
    });
  });

  describe('snapshot storage', () => {
    test('should store snapshots by URL', () => {
      manager.captureRaw(sampleHtml, { url: sampleUrl });
      expect(manager.snapshots.has(sampleUrl)).toBe(true);
    });

    test('should maintain snapshot history', async () => {
      const url = sampleUrl;
      await manager.captureRaw(sampleHtml, { url });
      await manager.captureRaw(sampleHtml + '1', { url });
      await manager.captureRaw(sampleHtml + '2', { url });

      const snapshots = manager.snapshots.get(url);
      expect(snapshots.length).toBe(3);
    });

    test('should enforce max snapshot history', async () => {
      manager.maxSnapshotHistory = 5;
      const url = sampleUrl;

      for (let i = 0; i < 10; i++) {
        await manager.captureRaw(sampleHtml + i, { url });
      }

      const snapshots = manager.snapshots.get(url);
      expect(snapshots.length).toBeLessThanOrEqual(5);
    });

    test('should clear snapshots for URL', async () => {
      await manager.captureRaw(sampleHtml, { url: sampleUrl });
      expect(manager.snapshots.has(sampleUrl)).toBe(true);

      manager.clearSnapshots(sampleUrl);
      expect(manager.snapshots.has(sampleUrl)).toBe(false);
    });

    test('should clear all snapshots', async () => {
      await manager.captureRaw(sampleHtml, { url: 'https://url1.com' });
      await manager.captureRaw(sampleHtml, { url: 'https://url2.com' });
      expect(manager.snapshots.size).toBe(2);

      manager.clearSnapshots();
      expect(manager.snapshots.size).toBe(0);
    });
  });

  describe('statistics', () => {
    test('should track total captures', async () => {
      await manager.captureWithMetadata(sampleHtml, { url: sampleUrl });
      manager.captureFormatted(sampleHtml, { url: sampleUrl });
      await manager.captureRaw(sampleHtml, { url: sampleUrl });
      manager.captureDiff(sampleHtml, { url: sampleUrl });

      expect(manager.stats.totalCaptures).toBe(4);
    });

    test('should track bytes processed', async () => {
      const initialBytes = manager.stats.totalBytesProcessed;
      await manager.captureWithMetadata(sampleHtml, { url: sampleUrl });
      expect(manager.stats.totalBytesProcessed).toBeGreaterThan(initialBytes);
    });

    test('should return comprehensive stats', () => {
      const stats = manager.getStats();
      expect(stats).toHaveProperty('totalCaptures');
      expect(stats).toHaveProperty('snapshotCount');
      expect(stats).toHaveProperty('trackedUrls');
    });
  });

  describe('error handling', () => {
    test('should handle null HTML in metadata', () => {
      const result = manager.extractMetadata(null, {}, sampleUrl);
      expect(result.contentLength).toBeLessThanOrEqual(0);
    });

    test('should handle invalid URL in resolution', () => {
      const result = manager.resolveUrl('/path', 'not-a-valid-url');
      expect(result).toBe('/path'); // Returns original when base URL is invalid
    });

    test('should gracefully handle capture errors', async () => {
      // This should not throw even with problematic input
      const result = await manager.captureWithMetadata(sampleHtml, {
        url: sampleUrl,
        headers: { 'invalid-header': undefined }
      });
      expect(result).toBeDefined();
    });

    test('should default response info when not provided', async () => {
      const result = await manager.captureRaw(sampleHtml);
      expect(result.response.statusCode).toBe(200);
      expect(result.response.statusText).toBe('OK');
    });
  });
});
