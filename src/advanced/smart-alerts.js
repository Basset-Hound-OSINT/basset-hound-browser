/**
 * Smart Alert Generation Engine - Intelligent alert deduplication, prioritization, and grouping
 * Prevents alert fatigue and provides actionable insights
 * @module src/advanced/smart-alerts
 */

const EventEmitter = require('events');

/**
 * Alert Severity Levels
 */
const ALERT_SEVERITY = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1
};

/**
 * Alert Status
 */
const ALERT_STATUS = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  SUPPRESSED: 'suppressed'
};

/**
 * Smart Alert Generator Class
 */
class SmartAlertGenerator extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      deduplicationWindow: options.deduplicationWindow || 5 * 60 * 1000, // 5 minutes
      groupingWindow: options.groupingWindow || 60 * 60 * 1000, // 1 hour
      severityCalculation: options.severityCalculation || 'weighted',
      maxAlertsPerHour: options.maxAlertsPerHour || 100,
      enableAggregation: options.enableAggregation !== false,
      enableGrouping: options.enableGrouping !== false,
      alertRetention: options.alertRetention || 7 * 24 * 60 * 60 * 1000, // 7 days
      ...options
    };

    // Alert storage
    this.alerts = new Map(); // alertId -> alert
    this.alertHistory = new Map(); // monitorId -> [alerts]
    this.alertGroups = new Map(); // groupId -> [alerts]
    this.suppressionRules = new Map(); // ruleId -> rule
    this.alertMetrics = {};
  }

  /**
   * Process and generate alert
   * @param {Object} rawAlert - Raw alert data
   * @returns {Object} Processed alert
   */
  processAlert(rawAlert) {
    // Deduplicate
    const existingAlert = this.findDuplicate(rawAlert);
    if (existingAlert) {
      return this.handleDuplicate(existingAlert, rawAlert);
    }

    // Check suppression rules
    if (this.isSuppressed(rawAlert)) {
      return { suppressed: true, rule: this.getSuppressingRule(rawAlert) };
    }

    // Calculate severity
    const severity = this.calculateSeverity(rawAlert);
    rawAlert.severity = severity;

    // Create alert
    const alert = {
      id: this.generateAlertId(),
      ...rawAlert,
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      status: ALERT_STATUS.ACTIVE,
      priority: this.calculatePriority(rawAlert, severity),
      acknowledgedAt: null,
      resolvedAt: null,
      duplicateCount: 0,
      fingerprint: this.createFingerprint(rawAlert)
    };

    // Store alert
    this.alerts.set(alert.id, alert);

    // Track in history
    if (!this.alertHistory.has(rawAlert.monitorId)) {
      this.alertHistory.set(rawAlert.monitorId, []);
    }
    this.alertHistory.get(rawAlert.monitorId).push(alert);

    // Group if applicable
    if (this.options.enableGrouping) {
      this.groupAlert(alert);
    }

    // Emit alert event
    this.emit('alert-generated', alert);

    // Track metrics
    this.updateMetrics(alert);

    // Check rate limiting
    if (this.isRateLimited()) {
      this.emit('rate-limit-exceeded', {
        hour: new Date().getHours(),
        alertCount: this.getAlertsInWindow(60 * 60 * 1000)
      });
    }

    return alert;
  }

  /**
   * Find duplicate alert
   * @private
   */
  findDuplicate(rawAlert) {
    const fingerprint = this.createFingerprint(rawAlert);
    const window = this.options.deduplicationWindow;
    const cutoff = Date.now() - window;

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.fingerprint === fingerprint &&
          alert.timestamp >= cutoff &&
          alert.status === ALERT_STATUS.ACTIVE) {
        return alert;
      }
    }

    return null;
  }

  /**
   * Handle duplicate alert
   * @private
   */
  handleDuplicate(existingAlert, newAlertData) {
    existingAlert.duplicateCount++;
    existingAlert.lastOccurred = Date.now();

    // Increase severity if duplicates accumulate
    const dupFactor = 1 + (existingAlert.duplicateCount * 0.1);
    existingAlert.severityScore = Math.min(5, existingAlert.severityScore * dupFactor);

    this.emit('duplicate-alert', {
      alertId: existingAlert.id,
      duplicateCount: existingAlert.duplicateCount,
      originalAlert: existingAlert
    });

    return {
      isDuplicate: true,
      originalAlertId: existingAlert.id,
      duplicateCount: existingAlert.duplicateCount
    };
  }

  /**
   * Create fingerprint for deduplication
   * @private
   */
  createFingerprint(alert) {
    const parts = [
      alert.type || '',
      alert.monitorId || '',
      alert.source || '',
      Math.floor((alert.severity || 0) / 100) * 100 // Round to nearest 100
    ];

    return parts.join(':');
  }

  /**
   * Calculate alert severity
   * @private
   */
  calculateSeverity(alert) {
    let score = 0;

    // Base severity from alert type
    if (alert.baseSeverity) {
      score += alert.baseSeverity;
    }

    // Magnitude component
    if (alert.magnitude !== undefined) {
      score += alert.magnitude * 2;
    }

    // Confidence component
    if (alert.confidence !== undefined) {
      score += alert.confidence;
    }

    // Business impact
    if (alert.businessImpact) {
      score += alert.businessImpact * 1.5;
    }

    // Frequency component
    if (alert.frequency !== undefined) {
      score += Math.min(1, alert.frequency);
    }

    // Normalize to 1-5
    const normalized = Math.max(1, Math.min(5, score));

    return {
      score: normalized,
      level: this.getSeverityLevel(normalized),
      factors: {
        baseSeverity: alert.baseSeverity,
        magnitude: alert.magnitude,
        confidence: alert.confidence,
        businessImpact: alert.businessImpact,
        frequency: alert.frequency
      }
    };
  }

  /**
   * Get severity level name
   * @private
   */
  getSeverityLevel(score) {
    if (score >= 4.5) return 'CRITICAL';
    if (score >= 3.5) return 'HIGH';
    if (score >= 2.5) return 'MEDIUM';
    if (score >= 1.5) return 'LOW';
    return 'INFO';
  }

  /**
   * Calculate alert priority
   * @private
   */
  calculatePriority(alert, severity) {
    let priority = severity.score;

    // Boost priority for certain types
    const priorityBoosts = {
      'price-drop': 1.2,
      'anomaly-critical': 1.3,
      'competitor-move': 1.1
    };

    priority *= (priorityBoosts[alert.type] || 1);

    // Time sensitivity
    if (alert.timeSensitive) {
      priority *= 1.2;
    }

    return Math.min(5, priority);
  }

  /**
   * Check if alert is suppressed
   * @private
   */
  isSuppressed(alert) {
    for (const [ruleId, rule] of this.suppressionRules.entries()) {
      if (this.matchesRule(alert, rule)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if alert matches suppression rule
   * @private
   */
  matchesRule(alert, rule) {
    if (rule.type && alert.type !== rule.type) return false;
    if (rule.monitorId && alert.monitorId !== rule.monitorId) return false;
    if (rule.severityMax && alert.severity > rule.severityMax) return false;
    if (rule.severityMin && alert.severity < rule.severityMin) return false;

    if (rule.customMatcher && typeof rule.customMatcher === 'function') {
      return rule.customMatcher(alert);
    }

    return true;
  }

  /**
   * Get suppressing rule for alert
   * @private
   */
  getSuppressingRule(alert) {
    for (const [ruleId, rule] of this.suppressionRules.entries()) {
      if (this.matchesRule(alert, rule)) {
        return { id: ruleId, rule };
      }
    }
    return null;
  }

  /**
   * Group related alerts
   * @private
   */
  groupAlert(alert) {
    const groupKey = this.createGroupKey(alert);
    const cutoff = Date.now() - this.options.groupingWindow;

    // Find existing group
    let groupId = null;
    for (const [gid, alerts] of this.alertGroups.entries()) {
      if (alerts.length > 0 && alerts[0].groupKey === groupKey &&
          alerts[alerts.length - 1].timestamp >= cutoff) {
        groupId = gid;
        break;
      }
    }

    // Create new group if needed
    if (!groupId) {
      groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.alertGroups.set(groupId, []);
    }

    // Add to group
    alert.groupId = groupId;
    alert.groupKey = groupKey;
    this.alertGroups.get(groupId).push(alert);
  }

  /**
   * Create group key for alerts
   * @private
   */
  createGroupKey(alert) {
    return `${alert.type}:${alert.monitorId}`;
  }

  /**
   * Check rate limiting
   * @private
   */
  isRateLimited() {
    const count = this.getAlertsInWindow(60 * 60 * 1000);
    return count >= this.options.maxAlertsPerHour;
  }

  /**
   * Get alert count in time window
   * @private
   */
  getAlertsInWindow(windowMs) {
    const cutoff = Date.now() - windowMs;
    let count = 0;

    for (const alert of this.alerts.values()) {
      if (alert.timestamp >= cutoff) {
        count++;
      }
    }

    return count;
  }

  /**
   * Update metrics
   * @private
   */
  updateMetrics(alert) {
    const hour = new Date().getHours();
    if (!this.alertMetrics[hour]) {
      this.alertMetrics[hour] = { count: 0, bySeverity: {} };
    }

    this.alertMetrics[hour].count++;
    const level = alert.severity.level;
    this.alertMetrics[hour].bySeverity[level] = (this.alertMetrics[hour].bySeverity[level] || 0) + 1;
  }

  /**
   * Generate alert ID
   * @private
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Acknowledge alert
   * @param {string} alertId - Alert ID
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = ALERT_STATUS.ACKNOWLEDGED;
      alert.acknowledgedAt = Date.now();
      this.emit('alert-acknowledged', alert);
    }
  }

  /**
   * Resolve alert
   * @param {string} alertId - Alert ID
   */
  resolveAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = ALERT_STATUS.RESOLVED;
      alert.resolvedAt = Date.now();
      this.emit('alert-resolved', alert);
    }
  }

  /**
   * Add suppression rule
   * @param {string} ruleId - Rule identifier
   * @param {Object} rule - Rule definition
   */
  addSuppressionRule(ruleId, rule) {
    this.suppressionRules.set(ruleId, {
      ...rule,
      createdAt: Date.now()
    });
  }

  /**
   * Remove suppression rule
   * @param {string} ruleId - Rule identifier
   */
  removeSuppressionRule(ruleId) {
    this.suppressionRules.delete(ruleId);
  }

  /**
   * Get alerts by filter
   * @param {Object} filter - Filter criteria
   * @returns {Array} Filtered alerts
   */
  getAlerts(filter = {}) {
    let result = Array.from(this.alerts.values());

    if (filter.monitorId) {
      result = result.filter(a => a.monitorId === filter.monitorId);
    }

    if (filter.status) {
      result = result.filter(a => a.status === filter.status);
    }

    if (filter.severity) {
      result = result.filter(a => a.severity.level === filter.severity);
    }

    if (filter.type) {
      result = result.filter(a => a.type === filter.type);
    }

    if (filter.since) {
      result = result.filter(a => a.timestamp >= filter.since);
    }

    if (filter.limit) {
      result = result.slice(-filter.limit);
    }

    // Sort by priority (highest first)
    result.sort((a, b) => b.priority - a.priority);

    return result;
  }

  /**
   * Get alert group
   * @param {string} groupId - Group identifier
   * @returns {Object} Group data
   */
  getAlertGroup(groupId) {
    const alerts = this.alertGroups.get(groupId) || [];

    if (alerts.length === 0) return null;

    const group = {
      id: groupId,
      count: alerts.length,
      firstAlert: alerts[0],
      lastAlert: alerts[alerts.length - 1],
      types: new Set(alerts.map(a => a.type)),
      monitors: new Set(alerts.map(a => a.monitorId)),
      severity: Math.max(...alerts.map(a => a.severity.score)),
      alerts
    };

    return group;
  }

  /**
   * Get alerts grouped
   * @returns {Map} Grouped alerts
   */
  getGroupedAlerts() {
    const grouped = new Map();

    for (const [groupId, alerts] of this.alertGroups.entries()) {
      const activeAlerts = alerts.filter(a => a.status === ALERT_STATUS.ACTIVE);
      if (activeAlerts.length > 0) {
        grouped.set(groupId, activeAlerts);
      }
    }

    return grouped;
  }

  /**
   * Get alert summary
   * @param {string} monitorId - Monitor ID (optional)
   * @returns {Object} Summary statistics
   */
  getSummary(monitorId = null) {
    let alerts = Array.from(this.alerts.values());

    if (monitorId) {
      alerts = alerts.filter(a => a.monitorId === monitorId);
    }

    const summary = {
      total: alerts.length,
      active: alerts.filter(a => a.status === ALERT_STATUS.ACTIVE).length,
      acknowledged: alerts.filter(a => a.status === ALERT_STATUS.ACKNOWLEDGED).length,
      resolved: alerts.filter(a => a.status === ALERT_STATUS.RESOLVED).length,
      bySeverity: {},
      byType: {},
      alerts: alerts.slice(-10) // Last 10 alerts
    };

    // Count by severity
    alerts.forEach(a => {
      const level = a.severity.level;
      summary.bySeverity[level] = (summary.bySeverity[level] || 0) + 1;
    });

    // Count by type
    alerts.forEach(a => {
      summary.byType[a.type] = (summary.byType[a.type] || 0) + 1;
    });

    return summary;
  }

  /**
   * Clean up old alerts
   */
  cleanup() {
    const cutoff = Date.now() - this.options.alertRetention;
    let deleted = 0;

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoff && alert.status !== ALERT_STATUS.ACTIVE) {
        this.alerts.delete(id);
        deleted++;
      }
    }

    return { deleted, remaining: this.alerts.size };
  }
}

module.exports = {
  SmartAlertGenerator,
  ALERT_SEVERITY,
  ALERT_STATUS
};
