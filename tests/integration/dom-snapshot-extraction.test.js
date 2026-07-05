/**
 * DOM Snapshot Extraction Integration Tests
 * Tests WebSocket commands for complete DOM extraction
 */

const WebSocket = require('ws');
const path = require('path');

const TEST_TIMEOUT = 30000;
const WEBSOCKET_PORT = 8765;
const TEST_URL = 'http://localhost:3000/test-page';

describe('DOM Snapshot Extraction Integration', () => {
  let ws;
  const baseUrl = `ws://localhost:${WEBSOCKET_PORT}`;

  beforeEach((done) => {
    ws = new WebSocket(baseUrl);
    ws.on('open', () => {
      done();
    });
    ws.on('error', (err) => {
      done(err);
    });
  }, TEST_TIMEOUT);

  afterEach((done) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      done();
    } else {
      done();
    }
  });

  const sendCommand = (command, params = {}) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command ${command} timeout`));
      }, 10000);

      ws.once('message', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(e);
        }
      });

      ws.send(JSON.stringify({
        command,
        params
      }));
    });
  };

  describe('export_dom_tree', () => {
    test('should extract full DOM tree', async () => {
      const response = await sendCommand('export_dom_tree', {});

      expect(response.success).toBe(true);
      expect(response.tree).toBeDefined();
      expect(response.documentTitle).toBeDefined();
      expect(response.timestamp).toBeDefined();
      expect(response.url).toBeDefined();
    }, TEST_TIMEOUT);

    test('should include tree structure', async () => {
      const response = await sendCommand('export_dom_tree', {});

      expect(response.success).toBe(true);
      expect(response.tree.type).toBe('element');
      expect(response.tree.tagName).toBe('html');
      expect(response.tree.children).toBeDefined();
      expect(Array.isArray(response.tree.children)).toBe(true);
    }, TEST_TIMEOUT);

    test('should include element properties', async () => {
      const response = await sendCommand('export_dom_tree', {});

      if (response.tree.children && response.tree.children.length > 0) {
        const child = response.tree.children[0];
        expect(child.tagName).toBeDefined();
        expect(child.id).toBeDefined();
        expect(child.className).toBeDefined();
        expect(child.attributes).toBeDefined();
        expect(child.rect).toBeDefined();
      }
    }, TEST_TIMEOUT);

    test('should respect maxDepth parameter', async () => {
      const response = await sendCommand('export_dom_tree', { maxDepth: 3 });

      expect(response.success).toBe(true);
      expect(response.depth).toBe(3);
    }, TEST_TIMEOUT);

    test('should include positioning information', async () => {
      const response = await sendCommand('export_dom_tree', {});

      if (response.tree.children && response.tree.children.length > 0) {
        const child = response.tree.children[0];
        if (child.rect) {
          expect(child.rect.x).toBeDefined();
          expect(child.rect.y).toBeDefined();
          expect(child.rect.width).toBeDefined();
          expect(child.rect.height).toBeDefined();
        }
      }
    }, TEST_TIMEOUT);
  });

  describe('export_dom_computed_styles', () => {
    test('should extract computed styles for all elements', async () => {
      const response = await sendCommand('export_dom_computed_styles', {});

      expect(response.success).toBe(true);
      expect(response.styles).toBeDefined();
      expect(Array.isArray(response.styles)).toBe(true);
      expect(response.totalElements).toBeDefined();
      expect(response.processedCount).toBeDefined();
    }, TEST_TIMEOUT);

    test('should include CSS properties', async () => {
      const response = await sendCommand('export_dom_computed_styles', {});

      if (response.styles && response.styles.length > 0) {
        const style = response.styles[0];
        expect(style.selector).toBeDefined();
        expect(style.tagName).toBeDefined();
        expect(style.computedStyles).toBeDefined();
      }
    }, TEST_TIMEOUT);

    test('should respect selector parameter', async () => {
      const response = await sendCommand('export_dom_computed_styles', {
        selector: 'div'
      });

      expect(response.success).toBe(true);
      expect(response.selector).toBe('div');
    }, TEST_TIMEOUT);

    test('should respect limit parameter', async () => {
      const response = await sendCommand('export_dom_computed_styles', {
        limit: 100
      });

      expect(response.success).toBe(true);
      expect(response.processedCount).toBeLessThanOrEqual(100);
    }, TEST_TIMEOUT);

    test('should include visibility information', async () => {
      const response = await sendCommand('export_dom_computed_styles', {});

      if (response.styles && response.styles.length > 0) {
        const style = response.styles[0];
        expect(style.isVisible).toBeDefined();
      }
    }, TEST_TIMEOUT);
  });

  describe('export_dom_form_state', () => {
    test('should extract form data', async () => {
      const response = await sendCommand('export_dom_form_state', {});

      expect(response.success).toBe(true);
      expect(response.formsCount).toBeDefined();
      expect(response.forms).toBeDefined();
      expect(Array.isArray(response.forms)).toBe(true);
    }, TEST_TIMEOUT);

    test('should include form attributes', async () => {
      const response = await sendCommand('export_dom_form_state', {});

      if (response.forms && response.forms.length > 0) {
        const form = response.forms[0];
        expect(form.id).toBeDefined();
        expect(form.method).toBeDefined();
        expect(form.action).toBeDefined();
        expect(form.fields).toBeDefined();
      }
    }, TEST_TIMEOUT);

    test('should include field data', async () => {
      const response = await sendCommand('export_dom_form_state', {});

      if (response.forms && response.forms.length > 0) {
        const form = response.forms[0];
        if (form.fields && form.fields.length > 0) {
          const field = form.fields[0];
          expect(field.name).toBeDefined();
          expect(field.type).toBeDefined();
          expect(field.disabled).toBeDefined();
          expect(field.required).toBeDefined();
        }
      }
    }, TEST_TIMEOUT);

    test('should capture field values (non-sensitive)', async () => {
      const response = await sendCommand('export_dom_form_state', {});

      if (response.forms && response.forms.length > 0) {
        const form = response.forms[0];
        if (form.fields && form.fields.length > 0) {
          const textField = form.fields.find(f => f.inputType === 'text');
          if (textField) {
            expect(textField.value).toBeDefined();
          }
        }
      }
    }, TEST_TIMEOUT);
  });

  describe('export_dom_text_content', () => {
    test('should extract text content', async () => {
      const response = await sendCommand('export_dom_text_content', {});

      expect(response.success).toBe(true);
      expect(response.textElements).toBeDefined();
      expect(Array.isArray(response.textElements)).toBe(true);
      expect(response.totalTextElements).toBeDefined();
    }, TEST_TIMEOUT);

    test('should include text with positioning', async () => {
      const response = await sendCommand('export_dom_text_content', {});

      if (response.textElements && response.textElements.length > 0) {
        const textEl = response.textElements[0];
        expect(textEl.text).toBeDefined();
        expect(textEl.tagName).toBeDefined();
        expect(textEl.rect).toBeDefined();
      }
    }, TEST_TIMEOUT);

    test('should include XPath for elements', async () => {
      const response = await sendCommand('export_dom_text_content', {});

      if (response.textElements && response.textElements.length > 0) {
        const textEl = response.textElements[0];
        expect(textEl.xPath).toBeDefined();
      }
    }, TEST_TIMEOUT);

    test('should truncate long text', async () => {
      const response = await sendCommand('export_dom_text_content', {});

      if (response.textElements && response.textElements.length > 0) {
        const textEl = response.textElements[0];
        expect(textEl.text.length).toBeLessThanOrEqual(1000);
      }
    }, TEST_TIMEOUT);
  });

  describe('export_dom_attributes', () => {
    test('should extract element attributes', async () => {
      const response = await sendCommand('export_dom_attributes', {});

      expect(response.success).toBe(true);
      expect(response.attributes).toBeDefined();
      expect(Array.isArray(response.attributes)).toBe(true);
      expect(response.totalElements).toBeDefined();
    }, TEST_TIMEOUT);

    test('should include all attributes for elements', async () => {
      const response = await sendCommand('export_dom_attributes', {});

      if (response.attributes && response.attributes.length > 0) {
        const element = response.attributes[0];
        expect(element.tagName).toBeDefined();
        expect(element.className).toBeDefined();
        expect(element.attributes).toBeDefined();
      }
    }, TEST_TIMEOUT);

    test('should respect selector parameter', async () => {
      const response = await sendCommand('export_dom_attributes', {
        selector: 'input'
      });

      expect(response.success).toBe(true);
      expect(response.selector).toBe('input');
    }, TEST_TIMEOUT);

    test('should respect limit parameter', async () => {
      const response = await sendCommand('export_dom_attributes', {
        limit: 50
      });

      expect(response.success).toBe(true);
      expect(response.processedCount).toBeLessThanOrEqual(50);
    }, TEST_TIMEOUT);
  });

  describe('export_dom_event_listeners', () => {
    test('should extract event listeners', async () => {
      const response = await sendCommand('export_dom_event_listeners', {});

      expect(response.success).toBe(true);
      expect(response.listeners).toBeDefined();
      expect(Array.isArray(response.listeners)).toBe(true);
      expect(response.elementsWithListeners).toBeDefined();
      expect(response.note).toBeDefined();
    }, TEST_TIMEOUT);

    test('should include listener details', async () => {
      const response = await sendCommand('export_dom_event_listeners', {});

      if (response.listeners && response.listeners.length > 0) {
        const listener = response.listeners[0];
        expect(listener.tagName).toBeDefined();
        expect(listener.events).toBeDefined();
      }
    }, TEST_TIMEOUT);

    test('should include event types', async () => {
      const response = await sendCommand('export_dom_event_listeners', {});

      if (response.listeners && response.listeners.length > 0) {
        const listener = response.listeners[0];
        if (listener.events && listener.events.length > 0) {
          const event = listener.events[0];
          expect(event.event).toBeDefined();
          expect(event.type).toBeDefined();
        }
      }
    }, TEST_TIMEOUT);
  });

  describe('export_dom_mutations', () => {
    test('should initialize mutation tracking', async () => {
      const response = await sendCommand('export_dom_mutations', {
        action: 'init'
      });

      expect(response.success).toBe(true);
      expect(response.message).toBeDefined();
    }, TEST_TIMEOUT);

    test('should get mutation history', async () => {
      // First initialize
      await sendCommand('export_dom_mutations', { action: 'init' });

      // Then get history
      const response = await sendCommand('export_dom_mutations', {
        action: 'get'
      });

      expect(response.success).toBe(true);
      expect(response.mutations).toBeDefined();
      expect(Array.isArray(response.mutations)).toBe(true);
      expect(response.mutationCount).toBeDefined();
    }, TEST_TIMEOUT);

    test('should stop mutation tracking', async () => {
      // Initialize first
      await sendCommand('export_dom_mutations', { action: 'init' });

      // Stop tracking
      const response = await sendCommand('export_dom_mutations', {
        action: 'stop'
      });

      expect(response.success).toBe(true);
      expect(response.message).toBeDefined();
    }, TEST_TIMEOUT);

    test('should include mutation details', async () => {
      await sendCommand('export_dom_mutations', { action: 'init' });

      // Wait a bit for potential mutations
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await sendCommand('export_dom_mutations', {
        action: 'get'
      });

      if (response.mutations && response.mutations.length > 0) {
        const mutation = response.mutations[0];
        expect(mutation.type).toBeDefined();
        expect(mutation.timestamp).toBeDefined();
        expect(mutation.targetTagName).toBeDefined();
      }
    }, TEST_TIMEOUT);
  });

  describe('error handling', () => {
    test('should handle invalid selector gracefully', async () => {
      const response = await sendCommand('export_dom_computed_styles', {
        selector: ':::invalid:::'
      });

      // Should still execute, just return empty results
      expect(response.success).toBeDefined();
    }, TEST_TIMEOUT);

    test('should include timestamps in all responses', async () => {
      const commands = [
        'export_dom_tree',
        'export_dom_computed_styles',
        'export_dom_form_state',
        'export_dom_text_content',
        'export_dom_attributes',
        'export_dom_event_listeners'
      ];

      for (const command of commands) {
        const response = await sendCommand(command, {});
        expect(response.timestamp).toBeDefined();
      }
    }, TEST_TIMEOUT);
  });

  describe('data consistency', () => {
    test('should return consistent data across multiple calls', async () => {
      const response1 = await sendCommand('export_dom_tree', {});
      const response2 = await sendCommand('export_dom_tree', {});

      expect(response1.documentTitle).toBe(response2.documentTitle);
      expect(response1.url).toBe(response2.url);
    }, TEST_TIMEOUT);

    test('should handle large DOM trees', async () => {
      const response = await sendCommand('export_dom_tree', { maxDepth: 50 });

      expect(response.success).toBe(true);
      expect(response.tree).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('performance', () => {
    test('should complete within reasonable time', async () => {
      const start = Date.now();
      const response = await sendCommand('export_dom_tree', {});
      const duration = Date.now() - start;

      expect(response.success).toBe(true);
      expect(duration).toBeLessThan(5000);
    }, TEST_TIMEOUT);

    test('should limit results to prevent memory issues', async () => {
      const response = await sendCommand('export_dom_text_content', {});

      // Should cap elements to prevent excessive memory use
      expect(response.totalTextElements).toBeDefined();
      if (response.textElements) {
        expect(response.textElements.length).toBeLessThanOrEqual(10000);
      }
    }, TEST_TIMEOUT);
  });
});
