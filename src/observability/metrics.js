/**
 * Metrics Aggregation for Basset Hound Browser
 *
 * Provides:
 * - Collect metrics from all services
 * - Expose Prometheus format
 * - Time-series storage
 * - Metric aggregation and analysis
 *
 * Features:
 * - Counter, gauge, histogram metrics
 * - Prometheus exposition format
 * - Time-series storage with retention
 * - Real-time metric updates
 * - Service-level and system-level metrics
 */

const EventEmitter = require('events');

class MetricsAggregator extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      retentionPeriod: options.retentionPeriod || 3600000, // 1 hour
      aggregationInterval: options.aggregationInterval || 60000, // 1 minute
      enableHistograms: options.enableHistograms !== false,
      enableSummaries: options.enableSummaries !== false,
      ...options
    };

    this.metrics = new Map();
    this.timeSeries = new Map();
    this.aggregations = new Map();
  }

  /**
   * Register a counter metric
   */
  registerCounter(name, options = {}) {
    const metric = {
      name,
      type: 'counter',
      value: 0,
      help: options.help || '',
      labels: options.labels || {},
      createdAt: Date.now()
    };

    this.metrics.set(name, metric);
    this._initializeTimeSeries(name);
    this.emit('metric:registered', { name, type: 'counter' });

    return {
      inc: (value = 1, labels = {}) => this.incrementCounter(name, value, labels),
      get: (labels = {}) => this.getMetric(name, labels)
    };
  }

  /**
   * Register a gauge metric
   */
  registerGauge(name, options = {}) {
    const metric = {
      name,
      type: 'gauge',
      value: options.initialValue || 0,
      help: options.help || '',
      labels: options.labels || {},
      createdAt: Date.now()
    };

    this.metrics.set(name, metric);
    this._initializeTimeSeries(name);
    this.emit('metric:registered', { name, type: 'gauge' });

    return {
      set: (value, labels = {}) => this.setGauge(name, value, labels),
      inc: (value = 1, labels = {}) => this.incrementGauge(name, value, labels),
      dec: (value = 1, labels = {}) => this.decrementGauge(name, value, labels),
      get: (labels = {}) => this.getMetric(name, labels)
    };
  }

  /**
   * Register a histogram metric
   */
  registerHistogram(name, options = {}) {
    const metric = {
      name,
      type: 'histogram',
      buckets: options.buckets || [0.1, 0.5, 1, 2, 5, 10],
      values: {},
      sum: 0,
      count: 0,
      help: options.help || '',
      labels: options.labels || {},
      createdAt: Date.now()
    };

    // Initialize buckets
    metric.buckets.forEach(bucket => {
      metric.values[bucket] = 0;
    });
    metric.values['+Inf'] = 0;

    this.metrics.set(name, metric);
    this._initializeTimeSeries(name);
    this.emit('metric:registered', { name, type: 'histogram' });

    return {
      observe: (value, labels = {}) => this.observeHistogram(name, value, labels),
      get: (labels = {}) => this.getMetric(name, labels)
    };
  }

  /**
   * Register a summary metric
   */
  registerSummary(name, options = {}) {
    const metric = {
      name,
      type: 'summary',
      quantiles: options.quantiles || [0.5, 0.9, 0.99],
      values: [],
      sum: 0,
      count: 0,
      help: options.help || '',
      labels: options.labels || {},
      createdAt: Date.now()
    };

    this.metrics.set(name, metric);
    this._initializeTimeSeries(name);
    this.emit('metric:registered', { name, type: 'summary' });

    return {
      observe: (value, labels = {}) => this.observeSummary(name, value, labels),
      get: (labels = {}) => this.getMetric(name, labels)
    };
  }

  /**
   * Increment counter
   */
  incrementCounter(name, value = 1, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') {
      throw new Error(`Counter metric ${name} not found`);
    }

    metric.value += value;
    this._recordTimeSeriesValue(name, metric.value, labels);
    this.emit('metric:updated', { name, value: metric.value, labels });

    return metric.value;
  }

  /**
   * Set gauge
   */
  setGauge(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') {
      throw new Error(`Gauge metric ${name} not found`);
    }

    metric.value = value;
    this._recordTimeSeriesValue(name, value, labels);
    this.emit('metric:updated', { name, value, labels });

    return metric.value;
  }

  /**
   * Increment gauge
   */
  incrementGauge(name, value = 1, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') {
      throw new Error(`Gauge metric ${name} not found`);
    }

    metric.value += value;
    this._recordTimeSeriesValue(name, metric.value, labels);
    this.emit('metric:updated', { name, value: metric.value, labels });

    return metric.value;
  }

  /**
   * Decrement gauge
   */
  decrementGauge(name, value = 1, labels = {}) {
    return this.incrementGauge(name, -value, labels);
  }

  /**
   * Observe histogram value
   */
  observeHistogram(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') {
      throw new Error(`Histogram metric ${name} not found`);
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

    this._recordTimeSeriesValue(name, value, labels);
    this.emit('metric:updated', { name, value, labels });

    return metric;
  }

  /**
   * Observe summary value
   */
  observeSummary(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'summary') {
      throw new Error(`Summary metric ${name} not found`);
    }

    metric.values.push(value);
    metric.sum += value;
    metric.count++;

    this._recordTimeSeriesValue(name, value, labels);
    this.emit('metric:updated', { name, value, labels });

    return metric;
  }

  /**
   * Record time-series value
   */
  _recordTimeSeriesValue(name, value, labels = {}) {
    const key = `${name}:${JSON.stringify(labels)}`;

    if (!this.timeSeries.has(key)) {
      this.timeSeries.set(key, []);
    }

    const series = this.timeSeries.get(key);
    series.push({
      timestamp: Date.now(),
      value,
      labels
    });

    // Cleanup old entries based on retention period
    const cutoff = Date.now() - this.options.retentionPeriod;
    const filtered = series.filter(entry => entry.timestamp > cutoff);
    this.timeSeries.set(key, filtered);
  }

  /**
   * Initialize time-series for metric
   */
  _initializeTimeSeries(name) {
    if (!this.timeSeries.has(name)) {
      this.timeSeries.set(name, []);
    }
  }

  /**
   * Get metric value
   */
  getMetric(name, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric) {
      return null;
    }

    return {
      name: metric.name,
      type: metric.type,
      value: metric.value,
      labels,
      timestamp: Date.now()
    };
  }

  /**
   * Get all metrics in Prometheus format
   */
  getPrometheusMetrics() {
    let output = '';

    for (const [name, metric] of this.metrics) {
      if (metric.help) {
        output += `# HELP ${name} ${metric.help}\n`;
      }

      output += `# TYPE ${name} ${metric.type}\n`;

      switch (metric.type) {
        case 'counter':
        case 'gauge':
          output += `${name} ${metric.value}\n`;
          break;

        case 'histogram':
          for (const bucket of metric.buckets) {
            output += `${name}_bucket{le="${bucket}"} ${metric.values[bucket]}\n`;
          }
          output += `${name}_bucket{le="+Inf"} ${metric.values['+Inf']}\n`;
          output += `${name}_sum ${metric.sum}\n`;
          output += `${name}_count ${metric.count}\n`;
          break;

        case 'summary':
          const sorted = [...metric.values].sort((a, b) => a - b);
          for (const quantile of metric.quantiles) {
            const index = Math.floor(quantile * sorted.length);
            output += `${name}{quantile="${quantile}"} ${sorted[index] || 0}\n`;
          }
          output += `${name}_sum ${metric.sum}\n`;
          output += `${name}_count ${metric.count}\n`;
          break;
      }

      output += '\n';
    }

    return output;
  }

  /**
   * Get time-series data
   */
  getTimeSeries(name, options = {}) {
    const series = [];

    for (const [key, data] of this.timeSeries) {
      if (key.startsWith(name + ':') || key === name) {
        series.push({
          metricName: name,
          data: data.slice(-options.limit || 100)
        });
      }
    }

    return series;
  }

  /**
   * Aggregate metrics over time window
   */
  aggregateMetrics(name, window = 60000) {
    const cutoff = Date.now() - window;
    let allData = [];

    // Collect all time-series entries for this metric (with any labels)
    for (const [key, data] of this.timeSeries) {
      if (key === name || key.startsWith(name + ':')) {
        allData = allData.concat(data);
      }
    }

    const filtered = allData.filter(entry => entry.timestamp > cutoff);
    if (filtered.length === 0) {
      return null;
    }

    const values = filtered.map(entry => entry.value);

    return {
      metricName: name,
      window,
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      percentile95: this._percentile(values, 0.95),
      percentile99: this._percentile(values, 0.99)
    };
  }

  /**
   * Calculate percentile
   */
  _percentile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get aggregated metrics for service
   */
  getServiceMetrics(serviceName) {
    const metrics = {};

    for (const [name, metric] of this.metrics) {
      if (name.includes(serviceName)) {
        metrics[name] = {
          type: metric.type,
          value: metric.value,
          createdAt: metric.createdAt
        };
      }
    }

    return metrics;
  }

  /**
   * Calculate SLO compliance
   */
  calculateSLOCompliance(metricName, threshold, operator = '<=') {
    const metric = this.metrics.get(metricName);
    if (!metric) {
      return null;
    }

    let compliant = false;
    if (operator === '<=') compliant = metric.value <= threshold;
    if (operator === '>=') compliant = metric.value >= threshold;
    if (operator === '==') compliant = metric.value === threshold;
    if (operator === '<') compliant = metric.value < threshold;
    if (operator === '>') compliant = metric.value > threshold;

    return {
      metricName,
      threshold,
      currentValue: metric.value,
      operator,
      compliant
    };
  }

  /**
   * Export metrics
   */
  exportMetrics(format = 'prometheus') {
    if (format === 'prometheus') {
      return this.getPrometheusMetrics();
    }

    if (format === 'json') {
      const metrics = {};
      for (const [name, metric] of this.metrics) {
        metrics[name] = metric;
      }
      return JSON.stringify(metrics, null, 2);
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Get metrics statistics
   */
  getStats() {
    const stats = {
      totalMetrics: this.metrics.size,
      metricsByType: {},
      timeSeriesSize: this.timeSeries.size
    };

    for (const [name, metric] of this.metrics) {
      if (!stats.metricsByType[metric.type]) {
        stats.metricsByType[metric.type] = 0;
      }
      stats.metricsByType[metric.type]++;
    }

    return stats;
  }

  /**
   * Clear old time-series data
   */
  cleanupOldData() {
    const cutoff = Date.now() - this.options.retentionPeriod;
    let cleanedCount = 0;

    for (const [key, series] of this.timeSeries) {
      const filtered = series.filter(entry => entry.timestamp > cutoff);
      if (filtered.length === 0) {
        this.timeSeries.delete(key);
      } else {
        this.timeSeries.set(key, filtered);
      }
      cleanedCount++;
    }

    this.emit('cleanup:completed', { cleanedCount });
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics.clear();
    this.timeSeries.clear();
    this.aggregations.clear();
    this.emit('metrics:reset');
  }

  /**
   * Close metrics aggregator
   */
  close() {
    this.removeAllListeners();
    this.metrics.clear();
    this.timeSeries.clear();
    this.aggregations.clear();
  }
}

module.exports = MetricsAggregator;
