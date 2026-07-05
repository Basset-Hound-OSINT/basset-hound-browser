/**
 * Competitor Monitoring Commands - WebSocket API for competitive intelligence
 *
 * Phase 26: Competitive Website Monitoring
 *
 * WebSocket API commands for monitoring competitor websites including:
 * - Add/remove/update monitored websites
 * - Automated change detection (content, structure, technology)
 * - Alert configuration across multiple channels (email, webhook, Slack, Teams)
 * - Change history tracking and comparison
 * - Performance benchmarking
 * - Market intelligence gathering
 *
 * @module websocket/commands/competitor-monitoring-commands
 */

/**
 * Register competitor monitoring commands with the WebSocket server
 *
 * @param {Object} commandHandlers - Command handlers object from WebSocket server
 * @param {MonitoringService} monitoringService - Monitoring service instance
 * @returns {void}
 */
function registerCompetitorMonitoringCommands(commandHandlers, monitoringService) {
  if (!monitoringService) {
    console.warn('MonitoringService not provided, competitor monitoring commands disabled');
    return;
  }

  /**
   * Add a new competitor website to monitor
   * @command add_competitor_monitor
   * @param {string} params.url - Website URL to monitor
   * @param {string} params.name - Display name for the competitor
   * @param {string} [params.frequency='daily'] - Monitoring frequency (hourly, daily, weekly)
   * @param {Object} [params.alerts] - Alert configuration
   * @param {Array<string>} [params.tags] - Organizational tags
   * @param {Object} [params.metadata] - Custom metadata
   * @returns {Object} Created monitor configuration
   */
  commandHandlers.add_competitor_monitor = async (params) => {
    const {
      url,
      name,
      frequency = 'daily',
      alerts = {},
      tags = [],
      metadata = {}
    } = params;

    try {
      if (!url || !name) {
        return { success: false, error: 'URL and name are required' };
      }

      const monitor = monitoringService.monitorManager.addMonitor({
        url,
        name,
        frequency,
        alerts,
        tags,
        metadata
      });

      return {
        success: true,
        monitor,
        message: `Monitor for ${name} added successfully`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Remove a competitor monitor
   * @command remove_competitor_monitor
   * @param {string} params.monitor_id - Monitor ID to remove
   * @returns {Object} Removal result
   */
  commandHandlers.remove_competitor_monitor = async (params) => {
    const { monitor_id } = params;

    try {
      if (!monitor_id) {
        return { success: false, error: 'monitor_id is required' };
      }

      monitoringService.monitorManager.removeMonitor(monitor_id);

      return {
        success: true,
        message: `Monitor ${monitor_id} removed successfully`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Update competitor monitor configuration
   * @command update_competitor_monitor
   * @param {string} params.monitor_id - Monitor ID
   * @param {Object} params.updates - Configuration updates
   * @returns {Object} Updated monitor
   */
  commandHandlers.update_competitor_monitor = async (params) => {
    const { monitor_id, updates } = params;

    try {
      if (!monitor_id) {
        return { success: false, error: 'monitor_id is required' };
      }

      const monitor = monitoringService.monitorManager.updateMonitor(monitor_id, updates);

      return {
        success: true,
        monitor,
        message: 'Monitor updated successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get detailed monitor information including stats
   * @command get_competitor_monitor
   * @param {string} params.monitor_id - Monitor ID
   * @returns {Object} Monitor details and status
   */
  commandHandlers.get_competitor_monitor = async (params) => {
    const { monitor_id } = params;

    try {
      if (!monitor_id) {
        return { success: false, error: 'monitor_id is required' };
      }

      const monitor = monitoringService.getMonitorStatus(monitor_id);

      return {
        success: true,
        monitor
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * List all competitor monitors with optional filtering
   * @command list_competitor_monitors
   * @param {string} [params.status] - Filter by status (active, paused, error)
   * @param {string} [params.tag] - Filter by tag
   * @param {number} [params.limit=100] - Result limit
   * @param {number} [params.offset=0] - Result offset for pagination
   * @returns {Object} List of monitors with pagination info
   */
  commandHandlers.list_competitor_monitors = async (params) => {
    try {
      const { status, tag, limit = 100, offset = 0 } = params;

      const filter = {};
      if (status) {
        filter.status = status;
      }
      if (tag) {
        filter.tag = tag;
      }

      const monitors = monitoringService.monitorManager.listMonitors(filter);
      const paginated = monitors.slice(offset, offset + limit);

      return {
        success: true,
        monitors: paginated,
        total: monitors.length,
        limit,
        offset
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Pause monitoring for a competitor
   * @command pause_competitor_monitor
   * @param {string} params.monitor_id - Monitor ID
   * @returns {Object} Updated monitor
   */
  commandHandlers.pause_competitor_monitor = async (params) => {
    const { monitor_id } = params;

    try {
      if (!monitor_id) {
        return { success: false, error: 'monitor_id is required' };
      }

      const monitor = monitoringService.monitorManager.pauseMonitor(monitor_id);

      return {
        success: true,
        monitor,
        message: 'Monitor paused successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Resume monitoring for a competitor
   * @command resume_competitor_monitor
   * @param {string} params.monitor_id - Monitor ID
   * @returns {Object} Updated monitor
   */
  commandHandlers.resume_competitor_monitor = async (params) => {
    const { monitor_id } = params;

    try {
      if (!monitor_id) {
        return { success: false, error: 'monitor_id is required' };
      }

      const monitor = monitoringService.monitorManager.resumeMonitor(monitor_id);

      return {
        success: true,
        monitor,
        message: 'Monitor resumed successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Manually trigger a check for a competitor
   * @command check_competitor_monitor
   * @param {string} params.monitor_id - Monitor ID
   * @param {Object} [params.capture_data] - Captured website data from browser
   * @returns {Object} Check result with change detection
   */
  commandHandlers.check_competitor_monitor = async (params) => {
    const { monitor_id, capture_data } = params;

    try {
      if (!monitor_id) {
        return { success: false, error: 'monitor_id is required' };
      }

      const result = await monitoringService.checkMonitor(monitor_id, capture_data);

      return {
        success: result.success,
        result,
        changeDetected: result.changeDetected || false
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get change history for a competitor
   * @command get_competitor_changes
   * @param {string} params.monitor_id - Monitor ID
   * @param {number} [params.limit=20] - Number of changes to return
   * @param {number} [params.offset=0] - Pagination offset
   * @param {string} [params.change_type] - Filter by change type (content, structure, technology)
   * @returns {Object} Change history with details
   */
  commandHandlers.get_competitor_changes = async (params) => {
    const { monitor_id, limit = 20, offset = 0, change_type } = params;

    try {
      if (!monitor_id) {
        return { success: false, error: 'monitor_id is required' };
      }

      const changes = monitoringService.getChangeHistory(monitor_id, {
        limit,
        offset,
        changeType: change_type
      });

      return {
        success: true,
        changes,
        total: changes.length,
        limit,
        offset
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get snapshot history for a competitor (site versions over time)
   * @command get_competitor_snapshots
   * @param {string} params.monitor_id - Monitor ID
   * @param {number} [params.limit=10] - Number of snapshots
   * @param {number} [params.offset=0] - Pagination offset
   * @returns {Object} Snapshot history
   */
  commandHandlers.get_competitor_snapshots = async (params) => {
    const { monitor_id, limit = 10, offset = 0 } = params;

    try {
      if (!monitor_id) {
        return { success: false, error: 'monitor_id is required' };
      }

      const snapshots = monitoringService.getSnapshotHistory(monitor_id, {
        limit,
        offset
      });

      return {
        success: true,
        snapshots,
        total: snapshots.length,
        limit,
        offset
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get detailed statistics for a competitor monitor
   * @command get_competitor_stats
   * @param {string} params.monitor_id - Monitor ID
   * @returns {Object} Monitor statistics and metrics
   */
  commandHandlers.get_competitor_stats = async (params) => {
    const { monitor_id } = params;

    try {
      if (!monitor_id) {
        return { success: false, error: 'monitor_id is required' };
      }

      const stats = monitoringService.monitorManager.getMonitorStats(monitor_id);

      return {
        success: true,
        stats
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Start the monitoring service
   * @command start_competitor_monitoring
   * @returns {Object} Service status
   */
  commandHandlers.start_competitor_monitoring = async (params) => {
    try {
      await monitoringService.start();

      return {
        success: true,
        message: 'Competitor monitoring started',
        status: monitoringService.status
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Stop the monitoring service
   * @command stop_competitor_monitoring
   * @returns {Object} Service status
   */
  commandHandlers.stop_competitor_monitoring = async (params) => {
    try {
      await monitoringService.stop();

      return {
        success: true,
        message: 'Competitor monitoring stopped',
        status: monitoringService.status
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Pause the monitoring service
   * @command pause_competitor_monitoring
   * @returns {Object} Service status
   */
  commandHandlers.pause_competitor_monitoring = async (params) => {
    try {
      monitoringService.pause();

      return {
        success: true,
        message: 'Competitor monitoring paused',
        status: monitoringService.status
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Resume the monitoring service
   * @command resume_competitor_monitoring
   * @returns {Object} Service status
   */
  commandHandlers.resume_competitor_monitoring = async (params) => {
    try {
      monitoringService.resume();

      return {
        success: true,
        message: 'Competitor monitoring resumed',
        status: monitoringService.status
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get service status and statistics
   * @command get_competitor_monitoring_status
   * @returns {Object} Complete service status
   */
  commandHandlers.get_competitor_monitoring_status = async (params) => {
    try {
      const stats = monitoringService.getStats();

      return {
        success: true,
        status: monitoringService.status,
        stats
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get global monitoring statistics across all competitors
   * @command get_competitor_monitoring_stats
   * @returns {Object} Global statistics
   */
  commandHandlers.get_competitor_monitoring_stats = async (params) => {
    try {
      const globalStats = monitoringService.monitorManager.getGlobalStats();
      const serviceStats = monitoringService.getStats();

      return {
        success: true,
        globalStats,
        serviceStats
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Configure alerts for a competitor
   * @command configure_competitor_alerts
   * @param {string} params.monitor_id - Monitor ID
   * @param {Object} params.alert_config - Alert configuration
   * @param {boolean} [params.alert_config.enableEmail] - Enable email alerts
   * @param {Array<string>} [params.alert_config.emailAddresses] - Email recipients
   * @param {boolean} [params.alert_config.enableWebhook] - Enable webhook alerts
   * @param {string} [params.alert_config.webhookUrl] - Webhook URL
   * @param {boolean} [params.alert_config.enableSlack] - Enable Slack alerts
   * @param {string} [params.alert_config.slackWebhookUrl] - Slack webhook
   * @param {boolean} [params.alert_config.enableTeams] - Enable Teams alerts
   * @param {string} [params.alert_config.teamsWebhookUrl] - Teams webhook
   * @returns {Object} Updated monitor with alerts
   */
  commandHandlers.configure_competitor_alerts = async (params) => {
    const { monitor_id, alert_config } = params;

    try {
      if (!monitor_id) {
        return { success: false, error: 'monitor_id is required' };
      }

      const monitor = monitoringService.monitorManager.updateMonitor(monitor_id, {
        alerts: alert_config
      });

      return {
        success: true,
        monitor,
        message: 'Alert configuration updated'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Run immediate checks on monitors due for checking
   * @command run_competitor_monitoring_checks
   * @returns {Object} Check execution result
   */
  commandHandlers.run_competitor_monitoring_checks = async (params) => {
    try {
      const result = await monitoringService.runScheduledChecks();

      return {
        success: true,
        checksRun: result.checksRun,
        successCount: result.successCount,
        failureCount: result.failureCount
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Export all monitoring data
   * @command export_competitor_monitoring_data
   * @returns {Object} Complete monitoring dataset
   */
  commandHandlers.export_competitor_monitoring_data = async (params) => {
    try {
      const data = monitoringService.exportData();

      return {
        success: true,
        data
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Import monitoring configuration
   * @command import_competitor_monitoring_config
   * @param {Array<Object>} params.monitors - Monitors to import
   * @param {boolean} [params.merge=false] - Merge with existing monitors
   * @returns {Object} Import result
   */
  commandHandlers.import_competitor_monitoring_config = async (params) => {
    const { monitors, merge = false } = params;

    try {
      if (!monitors || !Array.isArray(monitors)) {
        return { success: false, error: 'monitors array is required' };
      }

      const result = monitoringService.monitorManager.importMonitors(monitors, merge);

      return {
        success: result.success,
        imported: result.imported,
        errors: result.errors,
        errorDetails: result.errorDetails
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Cleanup old monitoring data
   * @command cleanup_competitor_monitoring_data
   * @param {number} [params.older_than_days=30] - Delete data older than X days
   * @param {number} [params.keep_min_snapshots=5] - Keep minimum snapshots
   * @returns {Object} Cleanup result
   */
  commandHandlers.cleanup_competitor_monitoring_data = async (params) => {
    const { older_than_days = 30, keep_min_snapshots = 5 } = params;

    try {
      const result = monitoringService.cleanup({
        olderThanDays: older_than_days,
        keepMinSnapshots: keep_min_snapshots
      });

      return {
        success: true,
        result,
        message: 'Cleanup completed'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Clear all competitor monitors
   * @command clear_all_competitor_monitors
   * @returns {Object} Clear result
   */
  commandHandlers.clear_all_competitor_monitors = async (params) => {
    try {
      const result = monitoringService.monitorManager.clearAllMonitors();

      return {
        success: result.success,
        clearedCount: result.clearedCount
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

module.exports = { registerCompetitorMonitoringCommands };
