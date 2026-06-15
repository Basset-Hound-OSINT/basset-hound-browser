/**
 * Tests for Error Context module
 */

const assert = require('assert');
const {
  ErrorContext,
  AppError,
  ValidationError,
  TimeoutError,
  RateLimitError,
  CircuitBreakerError,
  NotFoundError,
  ERROR_TYPES,
  generateOperationId,
  classifyError,
  isTransientError
} = require('../../src/stability/error-context');

describe('Error Context Utilities', () => {
  describe('generateOperationId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateOperationId();
      const id2 = generateOperationId();

      assert.notStrictEqual(id1, id2);
    });

    it('should generate UUID-like format', () => {
      const id = generateOperationId();
      assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    });
  });

  describe('classifyError', () => {
    it('should classify timeout errors', () => {
      const error = new Error('operation timeout');
      assert.strictEqual(classifyError(error), ERROR_TYPES.TIMEOUT_ERROR);
    });

    it('should classify validation errors', () => {
      const error = new Error('Invalid parameter');
      assert.strictEqual(classifyError(error), ERROR_TYPES.VALIDATION_ERROR);
    });

    it('should classify network errors', () => {
      const error = new Error('ECONNREFUSED');
      assert.strictEqual(classifyError(error), ERROR_TYPES.NETWORK_ERROR);
    });

    it('should classify rate limit errors', () => {
      const error = new Error('Too many requests');
      assert.strictEqual(classifyError(error), ERROR_TYPES.RATE_LIMITED_ERROR);
    });

    it('should classify circuit breaker errors', () => {
      const error = new Error('Circuit breaker is OPEN');
      assert.strictEqual(classifyError(error), ERROR_TYPES.CIRCUIT_OPEN_ERROR);
    });

    it('should classify not found errors', () => {
      const error = new Error('Resource not found (404)');
      assert.strictEqual(classifyError(error), ERROR_TYPES.NOT_FOUND_ERROR);
    });

    it('should classify permission errors', () => {
      const error = new Error('Access denied permission');
      assert.strictEqual(classifyError(error), ERROR_TYPES.PERMISSION_ERROR);
    });

    it('should default to internal error', () => {
      const error = new Error('Something went wrong');
      assert.strictEqual(classifyError(error), ERROR_TYPES.INTERNAL_ERROR);
    });

    it('should use error code for classification', () => {
      const error = new Error('Connection failed');
      error.code = 'ETIMEDOUT';
      assert.strictEqual(classifyError(error), ERROR_TYPES.TIMEOUT_ERROR);
    });
  });

  describe('isTransientError', () => {
    it('should identify transient errors', () => {
      const transient = [
        new Error('Timeout'),
        new Error('ECONNREFUSED'),
        new Error('Too many requests'),
        new Error('Circuit breaker OPEN')
      ];

      for (const error of transient) {
        assert.strictEqual(isTransientError(error), true, error.message);
      }
    });

    it('should identify permanent errors', () => {
      const permanent = [
        new Error('Invalid parameter'),
        new Error('Resource not found'),
        new Error('Permission denied')
      ];

      for (const error of permanent) {
        assert.strictEqual(isTransientError(error), false, error.message);
      }
    });
  });
});

describe('ErrorContext Class', () => {
  describe('buildErrorResponse', () => {
    it('should build basic error response', () => {
      const error = new Error('Test error');
      const response = ErrorContext.buildErrorResponse('test_command', {
        error
      });

      assert.strictEqual(response.success, false);
      assert.strictEqual(response.command, 'test_command');
      assert.strictEqual(response.error, 'Test error');
      assert.strictEqual(response.errorType, ERROR_TYPES.INTERNAL_ERROR);
      assert.ok(response.operationId);
      assert.ok(response.timestamp);
    });

    it('should include duration', () => {
      const error = new Error('Test error');
      const response = ErrorContext.buildErrorResponse('command', {
        error,
        durationMs: 1234
      });

      assert.strictEqual(response.durationMs, 1234);
    });

    it('should use provided operation ID', () => {
      const error = new Error('Test error');
      const opId = 'custom-op-id';
      const response = ErrorContext.buildErrorResponse('command', {
        error,
        operationId: opId
      });

      assert.strictEqual(response.operationId, opId);
    });

    it('should include debug info when debug mode enabled', () => {
      const error = new Error('Test error');
      const response = ErrorContext.buildErrorResponse('command', {
        error,
        debug: true
      });

      assert.ok(response.debugInfo);
      assert.ok(response.debugInfo.stack);
    });

    it('should not include debug info by default', () => {
      const error = new Error('Test error');
      const response = ErrorContext.buildErrorResponse('command', {
        error,
        debug: false
      });

      assert.ok(!response.debugInfo);
    });

    it('should classify error type', () => {
      const errors = [
        { error: new Error('Timeout'), expectedType: ERROR_TYPES.TIMEOUT_ERROR },
        { error: new Error('Invalid param'), expectedType: ERROR_TYPES.VALIDATION_ERROR },
        { error: new Error('ECONNREFUSED'), expectedType: ERROR_TYPES.NETWORK_ERROR }
      ];

      for (const { error, expectedType } of errors) {
        const response = ErrorContext.buildErrorResponse('cmd', { error });
        assert.strictEqual(response.errorType, expectedType);
      }
    });

    it('should mark transient errors', () => {
      const transientError = new Error('Timeout');
      const response = ErrorContext.buildErrorResponse('cmd', { error: transientError });

      assert.strictEqual(response.isTransient, true);
    });
  });

  describe('buildSuccessResponse', () => {
    it('should build success response', () => {
      const response = ErrorContext.buildSuccessResponse('test_command', {
        result: { data: 'test' }
      });

      assert.strictEqual(response.success, true);
      assert.strictEqual(response.command, 'test_command');
      assert.deepStrictEqual(response.result, { data: 'test' });
      assert.ok(response.operationId);
    });

    it('should include duration', () => {
      const response = ErrorContext.buildSuccessResponse('cmd', {
        durationMs: 5000
      });

      assert.strictEqual(response.durationMs, 5000);
    });
  });

  describe('executeWithContext', () => {
    it('should wrap successful execution', async () => {
      const result = await ErrorContext.executeWithContext('test_cmd', async () => {
        return { data: 'test' };
      });

      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.result, { data: 'test' });
      assert.ok(result.durationMs >= 0);
    });

    it('should wrap failed execution', async () => {
      const result = await ErrorContext.executeWithContext('test_cmd', async () => {
        throw new Error('Command failed');
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Command failed');
      assert.ok(result.operationId);
    });

    it('should measure execution time', async () => {
      const result = await ErrorContext.executeWithContext('test_cmd', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'done';
      });

      assert.ok(result.durationMs >= 40); // Allow some timing variance
    });

    it('should include params in error debug info', async () => {
      const result = await ErrorContext.executeWithContext(
        'test_cmd',
        async () => {
          throw new Error('Failed');
        },
        {
          params: { user: 'alice', password: 'secret' },
          debug: true
        }
      );

      assert.ok(result.debugInfo);
      assert.strictEqual(result.debugInfo.sanitizedParams.password, '[REDACTED]');
    });
  });

  describe('validateParam', () => {
    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => {
        ErrorContext.validateParam('email', 'user@example.com');
      });
    });

    it('should reject undefined', () => {
      assert.throws(
        () => ErrorContext.validateParam('email', undefined),
        /Missing required parameter/
      );
    });

    it('should reject null', () => {
      assert.throws(
        () => ErrorContext.validateParam('email', null),
        /Missing required parameter/
      );
    });

    it('should validate type', () => {
      assert.throws(
        () => ErrorContext.validateParam('count', 'abc', 'number'),
        /Invalid parameter.*expected number/
      );
    });

    it('should accept correct type', () => {
      assert.doesNotThrow(() => {
        ErrorContext.validateParam('count', 42, 'number');
      });
    });
  });

  describe('validateIntRange', () => {
    it('should accept valid integers', () => {
      assert.strictEqual(ErrorContext.validateIntRange('port', '8080', 1, 65535), 8080);
    });

    it('should reject non-integer strings', () => {
      assert.throws(
        () => ErrorContext.validateIntRange('port', 'abc'),
        /must be a number/
      );
    });

    it('should reject out-of-range values', () => {
      assert.throws(
        () => ErrorContext.validateIntRange('port', '99999', 1, 65535),
        /must be between 1-65535/
      );
    });

    it('should accept string integers', () => {
      assert.strictEqual(ErrorContext.validateIntRange('port', '3000', 1, 65535), 3000);
    });

    it('should use default range', () => {
      assert.strictEqual(ErrorContext.validateIntRange('port', '8080'), 8080);
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      const url = ErrorContext.validateUrl('endpoint', 'https://example.com/api');
      assert.ok(url.includes('https://example.com'));
    });

    it('should reject invalid URLs', () => {
      assert.throws(
        () => ErrorContext.validateUrl('endpoint', 'not a url'),
        /must be a valid URL/
      );
    });

    it('should normalize URLs', () => {
      const url = ErrorContext.validateUrl('endpoint', 'http://example.com');
      assert.ok(url.includes('http://'));
    });
  });

  describe('sanitizeParams', () => {
    it('should preserve normal params', () => {
      const params = { name: 'alice', age: 30 };
      const sanitized = ErrorContext.sanitizeParams(params);

      assert.strictEqual(sanitized.name, 'alice');
      assert.strictEqual(sanitized.age, 30);
    });

    it('should redact passwords', () => {
      const params = { username: 'alice', password: 'secret123' };
      const sanitized = ErrorContext.sanitizeParams(params);

      assert.strictEqual(sanitized.username, 'alice');
      assert.strictEqual(sanitized.password, '[REDACTED]');
    });

    it('should redact tokens', () => {
      const params = { apiToken: 'abc123', apiKey: 'xyz789' };
      const sanitized = ErrorContext.sanitizeParams(params);

      assert.strictEqual(sanitized.apiToken, '[REDACTED]');
      assert.strictEqual(sanitized.apiKey, '[REDACTED]');
    });

    it('should redact auth headers', () => {
      const params = { authorization: 'Bearer token123', secret: 'value' };
      const sanitized = ErrorContext.sanitizeParams(params);

      assert.strictEqual(sanitized.authorization, '[REDACTED]');
      assert.strictEqual(sanitized.secret, '[REDACTED]');
    });

    it('should handle case-insensitive matching', () => {
      const params = { PASSWORD: 'secret', Token: 'xyz' };
      const sanitized = ErrorContext.sanitizeParams(params);

      assert.strictEqual(sanitized.PASSWORD, '[REDACTED]');
      assert.strictEqual(sanitized.Token, '[REDACTED]');
    });
  });

  describe('getFullErrorMessage', () => {
    it('should return single error message', () => {
      const error = new Error('Something failed');
      const message = ErrorContext.getFullErrorMessage(error);

      assert.strictEqual(message, 'Something failed');
    });

    it('should chain nested error messages', () => {
      const inner = new Error('Inner error');
      const outer = new Error('Outer error');
      outer.cause = inner;

      const message = ErrorContext.getFullErrorMessage(outer);
      assert.strictEqual(message, 'Outer error → Inner error');
    });
  });
});

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('should create app error with code', () => {
      const error = new AppError('Test error', 'CUSTOM_CODE');

      assert.strictEqual(error.message, 'Test error');
      assert.strictEqual(error.code, 'CUSTOM_CODE');
      assert.strictEqual(error.statusCode, 500);
    });

    it('should include context', () => {
      const error = new AppError('Error', 'CODE', {
        context: { userId: '123' }
      });

      assert.deepStrictEqual(error.context, { userId: '123' });
    });
  });

  describe('ValidationError', () => {
    it('should be a ValidationError', () => {
      const error = new ValidationError('Invalid input');

      assert.ok(error instanceof ValidationError);
      assert.ok(error instanceof AppError);
      assert.strictEqual(error.code, 'VALIDATION_ERROR');
      assert.strictEqual(error.statusCode, 400);
    });
  });

  describe('TimeoutError', () => {
    it('should be a TimeoutError', () => {
      const error = new TimeoutError('Request timed out');

      assert.ok(error instanceof TimeoutError);
      assert.strictEqual(error.code, 'TIMEOUT_ERROR');
      assert.strictEqual(error.statusCode, 408);
    });
  });

  describe('RateLimitError', () => {
    it('should be a RateLimitError', () => {
      const error = new RateLimitError('Too many requests');

      assert.ok(error instanceof RateLimitError);
      assert.strictEqual(error.code, 'RATE_LIMITED_ERROR');
      assert.strictEqual(error.statusCode, 429);
    });
  });

  describe('CircuitBreakerError', () => {
    it('should be a CircuitBreakerError', () => {
      const error = new CircuitBreakerError('Service unavailable');

      assert.ok(error instanceof CircuitBreakerError);
      assert.strictEqual(error.code, 'CIRCUIT_OPEN_ERROR');
      assert.strictEqual(error.statusCode, 503);
    });
  });

  describe('NotFoundError', () => {
    it('should be a NotFoundError', () => {
      const error = new NotFoundError('Resource not found');

      assert.ok(error instanceof NotFoundError);
      assert.strictEqual(error.code, 'NOT_FOUND_ERROR');
      assert.strictEqual(error.statusCode, 404);
    });
  });
});
