/**
 * Dashboard API Service
 * Provides high-level methods for dashboard operations
 * Wraps WebSocket client with domain-specific logic
 */

import { getWebSocketClient } from './websocket-client';

class DashboardAPI {
  constructor() {
    this.ws = getWebSocketClient();
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get dashboard data snapshot
   */
  async getDashboardData(options = {}) {
    const cacheKey = 'dashboard_data';
    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const response = await this.ws.send('get_dashboard_data', options);
    this.setCache(cacheKey, response);
    return response;
  }

  /**
   * Get all monitors
   */
  async getMonitors() {
    const cacheKey = 'monitors';
    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const response = await this.ws.send('get_monitors', {});
    this.setCache(cacheKey, response);
    return response;
  }

  /**
   * Create a new monitor
   */
  async createMonitor(config) {
    this.invalidateCache('monitors');
    this.invalidateCache('dashboard_data');
    return this.ws.send('create_monitor', config);
  }

  /**
   * Update monitor configuration
   */
  async updateMonitor(monitorId, config) {
    this.invalidateCache('monitors');
    this.invalidateCache('dashboard_data');
    return this.ws.send('update_monitor', { id: monitorId, ...config });
  }

  /**
   * Delete a monitor
   */
  async deleteMonitor(monitorId) {
    this.invalidateCache('monitors');
    this.invalidateCache('dashboard_data');
    return this.ws.send('delete_monitor', { id: monitorId });
  }

  /**
   * Get changes for a monitor
   */
  async getMonitorChanges(monitorId, options = {}) {
    const response = await this.ws.send('get_monitor_changes', {
      monitorId,
      ...options,
    });
    return response;
  }

  /**
   * Get competitor comparison
   */
  async getComparison(monitorIds, options = {}) {
    const response = await this.ws.send('get_competitor_comparison', {
      monitorIds,
      ...options,
    });
    return response;
  }

  /**
   * Get dashboard timeline
   */
  async getTimeline(filters = {}) {
    const response = await this.ws.send('get_dashboard_timeline', filters);
    return response;
  }

  /**
   * Get dashboard metrics
   */
  async getMetrics(options = {}) {
    const response = await this.ws.send('get_dashboard_metrics', options);
    return response;
  }

  /**
   * Get dashboard status
   */
  async getStatus() {
    return this.ws.send('get_dashboard_status', {});
  }

  /**
   * Create an alert
   */
  async createAlert(alertData) {
    this.invalidateCache('alerts');
    return this.ws.send('create_dashboard_alert', alertData);
  }

  /**
   * Get alerts with optional filters
   */
  async getAlerts(filters = {}) {
    const response = await this.ws.send('get_dashboard_alerts', filters);
    return response;
  }

  /**
   * Get unread alerts
   */
  async getUnreadAlerts() {
    const response = await this.ws.send('get_unread_alerts', {});
    return response;
  }

  /**
   * Mark alert as read
   */
  async markAlertRead(alertId) {
    this.invalidateCache('alerts');
    return this.ws.send('mark_alert_read', { id: alertId });
  }

  /**
   * Batch mark alerts as read
   */
  async batchMarkAlertsRead(alertIds) {
    this.invalidateCache('alerts');
    return this.ws.send('batch_mark_alerts_read', { ids: alertIds });
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId) {
    this.invalidateCache('alerts');
    return this.ws.send('acknowledge_alert', { id: alertId });
  }

  /**
   * Batch acknowledge alerts
   */
  async batchAcknowledgeAlerts(alertIds) {
    this.invalidateCache('alerts');
    return this.ws.send('batch_acknowledge_alerts', { ids: alertIds });
  }

  /**
   * Dismiss alert
   */
  async dismissAlert(alertId) {
    this.invalidateCache('alerts');
    return this.ws.send('dismiss_alert', { id: alertId });
  }

  /**
   * Batch dismiss alerts
   */
  async batchDismissAlerts(alertIds) {
    this.invalidateCache('alerts');
    return this.ws.send('batch_dismiss_alerts', { ids: alertIds });
  }

  /**
   * Get alert summary
   */
  async getAlertSummary() {
    const response = await this.ws.send('get_alert_summary', {});
    return response;
  }

  /**
   * Create custom view
   */
  async createView(viewType, options) {
    return this.ws.send('create_dashboard_view', { type: viewType, ...options });
  }

  /**
   * Get view content
   */
  async getView(viewId, options = {}) {
    return this.ws.send('get_dashboard_view', { id: viewId, ...options });
  }

  /**
   * Subscribe to real-time changes
   */
  subscribeToChanges(handler) {
    return this.ws.subscribe('dashboard_change', handler);
  }

  /**
   * Subscribe to alert updates
   */
  subscribeToAlerts(handler) {
    return this.ws.subscribe('alert_update', handler);
  }

  /**
   * Subscribe to metric updates
   */
  subscribeToMetrics(handler) {
    return this.ws.subscribe('metric_update', handler);
  }

  /**
   * Cache management
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  isValidCache(key) {
    if (!this.cache.has(key)) {
      return false;
    }
    const cached = this.cache.get(key);
    return Date.now() - cached.timestamp < this.cacheTTL;
  }

  invalidateCache(key) {
    this.cache.delete(key);
  }

  clearCache() {
    this.cache.clear();
  }
}

// Singleton instance
let instance;

export function getDashboardAPI() {
  if (!instance) {
    instance = new DashboardAPI();
  }
  return instance;
}

export default DashboardAPI;
