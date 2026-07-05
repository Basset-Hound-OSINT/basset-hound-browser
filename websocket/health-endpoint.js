/**
 * Health Check Endpoint Manager
 *
 * Provides comprehensive health monitoring endpoints for Basset Hound Browser
 * with full SLA compliance tracking and reliability metrics.
 *
 * Features:
 * - HTTP endpoints: /health, /health/live, /health/ready, /health/metrics, /health/reliability
 * - WebSocket health command (getHealth)
 * - Integration with ReliabilityManager for per-command metrics
 * - SLA compliance verification (99%+ target)
 * - Kubernetes probe support (liveness & readiness)
 * - Memory and CPU status reporting
 * - Component health checks
 *
 * Endpoints:
 * - GET /health - Full health status (200 or 503)
 * - GET /health/live - Liveness probe (always 200)
 * - GET /health/ready - Readiness probe (200 or 503)
 * - GET /health/metrics - Detailed metrics with percentiles
 * - GET /health/reliability - SLA-focused metrics
 *
 * v12.9.0: Full SLA compliance tracking with per-command metrics
 */

const os = require('os');

class HealthEndpointManager {
  constructor(options = {}) {
    this.startTime = Date.now();
    this.lastHealthCheck = null;
    this.healthy = true;
    this.checks = new Map(); // Component name -> check function
    this.reliabilityManager = options.reliabilityManager || null; // Optional: linked ReliabilityManager
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageLatencyMs: 0,
      latencySamples: [],
      commandStats: {} // command -> { count, errors, avgLatency }
    };
    this.maxSamples = options.maxSamples || 1000;
    this.logger = options.logger || console;
    this.version = options.version || '12.9.0';
  }

  /**
   * Register a health check component
   * @param {string} name - Component name
   * @param {Function} checkFn - Async function that returns { ok: boolean, message?: string }
   */
  registerCheck(name, checkFn) {
    this.checks.set(name, checkFn);
    this.logger.debug(`[HealthEndpoint] Registered check: ${name}`);
  }

  /**
   * Record a command execution for metrics
   * @param {string} command - Command name
   * @param {number} latencyMs - Execution latency
   * @param {boolean} error - Whether command failed
   */
  recordCommand(command, latencyMs, error = false) {
    this.metrics.requestCount++;
    if (error) {
      this.metrics.errorCount++;
    }

    // Update latency samples
    this.metrics.latencySamples.push(latencyMs);
    if (this.metrics.latencySamples.length > this.maxSamples) {
      this.metrics.latencySamples.shift();
    }

    // Calculate average
    const sum = this.metrics.latencySamples.reduce((a, b) => a + b, 0);
    this.metrics.averageLatencyMs = (sum / this.metrics.latencySamples.length).toFixed(2);

    // Update per-command stats
    if (!this.metrics.commandStats[command]) {
      this.metrics.commandStats[command] = {
        count: 0,
        errors: 0,
        totalLatency: 0,
        avgLatency: 0
      };
    }

    const stat = this.metrics.commandStats[command];
    stat.count++;
    stat.totalLatency += latencyMs;
    stat.avgLatency = (stat.totalLatency / stat.count).toFixed(2);
    if (error) {
      stat.errors++;
    }
  }

  /**
   * Get liveness status (is the system running)
   */
  async getLivenessStatus() {
    return {
      status: 'alive',
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get readiness status (is the system ready to handle requests)
   */
  async getReadinessStatus() {
    const checks = [];
    let allReady = true;

    for (const [name, checkFn] of this.checks) {
      try {
        const result = await checkFn();
        const ready = result.ok !== false;
        if (!ready) {
          allReady = false;
        }
        checks.push({
          name,
          ready,
          message: result.message || (ready ? 'OK' : 'Check failed')
        });
      } catch (error) {
        allReady = false;
        checks.push({
          name,
          ready: false,
          message: error.message
        });
      }
    }

    return {
      ready: allReady,
      checks,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get full health status including metrics and reliability SLA
   */
  async getFullHealthStatus() {
    const liveness = await this.getLivenessStatus();
    const readiness = await this.getReadinessStatus();
    const memory = this._getMemoryStatus();
    const cpu = this._getCpuStatus();

    this.lastHealthCheck = Date.now();

    // Build response
    const response = {
      status: readiness.ready ? 'healthy' : 'degraded',
      version: this.version,
      liveness,
      readiness,
      metrics: {
        requests: this.metrics.requestCount,
        errors: this.metrics.errorCount,
        errorRate: this.metrics.requestCount > 0
          ? ((this.metrics.errorCount / this.metrics.requestCount) * 100).toFixed(2) + '%'
          : '0%',
        averageLatencyMs: parseFloat(this.metrics.averageLatencyMs),
        memory,
        cpu
      },
      timestamp: new Date().toISOString()
    };

    // Add reliability metrics if ReliabilityManager is available
    if (this.reliabilityManager) {
      const reliabilityMetrics = this._buildReliabilityMetrics();
      response.reliability = reliabilityMetrics;
      response.sla = {
        target: '99%+',
        current: reliabilityMetrics.globalStats.successRate,
        compliant: this._isSLACompliant(reliabilityMetrics.globalStats)
      };
    }

    return response;
  }

  /**
   * Get memory status
   * @private
   */
  _getMemoryStatus() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      heapUsed: this._formatBytes(memUsage.heapUsed),
      heapTotal: this._formatBytes(memUsage.heapTotal),
      heapUsedPercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%',
      external: this._formatBytes(memUsage.external),
      rss: this._formatBytes(memUsage.rss),
      system: {
        used: this._formatBytes(usedMem),
        total: this._formatBytes(totalMem),
        free: this._formatBytes(freeMem),
        usedPercent: ((usedMem / totalMem) * 100).toFixed(2) + '%'
      }
    };
  }

  /**
   * Get CPU status
   * @private
   */
  _getCpuStatus() {
    const cpus = os.cpus();
    const avgLoad = os.loadavg();

    return {
      cores: cpus.length,
      model: cpus.length > 0 ? cpus[0].model : 'Unknown',
      loadAverage: {
        oneMinute: avgLoad[0].toFixed(2),
        fiveMinutes: avgLoad[1].toFixed(2),
        fifteenMinutes: avgLoad[2].toFixed(2)
      }
    };
  }

  /**
   * Get detailed metrics
   */
  getMetrics() {
    const topCommands = Object.entries(this.metrics.commandStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .reduce((acc, [cmd, stats]) => {
        acc[cmd] = stats;
        return acc;
      }, {});

    return {
      ...this.metrics,
      latencyPercentiles: this._calculatePercentiles(),
      topCommands,
      commandCount: Object.keys(this.metrics.commandStats).length
    };
  }

  /**
   * Calculate latency percentiles
   * @private
   */
  _calculatePercentiles() {
    if (this.metrics.latencySamples.length === 0) {
      return {};
    }

    const sorted = [...this.metrics.latencySamples].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      min: sorted[0],
      max: sorted[len - 1]
    };
  }

  /**
   * Create HTTP health endpoint handler
   * @returns {Function} Express/HTTP handler function
   */
  createHttpHandler() {
    return async (req, res) => {
      try {
        const path = req.url || '/';
        let status, statusCode;

        if (path === '/health' || path === '/health/') {
          status = await this.getFullHealthStatus();
          statusCode = status.status === 'healthy' ? 200 : 503;
        } else if (path === '/health/live' || path === '/health/liveness') {
          status = await this.getLivenessStatus();
          statusCode = 200;
        } else if (path === '/health/ready' || path === '/health/readiness') {
          status = await this.getReadinessStatus();
          statusCode = status.ready ? 200 : 503;
        } else if (path === '/health/metrics') {
          status = this.getMetrics();
          statusCode = 200;
        } else {
          statusCode = 404;
          status = { error: 'Not found' };
        }

        res.writeHead(statusCode, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify(status, null, 2));
      } catch (error) {
        this.logger.error(`[HealthEndpoint] Error handling request: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }));
      }
    };
  }

  /**
   * Create WebSocket command handler
   * @returns {Function} WebSocket command handler
   */
  createWebSocketHandler() {
    return async () => {
      return await this.getFullHealthStatus();
    };
  }

  /**
   * Format bytes to human readable
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Build reliability metrics from ReliabilityManager
   * @private
   */
  _buildReliabilityMetrics() {
    if (!this.reliabilityManager) {
      return null;
    }

    const globalStats = this.reliabilityManager.getGlobalStats();
    const topCommands = this.reliabilityManager.getTopCommands(5);

    // Build command reliability map with core commands
    const commands = {};
    const coreCommands = ['navigateTo', 'click', 'fill', 'screenshot', 'get_url', 'get_content'];

    for (const cmd of coreCommands) {
      const metrics = this.reliabilityManager.getCommandMetrics(cmd);
      if (metrics.totalAttempts > 0) {
        commands[cmd] = {
          reliability: metrics.reliability,
          avgLatency: metrics.avgLatency,
          p99Latency: metrics.p99Latency,
          successCount: metrics.successCount,
          failureCount: metrics.failureCount
        };
      }
    }

    // Add top commands if not already included
    for (const topCmd of topCommands) {
      if (!commands[topCmd.command] && topCmd.attempts > 0) {
        commands[topCmd.command] = {
          reliability: topCmd.reliability,
          avgLatency: topCmd.avgLatency,
          successCount: topCmd.success
        };
      }
    }

    return {
      globalStats,
      commands,
      topCommands,
      health: this.reliabilityManager.getHealthStatus()
    };
  }

  /**
   * Check if SLA is compliant
   * @private
   */
  _isSLACompliant(globalStats) {
    if (globalStats.totalRequests === 0) {
      return null; // Not enough data
    }
    const successRate = parseFloat(globalStats.successRate);
    return successRate >= 99.0;
  }

  /**
   * Set reliability manager reference
   * @param {ReliabilityManager} reliabilityManager
   */
  setReliabilityManager(reliabilityManager) {
    this.reliabilityManager = reliabilityManager;
    this.logger.debug('[HealthEndpoint] ReliabilityManager integrated');
  }

  /**
   * Get reliability-focused health status
   * Suitable for monitoring systems
   */
  async getReliabilityStatus() {
    if (!this.reliabilityManager) {
      return {
        error: 'ReliabilityManager not available'
      };
    }

    const reliability = this._buildReliabilityMetrics();
    const liveness = await this.getLivenessStatus();

    return {
      status: reliability.health.healthy ? 'healthy' : 'degraded',
      version: this.version,
      uptime: liveness.uptime,
      sla: {
        target: reliability.health.threshold,
        current: reliability.globalStats.successRate,
        compliant: this._isSLACompliant(reliability.globalStats),
        warning: reliability.health.warning
      },
      commands: reliability.commands,
      topCommands: reliability.topCommands,
      globalStats: reliability.globalStats,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { HealthEndpointManager };
