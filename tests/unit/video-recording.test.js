/**
 * Video Recording System Tests
 * Tests for video encoder, storage, and playback components
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  VideoEncoder,
  VideoEncoderSession,
  CODEC_PRESETS,
  FRAME_RATE_PRESETS
} = require('../../src/recording/video-encoder');

const {
  VideoStorage,
  CLEANUP_POLICIES
} = require('../../src/recording/video-storage');

const {
  VideoPlayer,
  OUTPUT_FORMATS
} = require('../../src/recording/video-player');

describe('Video Recording System', () => {
  let tempDir;

  beforeAll(() => {
    tempDir = path.join(os.tmpdir(), 'basset-video-test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('VideoEncoder', () => {
    it('should initialize with default options', () => {
      const encoder = new VideoEncoder({
        outputDir: tempDir
      });

      expect(encoder).toBeDefined();
      expect(encoder.options.codec).toBe('vp9');
      expect(encoder.options.fps).toBe(24);
    });

    it('should support multiple codecs', () => {
      const codecs = ['vp8', 'vp9', 'h264', 'h265'];

      for (const codec of codecs) {
        const encoder = new VideoEncoder({
          outputDir: tempDir,
          codec
        });
        expect(encoder.options.codec).toBe(codec);
      }
    });

    it('should reject unsupported codec', () => {
      expect(() => {
        new VideoEncoder({
          outputDir: tempDir,
          codec: 'invalid-codec'
        });
      }).toThrow();
    });

    it('should support standard frame rates', () => {
      const fps = [10, 24, 30];

      for (const frameRate of fps) {
        const encoder = new VideoEncoder({
          outputDir: tempDir,
          fps: frameRate
        });
        expect(encoder.options.fps).toBe(frameRate);
      }
    });

    it('should create encoding sessions', () => {
      const encoder = new VideoEncoder({
        outputDir: tempDir
      });

      const session = encoder.createSession('test-session-1');
      expect(session).toBeDefined();
      expect(session.sessionId).toBe('test-session-1');
    });

    it('should prevent duplicate sessions', () => {
      const encoder = new VideoEncoder({
        outputDir: tempDir
      });

      encoder.createSession('test-duplicate');

      expect(() => {
        encoder.createSession('test-duplicate');
      }).toThrow();
    });

    it('should list active sessions', () => {
      const encoder = new VideoEncoder({
        outputDir: tempDir
      });

      encoder.createSession('session-1');
      encoder.createSession('session-2');

      const sessions = encoder.listActiveSessions();
      expect(sessions).toContain('session-1');
      expect(sessions).toContain('session-2');
    });

    it('should return metrics for all sessions', () => {
      const encoder = new VideoEncoder({
        outputDir: tempDir
      });

      encoder.createSession('session-1');
      encoder.createSession('session-2');

      const allMetrics = encoder.getAllMetrics();
      expect(Object.keys(allMetrics)).toContain('session-1');
      expect(Object.keys(allMetrics)).toContain('session-2');
    });

    it('should check FFmpeg availability', async () => {
      const available = await VideoEncoder.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('VideoEncoderSession', () => {
    it('should initialize with correct codec config', () => {
      const session = new VideoEncoderSession('test-session', {
        outputDir: tempDir,
        codec: 'vp9'
      });

      expect(session.codec.name).toBe('vp9');
      expect(session.codec.container).toBe('webm');
    });

    it('should validate quality settings', () => {
      const session = new VideoEncoderSession('test-session', {
        outputDir: tempDir,
        codec: 'vp9',
        quality: 999 // Invalid
      });

      expect(session.quality).not.toBe(999);
    });

    it('should initialize with idle state', () => {
      const session = new VideoEncoderSession('test-session', {
        outputDir: tempDir
      });

      expect(session.state).toBe('idle');
    });

    it('should get metrics', () => {
      const session = new VideoEncoderSession('test-session', {
        outputDir: tempDir
      });

      const metrics = session.getMetrics();
      expect(metrics.framesProcessed).toBe(0);
      expect(metrics.state).toBe('idle');
    });

    it('should return correct output path', () => {
      const session = new VideoEncoderSession('test-video', {
        outputDir: tempDir,
        codec: 'vp9'
      });

      const outputPath = session.getOutputPath();
      expect(outputPath).toContain('test-video');
      expect(outputPath).toContain('.webm');
    });

    it('should return codec info', () => {
      const session = new VideoEncoderSession('test-session', {
        outputDir: tempDir,
        codec: 'h264'
      });

      const codecInfo = session.getCodecInfo();
      expect(codecInfo.name).toBe('h264');
      expect(codecInfo.mime).toContain('video/mp4');
    });
  });

  describe('VideoStorage', () => {
    let storage;

    beforeEach(() => {
      storage = new VideoStorage({
        storageDir: tempDir,
        maxDiskUsage: 1024 * 1024 * 1024 // 1GB for tests
      });
    });

    it('should initialize storage directory', () => {
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it('should register video files', () => {
      // Create a dummy video file
      const videoPath = path.join(tempDir, 'test-video.mp4');
      fs.writeFileSync(videoPath, 'dummy content');

      const entry = storage.registerVideo(videoPath, {
        codec: 'h264',
        fps: 24,
        duration: 60
      });

      expect(entry.filename).toBe('test-video.mp4');
      expect(entry.codec).toBe('h264');
      expect(entry.duration).toBe(60);
    });

    it('should get video information', () => {
      const videoPath = path.join(tempDir, 'test-video-2.mp4');
      fs.writeFileSync(videoPath, 'dummy content');

      storage.registerVideo(videoPath, {
        codec: 'h264',
        fps: 30
      });

      const info = storage.getVideoInfo('test-video-2.mp4');
      expect(info).toBeDefined();
      expect(info.codec).toBe('h264');
    });

    it('should list videos with filters', () => {
      const videoPath1 = path.join(tempDir, 'video1.mp4');
      const videoPath2 = path.join(tempDir, 'video2.mp4');

      fs.writeFileSync(videoPath1, 'content');
      fs.writeFileSync(videoPath2, 'content');

      storage.registerVideo(videoPath1, {
        codec: 'h264',
        tags: ['test', 'demo']
      });

      storage.registerVideo(videoPath2, {
        codec: 'vp9',
        tags: ['recording']
      });

      const h264Videos = storage.listVideos({ codec: 'h264' });
      expect(h264Videos.length).toBeGreaterThan(0);
      expect(h264Videos[0].codec).toBe('h264');
    });

    it('should get storage statistics', () => {
      const stats = storage.getStorageStats();

      expect(stats.totalVideos).toBeGreaterThanOrEqual(0);
      expect(stats.totalSize).toBeGreaterThanOrEqual(0);
      expect(stats.usagePercentage).toBeDefined();
    });

    it('should support cleanup policies', () => {
      expect(CLEANUP_POLICIES.lru).toBeDefined();
      expect(CLEANUP_POLICIES.lfu).toBeDefined();
      expect(CLEANUP_POLICIES.fifo).toBeDefined();
      expect(CLEANUP_POLICIES.age).toBeDefined();
    });

    it('should delete videos', async () => {
      const videoPath = path.join(tempDir, 'delete-test.mp4');
      fs.writeFileSync(videoPath, 'content to delete');

      storage.registerVideo(videoPath, { codec: 'h264' });

      const result = await storage.deleteVideo('delete-test.mp4');
      expect(result.success).toBe(true);
      expect(fs.existsSync(videoPath)).toBe(false);
    });
  });

  describe('VideoPlayer', () => {
    let player;

    beforeEach(() => {
      player = new VideoPlayer({
        outputDir: tempDir
      });
    });

    it('should initialize', () => {
      expect(player).toBeDefined();
    });

    it('should support multiple output formats', () => {
      expect(OUTPUT_FORMATS.mp4).toBeDefined();
      expect(OUTPUT_FORMATS.webm).toBeDefined();
      expect(OUTPUT_FORMATS.mkv).toBeDefined();
      expect(OUTPUT_FORMATS.mov).toBeDefined();
    });

    it('should have correct format configurations', () => {
      const mp4 = OUTPUT_FORMATS.mp4;
      expect(mp4.codec).toBe('libx264');
      expect(mp4.container).toBe('mp4');
      expect(mp4.mime).toContain('video/mp4');
    });
  });

  describe('Codec Presets', () => {
    it('should have VP8 preset', () => {
      expect(CODEC_PRESETS.vp8).toBeDefined();
      expect(CODEC_PRESETS.vp8.mime).toContain('vp8');
    });

    it('should have VP9 preset', () => {
      expect(CODEC_PRESETS.vp9).toBeDefined();
      expect(CODEC_PRESETS.vp9.mime).toContain('vp9');
    });

    it('should have H.264 preset', () => {
      expect(CODEC_PRESETS.h264).toBeDefined();
      expect(CODEC_PRESETS.h264.mime).toContain('avc1');
    });

    it('should have H.265 preset', () => {
      expect(CODEC_PRESETS.h265).toBeDefined();
      expect(CODEC_PRESETS.h265.mime).toContain('hev1');
    });
  });

  describe('Frame Rate Presets', () => {
    it('should have low frame rate preset', () => {
      expect(FRAME_RATE_PRESETS.low.fps).toBe(10);
    });

    it('should have medium frame rate preset', () => {
      expect(FRAME_RATE_PRESETS.medium.fps).toBe(24);
    });

    it('should have high frame rate preset', () => {
      expect(FRAME_RATE_PRESETS.high.fps).toBe(30);
    });
  });

  describe('Video Recording Integration', () => {
    it('should support recording workflow', async () => {
      const encoder = new VideoEncoder({ outputDir: tempDir });
      const session = encoder.createSession('integration-test');

      expect(session.state).toBe('idle');

      // Start recording
      await session.start();
      expect(session.state).toBe('encoding');

      // Pause and resume
      session.pause();
      expect(session.state).toBe('paused');

      session.resume();
      expect(session.state).toBe('encoding');

      // Get metrics
      const metrics = session.getMetrics();
      expect(metrics.state).toBe('encoding');
      expect(metrics.elapsedTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle storage with tags', () => {
      const storage = new VideoStorage({ storageDir: tempDir });
      const videoPath = path.join(tempDir, 'tagged-video.mp4');
      fs.writeFileSync(videoPath, 'test');

      storage.registerVideo(videoPath, {
        codec: 'h264',
        tags: ['important', 'forensic']
      });

      const videos = storage.listVideos({ tags: ['important'] });
      expect(videos.length).toBeGreaterThan(0);
    });
  });
});
