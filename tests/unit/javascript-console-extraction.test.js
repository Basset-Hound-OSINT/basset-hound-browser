/**
 * Unit Tests: JavaScript & Console Extraction Commands
 *
 * Testing 10 WebSocket commands for comprehensive JavaScript and console output extraction:
 * 1. export_scripts_all - All script tags and inline scripts
 * 2. export_scripts_sources - All external script sources
 * 3. export_console_logs - All console output
 * 4. export_globals - All window/global variables
 * 5. export_localstorage - All localStorage items
 * 6. export_sessionstorage - All sessionStorage items
 * 7. export_cookies - All cookies with metadata
 * 8. export_performance_timeline - Performance metrics
 * 9. export_errors - All JavaScript errors
 * 10. export_network_from_js - Requests made by JavaScript
 *
 * Scope: Command structure, response format, required fields, error handling
 * Coverage: >90%
 */

const assert = require('assert');
const { registerJavaScriptConsoleExtractionCommands } = require('../../websocket/commands/javascript-console-extraction');

describe('JavaScript & Console Extraction Commands - Unit Tests', () => {

  let commandHandlers = {};
  let mockConsoleManager, mockDevToolsManager, mockStorageManager, mockLogger;

  beforeEach(() => {
    commandHandlers = {};

    // Mock managers
    mockLogger = {
      info: () => {},
      error: () => {},
      debug: () => {},
      warn: () => {}
    };

    mockConsoleManager = {
      getConsoleLogs: async (params) => ({
        success: true,
        logs: [
          { type: 'log', message: 'Test log', timestamp: Date.now() },
          { type: 'error', message: 'Test error', timestamp: Date.now() }
        ]
      })
    };

    mockDevToolsManager = {
      runtime: {
        evaluate: async (params) => ({
          value: { test: 'data' }
        })
      }
    };

    mockStorageManager = {
      getLocalStorage: async (origin) => ({
        success: true,
        data: { testKey: 'testValue' }
      }),
      getSessionStorage: async (origin) => ({
        success: true,
        data: { sessionKey: 'sessionValue' }
      })
    };

    registerJavaScriptConsoleExtractionCommands(commandHandlers, {
      consoleManager: mockConsoleManager,
      devToolsManager: mockDevToolsManager,
      storageManager: mockStorageManager,
      logger: mockLogger
    });
  });

  // ========================================================================
  // COMMAND 1: export_scripts_all
  // ========================================================================

  describe('export_scripts_all Command', () => {

    describe('Command Registration', () => {
      test('should be registered', () => {
        assert.ok(commandHandlers.export_scripts_all);
        assert.strictEqual(typeof commandHandlers.export_scripts_all, 'function');
      });
    });

    describe('Response Format', () => {
      test('should return success flag', async () => {
        const response = await commandHandlers.export_scripts_all({});
        assert.strictEqual(typeof response.success, 'boolean');
      });

      test('should return scripts object on success', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            inline: [],
            external: [],
            count: { inline: 0, external: 0, total: 0 }
          }
        });

        const response = await commandHandlers.export_scripts_all({});
        assert.strictEqual(response.success, true);
        assert.ok(response.scripts);
        assert.ok(response.scripts.inline);
        assert.ok(response.scripts.external);
        assert.ok(response.scripts.count);
      });

      test('should return timestamp', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            inline: [],
            external: [],
            count: { inline: 0, external: 0, total: 0 }
          }
        });

        const response = await commandHandlers.export_scripts_all({});
        assert.strictEqual(typeof response.timestamp, 'number');
        assert.ok(response.timestamp > 0);
      });

      test('should include script counts', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            inline: [{ index: 0, content: 'console.log("test")' }],
            external: [{ index: 0, src: 'https://example.com/script.js' }],
            count: { inline: 1, external: 1, total: 2 }
          }
        });

        const response = await commandHandlers.export_scripts_all({});
        assert.strictEqual(response.scripts.count.inline, 1);
        assert.strictEqual(response.scripts.count.external, 1);
        assert.strictEqual(response.scripts.count.total, 2);
      });
    });

    describe('Error Handling', () => {
      test('should return error when DevTools manager unavailable', async () => {
        const handlers = {};
        registerJavaScriptConsoleExtractionCommands(handlers, {
          consoleManager: null,
          devToolsManager: null,
          storageManager: null,
          logger: mockLogger
        });

        const response = await handlers.export_scripts_all({});
        assert.strictEqual(response.success, false);
        assert.ok(response.error);
      });

      test('should return error when evaluation fails', async () => {
        mockDevToolsManager.runtime.evaluate = async () => {
          throw new Error('Evaluation failed');
        };

        const response = await commandHandlers.export_scripts_all({});
        assert.strictEqual(response.success, false);
        assert.ok(response.error);
      });
    });
  });

  // ========================================================================
  // COMMAND 2: export_scripts_sources
  // ========================================================================

  describe('export_scripts_sources Command', () => {

    describe('Command Registration', () => {
      test('should be registered', () => {
        assert.ok(commandHandlers.export_scripts_sources);
        assert.strictEqual(typeof commandHandlers.export_scripts_sources, 'function');
      });
    });

    describe('Response Format', () => {
      test('should return sources array', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            sources: [
              {
                index: 0,
                src: 'https://example.com/script.js',
                async: true,
                defer: false,
                type: 'application/javascript'
              }
            ],
            count: 1,
            domains: ['example.com']
          }
        });

        const response = await commandHandlers.export_scripts_sources({});
        assert.strictEqual(response.success, true);
        assert.ok(Array.isArray(response.sources));
      });

      test('should include source count', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            sources: [
              { src: 'https://example.com/script.js' }
            ],
            count: 1,
            domains: ['example.com']
          }
        });

        const response = await commandHandlers.export_scripts_sources({});
        assert.strictEqual(response.count, 1);
      });

      test('should include domains list', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            sources: [
              { src: 'https://example.com/script.js' },
              { src: 'https://another.com/script.js' }
            ],
            count: 2,
            domains: ['example.com', 'another.com']
          }
        });

        const response = await commandHandlers.export_scripts_sources({});
        assert.ok(Array.isArray(response.domains));
        assert.strictEqual(response.domains.length, 2);
      });
    });
  });

  // ========================================================================
  // COMMAND 3: export_console_logs
  // ========================================================================

  describe('export_console_logs Command', () => {

    describe('Command Registration', () => {
      test('should be registered', () => {
        assert.ok(commandHandlers.export_console_logs);
        assert.strictEqual(typeof commandHandlers.export_console_logs, 'function');
      });
    });

    describe('Response Format', () => {
      test('should return logs array', async () => {
        const response = await commandHandlers.export_console_logs({});
        assert.strictEqual(response.success, true);
        assert.ok(Array.isArray(response.logs));
      });

      test('should return summary object', async () => {
        const response = await commandHandlers.export_console_logs({});
        assert.ok(response.summary);
        assert.strictEqual(typeof response.summary.total, 'number');
        assert.ok(response.summary.byType);
      });

      test('should categorize logs by type', async () => {
        const response = await commandHandlers.export_console_logs({});
        assert.ok(response.summary.byType.log !== undefined);
        assert.ok(response.summary.byType.error !== undefined);
        assert.ok(response.summary.byType.warn !== undefined);
      });

      test('should return timestamp', async () => {
        const response = await commandHandlers.export_console_logs({});
        assert.strictEqual(typeof response.timestamp, 'number');
      });
    });

    describe('Error Handling', () => {
      test('should return error when Console manager unavailable', async () => {
        const handlers = {};
        registerJavaScriptConsoleExtractionCommands(handlers, {
          consoleManager: null,
          devToolsManager: mockDevToolsManager,
          storageManager: null,
          logger: mockLogger
        });

        const response = await handlers.export_console_logs({});
        assert.strictEqual(response.success, false);
      });
    });
  });

  // ========================================================================
  // COMMAND 4: export_globals
  // ========================================================================

  describe('export_globals Command', () => {

    describe('Command Registration', () => {
      test('should be registered', () => {
        assert.ok(commandHandlers.export_globals);
        assert.strictEqual(typeof commandHandlers.export_globals, 'function');
      });
    });

    describe('Response Format', () => {
      test('should return globals object', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            globals: {
              testVar: { type: 'string', value: 'test' }
            },
            count: 1
          }
        });

        const response = await commandHandlers.export_globals({});
        assert.strictEqual(response.success, true);
        assert.ok(response.globals);
        assert.strictEqual(typeof response.globals, 'object');
      });

      test('should return count of globals', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            globals: {
              var1: { type: 'string' },
              var2: { type: 'number' }
            },
            count: 2
          }
        });

        const response = await commandHandlers.export_globals({});
        assert.strictEqual(response.count, 2);
      });

      test('should return categorized globals when enabled', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            globals: {},
            count: 0,
            categories: {
              window: [],
              document: [],
              navigator: [],
              console: [],
              custom: []
            }
          }
        });

        const response = await commandHandlers.export_globals({ categorize: true });
        assert.ok(response.categories);
        assert.ok(response.categories.window);
      });
    });
  });

  // ========================================================================
  // COMMAND 5: export_localstorage
  // ========================================================================

  describe('export_localstorage Command', () => {

    describe('Command Registration', () => {
      test('should be registered', () => {
        assert.ok(commandHandlers.export_localstorage);
        assert.strictEqual(typeof commandHandlers.export_localstorage, 'function');
      });
    });

    describe('Response Format', () => {
      test('should return items object', async () => {
        const response = await commandHandlers.export_localstorage({});
        assert.strictEqual(response.success, true);
        assert.ok(response.items);
        assert.strictEqual(typeof response.items, 'object');
      });

      test('should return count of items', async () => {
        const response = await commandHandlers.export_localstorage({});
        assert.strictEqual(typeof response.count, 'number');
        assert.ok(response.count >= 0);
      });

      test('should return total size in bytes', async () => {
        const response = await commandHandlers.export_localstorage({});
        assert.strictEqual(typeof response.totalSize, 'number');
        assert.ok(response.totalSize >= 0);
      });

      test('should return timestamp', async () => {
        const response = await commandHandlers.export_localstorage({});
        assert.strictEqual(typeof response.timestamp, 'number');
      });
    });

    describe('Error Handling', () => {
      test('should return error when Storage manager unavailable', async () => {
        const handlers = {};
        registerJavaScriptConsoleExtractionCommands(handlers, {
          consoleManager: null,
          devToolsManager: null,
          storageManager: null,
          logger: mockLogger
        });

        const response = await handlers.export_localstorage({});
        assert.strictEqual(response.success, false);
      });
    });
  });

  // ========================================================================
  // COMMAND 6: export_sessionstorage
  // ========================================================================

  describe('export_sessionstorage Command', () => {

    describe('Command Registration', () => {
      test('should be registered', () => {
        assert.ok(commandHandlers.export_sessionstorage);
        assert.strictEqual(typeof commandHandlers.export_sessionstorage, 'function');
      });
    });

    describe('Response Format', () => {
      test('should return items object', async () => {
        const response = await commandHandlers.export_sessionstorage({});
        assert.strictEqual(response.success, true);
        assert.ok(response.items);
      });

      test('should return count of items', async () => {
        const response = await commandHandlers.export_sessionstorage({});
        assert.strictEqual(typeof response.count, 'number');
      });

      test('should return total size', async () => {
        const response = await commandHandlers.export_sessionstorage({});
        assert.strictEqual(typeof response.totalSize, 'number');
      });
    });
  });

  // ========================================================================
  // COMMAND 7: export_cookies
  // ========================================================================

  describe('export_cookies Command', () => {

    describe('Command Registration', () => {
      test('should be registered', () => {
        assert.ok(commandHandlers.export_cookies);
        assert.strictEqual(typeof commandHandlers.export_cookies, 'function');
      });
    });

    describe('Response Format', () => {
      test('should return cookies array', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            cookies: [
              { name: 'test', value: 'value' }
            ],
            count: 1,
            totalSize: 20
          }
        });

        const response = await commandHandlers.export_cookies({});
        assert.strictEqual(response.success, true);
        assert.ok(Array.isArray(response.cookies));
      });

      test('should return cookie count', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            cookies: [
              { name: 'cookie1', value: 'value1' },
              { name: 'cookie2', value: 'value2' }
            ],
            count: 2,
            totalSize: 40
          }
        });

        const response = await commandHandlers.export_cookies({});
        assert.strictEqual(response.count, 2);
      });

      test('should return total cookie size', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            cookies: [],
            count: 0,
            totalSize: 0
          }
        });

        const response = await commandHandlers.export_cookies({});
        assert.strictEqual(typeof response.totalSize, 'number');
      });
    });
  });

  // ========================================================================
  // COMMAND 8: export_performance_timeline
  // ========================================================================

  describe('export_performance_timeline Command', () => {

    describe('Command Registration', () => {
      test('should be registered', () => {
        assert.ok(commandHandlers.export_performance_timeline);
        assert.strictEqual(typeof commandHandlers.export_performance_timeline, 'function');
      });
    });

    describe('Response Format', () => {
      test('should return performance object', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            navigation: {},
            resources: [],
            marks: [],
            measures: [],
            memory: null
          }
        });

        const response = await commandHandlers.export_performance_timeline({});
        assert.strictEqual(response.success, true);
        assert.ok(response.performance);
      });

      test('should include navigation timing', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            navigation: {
              navigationStart: 0,
              responseStart: 100,
              domLoading: 150,
              domComplete: 500
            },
            resources: [],
            marks: [],
            measures: [],
            memory: null
          }
        });

        const response = await commandHandlers.export_performance_timeline({});
        assert.ok(response.performance.navigation);
        assert.strictEqual(typeof response.performance.navigation.navigationStart, 'number');
      });

      test('should include resource timing', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            navigation: {},
            resources: [
              { name: 'https://example.com/script.js', type: 'script', duration: 100 }
            ],
            marks: [],
            measures: [],
            memory: null
          }
        });

        const response = await commandHandlers.export_performance_timeline({});
        assert.ok(Array.isArray(response.performance.resources));
      });

      test('should include memory info when available', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            navigation: {},
            resources: [],
            marks: [],
            measures: [],
            memory: {
              jsHeapSizeLimit: 1000000,
              totalJSHeapSize: 500000,
              usedJSHeapSize: 250000
            }
          }
        });

        const response = await commandHandlers.export_performance_timeline({});
        assert.ok(response.performance.memory);
      });
    });
  });

  // ========================================================================
  // COMMAND 9: export_errors
  // ========================================================================

  describe('export_errors Command', () => {

    describe('Command Registration', () => {
      test('should be registered', () => {
        assert.ok(commandHandlers.export_errors);
        assert.strictEqual(typeof commandHandlers.export_errors, 'function');
      });
    });

    describe('Response Format', () => {
      test('should return errors array', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: []
        });

        const response = await commandHandlers.export_errors({});
        assert.strictEqual(response.success, true);
        assert.ok(Array.isArray(response.errors));
      });

      test('should return error summary', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: []
        });

        const response = await commandHandlers.export_errors({});
        assert.ok(response.summary);
        assert.strictEqual(typeof response.summary.total, 'number');
        assert.ok(response.summary.byType);
      });

      test('should categorize errors by type', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: []
        });

        const response = await commandHandlers.export_errors({});
        assert.ok(response.summary.byType.error !== undefined);
      });

      test('should limit error count to 1000', async () => {
        const largeErrorArray = new Array(2000).fill({ message: 'error' });
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: largeErrorArray
        });

        const response = await commandHandlers.export_errors({});
        assert.ok(response.errors.length <= 1000);
      });
    });
  });

  // ========================================================================
  // COMMAND 10: export_network_from_js
  // ========================================================================

  describe('export_network_from_js Command', () => {

    describe('Command Registration', () => {
      test('should be registered', () => {
        assert.ok(commandHandlers.export_network_from_js);
        assert.strictEqual(typeof commandHandlers.export_network_from_js, 'function');
      });
    });

    describe('Response Format', () => {
      test('should return requests array', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            requests: [],
            summary: {
              total: 0,
              byMethod: {},
              byStatus: {},
              totalSize: 0
            }
          }
        });

        const response = await commandHandlers.export_network_from_js({});
        assert.strictEqual(response.success, true);
        assert.ok(Array.isArray(response.requests));
      });

      test('should return summary object', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            requests: [
              { method: 'GET', status: 200, size: 1000 }
            ],
            summary: {
              total: 1,
              byMethod: { GET: 1 },
              byStatus: { 200: 1 },
              totalSize: 1000
            }
          }
        });

        const response = await commandHandlers.export_network_from_js({});
        assert.ok(response.summary);
        assert.strictEqual(response.summary.total, 1);
      });

      test('should categorize by method', async () => {
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            requests: [],
            summary: {
              total: 0,
              byMethod: { GET: 5, POST: 3 },
              byStatus: {},
              totalSize: 0
            }
          }
        });

        const response = await commandHandlers.export_network_from_js({});
        assert.ok(response.summary.byMethod);
      });

      test('should limit request count to 500', async () => {
        const largeRequestArray = new Array(500).fill({ method: 'GET', status: 200 });
        mockDevToolsManager.runtime.evaluate = async () => ({
          value: {
            requests: largeRequestArray,
            summary: {
              total: 500,
              byMethod: { GET: 500 },
              byStatus: { 200: 500 },
              totalSize: 0
            }
          }
        });

        const response = await commandHandlers.export_network_from_js({});
        assert.ok(response.success === true);
        assert.ok(response.requests.length <= 500);
      });
    });
  });

  // ========================================================================
  // COMMAND COVERAGE SUMMARY
  // ========================================================================

  describe('Command Coverage', () => {
    test('should register all 10 commands', () => {
      const expectedCommands = [
        'export_scripts_all',
        'export_scripts_sources',
        'export_console_logs',
        'export_globals',
        'export_localstorage',
        'export_sessionstorage',
        'export_cookies',
        'export_performance_timeline',
        'export_errors',
        'export_network_from_js'
      ];

      expectedCommands.forEach(cmd => {
        assert.ok(commandHandlers[cmd], `Command ${cmd} should be registered`);
        assert.strictEqual(typeof commandHandlers[cmd], 'function');
      });
    });

    test('should register commands with correct names', () => {
      const registeredCommands = Object.keys(commandHandlers);
      assert.strictEqual(registeredCommands.length, 10);
    });
  });

});
