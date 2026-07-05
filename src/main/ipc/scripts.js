// Automation script IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerScriptIpc() is called.
'use strict';

function registerScriptIpc(ipcMain, ctx) {
  const { scriptManager } = ctx;

  // Create automation script
  ipcMain.handle('create-script', async (event, { name, script, options }) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.createScript(name, script, options);
  });

  // Update automation script
  ipcMain.handle('update-script', async (event, { id, updates }) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.updateScript(id, updates);
  });

  // Delete automation script
  ipcMain.handle('delete-script', async (event, id) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.deleteScript(id);
  });

  // Get automation script
  ipcMain.handle('get-script', async (event, id) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return scriptManager.getScript(id);
  });

  // List automation scripts
  ipcMain.handle('list-scripts', async (event, options) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return scriptManager.listScripts(options || {});
  });

  // Run automation script
  ipcMain.handle('run-script', async (event, { id, context }) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.runScript(id, context);
  });

  // Enable automation script
  ipcMain.handle('enable-script', async (event, id) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.enableScript(id);
  });

  // Disable automation script
  ipcMain.handle('disable-script', async (event, id) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.disableScript(id);
  });

  // Export automation scripts
  ipcMain.handle('export-scripts', async () => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return scriptManager.exportScripts();
  });

  // Import automation scripts
  ipcMain.handle('import-scripts', async (event, { data, overwrite }) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return await scriptManager.importScripts(data, overwrite);
  });

  // Get available script context
  ipcMain.handle('get-script-context', async () => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return { success: true, context: scriptManager.runner.getAvailableContext() };
  });

  // Get script execution history
  ipcMain.handle('get-script-history', async (event, options) => {
    if (!scriptManager) {
      return { success: false, error: 'Script manager not available' };
    }
    return { success: true, history: scriptManager.runner.getHistory(options || {}) };
  });
}

module.exports = { registerScriptIpc };
