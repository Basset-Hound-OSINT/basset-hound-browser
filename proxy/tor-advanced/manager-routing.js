/**
 * Basset Hound Browser - Advanced Tor Manager (routing layer)
 *
 * Extends AdvancedTorManagerBase with circuit management, exit/entry node
 * control, bridge support, and stream isolation. Code moved verbatim from
 * proxy/tor-advanced.js (2026-07-04). No routing/session logic changed.
 *
 * @module proxy/tor-advanced/manager-routing
 */

const AdvancedTorManagerBase = require('./manager-base');
const {
  TRANSPORT_TYPES,
  ISOLATION_MODES,
  COUNTRY_CODES,
  BUILTIN_BRIDGES
} = require('./constants');

class AdvancedTorManagerRouting extends AdvancedTorManagerBase {
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
      if (nicknameMatch) {
        info.nickname = nicknameMatch[1];
      }

      const addressMatch = response.match(/a\s+(\S+):(\d+)/);
      if (addressMatch) {
        info.address = addressMatch[1];
        info.port = parseInt(addressMatch[2], 10);
      }

      const bandwidthMatch = response.match(/w\s+Bandwidth=(\d+)/);
      if (bandwidthMatch) {
        info.bandwidth = parseInt(bandwidthMatch[1], 10);
      }

      // Get country (requires GeoIP)
      try {
        const geoResponse = await this.sendCommand(`GETINFO ip-to-country/${info.address}`);
        const countryMatch = geoResponse.match(/=(\w{2})/);
        if (countryMatch) {
          info.country = countryMatch[1].toUpperCase();
        }
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
   * Get detailed information about the current exit node.
   *
   * Returns comprehensive information about the current exit node including
   * IP address, country, fingerprint, and circuit path details. This is the
   * user-facing method to understand their current Tor exit point.
   *
   * @method getExitInfo
   * @async
   * @returns {Promise<Object>} Exit node information
   * @returns {boolean} returns.success - Whether query succeeded
   * @returns {string} [returns.exitIp] - Current exit node IP address
   * @returns {string} [returns.exitCountry] - Current exit node country code
   * @returns {string} [returns.exitFingerprint] - Exit node fingerprint
   * @returns {string} [returns.exitNickname] - Exit node nickname
   * @returns {Object} [returns.circuit] - Current circuit information
   * @returns {string} returns.circuit.id - Circuit ID
   * @returns {string} returns.circuit.status - Circuit status
   * @returns {Array<Object>} returns.circuit.path - Circuit path nodes
   * @returns {Object} [returns.restrictions] - Current exit restrictions
   * @returns {string[]} returns.restrictions.allowedCountries - Allowed exit countries
   * @returns {string[]} returns.restrictions.excludedCountries - Excluded exit countries
   * @returns {string} [returns.error] - Error message if failed
   *
   * @example
   * const info = await manager.getExitInfo();
   * if (info.success) {
   *   console.log(`Exit: ${info.exitIp} (${info.exitCountry})`);
   *   console.log(`Node: ${info.exitNickname}`);
   * }
   */
  async getExitInfo() {
    try {
      // First, update exit info via check service
      await this._updateExitInfo();

      // Get current circuit path for exit node details
      const circuitPath = await this.getCircuitPath();

      let exitNode = null;
      if (circuitPath.success && circuitPath.path && circuitPath.path.length > 0) {
        // Exit node is the last node in the path
        exitNode = circuitPath.path[circuitPath.path.length - 1];
      }

      return {
        success: true,
        exitIp: this.currentExitIp,
        exitCountry: this.currentExitCountry,
        exitFingerprint: exitNode ? exitNode.fingerprint : null,
        exitNickname: exitNode ? exitNode.nickname : null,
        exitBandwidth: exitNode ? exitNode.bandwidth : null,
        circuit: circuitPath.success ? {
          id: circuitPath.circuitId,
          status: circuitPath.status,
          purpose: circuitPath.purpose,
          path: circuitPath.path
        } : null,
        restrictions: {
          allowedCountries: this.exitCountries,
          excludedCountries: this.excludeCountries
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
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
}

module.exports = AdvancedTorManagerRouting;
