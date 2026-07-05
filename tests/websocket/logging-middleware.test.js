/**
 * WebSocket Logging Middleware Tests
 *
 * Tests for WebSocketLoggingMiddleware covering:
 * - Request/response logging
 * - Log levels and filtering
 * - Sensitive data masking
 * - Payload truncation
 * - Log rotation and cleanup
 * - Statistics collection
 * - File I/O
 */

const fs = require('fs');
const path = require('path');
const { WebSocketLoggingMiddleware, LOG_LEVELS, LEVEL_NAMES } = require('../../websocket/logging-middleware');

// Test configuration
const testLogDir = path.join(__dirname, '../results/logging-middleware-logs');

// Cleanup function
function cleanupTestDir() {
  if (fs.existsSync(testLogDir)) {
    const files = fs.readdirSync(testLogDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(testLogDir, file));
    });
    fs.rmdirSync(testLogDir);
  }
}

describe('WebSocketLoggingMiddleware', () => {
  let middleware;

  beforeEach(() => {
    cleanupTestDir();
    middleware = new WebSocketLoggingMiddleware({
      level: 'DEBUG',
      logDir: testLogDir,
      maskSensitive: true,
      truncatePayloads: true,
      maxPayloadLength: 100,
      writeToFile: true,
      writeToConsole: false
    });
  });

  afterEach(() => {
    if (middleware) {
      middleware.shutdown();
    }
    cleanupTestDir();
  });

  describe('Initialization', () => {
    it('should create middleware with default options', () => {
      const mw = new WebSocketLoggingMiddleware();
      expect(mw.level).toBe(LOG_LEVELS.INFO);
      expect(mw.maskSensitive).toBe(true);
      expect(mw.truncatePayloads).toBe(true);
      mw.shutdown();
    });

    it('should create middleware with custom options', () => {
      expect(middleware.level).toBe(LOG_LEVELS.DEBUG);
      expect(middleware.logDir).toBe(testLogDir);
      expect(middleware.maskSensitive).toBe(true);
    });

    it('should create log directory if it does not exist', () => {
      expect(fs.existsSync(testLogDir)).toBe(true);
    });

    it('should open initial log file', (done) => {
      middleware.on('logFileOpened', (filePath) => {
        expect(fs.existsSync(filePath)).toBe(true);
        done();
      });
    });
  });

  describe('Request Logging', () => {
    it('should log a request with parameters', (done) => {
      const command = 'navigateTo';
      const clientId = 'client-123';
      const params = { url: 'https://example.com', timeout: 30000 };

      middleware.on('request', (data) => {
        expect(data.command).toBe(command);
        expect(data.clientId).toBe(clientId);
        done();
      });

      middleware.logRequest(command, clientId, params);
    });

    it('should write request to log file', (done) => {
      middleware.logRequest('click', 'client-456', { selector: '#btn' });

      setTimeout(() => {
        const logFile = middleware.currentLogFile;
        const content = fs.readFileSync(logFile, 'utf8');
        expect(content).toContain('click');
        expect(content).toContain('client-456');
        expect(content).toContain('#btn');
        done();
      }, 100);
    });

    it('should respect log level filtering', (done) => {
      middleware.setLevel('INFO'); // Only INFO and above

      // DEBUG should not be logged
      middleware.logRequest('test', 'client-1', {}, 'DEBUG');

      setTimeout(() => {
        const logFile = middleware.currentLogFile;
        const content = fs.readFileSync(logFile, 'utf8');
        expect(content).not.toContain('test');
        done();
      }, 100);
    });

    it('should exclude specified commands', () => {
      const mw = new WebSocketLoggingMiddleware({
        logDir: testLogDir,
        excludeCommands: ['ping', 'heartbeat']
      });

      const eventSpy = jest.fn();
      mw.on('request', eventSpy);

      mw.logRequest('ping', 'client-1', {});
      expect(eventSpy).not.toHaveBeenCalled();

      mw.logRequest('navigateTo', 'client-1', {});
      expect(eventSpy).toHaveBeenCalled();

      mw.shutdown();
    });

    it('should increment request counter', () => {
      const initialCount = middleware.stats.totalRequests;
      middleware.logRequest('test', 'client-1', {});
      expect(middleware.stats.totalRequests).toBe(initialCount + 1);
    });
  });

  describe('Response Logging', () => {
    it('should log a successful response', (done) => {
      middleware.on('response', (data) => {
        expect(data.command).toBe('navigateTo');
        expect(data.statusCode).toBe(200);
        expect(data.responseTime).toBe(150);
        done();
      });

      middleware.logResponse('navigateTo', 'client-123', 200, 150, 2048);
    });

    it('should log a failed response with error', (done) => {
      middleware.on('response', (data) => {
        expect(data.statusCode).toBe(504);
        expect(data.error).toBe('Command timed out');
        done();
      });

      middleware.logResponse(
        'click',
        'client-456',
        504,
        29999,
        512,
        'Command timed out',
        'COMMAND_TIMED_OUT'
      );
    });

    it('should track successful vs failed responses', () => {
      middleware.logResponse('cmd1', 'c1', 200, 100);
      middleware.logResponse('cmd2', 'c2', 200, 100);
      middleware.logResponse('cmd3', 'c3', 500, 100);

      expect(middleware.stats.successfulResponses).toBe(2);
      expect(middleware.stats.failedResponses).toBe(1);
      expect(middleware.stats.totalResponses).toBe(3);
    });

    it('should calculate average response time', () => {
      middleware.logResponse('cmd1', 'c1', 200, 100);
      middleware.logResponse('cmd2', 'c2', 200, 200);
      middleware.logResponse('cmd3', 'c3', 200, 300);

      expect(middleware.stats.averageResponseTime).toBe(200);
    });

    it('should write response to log file with status code', (done) => {
      middleware.logResponse('test', 'client-1', 200, 1234, 2048);

      setTimeout(() => {
        const content = fs.readFileSync(middleware.currentLogFile, 'utf8');
        expect(content).toContain('Response: 200');
        expect(content).toContain('1234ms');
        done();
      }, 100);
    });

    it('should format response size in bytes', (done) => {
      middleware.logResponse('test', 'client-1', 200, 100, 2048);

      setTimeout(() => {
        const content = fs.readFileSync(middleware.currentLogFile, 'utf8');
        expect(content).toContain('2.0KB');
        done();
      }, 100);
    });

    it('should include error code and recovery in logs', (done) => {
      middleware.logResponse(
        'test',
        'client-1',
        504,
        1000,
        0,
        'Timeout',
        'COMMAND_TIMED_OUT',
        'Increase timeout or check selector'
      );

      setTimeout(() => {
        const content = fs.readFileSync(middleware.currentLogFile, 'utf8');
        expect(content).toContain('COMMAND_TIMED_OUT');
        expect(content).toContain('Increase timeout');
        done();
      }, 100);
    });
  });

  describe('Sensitive Data Masking', () => {
    it('should mask passwords in logs', (done) => {
      middleware.logRequest('authenticate', 'client-1', {
        username: 'user@example.com',
        password: 'secretPassword123'
      });

      setTimeout(() => {
        const content = fs.readFileSync(middleware.currentLogFile, 'utf8');
        expect(content).toContain('user@example.com');
        expect(content).not.toContain('secretPassword123');
        expect(content).toContain('***MASKED***');
        done();
      }, 100);
    });

    it('should mask tokens in logs', (done) => {
      middleware.logRequest('authenticate', 'client-1', {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      });

      setTimeout(() => {
        const content = fs.readFileSync(middleware.currentLogFile, 'utf8');
        expect(content).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
        expect(content).toContain('***MASKED***');
        done();
      }, 100);
    });

    it('should mask API keys', (done) => {
      middleware.logRequest('test', 'client-1', {
        api_key: 'sk_live_' + 'abc123def456'
      });

      setTimeout(() => {
        const content = fs.readFileSync(middleware.currentLogFile, 'utf8');
        expect(content).not.toContain('sk_live_' + 'abc123def456');
        expect(content).toContain('***MASKED***');
        done();
      }, 100);
    });

    it('should disable masking if configured', (done) => {
      const mw = new WebSocketLoggingMiddleware({
        logDir: testLogDir,
        maskSensitive: false
      });

      mw.logRequest('test', 'client-1', {
        password: 'secretPassword123'
      });

      setTimeout(() => {
        const content = fs.readFileSync(mw.currentLogFile, 'utf8');
        expect(content).toContain('secretPassword123');
        mw.shutdown();
        done();
      }, 100);
    });
  });

  describe('Payload Truncation', () => {
    it('should truncate large payloads', (done) => {
      const largePayload = 'x'.repeat(500);
      middleware.logRequest('test', 'client-1', { data: largePayload });

      setTimeout(() => {
        const content = fs.readFileSync(middleware.currentLogFile, 'utf8');
        expect(content).toContain('TRUNCATED');
        expect(content.indexOf('x'.repeat(500))).toBe(-1);
        done();
      }, 100);
    });

    it('should show truncation size', (done) => {
      const largePayload = 'x'.repeat(500);
      middleware.logRequest('test', 'client-1', { data: largePayload });

      setTimeout(() => {
        const content = fs.readFileSync(middleware.currentLogFile, 'utf8');
        expect(content).toMatch(/TRUNCATED.*\+\d+ bytes/);
        done();
      }, 100);
    });

    it('should disable truncation if configured', (done) => {
      const mw = new WebSocketLoggingMiddleware({
        logDir: testLogDir,
        truncatePayloads: false,
        maxPayloadLength: 100
      });

      const largePayload = 'x'.repeat(500);
      mw.logRequest('test', 'client-1', { data: largePayload });

      setTimeout(() => {
        const content = fs.readFileSync(mw.currentLogFile, 'utf8');
        expect(content).not.toContain('TRUNCATED');
        mw.shutdown();
        done();
      }, 100);
    });
  });

  describe('Log Levels', () => {
    it('should support all log levels', () => {
      expect(LOG_LEVELS.ERROR).toBe(0);
      expect(LOG_LEVELS.WARN).toBe(1);
      expect(LOG_LEVELS.INFO).toBe(2);
      expect(LOG_LEVELS.DEBUG).toBe(3);
    });

    it('should change log level at runtime', () => {
      middleware.setLevel('ERROR');
      expect(middleware.getLevel()).toBe('ERROR');

      middleware.setLevel('DEBUG');
      expect(middleware.getLevel()).toBe('DEBUG');
    });

    it('should reject invalid log level', () => {
      expect(() => {
        middleware.setLevel('INVALID');
      }).toThrow();
    });

    it('should emit levelChanged event', (done) => {
      middleware.on('levelChanged', (level) => {
        expect(level).toBe('WARN');
        done();
      });

      middleware.setLevel('WARN');
    });

    it('should filter by level correctly', (done) => {
      middleware.setLevel('WARN');

      const eventSpy = jest.fn();
      middleware.on('request', eventSpy);

      // DEBUG and INFO should not be logged
      middleware.logRequest('cmd1', 'c1', {}, 'DEBUG');
      middleware.logRequest('cmd2', 'c2', {}, 'INFO');
      expect(eventSpy).not.toHaveBeenCalled();

      // WARN and ERROR should be logged
      middleware.logRequest('cmd3', 'c3', {}, 'WARN');
      expect(eventSpy).toHaveBeenCalledTimes(1);

      middleware.logRequest('cmd4', 'c4', {}, 'ERROR');
      expect(eventSpy).toHaveBeenCalledTimes(2);

      done();
    });
  });

  describe('Statistics', () => {
    it('should provide stats object', () => {
      const stats = middleware.getStats();
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('totalResponses');
      expect(stats).toHaveProperty('successfulResponses');
      expect(stats).toHaveProperty('failedResponses');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('requestsPerMinute');
      expect(stats).toHaveProperty('successRate');
    });

    it('should calculate success rate', () => {
      middleware.logResponse('cmd1', 'c1', 200, 100);
      middleware.logResponse('cmd2', 'c2', 200, 100);
      middleware.logResponse('cmd3', 'c3', 500, 100);

      const stats = middleware.getStats();
      expect(stats.successRate).toBe('66.67%');
    });

    it('should calculate requests per minute', (done) => {
      const initialTime = middleware.stats.startTime;

      // Mock time 60 seconds later
      middleware.stats.startTime = Date.now() - 60000;

      middleware.logRequest('cmd1', 'c1', {});
      middleware.logRequest('cmd2', 'c2', {});
      middleware.logRequest('cmd3', 'c3', {});

      const stats = middleware.getStats();
      expect(stats.requestsPerMinute).toBe(3);

      middleware.stats.startTime = initialTime;
      done();
    });

    it('should reset statistics', () => {
      middleware.logRequest('cmd1', 'c1', {});
      middleware.logResponse('cmd2', 'c2', 200, 100);

      expect(middleware.stats.totalRequests).toBeGreaterThan(0);
      expect(middleware.stats.totalResponses).toBeGreaterThan(0);

      middleware.resetStats();

      expect(middleware.stats.totalRequests).toBe(0);
      expect(middleware.stats.totalResponses).toBe(0);
    });
  });

  describe('Log Files', () => {
    it('should get list of log files', () => {
      middleware.logRequest('test', 'client-1', {});

      const files = middleware.getLogFiles();
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toHaveProperty('name');
      expect(files[0]).toHaveProperty('path');
      expect(files[0]).toHaveProperty('size');
      expect(files[0]).toHaveProperty('created');
    });

    it('should clear all logs', (done) => {
      middleware.logRequest('test', 'client-1', {});

      let filesBeforeClear = middleware.getLogFiles();
      expect(filesBeforeClear.length).toBeGreaterThan(0);

      middleware.clearLogs();

      setTimeout(() => {
        let filesAfterClear = middleware.getLogFiles();
        // After clear, should only have one empty log file
        expect(filesAfterClear.length).toBeLessThanOrEqual(1);
        done();
      }, 200);
    });
  });

  describe('Log Rotation', () => {
    it('should rotate log file when size exceeded', (done) => {
      const mw = new WebSocketLoggingMiddleware({
        level: 'DEBUG',
        logDir: testLogDir,
        maxLogFileSize: 1000, // 1KB limit
        maxLogFiles: 3,
        writeToFile: true,
        writeToConsole: false
      });

      const firstLogFile = mw.currentLogFile;

      // Write enough data to exceed size limit
      for (let i = 0; i < 50; i++) {
        mw.logRequest('test', 'client-1', {
          data: 'x'.repeat(100)
        });
      }

      // Trigger rotation check
      mw._checkLogRotation();

      setTimeout(() => {
        const secondLogFile = mw.currentLogFile;
        // Should have created a new log file
        expect(secondLogFile).not.toBe(firstLogFile);
        mw.shutdown();
        done();
      }, 200);
    });

    it('should keep maximum number of log files', (done) => {
      const mw = new WebSocketLoggingMiddleware({
        level: 'DEBUG',
        logDir: testLogDir,
        maxLogFileSize: 500,
        maxLogFiles: 2,
        writeToFile: true,
        writeToConsole: false
      });

      // Create multiple log entries to trigger multiple rotations
      for (let i = 0; i < 200; i++) {
        mw.logRequest('test', 'client-1', {
          data: 'x'.repeat(50)
        });
      }

      mw._checkLogRotation();

      setTimeout(() => {
        const files = mw.getLogFiles();
        // Should not exceed maxLogFiles
        expect(files.length).toBeLessThanOrEqual(2);
        mw.shutdown();
        done();
      }, 300);
    });
  });

  describe('Events', () => {
    it('should emit request event', (done) => {
      middleware.on('request', (data) => {
        expect(data.command).toBe('test');
        expect(data.clientId).toBe('client-1');
        done();
      });

      middleware.logRequest('test', 'client-1', {});
    });

    it('should emit response event', (done) => {
      middleware.on('response', (data) => {
        expect(data.command).toBe('test');
        expect(data.statusCode).toBe(200);
        done();
      });

      middleware.logResponse('test', 'client-1', 200, 100);
    });

    it('should emit shutdown event', (done) => {
      const mw = new WebSocketLoggingMiddleware({ logDir: testLogDir });

      mw.on('shutdown', () => {
        done();
      });

      mw.shutdown();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null parameters', () => {
      expect(() => {
        middleware.logRequest('test', 'client-1', null);
      }).not.toThrow();
    });

    it('should handle undefined parameters', () => {
      expect(() => {
        middleware.logRequest('test', 'client-1', undefined);
      }).not.toThrow();
    });

    it('should handle circular references in params', () => {
      const circular = { a: 1 };
      circular.self = circular;

      expect(() => {
        middleware.logRequest('test', 'client-1', circular);
      }).not.toThrow();
    });

    it('should handle very long command names', () => {
      const longName = 'cmd_' + 'x'.repeat(1000);
      expect(() => {
        middleware.logRequest(longName, 'client-1', {});
      }).not.toThrow();
    });

    it('should handle special characters in client ID', () => {
      expect(() => {
        middleware.logRequest('test', 'client-!@#$%^&*()', {});
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent logs', (done) => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        middleware.logRequest(`cmd${i}`, `client-${i}`, { data: i });
        middleware.logResponse(`cmd${i}`, `client-${i}`, 200, 100);
      }

      setTimeout(() => {
        expect(middleware.stats.totalRequests).toBe(100);
        expect(middleware.stats.totalResponses).toBe(100);
        done();
      }, 500);
    });
  });
});
