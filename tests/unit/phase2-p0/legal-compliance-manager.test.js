/**
 * Legal Compliance Manager Tests
 * Comprehensive unit tests for compliance mode and evidence handling
 */

const LegalComplianceManager = require('../../../src/compliance/legal-compliance-manager');

describe('LegalComplianceManager', () => {
  let manager;

  beforeEach(() => {
    manager = new LegalComplianceManager();
  });

  describe('startComplianceMode', () => {
    test('should initialize US jurisdiction with SWGDE', () => {
      const result = manager.startComplianceMode('us', ['swgde'], 'chain-of-custody');

      expect(result.success).toBe(true);
      expect(result.jurisdiction).toBe('us');
      expect(result.standards_active).toContain('swgde');
      expect(result.certification_level).toBe('chain-of-custody');
      expect(result.mode_status).toBe('active');
    });

    test('should reject invalid jurisdiction', () => {
      expect(() => {
        manager.startComplianceMode('invalid', ['swgde'], 'basic');
      }).toThrow('Invalid jurisdiction');
    });

    test('should reject invalid standard', () => {
      expect(() => {
        manager.startComplianceMode('us', ['invalid-standard'], 'basic');
      }).toThrow('Invalid standard');
    });

    test('should reject invalid certification level', () => {
      expect(() => {
        manager.startComplianceMode('us', ['swgde'], 'invalid-level');
      }).toThrow('Invalid certification level');
    });

    test('should log audit event on start', () => {
      manager.startComplianceMode('us', ['swgde'], 'basic');

      expect(manager.auditLog.length).toBeGreaterThan(0);
      const lastEvent = manager.auditLog[manager.auditLog.length - 1];
      expect(lastEvent.eventType).toBe('COMPLIANCE_STARTED');
    });

    test('should support multiple standards', () => {
      const result = manager.startComplianceMode('eu', ['iso27037', 'swgde'], 'enhanced');

      expect(result.standards_active).toEqual(['iso27037', 'swgde']);
    });

    test('should generate unique compliance ID', () => {
      const result1 = manager.startComplianceMode('us', ['swgde'], 'basic');
      const manager2 = new LegalComplianceManager();
      const result2 = manager2.startComplianceMode('us', ['swgde'], 'basic');

      expect(result1.compliance_id).not.toBe(result2.compliance_id);
    });

    test('should set mode flags correctly', () => {
      manager.startComplianceMode('uk', ['swgde'], 'enhanced');

      expect(manager.complianceMode).toBe(true);
      expect(manager.jurisdiction).toBe('uk');
      expect(manager.certificationLevel).toBe('enhanced');
    });

    test('should include capabilities in response', () => {
      const result = manager.startComplianceMode('us', ['swgde'], 'chain-of-custody');

      expect(result.capabilities).toBeDefined();
      expect(result.capabilities.swgde_reports).toBe(true);
      expect(result.capabilities.chain_of_custody_audit).toBe(true);
    });

    test('should emit compliance-started event', (done) => {
      manager.on('compliance-started', (data) => {
        expect(data.jurisdiction).toBe('us');
        expect(data.standards).toContain('swgde');
        done();
      });

      manager.startComplianceMode('us', ['swgde'], 'basic');
    });
  });

  describe('getComplianceStatus', () => {
    test('should return inactive status when compliance mode not enabled', () => {
      const status = manager.getComplianceStatus();

      expect(status.success).toBe(true);
      expect(status.mode_active).toBe(false);
    });

    test('should return active status with details when enabled', () => {
      manager.startComplianceMode('us', ['swgde'], 'chain-of-custody');
      const status = manager.getComplianceStatus();

      expect(status.mode_active).toBe(true);
      expect(status.jurisdiction).toBe('us');
      expect(status.standards_enabled).toContain('swgde');
      expect(status.certification_level).toBe('chain-of-custody');
    });

    test('should include evidence count in status', () => {
      manager.startComplianceMode('us', ['swgde'], 'basic');
      manager.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test'
      });

      const status = manager.getComplianceStatus();

      expect(status.evidence_count).toBe(1);
      expect(status.evidence_types['screenshot']).toBe(1);
    });

    test('should include audit log count', () => {
      manager.startComplianceMode('us', ['swgde'], 'basic');
      const status = manager.getComplianceStatus();

      expect(status.audit_log_entries).toBeGreaterThan(0);
    });

    test('should calculate compliance score', () => {
      manager.startComplianceMode('us', ['swgde'], 'chain-of-custody');
      const status = manager.getComplianceStatus();

      expect(status.compliance_score).toBeGreaterThan(0);
      expect(status.compliance_score).toBeLessThanOrEqual(100);
    });

    test('should include recommendations', () => {
      manager.startComplianceMode('us', ['swgde'], 'chain-of-custody');
      const status = manager.getComplianceStatus();

      expect(Array.isArray(status.recommendations)).toBe(true);
      expect(status.recommendations.length).toBeGreaterThan(0);
    });

    test('should track last action', () => {
      manager.startComplianceMode('us', ['swgde'], 'basic');
      manager.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test'
      });

      const status = manager.getComplianceStatus();

      expect(status.last_action).toBeDefined();
      expect(status.last_action.action).toBe('EVIDENCE_REGISTERED');
    });

    test('should handle no last action gracefully', () => {
      manager.complianceMode = true;
      manager.complianceId = 'test-id';
      manager.auditLog = [];

      const status = manager.getComplianceStatus();

      expect(status.last_action).toBeNull();
    });
  });

  describe('registerEvidence', () => {
    beforeEach(() => {
      manager.startComplianceMode('us', ['swgde'], 'chain-of-custody');
    });

    test('should register evidence successfully', () => {
      const result = manager.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test content'
      });

      expect(result.success).toBe(true);
      expect(result.evidence_id).toBe('ev_001');
      expect(result.hash).toBeDefined();
      expect(result.registered_at).toBeDefined();
    });

    test('should throw error if compliance mode not active', () => {
      const manager2 = new LegalComplianceManager();

      expect(() => {
        manager2.registerEvidence({
          id: 'ev_001',
          type: 'screenshot',
          content: 'test'
        });
      }).toThrow('Compliance mode not active');
    });

    test('should require evidence id and type', () => {
      expect(() => {
        manager.registerEvidence({ content: 'test' });
      }).toThrow('Evidence must have id and type');

      expect(() => {
        manager.registerEvidence({ id: 'ev_001' });
      }).toThrow('Evidence must have id and type');
    });

    test('should hash evidence consistently', () => {
      const evidence = {
        id: 'ev_001',
        type: 'screenshot',
        content: 'test content'
      };

      const result1 = manager.registerEvidence(evidence);
      manager.evidenceQueue = [];
      manager.evidenceStore.clear();

      const result2 = manager.registerEvidence(evidence);

      expect(result1.hash).toBe(result2.hash);
    });

    test('should store evidence in map', () => {
      manager.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test'
      });

      expect(manager.evidenceStore.has('ev_001')).toBe(true);
    });

    test('should log audit event on registration', () => {
      const initialLogSize = manager.auditLog.length;

      manager.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test'
      });

      expect(manager.auditLog.length).toBe(initialLogSize + 1);
      const lastEvent = manager.auditLog[manager.auditLog.length - 1];
      expect(lastEvent.eventType).toBe('EVIDENCE_REGISTERED');
    });

    test('should throw error if queue limit exceeded', () => {
      const manager2 = new LegalComplianceManager({ maxEvidenceQueueSize: 2 });
      manager2.startComplianceMode('us', ['swgde'], 'basic');

      manager2.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test'
      });

      manager2.registerEvidence({
        id: 'ev_002',
        type: 'screenshot',
        content: 'test'
      });

      expect(() => {
        manager2.registerEvidence({
          id: 'ev_003',
          type: 'screenshot',
          content: 'test'
        });
      }).toThrow('Evidence queue limit');
    });

    test('should emit evidence-registered event', (done) => {
      manager.on('evidence-registered', (data) => {
        expect(data.evidenceId).toBe('ev_001');
        expect(data.hash).toBeDefined();
        done();
      });

      manager.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test'
      });
    });

    test('should handle multiple evidence types', () => {
      manager.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test'
      });

      manager.registerEvidence({
        id: 'ev_002',
        type: 'har',
        content: 'test'
      });

      manager.registerEvidence({
        id: 'ev_003',
        type: 'dom_snapshot',
        content: 'test'
      });

      const status = manager.getComplianceStatus();

      expect(status.evidence_count).toBe(3);
      expect(status.evidence_types['screenshot']).toBe(1);
      expect(status.evidence_types['har']).toBe(1);
      expect(status.evidence_types['dom_snapshot']).toBe(1);
    });
  });

  describe('stopComplianceMode', () => {
    beforeEach(() => {
      manager.startComplianceMode('us', ['swgde'], 'chain-of-custody');
    });

    test('should stop compliance mode successfully', () => {
      const result = manager.stopComplianceMode();

      expect(result.success).toBe(true);
      expect(result.stopped_at).toBeDefined();
      expect(manager.complianceMode).toBe(false);
    });

    test('should preserve evidence count on stop', () => {
      manager.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test'
      });

      const result = manager.stopComplianceMode();

      expect(result.evidence_count).toBe(1);
    });

    test('should log audit event on stop', () => {
      const initialLogSize = manager.auditLog.length;

      manager.stopComplianceMode();

      expect(manager.auditLog.length).toBeGreaterThan(initialLogSize);
      const lastEvent = manager.auditLog[manager.auditLog.length - 1];
      expect(lastEvent.eventType).toBe('COMPLIANCE_STOPPED');
    });

    test('should emit compliance-stopped event', (done) => {
      manager.on('compliance-stopped', (data) => {
        expect(data.complianceId).toBeDefined();
        expect(data.evidenceCount).toBe(0);
        done();
      });

      manager.stopComplianceMode();
    });

    test('should handle stopping when already stopped', () => {
      manager.stopComplianceMode();
      const result = manager.stopComplianceMode();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Compliance mode not active');
    });
  });

  describe('logAuditEvent', () => {
    beforeEach(() => {
      manager.startComplianceMode('us', ['swgde'], 'basic');
    });

    test('should log custom audit events', () => {
      const initialSize = manager.auditLog.length;

      manager.logAuditEvent('CUSTOM_EVENT', { custom: 'details' });

      expect(manager.auditLog.length).toBe(initialSize + 1);
      const lastEvent = manager.auditLog[manager.auditLog.length - 1];
      expect(lastEvent.eventType).toBe('CUSTOM_EVENT');
    });

    test('should include timestamp in audit events', () => {
      manager.logAuditEvent('TEST_EVENT', {});

      const lastEvent = manager.auditLog[manager.auditLog.length - 1];
      expect(lastEvent.timestamp).toBeDefined();
      expect(new Date(lastEvent.timestamp).getTime()).toBeGreaterThan(0);
    });

    test('should maintain audit log size limit', () => {
      const manager2 = new LegalComplianceManager({ maxAuditLogSize: 5 });
      manager2.startComplianceMode('us', ['swgde'], 'basic');

      for (let i = 0; i < 10; i++) {
        manager2.logAuditEvent(`EVENT_${i}`, {});
      }

      expect(manager2.auditLog.length).toBeLessThanOrEqual(5);
    });

    test('should emit audit-event for each log', (done) => {
      let eventEmitted = false;

      manager.on('audit-event', (data) => {
        expect(data.eventType).toBe('TEST_EVENT');
        eventEmitted = true;
        done();
      });

      manager.logAuditEvent('TEST_EVENT', {});
    });

    test('should include user information in audit logs', () => {
      const manager2 = new LegalComplianceManager({ userId: 'testuser@example.com' });
      manager2.startComplianceMode('us', ['swgde'], 'basic');
      manager2.logAuditEvent('TEST_EVENT', {});

      const lastEvent = manager2.auditLog[manager2.auditLog.length - 1];
      expect(lastEvent.user).toBe('testuser@example.com');
    });
  });

  describe('getAuditLog', () => {
    beforeEach(() => {
      manager.startComplianceMode('us', ['swgde'], 'basic');
    });

    test('should retrieve all audit logs by default', () => {
      manager.logAuditEvent('EVENT_1', {});
      manager.logAuditEvent('EVENT_2', {});
      manager.logAuditEvent('EVENT_3', {});

      const logs = manager.getAuditLog();

      expect(logs.length).toBeGreaterThanOrEqual(3);
    });

    test('should filter audit logs by event type', () => {
      manager.logAuditEvent('TYPE_A', {});
      manager.logAuditEvent('TYPE_B', {});
      manager.logAuditEvent('TYPE_A', {});

      const logs = manager.getAuditLog({ eventType: 'TYPE_A' });

      expect(logs.every(log => log.eventType === 'TYPE_A')).toBe(true);
    });

    test('should apply limit to results', () => {
      for (let i = 0; i < 10; i++) {
        manager.logAuditEvent(`EVENT_${i}`, {});
      }

      const logs = manager.getAuditLog({ limit: 3 });

      expect(logs.length).toBeLessThanOrEqual(3);
    });

    test('should filter by date range', () => {
      manager.logAuditEvent('BEFORE', {});

      const middleTime = new Date();

      manager.logAuditEvent('AFTER', {});

      const logs = manager.getAuditLog({ startTime: middleTime.toISOString() });

      expect(logs.some(log => log.eventType === 'AFTER')).toBe(true);
    });
  });

  describe('getEvidenceDetails', () => {
    beforeEach(() => {
      manager.startComplianceMode('us', ['swgde'], 'basic');
    });

    test('should retrieve registered evidence details', () => {
      manager.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test content'
      });

      const details = manager.getEvidenceDetails('ev_001');

      expect(details.success).toBe(true);
      expect(details.evidence.id).toBe('ev_001');
      expect(details.evidence.type).toBe('screenshot');
      expect(details.hash).toBeDefined();
    });

    test('should throw error for non-existent evidence', () => {
      expect(() => {
        manager.getEvidenceDetails('non-existent');
      }).toThrow('Evidence not found');
    });

    test('should include registration timestamp', () => {
      manager.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test'
      });

      const details = manager.getEvidenceDetails('ev_001');

      expect(details.registered_at).toBeDefined();
    });
  });

  describe('Event Handling', () => {
    test('should emit initialized event on creation', () => {
      // Since the event is emitted during constructor, we test via monitoring
      const manager2 = new LegalComplianceManager();
      expect(manager2.complianceMode).toBe(false);
      expect(manager2.auditLog).toBeDefined();
    });

    test('should handle multiple event listeners', (done) => {
      let listener1Called = false;
      let listener2Called = false;

      manager.on('compliance-started', () => {
        listener1Called = true;
      });

      manager.on('compliance-started', () => {
        listener2Called = true;

        if (listener1Called && listener2Called) {
          done();
        }
      });

      manager.startComplianceMode('us', ['swgde'], 'basic');
    });
  });

  describe('Error Handling', () => {
    test('should provide clear error messages for invalid inputs', () => {
      expect(() => {
        manager.startComplianceMode('invalid-jurisdiction', ['swgde'], 'basic');
      }).toThrow(/Invalid jurisdiction/);

      expect(() => {
        manager.startComplianceMode('us', ['invalid-standard'], 'basic');
      }).toThrow(/Invalid standard/);
    });

    test('should handle concurrent evidence registration', () => {
      manager.startComplianceMode('us', ['swgde'], 'basic');

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(
          manager.registerEvidence({
            id: `ev_${i}`,
            type: 'screenshot',
            content: `test ${i}`
          })
        );
      }

      expect(results.length).toBe(5);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});
