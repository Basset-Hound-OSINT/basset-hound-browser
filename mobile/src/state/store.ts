/**
 * Zustand Store for Mobile Dashboard State Management
 * Handles monitors, alerts, timeline, and user preferences
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Monitor {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'paused' | 'error';
  lastCheck: number;
  changeCount: number;
  alertCount: number;
}

interface Alert {
  id: string;
  monitorId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: number;
  read: boolean;
  dismissed: boolean;
}

interface Change {
  id: string;
  monitorId: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: number;
  details?: string;
}

interface Metrics {
  changeFrequency: number;
  detectionRate: number;
  avgResponseTime: number;
  uptime: number;
}

interface Settings {
  theme: 'light' | 'dark';
  notificationsEnabled: boolean;
  offlineMode: boolean;
  autoRefreshInterval: number;
  defaultView: 'overview' | 'list';
}

interface DashboardStore {
  // State
  monitors: Monitor[];
  alerts: Alert[];
  timeline: Change[];
  metrics: Metrics | null;
  settings: Settings;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';

  // Monitors
  setMonitors: (monitors: Monitor[]) => void;
  addMonitor: (monitor: Monitor) => void;
  updateMonitor: (monitorId: string, updates: Partial<Monitor>) => void;
  removeMonitor: (monitorId: string) => void;
  getMonitor: (monitorId: string) => Monitor | undefined;

  // Alerts
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  markAlertRead: (alertId: string) => void;
  dismissAlert: (alertId: string) => void;
  getUnreadCount: () => number;
  getCriticalCount: () => number;

  // Timeline
  setTimeline: (changes: Change[]) => void;
  addChange: (change: Change) => void;
  clearTimeline: () => void;

  // Metrics
  setMetrics: (metrics: Metrics) => void;

  // Settings
  updateSettings: (settings: Partial<Settings>) => void;
  getSetting: <K extends keyof Settings>(key: K) => Settings[K];

  // Loading & Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Connection
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'connecting') => void;
  setIsOffline: (offline: boolean) => void;

  // Persistence
  saveSettings: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  // Initial state
  monitors: [],
  alerts: [],
  timeline: [],
  metrics: null,
  settings: {
    theme: 'dark',
    notificationsEnabled: true,
    offlineMode: true,
    autoRefreshInterval: 30000,
    defaultView: 'overview',
  },
  loading: false,
  error: null,
  isOffline: false,
  connectionStatus: 'disconnected',

  // Monitors
  setMonitors: (monitors) => set({ monitors }),
  addMonitor: (monitor) => set((state) => ({ monitors: [...state.monitors, monitor] })),
  updateMonitor: (monitorId, updates) =>
    set((state) => ({
      monitors: state.monitors.map((m) => (m.id === monitorId ? { ...m, ...updates } : m)),
    })),
  removeMonitor: (monitorId) =>
    set((state) => ({
      monitors: state.monitors.filter((m) => m.id !== monitorId),
    })),
  getMonitor: (monitorId) => get().monitors.find((m) => m.id === monitorId),

  // Alerts
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),
  markAlertRead: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === alertId ? { ...a, read: true } : a)),
    })),
  dismissAlert: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === alertId ? { ...a, dismissed: true } : a)),
    })),
  getUnreadCount: () => get().alerts.filter((a) => !a.read && !a.dismissed).length,
  getCriticalCount: () =>
    get().alerts.filter((a) => a.severity === 'critical' && !a.dismissed).length,

  // Timeline
  setTimeline: (timeline) => set({ timeline }),
  addChange: (change) => set((state) => ({ timeline: [change, ...state.timeline] })),
  clearTimeline: () => set({ timeline: [] }),

  // Metrics
  setMetrics: (metrics) => set({ metrics }),

  // Settings
  updateSettings: (updates) =>
    set((state) => ({ settings: { ...state.settings, ...updates } })),
  getSetting: (key) => get().settings[key],

  // Loading & Error
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Connection
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setIsOffline: (offline) => set({ isOffline: offline }),

  // Persistence
  saveSettings: async () => {
    try {
      const settings = get().settings;
      await AsyncStorage.setItem('dashboard_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('[Store] Failed to save settings:', error);
    }
  },
  loadSettings: async () => {
    try {
      const saved = await AsyncStorage.getItem('dashboard_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        set({ settings });
      }
    } catch (error) {
      console.error('[Store] Failed to load settings:', error);
    }
  },
}));
