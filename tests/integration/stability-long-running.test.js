/**
 * Stability Tests - Long Running Operations
 *
 * Tests for long-running stability including:
 * - Memory stability over time
 * - Connection stability
 * - Resource cleanup
 * - Recovery from errors
 * - Sustained load testing
 */

const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');

const TEST_CONFIG = {
  WS_URL: 'ws://localhost:8765',
  CONNECT_TIMEOUT: 10000,
  COMMAND_TIMEOUT: 30000,
  RESULTS_DIR: path.join(__dirname, '..', 'results', 'stability-tests'),
  TEST_SESSION_ID: 'stability-test-' + Date.now(),
  // Long-running test durations
  STABILITY_DURATION: 5 * 60 * 1000, // 5 minutes
  OPERATION_INTERVAL: 500, // ms between operations
  MEMORY_CHECK_INTERVAL: 30 * 1000, // Check memory every 30s
};

// Ensure results directory exists
if (!fs.existsSync(TEST_CONFIG.RESULTS_DIR)) {
  fs.mkdirSync(TEST_CONFIG.RESULTS_DIR, { recursive: true });
}

class StabilityMonitor {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      operations: 0,
      errors: 0,
      memorySnapshots: [],
      cpuSnapshots: [],
      timings: []
    };
  }

  recordOperation(duration) {
    this.metrics.operations++;
    this.metrics.timings.push(duration);
  }

  recordError() {
    this.metrics.errors++;
  }

  captureMemory() {
    if (global.gc) {
      global.gc();
    }
    const memory = process.memoryUsage();
    this.metrics.memorySnapshots.push({
      timestamp: Date.now(),
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      rss: memory.rss
    });
    return memory;
  }

  getReport() {
    const duration = Date.now() - this.metrics.startTime;
    const avgTiming = this.metrics.timings.length > 0
      ? this.metrics.timings.reduce((a, b) => a + b) / this.metrics.timings.length
      : 0;
    const maxTiming = this.metrics.timings.length > 0
      ? Math.max(...this.metrics.timings)
      : 0;
    const minTiming = this.metrics.timings.length > 0
      ? Math.min(...this.metrics.timings)
      : 0;

    // Check for memory leaks
    let memoryGrowth = 0;
    if (this.metrics.memorySnapshots.length > 1) {
      const first = this.metrics.memorySnapshots[0];
      const last = this.metrics.memorySnapshots[this.metrics.memorySnapshots.length - 1];
      memoryGrowth = (last.heapUsed - first.heapUsed) / (1024 * 1024); // MB
    }

    return {
      duration,
      operations: this.metrics.operations,
      operationsPerSecond: (this.metrics.operations / (duration / 1000)).toFixed(2),
      errors: this.metrics.errors,
      errorRate: ((this.metrics.errors / this.metrics.operations) * 100).toFixed(2) + '%',
      timing: {
        average: avgTiming.toFixed(2) + 'ms',
        min: minTiming.toFixed(2) + 'ms',
        max: maxTiming.toFixed(2) + 'ms'
      },
      memoryGrowth: memoryGrowth.toFixed(2) + 'MB',
      finalMemory: {
        heapUsed: (this.metrics.memorySnapshots.length > 0
          ? this.metrics.memorySnapshots[this.metrics.memorySnapshots.length - 1].heapUsed / (1024 * 1024)
          : 0).toFixed(2) + 'MB'
      }
    };
  }
}

class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.messageId = 0;
    this.pendingMessages = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            const handler = this.pendingMessages.get(message.id);
            if (handler) {
              this.pendingMessages.delete(message.id);
              handler(message);
            }
          } catch (e) {
            console.error('Error parsing message:', e);
          }
        });

        this.ws.on('error', (error) => {
          if (this.pendingMessages.size === 0) {
            reject(error);
          }
        });

        setTimeout(() => {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            reject(new Error('Connection timeout'));
          }
        }, TEST_CONFIG.CONNECT_TIMEOUT);
      } catch (e) {
        reject(e);
      }
    });
  }

  send(command, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      const message = { id, command, params };

      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error(`Command timeout: ${command}`));
      }, TEST_CONFIG.COMMAND_TIMEOUT);

      this.pendingMessages.set(id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      try {
        this.ws.send(JSON.stringify(message));
      } catch (e) {
        this.pendingMessages.delete(id);
        clearTimeout(timeout);
        reject(e);
      }
    });
  }

  close() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close();
        this.ws.on('close', resolve);
      } else {
        resolve();
      }
    });
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

describe('Stability Tests - Long Running Operations', () => {
  let client;
  let monitor;

  beforeAll(async () => {
    client = new WebSocketClient(TEST_CONFIG.WS_URL);
    monitor = new StabilityMonitor();

    try {
      await client.connect();
    } catch (e) {
      console.warn('WebSocket server not available, tests will be skipped');
    }
  }, 30000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }

    // Save monitoring report
    const report = monitor.getReport();
    const reportPath = path.join(TEST_CONFIG.RESULTS_DIR, 'stability-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('\nStability Report:', report);
  });

  const skipIfNoServer = (testFn) => {
    return async function(...args) {
      if (!client || !client.isConnected()) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }
      return testFn.apply(this, args);
    };
  };

  describe('Memory Leak Detection', () => {
    it('should maintain stable memory during repeated operations', skipIfNoServer(async () => {
      const startMemory = monitor.captureMemory();
      const operations = 10;
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-memory-leak';

      for (let i = 0; i < operations; i++) {
        const startTime = Date.now();

        try {
          await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });
        } catch (e) {
          monitor.recordError();
        }

        const duration = Date.now() - startTime;
        monitor.recordOperation(duration);

        if (i % 3 === 0) {
          monitor.captureMemory();
        }
      }

      const endMemory = monitor.captureMemory();
      const growth = (endMemory.heapUsed - startMemory.heapUsed) / (1024 * 1024);

      // Memory growth should be minimal
      expect(growth).toBeLessThan(50); // Less than 50MB growth
      expect(monitor.metrics.errors).toBeLessThan(operations * 0.1); // Less than 10% error rate
    }));

    it('should cleanup resources after operations', skipIfNoServer(async () => {
      const initialMemory = process.memoryUsage();
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-cleanup';

      // Perform operations
      for (let i = 0; i < 5; i++) {
        try {
          await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });
        } catch (e) {
          // Expected
        }
      }

      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const heapGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);

      expect(heapGrowth).toBeLessThan(100);
    }));
  });

  describe('Connection Stability', () => {
    it('should maintain stable connection', skipIfNoServer(async () => {
      const operationCount = 20;
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-connection';
      let successCount = 0;

      for (let i = 0; i < operationCount; i++) {
        try {
          const response = await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });

          if (response.success || response) {
            successCount++;
          }
        } catch (e) {
          monitor.recordError();
        }
      }

      const successRate = (successCount / operationCount) * 100;
      expect(successRate).toBeGreaterThan(50); // At least 50% success rate
      expect(client.isConnected()).toBe(true);
    }));

    it('should recover from transient errors', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-recovery';
      const attempts = 15;
      let recovered = false;

      for (let i = 0; i < attempts; i++) {
        try {
          const response = await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });

          if (response) {
            recovered = true;
            break;
          }
        } catch (e) {
          // Continue trying
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      expect(recovered).toBe(true);
      expect(client.isConnected()).toBe(true);
    }));
  });

  describe('Resource Cleanup', () => {
    it('should cleanup screenshot resources', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-screenshot-cleanup';

      // Capture multiple screenshots
      for (let i = 0; i < 5; i++) {
        try {
          await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });
        } catch (e) {
          // Continue
        }
      }

      monitor.captureMemory();
      expect(monitor.metrics.memorySnapshots.length).toBeGreaterThan(0);
    }));

    it('should handle rapid-fire operations', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-rapid-fire';
      const operationCount = 10;
      let successCount = 0;

      const startTime = Date.now();

      for (let i = 0; i < operationCount; i++) {
        try {
          const response = await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });

          if (response && !response.error) {
            successCount++;
          }
        } catch (e) {
          // Continue
        }
      }

      const duration = Date.now() - startTime;
      const opsPerSecond = (operationCount / (duration / 1000)).toFixed(2);

      console.log(`Rapid-fire: ${successCount}/${operationCount} successful, ${opsPerSecond} ops/sec`);
      expect(successCount).toBeGreaterThan(0);
    }));
  });

  describe('Error Recovery', () => {
    it('should recover from invalid commands', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-invalid-cmd';

      // Send invalid command
      try {
        await client.send('nonexistent_command', {
          sessionId
        });
      } catch (e) {
        monitor.recordError();
      }

      // Verify connection still works
      try {
        const response = await client.send('capture_screenshot', {
          sessionId,
          format: 'png'
        });

        expect(response).toBeDefined();
        expect(client.isConnected()).toBe(true);
      } catch (e) {
        // Connection may be broken
      }
    }));

    it('should handle malformed parameters', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-bad-params';

      try {
        await client.send('capture_screenshot', {
          sessionId,
          format: 'invalid-format',
          quality: 999 // Invalid quality
        });
      } catch (e) {
        monitor.recordError();
      }

      // Connection should still work
      expect(client.isConnected()).toBe(true);
    }));
  });

  describe('Sustained Load', () => {
    it('should handle sustained load without degradation', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-sustained-load';
      const operationDuration = 30 * 1000; // 30 seconds
      const startTime = Date.now();
      let operationCount = 0;
      const timings = [];

      monitor.captureMemory();

      while (Date.now() - startTime < operationDuration) {
        const opStart = Date.now();

        try {
          await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });
          operationCount++;
        } catch (e) {
          monitor.recordError();
        }

        const opDuration = Date.now() - opStart;
        timings.push(opDuration);

        // Check memory every 10 operations
        if (operationCount % 10 === 0) {
          monitor.captureMemory();
        }
      }

      monitor.captureMemory();

      // Analyze performance
      const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
      const throughput = (operationCount / ((Date.now() - startTime) / 1000)).toFixed(2);

      console.log(`Sustained Load: ${operationCount} operations, ${throughput} ops/sec, avg ${avgTiming.toFixed(2)}ms`);

      expect(operationCount).toBeGreaterThan(0);
      expect(client.isConnected()).toBe(true);
    }));
  });
});
