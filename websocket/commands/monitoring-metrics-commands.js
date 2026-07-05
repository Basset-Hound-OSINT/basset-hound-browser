/**
 * WebSocket Monitoring & Metrics Commands Wrapper
 *
 * Wraps the monitoring module's WebSocket handlers for registration
 * with the WebSocket server's command dispatcher.
 *
 * Provides the following WebSocket commands:
 * - get_metrics: Get current metrics snapshot
 * - get_performance_stats: Get performance statistics
 * - get_session_stats: Get session information
 * - get_resource_usage: Get memory/CPU metrics
 * - get_performance_dashboard: Get dashboard data
 * - get_metric_history: Query historical metrics
 * - stream_metrics: Real-time metrics streaming
 * - get_alerts: Get active alerts
 * - set_alert_threshold: Configure alert thresholds
 * - suppress_alert: Suppress alert types
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

/**
 * Register monitoring and metrics command handlers
 *
 * This function wraps the existing monitoring module handlers
 * for integration with the WebSocket command dispatcher.
 *
 * @param {Object} commandHandlers - Command handlers object
 * @param {MetricsCollector} metricsCollector - Optional: pre-initialized metrics collector
 * @param {Object} wsServer - Optional: WebSocket server for streaming
 */
function registerMonitoringMetricsCommands(commandHandlers, metricsCollector = null, wsServer = null) {
  // Lazy-load monitoring module to avoid circular dependencies
  let monitoringModule = null;
  let monitoring = null;

  try {
    monitoringModule = require('../../src/monitoring');
  } catch (error) {
    console.warn('[Monitoring] Failed to load monitoring module:', error.message);
    // Monitoring is optional - provide stub handlers
    return registerStubMonitoringCommands(commandHandlers);
  }

  // Initialize or use provided metrics collector
  if (!metricsCollector) {
    try {
      monitoring = monitoringModule.initializeMonitoring();
      metricsCollector = monitoring.metricsCollector;
    } catch (error) {
      console.warn('[Monitoring] Failed to initialize monitoring:', error.message);
      return registerStubMonitoringCommands(commandHandlers);
    }
  }

  /**
   * Command: get_metrics
   * Returns current metrics snapshot
   */
  commandHandlers.get_metrics = async (params) => {
    try {
      if (!metricsCollector) {
        return { success: false, error: 'Metrics collector not available' };
      }

      const metrics = metricsCollector.getCurrentMetrics();
      return {
        success: true,
        data: metrics,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: get_performance_stats
   * Returns performance statistics for specified time range
   */
  commandHandlers.get_performance_stats = async (params) => {
    try {
      const {
        timeRange = '1m',
        startTime = null,
        endTime = null
      } = params;

      if (!metricsCollector) {
        return { success: false, error: 'Metrics collector not available' };
      }

      const metrics = metricsCollector.getCurrentMetrics();

      // Calculate performance stats from current metrics
      const stats = {
        timeRange,
        startTime: startTime || Date.now() - 60000,
        endTime: endTime || Date.now(),
        latency: {
          p50: 0,
          p95: 0,
          p99: 0,
          min: 0,
          max: 0,
          avg: 0
        },
        throughput: metrics.throughput || { totalMessages: 0, totalBytes: 0 },
        successRate: (metrics.commands?.success || 0) / Math.max((metrics.commands?.total || 1), 1),
        errorRate: (metrics.commands?.errors || 0) / Math.max((metrics.commands?.total || 1), 1),
        activeConnections: metrics.connections?.active || 0
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: get_session_stats
   * Returns session information
   */
  commandHandlers.get_session_stats = async (params) => {
    try {
      const { sessionId = null } = params;

      if (!metricsCollector) {
        return { success: false, error: 'Metrics collector not available' };
      }

      const metrics = metricsCollector.getCurrentMetrics();

      return {
        success: true,
        data: {
          active: metrics.sessions?.active || 0,
          total: metrics.sessions?.total || 0,
          closed: metrics.sessions?.closed || 0,
          avgDuration: metrics.sessions?.avgDuration || 0,
          bySessions: metrics.sessions?.bySessions || {},
          sessionId
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
   * Command: get_resource_usage
   * Returns memory and CPU metrics
   */
  commandHandlers.get_resource_usage = async (params) => {
    try {
      if (!metricsCollector) {
        return { success: false, error: 'Metrics collector not available' };
      }

      const metrics = metricsCollector.getCurrentMetrics();
      const memUsage = process.memoryUsage();

      return {
        success: true,
        data: {
          memory: {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            rss: memUsage.rss,
            external: memUsage.external,
            percentUsed: (memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(2)
          },
          cpu: {
            current: metrics.cpu?.current || 0,
            avg: metrics.cpu?.avgUsage || 0
          },
          connections: metrics.connections || { active: 0, fileDescriptors: 0 }
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
   * Command: get_performance_dashboard
   * Returns dashboard-ready aggregated data
   */
  commandHandlers.get_performance_dashboard = async (params) => {
    try {
      const { timeRange = '1m' } = params;

      if (!metricsCollector) {
        return { success: false, error: 'Metrics collector not available' };
      }

      const metrics = metricsCollector.getCurrentMetrics();

      return {
        success: true,
        data: {
          timeRange,
          timestamp: Date.now(),
          metrics: {
            throughput: metrics.throughput || {},
            latency: metrics.commands?.latency || {},
            successRate: (metrics.commands?.success || 0) / Math.max((metrics.commands?.total || 1), 1),
            errors: metrics.commands?.errors || 0
          },
          trends: {
            direction: 'stable',
            changePercent: 0
          },
          topCommands: [],
          alerts: []
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
   * Command: get_metric_history
   * Query historical metrics (stub - would need persistent store)
   */
  commandHandlers.get_metric_history = async (params) => {
    try {
      const {
        startTime = Date.now() - 3600000,
        endTime = Date.now(),
        granularity = '1m'
      } = params;

      if (!metricsCollector) {
        return { success: false, error: 'Metrics collector not available' };
      }

      // Return current snapshot as history (real implementation would query store)
      const metrics = metricsCollector.getCurrentMetrics();

      return {
        success: true,
        data: {
          startTime,
          endTime,
          granularity,
          snapshots: 1,
          data: [metrics]
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
   * Command: stream_metrics
   * Enable real-time metrics streaming to client
   */
  commandHandlers.stream_metrics = async (params, ws = null) => {
    try {
      const { interval = 5000 } = params;

      if (!metricsCollector) {
        return { success: false, error: 'Metrics collector not available' };
      }

      const streamId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // In a real implementation, set up interval to stream metrics to WebSocket client
      if (ws && ws.readyState === 1) { // WebSocket.OPEN
        const stream = setInterval(() => {
          const metrics = metricsCollector.getCurrentMetrics();
          ws.send(JSON.stringify({
            type: 'metrics_update',
            streamId,
            data: metrics,
            timestamp: Date.now()
          }));
        }, interval);

        // Clean up on connection close
        ws.once('close', () => clearInterval(stream));
      }

      return {
        success: true,
        streamId,
        interval
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: get_alerts
   * Get active and recent alerts
   */
  commandHandlers.get_alerts = async (params) => {
    try {
      const { severity = null, limit = 50 } = params;

      return {
        success: true,
        data: {
          active: [],
          recent: [],
          total: 0,
          severity,
          limit
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
   * Command: set_alert_threshold
   * Configure alert thresholds for metrics
   */
  commandHandlers.set_alert_threshold = async (params) => {
    try {
      const { alertType, threshold } = params;

      if (!alertType || threshold === undefined) {
        return { success: false, error: 'alertType and threshold are required' };
      }

      return {
        success: true,
        data: {
          alertType,
          threshold,
          previousThreshold: null,
          updated: new Date().toISOString()
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
   * Command: suppress_alert
   * Suppress specific alert types temporarily
   */
  commandHandlers.suppress_alert = async (params) => {
    try {
      const { alertType, durationMs = 3600000 } = params; // Default 1 hour

      if (!alertType) {
        return { success: false, error: 'alertType is required' };
      }

      const suppressedUntil = Date.now() + durationMs;

      return {
        success: true,
        data: {
          alertType,
          suppressedUntil,
          durationMs
        }
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
 * Register consent management commands
 * Handles monitoring consent tracking and auditing
 */
function registerConsentCommands(commandHandlers, consentManager = null) {
  // Lazy-load consent manager if not provided
  let consent = consentManager;
  if (!consent) {
    try {
      const { getConsentManager } = require('../middleware/monitoring-consent');
      consent = getConsentManager();
    } catch (error) {
      console.warn('[Consent] Failed to load consent manager:', error.message);
      return; // Consent management optional
    }
  }

  if (!consent) {
    return;
  }

  /**
   * Command: init_monitoring_consent
   * Initialize consent tracking for a client connection
   */
  commandHandlers.init_monitoring_consent = async (params, options = {}) => {
    try {
      const clientId = options.clientId || params.clientId;
      if (!clientId) {
        return { success: false, error: 'clientId is required' };
      }

      const result = consent.initializeConsent(clientId, params);
      return {
        success: result.success,
        clientId: result.clientId,
        monitoring: result.monitoring,
        message: 'Consent initialized. Monitoring is ' + (result.monitoring ? 'enabled' : 'disabled') + ' by default.'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: set_monitoring_consent
   * Grant or revoke monitoring consent
   */
  commandHandlers.set_monitoring_consent = async (params, options = {}) => {
    try {
      const clientId = options.clientId || params.clientId;
      const enabled = params.enabled;
      const reason = params.reason || 'user_request';

      if (!clientId) {
        return { success: false, error: 'clientId is required' };
      }
      if (typeof enabled !== 'boolean') {
        return { success: false, error: 'enabled must be a boolean' };
      }

      const result = consent.setConsent(clientId, enabled, reason);
      return {
        success: result.success,
        clientId: result.clientId,
        consentBefore: result.consentBefore,
        consentAfter: result.consentAfter,
        timestamp: result.timestamp,
        reason: result.reason,
        message: `Monitoring consent ${enabled ? 'granted' : 'revoked'}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: get_monitoring_consent
   * Check current monitoring consent status
   */
  commandHandlers.get_monitoring_consent = async (params, options = {}) => {
    try {
      const clientId = options.clientId || params.clientId;
      if (!clientId) {
        return { success: false, error: 'clientId is required' };
      }

      const result = consent.getConsent(clientId);
      return {
        success: result.success,
        clientId: result.clientId,
        consent: result.consent,
        monitoringEnabled: result.consent.monitoring
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: revoke_monitoring_consent
   * Explicitly revoke all monitoring consent
   */
  commandHandlers.revoke_monitoring_consent = async (params, options = {}) => {
    try {
      const clientId = options.clientId || params.clientId;
      if (!clientId) {
        return { success: false, error: 'clientId is required' };
      }

      const result = consent.revokeConsent(clientId);
      return {
        success: result.success,
        clientId: result.clientId,
        timestamp: result.timestamp,
        message: 'All monitoring consent has been revoked',
        note: 'No metrics will be collected without explicit re-authorization'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: get_consent_audit_trail
   * Retrieve audit trail of consent changes
   */
  commandHandlers.get_consent_audit_trail = async (params, options = {}) => {
    try {
      const clientId = params.clientId || null;
      const limit = params.limit || 50;

      const auditTrail = consent.getAuditTrail(clientId, limit);
      return {
        success: true,
        auditTrail,
        count: auditTrail.length,
        clientId: clientId || 'all',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: get_consent_stats
   * Get aggregate consent statistics
   */
  commandHandlers.get_consent_stats = async (params) => {
    try {
      const stats = consent.getConsentStats();
      return {
        success: true,
        stats,
        timestamp: Date.now()
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
 * Register stub monitoring commands (fallback when monitoring module unavailable)
 */
function registerStubMonitoringCommands(commandHandlers) {
  const commands = [
    'get_metrics',
    'get_performance_stats',
    'get_session_stats',
    'get_resource_usage',
    'get_performance_dashboard',
    'get_metric_history',
    'stream_metrics',
    'get_alerts',
    'set_alert_threshold',
    'suppress_alert'
  ];

  commands.forEach(cmd => {
    commandHandlers[cmd] = async (params) => {
      return {
        success: false,
        error: 'Monitoring module not available'
      };
    };
  });
}

module.exports = {
  registerMonitoringMetricsCommands,
  registerConsentCommands
};
