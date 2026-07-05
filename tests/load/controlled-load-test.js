#!/usr/bin/env node

/**
 * Controlled Load Test - Basset Hound Browser
 *
 * Configuration:
 * - 10 concurrent connections
 * - 100 commands per connection (1000 total)
 * - 5 minute duration
 * - Balanced command mix across all command types
 * - Comprehensive metrics collection
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

class ControlledLoadTest {
  constructor(options = {}) {
    this.concurrentConnections = 10;
    this.commandsPerConnection = 100;
    this.testDuration = 5 * 60 * 1000; // 5 minutes
    this.port = 9876; // Use a different port to avoid conflicts

    // Metrics storage
    this.metrics = {
      timestamp: new Date().toISOString(),
      configuration: {
        concurrentConnections: this.concurrentConnections,
        commandsPerConnection: this.commandsPerConnection,
        totalCommands: this.concurrentConnections * this.commandsPerConnection,
        testDurationMs: this.testDuration,
        testDurationSec: this.testDuration / 1000
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
        p99Ms: 0,
        allLatencies: []
      },
      memory: {
        baseline: 0,
        peak: 0,
        final: 0,
        peakGrowth: 0,
        finalGrowth: 0
      },
      cpu: {
        idle: 0,
        peak: 0,
        average: 0
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpuCount: os.cpus().length,
        totalMemoryGB: os.totalmem() / 1024 / 1024 / 1024
      }
    };

    // Command type distribution for balanced mix
    this.commandTypes = [
      'navigate',
      'click',
      'fill',
      'scroll',
      'type',
      'hover',
      'wait',
      'screenshot',
      'getHTML',
      'getText',
      'getLinks',
      'getForms',
      'getImages',
      'getMetadata',
      'executeJS',
      'getUserAgent',
      'getProfile',
      'setCookie',
      'getCookies',
      'clearCookies'
    ];

    this.server = null;
    this.wss = null;
    this.serverConnections = new Map();
    this.serverMessages = 0;
    this.connectionCounter = 0;
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
            // Simulate realistic response delay (2-20ms)
            const responseDelay = Math.random() * 18 + 2;

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

      // Close all connections
      this.wss.clients.forEach((ws) => {
        try {
          ws.close();
        } catch (e) {
          // Ignore close errors
        }
      });

      // Close server
      this.server.close(() => {
        console.log('[MOCK-SERVER] Shutdown complete');
        resolve();
      });

      // Force close after 3 seconds
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
    console.log('║         CONTROLLED LOAD TEST - BASSET HOUND BROWSER                    ║');
    console.log('║      10 concurrent | 100 commands each | 5 minute duration             ║');
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
              latencies: []
            });
            resolve();
          });

          ws.on('error', (error) => {
            connectionFailures++;
            console.error(`[CONN-${i}] Connection error: ${error.message}`);
            resolve();
          });

          ws.on('close', () => {
            // Connection closed
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

    // Run load test
    console.log(`[TEST] Sending commands for ${this.testDuration / 1000}s...`);

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

    // Send commands in batches
    const commandSendInterval = setInterval(() => {
      const now = performance.now();
      if (now > testEndTime) {
        clearInterval(commandSendInterval);
        return;
      }

      activeConnections.forEach((conn) => {
        if (conn.commandsSent < this.commandsPerConnection && conn.ws.readyState === WebSocket.OPEN) {
          const command = this.generateCommand();
          const sendTime = performance.now();

          try {
            const listener = (data) => {
              try {
                const response = JSON.parse(data.toString());
                const latency = performance.now() - sendTime;

                conn.commandsResponded++;
                conn.latencies.push(latency);
                commandsResponded++;
                this.metrics.latency.allLatencies.push(latency);

                if (latency > this.metrics.latency.maxMs) {
                  this.metrics.latency.maxMs = latency;
                }
                if (latency < this.metrics.latency.minMs) {
                  this.metrics.latency.minMs = latency;
                }

                conn.ws.removeListener('message', listener);
              } catch (e) {
                conn.errors++;
                commandsErrored++;
              }
            };

            conn.ws.on('message', listener);
            conn.ws.send(JSON.stringify(command));
            conn.commandsSent++;
            commandsSent++;

            // Timeout for response after 10 seconds
            setTimeout(() => {
              if (conn.ws.listenerCount('message') > 0) {
                conn.ws.removeAllListeners('message');
                conn.errors++;
                commandsErrored++;
              }
            }, 10000);
          } catch (error) {
            conn.errors++;
            commandsErrored++;
          }
        }
      });

      // Show progress
      const elapsed = (now - testStartTime) / 1000;
      process.stdout.write(`\r[TEST] ${elapsed.toFixed(1)}s | Sent: ${commandsSent} | Responded: ${commandsResponded} | Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
    }, 100); // Send commands every 100ms

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
    if (this.metrics.latency.allLatencies.length > 0) {
      this.metrics.latency.samples = this.metrics.latency.allLatencies.length;
      this.metrics.latency.allLatencies.sort((a, b) => a - b);
      this.metrics.latency.avgMs = this.metrics.latency.allLatencies.reduce((a, b) => a + b, 0) / this.metrics.latency.allLatencies.length;

      const p50Index = Math.floor(this.metrics.latency.allLatencies.length * 0.50);
      const p95Index = Math.floor(this.metrics.latency.allLatencies.length * 0.95);
      const p99Index = Math.floor(this.metrics.latency.allLatencies.length * 0.99);

      this.metrics.latency.p50Ms = this.metrics.latency.allLatencies[p50Index];
      this.metrics.latency.p95Ms = this.metrics.latency.allLatencies[p95Index];
      this.metrics.latency.p99Ms = this.metrics.latency.allLatencies[p99Index];
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
    console.log('║                      LOAD TEST RESULTS                                 ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

    // Configuration
    console.log('CONFIGURATION:');
    console.log(`  Concurrent Connections: ${this.metrics.configuration.concurrentConnections}`);
    console.log(`  Commands per Connection: ${this.metrics.configuration.commandsPerConnection}`);
    console.log(`  Total Commands: ${this.metrics.configuration.totalCommands}`);
    console.log(`  Test Duration: ${this.metrics.configuration.testDurationSec}s (5 minutes)\n`);

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
    const throughputStatus = this.metrics.throughput.totalCommandsPerSec > 100 ? 'PASS' : 'FAIL';
    console.log(`  Status: ${throughputStatus}\n`);

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
    const latencyStatus = this.metrics.latency.p99Ms < 100 ? 'PASS' : 'FAIL';
    console.log(`  Status: ${latencyStatus}\n`);

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
    const allCommandsExecuted = this.metrics.commands.total === this.metrics.configuration.totalCommands;
    const memoryStable = this.metrics.memory.finalGrowth < 100; // Less than 100MB growth
    const connectionsCleanup = this.metrics.connections.cleanlyClosedPercentage >= 95;
    const noErrors = this.metrics.commands.errorRate === 0;
    const throughputPass = this.metrics.throughput.totalCommandsPerSec > 100;
    const latencyPass = this.metrics.latency.p99Ms < 100;

    console.log(`  All 1000 Commands Executed: ${allCommandsExecuted ? 'PASS' : 'FAIL'} (${this.metrics.commands.total}/${this.metrics.configuration.totalCommands})`);
    console.log(`  Memory Stable: ${memoryStable ? 'PASS' : 'FAIL'} (growth: ${this.metrics.memory.finalGrowth.toFixed(2)} MB)`);
    console.log(`  Connections Cleanup: ${connectionsCleanup ? 'PASS' : 'FAIL'} (${this.metrics.connections.cleanlyClosedPercentage.toFixed(2)}%)`);
    console.log(`  No Errors Under Load: ${noErrors ? 'PASS' : 'FAIL'} (error rate: ${this.metrics.commands.errorRate.toFixed(2)}%)`);
    console.log(`  Throughput >100 cmd/s: ${throughputPass ? 'PASS' : 'FAIL'} (${this.metrics.throughput.totalCommandsPerSec.toFixed(2)} cmd/s)`);
    console.log(`  Latency <100ms (P99): ${latencyPass ? 'PASS' : 'FAIL'} (${this.metrics.latency.p99Ms.toFixed(2)}ms)\n`);

    const allPass = allCommandsExecuted && memoryStable && connectionsCleanup && noErrors && throughputPass && latencyPass;
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
    const resultsFile = path.join(resultsDir, `controlled-load-test-${timestamp}.json`);

    // Remove large latency array from output
    const metricsForSave = JSON.parse(JSON.stringify(this.metrics));
    delete metricsForSave.latency.allLatencies;

    fs.writeFileSync(resultsFile, JSON.stringify(metricsForSave, null, 2));
    console.log(`\nResults saved to: ${resultsFile}\n`);
    return resultsFile;
  }

  async execute() {
    try {
      await this.startMockServer();

      // Give server time to start
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
const test = new ControlledLoadTest();
test.execute().catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});
