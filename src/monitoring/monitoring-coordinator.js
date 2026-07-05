/**
 * Monitoring Coordinator - Orchestrate across all active monitors
 *
 * Manages:
 * - Orchestration across all active monitors
 * - Aggregation of monitoring events
 * - Resource management (memory, CPU, connections)
 * - Health monitoring
 * - Graceful degradation under load
 *
 * @module src/monitoring/monitoring-coordinator
 * @requires events
 */

const EventEmitter = require('events');
const { MonitorScheduler, PRIORITY } = require('./monitor-scheduler');
const { TargetMonitor } = require('./target-monitor');

/**
 * Coordinator states
 */
const COORDINATOR_STATE = {
  INITIALIZING: 'initializing',
  READY: 'ready',
  RUNNING: 'running',
  DEGRADED: 'degraded',
  STOPPED: 'stopped'
};

/**
 * Resource limits and thresholds
 */
const RESOURCE_LIMITS = {
  MAX_MONITORS: 100,
  MAX_CONCURRENT_CHECKS: 15,
  MAX_MEMORY_PERCENT: 0.15, // 15% of process memory
  MAX_CPU_PERCENT: 0.25, // 25% CPU usage
  MEMORY_WARNING_THRESHOLD: 0.10, // 10% (warn)
  CPU_WARNING_THRESHOLD: 0.15, // 15% (warn)
  CHECK_QUEUE_WARNING: 20,
  CHECK_QUEUE_CRITICAL: 50
};

/**
 * Monitoring Coordinator
 * Central orchestration for all monitoring
 */
class MonitoringCoordinator extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxMonitors: options.maxMonitors || RESOURCE_LIMITS.MAX_MONITORS,
      maxConcurrentChecks: options.maxConcurrentChecks || RESOURCE_LIMITS.MAX_CONCURRENT_CHECKS,
      enableResourceManagement: options.enableResourceManagement !== false,
      resourceCheckInterval: options.resourceCheckInterval || 5000,
      aggregationWindow: options.aggregationWindow || 60000, // 1 minute
      ...options
    };

    // State management
    this.state = COORDINATOR_STATE.INITIALIZING;
    this.startTime = null;

    // Monitoring components
    this.scheduler = null;
    this.monitors = new Map(); // monitorId -> TargetMonitor instance
    this.monitorsByUrl = new Map(); // URL -> Set of monitorIds

    // Event aggregation
    this.eventQueue = [];
    this.eventAggregates = new Map(); // Hourly/daily aggregates
    this.eventAggregationTimer = null;

    // Resource tracking
    this.resourceMetrics = {
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: 0,
      pendingChecks: 0,
      overloadEvents: []
    };

    this.resourceCheckTimer = null;

    // Browser API reference
    this.browserApi = null;

    // Graceful degradation state
    this.degradationLevel = 0; // 0 = normal, 1 = warning, 2 = critical
    this.degradedMonitors = new Set();

    // Statistics
    this.stats = {
      totalMonitorsCreated: 0,
      totalChecksRun: 0,
      totalChangesDetected: 0,
      totalErrorsEncountered: 0,
      uptime: 0
    };

    this._initialize();
  }

  /**
   * Initialize the coordinator
   * @private
   * @returns {void}
   */
  _initialize() {
    try {
      // Initialize scheduler
      this.scheduler = new MonitorScheduler({
        maxConcurrentChecks: this.options.maxConcurrentChecks,
        ...this.options.scheduler
      });

      // Wire up scheduler events
      this.scheduler.on('check-scheduled', (data) => {
        this.emit('check-scheduled', data);
      });

      this.scheduler.on('check-start', (data) => {
        this.resourceMetrics.activeConnections++;
        this.emit('check-start', data);
      });

      this.scheduler.on('check-complete', async (data) => {
        this.resourceMetrics.activeConnections--;

        // Record check result in target monitor
        const monitor = this.monitors.get(data.monitorId);
        if (monitor) {
          // Record in scheduler
          this.scheduler.recordCheckResult(data.monitorId, {
            changed: data.changed,
            changeTypes: data.result?.changeTypes || [],
            changeScore: data.result?.changeScore || 0
          });
        }

        // Emit aggregated event
        this.recordEvent('check-complete', data);
        this.emit('check-complete', data);

        // Track statistics
        this.stats.totalChecksRun++;
        if (data.changed) {
          this.stats.totalChangesDetected++;
        }
      });

      // Initialize resource monitoring
      if (this.options.enableResourceManagement) {
        this.startResourceMonitoring();
      }

      // Initialize event aggregation
      this.startEventAggregation();

      this.state = COORDINATOR_STATE.READY;
      this.startTime = Date.now();

      this.emit('coordinator-initialized', {
        state: this.state,
        timestamp: Date.now()
      });
    } catch (error) {
      this.emit('initialization-error', {
        error: error.message,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Initialize browser API
   * @param {Object} browserApi - Browser API reference
   * @returns {Promise<void>}
   */
  async initializeBrowserApi(browserApi) {
    this.browserApi = browserApi;
  }

  /**
   * Add a target to monitor
   * @param {string} targetId - Unique target identifier
   * @param {string} targetUrl - URL to monitor
   * @param {Object} config - Monitor configuration
   * @returns {Promise<Object>} Result object
   */
  async addMonitor(targetId, targetUrl, config = {}) {
    if (this.monitors.size >= this.options.maxMonitors) {
      return {
        success: false,
        error: 'Maximum monitor limit reached',
        targetId
      };
    }

    if (this.monitors.has(targetId)) {
      return {
        success: false,
        error: 'Monitor already exists',
        targetId
      };
    }

    try {
      // Create target monitor
      const monitor = new TargetMonitor(targetId, targetUrl, {
        checkInterval: config.checkInterval || 60000,
        changeDetectionSensitivity: config.changeDetectionSensitivity || 0.1,
        ...config
      });

      // Initialize with browser API
      await monitor.initialize(this.browserApi);

      // Register with scheduler
      const schedulerResult = this.scheduler.registerMonitor(targetId, {
        url: targetUrl,
        priority: config.priority || PRIORITY.NORMAL,
        interval: config.checkInterval || 60000,
        ...config
      });

      if (!schedulerResult.success) {
        return schedulerResult;
      }

      // Wire up monitor events
      monitor.on('target_changed', (data) => {
        this.recordEvent('target-changed', data);
        this.emit('target-changed', data);
      });

      monitor.on('target_error', (data) => {
        this.stats.totalErrorsEncountered++;
        this.recordEvent('target-error', data);
        this.emit('target-error', data);
      });

      monitor.on('target_unchanged', (data) => {
        this.recordEvent('target-unchanged', data);
      });

      // Store monitor
      this.monitors.set(targetId, monitor);

      // Track by URL for quick lookup
      if (!this.monitorsByUrl.has(targetUrl)) {
        this.monitorsByUrl.set(targetUrl, new Set());
      }
      this.monitorsByUrl.get(targetUrl).add(targetId);

      this.stats.totalMonitorsCreated++;

      this.emit('monitor-added', {
        targetId,
        targetUrl,
        timestamp: Date.now()
      });

      return {
        success: true,
        targetId,
        targetUrl,
        monitorCount: this.monitors.size
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        targetId
      };
    }
  }

  /**
   * Remove a monitor
   * @param {string} targetId - Target ID
   * @returns {Object} Result object
   */
  removeMonitor(targetId) {
    const monitor = this.monitors.get(targetId);
    if (!monitor) {
      return {
        success: false,
        error: 'Monitor not found',
        targetId
      };
    }

    try {
      // Stop monitoring
      monitor.stopMonitoring();

      // Unregister from scheduler
      this.scheduler.unregisterMonitor(targetId);

      // Remove from URL map
      const url = monitor.targetUrl;
      if (this.monitorsByUrl.has(url)) {
        const set = this.monitorsByUrl.get(url);
        set.delete(targetId);
        if (set.size === 0) {
          this.monitorsByUrl.delete(url);
        }
      }

      // Remove from monitors map
      this.monitors.delete(targetId);

      this.emit('monitor-removed', {
        targetId,
        timestamp: Date.now()
      });

      return {
        success: true,
        targetId,
        monitorCount: this.monitors.size
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        targetId
      };
    }
  }

  /**
   * Start coordinated monitoring
   * @returns {void}
   */
  start() {
    if (this.state === COORDINATOR_STATE.RUNNING) {
      return;
    }

    this.state = COORDINATOR_STATE.RUNNING;

    // Start all monitors
    Array.from(this.monitors.values()).forEach(monitor => {
      monitor.startMonitoring();
    });

    // Start scheduler
    this.scheduler.start();

    this.emit('coordinator-started', {
      timestamp: Date.now(),
      monitorCount: this.monitors.size
    });
  }

  /**
   * Stop coordinated monitoring
   * @returns {void}
   */
  stop() {
    this.state = COORDINATOR_STATE.STOPPED;

    // Stop all monitors
    Array.from(this.monitors.values()).forEach(monitor => {
      monitor.stopMonitoring();
    });

    // Stop scheduler
    this.scheduler.stop();

    // Stop resource monitoring
    if (this.resourceCheckTimer) {
      clearInterval(this.resourceCheckTimer);
    }

    // Stop event aggregation
    if (this.eventAggregationTimer) {
      clearInterval(this.eventAggregationTimer);
    }

    this.emit('coordinator-stopped', {
      timestamp: Date.now(),
      stats: this.stats
    });
  }

  /**
   * Pause all monitoring
   * @returns {Object} Result object
   */
  pauseAll() {
    let paused = 0;

    Array.from(this.monitors.values()).forEach(monitor => {
      monitor.pauseMonitoring();
      paused++;
    });

    this.emit('all-monitoring-paused', {
      paused,
      timestamp: Date.now()
    });

    return {
      success: true,
      paused
    };
  }

  /**
   * Resume all monitoring
   * @returns {Object} Result object
   */
  resumeAll() {
    let resumed = 0;

    Array.from(this.monitors.values()).forEach(monitor => {
      monitor.resumeMonitoring();
      resumed++;
    });

    this.emit('all-monitoring-resumed', {
      resumed,
      timestamp: Date.now()
    });

    return {
      success: true,
      resumed
    };
  }

  /**
   * Start resource monitoring
   * @private
   * @returns {void}
   */
  startResourceMonitoring() {
    this.resourceCheckTimer = setInterval(() => {
      this.checkResourceUsage();
    }, this.options.resourceCheckInterval);
  }

  /**
   * Check resource usage and trigger degradation if needed
   * @private
   * @returns {void}
   */
  checkResourceUsage() {
    try {
      // Get process memory usage
      const memUsage = process.memoryUsage();
      const heapUsedPercent = memUsage.heapUsed / memUsage.heapTotal;

      // Estimate CPU usage (simplified - would need monitoring library for accuracy)
      const cpuUsage = process.cpuUsage();

      this.resourceMetrics.memoryUsage = heapUsedPercent;
      this.resourceMetrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to percentage

      // Determine degradation level
      let newDegradationLevel = 0;

      if (
        heapUsedPercent > RESOURCE_LIMITS.MAX_MEMORY_PERCENT ||
        this.resourceMetrics.cpuUsage > RESOURCE_LIMITS.MAX_CPU_PERCENT
      ) {
        newDegradationLevel = 2; // Critical
      } else if (
        heapUsedPercent > RESOURCE_LIMITS.MEMORY_WARNING_THRESHOLD ||
        this.resourceMetrics.cpuUsage > RESOURCE_LIMITS.CPU_WARNING_THRESHOLD
      ) {
        newDegradationLevel = 1; // Warning
      }

      // Handle degradation state changes
      if (newDegradationLevel !== this.degradationLevel) {
        this.degradationLevel = newDegradationLevel;
        this.handleDegradation(newDegradationLevel);
      }

      // Emit resource metrics event
      this.emit('resource-metrics', {
        memory: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          percent: heapUsedPercent
        },
        cpu: this.resourceMetrics.cpuUsage,
        activeConnections: this.resourceMetrics.activeConnections,
        degradationLevel: this.degradationLevel,
        timestamp: Date.now()
      });
    } catch (error) {
      this.emit('resource-check-error', {
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle graceful degradation
   * @private
   * @param {number} level - Degradation level (0-2)
   * @returns {void}
   */
  handleDegradation(level) {
    if (level === 0) {
      // Normal operation
      this.state = COORDINATOR_STATE.RUNNING;
      this.degradedMonitors.clear();
      this.emit('degradation-cleared', {
        timestamp: Date.now()
      });
    } else if (level === 1) {
      // Warning - reduce check frequency for low-priority monitors
      this.state = COORDINATOR_STATE.DEGRADED;

      Array.from(this.monitors.values()).forEach(monitor => {
        if ((monitor.options.priority || PRIORITY.NORMAL) < PRIORITY.HIGH) {
          this.degradedMonitors.add(monitor.targetId);
          monitor.pauseMonitoring();
        }
      });

      this.emit('degradation-warning', {
        affectedMonitors: this.degradedMonitors.size,
        timestamp: Date.now()
      });
    } else if (level === 2) {
      // Critical - pause all low and normal priority monitors
      this.state = COORDINATOR_STATE.DEGRADED;

      Array.from(this.monitors.values()).forEach(monitor => {
        if ((monitor.options.priority || PRIORITY.NORMAL) <= PRIORITY.NORMAL) {
          this.degradedMonitors.add(monitor.targetId);
          monitor.pauseMonitoring();
        }
      });

      this.emit('degradation-critical', {
        affectedMonitors: this.degradedMonitors.size,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Start event aggregation
   * @private
   * @returns {void}
   */
  startEventAggregation() {
    this.eventAggregationTimer = setInterval(() => {
      this.aggregateEvents();
    }, this.options.aggregationWindow);
  }

  /**
   * Record an event
   * @private
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @returns {void}
   */
  recordEvent(eventType, data) {
    this.eventQueue.push({
      type: eventType,
      data,
      timestamp: Date.now()
    });

    // Keep queue limited to last 10000 events
    if (this.eventQueue.length > 10000) {
      this.eventQueue.shift();
    }
  }

  /**
   * Aggregate events and emit summary
   * @private
   * @returns {void}
   */
  aggregateEvents() {
    if (this.eventQueue.length === 0) {
      return;
    }

    const now = Date.now();
    const windowStart = now - this.options.aggregationWindow;

    // Filter events in the current window
    const windowEvents = this.eventQueue.filter(e => e.timestamp > windowStart);

    if (windowEvents.length === 0) {
      return;
    }

    // Aggregate by type
    const aggregate = {
      timestamp: now,
      windowSize: this.options.aggregationWindow,
      totalEvents: windowEvents.length,
      byType: {}
    };

    windowEvents.forEach(event => {
      if (!aggregate.byType[event.type]) {
        aggregate.byType[event.type] = 0;
      }
      aggregate.byType[event.type]++;
    });

    // Emit aggregated event
    this.emit('events-aggregated', aggregate);
  }

  /**
   * Get coordinator status
   * @returns {Object} Status object
   */
  getStatus() {
    const monitorStatus = Array.from(this.monitors.values()).map(monitor => ({
      targetId: monitor.targetId,
      targetUrl: monitor.targetUrl,
      state: monitor.state,
      checkCount: monitor.checkCount,
      errorCount: monitor.errorCount,
      lastCheck: monitor.lastCheck,
      metrics: monitor.getMetrics()
    }));

    return {
      state: this.state,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      totalMonitors: this.monitors.size,
      monitorDetails: monitorStatus,
      resourceMetrics: this.resourceMetrics,
      degradationLevel: this.degradationLevel,
      degradedMonitors: Array.from(this.degradedMonitors),
      stats: this.stats,
      scheduler: this.scheduler.getStatus()
    };
  }

  /**
   * Get events recorded in the current window
   * @param {number} limit - Maximum events to return
   * @returns {Array} Events array
   */
  getEvents(limit = 1000) {
    return this.eventQueue.slice(-limit);
  }

  /**
   * Export monitoring data
   * @returns {Object} Exportable data
   */
  exportData() {
    return {
      exportTime: Date.now(),
      coordinatorStatus: this.getStatus(),
      events: this.eventQueue,
      monitorDetails: Array.from(this.monitors.values()).map(monitor => ({
        targetId: monitor.targetId,
        targetUrl: monitor.targetUrl,
        status: monitor.getStatus(),
        changeHistory: monitor.getChangeHistory(),
        metrics: monitor.getMetrics()
      }))
    };
  }
}

module.exports = {
  MonitoringCoordinator,
  COORDINATOR_STATE,
  RESOURCE_LIMITS
};
