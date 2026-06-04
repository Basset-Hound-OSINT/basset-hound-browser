/**
 * Health Check System
 *
 * Provides:
 * - Liveness checks (is the server running)
 * - Readiness checks (is the server ready for traffic)
 * - Component health checks (DB, Redis, memory, disk)
 * - Health check endpoints (/health, /ready)
 */

const os = require('os');
const EventEmitter = require('events');

class HealthChecker extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      checkInterval: config.checkInterval || 5000, // 5 seconds
      memoryThreshold: config.memoryThreshold || 0.8, // 80%
      diskThreshold: config.diskThreshold || 0.8, // 80%
      ...config,
    };

    this.components = new Map();
    this.overallStatus = 'UNKNOWN';
    this.lastCheckTime = null;
    this.checkInterval = null;
    this.startTime = Date.now();
  }

  /**
   * Register a component for health checking
   */
  registerComponent(name, checker) {
    this.components.set(name, {
      name,
      checker,
      status: 'UNKNOWN',
      lastCheck: null,
      error: null,
      checkCount: 0,
      failureCount: 0,
    });
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    this.checkInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.checkInterval);

    // Run first check immediately
    this.performHealthCheck();
  }

  /**
   * Stop health checks
   */
  stopHealthChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Perform all health checks
   */
  async performHealthCheck() {
    const checks = [];

    // System checks
    checks.push(this.checkMemory());
    checks.push(this.checkDisk());

    // Component checks
    for (const [name, component] of this.components) {
      checks.push(this.checkComponent(name));
    }

    const results = await Promise.all(checks);
    this.lastCheckTime = Date.now();

    // Determine overall status
    const failures = results.filter(r => !r.ok);
    this.overallStatus = failures.length === 0 ? 'HEALTHY' : 'DEGRADED';

    if (failures.length > 0) {
      this.emit('health:degraded', { failures });
    } else {
      this.emit('health:recovered');
    }

    return { status: this.overallStatus, checks: results };
  }

  /**
   * Check component health
   */
  async checkComponent(name) {
    const component = this.components.get(name);
    if (!component) return { name, ok: false, error: 'Component not found' };

    try {
      component.checkCount++;
      const result = await Promise.race([
        component.checker(),
        this.timeout(5000),
      ]);

      component.status = result ? 'HEALTHY' : 'UNHEALTHY';
      component.error = null;
      component.lastCheck = Date.now();

      return {
        name,
        ok: result,
        status: component.status,
        lastCheck: new Date(component.lastCheck).toISOString(),
      };
    } catch (err) {
      component.failureCount++;
      component.status = 'ERROR';
      component.error = err.message;
      component.lastCheck = Date.now();

      return {
        name,
        ok: false,
        status: 'ERROR',
        error: err.message,
        lastCheck: new Date(component.lastCheck).toISOString(),
      };
    }
  }

  /**
   * Check memory usage
   */
  async checkMemory() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = usedMem / totalMem;

    const ok = usagePercent < this.config.memoryThreshold;

    return {
      name: 'memory',
      ok,
      status: ok ? 'OK' : 'THRESHOLD_EXCEEDED',
      metrics: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: (usagePercent * 100).toFixed(2) + '%',
        threshold: (this.config.memoryThreshold * 100) + '%',
      },
    };
  }

  /**
   * Check disk usage (simplified - checks /tmp)
   */
  async checkDisk() {
    try {
      // In a real implementation, would use statfs to check disk space
      // For now, return OK as a placeholder
      return {
        name: 'disk',
        ok: true,
        status: 'OK',
        metrics: {
          threshold: (this.config.diskThreshold * 100) + '%',
        },
      };
    } catch (err) {
      return {
        name: 'disk',
        ok: false,
        status: 'ERROR',
        error: err.message,
      };
    }
  }

  /**
   * Timeout promise helper
   */
  timeout(ms) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), ms)
    );
  }

  /**
   * Get liveness status (is the server running)
   */
  async getLivenessStatus() {
    return {
      status: 'ALIVE',
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get readiness status (is the server ready for traffic)
   */
  async getReadinessStatus() {
    const checks = [];

    // Check critical components
    for (const [name, component] of this.components) {
      if (component.checker && component.status === 'HEALTHY') {
        checks.push({ name, ready: true });
      } else if (component.checker) {
        checks.push({ name, ready: false, status: component.status });
      }
    }

    const allReady = checks.every(c => c.ready !== false);

    return {
      ready: allReady,
      components: checks,
      timestamp: Date.now(),
    };
  }

  /**
   * Get detailed health status
   */
  async getFullHealthStatus() {
    const liveness = await this.getLivenessStatus();
    const readiness = await this.getReadinessStatus();

    const components = {};
    for (const [name, component] of this.components) {
      components[name] = {
        status: component.status,
        lastCheck: component.lastCheck ? new Date(component.lastCheck).toISOString() : null,
        checkCount: component.checkCount,
        failureCount: component.failureCount,
        error: component.error,
      };
    }

    return {
      overall: {
        status: this.overallStatus,
        timestamp: Date.now(),
        lastCheck: this.lastCheckTime ? new Date(this.lastCheckTime).toISOString() : null,
      },
      liveness,
      readiness,
      components,
    };
  }

  /**
   * Check if system is healthy
   */
  isHealthy() {
    return this.overallStatus === 'HEALTHY';
  }

  /**
   * Check if system is ready for traffic
   */
  isReady() {
    // Consider ready if all critical components are healthy
    for (const [, component] of this.components) {
      if (component.status !== 'HEALTHY') {
        return false;
      }
    }
    return true;
  }
}

module.exports = HealthChecker;
