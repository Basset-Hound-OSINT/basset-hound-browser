/**
 * WebSocket Commands for Profile Templates
 *
 * @module websocket/commands/profile-template-commands
 */

const { ProfileTemplateManager, TEMPLATE_CATEGORIES, RISK_LEVELS, ACTIVITY_PATTERNS } = require('../../profiles/profile-templates');

// Global template manager instance
let templateManager = null;

/**
 * Register profile template WebSocket commands
 */
function registerProfileTemplateCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  // Initialize manager
  if (!templateManager) {
    templateManager = new ProfileTemplateManager();
  }

  /**
   * List all profile templates
   *
   * Command: list_profile_templates
   * Params: { category?, riskLevel?, tags?, sortBy? }
   * Response: { templates: [] }
   */
  commandHandlers.list_profile_templates = async (params) => {
    try {
      const templates = templateManager.listTemplates(params || {});

      return {
        success: true,
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          riskLevel: t.riskLevel,
          activityPattern: t.activityPattern,
          tags: t.tags,
          usageCount: t.usageCount
        })),
        count: templates.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get specific template
   *
   * Command: get_profile_template
   * Params: { id: string }
   * Response: { template: {} }
   */
  commandHandlers.get_profile_template = async (params) => {
    try {
      if (!params.id) {
        throw new Error('id is required');
      }

      const template = templateManager.getTemplate(params.id);
      if (!template) {
        throw new Error(`Template not found: ${params.id}`);
      }

      return {
        success: true,
        template: templateManager.exportTemplate(params.id)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Search templates
   *
   * Command: search_profile_templates
   * Params: { query: string }
   * Response: { templates: [] }
   */
  commandHandlers.search_profile_templates = async (params) => {
    try {
      if (!params.query) {
        throw new Error('query is required');
      }

      const templates = templateManager.searchTemplates(params.query);

      return {
        success: true,
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          tags: t.tags
        })),
        count: templates.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Generate profile from template
   *
   * Command: generate_profile_from_template
   * Params: { templateId: string, customizations?: {} }
   * Response: { profile: {} }
   */
  commandHandlers.generate_profile_from_template = async (params) => {
    try {
      if (!params.templateId) {
        throw new Error('templateId is required');
      }

      const template = templateManager.getTemplate(params.templateId);
      if (!template) {
        throw new Error(`Template not found: ${params.templateId}`);
      }

      const profile = template.generateProfile(params.customizations || {});
      template.recordUsage();

      return {
        success: true,
        profile: profile
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Create custom template
   *
   * Command: create_profile_template
   * Params: { name, description?, category?, riskLevel?, ... }
   * Response: { template: {} }
   */
  commandHandlers.create_profile_template = async (params) => {
    try {
      if (!params.name) {
        throw new Error('name is required');
      }

      const template = templateManager.createCustomTemplate(params);

      return {
        success: true,
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          riskLevel: template.riskLevel
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Clone template
   *
   * Command: clone_profile_template
   * Params: { id: string, modifications?: {} }
   * Response: { template: {} }
   */
  commandHandlers.clone_profile_template = async (params) => {
    try {
      if (!params.id) {
        throw new Error('id is required');
      }

      const cloned = templateManager.cloneTemplate(params.id, params.modifications || {});

      return {
        success: true,
        template: {
          id: cloned.id,
          name: cloned.name,
          description: cloned.description
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Delete template
   *
   * Command: delete_profile_template
   * Params: { id: string }
   * Response: { success: true }
   */
  commandHandlers.delete_profile_template = async (params) => {
    try {
      if (!params.id) {
        throw new Error('id is required');
      }

      const deleted = templateManager.deleteTemplate(params.id);
      if (!deleted) {
        throw new Error(`Template not found: ${params.id}`);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Export template
   *
   * Command: export_profile_template
   * Params: { id: string }
   * Response: { template: {}, json: string }
   */
  commandHandlers.export_profile_template = async (params) => {
    try {
      if (!params.id) {
        throw new Error('id is required');
      }

      const exported = templateManager.exportTemplate(params.id);

      return {
        success: true,
        template: exported,
        json: JSON.stringify(exported, null, 2)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Import template
   *
   * Command: import_profile_template
   * Params: { template: {} } or { json: string }
   * Response: { template: {} }
   */
  commandHandlers.import_profile_template = async (params) => {
    try {
      let templateData;

      if (params.json) {
        templateData = JSON.parse(params.json);
      } else if (params.template) {
        templateData = params.template;
      } else {
        throw new Error('template or json is required');
      }

      const template = templateManager.importTemplate(templateData);

      return {
        success: true,
        template: {
          id: template.id,
          name: template.name,
          description: template.description
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get template statistics
   *
   * Command: get_profile_template_stats
   * Response: { stats: {} }
   */
  commandHandlers.get_profile_template_stats = async (params) => {
    try {
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
   * Get template categories
   *
   * Command: get_template_categories
   * Response: { categories: [] }
   */
  commandHandlers.get_template_categories = async (params) => {
    return {
      success: true,
      categories: Object.values(TEMPLATE_CATEGORIES)
    };
  };

  /**
   * Get risk levels
   *
   * Command: get_template_risk_levels
   * Response: { riskLevels: [] }
   */
  commandHandlers.get_template_risk_levels = async (params) => {
    return {
      success: true,
      riskLevels: Object.values(RISK_LEVELS)
    };
  };

  /**
   * Get activity patterns
   *
   * Command: get_template_activity_patterns
   * Response: { activityPatterns: [] }
   */
  commandHandlers.get_template_activity_patterns = async (params) => {
    return {
      success: true,
      activityPatterns: Object.values(ACTIVITY_PATTERNS)
    };
  };
}

module.exports = { registerProfileTemplateCommands };
