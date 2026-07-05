// Tab management IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerTabIpc() is called.
'use strict';

function registerTabIpc(ipcMain, ctx) {
  const { tabManager } = ctx;

  // Create new tab
  ipcMain.handle('new-tab', async (event, options) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.createTab(options || {});
  });

  // Close tab
  ipcMain.handle('close-tab', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.closeTab(tabId);
  });

  // Switch tab
  ipcMain.handle('switch-tab', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.switchTab(tabId);
  });

  // List tabs
  ipcMain.handle('list-tabs', async (event, options) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.listTabs(options || {});
  });

  // Get tab info
  ipcMain.handle('get-tab-info', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    const tab = tabManager.getTabInfo(tabId || tabManager.activeTabId);
    return tab ? { success: true, tab } : { success: false, error: 'Tab not found' };
  });

  // Get active tab
  ipcMain.handle('get-active-tab', async () => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    const tab = tabManager.getActiveTab();
    return tab ? { success: true, tab } : { success: false, error: 'No active tab' };
  });

  // Navigate tab
  ipcMain.handle('navigate-tab', async (event, { tabId, url }) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.navigateTab(tabId, url);
  });

  // Reload tab
  ipcMain.handle('reload-tab', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.reloadTab(tabId);
  });

  // Tab back
  ipcMain.handle('tab-back', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.goBack(tabId);
  });

  // Tab forward
  ipcMain.handle('tab-forward', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.goForward(tabId);
  });

  // Duplicate tab
  ipcMain.handle('duplicate-tab', async (event, tabId) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.duplicateTab(tabId);
  });

  // Pin tab
  ipcMain.handle('pin-tab', async (event, { tabId, pinned }) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.pinTab(tabId, pinned);
  });

  // Mute tab
  ipcMain.handle('mute-tab', async (event, { tabId, muted }) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.muteTab(tabId, muted);
  });

  // Set tab zoom
  ipcMain.handle('set-tab-zoom', async (event, { tabId, zoomLevel }) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.setZoom(tabId, zoomLevel);
  });

  // Move tab
  ipcMain.handle('move-tab', async (event, { tabId, newIndex }) => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.moveTab(tabId, newIndex);
  });

  // Next tab
  ipcMain.handle('next-tab', async () => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.nextTab();
  });

  // Previous tab
  ipcMain.handle('previous-tab', async () => {
    if (!tabManager) {
      return { success: false, error: 'Tab manager not available' };
    }
    return tabManager.previousTab();
  });

  // Update tab info from renderer
  ipcMain.on('update-tab', (event, { tabId, updates }) => {
    if (tabManager) {
      tabManager.updateTab(tabId, updates);
    }
  });
}

module.exports = { registerTabIpc };
