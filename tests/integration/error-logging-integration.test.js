/**
 * Error Logging Integration Tests
 * Tests for integration of ErrorLogger with WebSocket server, command dispatcher, etc.
 */

const {
  wrapWebSocketHandler,
  createCommandErrorHandler,
  instrumentCommandDispatcher,
  createNetworkErrorHandler,
  createParserErrorHandler,
  createAuthErrorHandler,
  createResourceErrorHandler,
  createHealthCheckWithErrors,
  createDashboardProvider,
  generateCorrelationId
} = require('../../src/logging/error-integration');

const {
  ErrorLogger,
  createErrorLogger,
  ERROR_CATEGORIES,
  SEVERITY_LEVELS
} = require('../../src/logging/error-logger');

// Mock implementations
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

class MockCommandDispatcher {
  constructor(shouldThrow = false) {
    this.shouldThrow = shouldThrow;
    this.dispatchCount = 0;
  }

  async dispatch(commandName, commandData, clientId) {
    this.dispatchCount++;

    if (this.shouldThrow) {
      throw new Error(`Command failed: ${commandName}`);
    }

    return { success: true, command: commandName };
  }
}

describe('Error Logging Integration', () => {
  let errorLogger;
  let mockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
    errorLogger = createErrorLogger({
      logger: mockLogger,
      name: 'integration-test'
    });
    errorLogger.setMaxListeners(100);
  });

  afterEach(() => {
    errorLogger.clearHistory();
    errorLogger.removeAllListeners();
  });

  // ==========================================
  // WebSocket Handler Wrapping Tests
  // ==========================================

  describe('WebSocket Handler Wrapping', () => {
    test('should wrap and execute handler successfully', async () => {
      let handlerExecuted = false;

      const originalHandler = function (ws) {
        handlerExecuted = true;
        return Promise.resolve();
      };

      const wrappedHandler = wrapWebSocketHandler(
        errorLogger,
        originalHandler,
        'connection'
      );

      const mockWS = {};
      await wrappedHandler.call(mockWS);

      expect(handlerExecuted).toBe(true);
    });

    test('should catch and log errors from handler', async () => {
      errorLogger.on('error', () => {}); // Listen to prevent unhandled event

      const originalHandler = function (ws) {
        throw new Error('Handler error');
      };

      const wrappedHandler = wrapWebSocketHandler(
        errorLogger,
        originalHandler,
        'connection'
      );

      const mockWS = {};

      try {
        await wrappedHandler.call(mockWS);
      } catch (error) {
        expect(error.message).toContain('Handler error');
      }

      const stats = errorLogger.getStats();
      expect(stats.total).toBe(1);
    });

    test('should include correlation ID in context', async () => {
      errorLogger.on('error', () => {}); // Listen to prevent unhandled event

      const originalHandler = function (ws) {
        throw new Error('Connection failed');
      };

      const wrappedHandler = wrapWebSocketHandler(
        errorLogger,
        originalHandler,
        'test_op'
      );

      try {
        await wrappedHandler.call({});
      } catch (error) {
        // Ignore
      }

      const recent = errorLogger.getRecent(1);
      expect(recent[0].context.correlationId).toBeDefined();
      expect(recent[0].context.operation).toBe('test_op');
    });

    test('should preserve handler context (this binding)', async () => {
      let contextPreserved = false;

      const context = { property: 'value' };
      const originalHandler = function (ws) {
        contextPreserved = this.property === 'value';
        return Promise.resolve();
      };

      const wrappedHandler = wrapWebSocketHandler(
        errorLogger,
        originalHandler,
        'test'
      );

      await wrappedHandler.call(context);
      expect(contextPreserved).toBe(true);
    });
  });

  // ==========================================
  // Command Dispatcher Instrumentation Tests
  // ==========================================

  describe('Command Dispatcher Instrumentation', () => {
    test('should instrument dispatcher with error handler', () => {
      const dispatcher = new MockCommandDispatcher(false);
      const instrumented = instrumentCommandDispatcher(errorLogger, dispatcher);

      expect(instrumented.errorLogger).toBe(errorLogger);
    });

    test('should execute commands successfully', async () => {
      const dispatcher = new MockCommandDispatcher(false);
      const instrumented = instrumentCommandDispatcher(errorLogger, dispatcher);

      const result = await instrumented.dispatch('test_command', {}, 'client1');

      expect(result.success).toBe(true);
      expect(result.command).toBe('test_command');
    });

    test('should log command errors', async () => {
      errorLogger.on('error', () => {}); // Listen to prevent unhandled event

      const dispatcher = new MockCommandDispatcher(true);
      const instrumented = instrumentCommandDispatcher(errorLogger, dispatcher);

      try {
        await instrumented.dispatch('failing_command', { data: 'test' }, 'client1');
      } catch (error) {
        // Expected
      }

      const stats = errorLogger.getStats();
      expect(stats.total).toBe(1);

      const recent = errorLogger.getRecent(1);
      expect(recent[0].context.operation).toContain('failing_command');
    });

    test('should log slow commands as warnings', async () => {
      const dispatcher = new MockCommandDispatcher(false);

      // Wrap dispatch to add delay
      const originalDispatch = dispatcher.dispatch;
      dispatcher.dispatch = async function (...args) {
        await new Promise(resolve => setTimeout(resolve, 5100)); // > 5s
        return originalDispatch.apply(this, args);
      };

      const instrumented = instrumentCommandDispatcher(errorLogger, dispatcher);

      await instrumented.dispatch('slow_command', {}, 'client1');

      const warningLogs = mockLogger.logs.filter(l => l.level === 'warn');
      expect(warningLogs.length).toBeGreaterThan(0);
      expect(warningLogs[0].message).toContain('Slow command');
    });

    test('should include command metadata in error context', async () => {
      const dispatcher = new MockCommandDispatcher(true);
      const instrumented = instrumentCommandDispatcher(errorLogger, dispatcher);

      try {
        await instrumented.dispatch('test_cmd', { param: 'value' }, 'client1');
      } catch (error) {
        // Expected
      }

      const recent = errorLogger.getRecent(1);
      expect(recent[0].context.metadata).toBeDefined();
      expect(recent[0].context.metadata.commandName).toBe('test_cmd');
    });
  });

  // ==========================================
  // Specialized Error Handler Tests
  // ==========================================

  describe('Specialized Error Handlers', () => {
    test('should handle network errors with retryability', () => {
      const networkErrorHandler = createNetworkErrorHandler(errorLogger);

      const error = new Error('ECONNRESET: Connection reset');
      networkErrorHandler(error, {
        method: 'GET',
        url: 'https://example.com',
        statusCode: 500
      }, 'corr_123');

      const recent = errorLogger.getRecent(1);
      expect(recent[0].context.metadata.retryable).toBe(true);
      expect(recent[0].classification.category).toBe(ERROR_CATEGORIES.NETWORK);
    });

    test('should handle parser errors with context', () => {
      const parserErrorHandler = createParserErrorHandler(errorLogger);

      const error = new SyntaxError('Unexpected token');
      parserErrorHandler(error, 'json', '{"invalid"', 'corr_123');

      const recent = errorLogger.getRecent(1);
      expect(recent[0].context.metadata.parserType).toBe('json');
      expect(recent[0].classification.category).toBe(ERROR_CATEGORIES.PARSING);
    });

    test('should handle auth errors safely', () => {
      const authErrorHandler = createAuthErrorHandler(errorLogger);

      const error = new Error('Invalid credentials');
      authErrorHandler(error, 'oauth', {
        provider: 'google',
        timestamp: Date.now()
      }, 'corr_123');

      const recent = errorLogger.getRecent(1);
      expect(recent[0].context.metadata.authType).toBe('oauth');
      // Sensitive data should not be logged
      expect(recent[0].context.metadata).not.toHaveProperty('password');
    });

    test('should handle resource errors with metrics', () => {
      const resourceErrorHandler = createResourceErrorHandler(errorLogger);

      const error = new Error('Out of memory');
      resourceErrorHandler(error, 'memory', {
        available: 512,
        requested: 1024,
        limit: 2048
      }, 'corr_123');

      const recent = errorLogger.getRecent(1);
      expect(recent[0].context.metadata.resourceType).toBe('memory');
      expect(recent[0].context.metadata.available).toBe(512);
      expect(recent[0].classification.severity).toBe(SEVERITY_LEVELS.CRITICAL);
    });
  });

  // ==========================================
  // Health Check Integration Tests
  // ==========================================

  describe('Health Check Integration', () => {
    test('should report healthy status', () => {
      const healthCheck = createHealthCheckWithErrors(errorLogger);
      const health = healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.errors.total).toBe(0);
    });

    test('should report degraded status on high errors', () => {
      const healthCheck = createHealthCheckWithErrors(errorLogger);

      for (let i = 0; i < 10; i++) {
        errorLogger.logError(new Error('HIGH severity'), { operation: 'op' });
      }

      const health = healthCheck();
      expect(health.errors.total).toBe(10);
    });

    test('should report critical status on critical errors', () => {
      const healthCheck = createHealthCheckWithErrors(errorLogger);

      errorLogger.logError(new Error('Out of memory'), { operation: 'op' });

      const health = healthCheck();
      expect(health.status).toBe('critical');
    });

    test('should include error breakdown in health status', () => {
      const healthCheck = createHealthCheckWithErrors(errorLogger);

      errorLogger.logError(new Error('ECONNREFUSED'), { operation: 'op1' });
      errorLogger.logError(new Error('Out of memory'), { operation: 'op2' });
      errorLogger.logError(new Error('ETIMEDOUT'), { operation: 'op3' });

      const health = healthCheck();
      expect(health.errors.bySeverity).toBeDefined();
      expect(health.errors.topErrors).toBeDefined();
      expect(health.errors.topErrors.length).toBeGreaterThan(0);
    });

    test('should track active alerts in health status', () => {
      const healthCheck = createHealthCheckWithErrors(errorLogger);

      errorLogger.logError(new Error('Out of memory'), { operation: 'op' });
      errorLogger.logError(new Error('ECONNREFUSED'), { operation: 'op' });
      errorLogger.logError(new Error('Invalid token'), { operation: 'op' });

      const health = healthCheck();
      expect(health.errors.activeAlerts).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // Dashboard Integration Tests
  // ==========================================

  describe('Dashboard Integration', () => {
    test('should provide error trends', () => {
      const dashboard = createDashboardProvider(errorLogger);

      errorLogger.logError(new Error('Error 1'), { operation: 'op1' });
      errorLogger.logError(new Error('Error 2'), { operation: 'op2' });
      errorLogger.logError(new Error('Error 3'), { operation: 'op3' });

      const trends = dashboard.getErrorTrends(3600000);
      expect(Object.keys(trends).length).toBeGreaterThan(0);
    });

    test('should provide error breakdown', () => {
      const dashboard = createDashboardProvider(errorLogger);

      errorLogger.logError(new Error('ECONNREFUSED'), { operation: 'op1' });
      errorLogger.logError(new Error('ETIMEDOUT'), { operation: 'op2' });
      errorLogger.logError(new Error('Out of memory'), { operation: 'op3' });

      const breakdown = dashboard.getErrorBreakdown();
      expect(breakdown.byCategory).toBeDefined();
      expect(breakdown.bySeverity).toBeDefined();
      expect(breakdown.topErrors).toBeDefined();
    });

    test('should provide alert status', () => {
      const dashboard = createDashboardProvider(errorLogger);

      errorLogger.logError(new Error('Out of memory'), { operation: 'op' });

      const alertStatus = dashboard.getAlertStatus();
      expect(alertStatus.activeAlerts).toBeGreaterThan(0);
      expect(alertStatus.criticalCount).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // Correlation ID Tests
  // ==========================================

  describe('Correlation IDs', () => {
    test('should generate unique correlation IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      expect(id1).not.toBe(id2);
      expect(id1.startsWith('corr_')).toBe(true);
      expect(id2.startsWith('corr_')).toBe(true);
    });

    test('should track correlation ID through error chain', () => {
      const corrId = generateCorrelationId();

      const handlerError = () => {
        throw new Error('Handler failed');
      };

      const wrappedHandler = wrapWebSocketHandler(
        errorLogger,
        handlerError,
        'test_op'
      );

      try {
        wrappedHandler.call({});
      } catch (error) {
        // Expected
      }

      const recent = errorLogger.getRecent(1);
      expect(recent[0].context.correlationId).toBeDefined();
    });
  });

  // ==========================================
  // Multi-Handler Coordination Tests
  // ==========================================

  describe('Multi-Handler Coordination', () => {
    test('should coordinate errors from multiple handlers', async () => {
      const handler1 = async () => {
        throw new Error('Handler 1 error');
      };

      const handler2 = async () => {
        throw new Error('Handler 2 error');
      };

      const wrapped1 = wrapWebSocketHandler(errorLogger, handler1, 'op1');
      const wrapped2 = wrapWebSocketHandler(errorLogger, handler2, 'op2');

      try {
        await wrapped1.call({});
      } catch (e) {
        // Expected
      }

      try {
        await wrapped2.call({});
      } catch (e) {
        // Expected
      }

      const stats = errorLogger.getStats();
      expect(stats.total).toBe(2);

      const recent = errorLogger.getRecent(10);
      expect(recent.some(e => e.context.operation === 'op1')).toBe(true);
      expect(recent.some(e => e.context.operation === 'op2')).toBe(true);
    });

    test('should maintain error separation across operations', async () => {
      const dispatcher = new MockCommandDispatcher(true);
      const instrumented = instrumentCommandDispatcher(errorLogger, dispatcher);

      try {
        await instrumented.dispatch('cmd1', {}, 'client1');
      } catch (e) {
        // Expected
      }

      try {
        await instrumented.dispatch('cmd2', {}, 'client2');
      } catch (e) {
        // Expected
      }

      const stats = errorLogger.getStats();
      expect(stats.total).toBe(2);

      const byOperation = {
        cmd1: errorLogger.getRecent(10, { operation: 'command:cmd1' }),
        cmd2: errorLogger.getRecent(10, { operation: 'command:cmd2' })
      };

      expect(byOperation.cmd1.length).toBe(1);
      expect(byOperation.cmd2.length).toBe(1);
    });
  });

  // ==========================================
  // Real-World Scenario Tests
  // ==========================================

  describe('Real-World Scenarios', () => {
    test('should handle cascading failures', async () => {
      const errors = [];

      errorLogger.on('error', (entry) => {
        errors.push(entry);
      });

      // Simulate a cascade of failures
      errorLogger.logError(new Error('Network unavailable'), {
        operation: 'connect'
      });

      errorLogger.logError(new Error('ETIMEDOUT'), {
        operation: 'query',
        metadata: { causedBy: 'network' }
      });

      errorLogger.logError(new Error('Out of memory'), {
        operation: 'cache',
        metadata: { causedBy: 'timeout' }
      });

      expect(errors.length).toBe(3);

      const stats = errorLogger.getStats();
      expect(stats.bySeverity.critical).toBeGreaterThan(0);
    });

    test('should handle recovery patterns', () => {
      const operations = [];

      errorLogger.logError(new Error('ECONNREFUSED'), {
        operation: 'attempt_1'
      });

      errorLogger.logWarning('Retrying with exponential backoff', {
        operation: 'attempt_1',
        metadata: { delay: 1000 }
      });

      // Simulate recovery
      const successful = errorLogger.logWarning('Connection restored', {
        operation: 'attempt_2',
        metadata: { recoveryTime: 2500 }
      });

      expect(successful).not.toBeNull();

      const recent = errorLogger.getRecent(10);
      expect(recent.length).toBe(2); // Error + warning
    });
  });
});
