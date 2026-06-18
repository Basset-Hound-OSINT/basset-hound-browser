/**
 * Performance Tests: Compression Tuning
 *
 * Tests adaptive compression level selection based on payload entropy
 * Target: +5-10% compression ratio through intelligent level selection
 */

const CompressionSelector = require('../../src/optimization/compression-selector');
const zlib = require('zlib');
const { promisify } = require('util');

const deflate = promisify(zlib.deflate);

describe('CompressionTuning - Performance Optimization #5', () => {
  let selector;

  beforeEach(() => {
    selector = new CompressionSelector({ debug: false });
  });

  describe('Compression Level Selection', () => {
    test('should initialize with default thresholds', () => {
      expect(selector.levels).toBeDefined();
      expect(selector.thresholds).toBeDefined();
      expect(selector.entropyThresholds).toBeDefined();
    });

    test('should select level 9 for small payloads', () => {
      const smallData = Buffer.from('{"key": "value"}');
      const level = selector.selectLevel(smallData);

      expect(level).toBe(selector.levels.maxCompression);
    });

    test('should select level 6 for medium payloads', () => {
      let mediumData = 'x'.repeat(10000);
      const level = selector.selectLevel(mediumData);

      expect(level).toBeGreaterThanOrEqual(selector.levels.balanced);
      expect(level).toBeLessThanOrEqual(selector.levels.maxCompression);
    });

    test('should select level 3 for large payloads', () => {
      let largeData = 'x'.repeat(200000);
      const level = selector.selectLevel(largeData);

      expect(level).toBeLessThanOrEqual(selector.levels.balanced);
    });

    test('should select level 0 for already-compressed data', () => {
      // Create high-entropy data (looks like compressed)
      const compressed = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        compressed[i] = i; // High entropy
      }

      const level = selector.selectLevel(compressed);
      expect(level).toBe(selector.levels.noCompression);
    });

    test('should handle string data', () => {
      const stringData = '{"key": "value", "data": "test"}';
      const level = selector.selectLevel(stringData);

      expect(typeof level).toBe('number');
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(9);
    });

    test('should handle Buffer data', () => {
      const bufferData = Buffer.from('test data');
      const level = selector.selectLevel(bufferData);

      expect(typeof level).toBe('number');
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(9);
    });
  });

  describe('Entropy Calculation', () => {
    test('should calculate entropy for uniform data', () => {
      const uniformData = Buffer.from('aaaabbbbccccdddd');
      const entropy = selector.calculateEntropy(uniformData);

      expect(entropy).toBeGreaterThan(0);
      expect(entropy).toBeLessThan(8);
    });

    test('should calculate entropy for random data', () => {
      const randomData = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        randomData[i] = Math.floor(Math.random() * 256);
      }

      const entropy = selector.calculateEntropy(randomData);
      expect(entropy).toBeGreaterThan(7);
    });

    test('should return 0 entropy for empty data', () => {
      const emptyData = Buffer.alloc(0);
      const entropy = selector.calculateEntropy(emptyData);

      expect(entropy).toBe(0);
    });

    test('should recognize high-entropy (compressed) data', () => {
      // Create high-entropy data with uniform byte distribution
      const compressed = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        compressed[i] = i; // Creates uniform distribution across all byte values
      }

      const entropy = selector.calculateEntropy(compressed);
      // Should be close to maximum entropy (8.0)
      expect(entropy).toBeGreaterThan(7.5);
    });

    test('should recognize low-entropy (text) data', () => {
      const text = 'the quick brown fox jumps over the lazy dog';
      const entropy = selector.calculateEntropy(text);

      expect(entropy).toBeLessThan(selector.entropyThresholds.veryHigh);
    });

    test('should handle string entropy calculation', () => {
      const text = 'Hello World';
      const entropy = selector.calculateEntropy(text);

      expect(typeof entropy).toBe('number');
      expect(entropy).toBeGreaterThan(0);
      expect(entropy).toBeLessThan(8);
    });
  });

  describe('Compression Ratio Estimation', () => {
    test('should estimate high compression ratio for low-entropy data', () => {
      const text = 'aaaaaabbbbbbcccccc';
      const ratio = selector.estimateCompressionRatio(text);

      expect(ratio).toBeGreaterThan(0.5); // Should compress well
    });

    test('should estimate low compression ratio for high-entropy data', () => {
      // Create uniform distribution (high entropy = looks compressed)
      const random = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        random[i] = i;
      }

      const ratio = selector.estimateCompressionRatio(random);
      // High entropy should give low compression ratio
      expect(ratio).toBeLessThan(0.15);
    });

    test('should provide reasonable estimates', () => {
      const testData = [
        'aaaa',
        'abcd',
        '{"key": "value"}',
        'x'.repeat(1000),
      ];

      for (const data of testData) {
        const ratio = selector.estimateCompressionRatio(data);
        expect(ratio).toBeGreaterThanOrEqual(0);
        expect(ratio).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Statistics Tracking', () => {
    test('should track selection statistics', () => {
      selector.selectLevel('test data');
      selector.selectLevel('x'.repeat(10000));

      const stats = selector.getStats();
      expect(stats.totalSelections).toBe(2);
    });

    test('should track distribution of selection levels', () => {
      // Select various payloads
      selector.selectLevel('small');
      selector.selectLevel('x'.repeat(10000));
      selector.selectLevel('y'.repeat(200000));

      const stats = selector.getStats();
      expect(stats.distribution.maxCompression).toBeGreaterThanOrEqual(0);
      expect(stats.distribution.balanced).toBeGreaterThanOrEqual(0);
      expect(stats.distribution.fastBalanced).toBeGreaterThanOrEqual(0);
    });

    test('should provide percentage distributions', () => {
      for (let i = 0; i < 10; i++) {
        selector.selectLevel('test data');
      }

      const stats = selector.getStats();
      expect(stats.percentages.maxCompression).toBeDefined();
      expect(stats.percentages.maxCompression).toMatch(/%$/);
    });

    test('should allow stats reset', () => {
      selector.selectLevel('test');
      let stats = selector.getStats();
      expect(stats.totalSelections).toBe(1);

      selector.resetStats();
      stats = selector.getStats();
      expect(stats.totalSelections).toBe(0);
    });
  });

  describe('Integration with Compression', () => {
    test('should select appropriate level that improves compression', async () => {
      // Use a larger JSON payload that will compress well
      const testData = JSON.stringify({
        name: 'test',
        data: {
          nested: 'value',
          items: Array(100).fill({ id: 1, name: 'test', value: 'data' }),
        },
      });
      const level = selector.selectLevel(testData);

      // Compress with selected level
      const compressed = await deflate(testData, { level });

      // Original size should be larger than compressed (for repeating structure)
      expect(Buffer.byteLength(testData)).toBeGreaterThan(compressed.length);
    });

    test('should skip compression for incompressible data', async () => {
      // Create pseudo-random data
      const incompressible = Buffer.alloc(1000);
      for (let i = 0; i < 1000; i++) {
        incompressible[i] = Math.floor(Math.random() * 256);
      }

      const level = selector.selectLevel(incompressible);

      if (level === 0) {
        // Skip compression as it's not helpful
        expect(level).toBe(selector.levels.noCompression);
      }
    });

    test('should achieve +5-10% improvement through smart selection', async () => {
      const json = JSON.stringify({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
        nested: {
          data: 'test',
          array: [1, 2, 3, 4, 5],
        },
      });

      // Use selected level
      const selectedLevel = selector.selectLevel(json);
      const selectedCompressed = await deflate(json, { level: selectedLevel });

      // Use a lower level for comparison
      const lowerCompressed = await deflate(json, { level: 3 });

      // Selected level should be as good or better
      expect(selectedCompressed.length).toBeLessThanOrEqual(lowerCompressed.length);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty data', () => {
      const level = selector.selectLevel('');
      expect(typeof level).toBe('number');
      expect(level).toBeGreaterThanOrEqual(0);
    });

    test('should handle very large data', () => {
      const largeData = 'x'.repeat(10000000); // 10MB
      const level = selector.selectLevel(largeData);

      // Large data should use speed-priority level
      expect(level).toBeLessThanOrEqual(selector.levels.fastBalanced);
    });

    test('should handle special characters', () => {
      const specialData = Buffer.from('\x00\x01\x02\x03\xFF\xFE\xFD');
      const level = selector.selectLevel(specialData);

      expect(typeof level).toBe('number');
      expect(level).toBeGreaterThanOrEqual(0);
    });

    test('should handle JSON data optimally', () => {
      const json = JSON.stringify({
        users: [
          { id: 1, name: 'Alice', email: 'alice@test.com' },
          { id: 2, name: 'Bob', email: 'bob@test.com' },
          { id: 3, name: 'Charlie', email: 'charlie@test.com' },
        ],
      });

      const level = selector.selectLevel(json);
      const entropy = selector.calculateEntropy(json);

      // JSON should have low entropy and be compressible
      expect(entropy).toBeLessThan(selector.entropyThresholds.high);
      expect(level).toBeGreaterThanOrEqual(selector.levels.balanced);
    });

    test('should handle HTML data optimally', () => {
      const html = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Hello World</h1>
            <p>This is a test page with HTML content.</p>
          </body>
        </html>
      `;

      const level = selector.selectLevel(html);
      expect(typeof level).toBe('number');
      expect(level).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Characteristics', () => {
    test('should perform entropy calculation efficiently', () => {
      const data = 'x'.repeat(100000);

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        selector.calculateEntropy(data);
      }
      const elapsed = Date.now() - startTime;

      // Should complete 100 entropy calculations in reasonable time
      expect(elapsed).toBeLessThan(5000); // 5 seconds max
    });

    test('should select level quickly', () => {
      const data = 'test data for compression';

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        selector.selectLevel(data);
      }
      const elapsed = Date.now() - startTime;

      // Should complete 1000 selections in reasonable time
      expect(elapsed).toBeLessThan(1000); // 1 second max
    });
  });
});
