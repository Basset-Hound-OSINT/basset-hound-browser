/**
 * Recovery Tracking for Basset Hound Browser
 *
 * Provides:
 * - Recovery attempt tracking
 * - Success rate monitoring
 * - Time-to-recovery metrics
 * - Recovery pattern analysis
 *
 * Features:
 * - Strategy-based recovery tracking
 * - Success/failure analysis
 * - Recovery time distribution
 * - Recovery pattern learning
 * - Recommendation engine
 */

const EventEmitter = require('events');

class RecoveryTracker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enablePatternLearning: options.enablePatternLearning !== false,
      enableRecommendations: options.enableRecommendations !== false,
      historySize: options.historySize || 5000,
      recoveryTimeoutMs: options.recoveryTimeoutMs || 60000,
      ...options
    };

    this.recoveryAttempts = new Map();
    this.recoveryMetrics = new Map();
    this.strategyPerformance = new Map();
    this.recoveryPatterns = new Map();
    this.recoverySuccesses = [];
    this.recoveryFailures = [];
    this.timeToRecoveryHistory = [];
  }

  /**
   * Start recovery attempt
   */
  startRecoveryAttempt(errorId, attemptData) {
    const attempt = {
      recoveryId: this._generateRecoveryId(),
      errorId,
      attemptNumber: attemptData.attemptNumber || 1,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      strategy: attemptData.strategy || 'retry', // retry, fallback, circuit_break, graceful_degrade, manual_intervention
      action: attemptData.action || null,
      parameters: attemptData.parameters || {},
      status: 'in_progress', // in_progress, succeeded, failed, timeout
      successIndicators: attemptData.successIndicators || [],
      failureIndicators: attemptData.failureIndicators || [],
      actionsTaken: [],
      observedChanges: [],
      systemMetricsSnapshot: attemptData.systemMetricsSnapshot || {},
      retryable: attemptData.retryable !== false,
      result: null,
      nextSteps: []
    };

    this.recoveryAttempts.set(attempt.recoveryId, attempt);

    this.emit('recovery:started', {
      recoveryId: attempt.recoveryId,
      errorId,
      strategy: attempt.strategy,
      attemptNumber: attempt.attemptNumber
    });

    return attempt;
  }

  /**
   * Update recovery attempt progress
   */
  updateRecoveryProgress(recoveryId, progressData) {
    const attempt = this.recoveryAttempts.get(recoveryId);
    if (!attempt) {
      throw new Error(`Recovery ${recoveryId} not found`);
    }

    // Record action taken
    if (progressData.action) {
      attempt.actionsTaken.push({
        action: progressData.action,
        timestamp: Date.now(),
        result: progressData.actionResult || null
      });
    }

    // Record observed change
    if (progressData.observation) {
      attempt.observedChanges.push({
        observation: progressData.observation,
        timestamp: Date.now(),
        metric: progressData.metric || null,
        value: progressData.value || null
      });
    }

    // Update metrics snapshot if provided
    if (progressData.systemMetrics) {
      attempt.systemMetricsSnapshot = progressData.systemMetrics;
    }

    this.emit('recovery:progressed', {
      recoveryId,
      actionsCount: attempt.actionsTaken.length,
      observationsCount: attempt.observedChanges.length
    });

    return attempt;
  }

  /**
   * Complete recovery attempt
   */
  completeRecoveryAttempt(recoveryId, resultData) {
    const attempt = this.recoveryAttempts.get(recoveryId);
    if (!attempt) {
      throw new Error(`Recovery ${recoveryId} not found`);
    }

    attempt.endTime = Date.now();
    attempt.duration = attempt.endTime - attempt.startTime;
    attempt.status = resultData.successful ? 'succeeded' : 'failed';
    attempt.result = resultData.result || null;

    // Determine if recovery was successful
    const successful = resultData.successful === true;

    if (successful) {
      this.recoverySuccesses.push(attempt);
      this._updateStrategyPerformance(attempt.strategy, true, attempt.duration);
    } else {
      this.recoveryFailures.push(attempt);
      this._updateStrategyPerformance(attempt.strategy, false, attempt.duration);
    }

    // Track time to recovery
    if (successful) {
      this.timeToRecoveryHistory.push({
        errorId: attempt.errorId,
        strategy: attempt.strategy,
        duration: attempt.duration,
        timestamp: attempt.endTime,
        attemptNumber: attempt.attemptNumber
      });

      if (this.timeToRecoveryHistory.length > this.options.historySize) {
        this.timeToRecoveryHistory.shift();
      }
    }

    // Analyze recovery pattern if enabled
    if (this.options.enablePatternLearning && successful) {
      this._analyzeRecoveryPattern(attempt);
    }

    this.emit('recovery:completed', {
      recoveryId,
      successful,
      duration: attempt.duration,
      strategy: attempt.strategy,
      errorId: attempt.errorId
    });

    return attempt;
  }

  /**
   * Get recovery metrics by strategy
   */
  getStrategyMetrics(strategy) {
    const metrics = this.strategyPerformance.get(strategy);
    if (!metrics) {
      return null;
    }

    return {
      strategy,
      totalAttempts: metrics.totalAttempts,
      successfulAttempts: metrics.successfulAttempts,
      failedAttempts: metrics.failedAttempts,
      successRate: ((metrics.successfulAttempts / metrics.totalAttempts) * 100).toFixed(2),
      avgTimeToRecovery: metrics.totalDuration > 0
        ? (metrics.totalDuration / metrics.successfulAttempts).toFixed(2)
        : 'N/A',
      minTimeToRecovery: metrics.minDuration,
      maxTimeToRecovery: metrics.maxDuration,
      lastUsed: metrics.lastUsed,
      trending: metrics.trending
    };
  }

  /**
   * Get overall recovery metrics
   */
  getRecoveryMetrics() {
    const allAttempts = Array.from(this.recoveryAttempts.values());
    const successful = allAttempts.filter(a => a.status === 'succeeded');
    const failed = allAttempts.filter(a => a.status === 'failed');

    const totalDuration = successful.reduce((sum, a) => sum + (a.duration || 0), 0);

    return {
      totalAttempts: allAttempts.length,
      successfulAttempts: successful.length,
      failedAttempts: failed.length,
      successRate: allAttempts.length > 0
        ? ((successful.length / allAttempts.length) * 100).toFixed(2)
        : 0,
      avgTimeToRecovery: successful.length > 0
        ? (totalDuration / successful.length).toFixed(2)
        : 0,
      strategies: Array.from(this.strategyPerformance.keys()),
      topStrategy: this._getTopStrategy(),
      recoveryPatterns: Array.from(this.recoveryPatterns.values()).map(p => ({
        patternId: p.patternId,
        pattern: p.pattern,
        occurrences: p.occurrences,
        successRate: p.successRate
      }))
    };
  }

  /**
   * Get time to recovery statistics
   */
  getTimeToRecoveryStats(strategy = null, timeWindowMs = 3600000) {
    const now = Date.now();
    let records = this.timeToRecoveryHistory
      .filter(r => (now - r.timestamp) <= timeWindowMs);

    if (strategy) {
      records = records.filter(r => r.strategy === strategy);
    }

    if (records.length === 0) {
      return null;
    }

    const durations = records.map(r => r.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      strategy: strategy || 'all',
      sampleCount: records.length,
      timeWindow: timeWindowMs,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      avgDuration: (sum / durations.length).toFixed(2),
      medianDuration: durations[Math.floor(durations.length / 2)],
      p95Duration: this._percentile(durations, 95),
      p99Duration: this._percentile(durations, 99),
      stdDev: this._calculateStdDev(durations)
    };
  }

  /**
   * Get recovery attempt details
   */
  getRecoveryDetails(recoveryId) {
    const attempt = this.recoveryAttempts.get(recoveryId);
    if (!attempt) {
      return null;
    }

    return {
      recoveryId: attempt.recoveryId,
      errorId: attempt.errorId,
      attemptNumber: attempt.attemptNumber,
      strategy: attempt.strategy,
      status: attempt.status,
      duration: attempt.duration,
      startTime: attempt.startTime,
      endTime: attempt.endTime,
      actionsTaken: attempt.actionsTaken,
      observedChanges: attempt.observedChanges,
      result: attempt.result,
      successIndicators: attempt.successIndicators,
      failureIndicators: attempt.failureIndicators,
      systemMetricsSnapshot: attempt.systemMetricsSnapshot
    };
  }

  /**
   * Get recovery success timeline
   */
  getRecoveryTimeline(options = {}) {
    const records = options.strategy
      ? this.recoverySuccesses.filter(r => r.strategy === options.strategy)
      : this.recoverySuccesses;

    return records
      .sort((a, b) => a.endTime - b.endTime)
      .map(r => ({
        recoveryId: r.recoveryId,
        errorId: r.errorId,
        timestamp: r.endTime,
        duration: r.duration,
        strategy: r.strategy,
        attemptNumber: r.attemptNumber
      }));
  }

  /**
   * Recommend recovery strategy for error
   */
  recommendRecoveryStrategy(errorData) {
    if (!this.options.enableRecommendations) {
      return null;
    }

    const errorType = errorData.errorType || 'unknown';
    const errorSeverity = errorData.severity || 'error';

    // Score strategies based on historical performance
    const strategyScores = [];

    for (const [strategy, metrics] of this.strategyPerformance) {
      let score = 0;

      // Higher success rate = higher score
      const successRate = metrics.successfulAttempts / metrics.totalAttempts;
      score += successRate * 50;

      // Lower recovery time = higher score
      const avgTime = metrics.totalDuration / metrics.successfulAttempts;
      score += Math.max(0, 50 - (avgTime / 1000)); // Penalize longer times

      // Recent success = boost
      const daysSinceLastUse = (Date.now() - metrics.lastUsed) / (1000 * 60 * 60 * 24);
      if (daysSinceLastUse < 1) {
        score += 10;
      }

      strategyScores.push({
        strategy,
        score,
        successRate: (successRate * 100).toFixed(2),
        avgRecoveryTime: avgTime.toFixed(2)
      });
    }

    strategyScores.sort((a, b) => b.score - a.score);

    return {
      errorType,
      errorSeverity,
      recommendedStrategies: strategyScores.slice(0, 3),
      topRecommendation: strategyScores.length > 0 ? strategyScores[0].strategy : 'retry'
    };
  }

  /**
   * Get recovery pattern analysis
   */
  getRecoveryPatterns() {
    return Array.from(this.recoveryPatterns.values()).map(p => ({
      patternId: p.patternId,
      pattern: p.pattern,
      description: p.description,
      occurrences: p.occurrences,
      successRate: (p.successRate * 100).toFixed(2),
      strategy: p.strategy,
      errorTypes: Array.from(p.errorTypes),
      avgRecoveryTime: p.avgRecoveryTime
    }));
  }

  /**
   * Update strategy performance
   */
  _updateStrategyPerformance(strategy, successful, duration) {
    if (!this.strategyPerformance.has(strategy)) {
      this.strategyPerformance.set(strategy, {
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        lastUsed: Date.now(),
        trending: 'stable'
      });
    }

    const metrics = this.strategyPerformance.get(strategy);
    metrics.totalAttempts++;

    if (successful) {
      metrics.successfulAttempts++;
      metrics.totalDuration += duration || 0;
      metrics.minDuration = Math.min(metrics.minDuration, duration || 0);
      metrics.maxDuration = Math.max(metrics.maxDuration, duration || 0);
    } else {
      metrics.failedAttempts++;
    }

    metrics.lastUsed = Date.now();

    // Analyze trend
    const recentSuccessRate = metrics.successfulAttempts / metrics.totalAttempts;
    if (recentSuccessRate > 0.8) {
      metrics.trending = 'improving';
    } else if (recentSuccessRate < 0.5) {
      metrics.trending = 'declining';
    } else {
      metrics.trending = 'stable';
    }
  }

  /**
   * Analyze recovery pattern
   */
  _analyzeRecoveryPattern(attempt) {
    const key = `${attempt.strategy}-${attempt.status}`;

    if (!this.recoveryPatterns.has(key)) {
      this.recoveryPatterns.set(key, {
        patternId: `pattern-${key}-${Math.random().toString(36).substr(2, 9)}`,
        pattern: key,
        description: `${attempt.strategy} recovery resulting in ${attempt.status}`,
        strategy: attempt.strategy,
        occurrences: 0,
        successRate: 0,
        errorTypes: new Set(),
        avgRecoveryTime: 0,
        totalTime: 0,
        totalOccurrences: 0
      });
    }

    const pattern = this.recoveryPatterns.get(key);
    pattern.occurrences++;
    pattern.errorTypes.add(attempt.errorId);
    pattern.totalTime += attempt.duration || 0;
    pattern.totalOccurrences++;
    pattern.avgRecoveryTime = pattern.totalTime / pattern.totalOccurrences;
    pattern.successRate = attempt.status === 'succeeded' ? 1.0 : pattern.successRate * 0.9;
  }

  /**
   * Get top strategy
   */
  _getTopStrategy() {
    let topStrategy = null;
    let topSuccessRate = -1;

    for (const [strategy, metrics] of this.strategyPerformance) {
      const successRate = metrics.successfulAttempts / metrics.totalAttempts;
      if (successRate > topSuccessRate) {
        topSuccessRate = successRate;
        topStrategy = strategy;
      }
    }

    return topStrategy;
  }

  /**
   * Generate recovery ID
   */
  _generateRecoveryId() {
    return `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate percentile
   */
  _percentile(arr, p) {
    if (arr.length === 0) return 0;
    const index = (p / 100) * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) return arr[lower];
    return arr[lower] * (1 - weight) + arr[upper] * weight;
  }

  /**
   * Calculate standard deviation
   */
  _calculateStdDev(arr) {
    if (arr.length === 0) return 0;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const squareDiffs = arr.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(avgSquareDiff).toFixed(2);
  }

  /**
   * Close system
   */
  close() {
    this.recoveryAttempts.clear();
    this.recoveryMetrics.clear();
    this.strategyPerformance.clear();
    this.recoveryPatterns.clear();
    this.recoverySuccesses = [];
    this.recoveryFailures = [];
    this.timeToRecoveryHistory = [];
    this.emit('system:closed');
  }
}

module.exports = RecoveryTracker;
