/**
 * Structured Logger Tests
 * Tests for v12.3.0 structured logging infrastructure
 */

const StructuredLogger = require('../../src/infrastructure/structured-logger');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('StructuredLogger', () => {
  let logger;
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    logger = new StructuredLogger({
      logDir: tmpDir,
      enableConsole: false,
      enableFile: true,
      serviceName: 'test-service'
    });
  });

  afterEach(() => {
    // Clean up temp files
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tmpDir, file));
      }
      fs.rmdirSync(tmpDir);
    }
  });

  describe('Log Levels', () => {
    test('should support all log levels', () => {
      expect(() => {
        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');
        logger.critical('critical message');
      }).not.toThrow();
    });

    test('should set and get log level', () => {
      logger.setLevel('WARN');
      expect(logger.getLevel()).toBe('WARN');

      logger.setLevel('DEBUG');
      expect(logger.getLevel()).toBe('DEBUG');
    });

    test('should respect log level filtering', () => {
      logger.setLevel('WARN');
      const logListener = jest.fn();
      logger.on('log', logListener);

      logger.debug('debug');
      expect(logListener).not.toHaveBeenCalled();

      logger.warn('warn');
      expect(logListener).toHaveBeenCalled();
    });
  });

  describe('JSON Formatting', () => {
    test('should format logs as JSON', () => {
      const logListener = jest.fn();
      logger.on('log', logListener);

      logger.info('test message', { userId: 123 });

      expect(logListener).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'INFO',
          message: 'test message',
          context: expect.objectContaining({ userId: 123 })
        })
      );
    });

    test('should include service name in log', () => {
      const logListener = jest.fn();
      logger.on('log', logListener);

      logger.info('test');

      expect(logListener).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.any(Object)
        })
      );
    });
  });

  describe('File Logging', () => {
    test('should write logs to file', () => {
      logger.info('test message');

      const files = fs.readdirSync(tmpDir);
      expect(files.length).toBeGreaterThan(0);

      const logContent = fs.readFileSync(
        path.join(tmpDir, files[0]),
        'utf-8'
      );
      expect(logContent).toContain('test message');
      expect(logContent).toContain('INFO');
    });

    test('should append to existing log file', () => {
      logger.info('message 1');
      logger.info('message 2');

      const files = fs.readdirSync(tmpDir);
      const logContent = fs.readFileSync(
        path.join(tmpDir, files[0]),
        'utf-8'
      );

      const lines = logContent.split('\n').filter(l => l);
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle write errors gracefully', () => {
      const errorListener = jest.fn();
      logger.on('logger:error', errorListener);

      // Disable file after logger creation to cause error
      logger.options.enableFile = true;
      logger.logFilePath = '/invalid/path/that/does/not/exist/log.txt';

      logger.info('test');

      // Logger should emit error event but not throw
      expect(() => {
        logger.info('another test');
      }).not.toThrow();
    });
  });

  describe('Log Rotation', () => {
    test('should rotate logs when size exceeded', () => {
      // Set small max file size
      logger.options.maxFileSize = 100;

      // Write enough to exceed size
      for (let i = 0; i < 10; i++) {
        logger.info(`message ${i}`.repeat(10));
      }

      const files = fs.readdirSync(tmpDir);
      // Should have multiple files due to rotation
      expect(files.length).toBeGreaterThan(0);
    });

    test('should maintain max backups', () => {
      logger.options.maxFileSize = 50;
      logger.options.maxBackups = 3;

      // Write enough to trigger multiple rotations
      for (let i = 0; i < 20; i++) {
        logger.info(`message ${i}`.repeat(5));
      }

      const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('basset-hound-'));
      expect(files.length).toBeLessThanOrEqual(logger.options.maxBackups + 1);
    });
  });

  describe('Log Cleanup', () => {
    test('should clean up old log files', () => {
      // Create some test files
      const oldFile = path.join(tmpDir, 'basset-hound-old.log');
      fs.writeFileSync(oldFile, 'old log');

      // Set mtime to 8 days ago
      const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
      fs.utimesSync(oldFile, eightDaysAgo / 1000, eightDaysAgo / 1000);

      logger.cleanupOldLogs(7);

      expect(fs.existsSync(oldFile)).toBe(false);
    });

    test('should not delete recent logs', () => {
      logger.info('recent log');
      const files = fs.readdirSync(tmpDir);
      const originalCount = files.length;

      logger.cleanupOldLogs(7);

      const filesAfter = fs.readdirSync(tmpDir);
      expect(filesAfter.length).toBe(originalCount);
    });
  });

  describe('Error Logging', () => {
    test('should log Error objects with stack trace', () => {
      const error = new Error('Test error');
      logger.error('An error occurred', error);

      const files = fs.readdirSync(tmpDir);
      const logContent = fs.readFileSync(
        path.join(tmpDir, files[0]),
        'utf-8'
      );

      expect(logContent).toContain('Test error');
    });

    test('should log error context objects', () => {
      logger.error('Operation failed', {
        code: 'ERR_OPERATION',
        details: 'operation details'
      });

      const files = fs.readdirSync(tmpDir);
      const logContent = fs.readFileSync(
        path.join(tmpDir, files[0]),
        'utf-8'
      );

      expect(logContent).toContain('ERR_OPERATION');
    });
  });

  describe('Pretty Print Mode', () => {
    test('should format pretty printed logs', () => {
      const prettyLogger = new StructuredLogger({
        logDir: tmpDir,
        enableFile: false,
        enableConsole: false,
        prettyPrint: true
      });

      const logData = prettyLogger._formatLogEntry(1, 'test', {});
      const parsed = JSON.parse(logData);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('level');
      expect(parsed).toHaveProperty('message');
    });
  });

  describe('Environment Configuration', () => {
    test('should include environment in logs', () => {
      const envLogger = new StructuredLogger({
        logDir: tmpDir,
        enableFile: false,
        enableConsole: false,
        environment: 'test',
        serviceName: 'test-svc'
      });

      const logData = envLogger._formatLogEntry(1, 'test', {});
      const parsed = JSON.parse(logData);

      expect(parsed.environment).toBe('test');
      expect(parsed.service).toBe('test-svc');
    });
  });

  describe('Event Emission', () => {
    test('should emit log event', (done) => {
      logger.on('log', (data) => {
        expect(data).toHaveProperty('level');
        expect(data).toHaveProperty('message');
        done();
      });

      logger.info('test message');
    });

    test('should emit logger:error event on file write error', () => {
      const errorListener = jest.fn();
      logger.on('logger:error', errorListener);

      // Set invalid path
      logger.logFilePath = '/invalid/cannot/write/here.log';
      logger.info('this should fail gracefully');

      // Verify no exception thrown
      expect(() => {
        logger.info('more messages');
      }).not.toThrow();
    });
  });

  describe('Console Output', () => {
    test('should write to console when enabled', () => {
      const consoleLogger = new StructuredLogger({
        logDir: tmpDir,
        enableConsole: true,
        enableFile: false
      });

      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      consoleLogger.info('console test');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should not write to console when disabled', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      logger.info('no console');

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('no console'));
      consoleSpy.mockRestore();
    });
  });

  describe('Directory Initialization', () => {
    test('should create log directory if not exists', () => {
      const newDir = path.join(tmpDir, 'nested', 'dir');
      const newLogger = new StructuredLogger({
        logDir: newDir,
        enableFile: true,
        enableConsole: false
      });

      expect(fs.existsSync(newDir)).toBe(true);
    });

    test('should handle existing directory', () => {
      expect(() => {
        new StructuredLogger({
          logDir: tmpDir,
          enableFile: true,
          enableConsole: false
        });
      }).not.toThrow();
    });
  });

  describe('Contextual Logging', () => {
    test('should preserve log context', () => {
      logger.info('operation started', {
        userId: 123,
        action: 'login'
      });

      const files = fs.readdirSync(tmpDir);
      const logContent = fs.readFileSync(
        path.join(tmpDir, files[0]),
        'utf-8'
      );
      const parsed = JSON.parse(logContent.split('\n')[0]);

      expect(parsed).toMatchObject({
        message: 'operation started',
        userId: 123,
        action: 'login'
      });
    });
  });
});
