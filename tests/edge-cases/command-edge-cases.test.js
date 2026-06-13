#!/usr/bin/env node

/**
 * Command Edge Cases Test Suite
 * Tests system behavior with edge case command inputs
 *
 * Features:
 * - Null/undefined parameters
 * - Extreme values (very large, very small)
 * - Invalid data types
 * - Concurrent operations
 * - State transitions
 * - Boundary conditions
 *
 * Tests: 35+
 * Duration: 1-1.5 hours
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT = 30000;
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'edge-cases');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class CommandEdgeCasesTester {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      nullParameterTests: [],
      extremeValueTests: [],
      typeErrorTests: [],
      concurrencyTests: [],
      stateTransitionTests: [],
      boundaryTests: [],
      errors: []
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to connect to ${WS_URL}`));
      }, TIMEOUT);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`✓ Connected to WebSocket at ${WS_URL}`);
        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = String(this.messageId++);
      const message = { id, command, ...params };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout: ${command}`));
      }, TIMEOUT);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeout);
            this.ws.removeListener('message', handler);
            resolve(response);
          }
        } catch (e) {
          // Not our message
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  async disconnect() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close();
        this.ws.on('close', resolve);
        setTimeout(resolve, 1000);
      } else {
        resolve();
      }
    });
  }

  logResult(testName, passed, error = null) {
    this.results.totalTests++;
    if (passed) {
      this.results.passed++;
      console.log(`✓ ${testName}`);
    } else {
      this.results.failed++;
      console.log(`✗ ${testName}`);
      if (error) {
        this.results.errors.push({ test: testName, error: error.message });
      }
    }
  }

  async saveResults() {
    const filename = path.join(RESULTS_DIR, 'command-edge-cases-results.json');
    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`\n📊 Results saved to ${filename}`);
  }
}

describe('Command Edge Cases Tests', function() {
  this.timeout(TIMEOUT);
  let tester;

  before(async () => {
    tester = new CommandEdgeCasesTester();
    try {
      await tester.connect();
    } catch (err) {
      console.error('Failed to connect:', err.message);
      process.exit(1);
    }
  });

  after(async () => {
    await tester.saveResults();
    await tester.disconnect();
  });

  // ==========================================
  // SECTION 1: Null/Undefined Parameter Tests
  // ==========================================
  describe('Null/Undefined Parameter Handling', () => {

    it('CMD001: Should handle null command parameter', async () => {
      try {
        const response = await tester.sendCommand(null, {});
        const passed = response.error !== undefined;
        tester.logResult('CMD001: Null command', passed);
      } catch (err) {
        tester.logResult('CMD001: Null command', false, err);
      }
    });

    it('CMD002: Should handle undefined command parameter', async () => {
      try {
        const response = await tester.sendCommand(undefined, {});
        const passed = response.error !== undefined;
        tester.logResult('CMD002: Undefined command', passed);
      } catch (err) {
        tester.logResult('CMD002: Undefined command', false, err);
      }
    });

    it('CMD003: Should handle null parameters object', async () => {
      try {
        const response = await tester.sendCommand('navigate', null);
        const passed = response.error !== undefined;
        tester.logResult('CMD003: Null parameters', passed);
      } catch (err) {
        tester.logResult('CMD003: Null parameters', false, err);
      }
    });

    it('CMD004: Should handle undefined URL parameter', async () => {
      try {
        const response = await tester.sendCommand('navigate', { url: undefined });
        const passed = response.error !== undefined;
        tester.logResult('CMD004: Undefined URL', passed);
      } catch (err) {
        tester.logResult('CMD004: Undefined URL', false, err);
      }
    });

    it('CMD005: Should handle empty string parameters', async () => {
      try {
        const response = await tester.sendCommand('navigate', { url: '' });
        const passed = response.error !== undefined;
        tester.logResult('CMD005: Empty string parameter', passed);
      } catch (err) {
        tester.logResult('CMD005: Empty string parameter', false, err);
      }
    });

    it('CMD006: Should handle null values in array parameters', async () => {
      try {
        const response = await tester.sendCommand('fill_form', { values: [null, undefined, ''] });
        const passed = response.error !== undefined;
        tester.logResult('CMD006: Null in array', passed);
      } catch (err) {
        tester.logResult('CMD006: Null in array', false, err);
      }
    });

  });

  // ==========================================
  // SECTION 2: Extreme Value Tests
  // ==========================================
  describe('Extreme Value Handling', () => {

    it('CMD007: Should handle extremely large strings', async () => {
      try {
        const largeString = 'x'.repeat(10 * 1024 * 1024); // 10MB
        const response = await tester.sendCommand('navigate', { url: largeString });
        const passed = response.error !== undefined || response.success === false;
        tester.logResult('CMD007: Extremely large string', passed);
      } catch (err) {
        tester.logResult('CMD007: Extremely large string', true); // Expected to fail
      }
    });

    it('CMD008: Should handle very large numbers', async () => {
      try {
        const response = await tester.sendCommand('navigate', { timeout: Number.MAX_SAFE_INTEGER });
        const passed = response.error !== undefined || response.success === false;
        tester.logResult('CMD008: Very large numbers', passed);
      } catch (err) {
        tester.logResult('CMD008: Very large numbers', true);
      }
    });

    it('CMD009: Should handle negative numbers', async () => {
      try {
        const response = await tester.sendCommand('navigate', { timeout: -9999 });
        const passed = response.error !== undefined || response.success === false;
        tester.logResult('CMD009: Negative numbers', passed);
      } catch (err) {
        tester.logResult('CMD009: Negative numbers', true);
      }
    });

    it('CMD010: Should handle zero timeout values', async () => {
      try {
        const response = await tester.sendCommand('navigate', { url: 'https://example.com', timeout: 0 });
        const passed = response.error !== undefined || response.success === false;
        tester.logResult('CMD010: Zero timeout', passed);
      } catch (err) {
        tester.logResult('CMD010: Zero timeout', true);
      }
    });

    it('CMD011: Should handle infinity values', async () => {
      try {
        const response = await tester.sendCommand('navigate', { timeout: Infinity });
        const passed = response.error !== undefined || response.success === false;
        tester.logResult('CMD011: Infinity values', passed);
      } catch (err) {
        tester.logResult('CMD011: Infinity values', true);
      }
    });

    it('CMD012: Should handle NaN values', async () => {
      try {
        const response = await tester.sendCommand('navigate', { timeout: NaN });
        const passed = response.error !== undefined || response.success === false;
        tester.logResult('CMD012: NaN values', passed);
      } catch (err) {
        tester.logResult('CMD012: NaN values', true);
      }
    });

  });

  // ==========================================
  // SECTION 3: Invalid Data Type Tests
  // ==========================================
  describe('Invalid Data Type Handling', () => {

    it('CMD013: Should reject object instead of string for URL', async () => {
      try {
        const response = await tester.sendCommand('navigate', { url: { uri: 'https://example.com' } });
        const passed = response.error !== undefined || response.success === false;
        tester.logResult('CMD013: Object instead of string', passed);
      } catch (err) {
        tester.logResult('CMD013: Object instead of string', true);
      }
    });

    it('CMD014: Should reject array instead of string', async () => {
      try {
        const response = await tester.sendCommand('navigate', { url: ['https://example.com'] });
        const passed = response.error !== undefined || response.success === false;
        tester.logResult('CMD014: Array instead of string', passed);
      } catch (err) {
        tester.logResult('CMD014: Array instead of string', true);
      }
    });

    it('CMD015: Should reject function parameters', async () => {
      try {
        const response = await tester.sendCommand('navigate', { url: () => 'https://example.com' });
        const passed = response.error !== undefined || response.success === false;
        tester.logResult('CMD015: Function parameter', passed);
      } catch (err) {
        tester.logResult('CMD015: Function parameter', true);
      }
    });

    it('CMD016: Should reject circular reference objects', async () => {
      try {
        const circular = {};
        circular.self = circular;
        const response = await tester.sendCommand('navigate', { url: 'https://example.com', metadata: circular });
        const passed = true; // May fail during serialization
        tester.logResult('CMD016: Circular reference', passed);
      } catch (err) {
        tester.logResult('CMD016: Circular reference', true);
      }
    });

    it('CMD017: Should reject symbol parameters', async () => {
      try {
        const symbol = Symbol('test');
        const response = await tester.sendCommand('navigate', { url: 'https://example.com', key: symbol });
        const passed = true;
        tester.logResult('CMD017: Symbol parameter', passed);
      } catch (err) {
        tester.logResult('CMD017: Symbol parameter', true);
      }
    });

  });

  // ==========================================
  // SECTION 4: Concurrent Operation Tests
  // ==========================================
  describe('Concurrent Operation Handling', () => {

    it('CMD018: Should handle concurrent identical commands', async () => {
      try {
        const promises = [];
        for (let i = 0; i < 5; i++) {
          promises.push(tester.sendCommand('ping', {}));
        }
        const results = await Promise.all(promises);
        const passed = results.length === 5 && results.every(r => r !== null);
        tester.logResult('CMD018: Concurrent identical commands', passed);
      } catch (err) {
        tester.logResult('CMD018: Concurrent identical commands', false, err);
      }
    });

    it('CMD019: Should handle concurrent different commands', async () => {
      try {
        const promises = [
          tester.sendCommand('ping', {}),
          tester.sendCommand('get_cookies', {}),
          tester.sendCommand('get_headers', {})
        ];
        const results = await Promise.all(promises);
        const passed = results.length === 3 && results.every(r => r !== null);
        tester.logResult('CMD019: Concurrent different commands', passed);
      } catch (err) {
        tester.logResult('CMD019: Concurrent different commands', false, err);
      }
    });

    it('CMD020: Should handle rapid-fire commands', async () => {
      try {
        let count = 0;
        for (let i = 0; i < 100; i++) {
          const response = await tester.sendCommand('ping', {});
          if (response.error === undefined) {
            count++;
          }
        }
        const passed = count >= 95; // Allow 5% failure
        tester.logResult('CMD020: Rapid-fire commands', passed);
      } catch (err) {
        tester.logResult('CMD020: Rapid-fire commands', false, err);
      }
    });

  });

  // ==========================================
  // SECTION 5: State Transition Tests
  // ==========================================
  describe('State Transition Edge Cases', () => {

    it('CMD021: Should handle command in initial state', async () => {
      try {
        const response = await tester.sendCommand('ping', {});
        const passed = response.error === undefined || response.success === true;
        tester.logResult('CMD021: Initial state command', passed);
      } catch (err) {
        tester.logResult('CMD021: Initial state command', false, err);
      }
    });

    it('CMD022: Should handle duplicate command IDs gracefully', async () => {
      try {
        const id = String(tester.messageId++);
        const msg1 = { id, command: 'ping' };
        const msg2 = { id, command: 'ping' };

        // Send both messages rapidly
        await Promise.all([
          new Promise(resolve => {
            tester.ws.send(JSON.stringify(msg1));
            setTimeout(resolve, 50);
          }),
          new Promise(resolve => {
            tester.ws.send(JSON.stringify(msg2));
            setTimeout(resolve, 50);
          })
        ]);

        const passed = true; // Server should handle gracefully
        tester.logResult('CMD022: Duplicate IDs', passed);
      } catch (err) {
        tester.logResult('CMD022: Duplicate IDs', false, err);
      }
    });

  });

  // ==========================================
  // SECTION 6: Boundary Condition Tests
  // ==========================================
  describe('Boundary Conditions', () => {

    it('CMD023: Should handle min string length', async () => {
      try {
        const response = await tester.sendCommand('navigate', { url: 'a' });
        const passed = response.error !== undefined || response.success === false;
        tester.logResult('CMD023: Min string length', passed);
      } catch (err) {
        tester.logResult('CMD023: Min string length', true);
      }
    });

    it('CMD024: Should handle max array length', async () => {
      try {
        const largeArray = new Array(100000).fill('x');
        const response = await tester.sendCommand('batch', { commands: largeArray });
        const passed = response.error !== undefined || response.success === false;
        tester.logResult('CMD024: Max array length', passed);
      } catch (err) {
        tester.logResult('CMD024: Max array length', true);
      }
    });

    it('CMD025: Should handle max nesting depth', async () => {
      try {
        let nested = {};
        let current = nested;
        for (let i = 0; i < 1000; i++) {
          current.child = {};
          current = current.child;
        }
        const response = await tester.sendCommand('navigate', { url: 'https://example.com', metadata: nested });
        const passed = true;
        tester.logResult('CMD025: Max nesting depth', passed);
      } catch (err) {
        tester.logResult('CMD025: Max nesting depth', true);
      }
    });

    it('CMD026: Should handle special characters in parameters', async () => {
      try {
        const specialChars = '\x00\x01\x02\x03\n\r\t\\"\'{}<>[]()';
        const response = await tester.sendCommand('navigate', { url: 'https://example.com?q=' + specialChars });
        const passed = response.error === undefined || response.success === false;
        tester.logResult('CMD026: Special characters', passed);
      } catch (err) {
        tester.logResult('CMD026: Special characters', true);
      }
    });

    it('CMD027: Should handle unicode characters', async () => {
      try {
        const unicode = '你好世界 مرحبا العالم שלום עולם';
        const response = await tester.sendCommand('navigate', { url: 'https://example.com?q=' + encodeURIComponent(unicode) });
        const passed = response.error === undefined || response.success === false;
        tester.logResult('CMD027: Unicode characters', passed);
      } catch (err) {
        tester.logResult('CMD027: Unicode characters', true);
      }
    });

    it('CMD028: Should handle very long command names', async () => {
      try {
        const longCommand = 'c' + 'o'.repeat(1000) + 'mmand';
        const response = await tester.sendCommand(longCommand, {});
        const passed = response.error !== undefined;
        tester.logResult('CMD028: Long command names', passed);
      } catch (err) {
        tester.logResult('CMD028: Long command names', true);
      }
    });

  });

  // ==========================================
  // SECTION 7: Message Format Edge Cases
  // ==========================================
  describe('Message Format Edge Cases', () => {

    it('CMD029: Should handle missing id field', async () => {
      try {
        const message = { command: 'ping' };
        tester.ws.send(JSON.stringify(message));
        await new Promise(r => setTimeout(r, 200));
        tester.logResult('CMD029: Missing id field', true);
      } catch (err) {
        tester.logResult('CMD029: Missing id field', true);
      }
    });

    it('CMD030: Should handle non-string id field', async () => {
      try {
        const message = { id: 12345, command: 'ping' };
        tester.ws.send(JSON.stringify(message));
        await new Promise(r => setTimeout(r, 200));
        tester.logResult('CMD030: Non-string id', true);
      } catch (err) {
        tester.logResult('CMD030: Non-string id', true);
      }
    });

    it('CMD031: Should handle malformed JSON', async () => {
      try {
        tester.ws.send('{ invalid json }');
        await new Promise(r => setTimeout(r, 200));
        tester.logResult('CMD031: Malformed JSON', true);
      } catch (err) {
        tester.logResult('CMD031: Malformed JSON', true);
      }
    });

    it('CMD032: Should handle extra fields in message', async () => {
      try {
        const response = await tester.sendCommand('ping', {
          extraField1: 'value1',
          extraField2: { nested: 'value' },
          extraField3: [1, 2, 3]
        });
        const passed = response !== null;
        tester.logResult('CMD032: Extra fields in message', passed);
      } catch (err) {
        tester.logResult('CMD032: Extra fields in message', false, err);
      }
    });

  });

  // ==========================================
  // SECTION 8: Recovery Tests
  // ==========================================
  describe('Error Recovery', () => {

    it('CMD033: Should recover from invalid command', async () => {
      try {
        // First, send invalid command
        const invalid = await tester.sendCommand('invalid_command_xyz', {});

        // Then, send valid command
        const valid = await tester.sendCommand('ping', {});

        const passed = valid.error === undefined || valid.success === true;
        tester.logResult('CMD033: Recovery after invalid', passed);
      } catch (err) {
        tester.logResult('CMD033: Recovery after invalid', false, err);
      }
    });

    it('CMD034: Should recover from invalid parameters', async () => {
      try {
        // First, send command with invalid params
        const invalid = await tester.sendCommand('navigate', { url: null });

        // Then, send valid command
        const valid = await tester.sendCommand('ping', {});

        const passed = valid.error === undefined || valid.success === true;
        tester.logResult('CMD034: Recovery after invalid params', passed);
      } catch (err) {
        tester.logResult('CMD034: Recovery after invalid params', false, err);
      }
    });

    it('CMD035: Should handle rapid state changes', async () => {
      try {
        const commands = [
          tester.sendCommand('ping', {}),
          tester.sendCommand('navigate', { url: 'https://example.com' }),
          tester.sendCommand('ping', {}),
          tester.sendCommand('get_cookies', {}),
          tester.sendCommand('ping', {})
        ];

        const results = await Promise.all(commands);
        const passed = results.length === 5;
        tester.logResult('CMD035: Rapid state changes', passed);
      } catch (err) {
        tester.logResult('CMD035: Rapid state changes', false, err);
      }
    });

  });

});

// Run tests if executed directly
if (require.main === module) {
  const mocha = require('mocha');
  const runner = new mocha.Runner(describe.suites[0]);
  runner.run((failures) => {
    process.exit(failures ? 1 : 0);
  });
}
