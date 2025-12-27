/**
 * Basset Hound Browser - Screen Recording Manager
 * Provides screen recording capabilities for browser sessions
 * Supports start/stop/pause recording with WebM/MP4 output
 */

const { ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Recording format configurations
 */
const RECORDING_FORMATS = {
  webm: {
    mimeType: 'video/webm;codecs=vp9',
    extension: '.webm',
    fallbackMimeType: 'video/webm;codecs=vp8'
  },
  mp4: {
    mimeType: 'video/mp4',
    extension: '.mp4',
    // Note: MP4 may require post-processing in some browsers
    fallbackMimeType: 'video/webm'
  }
};

/**
 * Recording quality presets
 */
const QUALITY_PRESETS = {
  low: {
    videoBitsPerSecond: 1000000, // 1 Mbps
    width: 1280,
    height: 720,
    frameRate: 15
  },
  medium: {
    videoBitsPerSecond: 2500000, // 2.5 Mbps
    width: 1920,
    height: 1080,
    frameRate: 24
  },
  high: {
    videoBitsPerSecond: 5000000, // 5 Mbps
    width: 1920,
    height: 1080,
    frameRate: 30
  },
  ultra: {
    videoBitsPerSecond: 8000000, // 8 Mbps
    width: 2560,
    height: 1440,
    frameRate: 60
  }
};

/**
 * Recording state enum
 */
const RecordingState = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PAUSED: 'paused',
  STOPPING: 'stopping'
};

/**
 * RecordingManager class for screen recording capabilities
 */
class RecordingManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.state = RecordingState.IDLE;
    this.recordingId = null;
    this.startTime = null;
    this.pausedDuration = 0;
    this.pauseStartTime = null;
    this.chunks = [];
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;

    this.setupIPCListeners();
  }

  /**
   * Generate unique request ID
   * @returns {string} Unique request identifier
   */
  generateRequestId() {
    return `recording-${Date.now()}-${++this.requestIdCounter}`;
  }

  /**
   * Setup IPC listeners for recording responses
   */
  setupIPCListeners() {
    ipcMain.on('recording-started', (event, data) => {
      const { requestId, ...result } = data;
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver(result);
        this.pendingRequests.delete(requestId);
      }
    });

    ipcMain.on('recording-stopped', (event, data) => {
      const { requestId, ...result } = data;
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver(result);
        this.pendingRequests.delete(requestId);
      }
    });

    ipcMain.on('recording-paused', (event, data) => {
      const { requestId, ...result } = data;
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver(result);
        this.pendingRequests.delete(requestId);
      }
    });

    ipcMain.on('recording-resumed', (event, data) => {
      const { requestId, ...result } = data;
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver(result);
        this.pendingRequests.delete(requestId);
      }
    });

    ipcMain.on('recording-status', (event, data) => {
      const { requestId, ...result } = data;
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver(result);
        this.pendingRequests.delete(requestId);
      }
    });

    ipcMain.on('recording-chunk', (event, data) => {
      // Handle incoming recording chunks
      if (data.chunk && this.state === RecordingState.RECORDING) {
        this.chunks.push(data.chunk);
      }
    });

    ipcMain.on('recording-error', (event, data) => {
      const { requestId, error } = data;
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver({ success: false, error });
        this.pendingRequests.delete(requestId);
      }
      this.state = RecordingState.IDLE;
    });
  }

  /**
   * Start screen recording
   * @param {Object} options - Recording options
   * @returns {Promise<Object>} Recording start result
   */
  async startRecording(options = {}) {
    if (this.state !== RecordingState.IDLE) {
      return {
        success: false,
        error: `Cannot start recording: current state is ${this.state}`
      };
    }

    const {
      format = 'webm',
      quality = 'medium',
      includeAudio = false,
      filename = null
    } = options;

    // Get format configuration
    const formatConfig = RECORDING_FORMATS[format] || RECORDING_FORMATS.webm;
    const qualityConfig = QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;

    const requestId = this.generateRequestId();
    this.recordingId = requestId;

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, (result) => {
        if (result.success) {
          this.state = RecordingState.RECORDING;
          this.startTime = Date.now();
          this.pausedDuration = 0;
          this.chunks = [];
        }
        resolve(result);
      });

      this.mainWindow.webContents.send('start-recording', {
        requestId,
        format,
        formatConfig,
        qualityConfig,
        includeAudio,
        filename
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Recording start timeout' });
        }
      }, 30000);
    });
  }

  /**
   * Stop screen recording
   * @param {Object} options - Stop options
   * @returns {Promise<Object>} Recording stop result with video data
   */
  async stopRecording(options = {}) {
    if (this.state !== RecordingState.RECORDING && this.state !== RecordingState.PAUSED) {
      return {
        success: false,
        error: `Cannot stop recording: current state is ${this.state}`
      };
    }

    const {
      savePath = null,
      returnData = true
    } = options;

    const requestId = this.generateRequestId();
    this.state = RecordingState.STOPPING;

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, async (result) => {
        if (result.success) {
          const duration = Date.now() - this.startTime - this.pausedDuration;
          result.duration = duration;
          result.recordingId = this.recordingId;

          // Save to file if path provided
          if (savePath && result.data) {
            try {
              const saveResult = await this.saveToFile(result.data, savePath);
              result.savedTo = saveResult.success ? savePath : null;
              result.saveError = saveResult.error || null;
            } catch (error) {
              result.saveError = error.message;
            }
          }

          // Clear data if not requested
          if (!returnData) {
            delete result.data;
          }
        }

        this.state = RecordingState.IDLE;
        this.recordingId = null;
        this.startTime = null;
        this.chunks = [];

        resolve(result);
      });

      this.mainWindow.webContents.send('stop-recording', {
        requestId,
        savePath,
        returnData
      });

      // Timeout after 60 seconds (encoding may take time)
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          this.state = RecordingState.IDLE;
          resolve({ success: false, error: 'Recording stop timeout' });
        }
      }, 60000);
    });
  }

  /**
   * Pause screen recording
   * @returns {Promise<Object>} Pause result
   */
  async pauseRecording() {
    if (this.state !== RecordingState.RECORDING) {
      return {
        success: false,
        error: `Cannot pause recording: current state is ${this.state}`
      };
    }

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, (result) => {
        if (result.success) {
          this.state = RecordingState.PAUSED;
          this.pauseStartTime = Date.now();
        }
        resolve(result);
      });

      this.mainWindow.webContents.send('pause-recording', { requestId });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Pause timeout' });
        }
      }, 10000);
    });
  }

  /**
   * Resume screen recording
   * @returns {Promise<Object>} Resume result
   */
  async resumeRecording() {
    if (this.state !== RecordingState.PAUSED) {
      return {
        success: false,
        error: `Cannot resume recording: current state is ${this.state}`
      };
    }

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, (result) => {
        if (result.success) {
          this.state = RecordingState.RECORDING;
          if (this.pauseStartTime) {
            this.pausedDuration += Date.now() - this.pauseStartTime;
            this.pauseStartTime = null;
          }
        }
        resolve(result);
      });

      this.mainWindow.webContents.send('resume-recording', { requestId });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Resume timeout' });
        }
      }, 10000);
    });
  }

  /**
   * Get current recording status
   * @returns {Object} Current recording status
   */
  getStatus() {
    const status = {
      state: this.state,
      recordingId: this.recordingId
    };

    if (this.state === RecordingState.RECORDING || this.state === RecordingState.PAUSED) {
      status.duration = Date.now() - this.startTime - this.pausedDuration;
      if (this.state === RecordingState.PAUSED && this.pauseStartTime) {
        status.pausedFor = Date.now() - this.pauseStartTime;
      }
    }

    return status;
  }

  /**
   * Save recording data to file
   * @param {string} videoData - Base64 encoded video data
   * @param {string} filePath - Path to save the file
   * @returns {Promise<Object>} Save result
   */
  async saveToFile(videoData, filePath) {
    try {
      // Extract base64 data
      const base64Data = videoData.replace(/^data:video\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, buffer);

      return {
        success: true,
        filePath,
        size: buffer.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available recording sources (screens/windows)
   * @returns {Promise<Array>} Available sources
   */
  async getAvailableSources() {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 150, height: 150 }
      });

      return {
        success: true,
        sources: sources.map(source => ({
          id: source.id,
          name: source.name,
          thumbnail: source.thumbnail.toDataURL(),
          displayId: source.display_id
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get supported formats
   * @returns {Array} List of supported formats
   */
  getSupportedFormats() {
    return Object.keys(RECORDING_FORMATS);
  }

  /**
   * Get quality presets
   * @returns {Object} Quality presets configuration
   */
  getQualityPresets() {
    return QUALITY_PRESETS;
  }

  /**
   * Cleanup and release resources
   */
  cleanup() {
    if (this.state === RecordingState.RECORDING || this.state === RecordingState.PAUSED) {
      this.stopRecording({ returnData: false });
    }
    this.pendingRequests.clear();
    this.chunks = [];
  }
}

module.exports = {
  RecordingManager,
  RECORDING_FORMATS,
  QUALITY_PRESETS,
  RecordingState
};
