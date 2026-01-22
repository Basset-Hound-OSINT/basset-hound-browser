/**
 * Basset Hound Browser - .onion Domain Detection Tests
 *
 * Tests for .onion URL detection and Tor mode validation.
 * When navigating to .onion domains without TOR_MODE=1 at startup,
 * the browser should return a helpful error message.
 */

// ==========================================
// Test Helper Functions (extracted from server.js)
// ==========================================

/**
 * Check if a URL is a .onion domain
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL is a .onion domain
 */
function isOnionUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.onion');
  } catch {
    // Fallback for malformed URLs - check if .onion appears in the string
    return url.includes('.onion');
  }
}

/**
 * Check if Tor mode is enabled at startup
 * @returns {boolean} True if Tor mode is enabled
 */
function isTorModeEnabled() {
  const args = process.argv;
  return (
    process.env.TOR_MODE === '1' ||
    process.env.TOR_MODE === 'true' ||
    args.includes('--tor-mode')
  );
}

/**
 * Check URL and return error if .onion without Tor mode
 * @param {string} url - The URL to check
 * @returns {Object|null} Error object if .onion without Tor mode, null otherwise
 */
function checkOnionWithoutTor(url) {
  if (isOnionUrl(url) && !isTorModeEnabled()) {
    return {
      success: false,
      error: '.onion domains require TOR_MODE=1 at startup.',
      suggestion: 'Restart with TOR_MODE=1 or --tor-mode flag.',
      url
    };
  }
  return null;
}

// ==========================================
// Test Cases
// ==========================================

console.log('='.repeat(60));
console.log('Basset Hound Browser - .onion Domain Detection Tests');
console.log('='.repeat(60));
console.log('');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (error) {
    console.log(`[FAIL] ${name}`);
    console.log(`       Error: ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertNull(actual, message) {
  if (actual !== null) {
    throw new Error(`${message}: expected null, got ${JSON.stringify(actual)}`);
  }
}

function assertNotNull(actual, message) {
  if (actual === null) {
    throw new Error(`${message}: expected non-null value`);
  }
}

// ==========================================
// isOnionUrl() Tests
// ==========================================

console.log('\n--- isOnionUrl() Tests ---\n');

test('detects standard .onion URL', () => {
  assertEqual(isOnionUrl('http://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion'), true, '.onion URL');
});

test('detects HTTPS .onion URL', () => {
  assertEqual(isOnionUrl('https://facebookwkhpilnemxj7asaniu7vnjjbiltxjqhye3mhbshg7kx5tfyd.onion'), true, 'HTTPS .onion URL');
});

test('detects .onion with path', () => {
  assertEqual(isOnionUrl('http://example.onion/path/to/page'), true, '.onion with path');
});

test('detects .onion with query string', () => {
  assertEqual(isOnionUrl('http://example.onion?query=value'), true, '.onion with query');
});

test('detects .onion with port', () => {
  assertEqual(isOnionUrl('http://example.onion:8080'), true, '.onion with port');
});

test('does not detect regular .com URL', () => {
  assertEqual(isOnionUrl('https://www.google.com'), false, 'regular .com URL');
});

test('does not detect .org URL', () => {
  assertEqual(isOnionUrl('https://example.org/path'), false, '.org URL');
});

test('does not detect .onion in path (not hostname)', () => {
  // This is a tricky case - URL parser correctly identifies hostname
  assertEqual(isOnionUrl('https://example.com/files/document.onion'), false, '.onion in path only');
});

test('detects malformed .onion URL (fallback)', () => {
  // When URL parsing fails, fallback to string check
  assertEqual(isOnionUrl('notavalidurl.onion'), true, 'malformed .onion URL');
});

test('handles empty string', () => {
  assertEqual(isOnionUrl(''), false, 'empty string');
});

test('handles URL with subdomain ending in .onion', () => {
  assertEqual(isOnionUrl('http://subdomain.example.onion'), true, 'subdomain .onion');
});

// ==========================================
// isTorModeEnabled() Tests
// ==========================================

console.log('\n--- isTorModeEnabled() Tests ---\n');

// Save original env/args
const originalTorMode = process.env.TOR_MODE;
const originalArgv = process.argv.slice();

test('returns false when TOR_MODE not set', () => {
  delete process.env.TOR_MODE;
  process.argv = ['node', 'test.js'];
  assertEqual(isTorModeEnabled(), false, 'TOR_MODE not set');
});

test('returns true when TOR_MODE=1', () => {
  process.env.TOR_MODE = '1';
  process.argv = ['node', 'test.js'];
  assertEqual(isTorModeEnabled(), true, 'TOR_MODE=1');
});

test('returns true when TOR_MODE=true', () => {
  process.env.TOR_MODE = 'true';
  process.argv = ['node', 'test.js'];
  assertEqual(isTorModeEnabled(), true, 'TOR_MODE=true');
});

test('returns false when TOR_MODE=0', () => {
  process.env.TOR_MODE = '0';
  process.argv = ['node', 'test.js'];
  assertEqual(isTorModeEnabled(), false, 'TOR_MODE=0');
});

test('returns true when --tor-mode flag present', () => {
  delete process.env.TOR_MODE;
  process.argv = ['node', 'test.js', '--tor-mode'];
  assertEqual(isTorModeEnabled(), true, '--tor-mode flag');
});

test('returns true when --tor-mode flag with other args', () => {
  delete process.env.TOR_MODE;
  process.argv = ['node', 'test.js', '--headless', '--tor-mode', '--port=8080'];
  assertEqual(isTorModeEnabled(), true, '--tor-mode with other args');
});

// Restore original env/args
if (originalTorMode !== undefined) {
  process.env.TOR_MODE = originalTorMode;
} else {
  delete process.env.TOR_MODE;
}
process.argv = originalArgv;

// ==========================================
// checkOnionWithoutTor() Tests
// ==========================================

console.log('\n--- checkOnionWithoutTor() Tests ---\n');

// Save and clear TOR_MODE for these tests
const savedTorMode = process.env.TOR_MODE;
const savedArgv = process.argv.slice();

test('returns error for .onion URL without Tor mode', () => {
  delete process.env.TOR_MODE;
  process.argv = ['node', 'test.js'];

  const result = checkOnionWithoutTor('http://example.onion');
  assertNotNull(result, 'should return error object');
  assertEqual(result.success, false, 'success should be false');
  assertEqual(result.error, '.onion domains require TOR_MODE=1 at startup.', 'error message');
  assertEqual(result.suggestion, 'Restart with TOR_MODE=1 or --tor-mode flag.', 'suggestion');
  assertEqual(result.url, 'http://example.onion', 'url in response');
});

test('returns null for regular URL without Tor mode', () => {
  delete process.env.TOR_MODE;
  process.argv = ['node', 'test.js'];

  const result = checkOnionWithoutTor('https://example.com');
  assertNull(result, 'should return null for regular URL');
});

test('returns null for .onion URL with TOR_MODE=1', () => {
  process.env.TOR_MODE = '1';
  process.argv = ['node', 'test.js'];

  const result = checkOnionWithoutTor('http://example.onion');
  assertNull(result, 'should return null when Tor mode enabled');
});

test('returns null for .onion URL with --tor-mode flag', () => {
  delete process.env.TOR_MODE;
  process.argv = ['node', 'test.js', '--tor-mode'];

  const result = checkOnionWithoutTor('http://example.onion');
  assertNull(result, 'should return null with --tor-mode flag');
});

test('returns error for real .onion site without Tor mode', () => {
  delete process.env.TOR_MODE;
  process.argv = ['node', 'test.js'];

  // DuckDuckGo's .onion address
  const url = 'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion';
  const result = checkOnionWithoutTor(url);
  assertNotNull(result, 'should return error for real .onion site');
  assertEqual(result.success, false, 'success should be false');
});

// Restore env/args
if (savedTorMode !== undefined) {
  process.env.TOR_MODE = savedTorMode;
} else {
  delete process.env.TOR_MODE;
}
process.argv = savedArgv;

// ==========================================
// Test Results Summary
// ==========================================

console.log('\n' + '='.repeat(60));
console.log('Test Results Summary');
console.log('='.repeat(60));
console.log(`Total: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\nSome tests failed!');
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
  process.exit(0);
}
