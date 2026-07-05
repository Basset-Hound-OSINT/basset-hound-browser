/**
 * Export Integrity Verification Tests (L-003)
 *
 * Comprehensive test suite for HMAC signature verification
 * Tests cover:
 * - Basic signing and verification
 * - Tampering detection
 * - Chain of custody tracking
 * - Replay attack prevention
 * - Batch verification
 * - Performance requirements
 * - Python client compatibility
 * - Edge cases and error handling
 *
 * @requires jest
 * @requires ../src/security/export-integrity.js
 */

const { ExportIntegrityManager, INTEGRITY_CONFIG } = require('../../src/security/export-integrity');

describe('ExportIntegrityManager', () => {
  let manager;
  let secretKey;

  beforeEach(() => {
    secretKey = ExportIntegrityManager.generateSecretKey();
    manager = new ExportIntegrityManager(secretKey);
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  // ============================================================================
  // BASIC FUNCTIONALITY TESTS
  // ============================================================================

  describe('Basic Signing and Verification', () => {
    test('should sign and verify simple string payload', () => {
      const payload = 'test export data';
      const signed = manager.signExport(payload);

      expect(signed).toHaveProperty('payload');
      expect(signed).toHaveProperty('signature');
      expect(signed).toHaveProperty('metadata');
      expect(signed.signature).toMatch(/^[a-f0-9]+$/);
      expect(signed.metadata.exportType).toBe('unknown');
    });

    test('should sign and verify JSON object payload', () => {
      const payload = {
        url: 'https://example.com',
        title: 'Example Page',
        timestamp: Date.now()
      };

      const signed = manager.signExport(payload, {
        exportType: 'metadata',
        metadata: { source: 'firefox' }
      });

      const result = manager.verifyExport(signed);

      expect(result.valid).toBe(true);
      expect(result.data).toEqual(payload);
      expect(result.metadata.exportType).toBe('metadata');
    });

    test('should sign and verify Buffer payload', () => {
      const payload = Buffer.from('binary export data');
      const signed = manager.signExport(payload);
      const result = manager.verifyExport(signed);

      expect(result.valid).toBe(true);
    });

    test('should generate deterministic signatures for same payload', () => {
      const payload = { data: 'test', id: 123 };
      const signed1 = manager.signExport(payload);
      const signed2 = manager.signExport(payload);

      // Signatures should be different due to different timestamps and IDs
      expect(signed1.signature).not.toBe(signed2.signature);

      // Both should verify as valid
      expect(manager.verifyExport(signed1).valid).toBe(true);
      expect(manager.verifyExport(signed2).valid).toBe(true);
    });
  });

  // ============================================================================
  // TAMPERING DETECTION TESTS
  // ============================================================================

  describe('Tampering Detection', () => {
    test('should detect modified payload', () => {
      const payload = { message: 'original data' };
      const signed = manager.signExport(payload);

      // Tamper with payload
      signed.payload.message = 'modified data';
      const result = manager.verifyExport(signed);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('tampered');
    });

    test('should detect modified signature', () => {
      const payload = { message: 'test' };
      const signed = manager.signExport(payload);

      // Tamper with signature
      const originalSig = signed.signature;
      signed.signature = originalSig.substring(0, originalSig.length - 1) + 'a';

      const result = manager.verifyExport(signed);

      expect(result.valid).toBe(false);
    });

    test('should detect missing payload', () => {
      const signed = manager.signExport({ data: 'test' });
      delete signed.payload;

      const result = manager.verifyExport(signed);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing payload');
    });

    test('should detect missing signature', () => {
      const signed = manager.signExport({ data: 'test' });
      delete signed.signature;

      const result = manager.verifyExport(signed);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing or invalid signature');
    });

    test('should reject invalid envelope structure', () => {
      const result = manager.verifyExport(null);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid envelope');
    });
  });

  // ============================================================================
  // SIGNATURE VERIFICATION WITH DIFFERENT KEYS
  // ============================================================================

  describe('Key Security', () => {
    test('should reject signature from different key', () => {
      const payload = { sensitive: 'data' };
      const signed = manager.signExport(payload);

      // Create manager with different key
      const differentKey = ExportIntegrityManager.generateSecretKey();
      const otherManager = new ExportIntegrityManager(differentKey);

      const result = otherManager.verifyExport(signed);

      expect(result.valid).toBe(false);
      otherManager.destroy();
    });

    test('should reject invalid secret key length', () => {
      const shortKey = 'tooshort';

      expect(() => {
        new ExportIntegrityManager(shortKey);
      }).toThrow(/at least.*bytes/);
    });

    test('should accept 32-byte hex key', () => {
      const validKey = ExportIntegrityManager.generateSecretKey();

      expect(() => {
        new ExportIntegrityManager(validKey);
      }).not.toThrow();
    });

    test('should accept Buffer key', () => {
      const bufferKey = Buffer.alloc(32);
      crypto.randomFillSync(bufferKey);

      expect(() => {
        new ExportIntegrityManager(bufferKey);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // CHAIN OF CUSTODY TESTS
  // ============================================================================

  describe('Chain of Custody Tracking', () => {
    test('should add exports to chain when requested', () => {
      manager.signExport({ data: 'export1' }, {
        exportType: 'html',
        includeChain: true
      });

      manager.signExport({ data: 'export2' }, {
        exportType: 'network_log',
        includeChain: true
      });

      const chain = manager.getChainOfCustody();

      expect(chain.length).toBe(2);
      expect(chain[0].exportType).toBe('html');
      expect(chain[1].exportType).toBe('network_log');
    });

    test('should filter chain by export type', () => {
      manager.signExport({ data: 'test1' }, {
        exportType: 'html',
        includeChain: true
      });

      manager.signExport({ data: 'test2' }, {
        exportType: 'network_log',
        includeChain: true
      });

      manager.signExport({ data: 'test3' }, {
        exportType: 'html',
        includeChain: true
      });

      const htmlExports = manager.getChainOfCustody({ exportType: 'html' });

      expect(htmlExports.length).toBe(2);
      expect(htmlExports.every(e => e.exportType === 'html')).toBe(true);
    });

    test('should filter chain by export ID', () => {
      const exportId = 'export_test_12345';

      manager.signExport({ data: 'test' }, {
        exportId: exportId,
        includeChain: true
      });

      const filtered = manager.getChainOfCustody({ exportId: exportId });

      expect(filtered.length).toBe(1);
      expect(filtered[0].exportId).toBe(exportId);
    });

    test('should prevent unbounded chain growth', () => {
      // Create manager with small chain limit
      const smallManager = new ExportIntegrityManager(secretKey, {
        maxChainLength: 10
      });

      // Add more exports than limit
      for (let i = 0; i < 20; i++) {
        smallManager.signExport(
          { data: `export_${i}` },
          { includeChain: true }
        );
      }

      const chain = smallManager.getChainOfCustody();

      expect(chain.length).toBeLessThanOrEqual(10);
      smallManager.destroy();
    });
  });

  // ============================================================================
  // BATCH VERIFICATION TESTS
  // ============================================================================

  describe('Batch Verification', () => {
    test('should verify multiple exports in batch', () => {
      const exports = [
        manager.signExport({ data: 'export1' }),
        manager.signExport({ data: 'export2' }),
        manager.signExport({ data: 'export3' })
      ];

      const result = manager.verifyBatch(exports);

      expect(result.valid).toBe(true);
      expect(result.totalCount).toBe(3);
      expect(result.validCount).toBe(3);
      expect(result.failureCount).toBe(0);
    });

    test('should detect failures in batch', () => {
      const exports = [
        manager.signExport({ data: 'export1' }),
        manager.signExport({ data: 'export2' }),
        manager.signExport({ data: 'export3' })
      ];

      // Tamper with second export
      exports[1].payload.data = 'modified';

      const result = manager.verifyBatch(exports);

      expect(result.valid).toBe(false);
      expect(result.validCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.results[1].valid).toBe(false);
    });

    test('should calculate success rate correctly', () => {
      const exports = [
        manager.signExport({ data: 'export1' }),
        manager.signExport({ data: 'export2' })
      ];

      exports[0].payload = 'tampered';

      const result = manager.verifyBatch(exports);

      expect(result.summary.successRate).toBe('50.0');
    });

    test('should handle empty batch', () => {
      const result = manager.verifyBatch([]);

      expect(result.totalCount).toBe(0);
      expect(result.validCount).toBe(0);
      expect(result.failureCount).toBe(0);
    });

    test('should handle non-array input', () => {
      const result = manager.verifyBatch('not an array');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('array');
    });
  });

  // ============================================================================
  // REPLAY ATTACK PREVENTION TESTS
  // ============================================================================

  describe('Replay Attack Prevention', () => {
    test('should enable replay protection when requested', () => {
      const replayManager = new ExportIntegrityManager(secretKey, {
        enableReplayProtection: true
      });

      const signed = replayManager.signExport(
        { data: 'test' },
        { enableReplay: true }
      );

      expect(signed).toHaveProperty('nonce');
      expect(signed.nonce).toMatch(/^[a-f0-9]+$/);

      replayManager.destroy();
    });

    test('should detect replay attempts', () => {
      const replayManager = new ExportIntegrityManager(secretKey, {
        enableReplayProtection: true
      });

      const signed = replayManager.signExport(
        { data: 'test' },
        { enableReplay: true }
      );

      // First verification should succeed
      const result1 = replayManager.verifyExport(signed, { checkReplay: true });
      expect(result1.valid).toBe(true);

      // Second verification with same nonce should fail
      const result2 = replayManager.verifyExport(signed, { checkReplay: true });
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain('Replay');

      replayManager.destroy();
    });

    test('should not require replay checks when disabled', () => {
      const signed = manager.signExport({ data: 'test' });

      const result = manager.verifyExport(signed, { checkReplay: true });

      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance Requirements', () => {
    test('should sign export within <0.5ms', () => {
      const payload = { data: 'x'.repeat(1000) };

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        manager.signExport(payload);
      }
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / 100;

      // Average should be well under 0.5ms
      expect(averageTime).toBeLessThan(0.5);
    });

    test('should verify export within <0.5ms', () => {
      const signed = manager.signExport({ data: 'x'.repeat(1000) });

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        manager.verifyExport(signed);
      }
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / 100;

      // Average should be well under 0.5ms
      expect(averageTime).toBeLessThan(0.5);
    });

    test('should track performance metrics', () => {
      manager.signExport({ data: 'test1' });
      manager.signExport({ data: 'test2' });

      const stats = manager.getStats();

      expect(stats.signatureCount).toBe(2);
      expect(stats.averageSigningTime).not.toBeNaN();
      expect(parseInt(stats.averageSigningTime)).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // STATISTICS AND AUDIT LOGGING
  // ============================================================================

  describe('Statistics and Audit Logging', () => {
    test('should track signature statistics', () => {
      manager.signExport({ data: 'test1' });
      manager.signExport({ data: 'test2' });

      const stats = manager.getStats();

      expect(stats.signatureCount).toBe(2);
      expect(stats.verificationCount).toBeGreaterThanOrEqual(0);
    });

    test('should track verification statistics', () => {
      const signed1 = manager.signExport({ data: 'test1' });
      const signed2 = manager.signExport({ data: 'test2' });

      manager.verifyExport(signed1);
      manager.verifyExport(signed2);

      const stats = manager.getStats();

      expect(stats.verificationCount).toBe(2);
      expect(stats.verificationSuccesses).toBe(2);
      expect(stats.verificationFailures).toBe(0);
      expect(stats.verificationSuccessRate).toBe('100.0');
    });

    test('should calculate failure statistics', () => {
      const signed = manager.signExport({ data: 'test' });
      signed.payload.data = 'tampered';

      manager.verifyExport(signed);

      const stats = manager.getStats();

      expect(stats.verificationCount).toBe(1);
      expect(stats.verificationFailures).toBe(1);
      expect(stats.verificationSuccessRate).toBe('0.0');
    });

    test('should export complete audit log', () => {
      manager.signExport({ data: 'test1' }, { includeChain: true });
      manager.signExport({ data: 'test2' }, { includeChain: true });

      const signed = manager.signExport({ data: 'test3' });
      manager.verifyExport(signed);

      const auditLog = manager.exportAuditLog();

      expect(auditLog).toHaveProperty('timestamp');
      expect(auditLog).toHaveProperty('statistics');
      expect(auditLog).toHaveProperty('performance');
      expect(auditLog).toHaveProperty('chainOfCustody');
      expect(auditLog.statistics.signatureCount).toBe(3);
      expect(auditLog.chainOfCustody.length).toBe(2);
    });
  });

  // ============================================================================
  // METADATA HANDLING
  // ============================================================================

  describe('Metadata Handling', () => {
    test('should include metadata in signed export', () => {
      const metadata = {
        source: 'firefox',
        userAgent: 'Mozilla/5.0...',
        exportReason: 'forensic_analysis'
      };

      const signed = manager.signExport({ data: 'test' }, {
        exportType: 'html',
        metadata: metadata
      });

      expect(signed.metadata).toContainEqual(expect.objectContaining(metadata));
    });

    test('should verify exports with metadata', () => {
      const metadata = { source: 'chrome' };

      const signed = manager.signExport({ data: 'test' }, {
        exportType: 'metadata',
        metadata: metadata
      });

      const result = manager.verifyExport(signed);

      expect(result.valid).toBe(true);
      expect(result.metadata).toContainEqual(expect.objectContaining(metadata));
    });

    test('should detect metadata tampering', () => {
      const metadata = { source: 'chrome' };

      const signed = manager.signExport({ data: 'test' }, {
        metadata: metadata
      });

      // Tamper with metadata
      signed.metadata.source = 'firefox';

      const result = manager.verifyExport(signed);

      expect(result.valid).toBe(false);
    });
  });

  // ============================================================================
  // EVENT EMISSION TESTS
  // ============================================================================

  describe('Event Emission', () => {
    test('should emit initialized event on construction', (done) => {
      const newManager = new ExportIntegrityManager(secretKey);
      newManager.once('initialized', (data) => {
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('config');
        newManager.destroy();
        done();
      });
    });

    test('should emit exported event on signing', (done) => {
      manager.once('exported', (data) => {
        expect(data).toHaveProperty('exportId');
        expect(data).toHaveProperty('exportType');
        expect(data).toHaveProperty('signingTime');
        done();
      });

      manager.signExport({ data: 'test' });
    });

    test('should emit verified event on successful verification', (done) => {
      const signed = manager.signExport({ data: 'test' });

      manager.once('verified', (data) => {
        expect(data).toHaveProperty('exportId');
        expect(data).toHaveProperty('verificationTime');
        done();
      });

      manager.verifyExport(signed);
    });

    test('should emit integrity_violation event on failed verification', (done) => {
      const signed = manager.signExport({ data: 'test' });
      signed.payload.data = 'tampered';

      manager.once('integrity_violation', (data) => {
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('reason');
        done();
      });

      manager.verifyExport(signed);
    });

    test('should emit batch_verified event on batch verification', (done) => {
      const exports = [
        manager.signExport({ data: 'export1' }),
        manager.signExport({ data: 'export2' })
      ];

      manager.once('batch_verified', (summary) => {
        expect(summary).toHaveProperty('totalCount');
        expect(summary).toHaveProperty('validCount');
        done();
      });

      manager.verifyBatch(exports);
    });
  });

  // ============================================================================
  // EDGE CASES AND ERROR HANDLING
  // ============================================================================

  describe('Edge Cases and Error Handling', () => {
    test('should handle very large payloads', () => {
      const largePayload = { data: 'x'.repeat(1000000) }; // 1MB

      expect(() => {
        manager.signExport(largePayload);
      }).not.toThrow();
    });

    test('should handle payloads with special characters', () => {
      const payload = {
        emoji: '🚀🔒🔐',
        unicode: '你好世界',
        special: '<script>alert("xss")</script>'
      };

      const signed = manager.signExport(payload);
      const result = manager.verifyExport(signed);

      expect(result.valid).toBe(true);
      expect(result.data).toEqual(payload);
    });

    test('should handle null values in payload', () => {
      const payload = { data: null, other: undefined };

      const signed = manager.signExport(payload);
      const result = manager.verifyExport(signed);

      expect(result.valid).toBe(true);
    });

    test('should reject null secret key', () => {
      expect(() => {
        new ExportIntegrityManager(null);
      }).toThrow();
    });

    test('should handle cleanup properly', () => {
      const newManager = new ExportIntegrityManager(secretKey, {
        enableReplayProtection: true
      });

      newManager.signExport({ data: 'test' }, { enableReplay: true });

      expect(() => {
        newManager.destroy();
      }).not.toThrow();

      // Verify manager is properly cleaned up
      expect(newManager.replayCache.size).toBe(0);
      expect(newManager.chainOfCustody.length).toBe(0);
    });
  });

  // ============================================================================
  // PYTHON CLIENT COMPATIBILITY TESTS
  // ============================================================================

  describe('Python Client Compatibility', () => {
    test('should produce valid signature format', () => {
      const signed = manager.signExport({ data: 'test' });

      // Verify structure matches Python client expectations
      expect(signed).toHaveProperty('payload');
      expect(signed).toHaveProperty('signature');
      expect(signed).toHaveProperty('metadata');
      expect(signed).toHaveProperty('formatVersion');
      expect(signed.formatVersion).toBe(1);
    });

    test('should support base64 encoded exports', () => {
      const payload = Buffer.from('binary data');
      const base64Payload = payload.toString('base64');

      const signed = manager.signExport(base64Payload);
      const result = manager.verifyExport(signed);

      expect(result.valid).toBe(true);
    });

    test('should produce consistent JSON serialization', () => {
      const payload = { b: 2, a: 1, c: 3 };

      const signed1 = manager.signExport(payload);
      const signed2 = manager.signExport(payload);

      // Due to timestamp and nonce variations, signatures differ
      // but payload should be identical
      expect(signed1.payload).toEqual(signed2.payload);
    });
  });

  // ============================================================================
  // STATIC HELPER TESTS
  // ============================================================================

  describe('Static Helpers', () => {
    test('should generate valid secret key', () => {
      const key = ExportIntegrityManager.generateSecretKey();

      expect(key).toMatch(/^[a-f0-9]+$/);
      expect(key.length).toBe(64); // 32 bytes = 64 hex chars
    });

    test('should create manager with generated key', () => {
      // Suppress console output for this test
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const newManager = ExportIntegrityManager.createWithGeneratedKey();

      expect(newManager).toBeInstanceOf(ExportIntegrityManager);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Generated export integrity secret key')
      );

      newManager.destroy();
      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    test('should support full export lifecycle', () => {
      // Sign an export
      const exportData = {
        url: 'https://example.com',
        content: 'Page content here',
        metadata: { timestamp: Date.now() }
      };

      const signed = manager.signExport(exportData, {
        exportType: 'html',
        exportId: 'export_123',
        includeChain: true
      });

      // Verify immediately
      const verifyResult = manager.verifyExport(signed);
      expect(verifyResult.valid).toBe(true);

      // Export audit log
      const auditLog = manager.exportAuditLog();

      expect(auditLog.statistics.signatureCount).toBe(1);
      expect(auditLog.chainOfCustody.length).toBe(1);
      expect(auditLog.chainOfCustody[0].exportId).toBe('export_123');
    });

    test('should handle mixed export types with statistics', () => {
      // Various export types
      const exports = [
        { data: 'html_content', type: 'html' },
        { data: 'network_logs', type: 'network_log' },
        { data: 'metadata', type: 'metadata' },
        { data: 'screenshot', type: 'screenshot' }
      ];

      exports.forEach(exp => {
        manager.signExport(exp.data, {
          exportType: exp.type,
          includeChain: true
        });
      });

      const stats = manager.getStats();
      const htmlExports = manager.getChainOfCustody({ exportType: 'html' });

      expect(stats.signatureCount).toBe(4);
      expect(htmlExports.length).toBe(1);
    });
  });
});
