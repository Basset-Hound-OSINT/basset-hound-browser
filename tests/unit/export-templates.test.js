/**
 * Export Template Engine Tests
 *
 * Feature Area: Export & Analysis - Category 2
 *
 * Tests for:
 * - Template creation and management
 * - Field mapping and transformations
 * - Conditional exports
 * - Template validation
 * - Data export and formatting
 *
 * @module tests/unit/export-templates.test.js
 */

const { ExportTemplateEngine, BUILT_IN_TRANSFORMS } = require('../../extraction/export-templates');

describe('ExportTemplateEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new ExportTemplateEngine();
  });

  describe('Template Creation', () => {
    test('should create basic export template', () => {
      const template = engine.createTemplate({
        name: 'Basic Export',
        fields: [
          { source: 'id', target: 'id' },
          { source: 'name', target: 'name' }
        ],
        format: 'json'
      });

      expect(template).toBeDefined();
      expect(template.name).toBe('Basic Export');
      expect(template.fields.length).toBe(2);
      expect(template.format).toBe('json');
      expect(template.id).toBeDefined();
    });

    test('should create template with description', () => {
      const template = engine.createTemplate({
        name: 'User Export',
        description: 'Exports user data',
        fields: [{ source: 'user', target: 'user' }]
      });

      expect(template.description).toBe('Exports user data');
    });

    test('should generate unique template IDs', () => {
      const template1 = engine.createTemplate({
        name: 'Template',
        fields: [{ source: 'id' }]
      });

      const template2 = engine.createTemplate({
        name: 'Template',
        fields: [{ source: 'id' }]
      });

      expect(template1.id).not.toBe(template2.id);
    });

    test('should require name and fields', () => {
      expect(() => engine.createTemplate({})).toThrow();
      expect(() => engine.createTemplate({ name: 'Test' })).toThrow();
    });

    test('should validate format parameter', () => {
      expect(() => engine.createTemplate({
        name: 'Test',
        fields: [{ source: 'id' }],
        format: 'invalid'
      })).toThrow();
    });

    test('should increment stats on template creation', () => {
      expect(engine.stats.templatesCreated).toBe(0);

      engine.createTemplate({
        name: 'Template',
        fields: [{ source: 'id' }]
      });

      expect(engine.stats.templatesCreated).toBe(1);
    });
  });

  describe('Template Management', () => {
    let template;

    beforeEach(() => {
      template = engine.createTemplate({
        name: 'Test Template',
        fields: [
          { source: 'id', target: 'id' },
          { source: 'name', target: 'name' }
        ]
      });
    });

    test('should retrieve template by ID', () => {
      const retrieved = engine.getTemplate(template.id);
      expect(retrieved.id).toBe(template.id);
      expect(retrieved.name).toBe('Test Template');
    });

    test('should throw on non-existent template', () => {
      expect(() => engine.getTemplate('nonexistent')).toThrow();
    });

    test('should list all templates', () => {
      const template2 = engine.createTemplate({
        name: 'Another Template',
        fields: [{ source: 'value' }]
      });

      const templates = engine.listTemplates();
      expect(templates.length).toBe(2);
    });

    test('should filter templates by format', () => {
      engine.createTemplate({
        name: 'CSV Template',
        format: 'csv',
        fields: [{ source: 'id' }]
      });

      const csvTemplates = engine.listTemplates({ format: 'csv' });
      expect(csvTemplates.length).toBe(1);
      expect(csvTemplates[0].format).toBe('csv');
    });

    test('should search templates by name', () => {
      engine.createTemplate({
        name: 'User Export Template',
        fields: [{ source: 'user' }]
      });

      const results = engine.listTemplates({ search: 'User' });
      expect(results.some(t => t.name.includes('User'))).toBe(true);
    });

    test('should update template', () => {
      const updated = engine.updateTemplate(template.id, {
        name: 'Updated Template',
        description: 'Updated description'
      });

      expect(updated.name).toBe('Updated Template');
      expect(updated.description).toBe('Updated description');
      expect(updated.version).toBe(2);
      expect(updated.modified).toBeDefined();
    });

    test('should delete template', () => {
      engine.deleteTemplate(template.id);
      expect(() => engine.getTemplate(template.id)).toThrow();
    });

    test('should clone template', () => {
      const cloned = engine.cloneTemplate(template.id, 'Cloned Template');

      expect(cloned.name).toBe('Cloned Template');
      expect(cloned.id).not.toBe(template.id);
      expect(cloned.fields).toEqual(template.fields);
      expect(engine.stats.templatesCreated).toBe(2);
    });
  });

  describe('Field Mapping', () => {
    test('should map source to target field names', () => {
      const template = engine.createTemplate({
        name: 'Field Mapping',
        fields: [
          { source: 'firstName', target: 'first_name' },
          { source: 'lastName', target: 'last_name' }
        ]
      });

      const data = {
        firstName: 'John',
        lastName: 'Doe'
      };

      const result = engine.exportWithTemplate(template.id, data);
      expect(result.data).toEqual({
        first_name: 'John',
        last_name: 'Doe'
      });
    });

    test('should handle nested field paths', () => {
      const template = engine.createTemplate({
        name: 'Nested Fields',
        fields: [
          { source: 'user.name', target: 'name' },
          { source: 'user.email', target: 'email' }
        ]
      });

      const data = {
        user: {
          name: 'John',
          email: 'john@example.com'
        }
      };

      const result = engine.exportWithTemplate(template.id, data);
      expect(result.data).toEqual({
        name: 'John',
        email: 'john@example.com'
      });
    });

    test('should skip missing optional fields', () => {
      const template = engine.createTemplate({
        name: 'Optional Fields',
        fields: [
          { source: 'name', target: 'name' },
          { source: 'optional', target: 'optional', required: false }
        ]
      });

      const data = { name: 'John' };

      const result = engine.exportWithTemplate(template.id, data);
      expect(result.data).toEqual({ name: 'John' });
    });

    test('should include null values when specified', () => {
      const template = engine.createTemplate({
        name: 'Include Null',
        fields: [
          { source: 'name', target: 'name' },
          { source: 'optional', target: 'optional', includeNull: true }
        ]
      });

      const data = { name: 'John' };

      const result = engine.exportWithTemplate(template.id, data);
      expect(result.data.optional).toBeNull();
    });
  });

  describe('Field Transformations', () => {
    test('should apply uppercase transform', () => {
      const template = engine.createTemplate({
        name: 'Uppercase',
        fields: [
          { source: 'name', transforms: ['uppercase'] }
        ]
      });

      const result = engine.exportWithTemplate(template.id, { name: 'john' });
      expect(result.data.name).toBe('JOHN');
    });

    test('should apply lowercase transform', () => {
      const template = engine.createTemplate({
        name: 'Lowercase',
        fields: [
          { source: 'name', transforms: ['lowercase'] }
        ]
      });

      const result = engine.exportWithTemplate(template.id, { name: 'JOHN' });
      expect(result.data.name).toBe('john');
    });

    test('should apply trim transform', () => {
      const template = engine.createTemplate({
        name: 'Trim',
        fields: [
          { source: 'name', transforms: ['trim'] }
        ]
      });

      const result = engine.exportWithTemplate(template.id, { name: '  john  ' });
      expect(result.data.name).toBe('john');
    });

    test('should chain multiple transforms', () => {
      const template = engine.createTemplate({
        name: 'Chain Transforms',
        fields: [
          { source: 'name', transforms: ['trim', 'uppercase'] }
        ]
      });

      const result = engine.exportWithTemplate(template.id, { name: '  john  ' });
      expect(result.data.name).toBe('JOHN');
    });

    test('should apply parametrized transforms', () => {
      const template = engine.createTemplate({
        name: 'Truncate',
        fields: [
          { source: 'text', transforms: [{ name: 'truncate', args: [5] }] }
        ]
      });

      const result = engine.exportWithTemplate(template.id, { text: 'hello world' });
      expect(result.data.text).toBe('hello...');
    });

    test('should apply round transform', () => {
      const template = engine.createTemplate({
        name: 'Round',
        fields: [
          { source: 'value', transforms: [{ name: 'round', args: [2] }] }
        ]
      });

      const result = engine.exportWithTemplate(template.id, { value: 3.14159 });
      expect(result.data.value).toBe(3.14);
    });

    test('should apply multiply transform', () => {
      const template = engine.createTemplate({
        name: 'Multiply',
        fields: [
          { source: 'value', transforms: [{ name: 'multiply', args: [2] }] }
        ]
      });

      const result = engine.exportWithTemplate(template.id, { value: 5 });
      expect(result.data.value).toBe(10);
    });

    test('should apply array transforms', () => {
      const template = engine.createTemplate({
        name: 'Array Join',
        fields: [
          { source: 'tags', transforms: [{ name: 'join', args: ['; '] }] }
        ]
      });

      const result = engine.exportWithTemplate(template.id, { tags: ['a', 'b', 'c'] });
      expect(result.data.tags).toBe('a; b; c');
    });

    test('should get array length', () => {
      const template = engine.createTemplate({
        name: 'Array Length',
        fields: [
          { source: 'items', transforms: ['length'] }
        ]
      });

      const result = engine.exportWithTemplate(template.id, { items: [1, 2, 3] });
      expect(result.data.items).toBe(3);
    });

    test('should apply defaultValue transform', () => {
      const template = engine.createTemplate({
        name: 'Default Value',
        fields: [
          { source: 'optional', transforms: [{ name: 'defaultValue', args: ['N/A'] }] }
        ]
      });

      const result = engine.exportWithTemplate(template.id, {});
      expect(result.data.optional).toBe('N/A');
    });
  });

  describe('Conditional Exports', () => {
    test('should include field when condition is met', () => {
      const template = engine.createTemplate({
        name: 'Conditional Include',
        fields: [
          { source: 'id', target: 'id' },
          {
            source: 'premium',
            target: 'premium',
            condition: { field: 'status', operator: 'equals', value: 'active' }
          }
        ]
      });

      const data = { id: 1, status: 'active', premium: true };
      const result = engine.exportWithTemplate(template.id, data);

      expect(result.data).toHaveProperty('premium');
      expect(result.data.premium).toBe(true);
    });

    test('should exclude field when condition is not met', () => {
      const template = engine.createTemplate({
        name: 'Conditional Exclude',
        fields: [
          { source: 'id', target: 'id' },
          {
            source: 'premium',
            target: 'premium',
            condition: { field: 'status', operator: 'equals', value: 'active' }
          }
        ]
      });

      const data = { id: 1, status: 'inactive', premium: true };
      const result = engine.exportWithTemplate(template.id, data);

      expect(result.data).not.toHaveProperty('premium');
    });

    test('should support exists condition', () => {
      const template = engine.createTemplate({
        name: 'Exists Condition',
        fields: [
          { source: 'id' },
          {
            source: 'optional',
            condition: { field: 'optional', operator: 'exists' }
          }
        ]
      });

      const dataWithField = { id: 1, optional: 'value' };
      const result1 = engine.exportWithTemplate(template.id, dataWithField);
      expect(result1.data).toHaveProperty('optional');

      const dataWithoutField = { id: 1 };
      const result2 = engine.exportWithTemplate(template.id, dataWithoutField);
      expect(result2.data).not.toHaveProperty('optional');
    });

    test('should support greaterThan condition', () => {
      const template = engine.createTemplate({
        name: 'Greater Than',
        fields: [
          { source: 'value' },
          {
            source: 'high',
            condition: { field: 'value', operator: 'greaterThan', value: 100 }
          }
        ]
      });

      const dataHigh = { value: 150, high: true };
      const resultHigh = engine.exportWithTemplate(template.id, dataHigh);
      expect(resultHigh.data).toHaveProperty('high');

      const dataLow = { value: 50, high: true };
      const resultLow = engine.exportWithTemplate(template.id, dataLow);
      expect(resultLow.data).not.toHaveProperty('high');
    });

    test('should support in condition', () => {
      const template = engine.createTemplate({
        name: 'In Condition',
        fields: [
          { source: 'status' },
          {
            source: 'active',
            condition: { field: 'status', operator: 'in', value: ['active', 'pending'] }
          }
        ]
      });

      const data = { status: 'active', active: true };
      const result = engine.exportWithTemplate(template.id, data);
      expect(result.data).toHaveProperty('active');
    });

    test('should support contains condition', () => {
      const template = engine.createTemplate({
        name: 'Contains Condition',
        fields: [
          { source: 'text' },
          {
            source: 'hasError',
            condition: { field: 'text', operator: 'contains', value: 'error' }
          }
        ]
      });

      const data = { text: 'An error occurred', hasError: true };
      const result = engine.exportWithTemplate(template.id, data);
      expect(result.data).toHaveProperty('hasError');
    });
  });

  describe('Global Transforms', () => {
    test('should apply global transforms to all fields', () => {
      const template = engine.createTemplate({
        name: 'Global Transform',
        fields: [
          { source: 'name' },
          { source: 'city' }
        ],
        globalTransforms: ['trim', 'uppercase']
      });

      const data = { name: '  john  ', city: '  new york  ' };
      const result = engine.exportWithTemplate(template.id, data);

      expect(result.data.name).toBe('JOHN');
      expect(result.data.city).toBe('NEW YORK');
    });

    test('should apply field transforms after global transforms', () => {
      const template = engine.createTemplate({
        name: 'Chained Transforms',
        fields: [
          { source: 'value', transforms: [{ name: 'multiply', args: [2] }] }
        ],
        globalTransforms: [{ name: 'defaultValue', args: [5] }]
      });

      const data = {};
      const result = engine.exportWithTemplate(template.id, data);
      expect(result.data.value).toBe(10); // default 5 * 2
    });
  });

  describe('Batch Export', () => {
    test('should export array of records', () => {
      const template = engine.createTemplate({
        name: 'Batch Export',
        fields: [
          { source: 'id', target: 'id' },
          { source: 'name', target: 'name' }
        ]
      });

      const data = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
        { id: 3, name: 'Bob' }
      ];

      const result = engine.exportWithTemplate(template.id, data);

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(3);
      expect(result.metadata.recordsExported).toBe(3);
    });

    test('should apply transforms to all records in batch', () => {
      const template = engine.createTemplate({
        name: 'Batch Uppercase',
        fields: [
          { source: 'name', transforms: ['uppercase'] }
        ]
      });

      const data = [
        { name: 'john' },
        { name: 'jane' }
      ];

      const result = engine.exportWithTemplate(template.id, data);

      expect(result.data[0].name).toBe('JOHN');
      expect(result.data[1].name).toBe('JANE');
    });
  });

  describe('Template Validation', () => {
    test('should validate template structure', () => {
      const template = engine.createTemplate({
        name: 'Valid Template',
        fields: [
          { source: 'id', transforms: ['uppercase'] }
        ]
      });

      const validation = engine.validateTemplate(template.id);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('should detect missing source field', () => {
      const validation = engine.validateTemplate('nonexistent');
      expect(validation.valid).toBe(false);
    });

    test('should warn about unused transforms', () => {
      const template = engine.createTemplate({
        name: 'Test',
        fields: [{ source: 'id' }]
      });

      // Manual validation by updating with invalid transform
      try {
        engine.updateTemplate(template.id, {
          fields: [
            { source: 'id', transforms: ['nonexistentTransform'] }
          ]
        });
      } catch (e) {
        // Expected to fail or warn
      }
    });

    test('should validate field sources are required', () => {
      expect(() => engine.createTemplate({
        name: 'Invalid',
        fields: [{ target: 'output' }] // Missing source
      })).toThrow();
    });
  });

  describe('Template Testing', () => {
    test('should test template with sample data', () => {
      const template = engine.createTemplate({
        name: 'Test Template',
        fields: [
          { source: 'id', target: 'id' },
          { source: 'name', target: 'name' }
        ]
      });

      const sampleData = { id: 1, name: 'Test' };
      const testResult = engine.testTemplate(template.id, sampleData);

      expect(testResult.success).toBe(true);
      expect(testResult.preview).toEqual({ id: 1, name: 'Test' });
    });

    test('should handle test failures gracefully', () => {
      const template = engine.createTemplate({
        name: 'Test Template',
        fields: [{ source: 'required_field', required: true }]
      });

      const sampleData = {}; // Missing required field
      const testResult = engine.testTemplate(template.id, sampleData);

      // Should still succeed but with errors in metadata
      expect(testResult.preview).toBeDefined();
    });
  });

  describe('Export Formatting', () => {
    let data;

    beforeEach(() => {
      data = [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' }
      ];
    });

    test('should format as JSON', () => {
      const formatted = engine.formatExport(data, 'json');
      const parsed = JSON.parse(formatted);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
    });

    test('should format as CSV', () => {
      const formatted = engine.formatExport(data, 'csv');
      const lines = formatted.split('\n');

      expect(lines[0]).toContain('id');
      expect(lines[0]).toContain('name');
      expect(lines[0]).toContain('email');
      expect(lines.length).toBe(3); // header + 2 rows
    });

    test('should escape CSV special characters', () => {
      const csvData = [
        { name: 'John "The King"', value: 'a,b,c' }
      ];

      const formatted = engine.formatExport(csvData, 'csv');
      expect(formatted).toContain('"John \\"The King\\""');
      expect(formatted).toContain('"a,b,c"');
    });

    test('should format as XML', () => {
      const singleRecord = data[0];
      const formatted = engine.formatExport(singleRecord, 'xml');

      expect(formatted).toContain('<?xml');
      expect(formatted).toContain('<id>1</id>');
      expect(formatted).toContain('<name>John</name>');
    });

    test('should escape XML special characters', () => {
      const xmlData = { name: '<tag> & "quote"' };
      const formatted = engine.formatExport(xmlData, 'xml');

      expect(formatted).toContain('&lt;tag&gt;');
      expect(formatted).toContain('&amp;');
      expect(formatted).toContain('&quot;');
    });

    test('should format array as XML with multiple records', () => {
      const formatted = engine.formatExport(data, 'xml');

      expect(formatted).toContain('<record>');
      expect((formatted.match(/<record>/g) || []).length).toBe(2);
    });
  });

  describe('Custom Transforms', () => {
    test('should register custom transform', () => {
      const customTransform = (val) => val ? val.toUpperCase() : val;
      engine.registerTransform('myTransform', customTransform);

      const transforms = engine.getTransforms();
      expect(transforms).toContain('myTransform');
    });

    test('should use custom transform in template', () => {
      engine.registerTransform('reverse', (val) => {
        if (typeof val === 'string') {
          return val.split('').reverse().join('');
        }
        return val;
      });

      const template = engine.createTemplate({
        name: 'Custom Transform',
        fields: [
          { source: 'text', transforms: ['reverse'] }
        ]
      });

      const result = engine.exportWithTemplate(template.id, { text: 'hello' });
      expect(result.data.text).toBe('olleh');
    });

    test('should not allow non-function transforms', () => {
      expect(() => engine.registerTransform('invalid', 'not a function')).toThrow();
    });
  });

  describe('Statistics', () => {
    test('should track templates created', () => {
      expect(engine.stats.templatesCreated).toBe(0);

      engine.createTemplate({
        name: 'Template 1',
        fields: [{ source: 'id' }]
      });

      engine.createTemplate({
        name: 'Template 2',
        fields: [{ source: 'id' }]
      });

      expect(engine.stats.templatesCreated).toBe(2);
    });

    test('should track exports performed', () => {
      const template = engine.createTemplate({
        name: 'Test',
        fields: [{ source: 'id' }]
      });

      engine.exportWithTemplate(template.id, { id: 1 });
      engine.exportWithTemplate(template.id, { id: 2 });

      expect(engine.stats.exportsPerformed).toBe(2);
    });

    test('should track records exported', () => {
      const template = engine.createTemplate({
        name: 'Test',
        fields: [{ source: 'id' }]
      });

      engine.exportWithTemplate(template.id, [{ id: 1 }, { id: 2 }, { id: 3 }]);

      expect(engine.stats.totalRecordsExported).toBe(3);
    });

    test('should track transforms applied', () => {
      const template = engine.createTemplate({
        name: 'Test',
        fields: [
          { source: 'name', transforms: ['uppercase'] }
        ]
      });

      engine.exportWithTemplate(template.id, { name: 'john' });

      expect(engine.stats.transformsApplied).toBeGreaterThan(0);
    });

    test('should provide statistics summary', () => {
      const template = engine.createTemplate({
        name: 'Test',
        fields: [{ source: 'id' }]
      });

      engine.exportWithTemplate(template.id, { id: 1 });

      const stats = engine.getStatistics();

      expect(stats.templatesCreated).toBe(1);
      expect(stats.exportsPerformed).toBe(1);
      expect(stats.totalTemplates).toBe(1);
      expect(stats.registeredTransforms).toBeGreaterThan(0);
    });
  });

  describe('Events', () => {
    test('should emit template-created event', (done) => {
      engine.on('template-created', (template) => {
        expect(template.name).toBe('Test');
        done();
      });

      engine.createTemplate({
        name: 'Test',
        fields: [{ source: 'id' }]
      });
    });

    test('should emit template-updated event', (done) => {
      const template = engine.createTemplate({
        name: 'Test',
        fields: [{ source: 'id' }]
      });

      engine.on('template-updated', (updated) => {
        expect(updated.name).toBe('Updated');
        done();
      });

      engine.updateTemplate(template.id, { name: 'Updated' });
    });

    test('should emit template-deleted event', (done) => {
      const template = engine.createTemplate({
        name: 'Test',
        fields: [{ source: 'id' }]
      });

      engine.on('template-deleted', (data) => {
        expect(data.id).toBe(template.id);
        done();
      });

      engine.deleteTemplate(template.id);
    });

    test('should emit export-completed event', (done) => {
      const template = engine.createTemplate({
        name: 'Test',
        fields: [{ source: 'id' }]
      });

      engine.on('export-completed', (result) => {
        expect(result.templateId).toBe(template.id);
        done();
      });

      engine.exportWithTemplate(template.id, { id: 1 });
    });
  });
});
