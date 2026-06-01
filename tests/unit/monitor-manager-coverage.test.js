/**
 * Comprehensive test coverage for Monitor Manager
 * Target: 95%+ code coverage
 * Tests CRUD operations, persistence, import/export, filtering, and bulk operations
 */

const MonitorManager = require('../../src/monitoring/monitor-manager');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('MonitorManager - Comprehensive Coverage', () => {
  let manager;
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `monitor-test-${Date.now()}`);
    manager = new MonitorManager({
      dataDir: tempDir,
      maxMonitors: 100,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      enableDuplicateDetection: true
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  // ================================================================
  // CRUD OPERATIONS - CREATE
  // ================================================================
  describe('Monitor Creation', () => {
    test('should add monitor with required fields', () => {
      const result = manager.addMonitor({
        url: 'https://example.com',
        name: 'Example Site'
      });

      expect(result.id).toBeDefined();
      expect(result.url).toBe('https://example.com');
      expect(result.name).toBe('Example Site');
    });

    test('should set default frequency to daily', () => {
      const result = manager.addMonitor({
        url: 'https://example.com',
        name: 'Example'
      });

      expect(result.frequency).toBe('daily');
    });

    test('should accept custom frequency', () => {
      const result = manager.addMonitor({
        url: 'https://example.com',
        name: 'Example',
        frequency: 'hourly'
      });

      expect(result.frequency).toBe('hourly');
    });

    test('should accept all valid frequencies', () => {
      const frequencies = ['hourly', 'twice-daily', 'daily', 'weekly', 'monthly'];

      frequencies.forEach(freq => {
        const result = manager.addMonitor({
          url: `https://example-${freq}.com`,
          name: `Example ${freq}`,
          frequency: freq
        });
        expect(result.frequency).toBe(freq);
      });
    });

    test('should add alerts configuration', () => {
      const result = manager.addMonitor({
        url: 'https://example.com',
        name: 'Example',
        alerts: { threshold: 50 }
      });

      expect(result.alerts).toBeDefined();
    });

    test('should add tags', () => {
      const result = manager.addMonitor({
        url: 'https://example.com',
        name: 'Example',
        tags: ['competitor', 'ecommerce']
      });

      expect(result.tags).toEqual(['competitor', 'ecommerce']);
    });

    test('should add metadata', () => {
      const result = manager.addMonitor({
        url: 'https://example.com',
        name: 'Example',
        metadata: { industry: 'retail' }
      });

      expect(result.metadata.industry).toBe('retail');
    });

    test('should throw on missing URL', () => {
      expect(() => {
        manager.addMonitor({ name: 'Example' });
      }).toThrow();
    });

    test('should throw on missing name', () => {
      expect(() => {
        manager.addMonitor({ url: 'https://example.com' });
      }).toThrow();
    });

    test('should validate URL format', () => {
      expect(() => {
        manager.addMonitor({
          url: 'not a valid url',
          name: 'Example'
        });
      }).toThrow();
    });

    test('should throw on invalid frequency', () => {
      expect(() => {
        manager.addMonitor({
          url: 'https://example.com',
          name: 'Example',
          frequency: 'invalid-frequency'
        });
      }).toThrow();
    });

    test('should respect max monitors limit', () => {
      const limitedManager = new MonitorManager({
        dataDir: path.join(os.tmpdir(), `limit-${Date.now()}`),
        maxMonitors: 2
      });

      limitedManager.addMonitor({ url: 'https://site1.com', name: 'Site 1' });
      limitedManager.addMonitor({ url: 'https://site2.com', name: 'Site 2' });

      expect(() => {
        limitedManager.addMonitor({ url: 'https://site3.com', name: 'Site 3' });
      }).toThrow();

      fs.rmSync(limitedManager.config.dataDir || '', { recursive: true, force: true });
    });

    test('should detect duplicate monitors', () => {
      manager.addMonitor({ url: 'https://example.com', name: 'Example' });

      expect(() => {
        manager.addMonitor({ url: 'https://example.com', name: 'Duplicate' });
      }).toThrow();
    });

    test('should normalize URLs for duplicate detection', () => {
      manager.addMonitor({ url: 'https://example.com/', name: 'Example' });

      expect(() => {
        manager.addMonitor({ url: 'https://example.com', name: 'Duplicate' });
      }).toThrow();
    });

    test('should disable duplicate detection when configured', () => {
      const noDupManager = new MonitorManager({
        dataDir: path.join(os.tmpdir(), `nodup-${Date.now()}`),
        enableDuplicateDetection: false
      });

      noDupManager.addMonitor({ url: 'https://example.com', name: 'Example 1' });
      const result = noDupManager.addMonitor({ url: 'https://example.com', name: 'Example 2' });

      expect(result).toBeDefined();

      fs.rmSync(noDupManager.config.dataDir || '', { recursive: true, force: true });
    });
  });

  // ================================================================
  // CRUD OPERATIONS - READ
  // ================================================================
  describe('Monitor Retrieval', () => {
    let monitorId;

    beforeEach(() => {
      const result = manager.addMonitor({
        url: 'https://example.com',
        name: 'Example'
      });
      monitorId = result.id;
    });

    test('should get monitor by ID', () => {
      const monitor = manager.getMonitor(monitorId);
      expect(monitor).toBeDefined();
      expect(monitor.id).toBe(monitorId);
    });

    test('should get all monitors', () => {
      manager.addMonitor({ url: 'https://site1.com', name: 'Site 1' });
      manager.addMonitor({ url: 'https://site2.com', name: 'Site 2' });

      const all = manager.getAllMonitors();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });

    test('should return null for non-existent monitor', () => {
      const monitor = manager.getMonitor('non-existent');
      expect(monitor).toBeNull();
    });

    test('should get monitor count', () => {
      const count = manager.getMonitorCount();
      expect(count).toBeGreaterThan(0);
    });
  });

  // ================================================================
  // CRUD OPERATIONS - UPDATE
  // ================================================================
  describe('Monitor Updates', () => {
    let monitorId;

    beforeEach(() => {
      const result = manager.addMonitor({
        url: 'https://example.com',
        name: 'Example',
        frequency: 'daily'
      });
      monitorId = result.id;
    });

    test('should update frequency', () => {
      manager.updateMonitor(monitorId, { frequency: 'hourly' });
      const monitor = manager.getMonitor(monitorId);
      expect(monitor.frequency).toBe('hourly');
    });

    test('should update alerts', () => {
      manager.updateMonitor(monitorId, { alerts: { threshold: 100 } });
      const monitor = manager.getMonitor(monitorId);
      expect(monitor.alerts.threshold).toBe(100);
    });

    test('should update metadata', () => {
      manager.updateMonitor(monitorId, { metadata: { note: 'important' } });
      const monitor = manager.getMonitor(monitorId);
      expect(monitor.metadata.note).toBe('important');
    });

    test('should update last check time', () => {
      const checkTime = Date.now();
      manager.updateMonitor(monitorId, { lastChecked: checkTime });
      const monitor = manager.getMonitor(monitorId);
      expect(monitor.lastChecked).toBe(checkTime);
    });

    test('should throw on invalid frequency update', () => {
      expect(() => {
        manager.updateMonitor(monitorId, { frequency: 'invalid' });
      }).toThrow();
    });
  });

  // ================================================================
  // CRUD OPERATIONS - DELETE
  // ================================================================
  describe('Monitor Deletion', () => {
    let monitorId;

    beforeEach(() => {
      const result = manager.addMonitor({
        url: 'https://example.com',
        name: 'Example'
      });
      monitorId = result.id;
    });

    test('should remove monitor', () => {
      manager.removeMonitor(monitorId);
      const monitor = manager.getMonitor(monitorId);
      expect(monitor).toBeNull();
    });

    test('should emit monitor-removed event', (done) => {
      manager.on('monitor-removed', (data) => {
        expect(data.id).toBe(monitorId);
        done();
      });

      manager.removeMonitor(monitorId);
    });

    test('should return false on removing non-existent', () => {
      const result = manager.removeMonitor('non-existent');
      expect(result).toBe(false);
    });
  });

  // ================================================================
  // PERSISTENCE
  // ================================================================
  describe('Persistence', () => {
    test('should save monitors to disk', () => {
      manager.addMonitor({ url: 'https://example.com', name: 'Example' });
      manager.saveMonitors();

      const monitorsFile = path.join(tempDir, 'monitors.json');
      expect(fs.existsSync(monitorsFile)).toBe(true);
    });

    test('should load monitors from disk', () => {
      manager.addMonitor({ url: 'https://example.com', name: 'Example' });
      manager.saveMonitors();

      const newManager = new MonitorManager({ dataDir: tempDir });
      const all = newManager.getAllMonitors();
      expect(all.length).toBeGreaterThan(0);
    });

    test('should handle corrupted monitor file', () => {
      const monitorsFile = path.join(tempDir, 'monitors.json');
      fs.writeFileSync(monitorsFile, '{invalid json}');

      expect(() => {
        new MonitorManager({ dataDir: tempDir });
      }).not.toThrow();
    });

    test('should emit monitors-saved event', (done) => {
      manager.on('monitors-saved', (data) => {
        expect(data.count).toBeGreaterThanOrEqual(0);
        done();
      });

      manager.addMonitor({ url: 'https://example.com', name: 'Example' });
      manager.saveMonitors();
    });
  });

  // ================================================================
  // FILTERING
  // ================================================================
  describe('Filtering', () => {
    beforeEach(() => {
      manager.addMonitor({
        url: 'https://wordpress.com',
        name: 'WordPress Site',
        tags: ['wordpress', 'competitor']
      });
      manager.addMonitor({
        url: 'https://shopify.com',
        name: 'Shopify Store',
        tags: ['shopify', 'ecommerce']
      });
      manager.addMonitor({
        url: 'https://custom.com',
        name: 'Custom Site',
        tags: ['custom']
      });
    });

    test('should filter by tag', () => {
      const results = manager.filterByTag('competitor');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(m => m.tags.includes('competitor'))).toBe(true);
    });

    test('should filter by multiple tags', () => {
      const results = manager.filterByTags(['wordpress', 'ecommerce']);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should filter by frequency', () => {
      manager.updateMonitor(manager.getAllMonitors()[0].id, { frequency: 'hourly' });
      const results = manager.filterByFrequency('hourly');
      expect(results.length).toBeGreaterThan(0);
    });

    test('should filter by status', () => {
      const results = manager.filterByStatus('active');
      expect(Array.isArray(results)).toBe(true);
    });

    test('should search by name', () => {
      const results = manager.searchByName('WordPress');
      expect(results.length).toBeGreaterThan(0);
    });

    test('should search by URL', () => {
      const results = manager.searchByUrl('wordpress');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ================================================================
  // BULK OPERATIONS
  // ================================================================
  describe('Bulk Operations', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        manager.addMonitor({
          url: `https://site${i}.com`,
          name: `Site ${i}`
        });
      }
    });

    test('should bulk update frequency', () => {
      const monitors = manager.getAllMonitors();
      const ids = monitors.map(m => m.id);

      manager.bulkUpdateFrequency(ids, 'hourly');

      monitors.forEach(m => {
        const updated = manager.getMonitor(m.id);
        expect(updated.frequency).toBe('hourly');
      });
    });

    test('should bulk add tags', () => {
      const monitors = manager.getAllMonitors();
      const ids = monitors.slice(0, 2).map(m => m.id);

      manager.bulkAddTags(ids, ['important']);

      ids.forEach(id => {
        const monitor = manager.getMonitor(id);
        expect(monitor.tags).toContain('important');
      });
    });

    test('should bulk remove tags', () => {
      const monitors = manager.getAllMonitors();
      const id = monitors[0].id;

      manager.updateMonitor(id, { tags: ['test', 'remove'] });
      manager.bulkRemoveTags([id], ['remove']);

      const updated = manager.getMonitor(id);
      expect(updated.tags).not.toContain('remove');
    });

    test('should bulk remove monitors', () => {
      const monitors = manager.getAllMonitors();
      const ids = monitors.slice(0, 2).map(m => m.id);
      const countBefore = manager.getMonitorCount();

      manager.bulkRemoveMonitors(ids);

      const countAfter = manager.getMonitorCount();
      expect(countAfter).toBeLessThan(countBefore);
    });

    test('should handle concurrent bulk updates', () => {
      const monitors = manager.getAllMonitors();

      const promises = monitors.map(m =>
        Promise.resolve(manager.updateMonitor(m.id, { frequency: 'weekly' }))
      );

      Promise.all(promises);
      const allUpdated = manager.getAllMonitors();
      expect(allUpdated.every(m => m.frequency === 'weekly')).toBe(true);
    });
  });

  // ================================================================
  // IMPORT/EXPORT
  // ================================================================
  describe('Import/Export', () => {
    beforeEach(() => {
      manager.addMonitor({ url: 'https://site1.com', name: 'Site 1' });
      manager.addMonitor({ url: 'https://site2.com', name: 'Site 2' });
    });

    test('should export monitors to JSON', () => {
      const json = manager.exportToJSON();
      expect(json).toBeDefined();
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
    });

    test('should export monitors to CSV', () => {
      const csv = manager.exportToCSV();
      expect(csv).toBeDefined();
      expect(csv).toContain('url');
      expect(csv).toContain('name');
    });

    test('should import from JSON', () => {
      const original = manager.getAllMonitors();
      const json = manager.exportToJSON();

      const newManager = new MonitorManager({
        dataDir: path.join(os.tmpdir(), `import-${Date.now()}`)
      });
      newManager.importFromJSON(json);

      const imported = newManager.getAllMonitors();
      expect(imported.length).toBe(original.length);

      fs.rmSync(newManager.config.dataDir || '', { recursive: true, force: true });
    });

    test('should handle corrupted import data', () => {
      expect(() => {
        manager.importFromJSON('invalid json');
      }).toThrow();
    });
  });

  // ================================================================
  // URL VALIDATION
  // ================================================================
  describe('URL Validation', () => {
    test('should validate HTTP URLs', () => {
      const valid = manager.isValidUrl('http://example.com');
      expect(valid).toBe(true);
    });

    test('should validate HTTPS URLs', () => {
      const valid = manager.isValidUrl('https://example.com');
      expect(valid).toBe(true);
    });

    test('should reject invalid URLs', () => {
      const valid = manager.isValidUrl('not a url');
      expect(valid).toBe(false);
    });

    test('should normalize URLs', () => {
      const normalized = manager.normalizeUrl('https://EXAMPLE.COM/path');
      expect(normalized).toBe(normalized.toLowerCase());
    });
  });

  // ================================================================
  // EDGE CASES
  // ================================================================
  describe('Edge Cases', () => {
    test('should handle very long URL', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000);
      const result = manager.addMonitor({
        url: longUrl,
        name: 'Long URL'
      });

      expect(result).toBeDefined();
    });

    test('should handle special characters in name', () => {
      const result = manager.addMonitor({
        url: 'https://example.com',
        name: 'Site @#$% & (test)'
      });

      expect(result.name).toBe('Site @#$% & (test)');
    });

    test('should handle many tags', () => {
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag${i}`);
      const result = manager.addMonitor({
        url: 'https://example.com',
        name: 'Many Tags',
        tags: manyTags
      });

      expect(result.tags.length).toBe(50);
    });

    test('should handle large metadata', () => {
      const largeMetadata = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`key${i}`] = 'value'.repeat(100);
      }

      const result = manager.addMonitor({
        url: 'https://example.com',
        name: 'Large Metadata',
        metadata: largeMetadata
      });

      expect(result.metadata).toBeDefined();
    });

    test('should handle rapid add/remove cycles', () => {
      for (let i = 0; i < 10; i++) {
        const result = manager.addMonitor({
          url: `https://temp${i}.com`,
          name: `Temp ${i}`
        });
        manager.removeMonitor(result.id);
      }

      const count = manager.getMonitorCount();
      expect(count).toBeLessThanOrEqual(10);
    });
  });
});
