// Miscellaneous IPC handlers (evasion script + WebSocket status).
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
// Import-side-effect-free: registration only happens when registerMiscIpc() is called.
'use strict';

function registerMiscIpc(ipcMain, ctx) {
  const { getEvasionScript } = ctx;

  // Get evasion script for injection
  ipcMain.handle('get-evasion-script', async () => {
    return getEvasionScript();
  });

  // WebSocket status
  ipcMain.handle('get-ws-status', async () => {
    return ctx.wsServer ? ctx.wsServer.getStatus() : { connected: false, clients: 0 };
  });
}

module.exports = { registerMiscIpc };
