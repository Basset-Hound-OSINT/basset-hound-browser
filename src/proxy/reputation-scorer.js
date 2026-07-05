/**
 * Basset Hound Browser - Proxy Reputation Scoring System
 * Tracks proxy health and dynamically excludes deteriorating proxies
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 *
 * Features:
 * - Reputation scoring (0-100 scale)
 * - Dynamic proxy exclusion and recovery
 * - Performance metric tracking
 * - Health trend analysis
 * - Pool-wide reputation reporting
 */

class ReputationScorer {
  constructor(options = {}) {
    this.proxyReputations = new Map(); // proxyId -> reputationData
    this.scoringWeights = options.scoringWeights || {
      successRate: 0.40,
      responseTime: 0.25,
      blockRate: 0.20,
      userAgentAcceptance: 0.15
    };
    this.thresholds = options.thresholds || {
      healthyMinimum: 70,
      degradedThreshold: 50,
      excludeThreshold: 40,
      recoveryThreshold: 65
    };
    this.excludedProxies = new Map(); // proxyId -> { excludedAt, reason, autoReenablAfter }
    this.recoveryWindow = options.recoveryWindow || 1800000; // 30 minutes
    this.monitoringWindow = options.monitoringWindow || 600000; // 10 minutes for recovery testing
    this.trendHistorySize = options.trendHistorySize || 20;
  }

  /**
   * Register proxy for reputation tracking
   */
  registerProxyForScoring(proxyId, initialMetrics = {}) {
    const reputation = {
      proxyId,
      registeredAt: Date.now(),
      currentScore: 75, // Start neutral-positive
      previousScores: [75],

      // Performance metrics
      metrics: {
        totalRequests: initialMetrics.totalRequests || 0,
        successfulRequests: initialMetrics.successfulRequests || 0,
        failedRequests: initialMetrics.failedRequests || 0,
        blockedRequests: initialMetrics.blockedRequests || 0,
        captchaRequests: initialMetrics.captchaRequests || 0,
        ratelimitedRequests: initialMetrics.ratelimitedRequests || 0,
        totalLatency: initialMetrics.totalLatency || 0,
        userAgentAccepted: initialMetrics.userAgentAccepted || 0,
        userAgentRejected: initialMetrics.userAgentRejected || 0
      },

      // Scoring components
      components: {
        successScore: 100,
        responseTimeScore: 100,
        blockRateScore: 100,
        userAgentScore: 100
      },

      // Health status
      status: 'healthy',
      statusHistory: ['healthy'],
      lastStatusChange: Date.now(),

      // Trend analysis
      scoreHistory: [75],
      trendDirection: 'stable', // stable, improving, degrading
      lastScoringUpdate: Date.now()
    };

    this.proxyReputations.set(proxyId, reputation);
    return this.formatReputationResponse(reputation);
  }

  /**
   * Update proxy metrics and recalculate reputation
   */
  updateProxyMetrics(proxyId, update = {}) {
    const reputation = this.proxyReputations.get(proxyId);
    if (!reputation) {
      throw new Error(`Proxy not registered for scoring: ${proxyId}`);
    }

    // Update metrics
    const metrics = reputation.metrics;
    if (update.success !== undefined) {
      metrics.totalRequests++;
      if (update.success) {
        metrics.successfulRequests++;
      } else {
        metrics.failedRequests++;
        if (update.blocked) {
          metrics.blockedRequests++;
        }
        if (update.captcha) {
          metrics.captchaRequests++;
        }
        if (update.ratelimited) {
          metrics.ratelimitedRequests++;
        }
      }
    }

    if (update.latency !== undefined) {
      metrics.totalLatency += update.latency;
    }

    if (update.userAgentAccepted !== undefined) {
      if (update.userAgentAccepted) {
        metrics.userAgentAccepted++;
      } else {
        metrics.userAgentRejected++;
      }
    }

    // Recalculate reputation score
    this.calculateReputation(proxyId);

    // Check for status changes
    this.checkStatusChange(proxyId);

    return {
      proxyId,
      newScore: reputation.currentScore,
      status: reputation.status,
      metrics: this.formatMetrics(reputation)
    };
  }

  /**
   * Calculate reputation score
   */
  calculateReputation(proxyId) {
    const reputation = this.proxyReputations.get(proxyId);
    const metrics = reputation.metrics;
    const weights = this.scoringWeights;
    let score = 0;

    // Success rate (40%)
    const successRate = metrics.totalRequests > 0
      ? metrics.successfulRequests / metrics.totalRequests
      : 1;
    reputation.components.successScore = Math.round(successRate * 100);
    score += reputation.components.successScore * weights.successRate;

    // Response time (25%)
    const avgLatency = metrics.totalRequests > 0
      ? metrics.totalLatency / metrics.totalRequests
      : 0;
    // Normalize: 0-50ms = 100%, 50-200ms = 75%, 200-500ms = 50%, >500ms = 25%
    let responseTimeScore;
    if (avgLatency < 50) {
      responseTimeScore = 100;
    } else if (avgLatency < 200) {
      responseTimeScore = Math.round(75 + ((200 - avgLatency) / 300) * 25);
    } else if (avgLatency < 500) {
      responseTimeScore = Math.round(50 + ((500 - avgLatency) / 300) * 25);
    } else {
      responseTimeScore = Math.round(Math.max(25, 75 - (avgLatency / 1000)));
    }
    reputation.components.responseTimeScore = Math.max(0, Math.min(100, responseTimeScore));
    score += reputation.components.responseTimeScore * weights.responseTime;

    // Block rate (20%)
    const blockRate = metrics.totalRequests > 0
      ? (metrics.blockedRequests + metrics.captchaRequests * 0.5) / metrics.totalRequests
      : 0;
    // Higher block rate = lower score
    reputation.components.blockRateScore = Math.round(Math.max(0, 100 - (blockRate * 200)));
    score += reputation.components.blockRateScore * weights.blockRate;

    // User agent acceptance (15%)
    const uaTotalAttempts = metrics.userAgentAccepted + metrics.userAgentRejected;
    const uaAcceptanceRate = uaTotalAttempts > 0
      ? metrics.userAgentAccepted / uaTotalAttempts
      : 1;
    reputation.components.userAgentScore = Math.round(uaAcceptanceRate * 100);
    score += reputation.components.userAgentScore * weights.userAgentAcceptance;

    // Store score history
    reputation.previousScores.push(reputation.currentScore);
    if (reputation.previousScores.length > this.trendHistorySize) {
      reputation.previousScores.shift();
    }

    reputation.currentScore = Math.round(Math.min(100, Math.max(0, score)));
    reputation.scoreHistory.push(reputation.currentScore);
    if (reputation.scoreHistory.length > this.trendHistorySize) {
      reputation.scoreHistory.shift();
    }

    // Analyze trend
    this.analyzeTrend(reputation);

    reputation.lastScoringUpdate = Date.now();
  }

  /**
   * Analyze reputation trend
   */
  analyzeTrend(reputation) {
    if (reputation.scoreHistory.length < 3) {
      reputation.trendDirection = 'stable';
      return;
    }

    const recent = reputation.scoreHistory.slice(-3);
    const trend = recent[2] - recent[0];

    if (trend > 5) {
      reputation.trendDirection = 'improving';
    } else if (trend < -5) {
      reputation.trendDirection = 'degrading';
    } else {
      reputation.trendDirection = 'stable';
    }
  }

  /**
   * Check for status changes
   */
  checkStatusChange(proxyId) {
    const reputation = this.proxyReputations.get(proxyId);
    const oldStatus = reputation.status;
    let newStatus = oldStatus;

    if (reputation.currentScore >= this.thresholds.healthyMinimum) {
      newStatus = 'healthy';
    } else if (reputation.currentScore >= this.thresholds.recoveryThreshold) {
      newStatus = 'degraded';
    } else if (reputation.currentScore >= this.thresholds.excludeThreshold) {
      newStatus = 'poor';
    } else {
      newStatus = 'excluded';
    }

    // If status changed, record it
    if (newStatus !== oldStatus) {
      reputation.status = newStatus;
      reputation.statusHistory.push(newStatus);
      reputation.lastStatusChange = Date.now();

      // Handle exclusion
      if (newStatus === 'excluded') {
        this.excludeProxy(proxyId, `automatic-exclusion-score:${reputation.currentScore}`);
      }

      // Handle recovery
      if (oldStatus === 'excluded' && newStatus !== 'excluded') {
        this.reenableProxy(proxyId);
      }
    }
  }

  /**
   * Exclude proxy from rotation
   */
  excludeProxy(proxyId, reason = 'manual') {
    const reputation = this.proxyReputations.get(proxyId);
    if (!reputation) {
      throw new Error(`Proxy not found: ${proxyId}`);
    }

    const exclusion = {
      proxyId,
      excludedAt: Date.now(),
      reason,
      autoReenablAfter: Date.now() + this.recoveryWindow,
      scoreAtExclusion: reputation.currentScore,
      metricsSnapshot: JSON.parse(JSON.stringify(reputation.metrics))
    };

    this.excludedProxies.set(proxyId, exclusion);
    reputation.status = 'excluded';

    return {
      proxyId,
      excluded: true,
      reason,
      autoReenableAfter: this.recoveryWindow,
      nextCheckAt: exclusion.autoReenablAfter
    };
  }

  /**
   * Attempt to reenable proxy
   */
  reenableProxy(proxyId) {
    const exclusion = this.excludedProxies.get(proxyId);
    if (!exclusion) {
      return { proxyId, reenabled: false, wasNotExcluded: true };
    }

    const reputation = this.proxyReputations.get(proxyId);
    if (!reputation) {
      throw new Error(`Proxy not found: ${proxyId}`);
    }

    // Check if recovery window has passed
    if (Date.now() < exclusion.autoReenablAfter) {
      return {
        proxyId,
        reenabled: false,
        stillExcluded: true,
        timeUntilEnable: exclusion.autoReenablAfter - Date.now()
      };
    }

    // Check if score has recovered
    if (reputation.currentScore < this.thresholds.recoveryThreshold) {
      return {
        proxyId,
        reenabled: false,
        scoreNotRecovered: true,
        currentScore: reputation.currentScore,
        requiredScore: this.thresholds.recoveryThreshold
      };
    }

    // Reenable proxy
    this.excludedProxies.delete(proxyId);
    reputation.status = 'degraded'; // Start as degraded until proven
    reputation.statusHistory.push('reenabled');

    return {
      proxyId,
      reenabled: true,
      newStatus: reputation.status,
      recoveryDuration: Date.now() - exclusion.excludedAt,
      scoreRecovered: reputation.currentScore
    };
  }

  /**
   * Check for proxies needing recovery re-testing
   */
  getRecoveryTestCandidates() {
    const candidates = [];

    for (const [proxyId, exclusion] of this.excludedProxies) {
      const reputation = this.proxyReputations.get(proxyId);

      // Skip if recovery window hasn't passed
      if (Date.now() < exclusion.autoReenablAfter - this.monitoringWindow) {
        continue;
      }

      candidates.push({
        proxyId,
        excludedDuration: Date.now() - exclusion.excludedAt,
        exclusionReason: exclusion.reason,
        currentScore: reputation.currentScore,
        scoreAtExclusion: exclusion.scoreAtExclusion,
        recoveryReadiness: this.assessRecoveryReadiness(reputation, exclusion)
      });
    }

    return candidates;
  }

  /**
   * Assess readiness for recovery
   */
  assessRecoveryReadiness(reputation, exclusion) {
    const scoreDifference = reputation.currentScore - exclusion.scoreAtExclusion;
    const isImproving = reputation.trendDirection === 'improving';

    let readiness = 'poor';
    if (isImproving && scoreDifference > 0) {
      readiness = 'good';
    } else if (isImproving) {
      readiness = 'fair';
    }

    return readiness;
  }

  /**
   * Get pool-wide reputation statistics
   */
  getPoolStatistics() {
    const allProxies = Array.from(this.proxyReputations.values());
    if (allProxies.length === 0) {
      return null;
    }

    const scores = allProxies.map(p => p.currentScore);
    const statusCounts = {
      healthy: 0,
      degraded: 0,
      poor: 0,
      excluded: 0
    };

    allProxies.forEach(p => {
      statusCounts[p.status]++;
    });

    return {
      totalProxies: allProxies.length,
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      statusDistribution: statusCounts,
      healthPercentage: Math.round((statusCounts.healthy / allProxies.length) * 100),
      excludedPercentage: Math.round((statusCounts.excluded / allProxies.length) * 100),
      improvingTrend: allProxies.filter(p => p.trendDirection === 'improving').length,
      degradingTrend: allProxies.filter(p => p.trendDirection === 'degrading').length
    };
  }

  /**
   * Get detailed reputation report for proxy
   */
  getProxyReport(proxyId) {
    const reputation = this.proxyReputations.get(proxyId);
    if (!reputation) {
      throw new Error(`Proxy not found: ${proxyId}`);
    }

    const exclusion = this.excludedProxies.get(proxyId);

    return {
      proxyId,
      currentScore: reputation.currentScore,
      status: reputation.status,
      trend: reputation.trendDirection,
      registeredAt: reputation.registeredAt,
      lastUpdated: reputation.lastScoringUpdate,

      scoreBreakdown: reputation.components,
      metrics: this.formatMetrics(reputation),
      scoreHistory: reputation.scoreHistory,

      exclusionStatus: exclusion ? {
        excluded: true,
        excludedAt: exclusion.excludedAt,
        reason: exclusion.reason,
        autoReenableAt: exclusion.autoReenablAfter,
        timeUntilRetest: Math.max(0, exclusion.autoReenablAfter - Date.now())
      } : {
        excluded: false
      }
    };
  }

  /**
   * Batch update metrics for multiple proxies
   */
  batchUpdateMetrics(updates = []) {
    const results = [];

    for (const update of updates) {
      try {
        const result = this.updateProxyMetrics(update.proxyId, update.metrics);
        results.push({ ...result, success: true });
      } catch (error) {
        results.push({
          proxyId: update.proxyId,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  // Helper methods

  formatMetrics(reputation) {
    const metrics = reputation.metrics;
    return {
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      failureRate: metrics.totalRequests > 0
        ? Math.round((metrics.failedRequests / metrics.totalRequests) * 100)
        : 0,
      blockRate: metrics.totalRequests > 0
        ? Math.round((metrics.blockedRequests / metrics.totalRequests) * 100)
        : 0,
      captchaRate: metrics.totalRequests > 0
        ? Math.round((metrics.captchaRequests / metrics.totalRequests) * 100)
        : 0,
      ratelimitRate: metrics.totalRequests > 0
        ? Math.round((metrics.ratelimitedRequests / metrics.totalRequests) * 100)
        : 0,
      averageLatency: metrics.totalRequests > 0
        ? Math.round(metrics.totalLatency / metrics.totalRequests)
        : 0,
      userAgentAcceptanceRate: metrics.userAgentAccepted + metrics.userAgentRejected > 0
        ? Math.round((metrics.userAgentAccepted / (metrics.userAgentAccepted + metrics.userAgentRejected)) * 100)
        : 100
    };
  }

  formatReputationResponse(reputation) {
    return {
      proxyId: reputation.proxyId,
      score: reputation.currentScore,
      status: reputation.status,
      trend: reputation.trendDirection,
      registered: true
    };
  }
}

module.exports = ReputationScorer;
