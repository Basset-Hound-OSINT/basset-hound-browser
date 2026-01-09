/**
 * Template Manager
 *
 * Phase 31: Data Extraction Templates
 *
 * Provides template-based data extraction with pre-built templates for
 * common platforms (LinkedIn, Twitter, Facebook, GitHub, etc.) and support
 * for custom template creation.
 *
 * Features:
 * - CSS selector-based extraction
 * - XPath extraction support
 * - Regex pattern extraction
 * - Pre-built platform templates
 * - Custom template creation
 * - Template validation
 * - Bulk extraction
 *
 * @module extraction/template-manager
 */

const EventEmitter = require('events');

/**
 * Pre-built extraction templates
 */
const BUILT_IN_TEMPLATES = {
  'linkedin-profile': {
    name: 'LinkedIn Profile',
    platform: 'linkedin',
    type: 'profile',
    fields: {
      name: {
        selector: 'h1.text-heading-xlarge',
        attribute: 'textContent',
        required: true
      },
      headline: {
        selector: 'div.text-body-medium',
        attribute: 'textContent'
      },
      location: {
        selector: 'span.text-body-small.inline.t-black--light.break-words',
        attribute: 'textContent'
      },
      about: {
        selector: 'div.display-flex.ph5.pv3 span[aria-hidden="true"]',
        attribute: 'textContent'
      },
      connections: {
        selector: 'li.text-body-small a[href*="connections"]',
        attribute: 'textContent',
        transform: 'extractNumber'
      },
      profileUrl: {
        selector: 'meta[property="og:url"]',
        attribute: 'content'
      }
    }
  },

  'linkedin-company': {
    name: 'LinkedIn Company',
    platform: 'linkedin',
    type: 'company',
    fields: {
      companyName: {
        selector: 'h1.org-top-card-summary__title',
        attribute: 'textContent',
        required: true
      },
      tagline: {
        selector: 'p.org-top-card-summary__tagline',
        attribute: 'textContent'
      },
      industry: {
        selector: 'div.org-top-card-summary-info-list__info-item',
        attribute: 'textContent'
      },
      companySize: {
        selector: 'dd.org-about-company-module__company-size-definition-text',
        attribute: 'textContent'
      },
      website: {
        selector: 'a.link-without-visited-state.org-top-card-primary-actions__url',
        attribute: 'href'
      },
      headquarters: {
        selector: 'dd.org-about-company-module__headquarters',
        attribute: 'textContent'
      }
    }
  },

  'twitter-profile': {
    name: 'Twitter/X Profile',
    platform: 'twitter',
    type: 'profile',
    fields: {
      name: {
        selector: 'div[data-testid="UserName"] span',
        attribute: 'textContent',
        required: true
      },
      username: {
        selector: 'div[data-testid="UserName"] a span',
        attribute: 'textContent'
      },
      bio: {
        selector: 'div[data-testid="UserDescription"]',
        attribute: 'textContent'
      },
      location: {
        selector: 'span[data-testid="UserLocation"]',
        attribute: 'textContent'
      },
      website: {
        selector: 'a[data-testid="UserUrl"]',
        attribute: 'href'
      },
      joinDate: {
        selector: 'span[data-testid="UserJoinDate"]',
        attribute: 'textContent'
      },
      following: {
        selector: 'a[href$="/following"] span',
        attribute: 'textContent',
        transform: 'extractNumber'
      },
      followers: {
        selector: 'a[href$="/followers"] span',
        attribute: 'textContent',
        transform: 'extractNumber'
      }
    }
  },

  'twitter-tweet': {
    name: 'Twitter/X Tweet',
    platform: 'twitter',
    type: 'tweet',
    fields: {
      author: {
        selector: 'div[data-testid="User-Name"] a',
        attribute: 'textContent'
      },
      text: {
        selector: 'div[data-testid="tweetText"]',
        attribute: 'textContent',
        required: true
      },
      timestamp: {
        selector: 'time',
        attribute: 'datetime'
      },
      retweets: {
        selector: 'button[data-testid="retweet"] span',
        attribute: 'textContent',
        transform: 'extractNumber'
      },
      likes: {
        selector: 'button[data-testid="like"] span',
        attribute: 'textContent',
        transform: 'extractNumber'
      },
      replies: {
        selector: 'button[data-testid="reply"] span',
        attribute: 'textContent',
        transform: 'extractNumber'
      }
    }
  },

  'facebook-profile': {
    name: 'Facebook Profile',
    platform: 'facebook',
    type: 'profile',
    fields: {
      name: {
        selector: 'h1',
        attribute: 'textContent',
        required: true
      },
      bio: {
        selector: 'div.x1iorvi4.xjkvuk6.x4uap5',
        attribute: 'textContent'
      },
      profileUrl: {
        selector: 'meta[property="og:url"]',
        attribute: 'content'
      },
      profileImage: {
        selector: 'image',
        attribute: 'href'
      }
    }
  },

  'github-profile': {
    name: 'GitHub Profile',
    platform: 'github',
    type: 'profile',
    fields: {
      name: {
        selector: 'span.p-name.vcard-fullname',
        attribute: 'textContent',
        required: true
      },
      username: {
        selector: 'span.p-nickname.vcard-username',
        attribute: 'textContent'
      },
      bio: {
        selector: 'div.p-note.user-profile-bio',
        attribute: 'textContent'
      },
      company: {
        selector: 'span.p-org',
        attribute: 'textContent'
      },
      location: {
        selector: 'span.p-label',
        attribute: 'textContent'
      },
      website: {
        selector: 'a.Link--primary',
        attribute: 'href'
      },
      followers: {
        selector: 'a[href$="tab=followers"] span',
        attribute: 'textContent',
        transform: 'extractNumber'
      },
      following: {
        selector: 'a[href$="tab=following"] span',
        attribute: 'textContent',
        transform: 'extractNumber'
      },
      repositories: {
        selector: 'span.Counter',
        attribute: 'textContent',
        transform: 'extractNumber'
      }
    }
  },

  'github-repository': {
    name: 'GitHub Repository',
    platform: 'github',
    type: 'repository',
    fields: {
      name: {
        selector: 'strong[itemprop="name"] a',
        attribute: 'textContent',
        required: true
      },
      description: {
        selector: 'p.f4.my-3',
        attribute: 'textContent'
      },
      stars: {
        selector: '#repo-stars-counter-star',
        attribute: 'textContent',
        transform: 'extractNumber'
      },
      forks: {
        selector: '#repo-network-counter',
        attribute: 'textContent',
        transform: 'extractNumber'
      },
      language: {
        selector: 'span[itemprop="programmingLanguage"]',
        attribute: 'textContent'
      },
      license: {
        selector: 'a[data-analytics-event*="license"]',
        attribute: 'textContent'
      },
      topics: {
        selector: 'a.topic-tag',
        attribute: 'textContent',
        multiple: true
      }
    }
  },

  'article-generic': {
    name: 'Generic Article',
    platform: 'generic',
    type: 'article',
    fields: {
      title: {
        selectors: ['h1', 'meta[property="og:title"]', 'meta[name="title"]'],
        attribute: 'content|textContent',
        required: true
      },
      author: {
        selectors: ['meta[name="author"]', 'a[rel="author"]', '.author'],
        attribute: 'content|textContent'
      },
      publishDate: {
        selectors: ['meta[property="article:published_time"]', 'time', '.date'],
        attribute: 'content|datetime|textContent'
      },
      description: {
        selectors: ['meta[property="og:description"]', 'meta[name="description"]'],
        attribute: 'content'
      },
      content: {
        selectors: ['article', '.article-content', '.post-content', 'main'],
        attribute: 'textContent'
      },
      image: {
        selectors: ['meta[property="og:image"]', 'article img'],
        attribute: 'content|src'
      },
      url: {
        selector: 'meta[property="og:url"]',
        attribute: 'content'
      }
    }
  }
};

/**
 * Template Manager
 * Manages extraction templates and performs data extraction
 */
class TemplateManager extends EventEmitter {
  constructor(webContents) {
    super();

    this.webContents = webContents;
    this.templates = new Map();
    this.extractionHistory = [];

    // Load built-in templates
    this._loadBuiltInTemplates();

    // Statistics
    this.stats = {
      templatesCreated: 0,
      extractionsPerformed: 0,
      bulkExtractions: 0,
      fieldsExtracted: 0
    };
  }

  /**
   * Load built-in templates
   */
  _loadBuiltInTemplates() {
    for (const [id, template] of Object.entries(BUILT_IN_TEMPLATES)) {
      this.templates.set(id, {
        id,
        ...template,
        builtin: true,
        created: Date.now()
      });
    }
  }

  /**
   * Create custom extraction template
   */
  createTemplate(options) {
    if (!options.name || !options.fields) {
      throw new Error('name and fields are required');
    }

    const templateId = options.id || this._generateTemplateId(options.name);

    if (this.templates.has(templateId) && this.templates.get(templateId).builtin) {
      throw new Error(`Cannot overwrite built-in template: ${templateId}`);
    }

    const template = {
      id: templateId,
      name: options.name,
      platform: options.platform || 'custom',
      type: options.type || 'custom',
      fields: options.fields,
      metadata: options.metadata || {},
      builtin: false,
      created: Date.now()
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

    if (filters.platform) {
      templates = templates.filter(t => t.platform === filters.platform);
    }
    if (filters.type) {
      templates = templates.filter(t => t.type === filters.type);
    }
    if (filters.builtin !== undefined) {
      templates = templates.filter(t => t.builtin === filters.builtin);
    }

    return templates;
  }

  /**
   * Update template
   */
  updateTemplate(templateId, updates) {
    const template = this.getTemplate(templateId);

    if (template.builtin) {
      throw new Error('Cannot update built-in template');
    }

    const updatedTemplate = {
      ...template,
      ...updates,
      id: templateId, // Keep original ID
      builtin: false,
      modified: Date.now()
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

    if (template.builtin) {
      throw new Error('Cannot delete built-in template');
    }

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
      builtin: false,
      created: Date.now()
    };

    delete clonedTemplate.modified;

    this.templates.set(clonedTemplate.id, clonedTemplate);
    this.stats.templatesCreated++;

    return clonedTemplate;
  }

  /**
   * Extract data using template
   */
  async extractWithTemplate(templateId) {
    const template = this.getTemplate(templateId);

    const extractedData = {};
    const errors = [];

    for (const [fieldName, fieldConfig] of Object.entries(template.fields)) {
      try {
        const value = await this._extractField(fieldConfig);

        if (value !== null) {
          extractedData[fieldName] = value;
        } else if (fieldConfig.required) {
          errors.push(`Required field '${fieldName}' not found`);
        }
      } catch (error) {
        errors.push(`Error extracting '${fieldName}': ${error.message}`);
      }
    }

    const result = {
      templateId,
      templateName: template.name,
      data: extractedData,
      errors: errors,
      timestamp: Date.now(),
      url: await this.webContents.getURL()
    };

    this.extractionHistory.push(result);
    this.stats.extractionsPerformed++;
    this.stats.fieldsExtracted += Object.keys(extractedData).length;

    this.emit('extraction-completed', result);

    return result;
  }

  /**
   * Extract bulk data (multiple items with same template)
   */
  async extractBulk(templateId, containerSelector) {
    const template = this.getTemplate(templateId);

    const script = `
      (function() {
        const containers = document.querySelectorAll('${containerSelector}');
        return Array.from(containers).map((container, index) => ({
          index,
          html: container.outerHTML
        }));
      })();
    `;

    const containers = await this.webContents.executeJavaScript(script);

    const results = [];

    for (const container of containers) {
      // Create temporary element to extract from
      const extractScript = `
        (function() {
          const div = document.createElement('div');
          div.innerHTML = ${JSON.stringify(container.html)};
          document.body.appendChild(div);
          return div;
        })();
      `;

      // Extract data from this container
      const data = {};

      for (const [fieldName, fieldConfig] of Object.entries(template.fields)) {
        try {
          const value = await this._extractField(fieldConfig, container.html);
          if (value !== null) {
            data[fieldName] = value;
          }
        } catch (error) {
          // Skip field on error
        }
      }

      if (Object.keys(data).length > 0) {
        results.push(data);
      }
    }

    this.stats.bulkExtractions++;
    this.stats.extractionsPerformed++;
    this.stats.fieldsExtracted += results.reduce((sum, r) => sum + Object.keys(r).length, 0);

    return {
      templateId,
      templateName: template.name,
      items: results,
      count: results.length,
      timestamp: Date.now()
    };
  }

  /**
   * Validate template
   */
  validateTemplate(templateId) {
    const template = this.getTemplate(templateId);
    return this._validateTemplate(template);
  }

  /**
   * Get extraction statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      totalTemplates: this.templates.size,
      builtinTemplates: Array.from(this.templates.values()).filter(t => t.builtin).length,
      customTemplates: Array.from(this.templates.values()).filter(t => !t.builtin).length,
      extractionHistory: this.extractionHistory.length
    };
  }

  /**
   * Extract field value
   */
  async _extractField(fieldConfig, contextHtml = null) {
    let selector = fieldConfig.selector;
    let selectors = fieldConfig.selectors || [selector];

    // Try each selector until we find a match
    for (const sel of selectors) {
      const script = contextHtml
        ? this._generateContextExtractionScript(sel, fieldConfig, contextHtml)
        : this._generateExtractionScript(sel, fieldConfig);

      try {
        const value = await this.webContents.executeJavaScript(script);

        if (value !== null && value !== undefined && value !== '') {
          return this._transformValue(value, fieldConfig.transform);
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }

    return null;
  }

  /**
   * Generate extraction script
   */
  _generateExtractionScript(selector, fieldConfig) {
    const multiple = fieldConfig.multiple;
    const attribute = fieldConfig.attribute || 'textContent';

    if (multiple) {
      return `
        (function() {
          const elements = document.querySelectorAll('${selector}');
          return Array.from(elements).map(el => {
            ${this._generateAttributeAccess('el', attribute)}
          }).filter(v => v);
        })();
      `;
    } else {
      return `
        (function() {
          const el = document.querySelector('${selector}');
          if (!el) return null;
          ${this._generateAttributeAccess('el', attribute)}
        })();
      `;
    }
  }

  /**
   * Generate context extraction script
   */
  _generateContextExtractionScript(selector, fieldConfig, contextHtml) {
    const attribute = fieldConfig.attribute || 'textContent';

    return `
      (function() {
        const div = document.createElement('div');
        div.innerHTML = ${JSON.stringify(contextHtml)};
        const el = div.querySelector('${selector}');
        if (!el) return null;
        ${this._generateAttributeAccess('el', attribute)}
      })();
    `;
  }

  /**
   * Generate attribute access code
   */
  _generateAttributeAccess(elVar, attribute) {
    const attributes = attribute.split('|');

    if (attributes.length === 1) {
      if (attribute === 'textContent' || attribute === 'innerText') {
        return `return ${elVar}.${attribute}.trim();`;
      } else {
        return `return ${elVar}.getAttribute('${attribute}');`;
      }
    } else {
      // Try multiple attributes
      return `
        ${attributes.map(attr => {
          if (attr === 'textContent' || attr === 'innerText') {
            return `if (${elVar}.${attr}) return ${elVar}.${attr}.trim();`;
          } else {
            return `if (${elVar}.getAttribute('${attr}')) return ${elVar}.getAttribute('${attr}');`;
          }
        }).join('\n')}
        return null;
      `;
    }
  }

  /**
   * Transform extracted value
   */
  _transformValue(value, transform) {
    if (!transform) return value;

    switch (transform) {
      case 'extractNumber':
        if (Array.isArray(value)) {
          return value.map(v => this._extractNumber(v));
        }
        return this._extractNumber(value);

      case 'toLowerCase':
        return value.toLowerCase();

      case 'toUpperCase':
        return value.toUpperCase();

      case 'trim':
        return value.trim();

      default:
        return value;
    }
  }

  /**
   * Extract number from string
   */
  _extractNumber(str) {
    if (typeof str !== 'string') return str;

    // Remove commas and extract first number
    const match = str.replace(/,/g, '').match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
  }

  /**
   * Validate template structure
   */
  _validateTemplate(template) {
    if (!template.name) {
      throw new Error('Template must have a name');
    }

    if (!template.fields || typeof template.fields !== 'object') {
      throw new Error('Template must have fields object');
    }

    for (const [fieldName, fieldConfig] of Object.entries(template.fields)) {
      if (!fieldConfig.selector && !fieldConfig.selectors) {
        throw new Error(`Field '${fieldName}' must have selector or selectors`);
      }
    }

    return { valid: true };
  }

  /**
   * Generate template ID from name
   */
  _generateTemplateId(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);
  }
}

module.exports = {
  TemplateManager,
  BUILT_IN_TEMPLATES
};
