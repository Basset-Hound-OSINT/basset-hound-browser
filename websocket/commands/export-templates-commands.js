/**
 * Export Template Commands
 *
 * Feature Area: Export & Analysis - Category 2
 *
 * WebSocket commands for custom export templates with field mapping,
 * data transformations, and conditional exports.
 *
 * Commands:
 * - create_export_template - Define custom field mapping
 * - list_export_templates - List saved templates
 * - export_with_template - Apply template to data
 * - field_transformations - Apply transforms during export
 * - conditional_export - Include/exclude fields conditionally
 * - template_validation - Validate template syntax
 * - update_export_template - Update template
 * - delete_export_template - Delete template
 * - clone_export_template - Clone existing template
 * - test_export_template - Test template with sample data
 * - get_export_transforms - List available transforms
 * - register_custom_transform - Register custom transform function
 *
 * @module websocket/commands/export-templates-commands
 */

const { ExportTemplateEngine } = require('../../extraction/export-templates');

// Global template engine instance
let templateEngine = null;

/**
 * Register export template WebSocket commands
 *
 * @param {Object} server - WebSocket server instance
 * @param {Object} managers - Manager instances
 */
function registerExportTemplateCommands(server, managers = {}) {
  if (!server || !server.commandHandlers) {
    throw new Error('Invalid server instance');
  }

  const commandHandlers = server.commandHandlers;

  // Initialize template engine lazily
  const getEngine = () => {
    if (!templateEngine) {
      templateEngine = new ExportTemplateEngine();
    }
    return templateEngine;
  };

  /**
   * Create export template
   * POST /create_export_template
   *
   * @param {Object} params - Parameters
   * @param {string} params.name - Template name
   * @param {Array} params.fields - Field mappings
   * @param {string} params.format - Export format (json, csv, xml)
   * @param {string} params.description - Template description
   * @param {Array} params.globalTransforms - Transforms applied to all fields
   * @param {Object} params.metadata - Additional metadata
   * @returns {Object} { template: {}, success: boolean }
   */
  commandHandlers.create_export_template = async (params = {}) => {
    try {
      const engine = getEngine();

      if (!params.name || !params.fields) {
        return {
          success: false,
          error: 'name and fields are required',
          timestamp: new Date().toISOString()
        };
      }

      if (!Array.isArray(params.fields)) {
        return {
          success: false,
          error: 'fields must be an array',
          timestamp: new Date().toISOString()
        };
      }

      const template = engine.createTemplate({
        name: params.name,
        fields: params.fields,
        format: params.format || 'json',
        description: params.description,
        globalTransforms: params.globalTransforms,
        metadata: params.metadata,
        id: params.id
      });

      return {
        success: true,
        template,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * List export templates
   * GET /list_export_templates
   *
   * @param {Object} params - Filter parameters
   * @param {string} params.format - Filter by format
   * @param {string} params.search - Search templates by name/description
   * @returns {Object} { templates: [], count: number }
   */
  commandHandlers.list_export_templates = async (params = {}) => {
    try {
      const engine = getEngine();

      const filters = {
        format: params.format,
        search: params.search
      };

      const templates = engine.listTemplates(filters);

      return {
        success: true,
        templates,
        count: templates.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Get export template
   * GET /get_export_template
   *
   * @param {Object} params - Parameters
   * @param {string} params.templateId - Template ID
   * @returns {Object} { template: {} }
   */
  commandHandlers.get_export_template = async (params = {}) => {
    try {
      const engine = getEngine();

      if (!params.templateId) {
        return {
          success: false,
          error: 'templateId is required',
          timestamp: new Date().toISOString()
        };
      }

      const template = engine.getTemplate(params.templateId);

      return {
        success: true,
        template,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Export data with template
   * POST /export_with_template
   *
   * @param {Object} params - Parameters
   * @param {string} params.templateId - Template ID
   * @param {Object|Array} params.data - Data to export
   * @param {boolean} params.formatOutput - Format output (JSON string, CSV, XML)
   * @returns {Object} { data: {}, metadata: {} }
   */
  commandHandlers.export_with_template = async (params = {}) => {
    try {
      const engine = getEngine();

      if (!params.templateId) {
        return {
          success: false,
          error: 'templateId is required',
          timestamp: new Date().toISOString()
        };
      }

      if (!params.data) {
        return {
          success: false,
          error: 'data is required',
          timestamp: new Date().toISOString()
        };
      }

      const result = engine.exportWithTemplate(params.templateId, params.data);

      // Optionally format output
      if (params.formatOutput === true) {
        const template = engine.getTemplate(params.templateId);
        const formatted = engine.formatExport(result.data, template.format);
        return {
          success: true,
          data: formatted,
          format: template.format,
          metadata: result.metadata,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        data: result.data,
        metadata: result.metadata,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Update export template
   * POST /update_export_template
   *
   * @param {Object} params - Parameters
   * @param {string} params.templateId - Template ID
   * @param {Object} params.updates - Fields to update
   * @returns {Object} { template: {} }
   */
  commandHandlers.update_export_template = async (params = {}) => {
    try {
      const engine = getEngine();

      if (!params.templateId || !params.updates) {
        return {
          success: false,
          error: 'templateId and updates are required',
          timestamp: new Date().toISOString()
        };
      }

      const template = engine.updateTemplate(params.templateId, params.updates);

      return {
        success: true,
        template,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Delete export template
   * DELETE /delete_export_template
   *
   * @param {Object} params - Parameters
   * @param {string} params.templateId - Template ID
   * @returns {Object} { deleted: true }
   */
  commandHandlers.delete_export_template = async (params = {}) => {
    try {
      const engine = getEngine();

      if (!params.templateId) {
        return {
          success: false,
          error: 'templateId is required',
          timestamp: new Date().toISOString()
        };
      }

      const result = engine.deleteTemplate(params.templateId);

      return {
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Clone export template
   * POST /clone_export_template
   *
   * @param {Object} params - Parameters
   * @param {string} params.templateId - Template ID to clone
   * @param {string} params.newName - Name for cloned template
   * @returns {Object} { template: {} }
   */
  commandHandlers.clone_export_template = async (params = {}) => {
    try {
      const engine = getEngine();

      if (!params.templateId || !params.newName) {
        return {
          success: false,
          error: 'templateId and newName are required',
          timestamp: new Date().toISOString()
        };
      }

      const template = engine.cloneTemplate(params.templateId, params.newName);

      return {
        success: true,
        template,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Validate export template
   * POST /validate_export_template
   *
   * @param {Object} params - Parameters
   * @param {string} params.templateId - Template ID
   * @returns {Object} { valid: boolean, errors: [], warnings: [] }
   */
  commandHandlers.validate_export_template = async (params = {}) => {
    try {
      const engine = getEngine();

      if (!params.templateId) {
        return {
          success: false,
          error: 'templateId is required',
          timestamp: new Date().toISOString()
        };
      }

      const validation = engine.validateTemplate(params.templateId);

      return {
        success: true,
        ...validation,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Test export template with sample data
   * POST /test_export_template
   *
   * @param {Object} params - Parameters
   * @param {string} params.templateId - Template ID
   * @param {Object|Array} params.sampleData - Sample data for testing
   * @returns {Object} { success: boolean, preview: any, error?: string }
   */
  commandHandlers.test_export_template = async (params = {}) => {
    try {
      const engine = getEngine();

      if (!params.templateId) {
        return {
          success: false,
          error: 'templateId is required',
          timestamp: new Date().toISOString()
        };
      }

      if (!params.sampleData) {
        return {
          success: false,
          error: 'sampleData is required',
          timestamp: new Date().toISOString()
        };
      }

      const result = engine.testTemplate(params.templateId, params.sampleData);

      return {
        success: result.success,
        ...(result.success ? {
          preview: result.preview,
          metadata: result.metadata
        } : {
          error: result.error
        }),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Get available transforms
   * GET /get_export_transforms
   *
   * @returns {Object} { transforms: [], count: number }
   */
  commandHandlers.get_export_transforms = async (params = {}) => {
    try {
      const engine = getEngine();

      const transforms = engine.getTransforms();

      return {
        success: true,
        transforms,
        count: transforms.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Register custom transform
   * POST /register_custom_transform
   *
   * @param {Object} params - Parameters
   * @param {string} params.name - Transform name
   * @param {string} params.code - JavaScript code for transform function
   * @returns {Object} { registered: true }
   */
  commandHandlers.register_custom_transform = async (params = {}) => {
    try {
      const engine = getEngine();

      if (!params.name || !params.code) {
        return {
          success: false,
          error: 'name and code are required',
          timestamp: new Date().toISOString()
        };
      }

      // Create function from code string
      // Note: This is a simplified version - in production, use safer evaluation
      let transformFn;
      try {
        // Support both direct functions and curried functions
        // eslint-disable-next-line no-new-func
        transformFn = new Function('return ' + params.code)();
      } catch (e) {
        return {
          success: false,
          error: 'Invalid function code: ' + e.message,
          timestamp: new Date().toISOString()
        };
      }

      const result = engine.registerTransform(params.name, transformFn);

      return {
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Get export statistics
   * GET /get_export_template_stats
   *
   * @returns {Object} Statistics object
   */
  commandHandlers.get_export_template_stats = async (params = {}) => {
    try {
      const engine = getEngine();

      const stats = engine.getStatistics();

      return {
        success: true,
        stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Format exported data
   * POST /format_export_data
   *
   * @param {Object} params - Parameters
   * @param {Object|Array} params.data - Data to format
   * @param {string} params.format - Target format (json, csv, xml)
   * @returns {Object} { formatted: string }
   */
  commandHandlers.format_export_data = async (params = {}) => {
    try {
      const engine = getEngine();

      if (!params.data || !params.format) {
        return {
          success: false,
          error: 'data and format are required',
          timestamp: new Date().toISOString()
        };
      }

      const formatted = engine.formatExport(params.data, params.format);

      return {
        success: true,
        formatted,
        format: params.format,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  // Setup event forwarding
  const setupEventForwarding = () => {
    if (templateEngine) {
      templateEngine.on('template-created', (data) => {
        server.broadcast('export_template_event', { type: 'template-created', template: data });
      });

      templateEngine.on('template-updated', (data) => {
        server.broadcast('export_template_event', { type: 'template-updated', template: data });
      });

      templateEngine.on('template-deleted', (data) => {
        server.broadcast('export_template_event', { type: 'template-deleted', ...data });
      });

      templateEngine.on('export-completed', (data) => {
        server.broadcast('export_template_event', {
          type: 'export-completed',
          templateId: data.templateId,
          recordsExported: data.metadata.recordsExported
        });
      });
    }
  };

  // Setup events on first command that creates manager
  const originalCreate = commandHandlers.create_export_template;
  commandHandlers.create_export_template = async function (...args) {
    const result = await originalCreate.apply(this, args);
    setupEventForwarding();
    return result;
  };
}

module.exports = { registerExportTemplateCommands };
