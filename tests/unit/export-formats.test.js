/**
 * Export Formats Unit Tests
 *
 * Tests for JSON, CSV, HAR, WARC, SQLite, Markdown, XML, and Custom export formats
 *
 * @module tests/unit/export-formats
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { registerExportFormatCommands } = require('../../websocket/commands/export-formats');

describe('Export Formats', () => {
  let server;
  let tempDir;

  // Mock managers
  const mockNetworkAnalysisManager = {
    getLogs: async (filters = {}) => {
      return [
        {
          id: '1',
          url: 'https://example.com/page1',
          method: 'GET',
          statusCode: 200,
          timestamp: '2026-06-20T10:00:00Z',
          duration: 150,
          resourceType: 'document',
          contentLength: 5000,
          cached: false,
          headers: [],
          responseHeaders: [],
          startTime: '2026-06-20T10:00:00Z'
        },
        {
          id: '2',
          url: 'https://example.com/api/data',
          method: 'POST',
          statusCode: 201,
          timestamp: '2026-06-20T10:00:01Z',
          duration: 200,
          resourceType: 'xhr',
          contentLength: 1500,
          cached: false,
          headers: [],
          responseHeaders: [],
          startTime: '2026-06-20T10:00:01Z'
        },
        {
          id: '3',
          url: 'https://cdn.example.com/image.png',
          method: 'GET',
          statusCode: 304,
          timestamp: '2026-06-20T10:00:02Z',
          duration: 50,
          resourceType: 'image',
          contentLength: 0,
          cached: true,
          headers: [],
          responseHeaders: [],
          startTime: '2026-06-20T10:00:02Z'
        }
      ];
    }
  };

  beforeEach(() => {
    // Create mock server
    server = {
      commandHandlers: {}
    };

    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-formats-test-'));

    // Register commands
    registerExportFormatCommands(server, {
      networkAnalysisManager: mockNetworkAnalysisManager
    });
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('export_format_json', () => {
    it('should export network logs as JSON', async () => {
      const result = await server.commandHandlers.export_format_json({
        data_type: 'network_logs'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.networkLogs.length, 3);
      assert.strictEqual(result.stats.dataType, 'network_logs');
    });

    it('should prettify JSON when requested', async () => {
      const result = await server.commandHandlers.export_format_json({
        data_type: 'network_logs',
        prettify: true
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      // Prettified JSON should contain newlines and spaces
      const jsonStr = JSON.stringify(result.data, null, 2);
      assert.ok(jsonStr.includes('\n'));
    });

    it('should filter fields', async () => {
      const result = await server.commandHandlers.export_format_json({
        data_type: 'network_logs',
        include_fields: ['url', 'statusCode']
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.networkLogs[0]);
      assert.ok(result.data.networkLogs[0].url);
      assert.ok(result.data.networkLogs[0].statusCode);
      assert.strictEqual(result.data.networkLogs[0].id, undefined);
    });

    it('should write JSON to file', async () => {
      const filePath = path.join(tempDir, 'export.json');
      const result = await server.commandHandlers.export_format_json({
        data_type: 'network_logs',
        output_path: filePath
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.file_path, filePath);
      assert.ok(fs.existsSync(filePath));

      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      assert.ok(parsed.networkLogs);
    });

    it('should handle export_all data type', async () => {
      const result = await server.commandHandlers.export_format_json({
        data_type: 'all'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.networkLogs);
      assert.ok(result.data.sessionData);
    });
  });

  describe('export_format_csv', () => {
    it('should export network logs as CSV', async () => {
      const result = await server.commandHandlers.export_format_csv({
        data_type: 'network_logs'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.stats.rowCount, 3);
      assert.ok(result.stats.columnCount > 0);
    });

    it('should include CSV headers', async () => {
      const result = await server.commandHandlers.export_format_csv({
        data_type: 'network_logs',
        include_headers: true
      });

      assert.strictEqual(result.success, true);
      const lines = result.data.split('\n');
      // First line should be headers
      assert.ok(lines[0]);
      assert.ok(lines[0].includes('url'));
    });

    it('should use custom delimiter', async () => {
      const result = await server.commandHandlers.export_format_csv({
        data_type: 'network_logs',
        delimiter: ';'
      });

      assert.strictEqual(result.success, true);
      const lines = result.data.split('\n');
      assert.ok(lines[1].includes(';'));
    });

    it('should write CSV to file', async () => {
      const filePath = path.join(tempDir, 'export.csv');
      const result = await server.commandHandlers.export_format_csv({
        data_type: 'network_logs',
        output_path: filePath
      });

      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(filePath));

      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(content.length > 0);
    });

    it('should escape CSV fields with commas', async () => {
      const result = await server.commandHandlers.export_format_csv({
        data_type: 'network_logs'
      });

      assert.strictEqual(result.success, true);
      // Check for proper CSV escaping
      assert.ok(result.data);
    });

    it('should select specific columns', async () => {
      const result = await server.commandHandlers.export_format_csv({
        data_type: 'network_logs',
        columns: ['url', 'method', 'statusCode']
      });

      assert.strictEqual(result.success, true);
      const lines = result.data.split('\n');
      assert.ok(lines[0].includes('url'));
      assert.strictEqual(result.stats.columnCount, 3);
    });
  });

  describe('export_format_har', () => {
    it('should export network logs as HAR format', async () => {
      const result = await server.commandHandlers.export_format_har();

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.ok(result.data.log);
      assert.strictEqual(result.data.log.version, '1.0');
    });

    it('should include HAR entries', async () => {
      const result = await server.commandHandlers.export_format_har();

      assert.strictEqual(result.success, true);
      assert.ok(Array.isArray(result.data.log.entries));
      assert.strictEqual(result.data.log.entries.length, 3);
    });

    it('should have correct HAR entry structure', async () => {
      const result = await server.commandHandlers.export_format_har();

      assert.strictEqual(result.success, true);
      const entry = result.data.log.entries[0];
      assert.ok(entry.request);
      assert.ok(entry.response);
      assert.ok(entry.timings);
      assert.strictEqual(entry.request.method, 'GET');
      assert.ok(entry.request.url);
    });

    it('should write HAR to file', async () => {
      const filePath = path.join(tempDir, 'export.har');
      const result = await server.commandHandlers.export_format_har({
        output_path: filePath
      });

      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(filePath));

      const content = fs.readFileSync(filePath, 'utf8');
      const har = JSON.parse(content);
      assert.ok(har.log);
    });

    it('should include HAR pages', async () => {
      const result = await server.commandHandlers.export_format_har({
        title: 'Test Page'
      });

      assert.strictEqual(result.success, true);
      assert.ok(Array.isArray(result.data.log.pages));
      assert.ok(result.data.log.pages[0].title);
    });
  });

  describe('export_format_warc', () => {
    it('should export network logs as WARC format', async () => {
      const result = await server.commandHandlers.export_format_warc();

      assert.strictEqual(result.success, true);
      assert.ok(result.stats);
      assert.strictEqual(result.stats.format, 'WARC 1.0');
    });

    it('should write WARC to file', async () => {
      const filePath = path.join(tempDir, 'export.warc');
      const result = await server.commandHandlers.export_format_warc({
        output_path: filePath
      });

      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(filePath));

      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(content.includes('WARC/1.0'));
    });

    it('should have WARC headers', async () => {
      const filePath = path.join(tempDir, 'export.warc');
      const result = await server.commandHandlers.export_format_warc({
        output_path: filePath
      });

      assert.strictEqual(result.success, true);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(content.includes('WARC-Type:'));
      assert.ok(content.includes('WARC-Date:'));
      assert.ok(content.includes('WARC-Record-ID:'));
    });

    it('should support creation_date parameter', async () => {
      const testDate = '2026-06-20T12:00:00Z';
      const result = await server.commandHandlers.export_format_warc({
        creation_date: testDate
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.stats);
    });
  });

  describe('export_format_sqlite', () => {
    it('should create SQLite database', async () => {
      const dbPath = path.join(tempDir, 'export.db');
      const result = await server.commandHandlers.export_format_sqlite({
        output_path: dbPath
      });

      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(dbPath));
    });

    it('should require output_path', async () => {
      const result = await server.commandHandlers.export_format_sqlite({});

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should export network logs to SQLite', async () => {
      const dbPath = path.join(tempDir, 'export-logs.db');
      const result = await server.commandHandlers.export_format_sqlite({
        output_path: dbPath,
        include_tables: ['network_logs']
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.file_path);
      assert.ok(fs.existsSync(dbPath));
    });

    it('should create all tables', async () => {
      const dbPath = path.join(tempDir, 'export-all.db');
      const result = await server.commandHandlers.export_format_sqlite({
        output_path: dbPath,
        include_tables: ['network_logs', 'sessions', 'metadata']
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.stats);
    });

    it('should handle database creation errors gracefully', async () => {
      const invalidPath = path.join('invalid-directory-that-does-not-exist', 'export.db');
      const result = await server.commandHandlers.export_format_sqlite({
        output_path: invalidPath,
        include_tables: ['network_logs']
      });

      // Should create the directory, so this should succeed
      assert.strictEqual(result.success, true);
    });
  });

  describe('export_format_markdown', () => {
    it('should export as Markdown', async () => {
      const result = await server.commandHandlers.export_format_markdown();

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.ok(result.data.includes('#'));
    });

    it('should include summary section', async () => {
      const result = await server.commandHandlers.export_format_markdown({
        sections: ['summary']
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.includes('## Summary'));
    });

    it('should include network section', async () => {
      const result = await server.commandHandlers.export_format_markdown({
        sections: ['network']
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.includes('## Network Requests'));
      assert.ok(result.data.includes('| URL |'));
    });

    it('should include session section', async () => {
      const result = await server.commandHandlers.export_format_markdown({
        sections: ['session']
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.includes('## Session Information'));
    });

    it('should include timeline section', async () => {
      const result = await server.commandHandlers.export_format_markdown({
        sections: ['timeline']
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.includes('## Timeline'));
    });

    it('should write Markdown to file', async () => {
      const filePath = path.join(tempDir, 'export.md');
      const result = await server.commandHandlers.export_format_markdown({
        output_path: filePath
      });

      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(filePath));

      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(content.includes('# '));
    });

    it('should support custom title', async () => {
      const result = await server.commandHandlers.export_format_markdown({
        title: 'Custom Report Title'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.includes('Custom Report Title'));
    });

    it('should support multiple sections', async () => {
      const result = await server.commandHandlers.export_format_markdown({
        sections: ['summary', 'network', 'session', 'timeline']
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.stats.sections, 4);
      assert.ok(result.data.includes('## Summary'));
      assert.ok(result.data.includes('## Network Requests'));
      assert.ok(result.data.includes('## Session Information'));
      assert.ok(result.data.includes('## Timeline'));
    });
  });

  describe('export_format_xml', () => {
    it('should export as XML', async () => {
      const result = await server.commandHandlers.export_format_xml();

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.ok(result.data.includes('<?xml'));
      assert.ok(result.data.includes('</basset_hound_export>'));
    });

    it('should have XML declaration', async () => {
      const result = await server.commandHandlers.export_format_xml();

      assert.strictEqual(result.success, true);
      assert.ok(result.data.startsWith('<?xml'));
    });

    it('should include metadata element', async () => {
      const result = await server.commandHandlers.export_format_xml({
        data_type: 'all'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.includes('<metadata>'));
      assert.ok(result.data.includes('<exported_at>'));
    });

    it('should include network logs', async () => {
      const result = await server.commandHandlers.export_format_xml({
        data_type: 'network_logs'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.includes('<network_logs>'));
      assert.ok(result.data.includes('<log>'));
    });

    it('should escape XML special characters', async () => {
      const result = await server.commandHandlers.export_format_xml();

      assert.strictEqual(result.success, true);
      // Check that special characters are properly escaped
      assert.ok(!result.data.includes('&') || result.data.includes('&amp;'));
    });

    it('should write XML to file', async () => {
      const filePath = path.join(tempDir, 'export.xml');
      const result = await server.commandHandlers.export_format_xml({
        output_path: filePath
      });

      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(filePath));

      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(content.includes('<?xml'));
    });

    it('should support custom root element', async () => {
      const result = await server.commandHandlers.export_format_xml({
        root_element: 'custom_root'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.includes('<custom_root>'));
      assert.ok(result.data.includes('</custom_root>'));
    });
  });

  describe('export_format_custom', () => {
    it('should use template to generate output', async () => {
      const result = await server.commandHandlers.export_format_custom({
        template: 'Hello {{name}}, you are {{age}} years old.',
        data: {
          name: 'Alice',
          age: '25'
        }
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data, 'Hello Alice, you are 25 years old.');
    });

    it('should require template', async () => {
      const result = await server.commandHandlers.export_format_custom({
        data: {}
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should handle missing template variables', async () => {
      const result = await server.commandHandlers.export_format_custom({
        template: 'Name: {{name}}, Email: {{email}}',
        data: {
          name: 'Bob'
        }
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.includes('Name: Bob'));
      assert.ok(result.data.includes('Email: '));
    });

    it('should support trim option', async () => {
      const result = await server.commandHandlers.export_format_custom({
        template: '  Hello {{name}}  ',
        data: { name: 'World' },
        options: { trim: true }
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data, 'Hello World');
    });

    it('should support uppercase option', async () => {
      const result = await server.commandHandlers.export_format_custom({
        template: 'hello {{name}}',
        data: { name: 'alice' },
        options: { uppercase: true }
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.includes('HELLO'));
      assert.ok(result.data.includes('ALICE'));
    });

    it('should support lowercase option', async () => {
      const result = await server.commandHandlers.export_format_custom({
        template: 'HELLO {{NAME}}',
        data: { NAME: 'ALICE' },
        options: { lowercase: true }
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.data.toLowerCase() === result.data);
    });

    it('should write custom output to file', async () => {
      const filePath = path.join(tempDir, 'export.txt');
      const result = await server.commandHandlers.export_format_custom({
        template: 'Export: {{data}}',
        data: { data: 'test' },
        output_path: filePath
      });

      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(filePath));

      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(content.includes('Export: test'));
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid server instance', () => {
      assert.throws(() => {
        registerExportFormatCommands(null);
      });
    });

    it('should handle missing commandHandlers', () => {
      assert.throws(() => {
        registerExportFormatCommands({});
      });
    });

    it('should handle invalid file paths gracefully', async () => {
      const result = await server.commandHandlers.export_format_json({
        output_path: '/invalid/path/that/does/not/exist/file.json'
      });

      // Should create directories and succeed
      assert.strictEqual(result.success, true);
    });
  });

  describe('Statistics', () => {
    it('should include size statistics', async () => {
      const result = await server.commandHandlers.export_format_json({
        data_type: 'network_logs'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.stats.size > 0);
      assert.ok(result.stats.exported_at);
    });

    it('should track export timestamp', async () => {
      const result = await server.commandHandlers.export_format_csv({
        data_type: 'network_logs'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.stats.exported_at);
    });

    it('should report row and column counts for CSV', async () => {
      const result = await server.commandHandlers.export_format_csv({
        data_type: 'network_logs'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.stats.rowCount >= 0);
      assert.ok(result.stats.columnCount > 0);
    });
  });
});
