/**
 * Real-Time Collaboration API (v12.9.0 Feature 2)
 *
 * Implements comprehensive real-time collaboration features for concurrent
 * multi-user/multi-agent browser control with conflict resolution, event
 * streaming, session locking, and message queuing.
 *
 * Features:
 * 1. Session Locking - Prevent concurrent operations on same session
 * 2. Event Streaming - Real-time event subscriptions and broadcasts
 * 3. Message Queue - Command queueing with conflict detection
 * 4. Conflict Resolution - Handle simultaneous conflicting commands
 * 5. Connection Pool Integration - Leverage existing connection infrastructure
 *
 * @module src/v12-9-0/collaboration-api
 */

const crypto = require('crypto');
const EventEmitter = require('events');

/**
 * Session Lock Manager
 * Manages exclusive locks on browser sessions to prevent concurrent command conflicts
 */
class SessionLockManager {
  constructor(options = {}) {
    this.locks = new Map();
    this.lockWaiters = new Map();
    this.lockTimeout = options.lockTimeout || 30000; // 30 seconds default
    this.logger = options.logger || console;
  }

  /**
   * Acquire exclusive lock on session
   * @param {string} sessionId - Session to lock
   * @param {string} clientId - Client requesting lock
   * @param {Object} options - Lock options
   * @returns {Promise<{lockId: string, acquiredAt: number, sessionId: string}>}
   */
  async acquireLock(sessionId, clientId, options = {}) {
    if (!sessionId || !clientId) {
      throw new Error('sessionId and clientId are required');
    }

    const lockId = crypto.randomBytes(16).toString('hex');
    const acquireTimeout = options.timeout || this.lockTimeout;
    const priority = options.priority || 0;

    // Check if session is already locked
    const existingLock = this.locks.get(sessionId);
    if (existingLock) {
      // Wait for existing lock to be released
      return this._waitForLock(sessionId, clientId, lockId, acquireTimeout, priority);
    }

    // Acquire lock immediately
    const lock = {
      lockId,
      sessionId,
      clientId,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + acquireTimeout,
      priority,
      commands: 0,
      metadata: options.metadata || {}
    };

    this.locks.set(sessionId, lock);
    this.logger.debug(`Lock acquired: ${lockId} for session ${sessionId} by ${clientId}`);

    return {
      lockId,
      sessionId,
      acquiredAt: lock.acquiredAt,
      expiresAt: lock.expiresAt
    };
  }

  /**
   * Release lock on session
   * @param {string} lockId - Lock ID to release
   * @param {string} sessionId - Associated session
   * @returns {{success: boolean, releasedAt: number, nextWaiter?: string}}
   */
  releaseLock(lockId, sessionId) {
    const lock = this.locks.get(sessionId);

    if (!lock) {
      return { success: false, error: 'Lock not found' };
    }

    if (lock.lockId !== lockId) {
      return { success: false, error: 'Lock ID mismatch' };
    }

    this.locks.delete(sessionId);
    const releasedAt = Date.now();

    // Notify next waiter
    const waiters = this.lockWaiters.get(sessionId) || [];
    if (waiters.length > 0) {
      const nextWaiter = waiters.shift();
      if (waiters.length === 0) {
        this.lockWaiters.delete(sessionId);
      } else {
        this.lockWaiters.set(sessionId, waiters);
      }
      nextWaiter.resolve();
    }

    this.logger.debug(`Lock released: ${lockId} for session ${sessionId}`);

    return {
      success: true,
      releasedAt,
      lockId,
      nextWaiter: waiters.length > 0 ? waiters[0].clientId : undefined
    };
  }

  /**
   * Renew existing lock
   * @param {string} lockId - Lock to renew
   * @param {string} sessionId - Associated session
   * @returns {{success: boolean, expiresAt: number}}
   */
  renewLock(lockId, sessionId) {
    const lock = this.locks.get(sessionId);

    if (!lock || lock.lockId !== lockId) {
      return { success: false, error: 'Lock not found or invalid' };
    }

    lock.expiresAt = Date.now() + this.lockTimeout;
    this.logger.debug(`Lock renewed: ${lockId} for session ${sessionId}`);

    return {
      success: true,
      expiresAt: lock.expiresAt,
      lockId
    };
  }

  /**
   * Get lock status
   * @param {string} sessionId - Session to check
   * @returns {{locked: boolean, lockId?: string, clientId?: string, remainingMs?: number}}
   */
  getLockStatus(sessionId) {
    const lock = this.locks.get(sessionId);

    if (!lock) {
      return { locked: false, sessionId };
    }

    const remainingMs = Math.max(0, lock.expiresAt - Date.now());
    return {
      locked: true,
      lockId: lock.lockId,
      sessionId,
      clientId: lock.clientId,
      acquiredAt: lock.acquiredAt,
      remainingMs,
      commands: lock.commands
    };
  }

  /**
   * Wait for lock to be released (internal)
   * @private
   */
  _waitForLock(sessionId, clientId, lockId, timeout, priority) {
    return new Promise((resolve, reject) => {
      const waiter = {
        clientId,
        lockId,
        priority,
        createdAt: Date.now(),
        resolve,
        reject
      };

      // Store waiter
      if (!this.lockWaiters.has(sessionId)) {
        this.lockWaiters.set(sessionId, []);
      }
      const waiters = this.lockWaiters.get(sessionId);
      waiters.push(waiter);

      // Sort by priority (higher priority first)
      waiters.sort((a, b) => b.priority - a.priority);

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        const idx = waiters.indexOf(waiter);
        if (idx >= 0) {
          waiters.splice(idx, 1);
        }
        reject(new Error(`Lock acquisition timeout after ${timeout}ms`));
      }, timeout);

      // Override resolve to acquire lock
      const originalResolve = waiter.resolve;
      waiter.resolve = () => {
        clearTimeout(timeoutHandle);
        const lock = {
          lockId,
          sessionId,
          clientId,
          acquiredAt: Date.now(),
          expiresAt: Date.now() + this.lockTimeout,
          priority,
          commands: 0,
          metadata: {}
        };
        this.locks.set(sessionId, lock);
        originalResolve({
          lockId,
          sessionId,
          acquiredAt: lock.acquiredAt,
          expiresAt: lock.expiresAt
        });
      };
    });
  }

  /**
   * Clean up expired locks
   */
  cleanupExpiredLocks() {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, lock] of this.locks.entries()) {
      if (lock.expiresAt < now) {
        this.locks.delete(sessionId);
        cleaned++;
      }
    }

    return { cleaned, remaining: this.locks.size };
  }

  /**
   * Get all active locks
   */
  getAllLocks() {
    const locks = [];
    for (const [sessionId, lock] of this.locks.entries()) {
      locks.push({
        sessionId,
        lockId: lock.lockId,
        clientId: lock.clientId,
        acquiredAt: lock.acquiredAt,
        expiresAt: lock.expiresAt,
        commands: lock.commands
      });
    }
    return locks;
  }
}

/**
 * Event Stream Manager
 * Manages real-time event subscriptions and broadcasting
 */
class EventStreamManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.subscribers = new Map(); // sessionId -> Set of subscriber IDs
    this.subscriptions = new Map(); // subscriberId -> subscription config
    this.eventBuffer = new Map(); // sessionId -> circular buffer of events
    this.maxBufferSize = options.maxBufferSize || 1000;
    this.logger = options.logger || console;
  }

  /**
   * Subscribe to session events
   * @param {string} sessionId - Session to subscribe to
   * @param {string} subscriberId - Client subscriber ID
   * @param {Object} options - Subscription options
   * @returns {{subscriptionId: string, sessionId: string, subscribedAt: number}}
   */
  subscribe(sessionId, subscriberId, options = {}) {
    if (!sessionId || !subscriberId) {
      throw new Error('sessionId and subscriberId are required');
    }

    const subscriptionId = crypto.randomBytes(16).toString('hex');
    const eventTypes = options.eventTypes || ['*']; // '*' means all events

    // Add to subscribers
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId).add(subscriberId);

    // Store subscription config
    this.subscriptions.set(subscriptionId, {
      sessionId,
      subscriberId,
      eventTypes,
      subscribedAt: Date.now(),
      eventCount: 0,
      filters: options.filters || {}
    });

    // Initialize event buffer if needed
    if (!this.eventBuffer.has(sessionId)) {
      this.eventBuffer.set(sessionId, []);
    }

    this.logger.debug(`Subscriber ${subscriberId} subscribed to ${sessionId}`);

    return {
      subscriptionId,
      sessionId,
      subscriberId,
      subscribedAt: Date.now()
    };
  }

  /**
   * Unsubscribe from session events
   * @param {string} subscriptionId - Subscription ID to remove
   * @returns {{success: boolean, sessionId?: string, subscriberId?: string}}
   */
  unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    const { sessionId, subscriberId } = subscription;

    // Remove from subscribers
    const sessionSubscribers = this.subscribers.get(sessionId);
    if (sessionSubscribers) {
      sessionSubscribers.delete(subscriberId);
      if (sessionSubscribers.size === 0) {
        this.subscribers.delete(sessionId);
      }
    }

    this.subscriptions.delete(subscriptionId);
    this.logger.debug(`Subscriber ${subscriberId} unsubscribed from ${sessionId}`);

    return {
      success: true,
      sessionId,
      subscriberId
    };
  }

  /**
   * Broadcast event to subscribers
   * @param {string} sessionId - Session emitting event
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @returns {{broadcasted: number, buffered: boolean}}
   */
  broadcastEvent(sessionId, eventType, data) {
    if (!sessionId || !eventType) {
      throw new Error('sessionId and eventType are required');
    }

    const event = {
      eventId: crypto.randomBytes(8).toString('hex'),
      sessionId,
      eventType,
      timestamp: Date.now(),
      data: data || {}
    };

    // Add to buffer
    if (!this.eventBuffer.has(sessionId)) {
      this.eventBuffer.set(sessionId, []);
    }
    const buffer = this.eventBuffer.get(sessionId);
    buffer.push(event);

    // Maintain max size
    if (buffer.length > this.maxBufferSize) {
      buffer.shift();
    }

    // Broadcast to subscribers
    const subscribers = this.subscribers.get(sessionId);
    let broadcastCount = 0;

    if (subscribers && subscribers.size > 0) {
      for (const subscriberId of subscribers) {
        this.emit('event', {
          sessionId,
          subscriberId,
          event
        });
        broadcastCount++;
      }
    }

    this.logger.debug(`Event ${event.eventId} broadcasted to ${broadcastCount} subscribers`);

    return {
      eventId: event.eventId,
      broadcasted: broadcastCount,
      buffered: true
    };
  }

  /**
   * Get event history for session
   * @param {string} sessionId - Session ID
   * @param {Object} options - Query options
   * @returns {Array} Array of buffered events
   */
  getEventHistory(sessionId, options = {}) {
    const buffer = this.eventBuffer.get(sessionId) || [];
    let events = [...buffer];

    // Filter by event type if specified
    if (options.eventType && options.eventType !== '*') {
      events = events.filter(e => e.eventType === options.eventType);
    }

    // Filter by time range if specified
    if (options.since) {
      events = events.filter(e => e.timestamp >= options.since);
    }

    // Limit results
    if (options.limit) {
      events = events.slice(-options.limit);
    }

    return events;
  }

  /**
   * Get subscription info
   * @param {string} subscriptionId - Subscription ID
   * @returns {Object} Subscription details
   */
  getSubscriptionInfo(subscriptionId) {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * Get all subscriptions for session
   * @param {string} sessionId - Session ID
   * @returns {Array} Array of subscriptions
   */
  getSessionSubscriptions(sessionId) {
    const subs = [];
    for (const [subId, sub] of this.subscriptions.entries()) {
      if (sub.sessionId === sessionId) {
        subs.push({ subscriptionId: subId, ...sub });
      }
    }
    return subs;
  }
}

/**
 * Message Queue Manager
 * Manages command queueing with conflict detection and resolution
 */
class MessageQueueManager {
  constructor(options = {}) {
    this.queues = new Map(); // sessionId -> array of messages
    this.maxQueueSize = options.maxQueueSize || 5000;
    this.conflictDetector = options.conflictDetector || new ConflictDetector();
    this.logger = options.logger || console;
  }

  /**
   * Queue command for session
   * @param {string} sessionId - Target session
   * @param {string} clientId - Client queuing command
   * @param {Object} command - Command to queue
   * @param {Object} options - Queue options
   * @returns {{queuedId: string, position: number, estimatedWaitMs: number}}
   */
  queueCommand(sessionId, clientId, command, options = {}) {
    if (!sessionId || !clientId || !command) {
      throw new Error('sessionId, clientId, and command are required');
    }

    if (!this.queues.has(sessionId)) {
      this.queues.set(sessionId, []);
    }

    const queue = this.queues.get(sessionId);

    // Check queue size
    if (queue.length >= this.maxQueueSize) {
      throw new Error(`Queue full (max: ${this.maxQueueSize})`);
    }

    // Create queue entry
    const queueEntry = {
      queuedId: crypto.randomBytes(16).toString('hex'),
      sessionId,
      clientId,
      command,
      priority: options.priority || 0,
      queuedAt: Date.now(),
      timeout: options.timeout || 60000,
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      metadata: options.metadata || {}
    };

    // Detect conflicts with existing commands
    if (options.detectConflicts !== false) {
      const conflicts = this.conflictDetector.detectConflicts(
        command,
        queue.map(e => e.command)
      );

      if (conflicts.length > 0) {
        queueEntry.conflicts = conflicts;
        if (options.resolveConflicts === 'abort') {
          throw new Error(`Conflicts detected: ${conflicts.join(', ')}`);
        }
      }
    }

    // Insert into queue (sorted by priority)
    let inserted = false;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].priority <= queueEntry.priority) {
        queue.splice(i + 1, 0, queueEntry);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      queue.unshift(queueEntry);
    }

    // Estimate wait time (assume 100ms per command)
    const position = queue.indexOf(queueEntry);
    const estimatedWaitMs = position * 100;

    this.logger.debug(`Command queued: ${queueEntry.queuedId} at position ${position}`);

    return {
      queuedId: queueEntry.queuedId,
      position,
      estimatedWaitMs,
      queueSize: queue.length
    };
  }

  /**
   * Peek at next command in queue without removing
   * @param {string} sessionId - Session ID
   * @returns {{queuedId: string, command: Object, clientId: string} | null}
   */
  peekQueue(sessionId) {
    const queue = this.queues.get(sessionId);

    if (!queue || queue.length === 0) {
      return null;
    }

    const entry = queue[0];
    return {
      queuedId: entry.queuedId,
      command: entry.command,
      clientId: entry.clientId,
      priority: entry.priority,
      queuedAt: entry.queuedAt,
      position: 0,
      queueSize: queue.length
    };
  }

  /**
   * Dequeue command from session
   * @param {string} sessionId - Session ID
   * @returns {Object | null} Dequeued command or null if empty
   */
  dequeueCommand(sessionId) {
    const queue = this.queues.get(sessionId);

    if (!queue || queue.length === 0) {
      return null;
    }

    return queue.shift();
  }

  /**
   * Remove specific command from queue
   * @param {string} sessionId - Session ID
   * @param {string} queuedId - Queued command ID
   * @returns {{success: boolean, position?: number}}
   */
  removeCommand(sessionId, queuedId) {
    const queue = this.queues.get(sessionId);

    if (!queue) {
      return { success: false, error: 'Queue not found' };
    }

    const idx = queue.findIndex(e => e.queuedId === queuedId);
    if (idx < 0) {
      return { success: false, error: 'Command not found in queue' };
    }

    queue.splice(idx, 1);
    return { success: true, position: idx };
  }

  /**
   * Get queue status for session
   * @param {string} sessionId - Session ID
   * @returns {Object} Queue statistics
   */
  getQueueStatus(sessionId) {
    const queue = this.queues.get(sessionId);

    if (!queue) {
      return { sessionId, size: 0, commands: [] };
    }

    return {
      sessionId,
      size: queue.length,
      maxSize: this.maxQueueSize,
      commands: queue.map((e, idx) => ({
        queuedId: e.queuedId,
        clientId: e.clientId,
        command: e.command.name || e.command.type,
        priority: e.priority,
        position: idx,
        queuedAt: e.queuedAt
      }))
    };
  }

  /**
   * Clear queue for session
   * @param {string} sessionId - Session ID
   * @returns {{cleared: number}}
   */
  clearQueue(sessionId) {
    const queue = this.queues.get(sessionId);
    const cleared = queue ? queue.length : 0;
    this.queues.delete(sessionId);
    return { cleared };
  }

  /**
   * Get queue statistics
   * @returns {Object} Global queue stats
   */
  getStatistics() {
    let totalCommands = 0;
    let maxQueueSize = 0;
    let avgQueueSize = 0;

    for (const queue of this.queues.values()) {
      totalCommands += queue.length;
      maxQueueSize = Math.max(maxQueueSize, queue.length);
    }

    if (this.queues.size > 0) {
      avgQueueSize = totalCommands / this.queues.size;
    }

    return {
      activeSessions: this.queues.size,
      totalCommands,
      maxQueueSize,
      avgQueueSize
    };
  }
}

/**
 * Conflict Detector
 * Detects conflicts between commands
 */
class ConflictDetector {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.conflictRules = this._initializeConflictRules();
  }

  /**
   * Detect conflicts between a command and a set of queued commands
   * @param {Object} command - New command to check
   * @param {Array} queuedCommands - Existing queued commands
   * @returns {Array} Array of conflict descriptions
   */
  detectConflicts(command, queuedCommands) {
    const conflicts = [];
    const cmdName = command.name || command.type || '';

    for (const queued of queuedCommands) {
      const queuedName = queued.name || queued.type || '';

      // Check direct conflict rules
      if (this.conflictRules.has(cmdName)) {
        const conflicts_for_cmd = this.conflictRules.get(cmdName);
        if (conflicts_for_cmd.has(queuedName)) {
          conflicts.push({
            conflict: `${cmdName} conflicts with ${queuedName}`,
            reason: conflicts_for_cmd.get(queuedName)
          });
        }
      }

      // Check if both commands operate on same target
      if (command.params && queued.params) {
        const conflictKeys = ['sessionId', 'elementId', 'url', 'tab'];
        for (const key of conflictKeys) {
          if (
            command.params[key] &&
            queued.params[key] &&
            command.params[key] === queued.params[key] &&
            this._areCommandsIncompatible(cmdName, queuedName)
          ) {
            conflicts.push({
              conflict: `Both commands target same ${key}`,
              reason: `Cannot execute ${cmdName} while ${queuedName} is queued for same target`
            });
            break;
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Initialize default conflict rules
   * @private
   */
  _initializeConflictRules() {
    const rules = new Map();

    // Navigation conflicts
    const navigationConflicts = new Map();
    navigationConflicts.set('navigate', 'Cannot navigate twice');
    navigationConflicts.set('go_back', 'Cannot navigate while going back');
    navigationConflicts.set('go_forward', 'Cannot navigate while going forward');
    rules.set('navigate', navigationConflicts);

    // Form submission conflicts
    const formConflicts = new Map();
    formConflicts.set('submit_form', 'Cannot submit same form twice');
    formConflicts.set('fill_form', 'Cannot fill and submit same form concurrently');
    rules.set('submit_form', formConflicts);

    // Click conflicts
    const clickConflicts = new Map();
    clickConflicts.set('click', 'Duplicate click on same element');
    rules.set('click', clickConflicts);

    return rules;
  }

  /**
   * Check if two commands are incompatible
   * @private
   */
  _areCommandsIncompatible(cmd1, cmd2) {
    const incompatiblePairs = [
      ['click', 'click'],
      ['fill', 'fill'],
      ['type', 'type'],
      ['scroll', 'scroll'],
      ['navigate', 'click'],
      ['navigate', 'fill']
    ];

    for (const [a, b] of incompatiblePairs) {
      if ((cmd1 === a && cmd2 === b) || (cmd1 === b && cmd2 === a)) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Collaboration Coordinator
 * Orchestrates all collaboration features
 */
class CollaborationCoordinator {
  constructor(options = {}) {
    this.lockManager = new SessionLockManager(options);
    this.eventManager = new EventStreamManager(options);
    this.queueManager = new MessageQueueManager(options);
    this.logger = options.logger || console;
    this.stats = {
      locksAcquired: 0,
      eventsEmitted: 0,
      commandsQueued: 0,
      conflictsResolved: 0
    };
  }

  /**
   * Execute command with full collaboration features
   * @param {string} sessionId - Target session
   * @param {string} clientId - Client executing command
   * @param {Object} command - Command to execute
   * @param {Object} options - Execution options
   * @returns {Promise<{status: string, result?: Object, error?: string}>}
   */
  async executeCollaborativeCommand(sessionId, clientId, command, options = {}) {
    let lockId = null;

    try {
      // Acquire lock
      const lockResult = await this.lockManager.acquireLock(sessionId, clientId, options.lock || {});
      lockId = lockResult.lockId;
      this.stats.locksAcquired++;

      // Update lock with command tracking
      const lock = this.lockManager.locks.get(sessionId);
      if (lock) {
        lock.commands++;
      }

      // Emit start event
      this.eventManager.broadcastEvent(sessionId, 'command_started', {
        clientId,
        command: command.name || command.type,
        lockId
      });

      // Execute command (would call actual command handler)
      // This is a placeholder - actual implementation would execute the command
      const result = {
        status: 'success',
        lockId,
        command: command.name || command.type
      };

      // Emit success event
      this.eventManager.broadcastEvent(sessionId, 'command_completed', {
        clientId,
        lockId,
        result
      });

      return result;
    } catch (error) {
      // Emit error event
      this.eventManager.broadcastEvent(sessionId, 'command_failed', {
        clientId,
        error: error.message
      });

      return {
        status: 'error',
        error: error.message
      };
    } finally {
      // Release lock
      if (lockId) {
        this.lockManager.releaseLock(lockId, sessionId);
      }
    }
  }

  /**
   * Get comprehensive collaboration status
   * @param {string} sessionId - Session ID (optional)
   * @returns {Object} Status information
   */
  getCollaborationStatus(sessionId = null) {
    return {
      timestamp: Date.now(),
      locks: sessionId
        ? this.lockManager.getLockStatus(sessionId)
        : this.lockManager.getAllLocks(),
      subscriptions: sessionId
        ? this.eventManager.getSessionSubscriptions(sessionId)
        : this.eventManager.subscriptions.size,
      queue: sessionId
        ? this.queueManager.getQueueStatus(sessionId)
        : this.queueManager.getStatistics(),
      stats: this.stats
    };
  }
}

module.exports = {
  SessionLockManager,
  EventStreamManager,
  MessageQueueManager,
  ConflictDetector,
  CollaborationCoordinator
};
