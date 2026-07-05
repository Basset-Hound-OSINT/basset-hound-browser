/**
 * Monitor Manager - Manages competitive website monitoring configurations
 * Handles adding/removing monitored websites, frequency settings, and alert thresholds
 * @module src/monitoring/monitor-manager
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

/**
 * Frequency intervals in milliseconds
 */
const FREQUENCY_INTERVALS = {
  'hourly': 3600000, // 1 hour
  'twice-daily': 43200000, // 12 hours
  'daily': 86400000, // 24 hours
  'weekly': 604800000, // 7 days
  'monthly': 2592000000 // 30 days
};

/**
 * Monitor status constants
 */
const MONITOR_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ERROR: 'error',
  IDLE: 'idle'
};

/**
 * Monitor Manager Class
 * Manages the lifecycle of competitive website monitors
 */
class MonitorManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.dataDir = options.dataDir || path.join(process.cwd(), 'tmp', '.basset-hound', 'monitoring');
    this.monitorsFile = path.join(this.dataDir, 'monitors.json');
    this.configFile = path.join(this.dataDir, 'config.json');

    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Monitor storage
    this.monitors = new Map();
    this.monitorIntervals = new Map();
    this.lastCheckTimes = new Map();

    // Configuration
    this.config = {
      maxMonitors: options.maxMonitors || 100,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000,
      timeout: options.timeout || 30000,
      enableDuplicateDetection: options.enableDuplicateDetection !== false
    };

    // Load persisted data
    this.loadMonitors();
  }

  /**
   * Load monitors from persistent storage
   * @returns {void}
   */
  loadMonitors() {
    try {
      if (fs.existsSync(this.monitorsFile)) {
        const data = fs.readFileSync(this.monitorsFile, 'utf-8');
        const monitors = JSON.parse(data);

        for (const monitorData of monitors) {
          this.monitors.set(monitorData.id, monitorData);
        }
      }
    } catch (error) {
      console.error('Failed to load monitors:', error);
    }
  }

  /**
   * Save monitors to persistent storage
   * @returns {void}
   */
  saveMonitors() {
    try {
      const monitors = Array.from(this.monitors.values());
      fs.writeFileSync(
        this.monitorsFile,
        JSON.stringify(monitors, null, 2),
        'utf-8'
      );
      this.emit('monitors-saved', { count: monitors.length });
    } catch (error) {
      console.error('Failed to save monitors:', error);
      this.emit('error', { type: 'save-failed', error });
    }
  }

  /**
   * Add a new monitored website
   * @param {Object} siteConfig - Site configuration
   * @param {string} siteConfig.url - Website URL to monitor
   * @param {string} siteConfig.name - Display name for the site
   * @param {string} [siteConfig.frequency='daily'] - Monitoring frequency
   * @param {Object} [siteConfig.alerts] - Alert configuration
   * @returns {Object} Monitor configuration
   */
  addMonitor(siteConfig) {
    const {
      url,
      name,
      frequency = 'daily',
      alerts = {},
      tags = [],
      metadata = {}
    } = siteConfig;

    // Validation
    if (!url || !name) {
      throw new Error('URL and name are required');
    }

    if (!this.isValidUrl(url)) {
      throw new Error('Invalid URL format');
    }

    if (!FREQUENCY_INTERVALS[frequency]) {
      throw new Error(`Invalid frequency. Must be one of: ${Object.keys(FREQUENCY_INTERVALS).join(', ')}`);
    }

    // Check max monitors limit
    if (this.monitors.size >= this.config.maxMonitors) {
      throw new Error(`Maximum monitors (${this.config.maxMonitors}) reached`);
    }

    // Check for duplicates
    if (this.config.enableDuplicateDetection) {
      const normalizedUrl = this.normalizeUrl(url);
      for (const monitor of this.monitors.values()) {
        if (this.normalizeUrl(monitor.url) === normalizedUrl) {
          throw new Error('Monitor for this URL already exists');
        }
      }
    }

    // Create monitor object
    const monitorId = this.generateMonitorId();
    const monitor = {
      id: monitorId,
      url,
      name,
      frequency,
      frequencyMs: FREQUENCY_INTERVALS[frequency],
      status: MONITOR_STATUS.IDLE,
      tags,
      metadata,
      createdAt: Date.now(),
      lastCheckAt: null,
      nextCheckAt: Date.now() + FREQUENCY_INTERVALS[frequency],
      checkCount: 0,
      failureCount: 0,
      successCount: 0,
      alerts: {
        contentChange: alerts.contentChange !== false,
        structureChange: alerts.structureChange !== false,
        technologyChange: alerts.technologyChange !== false,
        performanceChange: alerts.performanceChange !== false,
        statusCodeChange: alerts.statusCodeChange !== false,
        enableEmail: alerts.enableEmail || false,
        enableWebhook: alerts.enableWebhook || false,
        enableSlack: alerts.enableSlack || false,
        enableTeams: alerts.enableTeams || false,
        emailAddresses: alerts.emailAddresses || [],
        webhookUrl: alerts.webhookUrl || null,
        slackWebhookUrl: alerts.slackWebhookUrl || null,
        teamsWebhookUrl: alerts.teamsWebhookUrl || null,
        thresholds: {
          contentChangePercent: alerts.thresholds?.contentChangePercent || 5,
          performanceThresholdMs: alerts.thresholds?.performanceThresholdMs || 1000,
          structureChangePercent: alerts.thresholds?.structureChangePercent || 10
        }
      }
    };

    this.monitors.set(monitorId, monitor);
    this.saveMonitors();
    this.emit('monitor-added', monitor);

    return monitor;
  }

  /**
   * Remove a monitored website
   * @param {string} monitorId - Monitor ID
   * @returns {boolean} Success status
   */
  removeMonitor(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      throw new Error(`Monitor not found: ${monitorId}`);
    }

    // Clear any running intervals
    if (this.monitorIntervals.has(monitorId)) {
      clearInterval(this.monitorIntervals.get(monitorId));
      this.monitorIntervals.delete(monitorId);
    }

    this.monitors.delete(monitorId);
    this.lastCheckTimes.delete(monitorId);
    this.saveMonitors();
    this.emit('monitor-removed', { id: monitorId, name: monitor.name });

    return true;
  }

  /**
   * Update monitor configuration
   * @param {string} monitorId - Monitor ID
   * @param {Object} updates - Configuration updates
   * @returns {Object} Updated monitor configuration
   */
  updateMonitor(monitorId, updates) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      throw new Error(`Monitor not found: ${monitorId}`);
    }

    const {
      name,
      frequency,
      alerts,
      tags,
      metadata,
      status
    } = updates;

    // Validate updates
    if (frequency && !FREQUENCY_INTERVALS[frequency]) {
      throw new Error(`Invalid frequency: ${frequency}`);
    }

    if (status && !Object.values(MONITOR_STATUS).includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    // Apply updates
    if (name) {
      monitor.name = name;
    }
    if (frequency) {
      monitor.frequency = frequency;
      monitor.frequencyMs = FREQUENCY_INTERVALS[frequency];
      monitor.nextCheckAt = Date.now() + FREQUENCY_INTERVALS[frequency];
    }
    if (alerts) {
      monitor.alerts = { ...monitor.alerts, ...alerts };
    }
    if (tags) {
      monitor.tags = tags;
    }
    if (metadata) {
      monitor.metadata = { ...monitor.metadata, ...metadata };
    }
    if (status) {
      monitor.status = status;
    }

    monitor.updatedAt = Date.now();

    this.saveMonitors();
    this.emit('monitor-updated', monitor);

    return monitor;
  }

  /**
   * Get monitor by ID
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Monitor configuration
   */
  getMonitor(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      throw new Error(`Monitor not found: ${monitorId}`);
    }
    return { ...monitor };
  }

  /**
   * List all monitors with optional filtering
   * @param {Object} [filter={}] - Filter options
   * @param {string} [filter.status] - Filter by status
   * @param {string} [filter.tag] - Filter by tag
   * @returns {Array} List of monitors
   */
  listMonitors(filter = {}) {
    let monitors = Array.from(this.monitors.values());

    if (filter.status) {
      monitors = monitors.filter(m => m.status === filter.status);
    }

    if (filter.tag) {
      monitors = monitors.filter(m => m.tags.includes(filter.tag));
    }

    return monitors.map(m => ({ ...m }));
  }

  /**
   * Get monitors due for checking
   * @returns {Array} Monitors that need checking
   */
  getMonitorsDueForCheck() {
    const now = Date.now();
    return Array.from(this.monitors.values())
      .filter(m => m.status === MONITOR_STATUS.ACTIVE && m.nextCheckAt <= now)
      .map(m => ({ ...m }));
  }

  /**
   * Update monitor check status
   * @param {string} monitorId - Monitor ID
   * @param {Object} checkResult - Check result data
   * @returns {void}
   */
  updateCheckStatus(monitorId, checkResult) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      return;
    }

    monitor.lastCheckAt = Date.now();
    monitor.nextCheckAt = Date.now() + monitor.frequencyMs;
    monitor.checkCount += 1;

    if (checkResult.success) {
      monitor.successCount += 1;
      monitor.status = MONITOR_STATUS.ACTIVE;
      monitor.lastError = null;
    } else {
      monitor.failureCount += 1;
      monitor.lastError = checkResult.error;
      if (monitor.failureCount >= this.config.maxRetries) {
        monitor.status = MONITOR_STATUS.ERROR;
      }
    }

    this.saveMonitors();
  }

  /**
   * Pause monitoring for a website
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Updated monitor
   */
  pauseMonitor(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      throw new Error(`Monitor not found: ${monitorId}`);
    }

    if (this.monitorIntervals.has(monitorId)) {
      clearInterval(this.monitorIntervals.get(monitorId));
      this.monitorIntervals.delete(monitorId);
    }

    monitor.status = MONITOR_STATUS.PAUSED;
    monitor.updatedAt = Date.now();

    this.saveMonitors();
    this.emit('monitor-paused', { id: monitorId, name: monitor.name });

    return { ...monitor };
  }

  /**
   * Resume monitoring for a website
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Updated monitor
   */
  resumeMonitor(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      throw new Error(`Monitor not found: ${monitorId}`);
    }

    monitor.status = MONITOR_STATUS.ACTIVE;
    monitor.nextCheckAt = Date.now(); // Check immediately on resume
    monitor.updatedAt = Date.now();

    this.saveMonitors();
    this.emit('monitor-resumed', { id: monitorId, name: monitor.name });

    return { ...monitor };
  }

  /**
   * Get statistics for a monitor
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Monitor statistics
   */
  getMonitorStats(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      throw new Error(`Monitor not found: ${monitorId}`);
    }

    const successRate = monitor.checkCount > 0
      ? ((monitor.successCount / monitor.checkCount) * 100).toFixed(2)
      : 0;

    return {
      id: monitorId,
      name: monitor.name,
      totalChecks: monitor.checkCount,
      successfulChecks: monitor.successCount,
      failedChecks: monitor.failureCount,
      successRate: parseFloat(successRate),
      status: monitor.status,
      lastCheckAt: monitor.lastCheckAt,
      nextCheckAt: monitor.nextCheckAt,
      frequency: monitor.frequency,
      createdAt: monitor.createdAt,
      uptime: monitor.lastError ? false : true
    };
  }

  /**
   * Get global monitoring statistics
   * @returns {Object} Global statistics
   */
  getGlobalStats() {
    const monitors = Array.from(this.monitors.values());
    const activeMonitors = monitors.filter(m => m.status === MONITOR_STATUS.ACTIVE).length;
    const pausedMonitors = monitors.filter(m => m.status === MONITOR_STATUS.PAUSED).length;
    const errorMonitors = monitors.filter(m => m.status === MONITOR_STATUS.ERROR).length;

    const totalChecks = monitors.reduce((sum, m) => sum + m.checkCount, 0);
    const totalSuccesses = monitors.reduce((sum, m) => sum + m.successCount, 0);
    const successRate = totalChecks > 0 ? ((totalSuccesses / totalChecks) * 100).toFixed(2) : 0;

    return {
      totalMonitors: monitors.length,
      activeMonitors,
      pausedMonitors,
      errorMonitors,
      totalChecks,
      totalSuccesses,
      totalFailures: totalChecks - totalSuccesses,
      globalSuccessRate: parseFloat(successRate),
      capacity: `${monitors.length}/${this.config.maxMonitors}`
    };
  }

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean}
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize URL for comparison
   * @param {string} url - URL to normalize
   * @returns {string} Normalized URL
   */
  normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Generate unique monitor ID
   * @returns {string} Monitor ID
   */
  generateMonitorId() {
    return `monitor_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Export monitors configuration
   * @returns {Array} All monitors
   */
  exportMonitors() {
    return Array.from(this.monitors.values()).map(m => ({ ...m }));
  }

  /**
   * Import monitors configuration
   * @param {Array} monitorsData - Monitors to import
   * @param {boolean} [merge=false] - Merge with existing or replace
   * @returns {Object} Import result
   */
  importMonitors(monitorsData, merge = false) {
    if (!Array.isArray(monitorsData)) {
      throw new Error('Monitors data must be an array');
    }

    const imported = [];
    const errors = [];

    if (!merge) {
      this.monitors.clear();
    }

    for (const data of monitorsData) {
      try {
        if (!data.url || !data.name) {
          errors.push(`Skipped: missing url or name`);
          continue;
        }

        const monitorId = data.id || this.generateMonitorId();
        this.monitors.set(monitorId, {
          ...data,
          id: monitorId,
          createdAt: data.createdAt || Date.now()
        });
        imported.push(monitorId);
      } catch (error) {
        errors.push(`Failed to import monitor: ${error.message}`);
      }
    }

    this.saveMonitors();
    this.emit('monitors-imported', { imported: imported.length, errors: errors.length });

    return {
      success: true,
      imported: imported.length,
      errors: errors.length,
      errorDetails: errors
    };
  }

  /**
   * Clear all monitors
   * @returns {Object} Clear result
   */
  clearAllMonitors() {
    const count = this.monitors.size;

    // Clear all intervals
    for (const interval of this.monitorIntervals.values()) {
      clearInterval(interval);
    }

    this.monitors.clear();
    this.monitorIntervals.clear();
    this.lastCheckTimes.clear();
    this.saveMonitors();
    this.emit('monitors-cleared', { count });

    return { success: true, clearedCount: count };
  }
}

module.exports = {
  MonitorManager,
  FREQUENCY_INTERVALS,
  MONITOR_STATUS
};
