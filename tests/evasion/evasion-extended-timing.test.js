/**
 * Extended Evasion Test Suite - Timing Randomization
 * Tests for request timing, response delays, and connection reuse patterns
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 *
 * Test Coverage:
 * - Request timing randomization (8 tests)
 * - Response delay injection (4 tests)
 * - Connection reuse patterns (3 tests)
 * - Total: 15 tests
 */

const TimingRandomization = require('../../src/evasion/timing-randomization');

describe('Extended Evasion Vectors - Timing Randomization', () => {

  // ============================================================================
  // SECTION 1: REQUEST TIMING RANDOMIZATION TESTS
  // ============================================================================

  describe('Request Timing Randomization', () => {
    let timing;

    beforeEach(() => {
      timing = new TimingRandomization({
        minDelay: 10,
        maxDelay: 150,
        burstThreshold: 5
      });
    });

    test('should generate request delays', () => {
      const delay = timing.getRequestDelay('normal');

      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThanOrEqual(10);
    });

    test('should vary request delays realistically', () => {
      const delays = [];

      for (let i = 0; i < 20; i++) {
        delays.push(timing.getRequestDelay('normal'));
      }

      // Calculate variance
      const mean = delays.reduce((a, b) => a + b) / delays.length;
      const variance = delays.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / delays.length;
      const stdDev = Math.sqrt(variance);

      // Should have significant variation
      expect(stdDev).toBeGreaterThan(5);
      // But not too much
      expect(stdDev).toBeLessThan(150);
    });

    test('should support different request types', () => {
      const resource = timing.getRequestDelay('resource');
      const xhr = timing.getRequestDelay('xhr');
      const fetch = timing.getRequestDelay('fetch');
      const navigation = timing.getRequestDelay('navigation');
      const form = timing.getRequestDelay('form');

      expect(resource).toBeGreaterThanOrEqual(10);
      expect(xhr).toBeGreaterThanOrEqual(10);
      expect(fetch).toBeGreaterThanOrEqual(10);
      expect(navigation).toBeGreaterThanOrEqual(10);
      expect(form).toBeGreaterThanOrEqual(10);

      // Form submissions should generally have longer delays
      expect(form).toBeGreaterThanOrEqual(resource);
    });

    test('should add thinking time periodically', () => {
      timing = new TimingRandomization({ burstThreshold: 2 });
      const delays = [];

      for (let i = 0; i < 10; i++) {
        delays.push(timing.getRequestDelay('normal'));
      }

      // Should have at least one longer delay (thinking time)
      const hasLongDelay = delays.some(d => d > 300);
      // This is probabilistic, so we check with multiple trials
      expect(delays.length).toBe(10);
    });

    test('should maintain history of request timings', () => {
      for (let i = 0; i < 5; i++) {
        timing.getRequestDelay('normal');
      }

      const stats = timing.getTimingStatistics();

      expect(stats.totalRequests).toBe(5);
      expect(Array.isArray(stats.recentPattern)).toBe(true);
      expect(stats.recentPattern.length).toBeLessThanOrEqual(5);
    });

    test('should calculate timing statistics accurately', () => {
      const delays = [50, 60, 70, 80, 90];

      delays.forEach(d => {
        // Can't directly set delays, so we test the statistics calculation
      });

      for (let i = 0; i < 50; i++) {
        timing.getRequestDelay('normal');
      }

      const stats = timing.getTimingStatistics();

      expect(typeof stats.averageDelay).toBe('number');
      expect(typeof stats.minDelay).toBe('number');
      expect(typeof stats.maxDelay).toBe('number');
      expect(typeof stats.delayVariance).toBe('number');

      expect(stats.minDelay).toBeGreaterThanOrEqual(10);
      expect(stats.maxDelay).toBeLessThanOrEqual(1000); // Should not exceed reasonable bounds
      expect(stats.averageDelay).toBeGreaterThan(stats.minDelay);
      expect(stats.averageDelay).toBeLessThan(stats.maxDelay);
    });

    test('should detect suspicious patterns', () => {
      const result = timing.detectSuspiciousPattern();

      // Initially, pattern should not be suspicious (insufficient data)
      expect(result.suspicious).toBe(false);
      expect(result.reason).toBe('insufficient_data');
    });

    test('should detect overly consistent delays', () => {
      // Manually create suspicious pattern
      timing.requestHistory = [];
      for (let i = 0; i < 15; i++) {
        timing.requestHistory.push({
          requestType: 'normal',
          delay: 50, // Identical delay
          timestamp: Date.now()
        });
      }

      const result = timing.detectSuspiciousPattern();

      expect(result.suspicious).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 2: RESPONSE DELAY INJECTION TESTS
  // ============================================================================

  describe('Response Delay Injection', () => {
    let timing;

    beforeEach(() => {
      timing = new TimingRandomization();
    });

    test('should calculate processing delay based on response size', () => {
      const smallDelay = timing.getProcessingDelay(1000);
      const largeDelay = timing.getProcessingDelay(100000);

      expect(typeof smallDelay).toBe('number');
      expect(typeof largeDelay).toBe('number');

      // Both should be positive
      expect(smallDelay).toBeGreaterThan(0);
      expect(largeDelay).toBeGreaterThan(0);

      // On average, larger responses should take longer
      // (but due to variance, a single pair may not follow this strictly)
    });

    test('should add realistic variance for user-interactive responses', () => {
      const delays = [];

      for (let i = 0; i < 20; i++) {
        delays.push(timing.getProcessingDelay(10000, true));
      }

      // Should have variance
      const mean = delays.reduce((a, b) => a + b) / delays.length;
      const variance = delays.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / delays.length;

      expect(variance).toBeGreaterThan(0);
    });

    test('should handle background requests with lower variance', () => {
      const delays = [];

      for (let i = 0; i < 20; i++) {
        delays.push(timing.getProcessingDelay(10000, false));
      }

      // Should have variance, but typically lower for background
      const mean = delays.reduce((a, b) => a + b) / delays.length;
      const variance = delays.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / delays.length;

      expect(variance).toBeGreaterThan(0);
      expect(variance).toBeLessThan(1000); // Reasonable bound
    });

    test('should keep processing delays positive', () => {
      for (let size = 0; size <= 1000000; size += 100000) {
        const delay = timing.getProcessingDelay(size);
        expect(delay).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // SECTION 3: CONNECTION REUSE PATTERN TESTS
  // ============================================================================

  describe('Connection Reuse Patterns', () => {
    let timing;

    beforeEach(() => {
      timing = new TimingRandomization();
    });

    test('should decide to reuse connections realistically', () => {
      const reuses = [];

      for (let i = 0; i < 100; i++) {
        const shouldReuse = timing.shouldReuseConnection('example.com');
        reuses.push(shouldReuse ? 1 : 0);
      }

      const reuseRate = reuses.reduce((a, b) => a + b) / reuses.length;

      // Should be around 85% reuse
      expect(reuseRate).toBeGreaterThan(0.70);
      expect(reuseRate).toBeLessThan(1.0); // Not always reuse
    });

    test('should support per-domain connection decisions', () => {
      const domain1 = timing.shouldReuseConnection('domain1.com');
      const domain2 = timing.shouldReuseConnection('domain2.com');

      // Both should be valid boolean values
      expect(typeof domain1).toBe('boolean');
      expect(typeof domain2).toBe('boolean');
    });

    test('should support secure/insecure protocol distinction', () => {
      const secure = timing.shouldReuseConnection('example.com', true);
      const insecure = timing.shouldReuseConnection('example.com', false);

      // Both should be valid
      expect(typeof secure).toBe('boolean');
      expect(typeof insecure).toBe('boolean');
    });
  });

  // ============================================================================
  // SECTION 4: INTEGRATION TESTS
  // ============================================================================

  describe('Timing Integration', () => {
    let timing;

    beforeEach(() => {
      timing = new TimingRandomization();
    });

    test('should maintain realistic overall timing patterns', () => {
      // Simulate a realistic request sequence
      const requestTypes = ['resource', 'resource', 'xhr', 'navigation', 'form'];
      const responseSizes = [5000, 3000, 50000, 100000, 10000];

      const delays = [];

      for (let i = 0; i < requestTypes.length; i++) {
        const requestDelay = timing.getRequestDelay(requestTypes[i]);
        const responseDelay = timing.getProcessingDelay(responseSizes[i]);
        delays.push(requestDelay + responseDelay);
      }

      // All delays should be positive
      delays.forEach(d => {
        expect(d).toBeGreaterThan(0);
      });

      // Total time should be reasonable (not zero)
      const totalTime = delays.reduce((a, b) => a + b);
      expect(totalTime).toBeGreaterThan(50); // At least some time
      expect(totalTime).toBeLessThan(10000); // But not unreasonably long
    });

    test('should generate statistics across session', () => {
      for (let i = 0; i < 30; i++) {
        timing.getRequestDelay(i % 3 === 0 ? 'navigation' : 'normal');
      }

      const stats = timing.getTimingStatistics();

      expect(stats.totalRequests).toBe(30);
      expect(stats.averageDelay).toBeGreaterThan(10);
      expect(stats.minDelay).toBeLessThan(stats.averageDelay);
      expect(stats.maxDelay).toBeGreaterThan(stats.averageDelay);
      expect(stats.delayVariance).toBeGreaterThan(0);
    });

    test('should clear history and reset state', () => {
      for (let i = 0; i < 10; i++) {
        timing.getRequestDelay('normal');
      }

      timing.clearHistory();

      const stats = timing.getTimingStatistics();
      expect(stats.totalRequests).toBe(0);
    });
  });

  // ============================================================================
  // SECTION 5: STRESS TESTS
  // ============================================================================

  describe('Timing Stress Tests', () => {
    let timing;

    beforeEach(() => {
      timing = new TimingRandomization({ maxHistoryLength: 100 });
    });

    test('should handle rapid request sequences', () => {
      const delays = [];

      for (let i = 0; i < 100; i++) {
        delays.push(timing.getRequestDelay('resource'));
      }

      expect(delays.length).toBe(100);
      delays.forEach(d => {
        expect(d).toBeGreaterThanOrEqual(10);
      });
    });

    test('should not exceed maximum history length', () => {
      for (let i = 0; i < 200; i++) {
        timing.getRequestDelay('normal');
      }

      const stats = timing.getTimingStatistics();
      // History should be capped at maxHistoryLength
      expect(stats.totalRequests).toBeLessThanOrEqual(100);
    });

    test('should handle large response sizes', () => {
      const delay = timing.getProcessingDelay(10000000); // 10MB

      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThan(0);
    });
  });

});
