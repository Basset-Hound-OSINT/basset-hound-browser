/**
 * Selector Generator for DOM Inspector
 * Generates optimal CSS selectors and XPath for elements
 */

class SelectorGenerator {
  constructor() {
    // Attributes to prefer when generating selectors (in order of preference)
    this.preferredAttributes = [
      'id',
      'data-testid',
      'data-test',
      'data-cy',
      'data-automation-id',
      'name',
      'aria-label',
      'role',
      'type',
      'placeholder',
      'title',
      'alt'
    ];

    // Attributes to exclude from selector generation
    this.excludedAttributes = [
      'style',
      'class',
      'onclick',
      'onload',
      'onmouseover',
      'onmouseout',
      'onfocus',
      'onblur'
    ];
  }

  /**
   * Generate optimal selector from element info
   * @param {Object} elementInfo - Element information object
   * @returns {Object} Generated selectors
   */
  fromElement(elementInfo) {
    const selectors = {
      optimal: null,
      id: null,
      class: null,
      attributes: null,
      nthChild: null,
      xpath: null,
      full: null
    };

    if (!elementInfo) {
      return selectors;
    }

    // Try ID selector first
    if (elementInfo.id) {
      selectors.id = this.generateId(elementInfo.id);
      selectors.optimal = selectors.id;
    }

    // Try class-based selector
    if (elementInfo.classes && elementInfo.classes.length > 0) {
      selectors.class = this.generateClass(elementInfo.classes, elementInfo.tagName);
    }

    // Generate attribute-based selector
    if (elementInfo.attributes) {
      selectors.attributes = this.generateAttributes(elementInfo);
    }

    // Generate nth-child selector
    if (elementInfo.path) {
      selectors.nthChild = this.generateNthChild(elementInfo.path);
    }

    // Generate XPath
    if (elementInfo.path) {
      selectors.xpath = this.generateXPath(elementInfo.path);
    }

    // Generate full unique selector
    selectors.full = this.generateUnique(elementInfo);

    // Determine optimal selector
    if (!selectors.optimal) {
      selectors.optimal = this.determineOptimal(selectors, elementInfo);
    }

    return selectors;
  }

  /**
   * Generate ID-based selector
   * @param {string} id - Element ID
   * @returns {string} CSS selector
   */
  generateId(id) {
    if (!id) return null;
    // Escape special characters in ID
    const escapedId = this.escapeCssSelector(id);
    return `#${escapedId}`;
  }

  /**
   * Generate class-based selector
   * @param {Array} classes - Array of class names
   * @param {string} tagName - Element tag name
   * @returns {string} CSS selector
   */
  generateClass(classes, tagName = '') {
    if (!classes || classes.length === 0) return null;

    // Filter out common utility classes that are likely not unique
    const significantClasses = classes.filter(cls => {
      // Exclude common framework classes
      const genericPatterns = [
        /^(col|row|container|wrapper|section|flex|grid|block|inline)/i,
        /^(m|p|mt|mb|ml|mr|mx|my|pt|pb|pl|pr|px|py)-\d+$/i,
        /^(text|bg|border|rounded|shadow|hover|focus|active)-/i,
        /^(sm|md|lg|xl|xxl):/i,
        /^(w|h)-\d+$/i,
        /^(hidden|visible|absolute|relative|fixed)/i
      ];
      return !genericPatterns.some(pattern => pattern.test(cls));
    });

    if (significantClasses.length === 0) {
      // Fall back to first few original classes
      const limitedClasses = classes.slice(0, 3);
      const classSelector = limitedClasses.map(cls => `.${this.escapeCssSelector(cls)}`).join('');
      return tagName ? `${tagName.toLowerCase()}${classSelector}` : classSelector;
    }

    const classSelector = significantClasses
      .slice(0, 3)
      .map(cls => `.${this.escapeCssSelector(cls)}`)
      .join('');

    return tagName ? `${tagName.toLowerCase()}${classSelector}` : classSelector;
  }

  /**
   * Generate XPath selector
   * @param {Array} path - Element path from root
   * @returns {string} XPath selector
   */
  generateXPath(path) {
    if (!path || path.length === 0) return null;

    const xpathParts = path.map(node => {
      let part = node.tagName.toLowerCase();

      if (node.id) {
        return `//${part}[@id="${node.id}"]`;
      }

      if (node.index !== undefined && node.index > 0) {
        part += `[${node.index + 1}]`;
      }

      return part;
    });

    // Optimize XPath - if any node has ID, start from there
    const idIndex = xpathParts.findIndex(part => part.includes('@id='));
    if (idIndex >= 0) {
      return xpathParts.slice(idIndex).join('/');
    }

    return '//' + xpathParts.join('/');
  }

  /**
   * Generate unique CSS selector
   * @param {Object} elementInfo - Element information
   * @returns {string} Unique CSS selector
   */
  generateUnique(elementInfo) {
    if (!elementInfo) return null;

    const parts = [];

    // Build selector from path
    if (elementInfo.path && elementInfo.path.length > 0) {
      for (const node of elementInfo.path) {
        let part = node.tagName.toLowerCase();

        if (node.id) {
          parts.push(`#${this.escapeCssSelector(node.id)}`);
          // Reset path after ID since ID should be unique
          parts.length = 1;
          parts[0] = `#${this.escapeCssSelector(node.id)}`;
          continue;
        }

        if (node.classes && node.classes.length > 0) {
          const significantClass = node.classes.find(cls =>
            !/^(col|row|container|flex|grid|m|p|mt|mb|ml|mr|w|h)-/i.test(cls)
          );
          if (significantClass) {
            part += `.${this.escapeCssSelector(significantClass)}`;
          }
        }

        if (node.index !== undefined && node.index > 0) {
          part += `:nth-child(${node.index + 1})`;
        }

        parts.push(part);
      }
    } else {
      // Fallback for elements without path
      let selector = elementInfo.tagName ? elementInfo.tagName.toLowerCase() : '*';

      if (elementInfo.id) {
        return `#${this.escapeCssSelector(elementInfo.id)}`;
      }

      if (elementInfo.classes && elementInfo.classes.length > 0) {
        selector += elementInfo.classes.slice(0, 2)
          .map(cls => `.${this.escapeCssSelector(cls)}`)
          .join('');
      }

      return selector;
    }

    return parts.join(' > ');
  }

  /**
   * Generate nth-child based selector
   * @param {Array} path - Element path
   * @returns {string} CSS selector with nth-child
   */
  generateNthChild(path) {
    if (!path || path.length === 0) return null;

    const parts = path.map(node => {
      let part = node.tagName.toLowerCase();
      if (node.index !== undefined) {
        part += `:nth-child(${node.index + 1})`;
      }
      return part;
    });

    return parts.join(' > ');
  }

  /**
   * Generate attribute-based selector
   * @param {Object} elementInfo - Element information
   * @returns {string} CSS selector with attributes
   */
  generateAttributes(elementInfo) {
    if (!elementInfo || !elementInfo.attributes) return null;

    const tag = elementInfo.tagName ? elementInfo.tagName.toLowerCase() : '*';
    const attrs = elementInfo.attributes;

    // Try preferred attributes first
    for (const attrName of this.preferredAttributes) {
      if (attrs[attrName] && attrName !== 'id') {
        const value = this.escapeCssAttributeValue(attrs[attrName]);
        return `${tag}[${attrName}="${value}"]`;
      }
    }

    // Fall back to any unique-looking attribute
    for (const [name, value] of Object.entries(attrs)) {
      if (!this.excludedAttributes.includes(name) && value && name !== 'id') {
        const escapedValue = this.escapeCssAttributeValue(value);
        return `${tag}[${name}="${escapedValue}"]`;
      }
    }

    return null;
  }

  /**
   * Determine the optimal selector from generated options
   * @param {Object} selectors - Generated selectors
   * @param {Object} elementInfo - Element information
   * @returns {string} Optimal selector
   */
  determineOptimal(selectors, elementInfo) {
    // Priority order:
    // 1. ID
    // 2. Data attribute selectors
    // 3. Class selector (if short and specific)
    // 4. Attribute selector
    // 5. Full unique selector

    if (selectors.id) return selectors.id;

    if (selectors.attributes) {
      // Prefer data-* attributes
      if (selectors.attributes.includes('[data-')) {
        return selectors.attributes;
      }
    }

    if (selectors.class && selectors.class.length < 60) {
      return selectors.class;
    }

    if (selectors.attributes) {
      return selectors.attributes;
    }

    if (selectors.full) {
      return selectors.full;
    }

    return selectors.nthChild || '*';
  }

  /**
   * Validate that a selector works
   * @param {string} selector - CSS selector to validate
   * @returns {string} JavaScript to validate selector
   */
  validate(selector) {
    return `
      (function() {
        try {
          const elements = document.querySelectorAll('${selector.replace(/'/g, "\\'")}');
          return {
            valid: true,
            count: elements.length,
            unique: elements.length === 1
          };
        } catch (e) {
          return {
            valid: false,
            error: e.message
          };
        }
      })();
    `;
  }

  /**
   * Get script to validate selector in browser context
   * @param {string} selector - Selector to validate
   * @returns {string} Validation script
   */
  getValidationScript(selector) {
    return this.validate(selector);
  }

  /**
   * Escape special characters in CSS selector
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeCssSelector(str) {
    if (!str) return '';
    return str.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  /**
   * Escape special characters in CSS attribute value
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeCssAttributeValue(str) {
    if (!str) return '';
    return str.replace(/["\\]/g, '\\$&');
  }

  /**
   * Generate a compact selector for logging/display
   * @param {Object} elementInfo - Element information
   * @returns {string} Compact selector description
   */
  generateCompact(elementInfo) {
    if (!elementInfo) return 'null';

    const parts = [];
    parts.push(elementInfo.tagName ? elementInfo.tagName.toLowerCase() : '?');

    if (elementInfo.id) {
      parts.push(`#${elementInfo.id}`);
    } else if (elementInfo.classes && elementInfo.classes.length > 0) {
      parts.push(`.${elementInfo.classes[0]}`);
    }

    return parts.join('');
  }
}

module.exports = { SelectorGenerator };
