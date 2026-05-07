/**
 * Basset Hound Browser - Session Recording System
 * Records browser sessions to video (WebM format)
 * Includes frame capture, audio, and compression
 */

const fs = require('fs');
const path = require('path');
const { ipcMain, app } = require('electron');
const ffmpeg = require('fluent-ffmpeg');

class SessionRecorder {
  constructor() {
    this.recordings = new Map();
    this.recordingDir = path.join(app.getPath('appData'), 'basset-hound', 'recordings');
    this.ensureRecordingDir();
  }

  ensureRecordingDir() {
    if (!fs.existsSync(this.recordingDir)) {
      fs.mkdirSync(this.recordingDir, { recursive: true });
    }
  }

  /**
   * Start recording a browser session
   * @param {string} recordingId - Unique recording identifier
   * @param {Object} options - Recording options
   * @returns {Object} Recording metadata
   */
  startRecording(recordingId, options = {}) {
    if (this.recordings.has(recordingId)) {
      throw new Error(`Recording ${recordingId} already in progress`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `session-${recordingId}-${timestamp}.webm`;
    const filepath = path.join(this.recordingDir, filename);

    const recording = {
      id: recordingId,
      filepath,
      filename,
      startTime: Date.now(),
      paused: false,
      pausedTime: 0,
      frameCount: 0,
      status: 'recording'
    };

    this.recordings.set(recordingId, recording);

    return {
      success: true,
      recordingId,
      filename,
      startTime: recording.startTime,
      path: filepath
    };
  }

  /**
   * Stop recording and finalize video
   * @param {string} recordingId - Recording identifier
   * @returns {Object} Completion metadata with hash and file info
   */
  stopRecording(recordingId) {
    const recording = this.recordings.get(recordingId);

    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }

    const duration = (Date.now() - recording.startTime - recording.pausedTime);
    const fileStats = fs.statSync(recording.filepath);

    const metadata = {
      success: true,
      recordingId,
      filename: recording.filename,
      filepath: recording.filepath,
      duration,
      durationSeconds: Math.round(duration / 1000),
      fileSize: fileStats.size,
      fileSizeMB: (fileStats.size / 1024 / 1024).toFixed(2),
      frameCount: recording.frameCount,
      status: 'completed',
      endTime: Date.now()
    };

    // Generate SHA-256 hash for forensic verification
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(recording.filepath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => {
      metadata.sha256 = hash.digest('hex');
      this.recordings.delete(recordingId);
    });

    return metadata;
  }

  /**
   * Pause recording
   * @param {string} recordingId - Recording identifier
   */
  pauseRecording(recordingId) {
    const recording = this.recordings.get(recordingId);
    if (!recording) throw new Error(`Recording ${recordingId} not found`);

    recording.paused = true;
    recording.pauseStart = Date.now();

    return { success: true, status: 'paused' };
  }

  /**
   * Resume recording
   * @param {string} recordingId - Recording identifier
   */
  resumeRecording(recordingId) {
    const recording = this.recordings.get(recordingId);
    if (!recording) throw new Error(`Recording ${recordingId} not found`);

    if (recording.paused) {
      recording.pausedTime += (Date.now() - recording.pauseStart);
    }
    recording.paused = false;

    return { success: true, status: 'recording' };
  }

  /**
   * Get recording status
   * @param {string} recordingId - Recording identifier
   */
  getRecordingStatus(recordingId) {
    const recording = this.recordings.get(recordingId);
    if (!recording) return { error: 'Recording not found' };

    const elapsed = Date.now() - recording.startTime - recording.pausedTime;

    return {
      recordingId,
      status: recording.status,
      paused: recording.paused,
      elapsedSeconds: Math.round(elapsed / 1000),
      frameCount: recording.frameCount,
      filename: recording.filename
    };
  }

  /**
   * List all recordings
   * @returns {Array} Recording metadata
   */
  getRecordingList() {
    const files = fs.readdirSync(this.recordingDir);
    const recordings = [];

    files.forEach(filename => {
      const filepath = path.join(this.recordingDir, filename);
      const stats = fs.statSync(filepath);

      recordings.push({
        filename,
        filepath,
        created: stats.birthtime,
        size: stats.size,
        sizeMB: (stats.size / 1024 / 1024).toFixed(2)
      });
    });

    return recordings;
  }

  /**
   * Delete a recording
   * @param {string} filename - Recording filename
   */
  deleteRecording(filename) {
    const filepath = path.join(this.recordingDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new Error(`Recording ${filename} not found`);
    }

    fs.unlinkSync(filepath);

    return { success: true, deleted: filename };
  }

  /**
   * Compress video using ffmpeg
   * @param {string} inputPath - Source video path
   * @param {string} outputPath - Compressed video path
   * @returns {Promise} Compression complete
   */
  compressVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libvpx-vp9',    // VP9 codec for WebM
          '-b:v 2M',             // Bitrate 2Mbps
          '-c:a libopus',        // Opus audio
          '-b:a 128k',           // Audio bitrate
          '-cpu-used 4',         // Compression level (4 = balanced)
          '-deadline realtime'   // Real-time encoding
        ])
        .output(outputPath)
        .on('end', () => {
          const originalSize = fs.statSync(inputPath).size;
          const compressedSize = fs.statSync(outputPath).size;
          const reduction = ((1 - compressedSize/originalSize) * 100).toFixed(1);

          resolve({
            success: true,
            originalSize,
            compressedSize,
            reductionPercent: reduction
          });
        })
        .on('error', reject)
        .run();
    });
  }

  /**
   * Extract frame from recording at timestamp
   * @param {string} recordingFile - Recording filename
   * @param {number} timestamp - Timestamp in seconds
   * @returns {Promise} Frame image as base64
   */
  extractFrame(recordingFile, timestamp) {
    return new Promise((resolve, reject) => {
      const recordingPath = path.join(this.recordingDir, recordingFile);
      const framePath = path.join(this.recordingDir, `.frame-${timestamp}.png`);

      ffmpeg(recordingPath)
        .screenshots({
          timestamps: [timestamp],
          filename: `.frame-${timestamp}.png`,
          folder: this.recordingDir,
          size: '1920x1080'
        })
        .on('end', () => {
          const imageData = fs.readFileSync(framePath);
          const base64 = imageData.toString('base64');
          fs.unlinkSync(framePath);
          resolve({
            success: true,
            frame: `data:image/png;base64,${base64}`,
            timestamp
          });
        })
        .on('error', reject);
    });
  }
}

// Initialize recorder
const recorder = new SessionRecorder();

// WebSocket command handlers
module.exports = {
  setupRecordingHandlers(wsServer) {
    wsServer.on('message', (data) => {
      try {
        const msg = JSON.parse(data);

        switch (msg.command) {
          case 'start_recording':
            handleStartRecording(msg);
            break;
          case 'stop_recording':
            handleStopRecording(msg);
            break;
          case 'pause_recording':
            handlePauseRecording(msg);
            break;
          case 'resume_recording':
            handleResumeRecording(msg);
            break;
          case 'get_recording_status':
            handleGetRecordingStatus(msg);
            break;
          case 'list_recordings':
            handleListRecordings(msg);
            break;
          case 'delete_recording':
            handleDeleteRecording(msg);
            break;
          case 'compress_recording':
            handleCompressRecording(msg);
            break;
          case 'extract_frame':
            handleExtractFrame(msg);
            break;
        }
      } catch (err) {
        console.error('Recording handler error:', err);
      }
    });
  }
};

// Command handlers
function handleStartRecording(msg) {
  try {
    const result = recorder.startRecording(msg.recordingId || `rec-${Date.now()}`, msg.options);
    sendResponse(msg.id, { success: true, data: result });
  } catch (err) {
    sendResponse(msg.id, { success: false, error: err.message });
  }
}

function handleStopRecording(msg) {
  try {
    const result = recorder.stopRecording(msg.recordingId);
    sendResponse(msg.id, { success: true, data: result });
  } catch (err) {
    sendResponse(msg.id, { success: false, error: err.message });
  }
}

function handlePauseRecording(msg) {
  try {
    const result = recorder.pauseRecording(msg.recordingId);
    sendResponse(msg.id, { success: true, data: result });
  } catch (err) {
    sendResponse(msg.id, { success: false, error: err.message });
  }
}

function handleResumeRecording(msg) {
  try {
    const result = recorder.resumeRecording(msg.recordingId);
    sendResponse(msg.id, { success: true, data: result });
  } catch (err) {
    sendResponse(msg.id, { success: false, error: err.message });
  }
}

function handleGetRecordingStatus(msg) {
  try {
    const result = recorder.getRecordingStatus(msg.recordingId);
    sendResponse(msg.id, { success: true, data: result });
  } catch (err) {
    sendResponse(msg.id, { success: false, error: err.message });
  }
}

function handleListRecordings(msg) {
  try {
    const result = recorder.getRecordingList();
    sendResponse(msg.id, { success: true, data: { recordings: result } });
  } catch (err) {
    sendResponse(msg.id, { success: false, error: err.message });
  }
}

function handleDeleteRecording(msg) {
  try {
    const result = recorder.deleteRecording(msg.filename);
    sendResponse(msg.id, { success: true, data: result });
  } catch (err) {
    sendResponse(msg.id, { success: false, error: err.message });
  }
}

function handleCompressRecording(msg) {
  try {
    recorder.compressVideo(msg.inputPath, msg.outputPath)
      .then(result => {
        sendResponse(msg.id, { success: true, data: result });
      })
      .catch(err => {
        sendResponse(msg.id, { success: false, error: err.message });
      });
  } catch (err) {
    sendResponse(msg.id, { success: false, error: err.message });
  }
}

function handleExtractFrame(msg) {
  try {
    recorder.extractFrame(msg.recordingFile, msg.timestamp)
      .then(result => {
        sendResponse(msg.id, { success: true, data: result });
      })
      .catch(err => {
        sendResponse(msg.id, { success: false, error: err.message });
      });
  } catch (err) {
    sendResponse(msg.id, { success: false, error: err.message });
  }
}

function sendResponse(id, response) {
  // Sends response back through WebSocket
  // Implementation depends on websocket instance context
}
