/**
 * WebSocket Session Persistence Commands
 *
 * Provides the following WebSocket commands:
 * - save_session_state: Capture and persist complete session state
 * - restore_session_state: Restore previously saved session state
 * - list_saved_sessions: List all available session checkpoints
 * - delete_session_state: Delete a saved session checkpoint
 * - verify_session_state: Verify state integrity
 * - get_session_metadata: Get metadata for a session
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const { BrowserStateCapture } = require('../../src/sessions/state-capture');
const { BrowserStateRestore } = require('../../src/sessions/state-restore');

/**
 * Session State Manager - Tracks saved sessions in memory
 * In production, use persistent storage (SQLite, Redis, etc.)
 */
class SessionStateManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> {state, metadata, savedAt}
    this.sessionSequence = 0;
  }

  saveSession(profileId, state, options = {}) {
    const sessionId = `session-${profileId}-${++this.sessionSequence}-${Date.now()}`;
    this.sessions.set(sessionId, {
      profileId,
      state,
      metadata: {
        savedAt: new Date().toISOString(),
        sizeBytes: JSON.stringify(state).length,
        compressed: state.metadata?.compressed || false,
        compressionRatio: state.metadata?.compressionRatio || 0,
        url: state.url,
        title: state.title,
        ...options
      }
    });
    return sessionId;
  }

  restoreSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      return null;
    }
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  listSessions(profileId = null) {
    const sessions = Array.from(this.sessions.values());
    if (profileId) {
      return sessions.filter(s => s.profileId === profileId);
    }
    return sessions;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }
}

// Global session state manager (singleton)
const sessionStateManager = new SessionStateManager();

/**
 * Register session persistence command handlers
 * @param {Object} commandHandlers - Command handlers object
 * @param {Object} mainWindow - Electron mainWindow for state capture
 */
function registerSessionPersistenceCommands(commandHandlers, mainWindow) {
  /**
   * Command: save_session_state
   * Capture and persist complete browser session state
   *
   * Parameters:
   *   - profileId (string, optional): Profile identifier
   *   - includeDOM (boolean, optional): Include DOM state (default true)
   *   - compress (boolean, optional): Compress state (default true)
   *   - metadata (object, optional): Custom metadata
   *
   * Returns: {success, sessionId, compressed, compressionRatio, sizeBytes, savedAt}
   */
  commandHandlers.save_session_state = async (params) => {
    try {
      const {
        profileId = 'default',
        includeDOM = true,
        compress = true,
        metadata = {}
      } = params;

      if (!mainWindow || !mainWindow.webContents) {
        return { success: false, error: 'Main window not available' };
      }

      const captureOptions = {
        profileId,
        includeDOM,
        compressionEnabled: compress,
        logger: console
      };

      const stateCapture = new BrowserStateCapture(captureOptions);
      const state = await stateCapture.captureState(
        mainWindow.webContents,
        { profileId, includeDOM }
      );

      const sessionId = sessionStateManager.saveSession(profileId, state, metadata);

      return {
        success: true,
        sessionId,
        compressed: state.metadata?.compressed || false,
        compressionRatio: parseFloat(state.metadata?.compressionRatio || 0),
        sizeBytes: state.metadata?.sizeBytes || 0,
        savedAt: state.capturedAt,
        url: state.url,
        title: state.title
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: restore_session_state
   * Restore previously saved session state
   *
   * Parameters:
   *   - sessionId (string, required): Session ID to restore
   *   - validateFirst (boolean, optional): Validate before restore (default true)
   *   - skipDOM (boolean, optional): Skip DOM restoration (default false)
   *
   * Returns: {success, restored{cookies, storage_items, dom_elements}, failed{}, warnings[], restoreTime}
   */
  commandHandlers.restore_session_state = async (params) => {
    try {
      const { sessionId, validateFirst = true, skipDOM = false } = params;

      if (!sessionId) {
        return { success: false, error: 'Session ID is required' };
      }

      if (!mainWindow || !mainWindow.webContents) {
        return { success: false, error: 'Main window not available' };
      }

      const sessionData = sessionStateManager.restoreSession(sessionId);
      if (!sessionData) {
        return { success: false, error: `Session not found: ${sessionId}` };
      }

      const restoreStartTime = Date.now();

      // Validate state if requested
      if (validateFirst) {
        const validation = stateCapture.validateState(sessionData.state);
        if (!validation.valid) {
          return {
            success: false,
            error: 'State validation failed',
            issues: validation.issues || [],
            severity: validation.severity
          };
        }
      }

      const restoreOptions = {
        skipDOM,
        logger: console
      };

      const stateRestore = new BrowserStateRestore(restoreOptions);
      const result = await stateRestore.restoreState(
        mainWindow.webContents,
        sessionData.state,
        restoreOptions
      );

      const restoreTime = Date.now() - restoreStartTime;

      return {
        success: result.success || true,
        restored: result.restored || {},
        failed: result.failed || {},
        warnings: result.warnings || [],
        errors: result.errors || [],
        restoreTime,
        sessionId,
        url: sessionData.state.url
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: list_saved_sessions
   * List all available saved session checkpoints
   *
   * Parameters:
   *   - profileId (string, optional): Filter by profile ID
   *   - limit (number, optional): Maximum sessions to return (default 50)
   *   - offset (number, optional): Pagination offset (default 0)
   *
   * Returns: {success, sessions[], total, limit, offset}
   */
  commandHandlers.list_saved_sessions = async (params) => {
    try {
      const { profileId = null, limit = 50, offset = 0 } = params;

      const allSessions = sessionStateManager.listSessions(profileId);
      const total = allSessions.length;

      // Sort by saved time (newest first)
      const sorted = allSessions
        .sort((a, b) => new Date(b.metadata.savedAt) - new Date(a.metadata.savedAt))
        .slice(offset, offset + limit)
        .map((session, idx) => {
          const sessionId = Array.from(sessionStateManager.sessions.entries())[idx]?.[0];
          return {
            sessionId,
            profileId: session.profileId,
            url: session.metadata.url,
            title: session.metadata.title,
            savedAt: session.metadata.savedAt,
            sizeBytes: session.metadata.sizeBytes,
            compressed: session.metadata.compressed,
            compressionRatio: session.metadata.compressionRatio
          };
        });

      return {
        success: true,
        sessions: sorted,
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: delete_session_state
   * Delete a saved session checkpoint
   *
   * Parameters:
   *   - sessionId (string, required): Session ID to delete
   *
   * Returns: {success, message, deletedSessionId}
   */
  commandHandlers.delete_session_state = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return { success: false, error: 'Session ID is required' };
      }

      const deleted = sessionStateManager.deleteSession(sessionId);

      if (!deleted) {
        return { success: false, error: `Session not found: ${sessionId}` };
      }

      return {
        success: true,
        message: `Session deleted: ${sessionId}`,
        deletedSessionId: sessionId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: verify_session_state
   * Verify integrity of a saved session state
   *
   * Parameters:
   *   - sessionId (string, required): Session ID to verify
   *
   * Returns: {success, valid, issues[], severity, warning}
   */
  commandHandlers.verify_session_state = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return { success: false, error: 'Session ID is required' };
      }

      const sessionData = sessionStateManager.restoreSession(sessionId);
      if (!sessionData) {
        return { success: false, error: `Session not found: ${sessionId}` };
      }

      const stateCapture = new BrowserStateCapture();
      const validation = stateCapture.validateState(sessionData.state);

      return {
        success: true,
        valid: validation.valid,
        issues: validation.issues || [],
        severity: validation.severity || 'none',
        warning: validation.warning,
        sessionId,
        checked: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: get_session_metadata
   * Get metadata for a saved session
   *
   * Parameters:
   *   - sessionId (string, required): Session ID
   *
   * Returns: {success, metadata{}, state{url, title, cookies, storage}}
   */
  commandHandlers.get_session_metadata = async (params) => {
    try {
      const { sessionId } = params;

      if (!sessionId) {
        return { success: false, error: 'Session ID is required' };
      }

      const sessionData = sessionStateManager.restoreSession(sessionId);
      if (!sessionData) {
        return { success: false, error: `Session not found: ${sessionId}` };
      }

      return {
        success: true,
        metadata: sessionData.metadata,
        state: {
          url: sessionData.state.url,
          title: sessionData.state.title,
          cookies: sessionData.state.cookies?.length || 0,
          localStorage: Object.keys(sessionData.state.localStorage || {}).length,
          sessionStorage: Object.keys(sessionData.state.sessionStorage || {}).length,
          capturedAt: sessionData.state.capturedAt,
          profileId: sessionData.state.profileId
        },
        sessionId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };
}

module.exports = {
  registerSessionPersistenceCommands,
  SessionStateManager
};
