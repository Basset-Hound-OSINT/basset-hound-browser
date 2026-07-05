/**
 * JSON Schema Validator for WebSocket Commands
 *
 * Validates incoming command requests against their JSON Schema definitions.
 * Provides:
 * - Parameter type validation
 * - Required field checking
 * - Pattern/format validation
 * - Range validation (min/max)
 * - Helpful error messages with recovery suggestions
 * - Field-level validation details
 *
 * @module websocket/command-validator
 */

const { getSchema, getAllCommandNames } = require('./command-schemas');

/**
 * Validation error with field-level details
 */
class ValidationError extends Error {
  constructor(message, field = null, expectedType = null, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.expectedType = expectedType;
    this.details = details;
  }
}

/**
 * Validates command parameters against JSON Schema
 */
class CommandValidator {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.strict = options.strict !== false; // Default: strict mode on
    this.maxErrors = options.maxErrors || 5; // Return first N errors
  }

  /**
   * Validate a command and its parameters
   *
   * @param {string} command - The command name
   * @param {Object} params - The parameters object
   * @returns {Object} Validation result { valid: boolean, errors?: Array, warnings?: Array }
   */
  validate(command, params = {}) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      command,
      paramsReceived: params
    };

    // Check if command schema exists
    const schema = getSchema(command);
    if (!schema) {
      result.valid = false;
      result.errors.push({
        level: 'error',
        type: 'UNKNOWN_COMMAND',
        message: `Unknown command: "${command}"`,
        suggestion: this._getSuggestion('unknown_command', command),
        availableCommands: getAllCommandNames().slice(0, 10)
      });
      return result;
    }

    // Normalize params to object
    if (params === null || params === undefined) {
      params = {};
    }
    if (typeof params !== 'object' || Array.isArray(params)) {
      result.valid = false;
      result.errors.push({
        level: 'error',
        type: 'INVALID_PARAMS_TYPE',
        message: 'Parameters must be a JSON object',
        suggestion: 'Wrap your parameters in curly braces: { "field": "value" }',
        received: typeof params
      });
      return result;
    }

    // Validate required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (!(requiredField in params)) {
          result.valid = false;
          result.errors.push(this._createFieldError(
            requiredField,
            'MISSING_REQUIRED_FIELD',
            `Missing required parameter: "${requiredField}"`,
            schema.properties[requiredField],
            params
          ));

          // Stop after max errors
          if (result.errors.length >= this.maxErrors) {
            break;
          }
        }
      }
    }

    // Validate each provided parameter
    for (const [field, value] of Object.entries(params)) {
      // Skip if we already have max errors
      if (result.errors.length >= this.maxErrors) {
        break;
      }

      const fieldSchema = schema.properties ? schema.properties[field] : null;

      // Check if field is defined in schema
      if (!fieldSchema) {
        result.warnings.push({
          level: 'warning',
          type: 'UNKNOWN_FIELD',
          field,
          message: `Unknown parameter: "${field}"`,
          suggestion: 'This parameter may not be recognized. Check the command documentation.',
          suggestedFields: this._findSimilarFields(field, schema.properties)
        });
        continue;
      }

      // Validate field value
      const fieldValidation = this._validateField(field, value, fieldSchema);
      if (!fieldValidation.valid) {
        result.valid = false;
        fieldValidation.errors.forEach(err => {
          result.errors.push(err);
          if (result.errors.length >= this.maxErrors) {
            return; // Stop collecting errors
          }
        });
      }
    }

    return result;
  }

  /**
   * Validate a single field against its schema
   * @private
   */
  _validateField(field, value, fieldSchema) {
    const result = { valid: true, errors: [] };

    // Type validation
    if (fieldSchema.type) {
      const typeError = this._validateType(field, value, fieldSchema.type);
      if (typeError) {
        result.valid = false;
        result.errors.push(typeError);
        return result; // Stop further validation if type is wrong
      }
    }

    // Null/undefined checks
    if (value === null || value === undefined) {
      if (fieldSchema.required === true || fieldSchema.type === 'string' && fieldSchema.minLength) {
        result.valid = false;
        result.errors.push({
          level: 'error',
          type: 'INVALID_VALUE',
          field,
          message: `Parameter "${field}" cannot be null or undefined`,
          suggestion: `Provide a valid ${fieldSchema.type} value`,
          expectedType: fieldSchema.type
        });
      }
      return result;
    }

    // String validations
    if (typeof value === 'string') {
      // Pattern validation
      if (fieldSchema.pattern) {
        const pattern = new RegExp(fieldSchema.pattern);
        if (!pattern.test(value)) {
          result.valid = false;
          result.errors.push({
            level: 'error',
            type: 'INVALID_FORMAT',
            field,
            message: `Parameter "${field}" does not match required format: ${fieldSchema.pattern}`,
            suggestion: fieldSchema.example
              ? `Example: "${fieldSchema.example}"`
              : `Use format matching: ${fieldSchema.pattern}`,
            received: value
          });
        }
      }

      // Length validation
      if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
        result.valid = false;
        result.errors.push({
          level: 'error',
          type: 'TOO_SHORT',
          field,
          message: `Parameter "${field}" is too short (minimum ${fieldSchema.minLength} characters)`,
          suggestion: `Provide at least ${fieldSchema.minLength} characters`,
          received: value.length,
          expected: fieldSchema.minLength
        });
      }

      if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
        result.valid = false;
        result.errors.push({
          level: 'error',
          type: 'TOO_LONG',
          field,
          message: `Parameter "${field}" is too long (maximum ${fieldSchema.maxLength} characters)`,
          suggestion: `Keep length under ${fieldSchema.maxLength} characters`,
          received: value.length,
          expected: fieldSchema.maxLength
        });
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
        result.valid = false;
        result.errors.push({
          level: 'error',
          type: 'TOO_SMALL',
          field,
          message: `Parameter "${field}" is too small (minimum ${fieldSchema.minimum})`,
          suggestion: `Use a value >= ${fieldSchema.minimum}`,
          received: value,
          expected: fieldSchema.minimum
        });
      }

      if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
        result.valid = false;
        result.errors.push({
          level: 'error',
          type: 'TOO_LARGE',
          field,
          message: `Parameter "${field}" is too large (maximum ${fieldSchema.maximum})`,
          suggestion: `Use a value <= ${fieldSchema.maximum}`,
          received: value,
          expected: fieldSchema.maximum
        });
      }
    }

    // Enum validation
    if (fieldSchema.enum && Array.isArray(fieldSchema.enum)) {
      if (!fieldSchema.enum.includes(value)) {
        result.valid = false;
        result.errors.push({
          level: 'error',
          type: 'INVALID_ENUM',
          field,
          message: `Parameter "${field}" must be one of: ${fieldSchema.enum.join(', ')}`,
          suggestion: `Use one of these values: ${fieldSchema.enum.join(', ')}`,
          received: value,
          allowed: fieldSchema.enum
        });
      }
    }

    // Array validation
    if (Array.isArray(value) && fieldSchema.type === 'array') {
      if (fieldSchema.items) {
        for (let i = 0; i < value.length; i++) {
          const itemError = this._validateType(`${field}[${i}]`, value[i], fieldSchema.items.type);
          if (itemError) {
            result.valid = false;
            result.errors.push(itemError);
            break;
          }
        }
      }
    }

    return result;
  }

  /**
   * Validate parameter type
   * @private
   */
  _validateType(field, value, expectedType) {
    let actualType = typeof value;

    // Special case for null
    if (value === null) {
      actualType = 'null';
    } else if (Array.isArray(value)) {
      actualType = 'array';
    }

    if (actualType !== expectedType) {
      return {
        level: 'error',
        type: 'TYPE_MISMATCH',
        field,
        message: `Parameter "${field}" must be a ${expectedType}, got ${actualType}`,
        suggestion: `Convert the value to ${expectedType} type`,
        expectedType,
        receivedType: actualType,
        received: value
      };
    }

    return null;
  }

  /**
   * Create a standardized field error
   * @private
   */
  _createFieldError(field, errorType, message, fieldSchema, params) {
    const error = {
      level: 'error',
      type: errorType,
      field,
      message,
      suggestion: this._getSuggestion(errorType, field, fieldSchema),
      expectedType: fieldSchema ? fieldSchema.type : 'unknown'
    };

    if (fieldSchema && fieldSchema.example) {
      error.example = fieldSchema.example;
    }

    if (fieldSchema && fieldSchema.description) {
      error.description = fieldSchema.description;
    }

    return error;
  }

  /**
   * Generate helpful suggestion based on error type
   * @private
   */
  _getSuggestion(errorType, field, fieldSchema = null) {
    switch (errorType) {
      case 'MISSING_REQUIRED_FIELD':
        if (fieldSchema && fieldSchema.example) {
          return `Add "${field}" to your request. Example: { "${field}": ${JSON.stringify(fieldSchema.example)} }`;
        }
        return `Add the required parameter "${field}" to your request`;

      case 'TYPE_MISMATCH':
        if (fieldSchema) {
          return `Ensure "${field}" is a ${fieldSchema.type}`;
        }
        return `Fix the type of parameter "${field}"`;

      case 'INVALID_FORMAT':
        return `Check the format of "${field}" - it may need to be a URL, email, or follow a specific pattern`;

      case 'INVALID_ENUM':
        return `Choose an allowed value for "${field}" from the list provided`;

      case 'UNKNOWN_COMMAND':
        return `Check the command name spelling or use the "status" command to see available commands`;

      case 'INVALID_PARAMS_TYPE':
        return `Wrap parameters in curly braces: { "param": "value" }`;

      default:
        return 'Check the command documentation for correct parameter usage';
    }
  }

  /**
   * Find similar field names (for typo suggestions)
   * @private
   */
  _findSimilarFields(field, schemaProperties = {}) {
    if (!schemaProperties) return [];

    const allFields = Object.keys(schemaProperties);
    const similar = [];

    for (const schemaField of allFields) {
      // Simple similarity check (Levenshtein-like)
      const similarity = this._stringSimilarity(field.toLowerCase(), schemaField.toLowerCase());
      if (similarity > 0.6) { // 60% match threshold
        similar.push({
          field: schemaField,
          similarity: Math.round(similarity * 100)
        });
      }
    }

    return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  }

  /**
   * Simple string similarity function (0-1)
   * @private
   */
  _stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this._levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @private
   */
  _levenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Format validation errors into a user-friendly message
   * @param {Object} validationResult - Result from validate()
   * @returns {string} Formatted error message
   */
  formatErrors(validationResult) {
    const { command, errors, warnings } = validationResult;
    const lines = [];

    lines.push(`Validation failed for command "${command}":`);
    lines.push('');

    if (errors.length > 0) {
      lines.push('ERRORS:');
      errors.forEach((error, index) => {
        lines.push(`${index + 1}. ${error.message}`);
        if (error.suggestion) {
          lines.push(`   Suggestion: ${error.suggestion}`);
        }
        if (error.example) {
          lines.push(`   Example: ${error.example}`);
        }
        if (error.allowed) {
          lines.push(`   Allowed values: ${error.allowed.join(', ')}`);
        }
      });
      lines.push('');
    }

    if (warnings.length > 0 && warnings.length <= 5) {
      lines.push('WARNINGS:');
      warnings.forEach((warning, index) => {
        lines.push(`${index + 1}. ${warning.message}`);
        if (warning.suggestedFields && warning.suggestedFields.length > 0) {
          lines.push(`   Did you mean: ${warning.suggestedFields.map(f => f.field).join(', ')}?`);
        }
      });
    }

    return lines.join('\n');
  }

  /**
   * Get detailed validation report
   * @param {Object} validationResult - Result from validate()
   * @returns {Object} Detailed report object
   */
  getDetailedReport(validationResult) {
    const { command, errors, warnings, paramsReceived } = validationResult;
    const schema = getSchema(command);

    return {
      summary: {
        command,
        valid: validationResult.valid,
        errorCount: errors.length,
        warningCount: warnings.length,
        parametersReceived: Object.keys(paramsReceived).length
      },
      errors: errors.map(err => ({
        field: err.field,
        type: err.type,
        message: err.message,
        suggestion: err.suggestion,
        details: {
          received: err.received,
          expected: err.expected || err.expectedType,
          allowed: err.allowed
        }
      })),
      warnings: warnings.map(w => ({
        field: w.field,
        message: w.message,
        suggestion: w.suggestion
      })),
      schema: schema ? {
        command: schema.command,
        description: schema.description,
        required: schema.required,
        properties: Object.entries(schema.properties || {}).reduce((acc, [key, val]) => {
          acc[key] = {
            type: val.type,
            description: val.description,
            example: val.example,
            default: val.default
          };
          return acc;
        }, {})
      } : null
    };
  }
}

module.exports = {
  CommandValidator,
  ValidationError
};
