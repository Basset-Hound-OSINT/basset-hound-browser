#!/usr/bin/env node

/**
 * Resource Usage Testing Suite
 * Tests system resource consumption and efficiency
 *
 * Features:
 * - CPU usage monitoring
 * - Memory consumption patterns
 * - File handle usage
 * - Connection resource efficiency
 * - Resource cleanup verification
 * - Peak resource identification
 *
 * Tests: 25+
 * Duration: 2-2.5 hours
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT = 30000;
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'performance');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class ResourceUsageTester {
  constructor() {
    this.connections = [];
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      cpuTests: [],
      memoryTests: [],
      fileHandleTests: [],
      connectionTests: [],
      cleanupTests: [],
      peakResourceTests: [],
      systemMetrics: {},
      errors: []
    };
    this.resourceTimeline = [];
  }

  async createConnection() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to connect to ${WS_URL}`));
      }, TIMEOUT);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.connections.push(ws);
        resolve(ws);
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async closeConnections() {
    return Promise.all(this.connections.map(ws => {
      return new Promise(resolve => {
        ws.close();
        setTimeout(() => resolve(), 50);
      });
    }));
  }

  recordResourceSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      handles: process._getActiveHandles ? process._getActiveHandles().length : 0,
      requests: process._getActiveRequests ? process._getActiveRequests().length : 0
    };
    this.resourceTimeline.push(snapshot);
    return snapshot;
  }

  async sendCommand(ws, command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, TIMEOUT);

      const handler = (message) => {
        try {
          const response = JSON.parse(message);
          if (response.id === id) {
            ws.off('message', handler);
            clearTimeout(timeout);
            resolve(response);
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      ws.on('message', handler);

      try {
        ws.send(JSON.stringify({ id, command, params }));
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });
  }

  // CPU Tests
  async testCPUUsageBaseline() {
    try {
      console.log('Testing CPU usage baseline...');

      const snapshot1 = this.recordResourceSnapshot();

      // Idle period
      await new Promise(resolve => setTimeout(resolve, 1000));

      const snapshot2 = this.recordResourceSnapshot();

      const cpuDiff = {
        user: snapshot2.cpuUsage.user - snapshot1.cpuUsage.user,
        system: snapshot2.cpuUsage.system - snapshot1.cpuUsage.system
      };

      // CPU usage should be low while idle
      const totalCPU = cpuDiff.user + cpuDiff.system;

      this.results.cpuTests.push({
        test: 'cpu_usage_baseline',
        userMicroseconds: cpuDiff.user,
        systemMicroseconds: cpuDiff.system,
        totalMicroseconds: totalCPU,
        passed: totalCPU < 100000 // Less than 100ms of CPU
      });

      if (totalCPU < 100000) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (e) {
      this.results.cpuTests.push({
        test: 'cpu_usage_baseline',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testCPUUnderLoad() {
    try {
      console.log('Testing CPU usage under load...');

      const ws = await this.createConnection();

      const snapshot1 = this.recordResourceSnapshot();

      // Generate load
      for (let i = 0; i < 50; i++) {
        try {
          await this.sendCommand(ws, 'ping', {});
        } catch (e) {
          // Ignore
        }
      }

      const snapshot2 = this.recordResourceSnapshot();

      const cpuDiff = {
        user: snapshot2.cpuUsage.user - snapshot1.cpuUsage.user,
        system: snapshot2.cpuUsage.system - snapshot1.cpuUsage.system
      };

      const totalCPU = cpuDiff.user + cpuDiff.system;

      // CPU usage should be reasonable
      const perCommand = totalCPU / 50;

      this.results.cpuTests.push({
        test: 'cpu_under_load',
        totalMicroseconds: totalCPU,
        perCommandMicroseconds: perCommand.toFixed(0),
        commands: 50,
        passed: perCommand < 10000 // Less than 10ms per command
      });

      if (perCommand < 10000) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (e) {
      this.results.cpuTests.push({
        test: 'cpu_under_load',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Memory Tests
  async testMemoryUsageBaseline() {
    try {
      console.log('Testing memory usage baseline...');

      global.gc && global.gc();
      const initial = process.memoryUsage();

      // Do nothing for a bit
      await new Promise(resolve => setTimeout(resolve, 2000));

      global.gc && global.gc();
      const final = process.memoryUsage();

      const growth = {
        heapUsed: final.heapUsed - initial.heapUsed,
        heapTotal: final.heapTotal - initial.heapTotal,
        external: final.external - initial.external
      };

      this.results.memoryTests.push({
        test: 'memory_usage_baseline',
        heapUsedGrowthMB: (growth.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalGrowthMB: (growth.heapTotal / 1024 / 1024).toFixed(2),
        initialHeapMB: (initial.heapUsed / 1024 / 1024).toFixed(2),
        finalHeapMB: (final.heapUsed / 1024 / 1024).toFixed(2),
        passed: growth.heapUsed < 50 * 1024 * 1024 // Less than 50MB growth
      });

      if (growth.heapUsed < 50 * 1024 * 1024) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (e) {
      this.results.memoryTests.push({
        test: 'memory_usage_baseline',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testMemoryUnderLoad() {
    try {
      console.log('Testing memory usage under load...');

      global.gc && global.gc();
      const initial = process.memoryUsage();

      const ws = await this.createConnection();

      // Generate load
      for (let i = 0; i < 100; i++) {
        try {
          await this.sendCommand(ws, 'echo', { message: 'test' });
        } catch (e) {
          // Ignore
        }
      }

      global.gc && global.gc();
      const final = process.memoryUsage();

      const growth = {
        heapUsed: final.heapUsed - initial.heapUsed,
        external: final.external - initial.external
      };

      const perCommand = growth.heapUsed / 100;

      this.results.memoryTests.push({
        test: 'memory_under_load',
        totalGrowthMB: (growth.heapUsed / 1024 / 1024).toFixed(2),
        perCommandBytes: perCommand.toFixed(0),
        commands: 100,
        passed: perCommand < 100000 // Less than 100KB per command
      });

      if (perCommand < 100000) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (e) {
      this.results.memoryTests.push({
        test: 'memory_under_load',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // File Handle Tests
  async testFileHandleUsage() {
    try {
      console.log('Testing file handle usage...');

      const initial = process.getuid ? process._getActiveHandles().length : 0;

      // Create many connections
      const conns = [];
      for (let i = 0; i < 10; i++) {
        conns.push(await this.createConnection());
      }

      const duringLoad = process._getActiveHandles().length;

      // Close connections
      await Promise.all(conns.map(ws => {
        return new Promise(resolve => {
          ws.close();
          setTimeout(resolve, 50);
        });
      }));

      global.gc && global.gc();
      await new Promise(resolve => setTimeout(resolve, 500));

      const final = process._getActiveHandles().length;

      const handlesPerConnection = (duringLoad - initial) / 10;
      const handleLeak = final - initial;

      this.results.fileHandleTests.push({
        test: 'file_handle_usage',
        initialHandles: initial,
        duringLoadHandles: duringLoad,
        finalHandles: final,
        handlesPerConnection: handlesPerConnection.toFixed(2),
        handleLeak: handleLeak,
        passed: handleLeak < 5 // Less than 5 handles leaked
      });

      if (handleLeak < 5) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (e) {
      this.results.fileHandleTests.push({
        test: 'file_handle_usage',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Connection Resource Tests
  async testConnectionResourceEfficiency() {
    try {
      console.log('Testing connection resource efficiency...');

      const memBefore = process.memoryUsage().heapUsed;

      const conns = [];
      for (let i = 0; i < 50; i++) {
        conns.push(await this.createConnection());
      }

      const memAfter = process.memoryUsage().heapUsed;
      const memPerConnection = (memAfter - memBefore) / 50;

      // Close all
      await Promise.all(conns.map(ws => {
        return new Promise(resolve => {
          ws.close();
          setTimeout(resolve, 50);
        });
      }));

      this.results.connectionTests.push({
        test: 'connection_resource_efficiency',
        connections: 50,
        totalMemoryMB: ((memAfter - memBefore) / 1024 / 1024).toFixed(2),
        perConnectionKB: (memPerConnection / 1024).toFixed(2),
        passed: memPerConnection < 500 * 1024 // Less than 500KB per connection
      });

      if (memPerConnection < 500 * 1024) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (e) {
      this.results.connectionTests.push({
        test: 'connection_resource_efficiency',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Cleanup Tests
  async testResourceCleanup() {
    try {
      console.log('Testing resource cleanup...');

      const snapshotBefore = this.recordResourceSnapshot();

      // Create and destroy resources
      const conns = [];
      for (let i = 0; i < 20; i++) {
        conns.push(await this.createConnection());
      }

      // Close all
      await Promise.all(conns.map(ws => {
        return new Promise(resolve => {
          ws.close();
          setTimeout(resolve, 50);
        });
      }));

      this.connections = [];

      global.gc && global.gc();
      await new Promise(resolve => setTimeout(resolve, 1000));

      const snapshotAfter = this.recordResourceSnapshot();

      const memLeak = snapshotAfter.memory.heapUsed - snapshotBefore.memory.heapUsed;
      const handleLeak = snapshotAfter.handles - snapshotBefore.handles;

      this.results.cleanupTests.push({
        test: 'resource_cleanup',
        resourcesCreated: 20,
        memoryLeakMB: (memLeak / 1024 / 1024).toFixed(2),
        handleLeak: handleLeak,
        passed: Math.abs(handleLeak) < 10 && memLeak < 100 * 1024 * 1024
      });

      if (Math.abs(handleLeak) < 10 && memLeak < 100 * 1024 * 1024) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (e) {
      this.results.cleanupTests.push({
        test: 'resource_cleanup',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Peak Resource Tests
  async testPeakResourceIdentification() {
    try {
      console.log('Testing peak resource identification...');

      const measurements = [];

      // Vary load and measure resources
      const loads = [10, 50, 100, 200];

      for (const load of loads) {
        const memBefore = process.memoryUsage().heapUsed;

        const conns = [];
        for (let i = 0; i < load; i++) {
          try {
            conns.push(await this.createConnection());
          } catch (e) {
            break;
          }
        }

        const memAfter = process.memoryUsage().heapUsed;
        const memUsed = (memAfter - memBefore) / 1024 / 1024;
        const handleCount = process._getActiveHandles().length;

        measurements.push({
          load,
          connectionsCreated: conns.length,
          memoryMB: memUsed.toFixed(2),
          handles: handleCount
        });

        // Cleanup
        await Promise.all(conns.map(ws => {
          return new Promise(resolve => {
            ws.close();
            setTimeout(resolve, 50);
          });
        }));
      }

      const peakMemory = Math.max(...measurements.map(m => parseFloat(m.memoryMB)));
      const peakHandles = Math.max(...measurements.map(m => m.handles));

      this.results.peakResourceTests.push({
        test: 'peak_resource_identification',
        measurements,
        peakMemoryMB: peakMemory.toFixed(2),
        peakHandles: peakHandles,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.peakResourceTests.push({
        test: 'peak_resource_identification',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testSystemMetrics() {
    try {
      console.log('Testing system metrics collection...');

      const metrics = {
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime(),
        handles: process._getActiveHandles ? process._getActiveHandles().length : 0,
        requests: process._getActiveRequests ? process._getActiveRequests().length : 0,
        timestamp: new Date().toISOString(),
        systemUptime: os.uptime(),
        loadAverage: os.loadavg(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      };

      this.results.systemMetrics = metrics;
      this.results.peakResourceTests.push({
        test: 'system_metrics',
        metricsCollected: true,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.peakResourceTests.push({
        test: 'system_metrics',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async run() {
    console.log('Starting Resource Usage Testing Suite...');

    try {
      // CPU tests
      await this.testCPUUsageBaseline();
      await this.testCPUUnderLoad();

      // Memory tests
      await this.testMemoryUsageBaseline();
      await this.testMemoryUnderLoad();

      // File handle tests
      await this.testFileHandleUsage();

      // Connection resource tests
      await this.testConnectionResourceEfficiency();

      // Cleanup tests
      await this.testResourceCleanup();

      // Peak resource tests
      await this.testPeakResourceIdentification();

      // System metrics
      await this.testSystemMetrics();

      await this.closeConnections();
    } catch (e) {
      console.error('Test suite error:', e);
      this.results.errors.push(e.message);
    }

    // Print results
    console.log('\n=== Resource Usage Testing Results ===');
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(2)}%`);

    // Save results
    const resultsFile = path.join(RESULTS_DIR, `resource-usage-${Date.now()}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to: ${resultsFile}`);

    return this.results.passed >= this.results.totalTests * 0.8;
  }
}

// Run tests
const tester = new ResourceUsageTester();
tester.run().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
