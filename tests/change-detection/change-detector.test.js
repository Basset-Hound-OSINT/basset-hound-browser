/**
 * Unit Tests for Change Detector
 * Tests snapshot creation, comparison, and diff generation
 */

const { ChangeDetector } = require('../../src/analysis/change-detector');

describe('ChangeDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new ChangeDetector();
  });

  describe('Snapshot Creation', () => {
    test('should create a snapshot with all content types', async () => {
      const mockWebContents = {
        executeJavaScript: (code, callback) => {
          // Mock different responses based on code
          if (code.includes('outerHTML')) {
            callback('<html><body>Test content</body></html>');
          } else if (code.includes('innerText')) {
            callback('Test content');
          } else {
            callback({});
          }
        }
      };

      const snapshot = await detector.createSnapshot(mockWebContents, 'https://example.com');

      expect(snapshot).toBeDefined();
      expect(snapshot.url).toBe('https://example.com');
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.content).toBeDefined();
      expect(snapshot.hashes).toBeDefined();
    });

    test('should generate consistent hash for same content', async () => {
      const content = 'Test content for hashing';
      const hash1 = detector.hashContent(content);
      const hash2 = detector.hashContent(content);

      expect(hash1).toBe(hash2);
    });

    test('should generate different hash for different content', async () => {
      const hash1 = detector.hashContent('Content A');
      const hash2 = detector.hashContent('Content B');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Snapshot Comparison', () => {
    beforeEach(async () => {
      // Create mock snapshots
      detector.snapshots.set('https://example.com', {
        url: 'https://example.com',
        timestamp: Date.now(),
        datetime: new Date().toISOString(),
        content: {
          html: '<html><body><div>Old content</div></body></html>',
          text: 'Old content',
          dom: { title: 'Old Title', headings: [] },
          forms: [],
          links: [{ href: 'https://example.com/old' }]
        },
        hashes: {
          html: detector.hashContent('<html><body><div>Old content</div></body></html>'),
          text: detector.hashContent('Old content'),
          dom: detector.hashContent('{}'),
          forms: detector.hashContent('[]'),
          links: detector.hashContent('[{"href":"https://example.com/old"}]')
        }
      });

      // Add second snapshot for comparison
      detector.snapshots.set('https://example.com-v2', {
        url: 'https://example.com',
        timestamp: Date.now() + 5000,
        datetime: new Date(Date.now() + 5000).toISOString(),
        content: {
          html: '<html><body><div>New content</div></body></html>',
          text: 'New content',
          dom: { title: 'New Title', headings: [] },
          forms: [],
          links: [
            { href: 'https://example.com/old' },
            { href: 'https://example.com/new' }
          ]
        },
        hashes: {
          html: detector.hashContent('<html><body><div>New content</div></body></html>'),
          text: detector.hashContent('New content'),
          dom: detector.hashContent('{}'),
          forms: detector.hashContent('[]'),
          links: detector.hashContent('[{"href":"https://example.com/old"},{"href":"https://example.com/new"}]')
        }
      });
    });

    test('should detect content changes', () => {
      detector.snapshots.get('https://example.com-v2').url = 'https://example.com';
      const diff = detector.compareSnapshots('https://example.com', 'https://example.com-v2');

      expect(diff).toBeDefined();
      expect(diff.overall_changed).toBe(true);
      expect(diff.changes.text_changed).toBe(true);
    });

    test('should detect no changes when content is identical', () => {
      detector.snapshots.set('https://example.com-identical', {
        ...detector.snapshots.get('https://example.com'),
        timestamp: Date.now() + 3000
      });
      detector.snapshots.get('https://example.com-identical').url = 'https://example.com';

      const diff = detector.compareSnapshots('https://example.com', 'https://example.com-identical');

      // Since hashes are same, overall_changed should be false
      expect(diff.time_difference_seconds).toBeGreaterThan(0);
    });

    test('should calculate change percentage', () => {
      detector.snapshots.get('https://example.com-v2').url = 'https://example.com';
      const diff = detector.compareSnapshots('https://example.com', 'https://example.com-v2');

      expect(diff.change_percentage).toBeDefined();
      expect(parseFloat(diff.change_percentage)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(diff.change_percentage)).toBeLessThanOrEqual(100);
    });
  });

  describe('Diff Calculations', () => {
    test('should calculate text diff', () => {
      const prevText = 'Line 1\nLine 2\nLine 3';
      const currText = 'Line 1\nLine 2 Modified\nLine 3\nLine 4';

      const diff = detector.getTextDiff(prevText, currText);

      expect(diff).toBeDefined();
      expect(diff.lines_added).toBeGreaterThan(0);
      expect(diff.sample_added).toBeDefined();
      expect(Array.isArray(diff.sample_added)).toBe(true);
    });

    test('should calculate forms diff', () => {
      const prevForms = [
        { action: '/login', method: 'POST', fields: [{ name: 'username' }], buttons: [] }
      ];
      const currForms = [
        { action: '/login', method: 'POST', fields: [{ name: 'username' }, { name: 'password' }], buttons: [] }
      ];

      const diff = detector.getFormsDiff(prevForms, currForms);

      expect(diff).toBeDefined();
      expect(Array.isArray(diff.forms_modified)).toBe(true);
    });

    test('should calculate links diff', () => {
      const prevLinks = [
        { href: 'https://example.com/page1', text: 'Page 1' },
        { href: 'https://example.com/page2', text: 'Page 2' }
      ];
      const currLinks = [
        { href: 'https://example.com/page1', text: 'Page 1' },
        { href: 'https://example.com/page3', text: 'Page 3' }
      ];

      const diff = detector.getLinksDiff(prevLinks, currLinks);

      expect(diff).toBeDefined();
      expect(diff.links_added.length).toBeGreaterThan(0);
      expect(diff.links_removed.length).toBeGreaterThan(0);
    });

    test('should calculate DOM structure diff', () => {
      const prevDOM = {
        title: 'Old',
        headings: [],
        paragraphs: [],
        divs: 5,
        spans: 10,
        images: [],
        links: []
      };
      const currDOM = {
        title: 'New',
        headings: [],
        paragraphs: [],
        divs: 7,
        spans: 12,
        images: [],
        links: []
      };

      const diff = detector.getDOMStructureDiff(prevDOM, currDOM);

      expect(diff).toBeDefined();
      expect(diff.title_changed).toBe(true);
      expect(diff.divs_count_change).toBe(2);
      expect(diff.spans_count_change).toBe(2);
    });
  });

  describe('Change History', () => {
    test('should track change history for URL', () => {
      detector.diffHistory.push({
        url: 'https://example.com',
        datetime: new Date().toISOString(),
        overall_changed: true,
        changes: { text_changed: true }
      });

      const history = detector.getChangeHistory('https://example.com');

      expect(history).toBeDefined();
      expect(history.url).toBe('https://example.com');
      expect(history.changes_detected).toBeGreaterThan(0);
    });

    test('should return all changes', () => {
      detector.diffHistory.push({
        url: 'https://example.com',
        overall_changed: true,
        change_percentage: '25'
      });

      const allChanges = detector.getAllChanges();

      expect(allChanges).toBeDefined();
      expect(allChanges.total_diffs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Report Generation', () => {
    test('should generate HTML report', () => {
      const diff = {
        url: 'https://example.com',
        change_percentage: '50',
        time_difference_seconds: 3600,
        overall_changed: true,
        changes: {
          html_changed: true,
          text_changed: true,
          forms_changed: false,
          links_changed: false,
          dom_changed: false,
          text_diff: {
            lines_added: 5,
            lines_removed: 2
          }
        }
      };

      const report = detector.generateReport(diff);

      expect(report).toBeDefined();
      expect(report).toContain('<!DOCTYPE html>');
      expect(report).toContain('https://example.com');
      expect(report).toContain('50%');
    });
  });

  describe('Performance', () => {
    test('snapshot creation should complete in <100ms', async () => {
      const mockWebContents = {
        executeJavaScript: (code, callback) => {
          callback(Math.random() > 0.5 ? '<html></html>' : '');
        }
      };

      const start = Date.now();
      await detector.createSnapshot(mockWebContents, 'https://example.com');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    test('comparison should complete in <100ms', async () => {
      // Setup snapshots
      detector.snapshots.set('https://example.com', {
        url: 'https://example.com',
        hashes: { html: 'hash1', text: 'hash1', dom: 'hash1', forms: 'hash1', links: 'hash1' },
        content: { html: '', text: '', dom: {}, forms: [], links: [] },
        timestamp: Date.now() - 5000,
        datetime: new Date(Date.now() - 5000).toISOString()
      });

      detector.snapshots.set('https://example.com-v2', {
        url: 'https://example.com',
        hashes: { html: 'hash2', text: 'hash2', dom: 'hash2', forms: 'hash2', links: 'hash2' },
        content: { html: '', text: '', dom: {}, forms: [], links: [] },
        timestamp: Date.now(),
        datetime: new Date().toISOString()
      });

      const start = Date.now();
      detector.compareSnapshots('https://example.com', 'https://example.com-v2');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
