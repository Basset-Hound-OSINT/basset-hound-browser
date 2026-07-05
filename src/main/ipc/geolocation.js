// Geolocation management IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerGeolocationIpc() is called.
'use strict';

function registerGeolocationIpc(ipcMain, ctx) {
  const { geolocationManager } = ctx;

  // Set geolocation
  ipcMain.handle('set-geolocation', async (event, { latitude, longitude, options }) => {
    return geolocationManager.setLocation(latitude, longitude, options || {});
  });

  // Set geolocation by city name
  ipcMain.handle('set-geolocation-city', async (event, cityName) => {
    return geolocationManager.setLocationByCity(cityName);
  });

  // Get current geolocation
  ipcMain.handle('get-geolocation', async () => {
    return geolocationManager.getLocation();
  });

  // Enable geolocation spoofing
  ipcMain.handle('enable-geolocation-spoofing', async () => {
    const result = geolocationManager.enableSpoofing();
    if (result.success && ctx.mainWindow) {
      ctx.mainWindow.webContents.send('inject-geolocation-script', geolocationManager.getFullSpoofScript());
    }
    return result;
  });

  // Disable geolocation spoofing
  ipcMain.handle('disable-geolocation-spoofing', async () => {
    return geolocationManager.disableSpoofing();
  });

  // Get geolocation spoofing status
  ipcMain.handle('get-geolocation-status', async () => {
    return geolocationManager.getStatus();
  });

  // Get preset locations
  ipcMain.handle('get-preset-locations', async (event, filter) => {
    return {
      success: true,
      presets: geolocationManager.getPresetLocations(filter || {})
    };
  });

  // Get geolocation spoof script
  ipcMain.handle('get-geolocation-script', async () => {
    return {
      success: true,
      script: geolocationManager.getFullSpoofScript(),
      enabled: geolocationManager.isEnabled()
    };
  });

  // Reset geolocation to default
  ipcMain.handle('reset-geolocation', async () => {
    return geolocationManager.reset();
  });
}

module.exports = { registerGeolocationIpc };
