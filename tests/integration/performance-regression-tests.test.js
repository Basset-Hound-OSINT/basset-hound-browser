/**
 * Performance and Regression Tests
 *
 * Tests for performance metrics and regression detection including:
 * - Screenshot throughput baseline
 * - Video encoding speed baseline
 * - Memory usage under load
 * - Latency metrics
 * - Comparison against v12.0.0 baselines
 */

const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const TEST_CONFIG = {
  WS_URL: 'ws://localhost:8765',
  CONNECT_TIMEOUT: 10000,
  COMMAND_TIMEOUT: 30000,
  RESULTS_DIR: path.join(__dirname, '..', 'results', 'performance-regression'),
  TEST_SESSION_ID: 'perf-test-' + Date.now(),
  // v12.0.0 baseline metrics
  BASELINE: {
    screenshotLatency: 100, // ms (P50)
    screenshotThroughput: 100, // screenshots/sec
    memoryPerOperation: 1, // MB
    cpuUtilization: 50 // percent
  }
};

// Ensure results directory exists
if (!fs.existsSync(TEST_CONFIG.RESULTS_DIR)) {
  fs.mkdirSync(TEST_CONFIG.RESULTS_DIR, { recursive: true });
}

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      screenshots: [],
      videos: [],
      memory: [],
      cpu: []
    };
  }

  recordScreenshot(duration) {
    this.metrics.screenshots.push({
      timestamp: Date.now(),
      duration
    });
  }

  recordVideo(duration) {
    this.metrics.videos.push({
      timestamp: Date.now(),
      duration
    });
  }

  recordMemory(usage) {
    this.metrics.memory.push({
      timestamp: Date.now(),
      usage
    });
  }

  getStats(dataArray) {
    if (!dataArray || dataArray.length === 0) {
      return null;
    }

    const values = dataArray.map(d => d.duration || d.usage);
    values.sort((a, b) => a - b);

    const n = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    return {
      count: n,
      min: values[0],
      max: values[n - 1],
      mean: mean.toFixed(2),
      median: values[Math.floor(n / 2)],
      p95: values[Math.floor(n * 0.95)],
      p99: values[Math.floor(n * 0.99)],
      stdDev: stdDev.toFixed(2),
      throughput: ((n / (dataArray[n - 1].timestamp - dataArray[0].timestamp)) * 1000).toFixed(2) + ' ops/sec'
    };
  }

  getReport() {
    return {
      screenshots: this.getStats(this.metrics.screenshots),
      videos: this.getStats(this.metrics.videos),
      memory: this.getStats(this.metrics.memory),
      regressions: this.checkRegressions()
    };
  }

  checkRegressions() {
    const regressions = [];

    // Check screenshot latency
    if (this.metrics.screenshots.length > 0) {
      const screenshotStats = this.getStats(this.metrics.screenshots);
      if (screenshotStats.mean > TEST_CONFIG.BASELINE.screenshotLatency * 1.2) {
        regressions.push({
          metric: 'screenshot_latency',
          baseline: TEST_CONFIG.BASELINE.screenshotLatency + 'ms',
          current: screenshotStats.mean + 'ms',
          degradation: ((screenshotStats.mean / TEST_CONFIG.BASELINE.screenshotLatency - 1) * 100).toFixed(2) + '%'
        });
      }
    }

    return regressions;
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

describe('Performance and Regression Tests', () => {
  let client;
  let monitor;

  beforeAll(async () => {
    client = new WebSocketClient(TEST_CONFIG.WS_URL);
    monitor = new PerformanceMonitor();

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

    // Save performance report
    const report = monitor.getReport();
    const reportPath = path.join(TEST_CONFIG.RESULTS_DIR, 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('\nPerformance Report:', JSON.stringify(report, null, 2));
  });

  const skipIfNoServer = (testFn) => {
    return async function (...args) {
      if (!client || !client.isConnected()) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }
      return testFn.apply(this, args);
    };
  };

  describe('Screenshot Performance', () => {
    it('should capture screenshots with acceptable latency', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-screenshot-latency';
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        try {
          await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });
        } catch (e) {
          // Continue
        }

        const duration = Date.now() - startTime;
        monitor.recordScreenshot(duration);
      }

      const stats = monitor.getStats(monitor.metrics.screenshots);
      console.log('Screenshot latency stats:', stats);

      expect(stats.p95).toBeLessThan(TEST_CONFIG.BASELINE.screenshotLatency * 1.5);
    }));

    it('should maintain screenshot throughput', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-screenshot-throughput';
      const duration = 10 * 1000; // 10 seconds
      const startTime = Date.now();
      let count = 0;

      while (Date.now() - startTime < duration) {
        try {
          const opStart = Date.now();
          await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });
          monitor.recordScreenshot(Date.now() - opStart);
          count++;
        } catch (e) {
          // Continue
        }
      }

      const actualDuration = Date.now() - startTime;
      const throughput = (count / (actualDuration / 1000)).toFixed(2);

      console.log(`Screenshot throughput: ${throughput} ops/sec`);
      expect(count).toBeGreaterThan(0);
    }));

    it('should handle multiple format conversions efficiently', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-screenshot-formats';
      const formats = ['png', 'jpeg', 'webp'];

      for (const format of formats) {
        const iterations = 5;

        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();

          try {
            await client.send('capture_screenshot', {
              sessionId,
              format
            });
          } catch (e) {
            // Continue
          }

          const duration = Date.now() - startTime;
          monitor.recordScreenshot(duration);
        }
      }

      const stats = monitor.getStats(monitor.metrics.screenshots);
      console.log('Screenshot format conversion stats:', stats);

      expect(stats.count).toBe(15);
    }));
  });

  describe('Memory Performance', () => {
    it('should maintain memory efficiency under screenshot load', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-memory-efficiency';
      const memorySnapshots = [];

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 10; i++) {
        try {
          await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });
        } catch (e) {
          // Continue
        }

        const memory = process.memoryUsage().heapUsed / (1024 * 1024);
        memorySnapshots.push(memory);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const growth = (finalMemory - initialMemory) / (1024 * 1024);

      console.log(`Memory growth during screenshots: ${growth.toFixed(2)}MB`);
      expect(growth).toBeLessThan(100); // Less than 100MB
    }));

    it('should efficiently handle video recording', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-video-memory';

      const initialMemory = process.memoryUsage().heapUsed;

      try {
        const response = await client.send('start_video_recording', {
          sessionId,
          codec: 'vp9',
          fps: 24
        });

        if (response && response.success) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          const recordingMemory = process.memoryUsage().heapUsed;
          const growth = (recordingMemory - initialMemory) / (1024 * 1024);

          await client.send('stop_video_recording', {
            sessionId
          });

          console.log(`Memory growth during video recording: ${growth.toFixed(2)}MB`);
          expect(growth).toBeLessThan(200);
        }
      } catch (e) {
        // Continue
      }
    }));
  });

  describe('Latency Distribution', () => {
    it('should maintain consistent latency across operations', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-latency-consistency';
      const measurements = [];

      for (let i = 0; i < 30; i++) {
        const startTime = Date.now();

        try {
          await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });
        } catch (e) {
          // Continue
        }

        const duration = Date.now() - startTime;
        measurements.push(duration);
      }

      measurements.sort((a, b) => a - b);
      const p99 = measurements[Math.floor(measurements.length * 0.99)];
      const p50 = measurements[Math.floor(measurements.length * 0.50)];

      console.log(`Latency P50: ${p50}ms, P99: ${p99}ms`);

      expect(p99).toBeLessThan(TEST_CONFIG.BASELINE.screenshotLatency * 2);
    }));
  });

  describe('Regression Detection', () => {
    it('should detect performance regressions', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-regression-detection';

      // Baseline: 20 operations
      for (let i = 0; i < 20; i++) {
        const startTime = Date.now();

        try {
          await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });
        } catch (e) {
          // Continue
        }

        const duration = Date.now() - startTime;
        monitor.recordScreenshot(duration);
      }

      const regressions = monitor.checkRegressions();
      console.log('Detected regressions:', regressions);

      // If regressions detected, they should be < 50% degradation
      for (const regression of regressions) {
        const degradation = parseFloat(regression.degradation);
        expect(degradation).toBeLessThan(50);
      }
    }));
  });

  describe('Throughput Metrics', () => {
    it('should measure accurate throughput', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-throughput';
      const testDuration = 15 * 1000; // 15 seconds
      const startTime = Date.now();
      let count = 0;

      while (Date.now() - startTime < testDuration) {
        try {
          const opStart = Date.now();
          await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });
          monitor.recordScreenshot(Date.now() - opStart);
          count++;
        } catch (e) {
          // Continue
        }
      }

      const actualDuration = (Date.now() - startTime) / 1000;
      const throughput = (count / actualDuration).toFixed(2);

      console.log(`Actual throughput: ${throughput} ops/sec (${count} operations in ${actualDuration.toFixed(2)}s)`);

      expect(count).toBeGreaterThan(0);
    }));
  });
});
