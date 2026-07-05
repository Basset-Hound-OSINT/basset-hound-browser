/**
 * WebSocket Command Validation Examples
 *
 * This file demonstrates:
 * 1. Five example command schemas (navigate, click, screenshot, fill, setProxy)
 * 2. Valid parameter examples for each
 * 3. Invalid parameter examples and resulting validation errors
 * 4. Field-level error details and recovery suggestions
 *
 * Run with: npm test -- validation-examples.js
 *
 * @file tests/unit/validation-examples.js
 */

const { CommandValidator } = require('../../websocket/command-validator');
const { getSchema, getAllCommandNames } = require('../../websocket/command-schemas');

// Initialize validator
const validator = new CommandValidator({ strict: true });

console.log('='.repeat(80));
console.log('WebSocket Command Validation Examples');
console.log('='.repeat(80));
console.log('');

// ============================================================================
// EXAMPLE 1: NAVIGATE COMMAND
// ============================================================================

console.log('EXAMPLE 1: NAVIGATE COMMAND');
console.log('-'.repeat(80));

const navigateSchema = getSchema('navigate');
console.log('\nSchema Definition:');
console.log(JSON.stringify(navigateSchema, null, 2));

console.log('\n--- Valid Request ---');
const validNavigate = {
  command: 'navigate',
  url: 'https://example.com',
  timeout: 30000
};
console.log('Request:', JSON.stringify(validNavigate, null, 2));
const navResult = validator.validate('navigate', { url: 'https://example.com', timeout: 30000 });
console.log('Validation Result:', navResult);
console.log('Valid:', navResult.valid);

console.log('\n--- Invalid Request: Missing Required URL ---');
const invalidNavigate1 = {
  command: 'navigate',
  timeout: 30000
};
console.log('Request:', JSON.stringify(invalidNavigate1, null, 2));
const navResult1 = validator.validate('navigate', { timeout: 30000 });
console.log('Validation Result:', JSON.stringify(navResult1, null, 2));
console.log('\nFormatted Error Message:');
console.log(validator.formatErrors(navResult1));

console.log('\n--- Invalid Request: Invalid URL Format ---');
const invalidNavigate2 = {
  command: 'navigate',
  url: 'not-a-url'
};
console.log('Request:', JSON.stringify(invalidNavigate2, null, 2));
const navResult2 = validator.validate('navigate', { url: 'not-a-url' });
console.log('Validation Result:');
navResult2.errors.forEach(err => {
  console.log(`  - ${err.message}`);
  console.log(`    Suggestion: ${err.suggestion}`);
  console.log(`    Expected: ${err.expectedType}`);
});

console.log('\n--- Invalid Request: Timeout Out of Range ---');
const invalidNavigate3 = {
  command: 'navigate',
  url: 'https://example.com',
  timeout: 700000 // Too large
};
console.log('Request:', JSON.stringify(invalidNavigate3, null, 2));
const navResult3 = validator.validate('navigate', { url: 'https://example.com', timeout: 700000 });
console.log('Validation Errors:');
navResult3.errors.forEach(err => {
  console.log(`  - Field: ${err.field}`);
  console.log(`    Type: ${err.type}`);
  console.log(`    Message: ${err.message}`);
  console.log(`    Received: ${err.received}, Expected: ${err.expected}`);
  console.log(`    Suggestion: ${err.suggestion}`);
});

// ============================================================================
// EXAMPLE 2: CLICK COMMAND
// ============================================================================

console.log('\n');
console.log('='.repeat(80));
console.log('EXAMPLE 2: CLICK COMMAND');
console.log('-'.repeat(80));

const clickSchema = getSchema('click');
console.log('\nSchema Definition:');
console.log(JSON.stringify(clickSchema, null, 2));

console.log('\n--- Valid Request ---');
const validClick = {
  command: 'click',
  selector: 'button.submit',
  delay: 100,
  button: 'left',
  clickCount: 1
};
console.log('Request:', JSON.stringify(validClick, null, 2));
const clickResult = validator.validate('click', {
  selector: 'button.submit',
  delay: 100,
  button: 'left',
  clickCount: 1
});
console.log('Valid:', clickResult.valid);

console.log('\n--- Invalid Request: Missing Selector ---');
const invalidClick1 = {
  command: 'click',
  delay: 100
};
console.log('Request:', JSON.stringify(invalidClick1, null, 2));
const clickResult1 = validator.validate('click', { delay: 100 });
console.log('Errors:');
clickResult1.errors.forEach(err => {
  console.log(`  - ${err.message}`);
  console.log(`    Suggestion: ${err.suggestion}`);
});

console.log('\n--- Invalid Request: Invalid Button Value ---');
const invalidClick2 = {
  command: 'click',
  selector: 'button',
  button: 'middle-click' // Invalid enum
};
console.log('Request:', JSON.stringify(invalidClick2, null, 2));
const clickResult2 = validator.validate('click', {
  selector: 'button',
  button: 'middle-click'
});
console.log('Errors:');
clickResult2.errors.forEach(err => {
  console.log(`  - ${err.message}`);
  console.log(`    Allowed: ${err.allowed.join(', ')}`);
  console.log(`    Suggestion: ${err.suggestion}`);
});

// ============================================================================
// EXAMPLE 3: SCREENSHOT COMMAND
// ============================================================================

console.log('\n');
console.log('='.repeat(80));
console.log('EXAMPLE 3: SCREENSHOT COMMAND');
console.log('-'.repeat(80));

const screenshotSchema = getSchema('screenshot');
console.log('\nSchema Definition:');
console.log(JSON.stringify(screenshotSchema, null, 2));

console.log('\n--- Valid Request ---');
const validScreenshot = {
  command: 'screenshot',
  fullPage: true,
  quality: 90,
  format: 'png'
};
console.log('Request:', JSON.stringify(validScreenshot, null, 2));
const screenshotResult = validator.validate('screenshot', {
  fullPage: true,
  quality: 90,
  format: 'png'
});
console.log('Valid:', screenshotResult.valid);

console.log('\n--- Invalid Request: Quality Out of Range ---');
const invalidScreenshot = {
  command: 'screenshot',
  quality: 150 // Max is 100
};
console.log('Request:', JSON.stringify(invalidScreenshot, null, 2));
const screenshotResult2 = validator.validate('screenshot', { quality: 150 });
console.log('Errors:');
screenshotResult2.errors.forEach(err => {
  console.log(`  - Field: ${err.field}`);
  console.log(`    Message: ${err.message}`);
  console.log(`    Received: ${err.received}, Expected Maximum: ${err.expected}`);
  console.log(`    Suggestion: ${err.suggestion}`);
});

// ============================================================================
// EXAMPLE 4: FILL COMMAND
// ============================================================================

console.log('\n');
console.log('='.repeat(80));
console.log('EXAMPLE 4: FILL COMMAND');
console.log('-'.repeat(80));

const fillSchema = getSchema('fill');
console.log('\nSchema Definition:');
console.log(JSON.stringify(fillSchema, null, 2));

console.log('\n--- Valid Request ---');
const validFill = {
  command: 'fill',
  selector: 'input#email',
  text: 'user@example.com',
  delay: 50
};
console.log('Request:', JSON.stringify(validFill, null, 2));
const fillResult = validator.validate('fill', {
  selector: 'input#email',
  text: 'user@example.com',
  delay: 50
});
console.log('Valid:', fillResult.valid);

console.log('\n--- Invalid Request: Missing Required Parameters ---');
const invalidFill = {
  command: 'fill',
  delay: 50
};
console.log('Request:', JSON.stringify(invalidFill, null, 2));
const fillResult2 = validator.validate('fill', { delay: 50 });
console.log('Errors:');
fillResult2.errors.forEach(err => {
  console.log(`  - ${err.message}`);
  console.log(`    Field: ${err.field}`);
  console.log(`    Type: ${err.type}`);
  console.log(`    Suggestion: ${err.suggestion}`);
});

console.log('\n--- Invalid Request: Delay Out of Range ---');
const invalidFill2 = {
  command: 'fill',
  selector: 'input#email',
  text: 'test',
  delay: 2000 // Max is 1000
};
console.log('Request:', JSON.stringify(invalidFill2, null, 2));
const fillResult3 = validator.validate('fill', {
  selector: 'input#email',
  text: 'test',
  delay: 2000
});
console.log('Errors:');
fillResult3.errors.forEach(err => {
  console.log(`  - ${err.message}`);
  console.log(`    Expected Maximum: ${err.expected}`);
});

// ============================================================================
// EXAMPLE 5: SET PROXY COMMAND
// ============================================================================

console.log('\n');
console.log('='.repeat(80));
console.log('EXAMPLE 5: SET PROXY COMMAND');
console.log('-'.repeat(80));

const setProxySchema = getSchema('setProxy');
console.log('\nSchema Definition:');
console.log(JSON.stringify(setProxySchema, null, 2));

console.log('\n--- Valid Request ---');
const validProxy = {
  command: 'setProxy',
  host: 'proxy.example.com',
  port: 8080,
  proxyType: 'http',
  username: 'user',
  password: 'pass'
};
console.log('Request:', JSON.stringify(validProxy, null, 2));
const proxyResult = validator.validate('setProxy', {
  host: 'proxy.example.com',
  port: 8080,
  proxyType: 'http',
  username: 'user',
  password: 'pass'
});
console.log('Valid:', proxyResult.valid);

console.log('\n--- Invalid Request: Missing Required Fields ---');
const invalidProxy1 = {
  command: 'setProxy',
  host: 'proxy.example.com'
  // Missing port (required)
};
console.log('Request:', JSON.stringify(invalidProxy1, null, 2));
const proxyResult2 = validator.validate('setProxy', { host: 'proxy.example.com' });
console.log('Errors:');
proxyResult2.errors.forEach(err => {
  console.log(`  - ${err.message}`);
  console.log(`    Field: ${err.field}`);
  console.log(`    Expected Type: ${err.expectedType}`);
});

console.log('\n--- Invalid Request: Port Out of Range ---');
const invalidProxy2 = {
  command: 'setProxy',
  host: 'proxy.example.com',
  port: 70000 // Max is 65535
};
console.log('Request:', JSON.stringify(invalidProxy2, null, 2));
const proxyResult3 = validator.validate('setProxy', {
  host: 'proxy.example.com',
  port: 70000
});
console.log('Errors:');
proxyResult3.errors.forEach(err => {
  console.log(`  - ${err.message}`);
  console.log(`    Received: ${err.received}`);
  console.log(`    Expected Maximum: ${err.expected}`);
  console.log(`    Suggestion: ${err.suggestion}`);
});

console.log('\n--- Invalid Request: Invalid Proxy Type ---');
const invalidProxy3 = {
  command: 'setProxy',
  host: 'proxy.example.com',
  port: 8080,
  proxyType: 'ftp' // Invalid enum
};
console.log('Request:', JSON.stringify(invalidProxy3, null, 2));
const proxyResult4 = validator.validate('setProxy', {
  host: 'proxy.example.com',
  port: 8080,
  proxyType: 'ftp'
});
console.log('Errors:');
proxyResult4.errors.forEach(err => {
  console.log(`  - ${err.message}`);
  console.log(`    Allowed values: ${err.allowed.join(', ')}`);
  console.log(`    Suggestion: ${err.suggestion}`);
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n');
console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));

const allCommandNames = getAllCommandNames();
console.log(`\nTotal commands with schema definitions: ${allCommandNames.length}`);
console.log(`\nFirst 20 commands:`);
allCommandNames.slice(0, 20).forEach((cmd, i) => {
  console.log(`  ${i + 1}. ${cmd}`);
});

console.log('\n--- Validation Error Types ---');
console.log('  1. MISSING_REQUIRED_FIELD - Missing required parameter');
console.log('  2. TYPE_MISMATCH - Parameter type is wrong');
console.log('  3. INVALID_FORMAT - Parameter value doesn\'t match pattern');
console.log('  4. INVALID_ENUM - Value not in allowed list');
console.log('  5. TOO_SHORT - String is too short');
console.log('  6. TOO_LONG - String is too long');
console.log('  7. TOO_SMALL - Number is too small');
console.log('  8. TOO_LARGE - Number is too large');
console.log('  9. UNKNOWN_FIELD - Parameter not in schema');
console.log('  10. UNKNOWN_COMMAND - Command not registered');

console.log('\n--- Key Features ---');
console.log('  ✓ Field-level validation with specific error types');
console.log('  ✓ Helpful error messages with recovery suggestions');
console.log('  ✓ Example values for each parameter');
console.log('  ✓ Type checking, range validation, pattern matching');
console.log('  ✓ Enum validation with allowed values list');
console.log('  ✓ Similar field name suggestions for typos');
console.log('  ✓ Detailed validation reports with schema info');

console.log('\n');
console.log('='.repeat(80));
