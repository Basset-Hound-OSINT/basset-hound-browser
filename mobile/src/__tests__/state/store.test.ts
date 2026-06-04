/**
 * Zustand Store Tests
 */

import { renderHook, act } from '@testing-library/react-native';
import { useDashboardStore } from '../../state/store';

describe('Dashboard Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useDashboardStore.setState({
      monitors: [],
      alerts: [],
      timeline: [],
      metrics: null,
    });
  });

  describe('Monitors', () => {
    it('should add a monitor', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.addMonitor({
          id: 'monitor-1',
          name: 'Test Monitor',
          url: 'https://example.com',
          status: 'active',
          lastCheck: Date.now(),
          changeCount: 0,
          alertCount: 0,
        });
      });

      expect(result.current.monitors).toHaveLength(1);
      expect(result.current.monitors[0].name).toBe('Test Monitor');
    });

    it('should update a monitor', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.addMonitor({
          id: 'monitor-1',
          name: 'Test Monitor',
          url: 'https://example.com',
          status: 'active',
          lastCheck: Date.now(),
          changeCount: 0,
          alertCount: 0,
        });

        result.current.updateMonitor('monitor-1', { status: 'paused' });
      });

      expect(result.current.monitors[0].status).toBe('paused');
    });

    it('should remove a monitor', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.addMonitor({
          id: 'monitor-1',
          name: 'Test Monitor',
          url: 'https://example.com',
          status: 'active',
          lastCheck: Date.now(),
          changeCount: 0,
          alertCount: 0,
        });

        result.current.removeMonitor('monitor-1');
      });

      expect(result.current.monitors).toHaveLength(0);
    });

    it('should get a monitor by id', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.addMonitor({
          id: 'monitor-1',
          name: 'Test Monitor',
          url: 'https://example.com',
          status: 'active',
          lastCheck: Date.now(),
          changeCount: 0,
          alertCount: 0,
        });
      });

      const monitor = result.current.getMonitor('monitor-1');
      expect(monitor?.name).toBe('Test Monitor');
    });
  });

  describe('Alerts', () => {
    it('should add an alert', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.addAlert({
          id: 'alert-1',
          monitorId: 'monitor-1',
          title: 'Test Alert',
          description: 'Test description',
          severity: 'high',
          timestamp: Date.now(),
          read: false,
          dismissed: false,
        });
      });

      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0].title).toBe('Test Alert');
    });

    it('should mark alert as read', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.addAlert({
          id: 'alert-1',
          monitorId: 'monitor-1',
          title: 'Test Alert',
          description: 'Test description',
          severity: 'high',
          timestamp: Date.now(),
          read: false,
          dismissed: false,
        });

        result.current.markAlertRead('alert-1');
      });

      expect(result.current.alerts[0].read).toBe(true);
    });

    it('should dismiss alert', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.addAlert({
          id: 'alert-1',
          monitorId: 'monitor-1',
          title: 'Test Alert',
          description: 'Test description',
          severity: 'high',
          timestamp: Date.now(),
          read: false,
          dismissed: false,
        });

        result.current.dismissAlert('alert-1');
      });

      expect(result.current.alerts[0].dismissed).toBe(true);
    });

    it('should get unread count', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.addAlert({
          id: 'alert-1',
          monitorId: 'monitor-1',
          title: 'Test Alert',
          description: 'Test description',
          severity: 'high',
          timestamp: Date.now(),
          read: false,
          dismissed: false,
        });

        result.current.addAlert({
          id: 'alert-2',
          monitorId: 'monitor-1',
          title: 'Test Alert 2',
          description: 'Test description',
          severity: 'low',
          timestamp: Date.now(),
          read: true,
          dismissed: false,
        });
      });

      expect(result.current.getUnreadCount()).toBe(1);
    });

    it('should get critical count', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.addAlert({
          id: 'alert-1',
          monitorId: 'monitor-1',
          title: 'Critical Alert',
          description: 'Test description',
          severity: 'critical',
          timestamp: Date.now(),
          read: false,
          dismissed: false,
        });

        result.current.addAlert({
          id: 'alert-2',
          monitorId: 'monitor-1',
          title: 'High Alert',
          description: 'Test description',
          severity: 'high',
          timestamp: Date.now(),
          read: false,
          dismissed: false,
        });
      });

      expect(result.current.getCriticalCount()).toBe(1);
    });
  });

  describe('Timeline', () => {
    it('should add a change to timeline', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.addChange({
          id: 'change-1',
          monitorId: 'monitor-1',
          description: 'Price changed',
          severity: 'high',
          timestamp: Date.now(),
        });
      });

      expect(result.current.timeline).toHaveLength(1);
      expect(result.current.timeline[0].description).toBe('Price changed');
    });

    it('should clear timeline', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.addChange({
          id: 'change-1',
          monitorId: 'monitor-1',
          description: 'Price changed',
          severity: 'high',
          timestamp: Date.now(),
        });

        result.current.clearTimeline();
      });

      expect(result.current.timeline).toHaveLength(0);
    });
  });

  describe('Settings', () => {
    it('should update settings', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.updateSettings({ theme: 'light' });
      });

      expect(result.current.settings.theme).toBe('light');
    });

    it('should get setting value', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.updateSettings({ notificationsEnabled: false });
      });

      const value = result.current.getSetting('notificationsEnabled');
      expect(value).toBe(false);
    });
  });
});
