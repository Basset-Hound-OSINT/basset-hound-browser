/**
 * Path Validator Integration Tests
 *
 * Tests path validation integration with:
 * - WebSocket export commands
 * - File operations in command handlers
 * - SSL certificate validation
 *
 * @test Comprehensive integration tests covering path validation in command execution
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PathValidator, getInstance: getPathValidator } = require('../../utils/path-validator');

describe('Path Validator Integration - Export Commands', function () {
  let tempDir;
  let validator;

  before(function () {
    // Create temporary test directory
    tempDir = path.join(os.tmpdir(), `basset-export-test-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Initialize path validator with test directory
    validator = new PathValidator({
      allowedDirs: [tempDir],
      logViolations: false
    });
  });

  after(function () {
    // Cleanup temporary files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Test 1: Validate export paths before file operations
   */
  it('should validate export paths before writing files', function () {
    const exportPath = path.join(tempDir, 'export.json');
    const validation = validator.validatePath(exportPath, 'write');

    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.error, null);
    assert.ok(fs.existsSync(path.dirname(exportPath)) || !fs.existsSync(exportPath));
  });

  /**
   * Test 2: Reject traversal attempts in export commands
   */
  it('should reject path traversal attempts in export commands', function () {
    const traversalPath = path.join(tempDir, '..', '..', 'etc', 'passwd');
    const validation = validator.validatePath(traversalPath, 'write');

    assert.strictEqual(validation.valid, false);
    assert.ok(validation.error.includes('outside allowed'));
  });

  /**
   * Test 3: Validate nested directory creation
   */
  it('should allow nested directory creation within allowed path', function () {
    const nestedPath = path.join(tempDir, 'nested', 'deep', 'structure', 'export.json');
    const validation = validator.validatePath(nestedPath, 'write');

    assert.strictEqual(validation.valid, true);
  });

  /**
   * Test 4: Detect directory escape via relative paths
   */
  it('should detect directory escape via relative paths', function () {
    const escapePath = path.join(tempDir, '.', '..', '..', 'test.json');
    const validation = validator.validatePath(escapePath, 'write');

    // The path should resolve to outside allowed directory
    assert.strictEqual(validation.valid, false);
  });

  /**
   * Test 5: Handle special characters in filenames
   */
  it('should handle special characters in filenames', function () {
    const specialPath = path.join(tempDir, 'export-2024_01_15.json');
    const validation = validator.validatePath(specialPath, 'write');

    assert.strictEqual(validation.valid, true);
  });

  /**
   * Test 6: Prevent absolute path escapes
   */
  it('should prevent absolute path escapes', function () {
    const absolutePath = '/etc/passwd';
    const validation = validator.validatePath(absolutePath, 'read');

    assert.strictEqual(validation.valid, false);
    assert.ok(validation.error);
  });

  /**
   * Test 7: Validate read operations on existing files
   */
  it('should validate read operations on existing files', function () {
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'test content');

    try {
      const validation = validator.validatePath(testFile, 'read');

      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.realPath, testFile);
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  /**
   * Test 8: Track multiple violations
   */
  it('should track multiple path violations for audit trail', function () {
    const invalidPaths = [
      path.join(tempDir, '..', '..', 'attack1.txt'),
      path.join(tempDir, '..', '..', 'attack2.txt'),
      path.join(tempDir, '..', '..', 'attack3.txt')
    ];

    invalidPaths.forEach(p => {
      validator.validatePath(p, 'write');
    });

    const violations = validator.getViolations();
    assert.ok(violations.length >= 3);
  });

  /**
   * Test 9: Validate consecutive path operations
   */
  it('should handle consecutive path validations', function () {
    const paths = [
      path.join(tempDir, 'file1.json'),
      path.join(tempDir, 'nested', 'file2.csv'),
      path.join(tempDir, 'nested', 'deep', 'file3.xml')
    ];

    const results = validator.validatePaths(paths, 'write');

    assert.strictEqual(results.valid, true);
    assert.strictEqual(results.validPaths.length, 3);
    assert.strictEqual(results.errors.length, 0);
  });

  /**
   * Test 10: Handle mixed valid and invalid paths
   */
  it('should report individual failures in mixed path lists', function () {
    const paths = [
      path.join(tempDir, 'valid1.json'),
      path.join(tempDir, '..', '..', 'invalid.txt'),
      path.join(tempDir, 'valid2.json'),
      path.join(tempDir, '..', 'invalid2.txt')
    ];

    const results = validator.validatePaths(paths, 'write');

    assert.strictEqual(results.valid, false);
    assert.strictEqual(results.validPaths.length, 2);
    assert.strictEqual(results.errors.length, 2);
  });
});

describe('Path Validator Integration - SSL Certificates', function () {
  let tempDir;
  let validator;

  before(function () {
    tempDir = path.join(os.tmpdir(), `basset-ssl-test-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    validator = new PathValidator({
      allowedDirs: [tempDir],
      logViolations: false
    });
  });

  after(function () {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Test 11: Validate SSL certificate paths
   */
  it('should validate SSL certificate paths', function () {
    const certPath = path.join(tempDir, 'cert.pem');
    const keyPath = path.join(tempDir, 'key.pem');

    fs.writeFileSync(certPath, '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----');
    fs.writeFileSync(keyPath, '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----');

    try {
      const certValidation = validator.validatePath(certPath, 'read');
      const keyValidation = validator.validatePath(keyPath, 'read');

      assert.strictEqual(certValidation.valid, true);
      assert.strictEqual(keyValidation.valid, true);
    } finally {
      if (fs.existsSync(certPath)) fs.unlinkSync(certPath);
      if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
    }
  });

  /**
   * Test 12: Reject certificate paths outside allowed directories
   */
  it('should reject certificate paths outside allowed directories', function () {
    const unsafePath = path.join(tempDir, '..', 'certs', 'cert.pem');
    const validation = validator.validatePath(unsafePath, 'read');

    assert.strictEqual(validation.valid, false);
  });
});

describe('Path Validator Integration - Configuration', function () {
  let tempDir1;
  let tempDir2;
  let validator;

  before(function () {
    tempDir1 = path.join(os.tmpdir(), `basset-config-test1-${Date.now()}`);
    tempDir2 = path.join(os.tmpdir(), `basset-config-test2-${Date.now()}`);

    fs.mkdirSync(tempDir1, { recursive: true });
    fs.mkdirSync(tempDir2, { recursive: true });

    validator = new PathValidator({
      allowedDirs: [tempDir1],
      logViolations: false
    });
  });

  after(function () {
    if (fs.existsSync(tempDir1)) {
      fs.rmSync(tempDir1, { recursive: true, force: true });
    }
    if (fs.existsSync(tempDir2)) {
      fs.rmSync(tempDir2, { recursive: true, force: true });
    }
  });

  /**
   * Test 13: Dynamic directory allowlist management
   */
  it('should allow dynamic management of allowed directories', function () {
    const testPath2 = path.join(tempDir2, 'test.txt');

    // Should fail initially
    let validation = validator.validatePath(testPath2, 'write');
    assert.strictEqual(validation.valid, false);

    // Add directory
    validator.addAllowedDir(tempDir2);

    // Should pass now
    validation = validator.validatePath(testPath2, 'write');
    assert.strictEqual(validation.valid, true);

    // Remove and verify failure
    validator.removeAllowedDir(tempDir2);
    validation = validator.validatePath(testPath2, 'write');
    assert.strictEqual(validation.valid, false);
  });

  /**
   * Test 14: Get allowed directories
   */
  it('should retrieve current allowed directories', function () {
    const allowedDirs = validator.getAllowedDirs();

    assert.ok(Array.isArray(allowedDirs));
    assert.ok(allowedDirs.length > 0);
    assert.ok(allowedDirs.includes(tempDir1));
  });

  /**
   * Test 15: Statistics tracking
   */
  it('should track validation statistics accurately', function () {
    const validator2 = new PathValidator({
      allowedDirs: [tempDir1],
      logViolations: false
    });

    // Perform multiple validations
    validator2.validatePath(path.join(tempDir1, 'valid1.txt'), 'read');
    validator2.validatePath(path.join(tempDir1, 'valid2.txt'), 'read');
    validator2.validatePath(path.join(tempDir2, 'invalid.txt'), 'read');

    const stats = validator2.getStats();

    assert.strictEqual(stats.totalValidations, 3);
    assert.strictEqual(stats.passedValidations, 2);
    assert.strictEqual(stats.failedValidations, 1);
  });
});

describe('Path Validator Integration - Security Events', function () {
  let tempDir;
  let validator;

  before(function () {
    tempDir = path.join(os.tmpdir(), `basset-security-test-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    validator = new PathValidator({
      allowedDirs: [tempDir],
      logViolations: false
    });
  });

  after(function () {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Test 16: Violation event emission and tracking
   */
  it('should emit violation events for security audit', function (done) {
    const validator2 = new PathValidator({
      allowedDirs: [tempDir],
      logViolations: false
    });

    let violationCount = 0;

    validator2.on('violation', (violation) => {
      violationCount++;
      assert.ok(violation.reason);
      assert.ok(violation.timestamp);
      assert.ok(violation.stackTrace);
    });

    // Trigger violations
    validator2.validatePath(path.join(tempDir, '..', 'invalid1.txt'), 'read');
    validator2.validatePath(path.join(tempDir, '..', 'invalid2.txt'), 'read');

    setTimeout(() => {
      assert.strictEqual(violationCount, 2);
      done();
    }, 20);
  });

  /**
   * Test 17: Clear violation history
   */
  it('should allow clearing violation history', function () {
    const validator2 = new PathValidator({
      allowedDirs: [tempDir],
      logViolations: false
    });

    validator2.validatePath(path.join(tempDir, '..', 'invalid.txt'), 'read');

    let violations = validator2.getViolations();
    assert.ok(violations.length > 0);

    validator2.clearViolations();

    violations = validator2.getViolations();
    assert.strictEqual(violations.length, 0);
  });
});
