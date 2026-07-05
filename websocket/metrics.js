/**
 * Prometheus Metrics Module for WebSocket Server
 * Collects and exposes metrics in Prometheus format
 *
 * Metrics collected:
 * - Connection metrics (active, total, closed)
 * - Command execution metrics (count, duration, errors)
 * - WebSocket frame metrics (messages sent/received)
 * - Memory and GC metrics
 * - Rate limiter metrics
 * - Request size metrics
 */

const os = require('os');

class PrometheusMetricsCollector {
  constructor() {
    this.startTime = Date.now();
    this.processStartTime = process.uptime();

    // Connection metrics
    this.connectionMetrics = {
      activeConnections: 0,
      totalConnectionsCreated: 0,
      totalConnectionsClosed: 0,
      connectionErrors: 0,
      connectionDurations: [] // Track connection durations for percentiles
    };

    // Command execution metrics
    this.commandMetrics = new Map(); // command -> { count, totalDuration, errors, count_by_status }

    // WebSocket frame metrics
    this.frameMetrics = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      messageErrors: 0
    };

    // Rate limiter metrics
    this.rateLimiterMetrics = {
      requestsRateLimited: 0,
      requestsAllowed: 0,
      clientsRateLimited: 0
    };

    // Request size metrics
    this.requestSizeMetrics = {
      totalRequestsValidated: 0,
      requestsSizeViolations: 0,
      averageRequestSize: 0,
      maxRequestSize: 0
    };

    // Health metrics
    this.healthMetrics = {
      lastHeartbeat: Date.now(),
      heartbeatsMissed: 0
    };

    // Command registry
    this.commandRegistry = {
      total: 0,
      byStatus: {
        success: 0,
        error: 0,
        unknown: 0
      }
    };
  }

  /**
   * Record a connection opened
   */
  recordConnectionOpened() {
    this.connectionMetrics.activeConnections++;
    this.connectionMetrics.totalConnectionsCreated++;
  }

  /**
   * Record a connection closed
   * @param {number} durationMs - Duration of the connection in milliseconds
   */
  recordConnectionClosed(durationMs = 0) {
    this.connectionMetrics.activeConnections = Math.max(0, this.connectionMetrics.activeConnections - 1);
    this.connectionMetrics.totalConnectionsClosed++;
    if (durationMs > 0) {
      this.connectionMetrics.connectionDurations.push(durationMs);
      // Keep only last 1000 durations for percentile calculation
      if (this.connectionMetrics.connectionDurations.length > 1000) {
        this.connectionMetrics.connectionDurations.shift();
      }
    }
  }

  /**
   * Record a connection error
   */
  recordConnectionError() {
    this.connectionMetrics.connectionErrors++;
  }

  /**
   * Record command execution
   * @param {string} command - Command name
   * @param {number} durationMs - Execution duration in milliseconds
   * @param {boolean} success - Whether command was successful
   */
  recordCommandExecution(command, durationMs, success = true) {
    if (!this.commandMetrics.has(command)) {
      this.commandMetrics.set(command, {
        count: 0,
        totalDuration: 0,
        errors: 0,
        minDuration: Infinity,
        maxDuration: 0,
        durations: []
      });
    }

    const metrics = this.commandMetrics.get(command);
    metrics.count++;
    metrics.totalDuration += durationMs;
    metrics.minDuration = Math.min(metrics.minDuration, durationMs);
    metrics.maxDuration = Math.max(metrics.maxDuration, durationMs);
    metrics.durations.push(durationMs);

    // Keep only last 100 durations for percentile calculation
    if (metrics.durations.length > 100) {
      metrics.durations.shift();
    }

    if (!success) {
      metrics.errors++;
    }

    this.commandRegistry.total++;
    if (success) {
      this.commandRegistry.byStatus.success++;
    } else {
      this.commandRegistry.byStatus.error++;
    }
  }

  /**
   * Record WebSocket message sent
   * @param {number} bytes - Number of bytes sent
   */
  recordMessageSent(bytes = 0) {
    this.frameMetrics.messagesSent++;
    this.frameMetrics.bytesSent += bytes;
  }

  /**
   * Record WebSocket message received
   * @param {number} bytes - Number of bytes received
   */
  recordMessageReceived(bytes = 0) {
    this.frameMetrics.messagesReceived++;
    this.frameMetrics.bytesReceived += bytes;
  }

  /**
   * Record WebSocket message error
   */
  recordMessageError() {
    this.frameMetrics.messageErrors++;
  }

  /**
   * Record rate limit event
   * @param {boolean} rateLimited - Whether request was rate limited
   */
  recordRateLimitEvent(rateLimited = false) {
    if (rateLimited) {
      this.rateLimiterMetrics.requestsRateLimited++;
    } else {
      this.rateLimiterMetrics.requestsAllowed++;
    }
  }

  /**
   * Record client rate limited
   */
  recordClientRateLimited() {
    this.rateLimiterMetrics.clientsRateLimited++;
  }

  /**
   * Record request size validation
   * @param {number} size - Request size in bytes
   * @param {boolean} violated - Whether size violated limit
   */
  recordRequestSizeValidation(size, violated = false) {
    this.requestSizeMetrics.totalRequestsValidated++;
    if (violated) {
      this.requestSizeMetrics.requestsSizeViolations++;
    }
    this.requestSizeMetrics.maxRequestSize = Math.max(
      this.requestSizeMetrics.maxRequestSize,
      size
    );
    // Update running average
    const prev = this.requestSizeMetrics.averageRequestSize;
    this.requestSizeMetrics.averageRequestSize =
      (prev * (this.requestSizeMetrics.totalRequestsValidated - 1) + size) /
      this.requestSizeMetrics.totalRequestsValidated;
  }

  /**
   * Record heartbeat event
   */
  recordHeartbeat() {
    this.healthMetrics.lastHeartbeat = Date.now();
  }

  /**
   * Record missed heartbeat
   */
  recordHeartbeatMissed() {
    this.healthMetrics.heartbeatsMissed++;
  }

  /**
   * Calculate percentile from sorted array
   * @private
   */
  _calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Get metrics in Prometheus format
   * @returns {string} Prometheus-formatted metrics
   */
  getMetricsText() {
    const lines = [];

    // Helper to add metric line
    const addMetric = (name, value, type = 'gauge', labels = {}, help = '') => {
      if (help) {
        lines.push(`# HELP ${name} ${help}`);
        lines.push(`# TYPE ${name} ${type}`);
      }
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      lines.push(`${name}${labelStr ? `{${labelStr}}` : ''} ${value}`);
    };

    // Timestamp
    const timestamp = Date.now();
    lines.push(`# GENERATED ${new Date().toISOString()}`);
    lines.push('');

    // ====== CONNECTION METRICS ======
    lines.push('# WebSocket Connection Metrics');
    addMetric(
      'basset_websocket_connections_active',
      this.connectionMetrics.activeConnections,
      'gauge',
      {},
      'Currently active WebSocket connections'
    );
    lines.push('');

    addMetric(
      'basset_websocket_connections_total_created',
      this.connectionMetrics.totalConnectionsCreated,
      'counter',
      {},
      'Total WebSocket connections created'
    );
    lines.push('');

    addMetric(
      'basset_websocket_connections_total_closed',
      this.connectionMetrics.totalConnectionsClosed,
      'counter',
      {},
      'Total WebSocket connections closed'
    );
    lines.push('');

    addMetric(
      'basset_websocket_connection_errors_total',
      this.connectionMetrics.connectionErrors,
      'counter',
      {},
      'Total connection errors'
    );
    lines.push('');

    // Connection duration percentiles
    if (this.connectionMetrics.connectionDurations.length > 0) {
      const sorted = [...this.connectionMetrics.connectionDurations].sort((a, b) => a - b);
      addMetric(
        'basset_websocket_connection_duration_ms',
        this._calculatePercentile(sorted, 50),
        'gauge',
        { quantile: '0.5' },
        'Connection duration (milliseconds) - P50'
      );
      lines.push('');

      addMetric(
        'basset_websocket_connection_duration_ms',
        this._calculatePercentile(sorted, 95),
        'gauge',
        { quantile: '0.95' },
        'Connection duration (milliseconds) - P95'
      );
      lines.push('');

      addMetric(
        'basset_websocket_connection_duration_ms',
        this._calculatePercentile(sorted, 99),
        'gauge',
        { quantile: '0.99' },
        'Connection duration (milliseconds) - P99'
      );
      lines.push('');
    }

    // ====== COMMAND EXECUTION METRICS ======
    lines.push('# Command Execution Metrics');

    // Top commands by execution count
    const sortedCommands = Array.from(this.commandMetrics.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 50); // Limit to top 50

    for (const [command, metrics] of sortedCommands) {
      const avgDuration = metrics.count > 0 ? metrics.totalDuration / metrics.count : 0;
      const errorRate = metrics.count > 0 ? (metrics.errors / metrics.count * 100).toFixed(2) : 0;

      addMetric(
        'basset_command_executions_total',
        metrics.count,
        'counter',
        { command },
        `Total executions of ${command} command`
      );
      lines.push('');

      addMetric(
        'basset_command_duration_ms',
        avgDuration.toFixed(2),
        'gauge',
        { command, quantile: 'avg' },
        `Average execution duration for ${command}`
      );
      lines.push('');

      if (metrics.durations.length > 0) {
        const sorted = [...metrics.durations].sort((a, b) => a - b);
        addMetric(
          'basset_command_duration_ms',
          this._calculatePercentile(sorted, 95),
          'gauge',
          { command, quantile: '0.95' },
          `P95 execution duration for ${command}`
        );
        lines.push('');

        addMetric(
          'basset_command_duration_ms',
          metrics.minDuration === Infinity ? 0 : metrics.minDuration,
          'gauge',
          { command, quantile: 'min' },
          `Minimum execution duration for ${command}`
        );
        lines.push('');

        addMetric(
          'basset_command_duration_ms',
          metrics.maxDuration,
          'gauge',
          { command, quantile: 'max' },
          `Maximum execution duration for ${command}`
        );
        lines.push('');
      }

      if (metrics.errors > 0) {
        addMetric(
          'basset_command_errors_total',
          metrics.errors,
          'counter',
          { command },
          `Total errors for ${command}`
        );
        lines.push('');

        addMetric(
          'basset_command_error_rate',
          errorRate,
          'gauge',
          { command },
          `Error rate percentage for ${command}`
        );
        lines.push('');
      }
    }

    // ====== WEBSOCKET FRAME METRICS ======
    lines.push('# WebSocket Frame Metrics');

    addMetric(
      'basset_websocket_messages_sent_total',
      this.frameMetrics.messagesSent,
      'counter',
      {},
      'Total WebSocket messages sent'
    );
    lines.push('');

    addMetric(
      'basset_websocket_messages_received_total',
      this.frameMetrics.messagesReceived,
      'counter',
      {},
      'Total WebSocket messages received'
    );
    lines.push('');

    addMetric(
      'basset_websocket_bytes_sent_total',
      this.frameMetrics.bytesSent,
      'counter',
      {},
      'Total bytes sent via WebSocket'
    );
    lines.push('');

    addMetric(
      'basset_websocket_bytes_received_total',
      this.frameMetrics.bytesReceived,
      'counter',
      {},
      'Total bytes received via WebSocket'
    );
    lines.push('');

    addMetric(
      'basset_websocket_message_errors_total',
      this.frameMetrics.messageErrors,
      'counter',
      {},
      'Total WebSocket message errors'
    );
    lines.push('');

    // ====== COMMAND REGISTRY METRICS ======
    lines.push('# Command Registry Metrics');

    addMetric(
      'basset_commands_registered_total',
      this.commandRegistry.total,
      'gauge',
      {},
      'Total registered commands'
    );
    lines.push('');

    addMetric(
      'basset_commands_by_status',
      this.commandRegistry.byStatus.success,
      'gauge',
      { status: 'success' },
      'Successful commands'
    );
    lines.push('');

    addMetric(
      'basset_commands_by_status',
      this.commandRegistry.byStatus.error,
      'gauge',
      { status: 'error' },
      'Failed commands'
    );
    lines.push('');

    // ====== RATE LIMITER METRICS ======
    lines.push('# Rate Limiter Metrics');

    addMetric(
      'basset_rate_limiter_requests_total',
      this.rateLimiterMetrics.requestsAllowed,
      'counter',
      { status: 'allowed' },
      'Requests allowed by rate limiter'
    );
    lines.push('');

    addMetric(
      'basset_rate_limiter_requests_total',
      this.rateLimiterMetrics.requestsRateLimited,
      'counter',
      { status: 'limited' },
      'Requests rate limited'
    );
    lines.push('');

    addMetric(
      'basset_rate_limiter_clients_limited_total',
      this.rateLimiterMetrics.clientsRateLimited,
      'counter',
      {},
      'Total unique clients rate limited'
    );
    lines.push('');

    // ====== REQUEST SIZE METRICS ======
    lines.push('# Request Size Metrics');

    addMetric(
      'basset_request_size_validations_total',
      this.requestSizeMetrics.totalRequestsValidated,
      'counter',
      {},
      'Total request size validations'
    );
    lines.push('');

    addMetric(
      'basset_request_size_violations_total',
      this.requestSizeMetrics.requestsSizeViolations,
      'counter',
      {},
      'Total request size violations'
    );
    lines.push('');

    addMetric(
      'basset_request_size_bytes',
      this.requestSizeMetrics.averageRequestSize.toFixed(2),
      'gauge',
      { quantile: 'avg' },
      'Average request size in bytes'
    );
    lines.push('');

    addMetric(
      'basset_request_size_bytes',
      this.requestSizeMetrics.maxRequestSize,
      'gauge',
      { quantile: 'max' },
      'Maximum request size in bytes'
    );
    lines.push('');

    // ====== PROCESS & SYSTEM METRICS ======
    lines.push('# Process Metrics');

    const uptime = process.uptime();
    addMetric(
      'basset_process_uptime_seconds',
      uptime.toFixed(2),
      'gauge',
      {},
      'Process uptime in seconds'
    );
    lines.push('');

    addMetric(
      'basset_process_start_time_unix',
      Math.floor(Date.now() / 1000) - Math.floor(uptime),
      'gauge',
      {},
      'Process start time (Unix timestamp)'
    );
    lines.push('');

    const memUsage = process.memoryUsage();
    addMetric(
      'basset_process_resident_memory_bytes',
      memUsage.rss,
      'gauge',
      {},
      'Resident set size in bytes'
    );
    lines.push('');

    addMetric(
      'basset_process_heap_used_bytes',
      memUsage.heapUsed,
      'gauge',
      {},
      'Heap memory used in bytes'
    );
    lines.push('');

    addMetric(
      'basset_process_heap_total_bytes',
      memUsage.heapTotal,
      'gauge',
      {},
      'Total heap memory in bytes'
    );
    lines.push('');

    // ====== SYSTEM METRICS ======
    lines.push('# System Metrics');

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    addMetric(
      'basset_system_memory_total_bytes',
      totalMem,
      'gauge',
      {},
      'Total system memory in bytes'
    );
    lines.push('');

    addMetric(
      'basset_system_memory_free_bytes',
      freeMem,
      'gauge',
      {},
      'Free system memory in bytes'
    );
    lines.push('');

    addMetric(
      'basset_system_memory_used_bytes',
      usedMem,
      'gauge',
      {},
      'Used system memory in bytes'
    );
    lines.push('');

    const cpus = os.cpus();
    addMetric(
      'basset_system_cpu_cores',
      cpus.length,
      'gauge',
      {},
      'Number of CPU cores'
    );
    lines.push('');

    const loadAvg = os.loadavg();
    addMetric(
      'basset_system_load_average',
      loadAvg[0].toFixed(2),
      'gauge',
      { interval: '1m' },
      'System load average (1 minute)'
    );
    lines.push('');

    addMetric(
      'basset_system_load_average',
      loadAvg[1].toFixed(2),
      'gauge',
      { interval: '5m' },
      'System load average (5 minutes)'
    );
    lines.push('');

    addMetric(
      'basset_system_load_average',
      loadAvg[2].toFixed(2),
      'gauge',
      { interval: '15m' },
      'System load average (15 minutes)'
    );
    lines.push('');

    // ====== HEALTH METRICS ======
    lines.push('# Health Metrics');

    addMetric(
      'basset_health_heartbeats_missed_total',
      this.healthMetrics.heartbeatsMissed,
      'counter',
      {},
      'Total heartbeats missed'
    );
    lines.push('');

    const lastHeartbeatAgo = Date.now() - this.healthMetrics.lastHeartbeat;
    addMetric(
      'basset_health_last_heartbeat_ms_ago',
      Math.max(0, lastHeartbeatAgo),
      'gauge',
      {},
      'Milliseconds since last heartbeat'
    );
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Get metrics as JSON
   * @returns {Object} Metrics as JSON object
   */
  getMetricsJSON() {
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      connections: this.connectionMetrics,
      commands: {
        registry: this.commandRegistry,
        topCommands: Array.from(this.commandMetrics.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 20)
          .map(([cmd, metrics]) => ({
            command: cmd,
            executionCount: metrics.count,
            totalDuration: metrics.totalDuration,
            averageDuration: metrics.count > 0 ? metrics.totalDuration / metrics.count : 0,
            errors: metrics.errors,
            errorRate: metrics.count > 0 ? (metrics.errors / metrics.count * 100).toFixed(2) : 0
          }))
      },
      frames: this.frameMetrics,
      rateLimiter: this.rateLimiterMetrics,
      requestSize: this.requestSizeMetrics,
      health: this.healthMetrics,
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg()
      }
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.connectionMetrics = {
      activeConnections: 0,
      totalConnectionsCreated: 0,
      totalConnectionsClosed: 0,
      connectionErrors: 0,
      connectionDurations: []
    };
    this.commandMetrics.clear();
    this.frameMetrics = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      messageErrors: 0
    };
    this.rateLimiterMetrics = {
      requestsRateLimited: 0,
      requestsAllowed: 0,
      clientsRateLimited: 0
    };
    this.requestSizeMetrics = {
      totalRequestsValidated: 0,
      requestsSizeViolations: 0,
      averageRequestSize: 0,
      maxRequestSize: 0
    };
    this.healthMetrics = {
      lastHeartbeat: Date.now(),
      heartbeatsMissed: 0
    };
  }
}

module.exports = { PrometheusMetricsCollector };
