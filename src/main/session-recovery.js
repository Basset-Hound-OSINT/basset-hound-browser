// ==========================================
// Session Recovery (crash detection + state persistence)
// ==========================================
//
// Extracted from src/main/main.js (Monolith-2 modularization, 2026-07-04).
//
// IMPORT-SIDE-EFFECT-FREE: requiring this module only defines a factory. No timers
// start, no files are written, and no paths are resolved until main.js invokes the
// returned functions at the SAME boot points as before.
//
// The factory owns the recovery state (RECOVERY_CONFIG object + the auto-save timer)
// so those live in exactly one place. Live browser state (mainWindow / tabManager /
// sessionManager) is read through the shared `ctx` object PER CALL, preserving the
// original closure semantics (e.g. mainWindow becomes null after the window closes).

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Build the session-recovery API.
 * @param {Object} deps
 * @param {Electron.App} deps.app - Electron app (for userData path).
 * @param {Electron.Dialog} deps.dialog - Electron dialog (for the recovery prompt).
 * @param {Object} deps.ctx - Shared runtime context (live getters: mainWindow, tabManager, sessionManager).
 * @param {Object} deps.recoveryOptions - appConfig.browser.recovery (autoSaveInterval, maxRecoveryAttempts, stateVersion).
 * @returns {Object} recovery API + internal RECOVERY_CONFIG + isAutoSaveEnabled()
 */
function createSessionRecovery({ app, dialog, ctx, recoveryOptions = {} }) {
  // ==========================================
  // Error Recovery Configuration
  // ==========================================
  const RECOVERY_CONFIG = {
    autoSaveInterval: recoveryOptions.autoSaveInterval || 30000,
    recoveryFilePath: null, // Set during app ready
    lockFilePath: null, // Lock file to detect unclean shutdown
    maxRecoveryAttempts: recoveryOptions.maxRecoveryAttempts || 3,
    recoveryStateVersion: recoveryOptions.stateVersion || 1
  };

  // Recovery state management (owned here — the single source of truth)
  let autoSaveTimer = null;

  /**
   * Initialize recovery file paths
   */
  function initializeRecoveryPaths() {
    const userDataPath = app.getPath('userData');
    RECOVERY_CONFIG.recoveryFilePath = path.join(userDataPath, 'session-recovery.json');
    RECOVERY_CONFIG.lockFilePath = path.join(userDataPath, '.browser-running.lock');
  }

  /**
   * Create a lock file to detect unclean shutdowns
   */
  function createLockFile() {
    try {
      const lockData = {
        pid: process.pid,
        startTime: Date.now(),
        version: RECOVERY_CONFIG.recoveryStateVersion
      };
      fs.writeFileSync(RECOVERY_CONFIG.lockFilePath, JSON.stringify(lockData), 'utf8');
      console.log('[Recovery] Lock file created');
    } catch (error) {
      console.error('[Recovery] Failed to create lock file:', error.message);
    }
  }

  /**
   * Remove the lock file on clean shutdown
   */
  function removeLockFile() {
    try {
      if (fs.existsSync(RECOVERY_CONFIG.lockFilePath)) {
        fs.unlinkSync(RECOVERY_CONFIG.lockFilePath);
        console.log('[Recovery] Lock file removed');
      }
    } catch (error) {
      console.error('[Recovery] Failed to remove lock file:', error.message);
    }
  }

  /**
   * Check if there was an unclean shutdown
   * @returns {boolean}
   */
  function detectUncleanShutdown() {
    try {
      if (fs.existsSync(RECOVERY_CONFIG.lockFilePath)) {
        const lockData = JSON.parse(fs.readFileSync(RECOVERY_CONFIG.lockFilePath, 'utf8'));
        console.log('[Recovery] Detected previous unclean shutdown (PID:', lockData.pid, ')');
        return true;
      }
    } catch (error) {
      console.error('[Recovery] Error checking lock file:', error.message);
    }
    return false;
  }

  /**
   * Save current session state for recovery
   */
  function saveSessionState() {
    try {
      const state = {
        version: RECOVERY_CONFIG.recoveryStateVersion,
        savedAt: Date.now(),
        tabs: [],
        activeTabId: null,
        activeSessionId: null,
        windowBounds: null
      };

      // Save tab state
      if (ctx.tabManager) {
        const tabList = ctx.tabManager.listTabs();
        if (tabList.success) {
          state.tabs = tabList.tabs.map(tab => ({
            id: tab.id,
            url: tab.url,
            title: tab.title,
            active: tab.active,
            pinned: tab.pinned
          }));
          state.activeTabId = ctx.tabManager.activeTabId;
        }
      }

      // Save session state
      if (ctx.sessionManager) {
        state.activeSessionId = ctx.sessionManager.activeSessionId;
      }

      // Save window bounds
      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        state.windowBounds = ctx.mainWindow.getBounds();
      }

      // Write state to file atomically (write to temp, then rename)
      const tempPath = RECOVERY_CONFIG.recoveryFilePath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tempPath, RECOVERY_CONFIG.recoveryFilePath);

      console.log('[Recovery] Session state saved (' + state.tabs.length + ' tabs)');
    } catch (error) {
      console.error('[Recovery] Failed to save session state:', error.message);
    }
  }

  /**
   * Load saved session state
   * @returns {Object|null}
   */
  function loadSessionState() {
    try {
      if (fs.existsSync(RECOVERY_CONFIG.recoveryFilePath)) {
        const data = fs.readFileSync(RECOVERY_CONFIG.recoveryFilePath, 'utf8');
        const state = JSON.parse(data);

        // Validate state version
        if (state.version !== RECOVERY_CONFIG.recoveryStateVersion) {
          console.log('[Recovery] State version mismatch, ignoring saved state');
          return null;
        }

        // Check if state is too old (more than 24 hours)
        if (Date.now() - state.savedAt > 24 * 60 * 60 * 1000) {
          console.log('[Recovery] Saved state is too old, ignoring');
          return null;
        }

        console.log('[Recovery] Loaded session state from', new Date(state.savedAt).toISOString());
        return state;
      }
    } catch (error) {
      console.error('[Recovery] Failed to load session state:', error.message);
    }
    return null;
  }

  /**
   * Clear saved session state after successful recovery or clean start
   */
  function clearSessionState() {
    try {
      if (fs.existsSync(RECOVERY_CONFIG.recoveryFilePath)) {
        fs.unlinkSync(RECOVERY_CONFIG.recoveryFilePath);
        console.log('[Recovery] Session state cleared');
      }
    } catch (error) {
      console.error('[Recovery] Failed to clear session state:', error.message);
    }
  }

  /**
   * Start auto-save timer for periodic session state saving
   */
  function startAutoSave() {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
    }

    autoSaveTimer = setInterval(() => {
      saveSessionState();
    }, RECOVERY_CONFIG.autoSaveInterval);

    console.log('[Recovery] Auto-save started (interval:', RECOVERY_CONFIG.autoSaveInterval / 1000, 'seconds)');
  }

  /**
   * Stop auto-save timer
   */
  function stopAutoSave() {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
      console.log('[Recovery] Auto-save stopped');
    }
  }

  /**
   * Offer recovery dialog to user
   * @param {Object} state - Saved session state
   * @returns {Promise<boolean>}
   */
  async function offerRecovery(state) {
    const tabCount = state.tabs ? state.tabs.length : 0;
    const savedTime = new Date(state.savedAt).toLocaleString();

    const result = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Restore Session', 'Start Fresh'],
      defaultId: 0,
      title: 'Recover Previous Session',
      message: 'Basset Hound Browser was not closed properly.',
      detail: `Would you like to restore your previous session?\n\n` +
              `Tabs to restore: ${tabCount}\n` +
              `Last saved: ${savedTime}`,
      cancelId: 1
    });

    return result.response === 0;
  }

  /**
   * Restore session from saved state
   * @param {Object} state - Saved session state
   */
  async function restoreSession(state) {
    console.log('[Recovery] Starting session restoration...');

    try {
      // Restore window bounds if available
      if (state.windowBounds && ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.setBounds(state.windowBounds);
      }

      // Restore tabs
      if (state.tabs && state.tabs.length > 0 && ctx.tabManager) {
        // Close the default tab first
        const currentTabs = ctx.tabManager.listTabs();
        if (currentTabs.success && currentTabs.tabs.length === 1) {
          const defaultTab = currentTabs.tabs[0];

          // Restore saved tabs
          for (const savedTab of state.tabs) {
            const result = ctx.tabManager.createTab({
              url: savedTab.url,
              active: savedTab.id === state.activeTabId
            });

            if (result.success && savedTab.pinned) {
              ctx.tabManager.pinTab(result.tab.id, true);
            }
          }

          // Close the original default tab if we restored at least one tab
          const newTabs = ctx.tabManager.listTabs();
          if (newTabs.success && newTabs.tabs.length > 1) {
            ctx.tabManager.closeTab(defaultTab.id);
          }
        }
      }

      console.log('[Recovery] Session restoration complete');
    } catch (error) {
      console.error('[Recovery] Error during session restoration:', error.message);
    }
  }

  /**
   * Whether the auto-save timer is currently running.
   * @returns {boolean}
   */
  function isAutoSaveEnabled() {
    return autoSaveTimer !== null;
  }

  return {
    RECOVERY_CONFIG,
    initializeRecoveryPaths,
    createLockFile,
    removeLockFile,
    detectUncleanShutdown,
    saveSessionState,
    loadSessionState,
    clearSessionState,
    startAutoSave,
    stopAutoSave,
    offerRecovery,
    restoreSession,
    isAutoSaveEnabled
  };
}

module.exports = { createSessionRecovery };
