/**
 * DOM Snapshot Extraction Module
 * Provides comprehensive DOM extraction utilities for complete page snapshots
 *
 * Features:
 * - Full DOM tree extraction with all properties
 * - Computed styles for all elements
 * - Form state tracking
 * - Text content with structure preservation
 * - Element attributes collection
 * - Event listener discovery
 * - DOM mutation history tracking
 */

/**
 * DOM Snapshot Manager
 * Handles extraction and tracking of complete DOM state
 */
class DOMSnapshotManager {
  constructor() {
    this.mutationHistory = [];
    this.maxHistorySize = 1000;
    this.observer = null;
    this.isTracking = false;
  }

  /**
   * Generate JavaScript to extract full DOM tree with all properties
   * @param {Object} options - Extraction options
   * @returns {string} JavaScript code to execute in browser
   */
  generateDOMTreeScript(options = {}) {
    const { maxDepth = 50, includeText = true, includeComments = false } = options;

    return `
      (function() {
        try {
          const maxDepth = ${maxDepth};
          const includeText = ${includeText};
          const includeComments = ${includeComments};

          function serializeNode(node, depth = 0) {
            if (depth > maxDepth) {
              return null;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              const rect = element.getBoundingClientRect();
              const computedStyle = window.getComputedStyle(element);

              // Get all attributes
              const attributes = {};
              for (const attr of element.attributes) {
                attributes[attr.name] = attr.value;
              }

              // Get computed styles (key ones to reduce size)
              const styles = {
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                position: computedStyle.position,
                width: computedStyle.width,
                height: computedStyle.height,
                color: computedStyle.color,
                backgroundColor: computedStyle.backgroundColor,
                zIndex: computedStyle.zIndex
              };

              const serialized = {
                type: 'element',
                tagName: element.tagName.toLowerCase(),
                id: element.id || null,
                className: element.className,
                attributes: attributes,
                styles: styles,
                rect: {
                  x: Math.round(rect.x),
                  y: Math.round(rect.y),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  top: Math.round(rect.top),
                  left: Math.round(rect.left),
                  bottom: Math.round(rect.bottom),
                  right: Math.round(rect.right)
                },
                isVisible: rect.width > 0 && rect.height > 0 &&
                           computedStyle.visibility !== 'hidden' &&
                           computedStyle.display !== 'none',
                childNodeCount: element.childNodes.length,
                children: []
              };

              // Process children
              for (const child of element.childNodes) {
                if (child.nodeType === Node.ELEMENT_NODE) {
                  const childNode = serializeNode(child, depth + 1);
                  if (childNode) {
                    serialized.children.push(childNode);
                  }
                } else if (child.nodeType === Node.TEXT_NODE && includeText) {
                  const text = child.textContent.trim();
                  if (text.length > 0) {
                    serialized.children.push({
                      type: 'text',
                      content: text.substring(0, 500)
                    });
                  }
                } else if (child.nodeType === Node.COMMENT_NODE && includeComments) {
                  serialized.children.push({
                    type: 'comment',
                    content: child.nodeValue.substring(0, 200)
                  });
                }
              }

              return serialized;
            }

            return null;
          }

          const rootTree = serializeNode(document.documentElement);
          return {
            success: true,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            tree: rootTree,
            documentTitle: document.title,
            bodyClasses: document.body.className
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Generate JavaScript to extract computed styles for all elements
   * @param {Object} options - Extraction options
   * @returns {string} JavaScript code to execute in browser
   */
  generateComputedStylesScript(options = {}) {
    const { selector = '*', limit = 5000 } = options;

    return `
      (function() {
        try {
          const elements = document.querySelectorAll('${selector.replace(/'/g, "\\'")}');
          const styles = [];
          let processedCount = 0;

          for (const element of elements) {
            if (processedCount >= ${limit}) break;

            const computedStyle = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();

            // Build CSS property snapshot
            const cssProperties = {};
            const importantProps = [
              'display', 'visibility', 'position', 'width', 'height',
              'margin', 'padding', 'border', 'color', 'backgroundColor',
              'fontSize', 'fontFamily', 'fontWeight', 'lineHeight',
              'zIndex', 'opacity', 'overflow', 'cursor', 'pointerEvents'
            ];

            for (const prop of importantProps) {
              const value = computedStyle.getPropertyValue(prop);
              if (value) {
                cssProperties[prop] = value;
              }
            }

            // Get element selector path for identification
            let selector = '';
            if (element.id) {
              selector = '#' + element.id;
            } else {
              let path = [];
              let current = element;
              while (current && current !== document.documentElement) {
                path.unshift(current.tagName.toLowerCase());
                current = current.parentElement;
              }
              selector = path.join(' > ');
            }

            styles.push({
              selector: selector,
              tagName: element.tagName.toLowerCase(),
              id: element.id || null,
              className: element.className,
              computedStyles: cssProperties,
              rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              isVisible: rect.width > 0 && rect.height > 0
            });

            processedCount++;
          }

          return {
            success: true,
            timestamp: new Date().toISOString(),
            totalElements: elements.length,
            processedCount: processedCount,
            styles: styles
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Generate JavaScript to extract all form field states
   * @param {Object} options - Extraction options
   * @returns {string} JavaScript code to execute in browser
   */
  generateFormStateScript(options = {}) {
    return `
      (function() {
        try {
          const forms = document.querySelectorAll('form');
          const formStates = [];

          for (const form of forms) {
            const formData = {
              id: form.id || null,
              name: form.name || null,
              method: form.method || 'GET',
              action: form.action || null,
              enctype: form.enctype || null,
              fields: []
            };

            // Extract all form fields
            const fields = form.querySelectorAll('input, textarea, select, button');
            for (const field of fields) {
              const fieldData = {
                type: field.tagName.toLowerCase(),
                name: field.name || null,
                id: field.id || null,
                inputType: field.type || null,
                label: null,
                value: null,
                checked: null,
                disabled: field.disabled || false,
                required: field.required || false,
                readonly: field.readOnly || false
              };

              // Get label if exists
              if (field.id) {
                const label = document.querySelector(\`label[for="\${field.id}"]\`);
                if (label) {
                  fieldData.label = label.textContent.trim().substring(0, 200);
                }
              }

              // Capture field value
              if (field.tagName === 'INPUT') {
                if (field.type === 'checkbox' || field.type === 'radio') {
                  fieldData.checked = field.checked;
                } else if (field.type !== 'password' && field.type !== 'file') {
                  fieldData.value = field.value.substring(0, 500);
                }
              } else if (field.tagName === 'TEXTAREA') {
                fieldData.value = field.value.substring(0, 500);
              } else if (field.tagName === 'SELECT') {
                fieldData.value = field.value;
                fieldData.selectedIndex = field.selectedIndex;
                fieldData.options = Array.from(field.options).map(opt => ({
                  value: opt.value,
                  text: opt.text,
                  selected: opt.selected
                }));
              }

              formData.fields.push(fieldData);
            }

            formStates.push(formData);
          }

          return {
            success: true,
            timestamp: new Date().toISOString(),
            formsCount: forms.length,
            forms: formStates
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Generate JavaScript to extract text content with structure
   * @param {Object} options - Extraction options
   * @returns {string} JavaScript code to execute in browser
   */
  generateTextContentScript(options = {}) {
    const { includeWhitespace = false } = options;

    return `
      (function() {
        try {
          const textElements = [];
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );

          let node;
          let elementCount = 0;

          while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (text.length === 0 && !${includeWhitespace}) continue;

            const parent = node.parentElement;
            if (!parent) continue;

            const rect = parent.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;

            textElements.push({
              text: text.substring(0, 1000),
              tagName: parent.tagName.toLowerCase(),
              id: parent.id || null,
              className: parent.className,
              selector: parent.id ? '#' + parent.id : parent.className ? '.' + parent.className : parent.tagName.toLowerCase(),
              xPath: getXPath(parent),
              rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              }
            });

            elementCount++;
            if (elementCount >= 10000) break;
          }

          // Helper function to generate XPath
          function getXPath(element) {
            if (element.id !== '')
              return "//*[@id='" + element.id + "']";
            if (element === document.body)
              return element.tagName.toLowerCase();
            var ix = 0;
            var siblings = element.parentNode.childNodes;
            for (var i = 0; i < siblings.length; i++) {
              var sibling = siblings[i];
              if (sibling === element)
                return getXPath(element.parentNode) + "/" + element.tagName.toLowerCase() + "[" + (ix + 1) + "]";
              if (sibling.nodeType === 1 && sibling.tagName.toLowerCase() === element.tagName.toLowerCase())
                ix++;
            }
          }

          return {
            success: true,
            timestamp: new Date().toISOString(),
            totalTextElements: elementCount,
            textElements: textElements
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Generate JavaScript to extract all element attributes
   * @param {Object} options - Extraction options
   * @returns {string} JavaScript code to execute in browser
   */
  generateAttributesScript(options = {}) {
    const { selector = '*', limit = 5000 } = options;

    return `
      (function() {
        try {
          const elements = document.querySelectorAll('${selector.replace(/'/g, "\\'")}');
          const attributes = [];
          let count = 0;

          for (const element of elements) {
            if (count >= ${limit}) break;

            const elementAttrs = {
              tagName: element.tagName.toLowerCase(),
              id: element.id || null,
              className: element.className || null,
              attributes: {}
            };

            // Collect all attributes
            for (const attr of element.attributes) {
              elementAttrs.attributes[attr.name] = attr.value;
            }

            attributes.push(elementAttrs);
            count++;
          }

          return {
            success: true,
            timestamp: new Date().toISOString(),
            totalElements: elements.length,
            processedCount: count,
            attributes: attributes
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Generate JavaScript to extract registered event listeners
   * @param {Object} options - Extraction options
   * @returns {string} JavaScript code to execute in browser
   */
  generateEventListenersScript(options = {}) {
    return `
      (function() {
        try {
          const listeners = [];
          const commonEvents = [
            'click', 'change', 'input', 'submit', 'focus', 'blur',
            'mouseover', 'mouseout', 'keydown', 'keyup', 'load', 'unload'
          ];

          // Note: Browser security restricts direct access to event listeners
          // We can only detect common events through element inspection
          const allElements = document.querySelectorAll('*');
          let count = 0;

          for (const element of allElements) {
            if (count >= 5000) break;

            const elementListeners = {
              tagName: element.tagName.toLowerCase(),
              id: element.id || null,
              className: element.className || null,
              events: []
            };

            // Check for event handler attributes
            for (const eventName of commonEvents) {
              const attrName = 'on' + eventName;
              if (element.hasAttribute(attrName)) {
                elementListeners.events.push({
                  event: eventName,
                  type: 'attribute',
                  handler: element.getAttribute(attrName).substring(0, 200)
                });
              }
            }

            // Check for common properties
            if (element.onclick) elementListeners.events.push({ event: 'click', type: 'property' });
            if (element.onchange) elementListeners.events.push({ event: 'change', type: 'property' });
            if (element.onsubmit) elementListeners.events.push({ event: 'submit', type: 'property' });
            if (element.onload) elementListeners.events.push({ event: 'load', type: 'property' });

            if (elementListeners.events.length > 0) {
              listeners.push(elementListeners);
              count++;
            }
          }

          return {
            success: true,
            timestamp: new Date().toISOString(),
            elementsWithListeners: count,
            note: 'Browser security restrictions limit listener discovery to attributes and properties',
            listeners: listeners
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Start tracking DOM mutations
   * Note: This needs to be called from renderer process
   * @returns {string} JavaScript code to set up mutation observer
   */
  generateMutationTrackerScript() {
    return `
      (function() {
        try {
          if (window.__domMutationTracker) {
            return { success: true, message: 'Mutation tracker already initialized' };
          }

          window.__domMutationTracker = {
            mutations: [],
            maxSize: 1000,
            addMutation: function(mutation) {
              if (this.mutations.length >= this.maxSize) {
                this.mutations.shift();
              }
              this.mutations.push({
                type: mutation.type,
                targetTagName: mutation.target.tagName.toLowerCase(),
                targetId: mutation.target.id || null,
                targetClassName: mutation.target.className || null,
                timestamp: new Date().toISOString(),
                addedNodes: mutation.addedNodes.length,
                removedNodes: mutation.removedNodes.length,
                attributeName: mutation.attributeName || null,
                oldValue: mutation.oldValue || null
              });
            }
          };

          const observer = new MutationObserver(function(mutations) {
            for (const mutation of mutations) {
              window.__domMutationTracker.addMutation(mutation);
            }
          });

          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeOldValue: true,
            characterData: false
          });

          window.__domMutationTracker.observer = observer;

          return {
            success: true,
            message: 'Mutation tracker initialized',
            timestamp: new Date().toISOString()
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Generate JavaScript to retrieve collected mutation history
   * @returns {string} JavaScript code to execute in browser
   */
  generateMutationHistoryScript() {
    return `
      (function() {
        try {
          if (!window.__domMutationTracker || !window.__domMutationTracker.mutations) {
            return {
              success: true,
              mutations: [],
              message: 'No mutation tracker or no mutations recorded'
            };
          }

          return {
            success: true,
            timestamp: new Date().toISOString(),
            mutationCount: window.__domMutationTracker.mutations.length,
            mutations: window.__domMutationTracker.mutations
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }

  /**
   * Generate JavaScript to stop mutation tracking
   * @returns {string} JavaScript code to execute in browser
   */
  generateStopMutationTrackerScript() {
    return `
      (function() {
        try {
          if (!window.__domMutationTracker || !window.__domMutationTracker.observer) {
            return { success: true, message: 'No mutation tracker to stop' };
          }

          window.__domMutationTracker.observer.disconnect();
          const mutationCount = window.__domMutationTracker.mutations.length;

          return {
            success: true,
            message: 'Mutation tracker stopped',
            mutationCount: mutationCount
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  }
}

module.exports = { DOMSnapshotManager };
