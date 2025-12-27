/**
 * Basset Hound Browser - Tor Manager Module
 * Handles Tor SOCKS5 proxy connection, circuit management, and identity rotation
 */

const net = require('net');
const { EventEmitter } = require('events');

/**
 * Tor connection states
 */
const TOR_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

/**
 * Default Tor configuration
 */
const TOR_DEFAULTS = {
  socksHost: '127.0.0.1',
  socksPort: 9050,
  controlHost: '127.0.0.1',
  controlPort: 9051,
  controlPassword: null,
  connectionTimeout: 10000,
  circuitTimeout: 30000
};

/**
 * TorManager class
 * Manages Tor SOCKS5 proxy connection and circuit control
 */
class TorManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // SOCKS5 proxy configuration
    this.socksHost = options.socksHost || TOR_DEFAULTS.socksHost;
    this.socksPort = options.socksPort || TOR_DEFAULTS.socksPort;

    // Control port configuration
    this.controlHost = options.controlHost || TOR_DEFAULTS.controlHost;
    this.controlPort = options.controlPort || TOR_DEFAULTS.controlPort;
    this.controlPassword = options.controlPassword || TOR_DEFAULTS.controlPassword;

    // Timeouts
    this.connectionTimeout = options.connectionTimeout || TOR_DEFAULTS.connectionTimeout;
    this.circuitTimeout = options.circuitTimeout || TOR_DEFAULTS.circuitTimeout;

    // State management
    this.state = TOR_STATES.DISCONNECTED;
    this.controlSocket = null;
    this.isAuthenticated = false;
    this.currentExitNode = null;
    this.lastCircuitChange = null;
    this.circuitChangeCount = 0;

    // Connection stats
    this.stats = {
      connectTime: null,
      totalCircuitChanges: 0,
      lastExitIp: null,
      connectionErrors: 0
    };
  }

  /**
   * Get the Tor SOCKS5 proxy configuration for Electron
   * @returns {Object} Proxy configuration
   */
  getProxyConfig() {
    return {
      host: this.socksHost,
      port: this.socksPort,
      type: 'socks5'
    };
  }

  /**
   * Get proxy rules string for Electron session
   * @returns {string} Proxy rules
   */
  getProxyRules() {
    return `socks5://${this.socksHost}:${this.socksPort}`;
  }

  /**
   * Check if Tor SOCKS5 proxy is reachable
   * @returns {Promise<Object>} Connection test result
   */
  async checkConnection() {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const startTime = Date.now();

      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({
          success: false,
          error: 'Connection timeout',
          latency: Date.now() - startTime
        });
      }, this.connectionTimeout);

      socket.connect(this.socksPort, this.socksHost, () => {
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        socket.destroy();
        resolve({
          success: true,
          host: this.socksHost,
          port: this.socksPort,
          latency
        });
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        socket.destroy();
        this.stats.connectionErrors++;
        resolve({
          success: false,
          error: error.message,
          code: error.code
        });
      });
    });
  }

  /**
   * Connect to Tor network via SOCKS5 proxy
   * @returns {Promise<Object>} Connection result
   */
  async connect() {
    try {
      this.state = TOR_STATES.CONNECTING;
      this.emit('stateChange', { state: this.state });

      // First check if Tor SOCKS5 proxy is available
      const connectionCheck = await this.checkConnection();

      if (!connectionCheck.success) {
        this.state = TOR_STATES.ERROR;
        this.emit('stateChange', { state: this.state, error: connectionCheck.error });
        return {
          success: false,
          error: `Cannot connect to Tor SOCKS5 proxy: ${connectionCheck.error}`
        };
      }

      // Mark as connected
      this.state = TOR_STATES.CONNECTED;
      this.stats.connectTime = new Date().toISOString();
      this.emit('stateChange', { state: this.state });
      this.emit('connected', { latency: connectionCheck.latency });

      console.log(`[TorManager] Connected to Tor SOCKS5 proxy at ${this.socksHost}:${this.socksPort}`);

      // Try to get current exit IP
      const exitIp = await this.getExitIp();
      if (exitIp.success) {
        this.currentExitNode = exitIp.ip;
        this.stats.lastExitIp = exitIp.ip;
      }

      return {
        success: true,
        proxyConfig: this.getProxyConfig(),
        proxyRules: this.getProxyRules(),
        latency: connectionCheck.latency,
        exitIp: this.currentExitNode
      };
    } catch (error) {
      this.state = TOR_STATES.ERROR;
      this.stats.connectionErrors++;
      this.emit('stateChange', { state: this.state, error: error.message });
      console.error('[TorManager] Connection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Disconnect from Tor network
   * @returns {Object} Disconnection result
   */
  disconnect() {
    try {
      // Close control socket if open
      if (this.controlSocket) {
        this.controlSocket.destroy();
        this.controlSocket = null;
      }

      this.state = TOR_STATES.DISCONNECTED;
      this.isAuthenticated = false;
      this.currentExitNode = null;
      this.emit('stateChange', { state: this.state });
      this.emit('disconnected');

      console.log('[TorManager] Disconnected from Tor');

      return {
        success: true,
        message: 'Disconnected from Tor'
      };
    } catch (error) {
      console.error('[TorManager] Disconnect error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Connect to Tor control port
   * @returns {Promise<Object>} Control port connection result
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
        console.log(`[TorManager] Connected to Tor control port at ${this.controlHost}:${this.controlPort}`);

        // Authenticate with control port
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
   * Authenticate with Tor control port
   * @returns {Promise<Object>} Authentication result
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
          console.log('[TorManager] Authenticated with Tor control port');
          resolve({ success: true, message: 'Authenticated with control port' });
        } else if (responseData.includes('515') || responseData.includes('515 Authentication failed')) {
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
        // Try cookie authentication or no password
        this.controlSocket.write('AUTHENTICATE\r\n');
      }

      // Timeout for auth response
      setTimeout(() => {
        this.controlSocket.removeListener('data', onData);
        if (!this.isAuthenticated) {
          resolve({
            success: false,
            error: 'Authentication timeout'
          });
        }
      }, 5000);
    });
  }

  /**
   * Send a command to Tor control port
   * @param {string} command - Command to send
   * @returns {Promise<string>} Response from Tor
   * @private
   */
  async _sendControlCommand(command) {
    return new Promise(async (resolve, reject) => {
      // Ensure control port is connected
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

        // Check for end of response (250 OK or error code)
        if (responseData.includes('250 OK') ||
            responseData.match(/^[45]\d{2}/m) ||
            responseData.includes('\r\n.\r\n')) {
          this.controlSocket.removeListener('data', onData);
          resolve(responseData);
        }
      };

      this.controlSocket.on('data', onData);
      this.controlSocket.write(`${command}\r\n`);

      // Timeout for command response
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

  /**
   * Request a new Tor circuit (new identity)
   * @returns {Promise<Object>} New identity result
   */
  async newIdentity() {
    try {
      // First ensure we're connected to control port
      const controlResult = await this.connectControlPort();
      if (!controlResult.success) {
        return {
          success: false,
          error: `Cannot connect to control port: ${controlResult.error}`,
          hint: 'Ensure Tor is running with ControlPort enabled (typically 9051)'
        };
      }

      const response = await this._sendControlCommand('SIGNAL NEWNYM');

      if (response.includes('250 OK')) {
        this.circuitChangeCount++;
        this.stats.totalCircuitChanges++;
        this.lastCircuitChange = new Date().toISOString();

        // Wait a moment for the new circuit to be established
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get new exit IP
        const exitIp = await this.getExitIp();
        const previousIp = this.currentExitNode;

        if (exitIp.success) {
          this.currentExitNode = exitIp.ip;
          this.stats.lastExitIp = exitIp.ip;
        }

        this.emit('newIdentity', {
          previousIp,
          newIp: this.currentExitNode,
          circuitChangeCount: this.circuitChangeCount
        });

        console.log(`[TorManager] New identity requested. Previous: ${previousIp}, New: ${this.currentExitNode}`);

        return {
          success: true,
          message: 'New Tor circuit established',
          previousExitIp: previousIp,
          newExitIp: this.currentExitNode,
          circuitChangeCount: this.circuitChangeCount,
          timestamp: this.lastCircuitChange
        };
      } else if (response.includes('552 Tor is not running')) {
        return {
          success: false,
          error: 'Tor is not running'
        };
      } else {
        return {
          success: false,
          error: 'Failed to request new identity',
          response: response.trim()
        };
      }
    } catch (error) {
      console.error('[TorManager] New identity error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current exit node IP address
   * Uses a public IP checking service through Tor
   * @returns {Promise<Object>} Exit IP result
   */
  async getExitIp() {
    // This would typically make an HTTP request through Tor to an IP checking service
    // For now, we'll return a placeholder since we can't make HTTP requests directly
    // The actual IP check should be done through the browser's fetch API

    // Note: In production, this would use a service like:
    // - https://check.torproject.org/api/ip
    // - https://api.ipify.org?format=json

    return {
      success: true,
      ip: this.currentExitNode || 'unknown',
      message: 'Use the browser to check actual exit IP via fetch to an IP checking service',
      checkUrl: 'https://check.torproject.org/api/ip'
    };
  }

  /**
   * Get current Tor connection status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      state: this.state,
      connected: this.state === TOR_STATES.CONNECTED,
      socksHost: this.socksHost,
      socksPort: this.socksPort,
      controlHost: this.controlHost,
      controlPort: this.controlPort,
      controlConnected: this.controlSocket && !this.controlSocket.destroyed,
      authenticated: this.isAuthenticated,
      currentExitNode: this.currentExitNode,
      lastCircuitChange: this.lastCircuitChange,
      circuitChangeCount: this.circuitChangeCount,
      stats: { ...this.stats }
    };
  }

  /**
   * Get Tor circuit information
   * @returns {Promise<Object>} Circuit information
   */
  async getCircuitInfo() {
    try {
      const response = await this._sendControlCommand('GETINFO circuit-status');

      // Parse circuit information
      const circuits = [];
      const lines = response.split('\n');

      for (const line of lines) {
        if (line.startsWith('250+circuit-status=') || line.match(/^\d+\s+(LAUNCHED|BUILT|EXTENDED|FAILED|CLOSED)/)) {
          const match = line.match(/^(\d+)\s+(\w+)\s+(.*)/);
          if (match) {
            circuits.push({
              id: match[1],
              status: match[2],
              path: match[3]
            });
          }
        }
      }

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
   * Get Tor version and network status
   * @returns {Promise<Object>} Tor version info
   */
  async getTorInfo() {
    try {
      const versionResponse = await this._sendControlCommand('GETINFO version');
      const statusResponse = await this._sendControlCommand('GETINFO status/circuit-established');

      const versionMatch = versionResponse.match(/250-version=(.+)/);
      const statusMatch = statusResponse.match(/250-status\/circuit-established=(\d)/);

      return {
        success: true,
        version: versionMatch ? versionMatch[1].trim() : 'unknown',
        circuitEstablished: statusMatch ? statusMatch[1] === '1' : false
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Configure Tor manager settings
   * @param {Object} config - Configuration options
   * @returns {Object} Configuration result
   */
  configure(config) {
    if (config.socksHost) this.socksHost = config.socksHost;
    if (config.socksPort) this.socksPort = config.socksPort;
    if (config.controlHost) this.controlHost = config.controlHost;
    if (config.controlPort) this.controlPort = config.controlPort;
    if (config.controlPassword !== undefined) this.controlPassword = config.controlPassword;
    if (config.connectionTimeout) this.connectionTimeout = config.connectionTimeout;
    if (config.circuitTimeout) this.circuitTimeout = config.circuitTimeout;

    console.log('[TorManager] Configuration updated');

    return {
      success: true,
      config: {
        socksHost: this.socksHost,
        socksPort: this.socksPort,
        controlHost: this.controlHost,
        controlPort: this.controlPort,
        connectionTimeout: this.connectionTimeout,
        circuitTimeout: this.circuitTimeout
      }
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.disconnect();
    this.removeAllListeners();
    console.log('[TorManager] Cleanup complete');
  }
}

// Export singleton instance and class
const torManager = new TorManager();

module.exports = {
  torManager,
  TorManager,
  TOR_STATES,
  TOR_DEFAULTS
};
