/**
 * Basset Hound Browser - Video Encoder Module
 *
 * Converts screenshot frames to video files using multiple codec support
 * Provides configurable frame rates, quality, and compression options
 *
 * Features:
 * - Multiple codec support (VP8, VP9, H.264 with fallback)
 * - Configurable frame rates (10, 24, 30 fps)
 * - Stream-based encoding (not all-in-memory)
 * - Audio capture support (from browser)
 * - Real-time compression
 * - Progress tracking and metrics
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');

// Codec configurations
const CODEC_PRESETS = {
  vp8: {
    name: 'vp8',
    container: 'webm',
    mime: 'video/webm;codecs="vp8"',
    ffmpegCodec: 'libvpx',
    quality: 'q:v',
    qualityRange: '4-10', // 4=highest, 10=lowest
    defaultQuality: 6,
    preset: 'realtime' // realtime, good, best
  },
  vp9: {
    name: 'vp9',
    container: 'webm',
    mime: 'video/webm;codecs="vp9"',
    ffmpegCodec: 'libvpx-vp9',
    quality: 'crf',
    qualityRange: '0-63', // 0=best, 63=worst
    defaultQuality: 32,
    preset: 'realtime'
  },
  h264: {
    name: 'h264',
    container: 'mp4',
    mime: 'video/mp4;codecs="avc1.42E01E"',
    ffmpegCodec: 'libx264',
    quality: 'crf',
    qualityRange: '0-51', // 0=best, 51=worst
    defaultQuality: 28,
    preset: 'fast'
  },
  h265: {
    name: 'h265',
    container: 'mp4',
    mime: 'video/mp4;codecs="hev1.1.2.L120.B0"',
    ffmpegCodec: 'libx265',
    quality: 'crf',
    qualityRange: '0-51',
    defaultQuality: 28,
    preset: 'fast'
  }
};

// Frame rate presets
const FRAME_RATE_PRESETS = {
  low: { fps: 10, latency: 'high', quality: 'low' },
  medium: { fps: 24, latency: 'medium', quality: 'medium' },
  high: { fps: 30, latency: 'low', quality: 'high' }
};

// Quality level profiles - maps quality level names to codec-specific settings
const QUALITY_PROFILES = {
  low: {
    vp8: { q: 9, bitrate: '500k' },
    vp9: { crf: 50, bitrate: '500k' },
    h264: { crf: 45, bitrate: '800k' },
    h265: { crf: 45, bitrate: '600k' }
  },
  medium: {
    vp8: { q: 6, bitrate: '1.5M' },
    vp9: { crf: 32, bitrate: '1.5M' },
    h264: { crf: 28, bitrate: '2M' },
    h265: { crf: 28, bitrate: '1.5M' }
  },
  high: {
    vp8: { q: 4, bitrate: '3M' },
    vp9: { crf: 23, bitrate: '3M' },
    h264: { crf: 18, bitrate: '4M' },
    h265: { crf: 18, bitrate: '3M' }
  },
  ultra: {
    vp8: { q: 3, bitrate: '6M' },
    vp9: { crf: 15, bitrate: '6M' },
    h264: { crf: 12, bitrate: '8M' },
    h265: { crf: 12, bitrate: '6M' }
  }
};

// Bitrate optimization settings for different scenarios
const BITRATE_PROFILES = {
  bandwidth_constrained: {
    multiplier: 0.5,
    description: 'Low bandwidth - 50% bitrate reduction'
  },
  standard: {
    multiplier: 1.0,
    description: 'Standard bitrate'
  },
  high_quality: {
    multiplier: 1.5,
    description: 'High quality - 50% bitrate increase'
  }
};

class VideoEncoder extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      outputDir: options.outputDir || path.join(require('os').homedir(), '.basset-hound', 'videos'),
      codec: options.codec || 'vp9',
      fps: options.fps || 24,
      quality: options.quality || null,
      maxWidth: options.maxWidth || 1920,
      maxHeight: options.maxHeight || 1080,
      enableAudio: options.enableAudio || false,
      audioCodec: options.audioCodec || 'libopus',
      audioBitrate: options.audioBitrate || '128k',
      enableCompression: options.enableCompression !== false,
      compressionLevel: options.compressionLevel || 6,
      chunkSize: options.chunkSize || 100, // Process frames in chunks
      ...options
    };

    // Validate codec
    if (!CODEC_PRESETS[this.options.codec]) {
      throw new Error(`Unsupported codec: ${this.options.codec}. Supported: ${Object.keys(CODEC_PRESETS).join(', ')}`);
    }

    // Validate frame rate
    if (![10, 24, 30].includes(this.options.fps)) {
      console.warn(`Non-standard FPS ${this.options.fps}. Supported: 10, 24, 30`);
    }

    this._ensureOutputDirectory();
    this.activeEncoders = new Map();
  }

  _ensureOutputDirectory() {
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }
  }

  /**
   * Create a new video encoding session
   * @param {string} sessionId - Unique session identifier
   * @param {Object} options - Session-specific options
   * @returns {VideoEncoderSession}
   */
  /**
   * Create a new video encoding session with optional quality level
   * @param {string} sessionId - Unique session identifier
   * @param {Object} options - Session-specific options
   * @param {string} qualityLevel - Quality level: 'low', 'medium', 'high', 'ultra'
   * @returns {VideoEncoderSession}
   */
  createSession(sessionId, options = {}, qualityLevel = 'medium') {
    if (this.activeEncoders.has(sessionId)) {
      throw new Error(`Video encoding session ${sessionId} already exists`);
    }

    // Apply quality level settings if specified
    const mergedOptions = { ...this.options, ...options };
    if (QUALITY_PROFILES[qualityLevel]) {
      const profile = QUALITY_PROFILES[qualityLevel][mergedOptions.codec || 'vp9'];
      if (profile) {
        mergedOptions.qualityLevel = qualityLevel;
        mergedOptions.qualitySettings = profile;
        if (!mergedOptions.quality) {
          mergedOptions.quality = profile.crf || profile.q;
        }
      }
    }

    const session = new VideoEncoderSession(sessionId, mergedOptions);

    this.activeEncoders.set(sessionId, session);

    // Cleanup on session end
    session.once('completed', () => {
      this.activeEncoders.delete(sessionId);
      this.emit('sessionCompleted', { sessionId, metrics: session.getMetrics() });
    });

    session.once('error', (error) => {
      this.activeEncoders.delete(sessionId);
      this.emit('sessionError', { sessionId, error: error.message });
    });

    return session;
  }

  /**
   * Get quality profiles
   * @returns {Object} All available quality profiles
   */
  getQualityProfiles() {
    return { ...QUALITY_PROFILES };
  }

  /**
   * Get bitrate profiles
   * @returns {Object} All available bitrate profiles
   */
  getBitrateProfiles() {
    return { ...BITRATE_PROFILES };
  }

  /**
   * Calculate optimized bitrate for a quality level and bitrate profile
   * @param {string} qualityLevel - Quality level
   * @param {string} codec - Codec name
   * @param {string} bitrateProfile - Bitrate profile name
   * @returns {string} Optimized bitrate string
   */
  calculateOptimizedBitrate(qualityLevel, codec, bitrateProfile = 'standard') {
    const profile = QUALITY_PROFILES[qualityLevel];
    const bitrateMultiplier = BITRATE_PROFILES[bitrateProfile];

    if (!profile || !profile[codec]) {
      return null;
    }

    const baseBitrate = profile[codec].bitrate;
    if (!baseBitrate) {
      return null;
    }

    // Parse bitrate value
    const match = baseBitrate.match(/^(\d+(?:\.\d+)?)(k|M)$/);
    if (!match) {
      return baseBitrate;
    }

    const value = parseFloat(match[1]);
    const unit = match[2];
    const multiplier = bitrateMultiplier?.multiplier || 1.0;
    const optimized = (value * multiplier).toFixed(1);

    return `${optimized}${unit}`;
  }

  /**
   * Get active encoding session
   * @param {string} sessionId - Session identifier
   * @returns {VideoEncoderSession|null}
   */
  getSession(sessionId) {
    return this.activeEncoders.get(sessionId) || null;
  }

  /**
   * List all active encoding sessions
   * @returns {Array} Array of session IDs
   */
  listActiveSessions() {
    return Array.from(this.activeEncoders.keys());
  }

  /**
   * Get metrics for all active sessions
   * @returns {Object} Metrics by session ID
   */
  getAllMetrics() {
    const metrics = {};
    for (const [sessionId, session] of this.activeEncoders.entries()) {
      metrics[sessionId] = session.getMetrics();
    }
    return metrics;
  }

  /**
   * Verify FFmpeg is available
   * @returns {Promise<boolean>}
   */
  static async isAvailable() {
    return new Promise((resolve) => {
      const proc = spawn('ffmpeg', ['-version']);
      let hasOutput = false;

      proc.stdout.on('data', () => {
        hasOutput = true;
      });

      proc.on('close', (code) => {
        resolve(code === 0 && hasOutput);
      });

      proc.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve(hasOutput);
      }, 5000);
    });
  }
}

/**
 * Individual video encoding session
 */
class VideoEncoderSession extends EventEmitter {
  constructor(sessionId, options = {}) {
    super();

    this.sessionId = sessionId;
    this.options = options;
    const codecName = options.codec || 'vp9';
    this.codec = CODEC_PRESETS[codecName];

    this.state = 'idle'; // idle, encoding, paused, finalizing, completed, error
    this.outputPath = path.join(
      options.outputDir,
      `${sessionId}.${this.codec.container}`
    );

    // Frame buffer
    this.frameBuffer = [];
    this.frameIndex = 0;
    this.writeStream = null;
    this.ffmpegProcess = null;

    // Metrics
    this.metrics = {
      framesProcessed: 0,
      framesWritten: 0,
      bytesWritten: 0,
      startTime: null,
      endTime: null,
      duration: 0,
      avgFrameSize: 0,
      compressionRatio: 0,
      frameRate: options.fps,
      codec: options.codec,
      resolution: {
        width: options.maxWidth,
        height: options.maxHeight
      },
      errors: 0,
      warnings: 0
    };

    // Configuration
    this.quality = options.quality || this.codec.defaultQuality;
    this.validateQuality();
  }

  validateQuality() {
    const [min, max] = this.codec.qualityRange.split('-').map(Number);
    const quality = parseInt(this.quality, 10);

    if (quality < min || quality > max) {
      console.warn(
        `Quality ${quality} out of range [${min}-${max}]. Setting to ${this.codec.defaultQuality}`
      );
      this.quality = this.codec.defaultQuality;
    }
  }

  /**
   * Start the encoding session
   * @returns {Promise<void>}
   */
  async start() {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start encoding: current state is ${this.state}`);
    }

    this.state = 'encoding';
    this.metrics.startTime = Date.now();

    try {
      this._initializeFfmpegProcess();
      this.emit('started', { sessionId: this.sessionId });
    } catch (error) {
      this.state = 'error';
      this.metrics.errors++;
      this.emit('error', error);
      throw error;
    }
  }

  _initializeFfmpegProcess() {
    const ffmpegArgs = this._buildFfmpegArgs();

    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

    this.writeStream = this.ffmpegProcess.stdin;

    this.ffmpegProcess.stdout.on('data', (data) => {
      // Process stdout if needed
    });

    this.ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString('utf8');
      if (message.includes('frame=')) {
        const match = message.match(/frame=\s*(\d+)/);
        if (match) {
          const processedFrames = parseInt(match[1], 10);
          this.metrics.framesWritten = processedFrames;
        }
      }
    });

    this.ffmpegProcess.on('error', (error) => {
      this.metrics.errors++;
      this.emit('error', new Error(`FFmpeg process error: ${error.message}`));
    });

    this.ffmpegProcess.on('close', (code) => {
      if (code !== 0 && this.state !== 'finalizing') {
        this.metrics.errors++;
        this.emit('error', new Error(`FFmpeg exited with code ${code}`));
      }
    });
  }

  _buildFfmpegArgs() {
    const args = [
      '-f', 'rawvideo',
      '-pixel_format', 'rgb24',
      '-video_size', `${this.options.maxWidth}x${this.options.maxHeight}`,
      '-framerate', this.options.fps,
      '-i', '-',
      '-c:v', this.codec.ffmpegCodec,
    ];

    // Add quality settings
    if (this.codec.quality === 'q:v') {
      args.push('-q:v', this.quality);
      args.push('-cpu-used', '5'); // 0-15, higher = faster (lower quality)
    } else {
      args.push('-crf', this.quality);
    }

    // Add preset for faster encoding
    if (this.codec.preset) {
      args.push('-preset', this.codec.preset);
    }

    // Audio handling
    if (this.options.enableAudio) {
      args.push('-c:a', this.options.audioCodec);
      args.push('-b:a', this.options.audioBitrate);
    } else {
      args.push('-an');
    }

    // Output file
    args.push('-y', this.outputPath);

    return args;
  }

  /**
   * Add a frame for encoding
   * @param {Buffer} frameBuffer - Raw frame buffer or base64-encoded image
   * @param {Object} metadata - Frame metadata
   * @returns {Promise<void>}
   */
  async addFrame(frameBuffer, metadata = {}) {
    if (this.state !== 'encoding') {
      throw new Error(`Cannot add frame: current state is ${this.state}`);
    }

    try {
      // Handle base64 encoded images
      let rawBuffer = frameBuffer;
      if (typeof frameBuffer === 'string') {
        rawBuffer = Buffer.from(frameBuffer, 'base64');
      }

      // Resize/optimize frame if needed
      if (this.options.enableCompression) {
        rawBuffer = await this._optimizeFrame(rawBuffer);
      }

      // Add to buffer
      this.frameBuffer.push({
        data: rawBuffer,
        metadata,
        index: this.frameIndex++
      });

      this.metrics.framesProcessed++;

      // Process in chunks
      if (this.frameBuffer.length >= this.options.chunkSize) {
        await this._flushFrames();
      }
    } catch (error) {
      this.metrics.errors++;
      this.emit('frameError', { frameIndex: this.frameIndex, error: error.message });
      throw error;
    }
  }

  /**
   * Optimize frame for encoding
   * @param {Buffer} frameBuffer - Raw frame buffer
   * @returns {Promise<Buffer>}
   */
  async _optimizeFrame(frameBuffer) {
    try {
      // Convert from buffer to raw RGB24
      let image = sharp(frameBuffer, { failOnError: false });

      // Resize if needed
      const metadata = await image.metadata();
      if (metadata.width > this.options.maxWidth || metadata.height > this.options.maxHeight) {
        image = image.resize(this.options.maxWidth, this.options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Convert to RGB if needed
      image = image.raw().toFormat('raw');

      return image.toBuffer();
    } catch (error) {
      // On error, just return the original buffer
      console.warn('Frame optimization failed:', error.message);
      return frameBuffer;
    }
  }

  /**
   * Flush buffered frames to FFmpeg
   * @returns {Promise<void>}
   */
  async _flushFrames() {
    if (this.frameBuffer.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      const writeNextFrame = () => {
        if (this.frameBuffer.length === 0) {
          resolve();
          return;
        }

        const frame = this.frameBuffer.shift();
        const canContinue = this.writeStream.write(frame.data);

        this.metrics.bytesWritten += frame.data.length;
        this.metrics.avgFrameSize = this.metrics.bytesWritten / this.metrics.framesProcessed;

        if (canContinue) {
          setImmediate(writeNextFrame);
        } else {
          this.writeStream.once('drain', writeNextFrame);
        }
      };

      writeNextFrame();
    });
  }

  /**
   * Finalize the encoding session
   * @returns {Promise<Object>} Final metrics
   */
  async finalize() {
    if (this.state === 'completed' || this.state === 'error') {
      return this.metrics;
    }

    this.state = 'finalizing';

    try {
      // Flush remaining frames
      await this._flushFrames();

      // Close the write stream
      await new Promise((resolve, reject) => {
        this.writeStream.end(() => {
          resolve();
        });

        this.writeStream.on('error', reject);
      });

      // Wait for FFmpeg process to complete
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.ffmpegProcess.kill();
          reject(new Error('FFmpeg process timeout'));
        }, 30000);

        this.ffmpegProcess.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg exited with code ${code}`));
          }
        });
      });

      // Calculate final metrics
      this.metrics.endTime = Date.now();
      this.metrics.duration = (this.metrics.endTime - this.metrics.startTime) / 1000;

      // Get file size for compression ratio
      const stats = fs.statSync(this.outputPath);
      const originalSize = this.metrics.framesProcessed * this.metrics.avgFrameSize;
      this.metrics.compressionRatio = originalSize > 0 ? stats.size / originalSize : 0;

      this.state = 'completed';
      this.emit('completed', { sessionId: this.sessionId, metrics: this.metrics });

      return this.metrics;
    } catch (error) {
      this.state = 'error';
      this.metrics.errors++;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Pause the encoding session
   * @returns {void}
   */
  pause() {
    if (this.state === 'encoding') {
      this.state = 'paused';
      this.emit('paused');
    }
  }

  /**
   * Resume the encoding session
   * @returns {void}
   */
  resume() {
    if (this.state === 'paused') {
      this.state = 'encoding';
      this.emit('resumed');
    }
  }

  /**
   * Get current metrics
   * @returns {Object}
   */
  getMetrics() {
    return {
      ...this.metrics,
      state: this.state,
      bufferSize: this.frameBuffer.length,
      elapsedTime: this.metrics.startTime ? Date.now() - this.metrics.startTime : 0
    };
  }

  /**
   * Get output file path
   * @returns {string}
   */
  getOutputPath() {
    return this.outputPath;
  }

  /**
   * Get codec info
   * @returns {Object}
   */
  getCodecInfo() {
    return this.codec;
  }

  /**
   * Cancel the encoding session
   * @returns {Promise<void>}
   */
  async cancel() {
    this.state = 'error';

    if (this.writeStream) {
      this.writeStream.destroy();
    }

    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill();
    }

    // Clean up output file
    if (fs.existsSync(this.outputPath)) {
      fs.unlinkSync(this.outputPath);
    }

    this.emit('cancelled');
  }
}

module.exports = {
  VideoEncoder,
  VideoEncoderSession,
  CODEC_PRESETS,
  FRAME_RATE_PRESETS,
  QUALITY_PROFILES,
  BITRATE_PROFILES
};
