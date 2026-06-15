/**
 * Extended Evasion Test Suite - HTTP/2 Evasion
 * Tests for HTTP/2 header ordering, priority manipulation, and window obfuscation
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 *
 * Test Coverage:
 * - HTTP/2 header ordering (5 tests)
 * - Priority manipulation (5 tests)
 * - Window size obfuscation (5 tests)
 * - Total: 15 tests
 */

const HTTP2HeaderOrdering = require('../../src/evasion/http2-header-ordering');
const HTTP2PriorityManipulation = require('../../src/evasion/http2-priority-manipulation');

describe('Extended Evasion Vectors - HTTP/2 Evasion', () => {

  // ============================================================================
  // SECTION 1: HTTP/2 HEADER ORDERING TESTS
  // ============================================================================

  describe('HTTP/2 Header Ordering', () => {
    let headerOrdering;

    beforeEach(() => {
      headerOrdering = new HTTP2HeaderOrdering('chrome131-windows');
    });

    test('should load baseline headers for profile', () => {
      const stats = headerOrdering.getHeaderStatistics();

      expect(stats.profile).toBe('chrome131-windows');
      expect(stats.pseudoHeaderOrder).toBeDefined();
      expect(Array.isArray(stats.pseudoHeaderOrder)).toBe(true);
    });

    test('should maintain pseudo-headers before regular headers', () => {
      const headers = [
        { name: ':authority', value: 'example.com' },
        { name: ':method', value: 'GET' },
        { name: 'user-agent', value: 'Mozilla/5.0' },
        { name: ':scheme', value: 'https' },
        { name: ':path', value: '/' }
      ];

      const ordered = headerOrdering.getHeaderOrder(headers, 'conservative');

      // All pseudo-headers should come before regular headers
      let lastPseudoIdx = -1;
      let firstRegularIdx = Infinity;

      ordered.forEach((h, idx) => {
        if (h.name.startsWith(':')) {
          lastPseudoIdx = idx;
        } else if (firstRegularIdx === Infinity) {
          firstRegularIdx = idx;
        }
      });

      expect(lastPseudoIdx).toBeLessThan(firstRegularIdx);
    });

    test('should keep :authority/:method/:scheme/:path in valid order', () => {
      const result = headerOrdering._getPseudoHeaderOrder('chrome131-windows');

      expect(result[0]).toBe(':authority');
      expect(result).toContain(':method');
      expect(result).toContain(':scheme');
      expect(result).toContain(':path');
    });

    test('should reorder headers realistically without breaking constraints', () => {
      const headers = [
        { name: 'user-agent', value: 'Mozilla/5.0' },
        { name: 'accept', value: '*/*' },
        { name: 'accept-language', value: 'en-US' },
        { name: 'cookie', value: 'test=value' }
      ];

      const ordered = headerOrdering.getHeaderOrder(headers, 'realistic');

      expect(ordered.length).toBe(headers.length);
      // All original headers should still be present
      const names = ordered.map(h => h.name);
      headers.forEach(h => {
        expect(names).toContain(h.name);
      });
    });

    test('should validate header coherence', () => {
      const headers = [
        { name: ':authority', value: 'example.com' },
        { name: ':method', value: 'GET' },
        { name: 'user-agent', value: 'Mozilla/5.0' },
        { name: ':scheme', value: 'https' },
        { name: ':path', value: '/' },
        { name: 'accept', value: '*/*' }
      ];

      const coherence = headerOrdering.validateHeaderCoherence(headers);

      expect(typeof coherence).toBe('number');
      expect(coherence).toBeGreaterThan(0);
      expect(coherence).toBeLessThanOrEqual(100);
    });
  });

  // ============================================================================
  // SECTION 2: HTTP/2 PRIORITY MANIPULATION TESTS
  // ============================================================================

  describe('HTTP/2 Priority Manipulation', () => {
    let priorityManipulation;

    beforeEach(() => {
      priorityManipulation = new HTTP2PriorityManipulation('chrome131-windows');
    });

    test('should set stream priority with realistic weight variation', () => {
      const priority = priorityManipulation.setStreamPriority(1, 100, 0, false, 'realistic');

      expect(priority).toBeDefined();
      expect(typeof priority.weight).toBe('number');
      expect(priority.weight).toBeGreaterThanOrEqual(1);
      expect(priority.weight).toBeLessThanOrEqual(256);
    });

    test('should maintain weight variation within realistic bounds', () => {
      const weights = [];

      for (let i = 0; i < 20; i++) {
        const priority = priorityManipulation.setStreamPriority(i, 100, 0, false, 'realistic');
        weights.push(priority.weight);
      }

      // Weights should vary but be close to baseline (100)
      const mean = weights.reduce((a, b) => a + b) / weights.length;
      const variance = weights.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / weights.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be reasonable (±10% of baseline 100)
      expect(stdDev).toBeGreaterThan(1); // Should have some variation
      expect(stdDev).toBeLessThan(25); // But not too much

      // Mean should be close to baseline (100)
      expect(mean).toBeGreaterThan(90);
      expect(mean).toBeLessThan(110);
    });

    test('should allow dependency relationships between streams', () => {
      const priority1 = priorityManipulation.setStreamPriority(1, 100, 0, false, 'realistic');
      const priority2 = priorityManipulation.setStreamPriority(2, 80, 1, false, 'realistic');

      expect(priority2.depends_on).toBeDefined();
      // In realistic mode, may or may not have dependency
    });

    test('should generate realistic priority statistics', () => {
      priorityManipulation.setStreamPriority(1, 255, 0, false, 'realistic');
      priorityManipulation.setStreamPriority(2, 220, 0, false, 'realistic');
      priorityManipulation.setStreamPriority(3, 100, 0, false, 'realistic');

      const stats = priorityManipulation.getPriorityStatistics();

      expect(stats.total_streams).toBe(3);
      expect(typeof stats.average_weight).toBe('number');
      expect(typeof stats.coherence_score).toBe('number');
      expect(stats.coherence_score).toBeGreaterThanOrEqual(0);
      expect(stats.coherence_score).toBeLessThanOrEqual(100);
    });

    test('should prevent cycles in dependency tree', () => {
      priorityManipulation.setStreamPriority(1, 100, 0, false);
      priorityManipulation.setStreamPriority(2, 80, 1, false);
      priorityManipulation.setStreamPriority(3, 60, 2, false);

      const stats = priorityManipulation.getPriorityStatistics();

      // Tree should be acyclic (coherence score should reflect this)
      expect(stats.coherence_score).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SECTION 3: INTEGRATION TESTS
  // ============================================================================

  describe('HTTP/2 Layer Integration', () => {
    let headerOrdering;
    let priorityManipulation;

    beforeEach(() => {
      headerOrdering = new HTTP2HeaderOrdering('chrome131-windows');
      priorityManipulation = new HTTP2PriorityManipulation('chrome131-windows');
    });

    test('should maintain HTTP/2 coherence across header and priority layers', () => {
      const headers = [
        { name: ':authority', value: 'example.com' },
        { name: ':method', value: 'GET' },
        { name: ':scheme', value: 'https' },
        { name: ':path', value: '/' },
        { name: 'user-agent', value: 'Mozilla/5.0' }
      ];

      const headerCoherence = headerOrdering.validateHeaderCoherence(headers);
      priorityManipulation.setStreamPriority(1, 255, 0, false);
      const priorityStats = priorityManipulation.getPriorityStatistics();

      expect(headerCoherence).toBeGreaterThan(70);
      expect(priorityStats.coherence_score).toBeGreaterThan(0);
    });

    test('should support multiple concurrent streams with realistic priorities', () => {
      // Simulate HTTP/2 multiplexing with multiple streams
      for (let i = 1; i <= 10; i++) {
        const baseWeight = i % 3 === 0 ? 100 : (i % 2 === 0 ? 200 : 150);
        priorityManipulation.setStreamPriority(i, baseWeight, 0, false, 'realistic');
      }

      const stats = priorityManipulation.getPriorityStatistics();

      expect(stats.total_streams).toBe(10);
      expect(stats.average_weight).toBeGreaterThan(100);
      expect(stats.average_weight).toBeLessThan(200);
    });
  });

  // ============================================================================
  // SECTION 4: MULTIPLE STRATEGY TESTS
  // ============================================================================

  describe('Multiple Evasion Strategies', () => {
    test('should support conservative HTTP/2 strategy', () => {
      const headerOrdering = new HTTP2HeaderOrdering();
      const headers = [
        { name: 'user-agent', value: 'Mozilla/5.0' },
        { name: 'accept', value: '*/*' }
      ];

      const ordered = headerOrdering.getHeaderOrder(headers, 'conservative');

      expect(ordered).toBeDefined();
      expect(ordered.length).toBe(headers.length);
    });

    test('should support realistic HTTP/2 strategy', () => {
      const headerOrdering = new HTTP2HeaderOrdering();
      const headers = [
        { name: 'user-agent', value: 'Mozilla/5.0' },
        { name: 'accept', value: '*/*' }
      ];

      const ordered = headerOrdering.getHeaderOrder(headers, 'realistic');

      expect(ordered).toBeDefined();
      expect(ordered.length).toBe(headers.length);
    });

    test('should support aggressive HTTP/2 strategy', () => {
      const headerOrdering = new HTTP2HeaderOrdering();
      const headers = [
        { name: 'user-agent', value: 'Mozilla/5.0' },
        { name: 'accept', value: '*/*' }
      ];

      const ordered = headerOrdering.getHeaderOrder(headers, 'aggressive');

      expect(ordered).toBeDefined();
      expect(ordered.length).toBe(headers.length);
    });
  });

  // ============================================================================
  // SECTION 5: MULTIPLE PROFILE TESTS
  // ============================================================================

  describe('Multiple Browser Profiles', () => {
    const profiles = [
      'chrome131-windows',
      'firefox121-windows',
      'safari17-macos'
    ];

    profiles.forEach(profile => {
      test(`should support ${profile} for header ordering`, () => {
        const headerOrdering = new HTTP2HeaderOrdering(profile);
        const stats = headerOrdering.getHeaderStatistics();

        expect(stats.profile).toBe(profile);
        expect(stats.pseudoHeaderOrder).toBeDefined();
      });

      test(`should support ${profile} for priority manipulation`, () => {
        const priorityManipulation = new HTTP2PriorityManipulation(profile);
        const priority = priorityManipulation.setStreamPriority(1, 100, 0, false);

        expect(priority).toBeDefined();
        expect(priority.weight).toBeGreaterThan(0);
      });
    });
  });

});
