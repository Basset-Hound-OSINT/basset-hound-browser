/**
 * Partner Performance Tests
 * Measure selection algorithm speed and failover latency
 * 12+ performance scenarios
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { PartnerIntegrationManager } = require('../../src/proxy/partner-integration-manager');
const { PartnerSelector } = require('../../src/proxy/partner-selector');
const { PartnerFailover } = require('../../src/proxy/partner-failover');

describe('Partner Selection Performance', () => {
  let manager;
  let selector;

  beforeEach(() => {
    manager = new PartnerIntegrationManager();
    selector = new PartnerSelector(manager);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Selection Speed', () => {
    it('should select partner in < 10ms', () => {
      const startTime = Date.now();

      selector.selectPartner();

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10);
    });

    it('should handle cached selection in < 5ms', () => {
      selector.selectPartner({ region: 'US' });

      const startTime = Date.now();
      selector.selectPartner({ region: 'US' });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5);
    });

    it('should select from 10 partners in < 15ms', () => {
      // Register additional partners
      for (let i = 0; i < 5; i++) {
        manager.registerPartner({
          id: `custom-${i}`,
          name: `Custom ${i}`,
          apiEndpoint: 'https://api.custom.com',
          features: ['residential'],
          regions: ['US', 'EU'],
          concurrentLimit: 100,
          costPerRequest: 0.001,
          enabled: true,
          priority: 3
        });
      }

      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        selector.selectPartner();
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(150); // 10 selections
    });
  });

  describe('Scoring Algorithm Performance', () => {
    it('should score partner based on 5 criteria', () => {
      const startTime = Date.now();

      // Record diverse metrics
      const partners = manager.listPartners();
      partners.forEach((partner, idx) => {
        manager.recordMetrics(partner.id, {
          success: idx % 2 === 0,
          latency: 50 + Math.random() * 100,
          cost: 0.0001 * (idx + 1)
        });
      });

      selector.selectPartner();

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(20);
    });

    it('should generate rankings efficiently', () => {
      const partners = manager.listPartners();

      const startTime = Date.now();

      const result = selector.selectPartner();

      const duration = Date.now() - startTime;

      expect(result.ranking).toBeDefined();
      expect(result.ranking.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(15);
    });
  });

  describe('Cache Efficiency', () => {
    it('should improve performance with cache hits', () => {
      const uncachedTimes = [];
      const cachedTimes = [];

      // Measure uncached
      selector.clearCache();
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        selector.selectPartner({ region: 'US' });
        uncachedTimes.push(Date.now() - start);
      }

      selector.clearCache();

      // Measure cached
      selector.selectPartner({ region: 'US' });
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        selector.selectPartner({ region: 'US' });
        cachedTimes.push(Date.now() - start);
      }

      const avgUncached = uncachedTimes.reduce((a, b) => a + b, 0) / uncachedTimes.length;
      const avgCached = cachedTimes.reduce((a, b) => a + b, 0) / cachedTimes.length;

      expect(avgCached).toBeLessThan(avgUncached);
    });

    it('should maintain cache up to TTL', (done) => {
      const customSelector = new PartnerSelector(manager, {
        cacheTTL: 200
      });

      customSelector.selectPartner({ region: 'US' });

      setTimeout(() => {
        const result = customSelector.selectPartner({ region: 'US' });
        expect(result.reason).toBe('cached');

        setTimeout(() => {
          const expiredResult = customSelector.selectPartner({ region: 'US' });
          expect(expiredResult.reason).toBe('selected');
          done();
        }, 150);
      }, 50);
    });
  });

  describe('Region Filtering Performance', () => {
    it('should filter by region in < 10ms', () => {
      const startTime = Date.now();

      selector.selectPartner({ region: 'US' });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10);
    });

    it('should handle multiple region selections efficiently', () => {
      const regions = ['US', 'EU', 'APAC', 'LATAM'];

      const startTime = Date.now();

      for (const region of regions) {
        selector.selectPartner({ region });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
    });
  });
});

describe('Failover Performance', () => {
  let manager;
  let selector;
  let failover;

  beforeEach(() => {
    manager = new PartnerIntegrationManager();
    selector = new PartnerSelector(manager);
    failover = new PartnerFailover(manager, selector);

    manager.setFailoverChain('oxylabs', ['brightdata', 'zyte', 'apify']);
  });

  afterEach(() => {
    failover.destroy();
    manager.destroy();
  });

  describe('Failover Latency', () => {
    it('should failover in < 50ms', async () => {
      const mockRequest = jest.fn()
        .mockResolvedValueOnce({ success: false })
        .mockResolvedValueOnce({ success: true });

      const startTime = Date.now();

      await failover.executeWithFailover('oxylabs', mockRequest);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
    });

    it('should try multiple failovers efficiently', async () => {
      let callCount = 0;
      const mockRequest = jest.fn().mockImplementation((partnerId) => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve({ success: false });
        }
        return Promise.resolve({ success: true });
      });

      const startTime = Date.now();

      await failover.executeWithFailover('oxylabs', mockRequest);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // 3 attempts
    });

    it('should handle circuit breaker checks quickly', () => {
      failover.disablePartner('oxylabs');

      const startTime = Date.now();

      failover.getRecoveryStatus('oxylabs');
      failover.getPartnerFailureStatus('oxylabs');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Failure Tracking Performance', () => {
    it('should record failure metrics efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        failover.handlePartnerFailure('oxylabs', new Error('Failed'));
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });

    it('should get failure status in < 5ms', () => {
      for (let i = 0; i < 100; i++) {
        failover.handlePartnerFailure('oxylabs', new Error('Failed'));
      }

      const startTime = Date.now();

      failover.getPartnerFailureStatus('oxylabs');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5);
    });
  });

  describe('Recovery Check Performance', () => {
    it('should check recovery status efficiently', () => {
      failover.disablePartner('oxylabs');

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        failover.getRecoveryStatus('oxylabs');
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // 100 checks
    });
  });

  describe('Concurrent Failover Operations', () => {
    it('should handle concurrent failovers', async () => {
      const mockRequest = jest.fn()
        .mockResolvedValueOnce({ success: false })
        .mockResolvedValueOnce({ success: true });

      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          failover.executeWithFailover('oxylabs', mockRequest)
        );
      }

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // 10 concurrent operations
    });
  });
});

describe('Integration Performance', () => {
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

  it('should handle complete workflow efficiently', async () => {
    const startTime = Date.now();

    // Select partner
    const selection = selector.selectPartner({ region: 'US' });
    const primary = selection.partnerId;

    // Record metrics
    manager.recordMetrics(primary, {
      success: true,
      latency: 100,
      cost: 0.001
    });

    // Get status
    manager.getPartnerStatus(primary);

    // Perform failover
    const mockRequest = jest.fn().mockResolvedValue({ success: true });
    await failover.executeWithFailover(primary, mockRequest);

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(100);
  });

  it('should sustain 100 operations/second', async () => {
    const mockRequest = jest.fn().mockResolvedValue({ success: true });

    const startTime = Date.now();
    let operationCount = 0;

    for (let i = 0; i < 100; i++) {
      selector.selectPartner();
      await failover.executeWithFailover('oxylabs', mockRequest);
      operationCount += 2;
    }

    const duration = Date.now() - startTime;
    const opsPerSecond = (operationCount / duration) * 1000;

    expect(opsPerSecond).toBeGreaterThan(100);
  });
});
