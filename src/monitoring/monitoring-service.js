/**
 * Monitoring Service - Main orchestration for competitive website monitoring
 * Coordinates monitor management, change detection, and alert dispatch
 * @module src/monitoring/monitoring-service
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { MonitorManager, MONITOR_STATUS } = require('./monitor-manager');
const { ChangeDetector } = require('./change-detector');
const { AlertDispatcher } = require('./alert-dispatcher');

/**
 * Service Status
 */
const SERVICE_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  ERROR: 'error'
};

/**
 * Monitoring Service Class
 * Main service coordinating monitoring operations
 */
class MonitoringService extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      dataDir: options.dataDir || path.join(process.cwd(), '.basset-hound', 'monitoring'),
      checkInterval: options.checkInterval || 60000, // 1 minute
      enableAutoCheck: options.enableAutoCheck !== false,
      maxConcurrentChecks: options.maxConcurrentChecks || 10,
      snapshotHistoryLimit: options.snapshotHistoryLimit || 50,
      ...options
    };

    // Initialize managers
    this.monitorManager = new MonitorManager({
      dataDir: this.options.dataDir,
      ...options.monitorManager
    });

    this.changeDetector = new ChangeDetector({
      ...options.changeDetector
    });

    this.alertDispatcher = new AlertDispatcher({
      ...options.alertDispatcher
    });

    // State management
    this.status = SERVICE_STATUS.IDLE;
    this.checkLoop = null;
    this.snapshots = new Map(); // URL -> [snapshots]
    this.changes = new Map(); // monitorId -> [changes]
    this.currentlyChecking = new Set();

    // Statistics
    this.stats = {
      checksRun: 0,
      changesDetected: 0,
      alertsSent: 0,
      errorsEncountered: 0,
      startTime: null
    };

    // Wire up event handlers
    this.setupEventHandlers();

    // Create data directory
    if (!fs.existsSync(this.options.dataDir)) {
      fs.mkdirSync(this.options.dataDir, { recursive: true });
    }

    // Load snapshots from disk
    this.loadSnapshots();
  }

  /**
   * Setup event handlers for sub-components
   * @returns {void}
   */
  setupEventHandlers() {
    this.monitorManager.on('monitor-added', (monitor) => {
      this.emit('monitor-added', monitor);
    });

    this.monitorManager.on('monitor-removed', (data) => {
      // Clean up snapshots and history
      this.snapshots.delete(data.id);
      this.changes.delete(data.id);
      this.emit('monitor-removed', data);
    });

    this.monitorManager.on('monitor-updated', (monitor) => {
      this.emit('monitor-updated', monitor);
    });

    this.alertDispatcher.on('alert-sent', (data) => {
      this.stats.alertsSent += 1;
      this.emit('alert-sent', data);
    });
  }

  /**
   * Start monitoring service
   * @returns {Promise<void>}
   */
  async start() {
    if (this.status === SERVICE_STATUS.RUNNING) {
      return; // Already running
    }

    this.status = SERVICE_STATUS.RUNNING;
    this.stats.startTime = Date.now();

    this.emit('service-started', {
      timestamp: Date.now(),
      monitorsCount: this.monitorManager.monitors.size
    });

    // Start auto-check loop if enabled
    if (this.options.enableAutoCheck) {
      this.startCheckLoop();
    }
  }

  /**
   * Stop monitoring service
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.status === SERVICE_STATUS.IDLE) {
      return; // Already stopped
    }

    this.status = SERVICE_STATUS.IDLE;

    if (this.checkLoop) {
      clearInterval(this.checkLoop);
      this.checkLoop = null;
    }

    this.currentlyChecking.clear();

    this.emit('service-stopped', {
      timestamp: Date.now(),
      checksRun: this.stats.checksRun
    });
  }

  /**
   * Pause monitoring service
   * @returns {void}
   */
  pause() {
    if (this.status !== SERVICE_STATUS.RUNNING) {
      return;
    }

    this.status = SERVICE_STATUS.PAUSED;

    if (this.checkLoop) {
      clearInterval(this.checkLoop);
      this.checkLoop = null;
    }

    this.emit('service-paused', { timestamp: Date.now() });
  }

  /**
   * Resume monitoring service
   * @returns {void}
   */
  resume() {
    if (this.status !== SERVICE_STATUS.PAUSED) {
      return;
    }

    this.status = SERVICE_STATUS.RUNNING;
    this.startCheckLoop();

    this.emit('service-resumed', { timestamp: Date.now() });
  }

  /**
   * Start the check loop
   * @returns {void}
   */
  startCheckLoop() {
    if (this.checkLoop) {
      return; // Already running
    }

    this.checkLoop = setInterval(() => {
      this.runScheduledChecks().catch((error) => {
        this.emit('check-error', { error: error.message });
      });
    }, this.options.checkInterval);
  }

  /**
   * Run all monitors that are due for checking
   * @returns {Promise<Object>} Check results
   */
  async runScheduledChecks() {
    const monitorsDue = this.monitorManager.getMonitorsDueForCheck();

    if (monitorsDue.length === 0) {
      return { checksRun: 0 };
    }

    // Limit concurrent checks
    const toCheck = monitorsDue.slice(0, this.options.maxConcurrentChecks);

    const results = await Promise.allSettled(
      toCheck.map(monitor => this.checkMonitor(monitor.id))
    );

    let successCount = 0;
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount += 1;
      }
    }

    return {
      checksRun: toCheck.length,
      successCount,
      failureCount: toCheck.length - successCount
    };
  }

  /**
   * Manually check a monitor
   * @param {string} monitorId - Monitor ID
   * @param {Object} captureData - Captured website data
   * @returns {Promise<Object>} Check result
   */
  async checkMonitor(monitorId, captureData = null) {
    if (this.currentlyChecking.has(monitorId)) {
      return {
        success: false,
        error: 'Monitor check already in progress',
        monitorId
      };
    }

    this.currentlyChecking.add(monitorId);

    try {
      const monitor = this.monitorManager.getMonitor(monitorId);

      // If no capture data provided, this would be fetched from browser
      // For now, we'll return an error as capture requires browser integration
      if (!captureData) {
        return {
          success: false,
          error: 'Capture data required - browser integration needed',
          monitorId
        };
      }

      // Create snapshot
      const currentSnapshot = this.changeDetector.createSnapshot(captureData);

      // Get previous snapshot
      const snapshots = this.snapshots.get(monitorId) || [];
      const previousSnapshot = snapshots[snapshots.length - 1];

      // Detect changes if we have a previous snapshot
      let changeResult = null;
      if (previousSnapshot) {
        changeResult = this.changeDetector.detectChanges(previousSnapshot, currentSnapshot);
      }

      // Store snapshot
      if (!this.snapshots.has(monitorId)) {
        this.snapshots.set(monitorId, []);
      }
      const monitorSnapshots = this.snapshots.get(monitorId);
      monitorSnapshots.push(currentSnapshot);

      // Keep only recent snapshots
      if (monitorSnapshots.length > this.options.snapshotHistoryLimit) {
        monitorSnapshots.shift();
      }

      // Store changes
      if (changeResult && changeResult.changeDetected) {
        if (!this.changes.has(monitorId)) {
          this.changes.set(monitorId, []);
        }
        this.changes.get(monitorId).push(changeResult);

        this.stats.changesDetected += 1;

        // Send alert if changes detected
        const alertResult = await this.dispatchAlert(monitor, changeResult);

        this.emit('change-detected', {
          monitorId,
          monitorName: monitor.name,
          changeResult,
          alertResult,
          timestamp: Date.now()
        });
      }

      // Update monitor check status
      this.monitorManager.updateCheckStatus(monitorId, {
        success: true
      });

      this.stats.checksRun += 1;

      return {
        success: true,
        monitorId,
        changeDetected: changeResult?.changeDetected || false,
        changeResult,
        timestamp: Date.now()
      };
    } catch (error) {
      this.stats.errorsEncountered += 1;

      this.monitorManager.updateCheckStatus(monitorId, {
        success: false,
        error: error.message
      });

      this.emit('check-error', {
        monitorId,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        monitorId
      };
    } finally {
      this.currentlyChecking.delete(monitorId);
    }
  }

  /**
   * Dispatch alert for detected changes
   * @param {Object} monitor - Monitor configuration
   * @param {Object} changeResult - Change detection result
   * @returns {Promise<Object>} Alert dispatch result
   */
  async dispatchAlert(monitor, changeResult) {
    try {
      // Check alert configuration
      const alertConfig = monitor.alerts;

      // Skip if no alert channels configured
      if (!alertConfig.enableEmail && !alertConfig.enableWebhook &&
          !alertConfig.enableSlack && !alertConfig.enableTeams) {
        return { success: false, error: 'No alert channels configured' };
      }

      // Determine severity based on change type
      let severity = 'low';
      if (changeResult.severity) {
        severity = changeResult.severity;
      }

      // Send alert
      const alertResult = await this.alertDispatcher.sendAlert({
        monitorId: monitor.id,
        monitorName: monitor.name,
        url: monitor.url,
        changeType: changeResult.changeSummary.join(', '),
        severity,
        changes: changeResult.details,
        alertConfig
      });

      return alertResult;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get change history for a monitor
   * @param {string} monitorId - Monitor ID
   * @param {Object} [options={}] - Query options
   * @returns {Array} Change history
   */
  getChangeHistory(monitorId, options = {}) {
    const changes = this.changes.get(monitorId) || [];
    const { limit = 20, offset = 0, changeType = null } = options;

    let filtered = changes;
    if (changeType) {
      filtered = changes.filter(c => c.changeSummary.includes(changeType));
    }

    return filtered
      .slice(-limit - offset, -offset || undefined)
      .reverse(); // Most recent first
  }

  /**
   * Get snapshot history for a monitor
   * @param {string} monitorId - Monitor ID
   * @param {Object} [options={}] - Query options
   * @returns {Array} Snapshot history
   */
  getSnapshotHistory(monitorId, options = {}) {
    const snapshots = this.snapshots.get(monitorId) || [];
    const { limit = 10, offset = 0 } = options;

    return snapshots
      .slice(-limit - offset, -offset || undefined)
      .reverse() // Most recent first
      .map(s => ({
        timestamp: s.timestamp,
        url: s.url,
        statusCode: s.statusCode,
        contentLength: s.content.length,
        domSize: s.performance.domSize,
        loadTime: s.performance.loadTime
      }));
  }

  /**
   * Save snapshots to disk
   * @returns {void}
   */
  saveSnapshots() {
    try {
      const snapshotDir = path.join(this.options.dataDir, 'snapshots');
      if (!fs.existsSync(snapshotDir)) {
        fs.mkdirSync(snapshotDir, { recursive: true });
      }

      for (const [monitorId, snapshots] of this.snapshots.entries()) {
        const file = path.join(snapshotDir, `${monitorId}.json`);
        fs.writeFileSync(file, JSON.stringify(snapshots, null, 2), 'utf-8');
      }
    } catch (error) {
      this.emit('error', { type: 'snapshot-save-failed', error });
    }
  }

  /**
   * Load snapshots from disk
   * @returns {void}
   */
  loadSnapshots() {
    try {
      const snapshotDir = path.join(this.options.dataDir, 'snapshots');
      if (!fs.existsSync(snapshotDir)) {
        return;
      }

      const files = fs.readdirSync(snapshotDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(snapshotDir, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const snapshots = JSON.parse(data);
          const monitorId = file.replace('.json', '');
          this.snapshots.set(monitorId, snapshots);
        }
      }
    } catch (error) {
      this.emit('error', { type: 'snapshot-load-failed', error });
    }
  }

  /**
   * Get service statistics
   * @returns {Object} Service stats
   */
  getStats() {
    const monitors = this.monitorManager.monitors;
    const activeMonitors = Array.from(monitors.values())
      .filter(m => m.status === MONITOR_STATUS.ACTIVE).length;

    return {
      serviceStatus: this.status,
      startTime: this.stats.startTime,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
      monitors: {
        total: monitors.size,
        active: activeMonitors,
        paused: monitors.size - activeMonitors
      },
      performance: {
        checksRun: this.stats.checksRun,
        changesDetected: this.stats.changesDetected,
        alertsSent: this.stats.alertsSent,
        errors: this.stats.errorsEncountered,
        currentlyChecking: this.currentlyChecking.size
      },
      snapshotStorage: {
        monitors: this.snapshots.size,
        totalSnapshots: Array.from(this.snapshots.values())
          .reduce((sum, snapshots) => sum + snapshots.length, 0)
      }
    };
  }

  /**
   * Get detailed monitor status
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Monitor status
   */
  getMonitorStatus(monitorId) {
    const monitor = this.monitorManager.getMonitor(monitorId);
    const stats = this.monitorManager.getMonitorStats(monitorId);
    const snapshots = this.snapshots.get(monitorId) || [];
    const changes = this.changes.get(monitorId) || [];

    return {
      ...monitor,
      stats,
      snapshots: snapshots.length,
      changes: changes.length,
      isCurrentlyChecking: this.currentlyChecking.has(monitorId)
    };
  }

  /**
   * Export monitoring data
   * @returns {Object} All monitoring data
   */
  exportData() {
    return {
      version: '1.0',
      exportedAt: Date.now(),
      monitors: this.monitorManager.exportMonitors(),
      snapshots: Object.fromEntries(this.snapshots),
      changes: Object.fromEntries(this.changes),
      stats: this.getStats()
    };
  }

  /**
   * Cleanup old data
   * @param {Object} [options={}] - Cleanup options
   * @returns {Object} Cleanup result
   */
  cleanup(options = {}) {
    const {
      olderThanDays = 30,
      keepMinSnapshots = 5
    } = options;

    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let snapshotsRemoved = 0;
    let changesRemoved = 0;

    // Clean old snapshots
    for (const [monitorId, snapshots] of this.snapshots.entries()) {
      const initialCount = snapshots.length;
      const filtered = snapshots.filter(s =>
        s.timestamp > cutoffTime || snapshots.length <= keepMinSnapshots
      );
      if (filtered.length < initialCount) {
        snapshotsRemoved += initialCount - filtered.length;
        this.snapshots.set(monitorId, filtered);
      }
    }

    // Clean old changes
    for (const [monitorId, changes] of this.changes.entries()) {
      const initialCount = changes.length;
      const filtered = changes.filter(c => c.timestamp > cutoffTime);
      if (filtered.length < initialCount) {
        changesRemoved += initialCount - filtered.length;
        this.changes.set(monitorId, filtered);
      }
    }

    this.saveSnapshots();

    return {
      snapshotsRemoved,
      changesRemoved,
      timestamp: Date.now()
    };
  }
}

module.exports = {
  MonitoringService,
  SERVICE_STATUS
};
