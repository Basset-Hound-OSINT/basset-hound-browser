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
 */

const { ipcMain } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Change detection methods
 */
const DETECTION_METHODS = {
  DOM_DIFF: 'dom_diff',           // Compare DOM structure and content
  SCREENSHOT_DIFF: 'screenshot_diff', // Visual comparison
  CONTENT_HASH: 'content_hash',   // Hash-based change detection
  TEXT_DIFF: 'text_diff',         // Text content comparison
  ATTRIBUTE_DIFF: 'attribute_diff', // Track attribute changes
  STRUCTURE_DIFF: 'structure_diff', // Track structural changes
  HYBRID: 'hybrid'                // Combine multiple methods
};

/**
 * Change types
 */
const CHANGE_TYPES = {
  CONTENT: 'content',
  STRUCTURE: 'structure',
  STYLE: 'style',
  ATTRIBUTE: 'attribute',
  ADDED: 'added',
  REMOVED: 'removed',
  MODIFIED: 'modified',
  VISUAL: 'visual'
};

/**
 * Monitoring status
 */
const MONITOR_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  ERROR: 'error'
};

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
    if (!monitor) return;

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
   * Compare two snapshots
   * @param {Object} snapshot1 - First snapshot
   * @param {Object} snapshot2 - Second snapshot
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} Comparison result
   */
  async compareSnapshots(snapshot1, snapshot2, options = {}) {
    const {
      methods = [DETECTION_METHODS.HYBRID],
      threshold = 0.1,
      zones = []
    } = options;

    const changes = [];
    let hasChanges = false;

    // Apply each detection method
    for (const method of methods) {
      let methodChanges = [];

      switch (method) {
        case DETECTION_METHODS.CONTENT_HASH:
          methodChanges = this.detectHashChanges(snapshot1, snapshot2, zones);
          break;

        case DETECTION_METHODS.DOM_DIFF:
          methodChanges = this.detectDOMChanges(snapshot1, snapshot2, zones);
          break;

        case DETECTION_METHODS.TEXT_DIFF:
          methodChanges = this.detectTextChanges(snapshot1, snapshot2, zones);
          break;

        case DETECTION_METHODS.ATTRIBUTE_DIFF:
          methodChanges = this.detectAttributeChanges(snapshot1, snapshot2, zones);
          break;

        case DETECTION_METHODS.STRUCTURE_DIFF:
          methodChanges = this.detectStructureChanges(snapshot1, snapshot2, zones);
          break;

        case DETECTION_METHODS.SCREENSHOT_DIFF:
          methodChanges = await this.detectVisualChanges(snapshot1, snapshot2, threshold);
          break;

        case DETECTION_METHODS.HYBRID:
          // Combine multiple methods
          const hashChanges = this.detectHashChanges(snapshot1, snapshot2, zones);
          const domChanges = this.detectDOMChanges(snapshot1, snapshot2, zones);
          const textChanges = this.detectTextChanges(snapshot1, snapshot2, zones);
          methodChanges = [...hashChanges, ...domChanges, ...textChanges];
          break;
      }

      if (methodChanges.length > 0) {
        hasChanges = true;
        changes.push(...methodChanges);
      }
    }

    // Deduplicate and categorize changes
    const uniqueChanges = this.deduplicateChanges(changes);
    const categorizedChanges = this.categorizeChanges(uniqueChanges);
    const summary = this.generateChangeSummary(categorizedChanges);
    const significance = this.calculateSignificance(categorizedChanges);

    return {
      hasChanges,
      changes: categorizedChanges,
      summary,
      significance,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Detect hash-based changes
   */
  detectHashChanges(snapshot1, snapshot2, zones = []) {
    const changes = [];

    // Compare full page hash
    if (snapshot1.contentHash !== snapshot2.contentHash) {
      changes.push({
        type: CHANGE_TYPES.CONTENT,
        method: DETECTION_METHODS.CONTENT_HASH,
        scope: 'page',
        description: 'Page content hash changed',
        oldValue: snapshot1.contentHash,
        newValue: snapshot2.contentHash
      });
    }

    // Compare zone hashes
    if (zones.length > 0 && snapshot1.zones && snapshot2.zones) {
      zones.forEach(zone => {
        const zone1 = snapshot1.zones.find(z => z.selector === zone.selector);
        const zone2 = snapshot2.zones.find(z => z.selector === zone.selector);

        if (zone1 && zone2 && zone1.hash !== zone2.hash) {
          changes.push({
            type: CHANGE_TYPES.CONTENT,
            method: DETECTION_METHODS.CONTENT_HASH,
            scope: 'zone',
            selector: zone.selector,
            description: `Zone content changed: ${zone.selector}`,
            oldValue: zone1.hash,
            newValue: zone2.hash
          });
        }
      });
    }

    return changes;
  }

  /**
   * Detect DOM changes
   */
  detectDOMChanges(snapshot1, snapshot2, zones = []) {
    const changes = [];

    // Compare DOM structure
    if (snapshot1.dom && snapshot2.dom) {
      const dom1 = snapshot1.dom;
      const dom2 = snapshot2.dom;

      // Check element count changes
      if (dom1.elementCount !== dom2.elementCount) {
        changes.push({
          type: CHANGE_TYPES.STRUCTURE,
          method: DETECTION_METHODS.DOM_DIFF,
          scope: 'page',
          description: 'Element count changed',
          oldValue: dom1.elementCount,
          newValue: dom2.elementCount,
          delta: dom2.elementCount - dom1.elementCount
        });
      }

      // Check for added/removed elements
      if (dom1.elements && dom2.elements) {
        const tags1 = new Set(dom1.elements.map(e => e.tagName));
        const tags2 = new Set(dom2.elements.map(e => e.tagName));

        tags2.forEach(tag => {
          if (!tags1.has(tag)) {
            changes.push({
              type: CHANGE_TYPES.ADDED,
              method: DETECTION_METHODS.DOM_DIFF,
              scope: 'element',
              description: `New element type added: ${tag}`,
              newValue: tag
            });
          }
        });

        tags1.forEach(tag => {
          if (!tags2.has(tag)) {
            changes.push({
              type: CHANGE_TYPES.REMOVED,
              method: DETECTION_METHODS.DOM_DIFF,
              scope: 'element',
              description: `Element type removed: ${tag}`,
              oldValue: tag
            });
          }
        });
      }
    }

    return changes;
  }

  /**
   * Detect text content changes
   */
  detectTextChanges(snapshot1, snapshot2, zones = []) {
    const changes = [];

    // Compare text content
    if (snapshot1.textContent !== snapshot2.textContent) {
      const oldLength = snapshot1.textContent?.length || 0;
      const newLength = snapshot2.textContent?.length || 0;

      changes.push({
        type: CHANGE_TYPES.CONTENT,
        method: DETECTION_METHODS.TEXT_DIFF,
        scope: 'page',
        description: 'Text content changed',
        oldValue: oldLength,
        newValue: newLength,
        delta: newLength - oldLength
      });
    }

    return changes;
  }

  /**
   * Detect attribute changes
   */
  detectAttributeChanges(snapshot1, snapshot2, zones = []) {
    const changes = [];

    if (snapshot1.dom?.elements && snapshot2.dom?.elements) {
      const elements1 = snapshot1.dom.elements;
      const elements2 = snapshot2.dom.elements;

      // Compare common elements
      for (let i = 0; i < Math.min(elements1.length, elements2.length); i++) {
        const el1 = elements1[i];
        const el2 = elements2[i];

        if (el1.id === el2.id || el1.selector === el2.selector) {
          // Check attribute differences
          if (JSON.stringify(el1.attributes) !== JSON.stringify(el2.attributes)) {
            changes.push({
              type: CHANGE_TYPES.ATTRIBUTE,
              method: DETECTION_METHODS.ATTRIBUTE_DIFF,
              scope: 'element',
              selector: el1.selector || el1.id,
              description: `Attributes changed on element`,
              oldValue: el1.attributes,
              newValue: el2.attributes
            });
          }
        }
      }
    }

    return changes;
  }

  /**
   * Detect structure changes
   */
  detectStructureChanges(snapshot1, snapshot2, zones = []) {
    const changes = [];

    if (snapshot1.dom && snapshot2.dom) {
      const structure1 = JSON.stringify(snapshot1.dom.structure || {});
      const structure2 = JSON.stringify(snapshot2.dom.structure || {});

      if (structure1 !== structure2) {
        changes.push({
          type: CHANGE_TYPES.STRUCTURE,
          method: DETECTION_METHODS.STRUCTURE_DIFF,
          scope: 'page',
          description: 'DOM structure changed'
        });
      }
    }

    return changes;
  }

  /**
   * Detect visual changes (screenshot comparison)
   */
  async detectVisualChanges(snapshot1, snapshot2, threshold) {
    const changes = [];

    if (snapshot1.screenshot && snapshot2.screenshot) {
      const requestId = this.generateRequestId();

      const result = await new Promise((resolve) => {
        this.pendingRequests.set(requestId, resolve);

        this.mainWindow.webContents.send('compare-page-screenshots', {
          requestId,
          imageData1: snapshot1.screenshot,
          imageData2: snapshot2.screenshot,
          threshold
        });

        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            resolve({ success: false, error: 'Screenshot comparison timeout' });
          }
        }, 60000);
      });

      if (result.success && result.different) {
        changes.push({
          type: CHANGE_TYPES.VISUAL,
          method: DETECTION_METHODS.SCREENSHOT_DIFF,
          scope: 'page',
          description: 'Visual appearance changed',
          similarity: result.similarity,
          differencePercentage: result.differencePercentage,
          diffImage: result.diffImage
        });
      }
    }

    return changes;
  }

  /**
   * Deduplicate changes
   */
  deduplicateChanges(changes) {
    const seen = new Set();
    return changes.filter(change => {
      const key = `${change.type}-${change.scope}-${change.selector || 'page'}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Categorize changes by type
   */
  categorizeChanges(changes) {
    const categorized = {
      content: [],
      structure: [],
      style: [],
      attribute: [],
      added: [],
      removed: [],
      modified: [],
      visual: []
    };

    changes.forEach(change => {
      const category = change.type.toLowerCase();
      if (categorized[category]) {
        categorized[category].push(change);
      }
    });

    return categorized;
  }

  /**
   * Generate change summary
   */
  generateChangeSummary(categorizedChanges) {
    const summary = {
      total: 0,
      byType: {},
      description: []
    };

    Object.entries(categorizedChanges).forEach(([type, changes]) => {
      const count = changes.length;
      if (count > 0) {
        summary.total += count;
        summary.byType[type] = count;
        summary.description.push(`${count} ${type} change${count > 1 ? 's' : ''}`);
      }
    });

    return summary;
  }

  /**
   * Calculate change significance (0-1)
   */
  calculateSignificance(categorizedChanges) {
    let significance = 0;
    const weights = {
      structure: 0.8,
      content: 0.6,
      visual: 0.5,
      attribute: 0.3,
      style: 0.2,
      added: 0.7,
      removed: 0.7,
      modified: 0.5
    };

    Object.entries(categorizedChanges).forEach(([type, changes]) => {
      const weight = weights[type] || 0.1;
      significance += changes.length * weight;
    });

    return Math.min(significance / 10, 1); // Normalize to 0-1
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
   * Export change report
   * @param {string} monitorId - Monitor ID
   * @param {Object} options - Export options
   * @returns {Object} Export result
   */
  exportChangeReport(monitorId, options = {}) {
    if (!this.monitors.has(monitorId)) {
      return {
        success: false,
        error: `Monitor not found: ${monitorId}`
      };
    }

    const {
      format = 'json',
      includeSnapshots = false,
      includeScreenshots = false,
      filePath = null
    } = options;

    const monitor = this.monitors.get(monitorId);
    const changes = this.changeHistory.get(monitorId) || [];
    const stats = this.statistics.get(monitorId);
    let snapshots = this.snapshots.get(monitorId) || [];

    // Remove screenshots if not requested
    if (!includeScreenshots) {
      snapshots = snapshots.map(s => {
        const { screenshot, ...rest } = s;
        return rest;
      });
    }

    const report = {
      monitor: {
        ...monitor,
        statistics: stats
      },
      changes: changes,
      snapshots: includeSnapshots ? snapshots : [],
      generatedAt: new Date().toISOString(),
      summary: {
        totalChanges: changes.length,
        totalChecks: monitor.checkCount,
        monitoringDuration: new Date() - new Date(monitor.createdAt),
        detectionRate: stats.detectionRate
      }
    };

    let exportData;
    let extension;

    switch (format) {
      case 'json':
        exportData = JSON.stringify(report, null, 2);
        extension = '.json';
        break;

      case 'csv':
        exportData = this.generateCSVReport(changes);
        extension = '.csv';
        break;

      case 'html':
        exportData = this.generateHTMLReport(report);
        extension = '.html';
        break;

      case 'markdown':
        exportData = this.generateMarkdownReport(report);
        extension = '.md';
        break;

      default:
        return {
          success: false,
          error: `Unsupported format: ${format}`
        };
    }

    // Save to file if path provided
    if (filePath) {
      try {
        const fullPath = filePath.endsWith(extension) ? filePath : filePath + extension;
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, exportData);

        return {
          success: true,
          monitorId,
          format,
          filePath: fullPath,
          size: exportData.length
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }

    return {
      success: true,
      monitorId,
      format,
      data: exportData
    };
  }

  /**
   * Generate CSV report
   */
  generateCSVReport(changes) {
    const headers = ['Timestamp', 'Type', 'Scope', 'Description', 'Significance'];
    const rows = changes.map(change => [
      change.timestamp,
      change.changes ? Object.keys(change.changes).join(', ') : '',
      'page',
      change.summary ? change.summary.description.join(', ') : '',
      change.significance || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(report) {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Page Monitor Report - ${report.monitor.url}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .change { border-left: 3px solid #007bff; padding: 10px; margin: 10px 0; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .stat { background: #e9ecef; padding: 10px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Page Monitor Report</h1>
  <div class="summary">
    <h2>Monitor: ${report.monitor.url}</h2>
    <p>Created: ${report.monitor.createdAt}</p>
    <p>Status: ${report.monitor.status}</p>
  </div>
  <div class="stats">
    <div class="stat">Total Checks: ${report.summary.totalChecks}</div>
    <div class="stat">Total Changes: ${report.summary.totalChanges}</div>
    <div class="stat">Detection Rate: ${(report.summary.detectionRate * 100).toFixed(2)}%</div>
  </div>
  <h2>Changes</h2>
  ${report.changes.map(change => `
    <div class="change">
      <strong>${change.timestamp}</strong><br>
      ${change.summary ? change.summary.description.join(', ') : 'No description'}
      <br>Significance: ${((change.significance || 0) * 100).toFixed(1)}%
    </div>
  `).join('')}
  <p><em>Generated at: ${report.generatedAt}</em></p>
</body>
</html>`;
  }

  /**
   * Generate Markdown report
   */
  generateMarkdownReport(report) {
    const lines = [
      `# Page Monitor Report`,
      ``,
      `**URL:** ${report.monitor.url}`,
      `**Status:** ${report.monitor.status}`,
      `**Created:** ${report.monitor.createdAt}`,
      ``,
      `## Statistics`,
      ``,
      `- Total Checks: ${report.summary.totalChecks}`,
      `- Total Changes: ${report.summary.totalChanges}`,
      `- Detection Rate: ${(report.summary.detectionRate * 100).toFixed(2)}%`,
      ``,
      `## Changes`,
      ``
    ];

    report.changes.forEach(change => {
      lines.push(`### ${change.timestamp}`);
      lines.push(``);
      if (change.summary) {
        lines.push(`${change.summary.description.join(', ')}`);
      }
      lines.push(`**Significance:** ${((change.significance || 0) * 100).toFixed(1)}%`);
      lines.push(``);
    });

    lines.push(`---`);
    lines.push(`*Generated at: ${report.generatedAt}*`);

    return lines.join('\n');
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

module.exports = {
  PageMonitor,
  DETECTION_METHODS,
  CHANGE_TYPES,
  MONITOR_STATUS
};
