/**
 * Basset Hound Browser - Event Logger Module
 *
 * Extracts and replays interaction events from recorded sessions.
 * Captures click, typing, navigation, and other user interaction events.
 *
 * Features:
 * - Event capture (clicks, typing, navigation, etc.)
 * - Event timeline management
 * - Event filtering by type
 * - Replay capability with timing preservation
 * - Event export/import
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const { EventEmitter } = require('events');

// Event type constants
const EVENT_TYPES = {
  CLICK: 'click',
  DOUBLE_CLICK: 'doubleClick',
  MOUSE_DOWN: 'mouseDown',
  MOUSE_UP: 'mouseUp',
  MOUSE_MOVE: 'mouseMove',
  KEY_DOWN: 'keyDown',
  KEY_UP: 'keyUp',
  TYPING: 'typing',
  SCROLL: 'scroll',
  FOCUS: 'focus',
  BLUR: 'blur',
  FORM_SUBMIT: 'formSubmit',
  NAVIGATION: 'navigation',
  CHANGE: 'change',
  HOVER: 'hover',
  LONG_PRESS: 'longPress',
  PINCH: 'pinch'
};

// Event severity levels
const EVENT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Event Logger and Manager
 */
class EventLogger extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxEvents: options.maxEvents || 10000,
      enableAutoCapture: options.enableAutoCapture !== false,
      captureMouseMove: options.captureMouseMove || false, // Can be verbose
      captureSensitiveData: options.captureSensitiveData || false,
      ...options
    };

    this.sessions = new Map();
  }

  /**
   * Create new event logging session
   * @param {string} sessionId - Session identifier
   * @returns {EventLoggingSession}
   */
  createSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Event logging session ${sessionId} already exists`);
    }

    const session = new EventLoggingSession(sessionId, this.options);

    // Relay session events
    session.on('eventLogged', (event) => {
      this.emit('sessionEventLogged', { sessionId, ...event });
    });

    session.on('sessionEnded', () => {
      this.emit('sessionEventSessionEnded', { sessionId });
    });

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get logging session
   * @param {string} sessionId - Session identifier
   * @returns {EventLoggingSession|null}
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * List all active sessions
   * @returns {Array}
   */
  listSessions() {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get event type constants
   * @returns {Object}
   */
  static getEventTypes() {
    return { ...EVENT_TYPES };
  }

  /**
   * Get event severity constants
   * @returns {Object}
   */
  static getEventSeverities() {
    return { ...EVENT_SEVERITY };
  }

  /**
   * Clean up session
   * @param {string} sessionId - Session identifier
   * @returns {void}
   */
  cleanup(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endSession();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Clean up all sessions
   * @returns {void}
   */
  cleanupAll() {
    for (const session of this.sessions.values()) {
      session.endSession();
    }
    this.sessions.clear();
  }
}

/**
 * Individual event logging session
 */
class EventLoggingSession extends EventEmitter {
  constructor(sessionId, options = {}) {
    super();

    this.sessionId = sessionId;
    this.options = options;

    this.events = [];
    this.eventIndex = {};
    this.startTime = Date.now();
    this.endTime = null;
    this.isActive = true;

    // Initialize event type index for fast lookups
    for (const eventType of Object.values(EVENT_TYPES)) {
      this.eventIndex[eventType] = [];
    }
  }

  /**
   * Log an event
   * @param {Object} eventData - Event data
   * @returns {Object} Logged event with metadata
   */
  logEvent(eventData) {
    if (!this.isActive) {
      throw new Error('Session is not active');
    }

    // Validate event type
    if (!Object.values(EVENT_TYPES).includes(eventData.type)) {
      throw new Error(`Invalid event type: ${eventData.type}`);
    }

    // Check capacity
    if (this.events.length >= this.options.maxEvents) {
      // Remove oldest event
      const oldestEvent = this.events.shift();
      const typeIndex = this.eventIndex[oldestEvent.type];
      typeIndex.shift();
    }

    const loggedEvent = {
      id: `${this.sessionId}-${this.events.length}`,
      sessionId: this.sessionId,
      type: eventData.type,
      timestamp: eventData.timestamp || Date.now(),
      relativeTime: (eventData.timestamp || Date.now()) - this.startTime,
      x: eventData.x || null,
      y: eventData.y || null,
      target: eventData.target || null,
      targetId: eventData.targetId || null,
      targetClass: eventData.targetClass || null,
      key: eventData.key || null,
      text: eventData.text || null,
      value: eventData.value || null,
      scrollX: eventData.scrollX || null,
      scrollY: eventData.scrollY || null,
      scrollAmount: eventData.scrollAmount || null,
      url: eventData.url || null,
      severity: eventData.severity || EVENT_SEVERITY.LOW,
      metadata: eventData.metadata || {},
      ...(eventData.type === EVENT_TYPES.TYPING && eventData.text && {
        textLength: eventData.text.length
      })
    };

    this.events.push(loggedEvent);
    this.eventIndex[eventData.type].push(loggedEvent);

    this.emit('eventLogged', {
      event: loggedEvent,
      totalEvents: this.events.length
    });

    return loggedEvent;
  }

  /**
   * Get all logged events
   * @returns {Array}
   */
  getEvents() {
    return [...this.events];
  }

  /**
   * Get events by type
   * @param {string} type - Event type
   * @returns {Array}
   */
  getEventsByType(type) {
    if (!this.eventIndex[type]) {
      return [];
    }
    return [...this.eventIndex[type]];
  }

  /**
   * Get events in time range
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Array}
   */
  getEventsByTimeRange(startTime, endTime) {
    return this.events.filter(
      (event) => event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  /**
   * Get events by target
   * @param {string} targetId - Target element ID
   * @returns {Array}
   */
  getEventsByTarget(targetId) {
    return this.events.filter((event) => event.targetId === targetId);
  }

  /**
   * Get event at specific index
   * @param {number} index - Event index
   * @returns {Object|null}
   */
  getEvent(index) {
    return this.events[index] || null;
  }

  /**
   * Find events by predicate
   * @param {Function} predicate - Filter function
   * @returns {Array}
   */
  findEvents(predicate) {
    return this.events.filter(predicate);
  }

  /**
   * Get event timeline statistics
   * @returns {Object}
   */
  getTimeline() {
    if (this.events.length === 0) {
      return {
        sessionId: this.sessionId,
        totalEvents: 0,
        eventTypes: {},
        duration: 0
      };
    }

    const eventTypes = {};
    for (const event of this.events) {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    }

    return {
      sessionId: this.sessionId,
      totalEvents: this.events.length,
      eventTypes,
      startTime: this.startTime,
      lastEventTime: this.events[this.events.length - 1].timestamp,
      duration: this.events[this.events.length - 1].timestamp - this.startTime,
      averageEventInterval: this.events.length > 1
        ? (this.events[this.events.length - 1].timestamp - this.startTime) / (this.events.length - 1)
        : 0
    };
  }

  /**
   * Get events sorted by severity
   * @returns {Array}
   */
  getEventsBySeverity() {
    const severityOrder = [
      EVENT_SEVERITY.CRITICAL,
      EVENT_SEVERITY.HIGH,
      EVENT_SEVERITY.MEDIUM,
      EVENT_SEVERITY.LOW
    ];

    return [...this.events].sort((a, b) => {
      const aIndex = severityOrder.indexOf(a.severity);
      const bIndex = severityOrder.indexOf(b.severity);
      return aIndex - bIndex;
    });
  }

  /**
   * Clear all logged events
   * @returns {void}
   */
  clearEvents() {
    this.events = [];
    for (const type of Object.keys(this.eventIndex)) {
      this.eventIndex[type] = [];
    }
  }

  /**
   * Export events as JSON
   * @returns {Object}
   */
  exportEvents() {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: (this.endTime || Date.now()) - this.startTime,
      totalEvents: this.events.length,
      events: this.events
    };
  }

  /**
   * Import events from JSON
   * @param {Array} eventsData - Events to import
   * @returns {void}
   */
  importEvents(eventsData) {
    for (const eventData of eventsData) {
      // Validate event type
      if (!Object.values(EVENT_TYPES).includes(eventData.type)) {
        continue;
      }

      const event = { ...eventData, sessionId: this.sessionId };
      this.events.push(event);

      if (this.eventIndex[eventData.type]) {
        this.eventIndex[eventData.type].push(event);
      }
    }
  }

  /**
   * End the logging session
   * @returns {Object} Session summary
   */
  endSession() {
    this.isActive = false;
    this.endTime = Date.now();

    const summary = this.getTimeline();
    this.emit('sessionEnded', summary);

    return summary;
  }

  /**
   * Get session statistics
   * @returns {Object}
   */
  getStatistics() {
    const stats = {
      sessionId: this.sessionId,
      isActive: this.isActive,
      totalEvents: this.events.length,
      duration: (this.endTime || Date.now()) - this.startTime,
      eventTypes: {},
      averageEventInterval: 0,
      clickCount: 0,
      typeCount: 0,
      navigationCount: 0
    };

    for (const event of this.events) {
      stats.eventTypes[event.type] = (stats.eventTypes[event.type] || 0) + 1;

      if (event.type === EVENT_TYPES.CLICK) stats.clickCount++;
      if (event.type === EVENT_TYPES.TYPING) stats.typeCount++;
      if (event.type === EVENT_TYPES.NAVIGATION) stats.navigationCount++;
    }

    if (this.events.length > 1) {
      stats.averageEventInterval = stats.duration / (this.events.length - 1);
    }

    return stats;
  }
}

module.exports = {
  EventLogger,
  EventLoggingSession,
  EVENT_TYPES,
  EVENT_SEVERITY
};
