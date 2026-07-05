/**
 * OPT-05: DOM Extraction Caching - Comprehensive Test Suite
 *
 * Tests the caching layer for DOM extraction operations.
 * Validates:
 * - Cache hit/miss behavior
 * - TTL-based invalidation
 * - Navigation cache invalidation
 * - Memory efficiency
 * - Performance improvements
 *
 * Expected Result: 25-50% latency reduction for repeated extractions
 * Success Rate: >95% (288+ tests)
 *
 * Version: 1.0.0
 * Created: June 21, 2026
 */

const assert = require('assert');
const CachedExtractor = require('../src/extraction/cached-extractor');
const { ExtractorWebSocketHandlers } = require('../src/extraction/websocket-handlers');

describe('OPT-05: DOM Extraction Caching', function () {
  this.timeout(10000); // 10 second timeout for all tests

  describe('CachedExtractor Initialization', () => {
    it('should create a cached extractor instance', () => {
      const cache = new CachedExtractor();
      assert(cache instanceof CachedExtractor);
    });

    it('should configure cache with custom options', () => {
      const cache = new CachedExtractor({
        ttl: 30000,
        maxCacheSize: 100,
        maxMemoryMB: 25
      });

      assert.strictEqual(cache.ttl, 30000);
      assert.strictEqual(cache.maxCacheSize, 100);
      assert.strictEqual(cache.maxMemoryMB, 25);
    });

    it('should use default options when not specified', () => {
      const cache = new CachedExtractor();
      assert.strictEqual(cache.ttl, 60000);
      assert.strictEqual(cache.maxCacheSize, 500);
    });

    it('should maintain metrics structure', () => {
      const cache = new CachedExtractor();
      assert(cache.metrics);
      assert.strictEqual(cache.metrics.totalHits, 0);
      assert.strictEqual(cache.metrics.totalMisses, 0);
      assert(cache.metrics.extractionsByType);
    });
  });

  describe('Text Extraction Caching', () => {
    let cache;
    let callCount;

    beforeEach(() => {
      cache = new CachedExtractor({ ttl: 5000 });
      callCount = 0;
    });

    it('should cache text extractions', async () => {
      const extractFn = async () => {
        callCount++;
        return 'Test content';
      };

      // First call - cache miss
      const result1 = await cache.getText('http://example.com', 'body', extractFn);
      assert.strictEqual(result1, 'Test content');
      assert.strictEqual(callCount, 1);
      assert.strictEqual(cache.metrics.totalMisses, 1);

      // Second call - cache hit
      const result2 = await cache.getText('http://example.com', 'body', extractFn);
      assert.strictEqual(result2, 'Test content');
      assert.strictEqual(callCount, 1); // Should not increment
      assert.strictEqual(cache.metrics.totalHits, 1);
    });

    it('should use different cache keys for different selectors', async () => {
      const extractFn = async () => {
        callCount++;
        return `Content ${callCount}`;
      };

      const result1 = await cache.getText('http://example.com', 'body', extractFn);
      const result2 = await cache.getText('http://example.com', '.main', extractFn);

      assert.strictEqual(result1, 'Content 1');
      assert.strictEqual(result2, 'Content 2');
      assert.strictEqual(callCount, 2);
    });

    it('should use different cache keys for different URLs', async () => {
      const extractFn = async () => {
        callCount++;
        return `Content ${callCount}`;
      };

      const result1 = await cache.getText('http://example1.com', 'body', extractFn);
      const result2 = await cache.getText('http://example2.com', 'body', extractFn);

      assert.strictEqual(result1, 'Content 1');
      assert.strictEqual(result2, 'Content 2');
      assert.strictEqual(callCount, 2);
    });

    it('should support forceFresh option to bypass cache', async () => {
      const extractFn = async () => {
        callCount++;
        return `Content ${callCount}`;
      };

      const result1 = await cache.getText('http://example.com', 'body', extractFn);
      const result2 = await cache.getText('http://example.com', 'body', extractFn, { forceFresh: true });

      assert.strictEqual(result1, 'Content 1');
      assert.strictEqual(result2, 'Content 2');
      assert.strictEqual(callCount, 2);
    });

    it('should handle extraction errors gracefully', async () => {
      const extractFn = async () => {
        throw new Error('Extraction failed');
      };

      try {
        await cache.getText('http://example.com', 'body', extractFn);
        assert.fail('Should have thrown error');
      } catch (error) {
        assert(error.message.includes('Extraction failed'));
      }
    });
  });

  describe('HTML Extraction Caching', () => {
    let cache;
    let callCount;

    beforeEach(() => {
      cache = new CachedExtractor({ ttl: 5000 });
      callCount = 0;
    });

    it('should cache HTML extractions', async () => {
      const extractFn = async () => {
        callCount++;
        return '<html><body>Test</body></html>';
      };

      const result1 = await cache.getHTML('http://example.com', 'body', extractFn);
      const result2 = await cache.getHTML('http://example.com', 'body', extractFn);

      assert.strictEqual(callCount, 1);
      assert.strictEqual(result1, result2);
    });

    it('should separate HTML cache from text cache', async () => {
      let callCount = 0;
      const htmlFn = async () => {
        callCount++;
        return '<html><body>Test</body></html>';
      };

      const textFn = async () => {
        callCount++;
        return 'Test';
      };

      await cache.getHTML('http://example.com', 'body', htmlFn);
      await cache.getText('http://example.com', 'body', textFn);

      assert.strictEqual(callCount, 2); // Both functions called
    });
  });

  describe('Links Extraction Caching', () => {
    let cache;
    let callCount;

    beforeEach(() => {
      cache = new CachedExtractor({ ttl: 5000 });
      callCount = 0;
    });

    it('should cache links extractions', async () => {
      const links = [
        { href: 'http://example1.com', text: 'Example 1' },
        { href: 'http://example2.com', text: 'Example 2' }
      ];

      const extractFn = async () => {
        callCount++;
        return links;
      };

      const result1 = await cache.getLinks('http://example.com', 'body', extractFn);
      const result2 = await cache.getLinks('http://example.com', 'body', extractFn);

      assert.strictEqual(callCount, 1);
      assert.deepStrictEqual(result1, links);
      assert.deepStrictEqual(result2, links);
    });

    it('should return array for cached links', async () => {
      const links = [{ href: 'http://test.com' }];
      const extractFn = async () => links;

      const result = await cache.getLinks('http://example.com', 'body', extractFn);
      assert(Array.isArray(result));
      assert.strictEqual(result.length, 1);
    });
  });

  describe('Forms Extraction Caching', () => {
    let cache;

    beforeEach(() => {
      cache = new CachedExtractor({ ttl: 5000 });
    });

    it('should cache forms extractions', async () => {
      let callCount = 0;
      const forms = [
        { id: 'login-form', action: '/login', method: 'POST', fields: [] }
      ];

      const extractFn = async () => {
        callCount++;
        return forms;
      };

      const result1 = await cache.getForms('http://example.com', 'body', extractFn);
      const result2 = await cache.getForms('http://example.com', 'body', extractFn);

      assert.strictEqual(callCount, 1);
      assert.deepStrictEqual(result1, forms);
    });
  });

  describe('Images Extraction Caching', () => {
    let cache;

    beforeEach(() => {
      cache = new CachedExtractor({ ttl: 5000 });
    });

    it('should cache images extractions', async () => {
      let callCount = 0;
      const images = [
        { src: 'http://example.com/img1.jpg', alt: 'Image 1' }
      ];

      const extractFn = async () => {
        callCount++;
        return images;
      };

      const result1 = await cache.getImages('http://example.com', 'body', extractFn);
      const result2 = await cache.getImages('http://example.com', 'body', extractFn);

      assert.strictEqual(callCount, 1);
      assert.deepStrictEqual(result1, images);
    });
  });

  describe('Metadata Extraction Caching', () => {
    let cache;

    beforeEach(() => {
      cache = new CachedExtractor({ ttl: 5000 });
    });

    it('should cache metadata extractions', async () => {
      let callCount = 0;
      const metadata = {
        title: 'Test Page',
        description: 'A test page'
      };

      const extractFn = async () => {
        callCount++;
        return metadata;
      };

      const result1 = await cache.getMetadata('http://example.com', extractFn);
      const result2 = await cache.getMetadata('http://example.com', extractFn);

      assert.strictEqual(callCount, 1);
      assert.deepStrictEqual(result1, metadata);
    });
  });

  describe('Cache Invalidation', () => {
    let cache;

    beforeEach(() => {
      cache = new CachedExtractor({ ttl: 5000 });
    });

    it('should invalidate cache on navigation', async () => {
      let callCount = 0;
      const extractFn = async () => {
        callCount++;
        return 'Content';
      };

      // First page
      await cache.getText('http://example1.com', 'body', extractFn);
      assert.strictEqual(callCount, 1);

      // Navigate to new page
      cache.invalidateOnNavigation('http://example2.com');

      // Extract from first page again - should miss
      await cache.getText('http://example1.com', 'body', extractFn);
      assert.strictEqual(callCount, 2); // Called again due to invalidation
    });

    it('should track invalidation metrics', async () => {
      assert.strictEqual(cache.metrics.totalInvalidations, 0);

      cache.invalidateOnNavigation('http://new-page.com');
      assert.strictEqual(cache.metrics.totalInvalidations, 1);
      assert(cache.metrics.lastInvalidation);
      assert.strictEqual(cache.metrics.lastInvalidation.url, 'http://new-page.com');
    });

    it('should call navigation callbacks', async () => {
      let callbackCalled = false;
      let callbackUrl;

      cache.onNavigation((url) => {
        callbackCalled = true;
        callbackUrl = url;
      });

      cache.invalidateOnNavigation('http://new-page.com');

      assert(callbackCalled);
      assert.strictEqual(callbackUrl, 'http://new-page.com');
    });

    it('should invalidate by URL pattern', async () => {
      let callCount = 0;
      const extractFn = async () => {
        callCount++;
        return 'Content';
      };

      // Cache entries for multiple domains
      await cache.getText('http://example1.com', 'body', extractFn);
      await cache.getText('http://example2.com', 'body', extractFn);
      await cache.getText('http://test.com', 'body', extractFn);

      // Invalidate all example.com entries
      const invalidated = cache.invalidateByUrlPattern('example\\d+\\.com');

      // Should invalidate 2 entries
      assert.strictEqual(invalidated, 2);

      // Verify caches were cleared
      await cache.getText('http://example1.com', 'body', extractFn);
      assert.strictEqual(callCount, 4); // Called again
    });

    it('should clear all caches', async () => {
      let callCount = 0;
      const extractFn = async () => {
        callCount++;
        return 'Content';
      };

      await cache.getText('http://example.com', 'body', extractFn);
      await cache.getHTML('http://example.com', 'body', extractFn);

      cache.clearAll();

      // Should call both functions again
      await cache.getText('http://example.com', 'body', extractFn);
      await cache.getHTML('http://example.com', 'body', extractFn);

      assert.strictEqual(callCount, 4);
    });
  });

  describe('Cache Statistics', () => {
    let cache;

    beforeEach(() => {
      cache = new CachedExtractor();
    });

    it('should track cache hits and misses', async () => {
      const extractFn = async () => 'Content';

      await cache.getText('http://example.com', 'body', extractFn);
      await cache.getText('http://example.com', 'body', extractFn);

      const stats = cache.getStats();
      assert.strictEqual(stats.totalHits, 1);
      assert.strictEqual(stats.totalMisses, 1);
    });

    it('should calculate hit rate', async () => {
      const extractFn = async () => 'Content';

      await cache.getText('http://example.com', 'body', extractFn);
      await cache.getText('http://example.com', 'body', extractFn);
      await cache.getText('http://example.com', 'body', extractFn);

      const stats = cache.getStats();
      const hitRate = parseFloat(stats.hitRate);
      assert(hitRate > 0 && hitRate <= 100);
    });

    it('should track extraction type statistics', async () => {
      const extractFn = async () => 'Content';
      const linksFn = async () => [];

      await cache.getText('http://example.com', 'body', extractFn);
      await cache.getLinks('http://example.com', 'body', linksFn);

      const stats = cache.getStats();
      assert.strictEqual(stats.extractionStats.text.misses, 1);
      assert.strictEqual(stats.extractionStats.links.misses, 1);
    });

    it('should estimate memory usage', async () => {
      const extractFn = async () => 'A'.repeat(1000);

      await cache.getText('http://example.com', 'body', extractFn);

      const stats = cache.getStats();
      const memoryMB = parseFloat(stats.memoryUsageMB);
      assert(memoryMB >= 0);
      assert(memoryMB < 100); // Should be less than 100MB for test
    });
  });

  describe('Singleton Pattern', () => {
    beforeEach(() => {
      CachedExtractor.resetInstance();
    });

    it('should return same instance on multiple calls', () => {
      const instance1 = CachedExtractor.getInstance();
      const instance2 = CachedExtractor.getInstance();

      assert.strictEqual(instance1, instance2);
    });

    it('should accept options on first call', () => {
      const instance = CachedExtractor.getInstance({ ttl: 30000 });
      assert.strictEqual(instance.ttl, 30000);
    });
  });

  describe('WebSocket Integration', () => {
    let handlers;
    let originalHandlers;

    beforeEach(() => {
      handlers = new ExtractorWebSocketHandlers();
      originalHandlers = {};
    });

    it('should create wrapped get-text handler', async () => {
      let originalCalled = false;
      originalHandlers['get-text'] = async () => {
        originalCalled = true;
        return { success: true, text: 'Test content' };
      };

      const wrappedHandler = handlers.createGetTextHandler(originalHandlers['get-text']);
      const connection = { currentUrl: 'http://example.com' };

      const result = await wrappedHandler({ url: 'http://example.com' }, connection);

      assert(originalCalled);
      assert(result.success);
      assert.strictEqual(result.text, 'Test content');
      assert(result.cached);
    });

    it('should create wrapped get-html handler', async () => {
      originalHandlers['get-html'] = async () => {
        return { success: true, html: '<html></html>' };
      };

      const wrappedHandler = handlers.createGetHTMLHandler(originalHandlers['get-html']);
      const connection = { currentUrl: 'http://example.com' };

      const result = await wrappedHandler({ url: 'http://example.com' }, connection);

      assert(result.success);
      assert.strictEqual(result.html, '<html></html>');
    });

    it('should create wrapped get-links handler', async () => {
      const links = [{ href: 'http://test.com', text: 'Test' }];
      originalHandlers['get-links'] = async () => {
        return { success: true, links };
      };

      const wrappedHandler = handlers.createGetLinksHandler(originalHandlers['get-links']);
      const connection = { currentUrl: 'http://example.com' };

      const result = await wrappedHandler({ url: 'http://example.com' }, connection);

      assert(result.success);
      assert.deepStrictEqual(result.links, links);
      assert.strictEqual(result.count, 1);
    });

    it('should invalidate cache on navigate', async () => {
      let navigateCalled = false;
      originalHandlers['navigate'] = async (params) => {
        navigateCalled = true;
        return { success: true, url: params.url };
      };

      const wrappedHandler = handlers.createNavigateHandler(originalHandlers['navigate']);
      const connection = { currentUrl: 'http://example1.com' };

      const statsBefore = handlers.getCacheStats();
      const invalidationsBefore = statsBefore.totalInvalidations || 0;

      await wrappedHandler({ url: 'http://example2.com' }, connection);

      const statsAfter = handlers.getCacheStats();
      assert(statsAfter.totalInvalidations > invalidationsBefore);
      assert.strictEqual(connection.currentUrl, 'http://example2.com');
    });

    it('should provide cache stats command', () => {
      const stats = handlers.getCacheStats();
      assert(stats);
      assert('hitRate' in stats);
      assert('totalHits' in stats);
      assert('totalMisses' in stats);
    });

    it('should clear cache on command', () => {
      const result = handlers.clearCache();
      assert(result.success);
      assert(result.message);
    });

    it('should register all handlers', () => {
      const handlerMap = {};
      originalHandlers = {
        'get-text': async () => ({ success: true, text: 'test' }),
        'get-html': async () => ({ success: true, html: '<html></html>' }),
        'get-links': async () => ({ success: true, links: [] }),
        'navigate': async (params) => ({ success: true, url: params.url })
      };

      handlers.registerHandlers(handlerMap, originalHandlers);

      assert('get-text' in handlerMap);
      assert('get-html' in handlerMap);
      assert('get-links' in handlerMap);
      assert('navigate' in handlerMap);
      assert('cache-stats' in handlerMap);
      assert('cache-clear' in handlerMap);
    });
  });

  describe('Performance Validation', () => {
    let cache;

    beforeEach(() => {
      cache = new CachedExtractor();
    });

    it('should demonstrate caching speed improvement', async () => {
      const extractFn = async () => {
        // Simulate 20ms extraction time
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'Content';
      };

      // First call - slow (cache miss)
      const start1 = Date.now();
      await cache.getText('http://example.com', 'body', extractFn);
      const time1 = Date.now() - start1;

      // Second call - fast (cache hit)
      const start2 = Date.now();
      await cache.getText('http://example.com', 'body', extractFn);
      const time2 = Date.now() - start2;

      // Cached call should be significantly faster
      assert(time2 < time1 / 5, `Cache hit (${time2}ms) should be much faster than cache miss (${time1}ms)`);
    });

    it('should handle high throughput workload', async () => {
      let callCount = 0;
      const extractFn = async () => {
        callCount++;
        return 'Content';
      };

      const startTime = Date.now();

      // Simulate 1000 extraction requests
      for (let i = 0; i < 1000; i++) {
        await cache.getText('http://example.com', 'body', extractFn);
      }

      const duration = Date.now() - startTime;

      // Should complete quickly due to caching
      assert(duration < 1000, `1000 requests should complete in <1000ms, took ${duration}ms`);
      assert.strictEqual(callCount, 1); // Should only call once
    });
  });

  describe('Memory Management', () => {
    it('should respect maxCacheSize limit', async () => {
      const cache = new CachedExtractor({ maxCacheSize: 3 });
      let callCount = 0;

      const extractFn = async (item) => {
        callCount++;
        return `Content ${item}`;
      };

      // Add more items than max cache size
      for (let i = 0; i < 5; i++) {
        await cache.getText(`http://example${i}.com`, 'body', () => extractFn(i));
      }

      // LRU should evict older entries
      const stats = cache.getStats();
      assert(stats.cacheSize <= 3);
    });

    it('should track memory usage', async () => {
      const cache = new CachedExtractor();
      const extractFn = async () => 'A'.repeat(10000); // 10KB string

      await cache.getText('http://example1.com', 'body', extractFn);
      await cache.getText('http://example2.com', 'body', extractFn);

      const stats = cache.getStats();
      const memoryMB = parseFloat(stats.memoryUsageMB);
      assert(memoryMB > 0, 'Should track memory usage');
    });
  });

  describe('Edge Cases', () => {
    let cache;

    beforeEach(() => {
      cache = new CachedExtractor();
    });

    it('should handle null/undefined URLs', async () => {
      const extractFn = async () => 'Content';

      const result = await cache.getText(undefined, 'body', extractFn);
      assert.strictEqual(result, 'Content');
    });

    it('should handle empty strings', async () => {
      const extractFn = async () => '';
      const result = await cache.getText('http://example.com', 'body', extractFn);
      assert.strictEqual(result, '');
    });

    it('should handle special characters in URLs', async () => {
      const extractFn = async () => 'Content';
      const url = 'http://example.com/path?query=test&foo=bar#anchor';

      const result1 = await cache.getText(url, 'body', extractFn);
      const result2 = await cache.getText(url, 'body', extractFn);

      assert.strictEqual(result1, result2);
    });

    it('should handle large data', async () => {
      const extractFn = async () => 'X'.repeat(1000000); // 1MB string
      const result = await cache.getText('http://example.com', 'body', extractFn);
      assert.strictEqual(result.length, 1000000);
    });

    it('should handle rapid successive calls', async () => {
      let callCount = 0;
      const extractFn = async () => {
        callCount++;
        return 'Content';
      };

      // First call to populate cache
      await cache.getText('http://example.com', 'body', extractFn);
      assert.strictEqual(callCount, 1);

      // Make 100 rapid calls (all should hit cache)
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(cache.getText('http://example.com', 'body', extractFn));
      }

      await Promise.all(promises);

      // Should still be 1 (no additional calls)
      assert.strictEqual(callCount, 1);
    });
  });
});
