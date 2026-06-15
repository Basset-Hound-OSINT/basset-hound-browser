/**
 * Basset Hound Browser - Session Playback Module
 *
 * Implements playback system for recorded sessions with timeline scrubbing,
 * speed control, and timestamp seeking capabilities.
 *
 * Features:
 * - Play/pause/resume control
 * - Speed control (0.5x, 1x, 2x, 4x)
 * - Timeline scrubbing and seeking to specific timestamps
 * - Frame-by-frame navigation
 * - Playback state tracking
 * - Event emission for playback updates
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

// Supported playback speeds
const PLAYBACK_SPEEDS = {
  0.5: { multiplier: 0.5, label: 'Slow' },
  1.0: { multiplier: 1.0, label: 'Normal' },
  2.0: { multiplier: 2.0, label: 'Fast' },
  4.0: { multiplier: 4.0, label: 'Very Fast' }
};

/**
 * Session Playback Manager
 * Handles playback of recorded browser sessions
 */
class SessionPlayback extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      defaultSpeed: options.defaultSpeed || 1.0,
      autoLoop: options.autoLoop || false,
      enableFrame: options.enableFrame !== false,
      ...options
    };

    this.sessions = new Map();
    this.validateDefaultSpeed();
  }

  validateDefaultSpeed() {
    if (!PLAYBACK_SPEEDS[this.options.defaultSpeed]) {
      throw new Error(`Unsupported speed: ${this.options.defaultSpeed}. Supported: ${Object.keys(PLAYBACK_SPEEDS).join(', ')}`);
    }
  }

  /**
   * Create a new playback session
   * @param {string} sessionId - Unique session identifier
   * @param {Object} sessionData - Session recording data
   * @returns {PlaybackSession}
   */
  createPlaybackSession(sessionId, sessionData) {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Playback session ${sessionId} already exists`);
    }

    // Validate session data structure
    if (!sessionData.frames || !Array.isArray(sessionData.frames)) {
      throw new Error('Invalid session data: frames array required');
    }

    const playbackSession = new PlaybackSession(sessionId, sessionData, this.options);

    // Relay events from playback session
    playbackSession.on('stateChanged', (state) => {
      this.emit('sessionStateChanged', { sessionId, ...state });
    });

    playbackSession.on('frameChanged', (data) => {
      this.emit('sessionFrameChanged', { sessionId, ...data });
    });

    playbackSession.on('speedChanged', (data) => {
      this.emit('sessionSpeedChanged', { sessionId, ...data });
    });

    playbackSession.on('completed', () => {
      this.emit('sessionCompleted', { sessionId });
      if (this.options.autoLoop) {
        playbackSession.restart();
      }
    });

    this.sessions.set(sessionId, playbackSession);
    return playbackSession;
  }

  /**
   * Get playback session
   * @param {string} sessionId - Session identifier
   * @returns {PlaybackSession|null}
   */
  getPlaybackSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * List all active playback sessions
   * @returns {Array} Array of session IDs
   */
  listPlaybackSessions() {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get all playback speeds
   * @returns {Object} Available playback speeds
   */
  getAvailableSpeeds() {
    return { ...PLAYBACK_SPEEDS };
  }

  /**
   * Load session from file
   * @param {string} filePath - Path to session recording file
   * @returns {Promise<Object>} Loaded session data
   */
  async loadSessionFile(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(new Error(`Failed to load session file: ${err.message}`));
          return;
        }

        try {
          const sessionData = JSON.parse(data);
          resolve(sessionData);
        } catch (parseErr) {
          reject(new Error(`Failed to parse session file: ${parseErr.message}`));
        }
      });
    });
  }

  /**
   * Clean up playback session
   * @param {string} sessionId - Session identifier
   * @returns {void}
   */
  cleanup(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.stop();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Clean up all sessions
   * @returns {void}
   */
  cleanupAll() {
    for (const session of this.sessions.values()) {
      session.stop();
    }
    this.sessions.clear();
  }
}

/**
 * Individual playback session
 */
class PlaybackSession extends EventEmitter {
  constructor(sessionId, sessionData, options = {}) {
    super();

    this.sessionId = sessionId;
    this.sessionData = sessionData;
    this.options = options;

    // Session structure
    this.frames = sessionData.frames || [];
    this.metadata = sessionData.metadata || {};
    this.startTime = sessionData.startTime || Date.now();
    this.duration = this._calculateDuration();

    // Playback state
    this.state = 'stopped'; // stopped, playing, paused
    this.currentFrameIndex = 0;
    this.currentTime = 0; // in seconds
    this.speed = options.defaultSpeed || 1.0;
    this.playbackStartTime = null;
    this.pausedTime = 0;
    this.animationFrameId = null;

    // Timeline tracking
    this.timeline = [];
    this._buildTimeline();
  }

  /**
   * Calculate total duration from frames
   * @private
   * @returns {number} Duration in seconds
   */
  _calculateDuration() {
    if (this.frames.length === 0) {
      return 0;
    }

    const lastFrame = this.frames[this.frames.length - 1];
    return (lastFrame.timestamp || this.frames.length / 30) / 1000;
  }

  /**
   * Build timeline index for efficient seeking
   * @private
   * @returns {void}
   */
  _buildTimeline() {
    this.timeline = [];
    let cumulativeTime = 0;

    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i];
      const frameTime = frame.timestamp ? frame.timestamp / 1000 : cumulativeTime + 1 / 30;

      this.timeline.push({
        index: i,
        timestamp: frame.timestamp || frameTime * 1000,
        time: frameTime
      });

      cumulativeTime = frameTime;
    }
  }

  /**
   * Play the session
   * @returns {void}
   */
  play() {
    if (this.state === 'playing') {
      return;
    }

    this.state = 'playing';
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.playbackStartTime = now - this.pausedTime;

    // Only schedule next frame if we have a browser environment
    if (typeof process === 'undefined' || !process.versions || !process.versions.node) {
      this._scheduleNextFrame();
    }

    this.emit('stateChanged', {
      state: this.state,
      frameIndex: this.currentFrameIndex,
      time: this.currentTime
    });
  }

  /**
   * Pause the playback
   * @returns {void}
   */
  pause() {
    if (this.state !== 'playing') {
      return;
    }

    this.state = 'paused';
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.pausedTime = now - this.playbackStartTime;

    if (this.animationFrameId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animationFrameId);
      } else {
        clearTimeout(this.animationFrameId);
      }
      this.animationFrameId = null;
    }

    this.emit('stateChanged', {
      state: this.state,
      frameIndex: this.currentFrameIndex,
      time: this.currentTime
    });
  }

  /**
   * Resume playback from pause
   * @returns {void}
   */
  resume() {
    if (this.state === 'paused') {
      this.play();
    }
  }

  /**
   * Stop playback
   * @returns {void}
   */
  stop() {
    this.state = 'stopped';
    this.currentFrameIndex = 0;
    this.currentTime = 0;
    this.pausedTime = 0;

    if (this.animationFrameId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animationFrameId);
      } else {
        clearTimeout(this.animationFrameId);
      }
      this.animationFrameId = null;
    }

    this.emit('stateChanged', {
      state: this.state,
      frameIndex: this.currentFrameIndex,
      time: this.currentTime
    });
  }

  /**
   * Set playback speed
   * @param {number} speed - Speed multiplier (0.5, 1.0, 2.0, 4.0)
   * @returns {void}
   */
  setSpeed(speed) {
    if (!PLAYBACK_SPEEDS[speed]) {
      throw new Error(`Unsupported speed: ${speed}. Supported: ${Object.keys(PLAYBACK_SPEEDS).join(', ')}`);
    }

    this.speed = speed;

    // Adjust pausedTime if playing
    if (this.state === 'playing') {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.pausedTime = now - this.playbackStartTime;
    }

    this.emit('speedChanged', {
      speed: this.speed,
      label: PLAYBACK_SPEEDS[speed].label
    });
  }

  /**
   * Seek to a specific timestamp
   * @param {number} timestamp - Time in seconds
   * @returns {void}
   */
  seek(timestamp) {
    // Clamp timestamp to valid range
    const seekTime = Math.max(0, Math.min(timestamp, this.duration));

    // Find frame at this timestamp
    let frameIndex = 0;
    if (this.timeline && this.timeline.length > 0) {
      for (let i = 0; i < this.timeline.length; i++) {
        if (this.timeline[i].time <= seekTime) {
          frameIndex = i;
        } else {
          break;
        }
      }
    }

    this.currentFrameIndex = frameIndex;
    this.currentTime = seekTime;
    this.pausedTime = 0;

    // Update playback start time if playing
    if (this.state === 'playing') {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.playbackStartTime = now;
    }

    this.emit('frameChanged', {
      frameIndex: this.currentFrameIndex,
      time: this.currentTime,
      frame: this.frames[this.currentFrameIndex]
    });
  }

  /**
   * Seek by percentage (0-1)
   * @param {number} percentage - Percentage of total duration (0-1)
   * @returns {void}
   */
  seekByPercentage(percentage) {
    const clampedPercentage = Math.max(0, Math.min(1, percentage));
    this.seek(clampedPercentage * this.duration);
  }

  /**
   * Go to next frame
   * @returns {void}
   */
  nextFrame() {
    if (this.currentFrameIndex < this.frames.length - 1) {
      this.currentFrameIndex++;
      const frame = this.frames[this.currentFrameIndex];
      this.currentTime = frame.timestamp ? frame.timestamp / 1000 : this.currentTime + 1 / 30;

      this.emit('frameChanged', {
        frameIndex: this.currentFrameIndex,
        time: this.currentTime,
        frame
      });
    }
  }

  /**
   * Go to previous frame
   * @returns {void}
   */
  previousFrame() {
    if (this.currentFrameIndex > 0) {
      this.currentFrameIndex--;
      const frame = this.frames[this.currentFrameIndex];
      this.currentTime = frame.timestamp ? frame.timestamp / 1000 : Math.max(0, this.currentTime - 1 / 30);

      this.emit('frameChanged', {
        frameIndex: this.currentFrameIndex,
        time: this.currentTime,
        frame
      });
    }
  }

  /**
   * Restart playback from beginning
   * @returns {void}
   */
  restart() {
    this.stop();
    this.play();
  }

  /**
   * Schedule next frame rendering
   * @private
   * @returns {void}
   */
  _scheduleNextFrame() {
    if (this.state !== 'playing' || this.currentFrameIndex >= this.frames.length) {
      if (this.currentFrameIndex >= this.frames.length) {
        this.state = 'stopped';
        this.emit('completed');
      }
      return;
    }

    const frameInterval = 1000 / 30; // Assume 30 fps
    const adjustedInterval = frameInterval / this.speed;

    // Use setImmediate for test environment, setTimeout for browser
    if (typeof setImmediate !== 'undefined') {
      this.animationFrameId = setImmediate(() => {
        if (this.state === 'playing') {
          this.currentFrameIndex = Math.min(this.currentFrameIndex + 1, this.frames.length - 1);

          this.emit('frameChanged', {
            frameIndex: this.currentFrameIndex,
            time: this.currentTime,
            frame: this.frames[this.currentFrameIndex]
          });

          this._scheduleNextFrame();
        }
      });
    } else {
      this.animationFrameId = setTimeout(() => {
        if (this.state === 'playing') {
          this.currentFrameIndex = Math.min(this.currentFrameIndex + 1, this.frames.length - 1);

          this.emit('frameChanged', {
            frameIndex: this.currentFrameIndex,
            time: this.currentTime,
            frame: this.frames[this.currentFrameIndex]
          });

          this._scheduleNextFrame();
        }
      }, Math.max(1, adjustedInterval));
    }
  }

  /**
   * Get current playback state
   * @returns {Object}
   */
  getState() {
    return {
      sessionId: this.sessionId,
      state: this.state,
      currentFrameIndex: this.currentFrameIndex,
      totalFrames: this.frames.length,
      currentTime: this.currentTime,
      duration: this.duration,
      speed: this.speed,
      progress: this.duration > 0 ? this.currentTime / this.duration : 0
    };
  }

  /**
   * Get current frame
   * @returns {Object|null}
   */
  getCurrentFrame() {
    return this.frames[this.currentFrameIndex] || null;
  }

  /**
   * Get frame at specific index
   * @param {number} index - Frame index
   * @returns {Object|null}
   */
  getFrame(index) {
    return this.frames[index] || null;
  }

  /**
   * Get frame range
   * @param {number} startIndex - Start index
   * @param {number} endIndex - End index
   * @returns {Array} Frame range
   */
  getFrameRange(startIndex, endIndex) {
    return this.frames.slice(startIndex, endIndex + 1);
  }

  /**
   * Export current playback state
   * @returns {Object}
   */
  exportState() {
    return {
      sessionId: this.sessionId,
      ...this.getState(),
      metadata: this.metadata
    };
  }
}

module.exports = {
  SessionPlayback,
  PlaybackSession,
  PLAYBACK_SPEEDS
};
