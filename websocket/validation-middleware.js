/**
 * WebSocket Validation Middleware
 *
 * Middleware for integrating command schema validation into the WebSocket server.
 * Validates incoming requests before passing to command handlers.
 *
 * Usage in server.js:
 * ```javascript
 * const { createValidationMiddleware } = require('./validation-middleware');
 * const validator = createValidationMiddleware({ logger });
 *
 * // In message handler:
 * const validationResult = validator.validateRequest(data);
 * if (!validationResult.valid) {
 *   return ws.send(JSON.stringify({
 *     id: data.id,
 *     success: false,
 *     error: 'INVALID_PARAMETERS',
 *     details: validationResult.errors,
 *     message: validationResult.message
 *   }));
 * }
 * ```
 *
 * @module websocket/validation-middleware
 */

const { CommandValidator } = require('./command-validator');
const { getSchema } = require('./command-schemas');

/**
 * Create a validation middleware instance
 * @param {Object} options - Configuration options
 * @param {Object} options.logger - Logger instance
 * @param {boolean} options.strict - Whether to reject unknown parameters
 * @param {boolean} options.logValidationErrors - Log validation errors
 * @returns {Object} Validator middleware
 */
function createValidationMiddleware(options = {}) {
  const {
    logger = console,
    strict = false,
    logValidationErrors = true
  } = options;

  const validator = new CommandValidator({
    logger,
    strict
  });

  return {
    /**
     * Validate an incoming WebSocket request
     * @param {Object} data - The parsed message data
     * @returns {Object} Validation result with standard error format
     */
    validateRequest(data) {
      if (!data || typeof data !== 'object') {
        return {
          valid: false,
          error: 'INVALID_MESSAGE_FORMAT',
          message: 'Message must be a valid JSON object',
          errorType: 'validation'
        };
      }

      const { command, id, ...params } = data;

      if (!command || typeof command !== 'string') {
        return {
          valid: false,
          error: 'MISSING_COMMAND',
          message: 'Message must include a "command" field',
          errorType: 'validation',
          id: id || null
        };
      }

      // Run JSON Schema validation
      const validationResult = validator.validate(command, params);

      if (!validationResult.valid) {
        if (logValidationErrors) {
          logger.warn(`[Validator] ${command}: ${validationResult.errors.length} validation error(s)`, {
            command,
            errors: validationResult.errors.slice(0, 3) // Log first 3 errors
          });
        }

        return {
          valid: false,
          error: 'INVALID_PARAMETERS',
          errorType: 'validation',
          message: `Invalid parameters for command "${command}"`,
          command,
          id: id || null,
          details: {
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            errorCount: validationResult.errors.length,
            errorSummary: validationResult.errors
              .slice(0, 3)
              .map(e => `${e.field ? e.field + ': ' : ''}${e.message}`)
              .join('; ')
          }
        };
      }

      // Log warnings
      if (validationResult.warnings.length > 0) {
        logger.debug(`[Validator] ${command}: ${validationResult.warnings.length} warning(s)`, {
          command,
          warnings: validationResult.warnings.slice(0, 3)
        });
      }

      return {
        valid: true,
        command,
        params,
        id: id || null,
        warnings: validationResult.warnings
      };
    },

    /**
     * Create an error response for validation failure
     * @param {Object} validationResult - Result from validateRequest()
     * @returns {Object} Standard error response object
     */
    createErrorResponse(validationResult) {
      const response = {
        success: false,
        error: validationResult.error,
        message: validationResult.message
      };

      if (validationResult.id) {
        response.id = validationResult.id;
      }

      if (validationResult.details) {
        // Include first 3 errors with details
        response.details = {
          errors: validationResult.details.errors.slice(0, 3),
          errorCount: validationResult.details.errorCount,
          errorSummary: validationResult.details.errorSummary
        };

        // Add helpful hints
        if (validationResult.details.errors.length > 0) {
          const firstError = validationResult.details.errors[0];
          response.hint = firstError.suggestion || 'Check the command documentation';

          // Add example if available
          if (firstError.example !== undefined) {
            response.example = firstError.example;
          }
        }
      }

      return response;
    },

    /**
     * Get validation report for debugging
     * @param {string} command - Command name
     * @param {Object} params - Parameters received
     * @returns {Object} Detailed validation report
     */
    getValidationReport(command, params) {
      const validationResult = validator.validate(command, params);
      return validator.getDetailedReport(validationResult);
    },

    /**
     * Get schema for a command
     * @param {string} command - Command name
     * @returns {Object|null} Command schema
     */
    getCommandSchema(command) {
      return getSchema(command);
    },

    /**
     * Validate and get formatted error message
     * @param {string} command - Command name
     * @param {Object} params - Parameters to validate
     * @returns {Object} Formatted error response or null if valid
     */
    validateAndFormatError(command, params) {
      const validationResult = validator.validate(command, params);
      if (!validationResult.valid) {
        return {
          error: 'INVALID_PARAMETERS',
          message: validator.formatErrors(validationResult),
          details: validator.getDetailedReport(validationResult)
        };
      }
      return null;
    }
  };
}

/**
 * Create a validation middleware factory with pre-configured validator
 * Useful for testing and standalone validation
 */
function createStandaloneValidator(options = {}) {
  return new CommandValidator(options);
}

module.exports = {
  createValidationMiddleware,
  createStandaloneValidator,
  CommandValidator
};
