/**
 * DOM Snapshot Command Handlers Unit Tests
 * Tests the WebSocket command handler registration and execution
 */

const { registerDOMSnapshotCommands } = require('../../websocket/commands/dom-snapshot-commands');

describe('DOM Snapshot Command Handlers', () => {
  let commandHandlers;
  let mainWindow;
  let mockLogger;

  beforeEach(() => {
    commandHandlers = {};
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    mainWindow = {
      webContents: {
        executeJavaScript: jest.fn()
      }
    };
  });

  describe('command registration', () => {
    test('should register all 7 DOM snapshot commands', () => {
      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      expect(commandHandlers.export_dom_tree).toBeDefined();
      expect(commandHandlers.export_dom_computed_styles).toBeDefined();
      expect(commandHandlers.export_dom_form_state).toBeDefined();
      expect(commandHandlers.export_dom_text_content).toBeDefined();
      expect(commandHandlers.export_dom_attributes).toBeDefined();
      expect(commandHandlers.export_dom_event_listeners).toBeDefined();
      expect(commandHandlers.export_dom_mutations).toBeDefined();
    });

    test('should log successful registration', () => {
      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('DOM snapshot extraction commands')
      );
    });

    test('should return commandHandlers object', () => {
      const result = registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });
      expect(result).toBe(commandHandlers);
    });
  });

  describe('export_dom_tree command', () => {
    test('should execute JavaScript in browser', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        tree: { tagName: 'html' },
        documentTitle: 'Test',
        url: 'http://test.com'
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_tree({});

      expect(mainWindow.webContents.executeJavaScript).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.tree).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    test('should handle maxDepth parameter', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        tree: { tagName: 'html' },
        documentTitle: 'Test',
        url: 'http://test.com'
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_tree({ maxDepth: 10 });

      expect(result.depth).toBe(10);
    });

    test('should handle extraction errors', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: false,
        error: 'Extraction failed'
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_tree({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle missing webContents', async () => {
      registerDOMSnapshotCommands(commandHandlers, { webContents: null }, { logger: mockLogger });

      const result = await commandHandlers.export_dom_tree({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Window or webContents not available');
    });

    test('should handle JavaScript execution errors', async () => {
      mainWindow.webContents.executeJavaScript.mockRejectedValue(
        new Error('Execution failed')
      );

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_tree({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('export_dom_computed_styles command', () => {
    test('should extract computed styles', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        totalElements: 100,
        processedCount: 50,
        styles: [
          {
            selector: 'div',
            computedStyles: { display: 'block' }
          }
        ]
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_computed_styles({});

      expect(result.success).toBe(true);
      expect(result.styles).toBeDefined();
      expect(result.totalElements).toBe(100);
      expect(result.processedCount).toBe(50);
    });

    test('should handle custom selector', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        totalElements: 50,
        processedCount: 50,
        styles: []
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_computed_styles({
        selector: 'input.active'
      });

      expect(result.selector).toBe('input.active');
    });

    test('should handle limit parameter', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        totalElements: 1000,
        processedCount: 100,
        styles: []
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_computed_styles({
        limit: 100
      });

      expect(result.processedCount).toBe(100);
    });
  });

  describe('export_dom_form_state command', () => {
    test('should extract form data', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        formsCount: 2,
        forms: [
          {
            id: 'form1',
            method: 'POST',
            fields: []
          }
        ]
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_form_state({});

      expect(result.success).toBe(true);
      expect(result.formsCount).toBe(2);
      expect(result.forms).toBeDefined();
    });

    test('should include form field states', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        formsCount: 1,
        forms: [
          {
            id: 'form1',
            fields: [
              {
                name: 'email',
                type: 'input',
                value: 'test@example.com',
                required: true
              }
            ]
          }
        ]
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_form_state({});

      expect(result.forms[0].fields).toBeDefined();
      expect(result.forms[0].fields[0].name).toBe('email');
    });
  });

  describe('export_dom_text_content command', () => {
    test('should extract text content', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        totalTextElements: 50,
        textElements: [
          {
            text: 'Hello World',
            tagName: 'p',
            rect: { x: 0, y: 0, width: 100, height: 20 }
          }
        ]
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_text_content({});

      expect(result.success).toBe(true);
      expect(result.totalTextElements).toBe(50);
      expect(result.textElements).toBeDefined();
    });

    test('should handle includeWhitespace parameter', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        totalTextElements: 100,
        textElements: []
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_text_content({
        includeWhitespace: true
      });

      expect(result.success).toBe(true);
    });
  });

  describe('export_dom_attributes command', () => {
    test('should extract element attributes', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        totalElements: 200,
        processedCount: 100,
        attributes: [
          {
            tagName: 'input',
            attributes: { type: 'text', name: 'email' }
          }
        ]
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_attributes({});

      expect(result.success).toBe(true);
      expect(result.attributes).toBeDefined();
      expect(result.totalElements).toBe(200);
    });

    test('should handle custom selector and limit', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        totalElements: 10,
        processedCount: 10,
        attributes: []
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_attributes({
        selector: 'a[href]',
        limit: 50
      });

      expect(result.selector).toBe('a[href]');
    });
  });

  describe('export_dom_event_listeners command', () => {
    test('should extract event listeners', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        elementsWithListeners: 5,
        listeners: [
          {
            tagName: 'button',
            events: [
              { event: 'click', type: 'attribute' }
            ]
          }
        ],
        note: 'Browser security restrictions...'
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_event_listeners({});

      expect(result.success).toBe(true);
      expect(result.listeners).toBeDefined();
      expect(result.elementsWithListeners).toBe(5);
      expect(result.note).toBeDefined();
    });
  });

  describe('export_dom_mutations command', () => {
    test('should initialize mutation tracking', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        message: 'Mutation tracker initialized'
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_mutations({ action: 'init' });

      expect(result.success).toBe(true);
      expect(result.action).toBe('init');
      expect(result.message).toBeDefined();
    });

    test('should get mutation history', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        mutationCount: 3,
        mutations: [
          {
            type: 'childList',
            targetTagName: 'div',
            timestamp: '2026-01-01T00:00:00Z'
          }
        ]
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_mutations({ action: 'get' });

      expect(result.success).toBe(true);
      expect(result.action).toBe('get');
      expect(result.mutationCount).toBe(3);
      expect(result.mutations).toBeDefined();
    });

    test('should stop mutation tracking', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        message: 'Mutation tracker stopped',
        mutationCount: 5
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_mutations({ action: 'stop' });

      expect(result.success).toBe(true);
      expect(result.action).toBe('stop');
      expect(result.message).toBeDefined();
    });

    test('should default to get action', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        mutations: []
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_mutations({});

      expect(result.action).toBe('get');
    });
  });

  describe('error handling across commands', () => {
    test('should include timestamp in all error responses', async () => {
      mainWindow.webContents.executeJavaScript.mockRejectedValue(
        new Error('Test error')
      );

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const commands = [
        commandHandlers.export_dom_tree({}),
        commandHandlers.export_dom_computed_styles({}),
        commandHandlers.export_dom_form_state({}),
        commandHandlers.export_dom_text_content({}),
        commandHandlers.export_dom_attributes({}),
        commandHandlers.export_dom_event_listeners({}),
        commandHandlers.export_dom_mutations({})
      ];

      const results = await Promise.all(commands);

      for (const result of results) {
        expect(result.timestamp).toBeDefined();
      }
    });

    test('should log errors appropriately', async () => {
      mainWindow.webContents.executeJavaScript.mockRejectedValue(
        new Error('Execution error')
      );

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      await commandHandlers.export_dom_tree({});

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('parameter validation', () => {
    test('should handle missing parameters gracefully', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        tree: { tagName: 'html' },
        documentTitle: 'Test',
        url: 'http://test.com'
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_tree(undefined);

      expect(result.success).toBe(true);
    });

    test('should use default values for optional parameters', async () => {
      mainWindow.webContents.executeJavaScript.mockResolvedValue({
        success: true,
        styles: []
      });

      registerDOMSnapshotCommands(commandHandlers, mainWindow, { logger: mockLogger });

      const result = await commandHandlers.export_dom_computed_styles({});

      // Should have been called even without selector/limit
      expect(mainWindow.webContents.executeJavaScript).toHaveBeenCalled();
      expect(result.selector).toBe('*');
    });
  });
});
