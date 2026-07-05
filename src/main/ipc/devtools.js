// DevTools management IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerDevToolsIpc() is called.
'use strict';

function registerDevToolsIpc(ipcMain, ctx) {
  const { devToolsManager } = ctx;

  // Open DevTools
  ipcMain.handle('open-devtools', async (event, options) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.openDevTools(options);
  });

  // Close DevTools
  ipcMain.handle('close-devtools', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.closeDevTools();
  });

  // Toggle DevTools
  ipcMain.handle('toggle-devtools', async (event, options) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.toggleDevTools(options);
  });

  // Get DevTools state
  ipcMain.handle('is-devtools-open', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.getDevToolsState();
  });

  // Get network logs
  ipcMain.handle('get-network-logs', async (event, options) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.getNetworkLogs(options);
  });

  // Clear network logs
  ipcMain.handle('clear-network-logs', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.clearNetworkLogs();
  });

  // Get performance metrics
  ipcMain.handle('get-performance-metrics', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.getPerformanceMetrics();
  });

  // Get code coverage
  ipcMain.handle('get-coverage', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.getCoverage();
  });

  // Get network stats
  ipcMain.handle('get-network-stats', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.getNetworkStats();
  });

  // Start/stop network logging
  ipcMain.handle('start-network-logging', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.startNetworkLogging();
  });

  ipcMain.handle('stop-network-logging', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.stopNetworkLogging();
  });

  // Export network logs
  ipcMain.handle('export-network-logs', async (event, format) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return devToolsManager.exportNetworkLogs(format);
  });

  // Get DevTools status
  ipcMain.handle('get-devtools-status', async () => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }
    return { success: true, status: devToolsManager.getStatus() };
  });
}

module.exports = { registerDevToolsIpc };
