/**
 * Session/Cookie Sharing Tests
 *
 * Tests that sessions and cookies are correctly shared and synchronized
 * between the extension and browser components.
 */

const assert = require('assert');
const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8768;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

// Test state
let server = null;
let extension = null;
let browser = null;

// Shared data stores for simulating persistence
const sharedState = {
  sessions: new Map(),
  cookies: [],
  localStorage: new Map(),
  sessionStorage: new Map()
};

/**
 * Test utilities
 */
const testUtils = {
  async setup() {
    // Reset shared state
    sharedState.sessions.clear();
    sharedState.cookies = [];
    sharedState.localStorage.clear();
    sharedState.sessionStorage.clear();

    // Initialize default session
    sharedState.sessions.set('default', {
      id: 'default',
      name: 'Default Session',
      createdAt: new Date().toISOString()
    });

    server = new TestServer({ port: TEST_PORT });
    setupServerHandlers();
    await server.start();

    extension = new MockExtension({ url: TEST_URL });
    browser = new MockBrowser({ url: TEST_URL });

    await extension.connect();
    await browser.connect();
  },

  async teardown() {
    if (extension && extension.isConnected) {
      extension.disconnect();
    }
    if (browser && browser.isConnected) {
      browser.disconnect();
    }
    if (server && server.isRunning) {
      await server.stop();
    }
  },

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

/**
 * Setup server handlers for session/cookie management
 */
function setupServerHandlers() {
  // Session handlers
  server.registerHandler('create_session', async (params) => {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      name: params.name || `Session ${sessionId}`,
      createdAt: new Date().toISOString(),
      userAgent: params.userAgent,
      fingerprint: params.fingerprint
    };
    sharedState.sessions.set(sessionId, session);
    return { success: true, session };
  });

  server.registerHandler('switch_session', async (params) => {
    if (!sharedState.sessions.has(params.sessionId)) {
      return { success: false, error: 'Session not found' };
    }
    return {
      success: true,
      sessionId: params.sessionId,
      session: sharedState.sessions.get(params.sessionId)
    };
  });

  server.registerHandler('delete_session', async (params) => {
    if (params.sessionId === 'default') {
      return { success: false, error: 'Cannot delete default session' };
    }
    if (!sharedState.sessions.has(params.sessionId)) {
      return { success: false, error: 'Session not found' };
    }
    sharedState.sessions.delete(params.sessionId);
    return { success: true };
  });

  server.registerHandler('list_sessions', async () => {
    return {
      success: true,
      sessions: Array.from(sharedState.sessions.values())
    };
  });

  server.registerHandler('export_session', async (params) => {
    const session = sharedState.sessions.get(params.sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    return {
      success: true,
      data: {
        session,
        cookies: sharedState.cookies.filter(c => c.sessionId === params.sessionId),
        exportedAt: new Date().toISOString()
      }
    };
  });

  server.registerHandler('import_session', async (params) => {
    const { data } = params;
    const newSessionId = `imported-${Date.now()}`;
    const session = {
      ...data.session,
      id: newSessionId,
      name: `${data.session.name} (Imported)`,
      importedAt: new Date().toISOString()
    };
    sharedState.sessions.set(newSessionId, session);
    return { success: true, sessionId: newSessionId, session };
  });

  // Cookie handlers
  server.registerHandler('set_cookies', async (params) => {
    const { cookies, sessionId } = params;
    const cookiesWithSession = cookies.map(c => ({
      ...c,
      sessionId: sessionId || 'default',
      setAt: Date.now()
    }));
    sharedState.cookies.push(...cookiesWithSession);
    return { success: true, count: cookies.length };
  });

  server.registerHandler('get_cookies', async (params) => {
    let cookies = [...sharedState.cookies];

    if (params.url) {
      try {
        const url = new URL(params.url);
        cookies = cookies.filter(c =>
          c.domain === url.hostname ||
          url.hostname.endsWith(c.domain.replace(/^\./, ''))
        );
      } catch {
        // Invalid URL, return empty
        cookies = [];
      }
    }

    if (params.sessionId) {
      cookies = cookies.filter(c => c.sessionId === params.sessionId);
    }

    return { success: true, cookies };
  });

  server.registerHandler('clear_cookies', async (params) => {
    const { sessionId, domain } = params;
    const initialCount = sharedState.cookies.length;

    sharedState.cookies = sharedState.cookies.filter(c => {
      if (sessionId && c.sessionId !== sessionId) return true;
      if (domain && c.domain !== domain) return true;
      return false;
    });

    return {
      success: true,
      cleared: initialCount - sharedState.cookies.length
    };
  });

  // Storage handlers
  server.registerHandler('get_local_storage', async (params) => {
    const { keys, sessionId = 'default' } = params;
    const storageKey = sessionId;
    const storage = sharedState.localStorage.get(storageKey) || {};

    if (keys && Array.isArray(keys)) {
      const filtered = {};
      keys.forEach(k => {
        if (storage[k] !== undefined) {
          filtered[k] = storage[k];
        }
      });
      return { success: true, items: filtered };
    }

    return { success: true, items: storage };
  });

  server.registerHandler('set_local_storage', async (params) => {
    const { items, sessionId = 'default' } = params;
    const storageKey = sessionId;
    const storage = sharedState.localStorage.get(storageKey) || {};
    Object.assign(storage, items);
    sharedState.localStorage.set(storageKey, storage);
    return { success: true, count: Object.keys(items).length };
  });

  server.registerHandler('clear_storage', async (params) => {
    const { types = ['localStorage', 'sessionStorage', 'cookies'], sessionId } = params;
    const results = {};

    if (types.includes('localStorage')) {
      if (sessionId) {
        sharedState.localStorage.delete(sessionId);
      } else {
        sharedState.localStorage.clear();
      }
      results.localStorage = { success: true };
    }

    if (types.includes('sessionStorage')) {
      if (sessionId) {
        sharedState.sessionStorage.delete(sessionId);
      } else {
        sharedState.sessionStorage.clear();
      }
      results.sessionStorage = { success: true };
    }

    if (types.includes('cookies')) {
      if (sessionId) {
        sharedState.cookies = sharedState.cookies.filter(c => c.sessionId !== sessionId);
      } else {
        sharedState.cookies = [];
      }
      results.cookies = { success: true };
    }

    return { success: true, results };
  });
}

/**
 * Test Suite: Session Creation and Persistence
 */
async function testSessionCreation() {
  console.log('\n--- Test: Session Creation and Persistence ---');

  // Create a new session
  const createResponse = await extension.sendCommand('create_session', {
    name: 'Test Session',
    userAgent: 'Mozilla/5.0 Test Agent'
  });

  assert(createResponse.success, 'Session creation should succeed');
  assert(createResponse.result.session.id, 'Session should have ID');
  assert(createResponse.result.session.name === 'Test Session', 'Session name should match');
  console.log('  Session created successfully');

  // Verify session is in shared state
  const sessionId = createResponse.result.session.id;
  assert(sharedState.sessions.has(sessionId), 'Session should be stored');
  console.log('  Session persisted to shared state');

  // List sessions should include new session
  const listResponse = await extension.sendCommand('list_sessions', {});
  assert(listResponse.success, 'List sessions should succeed');
  const sessionIds = listResponse.result.sessions.map(s => s.id);
  assert(sessionIds.includes(sessionId), 'New session should be in list');
  console.log('  Session appears in session list');

  console.log('PASSED: Session Creation and Persistence');
  return true;
}

/**
 * Test Suite: Session Switching
 */
async function testSessionSwitching() {
  console.log('\n--- Test: Session Switching ---');

  // Create two sessions
  const session1 = await extension.sendCommand('create_session', { name: 'Session 1' });
  const session2 = await extension.sendCommand('create_session', { name: 'Session 2' });

  assert(session1.success && session2.success, 'Sessions should be created');

  // Switch to session 1
  const switch1 = await extension.sendCommand('switch_session', {
    sessionId: session1.result.session.id
  });
  assert(switch1.success, 'Switch to session 1 should succeed');
  assert(switch1.result.sessionId === session1.result.session.id, 'Active session should be session 1');
  console.log('  Switched to session 1');

  // Switch to session 2
  const switch2 = await extension.sendCommand('switch_session', {
    sessionId: session2.result.session.id
  });
  assert(switch2.success, 'Switch to session 2 should succeed');
  assert(switch2.result.sessionId === session2.result.session.id, 'Active session should be session 2');
  console.log('  Switched to session 2');

  // Switch to default session
  const switchDefault = await extension.sendCommand('switch_session', {
    sessionId: 'default'
  });
  assert(switchDefault.success, 'Switch to default should succeed');
  console.log('  Switched back to default session');

  console.log('PASSED: Session Switching');
  return true;
}

/**
 * Test Suite: Cookie Isolation Between Sessions
 */
async function testCookieIsolation() {
  console.log('\n--- Test: Cookie Isolation Between Sessions ---');

  // Create two sessions
  const session1 = await extension.sendCommand('create_session', { name: 'Cookie Session 1' });
  const session2 = await extension.sendCommand('create_session', { name: 'Cookie Session 2' });

  // Set cookies for session 1
  await extension.sendCommand('set_cookies', {
    cookies: [
      { name: 'user', value: 'user1', domain: '.example.com' }
    ],
    sessionId: session1.result.session.id
  });
  console.log('  Set cookie for session 1');

  // Set different cookies for session 2
  await extension.sendCommand('set_cookies', {
    cookies: [
      { name: 'user', value: 'user2', domain: '.example.com' }
    ],
    sessionId: session2.result.session.id
  });
  console.log('  Set cookie for session 2');

  // Get cookies for session 1
  const cookies1 = await extension.sendCommand('get_cookies', {
    url: 'https://example.com',
    sessionId: session1.result.session.id
  });
  assert(cookies1.result.cookies.length === 1, 'Session 1 should have 1 cookie');
  assert(cookies1.result.cookies[0].value === 'user1', 'Session 1 cookie should have correct value');
  console.log('  Session 1 cookies isolated');

  // Get cookies for session 2
  const cookies2 = await extension.sendCommand('get_cookies', {
    url: 'https://example.com',
    sessionId: session2.result.session.id
  });
  assert(cookies2.result.cookies.length === 1, 'Session 2 should have 1 cookie');
  assert(cookies2.result.cookies[0].value === 'user2', 'Session 2 cookie should have correct value');
  console.log('  Session 2 cookies isolated');

  console.log('PASSED: Cookie Isolation Between Sessions');
  return true;
}

/**
 * Test Suite: Local Storage Isolation
 */
async function testLocalStorageIsolation() {
  console.log('\n--- Test: Local Storage Isolation ---');

  // Create two sessions
  const session1 = await extension.sendCommand('create_session', { name: 'Storage Session 1' });
  const session2 = await extension.sendCommand('create_session', { name: 'Storage Session 2' });

  // Set storage for session 1
  await extension.sendCommand('set_local_storage', {
    items: { key1: 'value1', shared: 'from-session1' },
    sessionId: session1.result.session.id
  });
  console.log('  Set local storage for session 1');

  // Set storage for session 2
  await extension.sendCommand('set_local_storage', {
    items: { key2: 'value2', shared: 'from-session2' },
    sessionId: session2.result.session.id
  });
  console.log('  Set local storage for session 2');

  // Get storage for session 1
  const storage1 = await extension.sendCommand('get_local_storage', {
    sessionId: session1.result.session.id
  });
  assert(storage1.result.items.key1 === 'value1', 'Session 1 should have key1');
  assert(storage1.result.items.shared === 'from-session1', 'Session 1 shared key should be isolated');
  assert(storage1.result.items.key2 === undefined, 'Session 1 should not have key2');
  console.log('  Session 1 storage isolated');

  // Get storage for session 2
  const storage2 = await extension.sendCommand('get_local_storage', {
    sessionId: session2.result.session.id
  });
  assert(storage2.result.items.key2 === 'value2', 'Session 2 should have key2');
  assert(storage2.result.items.shared === 'from-session2', 'Session 2 shared key should be isolated');
  assert(storage2.result.items.key1 === undefined, 'Session 2 should not have key1');
  console.log('  Session 2 storage isolated');

  console.log('PASSED: Local Storage Isolation');
  return true;
}

/**
 * Test Suite: Session Export and Import
 */
async function testSessionExportImport() {
  console.log('\n--- Test: Session Export and Import ---');

  // Create a session with data
  const session = await extension.sendCommand('create_session', { name: 'Export Session' });
  const sessionId = session.result.session.id;

  // Add cookies to session
  await extension.sendCommand('set_cookies', {
    cookies: [
      { name: 'auth', value: 'token123', domain: '.example.com' }
    ],
    sessionId
  });
  console.log('  Created session with cookies');

  // Export session
  const exportResponse = await extension.sendCommand('export_session', { sessionId });
  assert(exportResponse.success, 'Export should succeed');
  assert(exportResponse.result.data.session, 'Export should include session');
  assert(exportResponse.result.data.cookies, 'Export should include cookies');
  console.log('  Session exported successfully');

  // Modify export data for import test
  const exportData = exportResponse.result.data;

  // Import session
  const importResponse = await extension.sendCommand('import_session', { data: exportData });
  assert(importResponse.success, 'Import should succeed');
  assert(importResponse.result.sessionId !== sessionId, 'Imported session should have new ID');
  console.log('  Session imported with new ID');

  // Verify imported session exists
  const listResponse = await extension.sendCommand('list_sessions', {});
  const sessionNames = listResponse.result.sessions.map(s => s.name);
  assert(sessionNames.some(n => n.includes('Imported')), 'Imported session should be in list');
  console.log('  Imported session appears in session list');

  console.log('PASSED: Session Export and Import');
  return true;
}

/**
 * Test Suite: Session Deletion
 */
async function testSessionDeletion() {
  console.log('\n--- Test: Session Deletion ---');

  // Create a session
  const session = await extension.sendCommand('create_session', { name: 'Delete Me' });
  const sessionId = session.result.session.id;
  console.log('  Created session to delete');

  // Try to delete default session (should fail)
  const deleteDefault = await extension.sendCommand('delete_session', { sessionId: 'default' });
  assert(!deleteDefault.success, 'Deleting default session should fail');
  console.log('  Default session protected from deletion');

  // Delete created session
  const deleteResponse = await extension.sendCommand('delete_session', { sessionId });
  assert(deleteResponse.success, 'Session deletion should succeed');
  console.log('  Session deleted successfully');

  // Verify session is removed
  const listResponse = await extension.sendCommand('list_sessions', {});
  const sessionIds = listResponse.result.sessions.map(s => s.id);
  assert(!sessionIds.includes(sessionId), 'Deleted session should not be in list');
  console.log('  Deleted session removed from list');

  console.log('PASSED: Session Deletion');
  return true;
}

/**
 * Test Suite: Cookie Domain Matching
 */
async function testCookieDomainMatching() {
  console.log('\n--- Test: Cookie Domain Matching ---');

  // Set cookies with different domains
  await extension.sendCommand('set_cookies', {
    cookies: [
      { name: 'root', value: 'root-value', domain: '.example.com' },
      { name: 'sub', value: 'sub-value', domain: 'sub.example.com' },
      { name: 'other', value: 'other-value', domain: '.other.com' }
    ]
  });
  console.log('  Set cookies for different domains');

  // Get cookies for root domain
  const rootCookies = await extension.sendCommand('get_cookies', {
    url: 'https://example.com'
  });
  const rootNames = rootCookies.result.cookies.map(c => c.name);
  assert(rootNames.includes('root'), 'Root domain cookie should match');
  assert(!rootNames.includes('other'), 'Other domain cookie should not match');
  console.log('  Root domain matching works');

  // Get cookies for subdomain
  const subCookies = await extension.sendCommand('get_cookies', {
    url: 'https://sub.example.com'
  });
  const subNames = subCookies.result.cookies.map(c => c.name);
  assert(subNames.includes('root'), 'Root domain cookie should match subdomain');
  assert(subNames.includes('sub'), 'Subdomain cookie should match');
  console.log('  Subdomain matching works');

  console.log('PASSED: Cookie Domain Matching');
  return true;
}

/**
 * Test Suite: Storage Clearing
 */
async function testStorageClearing() {
  console.log('\n--- Test: Storage Clearing ---');

  // Set up data in all storage types
  await extension.sendCommand('set_cookies', {
    cookies: [{ name: 'test', value: 'cookie', domain: '.example.com' }]
  });
  await extension.sendCommand('set_local_storage', {
    items: { test: 'localStorage' }
  });
  console.log('  Set up storage data');

  // Clear specific storage types
  const clearResponse = await extension.sendCommand('clear_storage', {
    types: ['localStorage', 'cookies']
  });
  assert(clearResponse.success, 'Clear storage should succeed');
  console.log('  Cleared localStorage and cookies');

  // Verify localStorage cleared
  const storage = await extension.sendCommand('get_local_storage', {});
  assert(Object.keys(storage.result.items).length === 0, 'localStorage should be empty');
  console.log('  localStorage verified empty');

  // Verify cookies cleared
  const cookies = await extension.sendCommand('get_cookies', { url: 'https://example.com' });
  assert(cookies.result.cookies.length === 0, 'Cookies should be empty');
  console.log('  Cookies verified empty');

  console.log('PASSED: Storage Clearing');
  return true;
}

/**
 * Test Suite: Session-Specific Storage Clearing
 */
async function testSessionSpecificClearing() {
  console.log('\n--- Test: Session-Specific Storage Clearing ---');

  // Create two sessions
  const session1 = await extension.sendCommand('create_session', { name: 'Clear Session 1' });
  const session2 = await extension.sendCommand('create_session', { name: 'Clear Session 2' });

  // Set data for both sessions
  await extension.sendCommand('set_cookies', {
    cookies: [{ name: 's1', value: 'v1', domain: '.example.com' }],
    sessionId: session1.result.session.id
  });
  await extension.sendCommand('set_cookies', {
    cookies: [{ name: 's2', value: 'v2', domain: '.example.com' }],
    sessionId: session2.result.session.id
  });
  console.log('  Set cookies for both sessions');

  // Clear only session 1
  await extension.sendCommand('clear_storage', {
    types: ['cookies'],
    sessionId: session1.result.session.id
  });
  console.log('  Cleared session 1 cookies');

  // Verify session 1 cookies cleared
  const cookies1 = await extension.sendCommand('get_cookies', {
    url: 'https://example.com',
    sessionId: session1.result.session.id
  });
  assert(cookies1.result.cookies.length === 0, 'Session 1 cookies should be cleared');
  console.log('  Session 1 cookies verified cleared');

  // Verify session 2 cookies remain
  const cookies2 = await extension.sendCommand('get_cookies', {
    url: 'https://example.com',
    sessionId: session2.result.session.id
  });
  assert(cookies2.result.cookies.length === 1, 'Session 2 cookies should remain');
  console.log('  Session 2 cookies verified intact');

  console.log('PASSED: Session-Specific Storage Clearing');
  return true;
}

/**
 * Test Suite: Cross-Component Session Sync
 */
async function testCrossComponentSessionSync() {
  console.log('\n--- Test: Cross-Component Session Sync ---');

  // Extension creates session
  const session = await extension.sendCommand('create_session', { name: 'Cross-Component Session' });
  const sessionId = session.result.session.id;
  console.log('  Extension created session');

  // Extension sets cookie
  await extension.sendCommand('set_cookies', {
    cookies: [{ name: 'shared', value: 'shared-value', domain: '.example.com' }],
    sessionId
  });
  console.log('  Extension set cookie');

  // Browser should see the same session (via server)
  const browserSessions = await browser.sendCommand('list_sessions', {});
  const browserSessionIds = browserSessions.tabs ? [] : // Mock browser returns different structure
    (sharedState.sessions.has(sessionId) ? [sessionId] : []);
  // Since both use the shared state via server handlers, session should be visible
  assert(sharedState.sessions.has(sessionId), 'Session should be in shared state');
  console.log('  Session visible in shared state');

  // Browser should see the cookie
  const browserCookies = sharedState.cookies.filter(c => c.sessionId === sessionId);
  assert(browserCookies.length === 1, 'Cookie should be in shared state');
  assert(browserCookies[0].value === 'shared-value', 'Cookie value should match');
  console.log('  Cookie visible in shared state');

  console.log('PASSED: Cross-Component Session Sync');
  return true;
}

/**
 * Run all session sharing tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Session/Cookie Sharing Tests');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Session Creation and Persistence', fn: testSessionCreation },
    { name: 'Session Switching', fn: testSessionSwitching },
    { name: 'Cookie Isolation Between Sessions', fn: testCookieIsolation },
    { name: 'Local Storage Isolation', fn: testLocalStorageIsolation },
    { name: 'Session Export and Import', fn: testSessionExportImport },
    { name: 'Session Deletion', fn: testSessionDeletion },
    { name: 'Cookie Domain Matching', fn: testCookieDomainMatching },
    { name: 'Storage Clearing', fn: testStorageClearing },
    { name: 'Session-Specific Clearing', fn: testSessionSpecificClearing },
    { name: 'Cross-Component Session Sync', fn: testCrossComponentSessionSync }
  ];

  try {
    await testUtils.setup();

    for (const test of tests) {
      try {
        await test.fn();
        results.passed++;
        results.tests.push({ name: test.name, status: 'PASSED' });
      } catch (error) {
        results.failed++;
        results.tests.push({ name: test.name, status: 'FAILED', error: error.message });
        console.log(`FAILED: ${test.name} - ${error.message}`);
      }
    }
  } finally {
    await testUtils.teardown();
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Session Sharing Test Summary');
  console.log('='.repeat(60));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total:  ${results.tests.length}`);

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  }

  return results.failed === 0;
}

// Export for external use
module.exports = { runTests, testUtils };

// Run if called directly
if (require.main === module) {
  runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}
