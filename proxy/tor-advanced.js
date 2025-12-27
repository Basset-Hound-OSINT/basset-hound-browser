/**
 * Basset Hound Browser - Advanced Tor Manager Module
 * Comprehensive Tor integration with process management, circuit control,
 * bridge support, pluggable transports, and stream isolation
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
 * Tor connection states
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
 * Pluggable transport types
 */
const TRANSPORT_TYPES = {
  NONE: 'none',
  OBFS4: 'obfs4',
  MEEK: 'meek',
  SNOWFLAKE: 'snowflake',
  WEBTUNNEL: 'webtunnel'
};

/**
 * Stream isolation modes
 */
const ISOLATION_MODES = {
  NONE: 'none',
  PER_TAB: 'per_tab',
  PER_DOMAIN: 'per_domain',
  PER_SESSION: 'per_session'
};

/**
 * Default Tor configuration
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
  killOnExit: true
};

/**
 * Country codes for Tor exit/entry node selection
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
 * Built-in obfs4 bridges (from Tor Browser bundle)
 * These are public bridges maintained by the Tor Project
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
 * AdvancedTorManager class
 * Comprehensive Tor management with all advanced features
 */
class AdvancedTorManager extends EventEmitter {
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
   * @private
   */
  _findTorBinary() {
    const platform = os.platform();
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
   * Start Tor daemon
   * @returns {Promise<Object>} Start result
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

      // Start Tor process
      return new Promise((resolve) => {
        this.torProcess = spawn(this.torBinaryPath, ['-f', torrcPath], {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false
        });

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
   * Stop Tor daemon
   * @returns {Promise<Object>} Stop result
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
   * Restart Tor daemon
   * @returns {Promise<Object>} Restart result
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
   * Connect to Tor control port
   * @returns {Promise<Object>} Connection result
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
        this.controlSocket.removeListener('data', onData);
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
   * Send command to control port
   * @param {string} command - Command to send
   * @returns {Promise<string>} Response
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
   * Request new Tor identity (new circuit)
   * @returns {Promise<Object>} Result
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
   * Get current circuit information
   * @returns {Promise<Object>} Circuit info
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
   * Get detailed info about circuit path
   * @param {string} circuitId - Circuit ID
   * @returns {Promise<Object>} Circuit path details
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
   * Close a specific circuit
   * @param {string} circuitId - Circuit ID to close
   * @returns {Promise<Object>} Result
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
   * Set preferred exit countries
   * @param {string|string[]} countries - Country code(s)
   * @returns {Promise<Object>} Result
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
   * Exclude countries from exit nodes
   * @param {string|string[]} countries - Country code(s) to exclude
   * @returns {Promise<Object>} Result
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
   * Clear exit node restrictions
   * @returns {Promise<Object>} Result
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
   * Set preferred entry countries
   * @param {string|string[]} countries - Country code(s)
   * @returns {Promise<Object>} Result
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
   * Enable bridges with optional transport
   * @param {Object} options - Bridge options
   * @returns {Promise<Object>} Result
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
   * Add a custom bridge
   * @param {string} bridge - Bridge line
   * @returns {Object} Result
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
   * Disable bridges
   * @returns {Promise<Object>} Result
   */
  async disableBridges() {
    this.useBridges = false;
    this.bridges = [];
    this.currentTransport = TRANSPORT_TYPES.NONE;

    return await this.restart();
  }

  /**
   * Get available bridges from BridgeDB
   * @param {string} transport - Transport type
   * @returns {Promise<Object>} Result
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
   * Set stream isolation mode
   * @param {string} mode - Isolation mode
   * @returns {Object} Result
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
   * Get SOCKS port for isolation key
   * @param {string} key - Isolation key (tab ID, domain, etc.)
   * @returns {Object} Port info
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
   * Check current exit IP via Tor Project check service
   * @returns {Promise<Object>} Exit IP info
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
   * Get bandwidth statistics
   * @returns {Promise<Object>} Bandwidth stats
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
   * Get comprehensive status
   * @returns {Object} Full status
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
   * Get proxy configuration for Electron
   * @param {string} isolationKey - Optional isolation key
   * @returns {Object} Proxy config
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
   * Get proxy rules for Electron
   * @param {string} isolationKey - Optional isolation key
   * @returns {string} Proxy rules
   */
  getProxyRules(isolationKey = null) {
    const port = isolationKey
      ? this.getIsolatedPort(isolationKey).port
      : this.socksPort;

    return `socks5://${this.socksHost}:${port}`;
  }

  /**
   * Configure manager
   * @param {Object} config - Configuration options
   * @returns {Object} Result
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

    return {
      success: true,
      config: {
        socksHost: this.socksHost,
        socksPort: this.socksPort,
        controlHost: this.controlHost,
        controlPort: this.controlPort,
        dataDirectory: this.dataDirectory
      }
    };
  }

  /**
   * Get available country codes
   * @returns {Object} Country codes
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
   * Get available transports
   * @returns {Object} Transport types
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
   * Create a hidden service (onion service)
   * @param {Object} options - Service options
   * @returns {Promise<Object>} Service info
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
   * Remove a hidden service
   * @param {string} serviceId - Service ID (without .onion)
   * @returns {Promise<Object>} Result
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
   * List active onion services
   * @returns {Promise<Object>} Active services
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
   * Check if URL is an onion address
   * @param {string} url - URL to check
   * @returns {Object} Check result
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
   * Handle Onion-Location header redirect
   * @param {string} onionLocation - Onion-Location header value
   * @returns {Object} Redirect info
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
   * Connect to existing Tor instance (external Tor)
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} Connection result
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
   * Cleanup resources
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
  TOR_DEFAULTS
};
