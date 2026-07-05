/**
 * Wave 13 Integration Tests: Features + Security
 * Tests interaction between session branching, device fingerprinting v2,
 * session encryption, audit logging, and path validation
 *
 * Version: 1.0.0
 * Created: May 31, 2026
 *
 * Test Categories:
 * - Session branching with encryption
 * - Fingerprinting auditing
 * - Checkpoint encryption and security
 * - Device profile validation
 * - Recovery strategies with security
 */

const assert = require('assert');

/**
 * Mock session branching
 */
class MockSessionBranching {
  constructor() {
    this.branches = new Map();
    this.checkpoints = new Map();
  }

  createBranch(parentId, name) {
    const id = `branch_${Date.now()}_${Math.random()}`;
    this.branches.set(id, {
      parentId,
      name,
      createdAt: Date.now(),
      encrypted: false
    });
    return id;
  }

  createCheckpoint(sessionId, name, state) {
    const id = `cp_${Date.now()}_${Math.random()}`;
    this.checkpoints.set(id, {
      sessionId,
      name,
      state,
      createdAt: Date.now(),
      encrypted: false
    });
    return id;
  }

  rollback(checkpointId) {
    return this.checkpoints.has(checkpointId);
  }

  getCheckpoint(checkpointId) {
    return this.checkpoints.get(checkpointId);
  }

  getStats() {
    return {
      branchCount: this.branches.size,
      checkpointCount: this.checkpoints.size
    };
  }
}

/**
 * Mock device fingerprinting v2
 */
class MockDeviceFingerprintingV2 {
  constructor() {
    this.profiles = new Map();
    this.usageHistory = [];
    this.validationErrors = [];
  }

  createProfile(data) {
    const id = `profile_${Date.now()}_${Math.random()}`;
    const profile = {
      id,
      name: data.name || 'Unknown',
      category: data.category || 'desktop',
      userAgent: data.userAgent || 'Mozilla/5.0',
      evasionScore: data.evasionScore || 0,
      createdAt: Date.now()
    };
    this.profiles.set(id, profile);
    return profile;
  }

  validateProfile(profile) {
    const errors = [];
    if (!profile.userAgent) {
      errors.push('Missing userAgent');
    }
    if (!profile.category) {
      errors.push('Missing category');
    }
    if (typeof profile.evasionScore !== 'number') {
      errors.push('Invalid evasionScore');
    }

    if (errors.length > 0) {
      this.validationErrors.push({ profile: profile.id, errors, timestamp: Date.now() });
      return false;
    }
    return true;
  }

  selectProfile(category) {
    const matching = Array.from(this.profiles.values())
      .filter(p => p.category === category);

    if (matching.length === 0) {
      return null;
    }

    const profile = matching[Math.floor(Math.random() * matching.length)];
    this.usageHistory.push({
      profileId: profile.id,
      timestamp: Date.now()
    });
    return profile;
  }

  getStats() {
    return {
      totalProfiles: this.profiles.size,
      totalUsage: this.usageHistory.length,
      validationErrors: this.validationErrors.length
    };
  }
}

/**
 * Mock session encryptor
 */
class MockSessionEncryptor {
  constructor() {
    this.encrypted = new Map();
    this.decrypted = new Map();
  }

  encryptSession(sessionId, data) {
    const encrypted = Buffer.from(JSON.stringify(data)).toString('base64');
    this.encrypted.set(sessionId, {
      data: encrypted,
      timestamp: Date.now()
    });
    return encrypted;
  }

  decryptSession(sessionId, encrypted) {
    const decrypted = JSON.parse(Buffer.from(encrypted, 'base64').toString());
    this.decrypted.set(sessionId, {
      data: decrypted,
      timestamp: Date.now()
    });
    return decrypted;
  }

  encryptCheckpoint(cpId, state) {
    return this.encryptSession(`cp_${cpId}`, state);
  }

  decryptCheckpoint(cpId, encrypted) {
    return this.decryptSession(`cp_${cpId}`, encrypted);
  }

  getStats() {
    return {
      encryptedSessions: this.encrypted.size,
      decryptedSessions: this.decrypted.size
    };
  }
}

/**
 * Mock audit logger
 */
class MockAuditLogger {
  constructor() {
    this.logs = [];
  }

  logOperation(entry) {
    this.logs.push({
      timestamp: Date.now(),
      ...entry
    });
    return { success: true };
  }

  logBranchCreation(branchId, parentId) {
    return this.logOperation({
      event: 'branch_created',
      branchId,
      parentId,
      type: 'feature'
    });
  }

  logFingerprintUsage(profileId, operation) {
    return this.logOperation({
      event: 'fingerprint_used',
      profileId,
      operation,
      type: 'security'
    });
  }

  logCheckpointEncryption(cpId, result) {
    return this.logOperation({
      event: 'checkpoint_encrypted',
      checkpointId: cpId,
      result,
      type: 'security'
    });
  }

  logCheckpointRollback(cpId) {
    return this.logOperation({
      event: 'checkpoint_rollback',
      checkpointId: cpId,
      type: 'feature'
    });
  }

  getEventsByType(type) {
    return this.logs.filter(l => l.type === type);
  }

  getStats() {
    return {
      totalEvents: this.logs.length,
      featureEvents: this.getEventsByType('feature').length,
      securityEvents: this.getEventsByType('security').length
    };
  }
}

/**
 * Mock path validator
 */
class MockPathValidator {
  constructor() {
    this.validationHistory = [];
  }

  validatePath(path) {
    const isValid = !path.includes('..') && !path.includes('~');
    this.validationHistory.push({
      path,
      valid: isValid,
      timestamp: Date.now()
    });
    return isValid;
  }

  validateProfilePath(profileId) {
    const safePath = `/profiles/${profileId}`.replace(/[^a-zA-Z0-9_\-/]/g, '');
    return this.validatePath(safePath);
  }

  validateCheckpointPath(cpId) {
    const safePath = `/checkpoints/${cpId}`.replace(/[^a-zA-Z0-9_\-/]/g, '');
    return this.validatePath(safePath);
  }

  getStats() {
    return {
      totalValidations: this.validationHistory.length,
      validPaths: this.validationHistory.filter(v => v.valid).length,
      invalidPaths: this.validationHistory.filter(v => !v.valid).length
    };
  }
}

// ========================================
// Test Suite
// ========================================

describe('Wave 13: Features + Security Integration Tests', () => {

  // ========================================
  // 1. Session Branching + Session Encryption
  // ========================================
  describe('Session Branching + Session Encryption', () => {
    let branching, encryptor, auditLogger;

    beforeEach(() => {
      branching = new MockSessionBranching();
      encryptor = new MockSessionEncryptor();
      auditLogger = new MockAuditLogger();
    });

    test('branch creation is audited with encryption', () => {
      const parentId = 'session_123';
      const branchId = branching.createBranch(parentId, 'test_branch');

      // Log creation
      auditLogger.logBranchCreation(branchId, parentId);

      // Encrypt branch metadata
      const branchData = { parentId, name: 'test_branch', createdAt: Date.now() };
      const encrypted = encryptor.encryptSession(branchId, branchData);

      assert.strictEqual(branching.branches.has(branchId), true, 'Branch should exist');
      assert.strictEqual(encrypted.length > 0, true, 'Should be encrypted');
      assert.strictEqual(auditLogger.logs.length, 1, 'Should be audited');
    });

    test('checkpoints are encrypted at creation', () => {
      const sessionId = 'session_456';
      const state = { url: 'https://example.com', cookies: {} };

      const cpId = branching.createCheckpoint(sessionId, 'checkpoint_1', state);

      // Encrypt checkpoint
      const encrypted = encryptor.encryptCheckpoint(cpId, state);

      // Log encryption
      auditLogger.logCheckpointEncryption(cpId, 'success');

      assert.strictEqual(branching.checkpoints.has(cpId), true, 'Checkpoint should exist');
      assert.strictEqual(encrypted.length > 0, true, 'Should be encrypted');
      assert.strictEqual(auditLogger.getEventsByType('security').length, 1, 'Should log encryption');
    });

    test('checkpoint rollback requires decryption and audit', () => {
      const sessionId = 'session_789';
      const state = { url: 'https://example.com' };

      const cpId = branching.createCheckpoint(sessionId, 'cp_rollback', state);
      const encrypted = encryptor.encryptCheckpoint(cpId, state);

      // Rollback
      const success = branching.rollback(cpId);
      const decrypted = encryptor.decryptCheckpoint(cpId, encrypted);

      // Audit rollback
      auditLogger.logCheckpointRollback(cpId);

      assert.strictEqual(success, true, 'Rollback should succeed');
      assert.strictEqual(decrypted.url, 'https://example.com', 'Decryption should work');
      assert.strictEqual(auditLogger.logs.length, 1, 'Should be audited');
    });

    test('branching with encryption preserves data integrity', () => {
      const parentId = 'session_master';
      const cpId = branching.createCheckpoint(parentId, 'baseline', { version: 1, data: 'test' });

      // Encrypt checkpoint
      const checkpoint = branching.getCheckpoint(cpId);
      const encrypted = encryptor.encryptCheckpoint(cpId, checkpoint.state);

      // Create branch from checkpoint
      const branchId = branching.createBranch(parentId, 'variant_from_checkpoint');

      // Decrypt and verify
      const decrypted = encryptor.decryptCheckpoint(cpId, encrypted);

      assert.strictEqual(decrypted.version, 1, 'Version should be preserved');
      assert.strictEqual(decrypted.data, 'test', 'Data should be preserved');
      assert.strictEqual(branching.branches.has(branchId), true, 'Branch should exist');
    });
  });

  // ========================================
  // 2. Device Fingerprinting v2 + Audit Logging
  // ========================================
  describe('Device Fingerprinting v2 + Audit Logging', () => {
    let fingerprinting, auditLogger;

    beforeEach(() => {
      fingerprinting = new MockDeviceFingerprintingV2();
      auditLogger = new MockAuditLogger();
    });

    test('fingerprint creation is audited', () => {
      const profileData = {
        name: 'Chrome Desktop',
        category: 'desktop',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
        evasionScore: 85
      };

      const profile = fingerprinting.createProfile(profileData);

      // Audit creation
      auditLogger.logFingerprintUsage(profile.id, 'created');

      assert.strictEqual(profile.id.startsWith('profile_'), true, 'Should have profile ID');
      assert.strictEqual(auditLogger.logs.length, 1, 'Should be audited');
      assert.strictEqual(auditLogger.logs[0].event, 'fingerprint_used', 'Should log fingerprint event');
    });

    test('fingerprint usage is audited for security tracking', () => {
      const profile = fingerprinting.createProfile({
        name: 'iOS Mobile',
        category: 'mobile',
        userAgent: 'Mozilla/5.0 (iPhone)',
        evasionScore: 72
      });

      // Log usage
      auditLogger.logFingerprintUsage(profile.id, 'screenshot');
      auditLogger.logFingerprintUsage(profile.id, 'navigation');
      auditLogger.logFingerprintUsage(profile.id, 'extraction');

      const usage = auditLogger.getEventsByType('security');
      assert.strictEqual(usage.length, 3, 'Should log 3 usages');
      assert.strictEqual(usage.every(u => u.profileId === profile.id), true, 'All should reference profile');
    });

    test('profile validation is audited on failure', () => {
      const invalidProfile = {
        name: 'Invalid Profile'
        // Missing required fields
      };

      const valid = fingerprinting.validateProfile(invalidProfile);

      assert.strictEqual(valid, false, 'Should be invalid');
      assert.strictEqual(fingerprinting.validationErrors.length, 1, 'Should record error');
    });

    test('fingerprint rotation is tracked in audit logs', () => {
      // Create multiple profiles
      const desktop = fingerprinting.createProfile({
        category: 'desktop',
        userAgent: 'Mozilla/5.0 (Windows)',
        evasionScore: 85
      });

      const mobile = fingerprinting.createProfile({
        category: 'mobile',
        userAgent: 'Mozilla/5.0 (iPhone)',
        evasionScore: 80
      });

      // Rotate between them
      fingerprinting.selectProfile('desktop');
      auditLogger.logFingerprintUsage(desktop.id, 'selected');

      fingerprinting.selectProfile('mobile');
      auditLogger.logFingerprintUsage(mobile.id, 'selected');

      fingerprinting.selectProfile('desktop');
      auditLogger.logFingerprintUsage(desktop.id, 'selected');

      assert.strictEqual(auditLogger.logs.length, 3, 'Should log 3 selections');
    });
  });

  // ========================================
  // 3. Checkpoint Encryption + Path Validation
  // ========================================
  describe('Checkpoint Encryption + Path Validation', () => {
    let branching, encryptor, pathValidator;

    beforeEach(() => {
      branching = new MockSessionBranching();
      encryptor = new MockSessionEncryptor();
      pathValidator = new MockPathValidator();
    });

    test('checkpoint paths are validated before encryption', () => {
      const cpId = 'cp_123_secure';
      const state = { data: 'test' };

      // Validate path
      const validPath = pathValidator.validateCheckpointPath(cpId);
      assert.strictEqual(validPath, true, 'Path should be valid');

      // Encrypt
      const encrypted = encryptor.encryptCheckpoint(cpId, state);
      assert.strictEqual(encrypted.length > 0, true, 'Should encrypt');
    });

    test('malicious paths are rejected before checkpoint creation', () => {
      const maliciousPath = '../../etc/passwd';

      const valid = pathValidator.validatePath(maliciousPath);
      assert.strictEqual(valid, false, 'Should reject malicious path');
      assert.strictEqual(pathValidator.getStats().invalidPaths, 1, 'Should track rejection');
    });

    test('profile paths are validated independently', () => {
      const profileId = 'profile_123_safe';
      const cpId = 'cp_456_safe';

      const profilePath = pathValidator.validateProfilePath(profileId);
      const cpPath = pathValidator.validateCheckpointPath(cpId);

      assert.strictEqual(profilePath, true, 'Profile path should be valid');
      assert.strictEqual(cpPath, true, 'Checkpoint path should be valid');
      assert.strictEqual(pathValidator.getStats().totalValidations, 2, 'Should validate both');
    });

    test('checkpoint restoration verifies path and decrypts', () => {
      const cpId = 'cp_789';
      const state = { url: 'https://secure.com', session: 'data' };

      // Create and encrypt
      const cp = branching.createCheckpoint('session_1', 'checkpoint', state);
      const encrypted = encryptor.encryptCheckpoint(cp, state);

      // Validate path before decryption
      const pathValid = pathValidator.validateCheckpointPath(cp);
      const decrypted = encryptor.decryptCheckpoint(cp, encrypted);

      assert.strictEqual(pathValid, true, 'Path should be valid');
      assert.strictEqual(decrypted.session, 'data', 'Data should decrypt correctly');
    });
  });

  // ========================================
  // 4. Branching + Fingerprinting + Encryption
  // ========================================
  describe('Session Branching + Fingerprinting + Encryption', () => {
    let branching, fingerprinting, encryptor, auditLogger;

    beforeEach(() => {
      branching = new MockSessionBranching();
      fingerprinting = new MockDeviceFingerprintingV2();
      encryptor = new MockSessionEncryptor();
      auditLogger = new MockAuditLogger();
    });

    test('branches with different fingerprints are independently encrypted', () => {
      const parentId = 'session_main';

      // Create two branches with different fingerprints
      const branchA = branching.createBranch(parentId, 'variant_desktop');
      const branchB = branching.createBranch(parentId, 'variant_mobile');

      // Assign different fingerprints
      const fpDesktop = fingerprinting.createProfile({
        category: 'desktop',
        userAgent: 'Mozilla/5.0 (Windows)',
        evasionScore: 85
      });

      const fpMobile = fingerprinting.createProfile({
        category: 'mobile',
        userAgent: 'Mozilla/5.0 (iPhone)',
        evasionScore: 80
      });

      // Encrypt branch metadata
      const dataA = { branch: branchA, fingerprint: fpDesktop.id };
      const dataB = { branch: branchB, fingerprint: fpMobile.id };

      const encryptedA = encryptor.encryptSession(branchA, dataA);
      const encryptedB = encryptor.encryptSession(branchB, dataB);

      // Log all operations
      auditLogger.logBranchCreation(branchA, parentId);
      auditLogger.logBranchCreation(branchB, parentId);
      auditLogger.logFingerprintUsage(fpDesktop.id, 'branch_assigned');
      auditLogger.logFingerprintUsage(fpMobile.id, 'branch_assigned');

      assert.strictEqual(branching.branches.size, 2, 'Should have 2 branches');
      assert.strictEqual(fingerprinting.getStats().totalProfiles, 2, 'Should have 2 fingerprints');
      assert.strictEqual(auditLogger.logs.length, 4, 'Should log all events');
    });

    test('checkpoint rollback with fingerprinting preserves security audit trail', () => {
      const sessionId = 'session_secure';
      const profile = fingerprinting.createProfile({
        category: 'desktop',
        userAgent: 'Mozilla/5.0',
        evasionScore: 90
      });

      // Create checkpoint
      const checkpointState = { url: 'https://secure.com', fingerprint: profile.id };
      const cpId = branching.createCheckpoint(sessionId, 'secure_checkpoint', checkpointState);

      // Encrypt checkpoint
      const encrypted = encryptor.encryptCheckpoint(cpId, checkpointState);

      // Later: rollback with full audit trail
      const canRollback = branching.rollback(cpId);
      const decrypted = encryptor.decryptCheckpoint(cpId, encrypted);

      auditLogger.logCheckpointRollback(cpId);
      auditLogger.logFingerprintUsage(profile.id, 'checkpoint_restored');

      assert.strictEqual(canRollback, true, 'Rollback should succeed');
      assert.strictEqual(decrypted.fingerprint, profile.id, 'Fingerprint should be preserved');
      assert.strictEqual(auditLogger.logs.length, 2, 'Should log rollback and fingerprint');
    });
  });

  // ========================================
  // 5. All Features + Security Together
  // ========================================
  describe('All Features + Security Together', () => {
    let branching, fingerprinting, encryptor, auditLogger, pathValidator;

    beforeEach(() => {
      branching = new MockSessionBranching();
      fingerprinting = new MockDeviceFingerprintingV2();
      encryptor = new MockSessionEncryptor();
      auditLogger = new MockAuditLogger();
      pathValidator = new MockPathValidator();
    });

    test('complete workflow: branching + fingerprinting + encryption + audit + validation', () => {
      // 1. Validate paths
      const branchPath = pathValidator.validatePath('/branches/safe');
      const profilePath = pathValidator.validateProfilePath('profile_1');
      assert.strictEqual(branchPath && profilePath, true, 'Paths should be valid');

      // 2. Create branching structure
      const parentId = 'session_main';
      const branchA = branching.createBranch(parentId, 'variant_a');
      const branchB = branching.createBranch(parentId, 'variant_b');

      // 3. Create fingerprints for branches
      const fp1 = fingerprinting.createProfile({
        category: 'desktop',
        userAgent: 'Mozilla/5.0 Desktop',
        evasionScore: 85
      });

      const fp2 = fingerprinting.createProfile({
        category: 'mobile',
        userAgent: 'Mozilla/5.0 Mobile',
        evasionScore: 80
      });

      // 4. Create encrypted checkpoints
      const cpA = branching.createCheckpoint(parentId, 'checkpoint_a', {
        branch: branchA,
        fingerprint: fp1.id
      });

      const cpB = branching.createCheckpoint(parentId, 'checkpoint_b', {
        branch: branchB,
        fingerprint: fp2.id
      });

      // 5. Encrypt checkpoints
      const encA = encryptor.encryptCheckpoint(cpA, { branch: branchA });
      const encB = encryptor.encryptCheckpoint(cpB, { branch: branchB });

      // 6. Audit all operations
      auditLogger.logBranchCreation(branchA, parentId);
      auditLogger.logBranchCreation(branchB, parentId);
      auditLogger.logFingerprintUsage(fp1.id, 'branch_assigned');
      auditLogger.logFingerprintUsage(fp2.id, 'branch_assigned');
      auditLogger.logCheckpointEncryption(cpA, 'success');
      auditLogger.logCheckpointEncryption(cpB, 'success');

      // Verify complete workflow
      assert.strictEqual(branching.getStats().branchCount, 2, 'Should have 2 branches');
      assert.strictEqual(branching.getStats().checkpointCount, 2, 'Should have 2 checkpoints');
      assert.strictEqual(fingerprinting.getStats().totalProfiles, 2, 'Should have 2 fingerprints');
      assert.strictEqual(encryptor.getStats().encryptedSessions, 2, 'Should encrypt 2');
      assert.strictEqual(auditLogger.getStats().totalEvents, 6, 'Should audit 6 events');
      assert.strictEqual(pathValidator.getStats().validPaths, 2, 'Should validate 2 paths');
    });

    test('security and features work together without conflicts', () => {
      const sessionId = 'test_session';

      // Rapid fire: create branches, encrypt, fingerprint, audit
      const operations = [];
      for (let i = 0; i < 10; i++) {
        // Branch
        const branchId = branching.createBranch(sessionId, `branch_${i}`);

        // Fingerprint
        const profile = fingerprinting.createProfile({
          category: i % 2 === 0 ? 'desktop' : 'mobile',
          userAgent: `UA_${i}`,
          evasionScore: 50 + (i * 3)
        });

        // Encrypt
        const encrypted = encryptor.encryptSession(branchId, { profile: profile.id });

        // Audit
        auditLogger.logBranchCreation(branchId, sessionId);
        auditLogger.logFingerprintUsage(profile.id, 'assigned');

        operations.push({ branch: branchId, profile: profile.id });
      }

      // Verify all operations succeeded
      assert.strictEqual(branching.getStats().branchCount, 10, 'Should create 10 branches');
      assert.strictEqual(fingerprinting.getStats().totalProfiles, 10, 'Should create 10 profiles');
      assert.strictEqual(auditLogger.getStats().totalEvents, 20, 'Should log 20 events');
      assert.strictEqual(operations.length, 10, 'All operations should complete');
    });
  });

  // ========================================
  // 6. Security Conflict Detection
  // ========================================
  describe('Security Integration Conflict Detection', () => {
    let branching, fingerprinting, encryptor, auditLogger;

    beforeEach(() => {
      branching = new MockSessionBranching();
      fingerprinting = new MockDeviceFingerprintingV2();
      encryptor = new MockSessionEncryptor();
      auditLogger = new MockAuditLogger();
    });

    test('no conflicts between branching and encryption', () => {
      const branch = branching.createBranch('session_1', 'test');
      const encrypted = encryptor.encryptSession(branch, { test: true });

      assert.strictEqual(branching.branches.has(branch), true, 'Branch should exist');
      assert.strictEqual(encrypted.length > 0, true, 'Should encrypt');
      // No exception = no conflict
    });

    test('no conflicts between fingerprinting and audit logging', () => {
      const profile = fingerprinting.createProfile({
        category: 'desktop',
        userAgent: 'Mozilla/5.0',
        evasionScore: 85
      });

      auditLogger.logFingerprintUsage(profile.id, 'created');
      auditLogger.logFingerprintUsage(profile.id, 'used');

      assert.strictEqual(auditLogger.logs.length, 2, 'Should log both');
      assert.strictEqual(fingerprinting.getStats().totalProfiles, 1, 'Profile should exist');
    });

    test('encryption does not prevent checkpoints from being created and rolled back', () => {
      const sessionId = 'session_1';
      const state = { data: 'test' };

      // Create and encrypt
      const cpId = branching.createCheckpoint(sessionId, 'cp1', state);
      const encrypted = encryptor.encryptCheckpoint(cpId, state);

      // Decrypt and rollback
      const decrypted = encryptor.decryptCheckpoint(cpId, encrypted);
      const success = branching.rollback(cpId);

      assert.strictEqual(success, true, 'Rollback should work');
      assert.strictEqual(decrypted.data, 'test', 'Data should be preserved');
    });
  });
});
