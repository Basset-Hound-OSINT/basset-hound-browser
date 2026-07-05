/**
 * Dashboard Engine - Real-time monitoring visualization core
 *
 * Provides the foundation for the competitor monitoring dashboard with:
 * - Multi-target monitoring views
 * - Real-time data updates via WebSocket
 * - Change timeline tracking
 * - Competitor comparison views
 * - Metrics aggregation
 *
 * @module src/dashboard/dashboard-engine
 */

const EventEmitter = require('events');

/**
 * Dashboard Engine Status
 */
const DASHBOARD_STATUS = {
  IDLE: 'idle',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ERROR: 'error'
};

/**
 * Metric types for aggregation
 */
const METRIC_TYPES = {
  CHANGE_COUNT: 'change_count',
  ALERT_COUNT: 'alert_count',
  MONITOR_HEALTH: 'monitor_health',
  DETECTION_RATE: 'detection_rate',
  CHANGE_FREQUENCY: 'change_frequency'
};

/**
 * View types available in the dashboard
 */
const VIEW_TYPES = {
  OVERVIEW: 'overview',
  TIMELINE: 'timeline',
  COMPARISON: 'comparison',
  METRICS: 'metrics',
  ALERTS: 'alerts',
  HISTORY: 'history'
};

/**
 * Change categories for grouping
 */
const CHANGE_CATEGORIES = {
  CONTENT: 'content',
  STRUCTURE: 'structure',
  TECHNOLOGY: 'technology',
  PERFORMANCE: 'performance',
  SECURITY: 'security'
};

/**
 * Dashboard Engine Class
 * Manages real-time monitoring visualizations and data aggregation
 */
class DashboardEngine extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxTimelineEntries: options.maxTimelineEntries || 1000,
      timelineRetention: options.timelineRetention || 30 * 24 * 60 * 60 * 1000, // 30 days
      aggregationInterval: options.aggregationInterval || 300000, // 5 minutes
      enableAutoAggregation: options.enableAutoAggregation !== false,
      ...options
    };

    // State management
    this.status = DASHBOARD_STATUS.IDLE;
    this.monitors = new Map(); // monitorId -> monitor data
    this.changes = new Map(); // monitorId -> [changes]
    this.timeline = []; // Global timeline of all changes
    this.metrics = new Map(); // metricType -> metric data
    this.views = new Map(); // viewId -> view config
    this.subscribers = new Set(); // WebSocket connections subscribed to updates
    this.aggregationTimer = null;

    // Statistics
    this.stats = {
      totalChanges: 0,
      totalAlerts: 0,
      averageChangeFrequency: 0,
      lastAggregation: null,
      startTime: Date.now()
    };

    // Initialize core metrics
    this.initializeMetrics();

    // Start auto-aggregation if enabled
    if (this.options.enableAutoAggregation) {
      this.startAutoAggregation();
    }
  }

  /**
   * Initialize default metrics
   * @returns {void}
   */
  initializeMetrics() {
    this.metrics.set(METRIC_TYPES.CHANGE_COUNT, {
      type: METRIC_TYPES.CHANGE_COUNT,
      value: 0,
      trend: 'stable',
      history: []
    });

    this.metrics.set(METRIC_TYPES.ALERT_COUNT, {
      type: METRIC_TYPES.ALERT_COUNT,
      value: 0,
      trend: 'stable',
      history: []
    });

    this.metrics.set(METRIC_TYPES.DETECTION_RATE, {
      type: METRIC_TYPES.DETECTION_RATE,
      value: 0,
      trend: 'stable',
      history: []
    });

    this.metrics.set(METRIC_TYPES.CHANGE_FREQUENCY, {
      type: METRIC_TYPES.CHANGE_FREQUENCY,
      value: 0,
      trend: 'stable',
      history: []
    });

    this.metrics.set(METRIC_TYPES.MONITOR_HEALTH, {
      type: METRIC_TYPES.MONITOR_HEALTH,
      value: 100,
      trend: 'stable',
      history: []
    });
  }

  /**
   * Register a monitor with the dashboard
   * @param {Object} monitor - Monitor data
   * @returns {void}
   */
  registerMonitor(monitor) {
    if (!monitor.id || !monitor.url) {
      throw new Error('Monitor must have id and url');
    }

    this.monitors.set(monitor.id, {
      ...monitor,
      registeredAt: Date.now(),
      changeCount: 0,
      alertCount: 0,
      lastChange: null,
      lastAlert: null
    });

    this.changes.set(monitor.id, []);
    this.emit('monitor-registered', monitor);
  }

  /**
   * Unregister a monitor from the dashboard
   * @param {string} monitorId - Monitor ID
   * @returns {void}
   */
  unregisterMonitor(monitorId) {
    this.monitors.delete(monitorId);
    this.changes.delete(monitorId);
    this.emit('monitor-unregistered', { monitorId });
  }

  /**
   * Add a change to the timeline and monitor history
   * @param {string} monitorId - Monitor ID
   * @param {Object} change - Change data
   * @returns {Object} Added change with dashboard metadata
   */
  addChange(monitorId, change) {
    if (!monitorId || !change) {
      throw new Error('monitorId and change are required');
    }

    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      throw new Error(`Monitor ${monitorId} not registered`);
    }

    // Enrich change with dashboard metadata
    const enrichedChange = {
      ...change,
      monitorId,
      monitorName: monitor.name,
      monitorUrl: monitor.url,
      dashboardTimestamp: Date.now(),
      category: change.category || CHANGE_CATEGORIES.CONTENT,
      id: `${monitorId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    // Add to monitor-specific changes
    const monitorChanges = this.changes.get(monitorId) || [];
    monitorChanges.unshift(enrichedChange);
    if (monitorChanges.length > 500) {
      monitorChanges.pop(); // Keep last 500 changes per monitor
    }
    this.changes.set(monitorId, monitorChanges);

    // Add to global timeline
    this.timeline.unshift(enrichedChange);
    if (this.timeline.length > this.options.maxTimelineEntries) {
      this.timeline.pop();
    }

    // Update monitor metadata
    monitor.changeCount++;
    monitor.lastChange = enrichedChange;

    // Update metrics
    this.stats.totalChanges++;
    this.metrics.get(METRIC_TYPES.CHANGE_COUNT).value = this.stats.totalChanges;

    // Notify subscribers
    this.broadcastUpdate({
      type: 'change-added',
      change: enrichedChange,
      monitorId
    });

    this.emit('change-added', enrichedChange);

    return enrichedChange;
  }

  /**
   * Add an alert to the dashboard
   * @param {string} monitorId - Monitor ID
   * @param {Object} alert - Alert data
   * @returns {Object} Added alert
   */
  addAlert(monitorId, alert) {
    if (!monitorId || !alert) {
      throw new Error('monitorId and alert are required');
    }

    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      throw new Error(`Monitor ${monitorId} not registered`);
    }

    const enrichedAlert = {
      ...alert,
      monitorId,
      monitorName: monitor.name,
      dashboardTimestamp: Date.now(),
      id: `alert-${monitorId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      acknowledged: false
    };

    monitor.alertCount++;
    monitor.lastAlert = enrichedAlert;

    this.stats.totalAlerts++;
    this.metrics.get(METRIC_TYPES.ALERT_COUNT).value = this.stats.totalAlerts;

    this.broadcastUpdate({
      type: 'alert-added',
      alert: enrichedAlert,
      monitorId
    });

    this.emit('alert-added', enrichedAlert);

    return enrichedAlert;
  }

  /**
   * Get the global timeline of all changes
   * @param {Object} options - Query options
   * @returns {Array} Timeline entries
   */
  getTimeline(options = {}) {
    const {
      limit = 100,
      offset = 0,
      monitorId = null,
      category = null,
      startTime = null,
      endTime = null
    } = options;

    let timeline = this.timeline;

    // Filter by monitor
    if (monitorId) {
      timeline = timeline.filter(entry => entry.monitorId === monitorId);
    }

    // Filter by category
    if (category) {
      timeline = timeline.filter(entry => entry.category === category);
    }

    // Filter by time range
    if (startTime) {
      timeline = timeline.filter(entry => entry.dashboardTimestamp >= startTime);
    }
    if (endTime) {
      timeline = timeline.filter(entry => entry.dashboardTimestamp <= endTime);
    }

    // Apply pagination
    const paginated = timeline.slice(offset, offset + limit);

    return {
      entries: paginated,
      total: timeline.length,
      limit,
      offset,
      hasMore: offset + limit < timeline.length
    };
  }

  /**
   * Get comparison data for two or more monitors
   * @param {Array<string>} monitorIds - Monitor IDs to compare
   * @param {Object} options - Comparison options
   * @returns {Object} Comparison data
   */
  getComparison(monitorIds, options = {}) {
    const {
      timeframe = 24 * 60 * 60 * 1000, // 24 hours
      limit = 50
    } = options;

    const now = Date.now();
    const startTime = now - timeframe;

    const comparison = {
      monitorIds,
      timeframe,
      startTime,
      endTime: now,
      monitors: {},
      summary: {
        totalChanges: 0,
        mostActive: null,
        leastActive: null,
        commonCategories: {}
      }
    };

    let maxChanges = 0;
    let minChanges = Infinity;
    let mostActiveId = null;
    let leastActiveId = null;

    for (const monitorId of monitorIds) {
      const monitor = this.monitors.get(monitorId);
      if (!monitor) {
        continue;
      }

      const changes = (this.changes.get(monitorId) || [])
        .filter(c => c.dashboardTimestamp >= startTime)
        .slice(0, limit);

      const categoryBreakdown = {};
      changes.forEach(change => {
        const cat = change.category || CHANGE_CATEGORIES.CONTENT;
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;

        comparison.summary.commonCategories[cat] =
          (comparison.summary.commonCategories[cat] || 0) + 1;
      });

      comparison.monitors[monitorId] = {
        name: monitor.name,
        url: monitor.url,
        changeCount: changes.length,
        changes,
        categoryBreakdown,
        averageFrequency: changes.length > 0 ?
          (now - changes[changes.length - 1].dashboardTimestamp) / changes.length : 0
      };

      comparison.summary.totalChanges += changes.length;

      if (changes.length > maxChanges) {
        maxChanges = changes.length;
        mostActiveId = monitorId;
      }
      if (changes.length < minChanges) {
        minChanges = changes.length;
        leastActiveId = monitorId;
      }
    }

    comparison.summary.mostActive = mostActiveId;
    comparison.summary.leastActive = leastActiveId;

    return comparison;
  }

  /**
   * Get metrics aggregation
   * @param {Array<string>} metricTypes - Types of metrics to retrieve
   * @returns {Object} Metrics data
   */
  getMetrics(metricTypes = null) {
    const types = metricTypes || Object.values(METRIC_TYPES);
    const metrics = {};

    for (const type of types) {
      const metric = this.metrics.get(type);
      if (metric) {
        metrics[type] = {
          ...metric,
          timestamp: Date.now()
        };
      }
    }

    return {
      metrics,
      stats: this.stats,
      timestamp: Date.now()
    };
  }

  /**
   * Aggregate dashboard metrics (called periodically or on-demand)
   * @returns {Object} Aggregation result
   */
  aggregate() {
    const aggregation = {
      timestamp: Date.now(),
      previousTimestamp: this.stats.lastAggregation,
      changes: {},
      alerts: {},
      monitors: {}
    };

    // Calculate per-monitor metrics
    for (const [monitorId, monitor] of this.monitors) {
      const changes = this.changes.get(monitorId) || [];
      aggregation.monitors[monitorId] = {
        name: monitor.name,
        changeCount: monitor.changeCount,
        alertCount: monitor.alertCount,
        lastChange: monitor.lastChange,
        lastAlert: monitor.lastAlert,
        health: monitor.changeCount > 0 ? 'healthy' : 'idle'
      };
    }

    // Aggregate change statistics
    const allCategories = Object.values(CHANGE_CATEGORIES);
    for (const category of allCategories) {
      const categoryChanges = this.timeline.filter(c => c.category === category);
      aggregation.changes[category] = {
        count: categoryChanges.length,
        recent: categoryChanges.slice(0, 10)
      };
    }

    // Update trend metrics
    const changeMetric = this.metrics.get(METRIC_TYPES.CHANGE_COUNT);
    const previousValue = changeMetric.history[changeMetric.history.length - 1]?.value || 0;
    changeMetric.trend = this.stats.totalChanges > previousValue ? 'increasing' :
      this.stats.totalChanges < previousValue ? 'decreasing' : 'stable';
    changeMetric.history.push({
      value: this.stats.totalChanges,
      timestamp: Date.now()
    });

    // Keep history to last 100 entries
    if (changeMetric.history.length > 100) {
      changeMetric.history.shift();
    }

    this.stats.lastAggregation = aggregation.timestamp;
    this.emit('metrics-aggregated', aggregation);

    return aggregation;
  }

  /**
   * Create or update a view configuration
   * @param {string} viewId - Unique view identifier
   * @param {Object} config - View configuration
   * @returns {Object} View configuration
   */
  createView(viewId, config) {
    if (!viewId || !config.type) {
      throw new Error('viewId and config.type are required');
    }

    if (!Object.values(VIEW_TYPES).includes(config.type)) {
      throw new Error(`Invalid view type: ${config.type}`);
    }

    const view = {
      id: viewId,
      type: config.type,
      title: config.title || viewId,
      monitorIds: config.monitorIds || [],
      filters: config.filters || {},
      options: config.options || {},
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };

    this.views.set(viewId, view);
    this.emit('view-created', view);

    return view;
  }

  /**
   * Get a view configuration
   * @param {string} viewId - View identifier
   * @returns {Object} View data with rendered content
   */
  getView(viewId) {
    const view = this.views.get(viewId);
    if (!view) {
      return null;
    }

    const content = this.renderView(view);

    return {
      ...view,
      content,
      renderedAt: Date.now()
    };
  }

  /**
   * Render view content based on view type
   * @param {Object} view - View configuration
   * @returns {Object} Rendered view content
   */
  renderView(view) {
    switch (view.type) {
    case VIEW_TYPES.OVERVIEW:
      return this.renderOverview(view);
    case VIEW_TYPES.TIMELINE:
      return this.renderTimeline(view);
    case VIEW_TYPES.COMPARISON:
      return this.renderComparison(view);
    case VIEW_TYPES.METRICS:
      return this.renderMetrics(view);
    case VIEW_TYPES.ALERTS:
      return this.renderAlerts(view);
    default:
      return {};
    }
  }

  /**
   * Render overview view
   * @param {Object} view - View configuration
   * @returns {Object} Overview data
   */
  renderOverview(view) {
    const monitors = [];

    for (const monitorId of view.monitorIds) {
      const monitor = this.monitors.get(monitorId);
      if (monitor) {
        monitors.push({
          ...monitor,
          changes: (this.changes.get(monitorId) || []).slice(0, 5),
          stats: {
            totalChanges: monitor.changeCount,
            totalAlerts: monitor.alertCount,
            health: monitor.changeCount > 0 ? 'healthy' : 'idle'
          }
        });
      }
    }

    return {
      monitors,
      summary: {
        activeMonitors: this.monitors.size,
        totalChanges: this.stats.totalChanges,
        totalAlerts: this.stats.totalAlerts
      }
    };
  }

  /**
   * Render timeline view
   * @param {Object} view - View configuration
   * @returns {Object} Timeline data
   */
  renderTimeline(view) {
    const options = {
      limit: view.options.limit || 100,
      monitorId: view.monitorIds.length === 1 ? view.monitorIds[0] : null,
      category: view.filters.category || null
    };

    return this.getTimeline(options);
  }

  /**
   * Render comparison view
   * @param {Object} view - View configuration
   * @returns {Object} Comparison data
   */
  renderComparison(view) {
    if (view.monitorIds.length < 2) {
      return { error: 'Comparison requires at least 2 monitors' };
    }

    return this.getComparison(view.monitorIds, view.options);
  }

  /**
   * Render metrics view
   * @param {Object} view - View configuration
   * @returns {Object} Metrics data
   */
  renderMetrics(view) {
    return this.getMetrics();
  }

  /**
   * Render alerts view
   * @param {Object} view - View configuration
   * @returns {Object} Alerts data (placeholder)
   */
  renderAlerts(view) {
    return {
      alerts: [],
      unreadCount: 0,
      acknowledgedCount: 0
    };
  }

  /**
   * Subscribe a WebSocket connection to real-time updates
   * @param {Object} ws - WebSocket connection
   * @returns {void}
   */
  subscribe(ws) {
    if (!ws) {
      throw new Error('WebSocket connection required');
    }
    this.subscribers.add(ws);
    this.emit('subscriber-added', { count: this.subscribers.size });
  }

  /**
   * Unsubscribe a WebSocket connection from updates
   * @param {Object} ws - WebSocket connection
   * @returns {void}
   */
  unsubscribe(ws) {
    this.subscribers.delete(ws);
    this.emit('subscriber-removed', { count: this.subscribers.size });
  }

  /**
   * Broadcast update to all subscribers
   * @param {Object} update - Update message
   * @returns {number} Number of subscribers notified
   */
  broadcastUpdate(update) {
    const message = JSON.stringify({
      type: 'dashboard-update',
      data: update,
      timestamp: Date.now()
    });

    let count = 0;
    for (const ws of this.subscribers) {
      try {
        if (ws.readyState === 1) { // OPEN
          ws.send(message);
          count++;
        }
      } catch (error) {
        // Connection may have closed
        this.unsubscribe(ws);
      }
    }

    return count;
  }

  /**
   * Start auto-aggregation timer
   * @returns {void}
   */
  startAutoAggregation() {
    if (this.aggregationTimer) {
      return;
    }

    this.aggregationTimer = setInterval(() => {
      this.aggregate();
    }, this.options.aggregationInterval);

    this.status = DASHBOARD_STATUS.ACTIVE;
    this.emit('auto-aggregation-started');
  }

  /**
   * Stop auto-aggregation timer
   * @returns {void}
   */
  stopAutoAggregation() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
      this.status = DASHBOARD_STATUS.IDLE;
      this.emit('auto-aggregation-stopped');
    }
  }

  /**
   * Get dashboard status
   * @returns {Object} Dashboard status and stats
   */
  getStatus() {
    return {
      status: this.status,
      monitors: this.monitors.size,
      timeline: this.timeline.length,
      subscribers: this.subscribers.size,
      stats: this.stats,
      uptime: Date.now() - this.stats.startTime
    };
  }

  /**
   * Destroy the dashboard engine
   * @returns {void}
   */
  destroy() {
    this.stopAutoAggregation();
    this.subscribers.clear();
    this.monitors.clear();
    this.changes.clear();
    this.timeline = [];
    this.views.clear();
    this.removeAllListeners();
  }
}

module.exports = {
  DashboardEngine,
  DASHBOARD_STATUS,
  METRIC_TYPES,
  VIEW_TYPES,
  CHANGE_CATEGORIES
};
