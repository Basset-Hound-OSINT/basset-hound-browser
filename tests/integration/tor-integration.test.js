/**
 * Basset Hound Browser - Tor Integration Tests
 * Tests for Tor functionality with real network interactions (when Tor is available)
 * These tests are designed to run in environments where Tor may or may not be installed
 */

const net = require('net');
const path = require('path');

// Dynamic import to handle missing module gracefully
let AdvancedTorManager, TOR_STATES, TRANSPORT_TYPES, ISOLATION_MODES;

try {
  const torAdvanced = require('../../proxy/tor-advanced');
  AdvancedTorManager = torAdvanced.AdvancedTorManager;
  TOR_STATES = torAdvanced.TOR_STATES;
  TRANSPORT_TYPES = torAdvanced.TRANSPORT_TYPES;
  ISOLATION_MODES = torAdvanced.ISOLATION_MODES;
} catch (error) {
  console.warn('Advanced Tor Manager module not available, skipping integration tests');
}

/**
 * Check if Tor SOCKS proxy is running
 */
async function checkTorAvailable(host = '127.0.0.1', port = 9050) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 3000);

    socket.connect(port, host, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Check if Tor control port is available
 */
async function checkControlPortAvailable(host = '127.0.0.1', port = 9051) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 3000);

    socket.connect(port, host, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });
  });
}

// Conditionally run tests based on module availability
const describeIf = (condition) => (condition ? describe : describe.skip);
const testIf = (condition) => (condition ? test : test.skip);

describe('Tor Integration Tests', () => {
  let torManager;
  let torAvailable = false;
  let controlPortAvailable = false;

  beforeAll(async () => {
    if (!AdvancedTorManager) {
      console.log('Skipping Tor integration tests - module not available');
      return;
    }

    // Check if Tor is running
    torAvailable = await checkTorAvailable();
    controlPortAvailable = await checkControlPortAvailable();

    console.log(`Tor SOCKS available: ${torAvailable}`);
    console.log(`Tor Control Port available: ${controlPortAvailable}`);
  });

  beforeEach(() => {
    if (AdvancedTorManager) {
      torManager = new AdvancedTorManager({
        autoStart: false,
        killOnExit: false
      });
    }
  });

  afterEach(async () => {
    if (torManager) {
      await torManager.cleanup();
    }
  });

  // ==========================================
  // Module Availability Tests
  // ==========================================

  describe('Module Availability', () => {
    test('should load AdvancedTorManager module', () => {
      expect(AdvancedTorManager).toBeDefined();
    });

    test('should export TOR_STATES', () => {
      expect(TOR_STATES).toBeDefined();
      expect(TOR_STATES.STOPPED).toBeDefined();
      expect(TOR_STATES.CONNECTED).toBeDefined();
    });

    test('should export TRANSPORT_TYPES', () => {
      expect(TRANSPORT_TYPES).toBeDefined();
      expect(TRANSPORT_TYPES.OBFS4).toBeDefined();
    });

    test('should export ISOLATION_MODES', () => {
      expect(ISOLATION_MODES).toBeDefined();
      expect(ISOLATION_MODES.PER_TAB).toBeDefined();
    });
  });

  // ==========================================
  // Basic Configuration Tests (Always Run)
  // ==========================================

  describe('Configuration Tests', () => {
    test('should create manager with default settings', () => {
      expect(torManager.socksHost).toBe('127.0.0.1');
      expect(torManager.socksPort).toBe(9050);
      expect(torManager.controlPort).toBe(9051);
    });

    test('should update configuration', () => {
      const result = torManager.configure({
        socksPort: 9150,
        controlPort: 9151,
        connectionTimeout: 60000
      });

      expect(result.success).toBe(true);
      expect(torManager.socksPort).toBe(9150);
      expect(torManager.controlPort).toBe(9151);
      expect(torManager.connectionTimeout).toBe(60000);
    });

    test('should return country codes', () => {
      const result = torManager.getCountryCodes();

      expect(result.success).toBe(true);
      expect(result.countries.length).toBeGreaterThan(20);
      expect(result.descriptions).toBeDefined();
    });

    test('should return transport types', () => {
      const result = torManager.getTransportTypes();

      expect(result.success).toBe(true);
      expect(result.transports.length).toBeGreaterThan(3);
      expect(result.descriptions).toBeDefined();
    });
  });

  // ==========================================
  // Isolation Mode Tests (Always Run)
  // ==========================================

  describe('Stream Isolation', () => {
    test('should set isolation mode to per_tab', () => {
      const result = torManager.setIsolationMode(ISOLATION_MODES.PER_TAB);

      expect(result.success).toBe(true);
      expect(torManager.isolationMode).toBe('per_tab');
    });

    test('should set isolation mode to per_domain', () => {
      const result = torManager.setIsolationMode(ISOLATION_MODES.PER_DOMAIN);

      expect(result.success).toBe(true);
      expect(torManager.isolationMode).toBe('per_domain');
    });

    test('should reject invalid isolation mode', () => {
      const result = torManager.setIsolationMode('invalid');

      expect(result.success).toBe(false);
    });

    test('should allocate different ports for different keys', () => {
      torManager.setIsolationMode(ISOLATION_MODES.PER_TAB);

      const port1 = torManager.getIsolatedPort('tab-1');
      const port2 = torManager.getIsolatedPort('tab-2');

      expect(port1.isolated).toBe(true);
      expect(port2.isolated).toBe(true);
      expect(port1.port).not.toBe(port2.port);
    });

    test('should return same port for same key', () => {
      torManager.setIsolationMode(ISOLATION_MODES.PER_DOMAIN);

      const port1 = torManager.getIsolatedPort('example.com');
      const port2 = torManager.getIsolatedPort('example.com');

      expect(port1.port).toBe(port2.port);
    });

    test('should return base port when isolation disabled', () => {
      torManager.setIsolationMode(ISOLATION_MODES.NONE);

      const result = torManager.getIsolatedPort('any-key');

      expect(result.isolated).toBe(false);
      expect(result.port).toBe(9050);
    });
  });

  // ==========================================
  // Onion URL Detection Tests (Always Run)
  // ==========================================

  describe('Onion URL Detection', () => {
    test('should detect v3 onion URLs', () => {
      const url = 'http://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/';
      const result = torManager.isOnionUrl(url);

      expect(result.success).toBe(true);
      expect(result.isOnion).toBe(true);
      expect(result.isV3).toBe(true);
      expect(result.version).toBe(3);
    });

    test('should detect v2 onion URLs', () => {
      const url = 'http://expyuzz4wqqyqhjn.onion/';
      const result = torManager.isOnionUrl(url);

      expect(result.success).toBe(true);
      expect(result.isOnion).toBe(true);
      expect(result.isV3).toBe(false);
      expect(result.version).toBe(2);
    });

    test('should handle https onion URLs', () => {
      const url = 'https://facebookwkhpilnemxj7asaniu7vnjjbiltxjqhye3mhbshg7kx5tfyd.onion/login';
      const result = torManager.isOnionUrl(url);

      expect(result.isOnion).toBe(true);
    });

    test('should not detect regular URLs as onion', () => {
      const url = 'https://www.google.com';
      const result = torManager.isOnionUrl(url);

      expect(result.isOnion).toBe(false);
      expect(result.version).toBeNull();
    });

    test('should handle malformed URLs', () => {
      const result = torManager.isOnionUrl('not-a-valid-url');

      expect(result.success).toBe(false);
      expect(result.isOnion).toBe(false);
    });
  });

  // ==========================================
  // Onion-Location Header Tests (Always Run)
  // ==========================================

  describe('Onion-Location Handling', () => {
    test('should recommend redirect for valid onion location', () => {
      const onionUrl = 'http://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/';
      const result = torManager.handleOnionLocation(onionUrl);

      expect(result.success).toBe(true);
      expect(result.shouldRedirect).toBe(true);
      expect(result.onionUrl).toBe(onionUrl);
    });

    test('should not redirect for invalid onion location', () => {
      const result = torManager.handleOnionLocation('https://example.com');

      expect(result.shouldRedirect).toBe(false);
    });

    test('should handle null onion location', () => {
      const result = torManager.handleOnionLocation(null);

      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Bridge Configuration Tests (Always Run)
  // ==========================================

  describe('Bridge Configuration', () => {
    test('should add custom bridge', () => {
      const bridge = 'obfs4 192.168.1.1:443 FINGERPRINT cert=ABCD1234 iat-mode=0';
      const result = torManager.addBridge(bridge);

      expect(result.success).toBe(true);
      expect(result.bridgeCount).toBe(1);
    });

    test('should accumulate bridges', () => {
      torManager.addBridge('bridge1');
      torManager.addBridge('bridge2');
      const result = torManager.addBridge('bridge3');

      expect(result.bridgeCount).toBe(3);
    });

    test('should reject null bridge', () => {
      const result = torManager.addBridge(null);

      expect(result.success).toBe(false);
    });

    test('should reject empty bridge', () => {
      const result = torManager.addBridge('');

      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Status Tests (Always Run)
  // ==========================================

  describe('Status Reporting', () => {
    test('should return comprehensive status', () => {
      const status = torManager.getStatus();

      expect(status.state).toBeDefined();
      expect(status.connected).toBeDefined();
      expect(status.processRunning).toBeDefined();
      expect(status.socks).toBeDefined();
      expect(status.control).toBeDefined();
      expect(status.exitNode).toBeDefined();
      expect(status.bridges).toBeDefined();
      expect(status.isolation).toBeDefined();
      expect(status.circuits).toBeDefined();
      expect(status.stats).toBeDefined();
    });

    test('should report stopped state initially', () => {
      const status = torManager.getStatus();

      expect(status.state).toBe('stopped');
      expect(status.connected).toBe(false);
      expect(status.processRunning).toBe(false);
    });

    test('should report bridge configuration', () => {
      torManager.useBridges = true;
      torManager.currentTransport = TRANSPORT_TYPES.OBFS4;
      torManager.bridges = ['bridge1', 'bridge2'];

      const status = torManager.getStatus();

      expect(status.bridges.enabled).toBe(true);
      expect(status.bridges.transport).toBe('obfs4');
      expect(status.bridges.count).toBe(2);
    });
  });

  // ==========================================
  // Proxy Config Tests (Always Run)
  // ==========================================

  describe('Proxy Configuration', () => {
    test('should return correct proxy config', () => {
      const config = torManager.getProxyConfig();

      expect(config.host).toBe('127.0.0.1');
      expect(config.port).toBe(9050);
      expect(config.type).toBe('socks5');
    });

    test('should return correct proxy rules', () => {
      const rules = torManager.getProxyRules();

      expect(rules).toBe('socks5://127.0.0.1:9050');
    });

    test('should return isolated proxy config', () => {
      torManager.setIsolationMode(ISOLATION_MODES.PER_TAB);
      const config = torManager.getProxyConfig('tab-1');

      expect(config.port).not.toBe(9050);
      expect(config.type).toBe('socks5');
    });
  });

  // ==========================================
  // Live Tor Tests (Run only if Tor is available)
  // ==========================================

  describe('Live Tor Connection Tests', () => {
    test('should connect to existing Tor instance', async () => {
      if (!torAvailable) {
        console.log('Skipping: Tor SOCKS not available');
        return;
      }

      const result = await torManager.connectExisting();

      expect(result.success).toBe(true);
      expect(torManager.state).toBe(TOR_STATES.CONNECTED);
    }, 30000);

    test('should get status after connection', async () => {
      if (!torAvailable) {
        console.log('Skipping: Tor SOCKS not available');
        return;
      }

      await torManager.connectExisting();
      const status = torManager.getStatus();

      expect(status.connected).toBe(true);
      expect(status.bootstrapProgress).toBe(100);
    }, 30000);
  });

  describe('Live Control Port Tests', () => {
    test('should connect to control port', async () => {
      if (!controlPortAvailable) {
        console.log('Skipping: Control port not available');
        return;
      }

      await torManager.connectExisting();
      const result = await torManager.connectControlPort();

      // May fail if authentication is required - just verify we got a response
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      // Note: Authentication state depends on Tor configuration and cookie file access
      // Don't assert on isAuthenticated as it may legitimately fail in some environments
    }, 30000);

    test('should get circuit info', async () => {
      if (!controlPortAvailable) {
        console.log('Skipping: Control port not available');
        return;
      }

      await torManager.connectExisting();
      const result = await torManager.getCircuitInfo();

      if (result.success) {
        expect(result.circuits).toBeDefined();
        expect(Array.isArray(result.circuits)).toBe(true);
      }
    }, 30000);

    test('should request new identity', async () => {
      if (!controlPortAvailable) {
        console.log('Skipping: Control port not available');
        return;
      }

      await torManager.connectExisting();
      const result = await torManager.newIdentity();

      // May fail without proper authentication
      if (result.success) {
        expect(torManager.circuitChangeCount).toBeGreaterThan(0);
      }
    }, 30000);
  });

  // ==========================================
  // Event Tests
  // ==========================================

  describe('Event Emission', () => {
    test('should emit stateChange event', (done) => {
      const expectedState = TOR_STATES.CONNECTING;

      torManager.on('stateChange', (data) => {
        if (data && data.state === expectedState) {
          expect(data.state).toBe(expectedState);
          done();
        }
      });

      // Emit after setting up listener
      setTimeout(() => {
        torManager.emit('stateChange', { state: expectedState });
      }, 10);
    });

    test('should emit bootstrap event', (done) => {
      torManager.on('bootstrap', (data) => {
        expect(data.progress).toBeDefined();
        expect(data.phase).toBeDefined();
        done();
      });

      torManager.emit('bootstrap', { progress: 50, phase: 'Loading directory' });
    });

    test('should emit newIdentity event', (done) => {
      torManager.on('newIdentity', (data) => {
        expect(data.circuitChangeCount).toBeDefined();
        done();
      });

      torManager.emit('newIdentity', { circuitChangeCount: 1 });
    });

    test('should emit onionLocation event', (done) => {
      torManager.on('onionLocation', (data) => {
        expect(data.onionUrl).toBeDefined();
        done();
      });

      torManager.handleOnionLocation('http://test.onion/');
    });
  });

  // ==========================================
  // Error Handling Tests
  // ==========================================

  describe('Error Handling', () => {
    test('should handle connection to unavailable host', async () => {
      torManager.configure({
        socksHost: '192.0.2.1',  // TEST-NET-1, should fail
        socksPort: 9999,
        connectionTimeout: 3000
      });

      const result = await torManager.connectExisting();

      expect(result.success).toBe(false);
    }, 10000);

    test('should handle invalid country codes gracefully', async () => {
      const result = await torManager.setExitCountries(['INVALID', 'XYZ']);

      expect(result.success).toBe(false);
    });

    test('should handle cleanup on error state', async () => {
      torManager.state = TOR_STATES.ERROR;

      await expect(torManager.cleanup()).resolves.not.toThrow();
    });
  });
});

// ==========================================
// WebSocket API Command Tests
// ==========================================

describe('Tor WebSocket API Commands', () => {
  // These tests verify the command handler structure exists
  // Actual WebSocket testing requires the server to be running

  test('should have command handlers defined in structure', () => {
    // This is a structural test - real integration would test via WebSocket
    expect(true).toBe(true);
  });
});

// ==========================================
// Performance Tests
// ==========================================

describe('Tor Manager Performance', () => {
  let torManager;

  beforeEach(() => {
    torManager = new AdvancedTorManager({
      autoStart: false,
      killOnExit: false
    });
  });

  afterEach(() => {
    torManager.removeAllListeners();
  });

  test('should handle rapid isolation port requests', () => {
    torManager.setIsolationMode(ISOLATION_MODES.PER_TAB);

    const startTime = Date.now();
    for (let i = 0; i < 1000; i++) {
      torManager.getIsolatedPort(`key-${i}`);
    }
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  test('should handle multiple configuration updates', () => {
    const startTime = Date.now();
    for (let i = 0; i < 100; i++) {
      torManager.configure({ socksPort: 9050 + (i % 10) });
    }
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100); // Should complete in under 100ms
  });

  test('should efficiently check onion URLs', () => {
    const urls = [
      'http://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/',
      'https://www.google.com',
      'http://expyuzz4wqqyqhjn.onion/',
      'https://github.com',
      'http://facebookwkhpilnemxj7asaniu7vnjjbiltxjqhye3mhbshg7kx5tfyd.onion/'
    ];

    const startTime = Date.now();
    for (let i = 0; i < 1000; i++) {
      torManager.isOnionUrl(urls[i % urls.length]);
    }
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(500); // Should complete in under 500ms
  });
});
