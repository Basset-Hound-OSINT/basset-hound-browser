// History management IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerHistoryIpc() is called.
'use strict';

function registerHistoryIpc(ipcMain, ctx) {
  const { historyManager } = ctx;

  // Get history
  ipcMain.handle('get-history', async (event, options) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.getHistory(options || {});
  });

  // Search history
  ipcMain.handle('search-history', async (event, { query, limit }) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.searchHistory(query, { limit });
  });

  // Clear history
  ipcMain.handle('clear-history', async (event) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.clearHistory();
  });

  // Add to history (from renderer)
  ipcMain.on('add-to-history', (event, entry) => {
    if (historyManager) {
      historyManager.addEntry(entry.url, entry.title, entry.referrer, {
        tabId: entry.tabId,
        transitionType: entry.transitionType
      });
    }
  });

  // Notify history of page load complete (to update title)
  ipcMain.on('page-load-complete', (event, details) => {
    if (historyManager) {
      historyManager.onPageLoadComplete(details);
    }
  });

  // Get history entry by ID
  ipcMain.handle('get-history-entry', async (event, id) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.getEntry(id);
  });

  // Delete history entry
  ipcMain.handle('delete-history-entry', async (event, id) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.deleteEntry(id);
  });

  // Delete history range
  ipcMain.handle('delete-history-range', async (event, { startTime, endTime }) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.deleteRange(startTime, endTime);
  });

  // Get visit count for URL
  ipcMain.handle('get-visit-count', async (event, url) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.getVisitCount(url);
  });

  // Get most visited URLs
  ipcMain.handle('get-most-visited', async (event, limit) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.getMostVisited(limit || 10);
  });

  // Export history
  ipcMain.handle('export-history', async (event, format) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.exportHistory(format || 'json');
  });

  // Import history
  ipcMain.handle('import-history', async (event, { data, options }) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.importHistory(data, options || {});
  });

  // Get history stats
  ipcMain.handle('get-history-stats', async (event) => {
    if (!historyManager) {
      return { success: false, error: 'History manager not available' };
    }
    return historyManager.getStats();
  });
}

module.exports = { registerHistoryIpc };
