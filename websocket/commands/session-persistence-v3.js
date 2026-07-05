/**
 * Basset Hound Browser - WebSocket Session Persistence Commands (v3)
 * 6 new commands for advanced session state management
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 *
 * Commands:
 * 1. save_session_state - Capture and save current browser state
 * 2. restore_session_state - Restore previously saved state
 * 3. list_saved_sessions - List all saved states for a profile
 * 4. delete_session_state - Delete a specific saved state
 * 5. verify_session_state - Validate a saved state
 * 6. get_session_metadata - Get metadata about a saved state
 */

const BrowserStateCapture = require('../../src/sessions/state-capture');
const BrowserStateRestore = require('../../src/sessions/state-restore');
const ProfileStateStorageManager = require('../../src/sessions/profile-storage-manager');
const AutomaticRecoveryHandler = require('../../src/sessions/recovery-handler');

/**
 * Register all session persistence commands with WebSocket server
 * @param {WebSocket.Server} wsServer - WebSocket server instance
 * @param {BrowserWindow} mainWindow - Electron main window
 * @param {SessionManager} sessionManager - Session manager instance
 * @param {SessionStorage} sessionStorage - Session storage instance
 * @param {Logger} logger - Logger instance
 */
function registerSessionPersistenceCommands(wsServer, mainWindow, sessionManager, sessionStorage, logger) {
  // Initialize command handlers with dependencies
  const stateCapture = new BrowserStateCapture({ logger });
  const stateRestore = new BrowserStateRestore({ logger });
  const profileStorageManager = new ProfileStateStorageManager({
    sessionStorage,
    logger
  });
  const recoveryHandler = new AutomaticRecoveryHandler({ logger });

  // Register handler context
  const handlerContext = {
    wsServer,
    mainWindow,
    sessionManager,
    sessionStorage,
    stateCapture,
    stateRestore,
    profileStorageManager,
    recoveryHandler,
    logger
  };

  // Command 1: save_session_state
  wsServer.registerCommand('save_session_state', async (params, ws) => {
    return await handleSaveSessionState.call(handlerContext, params, ws);
  });

  // Command 2: restore_session_state
  wsServer.registerCommand('restore_session_state', async (params, ws) => {
    return await handleRestoreSessionState.call(handlerContext, params, ws);
  });

  // Command 3: list_saved_sessions
  wsServer.registerCommand('list_saved_sessions', async (params, ws) => {
    return await handleListSavedSessions.call(handlerContext, params, ws);
  });

  // Command 4: delete_session_state
  wsServer.registerCommand('delete_session_state', async (params, ws) => {
    return await handleDeleteSessionState.call(handlerContext, params, ws);
  });

  // Command 5: verify_session_state
  wsServer.registerCommand('verify_session_state', async (params, ws) => {
    return await handleVerifySessionState.call(handlerContext, params, ws);
  });

  // Command 6: get_session_metadata
  wsServer.registerCommand('get_session_metadata', async (params, ws) => {
    return await handleGetSessionMetadata.call(handlerContext, params, ws);
  });

  logger.info('Registered 6 session persistence commands');
}

/**
 * Handler 1: save_session_state
 * Captures current browser state and saves it for profile
 */
async function handleSaveSessionState(params, ws) {
  try {
    const { profile_id, include_dom = true, include_shadow_dom = false, description, tags } = params;

    if (!profile_id) {
      throw new Error('profile_id is required');
    }

    // Capture browser state
    const state = await this.stateCapture.captureState(this.mainWindow.webContents, {
      profileId: profile_id,
      includeDOM: include_dom,
      includeShadowDOM: include_shadow_dom
    });

    // Validate captured state
    const validation = this.stateCapture.validateState(state);
    if (!validation.valid) {
      this.logger.warn(`State validation warnings: ${validation.warnings.join(', ')}`);
    }

    // Store state
    const stateId = await this.profileStorageManager.saveSessionState(
      profile_id,
      state,
      { description, tags }
    );

    return {
      success: true,
      state_id: stateId,
      size_bytes: state.metadata.sizeBytes,
      compressed_bytes: state.metadata.compressedBytes || 0,
      compression_ratio: parseFloat(state.metadata.compressionRatio || 0),
      timestamp: new Date().toISOString(),
      capture_time_ms: state.metadata.captureTime || 0
    };
  } catch (error) {
    this.logger.error(`save_session_state failed: ${error.message}`);
    throw error;
  }
}

/**
 * Handler 2: restore_session_state
 * Restores previously saved session state
 */
async function handleRestoreSessionState(params, ws) {
  try {
    const { profile_id, state_id } = params;

    if (!profile_id) {
      throw new Error('profile_id is required');
    }

    // Load state
    let loadResult;
    try {
      loadResult = await this.profileStorageManager.loadSessionState(profile_id, state_id);
    } catch (error) {
      throw new Error(`Failed to load state: ${error.message}`);
    }

    const savedState = loadResult.state;

    // Check if stale
    const staleCheck = this.recoveryHandler.detectStaleState(savedState);
    if (staleCheck.stale) {
      this.logger.warn(`Restoring stale state: ${staleCheck.reason}`);
    }

    // Validate before restore
    const validation = this.stateRestore.validateRestoredState(savedState);
    if (!validation.valid && validation.severity === 'error') {
      throw new Error(`State validation failed: ${validation.issues.join(', ')}`);
    }

    // Restore state progressively
    const result = await this.stateRestore.restoreState(
      this.mainWindow.webContents,
      savedState,
      { partial: true, validate: true }
    );

    // Log restoration event
    if (this.sessionManager) {
      try {
        const sessionId = this.sessionManager.getActiveSessionId?.();
        if (sessionId) {
          // Log to session history if available
          this.logger.info(`Restored session state ${state_id || 'latest'} for profile ${profile_id}`);
        }
      } catch (e) {
        // Session logging not critical
      }
    }

    return {
      success: result.success,
      restored: result.restored,
      failed: result.failed,
      warnings: validation.issues || [],
      restore_time_ms: result.restoreTime || 0
    };
  } catch (error) {
    this.logger.error(`restore_session_state failed: ${error.message}`);
    throw error;
  }
}

/**
 * Handler 3: list_saved_sessions
 * Lists all saved states for a profile
 */
async function handleListSavedSessions(params, ws) {
  try {
    const { profile_id } = params;

    if (!profile_id) {
      throw new Error('profile_id is required');
    }

    const sessions = await this.profileStorageManager.listSessionStates(profile_id);

    return {
      sessions: sessions.map(s => ({
        state_id: s.state_id,
        created: s.created,
        age_seconds: s.age_seconds,
        size_bytes: s.size_bytes,
        url: s.url,
        description: s.description,
        tags: s.tags,
        compressed: s.compressed
      })),
      total_count: sessions.length,
      total_size_bytes: sessions.reduce((sum, s) => sum + (s.size_bytes || 0), 0)
    };
  } catch (error) {
    this.logger.error(`list_saved_sessions failed: ${error.message}`);
    throw error;
  }
}

/**
 * Handler 4: delete_session_state
 * Deletes a specific saved state
 */
async function handleDeleteSessionState(params, ws) {
  try {
    const { profile_id, state_id } = params;

    if (!profile_id || !state_id) {
      throw new Error('profile_id and state_id are required');
    }

    const deleted = await this.profileStorageManager.deleteSessionState(profile_id, state_id);

    return {
      success: true,
      deleted
    };
  } catch (error) {
    this.logger.error(`delete_session_state failed: ${error.message}`);
    throw error;
  }
}

/**
 * Handler 5: verify_session_state
 * Validates a saved state without restoring it
 */
async function handleVerifySessionState(params, ws) {
  try {
    const { profile_id, state_id } = params;

    if (!profile_id || !state_id) {
      throw new Error('profile_id and state_id are required');
    }

    // Load state
    const loaded = await this.profileStorageManager.loadSessionState(profile_id, state_id);
    const savedState = loaded.state;

    // Validate integrity
    const integrity = this.profileStorageManager.validateStateIntegrity(savedState);

    // Check if stale
    const staleCheck = this.recoveryHandler.detectStaleState(savedState);

    // Check completeness
    const completeness = {
      cookies: Array.isArray(savedState.cookies) ? savedState.cookies.length : 0,
      storage_items: (Object.keys(savedState.localStorage || {}).length +
                     Object.keys(savedState.sessionStorage || {}).length),
      dom_state: Boolean(savedState.domState) && Object.keys(savedState.domState).length > 0
    };

    return {
      valid: integrity.valid && !staleCheck.stale,
      stale: staleCheck.stale,
      stale_reason: staleCheck.reason,
      integrity_errors: integrity.errors,
      integrity_warnings: integrity.warnings,
      completeness,
      issues: [...integrity.errors, ...integrity.warnings]
    };
  } catch (error) {
    this.logger.error(`verify_session_state failed: ${error.message}`);
    throw error;
  }
}

/**
 * Handler 6: get_session_metadata
 * Gets metadata about a saved state
 */
async function handleGetSessionMetadata(params, ws) {
  try {
    const { profile_id, state_id } = params;

    if (!profile_id || !state_id) {
      throw new Error('profile_id and state_id are required');
    }

    const metadata = await this.profileStorageManager.getStateMetadata(profile_id, state_id);

    // Calculate completeness score
    const loaded = await this.profileStorageManager.loadSessionState(profile_id, state_id);
    const state = loaded.state;
    const components = {
      cookies: Array.isArray(state.cookies) && state.cookies.length > 0 ? 1 : 0,
      localStorage: state.localStorage && Object.keys(state.localStorage).length > 0 ? 1 : 0,
      sessionStorage: state.sessionStorage && Object.keys(state.sessionStorage).length > 0 ? 1 : 0,
      domState: state.domState && Object.keys(state.domState).length > 0 ? 1 : 0,
      navigationState: state.navigationState && state.navigationState.currentUrl ? 1 : 0
    };
    const completenessScore = (Object.values(components).reduce((a, b) => a + b, 0) / Object.keys(components).length).toFixed(2);

    return {
      state_id,
      profile_id,
      created: metadata.created,
      age_seconds: metadata.age,
      size_bytes: metadata.size,
      compressed: metadata.compressed,
      compression_ratio: metadata.compressed ? metadata.size : 0, // Estimated
      version: metadata.version,
      url: metadata.url,
      description: metadata.description,
      tags: metadata.tags,
      completeness_score: parseFloat(completenessScore),
      components
    };
  } catch (error) {
    this.logger.error(`get_session_metadata failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  registerSessionPersistenceCommands,
  // Export handlers for testing
  handleSaveSessionState,
  handleRestoreSessionState,
  handleListSavedSessions,
  handleDeleteSessionState,
  handleVerifySessionState,
  handleGetSessionMetadata
};
