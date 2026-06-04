/**
 * Schema Validator
 * JSON Schema validation with custom validators and optimized performance
 */

const EventEmitter = require('events');

class SchemaValidator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.schemas = new Map();
    this.customValidators = new Map();
    this.validationCache = options.enableCache ? new Map() : null;
    this.errorMessages = new Map();
    this.metrics = {
      validationsRun: 0,
      validationsPassed: 0,
      validationsFailed: 0,
      cacheHits: 0,
    };

    this._registerDefaultValidators();
  }

  /**
   * Register a schema
   */
  registerSchema(schemaName, schema) {
    this.schemas.set(schemaName, schema);
    this.emit('schema_registered', { schema: schemaName });
  }

  /**
   * Register a custom validator
   */
  registerValidator(validatorName, validatorFunction) {
    this.customValidators.set(validatorName, validatorFunction);
    this.emit('validator_registered', { validator: validatorName });
  }

  /**
   * Register custom error message
   */
  registerErrorMessage(validatorName, message) {
    this.errorMessages.set(validatorName, message);
  }

  /**
   * Validate data against a schema
   */
  async validate(data, schemaName) {
    this.metrics.validationsRun++;

    // Check cache
    if (this.validationCache) {
      const cacheKey = this._getCacheKey(data, schemaName);
      if (this.validationCache.has(cacheKey)) {
        this.metrics.cacheHits++;
        const cached = this.validationCache.get(cacheKey);
        if (cached.valid) {
          this.metrics.validationsPassed++;
        } else {
          this.metrics.validationsFailed++;
        }
        return cached;
      }
    }

    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Schema not found: ${schemaName}`);
    }

    const errors = [];
    const warnings = [];

    // Validate against schema
    const schemaErrors = await this._validateAgainstSchema(data, schema);
    errors.push(...schemaErrors);

    const result = {
      valid: errors.length === 0,
      errors,
      warnings,
      data,
      schema: schemaName,
    };

    // Cache result
    if (this.validationCache) {
      this._cacheResult(data, schemaName, result);
    }

    if (result.valid) {
      this.metrics.validationsPassed++;
    } else {
      this.metrics.validationsFailed++;
    }

    this.emit('validation_completed', {
      schema: schemaName,
      valid: result.valid,
      errorCount: errors.length,
    });

    return result;
  }

  /**
   * Validate data inline (throws on error)
   */
  async validateOrThrow(data, schemaName) {
    const result = await this.validate(data, schemaName);
    if (!result.valid) {
      const errorMessages = result.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
    return result;
  }

  /**
   * Validate multiple items
   */
  async validateBatch(items, schemaName) {
    const results = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const result = await this.validate(items[i], schemaName);
        results.push(result);
        if (!result.valid) {
          errors.push({ index: i, errors: result.errors });
        }
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    return {
      results,
      errors,
      validCount: results.filter((r) => r.valid).length,
      invalidCount: results.filter((r) => !r.valid).length,
    };
  }

  /**
   * Get validation suggestions for failed validation
   */
  getSuggestions(validationResult) {
    const suggestions = [];

    for (const error of validationResult.errors) {
      const suggestion = {
        path: error.path,
        issue: error.message,
        suggestion: null,
      };

      // Generate suggestions based on error type
      if (error.type === 'type_mismatch') {
        suggestion.suggestion = `Expected ${error.expectedType}, but got ${typeof validationResult.data}`;
      } else if (error.type === 'required_field') {
        suggestion.suggestion = `This field is required. Please provide a value.`;
      } else if (error.type === 'pattern_mismatch') {
        suggestion.suggestion = `Value does not match the required pattern: ${error.pattern}`;
      } else if (error.type === 'range_error') {
        suggestion.suggestion = `Value must be between ${error.min} and ${error.max}`;
      }

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * List all registered schemas
   */
  listSchemas() {
    return Array.from(this.schemas.keys());
  }

  /**
   * Get schema definition
   */
  getSchema(schemaName) {
    return this.schemas.get(schemaName);
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    if (this.validationCache) {
      this.validationCache.clear();
    }
  }

  /**
   * Get validation metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.validationsRun > 0
        ? ((this.metrics.validationsPassed / this.metrics.validationsRun) * 100).toFixed(2) + '%'
        : 'N/A',
      cacheSize: this.validationCache ? this.validationCache.size : 0,
    };
  }

  // ==================== Private Methods ====================

  async _validateAgainstSchema(data, schema) {
    const errors = [];

    // Validate properties
    if (schema.properties) {
      for (const [property, propertySchema] of Object.entries(schema.properties)) {
        const value = data[property];

        // Check required
        if (propertySchema.required && (value === undefined || value === null)) {
          errors.push({
            path: property,
            message: `${property} is required`,
            type: 'required_field',
          });
          continue;
        }

        if (value === undefined || value === null) {
          continue;
        }

        // Type validation
        if (propertySchema.type && !this._validateType(value, propertySchema.type)) {
          errors.push({
            path: property,
            message: `Expected ${propertySchema.type}`,
            type: 'type_mismatch',
            expectedType: propertySchema.type,
          });
          continue;
        }

        // Pattern validation
        if (propertySchema.pattern && typeof value === 'string') {
          const regex = new RegExp(propertySchema.pattern);
          if (!regex.test(value)) {
            errors.push({
              path: property,
              message: `Pattern mismatch`,
              type: 'pattern_mismatch',
              pattern: propertySchema.pattern,
            });
          }
        }

        // Min/Max validation
        if (propertySchema.type === 'number' || propertySchema.type === 'integer') {
          if (propertySchema.minimum !== undefined && value < propertySchema.minimum) {
            errors.push({
              path: property,
              message: `Must be >= ${propertySchema.minimum}`,
              type: 'range_error',
              min: propertySchema.minimum,
              max: propertySchema.maximum,
            });
          }
          if (propertySchema.maximum !== undefined && value > propertySchema.maximum) {
            errors.push({
              path: property,
              message: `Must be <= ${propertySchema.maximum}`,
              type: 'range_error',
              min: propertySchema.minimum,
              max: propertySchema.maximum,
            });
          }
        }

        // Length validation for strings/arrays
        if (
          (propertySchema.type === 'string' || propertySchema.type === 'array') &&
          value !== null
        ) {
          const length = propertySchema.type === 'string' ? value.length : value.length;
          if (propertySchema.minLength !== undefined && length < propertySchema.minLength) {
            errors.push({
              path: property,
              message: `Minimum length is ${propertySchema.minLength}`,
              type: 'length_error',
            });
          }
          if (propertySchema.maxLength !== undefined && length > propertySchema.maxLength) {
            errors.push({
              path: property,
              message: `Maximum length is ${propertySchema.maxLength}`,
              type: 'length_error',
            });
          }
        }

        // Custom validator
        if (propertySchema.validator) {
          const validator = this.customValidators.get(propertySchema.validator);
          if (validator) {
            const isValid = await validator(value);
            if (!isValid) {
              const message =
                this.errorMessages.get(propertySchema.validator) ||
                `Custom validation failed`;
              errors.push({
                path: property,
                message,
                type: 'custom_validation',
                validator: propertySchema.validator,
              });
            }
          }
        }

        // Nested object validation
        if (propertySchema.type === 'object' && propertySchema.properties) {
          const nestedErrors = await this._validateAgainstSchema(
            value,
            propertySchema
          );
          errors.push(
            ...nestedErrors.map((e) => ({
              ...e,
              path: `${property}.${e.path}`,
            }))
          );
        }

        // Array item validation
        if (propertySchema.type === 'array' && propertySchema.items && Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const itemErrors = await this._validateAgainstSchema(
              value[i],
              propertySchema.items
            );
            errors.push(
              ...itemErrors.map((e) => ({
                ...e,
                path: `${property}[${i}].${e.path}`,
              }))
            );
          }
        }
      }
    }

    // Validate additional properties
    if (schema.additionalProperties === false) {
      for (const property of Object.keys(data)) {
        if (!schema.properties || !schema.properties[property]) {
          errors.push({
            path: property,
            message: 'Additional properties are not allowed',
            type: 'additional_property',
          });
        }
      }
    }

    return errors;
  }

  _validateType(value, type) {
    if (type === 'string') return typeof value === 'string';
    if (type === 'number') return typeof value === 'number';
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'boolean') return typeof value === 'boolean';
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return typeof value === 'object' && !Array.isArray(value);
    if (type === 'null') return value === null;
    return true;
  }

  _registerDefaultValidators() {
    this.registerValidator('email', (value) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    });

    this.registerValidator('url', (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    });

    this.registerValidator('uuid', (value) => {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    });

    this.registerValidator('iso8601', (value) => {
      return !isNaN(Date.parse(value));
    });

    this.errorMessages.set('email', 'Invalid email address');
    this.errorMessages.set('url', 'Invalid URL');
    this.errorMessages.set('uuid', 'Invalid UUID');
    this.errorMessages.set('iso8601', 'Invalid ISO 8601 date');
  }

  _getCacheKey(data, schemaName) {
    const hash = require('crypto')
      .createHash('md5')
      .update(JSON.stringify(data) + schemaName)
      .digest('hex');
    return hash;
  }

  _cacheResult(data, schemaName, result) {
    const cacheKey = this._getCacheKey(data, schemaName);
    this.validationCache.set(cacheKey, result);

    // Limit cache size
    if (this.validationCache.size > 10000) {
      const firstKey = this.validationCache.keys().next().value;
      this.validationCache.delete(firstKey);
    }
  }
}

module.exports = SchemaValidator;
