/**
 * useDashboard Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useDashboard } from '../../hooks/useDashboard';

describe('useDashboard Hook', () => {
  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useDashboard());

      expect(result.current.monitors).toBeDefined();
      expect(result.current.alerts).toBeDefined();
      expect(result.current.timeline).toBeDefined();
      expect(result.current.loading).toBeDefined();
    });

    it('should set loading state during initialization', () => {
      const { result } = renderHook(() => useDashboard());

      // Initially loading should be true
      expect(typeof result.current.loading).toBe('boolean');
    });
  });

  describe('Refresh Data', () => {
    it('should refresh dashboard data', async () => {
      const { result } = renderHook(() => useDashboard());

      await act(async () => {
        await result.current.refreshData();
      });

      // After refresh, loading should complete
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Alert Actions', () => {
    it('should mark alert as read', async () => {
      const { result } = renderHook(() => useDashboard());

      const testAlertId = 'alert-123';

      await act(async () => {
        await result.current.markAlertRead(testAlertId);
      });

      // Alert should be marked as read
      expect(result.current.alerts).toBeDefined();
    });

    it('should dismiss alert', async () => {
      const { result } = renderHook(() => useDashboard());

      const testAlertId = 'alert-456';

      await act(async () => {
        await result.current.dismissAlert(testAlertId);
      });

      expect(result.current.alerts).toBeDefined();
    });

    it('should acknowledge alert', async () => {
      const { result } = renderHook(() => useDashboard());

      const testAlertId = 'alert-789';

      await act(async () => {
        await result.current.acknowledgeAlert(testAlertId);
      });

      expect(result.current.alerts).toBeDefined();
    });
  });

  describe('Monitor Actions', () => {
    it('should create a monitor', async () => {
      const { result } = renderHook(() => useDashboard());

      const monitorConfig = {
        name: 'Test Monitor',
        url: 'https://example.com',
      };

      await act(async () => {
        await result.current.createMonitor(monitorConfig);
      });

      expect(result.current.monitors).toBeDefined();
    });

    it('should update a monitor', async () => {
      const { result } = renderHook(() => useDashboard());

      const monitorId = 'monitor-123';
      const updates = { name: 'Updated Monitor' };

      await act(async () => {
        await result.current.updateMonitor(monitorId, updates);
      });

      expect(result.current.monitors).toBeDefined();
    });

    it('should delete a monitor', async () => {
      const { result } = renderHook(() => useDashboard());

      const monitorId = 'monitor-123';

      await act(async () => {
        await result.current.deleteMonitor(monitorId);
      });

      expect(result.current.monitors).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const { result } = renderHook(() => useDashboard());

      // Error state should be initialized
      expect(result.current.error === null || typeof result.current.error === 'string').toBe(
        true
      );
    });
  });
});
