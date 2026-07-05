// IPC handler registry — single entry point for main.js.
// Extracted from src/main/main.js setupIPCHandlers() (Monolith-2 modularization).
//
// Import-side-effect-free: requiring this module (and its children) registers NOTHING.
// All ipcMain.handle/on registrations happen only when registerAllIpcHandlers(ipcMain, ctx)
// is called — exactly where the old monolithic setupIPCHandlers() was called (at the end
// of createWindow()). The registration order below mirrors the original file so behavior
// (including any last-writer-wins semantics, though all channels are unique) is preserved.
'use strict';

const { registerNavigationIpc } = require('./navigation');
const { registerMediaIpc } = require('./media');
const { registerCookieIpc } = require('./cookies');
const { registerMiscIpc } = require('./misc');
const { registerProxyUaIpc } = require('./proxy-ua');
const { registerSessionIpc } = require('./sessions');
const { registerHistoryIpc } = require('./history');
const { registerDownloadIpc } = require('./downloads');
const { registerTabIpc } = require('./tabs');
const { registerNetworkThrottlingIpc } = require('./network-throttling');
const { registerGeolocationIpc } = require('./geolocation');
const { registerBlockingIpc } = require('./blocking');
const { registerScriptIpc } = require('./scripts');
const { registerProfileIpc } = require('./profiles');
const { registerDevToolsIpc } = require('./devtools');
const { registerConsoleIpc } = require('./console');
const { registerStorageIpc } = require('./storage');
const { registerRecoveryIpc } = require('./recovery');

/**
 * Register every main-process IPC handler.
 * @param {Electron.IpcMain} ipcMain - Electron ipcMain.
 * @param {Object} ctx - Shared runtime context (live managers, window, helpers, recovery API).
 */
function registerAllIpcHandlers(ipcMain, ctx) {
  registerNavigationIpc(ipcMain, ctx);
  registerMediaIpc(ipcMain, ctx);
  registerCookieIpc(ipcMain, ctx);
  registerMiscIpc(ipcMain, ctx);
  registerProxyUaIpc(ipcMain, ctx);
  registerSessionIpc(ipcMain, ctx);
  registerHistoryIpc(ipcMain, ctx);
  registerDownloadIpc(ipcMain, ctx);
  registerTabIpc(ipcMain, ctx);
  registerNetworkThrottlingIpc(ipcMain, ctx);
  registerGeolocationIpc(ipcMain, ctx);
  registerBlockingIpc(ipcMain, ctx);
  registerScriptIpc(ipcMain, ctx);
  registerProfileIpc(ipcMain, ctx);
  registerDevToolsIpc(ipcMain, ctx);
  registerConsoleIpc(ipcMain, ctx);
  registerStorageIpc(ipcMain, ctx);
  registerRecoveryIpc(ipcMain, ctx);
}

module.exports = { registerAllIpcHandlers };
