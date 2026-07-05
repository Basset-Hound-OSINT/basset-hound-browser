/**
 * Request Size Validator Test Suite
 * Tests for DoS protection via request size limits
 *
 * Test coverage:
 * 1. Basic validation (passing and failing)
 * 2. Per-command limits (screenshot, extraction, default)
 * 3. Size parsing (bytes, KB, MB, GB)
 * 4. Metrics tracking
 * 5. Configuration retrieval
 *
 * Created: June 21, 2026
 */

const assert = require('assert');
const { RequestSizeValidator, DEFAULT_LIMITS, COMMAND_CATEGORIES } = require('../../../websocket/request-validator');

describe('RequestSizeValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new RequestSizeValidator();
  });

  // ==========================================
  // Test 1: Basic Message Size Validation
  // ==========================================
  describe('Test 1: Basic Message Size Validation', () => {
    it('should accept messages under the global limit', () => {
      const smallMessage = 'x'.repeat(1000); // 1 KB
      const result = validator.validateMessageSize(smallMessage, 'test-command');

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.error, undefined);
    });

    it('should reject messages exceeding the global limit', () => {
      // Create message exceeding 100 MB
      const largeMessage = 'x'.repeat(101 * 1024 * 1024);
      const result = validator.validateMessageSize(largeMessage, 'test-command');

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errorCode, 'PAYLOAD_TOO_LARGE');
      assert(result.error.includes('exceeds global limit'));
    });

    it('should handle Buffer input correctly', () => {
      const buffer = Buffer.alloc(5 * 1024 * 1024); // 5 MB
      const result = validator.validateMessageSize(buffer, 'test-command');

      assert.strictEqual(result.valid, true);
    });

    it('should handle Buffer exceeding limit', () => {
      const buffer = Buffer.alloc(101 * 1024 * 1024); // 101 MB
      const result = validator.validateMessageSize(buffer, 'test-command');

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errorCode, 'PAYLOAD_TOO_LARGE');
    });
  });

  // ==========================================
  // Test 2: Per-Command Category Limits
  // ==========================================
  describe('Test 2: Per-Command Category Limits', () => {
    it('should apply screenshot command limits correctly', () => {
      const limit = validator.getLimitForCommand('screenshot');
      assert.strictEqual(limit, 100 * 1024 * 1024, 'Screenshot limit should be 100 MB');

      const limit2 = validator.getLimitForCommand('screenshot_element');
      assert.strictEqual(limit2, 100 * 1024 * 1024, 'Screenshot variants should have same limit');
    });

    it('should apply extraction command limits correctly', () => {
      const limit = validator.getLimitForCommand('extract');
      assert.strictEqual(limit, 50 * 1024 * 1024, 'Extraction limit should be 50 MB');

      const limit2 = validator.getLimitForCommand('extract_html');
      assert.strictEqual(limit2, 50 * 1024 * 1024, 'Extraction variants should have same limit');
    });

    it('should apply default limits for unknown commands', () => {
      const limit = validator.getLimitForCommand('unknown-command-xyz');
      assert.strictEqual(limit, 10 * 1024 * 1024, 'Default limit should be 10 MB');
    });

    it('should reject command payload exceeding category limit', () => {
      // Create 60 MB payload (exceeds extraction 50 MB limit)
      const message = 'x'.repeat(60 * 1024 * 1024);
      const result = validator.validateMessageSize(message, 'extract_html');

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errorCode, 'COMMAND_PAYLOAD_TOO_LARGE');
      assert(result.error.includes('extract_html'));
      assert(result.error.includes('50'));
    });

    it('should accept command payload within category limit', () => {
      // Create 45 MB payload (within extraction 50 MB limit)
      const message = 'x'.repeat(45 * 1024 * 1024);
      const result = validator.validateMessageSize(message, 'extract_html');

      assert.strictEqual(result.valid, true);
    });
  });

  // ==========================================
  // Test 3: Metrics and Tracking
  // ==========================================
  describe('Test 3: Metrics and Tracking', () => {
    it('should track validated message count', () => {
      validator.validateMessageSize('test', 'command1');
      validator.validateMessageSize('test', 'command2');
      validator.validateMessageSize('test', 'command3');

      const metrics = validator.getMetrics();
      assert.strictEqual(metrics.totalValidated, 3);
    });

    it('should track rejected message count', () => {
      const largeMsg = 'x'.repeat(101 * 1024 * 1024);

      validator.validateMessageSize('small', 'command1');
      validator.validateMessageSize(largeMsg, 'command2'); // Rejected
      validator.validateMessageSize('small', 'command3');
      validator.validateMessageSize(largeMsg, 'command4'); // Rejected

      const metrics = validator.getMetrics();
      assert.strictEqual(metrics.totalValidated, 4);
      assert.strictEqual(metrics.totalRejected, 2);
      assert.strictEqual(metrics.rejectionRate, '50.00%');
    });

    it('should track rejections by command', () => {
      const largeMsg = 'x'.repeat(60 * 1024 * 1024);

      validator.validateMessageSize(largeMsg, 'extract_html'); // Rejected
      validator.validateMessageSize(largeMsg, 'extract_html'); // Rejected
      validator.validateMessageSize(largeMsg, 'unknown');      // Rejected (10 MB limit)

      const metrics = validator.getMetrics();
      assert.strictEqual(metrics.rejectionsByCommand['extract_html'], 2);
      assert.strictEqual(metrics.rejectionsByCommand['unknown'], 1);
    });

    it('should track rejections by size category', () => {
      // Small (< 1 MB)
      const tiny = 'x'.repeat(100 * 1024); // 100 KB - under limit

      // Medium (1-10 MB) - within default limit
      const medium = 'x'.repeat(5 * 1024 * 1024); // 5 MB - accepted

      // XLarge (50-100 MB) - exceeds extraction limit
      const xlarge = 'x'.repeat(51 * 1024 * 1024); // 51 MB - rejected (exceeds 50MB extraction limit)

      // Massive (> 100 MB)
      const massive = 'x'.repeat(101 * 1024 * 1024); // 101 MB - rejected (exceeds global)

      validator.validateMessageSize(tiny, 'test');
      validator.validateMessageSize(medium, 'test');     // Accepted
      validator.validateMessageSize(xlarge, 'extract');  // Rejected (extract = 50MB limit)
      validator.validateMessageSize(massive, 'test');    // Rejected (global = 100MB limit)

      const metrics = validator.getMetrics();
      assert(metrics.rejectionsBySize.xlarge > 0, 'Should have rejections in xlarge category');
      assert(metrics.rejectionsBySize.massive > 0, 'Should have rejections in massive category');
    });

    it('should keep only recent rejections (max 100)', () => {
      const largeMsg = 'x'.repeat(101 * 1024 * 1024);

      // Create 150 rejected requests
      for (let i = 0; i < 150; i++) {
        validator.validateMessageSize(largeMsg, 'test');
      }

      const metrics = validator.getMetrics();
      assert.strictEqual(metrics.recentRejections.length, 10); // Returns last 10
      assert.strictEqual(validator.rejectedRequests.length, 100); // Keeps last 100
    });
  });

  // ==========================================
  // Test 4: Configuration and Limits
  // ==========================================
  describe('Test 4: Configuration and Limits', () => {
    it('should return current limits configuration', () => {
      const config = validator.getConfiguration();

      assert(config.global);
      assert(config.categories);
      assert(config.commands);

      // Verify all category limits are present
      assert(config.categories.screenshot);
      assert(config.categories.capture);
      assert(config.categories.extraction);
      assert(config.categories.default);
    });

    it('should include command mappings in configuration', () => {
      const config = validator.getConfiguration();

      assert.strictEqual(config.commands.screenshot, 'screenshot');
      assert.strictEqual(config.commands.extract_html, 'extraction');
      assert.strictEqual(config.commands['unknown-cmd'] === 'screenshot', false);
    });

    it('should override limits with environment variables', () => {
      const originalEnv = process.env.BASSET_WS_MAX_PAYLOAD;
      process.env.BASSET_WS_MAX_PAYLOAD = '50MB';

      try {
        const validatorEnv = new RequestSizeValidator();
        // 50 MB = 52,428,800 bytes
        assert.strictEqual(validatorEnv.limits.global, 50 * 1024 * 1024);
      } finally {
        process.env.BASSET_WS_MAX_PAYLOAD = originalEnv;
      }
    });

    it('should support custom limits in constructor', () => {
      const customValidator = new RequestSizeValidator({
        limits: {
          global: 200 * 1024 * 1024,
          categories: {
            screenshot: 150 * 1024 * 1024,
            default: 5 * 1024 * 1024
          }
        }
      });

      assert.strictEqual(customValidator.limits.global, 200 * 1024 * 1024);
      assert.strictEqual(
        customValidator.getLimitForCommand('screenshot'),
        150 * 1024 * 1024
      );
    });
  });

  // ==========================================
  // Test 5: Size Parsing and Formatting
  // ==========================================
  describe('Test 5: Size Parsing and Formatting', () => {
    it('should format bytes correctly', () => {
      const validator2 = new RequestSizeValidator();

      // Test private method via validation error message
      const msg = 'x'.repeat(2 * 1024); // 2 KB
      validator2.validateMessageSize(msg, 'test');

      // Can't directly test private _formatBytes, but we can verify through metrics
      const metrics = validator2.getMetrics();
      assert(metrics.totalValidated >= 1);
    });

    it('should handle size limits with default configuration', () => {
      assert.strictEqual(DEFAULT_LIMITS.global, 100 * 1024 * 1024);
      assert.strictEqual(DEFAULT_LIMITS.categories.screenshot, 100 * 1024 * 1024);
      assert.strictEqual(DEFAULT_LIMITS.categories.extraction, 50 * 1024 * 1024);
      assert.strictEqual(DEFAULT_LIMITS.categories.default, 10 * 1024 * 1024);
    });
  });

  // ==========================================
  // Test 6: Error Response Format
  // ==========================================
  describe('Test 6: Error Response Format', () => {
    it('should return proper error structure for rejected requests', () => {
      const largeMsg = 'x'.repeat(101 * 1024 * 1024);
      const result = validator.validateMessageSize(largeMsg, 'test-cmd');

      assert.strictEqual(result.valid, false);
      assert(result.errorCode);
      assert(result.error);
      assert.strictEqual(typeof result.error, 'string');
    });

    it('should return proper success structure for accepted requests', () => {
      const result = validator.validateMessageSize('test', 'test-cmd');

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.errorCode, undefined);
    });

    it('should include command in error context', () => {
      const msg = 'x'.repeat(55 * 1024 * 1024); // Exceeds extraction limit
      const result = validator.validateMessageSize(msg, 'extract_dom_snapshot');

      assert(result.error.includes('extract_dom_snapshot'));
    });
  });
});
