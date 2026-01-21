/**
 * WebSocket Commands for Data Extraction Templates
 *
 * Phase 31: Data Extraction Templates
 *
 * Provides commands for template-based data extraction with support for
 * CSS selectors, XPath, regex patterns, and pre-built platform templates.
 *
 * @module websocket/commands/extraction-commands
 */

const { TemplateManager, BUILT_IN_TEMPLATES } = require('../../extraction/template-manager');

// Global template manager instance
let templateManager = null;

/**
 * Register data extraction template WebSocket commands
 */
function registerExtractionCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  /**
   * Create extraction template
   *
   * Command: create_extraction_template
   * Params: {
   *   name: string,
   *   fields: {},
   *   platform?: string,
   *   type?: string,
   *   metadata?: {}
   * }
   * Response: { template: {} }
   */
  commandHandlers.create_extraction_template = async (params) => {
    try {
      if (!templateManager) {
        templateManager = new TemplateManager(mainWindow.webContents);
      }

      if (!params.name || !params.fields) {
        throw new Error('name and fields are required');
      }

      const template = templateManager.createTemplate({
        name: params.name,
        fields: params.fields,
        platform: params.platform,
        type: params.type,
        metadata: params.metadata
      });

      return {
        success: true,
        template: template
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Use/extract with template
   *
   * Command: use_extraction_template
   * Params: { templateId: string }
   * Response: { data: {}, errors: [] }
   */
  commandHandlers.use_extraction_template = async (params) => {
    try {
      if (!templateManager) {
        templateManager = new TemplateManager(mainWindow.webContents);
      }

      if (!params.templateId) {
        throw new Error('templateId is required');
      }

      const result = await templateManager.extractWithTemplate(params.templateId);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Extract data with template (alias for use_extraction_template)
   *
   * Command: extract_with_template
   * Params: { templateId: string }
   * Response: { data: {}, errors: [] }
   */
  commandHandlers.extract_with_template = async (params) => {
    try {
      if (!templateManager) {
        templateManager = new TemplateManager(mainWindow.webContents);
      }

      if (!params.templateId) {
        throw new Error('templateId is required');
      }

      const result = await templateManager.extractWithTemplate(params.templateId);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * List extraction templates
   *
   * Command: list_extraction_templates
   * Params: { platform?: string, type?: string, builtin?: boolean }
   * Response: { templates: [], count: number }
   */
  commandHandlers.list_extraction_templates = async (params) => {
    try {
      if (!templateManager) {
        templateManager = new TemplateManager(mainWindow.webContents);
      }

      const filters = {
        platform: params.platform,
        type: params.type,
        builtin: params.builtin
      };

      const templates = templateManager.listTemplates(filters);

      return {
        success: true,
        templates: templates,
        count: templates.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get extraction template
   *
   * Command: get_extraction_template
   * Params: { templateId: string }
   * Response: { template: {} }
   */
  commandHandlers.get_extraction_template = async (params) => {
    try {
      if (!templateManager) {
        templateManager = new TemplateManager(mainWindow.webContents);
      }

      if (!params.templateId) {
        throw new Error('templateId is required');
      }

      const template = templateManager.getTemplate(params.templateId);

      return {
        success: true,
        template: template
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Update extraction template
   *
   * Command: update_extraction_template
   * Params: { templateId: string, updates: {} }
   * Response: { template: {} }
   */
  commandHandlers.update_extraction_template = async (params) => {
    try {
      if (!templateManager) {
        templateManager = new TemplateManager(mainWindow.webContents);
      }

      if (!params.templateId || !params.updates) {
        throw new Error('templateId and updates are required');
      }

      const template = templateManager.updateTemplate(params.templateId, params.updates);

      return {
        success: true,
        template: template
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Delete extraction template
   *
   * Command: delete_extraction_template
   * Params: { templateId: string }
   * Response: { deleted: true }
   */
  commandHandlers.delete_extraction_template = async (params) => {
    try {
      if (!templateManager) {
        templateManager = new TemplateManager(mainWindow.webContents);
      }

      if (!params.templateId) {
        throw new Error('templateId is required');
      }

      const result = templateManager.deleteTemplate(params.templateId);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Validate extraction template
   *
   * Command: validate_extraction_template
   * Params: { templateId: string }
   * Response: { valid: boolean }
   */
  commandHandlers.validate_extraction_template = async (params) => {
    try {
      if (!templateManager) {
        templateManager = new TemplateManager(mainWindow.webContents);
      }

      if (!params.templateId) {
        throw new Error('templateId is required');
      }

      const result = templateManager.validateTemplate(params.templateId);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Extract bulk data
   *
   * Command: extract_bulk
   * Params: { templateId: string, containerSelector: string }
   * Response: { items: [], count: number }
   */
  commandHandlers.extract_bulk = async (params) => {
    try {
      if (!templateManager) {
        templateManager = new TemplateManager(mainWindow.webContents);
      }

      if (!params.templateId || !params.containerSelector) {
        throw new Error('templateId and containerSelector are required');
      }

      const result = await templateManager.extractBulk(
        params.templateId,
        params.containerSelector
      );

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get extraction statistics
   *
   * Command: get_extraction_stats
   * Response: { stats: {} }
   */
  commandHandlers.get_extraction_stats = async (params) => {
    try {
      if (!templateManager) {
        templateManager = new TemplateManager(mainWindow.webContents);
      }

      const stats = templateManager.getStatistics();

      return {
        success: true,
        stats: stats
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Clone extraction template
   *
   * Command: clone_extraction_template
   * Params: { templateId: string, newName: string }
   * Response: { template: {} }
   */
  commandHandlers.clone_extraction_template = async (params) => {
    try {
      if (!templateManager) {
        templateManager = new TemplateManager(mainWindow.webContents);
      }

      if (!params.templateId || !params.newName) {
        throw new Error('templateId and newName are required');
      }

      const template = templateManager.cloneTemplate(params.templateId, params.newName);

      return {
        success: true,
        template: template
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Setup event forwarding
  const setupEventForwarding = () => {
    if (templateManager) {
      templateManager.on('template-created', (data) => {
        server.broadcast('extraction_event', { type: 'template-created', template: data });
      });

      templateManager.on('template-updated', (data) => {
        server.broadcast('extraction_event', { type: 'template-updated', template: data });
      });

      templateManager.on('template-deleted', (data) => {
        server.broadcast('extraction_event', { type: 'template-deleted', ...data });
      });

      templateManager.on('extraction-completed', (data) => {
        server.broadcast('extraction_event', {
          type: 'extraction-completed',
          templateId: data.templateId,
          fieldCount: Object.keys(data.data).length
        });
      });
    }
  };

  // Setup events on first command that creates manager
  const originalCreateTemplate = server.commandHandlers.create_extraction_template;
  server.commandHandlers.create_extraction_template = async function(...args) {
    const result = await originalCreateTemplate.apply(this, args);
    setupEventForwarding();
    return result;
  };
}

module.exports = { registerExtractionCommands };
