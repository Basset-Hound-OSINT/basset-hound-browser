/**
 * WebSocket Server Integration Example
 *
 * This file shows exactly how to integrate the validation middleware into server.js
 * Copy the relevant sections into your actual server.js file.
 *
 * @file websocket/server-integration-example.js
 */

// ============================================================================
// STEP 1: Add Import at Top of server.js
// ============================================================================

// Near the top of server.js, after other require statements, add:
const { createValidationMiddleware } = require('./validation-middleware');

// ============================================================================
// STEP 2: Initialize Validation Middleware in Constructor
// ============================================================================

// In WebSocketServer constructor, after other initializations, add:

class WebSocketServer {
  constructor(options = {}) {
    // ... existing code ...

    // Initialize command validation middleware
    this.validationMiddleware = createValidationMiddleware({
      logger: this.logger || console,
      strict: false, // Set to true to reject unknown parameters
      logValidationErrors: true // Log validation errors for debugging
    });

    // ... rest of constructor ...
  }

  // ========================================================================
  // STEP 3: Update Message Handler with Validation
  // ========================================================================

  setupWebSocketServer() {
    this.wss.on('connection', (ws, upgradeRequest, remoteAddress) => {
      // ... existing connection setup code ...

      ws.on('message', async (message) => {
        let data;

        // Parse JSON message
        try {
          data = JSON.parse(message);
        } catch (e) {
          return ws.send(JSON.stringify({
            success: false,
            error: 'INVALID_JSON',
            message: 'Request must be valid JSON'
          }));
        }

        // ====== NEW: VALIDATION STEP (Insert Here) ======
        // Validate the request against command schema
        const validationResult = this.validationMiddleware.validateRequest(data);

        // If validation failed, send error response immediately
        if (!validationResult.valid) {
          return ws.send(JSON.stringify(
            this.validationMiddleware.createErrorResponse(validationResult)
          ));
        }
        // ===============================================

        // Extract validated command, id, and params
        const { command, params, id } = validationResult;

        // Create client ID for tracking
        const clientId = `ws-${Math.random().toString(36).substr(2, 9)}`;

        try {
          // Execute the command with validated parameters
          const result = await dispatcher.execute(
            command,
            params, // Now guaranteed to be valid!
            {
              enableRetry: true,
              maxRetries: 3,
              clientId: clientId,
              commandId: id,
              upgradeRequest,
              remoteAddress
            }
          );

          // Send success or error response
          ws.send(JSON.stringify({
            id,
            success: result.success,
            ...(result.success ? { result: result.result } : { error: result.error })
          }));
        } catch (error) {
          // Unexpected error during command execution
          ws.send(JSON.stringify({
            id,
            success: false,
            error: 'COMMAND_EXECUTION_ERROR',
            message: error.message
          }));
        }
      });

      // ... rest of connection setup ...
    });
  }
}

// ============================================================================
// EXAMPLE: What Validation Catches
// ============================================================================

/**
 * EXAMPLE 1: Missing Required Parameter
 *
 * Invalid Request:
 * {
 *   "id": "123",
 *   "command": "navigate",
 *   "timeout": 30000
 * }
 *
 * What happens:
 * 1. validationMiddleware.validateRequest(data) is called
 * 2. Validation fails because 'url' (required) is missing
 * 3. validationMiddleware.createErrorResponse() formats the error
 * 4. Error is sent immediately - command handler never runs
 *
 * Response:
 * {
 *   "success": false,
 *   "error": "INVALID_PARAMETERS",
 *   "message": "Invalid parameters for command 'navigate'",
 *   "id": "123",
 *   "hint": "Add the required parameter 'url' to your request",
 *   "details": {
 *     "errors": [{
 *       "field": "url",
 *       "type": "MISSING_REQUIRED_FIELD",
 *       "message": "Missing required parameter: 'url'",
 *       "suggestion": "Add 'url' to your request. Example: { 'url': 'https://example.com' }"
 *     }],
 *     "errorCount": 1,
 *     "errorSummary": "url: Missing required parameter: 'url'"
 *   }
 * }
 */

/**
 * EXAMPLE 2: Invalid Parameter Type
 *
 * Invalid Request:
 * {
 *   "id": "456",
 *   "command": "screenshot",
 *   "quality": "very-high"
 * }
 *
 * What happens:
 * 1. validationMiddleware.validateRequest(data) is called
 * 2. Validation fails because quality should be number, not string
 * 3. Error response is sent immediately
 *
 * Response:
 * {
 *   "success": false,
 *   "error": "INVALID_PARAMETERS",
 *   "message": "Invalid parameters for command 'screenshot'",
 *   "id": "456",
 *   "hint": "Ensure 'quality' is a number",
 *   "details": {
 *     "errors": [{
 *       "field": "quality",
 *       "type": "TYPE_MISMATCH",
 *       "message": "Parameter 'quality' must be a number, got string",
 *       "suggestion": "Convert the value to number type",
 *       "expectedType": "number",
 *       "receivedType": "string"
 *     }],
 *     "errorCount": 1
 *   }
 * }
 */

/**
 * EXAMPLE 3: Value Out of Range
 *
 * Invalid Request:
 * {
 *   "id": "789",
 *   "command": "setProxy",
 *   "host": "proxy.example.com",
 *   "port": 99999
 * }
 *
 * What happens:
 * 1. validationMiddleware.validateRequest(data) is called
 * 2. Validation fails because port exceeds maximum (65535)
 * 3. Error response is sent immediately
 *
 * Response:
 * {
 *   "success": false,
 *   "error": "INVALID_PARAMETERS",
 *   "message": "Invalid parameters for command 'setProxy'",
 *   "id": "789",
 *   "hint": "Use a value <= 65535",
 *   "details": {
 *     "errors": [{
 *       "field": "port",
 *       "type": "TOO_LARGE",
 *       "message": "Parameter 'port' is too large (maximum 65535)",
 *       "received": 99999,
 *       "expected": 65535,
 *       "suggestion": "Use a value <= 65535"
 *     }],
 *     "errorCount": 1
 *   }
 * }
 */

/**
 * EXAMPLE 4: Invalid Enum Value
 *
 * Invalid Request:
 * {
 *   "id": "999",
 *   "command": "click",
 *   "selector": "button",
 *   "button": "double-click"
 * }
 *
 * What happens:
 * 1. validationMiddleware.validateRequest(data) is called
 * 2. Validation fails because button value not in allowed list
 * 3. Error response with allowed values is sent
 *
 * Response:
 * {
 *   "success": false,
 *   "error": "INVALID_PARAMETERS",
 *   "message": "Invalid parameters for command 'click'",
 *   "id": "999",
 *   "hint": "Use one of these values: left, right, middle",
 *   "details": {
 *     "errors": [{
 *       "field": "button",
 *       "type": "INVALID_ENUM",
 *       "message": "Parameter 'button' must be one of: left, right, middle",
 *       "allowed": ["left", "right", "middle"],
 *       "suggestion": "Use one of these values: left, right, middle"
 *     }],
 *     "errorCount": 1
 *   }
 * }
 */

/**
 * EXAMPLE 5: Valid Request (Passes Validation)
 *
 * Valid Request:
 * {
 *   "id": "111",
 *   "command": "navigate",
 *   "url": "https://example.com",
 *   "timeout": 30000
 * }
 *
 * What happens:
 * 1. validationMiddleware.validateRequest(data) is called
 * 2. Validation succeeds - all parameters valid
 * 3. validationResult.valid === true
 * 4. Command handler (dispatcher.execute) is called with validated params
 * 5. Normal command execution proceeds
 *
 * Response (from command handler):
 * {
 *   "id": "111",
 *   "success": true,
 *   "result": {
 *     "url": "https://example.com",
 *     "title": "Example Domain",
 *     "timestamp": 1624233600000
 *   }
 * }
 */

// ============================================================================
// CONFIGURATION OPTIONS
// ============================================================================

/**
 * When creating the validation middleware, you can configure:
 *
 * logger: Object
 *   - Logger instance for debug and warning logs
 *   - Default: console
 *   - Example: this.logger || console
 *
 * strict: Boolean
 *   - If true, rejects requests with unknown parameters
 *   - If false (default), logs warnings but allows unknown parameters
 *   - Default: false
 *   - Recommended: false (more forgiving to clients)
 *
 * logValidationErrors: Boolean
 *   - If true, logs validation errors for debugging
 *   - If false, silently rejects invalid requests
 *   - Default: true
 *   - Recommended: true (helps debugging)
 */

// ============================================================================
// TESTING INTEGRATION
// ============================================================================

/**
 * To test the integration, send WebSocket messages like:
 *
 * Valid:
 * { "id": "1", "command": "navigate", "url": "https://example.com" }
 *
 * Invalid (will get validation error):
 * { "id": "2", "command": "navigate" }
 *
 * With curl:
 * curl -N -H "Content-Type: application/json" \
 *   -d '{"id":"1","command":"navigate","url":"https://example.com"}' \
 *   ws://localhost:8765
 *
 * With Node.js:
 * const ws = require('ws');
 * const client = new ws('ws://localhost:8765');
 * client.on('open', () => {
 *   client.send(JSON.stringify({
 *     id: '1',
 *     command: 'navigate',
 *     url: 'https://example.com'
 *   }));
 * });
 * client.on('message', (data) => {
 *   console.log(JSON.parse(data));
 * });
 */

module.exports = {
  // Export for reference only - actual integration should be in server.js
};
