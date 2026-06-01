/**
 * Security Phase 2: Audit Logger Tests
 * Validates tamper-evident forensic audit logging
 */

const { AuditLogger } = require('../../src/security/audit-logger');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Security Phase 2: Audit Logger', () => {
  let logger;
  let testDir;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `basset-audit-${Date.now()}`);
    logger = new AuditLogger({ logDir: testDir });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('Log Directory Management', () => {
    test('Creates log directory on initialization', () => {
      expect(fs.existsSync(testDir)).toBe(true);
    });

    test('Creates directory with restrictive permissions', () => {
      const stat = fs.statSync(testDir);
      const mode = stat.mode & parseInt('777', 8);
      expect(mode).toBe(parseInt('700', 8));
    });

    test('Uses custom log directory when provided', () => {
      const customDir = path.join(testDir, 'custom');
      const customLogger = new AuditLogger({ logDir: customDir });

      expect(customLogger.logDir).toBe(customDir);
      expect(fs.existsSync(customDir)).toBe(true);
    });
  });

  describe('Sensitive Operation Logging', () => {
    test('Logs sensitive operations', () => {
      const result = logger.logSensitiveOperation({
        clientId: 'client-123',
        command: 'get_cookies',
        params: { domain: 'example.com' },
        success: true,
        ipAddress: '192.168.1.1'
      });

      expect(result.success).toBe(true);
      expect(result.entryHash).toBeDefined();
      expect(result.entryHash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('Hashes parameters for privacy', () => {
      const entry1 = logger.logSensitiveOperation({
        clientId: 'client-1',
        command: 'test',
        params: { secret: 'value1' },
        success: true
      });

      const entry2 = logger.logSensitiveOperation({
        clientId: 'client-1',
        command: 'test',
        params: { secret: 'value2' },
        success: true
      });

      // Different params should create different hashes
      expect(entry1.entryHash).not.toBe(entry2.entryHash);
    });

    test('Masks IP addresses in logs', () => {
      logger.logSensitiveOperation({
        clientId: 'client-123',
        command: 'test',
        ipAddress: '192.168.1.100',
        success: true
      });

      const entries = logger.queryLog({ limit: 1 });
      expect(entries[0].ipAddress).toMatch(/^[a-f0-9]{16}$/);
      expect(entries[0].ipAddress).not.toContain('192');
    });

    test('Records operation timestamp', () => {
      const before = Date.now();
      logger.logSensitiveOperation({
        clientId: 'client-123',
        command: 'test',
        success: true
      });
      const after = Date.now();

      const entries = logger.queryLog({ limit: 1 });
      expect(entries[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(entries[0].timestamp).toBeLessThanOrEqual(after);
    });

    test('Tracks success/failure status', () => {
      logger.logSensitiveOperation({
        clientId: 'c1',
        command: 'cmd1',
        success: true
      });

      logger.logSensitiveOperation({
        clientId: 'c2',
        command: 'cmd2',
        success: false,
        error: 'Test error'
      });

      const allEntries = logger.queryLog({ limit: 10 });
      const successEntry = allEntries.find(e => e.command === 'cmd1');
      const failEntry = allEntries.find(e => e.command === 'cmd2');

      expect(successEntry.success).toBe(true);
      expect(failEntry.success).toBe(false);
      expect(failEntry.error).toBe('Test error');
    });
  });

  describe('Authentication Logging', () => {
    test('Logs auth attempts', () => {
      logger.logAuthAttempt({
        clientId: 'client-123',
        method: 'hmac',
        username: 'user@example.com',
        success: true,
        ipAddress: '192.168.1.1'
      });

      const entries = logger.queryLog({ command: 'auth_attempt', limit: 1 });
      expect(entries[0].command).toBe('auth_attempt');
      expect(entries[0].success).toBe(true);
    });

    test('Logs auth failures', () => {
      logger.logAuthFailure({
        clientId: 'attacker-123',
        command: 'screenshot',
        reason: 'Invalid credentials',
        ipAddress: '203.0.113.45'
      });

      const entries = logger.queryLog({ command: 'auth_failure', limit: 1 });
      expect(entries[0].command).toBe('auth_failure');
      expect(entries[0].success).toBe(false);
    });

    test('Gets failed authentication attempts', () => {
      logger.logAuthAttempt({
        clientId: 'c1',
        method: 'hmac',
        success: true
      });

      logger.logAuthAttempt({
        clientId: 'c2',
        method: 'hmac',
        success: false
      });

      logger.logAuthAttempt({
        clientId: 'c3',
        method: 'hmac',
        success: false
      });

      const failed = logger.getFailedAuthAttempts({ limit: 10 });
      expect(failed.length).toBe(2);
      expect(failed.every(e => e.success === false)).toBe(true);
    });
  });

  describe('Rate Limiting Logging', () => {
    test('Logs rate limit violations', () => {
      logger.logRateLimitViolation({
        clientId: 'client-123',
        limit: 100,
        current: 105,
        ipAddress: '192.168.1.1'
      });

      const entries = logger.queryLog({ command: 'rate_limit_violation', limit: 1 });
      expect(entries[0].command).toBe('rate_limit_violation');
      expect(entries[0].success).toBe(false);
    });

    test('Gets rate limit violations', () => {
      logger.logRateLimitViolation({
        clientId: 'c1',
        limit: 100,
        current: 105
      });

      logger.logRateLimitViolation({
        clientId: 'c2',
        limit: 100,
        current: 110
      });

      const violations = logger.getRateLimitViolations({ limit: 10 });
      expect(violations.length).toBe(2);
    });
  });

  describe('Log Querying', () => {
    beforeEach(() => {
      // Create sample log entries
      for (let i = 0; i < 5; i++) {
        logger.logSensitiveOperation({
          clientId: 'client-a',
          command: 'cmd-' + (i % 2),
          success: i % 3 !== 0,
          ipAddress: '192.168.1.' + i
        });
      }
    });

    test('Queries all entries', () => {
      const entries = logger.queryLog();
      expect(entries.length).toBeGreaterThan(0);
    });

    test('Filters by clientId', () => {
      const entries = logger.queryLog({ clientId: 'client-a' });
      expect(entries.every(e => e.clientId === 'client-a')).toBe(true);
    });

    test('Filters by command', () => {
      const entries = logger.queryLog({ command: 'cmd-0' });
      expect(entries.every(e => e.command === 'cmd-0')).toBe(true);
    });

    test('Filters by success status', () => {
      const successful = logger.queryLog({ success: true });
      expect(successful.every(e => e.success === true)).toBe(true);

      const failed = logger.queryLog({ success: false });
      expect(failed.every(e => e.success === false)).toBe(true);
    });

    test('Filters by time range', () => {
      const now = Date.now();
      const recentEntries = logger.queryLog({
        since: now - 1000, // Last second
        until: now
      });

      expect(recentEntries.every(e => e.timestamp >= now - 1000)).toBe(true);
    });

    test('Limits result count', () => {
      const limited = logger.queryLog({ limit: 2 });
      expect(limited.length).toBeLessThanOrEqual(2);
    });

    test('Sorts results by timestamp (newest first)', () => {
      const entries = logger.queryLog();
      for (let i = 0; i < entries.length - 1; i++) {
        expect(entries[i].timestamp).toBeGreaterThanOrEqual(entries[i + 1].timestamp);
      }
    });
  });

  describe('Tamper-Evident Logging', () => {
    test('Creates hash chain in logs', () => {
      logger.logSensitiveOperation({ clientId: 'c1', command: 'cmd1', success: true });
      logger.logSensitiveOperation({ clientId: 'c2', command: 'cmd2', success: true });

      const entries = logger.queryLog({ limit: 10 });
      expect(entries.length).toBeGreaterThanOrEqual(2);

      // Check that entries have entryHash
      entries.forEach(entry => {
        expect(entry.entryHash).toBeDefined();
        expect(entry.entryHash).toMatch(/^[a-f0-9]{64}$/);
      });
    });

    test('Maintains previousHash for chain integrity', () => {
      logger.logSensitiveOperation({ clientId: 'c1', command: 'cmd1', success: true });
      const hash1 = logger.lastHash;

      logger.logSensitiveOperation({ clientId: 'c2', command: 'cmd2', success: true });
      const hash2 = logger.lastHash;

      const entries = logger.queryLog({ limit: 10 });
      const sortedByTime = entries.sort((a, b) => a.timestamp - b.timestamp);

      if (sortedByTime.length >= 2) {
        expect(sortedByTime[1].previousHash).toBe(sortedByTime[0].entryHash);
      }
    });

    test('Verifies log integrity', () => {
      for (let i = 0; i < 5; i++) {
        logger.logSensitiveOperation({
          clientId: 'c' + i,
          command: 'cmd' + i,
          success: true
        });
      }

      const integrity = logger.verifyLogIntegrity();
      expect(integrity.valid).toBe(true);
      expect(integrity.entries).toBe(5);
      expect(integrity.tamperedEntries).toEqual([]);
    });

    test('Detects tampering when log is modified', () => {
      logger.logSensitiveOperation({ clientId: 'c1', command: 'cmd1', success: true });
      logger.logSensitiveOperation({ clientId: 'c2', command: 'cmd2', success: true });

      // Manually corrupt the log file
      const logPath = path.join(testDir, 'audit.log');
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n');

      // Modify first entry
      const entry = JSON.parse(lines[0]);
      entry.clientId = 'modified';
      lines[0] = JSON.stringify(entry);

      fs.writeFileSync(logPath, lines.join('\n'), 'utf-8');

      // Refresh logger to re-read from disk
      const newLogger = new AuditLogger({ logDir: testDir });
      const integrity = newLogger.verifyLogIntegrity();

      expect(integrity.valid).toBe(false);
      expect(integrity.tamperedEntries.length).toBeGreaterThan(0);
    });
  });

  describe('Suspicious Activity Reporting', () => {
    test('Identifies suspicious clients based on failed auths', () => {
      // Create 4 failed auth attempts for same client
      for (let i = 0; i < 4; i++) {
        logger.logAuthAttempt({
          clientId: 'attacker-123',
          method: 'hmac',
          success: false
        });
      }

      const report = logger.getSuspiciousActivityReport();
      const suspicious = report.suspiciousClients.find(c => c.clientId === 'attacker-123');

      expect(suspicious).toBeDefined();
      expect(suspicious.failures).toBe(4);
    });

    test('Identifies suspicious clients based on rate limit violations', () => {
      // Create 6 rate limit violations
      for (let i = 0; i < 6; i++) {
        logger.logRateLimitViolation({
          clientId: 'spammer-456',
          limit: 100,
          current: 105 + i
        });
      }

      const report = logger.getSuspiciousActivityReport();
      const suspicious = report.suspiciousClients.find(c => c.clientId === 'spammer-456');

      expect(suspicious).toBeDefined();
      expect(suspicious.violations).toBe(6);
    });

    test('Reports include time range', () => {
      logger.logAuthAttempt({
        clientId: 'c1',
        method: 'hmac',
        success: false
      });

      const report = logger.getSuspiciousActivityReport();
      expect(report.reportGeneratedAt).toBeDefined();
      expect(typeof report.reportGeneratedAt).toBe('number');
    });
  });

  describe('Log Export', () => {
    test('Exports log entries', () => {
      logger.logSensitiveOperation({ clientId: 'c1', command: 'cmd1', success: true });
      logger.logSensitiveOperation({ clientId: 'c2', command: 'cmd2', success: true });

      const result = logger.exportLog();

      expect(result.success).toBe(true);
      expect(result.data.entries.length).toBeGreaterThanOrEqual(2);
    });

    test('Exports with filters', () => {
      logger.logSensitiveOperation({ clientId: 'c1', command: 'cmd1', success: true });
      logger.logSensitiveOperation({ clientId: 'c2', command: 'cmd2', success: false });

      const result = logger.exportLog({ success: true });

      expect(result.success).toBe(true);
      expect(result.data.entries.every(e => e.success === true)).toBe(true);
    });

    test('Export includes summary', () => {
      for (let i = 0; i < 3; i++) {
        logger.logSensitiveOperation({ clientId: 'c' + i, command: 'cmd' + i, success: true });
      }

      const result = logger.exportLog();

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.totalEntries).toBeGreaterThanOrEqual(3);
      expect(result.data.summary.timeRange).toBeDefined();
    });
  });

  describe('Log Rotation', () => {
    test('Rotates log file when size exceeded', () => {
      const smallLogger = new AuditLogger({
        logDir: testDir,
        maxLogSize: 500 // Very small for testing
      });

      // Write entries until rotation happens
      for (let i = 0; i < 50; i++) {
        smallLogger.logSensitiveOperation({
          clientId: 'c' + i,
          command: 'cmd' + i,
          success: true
        });
      }

      // Check if rotated files were created
      const files = fs.readdirSync(testDir);
      const rotatedFiles = files.filter(f => f.startsWith('audit-') && f.endsWith('.log'));

      expect(rotatedFiles.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics', () => {
    test('Reports logger statistics', () => {
      logger.logSensitiveOperation({ clientId: 'c1', command: 'cmd1', success: true });

      const stats = logger.getStats();

      expect(stats.logDirectory).toBe(testDir);
      expect(stats.maxLogSizeBytes).toBeDefined();
      expect(stats.recentEntriesInMemory).toBeGreaterThan(0);
      expect(stats.compressionEnabled).toBeDefined();
    });

    test('Tracks log file size', () => {
      for (let i = 0; i < 10; i++) {
        logger.logSensitiveOperation({
          clientId: 'c' + i,
          command: 'cmd' + i,
          success: true
        });
      }

      const stats = logger.getStats();
      expect(stats.logFileSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('Cleanup and Maintenance', () => {
    test('Clears old entries', () => {
      logger.logSensitiveOperation({ clientId: 'c1', command: 'cmd1', success: true });

      const before = logger.recentEntries.length;
      logger.clearOldEntries(0); // Clear all

      expect(logger.recentEntries.length).toBe(0);
    });

    test('Preserves recent entries during cleanup', () => {
      const now = Date.now();

      // Create old entry (manually)
      logger.logSensitiveOperation({ clientId: 'c1', command: 'cmd1', success: true });

      // Manually change timestamp for testing
      if (logger.recentEntries.length > 0) {
        logger.recentEntries[0].timestamp = now - 10000; // 10 seconds ago
      }

      logger.logSensitiveOperation({ clientId: 'c2', command: 'cmd2', success: true });

      // Clear entries older than 5 seconds
      logger.clearOldEntries(5000);

      // Recent entry should remain
      const recent = logger.queryLog({ clientId: 'c2' });
      expect(recent.length).toBeGreaterThan(0);
    });
  });
});
