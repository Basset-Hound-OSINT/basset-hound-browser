// ==========================================
// Runtime Guards (global error handlers + memory manager wiring)
// ==========================================
//
// Extracted from src/main/main.js (Monolith-2 modularization, 2026-07-04).
//
// IMPORT-SIDE-EFFECT-FREE: requiring this module only defines a factory. No
// process listeners are attached and no monitoring starts until main.js invokes
// the returned functions at the SAME boot points as before (setupMemoryManager
// inside createWindow, setupGlobalErrorHandlers inside app.whenReady).
//
// Live browser managers (historyManager / consoleManager / devToolsManager /
// storageManager) are read through the shared `ctx` object PER CALL so the wiring
// matches whatever is assigned at invocation time.

'use strict';

/**
 * Build the runtime-guard helpers.
 * @param {Object} deps
 * @param {Electron.App} deps.app - Electron app (isReady check for the error dialog).
 * @param {Electron.Dialog} deps.dialog - Electron dialog (showErrorBox).
 * @param {Electron.Session} deps.session - Electron session (defaultSession cache cleanup).
 * @param {Object} deps.memoryManager - Memory manager singleton.
 * @param {Object} deps.appConfig - Resolved application configuration (memory section).
 * @param {Object} deps.ctx - Shared runtime context (live getters for browser managers).
 * @param {Function} deps.saveSessionState - Recovery hook invoked on crashes.
 * @returns {{ setupGlobalErrorHandlers, setupMemoryManager }}
 */
function createRuntimeGuards({ app, dialog, session, memoryManager, appConfig, ctx, saveSessionState }) {
  /**
   * Setup global error handlers for uncaught exceptions
   */
  function setupGlobalErrorHandlers() {
    // Handle uncaught exceptions in main process
    process.on('uncaughtException', (error) => {
      console.error('[Error] Uncaught exception:', error);

      // Try to save session state before crashing
      try {
        saveSessionState();
      } catch (e) {
        console.error('[Error] Failed to save state during crash:', e.message);
      }

      // Show error dialog
      if (app.isReady()) {
        dialog.showErrorBox(
          'Unexpected Error',
          `An unexpected error occurred:\n\n${error.message}\n\nThe application will attempt to recover on next start.`
        );
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Error] Unhandled promise rejection:', reason);

      // Save state but don't crash for promise rejections
      try {
        saveSessionState();
      } catch (e) {
        console.error('[Error] Failed to save state during promise rejection:', e.message);
      }
    });

    console.log('[Recovery] Global error handlers installed');
  }

  /**
   * Setup Memory Manager with cleanup callbacks and start monitoring
   */
  function setupMemoryManager() {
    // Register cleanup callbacks for various caches/managers

    // Session cache cleanup
    if (session && session.defaultSession) {
      memoryManager.registerCleanupCallback('session-cache', async () => {
        try {
          await session.defaultSession.clearCache();
          console.log('[MemoryManager] Session cache cleared');
          return { cleared: true };
        } catch (error) {
          console.error('[MemoryManager] Failed to clear session cache:', error.message);
          return { cleared: false, error: error.message };
        }
      }, 5);
    }

    // History manager cleanup (clear old entries)
    if (ctx.historyManager) {
      memoryManager.registerCleanupCallback('history-trim', async () => {
        try {
          // Keep only last 7 days of history during cleanup
          const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          const result = await ctx.historyManager.deleteBeforeDate(new Date(sevenDaysAgo));
          console.log('[MemoryManager] Old history entries cleared');
          return result;
        } catch (error) {
          console.error('[MemoryManager] Failed to trim history:', error.message);
          return { success: false, error: error.message };
        }
      }, 10);
    }

    // Console logs cleanup
    if (ctx.consoleManager) {
      memoryManager.registerCleanupCallback('console-logs', async () => {
        try {
          const result = ctx.consoleManager.clearConsoleLogs();
          console.log('[MemoryManager] Console logs cleared');
          return result;
        } catch (error) {
          console.error('[MemoryManager] Failed to clear console logs:', error.message);
          return { success: false, error: error.message };
        }
      }, 15);
    }

    // DevTools network logs cleanup
    if (ctx.devToolsManager) {
      memoryManager.registerCleanupCallback('network-logs', async () => {
        try {
          const result = ctx.devToolsManager.clearNetworkLogs();
          console.log('[MemoryManager] Network logs cleared');
          return result;
        } catch (error) {
          console.error('[MemoryManager] Failed to clear network logs:', error.message);
          return { success: false, error: error.message };
        }
      }, 15);
    }

    // Storage manager pending operations cleanup
    if (ctx.storageManager) {
      memoryManager.registerCleanupCallback('storage-pending', async () => {
        try {
          // Clear any stuck pending operations
          const count = ctx.storageManager.pendingOperations.size;
          ctx.storageManager.pendingOperations.clear();
          console.log(`[MemoryManager] Cleared ${count} pending storage operations`);
          return { cleared: count };
        } catch (error) {
          console.error('[MemoryManager] Failed to clear pending operations:', error.message);
          return { success: false, error: error.message };
        }
      }, 20);
    }

    // Get memory config
    const memoryConfig = appConfig.memory || {};

    // Start memory monitoring with configured interval
    if (memoryConfig.monitoring?.enabled !== false) {
      const monitoringInterval = memoryConfig.monitoring?.interval || 60000;
      memoryManager.startMonitoring(monitoringInterval);

      // Listen for memory status changes
      memoryManager.on('statusChange', ({ oldStatus, newStatus, memInfo }) => {
        console.log(`[MemoryManager] Status changed: ${oldStatus} -> ${newStatus} (${memInfo.heapUsedMB} MB)`);
      });

      console.log(`[MemoryManager] Memory monitoring initialized (interval: ${monitoringInterval}ms)`);
    }
  }

  return {
    setupGlobalErrorHandlers,
    setupMemoryManager
  };
}

module.exports = { createRuntimeGuards };
