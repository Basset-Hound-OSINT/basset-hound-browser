/**
 * Basset Hound Browser - Automatic Recovery Handler
 * Handles unexpected disconnects and automatic state restoration
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 *
 * Provides:
 * - Disconnect/reconnect monitoring
 * - Automatic state restoration on reconnection
 * - Stale state detection and prevention
 * - Manual recovery trigger
 * - Recovery attempt logging and history
 */

const crypto = require('crypto');

/**
 * Automatic Recovery Handler
 * Manages session recovery after disconnects
 *
 * @class AutomaticRecoveryHandler
 */
class AutomaticRecoveryHandler {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.maxRecoveryAttempts = options.maxRecoveryAttempts || 3;
    this.reconnectionTimeout = options.reconnectionTimeout || 30000; // 30 seconds
    this.staleStateThreshold = options.staleStateThreshold || 7 * 24 * 3600 * 1000; // 7 days

    // Recovery tracking
    this.recoveryStatus = new Map(); // sessionId -> {lastDisconnect, attempts, success}
    this.pendingRecoveries = new Map(); // sessionId -> Promise
    this.reconnectionMonitors = new Map(); // sessionId -> timeoutId

    // Dependencies (set via initialization)
    this.stateRestore = null;
    this.profileStorageManager = null;
    this.sessionManager = null;
    this.wsServer = null;
  }

  /**
   * Initialize with dependencies
   * @param {BrowserStateRestore} stateRestore
   * @param {ProfileStateStorageManager} profileStorageManager
   * @param {SessionManager} sessionManager
   * @param {WebSocket} wsServer
   */
  initialize(stateRestore, profileStorageManager, sessionManager, wsServer) {
    this.stateRestore = stateRestore;
    this.profileStorageManager = profileStorageManager;
    this.sessionManager = sessionManager;
    this.wsServer = wsServer;
  }

  /**
   * Register recovery handler with session manager
   * @param {SessionManager} sessionManager
   * @param {WebSocket} wsServer
   * @returns {void}
   */
  registerWithSessionManager(sessionManager, wsServer) {
    this.sessionManager = sessionManager;
    this.wsServer = wsServer;

    // Hook into session lifecycle events
    if (sessionManager && sessionManager.on) {
      sessionManager.on('disconnect', (sessionId, reason) => {
        this.handleDisconnect(sessionId, reason).catch(err =>
          this.logger.error(`Disconnect handler failed: ${err.message}`)
        );
      });

      sessionManager.on('reconnect', (sessionId) => {
        this.handleReconnect(sessionId).catch(err =>
          this.logger.error(`Reconnect handler failed: ${err.message}`)
        );
      });
    }

    this.logger.info('Recovery handler registered with session manager');
  }

  /**
   * Handle unexpected disconnect
   * @param {string} sessionId
   * @param {Object} reason - {code, message}
   * @returns {Promise<void>}
   */
  async handleDisconnect(sessionId, reason = {}) {
    try {
      // Initialize recovery status for this session
      if (!this.recoveryStatus.has(sessionId)) {
        this.recoveryStatus.set(sessionId, {
          lastDisconnect: null,
          attempts: 0,
          success: false,
          history: []
        });
      }

      const status = this.recoveryStatus.get(sessionId);
      status.lastDisconnect = Date.now();
      status.history.push({
        timestamp: Date.now(),
        event: 'disconnect',
        reason: reason.message || 'unknown'
      });

      this.logger.warn(`Session ${sessionId} disconnected: ${reason.message || 'no reason'}`);

      // Set up reconnection monitor (timeout after 30 seconds)
      this.setReconnectionMonitor(sessionId);
    } catch (error) {
      this.logger.error(`Failed to handle disconnect: ${error.message}`);
    }
  }

  /**
   * Handle reconnection
   * @param {sessionId} sessionId
   * @returns {Promise<void>}
   */
  async handleReconnect(sessionId) {
    try {
      // Clear reconnection monitor
      if (this.reconnectionMonitors.has(sessionId)) {
        clearTimeout(this.reconnectionMonitors.get(sessionId));
        this.reconnectionMonitors.delete(sessionId);
      }

      // Get session info
      const session = this.sessionManager?.getSession?.(sessionId);
      if (!session) {
        this.logger.warn(`Session ${sessionId} reconnected but no session found`);
        return;
      }

      // Log reconnection
      const status = this.recoveryStatus.get(sessionId);
      if (status) {
        status.history.push({
          timestamp: Date.now(),
          event: 'reconnect',
          duration: Date.now() - (status.lastDisconnect || 0)
        });
      }

      this.logger.info(`Session ${sessionId} reconnected`);

      // Attempt auto-restore if available
      if (session.profileId) {
        try {
          const result = await this.attemptAutoRestore(sessionId, session.profileId);
          if (result.success) {
            this.logger.info(`Auto-restored session ${sessionId}`);
          }
        } catch (error) {
          this.logger.warn(`Auto-restore failed, user can trigger manual recovery: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle reconnect: ${error.message}`);
    }
  }

  /**
   * Attempt automatic state restoration
   * @param {string} sessionId
   * @param {string} profileId
   * @returns {Promise<Object>} - {success, restored, issues}
   */
  async attemptAutoRestore(sessionId, profileId) {
    if (!this.stateRestore || !this.profileStorageManager) {
      throw new Error('Recovery handler not fully initialized');
    }

    try {
      const status = this.recoveryStatus.get(sessionId);
      if (!status) {
        throw new Error('No recovery status found');
      }

      // Check attempt limit
      if (status.attempts >= this.maxRecoveryAttempts) {
        throw new Error(`Max recovery attempts (${this.maxRecoveryAttempts}) exceeded`);
      }

      status.attempts++;

      // Load saved state
      let savedState;
      try {
        const loaded = await this.profileStorageManager.loadSessionState(profileId);
        savedState = loaded.state;
      } catch (error) {
        throw new Error(`No saved state available: ${error.message}`);
      }

      // Check if state is stale
      const staleCheck = this.detectStaleState(savedState);
      if (staleCheck.stale) {
        throw new Error(`State is stale: ${staleCheck.reason}`);
      }

      // Get the WebContents object
      const webContents = this.getWebContentsForSession(sessionId);
      if (!webContents) {
        throw new Error('WebContents not available for restoration');
      }

      // Attempt restoration
      const result = await this.stateRestore.restoreState(webContents, savedState, {
        partial: true,
        validate: true
      });

      if (result.success) {
        status.success = true;
        status.history.push({
          timestamp: Date.now(),
          event: 'restore_success',
          restored: result.restored
        });
      }

      return result;
    } catch (error) {
      const status = this.recoveryStatus.get(sessionId);
      if (status) {
        status.history.push({
          timestamp: Date.now(),
          event: 'restore_failed',
          reason: error.message
        });
      }

      this.logger.warn(`Auto-restore attempt ${status?.attempts || 0} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect if state is stale
   * @param {Object} state
   * @returns {Object} - {stale: bool, reason: string, confidence: 0-1}
   */
  detectStaleState(state) {
    if (!state || !state.capturedAt) {
      return { stale: true, reason: 'No capture timestamp', confidence: 1.0 };
    }

    const capturedAt = new Date(state.capturedAt).getTime();
    const now = Date.now();
    const age = now - capturedAt;

    // Very old state (>7 days)
    if (age > this.staleStateThreshold) {
      const daysOld = Math.round(age / (24 * 3600 * 1000));
      return {
        stale: true,
        reason: `State is ${daysOld} days old`,
        confidence: 1.0
      };
    }

    // Expired cookies
    const expiredCookies = (state.cookies || []).filter(c => {
      if (!c.expires) return false;
      return new Date(c.expires).getTime() < now;
    });

    if (expiredCookies.length > 0) {
      const ratio = (expiredCookies.length / Math.max(state.cookies.length, 1)) * 100;
      if (ratio > 50) {
        return {
          stale: true,
          reason: `${Math.round(ratio)}% of cookies are expired`,
          confidence: 0.8
        };
      }
    }

    return { stale: false, reason: 'State is fresh', confidence: 1.0 };
  }

  /**
   * Manual recovery trigger (user-initiated)
   * @param {string} sessionId
   * @param {string} profileId
   * @param {string} stateId - Optional, uses most recent if omitted
   * @returns {Promise<Object>} - Recovery result
   */
  async triggerManualRecovery(sessionId, profileId, stateId = null) {
    if (!this.stateRestore || !this.profileStorageManager) {
      throw new Error('Recovery handler not fully initialized');
    }

    try {
      // Load state
      let savedState;
      if (stateId) {
        try {
          const loaded = await this.profileStorageManager.loadSessionState(profileId, stateId);
          savedState = loaded.state;
        } catch (error) {
          throw new Error(`State not found: ${stateId}`);
        }
      } else {
        try {
          const loaded = await this.profileStorageManager.loadSessionState(profileId);
          savedState = loaded.state;
        } catch (error) {
          throw new Error(`No saved state available for profile: ${profileId}`);
        }
      }

      // Get WebContents
      const webContents = this.getWebContentsForSession(sessionId);
      if (!webContents) {
        throw new Error('WebContents not available');
      }

      // Perform restoration
      const result = await this.stateRestore.restoreState(webContents, savedState, {
        partial: true,
        validate: true
      });

      // Log result
      const status = this.recoveryStatus.get(sessionId);
      if (status) {
        status.history.push({
          timestamp: Date.now(),
          event: 'manual_recovery',
          result: result.success ? 'success' : 'partial'
        });
      }

      return {
        success: result.success,
        restored: result.restored,
        warnings: result.warnings || []
      };
    } catch (error) {
      this.logger.error(`Manual recovery failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get recovery status
   * @param {string} sessionId
   * @returns {Object} - {lastDisconnect, recoveryAttempts, success, history}
   */
  getRecoveryStatus(sessionId) {
    const status = this.recoveryStatus.get(sessionId);

    if (!status) {
      return {
        lastDisconnect: null,
        recoveryAttempts: 0,
        success: false,
        history: []
      };
    }

    return {
      lastDisconnect: status.lastDisconnect ? new Date(status.lastDisconnect).toISOString() : null,
      recoveryAttempts: status.attempts,
      success: status.success,
      history: status.history
    };
  }

  /**
   * Set up reconnection monitor (timeout after N seconds)
   * @private
   * @param {string} sessionId
   */
  setReconnectionMonitor(sessionId) {
    // Clear existing monitor if any
    if (this.reconnectionMonitors.has(sessionId)) {
      clearTimeout(this.reconnectionMonitors.get(sessionId));
    }

    // Set new monitor timeout
    const timeoutId = setTimeout(() => {
      const status = this.recoveryStatus.get(sessionId);
      if (status) {
        status.history.push({
          timestamp: Date.now(),
          event: 'reconnection_timeout',
          duration: this.reconnectionTimeout
        });
      }

      this.reconnectionMonitors.delete(sessionId);
      this.logger.warn(`Reconnection timeout for session ${sessionId} after ${this.reconnectionTimeout}ms`);
    }, this.reconnectionTimeout);

    this.reconnectionMonitors.set(sessionId, timeoutId);
  }

  /**
   * Get WebContents for session
   * @private
   * @param {string} sessionId
   * @returns {WebContents|null}
   */
  getWebContentsForSession(sessionId) {
    if (!this.sessionManager) return null;

    try {
      const session = this.sessionManager.getSession(sessionId);
      return session?.webContents || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Clear recovery history for session
   * @param {string} sessionId
   */
  clearRecoveryHistory(sessionId) {
    const status = this.recoveryStatus.get(sessionId);
    if (status) {
      status.history = [];
      status.attempts = 0;
      status.lastDisconnect = null;
    }
  }

  /**
   * Clear all recovery status
   */
  clearAllRecoveryStatus() {
    this.recoveryStatus.clear();
    this.reconnectionMonitors.forEach(timeoutId => clearTimeout(timeoutId));
    this.reconnectionMonitors.clear();
  }
}

module.exports = AutomaticRecoveryHandler;
