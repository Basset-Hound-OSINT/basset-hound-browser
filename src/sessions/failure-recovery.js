/**
 * Basset Hound Browser - Failure Recovery System
 * Detects and recovers from various failure types with adaptive strategies
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 *
 * Features:
 * - Failure type detection (rate limit, bot detection, connection lost, server error, auth denied)
 * - Adaptive recovery strategies per failure type
 * - Exponential backoff for rate limiting
 * - Automatic retry mechanisms
 * - Success metrics and analytics
 * - Integration with session checkpoints
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Failure recovery manager
 */
class FailureRecoveryManager {
  constructor(options = {}) {
    this.storageDir = options.storageDir || '/tmp/basset-sessions/recovery';
    this.maxRetries = options.maxRetries || 5;
    this.initialBackoff = options.initialBackoff || 100; // ms
    this.maxBackoff = options.maxBackoff || 30000; // 30s
    this.enableAutoRecovery = options.enableAutoRecovery !== false;

    // In-memory tracking
    this.recoveryLog = new Map(); // sessionId -> [recovery events]
    this.retryCounters = new Map(); // sessionId -> retry count
    this.backoffState = new Map(); // sessionId -> { nextRetryTime, backoffMs }
    this.recoveryMetrics = new Map(); // sessionId -> metrics

    this.ensureStorageDir();
  }

  /**
   * Ensure storage directory exists
   */
  ensureStorageDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Detect failure type from error response
   */
  detectFailureType(sessionId, statusCode, headers = {}, body = '') {
    const detection = {
      sessionId,
      detectedAt: Date.now(),
      statusCode,
      failureType: null,
      confidence: 0,
      indicators: []
    };

    // Rate limit detection (429, X-RateLimit headers)
    if (statusCode === 429) {
      detection.failureType = 'rate_limit';
      detection.confidence = 1.0;
      detection.indicators.push('HTTP 429 status code');

      // Extract retry-after header if present
      const retryAfter = headers['retry-after'];
      if (retryAfter) {
        detection.retryAfter = parseInt(retryAfter) * 1000;
        detection.indicators.push(`Retry-After: ${retryAfter}s`);
      }
    }
    // 403 Forbidden - bot detection or auth denial
    else if (statusCode === 403) {
      if (this._isBotDetection(body, headers)) {
        detection.failureType = 'bot_detection';
        detection.confidence = 0.95;
        detection.indicators.push('403 Forbidden with bot detection patterns');
      } else {
        detection.failureType = 'auth_denied';
        detection.confidence = 0.85;
        detection.indicators.push('403 Forbidden without bot patterns');
      }
    }
    // 401 Unauthorized - auth issue
    else if (statusCode === 401) {
      detection.failureType = 'auth_denied';
      detection.confidence = 0.9;
      detection.indicators.push('HTTP 401 Unauthorized');
    }
    // 503 Service Unavailable (rate limit related)
    else if (statusCode === 503) {
      detection.failureType = 'rate_limit';
      detection.confidence = 0.85;
      detection.indicators.push('HTTP 503 Service Unavailable');
    }
    // 5xx Server errors
    else if (statusCode >= 500 && statusCode < 600) {
      detection.failureType = 'server_error';
      detection.confidence = 0.9;
      detection.indicators.push(`HTTP ${statusCode} server error`);
    }
    // Connection timeouts and network errors
    else if (statusCode === 0 || statusCode === 408) {
      detection.failureType = 'connection_lost';
      detection.confidence = 0.95;
      detection.indicators.push('Connection timeout or lost');
    }

    this._recordDetection(sessionId, detection);
    return detection;
  }

  /**
   * Check if 403 is due to bot detection
   * @private
   */
  _isBotDetection(body, headers = {}) {
    const botPatterns = [
      /cloudflare/i,
      /challenge/i,
      /recaptcha/i,
      /hcaptcha/i,
      /verify/i,
      /bot|automated/i,
      /javascript/i,
      /enable javascript/i
    ];

    const bodyLower = (body || '').toLowerCase();
    return botPatterns.some(pattern => pattern.test(bodyLower));
  }

  /**
   * Record failure detection
   * @private
   */
  _recordDetection(sessionId, detection) {
    if (!this.recoveryLog.has(sessionId)) {
      this.recoveryLog.set(sessionId, []);
    }
    this.recoveryLog.get(sessionId).push(detection);
  }

  /**
   * Calculate exponential backoff time
   * @private
   */
  _calculateBackoff(sessionId, retryCount) {
    // Exponential backoff: 100ms * 2^(retryCount - 1) with jitter
    const exponentialMs = this.initialBackoff * Math.pow(2, retryCount - 1);
    const cappedMs = Math.min(exponentialMs, this.maxBackoff);

    // Add jitter (10% variance)
    const jitter = cappedMs * 0.1 * (Math.random() - 0.5);
    return Math.max(100, cappedMs + jitter);
  }

  /**
   * Handle failure and determine recovery action
   */
  handleFailure(sessionId, failureType, details = {}, lastCheckpoint = null) {
    const recovery = {
      id: crypto.randomBytes(8).toString('hex'),
      sessionId,
      failureType,
      timestamp: Date.now(),
      attempt: (this.retryCounters.get(sessionId) || 0) + 1,
      details,
      lastCheckpoint,
      recommendedStrategies: [],
      nextAction: null,
      metadata: {}
    };

    // Get current retry count
    const retryCount = recovery.attempt;

    // Check if we've exceeded max retries
    if (retryCount > this.maxRetries) {
      recovery.nextAction = 'abort';
      recovery.reason = `Exceeded max retries (${this.maxRetries})`;
      return recovery;
    }

    // Get recovery strategies for this failure type
    recovery.recommendedStrategies = this.getRecoveryStrategies(failureType);

    // Determine next action based on failure type
    switch (failureType) {
      case 'rate_limit':
        const backoffMs = this._calculateBackoff(sessionId, retryCount);
        recovery.nextAction = 'wait_and_retry';
        recovery.backoffMs = backoffMs;
        recovery.retryAfter = Math.ceil(backoffMs / 1000);

        // Update backoff state
        this.backoffState.set(sessionId, {
          nextRetryTime: Date.now() + backoffMs,
          backoffMs,
          retryCount
        });
        recovery.metadata = { backoffMs, retryAfter: recovery.retryAfter };
        break;

      case 'bot_detection':
        recovery.nextAction = 'rotate_and_retry';
        recovery.strategies = [
          { action: 'rotate_fingerprint', priority: 1 },
          { action: 'rotate_proxy', priority: 2 },
          { action: 'rotate_user_agent', priority: 3 },
          { action: 'wait', duration: 300000, priority: 4 }
        ];
        recovery.metadata = { suggestBehavioralSimulation: true };
        break;

      case 'auth_denied':
        recovery.nextAction = 'rotate_and_retry';
        recovery.strategies = [
          { action: 'rotate_user_agent', priority: 1 },
          { action: 'rotate_proxy', priority: 2 },
          { action: 'clear_cookies', priority: 3 },
          { action: 'rotate_fingerprint', priority: 4 }
        ];
        recovery.metadata = { clearAuth: true };
        break;

      case 'server_error':
        const serverBackoffMs = this._calculateBackoff(sessionId, retryCount);
        recovery.nextAction = 'wait_and_retry';
        recovery.backoffMs = serverBackoffMs;
        recovery.retryAfter = Math.ceil(serverBackoffMs / 1000);
        this.backoffState.set(sessionId, {
          nextRetryTime: Date.now() + serverBackoffMs,
          backoffMs: serverBackoffMs,
          retryCount
        });
        break;

      case 'connection_lost':
        recovery.nextAction = 'restore_and_retry';
        recovery.restoreFromCheckpoint = lastCheckpoint;
        recovery.strategies = [
          { action: 'restore_from_snapshot', priority: 1, checkpoint: lastCheckpoint },
          { action: 'retry', duration: 5000, priority: 2 }
        ];
        recovery.metadata = { waitBeforeRetry: 5000 };
        break;

      default:
        recovery.nextAction = 'wait_and_retry';
        recovery.backoffMs = this._calculateBackoff(sessionId, retryCount);
    }

    // Increment retry counter
    this.retryCounters.set(sessionId, retryCount);

    // Record recovery event
    this._recordRecoveryEvent(sessionId, recovery);

    // Update metrics
    this._updateMetrics(sessionId, recovery);

    return recovery;
  }

  /**
   * Record recovery event
   * @private
   */
  _recordRecoveryEvent(sessionId, recovery) {
    if (!this.recoveryLog.has(sessionId)) {
      this.recoveryLog.set(sessionId, []);
    }
    this.recoveryLog.get(sessionId).push({
      type: 'recovery',
      event: recovery,
      timestamp: Date.now()
    });
  }

  /**
   * Update recovery metrics
   * @private
   */
  _updateMetrics(sessionId, recovery) {
    if (!this.recoveryMetrics.has(sessionId)) {
      this.recoveryMetrics.set(sessionId, {
        totalFailures: 0,
        totalRecoveries: 0,
        failuresByType: {},
        recoverySuccessRate: 0,
        averageRecoveryTime: 0,
        lastRecoveryTime: null
      });
    }

    const metrics = this.recoveryMetrics.get(sessionId);
    metrics.totalFailures++;

    if (!metrics.failuresByType[recovery.failureType]) {
      metrics.failuresByType[recovery.failureType] = 0;
    }
    metrics.failuresByType[recovery.failureType]++;

    metrics.lastRecoveryTime = Date.now();
  }

  /**
   * Check if session can retry based on backoff state
   */
  canRetry(sessionId) {
    const backoffState = this.backoffState.get(sessionId);
    if (!backoffState) {
      return true;
    }
    return Date.now() >= backoffState.nextRetryTime;
  }

  /**
   * Get time until next retry is allowed
   */
  getTimeUntilRetry(sessionId) {
    const backoffState = this.backoffState.get(sessionId);
    if (!backoffState) {
      return 0;
    }
    return Math.max(0, backoffState.nextRetryTime - Date.now());
  }

  /**
   * Record successful recovery (increment success counter)
   */
  recordRecoverySuccess(sessionId) {
    const metrics = this.recoveryMetrics.get(sessionId);
    if (metrics) {
      metrics.totalRecoveries++;
      metrics.recoverySuccessRate = metrics.totalRecoveries / metrics.totalFailures;
    }

    // Clear backoff state on success
    this.backoffState.delete(sessionId);
    this.retryCounters.set(sessionId, 0);
  }

  /**
   * Reset session recovery state
   */
  resetSessionRecoveryState(sessionId) {
    this.retryCounters.set(sessionId, 0);
    this.backoffState.delete(sessionId);
  }

  /**
   * Get recovery strategies for failure type
   */
  getRecoveryStrategies(failureType) {
    const strategies = {
      'rate_limit': [
        {
          action: 'wait',
          description: 'Wait until backoff expires',
          priority: 1,
          autoExecute: true
        },
        {
          action: 'rotate_proxy',
          description: 'Switch to different proxy',
          priority: 2
        },
        {
          action: 'rotate_user_agent',
          description: 'Change user agent',
          priority: 3
        },
        {
          action: 'rotate_fingerprint',
          description: 'Apply different device profile',
          priority: 4
        }
      ],
      'bot_detection': [
        {
          action: 'rotate_fingerprint',
          description: 'Apply different device profile',
          priority: 1
        },
        {
          action: 'enable_behavioral_patterns',
          description: 'Activate realistic behavior simulation',
          priority: 2
        },
        {
          action: 'rotate_proxy',
          description: 'Switch to different proxy',
          priority: 3
        },
        {
          action: 'wait',
          duration: 300000,
          description: 'Wait 5 minutes before retry',
          priority: 4
        }
      ],
      'auth_denied': [
        {
          action: 'rotate_user_agent',
          description: 'Change user agent',
          priority: 1
        },
        {
          action: 'rotate_proxy',
          description: 'Switch to different proxy',
          priority: 2
        },
        {
          action: 'clear_cookies',
          description: 'Clear session cookies',
          priority: 3
        },
        {
          action: 'rotate_fingerprint',
          description: 'Apply different device profile',
          priority: 4
        }
      ],
      'server_error': [
        {
          action: 'wait',
          description: 'Wait before retry with exponential backoff',
          priority: 1,
          autoExecute: true
        },
        {
          action: 'rotate_proxy',
          description: 'Try with different proxy',
          priority: 2
        }
      ],
      'connection_lost': [
        {
          action: 'restore_from_snapshot',
          description: 'Restore from last checkpoint',
          priority: 1
        },
        {
          action: 'retry',
          duration: 5000,
          description: 'Retry after 5 seconds',
          priority: 2,
          autoExecute: true
        },
        {
          action: 'rotate_proxy',
          description: 'Switch to different proxy',
          priority: 3
        }
      ]
    };

    return strategies[failureType] || strategies['server_error'];
  }

  /**
   * Get recovery log for session
   */
  getRecoveryLog(sessionId, filter = {}) {
    const log = this.recoveryLog.get(sessionId) || [];

    let filtered = log;

    if (filter.type) {
      filtered = filtered.filter(entry => entry.type === filter.type);
    }

    if (filter.failureType) {
      filtered = filtered.filter(entry =>
        entry.event && entry.event.failureType === filter.failureType
      );
    }

    if (filter.since) {
      filtered = filtered.filter(entry => entry.timestamp >= filter.since);
    }

    return filtered;
  }

  /**
   * Get recovery metrics for session
   */
  getRecoveryMetrics(sessionId) {
    return this.recoveryMetrics.get(sessionId) || {
      totalFailures: 0,
      totalRecoveries: 0,
      failuresByType: {},
      recoverySuccessRate: 0,
      averageRecoveryTime: 0,
      lastRecoveryTime: null
    };
  }

  /**
   * Export recovery data for session
   */
  exportRecoveryData(sessionId, format = 'json') {
    const log = this.recoveryLog.get(sessionId) || [];
    const metrics = this.getRecoveryMetrics(sessionId);

    const exportData = {
      sessionId,
      exportedAt: Date.now(),
      log,
      metrics,
      summary: {
        totalEvents: log.length,
        totalFailures: metrics.totalFailures,
        successRate: (metrics.recoverySuccessRate * 100).toFixed(2) + '%',
        failureBreakdown: metrics.failuresByType
      }
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      return this._toCsv(log);
    }

    return exportData;
  }

  /**
   * Convert recovery log to CSV format
   * @private
   */
  _toCsv(log) {
    const headers = ['timestamp', 'type', 'failureType', 'attempt', 'action', 'reason'];
    const rows = log.map(entry => {
      if (entry.type === 'detection') {
        return [
          new Date(entry.timestamp).toISOString(),
          'detection',
          entry.failureType,
          '-',
          '-',
          entry.indicators.join('; ')
        ];
      } else if (entry.type === 'recovery') {
        return [
          new Date(entry.timestamp).toISOString(),
          'recovery',
          entry.event.failureType,
          entry.event.attempt,
          entry.event.nextAction,
          entry.event.reason || '-'
        ];
      }
      return [];
    });

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Save recovery state to disk for persistence
   */
  saveRecoveryState(sessionId) {
    const state = {
      sessionId,
      savedAt: Date.now(),
      retryCount: this.retryCounters.get(sessionId) || 0,
      backoffState: this.backoffState.get(sessionId),
      recoveryLog: this.recoveryLog.get(sessionId) || [],
      metrics: this.recoveryMetrics.get(sessionId)
    };

    const filePath = path.join(this.storageDir, `${sessionId}-recovery.json`);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));

    return filePath;
  }

  /**
   * Load recovery state from disk
   */
  loadRecoveryState(sessionId) {
    const filePath = path.join(this.storageDir, `${sessionId}-recovery.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const state = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // Restore state
      this.retryCounters.set(sessionId, state.retryCount);
      if (state.backoffState) {
        this.backoffState.set(sessionId, state.backoffState);
      }
      if (state.recoveryLog) {
        this.recoveryLog.set(sessionId, state.recoveryLog);
      }
      if (state.metrics) {
        this.recoveryMetrics.set(sessionId, state.metrics);
      }

      return state;
    } catch (error) {
      console.error(`Failed to load recovery state for ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Clean up old recovery data (older than retentionDays)
   */
  cleanupOldData(retentionDays = 30) {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    // Clean in-memory logs
    for (const [sessionId, log] of this.recoveryLog.entries()) {
      const filtered = log.filter(entry => entry.timestamp > cutoffTime);
      if (filtered.length === 0) {
        this.recoveryLog.delete(sessionId);
      } else {
        this.recoveryLog.set(sessionId, filtered);
      }
    }

    // Clean disk files
    try {
      const files = fs.readdirSync(this.storageDir);
      for (const file of files) {
        if (file.endsWith('-recovery.json')) {
          const filePath = path.join(this.storageDir, file);
          const stat = fs.statSync(filePath);
          if (stat.mtimeMs < cutoffTime) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old recovery data:', error);
    }
  }
}

module.exports = { FailureRecoveryManager };
