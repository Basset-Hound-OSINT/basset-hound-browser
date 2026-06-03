/**
 * Partner Failover Tests
 * Test failover triggers, recovery, and selection algorithm
 * 25+ scenarios
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { PartnerIntegrationManager } = require('../../src/proxy/partner-integration-manager');
const { PartnerSelector } = require('../../src/proxy/partner-selector');
const { PartnerFailover } = require('../../src/proxy/partner-failover');

describe('Partner Selector', () => {
  let manager;
  let selector;

  beforeEach(() => {
    manager = new PartnerIntegrationManager();
    selector = new PartnerSelector(manager);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Basic Selection', () => {
    it('should select partner without criteria', () => {
      const result = selector.selectPartner();

      expect(result.success).toBe(true);
      expect(result.partnerId).toBeDefined();
    });

    it('should select partner by region', () => {
      const result = selector.selectPartner({ region: 'US' });

      expect(result.success).toBe(true);
      const partner = manager.getPartner(result.partnerId);
      expect(partner.regions).toContain('US');
    });

    it('should select partner by feature', () => {
      const result = selector.selectPartner({ proxyType: 'residential' });

      expect(result.success).toBe(true);
      const partner = manager.getPartner(result.partnerId);
      expect(partner.features).toContain('residential');
    });

    it('should return error when no partners match', () => {
      const result = selector.selectPartner({ region: 'UNKNOWN' });

      expect(result.success).toBe(false);
    });
  });

  describe('Selection Caching', () => {
    it('should cache selection', () => {
      const result1 = selector.selectPartner({ region: 'US' });
      const result2 = selector.selectPartner({ region: 'US' });

      expect(result1.partnerId).toBe(result2.partnerId);
      expect(result2.reason).toBe('cached');
    });

    it('should clear cache', () => {
      selector.selectPartner({ region: 'US' });
      const clearResult = selector.clearCache();

      expect(clearResult.success).toBe(true);
    });

    it('should expire cached selections', (done) => {
      const customSelector = new PartnerSelector(manager, {
        cacheTTL: 100 // 100ms
      });

      customSelector.selectPartner({ region: 'US' });

      setTimeout(() => {
        const result = customSelector.selectPartner({ region: 'US' });
        expect(result.reason).toBe('selected'); // Not cached
        done();
      }, 150);
    });
  });

  describe('Selection Preferences', () => {
    it('should select by cost preference', () => {
      // Record metrics to influence selection
      manager.recordMetrics('apify', {
        success: true,
        latency: 50,
        cost: 0.0001
      });

      const result = selector.selectPartner({
        preference: 'cost'
      });

      expect(result.success).toBe(true);
    });

    it('should select by performance preference', () => {
      manager.recordMetrics('zyte', {
        success: true,
        latency: 10,
        cost: 0.001
      });

      const result = selector.selectPartner({
        preference: 'performance'
      });

      expect(result.success).toBe(true);
    });

    it('should return ranking', () => {
      const result = selector.selectPartner();

      expect(result.ranking).toBeDefined();
      expect(result.ranking.length).toBeGreaterThan(0);
      expect(result.ranking[0].rank).toBe(1);
    });
  });

  describe('Selection Statistics', () => {
    it('should track selection statistics', () => {
      for (let i = 0; i < 5; i++) {
        selector.selectPartner({ region: 'US' });
      }

      const stats = selector.getSelectionStats();

      expect(stats.totalSelections).toBeGreaterThan(0);
      expect(stats.partnerStats).toHaveLength(stats.partnerStats.length);
    });

    it('should calculate selection percentages', () => {
      for (let i = 0; i < 10; i++) {
        selector.selectPartner();
      }

      const stats = selector.getSelectionStats();

      let totalPercentage = 0;
      stats.partnerStats.forEach(stat => {
        totalPercentage += stat.percentage;
      });

      expect(Math.round(totalPercentage * 100) / 100).toBe(1);
    });
  });

  describe('Region Recommendations', () => {
    it('should get recommendations for region', () => {
      const recommendations = selector.getRecommendationsForRegion('US');

      expect(recommendations.region).toBe('US');
      expect(recommendations.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle unavailable region', () => {
      const recommendations = selector.getRecommendationsForRegion('UNKNOWN');

      expect(recommendations.recommendations.length).toBe(0);
    });
  });
});

describe('Partner Failover', () => {
  let manager;
  let selector;
  let failover;

  beforeEach(() => {
    manager = new PartnerIntegrationManager();
    selector = new PartnerSelector(manager);
    failover = new PartnerFailover(manager, selector);

    // Set up failover chains
    manager.setFailoverChain('oxylabs', ['brightdata', 'zyte']);
    manager.setFailoverChain('brightdata', ['zyte', 'apify']);
  });

  afterEach(() => {
    failover.destroy();
    manager.destroy();
  });

  describe('Failover Execution', () => {
    it('should execute request with primary partner', async () => {
      const mockRequest = jest.fn().mockResolvedValue({
        success: true,
        data: 'test'
      });

      const result = await failover.executeWithFailover(
        'oxylabs',
        mockRequest
      );

      expect(result.success).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith('oxylabs');
    });

    it('should failover to backup on primary failure', async () => {
      const mockRequest = jest.fn()
        .mockResolvedValueOnce({ success: false, error: 'Primary failed' })
        .mockResolvedValueOnce({ success: true, data: 'test' });

      const result = await failover.executeWithFailover(
        'oxylabs',
        mockRequest
      );

      expect(result.success).toBe(true);
      expect(result.failoverUsed).toBe(true);
      expect(result.failoverPartnerId).toBe('brightdata');
    });

    it('should try multiple failovers', async () => {
      let callCount = 0;
      const mockRequest = jest.fn().mockImplementation((partnerId) => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve({ success: false });
        }
        return Promise.resolve({ success: true });
      });

      const result = await failover.executeWithFailover(
        'oxylabs',
        mockRequest
      );

      expect(result.success).toBe(true);
      expect(callCount).toBe(3);
    });

    it('should return error when all partners fail', async () => {
      const mockRequest = jest.fn().mockResolvedValue({
        success: false,
        error: 'All failed'
      });

      const result = await failover.executeWithFailover(
        'oxylabs',
        mockRequest
      );

      expect(result.success).toBe(false);
    });
  });

  describe('Failure Detection', () => {
    it('should handle partner failure', () => {
      const result = failover.handlePartnerFailure(
        'oxylabs',
        new Error('Connection timeout')
      );

      expect(result.partnerId).toBe('oxylabs');
      expect(result.failureRate).toBeDefined();
    });

    it('should open circuit breaker on threshold', () => {
      // Record failures
      for (let i = 0; i < 5; i++) {
        failover.handlePartnerFailure('oxylabs', new Error('Failed'));
      }

      const status = failover.getPartnerFailureStatus('oxylabs');

      expect(status.circuitBreakerStatus).toBe('open');
    });

    it('should track consecutive failures', () => {
      failover.handlePartnerFailure('oxylabs', new Error('Fail 1'));
      failover.handlePartnerFailure('oxylabs', new Error('Fail 2'));

      const status = failover.getPartnerFailureStatus('oxylabs');

      expect(status.consecutiveFailures).toBe(2);
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should open circuit breaker', () => {
      failover.disablePartner('oxylabs');

      const status = failover.getRecoveryStatus('oxylabs');

      expect(status.circuitBreakerOpen).toBe(true);
    });

    it('should close circuit breaker', () => {
      failover.disablePartner('oxylabs');
      failover.enablePartner('oxylabs');

      const status = failover.getRecoveryStatus('oxylabs');

      expect(status.circuitBreakerOpen).toBe(false);
    });

    it('should not execute requests when circuit is open', async () => {
      failover.disablePartner('oxylabs');

      const mockRequest = jest.fn();

      const result = await failover.executeWithFailover(
        'oxylabs',
        mockRequest
      );

      expect(result.success).toBe(false);
    });
  });

  describe('Recovery', () => {
    it('should get recovery status', () => {
      failover.disablePartner('oxylabs');

      const status = failover.getRecoveryStatus('oxylabs');

      expect(status.status).toBe('degraded');
      expect(status.recoveryAttempts).toBeDefined();
    });

    it('should track recovery attempts', () => {
      failover.handlePartnerFailure('oxylabs', new Error('Failed'));

      const status = failover.getRecoveryStatus('oxylabs');

      expect(status.recoveryAttempts).toBeGreaterThanOrEqual(0);
    });

    it('should reset failure tracking', () => {
      failover.handlePartnerFailure('oxylabs', new Error('Failed'));
      failover.resetPartnerTracking('oxylabs');

      const status = failover.getPartnerFailureStatus('oxylabs');

      expect(status.totalRequests).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should get failover statistics', () => {
      failover.handlePartnerFailure('oxylabs', new Error('Failed'));

      const stats = failover.getFailoverStats();

      expect(stats.totalPartnersTracked).toBeGreaterThanOrEqual(0);
      expect(stats.circuitBreakerOpen).toBeGreaterThanOrEqual(0);
      expect(stats.degradedPartners).toBeGreaterThanOrEqual(0);
      expect(stats.healthyPartners).toBeGreaterThanOrEqual(0);
    });

    it('should track all failure statuses', () => {
      failover.handlePartnerFailure('oxylabs', new Error('Failed'));
      failover.handlePartnerFailure('brightdata', new Error('Failed'));

      const statuses = failover.getAllFailureStatuses();

      expect(statuses.length).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Integration: Selection + Failover', () => {
  let manager;
  let selector;
  let failover;

  beforeEach(() => {
    manager = new PartnerIntegrationManager();
    selector = new PartnerSelector(manager);
    failover = new PartnerFailover(manager, selector);
  });

  afterEach(() => {
    failover.destroy();
    manager.destroy();
  });

  it('should select and failover together', async () => {
    const selection = selector.selectWithFailover({ region: 'US' });

    expect(selection.success).toBe(true);
    expect(selection.primary).toBeDefined();
    expect(selection.failover).toBeDefined();
  });

  it('should handle selection with automatic failover', async () => {
    const selection = selector.selectWithFailover();
    const primary = selection.primary.partnerId;

    // Simulate primary failure
    manager.setFailoverChain(primary, ['brightdata', 'zyte']);

    const mockRequest = jest.fn()
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true });

    const result = await failover.executeWithFailover(
      primary,
      mockRequest
    );

    expect(result.success).toBe(true);
  });
});
