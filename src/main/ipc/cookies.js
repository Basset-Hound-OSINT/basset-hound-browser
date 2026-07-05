// Cookie management IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerCookieIpc() is called.
'use strict';

function registerCookieIpc(ipcMain, ctx) {
  const { cookieManager } = ctx;

  // Get cookies for URL
  ipcMain.handle('get-cookies', async (event, url) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.getCookies(url);
  });

  // Get all cookies
  ipcMain.handle('get-all-cookies', async (event, filter) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.getAllCookies(filter || {});
  });

  // Set a single cookie
  ipcMain.handle('set-cookie', async (event, cookie) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.setCookie(cookie);
  });

  // Set multiple cookies
  ipcMain.handle('set-cookies', async (event, cookies) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.setCookies(cookies);
  });

  // Delete a specific cookie
  ipcMain.handle('delete-cookie', async (event, { url, name }) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.deleteCookie(url, name);
  });

  // Clear all cookies
  ipcMain.handle('clear-cookies', async (event, domain) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.clearCookies(domain);
  });

  // Export cookies
  ipcMain.handle('export-cookies', async (event, { format, filter }) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.exportCookies(format || 'json', filter || {});
  });

  // Import cookies
  ipcMain.handle('import-cookies', async (event, { data, format }) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.importCookies(data, format || 'auto');
  });

  // Export cookies to file
  ipcMain.handle('export-cookies-file', async (event, { filepath, format, filter }) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.exportToFile(filepath, format || 'json', filter || {});
  });

  // Import cookies from file
  ipcMain.handle('import-cookies-file', async (event, { filepath, format }) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.importFromFile(filepath, format || 'auto');
  });

  // Get cookies for domain
  ipcMain.handle('get-cookies-domain', async (event, domain) => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.getCookiesForDomain(domain);
  });

  // Get cookie stats
  ipcMain.handle('get-cookie-stats', async () => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.getStats();
  });

  // Get available cookie formats
  ipcMain.handle('get-cookie-formats', async () => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return { success: true, ...cookieManager.getFormats() };
  });

  // Flush cookies to storage
  ipcMain.handle('flush-cookies', async () => {
    if (!cookieManager) {
      return { success: false, error: 'Cookie manager not available' };
    }
    return await cookieManager.flushCookies();
  });
}

module.exports = { registerCookieIpc };
