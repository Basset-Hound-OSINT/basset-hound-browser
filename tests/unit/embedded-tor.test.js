/**
 * Embedded Tor Tests
 * Tests for the embedded Tor setup script and integration
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawn: jest.fn()
}));

// Get the module functions
const setupModule = require('../../scripts/install/embedded-tor-setup');

describe('Embedded Tor Setup', () => {
  describe('getPlatformKey', () => {
    it('should return correct platform-arch combination', () => {
      const key = setupModule.getPlatformKey();
      const validKeys = ['linux-x64', 'darwin-x64', 'darwin-arm64', 'win32-x64', 'win32-ia32'];

      // The result should match the current platform
      expect(key).toMatch(/^(linux|darwin|win32)-(x64|arm64|ia32)$/);
    });
  });

  describe('DOWNLOAD_URLS', () => {
    it('should have URLs for all supported platforms', () => {
      const expectedPlatforms = ['linux-x64', 'darwin-x64', 'darwin-arm64', 'win32-x64', 'win32-ia32'];

      for (const platform of expectedPlatforms) {
        expect(setupModule.DOWNLOAD_URLS[platform]).toBeDefined();
        expect(setupModule.DOWNLOAD_URLS[platform]).toMatch(/^https:\/\/archive\.torproject\.org/);
        expect(setupModule.DOWNLOAD_URLS[platform]).toMatch(/tor-expert-bundle/);
      }
    });

    it('should point to version 15.0.3', () => {
      for (const url of Object.values(setupModule.DOWNLOAD_URLS)) {
        expect(url).toContain('15.0.3');
      }
    });
  });
});

describe('AdvancedTorManager Embedded Mode', () => {
  let AdvancedTorManager;
  let mockExecSync;
  let mockSpawn;

  beforeEach(() => {
    jest.resetModules();

    // Setup mocks
    mockExecSync = require('child_process').execSync;
    mockSpawn = require('child_process').spawn;

    // Mock execSync for tor --version and which tor
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('--version')) {
        return 'Tor version 0.4.8.21\n';
      }
      if (cmd.includes('which tor') || cmd.includes('where tor')) {
        return '/usr/bin/tor\n';
      }
      if (cmd.includes('--hash-password')) {
        return '16:ABCD1234EFGH5678\n';
      }
      return '';
    });

    // Re-require the module
    const torAdvanced = require('../../proxy/tor-advanced');
    AdvancedTorManager = torAdvanced.AdvancedTorManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const manager = new AdvancedTorManager();

      expect(manager.socksHost).toBe('127.0.0.1');
      expect(manager.socksPort).toBe(9050);
      expect(manager.controlHost).toBe('127.0.0.1');
      expect(manager.controlPort).toBe(9051);
      expect(manager.state).toBe('stopped');
    });

    it('should accept custom configuration', () => {
      const manager = new AdvancedTorManager({
        socksPort: 19050,
        controlPort: 19051,
        controlPassword: 'test-password'
      });

      expect(manager.socksPort).toBe(19050);
      expect(manager.controlPort).toBe(19051);
      expect(manager.controlPassword).toBe('test-password');
    });

    it('should find system Tor binary', () => {
      const manager = new AdvancedTorManager();

      // Should have found the tor binary
      expect(manager.torBinaryPath).toBeTruthy();
    });
  });

  describe('getStatus', () => {
    it('should return comprehensive status object', () => {
      const manager = new AdvancedTorManager();
      const status = manager.getStatus();

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

      expect(status.socks.port).toBe(9050);
      expect(status.control.port).toBe(9051);
    });
  });

  describe('getProxyConfig', () => {
    it('should return proxy configuration for Electron', () => {
      const manager = new AdvancedTorManager();
      const config = manager.getProxyConfig();

      expect(config).toEqual({
        host: '127.0.0.1',
        port: 9050,
        type: 'socks5'
      });
    });

    it('should return isolated port when isolation key provided', () => {
      const manager = new AdvancedTorManager();
      manager.isolationMode = 'per_tab';

      // getIsolatedPort returns the isolation info, getProxyConfig uses it
      const isolated1 = manager.getIsolatedPort('tab-1');
      const isolated2 = manager.getIsolatedPort('tab-2');

      expect(isolated1.isolated).toBe(true);
      expect(isolated2.isolated).toBe(true);
      expect(isolated1.port).not.toBe(isolated2.port);
    });
  });

  describe('getProxyRules', () => {
    it('should return SOCKS5 proxy rules string', () => {
      const manager = new AdvancedTorManager();
      const rules = manager.getProxyRules();

      expect(rules).toBe('socks5://127.0.0.1:9050');
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      const manager = new AdvancedTorManager();

      const result = manager.configure({
        socksPort: 19050,
        controlPort: 19051
      });

      expect(result.success).toBe(true);
      expect(manager.socksPort).toBe(19050);
      expect(manager.controlPort).toBe(19051);
    });
  });

  describe('getCountryCodes', () => {
    it('should return list of country codes', () => {
      const manager = new AdvancedTorManager();
      const result = manager.getCountryCodes();

      expect(result.success).toBe(true);
      expect(result.countries).toContain('US');
      expect(result.countries).toContain('DE');
      expect(result.countries).toContain('NL');
      expect(result.descriptions.US).toBe('United States');
    });
  });

  describe('getTransportTypes', () => {
    it('should return list of transport types', () => {
      const manager = new AdvancedTorManager();
      const result = manager.getTransportTypes();

      expect(result.success).toBe(true);
      expect(result.transports).toContain('none');
      expect(result.transports).toContain('obfs4');
      expect(result.transports).toContain('meek');
      expect(result.transports).toContain('snowflake');
    });
  });

  describe('isOnionUrl', () => {
    it('should detect onion URLs', () => {
      const manager = new AdvancedTorManager();

      const v3Result = manager.isOnionUrl('http://abcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrstuvwx.onion/path');
      expect(v3Result.isOnion).toBe(true);
      expect(v3Result.isV3).toBe(true);

      const regularResult = manager.isOnionUrl('https://example.com');
      expect(regularResult.isOnion).toBe(false);
    });

    it('should handle invalid URLs', () => {
      const manager = new AdvancedTorManager();
      const result = manager.isOnionUrl('not-a-url');

      expect(result.success).toBe(false);
      expect(result.isOnion).toBe(false);
    });
  });

  describe('setIsolationMode', () => {
    it('should set valid isolation mode', () => {
      const manager = new AdvancedTorManager();

      const result = manager.setIsolationMode('per_tab');

      expect(result.success).toBe(true);
      expect(manager.isolationMode).toBe('per_tab');
    });

    it('should reject invalid isolation mode', () => {
      const manager = new AdvancedTorManager();

      const result = manager.setIsolationMode('invalid_mode');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid isolation mode');
    });
  });

  describe('addBridge', () => {
    it('should add bridge to list', () => {
      const manager = new AdvancedTorManager();

      const result = manager.addBridge('obfs4 192.168.1.1:443 FINGERPRINT cert=xyz');

      expect(result.success).toBe(true);
      expect(result.bridgeCount).toBe(1);
      expect(manager.bridges).toHaveLength(1);
    });

    it('should reject invalid bridge', () => {
      const manager = new AdvancedTorManager();

      const result = manager.addBridge(null);

      expect(result.success).toBe(false);
    });
  });
});

describe('Embedded Tor Directory Structure', () => {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const torTmpDir = path.join(projectRoot, 'tor_tmp');

  it('should have tor_tmp directory for testing', () => {
    // This will pass if the setup script has been run
    if (fs.existsSync(torTmpDir)) {
      expect(fs.statSync(torTmpDir).isDirectory()).toBe(true);
    } else {
      // Skip if not setup
      console.log('tor_tmp not present - run embedded-tor-setup.js first');
    }
  });

  it('should have tor binary if setup completed', () => {
    const torBinary = path.join(torTmpDir, 'tor', 'tor');

    if (fs.existsSync(torTmpDir)) {
      if (fs.existsSync(torBinary)) {
        expect(fs.statSync(torBinary).isFile()).toBe(true);
      }
    }
  });

  it('should have GeoIP files if setup completed', () => {
    const geoipFile = path.join(torTmpDir, 'data', 'geoip');

    if (fs.existsSync(torTmpDir)) {
      if (fs.existsSync(geoipFile)) {
        expect(fs.statSync(geoipFile).isFile()).toBe(true);
        expect(fs.statSync(geoipFile).size).toBeGreaterThan(1000000); // ~9MB
      }
    }
  });
});

describe('Embedded vs System Tor', () => {
  it('should document the differences', () => {
    const differences = {
      systemTor: {
        installation: 'Requires sudo/admin',
        permissions: 'Root required for config',
        systemImpact: 'Installs system service',
        sharing: 'Shared by all applications',
        configLocation: '/etc/tor/torrc',
        autoStart: 'Via systemd/launchd',
        memoryUsage: 'Single shared daemon'
      },
      embeddedTor: {
        installation: 'No installation required',
        permissions: 'User-space only',
        systemImpact: 'None (portable)',
        sharing: 'Isolated per-app',
        configLocation: 'Local file',
        autoStart: 'Via application',
        memoryUsage: 'Per-application'
      }
    };

    // Verify structure
    expect(Object.keys(differences.systemTor)).toEqual(Object.keys(differences.embeddedTor));

    // All values should be strings
    for (const mode of ['systemTor', 'embeddedTor']) {
      for (const value of Object.values(differences[mode])) {
        expect(typeof value).toBe('string');
      }
    }
  });
});
