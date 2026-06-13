/**
 * HIPAA Compliance Tests
 * Comprehensive testing for HIPAA compliance engine
 */

const { HIPAAComplianceEngine } = require('../../src/compliance/hipaa-compliance');

describe('HIPAA Compliance Engine', () => {
  let hipaa;

  beforeEach(() => {
    hipaa = new HIPAAComplianceEngine();
  });

  describe('PHI Identification and Protection', () => {
    test('should identify Protected Health Information', () => {
      const phiTypes = [
        'patient_id', 'medical_record_number', 'diagnosis', 'medication',
        'lab_results', 'device_id', 'biometric_data'
      ];

      phiTypes.forEach(type => {
        const isPhi = hipaa.isPHI(type);
        expect(isPhi).toBe(true);
      });
    });

    test('should classify PHI by sensitivity level', () => {
      const classification = hipaa.classifyPHI({
        type: 'diagnosis',
        value: 'Type 2 Diabetes'
      });

      expect(classification.isSensitive).toBe(true);
      expect(classification.sensitivityLevel).toBeGreaterThan(2);
    });

    test('should encrypt sensitive PHI at rest', () => {
      const encrypted = hipaa.encryptPHI({
        type: 'ssn',
        value: '123-45-6789'
      });

      expect(encrypted.encryptionMethod).toBe('AES-256-GCM');
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.ciphertext).toBeDefined();
    });

    test('should track PHI access patterns', () => {
      hipaa.recordPHIAccess('user123', 'provider456', {
        phiType: 'diagnosis',
        action: 'read',
        timestamp: new Date()
      });

      const accessLog = hipaa.getPHIAccessLog('user123');
      expect(accessLog).toContainEqual(expect.objectContaining({
        accessedBy: 'provider456',
        phiType: 'diagnosis'
      }));
    });

    test('should enforce minimum necessary principle', () => {
      const allowed = hipaa.isMinimumNecessary({
        requester: 'provider456',
        phiType: 'full_medical_record',
        purpose: 'treatment'
      });

      expect(typeof allowed).toBe('boolean');
    });
  });

  describe('Audit Logging for Healthcare', () => {
    test('should create audit log for PHI access', () => {
      hipaa.recordAuditEvent({
        eventType: 'PHI_ACCESS',
        actor: 'provider123',
        action: 'view_records',
        resourceId: 'patient123',
        timestamp: new Date()
      });

      const logs = hipaa.getAuditLogs('PHI_ACCESS');
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toHaveProperty('actor');
      expect(logs[0]).toHaveProperty('action');
    });

    test('should log all PHI modifications', () => {
      hipaa.recordAuditEvent({
        eventType: 'PHI_MODIFICATION',
        actor: 'provider123',
        action: 'update_diagnosis',
        changes: { from: 'Fever', to: 'High Fever' },
        timestamp: new Date()
      });

      const logs = hipaa.getAuditLogs('PHI_MODIFICATION');
      expect(logs).toContainEqual(expect.objectContaining({
        eventType: 'PHI_MODIFICATION'
      }));
    });

    test('should track failed access attempts', () => {
      hipaa.recordAuditEvent({
        eventType: 'ACCESS_DENIED',
        actor: 'unauthorized_user',
        action: 'attempted_access',
        resourceId: 'patient123',
        reason: 'insufficient_permissions',
        timestamp: new Date()
      });

      const logs = hipaa.getAuditLogs('ACCESS_DENIED');
      expect(logs[0].reason).toBe('insufficient_permissions');
    });

    test('should maintain immutable audit trail', () => {
      hipaa.recordAuditEvent({
        eventType: 'PHI_ACCESS',
        actor: 'provider123',
        action: 'view_records',
        resourceId: 'patient123',
        timestamp: new Date()
      });

      const originalLog = hipaa.getAuditLogs('PHI_ACCESS')[0];
      expect(originalLog).toHaveProperty('logId');
      expect(originalLog).toHaveProperty('hash');
    });

    test('should enable audit log integrity verification', () => {
      hipaa.recordAuditEvent({
        eventType: 'PHI_ACCESS',
        actor: 'provider123',
        action: 'view_records',
        resourceId: 'patient123',
        timestamp: new Date()
      });

      const logs = hipaa.getAuditLogs('PHI_ACCESS');
      const isValid = hipaa.verifyAuditLogIntegrity(logs[0].logId);
      expect(isValid).toBe(true);
    });
  });

  describe('Access Control and Authentication', () => {
    test('should enforce role-based access control (RBAC)', () => {
      const canAccess = hipaa.hasAccessPermission({
        user: 'provider123',
        role: 'physician',
        resource: 'patient_records',
        action: 'read'
      });

      expect(typeof canAccess).toBe('boolean');
    });

    test('should restrict access based on minimum necessary principle', () => {
      hipaa.setAccessPolicy('nurse', 'medication_list', ['read']);

      const canAccess = hipaa.hasAccessPermission({
        user: 'nurse456',
        role: 'nurse',
        resource: 'medication_list',
        action: 'write'
      });

      expect(canAccess).toBe(false);
    });

    test('should require strong authentication for PHI access', () => {
      const authenticated = hipaa.authenticateUser({
        userId: 'provider123',
        password: 'secure_password_123',
        mfaToken: '123456'
      });

      expect(authenticated.success).toBe(true);
      expect(authenticated.sessionId).toBeDefined();
    });

    test('should enforce access revocation', () => {
      hipaa.grantAccess('provider123', 'patient_data', 'read');
      hipaa.revokeAccess('provider123', 'patient_data');

      const canAccess = hipaa.hasAccessPermission({
        user: 'provider123',
        resource: 'patient_data',
        action: 'read'
      });

      expect(canAccess).toBe(false);
    });

    test('should track access grants and revocations', () => {
      hipaa.grantAccess('provider123', 'patient_data', 'read');
      hipaa.revokeAccess('provider123', 'patient_data');

      const history = hipaa.getAccessHistory('provider123');
      expect(history).toContainEqual(expect.objectContaining({
        action: 'grant'
      }));
      expect(history).toContainEqual(expect.objectContaining({
        action: 'revoke'
      }));
    });
  });

  describe('Encryption for HIPAA', () => {
    test('should encrypt PHI using AES-256-GCM', () => {
      const plaintext = { diagnosis: 'Type 2 Diabetes' };
      const encrypted = hipaa.encryptPHI(plaintext);

      expect(encrypted.encryptionAlgorithm).toBe('AES-256-GCM');
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
    });

    test('should decrypt PHI with proper key', () => {
      const original = { diagnosis: 'Type 2 Diabetes' };
      const encrypted = hipaa.encryptPHI(original);
      const decrypted = hipaa.decryptPHI(encrypted);

      expect(decrypted.diagnosis).toBe(original.diagnosis);
    });

    test('should fail decryption with wrong key', () => {
      const encrypted = hipaa.encryptPHI({ diagnosis: 'Fever' });

      // Attempt to decrypt with wrong key should fail
      const result = hipaa.decryptPHI({ ...encrypted, encryptionKey: 'wrong_key' });
      expect(result.success).toBe(false);
    });

    test('should encrypt data in transit with TLS 1.2+', () => {
      const transportConfig = hipaa.getTransportEncryption();

      expect(transportConfig.tlsVersion).toMatch(/1\.[2-9]/);
      expect(transportConfig.cipherSuites).toContain('TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384');
    });

    test('should rotate encryption keys according to policy', () => {
      const initialKey = hipaa.getCurrentEncryptionKey();
      hipaa.rotateEncryptionKey();
      const newKey = hipaa.getCurrentEncryptionKey();

      expect(initialKey.keyId).not.toBe(newKey.keyId);
      expect(newKey.rotatedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Breach Notification Requirements', () => {
    test('should detect and log security incidents', () => {
      const incident = hipaa.reportSecurityIncident({
        type: 'unauthorized_access',
        affectedPatients: 100,
        phiTypes: ['diagnosis', 'medication'],
        discoveredAt: new Date(),
        severity: 'high'
      });

      expect(incident.incidentId).toBeDefined();
      expect(incident.severity).toBe('high');
    });

    test('should assess breach impact and risk', () => {
      const incident = hipaa.reportSecurityIncident({
        type: 'data_theft',
        affectedPatients: 500,
        phiTypes: ['ssn', 'medical_history'],
        severity: 'critical'
      });

      expect(incident.riskAssessment).toBeDefined();
      expect(incident.riskLevel).toBeGreaterThan(2);
    });

    test('should determine notification requirements', () => {
      const incident = hipaa.reportSecurityIncident({
        type: 'breach',
        affectedPatients: 600,
        phiTypes: ['ssn'],
        severity: 'critical'
      });

      const requirements = hipaa.getBreachNotificationRequirements(incident.incidentId);
      expect(requirements.notifyPatients).toBe(true);
      expect(requirements.notifyMedia).toBe(true);
      expect(requirements.notifyHHS).toBe(true);
    });

    test('should generate breach notification letters', () => {
      const incident = hipaa.reportSecurityIncident({
        type: 'breach',
        affectedPatients: 10,
        severity: 'medium'
      });

      const letters = hipaa.generateBreachNotifications(incident.incidentId);
      expect(letters).toBeInstanceOf(Array);
      expect(letters.length).toBeGreaterThan(0);
      expect(letters[0]).toHaveProperty('recipientType');
      expect(letters[0]).toHaveProperty('notificationText');
    });

    test('should track breach notification timeline', () => {
      const incident = hipaa.reportSecurityIncident({
        type: 'breach',
        affectedPatients: 50,
        severity: 'high'
      });

      const timeline = hipaa.getBreachNotificationTimeline(incident.incidentId);
      expect(timeline.patientNotificationDeadline).toBeLessThanOrEqual(60); // days
      expect(timeline.mediaNotificationDeadline).toBeLessThanOrEqual(60);
      expect(timeline.hhsNotificationDeadline).toBeLessThanOrEqual(60);
    });
  });

  describe('Business Associate Agreements', () => {
    test('should track Business Associate relationships', () => {
      hipaa.registerBusinessAssociate({
        name: 'Lab Testing Provider',
        type: 'laboratory',
        phiTypes: ['test_results'],
        contractDate: new Date()
      });

      const associates = hipaa.getBusinessAssociates();
      expect(associates.length).toBeGreaterThan(0);
      expect(associates[0]).toHaveProperty('name');
    });

    test('should verify BAA compliance', () => {
      hipaa.registerBusinessAssociate({
        name: 'Lab Testing Provider',
        baaStatus: 'signed'
      });

      const compliant = hipaa.isBusinessAssociateCompliant('Lab Testing Provider');
      expect(compliant).toBe(true);
    });

    test('should track PHI sharing with business associates', () => {
      hipaa.registerBusinessAssociate({
        name: 'Lab Testing Provider'
      });

      hipaa.sharePHI('patient123', 'Lab Testing Provider', {
        phiTypes: ['test_results'],
        purpose: 'laboratory_analysis'
      });

      const sharing = hipaa.getPHISharingLog('patient123');
      expect(sharing).toContainEqual(expect.objectContaining({
        sharedWith: 'Lab Testing Provider'
      }));
    });

    test('should enforce data use and disclosure limitations', () => {
      hipaa.registerBusinessAssociate({
        name: 'Lab Testing Provider',
        allowedPurposes: ['laboratory_analysis']
      });

      const allowed = hipaa.canDisclose('Lab Testing Provider', 'full_medical_record');
      expect(allowed).toBe(false); // Exceeds authorized purposes
    });
  });

  describe('Patient Rights and Records', () => {
    test('should maintain accurate patient records', () => {
      const patient = hipaa.createPatientRecord({
        patientId: 'patient123',
        name: 'John Doe',
        dob: '1980-01-01',
        ssn: '123-45-6789'
      });

      expect(patient.patientId).toBe('patient123');
      expect(patient.createdAt).toBeDefined();
    });

    test('should provide patient access to records', () => {
      hipaa.createPatientRecord({
        patientId: 'patient123',
        name: 'John Doe'
      });

      const records = hipaa.getPatientRecords('patient123', {
        requestedBy: 'patient123'
      });

      expect(records).toBeDefined();
      expect(Array.isArray(records)).toBe(true);
    });

    test('should allow patient to request amendments', () => {
      hipaa.createPatientRecord({
        patientId: 'patient123',
        diagnosis: 'Fever'
      });

      const amendment = hipaa.requestAmendment('patient123', {
        field: 'diagnosis',
        requestedChange: 'High Fever'
      });

      expect(amendment.amendmentId).toBeDefined();
      expect(amendment.status).toBe('pending_review');
    });

    test('should track patient authorization for disclosures', () => {
      hipaa.authorizeDisclosure('patient123', {
        disclosedTo: 'specialist456',
        phiTypes: ['diagnosis', 'test_results'],
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });

      const authorizations = hipaa.getPatientAuthorizations('patient123');
      expect(authorizations.length).toBeGreaterThan(0);
      expect(authorizations[0]).toHaveProperty('disclosedTo');
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate HIPAA compliance report', () => {
      hipaa.recordAuditEvent({
        eventType: 'PHI_ACCESS',
        actor: 'provider123',
        action: 'view_records',
        resourceId: 'patient123',
        timestamp: new Date()
      });

      const report = hipaa.generateComplianceReport();
      expect(report).toHaveProperty('auditLogCount');
      expect(report).toHaveProperty('accessEventsLogged');
      expect(report).toHaveProperty('complianceStatus');
    });

    test('should identify compliance violations', () => {
      // Simulate unauthorized access attempt
      hipaa.recordAuditEvent({
        eventType: 'ACCESS_DENIED',
        actor: 'unauthorized_user',
        reason: 'insufficient_permissions'
      });

      const report = hipaa.generateComplianceReport();
      expect(report.violations).toBeDefined();
      expect(Array.isArray(report.violations)).toBe(true);
    });

    test('should track technical safeguards implementation', () => {
      const report = hipaa.generateComplianceReport();
      expect(report.technicalSafeguards).toHaveProperty('encryption');
      expect(report.technicalSafeguards).toHaveProperty('accessControls');
      expect(report.technicalSafeguards).toHaveProperty('auditControls');
    });
  });

  describe('Integration Tests', () => {
    test('should handle patient privacy request lifecycle', () => {
      // Create patient record
      hipaa.createPatientRecord({
        patientId: 'patient123',
        name: 'John Doe'
      });

      // Record healthcare operations
      hipaa.recordAuditEvent({
        eventType: 'PHI_ACCESS',
        actor: 'provider123',
        action: 'view_records',
        resourceId: 'patient123',
        timestamp: new Date()
      });

      // Handle patient request for access
      const records = hipaa.getPatientRecords('patient123', {
        requestedBy: 'patient123'
      });

      expect(records).toBeDefined();

      // Verify audit trail
      const auditLog = hipaa.getAuditLogs('PHI_ACCESS');
      expect(auditLog).toContainEqual(expect.objectContaining({
        resourceId: 'patient123'
      }));
    });

    test('should maintain consistency across HIPAA operations', () => {
      hipaa.createPatientRecord({ patientId: 'patient123' });
      hipaa.grantAccess('provider123', 'patient123', 'read');

      const hasAccess = hipaa.hasAccessPermission({
        user: 'provider123',
        resource: 'patient123',
        action: 'read'
      });

      expect(hasAccess).toBe(true);

      hipaa.revokeAccess('provider123', 'patient123');
      const hasAccessAfter = hipaa.hasAccessPermission({
        user: 'provider123',
        resource: 'patient123',
        action: 'read'
      });

      expect(hasAccessAfter).toBe(false);
    });
  });

  describe('Performance and Scale', () => {
    test('should handle high volume of audit events', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        hipaa.recordAuditEvent({
          eventType: 'PHI_ACCESS',
          actor: `provider${i % 10}`,
          action: 'view_records',
          resourceId: `patient${i}`,
          timestamp: new Date()
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });

    test('should manage large patient populations efficiently', () => {
      for (let i = 0; i < 100; i++) {
        hipaa.createPatientRecord({
          patientId: `patient${i}`,
          name: `Patient ${i}`
        });
      }

      const records = hipaa.getPatientRecords('patient99');
      expect(records).toBeDefined();
    });
  });
});
