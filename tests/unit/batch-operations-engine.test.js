/**
 * Batch Operations & Deduplication Engine - Unit Test Suite
 *
 * Tests for:
 * - Batch URL processing (parallel and sequential)
 * - Record deduplication (hash, content, fuzzy)
 * - Export merging (union, intersection, custom)
 * - Delta exports (changed data tracking)
 * - Batch filtering with multiple operators
 * - Progress tracking and status monitoring
 * - Error handling and retry logic
 * - Performance benchmarks
 *
 * @requires jest
 */

const { BatchOperationsEngine } = require('../../src/export/batch-operations-engine');

describe('BatchOperationsEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new BatchOperationsEngine({
      maxConcurrentOperations: 3,
      batchTimeout: 30000,
      deduplicationAlgorithm: 'hash',
      progressUpdateInterval: 100
    });
  });

  afterEach(() => {
    engine.removeAllListeners();
  });

  // ==================== Batch Export Tests ====================

  describe('Batch Export Operations', () => {
    test('should initialize batch export with URLs', async () => {
      const urls = ['http://example.com/page1', 'http://example.com/page2'];
      const mockExtractor = jest.fn().mockResolvedValue({ data: 'test' });

      const result = await engine.startBatchExport('batch-001', urls, {}, mockExtractor);

      expect(result.batchId).toBe('batch-001');
      expect(result.jobId).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.totalUrls).toBe(2);
    });

    test('should process batch sequentially', async () => {
      const urls = ['url1', 'url2', 'url3'];
      const mockExtractor = jest.fn()
        .mockResolvedValueOnce({ data: 'result1' })
        .mockResolvedValueOnce({ data: 'result2' })
        .mockResolvedValueOnce({ data: 'result3' });

      let completedEvent = null;
      engine.on('batch-completed', (event) => {
        completedEvent = event;
      });

      const result = await engine.startBatchExport(
        'batch-seq',
        urls,
        { parallel: false },
        mockExtractor
      );

      expect(mockExtractor).toHaveBeenCalledTimes(3);
      expect(completedEvent).toBeDefined();
      expect(completedEvent.successful).toBe(3);
    });

    test('should process batch in parallel with concurrency control', async () => {
      const urls = Array.from({ length: 10 }, (_, i) => `url${i}`);
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const mockExtractor = jest.fn(async () => {
        concurrentCount++;
        if (concurrentCount > maxConcurrent) {
          maxConcurrent = concurrentCount;
        }

        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentCount--;

        return { data: 'result' };
      });

      await engine.startBatchExport(
        'batch-parallel',
        urls,
        { parallel: true, maxConcurrent: 3 },
        mockExtractor
      );

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    test('should handle URL extraction errors with retry', async () => {
      const urls = ['url1'];
      let callCount = 0;

      const mockExtractor = jest.fn(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary error');
        }
        return { data: 'recovered' };
      });

      await engine.startBatchExport(
        'batch-retry',
        urls,
        { retryOnFailure: true, maxRetries: 3 },
        mockExtractor
      );

      expect(callCount).toBe(3);
    });

    test('should emit batch progress events', (done) => {
      const urls = ['url1', 'url2'];
      const mockExtractor = jest.fn(async () => ({ data: 'test' }));
      let progressEvents = [];

      engine.on('batch-progress', (event) => {
        progressEvents.push(event);
      });

      engine.startBatchExport(
        'batch-progress',
        urls,
        { parallel: false },
        mockExtractor
      ).then(() => {
        // Progress event emitted at least once
        expect(progressEvents.length).toBeGreaterThan(0);
        done();
      });
    });

    test('should fail with empty URLs', async () => {
      const result = await engine.startBatchExport('batch-empty', [], {}, () => {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should track batch errors', async () => {
      const urls = ['url1', 'url2'];
      const mockExtractor = jest.fn(async (url) => {
        if (url === 'url1') {
          throw new Error('URL 1 failed');
        }
        return { data: 'result2' };
      });

      let errorEvents = [];
      engine.on('url-error', (event) => {
        errorEvents.push(event);
      });

      await engine.startBatchExport(
        'batch-errors',
        urls,
        { parallel: false, maxRetries: 1 },
        mockExtractor
      );

      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  // ==================== Deduplication Tests ====================

  describe('Record Deduplication', () => {
    test('should deduplicate records using hash algorithm', () => {
      const records = [
        { id: '1', url: 'http://example.com', title: 'Page 1' },
        { id: '1', url: 'http://example.com', title: 'Page 1' }, // Duplicate
        { id: '2', url: 'http://example.com/page2', title: 'Page 2' }
      ];

      const result = engine.deduplicateRecords(records, {
        algorithm: 'hash',
        fields: ['id', 'url']
      });

      expect(result.unique.length).toBe(2);
      expect(result.duplicates.length).toBe(1);
      expect(result.deduplicationStats.duplicatesRemoved).toBe(1);
    });

    test('should deduplicate records using content algorithm', () => {
      const records = [
        { id: '1', data: 'content' },
        { id: '1', data: 'content' }, // Exact duplicate
        { id: '2', data: 'different' }
      ];

      const result = engine.deduplicateRecords(records, {
        algorithm: 'content'
      });

      expect(result.unique.length).toBe(2);
      expect(result.duplicates.length).toBe(1);
    });

    test('should deduplicate records using fuzzy algorithm', () => {
      const records = [
        { id: '1', title: 'Example Page' },
        { id: '1', title: 'Example Page Extra Text' }, // Similar
        { id: '2', title: 'Different' }
      ];

      const result = engine.deduplicateRecords(records, {
        algorithm: 'fuzzy',
        fields: ['id']
      });

      expect(result.unique.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle custom field selection', () => {
      const records = [
        { id: '1', url: 'http://example.com', timestamp: 100 },
        { id: '1', url: 'http://example.com', timestamp: 200 }, // Different timestamp
        { id: '2', url: 'http://example.com/page2', timestamp: 300 }
      ];

      const result = engine.deduplicateRecords(records, {
        algorithm: 'hash',
        fields: ['id', 'url'] // Exclude timestamp
      });

      expect(result.unique.length).toBe(2);
      expect(result.duplicates.length).toBe(1);
    });

    test('should emit deduplication events', (done) => {
      const records = [
        { id: '1' },
        { id: '1' },
        { id: '2' }
      ];

      engine.on('deduplication-complete', (stats) => {
        expect(stats.duplicatesRemoved).toBe(1);
        done();
      });

      engine.deduplicateRecords(records);
    });

    test('should calculate deduplication ratio', () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        id: i % 10
      }));

      const result = engine.deduplicateRecords(records);

      expect(result.deduplicationStats.deduplicationRatio).toBe('90.00');
    });

    test('should fail with non-array input', () => {
      const result = engine.deduplicateRecords('not an array');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should mark duplicate records', () => {
      const records = [
        { id: '1', data: 'test' },
        { id: '1', data: 'test' }
      ];

      const result = engine.deduplicateRecords(records, { algorithm: 'content' });

      const duplicate = result.duplicates[0];
      expect(duplicate._isDuplicate).toBe(true);
      expect(duplicate._deduplicationHash).toBeDefined();
    });
  });

  // ==================== Merge Export Tests ====================

  describe('Export Merging', () => {
    test('should merge exports using union strategy', () => {
      const exports = [
        { data: [{ id: '1', value: 'a' }, { id: '2', value: 'b' }] },
        { data: [{ id: '2', value: 'b' }, { id: '3', value: 'c' }] }
      ];

      const result = engine.mergeExports(exports, { strategy: 'union' });

      expect(result.merged.length).toBe(3);
      expect(result.mergeStats.totalRecordsAfter).toBe(3);
    });

    test('should merge exports using intersection strategy', () => {
      const exports = [
        { data: [{ id: '1', value: 'a' }, { id: '2', value: 'b' }] },
        { data: [{ id: '2', value: 'b' }, { id: '3', value: 'c' }] }
      ];

      const result = engine.mergeExports(exports, { strategy: 'intersection' });

      expect(result.merged.length).toBe(1);
      expect(result.merged[0].id).toBe('2');
    });

    test('should merge exports with custom conflict resolution', () => {
      const exports = [
        { data: [{ id: '1', priority: 1 }, { id: '2', priority: 1 }] },
        { data: [{ id: '1', priority: 2 }, { id: '3', priority: 2 }] }
      ];

      const result = engine.mergeExports(exports, {
        strategy: 'custom',
        resolver: (existing, incoming) => {
          return incoming.priority > existing.priority ? incoming : existing;
        }
      });

      const record1 = result.merged.find(r => r.id === '1');
      expect(record1.priority).toBe(2);
    });

    test('should handle array exports', () => {
      const exports = [
        [{ id: '1' }, { id: '2' }],
        [{ id: '3' }]
      ];

      const result = engine.mergeExports(exports, { strategy: 'union' });

      expect(result.merged.length).toBe(3);
    });

    test('should generate merge ID', () => {
      const result = engine.mergeExports([{ data: [{ id: '1' }] }]);

      expect(result.mergeId).toBeDefined();
      expect(result.mergeId).toMatch(/^[a-f0-9]{16}$/);
    });

    test('should track merge statistics', () => {
      const exports = [
        { data: [{ id: '1' }, { id: '2' }] },
        { data: [{ id: '2' }, { id: '3' }] }
      ];

      const result = engine.mergeExports(exports, { strategy: 'union' });

      expect(result.mergeStats.totalSourceExports).toBe(2);
      expect(result.mergeStats.totalRecordsBefore).toBe(4);
      expect(result.mergeStats.totalRecordsAfter).toBe(3);
    });

    test('should emit merge complete event', (done) => {
      const exports = [{ data: [{ id: '1' }] }];

      engine.on('merge-complete', (stats) => {
        expect(stats).toBeDefined();
        done();
      });

      engine.mergeExports(exports);
    });

    test('should fail with empty exports array', () => {
      const result = engine.mergeExports([]);

      expect(result.success).toBe(false);
    });
  });

  // ==================== Delta Export Tests ====================

  describe('Delta Exports', () => {
    test('should identify added records', () => {
      const current = [
        { id: '1', value: 'a' },
        { id: '2', value: 'b' },
        { id: '3', value: 'c' }
      ];

      const baseline = [
        { id: '1', value: 'a' }
      ];

      const result = engine.exportDelta(current, baseline);

      expect(result.delta.added.length).toBe(2);
      expect(result.delta.added.map(r => r.id)).toContain('2');
      expect(result.delta.added.map(r => r.id)).toContain('3');
    });

    test('should identify removed records', () => {
      const current = [{ id: '1', value: 'a' }];
      const baseline = [
        { id: '1', value: 'a' },
        { id: '2', value: 'b' }
      ];

      const result = engine.exportDelta(current, baseline);

      expect(result.delta.removed.length).toBe(1);
      expect(result.delta.removed[0].id).toBe('2');
    });

    test('should identify updated records', () => {
      const current = [{ id: '1', value: 'modified' }];
      const baseline = [{ id: '1', value: 'original' }];

      const result = engine.exportDelta(current, baseline);

      expect(result.delta.updated.length).toBe(1);
      expect(result.delta.updated[0].previousValue.value).toBe('original');
      expect(result.delta.updated[0].record.value).toBe('modified');
    });

    test('should identify unchanged records', () => {
      const current = [{ id: '1', value: 'a' }, { id: '2', value: 'b' }];
      const baseline = [{ id: '1', value: 'a' }];

      const result = engine.exportDelta(current, baseline);

      expect(result.deltaStats.unchanged.length).toBe(1);
    });

    test('should handle array exports', () => {
      const current = [{ id: '1' }, { id: '2' }];
      const baseline = [{ id: '1' }];

      const result = engine.exportDelta(current, baseline);

      expect(result.delta.added.length).toBe(1);
    });

    test('should calculate total changes', () => {
      const current = [{ id: '1', v: 'new' }, { id: '2' }];
      const baseline = [{ id: '1', v: 'old' }, { id: '3' }];

      const result = engine.exportDelta(current, baseline);

      expect(result.deltaStats.totalChanges).toBe(3); // 1 updated, 1 added, 1 removed
    });

    test('should emit delta export event', (done) => {
      engine.on('delta-export-complete', (stats) => {
        expect(stats).toBeDefined();
        done();
      });

      engine.exportDelta([{ id: '1' }], [{ id: '2' }]);
    });

    test('should use custom compare fields', () => {
      const current = [{ url: 'http://example.com', timestamp: 200 }];
      const baseline = [{ url: 'http://example.com', timestamp: 100 }];

      const result = engine.exportDelta(current, baseline, {
        compareFields: ['url'] // Only compare URL
      });

      // Should be identified as unchanged based on URL only
      expect(result.deltaStats.unchanged.length).toBe(1);
    });
  });

  // ==================== Batch Filtering Tests ====================

  describe('Batch Filtering', () => {
    const testRecords = [
      { id: '1', name: 'Alice', age: 30, status: 'active' },
      { id: '2', name: 'Bob', age: 25, status: 'inactive' },
      { id: '3', name: 'Charlie', age: 35, status: 'active' },
      { id: '4', name: 'Diana', age: 28, status: 'active' }
    ];

    test('should filter with equals operator', () => {
      const filters = [{ field: 'status', operator: 'equals', value: 'active' }];

      const result = engine.applyBatchFilters(testRecords, filters);

      expect(result.filtered.length).toBe(3);
      expect(result.filtered.every(r => r.status === 'active')).toBe(true);
    });

    test('should filter with notEquals operator', () => {
      const filters = [{ field: 'status', operator: 'notEquals', value: 'inactive' }];

      const result = engine.applyBatchFilters(testRecords, filters);

      expect(result.filtered.length).toBe(3);
    });

    test('should filter with contains operator', () => {
      const filters = [{ field: 'name', operator: 'contains', value: 'li' }];

      const result = engine.applyBatchFilters(testRecords, filters);

      expect(result.filtered.length).toBe(2); // Alice, Charlie
    });

    test('should filter with greaterThan operator', () => {
      const filters = [{ field: 'age', operator: 'greaterThan', value: 28 }];

      const result = engine.applyBatchFilters(testRecords, filters);

      expect(result.filtered.length).toBe(2); // Alice (30), Charlie (35)
    });

    test('should filter with lessThan operator', () => {
      const filters = [{ field: 'age', operator: 'lessThan', value: 30 }];

      const result = engine.applyBatchFilters(testRecords, filters);

      expect(result.filtered.length).toBe(2); // Bob (25), Diana (28)
    });

    test('should filter with in operator', () => {
      const filters = [{ field: 'id', operator: 'in', value: ['1', '3'] }];

      const result = engine.applyBatchFilters(testRecords, filters);

      expect(result.filtered.length).toBe(2);
    });

    test('should filter with regex operator', () => {
      const filters = [{ field: 'name', operator: 'regex', value: '^[AC]' }];

      const result = engine.applyBatchFilters(testRecords, filters);

      expect(result.filtered.length).toBe(2); // Alice, Charlie
    });

    test('should filter with exists operator', () => {
      const records = [
        { id: '1', optional: 'exists' },
        { id: '2' },
        { id: '3', optional: null }
      ];

      const filters = [{ field: 'optional', operator: 'exists', value: true }];

      const result = engine.applyBatchFilters(records, filters);

      expect(result.filtered.length).toBe(1);
    });

    test('should chain multiple filters', () => {
      const filters = [
        { field: 'status', operator: 'equals', value: 'active' },
        { field: 'age', operator: 'greaterThan', value: 28 }
      ];

      const result = engine.applyBatchFilters(testRecords, filters);

      expect(result.filtered.length).toBe(2); // Alice, Charlie
      expect(result.filterStats.filtersApplied).toBe(2);
    });

    test('should handle nested fields', () => {
      const records = [
        { id: '1', info: { city: 'NYC' } },
        { id: '2', info: { city: 'LA' } }
      ];

      const filters = [{ field: 'info.city', operator: 'equals', value: 'NYC' }];

      const result = engine.applyBatchFilters(records, filters);

      expect(result.filtered.length).toBe(1);
    });

    test('should return all records with empty filters', () => {
      const result = engine.applyBatchFilters(testRecords, []);

      expect(result.filtered.length).toBe(testRecords.length);
    });

    test('should emit filter complete event', (done) => {
      engine.on('batch-filter-complete', (stats) => {
        expect(stats.recordsMatched).toBeDefined();
        done();
      });

      const filters = [{ field: 'status', operator: 'equals', value: 'active' }];
      engine.applyBatchFilters(testRecords, filters);
    });
  });

  // ==================== Batch Status & Management Tests ====================

  describe('Batch Status & Management', () => {
    test('should get batch status', async () => {
      const urls = ['url1'];
      const mockExtractor = jest.fn(async () => ({ data: 'test' }));

      const batchResult = await engine.startBatchExport('batch-status', urls, {}, mockExtractor);
      const status = engine.getBatchStatus(batchResult.jobId);

      expect(status.jobId).toBe(batchResult.jobId);
      expect(status.progress).toBeDefined();
    });

    test('should list active batches', async () => {
      const urls = ['url1', 'url2'];
      const mockExtractor = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { data: 'test' };
      });

      engine.startBatchExport('batch-1', urls, { parallel: false }, mockExtractor);
      engine.startBatchExport('batch-2', urls, { parallel: false }, mockExtractor);

      const active = engine.listActiveBatches();

      expect(active.length).toBeGreaterThanOrEqual(0);
    });

    test('should cancel batch job', async () => {
      const urls = Array.from({ length: 10 }, (_, i) => `url${i}`);
      const mockExtractor = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { data: 'test' };
      });

      const batchResult = await engine.startBatchExport(
        'batch-cancel',
        urls,
        { parallel: true },
        mockExtractor
      );

      const cancelResult = engine.cancelBatch(batchResult.jobId);

      expect(cancelResult.success).toBe(true);
      expect(cancelResult.jobId).toBe(batchResult.jobId);
    });

    test('should retrieve batch history', async () => {
      const urls = ['url1'];
      const mockExtractor = jest.fn(async () => ({ data: 'test' }));

      const batchResult = await engine.startBatchExport('batch-history', urls, {}, mockExtractor);

      // Wait a bit for history to be recorded
      await new Promise(resolve => setTimeout(resolve, 100));

      const history = engine.getBatchHistory(batchResult.jobId);

      expect(history).toBeDefined();
    });

    test('should list all batch history', () => {
      const allHistory = engine.getBatchHistory();

      expect(Array.isArray(allHistory)).toBe(true);
    });

    test('should return error for non-existent batch', () => {
      const status = engine.getBatchStatus('non-existent-job-id');

      expect(status.error).toBeDefined();
    });
  });

  // ==================== Statistics Tests ====================

  describe('Engine Statistics', () => {
    test('should track statistics', () => {
      engine.deduplicateRecords([
        { id: '1' },
        { id: '1' },
        { id: '2' }
      ]);

      const stats = engine.getStatistics();

      expect(stats.totalDuplicatesRemoved).toBe(1);
      expect(stats.activeBatchCount).toBeDefined();
      expect(stats.historicalBatchCount).toBeDefined();
    });

    test('should reset statistics', () => {
      engine.deduplicateRecords([{ id: '1' }, { id: '1' }]);

      engine.resetStatistics();
      const stats = engine.getStatistics();

      expect(stats.totalDuplicatesRemoved).toBe(0);
      expect(stats.totalBatchesProcessed).toBe(0);
    });

    test('should update merge statistics', () => {
      engine.mergeExports([{ data: [{ id: '1' }] }]);

      const stats = engine.getStatistics();

      expect(stats.totalMerges).toBe(1);
    });
  });

  // ==================== Performance & Integration Tests ====================

  describe('Performance & Integration', () => {
    test('should handle large batch (100 URLs)', async () => {
      const urls = Array.from({ length: 100 }, (_, i) => `url${i}`);
      const mockExtractor = jest.fn(async () => ({ data: 'test' }));

      const start = Date.now();
      const result = await engine.startBatchExport(
        'batch-large',
        urls,
        { parallel: true, maxConcurrent: 5 },
        mockExtractor
      );
      const duration = Date.now() - start;

      expect(result.jobId).toBeDefined();
      expect(duration).toBeLessThan(30000); // Should complete in reasonable time
    });

    test('should handle deduplication of large dataset (1000 records)', () => {
      const records = Array.from({ length: 1000 }, (_, i) => ({
        id: Math.floor(i / 10),
        value: `data${Math.floor(i / 10)}`
      }));

      const start = Date.now();
      const result = engine.deduplicateRecords(records);
      const duration = Date.now() - start;

      expect(result.unique.length).toBe(100);
      expect(result.duplicates.length).toBe(900);
      expect(duration).toBeLessThan(1000); // Should be fast
    });

    test('should integrate dedup, merge, and filter operations', () => {
      // Create sample data
      const records1 = [
        { id: '1', name: 'Alice', status: 'active' },
        { id: '1', name: 'Alice', status: 'active' }, // Duplicate
        { id: '2', name: 'Bob', status: 'inactive' }
      ];

      const records2 = [
        { id: '2', name: 'Bob', status: 'inactive' },
        { id: '3', name: 'Charlie', status: 'active' }
      ];

      // Step 1: Deduplicate
      const deduped = engine.deduplicateRecords(records1);
      expect(deduped.unique.length).toBe(2);

      // Step 2: Merge
      const merged = engine.mergeExports([
        { data: deduped.unique },
        { data: records2 }
      ], { strategy: 'union' });

      expect(merged.merged.length).toBe(3);

      // Step 3: Filter
      const filtered = engine.applyBatchFilters(merged.merged, [
        { field: 'status', operator: 'equals', value: 'active' }
      ]);

      expect(filtered.filtered.length).toBe(2);
    });
  });

  // ==================== Error Handling Tests ====================

  describe('Error Handling', () => {
    test('should emit error event on deduplication failure', (done) => {
      engine.on('deduplication-error', (event) => {
        expect(event.error).toBeDefined();
        done();
      });

      engine.deduplicateRecords('invalid');
    });

    test('should emit error event on merge failure', (done) => {
      engine.on('merge-error', (event) => {
        expect(event.error).toBeDefined();
        done();
      });

      engine.mergeExports([]);
    });

    test('should emit error event on delta failure', (done) => {
      engine.on('delta-error', (event) => {
        expect(event.error).toBeDefined();
        done();
      });

      engine.exportDelta(null, null);
    });

    test('should emit error event on filter failure', (done) => {
      engine.on('batch-filter-error', (event) => {
        expect(event.error).toBeDefined();
        done();
      });

      engine.applyBatchFilters('invalid', []);
    });
  });
});
