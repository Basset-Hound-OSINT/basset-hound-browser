/**
 * Health Check System for Basset Hound Browser
 *
 * Provides:
 * - /health endpoint with detailed status
 * - Database connectivity checks
 * - Redis connectivity checks
 * - External service health
 * - Health status history (30-day)
 * - SLA tracking
 *
 * @module src/monitoring/health-checker
 * @requires events
 */

const EventEmitter = require('events');

/**
 * Health Status
 */
const HEALTH_STATUS = {
  UP: 'up',
  DEGRADED: 'degraded',
  DOWN: 'down',
  UNKNOWN: 'unknown'
};

/**
 * Component Health Checker
 * Monitors health of system components
 */
class HealthChecker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      checkInterval: options.checkInterval || 30000, // 30 seconds
      retentionPeriod: options.retentionPeriod || 2592000000, // 30 days
      checkTimeout: options.checkTimeout || 5000, // 5 seconds
      ...options
    };

    // Component status
    this.components = new Map();
    this.history = [];
    this.lastCheck = null;

    // Initialize components
    this._initializeComponents();

    // Start health check loop
    this.checkInterval = setInterval(() => this._checkHealth(), this.options.checkInterval);

    // Initial check
    this._checkHealth();
  }

  /**
   * Initialize health check components
   * @private
   */
  _initializeComponents() {
    // Core system
    this.registerComponent({
      name: 'websocket_server',
      description: 'WebSocket API Server',
      critical: true
    });

    this.registerComponent({
      name: 'message_broker',
      description: 'Message Broker',
      critical: true
    });

    // Optional services
    this.registerComponent({
      name: 'database',
      description: 'Database Connection',
      critical: false
    });

    this.registerComponent({
      name: 'redis',
      description: 'Redis Cache',
      critical: false
    });

    this.registerComponent({
      name: 'storage',
      description: 'File Storage',
      critical: false
    });

    // Integration services
    this.registerComponent({
      name: 'slack_integration',
      description: 'Slack Integration',
      critical: false
    });

    this.registerComponent({
      name: 'pagerduty_integration',
      description: 'PagerDuty Integration',
      critical: false
    });
  }

  /**
   * Register a health check component
   */
  registerComponent(config) {
    const component = {
      name: config.name,
      description: config.description,
      critical: config.critical || false,
      checkFn: config.checkFn,
      status: HEALTH_STATUS.UNKNOWN,
      lastCheck: null,
      checkCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      uptime: 100,
      responseTime: 0
    };

    this.components.set(config.name, component);
  }

  /**
   * Perform health check
   * @private
   */
  async _checkHealth() {
    const timestamp = Date.now();
    const checkResults = {};
    const promises = [];

    // Check all components
    for (const [name, component] of this.components) {
      promises.push(
        this._checkComponent(component, timestamp)
          .then(result => {
            checkResults[name] = result;
          })
      );
    }

    // Wait for all checks
    await Promise.all(promises);

    // Record history
    this._recordHistory(timestamp, checkResults);

    // Determine overall health
    const overallHealth = this._calculateOverallHealth();

    this.lastCheck = {
      timestamp,
      status: overallHealth,
      components: checkResults
    };

    this.emit('health:checked', this.lastCheck);
  }

  /**
   * Check individual component
   * @private
   */
  async _checkComponent(component, timestamp) {
    component.checkCount++;
    const startTime = Date.now();

    try {
      let status = HEALTH_STATUS.UP;

      // Use custom check function if provided
      if (component.checkFn && typeof component.checkFn === 'function') {
        const result = await Promise.race([
          component.checkFn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Check timeout')), this.options.checkTimeout)
          )
        ]);

        if (!result) {
          status = HEALTH_STATUS.DOWN;
        }
      }

      // Update component status
      component.status = status;
      component.lastCheck = timestamp;
      component.responseTime = Date.now() - startTime;
      component.consecutiveFailures = status === HEALTH_STATUS.DOWN ? component.consecutiveFailures + 1 : 0;

      if (status === HEALTH_STATUS.DOWN) {
        component.failureCount++;
      }

      // Calculate uptime
      if (component.checkCount > 0) {
        component.uptime = ((component.checkCount - component.failureCount) / component.checkCount) * 100;
      }

      return {
        name: component.name,
        description: component.description,
        status,
        responseTime: component.responseTime,
        lastCheck: timestamp,
        checkCount: component.checkCount,
        failureCount: component.failureCount,
        uptime: component.uptime
      };
    } catch (e) {
      component.status = HEALTH_STATUS.DOWN;
      component.lastCheck = timestamp;
      component.responseTime = Date.now() - startTime;
      component.failureCount++;
      component.consecutiveFailures++;

      if (component.checkCount > 0) {
        component.uptime = ((component.checkCount - component.failureCount) / component.checkCount) * 100;
      }

      return {
        name: component.name,
        description: component.description,
        status: HEALTH_STATUS.DOWN,
        responseTime: component.responseTime,
        lastCheck: timestamp,
        error: e.message,
        checkCount: component.checkCount,
        failureCount: component.failureCount,
        uptime: component.uptime
      };
    }
  }

  /**
   * Calculate overall health status
   * @private
   */
  _calculateOverallHealth() {
    let hasCritical = false;
    let criticalUp = true;
    let allUp = true;

    for (const component of this.components.values()) {
      if (component.critical) {
        hasCritical = true;
        if (component.status !== HEALTH_STATUS.UP) {
          criticalUp = false;
        }
      }

      if (component.status !== HEALTH_STATUS.UP) {
        allUp = false;
      }
    }

    // Overall status determination
    if (hasCritical && !criticalUp) {
      return HEALTH_STATUS.DOWN;
    } else if (!allUp) {
      return HEALTH_STATUS.DEGRADED;
    } else {
      return HEALTH_STATUS.UP;
    }
  }

  /**
   * Record health check history
   * @private
   */
  _recordHistory(timestamp, results) {
    const entry = {
      timestamp,
      status: this._calculateOverallHealth(),
      components: results
    };

    this.history.push(entry);

    // Cleanup old history
    const cutoff = timestamp - this.options.retentionPeriod;
    this.history = this.history.filter(entry => entry.timestamp > cutoff);
  }

  /**
   * Get current health status
   */
  getHealth() {
    if (!this.lastCheck) {
      return {
        status: HEALTH_STATUS.UNKNOWN,
        timestamp: Date.now(),
        message: 'Health check not yet performed'
      };
    }

    const criticalIssues = [];
    const warnings = [];

    for (const result of Object.values(this.lastCheck.components)) {
      const component = this.components.get(result.name);

      if (component?.critical && result.status !== HEALTH_STATUS.UP) {
        criticalIssues.push(`${result.name}: ${result.status}`);
      } else if (result.status !== HEALTH_STATUS.UP) {
        warnings.push(`${result.name}: ${result.status}`);
      }
    }

    return {
      status: this.lastCheck.status,
      timestamp: this.lastCheck.timestamp,
      components: this.lastCheck.components,
      criticalIssues,
      warnings,
      uptime: this._calculateSystemUptime(),
      checks: {
        total: Array.from(this.components.values()).reduce((sum, c) => sum + c.checkCount, 0),
        failed: Array.from(this.components.values()).reduce((sum, c) => sum + c.failureCount, 0)
      }
    };
  }

  /**
   * Get component status
   */
  getComponentStatus(name) {
    const component = this.components.get(name);
    if (!component) {
      return null;
    }

    return {
      name: component.name,
      description: component.description,
      status: component.status,
      critical: component.critical,
      lastCheck: component.lastCheck,
      responseTime: component.responseTime,
      checkCount: component.checkCount,
      failureCount: component.failureCount,
      consecutiveFailures: component.consecutiveFailures,
      uptime: component.uptime
    };
  }

  /**
   * Get all components status
   */
  getAllComponentsStatus() {
    const components = [];
    for (const component of this.components.values()) {
      components.push(this.getComponentStatus(component.name));
    }
    return components;
  }

  /**
   * Get health history
   */
  getHistory(hours = 24) {
    const cutoff = Date.now() - (hours * 3600 * 1000);
    return this.history.filter(entry => entry.timestamp > cutoff);
  }

  /**
   * Get health statistics
   */
  getStatistics(days = 30) {
    const cutoff = Date.now() - (days * 24 * 3600 * 1000);
    const relevantHistory = this.history.filter(entry => entry.timestamp > cutoff);

    if (relevantHistory.length === 0) {
      return {
        period: `${days} days`,
        uptime: 0,
        avgResponseTime: 0,
        incidents: 0,
        degradations: 0
      };
    }

    let totalUpTime = 0;
    let totalResponseTime = 0;
    let responseCount = 0;
    let incidents = 0;
    let degradations = 0;
    let lastStatus = null;

    for (const entry of relevantHistory) {
      if (entry.status === HEALTH_STATUS.UP) {
        totalUpTime++;
      } else if (entry.status === HEALTH_STATUS.DOWN && lastStatus !== HEALTH_STATUS.DOWN) {
        incidents++;
      } else if (entry.status === HEALTH_STATUS.DEGRADED && lastStatus !== HEALTH_STATUS.DEGRADED) {
        degradations++;
      }

      lastStatus = entry.status;

      for (const component of Object.values(entry.components)) {
        totalResponseTime += component.responseTime || 0;
        responseCount++;
      }
    }

    return {
      period: `${days} days`,
      uptime: (totalUpTime / relevantHistory.length) * 100,
      avgResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
      totalChecks: relevantHistory.length,
      incidents,
      degradations
    };
  }

  /**
   * Calculate system uptime percentage
   * @private
   */
  _calculateSystemUptime() {
    if (this.history.length === 0) {
      return 100;
    }

    const upCount = this.history.filter(h => h.status === HEALTH_STATUS.UP).length;
    return (upCount / this.history.length) * 100;
  }

  /**
   * Get SLA summary
   */
  getSLASummary() {
    const stats = this.getStatistics(30);
    const slaTarget = 99.9; // 99.9% uptime SLA

    return {
      slaTarget: `${slaTarget}%`,
      actual: `${stats.uptime.toFixed(2)}%`,
      compliant: stats.uptime >= slaTarget,
      deficit: Math.max(0, slaTarget - stats.uptime),
      allowedDowntime: {
        minutes: Math.round((30 * 24 * 60 * (100 - slaTarget)) / 100),
        description: `${Math.round((30 * 24 * 60 * (100 - slaTarget)) / 100)} minutes per month`
      }
    };
  }

  /**
   * Set custom check function for component
   */
  setComponentCheckFn(componentName, checkFn) {
    const component = this.components.get(componentName);
    if (component) {
      component.checkFn = checkFn;
    }
  }

  /**
   * Force immediate health check
   */
  async checkNow() {
    await this._checkHealth();
    return this.getHealth();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = {
  HealthChecker,
  HEALTH_STATUS
};
