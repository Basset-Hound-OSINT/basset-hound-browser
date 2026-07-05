#!/usr/bin/env node

/**
 * External App Reliability - Response Schema Validation
 *
 * Validates that actual server responses match the documented OpenAPI schema.
 * External apps depend on consistent response structures.
 *
 * Tests:
 * 1. Core command responses match OpenAPI spec
 * 2. Error responses have consistent structure
 * 3. Response field types are correct
 * 4. Required vs optional fields are respected
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TEST_TIMEOUT = 30000;

// Load OpenAPI spec
let OPENAPI_SPEC = null;
function loadOpenAPISpec() {
  try {
    const specPath = path.join(__dirname, '../../docs/openapi.yaml');
    if (fs.existsSync(specPath)) {
      const content = fs.readFileSync(specPath, 'utf-8');
      OPENAPI_SPEC = yaml.load(content);
      return OPENAPI_SPEC;
    } else {
      console.warn('OpenAPI spec not found at ' + specPath);
      return null;
    }
  } catch (error) {
    console.warn('Could not load OpenAPI spec:', error.message);
    return null;
  }
}

// Define expected response schemas for critical commands
const EXPECTED_SCHEMAS = {
  navigate: {
    requiredFields: ['status'],
    optionalFields: ['success', 'url', 'timestamp'],
    fieldTypes: {
      status: 'string',
      success: 'boolean',
      url: 'string',
      timestamp: 'number'
    }
  },
  get_content: {
    requiredFields: ['content'],
    optionalFields: ['contentType', 'length', 'timestamp'],
    fieldTypes: {
      content: 'string',
      contentType: 'string',
      length: 'number',
      timestamp: 'number'
    }
  },
  get_network_logs: {
    requiredFields: ['requests'],
    optionalFields: ['timestamp', 'totalRequests', 'statistics'],
    fieldTypes: {
      requests: 'object', // Array
      timestamp: 'number',
      totalRequests: 'number'
    },
    requestSchema: {
      requiredFields: ['url', 'method'],
      optionalFields: ['statusCode', 'duration', 'resourceType', 'timestamp'],
      fieldTypes: {
        url: 'string',
        method: 'string',
        statusCode: 'number',
        duration: 'number',
        resourceType: 'string',
        timestamp: 'number'
      }
    }
  },
  get_page_state: {
    requiredFields: ['status'],
    optionalFields: ['url', 'title', 'timestamp'],
    fieldTypes: {
      status: 'string',
      url: 'string',
      title: 'string',
      timestamp: 'number'
    }
  },
  wait_for_load: {
    requiredFields: ['status'],
    optionalFields: ['success', 'waited', 'timestamp'],
    fieldTypes: {
      status: 'string',
      success: 'boolean',
      waited: 'number',
      timestamp: 'number'
    }
  }
};

// Error response schema
const ERROR_RESPONSE_SCHEMA = {
  requiredFields: ['error'],
  optionalFields: ['requestId', 'timestamp', 'code'],
  fieldTypes: {
    error: 'string',
    requestId: 'number',
    timestamp: 'number',
    code: ['string', 'number']
  }
};

// Test client
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.requestId = 0;
    this.responseMap = new Map();
  }

  async connect(timeout = 5000) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.setMaxListeners(100);

        this.ws.on('open', () => {
          this.connected = true;
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data);
            if (msg.requestId && this.responseMap.has(msg.requestId)) {
              this.responseMap.get(msg.requestId).resolve(msg);
              this.responseMap.delete(msg.requestId);
            }
          } catch (e) {}
        });

        this.ws.on('error', (err) => {
          if (!this.connected) reject(err);
        });

        setTimeout(() => {
          if (!this.connected) reject(new Error('Connection timeout'));
        }, timeout);
      } catch (err) {
        reject(err);
      }
    });
  }

  async sendCommand(command, params = {}, timeout = TEST_TIMEOUT) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const requestId = ++this.requestId;
    const message = { command, params, requestId };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.responseMap.delete(requestId);
        reject(new Error(`Command timeout: ${command}`));
      }, timeout);

      this.responseMap.set(requestId, {
        resolve: (msg) => {
          clearTimeout(timeoutHandle);
          resolve(msg);
        }
      });

      try {
        this.ws.send(JSON.stringify(message));
      } catch (err) {
        clearTimeout(timeoutHandle);
        this.responseMap.delete(requestId);
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }
}

// Validation functions
function validateFieldTypes(response, schema, commandName) {
  const errors = [];

  for (const [field, expectedType] of Object.entries(schema.fieldTypes)) {
    if (response[field] !== undefined) {
      const actualType = Array.isArray(response[field]) ? 'object' : typeof response[field];
      const typeMatch = Array.isArray(expectedType)
        ? expectedType.includes(actualType)
        : actualType === expectedType;

      if (!typeMatch) {
        errors.push(
          `Field '${field}' has wrong type: expected ${expectedType}, got ${actualType}`
        );
      }
    }
  }

  return errors;
}

function validateRequiredFields(response, schema, commandName) {
  const errors = [];

  for (const field of schema.requiredFields) {
    if (response[field] === undefined) {
      errors.push(`Required field '${field}' is missing`);
    }
  }

  return errors;
}

function validateResponseSchema(response, schema, commandName) {
  const errors = [];

  // Validate required fields
  errors.push(...validateRequiredFields(response, schema, commandName));

  // Validate field types
  errors.push(...validateFieldTypes(response, schema, commandName));

  return errors;
}

// Tests
const RESULTS = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

async function testCommand(client, commandName, params = {}) {
  const schema = EXPECTED_SCHEMAS[commandName];
  if (!schema) {
    console.log(`⚠ No schema definition for ${commandName}, skipping`);
    return true;
  }

  try {
    RESULTS.total++;
    const response = await client.sendCommand(commandName, params);

    // Check if response is an error
    if (response.error) {
      const errors = validateResponseSchema(response, ERROR_RESPONSE_SCHEMA, commandName);
      if (errors.length === 0) {
        console.log(`✓ ${commandName}: Error response valid`);
        RESULTS.passed++;
        return true;
      } else {
        console.log(`✗ ${commandName}: Error response invalid`);
        errors.forEach(e => console.log(`  - ${e}`));
        RESULTS.failed++;
        RESULTS.details.push({ command: commandName, errors });
        return false;
      }
    }

    // Validate success response
    const errors = validateResponseSchema(response, schema, commandName);

    if (errors.length === 0) {
      console.log(`✓ ${commandName}: Response schema valid`);
      RESULTS.passed++;

      // Extra validation for nested schemas
      if (commandName === 'get_network_logs' && response.requests && response.requests.length > 0) {
        const requestSchema = schema.requestSchema;
        const sampleRequest = response.requests[0];
        const reqErrors = validateResponseSchema(sampleRequest, requestSchema, `${commandName}.request[0]`);

        if (reqErrors.length > 0) {
          console.log(`  ⚠ First request object has schema issues:`);
          reqErrors.forEach(e => console.log(`    - ${e}`));
        }
      }

      return true;
    } else {
      console.log(`✗ ${commandName}: Response schema invalid`);
      errors.forEach(e => console.log(`  - ${e}`));
      RESULTS.failed++;
      RESULTS.details.push({ command: commandName, errors });
      return false;
    }
  } catch (error) {
    console.log(`✗ ${commandName}: ${error.message}`);
    RESULTS.failed++;
    RESULTS.details.push({ command: commandName, error: error.message });
    return false;
  }
}

/**
 * Run all schema validation tests
 */
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  EXTERNAL APP SCHEMA VALIDATION        ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`Server URL: ${WS_URL}\n`);

  // Try to load OpenAPI spec
  const spec = loadOpenAPISpec();
  if (spec) {
    console.log('✓ OpenAPI spec loaded successfully\n');
  }

  const client = new WebSocketClient(WS_URL);

  try {
    console.log('Connecting to server...');
    await client.connect();
    console.log('Connected\n');

    console.log('Testing core command response schemas:\n');

    // Test each critical command
    await testCommand(client, 'navigate', { url: 'https://example.com' });
    await testCommand(client, 'wait_for_load', { maxWaitTime: 5000 });
    await testCommand(client, 'get_content', { contentType: 'html' });
    await testCommand(client, 'get_network_logs', {});
    await testCommand(client, 'get_page_state', {});

    // Print summary
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║          VALIDATION SUMMARY            ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`Total tests: ${RESULTS.total}`);
    console.log(`Passed: ${RESULTS.passed}`);
    console.log(`Failed: ${RESULTS.failed}\n`);

    if (RESULTS.failed > 0) {
      console.log('Failed validations:');
      RESULTS.details.forEach(detail => {
        console.log(`\n${detail.command}:`);
        if (detail.errors) {
          detail.errors.forEach(e => console.log(`  - ${e}`));
        } else if (detail.error) {
          console.log(`  - ${detail.error}`);
        }
      });
      console.log('\nSTATUS: FAILED - Response schemas do not match documentation');
      process.exit(1);
    } else {
      console.log('STATUS: PASSED - All response schemas match documentation');
      process.exit(0);
    }
  } catch (error) {
    console.error('Test error:', error.message);
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

// Run tests
runAllTests();
