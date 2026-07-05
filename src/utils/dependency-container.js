/**
 * Dependency Injection Container
 * Provides centralized dependency management with factory pattern,
 * singleton/transient scoping, and lazy initialization
 *
 * Features:
 * - Factory pattern for creating instances
 * - Singleton scope (single instance per app lifecycle)
 * - Transient scope (new instance per request)
 * - Lazy initialization (create on first use)
 * - Dependency resolution
 * - Decorator pattern support
 *
 * Benefits:
 * - Loose coupling between modules
 * - Easier unit testing (mock dependencies)
 * - Easier to swap implementations
 * - Clear dependency declarations
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 */

class ServiceDefinition {
  constructor(name, factory, scope = 'singleton', dependencies = []) {
    this.name = name;
    this.factory = factory;
    this.scope = scope; // 'singleton' or 'transient'
    this.dependencies = dependencies;
    this.instance = null;
  }

  /**
   * Create or retrieve instance based on scope
   */
  getInstance(container) {
    if (this.scope === 'singleton') {
      if (!this.instance) {
        this.instance = this.factory(container);
      }
      return this.instance;
    }

    // Transient - always create new
    return this.factory(container);
  }

  /**
   * Reset singleton instance
   */
  reset() {
    this.instance = null;
  }
}

class DependencyContainer {
  constructor(options = {}) {
    this.services = new Map();
    this.factories = new Map();
    this.options = {
      autoWire: options.autoWire !== false,
      throwOnMissing: options.throwOnMissing !== false,
      ...options
    };

    this.stats = {
      registrations: 0,
      instantiations: 0,
      singletonCreations: 0,
      transientCreations: 0
    };
  }

  /**
   * Register a service factory
   * @param {string} name - Service name
   * @param {Function} factory - Factory function(container) => instance
   * @param {Object} options - Configuration options
   * @param {string} options.scope - 'singleton' or 'transient' (default: 'singleton')
   * @param {string[]} options.dependencies - Array of dependency names
   * @returns {void}
   */
  register(name, factory, options = {}) {
    const scope = options.scope || 'singleton';
    const dependencies = options.dependencies || [];

    if (typeof factory !== 'function') {
      throw new TypeError(`Factory for ${name} must be a function`);
    }

    const definition = new ServiceDefinition(name, factory, scope, dependencies);
    this.services.set(name, definition);
    this.stats.registrations++;
  }

  /**
   * Register an instance (singleton convenience method)
   * @param {string} name - Service name
   * @param {*} instance - The instance
   * @returns {void}
   */
  registerInstance(name, instance) {
    this.register(name, () => instance, { scope: 'singleton' });
  }

  /**
   * Register a class constructor
   * Factory will call: new ClassConstructor(container, ...deps)
   * @param {string} name - Service name
   * @param {Function} ClassConstructor - Class to instantiate
   * @param {Object} options - Configuration options
   * @returns {void}
   */
  registerClass(name, ClassConstructor, options = {}) {
    const factory = (container) => {
      const deps = (options.dependencies || []).map(depName => container.get(depName));
      return new ClassConstructor(container, ...deps);
    };

    this.register(name, factory, options);
  }

  /**
   * Get a service instance
   * @param {string} name - Service name
   * @returns {*} Service instance
   * @throws {Error} If service not found and throwOnMissing is true
   */
  get(name) {
    const definition = this.services.get(name);

    if (!definition) {
      if (this.options.throwOnMissing) {
        throw new Error(`Service '${name}' is not registered in container`);
      }
      return null;
    }

    this.stats.instantiations++;

    if (definition.scope === 'singleton') {
      this.stats.singletonCreations++;
    } else {
      this.stats.transientCreations++;
    }

    return definition.getInstance(this);
  }

  /**
   * Check if service is registered
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   * @returns {string[]}
   */
  getServiceNames() {
    return Array.from(this.services.keys());
  }

  /**
   * Get service definition (for introspection)
   * @param {string} name - Service name
   * @returns {ServiceDefinition|null}
   */
  getDefinition(name) {
    return this.services.get(name) || null;
  }

  /**
   * Remove a service registration
   * @param {string} name - Service name
   * @returns {boolean} True if service was registered
   */
  remove(name) {
    return this.services.delete(name);
  }

  /**
   * Reset all singleton instances
   * Used for testing or reinitialization
   */
  reset() {
    for (const definition of this.services.values()) {
      definition.reset();
    }
  }

  /**
   * Reset specific service singleton
   * @param {string} name - Service name
   */
  resetService(name) {
    const definition = this.services.get(name);
    if (definition) {
      definition.reset();
    }
  }

  /**
   * Clear all registrations
   */
  clear() {
    this.services.clear();
    this.reset();
  }

  /**
   * Create a child container (copy of current registrations)
   * Useful for testing isolated contexts
   * @returns {DependencyContainer}
   */
  createChild() {
    const child = new DependencyContainer(this.options);

    // Copy all definitions to child
    for (const [name, definition] of this.services.entries()) {
      child.services.set(name, new ServiceDefinition(
        definition.name,
        definition.factory,
        definition.scope,
        definition.dependencies
      ));
    }

    return child;
  }

  /**
   * Get dependency stats
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalServices: this.services.size,
      singletonServices: Array.from(this.services.values()).filter(s => s.scope === 'singleton').length,
      transientServices: Array.from(this.services.values()).filter(s => s.scope === 'transient').length
    };
  }

  /**
   * Get detailed service info
   * @returns {Object[]} Array of service info objects
   */
  getServiceInfo() {
    const info = [];

    for (const [name, definition] of this.services.entries()) {
      info.push({
        name,
        scope: definition.scope,
        dependencies: definition.dependencies,
        hasInstance: definition.instance !== null
      });
    }

    return info;
  }

  /**
   * Verify all dependencies are resolvable
   * @returns {Object} Validation result
   */
  validateDependencies() {
    const errors = [];
    const warnings = [];

    for (const [name, definition] of this.services.entries()) {
      for (const depName of definition.dependencies) {
        if (!this.has(depName)) {
          errors.push(`Service '${name}' depends on unregistered '${depName}'`);
        }
      }

      // Check for circular dependencies
      if (this._hasCircularDependency(name, new Set())) {
        errors.push(`Service '${name}' has circular dependencies`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      servicesChecked: this.services.size
    };
  }

  /**
   * Detect circular dependencies
   * @private
   */
  _hasCircularDependency(name, visited) {
    if (visited.has(name)) {
      return true;
    }

    const definition = this.services.get(name);
    if (!definition) {
      return false;
    }

    visited.add(name);

    for (const depName of definition.dependencies) {
      if (this._hasCircularDependency(depName, new Set(visited))) {
        return true;
      }
    }

    return false;
  }
}

// Global singleton instance
let globalContainer = null;

/**
 * Get the global dependency container
 * @returns {DependencyContainer}
 */
function getGlobalContainer() {
  if (!globalContainer) {
    globalContainer = new DependencyContainer();
  }
  return globalContainer;
}

/**
 * Set the global dependency container (mainly for testing)
 * @param {DependencyContainer} container
 */
function setGlobalContainer(container) {
  globalContainer = container;
}

/**
 * Reset the global container (for testing)
 */
function resetGlobalContainer() {
  globalContainer = null;
}

module.exports = {
  DependencyContainer,
  ServiceDefinition,
  getGlobalContainer,
  setGlobalContainer,
  resetGlobalContainer
};
