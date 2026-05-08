/**
 * Basset Hound Browser - Content Extraction DOM Timing Tests
 * Tests for DOM detection and retry mechanisms
 */

const { ExtractionManager } = require('../../extraction/manager');

describe('ExtractionManager - DOM Timing', () => {
  let extractionManager;

  beforeEach(() => {
    extractionManager = new ExtractionManager();
  });

  describe('DOM Wait Configuration', () => {
    it('should have default DOM wait configuration', () => {
      expect(extractionManager.domWaitConfig.defaultWaitTime).toBe(2000);
      expect(extractionManager.domWaitConfig.minWaitTime).toBe(500);
      expect(extractionManager.domWaitConfig.maxWaitTime).toBe(10000);
      expect(extractionManager.domWaitConfig.retryAttempts).toBe(3);
      expect(extractionManager.domWaitConfig.retryDelay).toBe(1000);
    });

    it('should configure DOM wait settings', () => {
      const config = extractionManager.configureDomWait({
        defaultWaitTime: 3000,
        retryAttempts: 5,
        retryDelay: 500
      });

      expect(config.success).toBe(true);
      expect(extractionManager.domWaitConfig.defaultWaitTime).toBe(3000);
      expect(extractionManager.domWaitConfig.retryAttempts).toBe(5);
      expect(extractionManager.domWaitConfig.retryDelay).toBe(500);
    });

    it('should reject invalid DOM wait configuration', () => {
      const config = extractionManager.configureDomWait({
        defaultWaitTime: 15000 // Exceeds max
      });

      expect(config.success).toBe(false);
      expect(config.error).toBeDefined();
    });
  });

  describe('Incomplete DOM Detection', () => {
    it('should detect loading placeholders', () => {
      const html = `<html>
        <body>
          <div class="loading">Loading...</div>
          <div class="skeleton"></div>
        </body>
      </html>`;

      const result = extractionManager.detectIncompleteDom(html);

      expect(result.incomplete).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.indicators).toContain('loading_placeholders_detected');
    });

    it('should detect minimal main content', () => {
      const html = `<html>
        <body>
          <main>
            <p>Loading...</p>
          </main>
        </body>
      </html>`;

      const result = extractionManager.detectIncompleteDom(html);

      expect(result.incomplete).toBe(true);
      expect(result.indicators).toContain('main_content_minimal');
    });

    it('should detect deferred scripts', () => {
      const html = `<html>
        <body>
          <script defer src="app.js"></script>
          <div id="app"></div>
        </body>
      </html>`;

      const result = extractionManager.detectIncompleteDom(html);

      expect(result.incomplete).toBe(true);
      expect(result.indicators).toContain('deferred_scripts_present');
    });

    it('should detect lazy loading', () => {
      const html = `<html>
        <body>
          <img data-src="image.jpg" />
          <img data-lazy="image2.jpg" />
          <script>
            const observer = new IntersectionObserver();
          </script>
        </body>
      </html>`;

      const result = extractionManager.detectIncompleteDom(html);

      expect(result.incomplete).toBe(true);
      expect(result.indicators).toContain('lazy_loading_detected');
    });

    it('should detect dynamic content indicators', () => {
      const html = `<html>
        <body>
          <script>
            document.addEventListener('DOMContentLoaded', () => {});
          </script>
        </body>
      </html>`;

      const result = extractionManager.detectIncompleteDom(html);

      expect(result.incomplete).toBe(true);
      expect(result.indicators).toContain('dynamic_content_detected');
    });

    it('should handle complete DOM', () => {
      const html = `<html>
        <head><title>Test</title></head>
        <body>
          <h1>Complete Page</h1>
          <p>This is fully loaded content with full text and data.</p>
          <div>More complete content here</div>
        </body>
      </html>`;

      const result = extractionManager.detectIncompleteDom(html);

      expect(result.incomplete).toBe(false);
      expect(result.confidence).toBeLessThan(30);
    });

    it('should handle empty HTML gracefully', () => {
      const result = extractionManager.detectIncompleteDom('');

      expect(result.incomplete).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.indicators).toEqual([]);
    });
  });

  describe('Extract All with DOM Status', () => {
    it('should include DOM status in results', () => {
      const html = '<html><head><title>Test</title></head><body><div class="loading">Loading...</div></body></html>';

      const result = extractionManager.extractAll(html, 'http://example.com');

      expect(result.domStatus).toBeDefined();
      expect(result.domStatus.incompleteDetected).toBe(true);
      expect(result.domStatus.incompletenessConfidence).toBeGreaterThan(0);
    });

    it('should include retry hint for incomplete DOM', () => {
      const html = '<html><body><div class="loading"></div><script defer src="app.js"></script></body></html>';

      const result = extractionManager.extractAll(html, 'http://example.com', {
        autoRetry: true,
        retryOnIncomplete: true
      });

      expect(result.retryHint).toBeDefined();
      expect(result.retryHint.maxRetries).toBeGreaterThan(0);
      expect(result.retryHint.waitTimeMs).toBeGreaterThan(0);
    });

    it('should not include retry hint for complete DOM', () => {
      const html = '<html><body><h1>Complete</h1><p>Full content here with substantial text.</p></body></html>';

      const result = extractionManager.extractAll(html, 'http://example.com');

      expect(result.retryHint).toBeUndefined();
    });

    it('should track incomplete DOM detections in stats', () => {
      const incompleteHtml = '<div class="loading"></div>';
      const completeHtml = '<html><body><h1>Complete</h1><p>Full content with substantial text.</p></body></html>';

      extractionManager.extractAll(incompleteHtml);
      extractionManager.extractAll(completeHtml);
      extractionManager.extractAll(incompleteHtml);

      expect(extractionManager.stats.incompleteDOMDetections).toBe(2);
    });
  });

  describe('Extract All With Retry', () => {
    it('should extract on first attempt if DOM is complete', async () => {
      const htmlContent = '<html><body><h1>Complete</h1><p>Full content with substantial text.</p></body></html>';
      const getHtml = jest.fn().mockResolvedValue(htmlContent);

      const result = await extractionManager.extractAllWithRetry(getHtml, 'http://example.com');

      expect(result.success).toBe(true);
      expect(result.finalAttempt).toBe(1);
      expect(getHtml).toHaveBeenCalledTimes(1);
    });

    it('should retry when DOM is incomplete', async () => {
      let callCount = 0;
      const getHtml = jest.fn(async () => {
        callCount++;
        if (callCount < 2) {
          return '<div class="loading">Loading...</div>';
        }
        return '<html><body><h1>Complete</h1><p>Full content with substantial text.</p></body></html>';
      });

      const result = await extractionManager.extractAllWithRetry(getHtml, 'http://example.com', {
        waitTime: 100,
        maxRetries: 3,
        retryDelay: 50
      });

      expect(result.success).toBe(true);
      expect(result.finalAttempt).toBe(2);
      expect(getHtml).toHaveBeenCalledTimes(2);
      expect(extractionManager.stats.retriesPerformed).toBeGreaterThan(0);
    });

    it('should fail after max retries', async () => {
      const getHtml = jest.fn().mockResolvedValue('<div class="loading">Always loading</div>');

      const result = await extractionManager.extractAllWithRetry(getHtml, 'http://example.com', {
        waitTime: 100,
        maxRetries: 2,
        retryDelay: 50
      });

      expect(result.success).toBe(true); // Should return result on last attempt
      expect(result.finalAttempt).toBe(2);
      expect(getHtml).toHaveBeenCalledTimes(2);
    });

    it('should handle extraction errors', async () => {
      const getHtml = jest.fn().mockRejectedValue(new Error('Failed to get HTML'));

      const result = await extractionManager.extractAllWithRetry(getHtml, 'http://example.com', {
        maxRetries: 2,
        retryDelay: 50
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get HTML');
      expect(result.attempts).toBeDefined();
    });

    it('should track extraction attempts', async () => {
      let callCount = 0;
      const getHtml = jest.fn(async () => {
        callCount++;
        if (callCount < 3) {
          return '<div class="loading">Loading...</div>';
        }
        return '<html><body><h1>Complete</h1><p>Full content with substantial text.</p></body></html>';
      });

      const result = await extractionManager.extractAllWithRetry(getHtml, 'http://example.com', {
        maxRetries: 3,
        retryDelay: 50
      });

      expect(result.extractionAttempts).toBeDefined();
      expect(result.extractionAttempts.length).toBe(3);
      expect(result.extractionAttempts[0].htmlLength).toBeGreaterThan(0);
      expect(result.extractionAttempts[0].domIncomplete).toBe(true);
    });

    it('should provide note when successful after retry', async () => {
      let callCount = 0;
      const getHtml = jest.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return '<div class="loading">Loading</div>';
        }
        return '<html><body><h1>Complete</h1><p>Full content with substantial text.</p></body></html>';
      });

      const result = await extractionManager.extractAllWithRetry(getHtml, 'http://example.com', {
        retryDelay: 50
      });

      expect(result.note).toBeDefined();
      expect(result.note).toContain('attempt 2');
    });
  });

  describe('Statistics Tracking', () => {
    it('should track extraction statistics', () => {
      const html = '<html><body><a href="/page">Link</a></body></html>';

      extractionManager.extractAll(html);
      extractionManager.extractAll(html);

      const stats = extractionManager.getStats();
      expect(stats.totalExtractions).toBe(2);
      expect(stats.linkExtractions).toBe(2);
    });

    it('should reset statistics', () => {
      extractionManager.stats.totalExtractions = 10;

      const previous = extractionManager.resetStats();

      expect(previous.totalExtractions).toBe(10);
      expect(extractionManager.stats.totalExtractions).toBe(0);
    });
  });
});
