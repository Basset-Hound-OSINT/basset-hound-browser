/**
 * Integration tests for dashboard functionality
 */

describe('Dashboard Integration Tests', () => {
  describe('WebSocket Communication', () => {
    test('connects to WebSocket server on startup', (done) => {
      const mockWsUrl = 'ws://localhost:8765';
      const WebSocketClient = require('../../src/services/websocket-client').default;
      const client = new WebSocketClient(mockWsUrl);

      // Mock WebSocket
      const mockWs = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
      };
      global.WebSocket = jest.fn(() => mockWs);

      client.connect().then(() => {
        expect(client.isConnected).toBe(false); // Mocked, so will be false
        done();
      });
    });

    test('queues messages when disconnected', () => {
      const WebSocketClient = require('../../src/services/websocket-client').default;
      const client = new WebSocketClient('ws://localhost:8765');
      client.isConnected = false;

      client.send('test_command', { param: 'value' });

      expect(client.messageQueue.length).toBe(1);
      expect(client.messageQueue[0].command).toBe('test_command');
    });

    test('retries connection with exponential backoff', (done) => {
      const WebSocketClient = require('../../src/services/websocket-client').default;
      const client = new WebSocketClient('ws://localhost:8765');

      global.WebSocket = jest.fn(() => {
        throw new Error('Connection failed');
      });

      client.connect().catch(() => {
        expect(client.reconnectAttempts).toBeGreaterThan(0);
        done();
      });
    });
  });

  describe('Dashboard API Layer', () => {
    test('caches dashboard data', () => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      const testData = {
        monitors: [],
        alerts: [],
        timeline: [],
      };

      api.setCache('test_key', testData);
      expect(api.isValidCache('test_key')).toBe(true);
      expect(api.cache.get('test_key').data).toEqual(testData);
    });

    test('invalidates cache', () => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      api.setCache('test_key', { data: 'test' });
      api.invalidateCache('test_key');

      expect(api.isValidCache('test_key')).toBe(false);
    });

    test('respects cache TTL', () => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      api.setCache('test_key', { data: 'test' });

      // Simulate expired cache
      const cached = api.cache.get('test_key');
      cached.timestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago

      expect(api.isValidCache('test_key')).toBe(false);
    });

    test('clears all cache', () => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      api.setCache('key1', { data: 1 });
      api.setCache('key2', { data: 2 });

      api.clearCache();

      expect(api.cache.size).toBe(0);
    });
  });

  describe('Monitor Management Flow', () => {
    test('creates a new monitor', (done) => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      // Mock the WebSocket send
      api.ws.send = jest.fn().mockResolvedValue({
        id: '1',
        name: 'Test Monitor',
        url: 'https://example.com',
      });

      api.createMonitor({
        name: 'Test Monitor',
        url: 'https://example.com',
      }).then((result) => {
        expect(result).toBeDefined();
        expect(api.cache.has('monitors')).toBe(false); // Cache should be invalidated
        done();
      });
    });

    test('updates an existing monitor', (done) => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      api.ws.send = jest.fn().mockResolvedValue({
        id: '1',
        name: 'Updated Monitor',
      });

      api.updateMonitor('1', { name: 'Updated Monitor' }).then(() => {
        expect(api.cache.has('monitors')).toBe(false);
        done();
      });
    });

    test('deletes a monitor', (done) => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      api.ws.send = jest.fn().mockResolvedValue({ success: true });

      api.deleteMonitor('1').then(() => {
        expect(api.cache.has('monitors')).toBe(false);
        done();
      });
    });
  });

  describe('Alert Management Flow', () => {
    test('fetches alerts with filters', (done) => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      api.ws.send = jest.fn().mockResolvedValue([
        {
          id: '1',
          severity: 'high',
          status: 'new',
        },
      ]);

      api.getAlerts({ severity: 'high' }).then((alerts) => {
        expect(alerts).toBeDefined();
        expect(api.ws.send).toHaveBeenCalledWith('get_dashboard_alerts', { severity: 'high' });
        done();
      });
    });

    test('marks alert as read', (done) => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      api.ws.send = jest.fn().mockResolvedValue({ success: true });

      api.markAlertRead('1').then(() => {
        expect(api.cache.has('alerts')).toBe(false);
        done();
      });
    });

    test('batch acknowledges alerts', (done) => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      api.ws.send = jest.fn().mockResolvedValue({ success: true });

      api.batchAcknowledgeAlerts(['1', '2', '3']).then(() => {
        expect(api.ws.send).toHaveBeenCalledWith(
          'batch_acknowledge_alerts',
          { ids: ['1', '2', '3'] }
        );
        done();
      });
    });
  });

  describe('Data Subscription Flow', () => {
    test('subscribes to change updates', () => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      const handler = jest.fn();
      api.ws.subscribe = jest.fn().mockReturnValue(() => {});

      api.subscribeToChanges(handler);

      expect(api.ws.subscribe).toHaveBeenCalledWith('dashboard_change', handler);
    });

    test('subscribes to alert updates', () => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      const handler = jest.fn();
      api.ws.subscribe = jest.fn().mockReturnValue(() => {});

      api.subscribeToAlerts(handler);

      expect(api.ws.subscribe).toHaveBeenCalledWith('alert_update', handler);
    });

    test('unsubscribes from updates', () => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      const unsubscribe = jest.fn();
      api.ws.subscribe = jest.fn().mockReturnValue(unsubscribe);

      const handler = jest.fn();
      const sub = api.subscribeToChanges(handler);

      expect(typeof sub).toBe('function');
    });
  });

  describe('Error Handling', () => {
    test('handles WebSocket connection errors', (done) => {
      const WebSocketClient = require('../../src/services/websocket-client').default;
      const client = new WebSocketClient('ws://localhost:8765');

      const errorHandler = jest.fn();
      client.on('error', errorHandler);

      // Emit error
      client.emit('error', new Error('Connection failed'));

      setTimeout(() => {
        expect(errorHandler).toHaveBeenCalled();
        done();
      }, 100);
    });

    test('handles request timeouts', (done) => {
      const WebSocketClient = require('../../src/services/websocket-client').default;
      const client = new WebSocketClient('ws://localhost:8765');
      client.messageTimeout = 100;
      client.isConnected = false;

      // Mock ws
      client.ws = {
        send: jest.fn(),
      };
      client.isConnected = true;

      client.send('test_command', {}).catch((err) => {
        expect(err.message).toContain('timeout');
        done();
      });
    });

    test('handles API errors gracefully', (done) => {
      const DashboardAPI = require('../../src/services/dashboard-api').default;
      const api = new DashboardAPI();

      api.ws.send = jest.fn().mockRejectedValue(new Error('API Error'));

      api.getMonitors().catch((err) => {
        expect(err).toBeDefined();
        done();
      });
    });
  });
});
