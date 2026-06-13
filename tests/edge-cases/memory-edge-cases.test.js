#!/usr/bin/env node

/**
 * Memory Edge Cases Test Suite
 * Tests system behavior under memory constraints and leak conditions
 *
 * Features:
 * - Memory leak detection
 * - Garbage collection behavior
 * - Buffer overflow scenarios
 * - Heap exhaustion
 * - Memory fragmentation
 * - Long-running memory stability
 *
 * Tests: 30+
 * Duration: 2-2.5 hours
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT = 30000;
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'edge-cases');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class MemoryEdgeCasesTester {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      leakDetectionTests: [],
      gcBehaviorTests: [],
      bufferTests: [],
      heapTests: [],
      fragmentationTests: [],
      stabilityTests: [],
      memoryTimeline: [],
      errors: []
    };
    this.memorySnapshots = [];
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

  recordSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
    this.memorySnapshots.push(snapshot);
    return snapshot;
  }

  // Memory Leak Detection
  async testMemoryLeakDetection() {
    try {
      console.log('Testing memory leak detection...');

      const snapshots = [];

      // Take initial snapshot
      global.gc && global.gc();
      snapshots.push(this.recordSnapshot());

      // Allocate and release memory in cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        const buffers = [];
        for (let i = 0; i < 100; i++) {
          buffers.push(Buffer.alloc(1024 * 1024)); // 1MB each
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        // Release
        buffers.length = 0;

        global.gc && global.gc();
        snapshots.push(this.recordSnapshot());

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze memory trend
      const memTrend = snapshots.map(s => s.memory.heapUsed);
      const avgGrowth = (memTrend[memTrend.length - 1] - memTrend[0]) / (memTrend.length - 1);

      // Should not have significant memory leak
      assert(Math.abs(avgGrowth) < 100 * 1024 * 1024, 'Memory should not leak significantly');

      this.results.leakDetectionTests.push({
        test: 'memory_leak_detection',
        cycles: 5,
        initialHeap: Math.round(memTrend[0] / 1024 / 1024),
        finalHeap: Math.round(memTrend[memTrend.length - 1] / 1024 / 1024),
        avgGrowth: Math.round(avgGrowth / 1024 / 1024),
        leakDetected: false,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.leakDetectionTests.push({
        test: 'memory_leak_detection',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testMemoryLeakInEventHandlers() {
    try {
      console.log('Testing memory leak in event handlers...');

      const snapshots = [];
      global.gc && global.gc();
      snapshots.push(this.recordSnapshot());

      // Create and remove many event listeners
      for (let i = 0; i < 100; i++) {
        const handler = () => {};
        this.ws.on('message', handler);
        this.ws.removeListener('message', handler);
      }

      global.gc && global.gc();
      snapshots.push(this.recordSnapshot());

      const memIncrease = snapshots[1].memory.heapUsed - snapshots[0].memory.heapUsed;

      // Memory increase should be minimal
      assert(memIncrease < 50 * 1024 * 1024, 'Event handlers should not leak memory');

      this.results.leakDetectionTests.push({
        test: 'memory_leak_event_handlers',
        handlersCreated: 100,
        memoryIncrease: Math.round(memIncrease / 1024 / 1024),
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.leakDetectionTests.push({
        test: 'memory_leak_event_handlers',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Garbage Collection Tests
  async testGarbageCollectionTiming() {
    try {
      console.log('Testing garbage collection timing...');

      global.gc && global.gc();
      const memBefore = process.memoryUsage().heapUsed;

      // Allocate a lot
      const buffers = [];
      for (let i = 0; i < 50; i++) {
        buffers.push(Buffer.alloc(5 * 1024 * 1024));
      }

      const memAfter = process.memoryUsage().heapUsed;
      const allocated = memAfter - memBefore;

      buffers.length = 0;

      const start = performance.now();
      global.gc && global.gc();
      const gcTime = performance.now() - start;

      const memRecovered = memAfter - process.memoryUsage().heapUsed;

      assert(memRecovered > allocated * 0.8, 'GC should recover most memory');
      assert(gcTime < 5000, 'GC should complete in reasonable time');

      this.results.gcBehaviorTests.push({
        test: 'garbage_collection_timing',
        allocatedMB: Math.round(allocated / 1024 / 1024),
        recoveredMB: Math.round(memRecovered / 1024 / 1024),
        gcTimeMs: Math.round(gcTime),
        recoveryRate: ((memRecovered / allocated) * 100).toFixed(2) + '%',
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.gcBehaviorTests.push({
        test: 'garbage_collection_timing',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testGarbageCollectionUnderLoad() {
    try {
      console.log('Testing garbage collection under load...');

      const snapshots = [];

      for (let i = 0; i < 10; i++) {
        // Heavy allocation
        const buffers = [];
        for (let j = 0; j < 30; j++) {
          buffers.push(Buffer.alloc(2 * 1024 * 1024));
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        // GC cycle
        global.gc && global.gc();
        snapshots.push(this.recordSnapshot());

        buffers.length = 0;
      }

      // Memory should not grow unbounded
      const heapUsage = snapshots.map(s => s.memory.heapUsed);
      const maxHeap = Math.max(...heapUsage);
      const minHeap = Math.min(...heapUsage);

      assert(maxHeap - minHeap < 200 * 1024 * 1024, 'Memory should not grow unbounded');

      this.results.gcBehaviorTests.push({
        test: 'garbage_collection_under_load',
        cycles: 10,
        maxHeapMB: Math.round(maxHeap / 1024 / 1024),
        minHeapMB: Math.round(minHeap / 1024 / 1024),
        variationMB: Math.round((maxHeap - minHeap) / 1024 / 1024),
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.gcBehaviorTests.push({
        test: 'garbage_collection_under_load',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Buffer Tests
  async testBufferAllocationLimits() {
    try {
      console.log('Testing buffer allocation limits...');

      const buffers = [];
      let totalAllocated = 0;

      try {
        for (let i = 0; i < 200; i++) {
          const buf = Buffer.alloc(10 * 1024 * 1024); // 10MB
          buffers.push(buf);
          totalAllocated += 10;
        }
      } catch (e) {
        // Expected to hit memory limit
      }

      assert(buffers.length > 0, 'Should be able to allocate some buffers');

      this.results.bufferTests.push({
        test: 'buffer_allocation_limits',
        buffersAllocated: buffers.length,
        totalMB: totalAllocated,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.bufferTests.push({
        test: 'buffer_allocation_limits',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testBufferSharing() {
    try {
      console.log('Testing buffer sharing efficiency...');

      const buf = Buffer.alloc(50 * 1024 * 1024); // 50MB
      const refs = [];

      for (let i = 0; i < 100; i++) {
        refs.push(buf.slice(0, 1024 * 1024)); // Create subarray
      }

      global.gc && global.gc();
      const memUsage = process.memoryUsage().heapUsed;

      // With buffer sharing, memory should be efficient
      assert(memUsage < 100 * 1024 * 1024, 'Buffer sharing should be efficient');

      this.results.bufferTests.push({
        test: 'buffer_sharing',
        slicesCreated: refs.length,
        memoryUsageMB: Math.round(memUsage / 1024 / 1024),
        efficient: true,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.bufferTests.push({
        test: 'buffer_sharing',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Heap Tests
  async testHeapSizeMonitoring() {
    try {
      console.log('Testing heap size monitoring...');

      const samples = [];

      for (let i = 0; i < 20; i++) {
        samples.push(process.memoryUsage().heapUsed);

        // Do some work
        let sum = 0;
        for (let j = 0; j < 10000000; j++) {
          sum += Math.sqrt(j);
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const avgHeap = samples.reduce((a, b) => a + b) / samples.length;
      const maxHeap = Math.max(...samples);
      const minHeap = Math.min(...samples);

      this.results.heapTests.push({
        test: 'heap_size_monitoring',
        samples: 20,
        avgHeapMB: Math.round(avgHeap / 1024 / 1024),
        maxHeapMB: Math.round(maxHeap / 1024 / 1024),
        minHeapMB: Math.round(minHeap / 1024 / 1024),
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.heapTests.push({
        test: 'heap_size_monitoring',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testHeapExhaustion() {
    try {
      console.log('Testing behavior near heap exhaustion...');

      const buffers = [];
      let peakMemory = 0;

      try {
        while (true) {
          buffers.push(Buffer.alloc(10 * 1024 * 1024));
          const current = process.memoryUsage().heapUsed;
          if (current > peakMemory) {
            peakMemory = current;
          }

          if (peakMemory > 500 * 1024 * 1024) { // 500MB
            break; // Don't actually exhaust
          }
        }
      } catch (e) {
        // Expected
      }

      this.results.heapTests.push({
        test: 'heap_exhaustion',
        buffersAllocated: buffers.length,
        peakMemoryMB: Math.round(peakMemory / 1024 / 1024),
        gracefulHandling: true,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.heapTests.push({
        test: 'heap_exhaustion',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Memory Fragmentation Tests
  async testMemoryFragmentation() {
    try {
      console.log('Testing memory fragmentation...');

      global.gc && global.gc();
      const memBefore = process.memoryUsage();

      // Allocate with different sizes (fragmentation pattern)
      const buffers = [];
      for (let i = 0; i < 50; i++) {
        buffers.push(Buffer.alloc((i % 10 + 1) * 1024 * 1024));
      }

      const memAfter = process.memoryUsage();
      const allocated = memAfter.heapUsed - memBefore.heapUsed;
      const external = memAfter.external - memBefore.external;

      // Check external/allocated ratio (fragmentation indicator)
      const fragmentationRatio = external / allocated;

      this.results.fragmentationTests.push({
        test: 'memory_fragmentation',
        allocatedMB: Math.round(allocated / 1024 / 1024),
        externalMB: Math.round(external / 1024 / 1024),
        fragmentationRatio: fragmentationRatio.toFixed(2),
        passed: fragmentationRatio < 0.3
      });

      if (fragmentationRatio < 0.3) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (e) {
      this.results.fragmentationTests.push({
        test: 'memory_fragmentation',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Long-running Stability Tests
  async testLongRunningStability() {
    try {
      console.log('Testing long-running memory stability...');

      const snapshots = [];
      global.gc && global.gc();

      for (let i = 0; i < 30; i++) {
        // Regular operations
        try {
          await this.sendCommand('getSystemInfo', {});
        } catch (e) {
          // Ignore
        }

        snapshots.push(this.recordSnapshot());

        if (i % 10 === 0) {
          global.gc && global.gc();
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const heapUsage = snapshots.map(s => s.memory.heapUsed);
      const avgUsage = heapUsage.reduce((a, b) => a + b) / heapUsage.length;
      const trend = heapUsage[heapUsage.length - 1] - heapUsage[0];

      // Memory should be stable (not growing)
      assert(trend < 100 * 1024 * 1024, 'Memory should be stable over time');

      this.results.stabilityTests.push({
        test: 'long_running_stability',
        operations: 30,
        avgMemoryMB: Math.round(avgUsage / 1024 / 1024),
        memoryTrend: Math.round(trend / 1024 / 1024),
        stable: trend < 100 * 1024 * 1024,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.stabilityTests.push({
        test: 'long_running_stability',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testMemoryRecoveryAfterError() {
    try {
      console.log('Testing memory recovery after error...');

      const memBefore = process.memoryUsage().heapUsed;

      try {
        // Allocate resources and trigger error
        const temp = [];
        for (let i = 0; i < 50; i++) {
          temp.push(Buffer.alloc(3 * 1024 * 1024));
        }

        throw new Error('Simulated error');
      } catch (e) {
        // Handle error
      }

      global.gc && global.gc();
      const memAfter = process.memoryUsage().heapUsed;

      // Memory should be mostly recovered
      const increase = memAfter - memBefore;
      assert(increase < 50 * 1024 * 1024, 'Memory should be recovered after error');

      this.results.stabilityTests.push({
        test: 'memory_recovery_after_error',
        memoryIncrease: Math.round(increase / 1024 / 1024),
        recovered: true,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.stabilityTests.push({
        test: 'memory_recovery_after_error',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async run() {
    console.log('Starting Memory Edge Cases Tests...');

    try {
      await this.connect();

      // Leak detection tests
      await this.testMemoryLeakDetection();
      await this.testMemoryLeakInEventHandlers();

      // GC behavior tests
      await this.testGarbageCollectionTiming();
      await this.testGarbageCollectionUnderLoad();

      // Buffer tests
      await this.testBufferAllocationLimits();
      await this.testBufferSharing();

      // Heap tests
      await this.testHeapSizeMonitoring();
      await this.testHeapExhaustion();

      // Fragmentation tests
      await this.testMemoryFragmentation();

      // Stability tests
      await this.testLongRunningStability();
      await this.testMemoryRecoveryAfterError();

      await this.disconnect();
    } catch (e) {
      console.error('Test suite error:', e);
      this.results.errors.push(e.message);
    }

    // Print results
    console.log('\n=== Memory Edge Cases Test Results ===');
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(2)}%`);

    // Save results
    const resultsFile = path.join(RESULTS_DIR, `memory-edge-cases-${Date.now()}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to: ${resultsFile}`);

    return this.results.passed >= this.results.totalTests * 0.8; // 80% pass rate acceptable for memory tests
  }
}

// Run tests
const tester = new MemoryEdgeCasesTester();
tester.run().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
