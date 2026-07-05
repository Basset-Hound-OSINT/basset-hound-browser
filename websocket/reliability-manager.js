/**
 * Reliability Manager Module
 *
 * Implements command reliability guarantees with 99%+ SLA
 * - Automatic retry logic with exponential backoff (max 3 attempts)
 * - Per-command success/failure tracking
 * - Reliability metrics (% success per command)
 * - Timeout guarantees (all commands complete within 30-120s or fail)
 * - Transient vs permanent failure classification
 * - Real-time SLA compliance monitoring
 *
 * Features:
 * - Distinguishes transient (TIMEOUT, NETWORK_ERROR) vs permanent failures (AUTH, INVALID_PARAMS)
 * - Only retries transient failures and retryable commands
 * - Tracks per-command metrics: success %, latency (avg/p50/p95/p99), attempts
 * - Maintains global statistics across all commands
 * - Integrates with HealthEndpoint for /health endpoints
 *
 * SLA Targets:
 * - Core commands (navigate, click, fill, screenshot): 99%+ reliability
 * - All commands: 95%+ reliability target
 * - Response latency: P99 < 2000ms
 *
 * @module websocket/reliability-manager
 */

const { calculateRetryDelay, sleep } = require('./error-recovery');

/**
 * Transient errors (temporary, safe to retry)
 */
const TRANSIENT_ERRORS = [
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
  'TIMEOUT',
  'EADDRINUSE',
  'temporarily unavailable',
  'temporarily unavailable',
  'EHOSTUNREACH',
  'socket hang up'
];

/**
 * Permanent errors (non-retryable)
 */
const PERMANENT_ERRORS = [
  'INVALID_PARAMETERS',
  'AUTH_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'BAD_REQUEST',
  'Unknown command'
];

/**
 * Commands that are safe to retry (idempotent or safe for resend)
 */
const RETRYABLE_COMMANDS = new Set([
  // Navigation (safe to retry)
  'navigateTo', 'navigate', 'click', 'fill',

  // Read operations (idempotent)
  'get_url', 'get_content', 'get_page_state', 'screenshot', 'screenshot_viewport',
  'screenshot_full_page', 'screenshot_element', 'get_cookies', 'get_all_cookies',
  'list_sessions', 'list_tabs', 'get_tab_info', 'get_active_tab', 'get_history',
  'get_downloads', 'get_proxy_status', 'get_user_agent_status', 'status', 'ping',
  'get_network_logs', 'get_console_logs', 'list_profiles', 'get_profile',
  'get_storage_stats', 'get_local_storage', 'get_session_storage', 'list_scripts',
  'get_script', 'get_blocking_stats', 'get_devtools_status', 'get_console_status',
  'getHealth', 'getHealthStatus'
]);

class ReliabilityManager {
  constructor(options = {}) {
    // Configuration
    this.maxRetries = options.maxRetries || 3;
    this.commandTimeout = options.commandTimeout || 30000; // 30 seconds
    this.metricsWindow = options.metricsWindow || 10000; // 10 seconds for recent metrics

    // Logging
    this.logger = options.logger || console;

    // Per-command metrics
    this.commandMetrics = new Map(); // command -> { totalAttempts, successCount, totalLatency, samples }

    // Recent request tracking (for time-windowed metrics)
    this.recentRequests = []; // Array of { timestamp, command, latency, success, attempts }
    this.maxRecentRequests = options.maxRecentRequests || 5000;

    // Global statistics
    this.globalStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      transientRetries: 0,
      timeoutFailures: 0
    };
  }

  /**
   * Check if error is transient (retryable)
   * @private
   */
  _isTransientError(error) {
    const errorStr = String(error?.message || error?.toString() || '').toLowerCase();
    return TRANSIENT_ERRORS.some(errType => errorStr.includes(errType.toLowerCase()));
  }

  /**
   * Check if error is permanent (non-retryable)
   * @private
   */
  _isPermanentError(error) {
    const errorStr = String(error?.message || error?.toString() || '').toLowerCase();
    return PERMANENT_ERRORS.some(errType => errorStr.toLowerCase().includes(errType.toLowerCase()));
  }

  /**
   * Check if command is safe to retry (idempotent)
   * @private
   */
  _isRetryableCommand(command) {
    return RETRYABLE_COMMANDS.has(command);
  }

  /**
   * Initialize metrics for a command if not exists
   * @private
   */
  _ensureCommandMetrics(command) {
    if (!this.commandMetrics.has(command)) {
      this.commandMetrics.set(command, {
        totalAttempts: 0,
        successCount: 0,
        failureCount: 0,
        retryCount: 0,
        timeoutCount: 0,
        totalLatency: 0,
        minLatency: Infinity,
        maxLatency: 0,
        samples: [] // Last 100 samples for percentile calculation
      });
    }
  }

  /**
   * Record a command execution attempt
   * @private
   */
  _recordAttempt(command, latencyMs, success, attempts, timedOut = false) {
    this._ensureCommandMetrics(command);
    const metrics = this.commandMetrics.get(command);

    metrics.totalAttempts++;
    metrics.totalLatency += latencyMs;
    metrics.minLatency = Math.min(metrics.minLatency, latencyMs);
    metrics.maxLatency = Math.max(metrics.maxLatency, latencyMs);

    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }

    if (attempts > 1) {
      metrics.retryCount += (attempts - 1);
      this.globalStats.transientRetries++;
    }

    if (timedOut) {
      metrics.timeoutCount++;
      this.globalStats.timeoutFailures++;
    }

    // Keep last 100 samples for percentile calculation
    metrics.samples.push(latencyMs);
    if (metrics.samples.length > 100) {
      metrics.samples.shift();
    }

    // Record in recent requests
    this.recentRequests.push({
      timestamp: Date.now(),
      command,
      latency: latencyMs,
      success,
      attempts,
      timedOut
    });
    if (this.recentRequests.length > this.maxRecentRequests) {
      this.recentRequests.shift();
    }

    // Update global stats
    this.globalStats.totalRequests++;
    if (success) {
      this.globalStats.successfulRequests++;
    } else {
      this.globalStats.failedRequests++;
    }
  }

  /**
   * Execute command with reliability guarantees
   *
   * @param {string} command - Command name
   * @param {Function} executor - Async function that executes the command
   * @param {Object} options - Execution options
   * @param {number} options.timeout - Timeout in ms (default: 30s)
   * @returns {Promise<Object>} { success, result/error, attempts, latency }
   */
  async execute(command, executor, options = {}) {
    const timeout = options.timeout || this.commandTimeout;
    const isRetryable = this._isRetryableCommand(command);
    const maxRetries = isRetryable ? this.maxRetries : 0;

    let attempt = 0;
    let lastError = null;
    const startTime = Date.now();

    while (attempt <= maxRetries) {
      try {
        // Wrap executor in timeout promise
        const result = await Promise.race([
          executor(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), timeout)
          )
        ]);

        // Success
        const latency = Date.now() - startTime;
        this._recordAttempt(command, latency, true, attempt + 1, false);

        return {
          success: true,
          result,
          attempts: attempt + 1,
          latency,
          retried: attempt > 0
        };

      } catch (error) {
        lastError = error;
        const isTimeout = error.message === 'TIMEOUT';

        if (attempt < maxRetries && isRetryable) {
          const isTransient = this._isTransientError(error);
          const isPermanent = this._isPermanentError(error);

          // Don't retry permanent errors
          if (isPermanent && !isTimeout) {
            break;
          }

          // Retry if transient or timeout
          if (isTransient || isTimeout) {
            const delay = calculateRetryDelay(attempt);
            this.logger.debug(
              `[ReliabilityManager] Command '${command}' failed (attempt ${attempt + 1}/${maxRetries + 1}), ` +
              `retrying in ${delay}ms: ${error.message}`
            );
            await sleep(delay);
            attempt++;
            continue;
          }
        }

        // No more retries
        break;
      }
    }

    // Failed after all retries
    const latency = Date.now() - startTime;
    const isTimeout = lastError?.message === 'TIMEOUT';
    this._recordAttempt(command, latency, false, attempt + 1, isTimeout);

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      attempts: attempt + 1,
      latency,
      retried: attempt > 0,
      timedOut: isTimeout
    };
  }

  /**
   * Get reliability metrics for a command
   * @param {string} command - Command name
   * @returns {Object} Metrics object
   */
  getCommandMetrics(command) {
    this._ensureCommandMetrics(command);
    const metrics = this.commandMetrics.get(command);

    if (metrics.totalAttempts === 0) {
      return {
        command,
        reliability: 'N/A',
        avgLatency: 'N/A',
        minLatency: 'N/A',
        maxLatency: 'N/A',
        samples: 0,
        retries: 0
      };
    }

    const reliability = ((metrics.successCount / metrics.totalAttempts) * 100).toFixed(2) + '%';
    const avgLatency = Math.round(metrics.totalLatency / metrics.totalAttempts);
    const percentiles = this._calculatePercentiles(metrics.samples);

    return {
      command,
      reliability,
      successCount: metrics.successCount,
      failureCount: metrics.failureCount,
      totalAttempts: metrics.totalAttempts,
      avgLatency: avgLatency + 'ms',
      minLatency: metrics.minLatency === Infinity ? 'N/A' : metrics.minLatency + 'ms',
      maxLatency: metrics.maxLatency === 0 ? 'N/A' : metrics.maxLatency + 'ms',
      p50Latency: percentiles.p50 + 'ms',
      p95Latency: percentiles.p95 + 'ms',
      p99Latency: percentiles.p99 + 'ms',
      retries: metrics.retryCount,
      timeouts: metrics.timeoutCount,
      samples: metrics.samples.length
    };
  }

  /**
   * Get reliability metrics for all commands
   * @returns {Object} Map of command -> metrics
   */
  getAllCommandMetrics() {
    const result = {};
    for (const command of this.commandMetrics.keys()) {
      result[command] = this.getCommandMetrics(command);
    }
    return result;
  }

  /**
   * Get global reliability statistics
   * @returns {Object} Global statistics
   */
  getGlobalStats() {
    const totalRequests = this.globalStats.totalRequests;
    const successRate = totalRequests > 0
      ? ((this.globalStats.successfulRequests / totalRequests) * 100).toFixed(2) + '%'
      : 'N/A';

    return {
      totalRequests,
      successfulRequests: this.globalStats.successfulRequests,
      failedRequests: this.globalStats.failedRequests,
      successRate,
      transientRetries: this.globalStats.transientRetries,
      timeoutFailures: this.globalStats.timeoutFailures,
      commandCount: this.commandMetrics.size,
      recentRequestsCount: this.recentRequests.length
    };
  }

  /**
   * Get top commands by request count
   * @param {number} limit - Number of commands to return
   * @returns {Array} Top commands with their metrics
   */
  getTopCommands(limit = 10) {
    const commands = Array.from(this.commandMetrics.entries())
      .map(([cmd, metrics]) => ({
        command: cmd,
        attempts: metrics.totalAttempts,
        success: metrics.successCount,
        reliability: ((metrics.successCount / metrics.totalAttempts) * 100).toFixed(2) + '%',
        avgLatency: Math.round(metrics.totalLatency / metrics.totalAttempts) + 'ms'
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, limit);

    return commands;
  }

  /**
   * Get recent requests (last N)
   * @param {number} limit - Number of recent requests to return
   * @returns {Array} Recent requests
   */
  getRecentRequests(limit = 100) {
    return this.recentRequests.slice(-limit).map(req => ({
      ...req,
      timestamp: new Date(req.timestamp).toISOString()
    }));
  }

  /**
   * Calculate latency percentiles
   * @private
   */
  _calculatePercentiles(samples) {
    if (samples.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)]
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.commandMetrics.clear();
    this.recentRequests = [];
    this.globalStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      transientRetries: 0,
      timeoutFailures: 0
    };
    this.logger.info('[ReliabilityManager] All metrics reset');
  }

  /**
   * Get health status based on reliability metrics
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const globalStats = this.getGlobalStats();
    const overallReliability = globalStats.totalRequests > 0
      ? parseFloat(globalStats.successRate)
      : null;

    const isHealthy = overallReliability === null || overallReliability >= 95; // 95%+ is healthy

    return {
      healthy: isHealthy,
      overallReliability: globalStats.successRate,
      threshold: '99%+',
      warning: overallReliability !== null && overallReliability < 99
        ? `Overall reliability ${overallReliability}% is below 99% SLA target`
        : null,
      metrics: globalStats
    };
  }
}

module.exports = {
  ReliabilityManager,
  TRANSIENT_ERRORS,
  PERMANENT_ERRORS,
  RETRYABLE_COMMANDS
};
