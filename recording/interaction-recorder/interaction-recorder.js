/**
 * Basset Hound Browser - Interaction Recorder (core class)
 *
 * Extracted verbatim from recording/interaction-recorder.js
 * (modularization 2026-07-04). Holds the InteractionRecorder class and the
 * module-level convenience wrappers. Script code-generation lives in
 * ./script-exporters; data models in ./models; constants in ./constants.
 */

const { EventEmitter } = require('events');
const { uuidv4 } = require('./uuid');
const {
  INTERACTION_TYPES,
  RECORDING_STATE,
  SENSITIVE_PATTERNS
} = require('./constants');
const {
  InteractionEvent,
  RecordingCheckpoint,
  InteractionRecording
} = require('./models');
const {
  buildSelenium,
  buildPuppeteer,
  buildPlaywright
} = require('./script-exporters');

/**
 * Interaction Recorder
 */
class InteractionRecorder extends EventEmitter {
  constructor(options = {}) {
    super();

    this.state = RECORDING_STATE.IDLE;
    this.currentRecording = null;
    this.startTime = null;
    this.pauseTime = null;
    this.totalPauseDuration = 0;
    this.lastEventTime = null;

    // Recording options
    this.options = {
      recordMouseMovements: options.recordMouseMovements !== false,
      mouseMoveThrottle: options.mouseMoveThrottle || 100, // ms
      recordScrolls: options.recordScrolls !== false,
      scrollThrottle: options.scrollThrottle || 100, // ms
      recordKeyboard: options.recordKeyboard !== false,
      maskSensitiveData: options.maskSensitiveData !== false,
      recordElementContext: options.recordElementContext !== false,
      captureScreenshots: options.captureScreenshots || false,
      screenshotOnCheckpoint: options.screenshotOnCheckpoint !== false,
      maxEvents: options.maxEvents || 10000,
      autoCheckpointInterval: options.autoCheckpointInterval || 0, // 0 = disabled
      ...options
    };

    // Throttling
    this.mouseMoveBuffer = [];
    this.mouseMoveTimer = null;
    this.scrollBuffer = [];
    this.scrollTimer = null;

    // Auto checkpoint
    this.autoCheckpointTimer = null;

    // Element cache for context tracking
    this.elementCache = new Map();
  }

  /**
   * Start recording
   */
  startRecording(options = {}) {
    if (this.state !== RECORDING_STATE.IDLE && this.state !== RECORDING_STATE.STOPPED) {
      throw new Error(`Cannot start recording: current state is ${this.state}`);
    }

    this.currentRecording = new InteractionRecording({
      name: options.name || `Recording ${new Date().toLocaleString()}`,
      description: options.description || '',
      startUrl: options.startUrl || '',
      options: { ...this.options, ...options },
      metadata: options.metadata || {},
      tags: options.tags || []
    });

    this.startTime = Date.now();
    this.lastEventTime = this.startTime;
    this.totalPauseDuration = 0;
    this.state = RECORDING_STATE.RECORDING;

    // Start auto checkpoint timer if enabled
    if (this.options.autoCheckpointInterval > 0) {
      this.startAutoCheckpoint();
    }

    this.emit('recordingStarted', {
      id: this.currentRecording.id,
      name: this.currentRecording.name,
      startTime: this.startTime
    });

    return {
      success: true,
      recording: {
        id: this.currentRecording.id,
        name: this.currentRecording.name,
        startTime: this.startTime
      }
    };
  }

  /**
   * Stop recording
   */
  stopRecording() {
    if (this.state !== RECORDING_STATE.RECORDING && this.state !== RECORDING_STATE.PAUSED) {
      throw new Error(`Cannot stop recording: current state is ${this.state}`);
    }

    // Flush buffered events
    this.flushMouseMoveBuffer();
    this.flushScrollBuffer();

    // Stop auto checkpoint
    this.stopAutoCheckpoint();

    // Finalize recording
    this.currentRecording.endTime = Date.now();
    this.currentRecording.duration = this.currentRecording.endTime - this.startTime - this.totalPauseDuration;

    // Calculate hash for integrity
    this.currentRecording.calculateHash();

    const recording = this.currentRecording;
    this.state = RECORDING_STATE.STOPPED;

    this.emit('recordingStopped', {
      id: recording.id,
      duration: recording.duration,
      eventCount: recording.events.length,
      stats: recording.stats
    });

    return {
      success: true,
      recording: recording.toJSON()
    };
  }

  /**
   * Pause recording
   */
  pauseRecording() {
    if (this.state !== RECORDING_STATE.RECORDING) {
      throw new Error(`Cannot pause recording: current state is ${this.state}`);
    }

    this.flushMouseMoveBuffer();
    this.flushScrollBuffer();
    this.stopAutoCheckpoint();

    this.pauseTime = Date.now();
    this.state = RECORDING_STATE.PAUSED;

    this.emit('recordingPaused', {
      id: this.currentRecording.id,
      pauseTime: this.pauseTime
    });

    return {
      success: true,
      state: this.state
    };
  }

  /**
   * Resume recording
   */
  resumeRecording() {
    if (this.state !== RECORDING_STATE.PAUSED) {
      throw new Error(`Cannot resume recording: current state is ${this.state}`);
    }

    if (this.pauseTime) {
      this.totalPauseDuration += Date.now() - this.pauseTime;
      this.pauseTime = null;
    }

    this.state = RECORDING_STATE.RECORDING;

    if (this.options.autoCheckpointInterval > 0) {
      this.startAutoCheckpoint();
    }

    this.emit('recordingResumed', {
      id: this.currentRecording.id,
      totalPauseDuration: this.totalPauseDuration
    });

    return {
      success: true,
      state: this.state
    };
  }

  /**
   * Record mouse movement
   */
  recordMouseMove(data) {
    if (this.state !== RECORDING_STATE.RECORDING || !this.options.recordMouseMovements) {
      return;
    }

    this.mouseMoveBuffer.push(data);

    if (this.mouseMoveTimer) {
      clearTimeout(this.mouseMoveTimer);
    }

    this.mouseMoveTimer = setTimeout(() => {
      this.flushMouseMoveBuffer();
    }, this.options.mouseMoveThrottle);
  }

  /**
   * Flush mouse movement buffer
   */
  flushMouseMoveBuffer() {
    if (this.mouseMoveBuffer.length === 0) return;

    // Take last position (most recent)
    const data = this.mouseMoveBuffer[this.mouseMoveBuffer.length - 1];
    this.mouseMoveBuffer = [];

    if (this.mouseMoveTimer) {
      clearTimeout(this.mouseMoveTimer);
      this.mouseMoveTimer = null;
    }

    const event = this.createEvent(INTERACTION_TYPES.MOUSE_MOVE, {
      x: data.x,
      y: data.y,
      clientX: data.clientX,
      clientY: data.clientY,
      pageX: data.pageX,
      pageY: data.pageY,
      screenX: data.screenX,
      screenY: data.screenY
    }, data);

    this.addEvent(event);
  }

  /**
   * Record mouse click
   */
  recordClick(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    this.flushMouseMoveBuffer();

    const event = this.createEvent(INTERACTION_TYPES.MOUSE_CLICK, {
      x: data.x,
      y: data.y,
      clientX: data.clientX,
      clientY: data.clientY,
      button: data.button || 'left',
      buttons: data.buttons,
      detail: data.detail || 1,
      ctrlKey: data.ctrlKey || false,
      shiftKey: data.shiftKey || false,
      altKey: data.altKey || false,
      metaKey: data.metaKey || false
    }, data);

    this.addEvent(event);
  }

  /**
   * Record mouse down
   */
  recordMouseDown(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const event = this.createEvent(INTERACTION_TYPES.MOUSE_DOWN, {
      x: data.x,
      y: data.y,
      button: data.button || 'left',
      buttons: data.buttons
    }, data);

    this.addEvent(event);
  }

  /**
   * Record mouse up
   */
  recordMouseUp(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const event = this.createEvent(INTERACTION_TYPES.MOUSE_UP, {
      x: data.x,
      y: data.y,
      button: data.button || 'left',
      buttons: data.buttons
    }, data);

    this.addEvent(event);
  }

  /**
   * Record mouse wheel
   */
  recordWheel(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const event = this.createEvent(INTERACTION_TYPES.MOUSE_WHEEL, {
      deltaX: data.deltaX,
      deltaY: data.deltaY,
      deltaZ: data.deltaZ,
      deltaMode: data.deltaMode
    }, data);

    this.addEvent(event);
  }

  /**
   * Record key down
   */
  recordKeyDown(data) {
    if (this.state !== RECORDING_STATE.RECORDING || !this.options.recordKeyboard) return;

    const masked = this.shouldMaskInput(data);
    const event = this.createEvent(INTERACTION_TYPES.KEY_DOWN, {
      key: masked ? '***' : data.key,
      code: data.code,
      keyCode: data.keyCode,
      ctrlKey: data.ctrlKey || false,
      shiftKey: data.shiftKey || false,
      altKey: data.altKey || false,
      metaKey: data.metaKey || false,
      repeat: data.repeat || false
    }, data);

    event.masked = masked;
    this.addEvent(event);
  }

  /**
   * Record key up
   */
  recordKeyUp(data) {
    if (this.state !== RECORDING_STATE.RECORDING || !this.options.recordKeyboard) return;

    const masked = this.shouldMaskInput(data);
    const event = this.createEvent(INTERACTION_TYPES.KEY_UP, {
      key: masked ? '***' : data.key,
      code: data.code,
      keyCode: data.keyCode
    }, data);

    event.masked = masked;
    this.addEvent(event);
  }

  /**
   * Record input
   */
  recordInput(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const masked = this.shouldMaskInput(data);
    const event = this.createEvent(INTERACTION_TYPES.INPUT, {
      value: masked ? '***' : data.value,
      inputType: data.inputType,
      data: masked ? '***' : data.data
    }, data);

    event.masked = masked;
    this.addEvent(event);
  }

  /**
   * Record change
   */
  recordChange(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const masked = this.shouldMaskInput(data);
    const event = this.createEvent(INTERACTION_TYPES.CHANGE, {
      value: masked ? '***' : data.value,
      checked: data.checked
    }, data);

    event.masked = masked;
    this.addEvent(event);
  }

  /**
   * Record focus
   */
  recordFocus(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const event = this.createEvent(INTERACTION_TYPES.FOCUS, {}, data);
    this.addEvent(event);
  }

  /**
   * Record blur
   */
  recordBlur(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const event = this.createEvent(INTERACTION_TYPES.BLUR, {}, data);
    this.addEvent(event);
  }

  /**
   * Record scroll
   */
  recordScroll(data) {
    if (this.state !== RECORDING_STATE.RECORDING || !this.options.recordScrolls) return;

    this.scrollBuffer.push(data);

    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }

    this.scrollTimer = setTimeout(() => {
      this.flushScrollBuffer();
    }, this.options.scrollThrottle);
  }

  /**
   * Flush scroll buffer
   */
  flushScrollBuffer() {
    if (this.scrollBuffer.length === 0) return;

    // Take last position (most recent)
    const data = this.scrollBuffer[this.scrollBuffer.length - 1];
    this.scrollBuffer = [];

    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }

    const event = this.createEvent(INTERACTION_TYPES.SCROLL, {
      scrollX: data.scrollX,
      scrollY: data.scrollY,
      scrollLeft: data.scrollLeft,
      scrollTop: data.scrollTop,
      scrollWidth: data.scrollWidth,
      scrollHeight: data.scrollHeight
    }, data);

    this.addEvent(event);
  }

  /**
   * Record hover
   */
  recordHover(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const event = this.createEvent(INTERACTION_TYPES.HOVER, {
      x: data.x,
      y: data.y
    }, data);

    this.addEvent(event);
  }

  /**
   * Record select
   */
  recordSelect(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const event = this.createEvent(INTERACTION_TYPES.SELECT, {
      value: data.value,
      selectedIndex: data.selectedIndex,
      options: data.options
    }, data);

    this.addEvent(event);
  }

  /**
   * Record navigation
   */
  recordNavigation(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const event = this.createEvent(INTERACTION_TYPES.NAVIGATION, {
      url: data.url,
      type: data.type || 'navigate', // navigate, back, forward, reload
      referrer: data.referrer
    }, data);

    this.addEvent(event);

    // Update start URL if first navigation
    if (this.currentRecording.events.length === 1) {
      this.currentRecording.startUrl = data.url;
    }
  }

  /**
   * Record page load
   */
  recordLoad(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const event = this.createEvent(INTERACTION_TYPES.LOAD, {
      url: data.url,
      loadTime: data.loadTime,
      readyState: data.readyState
    }, data);

    this.addEvent(event);
  }

  /**
   * Record resize
   */
  recordResize(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const event = this.createEvent(INTERACTION_TYPES.RESIZE, {
      width: data.width,
      height: data.height,
      innerWidth: data.innerWidth,
      innerHeight: data.innerHeight,
      outerWidth: data.outerWidth,
      outerHeight: data.outerHeight
    }, data);

    this.addEvent(event);
  }

  /**
   * Record visibility change
   */
  recordVisibilityChange(data) {
    if (this.state !== RECORDING_STATE.RECORDING) return;

    const event = this.createEvent(INTERACTION_TYPES.VISIBILITY_CHANGE, {
      hidden: data.hidden,
      visibilityState: data.visibilityState
    }, data);

    this.addEvent(event);
  }

  /**
   * Create checkpoint
   */
  createCheckpoint(options = {}) {
    if (this.state !== RECORDING_STATE.RECORDING) {
      throw new Error('Cannot create checkpoint');
    }

    const relativeTime = this.getRelativeTime();
    const checkpoint = new RecordingCheckpoint({
      name: options.name || `Checkpoint ${this.currentRecording.checkpoints.length + 1}`,
      description: options.description || '',
      relativeTime: relativeTime,
      eventIndex: this.currentRecording.events.length,
      pageState: options.pageState || null,
      screenshot: options.screenshot || null
    });

    this.currentRecording.addCheckpoint(checkpoint);

    this.emit('checkpointCreated', checkpoint.toJSON());

    return {
      success: true,
      checkpoint: checkpoint.toJSON()
    };
  }

  /**
   * Add annotation
   */
  addAnnotation(annotation) {
    if (!this.currentRecording) {
      throw new Error('No active recording');
    }

    const relativeTime = this.state === RECORDING_STATE.RECORDING ?
      this.getRelativeTime() :
      (annotation.relativeTime || 0);

    const annotationData = {
      id: uuidv4(),
      type: 'annotation',
      timestamp: Date.now(),
      relativeTime: relativeTime,
      text: annotation.text || '',
      category: annotation.category || 'note',
      metadata: annotation.metadata || {}
    };

    this.currentRecording.addAnnotation(annotationData);

    this.emit('annotationAdded', annotationData);

    return {
      success: true,
      annotation: annotationData
    };
  }

  /**
   * Create event
   */
  createEvent(type, data, context = {}) {
    const now = Date.now();
    const relativeTime = this.getRelativeTime();
    const timeDelta = now - this.lastEventTime;
    this.lastEventTime = now;

    const event = new InteractionEvent({
      type: type,
      timestamp: now,
      relativeTime: relativeTime,
      timeDelta: timeDelta,
      data: data,
      element: this.extractElementContext(context),
      pageUrl: context.pageUrl || this.currentRecording?.startUrl || '',
      pageTitle: context.pageTitle || '',
      viewport: context.viewport || null,
      metadata: context.metadata || {}
    });

    return event;
  }

  /**
   * Add event to recording
   */
  addEvent(event) {
    if (this.currentRecording.events.length >= this.options.maxEvents) {
      this.emit('maxEventsReached', {
        maxEvents: this.options.maxEvents,
        currentEvents: this.currentRecording.events.length
      });
      return;
    }

    this.currentRecording.addEvent(event);
    this.emit('eventRecorded', event.toJSON());
  }

  /**
   * Get relative time from start
   */
  getRelativeTime() {
    return Date.now() - this.startTime - this.totalPauseDuration;
  }

  /**
   * Extract element context
   */
  extractElementContext(context) {
    if (!this.options.recordElementContext || !context.element) {
      return null;
    }

    return {
      tagName: context.element.tagName,
      id: context.element.id,
      className: context.element.className,
      name: context.element.name,
      type: context.element.type,
      value: context.element.value,
      href: context.element.href,
      src: context.element.src,
      text: context.element.textContent?.substring(0, 100),
      selector: context.element.selector,
      xpath: context.element.xpath,
      attributes: context.element.attributes
    };
  }

  /**
   * Check if input should be masked
   */
  shouldMaskInput(context) {
    if (!this.options.maskSensitiveData) return false;

    // Check element context
    if (context.element) {
      const elementName = (context.element.name || '').toLowerCase();
      const elementId = (context.element.id || '').toLowerCase();
      const elementType = (context.element.type || '').toLowerCase();
      const elementClass = (context.element.className || '').toLowerCase();

      for (const [key, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
        if (pattern.test(elementName) ||
            pattern.test(elementId) ||
            pattern.test(elementType) ||
            pattern.test(elementClass)) {
          return true;
        }
      }

      // Always mask password inputs
      if (elementType === 'password') {
        return true;
      }
    }

    return false;
  }

  /**
   * Start auto checkpoint timer
   */
  startAutoCheckpoint() {
    if (this.autoCheckpointTimer) return;

    this.autoCheckpointTimer = setInterval(() => {
      if (this.state === RECORDING_STATE.RECORDING) {
        try {
          this.createCheckpoint({
            name: `Auto Checkpoint ${this.currentRecording.checkpoints.length + 1}`,
            description: 'Automatic checkpoint'
          });
        } catch (error) {
          console.error('[InteractionRecorder] Auto checkpoint error:', error);
        }
      }
    }, this.options.autoCheckpointInterval);
  }

  /**
   * Stop auto checkpoint timer
   */
  stopAutoCheckpoint() {
    if (this.autoCheckpointTimer) {
      clearInterval(this.autoCheckpointTimer);
      this.autoCheckpointTimer = null;
    }
  }

  /**
   * Get recording status
   */
  getStatus() {
    return {
      state: this.state,
      recording: this.currentRecording ? {
        id: this.currentRecording.id,
        name: this.currentRecording.name,
        startTime: this.startTime,
        duration: this.state === RECORDING_STATE.RECORDING ? this.getRelativeTime() : this.currentRecording.duration,
        eventCount: this.currentRecording.events.length,
        checkpointCount: this.currentRecording.checkpoints.length,
        stats: this.currentRecording.stats
      } : null
    };
  }

  /**
   * Get timeline
   */
  getTimeline(options = {}) {
    if (!this.currentRecording) {
      throw new Error('No recording available');
    }

    let events = this.currentRecording.events;

    // Filter by time range
    if (options.startTime !== undefined && options.endTime !== undefined) {
      events = this.currentRecording.getEventsInRange(options.startTime, options.endTime);
    }

    // Filter by type
    if (options.type) {
      events = events.filter(e => e.type === options.type);
    }

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    const total = events.length;
    events = events.slice(offset, offset + limit);

    return {
      success: true,
      events: events.map(e => e.toJSON()),
      checkpoints: this.currentRecording.checkpoints.map(c => c.toJSON()),
      total: total,
      offset: offset,
      limit: limit,
      duration: this.currentRecording.duration,
      stats: this.currentRecording.stats
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    if (!this.currentRecording) {
      throw new Error('No recording available');
    }

    return {
      success: true,
      stats: {
        ...this.currentRecording.stats,
        duration: this.currentRecording.duration,
        eventsPerSecond: this.currentRecording.duration > 0 ?
          (this.currentRecording.stats.totalEvents / (this.currentRecording.duration / 1000)).toFixed(2) : 0,
        checkpointCount: this.currentRecording.checkpoints.length,
        annotationCount: this.currentRecording.annotations.length
      }
    };
  }

  /**
   * Export recording as JSON
   */
  exportAsJSON(options = {}) {
    if (!this.currentRecording) {
      throw new Error('No recording to export');
    }

    const data = this.currentRecording.toJSON();
    const json = JSON.stringify(data, null, options.pretty ? 2 : 0);

    return {
      success: true,
      format: 'json',
      data: json,
      size: Buffer.byteLength(json, 'utf8'),
      filename: `${this.currentRecording.name.replace(/[^a-z0-9]/gi, '_')}.json`
    };
  }

  /**
   * Export recording as Selenium script
   */
  exportAsSelenium(options = {}) {
    if (!this.currentRecording) {
      throw new Error('No recording to export');
    }

    const script = buildSelenium(this.currentRecording, options);

    return {
      success: true,
      format: 'selenium',
      data: script,
      size: Buffer.byteLength(script, 'utf8'),
      filename: `${this.currentRecording.name.replace(/[^a-z0-9]/gi, '_')}_selenium.py`
    };
  }

  /**
   * Export recording as Puppeteer script
   */
  exportAsPuppeteer(options = {}) {
    if (!this.currentRecording) {
      throw new Error('No recording to export');
    }

    const script = buildPuppeteer(this.currentRecording, options);

    return {
      success: true,
      format: 'puppeteer',
      data: script,
      size: Buffer.byteLength(script, 'utf8'),
      filename: `${this.currentRecording.name.replace(/[^a-z0-9]/gi, '_')}_puppeteer.js`
    };
  }

  /**
   * Export recording as Playwright script
   */
  exportAsPlaywright(options = {}) {
    if (!this.currentRecording) {
      throw new Error('No recording to export');
    }

    const script = buildPlaywright(this.currentRecording, options);

    return {
      success: true,
      format: 'playwright',
      data: script,
      size: Buffer.byteLength(script, 'utf8'),
      filename: `${this.currentRecording.name.replace(/[^a-z0-9]/gi, '_')}_playwright.js`
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.mouseMoveTimer) {
      clearTimeout(this.mouseMoveTimer);
      this.mouseMoveTimer = null;
    }
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }
    if (this.autoCheckpointTimer) {
      clearInterval(this.autoCheckpointTimer);
      this.autoCheckpointTimer = null;
    }

    this.mouseMoveBuffer = [];
    this.scrollBuffer = [];
    this.elementCache.clear();
  }
}

/**
 * Convenience wrapper functions for simple usage
 */
let defaultRecorder = null;

/**
 * Start recording with convenience function
 */
function record(options = {}) {
  if (!defaultRecorder) {
    defaultRecorder = new InteractionRecorder(options);
  }
  return defaultRecorder.startRecording(options);
}

/**
 * Stop recording with convenience function
 */
function stop() {
  if (!defaultRecorder) {
    throw new Error('No active recording');
  }
  const result = defaultRecorder.stopRecording();
  defaultRecorder = null;
  return result;
}

/**
 * Get current recording with convenience function
 */
function getRecording() {
  if (!defaultRecorder) {
    throw new Error('No active recording');
  }
  return {
    success: true,
    recording: defaultRecorder.currentRecording.toJSON()
  };
}

/**
 * Clear/reset the default recorder
 */
function clear() {
  if (defaultRecorder) {
    defaultRecorder.cleanup();
    defaultRecorder = null;
  }
  return { success: true };
}

module.exports = {
  InteractionRecorder,
  record,
  stop,
  getRecording,
  clear
};
