/**
 * Test suite for Input Validation Framework
 */

const { SchemaValidator } = require('../../src/validation/schema-validator');

describe('SchemaValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  // ========== Navigation Command Tests ==========

  describe('Navigation Commands', () => {
    it('should validate navigate command with URL', () => {
      const result = validator.validate('navigate', { url: 'https://example.com' });
      expect(result.valid).toBe(true);
    });

    it('should require URL for navigate command', () => {
      const result = validator.validate('navigate', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject invalid URL format', () => {
      const result = validator.validate('navigate', { url: 'not-a-url' });
      expect(result.valid).toBe(false);
    });

    it('should reject URL exceeding max length', () => {
      const url = 'https://example.com/' + 'a'.repeat(2048);
      const result = validator.validate('navigate', { url });
      expect(result.valid).toBe(false);
    });

    it('should validate timeout bounds for navigate', () => {
      const valid = validator.validate('navigate', { url: 'https://example.com', timeout: 30000 });
      expect(valid.valid).toBe(true);

      const tooSmall = validator.validate('navigate', { url: 'https://example.com', timeout: 50 });
      expect(tooSmall.valid).toBe(false);

      const tooBig = validator.validate('navigate', { url: 'https://example.com', timeout: 700000 });
      expect(tooBig.valid).toBe(false);
    });

    it('should reject additional properties in navigate', () => {
      const result = validator.validate('navigate', { url: 'https://example.com', unknownField: 'value' });
      expect(result.valid).toBe(false);
    });
  });

  // ========== Interaction Command Tests ==========

  describe('Interaction Commands', () => {
    it('should validate click command with selector', () => {
      const result = validator.validate('click', { selector: 'button.submit' });
      expect(result.valid).toBe(true);
    });

    it('should require one of selector/xpath/text for click', () => {
      const result = validator.validate('click', {});
      expect(result.valid).toBe(false);
    });

    it('should validate type_text command', () => {
      const result = validator.validate('type_text', { text: 'Hello World' });
      expect(result.valid).toBe(true);
    });

    it('should limit text length in type_text', () => {
      const longText = 'a'.repeat(1000001);
      const result = validator.validate('type_text', { text: longText });
      expect(result.valid).toBe(false);
    });

    it('should validate fill_form with data object', () => {
      const result = validator.validate('fill_form', {
        data: { username: 'user', password: 'pass' }
      });
      expect(result.valid).toBe(true);
    });

    it('should validate press_key with valid key', () => {
      const result = validator.validate('press_key', { key: 'Enter' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid key in press_key', () => {
      const result = validator.validate('press_key', { key: 'InvalidKey' });
      expect(result.valid).toBe(false);
    });

    it('should validate scroll with direction', () => {
      const result = validator.validate('scroll', { direction: 'down', amount: 5 });
      expect(result.valid).toBe(true);
    });

    it('should limit scroll amount', () => {
      const result = validator.validate('scroll', { direction: 'down', amount: 100001 });
      expect(result.valid).toBe(false);
    });
  });

  // ========== Screenshot Command Tests ==========

  describe('Screenshot Commands', () => {
    it('should validate screenshot command with defaults', () => {
      const result = validator.validate('screenshot', {});
      expect(result.valid).toBe(true);
    });

    it('should validate screenshot format', () => {
      for (const fmt of ['png', 'jpeg', 'webp', 'jpg']) {
        const result = validator.validate('screenshot', { format: fmt });
        expect(result.valid).toBe(true);
      }
    });

    it('should reject invalid screenshot format', () => {
      const result = validator.validate('screenshot', { format: 'bmp' });
      expect(result.valid).toBe(false);
    });

    it('should validate quality bounds', () => {
      const valid = validator.validate('screenshot', { quality: 90 });
      expect(valid.valid).toBe(true);

      const low = validator.validate('screenshot', { quality: 0 });
      expect(low.valid).toBe(false);

      const high = validator.validate('screenshot', { quality: 101 });
      expect(high.valid).toBe(false);
    });

    it('should validate screenshot_full_page', () => {
      const result = validator.validate('screenshot_full_page', { maxHeight: 5000 });
      expect(result.valid).toBe(true);
    });

    it('should limit maxHeight in full page screenshot', () => {
      const result = validator.validate('screenshot_full_page', { maxHeight: 100000 });
      expect(result.valid).toBe(false);
    });
  });

  // ========== Window Management Tests ==========

  describe('Window Management', () => {
    it('should validate set_viewport', () => {
      const result = validator.validate('set_viewport', { width: 1920, height: 1080 });
      expect(result.valid).toBe(true);
    });

    it('should require both width and height for set_viewport', () => {
      const result = validator.validate('set_viewport', { width: 1920 });
      expect(result.valid).toBe(false);
    });

    it('should limit viewport dimensions', () => {
      const result = validator.validate('set_viewport', { width: 20000, height: 20000 });
      expect(result.valid).toBe(false);
    });

    it('should validate switch_tab with tabId or index', () => {
      const byId = validator.validate('switch_tab', { tabId: 'tab-123' });
      expect(byId.valid).toBe(true);

      const byIndex = validator.validate('switch_tab', { index: 0 });
      expect(byIndex.valid).toBe(true);
    });

    it('should reject both tabId and index for switch_tab', () => {
      const result = validator.validate('switch_tab', { tabId: 'tab-123', index: 0 });
      expect(result.valid).toBe(false);
    });
  });

  // ========== Storage Command Tests ==========

  describe('Storage Commands', () => {
    it('should validate set_cookie', () => {
      const result = validator.validate('set_cookie', { name: 'session', value: 'abc123' });
      expect(result.valid).toBe(true);
    });

    it('should require name and value for set_cookie', () => {
      const result = validator.validate('set_cookie', { name: 'session' });
      expect(result.valid).toBe(false);
    });

    it('should validate sameSite enum', () => {
      for (const site of ['Strict', 'Lax', 'None']) {
        const result = validator.validate('set_cookie', { name: 'c', value: 'v', sameSite: site });
        expect(result.valid).toBe(true);
      }
    });

    it('should validate set_local_storage', () => {
      const result = validator.validate('set_local_storage', { key: 'mykey', value: 'myvalue' });
      expect(result.valid).toBe(true);
    });

    it('should limit storage key/value length', () => {
      const longValue = 'a'.repeat(10001);
      const result = validator.validate('set_local_storage', { key: 'key', value: longValue });
      expect(result.valid).toBe(false);
    });
  });

  // ========== JavaScript Execution Tests ==========

  describe('JavaScript Execution', () => {
    it('should validate execute_javascript with code', () => {
      const result = validator.validate('execute_javascript', { code: 'return 42;' });
      expect(result.valid).toBe(true);
    });

    it('should require code for execute_javascript', () => {
      const result = validator.validate('execute_javascript', {});
      expect(result.valid).toBe(false);
    });

    it('should limit code length', () => {
      const longCode = 'a'.repeat(1048577);
      const result = validator.validate('execute_javascript', { code: longCode });
      expect(result.valid).toBe(false);
    });

    it('should validate timeout for execute_javascript', () => {
      const result = validator.validate('execute_javascript', { code: 'return 1;', timeout: 60000 });
      expect(result.valid).toBe(true);

      const invalid = validator.validate('execute_javascript', { code: 'return 1;', timeout: 700000 });
      expect(invalid.valid).toBe(false);
    });
  });

  // ========== Proxy and User Agent Tests ==========

  describe('Proxy and User Agent', () => {
    it('should validate set_proxy', () => {
      const result = validator.validate('set_proxy', { url: 'http://proxy.example.com:8080', type: 'http' });
      expect(result.valid).toBe(true);
    });

    it('should validate proxy types', () => {
      for (const type of ['http', 'https', 'socks4', 'socks5']) {
        const result = validator.validate('set_proxy', { url: 'http://proxy.example.com:8080', type });
        expect(result.valid).toBe(true);
      }
    });

    it('should validate set_user_agent', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      const result = validator.validate('set_user_agent', { userAgent: ua });
      expect(result.valid).toBe(true);
    });

    it('should limit user agent length', () => {
      const ua = 'a'.repeat(501);
      const result = validator.validate('set_user_agent', { userAgent: ua });
      expect(result.valid).toBe(false);
    });
  });

  // ========== Batch Validation Tests ==========

  describe('Batch Validation', () => {
    it('should validate multiple commands at once', () => {
      const commands = [
        { command: 'navigate', params: { url: 'https://example.com' } },
        { command: 'click', params: { selector: 'button' } },
        { command: 'screenshot', params: {} }
      ];

      const results = validator.validateBatch(commands);
      expect(results.length).toBe(3);
      expect(results.every(r => r.valid)).toBe(true);
    });

    it('should report failures in batch validation', () => {
      const commands = [
        { command: 'navigate', params: { url: 'https://example.com' } },
        { command: 'navigate', params: {} }, // Missing URL
        { command: 'click', params: { selector: 'button' } }
      ];

      const results = validator.validateBatch(commands);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[2].valid).toBe(true);
    });
  });

  // ========== Schema Management Tests ==========

  describe('Schema Management', () => {
    it('should get schema for a command', () => {
      const schema = validator.getSchema('navigate');
      expect(schema).toBeDefined();
      expect(schema.properties.url).toBeDefined();
    });

    it('should return null for unknown command', () => {
      const schema = validator.getSchema('unknown_command_xyz');
      expect(schema).toBeNull();
    });

    it('should allow adding custom schemas', () => {
      const customSchema = {
        type: 'object',
        properties: {
          customParam: { type: 'string' }
        },
        required: ['customParam'],
        additionalProperties: false
      };

      validator.addSchema('custom_command', customSchema);
      const result = validator.validate('custom_command', { customParam: 'value' });
      expect(result.valid).toBe(true);
    });
  });

  // ========== Statistics Tests ==========

  describe('Statistics', () => {
    it('should return validator statistics', () => {
      const stats = validator.getStats();
      expect(stats.totalSchemas).toBeGreaterThan(20);
      expect(stats.totalValidators).toBeGreaterThan(20);
    });
  });

  // ========== Error Reporting Tests ==========

  describe('Error Reporting', () => {
    it('should provide detailed error messages', () => {
      const result = validator.validate('navigate', { url: 'not-a-url' });
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should include raw errors from AJV', () => {
      const result = validator.validate('navigate', {});
      expect(result.rawErrors).toBeDefined();
      expect(Array.isArray(result.rawErrors)).toBe(true);
    });
  });
});
