/**
 * Basset Hound Browser - Monitoring & Metrics System
 *
 * Provides comprehensive real-time monitoring, metrics collection,
 * alert management, and historical data storage.
 *
 * Module exports:
 * - MetricsCollector: Real-time metrics collection engine
 * - MetricsAggregator: Time-series aggregation and trend analysis
 * - AlertManager: Threshold-based alert system
 * - MetricsStore: Historical metrics storage
 * - registerMonitoringHandlers: WebSocket command registration
 */

const MetricsCollector = require('./metrics-collector');
const { MetricsAggregator, RingBuffer } = require('./metrics-aggregator');
const { AlertManager, ALERT_TYPES, DEFAULT_THRESHOLDS } = require('./alert-manager');
const { MetricsStore } = require('./metrics-store');
const { registerMonitoringHandlers } = require('./websocket-handlers');

/**
 * Initialize the complete monitoring system
 * @param {Object} options - Configuration options
 * @returns {Object} Initialized monitoring system with all components
 */
function initializeMonitoring(options = {}) {
  // Create instances
  const metricsCollector = new MetricsCollector(options.collector);
  const metricsAggregator = new MetricsAggregator(options.aggregator);
  const alertManager = new AlertManager(options.alertManager);
  const metricsStore = new MetricsStore(options.store);

  // Setup initial alert evaluation
  metricsCollector.on('command', () => {
    // Periodically evaluate metrics (handled by AlertManager's internal timer)
  });

  // Setup metrics storage
  metricsCollector.on('command', () => {
    // Store metrics periodically (caller should implement)
  });

  return {
    metricsCollector,
    metricsAggregator,
    alertManager,
    metricsStore,
    registerHandlers: (dispatcher, wsServer) =>
      registerMonitoringHandlers(dispatcher, metricsCollector, metricsAggregator, alertManager, metricsStore, wsServer),

    // Convenience methods
    getCurrentMetrics: () => metricsCollector.getCurrentMetrics(),
    getActiveAlerts: (severity) => alertManager.getActiveAlerts(severity),
    getLatestSnapshot: () => metricsStore.getLatest(),
    exportAllMetrics: () => metricsStore.exportAll(),

    // Shutdown all components
    shutdown: () => {
      metricsCollector.shutdown();
      alertManager.shutdown();
    }
  };
}

module.exports = {
  MetricsCollector,
  MetricsAggregator,
  RingBuffer,
  AlertManager,
  ALERT_TYPES,
  DEFAULT_THRESHOLDS,
  MetricsStore,
  registerMonitoringHandlers,
  initializeMonitoring
};
