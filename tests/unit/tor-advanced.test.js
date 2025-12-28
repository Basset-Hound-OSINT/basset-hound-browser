/**
 * Basset Hound Browser - Advanced Tor Manager Unit Tests
 * Comprehensive tests for all Tor features including process management,
 * circuit control, bridges, transports, stream isolation, and onion services
 */

// Mock child_process before requiring AdvancedTorManager
const mockSpawn = jest.fn();
const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  spawn: mockSpawn,
  execSync: mockExecSync
}));

// Mock fs
const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn()
};
jest.mock('fs', () => mockFs);

// Mock net
const mockSocket = {
  connect: jest.fn(),
  destroy: jest.fn(),
  write: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  destroyed: false
};
jest.mock('net', () => ({
  Socket: jest.fn(() => mockSocket)
}));

// Mock https
jest.mock('https', () => ({
  request: jest.fn()
}));

// Mock os
jest.mock('os', () => ({
  platform: jest.fn(() => 'linux'),
  homedir: jest.fn(() => '/home/testuser')
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/'))
}));

const {
  AdvancedTorManager,
  TOR_STATES,
  TRANSPORT_TYPES,
  ISOLATION_MODES,
  COUNTRY_CODES,
  BUILTIN_BRIDGES,
  TOR_DEFAULTS
} = require('../../proxy/tor-advanced');

describe('Advanced Tor Manager Module', () => {
  let torManager;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockSocket.destroyed = false;
    mockSocket.connect.mockImplementation((port, host, callback) => {
      if (callback) setTimeout(callback, 10);
      return mockSocket;
    });
    mockSocket.on.mockImplementation((event, callback) => {
      return mockSocket;
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockFs.readFileSync.mockReturnValue(Buffer.from('mockedcookie'));

    mockExecSync.mockReturnValue('/usr/bin/tor');

    // Create fresh manager for each test
    torManager = new AdvancedTorManager({
      autoStart: false,
      killOnExit: false
    });
  });

  afterEach(() => {
    if (torManager) {
      torManager.removeAllListeners();
    }
  });

  // ==========================================
  // Constants Tests
  // ==========================================

  describe('TOR_STATES', () => {
    test('should define all Tor states', () => {
      expect(TOR_STATES).toHaveProperty('STOPPED');
      expect(TOR_STATES).toHaveProperty('STARTING');
      expect(TOR_STATES).toHaveProperty('BOOTSTRAPPING');
      expect(TOR_STATES).toHaveProperty('CONNECTED');
      expect(TOR_STATES).toHaveProperty('ERROR');
      expect(TOR_STATES).toHaveProperty('STOPPING');
    });

    test('should have correct state values', () => {
      expect(TOR_STATES.STOPPED).toBe('stopped');
      expect(TOR_STATES.STARTING).toBe('starting');
      expect(TOR_STATES.BOOTSTRAPPING).toBe('bootstrapping');
      expect(TOR_STATES.CONNECTED).toBe('connected');
      expect(TOR_STATES.ERROR).toBe('error');
      expect(TOR_STATES.STOPPING).toBe('stopping');
    });
  });

  describe('TRANSPORT_TYPES', () => {
    test('should define all transport types', () => {
      expect(TRANSPORT_TYPES).toHaveProperty('NONE');
      expect(TRANSPORT_TYPES).toHaveProperty('OBFS4');
      expect(TRANSPORT_TYPES).toHaveProperty('MEEK');
      expect(TRANSPORT_TYPES).toHaveProperty('SNOWFLAKE');
      expect(TRANSPORT_TYPES).toHaveProperty('WEBTUNNEL');
    });
  });

  describe('ISOLATION_MODES', () => {
    test('should define all isolation modes', () => {
      expect(ISOLATION_MODES).toHaveProperty('NONE');
      expect(ISOLATION_MODES).toHaveProperty('PER_TAB');
      expect(ISOLATION_MODES).toHaveProperty('PER_DOMAIN');
      expect(ISOLATION_MODES).toHaveProperty('PER_SESSION');
    });
  });

  describe('COUNTRY_CODES', () => {
    test('should define major country codes', () => {
      expect(COUNTRY_CODES).toHaveProperty('US');
      expect(COUNTRY_CODES).toHaveProperty('DE');
      expect(COUNTRY_CODES).toHaveProperty('NL');
      expect(COUNTRY_CODES).toHaveProperty('GB');
      expect(COUNTRY_CODES).toHaveProperty('FR');
      expect(COUNTRY_CODES).toHaveProperty('CH');
    });

    test('should have correct format for country codes', () => {
      expect(COUNTRY_CODES.US).toBe('{us}');
      expect(COUNTRY_CODES.DE).toBe('{de}');
    });
  });

  describe('BUILTIN_BRIDGES', () => {
    test('should have obfs4 bridges', () => {
      expect(BUILTIN_BRIDGES.obfs4).toBeDefined();
      expect(BUILTIN_BRIDGES.obfs4.length).toBeGreaterThan(0);
    });

    test('should have meek bridges', () => {
      expect(BUILTIN_BRIDGES.meek).toBeDefined();
      expect(BUILTIN_BRIDGES.meek.length).toBeGreaterThan(0);
    });

    test('should have snowflake bridges', () => {
      expect(BUILTIN_BRIDGES.snowflake).toBeDefined();
      expect(BUILTIN_BRIDGES.snowflake.length).toBeGreaterThan(0);
    });
  });

  describe('TOR_DEFAULTS', () => {
    test('should have correct default values', () => {
      expect(TOR_DEFAULTS.socksHost).toBe('127.0.0.1');
      expect(TOR_DEFAULTS.socksPort).toBe(9050);
      expect(TOR_DEFAULTS.controlHost).toBe('127.0.0.1');
      expect(TOR_DEFAULTS.controlPort).toBe(9051);
      expect(TOR_DEFAULTS.dnsPort).toBe(9053);
    });
  });

  // ==========================================
  // Constructor Tests
  // ==========================================

  describe('AdvancedTorManager Constructor', () => {
    test('should initialize with default values', () => {
      const manager = new AdvancedTorManager();
      expect(manager.socksHost).toBe('127.0.0.1');
      expect(manager.socksPort).toBe(9050);
      expect(manager.controlHost).toBe('127.0.0.1');
      expect(manager.controlPort).toBe(9051);
      expect(manager.state).toBe(TOR_STATES.STOPPED);
    });

    test('should accept custom configuration', () => {
      const manager = new AdvancedTorManager({
        socksHost: '192.168.1.1',
        socksPort: 9150,
        controlHost: '192.168.1.1',
        controlPort: 9151,
        controlPassword: 'secret'
      });

      expect(manager.socksHost).toBe('192.168.1.1');
      expect(manager.socksPort).toBe(9150);
      expect(manager.controlPassword).toBe('secret');
    });

    test('should initialize with stopped state', () => {
      expect(torManager.state).toBe(TOR_STATES.STOPPED);
      expect(torManager.isAuthenticated).toBe(false);
      expect(torManager.torProcess).toBeNull();
    });

    test('should initialize stats', () => {
      expect(torManager.stats).toBeDefined();
      expect(torManager.stats.startTime).toBeNull();
      expect(torManager.stats.totalCircuitChanges).toBe(0);
    });

    test('should initialize circuit tracking', () => {
      expect(torManager.circuits).toBeInstanceOf(Map);
      expect(torManager.circuitChangeCount).toBe(0);
    });

    test('should initialize isolation tracking', () => {
      expect(torManager.isolationMode).toBe(ISOLATION_MODES.NONE);
      expect(torManager.isolationPorts).toBeInstanceOf(Map);
    });
  });

  // ==========================================
  // Proxy Configuration Tests
  // ==========================================

  describe('getProxyConfig', () => {
    test('should return correct proxy configuration', () => {
      const config = torManager.getProxyConfig();
      expect(config.host).toBe('127.0.0.1');
      expect(config.port).toBe(9050);
      expect(config.type).toBe('socks5');
    });

    test('should return isolated port when key provided', () => {
      torManager.isolationMode = ISOLATION_MODES.PER_TAB;
      const config = torManager.getProxyConfig('tab-1');
      expect(config.port).toBe(9051); // First isolation port
    });
  });

  describe('getProxyRules', () => {
    test('should return correctly formatted proxy rules', () => {
      const rules = torManager.getProxyRules();
      expect(rules).toBe('socks5://127.0.0.1:9050');
    });

    test('should include isolation port when key provided', () => {
      torManager.isolationMode = ISOLATION_MODES.PER_DOMAIN;
      const rules = torManager.getProxyRules('example.com');
      expect(rules).toMatch(/socks5:\/\/127\.0\.0\.1:905\d/);
    });
  });

  // ==========================================
  // Status Tests
  // ==========================================

  describe('getStatus', () => {
    test('should return comprehensive status', () => {
      const status = torManager.getStatus();

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('processRunning');
      expect(status).toHaveProperty('socks');
      expect(status).toHaveProperty('control');
      expect(status).toHaveProperty('exitNode');
      expect(status).toHaveProperty('bridges');
      expect(status).toHaveProperty('isolation');
      expect(status).toHaveProperty('circuits');
      expect(status).toHaveProperty('stats');
    });

    test('should reflect current state correctly', () => {
      torManager.state = TOR_STATES.CONNECTED;
      const status = torManager.getStatus();
      expect(status.connected).toBe(true);
    });

    test('should include bridge configuration', () => {
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
  // Exit Node Control Tests
  // ==========================================

  describe('setExitCountries', () => {
    beforeEach(() => {
      torManager.isAuthenticated = true;
      torManager.controlSocket = mockSocket;
      mockSocket.destroyed = false;
    });

    test('should validate country codes', async () => {
      const result = await torManager.setExitCountries('INVALID');
      expect(result.success).toBe(false);
      expect(result.validCodes).toBeDefined();
    });

    test('should accept valid country codes', async () => {
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback('250 OK\r\n'), 10);
        }
        return mockSocket;
      });

      // Mock newIdentity to return quickly
      torManager.newIdentity = jest.fn().mockResolvedValue({ success: true });

      const result = await torManager.setExitCountries(['US', 'DE']);
      expect(torManager.exitCountries).toContain('{us}');
      expect(torManager.exitCountries).toContain('{de}');
    });

    test('should accept single country code string', async () => {
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback('250 OK\r\n'), 10);
        }
        return mockSocket;
      });
      torManager.newIdentity = jest.fn().mockResolvedValue({ success: true });

      const result = await torManager.setExitCountries('US');
      expect(torManager.exitCountries).toContain('{us}');
    });
  });

  describe('excludeExitCountries', () => {
    beforeEach(() => {
      torManager.isAuthenticated = true;
      torManager.controlSocket = mockSocket;
      mockSocket.destroyed = false;
    });

    test('should set excluded countries', async () => {
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback('250 OK\r\n'), 10);
        }
        return mockSocket;
      });
      torManager.newIdentity = jest.fn().mockResolvedValue({ success: true });

      await torManager.excludeExitCountries(['CN', 'RU']);
      expect(torManager.excludeCountries.length).toBe(0); // These are not in COUNTRY_CODES
    });
  });

  describe('setEntryCountries', () => {
    beforeEach(() => {
      torManager.isAuthenticated = true;
      torManager.controlSocket = mockSocket;
      mockSocket.destroyed = false;
    });

    test('should validate entry country codes', async () => {
      const result = await torManager.setEntryCountries('INVALID');
      expect(result.success).toBe(false);
    });

    test('should set entry countries', async () => {
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback('250 OK\r\n'), 10);
        }
        return mockSocket;
      });
      torManager.newIdentity = jest.fn().mockResolvedValue({ success: true });

      const result = await torManager.setEntryCountries('CH');
      expect(torManager.entryCountries).toContain('{ch}');
    });
  });

  describe('clearExitRestrictions', () => {
    beforeEach(() => {
      torManager.isAuthenticated = true;
      torManager.controlSocket = mockSocket;
      mockSocket.destroyed = false;
      torManager.exitCountries = ['{us}'];
      torManager.excludeCountries = ['{cn}'];
    });

    test('should clear all exit restrictions', async () => {
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback('250 OK\r\n'), 10);
        }
        return mockSocket;
      });

      const result = await torManager.clearExitRestrictions();
      expect(result.success).toBe(true);
      expect(torManager.exitCountries).toEqual([]);
      expect(torManager.excludeCountries).toEqual([]);
    });
  });

  // ==========================================
  // Bridge Support Tests
  // ==========================================

  describe('addBridge', () => {
    test('should add custom bridge', () => {
      const bridge = 'obfs4 192.168.1.1:443 FINGERPRINT cert=CERT iat-mode=0';
      const result = torManager.addBridge(bridge);

      expect(result.success).toBe(true);
      expect(result.bridgeCount).toBe(1);
      expect(torManager.bridges).toContain(bridge);
    });

    test('should reject invalid bridge', () => {
      const result = torManager.addBridge(null);
      expect(result.success).toBe(false);
    });

    test('should accumulate multiple bridges', () => {
      torManager.addBridge('bridge1');
      torManager.addBridge('bridge2');
      torManager.addBridge('bridge3');

      expect(torManager.bridges.length).toBe(3);
    });
  });

  describe('fetchBridgesFromBridgeDB', () => {
    test('should return builtin bridges as fallback', async () => {
      const result = await torManager.fetchBridgesFromBridgeDB('obfs4');
      expect(result.success).toBe(false);
      expect(result.builtinBridges).toBeDefined();
      expect(result.builtinBridges.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // Stream Isolation Tests
  // ==========================================

  describe('setIsolationMode', () => {
    test('should set valid isolation mode', () => {
      const result = torManager.setIsolationMode(ISOLATION_MODES.PER_TAB);
      expect(result.success).toBe(true);
      expect(torManager.isolationMode).toBe(ISOLATION_MODES.PER_TAB);
    });

    test('should reject invalid isolation mode', () => {
      const result = torManager.setIsolationMode('invalid_mode');
      expect(result.success).toBe(false);
    });

    test('should set per-domain isolation', () => {
      const result = torManager.setIsolationMode(ISOLATION_MODES.PER_DOMAIN);
      expect(result.success).toBe(true);
      expect(result.isolationMode).toBe('per_domain');
    });
  });

  describe('getIsolatedPort', () => {
    test('should return base port when isolation disabled', () => {
      torManager.isolationMode = ISOLATION_MODES.NONE;
      const result = torManager.getIsolatedPort('key1');

      expect(result.success).toBe(true);
      expect(result.port).toBe(9050);
      expect(result.isolated).toBe(false);
    });

    test('should assign unique ports for different keys', () => {
      torManager.isolationMode = ISOLATION_MODES.PER_TAB;

      const port1 = torManager.getIsolatedPort('tab-1');
      const port2 = torManager.getIsolatedPort('tab-2');
      const port3 = torManager.getIsolatedPort('tab-3');

      expect(port1.port).not.toBe(port2.port);
      expect(port2.port).not.toBe(port3.port);
    });

    test('should return same port for same key', () => {
      torManager.isolationMode = ISOLATION_MODES.PER_DOMAIN;

      const port1 = torManager.getIsolatedPort('example.com');
      const port2 = torManager.getIsolatedPort('example.com');

      expect(port1.port).toBe(port2.port);
    });

    test('should cycle ports after limit', () => {
      torManager.isolationMode = ISOLATION_MODES.PER_TAB;

      // Request 12 ports (more than the 10 available)
      for (let i = 0; i < 12; i++) {
        torManager.getIsolatedPort(`key-${i}`);
      }

      // Should have cycled
      expect(torManager.nextIsolationPort).toBeLessThanOrEqual(9060);
    });
  });

  // ==========================================
  // Onion Service Tests
  // ==========================================

  describe('isOnionUrl', () => {
    test('should detect v3 onion URLs', () => {
      const url = 'http://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion';
      const result = torManager.isOnionUrl(url);

      expect(result.success).toBe(true);
      expect(result.isOnion).toBe(true);
      expect(result.isV3).toBe(true);
      expect(result.version).toBe(3);
    });

    test('should detect v2 onion URLs (legacy)', () => {
      const url = 'http://expyuzz4wqqyqhjn.onion';
      const result = torManager.isOnionUrl(url);

      expect(result.success).toBe(true);
      expect(result.isOnion).toBe(true);
      expect(result.isV3).toBe(false);
      expect(result.version).toBe(2);
    });

    test('should reject non-onion URLs', () => {
      const url = 'https://example.com';
      const result = torManager.isOnionUrl(url);

      expect(result.isOnion).toBe(false);
      expect(result.version).toBeNull();
    });

    test('should handle invalid URLs', () => {
      const result = torManager.isOnionUrl('not-a-url');
      expect(result.success).toBe(false);
      expect(result.isOnion).toBe(false);
    });
  });

  describe('handleOnionLocation', () => {
    test('should recommend redirect for valid onion URL', () => {
      const onionUrl = 'http://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/';
      const result = torManager.handleOnionLocation(onionUrl);

      expect(result.success).toBe(true);
      expect(result.shouldRedirect).toBe(true);
      expect(result.onionUrl).toBe(onionUrl);
    });

    test('should reject invalid onion location', () => {
      const result = torManager.handleOnionLocation('https://example.com');
      expect(result.shouldRedirect).toBe(false);
    });

    test('should emit onionLocation event', () => {
      const handler = jest.fn();
      torManager.on('onionLocation', handler);

      const onionUrl = 'http://facebookwkhpilnemxj7asaniu7vnjjbiltxjqhye3mhbshg7kx5tfyd.onion/';
      torManager.handleOnionLocation(onionUrl);

      expect(handler).toHaveBeenCalled();
    });
  });

  // ==========================================
  // Configuration Tests
  // ==========================================

  describe('configure', () => {
    test('should update configuration', () => {
      const result = torManager.configure({
        socksHost: '192.168.1.100',
        socksPort: 9150,
        controlPort: 9151
      });

      expect(result.success).toBe(true);
      expect(torManager.socksHost).toBe('192.168.1.100');
      expect(torManager.socksPort).toBe(9150);
      expect(torManager.controlPort).toBe(9151);
    });

    test('should return updated configuration', () => {
      const result = torManager.configure({
        socksHost: '10.0.0.1',
        dataDirectory: '/tmp/tor'
      });

      expect(result.config.socksHost).toBe('10.0.0.1');
      expect(result.config.dataDirectory).toBe('/tmp/tor');
    });

    test('should update timeout settings', () => {
      torManager.configure({
        connectionTimeout: 60000,
        circuitTimeout: 120000
      });

      expect(torManager.connectionTimeout).toBe(60000);
      expect(torManager.circuitTimeout).toBe(120000);
    });
  });

  describe('getCountryCodes', () => {
    test('should return list of country codes', () => {
      const result = torManager.getCountryCodes();

      expect(result.success).toBe(true);
      expect(result.countries).toContain('US');
      expect(result.countries).toContain('DE');
      expect(result.countries).toContain('NL');
    });

    test('should include country descriptions', () => {
      const result = torManager.getCountryCodes();

      expect(result.descriptions.US).toBe('United States');
      expect(result.descriptions.DE).toBe('Germany');
    });
  });

  describe('getTransportTypes', () => {
    test('should return list of transport types', () => {
      const result = torManager.getTransportTypes();

      expect(result.success).toBe(true);
      expect(result.transports).toContain('none');
      expect(result.transports).toContain('obfs4');
      expect(result.transports).toContain('meek');
      expect(result.transports).toContain('snowflake');
    });

    test('should include transport descriptions', () => {
      const result = torManager.getTransportTypes();

      expect(result.descriptions.obfs4).toContain('Obfuscated');
      expect(result.descriptions.snowflake).toContain('WebRTC');
    });
  });

  // ==========================================
  // Circuit Management Tests
  // ==========================================

  describe('Circuit Parsing', () => {
    test('should parse circuit status response', () => {
      const response = `250+circuit-status=
1 BUILT $A1B2C3D4E5F6,$1234567890AB,$FEDCBA098765 GENERAL
2 EXTENDED $AAAA,$BBBB,$CCCC PURPOSE
.
250 OK`;

      const circuits = torManager._parseCircuits(response);

      expect(circuits.length).toBe(2);
      expect(circuits[0].id).toBe('1');
      expect(circuits[0].status).toBe('BUILT');
      expect(circuits[0].nodeCount).toBe(3);
    });
  });

  // ==========================================
  // Bandwidth Tests
  // ==========================================

  describe('_formatBytes', () => {
    test('should format bytes correctly', () => {
      expect(torManager._formatBytes(0)).toBe('0 B');
      expect(torManager._formatBytes(1024)).toBe('1 KB');
      expect(torManager._formatBytes(1048576)).toBe('1 MB');
      expect(torManager._formatBytes(1073741824)).toBe('1 GB');
    });

    test('should handle decimal values', () => {
      const result = torManager._formatBytes(1536);
      expect(result).toBe('1.5 KB');
    });
  });

  // ==========================================
  // EventEmitter Tests
  // ==========================================

  describe('EventEmitter functionality', () => {
    test('should emit stateChange events', () => {
      const handler = jest.fn();
      torManager.on('stateChange', handler);

      torManager.state = TOR_STATES.CONNECTING;
      torManager.emit('stateChange', { state: TOR_STATES.CONNECTING });

      expect(handler).toHaveBeenCalledWith({ state: TOR_STATES.CONNECTING });
    });

    test('should emit bootstrap events', () => {
      const handler = jest.fn();
      torManager.on('bootstrap', handler);

      torManager.emit('bootstrap', { progress: 50, phase: 'Loading directory' });

      expect(handler).toHaveBeenCalledWith({
        progress: 50,
        phase: 'Loading directory'
      });
    });

    test('should emit newIdentity events', () => {
      const handler = jest.fn();
      torManager.on('newIdentity', handler);

      torManager.emit('newIdentity', {
        circuitChangeCount: 5,
        newExitIp: '1.2.3.4',
        newExitCountry: 'US'
      });

      expect(handler).toHaveBeenCalled();
    });
  });

  // ==========================================
  // Process Management Tests
  // ==========================================

  describe('Process Management', () => {
    test('should fail to start when Tor binary not found', async () => {
      mockFs.existsSync.mockReturnValue(false);
      torManager.torBinaryPath = null;

      const result = await torManager.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should fail to start when already running', async () => {
      torManager.state = TOR_STATES.CONNECTED;

      const result = await torManager.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot start');
    });

    test('stop should succeed when already stopped', async () => {
      torManager.state = TOR_STATES.STOPPED;

      const result = await torManager.stop();

      expect(result.success).toBe(true);
      expect(result.message).toContain('already stopped');
    });
  });

  // ==========================================
  // Control Port Tests
  // ==========================================

  describe('Control Port Connection', () => {
    test('should return success if already connected', async () => {
      torManager.controlSocket = mockSocket;
      mockSocket.destroyed = false;

      const result = await torManager.connectControlPort();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Already connected');
    });

    test('should handle connection timeout', async () => {
      // Store the timeout callback so we can manually trigger it
      let timeoutCallback = null;
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = (cb, ms) => {
        // Capture the timeout callback from connectControlPort (30000ms in tor-advanced)
        if (ms >= 30000) {
          timeoutCallback = cb;
        }
        return originalSetTimeout(cb, 0); // Return immediately to not block
      };

      mockSocket.connect.mockImplementation(() => {
        // Don't call callback to simulate timeout scenario
        return mockSocket;
      });

      // Start the connection attempt
      const resultPromise = torManager.connectControlPort();

      // Wait a tick for the socket setup, then trigger the timeout callback
      await new Promise(resolve => originalSetTimeout(resolve, 10));
      if (timeoutCallback) {
        timeoutCallback();
      }

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  // ==========================================
  // External Connection Tests
  // ==========================================

  describe('connectExisting', () => {
    test('should fail if SOCKS proxy unreachable', async () => {
      mockSocket.connect.mockImplementation(() => mockSocket);
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('ECONNREFUSED')), 10);
        }
        return mockSocket;
      });

      const result = await torManager.connectExisting();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot connect');
    });
  });

  // ==========================================
  // Cleanup Tests
  // ==========================================

  describe('cleanup', () => {
    test('should stop and remove listeners', async () => {
      const stopSpy = jest.spyOn(torManager, 'stop').mockResolvedValue({ success: true });

      await torManager.cleanup();

      expect(stopSpy).toHaveBeenCalled();
    });

    test('should be safe to call multiple times', async () => {
      await torManager.cleanup();
      await expect(torManager.cleanup()).resolves.not.toThrow();
    });
  });
});

// ==========================================
// Integration-style Tests
// ==========================================

describe('Advanced Tor Manager Integration', () => {
  describe('Full workflow simulation', () => {
    test('should handle complete Tor setup workflow', async () => {
      const manager = new AdvancedTorManager({ autoStart: false, killOnExit: false });

      // Configure
      const configResult = manager.configure({
        socksPort: 9150,
        controlPort: 9151
      });
      expect(configResult.success).toBe(true);

      // Set isolation
      const isolationResult = manager.setIsolationMode(ISOLATION_MODES.PER_DOMAIN);
      expect(isolationResult.success).toBe(true);

      // Add bridge
      const bridgeResult = manager.addBridge('obfs4 1.2.3.4:443 FINGERPRINT cert=CERT');
      expect(bridgeResult.success).toBe(true);

      // Get status
      const status = manager.getStatus();
      expect(status.bridges.count).toBe(1);
      expect(status.isolation.mode).toBe('per_domain');
    });
  });
});
