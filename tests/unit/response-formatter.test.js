/**
 * Basset Hound Browser - Response Formatter Unit Tests
 * Comprehensive test suite for response-formatter module
 *
 * @module tests/unit/response-formatter.test.js
 */

const { ResponseFormatter, errorResponse } = require('../../src/utils/response-formatter');

describe('ResponseFormatter.success', () => {
  describe('basic success responses', () => {
    it('should create success response with data', () => {
      const data = { count: 42, name: 'test' };
      const response = ResponseFormatter.success(data);

      expect(response.success).toBe(true);
      expect(response.code).toBe('SUCCESS');
      expect(response.data).toEqual(data);
      expect(response.timestamp).toBeDefined();
    });

    it('should use custom success code', () => {
      const response = ResponseFormatter.success({ value: 1 }, { code: 'CUSTOM_SUCCESS' });

      expect(response.code).toBe('CUSTOM_SUCCESS');
      expect(response.success).toBe(true);
    });

    it('should include metadata when provided', () => {
      const data = { value: 42 };
      const metadata = { source: 'api', version: '1.0' };

      const response = ResponseFormatter.success(data, { metadata });

      expect(response.metadata).toEqual(metadata);
    });

    it('should not include metadata when not provided', () => {
      const response = ResponseFormatter.success({ value: 42 });

      expect(response.metadata).toBeUndefined();
    });

    it('should include null metadata when explicitly null', () => {
      const response = ResponseFormatter.success({ value: 42 }, { metadata: null });

      expect(response.metadata).toBeUndefined();
    });

    it('should handle null/undefined data', () => {
      const response1 = ResponseFormatter.success(null);
      expect(response1.data).toBeNull();

      const response2 = ResponseFormatter.success(undefined);
      expect(response2.data).toBeUndefined();
    });

    it('should generate ISO timestamp', () => {
      const response = ResponseFormatter.success({ value: 1 });

      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle large data payloads', () => {
      const largeData = {
        items: Array(1000).fill(0).map((_, i) => ({
          id: i,
          value: `item-${i}`,
          nested: { prop: 'value' }
        }))
      };

      const response = ResponseFormatter.success(largeData);

      expect(response.data.items).toHaveLength(1000);
      expect(response.success).toBe(true);
    });

    it('should handle complex nested objects', () => {
      const complexData = {
        level1: {
          level2: {
            level3: {
              level4: ['a', 'b', 'c']
            }
          }
        }
      };

      const response = ResponseFormatter.success(complexData);

      expect(response.data.level1.level2.level3.level4).toEqual(['a', 'b', 'c']);
    });

    it('should handle array data', () => {
      const arrayData = [1, 2, 3, 4, 5];

      const response = ResponseFormatter.success(arrayData);

      expect(response.data).toEqual(arrayData);
      expect(response.success).toBe(true);
    });

    it('should handle primitive values', () => {
      expect(ResponseFormatter.success(42).data).toBe(42);
      expect(ResponseFormatter.success('string').data).toBe('string');
      expect(ResponseFormatter.success(true).data).toBe(true);
    });
  });

  describe('response structure validation', () => {
    it('should have required fields', () => {
      const response = ResponseFormatter.success({ value: 1 });

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('timestamp');
    });

    it('should not have error field', () => {
      const response = ResponseFormatter.success({ value: 1 });

      expect(response).not.toHaveProperty('error');
    });
  });
});

describe('ResponseFormatter.error', () => {
  describe('basic error responses', () => {
    it('should create error response with message', () => {
      const response = ResponseFormatter.error('Operation failed');

      expect(response.success).toBe(false);
      expect(response.error).toBe('Operation failed');
      expect(response.code).toBe('ERROR');
      expect(response.statusCode).toBe(500);
      expect(response.timestamp).toBeDefined();
    });

    it('should use custom error code', () => {
      const response = ResponseFormatter.error('Auth failed', { code: 'AUTH_ERROR' });

      expect(response.code).toBe('AUTH_ERROR');
    });

    it('should use custom status code', () => {
      const response = ResponseFormatter.error('Not found', { statusCode: 404 });

      expect(response.statusCode).toBe(404);
    });

    it('should include details when provided', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const response = ResponseFormatter.error('Validation failed', { details });

      expect(response.details).toEqual(details);
    });

    it('should not include details when not provided', () => {
      const response = ResponseFormatter.error('Failed');

      expect(response.details).toBeUndefined();
    });

    it('should not include details when null', () => {
      const response = ResponseFormatter.error('Failed', { details: null });

      expect(response.details).toBeUndefined();
    });

    it('should handle null/undefined message', () => {
      const response1 = ResponseFormatter.error(null);
      expect(response1.error).toBeNull();

      const response2 = ResponseFormatter.error(undefined);
      expect(response2.error).toBeUndefined();
    });

    it('should handle various HTTP status codes', () => {
      const statusCodes = [400, 401, 403, 404, 408, 409, 429, 500, 502, 503];

      statusCodes.forEach(code => {
        const response = ResponseFormatter.error('Error', { statusCode: code });
        expect(response.statusCode).toBe(code);
      });
    });

    it('should map common error codes', () => {
      const response = ResponseFormatter.error('Timeout', { code: 'TIMEOUT' });

      expect(response.code).toBe('TIMEOUT');
    });
  });

  describe('response structure validation', () => {
    it('should have required fields', () => {
      const response = ResponseFormatter.error('Failed');

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('statusCode');
      expect(response).toHaveProperty('timestamp');
    });

    it('should not have data field', () => {
      const response = ResponseFormatter.error('Failed');

      expect(response).not.toHaveProperty('data');
    });

    it('success should be false', () => {
      const response = ResponseFormatter.error('Failed');

      expect(response.success).toBe(false);
    });
  });
});

describe('ResponseFormatter.partial', () => {
  describe('basic partial responses', () => {
    it('should create partial response', () => {
      const results = { succeeded: 8, failed: 2 };
      const response = ResponseFormatter.partial(results);

      expect(response.success).toBe(true);
      expect(response.code).toBe('PARTIAL_SUCCESS');
      expect(response.partial).toBe(true);
      expect(response.results.succeeded).toBe(8);
      expect(response.results.failed).toBe(2);
      expect(response.results.total).toBe(10);
    });

    it('should use custom code', () => {
      const response = ResponseFormatter.partial(
        { succeeded: 5, failed: 1 },
        { code: 'BATCH_PARTIAL' }
      );

      expect(response.code).toBe('BATCH_PARTIAL');
    });

    it('should include errors when provided', () => {
      const errors = [
        { index: 1, error: 'Invalid data' },
        { index: 3, error: 'Timeout' }
      ];

      const response = ResponseFormatter.partial(
        { succeeded: 8, failed: 2, errors },
        {}
      );

      expect(response.errors).toEqual(errors);
    });

    it('should not include empty errors array', () => {
      const response = ResponseFormatter.partial(
        { succeeded: 10, failed: 0, errors: [] },
        {}
      );

      expect(response.errors).toBeUndefined();
    });

    it('should handle zero succeeded', () => {
      const response = ResponseFormatter.partial(
        { succeeded: 0, failed: 5 },
        {}
      );

      expect(response.results.succeeded).toBe(0);
      expect(response.results.total).toBe(5);
    });

    it('should handle zero failed', () => {
      const response = ResponseFormatter.partial(
        { succeeded: 10, failed: 0 },
        {}
      );

      expect(response.results.failed).toBe(0);
      expect(response.results.total).toBe(10);
    });

    it('should handle missing succeeded/failed fields', () => {
      const response1 = ResponseFormatter.partial({ failed: 2 });
      expect(response1.results.succeeded).toBe(0);

      const response2 = ResponseFormatter.partial({ succeeded: 8 });
      expect(response2.results.failed).toBe(0);
    });

    it('should calculate total correctly', () => {
      const response = ResponseFormatter.partial(
        { succeeded: 25, failed: 75 },
        {}
      );

      expect(response.results.total).toBe(100);
    });
  });

  describe('response structure', () => {
    it('should have partial flag', () => {
      const response = ResponseFormatter.partial({ succeeded: 1, failed: 0 });

      expect(response.partial).toBe(true);
    });

    it('should have results object with correct structure', () => {
      const response = ResponseFormatter.partial({ succeeded: 5, failed: 2 });

      expect(response.results).toHaveProperty('succeeded');
      expect(response.results).toHaveProperty('failed');
      expect(response.results).toHaveProperty('total');
    });
  });
});

describe('ResponseFormatter.paginated', () => {
  describe('basic paginated responses', () => {
    it('should create paginated response', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const pagination = { page: 1, pageSize: 3, total: 10 };

      const response = ResponseFormatter.paginated(items, pagination);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(items);
      expect(response.pagination.page).toBe(1);
      expect(response.pagination.pageSize).toBe(3);
      expect(response.pagination.total).toBe(10);
    });

    it('should use custom code', () => {
      const response = ResponseFormatter.paginated(
        [],
        { page: 1, pageSize: 10, total: 0 },
        { code: 'CUSTOM_PAGINATED' }
      );

      expect(response.code).toBe('CUSTOM_PAGINATED');
    });

    it('should calculate totalPages correctly', () => {
      const response = ResponseFormatter.paginated(
        [],
        { page: 1, pageSize: 10, total: 42 }
      );

      expect(response.pagination.totalPages).toBe(5); // ceil(42/10)
    });

    it('should set hasNextPage correctly', () => {
      const response1 = ResponseFormatter.paginated(
        [],
        { page: 1, pageSize: 10, total: 42 }
      );
      expect(response1.pagination.hasNextPage).toBe(true);

      const response2 = ResponseFormatter.paginated(
        [],
        { page: 5, pageSize: 10, total: 42 }
      );
      expect(response2.pagination.hasNextPage).toBe(false);
    });

    it('should set hasPreviousPage correctly', () => {
      const response1 = ResponseFormatter.paginated(
        [],
        { page: 1, pageSize: 10, total: 42 }
      );
      expect(response1.pagination.hasPreviousPage).toBe(false);

      const response2 = ResponseFormatter.paginated(
        [],
        { page: 2, pageSize: 10, total: 42 }
      );
      expect(response2.pagination.hasPreviousPage).toBe(true);
    });

    it('should handle edge case: page=1, total=0', () => {
      const response = ResponseFormatter.paginated(
        [],
        { page: 1, pageSize: 10, total: 0 }
      );

      expect(response.pagination.totalPages).toBe(0);
      expect(response.pagination.hasNextPage).toBe(false);
      expect(response.pagination.hasPreviousPage).toBe(false);
    });

    it('should handle edge case: page=last', () => {
      const response = ResponseFormatter.paginated(
        [{ id: 1 }],
        { page: 5, pageSize: 10, total: 42 }
      );

      expect(response.pagination.totalPages).toBe(5);
      expect(response.pagination.hasNextPage).toBe(false);
      expect(response.pagination.hasPreviousPage).toBe(true);
    });

    it('should handle pageSize=1', () => {
      const response = ResponseFormatter.paginated(
        [{ id: 1 }],
        { page: 1, pageSize: 1, total: 100 }
      );

      expect(response.pagination.totalPages).toBe(100);
      expect(response.pagination.hasNextPage).toBe(true);
    });

    it('should handle exact page boundary', () => {
      const response = ResponseFormatter.paginated(
        Array(10).fill({}).map((_, i) => ({ id: i })),
        { page: 2, pageSize: 10, total: 20 }
      );

      expect(response.pagination.totalPages).toBe(2);
      expect(response.pagination.hasNextPage).toBe(false);
    });
  });
});

describe('ResponseFormatter.async', () => {
  describe('async operation responses', () => {
    it('should create async operation response', () => {
      const response = ResponseFormatter.async('op-12345');

      expect(response.success).toBe(true);
      expect(response.code).toBe('OPERATION_STARTED');
      expect(response.operationId).toBe('op-12345');
      expect(response.timestamp).toBeDefined();
    });

    it('should use custom code', () => {
      const response = ResponseFormatter.async('op-123', {
        code: 'BACKGROUND_TASK_STARTED'
      });

      expect(response.code).toBe('BACKGROUND_TASK_STARTED');
    });

    it('should include statusUrl when provided', () => {
      const response = ResponseFormatter.async('op-123', {
        statusUrl: '/api/status/op-123'
      });

      expect(response.statusUrl).toBe('/api/status/op-123');
    });

    it('should not include statusUrl when not provided', () => {
      const response = ResponseFormatter.async('op-123');

      expect(response.statusUrl).toBeUndefined();
    });

    it('should not include statusUrl when null', () => {
      const response = ResponseFormatter.async('op-123', { statusUrl: null });

      expect(response.statusUrl).toBeUndefined();
    });

    it('should handle various operation ID formats', () => {
      const ids = [
        'simple-id',
        'uuid-12345678-1234-5678-1234-567812345678',
        'complex-op-2024-05-31-12345'
      ];

      ids.forEach(id => {
        const response = ResponseFormatter.async(id);
        expect(response.operationId).toBe(id);
      });
    });
  });
});

describe('ResponseFormatter.redirect', () => {
  describe('redirect responses', () => {
    it('should create temporary redirect', () => {
      const response = ResponseFormatter.redirect('/new-endpoint');

      expect(response.success).toBe(true);
      expect(response.code).toBe('FOUND');
      expect(response.statusCode).toBe(302);
      expect(response.location).toBe('/new-endpoint');
    });

    it('should create permanent redirect', () => {
      const response = ResponseFormatter.redirect('/new-endpoint', {
        permanent: true
      });

      expect(response.code).toBe('MOVED_PERMANENTLY');
      expect(response.statusCode).toBe(301);
    });

    it('should handle absolute URLs', () => {
      const response = ResponseFormatter.redirect('https://example.com/path');

      expect(response.location).toBe('https://example.com/path');
    });

    it('should handle relative URLs', () => {
      const response = ResponseFormatter.redirect('../other-path');

      expect(response.location).toBe('../other-path');
    });

    it('should handle URLs with query parameters', () => {
      const response = ResponseFormatter.redirect('/path?key=value&foo=bar');

      expect(response.location).toBe('/path?key=value&foo=bar');
    });
  });
});

describe('ResponseFormatter.isValid', () => {
  describe('validation', () => {
    it('should validate correct success response', () => {
      const response = ResponseFormatter.success({ value: 1 });

      expect(ResponseFormatter.isValid(response)).toBe(true);
    });

    it('should validate correct error response', () => {
      const response = ResponseFormatter.error('Failed');

      expect(ResponseFormatter.isValid(response)).toBe(true);
    });

    it('should reject non-object input', () => {
      expect(ResponseFormatter.isValid('string')).toBe(false);
      expect(ResponseFormatter.isValid(123)).toBe(false);
      expect(ResponseFormatter.isValid(null)).toBe(false);
      expect(ResponseFormatter.isValid(undefined)).toBe(false);
    });

    it('should reject missing success field', () => {
      const response = { code: 'SUCCESS', data: {} };

      expect(ResponseFormatter.isValid(response)).toBe(false);
    });

    it('should reject non-boolean success field', () => {
      const response = { success: 'true', code: 'SUCCESS', timestamp: new Date().toISOString() };

      expect(ResponseFormatter.isValid(response)).toBe(false);
    });

    it('should reject missing timestamp', () => {
      const response = { success: true, code: 'SUCCESS', data: {} };

      expect(ResponseFormatter.isValid(response)).toBe(false);
    });

    it('should require data when requireData=true', () => {
      const response = { success: true, code: 'SUCCESS', timestamp: new Date().toISOString() };

      expect(ResponseFormatter.isValid(response, { requireData: true })).toBe(false);
    });

    it('should accept response with data when requireData=true', () => {
      const response = ResponseFormatter.success({ value: 1 });

      expect(ResponseFormatter.isValid(response, { requireData: true })).toBe(true);
    });

    it('should require error when requireError=true', () => {
      const response = { success: false, code: 'ERROR', timestamp: new Date().toISOString() };

      expect(ResponseFormatter.isValid(response, { requireError: true })).toBe(false);
    });

    it('should accept response with error when requireError=true', () => {
      const response = ResponseFormatter.error('Failed');

      expect(ResponseFormatter.isValid(response, { requireError: true })).toBe(true);
    });
  });
});

describe('ResponseFormatter.toJSON', () => {
  describe('serialization', () => {
    it('should serialize normal response', () => {
      const response = ResponseFormatter.success({ id: 1, name: 'test' });
      const json = ResponseFormatter.toJSON(response);

      expect(json).toEqual(response);
      expect(typeof json).toBe('object');
    });

    it('should handle Error objects', () => {
      const error = new Error('Test error');
      const result = ResponseFormatter.toJSON(error);

      expect(result.success).toBe(false);
      expect(result.code).toBe('ERROR');
      expect(result.error).toBe('Test error');
      expect(result.stack).toBeDefined();
    });

    it('should handle null input', () => {
      const result = ResponseFormatter.toJSON(null);

      expect(result).toBeNull();
    });

    it('should handle undefined input', () => {
      const result = ResponseFormatter.toJSON(undefined);

      expect(result).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(ResponseFormatter.toJSON(42)).toBe(42);
      expect(ResponseFormatter.toJSON('string')).toBe('string');
      expect(ResponseFormatter.toJSON(true)).toBe(true);
    });

    it('should handle complex nested structures', () => {
      const response = {
        success: true,
        nested: {
          level2: {
            items: [1, 2, 3]
          }
        }
      };

      const json = ResponseFormatter.toJSON(response);

      expect(json.nested.level2.items).toEqual([1, 2, 3]);
    });

    it('should create plain object without circular references', () => {
      const response = ResponseFormatter.success({ value: 1 });
      const json = ResponseFormatter.toJSON(response);

      expect(JSON.stringify(json)).toBeDefined();
    });

    it('should handle large payloads', () => {
      const largeData = {
        items: Array(1000).fill(0).map((_, i) => ({ id: i }))
      };

      const response = ResponseFormatter.success(largeData);
      const json = ResponseFormatter.toJSON(response);

      expect(json.data.items).toHaveLength(1000);
    });
  });
});

describe('errorResponse utility function', () => {
  describe('basic error response conversion', () => {
    it('should convert generic error to response', () => {
      const error = new Error('Operation failed');
      const response = errorResponse(error);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Operation failed');
      expect(response.code).toBe('ERROR');
      expect(response.statusCode).toBe(500);
    });

    it('should include operation context', () => {
      const error = new Error('Failed');
      const response = errorResponse(error, { operation: 'fetchData' });

      expect(response.details.operation).toBe('fetchData');
      expect(response.details.timestamp).toBeDefined();
    });

    it('should use default operation when not provided', () => {
      const error = new Error('Failed');
      const response = errorResponse(error);

      expect(response.details.operation).toBe('unknown');
    });
  });

  describe('error code mapping', () => {
    it('should map VALIDATION_ERROR to 400', () => {
      const error = new Error('Invalid input');
      error.code = 'VALIDATION_ERROR';

      const response = errorResponse(error);

      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.statusCode).toBe(400);
    });

    it('should map AUTH_ERROR to 401', () => {
      const error = new Error('Unauthorized');
      error.code = 'AUTH_ERROR';

      const response = errorResponse(error);

      expect(response.code).toBe('UNAUTHORIZED');
      expect(response.statusCode).toBe(401);
    });

    it('should map TIMEOUT to 408', () => {
      const error = new Error('Operation timed out');
      error.code = 'TIMEOUT';

      const response = errorResponse(error);

      expect(response.code).toBe('TIMEOUT');
      expect(response.statusCode).toBe(408);
    });

    it('should map NOT_FOUND to 404', () => {
      const error = new Error('Resource not found');
      error.code = 'NOT_FOUND';

      const response = errorResponse(error);

      expect(response.code).toBe('NOT_FOUND');
      expect(response.statusCode).toBe(404);
    });

    it('should map CONFLICT to 409', () => {
      const error = new Error('Resource conflict');
      error.code = 'CONFLICT';

      const response = errorResponse(error);

      expect(response.code).toBe('CONFLICT');
      expect(response.statusCode).toBe(409);
    });

    it('should map RESOURCE_ERROR to 503', () => {
      const error = new Error('Resource unavailable');
      error.code = 'RESOURCE_ERROR';

      const response = errorResponse(error);

      expect(response.code).toBe('RESOURCE_ERROR');
      expect(response.statusCode).toBe(503);
    });

    it('should use error code as-is for unmapped codes', () => {
      const error = new Error('Custom error');
      error.code = 'CUSTOM_ERROR';

      const response = errorResponse(error);

      expect(response.code).toBe('CUSTOM_ERROR');
      expect(response.statusCode).toBe(500); // default
    });

    it('should handle error without code property', () => {
      const error = new Error('No code error');

      const response = errorResponse(error);

      expect(response.code).toBe('ERROR');
      expect(response.statusCode).toBe(500);
    });
  });

  describe('error message handling', () => {
    it('should use error message', () => {
      const error = new Error('Specific error message');

      const response = errorResponse(error);

      expect(response.error).toBe('Specific error message');
    });

    it('should handle missing message property', () => {
      const error = new Error();
      error.message = '';

      const response = errorResponse(error);

      expect(response.error).toBe('');
    });

    it('should use default for undefined error', () => {
      const error = {};

      const response = errorResponse(error);

      expect(response.error).toBe('Unknown error');
    });
  });
});

describe('ResponseFormatter integration', () => {
  describe('response consistency', () => {
    it('should maintain consistent timestamp format across response types', () => {
      const responses = [
        ResponseFormatter.success({ value: 1 }),
        ResponseFormatter.error('Failed'),
        ResponseFormatter.partial({ succeeded: 1, failed: 0 }),
        ResponseFormatter.paginated([], { page: 1, pageSize: 10, total: 0 }),
        ResponseFormatter.async('op-123'),
        ResponseFormatter.redirect('/path')
      ];

      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

      responses.forEach(response => {
        expect(response.timestamp).toMatch(timestampRegex);
      });
    });

    it('should maintain code field across all response types', () => {
      const responses = [
        ResponseFormatter.success({ value: 1 }),
        ResponseFormatter.error('Failed'),
        ResponseFormatter.partial({ succeeded: 1, failed: 0 }),
        ResponseFormatter.paginated([], { page: 1, pageSize: 10, total: 0 }),
        ResponseFormatter.async('op-123'),
        ResponseFormatter.redirect('/path')
      ];

      responses.forEach(response => {
        expect(response).toHaveProperty('code');
        expect(typeof response.code).toBe('string');
      });
    });
  });

  describe('round-trip serialization', () => {
    it('should serialize and validate without loss', () => {
      const original = ResponseFormatter.success({
        id: 1,
        items: [1, 2, 3],
        nested: { key: 'value' }
      });

      const json = ResponseFormatter.toJSON(original);
      const validated = ResponseFormatter.isValid(json);

      expect(validated).toBe(true);
      expect(json).toEqual(original);
    });

    it('should handle JSON.stringify round-trip', () => {
      const original = ResponseFormatter.success({ data: 'test' });
      const stringified = JSON.stringify(original);
      const parsed = JSON.parse(stringified);

      expect(ResponseFormatter.isValid(parsed)).toBe(true);
      expect(parsed).toEqual(original);
    });
  });
});
