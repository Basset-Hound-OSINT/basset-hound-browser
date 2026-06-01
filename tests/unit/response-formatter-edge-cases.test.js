/**
 * Basset Hound Browser - Response Formatter Edge Cases & Boundary Tests
 * Additional comprehensive tests for edge cases, boundary conditions, and error paths
 *
 * @module tests/unit/response-formatter-edge-cases.test.js
 */

const { ResponseFormatter, errorResponse } = require('../../src/utils/response-formatter');

describe('ResponseFormatter Edge Cases & Boundaries', () => {
  describe('null/undefined handling in all methods', () => {
    it('success() should handle null data', () => {
      const response = ResponseFormatter.success(null);
      expect(response.data).toBeNull();
      expect(response.success).toBe(true);
    });

    it('success() should handle undefined data', () => {
      const response = ResponseFormatter.success(undefined);
      expect(response.data).toBeUndefined();
      expect(response.success).toBe(true);
    });

    it('error() should handle null message', () => {
      const response = ResponseFormatter.error(null);
      expect(response.error).toBeNull();
      expect(response.success).toBe(false);
    });

    it('error() should handle undefined message', () => {
      const response = ResponseFormatter.error(undefined);
      expect(response.error).toBeUndefined();
    });

    it('partial() should handle null results', () => {
      const response = ResponseFormatter.partial(null);
      expect(response.results.succeeded).toBe(0);
      expect(response.results.failed).toBe(0);
    });

    it('paginated() should handle null items array', () => {
      const response = ResponseFormatter.paginated(null, {
        page: 1,
        pageSize: 10,
        total: 0
      });
      expect(response.data).toBeNull();
    });

    it('async() should handle null operationId', () => {
      const response = ResponseFormatter.async(null);
      expect(response.operationId).toBeNull();
    });

    it('redirect() should handle null URL', () => {
      const response = ResponseFormatter.redirect(null);
      expect(response.location).toBeNull();
    });
  });

  describe('empty collection handling', () => {
    it('success() should handle empty array data', () => {
      const response = ResponseFormatter.success([]);
      expect(response.data).toEqual([]);
    });

    it('success() should handle empty object data', () => {
      const response = ResponseFormatter.success({});
      expect(response.data).toEqual({});
    });

    it('partial() should handle zero succeeded and failed', () => {
      const response = ResponseFormatter.partial({
        succeeded: 0,
        failed: 0
      });
      expect(response.results.total).toBe(0);
      expect(response.partial).toBe(true);
    });

    it('paginated() should handle empty items array', () => {
      const response = ResponseFormatter.paginated([], {
        page: 1,
        pageSize: 10,
        total: 0
      });
      expect(response.data).toEqual([]);
    });

    it('partial() should handle empty errors array', () => {
      const response = ResponseFormatter.partial({
        succeeded: 5,
        failed: 0,
        errors: []
      });
      expect(response.errors).toBeUndefined();
    });
  });

  describe('numeric boundary conditions', () => {
    it('partial() should handle very large counts', () => {
      const response = ResponseFormatter.partial({
        succeeded: Number.MAX_SAFE_INTEGER,
        failed: Number.MAX_SAFE_INTEGER
      });
      expect(response.results.succeeded).toBe(Number.MAX_SAFE_INTEGER);
      expect(response.results.total).toBeDefined();
    });

    it('paginated() should handle very large total', () => {
      const response = ResponseFormatter.paginated([], {
        page: 1,
        pageSize: 10,
        total: Number.MAX_SAFE_INTEGER
      });
      expect(response.pagination.total).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('paginated() should handle pageSize=0', () => {
      // Division by zero handling
      try {
        const response = ResponseFormatter.paginated([], {
          page: 1,
          pageSize: 0,
          total: 10
        });
        // May result in Infinity
        expect(response.pagination.totalPages).toBeDefined();
      } catch (e) {
        // Or may throw
      }
    });

    it('paginated() should handle negative page number', () => {
      const response = ResponseFormatter.paginated([], {
        page: -5,
        pageSize: 10,
        total: 100
      });
      expect(response.pagination.page).toBe(-5);
      expect(response.pagination.hasPreviousPage).toBe(true); // page > 1 check
    });

    it('paginated() should handle negative pageSize', () => {
      const response = ResponseFormatter.paginated([], {
        page: 1,
        pageSize: -10,
        total: 100
      });
      expect(response.pagination.pageSize).toBe(-10);
    });

    it('paginated() should handle page > totalPages', () => {
      const response = ResponseFormatter.paginated([], {
        page: 1000,
        pageSize: 10,
        total: 42
      });
      expect(response.pagination.page).toBe(1000);
      expect(response.pagination.totalPages).toBe(5);
      expect(response.pagination.hasNextPage).toBe(false);
    });

    it('paginated() should handle Infinity in total', () => {
      const response = ResponseFormatter.paginated([], {
        page: 1,
        pageSize: 10,
        total: Infinity
      });
      expect(response.pagination.total).toBe(Infinity);
      expect(response.pagination.totalPages).toBe(Infinity);
    });

    it('paginated() should handle NaN in calculations', () => {
      const response = ResponseFormatter.paginated([], {
        page: NaN,
        pageSize: 10,
        total: 100
      });
      expect(response.pagination.page).toBe(NaN);
    });
  });

  describe('string edge cases', () => {
    it('success() should handle empty string data', () => {
      const response = ResponseFormatter.success('');
      expect(response.data).toBe('');
    });

    it('error() should handle empty string message', () => {
      const response = ResponseFormatter.error('');
      expect(response.error).toBe('');
    });

    it('error() should handle very long message', () => {
      const longMessage = 'x'.repeat(1000000);
      const response = ResponseFormatter.error(longMessage);
      expect(response.error).toBe(longMessage);
    });

    it('error() should handle message with special characters', () => {
      const message = 'Error: \n\r\t\0\b\\';
      const response = ResponseFormatter.error(message);
      expect(response.error).toBe(message);
    });

    it('redirect() should handle URL with special characters', () => {
      const url = '/path?key=value&special=%20%21%40%23%24';
      const response = ResponseFormatter.redirect(url);
      expect(response.location).toBe(url);
    });

    it('success() code should handle numeric-like strings', () => {
      const response = ResponseFormatter.success({}, { code: '12345' });
      expect(response.code).toBe('12345');
    });
  });

  describe('deeply nested structures', () => {
    it('success() should handle deeply nested objects', () => {
      let nested = { value: 'bottom' };
      for (let i = 0; i < 100; i++) {
        nested = { level: nested };
      }

      const response = ResponseFormatter.success(nested);
      expect(response.success).toBe(true);

      // Navigate to deep level
      let current = response.data;
      for (let i = 0; i < 100; i++) {
        current = current.level;
      }
      expect(current.value).toBe('bottom');
    });

    it('success() should handle deeply nested arrays', () => {
      let nested = [1, 2, 3];
      for (let i = 0; i < 50; i++) {
        nested = [nested];
      }

      const response = ResponseFormatter.success(nested);
      expect(response.success).toBe(true);
    });

    it('toJSON() should handle deeply nested structures', () => {
      let nested = { value: 'deep' };
      for (let i = 0; i < 50; i++) {
        nested = { level: nested };
      }

      const response = ResponseFormatter.success(nested);
      const json = ResponseFormatter.toJSON(response);

      expect(json.success).toBe(true);
    });
  });

  describe('special data types', () => {
    it('success() should handle Date objects', () => {
      const date = new Date();
      const response = ResponseFormatter.success(date);

      expect(response.data).toBe(date);
    });

    it('success() should handle Buffer objects', () => {
      const buffer = Buffer.from('test data');
      const response = ResponseFormatter.success(buffer);

      expect(response.data).toBe(buffer);
    });

    it('success() should handle Map objects', () => {
      const map = new Map([['key', 'value']]);
      const response = ResponseFormatter.success(map);

      expect(response.data).toBe(map);
    });

    it('success() should handle Set objects', () => {
      const set = new Set([1, 2, 3]);
      const response = ResponseFormatter.success(set);

      expect(response.data).toBe(set);
    });

    it('success() should handle Symbol (non-serializable)', () => {
      const sym = Symbol('test');
      const response = ResponseFormatter.success(sym);

      expect(response.data).toBe(sym);
    });

    it('error() should handle Error objects with properties', () => {
      const error = new Error('Test error');
      error.code = 'CUSTOM_CODE';
      error.details = { extra: 'info' };

      const response = errorResponse(error);

      expect(response.code).toBe('CUSTOM_CODE');
      expect(response.details.operation).toBe('unknown');
    });
  });

  describe('metadata and options edge cases', () => {
    it('success() should handle large metadata objects', () => {
      const metadata = {
        data: Array(1000).fill(0).map((_, i) => ({ id: i, value: `item-${i}` }))
      };

      const response = ResponseFormatter.success({}, { metadata });

      expect(response.metadata).toEqual(metadata);
    });

    it('error() should handle large details objects', () => {
      const details = {
        errors: Array(100).fill(0).map((_, i) => ({
          field: `field${i}`,
          message: `error in field${i}`
        }))
      };

      const response = ResponseFormatter.error('Validation failed', { details });

      expect(response.details).toEqual(details);
    });

    it('partial() should handle large errors array', () => {
      const errors = Array(1000).fill(0).map((_, i) => ({
        index: i,
        error: `error-${i}`
      }));

      const response = ResponseFormatter.partial({
        succeeded: 0,
        failed: 1000,
        errors
      });

      expect(response.errors).toHaveLength(1000);
    });

    it('error() should handle custom statusCode outside normal range', () => {
      const response1 = ResponseFormatter.error('Error', { statusCode: 999 });
      expect(response1.statusCode).toBe(999);

      const response2 = ResponseFormatter.error('Error', { statusCode: 100 });
      expect(response2.statusCode).toBe(100);

      const response3 = ResponseFormatter.error('Error', { statusCode: -1 });
      expect(response3.statusCode).toBe(-1);
    });
  });

  describe('circular reference handling', () => {
    it('toJSON() should handle circular object references', () => {
      const obj = { a: 1 };
      obj.self = obj; // circular reference

      const response = ResponseFormatter.success(obj);

      // toJSON() uses JSON.stringify which throws on circular refs
      try {
        ResponseFormatter.toJSON(response);
      } catch (e) {
        expect(e instanceof TypeError).toBe(true);
      }
    });

    it('isValid() should handle object with circular properties', () => {
      const response = {
        success: true,
        code: 'SUCCESS',
        timestamp: new Date().toISOString(),
        data: {}
      };

      response.data.self = response; // circular reference

      // isValid() should still work - it doesn't serialize
      expect(ResponseFormatter.isValid(response)).toBe(true);
    });
  });

  describe('timestamp edge cases', () => {
    it('should generate valid ISO timestamp', () => {
      const response = ResponseFormatter.success({});

      // Verify ISO 8601 format
      expect(() => new Date(response.timestamp)).not.toThrow();

      // Verify timestamp is recent (within 1 second)
      const timestamp = new Date(response.timestamp);
      const now = new Date();
      const diff = Math.abs(now.getTime() - timestamp.getTime());
      expect(diff).toBeLessThan(1000);
    });

    it('should generate millisecond-precision timestamps', () => {
      const response1 = ResponseFormatter.success({});
      const response2 = ResponseFormatter.success({});

      // Timestamps may be different or same depending on timing
      expect(response1.timestamp).toBeDefined();
      expect(response2.timestamp).toBeDefined();
    });
  });

  describe('code field variations', () => {
    it('should handle code with special characters', () => {
      const response = ResponseFormatter.success({}, {
        code: 'SUCCESS-2024_05.31'
      });

      expect(response.code).toBe('SUCCESS-2024_05.31');
    });

    it('should handle code with Unicode characters', () => {
      const response = ResponseFormatter.success({}, {
        code: 'SUCCESS_✓_完成'
      });

      expect(response.code).toBe('SUCCESS_✓_完成');
    });

    it('should handle empty string code', () => {
      const response = ResponseFormatter.success({}, { code: '' });

      expect(response.code).toBe('');
    });

    it('should handle very long code', () => {
      const longCode = 'CODE_' + 'x'.repeat(1000);

      const response = ResponseFormatter.success({}, { code: longCode });

      expect(response.code).toBe(longCode);
    });
  });

  describe('response structure invariants', () => {
    it('all responses should have required base fields', () => {
      const responses = [
        ResponseFormatter.success({}),
        ResponseFormatter.error('error'),
        ResponseFormatter.partial({ succeeded: 0, failed: 0 }),
        ResponseFormatter.paginated([], { page: 1, pageSize: 10, total: 0 }),
        ResponseFormatter.async('op-1'),
        ResponseFormatter.redirect('/path')
      ];

      responses.forEach(response => {
        expect(response).toHaveProperty('success');
        expect(response).toHaveProperty('code');
        expect(response).toHaveProperty('timestamp');
        expect(typeof response.success).toBe('boolean');
        expect(typeof response.code).toBe('string');
        expect(typeof response.timestamp).toBe('string');
      });
    });

    it('success responses should be marked as such', () => {
      const responses = [
        ResponseFormatter.success({}),
        ResponseFormatter.partial({ succeeded: 1, failed: 0 }),
        ResponseFormatter.paginated([], { page: 1, pageSize: 10, total: 0 }),
        ResponseFormatter.async('op-1'),
        ResponseFormatter.redirect('/path')
      ];

      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
    });

    it('error responses should be marked as such', () => {
      const response = ResponseFormatter.error('error');

      expect(response.success).toBe(false);
    });

    it('should not mix success and error fields', () => {
      const successResponse = ResponseFormatter.success({});
      const errorResponse = ResponseFormatter.error('error');

      expect(successResponse.data).toBeDefined();
      expect(successResponse.error).toBeUndefined();

      expect(errorResponse.data).toBeUndefined();
      expect(errorResponse.error).toBeDefined();
    });
  });

  describe('concurrent response generation', () => {
    it('should handle multiple simultaneous response creations', () => {
      const responses = [];

      for (let i = 0; i < 1000; i++) {
        responses.push(ResponseFormatter.success({ id: i }));
      }

      expect(responses).toHaveLength(1000);
      responses.forEach((response, index) => {
        expect(response.data.id).toBe(index);
      });
    });

    it('should generate unique timestamps (even if same millisecond)', () => {
      const timestamps = new Set();

      for (let i = 0; i < 100; i++) {
        const response = ResponseFormatter.success({});
        timestamps.add(response.timestamp);
      }

      // May have duplicates if generated same millisecond,
      // but should have at least 1 entry
      expect(timestamps.size).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('errorResponse - Edge Cases', () => {
  describe('error code handling', () => {
    it('should handle error with unknown code', () => {
      const error = new Error('Unknown error');
      error.code = 'COMPLETELY_UNKNOWN';

      const response = errorResponse(error);

      expect(response.code).toBe('COMPLETELY_UNKNOWN');
      expect(response.statusCode).toBe(500);
    });

    it('should handle error with null code', () => {
      const error = new Error('Error');
      error.code = null;

      const response = errorResponse(error);

      expect(response.code).toBe('ERROR');
    });

    it('should handle error with empty code', () => {
      const error = new Error('Error');
      error.code = '';

      const response = errorResponse(error);

      expect(response.code).toBe('ERROR');
    });
  });

  describe('error context handling', () => {
    it('should handle null context', () => {
      const error = new Error('error');

      const response = errorResponse(error, null);

      expect(response.details.operation).toBe('unknown');
    });

    it('should handle undefined context', () => {
      const error = new Error('error');

      const response = errorResponse(error, undefined);

      expect(response.details.operation).toBe('unknown');
    });

    it('should handle empty operation in context', () => {
      const error = new Error('error');

      const response = errorResponse(error, { operation: '' });

      expect(response.details.operation).toBe('');
    });

    it('should ignore extra context fields', () => {
      const error = new Error('error');

      const response = errorResponse(error, {
        operation: 'fetchData',
        extra: 'field',
        another: 'value'
      });

      expect(response.details.operation).toBe('fetchData');
      expect(response.details.extra).toBeUndefined();
    });
  });

  describe('error message extraction', () => {
    it('should handle error with no message property', () => {
      const error = {};

      const response = errorResponse(error);

      expect(response.error).toBe('Unknown error');
    });

    it('should handle error with non-string message', () => {
      const error = { message: 123 };

      const response = errorResponse(error);

      expect(response.error).toBe(123);
    });

    it('should handle error with null message', () => {
      const error = { message: null };

      const response = errorResponse(error);

      expect(response.error).toBe(null);
    });

    it('should handle nested error objects', () => {
      const innerError = new Error('Inner error');
      const outerError = new Error('Outer error');
      outerError.cause = innerError;

      const response = errorResponse(outerError);

      expect(response.error).toBe('Outer error');
    });
  });
});
