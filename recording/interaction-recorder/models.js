/**
 * Basset Hound Browser - Interaction Recorder Models
 *
 * Extracted verbatim from recording/interaction-recorder.js
 * (modularization 2026-07-04). Data models for recorded interactions:
 * InteractionEvent, RecordingCheckpoint, and InteractionRecording.
 */

const crypto = require('crypto');
const { uuidv4 } = require('./uuid');
const { INTERACTION_TYPES } = require('./constants');

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

module.exports = {
  InteractionEvent,
  RecordingCheckpoint,
  InteractionRecording
};
