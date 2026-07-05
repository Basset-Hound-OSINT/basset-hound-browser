/**
 * Basset Hound Browser - Advanced Tor Manager constants
 *
 * Enumerations and static configuration moved verbatim from
 * proxy/tor-advanced.js (2026-07-04 modularization). The EMBEDDED_PATHS
 * __dirname anchors gain one extra '..' because this file now lives in
 * proxy/tor-advanced/ instead of proxy/ — resolved paths are unchanged.
 *
 * @module proxy/tor-advanced/constants
 */

const path = require('path');

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
  dataDirectory: null, // Will be set based on platform
  autoStart: true,
  killOnExit: true,
  embeddedMode: null // Will be auto-detected based on embedded binary availability
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
  torBinary: path.join(__dirname, '..', '..', 'bin', 'tor', 'tor', 'tor'),
  torBinaryWin: path.join(__dirname, '..', '..', 'bin', 'tor', 'tor', 'tor.exe'),
  libDir: path.join(__dirname, '..', '..', 'bin', 'tor', 'tor'),
  geoip: path.join(__dirname, '..', '..', 'bin', 'tor', 'data', 'geoip'),
  geoip6: path.join(__dirname, '..', '..', 'bin', 'tor', 'data', 'geoip6')
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

module.exports = {
  TOR_STATES,
  TRANSPORT_TYPES,
  ISOLATION_MODES,
  TOR_DEFAULTS,
  EMBEDDED_PATHS,
  COUNTRY_CODES,
  BUILTIN_BRIDGES
};
