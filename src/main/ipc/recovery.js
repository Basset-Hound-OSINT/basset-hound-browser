// Recovery management IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerRecoveryIpc() is called.
// The recovery STATE (RECOVERY_CONFIG + auto-save timer) is owned by
// src/main/session-recovery.js and reached here through the shared ctx.
'use strict';

const fs = require('fs');

function registerRecoveryIpc(ipcMain, ctx) {
  const {
    RECOVERY_CONFIG,
    isAutoSaveEnabled,
    saveSessionState,
    loadSessionState,
    clearSessionState,
    startAutoSave,
    stopAutoSave
  } = ctx;

  // Get recovery status
  ipcMain.handle('get-recovery-status', async () => {
    return {
      success: true,
      autoSaveEnabled: isAutoSaveEnabled(),
      autoSaveInterval: RECOVERY_CONFIG.autoSaveInterval,
      recoveryFilePath: RECOVERY_CONFIG.recoveryFilePath,
      lockFilePath: RECOVERY_CONFIG.lockFilePath,
      hasRecoveryFile: fs.existsSync(RECOVERY_CONFIG.recoveryFilePath),
      hasLockFile: fs.existsSync(RECOVERY_CONFIG.lockFilePath)
    };
  });

  // Manually save session state
  ipcMain.handle('save-session-state', async () => {
    try {
      saveSessionState();
      return { success: true, message: 'Session state saved' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Load saved session state (for inspection, not restoration)
  ipcMain.handle('get-saved-session-state', async () => {
    try {
      const state = loadSessionState();
      return { success: true, state };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Clear saved session state
  ipcMain.handle('clear-saved-session-state', async () => {
    try {
      clearSessionState();
      return { success: true, message: 'Session state cleared' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Set auto-save interval
  ipcMain.handle('set-auto-save-interval', async (event, intervalMs) => {
    if (typeof intervalMs !== 'number' || intervalMs < 5000) {
      return { success: false, error: 'Interval must be at least 5000ms' };
    }
    RECOVERY_CONFIG.autoSaveInterval = intervalMs;
    // Restart auto-save with new interval
    startAutoSave();
    return { success: true, interval: intervalMs };
  });

  // Enable/disable auto-save
  ipcMain.handle('toggle-auto-save', async (event, enabled) => {
    if (enabled) {
      startAutoSave();
    } else {
      stopAutoSave();
    }
    return { success: true, autoSaveEnabled: isAutoSaveEnabled() };
  });
}

module.exports = { registerRecoveryIpc };
