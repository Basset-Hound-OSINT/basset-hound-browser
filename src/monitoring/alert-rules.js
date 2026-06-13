/**
 * Alert Rules Engine for Basset Hound Browser
 *
 * Evaluates alert rules against metrics
 * Supports:
 * - Threshold-based rules (latency, throughput, errors)
 * - Anomaly detection (deviation from baseline)
 * - Composite rules (multi-metric evaluation)
 * - Escalation levels (critical, high, medium, low)
 *
 * @module src/monitoring/alert-rules
 * @requires events
 */

const EventEmitter = require('events');

/**
 * Alert Severity Levels
 */
const ALERT_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * Alert Rule Types
 */
const ALERT_TYPES = {
  THRESHOLD: 'threshold',
  ANOMALY: 'anomaly',
  COMPOSITE: 'composite',
  RATE_OF_CHANGE: 'rate_of_change'
};

/**
 * Alert Rules Engine
 * Evaluates metrics against configured rules
 */
class AlertRulesEngine extends EventEmitter {
  constructor(metricsCollector, options = {}) {
    super();

    this.metricsCollector = metricsCollector;
    this.options = {
      evaluationInterval: options.evaluationInterval || 30000, // 30 seconds
      anomalyWindow: options.anomalyWindow || 300000, // 5 minutes
      ...options
    };

    this.rules = new Map();
    this.alerts = new Map(); // metric_name -> alert
    this.baselines = new Map(); // metric_name -> baseline values

    // Initialize default rules
    this._initializeDefaultRules();

    // Start evaluation loop
    this.evaluationInterval = setInterval(() => this._evaluate(), this.options.evaluationInterval);
  }

  /**
   * Initialize default alert rules
   * @private
   */
  _initializeDefaultRules() {
    // WebSocket Command Rules
    this.registerRule({
      name: 'high_command_failure_rate',
      description: 'High rate of WebSocket command failures',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.CRITICAL,
      metric: 'websocket_commands_failed',
      condition: (value) => value > 50, // More than 50 failed commands
      window: 60000 // 1 minute
    });

    // Message Latency Rules
    this.registerRule({
      name: 'high_message_latency',
      description: 'WebSocket message latency exceeds threshold',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.HIGH,
      metric: 'websocket_message_latency_ms',
      condition: (value) => value > 1000, // > 1 second
      window: 60000
    });

    // Throughput Rules
    this.registerRule({
      name: 'low_throughput',
      description: 'Message throughput below threshold',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.MEDIUM,
      metric: 'websocket_throughput_msgs_per_sec',
      condition: (value) => value < 10, // Less than 10 msgs/sec
      window: 300000 // 5 minutes
    });

    // Error Rate Rules
    this.registerRule({
      name: 'high_error_rate',
      description: 'High WebSocket error rate',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.HIGH,
      metric: 'websocket_errors_total',
      condition: (value, previous) => {
        // Alert if errors increased significantly
        return previous && (value - previous) > 20;
      },
      window: 60000
    });

    // Connection Rules
    this.registerRule({
      name: 'no_active_connections',
      description: 'No active WebSocket connections',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.CRITICAL,
      metric: 'websocket_active_connections',
      condition: (value) => value === 0,
      window: 30000
    });

    // Reconnection Rules
    this.registerRule({
      name: 'excessive_reconnections',
      description: 'Excessive WebSocket reconnection attempts',
      type: ALERT_TYPES.RATE_OF_CHANGE,
      severity: ALERT_SEVERITY.HIGH,
      metric: 'websocket_reconnections',
      condition: (value, previous) => {
        return previous && (value - previous) > 10; // > 10 reconnections in window
      },
      window: 300000 // 5 minutes
    });

    // Memory Rules
    this.registerRule({
      name: 'high_memory_usage',
      description: 'Process heap memory usage is high',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.HIGH,
      metric: 'memory_heap_used_mb',
      condition: (value) => value > 500, // > 500 MB
      window: 120000 // 2 minutes
    });

    this.registerRule({
      name: 'memory_pressure',
      description: 'System memory pressure high',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.MEDIUM,
      metric: 'system_memory_usage_percent',
      condition: (value) => value > 85, // > 85% system memory
      window: 120000
    });

    // CPU Rules
    this.registerRule({
      name: 'high_cpu_usage',
      description: 'CPU usage is high',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.HIGH,
      metric: 'system_cpu_usage_percent',
      condition: (value) => value > 80, // > 80% CPU
      window: 120000
    });

    // Broker Rules
    this.registerRule({
      name: 'message_broker_error',
      description: 'Message broker encountered errors',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.HIGH,
      metric: 'broker_errors',
      condition: (value, previous) => {
        return previous && (value - previous) > 5;
      },
      window: 60000
    });

    this.registerRule({
      name: 'large_message_queue',
      description: 'Message broker queue is large',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.MEDIUM,
      metric: 'broker_queue_length',
      condition: (value) => value > 1000, // > 1000 messages queued
      window: 60000
    });

    // Disk Rules
    this.registerRule({
      name: 'disk_space_critical',
      description: 'Disk space usage critical',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.CRITICAL,
      metric: 'system_disk_usage_percent',
      condition: (value) => value > 90, // > 90% disk usage
      window: 300000
    });

    // Extraction Rules
    this.registerRule({
      name: 'high_extraction_failure_rate',
      description: 'High data extraction failure rate',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.MEDIUM,
      metric: 'extractions_failed',
      condition: (value, previous) => {
        return previous && (value - previous) > 10;
      },
      window: 300000
    });

    // Navigation Rules
    this.registerRule({
      name: 'high_page_load_time',
      description: 'Page load time exceeds threshold',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.MEDIUM,
      metric: 'page_load_duration_ms',
      condition: (value) => value > 30000, // > 30 seconds
      window: 300000
    });

    // Cache Rules
    this.registerRule({
      name: 'low_cache_hit_ratio',
      description: 'Cache hit ratio is low',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITY.LOW,
      metric: 'cache_hit_ratio',
      condition: (value) => value < 0.5, // < 50% hit ratio
      window: 600000 // 10 minutes
    });
  }

  /**
   * Register a custom alert rule
   */
  registerRule(ruleConfig) {
    const rule = {
      id: ruleConfig.name,
      name: ruleConfig.name,
      description: ruleConfig.description,
      type: ruleConfig.type || ALERT_TYPES.THRESHOLD,
      severity: ruleConfig.severity || ALERT_SEVERITY.MEDIUM,
      metric: ruleConfig.metric,
      metrics: ruleConfig.metrics, // For composite rules
      condition: ruleConfig.condition,
      window: ruleConfig.window || 60000,
      cooldown: ruleConfig.cooldown || 300000, // 5 minutes before re-alert
      enabled: ruleConfig.enabled !== false,
      createdAt: Date.now(),
      lastEvaluated: null,
      lastAlertTime: null,
      evaluationCount: 0,
      alertCount: 0
    };

    this.rules.set(rule.id, rule);
    this.emit('rule:registered', rule);
  }

  /**
   * Unregister a rule
   */
  unregisterRule(ruleId) {
    this.rules.delete(ruleId);
    this.alerts.delete(ruleId);
    this.emit('rule:unregistered', { ruleId });
  }

  /**
   * Evaluate all rules
   * @private
   */
  _evaluate() {
    const timestamp = Date.now();

    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      try {
        this._evaluateRule(rule, timestamp);
      } catch (e) {
        this.emit('rule:error', {
          ruleId,
          error: e.message,
          timestamp
        });
      }
    }
  }

  /**
   * Evaluate a single rule
   * @private
   */
  _evaluateRule(rule, timestamp) {
    rule.lastEvaluated = timestamp;
    rule.evaluationCount++;

    let conditionMet = false;

    if (rule.type === ALERT_TYPES.THRESHOLD) {
      const metric = this.metricsCollector.getMetric(rule.metric);
      if (metric) {
        const value = metric.type === 'histogram' ? metric.mean : metric.value;
        const previousValue = this._getPreviousValue(rule.metric);

        conditionMet = rule.condition(value, previousValue);
      }
    } else if (rule.type === ALERT_TYPES.COMPOSITE) {
      // Evaluate multiple metrics
      const metricValues = {};
      for (const metric of rule.metrics || []) {
        const m = this.metricsCollector.getMetric(metric);
        metricValues[metric] = m ? (m.type === 'histogram' ? m.mean : m.value) : 0;
      }
      conditionMet = rule.condition(metricValues);
    }

    // Check if alert should be triggered
    if (conditionMet) {
      const existingAlert = this.alerts.get(rule.id);
      const shouldAlert = !existingAlert ||
                         (timestamp - existingAlert.lastTime) > rule.cooldown;

      if (shouldAlert) {
        this._triggerAlert(rule, timestamp);
      }
    } else {
      // Clear alert if condition no longer met
      if (this.alerts.has(rule.id)) {
        this._resolveAlert(rule.id, timestamp);
      }
    }
  }

  /**
   * Trigger an alert
   * @private
   */
  _triggerAlert(rule, timestamp) {
    const alert = {
      ruleId: rule.id,
      ruleName: rule.name,
      description: rule.description,
      severity: rule.severity,
      metric: rule.metric,
      timestamp,
      firstSeen: this.alerts.has(rule.id) ? this.alerts.get(rule.id).firstSeen : timestamp,
      lastTime: timestamp,
      count: (this.alerts.get(rule.id)?.count || 0) + 1,
      status: 'firing'
    };

    this.alerts.set(rule.id, alert);
    rule.lastAlertTime = timestamp;
    rule.alertCount++;

    this.emit('alert:triggered', alert);
  }

  /**
   * Resolve an alert
   * @private
   */
  _resolveAlert(ruleId, timestamp) {
    const alert = this.alerts.get(ruleId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = timestamp;
      alert.duration = timestamp - alert.firstSeen;

      this.emit('alert:resolved', alert);
      this.alerts.delete(ruleId);
    }
  }

  /**
   * Get previous value for rate of change calculation
   * @private
   */
  _getPreviousValue(metricName) {
    if (!this.baselines.has(metricName)) {
      const metric = this.metricsCollector.getMetric(metricName);
      if (metric) {
        this.baselines.set(metricName, metric.type === 'histogram' ? metric.mean : metric.value);
      }
      return null;
    }

    return this.baselines.get(metricName);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts() {
    const alerts = [];
    for (const alert of this.alerts.values()) {
      alerts.push({
        ...alert,
        durationSeconds: (Date.now() - alert.firstSeen) / 1000
      });
    }

    // Sort by severity and time
    const severityOrder = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    };

    return alerts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp - a.timestamp;
    });
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100) {
    // This would require additional storage
    // For now, return active alerts
    return this.getActiveAlerts().slice(0, limit);
  }

  /**
   * Get rules
   */
  getRules(onlyEnabled = false) {
    const rules = [];
    for (const rule of this.rules.values()) {
      if (onlyEnabled && !rule.enabled) continue;
      rules.push({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        type: rule.type,
        enabled: rule.enabled,
        evaluationCount: rule.evaluationCount,
        alertCount: rule.alertCount,
        lastEvaluated: rule.lastEvaluated,
        lastAlertTime: rule.lastAlertTime
      });
    }
    return rules;
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId) {
    return this.rules.get(ruleId);
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId, enabled) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      this.emit('rule:updated', { ruleId, enabled });
    }
  }

  /**
   * Get alert summary
   */
  getSummary() {
    const alerts = this.getActiveAlerts();
    const bySeverity = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };

    for (const alert of alerts) {
      bySeverity[alert.severity].push(alert);
    }

    return {
      timestamp: Date.now(),
      totalActive: alerts.length,
      bySeverity: {
        critical: bySeverity.critical.length,
        high: bySeverity.high.length,
        medium: bySeverity.medium.length,
        low: bySeverity.low.length
      },
      alerts,
      rulesCount: this.rules.size,
      rulesEnabled: Array.from(this.rules.values()).filter(r => r.enabled).length
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = {
  AlertRulesEngine,
  ALERT_SEVERITY,
  ALERT_TYPES
};
