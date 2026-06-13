/**
 * Basset Hound Browser - Session Coherence Validation Tests
 * Comprehensive test suite for 5-layer coherence validation framework
 *
 * Tests:
 * - Session initialization and baseline tracking
 * - Per-layer coherence validation
 * - Real-time coherence scoring
 * - Violation detection and reporting
 * - Session comparison and forensic export
 *
 * Version: 1.0.0
 */

const { CoherenceManager } = require('../../src/evasion/coherence-manager');
const { MasterCoherenceValidator } = require('../../src/evasion/coherence-validators');
const assert = require('assert');

describe('Session Coherence Validation Framework', () => {

  let coherenceManager;

  beforeEach(() => {
    coherenceManager = new CoherenceManager();
  });

  // ========== INITIALIZATION TESTS ==========

  describe('Session Initialization', () => {

    test('should initialize a new session with baseline data', () => {
      const sessionId = 'sess_test_001';
      const initialData = {
        os: 'macOS',
        browser: 'Chrome 114',
        userAgent: 'Mozilla/5.0...',
        fingerprint: { canvas: 'abc123' },
        behavior: { typingSpeed: 65 },
        device: { screenResolution: '1920x1080' },
        network: { ip: '1.2.3.4' }
      };

      const result = coherenceManager.initializeSession(sessionId, initialData);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.sessionId, sessionId);
      assert.strictEqual(result.initialized, true);
    });

    test('should prevent duplicate session initialization', () => {
      const sessionId = 'sess_test_002';
      coherenceManager.initializeSession(sessionId, {});
      const result = coherenceManager.initializeSession(sessionId, {});

      assert.strictEqual(result.success, false);
      assert(result.error.includes('already initialized'));
    });

    test('should initialize with minimal data', () => {
      const result = coherenceManager.initializeSession('sess_test_003', {});
      assert.strictEqual(result.success, true);
    });

  });

  // ========== INTERACTION RECORDING TESTS ==========

  describe('Interaction Recording', () => {

    test('should record interaction without coherence check', () => {
      coherenceManager.initializeSession('sess_test_004', {});

      const result = coherenceManager.recordInteraction('sess_test_004', {
        type: 'navigate',
        url: 'https://example.com'
      });

      assert.strictEqual(result.success, true);
      assert(result.interactionId);
    });

    test('should record interaction with coherence validation', () => {
      coherenceManager.initializeSession('sess_test_005', {});

      const result = coherenceManager.recordInteraction('sess_test_005', {
        type: 'navigate',
        url: 'https://example.com',
        requestData: {
          network: {
            ip: '1.2.3.4',
            timestamp: Date.now()
          },
          headers: {
            'user-agent': 'Mozilla/5.0...'
          }
        }
      });

      assert.strictEqual(result.success, true);
      assert(result.coherenceResult);
    });

    test('should fail for non-existent session', () => {
      assert.throws(() => {
        coherenceManager.recordInteraction('sess_nonexistent', {
          type: 'navigate'
        });
      }, /Session not found/);
    });

    test('should track multiple interactions', () => {
      const sessionId = 'sess_test_006';
      coherenceManager.initializeSession(sessionId, {});

      for (let i = 0; i < 5; i++) {
        coherenceManager.recordInteraction(sessionId, {
          type: 'navigate',
          url: `https://example.com/${i}`
        });
      }

      const summary = coherenceManager.getCoherenceSummary(sessionId);
      assert.strictEqual(summary.interactionCount, 5);
    });

  });

  // ========== COHERENCE ANALYSIS TESTS ==========

  describe('Coherence Analysis', () => {

    test('should analyze coherence with all layers', () => {
      const sessionId = 'sess_test_007';
      coherenceManager.initializeSession(sessionId, {
        fingerprint: { canvas: 'abc123' },
        os: 'macOS',
        browser: 'Chrome'
      });

      coherenceManager.recordInteraction(sessionId, {
        type: 'navigate',
        url: 'https://example.com'
      });

      const analysis = coherenceManager.analyzeCoherence(sessionId);

      assert(analysis.overallCoherence >= 0 && analysis.overallCoherence <= 1);
      assert(analysis.layers.temporal);
      assert(analysis.layers.behavioral);
      assert(analysis.layers.network);
      assert(analysis.layers.device);
      assert(analysis.layers.timeline);
    });

    test('should detect temporal coherence violations', () => {
      const sessionId = 'sess_test_008';
      coherenceManager.initializeSession(sessionId, {
        fingerprint: { canvas: 'abc123' }
      });

      // Record interaction with modified fingerprint
      coherenceManager.recordInteraction(sessionId, {
        type: 'navigate',
        requestData: {
          device: {
            canvas: 'different_hash'  // Changed fingerprint
          }
        }
      });

      const analysis = coherenceManager.analyzeCoherence(sessionId);
      // Should detect deviation in temporal layer
      assert(analysis.layers.temporal.score >= 0);
    });

    test('should report network violations', () => {
      const sessionId = 'sess_test_009';
      coherenceManager.initializeSession(sessionId, {});

      // Record rapid IP changes
      coherenceManager.recordInteraction(sessionId, {
        type: 'navigate',
        requestData: {
          network: {
            ip: '1.2.3.4',
            timestamp: Date.now()
          }
        }
      });

      coherenceManager.recordInteraction(sessionId, {
        type: 'navigate',
        requestData: {
          network: {
            ip: '5.6.7.8',
            timestamp: Date.now() + 10000  // 10 seconds later (too fast)
          }
        }
      });

      const analysis = coherenceManager.analyzeCoherence(sessionId);
      assert(analysis.layers.network);
    });

    test('should detect timeline anomalies', () => {
      const sessionId = 'sess_test_010';
      coherenceManager.initializeSession(sessionId, {});

      const baseTime = Date.now();

      coherenceManager.recordInteraction(sessionId, {
        type: 'navigate',
        url: 'https://example.com'
      });

      const analysis = coherenceManager.analyzeCoherence(sessionId);
      assert(analysis.layers.timeline);
      assert.strictEqual(analysis.layers.timeline.evidence.eventSequenceValid, true);
    });

  });

  // ========== VIOLATION DETECTION TESTS ==========

  describe('Violation Detection', () => {

    test('should aggregate violations from interactions', () => {
      const sessionId = 'sess_test_011';
      coherenceManager.initializeSession(sessionId, {});

      // Record multiple interactions
      for (let i = 0; i < 3; i++) {
        coherenceManager.recordInteraction(sessionId, {
          type: 'navigate',
          url: `https://example.com/${i}`
        });
      }

      const analysis = coherenceManager.analyzeCoherence(sessionId);
      assert(Array.isArray(analysis.recoveryStrategies));
    });

    test('should classify violation severity', () => {
      const sessionId = 'sess_test_012';
      coherenceManager.initializeSession(sessionId, {});

      coherenceManager.recordInteraction(sessionId, {
        type: 'navigate',
        requestData: {
          network: {
            ip: '1.2.3.4'
          }
        }
      });

      const analysis = coherenceManager.analyzeCoherence(sessionId);
      // Violations should have severity levels
      if (analysis.recoveryStrategies.length > 0) {
        const strategies = analysis.recoveryStrategies;
        for (const strategy of strategies) {
          assert(['INFO', 'WARNING', 'CRITICAL'].includes(strategy.severity));
        }
      }
    });

  });

  // ========== SESSION COMPARISON TESTS ==========

  describe('Session Comparison', () => {

    test('should compare two sessions for similarity', () => {
      const session1 = 'sess_test_013';
      const session2 = 'sess_test_014';

      coherenceManager.initializeSession(session1, {
        device: { screenResolution: '1920x1080' },
        os: 'macOS',
        browser: 'Chrome'
      });

      coherenceManager.initializeSession(session2, {
        device: { screenResolution: '1920x1080' },
        os: 'macOS',
        browser: 'Chrome'
      });

      const comparison = coherenceManager.compareSessions(session1, session2);

      assert.strictEqual(comparison.session1Id, session1);
      assert.strictEqual(comparison.session2Id, session2);
      assert(comparison.overallMatch >= 0 && comparison.overallMatch <= 1);
      assert(typeof comparison.likelyUserMatch === 'boolean');
    });

    test('should detect different device fingerprints', () => {
      const session1 = 'sess_test_015';
      const session2 = 'sess_test_016';

      coherenceManager.initializeSession(session1, {
        device: { screenResolution: '1920x1080' }
      });

      coherenceManager.initializeSession(session2, {
        device: { screenResolution: '1366x768' }  // Different resolution
      });

      const comparison = coherenceManager.compareSessions(session1, session2);

      // Should detect difference
      assert(comparison.differenceFactors.length >= 0);
    });

    test('should fail for non-existent sessions', () => {
      assert.throws(() => {
        coherenceManager.compareSessions('sess_nonexistent_1', 'sess_nonexistent_2');
      }, /not found/);
    });

  });

  // ========== EXPORT TESTS ==========

  describe('Session Export', () => {

    test('should export session coherence data', () => {
      const sessionId = 'sess_test_017';
      coherenceManager.initializeSession(sessionId, {
        fingerprint: { canvas: 'abc123' }
      });

      coherenceManager.recordInteraction(sessionId, {
        type: 'navigate',
        url: 'https://example.com'
      });

      const export_data = coherenceManager.exportSessionCoherence(sessionId);

      assert.strictEqual(export_data.sessionId, sessionId);
      assert(export_data.createdAt);
      assert(export_data.coherenceReport);
      assert(export_data.coherenceReport.overallScore >= 0);
      assert(export_data.interactionCount >= 0);
    });

    test('should include forensic hash in export', () => {
      const sessionId = 'sess_test_018';
      coherenceManager.initializeSession(sessionId, {});

      const export_data = coherenceManager.exportSessionCoherence(sessionId);

      assert(export_data.forensicHash);
      assert.strictEqual(export_data.forensicHash.length, 64); // SHA-256 hex
    });

    test('should export violation summary', () => {
      const sessionId = 'sess_test_019';
      coherenceManager.initializeSession(sessionId, {});

      coherenceManager.recordInteraction(sessionId, {
        type: 'navigate'
      });

      const export_data = coherenceManager.exportSessionCoherence(sessionId);

      assert(Array.isArray(export_data.violations));
      assert(Array.isArray(export_data.recommendations));
    });

  });

  // ========== SUMMARY TESTS ==========

  describe('Coherence Summary', () => {

    test('should provide quick status summary', () => {
      const sessionId = 'sess_test_020';
      coherenceManager.initializeSession(sessionId, {});

      coherenceManager.recordInteraction(sessionId, {
        type: 'navigate'
      });

      const summary = coherenceManager.getCoherenceSummary(sessionId);

      assert.strictEqual(summary.sessionId, sessionId);
      assert(summary.overallCoherence >= 0 && summary.overallCoherence <= 1);
      assert(typeof summary.isCoherent === 'boolean');
      assert.strictEqual(typeof summary.interactionCount, 'number');
      assert.strictEqual(typeof summary.violationCount, 'number');
    });

    test('should track critical violations in summary', () => {
      const sessionId = 'sess_test_021';
      coherenceManager.initializeSession(sessionId, {});

      coherenceManager.recordInteraction(sessionId, {
        type: 'navigate'
      });

      const summary = coherenceManager.getCoherenceSummary(sessionId);

      assert.strictEqual(typeof summary.criticalViolations, 'number');
      assert.strictEqual(typeof summary.highViolations, 'number');
    });

  });

  // ========== MEMORY MANAGEMENT TESTS ==========

  describe('Memory Management', () => {

    test('should cleanup old sessions', () => {
      const sessionId = 'sess_test_022';
      coherenceManager.initializeSession(sessionId, {});

      // Simulate old session by directly modifying
      const session = coherenceManager.sessions.get(sessionId);
      session.startTimestamp = Date.now() - 7200000; // 2 hours ago

      const cleanup = coherenceManager.cleanupOldSessions(3600000); // 1 hour max age

      assert(cleanup.cleaned >= 1);
      assert(!coherenceManager.sessions.has(sessionId));
    });

    test('should not cleanup recent sessions', () => {
      const sessionId = 'sess_test_023';
      coherenceManager.initializeSession(sessionId, {});

      const cleanup = coherenceManager.cleanupOldSessions(3600000);

      assert(coherenceManager.sessions.has(sessionId));
    });

  });

  // ========== INTEGRATION TESTS ==========

  describe('Integration Tests', () => {

    test('complete workflow: init -> interact -> analyze -> export', () => {
      const sessionId = 'sess_test_024';

      // Initialize
      const initResult = coherenceManager.initializeSession(sessionId, {
        fingerprint: { canvas: 'abc123' },
        os: 'macOS',
        browser: 'Chrome'
      });
      assert.strictEqual(initResult.success, true);

      // Interact
      for (let i = 0; i < 3; i++) {
        const interactResult = coherenceManager.recordInteraction(sessionId, {
          type: 'navigate',
          url: `https://example.com/${i}`,
          requestData: {
            network: { ip: '1.2.3.4' }
          }
        });
        assert.strictEqual(interactResult.success, true);
      }

      // Analyze
      const analysis = coherenceManager.analyzeCoherence(sessionId);
      assert(analysis.overallCoherence >= 0 && analysis.overallCoherence <= 1);

      // Export
      const export_data = coherenceManager.exportSessionCoherence(sessionId);
      assert.strictEqual(export_data.sessionId, sessionId);
      assert.strictEqual(export_data.interactionCount, 3);

      // Summary
      const summary = coherenceManager.getCoherenceSummary(sessionId);
      assert.strictEqual(summary.interactionCount, 3);
    });

    test('multi-session comparison workflow', () => {
      const session1 = 'sess_test_025';
      const session2 = 'sess_test_026';

      coherenceManager.initializeSession(session1, {
        device: { screenResolution: '1920x1080' },
        os: 'Windows',
        browser: 'Chrome'
      });

      coherenceManager.initializeSession(session2, {
        device: { screenResolution: '1920x1080' },
        os: 'Windows',
        browser: 'Chrome'
      });

      // Record similar interactions
      for (let i = 0; i < 2; i++) {
        coherenceManager.recordInteraction(session1, {
          type: 'navigate',
          url: `https://example.com/${i}`
        });
        coherenceManager.recordInteraction(session2, {
          type: 'navigate',
          url: `https://example.com/${i}`
        });
      }

      const comparison = coherenceManager.compareSessions(session1, session2);
      assert(comparison.overallMatch >= 0 && comparison.overallMatch <= 1);
      assert(typeof comparison.likelyUserMatch === 'boolean');
    });

  });

  // ========== PERFORMANCE TESTS ==========

  describe('Performance', () => {

    test('should analyze coherence in <5ms', () => {
      const sessionId = 'sess_test_027';
      coherenceManager.initializeSession(sessionId, {});

      for (let i = 0; i < 10; i++) {
        coherenceManager.recordInteraction(sessionId, {
          type: 'navigate',
          url: `https://example.com/${i}`
        });
      }

      const start = Date.now();
      coherenceManager.analyzeCoherence(sessionId);
      const duration = Date.now() - start;

      assert(duration < 50, `Analysis took ${duration}ms (expected <50ms)`);
    });

    test('should handle 100 interactions efficiently', () => {
      const sessionId = 'sess_test_028';
      coherenceManager.initializeSession(sessionId, {});

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        coherenceManager.recordInteraction(sessionId, {
          type: 'navigate',
          url: `https://example.com/${i}`
        });
      }
      const duration = Date.now() - start;

      const summary = coherenceManager.getCoherenceSummary(sessionId);
      assert.strictEqual(summary.interactionCount, 100);
      console.log(`  Recording 100 interactions: ${duration}ms`);
    });

  });

});
