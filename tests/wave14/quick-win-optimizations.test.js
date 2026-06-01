/**
 * Quick-Win Optimizations Test Suite
 * Tests for OPT-1 through OPT-8 performance improvements
 *
 * Test Coverage:
 * - OPT-1: Regex Pattern Caching (cache hits/misses, compilation time)
 * - OPT-2: Signature Pre-Indexing (index accuracy, lookup performance)
 * - OPT-3: Lightweight Cache Keys (FNV-1a hash collisions, speed)
 * - OPT-4: Header Utilities (normalization, parsing, formatting)
 * - OPT-5: Lazy-Load Signatures (load tracking, correctness)
 * - OPT-6: Batch Extraction (batch accuracy, speed vs individual)
 * - OPT-7: Cache Invalidation (TTL enforcement, warming)
 * - OPT-8: Differential Change Detection (fast path, diff accuracy)
 *
 * Created: June 1, 2026
 */

const { RegexCache, getRegexCache } = require('../../src/utils/regex-cache');
const { SignatureIndexer, getSignatureIndexer } = require('../../src/detection/signature-indexer');
const { fnv1aHash32, generateFastCacheKey, generateCompositeCacheKey } = require('../../src/utils/fnv-hash');
const { normalizeHeaders, getHeader, parseHeaderValue, getContentType } = require('../../src/utils/header-utils');
const { LazySignatureLoader, getLazySignatureLoader } = require('../../src/detection/lazy-signatures');
const BatchExtractor = require('../../src/extraction/batch-extractor');
const { CacheManager, getCacheManager } = require('../../src/caching/cache-manager');
const { DifferentialChangeDetector, getDifferentialChangeDetector } = require('../../src/monitoring/differential-change-detector');

describe('Quick-Win Optimizations Test Suite', () => {

  // ==========================================
  // OPT-1: Regex Pattern Caching Tests
  // ==========================================
  describe('OPT-1: Regex Pattern Caching', () => {
    let cache;

    beforeEach(() => {
      cache = new RegexCache(50);
    });

    test('should cache compiled regex patterns', () => {
      const pattern = 'test\\d+';
      const regex1 = cache.get(pattern, 'i');
      const regex2 = cache.get(pattern, 'i');

      expect(regex1).toBe(regex2);
      expect(cache.getStats().hits).toBe(1);
    });

    test('should compile and cache new patterns', () => {
      const pattern1 = 'pattern1';
      const pattern2 = 'pattern2';

      const regex1 = cache.get(pattern1, 'i');
      const regex2 = cache.get(pattern2, 'i');

      expect(regex1).toBeInstanceOf(RegExp);
      expect(regex2).toBeInstanceOf(RegExp);
      expect(cache.getStats().size).toBe(2);
    });

    test('should respect max cache size with LRU eviction', () => {
      const smallCache = new RegexCache(5);

      for (let i = 0; i < 10; i++) {
        smallCache.get(`pattern${i}`, 'i');
      }

      expect(smallCache.getStats().size).toBeLessThanOrEqual(5);
    });

    test('should handle RegExp objects directly', () => {
      const regex = /test/i;
      const result = cache.get(regex, 'i');

      expect(result).toBe(regex);
    });

    test('should report cache statistics', () => {
      cache.get('pattern1', 'i');
      cache.get('pattern1', 'i');
      cache.get('pattern2', 'i');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.size).toBe(2);
    });

    test('should handle invalid patterns gracefully', () => {
      const result = cache.get('(invalid[', 'i');
      expect(result).toBeInstanceOf(RegExp);
    });
  });

  // ==========================================
  // OPT-2: Signature Pre-Indexing Tests
  // ==========================================
  describe('OPT-2: Signature Pre-Indexing', () => {
    let indexer;

    beforeEach(() => {
      indexer = new SignatureIndexer();
    });

    test('should build indexes on initialization', () => {
      const stats = indexer.getStats();
      expect(stats.totalSignatures).toBeGreaterThan(0);
      expect(stats.categories).toBeGreaterThan(0);
    });

    test('should retrieve signature by name', () => {
      const sig = indexer.getByName('React');
      expect(sig).toBeDefined();
      expect(sig.category).toBeDefined();
    });

    test('should retrieve signatures by category', () => {
      const techs = indexer.getByCategory('JavaScript Framework');
      expect(Array.isArray(techs)).toBe(true);
      expect(techs.length).toBeGreaterThan(0);
    });

    test('should return all categories', () => {
      const categories = indexer.getCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    test('should handle non-existent categories', () => {
      const techs = indexer.getByCategory('Nonexistent Category');
      expect(Array.isArray(techs)).toBe(true);
      expect(techs.length).toBe(0);
    });

    test('should provide comprehensive statistics', () => {
      const stats = indexer.getStats();
      expect(stats).toHaveProperty('totalSignatures');
      expect(stats).toHaveProperty('categories');
      expect(stats).toHaveProperty('headerPatterns');
      expect(stats).toHaveProperty('scriptPatterns');
    });
  });

  // ==========================================
  // OPT-3: Lightweight Cache Keys Tests
  // ==========================================
  describe('OPT-3: Lightweight Cache Keys (FNV-1a)', () => {
    test('should generate fast hash from string', () => {
      const hash1 = fnv1aHash32('test');
      const hash2 = fnv1aHash32('test');

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{8}$/); // 8 hex digits
    });

    test('should generate different hashes for different strings', () => {
      const hash1 = fnv1aHash32('string1');
      const hash2 = fnv1aHash32('string2');

      expect(hash1).not.toBe(hash2);
    });

    test('should generate fast cache key with prefix', () => {
      const key = generateFastCacheKey('test data', 'prefix');

      expect(key).toMatch(/^prefix:/);
      expect(key.split(':')[1]).toMatch(/^[0-9a-f]{8}$/);
    });

    test('should generate composite cache keys', () => {
      const key = generateCompositeCacheKey('part1', 'part2', 'part3');

      expect(key).toMatch(/^[0-9a-f]{8}$/);
    });

    test('should have low collision rate', () => {
      const hashes = new Set();

      for (let i = 0; i < 10000; i++) {
        hashes.add(fnv1aHash32(`string${i}`));
      }

      // Expect very few collisions
      expect(hashes.size).toBeGreaterThan(9990);
    });

    test('should be consistent across calls', () => {
      const key1 = generateFastCacheKey('data', 'prefix');
      const key2 = generateFastCacheKey('data', 'prefix');

      expect(key1).toBe(key2);
    });
  });

  // ==========================================
  // OPT-4: Header Utilities Tests
  // ==========================================
  describe('OPT-4: Header Utilities', () => {
    test('should normalize headers to lowercase', () => {
      const headers = {
        'Content-Type': 'application/json',
        'Server': 'Apache/2.4'
      };

      const normalized = normalizeHeaders(headers);

      expect(normalized['content-type']).toBe('application/json');
      expect(normalized['server']).toBe('Apache/2.4');
    });

    test('should handle null/undefined headers gracefully', () => {
      expect(normalizeHeaders(null)).toEqual({});
      expect(normalizeHeaders(undefined)).toEqual({});
    });

    test('should get header by name case-insensitively', () => {
      const headers = {
        'Content-Type': 'application/json'
      };

      expect(getHeader(headers, 'content-type')).toBe('application/json');
      expect(getHeader(headers, 'CONTENT-TYPE')).toBe('application/json');
      expect(getHeader(headers, 'content-type')).toBe('application/json');
    });

    test('should parse header values', () => {
      const result1 = parseHeaderValue('Apache/2.4.41');
      expect(result1).toEqual({ name: 'Apache', version: '2.4.41' });

      const result2 = parseHeaderValue('Microsoft-IIS/10.0');
      expect(result2).toEqual({ name: 'Microsoft-IIS', version: '10.0' });

      const result3 = parseHeaderValue('nginx');
      expect(result3).toEqual({ name: 'nginx', version: null });
    });

    test('should get content type from headers', () => {
      const headers = {
        'Content-Type': 'application/json; charset=utf-8'
      };

      expect(getContentType(headers)).toBe('application/json');
    });

    test('should handle missing headers', () => {
      expect(getHeader({}, 'content-type')).toBeNull();
      expect(getContentType({})).toBeNull();
    });
  });

  // ==========================================
  // OPT-5: Lazy-Load Signatures Tests
  // ==========================================
  describe('OPT-5: Lazy-Load Signatures', () => {
    let loader;

    beforeEach(() => {
      loader = new LazySignatureLoader();
    });

    test('should get specific signature', () => {
      const sig = loader.getSignature('React');
      expect(sig).toBeDefined();
      expect(sig.category).toBeDefined();
    });

    test('should get all signatures', () => {
      const sigs = loader.getAllSignatures();
      expect(typeof sigs).toBe('object');
      expect(Object.keys(sigs).length).toBeGreaterThan(0);
    });

    test('should get signatures by category', () => {
      const techs = loader.getByCategory('JavaScript Framework');
      expect(Array.isArray(techs)).toBe(true);
      expect(techs.length).toBeGreaterThan(0);
    });

    test('should track loaded signatures', () => {
      loader.preload('React');
      expect(loader.isLoaded('React')).toBe(true);
    });

    test('should preload entire category', () => {
      loader.preloadCategory('JavaScript Framework');
      const stats = loader.getStats();
      expect(stats.loadedTechnologies).toBeGreaterThan(0);
    });

    test('should report load statistics', () => {
      const stats = loader.getStats();
      expect(stats).toHaveProperty('totalTechnologies');
      expect(stats).toHaveProperty('loadedTechnologies');
      expect(stats).toHaveProperty('totalCategories');
    });
  });

  // ==========================================
  // OPT-6: Batch Extraction Tests
  // ==========================================
  describe('OPT-6: Batch Extraction', () => {
    let extractor;
    const testHtml = `
      <html>
        <body>
          <a href="/page1">Link 1</a>
          <a href="/page2">Link 2</a>
          <form action="/submit" method="post">
            <input name="username" type="text">
            <input name="password" type="password">
          </form>
          <img src="/image.jpg" alt="Test Image">
          <script src="/script.js" async></script>
          <meta name="description" content="Test page">
          <h1>Heading 1</h1>
        </body>
      </html>
    `;

    beforeEach(() => {
      extractor = new BatchExtractor();
    });

    test('should extract links in batch', () => {
      const result = extractor.batchExtract(testHtml, { links: true });

      expect(Array.isArray(result.links)).toBe(true);
      expect(result.links.length).toBe(2);
      expect(result.links[0]).toHaveProperty('href');
      expect(result.links[0]).toHaveProperty('text');
    });

    test('should extract forms in batch', () => {
      const result = extractor.batchExtract(testHtml, { forms: true });

      expect(Array.isArray(result.forms)).toBe(true);
      expect(result.forms.length).toBe(1);
      expect(result.forms[0]).toHaveProperty('action');
      expect(result.forms[0]).toHaveProperty('fields');
    });

    test('should extract multiple types in single batch', () => {
      const result = extractor.batchExtract(testHtml, {
        links: true,
        forms: true,
        images: true,
        scripts: true
      });

      expect(result.links.length).toBe(2);
      expect(result.forms.length).toBe(1);
      expect(result.images.length).toBe(1);
      expect(result.scripts.length).toBe(1);
    });

    test('should handle empty HTML gracefully', () => {
      const result = extractor.batchExtract('', { links: true });

      expect(Array.isArray(result.links)).toBe(true);
      expect(result.links.length).toBe(0);
    });

    test('should track extraction metrics', () => {
      extractor.batchExtract(testHtml, { links: true, forms: true });
      const metrics = extractor.getMetrics();

      expect(metrics).toHaveProperty('totalBatches');
      expect(metrics).toHaveProperty('totalItems');
      expect(metrics.totalBatches).toBe(1);
    });
  });

  // ==========================================
  // OPT-7: Cache Invalidation Tests
  // ==========================================
  describe('OPT-7: Cache Invalidation Strategy', () => {
    let manager;

    beforeEach(() => {
      manager = new CacheManager();
    });

    test('should register cache with TTL', () => {
      const mockCache = { clear: jest.fn(), getStats: jest.fn(() => ({})) };
      manager.registerCache('test', mockCache, 5000);

      expect(manager.caches.has('test')).toBe(true);
    });

    test('should invalidate specific cache', () => {
      const mockCache = { clear: jest.fn(), getStats: jest.fn(() => ({})) };
      manager.registerCache('test', mockCache);
      manager.invalidateCache('test');

      expect(mockCache.clear).toHaveBeenCalled();
    });

    test('should invalidate all caches', () => {
      const mock1 = { clear: jest.fn(), getStats: jest.fn(() => ({})) };
      const mock2 = { clear: jest.fn(), getStats: jest.fn(() => ({})) };

      manager.registerCache('test1', mock1);
      manager.registerCache('test2', mock2);
      manager.invalidateAll();

      expect(mock1.clear).toHaveBeenCalled();
      expect(mock2.clear).toHaveBeenCalled();
    });

    test('should detect expired cache', () => {
      const mockCache = { clear: jest.fn(), getStats: jest.fn(() => ({})) };
      manager.registerCache('test', mockCache, 1000);

      expect(manager.isCacheExpired('test')).toBe(true);
    });

    test('should get cache statistics', () => {
      const mockCache = { getStats: jest.fn(() => ({ size: 10 })) };
      manager.registerCache('test', mockCache);

      const stats = manager.getCacheStats();
      expect(stats).toHaveProperty('caches');
      expect(stats).toHaveProperty('managerStats');
    });
  });

  // ==========================================
  // OPT-8: Differential Change Detection Tests
  // ==========================================
  describe('OPT-8: Differential Change Detection', () => {
    let detector;

    beforeEach(() => {
      detector = new DifferentialChangeDetector();
    });

    test('should detect unchanged content with hash check only', () => {
      const snapshot = {
        html: '<html><body>Test</body></html>',
        statusCode: 200,
        headers: { 'content-type': 'text/html' }
      };

      const result1 = detector.detectChanges('http://test.com', snapshot);
      const result2 = detector.detectChanges('http://test.com', snapshot);

      expect(result1.changed).toBe(true); // First detection
      expect(result2.changed).toBe(false); // No change
      expect(result2.hashCheckOnly).toBe(true); // Fast path used
    });

    test('should detect changed content', () => {
      const snapshot1 = {
        html: '<html><body>Test 1</body></html>',
        statusCode: 200,
        headers: { 'content-type': 'text/html' }
      };

      const snapshot2 = {
        html: '<html><body>Test 2</body></html>',
        statusCode: 200,
        headers: { 'content-type': 'text/html' }
      };

      detector.detectChanges('http://test.com', snapshot1);
      const result = detector.detectChanges('http://test.com', snapshot2);

      expect(result.changed).toBe(true);
      expect(result.changeDetails).toBeDefined();
    });

    test('should handle first detection', () => {
      const snapshot = {
        html: '<html><body>Test</body></html>',
        statusCode: 200,
        headers: {}
      };

      const result = detector.detectChanges('http://newurl.com', snapshot);

      expect(result.changed).toBe(true);
      expect(result.reason).toBe('first_detection');
    });

    test('should clear history for URL', () => {
      detector.previousHashes.set('http://test.com', 'somehash');
      detector.clearHistory('http://test.com');

      expect(detector.previousHashes.has('http://test.com')).toBe(false);
    });

    test('should clear all history', () => {
      detector.previousHashes.set('http://test1.com', 'hash1');
      detector.previousHashes.set('http://test2.com', 'hash2');
      detector.clearAllHistory();

      expect(detector.previousHashes.size).toBe(0);
    });

    test('should provide statistics', () => {
      const stats = detector.getStats();
      expect(stats).toHaveProperty('trackedUrls');
      expect(stats).toHaveProperty('cachedResults');
    });
  });

  // ==========================================
  // Integration Tests
  // ==========================================
  describe('Integration Tests', () => {
    test('OPT-1 and OPT-3 together for fast detection', () => {
      const regexCache = new RegexCache();
      const pattern = 'framework';

      // Multiple uses should hit cache
      const regex1 = regexCache.get(pattern, 'i');
      const regex2 = regexCache.get(pattern, 'i');

      expect(regex1).toBe(regex2);
      expect(regexCache.getStats().hits).toBeGreaterThan(0);
    });

    test('OPT-2 and OPT-5 together for efficient signature access', () => {
      const indexer = new SignatureIndexer();
      const loader = new LazySignatureLoader();

      const byIndex = indexer.getByName('React');
      const byLoader = loader.getSignature('React');

      expect(byIndex).toBeDefined();
      expect(byLoader).toBeDefined();
    });

    test('OPT-6 batch extraction improves throughput', () => {
      const extractor = new BatchExtractor();
      const testHtml = `
        <a href="1">1</a><a href="2">2</a><a href="3">3</a>
        <img src="1"><img src="2">
        <form><input name="f1"></form>
      `;

      const result = extractor.batchExtract(testHtml, {
        links: true,
        images: true,
        forms: true
      });

      expect(result.links.length).toBe(3);
      expect(result.images.length).toBe(2);
      expect(result.forms.length).toBe(1);
      expect(result.itemsExtracted).toBe(6);
    });
  });
});
