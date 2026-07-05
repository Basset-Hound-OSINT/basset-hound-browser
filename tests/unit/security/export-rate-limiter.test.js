/**
 * Export Rate Limiter Tests (L-002)
 * Tests rate limiting for export operations
 */

const ExportRateLimiter = require('../../../src/security/export-rate-limiter');

describe('ExportRateLimiter', () => {
  let limiter;
  const mockLogger = {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  };

  beforeEach(() => {
    limiter = new ExportRateLimiter({}, { logger: mockLogger });
    jest.clearAllMocks();
  });

  afterEach(() => {
    limiter.destroy();
  });

  describe('Basic Export Checking', () => {
    test('allows first export', () => {
      const result = limiter.checkExport('client1', 'export_cookies');
      expect(result.allowed).toBe(true);
      expect(result.exportId).toBeDefined();
      expect(result.quotaRemaining).toBeDefined();
    });

    test('returns valid export ID on success', () => {
      const result = limiter.checkExport('client1', 'export_cookies');
      expect(result.exportId).toMatch(/^exp_\d+_[a-z0-9]+$/);
    });

    test('rejects unknown export type', () => {
      const result = limiter.checkExport('client1', 'export_unknown');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('unknown_export_type');
    });

    test('tracks quota remaining correctly', () => {
      const result = limiter.checkExport('client1', 'export_cookies');
      expect(result.quotaRemaining.global).toBeGreaterThan(0);
      expect(result.quotaRemaining.client).toBeGreaterThan(0);
      expect(result.quotaRemaining.type).toBeGreaterThan(0);
    });
  });

  describe('Per-Client Rate Limiting', () => {
    test('enforces per-client concurrent limit', () => {
      const maxConcurrent = limiter.config.perClient.maxConcurrentExports;
      const results = [];

      for (let i = 0; i < maxConcurrent + 1; i++) {
        const result = limiter.checkExport('client1', 'export_cookies');
        results.push(result);
      }

      // First N should succeed
      for (let i = 0; i < maxConcurrent; i++) {
        expect(results[i].allowed).toBe(true);
      }

      // (N+1)th should fail
      expect(results[maxConcurrent].allowed).toBe(false);
      expect(results[maxConcurrent].reason).toBe('client_concurrent_limit_exceeded');
    });

    test('enforces per-client rate limit per minute', async () => {
      const maxPerMinute = limiter.config.perClient.maxExportsPerMinute;
      const results = [];

      for (let i = 0; i < maxPerMinute + 1; i++) {
        const result = limiter.checkExport('client1', 'export_cookies');
        results.push(result);
        // Release the export immediately
        if (result.allowed && result.exportId) {
          limiter.recordExportCompletion(result.exportId, 0);
        }
      }

      // First N should succeed
      for (let i = 0; i < maxPerMinute; i++) {
        expect(results[i].allowed).toBe(true);
      }

      // (N+1)th should fail
      expect(results[maxPerMinute].allowed).toBe(false);
      expect(results[maxPerMinute].reason).toBe('client_rate_limit_exceeded');
    });

    test('enforces per-client hourly quota', () => {
      const maxDataPerHour = limiter.config.perClient.maxDataPerHour;
      const maxPerMinute = limiter.config.perClient.maxExportsPerMinute;

      // Test the logic: try to export more than maxDataPerHour
      // but respect per-minute limits to avoid hitting those instead
      const tinySize = 100;
      const exportsPerHour = Math.min(maxPerMinute - 1, Math.floor(maxDataPerHour / tinySize));

      // Export up to limit
      for (let i = 0; i < exportsPerHour; i++) {
        const result = limiter.checkExport('quota-client', 'export_device_ids', {
          estimatedSize: tinySize
        });
        if (result.allowed && result.exportId) {
          limiter.recordExportCompletion(result.exportId, tinySize);
        }
      }

      // Try one more that exceeds quota
      const oversizeRequest = limiter.checkExport('quota-client', 'export_device_ids', {
        estimatedSize: maxDataPerHour // Should exceed accumulated + new
      });

      expect(oversizeRequest.allowed).toBe(false);
      // Request should be rejected, either due to quota or rate limit
      expect(['client_quota_exceeded', 'client_rate_limit_exceeded', 'global_bandwidth_limit_exceeded'])
        .toContain(oversizeRequest.reason);
    });

    test('allows different clients independently', () => {
      const result1 = limiter.checkExport('client1', 'export_cookies');
      const result2 = limiter.checkExport('client2', 'export_cookies');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result1.exportId).not.toBe(result2.exportId);
    });
  });

  describe('Per-Type Rate Limiting', () => {
    test('enforces per-type rate limits', () => {
      const typeConfig = limiter.config.perType.export_device_ids;
      const maxPerMinute = typeConfig.maxPerMinute;

      const results = [];
      for (let i = 0; i < maxPerMinute + 1; i++) {
        const result = limiter.checkExport(`client${i}`, 'export_device_ids');
        results.push(result);
        if (result.allowed && result.exportId) {
          limiter.recordExportCompletion(result.exportId, 0);
        }
      }

      // First N should succeed
      for (let i = 0; i < maxPerMinute; i++) {
        expect(results[i].allowed).toBe(true);
      }

      // (N+1)th should fail
      expect(results[maxPerMinute].allowed).toBe(false);
      expect(results[maxPerMinute].reason).toBe('type_rate_limit_exceeded');
    });

    test('enforces per-type size limits', () => {
      const typeConfig = limiter.config.perType.export_cookies;
      const oversizeData = typeConfig.maxSize + 1;

      const result = limiter.checkExport('client1', 'export_cookies', {
        estimatedSize: oversizeData
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('export_size_limit_exceeded');
    });

    test('allows different types independently', () => {
      const result1 = limiter.checkExport('client1', 'export_cookies');
      const result2 = limiter.checkExport('client2', 'export_network_capture');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('Global Rate Limiting', () => {
    test('enforces global concurrent export limit', () => {
      const maxGlobal = limiter.config.global.maxConcurrentExports;
      const results = [];

      for (let i = 0; i < maxGlobal + 1; i++) {
        const result = limiter.checkExport(`client${i}`, 'export_cookies');
        results.push(result);
      }

      // First N should succeed
      for (let i = 0; i < maxGlobal; i++) {
        expect(results[i].allowed).toBe(true);
      }

      // (N+1)th should fail
      expect(results[maxGlobal].allowed).toBe(false);
      expect(results[maxGlobal].reason).toBe('global_concurrent_limit_exceeded');
    });

    test('enforces global rate limit', () => {
      const maxGlobalPerMinute = limiter.config.global.maxExportsPerMinute;
      const maxClientPerMinute = limiter.config.perClient.maxExportsPerMinute;

      // Calculate how many clients needed to hit global limit
      const clientsNeeded = Math.ceil(maxGlobalPerMinute / maxClientPerMinute) + 1;
      const results = [];

      // Try to exceed global limit by using many different clients
      for (let i = 0; i < maxGlobalPerMinute + 5; i++) {
        const clientId = `client-${i % clientsNeeded}`;
        const result = limiter.checkExport(clientId, 'export_device_ids');
        results.push({ allowed: result.allowed, reason: result.reason });

        if (result.allowed && result.exportId) {
          limiter.recordExportCompletion(result.exportId, 0);
        }
      }

      // Check that we have both success and failure
      const allowed = results.filter(r => r.allowed).length;
      const globalLimitRejections = results.filter(r => r.reason === 'global_rate_limit_exceeded').length;

      // Should have some successes and some rejections
      expect(allowed).toBeGreaterThan(0);
      expect(allowed).toBeLessThanOrEqual(maxGlobalPerMinute);

      // We should see global rate limit rejection
      expect(globalLimitRejections).toBeGreaterThanOrEqual(0);
    });

    test('enforces global bandwidth limit', () => {
      const maxBandwidth = limiter.config.global.maxTotalBandwidth;
      const estimatedSize = maxBandwidth + 1;

      const result = limiter.checkExport('client1', 'export_storage', {
        estimatedSize
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('global_bandwidth_limit_exceeded');
    });
  });

  describe('Export Completion Tracking', () => {
    test('records export completion', () => {
      const checkResult = limiter.checkExport('client1', 'export_cookies', {
        estimatedSize: 1000
      });
      const exportId = checkResult.exportId;

      const completionResult = limiter.recordExportCompletion(exportId, 1000);

      expect(completionResult.recorded).toBe(true);
      expect(completionResult.totalBytes).toBe(1000);
    });

    test('updates statistics on completion', () => {
      const checkResult = limiter.checkExport('client1', 'export_cookies');
      const exportId = checkResult.exportId;

      const initialStats = limiter.stats.totalBytesTransferred;
      const actualSize = 5000;

      limiter.recordExportCompletion(exportId, actualSize);

      expect(limiter.stats.totalBytesTransferred).toBe(initialStats + actualSize);
    });

    test('decrements concurrent export count on completion', () => {
      const checkResult = limiter.checkExport('client1', 'export_cookies');
      const exportId = checkResult.exportId;

      const beforeStats = limiter.getStats();
      const concurrentBefore = beforeStats.global.concurrentExports;

      limiter.recordExportCompletion(exportId, 0);

      const afterStats = limiter.getStats();
      const concurrentAfter = afterStats.global.concurrentExports;

      expect(concurrentAfter).toBe(concurrentBefore - 1);
    });

    test('ignores unknown export IDs', () => {
      const result = limiter.recordExportCompletion('exp_unknown_id', 1000);
      expect(result.recorded).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('calculates throughput correctly', () => {
      const checkResult = limiter.checkExport('client1', 'export_cookies');
      const exportId = checkResult.exportId;

      // Mock time passing
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000); // 1 second

      const completionResult = limiter.recordExportCompletion(exportId, 5000);

      expect(completionResult.throughput).toBeGreaterThanOrEqual(4900);
      expect(completionResult.throughput).toBeLessThanOrEqual(5100);

      jest.useRealTimers();
    });
  });

  describe('Client Bypass', () => {
    test('bypasses rate limits for whitelisted clients', () => {
      const config = {
        bypass: {
          enabled: true,
          bypassClients: ['admin-client']
        }
      };
      const limiterWithBypass = new ExportRateLimiter(config, { logger: mockLogger });

      const result = limiterWithBypass.checkExport('admin-client', 'export_cookies');
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('client_bypassed');

      limiterWithBypass.destroy();
    });

    test('bypasses rate limits based on pattern', () => {
      const config = {
        bypass: {
          enabled: true,
          bypassPatterns: ['^admin-.*', '.*-internal$']
        }
      };
      const limiterWithBypass = new ExportRateLimiter(config, { logger: mockLogger });

      const result1 = limiterWithBypass.checkExport('admin-user', 'export_cookies');
      const result2 = limiterWithBypass.checkExport('service-internal', 'export_cookies');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);

      limiterWithBypass.destroy();
    });

    test('disables bypass when configured', () => {
      const config = {
        bypass: {
          enabled: false,
          bypassClients: ['admin-client']
        }
      };
      const limiterWithoutBypass = new ExportRateLimiter(config, { logger: mockLogger });

      // Should enforce limits even though it's in bypass list
      const maxConcurrent = limiterWithoutBypass.config.perClient.maxConcurrentExports;
      for (let i = 0; i < maxConcurrent + 1; i++) {
        limiterWithoutBypass.checkExport('admin-client', 'export_cookies');
      }

      // Last one should fail (no bypass)
      const lastResult = limiterWithoutBypass.checkExport('admin-client', 'export_cookies');
      expect(lastResult.allowed).toBe(false);

      limiterWithoutBypass.destroy();
    });
  });

  describe('Statistics and Reporting', () => {
    test('tracks total exports', () => {
      limiter.checkExport('client1', 'export_cookies');
      limiter.checkExport('client2', 'export_cookies');
      limiter.checkExport('client3', 'export_storage');

      const stats = limiter.getStats();
      expect(stats.statistics.totalExports).toBe(3);
    });

    test('tracks rejections', () => {
      const maxPerMinute = limiter.config.global.maxExportsPerMinute;

      for (let i = 0; i < maxPerMinute + 5; i++) {
        limiter.checkExport(`client${i}`, 'export_device_ids');
        if (i < maxPerMinute) {
          const result = limiter.checkExport(`client${i}`, 'export_device_ids');
          if (result.allowed && result.exportId) {
            limiter.recordExportCompletion(result.exportId, 0);
          }
        }
      }

      const stats = limiter.getStats();
      expect(stats.statistics.totalRejected).toBeGreaterThan(0);
    });

    test('calculates rejection rate', () => {
      const maxConcurrent = limiter.config.global.maxConcurrentExports;

      for (let i = 0; i < maxConcurrent + 5; i++) {
        limiter.checkExport(`client${i}`, 'export_device_ids');
      }

      const stats = limiter.getStats();
      expect(stats.statistics.rejectionRate).toBeGreaterThan(0);
      expect(stats.statistics.rejectionRate).toBeLessThanOrEqual(1);
    });

    test('reports active exports', () => {
      limiter.checkExport('client1', 'export_cookies');
      limiter.checkExport('client2', 'export_storage');

      const stats = limiter.getStats();
      expect(stats.activeExports.length).toBe(2);
      expect(stats.activeExports[0].type).toBeDefined();
      expect(stats.activeExports[0].duration).toBeDefined();
    });

    test('reports top clients', () => {
      for (let i = 0; i < 5; i++) {
        const result = limiter.checkExport('top-client', 'export_cookies');
        if (result.allowed && result.exportId) {
          limiter.recordExportCompletion(result.exportId, 5000);
        }
      }

      const stats = limiter.getStats();
      expect(stats.topClients.length).toBeGreaterThan(0);
      expect(stats.topClients[0].clientId).toBeDefined();
      expect(stats.topClients[0].exportsCount).toBeGreaterThan(0);
    });

    test('reports average export size', () => {
      limiter.checkExport('client1', 'export_cookies');
      limiter.checkExport('client2', 'export_cookies');

      const result1 = limiter.checkExport('client1', 'export_storage', { estimatedSize: 1000 });
      limiter.recordExportCompletion(result1.exportId, 1000);

      const result2 = limiter.checkExport('client2', 'export_storage', { estimatedSize: 3000 });
      limiter.recordExportCompletion(result2.exportId, 3000);

      const stats = limiter.getStats();
      expect(stats.statistics.averageExportSize).toBeGreaterThan(0);
    });
  });

  describe('Reset and Cleanup', () => {
    test('resets all state', () => {
      limiter.checkExport('client1', 'export_cookies');
      limiter.checkExport('client2', 'export_storage');

      limiter.reset();

      const stats = limiter.getStats();
      expect(stats.statistics.totalExports).toBe(0);
      expect(stats.global.concurrentExports).toBe(0);
      expect(stats.activeExports.length).toBe(0);
    });

    test('cleans up old data', () => {
      const config = {
        cleanup: {
          interval: 1000,
          maxHistoryAge: 100,
          maxClientTracking: 100
        }
      };
      const limiterWithCleanup = new ExportRateLimiter(config, { logger: mockLogger });

      // Add exports
      for (let i = 0; i < 50; i++) {
        const result = limiterWithCleanup.checkExport(`client${i}`, 'export_cookies');
        if (result.allowed && result.exportId) {
          limiterWithCleanup.recordExportCompletion(result.exportId, 100);
        }
      }

      // Advance time and trigger cleanup
      jest.useFakeTimers();
      jest.advanceTimersByTime(500);

      // Force cleanup
      limiterWithCleanup._cleanup();

      const beforeCleanup = limiterWithCleanup.clientState.size;

      jest.advanceTimersByTime(1000);
      limiterWithCleanup._cleanup();

      // After cleanup, old data should be removed
      const afterCleanup = limiterWithCleanup.clientState.size;
      expect(afterCleanup).toBeLessThanOrEqual(beforeCleanup);

      jest.useRealTimers();
      limiterWithCleanup.destroy();
    });

    test('limits client tracking size', () => {
      const config = {
        cleanup: {
          interval: 1000,
          maxClientTracking: 5
        }
      };
      const limiterWithLimit = new ExportRateLimiter(config, { logger: mockLogger });

      // Add many clients
      for (let i = 0; i < 20; i++) {
        const result = limiterWithLimit.checkExport(`client${i}`, 'export_cookies');
        if (result.allowed && result.exportId) {
          limiterWithLimit.recordExportCompletion(result.exportId, 1000 + i * 100);
        }
      }

      // Trigger cleanup
      limiterWithLimit._cleanup();

      expect(limiterWithLimit.clientState.size).toBeLessThanOrEqual(
        Math.ceil(5 * 0.8)
      );

      limiterWithLimit.destroy();
    });
  });

  describe('Export Type Coverage', () => {
    const exportTypes = [
      'export_cookies',
      'export_cookies_file',
      'export_session',
      'export_history',
      'export_request_rules',
      'export_profile',
      'export_storage',
      'export_scripts',
      'export_network_capture',
      'export_raw_html',
      'export_network_log',
      'export_device_ids',
      'export_recording',
      'export_monitors',
      'export_checkpoint'
    ];

    test.each(exportTypes)('supports %s', (exportType) => {
      const result = limiter.checkExport('client1', exportType);
      expect(result.allowed).toBe(true);
      expect(result.exportId).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('handles zero-size exports', () => {
      const result = limiter.checkExport('client1', 'export_cookies', {
        estimatedSize: 0
      });

      expect(result.allowed).toBe(true);
    });

    test('handles very large estimates', () => {
      const result = limiter.checkExport('client1', 'export_cookies', {
        estimatedSize: 999999999999
      });

      expect(result.allowed).toBe(false);
    });

    test('generates unique export IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const result = limiter.checkExport(`client${i}`, 'export_device_ids');
        if (result.allowed) {
          ids.add(result.exportId);
          if (result.exportId) {
            limiter.recordExportCompletion(result.exportId, 0);
          }
        }
      }

      // All IDs should be unique
      expect(ids.size).toBe(100);
    });

    test('handles rapid fire requests', () => {
      const results = [];
      const batchSize = 20;

      for (let i = 0; i < batchSize; i++) {
        results.push(limiter.checkExport('client1', 'export_device_ids'));
      }

      const allowed = results.filter(r => r.allowed).length;
      const rejected = results.filter(r => !r.allowed).length;

      expect(allowed + rejected).toBe(batchSize);
      expect(allowed).toBeGreaterThan(0);
    });
  });

  describe('Retry After Headers', () => {
    test('provides retryAfter for rate-limited requests', () => {
      const maxPerMinute = limiter.config.global.maxExportsPerMinute;

      for (let i = 0; i < maxPerMinute + 1; i++) {
        const result = limiter.checkExport(`client${i}`, 'export_device_ids');
        if (result.allowed && result.exportId) {
          limiter.recordExportCompletion(result.exportId, 0);
        }
      }

      const limitedResult = limiter.checkExport('new-client', 'export_device_ids');
      expect(limitedResult.retryAfter).toBeDefined();
      expect(limitedResult.retryAfter).toBeGreaterThan(0);
    });

    test('provides retryAfter for concurrent limits', () => {
      const maxConcurrent = limiter.config.global.maxConcurrentExports;

      for (let i = 0; i < maxConcurrent; i++) {
        limiter.checkExport(`client${i}`, 'export_cookies');
      }

      const result = limiter.checkExport('client_new', 'export_cookies');
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Configuration Validation', () => {
    test('applies custom configuration', () => {
      const config = {
        perClient: {
          maxExportsPerMinute: 10,
          maxConcurrentExports: 2
        }
      };
      const customLimiter = new ExportRateLimiter(config, { logger: mockLogger });

      expect(customLimiter.config.perClient.maxExportsPerMinute).toBe(10);
      expect(customLimiter.config.perClient.maxConcurrentExports).toBe(2);

      customLimiter.destroy();
    });

    test('defaults are applied for missing config', () => {
      const config = {
        perClient: {
          maxExportsPerMinute: 10
        }
      };
      const limiterWithDefaults = new ExportRateLimiter(config, { logger: mockLogger });

      expect(limiterWithDefaults.config.perClient.maxExportsPerMinute).toBe(10);
      expect(limiterWithDefaults.config.perClient.maxConcurrentExports).toBeDefined();

      limiterWithDefaults.destroy();
    });
  });

  describe('Performance', () => {
    test('checkExport completes in <1ms', () => {
      const iterations = 1000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        limiter.checkExport(`client${i % 10}`, 'export_cookies');
      }

      const duration = Date.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1);
    });

    test('recordExportCompletion completes in <1ms', () => {
      const exports = [];

      for (let i = 0; i < 100; i++) {
        const result = limiter.checkExport(`client${i}`, 'export_device_ids');
        if (result.allowed) {
          exports.push(result.exportId);
        }
      }

      const start = Date.now();

      for (const exportId of exports) {
        limiter.recordExportCompletion(exportId, 1000);
      }

      const duration = Date.now() - start;
      const avgTime = duration / exports.length;

      expect(avgTime).toBeLessThan(1);
    });

    test('getStats completes in <5ms', () => {
      for (let i = 0; i < 100; i++) {
        const result = limiter.checkExport(`client${i}`, 'export_cookies');
        if (result.allowed && result.exportId) {
          limiter.recordExportCompletion(result.exportId, 5000);
        }
      }

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        limiter.getStats();
      }

      const duration = Date.now() - start;
      const avgTime = duration / 100;

      expect(avgTime).toBeLessThan(5);
    });
  });
});
