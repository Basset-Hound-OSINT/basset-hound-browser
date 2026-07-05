/**
 * Configuration Management System
 *
 * Handles:
 * - Loading configuration from files
 * - Environment variable overrides
 * - Schema validation
 * - Hot reloading
 * - Configuration exposure via endpoint
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class ConfigManager extends EventEmitter {
  constructor(configDir = './config') {
    super();

    this.configDir = configDir;
    this.config = {};
    this.schemas = {};
    this.watchers = new Map();
    this.isInitialized = false;
  }

  /**
   * Register a configuration schema
   */
  registerSchema(name, schema) {
    this.schemas[name] = schema;
  }

  /**
   * Load configuration from files and environment
   */
  async loadConfig() {
    try {
      // Load all JSON files from config directory
      if (fs.existsSync(this.configDir)) {
        const files = fs.readdirSync(this.configDir);

        for (const file of files) {
          if (file.endsWith('.json')) {
            const name = file.replace('.json', '');
            const filePath = path.join(this.configDir, file);

            try {
              const content = fs.readFileSync(filePath, 'utf-8');
              const fileConfig = JSON.parse(content);

              // Apply environment overrides
              const envConfig = this.applyEnvOverrides(name, fileConfig);

              // Validate if schema exists
              if (this.schemas[name]) {
                const validation = this.validateConfig(name, envConfig);
                if (!validation.valid) {
                  throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
                }
              }

              this.config[name] = envConfig;
              this.emit('config:loaded', { name, file: filePath });
            } catch (err) {
              console.error(`Failed to load config file ${file}:`, err.message);
              this.emit('config:error', { name, error: err });
            }
          }
        }
      }

      this.isInitialized = true;
      this.emit('config:ready');
      return true;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Apply environment variable overrides
   * Looks for BASSET_<CONFIG_NAME>_<KEY> variables
   */
  applyEnvOverrides(configName, config) {
    const prefix = `BASSET_${configName.toUpperCase()}_`;
    const overridden = { ...config };

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.substring(prefix.length).toLowerCase();
        try {
          overridden[configKey] = JSON.parse(value);
        } catch {
          overridden[configKey] = value;
        }
      }
    }

    return overridden;
  }

  /**
   * Validate configuration against schema
   */
  validateConfig(name, config) {
    const schema = this.schemas[name];
    if (!schema) {
      return { valid: true };
    }

    const errors = [];

    for (const [key, rule] of Object.entries(schema)) {
      const value = config[key];

      if (rule.required && value === undefined) {
        errors.push(`${key} is required`);
        continue;
      }

      if (value !== undefined) {
        if (rule.type && typeof value !== rule.type) {
          errors.push(`${key} must be of type ${rule.type}`);
        }

        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`${key} must be one of: ${rule.enum.join(', ')}`);
        }

        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${key} must be >= ${rule.min}`);
        }

        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${key} must be <= ${rule.max}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get a configuration value
   */
  get(path, defaultValue = null) {
    if (!this.isInitialized) {
      throw new Error('ConfigManager not initialized. Call loadConfig first.');
    }

    const parts = path.split('.');
    let current = this.config;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return defaultValue;
      }
      current = current[part];
    }

    return current !== undefined ? current : defaultValue;
  }

  /**
   * Set a configuration value (in-memory only)
   */
  set(path, value) {
    const parts = path.split('.');
    const key = parts.pop();
    let current = this.config;

    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    const oldValue = current[key];
    current[key] = value;

    this.emit('config:changed', {
      path,
      oldValue,
      newValue: value
    });
  }

  /**
   * Watch a config file for changes (hot reload)
   */
  watchFile(name) {
    const filePath = path.join(this.configDir, `${name}.json`);

    if (!fs.existsSync(filePath)) {
      console.warn(`Config file not found: ${filePath}`);
      return;
    }

    if (this.watchers.has(name)) {
      return; // Already watching
    }

    try {
      const watcher = fs.watch(filePath, async (eventType) => {
        if (eventType === 'change') {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const newConfig = JSON.parse(content);

            // Validate
            if (this.schemas[name]) {
              const validation = this.validateConfig(name, newConfig);
              if (!validation.valid) {
                this.emit('config:reload-failed', {
                  name,
                  errors: validation.errors
                });
                return;
              }
            }

            const oldConfig = this.config[name];
            this.config[name] = newConfig;

            this.emit('config:reloaded', {
              name,
              oldConfig,
              newConfig
            });
          } catch (err) {
            this.emit('config:reload-failed', { name, error: err });
          }
        }
      });

      this.watchers.set(name, watcher);
      this.emit('config:watch-started', { name });
    } catch (err) {
      this.emit('error', err);
    }
  }

  /**
   * Stop watching a config file
   */
  unwatchFile(name) {
    const watcher = this.watchers.get(name);
    if (watcher) {
      watcher.close();
      this.watchers.delete(name);
      this.emit('config:watch-stopped', { name });
    }
  }

  /**
   * Get all configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Get configuration for a specific name
   */
  getSection(name) {
    return this.config[name] || {};
  }

  /**
   * Health check endpoint data
   */
  getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      configCount: Object.keys(this.config).length,
      watchingFiles: Array.from(this.watchers.keys())
    };
  }

  /**
   * Clean up watchers on shutdown
   */
  shutdown() {
    for (const watcher of this.watchers.values()) {
      try {
        watcher.close();
      } catch (err) {
        // Ignore
      }
    }
    this.watchers.clear();
  }
}

module.exports = ConfigManager;
