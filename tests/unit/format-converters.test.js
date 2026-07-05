/**
 * Format Converters Unit Tests
 *
 * Tests for bidirectional format conversion between JSON, CSV, HAR, XML, and Markdown
 *
 * @module tests/unit/format-converters
 */

const assert = require('assert');
const {
  FormatConverter,
  jsonToCSV,
  jsonToHAR,
  jsonToXML,
  jsonToMarkdown,
  csvToJSON,
  harToJSON,
  harToCSV,
  xmlToJSON
} = require('../../extraction/format-converters');

describe('FormatConverter', () => {
  let converter;

  beforeEach(() => {
    converter = new FormatConverter();
  });

  describe('Converter Registry', () => {
    it('should list supported formats', () => {
      const formats = converter.listSupportedFormats();
      assert.ok(Array.isArray(formats));
      assert.ok(formats.includes('json'));
      assert.ok(formats.includes('csv'));
      assert.ok(formats.includes('har'));
    });

    it('should check if conversion is supported', () => {
      assert.strictEqual(converter.isConversionSupported('json', 'csv'), true);
      assert.strictEqual(converter.isConversionSupported('json', 'json'), true);
      assert.strictEqual(converter.isConversionSupported('csv', 'json'), true);
    });

    it('should handle same format conversion', () => {
      const data = { test: 'value' };
      const result = converter.convert(data, 'json', 'json');
      assert.deepStrictEqual(result, data);
    });

    it('should throw for unsupported conversion', () => {
      assert.throws(() => {
        converter.convert({}, 'unknown', 'format');
      });
    });

    it('should register custom converter', () => {
      const customConverter = (data) => `Custom: ${JSON.stringify(data)}`;
      converter.register('json-to-custom', customConverter);

      assert.strictEqual(
        converter.isConversionSupported('json', 'custom'),
        true
      );
    });
  });

  describe('JSON to CSV', () => {
    it('should convert simple JSON array to CSV', () => {
      const data = [
        { id: 1, name: 'Alice', age: 25 },
        { id: 2, name: 'Bob', age: 30 }
      ];

      const csv = jsonToCSV(data);
      const lines = csv.split('\n');

      assert.ok(lines[0].includes('id'));
      assert.ok(lines[1].includes('1'));
      assert.ok(lines[2].includes('2'));
    });

    it('should include headers by default', () => {
      const data = [{ col1: 'value1' }];
      const csv = jsonToCSV(data);
      const lines = csv.split('\n');

      assert.ok(lines[0].includes('col1'));
    });

    it('should exclude headers when requested', () => {
      const data = [{ col1: 'value1' }];
      const csv = jsonToCSV(data, { includeHeaders: false });
      const lines = csv.split('\n');

      assert.ok(!lines[0].includes('col1'));
      assert.ok(lines[0].includes('value1'));
    });

    it('should use custom delimiter', () => {
      const data = [{ col1: 'value1', col2: 'value2' }];
      const csv = jsonToCSV(data, { delimiter: ';' });

      assert.ok(csv.includes(';'));
    });

    it('should escape CSV fields with special characters', () => {
      const data = [{ name: 'Alice, Bob' }];
      const csv = jsonToCSV(data);

      assert.ok(csv.includes('"Alice, Bob"'));
    });

    it('should handle nested objects', () => {
      const data = [
        { id: 1, user: { name: 'Alice', email: 'alice@example.com' } }
      ];
      const csv = jsonToCSV(data);

      assert.ok(csv.includes('user.name'));
    });

    it('should select specific columns', () => {
      const data = [
        { id: 1, name: 'Alice', age: 25 }
      ];
      const csv = jsonToCSV(data, { columns: ['id', 'name'] });

      assert.ok(csv.includes('id'));
      assert.ok(csv.includes('name'));
      assert.ok(!csv.includes('age'));
    });

    it('should parse string input', () => {
      const jsonString = JSON.stringify([{ name: 'Alice' }]);
      const csv = jsonToCSV(jsonString);

      assert.ok(csv.includes('name'));
    });
  });

  describe('JSON to HAR', () => {
    it('should convert JSON entries to HAR format', () => {
      const data = [
        {
          url: 'https://example.com',
          method: 'GET',
          statusCode: 200,
          duration: 100
        }
      ];

      const har = jsonToHAR(data);

      assert.ok(har.log);
      assert.strictEqual(har.log.version, '1.0');
      assert.ok(Array.isArray(har.log.entries));
      assert.strictEqual(har.log.entries.length, 1);
    });

    it('should include creator information', () => {
      const har = jsonToHAR([]);
      assert.ok(har.log.creator);
      assert.ok(har.log.creator.name);
    });

    it('should include pages section', () => {
      const har = jsonToHAR([]);
      assert.ok(Array.isArray(har.log.pages));
      assert.strictEqual(har.log.pages.length, 1);
    });

    it('should support custom title', () => {
      const har = jsonToHAR([], { title: 'Custom Title' });
      assert.strictEqual(har.log.pages[0].title, 'Custom Title');
    });

    it('should convert entry format properly', () => {
      const data = [
        {
          url: 'https://api.example.com/data',
          method: 'POST',
          statusCode: 201,
          duration: 250,
          contentLength: 1500
        }
      ];

      const har = jsonToHAR(data);
      const entry = har.log.entries[0];

      assert.strictEqual(entry.request.method, 'POST');
      assert.strictEqual(entry.request.url, 'https://api.example.com/data');
      assert.strictEqual(entry.response.status, 201);
      assert.strictEqual(entry.time, 250);
    });

    it('should parse string input', () => {
      const jsonString = JSON.stringify([{ url: 'https://example.com' }]);
      const har = jsonToHAR(jsonString);

      assert.ok(har.log);
      assert.ok(har.log.entries.length > 0);
    });
  });

  describe('JSON to XML', () => {
    it('should convert JSON object to XML', () => {
      const data = { root: { name: 'Test', value: 123 } };
      const xml = jsonToXML(data);

      assert.ok(xml.startsWith('<?xml'));
      assert.ok(xml.includes('<root>'));
      assert.ok(xml.includes('</root>'));
    });

    it('should escape XML special characters', () => {
      const data = { message: 'Hello & "World"' };
      const xml = jsonToXML(data);

      assert.ok(xml.includes('&amp;'));
      assert.ok(!xml.includes('&') || xml.includes('&amp;'));
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'Alice',
          email: 'alice@example.com'
        }
      };
      const xml = jsonToXML(data);

      assert.ok(xml.includes('<user>'));
      assert.ok(xml.includes('<name>'));
      assert.ok(xml.includes('</name>'));
    });

    it('should handle arrays', () => {
      const data = {
        items: [
          { id: 1, name: 'Item1' },
          { id: 2, name: 'Item2' }
        ]
      };
      const xml = jsonToXML(data);

      assert.ok(xml.includes('<items>'));
      assert.ok(xml.includes('<id>1</id>'));
    });

    it('should support custom root element', () => {
      const data = { content: 'test' };
      const xml = jsonToXML(data, { rootElement: 'custom' });

      assert.ok(xml.includes('<custom>'));
    });

    it('should parse string input', () => {
      const jsonString = JSON.stringify({ name: 'Test' });
      const xml = jsonToXML(jsonString);

      assert.ok(xml.startsWith('<?xml'));
      assert.ok(xml.includes('<name>'));
    });
  });

  describe('JSON to Markdown', () => {
    it('should convert JSON object to Markdown', () => {
      const data = {
        section: 'Test Section',
        items: ['Item 1', 'Item 2']
      };
      const markdown = jsonToMarkdown(data);

      assert.ok(markdown.includes('#'));
      assert.ok(markdown.includes('Item 1'));
    });

    it('should include title', () => {
      const markdown = jsonToMarkdown({}, { title: 'My Report' });
      assert.ok(markdown.includes('# My Report'));
    });

    it('should include timestamp', () => {
      const markdown = jsonToMarkdown({}, { includeTimestamp: true });
      assert.ok(markdown.includes('Generated:'));
    });

    it('should exclude timestamp when requested', () => {
      const markdown = jsonToMarkdown({}, { includeTimestamp: false });
      assert.ok(!markdown.includes('Generated:'));
    });

    it('should handle nested structures', () => {
      const data = {
        users: [
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 30 }
        ]
      };
      const markdown = jsonToMarkdown(data);

      assert.ok(markdown.includes('Alice'));
      assert.ok(markdown.includes('Bob'));
    });

    it('should parse string input', () => {
      const jsonString = JSON.stringify({ test: 'value' });
      const markdown = jsonToMarkdown(jsonString);

      assert.ok(markdown.includes('#'));
    });
  });

  describe('CSV to JSON', () => {
    it('should convert CSV string to JSON array', () => {
      const csv = 'id,name,age\n1,Alice,25\n2,Bob,30';
      const json = csvToJSON(csv);

      assert.ok(Array.isArray(json));
      assert.strictEqual(json.length, 2);
      assert.strictEqual(json[0].id, '1');
      assert.strictEqual(json[0].name, 'Alice');
    });

    it('should use custom delimiter', () => {
      const csv = 'id;name;age\n1;Alice;25';
      const json = csvToJSON(csv, { delimiter: ';' });

      assert.strictEqual(json[0].id, '1');
      assert.strictEqual(json[0].name, 'Alice');
    });

    it('should handle empty lines', () => {
      const csv = 'id,name\n1,Alice\n\n2,Bob';
      const json = csvToJSON(csv);

      assert.strictEqual(json.length, 2);
    });

    it('should unescape quoted fields', () => {
      const csv = 'name,city\n"Smith, Alice","New York"\n"Jones, Bob","Los Angeles"';
      const json = csvToJSON(csv);

      assert.ok(json[0].name.includes('Smith'));
    });
  });

  describe('HAR to Conversions', () => {
    const sampleHAR = {
      log: {
        version: '1.0',
        entries: [
          {
            request: {
              url: 'https://example.com',
              method: 'GET'
            },
            response: {
              status: 200,
              content: { size: 5000 }
            },
            time: 100
          }
        ]
      }
    };

    it('should convert HAR to JSON', () => {
      const json = harToJSON(sampleHAR);
      assert.ok(json.log);
      assert.strictEqual(json.log.version, '1.0');
    });

    it('should parse string HAR', () => {
      const harString = JSON.stringify(sampleHAR);
      const json = harToJSON(harString);
      assert.ok(json.log);
    });

    it('should convert HAR to CSV', () => {
      const csv = harToCSV(sampleHAR);
      assert.ok(csv.includes('https://example.com'));
      assert.ok(csv.includes('200'));
    });
  });

  describe('Converter Chain', () => {
    it('should chain multiple conversions', () => {
      const originalData = [
        { id: 1, name: 'Alice', status: 'active' }
      ];

      // JSON -> CSV
      const csv = converter.convert(originalData, 'json', 'csv');
      assert.ok(csv.includes('Alice'));

      // CSV -> JSON
      const backToJson = converter.convert(csv, 'csv', 'json');
      assert.ok(Array.isArray(backToJson));
      assert.strictEqual(backToJson.length, 1);
    });

    it('should handle complex data through multiple formats', () => {
      const data = [
        {
          url: 'https://example.com',
          method: 'GET',
          status: 200,
          duration: 100
        }
      ];

      // JSON -> HAR
      const har = converter.convert(data, 'json', 'har');
      assert.ok(har.log.entries.length > 0);

      // HAR -> CSV
      const csv = converter.convert(har, 'har', 'csv');
      assert.ok(csv.includes('example.com'));
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', () => {
      assert.throws(() => {
        csvToJSON('id,name\n1,Alice\n2,');
      });
    });

    it('should handle empty data', () => {
      const csv = csvToJSON('');
      assert.ok(Array.isArray(csv));
      assert.strictEqual(csv.length, 0);
    });

    it('should handle null values', () => {
      const data = [{ id: 1, value: null }];
      const csv = jsonToCSV(data);
      assert.ok(csv.length > 0);
    });

    it('should handle undefined values', () => {
      const data = [{ id: 1, value: undefined }];
      const csv = jsonToCSV(data);
      assert.ok(csv.length > 0);
    });
  });

  describe('Performance', () => {
    it('should handle large JSON arrays', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User${i}`,
        email: `user${i}@example.com`
      }));

      const csv = jsonToCSV(largeData);
      assert.ok(csv.length > 0);

      const backToJson = csvToJSON(csv);
      assert.strictEqual(backToJson.length, 1000);
    });

    it('should handle deeply nested objects', () => {
      let deep = { value: 'test' };
      for (let i = 0; i < 50; i++) {
        deep = { nested: deep };
      }

      const xml = jsonToXML({ root: deep });
      assert.ok(xml.length > 0);
    });
  });
});
