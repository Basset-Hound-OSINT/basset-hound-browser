/**
 * Application Metrics Module for Basset Hound Browser
 *
 * Collects and manages application-level metrics:
 * - WebSocket command metrics
 * - Message throughput and latency
 * - Error rates and broker failures
 * - Session and connection metrics
 * - Custom application events
 *
 * @module src/monitoring/app-metrics
 * @requires events
 */

const EventEmitter = require('events');

/**
 * Metric Types
 */
const METRIC_TYPES = {
  COUNTER: 'counter',
  GAUGE: 'gauge',
  HISTOGRAM: 'histogram',
  SUMMARY: 'summary'
};

/**
 * Application Metrics Collector
 * Tracks all application-level metrics
 */
class AppMetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enableHistograms: options.enableHistograms !== false,
      histogramBuckets: options.histogramBuckets || [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      retentionPeriod: options.retentionPeriod || 3600000, // 1 hour
      aggregationInterval: options.aggregationInterval || 60000, // 1 minute
      ...options
    };

    // Initialize metric storage
    this.metrics = new Map();
    this.timeSeries = new Map();
    this.labels = new Map();

    // Initialize standard metrics
    this._initializeMetrics();

    // Setup periodic cleanup
    this.cleanupInterval = setInterval(() => this._cleanup(), this.options.retentionPeriod);
  }

  /**
   * Initialize all standard application metrics
   * @private
   */
  _initializeMetrics() {
    // WebSocket Command Metrics
    this._registerCounter('websocket_commands_total', 'Total WebSocket commands executed');
    this._registerHistogram('websocket_command_duration_ms', 'WebSocket command execution duration in milliseconds');
    this._registerGauge('websocket_commands_active', 'Currently active WebSocket commands');
    this._registerCounter('websocket_commands_failed', 'Failed WebSocket commands');

    // Message Metrics
    this._registerCounter('websocket_messages_sent', 'Total WebSocket messages sent');
    this._registerCounter('websocket_messages_received', 'Total WebSocket messages received');
    this._registerHistogram('websocket_message_latency_ms', 'WebSocket message round-trip latency');
    this._registerGauge('websocket_message_queue_size', 'Size of WebSocket message queue');

    // Connection Metrics
    this._registerGauge('websocket_active_connections', 'Active WebSocket connections');
    this._registerCounter('websocket_connections_total', 'Total WebSocket connections established');
    this._registerCounter('websocket_connection_errors', 'WebSocket connection errors');
    this._registerHistogram('websocket_connection_duration_seconds', 'WebSocket connection duration');

    // Throughput Metrics
    this._registerGauge('websocket_throughput_msgs_per_sec', 'Messages per second throughput');
    this._registerGauge('websocket_throughput_bytes_per_sec', 'Bytes per second throughput');
    this._registerHistogram('websocket_message_size_bytes', 'WebSocket message size in bytes');

    // Error Metrics
    this._registerCounter('websocket_errors_total', 'Total WebSocket errors');
    this._registerCounter('websocket_timeout_errors', 'WebSocket timeout errors');
    this._registerCounter('websocket_connection_errors_total', 'Total connection errors');
    this._registerCounter('websocket_protocol_errors', 'WebSocket protocol errors');

    // Broker/Routing Metrics
    this._registerCounter('broker_messages_published', 'Messages published to message broker');
    this._registerCounter('broker_messages_consumed', 'Messages consumed from broker');
    this._registerGauge('broker_queue_length', 'Message broker queue length');
    this._registerHistogram('broker_publish_latency_ms', 'Message broker publish latency');
    this._registerCounter('broker_errors', 'Message broker errors');

    // Session Metrics
    this._registerGauge('active_sessions', 'Active browser sessions');
    this._registerCounter('sessions_created', 'Total sessions created');
    this._registerCounter('sessions_closed', 'Total sessions closed');
    this._registerHistogram('session_duration_seconds', 'Session duration in seconds');

    // Reconnection Metrics
    this._registerCounter('websocket_reconnections', 'WebSocket reconnection attempts');
    this._registerCounter('websocket_reconnections_successful', 'Successful WebSocket reconnections');
    this._registerHistogram('websocket_reconnection_time_ms', 'Time to successful reconnection');

    // Command-specific Metrics (by command type)
    this._registerCounter('command_execution_success', 'Successful command executions');
    this._registerCounter('command_execution_failure', 'Failed command executions');
    this._registerHistogram('command_execution_time_ms', 'Command execution time');

    // Request/Response Metrics
    this._registerCounter('http_requests_total', 'Total HTTP requests from browser');
    this._registerHistogram('http_request_duration_ms', 'HTTP request duration');
    this._registerCounter('http_request_errors', 'HTTP request errors');

    // Data Extraction Metrics
    this._registerCounter('extractions_total', 'Total data extractions');
    this._registerCounter('extractions_successful', 'Successful data extractions');
    this._registerCounter('extractions_failed', 'Failed data extractions');
    this._registerHistogram('extraction_duration_ms', 'Data extraction duration');
    this._registerGauge('extracted_data_size_bytes', 'Size of extracted data');

    // Screenshot Metrics
    this._registerCounter('screenshots_captured', 'Total screenshots captured');
    this._registerHistogram('screenshot_duration_ms', 'Screenshot capture duration');
    this._registerGauge('screenshot_size_bytes', 'Screenshot file size');

    // Navigation Metrics
    this._registerCounter('navigation_total', 'Total navigation operations');
    this._registerCounter('navigation_errors', 'Navigation errors');
    this._registerHistogram('page_load_duration_ms', 'Page load duration');
    this._registerHistogram('dom_ready_time_ms', 'DOM ready time');

    // Cache Metrics
    this._registerGauge('cache_hit_ratio', 'Cache hit ratio (0-1)');
    this._registerCounter('cache_hits', 'Cache hits');
    this._registerCounter('cache_misses', 'Cache misses');
    this._registerGauge('cache_size_bytes', 'Cache size in bytes');

    // Memory Metrics
    this._registerGauge('memory_heap_used_mb', 'Heap memory used in MB');
    this._registerGauge('memory_heap_total_mb', 'Total heap memory in MB');
    this._registerGauge('memory_external_mb', 'External memory in MB');

    // Event Loop Metrics
    this._registerHistogram('event_loop_lag_ms', 'Event loop lag in milliseconds');
    this._registerGauge('active_handles', 'Active async handles');
    this._registerGauge('active_requests', 'Active async requests');
  }

  /**
   * Register a counter metric
   * @private
   */
  _registerCounter(name, help) {
    const metric = {
      name,
      type: METRIC_TYPES.COUNTER,
      value: 0,
      help,
      createdAt: Date.now()
    };
    this.metrics.set(name, metric);
    this.timeSeries.set(name, []);
  }

  /**
   * Register a gauge metric
   * @private
   */
  _registerGauge(name, help) {
    const metric = {
      name,
      type: METRIC_TYPES.GAUGE,
      value: 0,
      help,
      createdAt: Date.now()
    };
    this.metrics.set(name, metric);
    this.timeSeries.set(name, []);
  }

  /**
   * Register a histogram metric
   * @private
   */
  _registerHistogram(name, help) {
    const metric = {
      name,
      type: METRIC_TYPES.HISTOGRAM,
      buckets: this.options.histogramBuckets,
      values: {},
      sum: 0,
      count: 0,
      help,
      createdAt: Date.now()
    };

    // Initialize bucket counts
    metric.buckets.forEach(bucket => {
      metric.values[bucket] = 0;
    });
    metric.values['+Inf'] = 0;

    this.metrics.set(name, metric);
    this.timeSeries.set(name, []);
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name, value = 1, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== METRIC_TYPES.COUNTER) {
      throw new Error(`Counter metric ${name} not found or not a counter`);
    }

    metric.value += value;
    this._recordMetricUpdate(name, metric.value, labels);
    this.emit('metric:updated', { name, value: metric.value, type: 'counter', labels });

    return metric.value;
  }

  /**
   * Set a gauge metric
   */
  setGauge(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== METRIC_TYPES.GAUGE) {
      throw new Error(`Gauge metric ${name} not found or not a gauge`);
    }

    metric.value = value;
    this._recordMetricUpdate(name, value, labels);
    this.emit('metric:updated', { name, value, type: 'gauge', labels });

    return metric.value;
  }

  /**
   * Increment a gauge metric
   */
  incrementGauge(name, value = 1, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== METRIC_TYPES.GAUGE) {
      throw new Error(`Gauge metric ${name} not found or not a gauge`);
    }

    metric.value += value;
    this._recordMetricUpdate(name, metric.value, labels);
    this.emit('metric:updated', { name, value: metric.value, type: 'gauge', labels });

    return metric.value;
  }

  /**
   * Decrement a gauge metric
   */
  decrementGauge(name, value = 1, labels = {}) {
    return this.incrementGauge(name, -value, labels);
  }

  /**
   * Observe a histogram value
   */
  observeHistogram(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== METRIC_TYPES.HISTOGRAM) {
      throw new Error(`Histogram metric ${name} not found or not a histogram`);
    }

    metric.sum += value;
    metric.count++;

    // Update bucket counts
    for (const bucket of metric.buckets) {
      if (value <= bucket) {
        metric.values[bucket]++;
      }
    }
    metric.values['+Inf']++;

    this._recordMetricUpdate(name, value, labels);
    this.emit('metric:updated', { name, value, type: 'histogram', labels });

    return metric;
  }

  /**
   * Record metric update in time-series
   * @private
   */
  _recordMetricUpdate(name, value, labels = {}) {
    const series = this.timeSeries.get(name) || [];
    series.push({
      timestamp: Date.now(),
      value,
      labels
    });

    // Keep only recent data
    const cutoff = Date.now() - this.options.retentionPeriod;
    this.timeSeries.set(name, series.filter(entry => entry.timestamp > cutoff));
  }

  /**
   * Record command execution
   */
  recordCommand(commandName, duration, success = true, labels = {}) {
    this.incrementCounter('websocket_commands_total', 1, { command: commandName });
    this.observeHistogram('websocket_command_duration_ms', duration, { command: commandName });

    if (success) {
      this.incrementCounter('command_execution_success', 1, { command: commandName });
    } else {
      this.incrementCounter('command_execution_failure', 1, { command: commandName });
      this.incrementCounter('websocket_commands_failed', 1);
    }
  }

  /**
   * Record message exchange
   */
  recordMessage(direction, size, latency) {
    if (direction === 'sent') {
      this.incrementCounter('websocket_messages_sent', 1);
    } else if (direction === 'received') {
      this.incrementCounter('websocket_messages_received', 1);
    }

    if (size) {
      this.observeHistogram('websocket_message_size_bytes', size);
    }

    if (latency) {
      this.observeHistogram('websocket_message_latency_ms', latency);
    }
  }

  /**
   * Record connection event
   */
  recordConnection(event, duration = null) {
    if (event === 'open') {
      this.incrementCounter('websocket_connections_total', 1);
      this.incrementGauge('websocket_active_connections', 1);
    } else if (event === 'close') {
      this.decrementGauge('websocket_active_connections', 1);
      if (duration) {
        this.observeHistogram('websocket_connection_duration_seconds', duration / 1000);
      }
    } else if (event === 'error') {
      this.incrementCounter('websocket_connection_errors', 1);
      this.incrementCounter('websocket_errors_total', 1);
    }
  }

  /**
   * Record error event
   */
  recordError(errorType, labels = {}) {
    this.incrementCounter('websocket_errors_total', 1);

    if (errorType === 'timeout') {
      this.incrementCounter('websocket_timeout_errors', 1);
    } else if (errorType === 'connection') {
      this.incrementCounter('websocket_connection_errors_total', 1);
    } else if (errorType === 'protocol') {
      this.incrementCounter('websocket_protocol_errors', 1);
    }
  }

  /**
   * Get metric by name
   */
  getMetric(name) {
    const metric = this.metrics.get(name);
    if (!metric) {
      return null;
    }

    const result = {
      name: metric.name,
      type: metric.type,
      help: metric.help,
      timestamp: Date.now()
    };

    if (metric.type === METRIC_TYPES.HISTOGRAM) {
      result.buckets = metric.values;
      result.sum = metric.sum;
      result.count = metric.count;
      if (metric.count > 0) {
        result.mean = metric.sum / metric.count;
      }
    } else {
      result.value = metric.value;
    }

    return result;
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    const result = {};
    for (const [name, metric] of this.metrics) {
      result[name] = this.getMetric(name);
    }
    return result;
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusFormat() {
    let output = '';

    for (const [name, metric] of this.metrics) {
      // Add HELP and TYPE
      output += `# HELP ${name} ${metric.help}\n`;
      output += `# TYPE ${name} ${metric.type}\n`;

      if (metric.type === METRIC_TYPES.HISTOGRAM) {
        // Output histogram buckets
        for (const [bucket, count] of Object.entries(metric.values)) {
          output += `${name}_bucket{le="${bucket}"} ${count}\n`;
        }
        output += `${name}_sum ${metric.sum}\n`;
        output += `${name}_count ${metric.count}\n`;
      } else {
        // Output counter/gauge
        output += `${name} ${metric.value}\n`;
      }

      output += '\n';
    }

    return output;
  }

  /**
   * Get metrics summary
   */
  getSummary() {
    const summary = {
      timestamp: Date.now(),
      metrics: {},
      totals: {
        commandsExecuted: this.metrics.get('websocket_commands_total')?.value || 0,
        messagesProcessed: (this.metrics.get('websocket_messages_sent')?.value || 0) +
                          (this.metrics.get('websocket_messages_received')?.value || 0),
        activeConnections: this.metrics.get('websocket_active_connections')?.value || 0,
        totalErrors: this.metrics.get('websocket_errors_total')?.value || 0,
        activeSessions: this.metrics.get('active_sessions')?.value || 0
      }
    };

    // Add key metrics
    const keyMetrics = [
      'websocket_commands_total',
      'websocket_messages_sent',
      'websocket_messages_received',
      'websocket_active_connections',
      'websocket_errors_total',
      'websocket_command_duration_ms',
      'websocket_message_latency_ms',
      'active_sessions',
      'memory_heap_used_mb',
      'cache_hit_ratio'
    ];

    for (const metricName of keyMetrics) {
      const metric = this.getMetric(metricName);
      if (metric) {
        summary.metrics[metricName] = metric;
      }
    }

    return summary;
  }

  /**
   * Get time-series data for a metric
   */
  getTimeSeries(name, lookbackSeconds = 3600) {
    const series = this.timeSeries.get(name) || [];
    const cutoff = Date.now() - (lookbackSeconds * 1000);

    return series
      .filter(entry => entry.timestamp > cutoff)
      .map(entry => ({
        timestamp: entry.timestamp,
        value: entry.value,
        labels: entry.labels
      }));
  }

  /**
   * Cleanup old metrics
   * @private
   */
  _cleanup() {
    const cutoff = Date.now() - this.options.retentionPeriod;

    for (const [name, series] of this.timeSeries) {
      const filtered = series.filter(entry => entry.timestamp > cutoff);
      this.timeSeries.set(name, filtered);
    }

    this.emit('metrics:cleaned', { timestamp: Date.now() });
  }

  /**
   * Reset all metrics
   */
  reset() {
    for (const [name, metric] of this.metrics) {
      metric.value = 0;
      if (metric.type === METRIC_TYPES.HISTOGRAM) {
        metric.sum = 0;
        metric.count = 0;
        for (const bucket of metric.buckets) {
          metric.values[bucket] = 0;
        }
        metric.values['+Inf'] = 0;
      }
    }
    this.timeSeries.clear();
    this._initializeMetrics();
    this.emit('metrics:reset', { timestamp: Date.now() });
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = {
  AppMetricsCollector,
  METRIC_TYPES
};
