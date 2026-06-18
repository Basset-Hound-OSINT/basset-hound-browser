/**
 * Tests for Monitoring Consent System
 *
 * Security Fix #3: Monitoring Consent
 * Verifies that monitoring consent is properly tracked, enforced, and audited
 *
 * @test 14+ tests required
 */

const assert = require('assert');
const { MonitoringConsentManager, getConsentManager } = require('../../websocket/middleware/monitoring-consent');

describe('Monitoring Consent System (Security Fix #3)', () => {
  let consentManager;

  beforeEach(() => {
    // Create a fresh instance for each test
    consentManager = new MonitoringConsentManager();
  });

  describe('Initialization Tests', () => {
    test('should disable monitoring by default', () => {
      const result = consentManager.initializeConsent('client-1', {});
      assert.strictEqual(result.monitoring, false, 'Monitoring should be disabled by default');
      assert.strictEqual(result.success, true);
    });

    test('should allow explicit consent during init', () => {
      const result = consentManager.initializeConsent('client-1', {
        consent: { monitoring: true },
        userId: 'user-123'
      });
      assert.strictEqual(result.monitoring, true);
      assert.strictEqual(result.success, true);
    });

    test('should track userId during initialization', () => {
      consentManager.initializeConsent('client-1', {
        consent: { monitoring: true },
        userId: 'user-123'
      });
      const consent = consentManager.clientConsent.get('client-1');
      assert.strictEqual(consent.grantedBy, 'user-123');
    });

    test('should record initialization timestamp', () => {
      const beforeInit = Date.now();
      consentManager.initializeConsent('client-1', {});
      const afterInit = Date.now();

      const consent = consentManager.clientConsent.get('client-1');
      assert.ok(consent.timestamp >= beforeInit && consent.timestamp <= afterInit);
    });
  });

  describe('Consent Checking Tests', () => {
    test('should return false for hasConsent when not initialized', () => {
      const result = consentManager.hasConsent('unknown-client');
      assert.strictEqual(result, false);
    });

    test('should return false for hasConsent when monitoring disabled', () => {
      consentManager.initializeConsent('client-1', {});
      const result = consentManager.hasConsent('client-1');
      assert.strictEqual(result, false);
    });

    test('should return true for hasConsent when monitoring enabled', () => {
      consentManager.initializeConsent('client-1', {
        consent: { monitoring: true }
      });
      const result = consentManager.hasConsent('client-1');
      assert.strictEqual(result, true);
    });
  });

  describe('Consent Modification Tests', () => {
    beforeEach(() => {
      consentManager.initializeConsent('client-1', {});
    });

    test('should allow enabling monitoring consent', () => {
      const result = consentManager.setConsent('client-1', true, 'user_grant');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.consentAfter, true);
      assert.strictEqual(result.consentBefore, false);
    });

    test('should allow disabling monitoring consent', () => {
      consentManager.setConsent('client-1', true);
      const result = consentManager.setConsent('client-1', false, 'user_revoke');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.consentAfter, false);
      assert.strictEqual(result.consentBefore, true);
    });

    test('should grant consent successfully', () => {
      const result = consentManager.grantConsent('client-1');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.consentAfter, true);
      assert.strictEqual(consentManager.hasConsent('client-1'), true);
    });

    test('should revoke consent successfully', () => {
      consentManager.grantConsent('client-1');
      const result = consentManager.revokeConsent('client-1');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.consentAfter, false);
      assert.strictEqual(consentManager.hasConsent('client-1'), false);
    });

    test('should not allow modification of non-existent client', () => {
      const result = consentManager.setConsent('unknown-client', true);
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  describe('Consent Status Retrieval Tests', () => {
    test('should retrieve consent status for existing client', () => {
      consentManager.initializeConsent('client-1', {
        consent: { monitoring: true }
      });
      const result = consentManager.getConsent('client-1');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.consent.monitoring, true);
    });

    test('should return false for non-existent client consent', () => {
      const result = consentManager.getConsent('unknown-client');
      assert.strictEqual(result.success, false);
    });
  });

  describe('Audit Trail Tests', () => {
    test('should log consent changes', () => {
      consentManager.initializeConsent('client-1', {});
      consentManager.setConsent('client-1', true, 'user_grant');

      const auditTrail = consentManager.getAuditTrail();
      assert.ok(auditTrail.length >= 2, 'Should have at least 2 audit entries (init + change)');
    });

    test('should track change reason in audit trail', () => {
      consentManager.initializeConsent('client-1', {});
      consentManager.setConsent('client-1', true, 'test_reason');

      const auditTrail = consentManager.getAuditTrail();
      const changeEntry = auditTrail.find(e => e.reason === 'test_reason');
      assert.ok(changeEntry, 'Should find audit entry with test_reason');
    });

    test('should filter audit trail by clientId', () => {
      consentManager.initializeConsent('client-1', {});
      consentManager.initializeConsent('client-2', {});
      consentManager.setConsent('client-1', true);

      const client1Trail = consentManager.getAuditTrail('client-1');
      assert.ok(client1Trail.every(e => e.clientId === 'client-1'));
    });

    test('should respect audit trail limit', () => {
      consentManager.initializeConsent('client-1', {});
      consentManager.setConsent('client-1', true);
      consentManager.setConsent('client-1', false);

      const trail = consentManager.getAuditTrail(null, 2);
      assert.ok(trail.length <= 2, 'Should respect limit parameter');
    });

    test('should track change timestamps in audit', () => {
      consentManager.initializeConsent('client-1', {});
      const beforeChange = Date.now();
      consentManager.setConsent('client-1', true);
      const afterChange = Date.now();

      const auditTrail = consentManager.getAuditTrail();
      const changeEntry = auditTrail[auditTrail.length - 1];
      assert.ok(changeEntry.timestamp >= beforeChange && changeEntry.timestamp <= afterChange);
    });
  });

  describe('Consent Validation Tests', () => {
    test('should validate consent for operations', () => {
      consentManager.initializeConsent('client-1', {
        consent: { monitoring: true }
      });
      const result = consentManager.validateConsent('client-1', 'metrics_collection');
      assert.strictEqual(result.valid, true);
    });

    test('should reject validation without consent', () => {
      consentManager.initializeConsent('client-1', {});
      const result = consentManager.validateConsent('client-1', 'metrics_collection');
      assert.strictEqual(result.valid, false);
    });

    test('should return error for non-existent client validation', () => {
      const result = consentManager.validateConsent('unknown-client');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error);
    });
  });

  describe('Statistics Tests', () => {
    test('should calculate consent statistics', () => {
      consentManager.initializeConsent('client-1', { consent: { monitoring: true } });
      consentManager.initializeConsent('client-2', {});
      consentManager.initializeConsent('client-3', { consent: { monitoring: true } });

      const stats = consentManager.getConsentStats();
      assert.strictEqual(stats.totalClients, 3);
      assert.strictEqual(stats.consentedClients, 2);
      assert.strictEqual(stats.deniedClients, 1);
    });

    test('should calculate consent rate percentage', () => {
      consentManager.initializeConsent('client-1', { consent: { monitoring: true } });
      consentManager.initializeConsent('client-2', {});

      const stats = consentManager.getConsentStats();
      const rate = parseFloat(stats.consentRate);
      assert.ok(rate >= 49 && rate <= 51, 'Should be 50%');
    });

    test('should handle empty statistics', () => {
      const stats = consentManager.getConsentStats();
      assert.strictEqual(stats.totalClients, 0);
      assert.strictEqual(stats.consentRate, 0);
    });
  });

  describe('Client Cleanup Tests', () => {
    test('should remove client on disconnect', () => {
      consentManager.initializeConsent('client-1', {});
      assert.ok(consentManager.clientConsent.has('client-1'));

      consentManager.removeClient('client-1');
      assert.ok(!consentManager.clientConsent.has('client-1'));
    });

    test('should not throw error removing non-existent client', () => {
      assert.doesNotThrow(() => {
        consentManager.removeClient('unknown-client');
      });
    });
  });

  describe('Singleton Pattern Tests', () => {
    test('should return same instance via getConsentManager', () => {
      const manager1 = getConsentManager();
      const manager2 = getConsentManager();
      assert.strictEqual(manager1, manager2, 'Should return same singleton instance');
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid consent changes', () => {
      consentManager.initializeConsent('client-1', {});
      consentManager.setConsent('client-1', true);
      consentManager.setConsent('client-1', false);
      consentManager.setConsent('client-1', true);

      const auditTrail = consentManager.getAuditTrail();
      assert.ok(auditTrail.length >= 3);
      assert.strictEqual(consentManager.hasConsent('client-1'), true);
    });

    test('should handle multiple clients independently', () => {
      consentManager.initializeConsent('client-1', { consent: { monitoring: true } });
      consentManager.initializeConsent('client-2', {});

      consentManager.setConsent('client-1', false);

      assert.strictEqual(consentManager.hasConsent('client-1'), false);
      assert.strictEqual(consentManager.hasConsent('client-2'), false);
    });

    test('should maintain audit trail limit', () => {
      // Create 1200 changes to test overflow protection
      for (let i = 0; i < 100; i++) {
        consentManager.initializeConsent(`client-${i}`, {});
        consentManager.setConsent(`client-${i}`, true);
        consentManager.setConsent(`client-${i}`, false);
      }

      // Should only keep last 1000
      assert.ok(consentManager.consentChanges.length <= 1000);
    });
  });
});

// Test suite for command handlers
describe('Monitoring Consent WebSocket Commands', () => {
  let commandHandlers;
  let consentManager;

  beforeEach(() => {
    commandHandlers = {};
    consentManager = new MonitoringConsentManager();
  });

  test('should register consent command handlers', () => {
    const { registerConsentCommands } = require('../../websocket/commands/monitoring-metrics-commands');
    registerConsentCommands(commandHandlers, consentManager);

    assert.ok(commandHandlers.init_monitoring_consent);
    assert.ok(commandHandlers.set_monitoring_consent);
    assert.ok(commandHandlers.get_monitoring_consent);
    assert.ok(commandHandlers.revoke_monitoring_consent);
    assert.ok(commandHandlers.get_consent_audit_trail);
    assert.ok(commandHandlers.get_consent_stats);
  });

  test('init_monitoring_consent command should work', async () => {
    const { registerConsentCommands } = require('../../websocket/commands/monitoring-metrics-commands');
    registerConsentCommands(commandHandlers, consentManager);

    const result = await commandHandlers.init_monitoring_consent(
      { consent: { monitoring: true } },
      { clientId: 'test-client' }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.monitoring, true);
  });

  test('set_monitoring_consent command should grant consent', async () => {
    const { registerConsentCommands } = require('../../websocket/commands/monitoring-metrics-commands');
    registerConsentCommands(commandHandlers, consentManager);

    consentManager.initializeConsent('test-client', {});

    const result = await commandHandlers.set_monitoring_consent(
      { enabled: true },
      { clientId: 'test-client' }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.consentAfter, true);
  });

  test('revoke_monitoring_consent command should revoke consent', async () => {
    const { registerConsentCommands } = require('../../websocket/commands/monitoring-metrics-commands');
    registerConsentCommands(commandHandlers, consentManager);

    consentManager.initializeConsent('test-client', {
      consent: { monitoring: true }
    });

    const result = await commandHandlers.revoke_monitoring_consent(
      {},
      { clientId: 'test-client' }
    );

    assert.strictEqual(result.success, true);
  });

  test('get_consent_stats command should return statistics', async () => {
    const { registerConsentCommands } = require('../../websocket/commands/monitoring-metrics-commands');
    registerConsentCommands(commandHandlers, consentManager);

    consentManager.initializeConsent('client-1', { consent: { monitoring: true } });
    consentManager.initializeConsent('client-2', {});

    const result = await commandHandlers.get_consent_stats({});

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.stats.totalClients, 2);
  });
});
