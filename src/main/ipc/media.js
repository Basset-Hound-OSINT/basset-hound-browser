// Screenshot + screen-recording IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerMediaIpc() is called.
'use strict';

function registerMediaIpc(ipcMain, ctx) {
  const { createIPCPromiseWithTimeout } = ctx;

  // Screenshot (basic viewport)
  ipcMain.handle('capture-screenshot', async () => {
    return createIPCPromiseWithTimeout('capture-screenshot', 'screenshot-response');
  });

  // Enhanced screenshot - full page
  ipcMain.handle('screenshot-full-page', async (event, options) => {
    return createIPCPromiseWithTimeout('screenshot-full-page', 'screenshot-full-page-response', options);
  });

  // Enhanced screenshot - element
  ipcMain.handle('screenshot-element', async (event, options) => {
    return createIPCPromiseWithTimeout('screenshot-element', 'screenshot-element-response', options);
  });

  // Enhanced screenshot - area
  ipcMain.handle('screenshot-area', async (event, options) => {
    return createIPCPromiseWithTimeout('screenshot-area', 'screenshot-area-response', options);
  });

  // Enhanced screenshot - viewport with options
  ipcMain.handle('screenshot-viewport', async (event, options) => {
    return createIPCPromiseWithTimeout('screenshot-viewport', 'screenshot-viewport-response', options);
  });

  // Annotate screenshot
  ipcMain.handle('annotate-screenshot', async (event, options) => {
    return createIPCPromiseWithTimeout('annotate-screenshot', 'annotate-screenshot-response', options);
  });

  // Screen recording - start
  ipcMain.handle('start-recording', async (event, options) => {
    return createIPCPromiseWithTimeout('start-recording', 'recording-started', options);
  });

  // Screen recording - stop
  ipcMain.handle('stop-recording', async (event, options) => {
    return createIPCPromiseWithTimeout('stop-recording', 'recording-stopped', options);
  });

  // Screen recording - pause
  ipcMain.handle('pause-recording', async () => {
    return createIPCPromiseWithTimeout('pause-recording', 'recording-paused');
  });

  // Screen recording - resume
  ipcMain.handle('resume-recording', async () => {
    return createIPCPromiseWithTimeout('resume-recording', 'recording-resumed');
  });
}

module.exports = { registerMediaIpc };
