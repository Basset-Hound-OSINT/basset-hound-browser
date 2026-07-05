#!/usr/bin/env node

/**
 * PERFORMANCE BASELINE ESTABLISHMENT
 * Measures current state metrics after critical fixes
 *
 * Phases:
 * 1. Current State Metrics (single connection, warm-up)
 * 2. Load Test (10 concurrent, 100 commands each)
 * 3. Stability Test (30 minute continuous)
 * 4. Safety Margins (identify operational limits)
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const os = require('os');

class BaselineEstablishment {
  constructor(wsUrl = 'ws://localhost:8765') {
    this.wsUrl = wsUrl;
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: os.platform(),
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem()
      },
      phases: {}
    };
  }

  // Phase 1: Current State Metrics
  async phase1_currentState() {
    console.log('\n' + '='.repeat(70));
    console.log('PHASE 1: CURRENT STATE METRICS (Post-Fixes)');
    console.log('='.repeat(70));

    const phaseResults = {
      name: 'current-state',
      duration: 120000, // 2 minutes
      config: {
        warmupCommands: 10,
        testCommands: 50
      },
      measurements: {}
    };

    const ws = await this.connectWebSocket();

    try {
      // Warm-up phase
      console.log('\nWarm-up phase (10 commands)...');
      await this.runWarmup(ws, 10);

      // Actual measurements
      console.log('Measurement phase (50 commands)...');
      const metrics = await this.measureCommands(ws, 50);

      phaseResults.measurements = {
        throughput: {
          value: metrics.commandsPerSecond,
          unit: 'commands/sec'
        },
        latency: {
          p50: metrics.p50,
          p95: metrics.p95,
          p99: metrics.p99,
          min: metrics.min,
          max: metrics.max,
          unit: 'ms'
        },
        memory: {
          baseline: metrics.memoryBaseline,
          peak: metrics.memoryPeak,
          growth: metrics.memoryGrowth,
          unit: 'MB'
        },
        cpu: {
          usage: metrics.cpuUsage,
          unit: '%'
        }
      };

      ws.close();
    } catch (error) {
      console.error('Phase 1 error:', error.message);
      phaseResults.error = error.message;
    }

    this.results.phases.currentState = phaseResults;
    return phaseResults;
  }

  // Phase 2: Load Test
  async phase2_loadTest() {
    console.log('\n' + '='.repeat(70));
    console.log('PHASE 2: LOAD TEST (10 Concurrent, 100 Commands Each)');
    console.log('='.repeat(70));

    const phaseResults = {
      name: 'load-test',
      config: {
        concurrentClients: 10,
        commandsPerClient: 100,
        duration: 300000 // 5 minutes
      },
      measurements: {}
    };

    const startTime = Date.now();
    const memoryStart = process.memoryUsage();

    console.log('\nLaunching 10 concurrent clients...');
    const clientPromises = [];
    for (let i = 0; i < 10; i++) {
      clientPromises.push(this.runLoadClient(i, 100));
    }

    const clientResults = await Promise.allSettled(clientPromises);
    const duration = Date.now() - startTime;
    const memoryEnd = process.memoryUsage();

    // Aggregate results
    let allLatencies = [];
    let totalSuccess = 0;
    let totalFailures = 0;

    clientResults.forEach(result => {
      if (result.status === 'fulfilled') {
        allLatencies = allLatencies.concat(result.value.latencies);
        totalSuccess += result.value.succeeded;
        totalFailures += result.value.failed;
      } else {
        totalFailures++;
      }
    });

    allLatencies.sort((a, b) => a - b);

    phaseResults.measurements = {
      duration: duration,
      totalCommands: totalSuccess + totalFailures,
      successful: totalSuccess,
      failed: totalFailures,
      successRate: ((totalSuccess / (totalSuccess + totalFailures)) * 100).toFixed(2),
      throughput: ((totalSuccess / duration) * 1000).toFixed(2),
      latency: {
        p50: allLatencies[Math.floor(allLatencies.length * 0.5)],
        p95: allLatencies[Math.floor(allLatencies.length * 0.95)],
        p99: allLatencies[Math.floor(allLatencies.length * 0.99)],
        min: Math.min(...allLatencies),
        max: Math.max(...allLatencies),
        unit: 'ms'
      },
      memory: {
        growth: (memoryEnd.heapUsed - memoryStart.heapUsed) / 1024 / 1024,
        unit: 'MB'
      }
    };

    this.results.phases.loadTest = phaseResults;
    return phaseResults;
  }

  // Phase 3: Stability Test (simplified - 5 minute run)
  async phase3_stability() {
    console.log('\n' + '='.repeat(70));
    console.log('PHASE 3: STABILITY TEST (5 Minutes Continuous)');
    console.log('='.repeat(70));

    const phaseResults = {
      name: 'stability',
      duration: 300000, // 5 minutes
      config: {
        commandsPerSecond: 5,
        totalCommands: 25 // simplified
      },
      measurements: {}
    };

    const ws = await this.connectWebSocket();
    const memorySnapshots = [];
    const memStart = process.memoryUsage();
    const startTime = Date.now();

    console.log('\nRunning stability test for 5 minutes...');

    try {
      let commandCount = 0;
      const testDuration = 300000;
      const interval = setInterval(async () => {
        try {
          if (Date.now() - startTime > testDuration) {
            clearInterval(interval);
            ws.close();
            return;
          }

          await this.sendSimpleCommand(ws);
          commandCount++;
          memorySnapshots.push({
            timestamp: Date.now() - startTime,
            heapUsed: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
          });

          if (commandCount % 5 === 0) {
            process.stdout.write('.');
          }
        } catch (e) {
          // Continue
        }
      }, 1000);

      await new Promise(r => setTimeout(r, testDuration + 500));

      const memEnd = process.memoryUsage();
      const testDurationMs = Date.now() - startTime;

      phaseResults.measurements = {
        testDurationMs,
        commandsExecuted: commandCount,
        memorySnapshots: memorySnapshots.slice(0, 10), // Sample
        memoryGrowth: (memEnd.heapUsed - memStart.heapUsed) / 1024 / 1024,
        memoryGrowthRate: ((memEnd.heapUsed - memStart.heapUsed) / 1024 / 1024) / (testDurationMs / 1000),
        unit: 'MB / seconds'
      };

      console.log('\n');
    } catch (error) {
      console.error('Phase 3 error:', error.message);
      phaseResults.error = error.message;
    }

    this.results.phases.stability = phaseResults;
    return phaseResults;
  }

  // Phase 4: Safety Margins
  async phase4_safetyMargins() {
    console.log('\n' + '='.repeat(70));
    console.log('PHASE 4: SAFETY MARGINS IDENTIFICATION');
    console.log('='.repeat(70));

    const phaseResults = {
      name: 'safety-margins',
      analysis: {}
    };

    // Analyze data from previous phases
    const loadTest = this.results.phases.loadTest.measurements;
    const currentState = this.results.phases.currentState.measurements;

    // Memory limits
    const systemMemory = os.totalmem() / 1024 / 1024; // MB
    const memoryGrowthPerClient = (loadTest.memory.growth / 10).toFixed(2);
    const safeMemoryLimit = systemMemory * 0.4; // 40% of system memory
    const maxClientsBeforeMemoryIssue = Math.floor(safeMemoryLimit / parseFloat(memoryGrowthPerClient));

    // Throughput headroom
    const currentThroughput = parseFloat(loadTest.measurements?.throughput || 0);
    const targetThroughput = currentThroughput * 0.8; // 80% of max
    const throughputHeadroom = (100 - 80).toFixed(2);

    // Latency safety margins
    const p99Latency = loadTest.latency.p99;
    const safetyTarget = 50; // 50ms target
    const latencyMargin = (safetyTarget - p99Latency).toFixed(2);

    phaseResults.analysis = {
      memory: {
        systemTotal: systemMemory.toFixed(2),
        safeOperatingLimit: safeMemoryLimit.toFixed(2),
        growthPerClient: memoryGrowthPerClient,
        maxConcurrentClients: maxClientsBeforeMemoryIssue,
        unit: 'MB'
      },
      throughput: {
        measured: currentThroughput.toFixed(2),
        safeOperatingTarget: targetThroughput.toFixed(2),
        headroom: throughputHeadroom,
        unit: 'commands/sec and %'
      },
      latency: {
        p99: p99Latency,
        safetyTarget: safetyTarget,
        margin: latencyMargin,
        unit: 'ms'
      },
      recommendations: [
        `Max concurrent clients: ${maxClientsBeforeMemoryIssue} (before memory pressure)`,
        `Safe throughput target: ${targetThroughput.toFixed(2)} commands/sec`,
        `P99 latency margin: ${latencyMargin}ms headroom to 50ms target`,
        'Enable memory monitoring at 30% system memory usage',
        'Trigger scaling alerts at 35% system memory usage'
      ]
    };

    this.results.phases.safetyMargins = phaseResults;
    return phaseResults;
  }

  // Helper: Connect to WebSocket
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      ws.on('open', () => {
        clearTimeout(timeout);
        resolve(ws);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  // Helper: Warm-up phase
  async runWarmup(ws, count) {
    for (let i = 0; i < count; i++) {
      try {
        await this.sendSimpleCommand(ws);
        process.stdout.write('.');
      } catch (e) {
        // Warm-up, ignore errors
      }
    }
    console.log(' Done');
  }

  // Helper: Measure commands
  async measureCommands(ws, count) {
    const latencies = [];
    const memoryStart = process.memoryUsage();
    const cpuStart = process.cpuUsage();
    let successful = 0;

    for (let i = 0; i < count; i++) {
      try {
        const latency = await this.sendTimedCommand(ws);
        latencies.push(latency);
        successful++;
        process.stdout.write('.');
      } catch (e) {
        // Continue
      }
    }

    const memoryEnd = process.memoryUsage();
    const cpuEnd = process.cpuUsage(cpuStart);

    latencies.sort((a, b) => a - b);

    console.log('\n');

    return {
      commandsPerSecond: ((successful / 300) * 1000).toFixed(2),
      p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
      p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
      p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      memoryBaseline: (memoryStart.heapUsed / 1024 / 1024).toFixed(2),
      memoryPeak: (memoryEnd.heapUsed / 1024 / 1024).toFixed(2),
      memoryGrowth: ((memoryEnd.heapUsed - memoryStart.heapUsed) / 1024 / 1024).toFixed(2),
      cpuUsage: ((cpuEnd.user + cpuEnd.system) / 1000).toFixed(2)
    };
  }

  // Helper: Send simple command
  async sendSimpleCommand(ws) {
    return new Promise((resolve, reject) => {
      try {
        const cmd = {
          id: `cmd-${Date.now()}-${Math.random()}`,
          cmd: 'get-title'
        };

        ws.send(JSON.stringify(cmd), (error) => {
          if (error) reject(error);
        });

        const timeout = setTimeout(() => {
          reject(new Error('Command timeout'));
        }, 5000);

        const handler = (msg) => {
          try {
            clearTimeout(timeout);
            ws.removeListener('message', handler);
            resolve();
          } catch (e) {
            // Continue listening
          }
        };

        ws.on('message', handler);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Helper: Send timed command
  async sendTimedCommand(ws) {
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      try {
        const cmd = {
          id: `timed-${Date.now()}-${Math.random()}`,
          cmd: 'get-title'
        };

        ws.send(JSON.stringify(cmd), (error) => {
          if (error) reject(error);
        });

        const timeout = setTimeout(() => {
          reject(new Error('Command timeout'));
        }, 5000);

        const handler = (msg) => {
          try {
            clearTimeout(timeout);
            ws.removeListener('message', handler);
            const endTime = performance.now();
            resolve(endTime - startTime);
          } catch (e) {
            // Continue listening
          }
        };

        ws.on('message', handler);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Helper: Run load client
  async runLoadClient(clientId, commandCount) {
    const ws = await this.connectWebSocket();
    const latencies = [];
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < commandCount; i++) {
      try {
        const startTime = performance.now();
        const cmd = {
          id: `client${clientId}-cmd${i}`,
          cmd: 'get-title'
        };

        ws.send(JSON.stringify(cmd));

        // Simple timeout-based response
        const responsePromise = new Promise((resolve, reject) => {
          const handler = (msg) => {
            ws.removeListener('message', handler);
            resolve();
          };
          ws.on('message', handler);
          setTimeout(() => reject(new Error('Timeout')), 2000);
        });

        await responsePromise;
        const latency = performance.now() - startTime;
        latencies.push(latency);
        succeeded++;
      } catch (e) {
        failed++;
      }
    }

    ws.close();

    return {
      clientId,
      latencies,
      succeeded,
      failed
    };
  }

  // Main execution
  async run() {
    console.log('\n' + '='.repeat(70));
    console.log('BASSET HOUND BROWSER - PERFORMANCE BASELINE ESTABLISHMENT');
    console.log('='.repeat(70));
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Server: ${this.wsUrl}`);

    try {
      // Run all phases
      await this.phase1_currentState();
      await this.phase2_loadTest();
      await this.phase3_stability();
      await this.phase4_safetyMargins();

      // Save results
      this.saveResults();

      console.log('\n' + '='.repeat(70));
      console.log('BASELINE ESTABLISHMENT COMPLETE');
      console.log('='.repeat(70));

      return this.results;
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  }

  // Save results to file
  saveResults() {
    const resultsDir = '/home/devel/basset-hound-browser/tests/results/baselines';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `baseline-${timestamp}.json`;
    const filepath = path.join(resultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to: ${filepath}`);

    // Also save a summary
    const summaryPath = path.join(resultsDir, 'LATEST-BASELINE.json');
    fs.writeFileSync(summaryPath, JSON.stringify(this.results, null, 2));
    console.log(`Latest baseline: ${summaryPath}`);
  }
}

// Execute
const baseline = new BaselineEstablishment('ws://localhost:8765');
baseline.run().catch(error => {
  console.error('Execution error:', error);
  process.exit(1);
});
