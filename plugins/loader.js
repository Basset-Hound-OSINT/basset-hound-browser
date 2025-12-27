/**
 * Basset Hound Browser - Plugin Loader Module
 * Handles loading, unloading, and management of plugins
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

/**
 * Plugin metadata structure
 * @typedef {Object} PluginMetadata
 * @property {string} name - Unique plugin identifier
 * @property {string} version - Plugin version (semver)
 * @property {string} description - Plugin description
 * @property {string} author - Plugin author
 * @property {string[]} [dependencies] - Required plugin dependencies
 * @property {Object} [permissions] - Required permissions
 */

/**
 * Plugin states
 */
const PLUGIN_STATE = {
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  LOADED: 'loaded',
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  ERROR: 'error'
};

/**
 * PluginLoader class
 * Responsible for loading and managing plugins from file system
 */
class PluginLoader extends EventEmitter {
  /**
   * Create a new PluginLoader instance
   * @param {Object} options - Loader options
   * @param {string} [options.pluginDir] - Default plugin directory
   * @param {Object} [options.api] - Plugin API instance
   * @param {Object} [options.registry] - Plugin registry instance
   * @param {Object} [options.sandbox] - Plugin sandbox instance
   * @param {boolean} [options.autoload=false] - Auto-load plugins on init
   * @param {string[]} [options.allowedExtensions=['.js']] - Allowed file extensions
   */
  constructor(options = {}) {
    super();

    this.pluginDir = options.pluginDir || null;
    this.api = options.api || null;
    this.registry = options.registry || null;
    this.sandbox = options.sandbox || null;
    this.autoload = options.autoload || false;
    this.allowedExtensions = options.allowedExtensions || ['.js'];

    // Loaded plugins: name -> plugin instance
    this.plugins = new Map();

    // Plugin metadata cache
    this.metadata = new Map();

    // Plugin states
    this.states = new Map();

    // Validation rules
    this.validationRules = {
      requiredFields: ['name', 'version'],
      maxNameLength: 64,
      maxDescriptionLength: 500,
      versionPattern: /^\d+\.\d+\.\d+(-[\w.]+)?$/
    };

    // Security settings
    this.security = {
      allowNetworkAccess: options.allowNetworkAccess !== false,
      allowFileSystem: options.allowFileSystem !== false,
      allowChildProcess: options.allowChildProcess === true,
      maxExecutionTime: options.maxExecutionTime || 30000,
      blockedModules: ['child_process', 'cluster', 'worker_threads']
    };

    console.log('[PluginLoader] Initialized');
  }

  /**
   * Set the plugin API instance
   * @param {Object} api - PluginAPI instance
   */
  setAPI(api) {
    this.api = api;
  }

  /**
   * Set the plugin registry instance
   * @param {Object} registry - PluginRegistry instance
   */
  setRegistry(registry) {
    this.registry = registry;
  }

  /**
   * Set the plugin sandbox instance
   * @param {Object} sandbox - PluginSandbox instance
   */
  setSandbox(sandbox) {
    this.sandbox = sandbox;
  }

  /**
   * Load a plugin from a file path
   * @param {string} pluginPath - Path to the plugin file
   * @param {Object} [options] - Load options
   * @returns {Promise<Object>} Load result
   */
  async loadPlugin(pluginPath, options = {}) {
    const absolutePath = path.isAbsolute(pluginPath)
      ? pluginPath
      : path.resolve(this.pluginDir || process.cwd(), pluginPath);

    console.log(`[PluginLoader] Loading plugin from: ${absolutePath}`);

    try {
      // Validate file exists
      if (!fs.existsSync(absolutePath)) {
        return {
          success: false,
          error: `Plugin file not found: ${absolutePath}`
        };
      }

      // Check file extension
      const ext = path.extname(absolutePath);
      if (!this.allowedExtensions.includes(ext)) {
        return {
          success: false,
          error: `Invalid file extension: ${ext}. Allowed: ${this.allowedExtensions.join(', ')}`
        };
      }

      // Read and validate plugin code
      const code = fs.readFileSync(absolutePath, 'utf8');
      const validationResult = this.validatePluginCode(code);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Plugin validation failed: ${validationResult.error}`
        };
      }

      // Create sandboxed context if sandbox available
      let plugin;
      if (this.sandbox) {
        const sandboxResult = await this.sandbox.execute(code, {
          filename: absolutePath,
          api: this.api,
          timeout: this.security.maxExecutionTime
        });

        if (!sandboxResult.success) {
          return {
            success: false,
            error: `Sandbox execution failed: ${sandboxResult.error}`
          };
        }
        plugin = sandboxResult.exports;
      } else {
        // Direct require (less secure)
        delete require.cache[absolutePath];
        plugin = require(absolutePath);
      }

      // Validate plugin structure
      const structureValidation = this.validatePluginStructure(plugin);
      if (!structureValidation.valid) {
        return {
          success: false,
          error: structureValidation.error
        };
      }

      // Extract metadata
      const metadata = this.extractMetadata(plugin, absolutePath);

      // Check if plugin already loaded
      if (this.plugins.has(metadata.name)) {
        if (options.replace) {
          await this.unloadPlugin(metadata.name);
        } else {
          return {
            success: false,
            error: `Plugin already loaded: ${metadata.name}`
          };
        }
      }

      // Check dependencies
      if (metadata.dependencies && metadata.dependencies.length > 0) {
        const depsResult = this.checkDependencies(metadata.dependencies);
        if (!depsResult.satisfied) {
          return {
            success: false,
            error: `Missing dependencies: ${depsResult.missing.join(', ')}`
          };
        }
      }

      // Initialize plugin
      this.states.set(metadata.name, PLUGIN_STATE.LOADING);

      if (typeof plugin.init === 'function') {
        try {
          await plugin.init(this.api);
        } catch (initError) {
          this.states.set(metadata.name, PLUGIN_STATE.ERROR);
          return {
            success: false,
            error: `Plugin initialization failed: ${initError.message}`
          };
        }
      }

      // Store plugin
      this.plugins.set(metadata.name, plugin);
      this.metadata.set(metadata.name, metadata);
      this.states.set(metadata.name, PLUGIN_STATE.LOADED);

      // Register with registry if available
      if (this.registry) {
        this.registry.register(metadata.name, {
          plugin,
          metadata,
          path: absolutePath,
          loadedAt: new Date().toISOString()
        });
      }

      // Emit event
      this.emit('plugin-loaded', {
        name: metadata.name,
        version: metadata.version,
        path: absolutePath
      });

      console.log(`[PluginLoader] Plugin loaded: ${metadata.name} v${metadata.version}`);

      return {
        success: true,
        plugin: {
          name: metadata.name,
          version: metadata.version,
          description: metadata.description,
          author: metadata.author
        }
      };
    } catch (error) {
      console.error(`[PluginLoader] Error loading plugin: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Unload a plugin by name
   * @param {string} pluginName - Plugin name to unload
   * @returns {Promise<Object>} Unload result
   */
  async unloadPlugin(pluginName) {
    console.log(`[PluginLoader] Unloading plugin: ${pluginName}`);

    if (!this.plugins.has(pluginName)) {
      return {
        success: false,
        error: `Plugin not found: ${pluginName}`
      };
    }

    try {
      const plugin = this.plugins.get(pluginName);
      const metadata = this.metadata.get(pluginName);

      // Check if other plugins depend on this one
      const dependents = this.findDependents(pluginName);
      if (dependents.length > 0) {
        return {
          success: false,
          error: `Cannot unload: plugins depend on this: ${dependents.join(', ')}`
        };
      }

      // Call cleanup if available
      if (typeof plugin.cleanup === 'function') {
        try {
          await plugin.cleanup();
        } catch (cleanupError) {
          console.warn(`[PluginLoader] Plugin cleanup warning: ${cleanupError.message}`);
        }
      }

      // Remove from storage
      this.plugins.delete(pluginName);
      this.metadata.delete(pluginName);
      this.states.delete(pluginName);

      // Unregister from registry
      if (this.registry) {
        this.registry.unregister(pluginName);
      }

      // Clear from require cache if we have the path
      if (metadata && metadata.path) {
        delete require.cache[metadata.path];
      }

      // Emit event
      this.emit('plugin-unloaded', { name: pluginName });

      console.log(`[PluginLoader] Plugin unloaded: ${pluginName}`);

      return {
        success: true,
        unloaded: pluginName
      };
    } catch (error) {
      console.error(`[PluginLoader] Error unloading plugin: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get a loaded plugin by name
   * @param {string} name - Plugin name
   * @returns {Object|null} Plugin instance or null
   */
  getPlugin(name) {
    return this.plugins.get(name) || null;
  }

  /**
   * Get plugin metadata by name
   * @param {string} name - Plugin name
   * @returns {Object|null} Plugin metadata or null
   */
  getPluginMetadata(name) {
    return this.metadata.get(name) || null;
  }

  /**
   * Get plugin state by name
   * @param {string} name - Plugin name
   * @returns {string|null} Plugin state or null
   */
  getPluginState(name) {
    return this.states.get(name) || null;
  }

  /**
   * List all loaded plugins
   * @returns {Object} List of loaded plugins
   */
  listPlugins() {
    const plugins = [];

    for (const [name, plugin] of this.plugins) {
      const metadata = this.metadata.get(name);
      const state = this.states.get(name);

      plugins.push({
        name,
        version: metadata?.version || 'unknown',
        description: metadata?.description || '',
        author: metadata?.author || '',
        state: state || PLUGIN_STATE.LOADED,
        dependencies: metadata?.dependencies || [],
        loadedAt: metadata?.loadedAt
      });
    }

    return {
      success: true,
      count: plugins.length,
      plugins
    };
  }

  /**
   * Load all plugins from a directory
   * @param {string} [directory] - Plugin directory (defaults to pluginDir)
   * @returns {Promise<Object>} Load results
   */
  async loadPluginsFromDirectory(directory) {
    const pluginDir = directory || this.pluginDir;

    if (!pluginDir) {
      return {
        success: false,
        error: 'No plugin directory specified'
      };
    }

    if (!fs.existsSync(pluginDir)) {
      return {
        success: false,
        error: `Plugin directory not found: ${pluginDir}`
      };
    }

    console.log(`[PluginLoader] Loading plugins from: ${pluginDir}`);

    const results = {
      success: true,
      loaded: [],
      failed: [],
      skipped: []
    };

    try {
      const files = fs.readdirSync(pluginDir);

      for (const file of files) {
        const filePath = path.join(pluginDir, file);
        const stat = fs.statSync(filePath);

        // Skip directories unless they have an index.js
        if (stat.isDirectory()) {
          const indexPath = path.join(filePath, 'index.js');
          if (fs.existsSync(indexPath)) {
            const loadResult = await this.loadPlugin(indexPath);
            if (loadResult.success) {
              results.loaded.push(loadResult.plugin);
            } else {
              results.failed.push({ file, error: loadResult.error });
            }
          } else {
            results.skipped.push({ file, reason: 'No index.js found' });
          }
          continue;
        }

        // Skip non-JS files
        const ext = path.extname(file);
        if (!this.allowedExtensions.includes(ext)) {
          results.skipped.push({ file, reason: `Invalid extension: ${ext}` });
          continue;
        }

        // Load the plugin
        const loadResult = await this.loadPlugin(filePath);
        if (loadResult.success) {
          results.loaded.push(loadResult.plugin);
        } else {
          results.failed.push({ file, error: loadResult.error });
        }
      }

      console.log(`[PluginLoader] Loaded ${results.loaded.length} plugins, ${results.failed.length} failed`);

    } catch (error) {
      results.success = false;
      results.error = error.message;
    }

    return results;
  }

  /**
   * Reload a plugin
   * @param {string} pluginName - Plugin name to reload
   * @returns {Promise<Object>} Reload result
   */
  async reloadPlugin(pluginName) {
    const metadata = this.metadata.get(pluginName);

    if (!metadata || !metadata.path) {
      return {
        success: false,
        error: `Cannot reload: plugin path not found for ${pluginName}`
      };
    }

    const unloadResult = await this.unloadPlugin(pluginName);
    if (!unloadResult.success) {
      return unloadResult;
    }

    return this.loadPlugin(metadata.path, { replace: true });
  }

  /**
   * Validate plugin code for security issues
   * @param {string} code - Plugin source code
   * @returns {Object} Validation result
   */
  validatePluginCode(code) {
    const result = { valid: true, warnings: [] };

    // Check for blocked modules
    for (const blocked of this.security.blockedModules) {
      const pattern = new RegExp(`require\\s*\\(\\s*['"\`]${blocked}['"\`]\\s*\\)`, 'g');
      if (pattern.test(code)) {
        result.valid = false;
        result.error = `Blocked module usage: ${blocked}`;
        return result;
      }
    }

    // Check for eval usage
    if (/\beval\s*\(/.test(code)) {
      result.warnings.push('Plugin uses eval() which is potentially dangerous');
    }

    // Check for Function constructor
    if (/new\s+Function\s*\(/.test(code)) {
      result.warnings.push('Plugin uses Function constructor which is potentially dangerous');
    }

    // Check for process.exit
    if (/process\.exit\s*\(/.test(code)) {
      result.valid = false;
      result.error = 'Plugin cannot use process.exit()';
      return result;
    }

    return result;
  }

  /**
   * Validate plugin structure
   * @param {Object} plugin - Plugin object
   * @returns {Object} Validation result
   */
  validatePluginStructure(plugin) {
    if (!plugin || typeof plugin !== 'object') {
      return { valid: false, error: 'Plugin must export an object' };
    }

    // Check required fields
    for (const field of this.validationRules.requiredFields) {
      if (!plugin[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    // Validate name
    if (typeof plugin.name !== 'string') {
      return { valid: false, error: 'Plugin name must be a string' };
    }

    if (plugin.name.length > this.validationRules.maxNameLength) {
      return { valid: false, error: `Plugin name too long (max ${this.validationRules.maxNameLength})` };
    }

    if (!/^[a-z0-9-_]+$/i.test(plugin.name)) {
      return { valid: false, error: 'Plugin name can only contain alphanumeric characters, hyphens, and underscores' };
    }

    // Validate version
    if (!this.validationRules.versionPattern.test(plugin.version)) {
      return { valid: false, error: 'Invalid version format. Use semver (e.g., 1.0.0)' };
    }

    // Validate description length if present
    if (plugin.description && plugin.description.length > this.validationRules.maxDescriptionLength) {
      return { valid: false, error: `Description too long (max ${this.validationRules.maxDescriptionLength})` };
    }

    return { valid: true };
  }

  /**
   * Extract metadata from a plugin
   * @param {Object} plugin - Plugin object
   * @param {string} pluginPath - Plugin file path
   * @returns {Object} Plugin metadata
   */
  extractMetadata(plugin, pluginPath) {
    return {
      name: plugin.name,
      version: plugin.version,
      description: plugin.description || '',
      author: plugin.author || '',
      license: plugin.license || '',
      homepage: plugin.homepage || '',
      dependencies: plugin.dependencies || [],
      permissions: plugin.permissions || {},
      path: pluginPath,
      loadedAt: new Date().toISOString()
    };
  }

  /**
   * Check if all dependencies are satisfied
   * @param {string[]} dependencies - Required dependencies
   * @returns {Object} Dependency check result
   */
  checkDependencies(dependencies) {
    const missing = [];

    for (const dep of dependencies) {
      if (!this.plugins.has(dep)) {
        missing.push(dep);
      }
    }

    return {
      satisfied: missing.length === 0,
      missing
    };
  }

  /**
   * Find plugins that depend on a given plugin
   * @param {string} pluginName - Plugin name
   * @returns {string[]} List of dependent plugin names
   */
  findDependents(pluginName) {
    const dependents = [];

    for (const [name, metadata] of this.metadata) {
      if (metadata.dependencies && metadata.dependencies.includes(pluginName)) {
        dependents.push(name);
      }
    }

    return dependents;
  }

  /**
   * Check if a plugin is loaded
   * @param {string} name - Plugin name
   * @returns {boolean} True if loaded
   */
  isLoaded(name) {
    return this.plugins.has(name);
  }

  /**
   * Get the count of loaded plugins
   * @returns {number} Number of loaded plugins
   */
  getPluginCount() {
    return this.plugins.size;
  }

  /**
   * Cleanup all plugins
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanup() {
    console.log('[PluginLoader] Cleaning up all plugins');

    const results = {
      success: true,
      cleaned: [],
      errors: []
    };

    // Unload in reverse order (last loaded first)
    const pluginNames = Array.from(this.plugins.keys()).reverse();

    for (const name of pluginNames) {
      const result = await this.unloadPlugin(name);
      if (result.success) {
        results.cleaned.push(name);
      } else {
        results.errors.push({ name, error: result.error });
      }
    }

    console.log(`[PluginLoader] Cleanup complete: ${results.cleaned.length} plugins unloaded`);

    return results;
  }
}

module.exports = {
  PluginLoader,
  PLUGIN_STATE
};
