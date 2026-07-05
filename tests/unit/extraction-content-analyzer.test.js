/**
 * Tests for ContentAnalyzer module
 * @file tests/unit/extraction-content-analyzer.test.js
 */

const { ContentAnalyzer } = require('../../extraction/content-analyzer');

describe('ContentAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new ContentAnalyzer();
  });

  describe('analyzeMainContent()', () => {
    test('extracts main text content', () => {
      const html = `
        <html>
          <head><title>Test</title></head>
          <body>
            <h1>Main Content</h1>
            <p>This is the main text content.</p>
          </body>
        </html>
      `;

      const content = analyzer.analyzeMainContent(html);
      expect(content.text).toContain('Main Content');
      expect(content.text).toContain('This is the main text content.');
      expect(content.wordCount).toBeGreaterThan(0);
      expect(content.charCount).toBeGreaterThan(0);
    });

    test('removes script and style tags', () => {
      const html = `
        <p>Visible text</p>
        <script>var x = 1;</script>
        <style>body { color: red; }</style>
        <p>More text</p>
      `;

      const content = analyzer.analyzeMainContent(html);
      expect(content.text).not.toContain('var x');
      expect(content.text).not.toContain('color: red');
    });

    test('counts words accurately', () => {
      const html = `<p>one two three four five</p>`;
      const content = analyzer.analyzeMainContent(html);
      expect(content.wordCount).toBe(5);
    });

    test('respects minimum text length filter', () => {
      const html = `<p>short</p>`;
      const content = analyzer.analyzeMainContent(html, { minTextLength: 100 });
      expect(content.text).toBe('');
      expect(content.wordCount).toBe(0);
    });

    test('returns empty content for invalid HTML', () => {
      expect(analyzer.analyzeMainContent(null).text).toBe('');
      expect(analyzer.analyzeMainContent(undefined).text).toBe('');
      expect(analyzer.analyzeMainContent(123).text).toBe('');
    });

    test('updates statistics', () => {
      const html = `<p>Test content</p>`;
      analyzer.analyzeMainContent(html);
      const stats = analyzer.getStats();
      expect(stats.totalAnalyzed).toBe(1);
    });
  });

  describe('extractLinks()', () => {
    test('extracts all links', () => {
      const html = `
        <a href="https://example.com">Link 1</a>
        <a href="/page">Link 2</a>
        <a href="relative.html">Link 3</a>
      `;

      const links = analyzer.extractLinks(html);
      expect(links).toHaveLength(3);
      expect(links[0]).toHaveProperty('href');
      expect(links[0]).toHaveProperty('text');
    });

    test('extracts link attributes', () => {
      const html = `
        <a href="https://example.com" title="Example" target="_blank" rel="noopener">Link</a>
      `;

      const links = analyzer.extractLinks(html);
      expect(links[0].href).toBe('https://example.com');
      expect(links[0].title).toBe('Example');
      expect(links[0].target).toBe('_blank');
      expect(links[0].rel).toBe('noopener');
    });

    test('resolves relative URLs', () => {
      const html = `
        <a href="page.html">Relative</a>
        <a href="/about">Absolute</a>
        <a href="https://external.com">External</a>
      `;

      const links = analyzer.extractLinks(html, {
        baseUrl: 'https://example.com/blog/'
      });

      expect(links[0].href).toBe('https://example.com/blog/page.html');
      expect(links[1].href).toBe('https://example.com/about');
      expect(links[2].href).toBe('https://external.com');
    });

    test('classifies link types', () => {
      const html = `
        <a href="https://example.com">HTTPS</a>
        <a href="http://example.com">HTTP</a>
        <a href="mailto:test@example.com">Email</a>
        <a href="tel:1234567890">Phone</a>
        <a href="file.pdf">PDF</a>
      `;

      const links = analyzer.extractLinks(html);
      expect(links[0].type).toBe('https');
      expect(links[1].type).toBe('http');
      expect(links[2].type).toBe('email');
      expect(links[3].type).toBe('phone');
      expect(links[4].type).toBe('pdf');
    });

    test('skips anchor-only links', () => {
      const html = `
        <a href="https://example.com">Page</a>
        <a href="#section">Anchor</a>
        <a href="">Empty</a>
      `;

      const links = analyzer.extractLinks(html);
      expect(links.length).toBe(1);
    });

    test('filters internal links only', () => {
      const html = `
        <a href="https://example.com/page">Internal</a>
        <a href="https://external.com/page">External</a>
        <a href="/local">Local</a>
      `;

      const links = analyzer.extractLinks(html, {
        baseUrl: 'https://example.com/',
        includeExternal: false
      });

      expect(links.length).toBe(2);
      expect(links.every(l => !l.href.includes('external'))).toBe(true);
    });

    test('filters external links only', () => {
      const html = `
        <a href="https://example.com/page">Internal</a>
        <a href="https://external.com/page">External</a>
      `;

      const links = analyzer.extractLinks(html, {
        baseUrl: 'https://example.com/',
        includeInternal: false
      });

      expect(links.length).toBe(1);
      expect(links[0].href).toContain('external.com');
    });

    test('returns empty array for invalid HTML', () => {
      expect(analyzer.extractLinks(null)).toEqual([]);
      expect(analyzer.extractLinks(undefined)).toEqual([]);
    });

    test('updates statistics', () => {
      const html = `<a href="link1.html">1</a><a href="link2.html">2</a>`;
      analyzer.extractLinks(html);
      const stats = analyzer.getStats();
      expect(stats.linksExtracted).toBe(2);
    });
  });

  describe('calculateReadability()', () => {
    test('calculates readability metrics', () => {
      const text = 'The quick brown fox jumps over the lazy dog. ' +
                   'This is a second sentence with more words. ' +
                   'And here is a third sentence to provide variety.';

      const metrics = analyzer.calculateReadability(text);
      expect(metrics).toHaveProperty('flesch');
      expect(metrics).toHaveProperty('fleschKincaid');
      expect(metrics).toHaveProperty('wordCount');
      expect(metrics).toHaveProperty('sentenceCount');
      expect(metrics).toHaveProperty('syllableCount');
    });

    test('calculates flesch reading ease', () => {
      const text = 'The quick brown fox jumps. ' +
                   'The dog sleeps. ' +
                   'The cat sits. ' +
                   'Birds fly high.';

      const metrics = analyzer.calculateReadability(text);
      expect(metrics.flesch).toBeGreaterThanOrEqual(0);
      expect(metrics.flesch).toBeLessThanOrEqual(100);
    });

    test('returns zero metrics for empty text', () => {
      const metrics = analyzer.calculateReadability('');
      expect(metrics.wordCount).toBe(0);
      expect(metrics.sentenceCount).toBe(0);
      expect(metrics.flesch).toBe(0);
    });

    test('counts words correctly', () => {
      const text = 'one two three four five';
      const metrics = analyzer.calculateReadability(text);
      expect(metrics.wordCount).toBe(5);
    });

    test('counts sentences correctly', () => {
      const text = 'First sentence. Second sentence! Third sentence? Fourth.';
      const metrics = analyzer.calculateReadability(text);
      expect(metrics.sentenceCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe('analyzeStructure()', () => {
    test('extracts heading hierarchy', () => {
      const html = `
        <h1>Main Title</h1>
        <h2>Section 1</h2>
        <h3>Subsection</h3>
        <h2>Section 2</h2>
      `;

      const structure = analyzer.analyzeStructure(html);
      expect(structure.headings).toHaveLength(4);
      expect(structure.headings[0].level).toBe(1);
      expect(structure.headings[0].text).toBe('Main Title');
    });

    test('counts structural elements', () => {
      const html = `
        <section>Section 1</section>
        <article>Article 1</article>
        <main>Main content</main>
        <ul><li>Item</li></ul>
        <ol><li>Item</li></ol>
        <table><tr><td>Cell</td></tr></table>
      `;

      const structure = analyzer.analyzeStructure(html);
      expect(structure.sections).toBe(1); // main is not counted as section
      expect(structure.lists).toBe(2);
      expect(structure.tables).toBe(1);
    });

    test('validates heading hierarchy', () => {
      const validHtml = `<h1>Title</h1><h2>Subtitle</h2><h3>Sub-subtitle</h3>`;
      const validStructure = analyzer.analyzeStructure(validHtml);
      expect(validStructure.hierarchyValid).toBe(true);

      const invalidHtml = `<h1>Title</h1><h3>Skip level</h3>`;
      const invalidStructure = analyzer.analyzeStructure(invalidHtml);
      expect(invalidStructure.hierarchyValid).toBe(false);
    });

    test('returns empty structure for invalid HTML', () => {
      const structure = analyzer.analyzeStructure(null);
      expect(structure.headings).toEqual([]);
      expect(structure.sections).toBe(0);
    });

    test('updates statistics', () => {
      const html = `<h1>Title</h1><h2>Subtitle</h2>`;
      analyzer.analyzeStructure(html);
      const stats = analyzer.getStats();
      expect(stats.headingsAnalyzed).toBeGreaterThan(0);
    });
  });

  describe('statistics', () => {
    test('resetStats() clears statistics', () => {
      const html = `<p>Test</p>`;
      analyzer.analyzeMainContent(html);
      expect(analyzer.getStats().totalAnalyzed).toBeGreaterThan(0);

      analyzer.resetStats();
      expect(analyzer.getStats().totalAnalyzed).toBe(0);
    });

    test('getStats() returns current statistics', () => {
      const stats = analyzer.getStats();
      expect(stats).toHaveProperty('totalAnalyzed');
      expect(stats).toHaveProperty('linksExtracted');
      expect(stats).toHaveProperty('headingsAnalyzed');
    });
  });

  describe('error handling', () => {
    test('handles malformed HTML gracefully', () => {
      const html = `<p>Text<div>More<body>`;
      const content = analyzer.analyzeMainContent(html);
      expect(typeof content.text).toBe('string');
      expect(content.text.length >= 0).toBe(true);
    });

    test('handles null input gracefully', () => {
      expect(analyzer.analyzeMainContent(null).text).toBe('');
      expect(analyzer.extractLinks(null)).toEqual([]);
      expect(analyzer.calculateReadability(null).wordCount).toBe(0);
    });
  });
});
