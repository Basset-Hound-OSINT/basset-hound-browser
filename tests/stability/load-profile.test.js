/**
 * Real-World Load Profile Stability Test
 * Simulates realistic daily load patterns:
 * - Morning peak: 300+ concurrent (7am-11am)
 * - Afternoon normal: 150 concurrent (12pm-6pm)
 * - Evening low: 50 concurrent (7pm-11pm)
 * - Night maintenance: 10 concurrent (12am-6am)
 *
 * Date: June 1, 2026
 * Version: 1.0.0
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TEST_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Load profile: [concurrency, duration in hours]
const LOAD_PROFILE = [
  { name: 'Night', concurrency: 10, durationHours: 6, startHour: 0 },   // 12am-6am
  { name: 'Morning Peak', concurrency: 300, durationHours: 4, startHour: 7 },  // 7am-11am
  { name: 'Afternoon Normal', concurrency: 150, durationHours: 6, startHour: 12 }, // 12pm-6pm
  { name: 'Evening Low', concurrency: 50, durationHours: 4, startHour: 19 },  // 7pm-11pm
  { name: 'Night Maintenance', concurrency: 10, durationHours: 4, startHour: 23 }  // 11pm-3am
];

class LoadProfileClient {
  constructor(clientId) {
    this.clientId = clientId;
    this.ws = null;
    this.messageId = 1;
    this.metrics = {
      clientId,
      connected: false,
      messages: 0,
      success: 0,
      failures: 0,
      latencies: [],
      errors: []
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_URL);
        const timeout = setTimeout(() => {
          reject(new Error(`Client ${this.clientId} failed to connect`));
        }, 30000);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.metrics.connected = true;
          resolve();
        });

        this.ws.on('close', () => {
          this.metrics.connected = false;
        });

        this.ws.on('error', (err) => {
          this.metrics.errors.push(err.message);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.metrics.connected) {
        reject(new Error(`Client ${this.clientId} not connected`));
        return;
      }

      const id = String(this.messageId++);
      const startTime = performance.now();
      const message = { id, command, ...params };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout on ${command}`));
      }, 30000);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeout);
            this.ws.removeListener('message', handler);

            const latency = performance.now() - startTime;
            this.metrics.messages++;
            this.metrics.latencies.push(latency);

            if (response.success) {
              this.metrics.success++;
            } else {
              this.metrics.failures++;
            }

            resolve({ response, latency });
          }
        } catch (e) {
          // Not our message
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  async runWorkload() {
    const commands = [
      'ping',
      'status',
      'list_tabs',
      'get_page_state',
      'get_cookies'
    ];

    const command = commands[Math.floor(Math.random() * commands.length)];

    try {
      await this.sendCommand(command);
    } catch (err) {
      this.metrics.errors.push(err.message);
    }
  }

  async disconnect() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close();
        setTimeout(resolve, 1000);
      } else {
        resolve();
      }
    });
  }

  getStats() {
    const latencies = this.metrics.latencies;
    return {
      clientId: this.clientId,
      messages: this.metrics.messages,
      success: this.metrics.success,
      failures: this.metrics.failures,
      successRate: this.metrics.messages > 0 ? (this.metrics.success / this.metrics.messages * 100).toFixed(2) : 0,
      avgLatency: latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) : 0,
      minLatency: latencies.length > 0 ? Math.min(...latencies).toFixed(2) : 0,
      maxLatency: latencies.length > 0 ? Math.max(...latencies).toFixed(2) : 0,
      p99Latency: latencies.length > 0 ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)].toFixed(2) : 0,
      errors: this.metrics.errors.length
    };
  }
}

class LoadProfileTest {
  constructor() {
    this.clients = [];
    this.metrics = {
      timestamp: new Date().toISOString(),
      testName: 'Real-World Load Profile',
      duration: TEST_DURATION_MS,
      startTime: null,
      endTime: null,
      phaseMetrics: [],
      globalStats: {
        totalMessages: 0,
        totalSuccess: 0,
        totalFailures: 0,
        totalErrors: 0
      }
    };
    this.testActive = true;
  }

  /**
   * Get current load phase
   */
  getCurrentPhase(hours) {
    // Find which phase we're in
    for (const phase of LOAD_PROFILE) {
      if (hours >= phase.startHour && hours < phase.startHour + phase.durationHours) {
        return phase;
      }
    }
    // If we exceed 24 hours, cycle back
    const cycleHours = hours % 24;
    return this.getCurrentPhase(cycleHours);
  }

  /**
   * Adjust client pool size for current load
   */
  async adjustClientPool(targetConcurrency) {
    const currentSize = this.clients.length;

    if (currentSize < targetConcurrency) {
      // Add clients
      console.log(`[SCALE UP] Adding ${targetConcurrency - currentSize} clients (${currentSize} -> ${targetConcurrency})`);
      for (let i = currentSize; i < targetConcurrency; i++) {
        const client = new LoadProfileClient(i);
        try {
          await client.connect();
          this.clients.push(client);
        } catch (err) {
          console.error(`Failed to connect client ${i}: ${err.message}`);
        }
      }
    } else if (currentSize > targetConcurrency) {
      // Remove clients
      console.log(`[SCALE DOWN] Removing ${currentSize - targetConcurrency} clients (${currentSize} -> ${targetConcurrency})`);
      for (let i = targetConcurrency; i < currentSize; i++) {
        try {
          await this.clients[i].disconnect();
        } catch (err) {
          // Ignore
        }
      }
      this.clients = this.clients.slice(0, targetConcurrency);
    }
  }

  /**
   * Run workload for all connected clients
   */
  async runWorkloadRound() {
    const promises = this.clients
      .filter(c => c.metrics.connected)
      .map(c => c.runWorkload().catch(() => {}));

    await Promise.allSettled(promises);
  }

  /**
   * Monitor phase metrics
   */
  recordPhaseMetrics(phaseName, concurrency) {
    const stats = {
      phase: phaseName,
      targetConcurrency: concurrency,
      actualConcurrency: this.clients.filter(c => c.metrics.connected).length,
      totalMessages: 0,
      totalSuccess: 0,
      totalFailures: 0,
      avgLatency: 0,
      p99Latency: 0,
      allLatencies: [],
      clientStats: []
    };

    for (const client of this.clients) {
      const clientStats = client.getStats();
      stats.clientStats.push(clientStats);
      stats.totalMessages += client.metrics.messages;
      stats.totalSuccess += client.metrics.success;
      stats.totalFailures += client.metrics.failures;
      stats.allLatencies.push(...client.metrics.latencies);
    }

    if (stats.allLatencies.length > 0) {
      stats.avgLatency = (stats.allLatencies.reduce((a, b) => a + b, 0) / stats.allLatencies.length).toFixed(2);
      const sorted = stats.allLatencies.sort((a, b) => a - b);
      stats.p99Latency = sorted[Math.floor(sorted.length * 0.99)].toFixed(2);
    }

    this.metrics.phaseMetrics.push(stats);

    console.log(`[PHASE: ${phaseName}] Concurrency: ${stats.actualConcurrency}, ` +
      `Messages: ${stats.totalMessages}, Success: ${stats.totalSuccess}, ` +
      `Avg Latency: ${stats.avgLatency}ms, P99: ${stats.p99Latency}ms`);
  }

  /**
   * Run the load profile test
   */
  async run() {
    console.log(`\n========================================`);
    console.log(`Real-World Load Profile Test`);
    console.log(`Start Time: ${new Date().toISOString()}`);
    console.log(`========================================\n`);

    this.metrics.startTime = new Date().toISOString();
    const testStartTime = Date.now();
    let lastPhase = null;

    try {
      while (Date.now() - testStartTime < TEST_DURATION_MS && this.testActive) {
        const elapsedMs = Date.now() - testStartTime;
        const elapsedHours = elapsedMs / 1000 / 3600;
        const currentPhase = this.getCurrentPhase(elapsedHours);

        // Adjust client pool for current phase
        if (!lastPhase || lastPhase.name !== currentPhase.name) {
          console.log(`\n>>> Entering ${currentPhase.name} Phase <<<`);
          await this.adjustClientPool(currentPhase.concurrency);
          lastPhase = currentPhase;
        }

        // Run workload round
        await this.runWorkloadRound();

        // Record metrics every 5 minutes
        if (Math.floor(elapsedMs / 1000 / 60) % 5 === 0) {
          this.recordPhaseMetrics(currentPhase.name, currentPhase.concurrency);
        }

        // Small delay between rounds
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error(`Test failed: ${err.message}`);
    } finally {
      this.metrics.endTime = new Date().toISOString();

      // Cleanup
      console.log('\nCleaning up...');
      for (const client of this.clients) {
        try {
          await client.disconnect();
        } catch (err) {
          // Ignore
        }
      }
    }
  }

  /**
   * Generate report
   */
  generateReport() {
    let totalMessages = 0;
    let totalSuccess = 0;
    let totalFailures = 0;
    let allLatencies = [];

    for (const phase of this.metrics.phaseMetrics) {
      totalMessages += phase.totalMessages;
      totalSuccess += phase.totalSuccess;
      totalFailures += phase.totalFailures;
      allLatencies.push(...phase.allLatencies);
    }

    const report = {
      testName: 'Real-World Load Profile',
      duration: this.metrics.endTime && this.metrics.startTime
        ? (new Date(this.metrics.endTime) - new Date(this.metrics.startTime)) / 1000 / 60
        : 0,
      phases: this.metrics.phaseMetrics.length,
      totalMessages,
      totalSuccess,
      totalFailures,
      successRate: totalMessages > 0 ? (totalSuccess / totalMessages * 100).toFixed(2) : 0,
      avgLatency: allLatencies.length > 0 ? (allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length).toFixed(2) : 0,
      p99Latency: allLatencies.length > 0
        ? allLatencies.sort((a, b) => a - b)[Math.floor(allLatencies.length * 0.99)].toFixed(2)
        : 0,
      timestamps: {
        start: this.metrics.startTime,
        end: this.metrics.endTime
      }
    };

    return report;
  }

  /**
   * Save results
   */
  saveResults(directory) {
    const report = this.generateReport();

    const timestamp = Date.now();
    const reportPath = path.join(directory, `load-profile-${timestamp}.json`);

    fs.writeFileSync(reportPath, JSON.stringify({
      report,
      phaseMetrics: this.metrics.phaseMetrics
    }, null, 2));

    console.log(`\nResults saved to ${reportPath}`);
    return reportPath;
  }
}

// Run test
if (require.main === module) {
  const resultsDir = path.join(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const test = new LoadProfileTest();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down test...');
    test.testActive = false;
  });

  test.run().then(() => {
    const reportPath = test.saveResults(resultsDir);
    const report = test.generateReport();

    console.log('\n========================================');
    console.log('Load Profile Test Summary');
    console.log('========================================');
    console.log(`Total Messages: ${report.totalMessages}`);
    console.log(`Success Rate: ${report.successRate}%`);
    console.log(`Avg Latency: ${report.avgLatency}ms`);
    console.log(`P99 Latency: ${report.p99Latency}ms`);
    console.log(`========================================\n`);

    process.exit(report.totalFailures > 0 ? 1 : 0);
  }).catch(err => {
    console.error(`Test failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { LoadProfileTest };
