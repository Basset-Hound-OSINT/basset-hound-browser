/**
 * Session/Cookie Sharing Integration Tests
 *
 * Tests session and cookie sharing between the Chrome extension and Electron browser.
 * Verifies session isolation, cookie synchronization, and storage persistence.
 */

const assert = require('assert');
const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8772;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

// Test state
let server = null;
let extension = null;
let browser = null;

// Shared data store simulating the backend
const sharedState = {
  sessions: new Map(),
  cookies: new Map(),
  localStorage: new Map(),
  sessionStorage: new Map(),
  activeSession: 'default'
};

/**
 * Test utilities
 */
const testUtils = {
  async setup() {
    // Reset shared state
    sharedState.sessions.clear();
    sharedState.cookies.clear();
    sharedState.localStorage.clear();
    sharedState.sessionStorage.clear();
    sharedState.activeSession = 'default';

    // Initialize default session
    sharedState.sessions.set('default', {
      id: 'default',
      name: 'Default Session',
      createdAt: new Date().toISOString(),
      cookies: [],
      localStorage: {},
      sessionStorage: {}
    });

    server = new TestServer({ port: TEST_PORT });
    setupServerHandlers();
    await server.start();

    extension = new MockExtension({ url: TEST_URL, autoReconnect: false });
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
  // Session creation
  server.registerHandler('create_session', async (params) => {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const session = {
      id: sessionId,
      name: params.name || `Session ${sessionId.substr(0, 8)}`,
      createdAt: new Date().toISOString(),
      userAgent: params.userAgent,
      fingerprint: params.fingerprint,
      cookies: [],
      localStorage: {},
      sessionStorage: {}
    };
    sharedState.sessions.set(sessionId, session);
    return { success: true, session: { id: session.id, name: session.name } };
  });

  // Session switching
  server.registerHandler('switch_session', async (params) => {
    if (!sharedState.sessions.has(params.sessionId)) {
      return { success: false, error: 'Session not found' };
    }
    sharedState.activeSession = params.sessionId;
    const session = sharedState.sessions.get(params.sessionId);
    return { success: true, sessionId: params.sessionId, session: { id: session.id, name: session.name } };
  });

  // Session deletion
  server.registerHandler('delete_session', async (params) => {
    if (params.sessionId === 'default') {
      return { success: false, error: 'Cannot delete default session' };
    }
    if (!sharedState.sessions.has(params.sessionId)) {
      return { success: false, error: 'Session not found' };
    }
    sharedState.sessions.delete(params.sessionId);
    if (sharedState.activeSession === params.sessionId) {
      sharedState.activeSession = 'default';
    }
    return { success: true };
  });

  // List sessions
  server.registerHandler('list_sessions', async () => {
    const sessions = [];
    sharedState.sessions.forEach((session, id) => {
      sessions.push({
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        isActive: id === sharedState.activeSession
      });
    });
    return { success: true, sessions, activeSessionId: sharedState.activeSession };
  });

  // Get active session
  server.registerHandler('get_active_session', async () => {
    const session = sharedState.sessions.get(sharedState.activeSession);
    return { success: true, session: { id: session.id, name: session.name } };
  });

  // Session export
  server.registerHandler('export_session', async (params) => {
    const session = sharedState.sessions.get(params.sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    return {
      success: true,
      data: {
        session: { id: session.id, name: session.name, userAgent: session.userAgent },
        cookies: session.cookies,
        localStorage: session.localStorage,
        exportedAt: new Date().toISOString()
      }
    };
  });

  // Session import
  server.registerHandler('import_session', async (params) => {
    const { data } = params;
    const sessionId = `imported-${Date.now()}`;
    const session = {
      id: sessionId,
      name: `${data.session.name} (Imported)`,
      createdAt: new Date().toISOString(),
      userAgent: data.session.userAgent,
      cookies: data.cookies || [],
      localStorage: data.localStorage || {},
      sessionStorage: {}
    };
    sharedState.sessions.set(sessionId, session);
    return { success: true, sessionId, session: { id: session.id, name: session.name } };
  });

  // Cookie operations (session-aware)
  server.registerHandler('set_cookies', async (params) => {
    const sessionId = params.sessionId || sharedState.activeSession;
    const session = sharedState.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const results = [];
    for (const cookie of params.cookies) {
      const cookieEntry = {
        ...cookie,
        sessionId,
        setAt: Date.now()
      };
      session.cookies.push(cookieEntry);
      results.push({ name: cookie.name, success: true });
    }

    return { success: true, count: params.cookies.length, results };
  });

  server.registerHandler('get_cookies', async (params) => {
    const sessionId = params.sessionId || sharedState.activeSession;
    const session = sharedState.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    let cookies = [...session.cookies];

    // Filter by URL/domain if provided
    if (params.url) {
      try {
        const url = new URL(params.url);
        cookies = cookies.filter(c =>
          c.domain === url.hostname ||
          url.hostname.endsWith((c.domain || '').replace(/^\./, ''))
        );
      } catch {
        // Invalid URL
        cookies = [];
      }
    }

    // Filter by name if provided
    if (params.name) {
      cookies = cookies.filter(c => c.name === params.name);
    }

    return { success: true, cookies, count: cookies.length };
  });

  server.registerHandler('clear_cookies', async (params) => {
    const sessionId = params.sessionId || sharedState.activeSession;
    const session = sharedState.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const initialCount = session.cookies.length;

    if (params.domain) {
      session.cookies = session.cookies.filter(c => c.domain !== params.domain);
    } else if (params.name) {
      session.cookies = session.cookies.filter(c => c.name !== params.name);
    } else {
      session.cookies = [];
    }

    return { success: true, cleared: initialCount - session.cookies.length };
  });

  // LocalStorage operations (session-aware)
  server.registerHandler('set_local_storage', async (params) => {
    const sessionId = params.sessionId || sharedState.activeSession;
    const session = sharedState.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    Object.assign(session.localStorage, params.items);
    return { success: true, count: Object.keys(params.items).length };
  });

  server.registerHandler('get_local_storage', async (params) => {
    const sessionId = params.sessionId || sharedState.activeSession;
    const session = sharedState.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    let items = { ...session.localStorage };
    if (params.keys && Array.isArray(params.keys)) {
      items = {};
      params.keys.forEach(k => {
        if (session.localStorage[k] !== undefined) {
          items[k] = session.localStorage[k];
        }
      });
    }

    return { success: true, items };
  });

  // Clear all storage
  server.registerHandler('clear_storage', async (params) => {
    const sessionId = params.sessionId || sharedState.activeSession;
    const session = sharedState.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const types = params.types || ['cookies', 'localStorage', 'sessionStorage'];
    const results = {};

    if (types.includes('cookies')) {
      const count = session.cookies.length;
      session.cookies = [];
      results.cookies = { success: true, cleared: count };
    }

    if (types.includes('localStorage')) {
      const count = Object.keys(session.localStorage).length;
      session.localStorage = {};
      results.localStorage = { success: true, cleared: count };
    }

    if (types.includes('sessionStorage')) {
      const count = Object.keys(session.sessionStorage).length;
      session.sessionStorage = {};
      results.sessionStorage = { success: true, cleared: count };
    }

    return { success: true, results };
  });

  // Sync session data between extension and browser
  server.registerHandler('sync_session', async (params) => {
    const sessionId = params.sessionId || sharedState.activeSession;
    const session = sharedState.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    return {
      success: true,
      sessionId,
      data: {
        cookies: session.cookies,
        localStorage: session.localStorage,
        sessionStorage: session.sessionStorage
      }
    };
  });
}

/**
 * Test Suite: Session Creation and Isolation
 */
async function testSessionCreationAndIsolation() {
  console.log('\n--- Test: Session Creation and Isolation ---');

  // Create first session from extension
  const session1Response = await extension.sendCommand('create_session', {
    name: 'Extension Session 1',
    userAgent: 'Mozilla/5.0 Extension Test'
  });

  assert(session1Response.success, 'Session 1 creation should succeed');
  const session1Id = session1Response.result.session.id;
  console.log('  Session 1 created from extension');

  // Create second session from browser
  const session2Response = await browser.sendCommand('create_session', {
    name: 'Browser Session 2',
    userAgent: 'Mozilla/5.0 Browser Test'
  });

  assert(session2Response.success, 'Session 2 creation should succeed');
  const session2Id = session2Response.result.session.id;
  console.log('  Session 2 created from browser');

  // Verify both sessions exist
  const listResponse = await extension.sendCommand('list_sessions', {});
  assert(listResponse.success, 'List sessions should succeed');
  const sessionIds = listResponse.result.sessions.map(s => s.id);
  assert(sessionIds.includes(session1Id), 'Session 1 should be in list');
  assert(sessionIds.includes(session2Id), 'Session 2 should be in list');
  console.log('  Both sessions visible from both components');

  console.log('PASSED: Session Creation and Isolation');
  return true;
}

/**
 * Test Suite: Cookie Isolation Between Sessions
 */
async function testCookieIsolationBetweenSessions() {
  console.log('\n--- Test: Cookie Isolation Between Sessions ---');

  // Create two sessions
  const session1 = await extension.sendCommand('create_session', { name: 'Cookie Session 1' });
  const session2 = await extension.sendCommand('create_session', { name: 'Cookie Session 2' });

  const session1Id = session1.result.session.id;
  const session2Id = session2.result.session.id;

  // Set cookies for session 1
  await extension.sendCommand('set_cookies', {
    cookies: [
      { name: 'auth', value: 'token-session-1', domain: '.example.com' },
      { name: 'user', value: 'user1', domain: '.example.com' }
    ],
    sessionId: session1Id
  });
  console.log('  Set cookies for session 1');

  // Set different cookies for session 2
  await extension.sendCommand('set_cookies', {
    cookies: [
      { name: 'auth', value: 'token-session-2', domain: '.example.com' },
      { name: 'user', value: 'user2', domain: '.example.com' }
    ],
    sessionId: session2Id
  });
  console.log('  Set cookies for session 2');

  // Get cookies for session 1
  const cookies1Response = await extension.sendCommand('get_cookies', {
    url: 'https://example.com',
    sessionId: session1Id
  });

  assert(cookies1Response.success, 'Get session 1 cookies should succeed');
  const auth1 = cookies1Response.result.cookies.find(c => c.name === 'auth');
  assert(auth1.value === 'token-session-1', 'Session 1 should have correct auth cookie');
  console.log('  Session 1 cookies isolated correctly');

  // Get cookies for session 2
  const cookies2Response = await extension.sendCommand('get_cookies', {
    url: 'https://example.com',
    sessionId: session2Id
  });

  assert(cookies2Response.success, 'Get session 2 cookies should succeed');
  const auth2 = cookies2Response.result.cookies.find(c => c.name === 'auth');
  assert(auth2.value === 'token-session-2', 'Session 2 should have correct auth cookie');
  console.log('  Session 2 cookies isolated correctly');

  // Verify isolation
  assert(auth1.value !== auth2.value, 'Cookie values should be different between sessions');

  console.log('PASSED: Cookie Isolation Between Sessions');
  return true;
}

/**
 * Test Suite: LocalStorage Isolation Between Sessions
 */
async function testLocalStorageIsolationBetweenSessions() {
  console.log('\n--- Test: LocalStorage Isolation Between Sessions ---');

  // Create two sessions
  const session1 = await extension.sendCommand('create_session', { name: 'Storage Session 1' });
  const session2 = await extension.sendCommand('create_session', { name: 'Storage Session 2' });

  const session1Id = session1.result.session.id;
  const session2Id = session2.result.session.id;

  // Set localStorage for session 1
  await extension.sendCommand('set_local_storage', {
    items: { theme: 'dark', user: 'user1', preferences: JSON.stringify({ lang: 'en' }) },
    sessionId: session1Id
  });
  console.log('  Set localStorage for session 1');

  // Set localStorage for session 2
  await extension.sendCommand('set_local_storage', {
    items: { theme: 'light', user: 'user2', preferences: JSON.stringify({ lang: 'es' }) },
    sessionId: session2Id
  });
  console.log('  Set localStorage for session 2');

  // Get localStorage for session 1
  const storage1Response = await extension.sendCommand('get_local_storage', {
    sessionId: session1Id
  });

  assert(storage1Response.success, 'Get session 1 localStorage should succeed');
  assert(storage1Response.result.items.theme === 'dark', 'Session 1 theme should be dark');
  assert(storage1Response.result.items.user === 'user1', 'Session 1 user should be user1');
  console.log('  Session 1 localStorage isolated correctly');

  // Get localStorage for session 2
  const storage2Response = await extension.sendCommand('get_local_storage', {
    sessionId: session2Id
  });

  assert(storage2Response.success, 'Get session 2 localStorage should succeed');
  assert(storage2Response.result.items.theme === 'light', 'Session 2 theme should be light');
  assert(storage2Response.result.items.user === 'user2', 'Session 2 user should be user2');
  console.log('  Session 2 localStorage isolated correctly');

  console.log('PASSED: LocalStorage Isolation Between Sessions');
  return true;
}

/**
 * Test Suite: Session Switching
 */
async function testSessionSwitching() {
  console.log('\n--- Test: Session Switching ---');

  // Create sessions
  const session1 = await extension.sendCommand('create_session', { name: 'Switch Session 1' });
  const session2 = await extension.sendCommand('create_session', { name: 'Switch Session 2' });

  const session1Id = session1.result.session.id;
  const session2Id = session2.result.session.id;

  // Set data for each session
  await extension.sendCommand('set_cookies', {
    cookies: [{ name: 'session', value: '1', domain: '.example.com' }],
    sessionId: session1Id
  });

  await extension.sendCommand('set_cookies', {
    cookies: [{ name: 'session', value: '2', domain: '.example.com' }],
    sessionId: session2Id
  });

  // Switch to session 1
  const switch1Response = await extension.sendCommand('switch_session', {
    sessionId: session1Id
  });

  assert(switch1Response.success, 'Switch to session 1 should succeed');
  console.log('  Switched to session 1');

  // Verify active session
  const active1Response = await extension.sendCommand('get_active_session', {});
  assert(active1Response.result.session.id === session1Id, 'Active session should be session 1');

  // Get cookies (should use active session)
  const cookies1 = await extension.sendCommand('get_cookies', { url: 'https://example.com' });
  const sessionCookie1 = cookies1.result.cookies.find(c => c.name === 'session');
  assert(sessionCookie1.value === '1', 'Should get session 1 cookies');
  console.log('  Session 1 data accessible after switch');

  // Switch to session 2
  const switch2Response = await extension.sendCommand('switch_session', {
    sessionId: session2Id
  });

  assert(switch2Response.success, 'Switch to session 2 should succeed');
  console.log('  Switched to session 2');

  // Get cookies (should use new active session)
  const cookies2 = await extension.sendCommand('get_cookies', { url: 'https://example.com' });
  const sessionCookie2 = cookies2.result.cookies.find(c => c.name === 'session');
  assert(sessionCookie2.value === '2', 'Should get session 2 cookies');
  console.log('  Session 2 data accessible after switch');

  console.log('PASSED: Session Switching');
  return true;
}

/**
 * Test Suite: Cross-Component Cookie Sync
 */
async function testCrossComponentCookieSync() {
  console.log('\n--- Test: Cross-Component Cookie Sync ---');

  // Extension sets cookies
  await extension.sendCommand('set_cookies', {
    cookies: [
      { name: 'ext_cookie', value: 'from_extension', domain: '.example.com' }
    ]
  });
  console.log('  Extension set cookie');

  // Browser should see the same cookie
  const browserCookies = await browser.sendCommand('get_cookies', {
    url: 'https://example.com'
  });

  assert(browserCookies.success, 'Browser get cookies should succeed');
  const extCookie = browserCookies.result.cookies.find(c => c.name === 'ext_cookie');
  assert(extCookie, 'Browser should see extension cookie');
  assert(extCookie.value === 'from_extension', 'Cookie value should match');
  console.log('  Browser sees extension cookie');

  // Browser sets a cookie
  await browser.sendCommand('set_cookies', {
    cookies: [
      { name: 'browser_cookie', value: 'from_browser', domain: '.example.com' }
    ]
  });
  console.log('  Browser set cookie');

  // Extension should see the browser cookie
  const extensionCookies = await extension.sendCommand('get_cookies', {
    url: 'https://example.com'
  });

  const browserCookie = extensionCookies.result.cookies.find(c => c.name === 'browser_cookie');
  assert(browserCookie, 'Extension should see browser cookie');
  assert(browserCookie.value === 'from_browser', 'Cookie value should match');
  console.log('  Extension sees browser cookie');

  console.log('PASSED: Cross-Component Cookie Sync');
  return true;
}

/**
 * Test Suite: Session Export and Import
 */
async function testSessionExportAndImport() {
  console.log('\n--- Test: Session Export and Import ---');

  // Create a session with data
  const sessionResponse = await extension.sendCommand('create_session', {
    name: 'Export Test Session',
    userAgent: 'Mozilla/5.0 Test'
  });
  const sessionId = sessionResponse.result.session.id;

  // Add data to session
  await extension.sendCommand('set_cookies', {
    cookies: [
      { name: 'auth', value: 'export-token', domain: '.example.com' },
      { name: 'pref', value: 'dark-mode', domain: '.example.com' }
    ],
    sessionId
  });

  await extension.sendCommand('set_local_storage', {
    items: { settings: '{"theme":"dark"}', user: 'exportUser' },
    sessionId
  });
  console.log('  Created session with data');

  // Export session
  const exportResponse = await extension.sendCommand('export_session', { sessionId });

  assert(exportResponse.success, 'Export should succeed');
  assert(exportResponse.result.data.session, 'Export should include session');
  assert(exportResponse.result.data.cookies.length === 2, 'Export should include cookies');
  console.log('  Session exported successfully');

  const exportData = exportResponse.result.data;

  // Import session
  const importResponse = await extension.sendCommand('import_session', { data: exportData });

  assert(importResponse.success, 'Import should succeed');
  const importedSessionId = importResponse.result.sessionId;
  assert(importedSessionId !== sessionId, 'Imported session should have new ID');
  console.log('  Session imported with new ID');

  // Verify imported data
  const importedCookies = await extension.sendCommand('get_cookies', {
    url: 'https://example.com',
    sessionId: importedSessionId
  });

  assert(importedCookies.result.cookies.length === 2, 'Imported session should have cookies');
  console.log('  Imported session data verified');

  console.log('PASSED: Session Export and Import');
  return true;
}

/**
 * Test Suite: Session Deletion
 */
async function testSessionDeletion() {
  console.log('\n--- Test: Session Deletion ---');

  // Create a session
  const sessionResponse = await extension.sendCommand('create_session', { name: 'Delete Me' });
  const sessionId = sessionResponse.result.session.id;

  // Add some data
  await extension.sendCommand('set_cookies', {
    cookies: [{ name: 'test', value: 'data', domain: '.example.com' }],
    sessionId
  });
  console.log('  Created session to delete');

  // Try to delete default session (should fail)
  const deleteDefaultResponse = await extension.sendCommand('delete_session', { sessionId: 'default' });
  assert(!deleteDefaultResponse.success, 'Deleting default session should fail');
  console.log('  Default session protected');

  // Delete the created session
  const deleteResponse = await extension.sendCommand('delete_session', { sessionId });
  assert(deleteResponse.success, 'Delete session should succeed');
  console.log('  Session deleted');

  // Verify session is gone
  const listResponse = await extension.sendCommand('list_sessions', {});
  const sessionIds = listResponse.result.sessions.map(s => s.id);
  assert(!sessionIds.includes(sessionId), 'Deleted session should not be in list');
  console.log('  Session removed from list');

  // Try to access deleted session
  const accessResponse = await extension.sendCommand('get_cookies', {
    url: 'https://example.com',
    sessionId
  });
  assert(!accessResponse.success, 'Accessing deleted session should fail');
  console.log('  Deleted session data inaccessible');

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
      { name: 'exact', value: 'exact-value', domain: 'www.example.com' },
      { name: 'other', value: 'other-value', domain: '.other.com' }
    ]
  });
  console.log('  Set cookies for different domains');

  // Get cookies for root domain
  const rootCookies = await extension.sendCommand('get_cookies', { url: 'https://example.com' });
  const rootNames = rootCookies.result.cookies.map(c => c.name);
  assert(rootNames.includes('root'), 'Root domain should match .example.com');
  assert(!rootNames.includes('sub'), 'Root domain should not match sub.example.com');
  assert(!rootNames.includes('other'), 'Root domain should not match .other.com');
  console.log('  Root domain matching correct');

  // Get cookies for subdomain
  const subCookies = await extension.sendCommand('get_cookies', { url: 'https://sub.example.com' });
  const subNames = subCookies.result.cookies.map(c => c.name);
  assert(subNames.includes('root'), 'Subdomain should match .example.com');
  assert(subNames.includes('sub'), 'Subdomain should match sub.example.com');
  console.log('  Subdomain matching correct');

  // Get cookies for www subdomain
  const wwwCookies = await extension.sendCommand('get_cookies', { url: 'https://www.example.com' });
  const wwwNames = wwwCookies.result.cookies.map(c => c.name);
  assert(wwwNames.includes('root'), 'WWW should match .example.com');
  assert(wwwNames.includes('exact'), 'WWW should match www.example.com');
  console.log('  WWW subdomain matching correct');

  console.log('PASSED: Cookie Domain Matching');
  return true;
}

/**
 * Test Suite: Storage Clearing
 */
async function testStorageClearing() {
  console.log('\n--- Test: Storage Clearing ---');

  // Create session with data
  const sessionResponse = await extension.sendCommand('create_session', { name: 'Clear Test' });
  const sessionId = sessionResponse.result.session.id;

  // Set various data
  await extension.sendCommand('set_cookies', {
    cookies: [
      { name: 'c1', value: 'v1', domain: '.example.com' },
      { name: 'c2', value: 'v2', domain: '.example.com' }
    ],
    sessionId
  });

  await extension.sendCommand('set_local_storage', {
    items: { key1: 'value1', key2: 'value2' },
    sessionId
  });
  console.log('  Set up test data');

  // Clear only cookies
  const clearCookiesResponse = await extension.sendCommand('clear_storage', {
    types: ['cookies'],
    sessionId
  });

  assert(clearCookiesResponse.success, 'Clear cookies should succeed');
  console.log('  Cleared cookies');

  // Verify cookies cleared but localStorage remains
  const cookiesAfter = await extension.sendCommand('get_cookies', {
    url: 'https://example.com',
    sessionId
  });
  assert(cookiesAfter.result.cookies.length === 0, 'Cookies should be empty');

  const storageAfter = await extension.sendCommand('get_local_storage', { sessionId });
  assert(Object.keys(storageAfter.result.items).length === 2, 'localStorage should remain');
  console.log('  Selective clearing verified');

  // Clear all storage
  const clearAllResponse = await extension.sendCommand('clear_storage', { sessionId });
  assert(clearAllResponse.success, 'Clear all should succeed');

  const finalStorage = await extension.sendCommand('get_local_storage', { sessionId });
  assert(Object.keys(finalStorage.result.items).length === 0, 'localStorage should be empty');
  console.log('  Complete clearing verified');

  console.log('PASSED: Storage Clearing');
  return true;
}

/**
 * Test Suite: Session Sync Across Components
 */
async function testSessionSyncAcrossComponents() {
  console.log('\n--- Test: Session Sync Across Components ---');

  // Extension creates session and adds data
  const sessionResponse = await extension.sendCommand('create_session', { name: 'Sync Test Session' });
  const sessionId = sessionResponse.result.session.id;

  await extension.sendCommand('set_cookies', {
    cookies: [{ name: 'sync_test', value: 'from_extension', domain: '.example.com' }],
    sessionId
  });

  await extension.sendCommand('set_local_storage', {
    items: { sync_key: 'sync_value' },
    sessionId
  });
  console.log('  Extension added data to session');

  // Browser syncs and gets the data
  const syncResponse = await browser.sendCommand('sync_session', { sessionId });

  assert(syncResponse.success, 'Sync should succeed');
  assert(syncResponse.result.data.cookies.length === 1, 'Synced data should have cookies');
  assert(syncResponse.result.data.localStorage.sync_key === 'sync_value', 'Synced data should have localStorage');
  console.log('  Browser synced session data');

  // Browser adds more data
  await browser.sendCommand('set_cookies', {
    cookies: [{ name: 'browser_sync', value: 'from_browser', domain: '.example.com' }],
    sessionId
  });
  console.log('  Browser added data to session');

  // Extension syncs and sees all data
  const extensionSyncResponse = await extension.sendCommand('sync_session', { sessionId });

  assert(extensionSyncResponse.result.data.cookies.length === 2, 'Extension should see both cookies');
  console.log('  Extension synced updated session data');

  console.log('PASSED: Session Sync Across Components');
  return true;
}

/**
 * Run all session/cookie sharing tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Session/Cookie Sharing Integration Tests');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Session Creation and Isolation', fn: testSessionCreationAndIsolation },
    { name: 'Cookie Isolation Between Sessions', fn: testCookieIsolationBetweenSessions },
    { name: 'LocalStorage Isolation Between Sessions', fn: testLocalStorageIsolationBetweenSessions },
    { name: 'Session Switching', fn: testSessionSwitching },
    { name: 'Cross-Component Cookie Sync', fn: testCrossComponentCookieSync },
    { name: 'Session Export and Import', fn: testSessionExportAndImport },
    { name: 'Session Deletion', fn: testSessionDeletion },
    { name: 'Cookie Domain Matching', fn: testCookieDomainMatching },
    { name: 'Storage Clearing', fn: testStorageClearing },
    { name: 'Session Sync Across Components', fn: testSessionSyncAcrossComponents }
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
  console.log('Session/Cookie Sharing Test Summary');
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
