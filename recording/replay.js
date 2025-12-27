/**
 * Basset Hound Browser - Replay Engine
 * Replays recorded sessions with timing control and error handling
 */

const EventEmitter = require('events');
const { ipcMain } = require('electron');
const { Action, ACTION_TYPES } = require('./action');

/**
 * Replay state enum
 */
const REPLAY_STATE = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  COMPLETED: 'completed',
  ERROR: 'error'
};

/**
 * Error handling modes
 */
const ERROR_MODE = {
  FAIL: 'fail',       // Stop replay on error
  SKIP: 'skip',       // Skip failed action and continue
  RETRY: 'retry',     // Retry failed action
  PAUSE: 'pause'      // Pause replay on error for manual intervention
};

/**
 * ReplayEngine - Replays recorded sessions
 */
class ReplayEngine extends EventEmitter {
  /**
   * Create a new ReplayEngine
   * @param {Object} options
   */
  constructor(options = {}) {
    super();

    this.mainWindow = options.mainWindow || null;
    this.state = REPLAY_STATE.IDLE;
    this.currentRecording = null;
    this.currentActionIndex = 0;
    this.replayStartTime = null;
    this.pauseStartTime = null;
    this.totalPausedDuration = 0;

    // Replay options
    this.speed = options.speed || 1.0;
    this.errorMode = options.errorMode || ERROR_MODE.PAUSE;
    this.maxRetries = options.maxRetries || 3;
    this.actionTimeout = options.actionTimeout || 30000;
    this.stepMode = false;

    // Variables for parameterization
    this.variables = {};

    // Progress tracking
    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      retried: 0
    };

    // Results storage
    this.results = [];

    // Current action timer
    this.actionTimer = null;
    this.timeoutTimer = null;

    // Pending IPC response handlers
    this.pendingResponse = null;

    // Setup IPC handlers
    this.setupIPCHandlers();
  }

  /**
   * Set main window reference
   * @param {BrowserWindow} mainWindow
   */
  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Setup IPC handlers for action responses
   */
  setupIPCHandlers() {
    // Handle action completion from renderer
    ipcMain.on('replay-action-complete', (event, data) => {
      if (this.pendingResponse) {
        const { resolve, reject } = this.pendingResponse;
        this.pendingResponse = null;

        if (this.timeoutTimer) {
          clearTimeout(this.timeoutTimer);
          this.timeoutTimer = null;
        }

        if (data.success) {
          resolve(data);
        } else {
          reject(new Error(data.error || 'Action failed'));
        }
      }
    });

    // Handle navigation complete
    ipcMain.on('replay-navigate-complete', (event, data) => {
      if (this.pendingResponse) {
        const { resolve } = this.pendingResponse;
        this.pendingResponse = null;

        if (this.timeoutTimer) {
          clearTimeout(this.timeoutTimer);
          this.timeoutTimer = null;
        }

        resolve(data);
      }
    });
  }

  /**
   * Start replay of a recording
   * @param {Object} recording - Recording to replay
   * @param {Object} options - Replay options
   * @returns {Object}
   */
  startReplay(recording, options = {}) {
    if (this.state === REPLAY_STATE.PLAYING) {
      return {
        success: false,
        error: 'Replay already in progress'
      };
    }

    if (!recording || !recording.actions || recording.actions.length === 0) {
      return {
        success: false,
        error: 'Invalid recording or no actions to replay'
      };
    }

    // Set options
    if (options.speed !== undefined) this.speed = options.speed;
    if (options.errorMode !== undefined) this.errorMode = options.errorMode;
    if (options.maxRetries !== undefined) this.maxRetries = options.maxRetries;
    if (options.actionTimeout !== undefined) this.actionTimeout = options.actionTimeout;
    if (options.stepMode !== undefined) this.stepMode = options.stepMode;

    // Set variables for parameterization
    this.variables = {
      ...(recording.variables || {}),
      ...(options.variables || {})
    };

    // Prepare actions
    this.currentRecording = recording;
    this.currentActionIndex = options.startIndex || 0;
    this.replayStartTime = Date.now();
    this.totalPausedDuration = 0;

    // Reset progress
    this.progress = {
      total: recording.actions.length,
      completed: 0,
      failed: 0,
      skipped: 0,
      retried: 0
    };
    this.results = [];

    this.state = REPLAY_STATE.PLAYING;

    // Notify renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('replay-started', {
        recordingId: recording.id,
        recordingName: recording.name,
        totalActions: recording.actions.length
      });
    }

    this.emit('replay-started', {
      recordingId: recording.id,
      totalActions: recording.actions.length
    });

    console.log(`[ReplayEngine] Started replay: ${recording.name} (${recording.actions.length} actions)`);

    // Start execution
    if (!this.stepMode) {
      this.executeNextAction();
    }

    return {
      success: true,
      recordingId: recording.id,
      totalActions: recording.actions.length,
      stepMode: this.stepMode
    };
  }

  /**
   * Execute the next action in the sequence
   */
  async executeNextAction() {
    if (this.state !== REPLAY_STATE.PLAYING) {
      return;
    }

    if (this.currentActionIndex >= this.currentRecording.actions.length) {
      this.completeReplay();
      return;
    }

    const actionData = this.currentRecording.actions[this.currentActionIndex];
    const action = actionData instanceof Action ? actionData : Action.fromJSON(actionData);

    // Apply variable substitution
    const substitutedAction = action.substituteVariables(this.variables);

    // Calculate delay based on timing and speed
    const delay = this.stepMode ? 0 : Math.round(action.timeSincePrevious / this.speed);

    // Notify progress
    this.emitProgress(substitutedAction);

    // Wait for delay
    if (delay > 0 && this.currentActionIndex > 0) {
      await this.sleep(delay);
    }

    // Check if still playing after delay
    if (this.state !== REPLAY_STATE.PLAYING) {
      return;
    }

    // Execute the action
    try {
      const result = await this.executeAction(substitutedAction);
      this.results.push({
        actionIndex: this.currentActionIndex,
        actionType: substitutedAction.type,
        success: true,
        result,
        timestamp: Date.now()
      });
      this.progress.completed++;
    } catch (error) {
      const handled = await this.handleActionError(substitutedAction, error);
      if (!handled) {
        return; // Error handling stopped replay
      }
    }

    // Move to next action
    this.currentActionIndex++;

    // Continue or wait for step
    if (!this.stepMode && this.state === REPLAY_STATE.PLAYING) {
      setImmediate(() => this.executeNextAction());
    }
  }

  /**
   * Execute a single action
   * @param {Action} action
   * @returns {Promise<Object>}
   */
  async executeAction(action) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      throw new Error('Main window not available');
    }

    console.log(`[ReplayEngine] Executing: ${action.type}`, action.data);

    switch (action.type) {
      case ACTION_TYPES.NAVIGATE:
        return await this.executeNavigate(action);

      case ACTION_TYPES.CLICK:
        return await this.executeClick(action);

      case ACTION_TYPES.TYPE:
        return await this.executeType(action);

      case ACTION_TYPES.SCROLL:
        return await this.executeScroll(action);

      case ACTION_TYPES.WAIT:
        return await this.executeWait(action);

      case ACTION_TYPES.SCREENSHOT:
        return await this.executeScreenshot(action);

      case ACTION_TYPES.EXECUTE_SCRIPT:
        return await this.executeScript(action);

      case ACTION_TYPES.KEY_PRESS:
        return await this.executeKeyPress(action);

      case ACTION_TYPES.HOVER:
        return await this.executeHover(action);

      case ACTION_TYPES.SELECT:
        return await this.executeSelect(action);

      case ACTION_TYPES.ASSERT:
        return await this.executeAssert(action);

      case ACTION_TYPES.COMMENT:
        return { success: true, comment: action.data.comment };

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Execute navigate action
   */
  async executeNavigate(action) {
    return new Promise((resolve, reject) => {
      this.pendingResponse = { resolve, reject };

      this.timeoutTimer = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error('Navigation timeout'));
      }, this.actionTimeout);

      this.mainWindow.webContents.send('replay-navigate', {
        url: action.data.url,
        waitForLoad: action.data.waitForLoad !== false
      });
    });
  }

  /**
   * Execute click action
   */
  async executeClick(action) {
    return new Promise((resolve, reject) => {
      this.pendingResponse = { resolve, reject };

      this.timeoutTimer = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error('Click timeout'));
      }, this.actionTimeout);

      this.mainWindow.webContents.send('replay-click', {
        selector: action.data.selector,
        x: action.data.x,
        y: action.data.y,
        button: action.data.button,
        clickCount: action.data.clickCount,
        humanize: action.data.humanize
      });
    });
  }

  /**
   * Execute type action
   */
  async executeType(action) {
    return new Promise((resolve, reject) => {
      this.pendingResponse = { resolve, reject };

      this.timeoutTimer = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error('Type timeout'));
      }, this.actionTimeout);

      this.mainWindow.webContents.send('replay-type', {
        selector: action.data.selector,
        text: action.data.text,
        clearFirst: action.data.clearFirst,
        humanize: action.data.humanize,
        delay: action.data.delay
      });
    });
  }

  /**
   * Execute scroll action
   */
  async executeScroll(action) {
    return new Promise((resolve, reject) => {
      this.pendingResponse = { resolve, reject };

      this.timeoutTimer = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error('Scroll timeout'));
      }, this.actionTimeout);

      this.mainWindow.webContents.send('replay-scroll', {
        x: action.data.x,
        y: action.data.y,
        selector: action.data.selector,
        behavior: action.data.behavior
      });
    });
  }

  /**
   * Execute wait action
   */
  async executeWait(action) {
    if (action.data.duration) {
      await this.sleep(action.data.duration);
      return { success: true, waited: action.data.duration };
    }

    if (action.data.selector) {
      return new Promise((resolve, reject) => {
        this.pendingResponse = { resolve, reject };

        this.timeoutTimer = setTimeout(() => {
          this.pendingResponse = null;
          reject(new Error(`Wait for element timeout: ${action.data.selector}`));
        }, action.data.timeout || this.actionTimeout);

        this.mainWindow.webContents.send('replay-wait', {
          selector: action.data.selector,
          condition: action.data.condition,
          timeout: action.data.timeout
        });
      });
    }

    return { success: true };
  }

  /**
   * Execute screenshot action
   */
  async executeScreenshot(action) {
    return new Promise((resolve, reject) => {
      this.pendingResponse = { resolve, reject };

      this.timeoutTimer = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error('Screenshot timeout'));
      }, this.actionTimeout);

      this.mainWindow.webContents.send('replay-screenshot', {
        name: action.data.name,
        fullPage: action.data.fullPage,
        selector: action.data.selector,
        format: action.data.format
      });
    });
  }

  /**
   * Execute script action
   */
  async executeScript(action) {
    return new Promise((resolve, reject) => {
      this.pendingResponse = { resolve, reject };

      this.timeoutTimer = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error('Script execution timeout'));
      }, this.actionTimeout);

      this.mainWindow.webContents.send('replay-execute-script', {
        script: action.data.script,
        args: action.data.args
      });
    });
  }

  /**
   * Execute key press action
   */
  async executeKeyPress(action) {
    return new Promise((resolve, reject) => {
      this.pendingResponse = { resolve, reject };

      this.timeoutTimer = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error('Key press timeout'));
      }, this.actionTimeout);

      this.mainWindow.webContents.send('replay-keypress', {
        key: action.data.key,
        modifiers: action.data.modifiers,
        repeat: action.data.repeat
      });
    });
  }

  /**
   * Execute hover action
   */
  async executeHover(action) {
    return new Promise((resolve, reject) => {
      this.pendingResponse = { resolve, reject };

      this.timeoutTimer = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error('Hover timeout'));
      }, this.actionTimeout);

      this.mainWindow.webContents.send('replay-hover', {
        selector: action.data.selector,
        duration: action.data.duration
      });
    });
  }

  /**
   * Execute select action
   */
  async executeSelect(action) {
    return new Promise((resolve, reject) => {
      this.pendingResponse = { resolve, reject };

      this.timeoutTimer = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error('Select timeout'));
      }, this.actionTimeout);

      this.mainWindow.webContents.send('replay-select', {
        selector: action.data.selector,
        value: action.data.value,
        byValue: action.data.byValue,
        byIndex: action.data.byIndex
      });
    });
  }

  /**
   * Execute assert action
   */
  async executeAssert(action) {
    return new Promise((resolve, reject) => {
      this.pendingResponse = { resolve, reject };

      this.timeoutTimer = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error('Assert timeout'));
      }, this.actionTimeout);

      this.mainWindow.webContents.send('replay-assert', {
        type: action.data.type,
        selector: action.data.selector,
        expected: action.data.expected,
        attribute: action.data.attribute
      });
    });
  }

  /**
   * Handle action error based on error mode
   * @param {Action} action
   * @param {Error} error
   * @returns {boolean} Whether replay should continue
   */
  async handleActionError(action, error, retryCount = 0) {
    console.error(`[ReplayEngine] Action failed: ${action.type}`, error.message);

    this.results.push({
      actionIndex: this.currentActionIndex,
      actionType: action.type,
      success: false,
      error: error.message,
      timestamp: Date.now(),
      retryCount
    });

    switch (this.errorMode) {
      case ERROR_MODE.FAIL:
        this.state = REPLAY_STATE.ERROR;
        this.progress.failed++;
        this.emitError(action, error);
        return false;

      case ERROR_MODE.SKIP:
        this.progress.skipped++;
        this.emit('action-skipped', {
          actionIndex: this.currentActionIndex,
          action: action.toJSON(),
          error: error.message
        });
        return true;

      case ERROR_MODE.RETRY:
        if (retryCount < this.maxRetries) {
          this.progress.retried++;
          console.log(`[ReplayEngine] Retrying action (${retryCount + 1}/${this.maxRetries})`);
          await this.sleep(1000 * (retryCount + 1)); // Exponential backoff
          try {
            await this.executeAction(action);
            this.progress.completed++;
            return true;
          } catch (retryError) {
            return this.handleActionError(action, retryError, retryCount + 1);
          }
        } else {
          this.progress.failed++;
          this.state = REPLAY_STATE.ERROR;
          this.emitError(action, error);
          return false;
        }

      case ERROR_MODE.PAUSE:
        this.progress.failed++;
        this.state = REPLAY_STATE.PAUSED;
        this.pauseStartTime = Date.now();
        this.emit('replay-paused-on-error', {
          actionIndex: this.currentActionIndex,
          action: action.toJSON(),
          error: error.message
        });
        return false;

      default:
        this.progress.failed++;
        this.state = REPLAY_STATE.ERROR;
        this.emitError(action, error);
        return false;
    }
  }

  /**
   * Emit progress event
   * @param {Action} action
   */
  emitProgress(action) {
    const elapsed = Date.now() - this.replayStartTime - this.totalPausedDuration;
    const progressData = {
      currentIndex: this.currentActionIndex,
      totalActions: this.progress.total,
      percent: Math.round((this.currentActionIndex / this.progress.total) * 100),
      elapsed,
      action: action.toJSON(),
      stats: { ...this.progress }
    };

    this.emit('replay-progress', progressData);

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('replay-progress', progressData);
    }
  }

  /**
   * Emit error event
   * @param {Action} action
   * @param {Error} error
   */
  emitError(action, error) {
    const errorData = {
      actionIndex: this.currentActionIndex,
      action: action.toJSON(),
      error: error.message,
      stats: { ...this.progress }
    };

    this.emit('replay-error', errorData);

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('replay-error', errorData);
    }
  }

  /**
   * Complete the replay
   */
  completeReplay() {
    const duration = Date.now() - this.replayStartTime - this.totalPausedDuration;

    this.state = REPLAY_STATE.COMPLETED;

    const completionData = {
      recordingId: this.currentRecording.id,
      recordingName: this.currentRecording.name,
      duration,
      stats: { ...this.progress },
      results: this.results
    };

    this.emit('replay-completed', completionData);

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('replay-completed', completionData);
    }

    console.log(`[ReplayEngine] Replay completed: ${this.progress.completed}/${this.progress.total} actions (${duration}ms)`);
  }

  /**
   * Pause replay
   * @returns {Object}
   */
  pauseReplay() {
    if (this.state !== REPLAY_STATE.PLAYING) {
      return {
        success: false,
        error: `Cannot pause: current state is ${this.state}`
      };
    }

    this.state = REPLAY_STATE.PAUSED;
    this.pauseStartTime = Date.now();

    this.emit('replay-paused', {
      actionIndex: this.currentActionIndex,
      stats: { ...this.progress }
    });

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('replay-paused', {
        actionIndex: this.currentActionIndex
      });
    }

    console.log('[ReplayEngine] Replay paused');

    return {
      success: true,
      state: this.state,
      currentIndex: this.currentActionIndex
    };
  }

  /**
   * Resume replay
   * @returns {Object}
   */
  resumeReplay() {
    if (this.state !== REPLAY_STATE.PAUSED) {
      return {
        success: false,
        error: `Cannot resume: current state is ${this.state}`
      };
    }

    if (this.pauseStartTime) {
      this.totalPausedDuration += Date.now() - this.pauseStartTime;
      this.pauseStartTime = null;
    }

    this.state = REPLAY_STATE.PLAYING;

    this.emit('replay-resumed', {
      actionIndex: this.currentActionIndex,
      stats: { ...this.progress }
    });

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('replay-resumed', {
        actionIndex: this.currentActionIndex
      });
    }

    console.log('[ReplayEngine] Replay resumed');

    // Continue execution
    if (!this.stepMode) {
      this.executeNextAction();
    }

    return {
      success: true,
      state: this.state,
      currentIndex: this.currentActionIndex
    };
  }

  /**
   * Stop replay
   * @returns {Object}
   */
  stopReplay() {
    if (this.state === REPLAY_STATE.IDLE || this.state === REPLAY_STATE.STOPPED) {
      return {
        success: false,
        error: 'No replay in progress'
      };
    }

    // Clear any pending timers
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.pendingResponse) {
      this.pendingResponse = null;
    }

    const duration = Date.now() - this.replayStartTime - this.totalPausedDuration;
    const previousState = this.state;
    this.state = REPLAY_STATE.STOPPED;

    const stopData = {
      recordingId: this.currentRecording?.id,
      stoppedAt: this.currentActionIndex,
      duration,
      stats: { ...this.progress },
      previousState
    };

    this.emit('replay-stopped', stopData);

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('replay-stopped', stopData);
    }

    console.log(`[ReplayEngine] Replay stopped at action ${this.currentActionIndex}`);

    return {
      success: true,
      ...stopData
    };
  }

  /**
   * Step to next action (in step mode)
   * @returns {Object}
   */
  stepNext() {
    if (!this.stepMode) {
      return {
        success: false,
        error: 'Step mode not enabled'
      };
    }

    if (this.state !== REPLAY_STATE.PLAYING && this.state !== REPLAY_STATE.PAUSED) {
      return {
        success: false,
        error: `Cannot step: current state is ${this.state}`
      };
    }

    if (this.state === REPLAY_STATE.PAUSED) {
      if (this.pauseStartTime) {
        this.totalPausedDuration += Date.now() - this.pauseStartTime;
        this.pauseStartTime = null;
      }
      this.state = REPLAY_STATE.PLAYING;
    }

    this.executeNextAction();

    return {
      success: true,
      currentIndex: this.currentActionIndex,
      state: this.state
    };
  }

  /**
   * Skip current action
   * @returns {Object}
   */
  skipAction() {
    if (this.state !== REPLAY_STATE.PLAYING && this.state !== REPLAY_STATE.PAUSED) {
      return {
        success: false,
        error: `Cannot skip: current state is ${this.state}`
      };
    }

    this.progress.skipped++;
    this.currentActionIndex++;

    const skipped = this.currentActionIndex - 1;

    if (!this.stepMode && this.state === REPLAY_STATE.PLAYING) {
      this.executeNextAction();
    }

    return {
      success: true,
      skippedIndex: skipped,
      currentIndex: this.currentActionIndex
    };
  }

  /**
   * Set replay speed
   * @param {number} speed
   * @returns {Object}
   */
  setSpeed(speed) {
    if (speed <= 0 || speed > 10) {
      return {
        success: false,
        error: 'Speed must be between 0 and 10'
      };
    }

    this.speed = speed;

    return {
      success: true,
      speed: this.speed
    };
  }

  /**
   * Set error handling mode
   * @param {string} mode
   * @returns {Object}
   */
  setErrorMode(mode) {
    if (!Object.values(ERROR_MODE).includes(mode)) {
      return {
        success: false,
        error: `Invalid error mode. Valid modes: ${Object.values(ERROR_MODE).join(', ')}`
      };
    }

    this.errorMode = mode;

    return {
      success: true,
      errorMode: this.errorMode
    };
  }

  /**
   * Set variables for parameterization
   * @param {Object} variables
   * @returns {Object}
   */
  setVariables(variables) {
    this.variables = { ...this.variables, ...variables };

    return {
      success: true,
      variables: this.variables
    };
  }

  /**
   * Get current replay status
   * @returns {Object}
   */
  getStatus() {
    const status = {
      state: this.state,
      recording: null,
      currentIndex: this.currentActionIndex,
      progress: { ...this.progress },
      speed: this.speed,
      errorMode: this.errorMode,
      stepMode: this.stepMode,
      elapsed: 0
    };

    if (this.currentRecording) {
      status.recording = {
        id: this.currentRecording.id,
        name: this.currentRecording.name,
        totalActions: this.currentRecording.actions?.length || 0
      };
    }

    if (this.replayStartTime) {
      status.elapsed = Date.now() - this.replayStartTime - this.totalPausedDuration;
    }

    if (this.state === REPLAY_STATE.PAUSED && this.pauseStartTime) {
      status.pausedFor = Date.now() - this.pauseStartTime;
    }

    return status;
  }

  /**
   * Get replay results
   * @returns {Object}
   */
  getResults() {
    return {
      success: true,
      results: this.results,
      stats: { ...this.progress }
    };
  }

  /**
   * Sleep utility
   * @param {number} ms
   */
  sleep(ms) {
    return new Promise(resolve => {
      this.actionTimer = setTimeout(resolve, ms);
    });
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.state === REPLAY_STATE.PLAYING) {
      this.stopReplay();
    }

    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
    }

    this.removeAllListeners();
    console.log('[ReplayEngine] Cleanup complete');
  }
}

module.exports = {
  ReplayEngine,
  REPLAY_STATE,
  ERROR_MODE
};
