/**
 * Basset Hound Browser - Video Player & Playback Module
 *
 * Handles video playback, exporting, and manipulation
 * Provides in-browser playback, frame extraction, and format conversion
 *
 * Features:
 * - Multiple format playback (MP4, WebM, etc.)
 * - Frame extraction
 * - Trim and edit capabilities
 * - Speed adjustment
 * - Format conversion
 * - Metadata extraction
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Supported output formats
const OUTPUT_FORMATS = {
  mp4: {
    codec: 'libx264',
    container: 'mp4',
    mime: 'video/mp4',
    extension: '.mp4',
    defaultQuality: 23
  },
  webm: {
    codec: 'libvpx-vp9',
    container: 'webm',
    mime: 'video/webm',
    extension: '.webm',
    defaultQuality: 32
  },
  mkv: {
    codec: 'libx264',
    container: 'matroska',
    mime: 'video/x-matroska',
    extension: '.mkv',
    defaultQuality: 23
  },
  mov: {
    codec: 'libx264',
    container: 'mov',
    mime: 'video/quicktime',
    extension: '.mov',
    defaultQuality: 23
  }
};

class VideoPlayer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      outputDir: options.outputDir || path.join(require('os').homedir(), '.basset-hound', 'videos'),
      ...options
    };

    this._ensureOutputDirectory();
    this.activePlayers = new Map();
  }

  _ensureOutputDirectory() {
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }
  }

  /**
   * Extract metadata from a video file
   * @param {string} videoPath - Path to video file
   * @returns {Promise<Object>}
   */
  async getVideoMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(videoPath)) {
        return reject(new Error(`Video file not found: ${videoPath}`));
      }

      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-show_format',
        '-show_streams',
        '-of', 'json',
        videoPath
      ]);

      let output = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error('ffprobe failed'));
        }

        try {
          const data = JSON.parse(output);
          const format = data.format || {};
          const streams = data.streams || [];

          const videoStream = streams.find(s => s.codec_type === 'video');
          const audioStream = streams.find(s => s.codec_type === 'audio');

          resolve({
            filename: path.basename(videoPath),
            duration: parseFloat(format.duration) || 0,
            bitRate: parseInt(format.bit_rate) || 0,
            fileSize: parseInt(format.size) || 0,
            video: videoStream ? {
              codec: videoStream.codec_name,
              width: videoStream.width,
              height: videoStream.height,
              fps: parseFloat(videoStream.r_frame_rate?.split('/')[0]) || 0,
              bitRate: parseInt(videoStream.bit_rate) || 0
            } : null,
            audio: audioStream ? {
              codec: audioStream.codec_name,
              sampleRate: parseInt(audioStream.sample_rate) || 0,
              channels: audioStream.channels,
              bitRate: parseInt(audioStream.bit_rate) || 0
            } : null,
            startTime: parseFloat(format.start_time) || 0
          });
        } catch (error) {
          reject(new Error(`Failed to parse metadata: ${error.message}`));
        }
      });

      ffprobe.on('error', reject);
    });
  }

  /**
   * Extract frames from a video file
   * @param {string} videoPath - Path to video file
   * @param {Object} options - Extraction options
   * @returns {Promise<Array>}
   */
  async extractFrames(videoPath, options = {}) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const {
      startTime = 0,
      endTime = null,
      frameInterval = 1, // Extract every N frames
      format = 'png',
      outputDir = path.join(this.options.outputDir, 'frames'),
      maxFrames = 1000
    } = options;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const framePattern = path.join(outputDir, `frame-%04d.${format}`);

    return new Promise((resolve, reject) => {
      const args = [
        '-i', videoPath,
        '-vf', `select='isnan(prev_selected_t)+isdone(t)-0.005',setpts=N/FRAME_RATE/TB`,
        '-vsync', '0',
        '-q:v', '2'
      ];

      if (startTime > 0) {
        args.unshift('-ss', startTime.toString());
      }

      if (endTime) {
        args.push('-to', endTime.toString());
      }

      args.push(framePattern);

      const ffmpeg = spawn('ffmpeg', args);
      let output = '';
      let errorOutput = '';

      ffmpeg.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`FFmpeg failed: ${errorOutput}`));
        }

        // Count extracted frames
        const frameFiles = fs.readdirSync(outputDir)
          .filter(f => f.match(/frame-\d+\./))
          .sort();

        resolve({
          outputDir,
          format,
          frameCount: frameFiles.length,
          frames: frameFiles.map(f => path.join(outputDir, f))
        });
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Export video to different format
   * @param {string} videoPath - Input video path
   * @param {Object} options - Export options
   * @returns {Promise<Object>}
   */
  async exportVideo(videoPath, options = {}) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const {
      format = 'mp4',
      outputPath = path.join(
        this.options.outputDir,
        `${path.basename(videoPath, path.extname(videoPath))}-${Date.now()}.${format}`
      ),
      quality = null,
      startTime = null,
      endTime = null,
      speed = 1.0,
      resolution = null
    } = options;

    if (!OUTPUT_FORMATS[format]) {
      throw new Error(`Unsupported format: ${format}. Supported: ${Object.keys(OUTPUT_FORMATS).join(', ')}`);
    }

    const formatConfig = OUTPUT_FORMATS[format];
    const qualityValue = quality || formatConfig.defaultQuality;

    return new Promise((resolve, reject) => {
      const args = ['-i', videoPath];

      // Trim video
      if (startTime !== null) {
        args.push('-ss', startTime.toString());
      }
      if (endTime !== null) {
        args.push('-to', endTime.toString());
      }

      // Apply speed adjustment
      if (speed !== 1.0) {
        const speedFilter = `setpts=PTS/${speed}`;
        args.push('-vf', speedFilter);
      }

      // Apply resolution change
      if (resolution) {
        const [width, height] = typeof resolution === 'string'
          ? resolution.split('x').map(Number)
          : [resolution.width, resolution.height];
        args.push('-vf', `scale=${width}:${height}`);
      }

      // Codec and quality settings
      args.push('-c:v', formatConfig.codec);
      if (formatConfig.codec === 'libx264') {
        args.push('-crf', qualityValue.toString());
        args.push('-preset', 'medium');
      } else {
        args.push('-q:v', qualityValue.toString());
      }

      // Audio codec
      args.push('-c:a', 'aac');
      args.push('-b:a', '128k');

      // Output
      args.push('-y', outputPath);

      const ffmpeg = spawn('ffmpeg', args);
      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
        // Parse progress
        const match = data.toString().match(/frame=\s*(\d+)/);
        if (match) {
          this.emit('exportProgress', {
            frames: parseInt(match[1]),
            format,
            file: outputPath
          });
        }
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Export failed: ${errorOutput}`));
        }

        const stats = fs.statSync(outputPath);
        resolve({
          success: true,
          outputPath,
          format,
          fileSize: stats.size,
          created: Date.now()
        });
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Create a video thumbnail
   * @param {string} videoPath - Video file path
   * @param {Object} options - Thumbnail options
   * @returns {Promise<Object>}
   */
  async createThumbnail(videoPath, options = {}) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const {
      timestamp = '00:00:01', // Timestamp to extract from
      width = 320,
      height = 180,
      format = 'jpg',
      outputPath = path.join(
        this.options.outputDir,
        `${path.basename(videoPath, path.extname(videoPath))}-thumb.${format}`
      )
    } = options;

    return new Promise((resolve, reject) => {
      const args = [
        '-ss', timestamp,
        '-i', videoPath,
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
        '-vframes', '1',
        '-y',
        outputPath
      ];

      const ffmpeg = spawn('ffmpeg', args);

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error('Thumbnail creation failed'));
        }

        resolve({
          success: true,
          outputPath,
          width,
          height
        });
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Get frame at specific timestamp
   * @param {string} videoPath - Video file path
   * @param {string|number} timestamp - Timestamp (seconds or HH:MM:SS format)
   * @returns {Promise<Buffer>}
   */
  async getFrameAt(videoPath, timestamp) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const tempFile = path.join(
      this.options.outputDir,
      `.frame-${Date.now()}.png`
    );

    try {
      const args = [
        '-ss', typeof timestamp === 'number' ? timestamp.toString() : timestamp,
        '-i', videoPath,
        '-vframes', '1',
        '-f', 'image2',
        '-y',
        tempFile
      ];

      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', args);

        ffmpeg.on('close', (code) => {
          code === 0 ? resolve() : reject(new Error('Frame extraction failed'));
        });

        ffmpeg.on('error', reject);
      });

      const frameBuffer = fs.readFileSync(tempFile);
      fs.unlinkSync(tempFile);

      return frameBuffer;
    } catch (error) {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      throw error;
    }
  }

  /**
   * Merge multiple videos into one
   * @param {Array<string>} videoPaths - Paths to video files to merge
   * @param {Object} options - Merge options
   * @returns {Promise<Object>}
   */
  async mergeVideos(videoPaths, options = {}) {
    if (!Array.isArray(videoPaths) || videoPaths.length < 2) {
      throw new Error('At least 2 videos required for merging');
    }

    // Verify all files exist
    for (const videoPath of videoPaths) {
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video not found: ${videoPath}`);
      }
    }

    const {
      outputPath = path.join(this.options.outputDir, `merged-${Date.now()}.mp4`)
    } = options;

    // Create concat demuxer file
    const concatFile = path.join(this.options.outputDir, `.concat-${Date.now()}.txt`);

    try {
      const concatContent = videoPaths
        .map(p => `file '${path.resolve(p)}'`)
        .join('\n');

      fs.writeFileSync(concatFile, concatContent);

      return new Promise((resolve, reject) => {
        const args = [
          '-f', 'concat',
          '-safe', '0',
          '-i', concatFile,
          '-c', 'copy',
          '-y',
          outputPath
        ];

        const ffmpeg = spawn('ffmpeg', args);

        ffmpeg.on('close', (code) => {
          fs.unlinkSync(concatFile);

          if (code !== 0) {
            return reject(new Error('Merge failed'));
          }

          resolve({
            success: true,
            outputPath,
            inputCount: videoPaths.length
          });
        });

        ffmpeg.on('error', (error) => {
          fs.unlinkSync(concatFile);
          reject(error);
        });
      });
    } catch (error) {
      if (fs.existsSync(concatFile)) {
        fs.unlinkSync(concatFile);
      }
      throw error;
    }
  }

  /**
   * Add watermark to video
   * @param {string} videoPath - Video file path
   * @param {string} watermarkPath - Watermark image path
   * @param {Object} options - Watermark options
   * @returns {Promise<Object>}
   */
  async addWatermark(videoPath, watermarkPath, options = {}) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    if (!fs.existsSync(watermarkPath)) {
      throw new Error(`Watermark file not found: ${watermarkPath}`);
    }

    const {
      position = 'bottom-right', // top-left, top-right, bottom-left, bottom-right, center
      opacity = 0.8,
      scale = 0.1, // Scale relative to video dimensions
      outputPath = path.join(
        this.options.outputDir,
        `${path.basename(videoPath, path.extname(videoPath))}-watermarked.mp4`
      )
    } = options;

    const positionMap = {
      'top-left': '10:10',
      'top-right': 'W-w-10:10',
      'bottom-left': '10:H-h-10',
      'bottom-right': 'W-w-10:H-h-10',
      'center': '(W-w)/2:(H-h)/2'
    };

    const overlayPos = positionMap[position] || positionMap['bottom-right'];

    return new Promise((resolve, reject) => {
      const args = [
        '-i', videoPath,
        '-i', watermarkPath,
        '-filter_complex', `[1:v]scale=iw*${scale}:ih*${scale},format=rgba[wm];[0:v][wm]overlay=${overlayPos}`,
        '-c:a', 'aac',
        '-y',
        outputPath
      ];

      const ffmpeg = spawn('ffmpeg', args);

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error('Watermark addition failed'));
        }

        resolve({
          success: true,
          outputPath
        });
      });

      ffmpeg.on('error', reject);
    });
  }
}

module.exports = {
  VideoPlayer,
  OUTPUT_FORMATS
};
