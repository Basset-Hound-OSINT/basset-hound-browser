/**
 * useDashboard Hook
 * Main hook for dashboard state and API integration
 */

import { useEffect, useCallback, useState } from 'react';
import { useDashboardStore } from '../state/store';
import { getDashboardAPI } from '../api/dashboard-api';

interface UseDashboardReturn {
  monitors: unknown[];
  alerts: unknown[];
  timeline: unknown[];
  metrics: unknown | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  connectionStatus: string;
  refreshData: () => Promise<void>;
  markAlertRead: (alertId: string) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  createMonitor: (config: Record<string, unknown>) => Promise<void>;
  updateMonitor: (monitorId: string, config: Record<string, unknown>) => Promise<void>;
  deleteMonitor: (monitorId: string) => Promise<void>;
}

export function useDashboard(): UseDashboardReturn {
  const api = getDashboardAPI();
  const {
    monitors,
    alerts,
    timeline,
    metrics,
    loading,
    error,
    isOffline,
    connectionStatus,
    setMonitors,
    setAlerts,
    setTimeline,
    setMetrics,
    setLoading,
    setError,
    setConnectionStatus,
    setIsOffline,
  } = useDashboardStore();

  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Initialize dashboard on mount
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        setConnectionStatus('connecting');

        // Initialize offline storage
        await api.initializeOfflineStorage();

        // Connect WebSocket
        const ws = require('../api/websocket-client').getWebSocketClient();
        await ws.connect();

        setConnectionStatus('connected');
        await refreshData();

        // Subscribe to real-time updates
        api.subscribeToChanges((data) => {
          console.log('[useDashboard] Received change update:', data);
          setTimeline([data as unknown, ...timeline]);
        });

        api.subscribeToAlerts((data) => {
          console.log('[useDashboard] Received alert update:', data);
          setAlerts([data as unknown, ...alerts]);
        });

        setIsInitialized(true);
      } catch (err) {
        console.error('[useDashboard] Initialization error:', err);
        setError((err as Error).message);
        setConnectionStatus('disconnected');
      } finally {
        setLoading(false);
      }
    };

    if (!isInitialized) {
      initialize();
    }
  }, []);

  /**
   * Refresh all dashboard data
   */
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardData, monitorsData, alertsData, metricsData] = await Promise.all([
        api.getDashboardData().catch(() => null),
        api.getMonitors().catch(() => []),
        api.getAlerts().catch(() => []),
        api.getMetrics().catch(() => null),
      ]);

      if (dashboardData) {
        setTimeline((dashboardData as { timeline?: unknown[] }).timeline || []);
      }

      if (monitorsData) {
        setMonitors(monitorsData);
      }

      if (alertsData) {
        setAlerts(alertsData);
      }

      if (metricsData) {
        setMetrics(metricsData);
      }

      setIsOffline(false);
    } catch (err) {
      console.error('[useDashboard] Refresh error:', err);
      setError((err as Error).message);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Mark alert as read
   */
  const handleMarkAlertRead = useCallback(async (alertId: string) => {
    try {
      await api.markAlertRead(alertId);
      useDashboardStore.setState((state) => ({
        alerts: state.alerts.map((a: any) => (a.id === alertId ? { ...a, read: true } : a)),
      }));
    } catch (err) {
      console.error('[useDashboard] Failed to mark alert read:', err);
      setError((err as Error).message);
    }
  }, []);

  /**
   * Dismiss alert
   */
  const handleDismissAlert = useCallback(async (alertId: string) => {
    try {
      await api.dismissAlert(alertId);
      useDashboardStore.setState((state) => ({
        alerts: state.alerts.map((a: any) => (a.id === alertId ? { ...a, dismissed: true } : a)),
      }));
    } catch (err) {
      console.error('[useDashboard] Failed to dismiss alert:', err);
      setError((err as Error).message);
    }
  }, []);

  /**
   * Acknowledge alert
   */
  const handleAcknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await api.acknowledgeAlert(alertId);
      useDashboardStore.setState((state) => ({
        alerts: state.alerts.map((a: any) => (a.id === alertId ? { ...a, read: true } : a)),
      }));
    } catch (err) {
      console.error('[useDashboard] Failed to acknowledge alert:', err);
      setError((err as Error).message);
    }
  }, []);

  /**
   * Create a new monitor
   */
  const handleCreateMonitor = useCallback(async (config: Record<string, unknown>) => {
    try {
      setLoading(true);
      await api.createMonitor(config);
      await refreshData();
    } catch (err) {
      console.error('[useDashboard] Failed to create monitor:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refreshData]);

  /**
   * Update a monitor
   */
  const handleUpdateMonitor = useCallback(
    async (monitorId: string, config: Record<string, unknown>) => {
      try {
        setLoading(true);
        await api.updateMonitor(monitorId, config);
        await refreshData();
      } catch (err) {
        console.error('[useDashboard] Failed to update monitor:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [refreshData]
  );

  /**
   * Delete a monitor
   */
  const handleDeleteMonitor = useCallback(
    async (monitorId: string) => {
      try {
        setLoading(true);
        await api.deleteMonitor(monitorId);
        await refreshData();
      } catch (err) {
        console.error('[useDashboard] Failed to delete monitor:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [refreshData]
  );

  return {
    monitors,
    alerts,
    timeline,
    metrics,
    loading,
    error,
    isOffline,
    connectionStatus,
    refreshData,
    markAlertRead: handleMarkAlertRead,
    dismissAlert: handleDismissAlert,
    acknowledgeAlert: handleAcknowledgeAlert,
    createMonitor: handleCreateMonitor,
    updateMonitor: handleUpdateMonitor,
    deleteMonitor: handleDeleteMonitor,
  };
}
