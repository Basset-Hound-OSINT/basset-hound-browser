/**
 * Command Validator Unit Tests
 *
 * Tests for JSON Schema validation of WebSocket commands
 *
 * @file tests/unit/command-validator.test.js
 */

const { CommandValidator } = require('../../websocket/command-validator');
const { getSchema, getAllCommandNames } = require('../../websocket/command-schemas');

describe('CommandValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new CommandValidator({ strict: true });
  });

  describe('Basic Validation', () => {
    test('should accept valid navigate command', () => {
      const result = validator.validate('navigate', {
        url: 'https://example.com',
        timeout: 5000
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject navigate with missing url', () => {
      const result = validator.validate('navigate', {
        timeout: 5000
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('MISSING_REQUIRED_FIELD');
      expect(result.errors[0].field).toBe('url');
    });

    test('should reject unknown command', () => {
      const result = validator.validate('unknownCommand', {});

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('UNKNOWN_COMMAND');
    });
  });

  describe('Type Validation', () => {
    test('should reject invalid url type', () => {
      const result = validator.validate('navigate', {
        url: 12345 // Should be string
      });

      expect(result.valid).toBe(false);
      const urlError = result.errors.find(e => e.field === 'url');
      expect(urlError.type).toBe('TYPE_MISMATCH');
      expect(urlError.receivedType).toBe('number');
    });

    test('should reject non-object params', () => {
      const result = validator.validate('navigate', 'not an object');

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('INVALID_PARAMS_TYPE');
    });

    test('should accept number for numeric fields', () => {
      const result = validator.validate('navigate', {
        url: 'https://example.com',
        timeout: 15000
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Pattern Validation', () => {
    test('should validate URL pattern', () => {
      const result = validator.validate('navigate', {
        url: 'not-a-url'
      });

      expect(result.valid).toBe(false);
      const urlError = result.errors.find(e => e.field === 'url');
      expect(urlError.type).toBe('INVALID_FORMAT');
      expect(urlError.pattern || urlError.message).toContain('format');
    });

    test('should accept valid https URLs', () => {
      const result = validator.validate('navigate', {
        url: 'https://secure.example.com/path?query=value'
      });

      expect(result.valid).toBe(true);
    });

    test('should accept valid http URLs', () => {
      const result = validator.validate('navigate', {
        url: 'http://example.com'
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Range Validation', () => {
    test('should reject timeout below minimum', () => {
      const result = validator.validate('navigate', {
        url: 'https://example.com',
        timeout: 500 // Minimum is 1000
      });

      expect(result.valid).toBe(false);
      const timeoutError = result.errors.find(e => e.field === 'timeout');
      expect(timeoutError.type).toBe('TOO_SMALL');
    });

    test('should reject timeout above maximum', () => {
      const result = validator.validate('navigate', {
        url: 'https://example.com',
        timeout: 700000 // Maximum is 600000
      });

      expect(result.valid).toBe(false);
      const timeoutError = result.errors.find(e => e.field === 'timeout');
      expect(timeoutError.type).toBe('TOO_LARGE');
    });

    test('should accept timeout within range', () => {
      const result = validator.validate('navigate', {
        url: 'https://example.com',
        timeout: 30000
      });

      expect(result.valid).toBe(true);
    });

    test('should reject port outside valid range', () => {
      const result = validator.validate('setProxy', {
        host: 'proxy.example.com',
        port: 70000 // Maximum is 65535
      });

      expect(result.valid).toBe(false);
      const portError = result.errors.find(e => e.field === 'port');
      expect(portError.type).toBe('TOO_LARGE');
    });
  });

  describe('Enum Validation', () => {
    test('should accept valid enum value', () => {
      const result = validator.validate('click', {
        selector: 'button',
        button: 'left'
      });

      expect(result.valid).toBe(true);
    });

    test('should reject invalid enum value', () => {
      const result = validator.validate('click', {
        selector: 'button',
        button: 'invalid-button'
      });

      expect(result.valid).toBe(false);
      const buttonError = result.errors.find(e => e.field === 'button');
      expect(buttonError.type).toBe('INVALID_ENUM');
      expect(buttonError.allowed).toContain('left');
      expect(buttonError.allowed).toContain('right');
    });

    test('should validate screenshot format enum', () => {
      const result = validator.validate('screenshot', {
        format: 'invalid-format'
      });

      expect(result.valid).toBe(false);
      const formatError = result.errors.find(e => e.field === 'format');
      expect(formatError.type).toBe('INVALID_ENUM');
    });
  });

  describe('String Length Validation', () => {
    test('should reject strings below minLength', () => {
      const result = validator.validate('navigate', {
        url: 'a' // Minimum is 10
      });

      expect(result.valid).toBe(false);
      const urlError = result.errors.find(e => e.field === 'url');
      expect(urlError.type).toBe('TOO_SHORT');
    });

    test('should reject strings above maxLength', () => {
      const longUrl = 'https://' + 'a'.repeat(3000); // Max is 2048
      const result = validator.validate('navigate', {
        url: longUrl
      });

      expect(result.valid).toBe(false);
      const urlError = result.errors.find(e => e.field === 'url');
      expect(urlError.type).toBe('TOO_LONG');
    });
  });

  describe('Multiple Command Validation', () => {
    test('should validate click command', () => {
      const result = validator.validate('click', {
        selector: 'button.submit',
        delay: 100,
        button: 'left'
      });

      expect(result.valid).toBe(true);
    });

    test('should validate fill command', () => {
      const result = validator.validate('fill', {
        selector: 'input#email',
        text: 'test@example.com',
        delay: 50
      });

      expect(result.valid).toBe(true);
    });

    test('should validate screenshot command', () => {
      const result = validator.validate('screenshot', {
        fullPage: true,
        quality: 90
      });

      expect(result.valid).toBe(true);
    });

    test('should validate setProxy command', () => {
      const result = validator.validate('setProxy', {
        host: 'proxy.example.com',
        port: 8080,
        proxyType: 'http'
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Error Messages and Suggestions', () => {
    test('should include helpful suggestion for missing field', () => {
      const result = validator.validate('navigate', {});

      const urlError = result.errors.find(e => e.field === 'url');
      expect(urlError.suggestion).toBeDefined();
      expect(urlError.suggestion.length > 0).toBe(true);
    });

    test('should include example in error when available', () => {
      const result = validator.validate('navigate', {
        url: 'invalid-url'
      });

      const urlError = result.errors.find(e => e.field === 'url');
      expect(urlError.suggestion).toBeDefined();
    });

    test('should format errors into readable message', () => {
      const result = validator.validate('click', {
        button: 'invalid'
      });

      const formatted = validator.formatErrors(result);
      expect(formatted).toContain('click');
      expect(formatted).toContain('Validation failed');
      expect(formatted.length > 0).toBe(true);
    });

    test('should provide detailed validation report', () => {
      const result = validator.validate('navigate', {
        url: 123,
        timeout: 'not-a-number'
      });

      const report = validator.getDetailedReport(result);
      expect(report.summary).toBeDefined();
      expect(report.summary.command).toBe('navigate');
      expect(report.summary.valid).toBe(false);
      expect(report.summary.errorCount > 0).toBe(true);
      expect(report.schema).toBeDefined();
    });
  });

  describe('Field Similarity Suggestions', () => {
    test('should suggest similar field names for typos', () => {
      const result = validator.validate('navigate', {
        ulr: 'https://example.com' // typo: "ulr" instead of "url"
      });

      // Should have warning about unknown field
      const unknownWarning = result.warnings.find(w => w.field === 'ulr');
      expect(unknownWarning).toBeDefined();
    });
  });

  describe('Default Values', () => {
    test('should document default values in schema', () => {
      const schema = getSchema('navigate');
      expect(schema.properties.timeout.default).toBe(10000);
    });

    test('should document default values in screenshot', () => {
      const schema = getSchema('screenshot');
      expect(schema.properties.quality.default).toBe(90);
      expect(schema.properties.format.default).toBe('png');
    });
  });

  describe('Command Schema Coverage', () => {
    test('should have navigate schema', () => {
      const schema = getSchema('navigate');
      expect(schema).toBeDefined();
      expect(schema.command).toBe('navigate');
      expect(schema.required).toContain('url');
    });

    test('should have click schema', () => {
      const schema = getSchema('click');
      expect(schema).toBeDefined();
      expect(schema.required).toContain('selector');
    });

    test('should have screenshot schema', () => {
      const schema = getSchema('screenshot');
      expect(schema).toBeDefined();
    });

    test('should have fill schema', () => {
      const schema = getSchema('fill');
      expect(schema).toBeDefined();
      expect(schema.required).toContain('selector');
      expect(schema.required).toContain('text');
    });

    test('should have setProxy schema', () => {
      const schema = getSchema('setProxy');
      expect(schema).toBeDefined();
      expect(schema.required).toContain('host');
      expect(schema.required).toContain('port');
    });

    test('should have minimum number of schemas', () => {
      const allNames = getAllCommandNames();
      expect(allNames.length >= 50).toBe(true); // At least 50 schemas
    });
  });

  describe('Edge Cases', () => {
    test('should handle null params gracefully', () => {
      const result = validator.validate('navigate', null);
      expect(result.valid).toBe(false);
    });

    test('should handle undefined params gracefully', () => {
      const result = validator.validate('navigate', undefined);
      expect(result.valid).toBe(false);
    });

    test('should handle array params gracefully', () => {
      const result = validator.validate('navigate', []);
      expect(result.valid).toBe(false);
    });

    test('should limit error reporting to maxErrors', () => {
      const strictValidator = new CommandValidator({ maxErrors: 2 });
      const result = strictValidator.validate('navigate', {
        url: 'invalid',
        timeout: -1
      });

      expect(result.errors.length <= 2).toBe(true);
    });
  });

  describe('Integration Examples', () => {
    test('should validate real-world navigate request', () => {
      const request = {
        command: 'navigate',
        url: 'https://www.example.com/page?param=value',
        timeout: 30000,
        waitUntil: 'networkidle2'
      };

      const result = validator.validate(request.command, {
        url: request.url,
        timeout: request.timeout,
        waitUntil: request.waitUntil
      });

      expect(result.valid).toBe(true);
    });

    test('should validate real-world click request', () => {
      const request = {
        command: 'click',
        selector: '#submit-button',
        delay: 50,
        button: 'left',
        clickCount: 1
      };

      const result = validator.validate(request.command, {
        selector: request.selector,
        delay: request.delay,
        button: request.button,
        clickCount: request.clickCount
      });

      expect(result.valid).toBe(true);
    });

    test('should validate real-world fill request', () => {
      const request = {
        command: 'fill',
        selector: 'input[name="email"]',
        text: 'user@example.com',
        delay: 75
      };

      const result = validator.validate(request.command, {
        selector: request.selector,
        text: request.text,
        delay: request.delay
      });

      expect(result.valid).toBe(true);
    });
  });
});

describe('ValidationMiddleware Integration', () => {
  const { createValidationMiddleware } = require('../../websocket/validation-middleware');

  let middleware;

  beforeEach(() => {
    middleware = createValidationMiddleware({
      logger: console,
      logValidationErrors: false
    });
  });

  test('should validate request with middleware', () => {
    const request = {
      id: '123',
      command: 'navigate',
      url: 'https://example.com'
    };

    const result = middleware.validateRequest(request);
    expect(result.valid).toBe(true);
    expect(result.command).toBe('navigate');
    expect(result.params.url).toBe('https://example.com');
  });

  test('should reject invalid request with middleware', () => {
    const request = {
      id: '123',
      command: 'navigate'
      // Missing url
    };

    const result = middleware.validateRequest(request);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('INVALID_PARAMETERS');
  });

  test('should create error response from validation result', () => {
    const request = {
      id: '123',
      command: 'click'
      // Missing selector
    };

    const validationResult = middleware.validateRequest(request);
    const errorResponse = middleware.createErrorResponse(validationResult);

    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error).toBe('INVALID_PARAMETERS');
    expect(errorResponse.id).toBe('123');
    expect(errorResponse.details).toBeDefined();
  });

  test('should get command schema via middleware', () => {
    const schema = middleware.getCommandSchema('navigate');
    expect(schema).toBeDefined();
    expect(schema.command).toBe('navigate');
  });
});
