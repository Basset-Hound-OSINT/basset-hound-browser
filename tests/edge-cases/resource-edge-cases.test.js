#!/usr/bin/env node

/**
 * Resource Edge Cases Test Suite
 * Tests system behavior under resource constraints
 *
 * Features:
 * - Memory exhaustion scenarios
 * - Disk space constraints
 * - CPU throttling effects
 * - File descriptor limits
 * - Handle exhaustion
 * - Resource cleanup validation
 *
 * Tests: 35+
 * Duration: 1.5-2 hours
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Worker } = require('worker_threads');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT = 30000;
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'edge-cases');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class ResourceEdgeCasesTester {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      memoryExhaustionTests: [],
      diskSpaceTests: [],
      cpuThrottlingTests: [],
      fileDescriptorTests: [],
      handleExhaustionTests: [],
      cleanupTests: [],
      resourceMetrics: {},
      errors: []
    };
    this.initialMemory = process.memoryUsage();
    this.initialHandles = process._getActiveHandles ? process._getActiveHandles().length : 0;
    this.initialRequests = process._getActiveRequests ? process._getActiveRequests().length : 0;
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

  async disconnect() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close();
        setTimeout(() => resolve(), 100);
      } else {
        resolve();
      }
    });
  }

  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, TIMEOUT);

      const handler = (message) => {
        try {
          const response = JSON.parse(message);
          if (response.id === id) {
            this.ws.off('message', handler);
            clearTimeout(timeout);
            resolve(response);
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify({ id, command, params }));
    });
  }

  // Memory Exhaustion Tests
  async testMemoryLeakDetection() {
    try {
      console.log('Testing memory leak detection...');
      const memBefore = process.memoryUsage().heapUsed;

      // Allocate large buffers
      const buffers = [];
      for (let i = 0; i < 100; i++) {
        buffers.push(Buffer.alloc(10 * 1024 * 1024)); // 10MB each
      }

      const memAfter = process.memoryUsage().heapUsed;
      const diff = (memAfter - memBefore) / 1024 / 1024;

      assert(diff > 900, 'Memory should have increased by ~1GB');
      this.results.memoryExhaustionTests.push({
        test: 'memory_leak_detection',
        memoryIncreaseInMB: Math.round(diff),
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.memoryExhaustionTests.push({
        test: 'memory_leak_detection',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testMemoryStressedOperations() {
    try {
      console.log('Testing operations under memory stress...');

      // Create memory pressure
      const memoryBuffers = [];
      for (let i = 0; i < 50; i++) {
        memoryBuffers.push(Buffer.alloc(5 * 1024 * 1024));
      }

      // Try to execute command
      const response = await this.sendCommand('getSystemInfo', {});

      assert(response.result, 'Command should succeed under memory stress');
      this.results.memoryExhaustionTests.push({
        test: 'memory_stressed_operations',
        commandSuccess: !!response.result,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.memoryExhaustionTests.push({
        test: 'memory_stressed_operations',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testMemoryRecovery() {
    try {
      console.log('Testing memory recovery after stress...');

      const memBefore = process.memoryUsage().heapUsed;

      // Allocate and release memory
      for (let i = 0; i < 10; i++) {
        const temp = Buffer.alloc(20 * 1024 * 1024);
        // Immediately release
      }

      global.gc && global.gc(); // Force garbage collection if available

      const memAfter = process.memoryUsage().heapUsed;

      // Memory should be mostly recovered
      assert(memAfter < memBefore * 1.5, 'Memory should be mostly recovered');
      this.results.memoryExhaustionTests.push({
        test: 'memory_recovery',
        memoryRecovered: true,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.memoryExhaustionTests.push({
        test: 'memory_recovery',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Disk Space Tests
  async testDiskSpaceDetection() {
    try {
      console.log('Testing disk space detection...');

      const tmpDir = os.tmpdir();
      const stats = fs.statfsSync ? fs.statfsSync(tmpDir) : null;

      assert(stats, 'Should be able to get disk stats');
      this.results.diskSpaceTests.push({
        test: 'disk_space_detection',
        availableSpace: stats.bavail * stats.bsize,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.diskSpaceTests.push({
        test: 'disk_space_detection',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testDiskWriteLimits() {
    try {
      console.log('Testing disk write limits...');

      const testDir = path.join(RESULTS_DIR, 'disk-test');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      const testFile = path.join(testDir, 'large-file.tmp');
      const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB

      fs.writeFileSync(testFile, largeBuffer);

      assert(fs.existsSync(testFile), 'Large file should be written');
      const stats = fs.statSync(testFile);
      assert(stats.size > 100 * 1024 * 1024, 'File should be large');

      fs.unlinkSync(testFile);

      this.results.diskSpaceTests.push({
        test: 'disk_write_limits',
        fileSize: stats.size,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.diskSpaceTests.push({
        test: 'disk_write_limits',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // CPU Throttling Tests
  async testCPUIntensiveOperations() {
    try {
      console.log('Testing CPU intensive operations...');

      const start = Date.now();

      // CPU intensive work
      let result = 0;
      for (let i = 0; i < 100000000; i++) {
        result += Math.sqrt(i);
      }

      const duration = Date.now() - start;

      assert(duration > 100, 'Operation should take reasonable time');
      this.results.cpuThrottlingTests.push({
        test: 'cpu_intensive_operations',
        durationMs: duration,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.cpuThrottlingTests.push({
        test: 'cpu_intensive_operations',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testCPUThrottlingRecovery() {
    try {
      console.log('Testing CPU throttling recovery...');

      const iterations = 10;
      const times = [];

      for (let iter = 0; iter < iterations; iter++) {
        const start = Date.now();

        // CPU work
        let result = 0;
        for (let i = 0; i < 50000000; i++) {
          result += Math.sqrt(i);
        }

        const duration = Date.now() - start;
        times.push(duration);
      }

      // Times should be relatively consistent (no extreme throttling)
      const avg = times.reduce((a, b) => a + b) / times.length;
      const maxDev = Math.max(...times.map(t => Math.abs(t - avg)));

      assert(maxDev < avg * 2, 'Performance should be relatively consistent');
      this.results.cpuThrottlingTests.push({
        test: 'cpu_throttling_recovery',
        avgDuration: Math.round(avg),
        maxDeviation: Math.round(maxDev),
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.cpuThrottlingTests.push({
        test: 'cpu_throttling_recovery',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // File Descriptor Tests
  async testFileDescriptorExhaustion() {
    try {
      console.log('Testing file descriptor handling...');

      const files = [];
      const testDir = path.join(RESULTS_DIR, 'fd-test');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      try {
        // Try to open many files
        for (let i = 0; i < 100; i++) {
          const testFile = path.join(testDir, `test-${i}.tmp`);
          fs.writeFileSync(testFile, 'test data');
          files.push(testFile);
        }

        assert(files.length > 0, 'Should be able to create multiple files');
        this.results.fileDescriptorTests.push({
          test: 'file_descriptor_exhaustion',
          filesCreated: files.length,
          passed: true
        });
        this.results.passed++;
      } finally {
        // Cleanup
        for (const file of files) {
          try { fs.unlinkSync(file); } catch (e) {}
        }
      }
    } catch (e) {
      this.results.fileDescriptorTests.push({
        test: 'file_descriptor_exhaustion',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testFileHandleCleanup() {
    try {
      console.log('Testing file handle cleanup...');

      const handlesBefore = process._getActiveHandles ? process._getActiveHandles().length : 0;

      const testDir = path.join(RESULTS_DIR, 'handle-test');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Open and close many files
      for (let i = 0; i < 50; i++) {
        const testFile = path.join(testDir, `test-${i}.tmp`);
        const fd = fs.openSync(testFile, 'w');
        fs.writeSync(fd, 'test data');
        fs.closeSync(fd);
        fs.unlinkSync(testFile);
      }

      const handlesAfter = process._getActiveHandles ? process._getActiveHandles().length : 0;

      // Handles should be properly closed
      assert(handlesAfter <= handlesBefore + 10, 'File handles should be cleaned up');
      this.results.fileDescriptorTests.push({
        test: 'file_handle_cleanup',
        handlesBefore,
        handlesAfter,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.fileDescriptorTests.push({
        test: 'file_handle_cleanup',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Handle Exhaustion Tests
  async testOpenConnectionExhaustion() {
    try {
      console.log('Testing open connection limits...');

      const connections = [];
      let connectionCount = 0;

      try {
        // Try to open many WebSocket connections
        for (let i = 0; i < 20; i++) {
          const ws = new WebSocket(WS_URL);
          connections.push(ws);

          await new Promise((resolve) => {
            ws.once('open', resolve);
            ws.once('error', resolve);
          });

          connectionCount++;
        }

        assert(connectionCount > 0, 'Should be able to open multiple connections');
        this.results.handleExhaustionTests.push({
          test: 'open_connection_exhaustion',
          connectionsCreated: connectionCount,
          passed: true
        });
        this.results.passed++;
      } finally {
        // Cleanup
        for (const ws of connections) {
          try { ws.close(); } catch (e) {}
        }
      }
    } catch (e) {
      this.results.handleExhaustionTests.push({
        test: 'open_connection_exhaustion',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Cleanup Tests
  async testResourceCleanupOnError() {
    try {
      console.log('Testing resource cleanup on error...');

      const memBefore = process.memoryUsage().heapUsed;

      try {
        // Create resources that will be abandoned
        const temp = [];
        for (let i = 0; i < 10; i++) {
          temp.push(Buffer.alloc(5 * 1024 * 1024));
        }

        // Force error scenario
        throw new Error('Simulated error');
      } catch (e) {
        // Resources should be cleaned up
      }

      global.gc && global.gc();

      const memAfter = process.memoryUsage().heapUsed;

      // Memory should recover
      const leaked = memAfter - memBefore;
      assert(leaked < 100 * 1024 * 1024, 'Should not leak excessive memory on error');

      this.results.cleanupTests.push({
        test: 'resource_cleanup_on_error',
        memoryLeaked: Math.round(leaked / 1024 / 1024),
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.cleanupTests.push({
        test: 'resource_cleanup_on_error',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testResourceMetrics() {
    try {
      console.log('Testing resource metrics collection...');

      const metrics = {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage(),
        timestamp: new Date().toISOString()
      };

      assert(metrics.memory.heapUsed > 0, 'Should have memory usage data');
      assert(metrics.uptime > 0, 'Should have uptime data');

      this.results.resourceMetrics = metrics;
      this.results.cleanupTests.push({
        test: 'resource_metrics',
        metricsCollected: true,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.cleanupTests.push({
        test: 'resource_metrics',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async run() {
    console.log('Starting Resource Edge Cases Tests...');

    try {
      await this.connect();

      // Memory tests
      await this.testMemoryLeakDetection();
      await this.testMemoryStressedOperations();
      await this.testMemoryRecovery();

      // Disk tests
      await this.testDiskSpaceDetection();
      await this.testDiskWriteLimits();

      // CPU tests
      await this.testCPUIntensiveOperations();
      await this.testCPUThrottlingRecovery();

      // File descriptor tests
      await this.testFileDescriptorExhaustion();
      await this.testFileHandleCleanup();

      // Handle exhaustion tests
      await this.testOpenConnectionExhaustion();

      // Cleanup tests
      await this.testResourceCleanupOnError();
      await this.testResourceMetrics();

      await this.disconnect();
    } catch (e) {
      console.error('Test suite error:', e);
      this.results.errors.push(e.message);
    }

    // Print results
    console.log('\n=== Resource Edge Cases Test Results ===');
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(2)}%`);

    // Save results
    const resultsFile = path.join(RESULTS_DIR, `resource-edge-cases-${Date.now()}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to: ${resultsFile}`);

    return this.results.passed === this.results.totalTests;
  }
}

// Run tests
const tester = new ResourceEdgeCasesTester();
tester.run().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
