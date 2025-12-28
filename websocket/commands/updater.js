/**
 * Basset Hound Browser - WebSocket Updater Commands
 * Provides WebSocket API for controlling the auto-update functionality
 */

const { getUpdateManager, UPDATE_STATUS } = require('../../updater/manager');

/**
 * Register updater commands with the WebSocket server
 * @param {Object} commandHandlers - Command handlers registry
 * @param {Object} context - Context with managers and utilities
 */
function registerUpdaterCommands(commandHandlers, context = {}) {
  const logger = context.logger || console;

  /**
   * check_for_updates - Check if updates are available
   *
   * Request:
   * {
   *   "command": "check_for_updates"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "updateAvailable": true,
   *   "updateInfo": {
   *     "version": "8.1.0",
   *     "releaseDate": "2024-01-15T10:00:00.000Z",
   *     "releaseNotes": "Bug fixes and improvements"
   *   }
   * }
   */
  commandHandlers['check_for_updates'] = async (params, ws, server) => {
    try {
      const updateManager = getUpdateManager();
      const result = await updateManager.checkForUpdates();

      return {
        success: result.success,
        updateAvailable: result.updateAvailable || false,
        updateInfo: result.updateInfo || null,
        currentVersion: updateManager.currentVersion,
        error: result.error || null
      };
    } catch (error) {
      logger.error('[WS:Updater] check_for_updates error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * download_update - Download the available update
   *
   * Request:
   * {
   *   "command": "download_update"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "Download started"
   * }
   *
   * Note: Download progress is sent via WebSocket events
   */
  commandHandlers['download_update'] = async (params, ws, server) => {
    try {
      const updateManager = getUpdateManager();
      const result = await updateManager.downloadUpdate();

      if (result.success) {
        // Setup progress notifications for this client
        setupProgressNotifications(updateManager, ws);
      }

      return result;
    } catch (error) {
      logger.error('[WS:Updater] download_update error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * install_update - Install the downloaded update and restart
   *
   * Request:
   * {
   *   "command": "install_update",
   *   "params": {
   *     "silent": false,
   *     "forceRunAfter": true
   *   }
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "Installing update and restarting..."
   * }
   */
  commandHandlers['install_update'] = async (params, ws, server) => {
    try {
      const updateManager = getUpdateManager();
      const silent = params?.silent || false;
      const forceRunAfter = params?.forceRunAfter !== false;

      const result = updateManager.installUpdate(silent, forceRunAfter);

      return result;
    } catch (error) {
      logger.error('[WS:Updater] install_update error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * get_update_status - Get current update status
   *
   * Request:
   * {
   *   "command": "get_update_status"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "status": "idle",
   *   "currentVersion": "8.0.0",
   *   "updateInfo": null,
   *   "downloadProgress": null,
   *   "error": null,
   *   "config": {
   *     "autoDownload": false,
   *     "autoInstallOnAppQuit": true,
   *     "allowPrerelease": false,
   *     "channel": "latest"
   *   }
   * }
   */
  commandHandlers['get_update_status'] = async (params, ws, server) => {
    try {
      const updateManager = getUpdateManager();
      const status = updateManager.getStatus();

      return {
        success: true,
        ...status
      };
    } catch (error) {
      logger.error('[WS:Updater] get_update_status error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * set_update_config - Configure update settings
   *
   * Request:
   * {
   *   "command": "set_update_config",
   *   "params": {
   *     "autoDownload": true,
   *     "autoInstallOnAppQuit": true,
   *     "allowPrerelease": false,
   *     "allowDowngrade": false,
   *     "channel": "latest",
   *     "checkInterval": 3600000
   *   }
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "config": { ... }
   * }
   */
  commandHandlers['set_update_config'] = async (params, ws, server) => {
    try {
      const updateManager = getUpdateManager();
      const result = updateManager.setConfig(params || {});

      return result;
    } catch (error) {
      logger.error('[WS:Updater] set_update_config error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * get_update_history - Get update history
   *
   * Request:
   * {
   *   "command": "get_update_history",
   *   "params": {
   *     "eventType": "update-downloaded",
   *     "since": "2024-01-01T00:00:00.000Z",
   *     "limit": 10
   *   }
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "history": [...],
   *   "currentVersion": "8.0.0",
   *   "rollbackVersions": [...]
   * }
   */
  commandHandlers['get_update_history'] = async (params, ws, server) => {
    try {
      const updateManager = getUpdateManager();
      const result = updateManager.getUpdateHistory(params || {});

      return result;
    } catch (error) {
      logger.error('[WS:Updater] get_update_history error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * rollback_update - Rollback to a previous version
   *
   * Request:
   * {
   *   "command": "rollback_update",
   *   "params": {
   *     "version": "7.9.0"
   *   }
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "Rollback to version 7.9.0 is available",
   *   "version": { ... },
   *   "note": "Full rollback requires downloading the previous version..."
   * }
   */
  commandHandlers['rollback_update'] = async (params, ws, server) => {
    try {
      if (!params?.version) {
        return {
          success: false,
          error: 'Version parameter is required'
        };
      }

      const updateManager = getUpdateManager();
      const result = updateManager.rollback(params.version);

      return result;
    } catch (error) {
      logger.error('[WS:Updater] rollback_update error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * start_auto_update_check - Start automatic update checking
   *
   * Request:
   * {
   *   "command": "start_auto_update_check",
   *   "params": {
   *     "interval": 3600000
   *   }
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "Auto-check started",
   *   "interval": 3600000
   * }
   */
  commandHandlers['start_auto_update_check'] = async (params, ws, server) => {
    try {
      const updateManager = getUpdateManager();

      // Set interval if provided
      if (params?.interval) {
        updateManager.setConfig({ checkInterval: params.interval });
      }

      updateManager.startAutoCheck();

      return {
        success: true,
        message: 'Auto-check started',
        interval: updateManager.config.checkInterval
      };
    } catch (error) {
      logger.error('[WS:Updater] start_auto_update_check error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * stop_auto_update_check - Stop automatic update checking
   *
   * Request:
   * {
   *   "command": "stop_auto_update_check"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "Auto-check stopped"
   * }
   */
  commandHandlers['stop_auto_update_check'] = async (params, ws, server) => {
    try {
      const updateManager = getUpdateManager();
      updateManager.stopAutoCheck();

      return {
        success: true,
        message: 'Auto-check stopped'
      };
    } catch (error) {
      logger.error('[WS:Updater] stop_auto_update_check error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * get_rollback_versions - Get available versions for rollback
   *
   * Request:
   * {
   *   "command": "get_rollback_versions"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "versions": [
   *     { "version": "7.9.0", "appPath": "...", "timestamp": "..." }
   *   ],
   *   "currentVersion": "8.0.0"
   * }
   */
  commandHandlers['get_rollback_versions'] = async (params, ws, server) => {
    try {
      const updateManager = getUpdateManager();
      const versions = updateManager.getRollbackVersions();

      return {
        success: true,
        versions,
        currentVersion: updateManager.currentVersion
      };
    } catch (error) {
      logger.error('[WS:Updater] get_rollback_versions error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  };

  logger.info('[WS:Updater] Registered updater commands');
}

/**
 * Setup progress notifications for a WebSocket client
 * @param {UpdateManager} updateManager - Update manager instance
 * @param {WebSocket} ws - WebSocket connection
 */
function setupProgressNotifications(updateManager, ws) {
  const progressHandler = (progress) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'update_progress',
        data: {
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total,
          delta: progress.delta
        }
      }));
    }
  };

  const statusHandler = (info) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'update_status',
        data: {
          status: updateManager.status,
          info
        }
      }));
    }
  };

  const errorHandler = (error) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'update_error',
        data: error
      }));
    }
  };

  // Register event handlers
  updateManager.on('downloading', progressHandler);
  updateManager.on('downloaded', statusHandler);
  updateManager.on('error', errorHandler);

  // Cleanup on connection close
  ws.on('close', () => {
    updateManager.off('downloading', progressHandler);
    updateManager.off('downloaded', statusHandler);
    updateManager.off('error', errorHandler);
  });
}

/**
 * Get list of updater command names
 * @returns {string[]} Command names
 */
function getUpdaterCommandNames() {
  return [
    'check_for_updates',
    'download_update',
    'install_update',
    'get_update_status',
    'set_update_config',
    'get_update_history',
    'rollback_update',
    'start_auto_update_check',
    'stop_auto_update_check',
    'get_rollback_versions'
  ];
}

module.exports = {
  registerUpdaterCommands,
  getUpdaterCommandNames,
  UPDATE_STATUS
};
