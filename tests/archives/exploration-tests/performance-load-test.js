/**
 * Performance Load Test for Basset Hound Browser
 *
 * Tests concurrent page management and memory usage under load.
 * Run with: node tests/performance-load-test.js [options]
 *
 * Options:
 *   --tabs=N        Number of concurrent tabs to open (default: 5)
 *   --duration=N    Test duration in seconds (default: 60)
 *   --interval=N    Memory check interval in ms (default: 5000)
 *
 * Prerequisites: Browser must be running at ws://localhost:8765
 */

const WebSocket = require('ws');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = parseInt(value) || value;
  return acc;
}, {});

const CONFIG = {
  WS_URL: process.env.WS_URL || 'ws://localhost:8765',
  NUM_TABS: args.tabs || 5,
  TEST_DURATION_SEC: args.duration || 60,
  MEMORY_CHECK_INTERVAL_MS: args.interval || 5000,
  URLS: [
    'https://example.com',
    'https://httpbin.org/html',
    'https://www.google.com',
    'https://github.com',
    'https://wikipedia.org'
  ]
};

class PerformanceLoadTest {
  constructor() {
    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.memorySnapshots = [];
    this.tabIds = [];
    this.startTime = null;
    this.errors = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(CONFIG.WS_URL);
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

  async getMemoryUsage() {
    const result = await this.send('get_memory_usage');
    if (result.success && result.memory) {
      return {
        timestamp: Date.now(),
        heapUsed: result.memory.heapUsed,
        heapTotal: result.memory.heapTotal,
        external: result.memory.external,
        rss: result.memory.rss,
        tabCount: this.tabIds.length
      };
    }
    return null;
  }

  async createTab(url) {
    const result = await this.send('new_tab', { url, active: false });
    if (result.success && result.tab) {
      this.tabIds.push(result.tab.id);
      return result.tab.id;
    }
    this.errors.push(`Failed to create tab: ${result.error}`);
    return null;
  }

  async closeTab(tabId) {
    const result = await this.send('close_tab', { tabId });
    if (result.success) {
      this.tabIds = this.tabIds.filter(id => id !== tabId);
    }
    return result.success;
  }

  async navigateTab(tabId, url) {
    return await this.send('navigate_tab', { tabId, url });
  }

  async runTest() {
    console.log('\n=== Performance Load Test ===');
    console.log(`Tabs: ${CONFIG.NUM_TABS}`);
    console.log(`Duration: ${CONFIG.TEST_DURATION_SEC}s`);
    console.log(`Memory check interval: ${CONFIG.MEMORY_CHECK_INTERVAL_MS}ms\n`);

    this.startTime = Date.now();
    const endTime = this.startTime + (CONFIG.TEST_DURATION_SEC * 1000);

    // Initial memory snapshot
    const initialMemory = await this.getMemoryUsage();
    if (initialMemory) {
      this.memorySnapshots.push(initialMemory);
      console.log(`Initial memory: ${this.formatMemory(initialMemory.heapUsed)}`);
    }

    // Phase 1: Create tabs
    console.log('\n[Phase 1] Creating tabs...');
    for (let i = 0; i < CONFIG.NUM_TABS; i++) {
      const url = CONFIG.URLS[i % CONFIG.URLS.length];
      console.log(`  Creating tab ${i + 1}/${CONFIG.NUM_TABS}: ${url}`);
      await this.createTab(url);
      await this.wait(500); // Small delay between tab creation
    }

    console.log(`\nCreated ${this.tabIds.length} tabs`);
    await this.wait(3000); // Wait for pages to load

    // Phase 2: Monitor memory during activity
    console.log('\n[Phase 2] Monitoring memory during activity...');

    let memoryCheckCount = 0;
    const memoryInterval = setInterval(async () => {
      const memory = await this.getMemoryUsage();
      if (memory) {
        this.memorySnapshots.push(memory);
        memoryCheckCount++;
        const elapsed = Math.round((Date.now() - this.startTime) / 1000);
        console.log(`  [${elapsed}s] Heap: ${this.formatMemory(memory.heapUsed)} / ${this.formatMemory(memory.heapTotal)}, RSS: ${this.formatMemory(memory.rss)}, Tabs: ${memory.tabCount}`);
      }
    }, CONFIG.MEMORY_CHECK_INTERVAL_MS);

    // Phase 3: Simulate activity - navigate tabs to different URLs
    console.log('\n[Phase 3] Simulating tab activity...');
    let navigationCount = 0;

    while (Date.now() < endTime) {
      // Pick a random tab and navigate it
      if (this.tabIds.length > 0) {
        const randomTabIndex = Math.floor(Math.random() * this.tabIds.length);
        const tabId = this.tabIds[randomTabIndex];
        const randomUrl = CONFIG.URLS[Math.floor(Math.random() * CONFIG.URLS.length)];

        const result = await this.navigateTab(tabId, randomUrl);
        if (result.success) {
          navigationCount++;
        }
      }

      // Wait before next action
      await this.wait(2000 + Math.random() * 3000); // 2-5 second intervals
    }

    clearInterval(memoryInterval);

    console.log(`\nNavigations performed: ${navigationCount}`);

    // Phase 4: Cleanup - close all tabs
    console.log('\n[Phase 4] Cleaning up tabs...');
    for (const tabId of [...this.tabIds]) {
      await this.closeTab(tabId);
      await this.wait(200);
    }

    // Final memory check
    await this.wait(2000); // Wait for GC
    const finalMemory = await this.getMemoryUsage();
    if (finalMemory) {
      this.memorySnapshots.push(finalMemory);
    }

    // Generate report
    this.generateReport(initialMemory, finalMemory, navigationCount);
  }

  formatMemory(bytes) {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  generateReport(initialMemory, finalMemory, navigationCount) {
    console.log('\n========================================');
    console.log('         PERFORMANCE REPORT');
    console.log('========================================\n');

    // Test parameters
    console.log('Test Configuration:');
    console.log(`  Tabs: ${CONFIG.NUM_TABS}`);
    console.log(`  Duration: ${CONFIG.TEST_DURATION_SEC}s`);
    console.log(`  Navigations: ${navigationCount}`);
    console.log(`  Errors: ${this.errors.length}`);

    // Memory analysis
    console.log('\nMemory Analysis:');
    if (initialMemory && finalMemory) {
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const heapGrowthPercent = ((heapGrowth / initialMemory.heapUsed) * 100).toFixed(1);

      console.log(`  Initial heap: ${this.formatMemory(initialMemory.heapUsed)}`);
      console.log(`  Final heap: ${this.formatMemory(finalMemory.heapUsed)}`);
      console.log(`  Heap growth: ${this.formatMemory(heapGrowth)} (${heapGrowthPercent}%)`);

      // Calculate peak memory
      const peakMemory = Math.max(...this.memorySnapshots.map(s => s.heapUsed));
      console.log(`  Peak heap: ${this.formatMemory(peakMemory)}`);

      // Calculate average memory per tab
      const avgMemoryPerTab = (peakMemory - initialMemory.heapUsed) / CONFIG.NUM_TABS;
      console.log(`  Avg memory per tab: ${this.formatMemory(avgMemoryPerTab)}`);
    }

    // Memory trend
    if (this.memorySnapshots.length > 2) {
      console.log('\nMemory Trend:');
      const firstHalf = this.memorySnapshots.slice(0, Math.floor(this.memorySnapshots.length / 2));
      const secondHalf = this.memorySnapshots.slice(Math.floor(this.memorySnapshots.length / 2));

      const avgFirstHalf = firstHalf.reduce((sum, s) => sum + s.heapUsed, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((sum, s) => sum + s.heapUsed, 0) / secondHalf.length;

      if (avgSecondHalf > avgFirstHalf * 1.2) {
        console.log('  ⚠️  Memory appears to be growing (possible leak)');
      } else if (avgSecondHalf < avgFirstHalf * 0.9) {
        console.log('  ✓  Memory is being reclaimed well');
      } else {
        console.log('  ✓  Memory is stable');
      }
    }

    // Errors
    if (this.errors.length > 0) {
      console.log('\nErrors:');
      this.errors.forEach(e => console.log(`  - ${e}`));
    }

    // Verdict
    console.log('\n========================================');
    const passed = this.errors.length < CONFIG.NUM_TABS * 0.1; // Allow up to 10% error rate
    if (passed) {
      console.log('✓ LOAD TEST PASSED');
    } else {
      console.log('✗ LOAD TEST FAILED');
    }
    console.log('========================================\n');

    return passed;
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function main() {
  const test = new PerformanceLoadTest();

  try {
    await test.connect();
    await test.runTest();
    test.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    test.close();
    process.exit(1);
  }
}

main();
