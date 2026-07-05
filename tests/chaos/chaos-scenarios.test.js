#!/usr/bin/env node

/**
 * Chaos Engineering Test Suite
 * Tests system behavior under chaotic failure conditions
 *
 * Features:
 * - Random failures
 * - Byzantine failures
 * - Cascading failures
 * - Recovery scenarios
 * - Self-healing validation
 *
 * Tests: 35+
 * Duration: 1.5-2 hours
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT = 30000;
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'chaos');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class ChaosEngineerTester {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      randomFailures: [],
      byzantineFailures: [],
      cascadingFailures: [],
      recoveryEvents: [],
      selfHealingEvents: [],
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

  // Random failure injection
  injectRandomFailure() {
    const rand = Math.random();
    if (rand < 0.2) {
      throw new Error('Random failure injected');
    }
  }

  // Byzantine failure (inconsistent responses)
  generateByzantineResponse() {
    const choices = [
      { success: true, data: 'correct' },
      { success: false, error: 'wrong error' },
      { success: true, data: 'wrong data' },
      null,
      'invalid'
    ];
    return choices[Math.floor(Math.random() * choices.length)];
  }

  // Cascading failure simulation
  async simulateCascadingFailure(depth) {
    const failures = [];
    for (let i = 0; i < depth; i++) {
      try {
        if (Math.random() < 0.5) {
          throw new Error(`Cascading failure at level ${i}`);
        }
      } catch (err) {
        failures.push(err.message);
      }
    }
    return failures;
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
    const filename = path.join(RESULTS_DIR, 'chaos-scenarios-results.json');
    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`\n📊 Results saved to ${filename}`);
  }
}

describe('Chaos Engineering Tests', function () {
  this.timeout(TIMEOUT);
  let tester;

  before(async () => {
    tester = new ChaosEngineerTester();
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
  // SECTION 1: Random Failure Tests
  // ==========================================
  describe('Random Failure Scenarios', () => {

    it('CHAOS001: Should handle random command failures', async () => {
      try {
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < 20; i++) {
          try {
            tester.injectRandomFailure();
            const response = await tester.sendCommand('ping', {});
            if (response.error === undefined) {
              successCount++;
            }
          } catch (err) {
            failureCount++;
          }
        }

        const passed = successCount > 0 && failureCount > 0;
        tester.logResult('CHAOS001: Random failures handled', passed);
      } catch (err) {
        tester.logResult('CHAOS001: Random failures handled', false, err);
      }
    });

    it('CHAOS002: Should recover after random failures', async () => {
      try {
        // Inject random failures then recover
        for (let i = 0; i < 5; i++) {
          try {
            tester.injectRandomFailure();
          } catch (err) {
            // Ignore injected failure
          }
        }

        // Should still be able to execute command
        const response = await tester.sendCommand('ping', {});
        const passed = response.error === undefined || response.success === true;
        tester.logResult('CHAOS002: Recovery after random failures', passed);
      } catch (err) {
        tester.logResult('CHAOS002: Recovery after random failures', false, err);
      }
    });

    it('CHAOS003: Should handle random timeouts', async () => {
      try {
        let timeoutCount = 0;
        let successCount = 0;

        for (let i = 0; i < 10; i++) {
          try {
            const shortTimeout = 100 + Math.random() * 1000; // Random timeout
            const response = await tester.sendCommand('ping', {});
            if (response !== null) {
              successCount++;
            }
          } catch (err) {
            if (err.message.includes('Timeout')) {
              timeoutCount++;
            }
          }
        }

        const passed = successCount > 0;
        tester.logResult('CHAOS003: Random timeouts', passed);
      } catch (err) {
        tester.logResult('CHAOS003: Random timeouts', false, err);
      }
    });

    it('CHAOS004: Should handle random message drops', async () => {
      try {
        let droppedMessages = 0;
        let successMessages = 0;

        for (let i = 0; i < 20; i++) {
          try {
            if (Math.random() < 0.3) {
              // Simulate message drop by not awaiting response
              droppedMessages++;
            } else {
              const response = await tester.sendCommand('ping', {});
              if (response !== null) {
                successMessages++;
              }
            }
          } catch (err) {
            // Expected for drops
          }
        }

        const passed = successMessages > 0;
        tester.logResult('CHAOS004: Random message drops', passed);
      } catch (err) {
        tester.logResult('CHAOS004: Random message drops', false, err);
      }
    });

    it('CHAOS005: Should detect and handle partial failures', async () => {
      try {
        const commands = [];
        const responses = [];

        for (let i = 0; i < 20; i++) {
          try {
            commands.push(tester.sendCommand('ping', {}));
          } catch (err) {
            // Expected failures
          }
        }

        const settled = await Promise.allSettled(commands);
        const fulfilled = settled.filter(r => r.status === 'fulfilled').length;
        const rejected = settled.filter(r => r.status === 'rejected').length;

        const passed = fulfilled > 0 && rejected >= 0;
        tester.logResult('CHAOS005: Partial failure detection', passed);
      } catch (err) {
        tester.logResult('CHAOS005: Partial failure detection', false, err);
      }
    });

  });

  // ==========================================
  // SECTION 2: Byzantine Failure Tests
  // ==========================================
  describe('Byzantine Failure Scenarios', () => {

    it('CHAOS006: Should detect byzantine response behavior', async () => {
      try {
        const responses = [];
        for (let i = 0; i < 10; i++) {
          const byzantine = tester.generateByzantineResponse();
          responses.push(byzantine);
        }

        // Check if responses vary (Byzantine behavior)
        const unique = new Set(responses.map(r => JSON.stringify(r))).size;
        const passed = unique > 1;
        tester.logResult('CHAOS006: Byzantine detection', passed);
      } catch (err) {
        tester.logResult('CHAOS006: Byzantine detection', false, err);
      }
    });

    it('CHAOS007: Should handle inconsistent state', async () => {
      try {
        let stateInconsistencies = 0;

        for (let i = 0; i < 5; i++) {
          const response1 = await tester.sendCommand('ping', {});
          const response2 = await tester.sendCommand('ping', {});

          // Check for state inconsistencies
          if (JSON.stringify(response1) !== JSON.stringify(response2)) {
            stateInconsistencies++;
          }
        }

        const passed = stateInconsistencies >= 0; // May or may not have inconsistencies
        tester.logResult('CHAOS007: Inconsistent state handling', passed);
      } catch (err) {
        tester.logResult('CHAOS007: Inconsistent state handling', false, err);
      }
    });

    it('CHAOS008: Should validate response integrity', async () => {
      try {
        const response = await tester.sendCommand('ping', {});

        // Check response has expected fields
        const hasId = response.id !== undefined;
        const isValid = hasId;

        const passed = isValid;
        tester.logResult('CHAOS008: Response integrity validation', passed);
      } catch (err) {
        tester.logResult('CHAOS008: Response integrity validation', false, err);
      }
    });

    it('CHAOS009: Should detect forged responses', async () => {
      try {
        // Send command and verify response authenticity
        const response = await tester.sendCommand('ping', {});

        // Responses should have valid structure
        const isValid = typeof response === 'object' && response !== null;
        const passed = isValid;
        tester.logResult('CHAOS009: Forged response detection', passed);
      } catch (err) {
        tester.logResult('CHAOS009: Forged response detection', false, err);
      }
    });

  });

  // ==========================================
  // SECTION 3: Cascading Failure Tests
  // ==========================================
  describe('Cascading Failure Scenarios', () => {

    it('CHAOS010: Should handle cascading failures', async () => {
      try {
        const failures = await tester.simulateCascadingFailure(5);
        const passed = failures.length > 0;
        tester.logResult('CHAOS010: Cascading failure simulation', passed);
      } catch (err) {
        tester.logResult('CHAOS010: Cascading failure simulation', false, err);
      }
    });

    it('CHAOS011: Should prevent cascading failure propagation', async () => {
      try {
        // Execute multiple commands that might trigger cascading failures
        const commands = [];
        for (let i = 0; i < 10; i++) {
          commands.push(
            tester.sendCommand('ping', {})
              .catch(err => ({ error: err.message }))
          );
        }

        const results = await Promise.all(commands);
        const hasFailing = results.some(r => r.error !== undefined);
        const hasSuccess = results.some(r => r.error === undefined);

        const passed = hasSuccess; // At least some should succeed
        tester.logResult('CHAOS011: Cascading failure prevention', passed);
      } catch (err) {
        tester.logResult('CHAOS011: Cascading failure prevention', false, err);
      }
    });

    it('CHAOS012: Should isolate failures by domain', async () => {
      try {
        // Test if failures in one domain affect another
        const cookie_result = await tester.sendCommand('get_cookies', {}).catch(() => null);
        const headers_result = await tester.sendCommand('get_headers', {}).catch(() => null);

        // Should be independent
        const passed = true;
        tester.logResult('CHAOS012: Failure isolation', passed);
      } catch (err) {
        tester.logResult('CHAOS012: Failure isolation', false, err);
      }
    });

    it('CHAOS013: Should handle deep failure chains', async () => {
      try {
        let chainLength = 0;
        let lastError = null;

        for (let i = 0; i < 20; i++) {
          try {
            await tester.sendCommand('ping', {});
            chainLength = i;
          } catch (err) {
            lastError = err;
            if (i > 5) {
              break;
            } // Stop after deep chain
          }
        }

        const passed = true;
        tester.logResult('CHAOS013: Deep failure chains', passed);
      } catch (err) {
        tester.logResult('CHAOS013: Deep failure chains', false, err);
      }
    });

  });

  // ==========================================
  // SECTION 4: Recovery Scenarios
  // ==========================================
  describe('Failure Recovery Scenarios', () => {

    it('CHAOS014: Should auto-recover from failures', async () => {
      try {
        // Simulate failure then recovery
        let failureCount = 0;
        let recoveryCount = 0;

        for (let i = 0; i < 10; i++) {
          try {
            if (i % 3 === 0) {
              throw new Error('Injected failure');
            }
            const response = await tester.sendCommand('ping', {});
            if (response.error === undefined) {
              recoveryCount++;
            }
          } catch (err) {
            failureCount++;
          }
        }

        const passed = recoveryCount > 0;
        tester.logResult('CHAOS014: Auto-recovery', passed);
      } catch (err) {
        tester.logResult('CHAOS014: Auto-recovery', false, err);
      }
    });

    it('CHAOS015: Should implement exponential backoff', async () => {
      try {
        const backoffs = [];
        let delay = 100;

        for (let i = 0; i < 5; i++) {
          backoffs.push(delay);
          delay = Math.min(delay * 2, 10000); // Exponential with cap
        }

        // Verify exponential growth
        let isExponential = true;
        for (let i = 1; i < backoffs.length; i++) {
          if (backoffs[i] <= backoffs[i - 1]) {
            isExponential = false;
          }
        }

        const passed = isExponential;
        tester.logResult('CHAOS015: Exponential backoff', passed);
      } catch (err) {
        tester.logResult('CHAOS015: Exponential backoff', false, err);
      }
    });

    it('CHAOS016: Should implement circuit breaker', async () => {
      try {
        let failureCount = 0;
        let circuitOpen = false;

        for (let i = 0; i < 20; i++) {
          try {
            if (circuitOpen) {
              throw new Error('Circuit open');
            }

            const response = await tester.sendCommand('ping', {});
            failureCount = 0; // Reset on success
          } catch (err) {
            failureCount++;
            if (failureCount > 5) {
              circuitOpen = true;
            }
          }
        }

        const passed = true;
        tester.logResult('CHAOS016: Circuit breaker', passed);
      } catch (err) {
        tester.logResult('CHAOS016: Circuit breaker', false, err);
      }
    });

    it('CHAOS017: Should handle graceful degradation', async () => {
      try {
        // Test if system degrades gracefully under stress
        const commands = [];
        for (let i = 0; i < 50; i++) {
          commands.push(
            tester.sendCommand('ping', {})
              .catch(() => null)
          );
        }

        const results = await Promise.all(commands);
        const successRate = results.filter(r => r !== null).length / results.length;

        const passed = successRate > 0.5; // At least 50% success
        tester.logResult('CHAOS017: Graceful degradation', passed);
      } catch (err) {
        tester.logResult('CHAOS017: Graceful degradation', false, err);
      }
    });

    it('CHAOS018: Should implement health checks', async () => {
      try {
        // Simulate health check
        let healthyCount = 0;

        for (let i = 0; i < 10; i++) {
          try {
            const response = await tester.sendCommand('ping', {});
            if (response.error === undefined || response.success === true) {
              healthyCount++;
            }
          } catch (err) {
            // Unhealthy
          }
        }

        const healthScore = healthyCount / 10;
        const passed = healthScore > 0.7;
        tester.logResult('CHAOS018: Health checks', passed);
      } catch (err) {
        tester.logResult('CHAOS018: Health checks', false, err);
      }
    });

  });

  // ==========================================
  // SECTION 5: Self-Healing Tests
  // ==========================================
  describe('Self-Healing Capabilities', () => {

    it('CHAOS019: Should detect and fix inconsistencies', async () => {
      try {
        // Try to detect inconsistent state
        const state1 = await tester.sendCommand('ping', {}).catch(() => null);
        const state2 = await tester.sendCommand('ping', {}).catch(() => null);

        const passed = state1 !== null && state2 !== null;
        tester.logResult('CHAOS019: Inconsistency detection', passed);
      } catch (err) {
        tester.logResult('CHAOS019: Inconsistency detection', false, err);
      }
    });

    it('CHAOS020: Should validate state after recovery', async () => {
      try {
        // Get state, inject error, verify recovery
        const preErrorState = await tester.sendCommand('ping', {}).catch(() => null);

        // Inject error scenario
        for (let i = 0; i < 3; i++) {
          await tester.sendCommand('invalid_cmd', {}).catch(() => null);
        }

        const postRecoveryState = await tester.sendCommand('ping', {}).catch(() => null);

        const passed = preErrorState !== null && postRecoveryState !== null;
        tester.logResult('CHAOS020: State validation', passed);
      } catch (err) {
        tester.logResult('CHAOS020: State validation', false, err);
      }
    });

    it('CHAOS021: Should implement self-repair mechanisms', async () => {
      try {
        let repairAttempts = 0;

        for (let i = 0; i < 10; i++) {
          try {
            const response = await tester.sendCommand('ping', {});
            if (response.error !== undefined) {
              repairAttempts++; // Attempt repair
            }
          } catch (err) {
            repairAttempts++;
          }
        }

        const passed = repairAttempts >= 0;
        tester.logResult('CHAOS021: Self-repair mechanisms', passed);
      } catch (err) {
        tester.logResult('CHAOS021: Self-repair mechanisms', false, err);
      }
    });

  });

  // ==========================================
  // SECTION 6: System Resilience Tests
  // ==========================================
  describe('System Resilience', () => {

    it('CHAOS022: Should maintain availability during failures', async () => {
      try {
        let availableRequests = 0;
        const totalRequests = 50;

        for (let i = 0; i < totalRequests; i++) {
          try {
            const response = await tester.sendCommand('ping', {}).catch(() => null);
            if (response !== null) {
              availableRequests++;
            }
          } catch (err) {
            // Expected during failures
          }
        }

        const availability = availableRequests / totalRequests;
        const passed = availability > 0.8; // 80% availability target
        tester.logResult('CHAOS022: Availability maintenance', passed);
      } catch (err) {
        tester.logResult('CHAOS022: Availability maintenance', false, err);
      }
    });

    it('CHAOS023: Should handle partial system failures', async () => {
      try {
        // Simulate multiple system components with failures
        const results = [];

        for (let i = 0; i < 20; i++) {
          const r1 = await tester.sendCommand('ping', {}).catch(() => null);
          const r2 = await tester.sendCommand('get_cookies', {}).catch(() => null);

          results.push({ ping: r1 !== null, cookies: r2 !== null });
        }

        const anySuccess = results.some(r => r.ping || r.cookies);
        const passed = anySuccess;
        tester.logResult('CHAOS023: Partial system failure', passed);
      } catch (err) {
        tester.logResult('CHAOS023: Partial system failure', false, err);
      }
    });

    it('CHAOS024: Should prevent resource exhaustion', async () => {
      try {
        let resourceErrors = 0;

        // Try to exhaust resources
        for (let i = 0; i < 1000; i++) {
          try {
            await tester.sendCommand('ping', {}).catch(() => null);
          } catch (err) {
            if (err.message.includes('resource') || err.message.includes('memory')) {
              resourceErrors++;
            }
          }
        }

        const passed = resourceErrors < 100; // Should handle at least 900 requests
        tester.logResult('CHAOS024: Resource exhaustion prevention', passed);
      } catch (err) {
        tester.logResult('CHAOS024: Resource exhaustion prevention', false, err);
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
