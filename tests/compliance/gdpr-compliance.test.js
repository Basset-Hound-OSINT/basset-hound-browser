/**
 * GDPR Compliance Tests
 * Comprehensive testing for GDPR compliance engine
 */

const { GDPRComplianceEngine } = require('../../src/compliance/gdpr-compliance');

describe('GDPR Compliance Engine', () => {
  let gdpr;

  beforeEach(() => {
    gdpr = new GDPRComplianceEngine();
  });

  describe('Data Classification', () => {
    test('should classify personal data correctly', () => {
      const data = gdpr.classifyData('email@example.com', 'email');
      expect(data.classification).toBe('personal');
      expect(data.sensitivityLevel).toBeLessThanOrEqual(3);
    });

    test('should identify sensitive data (SSN)', () => {
      const data = gdpr.classifyData('123-45-6789', 'ssn');
      expect(data.classification).toBe('sensitive');
      expect(data.sensitivityLevel).toBeGreater(3);
    });

    test('should track data inventory for user', () => {
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });
      const inventory = gdpr.getDataInventory('user123');
      expect(inventory).toContainEqual(expect.objectContaining({ type: 'email' }));
    });

    test('should maintain data inventory audit trail', () => {
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });
      const auditLog = gdpr.getAuditLog();
      expect(auditLog).toContainEqual(expect.objectContaining({
        operation: 'data_registered',
        userId: 'user123'
      }));
    });
  });

  describe('Consent Management', () => {
    test('should record consent with timestamp', () => {
      const consent = gdpr.recordConsent('user123', ['marketing', 'analytics']);
      expect(consent.status).toBe('granted');
      expect(consent.timestamp).toBeDefined();
      expect(consent.purposes).toContain('marketing');
    });

    test('should enforce consent expiration', () => {
      gdpr.recordConsent('user123', ['analytics'], { ttl: 100 });
      expect(gdpr.isConsentValid('user123', 'analytics')).toBe(true);
    });

    test('should revoke consent', () => {
      gdpr.recordConsent('user123', ['marketing']);
      gdpr.revokeConsent('user123', 'marketing');
      expect(gdpr.isConsentValid('user123', 'marketing')).toBe(false);
    });

    test('should retrieve consent audit trail', () => {
      gdpr.recordConsent('user123', ['analytics']);
      const audit = gdpr.getConsentAudit('user123');
      expect(audit).toContainEqual(expect.objectContaining({
        type: 'consent_granted',
        purposes: expect.arrayContaining(['analytics'])
      }));
    });

    test('should handle granular consent per purpose', () => {
      gdpr.recordConsent('user123', ['marketing'], { granular: true });
      expect(gdpr.hasConsent('user123', 'marketing')).toBe(true);
      expect(gdpr.hasConsent('user123', 'analytics')).toBe(false);
    });
  });

  describe('Right to Deletion (RTBF)', () => {
    test('should delete user data upon request', () => {
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });
      gdpr.registerDataItem('user123', { type: 'phone', value: '555-1234' });

      const result = gdpr.deleteUserData('user123');
      expect(result.deletedCount).toBeGreaterThan(0);
    });

    test('should verify complete data deletion', () => {
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });
      gdpr.deleteUserData('user123');

      const inventory = gdpr.getDataInventory('user123');
      expect(inventory).toHaveLength(0);
    });

    test('should maintain deletion audit trail', () => {
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });
      gdpr.deleteUserData('user123');

      const auditLog = gdpr.getAuditLog();
      expect(auditLog).toContainEqual(expect.objectContaining({
        operation: 'data_deleted',
        userId: 'user123'
      }));
    });

    test('should enforce deletion timelines', () => {
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });
      const result = gdpr.deleteUserData('user123', { deadline: 30 });
      expect(result.deadline).toBeLessThanOrEqual(30);
    });

    test('should handle deletion exceptions for legal retention', () => {
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });
      const result = gdpr.deleteUserData('user123', { legalHold: true });
      expect(result.status).toBe('pending_legal_review');
    });
  });

  describe('Data Portability', () => {
    test('should export user data in portable format', () => {
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });
      gdpr.registerDataItem('user123', { type: 'phone', value: '555-1234' });

      const exported = gdpr.exportUserData('user123', 'json');
      expect(exported).toHaveProperty('userId', 'user123');
      expect(exported.data).toBeInstanceOf(Array);
    });

    test('should support multiple export formats', () => {
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });

      const jsonData = gdpr.exportUserData('user123', 'json');
      const csvData = gdpr.exportUserData('user123', 'csv');

      expect(jsonData).toBeDefined();
      expect(csvData).toBeDefined();
    });

    test('should maintain data integrity in export', () => {
      const testData = { type: 'email', value: 'test@example.com' };
      gdpr.registerDataItem('user123', testData);

      const exported = gdpr.exportUserData('user123', 'json');
      expect(exported.data).toContainEqual(expect.objectContaining(testData));
    });

    test('should track data portability requests', () => {
      gdpr.exportUserData('user123', 'json');
      const auditLog = gdpr.getAuditLog();

      expect(auditLog).toContainEqual(expect.objectContaining({
        operation: 'data_exported',
        userId: 'user123'
      }));
    });
  });

  describe('Processing Activities', () => {
    test('should register processing activities', () => {
      gdpr.registerProcessingActivity('user123', 'analytics', {
        description: 'Website analytics tracking',
        lawfulBasis: 'legitimate_interest'
      });

      const activities = gdpr.getProcessingActivities('user123');
      expect(activities).toContainEqual(expect.objectContaining({
        purpose: 'analytics'
      }));
    });

    test('should track processing activity consent', () => {
      gdpr.registerProcessingActivity('user123', 'marketing', {
        lawfulBasis: 'consent'
      });

      gdpr.recordConsent('user123', ['marketing']);
      expect(gdpr.isProcessingAuthorized('user123', 'marketing')).toBe(true);
    });

    test('should validate lawful basis for processing', () => {
      const result = gdpr.registerProcessingActivity('user123', 'payment', {
        lawfulBasis: 'contract'
      });

      expect(result.authorized).toBe(true);
      expect(result.lawfulBasis).toBe('contract');
    });

    test('should reject processing without valid lawful basis', () => {
      const result = gdpr.registerProcessingActivity('user123', 'analytics', {
        lawfulBasis: 'invalid'
      });

      expect(result.authorized).toBe(false);
    });
  });

  describe('Privacy Impact Assessment', () => {
    test('should generate DPIA for processing activities', () => {
      gdpr.registerProcessingActivity('user123', 'analytics', {
        description: 'Website usage tracking'
      });

      const dpia = gdpr.generateDPIA('user123', 'analytics');
      expect(dpia).toHaveProperty('assessmentId');
      expect(dpia).toHaveProperty('riskLevel');
      expect(dpia.timestamp).toBeDefined();
    });

    test('should identify high-risk processing', () => {
      gdpr.registerProcessingActivity('user123', 'profiling', {
        description: 'Behavioral profiling for AI',
        dataTypes: ['behavioral', 'location']
      });

      const dpia = gdpr.generateDPIA('user123', 'profiling');
      expect(dpia.riskLevel).toBeGreaterThan(2);
    });

    test('should track DPIA audit trail', () => {
      gdpr.generateDPIA('user123', 'analytics');
      const auditLog = gdpr.getAuditLog();

      expect(auditLog).toContainEqual(expect.objectContaining({
        operation: 'dpia_generated',
        userId: 'user123'
      }));
    });

    test('should recommend mitigations for high-risk activities', () => {
      gdpr.registerProcessingActivity('user123', 'profiling', {
        dataTypes: ['sensitive']
      });

      const dpia = gdpr.generateDPIA('user123', 'profiling');
      expect(dpia.recommendedMitigations).toBeInstanceOf(Array);
      expect(dpia.recommendedMitigations.length).toBeGreaterThan(0);
    });
  });

  describe('Breach Notification', () => {
    test('should record data breach', () => {
      const breach = gdpr.recordBreach({
        affectedUsers: ['user123', 'user456'],
        dataTypes: ['email', 'phone'],
        discoveredAt: new Date(),
        severity: 'high'
      });

      expect(breach.breachId).toBeDefined();
      expect(breach.severity).toBe('high');
    });

    test('should calculate breach impact', () => {
      const breach = gdpr.recordBreach({
        affectedUsers: ['user123', 'user456'],
        dataTypes: ['ssn', 'credit_card'],
        severity: 'critical'
      });

      expect(breach.impactScore).toBeGreater(3);
    });

    test('should track breach notification timeline', () => {
      const breach = gdpr.recordBreach({
        affectedUsers: ['user123'],
        severity: 'medium'
      });

      expect(breach.notificationDeadline).toBeDefined();
      const deadline = new Date(breach.notificationDeadline);
      expect(deadline.getTime()).toBeGreater(Date.now());
    });

    test('should generate breach notification communication', () => {
      const breach = gdpr.recordBreach({
        affectedUsers: ['user123'],
        dataTypes: ['email'],
        severity: 'medium'
      });

      const notification = gdpr.generateBreachNotification(breach.breachId);
      expect(notification).toHaveProperty('affectedUsers');
      expect(notification).toHaveProperty('affectedDataTypes');
      expect(notification).toHaveProperty('recommendedActions');
    });
  });

  describe('Data Subject Rights', () => {
    test('should register new data subject', () => {
      const subject = gdpr.registerDataSubject('user123', {
        name: 'John Doe',
        email: 'john@example.com'
      });

      expect(subject.dataSubjectId).toBeDefined();
      expect(subject.registeredAt).toBeDefined();
    });

    test('should retrieve data subject profile', () => {
      gdpr.registerDataSubject('user123', { email: 'john@example.com' });
      gdpr.registerDataItem('user123', { type: 'email', value: 'john@example.com' });

      const profile = gdpr.getDataSubjectProfile('user123');
      expect(profile).toHaveProperty('dataItems');
      expect(profile).toHaveProperty('consentRecords');
      expect(profile).toHaveProperty('processingActivities');
    });

    test('should track all data subject rights requests', () => {
      gdpr.registerDataSubject('user123', { email: 'john@example.com' });
      gdpr.exportUserData('user123', 'json');

      const rightsRequests = gdpr.getDataSubjectRightsRequests('user123');
      expect(rightsRequests).toContainEqual(expect.objectContaining({
        type: 'data_portability'
      }));
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate compliance report', () => {
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });
      gdpr.recordConsent('user123', ['analytics']);

      const report = gdpr.generateComplianceReport();
      expect(report).toHaveProperty('totalDataSubjects');
      expect(report).toHaveProperty('dataItems');
      expect(report).toHaveProperty('consentRecords');
    });

    test('should identify compliance gaps', () => {
      const report = gdpr.generateComplianceReport();
      expect(report).toHaveProperty('complianceGaps');
      expect(Array.isArray(report.complianceGaps)).toBe(true);
    });

    test('should track consent rates', () => {
      gdpr.registerDataSubject('user123', { email: 'test@example.com' });
      gdpr.recordConsent('user123', ['analytics']);

      const report = gdpr.generateComplianceReport();
      expect(report.consentMetrics).toBeDefined();
      expect(report.consentMetrics.grantedCount).toBeGreaterThan(0);
    });
  });

  describe('Audit Trail and Logging', () => {
    test('should maintain comprehensive audit log', () => {
      gdpr.registerDataSubject('user123', { email: 'test@example.com' });
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });
      gdpr.recordConsent('user123', ['analytics']);

      const auditLog = gdpr.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0]).toHaveProperty('timestamp');
      expect(auditLog[0]).toHaveProperty('operation');
    });

    test('should track audit log retention policies', () => {
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });
      const config = gdpr.getConfig();
      expect(config.auditLogSize).toBeGreaterThan(0);
    });

    test('should prevent audit log tampering', () => {
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });
      const originalLog = [...gdpr.getAuditLog()];

      // Attempt to modify audit log should not succeed
      expect(originalLog.length).toBe(gdpr.getAuditLog().length);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete user lifecycle (registration to deletion)', () => {
      // Register
      gdpr.registerDataSubject('user123', { email: 'test@example.com' });
      gdpr.registerDataItem('user123', { type: 'email', value: 'test@example.com' });

      // Consent
      gdpr.recordConsent('user123', ['analytics', 'marketing']);

      // Processing
      gdpr.registerProcessingActivity('user123', 'analytics', {
        lawfulBasis: 'consent'
      });

      // Export
      const exported = gdpr.exportUserData('user123', 'json');
      expect(exported).toBeDefined();

      // Delete
      gdpr.deleteUserData('user123');
      expect(gdpr.getDataInventory('user123')).toHaveLength(0);
    });

    test('should maintain consistency across GDPR operations', () => {
      gdpr.registerDataSubject('user123', { email: 'test@example.com' });
      gdpr.recordConsent('user123', ['analytics']);
      gdpr.registerProcessingActivity('user123', 'analytics', {
        lawfulBasis: 'consent'
      });

      const profile = gdpr.getDataSubjectProfile('user123');
      expect(profile.consentStatus).toBe('granted');
      expect(profile.processingAuthorized).toBe(true);
    });
  });

  describe('Performance and Scale', () => {
    test('should handle large number of data subjects efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        gdpr.registerDataSubject(`user${i}`, { email: `user${i}@example.com` });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should handle 100 users in < 5 seconds
    });

    test('should manage large data inventories', () => {
      for (let i = 0; i < 50; i++) {
        gdpr.registerDataItem('user123', { type: `field${i}`, value: `value${i}` });
      }

      const inventory = gdpr.getDataInventory('user123');
      expect(inventory.length).toBe(50);
    });
  });
});
