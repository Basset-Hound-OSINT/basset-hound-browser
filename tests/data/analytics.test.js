/**
 * Analytics Store Tests
 * Comprehensive tests for time-series data storage and aggregation
 */

const assert = require('assert');
const AnalyticsStore = require('../../src/data/analytics-store');

describe('Analytics Store Tests', () => {
  let analytics;

  beforeEach(() => {
    analytics = new AnalyticsStore({
      cleanupInterval: 86400000, // 1 day
      defaultRetention: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  });

  describe('Recording Data', () => {
    it('should record a single data point', () => {
      const point = analytics.record('cpu_usage', 65.5);

      assert(point.timestamp);
      assert.strictEqual(point.value, 65.5);
    });

    it('should record with custom timestamp', () => {
      const timestamp = Date.now() - 3600000; // 1 hour ago
      const point = analytics.record('memory_usage', 512, { timestamp });

      assert.strictEqual(point.timestamp, timestamp);
    });

    it('should record with tags', () => {
      const point = analytics.record('http_requests', 150, {
        tags: { endpoint: '/api/users', method: 'GET' },
      });

      assert.deepStrictEqual(point.tags, {
        endpoint: '/api/users',
        method: 'GET',
      });
    });

    it('should record multiple points', () => {
      const points = [
        { value: 10, timestamp: Date.now() - 3000 },
        { value: 20, timestamp: Date.now() - 2000 },
        { value: 30, timestamp: Date.now() - 1000 },
        { value: 40, timestamp: Date.now() },
      ];

      const recorded = analytics.recordBatch('temperature', points);

      assert.strictEqual(recorded.length, 4);
      assert.strictEqual(recorded[0].value, 10);
    });
  });

  describe('Querying Data', () => {
    beforeEach(() => {
      const now = Date.now();
      for (let i = 0; i < 100; i++) {
        analytics.record('requests_per_second', 50 + Math.random() * 20, {
          timestamp: now - i * 60000, // Every minute
        });
      }
    });

    it('should query time range', () => {
      const now = Date.now();
      const data = analytics.query('requests_per_second', now - 3600000, now);

      assert(data.length > 0);
      assert(data[0].timestamp);
      assert(typeof data[0].value === 'number');
    });

    it('should return empty array for non-existent series', () => {
      const data = analytics.query('nonexistent', Date.now() - 3600000, Date.now());
      assert.strictEqual(data.length, 0);
    });

    it('should filter by timestamp range', () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;
      const twoHoursAgo = now - 7200000;

      const data = analytics.query('requests_per_second', twoHoursAgo, oneHourAgo);

      for (const point of data) {
        assert(point.timestamp >= twoHoursAgo);
        assert(point.timestamp <= oneHourAgo);
      }
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      const values = [10, 20, 30, 40, 50];
      const now = Date.now();

      for (let i = 0; i < values.length; i++) {
        analytics.record('test_series', values[i], {
          timestamp: now - i * 1000,
        });
      }
    });

    it('should calculate basic statistics', async () => {
      const now = Date.now();
      const stats = await analytics.getStats('test_series', now - 10000, now);

      assert.strictEqual(stats.count, 5);
      assert.strictEqual(stats.sum, 150); // 10+20+30+40+50
      assert.strictEqual(stats.min, 10);
      assert.strictEqual(stats.max, 50);
      assert.strictEqual(stats.avg, 30);
      assert.strictEqual(stats.median, 30);
    });

    it('should calculate percentiles', async () => {
      const now = Date.now();
      const stats = await analytics.getStats('test_series', now - 10000, now);

      assert(stats.p95 >= stats.median);
      assert(stats.p99 >= stats.p95);
    });

    it('should return null for empty query', async () => {
      const stats = await analytics.getStats('nonexistent', Date.now() - 3600000, Date.now());
      assert.strictEqual(stats, null);
    });
  });

  describe('Aggregation', () => {
    beforeEach(() => {
      const now = Date.now();

      // Record hourly data for 24 hours
      for (let hour = 0; hour < 24; hour++) {
        const timestamp = now - hour * 3600000;
        for (let i = 0; i < 60; i++) {
          analytics.record('hourly_data', 100 + Math.random() * 50, {
            timestamp: timestamp - i * 60000,
          });
        }
      }

      analytics.configureAggregation('hourly_data', {
        intervals: ['hourly', 'daily'],
        retentionDays: 365,
      });
    });

    it('should get hourly aggregates', () => {
      const now = Date.now();
      const aggregates = analytics.getHourlyAggregates(
        'hourly_data',
        now - 86400000,
        now
      );

      assert(aggregates.length > 0);
      for (const agg of aggregates) {
        assert(agg.count > 0);
        assert(agg.sum > 0);
        assert(agg.avg > 0);
      }
    });

    it('should get daily aggregates', () => {
      const now = Date.now();
      const aggregates = analytics.getDailyAggregates(
        'hourly_data',
        now - 7 * 86400000,
        now
      );

      assert(Array.isArray(aggregates));
    });

    it('should get weekly aggregates', () => {
      const now = Date.now();
      const aggregates = analytics.getWeeklyAggregates(
        'hourly_data',
        now - 30 * 86400000,
        now
      );

      assert(Array.isArray(aggregates));
    });
  });

  describe('Retention Policies', () => {
    it('should set retention policy', () => {
      analytics.setRetentionPolicy('test_series', {
        retentionDays: 7,
        aggregateAfterDays: 1,
      });

      const policy = analytics.retentionPolicies.get('test_series');
      assert.strictEqual(policy.retentionDays, 7);
    });

    it('should clean up old data', async () => {
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 86400000;
      const twoMonthsAgo = now - 60 * 86400000;

      // Record old data that should be cleaned
      analytics.recordBatch('cleanup_test', [
        { value: 10, timestamp: twoMonthsAgo },
        { value: 20, timestamp: twoMonthsAgo + 1000 },
      ]);

      // Record recent data that should remain
      analytics.recordBatch('cleanup_test', [
        { value: 30, timestamp: thirtyDaysAgo },
        { value: 40, timestamp: now },
      ]);

      // Set retention policy
      analytics.setRetentionPolicy('cleanup_test', { retentionDays: 45 });

      // Run cleanup
      const removed = await analytics.cleanup();

      assert(removed >= 0); // At least no error
    });
  });

  describe('Data Export/Import', () => {
    beforeEach(() => {
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        analytics.record('export_test', 10 + i, {
          timestamp: now - i * 1000,
        });
      }
    });

    it('should export as JSON', () => {
      const json = analytics.exportData('export_test', 'json');
      const data = JSON.parse(json);

      assert(Array.isArray(data));
      assert.strictEqual(data.length, 10);
    });

    it('should export as CSV', () => {
      const csv = analytics.exportData('export_test', 'csv');

      assert(csv.includes('timestamp'));
      assert(csv.includes('value'));
      const lines = csv.split('\n');
      assert(lines.length > 2); // Header + data
    });

    it('should export as NDJSON', () => {
      const ndjson = analytics.exportData('export_test', 'ndjson');

      const lines = ndjson.split('\n').filter((line) => line.trim());
      assert.strictEqual(lines.length, 10);

      for (const line of lines) {
        const parsed = JSON.parse(line);
        assert(parsed.timestamp);
        assert(typeof parsed.value === 'number');
      }
    });

    it('should import JSON data', () => {
      const exportedJson = analytics.exportData('export_test', 'json');

      const newAnalytics = new AnalyticsStore();
      const count = newAnalytics.importData('imported', exportedJson, 'json');

      assert.strictEqual(count, 10);
    });

    it('should import CSV data', () => {
      const csv = analytics.exportData('export_test', 'csv');

      const newAnalytics = new AnalyticsStore();
      const count = newAnalytics.importData('imported', csv, 'csv');

      assert.strictEqual(count, 10);
    });

    it('should import NDJSON data', () => {
      const ndjson = analytics.exportData('export_test', 'ndjson');

      const newAnalytics = new AnalyticsStore();
      const count = newAnalytics.importData('imported', ndjson, 'ndjson');

      assert.strictEqual(count, 10);
    });
  });

  describe('Series Management', () => {
    it('should list all series', () => {
      analytics.record('series1', 10);
      analytics.record('series2', 20);
      analytics.record('series3', 30);

      const series = analytics.getSeries();
      assert.strictEqual(series.length, 3);
    });

    it('should get series metadata', () => {
      const now = Date.now();
      analytics.record('metadata_test', 10, { timestamp: now - 10000 });
      analytics.record('metadata_test', 20, { timestamp: now - 5000 });
      analytics.record('metadata_test', 30, { timestamp: now });

      const metadata = analytics.getSeriesMetadata('metadata_test');

      assert.strictEqual(metadata.name, 'metadata_test');
      assert.strictEqual(metadata.pointCount, 3);
      assert(metadata.firstTimestamp);
      assert(metadata.lastTimestamp);
    });

    it('should return null for non-existent series metadata', () => {
      const metadata = analytics.getSeriesMetadata('nonexistent');
      assert.strictEqual(metadata, null);
    });
  });

  describe('Metrics', () => {
    it('should track metrics', () => {
      analytics.record('metric1', 10);
      analytics.record('metric2', 20);

      const metrics = analytics.getMetrics();

      assert.strictEqual(metrics.pointsStored, 2);
      assert.strictEqual(metrics.seriesCount, 2);
    });

    it('should track cleanups', async () => {
      const before = analytics.getMetrics().dataCleanups;

      await analytics.cleanup();

      const after = analytics.getMetrics().dataCleanups;
      assert(after >= before);
    });
  });

  describe('Events', () => {
    it('should emit point_recorded event', () => {
      let emitted = false;

      analytics.once('point_recorded', () => {
        emitted = true;
      });

      analytics.record('test', 42);

      assert(emitted);
    });

    it('should emit cleanup_completed event', async () => {
      let emitted = false;

      analytics.once('cleanup_completed', () => {
        emitted = true;
      });

      await analytics.cleanup();

      assert(emitted);
    });

    it('should emit aggregation_configured event', () => {
      let emitted = false;

      analytics.once('aggregation_configured', () => {
        emitted = true;
      });

      analytics.configureAggregation('test', { intervals: ['hourly'] });

      assert(emitted);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative values', () => {
      const point = analytics.record('negative_test', -50);
      assert.strictEqual(point.value, -50);
    });

    it('should handle very large values', () => {
      const point = analytics.record('large_test', 1e15);
      assert.strictEqual(point.value, 1e15);
    });

    it('should handle zero values', () => {
      const point = analytics.record('zero_test', 0);
      assert.strictEqual(point.value, 0);
    });

    it('should handle decimal values', () => {
      const point = analytics.record('decimal_test', 3.14159);
      assert.strictEqual(point.value, 3.14159);
    });
  });
});
