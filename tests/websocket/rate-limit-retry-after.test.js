/**
 * Test Suite: HTTP Retry-After Header Implementation
 *
 * Tests for the Retry-After header functionality:
 * - Rate limiter includes retryAfter in response
 * - ErrorFormatter includes Retry-After in response details
 * - HttpResponseDecorator properly applies headers
 * - HTTP clients can read and implement backoff
 *
 * Created: June 21, 2026
 */

const { WebSocketRateLimiter } = require('../../websocket/rate-limiter');
const { ErrorFormatter } = require('../../websocket/error-formatter');
const { HttpResponseDecorator } = require('../../websocket/http-response-decorator');

describe('HTTP Retry-After Header Implementation', () => {
  let rateLimiter;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    rateLimiter = new WebSocketRateLimiter({
      enabled: true,
      unauthenticatedLimit: 10,
      authenticatedLimit: 100,
      windowMs: 60000,
      burstAllowance: 2,
      logger: mockLogger
    });
  });

  describe('WebSocketRateLimiter - retryAfter field', () => {
    test('should include retryAfter in seconds when rate limit is exceeded', () => {
      const clientId = 'test-client-1';
      const command = 'navigate';

      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        const result = rateLimiter.check(clientId, command);
        expect(result.allowed).toBe(true);
      }

      // Next request should be rate limited
      const limitedResult = rateLimiter.check(clientId, command);
      expect(limitedResult.allowed).toBe(false);
      expect(limitedResult.retryAfter).toBeDefined();
      expect(typeof limitedResult.retryAfter).toBe('number');
      expect(limitedResult.retryAfter).toBeGreaterThan(0);
      expect(limitedResult.retryAfter).toBeLessThanOrEqual(60);
    });

    test('retryAfter should be calculated as Math.ceil(resetIn / 1000)', () => {
      const clientId = 'test-client-2';
      const command = 'screenshot';

      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.check(clientId, command);
      }

      const limitedResult = rateLimiter.check(clientId, command);
      const expectedRetryAfter = Math.ceil(limitedResult.resetIn / 1000);

      expect(limitedResult.retryAfter).toBe(expectedRetryAfter);
    });

    test('should include statusCode 429 for rate limit errors', () => {
      const clientId = 'test-client-3';
      const command = 'click';

      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.check(clientId, command);
      }

      const limitedResult = rateLimiter.check(clientId, command);
      expect(limitedResult.statusCode).toBe(429);
    });

    test('should include errorCode in rate limit response', () => {
      const clientId = 'test-client-4';
      const command = 'scroll';

      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.check(clientId, command);
      }

      const limitedResult = rateLimiter.check(clientId, command);
      expect(limitedResult.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    });

    test('should include both retryAfterMs and retryAfter', () => {
      const clientId = 'test-client-5';
      const command = 'fill';

      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.check(clientId, command);
      }

      const limitedResult = rateLimiter.check(clientId, command);
      expect(limitedResult.retryAfterMs).toBeDefined();
      expect(limitedResult.retryAfter).toBeDefined();
      expect(limitedResult.retryAfterMs).toBe(limitedResult.resetIn);
      expect(Math.ceil(limitedResult.retryAfterMs / 1000)).toBe(limitedResult.retryAfter);
    });
  });

  describe('ErrorFormatter - rate limit error response', () => {
    test('should format rate limit error with retryAfter in seconds', () => {
      const rateLimitInfo = {
        allowed: false,
        limit: 10,
        current: 10,
        remaining: 0,
        resetIn: 45000, // 45 seconds
        authenticated: false
      };

      const errorResponse = ErrorFormatter.rateLimitError(rateLimitInfo, 'navigate', 'test-id');

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      expect(errorResponse.details.retryAfter).toBe(45);
      expect(errorResponse.details.resetIn).toBe(45000);
    });

    test('should include Retry-After in httpHeaders with proper format', () => {
      const rateLimitInfo = {
        allowed: false,
        limit: 10,
        current: 10,
        remaining: 0,
        resetIn: 30000,
        authenticated: false
      };

      const errorResponse = ErrorFormatter.rateLimitError(rateLimitInfo, 'click', 'id-1');

      expect(errorResponse.details.httpHeaders).toBeDefined();
      expect(errorResponse.details.httpHeaders['Retry-After']).toBe('30');
    });

    test('should include statusCode 429 in details', () => {
      const rateLimitInfo = {
        allowed: false,
        limit: 10,
        current: 10,
        remaining: 0,
        resetIn: 30000,
        authenticated: false
      };

      const errorResponse = ErrorFormatter.rateLimitError(rateLimitInfo, 'screenshot', 'id-2');

      expect(errorResponse.details.statusCode).toBe(429);
    });

    test('should include all rate limit details for client reference', () => {
      const rateLimitInfo = {
        allowed: false,
        limit: 100,
        current: 105,
        remaining: 0,
        resetIn: 25000,
        authenticated: true
      };

      const errorResponse = ErrorFormatter.rateLimitError(rateLimitInfo, 'execute_script', 'id-3');

      expect(errorResponse.details.limit).toBe(100);
      expect(errorResponse.details.current).toBe(105);
      expect(errorResponse.details.remaining).toBe(0);
      expect(errorResponse.details.resetIn).toBe(25000);
      expect(errorResponse.details.authenticated).toBe(true);
    });
  });

  describe('HttpResponseDecorator - header application', () => {
    test('should apply Retry-After header to response object', () => {
      // Mock response object
      const mockRes = {
        setHeader: jest.fn(),
        statusCode: null
      };

      const errorResponse = {
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        details: {
          statusCode: 429,
          retryAfter: 30,
          resetIn: 30000,
          limit: 10,
          remaining: 0,
          httpHeaders: {
            'Retry-After': '30'
          }
        }
      };

      const statusCode = HttpResponseDecorator.applyHeaders(mockRes, errorResponse);

      expect(statusCode).toBe(429);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', '30');
    });

    test('should apply X-RateLimit headers for rate limit errors', () => {
      const mockRes = {
        setHeader: jest.fn()
      };

      const errorResponse = {
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        details: {
          statusCode: 429,
          retryAfter: 60,
          resetIn: 60000,
          limit: 100,
          remaining: 5,
          httpHeaders: {
            'Retry-After': '60'
          }
        }
      };

      HttpResponseDecorator.applyHeaders(mockRes, errorResponse);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '5');
    });

    test('should calculate X-RateLimit-Reset timestamp correctly', () => {
      const mockRes = {
        setHeader: jest.fn()
      };

      const now = Math.floor(Date.now() / 1000);
      const resetInMs = 30000; // 30 seconds

      const errorResponse = {
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        details: {
          statusCode: 429,
          retryAfter: 30,
          resetIn: resetInMs,
          limit: 10,
          remaining: 0,
          httpHeaders: {}
        }
      };

      HttpResponseDecorator.applyHeaders(mockRes, errorResponse);

      // Check that X-RateLimit-Reset was set
      const calls = mockRes.setHeader.mock.calls;
      const resetCall = calls.find(call => call[0] === 'X-RateLimit-Reset');

      expect(resetCall).toBeDefined();
      const resetTimestamp = parseInt(resetCall[1]);
      const expectedTimestamp = now + 30;

      // Allow 1 second margin for test execution time
      expect(Math.abs(resetTimestamp - expectedTimestamp)).toBeLessThanOrEqual(1);
    });

    test('should set Content-Type header for JSON responses', () => {
      const mockRes = {
        setHeader: jest.fn()
      };

      const errorResponse = {
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        details: {
          statusCode: 429,
          retryAfter: 30,
          httpHeaders: {}
        }
      };

      HttpResponseDecorator.applyHeaders(mockRes, errorResponse);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8'
      );
    });

    test('should set Cache-Control header to prevent caching', () => {
      const mockRes = {
        setHeader: jest.fn()
      };

      const errorResponse = {
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        details: {
          statusCode: 429,
          httpHeaders: {}
        }
      };

      HttpResponseDecorator.applyHeaders(mockRes, errorResponse);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache, no-store, must-revalidate'
      );
    });

    test('should set X-Error-Code header for debugging', () => {
      const mockRes = {
        setHeader: jest.fn()
      };

      const errorResponse = {
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        details: {
          statusCode: 429,
          httpHeaders: {}
        }
      };

      HttpResponseDecorator.applyHeaders(mockRes, errorResponse);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Error-Code', 'RATE_LIMIT_EXCEEDED');
    });
  });

  describe('HttpResponseDecorator - utility methods', () => {
    test('getRetryAfterHeader should return seconds as string', () => {
      const errorResponse = {
        errorCode: 'RATE_LIMIT_EXCEEDED',
        details: {
          retryAfter: 45.5 // Should be ceiled
        }
      };

      const header = HttpResponseDecorator.getRetryAfterHeader(errorResponse);
      expect(header).toBe('46');
    });

    test('getRetryAfterHeader should return null for non-rate-limit errors', () => {
      const errorResponse = {
        errorCode: 'COMMAND_NOT_FOUND',
        details: {}
      };

      const header = HttpResponseDecorator.getRetryAfterHeader(errorResponse);
      expect(header).toBeNull();
    });

    test('getAllHeaders should return all applicable headers', () => {
      const errorResponse = {
        errorCode: 'RATE_LIMIT_EXCEEDED',
        details: {
          statusCode: 429,
          retryAfter: 30,
          resetIn: 30000,
          limit: 10,
          remaining: 5,
          httpHeaders: {}
        }
      };

      const headers = HttpResponseDecorator.getAllHeaders(errorResponse);

      expect(headers['Content-Type']).toBe('application/json; charset=utf-8');
      expect(headers['Retry-After']).toBe('30');
      expect(headers['X-RateLimit-Limit']).toBe('10');
      expect(headers['X-RateLimit-Remaining']).toBe('5');
      expect(headers['X-Error-Code']).toBe('RATE_LIMIT_EXCEEDED');
      expect(headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });
  });

  describe('End-to-End Rate Limit Response', () => {
    test('full flow: rate limiter -> error formatter -> http decorator', () => {
      const clientId = 'test-client-e2e';
      const command = 'navigate';

      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.check(clientId, command);
      }

      // Get rate limit response
      const rateLimitResult = rateLimiter.check(clientId, command);
      expect(rateLimitResult.allowed).toBe(false);

      // Format as error response
      const errorResponse = ErrorFormatter.rateLimitError(rateLimitResult, command, 'req-1');
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.errorCode).toBe('RATE_LIMIT_EXCEEDED');

      // Apply HTTP headers
      const mockRes = {
        setHeader: jest.fn()
      };

      const statusCode = HttpResponseDecorator.applyHeaders(mockRes, errorResponse);

      // Verify complete chain
      expect(statusCode).toBe(429);
      expect(errorResponse.details.retryAfter).toBeGreaterThan(0);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Retry-After',
        errorResponse.details.retryAfter.toString()
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle very small resetIn values (< 1000ms)', () => {
      const rateLimitInfo = {
        allowed: false,
        limit: 10,
        current: 10,
        remaining: 0,
        resetIn: 500, // 0.5 seconds
        authenticated: false
      };

      const errorResponse = ErrorFormatter.rateLimitError(rateLimitInfo, 'click', 'id-small');

      // Should round up to at least 1 second
      expect(errorResponse.details.retryAfter).toBe(1);
    });

    test('should handle large resetIn values correctly', () => {
      const rateLimitInfo = {
        allowed: false,
        limit: 10,
        current: 10,
        remaining: 0,
        resetIn: 3600000, // 1 hour
        authenticated: false
      };

      const errorResponse = ErrorFormatter.rateLimitError(rateLimitInfo, 'screenshot', 'id-large');

      expect(errorResponse.details.retryAfter).toBe(3600);
    });

    test('should handle multiple rate limit errors in sequence', () => {
      const clientId = 'test-client-seq';
      const command = 'execute_script';

      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.check(clientId, command);
      }

      // Get first rate limit response
      const firstResponse = rateLimiter.check(clientId, command);
      const firstRetryAfter = firstResponse.retryAfter;

      // Get second rate limit response immediately
      const secondResponse = rateLimiter.check(clientId, command);
      const secondRetryAfter = secondResponse.retryAfter;

      // Both should be similar (within 1 second)
      expect(Math.abs(firstRetryAfter - secondRetryAfter)).toBeLessThanOrEqual(1);
    });
  });
});
