/**
 * Screenshot Streaming Test Suite
 *
 * Tests for large file streaming, chunking, compression, and resumable transfers
 */

const { ScreenshotStreamer, STREAMING_CONFIG } = require('../../screenshots/streaming');

describe('ScreenshotStreamer', () => {
  let streamer;

  beforeEach(() => {
    streamer = new ScreenshotStreamer();
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      expect(streamer.options.defaultChunkSize).toBe(STREAMING_CONFIG.defaultChunkSize);
      expect(streamer.options.compressionLevel).toBe(STREAMING_CONFIG.compressionLevel);
    });

    it('should accept custom options', () => {
      const custom = new ScreenshotStreamer({
        defaultChunkSize: 128 * 1024,
        compressionLevel: 9
      });

      expect(custom.options.defaultChunkSize).toBe(128 * 1024);
      expect(custom.options.compressionLevel).toBe(9);
    });

    it('should initialize with empty active streams', () => {
      expect(streamer.activeStreams.size).toBe(0);
      expect(streamer.sessionRegistry.size).toBe(0);
    });
  });

  describe('createCompressedReadStream', () => {
    it('should create compressed stream handle', async () => {
      const testData = Buffer.alloc(100 * 1024);

      const handle = await streamer.createCompressedReadStream(testData);

      expect(handle.sessionId).toBeDefined();
      expect(handle.totalSize).toBeLessThan(testData.length);
      expect(handle.compressed).toBe(true);
      expect(handle.compression).toBe('gzip');
    });

    it('should provide stream chunk retrieval', async () => {
      const testData = Buffer.alloc(100 * 1024);

      const handle = await streamer.createCompressedReadStream(testData, {
        compression: 'gzip',
        chunkSize: 32 * 1024
      });

      const chunk1 = handle.getNextChunk();
      expect(chunk1).toBeDefined();
      expect(chunk1.chunkIndex).toBe(0);
      expect(chunk1.sessionId).toBe(handle.sessionId);
    });

    it('should track compression ratio', async () => {
      const testData = Buffer.alloc(100 * 1024);

      const handle = await streamer.createCompressedReadStream(testData);

      const ratio = handle.totalSize / handle.originalSize;
      expect(ratio).toBeLessThan(1);
      expect(ratio).toBeGreaterThan(0);
    });

    it('should register session for later retrieval', async () => {
      const testData = Buffer.alloc(50 * 1024);

      const handle = await streamer.createCompressedReadStream(testData);

      const retrieved = streamer.sessionRegistry.get(handle.sessionId);
      expect(retrieved).toBeDefined();
    });
  });

  describe('resumeStream', () => {
    it('should resume stream from offset', async () => {
      const testData = Buffer.alloc(100 * 1024);

      const handle = await streamer.createCompressedReadStream(testData, {
        chunkSize: 16 * 1024
      });

      const resumeInfo = streamer.resumeStream(handle.sessionId, 32 * 1024);

      expect(resumeInfo.sessionId).toBe(handle.sessionId);
      expect(resumeInfo.resumedAt).toBe(32 * 1024);
      expect(resumeInfo.remainingBytes).toBeLessThanOrEqual(handle.totalSize);
    });

    it('should throw error for unknown session', () => {
      expect(() => {
        streamer.resumeStream('unknown-session-id');
      }).toThrow('Stream not found');
    });

    it('should reset stream position for resume', async () => {
      const testData = Buffer.alloc(50 * 1024);

      const handle = await streamer.createCompressedReadStream(testData, {
        chunkSize: 16 * 1024
      });

      // Get initial chunks
      handle.getNextChunk();
      handle.getNextChunk();

      // Resume from different offset
      streamer.resumeStream(handle.sessionId, 0);

      const chunk = handle.getNextChunk();
      expect(chunk.chunkIndex).toBe(0);
    });
  });

  describe('getStreamStats', () => {
    it('should report stream statistics', async () => {
      const testData = Buffer.alloc(100 * 1024);

      const handle = await streamer.createCompressedReadStream(testData);

      const stats = streamer.getStreamStats(handle.sessionId);

      expect(stats.originalSize).toBe(testData.length);
      expect(stats.compressedSize).toBeDefined();
      expect(stats.compressionRatio).toBeDefined();
      expect(stats.totalChunks).toBeGreaterThan(0);
    });

    it('should return error for unknown session', () => {
      const stats = streamer.getStreamStats('unknown-id');
      expect(stats.error).toBeDefined();
    });

    it('should track progress in stats', async () => {
      const testData = Buffer.alloc(50 * 1024);

      const handle = await streamer.createCompressedReadStream(testData);

      const stats1 = streamer.getStreamStats(handle.sessionId);
      expect(stats1.totalChunks).toBeGreaterThan(0);
      expect(stats1.currentChunk).toBeGreaterThanOrEqual(0);

      // Retrieve first chunk
      const chunk = handle.getNextChunk();
      expect(chunk).toBeDefined();

      const stats2 = streamer.getStreamStats(handle.sessionId);
      expect(stats2.currentChunk).toBeGreaterThanOrEqual(stats1.currentChunk);
    });
  });

  describe('closeStream', () => {
    it('should close stream session', async () => {
      const testData = Buffer.alloc(50 * 1024);

      const handle = await streamer.createCompressedReadStream(testData);

      const closed = streamer.closeStream(handle.sessionId);

      expect(closed).toBe(true);
      expect(streamer.sessionRegistry.has(handle.sessionId)).toBe(false);
    });

    it('should return false for unknown session', () => {
      const closed = streamer.closeStream('unknown-id');
      expect(closed).toBe(false);
    });
  });

  describe('getActiveStreams', () => {
    it('should list all active streams', async () => {
      const testData1 = Buffer.alloc(50 * 1024);
      const testData2 = Buffer.alloc(100 * 1024);

      await streamer.createCompressedReadStream(testData1);
      await streamer.createCompressedReadStream(testData2);

      const active = streamer.getActiveStreams();

      expect(active.length).toBe(2);
      expect(active[0]).toHaveProperty('sessionId');
      expect(active[0]).toHaveProperty('totalSize');
    });

    it('should return empty array when no streams', () => {
      const active = streamer.getActiveStreams();
      expect(active.length).toBe(0);
    });
  });

  describe('data conversion', () => {
    it('should convert Buffer to Buffer', () => {
      const buffer = Buffer.from([1, 2, 3, 4]);
      const result = streamer.toBuffer(buffer);

      expect(result).toEqual(buffer);
    });

    it('should convert data URL to Buffer', () => {
      const pngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

      const result = streamer.toBuffer(dataUrl);

      expect(result).toEqual(pngBuffer);
    });

    it('should convert base64 string to Buffer', () => {
      const original = Buffer.from('Hello World!');
      const base64 = original.toString('base64');

      const result = streamer.toBuffer(base64);

      expect(result).toEqual(original);
    });

    it('should return null for invalid input', () => {
      const result = streamer.toBuffer(12345);
      expect(result).toBeNull();
    });
  });

  describe('chunk merging', () => {
    it('should merge Buffer chunks', () => {
      const chunks = [
        { data: Buffer.from([1, 2, 3]) },
        { data: Buffer.from([4, 5, 6]) },
        { data: Buffer.from([7, 8, 9]) }
      ];

      const merged = streamer.mergeChunks(chunks);

      expect(merged.length).toBe(9);
      expect(merged[0]).toBe(1);
      expect(merged[8]).toBe(9);
    });

    it('should merge base64 encoded chunks', () => {
      const chunks = [
        { data: Buffer.from([1, 2, 3]).toString('base64') },
        { data: Buffer.from([4, 5, 6]).toString('base64') }
      ];

      const merged = streamer.mergeChunks(chunks);

      expect(merged.length).toBe(6);
    });

    it('should throw error for invalid chunks', () => {
      expect(() => {
        streamer.mergeChunks([]);
      }).toThrow();
    });
  });

  describe('decompression', () => {
    it('should decompress gzipped data', async () => {
      const original = Buffer.from('Test data for compression');

      const compressed = await new Promise((resolve, reject) => {
        const zlib = require('zlib');
        zlib.gzip(original, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const decompressed = await streamer.decompressGzip(compressed);

      expect(decompressed).toEqual(original);
    });

    it('should handle decompression errors', async () => {
      const invalidData = Buffer.from([0xFF, 0xFF, 0xFF]);

      await expect(streamer.decompressGzip(invalidData)).rejects.toThrow();
    });
  });

  describe('streaming performance', () => {
    it('should compress efficiently', async () => {
      const testData = Buffer.alloc(500 * 1024); // 500KB

      const handle = await streamer.createCompressedReadStream(testData);

      // Check compression ratio
      const ratio = (handle.totalSize / handle.originalSize * 100).toFixed(2);
      expect(parseFloat(ratio)).toBeLessThan(100);
    });

    it('should handle multiple streams', async () => {
      const streams = [];

      for (let i = 0; i < 3; i++) {
        const testData = Buffer.alloc((i + 1) * 50 * 1024);
        const handle = await streamer.createCompressedReadStream(testData);
        streams.push(handle);
      }

      const active = streamer.getActiveStreams();
      expect(active.length).toBe(3);

      // Clean up
      streams.forEach(s => streamer.closeStream(s.sessionId));
      expect(streamer.getActiveStreams().length).toBe(0);
    });
  });
});
