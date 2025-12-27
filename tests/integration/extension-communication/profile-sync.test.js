/**
 * Profile Synchronization Integration Tests
 *
 * Tests profile synchronization between the Chrome extension and Electron browser.
 * Verifies profile data, fingerprint settings, and user agent synchronization.
 */

const assert = require('assert');
const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8773;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

// Test state
let server = null;
let extension = null;
let browser = null;

// Profile store
const profileStore = {
  profiles: new Map(),
  activeProfile: null
};

/**
 * Test utilities
 */
const testUtils = {
  async setup() {
    // Reset profile store
    profileStore.profiles.clear();
    profileStore.activeProfile = null;

    // Create default profile
    profileStore.profiles.set('default', {
      id: 'default',
      name: 'Default Profile',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      fingerprint: {
        screen: { width: 1920, height: 1080 },
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'Win32',
        hardwareConcurrency: 8,
        deviceMemory: 8
      },
      proxy: null,
      headers: {},
      createdAt: new Date().toISOString()
    });
    profileStore.activeProfile = 'default';

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
 * Setup server handlers for profile management
 */
function setupServerHandlers() {
  // Create profile
  server.registerHandler('create_profile', async (params) => {
    const profileId = `profile-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const profile = {
      id: profileId,
      name: params.name || `Profile ${profileId.substr(0, 8)}`,
      userAgent: params.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      fingerprint: {
        screen: params.fingerprint?.screen || { width: 1920, height: 1080 },
        timezone: params.fingerprint?.timezone || 'UTC',
        language: params.fingerprint?.language || 'en-US',
        platform: params.fingerprint?.platform || 'Win32',
        hardwareConcurrency: params.fingerprint?.hardwareConcurrency || 4,
        deviceMemory: params.fingerprint?.deviceMemory || 8,
        webgl: params.fingerprint?.webgl || { vendor: 'Google Inc.', renderer: 'ANGLE' },
        canvas: params.fingerprint?.canvas || null
      },
      proxy: params.proxy || null,
      headers: params.headers || {},
      geolocation: params.geolocation || null,
      createdAt: new Date().toISOString()
    };

    profileStore.profiles.set(profileId, profile);
    return { success: true, profile };
  });

  // Get profile
  server.registerHandler('get_profile', async (params) => {
    const profileId = params.profileId || profileStore.activeProfile;
    const profile = profileStore.profiles.get(profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    return { success: true, profile };
  });

  // Update profile
  server.registerHandler('update_profile', async (params) => {
    const profile = profileStore.profiles.get(params.profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Update fields
    if (params.name !== undefined) profile.name = params.name;
    if (params.userAgent !== undefined) profile.userAgent = params.userAgent;
    if (params.fingerprint !== undefined) {
      profile.fingerprint = { ...profile.fingerprint, ...params.fingerprint };
    }
    if (params.proxy !== undefined) profile.proxy = params.proxy;
    if (params.headers !== undefined) profile.headers = { ...profile.headers, ...params.headers };
    if (params.geolocation !== undefined) profile.geolocation = params.geolocation;

    profile.updatedAt = new Date().toISOString();

    return { success: true, profile };
  });

  // Delete profile
  server.registerHandler('delete_profile', async (params) => {
    if (params.profileId === 'default') {
      return { success: false, error: 'Cannot delete default profile' };
    }
    if (!profileStore.profiles.has(params.profileId)) {
      return { success: false, error: 'Profile not found' };
    }
    profileStore.profiles.delete(params.profileId);
    if (profileStore.activeProfile === params.profileId) {
      profileStore.activeProfile = 'default';
    }
    return { success: true };
  });

  // List profiles
  server.registerHandler('list_profiles', async () => {
    const profiles = [];
    profileStore.profiles.forEach((profile, id) => {
      profiles.push({
        id: profile.id,
        name: profile.name,
        userAgent: profile.userAgent,
        isActive: id === profileStore.activeProfile,
        createdAt: profile.createdAt
      });
    });
    return { success: true, profiles };
  });

  // Activate profile
  server.registerHandler('activate_profile', async (params) => {
    if (!profileStore.profiles.has(params.profileId)) {
      return { success: false, error: 'Profile not found' };
    }
    profileStore.activeProfile = params.profileId;
    const profile = profileStore.profiles.get(params.profileId);
    return { success: true, profileId: params.profileId, profile };
  });

  // Get active profile
  server.registerHandler('get_active_profile', async () => {
    const profile = profileStore.profiles.get(profileStore.activeProfile);
    return { success: true, profileId: profileStore.activeProfile, profile };
  });

  // Set user agent
  server.registerHandler('set_user_agent', async (params) => {
    const profileId = params.profileId || profileStore.activeProfile;
    const profile = profileStore.profiles.get(profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    profile.userAgent = params.userAgent;
    return { success: true, userAgent: params.userAgent };
  });

  // Get user agent
  server.registerHandler('get_user_agent', async (params) => {
    const profileId = params.profileId || profileStore.activeProfile;
    const profile = profileStore.profiles.get(profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    return { success: true, userAgent: profile.userAgent };
  });

  // Set fingerprint
  server.registerHandler('set_fingerprint', async (params) => {
    const profileId = params.profileId || profileStore.activeProfile;
    const profile = profileStore.profiles.get(profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    profile.fingerprint = { ...profile.fingerprint, ...params.fingerprint };
    return { success: true, fingerprint: profile.fingerprint };
  });

  // Get fingerprint
  server.registerHandler('get_fingerprint', async (params) => {
    const profileId = params.profileId || profileStore.activeProfile;
    const profile = profileStore.profiles.get(profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    return { success: true, fingerprint: profile.fingerprint };
  });

  // Set proxy
  server.registerHandler('set_proxy', async (params) => {
    const profileId = params.profileId || profileStore.activeProfile;
    const profile = profileStore.profiles.get(profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    profile.proxy = params.proxy;
    return { success: true, proxy: profile.proxy };
  });

  // Get proxy
  server.registerHandler('get_proxy', async (params) => {
    const profileId = params.profileId || profileStore.activeProfile;
    const profile = profileStore.profiles.get(profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    return { success: true, proxy: profile.proxy };
  });

  // Set custom headers
  server.registerHandler('set_headers', async (params) => {
    const profileId = params.profileId || profileStore.activeProfile;
    const profile = profileStore.profiles.get(profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    profile.headers = { ...profile.headers, ...params.headers };
    return { success: true, headers: profile.headers };
  });

  // Get headers
  server.registerHandler('get_headers', async (params) => {
    const profileId = params.profileId || profileStore.activeProfile;
    const profile = profileStore.profiles.get(profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    return { success: true, headers: profile.headers };
  });

  // Sync profile to browser
  server.registerHandler('sync_profile', async (params) => {
    const profileId = params.profileId || profileStore.activeProfile;
    const profile = profileStore.profiles.get(profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    return {
      success: true,
      synced: true,
      profile: {
        id: profile.id,
        name: profile.name,
        userAgent: profile.userAgent,
        fingerprint: profile.fingerprint,
        proxy: profile.proxy,
        headers: profile.headers,
        geolocation: profile.geolocation
      }
    };
  });

  // Export profile
  server.registerHandler('export_profile', async (params) => {
    const profile = profileStore.profiles.get(params.profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    return {
      success: true,
      data: {
        ...profile,
        exportedAt: new Date().toISOString()
      }
    };
  });

  // Import profile
  server.registerHandler('import_profile', async (params) => {
    const profileId = `imported-${Date.now()}`;
    const profile = {
      ...params.data,
      id: profileId,
      name: `${params.data.name} (Imported)`,
      importedAt: new Date().toISOString()
    };
    profileStore.profiles.set(profileId, profile);
    return { success: true, profileId, profile };
  });
}

/**
 * Test Suite: Profile Creation
 */
async function testProfileCreation() {
  console.log('\n--- Test: Profile Creation ---');

  // Create profile from extension
  const createResponse = await extension.sendCommand('create_profile', {
    name: 'Test Profile',
    userAgent: 'Mozilla/5.0 Custom User Agent',
    fingerprint: {
      screen: { width: 2560, height: 1440 },
      timezone: 'Europe/London',
      language: 'en-GB'
    }
  });

  assert(createResponse.success, 'Profile creation should succeed');
  assert(createResponse.result.profile.id, 'Profile should have ID');
  assert(createResponse.result.profile.name === 'Test Profile', 'Profile name should match');
  assert(createResponse.result.profile.userAgent.includes('Custom'), 'User agent should match');
  console.log('  Profile created with custom settings');

  // Verify profile exists
  const getResponse = await extension.sendCommand('get_profile', {
    profileId: createResponse.result.profile.id
  });

  assert(getResponse.success, 'Get profile should succeed');
  assert(getResponse.result.profile.fingerprint.timezone === 'Europe/London', 'Fingerprint should be saved');
  console.log('  Profile settings persisted');

  console.log('PASSED: Profile Creation');
  return true;
}

/**
 * Test Suite: Profile Activation
 */
async function testProfileActivation() {
  console.log('\n--- Test: Profile Activation ---');

  // Create two profiles
  const profile1Response = await extension.sendCommand('create_profile', {
    name: 'Profile 1',
    userAgent: 'UA Profile 1'
  });
  const profile1Id = profile1Response.result.profile.id;

  const profile2Response = await extension.sendCommand('create_profile', {
    name: 'Profile 2',
    userAgent: 'UA Profile 2'
  });
  const profile2Id = profile2Response.result.profile.id;
  console.log('  Created two profiles');

  // Activate profile 1
  const activate1Response = await extension.sendCommand('activate_profile', {
    profileId: profile1Id
  });

  assert(activate1Response.success, 'Activate profile 1 should succeed');
  console.log('  Activated profile 1');

  // Verify active profile
  const active1Response = await extension.sendCommand('get_active_profile', {});
  assert(active1Response.result.profileId === profile1Id, 'Active profile should be profile 1');
  console.log('  Verified active profile is profile 1');

  // Activate profile 2
  const activate2Response = await extension.sendCommand('activate_profile', {
    profileId: profile2Id
  });

  assert(activate2Response.success, 'Activate profile 2 should succeed');

  // Verify active profile changed
  const active2Response = await extension.sendCommand('get_active_profile', {});
  assert(active2Response.result.profileId === profile2Id, 'Active profile should be profile 2');
  console.log('  Verified active profile switched to profile 2');

  console.log('PASSED: Profile Activation');
  return true;
}

/**
 * Test Suite: User Agent Synchronization
 */
async function testUserAgentSynchronization() {
  console.log('\n--- Test: User Agent Synchronization ---');

  // Create profile with specific user agent
  const profileResponse = await extension.sendCommand('create_profile', {
    name: 'UA Test Profile',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
  });
  const profileId = profileResponse.result.profile.id;

  // Activate profile
  await extension.sendCommand('activate_profile', { profileId });
  console.log('  Profile activated');

  // Get user agent from extension
  const extensionUAResponse = await extension.sendCommand('get_user_agent', {});
  assert(extensionUAResponse.result.userAgent.includes('Macintosh'), 'Extension should see Mac user agent');
  console.log('  Extension sees correct user agent');

  // Browser should see same user agent
  const browserUAResponse = await browser.sendCommand('get_user_agent', {});
  assert(browserUAResponse.result.userAgent === extensionUAResponse.result.userAgent,
    'Browser and extension should have same user agent');
  console.log('  Browser sees synchronized user agent');

  // Update user agent from browser
  await browser.sendCommand('set_user_agent', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
  });
  console.log('  Browser updated user agent');

  // Extension should see updated user agent
  const updatedUAResponse = await extension.sendCommand('get_user_agent', {});
  assert(updatedUAResponse.result.userAgent.includes('Windows'), 'Extension should see updated Windows user agent');
  console.log('  Extension sees updated user agent');

  console.log('PASSED: User Agent Synchronization');
  return true;
}

/**
 * Test Suite: Fingerprint Synchronization
 */
async function testFingerprintSynchronization() {
  console.log('\n--- Test: Fingerprint Synchronization ---');

  // Create profile with custom fingerprint
  const profileResponse = await extension.sendCommand('create_profile', {
    name: 'Fingerprint Test',
    fingerprint: {
      screen: { width: 1366, height: 768 },
      timezone: 'Asia/Tokyo',
      language: 'ja-JP',
      platform: 'MacIntel',
      hardwareConcurrency: 4,
      deviceMemory: 16
    }
  });
  const profileId = profileResponse.result.profile.id;

  await extension.sendCommand('activate_profile', { profileId });
  console.log('  Created and activated profile with fingerprint');

  // Verify fingerprint from extension
  const extFPResponse = await extension.sendCommand('get_fingerprint', {});
  assert(extFPResponse.result.fingerprint.timezone === 'Asia/Tokyo', 'Extension should see Tokyo timezone');
  assert(extFPResponse.result.fingerprint.language === 'ja-JP', 'Extension should see Japanese language');
  console.log('  Extension sees correct fingerprint');

  // Browser should see same fingerprint
  const browserFPResponse = await browser.sendCommand('get_fingerprint', {});
  assert(browserFPResponse.result.fingerprint.timezone === extFPResponse.result.fingerprint.timezone,
    'Browser and extension should have same timezone');
  assert(browserFPResponse.result.fingerprint.screen.width === 1366, 'Browser should see correct screen width');
  console.log('  Browser sees synchronized fingerprint');

  // Update fingerprint component from extension
  await extension.sendCommand('set_fingerprint', {
    fingerprint: {
      webgl: { vendor: 'Apple Inc.', renderer: 'Apple GPU' }
    }
  });
  console.log('  Extension updated WebGL fingerprint');

  // Browser should see updated fingerprint
  const updatedFPResponse = await browser.sendCommand('get_fingerprint', {});
  assert(updatedFPResponse.result.fingerprint.webgl.vendor === 'Apple Inc.', 'Browser should see updated WebGL');
  console.log('  Browser sees updated fingerprint');

  console.log('PASSED: Fingerprint Synchronization');
  return true;
}

/**
 * Test Suite: Proxy Configuration Sync
 */
async function testProxyConfigurationSync() {
  console.log('\n--- Test: Proxy Configuration Sync ---');

  // Create profile
  const profileResponse = await extension.sendCommand('create_profile', {
    name: 'Proxy Test Profile'
  });
  const profileId = profileResponse.result.profile.id;

  await extension.sendCommand('activate_profile', { profileId });

  // Set proxy from extension
  await extension.sendCommand('set_proxy', {
    proxy: {
      type: 'http',
      host: 'proxy.example.com',
      port: 8080,
      username: 'user',
      password: 'pass'
    }
  });
  console.log('  Extension set proxy configuration');

  // Browser should see proxy
  const browserProxyResponse = await browser.sendCommand('get_proxy', {});
  assert(browserProxyResponse.result.proxy, 'Browser should see proxy');
  assert(browserProxyResponse.result.proxy.host === 'proxy.example.com', 'Proxy host should match');
  assert(browserProxyResponse.result.proxy.port === 8080, 'Proxy port should match');
  console.log('  Browser sees synchronized proxy');

  // Update proxy from browser
  await browser.sendCommand('set_proxy', {
    proxy: {
      type: 'socks5',
      host: 'socks.example.com',
      port: 1080
    }
  });
  console.log('  Browser updated proxy');

  // Extension should see updated proxy
  const updatedProxyResponse = await extension.sendCommand('get_proxy', {});
  assert(updatedProxyResponse.result.proxy.type === 'socks5', 'Extension should see SOCKS5 proxy');
  console.log('  Extension sees updated proxy');

  // Clear proxy
  await extension.sendCommand('set_proxy', { proxy: null });
  const clearedProxyResponse = await browser.sendCommand('get_proxy', {});
  assert(clearedProxyResponse.result.proxy === null, 'Proxy should be cleared');
  console.log('  Proxy cleared successfully');

  console.log('PASSED: Proxy Configuration Sync');
  return true;
}

/**
 * Test Suite: Custom Headers Sync
 */
async function testCustomHeadersSync() {
  console.log('\n--- Test: Custom Headers Sync ---');

  // Create profile
  const profileResponse = await extension.sendCommand('create_profile', {
    name: 'Headers Test Profile'
  });
  const profileId = profileResponse.result.profile.id;

  await extension.sendCommand('activate_profile', { profileId });

  // Set custom headers from extension
  await extension.sendCommand('set_headers', {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Custom-Header': 'custom-value',
      'DNT': '1'
    }
  });
  console.log('  Extension set custom headers');

  // Browser should see headers
  const browserHeadersResponse = await browser.sendCommand('get_headers', {});
  assert(browserHeadersResponse.result.headers['Accept-Language'] === 'en-US,en;q=0.9',
    'Browser should see Accept-Language');
  assert(browserHeadersResponse.result.headers['X-Custom-Header'] === 'custom-value',
    'Browser should see custom header');
  console.log('  Browser sees synchronized headers');

  // Add more headers from browser
  await browser.sendCommand('set_headers', {
    headers: {
      'X-Browser-Header': 'browser-value'
    }
  });
  console.log('  Browser added header');

  // Extension should see all headers
  const allHeadersResponse = await extension.sendCommand('get_headers', {});
  assert(allHeadersResponse.result.headers['X-Custom-Header'], 'Should keep existing header');
  assert(allHeadersResponse.result.headers['X-Browser-Header'] === 'browser-value',
    'Should have browser header');
  console.log('  Extension sees all headers');

  console.log('PASSED: Custom Headers Sync');
  return true;
}

/**
 * Test Suite: Profile Export and Import
 */
async function testProfileExportAndImport() {
  console.log('\n--- Test: Profile Export and Import ---');

  // Create complete profile
  const profileResponse = await extension.sendCommand('create_profile', {
    name: 'Export Test Profile',
    userAgent: 'Export UA',
    fingerprint: {
      screen: { width: 1920, height: 1080 },
      timezone: 'Europe/Paris'
    },
    headers: { 'Custom': 'Header' }
  });
  const profileId = profileResponse.result.profile.id;

  // Export profile
  const exportResponse = await extension.sendCommand('export_profile', { profileId });

  assert(exportResponse.success, 'Export should succeed');
  assert(exportResponse.result.data.name === 'Export Test Profile', 'Export should include name');
  assert(exportResponse.result.data.fingerprint, 'Export should include fingerprint');
  console.log('  Profile exported');

  const exportData = exportResponse.result.data;

  // Import profile
  const importResponse = await extension.sendCommand('import_profile', { data: exportData });

  assert(importResponse.success, 'Import should succeed');
  assert(importResponse.result.profileId !== profileId, 'Imported profile should have new ID');
  assert(importResponse.result.profile.name.includes('Imported'), 'Name should indicate import');
  console.log('  Profile imported');

  // Verify imported profile has all data
  const getImportedResponse = await extension.sendCommand('get_profile', {
    profileId: importResponse.result.profileId
  });

  assert(getImportedResponse.result.profile.userAgent === 'Export UA', 'User agent should be preserved');
  assert(getImportedResponse.result.profile.fingerprint.timezone === 'Europe/Paris',
    'Fingerprint should be preserved');
  console.log('  Imported profile data verified');

  console.log('PASSED: Profile Export and Import');
  return true;
}

/**
 * Test Suite: Profile Update Sync
 */
async function testProfileUpdateSync() {
  console.log('\n--- Test: Profile Update Sync ---');

  // Create profile
  const profileResponse = await extension.sendCommand('create_profile', {
    name: 'Update Test Profile',
    userAgent: 'Original UA'
  });
  const profileId = profileResponse.result.profile.id;

  await extension.sendCommand('activate_profile', { profileId });
  console.log('  Created and activated profile');

  // Extension updates profile
  await extension.sendCommand('update_profile', {
    profileId,
    name: 'Updated Profile Name',
    userAgent: 'Updated UA',
    fingerprint: {
      timezone: 'America/Los_Angeles'
    }
  });
  console.log('  Extension updated profile');

  // Browser should see updates
  const browserSyncResponse = await browser.sendCommand('sync_profile', {});

  assert(browserSyncResponse.result.profile.name === 'Updated Profile Name', 'Browser should see new name');
  assert(browserSyncResponse.result.profile.userAgent === 'Updated UA', 'Browser should see new UA');
  assert(browserSyncResponse.result.profile.fingerprint.timezone === 'America/Los_Angeles',
    'Browser should see new timezone');
  console.log('  Browser sees all updates');

  console.log('PASSED: Profile Update Sync');
  return true;
}

/**
 * Test Suite: Profile Deletion
 */
async function testProfileDeletion() {
  console.log('\n--- Test: Profile Deletion ---');

  // Create profile
  const profileResponse = await extension.sendCommand('create_profile', {
    name: 'Delete Test Profile'
  });
  const profileId = profileResponse.result.profile.id;
  console.log('  Created profile');

  // Try to delete default profile (should fail)
  const deleteDefaultResponse = await extension.sendCommand('delete_profile', { profileId: 'default' });
  assert(!deleteDefaultResponse.success, 'Should not delete default profile');
  console.log('  Default profile protected');

  // Delete created profile
  const deleteResponse = await extension.sendCommand('delete_profile', { profileId });
  assert(deleteResponse.success, 'Delete should succeed');
  console.log('  Profile deleted');

  // Verify profile is gone
  const getResponse = await extension.sendCommand('get_profile', { profileId });
  assert(!getResponse.success, 'Get deleted profile should fail');
  console.log('  Deleted profile inaccessible');

  // Verify profile not in list
  const listResponse = await extension.sendCommand('list_profiles', {});
  const profileIds = listResponse.result.profiles.map(p => p.id);
  assert(!profileIds.includes(profileId), 'Profile should not be in list');
  console.log('  Profile removed from list');

  console.log('PASSED: Profile Deletion');
  return true;
}

/**
 * Test Suite: Cross-Component Profile Visibility
 */
async function testCrossComponentProfileVisibility() {
  console.log('\n--- Test: Cross-Component Profile Visibility ---');

  // Extension creates profile
  const extProfileResponse = await extension.sendCommand('create_profile', {
    name: 'Extension Created Profile'
  });
  const extProfileId = extProfileResponse.result.profile.id;
  console.log('  Extension created profile');

  // Browser should see it
  const browserListResponse = await browser.sendCommand('list_profiles', {});
  const browserProfileIds = browserListResponse.result.profiles.map(p => p.id);
  assert(browserProfileIds.includes(extProfileId), 'Browser should see extension profile');
  console.log('  Browser sees extension profile');

  // Browser creates profile
  const browserProfileResponse = await browser.sendCommand('create_profile', {
    name: 'Browser Created Profile'
  });
  const browserProfileId = browserProfileResponse.result.profile.id;
  console.log('  Browser created profile');

  // Extension should see it
  const extListResponse = await extension.sendCommand('list_profiles', {});
  const extProfileIds = extListResponse.result.profiles.map(p => p.id);
  assert(extProfileIds.includes(browserProfileId), 'Extension should see browser profile');
  console.log('  Extension sees browser profile');

  // Both should see all profiles
  assert(extListResponse.result.profiles.length >= 3, 'Should have at least 3 profiles (default + 2 created)');
  console.log('  Both components see all profiles');

  console.log('PASSED: Cross-Component Profile Visibility');
  return true;
}

/**
 * Run all profile sync tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Profile Synchronization Integration Tests');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Profile Creation', fn: testProfileCreation },
    { name: 'Profile Activation', fn: testProfileActivation },
    { name: 'User Agent Synchronization', fn: testUserAgentSynchronization },
    { name: 'Fingerprint Synchronization', fn: testFingerprintSynchronization },
    { name: 'Proxy Configuration Sync', fn: testProxyConfigurationSync },
    { name: 'Custom Headers Sync', fn: testCustomHeadersSync },
    { name: 'Profile Export and Import', fn: testProfileExportAndImport },
    { name: 'Profile Update Sync', fn: testProfileUpdateSync },
    { name: 'Profile Deletion', fn: testProfileDeletion },
    { name: 'Cross-Component Profile Visibility', fn: testCrossComponentProfileVisibility }
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
  console.log('Profile Sync Test Summary');
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
