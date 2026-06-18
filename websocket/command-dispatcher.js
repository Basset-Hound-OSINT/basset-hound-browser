/**
 * Command Dispatcher Module
 *
 * Centralizes command routing logic, providing a clean abstraction layer between
 * the WebSocket message handler and individual command implementations.
 *
 * This module:
 * - Routes commands to their registered handlers
 * - Provides error recovery suggestions
 * - Encapsulates retry logic configuration
 * - Maintains command registry management
 *
 * Phase 2 Refactoring: Extracted from websocket/server.js lines 1546-9376
 * to improve modularity and separation of concerns.
 *
 * @module websocket/command-dispatcher
 */

const { isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, ERROR_RECOVERY_CONFIG } = require('./error-recovery');
const { generateRecoverySuggestion } = require('./ipc-utils');

/**
 * CommandDispatcher
 *
 * Routes command execution with built-in retry logic, error handling, and recovery suggestions.
 * This class serves as the routing abstraction layer for all WebSocket commands.
 *
 * Responsibilities:
 * 1. Route commands to appropriate handlers
 * 2. Apply retry logic for transient failures
 * 3. Generate helpful error recovery suggestions
 * 4. Validate command registration
 * 5. Track command metadata (timing, attempt count, etc.)
 *
 * Usage:
 *   const dispatcher = new CommandDispatcher(commandHandlers, logger);
 *   const result = await dispatcher.execute(command, params, options);
 */
class CommandDispatcher {
  /**
   * Initialize the command dispatcher
   *
   * @param {Object} commandHandlers - Map of command name -> handler function
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance for debug/error logging
   * @param {Object} options.profiler - Profiler instance for performance tracking
   * @param {Object} options.debugManager - Debug manager for WebSocket logging
   */
  constructor(commandHandlers, options = {}) {
    // Validate command handlers
    if (!commandHandlers || typeof commandHandlers !== 'object') {
      throw new Error('commandHandlers must be a non-null object');
    }

    this.commandHandlers = commandHandlers;
    this.logger = options.logger || console;
    this.profiler = options.profiler || null;
    this.debugManager = options.debugManager || null;

    // Command statistics
    this.stats = {
      totalExecuted: 0,
      successCount: 0,
      errorCount: 0,
      retriedCount: 0,
      averageRetries: 0
    };
  }

  /**
   * Execute a command with built-in retry logic
   *
   * This method:
   * 1. Validates command exists
   * 2. Applies retry logic for transient failures
   * 3. Returns standardized response format
   * 4. Provides recovery suggestions on error
   *
   * @param {string} command - Command name to execute
   * @param {Object} params - Command parameters (excluding command and id)
   * @param {Object} options - Execution options
   * @param {boolean} options.enableRetry - Whether to enable retry logic (default: true)
   * @param {number} options.maxRetries - Maximum retry attempts
   * @param {string} options.clientId - Client ID for logging
   * @param {string} options.commandId - Command ID for tracking
   * @returns {Promise<Object>} Standardized response object { success, result/error, ... }
   */
  async execute(command, params = {}, options = {}) {
    const {
      enableRetry = true,
      maxRetries = ERROR_RECOVERY_CONFIG.maxRetries,
      clientId = 'unknown',
      commandId = null,
      upgradeRequest = null,
      remoteAddress = null
    } = options;

    // Stats tracking
    this.stats.totalExecuted++;

    // Validate command exists
    if (!command || typeof command !== 'string') {
      this.stats.errorCount++;
      return {
        success: false,
        error: 'Command must be a non-empty string'
      };
    }

    const handler = this.commandHandlers[command];
    if (!handler) {
      this.stats.errorCount++;
      const recovery = generateRecoverySuggestion(command, new Error(`Unknown command: ${command}`));
      return {
        success: false,
        error: `Unknown command: ${command}`,
        recovery: {
          ...recovery,
          suggestion: `The command "${command}" is not recognized. Check the command name and try again.`,
          availableCommands: Object.keys(this.commandHandlers).slice(0, 20) // Return first 20 commands as hint
        },
        details: {
          registeredCommandCount: Object.keys(this.commandHandlers).length
        }
      };
    }

    // Determine if this command is retryable
    const canRetry = enableRetry && isRetryableCommand(command);

    let lastError = null;
    let attemptCount = 0;

    // Execute with retry loop
    while (attemptCount <= (canRetry ? maxRetries : 0)) {
      try {
        // Log command execution attempt
        if (attemptCount === 0) {
          this.logger.debug(`[CommandDispatcher] Executing command: ${command}`, {
            clientId,
            commandId,
            retryable: canRetry,
            maxRetries: canRetry ? maxRetries : 0
          });
        } else {
          this.logger.info(`[CommandDispatcher] Retrying command: ${command} (attempt ${attemptCount + 1}/${maxRetries + 1})`);
        }

        // Execute the command handler with context
        const context = {
          clientId,
          commandId,
          upgradeRequest,
          remoteAddress
        };
        const result = await handler(params, context);

        // Check for manager unavailable errors (non-throwing failures)
        if (!result.success && result.error && result.error.includes('not available')) {
          const managerName = result.error.replace(' not available', '').replace(' manager', ' Manager');
          const recovery = generateRecoverySuggestion(command, result.error, managerName);
          return {
            ...result,
            recovery
          };
        }

        // Success case
        this.stats.successCount++;

        // If we had to retry to succeed, include retry metadata
        if (attemptCount > 0 && result.success) {
          result.retriedCount = attemptCount;
          this.stats.retriedCount++;
          this.logger.info(`[CommandDispatcher] Command ${command} succeeded after ${attemptCount} retry(ies)`);
        }

        return result;

      } catch (error) {
        // Capture the error for potential retry or final error response
        lastError = error;
        attemptCount++;

        // Determine if we should retry
        if (canRetry && isRetryableError(error) && attemptCount <= maxRetries) {
          const delay = calculateRetryDelay(attemptCount - 1);
          this.logger.info(
            `[CommandDispatcher] Command ${command} failed (attempt ${attemptCount}/${maxRetries + 1}), ` +
            `retrying in ${delay}ms: ${error.message}`
          );
          await sleep(delay);
          continue;
        }

        // No more retries or non-retryable error - break and handle below
        break;
      }
    }

    // Command execution failed after all retries exhausted
    this.stats.errorCount++;

    const recovery = generateRecoverySuggestion(command, lastError);
    this.logger.error(
      `[CommandDispatcher] Command ${command} failed after ${attemptCount} attempt(s): ${lastError.message}`
    );

    return {
      success: false,
      error: lastError.message,
      attemptCount,
      recovery,
      details: {
        retryable: canRetry,
        maxRetriesAttempted: canRetry && attemptCount > 1,
        clientId,
        commandId
      }
    };
  }

  /**
   * Register a new command handler
   *
   * @param {string} name - Command name
   * @param {Function} handler - Async handler function
   * @throws {Error} If handler is not a function
   */
  registerCommand(name, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for command "${name}" must be a function`);
    }
    this.commandHandlers[name] = handler;
    this.logger.debug(`[CommandDispatcher] Registered command: ${name}`);
  }

  /**
   * Unregister a command handler
   *
   * @param {string} name - Command name to unregister
   * @returns {boolean} True if command was registered and removed
   */
  unregisterCommand(name) {
    if (this.commandHandlers[name]) {
      delete this.commandHandlers[name];
      this.logger.debug(`[CommandDispatcher] Unregistered command: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Get a command handler without executing it
   *
   * @param {string} name - Command name
   * @returns {Function|null} Handler function or null if not found
   */
  getCommand(name) {
    return this.commandHandlers[name] || null;
  }

  /**
   * Check if a command is registered
   *
   * @param {string} name - Command name
   * @returns {boolean} True if command exists
   */
  hasCommand(name) {
    return name in this.commandHandlers;
  }

  /**
   * Get list of all registered commands
   *
   * @returns {Array<string>} Array of command names
   */
  getCommandNames() {
    return Object.keys(this.commandHandlers);
  }

  /**
   * Get command count
   *
   * @returns {number} Number of registered commands
   */
  getCommandCount() {
    return Object.keys(this.commandHandlers).length;
  }

  /**
   * Get dispatcher statistics
   *
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalExecuted > 0
        ? ((this.stats.successCount / this.stats.totalExecuted) * 100).toFixed(2) + '%'
        : 'N/A',
      registeredCommandCount: this.getCommandCount()
    };
  }

  /**
   * Reset statistics counters
   *
   * Useful for per-session or per-test statistics isolation.
   */
  resetStats() {
    this.stats = {
      totalExecuted: 0,
      successCount: 0,
      errorCount: 0,
      retriedCount: 0,
      averageRetries: 0
    };
    this.logger.debug('[CommandDispatcher] Statistics reset');
  }
}

module.exports = {
  CommandDispatcher
};
