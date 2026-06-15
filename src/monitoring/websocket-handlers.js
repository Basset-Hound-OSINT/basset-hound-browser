/**
 * WebSocket Monitoring Command Handlers
 *
 * Provides the following WebSocket commands:
 * - get_metrics: Get current metrics snapshot
 * - get_performance_stats: Get performance statistics for time range
 * - get_session_stats: Get session information
 * - get_resource_usage: Get memory/CPU metrics
 * - get_performance_dashboard: Get dashboard-ready data
 * - get_metric_history: Query historical metrics
 * - stream_metrics: Real-time metrics streaming
 * - get_alerts: Get active alerts
 * - set_alert_threshold: Configure alert thresholds
 * - suppress_alert: Suppress specific alert types
 */

/**
 * Register monitoring command handlers with the command dispatcher
 * @param {CommandDispatcher} dispatcher - The command dispatcher
 * @param {MetricsCollector} metricsCollector - The metrics collector instance
 * @param {MetricsAggregator} aggregator - The metrics aggregator instance
 * @param {AlertManager} alertManager - The alert manager instance
 * @param {MetricsStore} metricsStore - The metrics store instance
 * @param {WebSocketServer} wsServer - The WebSocket server for streaming
 */
function registerMonitoringHandlers(dispatcher, metricsCollector, aggregator, alertManager, metricsStore, wsServer) {
  /**
   * Command: get_metrics
   * Returns current metrics snapshot
   */
  dispatcher.register('get_metrics', async (params, options) => {
    try {
      const metrics = metricsCollector.getCurrentMetrics();
      return {
        success: true,
        data: metrics
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Command: get_performance_stats
   * Returns performance statistics for specified time range
   */
  dispatcher.register('get_performance_stats', async (params, options) => {
    try {
      const {
        timeRange = '1m',
        startTime = null,
        endTime = null
      } = params;

      let start, end;

      if (timeRange === 'custom' && startTime && endTime) {
        start = startTime;
        end = endTime;
      } else {
        end = Date.now();
        const windowMs = {
          '1m': 60000,
          '5m': 300000,
          '1h': 3600000
        }[timeRange] || 60000;
        start = end - windowMs;
      }

      // Query historical data
      const snapshots = metricsStore.queryRange(start, end, '1m');

      if (snapshots.length === 0) {
        return {
          success: true,
          data: {
            timeRange,
            startTime: start,
            endTime: end,
            snapshots: 0,
            message: 'No data available for this time range'
          }
        };
      }

      // Aggregate statistics
      const latencies = [];
      let totalMessages = 0;
      let totalBytes = 0;
      let totalSuccess = 0;
      let totalCommands = 0;
      let totalErrors = 0;

      snapshots.forEach(snap => {
        if (snap.metrics.commands.latency.samples) {
          latencies.push(...snap.metrics.commands.latency.samples);
        }
        totalMessages += snap.metrics.throughput.totalMessages || 0;
        totalBytes += snap.metrics.throughput.totalBytes || 0;
        totalSuccess += snap.metrics.commands.success || 0;
        totalCommands += snap.metrics.commands.total || 0;
        totalErrors += snap.metrics.errors.total || 0;
      });

      // Calculate percentiles
      const sorted = latencies.sort((a, b) => a - b);
      const p50Index = Math.ceil(sorted.length * 0.50) - 1;
      const p95Index = Math.ceil(sorted.length * 0.95) - 1;
      const p99Index = Math.ceil(sorted.length * 0.99) - 1;

      return {
        success: true,
        data: {
          timeRange,
          startTime: start,
          endTime: end,
          snapshots: snapshots.length,
          latency: {
            p50: sorted[Math.max(0, p50Index)],
            p95: sorted[Math.max(0, p95Index)],
            p99: sorted[Math.max(0, p99Index)],
            avg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
            min: sorted[0],
            max: sorted[sorted.length - 1]
          },
          throughput: {
            messagesPerSecond: totalMessages / ((end - start) / 1000),
            bytesPerSecond: totalBytes / ((end - start) / 1000)
          },
          successRate: totalCommands > 0 ? (totalSuccess / totalCommands) * 100 : 0,
          errorRate: (totalErrors / totalCommands) * 100 || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Command: get_session_stats
   * Returns session statistics
   */
  dispatcher.register('get_session_stats', async (params, options) => {
    try {
      const { sessionId = null } = params;
      const metrics = metricsCollector.getCurrentMetrics();

      if (sessionId) {
        // Get stats for specific session
        const sessionStats = metrics.sessions.bySession?.[sessionId];
        return {
          success: true,
          data: sessionStats || {
            error: 'Session not found',
            sessionId
          }
        };
      }

      // Return global session stats
      return {
        success: true,
        data: {
          active: metrics.sessions.active,
          total: metrics.sessions.total,
          closed: metrics.sessions.closed,
          avgDuration: metrics.sessions.avgDuration,
          avgCommandsPerSession: metrics.sessions.avgCommandsPerSession,
          bySessions: Object.entries(metrics.sessions.bySession || {})
            .map(([id, stats]) => ({
              sessionId: id,
              ...stats
            }))
            .slice(-100) // Last 100 sessions
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Command: get_resource_usage
   * Returns resource usage metrics
   */
  dispatcher.register('get_resource_usage', async (params, options) => {
    try {
      const metrics = metricsCollector.getCurrentMetrics();

      return {
        success: true,
        data: {
          memory: {
            heapUsed: metrics.resources.memory.heapUsed,
            heapTotal: metrics.resources.memory.heapTotal,
            percent: metrics.resources.memory.percentUsed,
            growth: metrics.resources.memory.growthRate // MB/hour
          },
          cpu: {
            current: metrics.resources.cpu.usage,
            avg: metrics.resources.cpu.avgUsage
          },
          connections: {
            websocket: metrics.connections.active,
            fileDescriptors: metrics.resources.connections.fileDescriptors
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Command: get_performance_dashboard
   * Returns dashboard-ready performance data
   */
  dispatcher.register('get_performance_dashboard', async (params, options) => {
    try {
      const { timeRange = '1m' } = params;
      const metrics = metricsCollector.getCurrentMetrics();

      // Get aggregated data
      const aggregated = aggregator.aggregate(metrics, timeRange);

      // Get top commands by count
      const topCommands = Object.entries(metrics.commands.byCommand)
        .map(([name, stats]) => ({
          name,
          count: stats.count,
          successCount: stats.successCount,
          errorCount: stats.errorCount,
          avgLatency: stats.latency.avg,
          lastExecuted: stats.lastExecuted
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Get active alerts
      const activeAlerts = alertManager.getActiveAlerts();

      return {
        success: true,
        data: {
          timestamp: Date.now(),
          timeRange,
          metrics: aggregated.metrics,
          trends: aggregated.trends,
          topCommands,
          alerts: activeAlerts.map(a => ({
            type: a.type,
            severity: a.severity,
            metric: a.metric,
            threshold: a.threshold,
            actualValue: a.actualValue,
            timestamp: a.timestamp
          }))
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Command: get_metric_history
   * Returns historical metrics for specified time range
   */
  dispatcher.register('get_metric_history', async (params, options) => {
    try {
      const {
        startTime,
        endTime,
        granularity = '1m'
      } = params;

      if (!startTime || !endTime) {
        return {
          success: false,
          error: 'startTime and endTime are required'
        };
      }

      const snapshots = metricsStore.queryRange(startTime, endTime, granularity);

      return {
        success: true,
        data: {
          startTime,
          endTime,
          granularity,
          snapshots: snapshots.length,
          data: snapshots.map(snap => ({
            timestamp: snap.timestamp,
            metrics: snap.aggregated || snap.metrics
          }))
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Command: stream_metrics
   * Starts real-time metrics streaming
   */
  dispatcher.register('stream_metrics', async (params, options) => {
    try {
      const { interval = 1000 } = params;
      const clientId = options?.clientId;

      if (!clientId || !wsServer) {
        return {
          success: false,
          error: 'Streaming not available in this context'
        };
      }

      // Generate unique stream ID
      const streamId = `stream_${clientId}_${Date.now()}`;

      // Find client WebSocket
      let clientWs = null;
      if (wsServer.clients) {
        for (const ws of wsServer.clients) {
          if (ws.clientId === clientId) {
            clientWs = ws;
            break;
          }
        }
      }

      if (!clientWs) {
        return {
          success: false,
          error: 'Client WebSocket not found'
        };
      }

      // Create streaming interval
      const streamInterval = setInterval(() => {
        try {
          const metrics = metricsCollector.getCurrentMetrics();
          clientWs.send(JSON.stringify({
            type: 'metrics_update',
            streamId,
            timestamp: Date.now(),
            data: metrics
          }));
        } catch (err) {
          // Stop streaming if send fails
          clearInterval(streamInterval);
        }
      }, interval);

      // Store stream reference for cleanup
      if (!clientWs.activeStreams) {
        clientWs.activeStreams = new Map();
      }
      clientWs.activeStreams.set(streamId, streamInterval);

      // Auto-cleanup on close
      const originalClose = clientWs.close.bind(clientWs);
      clientWs.close = function() {
        if (clientWs.activeStreams?.has(streamId)) {
          clearInterval(clientWs.activeStreams.get(streamId));
          clientWs.activeStreams.delete(streamId);
        }
        return originalClose();
      };

      return {
        success: true,
        streamId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Command: get_alerts
   * Returns active and recent alerts
   */
  dispatcher.register('get_alerts', async (params, options) => {
    try {
      const { severity = null, limit = 50 } = params;

      const activeAlerts = alertManager.getActiveAlerts(severity);
      const history = alertManager.getAlertHistory(Math.min(limit, 1000));

      return {
        success: true,
        data: {
          active: activeAlerts.map(a => ({
            id: a.id,
            type: a.type,
            severity: a.severity,
            metric: a.metric,
            threshold: a.threshold,
            actualValue: a.actualValue,
            timestamp: a.timestamp,
            duration: a.duration
          })),
          recent: history.map(a => ({
            id: a.id,
            type: a.type,
            severity: a.severity,
            timestamp: a.timestamp,
            actualValue: a.actualValue
          }))
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Command: set_alert_threshold
   * Configures alert thresholds
   */
  dispatcher.register('set_alert_threshold', async (params, options) => {
    try {
      const { alertType, threshold } = params;

      if (!alertType || threshold === undefined) {
        return {
          success: false,
          error: 'alertType and threshold are required'
        };
      }

      const result = alertManager.setThreshold(alertType, threshold);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Command: suppress_alert
   * Suppresses specific alert types
   */
  dispatcher.register('suppress_alert', async (params, options) => {
    try {
      const { alertType, durationMs = 3600000 } = params; // Default 1 hour

      if (!alertType) {
        return {
          success: false,
          error: 'alertType is required'
        };
      }

      const result = alertManager.suppressAlert(alertType, durationMs);

      return {
        success: true,
        data: {
          alertType,
          suppressedUntil: result.suppressUntil,
          durationMs
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
}

module.exports = {
  registerMonitoringHandlers
};
