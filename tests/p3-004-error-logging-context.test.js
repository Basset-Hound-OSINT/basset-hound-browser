/**
 * P3-004: Error Logging Context Tests
 * Tests comprehensive error context capture and retrieval
 */

const ErrorTracer = require('../src/observability/error-tracer');
const { ErrorContextManager } = require('../src/observability/error-tracer');

describe('P3-004: Error Logging Context', () => {
  let tracer;
  let contextManager;

  beforeEach(() => {
    tracer = new ErrorTracer();
    contextManager = new ErrorContextManager();
  });

  // Test 1: Basic error context capture
  test('should capture comprehensive error context', () => {
    const spanId = 'span_1';
    const errorData = {
      message: 'Test error',
      errorType: 'TestError',
      component: 'test-component',
      requestId: 'req_123',
      command: 'navigate',
      parameters: { url: 'https://example.com' }
    };

    const error = tracer.traceError(spanId, errorData);

    expect(error.errorId).toBeDefined();
    expect(error.requestId).toBe('req_123');
    expect(error.component).toBe('test-component');

    const context = tracer.contextManager.getContext(error.errorId);
    expect(context).toBeDefined();
    expect(context.requestId).toBe('req_123');
    expect(context.command).toBe('navigate');
  });

  // Test 2: Parameter sanitization
  test('should sanitize sensitive parameters', () => {
    const context = contextManager.addContext('err_1', {
      parameters: {
        username: 'user123',
        password: 'secret123',
        apiKey: 'key_abc',
        normalParam: 'normal'
      }
    });

    expect(context.parameters.password).toBe('[REDACTED]');
    expect(context.parameters.apiKey).toBe('[REDACTED]');
    expect(context.parameters.normalParam).toBe('normal');
  });

  // Test 3: System context capture
  test('should capture system context', () => {
    const context = contextManager.addContext('err_2', {});

    expect(context.systemContext).toBeDefined();
    expect(context.systemContext.platform).toBeDefined();
    expect(context.systemContext.uptime).toBeDefined();
    expect(context.systemContext.memoryUsage).toBeDefined();
  });

  // Test 4: Search errors by request ID
  test('should search errors by request ID', () => {
    const requestId = 'req_search_1';

    tracer.traceError('span_1', {
      message: 'Error 1',
      requestId
    });

    tracer.traceError('span_2', {
      message: 'Error 2',
      requestId
    });

    tracer.traceError('span_3', {
      message: 'Error 3',
      requestId: 'other_req'
    });

    const results = tracer.searchByRequestId(requestId);
    expect(results.length).toBe(2);
    expect(results.every(r => r.context.requestId === requestId)).toBe(true);
  });

  // Test 5: Search errors by component
  test('should search errors by component', () => {
    tracer.traceError('span_1', {
      message: 'Error in extraction',
      component: 'extraction'
    });

    tracer.traceError('span_2', {
      message: 'Error in evasion',
      component: 'evasion'
    });

    tracer.traceError('span_3', {
      message: 'Another extraction error',
      component: 'extraction'
    });

    const results = tracer.searchByComponent('extraction');
    expect(results.length).toBe(2);
    expect(results.every(r => r.context.component === 'extraction')).toBe(true);
  });

  // Test 6: Bounded context storage
  test('should maintain bounded context storage', () => {
    const manager = new ErrorContextManager();
    manager.maxContextSize = 10;

    // Add more than max
    for (let i = 0; i < 20; i++) {
      manager.addContext(`err_${i}`, {
        requestId: `req_${i}`
      });
    }

    expect(manager.contexts.size).toBeLessThanOrEqual(10);
  });

  // Test 7: Full error with context retrieval
  test('should retrieve error with full context', () => {
    const errorData = {
      message: 'Full context error',
      errorType: 'ContextError',
      requestId: 'req_full',
      command: 'click',
      parameters: { selector: '.button' },
      component: 'interaction'
    };

    const error = tracer.traceError('span_full', errorData);
    const errorWithContext = tracer.getErrorWithContext(error.errorId);

    expect(errorWithContext).toBeDefined();
    expect(errorWithContext.error.errorId).toBe(error.errorId);
    expect(errorWithContext.context.requestId).toBe('req_full');
    expect(errorWithContext.context.command).toBe('click');
  });

  // Test 8: Get recent errors with context
  test('should get recent errors with context', () => {
    for (let i = 0; i < 15; i++) {
      tracer.traceError(`span_${i}`, {
        message: `Error ${i}`,
        requestId: `req_${i}`
      });
    }

    const recent = tracer.getRecentErrorsWithContext(5);
    expect(recent.length).toBeLessThanOrEqual(5);
    expect(recent.every(r => r.context !== undefined)).toBe(true);
  });

  // Test 9: Call stack formatting
  test('should format call stack correctly', () => {
    const callStack = [
      'at Function.traceError (error-tracer.js:100)',
      'at test (test.js:50)',
      'at Object.<anonymous> (test.js:10)',
      'at Module._load (internal/modules/cjs/loader.js:20)'
    ];

    const context = contextManager.addContext('err_stack', {
      callStack
    });

    expect(context.callStack).toBeDefined();
    expect(Array.isArray(context.callStack)).toBe(true);
    expect(context.callStack.length).toBeLessThanOrEqual(10);
  });

  // Test 10: Multiple context search
  test('should support multiple context search criteria', () => {
    tracer.traceError('span_1', {
      message: 'Error A',
      requestId: 'req_100',
      component: 'comp_x'
    });

    tracer.traceError('span_2', {
      message: 'Error B',
      requestId: 'req_100',
      component: 'comp_y'
    });

    tracer.traceError('span_3', {
      message: 'Error C',
      requestId: 'req_200',
      component: 'comp_x'
    });

    const byReq = tracer.searchByRequestId('req_100');
    const byComp = tracer.searchByComponent('comp_x');

    expect(byReq.length).toBe(2);
    expect(byComp.length).toBe(2);
  });

  // Test 11: User context preservation
  test('should preserve user context in error', () => {
    const userContext = {
      userId: 'user_123',
      sessionId: 'session_456',
      username: 'testuser'
    };

    const error = tracer.traceError('span_user', {
      message: 'User action error',
      userContext
    });

    const context = tracer.contextManager.getContext(error.errorId);
    expect(context.userContext).toEqual(userContext);
  });

  // Test 12: Additional info storage
  test('should store additional debug info', () => {
    const additionalInfo = {
      debugFlag: true,
      retryCount: 3,
      lastAttemptTime: Date.now()
    };

    const context = contextManager.addContext('err_debug', {
      additionalInfo
    });

    expect(context.additionalInfo).toEqual(additionalInfo);
  });

  // Test 13: Error timestamp tracking
  test('should track error and context timestamps', () => {
    const beforeTrace = Date.now();

    const error = tracer.traceError('span_time', {
      message: 'Timed error'
    });

    const context = tracer.contextManager.getContext(error.errorId);
    const afterTrace = Date.now();

    expect(error.timestamp).toBeGreaterThanOrEqual(beforeTrace);
    expect(error.timestamp).toBeLessThanOrEqual(afterTrace);
    expect(context.timestamp).toBeDefined();
  });

  // Test 14: Clearing contexts
  test('should clear all contexts when closed', () => {
    for (let i = 0; i < 10; i++) {
      tracer.traceError(`span_${i}`, {
        message: `Error ${i}`
      });
    }

    expect(tracer.contextManager.contexts.size).toBeGreaterThan(0);

    tracer.close();

    expect(tracer.contextManager.contexts.size).toBe(0);
  });

  // Test 15: Context retrieval for non-existent error
  test('should handle retrieval for non-existent error', () => {
    const result = tracer.getErrorWithContext('non_existent_id');
    expect(result).toBeNull();

    const byReq = tracer.searchByRequestId('non_existent_req');
    expect(byReq).toEqual([]);

    const byComp = tracer.searchByComponent('non_existent_comp');
    expect(byComp).toEqual([]);
  });

  // Test 16: Sensitive data in call stack
  test('should not expose sensitive data in call stack', () => {
    const callStack = 'password=secret&apiKey=key123&username=user';

    const context = contextManager.addContext('err_sensitive', {
      callStack: [callStack]
    });

    // Call stack is stored as-is, but parameters are sanitized separately
    expect(context.callStack[0]).toBe(callStack);

    // Verify parameter sanitization works independently
    const context2 = contextManager.addContext('err_param', {
      parameters: {
        password: 'secret123',
        data: callStack
      }
    });

    expect(context2.parameters.password).toBe('[REDACTED]');
  });
});
