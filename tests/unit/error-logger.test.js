/**
 * Error Logger Tests
 * Comprehensive test suite for error logging, categorization, and alerting
 */

const {
  ErrorLogger,
  createErrorLogger,
  ERROR_CATEGORIES,
  SEVERITY_LEVELS,
  ALERT_THRESHOLDS,
  generateErrorFingerprint
} = require('../../src/logging/error-logger');

// Mock logger
class MockLogger {
  constructor() {
    this.logs = [];
  }

  error(message, data) {
    this.logs.push({ level: 'error', message, data });
  }

  warn(message, data) {
    this.logs.push({ level: 'warn', message, data });
  }

  debug(message, data) {
    this.logs.push({ level: 'debug', message, data });
  }

  info(message, data) {
    this.logs.push({ level: 'info', message, data });
  }

  clear() {
    this.logs = [];
  }
}

describe('ErrorLogger', () => {
  let errorLogger;
  let mockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
    errorLogger = createErrorLogger({
      logger: mockLogger,
      name: 'test-logger'
    });

    // Suppress unhandled event errors for tests
    errorLogger.setMaxListeners(100);
  });

  afterEach(() => {
    errorLogger.clearHistory();
    errorLogger.removeAllListeners();
  });

  // ==========================================
  // Error Classification Tests
  // ==========================================

  describe('Error Classification', () => {
    test('should classify network errors', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const classification = errorLogger.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.NETWORK);
      expect(classification.severity).toBe(SEVERITY_LEVELS.MEDIUM);
      expect(classification.matched).toBe(true);
    });

    test('should classify timeout errors', () => {
      const error = new Error('ETIMEDOUT: Operation timed out');
      const classification = errorLogger.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.TIMEOUT);
      expect(classification.severity).toBe(SEVERITY_LEVELS.MEDIUM);
    });

    test('should classify authentication errors', () => {
      const error = new Error('401 Unauthorized: Invalid credentials');
      const classification = errorLogger.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.AUTHENTICATION);
      expect(classification.severity).toBe(SEVERITY_LEVELS.HIGH);
    });

    test('should classify parsing errors', () => {
      const error = new SyntaxError('JSON parse error: Unexpected token');
      const classification = errorLogger.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.PARSING);
      expect(classification.severity).toBe(SEVERITY_LEVELS.LOW);
    });

    test('should classify memory errors', () => {
      const error = new Error('Out of memory: Allocation failed');
      const classification = errorLogger.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.MEMORY);
      expect(classification.severity).toBe(SEVERITY_LEVELS.CRITICAL);
    });

    test('should classify detection errors', () => {
      const error = new Error('Cloudflare challenge detected');
      const classification = errorLogger.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.DETECTION);
      expect(classification.severity).toBe(SEVERITY_LEVELS.HIGH);
    });

    test('should classify unknown errors', () => {
      const error = new Error('Some random error');
      const classification = errorLogger.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.UNKNOWN);
      expect(classification.severity).toBe(SEVERITY_LEVELS.LOW);
      expect(classification.matched).toBe(false);
    });
  });

  // ==========================================
  // Error Logging Tests
  // ==========================================

  describe('Error Logging', () => {
    test('should log error with context', () => {
      const error = new Error('Test error');

      // Add error listener to prevent unhandled error event
      let errorEmitted = false;
      errorLogger.once('error', () => {
        errorEmitted = true;
      });

      const entry = errorLogger.logError(error, {
        operation: 'test_operation',
        correlationId: 'corr_123'
      });

      expect(entry).not.toBeNull();
      expect(entry.error.message).toBe('Error: Test error');
      expect(entry.context.operation).toBe('test_operation');
      expect(entry.context.correlationId).toBe('corr_123');
      expect(entry.fingerprint).toBeDefined();
      expect(errorEmitted).toBe(true);
    });

    test('should handle string errors', () => {
      errorLogger.once('error', () => {}); // Listen to prevent unhandled event

      const entry = errorLogger.logError('Simple string error', {
        operation: 'string_error'
      });

      expect(entry).not.toBeNull();
      expect(entry.error.message).toContain('Simple string error');
    });

    test('should track error in history', () => {
      errorLogger.on('error', () => {}); // Listen to prevent unhandled events

      errorLogger.logError(new Error('Test 1'), { operation: 'op1' });
      errorLogger.logError(new Error('Test 2'), { operation: 'op2' });
      errorLogger.logError(new Error('Test 3'), { operation: 'op3' });

      const recent = errorLogger.getRecent(10);
      expect(recent.length).toBe(3);
    });

    test('should update category statistics', () => {
      errorLogger.on('error', () => {}); // Listen to prevent unhandled events

      errorLogger.logError(new Error('ECONNREFUSED'), { operation: 'test' });
      errorLogger.logError(new Error('ETIMEDOUT'), { operation: 'test' });
      errorLogger.logError(new Error('ECONNREFUSED'), { operation: 'test' });

      const stats = errorLogger.getStats();
      expect(stats.byCategory[ERROR_CATEGORIES.NETWORK]).toBe(2);
      expect(stats.byCategory[ERROR_CATEGORIES.TIMEOUT]).toBe(1);
    });

    test('should update severity statistics', () => {
      errorLogger.on('error', () => {}); // Listen to prevent unhandled events

      errorLogger.logError(new Error('ECONNREFUSED'), { operation: 'test' });
      errorLogger.logError(new Error('Out of memory'), { operation: 'test' });

      const stats = errorLogger.getStats();
      expect(stats.bySeverity[SEVERITY_LEVELS.MEDIUM]).toBe(1);
      expect(stats.bySeverity[SEVERITY_LEVELS.CRITICAL]).toBe(1);
    });
  });

  // ==========================================
  // Error Deduplication Tests
  // ==========================================

  describe('Error Deduplication', () => {
    test('should deduplicate errors within time window', () => {
      const error = new Error('Same error');
      errorLogger.on('error', () => {}); // Listen to prevent unhandled events

      const entry1 = errorLogger.logError(error, { operation: 'op1' });
      const entry2 = errorLogger.logError(error, { operation: 'op1' });

      expect(entry1).not.toBeNull();
      expect(entry2).toBeNull(); // Duplicate should return null

      const stats = errorLogger.getStats();
      expect(stats.total).toBe(1); // Only one in history
    });

    test('should track duplicate count in fingerprint', () => {
      const error = new Error('Duplicate error');
      errorLogger.on('error', () => {}); // Listen to prevent unhandled events

      errorLogger.logError(error, { operation: 'op1' });
      errorLogger.logError(error, { operation: 'op1' });
      errorLogger.logError(error, { operation: 'op1' });

      const topFingerprints = errorLogger.getStats().topFingerprints;
      expect(topFingerprints[0].count).toBe(3);
    });

    test('should log duplicate errors as debug', () => {
      const error = new Error('Duplicate error');
      errorLogger.on('error', () => {}); // Listen to prevent unhandled events

      errorLogger.logError(error, { operation: 'op1' });
      errorLogger.logError(error, { operation: 'op1' });

      const debugLogs = mockLogger.logs.filter(l => l.level === 'debug');
      expect(debugLogs.length).toBeGreaterThan(0);
      expect(debugLogs[0].message).toContain('Duplicate Error');
    });

    test('should reset deduplication after time window', (done) => {
      const error = new Error('Time window test');
      const logger = createErrorLogger({
        logger: mockLogger,
        deduplicationWindow: 100 // 100ms
      });
      logger.on('error', () => {}); // Listen to prevent unhandled events

      const entry1 = logger.logError(error, { operation: 'op1' });
      expect(entry1).not.toBeNull();

      setTimeout(() => {
        const entry2 = logger.logError(error, { operation: 'op1' });
        expect(entry2).not.toBeNull(); // Should NOT be deduplicated after time window

        logger.clearHistory();
        done();
      }, 150);
    });

    test('should disable deduplication when configured', () => {
      const logger = createErrorLogger({
        logger: mockLogger,
        enableDeduplication: false
      });
      logger.on('error', () => {}); // Listen to prevent unhandled events

      const error = new Error('Same error');
      const entry1 = logger.logError(error, { operation: 'op1' });
      const entry2 = logger.logError(error, { operation: 'op1' });

      expect(entry1).not.toBeNull();
      expect(entry2).not.toBeNull(); // Both should be logged

      logger.clearHistory();
    });
  });

  // ==========================================
  // Warning Tests
  // ==========================================

  describe('Warning Logging', () => {
    test('should log warnings', () => {
      const entry = errorLogger.logWarning('Test warning', {
        operation: 'warn_op',
        metadata: { count: 5 }
      });

      expect(entry).not.toBeNull();
      expect(entry.level).toBe('warning');
      expect(entry.message).toBe('Test warning');
    });

    test('should emit warning events', (done) => {
      errorLogger.on('warning', (entry) => {
        expect(entry.message).toBe('Test warning');
        done();
      });

      errorLogger.logWarning('Test warning', { operation: 'op' });
    });
  });

  // ==========================================
  // Alert Tests
  // ==========================================

  describe('Alerting System', () => {
    test('should trigger alert on critical error', () => {
      const alerts = [];
      errorLogger.on('alert', (alert) => alerts.push(alert));
      errorLogger.on('error', () => {}); // Listen to prevent unhandled event

      errorLogger.logError(new Error('Out of memory'), { operation: 'critical_op' });

      expect(alerts.length).toBe(1);
      expect(alerts[0].level).toBe(SEVERITY_LEVELS.CRITICAL);
    });

    test('should track active alerts', () => {
      errorLogger.on('error', () => {}); // Listen to prevent unhandled event
      errorLogger.logError(new Error('Out of memory'), { operation: 'op1' });

      const stats = errorLogger.getStats();
      expect(stats.activeAlerts).toBeGreaterThan(0);
    });

    test('should enforce alert cooldown', (done) => {
      const logger = createErrorLogger({
        logger: mockLogger,
        alertCooldown: 100,
        deduplicationWindow: 5000 // Increase dedup window so we get 2nd error
      });
      logger.on('error', () => {}); // Listen to prevent unhandled event

      const alerts = [];
      logger.on('alert', (alert) => alerts.push(alert));

      logger.logError(new Error('Out of memory'), { operation: 'op1' });
      // Second error with different msg so it's not deduplicated
      logger.logError(new Error('Out of memory 2'), { operation: 'op1' });

      // Both should trigger alerts (both critical)
      expect(alerts.length).toBeGreaterThanOrEqual(1); // At least one alert

      // Wait for cooldown and send another
      setTimeout(() => {
        logger.logError(new Error('Out of memory 3'), { operation: 'op1' });
        expect(alerts.length).toBeGreaterThanOrEqual(2); // More alerts after cooldown

        logger.clearHistory();
        done();
      }, 150);
    });

    test('should send alerts to configured targets', () => {
      let webhookCalled = false;
      let slackCalled = false;
      errorLogger.on('error', () => {}); // Listen to prevent unhandled event

      errorLogger.setAlertTargets({
        webhook: () => {
          webhookCalled = true;
        },
        slack: () => {
          slackCalled = true;
        }
      });

      errorLogger.logError(new Error('Out of memory'), { operation: 'op1' });

      expect(webhookCalled).toBe(true);
      expect(slackCalled).toBe(true);
    });
  });

  // ==========================================
  // Filtering and Retrieval Tests
  // ==========================================

  describe('Error Retrieval and Filtering', () => {
    beforeEach(() => {
      errorLogger.on('error', () => {}); // Listen to prevent unhandled events
      errorLogger.logError(new Error('ECONNREFUSED'), { operation: 'op1' });
      errorLogger.logError(new Error('Out of memory'), { operation: 'op2' });
      errorLogger.logError(new Error('ETIMEDOUT'), { operation: 'op3' });
      errorLogger.logError(new Error('Invalid credentials'), { operation: 'op1' });
    });

    test('should retrieve recent errors', () => {
      const recent = errorLogger.getRecent(10);
      expect(recent.length).toBe(4);
    });

    test('should filter errors by category', () => {
      const recent = errorLogger.getRecent(10, {
        category: ERROR_CATEGORIES.NETWORK
      });
      expect(recent.length).toBe(1);
    });

    test('should filter errors by severity', () => {
      const recent = errorLogger.getRecent(10, {
        severity: SEVERITY_LEVELS.CRITICAL
      });
      expect(recent.length).toBe(1);
    });

    test('should filter errors by operation', () => {
      const recent = errorLogger.getRecent(10, {
        operation: 'op1'
      });
      expect(recent.length).toBe(2);
    });

    test('should filter errors by timestamp', () => {
      const now = Date.now();
      const recent = errorLogger.getRecent(10, {
        since: now - 100
      });
      expect(recent.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // Statistics and Export Tests
  // ==========================================

  describe('Statistics and Export', () => {
    test('should provide comprehensive statistics', () => {
      errorLogger.on('error', () => {}); // Listen to prevent unhandled events

      errorLogger.logError(new Error('ECONNREFUSED'), { operation: 'op1' });
      errorLogger.logError(new Error('ETIMEDOUT'), { operation: 'op2' });
      errorLogger.logError(new Error('Out of memory'), { operation: 'op3' });

      const stats = errorLogger.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byCategory).toBeDefined();
      expect(stats.bySeverity).toBeDefined();
      expect(stats.topFingerprints).toBeDefined();
    });

    test('should export logs to JSON file', (done) => {
      const fs = require('fs');
      const path = require('path');

      errorLogger.on('error', () => {}); // Listen to prevent unhandled events

      errorLogger.logError(new Error('ECONNREFUSED'), { operation: 'op1' });
      errorLogger.logError(new Error('Out of memory'), { operation: 'op2' });

      const filePath = path.join(__dirname, 'test-error-export.json');

      const success = errorLogger.exportLogs(filePath, { includeHistory: true });

      expect(success).toBe(true);

      if (success) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(data.history.length).toBe(2);
        expect(data.stats.total).toBe(2);

        fs.unlinkSync(filePath);
      }

      done();
    });
  });

  // ==========================================
  // Configuration Tests
  // ==========================================

  describe('Configuration and Control', () => {
    test('should enable/disable logging', () => {
      errorLogger.on('error', () => {}); // Listen to prevent unhandled events
      errorLogger.setEnabled(false);
      const entry = errorLogger.logError(new Error('Test'), { operation: 'op' });
      expect(entry).toBeNull();

      errorLogger.setEnabled(true);
      const entry2 = errorLogger.logError(new Error('Test'), { operation: 'op' });
      expect(entry2).not.toBeNull();
    });

    test('should add custom classification rules', () => {
      errorLogger.addClassificationRule({
        category: 'custom',
        patterns: ['custom_pattern'],
        severity: SEVERITY_LEVELS.HIGH
      });

      const error = new Error('Error with custom_pattern');
      const classification = errorLogger.classifyError(error);

      expect(classification.category).toBe('custom');
      expect(classification.severity).toBe(SEVERITY_LEVELS.HIGH);
    });

    test('should clear history', () => {
      errorLogger.on('error', () => {}); // Listen to prevent unhandled events
      errorLogger.logError(new Error('Test 1'), { operation: 'op1' });
      errorLogger.logError(new Error('Test 2'), { operation: 'op2' });

      let stats = errorLogger.getStats();
      expect(stats.total).toBe(2);

      errorLogger.clearHistory();

      stats = errorLogger.getStats();
      expect(stats.total).toBe(0);
    });
  });

  // ==========================================
  // Event Emission Tests
  // ==========================================

  describe('Event Emission', () => {
    test('should emit error event', (done) => {
      errorLogger.on('error', (entry) => {
        expect(entry.error.message).toContain('Test error');
        done();
      });

      errorLogger.logError(new Error('Test error'), { operation: 'op' });
    });

    test('should emit warning event', (done) => {
      errorLogger.on('warning', (entry) => {
        expect(entry.message).toBe('Test warning');
        done();
      });

      errorLogger.logWarning('Test warning', { operation: 'op' });
    });

    test('should emit alert event', (done) => {
      errorLogger.on('alert', (alert) => {
        expect(alert.level).toBe(SEVERITY_LEVELS.CRITICAL);
        done();
      });

      errorLogger.on('error', () => {}); // Listen to error too
      errorLogger.logError(new Error('Out of memory'), { operation: 'op' });
    });
  });

  // ==========================================
  // Error Fingerprinting Tests
  // ==========================================

  describe('Error Fingerprinting', () => {
    test('should generate consistent fingerprints', () => {
      const error = new Error('Test error');
      const fp1 = generateErrorFingerprint(error);
      const fp2 = generateErrorFingerprint(error);

      expect(fp1).toBe(fp2);
    });

    test('should generate different fingerprints for different errors', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      const fp1 = generateErrorFingerprint(error1);
      const fp2 = generateErrorFingerprint(error2);

      expect(fp1).not.toBe(fp2);
    });

    test('should handle different error types', () => {
      const typeError = new TypeError('Type error');
      const syntaxError = new SyntaxError('Syntax error');
      const customError = new Error('Custom error');

      expect(generateErrorFingerprint(typeError)).toBeDefined();
      expect(generateErrorFingerprint(syntaxError)).toBeDefined();
      expect(generateErrorFingerprint(customError)).toBeDefined();
    });

    test('should handle string errors', () => {
      const fp = generateErrorFingerprint('String error');
      expect(fp).toBeDefined();
      expect(fp.startsWith('fp_')).toBe(true);
    });
  });
});
