/**
 * Competitor Monitoring Service Tests
 * Comprehensive test suite for the competitive website monitoring system
 * @module tests/unit/competitor-monitoring.test.js
 */

const { MonitorManager, MONITOR_STATUS, FREQUENCY_INTERVALS } = require('../../src/monitoring/monitor-manager');
const { ChangeDetector, CHANGE_TYPE } = require('../../src/monitoring/change-detector');
const { AlertDispatcher, ALERT_SEVERITY } = require('../../src/monitoring/alert-dispatcher');
const { MonitoringService, SERVICE_STATUS } = require('../../src/monitoring/monitoring-service');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('MonitorManager', () => {
  let tempDir;
  let manager;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `basset-test-${Date.now()}`);
    manager = new MonitorManager({ dataDir: tempDir });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Monitor CRUD Operations', () => {
    test('should add a monitor', () => {
      const monitor = manager.addMonitor({
        url: 'https://competitor.com',
        name: 'Competitor A',
        frequency: 'daily'
      });

      expect(monitor).toBeDefined();
      expect(monitor.url).toBe('https://competitor.com');
      expect(monitor.name).toBe('Competitor A');
      expect(monitor.frequency).toBe('daily');
      expect(monitor.status).toBe(MONITOR_STATUS.IDLE);
    });

    test('should reject invalid URLs', () => {
      expect(() => {
        manager.addMonitor({
          url: 'not-a-url',
          name: 'Test'
        });
      }).toThrow('Invalid URL format');
    });

    test('should reject duplicate monitors', () => {
      manager.addMonitor({
        url: 'https://competitor.com',
        name: 'Competitor A'
      });

      expect(() => {
        manager.addMonitor({
          url: 'https://competitor.com',
          name: 'Duplicate'
        });
      }).toThrow('Monitor for this URL already exists');
    });

    test('should get monitor by ID', () => {
      const created = manager.addMonitor({
        url: 'https://competitor.com',
        name: 'Test'
      });

      const retrieved = manager.getMonitor(created.id);
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('Test');
    });

    test('should update monitor configuration', () => {
      const monitor = manager.addMonitor({
        url: 'https://competitor.com',
        name: 'Test',
        frequency: 'daily'
      });

      const updated = manager.updateMonitor(monitor.id, {
        frequency: 'hourly',
        name: 'Updated'
      });

      expect(updated.frequency).toBe('hourly');
      expect(updated.name).toBe('Updated');
    });

    test('should remove monitor', () => {
      const monitor = manager.addMonitor({
        url: 'https://competitor.com',
        name: 'Test'
      });

      const result = manager.removeMonitor(monitor.id);
      expect(result).toBe(true);

      expect(() => {
        manager.getMonitor(monitor.id);
      }).toThrow();
    });
  });

  describe('Monitor Operations', () => {
    test('should pause and resume monitor', () => {
      const monitor = manager.addMonitor({
        url: 'https://competitor.com',
        name: 'Test'
      });

      const paused = manager.pauseMonitor(monitor.id);
      expect(paused.status).toBe(MONITOR_STATUS.PAUSED);

      const resumed = manager.resumeMonitor(monitor.id);
      expect(resumed.status).toBe(MONITOR_STATUS.ACTIVE);
    });

    test('should list monitors with filtering', () => {
      manager.addMonitor({
        url: 'https://competitor1.com',
        name: 'Competitor 1',
        tags: ['ecommerce']
      });

      manager.addMonitor({
        url: 'https://competitor2.com',
        name: 'Competitor 2',
        tags: ['saas']
      });

      const all = manager.listMonitors();
      expect(all.length).toBe(2);

      const filtered = manager.listMonitors({ tag: 'ecommerce' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Competitor 1');
    });

    test('should get monitor statistics', () => {
      const monitor = manager.addMonitor({
        url: 'https://competitor.com',
        name: 'Test'
      });

      manager.updateCheckStatus(monitor.id, { success: true });
      manager.updateCheckStatus(monitor.id, { success: true });
      manager.updateCheckStatus(monitor.id, { success: false });

      const stats = manager.getMonitorStats(monitor.id);
      expect(stats.totalChecks).toBe(3);
      expect(stats.successfulChecks).toBe(2);
      expect(stats.failedChecks).toBe(1);
      expect(parseFloat(stats.successRate)).toBe(66.67);
    });
  });

  describe('Monitor Persistence', () => {
    test('should save monitors to disk', () => {
      manager.addMonitor({
        url: 'https://competitor.com',
        name: 'Test'
      });

      expect(fs.existsSync(manager.monitorsFile)).toBe(true);
      const data = fs.readFileSync(manager.monitorsFile, 'utf-8');
      const monitors = JSON.parse(data);
      expect(monitors.length).toBe(1);
    });

    test('should load monitors from disk', () => {
      manager.addMonitor({
        url: 'https://competitor1.com',
        name: 'Test 1'
      });

      manager.addMonitor({
        url: 'https://competitor2.com',
        name: 'Test 2'
      });

      const manager2 = new MonitorManager({ dataDir: tempDir });
      const monitors = manager2.listMonitors();
      expect(monitors.length).toBe(2);
    });

    test('should import and export monitors', () => {
      const monitor1 = manager.addMonitor({
        url: 'https://competitor1.com',
        name: 'Test 1'
      });

      const monitor2 = manager.addMonitor({
        url: 'https://competitor2.com',
        name: 'Test 2'
      });

      const exported = manager.exportMonitors();
      expect(exported.length).toBe(2);

      const manager2 = new MonitorManager({ dataDir: path.join(tempDir, 'new') });
      const result = manager2.importMonitors(exported);
      expect(result.imported).toBe(2);

      const imported = manager2.listMonitors();
      expect(imported.length).toBe(2);
    });
  });
});

describe('ChangeDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new ChangeDetector();
  });

  describe('Content Change Detection', () => {
    test('should detect content changes', () => {
      const prev = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Original content here',
        html: '<html><body>Original content here</body></html>',
        headers: {},
        statusCode: 200
      });

      const curr = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Updated content different',
        html: '<html><body>Updated content different</body></html>',
        headers: {},
        statusCode: 200
      });

      const changes = detector.detectChanges(prev, curr);
      expect(changes.changeDetected).toBe(true);
      expect(changes.changeSummary).toContain(CHANGE_TYPE.CONTENT);
    });

    test('should not detect changes for identical content', () => {
      const prev = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Same content',
        html: '<html><body>Same content</body></html>',
        headers: {},
        statusCode: 200
      });

      const curr = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Same content',
        html: '<html><body>Same content</body></html>',
        headers: {},
        statusCode: 200
      });

      const changes = detector.detectChanges(prev, curr);
      expect(changes.changeDetected).toBe(false);
    });

    test('should calculate content change percentage', () => {
      const prev = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Word one two three four five',
        html: '<html><body>Word one two three four five</body></html>',
        headers: {},
        statusCode: 200
      });

      const curr = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Word one two three four five six seven eight nine ten',
        html: '<html><body>Word one two three four five six seven eight nine ten</body></html>',
        headers: {},
        statusCode: 200
      });

      const changes = detector.detectChanges(prev, curr);
      expect(changes.details.content.changePercent).toBeGreaterThan(0);
    });
  });

  describe('DOM Structure Detection', () => {
    test('should detect DOM structure changes', () => {
      const prev = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Test',
        html: '<html><body><h1>Title</h1><p>Content</p></body></html>',
        headers: {},
        statusCode: 200
      });

      const curr = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Test',
        html: '<html><body><h1>Title</h1><p>Content</p><div>New section</div></body></html>',
        headers: {},
        statusCode: 200
      });

      const changes = detector.detectChanges(prev, curr);
      expect(changes.changeSummary).toContain(CHANGE_TYPE.STRUCTURE);
    });
  });

  describe('Technology Detection', () => {
    test('should detect framework changes', () => {
      const prev = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Test',
        html: '<html><body>Regular HTML</body></html>',
        headers: { 'server': 'Apache' },
        statusCode: 200
      });

      const curr = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Test',
        html: '<html><body><div id="__next">React App</div></body></html>',
        headers: { 'server': 'Nginx' },
        statusCode: 200
      });

      const changes = detector.detectChanges(prev, curr);
      expect(changes.changeSummary).toContain(CHANGE_TYPE.TECHNOLOGY);
      expect(changes.details.technology.changed).toBe(true);
    });

    test('should detect server changes', () => {
      const prev = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Test',
        html: '<html><body>Test</body></html>',
        headers: { 'server': 'Apache/2.4' },
        statusCode: 200
      });

      const curr = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Test',
        html: '<html><body>Test</body></html>',
        headers: { 'server': 'Nginx/1.21' },
        statusCode: 200
      });

      const changes = detector.detectChanges(prev, curr);
      expect(changes.changeSummary).toContain(CHANGE_TYPE.TECHNOLOGY);
    });
  });

  describe('Performance Detection', () => {
    test('should detect significant performance changes', () => {
      const prev = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Test',
        html: '<html><body>Test</body></html>',
        headers: {},
        loadTime: 1000,
        statusCode: 200
      });

      const curr = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Test',
        html: '<html><body>Test</body></html>',
        headers: {},
        loadTime: 1500, // 50% increase
        statusCode: 200
      });

      const changes = detector.detectChanges(prev, curr);
      expect(changes.changeSummary).toContain(CHANGE_TYPE.PERFORMANCE);
    });
  });

  describe('Status Code Detection', () => {
    test('should detect status code changes', () => {
      const prev = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Test',
        html: '<html><body>Test</body></html>',
        headers: {},
        statusCode: 200
      });

      const curr = detector.createSnapshot({
        url: 'https://test.com',
        text: 'Test',
        html: '<html><body>Test</body></html>',
        headers: {},
        statusCode: 500
      });

      const changes = detector.detectChanges(prev, curr);
      expect(changes.changeSummary).toContain(CHANGE_TYPE.STATUS);
    });
  });
});

describe('AlertDispatcher', () => {
  let dispatcher;

  beforeEach(() => {
    dispatcher = new AlertDispatcher();
  });

  describe('Alert Deduplication', () => {
    test('should deduplicate alerts', async () => {
      const alertData = {
        monitorId: 'monitor1',
        monitorName: 'Competitor A',
        url: 'https://competitor.com',
        changeType: 'content',
        severity: ALERT_SEVERITY.MEDIUM,
        changes: {},
        alertConfig: { enableEmail: false }
      };

      const result1 = await dispatcher.sendAlert(alertData);
      const result2 = await dispatcher.sendAlert(alertData);

      expect(result1.success).toBe(false); // No channels configured
      expect(result2.deduped).toBe(true);
    });

    test('should allow new alerts after dedup window', async () => {
      dispatcher.options.deduplicationWindow = 100; // 100ms for testing

      const alertData = {
        monitorId: 'monitor1',
        monitorName: 'Test',
        url: 'https://test.com',
        changeType: 'content',
        alertConfig: {}
      };

      const hash = dispatcher.generateAlertHash('monitor1', 'content');
      dispatcher.recordSentAlert(hash);

      await new Promise(resolve => setTimeout(resolve, 150));

      const isDupe = dispatcher.isAlertDuplicate(hash);
      expect(isDupe).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', () => {
      dispatcher.options.maxAlertsPerHour = 5;

      for (let i = 0; i < 5; i++) {
        const result = dispatcher.checkRateLimit('monitor1');
        expect(result).toBe(true);
      }

      const result = dispatcher.checkRateLimit('monitor1');
      expect(result).toBe(false);
    });

    test('should allow alerts from different monitors', () => {
      dispatcher.options.maxAlertsPerHour = 3;

      expect(dispatcher.checkRateLimit('monitor1')).toBe(true);
      expect(dispatcher.checkRateLimit('monitor1')).toBe(true);
      expect(dispatcher.checkRateLimit('monitor1')).toBe(true);
      expect(dispatcher.checkRateLimit('monitor1')).toBe(false);

      expect(dispatcher.checkRateLimit('monitor2')).toBe(true);
    });
  });

  describe('Alert Formatting', () => {
    test('should generate alert hash', () => {
      const hash1 = dispatcher.generateAlertHash('monitor1', 'content');
      const hash2 = dispatcher.generateAlertHash('monitor1', 'content');
      const hash3 = dispatcher.generateAlertHash('monitor2', 'content');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    test('should build alert message', () => {
      const message = dispatcher.buildAlertMessage({
        monitorId: 'monitor1',
        monitorName: 'Competitor A',
        url: 'https://competitor.com',
        changeType: 'technology',
        severity: ALERT_SEVERITY.HIGH,
        changes: { added: { frameworks: ['React'] } }
      });

      expect(message.monitorName).toBe('Competitor A');
      expect(message.severity).toBe(ALERT_SEVERITY.HIGH);
      expect(message.summary).toContain('Competitor A');
    });
  });
});

describe('MonitoringService', () => {
  let service;
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `basset-test-${Date.now()}`);
    service = new MonitoringService({ dataDir: tempDir, enableAutoCheck: false });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Service Lifecycle', () => {
    test('should start and stop service', async () => {
      expect(service.status).toBe(SERVICE_STATUS.IDLE);

      await service.start();
      expect(service.status).toBe(SERVICE_STATUS.RUNNING);

      await service.stop();
      expect(service.status).toBe(SERVICE_STATUS.IDLE);
    });

    test('should pause and resume service', async () => {
      await service.start();
      expect(service.status).toBe(SERVICE_STATUS.RUNNING);

      service.pause();
      expect(service.status).toBe(SERVICE_STATUS.PAUSED);

      service.resume();
      expect(service.status).toBe(SERVICE_STATUS.RUNNING);

      await service.stop();
    });
  });

  describe('Monitor Integration', () => {
    test('should add monitors through service', async () => {
      const monitor = service.monitorManager.addMonitor({
        url: 'https://competitor.com',
        name: 'Test'
      });

      expect(monitor).toBeDefined();
      const retrieved = service.getMonitorStatus(monitor.id);
      expect(retrieved.name).toBe('Test');
    });

    test('should get global statistics', async () => {
      service.monitorManager.addMonitor({
        url: 'https://competitor1.com',
        name: 'Test 1'
      });

      service.monitorManager.addMonitor({
        url: 'https://competitor2.com',
        name: 'Test 2'
      });

      const stats = service.getStats();
      expect(stats.monitors.total).toBe(2);
    });
  });

  describe('Data Export and Import', () => {
    test('should export monitoring data', async () => {
      service.monitorManager.addMonitor({
        url: 'https://competitor.com',
        name: 'Test'
      });

      const data = service.exportData();
      expect(data.version).toBe('1.0');
      expect(data.monitors.length).toBe(1);
    });

    test('should cleanup old data', async () => {
      service.snapshots.set('monitor1', [
        {
          timestamp: Date.now() - 100 * 24 * 60 * 60 * 1000, // 100 days old
          data: 'test'
        },
        {
          timestamp: Date.now(),
          data: 'test'
        }
      ]);

      const result = service.cleanup({ olderThanDays: 30 });
      expect(result.snapshotsRemoved).toBe(1);
    });
  });
});

describe('Integration Tests', () => {
  test('complete monitoring workflow', async () => {
    const tempDir = path.join(os.tmpdir(), `basset-test-${Date.now()}`);
    const service = new MonitoringService({
      dataDir: tempDir,
      enableAutoCheck: false
    });

    // 1. Add monitor
    const monitor = service.monitorManager.addMonitor({
      url: 'https://competitor.com',
      name: 'Competitor A',
      frequency: 'daily',
      tags: ['ecommerce']
    });

    expect(monitor).toBeDefined();

    // 2. List monitors
    const monitors = service.monitorManager.listMonitors();
    expect(monitors.length).toBe(1);

    // 3. Start service
    await service.start();
    expect(service.status).toBe(SERVICE_STATUS.RUNNING);

    // 4. Stop service
    await service.stop();
    expect(service.status).toBe(SERVICE_STATUS.IDLE);

    // 5. Export data
    const exported = service.exportData();
    expect(exported.monitors.length).toBe(1);

    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });
});
