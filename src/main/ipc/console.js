// Console management IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerConsoleIpc() is called.
'use strict';

function registerConsoleIpc(ipcMain, ctx) {
  const { consoleManager } = ctx;

  // Get console logs
  ipcMain.handle('get-console-logs', async (event, options) => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.getConsoleLogs(options);
  });

  // Clear console logs
  ipcMain.handle('clear-console-logs', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.clearConsoleLogs();
  });

  // Execute in console
  ipcMain.handle('execute-in-console', async (event, { code, options }) => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.executeInConsole(code, options);
  });

  // Get console errors
  ipcMain.handle('get-console-errors', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.getErrors();
  });

  // Get console warnings
  ipcMain.handle('get-console-warnings', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.getWarnings();
  });

  // Export console logs
  ipcMain.handle('export-console-logs', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.exportLogs();
  });

  // Get console status
  ipcMain.handle('get-console-status', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return { success: true, status: consoleManager.getStatus() };
  });

  // Start/stop console capture
  ipcMain.handle('start-console-capture', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.startCapture();
  });

  ipcMain.handle('stop-console-capture', async () => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.stopCapture();
  });

  // Set max console logs
  ipcMain.handle('set-max-console-logs', async (event, max) => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }
    return consoleManager.setMaxLogs(max);
  });

  // Console message from renderer
  ipcMain.on('console-message', (event, message) => {
    if (consoleManager) {
      consoleManager.addLog(message);
    }
  });
}

module.exports = { registerConsoleIpc };
