/**
 * Basset Hound Browser - Environment Variables Configuration
 * Maps BASSET_* environment variables to configuration options
 */

/**
 * Environment variable mappings
 * Maps environment variable names to configuration paths
 */
const ENV_MAPPINGS = {
  // Server configuration
  'BASSET_HOST': 'server.host',
  'BASSET_PORT': 'server.port',
  'BASSET_WS_HOST': 'server.host',
  'BASSET_WS_PORT': 'server.port',
  'BASSET_WS_SSL_ENABLED': 'server.ssl.enabled',
  'BASSET_WS_SSL_CERT': 'server.ssl.certPath',
  'BASSET_WS_SSL_KEY': 'server.ssl.keyPath',
  'BASSET_WS_SSL_CA': 'server.ssl.caPath',
  'BASSET_WS_TOKEN': 'server.auth.token',
  'BASSET_WS_AUTH_ENABLED': 'server.auth.enabled',
  'BASSET_WS_REQUIRE_AUTH': 'server.auth.requireAuth',
  'BASSET_HEARTBEAT_INTERVAL': 'server.heartbeat.interval',
  'BASSET_HEARTBEAT_TIMEOUT': 'server.heartbeat.timeout',
  'BASSET_MAX_RETRIES': 'server.errorRecovery.maxRetries',
  'BASSET_RETRY_DELAY': 'server.errorRecovery.retryDelay',

  // Browser configuration
  'BASSET_WINDOW_WIDTH': 'browser.window.width',
  'BASSET_WINDOW_HEIGHT': 'browser.window.height',
  'BASSET_MIN_WIDTH': 'browser.window.minWidth',
  'BASSET_MIN_HEIGHT': 'browser.window.minHeight',
  'BASSET_RANDOMIZE_SIZE': 'browser.window.randomizeSize',
  'BASSET_RANDOMIZE_POSITION': 'browser.window.randomizePosition',
  'BASSET_MAX_TABS': 'browser.tabs.maxTabs',
  'BASSET_HOME_PAGE': 'browser.tabs.homePage',
  'BASSET_RECOVERY_ENABLED': 'browser.recovery.enabled',
  'BASSET_AUTOSAVE_INTERVAL': 'browser.recovery.autoSaveInterval',
  'BASSET_DEVTOOLS_ENABLED': 'browser.devTools.enabled',
  'BASSET_DEVTOOLS_MODE': 'browser.devTools.defaultMode',
  'BASSET_DOWNLOAD_PATH': 'browser.downloads.path',
  'BASSET_ASK_DOWNLOAD': 'browser.downloads.askBeforeDownload',
  'BASSET_HISTORY_ENABLED': 'browser.history.enabled',
  'BASSET_HISTORY_MAX_ENTRIES': 'browser.history.maxEntries',
  'BASSET_HISTORY_RETENTION_DAYS': 'browser.history.retentionDays',

  // Evasion configuration
  'BASSET_FINGERPRINT_ENABLED': 'evasion.fingerprint.enabled',
  'BASSET_FINGERPRINT_RANDOMIZE': 'evasion.fingerprint.randomize',
  'BASSET_UA_RANDOMIZE': 'evasion.userAgent.randomize',
  'BASSET_UA_CATEGORY': 'evasion.userAgent.category',
  'BASSET_UA_ROTATE': 'evasion.userAgent.rotateOnNavigation',
  'BASSET_WEBGL_SPOOF': 'evasion.webgl.spoof',
  'BASSET_CANVAS_NOISE': 'evasion.canvas.noise',
  'BASSET_CANVAS_NOISE_FACTOR': 'evasion.canvas.noiseFactor',
  'BASSET_AUDIO_NOISE': 'evasion.audio.noise',
  'BASSET_HARDWARE_SPOOF': 'evasion.hardware.spoof',
  'BASSET_HARDWARE_CONCURRENCY': 'evasion.hardware.concurrency',
  'BASSET_DEVICE_MEMORY': 'evasion.hardware.memory',
  'BASSET_TIMEZONE_SPOOF': 'evasion.timezone.spoof',
  'BASSET_TIMEZONE': 'evasion.timezone.value',
  'BASSET_GEOLOCATION_ENABLED': 'evasion.geolocation.enabled',
  'BASSET_GEOLOCATION_LAT': 'evasion.geolocation.latitude',
  'BASSET_GEOLOCATION_LON': 'evasion.geolocation.longitude',
  'BASSET_GEOLOCATION_ACCURACY': 'evasion.geolocation.accuracy',
  'BASSET_HUMANIZE': 'evasion.humanize.enabled',
  'BASSET_HUMANIZE_TYPING': 'evasion.humanize.typing.enabled',
  'BASSET_HUMANIZE_MOUSE': 'evasion.humanize.mouse.enabled',
  'BASSET_HUMANIZE_SCROLL': 'evasion.humanize.scroll.enabled',

  // Network configuration
  'BASSET_PROXY_ENABLED': 'network.proxy.enabled',
  'BASSET_PROXY_TYPE': 'network.proxy.type',
  'BASSET_PROXY_HOST': 'network.proxy.host',
  'BASSET_PROXY_PORT': 'network.proxy.port',
  'BASSET_PROXY_USER': 'network.proxy.username',
  'BASSET_PROXY_PASS': 'network.proxy.password',
  'BASSET_TOR_ENABLED': 'network.tor.enabled',
  'BASSET_TOR_SOCKS_PORT': 'network.tor.socksPort',
  'BASSET_TOR_CONTROL_PORT': 'network.tor.controlPort',
  'BASSET_TOR_DATA_DIR': 'network.tor.dataDirectory',
  'BASSET_PROXY_CHAIN_ENABLED': 'network.proxyChain.enabled',
  'BASSET_THROTTLE_ENABLED': 'network.throttling.enabled',
  'BASSET_THROTTLE_PRESET': 'network.throttling.preset',
  'BASSET_THROTTLE_DOWNLOAD': 'network.throttling.download',
  'BASSET_THROTTLE_UPLOAD': 'network.throttling.upload',
  'BASSET_THROTTLE_LATENCY': 'network.throttling.latency',
  'BASSET_INTERCEPT_ENABLED': 'network.interception.enabled',
  'BASSET_BLOCK_ADS': 'network.interception.blockAds',
  'BASSET_BLOCK_TRACKERS': 'network.interception.blockTrackers',
  'BASSET_BLOCK_IMAGES': 'network.interception.blockImages',
  'BASSET_IGNORE_CERT_ERRORS': 'network.certificates.ignoreCertificateErrors',
  'BASSET_ACCEPT_LANGUAGE': 'network.headers.acceptLanguage',
  'BASSET_ACCEPT_ENCODING': 'network.headers.acceptEncoding',

  // Logging configuration
  'BASSET_LOG_LEVEL': 'logging.level',
  'BASSET_LOG_CONSOLE': 'logging.console.enabled',
  'BASSET_LOG_COLORIZE': 'logging.console.colorize',
  'BASSET_LOG_TIMESTAMP': 'logging.console.timestamp',
  'BASSET_LOG_FILE': 'logging.file.enabled',
  'BASSET_LOG_FILE_PATH': 'logging.file.path',
  'BASSET_LOG_FILE_MAX_SIZE': 'logging.file.maxSize',
  'BASSET_LOG_FILE_MAX_FILES': 'logging.file.maxFiles',
  'BASSET_LOG_NETWORK': 'logging.network.enabled',
  'BASSET_LOG_REQUESTS': 'logging.network.logRequests',
  'BASSET_LOG_RESPONSES': 'logging.network.logResponses',
  'BASSET_LOG_HEADERS': 'logging.network.logHeaders',
  'BASSET_CAPTURE_CONSOLE': 'logging.browserConsole.capture',
  'BASSET_MAX_CONSOLE_LOGS': 'logging.browserConsole.maxLogs',
  'BASSET_LOG_PERFORMANCE': 'logging.performance.enabled',

  // Automation configuration
  'BASSET_SCRIPTS_ENABLED': 'automation.scripts.enabled',
  'BASSET_SCRIPTS_PATH': 'automation.scripts.storagePath',
  'BASSET_SCRIPTS_TIMEOUT': 'automation.scripts.timeout',
  'BASSET_SCRIPTS_SANDBOXED': 'automation.scripts.sandboxed',
  'BASSET_RECORDING_ENABLED': 'automation.recording.enabled',
  'BASSET_RECORDING_FORMAT': 'automation.recording.format',
  'BASSET_RECORDING_QUALITY': 'automation.recording.quality',
  'BASSET_RECORDING_FPS': 'automation.recording.fps',
  'BASSET_RECORDING_MAX_DURATION': 'automation.recording.maxDuration',
  'BASSET_SCREENSHOT_FORMAT': 'automation.screenshots.format',
  'BASSET_SCREENSHOT_QUALITY': 'automation.screenshots.quality',
  'BASSET_SCREENSHOT_PATH': 'automation.screenshots.path',

  // Profile configuration
  'BASSET_PROFILES_ENABLED': 'profiles.enabled',
  'BASSET_PROFILES_PATH': 'profiles.storagePath',
  'BASSET_DEFAULT_PROFILE': 'profiles.defaultProfile',
  'BASSET_ISOLATE_COOKIES': 'profiles.isolation.cookies',
  'BASSET_ISOLATE_LOCALSTORAGE': 'profiles.isolation.localStorage',
  'BASSET_ISOLATE_SESSIONSTORAGE': 'profiles.isolation.sessionStorage',
  'BASSET_ISOLATE_INDEXEDDB': 'profiles.isolation.indexedDB',
  'BASSET_ISOLATE_CACHE': 'profiles.isolation.cache',

  // Headless configuration
  'BASSET_HEADLESS': 'headless.enabled',
  'BASSET_DISABLE_GPU': 'headless.disableGpu',
  'BASSET_NO_SANDBOX': 'headless.noSandbox',
  'BASSET_VIRTUAL_DISPLAY': 'headless.virtualDisplay',
  'BASSET_DISPLAY_SIZE': 'headless.displaySize',
  'BASSET_DISPLAY_DEPTH': 'headless.displayDepth',
  'BASSET_OFFSCREEN_RENDERING': 'headless.offscreenRendering',
  'BASSET_HEADLESS_PRESET': 'headless.preset',

  // Memory configuration
  'BASSET_MEMORY_MONITORING': 'memory.monitoring.enabled',
  'BASSET_MEMORY_INTERVAL': 'memory.monitoring.interval',
  'BASSET_MEMORY_WARNING': 'memory.thresholds.warning',
  'BASSET_MEMORY_CRITICAL': 'memory.thresholds.critical',
  'BASSET_MEMORY_EMERGENCY': 'memory.thresholds.emergency',
  'BASSET_CLEANUP_ENABLED': 'memory.cleanup.enabled',
  'BASSET_CLEANUP_ON_WARNING': 'memory.cleanup.onWarning',
  'BASSET_CLEANUP_ON_CRITICAL': 'memory.cleanup.onCritical',
  'BASSET_CACHE_MAX_SIZE': 'memory.cache.maxSize',
  'BASSET_CACHE_CLEAR_ON_PRESSURE': 'memory.cache.clearOnMemoryPressure'
};

/**
 * Type conversion functions for environment variable values
 */
const typeConverters = {
  /**
   * Parse boolean from string
   * @param {string} value - String value
   * @returns {boolean} Boolean value
   */
  boolean: (value) => {
    if (typeof value === 'boolean') return value;
    const lower = String(value).toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on';
  },

  /**
   * Parse integer from string
   * @param {string} value - String value
   * @returns {number} Integer value
   */
  integer: (value) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  },

  /**
   * Parse float from string
   * @param {string} value - String value
   * @returns {number} Float value
   */
  float: (value) => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  },

  /**
   * Parse array from comma-separated string
   * @param {string} value - Comma-separated string
   * @returns {string[]} Array of strings
   */
  array: (value) => {
    if (Array.isArray(value)) return value;
    return String(value).split(',').map(s => s.trim()).filter(s => s);
  },

  /**
   * Parse JSON object from string
   * @param {string} value - JSON string
   * @returns {Object} Parsed object
   */
  json: (value) => {
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (e) {
      return null;
    }
  },

  /**
   * Keep as string (default)
   * @param {string} value - String value
   * @returns {string} String value
   */
  string: (value) => {
    if (value === null || value === undefined) return null;
    return String(value);
  }
};

/**
 * Type hints for environment variables
 * Used to convert string values to appropriate types
 */
const TYPE_HINTS = {
  // Server
  'server.port': 'integer',
  'server.ssl.enabled': 'boolean',
  'server.auth.enabled': 'boolean',
  'server.auth.requireAuth': 'boolean',
  'server.heartbeat.interval': 'integer',
  'server.heartbeat.timeout': 'integer',
  'server.errorRecovery.maxRetries': 'integer',
  'server.errorRecovery.retryDelay': 'integer',

  // Browser
  'browser.window.width': 'integer',
  'browser.window.height': 'integer',
  'browser.window.minWidth': 'integer',
  'browser.window.minHeight': 'integer',
  'browser.window.randomizeSize': 'boolean',
  'browser.window.randomizePosition': 'boolean',
  'browser.tabs.maxTabs': 'integer',
  'browser.tabs.defaultTab': 'boolean',
  'browser.recovery.enabled': 'boolean',
  'browser.recovery.autoSaveInterval': 'integer',
  'browser.recovery.maxRecoveryAttempts': 'integer',
  'browser.devTools.enabled': 'boolean',
  'browser.downloads.askBeforeDownload': 'boolean',
  'browser.downloads.maxConcurrent': 'integer',
  'browser.history.enabled': 'boolean',
  'browser.history.maxEntries': 'integer',
  'browser.history.retentionDays': 'integer',

  // Evasion
  'evasion.fingerprint.enabled': 'boolean',
  'evasion.fingerprint.randomize': 'boolean',
  'evasion.fingerprint.persistPerSession': 'boolean',
  'evasion.userAgent.randomize': 'boolean',
  'evasion.userAgent.rotateOnNavigation': 'boolean',
  'evasion.webgl.spoof': 'boolean',
  'evasion.webgl.noise': 'boolean',
  'evasion.canvas.noise': 'boolean',
  'evasion.canvas.noiseFactor': 'integer',
  'evasion.audio.noise': 'boolean',
  'evasion.audio.noiseFactor': 'float',
  'evasion.hardware.spoof': 'boolean',
  'evasion.hardware.concurrency': 'integer',
  'evasion.hardware.memory': 'integer',
  'evasion.timezone.spoof': 'boolean',
  'evasion.geolocation.enabled': 'boolean',
  'evasion.geolocation.latitude': 'float',
  'evasion.geolocation.longitude': 'float',
  'evasion.geolocation.accuracy': 'integer',
  'evasion.humanize.enabled': 'boolean',
  'evasion.humanize.typing.enabled': 'boolean',
  'evasion.humanize.typing.minDelay': 'integer',
  'evasion.humanize.typing.maxDelay': 'integer',
  'evasion.humanize.typing.mistakeRate': 'float',
  'evasion.humanize.mouse.enabled': 'boolean',
  'evasion.humanize.mouse.curvature': 'float',
  'evasion.humanize.mouse.speed': 'float',
  'evasion.humanize.scroll.enabled': 'boolean',
  'evasion.humanize.scroll.smoothness': 'float',

  // Network
  'network.proxy.enabled': 'boolean',
  'network.proxy.port': 'integer',
  'network.proxy.bypassList': 'array',
  'network.tor.enabled': 'boolean',
  'network.tor.socksPort': 'integer',
  'network.tor.controlPort': 'integer',
  'network.proxyChain.enabled': 'boolean',
  'network.proxyChain.proxies': 'json',
  'network.throttling.enabled': 'boolean',
  'network.throttling.download': 'integer',
  'network.throttling.upload': 'integer',
  'network.throttling.latency': 'integer',
  'network.interception.enabled': 'boolean',
  'network.interception.blockAds': 'boolean',
  'network.interception.blockTrackers': 'boolean',
  'network.interception.blockImages': 'boolean',
  'network.interception.customRules': 'json',
  'network.certificates.ignoreCertificateErrors': 'boolean',
  'network.certificates.clientCertificates': 'json',
  'network.headers.customHeaders': 'json',
  'network.headers.removeHeaders': 'array',

  // Logging
  'logging.console.enabled': 'boolean',
  'logging.console.colorize': 'boolean',
  'logging.console.timestamp': 'boolean',
  'logging.file.enabled': 'boolean',
  'logging.file.maxFiles': 'integer',
  'logging.file.rotate': 'boolean',
  'logging.network.enabled': 'boolean',
  'logging.network.logRequests': 'boolean',
  'logging.network.logResponses': 'boolean',
  'logging.network.logHeaders': 'boolean',
  'logging.network.logBody': 'boolean',
  'logging.browserConsole.capture': 'boolean',
  'logging.browserConsole.maxLogs': 'integer',
  'logging.browserConsole.levels': 'array',
  'logging.performance.enabled': 'boolean',
  'logging.performance.metrics': 'boolean',
  'logging.performance.timing': 'boolean',

  // Automation
  'automation.scripts.enabled': 'boolean',
  'automation.scripts.timeout': 'integer',
  'automation.scripts.sandboxed': 'boolean',
  'automation.recording.enabled': 'boolean',
  'automation.recording.fps': 'integer',
  'automation.recording.maxDuration': 'integer',
  'automation.screenshots.quality': 'integer',

  // Profiles
  'profiles.enabled': 'boolean',
  'profiles.isolation.cookies': 'boolean',
  'profiles.isolation.localStorage': 'boolean',
  'profiles.isolation.sessionStorage': 'boolean',
  'profiles.isolation.indexedDB': 'boolean',
  'profiles.isolation.cache': 'boolean',

  // Headless
  'headless.enabled': 'boolean',
  'headless.disableGpu': 'boolean',
  'headless.noSandbox': 'boolean',
  'headless.virtualDisplay': 'boolean',
  'headless.displayDepth': 'integer',
  'headless.offscreenRendering': 'boolean',

  // Memory
  'memory.monitoring.enabled': 'boolean',
  'memory.monitoring.interval': 'integer',
  'memory.thresholds.warning': 'integer',
  'memory.thresholds.critical': 'integer',
  'memory.thresholds.emergency': 'integer',
  'memory.cleanup.enabled': 'boolean',
  'memory.cleanup.onWarning': 'boolean',
  'memory.cleanup.onCritical': 'boolean',
  'memory.cleanup.onEmergency': 'boolean',
  'memory.cache.maxSize': 'integer',
  'memory.cache.clearOnMemoryPressure': 'boolean'
};

/**
 * Convert a value to the appropriate type based on the config path
 * @param {string} configPath - Configuration path
 * @param {string} value - Raw string value
 * @returns {*} Converted value
 */
function convertValue(configPath, value) {
  const typeHint = TYPE_HINTS[configPath] || 'string';
  const converter = typeConverters[typeHint] || typeConverters.string;
  return converter(value);
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
 * Load configuration from environment variables
 * @param {Object} env - Environment object (defaults to process.env)
 * @returns {Object} Configuration object derived from environment
 */
function loadFromEnv(env = process.env) {
  const config = {};
  let loaded = 0;

  for (const [envVar, configPath] of Object.entries(ENV_MAPPINGS)) {
    const value = env[envVar];

    if (value !== undefined && value !== '') {
      const convertedValue = convertValue(configPath, value);

      if (convertedValue !== null) {
        setNestedValue(config, configPath, convertedValue);
        loaded++;
      }
    }
  }

  // Also check for BASSET_CONFIG_FILE to specify config file path
  if (env.BASSET_CONFIG_FILE) {
    config._configFile = env.BASSET_CONFIG_FILE;
  }

  if (loaded > 0) {
    console.log(`[Config:Env] Loaded ${loaded} configuration values from environment`);
  }

  return config;
}

/**
 * Get all environment variable mappings
 * @returns {Object} Mapping of env vars to config paths
 */
function getMappings() {
  return { ...ENV_MAPPINGS };
}

/**
 * Get environment variable name for a config path
 * @param {string} configPath - Configuration path
 * @returns {string|null} Environment variable name or null
 */
function getEnvVarForPath(configPath) {
  for (const [envVar, path] of Object.entries(ENV_MAPPINGS)) {
    if (path === configPath) {
      return envVar;
    }
  }
  return null;
}

/**
 * Get config path for an environment variable
 * @param {string} envVar - Environment variable name
 * @returns {string|null} Configuration path or null
 */
function getPathForEnvVar(envVar) {
  return ENV_MAPPINGS[envVar] || null;
}

/**
 * Generate environment variable documentation
 * @returns {string} Markdown documentation
 */
function generateEnvDocs() {
  let docs = '# Basset Hound Browser Environment Variables\n\n';
  docs += 'The following environment variables can be used to configure Basset Hound Browser:\n\n';

  // Group by category
  const categories = {};
  for (const [envVar, configPath] of Object.entries(ENV_MAPPINGS)) {
    const category = configPath.split('.')[0];
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push({ envVar, configPath });
  }

  for (const [category, vars] of Object.entries(categories)) {
    docs += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
    docs += '| Environment Variable | Config Path | Type |\n';
    docs += '|---------------------|-------------|------|\n';

    for (const { envVar, configPath } of vars) {
      const type = TYPE_HINTS[configPath] || 'string';
      docs += `| \`${envVar}\` | \`${configPath}\` | ${type} |\n`;
    }

    docs += '\n';
  }

  return docs;
}

module.exports = {
  ENV_MAPPINGS,
  TYPE_HINTS,
  loadFromEnv,
  getMappings,
  getEnvVarForPath,
  getPathForEnvVar,
  convertValue,
  setNestedValue,
  generateEnvDocs
};
