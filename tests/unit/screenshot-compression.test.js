/**
 * Compression Pipeline Test Suite
 *
 * Tests for streaming compression, codec selection, and efficiency
 */

const { CompressionPipeline } = require('../../screenshots/compression-pipeline');

describe('CompressionPipeline', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new CompressionPipeline();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const stats = pipeline.getStats();
      expect(stats.totalCompressed).toBe(0);
      expect(stats.totalDecompressed).toBe(0);
    });
  });

  describe('codec selection', () => {
    it('should select gzip for PNG', () => {
      const codec = pipeline.getOptimalCodec('image/png');
      expect(codec.codec).toBe('gzip');
      expect(codec.level).toBe(9);  // High compression for PNG
    });

    it('should select deflate for JPEG', () => {
      const codec = pipeline.getOptimalCodec('image/jpeg');
      expect(codec.codec).toBe('deflate');
    });

    it('should select brotli for WebP', () => {
      const codec = pipeline.getOptimalCodec('image/webp');
      expect(codec.codec).toBe('brotli');
    });

    it('should return default codec for unknown format', () => {
      const codec = pipeline.getOptimalCodec('image/unknown');
      expect(codec.codec).toBe('gzip');
    });
  });

  describe('compression', () => {
    it('should compress data with gzip', async () => {
      const data = Buffer.from('Hello, World!'.repeat(100));
      const compressed = await pipeline.compress(data, 'gzip', 6);

      expect(Buffer.isBuffer(compressed)).toBe(true);
      expect(compressed.length).toBeLessThan(data.length);
    });

    it('should compress data with deflate', async () => {
      const data = Buffer.from('Test data'.repeat(100));
      const compressed = await pipeline.compress(data, 'deflate', 6);

      expect(Buffer.isBuffer(compressed)).toBe(true);
      expect(compressed.length).toBeLessThan(data.length);
    });

    it('should compress data with brotli', async () => {
      const data = Buffer.from('Brotli compression test'.repeat(100));
      const compressed = await pipeline.compress(data, 'brotli', 6);

      expect(Buffer.isBuffer(compressed)).toBe(true);
      expect(compressed.length).toBeLessThan(data.length);
    });

    it('should reject unknown codec', async () => {
      const data = Buffer.from('Test');
      expect(async () => {
        await pipeline.compress(data, 'unknown', 6);
      }).rejects.toThrow();
    });

    it('should update statistics', async () => {
      const data = Buffer.from('Test'.repeat(1000));
      await pipeline.compress(data, 'gzip');

      const stats = pipeline.getStats();
      expect(stats.totalCompressed).toBe(1);
      expect(stats.totalBytesIn).toBe(data.length);
      expect(stats.totalBytesOut).toBeGreaterThan(0);
      expect(stats.totalBytesOut).toBeLessThan(data.length);
    });
  });

  describe('decompression', () => {
    it('should decompress gzip data', async () => {
      const original = Buffer.from('Hello, World!'.repeat(100));
      const compressed = await pipeline.compress(original, 'gzip');
      const decompressed = await pipeline.decompress(compressed, 'gzip');

      expect(decompressed.toString()).toBe(original.toString());
    });

    it('should decompress deflate data', async () => {
      const original = Buffer.from('Test data'.repeat(100));
      const compressed = await pipeline.compress(original, 'deflate');
      const decompressed = await pipeline.decompress(compressed, 'deflate');

      expect(decompressed.toString()).toBe(original.toString());
    });

    it('should decompress brotli data', async () => {
      const original = Buffer.from('Brotli test'.repeat(100));
      const compressed = await pipeline.compress(original, 'brotli');
      const decompressed = await pipeline.decompress(compressed, 'brotli');

      expect(decompressed.toString()).toBe(original.toString());
    });
  });

  describe('optimized compression', () => {
    it('should compress with format optimization', async () => {
      const data = Buffer.from('PNG data'.repeat(100));
      const result = await pipeline.compressOptimized(data, 'image/png');

      expect(result.success).toBe(true);
      expect(result.codec).toBe('gzip');
      expect(result.compressedSize).toBeLessThan(result.originalSize);
      expect(parseFloat(result.ratio)).toBeGreaterThan(0);
    });

    it('should handle compression failure gracefully', async () => {
      const result = await pipeline.compressOptimized(null, 'image/png');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('codec detection', () => {
    it('should detect gzip format', async () => {
      const data = Buffer.from('Test'.repeat(100));
      const compressed = await pipeline.compress(data, 'gzip');

      const detected = pipeline.detectCodec(compressed);
      expect(detected).toBe('gzip');
    });

    it('should detect deflate format', async () => {
      const data = Buffer.from('Test'.repeat(100));
      const compressed = await pipeline.compress(data, 'deflate');

      const detected = pipeline.detectCodec(compressed);
      expect(detected).toBe('deflate');
    });

    it('should return unknown for unrecognized format', () => {
      const data = Buffer.from('Random data');
      const detected = pipeline.detectCodec(data);

      expect(detected).toBe('unknown');
    });

    it('should handle short buffers', () => {
      const short = Buffer.from([0x1f]);
      const detected = pipeline.detectCodec(short);

      expect(detected).toBe('unknown');
    });
  });

  describe('codec comparison', () => {
    it('should compare compression efficiency', async () => {
      const data = Buffer.from('Compression comparison test'.repeat(100));
      const results = await pipeline.compareCodecs(data);

      expect(results.gzip).toBeDefined();
      expect(results.deflate).toBeDefined();
      expect(results.brotli).toBeDefined();

      // All should compress successfully
      for (const codec of ['gzip', 'deflate', 'brotli']) {
        expect(results[codec].compressedSize).toBeGreaterThan(0);
        expect(results[codec].originalSize).toBe(data.length);
      }
    });
  });

  describe('statistics', () => {
    it('should calculate compression ratio', async () => {
      const data = Buffer.from('Test'.repeat(1000));
      await pipeline.compress(data, 'gzip');

      const stats = pipeline.getStats();
      expect(parseFloat(stats.averageRatio)).toBeGreaterThan(0);
    });

    it('should track codec usage', async () => {
      const data = Buffer.from('Test'.repeat(100));

      await pipeline.compress(data, 'gzip');
      await pipeline.compress(data, 'deflate');
      await pipeline.compress(data, 'gzip');

      const stats = pipeline.getStats();
      expect(stats.codecUsage.gzip).toBe(2);
      expect(stats.codecUsage.deflate).toBe(1);
    });

    it('should reset statistics', async () => {
      const data = Buffer.from('Test'.repeat(100));
      await pipeline.compress(data, 'gzip');

      pipeline.resetStats();

      const stats = pipeline.getStats();
      expect(stats.totalCompressed).toBe(0);
      expect(stats.totalBytesIn).toBe(0);
    });
  });

  describe('worker creation', () => {
    it('should create worker for codec', async () => {
      const worker = pipeline.createWorker('gzip');

      expect(worker.id).toBeDefined();
      expect(worker.codec).toBe('gzip');
      expect(typeof worker.compress).toBe('function');
      expect(typeof worker.decompress).toBe('function');
    });

    it('should use worker for compression', async () => {
      const worker = pipeline.createWorker('gzip');
      const data = Buffer.from('Worker test'.repeat(100));

      const compressed = await worker.compress(data);
      const decompressed = await worker.decompress(compressed);

      expect(decompressed.toString()).toBe(data.toString());
    });
  });
});

describe('Compression Performance', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new CompressionPipeline();
  });

  it('should achieve high compression on repetitive data', async () => {
    const repetitiveData = Buffer.from('A'.repeat(10000));
    const result = await pipeline.compressOptimized(repetitiveData);

    expect(result.success).toBe(true);
    expect(parseFloat(result.ratio)).toBeGreaterThan(95);  // >95% reduction
  });

  it('should handle large data efficiently', async () => {
    const largeData = Buffer.alloc(10 * 1024 * 1024);  // 10MB
    largeData.fill('A');

    const start = Date.now();
    const result = await pipeline.compressOptimized(largeData);
    const duration = Date.now() - start;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(5000);  // Should complete in reasonable time
  });

  it('should maintain compression ratio across formats', async () => {
    const testData = Buffer.from('Image data test'.repeat(1000));

    const pngResult = await pipeline.compressOptimized(testData, 'image/png');
    const jpegResult = await pipeline.compressOptimized(testData, 'image/jpeg');

    expect(pngResult.success).toBe(true);
    expect(jpegResult.success).toBe(true);

    // PNG should have higher compression (gzip level 9)
    expect(parseFloat(pngResult.ratio)).toBeGreaterThanOrEqual(parseFloat(jpegResult.ratio));
  });
});
