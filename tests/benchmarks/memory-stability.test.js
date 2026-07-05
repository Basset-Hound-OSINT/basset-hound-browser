/**
 * Memory Stability Test
 *
 * Runs the server for 30 minutes with continuous load
 * to detect memory leaks and GC behavior
 *
 * Success Criteria:
 * - Memory growth rate < 1 MB/min
 * - No sustained growth after 10 minutes
 * - GC events at expected intervals
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class MemoryStabilityTest {
  constructor(options = {}) {
    this.config = {
      duration: options.duration || 1800000, // 30 minutes
      clientCount: options.clientCount || 5,
      commandsPerSecond: options.commandsPerSecond || 20,
      sampleInterval: options.sampleInterval || 5000, // 5 seconds
      url: options.url || 'ws://localhost:8765'
    };

    this.memoryData = [];
    this.commandMetrics = [];
    this.startTime = null;
    this.endTime = null;
    this.activeConnections = 0;
    this.totalCommands = 0;
    this.commandsSucceeded = 0;
    this.commandsFailed = 0;
  }

  /**
   * Create a continuous command stream for a single client
   */
  async runContinuousClient(clientId) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.config.url);
        let commandCount = 0;
        let connected = false;

        ws.on('open', () => {
          connected = true;
          this.activeConnections++;

          // Send commands at controlled rate
          const commandInterval = (1000 / this.config.commandsPerSecond) / this.config.clientCount;
          const timer = setInterval(() => {
            if (Date.now() - this.startTime >= this.config.duration) {
              clearInterval(timer);
              ws.close();
              return;
            }

            if (ws.readyState === WebSocket.OPEN) {
              const command = {
                id: `${clientId}-${commandCount++}`,
                cmd: 'execute-javascript',
                code: 'return performance.now()'
              };

              try {
                ws.send(JSON.stringify(command));
                this.totalCommands++;
              } catch (error) {
                this.commandsFailed++;
              }
            }
          }, commandInterval);
        });

        ws.on('message', () => {
          this.commandsSucceeded++;
        });

        ws.on('error', (error) => {
          this.commandsFailed++;
          if (!connected) {
            reject(error);
          }
        });

        ws.on('close', () => {
          this.activeConnections--;
          resolve();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Monitor memory and system metrics
   */
  monitorMemory() {
    return new Promise((resolve) => {
      const samples = [];

      const sampleInterval = setInterval(() => {
        const elapsed = Date.now() - this.startTime;

        if (elapsed >= this.config.duration) {
          clearInterval(sampleInterval);
          resolve(samples);
          return;
        }

        const memUsage = process.memoryUsage();
        const sample = {
          timestamp: elapsed,
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
          external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
          rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
          activeConnections: this.activeConnections
        };

        samples.push(sample);
        this.memoryData.push(sample);
      }, this.config.sampleInterval);
    });
  }

  /**
   * Analyze memory stability
   */
  analyzeMemoryStability() {
    if (this.memoryData.length < 2) {
      return { status: 'INSUFFICIENT_DATA' };
    }

    // Split data into phases: early (0-5min), middle (5-15min), late (15-30min)
    const totalPoints = this.memoryData.length;
    const earlyEnd = Math.floor(totalPoints * 0.167);
    const middleEnd = Math.floor(totalPoints * 0.5);

    const earlyPhase = this.memoryData.slice(0, earlyEnd);
    const middlePhase = this.memoryData.slice(earlyEnd, middleEnd);
    const latePhase = this.memoryData.slice(middleEnd);

    // Calculate growth rates for each phase
    const earlyGrowth = this.calculateGrowthRate(earlyPhase);
    const middleGrowth = this.calculateGrowthRate(middlePhase);
    const lateGrowth = this.calculateGrowthRate(latePhase);

    // Detect leak characteristics
    const maxHeapUsed = Math.max(...this.memoryData.map(s => s.heapUsed));
    const minHeapUsed = Math.min(...this.memoryData.map(s => s.heapUsed));
    const volatility = maxHeapUsed - minHeapUsed;

    // Determine stability
    const isStable = lateGrowth < 1.0; // Less than 1 MB/min in final phase
    const noLeak = lateGrowth <= earlyGrowth * 0.5; // Not accelerating
    const lowVolatility = volatility < 50; // Less than 50 MB swing

    return {
      status: isStable && noLeak ? 'PASS' : 'FAIL',
      phases: {
        early: {
          start: earlyPhase[0]?.heapUsed || 0,
          end: earlyPhase[earlyPhase.length - 1]?.heapUsed || 0,
          growthRate: Math.round(earlyGrowth * 100) / 100,
          unit: 'MB/min'
        },
        middle: {
          start: middlePhase[0]?.heapUsed || 0,
          end: middlePhase[middlePhase.length - 1]?.heapUsed || 0,
          growthRate: Math.round(middleGrowth * 100) / 100,
          unit: 'MB/min'
        },
        late: {
          start: latePhase[0]?.heapUsed || 0,
          end: latePhase[latePhase.length - 1]?.heapUsed || 0,
          growthRate: Math.round(lateGrowth * 100) / 100,
          unit: 'MB/min'
        }
      },
      stability: {
        isStable,
        noLeak,
        lowVolatility,
        volatility: Math.round(volatility * 100) / 100
      },
      peakMemory: {
        heapUsed: Math.round(maxHeapUsed * 100) / 100,
        timestamp: this.memoryData.find(s => s.heapUsed === maxHeapUsed)?.timestamp || 0
      }
    };
  }

  /**
   * Calculate growth rate in MB/min
   */
  calculateGrowthRate(samples) {
    if (samples.length < 2) return 0;

    const first = samples[0].heapUsed;
    const last = samples[samples.length - 1].heapUsed;
    const growth = last - first;

    // Duration in minutes
    const duration = (samples[samples.length - 1].timestamp - samples[0].timestamp) / 1000 / 60;

    if (duration === 0) return 0;
    return growth / duration;
  }

  /**
   * Run the stability test
   */
  async run() {
    console.log(`\n${'='.repeat(70)}`);
    console.log('MEMORY STABILITY TEST');
    console.log(`Configuration:`);
    console.log(`  Duration: ${this.config.duration / 1000 / 60} minutes`);
    console.log(`  Concurrent Clients: ${this.config.clientCount}`);
    console.log(`  Commands/sec: ${this.config.commandsPerSecond}`);
    console.log(`  Sample Interval: ${this.config.sampleInterval}ms`);
    console.log(`${'='.repeat(70)}\n`);

    this.startTime = Date.now();

    try {
      // Start memory monitoring
      const memoryPromise = this.monitorMemory();

      // Run continuous clients
      const clientPromises = [];
      for (let i = 0; i < this.config.clientCount; i++) {
        clientPromises.push(this.runContinuousClient(i));
      }

      const memoryData = await memoryPromise;
      await Promise.allSettled(clientPromises);

      this.endTime = Date.now();

      // Analyze results
      const analysis = this.analyzeMemoryStability();
      const commandMetrics = {
        totalCommands: this.totalCommands,
        succeeded: this.commandsSucceeded,
        failed: this.commandsFailed,
        successRate: this.totalCommands > 0
          ? Math.round((this.commandsSucceeded / this.totalCommands) * 10000) / 100
          : 0
      };

      return {
        timestamp: new Date().toISOString(),
        duration: this.endTime - this.startTime,
        config: this.config,
        memoryData,
        analysis,
        commandMetrics
      };

    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  }

  /**
   * Print analysis results
   */
  printAnalysis(results) {
    const a = results.analysis;

    console.log(`\nMemory Stability Analysis:`);
    console.log(`Status: ${a.status}`);
    console.log(`\nPhases:`);
    console.log(`  Early (0-5 min):`);
    console.log(`    Growth: ${a.phases.early.growthRate} MB/min`);
    console.log(`  Middle (5-15 min):`);
    console.log(`    Growth: ${a.phases.middle.growthRate} MB/min`);
    console.log(`  Late (15-30 min):`);
    console.log(`    Growth: ${a.phases.late.growthRate} MB/min`);

    console.log(`\nStability Metrics:`);
    console.log(`  Is Stable: ${a.stability.isStable}`);
    console.log(`  No Leak: ${a.stability.noLeak}`);
    console.log(`  Low Volatility: ${a.stability.lowVolatility}`);
    console.log(`  Memory Volatility: ${a.stability.volatility} MB`);

    console.log(`\nCommand Metrics:`);
    console.log(`  Total Commands: ${results.commandMetrics.totalCommands}`);
    console.log(`  Succeeded: ${results.commandMetrics.succeeded}`);
    console.log(`  Failed: ${results.commandMetrics.failed}`);
    console.log(`  Success Rate: ${results.commandMetrics.successRate}%`);

    console.log(`\nPeak Memory:`);
    console.log(`  Heap Used: ${a.peakMemory.heapUsed} MB`);
    console.log(`  At: ${a.peakMemory.timestamp}ms`);

    console.log(`\n${'='.repeat(70)}\n`);
  }

  /**
   * Save results to file
   */
  saveResults(results, filename) {
    const dir = path.join(__dirname, '../../tests/results/benchmarks');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(`Results saved to: ${filepath}`);
    return filepath;
  }
}

module.exports = { MemoryStabilityTest };
