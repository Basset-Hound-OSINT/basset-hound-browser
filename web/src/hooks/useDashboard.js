import { useState, useEffect, useCallback } from 'react';
import { getDashboardAPI } from '../services/dashboard-api';
import { useWebSocket } from './useWebSocket';

/**
 * Hook to manage dashboard state and operations
 */
export function useDashboard() {
  const [monitors, setMonitors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isConnected } = useWebSocket();

  const api = getDashboardAPI();

  // Load initial data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [monitorsData, alertsData, timelineData, metricsData] = await Promise.all([
          api.getMonitors().catch(() => []),
          api.getAlerts().catch(() => []),
          api.getTimeline().catch(() => []),
          api.getMetrics().catch(() => null),
        ]);

        setMonitors(monitorsData || []);
        setAlerts(alertsData || []);
        setTimeline(timelineData || []);
        setMetrics(metricsData);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (isConnected) {
      loadDashboardData();
    }
  }, [isConnected, api]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribeChanges = api.subscribeToChanges((change) => {
      setTimeline((prev) => [change, ...prev]);
    });

    const unsubscribeAlerts = api.subscribeToAlerts((alert) => {
      setAlerts((prev) => [alert, ...prev]);
    });

    const unsubscribeMetrics = api.subscribeToMetrics((newMetrics) => {
      setMetrics(newMetrics);
    });

    return () => {
      unsubscribeChanges();
      unsubscribeAlerts();
      unsubscribeMetrics();
    };
  }, [api]);

  const createMonitor = useCallback(
    async (config) => {
      try {
        const newMonitor = await api.createMonitor(config);
        setMonitors((prev) => [...prev, newMonitor]);
        return newMonitor;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [api]
  );

  const updateMonitor = useCallback(
    async (monitorId, config) => {
      try {
        const updated = await api.updateMonitor(monitorId, config);
        setMonitors((prev) => prev.map((m) => (m.id === monitorId ? updated : m)));
        return updated;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [api]
  );

  const deleteMonitor = useCallback(
    async (monitorId) => {
      try {
        await api.deleteMonitor(monitorId);
        setMonitors((prev) => prev.filter((m) => m.id !== monitorId));
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [api]
  );

  const markAlertRead = useCallback(
    async (alertId) => {
      try {
        await api.markAlertRead(alertId);
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, read: true } : a))
        );
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [api]
  );

  const dismissAlert = useCallback(
    async (alertId) => {
      try {
        await api.dismissAlert(alertId);
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [api]
  );

  return {
    monitors,
    alerts,
    timeline,
    metrics,
    loading,
    error,
    isConnected,
    createMonitor,
    updateMonitor,
    deleteMonitor,
    markAlertRead,
    dismissAlert,
  };
}
