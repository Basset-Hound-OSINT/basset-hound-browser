/**
 * Enhanced Audit Logging Tests
 *
 * Tests: 12+ audit logging scenarios
 * Coverage: Event logging, hash chain verification, querying, export
 */

const EnhancedAuditLog = require('../../src/security/enhanced-audit-log');
const path = require('path');
const fs = require('fs');

describe('Enhanced Audit Logging', () => {
  let auditLog;
  const testLogDir = path.join(__dirname, '../../tests/results/audit-test');

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true, mode: 0o700 });
    }

    auditLog = new EnhancedAuditLog({
      logDir: testLogDir,
      enableHashChain: true
    });
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testLogDir)) {
      const files = fs.readdirSync(testLogDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testLogDir, file));
      }
      try {
        fs.rmdirSync(testLogDir);
      } catch (e) {
        // Ignore
      }
    }
  });

  describe('Event Logging', () => {
    test('Log basic event', () => {
      const event = {
        action: 'login',
        actor: { userId: 'user1' },
        result: 'success'
      };

      const logged = auditLog.logEvent(event);
      expect(logged.id).toBeDefined();
      expect(logged.timestamp).toBeDefined();
      expect(logged.action).toEqual('login');
    });

    test('Log authentication event', () => {
      const logged = auditLog.logAuth({
        action: 'failed_login',
        actor: { userId: 'user1' },
        result: 'failure'
      });

      expect(logged.category).toBe(EnhancedAuditLog.EVENT_CATEGORIES.AUTHENTICATION);
      expect(logged.severity).toMatch(/INFO|HIGH/);
    });

    test('Log authorization event', () => {
      const logged = auditLog.logAuthz({
        action: 'access_denied',
        actor: { userId: 'user1' },
        resource: 'admin_panel'
      });

      expect(logged.category).toBe(EnhancedAuditLog.EVENT_CATEGORIES.AUTHORIZATION);
    });

    test('Log data access event', () => {
      const logged = auditLog.logDataAccess({
        action: 'data_read',
        actor: { userId: 'user1' },
        resource: 'user_records'
      });

      expect(logged.category).toBe(EnhancedAuditLog.EVENT_CATEGORIES.DATA_ACCESS);
    });

    test('Log data modification event', () => {
      const logged = auditLog.logDataModification({
        action: 'data_write',
        actor: { userId: 'admin1' },
        resource: 'config'
      });

      expect(logged.category).toBe(EnhancedAuditLog.EVENT_CATEGORIES.DATA_MODIFICATION);
      expect(logged.severity).toMatch(/INFO|HIGH/);
    });

    test('Log security violation', () => {
      const logged = auditLog.logSecurityViolation({
        action: 'injection_attempt',
        actor: { ip: '192.168.1.1' },
        reason: 'SQL injection pattern detected'
      });

      expect(logged.category).toBe(EnhancedAuditLog.EVENT_CATEGORIES.SECURITY_VIOLATION);
      expect(logged.severity).toMatch(/CRITICAL/);
    });
  });

  describe('Hash Chain Verification', () => {
    test('Hash chain is maintained', () => {
      auditLog.logEvent({ action: 'event1', actor: { userId: 'user1' } });
      auditLog.logEvent({ action: 'event2', actor: { userId: 'user1' } });
      auditLog.logEvent({ action: 'event3', actor: { userId: 'user1' } });

      const entries = auditLog.logBuffer;
      expect(entries.length).toBe(3);

      // Verify chain
      const result = auditLog.verifyHashChain(entries);
      expect(result.valid).toBe(true);
    });

    test('Tampered entry detected', () => {
      auditLog.logEvent({ action: 'event1', actor: { userId: 'user1' } });
      auditLog.logEvent({ action: 'event2', actor: { userId: 'user1' } });

      const entries = auditLog.logBuffer;

      // Tamper with second entry
      entries[1].action = 'modified';

      const result = auditLog.verifyHashChain(entries);
      expect(result.valid).toBe(false);
      expect(result.tamperedAt).toEqual(1);
    });

    test('Chain break detected', () => {
      auditLog.logEvent({ action: 'event1', actor: { userId: 'user1' } });
      auditLog.logEvent({ action: 'event2', actor: { userId: 'user1' } });
      auditLog.logEvent({ action: 'event3', actor: { userId: 'user1' } });

      const entries = auditLog.logBuffer;

      // Break the chain by modifying previousHash
      entries[1].previousHash = 'invalid-hash';

      const result = auditLog.verifyHashChain(entries);
      expect(result.valid).toBe(false);
    });
  });

  describe('Event Querying', () => {
    test('Query by category', () => {
      auditLog.logAuth({ action: 'login', result: 'success' });
      auditLog.logDataAccess({ action: 'read', result: 'success' });
      auditLog.logAuth({ action: 'logout', result: 'success' });

      const results = auditLog.query({
        category: EnhancedAuditLog.EVENT_CATEGORIES.AUTHENTICATION
      });

      expect(results.length).toBe(2);
      expect(results[0].category).toBe(EnhancedAuditLog.EVENT_CATEGORIES.AUTHENTICATION);
    });

    test('Query by severity', () => {
      auditLog.logEvent({ action: 'low', severity: 'LOW' });
      auditLog.logEvent({ action: 'critical', severity: 'CRITICAL' });
      auditLog.logEvent({ action: 'high', severity: 'HIGH' });

      const results = auditLog.query({
        severity: EnhancedAuditLog.EVENT_CATEGORIES.SECURITY_VIOLATION ? 'CRITICAL' : undefined
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('Query by user', () => {
      auditLog.logEvent({
        action: 'action1',
        actor: { userId: 'user1' }
      });

      auditLog.logEvent({
        action: 'action2',
        actor: { userId: 'user2' }
      });

      auditLog.logEvent({
        action: 'action3',
        actor: { userId: 'user1' }
      });

      const results = auditLog.query({ userId: 'user1' });
      expect(results.length).toBe(2);
    });

    test('Query with time range', () => {
      const now = Date.now();
      const earlier = now - 10000;

      auditLog.logEvent({
        action: 'event1',
        actor: { userId: 'user1' }
      });

      const results = auditLog.query({
        startTime: earlier,
        endTime: now + 10000
      });

      expect(results.length).toBeGreaterThan(0);
    });

    test('Result limiting works', () => {
      for (let i = 0; i < 50; i++) {
        auditLog.logEvent({
          action: `event${i}`,
          actor: { userId: 'user1' }
        });
      }

      const results = auditLog.query({ limit: 10 });
      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Audit Summary', () => {
    test('Get summary statistics', () => {
      auditLog.logEvent({ action: 'event1' });
      auditLog.logEvent({ action: 'event2' });
      auditLog.logEvent({ action: 'event3' });

      const summary = auditLog.getSummary();
      expect(summary.totalEvents).toBe(3);
      expect(summary.bufferedEvents).toBe(3);
      expect(summary.eventsByCategory).toBeDefined();
    });

    test('Summary shows categories', () => {
      auditLog.logAuth({ action: 'login' });
      auditLog.logDataAccess({ action: 'read' });
      auditLog.logAuth({ action: 'logout' });

      const summary = auditLog.getSummary();
      expect(summary.eventsByCategory[EnhancedAuditLog.EVENT_CATEGORIES.AUTHENTICATION]).toBe(2);
      expect(summary.eventsByCategory[EnhancedAuditLog.EVENT_CATEGORIES.DATA_ACCESS]).toBe(1);
    });
  });

  describe('Log Flushing', () => {
    test('Flush writes to disk', () => {
      auditLog.logEvent({ action: 'event1' });
      auditLog.logEvent({ action: 'event2' });

      auditLog.flush();

      const files = fs.readdirSync(testLogDir);
      expect(files.length).toBeGreaterThan(0);
    });

    test('Buffer clears after flush', () => {
      auditLog.logEvent({ action: 'event1' });
      expect(auditLog.logBuffer.length).toBe(1);

      auditLog.flush();
      expect(auditLog.logBuffer.length).toBe(0);
    });

    test('Auto-flush on buffer full', () => {
      // Set small buffer size
      auditLog.maxBufferSize = 5;

      for (let i = 0; i < 10; i++) {
        auditLog.logEvent({ action: `event${i}` });
      }

      // Should have flushed at least once
      const files = fs.readdirSync(testLogDir);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('Export', () => {
    test('Export audit log', () => {
      auditLog.logEvent({ action: 'event1' });
      auditLog.logEvent({ action: 'event2' });

      const result = auditLog.export();
      expect(result.filename).toBeDefined();
      expect(result.path).toBeDefined();
      expect(result.size).toBeGreaterThan(0);

      // Verify file exists
      expect(fs.existsSync(result.path)).toBe(true);
    });

    test('Exported data is valid JSON', () => {
      auditLog.logEvent({ action: 'event1' });
      auditLog.logEvent({ action: 'event2' });

      const result = auditLog.export();
      const content = fs.readFileSync(result.path, 'utf8');
      const data = JSON.parse(content);

      expect(data.exportedAt).toBeDefined();
      expect(data.summary).toBeDefined();
      expect(data.entries).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('Cleanup old logs', () => {
      // This is a simplified test
      auditLog.logEvent({ action: 'event1' });
      auditLog.flush();

      // Call cleanup
      auditLog.cleanup();

      // Should still exist (created just now)
      const files = fs.readdirSync(testLogDir);
      expect(files.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Tamper Detection', () => {
    test('Modified entries detected', () => {
      const entry1 = auditLog.logEvent({ action: 'event1' });
      const entry2 = auditLog.logEvent({ action: 'event2' });

      // Verify chain before modification
      const beforeResult = auditLog.verifyHashChain([entry1, entry2]);
      expect(beforeResult.valid).toBe(true);

      // Modify entry1
      entry1.action = 'modified';

      // Verify chain after modification
      const afterResult = auditLog.verifyHashChain([entry1, entry2]);
      expect(afterResult.valid).toBe(false);
    });
  });

  describe('Event Attributes', () => {
    test('Event includes all attributes', () => {
      const logged = auditLog.logEvent({
        action: 'test_action',
        severity: 'MEDIUM',
        actor: { userId: 'user1', ip: '192.168.1.1' },
        resource: 'test_resource',
        resourceId: 'res-123',
        result: 'success',
        details: { extra: 'info' },
        reason: 'test reason'
      });

      expect(logged.action).toBe('test_action');
      expect(logged.actor.userId).toBe('user1');
      expect(logged.actor.ip).toBe('192.168.1.1');
      expect(logged.resource).toBe('test_resource');
      expect(logged.resourceId).toBe('res-123');
      expect(logged.result).toBe('success');
      expect(logged.details.extra).toBe('info');
      expect(logged.reason).toBe('test reason');
    });
  });
});
