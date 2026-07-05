// Navigation + page-interaction IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerNavigationIpc() is called.
'use strict';

function registerNavigationIpc(ipcMain, ctx) {
  const { createIPCPromiseWithTimeout } = ctx;

  // Navigation handlers
  ipcMain.handle('navigate', async (event, url) => {
    if (ctx.mainWindow) {
      ctx.mainWindow.webContents.send('navigate-webview', url);
      return { success: true };
    }
    return { success: false, error: 'No window available' };
  });

  ipcMain.handle('get-webview-url', async () => {
    return createIPCPromiseWithTimeout('get-webview-url', 'webview-url-response');
  });

  // Execute script in webview
  ipcMain.handle('execute-in-webview', async (event, script) => {
    return createIPCPromiseWithTimeout('execute-in-webview', 'webview-execute-response', script);
  });

  // Get page content
  ipcMain.handle('get-page-content', async () => {
    return createIPCPromiseWithTimeout('get-page-content', 'page-content-response');
  });

  // P2-004: Wait for Cloudflare challenge to complete
  ipcMain.handle('wait-for-cloudflare', async (event, options) => {
    return createIPCPromiseWithTimeout('wait-for-cloudflare', 'cloudflare-resolved-response', options);
  });

  // Click element
  ipcMain.handle('click-element', async (event, selector) => {
    return createIPCPromiseWithTimeout('click-element', 'click-response', selector);
  });

  // Fill form field
  ipcMain.handle('fill-field', async (event, { selector, value }) => {
    return createIPCPromiseWithTimeout('fill-field', 'fill-response', { selector, value });
  });

  // Get page state (forms, links, buttons)
  ipcMain.handle('get-page-state', async () => {
    return createIPCPromiseWithTimeout('get-page-state', 'page-state-response');
  });

  // Wait for element
  ipcMain.handle('wait-for-element', async (event, { selector, timeout }) => {
    return createIPCPromiseWithTimeout('wait-for-element', 'wait-response', { selector, timeout });
  });

  // Scroll
  ipcMain.handle('scroll', async (event, { x, y, selector }) => {
    return createIPCPromiseWithTimeout('scroll', 'scroll-response', { x, y, selector });
  });
}

module.exports = { registerNavigationIpc };
