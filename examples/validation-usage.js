/**
 * Practical Examples: Using the WebSocket Command Validation System
 *
 * This file demonstrates how to use the validation system in real scenarios:
 * 1. Validating commands before sending to WebSocket
 * 2. Handling validation error responses
 * 3. Building validated requests programmatically
 * 4. Checking command schema and documentation
 *
 * Usage: node examples/validation-usage.js
 *
 * @file examples/validation-usage.js
 */

const {
  CommandValidator,
  createValidationMiddleware
} = require('../websocket/command-validator');
const { getSchema, getAllCommandNames } = require('../websocket/command-schemas');

console.log('='.repeat(80));
console.log('WebSocket Command Validation - Practical Examples');
console.log('='.repeat(80));
console.log('');

// ============================================================================
// Example 1: Basic Validation Before Sending Request
// ============================================================================

console.log('EXAMPLE 1: Validate Request Before Sending');
console.log('-'.repeat(80));

const validator = new CommandValidator();

// Build a navigate request
const navigateRequest = {
  command: 'navigate',
  url: 'https://example.com',
  timeout: 30000
};

console.log('Request to send:', JSON.stringify(navigateRequest, null, 2));

// Validate before sending
const validationResult = validator.validate('navigate', {
  url: navigateRequest.url,
  timeout: navigateRequest.timeout
});

if (validationResult.valid) {
  console.log('✓ Request is valid - safe to send');
} else {
  console.log('✗ Request validation failed:');
  validationResult.errors.forEach((err, i) => {
    console.log(`  ${i + 1}. ${err.message}`);
    console.log(`     Suggestion: ${err.suggestion}`);
  });
}

// ============================================================================
// Example 2: Handling Invalid Parameters
// ============================================================================

console.log('\n');
console.log('EXAMPLE 2: Handling Invalid Parameters');
console.log('-'.repeat(80));

const invalidRequest = {
  command: 'click',
  button: 'middle-click' // Invalid - should be 'left', 'right', or 'middle'
  // Missing required 'selector'
};

console.log('Invalid request:', JSON.stringify(invalidRequest, null, 2));

const invalidResult = validator.validate('click', {
  button: invalidRequest.button
  // Note: selector is missing
});

if (!invalidResult.valid) {
  console.log('Validation errors found:');
  console.log(validator.formatErrors(invalidResult));
}

// ============================================================================
// Example 3: Building Request Programmatically with Validation
// ============================================================================

console.log('\n');
console.log('EXAMPLE 3: Building Request Programmatically');
console.log('-'.repeat(80));

function buildValidatedRequest(command, params = {}) {
  const result = validator.validate(command, params);

  if (!result.valid) {
    return {
      success: false,
      error: 'Validation failed',
      errors: result.errors.map(e => ({
        field: e.field,
        message: e.message,
        suggestion: e.suggestion
      }))
    };
  }

  return {
    success: true,
    request: {
      command,
      ...params
    }
  };
}

// Build a screenshot request
console.log('Building screenshot request...');
const screenshotParams = {
  quality: 90,
  format: 'png',
  fullPage: true
};

const screenshotRequest = buildValidatedRequest('screenshot', screenshotParams);
if (screenshotRequest.success) {
  console.log('✓ Screenshot request is valid:');
  console.log(JSON.stringify(screenshotRequest.request, null, 2));
} else {
  console.log('✗ Screenshot request validation failed:');
  console.log(screenshotRequest.errors);
}

// Try with invalid quality
console.log('\nBuilding screenshot with invalid quality...');
const invalidScreenshot = buildValidatedRequest('screenshot', {
  quality: 150 // Invalid - max is 100
});

if (!invalidScreenshot.success) {
  console.log('✗ Validation failed:');
  invalidScreenshot.errors.forEach(err => {
    console.log(`  - ${err.field}: ${err.message}`);
    console.log(`    Suggestion: ${err.suggestion}`);
  });
}

// ============================================================================
// Example 4: Handling Server Error Responses
// ============================================================================

console.log('\n');
console.log('EXAMPLE 4: Handling Server Validation Error Responses');
console.log('-'.repeat(80));

// Simulated server response for invalid parameters
const serverErrorResponse = {
  success: false,
  error: 'INVALID_PARAMETERS',
  message: "Invalid parameters for command 'navigate'",
  id: 'req-123',
  hint: "Add the required parameter 'url' to your request",
  details: {
    errors: [
      {
        field: 'url',
        type: 'MISSING_REQUIRED_FIELD',
        message: "Missing required parameter: 'url'",
        suggestion: "Add 'url' to your request. Example: { 'url': 'https://example.com' }",
        expectedType: 'string'
      }
    ],
    errorCount: 1,
    errorSummary: "url: Missing required parameter: 'url'"
  }
};

console.log('Simulated server error response:');
console.log(JSON.stringify(serverErrorResponse, null, 2));

// Process the error response
function handleValidationError(response) {
  console.log(`\nProcessing error: ${response.error}`);
  console.log(`Hint: ${response.hint}`);

  if (response.details && response.details.errors) {
    console.log('Detailed errors:');
    response.details.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.field || 'general'}: ${err.message}`);
      console.log(`     Type: ${err.type}`);
      console.log(`     Suggestion: ${err.suggestion}`);
      if (err.allowed) {
        console.log(`     Allowed values: ${err.allowed.join(', ')}`);
      }
    });
  }
}

handleValidationError(serverErrorResponse);

// ============================================================================
// Example 5: Checking Command Schema and Documentation
// ============================================================================

console.log('\n');
console.log('EXAMPLE 5: Getting Command Schema and Documentation');
console.log('-'.repeat(80));

function printCommandSchema(commandName) {
  const schema = getSchema(commandName);

  if (!schema) {
    console.log(`Command "${commandName}" not found`);
    return;
  }

  console.log(`Command: ${schema.command}`);
  console.log(`Description: ${schema.description}`);
  console.log(`Required parameters: ${schema.required.join(', ') || 'none'}`);

  if (schema.properties) {
    console.log('\nParameters:');
    Object.entries(schema.properties).forEach(([key, prop]) => {
      console.log(`  ${key}:`);
      console.log(`    - Type: ${prop.type}`);
      if (prop.description) console.log(`    - Description: ${prop.description}`);
      if (prop.enum) console.log(`    - Allowed: ${prop.enum.join(', ')}`);
      if (prop.default !== undefined) console.log(`    - Default: ${prop.default}`);
      if (prop.minimum !== undefined) console.log(`    - Minimum: ${prop.minimum}`);
      if (prop.maximum !== undefined) console.log(`    - Maximum: ${prop.maximum}`);
      if (prop.minLength !== undefined) console.log(`    - Min length: ${prop.minLength}`);
      if (prop.maxLength !== undefined) console.log(`    - Max length: ${prop.maxLength}`);
      if (prop.pattern) console.log(`    - Pattern: ${prop.pattern}`);
      if (prop.example !== undefined) console.log(`    - Example: ${prop.example}`);
    });
  }
}

// Print schema for setProxy command
printCommandSchema('setProxy');

// ============================================================================
// Example 6: Building a Request Helper Function
// ============================================================================

console.log('\n');
console.log('EXAMPLE 6: Request Builder Helper');
console.log('-'.repeat(80));

class RequestBuilder {
  constructor() {
    this.validator = new CommandValidator();
  }

  /**
   * Build and validate a request
   * @param {string} command - The command name
   * @param {Object} params - Command parameters
   * @returns {Object} { valid: boolean, request?: Object, errors?: Array }
   */
  build(command, params) {
    const validation = this.validator.validate(command, params);

    if (!validation.valid) {
      return {
        valid: false,
        errors: validation.errors.map(e => ({
          field: e.field,
          type: e.type,
          message: e.message,
          suggestion: e.suggestion,
          allowed: e.allowed
        }))
      };
    }

    return {
      valid: true,
      request: {
        command,
        ...params
      }
    };
  }

  /**
   * Get detailed info about a command
   */
  getCommandInfo(command) {
    const schema = getSchema(command);
    if (!schema) return null;

    return {
      name: schema.command,
      description: schema.description,
      required: schema.required,
      optional: Object.keys(schema.properties || {}).filter(
        key => !schema.required.includes(key)
      )
    };
  }

  /**
   * List all available commands
   */
  listCommands(filter = '') {
    const all = getAllCommandNames();
    if (!filter) return all;

    return all.filter(cmd => cmd.toLowerCase().includes(filter.toLowerCase()));
  }
}

// Use the request builder
const builder = new RequestBuilder();

console.log('Available commands containing "navigate":');
builder.listCommands('navigate').forEach(cmd => {
  console.log(`  - ${cmd}`);
});

console.log('\nBuilding a fill request using builder:');
const fillRequest = builder.build('fill', {
  selector: 'input[name="username"]',
  text: 'john_doe',
  delay: 75
});

if (fillRequest.valid) {
  console.log('✓ Valid request built:');
  console.log(JSON.stringify(fillRequest.request, null, 2));
} else {
  console.log('✗ Build failed:');
  fillRequest.errors.forEach(err => {
    console.log(`  - ${err.field}: ${err.message}`);
  });
}

console.log('\nGetting info about "setProxy" command:');
const proxyInfo = builder.getCommandInfo('setProxy');
if (proxyInfo) {
  console.log(`Name: ${proxyInfo.name}`);
  console.log(`Description: ${proxyInfo.description}`);
  console.log(`Required: ${proxyInfo.required.join(', ')}`);
  console.log(`Optional: ${proxyInfo.optional.join(', ')}`);
}

// ============================================================================
// Example 7: Validation Middleware for HTTP Endpoint
// ============================================================================

console.log('\n');
console.log('EXAMPLE 7: Validation Middleware for HTTP Endpoint');
console.log('-'.repeat(80));

// This shows how to use the middleware in an Express.js or similar HTTP endpoint

const middleware = createValidationMiddleware({
  logger: console,
  logValidationErrors: true
});

// Simulated HTTP request body
const httpRequestBody = {
  id: 'http-123',
  command: 'navigate',
  url: 'https://api.example.com/data'
};

console.log('HTTP request body:', JSON.stringify(httpRequestBody, null, 2));

// Validate using middleware
const validationResponse = middleware.validateRequest(httpRequestBody);

if (validationResponse.valid) {
  console.log('✓ Request passed validation');
  console.log(`  Command: ${validationResponse.command}`);
  console.log(`  Parameters: ${JSON.stringify(validationResponse.params)}`);
} else {
  console.log('✗ Request failed validation');

  // Create error response to send back
  const errorResponse = middleware.createErrorResponse(validationResponse);
  console.log('Error response to send:');
  console.log(JSON.stringify(errorResponse, null, 2));
}

// ============================================================================
// Summary
// ============================================================================

console.log('\n');
console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));

console.log(`
Validation System Features:
  ✓ Prevent invalid requests before sending
  ✓ Detailed error messages with recovery suggestions
  ✓ Type checking and range validation
  ✓ Enum validation with allowed values
  ✓ Pattern matching for URLs and formats
  ✓ Command documentation and schema browsing
  ✓ Programmatic request building
  ✓ Middleware for HTTP/WebSocket endpoints

Key Files:
  - /websocket/command-schemas.js      - All 140+ command schemas
  - /websocket/command-validator.js    - Validation engine
  - /websocket/validation-middleware.js - Integration middleware
  - /docs/VALIDATION-INTEGRATION-GUIDE.md - Full integration guide
  - /tests/unit/command-validator.test.js - Comprehensive tests

Next Steps:
  1. Integrate validation middleware into server.js
  2. Update client SDKs to use validation
  3. Add error handling for validation responses
  4. Update API documentation with error examples
`);

console.log('='.repeat(80));
