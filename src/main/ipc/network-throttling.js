// Network throttling IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerNetworkThrottlingIpc() is called.
'use strict';

function registerNetworkThrottlingIpc(ipcMain, ctx) {
  const { networkThrottler } = ctx;

  // Set network throttling
  ipcMain.handle('set-network-throttling', async (event, { download, upload, latency }) => {
    return await networkThrottler.setThrottling(download, upload, latency);
  });

  // Set network preset
  ipcMain.handle('set-network-preset', async (event, presetName) => {
    return await networkThrottler.setPreset(presetName);
  });

  // Get network presets
  ipcMain.handle('get-network-presets', async () => {
    return networkThrottler.getPresets();
  });

  // Enable network throttling
  ipcMain.handle('enable-network-throttling', async () => {
    return await networkThrottler.enable();
  });

  // Disable network throttling
  ipcMain.handle('disable-network-throttling', async () => {
    return await networkThrottler.disable();
  });

  // Get network throttling status
  ipcMain.handle('get-network-throttling-status', async () => {
    return { success: true, ...networkThrottler.getStatus() };
  });
}

module.exports = { registerNetworkThrottlingIpc };
