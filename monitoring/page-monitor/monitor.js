/**
 * Basset Hound Browser - Page Monitoring & Change Detection
 *
 * Provides advanced page monitoring capabilities including:
 * - Multiple detection methods (DOM diff, screenshot diff, content hash)
 * - Change notification system with detailed reports
 * - Scheduled monitoring with flexible intervals
 * - Change history and timeline tracking
 * - Selective monitoring (specific elements/zones)
 * - Performance optimization with incremental updates
 * - Export change reports in various formats
 *
 * This file hosts the PageMonitor lifecycle logic. Pure change-detection and
 * report-generation logic live in sibling modules and are mixed onto the
 * prototype below (see Object.assign at the bottom).
 */

const { ipcMain } = require('electron');

const { DETECTION_METHODS, CHANGE_TYPES, MONITOR_STATUS } = require('./constants');
const changeDetectors = require('./change-detectors');
const reportGenerators = require('./report-generators');

/**
 * PageMonitor class for tracking web page changes
 */
class PageMonitor {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.monitors = new Map(); // monitorId -> monitor config
    this.snapshots = new Map(); // monitorId -> snapshots array
    this.changeHistory = new Map(); // monitorId -> changes array
    this.schedules = new Map(); // monitorId -> interval handle
    this.zones = new Map(); // monitorId -> zones array
    this.pendingRequests = new Map(); // requestId -> resolver
    this.requestIdCounter = 0;
    this.monitorIdCounter = 0;
    this.statistics = new Map(); // monitorId -> stats

    this.setupIPCListeners();
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `monitor-req-${Date.now()}-${++this.requestIdCounter}`;
  }

  /**
   * Generate unique monitor ID
   */
  generateMonitorId() {
    return `monitor-${Date.now()}-${++this.monitorIdCounter}`;
  }

  /**
   * Setup IPC listeners for monitor responses
   */
  setupIPCListeners() {
    const responseChannels = [
      'page-snapshot-response',
      'page-diff-response',
      'element-snapshot-response',
      'screenshot-compare-response',
      'content-hash-response'
    ];

    responseChannels.forEach(channel => {
      ipcMain.on(channel, (event, data) => {
        const { requestId, ...result } = data;
        const resolver = this.pendingRequests.get(requestId);
        if (resolver) {
          resolver(result);
          this.pendingRequests.delete(requestId);
        }
      });
    });
  }

  /**
   * Start monitoring a page
   * @param {Object} config - Monitor configuration
   * @returns {Promise<Object>} Monitor result with ID
   */
  async startMonitoring(config = {}) {
    const {
      url,
      methods = [DETECTION_METHODS.HYBRID],
      interval = 60000, // Default: 1 minute
      zones = [], // Specific elements to monitor
      threshold = 0.1, // Sensitivity threshold
      notifyOnChange = true,
      captureScreenshots = true,
      keepHistory = true,
      maxHistorySize = 100,
      options = {}
    } = config;

    try {
      const monitorId = this.generateMonitorId();
      const currentUrl = this.mainWindow.webContents.getURL();

      // Validate URL if provided
      if (url && url !== currentUrl) {
        return {
          success: false,
          error: `Current URL (${currentUrl}) does not match monitor URL (${url})`
        };
      }

      // Create initial snapshot
      const initialSnapshot = await this.captureSnapshot({
        methods,
        zones,
        captureScreenshots,
        options
      });

      if (!initialSnapshot.success) {
        return initialSnapshot;
      }

      // Create monitor configuration
      const monitor = {
        id: monitorId,
        url: currentUrl,
        methods,
        interval,
        zones,
        threshold,
        notifyOnChange,
        captureScreenshots,
        keepHistory,
        maxHistorySize,
        options,
        status: MONITOR_STATUS.ACTIVE,
        createdAt: new Date().toISOString(),
        lastCheck: new Date().toISOString(),
        checkCount: 1,
        changeCount: 0
      };

      this.monitors.set(monitorId, monitor);
      this.snapshots.set(monitorId, [initialSnapshot.snapshot]);
      this.changeHistory.set(monitorId, []);
      this.zones.set(monitorId, zones);
      this.statistics.set(monitorId, {
        totalChecks: 1,
        totalChanges: 0,
        lastChange: null,
        averageCheckDuration: 0,
        detectionRate: 0
      });

      // Schedule monitoring if interval is set
      if (interval > 0) {
        this.scheduleMonitoring(monitorId);
      }

      return {
        success: true,
        monitorId,
        monitor,
        initialSnapshot: initialSnapshot.snapshot
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop monitoring a page
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Stop result
   */
  stopMonitoring(monitorId) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: `Monitor not found: ${monitorId}`
      };
    }

    // Clear schedule
    if (this.schedules.has(monitorId)) {
      clearInterval(this.schedules.get(monitorId));
      this.schedules.delete(monitorId);
    }

    const monitor = this.monitors.get(monitorId);
    monitor.status = MONITOR_STATUS.STOPPED;
    monitor.stoppedAt = new Date().toISOString();

    return {
      success: true,
      monitorId,
      monitor,
      statistics: this.statistics.get(monitorId)
    };
  }

  /**
   * Pause monitoring
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Pause result
   */
  pauseMonitoring(monitorId) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: `Monitor not found: ${monitorId}`
      };
    }

    // Clear schedule but keep monitor
    if (this.schedules.has(monitorId)) {
      clearInterval(this.schedules.get(monitorId));
      this.schedules.delete(monitorId);
    }

    const monitor = this.monitors.get(monitorId);
    monitor.status = MONITOR_STATUS.PAUSED;
    monitor.pausedAt = new Date().toISOString();

    return {
      success: true,
      monitorId,
      monitor
    };
  }

  /**
   * Resume monitoring
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Resume result
   */
  resumeMonitoring(monitorId) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: `Monitor not found: ${monitorId}`
      };
    }

    const monitor = this.monitors.get(monitorId);

    if (monitor.status !== MONITOR_STATUS.PAUSED) {
      return {
        success: false,
        error: `Monitor is not paused: ${monitorId}`
      };
    }

    monitor.status = MONITOR_STATUS.ACTIVE;
    monitor.resumedAt = new Date().toISOString();

    // Reschedule monitoring
    if (monitor.interval > 0) {
      this.scheduleMonitoring(monitorId);
    }

    return {
      success: true,
      monitorId,
      monitor
    };
  }

  /**
   * Schedule periodic monitoring
   * @param {string} monitorId - Monitor ID
   */
  scheduleMonitoring(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      return;
    }

    // Clear existing schedule
    if (this.schedules.has(monitorId)) {
      clearInterval(this.schedules.get(monitorId));
    }

    // Create new schedule
    const intervalHandle = setInterval(async () => {
      if (monitor.status === MONITOR_STATUS.ACTIVE) {
        await this.checkForChanges(monitorId);
      }
    }, monitor.interval);

    this.schedules.set(monitorId, intervalHandle);
  }

  /**
   * Capture page snapshot
   * @param {Object} options - Snapshot options
   * @returns {Promise<Object>} Snapshot result
   */
  async captureSnapshot(options = {}) {
    const {
      methods = [DETECTION_METHODS.HYBRID],
      zones = [],
      captureScreenshots = true,
      options: snapshotOptions = {}
    } = options;

    const requestId = this.generateRequestId();
    const startTime = Date.now();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);

      this.mainWindow.webContents.send('capture-page-snapshot', {
        requestId,
        methods,
        zones,
        captureScreenshots,
        options: snapshotOptions
      });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({
            success: false,
            error: 'Snapshot capture timeout',
            duration: Date.now() - startTime
          });
        }
      }, 60000);
    });
  }

  /**
   * Check for changes
   * @param {string} monitorId - Monitor ID
   * @returns {Promise<Object>} Check result with changes
   */
  async checkForChanges(monitorId) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: `Monitor not found: ${monitorId}`
      };
    }

    const monitor = this.monitors.get(monitorId);
    const startTime = Date.now();

    try {
      // Capture new snapshot
      const newSnapshot = await this.captureSnapshot({
        methods: monitor.methods,
        zones: monitor.zones,
        captureScreenshots: monitor.captureScreenshots,
        options: monitor.options
      });

      if (!newSnapshot.success) {
        monitor.status = MONITOR_STATUS.ERROR;
        monitor.lastError = newSnapshot.error;
        return newSnapshot;
      }

      // Get previous snapshot
      const snapshots = this.snapshots.get(monitorId);
      const previousSnapshot = snapshots[snapshots.length - 1];

      // Compare snapshots
      const comparison = await this.compareSnapshots(
        previousSnapshot,
        newSnapshot.snapshot,
        {
          methods: monitor.methods,
          threshold: monitor.threshold,
          zones: monitor.zones
        }
      );

      const duration = Date.now() - startTime;

      // Update statistics
      const stats = this.statistics.get(monitorId);
      stats.totalChecks++;
      stats.averageCheckDuration =
        (stats.averageCheckDuration * (stats.totalChecks - 1) + duration) / stats.totalChecks;

      if (comparison.hasChanges) {
        stats.totalChanges++;
        stats.lastChange = new Date().toISOString();
        stats.detectionRate = stats.totalChanges / stats.totalChecks;

        // Record change
        const change = {
          id: `change-${Date.now()}-${stats.totalChanges}`,
          monitorId,
          timestamp: new Date().toISOString(),
          changes: comparison.changes,
          summary: comparison.summary,
          significance: comparison.significance,
          previousSnapshot: previousSnapshot.id,
          currentSnapshot: newSnapshot.snapshot.id
        };

        // Add to change history
        const history = this.changeHistory.get(monitorId);
        history.push(change);

        // Limit history size
        if (monitor.keepHistory && history.length > monitor.maxHistorySize) {
          history.shift();
        }

        // Update monitor
        monitor.changeCount++;
        monitor.lastChange = change.timestamp;

        // Notify if enabled
        if (monitor.notifyOnChange) {
          this.notifyChange(monitorId, change);
        }
      }

      // Add new snapshot
      snapshots.push(newSnapshot.snapshot);

      // Limit snapshot history
      if (snapshots.length > monitor.maxHistorySize) {
        snapshots.shift();
      }

      // Update monitor
      monitor.lastCheck = new Date().toISOString();
      monitor.checkCount++;

      return {
        success: true,
        monitorId,
        hasChanges: comparison.hasChanges,
        changes: comparison.changes,
        summary: comparison.summary,
        duration,
        statistics: stats
      };
    } catch (error) {
      monitor.status = MONITOR_STATUS.ERROR;
      monitor.lastError = error.message;
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Notify about changes
   */
  notifyChange(monitorId, change) {
    const monitor = this.monitors.get(monitorId);

    this.mainWindow.webContents.send('page-change-notification', {
      monitorId,
      url: monitor.url,
      change,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get page changes
   * @param {string} monitorId - Monitor ID
   * @param {Object} options - Query options
   * @returns {Object} Changes result
   */
  getPageChanges(monitorId, options = {}) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: `Monitor not found: ${monitorId}`
      };
    }

    const {
      limit = 50,
      offset = 0,
      type = null,
      since = null,
      until = null
    } = options;

    let changes = this.changeHistory.get(monitorId) || [];

    // Filter by type
    if (type) {
      changes = changes.filter(change =>
        change.changes[type] && change.changes[type].length > 0
      );
    }

    // Filter by time range
    if (since) {
      changes = changes.filter(change =>
        new Date(change.timestamp) >= new Date(since)
      );
    }

    if (until) {
      changes = changes.filter(change =>
        new Date(change.timestamp) <= new Date(until)
      );
    }

    // Apply pagination
    const total = changes.length;
    const paginatedChanges = changes.slice(offset, offset + limit);

    return {
      success: true,
      monitorId,
      changes: paginatedChanges,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  }

  /**
   * Compare page versions
   * @param {string} monitorId - Monitor ID
   * @param {string} version1Id - First version ID
   * @param {string} version2Id - Second version ID
   * @returns {Promise<Object>} Comparison result
   */
  async comparePageVersions(monitorId, version1Id, version2Id) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: `Monitor not found: ${monitorId}`
      };
    }

    const snapshots = this.snapshots.get(monitorId);
    const snapshot1 = snapshots.find(s => s.id === version1Id);
    const snapshot2 = snapshots.find(s => s.id === version2Id);

    if (!snapshot1 || !snapshot2) {
      return {
        success: false,
        error: 'One or both versions not found'
      };
    }

    const monitor = this.monitors.get(monitorId);
    const comparison = await this.compareSnapshots(snapshot1, snapshot2, {
      methods: monitor.methods,
      threshold: monitor.threshold,
      zones: monitor.zones
    });

    return {
      success: true,
      monitorId,
      version1: {
        id: version1Id,
        timestamp: snapshot1.timestamp
      },
      version2: {
        id: version2Id,
        timestamp: snapshot2.timestamp
      },
      comparison
    };
  }

  /**
   * Get monitoring schedule
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Schedule information
   */
  getMonitoringSchedule(monitorId) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: `Monitor not found: ${monitorId}`
      };
    }

    const monitor = this.monitors.get(monitorId);
    const isScheduled = this.schedules.has(monitorId);

    return {
      success: true,
      monitorId,
      schedule: {
        interval: monitor.interval,
        active: isScheduled,
        status: monitor.status,
        lastCheck: monitor.lastCheck,
        nextCheck: isScheduled ?
          new Date(new Date(monitor.lastCheck).getTime() + monitor.interval).toISOString() :
          null,
        checkCount: monitor.checkCount
      }
    };
  }

  /**
   * Configure change detection
   * @param {string} monitorId - Monitor ID
   * @param {Object} config - Detection configuration
   * @returns {Object} Configuration result
   */
  configureChangeDetection(monitorId, config = {}) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: `Monitor not found: ${monitorId}`
      };
    }

    const monitor = this.monitors.get(monitorId);
    const {
      methods,
      threshold,
      interval,
      notifyOnChange,
      captureScreenshots
    } = config;

    // Update configuration
    if (methods !== undefined) {
      monitor.methods = methods;
    }
    if (threshold !== undefined) {
      monitor.threshold = threshold;
    }
    if (interval !== undefined) {
      monitor.interval = interval;
      // Reschedule if active
      if (monitor.status === MONITOR_STATUS.ACTIVE) {
        this.scheduleMonitoring(monitorId);
      }
    }
    if (notifyOnChange !== undefined) {
      monitor.notifyOnChange = notifyOnChange;
    }
    if (captureScreenshots !== undefined) {
      monitor.captureScreenshots = captureScreenshots;
    }

    return {
      success: true,
      monitorId,
      monitor
    };
  }

  /**
   * Get monitoring statistics
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Statistics result
   */
  getMonitoringStats(monitorId) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: `Monitor not found: ${monitorId}`
      };
    }

    const monitor = this.monitors.get(monitorId);
    const stats = this.statistics.get(monitorId);
    const changes = this.changeHistory.get(monitorId) || [];

    // Calculate additional statistics
    const changesByType = {};
    changes.forEach(change => {
      if (change.summary && change.summary.byType) {
        Object.entries(change.summary.byType).forEach(([type, count]) => {
          changesByType[type] = (changesByType[type] || 0) + count;
        });
      }
    });

    const uptime = new Date() - new Date(monitor.createdAt);
    const avgInterval = monitor.checkCount > 1 ?
      uptime / (monitor.checkCount - 1) :
      monitor.interval;

    return {
      success: true,
      monitorId,
      statistics: {
        ...stats,
        changesByType,
        uptime,
        avgInterval,
        status: monitor.status,
        url: monitor.url
      }
    };
  }

  /**
   * Add monitoring zone
   * @param {string} monitorId - Monitor ID
   * @param {Object} zone - Zone configuration
   * @returns {Object} Add result
   */
  addMonitoringZone(monitorId, zone) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: `Monitor not found: ${monitorId}`
      };
    }

    const {
      selector,
      name = selector,
      methods = null,
      threshold = null
    } = zone;

    if (!selector) {
      return {
        success: false,
        error: 'selector is required for zone'
      };
    }

    const zones = this.zones.get(monitorId);

    // Check if zone already exists
    if (zones.find(z => z.selector === selector)) {
      return {
        success: false,
        error: `Zone with selector ${selector} already exists`
      };
    }

    const newZone = {
      id: `zone-${Date.now()}`,
      selector,
      name,
      methods: methods || this.monitors.get(monitorId).methods,
      threshold: threshold || this.monitors.get(monitorId).threshold,
      addedAt: new Date().toISOString()
    };

    zones.push(newZone);

    return {
      success: true,
      monitorId,
      zone: newZone,
      totalZones: zones.length
    };
  }

  /**
   * Remove monitoring zone
   * @param {string} monitorId - Monitor ID
   * @param {string} zoneId - Zone ID
   * @returns {Object} Remove result
   */
  removeMonitoringZone(monitorId, zoneId) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: `Monitor not found: ${monitorId}`
      };
    }

    const zones = this.zones.get(monitorId);
    const index = zones.findIndex(z => z.id === zoneId);

    if (index === -1) {
      return {
        success: false,
        error: `Zone not found: ${zoneId}`
      };
    }

    zones.splice(index, 1);

    return {
      success: true,
      monitorId,
      zoneId,
      totalZones: zones.length
    };
  }

  /**
   * List monitored pages
   * @returns {Object} List of all monitors
   */
  listMonitoredPages() {
    const monitors = Array.from(this.monitors.values()).map(monitor => ({
      id: monitor.id,
      url: monitor.url,
      status: monitor.status,
      methods: monitor.methods,
      interval: monitor.interval,
      checkCount: monitor.checkCount,
      changeCount: monitor.changeCount,
      createdAt: monitor.createdAt,
      lastCheck: monitor.lastCheck,
      lastChange: monitor.lastChange
    }));

    return {
      success: true,
      monitors,
      total: monitors.length,
      active: monitors.filter(m => m.status === MONITOR_STATUS.ACTIVE).length,
      paused: monitors.filter(m => m.status === MONITOR_STATUS.PAUSED).length
    };
  }

  /**
   * Cleanup monitor resources
   */
  cleanup(monitorId = null) {
    if (monitorId) {
      // Cleanup specific monitor
      if (this.schedules.has(monitorId)) {
        clearInterval(this.schedules.get(monitorId));
        this.schedules.delete(monitorId);
      }
      this.monitors.delete(monitorId);
      this.snapshots.delete(monitorId);
      this.changeHistory.delete(monitorId);
      this.zones.delete(monitorId);
      this.statistics.delete(monitorId);
    } else {
      // Cleanup all monitors
      this.schedules.forEach(handle => clearInterval(handle));
      this.schedules.clear();
      this.monitors.clear();
      this.snapshots.clear();
      this.changeHistory.clear();
      this.zones.clear();
      this.statistics.clear();
    }

    this.pendingRequests.clear();
  }
}

// Mix change-detection and report-generation methods onto the prototype.
// These functions use `this` and behave identically to the original
// in-class methods; only their file location changed.
Object.assign(PageMonitor.prototype, changeDetectors, reportGenerators);

module.exports = {
  PageMonitor,
  DETECTION_METHODS,
  CHANGE_TYPES,
  MONITOR_STATUS
};
