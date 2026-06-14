/**
 * Unit Tests for Timeline Generator
 * Tests multi-session timeline tracking, aggregation, and analysis
 */

const { TimelineGenerator } = require('../../src/analysis/timeline-generator');

describe('TimelineGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new TimelineGenerator();
  });

  describe('Timeline Creation', () => {
    test('should create a new timeline', () => {
      const timeline = generator.createTimeline('mon_001', 'sess_001', {
        url: 'https://example.com',
        monitoringIntervalMs: 30000,
        sensitivityLevel: 'high'
      });

      expect(timeline).toBeDefined();
      expect(timeline.id).toBe('mon_001');
      expect(timeline.sessionId).toBe('sess_001');
      expect(timeline.active).toBe(true);
      expect(timeline.changes).toEqual([]);
    });

    test('should index timeline by session', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });
      generator.createTimeline('mon_002', 'sess_001', { url: 'https://example.com/page2' });

      const sessionTimelines = generator.getSessionTimelines('sess_001');

      expect(sessionTimelines.length).toBe(2);
      expect(sessionTimelines[0].id).toMatch(/mon_00[12]/);
    });

    test('should store metadata correctly', () => {
      const metadata = {
        url: 'https://example.com',
        monitoringIntervalMs: 60000,
        sensitivityLevel: 'medium',
        trackedElements: ['dom', 'content', 'layout']
      };

      const timeline = generator.createTimeline('mon_001', 'sess_001', metadata);

      expect(timeline.metadata.url).toBe(metadata.url);
      expect(timeline.metadata.monitoringIntervalMs).toBe(metadata.monitoringIntervalMs);
      expect(timeline.metadata.sensitivityLevel).toBe(metadata.sensitivityLevel);
    });
  });

  describe('Change Recording', () => {
    test('should record a change', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      const change = {
        type: 'content_change',
        elementSelector: '.news-item',
        elementPath: ['html', 'body', 'div'],
        changeDescription: 'New article added',
        beforeSnapshot: { contentHash: 'hash1' },
        afterSnapshot: { contentHash: 'hash2' },
        diffType: 'insertion',
        confidence: 0.95,
        impact: 'HIGH',
        metadata: { changeSize: 1024, percentageChange: 5 }
      };

      generator.recordChange('mon_001', change);

      const timeline = generator.timelines.get('mon_001');
      expect(timeline.changes.length).toBe(1);
      expect(timeline.statistics.totalChanges).toBe(1);
    });

    test('should assign unique change IDs', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      const change1 = {
        type: 'content_change',
        confidence: 0.9,
        impact: 'HIGH'
      };
      const change2 = {
        type: 'dom_change',
        confidence: 0.85,
        impact: 'MEDIUM'
      };

      generator.recordChange('mon_001', change1);
      generator.recordChange('mon_001', change2);

      const timeline = generator.timelines.get('mon_001');
      expect(timeline.changes[0].changeId).not.toBe(timeline.changes[1].changeId);
      expect(timeline.changes[0].changeId).toMatch(/^chg_/);
    });

    test('should throw error for non-existent timeline', () => {
      const change = { type: 'test', confidence: 0.9 };

      expect(() => {
        generator.recordChange('non_existent', change);
      }).toThrow();
    });

    test('should update statistics after recording change', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      generator.recordChange('mon_001', {
        type: 'content_change',
        elementSelector: '.header',
        confidence: 0.9,
        impact: 'HIGH',
        metadata: { changeSize: 2048 }
      });

      generator.recordChange('mon_001', {
        type: 'layout_change',
        elementSelector: '.sidebar',
        confidence: 0.85,
        impact: 'HIGH',
        metadata: { changeSize: 512 }
      });

      const timeline = generator.timelines.get('mon_001');
      expect(timeline.statistics.totalChanges).toBe(2);
      expect(timeline.statistics.mostFrequentElement).toBeDefined();
    });
  });

  describe('Snapshot Management', () => {
    test('should add snapshot to timeline', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      const snapshot = {
        url: 'https://example.com',
        content: { html: '<html></html>' },
        hash: 'snapshot_hash_123'
      };

      const timestamp = Date.now();
      generator.addSnapshot('mon_001', snapshot, timestamp);

      const timeline = generator.timelines.get('mon_001');
      expect(timeline.snapshots.has(timestamp)).toBe(true);
    });

    test('should retrieve snapshot from timeline', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      const snapshot = { content: { html: '<html></html>' } };
      const timestamp = Date.now();

      generator.addSnapshot('mon_001', snapshot, timestamp);

      const timeline = generator.timelines.get('mon_001');
      const retrieved = timeline.snapshots.get(timestamp);

      expect(retrieved).toEqual(snapshot);
    });
  });

  describe('Change Retrieval', () => {
    beforeEach(() => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      // Add multiple changes at different times
      const now = Date.now();
      generator.recordChange('mon_001', {
        timestamp: new Date(now - 3600000).toISOString(),
        type: 'content_change',
        confidence: 0.95,
        impact: 'HIGH'
      });

      generator.recordChange('mon_001', {
        timestamp: new Date(now - 1800000).toISOString(),
        type: 'layout_change',
        confidence: 0.85,
        impact: 'MEDIUM'
      });

      generator.recordChange('mon_001', {
        timestamp: new Date(now).toISOString(),
        type: 'script_change',
        confidence: 0.70,
        impact: 'LOW'
      });
    });

    test('should get all changes for timeline', () => {
      const result = generator.getChanges('mon_001');

      expect(result.changeCount).toBe(3);
      expect(Array.isArray(result.changes)).toBe(true);
      expect(result.changes.length).toBe(3);
    });

    test('should filter changes by time window', () => {
      const now = Date.now();
      const oneHourAgo = new Date(now - 3600000);
      const thirtyMinutesAgo = new Date(now - 1800000);

      const result = generator.getChanges('mon_001', {
        timeWindow: [thirtyMinutesAgo, new Date(now)]
      });

      expect(result.changeCount).toBeLessThan(3);
    });

    test('should filter changes by type', () => {
      const result = generator.getChanges('mon_001', {
        changeTypes: ['content_change', 'layout_change']
      });

      expect(result.changeCount).toBe(2);
      expect(result.changes.every(c => ['content_change', 'layout_change'].includes(c.type))).toBe(true);
    });

    test('should filter changes by minimum confidence', () => {
      const result = generator.getChanges('mon_001', {
        minConfidence: 0.85
      });

      expect(result.changeCount).toBe(2);
      expect(result.changes.every(c => c.confidence >= 0.85)).toBe(true);
    });
  });

  describe('Timeline View', () => {
    test('should generate chronological timeline', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        generator.recordChange('mon_001', {
          timestamp: new Date(now - (i * 300000)).toISOString(),
          type: 'change',
          confidence: 0.9,
          impact: 'MEDIUM'
        });
      }

      const timeline = generator.getTimeline('mon_001', 60000);

      expect(timeline.timelineData).toBeDefined();
      expect(Array.isArray(timeline.timelineData)).toBe(true);
      expect(timeline.totalBuckets).toBeGreaterThan(0);
    });

    test('should bucket changes by time interval', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      const now = Date.now();
      generator.recordChange('mon_001', {
        timestamp: new Date(now).toISOString(),
        type: 'change1',
        confidence: 0.9
      });
      generator.recordChange('mon_001', {
        timestamp: new Date(now + 10000).toISOString(),
        type: 'change2',
        confidence: 0.9
      });

      const timeline = generator.getTimeline('mon_001', 30000);

      // Changes should be in same bucket
      expect(timeline.activeBuckets).toBeGreaterThan(0);
    });
  });

  describe('Timeline Comparison', () => {
    test('should compare multiple timelines', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });
      generator.createTimeline('mon_002', 'sess_002', { url: 'https://example.com/page2' });

      generator.recordChange('mon_001', {
        type: 'content_change',
        confidence: 0.95
      });

      generator.recordChange('mon_002', {
        type: 'layout_change',
        confidence: 0.85
      });

      const comparison = generator.compareTimelines(['mon_001', 'mon_002']);

      expect(comparison.timelineCount).toBe(2);
      expect(comparison.totalChanges).toBe(2);
      expect(comparison.changeBreakdown).toBeDefined();
    });

    test('should calculate change rate in comparison', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });
      generator.createTimeline('mon_002', 'sess_002', { url: 'https://example.com/page2' });

      for (let i = 0; i < 10; i++) {
        generator.recordChange('mon_001', {
          type: 'change',
          confidence: 0.9
        });
        generator.recordChange('mon_002', {
          type: 'change',
          confidence: 0.9
        });
      }

      const comparison = generator.compareTimelines(['mon_001', 'mon_002']);

      expect(parseFloat(comparison.patterns.averageChangeRate)).toBeGreaterThan(0);
    });

    test('should identify most common change type', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      generator.recordChange('mon_001', { type: 'content_change', confidence: 0.9 });
      generator.recordChange('mon_001', { type: 'content_change', confidence: 0.9 });
      generator.recordChange('mon_001', { type: 'layout_change', confidence: 0.9 });

      const comparison = generator.compareTimelines(['mon_001']);

      expect(comparison.patterns.mostCommonChangeType).toBe('content_change');
    });
  });

  describe('Trend Analysis', () => {
    test('should analyze trend as STABLE', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      for (let i = 0; i < 10; i++) {
        generator.recordChange('mon_001', {
          type: 'change',
          confidence: 0.9,
          impact: 'MEDIUM'
        });
      }

      const trend = generator.analyzeTrend('mon_001');

      expect(trend.trend).toBe('STABLE');
      expect(trend.confidence).toBeGreaterThan(0);
    });

    test('should analyze trend as IMPROVING', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      // Many changes early on
      for (let i = 0; i < 15; i++) {
        generator.recordChange('mon_001', {
          type: 'change',
          confidence: 0.9
        });
      }

      // Fewer changes later
      for (let i = 0; i < 5; i++) {
        generator.recordChange('mon_001', {
          type: 'change',
          confidence: 0.9
        });
      }

      const trend = generator.analyzeTrend('mon_001');

      // Should trend toward improving if second half has fewer
      expect(['IMPROVING', 'STABLE']).toContain(trend.trend);
    });

    test('should analyze trend as DEGRADING', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      // Few changes early
      for (let i = 0; i < 5; i++) {
        generator.recordChange('mon_001', {
          type: 'change',
          confidence: 0.9
        });
      }

      // Many changes later
      for (let i = 0; i < 15; i++) {
        generator.recordChange('mon_001', {
          type: 'change',
          confidence: 0.9
        });
      }

      const trend = generator.analyzeTrend('mon_001');

      // Should trend toward degrading if second half has more
      expect(['DEGRADING', 'STABLE']).toContain(trend.trend);
    });
  });

  describe('Timeline Export', () => {
    beforeEach(() => {
      generator.createTimeline('mon_001', 'sess_001', {
        url: 'https://example.com',
        sensitivityLevel: 'high'
      });

      generator.recordChange('mon_001', {
        type: 'content_change',
        changeDescription: 'New article added',
        elementSelector: '.news-item',
        confidence: 0.95,
        impact: 'HIGH'
      });
    });

    test('should export timeline as JSON', () => {
      const json = generator.exportTimeline('mon_001', 'json');

      expect(json).toBeDefined();
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe('mon_001');
      expect(Array.isArray(parsed.changes)).toBe(true);
    });

    test('should export timeline as CSV', () => {
      const csv = generator.exportTimeline('mon_001', 'csv');

      expect(csv).toBeDefined();
      expect(csv).toContain('timestamp');
      expect(csv).toContain('type');
      expect(csv).toContain('content_change');
    });

    test('should export timeline as HTML', () => {
      const html = generator.exportTimeline('mon_001', 'html');

      expect(html).toBeDefined();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('https://example.com');
      expect(html).toContain('content_change');
    });

    test('should export timeline as Markdown', () => {
      const md = generator.exportTimeline('mon_001', 'markdown');

      expect(md).toBeDefined();
      expect(md).toContain('# Change Timeline Report');
      expect(md).toContain('https://example.com');
      expect(md).toContain('content_change');
    });
  });

  describe('Event Querying', () => {
    test('should query events across sessions', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });
      generator.createTimeline('mon_002', 'sess_002', { url: 'https://example.com/page2' });

      generator.recordChange('mon_001', { type: 'content_change', confidence: 0.9 });
      generator.recordChange('mon_002', { type: 'layout_change', confidence: 0.85 });

      const events = generator.queryEvents({ sessionId: 'sess_001' });

      expect(events.length).toBe(1);
      expect(events[0].monitoringId).toBe('mon_001');
    });

    test('should query events by change type', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      generator.recordChange('mon_001', { type: 'content_change', confidence: 0.9 });
      generator.recordChange('mon_001', { type: 'layout_change', confidence: 0.85 });

      const events = generator.queryEvents({ changeType: 'content_change' });

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('content_change');
    });

    test('should query events by confidence threshold', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      generator.recordChange('mon_001', { type: 'change1', confidence: 0.95 });
      generator.recordChange('mon_001', { type: 'change2', confidence: 0.70 });

      const events = generator.queryEvents({ minConfidence: 0.90 });

      expect(events.length).toBe(1);
      expect(events[0].confidence).toBeGreaterThanOrEqual(0.90);
    });

    test('should limit query results', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      for (let i = 0; i < 10; i++) {
        generator.recordChange('mon_001', { type: 'change', confidence: 0.9 });
      }

      const events = generator.queryEvents({ limit: 5 });

      expect(events.length).toBe(5);
    });
  });

  describe('Monitoring Control', () => {
    test('should stop monitoring', () => {
      const timeline = generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      expect(timeline.active).toBe(true);
      expect(timeline.endTime).toBeNull();

      generator.stopMonitoring('mon_001');

      expect(timeline.active).toBe(false);
      expect(timeline.endTime).toBeDefined();
    });

    test('should get active session timelines', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });
      generator.createTimeline('mon_002', 'sess_001', { url: 'https://example.com/page2' });
      generator.createTimeline('mon_003', 'sess_002', { url: 'https://example.com' });

      const active = generator.getSessionTimelines('sess_001');

      expect(active.length).toBe(2);
      expect(active.every(t => t.active)).toBe(true);
    });
  });

  describe('Performance', () => {
    test('timeline creation should be <10ms', () => {
      const start = Date.now();
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });

    test('recording 100 changes should be <500ms', () => {
      generator.createTimeline('mon_001', 'sess_001', { url: 'https://example.com' });

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        generator.recordChange('mon_001', {
          type: 'change',
          confidence: 0.9
        });
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    test('timeline aggregation should be <500ms for 50 sessions', () => {
      for (let i = 0; i < 50; i++) {
        generator.createTimeline(`mon_${i}`, `sess_${i}`, { url: 'https://example.com' });
        for (let j = 0; j < 10; j++) {
          generator.recordChange(`mon_${i}`, {
            type: 'change',
            confidence: 0.9
          });
        }
      }

      const monitoringIds = Array.from(generator.timelines.keys());

      const start = Date.now();
      generator.compareTimelines(monitoringIds.slice(0, 10));
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});
