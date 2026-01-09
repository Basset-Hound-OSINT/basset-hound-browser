/**
 * Unit tests for Page Monitor
 *
 * Tests for page monitoring and change detection functionality
 */

const { PageMonitor, DETECTION_METHODS, CHANGE_TYPES, MONITOR_STATUS } = require('../../monitoring/page-monitor');

// Mock Electron IPC
const mockIpcMain = {
  on: jest.fn()
};

// Mock main window
const mockMainWindow = {
  webContents: {
    send: jest.fn(),
    getURL: jest.fn(() => 'https://example.com'),
    getTitle: jest.fn(() => 'Example Page'),
    getUserAgent: jest.fn(() => 'Mozilla/5.0')
  }
};

// Replace require for electron
jest.mock('electron', () => ({
  ipcMain: mockIpcMain
}));

describe('PageMonitor', () => {
  let monitor;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new PageMonitor(mockMainWindow);
  });

  afterEach(() => {
    if (monitor) {
      monitor.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should create PageMonitor instance', () => {
      expect(monitor).toBeInstanceOf(PageMonitor);
      expect(monitor.mainWindow).toBe(mockMainWindow);
    });

    test('should initialize empty collections', () => {
      expect(monitor.monitors.size).toBe(0);
      expect(monitor.snapshots.size).toBe(0);
      expect(monitor.changeHistory.size).toBe(0);
      expect(monitor.schedules.size).toBe(0);
      expect(monitor.zones.size).toBe(0);
    });

    test('should setup IPC listeners', () => {
      expect(mockIpcMain.on).toHaveBeenCalled();
      const channels = mockIpcMain.on.mock.calls.map(call => call[0]);
      expect(channels).toContain('page-snapshot-response');
      expect(channels).toContain('page-diff-response');
      expect(channels).toContain('screenshot-compare-response');
    });

    test('should initialize counters to 0', () => {
      expect(monitor.requestIdCounter).toBe(0);
      expect(monitor.monitorIdCounter).toBe(0);
    });
  });

  describe('ID Generation', () => {
    test('should generate unique request IDs', () => {
      const id1 = monitor.generateRequestId();
      const id2 = monitor.generateRequestId();
      expect(id1).toMatch(/^monitor-req-\d+-\d+$/);
      expect(id2).toMatch(/^monitor-req-\d+-\d+$/);
      expect(id1).not.toBe(id2);
    });

    test('should generate unique monitor IDs', () => {
      const id1 = monitor.generateMonitorId();
      const id2 = monitor.generateMonitorId();
      expect(id1).toMatch(/^monitor-\d+-\d+$/);
      expect(id2).toMatch(/^monitor-\d+-\d+$/);
      expect(id1).not.toBe(id2);
    });

    test('should increment counters for each ID', () => {
      expect(monitor.requestIdCounter).toBe(0);
      monitor.generateRequestId();
      expect(monitor.requestIdCounter).toBe(1);
      monitor.generateRequestId();
      expect(monitor.requestIdCounter).toBe(2);
    });
  });

  describe('Start Monitoring', () => {
    test('should start monitoring with default config', async () => {
      // Mock snapshot capture
      const mockSnapshot = {
        success: true,
        snapshot: {
          id: 'snap-1',
          timestamp: new Date().toISOString(),
          contentHash: 'hash123',
          dom: { elementCount: 100 }
        }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);

      const result = await monitor.startMonitoring();

      expect(result.success).toBe(true);
      expect(result.monitorId).toBeDefined();
      expect(result.monitor).toBeDefined();
      expect(result.initialSnapshot).toBe(mockSnapshot.snapshot);
    });

    test('should start monitoring with custom config', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);

      const config = {
        methods: [DETECTION_METHODS.DOM_DIFF],
        interval: 30000,
        threshold: 0.2,
        notifyOnChange: false
      };

      const result = await monitor.startMonitoring(config);

      expect(result.success).toBe(true);
      expect(result.monitor.methods).toEqual([DETECTION_METHODS.DOM_DIFF]);
      expect(result.monitor.interval).toBe(30000);
      expect(result.monitor.threshold).toBe(0.2);
      expect(result.monitor.notifyOnChange).toBe(false);
    });

    test('should store monitor in monitors map', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);

      const result = await monitor.startMonitoring();
      const monitorId = result.monitorId;

      expect(monitor.monitors.has(monitorId)).toBe(true);
      expect(monitor.snapshots.has(monitorId)).toBe(true);
      expect(monitor.changeHistory.has(monitorId)).toBe(true);
    });

    test('should set monitor status to ACTIVE', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);

      const result = await monitor.startMonitoring();

      expect(result.monitor.status).toBe(MONITOR_STATUS.ACTIVE);
    });

    test('should schedule monitoring if interval is set', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      monitor.scheduleMonitoring = jest.fn();

      const result = await monitor.startMonitoring({ interval: 60000 });

      expect(monitor.scheduleMonitoring).toHaveBeenCalledWith(result.monitorId);
    });

    test('should not schedule if interval is 0', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      monitor.scheduleMonitoring = jest.fn();

      await monitor.startMonitoring({ interval: 0 });

      expect(monitor.scheduleMonitoring).not.toHaveBeenCalled();
    });

    test('should handle snapshot capture failure', async () => {
      monitor.captureSnapshot = jest.fn().mockResolvedValue({
        success: false,
        error: 'Snapshot failed'
      });

      const result = await monitor.startMonitoring();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Snapshot failed');
    });

    test('should validate URL if provided', async () => {
      const result = await monitor.startMonitoring({
        url: 'https://different.com'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not match');
    });

    test('should initialize statistics', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);

      const result = await monitor.startMonitoring();
      const monitorId = result.monitorId;

      const stats = monitor.statistics.get(monitorId);
      expect(stats.totalChecks).toBe(1);
      expect(stats.totalChanges).toBe(0);
      expect(stats.detectionRate).toBe(0);
    });
  });

  describe('Stop Monitoring', () => {
    test('should stop active monitor', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.stopMonitoring(monitorId);

      expect(result.success).toBe(true);
      expect(result.monitor.status).toBe(MONITOR_STATUS.STOPPED);
      expect(result.monitor.stoppedAt).toBeDefined();
    });

    test('should clear schedule when stopping', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring({ interval: 60000 });
      const monitorId = startResult.monitorId;

      // Mock interval handle
      monitor.schedules.set(monitorId, 12345);

      monitor.stopMonitoring(monitorId);

      expect(monitor.schedules.has(monitorId)).toBe(false);
    });

    test('should return error for invalid monitor ID', () => {
      const result = monitor.stopMonitoring('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Monitor not found');
    });

    test('should include statistics in stop result', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.stopMonitoring(monitorId);

      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalChecks).toBeGreaterThan(0);
    });
  });

  describe('Pause and Resume Monitoring', () => {
    test('should pause active monitor', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.pauseMonitoring(monitorId);

      expect(result.success).toBe(true);
      expect(result.monitor.status).toBe(MONITOR_STATUS.PAUSED);
      expect(result.monitor.pausedAt).toBeDefined();
    });

    test('should resume paused monitor', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      monitor.pauseMonitoring(monitorId);
      monitor.scheduleMonitoring = jest.fn();

      const result = monitor.resumeMonitoring(monitorId);

      expect(result.success).toBe(true);
      expect(result.monitor.status).toBe(MONITOR_STATUS.ACTIVE);
      expect(result.monitor.resumedAt).toBeDefined();
      expect(monitor.scheduleMonitoring).toHaveBeenCalledWith(monitorId);
    });

    test('should not resume non-paused monitor', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.resumeMonitoring(monitorId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not paused');
    });

    test('should clear schedule when pausing', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring({ interval: 60000 });
      const monitorId = startResult.monitorId;

      monitor.schedules.set(monitorId, 12345);
      monitor.pauseMonitoring(monitorId);

      expect(monitor.schedules.has(monitorId)).toBe(false);
    });
  });

  describe('Change Detection - Hash Method', () => {
    test('should detect content hash changes', () => {
      const snapshot1 = {
        contentHash: 'hash123',
        zones: []
      };

      const snapshot2 = {
        contentHash: 'hash456',
        zones: []
      };

      const changes = monitor.detectHashChanges(snapshot1, snapshot2);

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe(CHANGE_TYPES.CONTENT);
      expect(changes[0].method).toBe(DETECTION_METHODS.CONTENT_HASH);
    });

    test('should not detect changes when hashes match', () => {
      const snapshot1 = {
        contentHash: 'hash123',
        zones: []
      };

      const snapshot2 = {
        contentHash: 'hash123',
        zones: []
      };

      const changes = monitor.detectHashChanges(snapshot1, snapshot2);

      expect(changes.length).toBe(0);
    });

    test('should detect zone hash changes', () => {
      const zones = [{ selector: '.content' }];

      const snapshot1 = {
        contentHash: 'hash123',
        zones: [{ selector: '.content', hash: 'zone-hash-1' }]
      };

      const snapshot2 = {
        contentHash: 'hash123',
        zones: [{ selector: '.content', hash: 'zone-hash-2' }]
      };

      const changes = monitor.detectHashChanges(snapshot1, snapshot2, zones);

      expect(changes.length).toBe(1);
      expect(changes[0].scope).toBe('zone');
      expect(changes[0].selector).toBe('.content');
    });
  });

  describe('Change Detection - DOM Method', () => {
    test('should detect element count changes', () => {
      const snapshot1 = {
        dom: { elementCount: 100, elements: [] }
      };

      const snapshot2 = {
        dom: { elementCount: 150, elements: [] }
      };

      const changes = monitor.detectDOMChanges(snapshot1, snapshot2);

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe(CHANGE_TYPES.STRUCTURE);
      expect(changes[0].delta).toBe(50);
    });

    test('should detect added elements', () => {
      const snapshot1 = {
        dom: {
          elementCount: 100,
          elements: [{ tagName: 'div' }]
        }
      };

      const snapshot2 = {
        dom: {
          elementCount: 101,
          elements: [{ tagName: 'div' }, { tagName: 'span' }]
        }
      };

      const changes = monitor.detectDOMChanges(snapshot1, snapshot2);

      const addedChanges = changes.filter(c => c.type === CHANGE_TYPES.ADDED);
      expect(addedChanges.length).toBeGreaterThan(0);
    });

    test('should detect removed elements', () => {
      const snapshot1 = {
        dom: {
          elementCount: 101,
          elements: [{ tagName: 'div' }, { tagName: 'span' }]
        }
      };

      const snapshot2 = {
        dom: {
          elementCount: 100,
          elements: [{ tagName: 'div' }]
        }
      };

      const changes = monitor.detectDOMChanges(snapshot1, snapshot2);

      const removedChanges = changes.filter(c => c.type === CHANGE_TYPES.REMOVED);
      expect(removedChanges.length).toBeGreaterThan(0);
    });
  });

  describe('Change Detection - Text Method', () => {
    test('should detect text content changes', () => {
      const snapshot1 = {
        textContent: 'Hello World'
      };

      const snapshot2 = {
        textContent: 'Hello World Updated'
      };

      const changes = monitor.detectTextChanges(snapshot1, snapshot2);

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe(CHANGE_TYPES.CONTENT);
      expect(changes[0].method).toBe(DETECTION_METHODS.TEXT_DIFF);
    });

    test('should not detect changes when text matches', () => {
      const snapshot1 = { textContent: 'Hello World' };
      const snapshot2 = { textContent: 'Hello World' };

      const changes = monitor.detectTextChanges(snapshot1, snapshot2);

      expect(changes.length).toBe(0);
    });

    test('should calculate text length delta', () => {
      const snapshot1 = { textContent: 'Hello' };
      const snapshot2 = { textContent: 'Hello World' };

      const changes = monitor.detectTextChanges(snapshot1, snapshot2);

      expect(changes[0].delta).toBe(6);
    });
  });

  describe('Change Detection - Attribute Method', () => {
    test('should detect attribute changes', () => {
      const snapshot1 = {
        dom: {
          elements: [{
            id: 'el1',
            selector: '#el1',
            attributes: { class: 'old-class' }
          }]
        }
      };

      const snapshot2 = {
        dom: {
          elements: [{
            id: 'el1',
            selector: '#el1',
            attributes: { class: 'new-class' }
          }]
        }
      };

      const changes = monitor.detectAttributeChanges(snapshot1, snapshot2);

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe(CHANGE_TYPES.ATTRIBUTE);
    });

    test('should not detect changes when attributes match', () => {
      const snapshot1 = {
        dom: {
          elements: [{
            id: 'el1',
            attributes: { class: 'same' }
          }]
        }
      };

      const snapshot2 = {
        dom: {
          elements: [{
            id: 'el1',
            attributes: { class: 'same' }
          }]
        }
      };

      const changes = monitor.detectAttributeChanges(snapshot1, snapshot2);

      expect(changes.length).toBe(0);
    });
  });

  describe('Change Detection - Structure Method', () => {
    test('should detect structure changes', () => {
      const snapshot1 = {
        dom: { structure: { type: 'old' } }
      };

      const snapshot2 = {
        dom: { structure: { type: 'new' } }
      };

      const changes = monitor.detectStructureChanges(snapshot1, snapshot2);

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe(CHANGE_TYPES.STRUCTURE);
    });

    test('should not detect changes when structure matches', () => {
      const snapshot1 = {
        dom: { structure: { type: 'same' } }
      };

      const snapshot2 = {
        dom: { structure: { type: 'same' } }
      };

      const changes = monitor.detectStructureChanges(snapshot1, snapshot2);

      expect(changes.length).toBe(0);
    });
  });

  describe('Change Deduplication', () => {
    test('should deduplicate identical changes', () => {
      const changes = [
        { type: CHANGE_TYPES.CONTENT, scope: 'page' },
        { type: CHANGE_TYPES.CONTENT, scope: 'page' },
        { type: CHANGE_TYPES.STRUCTURE, scope: 'page' }
      ];

      const deduplicated = monitor.deduplicateChanges(changes);

      expect(deduplicated.length).toBe(2);
    });

    test('should keep changes with different selectors', () => {
      const changes = [
        { type: CHANGE_TYPES.CONTENT, scope: 'zone', selector: '.zone1' },
        { type: CHANGE_TYPES.CONTENT, scope: 'zone', selector: '.zone2' }
      ];

      const deduplicated = monitor.deduplicateChanges(changes);

      expect(deduplicated.length).toBe(2);
    });
  });

  describe('Change Categorization', () => {
    test('should categorize changes by type', () => {
      const changes = [
        { type: CHANGE_TYPES.CONTENT },
        { type: CHANGE_TYPES.STRUCTURE },
        { type: CHANGE_TYPES.CONTENT }
      ];

      const categorized = monitor.categorizeChanges(changes);

      expect(categorized.content.length).toBe(2);
      expect(categorized.structure.length).toBe(1);
    });

    test('should create empty arrays for unused categories', () => {
      const changes = [
        { type: CHANGE_TYPES.CONTENT }
      ];

      const categorized = monitor.categorizeChanges(changes);

      expect(categorized.style).toEqual([]);
      expect(categorized.attribute).toEqual([]);
    });
  });

  describe('Change Summary', () => {
    test('should generate summary with counts', () => {
      const categorized = {
        content: [{ type: CHANGE_TYPES.CONTENT }, { type: CHANGE_TYPES.CONTENT }],
        structure: [{ type: CHANGE_TYPES.STRUCTURE }],
        style: [],
        attribute: [],
        added: [],
        removed: [],
        modified: [],
        visual: []
      };

      const summary = monitor.generateChangeSummary(categorized);

      expect(summary.total).toBe(3);
      expect(summary.byType.content).toBe(2);
      expect(summary.byType.structure).toBe(1);
      expect(summary.description).toContain('2 content changes');
      expect(summary.description).toContain('1 structure change');
    });

    test('should handle no changes', () => {
      const categorized = {
        content: [],
        structure: [],
        style: [],
        attribute: [],
        added: [],
        removed: [],
        modified: [],
        visual: []
      };

      const summary = monitor.generateChangeSummary(categorized);

      expect(summary.total).toBe(0);
      expect(summary.description.length).toBe(0);
    });
  });

  describe('Significance Calculation', () => {
    test('should calculate significance for changes', () => {
      const categorized = {
        structure: [{}],
        content: [{}],
        style: [],
        attribute: [],
        added: [],
        removed: [],
        modified: [],
        visual: []
      };

      const significance = monitor.calculateSignificance(categorized);

      expect(significance).toBeGreaterThan(0);
      expect(significance).toBeLessThanOrEqual(1);
    });

    test('should weight structure changes higher', () => {
      const structureChanges = {
        structure: [{}],
        content: [],
        style: [],
        attribute: [],
        added: [],
        removed: [],
        modified: [],
        visual: []
      };

      const styleChanges = {
        structure: [],
        content: [],
        style: [{}],
        attribute: [],
        added: [],
        removed: [],
        modified: [],
        visual: []
      };

      const structureSig = monitor.calculateSignificance(structureChanges);
      const styleSig = monitor.calculateSignificance(styleChanges);

      expect(structureSig).toBeGreaterThan(styleSig);
    });

    test('should return 0 for no changes', () => {
      const categorized = {
        content: [],
        structure: [],
        style: [],
        attribute: [],
        added: [],
        removed: [],
        modified: [],
        visual: []
      };

      const significance = monitor.calculateSignificance(categorized);

      expect(significance).toBe(0);
    });
  });

  describe('Get Page Changes', () => {
    test('should return changes for monitor', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      // Add mock changes
      monitor.changeHistory.set(monitorId, [
        { id: 'change-1', timestamp: new Date().toISOString() },
        { id: 'change-2', timestamp: new Date().toISOString() }
      ]);

      const result = monitor.getPageChanges(monitorId);

      expect(result.success).toBe(true);
      expect(result.changes.length).toBe(2);
    });

    test('should support pagination', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      // Add mock changes
      const changes = Array.from({ length: 100 }, (_, i) => ({
        id: `change-${i}`,
        timestamp: new Date().toISOString()
      }));
      monitor.changeHistory.set(monitorId, changes);

      const result = monitor.getPageChanges(monitorId, { limit: 10, offset: 0 });

      expect(result.changes.length).toBe(10);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.hasMore).toBe(true);
    });

    test('should filter by time range', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const now = new Date();
      const hourAgo = new Date(now.getTime() - 3600000);

      monitor.changeHistory.set(monitorId, [
        { id: 'change-1', timestamp: hourAgo.toISOString() },
        { id: 'change-2', timestamp: now.toISOString() }
      ]);

      const result = monitor.getPageChanges(monitorId, {
        since: hourAgo.toISOString()
      });

      expect(result.changes.length).toBe(2);
    });

    test('should return error for invalid monitor', () => {
      const result = monitor.getPageChanges('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Monitor not found');
    });
  });

  describe('Get Monitoring Schedule', () => {
    test('should return schedule information', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring({ interval: 60000 });
      const monitorId = startResult.monitorId;

      monitor.schedules.set(monitorId, 12345);

      const result = monitor.getMonitoringSchedule(monitorId);

      expect(result.success).toBe(true);
      expect(result.schedule.interval).toBe(60000);
      expect(result.schedule.active).toBe(true);
      expect(result.schedule.nextCheck).toBeDefined();
    });

    test('should indicate inactive schedule', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring({ interval: 0 });
      const monitorId = startResult.monitorId;

      const result = monitor.getMonitoringSchedule(monitorId);

      expect(result.success).toBe(true);
      expect(result.schedule.active).toBe(false);
      expect(result.schedule.nextCheck).toBeNull();
    });
  });

  describe('Configure Change Detection', () => {
    test('should update detection methods', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.configureChangeDetection(monitorId, {
        methods: [DETECTION_METHODS.DOM_DIFF]
      });

      expect(result.success).toBe(true);
      expect(result.monitor.methods).toEqual([DETECTION_METHODS.DOM_DIFF]);
    });

    test('should update threshold', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.configureChangeDetection(monitorId, {
        threshold: 0.5
      });

      expect(result.success).toBe(true);
      expect(result.monitor.threshold).toBe(0.5);
    });

    test('should reschedule if interval changes', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring({ interval: 60000 });
      const monitorId = startResult.monitorId;

      monitor.scheduleMonitoring = jest.fn();

      monitor.configureChangeDetection(monitorId, { interval: 30000 });

      expect(monitor.scheduleMonitoring).toHaveBeenCalledWith(monitorId);
    });
  });

  describe('Export Change Report', () => {
    test('should export report in JSON format', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.exportChangeReport(monitorId, { format: 'json' });

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.data).toBeDefined();
      expect(() => JSON.parse(result.data)).not.toThrow();
    });

    test('should export report in CSV format', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.exportChangeReport(monitorId, { format: 'csv' });

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');
      expect(result.data).toContain('Timestamp');
    });

    test('should export report in HTML format', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.exportChangeReport(monitorId, { format: 'html' });

      expect(result.success).toBe(true);
      expect(result.format).toBe('html');
      expect(result.data).toContain('<!DOCTYPE html>');
    });

    test('should export report in Markdown format', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.exportChangeReport(monitorId, { format: 'markdown' });

      expect(result.success).toBe(true);
      expect(result.format).toBe('markdown');
      expect(result.data).toContain('# Page Monitor Report');
    });

    test('should reject unsupported format', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.exportChangeReport(monitorId, { format: 'xml' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported format');
    });
  });

  describe('Get Monitoring Statistics', () => {
    test('should return comprehensive statistics', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.getMonitoringStats(monitorId);

      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalChecks).toBeGreaterThan(0);
      expect(result.statistics.uptime).toBeDefined();
      expect(result.statistics.url).toBe('https://example.com');
    });

    test('should include changes by type', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      // Add mock changes
      monitor.changeHistory.set(monitorId, [
        { summary: { byType: { content: 2, structure: 1 } } }
      ]);

      const result = monitor.getMonitoringStats(monitorId);

      expect(result.statistics.changesByType).toBeDefined();
      expect(result.statistics.changesByType.content).toBe(2);
    });
  });

  describe('Monitoring Zones', () => {
    test('should add monitoring zone', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.addMonitoringZone(monitorId, {
        selector: '.content',
        name: 'Main Content'
      });

      expect(result.success).toBe(true);
      expect(result.zone.selector).toBe('.content');
      expect(result.zone.name).toBe('Main Content');
      expect(result.totalZones).toBe(1);
    });

    test('should not add duplicate zone', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      monitor.addMonitoringZone(monitorId, { selector: '.content' });
      const result = monitor.addMonitoringZone(monitorId, { selector: '.content' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    test('should remove monitoring zone', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const addResult = monitor.addMonitoringZone(monitorId, { selector: '.content' });
      const zoneId = addResult.zone.id;

      const result = monitor.removeMonitoringZone(monitorId, zoneId);

      expect(result.success).toBe(true);
      expect(result.totalZones).toBe(0);
    });

    test('should return error for invalid zone ID', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      const result = monitor.removeMonitoringZone(monitorId, 'invalid-zone-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Zone not found');
    });
  });

  describe('List Monitored Pages', () => {
    test('should list all monitors', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);

      await monitor.startMonitoring();
      await monitor.startMonitoring();

      const result = monitor.listMonitoredPages();

      expect(result.success).toBe(true);
      expect(result.monitors.length).toBe(2);
      expect(result.total).toBe(2);
    });

    test('should count active and paused monitors', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);

      const result1 = await monitor.startMonitoring();
      const result2 = await monitor.startMonitoring();

      monitor.pauseMonitoring(result1.monitorId);

      const listResult = monitor.listMonitoredPages();

      expect(listResult.active).toBe(1);
      expect(listResult.paused).toBe(1);
    });

    test('should return empty list when no monitors', () => {
      const result = monitor.listMonitoredPages();

      expect(result.success).toBe(true);
      expect(result.monitors.length).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup specific monitor', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      const startResult = await monitor.startMonitoring();
      const monitorId = startResult.monitorId;

      monitor.cleanup(monitorId);

      expect(monitor.monitors.has(monitorId)).toBe(false);
      expect(monitor.snapshots.has(monitorId)).toBe(false);
      expect(monitor.changeHistory.has(monitorId)).toBe(false);
    });

    test('should cleanup all monitors', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);

      await monitor.startMonitoring();
      await monitor.startMonitoring();

      monitor.cleanup();

      expect(monitor.monitors.size).toBe(0);
      expect(monitor.snapshots.size).toBe(0);
      expect(monitor.changeHistory.size).toBe(0);
    });

    test('should clear schedules on cleanup', async () => {
      const mockSnapshot = {
        success: true,
        snapshot: { id: 'snap-1', timestamp: new Date().toISOString() }
      };

      monitor.captureSnapshot = jest.fn().mockResolvedValue(mockSnapshot);
      await monitor.startMonitoring({ interval: 60000 });

      monitor.cleanup();

      expect(monitor.schedules.size).toBe(0);
    });
  });

  describe('Constants', () => {
    test('should export DETECTION_METHODS', () => {
      expect(DETECTION_METHODS).toBeDefined();
      expect(DETECTION_METHODS.DOM_DIFF).toBe('dom_diff');
      expect(DETECTION_METHODS.SCREENSHOT_DIFF).toBe('screenshot_diff');
      expect(DETECTION_METHODS.CONTENT_HASH).toBe('content_hash');
      expect(DETECTION_METHODS.HYBRID).toBe('hybrid');
    });

    test('should export CHANGE_TYPES', () => {
      expect(CHANGE_TYPES).toBeDefined();
      expect(CHANGE_TYPES.CONTENT).toBe('content');
      expect(CHANGE_TYPES.STRUCTURE).toBe('structure');
      expect(CHANGE_TYPES.ADDED).toBe('added');
      expect(CHANGE_TYPES.REMOVED).toBe('removed');
    });

    test('should export MONITOR_STATUS', () => {
      expect(MONITOR_STATUS).toBeDefined();
      expect(MONITOR_STATUS.ACTIVE).toBe('active');
      expect(MONITOR_STATUS.PAUSED).toBe('paused');
      expect(MONITOR_STATUS.STOPPED).toBe('stopped');
      expect(MONITOR_STATUS.ERROR).toBe('error');
    });
  });
});
