/**
 * Basset Hound Browser - Advanced Tor Manager (base layer)
 *
 * Part of the modularized proxy/tor-advanced module. Provides
 * AdvancedTorManagerBase: constructor, configuration/setup helpers, Tor
 * process lifecycle, and control-port communication. Code moved verbatim
 * from proxy/tor-advanced.js (2026-07-04). No routing/session logic changed.
 *
 * @module proxy/tor-advanced/manager-base
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { EventEmitter } = require('events');

const {
  TOR_STATES,
  TRANSPORT_TYPES,
  ISOLATION_MODES,
  TOR_DEFAULTS,
  EMBEDDED_PATHS
} = require('./constants');

class AdvancedTorManagerBase extends EventEmitter {
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
    this.isolationPorts = new Map(); // Maps isolation key to SOCKS port
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
        path.join(__dirname, '..', '..', 'bin', 'tor', 'tor.exe')
      );
    } else if (platform === 'darwin') {
      possiblePaths.push(
        '/Applications/Tor Browser.app/Contents/MacOS/Tor/tor',
        '/usr/local/bin/tor',
        '/opt/homebrew/bin/tor',
        path.join(__dirname, '..', '..', 'bin', 'tor', 'tor')
      );
    } else {
      // Linux and others
      possiblePaths.push(
        '/usr/bin/tor',
        '/usr/local/bin/tor',
        '/usr/sbin/tor',
        path.join(__dirname, '..', '..', 'bin', 'tor', 'tor')
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
    const binDir = path.join(__dirname, '..', '..', 'bin', 'tor');

    const transportBinaries = {
      obfs4: platform === 'win32' ? 'obfs4proxy.exe' : 'obfs4proxy',
      snowflake: platform === 'win32' ? 'snowflake-client.exe' : 'snowflake-client',
      meek: platform === 'win32' ? 'meek-client.exe' : 'meek-client'
    };

    const binary = transportBinaries[transport];
    if (!binary) {
      return null;
    }

    const transportPath = path.join(binDir, binary);
    if (fs.existsSync(transportPath)) {
      return transportPath;
    }

    // Try system paths
    try {
      const cmd = platform === 'win32' ? `where ${binary}` : `which ${binary}`;
      const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim();
      if (result) {
        return result.split('\n')[0].trim();
      }
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
      // Re-check embedded mode at start time in case Tor was downloaded after construction
      const isEmbedded = this.embeddedMode || this.isEmbeddedAvailable();
      console.log('[TorAdvanced] Checking LD_LIBRARY_PATH: embeddedMode=', this.embeddedMode, 'isEmbeddedAvailable=', this.isEmbeddedAvailable(), 'platform=', os.platform());
      if (isEmbedded && os.platform() === 'linux') {
        const libDir = EMBEDDED_PATHS.libDir;
        console.log('[TorAdvanced] libDir check:', libDir, 'exists:', fs.existsSync(libDir));
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
      if (isEmbedded && os.platform() === 'darwin') {
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
}

module.exports = AdvancedTorManagerBase;
