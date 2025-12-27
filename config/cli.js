/**
 * Basset Hound Browser - CLI Argument Parsing
 * Parses command line arguments and maps them to configuration options
 */

/**
 * CLI argument definitions
 * Each argument has: flags, configPath, type, description, and optional default
 */
const CLI_ARGS = {
  // Configuration file
  config: {
    flags: ['--config', '-c'],
    configPath: '_configFile',
    type: 'string',
    description: 'Path to configuration file (YAML or JSON)',
    metavar: 'FILE'
  },

  // Server options
  host: {
    flags: ['--host', '-H'],
    configPath: 'server.host',
    type: 'string',
    description: 'WebSocket server host address',
    metavar: 'HOST'
  },
  port: {
    flags: ['--port', '-p'],
    configPath: 'server.port',
    type: 'number',
    description: 'WebSocket server port',
    metavar: 'PORT'
  },
  ssl: {
    flags: ['--ssl'],
    configPath: 'server.ssl.enabled',
    type: 'boolean',
    description: 'Enable SSL/TLS encryption'
  },
  sslCert: {
    flags: ['--ssl-cert'],
    configPath: 'server.ssl.certPath',
    type: 'string',
    description: 'Path to SSL certificate file',
    metavar: 'FILE'
  },
  sslKey: {
    flags: ['--ssl-key'],
    configPath: 'server.ssl.keyPath',
    type: 'string',
    description: 'Path to SSL private key file',
    metavar: 'FILE'
  },
  token: {
    flags: ['--token', '-t'],
    configPath: 'server.auth.token',
    type: 'string',
    description: 'Authentication token for WebSocket connections',
    metavar: 'TOKEN'
  },
  requireAuth: {
    flags: ['--require-auth'],
    configPath: 'server.auth.requireAuth',
    type: 'boolean',
    description: 'Require authentication for all connections'
  },

  // Browser window options
  width: {
    flags: ['--width', '-W'],
    configPath: 'browser.window.width',
    type: 'number',
    description: 'Browser window width',
    metavar: 'PIXELS'
  },
  height: {
    flags: ['--height'],
    configPath: 'browser.window.height',
    type: 'number',
    description: 'Browser window height',
    metavar: 'PIXELS'
  },
  homePage: {
    flags: ['--home-page', '--home'],
    configPath: 'browser.tabs.homePage',
    type: 'string',
    description: 'Default home page URL',
    metavar: 'URL'
  },
  maxTabs: {
    flags: ['--max-tabs'],
    configPath: 'browser.tabs.maxTabs',
    type: 'number',
    description: 'Maximum number of open tabs',
    metavar: 'NUM'
  },

  // Headless mode
  headless: {
    flags: ['--headless'],
    configPath: 'headless.enabled',
    type: 'boolean',
    description: 'Run in headless mode'
  },
  disableGpu: {
    flags: ['--disable-gpu'],
    configPath: 'headless.disableGpu',
    type: 'boolean',
    description: 'Disable GPU acceleration'
  },
  noSandbox: {
    flags: ['--no-sandbox'],
    configPath: 'headless.noSandbox',
    type: 'boolean',
    description: 'Disable sandbox (required for Docker/root)'
  },
  virtualDisplay: {
    flags: ['--virtual-display'],
    configPath: 'headless.virtualDisplay',
    type: 'boolean',
    description: 'Use virtual display (Xvfb)'
  },
  headlessPreset: {
    flags: ['--headless-preset'],
    configPath: 'headless.preset',
    type: 'string',
    description: 'Headless preset (server, docker, ci, minimal)',
    metavar: 'PRESET',
    choices: ['server', 'docker', 'ci', 'minimal']
  },

  // Proxy options
  proxy: {
    flags: ['--proxy'],
    configPath: '_proxy',  // Special handling
    type: 'string',
    description: 'Proxy URL (e.g., http://host:port or socks5://user:pass@host:port)',
    metavar: 'URL'
  },
  proxyBypass: {
    flags: ['--proxy-bypass'],
    configPath: 'network.proxy.bypassList',
    type: 'array',
    description: 'Comma-separated list of hosts to bypass proxy',
    metavar: 'HOSTS'
  },
  tor: {
    flags: ['--tor'],
    configPath: 'network.tor.enabled',
    type: 'boolean',
    description: 'Enable Tor routing'
  },

  // Evasion options
  noEvasion: {
    flags: ['--no-evasion'],
    configPath: 'evasion.fingerprint.enabled',
    type: 'boolean',
    negate: true,
    description: 'Disable fingerprint evasion'
  },
  userAgent: {
    flags: ['--user-agent', '-u'],
    configPath: '_userAgent',  // Special handling
    type: 'string',
    description: 'Custom user agent string',
    metavar: 'STRING'
  },
  randomizeFingerprint: {
    flags: ['--randomize-fingerprint'],
    configPath: 'evasion.fingerprint.randomize',
    type: 'boolean',
    description: 'Randomize browser fingerprint'
  },
  timezone: {
    flags: ['--timezone', '--tz'],
    configPath: 'evasion.timezone.value',
    type: 'string',
    description: 'Spoof timezone (e.g., America/New_York)',
    metavar: 'TZ'
  },
  geolocation: {
    flags: ['--geolocation', '--geo'],
    configPath: '_geolocation',  // Special handling
    type: 'string',
    description: 'Spoof geolocation (lat,lon format)',
    metavar: 'LAT,LON'
  },
  noHumanize: {
    flags: ['--no-humanize'],
    configPath: 'evasion.humanize.enabled',
    type: 'boolean',
    negate: true,
    description: 'Disable human behavior simulation'
  },

  // Network options
  blockAds: {
    flags: ['--block-ads'],
    configPath: 'network.interception.blockAds',
    type: 'boolean',
    description: 'Block advertisements'
  },
  blockTrackers: {
    flags: ['--block-trackers'],
    configPath: 'network.interception.blockTrackers',
    type: 'boolean',
    description: 'Block tracking scripts'
  },
  throttle: {
    flags: ['--throttle'],
    configPath: 'network.throttling.preset',
    type: 'string',
    description: 'Network throttling preset (slow3G, fast3G, 4G)',
    metavar: 'PRESET',
    choices: ['slow3G', 'fast3G', '4G', 'offline']
  },

  // Logging options
  logLevel: {
    flags: ['--log-level', '-l'],
    configPath: 'logging.level',
    type: 'string',
    description: 'Log level (error, warn, info, debug, trace)',
    metavar: 'LEVEL',
    choices: ['error', 'warn', 'info', 'debug', 'trace']
  },
  logFile: {
    flags: ['--log-file'],
    configPath: 'logging.file.path',
    type: 'string',
    description: 'Log file path',
    metavar: 'FILE'
  },
  quiet: {
    flags: ['--quiet', '-q'],
    configPath: 'logging.console.enabled',
    type: 'boolean',
    negate: true,
    description: 'Suppress console output'
  },
  verbose: {
    flags: ['--verbose', '-v'],
    configPath: 'logging.level',
    type: 'boolean',
    value: 'debug',
    description: 'Enable verbose output (debug level)'
  },
  trace: {
    flags: ['--trace'],
    configPath: 'logging.level',
    type: 'boolean',
    value: 'trace',
    description: 'Enable trace output'
  },

  // Profile options
  profile: {
    flags: ['--profile'],
    configPath: 'profiles.defaultProfile',
    type: 'string',
    description: 'Use specified browser profile',
    metavar: 'PROFILE'
  },
  profilePath: {
    flags: ['--profile-path'],
    configPath: 'profiles.storagePath',
    type: 'string',
    description: 'Path to profiles directory',
    metavar: 'DIR'
  },

  // Automation options
  scriptPath: {
    flags: ['--script-path'],
    configPath: 'automation.scripts.storagePath',
    type: 'string',
    description: 'Path to automation scripts directory',
    metavar: 'DIR'
  },
  screenshotPath: {
    flags: ['--screenshot-path'],
    configPath: 'automation.screenshots.path',
    type: 'string',
    description: 'Path for saving screenshots',
    metavar: 'DIR'
  },

  // Download options
  downloadPath: {
    flags: ['--download-path', '-d'],
    configPath: 'browser.downloads.path',
    type: 'string',
    description: 'Download directory path',
    metavar: 'DIR'
  },

  // Memory management
  memoryLimit: {
    flags: ['--memory-limit'],
    configPath: 'memory.cache.maxSize',
    type: 'number',
    description: 'Memory cache limit in bytes',
    metavar: 'BYTES'
  },

  // Help and version
  help: {
    flags: ['--help', '-h'],
    type: 'boolean',
    description: 'Show help message'
  },
  version: {
    flags: ['--version', '-V'],
    type: 'boolean',
    description: 'Show version number'
  }
};

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments (defaults to process.argv.slice(2))
 * @returns {Object} Result { config: Object, help: boolean, version: boolean, errors: string[] }
 */
function parseArgs(args = process.argv.slice(2)) {
  const config = {};
  const errors = [];
  let showHelp = false;
  let showVersion = false;
  let i = 0;

  // Build flag lookup
  const flagLookup = {};
  for (const [name, def] of Object.entries(CLI_ARGS)) {
    for (const flag of def.flags) {
      flagLookup[flag] = { name, ...def };
    }
  }

  while (i < args.length) {
    const arg = args[i];

    // Check for flag
    if (arg.startsWith('-')) {
      // Handle --flag=value format
      let flag = arg;
      let inlineValue = null;

      if (arg.includes('=')) {
        const eqIndex = arg.indexOf('=');
        flag = arg.substring(0, eqIndex);
        inlineValue = arg.substring(eqIndex + 1);
      }

      const def = flagLookup[flag];

      if (!def) {
        // Unknown flag - might be for Electron, skip it
        if (flag.startsWith('--')) {
          i++;
          // Skip value if next arg doesn't start with -
          if (i < args.length && !args[i].startsWith('-')) {
            i++;
          }
        } else {
          errors.push(`Unknown option: ${flag}`);
          i++;
        }
        continue;
      }

      // Handle special flags
      if (def.name === 'help') {
        showHelp = true;
        i++;
        continue;
      }

      if (def.name === 'version') {
        showVersion = true;
        i++;
        continue;
      }

      // Get value
      let value;

      if (def.type === 'boolean') {
        if (def.negate) {
          value = false;
        } else if (def.value !== undefined) {
          value = def.value;
        } else {
          value = true;
        }
        i++;
      } else {
        // Get value from inline or next argument
        if (inlineValue !== null) {
          value = inlineValue;
        } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          value = args[i + 1];
          i++;
        } else {
          errors.push(`Option ${flag} requires a value`);
          i++;
          continue;
        }

        // Type conversion
        if (def.type === 'number') {
          value = parseFloat(value);
          if (isNaN(value)) {
            errors.push(`Option ${flag} requires a numeric value`);
            i++;
            continue;
          }
        } else if (def.type === 'array') {
          value = value.split(',').map(s => s.trim());
        }

        // Validate choices
        if (def.choices && !def.choices.includes(value)) {
          errors.push(`Option ${flag} must be one of: ${def.choices.join(', ')}`);
          i++;
          continue;
        }

        i++;
      }

      // Set configuration value
      if (def.configPath) {
        setNestedValue(config, def.configPath, value);
      }
    } else {
      // Positional argument - could be URL for startup
      if (!config._positional) {
        config._positional = [];
      }
      config._positional.push(arg);
      i++;
    }
  }

  // Process special config values
  processSpecialValues(config);

  return { config, help: showHelp, version: showVersion, errors };
}

/**
 * Set a nested value in an object using dot notation path
 * @param {Object} obj - Target object
 * @param {string} path - Dot notation path
 * @param {*} value - Value to set
 */
function setNestedValue(obj, path, value) {
  const parts = path.split('.');
  const lastKey = parts.pop();

  let current = obj;
  for (const part of parts) {
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }

  current[lastKey] = value;
}

/**
 * Process special configuration values that need transformation
 * @param {Object} config - Configuration object
 */
function processSpecialValues(config) {
  // Process proxy URL
  if (config._proxy) {
    const proxyConfig = parseProxyUrl(config._proxy);
    if (proxyConfig) {
      config.network = config.network || {};
      config.network.proxy = {
        ...config.network.proxy,
        enabled: true,
        ...proxyConfig
      };
    }
    delete config._proxy;
  }

  // Process geolocation
  if (config._geolocation) {
    const parts = config._geolocation.split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0].trim());
      const lon = parseFloat(parts[1].trim());
      if (!isNaN(lat) && !isNaN(lon)) {
        config.evasion = config.evasion || {};
        config.evasion.geolocation = {
          enabled: true,
          latitude: lat,
          longitude: lon
        };
      }
    }
    delete config._geolocation;
  }

  // Enable timezone spoofing if timezone value is set
  if (config.evasion?.timezone?.value) {
    config.evasion.timezone.spoof = true;
  }

  // Handle throttle preset enabling throttling
  if (config.network?.throttling?.preset) {
    config.network.throttling.enabled = true;
  }
}

/**
 * Parse a proxy URL into configuration
 * @param {string} url - Proxy URL
 * @returns {Object|null} Proxy configuration or null
 */
function parseProxyUrl(url) {
  try {
    // Handle socks5://user:pass@host:port format
    const match = url.match(/^(https?|socks[45]?):\/\/(?:([^:@]+):([^@]+)@)?([^:\/]+):(\d+)/);

    if (match) {
      const [, type, username, password, host, port] = match;
      return {
        type: type === 'socks' ? 'socks5' : type,
        host,
        port: parseInt(port, 10),
        username: username || null,
        password: password || null
      };
    }

    // Handle simple host:port format
    const simpleMatch = url.match(/^([^:\/]+):(\d+)$/);
    if (simpleMatch) {
      return {
        type: 'http',
        host: simpleMatch[1],
        port: parseInt(simpleMatch[2], 10)
      };
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Generate help text
 * @param {string} programName - Program name for usage line
 * @returns {string} Help text
 */
function generateHelp(programName = 'basset-hound') {
  let help = `
Basset Hound Browser - OSINT and Automation Browser

Usage: ${programName} [options] [url]

Options:
`;

  // Group arguments by category
  const categories = {
    'Configuration': ['config'],
    'Server': ['host', 'port', 'ssl', 'sslCert', 'sslKey', 'token', 'requireAuth'],
    'Browser': ['width', 'height', 'homePage', 'maxTabs', 'downloadPath'],
    'Headless': ['headless', 'disableGpu', 'noSandbox', 'virtualDisplay', 'headlessPreset'],
    'Proxy & Network': ['proxy', 'proxyBypass', 'tor', 'throttle', 'blockAds', 'blockTrackers'],
    'Evasion': ['noEvasion', 'userAgent', 'randomizeFingerprint', 'timezone', 'geolocation', 'noHumanize'],
    'Logging': ['logLevel', 'logFile', 'quiet', 'verbose', 'trace'],
    'Profiles': ['profile', 'profilePath'],
    'Automation': ['scriptPath', 'screenshotPath'],
    'Memory': ['memoryLimit'],
    'Info': ['help', 'version']
  };

  for (const [category, argNames] of Object.entries(categories)) {
    help += `\n  ${category}:\n`;

    for (const name of argNames) {
      const def = CLI_ARGS[name];
      if (!def) continue;

      const flags = def.flags.join(', ');
      const metavar = def.metavar ? ` <${def.metavar}>` : '';
      const line = `    ${flags}${metavar}`;
      const padding = ' '.repeat(Math.max(1, 32 - line.length));

      help += `${line}${padding}${def.description}\n`;

      if (def.choices) {
        help += `${' '.repeat(34)}Choices: ${def.choices.join(', ')}\n`;
      }
    }
  }

  help += `
Examples:
  ${programName} --headless --port 9000
  ${programName} --proxy socks5://localhost:9050 --tor
  ${programName} --config config.yaml
  ${programName} --headless --disable-gpu --no-sandbox  # Docker mode
  ${programName} https://example.com  # Open URL on startup

Environment Variables:
  BASSET_* environment variables can also be used for configuration.
  See documentation for full list of supported variables.
`;

  return help;
}

/**
 * Get all CLI argument definitions
 * @returns {Object} CLI argument definitions
 */
function getArgDefinitions() {
  return { ...CLI_ARGS };
}

/**
 * Check if help should be shown
 * @param {string[]} args - Command line arguments
 * @returns {boolean} True if help flag is present
 */
function shouldShowHelp(args = process.argv.slice(2)) {
  return args.includes('--help') || args.includes('-h');
}

/**
 * Check if version should be shown
 * @param {string[]} args - Command line arguments
 * @returns {boolean} True if version flag is present
 */
function shouldShowVersion(args = process.argv.slice(2)) {
  return args.includes('--version') || args.includes('-V');
}

module.exports = {
  CLI_ARGS,
  parseArgs,
  generateHelp,
  getArgDefinitions,
  shouldShowHelp,
  shouldShowVersion,
  parseProxyUrl,
  setNestedValue
};
