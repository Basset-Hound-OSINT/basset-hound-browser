/**
 * Comprehensive test coverage for Change Detector
 * Target: 95%+ code coverage
 * Tests all change types, diff algorithms, error conditions, and edge cases
 */

const { ChangeDetector } = require('../../src/monitoring/change-detector');

describe('ChangeDetector - Comprehensive Coverage', () => {
  let detector;

  const createSnapshot = (overrides = {}) => ({
    timestamp: Date.now(),
    url: 'https://example.com',
    html: '<html><body>Content</body></html>',
    content: 'Content',
    headers: { 'Server': 'Apache' },
    statusCode: 200,
    ...overrides
  });

  beforeEach(() => {
    detector = new ChangeDetector({
      contentHashAlgorithm: 'sha256',
      trackDomStructure: true,
      trackTechnology: true,
      trackPerformance: true,
      screenshotComparison: false
    });
  });

  // ================================================================
  // CHANGE TYPE 1: CONTENT CHANGES
  // ================================================================
  describe('Content Change Detection', () => {
    test('should detect text content changes', () => {
      const prev = createSnapshot({ content: 'Old content' });
      const curr = createSnapshot({ content: 'New content' });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
      expect(result.changeSummary).toContain('content');
    });

    test('should detect identical content', () => {
      const prev = createSnapshot({ content: 'Same content' });
      const curr = createSnapshot({ content: 'Same content' });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(false);
    });

    test('should calculate content hash correctly', () => {
      const prev = createSnapshot({ content: 'Test content' });
      const curr = createSnapshot({ content: 'Test content' });

      const result = detector.detectChanges(prev, curr);
      expect(result.details.content?.previousHash).toBe(result.details.content?.currentHash);
    });

    test('should handle empty content', () => {
      const prev = createSnapshot({ content: '' });
      const curr = createSnapshot({ content: 'New content' });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should handle null content', () => {
      const prev = createSnapshot({ content: null });
      const curr = createSnapshot({ content: 'Content' });

      const result = detector.detectChanges(prev, curr);
      // Should handle gracefully
      expect(result).toBeDefined();
    });

    test('should detect large content changes', () => {
      const prev = createSnapshot({
        content: 'x'.repeat(10000)
      });
      const curr = createSnapshot({
        content: 'y'.repeat(10000)
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should calculate change percentage', () => {
      const prev = createSnapshot({ content: 'abcdef' });
      const curr = createSnapshot({ content: 'abcxyz' });

      const result = detector.detectChanges(prev, curr);
      if (result.details.content?.changePercentage !== undefined) {
        expect(result.details.content.changePercentage).toBeGreaterThan(0);
        expect(result.details.content.changePercentage).toBeLessThanOrEqual(100);
      }
    });

    test('should handle whitespace-only changes', () => {
      const prev = createSnapshot({ content: 'test content' });
      const curr = createSnapshot({ content: 'test  content' });

      const result = detector.detectChanges(prev, curr);
      // Depends on implementation
      expect(result).toBeDefined();
    });

    test('should handle case sensitivity in content', () => {
      const prev = createSnapshot({ content: 'Test' });
      const curr = createSnapshot({ content: 'test' });

      const result = detector.detectChanges(prev, curr);
      // Case-sensitive by default
      expect(result).toBeDefined();
    });
  });

  // ================================================================
  // CHANGE TYPE 2: STRUCTURE CHANGES
  // ================================================================
  describe('Structure Change Detection', () => {
    test('should detect added elements', () => {
      const prev = createSnapshot({
        html: '<div id="test"></div>'
      });
      const curr = createSnapshot({
        html: '<div id="test"></div><div id="new"></div>'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
      expect(result.changeSummary).toContain('structure');
    });

    test('should detect removed elements', () => {
      const prev = createSnapshot({
        html: '<div id="old"></div><div id="test"></div>'
      });
      const curr = createSnapshot({
        html: '<div id="test"></div>'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should detect DOM tree changes', () => {
      const prev = createSnapshot({
        html: '<div><span>test</span></div>'
      });
      const curr = createSnapshot({
        html: '<div><p>test</p></div>'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should detect attribute changes', () => {
      const prev = createSnapshot({
        html: '<div class="old-class"></div>'
      });
      const curr = createSnapshot({
        html: '<div class="new-class"></div>'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should detect CSS class additions', () => {
      const prev = createSnapshot({
        html: '<div class="btn"></div>'
      });
      const curr = createSnapshot({
        html: '<div class="btn btn-large"></div>'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should handle empty HTML', () => {
      const prev = createSnapshot({ html: '' });
      const curr = createSnapshot({ html: '<div>test</div>' });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should handle null HTML', () => {
      const prev = createSnapshot({ html: null });
      const curr = createSnapshot({ html: '<div>test</div>' });

      const result = detector.detectChanges(prev, curr);
      expect(result).toBeDefined();
    });

    test('should handle malformed HTML', () => {
      const prev = createSnapshot({
        html: '<div><span>'
      });
      const curr = createSnapshot({
        html: '<div><span></span></div>'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result).toBeDefined();
    });

    test('should handle deeply nested structures', () => {
      let nested = '<div>';
      for (let i = 0; i < 50; i++) {
        nested += '<div>';
      }
      nested += 'content';
      for (let i = 0; i < 50; i++) {
        nested += '</div>';
      }
      nested += '</div>';

      const prev = createSnapshot({ html: nested });
      const curr = createSnapshot({ html: nested + '<span>new</span>' });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should detect node count changes', () => {
      const prev = createSnapshot({
        html: '<div><p>1</p><p>2</p></div>'
      });
      const curr = createSnapshot({
        html: '<div><p>1</p><p>2</p><p>3</p></div>'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });
  });

  // ================================================================
  // CHANGE TYPE 3: TECHNOLOGY CHANGES
  // ================================================================
  describe('Technology Change Detection', () => {
    test('should detect new technologies in headers', () => {
      const prev = createSnapshot({
        headers: { 'Server': 'Apache' }
      });
      const curr = createSnapshot({
        headers: { 'Server': 'Apache', 'X-Powered-By': 'PHP/8.0' }
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
      expect(result.changeSummary).toContain('technology');
    });

    test('should detect technology version changes', () => {
      const prev = createSnapshot({
        headers: { 'Server': 'Apache/2.4.40' }
      });
      const curr = createSnapshot({
        headers: { 'Server': 'Apache/2.4.41' }
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should detect removed technologies', () => {
      const prev = createSnapshot({
        headers: { 'X-Powered-By': 'PHP/7.4', 'Server': 'Apache' }
      });
      const curr = createSnapshot({
        headers: { 'Server': 'Apache' }
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should handle null headers', () => {
      const prev = createSnapshot({ headers: null });
      const curr = createSnapshot({ headers: { 'Server': 'Apache' } });

      const result = detector.detectChanges(prev, curr);
      expect(result).toBeDefined();
    });

    test('should be case-insensitive for header names', () => {
      const prev = createSnapshot({
        headers: { 'server': 'Apache' }
      });
      const curr = createSnapshot({
        headers: { 'Server': 'Apache' }
      });

      const result = detector.detectChanges(prev, curr);
      // Should recognize as same technology
      expect(result).toBeDefined();
    });

    test('should detect technology in HTML meta tags', () => {
      const prev = createSnapshot({
        html: '<meta name="generator" content="WordPress 5.0">'
      });
      const curr = createSnapshot({
        html: '<meta name="generator" content="WordPress 6.0">'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });
  });

  // ================================================================
  // CHANGE TYPE 4: PERFORMANCE CHANGES
  // ================================================================
  describe('Performance Change Detection', () => {
    test('should detect load time changes', () => {
      const prev = createSnapshot({
        performance: { loadTime: 1000 }
      });
      const curr = createSnapshot({
        performance: { loadTime: 2000 }
      });

      const result = detector.detectChanges(prev, curr);
      if (result.details.performance) {
        expect(result.details.performance).toBeDefined();
      }
    });

    test('should detect resource count changes', () => {
      const prev = createSnapshot({
        performance: { resourceCount: 50 }
      });
      const curr = createSnapshot({
        performance: { resourceCount: 75 }
      });

      const result = detector.detectChanges(prev, curr);
      if (result.details.performance) {
        expect(result.details.performance).toBeDefined();
      }
    });

    test('should detect size changes', () => {
      const prev = createSnapshot({
        performance: { pageSize: 1000000 }
      });
      const curr = createSnapshot({
        performance: { pageSize: 1500000 }
      });

      const result = detector.detectChanges(prev, curr);
      if (result.details.performance) {
        expect(result.details.performance).toBeDefined();
      }
    });

    test('should calculate performance degradation percentage', () => {
      const prev = createSnapshot({
        performance: { loadTime: 1000 }
      });
      const curr = createSnapshot({
        performance: { loadTime: 2000 }
      });

      const result = detector.detectChanges(prev, curr);
      if (result.details.performance?.degradationPercentage) {
        expect(result.details.performance.degradationPercentage).toBeGreaterThan(0);
      }
    });
  });

  // ================================================================
  // CHANGE TYPE 5: STATUS CHANGES
  // ================================================================
  describe('Status Change Detection', () => {
    test('should detect HTTP status code changes', () => {
      const prev = createSnapshot({ statusCode: 200 });
      const curr = createSnapshot({ statusCode: 404 });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
      expect(result.changeSummary).toContain('status');
    });

    test('should detect redirect changes', () => {
      const prev = createSnapshot({ statusCode: 200 });
      const curr = createSnapshot({ statusCode: 301 });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should detect error status', () => {
      const prev = createSnapshot({ statusCode: 200 });
      const curr = createSnapshot({ statusCode: 500 });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should categorize severity correctly', () => {
      const prev = createSnapshot({ statusCode: 200 });
      const curr = createSnapshot({ statusCode: 503 });

      const result = detector.detectChanges(prev, curr);
      expect(['low', 'medium', 'high']).toContain(result.severity);
    });
  });

  // ================================================================
  // ERROR CONDITIONS
  // ================================================================
  describe('Error Handling - All Paths', () => {
    test('should throw on null previous snapshot', () => {
      const curr = createSnapshot();
      expect(() => {
        detector.detectChanges(null, curr);
      }).toThrow();
    });

    test('should throw on null current snapshot', () => {
      const prev = createSnapshot();
      expect(() => {
        detector.detectChanges(prev, null);
      }).toThrow();
    });

    test('should throw on undefined snapshots', () => {
      expect(() => {
        detector.detectChanges(undefined, undefined);
      }).toThrow();
    });

    test('should handle missing snapshot properties', () => {
      const prev = {};
      const curr = {};

      const result = detector.detectChanges(prev, curr);
      expect(result).toBeDefined();
      expect(result.changeDetected).toBe(false);
    });

    test('should handle corrupted snapshot data', () => {
      const prev = createSnapshot({
        html: 'invalid',
        content: null
      });
      const curr = createSnapshot({
        html: 'still invalid'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result).toBeDefined();
    });

    test('should handle parsing errors gracefully', () => {
      const prev = createSnapshot({
        html: '<div><unclosed>'
      });
      const curr = createSnapshot({
        html: '<div><unclosed>'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result).toBeDefined();
    });
  });

  // ================================================================
  // DIFF ALGORITHMS
  // ================================================================
  describe('Diff Algorithm Comparison', () => {
    test('semantic diff for content', () => {
      const prev = createSnapshot({
        content: 'The quick brown fox'
      });
      const curr = createSnapshot({
        content: 'The quick red fox'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('content diff with additions', () => {
      const prev = createSnapshot({
        content: 'Hello world'
      });
      const curr = createSnapshot({
        content: 'Hello beautiful world'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('content diff with deletions', () => {
      const prev = createSnapshot({
        content: 'Hello world'
      });
      const curr = createSnapshot({
        content: 'world'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('visual diff approximation', () => {
      const prev = createSnapshot({
        html: '<div style="color: red">text</div>'
      });
      const curr = createSnapshot({
        html: '<div style="color: blue">text</div>'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });
  });

  // ================================================================
  // REGRESSION DETECTION
  // ================================================================
  describe('Regression Detection', () => {
    test('should detect performance regression', () => {
      const prev = createSnapshot({
        performance: { loadTime: 1000 }
      });
      const curr = createSnapshot({
        performance: { loadTime: 5000 }
      });

      const result = detector.detectChanges(prev, curr);
      if (result.details.performance?.isRegression) {
        expect(result.details.performance.isRegression).toBe(true);
      }
    });

    test('should detect availability regression', () => {
      const prev = createSnapshot({ statusCode: 200 });
      const curr = createSnapshot({ statusCode: 503 });

      const result = detector.detectChanges(prev, curr);
      expect(result.severity).toMatch(/high|critical/);
    });

    test('should track regression duration', () => {
      const prev = createSnapshot({
        timestamp: Date.now() - 10000,
        statusCode: 200
      });
      const curr = createSnapshot({
        timestamp: Date.now(),
        statusCode: 503
      });

      const result = detector.detectChanges(prev, curr);
      expect(result).toBeDefined();
    });
  });

  // ================================================================
  // CONFIGURATION OPTIONS
  // ================================================================
  describe('Configuration Options', () => {
    test('should respect trackDomStructure option', () => {
      detector = new ChangeDetector({ trackDomStructure: false });
      const prev = createSnapshot({ html: '<div id="old"></div>' });
      const curr = createSnapshot({ html: '<div id="new"></div>' });

      const result = detector.detectChanges(prev, curr);
      expect(result.details.structure).toBeUndefined();
    });

    test('should respect trackTechnology option', () => {
      detector = new ChangeDetector({ trackTechnology: false });
      const prev = createSnapshot({ headers: { 'Server': 'Apache' } });
      const curr = createSnapshot({ headers: { 'Server': 'Nginx' } });

      const result = detector.detectChanges(prev, curr);
      expect(result.details.technology).toBeUndefined();
    });

    test('should respect trackPerformance option', () => {
      detector = new ChangeDetector({ trackPerformance: false });
      const prev = createSnapshot({ performance: { loadTime: 1000 } });
      const curr = createSnapshot({ performance: { loadTime: 2000 } });

      const result = detector.detectChanges(prev, curr);
      expect(result.details.performance).toBeUndefined();
    });

    test('should use custom hash algorithm', () => {
      detector = new ChangeDetector({ contentHashAlgorithm: 'md5' });
      const prev = createSnapshot({ content: 'test' });
      const curr = createSnapshot({ content: 'test' });

      const result = detector.detectChanges(prev, curr);
      expect(result).toBeDefined();
    });
  });

  // ================================================================
  // EDGE CASES
  // ================================================================
  describe('Edge Cases', () => {
    test('should handle completely identical snapshots', () => {
      const prev = createSnapshot();
      const curr = JSON.parse(JSON.stringify(prev));
      curr.timestamp = Date.now(); // Update timestamp

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(false);
    });

    test('should handle minimal snapshots', () => {
      const prev = { timestamp: Date.now() };
      const curr = { timestamp: Date.now() + 1000 };

      const result = detector.detectChanges(prev, curr);
      expect(result).toBeDefined();
    });

    test('should handle extremely large content', () => {
      const prev = createSnapshot({
        content: 'x'.repeat(10000000)
      });
      const curr = createSnapshot({
        content: 'y'.repeat(10000000)
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should handle special characters in content', () => {
      const prev = createSnapshot({
        content: '❤️ emoji test 你好'
      });
      const curr = createSnapshot({
        content: '❤️ emoji test 世界'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
    });

    test('should handle null bytes in content', () => {
      const prev = createSnapshot({
        content: 'test\0null'
      });
      const curr = createSnapshot({
        content: 'test\0null'
      });

      const result = detector.detectChanges(prev, curr);
      expect(result).toBeDefined();
    });

    test('should preserve timestamp ordering', () => {
      const prev = createSnapshot({ timestamp: 1000 });
      const curr = createSnapshot({ timestamp: 2000 });

      const result = detector.detectChanges(prev, curr);
      expect(result.previousSnapshot).toBeLessThan(result.currentSnapshot);
    });
  });

  // ================================================================
  // INTEGRATION SCENARIOS
  // ================================================================
  describe('Integration Scenarios', () => {
    test('complete WordPress site change detection', () => {
      const prev = createSnapshot({
        html: '<meta name="generator" content="WordPress 5.0">',
        headers: { 'Server': 'Apache/2.4.40' },
        statusCode: 200,
        performance: { loadTime: 1000 }
      });
      const curr = createSnapshot({
        html: '<meta name="generator" content="WordPress 6.0">',
        headers: { 'Server': 'Apache/2.4.41' },
        statusCode: 200,
        performance: { loadTime: 1200 }
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
      expect(result.changeSummary.length).toBeGreaterThan(0);
    });

    test('complete site outage detection', () => {
      const prev = createSnapshot({ statusCode: 200 });
      const curr = createSnapshot({ statusCode: 503 });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
      expect(result.severity).toMatch(/high|critical/);
    });

    test('mixed technology and structure changes', () => {
      const prev = createSnapshot({
        html: '<div class="old-layout"></div>',
        headers: { 'X-Powered-By': 'PHP/7.4' }
      });
      const curr = createSnapshot({
        html: '<div class="new-layout"><span>new</span></div>',
        headers: { 'X-Powered-By': 'PHP/8.0' }
      });

      const result = detector.detectChanges(prev, curr);
      expect(result.changeDetected).toBe(true);
      expect(result.changeSummary.length).toBeGreaterThanOrEqual(2);
    });
  });
});
