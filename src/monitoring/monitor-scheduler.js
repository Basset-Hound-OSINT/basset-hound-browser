/**
 * Monitor Scheduler - Intelligent scheduling for 50+ concurrent targets
 *
 * Manages scheduling of monitoring checks with:
 * - Intelligent scheduling (avoid thundering herd)
 * - Adaptive polling intervals based on change frequency
 * - Priority queue for urgent monitoring
 * - Performance: <100ms scheduling overhead
 *
 * @module src/monitoring/monitor-scheduler
 * @requires events
 */

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Priority levels for monitoring
 */
const PRIORITY = {
  CRITICAL: 5,
  HIGH: 4,
  NORMAL: 3,
  LOW: 2,
  IDLE: 1
};

/**
 * Adaptive interval configuration
 */
const ADAPTIVE_INTERVALS = {
  // Static intervals by priority
  CRITICAL: 5000, // 5 seconds
  HIGH: 15000, // 15 seconds
  NORMAL: 60000, // 1 minute
  LOW: 300000, // 5 minutes
  IDLE: 600000, // 10 minutes

  // Adaptive multipliers based on change frequency
  CHANGE_FREQUENCY: {
    VERY_HIGH: 1.0, // Check at base interval
    HIGH: 1.5, // Check 66% as often
    MEDIUM: 2.0, // Check 50% as often
    LOW: 3.0, // Check 33% as often
    VERY_LOW: 5.0 // Check 20% as often
  }
};

/**
 * Scheduling strategies
 */
const SCHEDULE_STRATEGY = {
  IMMEDIATE: 'immediate', // Check ASAP
  SPREAD: 'spread', // Distribute checks across time window
  ADAPTIVE: 'adaptive', // Adapt based on change frequency
  PRIORITY: 'priority' // Priority queue
};

/**
 * Monitor Scheduler
 * Manages intelligent scheduling of 50+ concurrent targets
 */
class MonitorScheduler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxConcurrentChecks: options.maxConcurrentChecks || 15,
      spreadWindow: options.spreadWindow || 5000, // 5-second window to spread checks
      enableAdaptivePolling: options.enableAdaptivePolling !== false,
      strategy: options.strategy || SCHEDULE_STRATEGY.ADAPTIVE,
      changeFrequencyWindow: options.changeFrequencyWindow || 3600000, // 1 hour
      ...options
    };

    // State management
    this.monitors = new Map(); // monitorId -> monitor state
    this.scheduledChecks = new Map(); // monitorId -> scheduled check time
    this.activeChecks = new Set(); // Currently executing checks
    this.checkHistory = new Map(); // monitorId -> [check results]
    this.changeFrequency = new Map(); // monitorId -> change frequency data

    // Performance tracking
    this.stats = {
      checksScheduled: 0,
      checksExecuted: 0,
      checksSkipped: 0,
      averageSchedulingTime: 0,
      schedulingOverhead: [],
      lastScheduleTime: Date.now()
    };

    // Scheduling loop
    this.scheduleLoop = null;
    this.scheduleLoopInterval = options.scheduleLoopInterval || 1000; // Run scheduler every second
  }

  /**
   * Register a monitor for scheduling
   * @param {string} monitorId - Unique monitor ID
   * @param {Object} config - Monitor configuration
   * @returns {Object} Registration result
   */
  registerMonitor(monitorId, config = {}) {
    if (this.monitors.has(monitorId)) {
      return {
        success: false,
        error: 'Monitor already registered',
        monitorId
      };
    }

    const monitor = {
      monitorId,
      url: config.url || '',
      priority: config.priority || PRIORITY.NORMAL,
      baseInterval: config.interval || ADAPTIVE_INTERVALS.NORMAL,
      enabled: config.enabled !== false,
      created: Date.now(),
      lastCheck: null,
      nextCheck: Date.now() + Math.random() * this.options.spreadWindow, // Spread initial checks
      changeDetectionSensitivity: config.changeDetectionSensitivity || 0.1,
      tags: config.tags || [],
      metadata: config.metadata || {}
    };

    this.monitors.set(monitorId, monitor);
    this.changeFrequency.set(monitorId, {
      changes: 0,
      checks: 0,
      frequency: 0,
      window: []
    });

    this.emit('monitor-registered', { monitorId, monitor });
    return {
      success: true,
      monitorId,
      nextCheckIn: monitor.nextCheck - Date.now()
    };
  }

  /**
   * Unregister a monitor
   * @param {string} monitorId - Monitor ID to unregister
   * @returns {Object} Unregistration result
   */
  unregisterMonitor(monitorId) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: 'Monitor not found',
        monitorId
      };
    }

    this.monitors.delete(monitorId);
    this.scheduledChecks.delete(monitorId);
    this.changeFrequency.delete(monitorId);

    this.emit('monitor-unregistered', { monitorId });
    return { success: true, monitorId };
  }

  /**
   * Start the scheduling loop
   * @returns {void}
   */
  start() {
    if (this.scheduleLoop) {
      return; // Already running
    }

    this.scheduleLoop = setInterval(() => {
      this.processScheduleQueue();
    }, this.scheduleLoopInterval);

    this.emit('scheduler-started');
  }

  /**
   * Stop the scheduling loop
   * @returns {void}
   */
  stop() {
    if (this.scheduleLoop) {
      clearInterval(this.scheduleLoop);
      this.scheduleLoop = null;
      this.emit('scheduler-stopped');
    }
  }

  /**
   * Process the schedule queue and emit checks
   * @private
   * @returns {void}
   */
  processScheduleQueue() {
    const startTime = Date.now();

    // Get all monitors that need checking
    const dueMonitors = Array.from(this.monitors.values())
      .filter(m => m.enabled && (!m.nextCheck || m.nextCheck <= Date.now()))
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))
      .reverse(); // Higher priority first

    // Apply concurrency limit
    const checksToRun = dueMonitors.slice(0, this.options.maxConcurrentChecks);

    if (checksToRun.length === 0) {
      return;
    }

    // Schedule checks with staggering to avoid thundering herd
    checksToRun.forEach((monitor, index) => {
      const delay = index * (this.options.spreadWindow / Math.max(checksToRun.length, 1));
      const checkTime = Date.now() + delay;

      this.scheduledChecks.set(monitor.monitorId, checkTime);

      // Emit check scheduled event
      this.emit('check-scheduled', {
        monitorId: monitor.monitorId,
        url: monitor.url,
        priority: monitor.priority,
        scheduledTime: checkTime,
        delay
      });

      // After a small delay, execute the check
      setTimeout(() => {
        this.executeMonitorCheck(monitor.monitorId);
      }, delay);
    });

    // Calculate scheduling overhead
    const overhead = Date.now() - startTime;
    this.stats.schedulingOverhead.push(overhead);
    if (this.stats.schedulingOverhead.length > 100) {
      this.stats.schedulingOverhead.shift();
    }
    this.stats.averageSchedulingTime =
      this.stats.schedulingOverhead.reduce((a, b) => a + b, 0) / this.stats.schedulingOverhead.length;
  }

  /**
   * Execute a monitor check
   * @private
   * @param {string} monitorId - Monitor ID to check
   * @returns {void}
   */
  executeMonitorCheck(monitorId) {
    if (this.activeChecks.size >= this.options.maxConcurrentChecks) {
      // Requeue if at capacity
      setTimeout(() => {
        this.executeMonitorCheck(monitorId);
      }, 100);
      return;
    }

    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      return;
    }

    this.activeChecks.add(monitorId);
    this.stats.checksExecuted++;

    // Emit check-start event for external handlers
    this.emit('check-start', {
      monitorId,
      url: monitor.url,
      timestamp: Date.now()
    });
  }

  /**
   * Record check result and update schedule
   * @param {string} monitorId - Monitor ID
   * @param {Object} result - Check result
   * @returns {void}
   */
  recordCheckResult(monitorId, result) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      return;
    }

    // Remove from active checks
    this.activeChecks.delete(monitorId);

    // Update check history
    if (!this.checkHistory.has(monitorId)) {
      this.checkHistory.set(monitorId, []);
    }

    const history = this.checkHistory.get(monitorId);
    history.push({
      timestamp: Date.now(),
      ...result
    });

    // Keep history limited to 1000 entries
    if (history.length > 1000) {
      history.shift();
    }

    // Update change frequency tracking
    this.updateChangeFrequency(monitorId, result.changed || false);

    // Update last check time
    monitor.lastCheck = Date.now();

    // Calculate next check time using adaptive scheduling
    monitor.nextCheck = this.calculateNextCheckTime(monitorId, monitor, result);

    // Emit check-complete event
    this.emit('check-complete', {
      monitorId,
      url: monitor.url,
      changed: result.changed,
      nextCheckIn: monitor.nextCheck - Date.now(),
      timestamp: Date.now(),
      result
    });
  }

  /**
   * Update change frequency tracking
   * @private
   * @param {string} monitorId - Monitor ID
   * @param {boolean} changed - Whether change was detected
   * @returns {void}
   */
  updateChangeFrequency(monitorId, changed) {
    const freq = this.changeFrequency.get(monitorId);
    if (!freq) {
      return;
    }

    const now = Date.now();
    freq.checks++;
    if (changed) {
      freq.changes++;
    }

    // Add to time window
    freq.window.push({
      time: now,
      changed
    });

    // Remove old entries outside window
    const windowStart = now - this.options.changeFrequencyWindow;
    freq.window = freq.window.filter(entry => entry.time > windowStart);

    // Calculate frequency (changes per hour in the window)
    const windowSize = freq.window.length;
    const changesInWindow = freq.window.filter(e => e.changed).length;
    freq.frequency = windowSize > 0 ? (changesInWindow / windowSize) : 0;
  }

  /**
   * Calculate next check time using adaptive scheduling
   * @private
   * @param {string} monitorId - Monitor ID
   * @param {Object} monitor - Monitor config
   * @param {Object} result - Check result
   * @returns {number} Next check timestamp
   */
  calculateNextCheckTime(monitorId, monitor, result) {
    if (!this.options.enableAdaptivePolling) {
      return Date.now() + monitor.baseInterval;
    }

    // Get change frequency
    const freq = this.changeFrequency.get(monitorId);
    if (!freq) {
      return Date.now() + monitor.baseInterval;
    }

    // Determine change frequency category
    let frequencyMultiplier = ADAPTIVE_INTERVALS.CHANGE_FREQUENCY.MEDIUM;

    if (freq.frequency > 0.7) {
      frequencyMultiplier = ADAPTIVE_INTERVALS.CHANGE_FREQUENCY.VERY_HIGH;
    } else if (freq.frequency > 0.5) {
      frequencyMultiplier = ADAPTIVE_INTERVALS.CHANGE_FREQUENCY.HIGH;
    } else if (freq.frequency > 0.2) {
      frequencyMultiplier = ADAPTIVE_INTERVALS.CHANGE_FREQUENCY.MEDIUM;
    } else if (freq.frequency > 0.05) {
      frequencyMultiplier = ADAPTIVE_INTERVALS.CHANGE_FREQUENCY.LOW;
    } else {
      frequencyMultiplier = ADAPTIVE_INTERVALS.CHANGE_FREQUENCY.VERY_LOW;
    }

    // Calculate adaptive interval
    const adaptiveInterval = monitor.baseInterval * frequencyMultiplier;

    // Add small jitter to avoid thundering herd
    const jitter = Math.random() * (monitor.baseInterval * 0.1);

    return Date.now() + adaptiveInterval + jitter;
  }

  /**
   * Get current scheduler status
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      running: Boolean(this.scheduleLoop),
      totalMonitors: this.monitors.size,
      activeChecks: this.activeChecks.size,
      monitorDetails: Array.from(this.monitors.values()).map(m => ({
        monitorId: m.monitorId,
        url: m.url,
        priority: m.priority,
        enabled: m.enabled,
        lastCheck: m.lastCheck,
        nextCheck: m.nextCheck,
        changeFrequency: (this.changeFrequency.get(m.monitorId) || {}).frequency || 0
      })),
      stats: {
        checksScheduled: this.stats.checksScheduled,
        checksExecuted: this.stats.checksExecuted,
        checksSkipped: this.stats.checksSkipped,
        averageSchedulingTime: this.stats.averageSchedulingTime
      }
    };
  }

  /**
   * Get history for a monitor
   * @param {string} monitorId - Monitor ID
   * @param {number} limit - Limit number of entries
   * @returns {Array} Check history
   */
  getCheckHistory(monitorId, limit = 100) {
    const history = this.checkHistory.get(monitorId) || [];
    return history.slice(-limit);
  }

  /**
   * Update monitor priority
   * @param {string} monitorId - Monitor ID
   * @param {number} priority - New priority (1-5)
   * @returns {Object} Update result
   */
  updateMonitorPriority(monitorId, priority) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      return { success: false, error: 'Monitor not found' };
    }

    monitor.priority = Math.max(PRIORITY.IDLE, Math.min(PRIORITY.CRITICAL, priority));
    this.emit('monitor-priority-updated', { monitorId, priority: monitor.priority });
    return { success: true, monitorId, priority: monitor.priority };
  }

  /**
   * Pause monitoring for a monitor
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Pause result
   */
  pauseMonitor(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      return { success: false, error: 'Monitor not found' };
    }

    monitor.enabled = false;
    this.emit('monitor-paused', { monitorId });
    return { success: true, monitorId };
  }

  /**
   * Resume monitoring for a monitor
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Resume result
   */
  resumeMonitor(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      return { success: false, error: 'Monitor not found' };
    }

    monitor.enabled = true;
    monitor.nextCheck = Date.now(); // Check immediately on resume
    this.emit('monitor-resumed', { monitorId });
    return { success: true, monitorId };
  }
}

module.exports = {
  MonitorScheduler,
  PRIORITY,
  SCHEDULE_STRATEGY,
  ADAPTIVE_INTERVALS
};
