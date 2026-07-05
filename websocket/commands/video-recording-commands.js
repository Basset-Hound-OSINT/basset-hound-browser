/**
 * Basset Hound Browser - Video Recording WebSocket Commands
 *
 * Provides WebSocket API for video recording and playback functionality
 *
 * Commands:
 * - start_video_recording - Begin video capture
 * - stop_video_recording - End recording
 * - pause_video_recording - Pause recording
 * - resume_video_recording - Resume recording
 * - get_video_recording_status - Get current status
 * - list_recordings - List available videos
 * - get_video_info - Get video metadata
 * - export_video - Export to different format
 * - extract_frames - Extract frames from video
 * - create_video_thumbnail - Generate thumbnail
 * - delete_video - Delete video file
 * - get_storage_stats - Get storage statistics
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const {
  VideoEncoder,
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

// Global instances
let videoEncoder = null;
let videoStorage = null;
let videoPlayer = null;
const screenshotIntervalHandle = null;

const activeSessions = new Map();

/**
 * Initialize video recording system
 */
function initializeVideoRecording(options = {}) {
  if (!videoEncoder) {
    videoEncoder = new VideoEncoder(options);
  }
  if (!videoStorage) {
    videoStorage = new VideoStorage(options);
  }
  if (!videoPlayer) {
    videoPlayer = new VideoPlayer(options);
  }
}

/**
 * Register video recording commands
 */
function registerVideoRecordingCommands(commandHandlers, mainWindow) {
  // Initialize video recording system
  if (!videoEncoder) {
    initializeVideoRecording();
  }

  /**
   * Start video recording
   *
   * Command: start_video_recording
   * Params:
   *   - sessionId: string (required)
   *   - codec: string (optional, default: 'vp9') - vp8, vp9, h264, h265
   *   - fps: number (optional, default: 24) - 10, 24, or 30
   *   - quality: number (optional) - codec-specific quality setting
   *   - maxWidth: number (optional, default: 1920)
   *   - maxHeight: number (optional, default: 1080)
   *   - enableAudio: boolean (optional, default: false)
   *   - enableCompression: boolean (optional, default: true)
   *   - tags: array (optional)
   *   - metadata: object (optional)
   */
  commandHandlers.start_video_recording = async (params) => {
    try {
      const {
        sessionId,
        codec = 'vp9',
        fps = 24,
        quality = null,
        maxWidth = 1920,
        maxHeight = 1080,
        enableAudio = false,
        enableCompression = true,
        tags = [],
        metadata = {}
      } = params;

      if (!sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      if (activeSessions.has(sessionId)) {
        return {
          success: false,
          error: `Recording session ${sessionId} already active`
        };
      }

      // Check FFmpeg availability
      const ffmpegAvailable = await VideoEncoder.isAvailable();
      if (!ffmpegAvailable) {
        return {
          success: false,
          error: 'FFmpeg is not available. Please install FFmpeg.'
        };
      }

      // Create encoding session
      const session = videoEncoder.createSession(sessionId, {
        codec,
        fps,
        quality,
        maxWidth,
        maxHeight,
        enableAudio,
        enableCompression
      });

      await session.start();

      activeSessions.set(sessionId, {
        session,
        startTime: Date.now(),
        tags,
        metadata,
        screenshots: 0
      });

      return {
        success: true,
        sessionId,
        codec,
        fps,
        quality: session.quality,
        resolution: { width: maxWidth, height: maxHeight },
        state: 'recording'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Stop video recording
   *
   * Command: stop_video_recording
   * Params:
   *   - sessionId: string (required)
   */
  commandHandlers.stop_video_recording = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return {
          success: false,
          error: 'sessionId is required'
        };
      }

      if (!activeSessions.has(sessionId)) {
        return {
          success: false,
          error: `Recording session ${sessionId} not found`
        };
      }

      const recordingData = activeSessions.get(sessionId);
      const session = recordingData.session;

      // Finalize the encoding
      const metrics = await session.finalize();

      // Register video in storage
      videoStorage.registerVideo(session.getOutputPath(), {
        codec: metrics.codec,
        fps: metrics.frameRate,
        duration: metrics.duration,
        resolution: metrics.resolution,
        metadata: recordingData.metadata,
        tags: recordingData.tags
      });

      activeSessions.delete(sessionId);

      return {
        success: true,
        sessionId,
        outputPath: session.getOutputPath(),
        metrics: {
          framesProcessed: metrics.framesProcessed,
          duration: metrics.duration,
          fileSize: metrics.bytesWritten,
          codec: metrics.codec,
          fps: metrics.frameRate
        }
      };
    } catch (error) {
      activeSessions.delete(params.sessionId);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Pause video recording
   *
   * Command: pause_video_recording
   * Params:
   *   - sessionId: string (required)
   */
  commandHandlers.pause_video_recording = async (params) => {
    try {
      const { sessionId } = params;

      if (!activeSessions.has(sessionId)) {
        return {
          success: false,
          error: `Recording session ${sessionId} not found`
        };
      }

      const recordingData = activeSessions.get(sessionId);
      recordingData.session.pause();

      return {
        success: true,
        sessionId,
        state: 'paused'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Resume video recording
   *
   * Command: resume_video_recording
   * Params:
   *   - sessionId: string (required)
   */
  commandHandlers.resume_video_recording = async (params) => {
    try {
      const { sessionId } = params;

      if (!activeSessions.has(sessionId)) {
        return {
          success: false,
          error: `Recording session ${sessionId} not found`
        };
      }

      const recordingData = activeSessions.get(sessionId);
      recordingData.session.resume();

      return {
        success: true,
        sessionId,
        state: 'recording'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Add screenshot frame to video recording
   *
   * Command: add_video_frame
   * Params:
   *   - sessionId: string (required)
   *   - frameData: string (required) - base64-encoded image data
   *   - metadata: object (optional)
   */
  commandHandlers.add_video_frame = async (params) => {
    try {
      const { sessionId, frameData, metadata = {} } = params;

      if (!sessionId || !frameData) {
        return {
          success: false,
          error: 'sessionId and frameData are required'
        };
      }

      if (!activeSessions.has(sessionId)) {
        return {
          success: false,
          error: `Recording session ${sessionId} not found`
        };
      }

      const recordingData = activeSessions.get(sessionId);
      const session = recordingData.session;

      await session.addFrame(frameData, metadata);

      recordingData.screenshots++;

      return {
        success: true,
        sessionId,
        frameNumber: recordingData.screenshots,
        metrics: session.getMetrics()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get video recording status
   *
   * Command: get_video_recording_status
   * Params:
   *   - sessionId: string (optional) - Get status of specific session
   */
  commandHandlers.get_video_recording_status = async (params) => {
    try {
      if (params.sessionId) {
        // Status of specific session
        if (!activeSessions.has(params.sessionId)) {
          return {
            success: false,
            error: `Recording session ${params.sessionId} not found`
          };
        }

        const recordingData = activeSessions.get(params.sessionId);
        return {
          success: true,
          sessions: [{
            sessionId: params.sessionId,
            state: recordingData.session.state,
            metrics: recordingData.session.getMetrics(),
            startTime: recordingData.startTime,
            elapsedTime: Date.now() - recordingData.startTime
          }]
        };
      } else {
        // Status of all sessions
        const sessions = [];
        for (const [sessionId, recordingData] of activeSessions.entries()) {
          sessions.push({
            sessionId,
            state: recordingData.session.state,
            metrics: recordingData.session.getMetrics(),
            startTime: recordingData.startTime,
            elapsedTime: Date.now() - recordingData.startTime
          });
        }

        return {
          success: true,
          activeSessions: sessions.length,
          sessions
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * List recorded videos
   *
   * Command: list_recordings
   * Params:
   *   - tags: array (optional) - Filter by tags
   *   - codec: string (optional) - Filter by codec
   *   - sortBy: string (optional) - Sort field (created, size, duration)
   *   - sortOrder: string (optional) - 'asc' or 'desc'
   */
  commandHandlers.list_recordings = async (params) => {
    try {
      const videos = videoStorage.listVideos({
        tags: params.tags,
        codec: params.codec,
        sortBy: params.sortBy || 'created',
        sortOrder: params.sortOrder || 'desc'
      });

      return {
        success: true,
        count: videos.length,
        videos: videos.map(v => ({
          filename: v.filename,
          codec: v.codec,
          duration: v.duration,
          size: v.size,
          created: v.created,
          fps: v.fps,
          resolution: v.resolution,
          tags: v.tags
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get video metadata
   *
   * Command: get_video_info
   * Params:
   *   - filename: string (required)
   */
  commandHandlers.get_video_info = async (params) => {
    try {
      const { filename } = params;

      if (!filename) {
        return {
          success: false,
          error: 'filename is required'
        };
      }

      const info = videoStorage.getVideoInfo(filename);
      if (!info) {
        return {
          success: false,
          error: `Video not found: ${filename}`
        };
      }

      // Get detailed metadata from FFmpeg
      const metadata = await videoPlayer.getVideoMetadata(info.path);

      return {
        success: true,
        video: {
          ...info,
          detailed: metadata
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Export video to different format
   *
   * Command: export_video
   * Params:
   *   - filename: string (required)
   *   - format: string (required) - mp4, webm, mkv, mov
   *   - quality: number (optional)
   *   - startTime: number (optional) - Trim start (seconds)
   *   - endTime: number (optional) - Trim end (seconds)
   *   - speed: number (optional, default: 1.0)
   *   - resolution: string (optional) - WIDTHxHEIGHT format
   */
  commandHandlers.export_video = async (params) => {
    try {
      const {
        filename,
        format = 'mp4',
        quality = null,
        startTime = null,
        endTime = null,
        speed = 1.0,
        resolution = null
      } = params;

      if (!filename || !format) {
        return {
          success: false,
          error: 'filename and format are required'
        };
      }

      const videoInfo = videoStorage.getVideoInfo(filename);
      if (!videoInfo) {
        return {
          success: false,
          error: `Video not found: ${filename}`
        };
      }

      const result = await videoPlayer.exportVideo(videoInfo.path, {
        format,
        quality,
        startTime,
        endTime,
        speed,
        resolution
      });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Extract frames from video
   *
   * Command: extract_frames
   * Params:
   *   - filename: string (required)
   *   - startTime: number (optional)
   *   - endTime: number (optional)
   *   - format: string (optional, default: 'png')
   */
  commandHandlers.extract_frames = async (params) => {
    try {
      const {
        filename,
        startTime = 0,
        endTime = null,
        format = 'png'
      } = params;

      if (!filename) {
        return {
          success: false,
          error: 'filename is required'
        };
      }

      const videoInfo = videoStorage.getVideoInfo(filename);
      if (!videoInfo) {
        return {
          success: false,
          error: `Video not found: ${filename}`
        };
      }

      const result = await videoPlayer.extractFrames(videoInfo.path, {
        startTime,
        endTime,
        format
      });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Create video thumbnail
   *
   * Command: create_video_thumbnail
   * Params:
   *   - filename: string (required)
   *   - timestamp: string|number (optional, default: '00:00:01')
   *   - width: number (optional, default: 320)
   *   - height: number (optional, default: 180)
   */
  commandHandlers.create_video_thumbnail = async (params) => {
    try {
      const {
        filename,
        timestamp = '00:00:01',
        width = 320,
        height = 180
      } = params;

      if (!filename) {
        return {
          success: false,
          error: 'filename is required'
        };
      }

      const videoInfo = videoStorage.getVideoInfo(filename);
      if (!videoInfo) {
        return {
          success: false,
          error: `Video not found: ${filename}`
        };
      }

      const result = await videoPlayer.createThumbnail(videoInfo.path, {
        timestamp,
        width,
        height
      });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Delete video file
   *
   * Command: delete_video
   * Params:
   *   - filename: string (required)
   */
  commandHandlers.delete_video = async (params) => {
    try {
      const { filename } = params;

      if (!filename) {
        return {
          success: false,
          error: 'filename is required'
        };
      }

      const result = await videoStorage.deleteVideo(filename);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get storage statistics
   *
   * Command: get_video_storage_stats
   * Params: none
   */
  commandHandlers.get_video_storage_stats = async (params) => {
    try {
      const stats = videoStorage.getStorageStats();

      return {
        success: true,
        ...stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Cleanup videos based on policy
   *
   * Command: cleanup_video_storage
   * Params:
   *   - policy: string (optional) - Override cleanup policy
   */
  commandHandlers.cleanup_video_storage = async (params) => {
    try {
      const result = await videoStorage.cleanup();

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };
}

module.exports = {
  registerVideoRecordingCommands,
  initializeVideoRecording,
  CODEC_PRESETS,
  FRAME_RATE_PRESETS,
  CLEANUP_POLICIES,
  OUTPUT_FORMATS
};
