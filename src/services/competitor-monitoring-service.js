/**
 * Competitor Monitoring Service
 * Pure business logic for monitoring competitive websites
 * Separated from WebSocket/infrastructure concerns
 *
 * Responsibilities:
 * - Monitor creation and configuration
 * - Change detection logic
 * - Alert generation
 * - Snapshot management
 * - Monitor statistics
 *
 * Dependencies:
 * - (None - pure logic)
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 */

class CompetitorMonitoringService {
  /**
   * Create competitor monitoring service
   * @param {Object} options - Configuration
   * @param {number} options.maxMonitors - Max concurrent monitors (default: 100)
   * @param {number} options.checkInterval - Check interval in ms (default: 1 min)
   */
  constructor(options = {}) {
    this.maxMonitors = options.maxMonitors || 100;
    this.checkInterval = options.checkInterval || 60000;

    this.monitors = new Map(); // monitorId -> monitor
    this.snapshots = new Map(); // monitorId -> [snapshots]
    this.changes = new Map(); // monitorId -> [changes]

    this.stats = {
      monitorsCreated: 0,
      monitorsActive: 0,
      checksPerformed: 0,
      changesDetected: 0,
      alertsGenerated: 0,
      totalMonitoringTime: 0
    };
  }

  /**
   * Create a new monitor
   * @param {Object} options - Monitor options
   * @param {string} options.monitorId - Monitor ID
   * @param {string} options.url - URL to monitor
   * @param {Array<string>} options.selectors - CSS selectors to watch
   * @param {Object} options.config - Monitor configuration
   * @returns {Object} Monitor object
   */
  createMonitor(options = {}) {
    if (this.monitors.size >= this.maxMonitors) {
      throw new Error(`Maximum monitors (${this.maxMonitors}) reached`);
    }

    const monitorId = options.monitorId || this._generateMonitorId();

    if (this.monitors.has(monitorId)) {
      throw new Error(`Monitor ${monitorId} already exists`);
    }

    const monitor = {
      id: monitorId,
      url: options.url,
      selectors: options.selectors || [],
      state: 'active',
      config: options.config || {},
      createdAt: Date.now(),
      lastCheckedAt: null,
      nextCheckAt: Date.now() + this.checkInterval,
      checksCount: 0,
      changesCount: 0
    };

    this.monitors.set(monitorId, monitor);
    this.snapshots.set(monitorId, []);
    this.changes.set(monitorId, []);

    this.stats.monitorsCreated++;
    this.stats.monitorsActive = this.monitors.size;

    return monitor;
  }

  /**
   * Get monitor by ID
   * @param {string} monitorId - Monitor ID
   * @returns {Object|null}
   */
  getMonitor(monitorId) {
    return this.monitors.get(monitorId) || null;
  }

  /**
   * Remove monitor
   * @param {string} monitorId - Monitor ID
   * @returns {boolean} True if removed
   */
  removeMonitor(monitorId) {
    const existed = this.monitors.delete(monitorId);
    if (existed) {
      this.snapshots.delete(monitorId);
      this.changes.delete(monitorId);
      this.stats.monitorsActive = this.monitors.size;
    }
    return existed;
  }

  /**
   * Record a snapshot for a monitor
   * @param {string} monitorId - Monitor ID
   * @param {Object} snapshot - Snapshot data
   * @returns {Object} Stored snapshot
   */
  recordSnapshot(monitorId, snapshot) {
    if (!this.monitors.has(monitorId)) {
      throw new Error(`Monitor ${monitorId} not found`);
    }

    const storedSnapshot = {
      ...snapshot,
      timestamp: Date.now(),
      hash: this._calculateHash(snapshot)
    };

    const snapshots = this.snapshots.get(monitorId);
    snapshots.push(storedSnapshot);

    // Limit snapshot history
    if (snapshots.length > 100) {
      snapshots.shift();
    }

    return storedSnapshot;
  }

  /**
   * Detect changes between snapshots
   * @param {string} monitorId - Monitor ID
   * @param {Object} oldSnapshot - Previous snapshot
   * @param {Object} newSnapshot - New snapshot
   * @returns {Object} Change detection result
   */
  detectChanges(monitorId, oldSnapshot, newSnapshot) {
    if (!this.monitors.has(monitorId)) {
      throw new Error(`Monitor ${monitorId} not found`);
    }

    const changes = [];

    // Compare content
    const oldContent = oldSnapshot?.content || {};
    const newContent = newSnapshot?.content || {};

    for (const selector in newContent) {
      const oldValue = oldContent[selector];
      const newValue = newContent[selector];

      if (oldValue !== newValue) {
        changes.push({
          selector,
          oldValue,
          newValue,
          changeType: this._determineChangeType(oldValue, newValue),
          detectedAt: Date.now()
        });
      }
    }

    // Store changes
    if (changes.length > 0) {
      const changesArray = this.changes.get(monitorId);
      changesArray.push(...changes);

      // Limit change history
      if (changesArray.length > 500) {
        changesArray.splice(0, changesArray.length - 500);
      }

      this.stats.changesDetected += changes.length;

      // Update monitor stats
      const monitor = this.monitors.get(monitorId);
      monitor.changesCount += changes.length;
      monitor.lastCheckedAt = Date.now();
    }

    return {
      monitorId,
      changeCount: changes.length,
      changes,
      timestamp: Date.now()
    };
  }

  /**
   * Generate alert for changes
   * @param {string} monitorId - Monitor ID
   * @param {Object} changeData - Change detection result
   * @returns {Object} Alert object
   */
  generateAlert(monitorId, changeData) {
    if (changeData.changeCount === 0) {
      return null;
    }

    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      return null;
    }

    const alert = {
      id: this._generateAlertId(),
      monitorId,
      url: monitor.url,
      severity: this._calculateSeverity(changeData.changes),
      changeCount: changeData.changeCount,
      changes: changeData.changes,
      generatedAt: Date.now(),
      acknowledged: false
    };

    this.stats.alertsGenerated++;

    return alert;
  }

  /**
   * Get snapshots for monitor
   * @param {string} monitorId - Monitor ID
   * @param {number} limit - Max snapshots to return
   * @returns {Array}
   */
  getSnapshots(monitorId, limit = 10) {
    const snapshots = this.snapshots.get(monitorId) || [];
    return snapshots.slice(-limit);
  }

  /**
   * Get changes for monitor
   * @param {string} monitorId - Monitor ID
   * @param {number} limit - Max changes to return
   * @returns {Array}
   */
  getChanges(monitorId, limit = 50) {
    const changes = this.changes.get(monitorId) || [];
    return changes.slice(-limit);
  }

  /**
   * Get all monitors
   * @returns {Array}
   */
  getAllMonitors() {
    return Array.from(this.monitors.values());
  }

  /**
   * Get monitors needing check
   * @returns {Array} Monitors that need checking
   */
  getMonitorsNeedingCheck() {
    const now = Date.now();
    return Array.from(this.monitors.values()).filter(
      monitor => monitor.state === 'active' && monitor.nextCheckAt <= now
    );
  }

  /**
   * Mark monitor as checked
   * @param {string} monitorId - Monitor ID
   */
  markAsChecked(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (monitor) {
      monitor.lastCheckedAt = Date.now();
      monitor.nextCheckAt = Date.now() + this.checkInterval;
      monitor.checksCount++;
      this.stats.checksPerformed++;
    }
  }

  /**
   * Get service statistics
   * @returns {Object}
   */
  getStats() {
    const avgChangesPerCheck = this.stats.checksPerformed > 0
      ? (this.stats.changesDetected / this.stats.checksPerformed).toFixed(2)
      : 0;

    return {
      ...this.stats,
      averageChangesPerCheck: avgChangesPerCheck,
      monitorsActive: this.stats.monitorsActive,
      maxMonitors: this.maxMonitors,
      utilizationPercent: ((this.stats.monitorsActive / this.maxMonitors) * 100).toFixed(1)
    };
  }

  /**
   * Determine type of change
   * @private
   */
  _determineChangeType(oldValue, newValue) {
    if (!oldValue) {
      return 'added';
    }
    if (!newValue) {
      return 'removed';
    }
    return 'modified';
  }

  /**
   * Calculate severity based on changes
   * @private
   */
  _calculateSeverity(changes) {
    if (changes.length > 10) {
      return 'critical';
    }
    if (changes.length > 5) {
      return 'high';
    }
    if (changes.length > 1) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Calculate hash of content
   * @private
   */
  _calculateHash(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Generate monitor ID
   * @private
   */
  _generateMonitorId() {
    return `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate alert ID
   * @private
   */
  _generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = CompetitorMonitoringService;
