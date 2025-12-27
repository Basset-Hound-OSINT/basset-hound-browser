/**
 * DOM Inspector Manager for Basset Hound Browser
 * Provides comprehensive DOM inspection, element analysis, and selector generation
 */

const { SelectorGenerator } = require('./selector-generator');
const { ElementHighlighter } = require('./highlighter');

class DOMInspector {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.selectorGenerator = new SelectorGenerator();
    this.highlighter = new ElementHighlighter();
  }

  /**
   * Get element information by selector
   * @param {string} selector - CSS selector
   * @returns {string} JavaScript to execute in browser
   */
  getElement(selector) {
    return `
      (function() {
        try {
          const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);

          // Get all attributes
          const attributes = {};
          for (const attr of element.attributes) {
            attributes[attr.name] = attr.value;
          }

          // Get element path for unique identification
          const path = [];
          let current = element;
          while (current && current !== document.body && current !== document.documentElement) {
            const parent = current.parentElement;
            let index = 0;
            if (parent) {
              const siblings = Array.from(parent.children).filter(
                child => child.tagName === current.tagName
              );
              index = siblings.indexOf(current);
            }
            path.unshift({
              tagName: current.tagName,
              id: current.id || null,
              classes: current.className ? current.className.split(' ').filter(c => c) : [],
              index: index
            });
            current = parent;
          }

          return {
            success: true,
            element: {
              tagName: element.tagName,
              id: element.id || null,
              classes: element.className ? element.className.split(' ').filter(c => c) : [],
              attributes: attributes,
              textContent: element.textContent ? element.textContent.substring(0, 500) : '',
              innerText: element.innerText ? element.innerText.substring(0, 500) : '',
              innerHTML: element.innerHTML ? element.innerHTML.substring(0, 1000) : '',
              outerHTML: element.outerHTML ? element.outerHTML.substring(0, 1500) : '',
              rect: {
                top: rect.top,
                left: rect.left,
                bottom: rect.bottom,
                right: rect.right,
                width: rect.width,
                height: rect.height,
                x: rect.x,
                y: rect.y
              },
              isVisible: rect.width > 0 && rect.height > 0 &&
                computedStyle.visibility !== 'hidden' &&
                computedStyle.display !== 'none',
              childCount: element.children.length,
              path: path
            }
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Get DOM subtree starting from an element
   * @param {string} selector - CSS selector for root element
   * @param {number} depth - Maximum depth to traverse
   * @returns {string} JavaScript to execute in browser
   */
  getElementTree(selector, depth = 3) {
    return `
      (function() {
        try {
          const root = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!root) {
            return { success: false, error: 'Element not found' };
          }

          function buildTree(element, currentDepth, maxDepth) {
            if (currentDepth > maxDepth) {
              return null;
            }

            const rect = element.getBoundingClientRect();
            const node = {
              tagName: element.tagName,
              id: element.id || null,
              classes: element.className ? element.className.split(' ').filter(c => c) : [],
              attributes: {},
              text: element.childNodes.length === 1 && element.childNodes[0].nodeType === 3
                ? element.textContent.trim().substring(0, 100)
                : null,
              rect: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                top: Math.round(rect.top),
                left: Math.round(rect.left)
              },
              children: []
            };

            // Get important attributes
            const importantAttrs = ['id', 'name', 'type', 'href', 'src', 'value', 'placeholder',
              'data-testid', 'data-test', 'data-cy', 'aria-label', 'role', 'title', 'alt'];
            for (const attr of element.attributes) {
              if (importantAttrs.includes(attr.name) || attr.name.startsWith('data-')) {
                node.attributes[attr.name] = attr.value;
              }
            }

            // Process children
            if (currentDepth < maxDepth) {
              for (const child of element.children) {
                const childNode = buildTree(child, currentDepth + 1, maxDepth);
                if (childNode) {
                  node.children.push(childNode);
                }
              }
            } else if (element.children.length > 0) {
              node.hasMoreChildren = element.children.length;
            }

            return node;
          }

          const tree = buildTree(root, 0, ${depth});

          return {
            success: true,
            tree: tree,
            depth: ${depth}
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Get computed styles for an element
   * @param {string} selector - CSS selector
   * @returns {string} JavaScript to execute in browser
   */
  getElementStyles(selector) {
    return `
      (function() {
        try {
          const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          const computed = window.getComputedStyle(element);
          const inline = element.style;

          // Commonly needed style properties
          const importantProperties = [
            'display', 'visibility', 'opacity', 'position',
            'top', 'left', 'right', 'bottom',
            'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
            'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
            'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            'border', 'border-width', 'border-style', 'border-color', 'border-radius',
            'background', 'background-color', 'background-image',
            'color', 'font-family', 'font-size', 'font-weight', 'line-height', 'text-align',
            'z-index', 'overflow', 'cursor', 'pointer-events',
            'flex', 'flex-direction', 'justify-content', 'align-items',
            'grid-template-columns', 'grid-template-rows', 'gap',
            'transform', 'transition', 'animation'
          ];

          const computedStyles = {};
          const inlineStyles = {};

          for (const prop of importantProperties) {
            const camelProp = prop.replace(/-([a-z])/g, g => g[1].toUpperCase());
            computedStyles[prop] = computed.getPropertyValue(prop);
            if (inline[camelProp]) {
              inlineStyles[prop] = inline[camelProp];
            }
          }

          // Get all inline styles
          for (let i = 0; i < inline.length; i++) {
            const prop = inline[i];
            inlineStyles[prop] = inline.getPropertyValue(prop);
          }

          return {
            success: true,
            computed: computedStyles,
            inline: inlineStyles,
            element: {
              tagName: element.tagName,
              id: element.id || null
            }
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Get all attributes for an element
   * @param {string} selector - CSS selector
   * @returns {string} JavaScript to execute in browser
   */
  getElementAttributes(selector) {
    return `
      (function() {
        try {
          const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          const attributes = {};
          const dataAttributes = {};
          const ariaAttributes = {};
          const eventAttributes = {};

          for (const attr of element.attributes) {
            if (attr.name.startsWith('data-')) {
              dataAttributes[attr.name] = attr.value;
            } else if (attr.name.startsWith('aria-')) {
              ariaAttributes[attr.name] = attr.value;
            } else if (attr.name.startsWith('on')) {
              eventAttributes[attr.name] = '[event handler]';
            } else {
              attributes[attr.name] = attr.value;
            }
          }

          // Get some properties that aren't attributes
          const properties = {
            value: element.value !== undefined ? element.value : null,
            checked: element.checked !== undefined ? element.checked : null,
            selected: element.selected !== undefined ? element.selected : null,
            disabled: element.disabled !== undefined ? element.disabled : null,
            readOnly: element.readOnly !== undefined ? element.readOnly : null,
            href: element.href || null,
            src: element.src || null
          };

          // Remove null properties
          Object.keys(properties).forEach(key => {
            if (properties[key] === null) delete properties[key];
          });

          return {
            success: true,
            standard: attributes,
            data: dataAttributes,
            aria: ariaAttributes,
            events: eventAttributes,
            properties: properties,
            element: {
              tagName: element.tagName,
              id: element.id || null
            }
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Generate unique CSS selector for an element
   * @param {Array} elementPath - Path of element from root
   * @returns {Object} Generated selectors
   */
  generateSelector(elementPath) {
    return this.selectorGenerator.fromElement({ path: elementPath });
  }

  /**
   * Get script to generate selector in browser context
   * @param {string} selector - Initial selector to find element
   * @returns {string} JavaScript to execute in browser
   */
  getGenerateSelectorScript(selector) {
    return `
      (function() {
        try {
          const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          // Build element path
          const path = [];
          let current = element;
          while (current && current !== document.body && current !== document.documentElement) {
            const parent = current.parentElement;
            let index = 0;
            if (parent) {
              const siblings = Array.from(parent.children).filter(
                child => child.tagName === current.tagName
              );
              index = siblings.indexOf(current);
            }
            path.unshift({
              tagName: current.tagName,
              id: current.id || null,
              classes: current.className ? current.className.split(' ').filter(c => c) : [],
              index: index
            });
            current = parent;
          }

          // Generate selectors
          const selectors = {
            optimal: null,
            id: null,
            class: null,
            xpath: null,
            nthChild: null,
            full: null
          };

          // ID selector
          if (element.id) {
            selectors.id = '#' + element.id.replace(/([!"#$%&'()*+,./:;<=>?@[\\\\\\]^\`{|}~])/g, '\\\\$1');
            selectors.optimal = selectors.id;
          }

          // Class selector
          if (element.className) {
            const classes = element.className.split(' ').filter(c => c);
            if (classes.length > 0) {
              const significantClasses = classes.filter(cls =>
                !/^(col|row|container|flex|grid|m|p|mt|mb|ml|mr|w|h)-/i.test(cls)
              ).slice(0, 3);
              if (significantClasses.length > 0) {
                selectors.class = element.tagName.toLowerCase() +
                  significantClasses.map(c => '.' + c.replace(/([!"#$%&'()*+,./:;<=>?@[\\\\\\]^\`{|}~])/g, '\\\\$1')).join('');
              }
            }
          }

          // XPath
          const xpathParts = path.map(node => {
            let part = node.tagName.toLowerCase();
            if (node.id) {
              return '//' + part + '[@id="' + node.id + '"]';
            }
            if (node.index > 0) {
              part += '[' + (node.index + 1) + ']';
            }
            return part;
          });
          selectors.xpath = '//' + xpathParts.join('/');

          // nth-child
          selectors.nthChild = path.map(node => {
            return node.tagName.toLowerCase() + ':nth-child(' + (node.index + 1) + ')';
          }).join(' > ');

          // Full unique selector
          const fullParts = [];
          for (const node of path) {
            let part = node.tagName.toLowerCase();
            if (node.id) {
              fullParts.length = 0;
              fullParts.push('#' + node.id.replace(/([!"#$%&'()*+,./:;<=>?@[\\\\\\]^\`{|}~])/g, '\\\\$1'));
              continue;
            }
            if (node.classes.length > 0) {
              const sigClass = node.classes.find(c => !/^(col|row|container|flex|grid|m|p|mt|mb|w|h)-/i.test(c));
              if (sigClass) {
                part += '.' + sigClass.replace(/([!"#$%&'()*+,./:;<=>?@[\\\\\\]^\`{|}~])/g, '\\\\$1');
              }
            }
            if (node.index > 0) {
              part += ':nth-child(' + (node.index + 1) + ')';
            }
            fullParts.push(part);
          }
          selectors.full = fullParts.join(' > ');

          // Determine optimal
          if (!selectors.optimal) {
            if (selectors.class && selectors.class.length < 60) {
              selectors.optimal = selectors.class;
            } else {
              selectors.optimal = selectors.full;
            }
          }

          // Validate optimal selector
          try {
            const count = document.querySelectorAll(selectors.optimal).length;
            selectors.optimalUnique = count === 1;
          } catch (e) {
            selectors.optimalUnique = false;
          }

          return {
            success: true,
            selectors: selectors,
            path: path
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Highlight an element visually
   * @param {string} selector - CSS selector
   * @param {string} color - Highlight color (optional)
   * @returns {string} JavaScript to execute in browser
   */
  highlightElement(selector, color = null) {
    return this.highlighter.highlight(selector, color);
  }

  /**
   * Remove all highlights
   * @returns {string} JavaScript to execute in browser
   */
  removeHighlight() {
    return this.highlighter.clear();
  }

  /**
   * Find elements by various criteria
   * @param {Object} query - Search query options
   * @returns {string} JavaScript to execute in browser
   */
  findElements(query) {
    const queryJson = JSON.stringify(query);

    return `
      (function() {
        try {
          const query = ${queryJson};
          let elements = [];

          // By CSS selector
          if (query.selector) {
            elements = Array.from(document.querySelectorAll(query.selector));
          }
          // By tag name
          else if (query.tagName) {
            elements = Array.from(document.getElementsByTagName(query.tagName));
          }
          // By text content
          else if (query.text) {
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_ELEMENT,
              null,
              false
            );
            while (walker.nextNode()) {
              const text = walker.currentNode.textContent || '';
              if (query.exact ? text.trim() === query.text : text.includes(query.text)) {
                elements.push(walker.currentNode);
              }
            }
          }
          // By attribute
          else if (query.attribute) {
            const attrSelector = query.attributeValue
              ? '[' + query.attribute + '="' + query.attributeValue.replace(/"/g, '\\\\"') + '"]'
              : '[' + query.attribute + ']';
            elements = Array.from(document.querySelectorAll(attrSelector));
          }
          // By XPath
          else if (query.xpath) {
            const result = document.evaluate(
              query.xpath,
              document,
              null,
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
              null
            );
            for (let i = 0; i < result.snapshotLength; i++) {
              elements.push(result.snapshotItem(i));
            }
          }

          // Filter by visibility if requested
          if (query.visibleOnly) {
            elements = elements.filter(el => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              return rect.width > 0 && rect.height > 0 &&
                style.visibility !== 'hidden' &&
                style.display !== 'none';
            });
          }

          // Limit results
          const limit = query.limit || 100;
          elements = elements.slice(0, limit);

          // Build result
          const results = elements.map((el, index) => {
            const rect = el.getBoundingClientRect();
            return {
              index: index,
              tagName: el.tagName,
              id: el.id || null,
              classes: el.className ? el.className.split(' ').filter(c => c).slice(0, 5) : [],
              text: el.textContent ? el.textContent.trim().substring(0, 100) : '',
              rect: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                top: Math.round(rect.top),
                left: Math.round(rect.left)
              }
            };
          });

          return {
            success: true,
            count: results.length,
            total: elements.length,
            elements: results
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Get parent element
   * @param {string} selector - CSS selector
   * @returns {string} JavaScript to execute in browser
   */
  getParent(selector) {
    return `
      (function() {
        try {
          const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          const parent = element.parentElement;
          if (!parent || parent === document.documentElement) {
            return { success: false, error: 'No parent element' };
          }

          const rect = parent.getBoundingClientRect();
          const attributes = {};
          for (const attr of parent.attributes) {
            attributes[attr.name] = attr.value;
          }

          return {
            success: true,
            parent: {
              tagName: parent.tagName,
              id: parent.id || null,
              classes: parent.className ? parent.className.split(' ').filter(c => c) : [],
              attributes: attributes,
              childCount: parent.children.length,
              rect: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                top: Math.round(rect.top),
                left: Math.round(rect.left)
              }
            }
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Get child elements
   * @param {string} selector - CSS selector
   * @returns {string} JavaScript to execute in browser
   */
  getChildren(selector) {
    return `
      (function() {
        try {
          const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          const children = Array.from(element.children).map((child, index) => {
            const rect = child.getBoundingClientRect();
            return {
              index: index,
              tagName: child.tagName,
              id: child.id || null,
              classes: child.className ? child.className.split(' ').filter(c => c).slice(0, 5) : [],
              text: child.textContent ? child.textContent.trim().substring(0, 100) : '',
              childCount: child.children.length,
              rect: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                top: Math.round(rect.top),
                left: Math.round(rect.left)
              }
            };
          });

          return {
            success: true,
            count: children.length,
            children: children
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Get sibling elements
   * @param {string} selector - CSS selector
   * @returns {string} JavaScript to execute in browser
   */
  getSiblings(selector) {
    return `
      (function() {
        try {
          const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          const parent = element.parentElement;
          if (!parent) {
            return { success: false, error: 'No parent element' };
          }

          const siblings = Array.from(parent.children)
            .filter(child => child !== element)
            .map((sibling, index) => {
              const rect = sibling.getBoundingClientRect();
              return {
                index: index,
                tagName: sibling.tagName,
                id: sibling.id || null,
                classes: sibling.className ? sibling.className.split(' ').filter(c => c).slice(0, 5) : [],
                text: sibling.textContent ? sibling.textContent.trim().substring(0, 100) : '',
                rect: {
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  top: Math.round(rect.top),
                  left: Math.round(rect.left)
                }
              };
            });

          // Find element position among siblings
          const allChildren = Array.from(parent.children);
          const elementIndex = allChildren.indexOf(element);

          return {
            success: true,
            elementIndex: elementIndex,
            count: siblings.length,
            siblings: siblings,
            previous: elementIndex > 0 ? siblings[elementIndex - 1] : null,
            next: elementIndex < allChildren.length - 1 ?
              siblings.find((s, i) => i >= elementIndex) : null
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Get interactive elements (forms, buttons, links)
   * @param {string} selector - Optional container selector
   * @returns {string} JavaScript to execute in browser
   */
  getInteractiveElements(selector = 'body') {
    return `
      (function() {
        try {
          const container = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!container) {
            return { success: false, error: 'Container not found' };
          }

          const interactiveSelectors = [
            'a[href]',
            'button',
            'input',
            'select',
            'textarea',
            '[onclick]',
            '[role="button"]',
            '[role="link"]',
            '[tabindex]:not([tabindex="-1"])'
          ];

          const elements = [];
          for (const sel of interactiveSelectors) {
            const found = container.querySelectorAll(sel);
            for (const el of found) {
              if (!elements.some(e => e.element === el)) {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                const isVisible = rect.width > 0 && rect.height > 0 &&
                  style.visibility !== 'hidden' &&
                  style.display !== 'none';

                elements.push({
                  element: el,
                  tagName: el.tagName,
                  type: el.type || null,
                  id: el.id || null,
                  name: el.name || null,
                  classes: el.className ? el.className.split(' ').filter(c => c).slice(0, 3) : [],
                  text: (el.textContent || el.value || el.placeholder || '').trim().substring(0, 50),
                  href: el.href || null,
                  isVisible: isVisible,
                  isDisabled: el.disabled || false,
                  rect: {
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    top: Math.round(rect.top),
                    left: Math.round(rect.left)
                  }
                });
              }
            }
          }

          // Remove the element reference (not serializable)
          const results = elements.map(({ element, ...rest }) => rest);

          return {
            success: true,
            count: results.length,
            elements: results
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Get form data
   * @param {string} selector - Form selector
   * @returns {string} JavaScript to execute in browser
   */
  getFormData(selector) {
    return `
      (function() {
        try {
          const form = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!form) {
            return { success: false, error: 'Form not found' };
          }

          if (form.tagName !== 'FORM') {
            return { success: false, error: 'Element is not a form' };
          }

          const formData = new FormData(form);
          const data = {};
          for (const [key, value] of formData.entries()) {
            if (data[key]) {
              if (Array.isArray(data[key])) {
                data[key].push(value);
              } else {
                data[key] = [data[key], value];
              }
            } else {
              data[key] = value;
            }
          }

          // Get form fields with details
          const fields = Array.from(form.elements).map(el => ({
            tagName: el.tagName,
            type: el.type || null,
            name: el.name || null,
            id: el.id || null,
            value: el.type === 'password' ? '[hidden]' : (el.value || null),
            checked: el.checked !== undefined ? el.checked : null,
            required: el.required || false,
            disabled: el.disabled || false,
            placeholder: el.placeholder || null
          })).filter(f => f.name || f.id);

          return {
            success: true,
            action: form.action,
            method: form.method,
            data: data,
            fields: fields
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Highlight multiple elements
   * @param {Array} selectors - Array of CSS selectors
   * @returns {string} JavaScript to execute in browser
   */
  highlightMultiple(selectors) {
    return this.highlighter.highlightMultiple(selectors);
  }

  /**
   * Set highlighter style
   * @param {Object} options - Style options
   * @returns {Object} Updated style
   */
  setHighlightStyle(options) {
    return this.highlighter.setStyle(options);
  }
}

module.exports = { DOMInspector, SelectorGenerator, ElementHighlighter };
