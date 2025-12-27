/**
 * Network Analysis Manager Unit Tests
 */

const { NetworkAnalysisManager } = require('../../network-analysis/manager');

// Mock Electron session
jest.mock('electron', () => ({
  session: {
    defaultSession: {
      webRequest: {
        onBeforeRequest: jest.fn(),
        onBeforeSendHeaders: jest.fn(),
        onSendHeaders: jest.fn(),
        onHeadersReceived: jest.fn(),
        onResponseStarted: jest.fn(),
        onCompleted: jest.fn(),
        onErrorOccurred: jest.fn(),
        onBeforeRedirect: jest.fn()
      }
    }
  }
}));

describe('NetworkAnalysisManager', () => {
  let manager;

  beforeEach(() => {
    manager = new NetworkAnalysisManager();
  });

  afterEach(() => {
    manager.cleanup();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('should initialize with default options', () => {
      expect(manager).toBeDefined();
      expect(manager.isCapturing).toBe(false);
      expect(manager.requestTracker).toBeDefined();
      expect(manager.securityAnalyzer).toBeDefined();
    });

    test('should accept custom options', () => {
      const customManager = new NetworkAnalysisManager({
        maxRequests: 1000
      });
      expect(customManager.requestTracker.maxRequests).toBe(1000);
    });
  });

  describe('capture control', () => {
    test('should start capture successfully', () => {
      const result = manager.startCapture();

      expect(result.success).toBe(true);
      expect(manager.isCapturing).toBe(true);
      expect(result.captureStartTime).toBeDefined();
    });

    test('should return error if capture already in progress', () => {
      manager.startCapture();
      const result = manager.startCapture();

      expect(result.success).toBe(false);
      expect(result.error).toContain('already in progress');
    });

    test('should stop capture successfully', () => {
      manager.startCapture();
      const result = manager.stopCapture();

      expect(result.success).toBe(true);
      expect(manager.isCapturing).toBe(false);
      expect(result.captureDuration).toBeDefined();
    });

    test('should return error if no capture in progress', () => {
      const result = manager.stopCapture();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No capture in progress');
    });
  });

  describe('getRequests', () => {
    test('should return empty array when no requests', () => {
      const result = manager.getRequests();

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(result.requests).toEqual([]);
    });

    test('should accept filter options', () => {
      const result = manager.getRequests({ resourceType: 'script' });

      expect(result.success).toBe(true);
      expect(result.filter).toEqual({ resourceType: 'script' });
    });
  });

  describe('getRequestsByDomain', () => {
    test('should return grouped requests', () => {
      const result = manager.getRequestsByDomain();

      expect(result.success).toBe(true);
      expect(result.domainCount).toBeDefined();
      expect(Array.isArray(result.domains)).toBe(true);
    });
  });

  describe('getSlowRequests', () => {
    test('should accept custom threshold', () => {
      const result = manager.getSlowRequests(2000);

      expect(result.success).toBe(true);
      expect(result.thresholdMs).toBe(2000);
    });

    test('should use default threshold', () => {
      const result = manager.getSlowRequests();

      expect(result.thresholdMs).toBe(1000);
    });
  });

  describe('getFailedRequests', () => {
    test('should return failed requests', () => {
      const result = manager.getFailedRequests();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.requests)).toBe(true);
    });
  });

  describe('getStatistics', () => {
    test('should return capture statistics', () => {
      const result = manager.getStatistics();

      expect(result.success).toBe(true);
      expect(result.isCapturing).toBe(false);
      expect(result.sessionStats).toBeDefined();
      expect(result.requestStats).toBeDefined();
    });
  });

  describe('getStatus', () => {
    test('should return current status', () => {
      const result = manager.getStatus();

      expect(result.success).toBe(true);
      expect(result.isCapturing).toBe(false);
      expect(result.capturedRequestCount).toBeDefined();
    });

    test('should reflect capture state', () => {
      manager.startCapture();
      const result = manager.getStatus();

      expect(result.isCapturing).toBe(true);
    });
  });

  describe('clearCapture', () => {
    test('should clear all captured data', () => {
      manager.startCapture();
      manager.stopCapture();

      const result = manager.clearCapture();

      expect(result.success).toBe(true);
    });
  });

  describe('exportCapture', () => {
    test('should export captured data', () => {
      const result = manager.exportCapture();

      expect(result.success).toBe(true);
      expect(result.exportedAt).toBeDefined();
    });
  });

  describe('setMaxRequests', () => {
    test('should update max requests', () => {
      const result = manager.setMaxRequests(1000);

      expect(result.success).toBe(true);
      expect(result.maxRequests).toBe(1000);
    });

    test('should reject invalid values', () => {
      const result = manager.setMaxRequests(50);

      expect(result.success).toBe(false);
      expect(result.error).toContain('>= 100');
    });
  });

  describe('security analysis', () => {
    test('getSecurityHeadersList should return headers', () => {
      const result = manager.getSecurityHeadersList();

      expect(result.success).toBe(true);
      expect(result.headers).toBeDefined();
    });

    test('getCSPDirectivesList should return directives', () => {
      const result = manager.getCSPDirectivesList();

      expect(result.success).toBe(true);
    });
  });

  describe('cleanup', () => {
    test('should stop capture and clear data', () => {
      manager.startCapture();
      manager.cleanup();

      expect(manager.isCapturing).toBe(false);
    });
  });
});
