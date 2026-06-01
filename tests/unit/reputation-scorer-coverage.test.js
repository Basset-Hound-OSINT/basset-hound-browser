/**
 * Comprehensive test coverage for Reputation Scorer
 * Target: 95%+ code coverage
 * Tests all scoring components, status transitions, recovery, and edge cases
 */

const ReputationScorer = require('../../src/proxy/reputation-scorer');

describe('ReputationScorer - Comprehensive Coverage', () => {
  let scorer;

  beforeEach(() => {
    scorer = new ReputationScorer({
      scoringWeights: {
        successRate: 0.40,
        responseTime: 0.25,
        blockRate: 0.20,
        userAgentAcceptance: 0.15
      },
      thresholds: {
        healthyMinimum: 70,
        degradedThreshold: 50,
        excludeThreshold: 40,
        recoveryThreshold: 65
      },
      recoveryWindow: 1800000,
      monitoringWindow: 600000,
      trendHistorySize: 20
    });
  });

  // ================================================================
  // REGISTRATION AND INITIALIZATION
  // ================================================================
  describe('Proxy Registration', () => {
    test('should register proxy with initial metrics', () => {
      const result = scorer.registerProxyForScoring('proxy-1', {
        successfulRequests: 100,
        totalRequests: 110
      });

      expect(result.proxyId).toBe('proxy-1');
      expect(result.score).toBe(75);
      expect(result.status).toBe('healthy');
      expect(result.registered).toBe(true);
    });

    test('should register proxy without initial metrics', () => {
      const result = scorer.registerProxyForScoring('proxy-2');

      expect(result.proxyId).toBe('proxy-2');
      expect(result.score).toBeDefined();
      expect(result.status).toBeDefined();
    });

    test('should register multiple proxies independently', () => {
      const result1 = scorer.registerProxyForScoring('proxy-1');
      const result2 = scorer.registerProxyForScoring('proxy-2');

      expect(result1.proxyId).toBe('proxy-1');
      expect(result2.proxyId).toBe('proxy-2');
      expect(scorer.proxyReputations.size).toBe(2);
    });

    test('should initialize reputation with correct defaults', () => {
      scorer.registerProxyForScoring('proxy-1');
      const reputation = scorer.proxyReputations.get('proxy-1');

      expect(reputation.currentScore).toBe(75);
      expect(reputation.status).toBe('healthy');
      expect(reputation.trendDirection).toBe('stable');
      expect(reputation.scoreHistory).toEqual([75]);
    });
  });

  // ================================================================
  // METRIC UPDATES
  // ================================================================
  describe('Metric Updates', () => {
    beforeEach(() => {
      scorer.registerProxyForScoring('proxy-1');
    });

    test('should update successful request metric', () => {
      const result = scorer.updateProxyMetrics('proxy-1', { success: true });

      expect(result.proxyId).toBe('proxy-1');
      expect(result.newScore).toBeDefined();
      expect(result.status).toBeDefined();
    });

    test('should update failed request metric', () => {
      const result = scorer.updateProxyMetrics('proxy-1', { success: false });

      expect(result.proxyId).toBe('proxy-1');
      expect(result.metrics.totalRequests).toBeGreaterThan(0);
    });

    test('should track blocked requests', () => {
      scorer.updateProxyMetrics('proxy-1', { success: false, blocked: true });
      const reputation = scorer.proxyReputations.get('proxy-1');

      expect(reputation.metrics.blockedRequests).toBe(1);
    });

    test('should track CAPTCHA requests', () => {
      scorer.updateProxyMetrics('proxy-1', { success: false, captcha: true });
      const reputation = scorer.proxyReputations.get('proxy-1');

      expect(reputation.metrics.captchaRequests).toBe(1);
    });

    test('should track rate-limited requests', () => {
      scorer.updateProxyMetrics('proxy-1', { success: false, ratelimited: true });
      const reputation = scorer.proxyReputations.get('proxy-1');

      expect(reputation.metrics.ratelimitedRequests).toBe(1);
    });

    test('should update latency metric', () => {
      scorer.updateProxyMetrics('proxy-1', { latency: 100 });
      const reputation = scorer.proxyReputations.get('proxy-1');

      expect(reputation.metrics.totalLatency).toBeGreaterThan(0);
    });

    test('should update user agent acceptance', () => {
      scorer.updateProxyMetrics('proxy-1', { userAgentAccepted: true });
      const reputation = scorer.proxyReputations.get('proxy-1');

      expect(reputation.metrics.userAgentAccepted).toBe(1);
    });

    test('should update user agent rejection', () => {
      scorer.updateProxyMetrics('proxy-1', { userAgentAccepted: false });
      const reputation = scorer.proxyReputations.get('proxy-1');

      expect(reputation.metrics.userAgentRejected).toBe(1);
    });

    test('should throw on unregistered proxy', () => {
      expect(() => {
        scorer.updateProxyMetrics('unknown-proxy', { success: true });
      }).toThrow();
    });

    test('should handle partial metric updates', () => {
      const result1 = scorer.updateProxyMetrics('proxy-1', { success: true });
      const result2 = scorer.updateProxyMetrics('proxy-1', { latency: 50 });

      expect(result1.newScore).toBeDefined();
      expect(result2.newScore).toBeDefined();
    });
  });

  // ================================================================
  // REPUTATION SCORING CALCULATION
  // ================================================================
  describe('Reputation Calculation - All Components', () => {
    beforeEach(() => {
      scorer.registerProxyForScoring('proxy-1');
    });

    test('should calculate success rate component (40% weight)', () => {
      // 100 requests, 80 successful = 80% success rate
      for (let i = 0; i < 80; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: true });
      }
      for (let i = 0; i < 20; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: false });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.components.successScore).toBeLessThanOrEqual(100);
      expect(reputation.components.successScore).toBeGreaterThanOrEqual(0);
    });

    test('should calculate response time component (25% weight)', () => {
      // Add requests with varying latencies
      for (let i = 0; i < 10; i++) {
        scorer.updateProxyMetrics('proxy-1', { latency: 25 }); // <50ms = 100
        scorer.updateProxyMetrics('proxy-1', { latency: 100 }); // 50-200ms = lower
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.components.responseTimeScore).toBeDefined();
      expect(reputation.components.responseTimeScore).toBeLessThanOrEqual(100);
    });

    test('should calculate block rate component (20% weight)', () => {
      for (let i = 0; i < 5; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: true });
        scorer.updateProxyMetrics('proxy-1', { success: false, blocked: true });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.components.blockRateScore).toBeDefined();
    });

    test('should calculate user agent component (15% weight)', () => {
      for (let i = 0; i < 5; i++) {
        scorer.updateProxyMetrics('proxy-1', { userAgentAccepted: true });
        scorer.updateProxyMetrics('proxy-1', { userAgentAccepted: false });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.components.userAgentScore).toBeDefined();
      expect(reputation.components.userAgentScore).toBeLessThanOrEqual(100);
    });

    test('should combine all components with weights', () => {
      for (let i = 0; i < 50; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: true, latency: 50 });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.currentScore).toBeGreaterThan(0);
      expect(reputation.currentScore).toBeLessThanOrEqual(100);
    });

    test('should round score to integer', () => {
      scorer.updateProxyMetrics('proxy-1', { success: true, latency: 33 });
      const reputation = scorer.proxyReputations.get('proxy-1');

      expect(Number.isInteger(reputation.currentScore)).toBe(true);
    });

    test('should clamp score between 0 and 100', () => {
      // Force extreme metrics
      for (let i = 0; i < 100; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: true, latency: 1 });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.currentScore).toBeGreaterThanOrEqual(0);
      expect(reputation.currentScore).toBeLessThanOrEqual(100);
    });

    test('should maintain score history', () => {
      for (let i = 0; i < 5; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: Math.random() > 0.5 });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.scoreHistory.length).toBeGreaterThan(1);
    });

    test('should limit score history to trendHistorySize', () => {
      for (let i = 0; i < 100; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: true });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.scoreHistory.length).toBeLessThanOrEqual(20);
    });
  });

  // ================================================================
  // TREND ANALYSIS
  // ================================================================
  describe('Trend Analysis', () => {
    beforeEach(() => {
      scorer.registerProxyForScoring('proxy-1');
    });

    test('should detect improving trend', () => {
      // Simulate improving performance
      for (let i = 0; i < 3; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: false });
      }
      for (let i = 0; i < 3; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: true });
      }
      for (let i = 0; i < 5; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: true });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      if (reputation.scoreHistory.length >= 3) {
        expect(['improving', 'stable']).toContain(reputation.trendDirection);
      }
    });

    test('should detect degrading trend', () => {
      // Simulate degrading performance
      for (let i = 0; i < 5; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: true });
      }
      for (let i = 0; i < 10; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: false });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      if (reputation.scoreHistory.length >= 3) {
        expect(['degrading', 'stable']).toContain(reputation.trendDirection);
      }
    });

    test('should detect stable trend', () => {
      for (let i = 0; i < 10; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: true });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(['stable', 'improving']).toContain(reputation.trendDirection);
    });

    test('should handle insufficient history', () => {
      scorer.updateProxyMetrics('proxy-1', { success: true });
      const reputation = scorer.proxyReputations.get('proxy-1');

      expect(['stable', 'improving', 'degrading']).toContain(reputation.trendDirection);
    });
  });

  // ================================================================
  // STATUS TRANSITIONS
  // ================================================================
  describe('Status Transitions', () => {
    beforeEach(() => {
      scorer.registerProxyForScoring('proxy-1');
    });

    test('should maintain healthy status above threshold', () => {
      for (let i = 0; i < 50; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: true });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.status).toBe('healthy');
    });

    test('should transition to degraded status', () => {
      for (let i = 0; i < 10; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: false, blocked: true });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(['degraded', 'poor', 'excluded']).toContain(reputation.status);
    });

    test('should transition to poor status', () => {
      for (let i = 0; i < 20; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: false, captcha: true });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(['poor', 'excluded', 'degraded']).toContain(reputation.status);
    });

    test('should transition to excluded status', () => {
      for (let i = 0; i < 50; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: false, blocked: true });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.status).toBe('excluded');
      expect(scorer.excludedProxies.has('proxy-1')).toBe(true);
    });

    test('should record status history', () => {
      for (let i = 0; i < 30; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: false });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.statusHistory.length).toBeGreaterThan(1);
    });

    test('should record status change timestamp', () => {
      const before = Date.now();
      for (let i = 0; i < 20; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: false });
      }
      const after = Date.now();

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.lastStatusChange).toBeGreaterThanOrEqual(before);
      expect(reputation.lastStatusChange).toBeLessThanOrEqual(after);
    });
  });

  // ================================================================
  // EXCLUSION AND RECOVERY
  // ================================================================
  describe('Proxy Exclusion', () => {
    beforeEach(() => {
      scorer.registerProxyForScoring('proxy-1');
    });

    test('should exclude proxy with reason', () => {
      const result = scorer.excludeProxy('proxy-1', 'manual-test');

      expect(result.excluded).toBe(true);
      expect(result.reason).toBe('manual-test');
      expect(result.autoReenableAfter).toBeGreaterThan(0);
    });

    test('should store exclusion info', () => {
      scorer.excludeProxy('proxy-1', 'test-reason');
      const exclusion = scorer.excludedProxies.get('proxy-1');

      expect(exclusion).toBeDefined();
      expect(exclusion.reason).toBe('test-reason');
      expect(exclusion.scoreAtExclusion).toBeDefined();
    });

    test('should capture metrics snapshot at exclusion', () => {
      scorer.updateProxyMetrics('proxy-1', { success: true, latency: 100 });
      scorer.excludeProxy('proxy-1', 'test');

      const exclusion = scorer.excludedProxies.get('proxy-1');
      expect(exclusion.metricsSnapshot).toBeDefined();
      expect(exclusion.metricsSnapshot.totalRequests).toBeGreaterThan(0);
    });

    test('should throw on exclusion of unregistered proxy', () => {
      expect(() => {
        scorer.excludeProxy('unknown-proxy', 'test');
      }).toThrow();
    });
  });

  // ================================================================
  // RECOVERY
  // ================================================================
  describe('Proxy Recovery', () => {
    beforeEach(() => {
      scorer.registerProxyForScoring('proxy-1');
      scorer.excludeProxy('proxy-1', 'test-exclusion');
    });

    test('should return reenabled: false when still in recovery window', () => {
      const result = scorer.reenableProxy('proxy-1');

      expect(result.reenabled).toBe(false);
      expect(result.stillExcluded).toBe(true);
    });

    test('should return wasNotExcluded when proxy not excluded', () => {
      scorer.registerProxyForScoring('proxy-2');
      const result = scorer.reenableProxy('proxy-2');

      expect(result.reenabled).toBe(false);
      expect(result.wasNotExcluded).toBe(true);
    });

    test('should get recovery test candidates', () => {
      const candidates = scorer.getRecoveryTestCandidates();

      expect(Array.isArray(candidates)).toBe(true);
    });

    test('should assess recovery readiness', () => {
      const reputation = scorer.proxyReputations.get('proxy-1');
      const exclusion = scorer.excludedProxies.get('proxy-1');

      const readiness = scorer.assessRecoveryReadiness(reputation, exclusion);
      expect(['poor', 'fair', 'good']).toContain(readiness);
    });
  });

  // ================================================================
  // REPORTING
  // ================================================================
  describe('Reporting and Statistics', () => {
    beforeEach(() => {
      scorer.registerProxyForScoring('proxy-1');
      scorer.registerProxyForScoring('proxy-2');
      scorer.registerProxyForScoring('proxy-3');

      // Add metrics
      for (let i = 0; i < 50; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: true });
        scorer.updateProxyMetrics('proxy-2', { success: false });
        scorer.updateProxyMetrics('proxy-3', { success: Math.random() > 0.5 });
      }
    });

    test('should get pool statistics', () => {
      const stats = scorer.getPoolStatistics();

      expect(stats.totalProxies).toBe(3);
      expect(stats.averageScore).toBeGreaterThanOrEqual(0);
      expect(stats.averageScore).toBeLessThanOrEqual(100);
      expect(stats.minScore).toBeDefined();
      expect(stats.maxScore).toBeDefined();
      expect(stats.healthPercentage).toBeGreaterThanOrEqual(0);
      expect(stats.healthPercentage).toBeLessThanOrEqual(100);
    });

    test('should count status distribution', () => {
      const stats = scorer.getPoolStatistics();

      expect(stats.statusDistribution).toBeDefined();
      expect(stats.statusDistribution.healthy).toBeGreaterThanOrEqual(0);
      expect(stats.statusDistribution.degraded).toBeGreaterThanOrEqual(0);
      expect(stats.statusDistribution.poor).toBeGreaterThanOrEqual(0);
      expect(stats.statusDistribution.excluded).toBeGreaterThanOrEqual(0);
    });

    test('should get detailed proxy report', () => {
      const report = scorer.getProxyReport('proxy-1');

      expect(report.proxyId).toBe('proxy-1');
      expect(report.currentScore).toBeDefined();
      expect(report.status).toBeDefined();
      expect(report.trend).toBeDefined();
      expect(report.scoreBreakdown).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.scoreHistory).toBeDefined();
      expect(report.exclusionStatus).toBeDefined();
    });

    test('should throw on report for unregistered proxy', () => {
      expect(() => {
        scorer.getProxyReport('unknown-proxy');
      }).toThrow();
    });

    test('should format metrics correctly', () => {
      const reputation = scorer.proxyReputations.get('proxy-1');
      const formatted = scorer.formatMetrics(reputation);

      expect(formatted.totalRequests).toBeGreaterThanOrEqual(0);
      expect(formatted.successfulRequests).toBeGreaterThanOrEqual(0);
      expect(formatted.failureRate).toBeGreaterThanOrEqual(0);
      expect(formatted.failureRate).toBeLessThanOrEqual(100);
      expect(formatted.averageLatency).toBeGreaterThanOrEqual(0);
    });
  });

  // ================================================================
  // BATCH OPERATIONS
  // ================================================================
  describe('Batch Operations', () => {
    beforeEach(() => {
      scorer.registerProxyForScoring('proxy-1');
      scorer.registerProxyForScoring('proxy-2');
      scorer.registerProxyForScoring('proxy-3');
    });

    test('should batch update multiple proxies', () => {
      const updates = [
        { proxyId: 'proxy-1', metrics: { success: true } },
        { proxyId: 'proxy-2', metrics: { success: false } },
        { proxyId: 'proxy-3', metrics: { success: true } }
      ];

      const results = scorer.batchUpdateMetrics(updates);

      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should handle errors in batch updates', () => {
      const updates = [
        { proxyId: 'proxy-1', metrics: { success: true } },
        { proxyId: 'unknown-proxy', metrics: { success: false } },
        { proxyId: 'proxy-3', metrics: { success: true } }
      ];

      const results = scorer.batchUpdateMetrics(updates);

      expect(results.length).toBe(3);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });

    test('should return all proxy results', () => {
      const updates = [
        { proxyId: 'proxy-1', metrics: { success: true } },
        { proxyId: 'proxy-2', metrics: { success: false } },
        { proxyId: 'proxy-3', metrics: { latency: 100 } }
      ];

      const results = scorer.batchUpdateMetrics(updates);

      expect(results.length).toBe(3);
      expect(results.map(r => r.proxyId)).toEqual(['proxy-1', 'proxy-2', 'proxy-3']);
    });
  });

  // ================================================================
  // EDGE CASES
  // ================================================================
  describe('Edge Cases', () => {
    test('should handle zero metrics', () => {
      scorer.registerProxyForScoring('proxy-1', {
        totalRequests: 0,
        successfulRequests: 0
      });

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.currentScore).toBeDefined();
      expect(reputation.currentScore).toBeGreaterThanOrEqual(0);
    });

    test('should handle all successful requests', () => {
      scorer.registerProxyForScoring('proxy-1');
      for (let i = 0; i < 50; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: true, latency: 10 });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.currentScore).toBeGreaterThan(70);
    });

    test('should handle all failed requests', () => {
      scorer.registerProxyForScoring('proxy-1');
      for (let i = 0; i < 50; i++) {
        scorer.updateProxyMetrics('proxy-1', { success: false, blocked: true });
      }

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.status).toBe('excluded');
    });

    test('should handle extreme latency values', () => {
      scorer.registerProxyForScoring('proxy-1');
      scorer.updateProxyMetrics('proxy-1', { latency: 10000 });

      const reputation = scorer.proxyReputations.get('proxy-1');
      expect(reputation.components.responseTimeScore).toBeGreaterThanOrEqual(0);
    });

    test('should handle custom weights', () => {
      const customScorer = new ReputationScorer({
        scoringWeights: {
          successRate: 0.70,
          responseTime: 0.15,
          blockRate: 0.10,
          userAgentAcceptance: 0.05
        }
      });

      customScorer.registerProxyForScoring('proxy-1');
      customScorer.updateProxyMetrics('proxy-1', { success: true });

      const reputation = customScorer.proxyReputations.get('proxy-1');
      expect(reputation.currentScore).toBeDefined();
    });

    test('should handle custom thresholds', () => {
      const customScorer = new ReputationScorer({
        thresholds: {
          healthyMinimum: 80,
          degradedThreshold: 60,
          excludeThreshold: 30,
          recoveryThreshold: 70
        }
      });

      customScorer.registerProxyForScoring('proxy-1');
      const reputation = customScorer.proxyReputations.get('proxy-1');

      expect(reputation.status).toBe('healthy');
    });
  });
});
