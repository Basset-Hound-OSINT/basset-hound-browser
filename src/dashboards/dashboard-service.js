/**
 * Dashboard Service - Real-time Performance Dashboards
 *
 * Provides advanced dashboard aggregation and data computation:
 * - Dashboard configuration and persistence
 * - Real-time metric computation
 * - Historical trend analysis
 * - Custom metric definitions
 * - Dashboard state management
 *
 * @module src/dashboards/dashboard-service
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * Dashboard Service for aggregating performance metrics
 */
class DashboardService extends EventEmitter {
  constructor(metricsAggregator, options = {}) {
    super();

    this.metricsAggregator = metricsAggregator;
    this.options = {
      persistDashboards: options.persistDashboards !== false,
      dashboardDir: options.dashboardDir || './data/dashboards',
      maxDashboards: options.maxDashboards || 100,
      autoSaveInterval: options.autoSaveInterval || 60000,
      retentionDays: options.retentionDays || 30,
      ...options
    };

    // State
    this.dashboards = new Map();
    this.computedMetrics = new Map();
    this.trendData = new Map();
    this.customMetrics = new Map();
    this.autoSaveTimer = null;

    // Predefined dashboards
    this.initializePredefinedDashboards();
  }

  /**
   * Initialize predefined dashboards
   */
  initializePredefinedDashboards() {
    // System Performance Dashboard
    this.createDashboard('system-performance', {
      title: 'System Performance',
      description: 'Real-time system metrics and resource utilization',
      category: 'system',
      widgets: [
        { type: 'metric', metric: 'cpu_usage', refreshInterval: 5000 },
        { type: 'metric', metric: 'memory_usage', refreshInterval: 5000 },
        { type: 'metric', metric: 'disk_io', refreshInterval: 10000 },
        { type: 'trend', metric: 'cpu_usage', window: 3600000 }
      ]
    });

    // WebSocket Performance Dashboard
    this.createDashboard('websocket-performance', {
      title: 'WebSocket Performance',
      description: 'WebSocket API metrics and connection health',
      category: 'api',
      widgets: [
        { type: 'metric', metric: 'ws_connections', refreshInterval: 5000 },
        { type: 'metric', metric: 'ws_messages_per_sec', refreshInterval: 5000 },
        { type: 'metric', metric: 'ws_latency_p99', refreshInterval: 10000 },
        { type: 'metric', metric: 'ws_error_rate', refreshInterval: 10000 },
        { type: 'heatmap', metric: 'ws_latency_distribution', window: 300000 }
      ]
    });

    // Browser Operations Dashboard
    this.createDashboard('browser-operations', {
      title: 'Browser Operations',
      description: 'Browser command execution metrics',
      category: 'browser',
      widgets: [
        { type: 'metric', metric: 'commands_per_sec', refreshInterval: 5000 },
        { type: 'metric', metric: 'navigation_latency', refreshInterval: 10000 },
        { type: 'metric', metric: 'screenshot_generation_time', refreshInterval: 10000 },
        { type: 'chart', metric: 'command_success_rate', type: 'pie', refreshInterval: 10000 },
        { type: 'trend', metric: 'commands_per_sec', window: 1800000 }
      ]
    });

    // Network & Proxy Dashboard
    this.createDashboard('network-proxy', {
      title: 'Network & Proxy',
      description: 'Network utilization and proxy metrics',
      category: 'network',
      widgets: [
        { type: 'metric', metric: 'proxy_success_rate', refreshInterval: 10000 },
        { type: 'metric', metric: 'bandwidth_usage', refreshInterval: 10000 },
        { type: 'metric', metric: 'dns_resolution_time', refreshInterval: 15000 },
        { type: 'chart', metric: 'request_distribution', type: 'bar', refreshInterval: 30000 }
      ]
    });

    // Evasion & Detection Dashboard
    this.createDashboard('evasion-detection', {
      title: 'Evasion & Detection',
      description: 'Bot detection evasion effectiveness',
      category: 'evasion',
      widgets: [
        { type: 'metric', metric: 'fingerprint_success_rate', refreshInterval: 10000 },
        { type: 'metric', metric: 'detection_evasion_score', refreshInterval: 15000 },
        { type: 'metric', metric: 'honeypot_detections', refreshInterval: 30000 },
        { type: 'heatmap', metric: 'detection_services_coverage', window: 600000 }
      ]
    });

    // Data Extraction Dashboard
    this.createDashboard('data-extraction', {
      title: 'Data Extraction',
      description: 'Content extraction performance metrics',
      category: 'extraction',
      widgets: [
        { type: 'metric', metric: 'extraction_success_rate', refreshInterval: 10000 },
        { type: 'metric', metric: 'avg_extraction_time', refreshInterval: 10000 },
        { type: 'metric', metric: 'content_size_extracted', refreshInterval: 15000 },
        { type: 'chart', metric: 'extraction_by_type', type: 'bar', refreshInterval: 30000 }
      ]
    });

    // Error & Alert Dashboard
    this.createDashboard('errors-alerts', {
      title: 'Errors & Alerts',
      description: 'Error tracking and system alerts',
      category: 'monitoring',
      widgets: [
        { type: 'metric', metric: 'error_rate', refreshInterval: 5000 },
        { type: 'metric', metric: 'critical_errors', refreshInterval: 10000 },
        { type: 'metric', metric: 'warning_count', refreshInterval: 10000 },
        { type: 'trend', metric: 'error_rate', window: 3600000 },
        { type: 'chart', metric: 'errors_by_type', type: 'pie', refreshInterval: 30000 }
      ]
    });

    // Session Management Dashboard
    this.createDashboard('session-management', {
      title: 'Session Management',
      description: 'Session and profile metrics',
      category: 'sessions',
      widgets: [
        { type: 'metric', metric: 'active_sessions', refreshInterval: 5000 },
        { type: 'metric', metric: 'session_creation_rate', refreshInterval: 10000 },
        { type: 'metric', metric: 'session_reuse_rate', refreshInterval: 15000 },
        { type: 'trend', metric: 'active_sessions', window: 1800000 }
      ]
    });

    // Custom Dashboards Dashboard
    this.createDashboard('custom-dashboards', {
      title: 'Custom Dashboards',
      description: 'User-created custom dashboard management',
      category: 'custom',
      widgets: [
        { type: 'metric', metric: 'custom_dashboard_count', refreshInterval: 60000 },
        { type: 'metric', metric: 'custom_metric_count', refreshInterval: 60000 },
        { type: 'list', resource: 'custom_dashboards', refreshInterval: 30000 }
      ]
    });

    this.emit('dashboards:initialized', {
      count: this.dashboards.size,
      dashboards: Array.from(this.dashboards.keys())
    });
  }

  /**
   * Create a new dashboard
   */
  createDashboard(id, config) {
    const dashboard = {
      id,
      title: config.title,
      description: config.description,
      category: config.category || 'custom',
      widgets: config.widgets || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: config.enabled !== false,
      refreshInterval: config.refreshInterval || 5000,
      custom: config.custom !== false
    };

    this.dashboards.set(id, dashboard);
    this.emit('dashboard:created', { id, dashboard });

    return dashboard;
  }

  /**
   * Get dashboard configuration
   */
  getDashboard(id) {
    return this.dashboards.get(id);
  }

  /**
   * Get all dashboards
   */
  getAllDashboards() {
    return Array.from(this.dashboards.values());
  }

  /**
   * Update dashboard
   */
  updateDashboard(id, updates) {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      throw new Error(`Dashboard ${id} not found`);
    }

    const updated = {
      ...dashboard,
      ...updates,
      updatedAt: Date.now()
    };

    this.dashboards.set(id, updated);
    this.emit('dashboard:updated', { id, dashboard: updated });

    return updated;
  }

  /**
   * Delete dashboard
   */
  deleteDashboard(id) {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      throw new Error(`Dashboard ${id} not found`);
    }

    // Don't delete predefined dashboards
    if (!dashboard.custom) {
      throw new Error(`Cannot delete predefined dashboard ${id}`);
    }

    this.dashboards.delete(id);
    this.trendData.delete(id);
    this.emit('dashboard:deleted', { id });

    return { id };
  }

  /**
   * Compute dashboard metrics
   */
  async computeDashboardMetrics(dashboardId) {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      return null;
    }

    const metrics = {};

    for (const widget of dashboard.widgets) {
      if (widget.type === 'metric') {
        const metricValue = this.metricsAggregator.getMetric(widget.metric);
        if (metricValue) {
          metrics[widget.metric] = metricValue.value;
        }
      } else if (widget.type === 'trend') {
        const trend = this.computeTrend(widget.metric, widget.window);
        if (trend) {
          metrics[`${widget.metric}_trend`] = trend;
        }
      } else if (widget.type === 'chart' || widget.type === 'heatmap') {
        const data = this.computeChartData(widget.metric, widget.type, widget.window);
        if (data) {
          metrics[`${widget.metric}_chart`] = data;
        }
      }
    }

    this.computedMetrics.set(dashboardId, {
      dashboardId,
      metrics,
      computedAt: Date.now()
    });

    this.emit('metrics:computed', { dashboardId, metrics });
    return metrics;
  }

  /**
   * Compute trend analysis
   */
  computeTrend(metricName, window = 3600000) {
    const timeSeries = this.metricsAggregator.getTimeSeries(metricName);
    if (!timeSeries.length) {
      return null;
    }

    const cutoff = Date.now() - window;
    const filtered = timeSeries
      .flatMap(series => series.data || [])
      .filter(entry => entry.timestamp > cutoff);

    if (filtered.length < 2) {
      return null;
    }

    const values = filtered.map(entry => entry.value);
    const timestamps = filtered.map(entry => entry.timestamp);

    // Calculate trend direction
    const first = values.slice(0, Math.floor(values.length / 4));
    const last = values.slice(-Math.floor(values.length / 4));
    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
    const lastAvg = last.reduce((a, b) => a + b, 0) / last.length;

    const trendDirection = lastAvg > firstAvg ? 'up' : lastAvg < firstAvg ? 'down' : 'stable';
    const trendPercent = ((lastAvg - firstAvg) / (firstAvg || 1)) * 100;

    return {
      metricName,
      window,
      direction: trendDirection,
      percentChange: trendPercent.toFixed(2),
      min: Math.min(...values),
      max: Math.max(...values),
      avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
      current: values[values.length - 1],
      pointCount: values.length,
      timeRange: {
        start: timestamps[0],
        end: timestamps[timestamps.length - 1]
      }
    };
  }

  /**
   * Compute chart/heatmap data
   */
  computeChartData(metricName, type, window = 300000) {
    const timeSeries = this.metricsAggregator.getTimeSeries(metricName);
    if (!timeSeries.length) {
      return null;
    }

    const cutoff = Date.now() - window;
    const filtered = timeSeries
      .flatMap(series => series.data || [])
      .filter(entry => entry.timestamp > cutoff);

    if (filtered.length === 0) {
      return null;
    }

    if (type === 'pie') {
      // Group by labels if available
      const groupedData = {};
      filtered.forEach(entry => {
        const label = entry.labels?.type || 'default';
        groupedData[label] = (groupedData[label] || 0) + 1;
      });

      return {
        type: 'pie',
        labels: Object.keys(groupedData),
        datasets: [
          {
            data: Object.values(groupedData),
            backgroundColor: this.generateColors(Object.keys(groupedData).length)
          }
        ]
      };
    } else if (type === 'bar') {
      // Aggregate by time buckets
      const bucketSize = Math.max(1, Math.floor(window / 20));
      const buckets = {};

      filtered.forEach(entry => {
        const bucketTime = Math.floor(entry.timestamp / bucketSize) * bucketSize;
        buckets[bucketTime] = (buckets[bucketTime] || 0) + 1;
      });

      const sortedBuckets = Object.entries(buckets).sort((a, b) => a[0] - b[0]);

      return {
        type: 'bar',
        labels: sortedBuckets.map(([time]) => new Date(parseInt(time)).toLocaleTimeString()),
        datasets: [
          {
            label: metricName,
            data: sortedBuckets.map(([, count]) => count),
            backgroundColor: '#3b82f6'
          }
        ]
      };
    } else if (type === 'heatmap') {
      // Create heatmap data for latency distribution
      const values = filtered.map(entry => entry.value);
      const percentiles = {
        p25: this.percentile(values, 0.25),
        p50: this.percentile(values, 0.5),
        p75: this.percentile(values, 0.75),
        p95: this.percentile(values, 0.95),
        p99: this.percentile(values, 0.99)
      };

      return {
        type: 'heatmap',
        percentiles,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      };
    }

    return null;
  }

  /**
   * Define custom metric
   */
  defineCustomMetric(name, definition) {
    const metric = {
      name,
      ...definition,
      createdAt: Date.now(),
      custom: true
    };

    this.customMetrics.set(name, metric);
    this.emit('metric:defined', { name, metric });

    return metric;
  }

  /**
   * Compute custom metric
   */
  computeCustomMetric(metricName) {
    const definition = this.customMetrics.get(metricName);
    if (!definition) {
      return null;
    }

    // For now, simple implementations
    if (definition.type === 'composite') {
      return this.computeCompositeMetric(definition);
    } else if (definition.type === 'aggregate') {
      return this.computeAggregateMetric(definition);
    }

    return null;
  }

  /**
   * Compute composite metric from multiple sources
   */
  computeCompositeMetric(definition) {
    const values = {};

    for (const source of definition.sources || []) {
      const metric = this.metricsAggregator.getMetric(source.metric);
      if (metric) {
        values[source.alias || source.metric] = metric.value;
      }
    }

    // Apply formula
    if (definition.formula) {
      try {
        const result = this.evaluateFormula(definition.formula, values);
        return result;
      } catch (e) {
        return null;
      }
    }

    return values;
  }

  /**
   * Compute aggregate metric from time-series
   */
  computeAggregateMetric(definition) {
    const timeSeries = this.metricsAggregator.getTimeSeries(definition.source);
    if (!timeSeries.length) {
      return null;
    }

    const cutoff = Date.now() - (definition.window || 3600000);
    const filtered = timeSeries
      .flatMap(series => series.data || [])
      .filter(entry => entry.timestamp > cutoff);

    const values = filtered.map(entry => entry.value);

    if (definition.aggregationType === 'sum') {
      return values.reduce((a, b) => a + b, 0);
    } else if (definition.aggregationType === 'avg') {
      return values.reduce((a, b) => a + b, 0) / values.length;
    } else if (definition.aggregationType === 'max') {
      return Math.max(...values);
    } else if (definition.aggregationType === 'min') {
      return Math.min(...values);
    } else if (definition.aggregationType === 'count') {
      return values.length;
    }

    return null;
  }

  /**
   * Evaluate metric formula
   */
  evaluateFormula(formula, values) {
    let expression = formula;

    for (const [key, value] of Object.entries(values)) {
      expression = expression.replace(new RegExp(`\\$${key}`, 'g'), value);
    }

    // Simple math evaluation (be careful with production use)
    try {
      return Function('"use strict"; return (' + expression + ')')();
    } catch (e) {
      throw new Error(`Invalid formula: ${formula}`);
    }
  }

  /**
   * Get dashboard metrics (computed)
   */
  getDashboardMetrics(dashboardId) {
    return this.computedMetrics.get(dashboardId);
  }

  /**
   * Get trend data
   */
  getTrendData(metricName) {
    return this.trendData.get(metricName);
  }

  /**
   * Calculate percentile
   */
  percentile(values, p) {
    if (values.length === 0) {
      return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Generate colors for charts
   */
  generateColors(count) {
    const colors = [
      '#3b82f6',
      '#ef4444',
      '#10b981',
      '#f59e0b',
      '#8b5cf6',
      '#ec4899',
      '#06b6d4',
      '#6366f1',
      '#14b8a6',
      '#f97316'
    ];

    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }

    return result;
  }

  /**
   * Start auto-save of dashboards
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      return;
    }

    this.autoSaveTimer = setInterval(() => {
      this.saveDashboards().catch(err => {
        this.emit('error', { message: 'Failed to auto-save dashboards', error: err });
      });
    }, this.options.autoSaveInterval);

    this.emit('autosave:started');
  }

  /**
   * Stop auto-save
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      this.emit('autosave:stopped');
    }
  }

  /**
   * Save dashboards to disk
   */
  async saveDashboards() {
    if (!this.options.persistDashboards) {
      return;
    }

    try {
      await fs.mkdir(this.options.dashboardDir, { recursive: true });

      const dashboardsData = {
        version: '1.0.0',
        savedAt: Date.now(),
        dashboards: Array.from(this.dashboards.values())
      };

      const filePath = path.join(this.options.dashboardDir, 'dashboards.json');
      await fs.writeFile(filePath, JSON.stringify(dashboardsData, null, 2));

      this.emit('dashboards:saved', { count: this.dashboards.size });
    } catch (error) {
      this.emit('error', { message: 'Failed to save dashboards', error });
    }
  }

  /**
   * Load dashboards from disk
   */
  async loadDashboards() {
    if (!this.options.persistDashboards) {
      return;
    }

    try {
      const filePath = path.join(this.options.dashboardDir, 'dashboards.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const dashboardsData = JSON.parse(data);

      // Load custom dashboards
      for (const dashboard of dashboardsData.dashboards || []) {
        if (dashboard.custom) {
          this.dashboards.set(dashboard.id, dashboard);
        }
      }

      this.emit('dashboards:loaded', { count: this.dashboards.size });
    } catch (error) {
      // File doesn't exist yet, that's okay
      if (error.code !== 'ENOENT') {
        this.emit('error', { message: 'Failed to load dashboards', error });
      }
    }
  }

  /**
   * Get dashboard statistics
   */
  getStats() {
    return {
      totalDashboards: this.dashboards.size,
      customDashboards: Array.from(this.dashboards.values()).filter(d => d.custom).length,
      predefinedDashboards: Array.from(this.dashboards.values()).filter(d => !d.custom).length,
      totalCustomMetrics: this.customMetrics.size,
      computedMetricsCount: this.computedMetrics.size
    };
  }

  /**
   * Close service
   */
  close() {
    this.stopAutoSave();
    this.removeAllListeners();
  }
}

module.exports = DashboardService;
