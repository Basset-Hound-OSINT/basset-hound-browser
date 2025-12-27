/**
 * Basset Hound Browser - Plugin System Module
 *
 * This module provides a comprehensive plugin architecture for extending
 * the browser's functionality. It includes:
 *
 * - PluginLoader: Load and manage plugins from the file system
 * - PluginAPI: Sandboxed API for plugins to interact with the browser
 * - PluginRegistry: Track and manage loaded plugins
 * - PluginSandbox: Isolated execution environment for plugin security
 *
 * Usage:
 *   const { PluginManager } = require('./plugins');
 *   const manager = new PluginManager({ mainWindow, managers });
 *   await manager.loadPlugin('/path/to/plugin.js');
 *
 * Example plugins are provided in the examples/ directory:
 *   - hello-world.js: Basic plugin demonstrating core features
 *   - custom-headers.js: Header manipulation plugin
 *
 * @module plugins
 */

const { PluginLoader, PLUGIN_STATE } = require('./loader');
const { PluginAPI, PERMISSION_LEVELS, API_CATEGORIES } = require('./api');
const { PluginRegistry } = require('./registry');
const { PluginSandbox, SANDBOX_STATE, DEFAULT_LIMITS } = require('./sandbox');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * PluginManager class
 * High-level manager that orchestrates all plugin system components
 */
class PluginManager extends EventEmitter {
  /**
   * Create a new PluginManager instance
   * @param {Object} options - Manager options
   * @param {Object} [options.mainWindow] - Electron main window
   * @param {Object} [options.managers] - Object containing all manager instances
   * @param {string} [options.pluginDir] - Directory for plugins
   * @param {string} [options.configPath] - Path for plugin configurations
   * @param {boolean} [options.sandboxed=true] - Enable sandboxed execution
   * @param {boolean} [options.autoload=false] - Auto-load plugins on init
   */
  constructor(options = {}) {
    super();

    // Create the plugin sandbox
    this.sandbox = options.sandboxed !== false ? new PluginSandbox({
      timeout: options.timeout || 30000,
      allowedModules: options.allowedModules || ['path', 'url', 'querystring', 'util', 'events', 'buffer']
    }) : null;

    // Create the plugin API
    this.api = new PluginAPI({
      mainWindow: options.mainWindow,
      tabManager: options.managers?.tab,
      sessionManager: options.managers?.session,
      cookieManager: options.managers?.cookie,
      headerManager: options.managers?.header,
      networkAnalysisManager: options.managers?.network,
      extractionManager: options.managers?.extraction,
      storageManager: options.managers?.storage,
      historyManager: options.managers?.history,
      geolocationManager: options.managers?.geolocation,
      profileManager: options.managers?.profile
    });

    // Create the plugin registry
    this.registry = new PluginRegistry({
      configPath: options.configPath,
      persistConfig: options.persistConfig !== false
    });

    // Create the plugin loader
    this.loader = new PluginLoader({
      pluginDir: options.pluginDir || path.join(__dirname, 'examples'),
      api: this.api,
      registry: this.registry,
      sandbox: this.sandbox,
      autoload: options.autoload || false
    });

    // Connect components
    this.loader.setAPI(this.api);
    this.loader.setRegistry(this.registry);
    if (this.sandbox) {
      this.loader.setSandbox(this.sandbox);
    }

    // Forward events
    this.loader.on('plugin-loaded', (data) => this.emit('plugin-loaded', data));
    this.loader.on('plugin-unloaded', (data) => this.emit('plugin-unloaded', data));
    this.registry.on('plugin-enabled', (data) => this.emit('plugin-enabled', data));
    this.registry.on('plugin-disabled', (data) => this.emit('plugin-disabled', data));
    this.registry.on('config-changed', (data) => this.emit('config-changed', data));

    // Store options
    this.options = options;
    this.initialized = false;

    console.log('[PluginManager] Created');
  }

  /**
   * Initialize the plugin manager
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    if (this.initialized) {
      return { success: true, message: 'Already initialized' };
    }

    console.log('[PluginManager] Initializing...');

    // Auto-load plugins if configured
    if (this.options.autoload && this.options.pluginDir) {
      await this.loader.loadPluginsFromDirectory(this.options.pluginDir);
    }

    this.initialized = true;

    console.log('[PluginManager] Initialized');

    return { success: true };
  }

  /**
   * Set the main window reference
   * @param {Object} mainWindow - Electron BrowserWindow
   */
  setMainWindow(mainWindow) {
    this.api.setMainWindow(mainWindow);
  }

  /**
   * Set a manager reference
   * @param {string} name - Manager name
   * @param {Object} manager - Manager instance
   */
  setManager(name, manager) {
    this.api.setManager(name, manager);
  }

  /**
   * Load a plugin
   * @param {string} pluginPath - Path to the plugin file
   * @param {Object} [options] - Load options
   * @returns {Promise<Object>} Load result
   */
  async loadPlugin(pluginPath, options = {}) {
    const result = await this.loader.loadPlugin(pluginPath, options);

    if (result.success && result.plugin) {
      // Create context for the plugin
      const plugin = this.loader.getPlugin(result.plugin.name);
      if (plugin) {
        const permissions = plugin.permissions || {};
        this.api.createContext(result.plugin.name, permissions);
      }
    }

    return result;
  }

  /**
   * Unload a plugin
   * @param {string} pluginName - Plugin name
   * @returns {Promise<Object>} Unload result
   */
  async unloadPlugin(pluginName) {
    // Cleanup API resources for this plugin
    this.api.cleanupPlugin(pluginName);

    return await this.loader.unloadPlugin(pluginName);
  }

  /**
   * Reload a plugin
   * @param {string} pluginName - Plugin name
   * @returns {Promise<Object>} Reload result
   */
  async reloadPlugin(pluginName) {
    return await this.loader.reloadPlugin(pluginName);
  }

  /**
   * Get a loaded plugin
   * @param {string} name - Plugin name
   * @returns {Object|null} Plugin instance
   */
  getPlugin(name) {
    return this.loader.getPlugin(name);
  }

  /**
   * List all loaded plugins
   * @returns {Object} List of plugins
   */
  listPlugins() {
    return this.loader.listPlugins();
  }

  /**
   * Enable a plugin
   * @param {string} pluginName - Plugin name
   * @returns {Object} Enable result
   */
  enablePlugin(pluginName) {
    return this.registry.enable(pluginName);
  }

  /**
   * Disable a plugin
   * @param {string} pluginName - Plugin name
   * @returns {Object} Disable result
   */
  disablePlugin(pluginName) {
    return this.registry.disable(pluginName);
  }

  /**
   * Check if a plugin is enabled
   * @param {string} pluginName - Plugin name
   * @returns {boolean} True if enabled
   */
  isPluginEnabled(pluginName) {
    return this.registry.isEnabled(pluginName);
  }

  /**
   * Set plugin configuration
   * @param {string} pluginName - Plugin name
   * @param {Object} config - Configuration object
   * @returns {Object} Set result
   */
  setPluginConfig(pluginName, config) {
    return this.registry.setConfig(pluginName, config);
  }

  /**
   * Get plugin configuration
   * @param {string} pluginName - Plugin name
   * @returns {Object} Configuration
   */
  getPluginConfig(pluginName) {
    return this.registry.getConfig(pluginName);
  }

  /**
   * Execute a plugin command
   * @param {string} commandName - Full command name (plugin:name:command)
   * @param {Object} params - Command parameters
   * @returns {Promise<Object>} Command result
   */
  async executeCommand(commandName, params = {}) {
    return await this.api.executeCommand(commandName, params);
  }

  /**
   * List all registered plugin commands
   * @returns {Object} List of commands
   */
  listCommands() {
    return this.api.listCommands();
  }

  /**
   * Trigger a hook
   * @param {string} hookName - Hook name
   * @param {*} data - Hook data
   * @returns {Promise<Array>} Hook results
   */
  async triggerHook(hookName, data) {
    return await this.api.triggerHook(hookName, data);
  }

  /**
   * Get available hooks
   * @returns {Object} Available hooks
   */
  getAvailableHooks() {
    return this.api.getAvailableHooks();
  }

  /**
   * Get plugin manager status
   * @returns {Object} Status information
   */
  getStatus() {
    const loaderList = this.loader.listPlugins();
    const registryStats = this.registry.getStats();
    const sandboxStats = this.sandbox ? this.sandbox.getStats() : null;

    return {
      success: true,
      initialized: this.initialized,
      plugins: loaderList,
      registry: registryStats,
      sandbox: sandboxStats,
      commands: this.api.listCommands(),
      hooks: this.api.getAvailableHooks()
    };
  }

  /**
   * Load all plugins from a directory
   * @param {string} directory - Plugin directory
   * @returns {Promise<Object>} Load results
   */
  async loadPluginsFromDirectory(directory) {
    return await this.loader.loadPluginsFromDirectory(directory);
  }

  /**
   * Cleanup and shutdown the plugin manager
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanup() {
    console.log('[PluginManager] Cleaning up...');

    // Cleanup all plugins
    await this.loader.cleanup();

    // Cleanup API
    this.api.cleanup();

    // Cleanup registry
    this.registry.cleanup();

    // Cleanup sandbox
    if (this.sandbox) {
      this.sandbox.cleanup();
    }

    this.initialized = false;

    console.log('[PluginManager] Cleanup complete');

    return { success: true };
  }
}

/**
 * Create a plugin manager instance (factory function)
 * @param {Object} options - Manager options
 * @returns {PluginManager} Plugin manager instance
 */
function createPluginManager(options = {}) {
  return new PluginManager(options);
}

// Export all components
module.exports = {
  // Main manager
  PluginManager,
  createPluginManager,

  // Individual components
  PluginLoader,
  PluginAPI,
  PluginRegistry,
  PluginSandbox,

  // Constants
  PLUGIN_STATE,
  PERMISSION_LEVELS,
  API_CATEGORIES,
  SANDBOX_STATE,
  DEFAULT_LIMITS
};
