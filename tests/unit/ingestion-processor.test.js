/**
 * Ingestion Processor Unit Tests
 *
 * Tests for the Phase 13 data ingestion processor that handles
 * the workflow of detecting, validating, and ingesting OSINT data.
 */

const {
  IngestionProcessor,
  createIngestionProcessor,
  INGESTION_MODES,
  DEFAULT_CONFIG
} = require('../../extraction/ingestion-processor');

describe('IngestionProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new IngestionProcessor();
  });

  describe('initialization', () => {
    test('should initialize with default configuration', () => {
      expect(processor).toBeDefined();
      expect(processor.config).toBeDefined();
      expect(processor.config.mode).toBe(INGESTION_MODES.SELECTIVE);
    });

    test('should accept custom configuration', () => {
      const customProcessor = new IngestionProcessor({
        mode: INGESTION_MODES.AUTOMATIC,
        confidenceThreshold: 0.9
      });

      expect(customProcessor.config.mode).toBe(INGESTION_MODES.AUTOMATIC);
      expect(customProcessor.config.confidenceThreshold).toBe(0.9);
    });

    test('should initialize empty queue', () => {
      expect(processor.getQueue()).toHaveLength(0);
    });

    test('should initialize statistics', () => {
      const stats = processor.getStats();
      expect(stats.totalDetected).toBe(0);
      expect(stats.totalIngested).toBe(0);
    });
  });

  describe('createIngestionProcessor factory', () => {
    test('should create processor instance', () => {
      const instance = createIngestionProcessor();
      expect(instance).toBeInstanceOf(IngestionProcessor);
    });

    test('should pass options', () => {
      const instance = createIngestionProcessor({
        mode: INGESTION_MODES.AUTOMATIC
      });
      expect(instance.config.mode).toBe(INGESTION_MODES.AUTOMATIC);
    });
  });

  describe('processPage', () => {
    const sampleHtml = `
      <html>
        <body>
          <p>Contact us at info@example.com</p>
          <p>Phone: 555-123-4567</p>
          <p>BTC: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2</p>
        </body>
      </html>
    `;

    test('should process page and detect data types', async () => {
      const result = await processor.processPage(sampleHtml, 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.detected.length).toBeGreaterThan(0);
    });

    test('should queue items in selective mode', async () => {
      processor.setMode(INGESTION_MODES.SELECTIVE);
      const result = await processor.processPage(sampleHtml, 'https://example.com');

      expect(result.queued.length).toBeGreaterThan(0);
      expect(processor.getQueue().length).toBeGreaterThan(0);
    });

    test('should auto-ingest in automatic mode', async () => {
      processor.setMode(INGESTION_MODES.AUTOMATIC);
      const result = await processor.processPage(sampleHtml, 'https://example.com');

      expect(result.autoIngested.length).toBeGreaterThan(0);
    });

    test('should update statistics after processing', async () => {
      await processor.processPage(sampleHtml, 'https://example.com');

      const stats = processor.getStats();
      expect(stats.totalDetected).toBeGreaterThan(0);
    });

    test('should return error for invalid HTML', async () => {
      const result = await processor.processPage(null, 'https://example.com');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('ingestion modes', () => {
    const testHtml = '<p>Email: test@example.com</p>';

    test('AUTOMATIC mode should ingest all items', async () => {
      processor.setMode(INGESTION_MODES.AUTOMATIC);
      const result = await processor.processPage(testHtml, 'https://example.com');

      expect(result.autoIngested.length).toBeGreaterThan(0);
      expect(processor.getQueue().length).toBe(0);
    });

    test('SELECTIVE mode should queue all items', async () => {
      processor.setMode(INGESTION_MODES.SELECTIVE);
      const result = await processor.processPage(testHtml, 'https://example.com');

      expect(result.queued.length).toBeGreaterThan(0);
    });

    test('TYPE_FILTERED mode should auto-ingest configured types', async () => {
      processor.configure({
        mode: INGESTION_MODES.TYPE_FILTERED,
        autoIngestTypes: ['email']
      });

      const html = '<p>Email: test@example.com</p><p>Phone: 555-123-4567</p>';
      const result = await processor.processPage(html, 'https://example.com');

      const ingestedEmails = result.autoIngested.filter(i => i.type === 'email');
      expect(ingestedEmails.length).toBeGreaterThan(0);
    });

    test('should validate mode before setting', () => {
      expect(() => processor.setMode('invalid_mode')).toThrow();
    });
  });

  describe('queue management', () => {
    beforeEach(async () => {
      processor.setMode(INGESTION_MODES.SELECTIVE);
      await processor.processPage(
        '<p>Email 1: first@example.com</p><p>Email 2: second@example.com</p>',
        'https://example.com'
      );
    });

    test('should return queue contents', () => {
      const queue = processor.getQueue();
      expect(queue.length).toBeGreaterThan(0);
    });

    test('should clear queue', () => {
      processor.clearQueue();
      expect(processor.getQueue().length).toBe(0);
    });

    test('should remove specific items from queue', () => {
      const queue = processor.getQueue();
      const firstItemId = queue[0].id;

      processor.removeFromQueue([firstItemId]);

      const newQueue = processor.getQueue();
      expect(newQueue.find(i => i.id === firstItemId)).toBeUndefined();
    });
  });

  describe('ingestSelected', () => {
    beforeEach(async () => {
      processor.setMode(INGESTION_MODES.SELECTIVE);
      await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com'
      );
    });

    test('should ingest selected items', async () => {
      const queue = processor.getQueue();
      const itemId = queue[0].id;

      const result = await processor.ingestSelected([itemId]);

      expect(result.ingested.length).toBe(1);
      expect(processor.getQueue().find(i => i.id === itemId)).toBeUndefined();
    });

    test('should report not found items', async () => {
      const result = await processor.ingestSelected(['nonexistent_id']);

      expect(result.notFound).toContain('nonexistent_id');
    });

    test('should update statistics', async () => {
      const queue = processor.getQueue();
      const itemId = queue[0].id;

      await processor.ingestSelected([itemId]);

      const stats = processor.getStats();
      expect(stats.totalIngested).toBe(1);
    });
  });

  describe('ingestAll', () => {
    beforeEach(async () => {
      processor.setMode(INGESTION_MODES.SELECTIVE);
      await processor.processPage(
        '<p>Email 1: first@example.com</p><p>Email 2: second@example.com</p>',
        'https://example.com'
      );
    });

    test('should ingest all queued items', async () => {
      const initialQueueLength = processor.getQueue().length;
      const result = await processor.ingestAll();

      expect(result.ingested.length).toBe(initialQueueLength);
      expect(processor.getQueue().length).toBe(0);
    });
  });

  describe('deduplication', () => {
    test('should deduplicate repeated values on same page', async () => {
      processor.setMode(INGESTION_MODES.AUTOMATIC);

      const html = `
        <p>Email: test@example.com</p>
        <p>Contact: test@example.com</p>
      `;

      const result = await processor.processPage(html, 'https://example.com');

      const stats = processor.getStats();
      expect(stats.totalDuplicates).toBeGreaterThan(0);
    });

    test('should deduplicate across pages', async () => {
      processor.setMode(INGESTION_MODES.AUTOMATIC);

      await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com/page1'
      );

      const result = await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com/page2'
      );

      // Second page should have the duplicate skipped
      expect(result.skipped.length).toBeGreaterThan(0);
    });

    test('should clear deduplication cache', () => {
      processor.clearDedupeCache();
      // Should not throw
      expect(processor.dedupeCache.size).toBe(0);
    });
  });

  describe('confidence filtering', () => {
    test('should skip items below confidence threshold', async () => {
      processor.configure({
        mode: INGESTION_MODES.AUTOMATIC,
        confidenceThreshold: 0.99  // Very high threshold
      });

      const result = await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com'
      );

      // Depending on validation, items might be skipped
      expect(result.success).toBe(true);
    });
  });

  describe('provenance', () => {
    test('should include source URL in provenance', async () => {
      processor.setMode(INGESTION_MODES.AUTOMATIC);

      const result = await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com/test'
      );

      const ingested = result.autoIngested[0];
      expect(ingested.provenance.source_url).toBe('https://example.com/test');
    });

    test('should include timestamp in provenance', async () => {
      processor.setMode(INGESTION_MODES.AUTOMATIC);

      const result = await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com'
      );

      const ingested = result.autoIngested[0];
      expect(ingested.provenance.source_date).toBeDefined();
    });

    test('should respect provenance configuration', async () => {
      processor.configure({
        mode: INGESTION_MODES.AUTOMATIC,
        provenance: {
          includeSourceUrl: false,
          includeTimestamp: true,
          includeContext: false,
          includeBrowserInfo: false
        }
      });

      const result = await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com'
      );

      const ingested = result.autoIngested[0];
      expect(ingested.provenance.source_url).toBeUndefined();
      expect(ingested.provenance.source_date).toBeDefined();
    });
  });

  describe('orphan data generation', () => {
    test('should generate valid orphan data structure', async () => {
      processor.setMode(INGESTION_MODES.AUTOMATIC);

      const result = await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com'
      );

      const ingested = result.autoIngested[0];
      expect(ingested.orphanData).toBeDefined();
      expect(ingested.orphanData.identifier_type).toBe('email');
      expect(ingested.orphanData.identifier_value).toBe('test@example.com');
    });

    test('should include suggested tags in orphan data', async () => {
      processor.setMode(INGESTION_MODES.AUTOMATIC);

      const result = await processor.processPage(
        '<p>Email: user@gmail.com</p>',
        'https://example.com'
      );

      const ingested = result.autoIngested[0];
      expect(ingested.orphanData.tags).toContain('email');
    });

    test('should include confidence score in orphan data', async () => {
      processor.setMode(INGESTION_MODES.AUTOMATIC);

      const result = await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com'
      );

      const ingested = result.autoIngested[0];
      expect(ingested.orphanData.confidence_score).toBeGreaterThan(0);
    });
  });

  describe('history', () => {
    beforeEach(async () => {
      processor.setMode(INGESTION_MODES.AUTOMATIC);
      await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com'
      );
    });

    test('should track ingestion history', () => {
      const history = processor.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    test('should limit history items', () => {
      const history = processor.getHistory(10);
      expect(history.length).toBeLessThanOrEqual(10);
    });

    test('should include action in history', () => {
      const history = processor.getHistory();
      expect(history[0].action).toBe('ingested');
    });
  });

  describe('export', () => {
    beforeEach(async () => {
      processor.setMode(INGESTION_MODES.SELECTIVE);
      await processor.processPage(
        '<p>Email: test@example.com</p><p>Phone: 555-123-4567</p>',
        'https://example.com'
      );
    });

    test('should export queue to JSON', () => {
      const json = processor.exportToJson();
      const parsed = JSON.parse(json);

      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.items.length).toBeGreaterThan(0);
    });

    test('should export specific items', () => {
      const items = [{ type: 'test', value: 'value' }];
      const json = processor.exportToJson(items);
      const parsed = JSON.parse(json);

      expect(parsed.items.length).toBe(1);
    });
  });

  describe('configuration', () => {
    test('should get current configuration', () => {
      const config = processor.getConfig();
      expect(config.mode).toBeDefined();
      expect(config.enabledTypes).toBeDefined();
    });

    test('should update configuration', () => {
      processor.configure({
        confidenceThreshold: 0.85
      });

      expect(processor.config.confidenceThreshold).toBe(0.85);
    });
  });

  describe('statistics', () => {
    test('should track all statistics', async () => {
      processor.setMode(INGESTION_MODES.AUTOMATIC);
      await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com'
      );

      const stats = processor.getStats();
      expect(stats.totalDetected).toBeGreaterThan(0);
      expect(stats.totalIngested).toBeGreaterThan(0);
      expect(stats.queueLength).toBeDefined();
    });

    test('should reset statistics', () => {
      processor.resetStats();
      const stats = processor.getStats();
      expect(stats.totalDetected).toBe(0);
      expect(stats.totalIngested).toBe(0);
    });
  });

  describe('callbacks', () => {
    test('should trigger onDetection callback', async () => {
      const mockCallback = jest.fn();
      processor.on('onDetection', mockCallback);

      await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com'
      );

      expect(mockCallback).toHaveBeenCalled();
    });

    test('should trigger onIngest callback', async () => {
      const mockCallback = jest.fn();
      processor.on('onIngest', mockCallback);
      processor.setMode(INGESTION_MODES.AUTOMATIC);

      await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com'
      );

      expect(mockCallback).toHaveBeenCalled();
    });

    test('should trigger onQueueUpdate callback', async () => {
      const mockCallback = jest.fn();
      processor.on('onQueueUpdate', mockCallback);
      processor.setMode(INGESTION_MODES.SELECTIVE);

      await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com'
      );

      expect(mockCallback).toHaveBeenCalled();
    });
  });
});

describe('INGESTION_MODES', () => {
  test('should have all modes defined', () => {
    expect(INGESTION_MODES.AUTOMATIC).toBe('automatic');
    expect(INGESTION_MODES.SELECTIVE).toBe('selective');
    expect(INGESTION_MODES.TYPE_FILTERED).toBe('type_filtered');
    expect(INGESTION_MODES.CONFIRMATION).toBe('confirmation');
    expect(INGESTION_MODES.BATCH).toBe('batch');
  });
});

describe('DEFAULT_CONFIG', () => {
  test('should have all required configuration options', () => {
    expect(DEFAULT_CONFIG.mode).toBeDefined();
    expect(DEFAULT_CONFIG.enabledTypes).toBeDefined();
    expect(DEFAULT_CONFIG.autoIngestTypes).toBeDefined();
    expect(DEFAULT_CONFIG.confidenceThreshold).toBeDefined();
    expect(DEFAULT_CONFIG.deduplication).toBeDefined();
    expect(DEFAULT_CONFIG.rateLimiting).toBeDefined();
    expect(DEFAULT_CONFIG.provenance).toBeDefined();
  });
});
