/**
 * Path Validator Unit Tests
 *
 * Tests for path traversal prevention and file access validation
 *
 * @test 12 comprehensive test cases covering:
 * - Path resolution and normalization
 * - Directory whitelist enforcement
 * - Symlink attack prevention
 * - Parent directory traversal prevention
 * - Null byte injection prevention
 * - Multiple path validation
 * - Statistics tracking
 * - Violation logging
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PathValidator, getInstance, validateReadPath, validateWritePath, validateDeletePath, safeReadFile, safeWriteFile } = require('../../utils/path-validator');

describe('PathValidator - Path Traversal Prevention', function () {
  let validator;
  let tempDir;

  before(function () {
    // Create temporary test directory
    tempDir = path.join(os.tmpdir(), `basset-test-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  after(function () {
    // Cleanup temporary files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(function () {
    // Create fresh validator instance for each test
    validator = new PathValidator({
      allowedDirs: [tempDir],
      logViolations: false
    });
  });

  /**
   * Test 1: Valid file path within allowed directory
   */
  it('should validate file paths within allowed directories', function () {
    const filePath = path.join(tempDir, 'test.txt');
    const result = validator.validatePath(filePath, 'read');

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.realPath, filePath);
  });

  /**
   * Test 2: Reject paths outside allowed directories
   */
  it('should reject paths outside allowed directories', function () {
    const parentDir = path.dirname(tempDir);
    const filePath = path.join(parentDir, 'unauthorized.txt');
    const result = validator.validatePath(filePath, 'read');

    assert.strictEqual(result.valid, false);
    assert.ok(result.error);
    assert.strictEqual(result.realPath, null);
  });

  /**
   * Test 3: Prevent parent directory traversal with ../
   */
  it('should prevent parent directory traversal with ../', function () {
    const filePath = path.join(tempDir, '..', '..', 'etc', 'passwd');
    const result = validator.validatePath(filePath, 'read');

    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('outside allowed'));
  });

  /**
   * Test 4: Reject null byte injection
   */
  it('should reject paths with null byte injection', function () {
    const filePath = path.join(tempDir, 'test\0.txt');
    const result = validator.validatePath(filePath, 'read');

    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('Null byte'));
  });

  /**
   * Test 5: Validate nested directories within allowed path
   */
  it('should allow nested directories within allowed path', function () {
    const nestedDir = path.join(tempDir, 'a', 'b', 'c', 'd');
    const filePath = path.join(nestedDir, 'file.txt');
    const result = validator.validatePath(filePath, 'write');

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.error, null);
  });

  /**
   * Test 6: Multiple path validation
   */
  it('should validate multiple paths and report individual results', function () {
    const paths = [
      path.join(tempDir, 'valid1.txt'),
      path.join(tempDir, '..', 'invalid.txt'),
      path.join(tempDir, 'valid2.txt')
    ];

    const result = validator.validatePaths(paths, 'read');

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.validPaths.length, 2);
    assert.strictEqual(result.errors.length, 1);
  });

  /**
   * Test 7: Track and report statistics
   */
  it('should track validation statistics correctly', function () {
    validator.validatePath(path.join(tempDir, 'test1.txt'), 'read');
    validator.validatePath(path.join(tempDir, '..', 'invalid.txt'), 'read');
    validator.validatePath(path.join(tempDir, 'test2.txt'), 'read');

    const stats = validator.getStats();

    assert.strictEqual(stats.totalValidations, 3);
    assert.strictEqual(stats.passedValidations, 2);
    assert.strictEqual(stats.failedValidations, 1);
  });

  /**
   * Test 8: Log and retrieve violations
   */
  it('should log and retrieve security violations', function () {
    const invalidPath = path.join(tempDir, '..', 'invalid.txt');
    validator.validatePath(invalidPath, 'read');

    const violations = validator.getViolations();

    assert.ok(violations.length > 0);
    assert.ok(violations[0].reason);
    assert.ok(violations[0].timestamp);
    assert.strictEqual(violations[0].operation, 'read');
  });

  /**
   * Test 9: Add and remove allowed directories dynamically
   */
  it('should allow dynamic management of allowed directories', function () {
    const newDir = path.join(os.tmpdir(), `basset-new-${Date.now()}`);
    fs.mkdirSync(newDir, { recursive: true });

    try {
      // Initially should fail
      let result = validator.validatePath(path.join(newDir, 'test.txt'), 'read');
      assert.strictEqual(result.valid, false);

      // Add directory
      validator.addAllowedDir(newDir);

      // Should now pass
      result = validator.validatePath(path.join(newDir, 'test.txt'), 'read');
      assert.strictEqual(result.valid, true);

      // Remove directory
      validator.removeAllowedDir(newDir);

      // Should fail again
      result = validator.validatePath(path.join(newDir, 'test.txt'), 'read');
      assert.strictEqual(result.valid, false);
    } finally {
      fs.rmSync(newDir, { recursive: true, force: true });
    }
  });

  /**
   * Test 10: Invalid input handling
   */
  it('should reject invalid path inputs', function () {
    const results = [
      validator.validatePath(null, 'read'),
      validator.validatePath(undefined, 'read'),
      validator.validatePath(123, 'read'),
      validator.validatePath('', 'read')
    ];

    results.forEach(result => {
      assert.strictEqual(result.valid, false);
      assert.ok(result.error);
    });
  });

  /**
   * Test 11: Symlink attack prevention
   */
  it('should detect symlink escapes on write operations', function () {
    // Create a test file outside temp directory
    const targetDir = path.join(os.tmpdir(), `basset-target-${Date.now()}`);
    fs.mkdirSync(targetDir, { recursive: true });

    try {
      const targetFile = path.join(targetDir, 'target.txt');
      fs.writeFileSync(targetFile, 'secret');

      // Create symlink within allowed directory
      const symlinkPath = path.join(tempDir, 'link.txt');
      try {
        fs.symlinkSync(targetFile, symlinkPath);

        // Validation should detect symlink escape
        const result = validator.validatePath(symlinkPath, 'write');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('outside allowed'));
      } catch (err) {
        // Symlinks may not be supported on all systems (e.g., Windows without admin)
        if (!err.message.includes('EPERM') && !err.message.includes('not permitted')) {
          throw err;
        }
      }
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });

  /**
   * Test 12: Safe file read wrapper
   */
  it('should safely read files with path validation', function () {
    const localValidator = new PathValidator({
      allowedDirs: [tempDir],
      logViolations: false
    });

    const filePath = path.join(tempDir, 'safe-read-test.txt');
    const testContent = 'Safe read test content';
    fs.writeFileSync(filePath, testContent);

    try {
      const result = safeReadFile(filePath, 'utf8', localValidator);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data, testContent);
      assert.strictEqual(result.error, null);

      // Invalid path should fail
      const invalidPath = path.join(tempDir, '..', 'invalid.txt');
      const invalidResult = safeReadFile(invalidPath, 'utf8', localValidator);

      assert.strictEqual(invalidResult.success, false);
      assert.ok(invalidResult.error);
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  /**
   * Test 13: Safe file write wrapper
   */
  it('should safely write files with path validation', function () {
    const localValidator = new PathValidator({
      allowedDirs: [tempDir],
      logViolations: false
    });

    const filePath = path.join(tempDir, 'nested', 'safe-write-test.txt');
    const testContent = 'Safe write test content';

    try {
      const result = safeWriteFile(filePath, testContent, { validator: localValidator });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.path, filePath);
      assert.strictEqual(result.error, null);

      // Verify file was written
      const readContent = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(readContent, testContent);

      // Invalid path should fail
      const invalidPath = path.join(tempDir, '..', 'invalid.txt');
      const invalidResult = safeWriteFile(invalidPath, 'test', { validator: localValidator });

      assert.strictEqual(invalidResult.success, false);
      assert.ok(invalidResult.error);
    } finally {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  /**
   * Test 14: Singleton instance management
   */
  it('should manage singleton instance correctly', function () {
    const instance1 = getInstance();
    const instance2 = getInstance();

    assert.strictEqual(instance1, instance2);
  });

  /**
   * Test 15: Violation event emission
   */
  it('should emit violation events for failed validations', function (done) {
    let violationCaught = false;

    validator.once('violation', (violation) => {
      violationCaught = true;
      assert.ok(violation.reason);
      assert.ok(violation.timestamp);
    });

    validator.validatePath(path.join(tempDir, '..', 'invalid.txt'), 'read');

    setTimeout(() => {
      assert.strictEqual(violationCaught, true);
      done();
    }, 10);
  });
});

describe('PathValidator - Wrapper Functions', function () {
  let tempDir;

  before(function () {
    tempDir = path.join(os.tmpdir(), `basset-wrapper-test-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Configure singleton instance
    const instance = getInstance();
    instance.allowedDirs = [tempDir];
  });

  after(function () {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should validate read paths correctly', function () {
    const filePath = path.join(tempDir, 'test.txt');
    const result = validateReadPath(filePath);

    assert.strictEqual(result.valid, true);
  });

  it('should validate write paths correctly', function () {
    const filePath = path.join(tempDir, 'test.txt');
    const result = validateWritePath(filePath);

    assert.strictEqual(result.valid, true);
  });

  it('should validate delete paths correctly', function () {
    const filePath = path.join(tempDir, 'test.txt');
    const result = validateDeletePath(filePath);

    assert.strictEqual(result.valid, true);
  });
});
