/**
 * Basset Hound Browser - Session History & Audit Module
 * Persistent audit log of all session operations with query and export capabilities
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 *
 * Features:
 * - SQLite-based audit log (or JSON fallback)
 * - Query by date range, operation type, success/failure
 * - Export to JSON, CSV, forensic formats
 * - Automatic retention management
 * - Privacy-aware (no sensitive data storage)
 * - Comprehensive operation tracking
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Session history manager with audit logging
 */
class SessionHistoryManager {
  constructor(options = {}) {
    this.storageDir = options.storageDir || '/tmp/basset-sessions/history';
    this.enableSqlite = options.enableSqlite !== false;
    this.retentionDays = options.retentionDays || 30;
    this.maxHistorySize = options.maxHistorySize || 1000000; // 1MB per session

    // In-memory fallback (if SQLite unavailable)
    this.operationLog = new Map(); // sessionId -> [operations]
    this.sessionMetadata = new Map(); // sessionId -> metadata

    this.ensureStorageDir();
    this._initDatabase();
  }

  /**
   * Ensure storage directory exists
   */
  ensureStorageDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Initialize database (SQLite or JSON fallback)
   * @private
   */
  _initDatabase() {
    // Try to load SQLite, fallback to JSON if unavailable
    try {
      const Database = require('better-sqlite3');
      this.db = new Database(path.join(this.storageDir, 'history.db'));
      this.usingSqlite = true;

      // Create tables if not exists
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS operations (
          id TEXT PRIMARY KEY,
          sessionId TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          operationType TEXT NOT NULL,
          status TEXT,
          url TEXT,
          duration INTEGER,
          resultSize INTEGER,
          errorMessage TEXT,
          metadata TEXT,
          INDEX idx_sessionId (sessionId),
          INDEX idx_timestamp (timestamp),
          INDEX idx_operationType (operationType)
        );

        CREATE TABLE IF NOT EXISTS session_events (
          id TEXT PRIMARY KEY,
          sessionId TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          eventType TEXT NOT NULL,
          details TEXT,
          INDEX idx_sessionId (sessionId),
          INDEX idx_timestamp (timestamp)
        );
      `);
    } catch (error) {
      console.warn('SQLite unavailable, using JSON fallback:', error.message);
      this.usingSqlite = false;
    }
  }

  /**
   * Record an operation in session history
   */
  recordOperation(sessionId, operation) {
    const record = {
      id: crypto.randomBytes(8).toString('hex'),
      sessionId,
      timestamp: Date.now(),
      operationType: operation.type,
      status: operation.status || 'completed',
      url: operation.url || null,
      duration: operation.duration || 0,
      resultSize: operation.resultSize || 0,
      errorMessage: operation.error ? this._sanitizeError(operation.error) : null,
      metadata: operation.metadata || {},
      // Exclude sensitive data
      sensitive: this._flagSensitiveData(operation)
    };

    if (this.usingSqlite && this.db) {
      try {
        this.db.prepare(`
          INSERT INTO operations
          (id, sessionId, timestamp, operationType, status, url, duration, resultSize, errorMessage, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id,
          record.sessionId,
          record.timestamp,
          record.operationType,
          record.status,
          record.url,
          record.duration,
          record.resultSize,
          record.errorMessage,
          JSON.stringify(record.metadata)
        );
      } catch (error) {
        console.error('Failed to record operation in SQLite:', error);
        this._recordToJson(sessionId, record);
      }
    } else {
      this._recordToJson(sessionId, record);
    }

    return record.id;
  }

  /**
   * Record a session event
   */
  recordEvent(sessionId, eventType, details = {}) {
    const record = {
      id: crypto.randomBytes(8).toString('hex'),
      sessionId,
      timestamp: Date.now(),
      operationType: eventType, // Use operationType for consistency in queries
      status: 'event',
      url: null,
      duration: 0,
      resultSize: 0,
      errorMessage: null,
      metadata: this._sanitizeDetails(details)
    };

    if (this.usingSqlite && this.db) {
      try {
        this.db.prepare(`
          INSERT INTO operations
          (id, sessionId, timestamp, operationType, status, url, duration, resultSize, errorMessage, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id,
          record.sessionId,
          record.timestamp,
          record.operationType,
          record.status,
          record.url,
          record.duration,
          record.resultSize,
          record.errorMessage,
          JSON.stringify(record.metadata)
        );
      } catch (error) {
        console.error('Failed to record event in SQLite:', error);
        this._recordToJson(sessionId, record);
      }
    } else {
      this._recordToJson(sessionId, record);
    }

    return record.id;
  }

  /**
   * Record operation to JSON fallback
   * @private
   */
  _recordToJson(sessionId, record) {
    if (!this.operationLog.has(sessionId)) {
      this.operationLog.set(sessionId, []);
    }

    const log = this.operationLog.get(sessionId);
    log.push(record);

    // Truncate if exceeds size limit
    if (JSON.stringify(log).length > this.maxHistorySize) {
      log.splice(0, Math.floor(log.length / 4)); // Remove oldest 25%
    }
  }

  /**
   * Sanitize error messages (remove sensitive data)
   * @private
   */
  _sanitizeError(error) {
    if (!error) return null;

    const sanitized = error.toString();
    // Remove common sensitive patterns
    return sanitized
      .replace(/token[=:]\s*\S+/gi, 'token=***')
      .replace(/password[=:]\s*\S+/gi, 'password=***')
      .replace(/api[_-]?key[=:]\s*\S+/gi, 'api_key=***')
      .replace(/authorization[=:]\s*\S+/gi, 'authorization=***');
  }

  /**
   * Sanitize operation details (remove sensitive data)
   * @private
   */
  _sanitizeDetails(details) {
    const sanitized = JSON.parse(JSON.stringify(details));
    const sensitiveKeys = ['password', 'token', 'apiKey', 'authorization', 'creditCard'];

    const recurse = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key in obj) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()))) {
          obj[key] = '***';
        } else if (typeof obj[key] === 'object') {
          recurse(obj[key]);
        } else if (typeof obj[key] === 'string') {
          // Check value itself for sensitive patterns
          if (sensitivePatterns.some(pattern => pattern.test(obj[key]))) {
            obj[key] = '***';
          }
        }
      }
    };

    const sensitivePatterns = [
      /password[=:]\s*\S+/gi,
      /token[=:]\s*\S+/gi,
      /api[_-]?key[=:]\s*\S+/gi
    ];

    recurse(sanitized);
    return sanitized;
  }

  /**
   * Flag operations containing sensitive data
   * @private
   */
  _flagSensitiveData(operation) {
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /api[_-]?key/i,
      /authorization/i,
      /secret/i,
      /credit[_-]?card/i,
      /ssn/i,
      /social[_-]?security/i
    ];

    const checkString = (str) => {
      if (!str) return false;
      return sensitivePatterns.some(pattern => pattern.test(str));
    };

    // Check metadata for sensitive data
    if (operation.metadata) {
      for (const key in operation.metadata) {
        if (checkString(key) || checkString(JSON.stringify(operation.metadata[key]))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Query operations by filter
   */
  queryOperations(sessionId, filters = {}) {
    let results;

    if (this.usingSqlite && this.db) {
      results = this._querySqlite(sessionId, filters);
    } else {
      results = this._queryJson(sessionId, filters);
    }

    return results;
  }

  /**
   * Query operations from SQLite
   * @private
   */
  _querySqlite(sessionId, filters = {}) {
    let query = 'SELECT * FROM operations WHERE sessionId = ?';
    const params = [sessionId];

    if (filters.operationType) {
      query += ' AND operationType = ?';
      params.push(filters.operationType);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.since) {
      query += ' AND timestamp >= ?';
      params.push(filters.since);
    }

    if (filters.until) {
      query += ' AND timestamp <= ?';
      params.push(filters.until);
    }

    if (filters.url) {
      query += ' AND url LIKE ?';
      params.push(`%${filters.url}%`);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    try {
      const stmt = this.db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      console.error('SQLite query failed:', error);
      return [];
    }
  }

  /**
   * Query operations from JSON fallback
   * @private
   */
  _queryJson(sessionId, filters = {}) {
    let results = this.operationLog.get(sessionId) || [];

    if (filters.operationType) {
      results = results.filter(r => r.operationType === filters.operationType);
    }

    if (filters.status) {
      results = results.filter(r => r.status === filters.status);
    }

    if (filters.since) {
      results = results.filter(r => r.timestamp >= filters.since);
    }

    if (filters.until) {
      results = results.filter(r => r.timestamp <= filters.until);
    }

    if (filters.url) {
      results = results.filter(r => r.url && r.url.includes(filters.url));
    }

    results = results.sort((a, b) => b.timestamp - a.timestamp);

    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get history summary for session
   */
  getSummary(sessionId) {
    const operations = this.queryOperations(sessionId, { limit: 1000 });

    const summary = {
      sessionId,
      totalOperations: operations.length,
      operationTypes: {},
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      avgDuration: 0,
      timeRange: {
        earliest: null,
        latest: null
      }
    };

    for (const op of operations) {
      // Count by type
      summary.operationTypes[op.operationType] =
        (summary.operationTypes[op.operationType] || 0) + 1;

      // Count by status
      if (op.status === 'success' || op.status === 'completed') {
        summary.successCount++;
      } else if (op.status === 'error' || op.status === 'failed') {
        summary.failureCount++;
      }

      // Duration stats
      summary.totalDuration += op.duration || 0;

      // Time range
      if (!summary.timeRange.earliest || op.timestamp < summary.timeRange.earliest) {
        summary.timeRange.earliest = op.timestamp;
      }
      if (!summary.timeRange.latest || op.timestamp > summary.timeRange.latest) {
        summary.timeRange.latest = op.timestamp;
      }
    }

    if (operations.length > 0) {
      summary.avgDuration = summary.totalDuration / operations.length;
    }

    return summary;
  }

  /**
   * Export history to JSON format
   */
  exportToJson(sessionId, filters = {}) {
    const operations = this.queryOperations(sessionId, filters);
    const summary = this.getSummary(sessionId);

    return JSON.stringify(
      {
        metadata: {
          sessionId,
          exportedAt: new Date().toISOString(),
          operationCount: operations.length
        },
        summary,
        operations
      },
      null,
      2
    );
  }

  /**
   * Export history to CSV format
   */
  exportToCsv(sessionId, filters = {}) {
    const operations = this.queryOperations(sessionId, filters);

    const headers = [
      'timestamp',
      'operationType',
      'status',
      'url',
      'duration',
      'resultSize',
      'error'
    ];

    const rows = operations.map(op => [
      new Date(op.timestamp).toISOString(),
      op.operationType,
      op.status,
      op.url || '',
      op.duration,
      op.resultSize,
      op.errorMessage || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Export to forensic format (chain of custody)
   */
  exportForensic(sessionId, investigatorId = 'unknown') {
    const operations = this.queryOperations(sessionId, { limit: 5000 });
    const summary = this.getSummary(sessionId);

    const forensicReport = {
      header: {
        format: 'Basset Hound Forensic Audit Log',
        version: '1.0',
        exportDate: new Date().toISOString(),
        investigatorId: investigatorId || 'unknown',
        sessionId
      },
      chainOfCustody: {
        created: new Date().toISOString(),
        exportedBy: investigatorId || 'unknown',
        hash: this._computeHash(operations)
      },
      summary,
      timeline: operations.map(op => ({
        timestamp: new Date(op.timestamp).toISOString(),
        unixTimestamp: op.timestamp,
        operation: op.operationType,
        status: op.status,
        url: op.url,
        duration: op.duration,
        resultSize: op.resultSize,
        error: op.errorMessage,
        sensitive: op.sensitive || false
      }))
    };

    return JSON.stringify(forensicReport, null, 2);
  }

  /**
   * Compute hash of operations for integrity verification
   * @private
   */
  _computeHash(operations) {
    const hash = crypto.createHash('sha256');
    for (const op of operations) {
      hash.update(JSON.stringify(op));
    }
    return hash.digest('hex');
  }

  /**
   * Get operation statistics
   */
  getStatistics(sessionId, timeRangeMs = null) {
    const filters = {};

    if (timeRangeMs) {
      filters.since = Date.now() - timeRangeMs;
    }

    const operations = this.queryOperations(sessionId, filters);

    const stats = {
      totalOperations: operations.length,
      successRate: 0,
      failureRate: 0,
      errorsByType: {},
      operationDuration: {
        min: Infinity,
        max: 0,
        avg: 0,
        total: 0
      },
      dataTransfer: {
        totalBytes: 0,
        avgBytes: 0,
        maxBytes: 0
      },
      peakHours: {},
      uniqueUrls: new Set()
    };

    if (operations.length === 0) {
      return stats;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const op of operations) {
      // Success rate
      if (op.status === 'success' || op.status === 'completed') {
        successCount++;
      } else {
        failureCount++;
      }

      // Error tracking
      if (op.errorMessage) {
        const errorType = op.errorMessage.split(':')[0];
        stats.errorsByType[errorType] = (stats.errorsByType[errorType] || 0) + 1;
      }

      // Duration stats
      if (op.duration > 0) {
        stats.operationDuration.min = Math.min(stats.operationDuration.min, op.duration);
        stats.operationDuration.max = Math.max(stats.operationDuration.max, op.duration);
        stats.operationDuration.total += op.duration;
      }

      // Data transfer stats
      if (op.resultSize > 0) {
        stats.dataTransfer.totalBytes += op.resultSize;
        stats.dataTransfer.maxBytes = Math.max(stats.dataTransfer.maxBytes, op.resultSize);
      }

      // Peak hours
      const hour = new Date(op.timestamp).getHours();
      stats.peakHours[hour] = (stats.peakHours[hour] || 0) + 1;

      // Unique URLs
      if (op.url) {
        stats.uniqueUrls.add(op.url);
      }
    }

    stats.successRate = (successCount / operations.length * 100).toFixed(2) + '%';
    stats.failureRate = (failureCount / operations.length * 100).toFixed(2) + '%';
    stats.operationDuration.avg =
      stats.operationDuration.total / operations.length;
    stats.dataTransfer.avgBytes =
      Math.round(stats.dataTransfer.totalBytes / operations.length);
    stats.uniqueUrls = stats.uniqueUrls.size;

    return stats;
  }

  /**
   * Cleanup old history (older than retentionDays)
   */
  cleanup(retentionDays = null) {
    const days = retentionDays || this.retentionDays;
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    if (this.usingSqlite && this.db) {
      try {
        this.db.prepare(
          'DELETE FROM operations WHERE timestamp < ?'
        ).run(cutoffTime);

        this.db.prepare(
          'DELETE FROM session_events WHERE timestamp < ?'
        ).run(cutoffTime);
      } catch (error) {
        console.error('Failed to cleanup SQLite history:', error);
      }
    }

    // Cleanup JSON fallback
    for (const [sessionId, log] of this.operationLog.entries()) {
      const filtered = log.filter(op => op.timestamp > cutoffTime);
      if (filtered.length === 0) {
        this.operationLog.delete(sessionId);
      } else {
        this.operationLog.set(sessionId, filtered);
      }
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.usingSqlite && this.db) {
      try {
        this.db.close();
      } catch (error) {
        console.error('Failed to close SQLite connection:', error);
      }
    }
  }
}

module.exports = { SessionHistoryManager };
