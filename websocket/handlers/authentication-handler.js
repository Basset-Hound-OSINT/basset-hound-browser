/**
 * Authentication Handler Module
 * Responsibility: Handle all authentication-related WebSocket commands
 * - authenticate: Initial authentication
 * - check_auth: Verify authentication status
 *
 * This module is part of WebSocket Server refactoring to reduce monolithic complexity
 * Original code: websocket/server.js (lines 1618-1650)
 */

const { ErrorFormatter } = require('../error-formatter');

class AuthenticationHandler {
  constructor(server) {
    this.server = server;
    this.logger = server.logger;
  }

  /**
   * Register authentication command handlers
   * Called once during server initialization
   */
  register(commandDispatcher) {
    commandDispatcher.register('authenticate', this.handleAuthenticate.bind(this));
    commandDispatcher.register('check_auth', this.handleCheckAuth.bind(this));
  }

  /**
   * Handle authenticate command
   * @param {Object} ws - WebSocket connection
   * @param {Object} data - Command data
   * @returns {Object} Authentication result
   */
  async handleAuthenticate(ws, data) {
    try {
      if (!data.token && !data.password) {
        return ErrorFormatter.validationError('authenticate', data.id, 'token or password required');
      }

      const authResult = this.server.handleAuthenticate(ws, data);
      return {
        id: data.id,
        command: 'authenticate',
        ...authResult
      };
    } catch (error) {
      this.logger.error('Authentication failed', error);
      return ErrorFormatter.authenticationFailedError('authenticate', data.id);
    }
  }

  /**
   * Handle check_auth command
   * @param {Object} ws - WebSocket connection
   * @param {Object} data - Command data
   * @returns {Object} Authentication status
   */
  async handleCheckAuth(ws, data) {
    return {
      id: data.id,
      command: 'check_auth',
      success: true,
      authenticated: ws.isAuthenticated,
      clientId: ws.clientId,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { AuthenticationHandler };
