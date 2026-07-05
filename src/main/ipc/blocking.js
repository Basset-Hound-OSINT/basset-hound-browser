// Content blocking IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerBlockingIpc() is called.
'use strict';

function registerBlockingIpc(ipcMain, ctx) {
  const { blockingManager } = ctx;

  // Enable content blocking
  ipcMain.handle('enable-blocking', async () => {
    return blockingManager.enableBlocking();
  });

  // Disable content blocking
  ipcMain.handle('disable-blocking', async () => {
    return blockingManager.disableBlocking();
  });

  // Add block rule
  ipcMain.handle('add-block-rule', async (event, { pattern, options }) => {
    return blockingManager.addBlockRule(pattern, options);
  });

  // Remove block rule
  ipcMain.handle('remove-block-rule', async (event, pattern) => {
    return blockingManager.removeBlockRule(pattern);
  });

  // Get block rules
  ipcMain.handle('get-block-rules', async () => {
    return blockingManager.getBlockRules();
  });

  // Load filter list from URL
  ipcMain.handle('load-filter-list', async (event, url) => {
    return await blockingManager.loadFilterList(url);
  });

  // Load local filter list
  ipcMain.handle('load-local-filter-list', async (event, path) => {
    return await blockingManager.loadLocalFilterList(path);
  });

  // Get blocking statistics
  ipcMain.handle('get-blocking-stats', async () => {
    return blockingManager.getStats();
  });

  // Clear blocking statistics
  ipcMain.handle('clear-blocking-stats', async () => {
    return blockingManager.clearStats();
  });

  // Whitelist domain
  ipcMain.handle('whitelist-domain', async (event, domain) => {
    return blockingManager.whitelistDomain(domain);
  });

  // Remove from whitelist
  ipcMain.handle('remove-whitelist', async (event, domain) => {
    return blockingManager.removeWhitelist(domain);
  });

  // Get whitelist
  ipcMain.handle('get-whitelist', async () => {
    return blockingManager.getWhitelist();
  });

  // Set blocking category
  ipcMain.handle('set-blocking-category', async (event, { category, enabled }) => {
    return blockingManager.setCategory(category, enabled);
  });

  // Get blocking categories
  ipcMain.handle('get-blocking-categories', async () => {
    return blockingManager.getCategories();
  });

  // Get known filter list URLs
  ipcMain.handle('get-known-filter-lists', async () => {
    return blockingManager.getKnownFilterListUrls();
  });
}

module.exports = { registerBlockingIpc };
