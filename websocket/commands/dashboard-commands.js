/**
 * Dashboard WebSocket Commands - Real-time monitoring dashboard API
 *
 * WebSocket API commands for competitor monitoring dashboard including:
 * - get_dashboard_data - Fetch all dashboard data
 * - get_monitor_changes - Recent changes for specific monitor
 * - get_competitor_comparison - Compare two competitors
 * - dismiss_alert - Mark alert as dismissed
 * - acknowledge_alert - Acknowledge alert
 * - get_alerts - Retrieve alerts with filtering
 * - subscribe_dashboard - Subscribe to real-time updates
 *
 * @module websocket/commands/dashboard-commands
 */

/**
 * Register dashboard commands with the WebSocket server
 *
 * @param {Object} commandHandlers - Command handlers object from WebSocket server
 * @param {DashboardEngine} dashboardEngine - Dashboard engine instance
 * @param {AlertManager} alertManager - Alert manager instance
 * @returns {void}
 */
function registerDashboardCommands(commandHandlers, dashboardEngine, alertManager) {
  if (!dashboardEngine) {
    console.warn('DashboardEngine not provided, dashboard commands disabled');
    return;
  }

  /**
   * Get complete dashboard data
   * @command get_dashboard_data
   * @param {Object} params - Command parameters
   * @param {Array<string>} [params.monitorIds] - Specific monitors to include
   * @param {Object} [params.options] - Query options
   * @returns {Object} Complete dashboard state
   */
  commandHandlers.get_dashboard_data = async (params) => {
    try {
      const { monitorIds = null, options = {} } = params;

      // Get dashboard status
      const status = dashboardEngine.getStatus();

      // Get metrics
      const metrics = dashboardEngine.getMetrics();

      // Get timeline
      const timeline = dashboardEngine.getTimeline({
        limit: options.timelineLimit || 50,
        monitorId: monitorIds && monitorIds.length === 1 ? monitorIds[0] : null
      });

      // Get overview data
      const overview = {
        monitors: [],
        totalChanges: status.stats.totalChanges,
        totalAlerts: status.stats.totalAlerts
      };

      if (monitorIds && monitorIds.length > 0) {
        for (const monitorId of monitorIds) {
          const monitor = dashboardEngine.monitors.get(monitorId);
          if (monitor) {
            overview.monitors.push({
              ...monitor,
              changes: (dashboardEngine.changes.get(monitorId) || []).slice(0, 5),
              stats: {
                totalChanges: monitor.changeCount,
                totalAlerts: monitor.alertCount
              }
            });
          }
        }
      }

      // Get alerts if alert manager is available
      let alerts = null;
      if (alertManager) {
        const alertSummary = alertManager.getSummary();
        alerts = {
          summary: alertSummary,
          unread: alertManager.getUnreadAlerts({ limit: 10 })
        };
      }

      return {
        success: true,
        dashboard: {
          status,
          metrics,
          timeline,
          overview,
          alerts,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get recent changes for a specific monitor
   * @command get_monitor_changes
   * @param {string} params.monitor_id - Monitor ID
   * @param {Object} [params.options] - Query options
   * @returns {Object} Monitor changes with details
   */
  commandHandlers.get_monitor_changes = async (params) => {
    const { monitor_id, options = {} } = params;

    try {
      if (!monitor_id) {
        return { success: false, error: 'monitor_id is required' };
      }

      const monitor = dashboardEngine.monitors.get(monitor_id);
      if (!monitor) {
        return { success: false, error: `Monitor ${monitor_id} not found` };
      }

      const changes = dashboardEngine.changes.get(monitor_id) || [];
      const {
        limit = 100,
        offset = 0,
        category = null
      } = options;

      let filtered = changes;
      if (category) {
        filtered = filtered.filter(c => c.category === category);
      }

      const paginated = filtered.slice(offset, offset + limit);

      return {
        success: true,
        monitor: {
          id: monitor.id,
          name: monitor.name,
          url: monitor.url
        },
        changes: paginated,
        total: filtered.length,
        limit,
        offset,
        hasMore: offset + limit < filtered.length,
        timestamp: Date.now()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get comparison data between competitors
   * @command get_competitor_comparison
   * @param {Array<string>} params.monitor_ids - Monitor IDs to compare
   * @param {Object} [params.options] - Comparison options
   * @returns {Object} Comparison analysis
   */
  commandHandlers.get_competitor_comparison = async (params) => {
    const { monitor_ids, options = {} } = params;

    try {
      if (!Array.isArray(monitor_ids) || monitor_ids.length < 2) {
        return {
          success: false,
          error: 'monitor_ids must be an array with at least 2 items'
        };
      }

      const comparison = dashboardEngine.getComparison(monitor_ids, options);

      return {
        success: true,
        comparison,
        timestamp: Date.now()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get timeline of all changes
   * @command get_dashboard_timeline
   * @param {Object} params - Query parameters
   * @param {number} [params.limit] - Maximum entries to return
   * @param {number} [params.offset] - Pagination offset
   * @param {string} [params.category] - Filter by category
   * @param {number} [params.startTime] - Start time filter
   * @param {number} [params.endTime] - End time filter
   * @returns {Object} Timeline data
   */
  commandHandlers.get_dashboard_timeline = async (params) => {
    try {
      const {
        limit = 100,
        offset = 0,
        category = null,
        startTime = null,
        endTime = null
      } = params;

      const timeline = dashboardEngine.getTimeline({
        limit,
        offset,
        category,
        startTime,
        endTime
      });

      return {
        success: true,
        timeline,
        timestamp: Date.now()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get dashboard metrics
   * @command get_dashboard_metrics
   * @param {Array<string>} [params.metricTypes] - Specific metrics to retrieve
   * @returns {Object} Metrics data
   */
  commandHandlers.get_dashboard_metrics = async (params) => {
    try {
      const { metricTypes = null } = params;

      const metricsData = dashboardEngine.getMetrics(metricTypes);

      return {
        success: true,
        metrics: metricsData,
        timestamp: Date.now()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Only register alert commands if alert manager is available
  if (alertManager) {
    /**
     * Create a new alert
     * @command create_dashboard_alert
     * @param {Object} params - Alert data
     * @param {string} params.monitor_id - Monitor ID
     * @param {string} params.title - Alert title
     * @param {string} [params.message] - Alert message
     * @param {string} [params.severity] - Alert severity
     * @param {string} [params.type] - Alert type
     * @returns {Object} Created alert
     */
    commandHandlers.create_dashboard_alert = async (params) => {
      try {
        const {
          monitor_id,
          title,
          message = '',
          severity = 'medium',
          type = 'change_detected',
          metadata = {}
        } = params;

        const alert = alertManager.createAlert({
          monitorId: monitor_id,
          title,
          message,
          severity,
          type,
          metadata
        });

        return {
          success: true,
          alert,
          timestamp: Date.now()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Get alerts with filtering
     * @command get_dashboard_alerts
     * @param {Object} params - Filter options
     * @param {string} [params.status] - Filter by status
     * @param {string} [params.severity] - Filter by severity
     * @param {string} [params.monitor_id] - Filter by monitor
     * @param {number} [params.limit] - Result limit
     * @returns {Object} Filtered alerts
     */
    commandHandlers.get_dashboard_alerts = async (params) => {
      try {
        const {
          status = null,
          severity = null,
          monitor_id = null,
          limit = 100,
          offset = 0
        } = params;

        let alerts;

        if (status) {
          alerts = alertManager.getAlertsByStatus(status, { limit, offset });
        } else if (severity) {
          alerts = alertManager.getAlertsBySeverity(severity, { limit, offset });
        } else if (monitor_id) {
          alerts = alertManager.getMonitorAlerts(monitor_id, { limit, offset });
        } else {
          const allAlerts = Array.from(alertManager.alerts.values());
          const filtered = allAlerts.slice(offset, offset + limit);
          alerts = {
            alerts: filtered,
            total: allAlerts.length,
            limit,
            offset
          };
        }

        const summary = alertManager.getSummary();

        return {
          success: true,
          alerts,
          summary,
          timestamp: Date.now()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Get unread alerts
     * @command get_unread_alerts
     * @param {Object} params - Options
     * @param {number} [params.limit] - Result limit
     * @returns {Object} Unread alerts
     */
    commandHandlers.get_unread_alerts = async (params) => {
      try {
        const { limit = 50, offset = 0 } = params;

        const result = alertManager.getUnreadAlerts({ limit, offset });

        return {
          success: true,
          alerts: result.alerts,
          total: result.total,
          timestamp: Date.now()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Mark alert as read
     * @command mark_alert_read
     * @param {string} params.alert_id - Alert ID
     * @returns {Object} Updated alert
     */
    commandHandlers.mark_alert_read = async (params) => {
      const { alert_id } = params;

      try {
        if (!alert_id) {
          return { success: false, error: 'alert_id is required' };
        }

        const alert = alertManager.markAsRead(alert_id);

        return {
          success: true,
          alert,
          timestamp: Date.now()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Batch mark alerts as read
     * @command batch_mark_alerts_read
     * @param {Array<string>} params.alert_ids - Alert IDs
     * @returns {Object} Update result
     */
    commandHandlers.batch_mark_alerts_read = async (params) => {
      const { alert_ids } = params;

      try {
        if (!Array.isArray(alert_ids)) {
          return { success: false, error: 'alert_ids must be an array' };
        }

        const updated = alertManager.batchMarkAsRead(alert_ids);

        return {
          success: true,
          count: updated.length,
          timestamp: Date.now()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Acknowledge alert
     * @command acknowledge_alert
     * @param {string} params.alert_id - Alert ID
     * @returns {Object} Updated alert
     */
    commandHandlers.acknowledge_alert = async (params) => {
      const { alert_id } = params;

      try {
        if (!alert_id) {
          return { success: false, error: 'alert_id is required' };
        }

        const alert = alertManager.acknowledgeAlert(alert_id);

        return {
          success: true,
          alert,
          timestamp: Date.now()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Batch acknowledge alerts
     * @command batch_acknowledge_alerts
     * @param {Array<string>} params.alert_ids - Alert IDs
     * @returns {Object} Update result
     */
    commandHandlers.batch_acknowledge_alerts = async (params) => {
      const { alert_ids } = params;

      try {
        if (!Array.isArray(alert_ids)) {
          return { success: false, error: 'alert_ids must be an array' };
        }

        const updated = alertManager.batchAcknowledge(alert_ids);

        return {
          success: true,
          count: updated.length,
          timestamp: Date.now()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Dismiss alert
     * @command dismiss_alert
     * @param {string} params.alert_id - Alert ID
     * @returns {Object} Updated alert
     */
    commandHandlers.dismiss_alert = async (params) => {
      const { alert_id } = params;

      try {
        if (!alert_id) {
          return { success: false, error: 'alert_id is required' };
        }

        const alert = alertManager.dismissAlert(alert_id);

        return {
          success: true,
          alert,
          timestamp: Date.now()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Batch dismiss alerts
     * @command batch_dismiss_alerts
     * @param {Array<string>} params.alert_ids - Alert IDs
     * @returns {Object} Update result
     */
    commandHandlers.batch_dismiss_alerts = async (params) => {
      const { alert_ids } = params;

      try {
        if (!Array.isArray(alert_ids)) {
          return { success: false, error: 'alert_ids must be an array' };
        }

        const updated = alertManager.batchDismiss(alert_ids);

        return {
          success: true,
          count: updated.length,
          timestamp: Date.now()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    /**
     * Get alert summary
     * @command get_alert_summary
     * @returns {Object} Alert statistics
     */
    commandHandlers.get_alert_summary = async (params) => {
      try {
        const summary = alertManager.getSummary();

        return {
          success: true,
          summary,
          timestamp: Date.now()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
  }

  /**
   * Get dashboard status
   * @command get_dashboard_status
   * @returns {Object} Dashboard status information
   */
  commandHandlers.get_dashboard_status = async (params) => {
    try {
      const status = dashboardEngine.getStatus();

      return {
        success: true,
        status,
        timestamp: Date.now()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Create a custom dashboard view
   * @command create_dashboard_view
   * @param {string} params.view_id - View identifier
   * @param {string} params.type - View type (overview, timeline, comparison, metrics, alerts)
   * @param {Array<string>} [params.monitor_ids] - Monitors to include
   * @param {Object} [params.options] - View options
   * @returns {Object} Created view
   */
  commandHandlers.create_dashboard_view = async (params) => {
    try {
      const {
        view_id,
        type,
        monitor_ids = [],
        options = {}
      } = params;

      const view = dashboardEngine.createView(view_id, {
        type,
        monitorIds: monitor_ids,
        options
      });

      return {
        success: true,
        view,
        timestamp: Date.now()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get a dashboard view
   * @command get_dashboard_view
   * @param {string} params.view_id - View identifier
   * @returns {Object} View with rendered content
   */
  commandHandlers.get_dashboard_view = async (params) => {
    try {
      const { view_id } = params;

      if (!view_id) {
        return { success: false, error: 'view_id is required' };
      }

      const view = dashboardEngine.getView(view_id);

      if (!view) {
        return { success: false, error: `View ${view_id} not found` };
      }

      return {
        success: true,
        view,
        timestamp: Date.now()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

module.exports = {
  registerDashboardCommands
};
