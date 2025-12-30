/**
 * Extraction Manager Unit Tests
 */

const { ExtractionManager } = require('../../extraction');

describe('ExtractionManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ExtractionManager();
  });

  describe('initialization', () => {
    test('should initialize with parsers', () => {
      expect(manager).toBeDefined();
      expect(manager.openGraphParser).toBeDefined();
      expect(manager.twitterCardParser).toBeDefined();
      expect(manager.jsonLdParser).toBeDefined();
    });

    test('should initialize stats', () => {
      expect(manager.stats).toBeDefined();
      expect(manager.stats.totalExtractions).toBe(0);
    });
  });

  describe('extractMetadata', () => {
    test('should extract title', () => {
      const html = '<html><head><title>Test Page</title></head><body></body></html>';
      const result = manager.extractMetadata(html, 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.data.basic.title).toBe('Test Page');
    });

    test('should extract meta description', () => {
      const html = '<html><head><meta name="description" content="Test description"></head></html>';
      const result = manager.extractMetadata(html);

      expect(result.success).toBe(true);
      expect(result.data.basic.description).toBe('Test description');
    });

    test('should extract Open Graph tags', () => {
      const html = '<html><head><meta property="og:title" content="OG Title"><meta property="og:image" content="https://example.com/image.jpg"></head></html>';
      const result = manager.extractMetadata(html, 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.data.openGraph).toBeDefined();
    });

    test('should return error for invalid HTML', () => {
      const result = manager.extractMetadata(null);
      expect(result.success).toBe(false);
    });
  });

  describe('extractLinks', () => {
    test('should extract internal and external links', () => {
      const html = `
        <html><body>
          <a href="/internal">Internal</a>
          <a href="https://external.com">External</a>
        </body></html>
      `;
      const result = manager.extractLinks(html, 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should categorize different link types', () => {
      const html = `
        <html><body>
          <a href="mailto:test@example.com">Email</a>
          <a href="tel:+1234567890">Phone</a>
          <a href="#section">Anchor</a>
        </body></html>
      `;
      const result = manager.extractLinks(html, 'https://example.com');

      expect(result.success).toBe(true);
    });
  });

  describe('extractForms', () => {
    test('should extract form fields', () => {
      const html = `
        <html><body>
          <form action="/submit" method="POST">
            <input type="text" name="username">
            <input type="password" name="password">
            <button type="submit">Submit</button>
          </form>
        </body></html>
      `;
      const result = manager.extractForms(html);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe('extractImages', () => {
    test('should extract images with attributes', () => {
      const html = `
        <html><body>
          <img src="/image.jpg" alt="Test image" width="100" height="100">
        </body></html>
      `;
      const result = manager.extractImages(html, 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    test('should handle lazy-loaded images', () => {
      const html = `
        <html><body>
          <img data-src="/lazy.jpg" alt="Lazy image">
        </body></html>
      `;
      const result = manager.extractImages(html, 'https://example.com');

      expect(result.success).toBe(true);
    });
  });

  describe('extractScripts', () => {
    test('should extract external scripts', () => {
      const html = `
        <html><head>
          <script src="/app.js"></script>
          <script src="https://cdn.example.com/lib.js"></script>
        </head></html>
      `;
      const result = manager.extractScripts(html, 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.external).toBeDefined();
      expect(result.data.external.length).toBeGreaterThan(0);
    });

    test('should detect common libraries', () => {
      const html = `
        <html><head>
          <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
        </head></html>
      `;
      const result = manager.extractScripts(html, 'https://example.com');

      expect(result.success).toBe(true);
    });
  });

  describe('extractStructuredData', () => {
    test('should extract JSON-LD', () => {
      const html = `
        <html><head>
          <script type="application/ld+json">
            {"@context": "https://schema.org", "@type": "Organization", "name": "Example"}
          </script>
        </head></html>
      `;
      const result = manager.extractStructuredData(html);

      expect(result.success).toBe(true);
      expect(result.data.jsonLd).toBeDefined();
    });
  });

  describe('extractAll', () => {
    test('should extract all content types', () => {
      const html = `
        <html>
          <head>
            <title>Test</title>
            <meta name="description" content="Test page">
          </head>
          <body>
            <a href="/link">Link</a>
            <img src="/image.jpg" alt="Image">
            <form action="/submit"><input name="field"></form>
          </body>
        </html>
      `;
      const result = manager.extractAll(html, 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.links).toBeDefined();
      expect(result.forms).toBeDefined();
      expect(result.images).toBeDefined();
    });
  });

  describe('resolveUrl', () => {
    test('should resolve relative URLs', () => {
      expect(manager.resolveUrl('/path', 'https://example.com'))
        .toBe('https://example.com/path');
      expect(manager.resolveUrl('page.html', 'https://example.com/dir/'))
        .toBe('https://example.com/dir/page.html');
    });

    test('should handle absolute URLs', () => {
      expect(manager.resolveUrl('https://other.com/path', 'https://example.com'))
        .toBe('https://other.com/path');
    });

    test('should handle protocol-relative URLs', () => {
      expect(manager.resolveUrl('//cdn.example.com/file.js', 'https://example.com'))
        .toBe('https://cdn.example.com/file.js');
    });
  });
});
