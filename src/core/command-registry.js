/**
 * Command Registry
 *
 * Centralized registry for WebSocket command handlers.
 * Replaces hardcoded command handlers in WebSocket server.
 *
 * Features:
 * - Dynamic command registration
 * - Command lookup by name
 * - Metadata tracking (retryable, etc.)
 * - Batch registration
 * - Command validation
 * - Discovery/listing
 *
 * Usage:
 * ```javascript
 * const registry = new CommandRegistry();
 *
 * // Register single command
 * registry.register('navigate', navigateHandler);
 *
 * // Register multiple commands
 * registry.registerBatch({
 *   'navigate': navigateHandler,
 *   'click': clickHandler,
 *   'screenshot': screenshotHandler
 * });
 *
 * // Get command handler
 * const handler = registry.get('navigate');
 *
 * // Check if command exists
 * if (registry.has('navigate')) {
 *   await handler.handle(params);
 * }
 *
 * // List all commands
 * const commands = registry.listAll();
 * ```
 *
 * @module core/command-registry
 */

const { createLogger } = require('../logging');
const { ValidationError } = require('./errors');

class CommandRegistry {
  constructor(options = {}) {
    this.logger = createLogger('CommandRegistry');
    this.handlers = new Map();
    this.metadata = new Map();
    this.aliases = new Map();
    this.options = options;
  }

  /**
   * Register a single command handler
   * @param {string} name - Command name
   * @param {CommandHandler|Function} handler - Handler instance or async function
   * @param {Object} metadata - Command metadata (retryable, timeout, etc.)
   * @throws {ValidationError} If handler is invalid
   */
  register(name, handler, metadata = {}) {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Command name must be a non-empty string');
    }

    if (!handler || (typeof handler !== 'function' && !this._isValidHandler(handler))) {
      throw new ValidationError(`Invalid handler for command: ${name}`);
    }

    // Normalize handler to async function
    const normalizedHandler = this._normalizeHandler(handler);

    this.handlers.set(name.toLowerCase(), normalizedHandler);
    this.metadata.set(name.toLowerCase(), {
      name,
      registered: new Date(),
      ...metadata
    });

    this.logger.debug(`Registered command: ${name}`);

    return this;
  }

  /**
   * Register multiple commands at once
   * @param {Object} commands - Map of command names to handlers
   * @param {Object} metadata - Optional default metadata for all commands
   */
  registerBatch(commands, metadata = {}) {
    if (!commands || typeof commands !== 'object') {
      throw new ValidationError('Commands must be an object');
    }

    let registered = 0;
    const failed = [];

    for (const [name, handler] of Object.entries(commands)) {
      try {
        this.register(name, handler, metadata);
        registered++;
      } catch (error) {
        this.logger.warn(`Failed to register command: ${name}`, { error: error.message });
        failed.push({ name, error: error.message });
      }
    }

    this.logger.info(`Batch registration complete: ${registered} registered, ${failed.length} failed`);

    return { registered, failed };
  }

  /**
   * Get command handler by name
   * @param {string} name - Command name
   * @returns {Function|null} Handler function or null if not found
   */
  get(name) {
    if (!name) return null;
    return this.handlers.get(name.toLowerCase()) || null;
  }

  /**
   * Check if command is registered
   * @param {string} name - Command name
   * @returns {boolean}
   */
  has(name) {
    if (!name) return false;
    return this.handlers.has(name.toLowerCase());
  }

  /**
   * Execute command by name
   * @param {string} name - Command name
   * @param {Object} params - Command parameters
   * @returns {Promise<Object>} Command result
   */
  async execute(name, params = {}) {
    const handler = this.get(name);

    if (!handler) {
      throw new ValidationError(`Unknown command: ${name}`);
    }

    try {
      return await handler(params);
    } catch (error) {
      this.logger.error(`Command execution failed: ${name}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get metadata for command
   * @param {string} name - Command name
   * @returns {Object|null} Metadata or null if not found
   */
  getMetadata(name) {
    if (!name) return null;
    return this.metadata.get(name.toLowerCase()) || null;
  }

  /**
   * Get list of all registered commands
   * @returns {Array<Object>} Command metadata array
   */
  listAll() {
    return Array.from(this.metadata.values());
  }

  /**
   * Get command names
   * @returns {Array<string>} Array of command names
   */
  getCommandNames() {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get count of registered commands
   * @returns {number}
   */
  getCount() {
    return this.handlers.size;
  }

  /**
   * Register command alias
   * @param {string} alias - Alias name
   * @param {string} originalName - Original command name
   */
  registerAlias(alias, originalName) {
    if (!this.has(originalName)) {
      throw new ValidationError(`Original command not found: ${originalName}`);
    }

    this.aliases.set(alias.toLowerCase(), originalName.toLowerCase());
    this.logger.debug(`Registered alias: ${alias} -> ${originalName}`);

    return this;
  }

  /**
   * Unregister command
   * @param {string} name - Command name
   * @returns {boolean} True if command was removed
   */
  unregister(name) {
    if (!name) return false;

    const nameKey = name.toLowerCase();
    const removed = this.handlers.delete(nameKey) || this.metadata.delete(nameKey);

    if (removed) {
      this.logger.debug(`Unregistered command: ${name}`);
    }

    return removed;
  }

  /**
   * Clear all registrations
   */
  clear() {
    this.handlers.clear();
    this.metadata.clear();
    this.aliases.clear();
    this.logger.debug('Cleared all command registrations');
  }

  /**
   * Validate handler object
   */
  _isValidHandler(handler) {
    return handler && typeof handler.handle === 'function';
  }

  /**
   * Normalize handler to async function
   */
  _normalizeHandler(handler) {
    // If it's already a function, wrap it to match CommandHandler interface
    if (typeof handler === 'function') {
      return async (params) => {
        try {
          return await handler(params);
        } catch (error) {
          return {
            success: false,
            error: error.message,
            code: error.code || 'COMMAND_ERROR'
          };
        }
      };
    }

    // If it's a CommandHandler instance with handle() method
    if (handler && typeof handler.handle === 'function') {
      return async (params) => {
        return await handler.handle(params);
      };
    }

    throw new ValidationError('Handler must be function or have handle() method');
  }

  /**
   * Get command statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const allMetadata = this.listAll();

    return {
      totalCommands: this.handlers.size,
      totalAliases: this.aliases.size,
      retryableCount: allMetadata.filter(m => m.retryable !== false).length,
      registeredAt: allMetadata.map(m => m.registered),
      commands: this.getCommandNames()
    };
  }

  /**
   * Export registry as JSON (for documentation/discovery)
   * @returns {Object} Registry export
   */
  export() {
    const commands = {};

    for (const [name, metadata] of this.metadata.entries()) {
      commands[name] = {
        ...metadata,
        registered: metadata.registered?.toISOString()
      };
    }

    return {
      version: '1.0.0',
      commandCount: this.handlers.size,
      aliasCount: this.aliases.size,
      commands,
      aliases: Object.fromEntries(this.aliases)
    };
  }
}

module.exports = CommandRegistry;
