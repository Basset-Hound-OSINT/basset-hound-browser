/**
 * @fileoverview Basset Hound Browser - Advanced Tor Manager Module
 *
 * Comprehensive Tor integration with process management, circuit control,
 * bridge support, pluggable transports, and stream isolation.
 *
 * This module provides a full-featured Tor management solution including:
 * - Automatic Tor process lifecycle management (start, stop, restart)
 * - Control port communication and authentication
 * - Circuit management and identity switching
 * - Exit/entry node country selection
 * - Bridge and pluggable transport support (obfs4, meek, snowflake)
 * - Stream isolation for enhanced privacy
 * - Onion service (hidden service) creation and management
 * - Bandwidth monitoring and statistics
 *
 * @module proxy/tor-advanced
 * @requires child_process
 * @requires fs
 * @requires path
 * @requires os
 * @requires net
 * @requires events
 * @requires https
 * @requires http
 *
 * @example
 * // Basic usage with embedded Tor
 * const { AdvancedTorManager } = require('./proxy/tor-advanced');
 * const torManager = new AdvancedTorManager({ autoStart: true });
 * await torManager.start();
 *
 * // Request a new identity
 * await torManager.newIdentity();
 *
 * // Set exit country
 * await torManager.setExitCountries(['US', 'DE']);
 *
 * @example
 * // Connect to existing Tor instance
 * const { AdvancedTorManager } = require('./proxy/tor-advanced');
 * const torManager = new AdvancedTorManager();
 * await torManager.connectExisting({
 *   socksPort: 9050,
 *   controlPort: 9051
 * });
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { EventEmitter } = require('events');
const https = require('https');
const http = require('http');

/**
 * Tor connection states enumeration.
 * @const {Object.<string, string>}
 * @property {string} STOPPED - Tor is not running
 * @property {string} STARTING - Tor process is starting
 * @property {string} BOOTSTRAPPING - Tor is connecting to the network
 * @property {string} CONNECTED - Tor is fully connected and ready
 * @property {string} ERROR - Tor encountered an error
 * @property {string} STOPPING - Tor is shutting down
 */
const TOR_STATES = {
  STOPPED: 'stopped',
  STARTING: 'starting',
  BOOTSTRAPPING: 'bootstrapping',
  CONNECTED: 'connected',
  ERROR: 'error',
  STOPPING: 'stopping'
};

/**
 * Pluggable transport types for censorship circumvention.
 * @const {Object.<string, string>}
 * @property {string} NONE - Direct Tor connection without transport
 * @property {string} OBFS4 - Obfuscated protocol, most common and effective
 * @property {string} MEEK - Domain fronting via cloud providers
 * @property {string} SNOWFLAKE - WebRTC-based peer-to-peer circumvention
 * @property {string} WEBTUNNEL - HTTPS-based tunneling
 */
const TRANSPORT_TYPES = {
  NONE: 'none',
  OBFS4: 'obfs4',
  MEEK: 'meek',
  SNOWFLAKE: 'snowflake',
  WEBTUNNEL: 'webtunnel'
};

/**
 * Stream isolation modes for enhanced privacy.
 * Controls how Tor circuits are isolated for different browsing contexts.
 * @const {Object.<string, string>}
 * @property {string} NONE - No isolation, all traffic uses same circuit
 * @property {string} PER_TAB - Each browser tab gets its own circuit
 * @property {string} PER_DOMAIN - Each domain gets its own circuit
 * @property {string} PER_SESSION - Each browsing session gets its own circuit
 */
const ISOLATION_MODES = {
  NONE: 'none',
  PER_TAB: 'per_tab',
  PER_DOMAIN: 'per_domain',
  PER_SESSION: 'per_session'
};

/**
 * Default Tor configuration values.
 * @const {Object}
 * @property {string} socksHost - Default SOCKS proxy host
 * @property {number} socksPort - Default SOCKS proxy port
 * @property {string} controlHost - Default control port host
 * @property {number} controlPort - Default control port
 * @property {number} dnsPort - Default DNS port
 * @property {number} connectionTimeout - Connection timeout in milliseconds
 * @property {number} circuitTimeout - Circuit operation timeout in milliseconds
 * @property {number} bootstrapTimeout - Bootstrap timeout in milliseconds
 * @property {string|null} dataDirectory - Tor data directory path
 * @property {boolean} autoStart - Whether to start Tor automatically
 * @property {boolean} killOnExit - Whether to kill Tor on process exit
 * @property {boolean|null} embeddedMode - Use embedded Tor binary
 */
const TOR_DEFAULTS = {
  socksHost: '127.0.0.1',
  socksPort: 9050,
  controlHost: '127.0.0.1',
  controlPort: 9051,
  dnsPort: 9053,
  connectionTimeout: 30000,
  circuitTimeout: 60000,
  bootstrapTimeout: 120000,
  dataDirectory: null,  // Will be set based on platform
  autoStart: true,
  killOnExit: true,
  embeddedMode: null  // Will be auto-detected based on embedded binary availability
};

/**
 * Embedded Tor binary paths relative to project root.
 * Used when running with bundled Tor binaries.
 * @const {Object}
 * @property {string} torBinary - Path to Tor binary (Unix)
 * @property {string} torBinaryWin - Path to Tor binary (Windows)
 * @property {string} libDir - Path to Tor libraries directory
 * @property {string} geoip - Path to GeoIP database
 * @property {string} geoip6 - Path to GeoIPv6 database
 */
const EMBEDDED_PATHS = {
  torBinary: path.join(__dirname, '..', 'bin', 'tor', 'tor', 'tor'),
  torBinaryWin: path.join(__dirname, '..', 'bin', 'tor', 'tor', 'tor.exe'),
  libDir: path.join(__dirname, '..', 'bin', 'tor', 'tor'),
  geoip: path.join(__dirname, '..', 'bin', 'tor', 'data', 'geoip'),
  geoip6: path.join(__dirname, '..', 'bin', 'tor', 'data', 'geoip6')
};

/**
 * Country codes for Tor exit/entry node selection.
 * Maps ISO 3166-1 alpha-2 codes to Tor format.
 * @const {Object.<string, string>}
 */
const COUNTRY_CODES = {
  US: '{us}', DE: '{de}', NL: '{nl}', FR: '{fr}', GB: '{gb}',
  CH: '{ch}', SE: '{se}', NO: '{no}', FI: '{fi}', AT: '{at}',
  CA: '{ca}', AU: '{au}', JP: '{jp}', SG: '{sg}', HK: '{hk}',
  RO: '{ro}', CZ: '{cz}', PL: '{pl}', IS: '{is}', LU: '{lu}',
  BE: '{be}', IE: '{ie}', ES: '{es}', IT: '{it}', PT: '{pt}',
  BR: '{br}', MX: '{mx}', AR: '{ar}', CL: '{cl}', CO: '{co}'
};

/**
 * Built-in bridge configurations from Tor Browser bundle.
 * These are public bridges maintained by the Tor Project.
 * @const {Object.<string, string[]>}
 * @property {string[]} obfs4 - Obfs4 bridge lines
 * @property {string[]} meek - Meek bridge lines
 * @property {string[]} snowflake - Snowflake bridge lines
 */
const BUILTIN_BRIDGES = {
  obfs4: [
    'obfs4 193.11.166.194:27015 2D82C2E354D531A68469ADA8F3A49B1B6E8D2106 cert=Ohr0Qf7LRu2X4Odj6hWHXKvyOQ2hGkWmkjkCDRJzrJDXYlJKcXRnmkWk0P5cAx0Kv2Qn5g iat-mode=0',
    'obfs4 85.31.186.98:443 011F2599C0E9B27EE74B353155E244813763C3E5 cert=ayq0XzCwhpdysn5o0EyDUbmSOx3X/oTEbzDMvczHOdBJKlvIdHHLJGkZARtT4dcBFArPPg iat-mode=0',
    'obfs4 193.11.166.194:27020 86AC7B8D430DAC4117E9F42C9EAED18133863AAF cert=0Y6bj5Dk6844Q0+t8jTJMvlnQzNMs+nacmJ6VmHMqMk0UsV9OQmD4mKwzEOgbDBbDSqPYA iat-mode=0'
  ],
  meek: [
    'meek_lite 0.0.2.0:2 97700DFE9F483596DDA6264C4D7DF7641E1E39CE url=https://meek.azureedge.net/ front=ajax.aspnetcdn.com'
  ],
  snowflake: [
    'snowflake 192.0.2.3:80 2B280B23E1107BB62ABFC40DDCC8824814F80A72 fingerprint=2B280B23E1107BB62ABFC40DDCC8824814F80A72 url=https://snowflake-broker.torproject.net.global.prod.fastly.net/ front=cdn.sstatic.net ice=stun:stun.l.google.com:19302,stun:stun.voip.blackberry.com:3478,stun:stun.antisip.com:3478,stun:stun.bluesip.net:3478,stun:stun.dus.net:3478,stun:stun.epygi.com:3478,stun:stun.sonetel.com:3478,stun:stun.sonetel.net:3478,stun:stun.uls.co.za:3478,stun:stun.voipgate.com:3478,stun:stun.voys.nl:3478 utls-imitate=hellorandomizedalpn'
  ]
};

/**
 * Advanced Tor Manager for comprehensive Tor network control.
 *
 * Provides complete lifecycle management of Tor including process control,
 * circuit management, identity switching, bridge support, and onion services.
 *
 * @class AdvancedTorManager
 * @extends EventEmitter
 *
 * @fires AdvancedTorManager#stateChange - When Tor state changes
 * @fires AdvancedTorManager#connected - When Tor successfully connects
 * @fires AdvancedTorManager#disconnected - When Tor disconnects
 * @fires AdvancedTorManager#bootstrap - During bootstrap progress updates
 * @fires AdvancedTorManager#newIdentity - When a new identity is established
 * @fires AdvancedTorManager#onionService - When onion service is created/removed
 * @fires AdvancedTorManager#onionLocation - When Onion-Location header is detected
 *
 * @example
 * // Create manager with default settings (auto-detects embedded Tor)
 * const manager = new AdvancedTorManager();
 *
 * @example
 * // Create manager with custom configuration
 * const manager = new AdvancedTorManager({
 *   socksPort: 9150,
 *   controlPort: 9151,
 *   embeddedMode: true,
 *   autoStart: false
 * });
 *
 * @example
 * // Listen for events
 * manager.on('stateChange', ({ state }) => {
 *   console.log('Tor state:', state);
 * });
 * manager.on('bootstrap', ({ progress, phase }) => {
 *   console.log(`Bootstrap: ${progress}% - ${phase}`);
 * });
 */
class AdvancedTorManager extends EventEmitter {
  /**
   * Create an AdvancedTorManager instance.
   *
   * @constructor
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.socksHost='127.0.0.1'] - SOCKS proxy host
   * @param {number} [options.socksPort=9050] - SOCKS proxy port
   * @param {string} [options.controlHost='127.0.0.1'] - Tor control port host
   * @param {number} [options.controlPort=9051] - Tor control port
   * @param {number} [options.dnsPort=9053] - DNS port for Tor DNS resolution
   * @param {string} [options.controlPassword=null] - Control port password (if not using cookie auth)
   * @param {number} [options.connectionTimeout=30000] - Connection timeout in ms
   * @param {number} [options.circuitTimeout=60000] - Circuit operation timeout in ms
   * @param {number} [options.bootstrapTimeout=120000] - Bootstrap timeout in ms
   * @param {boolean} [options.autoStart=true] - Auto-start Tor on instantiation
   * @param {boolean} [options.killOnExit=true] - Kill Tor process when Node exits
   * @param {string} [options.torBinaryPath] - Path to Tor binary (auto-detected if not provided)
   * @param {boolean} [options.embeddedMode] - Use embedded Tor (auto-detected if not provided)
   * @param {string} [options.dataDirectory] - Tor data directory (platform-specific default)
   * @param {string} [options.geoipPath] - Path to GeoIP database
   * @param {string} [options.geoip6Path] - Path to GeoIPv6 database
   */
  constructor(options = {}) {
    super();

    // Core configuration
    this.socksHost = options.socksHost || TOR_DEFAULTS.socksHost;
    this.socksPort = options.socksPort || TOR_DEFAULTS.socksPort;
    this.controlHost = options.controlHost || TOR_DEFAULTS.controlHost;
    this.controlPort = options.controlPort || TOR_DEFAULTS.controlPort;
    this.dnsPort = options.dnsPort || TOR_DEFAULTS.dnsPort;
    this.controlPassword = options.controlPassword || null;

    // Timeouts
    this.connectionTimeout = options.connectionTimeout || TOR_DEFAULTS.connectionTimeout;
    this.circuitTimeout = options.circuitTimeout || TOR_DEFAULTS.circuitTimeout;
    this.bootstrapTimeout = options.bootstrapTimeout || TOR_DEFAULTS.bootstrapTimeout;

    // Process management
    this.autoStart = options.autoStart !== undefined ? options.autoStart : TOR_DEFAULTS.autoStart;
    this.killOnExit = options.killOnExit !== undefined ? options.killOnExit : TOR_DEFAULTS.killOnExit;
    this.torProcess = null;
    this.torBinaryPath = options.torBinaryPath || this._findTorBinary();

    // Embedded mode configuration
    // Auto-detect if not explicitly set: use embedded if the embedded binary exists
    this.embeddedMode = options.embeddedMode !== undefined
      ? options.embeddedMode
      : this.isEmbeddedAvailable();

    // GeoIP paths for embedded mode
    this.geoipPath = options.geoipPath || (this.embeddedMode ? EMBEDDED_PATHS.geoip : null);
    this.geoip6Path = options.geoip6Path || (this.embeddedMode ? EMBEDDED_PATHS.geoip6 : null);

    // Data directory
    this.dataDirectory = options.dataDirectory || this._getDefaultDataDirectory();
    this._ensureDataDirectory();

    // State management
    this.state = TOR_STATES.STOPPED;
    this.controlSocket = null;
    this.isAuthenticated = false;
    this.bootstrapProgress = 0;
    this.bootstrapPhase = '';

    // Circuit management
    this.currentCircuitId = null;
    this.circuits = new Map();
    this.circuitChangeCount = 0;
    this.lastCircuitChange = null;

    // Exit node configuration
    this.exitCountries = [];
    this.excludeCountries = [];
    this.excludeNodes = [];
    this.strictNodes = false;

    // Entry/Guard node configuration
    this.entryCountries = [];
    this.guardNodes = [];

    // Bridge configuration
    this.useBridges = false;
    this.bridges = [];
    this.currentTransport = TRANSPORT_TYPES.NONE;

    // Stream isolation
    this.isolationMode = ISOLATION_MODES.NONE;
    this.isolationPorts = new Map();  // Maps isolation key to SOCKS port
    this.nextIsolationPort = this.socksPort + 1;

    // Statistics
    this.stats = {
      startTime: null,
      connectTime: null,
      totalCircuitChanges: 0,
      totalBytesRead: 0,
      totalBytesWritten: 0,
      currentBandwidth: { read: 0, written: 0 },
      connectionErrors: 0,
      exitIps: []
    };

    // Current exit info
    this.currentExitNode = null;
    this.currentExitCountry = null;
    this.currentExitIp = null;

    // Setup exit handler
    if (this.killOnExit) {
      this._setupExitHandlers();
    }
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Find Tor binary on the system
   * Prioritizes embedded binary if available, then falls back to system Tor
   * @private
   */
  _findTorBinary() {
    const platform = os.platform();

    // First, check for embedded binary (highest priority)
    const embeddedPath = platform === 'win32'
      ? EMBEDDED_PATHS.torBinaryWin
      : EMBEDDED_PATHS.torBinary;

    if (fs.existsSync(embeddedPath)) {
      console.log('[TorAdvanced] Found embedded Tor binary:', embeddedPath);
      return embeddedPath;
    }

    // Fall back to system paths
    const possiblePaths = [];

    if (platform === 'win32') {
      possiblePaths.push(
        'C:\\Program Files\\Tor Browser\\Browser\\TorBrowser\\Tor\\tor.exe',
        'C:\\Program Files (x86)\\Tor Browser\\Browser\\TorBrowser\\Tor\\tor.exe',
        path.join(os.homedir(), 'Desktop', 'Tor Browser', 'Browser', 'TorBrowser', 'Tor', 'tor.exe'),
        path.join(__dirname, '..', 'bin', 'tor', 'tor.exe')
      );
    } else if (platform === 'darwin') {
      possiblePaths.push(
        '/Applications/Tor Browser.app/Contents/MacOS/Tor/tor',
        '/usr/local/bin/tor',
        '/opt/homebrew/bin/tor',
        path.join(__dirname, '..', 'bin', 'tor', 'tor')
      );
    } else {
      // Linux and others
      possiblePaths.push(
        '/usr/bin/tor',
        '/usr/local/bin/tor',
        '/usr/sbin/tor',
        path.join(__dirname, '..', 'bin', 'tor', 'tor')
      );
    }

    // Try to find tor via which/where
    try {
      const cmd = platform === 'win32' ? 'where tor' : 'which tor';
      const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim();
      if (result) {
        return result.split('\n')[0].trim();
      }
    } catch (e) {
      // which/where failed, try paths
    }

    // Check each path
    for (const torPath of possiblePaths) {
      if (fs.existsSync(torPath)) {
        return torPath;
      }
    }

    return null;
  }

  /**
   * Check if the embedded Tor binary is available on the system.
   *
   * @method isEmbeddedAvailable
   * @returns {boolean} True if the embedded Tor binary exists and is accessible
   *
   * @example
   * if (manager.isEmbeddedAvailable()) {
   *   console.log('Using embedded Tor');
   * } else {
   *   console.log('Using system Tor');
   * }
   */
  isEmbeddedAvailable() {
    const platform = os.platform();
    const embeddedPath = platform === 'win32'
      ? EMBEDDED_PATHS.torBinaryWin
      : EMBEDDED_PATHS.torBinary;

    return fs.existsSync(embeddedPath);
  }

  /**
   * Get detailed information about embedded Tor binary paths and availability.
   *
   * @method getEmbeddedInfo
   * @returns {Object} Embedded Tor information
   * @returns {boolean} returns.available - Whether embedded Tor is available
   * @returns {boolean} returns.embeddedMode - Whether embedded mode is currently enabled
   * @returns {Object} returns.paths - Paths to embedded Tor components
   * @returns {Object} returns.exists - Existence status of each component
   *
   * @example
   * const info = manager.getEmbeddedInfo();
   * console.log('Embedded available:', info.available);
   * console.log('Binary path:', info.paths.binary);
   */
  getEmbeddedInfo() {
    const platform = os.platform();
    const embeddedPath = platform === 'win32'
      ? EMBEDDED_PATHS.torBinaryWin
      : EMBEDDED_PATHS.torBinary;

    return {
      available: this.isEmbeddedAvailable(),
      embeddedMode: this.embeddedMode,
      paths: {
        binary: embeddedPath,
        libDir: EMBEDDED_PATHS.libDir,
        geoip: EMBEDDED_PATHS.geoip,
        geoip6: EMBEDDED_PATHS.geoip6
      },
      exists: {
        binary: fs.existsSync(embeddedPath),
        libDir: fs.existsSync(EMBEDDED_PATHS.libDir),
        geoip: fs.existsSync(EMBEDDED_PATHS.geoip),
        geoip6: fs.existsSync(EMBEDDED_PATHS.geoip6)
      }
    };
  }

  /**
   * Get default data directory
   * @private
   */
  _getDefaultDataDirectory() {
    const platform = os.platform();
    let baseDir;

    if (platform === 'win32') {
      baseDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    } else if (platform === 'darwin') {
      baseDir = path.join(os.homedir(), 'Library', 'Application Support');
    } else {
      baseDir = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    }

    return path.join(baseDir, 'basset-hound-browser', 'tor');
  }

  /**
   * Ensure data directory exists
   * @private
   */
  _ensureDataDirectory() {
    try {
      fs.mkdirSync(this.dataDirectory, { recursive: true, mode: 0o700 });
    } catch (error) {
      console.error('[TorAdvanced] Failed to create data directory:', error.message);
    }
  }

  /**
   * Setup exit handlers to kill Tor process on app exit
   * @private
   */
  _setupExitHandlers() {
    const cleanup = () => {
      if (this.torProcess) {
        console.log('[TorAdvanced] Cleaning up Tor process on exit...');
        this.torProcess.kill('SIGTERM');
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', (err) => {
      console.error('[TorAdvanced] Uncaught exception:', err);
      cleanup();
      process.exit(1);
    });
  }

  /**
   * Generate torrc configuration file
   * @private
   */
  _generateTorrc() {
    const torrcPath = path.join(this.dataDirectory, 'torrc');
    const lines = [];

    // Basic configuration
    lines.push(`SocksPort ${this.socksHost}:${this.socksPort}`);
    lines.push(`ControlPort ${this.controlHost}:${this.controlPort}`);
    lines.push(`DNSPort ${this.dnsPort}`);
    lines.push(`DataDirectory ${this.dataDirectory}`);

    // GeoIP files for embedded mode
    if (this.geoipPath && fs.existsSync(this.geoipPath)) {
      lines.push(`GeoIPFile ${this.geoipPath}`);
    }
    if (this.geoip6Path && fs.existsSync(this.geoip6Path)) {
      lines.push(`GeoIPv6File ${this.geoip6Path}`);
    }

    // Authentication
    if (this.controlPassword) {
      // Generate hashed password
      lines.push(`HashedControlPassword ${this._hashPassword(this.controlPassword)}`);
    } else {
      lines.push('CookieAuthentication 1');
    }

    // Exit node configuration
    if (this.exitCountries.length > 0) {
      lines.push(`ExitNodes ${this.exitCountries.join(',')}`);
    }

    if (this.excludeCountries.length > 0) {
      lines.push(`ExcludeExitNodes ${this.excludeCountries.join(',')}`);
    }

    if (this.excludeNodes.length > 0) {
      lines.push(`ExcludeNodes ${this.excludeNodes.join(',')}`);
    }

    // Entry node configuration
    if (this.entryCountries.length > 0) {
      lines.push(`EntryNodes ${this.entryCountries.join(',')}`);
    }

    if (this.guardNodes.length > 0) {
      lines.push(`EntryNodes ${this.guardNodes.join(',')}`);
    }

    // Strict nodes
    if (this.strictNodes) {
      lines.push('StrictNodes 1');
    }

    // Bridge configuration
    if (this.useBridges && this.bridges.length > 0) {
      lines.push('UseBridges 1');

      // Add pluggable transport if needed
      if (this.currentTransport !== TRANSPORT_TYPES.NONE) {
        const transportPath = this._getTransportPath(this.currentTransport);
        if (transportPath) {
          lines.push(`ClientTransportPlugin ${this.currentTransport} exec ${transportPath}`);
        }
      }

      for (const bridge of this.bridges) {
        lines.push(`Bridge ${bridge}`);
      }
    }

    // Stream isolation ports
    if (this.isolationMode !== ISOLATION_MODES.NONE) {
      // Add additional SOCKS ports for isolation
      for (let i = 1; i <= 10; i++) {
        const port = this.socksPort + i;
        lines.push(`SocksPort ${this.socksHost}:${port} IsolateClientAddr IsolateSOCKSAuth`);
      }
    }

    // Performance tuning
    lines.push('CircuitBuildTimeout 30');
    lines.push('LearnCircuitBuildTimeout 0');
    lines.push('MaxCircuitDirtiness 600');

    // Write torrc
    fs.writeFileSync(torrcPath, lines.join('\n'), { mode: 0o600 });

    return torrcPath;
  }

  /**
   * Hash control password for torrc
   * @private
   */
  _hashPassword(password) {
    // This is a simplified version - Tor uses a specific hashing algorithm
    // In production, you'd use tor --hash-password
    try {
      const result = execSync(`"${this.torBinaryPath}" --hash-password "${password}"`, {
        encoding: 'utf8',
        timeout: 10000
      }).trim();
      // Extract the hash (starts with 16:)
      const match = result.match(/16:[A-F0-9]+/i);
      return match ? match[0] : '';
    } catch (error) {
      console.error('[TorAdvanced] Failed to hash password:', error.message);
      return '';
    }
  }

  /**
   * Get pluggable transport binary path
   * @private
   */
  _getTransportPath(transport) {
    const platform = os.platform();
    const binDir = path.join(__dirname, '..', 'bin', 'tor');

    const transportBinaries = {
      obfs4: platform === 'win32' ? 'obfs4proxy.exe' : 'obfs4proxy',
      snowflake: platform === 'win32' ? 'snowflake-client.exe' : 'snowflake-client',
      meek: platform === 'win32' ? 'meek-client.exe' : 'meek-client'
    };

    const binary = transportBinaries[transport];
    if (!binary) return null;

    const transportPath = path.join(binDir, binary);
    if (fs.existsSync(transportPath)) {
      return transportPath;
    }

    // Try system paths
    try {
      const cmd = platform === 'win32' ? `where ${binary}` : `which ${binary}`;
      const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim();
      if (result) return result.split('\n')[0].trim();
    } catch (e) {
      // Not found
    }

    return null;
  }

  // ==========================================
  // Process Management Methods
  // ==========================================

  /**
   * Start the Tor daemon.
   *
   * Spawns a new Tor process with the current configuration, waits for
   * bootstrap to complete, and establishes the control port connection.
   *
   * @method start
   * @async
   * @returns {Promise<Object>} Start result
   * @returns {boolean} returns.success - Whether Tor started successfully
   * @returns {string} [returns.message] - Success message
   * @returns {number} [returns.pid] - Tor process ID if successful
   * @returns {string} [returns.error] - Error message if failed
   * @returns {string} [returns.hint] - Helpful hint for resolving errors
   * @returns {number} [returns.bootstrapProgress] - Bootstrap progress if timed out
   * @throws {Error} Does not throw, errors returned in result object
   *
   * @example
   * const result = await manager.start();
   * if (result.success) {
   *   console.log('Tor started with PID:', result.pid);
   * } else {
   *   console.error('Failed to start Tor:', result.error);
   * }
   */
  async start() {
    if (this.state !== TOR_STATES.STOPPED && this.state !== TOR_STATES.ERROR) {
      return {
        success: false,
        error: `Cannot start: Tor is in ${this.state} state`
      };
    }

    if (!this.torBinaryPath || !fs.existsSync(this.torBinaryPath)) {
      return {
        success: false,
        error: 'Tor binary not found. Please install Tor or provide the path.',
        hint: 'Install Tor: apt install tor (Linux), brew install tor (macOS)'
      };
    }

    this.state = TOR_STATES.STARTING;
    this.emit('stateChange', { state: this.state });

    try {
      // Generate torrc
      const torrcPath = this._generateTorrc();

      // Prepare spawn options
      const spawnOptions = {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      };

      // Set LD_LIBRARY_PATH on Linux when using embedded Tor
      // This ensures the embedded Tor can find its shared libraries
      if (this.embeddedMode && os.platform() === 'linux') {
        const libDir = EMBEDDED_PATHS.libDir;
        if (fs.existsSync(libDir)) {
          const currentLdPath = process.env.LD_LIBRARY_PATH || '';
          const newLdPath = currentLdPath ? `${libDir}:${currentLdPath}` : libDir;
          spawnOptions.env = {
            ...process.env,
            LD_LIBRARY_PATH: newLdPath
          };
          console.log('[TorAdvanced] Set LD_LIBRARY_PATH for embedded Tor:', libDir);
        }
      }

      // Set DYLD_LIBRARY_PATH on macOS when using embedded Tor
      if (this.embeddedMode && os.platform() === 'darwin') {
        const libDir = EMBEDDED_PATHS.libDir;
        if (fs.existsSync(libDir)) {
          const currentDyldPath = process.env.DYLD_LIBRARY_PATH || '';
          const newDyldPath = currentDyldPath ? `${libDir}:${currentDyldPath}` : libDir;
          spawnOptions.env = {
            ...process.env,
            DYLD_LIBRARY_PATH: newDyldPath
          };
          console.log('[TorAdvanced] Set DYLD_LIBRARY_PATH for embedded Tor:', libDir);
        }
      }

      // Start Tor process
      return new Promise((resolve) => {
        this.torProcess = spawn(this.torBinaryPath, ['-f', torrcPath], spawnOptions);

        let bootstrapComplete = false;
        const bootstrapTimeout = setTimeout(() => {
          if (!bootstrapComplete) {
            this.state = TOR_STATES.ERROR;
            this.emit('stateChange', { state: this.state, error: 'Bootstrap timeout' });
            resolve({
              success: false,
              error: 'Tor bootstrap timed out',
              bootstrapProgress: this.bootstrapProgress
            });
          }
        }, this.bootstrapTimeout);

        this.torProcess.stdout.on('data', (data) => {
          const output = data.toString();
          this._parseBootstrapOutput(output);

          if (this.bootstrapProgress >= 100 && !bootstrapComplete) {
            bootstrapComplete = true;
            clearTimeout(bootstrapTimeout);
            this.state = TOR_STATES.CONNECTED;
            this.stats.startTime = new Date().toISOString();
            this.emit('stateChange', { state: this.state });
            this.emit('connected', { bootstrapProgress: 100 });

            console.log('[TorAdvanced] Tor bootstrap complete');
            resolve({
              success: true,
              message: 'Tor started and connected',
              pid: this.torProcess.pid
            });
          }
        });

        this.torProcess.stderr.on('data', (data) => {
          const output = data.toString();
          console.error('[TorAdvanced] Tor stderr:', output);
          this._parseBootstrapOutput(output);
        });

        this.torProcess.on('error', (error) => {
          clearTimeout(bootstrapTimeout);
          this.state = TOR_STATES.ERROR;
          this.emit('stateChange', { state: this.state, error: error.message });
          console.error('[TorAdvanced] Tor process error:', error);
          resolve({
            success: false,
            error: error.message
          });
        });

        this.torProcess.on('exit', (code, signal) => {
          clearTimeout(bootstrapTimeout);
          if (this.state !== TOR_STATES.STOPPING) {
            this.state = TOR_STATES.ERROR;
            this.emit('stateChange', { state: this.state, error: `Process exited with code ${code}` });
          }
          this.torProcess = null;
          console.log(`[TorAdvanced] Tor process exited: code=${code}, signal=${signal}`);
        });
      });
    } catch (error) {
      this.state = TOR_STATES.ERROR;
      this.emit('stateChange', { state: this.state, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop the Tor daemon gracefully.
   *
   * Sends SIGTERM to the Tor process and waits for it to exit.
   * Falls back to SIGKILL after 10 seconds if graceful shutdown fails.
   *
   * @method stop
   * @async
   * @returns {Promise<Object>} Stop result
   * @returns {boolean} returns.success - Whether Tor stopped successfully
   * @returns {string} returns.message - Status message
   *
   * @example
   * const result = await manager.stop();
   * console.log(result.message); // 'Tor stopped'
   */
  async stop() {
    if (this.state === TOR_STATES.STOPPED) {
      return {
        success: true,
        message: 'Tor is already stopped'
      };
    }

    this.state = TOR_STATES.STOPPING;
    this.emit('stateChange', { state: this.state });

    // Close control socket
    if (this.controlSocket) {
      this.controlSocket.destroy();
      this.controlSocket = null;
    }

    // Kill Tor process
    if (this.torProcess) {
      return new Promise((resolve) => {
        const killTimeout = setTimeout(() => {
          // Force kill if graceful shutdown fails
          if (this.torProcess) {
            this.torProcess.kill('SIGKILL');
          }
        }, 10000);

        this.torProcess.once('exit', () => {
          clearTimeout(killTimeout);
          this.state = TOR_STATES.STOPPED;
          this.torProcess = null;
          this.isAuthenticated = false;
          this.emit('stateChange', { state: this.state });
          this.emit('disconnected');
          console.log('[TorAdvanced] Tor stopped');
          resolve({
            success: true,
            message: 'Tor stopped'
          });
        });

        this.torProcess.kill('SIGTERM');
      });
    }

    this.state = TOR_STATES.STOPPED;
    this.emit('stateChange', { state: this.state });
    return {
      success: true,
      message: 'Tor stopped'
    };
  }

  /**
   * Restart the Tor daemon.
   *
   * Stops the current Tor process and starts a new one with the current configuration.
   * Useful after configuration changes that require a full restart.
   *
   * @method restart
   * @async
   * @returns {Promise<Object>} Restart result (same format as start())
   *
   * @example
   * // After changing bridge configuration
   * manager.addBridge('obfs4 192.168.1.1:443 ...');
   * await manager.restart();
   */
  async restart() {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.start();
  }

  /**
   * Parse bootstrap output from Tor
   * @private
   */
  _parseBootstrapOutput(output) {
    // Parse bootstrap progress (e.g., "Bootstrapped 50%: Loading directory")
    const match = output.match(/Bootstrapped (\d+)%[^:]*:\s*(.+)/i);
    if (match) {
      this.bootstrapProgress = parseInt(match[1], 10);
      this.bootstrapPhase = match[2].trim();

      if (this.state === TOR_STATES.STARTING || this.state === TOR_STATES.BOOTSTRAPPING) {
        this.state = TOR_STATES.BOOTSTRAPPING;
      }

      this.emit('bootstrap', {
        progress: this.bootstrapProgress,
        phase: this.bootstrapPhase
      });
    }
  }

  // ==========================================
  // Control Port Methods
  // ==========================================

  /**
   * Connect to the Tor control port.
   *
   * Establishes a TCP connection to the Tor control port and authenticates.
   * Uses cookie authentication by default, falls back to password if configured.
   *
   * @method connectControlPort
   * @async
   * @returns {Promise<Object>} Connection result
   * @returns {boolean} returns.success - Whether connection succeeded
   * @returns {string} [returns.message] - Success message
   * @returns {string} [returns.error] - Error message if failed
   * @returns {string} [returns.code] - Error code if applicable
   *
   * @example
   * const result = await manager.connectControlPort();
   * if (result.success) {
   *   console.log('Connected to control port');
   * }
   */
  async connectControlPort() {
    return new Promise((resolve) => {
      if (this.controlSocket && !this.controlSocket.destroyed) {
        resolve({ success: true, message: 'Already connected to control port' });
        return;
      }

      this.controlSocket = new net.Socket();

      const timeout = setTimeout(() => {
        this.controlSocket.destroy();
        resolve({
          success: false,
          error: 'Control port connection timeout'
        });
      }, this.connectionTimeout);

      this.controlSocket.connect(this.controlPort, this.controlHost, async () => {
        clearTimeout(timeout);
        console.log(`[TorAdvanced] Connected to control port ${this.controlHost}:${this.controlPort}`);

        // Authenticate
        const authResult = await this._authenticateControlPort();
        resolve(authResult);
      });

      this.controlSocket.on('error', (error) => {
        clearTimeout(timeout);
        this.controlSocket.destroy();
        this.controlSocket = null;
        resolve({
          success: false,
          error: `Control port error: ${error.message}`,
          code: error.code
        });
      });

      this.controlSocket.on('close', () => {
        this.isAuthenticated = false;
        this.controlSocket = null;
      });
    });
  }

  /**
   * Authenticate with control port
   * @private
   */
  async _authenticateControlPort() {
    return new Promise((resolve) => {
      if (!this.controlSocket) {
        resolve({ success: false, error: 'Control socket not connected' });
        return;
      }

      let responseData = '';

      const onData = (data) => {
        responseData += data.toString();

        if (responseData.includes('250 OK')) {
          this.controlSocket.removeListener('data', onData);
          this.isAuthenticated = true;
          console.log('[TorAdvanced] Authenticated with control port');
          resolve({ success: true, message: 'Authenticated with control port' });
        } else if (responseData.includes('515')) {
          this.controlSocket.removeListener('data', onData);
          resolve({
            success: false,
            error: 'Authentication failed - check control password'
          });
        }
      };

      this.controlSocket.on('data', onData);

      // Send authentication command
      if (this.controlPassword) {
        this.controlSocket.write(`AUTHENTICATE "${this.controlPassword}"\r\n`);
      } else {
        // Try cookie authentication
        const cookiePath = path.join(this.dataDirectory, 'control_auth_cookie');
        if (fs.existsSync(cookiePath)) {
          const cookie = fs.readFileSync(cookiePath);
          this.controlSocket.write(`AUTHENTICATE ${cookie.toString('hex')}\r\n`);
        } else {
          // Try empty authentication
          this.controlSocket.write('AUTHENTICATE\r\n');
        }
      }

      setTimeout(() => {
        if (this.controlSocket) {
          this.controlSocket.removeListener('data', onData);
        }
        if (!this.isAuthenticated) {
          resolve({
            success: false,
            error: 'Authentication timeout'
          });
        }
      }, 10000);
    });
  }

  /**
   * Send a command to the Tor control port.
   *
   * Low-level method for sending raw Tor control protocol commands.
   * Automatically connects and authenticates if not already connected.
   *
   * @method sendCommand
   * @async
   * @param {string} command - Tor control protocol command to send
   * @returns {Promise<string>} Raw response from Tor
   * @throws {Error} If not authenticated or command times out
   *
   * @see {@link https://gitweb.torproject.org/torspec.git/tree/control-spec.txt|Tor Control Protocol Spec}
   *
   * @example
   * // Get Tor version
   * const response = await manager.sendCommand('GETINFO version');
   *
   * @example
   * // Set configuration option
   * await manager.sendCommand('SETCONF ExitNodes={us}');
   */
  async sendCommand(command) {
    return new Promise(async (resolve, reject) => {
      if (!this.controlSocket || this.controlSocket.destroyed) {
        const connectResult = await this.connectControlPort();
        if (!connectResult.success) {
          reject(new Error(connectResult.error));
          return;
        }
      }

      if (!this.isAuthenticated) {
        reject(new Error('Not authenticated with control port'));
        return;
      }

      let responseData = '';

      const onData = (data) => {
        responseData += data.toString();

        // Check for end of response
        if (responseData.includes('250 OK') ||
            responseData.match(/^[45]\d{2}/m) ||
            responseData.includes('\r\n.\r\n')) {
          this.controlSocket.removeListener('data', onData);
          resolve(responseData);
        }
      };

      this.controlSocket.on('data', onData);
      this.controlSocket.write(`${command}\r\n`);

      setTimeout(() => {
        this.controlSocket.removeListener('data', onData);
        if (!responseData) {
          reject(new Error('Command timeout'));
        } else {
          resolve(responseData);
        }
      }, this.circuitTimeout);
    });
  }

  // ==========================================
  // Circuit Management Methods
  // ==========================================

  /**
   * Request a new Tor identity by building a new circuit.
   *
   * Sends the NEWNYM signal to Tor, which clears the current circuit
   * and builds a new one with different exit nodes. This effectively
   * changes your visible IP address to websites.
   *
   * Note: Rate-limited by Tor to once every 10 seconds.
   *
   * @method newIdentity
   * @async
   * @returns {Promise<Object>} Identity change result
   * @returns {boolean} returns.success - Whether identity change succeeded
   * @returns {string} [returns.message] - Success message
   * @returns {string} [returns.exitIp] - New exit node IP address
   * @returns {string} [returns.exitCountry] - New exit node country
   * @returns {number} [returns.circuitChangeCount] - Total identity changes this session
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * const result = await manager.newIdentity();
   * if (result.success) {
   *   console.log(`New exit IP: ${result.exitIp} (${result.exitCountry})`);
   * }
   */
  async newIdentity() {
    try {
      const response = await this.sendCommand('SIGNAL NEWNYM');

      if (response.includes('250 OK')) {
        this.circuitChangeCount++;
        this.stats.totalCircuitChanges++;
        this.lastCircuitChange = new Date().toISOString();

        // Wait for new circuit
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Get new exit info
        await this._updateExitInfo();

        this.emit('newIdentity', {
          circuitChangeCount: this.circuitChangeCount,
          newExitIp: this.currentExitIp,
          newExitCountry: this.currentExitCountry
        });

        console.log(`[TorAdvanced] New identity requested. Exit: ${this.currentExitIp} (${this.currentExitCountry})`);

        return {
          success: true,
          message: 'New Tor circuit established',
          exitIp: this.currentExitIp,
          exitCountry: this.currentExitCountry,
          circuitChangeCount: this.circuitChangeCount
        };
      }

      return {
        success: false,
        error: 'Failed to request new identity',
        response: response.trim()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get information about all current Tor circuits.
   *
   * @method getCircuitInfo
   * @async
   * @returns {Promise<Object>} Circuit information
   * @returns {boolean} returns.success - Whether query succeeded
   * @returns {Array<Object>} [returns.circuits] - Array of circuit objects
   * @returns {string} returns.circuits[].id - Circuit ID
   * @returns {string} returns.circuits[].status - Circuit status (LAUNCHED, BUILT, etc.)
   * @returns {Array<string>} returns.circuits[].path - Fingerprints of nodes in circuit
   * @returns {string} returns.circuits[].purpose - Circuit purpose (GENERAL, HS_*, etc.)
   * @returns {number} returns.circuits[].nodeCount - Number of nodes in circuit
   * @returns {number} [returns.count] - Total number of circuits
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * const info = await manager.getCircuitInfo();
   * info.circuits.forEach(circuit => {
   *   console.log(`Circuit ${circuit.id}: ${circuit.status} (${circuit.nodeCount} hops)`);
   * });
   */
  async getCircuitInfo() {
    try {
      const response = await this.sendCommand('GETINFO circuit-status');
      const circuits = this._parseCircuits(response);

      return {
        success: true,
        circuits,
        count: circuits.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse circuit status response
   * @private
   */
  _parseCircuits(response) {
    const circuits = [];
    const lines = response.split('\n');

    for (const line of lines) {
      // Circuit format: ID STATUS PATH PURPOSE TIME
      const match = line.match(/^(\d+)\s+(\w+)\s+(\S+)\s+(\w+)/);
      if (match) {
        const nodes = match[3].split(',').map(node => {
          const nodeMatch = node.match(/\$([A-F0-9]+)/i);
          return nodeMatch ? nodeMatch[1] : node;
        });

        circuits.push({
          id: match[1],
          status: match[2],
          path: nodes,
          purpose: match[4],
          nodeCount: nodes.length
        });
      }
    }

    return circuits;
  }

  /**
   * Get detailed path information for a specific circuit.
   *
   * Returns detailed information about each hop in the circuit including
   * node nicknames, addresses, countries, and bandwidth.
   *
   * @method getCircuitPath
   * @async
   * @param {string} [circuitId=null] - Circuit ID to query. If null, uses first BUILT circuit.
   * @returns {Promise<Object>} Circuit path details
   * @returns {boolean} returns.success - Whether query succeeded
   * @returns {string} [returns.circuitId] - The circuit ID
   * @returns {string} [returns.status] - Circuit status
   * @returns {string} [returns.purpose] - Circuit purpose
   * @returns {Array<Object>} [returns.path] - Array of node information
   * @returns {number} returns.path[].hop - Hop number (1, 2, 3, ...)
   * @returns {string} returns.path[].role - Node role (Guard, Middle, Exit)
   * @returns {string} returns.path[].fingerprint - Node fingerprint
   * @returns {string} returns.path[].nickname - Node nickname
   * @returns {string} returns.path[].address - Node IP address
   * @returns {string} returns.path[].country - Node country code
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * const path = await manager.getCircuitPath();
   * path.path.forEach(node => {
   *   console.log(`${node.hop}. ${node.role}: ${node.nickname} (${node.country})`);
   * });
   */
  async getCircuitPath(circuitId = null) {
    try {
      const circuits = await this.getCircuitInfo();

      if (!circuits.success || circuits.count === 0) {
        return { success: false, error: 'No circuits available' };
      }

      // Find the circuit (use first BUILT circuit if no ID specified)
      let circuit;
      if (circuitId) {
        circuit = circuits.circuits.find(c => c.id === circuitId);
      } else {
        circuit = circuits.circuits.find(c => c.status === 'BUILT');
      }

      if (!circuit) {
        return { success: false, error: 'Circuit not found' };
      }

      // Get node details for each hop
      const path = [];
      for (let i = 0; i < circuit.path.length; i++) {
        const fingerprint = circuit.path[i];
        const nodeInfo = await this._getNodeInfo(fingerprint);
        path.push({
          hop: i + 1,
          role: i === 0 ? 'Guard' : (i === circuit.path.length - 1 ? 'Exit' : 'Middle'),
          fingerprint,
          ...nodeInfo
        });
      }

      return {
        success: true,
        circuitId: circuit.id,
        status: circuit.status,
        purpose: circuit.purpose,
        path
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get info about a specific node
   * @private
   */
  async _getNodeInfo(fingerprint) {
    try {
      const response = await this.sendCommand(`GETINFO ns/id/${fingerprint}`);
      const info = {
        nickname: 'Unknown',
        address: 'Unknown',
        port: 0,
        country: 'Unknown',
        bandwidth: 0
      };

      // Parse node info
      const nicknameMatch = response.match(/r\s+(\S+)/);
      if (nicknameMatch) info.nickname = nicknameMatch[1];

      const addressMatch = response.match(/a\s+(\S+):(\d+)/);
      if (addressMatch) {
        info.address = addressMatch[1];
        info.port = parseInt(addressMatch[2], 10);
      }

      const bandwidthMatch = response.match(/w\s+Bandwidth=(\d+)/);
      if (bandwidthMatch) info.bandwidth = parseInt(bandwidthMatch[1], 10);

      // Get country (requires GeoIP)
      try {
        const geoResponse = await this.sendCommand(`GETINFO ip-to-country/${info.address}`);
        const countryMatch = geoResponse.match(/=(\w{2})/);
        if (countryMatch) info.country = countryMatch[1].toUpperCase();
      } catch (e) {
        // GeoIP not available
      }

      return info;
    } catch (error) {
      return {
        nickname: 'Unknown',
        address: 'Unknown',
        port: 0,
        country: 'Unknown',
        bandwidth: 0
      };
    }
  }

  /**
   * Close a specific Tor circuit.
   *
   * @method closeCircuit
   * @async
   * @param {string} circuitId - The circuit ID to close
   * @returns {Promise<Object>} Result
   * @returns {boolean} returns.success - Whether circuit was closed
   * @returns {string} [returns.message] - Success message
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * await manager.closeCircuit('15');
   */
  async closeCircuit(circuitId) {
    try {
      const response = await this.sendCommand(`CLOSECIRCUIT ${circuitId}`);

      if (response.includes('250 OK')) {
        return { success: true, message: `Circuit ${circuitId} closed` };
      }

      return { success: false, error: 'Failed to close circuit', response: response.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // Exit Node Control Methods
  // ==========================================

  /**
   * Set preferred exit node countries.
   *
   * Restricts Tor to only use exit nodes in the specified countries.
   * Use with caution as this reduces anonymity.
   *
   * @method setExitCountries
   * @async
   * @param {string|string[]} countries - ISO 3166-1 alpha-2 country code(s)
   * @returns {Promise<Object>} Result
   * @returns {boolean} returns.success - Whether setting was applied
   * @returns {string[]} [returns.exitCountries] - List of applied countries
   * @returns {string} [returns.message] - Success message
   * @returns {string} [returns.error] - Error message if failed
   * @returns {string[]} [returns.validCodes] - List of valid country codes (on error)
   *
   * @example
   * // Single country
   * await manager.setExitCountries('US');
   *
   * @example
   * // Multiple countries
   * await manager.setExitCountries(['US', 'DE', 'NL']);
   */
  async setExitCountries(countries) {
    const countryList = Array.isArray(countries) ? countries : [countries];
    const validCountries = countryList
      .map(c => c.toUpperCase())
      .filter(c => COUNTRY_CODES[c])
      .map(c => COUNTRY_CODES[c]);

    if (validCountries.length === 0) {
      return {
        success: false,
        error: 'No valid country codes provided',
        validCodes: Object.keys(COUNTRY_CODES)
      };
    }

    this.exitCountries = validCountries;

    try {
      await this.sendCommand(`SETCONF ExitNodes=${validCountries.join(',')}`);
      await this.newIdentity();

      return {
        success: true,
        exitCountries: countryList.filter(c => COUNTRY_CODES[c.toUpperCase()]),
        message: 'Exit countries configured'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Exclude specific countries from exit node selection.
   *
   * Tor will never use exit nodes in the specified countries.
   *
   * @method excludeExitCountries
   * @async
   * @param {string|string[]} countries - ISO 3166-1 alpha-2 country code(s) to exclude
   * @returns {Promise<Object>} Result
   * @returns {boolean} returns.success - Whether setting was applied
   * @returns {string[]} [returns.excludedCountries] - List of excluded countries
   * @returns {string} [returns.message] - Success message
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * // Exclude specific countries
   * await manager.excludeExitCountries(['CN', 'RU', 'IR']);
   */
  async excludeExitCountries(countries) {
    const countryList = Array.isArray(countries) ? countries : [countries];
    const validCountries = countryList
      .map(c => c.toUpperCase())
      .filter(c => COUNTRY_CODES[c])
      .map(c => COUNTRY_CODES[c]);

    this.excludeCountries = validCountries;

    try {
      if (validCountries.length > 0) {
        await this.sendCommand(`SETCONF ExcludeExitNodes=${validCountries.join(',')}`);
      } else {
        await this.sendCommand('SETCONF ExcludeExitNodes=');
      }
      await this.newIdentity();

      return {
        success: true,
        excludedCountries: countryList.filter(c => COUNTRY_CODES[c.toUpperCase()]),
        message: 'Countries excluded from exit nodes'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all exit node country restrictions.
   *
   * Removes any exit country preferences or exclusions, allowing Tor
   * to freely choose exit nodes from any country.
   *
   * @method clearExitRestrictions
   * @async
   * @returns {Promise<Object>} Result
   * @returns {boolean} returns.success - Whether restrictions were cleared
   * @returns {string} [returns.message] - Success message
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * await manager.clearExitRestrictions();
   */
  async clearExitRestrictions() {
    this.exitCountries = [];
    this.excludeCountries = [];

    try {
      await this.sendCommand('SETCONF ExitNodes=');
      await this.sendCommand('SETCONF ExcludeExitNodes=');

      return {
        success: true,
        message: 'Exit node restrictions cleared'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // Entry/Guard Node Control Methods
  // ==========================================

  /**
   * Set preferred entry (guard) node countries.
   *
   * Restricts Tor to only use guard nodes in the specified countries.
   * Use with caution as this reduces anonymity.
   *
   * @method setEntryCountries
   * @async
   * @param {string|string[]} countries - ISO 3166-1 alpha-2 country code(s)
   * @returns {Promise<Object>} Result
   * @returns {boolean} returns.success - Whether setting was applied
   * @returns {string[]} [returns.entryCountries] - List of applied countries
   * @returns {string} [returns.message] - Success message
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * await manager.setEntryCountries(['DE', 'CH']);
   */
  async setEntryCountries(countries) {
    const countryList = Array.isArray(countries) ? countries : [countries];
    const validCountries = countryList
      .map(c => c.toUpperCase())
      .filter(c => COUNTRY_CODES[c])
      .map(c => COUNTRY_CODES[c]);

    if (validCountries.length === 0) {
      return {
        success: false,
        error: 'No valid country codes provided',
        validCodes: Object.keys(COUNTRY_CODES)
      };
    }

    this.entryCountries = validCountries;

    try {
      await this.sendCommand(`SETCONF EntryNodes=${validCountries.join(',')}`);
      await this.newIdentity();

      return {
        success: true,
        entryCountries: countryList.filter(c => COUNTRY_CODES[c.toUpperCase()]),
        message: 'Entry countries configured'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // Bridge Support Methods
  // ==========================================

  /**
   * Enable bridge mode for censorship circumvention.
   *
   * Bridges help users in censored regions connect to Tor when
   * direct connections are blocked. Supports various pluggable transports.
   *
   * @method enableBridges
   * @async
   * @param {Object} [options={}] - Bridge configuration options
   * @param {string} [options.transport='obfs4'] - Transport type (obfs4, meek, snowflake)
   * @param {string[]} [options.bridges=null] - Custom bridge lines (uses builtin if null)
   * @param {boolean} [options.useBuiltin=true] - Use builtin bridges if no custom provided
   * @returns {Promise<Object>} Result (from restart())
   *
   * @example
   * // Use builtin obfs4 bridges
   * await manager.enableBridges({ transport: 'obfs4' });
   *
   * @example
   * // Use custom bridges
   * await manager.enableBridges({
   *   transport: 'obfs4',
   *   bridges: ['obfs4 192.168.1.1:443 FINGERPRINT cert=CERT iat-mode=0']
   * });
   */
  async enableBridges(options = {}) {
    const {
      transport = TRANSPORT_TYPES.OBFS4,
      bridges = null,
      useBuiltin = true
    } = options;

    this.useBridges = true;
    this.currentTransport = transport;

    // Use provided bridges or builtin
    if (bridges && bridges.length > 0) {
      this.bridges = bridges;
    } else if (useBuiltin && BUILTIN_BRIDGES[transport]) {
      this.bridges = BUILTIN_BRIDGES[transport];
    } else {
      return {
        success: false,
        error: `No bridges available for transport: ${transport}`
      };
    }

    // Restart Tor to apply bridge configuration
    return await this.restart();
  }

  /**
   * Add a custom bridge to the configuration.
   *
   * The bridge is added to the list but Tor must be restarted for it to take effect.
   *
   * @method addBridge
   * @param {string} bridge - Full bridge line (e.g., 'obfs4 IP:PORT FINGERPRINT cert=...')
   * @returns {Object} Result
   * @returns {boolean} returns.success - Whether bridge was added
   * @returns {number} [returns.bridgeCount] - Total bridge count
   * @returns {string} [returns.message] - Status message
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * manager.addBridge('obfs4 192.168.1.1:443 ABC123 cert=XYZ iat-mode=0');
   * await manager.restart(); // Apply changes
   */
  addBridge(bridge) {
    if (!bridge || typeof bridge !== 'string') {
      return { success: false, error: 'Invalid bridge format' };
    }

    this.bridges.push(bridge);
    return {
      success: true,
      bridgeCount: this.bridges.length,
      message: 'Bridge added (restart Tor to apply)'
    };
  }

  /**
   * Disable bridge mode and return to direct Tor connections.
   *
   * @method disableBridges
   * @async
   * @returns {Promise<Object>} Result (from restart())
   *
   * @example
   * await manager.disableBridges();
   */
  async disableBridges() {
    this.useBridges = false;
    this.bridges = [];
    this.currentTransport = TRANSPORT_TYPES.NONE;

    return await this.restart();
  }

  /**
   * Fetch bridges from the Tor BridgeDB service.
   *
   * Note: This requires CAPTCHA solving in practice, so this method
   * currently returns the builtin bridges instead.
   *
   * @method fetchBridgesFromBridgeDB
   * @async
   * @param {string} [transport='obfs4'] - Transport type to request
   * @returns {Promise<Object>} Result
   * @returns {boolean} returns.success - Always false (not implemented)
   * @returns {string} returns.error - Explanation
   * @returns {string} returns.hint - Suggestion to get bridges manually
   * @returns {string[]} returns.builtinBridges - Available builtin bridges
   */
  async fetchBridgesFromBridgeDB(transport = 'obfs4') {
    // Note: This requires CAPTCHA solving in practice
    // The Tor Browser uses a more sophisticated approach
    return {
      success: false,
      error: 'BridgeDB integration requires CAPTCHA solving',
      hint: 'Visit bridges.torproject.org to get bridges manually',
      builtinBridges: BUILTIN_BRIDGES[transport] || []
    };
  }

  // ==========================================
  // Stream Isolation Methods
  // ==========================================

  /**
   * Set the stream isolation mode for enhanced privacy.
   *
   * Stream isolation ensures that different browsing contexts use
   * different Tor circuits, preventing correlation attacks.
   *
   * @method setIsolationMode
   * @param {string} mode - Isolation mode (none, per_tab, per_domain, per_session)
   * @returns {Object} Result
   * @returns {boolean} returns.success - Whether mode was set
   * @returns {string} [returns.isolationMode] - The new isolation mode
   * @returns {string} [returns.message] - Status message
   * @returns {string} [returns.error] - Error message if invalid mode
   *
   * @example
   * manager.setIsolationMode('per_tab');
   * await manager.restart(); // Apply changes
   */
  setIsolationMode(mode) {
    if (!Object.values(ISOLATION_MODES).includes(mode)) {
      return {
        success: false,
        error: `Invalid isolation mode. Valid modes: ${Object.values(ISOLATION_MODES).join(', ')}`
      };
    }

    this.isolationMode = mode;
    return {
      success: true,
      isolationMode: mode,
      message: 'Isolation mode set (restart Tor to apply)'
    };
  }

  /**
   * Get a SOCKS port for the given isolation key.
   *
   * Returns a dedicated SOCKS port for the isolation key (tab ID, domain, etc.)
   * ensuring stream isolation between different browsing contexts.
   *
   * @method getIsolatedPort
   * @param {string} key - Isolation key (tab ID, domain, session ID, etc.)
   * @returns {Object} Port information
   * @returns {boolean} returns.success - Always true
   * @returns {number} returns.port - SOCKS port to use
   * @returns {boolean} returns.isolated - Whether isolation is active
   * @returns {string} [returns.key] - The isolation key if isolated
   *
   * @example
   * const { port } = manager.getIsolatedPort('tab-123');
   * // Configure proxy to use port
   */
  getIsolatedPort(key) {
    if (this.isolationMode === ISOLATION_MODES.NONE) {
      return {
        success: true,
        port: this.socksPort,
        isolated: false
      };
    }

    if (!this.isolationPorts.has(key)) {
      const port = this.nextIsolationPort++;
      if (this.nextIsolationPort > this.socksPort + 10) {
        this.nextIsolationPort = this.socksPort + 1;
      }
      this.isolationPorts.set(key, port);
    }

    return {
      success: true,
      port: this.isolationPorts.get(key),
      isolated: true,
      key
    };
  }

  // ==========================================
  // Exit IP Detection Methods
  // ==========================================

  /**
   * Update current exit info by making HTTP request
   * @private
   */
  async _updateExitInfo() {
    try {
      const result = await this.checkExitIp();
      if (result.success) {
        this.currentExitIp = result.ip;
        this.currentExitCountry = result.country;
        if (!this.stats.exitIps.includes(result.ip)) {
          this.stats.exitIps.push(result.ip);
        }
      }
    } catch (error) {
      console.error('[TorAdvanced] Failed to update exit info:', error.message);
    }
  }

  /**
   * Check the current exit IP via the Tor Project check service.
   *
   * Makes an HTTPS request to check.torproject.org to verify the
   * current exit node IP and confirm Tor connectivity.
   *
   * @method checkExitIp
   * @async
   * @returns {Promise<Object>} Exit IP information
   * @returns {boolean} returns.success - Whether check succeeded
   * @returns {string} [returns.ip] - Current exit node IP address
   * @returns {boolean} [returns.isTor] - Whether connection is via Tor
   * @returns {string} [returns.message] - Status message
   * @returns {string} [returns.error] - Error message if failed
   * @returns {string} [returns.hint] - Helpful hint on error
   *
   * @example
   * const result = await manager.checkExitIp();
   * if (result.isTor) {
   *   console.log(`Exit IP: ${result.ip}`);
   * }
   */
  async checkExitIp() {
    return new Promise((resolve) => {
      // Use Tor Project's check API
      const options = {
        hostname: 'check.torproject.org',
        port: 443,
        path: '/api/ip',
        method: 'GET',
        timeout: 30000,
        agent: false  // In real implementation, route through SOCKS
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({
              success: true,
              ip: json.IP,
              isTor: json.IsTor,
              message: json.IsTor ? 'Connected through Tor' : 'NOT connected through Tor'
            });
          } catch (e) {
            resolve({
              success: false,
              error: 'Failed to parse response'
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          hint: 'Make sure traffic is routed through Tor SOCKS proxy'
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout'
        });
      });

      req.end();
    });
  }

  // ==========================================
  // Bandwidth & Stats Methods
  // ==========================================

  /**
   * Get current bandwidth usage statistics.
   *
   * @method getBandwidth
   * @async
   * @returns {Promise<Object>} Bandwidth statistics
   * @returns {boolean} returns.success - Whether query succeeded
   * @returns {number} [returns.bytesRead] - Total bytes read
   * @returns {number} [returns.bytesWritten] - Total bytes written
   * @returns {string} [returns.bytesReadFormatted] - Human-readable bytes read
   * @returns {string} [returns.bytesWrittenFormatted] - Human-readable bytes written
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * const stats = await manager.getBandwidth();
   * console.log(`Downloaded: ${stats.bytesReadFormatted}`);
   */
  async getBandwidth() {
    try {
      const response = await this.sendCommand('GETINFO traffic/read');
      const readMatch = response.match(/traffic\/read=(\d+)/);
      const bytesRead = readMatch ? parseInt(readMatch[1], 10) : 0;

      const writeResponse = await this.sendCommand('GETINFO traffic/written');
      const writeMatch = writeResponse.match(/traffic\/written=(\d+)/);
      const bytesWritten = writeMatch ? parseInt(writeMatch[1], 10) : 0;

      this.stats.totalBytesRead = bytesRead;
      this.stats.totalBytesWritten = bytesWritten;

      return {
        success: true,
        bytesRead,
        bytesWritten,
        bytesReadFormatted: this._formatBytes(bytesRead),
        bytesWrittenFormatted: this._formatBytes(bytesWritten)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Format bytes to human readable
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ==========================================
  // Status & Configuration Methods
  // ==========================================

  /**
   * Get comprehensive status information about the Tor manager.
   *
   * Returns complete state including connection status, configuration,
   * exit node info, bridge settings, and session statistics.
   *
   * @method getStatus
   * @returns {Object} Full status object
   * @returns {string} returns.state - Current state (from TOR_STATES)
   * @returns {boolean} returns.connected - Whether Tor is connected
   * @returns {boolean} returns.processRunning - Whether Tor process is running
   * @returns {number|null} returns.pid - Tor process ID
   * @returns {number} returns.bootstrapProgress - Bootstrap progress (0-100)
   * @returns {string} returns.bootstrapPhase - Current bootstrap phase
   * @returns {boolean} returns.controlConnected - Whether control port is connected
   * @returns {boolean} returns.authenticated - Whether authenticated with control port
   * @returns {Object} returns.embedded - Embedded Tor status
   * @returns {Object} returns.socks - SOCKS proxy configuration
   * @returns {Object} returns.control - Control port configuration
   * @returns {Object} returns.exitNode - Exit node information
   * @returns {Object} returns.bridges - Bridge configuration
   * @returns {Object} returns.isolation - Stream isolation status
   * @returns {Object} returns.circuits - Circuit statistics
   * @returns {Object} returns.stats - Session statistics
   *
   * @example
   * const status = manager.getStatus();
   * console.log(`State: ${status.state}`);
   * console.log(`Exit IP: ${status.exitNode.ip}`);
   */
  getStatus() {
    return {
      state: this.state,
      connected: this.state === TOR_STATES.CONNECTED,
      processRunning: this.torProcess !== null,
      pid: this.torProcess ? this.torProcess.pid : null,
      bootstrapProgress: this.bootstrapProgress,
      bootstrapPhase: this.bootstrapPhase,
      controlConnected: this.controlSocket && !this.controlSocket.destroyed,
      authenticated: this.isAuthenticated,

      embedded: {
        mode: this.embeddedMode,
        available: this.isEmbeddedAvailable(),
        geoipConfigured: !!(this.geoipPath && fs.existsSync(this.geoipPath))
      },

      socks: {
        host: this.socksHost,
        port: this.socksPort
      },
      control: {
        host: this.controlHost,
        port: this.controlPort
      },

      exitNode: {
        ip: this.currentExitIp,
        country: this.currentExitCountry,
        restrictions: {
          allowedCountries: this.exitCountries,
          excludedCountries: this.excludeCountries
        }
      },

      bridges: {
        enabled: this.useBridges,
        transport: this.currentTransport,
        count: this.bridges.length
      },

      isolation: {
        mode: this.isolationMode,
        activePorts: this.isolationPorts.size
      },

      circuits: {
        changeCount: this.circuitChangeCount,
        lastChange: this.lastCircuitChange
      },

      stats: { ...this.stats }
    };
  }

  /**
   * Check if Tor is currently running and usable.
   *
   * Returns true if Tor is fully connected or if it's still bootstrapping
   * but has an active process (which means it's on its way to connecting).
   *
   * @method isRunning
   * @returns {boolean} True if Tor is running or bootstrapping
   *
   * @example
   * if (manager.isRunning()) {
   *   console.log('Tor is ready');
   * }
   */
  isRunning() {
    return this.state === TOR_STATES.CONNECTED ||
           (this.torProcess !== null && this.state === TOR_STATES.BOOTSTRAPPING);
  }

  /**
   * Get proxy configuration object for Electron.
   *
   * Returns a proxy configuration object that can be used with Electron's
   * session.setProxy() or other HTTP clients.
   *
   * @method getProxyConfig
   * @param {string} [isolationKey=null] - Optional isolation key for stream isolation
   * @returns {Object} Proxy configuration object
   * @returns {string} returns.host - Proxy host
   * @returns {number} returns.port - Proxy port
   * @returns {string} returns.type - Proxy type ('socks5')
   *
   * @example
   * const config = manager.getProxyConfig();
   * await session.defaultSession.setProxy({
   *   proxyRules: `socks5://${config.host}:${config.port}`
   * });
   */
  getProxyConfig(isolationKey = null) {
    const port = isolationKey
      ? this.getIsolatedPort(isolationKey).port
      : this.socksPort;

    return {
      host: this.socksHost,
      port,
      type: 'socks5'
    };
  }

  /**
   * Get proxy rules string for Electron.
   *
   * Returns a proxy rules string suitable for Electron's session.setProxy().
   *
   * @method getProxyRules
   * @param {string} [isolationKey=null] - Optional isolation key for stream isolation
   * @returns {string} Proxy rules string (e.g., 'socks5://127.0.0.1:9050')
   *
   * @example
   * await session.defaultSession.setProxy({
   *   proxyRules: manager.getProxyRules()
   * });
   */
  getProxyRules(isolationKey = null) {
    const port = isolationKey
      ? this.getIsolatedPort(isolationKey).port
      : this.socksPort;

    return `socks5://${this.socksHost}:${port}`;
  }

  /**
   * Update manager configuration.
   *
   * Allows changing configuration options at runtime. Note that most
   * changes require a restart of Tor to take effect.
   *
   * @method configure
   * @param {Object} config - Configuration options to update
   * @param {string} [config.socksHost] - SOCKS proxy host
   * @param {number} [config.socksPort] - SOCKS proxy port
   * @param {string} [config.controlHost] - Control port host
   * @param {number} [config.controlPort] - Control port
   * @param {string} [config.controlPassword] - Control port password
   * @param {number} [config.connectionTimeout] - Connection timeout in ms
   * @param {number} [config.circuitTimeout] - Circuit timeout in ms
   * @param {number} [config.bootstrapTimeout] - Bootstrap timeout in ms
   * @param {string} [config.dataDirectory] - Tor data directory
   * @param {string} [config.torBinaryPath] - Path to Tor binary
   * @param {boolean} [config.embeddedMode] - Use embedded Tor
   * @param {string} [config.geoipPath] - Path to GeoIP database
   * @param {string} [config.geoip6Path] - Path to GeoIPv6 database
   * @returns {Object} Result with updated configuration
   *
   * @example
   * manager.configure({ socksPort: 9150 });
   * await manager.restart();
   */
  configure(config) {
    if (config.socksHost) this.socksHost = config.socksHost;
    if (config.socksPort) this.socksPort = config.socksPort;
    if (config.controlHost) this.controlHost = config.controlHost;
    if (config.controlPort) this.controlPort = config.controlPort;
    if (config.controlPassword !== undefined) this.controlPassword = config.controlPassword;
    if (config.connectionTimeout) this.connectionTimeout = config.connectionTimeout;
    if (config.circuitTimeout) this.circuitTimeout = config.circuitTimeout;
    if (config.bootstrapTimeout) this.bootstrapTimeout = config.bootstrapTimeout;
    if (config.dataDirectory) this.dataDirectory = config.dataDirectory;
    if (config.torBinaryPath) this.torBinaryPath = config.torBinaryPath;
    if (config.embeddedMode !== undefined) this.embeddedMode = config.embeddedMode;
    if (config.geoipPath) this.geoipPath = config.geoipPath;
    if (config.geoip6Path) this.geoip6Path = config.geoip6Path;

    return {
      success: true,
      config: {
        socksHost: this.socksHost,
        socksPort: this.socksPort,
        controlHost: this.controlHost,
        controlPort: this.controlPort,
        dataDirectory: this.dataDirectory,
        embeddedMode: this.embeddedMode,
        geoipPath: this.geoipPath,
        geoip6Path: this.geoip6Path
      }
    };
  }

  /**
   * Get all available country codes for node selection.
   *
   * Returns a list of valid country codes and their descriptions
   * that can be used with setExitCountries() and setEntryCountries().
   *
   * @method getCountryCodes
   * @returns {Object} Country code information
   * @returns {boolean} returns.success - Always true
   * @returns {string[]} returns.countries - Array of country codes
   * @returns {Object.<string, string>} returns.descriptions - Code to name mapping
   *
   * @example
   * const { countries, descriptions } = manager.getCountryCodes();
   * countries.forEach(code => {
   *   console.log(`${code}: ${descriptions[code]}`);
   * });
   */
  getCountryCodes() {
    return {
      success: true,
      countries: Object.keys(COUNTRY_CODES),
      descriptions: {
        US: 'United States', DE: 'Germany', NL: 'Netherlands', FR: 'France',
        GB: 'United Kingdom', CH: 'Switzerland', SE: 'Sweden', NO: 'Norway',
        FI: 'Finland', AT: 'Austria', CA: 'Canada', AU: 'Australia',
        JP: 'Japan', SG: 'Singapore', HK: 'Hong Kong', RO: 'Romania',
        CZ: 'Czech Republic', PL: 'Poland', IS: 'Iceland', LU: 'Luxembourg',
        BE: 'Belgium', IE: 'Ireland', ES: 'Spain', IT: 'Italy',
        PT: 'Portugal', BR: 'Brazil', MX: 'Mexico', AR: 'Argentina',
        CL: 'Chile', CO: 'Colombia'
      }
    };
  }

  /**
   * Get available pluggable transport types.
   *
   * Returns a list of supported transport types for bridge connections.
   *
   * @method getTransportTypes
   * @returns {Object} Transport type information
   * @returns {boolean} returns.success - Always true
   * @returns {string[]} returns.transports - Array of transport types
   * @returns {Object.<string, string>} returns.descriptions - Type to description mapping
   *
   * @example
   * const { transports, descriptions } = manager.getTransportTypes();
   * transports.forEach(type => {
   *   console.log(`${type}: ${descriptions[type]}`);
   * });
   */
  getTransportTypes() {
    return {
      success: true,
      transports: Object.values(TRANSPORT_TYPES),
      descriptions: {
        [TRANSPORT_TYPES.NONE]: 'No transport (direct Tor connection)',
        [TRANSPORT_TYPES.OBFS4]: 'Obfuscated protocol - most common and effective',
        [TRANSPORT_TYPES.MEEK]: 'Domain fronting via cloud providers (Azure)',
        [TRANSPORT_TYPES.SNOWFLAKE]: 'WebRTC-based peer-to-peer circumvention',
        [TRANSPORT_TYPES.WEBTUNNEL]: 'HTTPS-based tunneling'
      }
    };
  }

  // ==========================================
  // Onion Service Methods
  // ==========================================

  /**
   * Create a new onion service (hidden service).
   *
   * Creates an ephemeral onion service that routes traffic from the .onion
   * address to a local server. The service is removed when Tor stops.
   *
   * @method createOnionService
   * @async
   * @param {Object} [options={}] - Service configuration
   * @param {number} [options.port=80] - External port on the .onion address
   * @param {number} [options.targetPort=8080] - Local port to forward to
   * @param {string} [options.targetHost='127.0.0.1'] - Local host to forward to
   * @param {number} [options.version=3] - Onion service version (3 recommended)
   * @param {string} [options.keyType='NEW:ED25519-V3'] - Key type for v3 services
   * @param {string[]} [options.flags=[]] - Optional flags (e.g., ['Detach'])
   * @returns {Promise<Object>} Service information
   * @returns {boolean} returns.success - Whether service was created
   * @returns {string} [returns.address] - The .onion address
   * @returns {string} [returns.serviceId] - Service ID (without .onion)
   * @returns {number} [returns.port] - External port
   * @returns {number} [returns.targetPort] - Target port
   * @returns {string} [returns.privateKey] - Private key (save to restore service)
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * // Create a hidden service for a local web server
   * const service = await manager.createOnionService({
   *   port: 80,
   *   targetPort: 3000
   * });
   * console.log(`Onion address: ${service.address}`);
   */
  async createOnionService(options = {}) {
    const {
      port = 80,
      targetPort = 8080,
      targetHost = '127.0.0.1',
      version = 3,  // v3 onion addresses (56 chars)
      keyType = 'NEW:ED25519-V3',
      flags = []  // e.g., ['Detach', 'DiscardPK']
    } = options;

    try {
      const flagStr = flags.length > 0 ? ` Flags=${flags.join(',')}` : '';
      const command = `ADD_ONION ${keyType} Port=${port},${targetHost}:${targetPort}${flagStr}`;

      const response = await this.sendCommand(command);

      if (response.includes('250-ServiceID=')) {
        const serviceIdMatch = response.match(/ServiceID=(\S+)/);
        const privateKeyMatch = response.match(/PrivateKey=(\S+)/);

        const serviceId = serviceIdMatch ? serviceIdMatch[1] : null;

        if (serviceId) {
          const onionAddress = `${serviceId}.onion`;

          this.emit('onionService', {
            action: 'created',
            address: onionAddress,
            port
          });

          return {
            success: true,
            address: onionAddress,
            serviceId,
            port,
            targetPort,
            targetHost,
            privateKey: privateKeyMatch ? privateKeyMatch[1] : null,
            version
          };
        }
      }

      return {
        success: false,
        error: 'Failed to create onion service',
        response: response.trim()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove an existing onion service.
   *
   * @method removeOnionService
   * @async
   * @param {string} serviceId - Service ID (the part before .onion)
   * @returns {Promise<Object>} Result
   * @returns {boolean} returns.success - Whether service was removed
   * @returns {string} [returns.message] - Success message
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * await manager.removeOnionService('abc123xyz...');
   */
  async removeOnionService(serviceId) {
    try {
      const response = await this.sendCommand(`DEL_ONION ${serviceId}`);

      if (response.includes('250 OK')) {
        this.emit('onionService', {
          action: 'removed',
          serviceId
        });

        return {
          success: true,
          message: `Onion service ${serviceId} removed`
        };
      }

      return {
        success: false,
        error: 'Failed to remove onion service',
        response: response.trim()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List all active onion services.
   *
   * @method listOnionServices
   * @async
   * @returns {Promise<Object>} Services list
   * @returns {boolean} returns.success - Whether query succeeded
   * @returns {Array<Object>} [returns.services] - Array of service objects
   * @returns {string} returns.services[].serviceId - Service ID
   * @returns {string} returns.services[].address - Full .onion address
   * @returns {number} [returns.count] - Number of active services
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * const { services } = await manager.listOnionServices();
   * services.forEach(s => console.log(s.address));
   */
  async listOnionServices() {
    try {
      const response = await this.sendCommand('GETINFO onions/current');
      const services = [];

      const match = response.match(/onions\/current=(.+)/);
      if (match && match[1]) {
        const serviceIds = match[1].trim().split('\n');
        for (const id of serviceIds) {
          if (id && id !== '.') {
            services.push({
              serviceId: id.trim(),
              address: `${id.trim()}.onion`
            });
          }
        }
      }

      return {
        success: true,
        services,
        count: services.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if a URL is an onion address.
   *
   * @method isOnionUrl
   * @param {string} url - URL to check
   * @returns {Object} Check result
   * @returns {boolean} returns.success - Whether URL was parsed successfully
   * @returns {boolean} returns.isOnion - Whether URL is a .onion address
   * @returns {boolean} [returns.isV3] - Whether it's a v3 onion address
   * @returns {string} [returns.hostname] - The hostname from the URL
   * @returns {number|null} [returns.version] - Onion version (2 or 3) or null
   * @returns {string} [returns.error] - Error message if invalid URL
   *
   * @example
   * const check = manager.isOnionUrl('http://example.onion/path');
   * if (check.isOnion) {
   *   console.log('This is an onion site');
   * }
   */
  isOnionUrl(url) {
    try {
      const urlObj = new URL(url);
      const isOnion = urlObj.hostname.endsWith('.onion');
      const isV3 = isOnion && urlObj.hostname.length === 62;  // 56 char ID + .onion

      return {
        success: true,
        isOnion,
        isV3,
        hostname: urlObj.hostname,
        version: isOnion ? (isV3 ? 3 : 2) : null
      };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid URL',
        isOnion: false
      };
    }
  }

  /**
   * Handle an Onion-Location HTTP header.
   *
   * Websites can include an Onion-Location header to advertise their
   * .onion equivalent. This method validates the header and returns
   * information about whether a redirect should occur.
   *
   * @method handleOnionLocation
   * @param {string} onionLocation - Value from the Onion-Location header
   * @returns {Object} Redirect information
   * @returns {boolean} returns.success - Whether header was valid
   * @returns {boolean} [returns.shouldRedirect] - Whether to redirect
   * @returns {string} [returns.onionUrl] - The .onion URL to redirect to
   * @returns {number} [returns.version] - Onion version (2 or 3)
   * @returns {string} [returns.error] - Error message if invalid
   *
   * @example
   * // In a response interceptor
   * const location = response.headers['onion-location'];
   * if (location) {
   *   const redirect = manager.handleOnionLocation(location);
   *   if (redirect.shouldRedirect) {
   *     navigate(redirect.onionUrl);
   *   }
   * }
   */
  handleOnionLocation(onionLocation) {
    if (!onionLocation) {
      return { success: false, error: 'No Onion-Location provided' };
    }

    const check = this.isOnionUrl(onionLocation);

    if (check.isOnion) {
      this.emit('onionLocation', {
        onionUrl: onionLocation,
        version: check.version
      });

      return {
        success: true,
        shouldRedirect: true,
        onionUrl: onionLocation,
        version: check.version
      };
    }

    return {
      success: false,
      shouldRedirect: false,
      error: 'Invalid Onion-Location URL'
    };
  }

  // ==========================================
  // Network Consensus Methods
  // ==========================================

  /**
   * Get network consensus information
   * @returns {Promise<Object>} Consensus info
   */
  async getConsensusInfo() {
    try {
      const validAfterRes = await this.sendCommand('GETINFO consensus/valid-after');
      const freshUntilRes = await this.sendCommand('GETINFO consensus/fresh-until');
      const validUntilRes = await this.sendCommand('GETINFO consensus/valid-until');

      const parseDate = (str) => {
        const match = str.match(/=(.+)/);
        return match ? match[1].trim() : null;
      };

      return {
        success: true,
        consensus: {
          validAfter: parseDate(validAfterRes),
          freshUntil: parseDate(freshUntilRes),
          validUntil: parseDate(validUntilRes)
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get relay count from directory
   * @returns {Promise<Object>} Relay info
   */
  async getRelayCount() {
    try {
      const response = await this.sendCommand('GETINFO ns/all');
      const relays = response.split('\n').filter(line => line.startsWith('r ')).length;

      return {
        success: true,
        relayCount: relays
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // Advanced Connection Methods
  // ==========================================

  /**
   * Connect to an existing external Tor instance.
   *
   * Instead of starting its own Tor process, this connects to a
   * Tor instance that's already running (e.g., Tor Browser, system Tor).
   *
   * @method connectExisting
   * @async
   * @param {Object} [options={}] - Connection options
   * @param {string} [options.socksHost='127.0.0.1'] - SOCKS proxy host
   * @param {number} [options.socksPort=9050] - SOCKS proxy port
   * @param {string} [options.controlHost='127.0.0.1'] - Control port host
   * @param {number} [options.controlPort=9051] - Control port
   * @param {string} [options.controlPassword] - Control port password
   * @returns {Promise<Object>} Connection result
   * @returns {boolean} returns.success - Whether connection succeeded
   * @returns {boolean} [returns.partial] - True if only SOCKS works (no control)
   * @returns {string} [returns.message] - Status message
   * @returns {string} [returns.exitIp] - Current exit IP (if detected)
   * @returns {string} [returns.exitCountry] - Current exit country
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * // Connect to Tor Browser
   * await manager.connectExisting({
   *   socksPort: 9150,
   *   controlPort: 9151
   * });
   */
  async connectExisting(options = {}) {
    const {
      socksHost = this.socksHost,
      socksPort = this.socksPort,
      controlHost = this.controlHost,
      controlPort = this.controlPort,
      controlPassword = this.controlPassword
    } = options;

    // Update configuration
    this.socksHost = socksHost;
    this.socksPort = socksPort;
    this.controlHost = controlHost;
    this.controlPort = controlPort;
    this.controlPassword = controlPassword;

    // Check SOCKS connectivity
    const socksCheck = await this._checkSocksConnection();
    if (!socksCheck.success) {
      return {
        success: false,
        error: `Cannot connect to Tor SOCKS proxy at ${socksHost}:${socksPort}`,
        details: socksCheck.error
      };
    }

    // Connect to control port
    const controlResult = await this.connectControlPort();
    if (!controlResult.success) {
      // SOCKS works but control port doesn't - partial success
      this.state = TOR_STATES.CONNECTED;
      this.bootstrapProgress = 100;
      this.emit('stateChange', { state: this.state });

      return {
        success: true,
        partial: true,
        message: 'Connected to Tor SOCKS proxy (control port unavailable)',
        controlError: controlResult.error
      };
    }

    this.state = TOR_STATES.CONNECTED;
    this.bootstrapProgress = 100;
    this.stats.connectTime = new Date().toISOString();
    this.emit('stateChange', { state: this.state });
    this.emit('connected', { external: true });

    // Get exit info
    await this._updateExitInfo();

    return {
      success: true,
      message: 'Connected to existing Tor instance',
      exitIp: this.currentExitIp,
      exitCountry: this.currentExitCountry
    };
  }

  /**
   * Check SOCKS connection
   * @private
   */
  async _checkSocksConnection() {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ success: false, error: 'Connection timeout' });
      }, this.connectionTimeout);

      socket.connect(this.socksPort, this.socksHost, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ success: true });
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * Clean up all resources and stop Tor.
   *
   * Stops the Tor process and removes all event listeners.
   * Should be called when the application is shutting down.
   *
   * @method cleanup
   * @async
   * @returns {Promise<void>}
   *
   * @example
   * // On app shutdown
   * await manager.cleanup();
   */
  async cleanup() {
    await this.stop();
    this.removeAllListeners();
    console.log('[TorAdvanced] Cleanup complete');
  }
}

// Export
const advancedTorManager = new AdvancedTorManager();

module.exports = {
  advancedTorManager,
  AdvancedTorManager,
  TOR_STATES,
  TRANSPORT_TYPES,
  ISOLATION_MODES,
  COUNTRY_CODES,
  BUILTIN_BRIDGES,
  TOR_DEFAULTS,
  EMBEDDED_PATHS
};
