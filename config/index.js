/**
 * Basset Hound Browser - Configuration System
 * Unified configuration interface combining all configuration sources
 */

const path = require('path');
const { ConfigManager, getConfigManager, resetConfigManager } = require('./manager');
const { defaults, serverDefaults, browserDefaults, evasionDefaults, networkDefaults, loggingDefaults, automationDefaults, profileDefaults, headlessDefaults, memoryDefaults, updaterDefaults } = require('./defaults');
const { schema, validateConfig, getDefault, getSchema, Types } = require('./schema');
const { loadFromEnv, getMappings, getEnvVarForPath, generateEnvDocs } = require('./env');
const { parseArgs, generateHelp, shouldShowHelp, shouldShowVersion, getArgDefinitions } = require('./cli');

/**
 * Initialize the configuration system
 * Loads configuration from all sources in priority order:
 * 1. CLI arguments (highest priority)
 * 2. Environment variables
 * 3. Configuration file
 * 4. Default values (lowest priority)
 *
 * @param {Object} options - Initialization options
 * @param {string} options.configPath - Path to configuration file
 * @param {boolean} options.watch - Watch config file for changes
 * @param {boolean} options.autoSave - Auto-save on changes
 * @param {string[]} options.args - CLI arguments (defaults to process.argv)
 * @returns {Object} Result { success: boolean, config: Object, help: boolean, version: boolean, errors: string[] }
 */
function initConfig(options = {}) {
  const errors = [];
  const configManager = getConfigManager({
    autoSave: options.autoSave || false,
    validateOnLoad: options.validateOnLoad !== false
  });

  // Parse CLI arguments
  const cliResult = parseArgs(options.args || process.argv.slice(2));

  if (cliResult.errors.length > 0) {
    errors.push(...cliResult.errors);
  }

  // Handle help and version
  if (cliResult.help) {
    return {
      success: true,
      help: true,
      version: false,
      helpText: generateHelp(),
      config: configManager.getAll(),
      errors: []
    };
  }

  if (cliResult.version) {
    return {
      success: true,
      help: false,
      version: true,
      config: configManager.getAll(),
      errors: []
    };
  }

  // Load environment variables
  const envConfig = loadFromEnv(process.env);
  configManager.setEnvConfig(envConfig);

  // Determine config file path
  let configPath = options.configPath ||
                   cliResult.config?._configFile ||
                   envConfig._configFile ||
                   process.env.BASSET_CONFIG_FILE;

  // Try default config paths if not specified
  if (!configPath) {
    const defaultPaths = [
      './basset.yaml',
      './basset.yml',
      './basset.json',
      './config.yaml',
      './config.yml',
      './config.json',
      './config/basset.yaml',
      './config/basset.yml'
    ];

    const fs = require('fs');
    for (const defaultPath of defaultPaths) {
      const fullPath = path.resolve(defaultPath);
      if (fs.existsSync(fullPath)) {
        configPath = fullPath;
        console.log(`[Config] Found configuration file: ${configPath}`);
        break;
      }
    }
  }

  // Load configuration file if found
  if (configPath) {
    const loadResult = configManager.loadConfig(configPath);
    if (!loadResult.success) {
      // Only treat as error if explicitly specified
      if (options.configPath || cliResult.config?._configFile || envConfig._configFile) {
        errors.push(...loadResult.errors);
      }
    }
  }

  // Apply CLI configuration (highest priority)
  const cliConfig = { ...cliResult.config };
  delete cliConfig._configFile;
  delete cliConfig._positional;
  configManager.setCliConfig(cliConfig);

  // Start watching if requested
  if (options.watch && configPath) {
    configManager.watch();
  }

  // Validate final configuration
  const validation = configManager.validate();
  if (!validation.valid) {
    errors.push(...validation.errors.map(e => `Validation: ${e}`));
  }

  return {
    success: errors.length === 0,
    help: false,
    version: false,
    config: configManager.getAll(),
    configPath,
    positionalArgs: cliResult.config._positional || [],
    errors
  };
}

/**
 * Get the configuration manager instance
 * @returns {ConfigManager} Configuration manager
 */
function getConfig() {
  return getConfigManager();
}

/**
 * Get a configuration value
 * @param {string} key - Configuration key (dot notation)
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Configuration value
 */
function get(key, defaultValue = undefined) {
  return getConfigManager().get(key, defaultValue);
}

/**
 * Set a configuration value at runtime
 * @param {string} key - Configuration key (dot notation)
 * @param {*} value - Value to set
 * @returns {Object} Result { success: boolean, oldValue?: any }
 */
function set(key, value) {
  return getConfigManager().set(key, value);
}

/**
 * Check if a configuration key exists
 * @param {string} key - Configuration key (dot notation)
 * @returns {boolean} True if key exists
 */
function has(key) {
  return getConfigManager().has(key);
}

/**
 * Get all configuration
 * @returns {Object} Full configuration object
 */
function getAll() {
  return getConfigManager().getAll();
}

/**
 * Reset configuration to defaults
 * @param {string} section - Optional section to reset
 */
function reset(section = null) {
  return getConfigManager().reset(section);
}

/**
 * Reload configuration from file
 * @returns {Object} Result { success: boolean, config?: Object, errors?: string[] }
 */
function reload() {
  return getConfigManager().reload();
}

/**
 * Save current configuration to file
 * @param {string} filePath - Optional file path
 * @returns {Object} Result { success: boolean, error?: string }
 */
function save(filePath = null) {
  return getConfigManager().save(filePath);
}

/**
 * Export configuration to string
 * @param {string} format - Export format ('json' or 'yaml')
 * @returns {string} Configuration string
 */
function exportConfig(format = 'json') {
  return getConfigManager().export(format);
}

/**
 * Validate current configuration
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validate() {
  return getConfigManager().validate();
}

/**
 * Subscribe to configuration changes
 * @param {string} event - Event name ('configChanged', 'configReloaded', etc.)
 * @param {Function} callback - Event handler
 */
function on(event, callback) {
  return getConfigManager().on(event, callback);
}

/**
 * Unsubscribe from configuration changes
 * @param {string} event - Event name
 * @param {Function} callback - Event handler
 */
function off(event, callback) {
  return getConfigManager().off(event, callback);
}

/**
 * Clean up configuration system
 */
function cleanup() {
  return resetConfigManager();
}

/**
 * Get configuration source for a key
 * @param {string} key - Configuration key
 * @returns {Object} Source info { source: string, value: any }
 */
function getSource(key) {
  return getConfigManager().getSource(key);
}

/**
 * Get schema information for a key
 * @param {string} key - Configuration key
 * @returns {Object|null} Schema information
 */
function getSchemaInfo(key) {
  return getSchema(key);
}

// Export everything
module.exports = {
  // Main initialization
  initConfig,

  // Manager access
  getConfig,
  getConfigManager,
  resetConfigManager,
  ConfigManager,

  // Convenience methods
  get,
  set,
  has,
  getAll,
  reset,
  reload,
  save,
  validate,
  exportConfig,
  getSource,
  getSchemaInfo,

  // Event handling
  on,
  off,
  cleanup,

  // Defaults
  defaults,
  serverDefaults,
  browserDefaults,
  evasionDefaults,
  networkDefaults,
  loggingDefaults,
  automationDefaults,
  profileDefaults,
  headlessDefaults,
  memoryDefaults,
  updaterDefaults,

  // Schema
  schema,
  validateConfig,
  getDefault,
  getSchema,
  Types,

  // Environment
  loadFromEnv,
  getMappings,
  getEnvVarForPath,
  generateEnvDocs,

  // CLI
  parseArgs,
  generateHelp,
  shouldShowHelp,
  shouldShowVersion,
  getArgDefinitions
};
