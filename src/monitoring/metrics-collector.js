const EventEmitter = require('events');

/**
 * MetricsCollector - Core metrics collection engine
 *
 * Tracks all performance indicators including:
 * - WebSocket command latency (min, max, avg, p50, p95, p99)
 * - Success/failure rates
 * - Throughput (messages/sec, bytes/sec)
 * - Resource metrics (memory, CPU, connections)
 * - Session lifecycle metrics
 */
class MetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.windowSize = options.windowSize || 60000; // 1 minute aggregation window
    this.maxSamples = options.maxSamples || 10000; // Keep last 10k latency samples
    this.maxErrorHistory = options.maxErrorHistory || 100; // Keep last 100 errors

    // Initialize metrics storage
    this._resetMetrics();

    // Track window boundaries for throughput calculation
    this.windowStartTime = Date.now();
    this.windowMessageCount = 0;
    this.windowByteCount = 0;

    // Resource monitoring state
    this.lastResourceCheck = Date.now();
    this.lastMemory = this._collectMemory();

    // Setup periodic aggregation and cleanup
    this.aggregationInterval = setInterval(
      () => this._aggregate(),
      this.windowSize
    );

    // Setup periodic resource collection
    this.resourceInterval = setInterval(
      () => this._collectResources(),
      5000 // Every 5 seconds
    );
  }

  /**
   * Reset all metrics to initial state
   * @private
   */
  _resetMetrics() {
    this.metrics = {
      commands: {
        total: 0,
        success: 0,
        failure: 0,
        activeCount: 0,
        latency: {
          samples: [],
          min: 0,
          max: 0,
          avg: 0,
          p50: 0,
          p95: 0,
          p99: 0
        },
        byCommand: {} // Per-command breakdown
      },

      throughput: {
        messagesPerSecond: 0,
        bytesPerSecond: 0,
        totalMessages: 0,
        totalBytes: 0,
        windowStartTime: this.windowStartTime
      },

      sessions: {
        active: 0,
        total: 0,
        closed: 0,
        avgDuration: 0,
        avgCommandsPerSession: 0,
        bySession: {} // Track per-session stats
      },

      connections: {
        active: 0,
        total: 0,
        closed: 0,
        avgDuration: 0
      },

      errors: {
        total: 0,
        rate: 0,
        byType: {},
        recent: []
      },

      resources: {
        memory: {
          heapUsed: 0,
          heapTotal: 0,
          external: 0,
          rss: 0,
          percentUsed: 0,
          growthRate: 0 // MB/hour
        },
        cpu: {
          usage: 0,
          avgUsage: 0
        },
        connections: {
          websocket: 0,
          fileDescriptors: 0
        }
      },

      uptime: 0,
      timestamp: Date.now()
    };

    // Track for growth rate calculation
    this.memoryHistory = [];
    this.maxMemoryHistory = 12; // 60 seconds of 5-second samples

    // Track for error rate calculation
    this.errorTimestamps = [];
    this.errorRateWindow = 60000; // Calculate rate over last minute
  }

  /**
   * Record the start of a command execution
   * @param {string} commandName - The name of the command
   * @param {string} commandId - Unique identifier for this command execution
   * @returns {number} Start timestamp
   */
  recordCommandStart(commandName, commandId) {
    const startTime = Date.now();

    // Initialize per-command tracking if needed
    if (!this.metrics.commands.byCommand[commandName]) {
      this.metrics.commands.byCommand[commandName] = {
        count: 0,
        successCount: 0,
        failureCount: 0,
        latency: { samples: [], min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 },
        errorCount: 0,
        lastExecuted: startTime
      };
    }

    // Track active command count
    this.metrics.commands.activeCount++;

    // Store execution state (for matching with end)
    if (!this._commandStates) {
      this._commandStates = new Map();
    }
    this._commandStates.set(commandId, { commandName, startTime });

    return startTime;
  }

  /**
   * Record the completion of a command execution
   * @param {string} commandId - The command ID returned from recordCommandStart
   * @param {string} commandName - The name of the command
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether the command succeeded
   * @param {number} bytesTransferred - Bytes transferred in response (optional)
   */
  recordCommandEnd(commandId, commandName, duration, success, bytesTransferred = 0) {
    // Update global command metrics
    this.metrics.commands.total++;
    this.metrics.commands.activeCount = Math.max(0, this.metrics.commands.activeCount - 1);

    if (success) {
      this.metrics.commands.success++;
    } else {
      this.metrics.commands.failure++;
    }

    // Record latency sample
    this.metrics.commands.latency.samples.push(duration);
    if (this.metrics.commands.latency.samples.length > this.maxSamples) {
      this.metrics.commands.latency.samples.shift();
    }

    // Update per-command metrics
    const cmdMetrics = this.metrics.commands.byCommand[commandName];
    if (cmdMetrics) {
      cmdMetrics.count++;
      if (success) {
        cmdMetrics.successCount++;
      } else {
        cmdMetrics.failureCount++;
      }

      cmdMetrics.latency.samples.push(duration);
      if (cmdMetrics.latency.samples.length > 1000) {
        cmdMetrics.latency.samples.shift();
      }

      cmdMetrics.lastExecuted = Date.now();
    }

    // Update throughput metrics
    this.windowMessageCount++;
    this.windowByteCount += bytesTransferred;
    this.metrics.throughput.totalMessages++;
    this.metrics.throughput.totalBytes += bytesTransferred;

    // Update latency statistics
    this._updateLatencyStats();

    // Emit event for streaming subscribers
    this.emit('command', {
      commandName,
      duration,
      success,
      timestamp: Date.now()
    });

    // Cleanup state
    if (this._commandStates) {
      this._commandStates.delete(commandId);
    }
  }

  /**
   * Record a session creation
   * @param {string} sessionId - The session ID
   */
  recordSessionCreated(sessionId) {
    this.metrics.sessions.active++;
    this.metrics.sessions.total++;

    if (!this.metrics.sessions.bySession) {
      this.metrics.sessions.bySession = {};
    }

    this.metrics.sessions.bySession[sessionId] = {
      createdAt: Date.now(),
      commandCount: 0,
      errorCount: 0,
      closedAt: null,
      duration: 0
    };
  }

  /**
   * Record a session closing
   * @param {string} sessionId - The session ID
   * @param {number} duration - Session duration in milliseconds
   * @param {number} commandCount - Number of commands executed in session
   * @param {number} errorCount - Number of errors in session
   */
  recordSessionClosed(sessionId, duration, commandCount = 0, errorCount = 0) {
    this.metrics.sessions.active = Math.max(0, this.metrics.sessions.active - 1);
    this.metrics.sessions.closed++;

    // Update session tracking
    if (this.metrics.sessions.bySession && this.metrics.sessions.bySession[sessionId]) {
      this.metrics.sessions.bySession[sessionId].closedAt = Date.now();
      this.metrics.sessions.bySession[sessionId].duration = duration;
      this.metrics.sessions.bySession[sessionId].commandCount = commandCount;
      this.metrics.sessions.bySession[sessionId].errorCount = errorCount;
    }

    // Recalculate averages
    this._updateSessionStats();
  }

  /**
   * Record a WebSocket connection establishment
   */
  recordConnectionOpened() {
    this.metrics.connections.active++;
    this.metrics.connections.total++;
  }

  /**
   * Record a WebSocket connection closure
   * @param {number} duration - Connection duration in milliseconds
   */
  recordConnectionClosed(duration) {
    this.metrics.connections.active = Math.max(0, this.metrics.connections.active - 1);
    this.metrics.connections.closed++;

    // Update average duration
    const currentAvg = this.metrics.connections.avgDuration || 0;
    const closedCount = this.metrics.connections.closed;
    this.metrics.connections.avgDuration =
      (currentAvg * (closedCount - 1) + duration) / closedCount;
  }

  /**
   * Record an error
   * @param {string} type - Error type
   * @param {string} message - Error message
   * @param {string} command - Command that triggered the error (optional)
   * @param {string} stack - Error stack trace (optional)
   */
  recordError(type, message, command = null, stack = null) {
    this.metrics.errors.total++;

    // Track by type
    if (!this.metrics.errors.byType[type]) {
      this.metrics.errors.byType[type] = 0;
    }
    this.metrics.errors.byType[type]++;

    // Update per-command error count if applicable
    if (command && this.metrics.commands.byCommand[command]) {
      this.metrics.commands.byCommand[command].errorCount++;
    }

    // Add to recent errors
    const error = {
      type,
      message,
      timestamp: Date.now(),
      command,
      stack
    };

    this.metrics.errors.recent.push(error);
    if (this.metrics.errors.recent.length > this.maxErrorHistory) {
      this.metrics.errors.recent.shift();
    }

    // Track timestamp for error rate calculation
    this.errorTimestamps.push(Date.now());

    // Cleanup old timestamps outside the error rate window
    const cutoffTime = Date.now() - this.errorRateWindow;
    this.errorTimestamps = this.errorTimestamps.filter(ts => ts > cutoffTime);

    // Calculate error rate (errors per second)
    this.metrics.errors.rate = this.errorTimestamps.length / (this.errorRateWindow / 1000);

    // Emit event for streaming
    this.emit('error', {
      type,
      message,
      command,
      timestamp: Date.now()
    });
  }

  /**
   * Get current metrics snapshot
   * @returns {Object} Current metrics
   */
  getCurrentMetrics() {
    // Calculate uptime
    const now = Date.now();
    this.metrics.uptime = process.uptime() * 1000;
    this.metrics.timestamp = now;

    // Update throughput for current window
    const windowElapsed = now - this.windowStartTime;
    const windowSeconds = Math.max(1, windowElapsed / 1000);

    this.metrics.throughput.messagesPerSecond = this.windowMessageCount / windowSeconds;
    this.metrics.throughput.bytesPerSecond = this.windowByteCount / windowSeconds;
    this.metrics.throughput.windowStartTime = this.windowStartTime;

    return this.metrics;
  }

  /**
   * Calculate and update latency statistics
   * @private
   */
  _updateLatencyStats() {
    const samples = this.metrics.commands.latency.samples;

    if (samples.length === 0) {
      return;
    }

    // Sort samples for percentile calculation
    const sorted = [...samples].sort((a, b) => a - b);

    // Calculate statistics
    this.metrics.commands.latency.min = sorted[0];
    this.metrics.commands.latency.max = sorted[sorted.length - 1];
    this.metrics.commands.latency.avg =
      samples.reduce((a, b) => a + b, 0) / samples.length;

    // Calculate percentiles
    this.metrics.commands.latency.p50 = this._percentile(sorted, 0.50);
    this.metrics.commands.latency.p95 = this._percentile(sorted, 0.95);
    this.metrics.commands.latency.p99 = this._percentile(sorted, 0.99);

    // Update per-command latency stats
    for (const [cmdName, cmdMetrics] of Object.entries(this.metrics.commands.byCommand)) {
      if (cmdMetrics.latency.samples.length > 0) {
        const cmdSorted = [...cmdMetrics.latency.samples].sort((a, b) => a - b);
        cmdMetrics.latency.min = cmdSorted[0];
        cmdMetrics.latency.max = cmdSorted[cmdSorted.length - 1];
        cmdMetrics.latency.avg =
          cmdMetrics.latency.samples.reduce((a, b) => a + b, 0) / cmdMetrics.latency.samples.length;

        cmdMetrics.latency.p50 = this._percentile(cmdSorted, 0.50);
        cmdMetrics.latency.p95 = this._percentile(cmdSorted, 0.95);
        cmdMetrics.latency.p99 = this._percentile(cmdSorted, 0.99);
      }
    }
  }

  /**
   * Calculate percentile from sorted array
   * @private
   */
  _percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Update session statistics
   * @private
   */
  _updateSessionStats() {
    const sessions = this.metrics.sessions.bySession || {};
    const closedSessions = Object.values(sessions).filter(s => s.closedAt);

    if (closedSessions.length > 0) {
      const totalDuration = closedSessions.reduce((sum, s) => sum + s.duration, 0);
      const totalCommands = closedSessions.reduce((sum, s) => sum + s.commandCount, 0);

      this.metrics.sessions.avgDuration = totalDuration / closedSessions.length;
      this.metrics.sessions.avgCommandsPerSession = totalCommands / closedSessions.length;
    }
  }

  /**
   * Collect memory and resource metrics
   * @private
   */
  _collectMemory() {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100
    };
  }

  /**
   * Collect CPU and connection metrics
   * @private
   */
  _collectResources() {
    const now = Date.now();
    const currentMemory = this._collectMemory();

    // Update resource metrics
    this.metrics.resources.memory = {
      ...currentMemory,
      percentUsed: currentMemory.heapTotal > 0
        ? Math.round((currentMemory.heapUsed / currentMemory.heapTotal) * 10000) / 100
        : 0
    };

    // Calculate growth rate (MB/hour)
    const timeSinceLastCheck = (now - this.lastResourceCheck) / 1000 / 60 / 60; // Convert to hours
    if (timeSinceLastCheck > 0) {
      const memGrowth = currentMemory.heapUsed - this.lastMemory.heapUsed;
      this.metrics.resources.memory.growthRate =
        Math.round(memGrowth / timeSinceLastCheck * 100) / 100;
    }

    // Track memory history for growth rate calculations
    this.memoryHistory.push(currentMemory.heapUsed);
    if (this.memoryHistory.length > this.maxMemoryHistory) {
      this.memoryHistory.shift();
    }

    this.lastResourceCheck = now;
    this.lastMemory = currentMemory;

    // Try to get CPU usage (Node.js doesn't provide direct CPU, estimate from usage)
    // This is a placeholder - actual CPU would need native module or process metrics
    this.metrics.resources.cpu.usage = this._estimateCpuUsage();
  }

  /**
   * Estimate CPU usage (simplified approach)
   * @private
   */
  _estimateCpuUsage() {
    // In a real implementation, this would use os.cpus() or a native module
    // For now, return a placeholder that could be replaced with actual CPU monitoring
    return 0;
  }

  /**
   * Periodic aggregation of metrics
   * @private
   */
  _aggregate() {
    // Reset window counters for throughput calculation
    this.windowStartTime = Date.now();
    this.windowMessageCount = 0;
    this.windowByteCount = 0;
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    if (this.resourceInterval) {
      clearInterval(this.resourceInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = MetricsCollector;
