// Download management IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerDownloadIpc() is called.
'use strict';

function registerDownloadIpc(ipcMain, ctx) {
  const { downloadManager } = ctx;

  // Start download
  ipcMain.handle('start-download', async (event, { url, options }) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.startDownload(url, options || {});
  });

  // Pause download
  ipcMain.handle('pause-download', async (event, downloadId) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.pauseDownload(downloadId);
  });

  // Resume download
  ipcMain.handle('resume-download', async (event, downloadId) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.resumeDownload(downloadId);
  });

  // Cancel download
  ipcMain.handle('cancel-download', async (event, downloadId) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.cancelDownload(downloadId);
  });

  // Get download info
  ipcMain.handle('get-download', async (event, downloadId) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.getDownload(downloadId);
  });

  // Get active downloads
  ipcMain.handle('get-active-downloads', async () => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.getActiveDownloads();
  });

  // Get completed downloads
  ipcMain.handle('get-completed-downloads', async () => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.getCompletedDownloads();
  });

  // Get all downloads
  ipcMain.handle('get-downloads', async (event, options) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.getAllDownloads(options || {});
  });

  // Clear completed downloads
  ipcMain.handle('clear-completed-downloads', async () => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.clearCompleted();
  });

  // Set download path
  ipcMain.handle('set-download-path', async (event, downloadPath) => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return downloadManager.setDownloadPath(downloadPath);
  });

  // Get download path
  ipcMain.handle('get-download-path', async () => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return { success: true, downloadPath: downloadManager.getDownloadPath() };
  });

  // Get download manager status
  ipcMain.handle('get-download-status', async () => {
    if (!downloadManager) {
      return { success: false, error: 'Download manager not available' };
    }
    return { success: true, status: downloadManager.getStatus() };
  });
}

module.exports = { registerDownloadIpc };
