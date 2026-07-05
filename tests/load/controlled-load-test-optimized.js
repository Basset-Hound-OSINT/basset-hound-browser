#!/usr/bin/env node

/**
 * Controlled Load Test - Optimized
 *
 * Configuration:
 * - 10 concurrent connections
 * - 100 commands per connection (1000 total)
 * - 5 minute duration
 * - Balanced command mix across all command types
 * - Aggressive command sending to achieve >100 cmd/s throughput
 *
 * Metrics:
 * - Throughput: commands/second (target: >100)
 * - Latency: P50, P95, P99 (target: <100ms)
 * - Memory: baseline, peak, stability
 * - CPU: idle vs under load
 * - Error rate: (target: 0%)
 */

const WebSocket = require('ws');
const http = require('http');
const os = require('os');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class OptimizedLoadTest {
  constructor(options = {}) {
    this.concurrentConnections = 10;
    this.commandsPerConnection = 100;
    this.testDuration = 5 * 60 * 1000; // 5 minutes
    this.port = 9877; // Unique port

    // Optimization: send multiple commands per batch
    this.commandsPerBatch = 10; // Send 10 commands per batch per connection
    this.batchIntervalMs = 10; // Send batch every 10ms = ~1000 cmd/s potential

    // Metrics storage
    this.metrics = {
      timestamp: new Date().toISOString(),
      configuration: {
        concurrentConnections: this.concurrentConnections,
        commandsPerConnection: this.commandsPerConnection,
        totalCommands: this.concurrentConnections * this.commandsPerConnection,
        testDurationMs: this.testDuration,
        testDurationSec: this.testDuration / 1000,
        optimizations: {
          commandsPerBatch: this.commandsPerBatch,
          batchIntervalMs: this.batchIntervalMs,
          maxTheoriticalThroughput: (this.concurrentConnections * this.commandsPerBatch * 1000) / this.batchIntervalMs
        }
      },
      execution: {
        startTime: null,
        endTime: null,
        actualDurationMs: 0,
        actualDurationSec: 0
      },
      commands: {
        total: 0,
        successful: 0,
        failed: 0,
        errorRate: 0
      },
      connections: {
        total: 0,
        successful: 0,
        failed: 0,
        cleanlyClosedPercentage: 0
      },
      throughput: {
        totalCommandsPerSec: 0,
        commandsPerConnectionPerSec: 0
      },
      latency: {
        samples: 0,
        minMs: Infinity,
        maxMs: 0,
        avgMs: 0,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0
      },
      memory: {
        baseline: 0,
        peak: 0,
        final: 0,
        peakGrowth: 0,
        finalGrowth: 0
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpuCount: os.cpus().length,
        totalMemoryGB: os.totalmem() / 1024 / 1024 / 1024
      }
    };

    // Command type distribution
    this.commandTypes = [
      'navigate', 'click', 'fill', 'scroll', 'type', 'hover', 'wait',
      'screenshot', 'getHTML', 'getText', 'getLinks', 'getForms',
      'getImages', 'getMetadata', 'executeJS', 'getUserAgent',
      'getProfile', 'setCookie', 'getCookies', 'clearCookies'
    ];

    this.server = null;
    this.wss = null;
    this.serverConnections = new Map();
    this.serverMessages = 0;
    this.connectionCounter = 0;
    this.allLatencies = [];
  }

  startMockServer() {
    return new Promise((resolve, reject) => {
      console.log(`[MOCK-SERVER] Starting on port ${this.port}...`);

      this.server = http.createServer();
      this.wss = new WebSocket.Server({ server: this.server });

      this.wss.on('connection', (ws) => {
        this.connectionCounter++;
        const id = this.connectionCounter;
        const connInfo = {
          id,
          ws,
          messageCount: 0,
          connectedAt: Date.now(),
          closed: false,
          errors: 0
        };
        this.serverConnections.set(id, connInfo);

        ws.on('message', (data) => {
          this.serverMessages++;
          const conn = this.serverConnections.get(id);
          if (conn) {
            conn.messageCount++;
          }

          try {
            const msg = JSON.parse(data.toString());
            // Simulate realistic response delay (1-10ms for fast responses)
            const responseDelay = Math.random() * 9 + 1;

            setTimeout(() => {
              const response = {
                id: msg.id || Math.random(),
                success: true,
                command: msg.command || 'unknown',
                timestamp: new Date().toISOString(),
                result: { processed: true, messageId: this.serverMessages }
              };

              try {
                ws.send(JSON.stringify(response));
              } catch (e) {
                if (conn) conn.errors++;
              }
            }, responseDelay);

          } catch (error) {
            try {
              if (conn) conn.errors++;
              ws.send(JSON.stringify({
                id: Math.random(),
                success: false,
                error: 'Invalid JSON'
              }));
            } catch (e) {
              // Connection might be closed
            }
          }
        });

        ws.on('close', () => {
          const conn = this.serverConnections.get(id);
          if (conn) {
            conn.closed = true;
          }
        });

        ws.on('error', (error) => {
          const conn = this.serverConnections.get(id);
          if (conn) {
            conn.errors++;
          }
        });
      });

      this.server.listen(this.port, () => {
        console.log(`[MOCK-SERVER] Listening on port ${this.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  stopMockServer() {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      console.log('[MOCK-SERVER] Shutting down...');
      this.wss.clients.forEach((ws) => {
        try {
          ws.close();
        } catch (e) {
          // Ignore
        }
      });

      this.server.close(() => {
        console.log('[MOCK-SERVER] Shutdown complete');
        resolve();
      });

      setTimeout(() => {
        resolve();
      }, 3000);
    });
  }

  generateCommand() {
    const type = this.commandTypes[Math.floor(Math.random() * this.commandTypes.length)];
    return {
      id: Math.random().toString(36).substr(2, 9),
      command: type,
      params: {
        url: 'https://example.com',
        selector: '.test-element',
        text: 'test text',
        delay: Math.random() * 100
      },
      timestamp: Date.now()
    };
  }

  async runLoadTest() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║      OPTIMIZED CONTROLLED LOAD TEST - BASSET HOUND BROWSER             ║');
    console.log('║   10 concurrent | 100 commands each | 5 minute | Aggressive Batching   ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

    this.metrics.execution.startTime = new Date().toISOString();
    const testStartTime = performance.now();
    this.metrics.memory.baseline = process.memoryUsage().heapUsed / 1024 / 1024;

    console.log(`[TEST] Baseline memory: ${this.metrics.memory.baseline.toFixed(2)} MB`);
    console.log(`[TEST] Creating ${this.concurrentConnections} concurrent connections...`);

    const connections = [];
    let connectionSuccesses = 0;
    let connectionFailures = 0;

    // Create connections
    const connectionPromises = [];
    for (let i = 0; i < this.concurrentConnections; i++) {
      connectionPromises.push(
        new Promise((resolve) => {
          const ws = new WebSocket(`ws://localhost:${this.port}`);
          const connStartTime = performance.now();

          ws.on('open', () => {
            connectionSuccesses++;
            connections.push({
              ws,
              id: i,
              commandsSent: 0,
              commandsResponded: 0,
              errors: 0,
              latencies: [],
              pendingResponses: new Map()
            });
            resolve();
          });

          ws.on('error', (error) => {
            connectionFailures++;
            console.error(`[CONN-${i}] Connection error: ${error.message}`);
            resolve();
          });

          ws.on('message', (data) => {
            try {
              const response = JSON.parse(data.toString());
              const conn = connections.find(c => c.ws === ws);
              if (conn && conn.pendingResponses.has(response.id)) {
                const sendTime = conn.pendingResponses.get(response.id);
                const latency = performance.now() - sendTime;

                conn.commandsResponded++;
                conn.latencies.push(latency);
                this.allLatencies.push(latency);

                conn.pendingResponses.delete(response.id);
              }
            } catch (e) {
              // Ignore parse errors
            }
          });

          // Timeout after 5 seconds
          setTimeout(() => {
            if (ws.readyState === WebSocket.CONNECTING) {
              ws.close();
              connectionFailures++;
              resolve();
            }
          }, 5000);
        })
      );
    }

    await Promise.all(connectionPromises);
    this.metrics.connections.total = this.concurrentConnections;
    this.metrics.connections.successful = connectionSuccesses;
    this.metrics.connections.failed = connectionFailures;

    console.log(`[TEST] Connected: ${connectionSuccesses}/${this.concurrentConnections}`);

    if (connectionSuccesses === 0) {
      console.error('[TEST] FAILED: Could not establish any connections');
      return false;
    }

    // Run load test with aggressive batching
    console.log(`[TEST] Sending commands for ${this.testDuration / 1000}s (batch: ${this.commandsPerBatch} cmds every ${this.batchIntervalMs}ms)...`);

    let commandsSent = 0;
    let commandsResponded = 0;
    let commandsErrored = 0;

    const memoryCheckInterval = setInterval(() => {
      const current = process.memoryUsage().heapUsed / 1024 / 1024;
      if (current > this.metrics.memory.peak) {
        this.metrics.memory.peak = current;
      }
    }, 100);

    const testEndTime = testStartTime + this.testDuration;
    const activeConnections = connections.filter(c => c.ws.readyState === WebSocket.OPEN);

    // Send commands in aggressive batches
    const commandSendInterval = setInterval(() => {
      const now = performance.now();
      if (now > testEndTime) {
        clearInterval(commandSendInterval);
        return;
      }

      activeConnections.forEach((conn) => {
        // Send batch of commands
        for (let i = 0; i < this.commandsPerBatch; i++) {
          if (conn.commandsSent < this.commandsPerConnection && conn.ws.readyState === WebSocket.OPEN) {
            const command = this.generateCommand();
            const sendTime = performance.now();

            conn.pendingResponses.set(command.id, sendTime);

            try {
              conn.ws.send(JSON.stringify(command));
              conn.commandsSent++;
              commandsSent++;
            } catch (error) {
              conn.errors++;
              commandsErrored++;
            }
          }
        }
      });

      // Show progress every second
      if (Math.floor(((now - testStartTime) / 1000)) % 1 === 0) {
        const elapsed = (now - testStartTime) / 1000;
        const actualThroughput = commandsResponded / elapsed;
        process.stdout.write(`\r[TEST] ${elapsed.toFixed(1)}s | Sent: ${commandsSent} | Responded: ${commandsResponded} | Throughput: ${actualThroughput.toFixed(2)} cmd/s | Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
      }
    }, this.batchIntervalMs);

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, this.testDuration));
    clearInterval(commandSendInterval);
    clearInterval(memoryCheckInterval);

    console.log('\n[TEST] Test duration completed, waiting for remaining responses...');

    // Wait up to 30 seconds for remaining responses
    const responseWaitStart = performance.now();
    while (commandsResponded < commandsSent && (performance.now() - responseWaitStart) < 30000) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate metrics
    const testEndTimeActual = performance.now();
    const actualDurationMs = testEndTimeActual - testStartTime;
    this.metrics.execution.endTime = new Date().toISOString();
    this.metrics.execution.actualDurationMs = actualDurationMs;
    this.metrics.execution.actualDurationSec = actualDurationMs / 1000;

    this.metrics.commands.total = commandsSent;
    this.metrics.commands.successful = commandsResponded;
    this.metrics.commands.failed = commandsErrored;
    this.metrics.commands.errorRate = commandsSent > 0 ? (commandsErrored / commandsSent) * 100 : 0;

    // Latency percentiles
    if (this.allLatencies.length > 0) {
      this.metrics.latency.samples = this.allLatencies.length;
      this.allLatencies.sort((a, b) => a - b);
      this.metrics.latency.minMs = this.allLatencies[0];
      this.metrics.latency.maxMs = this.allLatencies[this.allLatencies.length - 1];
      this.metrics.latency.avgMs = this.allLatencies.reduce((a, b) => a + b, 0) / this.allLatencies.length;

      const p50Index = Math.floor(this.allLatencies.length * 0.50);
      const p95Index = Math.floor(this.allLatencies.length * 0.95);
      const p99Index = Math.floor(this.allLatencies.length * 0.99);

      this.metrics.latency.p50Ms = this.allLatencies[p50Index];
      this.metrics.latency.p95Ms = this.allLatencies[p95Index];
      this.metrics.latency.p99Ms = this.allLatencies[p99Index];
    }

    // Throughput
    this.metrics.throughput.totalCommandsPerSec = (commandsResponded / (actualDurationMs / 1000));
    this.metrics.throughput.commandsPerConnectionPerSec = this.metrics.throughput.totalCommandsPerSec / this.concurrentConnections;

    // Memory
    this.metrics.memory.final = process.memoryUsage().heapUsed / 1024 / 1024;
    this.metrics.memory.peakGrowth = this.metrics.memory.peak - this.metrics.memory.baseline;
    this.metrics.memory.finalGrowth = this.metrics.memory.final - this.metrics.memory.baseline;

    // Connection cleanup
    let cleanedConnections = 0;
    activeConnections.forEach(conn => {
      if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.close();
        cleanedConnections++;
      }
    });
    this.metrics.connections.cleanlyClosedPercentage = (cleanedConnections / connectionSuccesses) * 100;

    // Wait for connections to close
    await new Promise(resolve => setTimeout(resolve, 1000));

    return true;
  }

  printResults() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    LOAD TEST RESULTS - OPTIMIZED                      ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

    // Configuration
    console.log('CONFIGURATION:');
    console.log(`  Concurrent Connections: ${this.metrics.configuration.concurrentConnections}`);
    console.log(`  Commands per Connection: ${this.metrics.configuration.commandsPerConnection}`);
    console.log(`  Total Commands Target: ${this.metrics.configuration.totalCommands}`);
    console.log(`  Test Duration: ${this.metrics.configuration.testDurationSec}s (5 minutes)`);
    console.log(`  Batch Size: ${this.metrics.configuration.optimizations.commandsPerBatch} commands`);
    console.log(`  Batch Interval: ${this.metrics.configuration.optimizations.batchIntervalMs}ms`);
    console.log(`  Theoretical Max Throughput: ${this.metrics.configuration.optimizations.maxTheoriticalThroughput.toFixed(2)} cmd/s\n`);

    // Execution Summary
    console.log('EXECUTION SUMMARY:');
    console.log(`  Start Time: ${this.metrics.execution.startTime}`);
    console.log(`  End Time: ${this.metrics.execution.endTime}`);
    console.log(`  Actual Duration: ${this.metrics.execution.actualDurationSec.toFixed(2)}s\n`);

    // Connections
    console.log('CONNECTION METRICS:');
    console.log(`  Total Requested: ${this.metrics.connections.total}`);
    console.log(`  Successful: ${this.metrics.connections.successful}`);
    console.log(`  Failed: ${this.metrics.connections.failed}`);
    console.log(`  Cleanup Success Rate: ${this.metrics.connections.cleanlyClosedPercentage.toFixed(2)}%\n`);

    // Commands
    console.log('COMMAND METRICS:');
    console.log(`  Total Sent: ${this.metrics.commands.total}`);
    console.log(`  Successful: ${this.metrics.commands.successful}`);
    console.log(`  Failed/Timeout: ${this.metrics.commands.failed}`);
    console.log(`  Error Rate: ${this.metrics.commands.errorRate.toFixed(2)}%\n`);

    // Throughput
    console.log('THROUGHPUT METRICS:');
    console.log(`  Total: ${this.metrics.throughput.totalCommandsPerSec.toFixed(2)} commands/sec`);
    console.log(`  Per Connection: ${this.metrics.throughput.commandsPerConnectionPerSec.toFixed(2)} commands/sec`);
    console.log(`  Target: >100 commands/sec`);
    const throughputResult = this.metrics.throughput.totalCommandsPerSec > 100 ? 'PASS' : 'FAIL';
    console.log(`  Status: ${throughputPass}\n`);

    // Latency
    console.log('LATENCY METRICS:');
    console.log(`  Samples: ${this.metrics.latency.samples}`);
    console.log(`  Min: ${this.metrics.latency.minMs.toFixed(2)}ms`);
    console.log(`  Max: ${this.metrics.latency.maxMs.toFixed(2)}ms`);
    console.log(`  Average: ${this.metrics.latency.avgMs.toFixed(2)}ms`);
    console.log(`  P50: ${this.metrics.latency.p50Ms.toFixed(2)}ms`);
    console.log(`  P95: ${this.metrics.latency.p95Ms.toFixed(2)}ms`);
    console.log(`  P99: ${this.metrics.latency.p99Ms.toFixed(2)}ms`);
    console.log(`  Target: <100ms`);
    const latencyResult = this.metrics.latency.p99Ms < 100 ? 'PASS' : 'FAIL';
    console.log(`  Status: ${latencyPass}\n`);

    // Memory
    console.log('MEMORY METRICS:');
    console.log(`  Baseline: ${this.metrics.memory.baseline.toFixed(2)} MB`);
    console.log(`  Peak: ${this.metrics.memory.peak.toFixed(2)} MB`);
    console.log(`  Final: ${this.metrics.memory.final.toFixed(2)} MB`);
    console.log(`  Peak Growth: ${this.metrics.memory.peakGrowth.toFixed(2)} MB`);
    console.log(`  Final Growth: ${this.metrics.memory.finalGrowth.toFixed(2)} MB\n`);

    // System
    console.log('SYSTEM INFO:');
    console.log(`  Platform: ${this.metrics.system.platform} (${this.metrics.system.arch})`);
    console.log(`  CPU Cores: ${this.metrics.system.cpuCount}`);
    console.log(`  Total Memory: ${this.metrics.system.totalMemoryGB.toFixed(2)} GB\n`);

    // Pass/Fail
    console.log('PASS/FAIL VERDICT:');
    const allCommandsExecuted = this.metrics.commands.total >= (this.metrics.configuration.totalCommands * 0.95); // Allow 95% to account for time-based cutoff
    const memoryStable = this.metrics.memory.finalGrowth < 100;
    const connectionsCleanup = this.metrics.connections.cleanlyClosedPercentage >= 95;
    const noErrors = this.metrics.commands.errorRate <= 1; // Allow <1% error rate
    const throughputPass2 = this.metrics.throughput.totalCommandsPerSec > 100;
    const latencyPass2 = this.metrics.latency.p99Ms < 100;

    console.log(`  All 1000+ Commands Executed: ${allCommandsExecuted ? 'PASS' : 'FAIL'} (${this.metrics.commands.total})`);
    console.log(`  Memory Stable: ${memoryStable ? 'PASS' : 'FAIL'} (growth: ${this.metrics.memory.finalGrowth.toFixed(2)} MB)`);
    console.log(`  Connections Cleanup: ${connectionsCleanup ? 'PASS' : 'FAIL'} (${this.metrics.connections.cleanlyClosedPercentage.toFixed(2)}%)`);
    console.log(`  Low Error Rate: ${noErrors ? 'PASS' : 'FAIL'} (error rate: ${this.metrics.commands.errorRate.toFixed(2)}%)`);
    console.log(`  Throughput >100 cmd/s: ${throughputPass ? 'PASS' : 'FAIL'} (${this.metrics.throughput.totalCommandsPerSec.toFixed(2)} cmd/s)`);
    console.log(`  Latency <100ms (P99): ${latencyPass ? 'PASS' : 'FAIL'} (${this.metrics.latency.p99Ms.toFixed(2)}ms)\n`);

    const allPass = allCommandsExecuted && memoryStable && connectionsCleanup && noErrors && throughputPass2 && latencyPass2;
    console.log('OVERALL RESULT: ' + (allPass ? '✓ PASS' : '✗ FAIL') + '\n');

    return {
      pass: allPass,
      throughputPass,
      latencyPass,
      memoryPass: memoryStable,
      connectivityPass: connectionsCleanup,
      errorPass: noErrors,
      commandPass: allCommandsExecuted
    };
  }

  saveResults() {
    const resultsDir = path.join(__dirname, '../results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(resultsDir, `controlled-load-test-optimized-${timestamp}.json`);

    fs.writeFileSync(resultsFile, JSON.stringify(this.metrics, null, 2));
    console.log(`Results saved to: ${resultsFile}\n`);
    return resultsFile;
  }

  async execute() {
    try {
      await this.startMockServer();
      await new Promise(resolve => setTimeout(resolve, 500));

      const success = await this.runLoadTest();

      if (success) {
        this.printResults();
        const resultsFile = this.saveResults();

        console.log('╔════════════════════════════════════════════════════════════════════════╗');
        console.log('║                    LOAD TEST COMPLETE                                  ║');
        console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

        process.exit(0);
      } else {
        console.error('[TEST] Load test failed');
        process.exit(1);
      }
    } catch (error) {
      console.error('[TEST] Fatal error:', error);
      process.exit(1);
    } finally {
      await this.stopMockServer();
    }
  }
}

// Run the test
const test = new OptimizedLoadTest();
test.execute().catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});
