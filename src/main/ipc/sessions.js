// Session management IPC handlers.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerSessionIpc() is called.
'use strict';

function registerSessionIpc(ipcMain, ctx) {
  const { sessionManager } = ctx;

  // Create session
  ipcMain.handle('create-session', async (event, options) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return sessionManager.createSession(options);
  });

  // Switch session
  ipcMain.handle('switch-session', async (event, sessionId) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return sessionManager.switchSession(sessionId);
  });

  // Delete session
  ipcMain.handle('delete-session', async (event, sessionId) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return await sessionManager.deleteSession(sessionId);
  });

  // List sessions
  ipcMain.handle('list-sessions', async () => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return sessionManager.listSessions();
  });

  // Export session
  ipcMain.handle('export-session', async (event, sessionId) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return await sessionManager.exportSession(sessionId);
  });

  // Import session
  ipcMain.handle('import-session', async (event, data) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return await sessionManager.importSession(data);
  });

  // Get session info
  ipcMain.handle('get-session-info', async (event, sessionId) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    const info = sessionManager.getSessionInfo(sessionId || sessionManager.activeSessionId);
    return info ? { success: true, session: info } : { success: false, error: 'Session not found' };
  });

  // Clear session data
  ipcMain.handle('clear-session-data', async (event, sessionId) => {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not available' };
    }
    return await sessionManager.clearSessionData(sessionId);
  });
}

module.exports = { registerSessionIpc };
