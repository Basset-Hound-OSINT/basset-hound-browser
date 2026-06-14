/**
 * Dashboard Alert Manager - Alert tracking and filtering
 *
 * Handles:
 * - Alert read/unread status tracking
 * - Alert filtering by severity, type, date
 * - Batch operations (mark read, acknowledge, dismiss)
 * - Alert lifecycle management
 *
 * @module src/dashboard/alert-manager
 */

const EventEmitter = require('events');

/**
 * Alert severity levels
 */
const ALERT_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

/**
 * Alert status
 */
const ALERT_STATUS = {
  NEW: 'new',
  ACKNOWLEDGED: 'acknowledged',
  DISMISSED: 'dismissed',
  RESOLVED: 'resolved'
};

/**
 * Alert type
 */
const ALERT_TYPE = {
  CHANGE_DETECTED: 'change_detected',
  THRESHOLD_EXCEEDED: 'threshold_exceeded',
  ANOMALY_DETECTED: 'anomaly_detected',
  MONITOR_FAILED: 'monitor_failed',
  CUSTOM: 'custom'
};

/**
 * Alert Manager Class
 * Manages alert lifecycle, filtering, and batch operations
 */
class AlertManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxAlerts: options.maxAlerts || 10000,
      retentionDays: options.retentionDays || 30,
      enableAutoCleanup: options.enableAutoCleanup !== false,
      cleanupInterval: options.cleanupInterval || 24 * 60 * 60 * 1000, // 24 hours
      ...options
    };

    // Alert storage
    this.alerts = new Map(); // alertId -> alert
    this.alertsByMonitor = new Map(); // monitorId -> [alertIds]
    this.alertsByStatus = new Map(); // status -> Set<alertId>
    this.alertsBySeverity = new Map(); // severity -> [alertIds]

    // Initialize status and severity indices
    for (const status of Object.values(ALERT_STATUS)) {
      this.alertsByStatus.set(status, new Set());
    }
    for (const severity of Object.values(ALERT_SEVERITY)) {
      this.alertsBySeverity.set(severity, []);
    }

    // Statistics
    this.stats = {
      totalAlerts: 0,
      unreadCount: 0,
      acknowledgedCount: 0,
      dismissedCount: 0,
      resolvedCount: 0
    };

    // Cleanup timer
    this.cleanupTimer = null;
    if (this.options.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Create and add a new alert
   * @param {Object} alertData - Alert data
   * @returns {Object} Created alert with metadata
   */
  createAlert(alertData) {
    const {
      monitorId,
      type = ALERT_TYPE.CHANGE_DETECTED,
      severity = ALERT_SEVERITY.MEDIUM,
      title,
      message,
      metadata = {}
    } = alertData;

    if (!monitorId || !title) {
      throw new Error('monitorId and title are required');
    }

    if (!Object.values(ALERT_TYPE).includes(type)) {
      throw new Error(`Invalid alert type: ${type}`);
    }

    if (!Object.values(ALERT_SEVERITY).includes(severity)) {
      throw new Error(`Invalid severity: ${severity}`);
    }

    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      monitorId,
      type,
      severity,
      title,
      message,
      metadata,
      status: ALERT_STATUS.NEW,
      read: false,
      acknowledged: false,
      dismissed: false,
      createdAt: Date.now(),
      readAt: null,
      acknowledgedAt: null,
      dismissedAt: null,
      expiresAt: Date.now() + this.options.retentionDays * 24 * 60 * 60 * 1000
    };

    // Check size limit
    if (this.alerts.size >= this.options.maxAlerts) {
      const oldestAlert = Array.from(this.alerts.values())
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      this.removeAlert(oldestAlert.id);
    }

    // Store alert
    this.alerts.set(alert.id, alert);

    // Index by monitor
    if (!this.alertsByMonitor.has(monitorId)) {
      this.alertsByMonitor.set(monitorId, []);
    }
    this.alertsByMonitor.get(monitorId).push(alert.id);

    // Index by status
    this.alertsByStatus.get(ALERT_STATUS.NEW).add(alert.id);

    // Index by severity
    const severityAlerts = this.alertsBySeverity.get(severity) || [];
    severityAlerts.push(alert.id);
    this.alertsBySeverity.set(severity, severityAlerts);

    // Update statistics
    this.stats.totalAlerts++;
    this.stats.unreadCount++;

    this.emit('alert-created', alert);

    return alert;
  }

  /**
   * Get alert by ID
   * @param {string} alertId - Alert ID
   * @returns {Object} Alert data or null
   */
  getAlert(alertId) {
    return this.alerts.get(alertId) || null;
  }

  /**
   * Mark alert as read
   * @param {string} alertId - Alert ID
   * @returns {Object} Updated alert
   */
  markAsRead(alertId) {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    if (!alert.read) {
      alert.read = true;
      alert.readAt = Date.now();
      this.stats.unreadCount--;
      this.emit('alert-marked-read', alert);
    }

    return alert;
  }

  /**
   * Mark alert as unread
   * @param {string} alertId - Alert ID
   * @returns {Object} Updated alert
   */
  markAsUnread(alertId) {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    if (alert.read) {
      alert.read = false;
      alert.readAt = null;
      this.stats.unreadCount++;
      this.emit('alert-marked-unread', alert);
    }

    return alert;
  }

  /**
   * Acknowledge alert
   * @param {string} alertId - Alert ID
   * @returns {Object} Updated alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    if (!alert.acknowledged) {
      const oldStatus = alert.status;
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      alert.status = ALERT_STATUS.ACKNOWLEDGED;

      // Update status index
      this.alertsByStatus.get(oldStatus).delete(alertId);
      this.alertsByStatus.get(ALERT_STATUS.ACKNOWLEDGED).add(alertId);

      if (oldStatus === ALERT_STATUS.NEW) {
        this.stats.acknowledgedCount++;
      }

      this.emit('alert-acknowledged', alert);
    }

    return alert;
  }

  /**
   * Dismiss alert
   * @param {string} alertId - Alert ID
   * @returns {Object} Updated alert
   */
  dismissAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    if (!alert.dismissed) {
      const oldStatus = alert.status;
      alert.dismissed = true;
      alert.dismissedAt = Date.now();
      alert.status = ALERT_STATUS.DISMISSED;

      // Update status index
      this.alertsByStatus.get(oldStatus).delete(alertId);
      this.alertsByStatus.get(ALERT_STATUS.DISMISSED).add(alertId);

      if (oldStatus === ALERT_STATUS.NEW) {
        this.stats.unreadCount--;
      } else if (oldStatus === ALERT_STATUS.ACKNOWLEDGED) {
        this.stats.acknowledgedCount--;
      }

      this.stats.dismissedCount++;

      this.emit('alert-dismissed', alert);
    }

    return alert;
  }

  /**
   * Remove alert permanently
   * @param {string} alertId - Alert ID
   * @returns {boolean} True if removed
   */
  removeAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    // Remove from all indices
    this.alerts.delete(alertId);

    const monitorAlerts = this.alertsByMonitor.get(alert.monitorId) || [];
    const index = monitorAlerts.indexOf(alertId);
    if (index > -1) {
      monitorAlerts.splice(index, 1);
    }

    this.alertsByStatus.get(alert.status).delete(alertId);

    const severityAlerts = this.alertsBySeverity.get(alert.severity) || [];
    const severityIndex = severityAlerts.indexOf(alertId);
    if (severityIndex > -1) {
      severityAlerts.splice(severityIndex, 1);
    }

    // Update stats
    this.stats.totalAlerts--;
    if (!alert.read) this.stats.unreadCount--;
    if (alert.acknowledged) this.stats.acknowledgedCount--;
    if (alert.dismissed) this.stats.dismissedCount--;

    this.emit('alert-removed', { alertId });

    return true;
  }

  /**
   * Batch mark alerts as read
   * @param {Array<string>} alertIds - Alert IDs
   * @returns {Array} Updated alerts
   */
  batchMarkAsRead(alertIds) {
    if (!Array.isArray(alertIds)) {
      throw new Error('alertIds must be an array');
    }

    const updated = [];
    for (const alertId of alertIds) {
      try {
        const alert = this.markAsRead(alertId);
        updated.push(alert);
      } catch (error) {
        // Skip invalid alerts
      }
    }

    this.emit('batch-marked-read', { count: updated.length });

    return updated;
  }

  /**
   * Batch acknowledge alerts
   * @param {Array<string>} alertIds - Alert IDs
   * @returns {Array} Updated alerts
   */
  batchAcknowledge(alertIds) {
    if (!Array.isArray(alertIds)) {
      throw new Error('alertIds must be an array');
    }

    const updated = [];
    for (const alertId of alertIds) {
      try {
        const alert = this.acknowledgeAlert(alertId);
        updated.push(alert);
      } catch (error) {
        // Skip invalid alerts
      }
    }

    this.emit('batch-acknowledged', { count: updated.length });

    return updated;
  }

  /**
   * Batch dismiss alerts
   * @param {Array<string>} alertIds - Alert IDs
   * @returns {Array} Updated alerts
   */
  batchDismiss(alertIds) {
    if (!Array.isArray(alertIds)) {
      throw new Error('alertIds must be an array');
    }

    const updated = [];
    for (const alertId of alertIds) {
      try {
        const alert = this.dismissAlert(alertId);
        updated.push(alert);
      } catch (error) {
        // Skip invalid alerts
      }
    }

    this.emit('batch-dismissed', { count: updated.length });

    return updated;
  }

  /**
   * Get alerts for a monitor
   * @param {string} monitorId - Monitor ID
   * @param {Object} options - Filter options
   * @returns {Array} Filtered alerts
   */
  getMonitorAlerts(monitorId, options = {}) {
    const alertIds = this.alertsByMonitor.get(monitorId) || [];
    const alerts = alertIds.map(id => this.alerts.get(id)).filter(Boolean);

    return this.filterAlerts(alerts, options);
  }

  /**
   * Get alerts by severity
   * @param {string} severity - Severity level
   * @param {Object} options - Filter options
   * @returns {Array} Filtered alerts
   */
  getAlertsBySeverity(severity, options = {}) {
    if (!Object.values(ALERT_SEVERITY).includes(severity)) {
      throw new Error(`Invalid severity: ${severity}`);
    }

    const alertIds = this.alertsBySeverity.get(severity) || [];
    const alerts = alertIds.map(id => this.alerts.get(id)).filter(Boolean);

    return this.filterAlerts(alerts, options);
  }

  /**
   * Get alerts by status
   * @param {string} status - Alert status
   * @param {Object} options - Filter options
   * @returns {Array} Filtered alerts
   */
  getAlertsByStatus(status, options = {}) {
    if (!Object.values(ALERT_STATUS).includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const alertIds = Array.from(this.alertsByStatus.get(status) || new Set());
    const alerts = alertIds.map(id => this.alerts.get(id)).filter(Boolean);

    return this.filterAlerts(alerts, options);
  }

  /**
   * Get all unread alerts
   * @param {Object} options - Filter options
   * @returns {Array} Unread alerts
   */
  getUnreadAlerts(options = {}) {
    const alerts = Array.from(this.alerts.values())
      .filter(a => !a.read);

    return this.filterAlerts(alerts, options);
  }

  /**
   * Filter alerts by criteria
   * @param {Array} alerts - Alerts to filter
   * @param {Object} options - Filter options
   * @returns {Array} Filtered alerts
   */
  filterAlerts(alerts, options = {}) {
    const {
      limit = 100,
      offset = 0,
      status = null,
      severity = null,
      type = null,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    let filtered = alerts;

    // Apply filters
    if (status) {
      filtered = filtered.filter(a => a.status === status);
    }
    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }
    if (type) {
      filtered = filtered.filter(a => a.type === type);
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    // Paginate
    const paginated = filtered.slice(offset, offset + limit);

    return {
      alerts: paginated,
      total: filtered.length,
      limit,
      offset,
      hasMore: offset + limit < filtered.length
    };
  }

  /**
   * Get alerts summary
   * @returns {Object} Alert statistics and summary
   */
  getSummary() {
    const summary = {
      ...this.stats,
      byStatus: {},
      bySeverity: {},
      byType: {}
    };

    // Count by status
    for (const [status, ids] of this.alertsByStatus) {
      summary.byStatus[status] = ids.size;
    }

    // Count by severity
    for (const [severity, ids] of this.alertsBySeverity) {
      summary.bySeverity[severity] = ids.length;
    }

    // Count by type
    for (const type of Object.values(ALERT_TYPE)) {
      const count = Array.from(this.alerts.values())
        .filter(a => a.type === type).length;
      summary.byType[type] = count;
    }

    return summary;
  }

  /**
   * Cleanup expired alerts
   * @returns {number} Number of alerts removed
   */
  cleanupExpired() {
    const now = Date.now();
    const expired = Array.from(this.alerts.values())
      .filter(a => a.expiresAt < now);

    let removed = 0;
    for (const alert of expired) {
      if (this.removeAlert(alert.id)) {
        removed++;
      }
    }

    if (removed > 0) {
      this.emit('cleanup-completed', { removedCount: removed });
    }

    return removed;
  }

  /**
   * Start auto-cleanup timer
   * @returns {void}
   */
  startAutoCleanup() {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.options.cleanupInterval);

    this.emit('auto-cleanup-started');
  }

  /**
   * Stop auto-cleanup timer
   * @returns {void}
   */
  stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      this.emit('auto-cleanup-stopped');
    }
  }

  /**
   * Clear all alerts
   * @returns {void}
   */
  clear() {
    this.alerts.clear();
    this.alertsByMonitor.clear();
    for (const set of this.alertsByStatus.values()) {
      set.clear();
    }
    for (const key of this.alertsBySeverity.keys()) {
      this.alertsBySeverity.set(key, []);
    }

    this.stats = {
      totalAlerts: 0,
      unreadCount: 0,
      acknowledgedCount: 0,
      dismissedCount: 0,
      resolvedCount: 0
    };

    this.emit('alerts-cleared');
  }

  /**
   * Destroy alert manager
   * @returns {void}
   */
  destroy() {
    this.stopAutoCleanup();
    this.clear();
    this.removeAllListeners();
  }
}

module.exports = {
  AlertManager,
  ALERT_SEVERITY,
  ALERT_STATUS,
  ALERT_TYPE
};
