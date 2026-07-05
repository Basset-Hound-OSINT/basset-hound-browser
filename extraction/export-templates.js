/**
 * Export Template Engine
 *
 * Feature Area: Export & Analysis - Category 2
 *
 * Provides advanced export templating with field mapping, transformations,
 * and conditional exports. Enables custom export formats tailored to specific
 * analysis workflows.
 *
 * Features:
 * - Field mapping and renaming
 * - Data transformations (filters, aggregations, formatting)
 * - Conditional field inclusion/exclusion
 * - Template validation and testing
 * - Reusable export templates
 * - Export format support (JSON, CSV, XML)
 *
 * @module extraction/export-templates
 */

const EventEmitter = require('events');

/**
 * Built-in data transformations
 */
const BUILT_IN_TRANSFORMS = {
  // String transforms
  uppercase: (val) => typeof val === 'string' ? val.toUpperCase() : val,
  lowercase: (val) => typeof val === 'string' ? val.toLowerCase() : val,
  trim: (val) => typeof val === 'string' ? val.trim() : val,
  truncate: (len) => (val) => typeof val === 'string' && val.length > len ? val.substring(0, len) + '...' : val,

  // Number transforms
  round: (decimals = 0) => (val) => typeof val === 'number' ? Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals) : val,
  absolute: (val) => typeof val === 'number' ? Math.abs(val) : val,
  multiply: (factor) => (val) => typeof val === 'number' ? val * factor : val,
  divide: (divisor) => (val) => typeof val === 'number' ? val / divisor : val,

  // Array transforms
  join: (separator = ',') => (val) => Array.isArray(val) ? val.join(separator) : val,
  split: (separator = ',') => (val) => typeof val === 'string' ? val.split(separator) : val,
  length: (val) => Array.isArray(val) ? val.length : (typeof val === 'string' ? val.length : 0),
  first: (val) => Array.isArray(val) && val.length > 0 ? val[0] : val,
  last: (val) => Array.isArray(val) && val.length > 0 ? val[val.length - 1] : val,

  // Date transforms
  toISOString: (val) => val instanceof Date ? val.toISOString() : val,
  timestamp: (val) => val instanceof Date ? val.getTime() : val,
  formatDate: (format = 'YYYY-MM-DD') => (val) => {
    if (!(val instanceof Date)) return val;
    // Simple date formatter - ISO by default
    return val.toISOString().split('T')[0];
  },

  // JSON transforms
  stringify: (val) => typeof val === 'object' ? JSON.stringify(val) : val,
  parse: (val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch (e) {
        return val;
      }
    }
    return val;
  },

  // Conditional transforms
  defaultValue: (defaultVal) => (val) => val === null || val === undefined ? defaultVal : val,
  coalesce: (...values) => (val) => val === null || val === undefined ? values.find(v => v !== null && v !== undefined) : val,

  // Custom filter transform
  filter: (predicate) => (val) => {
    if (Array.isArray(val)) {
      return typeof predicate === 'function' ? val.filter(predicate) : val;
    }
    return val;
  },

  // Map transform
  map: (mapper) => (val) => {
    if (Array.isArray(val)) {
      return typeof mapper === 'function' ? val.map(mapper) : val;
    }
    return val;
  }
};

/**
 * Export Template Engine
 * Manages custom export templates with field mapping, transforms, and conditions
 */
class ExportTemplateEngine extends EventEmitter {
  constructor() {
    super();

    this.templates = new Map();
    this.transforms = new Map();
    this.exportHistory = [];

    // Load built-in transforms
    this._loadBuiltInTransforms();

    // Statistics
    this.stats = {
      templatesCreated: 0,
      exportsPerformed: 0,
      transformsApplied: 0,
      totalRecordsExported: 0
    };
  }

  /**
   * Load built-in transforms
   */
  _loadBuiltInTransforms() {
    for (const [name, transform] of Object.entries(BUILT_IN_TRANSFORMS)) {
      this.transforms.set(name, transform);
    }
  }

  /**
   * Create export template
   *
   * @param {Object} options - Template configuration
   * @param {string} options.name - Template name
   * @param {Array} options.fields - Field mappings
   * @param {string} options.format - Export format (json, csv, xml)
   * @param {Object} options.metadata - Template metadata
   * @returns {Object} Created template
   */
  createTemplate(options) {
    if (!options.name || !options.fields) {
      throw new Error('name and fields are required');
    }

    if (!Array.isArray(options.fields)) {
      throw new Error('fields must be an array');
    }

    const templateId = options.id || this._generateTemplateId(options.name);

    const template = {
      id: templateId,
      name: options.name,
      description: options.description || '',
      format: options.format || 'json',
      fields: options.fields,
      globalTransforms: options.globalTransforms || [],
      metadata: options.metadata || {},
      created: Date.now(),
      modified: null,
      version: 1
    };

    // Validate template
    this._validateTemplate(template);

    this.templates.set(templateId, template);
    this.stats.templatesCreated++;

    this.emit('template-created', template);

    return template;
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return template;
  }

  /**
   * List all templates
   */
  listTemplates(filters = {}) {
    let templates = Array.from(this.templates.values());

    if (filters.format) {
      templates = templates.filter(t => t.format === filters.format);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower)
      );
    }

    return templates;
  }

  /**
   * Update template
   */
  updateTemplate(templateId, updates) {
    const template = this.getTemplate(templateId);

    const updatedTemplate = {
      ...template,
      ...updates,
      id: templateId,
      modified: Date.now(),
      version: template.version + 1
    };

    this._validateTemplate(updatedTemplate);

    this.templates.set(templateId, updatedTemplate);

    this.emit('template-updated', updatedTemplate);

    return updatedTemplate;
  }

  /**
   * Delete template
   */
  deleteTemplate(templateId) {
    const template = this.getTemplate(templateId);
    this.templates.delete(templateId);

    this.emit('template-deleted', { id: templateId });

    return { deleted: true, id: templateId };
  }

  /**
   * Clone template
   */
  cloneTemplate(templateId, newName) {
    const template = this.getTemplate(templateId);

    const clonedTemplate = {
      ...template,
      id: this._generateTemplateId(newName),
      name: newName,
      created: Date.now(),
      modified: null,
      version: 1
    };

    this.templates.set(clonedTemplate.id, clonedTemplate);
    this.stats.templatesCreated++;

    return clonedTemplate;
  }

  /**
   * Register custom transform
   */
  registerTransform(name, transformFn) {
    if (typeof transformFn !== 'function') {
      throw new Error('Transform must be a function');
    }

    this.transforms.set(name, transformFn);

    return { registered: true, name };
  }

  /**
   * Get registered transforms
   */
  getTransforms() {
    return Array.from(this.transforms.keys());
  }

  /**
   * Export data with template
   *
   * @param {string} templateId - Template ID
   * @param {Object} data - Data to export
   * @returns {Object} Exported data with metadata
   */
  exportWithTemplate(templateId, data) {
    const template = this.getTemplate(templateId);

    if (!data || typeof data !== 'object') {
      throw new Error('Data must be an object');
    }

    const exportedData = Array.isArray(data) ?
      data.map(item => this._processRecord(item, template)) :
      this._processRecord(data, template);

    const result = {
      templateId,
      templateName: template.name,
      format: template.format,
      data: exportedData,
      metadata: {
        recordsExported: Array.isArray(exportedData) ? exportedData.length : 1,
        fieldsIncluded: template.fields.length,
        transformsApplied: this._countTransforms(template),
        timestamp: new Date().toISOString()
      }
    };

    this.exportHistory.push(result);
    this.stats.exportsPerformed++;
    this.stats.totalRecordsExported += result.metadata.recordsExported;

    this.emit('export-completed', result);

    return result;
  }

  /**
   * Validate template syntax
   */
  validateTemplate(templateId) {
    const template = this.getTemplate(templateId);
    const errors = [];
    const warnings = [];

    // Validate fields
    if (!Array.isArray(template.fields) || template.fields.length === 0) {
      errors.push('Template must have at least one field');
    }

    template.fields.forEach((field, idx) => {
      // Check required properties
      if (!field.source) {
        errors.push(`Field ${idx}: source is required`);
      }

      // Validate transforms exist
      if (field.transforms && Array.isArray(field.transforms)) {
        field.transforms.forEach((transform, tidx) => {
          const transformName = typeof transform === 'string' ? transform : transform.name;
          if (!this.transforms.has(transformName)) {
            errors.push(`Field ${idx} transform ${tidx}: Unknown transform '${transformName}'`);
          }
        });
      }

      // Check for unused fields
      if (!field.target) {
        warnings.push(`Field ${idx} (${field.source}): No target specified, using source name`);
      }
    });

    // Validate format
    const validFormats = ['json', 'csv', 'xml'];
    if (!validFormats.includes(template.format)) {
      errors.push(`Invalid format: ${template.format}. Valid formats: ${validFormats.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test template with sample data
   */
  testTemplate(templateId, sampleData) {
    const template = this.getTemplate(templateId);

    try {
      const result = this.exportWithTemplate(templateId, sampleData);
      return {
        success: true,
        preview: Array.isArray(result.data) ? result.data.slice(0, 1) : result.data,
        metadata: result.metadata
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convert to export format
   */
  formatExport(data, format) {
    switch (format.toLowerCase()) {
    case 'csv':
      return this._formatAsCSV(data);
    case 'xml':
      return this._formatAsXML(data);
    case 'json':
    default:
      return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Get export statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      totalTemplates: this.templates.size,
      registeredTransforms: this.transforms.size,
      exportHistory: this.exportHistory.length
    };
  }

  /**
   * Process single record with template
   */
  _processRecord(record, template) {
    const result = {};

    for (const fieldConfig of template.fields) {
      const value = this._getFieldValue(record, fieldConfig.source);

      // Apply conditions
      if (fieldConfig.condition) {
        if (!this._evaluateCondition(record, fieldConfig.condition)) {
          continue; // Skip field if condition not met
        }
      }

      // Skip if value is null/undefined and field is optional
      if ((value === null || value === undefined) && !fieldConfig.required) {
        if (fieldConfig.includeNull) {
          result[fieldConfig.target || fieldConfig.source] = null;
        }
        continue;
      }

      // Apply transforms
      let transformedValue = value;
      if (fieldConfig.transforms && Array.isArray(fieldConfig.transforms)) {
        transformedValue = this._applyTransforms(value, fieldConfig.transforms);
        this.stats.transformsApplied++;
      }

      // Apply global transforms
      if (template.globalTransforms && Array.isArray(template.globalTransforms)) {
        transformedValue = this._applyTransforms(transformedValue, template.globalTransforms);
      }

      result[fieldConfig.target || fieldConfig.source] = transformedValue;
    }

    return result;
  }

  /**
   * Get field value from record
   */
  _getFieldValue(record, source) {
    // Support nested paths: "user.name" -> record.user.name
    const parts = source.split('.');
    let value = record;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return null;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Apply transforms to value
   */
  _applyTransforms(value, transforms) {
    let result = value;

    for (const transformConfig of transforms) {
      const transformName = typeof transformConfig === 'string' ? transformConfig : transformConfig.name;
      const args = typeof transformConfig === 'string' ? [] : (transformConfig.args || []);

      const transform = this.transforms.get(transformName);
      if (!transform) {
        console.warn(`Unknown transform: ${transformName}`);
        continue;
      }

      try {
        // Apply transform (handle both curried and direct transforms)
        let transformFn = transform;
        if (args.length > 0) {
          // Curried transform - call with args
          transformFn = transform(...args);
        }

        if (typeof transformFn === 'function') {
          result = transformFn(result);
        } else {
          result = transformFn;
        }
      } catch (error) {
        console.error(`Error applying transform ${transformName}:`, error);
      }
    }

    return result;
  }

  /**
   * Evaluate conditional expression
   */
  _evaluateCondition(record, condition) {
    if (!condition) {
      return true;
    }

    const { field, operator, value } = condition;
    const fieldValue = this._getFieldValue(record, field);

    switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'notEquals':
      return fieldValue !== value;
    case 'greaterThan':
      return fieldValue > value;
    case 'lessThan':
      return fieldValue < value;
    case 'greaterThanOrEqual':
      return fieldValue >= value;
    case 'lessThanOrEqual':
      return fieldValue <= value;
    case 'in':
      return Array.isArray(value) ? value.includes(fieldValue) : false;
    case 'notIn':
      return Array.isArray(value) ? !value.includes(fieldValue) : true;
    case 'contains':
      return typeof fieldValue === 'string' ? fieldValue.includes(value) : false;
    case 'exists':
      return fieldValue !== null && fieldValue !== undefined;
    case 'notExists':
      return fieldValue === null || fieldValue === undefined;
    default:
      return true;
    }
  }

  /**
   * Count transforms in template
   */
  _countTransforms(template) {
    let count = template.globalTransforms?.length || 0;
    count += template.fields.reduce((sum, field) => sum + (field.transforms?.length || 0), 0);
    return count;
  }

  /**
   * Validate template structure
   */
  _validateTemplate(template) {
    if (!template.name) {
      throw new Error('Template must have a name');
    }

    if (!Array.isArray(template.fields)) {
      throw new Error('Template fields must be an array');
    }

    if (template.fields.length === 0) {
      throw new Error('Template must have at least one field');
    }

    const validFormats = ['json', 'csv', 'xml'];
    if (!validFormats.includes(template.format)) {
      throw new Error(`Invalid format: ${template.format}`);
    }

    for (let i = 0; i < template.fields.length; i++) {
      const field = template.fields[i];
      if (!field.source) {
        throw new Error(`Field ${i}: source is required`);
      }
    }

    return { valid: true };
  }

  /**
   * Generate template ID
   */
  _generateTemplateId(name) {
    // Add random component to ensure uniqueness
    const random = Math.random().toString(36).substring(2, 8);
    const timestamp = Date.now().toString(36);
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + timestamp + random;
  }

  /**
   * Format as CSV
   */
  _formatAsCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const rows = data.map(obj =>
      headers.map(h => {
        const val = obj[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Format as XML
   */
  _formatAsXML(data) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';

    if (Array.isArray(data)) {
      data.forEach(item => {
        xml += '  <record>\n';
        for (const [key, value] of Object.entries(item)) {
          const escapedKey = this._escapeXML(key);
          const escapedValue = this._escapeXML(String(value));
          xml += `    <${escapedKey}>${escapedValue}</${escapedKey}>\n`;
        }
        xml += '  </record>\n';
      });
    } else {
      xml += '  <item>\n';
      for (const [key, value] of Object.entries(data)) {
        const escapedKey = this._escapeXML(key);
        const escapedValue = this._escapeXML(String(value));
        xml += `    <${escapedKey}>${escapedValue}</${escapedKey}>\n`;
      }
      xml += '  </item>\n';
    }

    xml += '</root>';
    return xml;
  }

  /**
   * Escape XML special characters
   */
  _escapeXML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = {
  ExportTemplateEngine,
  BUILT_IN_TRANSFORMS
};
