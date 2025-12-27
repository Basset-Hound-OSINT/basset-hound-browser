/**
 * Basset Hound Browser - Session Recording Manager
 * Records user actions for replay and automation script generation
 */

const { v4: uuidv4 } = require('uuid');
const { ipcMain } = require('electron');
const { Action, ACTION_TYPES, ActionSerializer } = require('./action');
const RecordingStorage = require('./storage');

/**
 * Recording state enum
 */
const RECORDING_STATE = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PAUSED: 'paused'
};

/**
 * Session Recording class representing a complete recording session
 */
class SessionRecording {
  /**
   * Create a new SessionRecording
   * @param {Object} options
   */
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.name = options.name || `Recording ${new Date().toISOString()}`;
    this.description = options.description || '';
    this.startUrl = options.startUrl || '';
    this.actions = options.actions || [];
    this.variables = options.variables || {};
    this.metadata = options.metadata || {};
    this.createdAt = options.createdAt ? new Date(options.createdAt) : new Date();
    this.updatedAt = options.updatedAt ? new Date(options.updatedAt) : new Date();
    this.duration = options.duration || 0;
    this.screenshots = options.screenshots || [];
    this.tags = options.tags || [];
  }

  /**
   * Add an action to the recording
   * @param {Action} action
   */
  addAction(action) {
    this.actions.push(action);
    this.updatedAt = new Date();
  }

  /**
   * Add a screenshot reference
   * @param {Object} screenshot
   */
  addScreenshot(screenshot) {
    this.screenshots.push(screenshot);
  }

  /**
   * Serialize to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      startUrl: this.startUrl,
      actions: this.actions.map(a => a.toJSON ? a.toJSON() : a),
      variables: this.variables,
      metadata: this.metadata,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      duration: this.duration,
      screenshots: this.screenshots,
      tags: this.tags,
      actionCount: this.actions.length
    };
  }

  /**
   * Create from plain object
   * @param {Object} data
   * @returns {SessionRecording}
   */
  static fromJSON(data) {
    const recording = new SessionRecording({
      ...data,
      actions: (data.actions || []).map(a => Action.fromJSON(a))
    });
    return recording;
  }
}

/**
 * SessionRecordingManager - Manages recording of user actions
 */
class SessionRecordingManager {
  /**
   * Create a new SessionRecordingManager
   * @param {Object} options
   */
  constructor(options = {}) {
    this.mainWindow = options.mainWindow || null;
    this.state = RECORDING_STATE.IDLE;
    this.currentRecording = null;
    this.recordingStartTime = null;
    this.lastActionTime = null;
    this.pauseStartTime = null;
    this.totalPausedDuration = 0;

    // Storage for persisting recordings
    this.storage = new RecordingStorage(options.storagePath);

    // In-memory cache of recordings
    this.recordings = new Map();

    // Recording options
    this.options = {
      captureScreenshots: options.captureScreenshots || false,
      screenshotOnNavigation: options.screenshotOnNavigation || false,
      screenshotOnClick: options.screenshotOnClick || false,
      captureScrolls: options.captureScrolls !== false,
      captureKeyPresses: options.captureKeyPresses !== false,
      minScrollDistance: options.minScrollDistance || 100,
      mergeConsecutiveTypes: options.mergeConsecutiveTypes !== false
    };

    // Pending type action for merging
    this.pendingTypeAction = null;
    this.typeDebounceTimer = null;
    this.typeDebounceDelay = 500;

    // Load existing recordings
    this.loadRecordings();

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
   * Load recordings from storage
   */
  async loadRecordings() {
    try {
      const recordingsData = await this.storage.loadAll();
      for (const data of recordingsData) {
        const recording = SessionRecording.fromJSON(data);
        this.recordings.set(recording.id, recording);
      }
      console.log(`[SessionRecordingManager] Loaded ${this.recordings.size} recordings`);
    } catch (error) {
      console.error('[SessionRecordingManager] Error loading recordings:', error);
    }
  }

  /**
   * Setup IPC handlers for receiving actions from renderer
   */
  setupIPCHandlers() {
    // Receive click events
    ipcMain.on('recording-click', (event, data) => {
      if (this.state === RECORDING_STATE.RECORDING) {
        this.recordClick(data);
      }
    });

    // Receive type events
    ipcMain.on('recording-type', (event, data) => {
      if (this.state === RECORDING_STATE.RECORDING) {
        this.recordType(data);
      }
    });

    // Receive scroll events
    ipcMain.on('recording-scroll', (event, data) => {
      if (this.state === RECORDING_STATE.RECORDING && this.options.captureScrolls) {
        this.recordScroll(data);
      }
    });

    // Receive navigation events
    ipcMain.on('recording-navigate', (event, data) => {
      if (this.state === RECORDING_STATE.RECORDING) {
        this.recordNavigate(data);
      }
    });

    // Receive key press events
    ipcMain.on('recording-keypress', (event, data) => {
      if (this.state === RECORDING_STATE.RECORDING && this.options.captureKeyPresses) {
        this.recordKeyPress(data);
      }
    });

    // Receive page state updates
    ipcMain.on('recording-page-state', (event, data) => {
      if (this.state === RECORDING_STATE.RECORDING && this.currentRecording) {
        this.currentRecording.metadata.lastPageState = data;
      }
    });
  }

  /**
   * Start a new recording session
   * @param {Object} options
   * @returns {Object}
   */
  startRecording(options = {}) {
    if (this.state !== RECORDING_STATE.IDLE) {
      return {
        success: false,
        error: `Cannot start recording: current state is ${this.state}`
      };
    }

    this.currentRecording = new SessionRecording({
      name: options.name || `Recording ${new Date().toLocaleString()}`,
      description: options.description || '',
      startUrl: options.startUrl || '',
      variables: options.variables || {},
      tags: options.tags || [],
      metadata: {
        userAgent: options.userAgent || '',
        viewport: options.viewport || {},
        startedAt: new Date().toISOString()
      }
    });

    this.recordingStartTime = Date.now();
    this.lastActionTime = this.recordingStartTime;
    this.totalPausedDuration = 0;
    this.state = RECORDING_STATE.RECORDING;

    // Notify renderer to start capturing events
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('start-action-recording', {
        recordingId: this.currentRecording.id,
        options: this.options
      });
    }

    console.log(`[SessionRecordingManager] Started recording: ${this.currentRecording.name}`);

    return {
      success: true,
      recording: {
        id: this.currentRecording.id,
        name: this.currentRecording.name,
        startUrl: this.currentRecording.startUrl
      }
    };
  }

  /**
   * Stop the current recording
   * @param {Object} options
   * @returns {Object}
   */
  async stopRecording(options = {}) {
    if (this.state === RECORDING_STATE.IDLE) {
      return {
        success: false,
        error: 'No recording in progress'
      };
    }

    // Flush any pending type action
    this.flushPendingTypeAction();

    // Calculate duration
    const endTime = Date.now();
    const duration = endTime - this.recordingStartTime - this.totalPausedDuration;
    this.currentRecording.duration = duration;
    this.currentRecording.metadata.endedAt = new Date().toISOString();

    // Apply name if provided
    if (options.name) {
      this.currentRecording.name = options.name;
    }

    // Save the recording
    const recording = this.currentRecording;
    this.recordings.set(recording.id, recording);

    try {
      await this.storage.save(recording.toJSON());
    } catch (error) {
      console.error('[SessionRecordingManager] Error saving recording:', error);
    }

    // Notify renderer to stop capturing
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('stop-action-recording');
    }

    // Reset state
    this.state = RECORDING_STATE.IDLE;
    this.currentRecording = null;
    this.recordingStartTime = null;
    this.lastActionTime = null;

    console.log(`[SessionRecordingManager] Stopped recording: ${recording.name} (${recording.actions.length} actions, ${duration}ms)`);

    return {
      success: true,
      recording: recording.toJSON()
    };
  }

  /**
   * Pause the current recording
   * @returns {Object}
   */
  pauseRecording() {
    if (this.state !== RECORDING_STATE.RECORDING) {
      return {
        success: false,
        error: `Cannot pause: current state is ${this.state}`
      };
    }

    this.flushPendingTypeAction();
    this.pauseStartTime = Date.now();
    this.state = RECORDING_STATE.PAUSED;

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('pause-action-recording');
    }

    console.log('[SessionRecordingManager] Recording paused');

    return {
      success: true,
      state: this.state,
      recordingId: this.currentRecording?.id
    };
  }

  /**
   * Resume a paused recording
   * @returns {Object}
   */
  resumeRecording() {
    if (this.state !== RECORDING_STATE.PAUSED) {
      return {
        success: false,
        error: `Cannot resume: current state is ${this.state}`
      };
    }

    if (this.pauseStartTime) {
      this.totalPausedDuration += Date.now() - this.pauseStartTime;
      this.pauseStartTime = null;
    }

    this.state = RECORDING_STATE.RECORDING;

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('resume-action-recording');
    }

    console.log('[SessionRecordingManager] Recording resumed');

    return {
      success: true,
      state: this.state,
      recordingId: this.currentRecording?.id
    };
  }

  /**
   * Get current recording status
   * @returns {Object}
   */
  getRecordingStatus() {
    const status = {
      state: this.state,
      recording: null,
      duration: 0,
      actionCount: 0
    };

    if (this.currentRecording) {
      const elapsed = Date.now() - this.recordingStartTime - this.totalPausedDuration;
      status.recording = {
        id: this.currentRecording.id,
        name: this.currentRecording.name,
        startUrl: this.currentRecording.startUrl
      };
      status.duration = elapsed;
      status.actionCount = this.currentRecording.actions.length;

      if (this.state === RECORDING_STATE.PAUSED && this.pauseStartTime) {
        status.pausedFor = Date.now() - this.pauseStartTime;
      }
    }

    return status;
  }

  /**
   * Add timing information to action
   * @param {Action} action
   */
  addTimingInfo(action) {
    const now = Date.now();
    action.timeSinceStart = now - this.recordingStartTime - this.totalPausedDuration;
    action.timeSincePrevious = now - this.lastActionTime;
    this.lastActionTime = now;
  }

  /**
   * Record a click action
   * @param {Object} data
   */
  recordClick(data) {
    this.flushPendingTypeAction();

    const action = Action.click(data.selector, {
      x: data.x,
      y: data.y,
      button: data.button,
      clickCount: data.clickCount,
      pageUrl: data.pageUrl,
      pageTitle: data.pageTitle
    });

    this.addTimingInfo(action);
    this.currentRecording.addAction(action);

    // Capture screenshot if enabled
    if (this.options.screenshotOnClick) {
      this.captureScreenshot(`click-${action.id}`);
    }
  }

  /**
   * Record a type action
   * @param {Object} data
   */
  recordType(data) {
    if (this.options.mergeConsecutiveTypes && this.pendingTypeAction) {
      // Check if same selector, merge text
      if (this.pendingTypeAction.data.selector === data.selector) {
        this.pendingTypeAction.data.text += data.text;
        this.resetTypeDebounce();
        return;
      } else {
        // Different selector, flush pending and start new
        this.flushPendingTypeAction();
      }
    }

    const action = Action.type(data.selector, data.text, {
      clearFirst: data.clearFirst,
      pageUrl: data.pageUrl,
      pageTitle: data.pageTitle
    });

    this.addTimingInfo(action);

    if (this.options.mergeConsecutiveTypes) {
      this.pendingTypeAction = action;
      this.resetTypeDebounce();
    } else {
      this.currentRecording.addAction(action);
    }
  }

  /**
   * Reset type debounce timer
   */
  resetTypeDebounce() {
    if (this.typeDebounceTimer) {
      clearTimeout(this.typeDebounceTimer);
    }
    this.typeDebounceTimer = setTimeout(() => {
      this.flushPendingTypeAction();
    }, this.typeDebounceDelay);
  }

  /**
   * Flush pending type action
   */
  flushPendingTypeAction() {
    if (this.typeDebounceTimer) {
      clearTimeout(this.typeDebounceTimer);
      this.typeDebounceTimer = null;
    }
    if (this.pendingTypeAction && this.currentRecording) {
      this.currentRecording.addAction(this.pendingTypeAction);
      this.pendingTypeAction = null;
    }
  }

  /**
   * Record a scroll action
   * @param {Object} data
   */
  recordScroll(data) {
    // Skip small scrolls
    const scrollDistance = Math.abs(data.deltaY || 0) + Math.abs(data.deltaX || 0);
    if (scrollDistance < this.options.minScrollDistance) {
      return;
    }

    this.flushPendingTypeAction();

    const action = Action.scroll({
      x: data.scrollX,
      y: data.scrollY,
      selector: data.selector
    }, {
      pageUrl: data.pageUrl,
      pageTitle: data.pageTitle
    });

    this.addTimingInfo(action);
    this.currentRecording.addAction(action);
  }

  /**
   * Record a navigation action
   * @param {Object} data
   */
  recordNavigate(data) {
    this.flushPendingTypeAction();

    const action = Action.navigate(data.url, {
      pageUrl: data.pageUrl,
      pageTitle: data.pageTitle
    });

    this.addTimingInfo(action);
    this.currentRecording.addAction(action);

    // Update start URL if this is the first action
    if (this.currentRecording.actions.length === 1) {
      this.currentRecording.startUrl = data.url;
    }

    // Capture screenshot if enabled
    if (this.options.screenshotOnNavigation) {
      this.captureScreenshot(`nav-${action.id}`);
    }
  }

  /**
   * Record a key press action
   * @param {Object} data
   */
  recordKeyPress(data) {
    // Don't record regular character keys (handled by type)
    if (data.key.length === 1 && !data.modifiers?.ctrl && !data.modifiers?.alt && !data.modifiers?.meta) {
      return;
    }

    this.flushPendingTypeAction();

    const action = Action.keyPress(data.key, {
      modifiers: data.modifiers,
      pageUrl: data.pageUrl,
      pageTitle: data.pageTitle
    });

    this.addTimingInfo(action);
    this.currentRecording.addAction(action);
  }

  /**
   * Add a manual action to the recording
   * @param {Object} actionData
   * @returns {Object}
   */
  addAction(actionData) {
    if (this.state !== RECORDING_STATE.RECORDING) {
      return {
        success: false,
        error: 'Not currently recording'
      };
    }

    const action = new Action(actionData);
    this.addTimingInfo(action);
    this.currentRecording.addAction(action);

    return {
      success: true,
      action: action.toJSON()
    };
  }

  /**
   * Add a wait action
   * @param {Object} waitData
   * @returns {Object}
   */
  addWait(waitData) {
    if (this.state !== RECORDING_STATE.RECORDING) {
      return {
        success: false,
        error: 'Not currently recording'
      };
    }

    this.flushPendingTypeAction();

    const action = Action.wait(waitData);
    this.addTimingInfo(action);
    this.currentRecording.addAction(action);

    return {
      success: true,
      action: action.toJSON()
    };
  }

  /**
   * Add a screenshot action
   * @param {Object} screenshotData
   * @returns {Object}
   */
  addScreenshotAction(screenshotData) {
    if (this.state !== RECORDING_STATE.RECORDING) {
      return {
        success: false,
        error: 'Not currently recording'
      };
    }

    this.flushPendingTypeAction();

    const action = Action.screenshot(screenshotData);
    this.addTimingInfo(action);
    this.currentRecording.addAction(action);

    return {
      success: true,
      action: action.toJSON()
    };
  }

  /**
   * Add a comment action
   * @param {string} comment
   * @returns {Object}
   */
  addComment(comment) {
    if (this.state !== RECORDING_STATE.RECORDING) {
      return {
        success: false,
        error: 'Not currently recording'
      };
    }

    const action = Action.comment(comment);
    this.addTimingInfo(action);
    this.currentRecording.addAction(action);

    return {
      success: true,
      action: action.toJSON()
    };
  }

  /**
   * Capture a screenshot (placeholder - uses existing screenshot manager)
   * @param {string} name
   */
  async captureScreenshot(name) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    try {
      const screenshot = await this.mainWindow.webContents.capturePage();
      const data = screenshot.toDataURL();

      this.currentRecording.addScreenshot({
        name,
        timestamp: Date.now(),
        data: data.substring(0, 100) + '...' // Don't store full data in memory
      });
    } catch (error) {
      console.error('[SessionRecordingManager] Screenshot capture error:', error);
    }
  }

  /**
   * List all recordings
   * @param {Object} options
   * @returns {Object}
   */
  listRecordings(options = {}) {
    let recordings = Array.from(this.recordings.values());

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      recordings = recordings.filter(r =>
        options.tags.some(tag => r.tags.includes(tag))
      );
    }

    // Filter by search query
    if (options.search) {
      const query = options.search.toLowerCase();
      recordings = recordings.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query)
      );
    }

    // Sort
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    recordings.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'createdAt') {
        comparison = new Date(a.createdAt) - new Date(b.createdAt);
      } else if (sortBy === 'duration') {
        comparison = a.duration - b.duration;
      } else if (sortBy === 'actionCount') {
        comparison = a.actions.length - b.actions.length;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    const total = recordings.length;
    recordings = recordings.slice(offset, offset + limit);

    return {
      success: true,
      recordings: recordings.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        startUrl: r.startUrl,
        actionCount: r.actions.length,
        duration: r.duration,
        createdAt: r.createdAt.toISOString(),
        tags: r.tags
      })),
      total,
      offset,
      limit
    };
  }

  /**
   * Get a recording by ID
   * @param {string} id
   * @returns {Object}
   */
  getRecording(id) {
    const recording = this.recordings.get(id);
    if (!recording) {
      return {
        success: false,
        error: 'Recording not found'
      };
    }

    return {
      success: true,
      recording: recording.toJSON()
    };
  }

  /**
   * Load a recording (alias for getRecording)
   * @param {string} id
   * @returns {Object}
   */
  loadRecording(id) {
    return this.getRecording(id);
  }

  /**
   * Delete a recording
   * @param {string} id
   * @returns {Object}
   */
  async deleteRecording(id) {
    const recording = this.recordings.get(id);
    if (!recording) {
      return {
        success: false,
        error: 'Recording not found'
      };
    }

    this.recordings.delete(id);

    try {
      await this.storage.delete(id);
    } catch (error) {
      console.error('[SessionRecordingManager] Error deleting recording:', error);
    }

    return {
      success: true,
      deletedId: id
    };
  }

  /**
   * Update a recording
   * @param {string} id
   * @param {Object} updates
   * @returns {Object}
   */
  async updateRecording(id, updates) {
    const recording = this.recordings.get(id);
    if (!recording) {
      return {
        success: false,
        error: 'Recording not found'
      };
    }

    // Apply allowed updates
    if (updates.name !== undefined) recording.name = updates.name;
    if (updates.description !== undefined) recording.description = updates.description;
    if (updates.tags !== undefined) recording.tags = updates.tags;
    if (updates.variables !== undefined) recording.variables = updates.variables;

    recording.updatedAt = new Date();

    try {
      await this.storage.save(recording.toJSON());
    } catch (error) {
      console.error('[SessionRecordingManager] Error saving recording:', error);
    }

    return {
      success: true,
      recording: recording.toJSON()
    };
  }

  /**
   * Export a recording
   * @param {string} id
   * @param {string} format - 'json', 'python', 'javascript', 'playwright'
   * @returns {Object}
   */
  exportRecording(id, format = 'json') {
    const recording = this.recordings.get(id);
    if (!recording) {
      return {
        success: false,
        error: 'Recording not found'
      };
    }

    let exportData;
    let mimeType;
    let filename;

    switch (format.toLowerCase()) {
      case 'python':
      case 'selenium':
        exportData = ActionSerializer.toPythonSelenium(recording.actions);
        mimeType = 'text/x-python';
        filename = `${recording.name.replace(/[^a-z0-9]/gi, '_')}.py`;
        break;

      case 'javascript':
      case 'puppeteer':
        exportData = ActionSerializer.toJavaScriptPuppeteer(recording.actions);
        mimeType = 'text/javascript';
        filename = `${recording.name.replace(/[^a-z0-9]/gi, '_')}_puppeteer.js`;
        break;

      case 'playwright':
        exportData = ActionSerializer.toPlaywright(recording.actions);
        mimeType = 'text/javascript';
        filename = `${recording.name.replace(/[^a-z0-9]/gi, '_')}_playwright.js`;
        break;

      case 'json':
      default:
        exportData = JSON.stringify(recording.toJSON(), null, 2);
        mimeType = 'application/json';
        filename = `${recording.name.replace(/[^a-z0-9]/gi, '_')}.json`;
        break;
    }

    return {
      success: true,
      format,
      data: exportData,
      mimeType,
      filename,
      recordingId: id,
      recordingName: recording.name
    };
  }

  /**
   * Import a recording
   * @param {Object} data
   * @returns {Object}
   */
  async importRecording(data) {
    try {
      let recordingData;

      if (typeof data === 'string') {
        recordingData = JSON.parse(data);
      } else {
        recordingData = data;
      }

      // Generate new ID if importing existing
      if (this.recordings.has(recordingData.id)) {
        recordingData.id = uuidv4();
      }

      const recording = SessionRecording.fromJSON(recordingData);
      recording.createdAt = new Date();
      recording.updatedAt = new Date();

      this.recordings.set(recording.id, recording);
      await this.storage.save(recording.toJSON());

      return {
        success: true,
        recording: recording.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: `Import failed: ${error.message}`
      };
    }
  }

  /**
   * Duplicate a recording
   * @param {string} id
   * @param {Object} options
   * @returns {Object}
   */
  async duplicateRecording(id, options = {}) {
    const original = this.recordings.get(id);
    if (!original) {
      return {
        success: false,
        error: 'Recording not found'
      };
    }

    const duplicate = SessionRecording.fromJSON(original.toJSON());
    duplicate.id = uuidv4();
    duplicate.name = options.name || `${original.name} (Copy)`;
    duplicate.createdAt = new Date();
    duplicate.updatedAt = new Date();

    this.recordings.set(duplicate.id, duplicate);

    try {
      await this.storage.save(duplicate.toJSON());
    } catch (error) {
      console.error('[SessionRecordingManager] Error saving duplicate:', error);
    }

    return {
      success: true,
      recording: duplicate.toJSON()
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.typeDebounceTimer) {
      clearTimeout(this.typeDebounceTimer);
    }

    if (this.state === RECORDING_STATE.RECORDING) {
      this.stopRecording();
    }

    this.recordings.clear();
    console.log('[SessionRecordingManager] Cleanup complete');
  }
}

module.exports = {
  SessionRecordingManager,
  SessionRecording,
  RECORDING_STATE
};
