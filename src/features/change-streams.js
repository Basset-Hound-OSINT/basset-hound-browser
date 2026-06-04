/**
 * Basset Hound Browser - Change Streams & Alert Streams
 * Real-time event streaming for changes and alerts
 *
 * Version: 1.0.0
 * Created: June 3, 2026
 *
 * Features:
 * - Real-time change stream with filtering
 * - Alert streaming with severity and status filters
 * - Data stream export for external systems
 * - Multiple subscription models (long-polling, WebSocket-ready)
 * - Cursor-based pagination
 * - Stream compression options
 * - Change history and lookback support
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');
const zlib = require('zlib');

/**
 * Subscription to a data stream
 */
class StreamSubscription {
  constructor(subscriptionId, filters = {}) {
    this.id = subscriptionId;
    this.filters = {
      monitorId: filters.monitorId || null,
      changeType: filters.changeType || null,
      dateRange: filters.dateRange || null,
      severity: filters.severity || null,
      status: filters.status || null,
      tags: filters.tags || []
    };
    this.createdAt = Date.now();
    this.lastMessageId = null;
    this.active = true;
    this.clientId = filters.clientId || null;
  }

  /**
   * Check if item matches subscription filters
   */
  matches(item) {
    // Monitor filter
    if (this.filters.monitorId && item.monitorId !== this.filters.monitorId) {
      return false;
    }

    // Change type filter
    if (this.filters.changeType && item.changeType !== this.filters.changeType) {
      return false;
    }

    // Severity filter (for alerts)
    if (
      this.filters.severity &&
      item.severity &&
      item.severity !== this.filters.severity
    ) {
      return false;
    }

    // Status filter
    if (this.filters.status && item.status !== this.filters.status) {
      return false;
    }

    // Tag filter
    if (this.filters.tags.length > 0 && item.tags) {
      const hasTag = this.filters.tags.some(tag => item.tags.includes(tag));
      if (!hasTag) {
        return false;
      }
    }

    // Date range filter
    if (this.filters.dateRange) {
      const itemTime = item.timestamp || item.createdAt;
      const { start, end } = this.filters.dateRange;
      if (itemTime < start || itemTime > end) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Change stream manager
 */
class ChangeStreamManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.changes = []; // Circular buffer of changes
    this.maxBufferSize = options.maxBufferSize || 10000;
    this.subscriptions = new Map(); // subscriptionId -> StreamSubscription
    this.subscribers = new Map(); // subscriptionId -> Set of subscribers

    // Metrics
    this.metrics = {
      totalChanges: 0,
      changesByType: {},
      changesByMonitor: {},
      subscriptions: 0
    };
  }

  /**
   * Record a change
   */
  recordChange(change) {
    const record = {
      id: crypto.randomBytes(12).toString('hex'),
      timestamp: Date.now(),
      monitorId: change.monitorId,
      changeType: change.changeType, // 'added', 'modified', 'removed'
      oldValue: change.oldValue || null,
      newValue: change.newValue || null,
      tags: change.tags || [],
      metadata: change.metadata || {},
      source: change.source || 'manual'
    };

    // Add to circular buffer
    this.changes.push(record);
    if (this.changes.length > this.maxBufferSize) {
      this.changes.shift();
    }

    // Update metrics
    this.metrics.totalChanges++;
    this.metrics.changesByType[change.changeType] =
      (this.metrics.changesByType[change.changeType] || 0) + 1;
    this.metrics.changesByMonitor[change.monitorId] =
      (this.metrics.changesByMonitor[change.monitorId] || 0) + 1;

    // Notify subscribers
    this.notifySubscribers(record);

    this.emit('change:recorded', record);

    return record;
  }

  /**
   * Subscribe to changes
   */
  subscribe(filters = {}) {
    const subscriptionId = crypto.randomBytes(12).toString('hex');
    const subscription = new StreamSubscription(subscriptionId, filters);

    this.subscriptions.set(subscriptionId, subscription);
    this.subscribers.set(subscriptionId, new Set());

    this.metrics.subscriptions++;

    this.emit('subscription:created', {
      subscriptionId,
      filters: subscription.filters
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from changes
   */
  unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    subscription.active = false;
    this.subscriptions.delete(subscriptionId);
    this.subscribers.delete(subscriptionId);
    this.metrics.subscriptions--;

    this.emit('subscription:closed', { subscriptionId });

    return true;
  }

  /**
   * Get changes for subscription (with pagination)
   */
  getChanges(subscriptionId, options = {}) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const limit = options.limit || 100;
    const cursor = options.cursor || null;
    const direction = options.direction || 'forward'; // forward or backward

    // Find starting position
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = this.changes.findIndex(c => c.id === cursor);
      if (cursorIndex === -1) {
        throw new Error(`Cursor not found: ${cursor}`);
      }
      startIndex = direction === 'forward' ? cursorIndex + 1 : Math.max(0, cursorIndex - limit);
    } else if (direction === 'backward') {
      startIndex = Math.max(0, this.changes.length - limit);
    }

    // Get matching changes
    const results = [];
    for (let i = startIndex; i < this.changes.length && results.length < limit; i++) {
      const change = this.changes[i];
      if (subscription.matches(change)) {
        results.push(change);
        subscription.lastMessageId = change.id;
      }
    }

    // Determine next cursor
    const nextCursor = results.length < limit ? null : results[results.length - 1].id;

    return {
      changes: results,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
      count: results.length
    };
  }

  /**
   * Notify subscribers of change
   */
  notifySubscribers(change) {
    for (const [subscriptionId, subscription] of this.subscriptions.entries()) {
      if (subscription.matches(change)) {
        const subscribers = this.subscribers.get(subscriptionId);
        if (subscribers) {
          for (const subscriber of subscribers) {
            try {
              subscriber(change);
            } catch (err) {
              console.error(`Subscriber error for ${subscriptionId}:`, err);
            }
          }
        }
      }
    }
  }

  /**
   * Add subscriber callback
   */
  onChanges(subscriptionId, callback) {
    const subscribers = this.subscribers.get(subscriptionId);
    if (!subscribers) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscribers.add(callback);

    return () => subscribers.delete(callback);
  }

  /**
   * Search changes
   */
  searchChanges(query = {}) {
    const results = [];

    for (const change of this.changes) {
      // Monitor ID search
      if (query.monitorId && change.monitorId !== query.monitorId) {
        continue;
      }

      // Change type search
      if (query.changeType && change.changeType !== query.changeType) {
        continue;
      }

      // Date range search
      if (query.startTime && change.timestamp < query.startTime) {
        continue;
      }
      if (query.endTime && change.timestamp > query.endTime) {
        continue;
      }

      // Text search
      if (query.text) {
        const text = query.text.toLowerCase();
        const searchable = JSON.stringify(change).toLowerCase();
        if (!searchable.includes(text)) {
          continue;
        }
      }

      results.push(change);
    }

    return {
      results: results.slice(0, query.limit || 100),
      total: results.length
    };
  }

  /**
   * Get stream statistics
   */
  getStatistics() {
    return {
      totalChanges: this.metrics.totalChanges,
      bufferSize: this.changes.length,
      maxBufferSize: this.maxBufferSize,
      activeSubscriptions: this.subscriptions.size,
      changesByType: this.metrics.changesByType,
      changesByMonitor: this.metrics.changesByMonitor
    };
  }
}

/**
 * Alert stream manager
 */
class AlertStreamManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.alerts = []; // Circular buffer of alerts
    this.maxBufferSize = options.maxBufferSize || 5000;
    this.subscriptions = new Map(); // subscriptionId -> StreamSubscription
    this.subscribers = new Map(); // subscriptionId -> Set of subscribers

    // Metrics
    this.metrics = {
      totalAlerts: 0,
      alertsBySeverity: {},
      alertsByType: {},
      subscriptions: 0
    };
  }

  /**
   * Create an alert
   */
  createAlert(alert) {
    const record = {
      id: crypto.randomBytes(12).toString('hex'),
      timestamp: Date.now(),
      monitorId: alert.monitorId,
      severity: alert.severity, // 'critical', 'high', 'medium', 'low'
      type: alert.type, // 'price_change', 'text_change', 'tech_change', etc.
      status: alert.status || 'active', // 'active', 'acknowledged', 'resolved'
      title: alert.title,
      description: alert.description,
      details: alert.details || {},
      tags: alert.tags || [],
      metadata: alert.metadata || {}
    };

    // Add to circular buffer
    this.alerts.push(record);
    if (this.alerts.length > this.maxBufferSize) {
      this.alerts.shift();
    }

    // Update metrics
    this.metrics.totalAlerts++;
    this.metrics.alertsBySeverity[alert.severity] =
      (this.metrics.alertsBySeverity[alert.severity] || 0) + 1;
    this.metrics.alertsByType[alert.type] =
      (this.metrics.alertsByType[alert.type] || 0) + 1;

    // Notify subscribers
    this.notifySubscribers(record);

    this.emit('alert:created', record);

    return record;
  }

  /**
   * Update alert status
   */
  updateAlertStatus(alertId, status) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = status;
    alert.updatedAt = Date.now();

    this.emit('alert:updated', {
      alertId,
      status
    });

    return alert;
  }

  /**
   * Subscribe to alerts
   */
  subscribe(filters = {}) {
    const subscriptionId = crypto.randomBytes(12).toString('hex');
    const subscription = new StreamSubscription(subscriptionId, filters);

    this.subscriptions.set(subscriptionId, subscription);
    this.subscribers.set(subscriptionId, new Set());

    this.metrics.subscriptions++;

    this.emit('subscription:created', {
      subscriptionId,
      filters: subscription.filters
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from alerts
   */
  unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    subscription.active = false;
    this.subscriptions.delete(subscriptionId);
    this.subscribers.delete(subscriptionId);
    this.metrics.subscriptions--;

    return true;
  }

  /**
   * Get alerts for subscription
   */
  getAlerts(subscriptionId, options = {}) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const limit = options.limit || 100;
    const cursor = options.cursor || null;

    // Find starting position
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = this.alerts.findIndex(a => a.id === cursor);
      if (cursorIndex === -1) {
        throw new Error(`Cursor not found: ${cursor}`);
      }
      startIndex = cursorIndex + 1;
    } else {
      startIndex = Math.max(0, this.alerts.length - limit);
    }

    // Get matching alerts
    const results = [];
    for (let i = startIndex; i < this.alerts.length && results.length < limit; i++) {
      const alert = this.alerts[i];
      if (subscription.matches(alert)) {
        results.push(alert);
      }
    }

    const nextCursor = results.length < limit ? null : results[results.length - 1].id;

    return {
      alerts: results,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
      count: results.length
    };
  }

  /**
   * Notify subscribers
   */
  notifySubscribers(alert) {
    for (const [subscriptionId, subscription] of this.subscriptions.entries()) {
      if (subscription.matches(alert)) {
        const subscribers = this.subscribers.get(subscriptionId);
        if (subscribers) {
          for (const subscriber of subscribers) {
            try {
              subscriber(alert);
            } catch (err) {
              console.error(`Subscriber error for ${subscriptionId}:`, err);
            }
          }
        }
      }
    }
  }

  /**
   * Add subscriber callback
   */
  onAlerts(subscriptionId, callback) {
    const subscribers = this.subscribers.get(subscriptionId);
    if (!subscribers) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscribers.add(callback);

    return () => subscribers.delete(callback);
  }

  /**
   * Get alert statistics
   */
  getStatistics() {
    return {
      totalAlerts: this.metrics.totalAlerts,
      bufferSize: this.alerts.length,
      maxBufferSize: this.maxBufferSize,
      activeSubscriptions: this.subscriptions.size,
      alertsBySeverity: this.metrics.alertsBySeverity,
      alertsByType: this.metrics.alertsByType
    };
  }
}

/**
 * Data stream manager for raw data export
 */
class DataStreamManager {
  constructor(options = {}) {
    this.sourceManagers = new Map(); // Type -> manager instance
    this.options = {
      maxBufferSize: options.maxBufferSize || 10000,
      compressionEnabled: options.compressionEnabled || false
    };
  }

  /**
   * Register data source
   */
  registerSource(sourceType, manager) {
    this.sourceManagers.set(sourceType, manager);
  }

  /**
   * Export data as JSON
   */
  exportAsJSON(sourceType, filters = {}) {
    const manager = this.sourceManagers.get(sourceType);
    if (!manager) {
      throw new Error(`Unknown source type: ${sourceType}`);
    }

    let data = null;

    if (sourceType === 'changes') {
      data = manager.changes || [];
    } else if (sourceType === 'alerts') {
      data = manager.alerts || [];
    }

    if (!data) {
      throw new Error(`Unable to export data from ${sourceType}`);
    }

    // Apply filters
    let filtered = data;
    if (filters.monitorId) {
      filtered = filtered.filter(item => item.monitorId === filters.monitorId);
    }
    if (filters.dateRange) {
      const { start, end } = filters.dateRange;
      filtered = filtered.filter(item => {
        const t = item.timestamp || item.createdAt;
        return t >= start && t <= end;
      });
    }

    return {
      type: sourceType,
      exportedAt: Date.now(),
      count: filtered.length,
      data: filtered
    };
  }

  /**
   * Export data as CSV
   */
  exportAsCSV(sourceType, filters = {}) {
    const jsonData = this.exportAsJSON(sourceType, filters);

    if (jsonData.data.length === 0) {
      return '';
    }

    const item = jsonData.data[0];
    const headers = Object.keys(item);

    const csv = [
      headers.join(','),
      ...jsonData.data.map(row =>
        headers.map(h => {
          const value = row[h];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value).includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');

    return csv;
  }

  /**
   * Stream data with compression
   */
  async* streamData(sourceType, filters = {}, format = 'json') {
    const jsonData = this.exportAsJSON(sourceType, filters);
    let output = '';

    if (format === 'json') {
      output = JSON.stringify(jsonData, null, 2);
    } else if (format === 'csv') {
      output = this.exportAsCSV(sourceType, filters);
    }

    if (this.options.compressionEnabled) {
      // Compress in chunks
      const chunkSize = 65536; // 64KB chunks
      for (let i = 0; i < output.length; i += chunkSize) {
        const chunk = output.slice(i, i + chunkSize);
        const compressed = await new Promise((resolve, reject) => {
          zlib.gzip(chunk, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        yield compressed;
      }
    } else {
      yield output;
    }
  }
}

module.exports = {
  ChangeStreamManager,
  AlertStreamManager,
  DataStreamManager,
  StreamSubscription
};
