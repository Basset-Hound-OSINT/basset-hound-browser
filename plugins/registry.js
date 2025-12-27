/**
 * Basset Hound Browser - Plugin Registry Module
 * Tracks loaded plugins, their metadata, and provides enable/disable functionality
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

/**
 * Plugin registry entry structure
 * @typedef {Object} PluginEntry
 * @property {string} name - Plugin name
 * @property {Object} plugin - Plugin instance
 * @property {Object} metadata - Plugin metadata
 * @property {string} path - Plugin file path
 * @property {boolean} enabled - Whether plugin is enabled
 * @property {Object} config - Plugin configuration
 * @property {string} loadedAt - Timestamp when loaded
 */

/**
 * PluginRegistry class
 * Central registry for tracking and managing plugins
 */
class PluginRegistry extends EventEmitter {
  /**
   * Create a new PluginRegistry instance
   * @param {Object} options - Registry options
   * @param {string} [options.configPath] - Path to store configuration
   * @param {boolean} [options.persistConfig=true] - Persist config to disk
   */
  constructor(options = {}) {
    super();

    // Registry storage: name -> PluginEntry
    this.registry = new Map();

    // Plugin configurations: name -> config object
    this.configurations = new Map();

    // Plugin dependencies graph
    this.dependencyGraph = new Map();

    // Configuration persistence
    this.configPath = options.configPath || null;
    this.persistConfig = options.persistConfig !== false;

    // Load persisted configurations
    if (this.configPath && this.persistConfig) {
      this.loadConfigurations();
    }

    console.log('[PluginRegistry] Initialized');
  }

  /**
   * Register a plugin
   * @param {string} name - Plugin name
   * @param {Object} entry - Plugin entry data
   * @returns {Object} Registration result
   */
  register(name, entry) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Plugin name is required' };
    }

    if (this.registry.has(name)) {
      return { success: false, error: `Plugin already registered: ${name}` };
    }

    // Create registry entry
    const registryEntry = {
      name,
      plugin: entry.plugin,
      metadata: entry.metadata || {},
      path: entry.path || null,
      enabled: true,
      config: this.configurations.get(name) || {},
      loadedAt: entry.loadedAt || new Date().toISOString(),
      registeredAt: new Date().toISOString()
    };

    this.registry.set(name, registryEntry);

    // Build dependency graph
    if (registryEntry.metadata.dependencies) {
      this.dependencyGraph.set(name, registryEntry.metadata.dependencies);
    }

    // Emit event
    this.emit('plugin-registered', { name, metadata: registryEntry.metadata });

    console.log(`[PluginRegistry] Plugin registered: ${name}`);

    return { success: true, name };
  }

  /**
   * Unregister a plugin
   * @param {string} name - Plugin name
   * @returns {Object} Unregistration result
   */
  unregister(name) {
    if (!this.registry.has(name)) {
      return { success: false, error: `Plugin not found: ${name}` };
    }

    // Check for dependents
    const dependents = this.getDependents(name);
    if (dependents.length > 0) {
      return {
        success: false,
        error: `Cannot unregister: plugins depend on this: ${dependents.join(', ')}`
      };
    }

    // Remove from registry
    this.registry.delete(name);
    this.dependencyGraph.delete(name);

    // Emit event
    this.emit('plugin-unregistered', { name });

    console.log(`[PluginRegistry] Plugin unregistered: ${name}`);

    return { success: true, name };
  }

  /**
   * Get a registered plugin
   * @param {string} name - Plugin name
   * @returns {Object|null} Plugin entry or null
   */
  get(name) {
    return this.registry.get(name) || null;
  }

  /**
   * Get a plugin instance
   * @param {string} name - Plugin name
   * @returns {Object|null} Plugin instance or null
   */
  getPlugin(name) {
    const entry = this.registry.get(name);
    return entry ? entry.plugin : null;
  }

  /**
   * Check if a plugin is registered
   * @param {string} name - Plugin name
   * @returns {boolean} True if registered
   */
  has(name) {
    return this.registry.has(name);
  }

  /**
   * Enable a plugin
   * @param {string} name - Plugin name
   * @returns {Object} Enable result
   */
  enable(name) {
    const entry = this.registry.get(name);

    if (!entry) {
      return { success: false, error: `Plugin not found: ${name}` };
    }

    if (entry.enabled) {
      return { success: true, message: 'Plugin already enabled' };
    }

    // Check if dependencies are enabled
    const dependencies = this.dependencyGraph.get(name) || [];
    for (const dep of dependencies) {
      const depEntry = this.registry.get(dep);
      if (!depEntry || !depEntry.enabled) {
        return {
          success: false,
          error: `Cannot enable: dependency not enabled: ${dep}`
        };
      }
    }

    entry.enabled = true;

    // Call onEnable if available
    if (entry.plugin && typeof entry.plugin.onEnable === 'function') {
      try {
        entry.plugin.onEnable();
      } catch (error) {
        console.error(`[PluginRegistry] Error in onEnable for ${name}:`, error.message);
      }
    }

    // Emit event
    this.emit('plugin-enabled', { name });

    // Persist config
    this.saveConfiguration(name);

    console.log(`[PluginRegistry] Plugin enabled: ${name}`);

    return { success: true, name };
  }

  /**
   * Disable a plugin
   * @param {string} name - Plugin name
   * @returns {Object} Disable result
   */
  disable(name) {
    const entry = this.registry.get(name);

    if (!entry) {
      return { success: false, error: `Plugin not found: ${name}` };
    }

    if (!entry.enabled) {
      return { success: true, message: 'Plugin already disabled' };
    }

    // Check if other enabled plugins depend on this
    const dependents = this.getEnabledDependents(name);
    if (dependents.length > 0) {
      return {
        success: false,
        error: `Cannot disable: enabled plugins depend on this: ${dependents.join(', ')}`
      };
    }

    entry.enabled = false;

    // Call onDisable if available
    if (entry.plugin && typeof entry.plugin.onDisable === 'function') {
      try {
        entry.plugin.onDisable();
      } catch (error) {
        console.error(`[PluginRegistry] Error in onDisable for ${name}:`, error.message);
      }
    }

    // Emit event
    this.emit('plugin-disabled', { name });

    // Persist config
    this.saveConfiguration(name);

    console.log(`[PluginRegistry] Plugin disabled: ${name}`);

    return { success: true, name };
  }

  /**
   * Check if a plugin is enabled
   * @param {string} name - Plugin name
   * @returns {boolean} True if enabled
   */
  isEnabled(name) {
    const entry = this.registry.get(name);
    return entry ? entry.enabled : false;
  }

  /**
   * List all registered plugins
   * @param {Object} [options] - List options
   * @param {boolean} [options.enabledOnly=false] - Only list enabled plugins
   * @returns {Object} List of plugins
   */
  list(options = {}) {
    const plugins = [];

    for (const [name, entry] of this.registry) {
      if (options.enabledOnly && !entry.enabled) {
        continue;
      }

      plugins.push({
        name,
        version: entry.metadata?.version || 'unknown',
        description: entry.metadata?.description || '',
        author: entry.metadata?.author || '',
        enabled: entry.enabled,
        path: entry.path,
        loadedAt: entry.loadedAt,
        registeredAt: entry.registeredAt,
        dependencies: entry.metadata?.dependencies || [],
        hasConfig: this.configurations.has(name)
      });
    }

    return {
      success: true,
      count: plugins.length,
      plugins
    };
  }

  /**
   * Get enabled plugins only
   * @returns {Object} List of enabled plugins
   */
  listEnabled() {
    return this.list({ enabledOnly: true });
  }

  /**
   * Set plugin configuration
   * @param {string} name - Plugin name
   * @param {Object} config - Configuration object
   * @returns {Object} Set result
   */
  setConfig(name, config) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Plugin name is required' };
    }

    if (typeof config !== 'object' || config === null) {
      return { success: false, error: 'Config must be an object' };
    }

    // Store configuration
    this.configurations.set(name, config);

    // Update registry entry if exists
    const entry = this.registry.get(name);
    if (entry) {
      entry.config = config;

      // Notify plugin of config change
      if (entry.plugin && typeof entry.plugin.onConfigChange === 'function') {
        try {
          entry.plugin.onConfigChange(config);
        } catch (error) {
          console.error(`[PluginRegistry] Error in onConfigChange for ${name}:`, error.message);
        }
      }
    }

    // Persist configuration
    this.saveConfiguration(name);

    // Emit event
    this.emit('config-changed', { name, config });

    console.log(`[PluginRegistry] Config set for: ${name}`);

    return { success: true, name };
  }

  /**
   * Get plugin configuration
   * @param {string} name - Plugin name
   * @returns {Object} Configuration result
   */
  getConfig(name) {
    const config = this.configurations.get(name);
    const entry = this.registry.get(name);

    // Merge with default config if available
    let defaultConfig = {};
    if (entry && entry.plugin && entry.plugin.defaultConfig) {
      defaultConfig = entry.plugin.defaultConfig;
    }

    return {
      success: true,
      config: { ...defaultConfig, ...config }
    };
  }

  /**
   * Update plugin configuration (merge with existing)
   * @param {string} name - Plugin name
   * @param {Object} updates - Configuration updates
   * @returns {Object} Update result
   */
  updateConfig(name, updates) {
    const existing = this.configurations.get(name) || {};
    const newConfig = { ...existing, ...updates };
    return this.setConfig(name, newConfig);
  }

  /**
   * Delete plugin configuration
   * @param {string} name - Plugin name
   * @returns {Object} Delete result
   */
  deleteConfig(name) {
    if (!this.configurations.has(name)) {
      return { success: false, error: `No configuration found for: ${name}` };
    }

    this.configurations.delete(name);

    // Update registry entry
    const entry = this.registry.get(name);
    if (entry) {
      entry.config = {};
    }

    // Persist change
    this.saveConfigurations();

    return { success: true, name };
  }

  /**
   * Get plugins that depend on a given plugin
   * @param {string} name - Plugin name
   * @returns {string[]} List of dependent plugin names
   */
  getDependents(name) {
    const dependents = [];

    for (const [pluginName, deps] of this.dependencyGraph) {
      if (deps.includes(name)) {
        dependents.push(pluginName);
      }
    }

    return dependents;
  }

  /**
   * Get enabled plugins that depend on a given plugin
   * @param {string} name - Plugin name
   * @returns {string[]} List of enabled dependent plugin names
   */
  getEnabledDependents(name) {
    return this.getDependents(name).filter(dep => this.isEnabled(dep));
  }

  /**
   * Get dependencies for a plugin
   * @param {string} name - Plugin name
   * @returns {string[]} List of dependency names
   */
  getDependencies(name) {
    return this.dependencyGraph.get(name) || [];
  }

  /**
   * Resolve dependency order for loading
   * @returns {string[]} Plugins in dependency order
   */
  resolveDependencyOrder() {
    const order = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (name) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }

      visiting.add(name);

      const deps = this.dependencyGraph.get(name) || [];
      for (const dep of deps) {
        if (this.registry.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of this.registry.keys()) {
      visit(name);
    }

    return order;
  }

  /**
   * Check if all dependencies for a plugin are satisfied
   * @param {string} name - Plugin name
   * @returns {Object} Dependency check result
   */
  checkDependencies(name) {
    const dependencies = this.dependencyGraph.get(name) || [];
    const missing = [];
    const disabled = [];

    for (const dep of dependencies) {
      if (!this.registry.has(dep)) {
        missing.push(dep);
      } else if (!this.isEnabled(dep)) {
        disabled.push(dep);
      }
    }

    return {
      satisfied: missing.length === 0 && disabled.length === 0,
      missing,
      disabled
    };
  }

  /**
   * Get registry statistics
   * @returns {Object} Statistics
   */
  getStats() {
    let enabled = 0;
    let disabled = 0;
    let withConfig = 0;

    for (const [name, entry] of this.registry) {
      if (entry.enabled) {
        enabled++;
      } else {
        disabled++;
      }

      if (this.configurations.has(name)) {
        withConfig++;
      }
    }

    return {
      success: true,
      total: this.registry.size,
      enabled,
      disabled,
      withConfig,
      dependencyCount: this.dependencyGraph.size
    };
  }

  /**
   * Load configurations from disk
   */
  loadConfigurations() {
    if (!this.configPath) return;

    const configFile = path.join(this.configPath, 'plugin-configs.json');

    try {
      if (fs.existsSync(configFile)) {
        const data = fs.readFileSync(configFile, 'utf8');
        const configs = JSON.parse(data);

        for (const [name, config] of Object.entries(configs)) {
          this.configurations.set(name, config);
        }

        console.log(`[PluginRegistry] Loaded ${this.configurations.size} plugin configurations`);
      }
    } catch (error) {
      console.error('[PluginRegistry] Error loading configurations:', error.message);
    }
  }

  /**
   * Save all configurations to disk
   */
  saveConfigurations() {
    if (!this.configPath || !this.persistConfig) return;

    const configFile = path.join(this.configPath, 'plugin-configs.json');

    try {
      // Ensure directory exists
      if (!fs.existsSync(this.configPath)) {
        fs.mkdirSync(this.configPath, { recursive: true });
      }

      const configs = {};
      for (const [name, config] of this.configurations) {
        configs[name] = config;
      }

      fs.writeFileSync(configFile, JSON.stringify(configs, null, 2));
      console.log(`[PluginRegistry] Saved ${this.configurations.size} plugin configurations`);
    } catch (error) {
      console.error('[PluginRegistry] Error saving configurations:', error.message);
    }
  }

  /**
   * Save configuration for a specific plugin
   * @param {string} name - Plugin name
   */
  saveConfiguration(name) {
    // Save all configurations (simpler approach)
    this.saveConfigurations();
  }

  /**
   * Export registry state
   * @returns {Object} Registry state
   */
  export() {
    const plugins = [];
    const configs = {};

    for (const [name, entry] of this.registry) {
      plugins.push({
        name,
        enabled: entry.enabled,
        path: entry.path,
        metadata: entry.metadata
      });
    }

    for (const [name, config] of this.configurations) {
      configs[name] = config;
    }

    return {
      success: true,
      plugins,
      configs,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import registry state (configurations only)
   * @param {Object} state - State to import
   * @returns {Object} Import result
   */
  import(state) {
    if (!state || typeof state !== 'object') {
      return { success: false, error: 'Invalid state object' };
    }

    let imported = 0;

    // Import configurations
    if (state.configs) {
      for (const [name, config] of Object.entries(state.configs)) {
        this.configurations.set(name, config);

        // Update registry entry if exists
        const entry = this.registry.get(name);
        if (entry) {
          entry.config = config;
        }

        imported++;
      }
    }

    // Apply enabled/disabled state
    if (state.plugins) {
      for (const plugin of state.plugins) {
        if (this.registry.has(plugin.name)) {
          if (plugin.enabled) {
            this.enable(plugin.name);
          } else {
            this.disable(plugin.name);
          }
        }
      }
    }

    // Persist
    this.saveConfigurations();

    console.log(`[PluginRegistry] Imported ${imported} configurations`);

    return { success: true, imported };
  }

  /**
   * Cleanup the registry
   */
  cleanup() {
    // Save configurations before cleanup
    if (this.persistConfig) {
      this.saveConfigurations();
    }

    this.registry.clear();
    this.dependencyGraph.clear();

    console.log('[PluginRegistry] Cleanup complete');
  }
}

module.exports = {
  PluginRegistry
};
