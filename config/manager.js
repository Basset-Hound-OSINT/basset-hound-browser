/**
 * Basset Hound Browser - Configuration Manager
 * Manages loading, saving, and accessing configuration from multiple sources
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { defaults } = require('./defaults');
const { validateConfig, getDefault, getSchema } = require('./schema');

/**
 * ConfigManager Class
 * Central configuration management with support for multiple sources and live reloading
 */
class ConfigManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration sources (in priority order)
    this.sources = {
      defaults: { ...defaults },
      file: {},
      env: {},
      cli: {},
      runtime: {}
    };

    // Merged configuration
    this.config = {};

    // File watching
    this.configPath = null;
    this.watcher = null;
    this.watchDebounceTimer = null;
    this.watchDebounceDelay = options.watchDebounceDelay || 500;

    // Options
    this.autoSave = options.autoSave || false;
    this.validateOnLoad = options.validateOnLoad !== false;

    // Initialize with defaults
    this.config = this.deepMerge({}, defaults);

    console.log('[ConfigManager] Initialized');
  }

  /**
   * Load configuration from a file
   * @param {string} configPath - Path to configuration file (YAML or JSON)
   * @returns {Object} Result { success: boolean, config?: Object, errors?: string[] }
   */
  loadConfig(configPath) {
    try {
      if (!fs.existsSync(configPath)) {
        return {
          success: false,
          errors: [`Configuration file not found: ${configPath}`]
        };
      }

      this.configPath = configPath;
      const content = fs.readFileSync(configPath, 'utf8');
      const ext = path.extname(configPath).toLowerCase();

      let fileConfig;

      if (ext === '.yaml' || ext === '.yml') {
        fileConfig = this.parseYaml(content);
      } else if (ext === '.json') {
        fileConfig = JSON.parse(content);
      } else {
        // Try to auto-detect format
        fileConfig = this.autoParseConfig(content);
      }

      // Store file config
      this.sources.file = fileConfig;

      // Merge and validate
      this.mergeConfig();

      if (this.validateOnLoad) {
        const validation = this.validate();
        if (!validation.valid) {
          console.warn('[ConfigManager] Configuration validation warnings:', validation.errors);
        }
      }

      console.log(`[ConfigManager] Loaded configuration from: ${configPath}`);

      this.emit('configLoaded', { path: configPath, config: this.config });

      return {
        success: true,
        config: this.config
      };
    } catch (error) {
      console.error(`[ConfigManager] Error loading config: ${error.message}`);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Simple YAML parser for configuration files
   * Supports basic YAML features: objects, arrays, strings, numbers, booleans
   * @param {string} content - YAML content
   * @returns {Object} Parsed configuration
   */
  parseYaml(content) {
    const result = {};
    const lines = content.split('\n');
    const stack = [{ obj: result, indent: -1 }];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) continue;

      // Calculate indentation
      const indent = line.search(/\S/);
      const trimmed = line.trim();

      // Pop stack to find parent at correct indentation
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1].obj;

      // Handle array items
      if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).trim();
        if (Array.isArray(parent)) {
          parent.push(this.parseYamlValue(value));
        }
        continue;
      }

      // Handle key-value pairs
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.substring(0, colonIndex).trim();
      const rawValue = trimmed.substring(colonIndex + 1).trim();

      if (rawValue === '' || rawValue === '|' || rawValue === '>') {
        // Nested object or multiline string
        const nextLine = lines[i + 1];
        if (nextLine) {
          const nextIndent = nextLine.search(/\S/);
          const nextTrimmed = nextLine.trim();

          if (nextTrimmed.startsWith('- ')) {
            // Array
            parent[key] = [];
            stack.push({ obj: parent[key], indent: nextIndent, isArray: true });
          } else {
            // Object
            parent[key] = {};
            stack.push({ obj: parent[key], indent: nextIndent });
          }
        }
      } else {
        // Simple value
        parent[key] = this.parseYamlValue(rawValue);
      }
    }

    return result;
  }

  /**
   * Parse a YAML value
   * @param {string} value - Value string
   * @returns {*} Parsed value
   */
  parseYamlValue(value) {
    // Remove inline comments
    const commentIndex = value.indexOf(' #');
    if (commentIndex !== -1) {
      value = value.substring(0, commentIndex).trim();
    }

    // Handle quoted strings
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Handle null
    if (value === 'null' || value === '~' || value === '') {
      return null;
    }

    // Handle booleans
    if (value === 'true' || value === 'True' || value === 'TRUE' || value === 'yes' || value === 'on') {
      return true;
    }
    if (value === 'false' || value === 'False' || value === 'FALSE' || value === 'no' || value === 'off') {
      return false;
    }

    // Handle numbers
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    // Handle inline arrays [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
      return value.slice(1, -1).split(',').map(item => this.parseYamlValue(item.trim()));
    }

    // Handle inline objects {key: value}
    if (value.startsWith('{') && value.endsWith('}')) {
      const obj = {};
      const pairs = value.slice(1, -1).split(',');
      for (const pair of pairs) {
        const [k, v] = pair.split(':').map(s => s.trim());
        if (k && v !== undefined) {
          obj[k] = this.parseYamlValue(v);
        }
      }
      return obj;
    }

    // Return as string
    return value;
  }

  /**
   * Auto-detect and parse configuration format
   * @param {string} content - Configuration content
   * @returns {Object} Parsed configuration
   */
  autoParseConfig(content) {
    const trimmed = content.trim();

    // Try JSON first
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(content);
      } catch (e) {
        // Not valid JSON, try YAML
      }
    }

    // Try YAML
    return this.parseYaml(content);
  }

  /**
   * Get a configuration value using dot notation
   * @param {string} key - Configuration key (e.g., 'server.port')
   * @param {*} defaultValue - Default value if key not found
   * @returns {*} Configuration value
   */
  get(key, defaultValue = undefined) {
    const parts = key.split('.');
    let value = this.config;

    for (const part of parts) {
      if (value === undefined || value === null || typeof value !== 'object') {
        // Key not found, return default
        if (defaultValue !== undefined) {
          return defaultValue;
        }
        // Try schema default
        return getDefault(key);
      }
      value = value[part];
    }

    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return getDefault(key);
    }

    return value;
  }

  /**
   * Set a configuration value at runtime
   * @param {string} key - Configuration key (dot notation)
   * @param {*} value - Value to set
   * @returns {Object} Result { success: boolean, oldValue?: any }
   */
  set(key, value) {
    const parts = key.split('.');
    const lastKey = parts.pop();

    // Set in runtime source
    let obj = this.sources.runtime;
    for (const part of parts) {
      if (!obj[part] || typeof obj[part] !== 'object') {
        obj[part] = {};
      }
      obj = obj[part];
    }

    const oldValue = this.get(key);
    obj[lastKey] = value;

    // Re-merge to update main config
    this.mergeConfig();

    console.log(`[ConfigManager] Set ${key} = ${JSON.stringify(value)}`);

    this.emit('configChanged', { key, value, oldValue });

    if (this.autoSave && this.configPath) {
      this.save();
    }

    return { success: true, oldValue };
  }

  /**
   * Set configuration from environment variables
   * @param {Object} envConfig - Environment-derived configuration
   */
  setEnvConfig(envConfig) {
    this.sources.env = envConfig;
    this.mergeConfig();
  }

  /**
   * Set configuration from CLI arguments
   * @param {Object} cliConfig - CLI-derived configuration
   */
  setCliConfig(cliConfig) {
    this.sources.cli = cliConfig;
    this.mergeConfig();
  }

  /**
   * Merge all configuration sources
   * Priority: CLI > Runtime > Env > File > Defaults
   */
  mergeConfig() {
    this.config = this.deepMerge(
      {},
      this.sources.defaults,
      this.sources.file,
      this.sources.env,
      this.sources.runtime,
      this.sources.cli
    );
  }

  /**
   * Deep merge objects
   * @param {Object} target - Target object
   * @param {...Object} sources - Source objects
   * @returns {Object} Merged object
   */
  deepMerge(target, ...sources) {
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;

      for (const key of Object.keys(source)) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (sourceValue === undefined) continue;

        if (Array.isArray(sourceValue)) {
          // Replace arrays entirely
          target[key] = [...sourceValue];
        } else if (sourceValue !== null && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
          // Deep merge objects
          if (!targetValue || typeof targetValue !== 'object' || Array.isArray(targetValue)) {
            target[key] = {};
          }
          this.deepMerge(target[key], sourceValue);
        } else {
          // Simple value assignment
          target[key] = sourceValue;
        }
      }
    }

    return target;
  }

  /**
   * Save current configuration to file
   * @param {string} filePath - Optional alternative file path
   * @returns {Object} Result { success: boolean, error?: string }
   */
  save(filePath = null) {
    const savePath = filePath || this.configPath;

    if (!savePath) {
      return {
        success: false,
        error: 'No configuration file path specified'
      };
    }

    try {
      const ext = path.extname(savePath).toLowerCase();
      let content;

      // Merge file config with runtime changes for saving
      const saveConfig = this.deepMerge({}, this.sources.file, this.sources.runtime);

      if (ext === '.yaml' || ext === '.yml') {
        content = this.toYaml(saveConfig);
      } else {
        content = JSON.stringify(saveConfig, null, 2);
      }

      // Write atomically using temp file
      const tempPath = savePath + '.tmp';
      fs.writeFileSync(tempPath, content, 'utf8');
      fs.renameSync(tempPath, savePath);

      console.log(`[ConfigManager] Configuration saved to: ${savePath}`);

      this.emit('configSaved', { path: savePath });

      return { success: true };
    } catch (error) {
      console.error(`[ConfigManager] Error saving config: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convert configuration to YAML format
   * @param {Object} obj - Configuration object
   * @param {number} indent - Current indentation level
   * @returns {string} YAML string
   */
  toYaml(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        yaml += `${spaces}${key}: null\n`;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += this.toYaml(value, indent + 1);
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            yaml += `${spaces}  - ${JSON.stringify(item)}\n`;
          } else {
            yaml += `${spaces}  - ${this.formatYamlValue(item)}\n`;
          }
        }
      } else {
        yaml += `${spaces}${key}: ${this.formatYamlValue(value)}\n`;
      }
    }

    return yaml;
  }

  /**
   * Format a value for YAML output
   * @param {*} value - Value to format
   * @returns {string} Formatted value
   */
  formatYamlValue(value) {
    if (typeof value === 'string') {
      // Quote strings with special characters
      if (/[:\[\]{}#&*!|>'"@`]/.test(value) || value.includes('\n')) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    return String(value);
  }

  /**
   * Watch configuration file for changes
   * @returns {Object} Result { success: boolean, error?: string }
   */
  watch() {
    if (!this.configPath) {
      return {
        success: false,
        error: 'No configuration file loaded to watch'
      };
    }

    if (this.watcher) {
      // Already watching
      return { success: true, alreadyWatching: true };
    }

    try {
      this.watcher = fs.watch(this.configPath, (eventType) => {
        if (eventType === 'change') {
          // Debounce rapid changes
          if (this.watchDebounceTimer) {
            clearTimeout(this.watchDebounceTimer);
          }

          this.watchDebounceTimer = setTimeout(() => {
            console.log('[ConfigManager] Configuration file changed, reloading...');
            this.reload();
          }, this.watchDebounceDelay);
        }
      });

      this.watcher.on('error', (error) => {
        console.error(`[ConfigManager] Watch error: ${error.message}`);
        this.emit('watchError', error);
      });

      console.log(`[ConfigManager] Watching configuration file: ${this.configPath}`);

      this.emit('watchStarted', { path: this.configPath });

      return { success: true };
    } catch (error) {
      console.error(`[ConfigManager] Error starting watch: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop watching configuration file
   */
  unwatch() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;

      if (this.watchDebounceTimer) {
        clearTimeout(this.watchDebounceTimer);
        this.watchDebounceTimer = null;
      }

      console.log('[ConfigManager] Stopped watching configuration file');

      this.emit('watchStopped');
    }
  }

  /**
   * Reload configuration from file
   * @returns {Object} Result { success: boolean, config?: Object, errors?: string[] }
   */
  reload() {
    if (!this.configPath) {
      return {
        success: false,
        errors: ['No configuration file path to reload']
      };
    }

    const oldConfig = { ...this.config };
    const result = this.loadConfig(this.configPath);

    if (result.success) {
      this.emit('configReloaded', { oldConfig, newConfig: this.config });
    }

    return result;
  }

  /**
   * Validate current configuration against schema
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validate() {
    return validateConfig(this.config);
  }

  /**
   * Get all configuration as a plain object
   * @returns {Object} Full configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Check if a configuration key exists
   * @param {string} key - Configuration key (dot notation)
   * @returns {boolean} True if key exists
   */
  has(key) {
    const parts = key.split('.');
    let value = this.config;

    for (const part of parts) {
      if (value === undefined || value === null || typeof value !== 'object') {
        return false;
      }
      if (!(part in value)) {
        return false;
      }
      value = value[part];
    }

    return true;
  }

  /**
   * Reset configuration to defaults
   * @param {string} section - Optional section to reset (e.g., 'server')
   */
  reset(section = null) {
    if (section) {
      if (defaults[section]) {
        this.sources.runtime[section] = undefined;
        this.sources.file[section] = undefined;
        this.mergeConfig();
        console.log(`[ConfigManager] Reset section: ${section}`);
      }
    } else {
      this.sources.file = {};
      this.sources.runtime = {};
      this.mergeConfig();
      console.log('[ConfigManager] Reset to defaults');
    }

    this.emit('configReset', { section });
  }

  /**
   * Get configuration source information
   * @param {string} key - Configuration key
   * @returns {Object} Source info { source: string, value: any }
   */
  getSource(key) {
    const parts = key.split('.');

    // Check each source in priority order
    const sources = ['cli', 'runtime', 'env', 'file', 'defaults'];

    for (const source of sources) {
      let value = this.sources[source];
      let found = true;

      for (const part of parts) {
        if (value === undefined || value === null || typeof value !== 'object' || !(part in value)) {
          found = false;
          break;
        }
        value = value[part];
      }

      if (found && value !== undefined) {
        return { source, value };
      }
    }

    return { source: 'none', value: undefined };
  }

  /**
   * Get schema information for a key
   * @param {string} key - Configuration key
   * @returns {Object|null} Schema information
   */
  getSchemaInfo(key) {
    return getSchema(key);
  }

  /**
   * Export configuration to a string
   * @param {string} format - Export format ('json' or 'yaml')
   * @returns {string} Configuration string
   */
  export(format = 'json') {
    if (format === 'yaml' || format === 'yml') {
      return this.toYaml(this.config);
    }
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.unwatch();
    this.removeAllListeners();
    console.log('[ConfigManager] Cleanup complete');
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton ConfigManager instance
 * @param {Object} options - Options for new instance
 * @returns {ConfigManager} ConfigManager instance
 */
function getConfigManager(options = {}) {
  if (!instance) {
    instance = new ConfigManager(options);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
function resetConfigManager() {
  if (instance) {
    instance.cleanup();
    instance = null;
  }
}

module.exports = {
  ConfigManager,
  getConfigManager,
  resetConfigManager
};
