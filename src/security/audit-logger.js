/**
 * Basset Hound Browser - Audit Logger Module
 * Implements tamper-evident audit logging for forensic analysis
 *
 * Version: 1.0.0
 * Created: May 31, 2026
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createGzip } = require('zlib');
const { Transform } = require('stream');

class AuditLogger {
  /**
   * Constructor
   * @param {object} options Configuration options
   */
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(process.env.HOME || '/tmp', '.basset-hound', 'audit');
    this.maxLogSize = options.maxLogSize || 100 * 1024 * 1024; // 100MB
    this.enableEncryption = options.enableEncryption || false;
    this.enableCompression = options.enableCompression !== false;

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
    }

    // Load last hash for tamper-evident log chain
    this.lastHash = this.loadLastHash();

    // In-memory recent entries for queries
    this.recentEntries = [];
    this.maxRecentEntries = options.maxRecentEntries || 1000;
  }

  /**
   * Log sensitive data access
   * @param {object} entry Log entry to record
   */
  logSensitiveOperation(entry) {
    const timestamp = Date.now();

    const logEntry = {
      timestamp,
      clientId: entry.clientId || 'unknown',
      command: entry.command || 'unknown',
      paramHash: crypto.createHash('sha256')
        .update(JSON.stringify(entry.params || {}))
        .digest('hex'),
      resultSize: entry.resultSize || 0,
      success: entry.success !== false,
      error: entry.error || null,
      ipAddress: this.hashIpAddress(entry.ipAddress),
      previousHash: this.lastHash,
      source: entry.source || 'websocket'
    };

    // Calculate entry hash
    logEntry.entryHash = this.hashEntry(logEntry);

    // Write to tamper-evident log
    this.writeLogEntry(logEntry);

    // Keep recent entries in memory for quick queries
    this.addRecentEntry(logEntry);

    // Update last hash
    this.lastHash = logEntry.entryHash;

    return {
      success: true,
      entryHash: logEntry.entryHash,
      timestamp
    };
  }

  /**
   * Log authentication attempt
   * @param {object} entry Authentication entry
   */
  logAuthAttempt(entry) {
    return this.logSensitiveOperation({
      clientId: entry.clientId,
      command: 'auth_attempt',
      params: { method: entry.method, username: entry.username ? this.hashIpAddress(entry.username) : null },
      success: entry.success,
      error: entry.error,
      ipAddress: entry.ipAddress
    });
  }

  /**
   * Log authorization failure
   * @param {object} entry Authorization failure entry
   */
  logAuthFailure(entry) {
    return this.logSensitiveOperation({
      clientId: entry.clientId,
      command: 'auth_failure',
      params: { deniedCommand: entry.command, reason: entry.reason },
      success: false,
      error: entry.reason,
      ipAddress: entry.ipAddress
    });
  }

  /**
   * Log rate limit violation
   * @param {object} entry Rate limit entry
   */
  logRateLimitViolation(entry) {
    return this.logSensitiveOperation({
      clientId: entry.clientId,
      command: 'rate_limit_violation',
      params: { limit: entry.limit, current: entry.current },
      success: false,
      error: 'Rate limit exceeded',
      ipAddress: entry.ipAddress
    });
  }

  /**
   * Write entry to tamper-evident log file
   * @private
   */
  writeLogEntry(entry) {
    const logPath = path.join(this.logDir, 'audit.log');
    const line = JSON.stringify(entry) + '\n';

    try {
      // Append with strict permissions
      fs.appendFileSync(logPath, line, { mode: 0o600 });

      // Check if rotation needed
      this.rotateLogIfNeeded(logPath);
    } catch (error) {
      console.error(`Failed to write audit log: ${error.message}`);
    }
  }

  /**
   * Rotate log file when size exceeded
   * @private
   */
  rotateLogIfNeeded(logPath) {
    try {
      const stat = fs.statSync(logPath);

      if (stat.size > this.maxLogSize) {
        const timestamp = Date.now();
        const rotatedPath = path.join(
          this.logDir,
          `audit-${timestamp}.log${this.enableCompression ? '.gz' : ''}`
        );

        if (this.enableCompression) {
          // Compress and rotate
          const input = fs.createReadStream(logPath);
          const output = fs.createWriteStream(rotatedPath, { mode: 0o600 });
          const gzip = createGzip();

          input.pipe(gzip).pipe(output).on('finish', () => {
            // Clear current log
            fs.writeFileSync(logPath, '', { mode: 0o600 });
          });
        } else {
          // Just rotate without compression
          fs.renameSync(logPath, rotatedPath);
          fs.writeFileSync(logPath, '', { mode: 0o600 });
        }
      }
    } catch (error) {
      console.error(`Failed to rotate audit log: ${error.message}`);
    }
  }

  /**
   * Verify audit log integrity
   * @returns {object} Integrity verification result
   */
  verifyLogIntegrity() {
    const logPath = path.join(this.logDir, 'audit.log');

    if (!fs.existsSync(logPath)) {
      return { valid: true, entries: 0, message: 'Log file does not exist' };
    }

    try {
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.length > 0);

      let previousHash = null;
      let valid = true;
      const tamperedEntries = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        try {
          const entry = JSON.parse(line);

          // Verify hash chain
          if (entry.previousHash !== previousHash) {
            valid = false;
            tamperedEntries.push({
              lineNumber: i + 1,
              reason: 'Hash chain broken',
              entry: entry.timestamp
            });
          }

          // Verify entry hash
          const calculatedHash = this.hashEntry(entry);
          if (calculatedHash !== entry.entryHash) {
            valid = false;
            tamperedEntries.push({
              lineNumber: i + 1,
              reason: 'Entry hash mismatch',
              entry: entry.timestamp
            });
          }

          previousHash = entry.entryHash;
        } catch (e) {
          valid = false;
          tamperedEntries.push({
            lineNumber: i + 1,
            reason: 'Failed to parse entry',
            error: e.message
          });
        }
      }

      return {
        valid,
        entries: lines.length,
        tamperedEntries,
        lastHash: previousHash
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Query audit log
   * @param {object} options Query options
   * @returns {array} Matching log entries
   */
  queryLog(options = {}) {
    let entries = [...this.recentEntries];

    // Filter by clientId
    if (options.clientId) {
      entries = entries.filter(e => e.clientId === options.clientId);
    }

    // Filter by command
    if (options.command) {
      entries = entries.filter(e => e.command === options.command);
    }

    // Filter by time range
    if (options.since) {
      entries = entries.filter(e => e.timestamp >= options.since);
    }

    if (options.until) {
      entries = entries.filter(e => e.timestamp <= options.until);
    }

    // Filter by success/failure
    if (options.success !== undefined) {
      entries = entries.filter(e => e.success === options.success);
    }

    // Filter by IP (hashed)
    if (options.ipAddress) {
      const hashedIp = this.hashIpAddress(options.ipAddress);
      entries = entries.filter(e => e.ipAddress === hashedIp);
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    if (options.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  /**
   * Get failed authentication attempts
   * @param {object} options Query options
   * @returns {array} Failed auth attempts
   */
  getFailedAuthAttempts(options = {}) {
    return this.queryLog({
      ...options,
      command: 'auth_attempt',
      success: false
    });
  }

  /**
   * Get rate limit violations
   * @param {object} options Query options
   * @returns {array} Rate limit violations
   */
  getRateLimitViolations(options = {}) {
    return this.queryLog({
      ...options,
      command: 'rate_limit_violation'
    });
  }

  /**
   * Get suspicious activity report
   * @returns {object} Suspicious activity summary
   */
  getSuspiciousActivityReport() {
    const failedAuths = this.queryLog({
      command: 'auth_attempt',
      success: false,
      since: Date.now() - 3600000 // Last hour
    });

    const rateLimitViolations = this.queryLog({
      command: 'rate_limit_violation',
      since: Date.now() - 3600000
    });

    // Group by client ID for analysis
    const clientActivity = {};

    [...failedAuths, ...rateLimitViolations].forEach(entry => {
      if (!clientActivity[entry.clientId]) {
        clientActivity[entry.clientId] = { failures: 0, violations: 0, lastSeen: entry.timestamp };
      }

      if (entry.command === 'auth_attempt') {
        clientActivity[entry.clientId].failures++;
      } else if (entry.command === 'rate_limit_violation') {
        clientActivity[entry.clientId].violations++;
      }

      clientActivity[entry.clientId].lastSeen = Math.max(
        clientActivity[entry.clientId].lastSeen,
        entry.timestamp
      );
    });

    return {
      reportGeneratedAt: Date.now(),
      failedAuthenticationAttempts: failedAuths.length,
      rateLimitViolations: rateLimitViolations.length,
      suspiciousClients: Object.entries(clientActivity)
        .filter(([_, data]) => data.failures >= 3 || data.violations >= 5)
        .map(([clientId, data]) => ({ clientId, ...data }))
    };
  }

  /**
   * Helper: Hash log entry for tamper detection
   * @private
   */
  hashEntry(entry) {
    const { entryHash, ...toHash } = entry;
    return crypto.createHash('sha256')
      .update(JSON.stringify(toHash))
      .digest('hex');
  }

  /**
   * Helper: Hash IP address (PII masking)
   * @private
   */
  hashIpAddress(ip) {
    if (!ip) return null;
    return crypto.createHash('sha256').update(String(ip)).digest('hex').substring(0, 16);
  }

  /**
   * Helper: Load last hash from log
   * @private
   */
  loadLastHash() {
    const logPath = path.join(this.logDir, 'audit.log');

    if (!fs.existsSync(logPath)) return null;

    try {
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.length > 0);

      if (lines.length === 0) return null;

      const lastEntry = JSON.parse(lines[lines.length - 1]);
      return lastEntry.entryHash;
    } catch (error) {
      console.error(`Failed to load last hash: ${error.message}`);
      return null;
    }
  }

  /**
   * Helper: Add entry to recent entries cache
   * @private
   */
  addRecentEntry(entry) {
    this.recentEntries.push(entry);

    if (this.recentEntries.length > this.maxRecentEntries) {
      this.recentEntries = this.recentEntries.slice(-this.maxRecentEntries);
    }
  }

  /**
   * Get logger statistics
   * @returns {object} Statistics about audit logging
   */
  getStats() {
    const logPath = path.join(this.logDir, 'audit.log');
    const logSize = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;

    return {
      logDirectory: this.logDir,
      logFileSizeBytes: logSize,
      maxLogSizeBytes: this.maxLogSize,
      logSizePercentage: ((logSize / this.maxLogSize) * 100).toFixed(2),
      recentEntriesInMemory: this.recentEntries.length,
      maxRecentEntries: this.maxRecentEntries,
      compressionEnabled: this.enableCompression,
      encryptionEnabled: this.enableEncryption
    };
  }

  /**
   * Export audit log (for forensic analysis)
   * @param {object} options Export options
   * @returns {object} Export result
   */
  exportLog(options = {}) {
    try {
      let entries = this.recentEntries;

      // Filter entries if options provided
      if (options.since || options.until || options.clientId || options.command || options.success !== undefined) {
        entries = this.queryLog(options);
      }

      const exportData = {
        exportedAt: Date.now(),
        entries,
        summary: {
          totalEntries: entries.length,
          timeRange: {
            oldest: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
            newest: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null
          }
        }
      };

      return {
        success: true,
        data: exportData
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clear old log entries
   * @param {number} olderThanMs Delete entries older than this timestamp
   * @returns {object} Deletion result
   */
  clearOldEntries(olderThanMs) {
    const cutoffTime = Date.now() - olderThanMs;

    const beforeCount = this.recentEntries.length;
    this.recentEntries = this.recentEntries.filter(e => e.timestamp > cutoffTime);
    const afterCount = this.recentEntries.length;

    return {
      success: true,
      entriesDeleted: beforeCount - afterCount,
      remainingEntries: afterCount
    };
  }
}

module.exports = { AuditLogger };
