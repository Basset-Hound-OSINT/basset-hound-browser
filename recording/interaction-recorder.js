/**
 * Basset Hound Browser - Interaction Recorder
 *
 * Phase 20: Page Interaction Recording for Forensic Playback and Test Automation
 *
 * Records all user interactions on a page for:
 * - Forensic investigation and replay
 * - Test automation script generation
 * - User behavior analysis
 * - Compliance documentation
 *
 * Features:
 * - Mouse movement tracking with throttling
 * - Click recording with element context
 * - Keyboard input with sensitive data masking
 * - Scroll position tracking
 * - Element interaction detection (fill, select, hover)
 * - Page navigation tracking
 * - Timeline management with checkpoints
 * - Export to multiple formats (JSON, Selenium, Puppeteer, Playwright)
 * - Playback verification
 * - Annotation support
 */

const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');
const crypto = require('crypto');

/**
 * Interaction types
 */
const INTERACTION_TYPES = {
  MOUSE_MOVE: 'mouse_move',
  MOUSE_CLICK: 'mouse_click',
  MOUSE_DOWN: 'mouse_down',
  MOUSE_UP: 'mouse_up',
  MOUSE_WHEEL: 'mouse_wheel',
  KEY_DOWN: 'key_down',
  KEY_UP: 'key_up',
  KEY_PRESS: 'key_press',
  INPUT: 'input',
  CHANGE: 'change',
  FOCUS: 'focus',
  BLUR: 'blur',
  SCROLL: 'scroll',
  HOVER: 'hover',
  SELECT: 'select',
  NAVIGATION: 'navigation',
  LOAD: 'load',
  RESIZE: 'resize',
  VISIBILITY_CHANGE: 'visibility_change',
  CHECKPOINT: 'checkpoint',
  ANNOTATION: 'annotation'
};

/**
 * Recording state
 */
const RECORDING_STATE = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PAUSED: 'paused',
  STOPPED: 'stopped'
};

/**
 * Sensitive data patterns for masking
 */
const SENSITIVE_PATTERNS = {
  PASSWORD: /password|passwd|pwd/i,
  EMAIL: /email|e-mail/i,
  PHONE: /phone|tel|mobile/i,
  SSN: /ssn|social.?security/i,
  CREDIT_CARD: /card|ccn|creditcard/i,
  CVV: /cvv|cvc|security.?code/i,
  PIN: /pin|pincode/i,
  TOKEN: /token|auth|bearer/i,
  API_KEY: /api.?key|apikey/i,
  SECRET: /secret|private/i
};

/**
 * Interaction event class
 */
class InteractionEvent {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.type = options.type || INTERACTION_TYPES.MOUSE_CLICK;
    this.timestamp = options.timestamp || Date.now();
    this.relativeTime = options.relativeTime || 0;
    this.timeDelta = options.timeDelta || 0;

    // Event data
    this.data = options.data || {};

    // Element context
    this.element = options.element || null;

    // Page context
    this.pageUrl = options.pageUrl || '';
    this.pageTitle = options.pageTitle || '';
    this.viewport = options.viewport || null;

    // Metadata
    this.metadata = options.metadata || {};
    this.masked = options.masked || false;
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      relativeTime: this.relativeTime,
      timeDelta: this.timeDelta,
      data: this.data,
      element: this.element,
      pageUrl: this.pageUrl,
      pageTitle: this.pageTitle,
      viewport: this.viewport,
      metadata: this.metadata,
      masked: this.masked
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(data) {
    return new InteractionEvent(data);
  }
}

/**
 * Recording checkpoint for timeline navigation
 */
class RecordingCheckpoint {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.name = options.name || `Checkpoint ${Date.now()}`;
    this.description = options.description || '';
    this.timestamp = options.timestamp || Date.now();
    this.relativeTime = options.relativeTime || 0;
    this.eventIndex = options.eventIndex || 0;
    this.pageState = options.pageState || null;
    this.screenshot = options.screenshot || null;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      timestamp: this.timestamp,
      relativeTime: this.relativeTime,
      eventIndex: this.eventIndex,
      pageState: this.pageState,
      screenshot: this.screenshot
    };
  }

  static fromJSON(data) {
    return new RecordingCheckpoint(data);
  }
}

/**
 * Interaction Recording Session
 */
class InteractionRecording {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.name = options.name || `Recording ${new Date().toISOString()}`;
    this.description = options.description || '';
    this.startUrl = options.startUrl || '';
    this.startTime = options.startTime || Date.now();
    this.endTime = options.endTime || null;
    this.duration = options.duration || 0;

    // Events and timeline
    this.events = options.events || [];
    this.checkpoints = options.checkpoints || [];
    this.annotations = options.annotations || [];

    // Recording options
    this.options = options.options || {};

    // Statistics
    this.stats = options.stats || {
      totalEvents: 0,
      eventsByType: {},
      mouseMovements: 0,
      clicks: 0,
      keyPresses: 0,
      scrolls: 0,
      navigations: 0,
      maskedEvents: 0
    };

    // Metadata
    this.metadata = options.metadata || {};
    this.tags = options.tags || [];

    // Hash for integrity verification
    this.hash = options.hash || null;
  }

  /**
   * Add event to recording
   */
  addEvent(event) {
    this.events.push(event);
    this.updateStats(event);
  }

  /**
   * Update statistics
   */
  updateStats(event) {
    this.stats.totalEvents++;

    // Count by type
    this.stats.eventsByType[event.type] = (this.stats.eventsByType[event.type] || 0) + 1;

    // Update specific counters
    switch (event.type) {
      case INTERACTION_TYPES.MOUSE_MOVE:
        this.stats.mouseMovements++;
        break;
      case INTERACTION_TYPES.MOUSE_CLICK:
      case INTERACTION_TYPES.MOUSE_DOWN:
      case INTERACTION_TYPES.MOUSE_UP:
        this.stats.clicks++;
        break;
      case INTERACTION_TYPES.KEY_DOWN:
      case INTERACTION_TYPES.KEY_UP:
      case INTERACTION_TYPES.KEY_PRESS:
      case INTERACTION_TYPES.INPUT:
        this.stats.keyPresses++;
        break;
      case INTERACTION_TYPES.SCROLL:
        this.stats.scrolls++;
        break;
      case INTERACTION_TYPES.NAVIGATION:
        this.stats.navigations++;
        break;
    }

    if (event.masked) {
      this.stats.maskedEvents++;
    }
  }

  /**
   * Add checkpoint
   */
  addCheckpoint(checkpoint) {
    this.checkpoints.push(checkpoint);
  }

  /**
   * Add annotation
   */
  addAnnotation(annotation) {
    this.annotations.push(annotation);
  }

  /**
   * Calculate hash for integrity verification
   */
  calculateHash() {
    const data = JSON.stringify({
      id: this.id,
      events: this.events.map(e => e.toJSON()),
      checkpoints: this.checkpoints.map(c => c.toJSON())
    });
    this.hash = crypto.createHash('sha256').update(data).digest('hex');
    return this.hash;
  }

  /**
   * Verify hash integrity
   */
  verifyHash() {
    const currentHash = this.hash;
    const calculatedHash = this.calculateHash();
    this.hash = currentHash;
    return currentHash === calculatedHash;
  }

  /**
   * Get events in time range
   */
  getEventsInRange(startTime, endTime) {
    return this.events.filter(e =>
      e.relativeTime >= startTime && e.relativeTime <= endTime
    );
  }

  /**
   * Get events by type
   */
  getEventsByType(type) {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      startUrl: this.startUrl,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      events: this.events.map(e => e.toJSON()),
      checkpoints: this.checkpoints.map(c => c.toJSON()),
      annotations: this.annotations,
      options: this.options,
      stats: this.stats,
      metadata: this.metadata,
      tags: this.tags,
      hash: this.hash
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(data) {
    const recording = new InteractionRecording({
      ...data,
      events: (data.events || []).map(e => InteractionEvent.fromJSON(e)),
      checkpoints: (data.checkpoints || []).map(c => RecordingCheckpoint.fromJSON(c))
    });
    return recording;
  }
}

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
      throw new Error('Cannot create checkpoint: not recording');
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

    const script = this._generateSeleniumScript(this.currentRecording, options);

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

    const script = this._generatePuppeteerScript(this.currentRecording, options);

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

    const script = this._generatePlaywrightScript(this.currentRecording, options);

    return {
      success: true,
      format: 'playwright',
      data: script,
      size: Buffer.byteLength(script, 'utf8'),
      filename: `${this.currentRecording.name.replace(/[^a-z0-9]/gi, '_')}_playwright.js`
    };
  }

  /**
   * Generate Selenium script
   */
  _generateSeleniumScript(recording, options = {}) {
    const includeHeader = options.includeHeader !== false;
    const includeSetup = options.includeSetup !== false;
    const includeWaits = options.includeWaits !== false;

    let script = '';

    if (includeHeader) {
      script += `#!/usr/bin/env python3
"""
${recording.name}
${recording.description}

Generated from interaction recording: ${recording.id}
Duration: ${recording.duration}ms
Events: ${recording.events.length}
"""

`;
    }

    if (includeSetup) {
      script += `from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

# Initialize driver
driver = webdriver.Chrome()
wait = WebDriverWait(driver, 10)
actions = ActionChains(driver)

try:
`;
    }

    // Process events
    let indent = includeSetup ? '    ' : '';
    let lastUrl = recording.startUrl;

    for (const event of recording.events) {
      const comment = this._getEventComment(event);
      if (comment) {
        script += `${indent}# ${comment}\n`;
      }

      switch (event.type) {
        case INTERACTION_TYPES.NAVIGATION:
          script += `${indent}driver.get("${this._escape(event.data.url)}")\n`;
          lastUrl = event.data.url;
          if (includeWaits) {
            script += `${indent}time.sleep(0.5)\n`;
          }
          break;

        case INTERACTION_TYPES.MOUSE_CLICK:
          if (event.element && event.element.selector) {
            script += `${indent}element = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "${this._escape(event.element.selector)}")))\n`;
            script += `${indent}element.click()\n`;
          }
          break;

        case INTERACTION_TYPES.INPUT:
        case INTERACTION_TYPES.CHANGE:
          if (event.element && event.element.selector && !event.masked) {
            script += `${indent}element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${this._escape(event.element.selector)}")))\n`;
            script += `${indent}element.clear()\n`;
            script += `${indent}element.send_keys("${this._escape(event.data.value || '')}")\n`;
          }
          break;

        case INTERACTION_TYPES.KEY_PRESS:
          if (!event.masked) {
            const key = this._mapKeyToSelenium(event.data.key);
            script += `${indent}actions.send_keys(${key}).perform()\n`;
          }
          break;

        case INTERACTION_TYPES.SCROLL:
          script += `${indent}driver.execute_script("window.scrollTo(${event.data.scrollX}, ${event.data.scrollY})")\n`;
          break;

        case INTERACTION_TYPES.HOVER:
          if (event.element && event.element.selector) {
            script += `${indent}element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${this._escape(event.element.selector)}")))\n`;
            script += `${indent}actions.move_to_element(element).perform()\n`;
          }
          break;

        case INTERACTION_TYPES.SELECT:
          if (event.element && event.element.selector) {
            script += `${indent}from selenium.webdriver.support.ui import Select\n`;
            script += `${indent}select = Select(wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "${this._escape(event.element.selector)}"))))\n`;
            script += `${indent}select.select_by_value("${this._escape(event.data.value)}")\n`;
          }
          break;

        case INTERACTION_TYPES.CHECKPOINT:
          script += `${indent}# Checkpoint: ${event.data.name || 'Unnamed'}\n`;
          if (event.data.description) {
            script += `${indent}# ${event.data.description}\n`;
          }
          break;
      }
    }

    if (includeSetup) {
      script += `
finally:
    # Cleanup
    driver.quit()
`;
    }

    return script;
  }

  /**
   * Generate Puppeteer script
   */
  _generatePuppeteerScript(recording, options = {}) {
    const includeHeader = options.includeHeader !== false;
    const includeSetup = options.includeSetup !== false;
    const includeWaits = options.includeWaits !== false;

    let script = '';

    if (includeHeader) {
      script += `/**
 * ${recording.name}
 * ${recording.description}
 *
 * Generated from interaction recording: ${recording.id}
 * Duration: ${recording.duration}ms
 * Events: ${recording.events.length}
 */

`;
    }

    if (includeSetup) {
      script += `const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
`;
    }

    // Process events
    let indent = includeSetup ? '    ' : '';

    for (const event of recording.events) {
      const comment = this._getEventComment(event);
      if (comment) {
        script += `${indent}// ${comment}\n`;
      }

      switch (event.type) {
        case INTERACTION_TYPES.NAVIGATION:
          script += `${indent}await page.goto('${this._escape(event.data.url)}', { waitUntil: 'networkidle0' });\n`;
          break;

        case INTERACTION_TYPES.MOUSE_CLICK:
          if (event.element && event.element.selector) {
            script += `${indent}await page.waitForSelector('${this._escape(event.element.selector)}');\n`;
            script += `${indent}await page.click('${this._escape(event.element.selector)}');\n`;
          } else if (event.data.x !== undefined && event.data.y !== undefined) {
            script += `${indent}await page.mouse.click(${event.data.x}, ${event.data.y});\n`;
          }
          break;

        case INTERACTION_TYPES.INPUT:
        case INTERACTION_TYPES.CHANGE:
          if (event.element && event.element.selector && !event.masked) {
            script += `${indent}await page.waitForSelector('${this._escape(event.element.selector)}');\n`;
            script += `${indent}await page.type('${this._escape(event.element.selector)}', '${this._escape(event.data.value || '')}');\n`;
          }
          break;

        case INTERACTION_TYPES.KEY_PRESS:
          if (!event.masked) {
            script += `${indent}await page.keyboard.press('${this._escape(event.data.key)}');\n`;
          }
          break;

        case INTERACTION_TYPES.SCROLL:
          script += `${indent}await page.evaluate(() => window.scrollTo(${event.data.scrollX}, ${event.data.scrollY}));\n`;
          break;

        case INTERACTION_TYPES.HOVER:
          if (event.element && event.element.selector) {
            script += `${indent}await page.waitForSelector('${this._escape(event.element.selector)}');\n`;
            script += `${indent}await page.hover('${this._escape(event.element.selector)}');\n`;
          }
          break;

        case INTERACTION_TYPES.SELECT:
          if (event.element && event.element.selector) {
            script += `${indent}await page.select('${this._escape(event.element.selector)}', '${this._escape(event.data.value)}');\n`;
          }
          break;

        case INTERACTION_TYPES.CHECKPOINT:
          script += `${indent}// Checkpoint: ${event.data.name || 'Unnamed'}\n`;
          if (event.data.description) {
            script += `${indent}// ${event.data.description}\n`;
          }
          break;
      }

      if (includeWaits && [INTERACTION_TYPES.MOUSE_CLICK, INTERACTION_TYPES.INPUT, INTERACTION_TYPES.NAVIGATION].includes(event.type)) {
        script += `${indent}await page.waitForTimeout(500);\n`;
      }
    }

    if (includeSetup) {
      script += `  } finally {
    await browser.close();
  }
})();
`;
    }

    return script;
  }

  /**
   * Generate Playwright script
   */
  _generatePlaywrightScript(recording, options = {}) {
    const includeHeader = options.includeHeader !== false;
    const includeSetup = options.includeSetup !== false;
    const includeWaits = options.includeWaits !== false;

    let script = '';

    if (includeHeader) {
      script += `/**
 * ${recording.name}
 * ${recording.description}
 *
 * Generated from interaction recording: ${recording.id}
 * Duration: ${recording.duration}ms
 * Events: ${recording.events.length}
 */

`;
    }

    if (includeSetup) {
      script += `const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
`;
    }

    // Process events
    let indent = includeSetup ? '    ' : '';

    for (const event of recording.events) {
      const comment = this._getEventComment(event);
      if (comment) {
        script += `${indent}// ${comment}\n`;
      }

      switch (event.type) {
        case INTERACTION_TYPES.NAVIGATION:
          script += `${indent}await page.goto('${this._escape(event.data.url)}');\n`;
          break;

        case INTERACTION_TYPES.MOUSE_CLICK:
          if (event.element && event.element.selector) {
            script += `${indent}await page.click('${this._escape(event.element.selector)}');\n`;
          } else if (event.data.x !== undefined && event.data.y !== undefined) {
            script += `${indent}await page.mouse.click(${event.data.x}, ${event.data.y});\n`;
          }
          break;

        case INTERACTION_TYPES.INPUT:
        case INTERACTION_TYPES.CHANGE:
          if (event.element && event.element.selector && !event.masked) {
            script += `${indent}await page.fill('${this._escape(event.element.selector)}', '${this._escape(event.data.value || '')}');\n`;
          }
          break;

        case INTERACTION_TYPES.KEY_PRESS:
          if (!event.masked) {
            script += `${indent}await page.keyboard.press('${this._escape(event.data.key)}');\n`;
          }
          break;

        case INTERACTION_TYPES.SCROLL:
          script += `${indent}await page.evaluate(() => window.scrollTo(${event.data.scrollX}, ${event.data.scrollY}));\n`;
          break;

        case INTERACTION_TYPES.HOVER:
          if (event.element && event.element.selector) {
            script += `${indent}await page.hover('${this._escape(event.element.selector)}');\n`;
          }
          break;

        case INTERACTION_TYPES.SELECT:
          if (event.element && event.element.selector) {
            script += `${indent}await page.selectOption('${this._escape(event.element.selector)}', '${this._escape(event.data.value)}');\n`;
          }
          break;

        case INTERACTION_TYPES.CHECKPOINT:
          script += `${indent}// Checkpoint: ${event.data.name || 'Unnamed'}\n`;
          if (event.data.description) {
            script += `${indent}// ${event.data.description}\n`;
          }
          break;
      }

      if (includeWaits && [INTERACTION_TYPES.MOUSE_CLICK, INTERACTION_TYPES.INPUT, INTERACTION_TYPES.NAVIGATION].includes(event.type)) {
        script += `${indent}await page.waitForTimeout(500);\n`;
      }
    }

    if (includeSetup) {
      script += `  } finally {
    await browser.close();
  }
})();
`;
    }

    return script;
  }

  /**
   * Get event comment for script generation
   */
  _getEventComment(event) {
    const time = (event.relativeTime / 1000).toFixed(2);
    switch (event.type) {
      case INTERACTION_TYPES.NAVIGATION:
        return `Navigate to ${event.data.url} (${time}s)`;
      case INTERACTION_TYPES.MOUSE_CLICK:
        return `Click ${event.element?.tagName || 'element'} (${time}s)`;
      case INTERACTION_TYPES.INPUT:
        return `Input to ${event.element?.tagName || 'field'} (${time}s)`;
      case INTERACTION_TYPES.SCROLL:
        return `Scroll to (${event.data.scrollX}, ${event.data.scrollY}) (${time}s)`;
      case INTERACTION_TYPES.CHECKPOINT:
        return null; // Handled separately
      default:
        return null;
    }
  }

  /**
   * Escape string for script generation
   */
  _escape(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Map key to Selenium Keys constant
   */
  _mapKeyToSelenium(key) {
    const keyMap = {
      'Enter': 'Keys.ENTER',
      'Tab': 'Keys.TAB',
      'Escape': 'Keys.ESCAPE',
      'Backspace': 'Keys.BACKSPACE',
      'Delete': 'Keys.DELETE',
      'ArrowUp': 'Keys.UP',
      'ArrowDown': 'Keys.DOWN',
      'ArrowLeft': 'Keys.LEFT',
      'ArrowRight': 'Keys.RIGHT',
      'Home': 'Keys.HOME',
      'End': 'Keys.END',
      'PageUp': 'Keys.PAGE_UP',
      'PageDown': 'Keys.PAGE_DOWN',
      'Space': 'Keys.SPACE'
    };
    return keyMap[key] || `"${key}"`;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.mouseMoveTimer) clearTimeout(this.mouseMoveTimer);
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    if (this.autoCheckpointTimer) clearInterval(this.autoCheckpointTimer);

    this.mouseMoveBuffer = [];
    this.scrollBuffer = [];
    this.elementCache.clear();
  }
}

module.exports = {
  InteractionRecorder,
  InteractionRecording,
  InteractionEvent,
  RecordingCheckpoint,
  INTERACTION_TYPES,
  RECORDING_STATE,
  SENSITIVE_PATTERNS
};
