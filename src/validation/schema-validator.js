/**
 * Input Validation Framework
 *
 * Comprehensive JSON Schema validation for all WebSocket commands.
 * Uses AJV (Another JSON Schema Validator) for performant validation.
 *
 * Schema design principles:
 * - All required fields explicitly listed
 * - Type checking with minimum/maximum constraints
 * - String length limits to prevent DoS
 * - Numeric bounds to prevent overflow
 * - No additionalProperties to catch typos
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');

class SchemaValidator {
  /**
   * Initialize validator with AJV instance
   */
  constructor(options = {}) {
    this.ajv = new Ajv({
      removeAdditional: false,  // Keep additional properties for error reporting
      useDefaults: true,
      coerceTypes: false,  // Strict type checking
      keywords: ['description', 'example'],
      ...options
    });

    // Add format validators for common types
    addFormats(this.ajv);

    this.schemas = this._buildSchemas();
    this.validators = this._compileValidators();
  }

  /**
   * Build JSON schema definitions for all commands
   * @private
   */
  _buildSchemas() {
    return {
      // Navigation commands
      navigate: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri', maxLength: 2048 },
          timeout: { type: 'integer', minimum: 100, maximum: 600000, default: 30000 },
          waitFor: { type: 'string', enum: ['load', 'networkidle2', 'networkidle0', 'domcontentloaded'], default: 'load' }
        },
        required: ['url'],
        additionalProperties: false
      },

      go_back: {
        type: 'object',
        properties: {
          timeout: { type: 'integer', minimum: 100, maximum: 600000, default: 30000 }
        },
        additionalProperties: false
      },

      go_forward: {
        type: 'object',
        properties: {
          timeout: { type: 'integer', minimum: 100, maximum: 600000, default: 30000 }
        },
        additionalProperties: false
      },

      refresh: {
        type: 'object',
        properties: {
          skipCache: { type: 'boolean', default: false },
          timeout: { type: 'integer', minimum: 100, maximum: 600000, default: 30000 }
        },
        additionalProperties: false
      },

      stop_loading: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },

      // Interaction commands
      click: {
        type: 'object',
        properties: {
          selector: { type: 'string', maxLength: 1000 },
          xpath: { type: 'string', maxLength: 1000 },
          text: { type: 'string', maxLength: 1000 },
          timeout: { type: 'integer', minimum: 100, maximum: 60000, default: 10000 },
          offset: {
            type: 'object',
            properties: {
              x: { type: 'number', minimum: -10000, maximum: 10000 },
              y: { type: 'number', minimum: -10000, maximum: 10000 }
            },
            additionalProperties: false
          }
        },
        oneOf: [
          { required: ['selector'] },
          { required: ['xpath'] },
          { required: ['text'] }
        ],
        additionalProperties: false
      },

      type_text: {
        type: 'object',
        properties: {
          text: { type: 'string', maxLength: 1000000 },
          delay: { type: 'integer', minimum: 0, maximum: 1000, default: 0 },
          selector: { type: 'string', maxLength: 1000 },
          timeout: { type: 'integer', minimum: 100, maximum: 60000, default: 10000 }
        },
        required: ['text'],
        additionalProperties: false
      },

      press_key: {
        type: 'object',
        properties: {
          key: { type: 'string', enum: ['Enter', 'Escape', 'Tab', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock'] },
          code: { type: 'string', maxLength: 20 },
          text: { type: 'string', maxLength: 100 },
          modifiers: { type: 'array', items: { type: 'string', enum: ['Control', 'Shift', 'Alt', 'Meta'] }, uniqueItems: true },
          repeat: { type: 'integer', minimum: 1, maximum: 1000, default: 1 },
          delay: { type: 'integer', minimum: 0, maximum: 5000, default: 0 }
        },
        oneOf: [
          { required: ['key'] },
          { required: ['code'] },
          { required: ['text'] }
        ],
        additionalProperties: false
      },

      scroll: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], default: 'down' },
          amount: { type: 'integer', minimum: 1, maximum: 100000, default: 5 },
          selector: { type: 'string', maxLength: 1000 },
          smooth: { type: 'boolean', default: false },
          behavior: { type: 'string', enum: ['smooth', 'auto'], default: 'auto' }
        },
        additionalProperties: false
      },

      hover: {
        type: 'object',
        properties: {
          selector: { type: 'string', maxLength: 1000 },
          xpath: { type: 'string', maxLength: 1000 },
          delay: { type: 'integer', minimum: 0, maximum: 60000, default: 100 },
          timeout: { type: 'integer', minimum: 100, maximum: 60000, default: 10000 }
        },
        oneOf: [
          { required: ['selector'] },
          { required: ['xpath'] }
        ],
        additionalProperties: false
      },

      fill_form: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            minProperties: 1,
            maxProperties: 1000,
            additionalProperties: { type: 'string', maxLength: 1000000 }
          },
          selectors: {
            type: 'object',
            additionalProperties: { type: 'string', maxLength: 1000 }
          },
          timeout: { type: 'integer', minimum: 100, maximum: 60000, default: 10000 },
          delay: { type: 'integer', minimum: 0, maximum: 5000, default: 0 }
        },
        required: ['data'],
        additionalProperties: false
      },

      submit_form: {
        type: 'object',
        properties: {
          selector: { type: 'string', maxLength: 1000 },
          xpath: { type: 'string', maxLength: 1000 },
          timeout: { type: 'integer', minimum: 100, maximum: 60000, default: 30000 }
        },
        additionalProperties: false
      },

      wait_for_selector: {
        type: 'object',
        properties: {
          selector: { type: 'string', maxLength: 1000 },
          xpath: { type: 'string', maxLength: 1000 },
          visible: { type: 'boolean', default: false },
          timeout: { type: 'integer', minimum: 100, maximum: 600000, default: 30000 }
        },
        oneOf: [
          { required: ['selector'] },
          { required: ['xpath'] }
        ],
        additionalProperties: false
      },

      // Screenshot commands
      screenshot: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['png', 'jpeg', 'webp', 'jpg'], default: 'png' },
          quality: { type: 'integer', minimum: 1, maximum: 100, default: 90 },
          delay: { type: 'integer', minimum: 0, maximum: 60000, default: 0 },
          savePath: { type: ['string', 'null'], maxLength: 2048 },
          fromSurface: { type: 'boolean', default: true },
          captureBeyondViewport: { type: 'boolean', default: false }
        },
        additionalProperties: false
      },

      screenshot_full_page: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['png', 'jpeg', 'webp', 'jpg'], default: 'png' },
          quality: { type: 'integer', minimum: 1, maximum: 100, default: 90 },
          maxHeight: { type: 'integer', minimum: 1, maximum: 50000, default: 50000 },
          delay: { type: 'integer', minimum: 0, maximum: 60000, default: 0 },
          savePath: { type: ['string', 'null'], maxLength: 2048 }
        },
        additionalProperties: false
      },

      screenshot_element: {
        type: 'object',
        properties: {
          selector: { type: 'string', maxLength: 1000 },
          xpath: { type: 'string', maxLength: 1000 },
          format: { type: 'string', enum: ['png', 'jpeg', 'webp', 'jpg'], default: 'png' },
          quality: { type: 'integer', minimum: 1, maximum: 100, default: 90 },
          delay: { type: 'integer', minimum: 0, maximum: 60000, default: 0 },
          savePath: { type: ['string', 'null'], maxLength: 2048 },
          timeout: { type: 'integer', minimum: 100, maximum: 60000, default: 10000 }
        },
        oneOf: [
          { required: ['selector'] },
          { required: ['xpath'] }
        ],
        additionalProperties: false
      },

      // Window management
      set_viewport: {
        type: 'object',
        properties: {
          width: { type: 'integer', minimum: 1, maximum: 10000 },
          height: { type: 'integer', minimum: 1, maximum: 10000 },
          deviceScaleFactor: { type: 'number', minimum: 0.1, maximum: 5, default: 1 }
        },
        required: ['width', 'height'],
        additionalProperties: false
      },

      switch_tab: {
        type: 'object',
        properties: {
          tabId: { type: 'string', maxLength: 100 },
          index: { type: 'integer', minimum: 0 }
        },
        oneOf: [
          { required: ['tabId'] },
          { required: ['index'] }
        ],
        additionalProperties: false
      },

      // Session commands
      create_session: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 255 },
          profileName: { type: 'string', maxLength: 255 },
          dataDir: { type: 'string', maxLength: 2048 }
        },
        additionalProperties: false
      },

      activate_session: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', maxLength: 255 }
        },
        required: ['sessionId'],
        additionalProperties: false
      },

      set_proxy: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri', maxLength: 2048 },
          type: { type: 'string', enum: ['http', 'https', 'socks4', 'socks5'] },
          username: { type: ['string', 'null'], maxLength: 255 },
          password: { type: ['string', 'null'], maxLength: 255 }
        },
        required: ['url'],
        additionalProperties: false
      },

      set_user_agent: {
        type: 'object',
        properties: {
          userAgent: { type: 'string', maxLength: 500 }
        },
        required: ['userAgent'],
        additionalProperties: false
      },

      set_header: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 500 },
          value: { type: 'string', maxLength: 2000 }
        },
        required: ['name', 'value'],
        additionalProperties: false
      },

      // Content extraction
      extract_html: {
        type: 'object',
        properties: {
          includeHead: { type: 'boolean', default: true },
          includeScripts: { type: 'boolean', default: false },
          cleanup: { type: 'boolean', default: false }
        },
        additionalProperties: false
      },

      extract_text: {
        type: 'object',
        properties: {
          selector: { type: 'string', maxLength: 1000 },
          includeHidden: { type: 'boolean', default: false }
        },
        additionalProperties: false
      },

      set_cookie: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 255 },
          value: { type: 'string', maxLength: 10000 },
          domain: { type: 'string', maxLength: 255 },
          path: { type: 'string', maxLength: 2048 },
          expires: { type: 'integer', minimum: 0, maximum: 9999999999999 },
          httpOnly: { type: 'boolean', default: false },
          secure: { type: 'boolean', default: false },
          sameSite: { type: 'string', enum: ['Strict', 'Lax', 'None'] }
        },
        required: ['name', 'value'],
        additionalProperties: false
      },

      get_cookies: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri', maxLength: 2048 }
        },
        additionalProperties: false
      },

      delete_cookie: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 255 },
          url: { type: 'string', format: 'uri', maxLength: 2048 },
          domain: { type: 'string', maxLength: 255 },
          path: { type: 'string', maxLength: 2048 }
        },
        required: ['name'],
        additionalProperties: false
      },

      // JavaScript execution (protected)
      execute_javascript: {
        type: 'object',
        properties: {
          code: { type: 'string', maxLength: 1048576 },  // 1MB limit
          timeout: { type: 'integer', minimum: 100, maximum: 600000, default: 30000 },
          awaitPromise: { type: 'boolean', default: true },
          sandbox: { type: 'boolean', default: true },
          returnByValue: { type: 'boolean', default: true }
        },
        required: ['code'],
        additionalProperties: false
      },

      // Recording
      start_recording: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['webm', 'mp4'], default: 'webm' },
          fps: { type: 'integer', minimum: 1, maximum: 60, default: 30 }
        },
        additionalProperties: false
      },

      stop_recording: {
        type: 'object',
        properties: {
          savePath: { type: ['string', 'null'], maxLength: 2048 }
        },
        additionalProperties: false
      },

      // Evasion
      set_geolocation: {
        type: 'object',
        properties: {
          latitude: { type: 'number', minimum: -90, maximum: 90 },
          longitude: { type: 'number', minimum: -180, maximum: 180 },
          accuracy: { type: 'number', minimum: 0, maximum: 100 }
        },
        required: ['latitude', 'longitude'],
        additionalProperties: false
      },

      set_timezone: {
        type: 'object',
        properties: {
          timezoneId: { type: 'string', maxLength: 100 }
        },
        required: ['timezoneId'],
        additionalProperties: false
      },

      set_locale: {
        type: 'object',
        properties: {
          locale: { type: 'string', maxLength: 20 }
        },
        required: ['locale'],
        additionalProperties: false
      },

      // Storage
      set_local_storage: {
        type: 'object',
        properties: {
          key: { type: 'string', maxLength: 10000 },
          value: { type: 'string', maxLength: 10000 }
        },
        required: ['key', 'value'],
        additionalProperties: false
      },

      get_local_storage: {
        type: 'object',
        properties: {
          key: { type: 'string', maxLength: 10000 }
        },
        additionalProperties: false
      },

      delete_local_storage: {
        type: 'object',
        properties: {
          key: { type: 'string', maxLength: 10000 }
        },
        required: ['key'],
        additionalProperties: false
      },

      // Default empty schema for commands with no parameters
      default: {
        type: 'object',
        additionalProperties: false
      }
    };
  }

  /**
   * Compile all validators
   * @private
   */
  _compileValidators() {
    const validators = {};
    for (const [cmd, schema] of Object.entries(this.schemas)) {
      validators[cmd] = this.ajv.compile(schema);
    }
    return validators;
  }

  /**
   * Validate command parameters
   * @param {string} command - Command name
   * @param {Object} params - Parameters to validate
   * @returns {Object} { valid: boolean, error?: string, data?: Object, errors?: Array }
   */
  validate(command, params = {}) {
    const validator = this.validators[command] || this.validators.default;

    if (!validator) {
      return {
        valid: false,
        error: `No validator defined for command: ${command}`
      };
    }

    const valid = validator(params);

    if (!valid) {
      const errors = validator.errors || [];
      const formattedErrors = errors.map(err => {
        const path = err.instancePath || '/';
        const keyword = err.keyword;
        const message = err.message;
        return `${path} ${keyword}: ${message}`;
      });

      return {
        valid: false,
        error: `Validation failed: ${formattedErrors.join('; ')}`,
        errors: formattedErrors,
        rawErrors: errors
      };
    }

    return {
      valid: true,
      data: params
    };
  }

  /**
   * Get schema for a command
   * @param {string} command - Command name
   * @returns {Object} JSON schema or null
   */
  getSchema(command) {
    return this.schemas[command] || null;
  }

  /**
   * Validate multiple commands at once
   * @param {Array} commands - Array of { command, params }
   * @returns {Array} Results array
   */
  validateBatch(commands) {
    return commands.map(({ command, params }) =>
      this.validate(command, params)
    );
  }

  /**
   * Add custom schema for a command
   * @param {string} command - Command name
   * @param {Object} schema - JSON schema definition
   */
  addSchema(command, schema) {
    this.schemas[command] = schema;
    this.validators[command] = this.ajv.compile(schema);
  }

  /**
   * Get validator statistics
   * @returns {Object} Stats
   */
  getStats() {
    return {
      totalSchemas: Object.keys(this.schemas).length,
      totalValidators: Object.keys(this.validators).length
    };
  }
}

module.exports = { SchemaValidator };
