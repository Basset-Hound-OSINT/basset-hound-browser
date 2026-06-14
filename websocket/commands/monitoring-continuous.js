/**
 * Continuous Monitoring WebSocket Commands
 *
 * WebSocket API commands for multi-target continuous monitoring:
 * - `start_monitoring` - Begin monitoring target(s)
 * - `stop_monitoring` - Stop monitoring target
 * - `get_monitor_status` - Current status
 * - `get_monitored_targets` - List all monitored
 * - `configure_monitoring` - Set polling interval, sensitivity
 * - `get_monitor_events` - Historical events
 * - `pause_monitoring` - Pause target monitoring
 * - `resume_monitoring` - Resume target monitoring
 * - `set_monitor_priority` - Adjust priority level
 *
 * Response: {targets_monitored, events, resource_usage}
 *
 * @module websocket/commands/monitoring-continuous
 */

const path = require('path');

// Singleton coordinator instance
let monitoringCoordinator = null;

/**
 * Get or create monitoring coordinator
 * @param {Object} mainWindow - Main window reference
 * @returns {Object} Monitoring coordinator instance
 */
function getCoordinator(mainWindow) {
  if (!monitoringCoordinator) {
    try {
      const { MonitoringCoordinator } = require('../../src/monitoring/monitoring-coordinator');
      monitoringCoordinator = new MonitoringCoordinator({
        maxMonitors: 100,
        maxConcurrentChecks: 15,
        enableResourceManagement: true
      });
    } catch (error) {
      console.error('Failed to initialize monitoring coordinator:', error);
      throw error;
    }
  }
  return monitoringCoordinator;
}

/**
 * Register continuous monitoring commands with WebSocket server
 *
 * @param {Object} server - WebSocket server instance
 * @param {Object} mainWindow - Main Electron window
 */
function registerContinuousMonitoringCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  /**
   * Start monitoring one or more targets
   *
   * @command start_monitoring
   * @param {string} params.target_id - Unique target identifier
   * @param {string} params.url - URL to monitor
   * @param {Object} [params.config] - Monitor configuration
   * @param {number} [params.config.interval=60000] - Check interval in ms (5000-600000)
   * @param {number} [params.config.priority=3] - Priority level (1-5)
   * @param {number} [params.config.sensitivity=0.1] - Change detection sensitivity (0-1)
   * @param {boolean} [params.config.capture_screenshots=true] - Capture page screenshots
   * @param {boolean} [params.config.capture_dom=true] - Capture DOM content
   * @param {boolean} [params.config.capture_network=false] - Capture network metrics
   * @param {boolean} [params.config.capture_technology=true] - Detect technology stack
   * @param {Array<string>} [params.config.tags] - Tags for organization
   * @returns {Object} {success, target_id, targets_monitored, next_check_in}
   */
  commandHandlers.start_monitoring = async (params) => {
    try {
      const { target_id, url, config = {} } = params;

      if (!target_id || !url) {
        return {
          success: false,
          error: 'target_id and url are required',
          code: 'MISSING_PARAMETERS'
        };
      }

      const coordinator = getCoordinator(mainWindow);

      // Initialize browser API if not already done
      if (!coordinator.browserApi) {
        // Create mock browser API for testing (would integrate with actual browser)
        coordinator.initializeBrowserApi({
          getPageContent: async (url) => '<html></html>',
          takeScreenshot: async (url) => Buffer.alloc(0),
          detectTechnology: async (url) => [],
          getPerformanceMetrics: async (url) => ({ loadTime: 0 }),
          getPageStatus: async (url) => 200
        });
      }

      const result = await coordinator.addMonitor(target_id, url, {
        checkInterval: Math.max(5000, Math.min(600000, config.interval || 60000)),
        priority: config.priority || 3,
        changeDetectionSensitivity: config.sensitivity || 0.1,
        captureScreenshots: config.capture_screenshots !== false,
        captureDOM: config.capture_dom !== false,
        captureNetwork: config.capture_network === true,
        captureTechnology: config.capture_technology !== false,
        tags: config.tags || [],
        metadata: config.metadata || {}
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          code: 'MONITORING_FAILED'
        };
      }

      const status = coordinator.getStatus();

      return {
        success: true,
        target_id: result.targetId,
        url: result.targetUrl,
        targets_monitored: result.monitorCount,
        next_check_in: 'immediately scheduled',
        resource_usage: {
          memory_percent: Math.round(status.resourceMetrics.memoryUsage * 100),
          active_connections: status.resourceMetrics.activeConnections,
          degradation_level: status.degradationLevel
        }
      };
    } catch (error) {
      console.error('Error starting monitoring:', error);
      return {
        success: false,
        error: error.message,
        code: 'INTERNAL_ERROR'
      };
    }
  };

  /**
   * Stop monitoring a target
   *
   * @command stop_monitoring
   * @param {string} params.target_id - Target ID to stop monitoring
   * @returns {Object} {success, target_id, targets_monitored}
   */
  commandHandlers.stop_monitoring = async (params) => {
    try {
      const { target_id } = params;

      if (!target_id) {
        return {
          success: false,
          error: 'target_id is required',
          code: 'MISSING_PARAMETER'
        };
      }

      const coordinator = getCoordinator(mainWindow);
      const result = coordinator.removeMonitor(target_id);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          code: 'MONITOR_NOT_FOUND'
        };
      }

      return {
        success: true,
        target_id: result.targetId,
        targets_monitored: result.monitorCount
      };
    } catch (error) {
      console.error('Error stopping monitoring:', error);
      return {
        success: false,
        error: error.message,
        code: 'INTERNAL_ERROR'
      };
    }
  };

  /**
   * Get current monitoring status
   *
   * @command get_monitor_status
   * @param {string} [params.target_id] - Optional target ID (if not specified, returns all)
   * @returns {Object} {success, targets_monitored, monitors, resource_usage, coordinator_state}
   */
  commandHandlers.get_monitor_status = async (params) => {
    try {
      const { target_id } = params || {};
      const coordinator = getCoordinator(mainWindow);
      const status = coordinator.getStatus();

      let monitors = status.monitorDetails || [];

      // Filter to specific target if requested
      if (target_id) {
        monitors = monitors.filter(m => m.targetId === target_id);
        if (monitors.length === 0) {
          return {
            success: false,
            error: `Monitor ${target_id} not found`,
            code: 'MONITOR_NOT_FOUND'
          };
        }
      }

      return {
        success: true,
        targets_monitored: status.totalMonitors,
        coordinator_state: status.state,
        monitors: monitors.map(m => ({
          target_id: m.targetId,
          url: m.targetUrl,
          state: m.state,
          checks_completed: m.checkCount,
          errors: m.errorCount,
          last_check: m.lastCheck?.timestamp || null,
          uptime_seconds: Math.floor((Date.now() - m.checkCount) / 1000),
          metrics: {
            avg_check_time_ms: Math.round(m.metrics.averageCheckTime),
            success_rate_percent: Math.round(m.metrics.successRate),
            avg_content_size_bytes: Math.round(m.metrics.averageContentSize)
          }
        })),
        resource_usage: {
          memory_percent: Math.round(status.resourceMetrics.memoryUsage * 100),
          active_connections: status.resourceMetrics.activeConnections,
          degradation_level: status.degradationLevel
        },
        statistics: {
          total_checks_run: status.stats.totalChecksRun,
          total_changes_detected: status.stats.totalChangesDetected,
          total_errors: status.stats.totalErrorsEncountered
        },
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error getting monitor status:', error);
      return {
        success: false,
        error: error.message,
        code: 'INTERNAL_ERROR'
      };
    }
  };

  /**
   * Get list of all monitored targets
   *
   * @command get_monitored_targets
   * @param {number} [params.limit=100] - Maximum targets to return
   * @returns {Object} {success, targets, total_monitored}
   */
  commandHandlers.get_monitored_targets = async (params) => {
    try {
      const { limit = 100 } = params || {};
      const coordinator = getCoordinator(mainWindow);
      const status = coordinator.getStatus();

      const targets = (status.monitorDetails || [])
        .slice(0, limit)
        .map(m => ({
          target_id: m.targetId,
          url: m.targetUrl,
          state: m.state,
          checks_completed: m.checkCount,
          last_check_time: m.lastCheck?.timestamp || null,
          change_detected: m.lastCheck?.changed || false
        }));

      return {
        success: true,
        targets,
        total_monitored: status.totalMonitors,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error getting monitored targets:', error);
      return {
        success: false,
        error: error.message,
        code: 'INTERNAL_ERROR'
      };
    }
  };

  /**
   * Configure monitoring parameters
   *
   * @command configure_monitoring
   * @param {string} params.target_id - Target ID to configure
   * @param {Object} params.config - Configuration parameters
   * @param {number} [params.config.interval] - New check interval in ms
   * @param {number} [params.config.sensitivity] - New sensitivity (0-1)
   * @param {number} [params.config.priority] - New priority (1-5)
   * @returns {Object} {success, target_id, configuration}
   */
  commandHandlers.configure_monitoring = async (params) => {
    try {
      const { target_id, config = {} } = params;

      if (!target_id) {
        return {
          success: false,
          error: 'target_id is required',
          code: 'MISSING_PARAMETER'
        };
      }

      const coordinator = getCoordinator(mainWindow);
      const monitor = coordinator.monitors.get(target_id);

      if (!monitor) {
        return {
          success: false,
          error: `Monitor ${target_id} not found`,
          code: 'MONITOR_NOT_FOUND'
        };
      }

      // Update monitor options
      if (config.interval) {
        monitor.options.checkInterval = Math.max(5000, Math.min(600000, config.interval));
      }
      if (config.sensitivity !== undefined) {
        monitor.options.changeDetectionSensitivity = Math.max(0, Math.min(1, config.sensitivity));
      }
      if (config.priority) {
        coordinator.scheduler.updateMonitorPriority(target_id, config.priority);
      }

      return {
        success: true,
        target_id,
        configuration: {
          interval_ms: monitor.options.checkInterval,
          sensitivity: monitor.options.changeDetectionSensitivity,
          priority: monitor.options.priority
        }
      };
    } catch (error) {
      console.error('Error configuring monitoring:', error);
      return {
        success: false,
        error: error.message,
        code: 'INTERNAL_ERROR'
      };
    }
  };

  /**
   * Get historical monitoring events
   *
   * @command get_monitor_events
   * @param {string} [params.target_id] - Optional target ID filter
   * @param {string} [params.event_type] - Optional event type filter
   * @param {number} [params.limit=100] - Maximum events to return
   * @returns {Object} {success, events, total_recorded}
   */
  commandHandlers.get_monitor_events = async (params) => {
    try {
      const { target_id, event_type, limit = 100 } = params || {};
      const coordinator = getCoordinator(mainWindow);

      let events = coordinator.getEvents(limit * 2); // Get extra to filter

      // Filter by target ID if specified
      if (target_id) {
        events = events.filter(e => e.data?.targetId === target_id || e.data?.monitorId === target_id);
      }

      // Filter by event type if specified
      if (event_type) {
        events = events.filter(e => e.type === event_type);
      }

      // Return limited set
      events = events.slice(-limit);

      return {
        success: true,
        events: events.map(e => ({
          type: e.type,
          target_id: e.data?.targetId || e.data?.monitorId,
          timestamp: e.timestamp,
          data: e.data
        })),
        total_recorded: coordinator.eventQueue.length,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error getting monitor events:', error);
      return {
        success: false,
        error: error.message,
        code: 'INTERNAL_ERROR'
      };
    }
  };

  /**
   * Pause monitoring for a target
   *
   * @command pause_monitoring
   * @param {string} params.target_id - Target ID to pause
   * @returns {Object} {success, target_id, state}
   */
  commandHandlers.pause_monitoring = async (params) => {
    try {
      const { target_id } = params;

      if (!target_id) {
        return {
          success: false,
          error: 'target_id is required',
          code: 'MISSING_PARAMETER'
        };
      }

      const coordinator = getCoordinator(mainWindow);
      const monitor = coordinator.monitors.get(target_id);

      if (!monitor) {
        return {
          success: false,
          error: `Monitor ${target_id} not found`,
          code: 'MONITOR_NOT_FOUND'
        };
      }

      monitor.pauseMonitoring();
      coordinator.scheduler.pauseMonitor(target_id);

      return {
        success: true,
        target_id,
        state: monitor.state
      };
    } catch (error) {
      console.error('Error pausing monitoring:', error);
      return {
        success: false,
        error: error.message,
        code: 'INTERNAL_ERROR'
      };
    }
  };

  /**
   * Resume monitoring for a target
   *
   * @command resume_monitoring
   * @param {string} params.target_id - Target ID to resume
   * @returns {Object} {success, target_id, state}
   */
  commandHandlers.resume_monitoring = async (params) => {
    try {
      const { target_id } = params;

      if (!target_id) {
        return {
          success: false,
          error: 'target_id is required',
          code: 'MISSING_PARAMETER'
        };
      }

      const coordinator = getCoordinator(mainWindow);
      const monitor = coordinator.monitors.get(target_id);

      if (!monitor) {
        return {
          success: false,
          error: `Monitor ${target_id} not found`,
          code: 'MONITOR_NOT_FOUND'
        };
      }

      monitor.resumeMonitoring();
      coordinator.scheduler.resumeMonitor(target_id);

      return {
        success: true,
        target_id,
        state: monitor.state
      };
    } catch (error) {
      console.error('Error resuming monitoring:', error);
      return {
        success: false,
        error: error.message,
        code: 'INTERNAL_ERROR'
      };
    }
  };

  /**
   * Set monitor priority
   *
   * @command set_monitor_priority
   * @param {string} params.target_id - Target ID
   * @param {number} params.priority - Priority level (1-5)
   * @returns {Object} {success, target_id, priority}
   */
  commandHandlers.set_monitor_priority = async (params) => {
    try {
      const { target_id, priority } = params;

      if (!target_id || priority === undefined) {
        return {
          success: false,
          error: 'target_id and priority are required',
          code: 'MISSING_PARAMETERS'
        };
      }

      const coordinator = getCoordinator(mainWindow);
      const result = coordinator.scheduler.updateMonitorPriority(target_id, priority);

      return {
        success: result.success,
        target_id,
        priority: result.priority,
        error: result.error
      };
    } catch (error) {
      console.error('Error setting priority:', error);
      return {
        success: false,
        error: error.message,
        code: 'INTERNAL_ERROR'
      };
    }
  };
}

module.exports = {
  registerContinuousMonitoringCommands
};
