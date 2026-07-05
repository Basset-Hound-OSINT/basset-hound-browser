/**
 * Basset Hound Browser - Advanced Tor Manager (final layer)
 *
 * Extends AdvancedTorManagerRouting with exit-IP detection, bandwidth/stats,
 * status/configuration, onion services, network consensus, advanced
 * connection, and cleanup. Exposes the concrete AdvancedTorManager class.
 * Code moved verbatim from proxy/tor-advanced.js (2026-07-04).
 *
 * @module proxy/tor-advanced/manager
 */

const AdvancedTorManagerRouting = require('./manager-routing');
const {
  TOR_STATES,
  TRANSPORT_TYPES,
  COUNTRY_CODES
} = require('./constants');
const fs = require('fs');
const net = require('net');
const https = require('https');

class AdvancedTorManager extends AdvancedTorManagerRouting {
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
        agent: false // In real implementation, route through SOCKS
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
    if (bytes === 0) {
      return '0 B';
    }
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
        geoipConfigured: Boolean(this.geoipPath && fs.existsSync(this.geoipPath))
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
    if (config.socksHost) {
      this.socksHost = config.socksHost;
    }
    if (config.socksPort) {
      this.socksPort = config.socksPort;
    }
    if (config.controlHost) {
      this.controlHost = config.controlHost;
    }
    if (config.controlPort) {
      this.controlPort = config.controlPort;
    }
    if (config.controlPassword !== undefined) {
      this.controlPassword = config.controlPassword;
    }
    if (config.connectionTimeout) {
      this.connectionTimeout = config.connectionTimeout;
    }
    if (config.circuitTimeout) {
      this.circuitTimeout = config.circuitTimeout;
    }
    if (config.bootstrapTimeout) {
      this.bootstrapTimeout = config.bootstrapTimeout;
    }
    if (config.dataDirectory) {
      this.dataDirectory = config.dataDirectory;
    }
    if (config.torBinaryPath) {
      this.torBinaryPath = config.torBinaryPath;
    }
    if (config.embeddedMode !== undefined) {
      this.embeddedMode = config.embeddedMode;
    }
    if (config.geoipPath) {
      this.geoipPath = config.geoipPath;
    }
    if (config.geoip6Path) {
      this.geoip6Path = config.geoip6Path;
    }

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
      version = 3, // v3 onion addresses (56 chars)
      keyType = 'NEW:ED25519-V3',
      flags = [] // e.g., ['Detach', 'DiscardPK']
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
      const isV3 = isOnion && urlObj.hostname.length === 62; // 56 char ID + .onion

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

module.exports = AdvancedTorManager;
