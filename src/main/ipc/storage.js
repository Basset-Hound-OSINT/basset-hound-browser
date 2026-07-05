// Storage management IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerStorageIpc() is called.
// NOTE: the 'storage-operation-response' listener stays in main.js createWindow()
// (it is wired at StorageManager init time, not in the bulk IPC registration).
'use strict';

function registerStorageIpc(ipcMain, ctx) {
  const { storageManager } = ctx;

  // Get localStorage for origin
  ipcMain.handle('get-local-storage', async (event, origin) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.getLocalStorage(origin);
  });

  // Set localStorage item
  ipcMain.handle('set-local-storage-item', async (event, { origin, key, value }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.setLocalStorageItem(origin, key, value);
  });

  // Remove localStorage item
  ipcMain.handle('remove-local-storage-item', async (event, { origin, key }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.removeLocalStorageItem(origin, key);
  });

  // Clear localStorage for origin
  ipcMain.handle('clear-local-storage', async (event, origin) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.clearLocalStorage(origin);
  });

  // Get sessionStorage for origin
  ipcMain.handle('get-session-storage', async (event, origin) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.getSessionStorage(origin);
  });

  // Set sessionStorage item
  ipcMain.handle('set-session-storage-item', async (event, { origin, key, value }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.setSessionStorageItem(origin, key, value);
  });

  // Remove sessionStorage item
  ipcMain.handle('remove-session-storage-item', async (event, { origin, key }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.removeSessionStorageItem(origin, key);
  });

  // Clear sessionStorage for origin
  ipcMain.handle('clear-session-storage', async (event, origin) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.clearSessionStorage(origin);
  });

  // Get IndexedDB databases for origin
  ipcMain.handle('get-indexeddb-databases', async (event, origin) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.getIndexedDBDatabases(origin);
  });

  // Delete IndexedDB database
  ipcMain.handle('delete-indexeddb-database', async (event, { origin, name }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.deleteIndexedDBDatabase(origin, name);
  });

  // Export storage for origin
  ipcMain.handle('export-storage', async (event, { origin, types }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.exportStorage(origin, types);
  });

  // Import storage for origin
  ipcMain.handle('import-storage', async (event, { origin, data }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.importStorage(origin, data);
  });

  // Export storage to file
  ipcMain.handle('export-storage-to-file', async (event, { filepath, origin, types }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.exportStorageToFile(filepath, origin, types);
  });

  // Import storage from file
  ipcMain.handle('import-storage-from-file', async (event, { filepath, origin }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.importStorageFromFile(filepath, origin);
  });

  // Get storage statistics
  ipcMain.handle('get-storage-stats', async (event, origin) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.getStorageStats(origin);
  });

  // Clear all storage for origin
  ipcMain.handle('clear-all-storage', async (event, { origin, types }) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }
    return await storageManager.clearAllStorage(origin, types);
  });
}

module.exports = { registerStorageIpc };
