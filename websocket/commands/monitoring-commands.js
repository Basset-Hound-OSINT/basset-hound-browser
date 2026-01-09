/**
 * Page Monitoring WebSocket Commands
 *
 * Phase 25: Page Monitoring & Change Detection
 *
 * WebSocket API commands for page monitoring features including:
 * - Start/stop/pause/resume monitoring
 * - Change detection with multiple methods
 * - Schedule configuration
 * - Change history and reports
 * - Monitoring zones (specific elements)
 * - Statistics and analytics
 * - Version comparison
 *
 * @module websocket/commands/monitoring-commands
 */

const { PageMonitor } = require('../../monitoring/page-monitor');

// Singleton page monitor instance for the session
let pageMonitor = null;

/**
 * Get or create the page monitor instance
 * @param {Electron.BrowserWindow} mainWindow - Main window
 * @returns {PageMonitor}
 */
function getMonitor(mainWindow) {
  if (!pageMonitor) {
    pageMonitor = new PageMonitor(mainWindow);
  }
  return pageMonitor;
}

/**
 * Register monitoring commands with the WebSocket server
 *
 * @param {Object} server - WebSocket server instance
 * @param {Object} mainWindow - Main Electron window
 */
function registerMonitoringCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  /**
   * Start monitoring a page
   *
   * @command start_monitoring_page
   * @param {Object} [params.config] - Monitor configuration
   * @param {string} [params.config.url] - URL to monitor (defaults to current page)
   * @param {Array<string>} [params.config.methods=['hybrid']] - Detection methods
   * @param {number} [params.config.interval=60000] - Check interval in ms
   * @param {Array<Object>} [params.config.zones=[]] - Specific elements to monitor
   * @param {number} [params.config.threshold=0.1] - Change sensitivity (0-1)
   * @param {boolean} [params.config.notifyOnChange=true] - Send notifications
   * @param {boolean} [params.config.captureScreenshots=true] - Capture screenshots
   * @param {boolean} [params.config.keepHistory=true] - Keep change history
   * @param {number} [params.config.maxHistorySize=100] - Max history items
   * @returns {Object} Monitor result with ID and initial snapshot
   */
  commandHandlers.start_monitoring_page = async (params) => {
    const { config = {} } = params;

    try {
      const monitor = getMonitor(mainWindow);
      const result = await monitor.startMonitoring(config);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Stop monitoring a page
   *
   * @command stop_monitoring_page
   * @param {string} params.monitorId - Monitor ID to stop
   * @returns {Object} Stop result with final statistics
   */
  commandHandlers.stop_monitoring_page = async (params) => {
    const { monitorId } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);
      const result = monitor.stopMonitoring(monitorId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Pause monitoring a page
   *
   * @command pause_monitoring_page
   * @param {string} params.monitorId - Monitor ID to pause
   * @returns {Object} Pause result
   */
  commandHandlers.pause_monitoring_page = async (params) => {
    const { monitorId } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);
      const result = monitor.pauseMonitoring(monitorId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Resume monitoring a page
   *
   * @command resume_monitoring_page
   * @param {string} params.monitorId - Monitor ID to resume
   * @returns {Object} Resume result
   */
  commandHandlers.resume_monitoring_page = async (params) => {
    const { monitorId } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);
      const result = monitor.resumeMonitoring(monitorId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Check for changes immediately
   *
   * @command check_page_changes_now
   * @param {string} params.monitorId - Monitor ID to check
   * @returns {Object} Check result with changes if any
   */
  commandHandlers.check_page_changes_now = async (params) => {
    const { monitorId } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);
      const result = await monitor.checkForChanges(monitorId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get page changes
   *
   * @command get_page_changes
   * @param {string} params.monitorId - Monitor ID
   * @param {Object} [params.options] - Query options
   * @param {number} [params.options.limit=50] - Maximum changes to return
   * @param {number} [params.options.offset=0] - Offset for pagination
   * @param {string} [params.options.type] - Filter by change type
   * @param {string} [params.options.since] - Filter changes since timestamp
   * @param {string} [params.options.until] - Filter changes until timestamp
   * @returns {Object} Changes result with pagination
   */
  commandHandlers.get_page_changes = async (params) => {
    const { monitorId, options = {} } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);
      const result = monitor.getPageChanges(monitorId, options);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Compare page versions
   *
   * @command compare_page_versions
   * @param {string} params.monitorId - Monitor ID
   * @param {string} params.version1Id - First version/snapshot ID
   * @param {string} params.version2Id - Second version/snapshot ID
   * @returns {Object} Comparison result with detailed changes
   */
  commandHandlers.compare_page_versions = async (params) => {
    const { monitorId, version1Id, version2Id } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    if (!version1Id || !version2Id) {
      return {
        success: false,
        error: 'Both version1Id and version2Id are required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);
      const result = await monitor.comparePageVersions(monitorId, version1Id, version2Id);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get monitoring schedule
   *
   * @command get_monitoring_schedule
   * @param {string} params.monitorId - Monitor ID
   * @returns {Object} Schedule information including next check time
   */
  commandHandlers.get_monitoring_schedule = async (params) => {
    const { monitorId } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);
      const result = monitor.getMonitoringSchedule(monitorId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Configure change detection
   *
   * @command configure_change_detection
   * @param {string} params.monitorId - Monitor ID
   * @param {Object} params.config - Detection configuration
   * @param {Array<string>} [params.config.methods] - Detection methods to use
   * @param {number} [params.config.threshold] - Change sensitivity (0-1)
   * @param {number} [params.config.interval] - Check interval in ms
   * @param {boolean} [params.config.notifyOnChange] - Enable/disable notifications
   * @param {boolean} [params.config.captureScreenshots] - Enable/disable screenshot capture
   * @returns {Object} Updated monitor configuration
   */
  commandHandlers.configure_change_detection = async (params) => {
    const { monitorId, config = {} } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);
      const result = monitor.configureChangeDetection(monitorId, config);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Export change report
   *
   * @command export_change_report
   * @param {string} params.monitorId - Monitor ID
   * @param {Object} [params.options] - Export options
   * @param {string} [params.options.format='json'] - Report format (json, csv, html, markdown)
   * @param {boolean} [params.options.includeSnapshots=false] - Include full snapshots
   * @param {boolean} [params.options.includeScreenshots=false] - Include screenshot data
   * @param {string} [params.options.filePath] - File path to save report
   * @returns {Object} Export result with report data or file path
   */
  commandHandlers.export_change_report = async (params) => {
    const { monitorId, options = {} } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);
      const result = monitor.exportChangeReport(monitorId, options);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get monitoring statistics
   *
   * @command get_monitoring_stats
   * @param {string} params.monitorId - Monitor ID
   * @returns {Object} Detailed statistics and analytics
   */
  commandHandlers.get_monitoring_stats = async (params) => {
    const { monitorId } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);
      const result = monitor.getMonitoringStats(monitorId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Add monitoring zone (specific element)
   *
   * @command add_monitoring_zone
   * @param {string} params.monitorId - Monitor ID
   * @param {Object} params.zone - Zone configuration
   * @param {string} params.zone.selector - CSS selector for the zone
   * @param {string} [params.zone.name] - Zone name (defaults to selector)
   * @param {Array<string>} [params.zone.methods] - Detection methods for this zone
   * @param {number} [params.zone.threshold] - Sensitivity threshold for this zone
   * @returns {Object} Add result with zone details
   */
  commandHandlers.add_monitoring_zone = async (params) => {
    const { monitorId, zone } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    if (!zone || !zone.selector) {
      return {
        success: false,
        error: 'zone with selector is required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);
      const result = monitor.addMonitoringZone(monitorId, zone);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Remove monitoring zone
   *
   * @command remove_monitoring_zone
   * @param {string} params.monitorId - Monitor ID
   * @param {string} params.zoneId - Zone ID to remove
   * @returns {Object} Remove result
   */
  commandHandlers.remove_monitoring_zone = async (params) => {
    const { monitorId, zoneId } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    if (!zoneId) {
      return {
        success: false,
        error: 'zoneId is required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);
      const result = monitor.removeMonitoringZone(monitorId, zoneId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * List monitored pages
   *
   * @command list_monitored_pages
   * @returns {Object} List of all active monitors
   */
  commandHandlers.list_monitored_pages = async () => {
    try {
      const monitor = getMonitor(mainWindow);
      const result = monitor.listMonitoredPages();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get monitor details
   *
   * @command get_monitor_details
   * @param {string} params.monitorId - Monitor ID
   * @returns {Object} Detailed monitor information
   */
  commandHandlers.get_monitor_details = async (params) => {
    const { monitorId } = params;

    if (!monitorId) {
      return {
        success: false,
        error: 'monitorId is required'
      };
    }

    try {
      const monitor = getMonitor(mainWindow);

      // Get monitor, stats, and schedule
      const statsResult = monitor.getMonitoringStats(monitorId);
      const scheduleResult = monitor.getMonitoringSchedule(monitorId);

      if (!statsResult.success) {
        return statsResult;
      }

      return {
        success: true,
        monitorId,
        details: {
          statistics: statsResult.statistics,
          schedule: scheduleResult.success ? scheduleResult.schedule : null
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Cleanup monitoring resources
   *
   * @command cleanup_page_monitor
   * @param {string} [params.monitorId] - Specific monitor to cleanup (null for all)
   * @returns {Object} Cleanup result
   */
  commandHandlers.cleanup_page_monitor = async (params) => {
    const { monitorId = null } = params || {};

    try {
      if (pageMonitor) {
        pageMonitor.cleanup(monitorId);
      }

      return {
        success: true,
        message: monitorId ?
          `Monitor ${monitorId} cleaned up` :
          'All monitoring resources cleaned up'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };
}

/**
 * Cleanup function for module
 */
function cleanup() {
  if (pageMonitor) {
    pageMonitor.cleanup();
    pageMonitor = null;
  }
}

module.exports = {
  registerMonitoringCommands,
  cleanup
};
