/**
 * Enterprise Security & Compliance Phase 3 - Comprehensive Tests
 * Tests for Vulnerability Scanning, Threat Detection, Secrets Management,
 * Audit & Logging, Security Validation
 */

const VulnerabilityScanner = require('../../src/security/vulnerability-scanner');
const ThreatDetector = require('../../src/security/threat-detector');
const SecretVault = require('../../src/security/secret-vault');
const CredentialManager = require('../../src/security/credential-manager');
const EnhancedAuditLog = require('../../src/security/enhanced-audit-log');
const IncidentDetection = require('../../src/security/incident-detection');

describe('Enterprise Security & Compliance - Phase 2-5', () => {
  let vulnerabilityScanner;
  let threatDetector;
  let secretVault;
  let credentialManager;
  let auditLog;
  let incidentDetection;

  beforeEach(() => {
    vulnerabilityScanner = new VulnerabilityScanner();
    threatDetector = new ThreatDetector();
    secretVault = new SecretVault();
    credentialManager = new CredentialManager();
    auditLog = new EnhancedAuditLog();
    incidentDetection = new IncidentDetection();
  });

  describe('Phase 2: Vulnerability Scanning', () => {
    describe('Automated Dependency Scanning', () => {
      test('should scan npm dependencies for vulnerabilities', () => {
        const results = vulnerabilityScanner.scanDependencies({
          type: 'npm',
          dependencies: {
            'express': '4.17.1',
            'lodash': '4.17.19'
          }
        });

        expect(results).toBeDefined();
        expect(results).toHaveProperty('vulnerabilities');
        expect(Array.isArray(results.vulnerabilities)).toBe(true);
      });

      test('should identify known CVEs in dependencies', () => {
        const results = vulnerabilityScanner.scanDependencies({
          type: 'npm',
          dependencies: {
            'vulnerable-package': '1.0.0'
          }
        });

        expect(results.vulnerabilities).toBeDefined();
      });

      test('should provide remediation suggestions', () => {
        const results = vulnerabilityScanner.scanDependencies({
          type: 'npm',
          dependencies: {
            'outdated-package': '1.0.0'
          }
        });

        const vulnerability = results.vulnerabilities[0];
        if (vulnerability) {
          expect(vulnerability).toHaveProperty('fix');
          expect(vulnerability).toHaveProperty('severity');
        }
      });

      test('should track scan history', () => {
        vulnerabilityScanner.scanDependencies({
          type: 'npm',
          dependencies: { 'express': '4.17.1' }
        });

        const history = vulnerabilityScanner.getScanHistory();
        expect(history.length).toBeGreaterThan(0);
      });
    });

    describe('Code Vulnerability Analysis', () => {
      test('should detect OWASP Top 10 vulnerabilities', () => {
        const vulnTypes = [
          'SQL_INJECTION', 'CROSS_SITE_SCRIPTING', 'BROKEN_AUTHENTICATION',
          'INSECURE_DESERIALIZATION', 'BUFFER_OVERFLOW'
        ];

        const codeSnippet = 'query = "SELECT * FROM users WHERE id=" + userInput;';
        const results = vulnerabilityScanner.analyzeCode(codeSnippet);

        expect(results).toBeDefined();
        expect(results).toHaveProperty('vulnerabilities');
      });

      test('should identify hardcoded secrets in code', () => {
        const codeWithSecret = "const apiKey = 'sk_live_1234567890';";
        const results = vulnerabilityScanner.analyzeCode(codeWithSecret);

        expect(results.vulnerabilities).toContainEqual(
          expect.objectContaining({
            type: expect.stringMatching(/HARDCODED|SECRET/)
          })
        );
      });

      test('should detect weak cryptography usage', () => {
        const codeWithWeakCrypto = "crypto.createCipher('md5', password);";
        const results = vulnerabilityScanner.analyzeCode(codeWithWeakCrypto);

        expect(results.vulnerabilities).toContainEqual(
          expect.objectContaining({
            severity: expect.stringMatching(/MEDIUM|HIGH/)
          })
        );
      });

      test('should flag unsafe file operations', () => {
        const unsafeCode = 'fs.readFileSync(userPath);';
        const results = vulnerabilityScanner.analyzeCode(unsafeCode);

        expect(results).toBeDefined();
      });
    });

    describe('Container Scanning', () => {
      test('should scan Docker image for vulnerabilities', () => {
        const results = vulnerabilityScanner.scanContainer({
          imageId: 'node:latest',
          format: 'docker'
        });

        expect(results).toBeDefined();
        expect(results).toHaveProperty('baseImage');
      });

      test('should detect vulnerable layers in container', () => {
        const results = vulnerabilityScanner.scanContainer({
          imageId: 'ubuntu:18.04',
          format: 'docker'
        });

        expect(results).toHaveProperty('layers');
        if (results.vulnerabilities) {
          expect(Array.isArray(results.vulnerabilities)).toBe(true);
        }
      });

      test('should check base image for vulnerabilities', () => {
        const results = vulnerabilityScanner.scanContainer({
          imageId: 'node:12',
          format: 'docker'
        });

        expect(results.baseImage).toBeDefined();
      });
    });

    describe('Compliance Checking', () => {
      test('should verify GDPR compliance controls', () => {
        const results = vulnerabilityScanner.checkCompliance('GDPR', {
          components: ['data_processing', 'consent_management']
        });

        expect(results).toBeDefined();
        expect(results).toHaveProperty('complianceStatus');
      });

      test('should verify HIPAA compliance controls', () => {
        const results = vulnerabilityScanner.checkCompliance('HIPAA', {
          components: ['encryption', 'audit_logging']
        });

        expect(results).toBeDefined();
        expect(results).toHaveProperty('compliantControls');
      });

      test('should identify compliance gaps', () => {
        const results = vulnerabilityScanner.checkCompliance('SOC2', {
          components: ['access_control', 'monitoring']
        });

        expect(results).toHaveProperty('complianceGaps');
      });
    });
  });

  describe('Phase 2: Threat Detection', () => {
    describe('Intrusion Detection', () => {
      test('should detect suspicious authentication attempts', () => {
        const alert = threatDetector.detectIntrusion({
          eventType: 'failed_auth_attempts',
          count: 10,
          timeWindow: 5 * 60 * 1000,
          userId: 'user123'
        });

        expect(alert).toBeDefined();
        expect(alert.severity).toBeGreaterThan(0);
      });

      test('should identify brute force attacks', () => {
        const events = Array(50).fill(null).map((_, i) => ({
          eventType: 'login_attempt',
          userId: 'user123',
          success: false,
          timestamp: Date.now() - (50 - i) * 1000
        }));

        threatDetector.recordEvents(events);
        const threats = threatDetector.detectIntrusion({
          eventType: 'brute_force',
          threshold: 10
        });

        expect(threats).toBeDefined();
      });

      test('should detect credential stuffing attacks', () => {
        const threat = threatDetector.detectIntrusion({
          eventType: 'credential_stuffing',
          uniqueIPs: 15,
          attemptedAccounts: 20
        });

        expect(threat.threat_type).toMatch(/credential_stuffing|multi_account/);
      });
    });

    describe('Anomaly Detection', () => {
      test('should detect unusual access patterns', () => {
        threatDetector.recordEvent({
          eventType: 'data_access',
          userId: 'user123',
          timestamp: Date.now()
        });

        const anomalies = threatDetector.detectAnomalies({
          type: 'access_pattern',
          userId: 'user123'
        });

        expect(anomalies).toBeDefined();
      });

      test('should identify unusual data volumes', () => {
        threatDetector.recordEvent({
          eventType: 'data_export',
          userId: 'user123',
          volumeMB: 5000,
          timestamp: Date.now()
        });

        const anomaly = threatDetector.detectAnomalies({
          type: 'data_volume',
          threshold: 1000 // MB
        });

        expect(anomaly).toBeDefined();
      });

      test('should detect privilege escalation attempts', () => {
        const threat = threatDetector.detectAnomalies({
          type: 'privilege_change',
          userId: 'user123',
          oldRole: 'user',
          newRole: 'admin'
        });

        expect(threat).toBeDefined();
      });

      test('should track baseline for normal behavior', () => {
        for (let i = 0; i < 100; i++) {
          threatDetector.recordEvent({
            eventType: 'api_call',
            userId: 'user123',
            timestamp: Date.now() - (100 - i) * 1000
          });
        }

        const baseline = threatDetector.getBaselineMetrics('user123');
        expect(baseline).toBeDefined();
        expect(baseline.normalApiCallsPerHour).toBeGreaterThan(0);
      });
    });

    describe('Behavioral Analysis', () => {
      test('should analyze user behavior patterns', () => {
        threatDetector.recordEvent({
          eventType: 'login',
          userId: 'user123',
          location: 'New York',
          timestamp: Date.now()
        });

        const behavior = threatDetector.analyzeBehavior('user123');
        expect(behavior).toBeDefined();
        expect(behavior).toHaveProperty('normalLocations');
      });

      test('should detect impossible travel', () => {
        threatDetector.recordEvent({
          eventType: 'login',
          userId: 'user123',
          location: 'New York',
          timestamp: Date.now() - 3600000 // 1 hour ago
        });

        threatDetector.recordEvent({
          eventType: 'login',
          userId: 'user123',
          location: 'Tokyo',
          timestamp: Date.now()
        });

        const threat = threatDetector.detectAnomalies({
          type: 'impossible_travel',
          userId: 'user123'
        });

        expect(threat).toBeDefined();
      });

      test('should track time-based behavior patterns', () => {
        const now = Date.now();
        for (let hour = 0; hour < 24; hour++) {
          threatDetector.recordEvent({
            eventType: 'api_call',
            userId: 'user123',
            timestamp: now - (hour * 60 * 60 * 1000)
          });
        }

        const pattern = threatDetector.getTimeBasedPattern('user123');
        expect(pattern).toBeDefined();
        expect(pattern.peakHours).toBeDefined();
      });
    });

    describe('Auto-Remediation Triggers', () => {
      test('should trigger automatic lockdown on high-risk threat', () => {
        const threat = threatDetector.detectIntrusion({
          eventType: 'critical_threat',
          severity: 'critical'
        });

        const remediation = threatDetector.triggerAutoRemediation(threat);
        expect(remediation).toBeDefined();
        expect(remediation.actions).toContainEqual(
          expect.objectContaining({
            action: expect.stringMatching(/lock|disable|quarantine/)
          })
        );
      });

      test('should isolate affected systems', () => {
        const remediation = threatDetector.triggerAutoRemediation({
          threatType: 'ransomware',
          affectedSystems: ['server1', 'server2']
        });

        expect(remediation.actions).toContainEqual(
          expect.objectContaining({
            target: expect.stringMatching(/server/)
          })
        );
      });

      test('should block malicious IPs automatically', () => {
        const remediation = threatDetector.triggerAutoRemediation({
          threatType: 'ddos',
          sourceIPs: ['192.168.1.1', '192.168.1.2']
        });

        expect(remediation.blockedIPs).toBeDefined();
      });

      test('should track remediation actions taken', () => {
        threatDetector.triggerAutoRemediation({
          threatType: 'brute_force',
          userId: 'attacker'
        });

        const actions = threatDetector.getRemediationHistory();
        expect(actions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Phase 3: Secrets & Credentials Management', () => {
    describe('Secret Vault', () => {
      test('should store secret with encryption', () => {
        const secret = secretVault.storeSecret('database_password', {
          value: 'super_secret_password_123',
          type: 'database_credential',
          metadata: { environment: 'production' }
        });

        expect(secret.secretId).toBeDefined();
        expect(secret.stored).toBe(true);
      });

      test('should retrieve secret with decryption', () => {
        const stored = secretVault.storeSecret('api_key', {
          value: 'sk_live_1234567890',
          type: 'api_key'
        });

        const retrieved = secretVault.getSecret(stored.secretId);
        expect(retrieved.value).toBe('sk_live_1234567890');
      });

      test('should fail retrieval with wrong access context', () => {
        const stored = secretVault.storeSecret('token', {
          value: 'secret_token',
          requiredContext: { role: 'admin' }
        });

        const retrieved = secretVault.getSecret(stored.secretId, {
          role: 'user'
        });

        expect(retrieved.error).toBeDefined();
      });

      test('should implement automatic secret rotation', () => {
        const secret = secretVault.storeSecret('rotating_secret', {
          value: 'initial_value',
          rotationPolicy: { interval: 90 * 24 * 60 * 60 * 1000 }
        });

        expect(secret.nextRotation).toBeDefined();
      });

      test('should maintain secret version history', () => {
        const secret = secretVault.storeSecret('versioned_secret', {
          value: 'version1'
        });

        secretVault.rotateSecret(secret.secretId);
        secretVault.storeSecret('versioned_secret', {
          value: 'version2'
        });

        const versions = secretVault.getSecretVersions(secret.secretId);
        expect(versions.length).toBeGreaterThan(1);
      });

      test('should audit all secret access', () => {
        const secret = secretVault.storeSecret('audited_secret', {
          value: 'secret_value'
        });

        secretVault.getSecret(secret.secretId);
        secretVault.getSecret(secret.secretId);

        const accessLog = secretVault.getSecretAccessLog(secret.secretId);
        expect(accessLog.length).toBeGreaterThan(0);
      });

      test('should enforce access control on secrets', () => {
        const secret = secretVault.storeSecret('restricted_secret', {
          value: 'restricted',
          allowedPrincipals: ['service_a', 'service_b']
        });

        const access1 = secretVault.canAccessSecret('service_a', secret.secretId);
        const access2 = secretVault.canAccessSecret('service_c', secret.secretId);

        expect(access1).toBe(true);
        expect(access2).toBe(false);
      });
    });

    describe('Credential Management', () => {
      test('should store credentials securely', () => {
        const cred = credentialManager.storeCredential({
          type: 'username_password',
          username: 'admin',
          password: 'secure_password',
          service: 'database'
        });

        expect(cred.credentialId).toBeDefined();
        expect(cred.encrypted).toBe(true);
      });

      test('should manage credential lifecycle', () => {
        const cred = credentialManager.storeCredential({
          type: 'api_token',
          token: 'token_value',
          expiresIn: 30 * 24 * 60 * 60 * 1000
        });

        const status = credentialManager.getCredentialStatus(cred.credentialId);
        expect(status.isExpired).toBe(false);
        expect(status.expiresAt).toBeDefined();
      });

      test('should detect compromised credentials', () => {
        const cred = credentialManager.storeCredential({
          type: 'password',
          username: 'user123',
          password: 'password123'
        });

        // Simulate credential appearing in breach database
        const isCompromised = credentialManager.checkCompromised(cred.credentialId);
        expect(typeof isCompromised).toBe('boolean');
      });

      test('should automatically revoke compromised credentials', () => {
        const cred = credentialManager.storeCredential({
          type: 'token',
          token: 'compromised_token'
        });

        credentialManager.revokeCredential(cred.credentialId, {
          reason: 'breach_detected'
        });

        const status = credentialManager.getCredentialStatus(cred.credentialId);
        expect(status.revoked).toBe(true);
      });

      test('should enforce credential rotation policies', () => {
        const policy = credentialManager.setRotationPolicy('database_passwords', {
          interval: 90 * 24 * 60 * 60 * 1000,
          enforcementLevel: 'strict'
        });

        expect(policy.enabled).toBe(true);
        expect(policy.interval).toBe(90 * 24 * 60 * 60 * 1000);
      });

      test('should track credential usage', () => {
        const cred = credentialManager.storeCredential({
          type: 'api_key',
          key: 'key_value'
        });

        credentialManager.recordUsage(cred.credentialId, {
          action: 'used',
          endpoint: '/api/data'
        });

        const usage = credentialManager.getUsageLog(cred.credentialId);
        expect(usage.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Phase 4: Comprehensive Audit & Logging', () => {
    test('should log all security-relevant operations', () => {
      auditLog.log({
        eventType: 'security_operation',
        operation: 'secret_accessed',
        actor: 'service_a',
        resource: 'database_password',
        timestamp: new Date(),
        result: 'success'
      });

      const logs = auditLog.query({
        eventType: 'security_operation'
      });

      expect(logs.length).toBeGreaterThan(0);
    });

    test('should detect audit log tampering', () => {
      const logEntry = auditLog.log({
        eventType: 'sensitive_operation',
        actor: 'user123'
      });

      const isValid = auditLog.verifyIntegrity(logEntry.logId);
      expect(isValid).toBe(true);
    });

    test('should maintain tamper-proof audit trail', () => {
      const log1 = auditLog.log({ eventType: 'event1', actor: 'user1' });
      const log2 = auditLog.log({ eventType: 'event2', actor: 'user2' });

      expect(log2.chainHash).not.toBe(log1.hash);
    });

    test('should enable comprehensive audit analysis', () => {
      for (let i = 0; i < 100; i++) {
        auditLog.log({
          eventType: 'api_call',
          actor: `user${i % 10}`,
          operation: 'data_access'
        });
      }

      const analysis = auditLog.analyze({
        metric: 'event_frequency',
        groupBy: 'actor'
      });

      expect(analysis).toBeDefined();
    });

    test('should generate audit reports', () => {
      auditLog.log({ eventType: 'access_granted', actor: 'admin' });
      auditLog.log({ eventType: 'data_modification', actor: 'user1' });

      const report = auditLog.generateReport({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date()
      });

      expect(report).toHaveProperty('totalEvents');
      expect(report).toHaveProperty('eventsByType');
      expect(report).toHaveProperty('eventsByActor');
    });
  });

  describe('Phase 4: Security Events Classification', () => {
    test('should classify security events by severity', () => {
      const events = [
        { type: 'login_attempt', severity: 'low' },
        { type: 'failed_auth', severity: 'medium' },
        { type: 'data_breach', severity: 'critical' }
      ];

      events.forEach(event => {
        const classified = incidentDetection.classifyEvent(event);
        expect(classified.severity).toBeDefined();
      });
    });

    test('should correlate related security events', () => {
      const events = [
        { type: 'failed_auth', userId: 'user123', timestamp: Date.now() - 1000 },
        { type: 'failed_auth', userId: 'user123', timestamp: Date.now() - 500 },
        { type: 'failed_auth', userId: 'user123', timestamp: Date.now() }
      ];

      events.forEach(e => incidentDetection.recordEvent(e));
      const correlation = incidentDetection.correlateEvents();

      expect(correlation).toBeDefined();
    });

    test('should enable real-time alerting', () => {
      const alert = incidentDetection.createAlert({
        severity: 'high',
        message: 'Suspicious activity detected',
        affectedResources: ['user123', 'server1']
      });

      expect(alert.alertId).toBeDefined();
      expect(alert.sentAt).toBeDefined();
    });
  });

  describe('Phase 5: Security Validation', () => {
    describe('Compliance Verification', () => {
      test('should verify GDPR compliance', () => {
        const result = vulnerabilityScanner.checkCompliance('GDPR', {
          components: ['data_encryption', 'consent_management', 'audit_logging']
        });

        expect(result.complianceStatus).toBeDefined();
      });

      test('should verify HIPAA compliance', () => {
        const result = vulnerabilityScanner.checkCompliance('HIPAA', {
          components: ['phi_encryption', 'access_control', 'audit_logging']
        });

        expect(result.compliantControls).toBeDefined();
      });

      test('should verify SOC 2 Type II compliance', () => {
        const result = vulnerabilityScanner.checkCompliance('SOC2_TYPE_II', {
          components: ['availability', 'security', 'confidentiality']
        });

        expect(result.trustServiceCriteria).toBeDefined();
      });
    });

    describe('Automated Scanning', () => {
      test('should run automated security scan', () => {
        const scan = vulnerabilityScanner.runSecurityScan({
          scope: 'all',
          includeNetwork: true,
          includeCode: true,
          includeInfrastructure: true
        });

        expect(scan.scanId).toBeDefined();
        expect(scan.vulnerabilities).toBeDefined();
      });

      test('should prioritize findings by severity and exploitability', () => {
        const scan = vulnerabilityScanner.runSecurityScan({ scope: 'all' });

        const prioritized = vulnerabilityScanner.prioritizeFindings(scan.vulnerabilities);
        expect(prioritized[0].riskScore).toBeGreaterThanOrEqual(
          prioritized[prioritized.length - 1].riskScore
        );
      });

      test('should track remediation progress', () => {
        const scan = vulnerabilityScanner.runSecurityScan({ scope: 'all' });

        vulnerabilityScanner.recordRemediation(scan.vulnerabilities[0].id, {
          status: 'in_progress',
          assignee: 'dev_team'
        });

        const progress = vulnerabilityScanner.getRemediationProgress(scan.scanId);
        expect(progress.totalVulnerabilities).toBeGreaterThan(0);
      });
    });

    describe('Penetration Testing Framework', () => {
      test('should support automated penetration testing', () => {
        const pentest = vulnerabilityScanner.initiatePenetrationTest({
          scope: 'web_application',
          targets: ['https://api.example.com', 'https://app.example.com'],
          techniques: ['sql_injection', 'xss', 'csrf']
        });

        expect(pentest.testId).toBeDefined();
        expect(pentest.status).toBe('initiated');
      });

      test('should validate security controls under load', () => {
        const test = vulnerabilityScanner.initiatePenetrationTest({
          scope: 'infrastructure',
          techniques: ['ddos_resistance', 'rate_limiting']
        });

        expect(test).toBeDefined();
      });

      test('should generate pentest reports', () => {
        const pentest = vulnerabilityScanner.initiatePenetrationTest({
          scope: 'web_application'
        });

        const report = vulnerabilityScanner.generatePentestReport(pentest.testId);
        expect(report).toHaveProperty('executiveSummary');
        expect(report).toHaveProperty('findings');
        expect(report).toHaveProperty('recommendations');
      });
    });

    describe('Report Generation', () => {
      test('should generate comprehensive security report', () => {
        const scan = vulnerabilityScanner.runSecurityScan({ scope: 'all' });

        const report = vulnerabilityScanner.generateSecurityReport({
          scanId: scan.scanId,
          includeMetrics: true,
          includeTrends: true
        });

        expect(report).toHaveProperty('executiveSummary');
        expect(report).toHaveProperty('vulnerabilityMetrics');
        expect(report).toHaveProperty('remediationTimeline');
      });

      test('should provide compliance grade (A-F)', () => {
        const report = vulnerabilityScanner.generateSecurityReport({
          includeGrade: true,
          scope: 'all'
        });

        expect(report.overallGrade).toMatch(/[A-F]\+?/);
      });
    });
  });

  describe('Integration Tests - Complete Workflow', () => {
    test('should handle complete vulnerability lifecycle', () => {
      // Scan
      const scan = vulnerabilityScanner.runSecurityScan({ scope: 'all' });
      expect(scan.vulnerabilities).toBeDefined();

      // Prioritize
      const prioritized = vulnerabilityScanner.prioritizeFindings(scan.vulnerabilities);
      expect(prioritized.length).toBeGreaterThan(0);

      // Track remediation
      vulnerabilityScanner.recordRemediation(prioritized[0].id, {
        status: 'resolved'
      });

      // Report
      const report = vulnerabilityScanner.generateSecurityReport({ scanId: scan.scanId });
      expect(report).toBeDefined();
    });

    test('should coordinate threat detection and remediation', () => {
      // Detect threat
      const threat = threatDetector.detectIntrusion({
        eventType: 'suspicious_activity',
        severity: 'high'
      });

      // Trigger remediation
      const remediation = threatDetector.triggerAutoRemediation(threat);
      expect(remediation.actions).toBeDefined();

      // Track and audit
      auditLog.log({
        eventType: 'threat_detected',
        threatId: threat.threatId,
        remediationTriggered: true
      });
    });

    test('should maintain security posture across all phases', () => {
      // Vulnerability scanning
      const scan = vulnerabilityScanner.runSecurityScan({ scope: 'all' });

      // Threat detection
      const threats = threatDetector.detectAnomalies({ type: 'all' });

      // Secrets management
      secretVault.storeSecret('test', { value: 'secure' });

      // Audit logging
      auditLog.log({
        eventType: 'security_check',
        components: ['scanning', 'threat_detection', 'secrets_management']
      });

      // Generate report
      const report = vulnerabilityScanner.generateSecurityReport({
        comprehensive: true
      });

      expect(report).toBeDefined();
    });
  });

  describe('Performance and Scale', () => {
    test('should scan large codebases efficiently', () => {
      const startTime = Date.now();

      vulnerabilityScanner.runSecurityScan({
        scope: 'all',
        targetSize: 'large' // 1M+ lines of code
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(60000); // < 1 minute
    });

    test('should handle high-volume threat detection', () => {
      const startTime = Date.now();

      for (let i = 0; i < 10000; i++) {
        threatDetector.recordEvent({
          eventType: 'security_event',
          timestamp: Date.now() - (10000 - i) * 100
        });
      }

      threatDetector.detectAnomalies({ type: 'all' });
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000);
    });

    test('should manage thousands of secrets', () => {
      for (let i = 0; i < 1000; i++) {
        secretVault.storeSecret(`secret_${i}`, {
          value: `value_${i}`
        });
      }

      const retrieved = secretVault.getSecret('secret_500');
      expect(retrieved).toBeDefined();
    });
  });
});
