const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Alert types and severity levels
 */
const ALERT_TYPES = {
  HIGH_LATENCY: 'high_latency',
  HIGH_ERROR_RATE: 'high_error_rate',
  LOW_SUCCESS_RATE: 'low_success_rate',
  MEMORY_GROWTH: 'memory_growth',
  CPU_OVERLOAD: 'cpu_overload',
  CONNECTION_SPIKE: 'connection_spike',
  SESSION_TIMEOUT: 'session_timeout',
  RESOURCE_EXHAUSTION: 'resource_exhaustion'
};

/**
 * Default alert thresholds
 */
const DEFAULT_THRESHOLDS = {
  latencyP99: 100, // milliseconds
  errorRatePercent: 5, // percent
  successRatePercent: 95, // percent
  memoryGrowthMbPerHour: 10,
  cpuUsagePercent: 80,
  connectionSpikeDelta: 50, // new connections in 1m
  sessionMaxDurationMs: 3600000, // 1 hour
  memoryThresholdMb: 256 // absolute limit
};

/**
 * AlertManager - Threshold-based alert system
 *
 * Monitors metrics against configured thresholds and generates
 * alerts when violations are detected. Supports alert suppression,
 * history tracking, and event emission.
 */
class AlertManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    this.evaluationInterval = options.evaluationInterval || 5000; // Check every 5 seconds

    // Alert storage
    this.activeAlerts = new Map(); // alertId => alert
    this.alertHistory = []; // Last 1000 alerts
    this.maxHistorySize = options.maxHistorySize || 1000;

    // Alert suppression tracking
    this.suppressions = new Map(); // alertType => untilTimestamp

    // Cooldown tracking to avoid rapid re-triggering
    this.alertCooldowns = new Map(); // alertType => untilTimestamp
    this.cooldownDuration = options.cooldownDuration || 30000; // 30 seconds between same alert

    // Previous metric values for spike/trend detection
    this.previousMetrics = null;

    // Previous connection count for spike detection
    this.previousConnectionCount = 0;

    // Setup periodic threshold evaluation
    this.evaluationTimer = setInterval(
      () => this._evaluateMetrics(),
      this.evaluationInterval
    );
  }

  /**
   * Evaluate metrics against thresholds and trigger alerts
   * @param {Object} metrics - Current metrics snapshot
   */
  evaluateMetrics(metrics) {
    this.currentMetrics = metrics;
    this._evaluateMetrics();
  }

  /**
   * Internal metrics evaluation
   * @private
   */
  _evaluateMetrics() {
    if (!this.currentMetrics) {
      return;
    }

    const metrics = this.currentMetrics;
    const now = Date.now();

    // Check latency
    if (metrics.commands.latency.p99 > this.thresholds.latencyP99) {
      this._triggerAlert(
        ALERT_TYPES.HIGH_LATENCY,
        'critical',
        'latency_p99',
        metrics.commands.latency.p99,
        this.thresholds.latencyP99
      );
    }

    // Check error rate
    const errorRatePercent = metrics.errors.rate * 100;
    if (errorRatePercent > this.thresholds.errorRatePercent) {
      this._triggerAlert(
        ALERT_TYPES.HIGH_ERROR_RATE,
        'critical',
        'error_rate',
        errorRatePercent,
        this.thresholds.errorRatePercent
      );
    }

    // Check success rate
    if (metrics.commands.total > 0) {
      const successRate = (metrics.commands.success / metrics.commands.total) * 100;
      if (successRate < this.thresholds.successRatePercent) {
        this._triggerAlert(
          ALERT_TYPES.LOW_SUCCESS_RATE,
          'warning',
          'success_rate',
          successRate,
          this.thresholds.successRatePercent
        );
      }
    }

    // Check memory growth
    if (metrics.resources.memory.growthRate > this.thresholds.memoryGrowthMbPerHour) {
      this._triggerAlert(
        ALERT_TYPES.MEMORY_GROWTH,
        'warning',
        'memory_growth_rate',
        metrics.resources.memory.growthRate,
        this.thresholds.memoryGrowthMbPerHour
      );
    }

    // Check memory threshold
    if (metrics.resources.memory.heapUsed > this.thresholds.memoryThresholdMb) {
      this._triggerAlert(
        ALERT_TYPES.RESOURCE_EXHAUSTION,
        'critical',
        'memory_usage',
        metrics.resources.memory.heapUsed,
        this.thresholds.memoryThresholdMb
      );
    }

    // Check CPU usage
    if (metrics.resources.cpu.usage > this.thresholds.cpuUsagePercent && metrics.resources.cpu.usage > 0) {
      this._triggerAlert(
        ALERT_TYPES.CPU_OVERLOAD,
        'warning',
        'cpu_usage',
        metrics.resources.cpu.usage,
        this.thresholds.cpuUsagePercent
      );
    }

    // Check connection spikes
    const currentConnections = metrics.connections.active;
    if (currentConnections - this.previousConnectionCount > this.thresholds.connectionSpikeDelta) {
      this._triggerAlert(
        ALERT_TYPES.CONNECTION_SPIKE,
        'warning',
        'connection_delta',
        currentConnections - this.previousConnectionCount,
        this.thresholds.connectionSpikeDelta
      );
    }
    this.previousConnectionCount = currentConnections;

    this.previousMetrics = metrics;
  }

  /**
   * Trigger an alert (internal method with deduplication)
   * @private
   */
  _triggerAlert(type, severity, metric, actualValue, threshold) {
    const now = Date.now();

    // Check if alert is suppressed
    const suppressUntil = this.suppressions.get(type);
    if (suppressUntil && suppressUntil > now) {
      return; // Alert is suppressed
    }

    // Check cooldown (prevent rapid re-triggering)
    const cooldownUntil = this.alertCooldowns.get(type);
    if (cooldownUntil && cooldownUntil > now) {
      return; // Alert in cooldown period
    }

    // Check if alert already exists
    let existingAlert = null;
    for (const alert of this.activeAlerts.values()) {
      if (alert.type === type && alert.metric === metric) {
        existingAlert = alert;
        break;
      }
    }

    if (existingAlert) {
      // Update existing alert
      existingAlert.actualValue = actualValue;
      existingAlert.duration = now - existingAlert.timestamp;
      existingAlert.history.push({
        timestamp: now,
        value: actualValue,
        suppressed: false
      });
      return;
    }

    // Create new alert
    const alert = {
      id: this._generateAlertId(),
      type,
      severity,
      metric,
      threshold,
      actualValue,
      timestamp: now,
      duration: 0,
      suppressed: false,
      suppressedUntil: null,
      history: [
        {
          timestamp: now,
          value: actualValue,
          suppressed: false
        }
      ]
    };

    this.activeAlerts.set(alert.id, alert);

    // Add to history
    this.alertHistory.push(alert);
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.shift();
    }

    // Set cooldown
    this.alertCooldowns.set(type, now + this.cooldownDuration);

    // Emit alert event
    this.emit('alert', alert);
  }

  /**
   * Generate unique alert ID
   * @private
   */
  _generateAlertId() {
    return `alert_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Set alert threshold
   * @param {string} alertType - Alert type constant
   * @param {number} value - New threshold value
   */
  setThreshold(alertType, value) {
    const oldThreshold = this.thresholds[alertType];

    // Map alert type to threshold key
    const thresholdKey = this._getThresholdKey(alertType);
    if (!thresholdKey) {
      throw new Error(`Unknown alert type: ${alertType}`);
    }

    this.thresholds[thresholdKey] = value;

    return {
      alertType,
      oldThreshold,
      newThreshold: value
    };
  }

  /**
   * Map alert type to threshold key
   * @private
   */
  _getThresholdKey(alertType) {
    const mapping = {
      [ALERT_TYPES.HIGH_LATENCY]: 'latencyP99',
      [ALERT_TYPES.HIGH_ERROR_RATE]: 'errorRatePercent',
      [ALERT_TYPES.LOW_SUCCESS_RATE]: 'successRatePercent',
      [ALERT_TYPES.MEMORY_GROWTH]: 'memoryGrowthMbPerHour',
      [ALERT_TYPES.CPU_OVERLOAD]: 'cpuUsagePercent',
      [ALERT_TYPES.CONNECTION_SPIKE]: 'connectionSpikeDelta',
      [ALERT_TYPES.SESSION_TIMEOUT]: 'sessionMaxDurationMs',
      [ALERT_TYPES.RESOURCE_EXHAUSTION]: 'memoryThresholdMb'
    };

    return mapping[alertType];
  }

  /**
   * Suppress an alert type
   * @param {string} alertType - Alert type to suppress
   * @param {number} durationMs - How long to suppress (milliseconds)
   */
  suppressAlert(alertType, durationMs) {
    const suppressUntil = Date.now() + durationMs;
    this.suppressions.set(alertType, suppressUntil);

    // Remove active alerts of this type from activeAlerts
    const toRemove = [];
    for (const [id, alert] of this.activeAlerts.entries()) {
      if (alert.type === alertType) {
        alert.suppressed = true;
        alert.suppressedUntil = suppressUntil;
        toRemove.push(id);
      }
    }

    toRemove.forEach(id => this.activeAlerts.delete(id));

    return { suppressUntil };
  }

  /**
   * Get all active alerts, optionally filtered by severity
   * @param {string} severity - Optional: 'warning' or 'critical'
   * @returns {Array} Array of active alerts
   */
  getActiveAlerts(severity = null) {
    const alerts = Array.from(this.activeAlerts.values());

    if (severity) {
      return alerts.filter(a => a.severity === severity);
    }

    return alerts;
  }

  /**
   * Get alert history
   * @param {number} limit - Maximum number of alerts to return (default 100)
   * @returns {Array} Recent alerts from history
   */
  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Clear active alerts (useful for testing)
   */
  clearActiveAlerts() {
    this.activeAlerts.clear();
  }

  /**
   * Get current configuration
   * @returns {Object} Current thresholds and settings
   */
  getConfiguration() {
    return {
      thresholds: { ...this.thresholds },
      evaluationInterval: this.evaluationInterval,
      cooldownDuration: this.cooldownDuration
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }
    this.removeAllListeners();
  }
}

module.exports = {
  AlertManager,
  ALERT_TYPES,
  DEFAULT_THRESHOLDS
};
