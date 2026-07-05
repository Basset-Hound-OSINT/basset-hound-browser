/**
 * Enhanced Health Checker - v12.3.0
 *
 * Comprehensive health check system with liveness and readiness probes
 * Supports dependency checking and recovery procedures
 *
 * @module src/infrastructure/health-check-enhanced
 * @version 1.0.0
 */

const EventEmitter = require('events');

class HealthChecker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      checkInterval: options.checkInterval || 30000, // 30 seconds
      enableAutoRecovery: options.enableAutoRecovery !== false,
      ...options
    };

    this.checks = new Map();
    this.isHealthy = true;
    this.lastCheckTime = null;
    this.checkInterval = null;

    // Initialize standard checks
    this._initializeStandardChecks();
  }

  /**
   * Initialize standard health checks
   * @private
   */
  _initializeStandardChecks() {
    // Memory check
    this.registerCheck('memory', async () => {
      const mem = process.memoryUsage();
      const percentUsed = (mem.heapUsed / mem.heapTotal) * 100;

      if (percentUsed > 90) {
        return {
          status: 'unhealthy',
          message: `Memory usage critical: ${percentUsed.toFixed(1)}%`,
          percent: percentUsed
        };
      }

      if (percentUsed > 75) {
        return {
          status: 'degraded',
          message: `Memory usage high: ${percentUsed.toFixed(1)}%`,
          percent: percentUsed
        };
      }

      return {
        status: 'healthy',
        message: `Memory usage normal: ${percentUsed.toFixed(1)}%`,
        percent: percentUsed
      };
    });

    // Uptime check
    this.registerCheck('uptime', async () => {
      const uptime = process.uptime();
      return {
        status: 'healthy',
        message: `Uptime: ${Math.floor(uptime)}s`,
        seconds: uptime
      };
    });

    // Event loop lag check
    this.registerCheck('eventLoop', async () => {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        if (lag > 100) {
          return {
            status: 'degraded',
            message: `Event loop lag: ${lag}ms`,
            lag
          };
        }
      });

      return {
        status: 'healthy',
        message: 'Event loop responsive',
        lag: 0
      };
    });

    // File system check
    this.registerCheck('filesystem', async () => {
      try {
        const fs = require('fs').promises;
        const tmpFile = `/tmp/.basset-hound/health-${Date.now()}`;
        await fs.writeFile(tmpFile, 'health-check');
        await fs.unlink(tmpFile);

        return {
          status: 'healthy',
          message: 'Filesystem accessible'
        };
      } catch (err) {
        return {
          status: 'unhealthy',
          message: `Filesystem error: ${err.message}`
        };
      }
    });
  }

  /**
   * Register a custom health check
   */
  registerCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      fn: checkFunction,
      timeout: options.timeout || 5000,
      critical: options.critical !== false,
      lastResult: null,
      lastCheckTime: null,
      failureCount: 0
    });
  }

  /**
   * Run a single health check
   */
  async runCheck(name) {
    const check = this.checks.get(name);
    if (!check) {
      return {
        status: 'unknown',
        message: `Check '${name}' not found`
      };
    }

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Check timeout')), check.timeout)
      );

      const result = await Promise.race([check.fn(), timeoutPromise]);
      check.lastResult = result;
      check.lastCheckTime = Date.now();
      check.failureCount = 0;

      return result;
    } catch (err) {
      check.failureCount++;
      const result = {
        status: 'unhealthy',
        message: `Check failed: ${err.message}`,
        error: err.message
      };
      check.lastResult = result;
      check.lastCheckTime = Date.now();

      return result;
    }
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const results = {};
    let overallStatus = 'healthy';
    let criticalCheck = null;

    for (const [name, check] of this.checks) {
      const result = await this.runCheck(name);
      results[name] = result;

      // Determine overall status
      if (result.status === 'unhealthy') {
        if (check.critical) {
          criticalCheck = name;
          overallStatus = 'unhealthy';
        } else if (overallStatus !== 'unhealthy') {
          overallStatus = 'degraded';
        }
      } else if (result.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    const report = {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: process.uptime(),
      checks: results,
      criticalCheck
    };

    this.isHealthy = overallStatus === 'healthy';
    this.lastCheckTime = Date.now();

    this.emit('healthcheck:complete', report);

    return report;
  }

  /**
   * Get liveness probe result
   * Returns true if process is alive and responding
   */
  async getLivenessProbe() {
    return {
      alive: true,
      timestamp: Date.now(),
      uptime: process.uptime()
    };
  }

  /**
   * Get readiness probe result
   * Returns true if ready to accept traffic
   */
  async getReadinessProbe() {
    const checks = await this.runAllChecks();

    return {
      ready: checks.status === 'healthy',
      status: checks.status,
      timestamp: Date.now(),
      checks: Object.entries(checks.checks).reduce((acc, [name, result]) => {
        acc[name] = result.status;
        return acc;
      }, {})
    };
  }

  /**
   * Start periodic health checking
   */
  startHealthChecks() {
    if (this.checkInterval) {
      return; // Already running
    }

    this.checkInterval = setInterval(async () => {
      try {
        const report = await this.runAllChecks();

        if (report.status === 'unhealthy' && this.options.enableAutoRecovery) {
          this.emit('health:recovery-needed', {
            check: report.criticalCheck,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        this.emit('health:error', {
          error: err.message,
          timestamp: Date.now()
        });
      }
    }, this.options.checkInterval);
  }

  /**
   * Stop periodic health checking
   */
  stopHealthChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get current health status
   */
  getStatus() {
    return {
      healthy: this.isHealthy,
      lastCheck: this.lastCheckTime,
      checks: Array.from(this.checks.entries()).reduce((acc, [name, check]) => {
        acc[name] = {
          status: check.lastResult?.status || 'unknown',
          failureCount: check.failureCount
        };
        return acc;
      }, {})
    };
  }

  /**
   * Perform recovery action
   */
  async performRecovery(checkName) {
    const check = this.checks.get(checkName);
    if (!check) {
      return { success: false, message: 'Check not found' };
    }

    this.emit('health:recovery-start', { check: checkName });

    // Recovery implementation would depend on the specific check
    // For now, just log and re-run the check
    const result = await this.runCheck(checkName);

    this.emit('health:recovery-complete', {
      check: checkName,
      result: result.status
    });

    return {
      success: result.status === 'healthy',
      result
    };
  }
}

module.exports = HealthChecker;
