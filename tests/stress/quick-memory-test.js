/**
 * Quick Memory Test - 5 minute version for rapid feedback
 * Run with: node tests/stress/quick-memory-test.js
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'stress');

class QuickMemoryTest {
  constructor() {
    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.samples = [];
    this.startTime = null;
    this.operationCount = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.on('open', () => {
        console.log('✓ Connected to browser');
        resolve();
      });
      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'status' || msg.type === 'heartbeat') {
            return;
          }
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            this.pendingRequests.delete(msg.id);
            pending.resolve(msg);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });
      this.ws.on('error', reject);
    });
  }

  async send(command, params = {}, timeout = 10000) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const id = ++this.messageId;
    const msg = { id, command, ...params };

    return new Promise((resolve) => {
      const handle = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve({ success: false, error: 'Timeout' });
        }
      }, timeout);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(handle);
          resolve(result);
        }
      });

      try {
        this.ws.send(JSON.stringify(msg));
      } catch (e) {
        clearTimeout(handle);
        this.pendingRequests.delete(id);
        resolve({ success: false, error: e.message });
      }
    });
  }

  async getMemoryStats() {
    try {
      const result = await this.send('get_memory_stats', {}, 5000);
      if (!result.success) {
        return null;
      }

      const stats = result.stats || result.usage || {};
      const current = stats.current || stats;
      return {
        heapUsedMB: current.heapUsedMB || 0,
        rssMB: current.rssMB || 0,
        externalMB: current.externalMB || 0
      };
    } catch (error) {
      return null;
    }
  }

  async run() {
    const durationSeconds = 300; // 5 minutes
    const intervalSeconds = 10;

    console.log('\n' + '='.repeat(60));
    console.log('QUICK MEMORY TEST - 5 MINUTES');
    console.log('='.repeat(60));
    console.log(`Start: ${new Date().toISOString()}\n`);

    this.startTime = Date.now();
    let sampleCount = 0;

    try {
      while (true) {
        const elapsed = Date.now() - this.startTime;
        const elapsedSeconds = Math.round(elapsed / 1000);

        if (elapsedSeconds >= durationSeconds) {
          break;
        }

        // Get memory
        const mem = await this.getMemoryStats();
        if (mem) {
          this.samples.push({
            time_seconds: elapsedSeconds,
            heap_mb: parseFloat(mem.heapUsedMB.toFixed(2)),
            rss_mb: parseFloat(mem.rssMB.toFixed(2)),
            external_mb: parseFloat(mem.externalMB.toFixed(2))
          });

          const heapGrowth = this.samples.length > 1 ?
            (this.samples[this.samples.length - 1].heap_mb - this.samples[0].heap_mb).toFixed(2) : '0.00';

          console.log(`[${String(elapsedSeconds).padStart(3)}s] Heap: ${String(mem.heapUsedMB.toFixed(1)).padStart(6)}MB, ` +
            `RSS: ${String(mem.rssMB.toFixed(1)).padStart(6)}MB, Growth: ${heapGrowth}MB`);

          sampleCount++;
        }

        // Perform operations
        await this.send('navigate', { url: 'https://example.com' }, 5000);
        this.operationCount++;

        // Wait for next interval
        const nextTime = this.startTime + ((sampleCount + 1) * intervalSeconds * 1000);
        const waitTime = Math.max(100, nextTime - Date.now());
        await new Promise(r => setTimeout(r, waitTime));
      }
    } catch (error) {
      console.error('Error:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Completed: ${new Date().toISOString()}`);
    console.log(`Samples: ${sampleCount}, Operations: ${this.operationCount}`);
    console.log('='.repeat(60) + '\n');

    await this.saveQuickResults();
  }

  async saveQuickResults() {
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }

    if (this.samples.length > 1) {
      const firstHeap = this.samples[0].heap_mb;
      const lastHeap = this.samples[this.samples.length - 1].heap_mb;
      const heapGrowth = lastHeap - firstHeap;
      const elapsedMinutes = (this.samples[this.samples.length - 1].time_seconds -
                             this.samples[0].time_seconds) / 60;
      const growthPerHour = elapsedMinutes > 0 ? (heapGrowth / elapsedMinutes) * 60 : 0;

      const results = {
        test_name: 'Quick Memory Test',
        duration_seconds: this.samples[this.samples.length - 1].time_seconds,
        samples: this.samples,
        analysis: {
          heap_growth_mb: parseFloat(heapGrowth.toFixed(2)),
          heap_growth_per_hour_mb: parseFloat(growthPerHour.toFixed(2)),
          first_heap_mb: parseFloat(firstHeap.toFixed(2)),
          last_heap_mb: parseFloat(lastHeap.toFixed(2)),
          leak_suspected: growthPerHour > 50
        }
      };

      const path2 = path.join(RESULTS_DIR, 'quick-memory-test-results.json');
      fs.writeFileSync(path2, JSON.stringify(results, null, 2));
      console.log(`Results: ${path2}`);
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function main() {
  const test = new QuickMemoryTest();

  try {
    await test.connect();
    await test.run();
    test.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    test.close();
    process.exit(1);
  }
}

main();
