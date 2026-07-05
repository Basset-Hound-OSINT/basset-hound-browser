// Proxy + User-Agent management IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerProxyUaIpc() is called.
'use strict';

function registerProxyUaIpc(ipcMain, ctx) {
  const { proxyManager, userAgentManager } = ctx;

  // ==========================================
  // Proxy Management IPC Handlers
  // ==========================================

  // Set proxy
  ipcMain.handle('set-proxy', async (event, proxyConfig) => {
    return await proxyManager.setProxy(proxyConfig);
  });

  // Clear proxy
  ipcMain.handle('clear-proxy', async () => {
    return await proxyManager.clearProxy();
  });

  // Get proxy status
  ipcMain.handle('get-proxy-status', async () => {
    return proxyManager.getProxyStatus();
  });

  // ==========================================
  // User Agent Management IPC Handlers
  // ==========================================

  // Set user agent
  ipcMain.handle('set-user-agent', async (event, userAgent) => {
    return userAgentManager.setUserAgent(userAgent, ctx.mainWindow);
  });

  // Get random user agent
  ipcMain.handle('get-random-user-agent', async (event, category) => {
    if (category) {
      return userAgentManager.getUserAgentByCategory(category);
    }
    return userAgentManager.getRandomUserAgent();
  });

  // Rotate user agent
  ipcMain.handle('rotate-user-agent', async () => {
    return userAgentManager.rotateUserAgent(ctx.mainWindow);
  });

  // Get user agent status
  ipcMain.handle('get-user-agent-status', async () => {
    return userAgentManager.getStatus();
  });
}

module.exports = { registerProxyUaIpc };
