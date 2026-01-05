/**
 * Ingestion Workflow Integration Tests
 *
 * Tests the complete Phase 13 data ingestion workflow from detection
 * through to orphan data generation for basset-hound integration.
 */

const {
  DataTypeDetector,
  createDetector,
  IngestionProcessor,
  createIngestionProcessor,
  INGESTION_MODES
} = require('../../extraction');

describe('Ingestion Workflow Integration', () => {
  describe('Detection to Ingestion Pipeline', () => {
    let processor;

    beforeEach(() => {
      processor = createIngestionProcessor({
        mode: INGESTION_MODES.AUTOMATIC,
        confidenceThreshold: 0.5
      });
    });

    test('should process complete page with multiple data types', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Contact Page</title>
        </head>
        <body>
          <h1>Contact Information</h1>
          <div class="contact-info">
            <p>Email: contact@company.com</p>
            <p>Support: support@company.com</p>
            <p>Phone: (555) 123-4567</p>
            <p>International: +44 20 7946 0958</p>
          </div>
          <div class="social">
            <a href="https://twitter.com/companyname">Twitter</a>
            <a href="https://linkedin.com/company/company-inc">LinkedIn</a>
            <a href="https://github.com/companyname">GitHub</a>
          </div>
          <div class="crypto">
            <p>BTC Donations: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2</p>
            <p>ETH: 0x71C7656EC7ab88b098defB751B7401B5f6d8976F</p>
          </div>
          <div class="technical">
            <p>Server: 192.168.1.100</p>
            <p>API: api.company.com</p>
          </div>
        </body>
        </html>
      `;

      const result = await processor.processPage(html, 'https://company.com/contact');

      expect(result.success).toBe(true);
      expect(result.detected.length).toBeGreaterThan(5);
      expect(result.autoIngested.length).toBeGreaterThan(0);

      // Check for variety of types
      const types = [...new Set(result.autoIngested.map(i => i.type))];
      expect(types).toContain('email');
    });

    test('should generate valid basset-hound orphan data', async () => {
      const html = `
        <html>
          <body>
            <p>Contact: john.doe@example.com</p>
          </body>
        </html>
      `;

      const result = await processor.processPage(html, 'https://example.com');
      const ingested = result.autoIngested[0];

      // Verify orphan data structure matches basset-hound requirements
      expect(ingested.orphanData).toMatchObject({
        identifier_type: expect.any(String),
        identifier_value: expect.any(String),
        source: expect.any(String),
        confidence_score: expect.any(Number),
        tags: expect.any(Array)
      });

      expect(ingested.orphanData.metadata).toBeDefined();
      expect(ingested.orphanData.discovered_date).toBeDefined();
    });

    test('should maintain provenance chain', async () => {
      const sourceUrl = 'https://example.com/about';
      const html = '<p>Email: info@example.com</p>';

      const result = await processor.processPage(html, sourceUrl);
      const ingested = result.autoIngested[0];

      expect(ingested.provenance).toBeDefined();
      expect(ingested.provenance.source_url).toBe(sourceUrl);
      expect(ingested.provenance.source_type).toBe('website');
      expect(ingested.provenance.captured_by).toBe('basset-hound-browser');
    });
  });

  describe('Mode Switching Workflow', () => {
    test('should switch from selective to automatic and ingest queue', async () => {
      const processor = createIngestionProcessor({
        mode: INGESTION_MODES.SELECTIVE
      });

      // Process in selective mode (items go to queue)
      await processor.processPage(
        '<p>Email 1: first@example.com</p>',
        'https://example.com/page1'
      );

      expect(processor.getQueue().length).toBeGreaterThan(0);

      // Switch to automatic and process another page
      processor.setMode(INGESTION_MODES.AUTOMATIC);

      const result = await processor.processPage(
        '<p>Email 2: second@example.com</p>',
        'https://example.com/page2'
      );

      // New page should auto-ingest
      expect(result.autoIngested.length).toBeGreaterThan(0);
    });

    test('should handle type-filtered mode correctly', async () => {
      const processor = createIngestionProcessor({
        mode: INGESTION_MODES.TYPE_FILTERED,
        autoIngestTypes: ['email'],
        enabledTypes: ['email', 'phone_us', 'crypto_btc']
      });

      const html = `
        <p>Email: auto@example.com</p>
        <p>Phone: 555-123-4567</p>
        <p>BTC: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2</p>
      `;

      const result = await processor.processPage(html, 'https://example.com');

      // Only email should be auto-ingested
      const autoIngestedTypes = result.autoIngested.map(i => i.type);
      expect(autoIngestedTypes.every(t => t === 'email')).toBe(true);

      // Phone and BTC should be queued
      const queuedTypes = result.queued.map(i => i.type);
      expect(queuedTypes.some(t => t !== 'email')).toBe(true);
    });
  });

  describe('Batch Processing', () => {
    test('should process multiple pages maintaining state', async () => {
      const processor = createIngestionProcessor({
        mode: INGESTION_MODES.AUTOMATIC
      });

      const pages = [
        { html: '<p>Email: page1@example.com</p>', url: 'https://example.com/1' },
        { html: '<p>Email: page2@example.com</p>', url: 'https://example.com/2' },
        { html: '<p>Email: page3@example.com</p>', url: 'https://example.com/3' }
      ];

      let totalIngested = 0;
      for (const page of pages) {
        const result = await processor.processPage(page.html, page.url);
        totalIngested += result.autoIngested.length;
      }

      expect(totalIngested).toBe(3);

      const stats = processor.getStats();
      expect(stats.totalIngested).toBe(3);
    });

    test('should deduplicate across batch', async () => {
      const processor = createIngestionProcessor({
        mode: INGESTION_MODES.AUTOMATIC
      });

      const pages = [
        { html: '<p>Email: same@example.com</p>', url: 'https://example.com/1' },
        { html: '<p>Contact: same@example.com</p>', url: 'https://example.com/2' },
        { html: '<p>Support: same@example.com</p>', url: 'https://example.com/3' }
      ];

      let totalIngested = 0;
      for (const page of pages) {
        const result = await processor.processPage(page.html, page.url);
        totalIngested += result.autoIngested.length;
      }

      // Only first occurrence should be ingested
      expect(totalIngested).toBe(1);

      const stats = processor.getStats();
      expect(stats.totalDuplicates).toBe(2);
    });
  });

  describe('Selective Ingestion Workflow', () => {
    test('should allow user selection from queue', async () => {
      const processor = createIngestionProcessor({
        mode: INGESTION_MODES.SELECTIVE
      });

      await processor.processPage(
        `
          <p>Email 1: first@example.com</p>
          <p>Email 2: second@example.com</p>
          <p>Email 3: third@example.com</p>
        `,
        'https://example.com'
      );

      const queue = processor.getQueue();
      expect(queue.length).toBe(3);

      // User selects first two
      const selectedIds = queue.slice(0, 2).map(i => i.id);
      const result = await processor.ingestSelected(selectedIds);

      expect(result.ingested.length).toBe(2);
      expect(processor.getQueue().length).toBe(1);
    });

    test('should allow clearing entire queue', async () => {
      const processor = createIngestionProcessor({
        mode: INGESTION_MODES.SELECTIVE
      });

      await processor.processPage(
        '<p>Email: test@example.com</p><p>Phone: 555-123-4567</p>',
        'https://example.com'
      );

      processor.clearQueue();

      expect(processor.getQueue().length).toBe(0);

      const stats = processor.getStats();
      expect(stats.totalSkipped).toBeGreaterThan(0);
    });
  });

  describe('Export Integration', () => {
    test('should export queue in basset-hound compatible format', async () => {
      const processor = createIngestionProcessor({
        mode: INGESTION_MODES.SELECTIVE
      });

      await processor.processPage(
        `
          <p>Email: export@example.com</p>
          <p>Phone: 555-123-4567</p>
        `,
        'https://example.com'
      );

      const json = processor.exportToJson();
      const exported = JSON.parse(json);

      expect(exported.exportedBy).toBe('basset-hound-browser');
      expect(exported.items.length).toBeGreaterThan(0);

      // Verify export format
      const item = exported.items[0];
      expect(item.type).toBeDefined();
      expect(item.value).toBeDefined();
      expect(item.confidence).toBeDefined();
      expect(item.orphanType).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed HTML gracefully', async () => {
      const processor = createIngestionProcessor();

      const result = await processor.processPage(
        '<html><body><p>Unclosed tag<p>Email: test@example.com',
        'https://example.com'
      );

      // Should still detect what it can
      expect(result.success).toBe(true);
    });

    test('should handle empty HTML', async () => {
      const processor = createIngestionProcessor();

      const result = await processor.processPage('', 'https://example.com');

      expect(result.success).toBe(false);
    });

    test('should handle HTML with no detectable data', async () => {
      const processor = createIngestionProcessor();

      const result = await processor.processPage(
        '<html><body><p>Nothing special here</p></body></html>',
        'https://example.com'
      );

      expect(result.success).toBe(true);
      expect(result.detected.length).toBe(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide comprehensive statistics', async () => {
      const processor = createIngestionProcessor({
        mode: INGESTION_MODES.AUTOMATIC
      });

      await processor.processPage(
        '<p>Email: test@example.com</p>',
        'https://example.com'
      );

      const stats = processor.getStats();

      expect(stats.totalDetected).toBeGreaterThan(0);
      expect(stats.totalIngested).toBeGreaterThan(0);
      expect(stats.detection).toBeDefined();
      expect(stats.queueLength).toBeDefined();
      expect(stats.historyLength).toBeDefined();
    });

    test('should track by type statistics', async () => {
      const processor = createIngestionProcessor({
        mode: INGESTION_MODES.AUTOMATIC
      });

      await processor.processPage(
        '<p>Email: test@example.com</p><p>Phone: 555-123-4567</p>',
        'https://example.com'
      );

      const stats = processor.getStats();
      expect(stats.byType.email).toBeDefined();
    });
  });
});

describe('DataTypeDetector Standalone', () => {
  describe('Complex Page Detection', () => {
    test('should detect all data types in complex HTML', () => {
      const detector = createDetector();

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Sample OSINT Target</title>
        </head>
        <body>
          <article>
            <h1>Investigation Report</h1>

            <section class="contact">
              <h2>Contact Information</h2>
              <ul>
                <li>Primary: john.doe@targetcompany.com</li>
                <li>Secondary: jdoe@personal-email.net</li>
                <li>Work: +1 (555) 123-4567</li>
                <li>Mobile: +44 7911 123456</li>
              </ul>
            </section>

            <section class="social">
              <h2>Social Media</h2>
              <p>Twitter: @johndoe_official</p>
              <p>LinkedIn: https://linkedin.com/in/john-doe-abc123</p>
              <p>GitHub: https://github.com/johndoe</p>
              <p>Instagram: https://instagram.com/john.doe.photos</p>
            </section>

            <section class="financial">
              <h2>Cryptocurrency</h2>
              <p>BTC: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2</p>
              <p>ETH: 0x71C7656EC7ab88b098defB751B7401B5f6d8976F</p>
            </section>

            <section class="technical">
              <h2>Infrastructure</h2>
              <p>Server IP: 203.0.113.50</p>
              <p>Internal: 192.168.100.1</p>
              <p>Domain: targetcompany.com</p>
              <p>API: api.targetcompany.com</p>
              <p>MAC: 00:1A:2B:3C:4D:5E</p>
            </section>
          </article>
        </body>
        </html>
      `;

      const result = detector.detectAll(html, 'https://investigation.local/report');

      expect(result.success).toBe(true);
      expect(result.totalItems).toBeGreaterThan(10);

      // Verify summary counts
      expect(result.summary.byType.email).toBeGreaterThanOrEqual(2);
      expect(result.summary.byType.social_twitter).toBeDefined();
      expect(result.summary.byType.crypto_btc).toBeDefined();
      expect(result.summary.byType.ip_v4).toBeGreaterThanOrEqual(2);
    });

    test('should handle script and style tags correctly', () => {
      const detector = createDetector();

      const html = `
        <html>
        <head>
          <script>
            // This email should NOT be detected: developer@internal.dev
            const config = { email: 'script@internal.dev' };
          </script>
          <style>
            /* email@style.dev should not be detected */
          </style>
        </head>
        <body>
          <p>Contact: visible@example.com</p>
        </body>
        </html>
      `;

      const result = detector.detectAll(html);

      // Script/style content is stripped, so only body email should be found
      const emails = result.items.filter(i => i.type === 'email');
      expect(emails.some(e => e.value === 'visible@example.com')).toBe(true);
    });
  });
});
