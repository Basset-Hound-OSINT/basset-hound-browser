// Profile management IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerProfileIpc() is called.
'use strict';

function registerProfileIpc(ipcMain, ctx) {
  const { profileManager, getEvasionScript } = ctx;

  // Create profile
  ipcMain.handle('create-profile', async (event, options) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return profileManager.createProfile(options);
  });

  // Delete profile
  ipcMain.handle('delete-profile', async (event, profileId) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return await profileManager.deleteProfile(profileId);
  });

  // Get profile
  ipcMain.handle('get-profile', async (event, profileId) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return profileManager.getProfile(profileId);
  });

  // List profiles
  ipcMain.handle('list-profiles', async () => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return profileManager.listProfiles();
  });

  // Switch profile
  ipcMain.handle('switch-profile', async (event, profileId) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return await profileManager.switchProfile(profileId);
  });

  // Update profile
  ipcMain.handle('update-profile', async (event, { profileId, updates }) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return profileManager.updateProfile(profileId, updates);
  });

  // Export profile
  ipcMain.handle('export-profile', async (event, profileId) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return await profileManager.exportProfile(profileId);
  });

  // Import profile
  ipcMain.handle('import-profile', async (event, data) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return await profileManager.importProfile(data);
  });

  // Randomize profile fingerprint
  ipcMain.handle('randomize-profile-fingerprint', async (event, profileId) => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return profileManager.randomizeFingerprint(profileId);
  });

  // Get active profile
  ipcMain.handle('get-active-profile', async () => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    const profile = profileManager.getActiveProfile();
    if (!profile) {
      return { success: false, error: 'No active profile' };
    }
    return { success: true, profile: profile.toJSON() };
  });

  // Get evasion script for profile
  ipcMain.handle('get-profile-evasion-script', async (event, profileId) => {
    if (!profileManager) {
      return getEvasionScript();
    }
    return profileManager.getEvasionScript(profileId);
  });

  // Get active profile partition
  ipcMain.handle('get-active-profile-partition', async () => {
    if (!profileManager) {
      return { success: false, error: 'Profile manager not available' };
    }
    return { success: true, partition: profileManager.getActivePartition() };
  });
}

module.exports = { registerProfileIpc };
