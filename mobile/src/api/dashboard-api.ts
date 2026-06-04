/**
 * Dashboard API Service for Mobile
 * Provides high-level methods for dashboard operations
 * Wraps WebSocket client with domain-specific logic and offline support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWebSocketClient } from './websocket-client';

interface DashboardData {
  monitors: unknown[];
  alerts: unknown[];
  timeline: unknown[];
  metrics: Record<string, unknown>;
}

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

export class DashboardAPI {
  private ws = getWebSocketClient();
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private offlineMode: boolean = false;

  /**
   * Initialize offline storage
   */
  async initializeOfflineStorage(): Promise<void> {
    try {
      // Load cached data from AsyncStorage
      const cachedDashboard = await AsyncStorage.getItem('dashboard_cache');
      const cachedMonitors = await AsyncStorage.getItem('monitors_cache');
      const cachedAlerts = await AsyncStorage.getItem('alerts_cache');

      if (cachedDashboard) {
        this.cache.set('dashboard_data', JSON.parse(cachedDashboard));
      }
      if (cachedMonitors) {
        this.cache.set('monitors', JSON.parse(cachedMonitors));
      }
      if (cachedAlerts) {
        this.cache.set('alerts', JSON.parse(cachedAlerts));
      }

      console.log('[DashboardAPI] Offline storage initialized');
    } catch (error) {
      console.error('[DashboardAPI] Failed to initialize offline storage:', error);
    }
  }

  /**
   * Get dashboard data snapshot
   */
  async getDashboardData(options: Record<string, unknown> = {}): Promise<DashboardData> {
    const cacheKey = 'dashboard_data';
    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey)!.data as DashboardData;
    }

    try {
      const response = await this.ws.send('get_dashboard_data', options);
      this.setCache(cacheKey, response);
      await this.persistCache(cacheKey, response);
      return response as DashboardData;
    } catch (error) {
      console.error('[DashboardAPI] Failed to get dashboard data:', error);
      // Return cached data if available
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.offlineMode = true;
        return cached.data as DashboardData;
      }
      throw error;
    }
  }

  /**
   * Get all monitors
   */
  async getMonitors(): Promise<unknown[]> {
    const cacheKey = 'monitors';
    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey)!.data as unknown[];
    }

    try {
      const response = await this.ws.send('get_monitors', {});
      this.setCache(cacheKey, response);
      await this.persistCache(cacheKey, response);
      return response as unknown[];
    } catch (error) {
      console.error('[DashboardAPI] Failed to get monitors:', error);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.offlineMode = true;
        return cached.data as unknown[];
      }
      throw error;
    }
  }

  /**
   * Create a new monitor
   */
  async createMonitor(config: Record<string, unknown>): Promise<unknown> {
    this.invalidateCache('monitors');
    this.invalidateCache('dashboard_data');

    try {
      const response = await this.ws.send('create_monitor', config);
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to create monitor:', error);
      throw error;
    }
  }

  /**
   * Update monitor configuration
   */
  async updateMonitor(
    monitorId: string,
    config: Record<string, unknown>
  ): Promise<unknown> {
    this.invalidateCache('monitors');
    this.invalidateCache('dashboard_data');

    try {
      const response = await this.ws.send('update_monitor', {
        id: monitorId,
        ...config,
      });
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to update monitor:', error);
      throw error;
    }
  }

  /**
   * Delete a monitor
   */
  async deleteMonitor(monitorId: string): Promise<unknown> {
    this.invalidateCache('monitors');
    this.invalidateCache('dashboard_data');

    try {
      const response = await this.ws.send('delete_monitor', { id: monitorId });
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to delete monitor:', error);
      throw error;
    }
  }

  /**
   * Get changes for a monitor
   */
  async getMonitorChanges(
    monitorId: string,
    options: Record<string, unknown> = {}
  ): Promise<unknown> {
    try {
      const response = await this.ws.send('get_monitor_changes', {
        monitorId,
        ...options,
      });
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to get monitor changes:', error);
      throw error;
    }
  }

  /**
   * Get competitor comparison
   */
  async getComparison(
    monitorIds: string[],
    options: Record<string, unknown> = {}
  ): Promise<unknown> {
    try {
      const response = await this.ws.send('get_competitor_comparison', {
        monitorIds,
        ...options,
      });
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to get comparison:', error);
      throw error;
    }
  }

  /**
   * Get dashboard timeline
   */
  async getTimeline(filters: Record<string, unknown> = {}): Promise<unknown> {
    try {
      const response = await this.ws.send('get_dashboard_timeline', filters);
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to get timeline:', error);
      throw error;
    }
  }

  /**
   * Get dashboard metrics
   */
  async getMetrics(options: Record<string, unknown> = {}): Promise<unknown> {
    try {
      const response = await this.ws.send('get_dashboard_metrics', options);
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to get metrics:', error);
      throw error;
    }
  }

  /**
   * Get dashboard status
   */
  async getStatus(): Promise<unknown> {
    try {
      return this.ws.send('get_dashboard_status', {});
    } catch (error) {
      console.error('[DashboardAPI] Failed to get status:', error);
      throw error;
    }
  }

  /**
   * Get alerts with optional filters
   */
  async getAlerts(filters: Record<string, unknown> = {}): Promise<unknown[]> {
    const cacheKey = 'alerts';
    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey)!.data as unknown[];
    }

    try {
      const response = await this.ws.send('get_dashboard_alerts', filters);
      this.setCache(cacheKey, response);
      await this.persistCache(cacheKey, response);
      return response as unknown[];
    } catch (error) {
      console.error('[DashboardAPI] Failed to get alerts:', error);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.offlineMode = true;
        return cached.data as unknown[];
      }
      throw error;
    }
  }

  /**
   * Get unread alerts
   */
  async getUnreadAlerts(): Promise<unknown> {
    try {
      const response = await this.ws.send('get_unread_alerts', {});
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to get unread alerts:', error);
      throw error;
    }
  }

  /**
   * Mark alert as read
   */
  async markAlertRead(alertId: string): Promise<unknown> {
    this.invalidateCache('alerts');

    try {
      const response = await this.ws.send('mark_alert_read', { id: alertId });
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to mark alert read:', error);
      throw error;
    }
  }

  /**
   * Batch mark alerts as read
   */
  async batchMarkAlertsRead(alertIds: string[]): Promise<unknown> {
    this.invalidateCache('alerts');

    try {
      const response = await this.ws.send('batch_mark_alerts_read', { ids: alertIds });
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to batch mark alerts read:', error);
      throw error;
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<unknown> {
    this.invalidateCache('alerts');

    try {
      const response = await this.ws.send('acknowledge_alert', { id: alertId });
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to acknowledge alert:', error);
      throw error;
    }
  }

  /**
   * Dismiss alert
   */
  async dismissAlert(alertId: string): Promise<unknown> {
    this.invalidateCache('alerts');

    try {
      const response = await this.ws.send('dismiss_alert', { id: alertId });
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to dismiss alert:', error);
      throw error;
    }
  }

  /**
   * Get alert summary
   */
  async getAlertSummary(): Promise<unknown> {
    try {
      const response = await this.ws.send('get_alert_summary', {});
      return response;
    } catch (error) {
      console.error('[DashboardAPI] Failed to get alert summary:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time changes
   */
  subscribeToChanges(handler: (data: unknown) => void): () => void {
    return this.ws.subscribe('dashboard_change', handler);
  }

  /**
   * Subscribe to alert updates
   */
  subscribeToAlerts(handler: (data: unknown) => void): () => void {
    return this.ws.subscribe('alert_update', handler);
  }

  /**
   * Subscribe to metric updates
   */
  subscribeToMetrics(handler: (data: unknown) => void): () => void {
    return this.ws.subscribe('metric_update', handler);
  }

  /**
   * Cache management
   */
  private setCache(key: string, data: unknown) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private isValidCache(key: string): boolean {
    if (!this.cache.has(key)) {
      return false;
    }
    const cached = this.cache.get(key)!;
    return Date.now() - cached.timestamp < this.cacheTTL;
  }

  private invalidateCache(key: string) {
    this.cache.delete(key);
  }

  private async persistCache(key: string, data: unknown): Promise<void> {
    try {
      const storageKey = `${key}_cache`;
      await AsyncStorage.setItem(storageKey, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (error) {
      console.error('[DashboardAPI] Failed to persist cache:', error);
    }
  }

  clearCache() {
    this.cache.clear();
  }

  isOfflineMode(): boolean {
    return this.offlineMode;
  }

  setOfflineMode(offline: boolean) {
    this.offlineMode = offline;
  }
}

// Singleton instance
let instance: DashboardAPI;

export function getDashboardAPI(): DashboardAPI {
  if (!instance) {
    instance = new DashboardAPI();
  }
  return instance;
}
