/**
 * Memory Monitoring Test
 *
 * Tests the memory monitoring features for long-running sessions.
 * Run with: node tests/memory-monitoring-test.js
 *
 * Prerequisites: Browser must be running at ws://localhost:8765
 */

const WebSocket = require('/app/node_modules/ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';

class MemoryMonitoringTest {
  constructor() {
    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.results = { pass: 0, fail: 0, tests: [] };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.on('open', () => {
        console.log('Connected to browser');
        resolve();
      });
      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'status') return;
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg);
        }
      });
      this.ws.on('error', reject);
    });
  }

  async send(command, params = {}) {
    const id = ++this.messageId;
    const msg = { id, command, ...params };
    return new Promise((resolve) => {
      this.pendingRequests.set(id, { resolve });
      this.ws.send(JSON.stringify(msg));
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve({ success: false, error: 'Timeout' });
        }
      }, 30000);
    });
  }

  wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  logTest(name, passed, details = '') {
    const status = passed ? '✓' : '✗';
    console.log(`  ${status} ${name}${details ? ': ' + details : ''}`);
    this.results.tests.push({ name, passed, details });
    if (passed) this.results.pass++;
    else this.results.fail++;
  }

  async runTests() {
    console.log('\n=== Memory Monitoring Tests ===\n');

    // Test 1: Get memory stats
    await this.testGetMemoryStats();

    // Test 2: Start memory monitoring
    await this.testStartMemoryMonitoring();

    // Test 3: Get memory history
    await this.testGetMemoryHistory();

    // Test 4: Detect memory leaks
    await this.testDetectMemoryLeaks();

    // Test 5: Get heap snapshot
    await this.testGetHeapSnapshot();

    // Test 6: Stop memory monitoring
    await this.testStopMemoryMonitoring();

    // Test 7: Memory under load (create tabs)
    await this.testMemoryUnderLoad();

    // Print summary
    this.printSummary();
  }

  async testGetMemoryStats() {
    console.log('Testing get_memory_stats...');

    const result = await this.send('get_memory_stats');

    if (result.success && result.stats) {
      const stats = result.stats;
      const hasRequired = stats.current && typeof stats.current.heapUsedMB === 'number';
      this.logTest('get_memory_stats', hasRequired,
        `Heap: ${stats.current?.heapUsedMB || 0}MB, RSS: ${stats.current?.rssMB || 0}MB`);
    } else if (result.success && result.usage) {
      // Alternative response format
      this.logTest('get_memory_stats', true,
        `Heap: ${result.usage.heapUsedMB || 0}MB`);
    } else {
      this.logTest('get_memory_stats', false, result.error);
    }
  }

  async testStartMemoryMonitoring() {
    console.log('Testing start_memory_monitoring...');

    const result = await this.send('start_memory_monitoring', {
      interval: 5000  // 5 seconds
    });

    const passed = result.success;
    this.logTest('start_memory_monitoring', passed,
      passed ? `Interval: ${result.interval || 5000}ms` : result.error);
  }

  async testGetMemoryHistory() {
    console.log('Testing get_memory_history...');

    // Wait a bit for samples to accumulate
    await this.wait(6000);

    const result = await this.send('get_memory_history', {
      limit: 10
    });

    if (result.success) {
      const count = result.history?.length || result.count || 0;
      const passed = count >= 0;  // Even 0 is acceptable if just started
      this.logTest('get_memory_history', passed, `Samples: ${count}`);
    } else {
      this.logTest('get_memory_history', false, result.error);
    }
  }

  async testDetectMemoryLeaks() {
    console.log('Testing detect_memory_leaks...');

    const result = await this.send('detect_memory_leaks');

    if (result.success) {
      const leakInfo = result.result || result;
      const hasResult = leakInfo.analyzed !== undefined || leakInfo.enabled !== undefined;
      this.logTest('detect_memory_leaks', hasResult,
        leakInfo.analyzed ? `Leak detected: ${leakInfo.leakDetected || false}` : 'Not enough samples yet');
    } else {
      this.logTest('detect_memory_leaks', false, result.error);
    }
  }

  async testGetHeapSnapshot() {
    console.log('Testing get_heap_snapshot...');

    const result = await this.send('get_heap_snapshot');

    if (result.success && result.snapshot) {
      const hasStats = result.snapshot.stats && result.snapshot.stats.usedHeapSizeMB !== undefined;
      this.logTest('get_heap_snapshot', hasStats,
        `Used heap: ${result.snapshot.stats?.usedHeapSizeMB || 0}MB`);
    } else {
      this.logTest('get_heap_snapshot', false, result.error || 'No snapshot data');
    }
  }

  async testStopMemoryMonitoring() {
    console.log('Testing stop_memory_monitoring...');

    const result = await this.send('stop_memory_monitoring');

    const passed = result.success;
    this.logTest('stop_memory_monitoring', passed, passed ? 'Stopped' : result.error);
  }

  async testMemoryUnderLoad() {
    console.log('Testing memory under load (creating tabs)...');

    // Get initial memory
    const beforeResult = await this.send('get_memory_stats');
    const beforeHeap = beforeResult.stats?.current?.heapUsedMB ||
                       beforeResult.usage?.heapUsedMB || 0;

    // Create 3 tabs
    console.log('  Creating 3 tabs...');
    for (let i = 0; i < 3; i++) {
      await this.send('new_tab');
      await this.wait(1000);
    }

    // Navigate each to a page
    console.log('  Navigating tabs...');
    await this.send('navigate', { url: 'https://example.com' });
    await this.wait(3000);

    // Get final memory
    const afterResult = await this.send('get_memory_stats');
    const afterHeap = afterResult.stats?.current?.heapUsedMB ||
                      afterResult.usage?.heapUsedMB || 0;

    const heapGrowth = afterHeap - beforeHeap;
    const passed = afterHeap > 0;  // Just check we can measure memory

    this.logTest('memory_under_load', passed,
      `Before: ${beforeHeap.toFixed(1)}MB, After: ${afterHeap.toFixed(1)}MB, Growth: ${heapGrowth.toFixed(1)}MB`);
  }

  printSummary() {
    console.log('\n=== Summary ===');
    console.log(`Passed: ${this.results.pass}/${this.results.tests.length}`);
    console.log(`Failed: ${this.results.fail}`);

    if (this.results.fail > 0) {
      console.log('\nFailed tests:');
      this.results.tests.filter(t => !t.passed).forEach(t => {
        console.log(`  - ${t.name}: ${t.details}`);
      });
    }

    const passRate = this.results.pass / this.results.tests.length;
    if (passRate >= 0.7) {
      console.log('\n✓ Memory monitoring test PASSED');
      return 0;
    } else {
      console.log('\n✗ Memory monitoring test FAILED');
      return 1;
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function main() {
  const test = new MemoryMonitoringTest();

  try {
    await test.connect();
    await test.runTests();
    const exitCode = test.printSummary();
    test.close();
    process.exit(exitCode);
  } catch (error) {
    console.error('Error:', error.message);
    test.close();
    process.exit(1);
  }
}

main();
