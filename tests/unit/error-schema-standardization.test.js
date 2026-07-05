#!/usr/bin/env node

/**
 * Error Schema Standardization Test
 * Validates that error responses conform to the standardized schema
 * 
 * Standard Format: {success, error, errorCode, command, id, recoveryHint, details?}
 */

const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TEST_TIMEOUT = 10000;

/**
 * Validate error response against standardized schema
 * @param {Object} response - The response object
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateErrorSchema(response) {
  const errors = [];

  // Check required fields
  if (response.success !== false) {
    errors.push('success must be false for error responses');
  }

  if (typeof response.error !== 'string' || response.error.length === 0) {
    errors.push('error must be non-empty string');
  }

  if (typeof response.errorCode !== 'string' || response.errorCode.length === 0) {
    errors.push('errorCode must be non-empty string');
  }

  if (!/^[A-Z_]+$/.test(response.errorCode)) {
    errors.push(`errorCode must be UPPERCASE_SNAKE_CASE, got: ${response.errorCode}`);
  }

  if (typeof response.command !== 'string' || response.command.length === 0) {
    errors.push('command must be non-empty string');
  }

  if (response.id !== null && typeof response.id !== 'string') {
    errors.push('id must be string or null');
  }

  if (typeof response.recoveryHint !== 'string' || response.recoveryHint.length === 0) {
    errors.push('recoveryHint must be non-empty string');
  }

  // Optional details field should be object if present
  if (response.details !== undefined && typeof response.details !== 'object') {
    errors.push('details must be an object if present');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Test: Invalid command returns standardized error
 */
async function testInvalidCommand() {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        command: 'INVALID_COMMAND_XYZ',
        id: 'test-invalid-001',
        params: {}
      }));
    });

    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data);
        
        if (response.id === 'test-invalid-001') {
          const validation = validateErrorSchema(response);
          
          const details = {
            testPassed: validation.valid,
            testMessage: validation.valid 
              ? 'PASSED: Invalid command error is properly standardized'
              : 'FAILED: ' + validation.errors.join(', '),
            response
          };
          
          ws.close();
          resolve(details);
        }
      } catch (error) {
        ws.close();
        resolve({
          testPassed: false,
          testMessage: `FAILED: Could not parse response: ${error.message}`,
          error
        });
      }
    });

    ws.on('error', (error) => {
      resolve({
        testPassed: false,
        testMessage: `FAILED: WebSocket error: ${error.message}`,
        error
      });
    });

    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      resolve({
        testPassed: false,
        testMessage: 'FAILED: Test timeout',
        error: 'timeout'
      });
    }, TEST_TIMEOUT);
  });
}

/**
 * Test: Missing command returns standardized error
 */
async function testMissingCommand() {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 'test-missing-001',
        params: {}
        // Missing command field
      }));
    });

    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data);
        
        if (response.id === 'test-missing-001') {
          const validation = validateErrorSchema(response);
          
          const details = {
            testPassed: validation.valid,
            testMessage: validation.valid 
              ? 'PASSED: Missing command error is properly standardized'
              : 'FAILED: ' + validation.errors.join(', '),
            response
          };
          
          ws.close();
          resolve(details);
        }
      } catch (error) {
        ws.close();
        resolve({
          testPassed: false,
          testMessage: `FAILED: Could not parse response: ${error.message}`,
          error
        });
      }
    });

    ws.on('error', (error) => {
      resolve({
        testPassed: false,
        testMessage: `FAILED: WebSocket error: ${error.message}`,
        error
      });
    });

    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      resolve({
        testPassed: false,
        testMessage: 'FAILED: Test timeout',
        error: 'timeout'
      });
    }, TEST_TIMEOUT);
  });
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('ERROR SCHEMA STANDARDIZATION TEST SUITE');
  console.log('='.repeat(60));

  const results = [];

  console.log('\nTest 1: Invalid Command Error Schema');
  console.log('-'.repeat(60));
  const test1 = await testInvalidCommand();
  results.push(test1);
  console.log(`Result: ${test1.testMessage}`);
  if (test1.response) {
    console.log('Response:', JSON.stringify(test1.response, null, 2));
  }

  console.log('\nTest 2: Missing Command Error Schema');
  console.log('-'.repeat(60));
  const test2 = await testMissingCommand();
  results.push(test2);
  console.log(`Result: ${test2.testMessage}`);
  if (test2.response) {
    console.log('Response:', JSON.stringify(test2.response, null, 2));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passCount = results.filter(r => r.testPassed).length;
  const totalTests = results.length;
  
  console.log(`Passed: ${passCount}/${totalTests}`);
  
  if (passCount === totalTests) {
    console.log('STATUS: ✅ ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('STATUS: ❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

// Only run if executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = {
  validateErrorSchema,
  testInvalidCommand,
  testMissingCommand
};
