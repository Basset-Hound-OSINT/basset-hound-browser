/**
 * Export Template WebSocket Commands Tests
 *
 * Tests for WebSocket API commands for custom export templates
 *
 * @module tests/unit/export-template-commands.test.js
 */

const { registerExportTemplateCommands } = require('../../websocket/commands/export-templates-commands');

describe('Export Template WebSocket Commands', () => {
  let mockServer;

  beforeEach(() => {
    // Create mock server
    mockServer = {
      commandHandlers: {},
      broadcast: jest.fn()
    };

    // Register commands
    registerExportTemplateCommands(mockServer);
  });

  describe('create_export_template', () => {
    test('should create template with valid parameters', async () => {
      const params = {
        name: 'Test Template',
        fields: [
          { source: 'id', target: 'id' },
          { source: 'name', target: 'name' }
        ],
        format: 'json'
      };

      const result = await mockServer.commandHandlers.create_export_template(params);

      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
      expect(result.template.name).toBe('Test Template');
      expect(result.template.fields.length).toBe(2);
      expect(result.timestamp).toBeDefined();
    });

    test('should fail without name', async () => {
      const params = {
        fields: [{ source: 'id' }]
      };

      const result = await mockServer.commandHandlers.create_export_template(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('name');
    });

    test('should fail without fields', async () => {
      const params = {
        name: 'Test'
      };

      const result = await mockServer.commandHandlers.create_export_template(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('fields');
    });

    test('should require fields to be array', async () => {
      const params = {
        name: 'Test',
        fields: 'not-an-array'
      };

      const result = await mockServer.commandHandlers.create_export_template(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('array');
    });

    test('should support custom ID', async () => {
      const params = {
        name: 'Test',
        id: 'custom-id',
        fields: [{ source: 'id' }]
      };

      const result = await mockServer.commandHandlers.create_export_template(params);

      expect(result.success).toBe(true);
      expect(result.template.id).toBe('custom-id');
    });
  });

  describe('list_export_templates', () => {
    beforeEach(async () => {
      // Create some test templates
      await mockServer.commandHandlers.create_export_template({
        name: 'JSON Template',
        format: 'json',
        fields: [{ source: 'id' }]
      });

      await mockServer.commandHandlers.create_export_template({
        name: 'CSV Template',
        format: 'csv',
        fields: [{ source: 'id' }]
      });
    });

    test('should list all templates', async () => {
      const result = await mockServer.commandHandlers.list_export_templates();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.templates)).toBe(true);
      expect(result.templates.length).toBe(2);
      expect(result.count).toBe(2);
    });

    test('should filter by format', async () => {
      const result = await mockServer.commandHandlers.list_export_templates({
        format: 'csv'
      });

      expect(result.success).toBe(true);
      expect(result.templates.length).toBe(1);
      expect(result.templates[0].format).toBe('csv');
    });

    test('should search by name', async () => {
      const result = await mockServer.commandHandlers.list_export_templates({
        search: 'JSON'
      });

      expect(result.success).toBe(true);
      expect(result.templates.some(t => t.name.includes('JSON'))).toBe(true);
    });
  });

  describe('get_export_template', () => {
    let templateId;

    beforeEach(async () => {
      const result = await mockServer.commandHandlers.create_export_template({
        name: 'Test Template',
        fields: [{ source: 'id' }]
      });
      templateId = result.template.id;
    });

    test('should get template by ID', async () => {
      const result = await mockServer.commandHandlers.get_export_template({
        templateId
      });

      expect(result.success).toBe(true);
      expect(result.template.id).toBe(templateId);
    });

    test('should fail without templateId', async () => {
      const result = await mockServer.commandHandlers.get_export_template({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('templateId');
    });
  });

  describe('export_with_template', () => {
    let templateId;

    beforeEach(async () => {
      const result = await mockServer.commandHandlers.create_export_template({
        name: 'Export Template',
        fields: [
          { source: 'id', target: 'id' },
          { source: 'name', target: 'name' }
        ]
      });
      templateId = result.template.id;
    });

    test('should export data with template', async () => {
      const data = { id: 1, name: 'John' };
      const result = await mockServer.commandHandlers.export_with_template({
        templateId,
        data
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, name: 'John' });
      expect(result.metadata).toBeDefined();
    });

    test('should export array of records', async () => {
      const data = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ];
      const result = await mockServer.commandHandlers.export_with_template({
        templateId,
        data
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.metadata.recordsExported).toBe(2);
    });

    test('should format output when requested', async () => {
      const data = [{ id: 1, name: 'John' }];
      const result = await mockServer.commandHandlers.export_with_template({
        templateId,
        data,
        formatOutput: true
      });

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
      expect(result.format).toBe('json');
    });

    test('should fail without templateId', async () => {
      const result = await mockServer.commandHandlers.export_with_template({
        data: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('templateId');
    });

    test('should fail without data', async () => {
      const result = await mockServer.commandHandlers.export_with_template({
        templateId
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('data');
    });
  });

  describe('update_export_template', () => {
    let templateId;

    beforeEach(async () => {
      const result = await mockServer.commandHandlers.create_export_template({
        name: 'Original Name',
        fields: [{ source: 'id' }]
      });
      templateId = result.template.id;
    });

    test('should update template', async () => {
      const result = await mockServer.commandHandlers.update_export_template({
        templateId,
        updates: {
          name: 'Updated Name',
          description: 'Updated description'
        }
      });

      expect(result.success).toBe(true);
      expect(result.template.name).toBe('Updated Name');
      expect(result.template.description).toBe('Updated description');
    });

    test('should fail without templateId', async () => {
      const result = await mockServer.commandHandlers.update_export_template({
        updates: { name: 'New Name' }
      });

      expect(result.success).toBe(false);
    });

    test('should fail without updates', async () => {
      const result = await mockServer.commandHandlers.update_export_template({
        templateId
      });

      expect(result.success).toBe(false);
    });
  });

  describe('delete_export_template', () => {
    let templateId;

    beforeEach(async () => {
      const result = await mockServer.commandHandlers.create_export_template({
        name: 'To Delete',
        fields: [{ source: 'id' }]
      });
      templateId = result.template.id;
    });

    test('should delete template', async () => {
      const result = await mockServer.commandHandlers.delete_export_template({
        templateId
      });

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(true);
    });

    test('should fail without templateId', async () => {
      const result = await mockServer.commandHandlers.delete_export_template({});

      expect(result.success).toBe(false);
    });
  });

  describe('clone_export_template', () => {
    let templateId;

    beforeEach(async () => {
      const result = await mockServer.commandHandlers.create_export_template({
        name: 'Original',
        fields: [{ source: 'id' }]
      });
      templateId = result.template.id;
    });

    test('should clone template', async () => {
      const result = await mockServer.commandHandlers.clone_export_template({
        templateId,
        newName: 'Cloned'
      });

      expect(result.success).toBe(true);
      expect(result.template.name).toBe('Cloned');
      expect(result.template.id).not.toBe(templateId);
    });

    test('should fail without templateId', async () => {
      const result = await mockServer.commandHandlers.clone_export_template({
        newName: 'Cloned'
      });

      expect(result.success).toBe(false);
    });

    test('should fail without newName', async () => {
      const result = await mockServer.commandHandlers.clone_export_template({
        templateId
      });

      expect(result.success).toBe(false);
    });
  });

  describe('validate_export_template', () => {
    let templateId;

    beforeEach(async () => {
      const result = await mockServer.commandHandlers.create_export_template({
        name: 'Valid Template',
        fields: [{ source: 'id' }]
      });
      templateId = result.template.id;
    });

    test('should validate valid template', async () => {
      const result = await mockServer.commandHandlers.validate_export_template({
        templateId
      });

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    test('should fail without templateId', async () => {
      const result = await mockServer.commandHandlers.validate_export_template({});

      expect(result.success).toBe(false);
    });
  });

  describe('test_export_template', () => {
    let templateId;

    beforeEach(async () => {
      const result = await mockServer.commandHandlers.create_export_template({
        name: 'Test Template',
        fields: [
          { source: 'id', target: 'id' },
          { source: 'name', target: 'name' }
        ]
      });
      templateId = result.template.id;
    });

    test('should test template with sample data', async () => {
      const result = await mockServer.commandHandlers.test_export_template({
        templateId,
        sampleData: { id: 1, name: 'John' }
      });

      expect(result.success).toBe(true);
      expect(result.preview).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    test('should fail without templateId', async () => {
      const result = await mockServer.commandHandlers.test_export_template({
        sampleData: {}
      });

      expect(result.success).toBe(false);
    });

    test('should fail without sampleData', async () => {
      const result = await mockServer.commandHandlers.test_export_template({
        templateId
      });

      expect(result.success).toBe(false);
    });
  });

  describe('get_export_transforms', () => {
    test('should get available transforms', async () => {
      const result = await mockServer.commandHandlers.get_export_transforms();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.transforms)).toBe(true);
      expect(result.count).toBeGreaterThan(0);
      expect(result.transforms).toContain('uppercase');
      expect(result.transforms).toContain('lowercase');
    });
  });

  describe('format_export_data', () => {
    test('should format as JSON', async () => {
      const data = [{ id: 1, name: 'John' }];
      const result = await mockServer.commandHandlers.format_export_data({
        data,
        format: 'json'
      });

      expect(result.success).toBe(true);
      expect(typeof result.formatted).toBe('string');
      const parsed = JSON.parse(result.formatted);
      expect(parsed.length).toBe(1);
    });

    test('should format as CSV', async () => {
      const data = [{ id: 1, name: 'John' }];
      const result = await mockServer.commandHandlers.format_export_data({
        data,
        format: 'csv'
      });

      expect(result.success).toBe(true);
      expect(result.formatted).toContain('id');
      expect(result.formatted).toContain('name');
    });

    test('should format as XML', async () => {
      const data = { id: 1, name: 'John' };
      const result = await mockServer.commandHandlers.format_export_data({
        data,
        format: 'xml'
      });

      expect(result.success).toBe(true);
      expect(result.formatted).toContain('<?xml');
      expect(result.formatted).toContain('<id>1</id>');
    });

    test('should fail without data', async () => {
      const result = await mockServer.commandHandlers.format_export_data({
        format: 'json'
      });

      expect(result.success).toBe(false);
    });

    test('should fail without format', async () => {
      const result = await mockServer.commandHandlers.format_export_data({
        data: {}
      });

      expect(result.success).toBe(false);
    });
  });

  describe('get_export_template_stats', () => {
    test('should get statistics', async () => {
      // Create a template and export some data
      const templateResult = await mockServer.commandHandlers.create_export_template({
        name: 'Test',
        fields: [{ source: 'id' }]
      });

      await mockServer.commandHandlers.export_with_template({
        templateId: templateResult.template.id,
        data: { id: 1 }
      });

      const result = await mockServer.commandHandlers.get_export_template_stats();

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats.templatesCreated).toBeGreaterThan(0);
      expect(result.stats.exportsPerformed).toBeGreaterThan(0);
    });
  });

  describe('register_custom_transform', () => {
    test('should register custom transform', async () => {
      const result = await mockServer.commandHandlers.register_custom_transform({
        name: 'customTransform',
        code: '(val) => val.toUpperCase()'
      });

      expect(result.success).toBe(true);
      expect(result.registered).toBe(true);
      expect(result.name).toBe('customTransform');
    });

    test('should fail without name', async () => {
      const result = await mockServer.commandHandlers.register_custom_transform({
        code: '(val) => val'
      });

      expect(result.success).toBe(false);
    });

    test('should fail without code', async () => {
      const result = await mockServer.commandHandlers.register_custom_transform({
        name: 'custom'
      });

      expect(result.success).toBe(false);
    });

    test('should fail with invalid code', async () => {
      const result = await mockServer.commandHandlers.register_custom_transform({
        name: 'badTransform',
        code: 'invalid syntax {'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  describe('Event Broadcasting', () => {
    test('should broadcast template-created event', async () => {
      await mockServer.commandHandlers.create_export_template({
        name: 'Event Test',
        fields: [{ source: 'id' }]
      });

      // Give event time to be broadcast
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockServer.broadcast).toHaveBeenCalledWith(
        'export_template_event',
        expect.objectContaining({
          type: 'template-created'
        })
      );
    });
  });

  describe('Integration Tests', () => {
    test('should create, export, and format data', async () => {
      // Create template
      const createResult = await mockServer.commandHandlers.create_export_template({
        name: 'Integration Test',
        fields: [
          { source: 'id', target: 'id' },
          { source: 'name', target: 'name', transforms: ['uppercase'] }
        ],
        format: 'csv'
      });

      expect(createResult.success).toBe(true);
      const templateId = createResult.template.id;

      // Export data
      const exportResult = await mockServer.commandHandlers.export_with_template({
        templateId,
        data: [
          { id: 1, name: 'john' },
          { id: 2, name: 'jane' }
        ]
      });

      expect(exportResult.success).toBe(true);
      expect(exportResult.data[0].name).toBe('JOHN');
      expect(exportResult.data[1].name).toBe('JANE');

      // Format as CSV
      const formatResult = await mockServer.commandHandlers.format_export_data({
        data: exportResult.data,
        format: 'csv'
      });

      expect(formatResult.success).toBe(true);
      expect(formatResult.formatted).toContain('id');
      expect(formatResult.formatted).toContain('JOHN');
    });
  });
});
